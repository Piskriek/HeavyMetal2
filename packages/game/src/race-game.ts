import type { EntityId, PresetId, Value } from '@hm/contracts';
import type { Runtime } from '@hm/engine';
import { RACERS } from '@hm/content';
import { trackLength, pointAt, project, derivePhysics, aiControl, rubberBand, createLapTracker, rankRacers, itemById, rollItem, type Track } from '@hm/racing';
import { createRacerSystem, defineRacerComponents, grantItem } from '@hm/racers';
import { trackWalls, carveTrack, chaikin, makeCenterline, resample, startGrid } from '@hm/trackgen';
import { encodeTerrain, generateIsland, heightAt, type Terrain } from '@hm/terrain';
import { toCenterline } from '@hm/trackedit';
import { createChampionship, createRaceDirector, type Championship, type DirectorEvent, type RaceDirector, type RaceResult } from '@hm/raceflow';
import { goblinParts, lookFromParams, quatFromYaw, type Part } from '@hm/goblins';
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
  /** Race on the map already loaded in the runtime (terrain + track preset) instead of generating one. */
  readonly fromScene?: boolean;
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

  // ---- the island and the track: generated, or taken from the scene the Map Maker built
  const { terrain, track } = ((): { terrain: Terrain; track: Track } => {
    if (opts.fromScene) {
      const st = rt.binder.terrain();
      if (!st) throw new Error('race: the loaded map has no terrain');
      const sp = rt.store.get(rt.binder.sceneId ?? '');
      const tref = sp?.params['track'];
      const tp = tref && typeof tref === 'object' && 'ref' in tref ? rt.store.get(String((tref as { ref: string }).ref)) : undefined;
      const pts = (tp?.params['points'] as unknown as number[][] | undefined) ?? [];
      const draft = { points: pts.map(([x, z]) => ({ x: x ?? 0, z: z ?? 0 })), closed: true, width: Number(tp?.params['width'] ?? 12) };
      const centre = resample(toCenterline(draft, 6), 6);
      if (centre.length < 8) throw new Error('race: the map needs a closed track with at least 3 control points');
      return { terrain: st.terrain, track: { points: centre, width: draft.width } };
    }
    const spec = { cols: 129, rows: 129, cell: 2, originX: -128, originZ: -128 };
    const t = generateIsland(spec, seed, { surfaces: { seabed: SURF.seabed, sand: SURF.sand, grass: SURF.grass, rock: SURF.rock, cliff: SURF.cliff }, radius: 0.95, height: 18, roughness: 7 });
    const centre = makeCenterline({ seed, points: 36, radius: 52, wobble: 0.3, squash: 1.35 });
    const tr: Track = { points: resample(chaikin(centre, 2), 6), width: 13 };
    carveTrack(t, tr, { shoulder: 7, roadSurface: SURF.pumice, shoulderSurface: SURF.dunes });
    const ground = rt.store.put({ kind: 'terrain', name: 'Basalt Isle', params: { data: encodeTerrain(t) as never, soft: 0.55, bump: 1, friction: 0.9, restitution: 0 } });
    const cam = rt.store.put({ kind: 'camera', name: 'Chase', params: { fov: 60, distance: 14, yaw: 0, pitch: 0.4 } });
    const scene = rt.store.put({ kind: 'scene', name: 'Basalt Isle GP', params: { gravity: 19, camera: { ref: cam.id } }, children: { terrain: [{ ref: ground.id }] } });
    rt.loadScene(scene.id as PresetId);
    return { terrain: t, track: tr };
  })();

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

  // ---- low walls along both sides keep the field on the island road
  const WALL_H = 0.9;
  for (const w of trackWalls(track, { offset: track.width / 2 + 3, spacing: 4, side: 'both' })) {
    const q = quatFromYaw(Math.atan2(w.dz, w.dx));
    const y = heightAt(terrain, w.x, w.z) + WALL_H * 0.5;
    const e = world.spawn();
    world.add(e, 'transform', { x: w.x, y, z: w.z, qx: q[0], qy: q[1], qz: q[2], qw: q[3], sx: w.length / 2 + 0.05, sy: WALL_H / 2, sz: 0.4 });
    world.add(e, 'renderable', { shape: 'box', size: 1, color: '#9b8f7d', roughness: 0.85, metalness: 0 });
    rt.physics.addBody(e, { kind: 'static', collider: { shape: 'box', half: [w.length / 2 + 0.05, WALL_H / 2, 0.4] }, position: [w.x, y, w.z], rotation: [q[0], q[1], q[2], q[3]], friction: 0.2, restitution: 0.3, tier: 'racing' });
  }

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

  // ---- item hazards you can see: oil slicks on the road; frozen / ghost / anchored balls change look
  const slickViews: { e: EntityId; ttl: number }[] = [];
  rt.events.on('hazard:oil', (p) => {
    const q = p as { x: number; z: number; r: number; ttlMs: number };
    const e = world.spawn();
    world.add(e, 'transform', { x: q.x, y: heightAt(terrain, q.x, q.z) + 0.07, z: q.z, sx: q.r, sy: 0.02, sz: q.r });
    world.add(e, 'renderable', { shape: 'cylinder', size: 1, color: '#060504', roughness: 0.55, metalness: 0, opacity: 0.93 });
    slickViews.push({ e, ttl: q.ttlMs });
  });
  const statusLook = (dtMs: number): void => {
    for (let i = slickViews.length - 1; i >= 0; i--) {
      const v = slickViews[i]!; v.ttl -= dtMs;
      if (v.ttl <= 0) { if (world.alive(v.e)) world.despawn(v.e); slickViews.splice(i, 1); }
    }
    for (const id of racerIds) {
      const rc = world.get(id, 'racer');
      if (!rc) continue;
      const frozen = Number(rc['freezeMs']) > 0, ghost = Number(rc['ghostMs']) > 0, anchored = Number(rc['shieldMs']) > 0, slick = Number(rc['slowMs']) > 0;
      world.set(id, 'renderable', { color: frozen ? '#9fe8ff' : anchored ? '#c9c2b0' : slick ? '#d8cfa8' : '#bfe8ff', opacity: ghost ? 0.08 : frozen ? 0.6 : 0.22 });
    }
  };

  /** Put a racer back on the road at its current race progress (fell off, stuck, or pressed reset). */
  const respawn = (id: EntityId): void => {
    const r = world.get(id, 'race');
    const len = trackLength(track);
    const s = (((Number(r?.['progress'] ?? 0) % 1) + 1) % 1) * len;
    const here = pointAt(track, s), ahead = pointAt(track, s + 2);
    const hx = ahead[0] - here[0], hz = ahead[1] - here[1], hl = Math.hypot(hx, hz) || 1;
    world.set(id, 'transform', { x: here[0], y: heightAt(terrain, here[0], here[1]) + BALL_RADIUS + 0.5, z: here[1], qx: 0, qy: 0, qz: 0, qw: 1 });
    world.set(id, 'velocity', { vx: 0, vy: 0, vz: 0, wx: 0, wy: 0, wz: 0 });
    world.set(id, 'racer', { hx: hx / hl, hz: hz / hl, boostMs: 0 });
  };
  const fallen = new Map<EntityId, number>();
  const watchdog = (dtMs: number): void => {
    for (const id of racerIds) {
      const t = world.get(id, 'transform');
      if (!t) continue;
      const low = Number(t['y']) < -1.5 || !onTrackish(Number(t['x']), Number(t['z']));
      const acc = low ? (fallen.get(id) ?? 0) + dtMs : 0;
      fallen.set(id, acc);
      if (acc > 1500 || (id === player && input.sample().reset)) { fallen.set(id, 0); respawn(id); }
    }
  };
  const onTrackish = (x: number, z: number): boolean => Math.abs(project(track, [x, z]).lateral) < track.width / 2 + 9;

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
      const alpha = rt.frame(dtMs, (tick) => ({ tick, actors: (phase === 'racing' ? { p1: toActorFrame(input.sample()) } : {}) as Record<string, Record<string, number | boolean>> }));
      input.update(dtMs);
      if (phase === 'racing') watchdog(dtMs);
      emit(dir.update(dtMs, progressMap()));
      if (phase === 'racing') grantItems();
      statusLook(dtMs);
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
