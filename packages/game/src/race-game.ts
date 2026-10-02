import type { EntityId, PresetId, Value } from '@hm/contracts';
import type { Runtime } from '@hm/engine';
import { RACERS } from '@hm/content';
import { derivePhysics, aiControl, rubberBand, createLapTracker, rankRacers, itemById, rollItem, type Track } from '@hm/racing';
import { createRacerSystem, defineRacerComponents, grantItem } from '@hm/racers';
import { carveTrack, chaikin, makeCenterline, resample, startGrid } from '@hm/trackgen';
import { encodeTerrain, generateIsland, heightAt, type Terrain } from '@hm/terrain';
import { createChampionship, createRaceDirector, type Championship, type DirectorEvent, type RaceDirector, type RaceResult } from '@hm/raceflow';
import { goblinParts, lookFromParams, type Part } from '@hm/goblins';
import { createInputState, toActorFrame, type InputState } from '@hm/input';
import { SURF } from '@hm/render';
import { attachDef, createFollowSystem, defineAttachComponent } from './follow';

export const BALL_RADIUS = 0.8;

export interface RaceGameOptions {
  readonly seed?: number;
  readonly laps?: number;
  readonly field?: number;
  /** Which racer seed the player drives (index into the content library's goblins). */
  readonly playerIndex?: number;
}

export interface Hud {
  speed: number; lap: number; laps: number; position: number; racers: number; timeMs: number;
  item: { id: string; label: string; icon: string } | null; boost: number; message: string | undefined; phase: string;
}

export interface RaceGame {
  readonly rt: Runtime;
  readonly track: Track;
  readonly terrain: Terrain;
  readonly input: InputState;
  readonly director: RaceDirector;
  readonly championship: Championship;
  readonly racerIds: readonly EntityId[];
  readonly player: EntityId;
  /** Advance the race by wall-clock ms. Returns the render interpolation alpha. */
  update(dtMs: number): number;
  hud(): Hud;
  racerStates(): { id: string; x: number; z: number; color: string; me: boolean }[];
  results(): readonly RaceResult[] | null;
  /** Put everyone back on the grid and start the countdown again. */
  restart(): void;
  /** Where the chase camera should look (the player's position and heading). */
  playerPose(): { x: number; y: number; z: number; hx: number; hz: number; speed: number };
  onEvent(listener: (e: DirectorEvent) => void): () => void;
}

const ITEM_QUARTER = 4;

/** Builds the Basalt-Isle race: carved terrain + track, eight goblins in glass balls, rules, director and input. */
export function createRaceGame(rt: Runtime, opts: RaceGameOptions = {}): RaceGame {
  const seed = opts.seed ?? 7;
  const laps = opts.laps ?? 3;
  const n = Math.max(2, Math.min(12, opts.field ?? 8));
  const playerSeed = RACERS[(opts.playerIndex ?? 0) % RACERS.length]!;

  // ---- the island and the track carved into it
  const spec = { cols: 129, rows: 129, cell: 2, originX: -128, originZ: -128 };
  const terrain = generateIsland(spec, seed, { surfaces: { seabed: SURF.seabed, sand: SURF.sand, grass: SURF.grass, rock: SURF.rock, cliff: SURF.cliff }, radius: 0.95, height: 18, roughness: 7 });
  const centre = makeCenterline({ seed, points: 36, radius: 52, wobble: 0.3, squash: 1.35 });
  const track: Track = { points: resample(chaikin(centre, 2), 6), width: 13 };
  carveTrack(terrain, track, { shoulder: 7, roadSurface: SURF.pumice, shoulderSurface: SURF.dunes });

  const ground = rt.store.put({ kind: 'terrain', name: 'Basalt Isle', params: { data: encodeTerrain(terrain) as never, soft: 0.55, bump: 1, friction: 0.9, restitution: 0 } });
  const cam = rt.store.put({ kind: 'camera', name: 'Chase', params: { fov: 60, distance: 14, yaw: 0, pitch: 0.4 } });
  const scene = rt.store.put({ kind: 'scene', name: 'Basalt Isle GP', params: { gravity: 19, camera: { ref: cam.id } }, children: { terrain: [{ ref: ground.id }] } });
  rt.loadScene(scene.id as PresetId);

  const world = rt.world;
  defineRacerComponents(world as never);
  defineAttachComponent(world);
  void attachDef;

  // ---- rules, director, input
  const input = createInputState();
  let phase = 'lobby';
  let dir: RaceDirector = createRaceDirector({ racers: [], laps });
  const racerIds: EntityId[] = [];
  const colors = new Map<EntityId, string>();
  let player = 0;
  const lastQuarter = new Map<EntityId, number>();
  let results: RaceResult[] | null = null;
  const listeners = new Set<(e: DirectorEvent) => void>();
  const championship = createChampionship({ raceIds: ['basalt-isle'], racers: Array.from({ length: n }, (_, i) => `r${i}`) });

  const makeSystem = () => createRacerSystem({
    physics: rt.physics, track, laps,
    derivePhysics,
    aiControl: (t, s, skill, rng) => (phase === 'racing' ? aiControl(t, s, skill, rng) : { steer: 0, throttle: 0 }),
    rubberBand, createLapTracker, rankRacers, itemById,
  });
  const install = (): void => { rt.sim.removeSystem("racers"); rt.sim.addSystem(makeSystem() as never); };
  rt.sim.addSystem(createFollowSystem());
  install();

  // ---- spawn the field
  const grid = startGrid(track, n);
  const spawnRacer = (i: number): EntityId => {
    const seedI = i === 0 ? playerSeed : RACERS[(i + (opts.playerIndex ?? 0)) % RACERS.length]!;
    const p = seedI.params;
    const stats = { weight: Number(p['weight']), speed: Number(p['speed']), bounce: Number(p['bounce']) };
    const phys = derivePhysics(stats);
    const slot = grid[i]!;
    const y = heightAt(terrain, slot.x, slot.z) + BALL_RADIUS + 0.4;
    const ball = world.spawn();
    rt.physics.addBody(ball, { kind: 'dynamic', collider: { shape: 'sphere', radius: BALL_RADIUS }, mass: phys.mass, friction: 0.6, restitution: phys.restitution, linearDamping: 0.03, angularDamping: 0.3, position: [slot.x, y, slot.z], tier: 'racing' });
    world.add(ball, 'renderable', { shape: 'sphere', size: BALL_RADIUS, color: '#bfe8ff', roughness: 0.05, metalness: 0, opacity: 0.22 });
    world.add(ball, 'racer', { name: seedI.name, controller: i === 0 ? 'player' : 'ai', actor: 'p1', weight: stats.weight, speed: stats.speed, bounce: stats.bounce, hx: slot.hx, hz: slot.hz, skill: Number(p['skill'] ?? 0.6) });
    world.add(ball, 'race', {});
    colors.set(ball, String(p['color']));
    const look = lookFromParams(p as Record<string, unknown>);
    for (const part of goblinParts(look, BALL_RADIUS) as Part[]) {
      if (part.role === 'glass') continue;
      const e = world.spawn();
      world.add(e, 'transform', { x: slot.x, y, z: slot.z, sx: part.scale[0], sy: part.scale[1], sz: part.scale[2] });
      world.add(e, 'renderable', { shape: part.shape, size: part.size, color: part.color, roughness: part.roughness, metalness: part.metalness });
      world.add(e, 'attach', { parent: ball, lx: part.position[0], ly: part.position[1], lz: part.position[2], qx: part.rotation[0], qy: part.rotation[1], qz: part.rotation[2], qw: part.rotation[3] });
    }
    return ball;
  };
  for (let i = 0; i < n; i++) racerIds.push(spawnRacer(i));
  player = racerIds[0]!;
  rt.play();

  const emit = (events: DirectorEvent[]): void => {
    for (const e of events) {
      if (e.type === 'phase') phase = e.phase;
      if (e.type === 'results') results = e.results.map((r) => ({ ...r }));
      for (const l of listeners) l(e);
    }
  };

  const begin = (): void => {
    dir = createRaceDirector({ racers: racerIds.map(String), laps });
    results = null;
    phase = 'lobby';
    emit(dir.start());
  };
  begin();

  const progressMap = (): Record<string, { progress: number; finished: boolean }> => {
    const m: Record<string, { progress: number; finished: boolean }> = {};
    for (const id of racerIds) {
      const r = world.get(id, 'race');
      m[String(id)] = { progress: Number(r?.['progress'] ?? 0), finished: r?.['finished'] === true };
    }
    return m;
  };

  const grantItems = (): void => {
    for (const id of racerIds) {
      const r = world.get(id, 'race');
      const rc = world.get(id, 'racer');
      if (!r || !rc) continue;
      const q = Math.floor(Number(r['progress']) * ITEM_QUARTER);
      const prev = lastQuarter.get(id) ?? 0;
      if (q > prev && rc['item'] === '' && q < laps * ITEM_QUARTER) grantItem(world as never, id, rollItem(Number(r['place']) || 1, racerIds.length, () => rt.sim.rng.next()).id);
      lastQuarter.set(id, q);
    }
  };

  const game: RaceGame = {
    rt, track, terrain, input, get director() { return dir; }, championship, racerIds, get player() { return player; },
    update(dtMs) {
      const alpha = rt.frame(dtMs, (tick) => ({ tick, actors: phase === 'racing' ? { p1: toActorFrame(input.sample()) } : {} }));
      input.update(dtMs);
      emit(dir.update(dtMs, progressMap()));
      if (phase === 'racing') grantItems();
      return alpha;
    },
    hud() {
      const v = world.get(player, 'velocity'), r = world.get(player, 'race'), rc = world.get(player, 'racer');
      const itemId = String(rc?.['item'] ?? '');
      const def = itemById(itemId);
      const lights = dir.state.lights;
      const message = phase === 'countdown' ? (lights > 0 ? String(lights) : 'GO!') : phase === 'racing' && dir.state.raceTimeMs < 1200 ? 'GO!' : phase === 'finished' || phase === 'results' ? 'FINISH!' : undefined;
      return {
        speed: Math.hypot(Number(v?.['vx'] ?? 0), Number(v?.['vz'] ?? 0)) * 3.6,
        lap: Math.min(laps, Number(r?.['lap'] ?? 1)), laps, position: Number(r?.['place'] ?? 1) || 1, racers: racerIds.length,
        timeMs: dir.state.raceTimeMs, item: def ? { id: def.id, label: def.id, icon: ITEM_ICONS[def.id] ?? '?' } : null,
        boost: Math.min(1, Number(rc?.['boostMs'] ?? 0) / 2500), message, phase,
      };
    },
    racerStates() {
      return racerIds.map((id) => { const t = world.get(id, 'transform'); return { id: String(id), x: Number(t?.['x'] ?? 0), z: Number(t?.['z'] ?? 0), color: colors.get(id) ?? '#fff', me: id === player }; });
    },
    results: () => results,
    restart() {
      racerIds.forEach((id, i) => {
        const slot = grid[i]!;
        const y = heightAt(terrain, slot.x, slot.z) + BALL_RADIUS + 0.4;
        world.set(id, 'transform', { x: slot.x, y, z: slot.z, qx: 0, qy: 0, qz: 0, qw: 1 });
        world.set(id, 'velocity', { vx: 0, vy: 0, vz: 0, wx: 0, wy: 0, wz: 0 });
        world.set(id, 'racer', { hx: slot.hx, hz: slot.hz, boostMs: 0, item: '' });
        world.set(id, 'race', { lap: 1, progress: 0, finished: false, place: 0 });
      });
      lastQuarter.clear();
      install();
      begin();
    },
    playerPose() {
      const t = world.get(player, 'transform'), rc = world.get(player, 'racer'), v = world.get(player, 'velocity');
      return { x: Number(t?.['x'] ?? 0), y: Number(t?.['y'] ?? 0), z: Number(t?.['z'] ?? 0), hx: Number(rc?.['hx'] ?? 1), hz: Number(rc?.['hz'] ?? 0), speed: Math.hypot(Number(v?.['vx'] ?? 0), Number(v?.['vz'] ?? 0)) };
    },
    onEvent(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  };
  return game;
}

const ITEM_ICONS: Record<string, string> = { boost: '⚡', jump: '⤴', oil: '🛢', shockwave: '💥', mass: '⚓', slipstream: '🌀', freeze: '❄', ghost: '👻' };

export type { Value };
