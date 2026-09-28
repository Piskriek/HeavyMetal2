/**
 * M01 · T5 — effect specs and the fixed billboard pool (render side, still pure).
 *
 * One spec per kind says which painted sheet plays, how big it is in world units, how long it lives
 * and how many copies it spawns. The pool is a fixed array of slots: spawning writes into a free
 * slot, updating advances its frame and fades it, and a full pool *drops* the effect and counts it
 * rather than growing. No allocation happens after construction — that is what keeps a pile-up from
 * producing garbage-collection stutter at 120 Hz.
 *
 * Pure module: no DOM, no canvas, no three.js. `renderer-fx.ts` turns these slots into meshes.
 */
import type { EffectKind } from './events';

/* -----------------------------------------------------------------------------
   1. SPECS
   -------------------------------------------------------------------------- */

export interface EffectSpec {
  /** Which painted sheet plays, or `points` for the spark particles. */
  readonly sheet:
    | 'anim-43' | 'anim-44' | 'anim-45' | 'anim-49'
    | 'anim-54' | 'anim-55' | 'anim-56' | 'anim-57' | 'anim-58' | 'anim-59' | 'anim-60'
    | 'points';
  /** Frames in the sheet (2x2 for every painted effect). */
  readonly frames: number;
  /** Frames per second. */
  readonly fps: number;
  /** Billboard width at scale 1, world units. */
  readonly size: number;
  /** Seconds. */
  readonly life: number;
  /** Billboards spawned per event. */
  readonly count: number;
  /** World units/s the billboard drifts along the frame up. */
  readonly rise: number;
  /** How much a billboard grows over its life (1 = constant). */
  readonly growth: number;
  /** Particle count for `points` specs. */
  readonly particles: number;
  /** Tint for `points` specs, 0xRRGGBB. */
  readonly tint: number;
  /** Opacity at spawn (smoke starts softer than a flash). */
  readonly opacity: number;
}

/** The published specs. Sizes are world units at scale 1; `scale` multiplies them per event. */
export const EFFECT_SPECS: Readonly<Record<EffectKind, EffectSpec>> = Object.freeze({
  explosion: Object.freeze({
    sheet: 'anim-43' as const, frames: 4, fps: 16, size: 480, life: 0.25, count: 1, rise: 0, growth: 1.25,
    particles: 0, tint: 0xffb25e, opacity: 1,
  }),
  impact: Object.freeze({
    sheet: 'anim-44' as const, frames: 4, fps: 14, size: 220, life: 0.29, count: 1, rise: 0, growth: 1.15,
    particles: 0, tint: 0xffe0a0, opacity: 1,
  }),
  dust: Object.freeze({
    sheet: 'anim-49' as const, frames: 4, fps: 10, size: 180, life: 0.6, count: 3, rise: 26, growth: 1.6,
    particles: 0, tint: 0xb8a77b, opacity: 0.8,
  }),
  smoke: Object.freeze({
    sheet: 'anim-45' as const, frames: 4, fps: 10, size: 260, life: 1.1, count: 2, rise: 40, growth: 1.9,
    particles: 0, tint: 0x333333, opacity: 0.75,
  }),
  sparks: Object.freeze({
    sheet: 'points' as const, frames: 1, fps: 0, size: 26, life: 0.45, count: 0, rise: 0, growth: 1,
    particles: 160, tint: 0xffd070, opacity: 1,
  }),
  // A nitro burst out of the back of the ball.
  boost: Object.freeze({
    sheet: 'anim-54' as const, frames: 4, fps: 14, size: 300, life: 0.42, count: 1, rise: 0, growth: 1.3,
    particles: 0, tint: 0xffa04a, opacity: 1,
  }),
  // The pad itself lighting up under the ball.
  'boost-pad': Object.freeze({
    sheet: 'anim-55' as const, frames: 4, fps: 14, size: 420, life: 0.36, count: 1, rise: 0, growth: 1.2,
    particles: 0, tint: 0xffc06a, opacity: 0.95,
  }),
  // A supply taken: tinted by the supply's own colour (the event carries the tint).
  pickup: Object.freeze({
    sheet: 'anim-56' as const, frames: 4, fps: 14, size: 280, life: 0.38, count: 1, rise: 30, growth: 1.35,
    particles: 0, tint: 0xffffff, opacity: 1,
  }),
  // A shield eating a shove and going.
  'shield-break': Object.freeze({
    sheet: 'anim-57' as const, frames: 4, fps: 14, size: 340, life: 0.4, count: 1, rise: 0, growth: 1.3,
    particles: 0, tint: 0x8cceff, opacity: 1,
  }),
  // A spring throwing the ball into the air.
  spring: Object.freeze({
    sheet: 'anim-58' as const, frames: 4, fps: 12, size: 260, life: 0.45, count: 1, rise: 48, growth: 1.4,
    particles: 0, tint: 0xa7e2ba, opacity: 0.95,
  }),
  // A hard landing: a ring of shock across the road.
  landing: Object.freeze({
    sheet: 'anim-59' as const, frames: 4, fps: 14, size: 380, life: 0.34, count: 1, rise: 0, growth: 1.6,
    particles: 0, tint: 0xd8c79a, opacity: 0.9,
  }),
  // Knocked into the tree line.
  'tree-smash': Object.freeze({
    sheet: 'anim-60' as const, frames: 4, fps: 14, size: 320, life: 0.44, count: 1, rise: 12, growth: 1.25,
    particles: 0, tint: 0x9bb26a, opacity: 1,
  }),
});

/** World units: nothing beyond this from the camera is worth drawing. */
export const EFFECT_CULL_DISTANCE = 6000;
/** Slots in the pool. Above this, effects are dropped and counted. */
export const BILLBOARD_POOL = 64;
/** Particle ceiling for the sparks `Points` object. */
export const SPARK_PARTICLES = 160;

/* -----------------------------------------------------------------------------
   2. THE POOL
   -------------------------------------------------------------------------- */

export interface BillboardSlot {
  active: boolean;
  kind: EffectKind;
  sheet: string;
  frames: number;
  fps: number;
  /** Seconds. */
  bornAt: number;
  life: number;
  /** World space. */
  x: number; y: number; z: number;
  /** Unit up at spawn, so the rise follows the road, not the world axis. */
  upX: number; upY: number; upZ: number;
  rise: number;
  size: number;
  growth: number;
  opacity: number;
  baseOpacity: number;
  /** 0xRRGGBB the billboard is multiplied by (the spec's own colour unless the event tinted it). */
  colour: number;
  /** 0..1 through its life, written by `update`. */
  age: number;
  frame: number;
}

/** A tiny deterministic generator: sparks must look scattered but replay identically. */
function makeRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Fixed pool of billboards. `spawn` writes a slot (or all the slots a spec's `count` needs) and
 * returns false when the pool is full, having incremented `dropped`.
 */
export class BillboardPool {
  private readonly slots: BillboardSlot[];
  private readonly random: () => number;
  private drops = 0;

  constructor(size: number = BILLBOARD_POOL, seed = 0x5eed1) {
    const capacity = Math.max(1, Math.floor(size));
    this.slots = new Array<BillboardSlot>(capacity);
    for (let i = 0; i < capacity; i++) {
      this.slots[i] = {
        active: false, kind: 'dust', sheet: 'anim-49', frames: 4, fps: 10, bornAt: 0, life: 1,
        x: 0, y: 0, z: 0, upX: 0, upY: 1, upZ: 0, rise: 0, size: 100, growth: 1, opacity: 1, baseOpacity: 1,
        colour: 0xffffff, age: 0, frame: 0,
      };
    }
    this.random = makeRandom(seed);
  }

  get capacity(): number { return this.slots.length; }
  get live(): number {
    let live = 0;
    for (const slot of this.slots) if (slot.active) live += 1;
    return live;
  }
  /** Effects refused for want of a free slot. */
  get dropped(): number { return this.drops; }
  /** Read-only view of every slot, for the renderer. */
  get all(): readonly BillboardSlot[] { return this.slots; }

  /**
   * Spawns one event's billboards.
   *
   * @param up unit up at the impact point (the road's own up), so dust rises with the slope.
   * @returns how many billboards were actually spawned (0 when the pool is full).
   */
  spawn(
    kind: EffectKind, spec: EffectSpec, t: number,
    x: number, y: number, z: number, scale = 1,
    up: { x: number; y: number; z: number } = { x: 0, y: 1, z: 0 },
    tint: number | null = null,
  ): number {
    if (spec.count <= 0) return 0;
    let spawned = 0;
    let refused = false;
    for (let copy = 0; copy < spec.count; copy++) {
      const slot = this.slots.find((candidate) => !candidate.active);
      if (!slot) { refused = true; break; }
      const spread = spec.count > 1 ? (this.random() - 0.5) * spec.size * 0.35 * scale : 0;
      slot.active = true;
      slot.kind = kind;
      slot.sheet = spec.sheet;
      slot.frames = spec.frames;
      slot.fps = spec.fps;
      slot.bornAt = t - copy * (spec.life / (spec.count * 2));
      slot.life = spec.life;
      slot.x = x + spread;
      slot.y = y + (spec.count > 1 ? (this.random() - 0.5) * spec.size * 0.2 * scale : 0);
      slot.z = z + (spec.count > 1 ? (this.random() - 0.5) * spec.size * 0.35 * scale : 0);
      slot.upX = up.x; slot.upY = up.y; slot.upZ = up.z;
      slot.rise = spec.rise * scale;
      slot.size = spec.size * scale;
      slot.growth = spec.growth;
      slot.opacity = spec.opacity;
      slot.baseOpacity = spec.opacity;
      // A painted sheet keeps its own colours unless the event asked for a tint (a supply burst).
      slot.colour = tint ?? (spec.sheet === 'points' ? spec.tint : 0xffffff);
      slot.age = 0;
      slot.frame = 0;
      spawned += 1;
    }
    // One refused spawn is one lost effect, however many of its copies could not be placed.
    if (refused) this.drops += 1;
    return spawned;
  }

  /**
   * Advances every live slot. A slot deactivates at exactly `bornAt + life`.
   * Under reduced motion the sheet holds frame 0 at half opacity and dust/smoke do not grow.
   */
  update(t: number, reducedMotion = false): void {
    for (const slot of this.slots) {
      if (!slot.active) continue;
      // Elapsed seconds, kept whole: recomputing `age * life` would drift a frame boundary by one ulp.
      const elapsed = t - slot.bornAt;
      if (!(elapsed < slot.life)) { slot.active = false; slot.age = 0; continue; }
      slot.age = elapsed / slot.life;
      if (reducedMotion) {
        slot.frame = 0;
        slot.opacity = slot.kind === 'smoke' || slot.kind === 'dust' ? 0.3 : 0.5;
      } else {
        slot.frame = slot.fps > 0 ? Math.floor(elapsed * slot.fps) % Math.max(1, slot.frames) : 0;
        // Fade smoothly over the last third so nothing pops out of existence.
        const fade = slot.age > 0.66 ? Math.max(0, 1 - (slot.age - 0.66) / 0.34) : 1;
        slot.opacity = slot.baseOpacity * fade;
      }
    }
  }

  /** Billboard width right now: linear growth from 1x to `growth`x across the life. */
  sizeOf(slot: BillboardSlot, reducedMotion = false): number {
    const growth = reducedMotion && (slot.kind === 'dust' || slot.kind === 'smoke') ? 1 : slot.growth;
    return slot.size * (1 + (growth - 1) * slot.age);
  }

  /** Where the billboard has drifted to: spawn point plus `rise · age · life` along its up. */
  positionOf(slot: BillboardSlot): { x: number; y: number; z: number } {
    const travelled = slot.rise * slot.age * slot.life;
    return { x: slot.x + slot.upX * travelled, y: slot.y + slot.upY * travelled, z: slot.z + slot.upZ * travelled };
  }

  clear(): void {
    for (const slot of this.slots) slot.active = false;
    this.drops = 0;
  }
}

/* -----------------------------------------------------------------------------
   3. SPARKS
   -------------------------------------------------------------------------- */

/**
 * The sparks `Points` buffer: a fixed particle array, refilled from a pool of dead particles. The
 * positions/velocities live in plain arrays so the renderer can copy them into its buffer without
 * allocating anything.
 */
export class SparkField {
  readonly capacity: number;
  readonly x: Float32Array;
  readonly y: Float32Array;
  readonly z: Float32Array;
  readonly vx: Float32Array;
  readonly vy: Float32Array;
  readonly vz: Float32Array;
  readonly life: Float32Array;
  private readonly random: () => number;
  private cursor = 0;

  constructor(size: number = SPARK_PARTICLES, seed = 0x5eed2) {
    this.capacity = Math.max(1, Math.floor(size));
    this.x = new Float32Array(this.capacity);
    this.y = new Float32Array(this.capacity);
    this.z = new Float32Array(this.capacity);
    this.vx = new Float32Array(this.capacity);
    this.vy = new Float32Array(this.capacity);
    this.vz = new Float32Array(this.capacity);
    this.life = new Float32Array(this.capacity);
    this.random = makeRandom(seed);
  }

  /** Live particles. */
  get live(): number {
    let live = 0;
    for (let i = 0; i < this.capacity; i++) if (this.life[i] > 0) live += 1;
    return live;
  }

  /** Fires `count` sparks from a world point. Oldest particles are recycled when it wraps. */
  spawn(x: number, y: number, z: number, count: number, speed: number, life: number): void {
    for (let n = 0; n < count; n++) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % this.capacity;
      const theta = this.random() * Math.PI * 2;
      const phi = Math.acos(2 * this.random() - 1);
      const v = speed * (0.45 + this.random() * 0.85);
      this.x[i] = x; this.y[i] = y; this.z[i] = z;
      this.vx[i] = Math.sin(phi) * Math.cos(theta) * v;
      this.vy[i] = Math.abs(Math.cos(phi)) * v * 0.9;
      this.vz[i] = Math.sin(phi) * Math.sin(theta) * v;
      this.life[i] = life * (0.6 + this.random() * 0.7);
    }
  }

  /** Ballistic drift + fade. `gravity` is world units/s² downward. */
  update(dt: number, gravity = 900): void {
    for (let i = 0; i < this.capacity; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      this.vy[i] -= gravity * dt;
      this.x[i] += this.vx[i] * dt;
      this.y[i] += this.vy[i] * dt;
      this.z[i] += this.vz[i] * dt;
    }
  }

  clear(): void {
    this.life.fill(0);
    this.cursor = 0;
  }
}
