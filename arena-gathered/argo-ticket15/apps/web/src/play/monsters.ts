/**
 * The monsters on the planet (TASK-23b-2; renamed from monster-mash-combat.ts). The pure brain is @hm/leaksim: this module owns the
 * world it steps, the leaks on the plot's junked models, the guns (raycast through leaksim), the telegraph rings, the drops and the
 * events that the screen turns into HUD, narration, health and items. The renderers are in ../monsters (per era).
 *
 * No monster is shown with the words "Monster Mash" (the owner, 13 October): the sprites are monsters, the setting is Monsters.
 */
import * as THREE from 'three';
import { ARCHETYPES, addLeak, createWorld, hurt as leakHurt, placeMob, raycast, step as leakStep, type Archetype, type Event as LeakEvent, type Input as LeakInput, type Mob, type Solid, type World } from '@hm/leaksim';
import { createMonsterRenderer, type MonsterMob, type MonsterRenderer } from '../monsters/renderer';
import { hash32, skinFor } from '../monsters/adapter';
import { GATE_DOME_RADIUS, eraForStage, kindsForEra, leakSites, clearOfGate, dropStack, hitBearing, monsterCap, DORMANT_REWARD, SEAL_REWARD, DEFAULT_MONSTERS, type LeakSite, type MonstersSetting, type Point, type SafeZone } from '../monsters/policy';
import { createLeakVisuals, type LeakVisuals } from '../monsters/leak-visual';
import { gameAudio } from '../audio/game-audio';
import type { Era } from '../monsters/roster';
import type { WeaponStats } from '../base/weapons';

export type { MonstersSetting } from '../monsters/policy';

import { SEAL_REACH, PROXIMITY_SPAWN_RADIUS, PROXIMITY_SPAWN_INTERVAL, maxMobsPerLeak, spawnPolicy, beamDamage } from './monster-rules';
import { applyTurboBassSwarmerKnockback, TURBO_BASS_KNOCKBACK_M, TURBO_BASS_RADIUS_M } from '../../../../packages/tooljuice/src/beat-synced-plume-and-turbobass';
export { SEAL_REACH, PROXIMITY_SPAWN_RADIUS, PROXIMITY_SPAWN_INTERVAL, maxMobsPerLeak, spawnPolicy, beamDamage };

export interface MonsterMarker {
  readonly id: number;
  readonly site: number;
  readonly x: number;
  readonly z: number;
  readonly dormant: boolean;
  /** dormant: never opens; open: waves run; warned: a wave is due in `inSeconds`; sealed: shut for good. */
  readonly state: 'dormant' | 'open' | 'warned' | 'sealed';
  readonly inSeconds: number | null;
  /** The junked model the leak sits on (a generated prop id). */
  readonly junk: string;
  /** 0 to 1: how far the seal has run. */
  readonly seal: number;
  readonly era: Era | null;
}

export interface MonsterStats {
  readonly mobsSpawned: number;
  readonly mobsDefeated: number;
  readonly damageDealt: number;
  readonly shotsFired: number;
  readonly pelletsHit: number;
  readonly leaksSealed: number;
  /** Winds-ups begun, and hits that landed on the player (a hit always follows its wind-up). */
  readonly telegraphs: number;
  readonly hitsOnPlayer: number;
}

export interface MonsterMobStatus {
  readonly id: number;
  readonly kind: Archetype;
  readonly era: Era;
  readonly hp: number;
  readonly phase: string;
  readonly pos: { readonly x: number; readonly y: number; readonly z: number };
}

/** The events the screen turns into the game's: the HUD, the narration, the chain, the health and the items. */
export interface MonsterEvents {
  /** A leak's wave is due in 20 s (the HUD marker; no line yet: the owner owes the radio text). */
  onWarn?(leak: MonsterMarker): void;
  /** A monster's wind-up began (a flash, the rising sound, a ring). */
  onTelegraph?(mob: MonsterMobStatus): void;
  /** A monster hit the player: the damage and the bearing from the player's facing (radians, 0 is ahead). */
  onHitPlayer?(damage: number, bearing: number, mob: MonsterMobStatus | null): void;
  /** A sapper is latched to a machine this frame: the machine's output halves (see `isLatched`). */
  onDrain?(machineId: number, amount: number): void;
  /** A monster died: its drop is the substrate it burst into. */
  onDeath?(mob: MonsterMobStatus, drop: { readonly item: string; readonly n: number }): void;
  /** A leak was sealed. The dormant anomaly gives the first core; any other leak gives the substrate. */
  onSealed?(marker: MonsterMarker, reward: readonly { readonly item: string; readonly n: number }[]): void;
  /** The first monster came into view (M-01 is the narrator's). */
  onSeen?(mob: MonsterMobStatus): void;
}

export interface FireResult { readonly fired: boolean; readonly hits: number; readonly damage: number; readonly killed: number; readonly reason?: string }
export interface BeamHitResult { readonly hit: number | null; readonly damage: number; readonly killed: boolean }

export interface MonstersSystem {
  isEquipped(): boolean;
  equip(on: boolean): void;
  setWeaponStats(stats: WeaponStats | null): void;
  getWeaponStats(): WeaponStats | null;
  /** The trigger is held (the next shot is `fire`; kept for the screen's button state). */
  setTrigger(held: boolean): void;
  /** Fires the weapon from `origin` along the ground direction `dir` (x and z). Pellets are raycast through leaksim. */
  fire(origin: Point, dir: Point): FireResult;
  /** Raycasts the extraction beam through leaksim and applies chip damage `dmg` to the nearest hit mob (TICKET-07 Item C). */
  beamHit(origin: Point, dir: Point, range: number, dmg: number): BeamHitResult;
  getAmmo(): { readonly current: number; readonly max: number };
  reload(): void;
  setFidelityStage(stage: number): void;
  setSetting(setting: MonstersSetting): void;
  getSetting(): MonstersSetting;
  /** F-03: the monsters fight only once the first gun exists (the chain's flag). */
  setUnlocked(on: boolean): void;
  /** Act IV: the dormant anomaly exists from the rifle on (its seal is the first core). */
  setDormantActive(on: boolean): void;
  /** The plot's seed and the gate pad: the leak sites are laid out from them. */
  setPlot(seed: number, gate: Point): void;
  /** The leak sites already sealed (saved per profile): they come back sealed, with no waves and no reward. */
  setSealedSites(sites: readonly number[]): void;
  /** The leak sites sealed so far (for the save). */
  sealedSites(): readonly number[];
  /** The screen's handlers (the HUD, the narration, the chain, the health and the items). */
  setEvents(events: MonsterEvents): void;
  setSafeZones(zones: readonly SafeZone[]): void;
  /** The built machines: a sapper drains the nearest one from its footprint's edge (`hu` is the half size). */
  setMachines(machines: readonly { readonly id: number; readonly x: number; readonly z: number; readonly hu?: number }[]): void;
  /** The built footprints the ground monsters keep out of (P0-MON-03): the base's boxes, from `footprintSolids`. */
  setSolids(solids: readonly Solid[]): void;
  /** The graphics budget: the most living monsters (`monsterCap`). */
  setQuality(quality: string): void;
  /** The leak the beam is held on (its id from `leakUnder`), or null. The brain seals it while the player is within SEAL_REACH. */
  setSealing(leak: number | null): void;
  /** The leak under the aim: the nearest leak whose column the ray passes within 2.5 m of, within `range`; null when none. */
  leakUnder(origin: Point & { readonly y?: number }, dir: Point, range: number): number | null;
  /** Whether a machine is latched by a sapper this moment (its output halves). */
  isLatched(machineId: number): boolean;
  /** One frame: steps the brain (events to the handlers), draws the monsters and the leaks, and moves the telegraph rings. */
  update(dt: number, player: { readonly x: number; readonly z: number; readonly yaw: number; readonly alive: boolean }, camera: THREE.Camera): void;
  markers(): readonly MonsterMarker[];
  getMobList(): readonly MonsterMobStatus[];
  /** A hit on a monster by id (the dev hooks and the tests): its death and drop go the same way as a shot's. */
  hurtMob(id: number, damage: number): { readonly killed: boolean } | null;
  /** Places a monster of `kind` at (x, z), on no leak (the dev hooks and the tests). Returns its id. */
  placeMob(kind: Archetype, x: number, z: number): number;
  /** Window D (TICKET-15): Non-lethal [V] Turbo Bass sub-bass pulse knocking back swarmers within radiusM by up to pushM metres. */
  knockbackSwarmers(origin: Point, radiusM?: number, pushM?: number, downbeatPulse0to1?: number): number;
  getStats(): MonsterStats;
  /** The brain's world, for the tests and the replay check. */
  world(): World;
  clearMobs(): void;
  dispose(): void;
}

// -----------------------------------------------------------------------------
// Procedural Web Audio FX Synthesizer
// -----------------------------------------------------------------------------
class CombatAudio {
  private getTarget(): { readonly ctx: AudioContext; readonly out: AudioNode } | null {
    try {
      const ctx = gameAudio.getContext();
      const out = gameAudio.getCombatBus();
      return { ctx, out };
    } catch {
      return null;
    }
  }

  playShotgunBlast(): void {
    const t = this.getTarget();
    if (!t) return;
    const { ctx, out } = t;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gainOsc = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(190, now);
    osc.frequency.exponentialRampToValueAtTime(32, now + 0.28);
    gainOsc.gain.setValueAtTime(0.7, now);
    gainOsc.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
    osc.connect(gainOsc);
    gainOsc.connect(out);
    osc.start(now);
    osc.stop(now + 0.35);

    const bufferSize = Math.floor(ctx.sampleRate * 0.18);
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      const sample = ((hash32(i + 0x9e3779b9) >>> 0) / 2147483648) - 1;
      data[i] = sample * Math.exp(-i / (ctx.sampleRate * 0.04));
    }
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1600, now);
    filter.Q.setValueAtTime(1.2, now);
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.85, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(out);
    noise.start(now);

    setTimeout(() => {
      if (ctx.state !== 'running') return;
      const nowClick = ctx.currentTime;
      const click = ctx.createOscillator();
      const clickGain = ctx.createGain();
      click.type = 'square';
      click.frequency.setValueAtTime(620, nowClick);
      click.frequency.exponentialRampToValueAtTime(180, nowClick + 0.05);
      clickGain.gain.setValueAtTime(0.25, nowClick);
      clickGain.gain.exponentialRampToValueAtTime(0.001, nowClick + 0.06);
      click.connect(clickGain);
      clickGain.connect(out);
      click.start(nowClick);
      click.stop(nowClick + 0.07);
    }, 180);
  }

  playEquip(): void {
    const t = this.getTarget();
    if (!t) return;
    const { ctx, out } = t;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(840, now + 0.1);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.connect(gain);
    gain.connect(out);
    osc.start(now);
    osc.stop(now + 0.14);
  }

  /** The wind-up's rising tone (350 ms): a monster is about to strike (P0-MON-02). */
  playTelegraph(): void {
    const t = this.getTarget();
    if (!t) return;
    const { ctx, out } = t;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(520, now + 0.35);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.14, now + 0.25);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.36);
    osc.connect(gain);
    gain.connect(out);
    osc.start(now);
    osc.stop(now + 0.37);
  }
}

// -----------------------------------------------------------------------------
// Procedural Tactical Combat Shotgun Viewmodel
// -----------------------------------------------------------------------------
function createShotgunViewmodel(): { group: THREE.Group; flashMesh: THREE.Mesh; flashLight: THREE.PointLight } {
  const group = new THREE.Group();

  const gunMetalMat = new THREE.MeshStandardMaterial({ color: 0x1a1c22, roughness: 0.3, metalness: 0.85 });
  const darkWoodMat = new THREE.MeshStandardMaterial({ color: 0x4a2c18, roughness: 0.65, metalness: 0.05 });
  const steelMat = new THREE.MeshStandardMaterial({ color: 0x3d434a, roughness: 0.25, metalness: 0.9 });

  const receiverGeo = new THREE.BoxGeometry(0.07, 0.09, 0.34);
  const receiver = new THREE.Mesh(receiverGeo, gunMetalMat);
  receiver.position.set(0, 0, 0);
  group.add(receiver);

  const barrelGeo = new THREE.CylinderGeometry(0.016, 0.016, 0.48, 16);
  barrelGeo.rotateX(Math.PI / 2);

  const leftBarrel = new THREE.Mesh(barrelGeo, steelMat);
  leftBarrel.position.set(-0.018, 0.022, -0.36);
  group.add(leftBarrel);

  const rightBarrel = new THREE.Mesh(barrelGeo, steelMat);
  rightBarrel.position.set(0.018, 0.022, -0.36);
  group.add(rightBarrel);

  const pumpGeo = new THREE.CylinderGeometry(0.026, 0.026, 0.22, 12);
  pumpGeo.rotateX(Math.PI / 2);
  const pump = new THREE.Mesh(pumpGeo, darkWoodMat);
  pump.position.set(0, -0.012, -0.26);
  group.add(pump);

  const gripGeo = new THREE.BoxGeometry(0.055, 0.12, 0.12);
  gripGeo.rotateX(-0.4);
  const grip = new THREE.Mesh(gripGeo, darkWoodMat);
  grip.position.set(0, -0.07, 0.16);
  group.add(grip);

  const beadGeo = new THREE.SphereGeometry(0.006, 8, 8);
  const beadMat = new THREE.MeshBasicMaterial({ color: 0xffcc00 });
  const bead = new THREE.Mesh(beadGeo, beadMat);
  bead.position.set(0, 0.042, -0.58);
  group.add(bead);

  const flashGeo = new THREE.PlaneGeometry(0.24, 0.24);
  const flashMat = new THREE.MeshBasicMaterial({
    color: 0xffaa22,
    transparent: true,
    opacity: 0.9,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
  const flashMesh = new THREE.Mesh(flashGeo, flashMat);
  flashMesh.position.set(0, 0.022, -0.62);
  flashMesh.visible = false;
  group.add(flashMesh);

  const flashLight = new THREE.PointLight(0xff7711, 0, 10);
  flashLight.position.set(0, 0.022, -0.64);
  group.add(flashLight);

  return { group, flashMesh, flashLight };
}

// -----------------------------------------------------------------------------
// Particle Burst Pool
// -----------------------------------------------------------------------------
interface Particle {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
  color: THREE.Color;
  size: number;
}

class ParticleSystem {
  private particles: Particle[] = [];
  private geom: THREE.BufferGeometry;
  private pPos: Float32Array;
  private pCol: Float32Array;
  private mesh: THREE.Points;
  private maxCount = 200;

  constructor(scene: THREE.Scene) {
    this.geom = new THREE.BufferGeometry();
    this.pPos = new Float32Array(this.maxCount * 3);
    this.pCol = new Float32Array(this.maxCount * 3);
    this.geom.setAttribute('position', new THREE.BufferAttribute(this.pPos, 3));
    this.geom.setAttribute('color', new THREE.BufferAttribute(this.pCol, 3));

    const mat = new THREE.PointsMaterial({
      size: 0.12,
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.mesh = new THREE.Points(this.geom, mat);
    scene.add(this.mesh);
  }

  burst(origin: THREE.Vector3, count: number, colorHex: number, speed: number): void {
    const col = new THREE.Color(colorHex);
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxCount) this.particles.shift();
      const dir = new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        Math.random() * 1.5 + 0.2,
        (Math.random() - 0.5) * 2
      ).normalize();

      this.particles.push({
        pos: origin.clone(),
        vel: dir.multiplyScalar(speed * (0.5 + Math.random() * 0.8)),
        life: 0,
        maxLife: 0.35 + Math.random() * 0.45,
        color: col.clone(),
        size: 0.12,
      });
    }
  }

  update(dt: number): void {
    let active = 0;
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]!;
      p.life += dt;
      if (p.life >= p.maxLife) {
        this.particles.splice(i, 1);
        continue;
      }
      p.vel.y -= 9.8 * dt;
      p.pos.addScaledVector(p.vel, dt);

      const alpha = 1 - p.life / p.maxLife;
      this.pPos[active * 3] = p.pos.x;
      this.pPos[active * 3 + 1] = p.pos.y;
      this.pPos[active * 3 + 2] = p.pos.z;

      this.pCol[active * 3] = p.color.r * alpha;
      this.pCol[active * 3 + 1] = p.color.g * alpha;
      this.pCol[active * 3 + 2] = p.color.b * alpha;
      active++;
    }

    for (let i = active; i < this.maxCount; i++) {
      this.pPos[i * 3] = 0;
      this.pPos[i * 3 + 1] = -9999;
      this.pPos[i * 3 + 2] = 0;
    }

    this.geom.attributes.position!.needsUpdate = true;
    this.geom.attributes.color!.needsUpdate = true;
  }

  dispose(scene: THREE.Scene): void {
    scene.remove(this.mesh);
    this.geom.dispose();
  }
}

/** The default gun: the sidearm's shotgun (the stock weapon, before any part is swapped). */
const DEFAULT_WEAPON_STATS: WeaponStats = {
  mode: 'semi',
  burst: 1,
  burstGap: 0,
  cooldown: 0.52,
  pellets: 7,
  damage: [20, 29],
  spread: 0.0275,
  range: 60,
  zoom: 1,
  magazine: 8,
};

/** A uniform number in [0, 1) from an integer seed (deterministic: the same shot is the same pellets). */
const unit = (seed: number): number => hash32(seed) / 4294967296;

const colourOf = { melee: 0xff3d8a, ranged: 0xffc13d } as const;

export function createMonsters(options: {
  readonly planetScene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly groundHeightAt: (x: number, z: number) => number;
  readonly initialStage?: number;
  readonly seed?: number;
  readonly events?: MonsterEvents;
}): MonstersSystem {
  const { planetScene, camera, groundHeightAt } = options;
  let handlers: MonsterEvents = options.events ?? {};
  const audio = new CombatAudio();
  const particles = new ParticleSystem(planetScene);

  const { group: viewmodelGroup, flashMesh, flashLight } = createShotgunViewmodel();
  camera.add(viewmodelGroup);
  viewmodelGroup.visible = false;
  let flashTimer = 0;

  let stage = Math.max(0, Math.min(6, Math.floor(options.initialStage ?? 1)));
  let setting: MonstersSetting = DEFAULT_MONSTERS;
  let unlocked = false;
  let dormantActive = false;
  let seed = options.seed ?? 1337;
  let gate: Point = { x: 0, z: 0 };
  let sites: LeakSite[] = leakSites(seed, gate);
  let cap = monsterCap('low');
  let safe: SafeZone[] = [];
  let machines: { id: number; x: number; z: number; hu: number }[] = [];
  let solids: readonly Solid[] = [];
  let sealingLeak: number | null = null;
  let world: World = createWorld(seed);
  const siteLeak = new Map<number, number>();
  const sealedSet = new Set<number>();
  const proxCooldown = new Map<number, number>();
  let proxSeq = 1;

  const markSealed = (leakId: number): void => {
    world = { ...world, leaks: world.leaks.map((l) => (l.id === leakId ? { ...l, sealed: true, seal: 1, kinds: [] } : l)) };
  };
  const leakEra = new Map<number, Era>();
  const leakSite = new Map<number, LeakSite>();
  const latchedUntil = new Map<number, number>();
  let firstSightingDone = false;
  let stats = { mobsSpawned: 0, mobsDefeated: 0, damageDealt: 0, shotsFired: 0, pelletsHit: 0, leaksSealed: 0, telegraphs: 0, hitsOnPlayer: 0 };

  const renderer: MonsterRenderer = createMonsterRenderer(planetScene, { budget: { animated: 24, perSkin: 24 } });
  renderer.setStage(stage);
  const domeMat = new THREE.MeshBasicMaterial({ color: 0xffc13d, transparent: true, opacity: 0.14, depthWrite: false, side: THREE.DoubleSide });
  const dome = new THREE.Mesh(new THREE.RingGeometry(GATE_DOME_RADIUS - 0.6, GATE_DOME_RADIUS, 160), domeMat);
  dome.rotation.x = -Math.PI / 2;
  dome.visible = false;
  planetScene.add(dome);
  const visuals: LeakVisuals = createLeakVisuals(planetScene, groundHeightAt);
  const rings = new Map<number, { readonly mesh: THREE.Mesh; readonly mob: number; readonly ranged: boolean; t: number }>();

  let equipped = false;
  let weapon: WeaponStats | null = DEFAULT_WEAPON_STATS;
  let ammo = DEFAULT_WEAPON_STATS.magazine;
  let cooldownLeft = 0;
  let shotSeq = 0;
  let burstLeft = 0;
  let burstTimer = 0;
  let burstFrom: Point = { x: 0, z: 0 };
  let burstDir: Point = { x: 0, z: 1 };

  const mobRef = (id: number): Mob | undefined => world.mobs.find((m) => m.id === id);
  const statusOf = (m: Mob): MonsterMobStatus => ({
    id: m.id,
    kind: m.kind,
    era: leakEra.get(m.leak) ?? eraForStage(stage),
    hp: m.hp,
    phase: m.phase,
    pos: { x: m.x, y: groundHeightAt(m.x, m.z), z: m.z },
  });

  const markerOf = (leakId: number): MonsterMarker | null => {
    const lk = world.leaks.find((l) => l.id === leakId);
    const site = leakSite.get(leakId);
    if (!lk || !site) return null;
    const inSeconds = lk.sealed || lk.kinds.length === 0 ? null : lk.nextWave - world.t;
    const warned = !lk.sealed && lk.kinds.length > 0 && unlocked && setting !== 'off' && inSeconds !== null && inSeconds <= 20;
    const state: MonsterMarker['state'] = lk.sealed ? 'sealed' : site.dormant || lk.kinds.length === 0 ? 'dormant' : warned ? 'warned' : 'open';
    return {
      id: lk.id,
      site: site.index,
      x: lk.x,
      z: lk.z,
      dormant: site.dormant,
      state,
      inSeconds: warned ? inSeconds : null,
      junk: site.junk,
      seal: lk.seal,
      era: leakEra.get(lk.id) ?? null,
    };
  };

  /** The leaks the sites call for now: the dormant anomaly from its beat on, each live site from its stage on. */
  const ensureLeaks = (): void => {
    for (const site of sites) {
      if (siteLeak.has(site.index)) continue;
      if (site.dormant) {
        if (!dormantActive) continue;
        world = addLeak(world, site, []);
      } else {
        if (stage < site.openStage || !clearOfGate(site, gate)) continue;
        world = addLeak(world, site, kindsForEra(eraForStage(stage)));
      }
      const created = world.leaks[world.leaks.length - 1]!;
      if (sealedSet.has(site.index)) markSealed(created.id);
      siteLeak.set(site.index, created.id);
      leakSite.set(created.id, site);
      leakEra.set(created.id, eraForStage(stage));
    }
  };

  const addRing = (mob: Mob, ranged: boolean): void => {
    const old = rings.get(mob.id);
    if (old) planetScene.remove(old.mesh);
    const geom = new THREE.RingGeometry(0.55, 0.8, 28);
    geom.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({ color: ranged ? colourOf.ranged : colourOf.melee, transparent: true, opacity: 0.85, depthWrite: false });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(mob.x, groundHeightAt(mob.x, mob.z) + 0.05, mob.z);
    planetScene.add(mesh);
    rings.set(mob.id, { mesh, mob: mob.id, ranged, t: 0 });
  };

  const handle = (events: readonly LeakEvent[], player: { readonly x: number; readonly z: number; readonly yaw: number }): void => {
    for (const e of events) {
      switch (e.t) {
        case 'warn': {
          const mk = markerOf(e.leak);
          if (mk) handlers.onWarn?.(mk);
          break;
        }
        case 'spawn': {
          const mob = mobRef(e.mob);
          if (!mob) break;
          if (!clearOfGate(mob, gate)) {
            world = { ...world, mobs: world.mobs.filter((m) => m.id !== mob.id) };
            break;
          }
          stats = { ...stats, mobsSpawned: stats.mobsSpawned + 1 };
          if (!firstSightingDone) {
            firstSightingDone = true;
            handlers.onSeen?.(statusOf(mob));
          }
          break;
        }
        case 'telegraph': {
          const mob = mobRef(e.mob);
          if (!mob) break;
          const ranged = ARCHETYPES[mob.kind].ranged;
          addRing(mob, ranged);
          stats = { ...stats, telegraphs: stats.telegraphs + 1 };
          audio.playTelegraph();
          handlers.onTelegraph?.(statusOf(mob));
          break;
        }
        case 'hitPlayer': {
          const mob = mobRef(e.mob);
          const status = mob ? statusOf(mob) : null;
          const bearing = mob ? hitBearing({ x: player.x, z: player.z, yaw: player.yaw }, mob) : 0;
          stats = { ...stats, hitsOnPlayer: stats.hitsOnPlayer + 1 };
          handlers.onHitPlayer?.(e.damage, bearing, status);
          break;
        }
        case 'drain': {
          latchedUntil.set(e.machine, world.t + 0.6);
          handlers.onDrain?.(e.machine, e.amount);
          break;
        }
        case 'sealed': {
          const mk = markerOf(e.leak);
          if (!mk) break;
          stats = { ...stats, leaksSealed: stats.leaksSealed + 1 };
          sealedSet.add(mk.site);
          const reward = mk.dormant ? DORMANT_REWARD : SEAL_REWARD;
          handlers.onSealed?.(mk, reward);
          break;
        }
        case 'death':
          break;
      }
    }
  };

  /** One hit on a monster: the damage, the death and its drop. Returns the kill (or null when the monster is gone). */
  const hitMob = (id: number, dmg: number): { readonly killed: number } | null => {
    const target = mobRef(id);
    if (!target) return null;
    const before = statusOf(target);
    const res = leakHurt(world, id, dmg);
    world = res.world;
    let killed = 0;
    for (const e of res.events) {
      if (e.t !== 'death') continue;
      killed += 1;
      stats = { ...stats, mobsDefeated: stats.mobsDefeated + 1 };
      particles.burst(new THREE.Vector3(before.pos.x, before.pos.y + 0.8, before.pos.z), 14, before.era === 'sprite' ? 0xe8e8e8 : 0x7dd3fc, 3.2);
      handlers.onDeath?.({ ...before, phase: 'dead', hp: 0 }, dropStack(e.drop));
    }
    return { killed };
  };

  /** The ring under each monster that is winding up: it grows and fades while the wind-up runs, then goes. */
  const updateRings = (dt: number): void => {
    for (const [id, r] of rings) {
      const mob = mobRef(id);
      if (!mob || mob.phase !== 'windup') {
        planetScene.remove(r.mesh);
        r.mesh.geometry.dispose();
        (r.mesh.material as THREE.Material).dispose();
        rings.delete(id);
        continue;
      }
      r.t += dt;
      const pulse = 1 + 0.5 * ((r.t * 4) % 1);
      r.mesh.position.set(mob.x, groundHeightAt(mob.x, mob.z) + 0.05, mob.z);
      r.mesh.scale.setScalar(pulse);
      (r.mesh.material as THREE.MeshBasicMaterial).opacity = 0.35 + 0.5 * ((r.t * 4) % 1);
    }
  };

  /** One shot: the pellets raycast through leaksim, each hit through the one hit path (drops and kills included). */
  const shoot = (origin: Point, dir: Point): FireResult => {
    const w = weapon!;
    ammo -= 1;
    shotSeq += 1;
    stats = { ...stats, shotsFired: stats.shotsFired + 1 };
    audio.playShotgunBlast();
    flashMesh.visible = true;
    flashLight.intensity = 3;
    flashTimer = 0.05;
    const len = Math.hypot(dir.x, dir.z) || 1;
    const ux = dir.x / len, uz = dir.z / len;
    let hits = 0, damage = 0, killed = 0;
    for (let p = 0; p < w.pellets; p++) {
      const a = (unit(shotSeq * 131 + p * 17) * 2 - 1) * w.spread;
      const dx = ux * Math.cos(a) - uz * Math.sin(a);
      const dz = ux * Math.sin(a) + uz * Math.cos(a);
      const id = raycast(world, origin, { x: dx, z: dz }, w.range);
      if (id === null) continue;
      const dmg = Math.round(w.damage[0] + (w.damage[1] - w.damage[0]) * unit(shotSeq * 911 + p * 29 + 7));
      const r = hitMob(id, dmg);
      if (!r) continue;
      hits += 1;
      damage += dmg;
      killed += r.killed;
    }
    stats = { ...stats, pelletsHit: stats.pelletsHit + hits, damageDealt: stats.damageDealt + damage };
    return { fired: true, hits, damage, killed };
  };

  /** Proximity spawn step (TICKET-07 Item B): spawns defenders around open leaks within 40 m of the player. */
  const stepProximitySpawns = (dt: number, player: { readonly x: number; readonly z: number }): void => {
    if (!unlocked || setting === 'off') return;
    let totalLive = world.mobs.filter((m) => m.phase !== 'dead').length;
    if (totalLive >= cap) return;

    for (const lk of world.leaks) {
      const cd = (proxCooldown.get(lk.id) ?? 0) - dt;
      if (cd > 0) {
        proxCooldown.set(lk.id, cd);
        continue;
      }
      const site = leakSite.get(lk.id);
      const activeForLeak = world.mobs.filter((m) => m.leak === lk.id && m.phase !== 'dead').length;
      const playerDist = Math.hypot(player.x - lk.x, player.z - lk.z);
      const toSpawn = spawnPolicy(
        { sealed: lk.sealed, dormant: site?.dormant, kinds: lk.kinds },
        playerDist,
        stage,
        activeForLeak
      );
      if (toSpawn <= 0) continue;

      const kinds = lk.kinds.length > 0 ? lk.kinds : kindsForEra(eraForStage(stage));
      let spawnedAny = false;
      for (let i = 0; i < toSpawn && totalLive < cap; i++) {
        const kind = kinds[(proxSeq + i) % kinds.length] ?? 'charger';
        const angle = unit(seed + proxSeq * 73 + i * 19) * Math.PI * 2;
        const rad = 3.6 + unit(seed + proxSeq * 31 + i * 11) * 2.0;
        const sx = lk.x + Math.cos(angle) * rad;
        const sz = lk.z + Math.sin(angle) * rad;
        proxSeq++;

        if (!clearOfGate({ x: sx, z: sz }, gate)) continue;
        if (safe.some((s) => Math.hypot(sx - s.x, sz - s.z) < s.r)) continue;

        const id = world.nextId;
        const spec = ARCHETYPES[kind];
        const mob: Mob = {
          id,
          kind,
          leak: lk.id,
          hp: spec.hp,
          phase: 'roam',
          phaseT: 0,
          provoked: false,
          x: sx,
          z: sz,
        };
        world = { ...world, nextId: id + 1, mobs: [...world.mobs, mob] };
        totalLive++;
        spawnedAny = true;
        stats = { ...stats, mobsSpawned: stats.mobsSpawned + 1 };
        // no first-sighting signal here: the campaign's first sighting (M-01, the chain's monsterSeen) is the scripted wave's, so a
        // defender that spawns on the way in does not use it up (the F-03 beat, campaign check 28)
      }

      if (spawnedAny) {
        proxCooldown.set(lk.id, PROXIMITY_SPAWN_INTERVAL);
      }
    }
  };

  const system: MonstersSystem = {
    isEquipped: () => equipped,
    equip(on) {
      if (on && !equipped) audio.playEquip();
      equipped = on;
      viewmodelGroup.visible = on;
    },
    setWeaponStats(s) {
      weapon = s;
      if (s) ammo = Math.min(ammo, s.magazine);
    },
    getWeaponStats: () => weapon,
    setTrigger(_held) { /* the shot is fire(); the screen keeps its own button state */ },
    fire(origin, dir) {
      if (!equipped) return { fired: false, hits: 0, damage: 0, killed: 0, reason: 'not equipped' };
      if (!weapon) return { fired: false, hits: 0, damage: 0, killed: 0, reason: 'no weapon' };
      if (cooldownLeft > 0) return { fired: false, hits: 0, damage: 0, killed: 0, reason: 'cooling' };
      if (ammo <= 0) return { fired: false, hits: 0, damage: 0, killed: 0, reason: 'empty' };
      cooldownLeft = weapon.cooldown;
      burstLeft = Math.max(0, weapon.burst - 1);
      burstTimer = weapon.burstGap;
      burstFrom = { x: origin.x, z: origin.z };
      burstDir = { x: dir.x, z: dir.z };
      return shoot(origin, dir);
    },
    beamHit(origin, dir, range, dmg) {
      if (!(dmg > 0) || !(range > 0)) {
        return { hit: null, damage: 0, killed: false };
      }
      const id = raycast(world, origin, dir, range);
      if (id === null) {
        return { hit: null, damage: 0, killed: false };
      }
      const r = hitMob(id, dmg);
      if (!r) {
        return { hit: null, damage: 0, killed: false };
      }
      stats = { ...stats, damageDealt: stats.damageDealt + dmg };
      return { hit: id, damage: dmg, killed: r.killed > 0 };
    },
    getAmmo: () => ({ current: ammo, max: weapon?.magazine ?? 0 }),
    reload() { ammo = weapon?.magazine ?? 0; },
    setFidelityStage(s) {
      stage = Math.max(0, Math.min(6, Math.floor(s)));
      renderer.setStage(stage);
    },
    setSetting(s) { setting = s; },
    getSetting: () => setting,
    setUnlocked(on) { unlocked = on; },
    setDormantActive(on) { dormantActive = on; },
    setSealedSites(sites) {
      sealedSet.clear();
      for (const i of sites) sealedSet.add(i);
      for (const [site, leakId] of siteLeak) if (sealedSet.has(site)) markSealed(leakId);
    },
    sealedSites: () => [...sealedSet].sort((a, b) => a - b),
    setPlot(newSeed, newGate) {
      if (newSeed !== seed) {
        seed = newSeed;
        world = createWorld(seed);
        siteLeak.clear();
        leakEra.clear();
        leakSite.clear();
        latchedUntil.clear();
        proxCooldown.clear();
        firstSightingDone = false;
        for (const id of [...rings.keys()]) {
          const r = rings.get(id)!;
          planetScene.remove(r.mesh);
          r.mesh.geometry.dispose();
          (r.mesh.material as THREE.Material).dispose();
          rings.delete(id);
        }
      }
      gate = { x: newGate.x, z: newGate.z };
      sites = leakSites(seed, gate);
      dome.position.set(gate.x, groundHeightAt(gate.x, gate.z) + 0.06, gate.z);
      dome.visible = true;
    },
    setEvents(e) { handlers = e; },
    setSafeZones(zones) { safe = zones.map((z) => ({ x: z.x, z: z.z, r: z.r })); },
    setMachines(list) { machines = list.map((m) => ({ id: m.id, x: m.x, z: m.z, hu: m.hu ?? 0 })); },
    setSolids(list) { solids = list; },
    setQuality(q) { cap = monsterCap(q); },
    setSealing(leak) { sealingLeak = leak; },
    leakUnder(origin, dir, range) {
      const len = Math.hypot(dir.x, dir.z) || 1;
      const ux = dir.x / len, uz = dir.z / len;
      let best: { readonly id: number; readonly t: number } | null = null;
      for (const lk of world.leaks) {
        if (lk.sealed) continue;
        const vx = lk.x - origin.x, vz = lk.z - origin.z;
        const t = vx * ux + vz * uz;
        if (t < 0 || t > range) continue;
        const perp = Math.abs(vx * uz - vz * ux);
        if (perp > 2.5) continue;
        if (!best || t < best.t) best = { id: lk.id, t };
      }
      return best ? best.id : null;
    },
    isLatched: (machineId) => (latchedUntil.get(machineId) ?? -1) > world.t,
    update(dt, player, cam) {
      const h = Math.max(0, Math.min(0.1, dt));
      cooldownLeft = Math.max(0, cooldownLeft - h);
      ensureLeaks();
      stepProximitySpawns(h, player);
      const input: LeakInput = {
        dt: h,
        stage,
        aggression: unlocked ? setting : 'off',
        player: { x: player.x, z: player.z, alive: player.alive },
        machines: machines.map((m) => ({ id: m.id, x: m.x, z: m.z, hu: m.hu })),
        safe,
        solids,
        sealing: sealingLeak,
        cap,
      };
      const res = leakStep(world, input);
      world = res.world;
      handle(res.events, player);
      gameAudio.setMobsEngaged(world.mobs.some((m) => m.phase === 'chase' || m.phase === 'windup' || m.phase === 'attack'));
      const mobs: MonsterMob[] = world.mobs.map((m) => ({ id: m.id, kind: m.kind, x: m.x, z: m.z, y: groundHeightAt(m.x, m.z), phase: m.phase, phaseT: m.phaseT }));
      renderer.sync(mobs, (m) => skinFor(m.kind, leakEra.get(mobRef(m.id)?.leak ?? -1) ?? eraForStage(stage), m.id));
      renderer.update(h, cam);
      const marks = [...siteLeak.values()].map((id) => markerOf(id)).filter((m): m is MonsterMarker => m !== null);
      visuals.update({ dt: h, markers: marks, sealing: sealingLeak, camera: cam, stage });
      if (burstLeft > 0 && weapon) {
        burstTimer -= h;
        while (burstLeft > 0 && burstTimer <= 0 && ammo > 0) {
          burstLeft -= 1;
          burstTimer += weapon.burstGap;
          shoot(burstFrom, burstDir);
        }
        if (ammo <= 0) burstLeft = 0;
      }
      const pressed = world.mobs.some((m) => m.phase !== 'dead' && Math.abs(Math.hypot(m.x - gate.x, m.z - gate.z) - GATE_DOME_RADIUS) < 2.5);
      domeMat.opacity = pressed ? 0.4 + 0.3 * Math.abs(Math.sin(performance.now() / 150)) : 0.14;
      updateRings(h);
      particles.update(h);
      if (flashTimer > 0) {
        flashTimer -= h;
        if (flashTimer <= 0) { flashMesh.visible = false; flashLight.intensity = 0; }
      }
    },
    markers() {
      return [...siteLeak.values()].map((id) => markerOf(id)).filter((m): m is MonsterMarker => m !== null);
    },
    getMobList() {
      return world.mobs.filter((m) => m.phase !== 'dead').map(statusOf);
    },
    hurtMob(id, damage) {
      const r = hitMob(id, damage);
      return r ? { killed: r.killed > 0 } : null;
    },
    placeMob(kind, x, z) {
      world = placeMob(world, kind, { x, z });
      return world.nextId - 1;
    },
    knockbackSwarmers(origin, radiusM = TURBO_BASS_RADIUS_M, pushM = TURBO_BASS_KNOCKBACK_M, downbeatPulse0to1 = 1.0) {
      gameAudio.playTurboBassPulse(downbeatPulse0to1);
      const swarmerInputs = world.mobs
        .filter((m) => m.phase !== 'dead' && m.kind === 'swarmer')
        .map((m) => ({ id: m.id, x: m.x, z: m.z }));
      if (swarmerInputs.length === 0) return 0;
      const results = applyTurboBassSwarmerKnockback(
        origin.x,
        origin.z,
        downbeatPulse0to1,
        swarmerInputs,
        radiusM,
        pushM,
      );
      const byId = new Map(results.filter((r) => r.wasKnockedBack).map((r) => [r.id, r]));
      if (byId.size === 0) return 0;
      world = {
        ...world,
        mobs: world.mobs.map((m) => {
          const hit = byId.get(m.id);
          return hit ? { ...m, x: hit.newX, z: hit.newZ } : m;
        }),
      };
      return byId.size;
    },
    getStats: () => stats,
    world: () => world,
    clearMobs() {
      world = { ...world, mobs: [], bolts: [] };
      renderer.sync([], () => '');
    },
    dispose() {
      renderer.dispose();
      visuals.dispose();
      particles.dispose(planetScene);
      for (const r of rings.values()) {
        planetScene.remove(r.mesh);
        r.mesh.geometry.dispose();
        (r.mesh.material as THREE.Material).dispose();
      }
      rings.clear();
      planetScene.remove(dome);
      dome.geometry.dispose();
      domeMat.dispose();
      camera.remove(viewmodelGroup);
    },
  };
  return system;
}
