/**
 * Deterministic CPU particle system for a cartoon game.
 *
 * Particles live in per-emitter pools; every step the system packs the live
 * ones into a flat Float32Array (`x, y, z, size, r, g, b, a` per particle)
 * that a renderer can upload as-is. All randomness comes from a per-emitter
 * seeded mulberry32, so the same seed and the same steps always produce the
 * same particles. No DOM, no Date, no Math.random.
 */

export type Vec3 = [number, number, number];

export interface EmitterSpec {
  id: string;
  name: string;
  /** Particles per second while running (0: bursts only). */
  rate: number;
  /** Particles emitted at the start. */
  burst: number;
  /** Seconds it emits (0: until stopped; with rate 0 an emitter is done once its burst is out). */
  duration: number;
  /** Life in seconds, min..max. */
  life: [number, number];
  /** Speed in m/s, min..max. */
  speed: [number, number];
  /** Unit direction and cone half-angle in degrees (180: any direction). */
  dir: Vec3;
  spread: number;
  /** m/s^2 added on y (negative falls). */
  gravity: number;
  /** 0..1 velocity removed per second. */
  drag: number;
  /** Metres at birth and at death (linear). */
  size: [number, number];
  /** '#rrggbb' colours spread evenly over the life. */
  colors: string[];
  /** Alpha at birth and at death. */
  alpha: [number, number];
  /** Spawn box half extents around the emitter. */
  area: Vec3;
  /** Glows (fire, sparks) or not (smoke, snow). */
  additive: boolean;
}

/** Seeded PRNG (mulberry32): deterministic sequence of numbers in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
 t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Values per particle in `buffer`: x, y, z, size, r, g, b, a (colours 0..1). */
export const STRIDE = 8;

const TWO_PI = Math.PI * 2;

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex);
  const v = m ? Number.parseInt(m[1]!, 16) : 0xffffff;
  return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
}

interface Particle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  age: number;
  life: number;
}

class Emitter {
  readonly spec: EmitterSpec;
  readonly pos: Vec3;
  readonly parts: Particle[] = [];
  emitting: boolean;
  private readonly rng: () => number;
  private carry = 0;
  private elapsed = 0;
  private readonly stops: number[] = []; // gradient as flat rgb triplets
  private readonly lifeMin: number;
  private readonly lifeSpan: number;
  private readonly speedMin: number;
  private readonly speedSpan: number;
  private readonly cosSpread: number;
  private readonly dirX: number;
  private readonly dirY: number;
  private readonly dirZ: number;
  private readonly t1x: number;
  private readonly t1y: number;
  private readonly t1z: number;
  private readonly t2x: number;
  private readonly t2y: number;
  private readonly t2z: number;

  constructor(spec: EmitterSpec, pos: Vec3, seed: number) {
    this.spec = spec;
    this.pos = [pos[0], pos[1], pos[2]];
    this.rng = mulberry32(seed);
    this.emitting = spec.rate > 0;
    for (const c of spec.colors) {
      const [r, g, b] = hexToRgb(c);
      this.stops.push(r, g, b);
    }
    if (this.stops.length === 0) this.stops.push(1, 1, 1);
    this.lifeMin = Math.max(1e-4, spec.life[0]);
    this.lifeSpan = Math.max(0, spec.life[1] - spec.life[0]);
    this.speedMin = spec.speed[0];
    this.speedSpan = Math.max(0, spec.speed[1] - spec.speed[0]);
    this.cosSpread = Math.cos((clamp01(spec.spread / 180) * 180 * Math.PI) / 180);
    // Unit direction plus an orthonormal basis around it for cone sampling.
    let dx = spec.dir[0];
    let dy = spec.dir[1];
    let dz = spec.dir[2];
    const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (len > 1e-9) {
      dx /= len;
      dy /= len;
      dz /= len;
    } else {
      dx = 0;
      dy = 1;
      dz = 0;
    }
    let ux = 0;
    let uy = 1;
    if (Math.abs(dy) > 0.95) {
      ux = 1;
      uy = 0;
    }
    let ax = uy * dz;
    let ay = -ux * dz;
    let az = ux * dy - uy * dx;
    const al = Math.sqrt(ax * ax + ay * ay + az * az);
    if (al > 1e-9) {
      ax /= al;
      ay /= al;
      az /= al;
    } else {
      ax = 1;
      ay = 0;
      az = 0;
    }
    this.t1x = ax;
    this.t1y = ay;
    this.t1z = az;
    this.t2x = dy * az - dz * ay;
    this.t2y = dz * ax - dx * az;
    this.t2z = dx * ay - dy * ax;
    this.dirX = dx;
    this.dirY = dy;
    this.dirZ = dz;
  }

  stop(): void {
    this.emitting = false;
  }

  moveTo(pos: Vec3): void {
    this.pos[0] = pos[0];
    this.pos[1] = pos[1];
    this.pos[2] = pos[2];
  }

  isDone(): boolean {
    return !this.emitting && this.parts.length === 0;
  }

  emitBurst(capacity: number): void {
    let n = Math.floor(this.spec.burst);
    if (n > capacity) n = capacity;
    if (n < 0) n = 0;
    for (let i = 0; i < n; i++) this.parts.push(this.makeParticle());
  }

  /** Rate emission for one step; fractions carry over between steps. */
  emitStep(dt: number, capacity: number): number {
    let made = 0;
    if (this.emitting && this.spec.rate > 0 && capacity > 0) {
      const dur = this.spec.duration;
      if (dur === 0 || this.elapsed < dur) {
        this.carry += this.spec.rate * dt;
        let n = Math.floor(this.carry + 1e-9);
        this.carry -= n;
        if (n > capacity) n = capacity;
        for (let i = 0; i < n; i++) this.parts.push(this.makeParticle());
        made = n;
      }
    }
    this.elapsed += dt;
    if (this.emitting && this.spec.duration > 0 && this.elapsed >= this.spec.duration) {
      this.emitting = false;
    }
    return made;
  }

  /** Age, apply gravity and drag, move, drop the dead (in place). */
  integrate(dt: number): void {
    const g = this.spec.gravity;
    const damp = Math.pow(1 - clamp01(this.spec.drag), dt);
    const arr = this.parts;
    let w = 0;
    for (let i = 0; i < arr.length; i++) {
      const p = arr[i]!;
      p.age += dt;
      if (p.age < p.life) {
        p.vy += g * dt;
        p.vx *= damp;
        p.vy *= damp;
        p.vz *= damp;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
        arr[w] = p;
        w++;
      }
    }
    arr.length = w;
  }

  /** Write every live particle into the flat buffer; returns the next offset. */
  packInto(buf: Float32Array, offset: number): number {
    const nStops = this.stops.length / 3;
    const s0 = this.spec.size[0];
    const s1 = this.spec.size[1];
    const a0 = this.spec.alpha[0];
    const a1 = this.spec.alpha[1];
    let o = offset;
    for (const p of this.parts) {
      const t = clamp01(p.age / p.life);
      let r = 1;
      let g = 1;
      let b = 1;
      if (nStops === 1) {
        r = this.stops[0]!;
        g = this.stops[1]!;
        b = this.stops[2]!;
      } else if (nStops > 1) {
        const seg = t * (nStops - 1);
        let i = Math.floor(seg);
        if (i > nStops - 2) i = nStops - 2;
        const f = seg - i;
        const k = i * 3;
        const r0 = this.stops[k]!;
        const g0 = this.stops[k + 1]!;
        const b0 = this.stops[k + 2]!;
        const r1 = this.stops[k + 3]!;
        const g1 = this.stops[k + 4]!;
        const b1 = this.stops[k + 5]!;
        r = r0 + (r1 - r0) * f;
        g = g0 + (g1 - g0) * f;
        b = b0 + (b1 - b0) * f;
      }
      buf[o] = p.x;
      buf[o + 1] = p.y;
      buf[o + 2] = p.z;
      buf[o + 3] = s0 + (s1 - s0) * t;
      buf[o + 4] = r;
      buf[o + 5] = g;
      buf[o + 6] = b;
      buf[o + 7] = clamp01(a0 + (a1 - a0) * t);
      o += STRIDE;
    }
    return o;
  }

  /** One particle; always consumes the RNG draws in the same fixed order. */
  private makeParticle(): Particle {
    const r = this.rng;
    const area = this.spec.area;
    const x = this.pos[0] + (r() * 2 - 1) * area[0];
    const y = this.pos[1] + (r() * 2 - 1) * area[1];
    const z = this.pos[2] + (r() * 2 - 1) * area[2];
    const life = Math.max(1e-4, this.lifeMin + this.lifeSpan * r());
    const speed = this.speedMin + this.speedSpan * r();
    const cosT = 1 - r() * (1 - this.cosSpread);
    const phi = r() * TWO_PI;
    const sinT = Math.sqrt(Math.max(0, 1 - cosT * cosT));
    const cx = Math.cos(phi) * sinT;
    const sx = Math.sin(phi) * sinT;
    const dx = this.dirX * cosT + this.t1x * cx + this.t2x * sx;
    const dy = this.dirY * cosT + this.t1y * cx + this.t2y * sx;
    const dz = this.dirZ * cosT + this.t1z * cx + this.t2z * sx;
    return { x, y, z, vx: dx * speed, vy: dy * speed, vz: dz * speed, age: 0, life };
  }
}

export class ParticleSystem {
  /** maxParticles * STRIDE; the first count * STRIDE values are the live particles. */
  readonly buffer: Float32Array;
  private readonly max: number;
  private readonly emitters = new Map<number, Emitter>();
  private nextHandle = 1;
  private liveCount = 0;

  constructor(maxParticles: number) {
    this.max = Math.max(0, Math.floor(maxParticles));
    this.buffer = new Float32Array(this.max * STRIDE);
  }

  /** Start an emitter at pos; returns its handle. Same seed and same steps give the same particles. */
  spawn(spec: EmitterSpec, pos: Vec3, seed: number): number {
    const handle = this.nextHandle++;
    const e = new Emitter(spec, pos, seed);
    e.emitBurst(this.max - this.liveCount);
    if (!e.isDone()) this.emitters.set(handle, e);
    this.repack();
    return handle;
  }

  /** No new particles; live ones finish their life. */
  stop(handle: number): void {
    this.emitters.get(handle)?.stop();
  }

  move(handle: number, pos: Vec3): void {
    this.emitters.get(handle)?.moveTo(pos);
  }

  /**
   * Advance: emit (rate * dt, carrying fractions over), age, move (velocity,
   * gravity, drag), drop the dead. New particles beyond maxParticles are not made.
   */
  step(dt: number): void {
    if (!(dt > 0)) return;
    for (const e of this.emitters.values()) {
      const capacity = this.max - this.liveCount;
      this.liveCount += e.emitStep(dt, capacity);
    }
    for (const e of this.emitters.values()) e.integrate(dt);
    const done: number[] = [];
    for (const [h, e] of this.emitters) if (e.isDone()) done.push(h);
    for (const h of done) this.emitters.delete(h);
    this.repack();
  }

  /** Live particles. */
  get count(): number {
    return this.liveCount;
  }

  /** Emitters still emitting or with live particles. */
  get active(): number {
    return this.emitters.size;
  }

  private repack(): void {
    let offset = 0;
    for (const e of this.emitters.values()) offset = e.packInto(this.buffer, offset);
    this.liveCount = offset / STRIDE;
  }
}

export const PARTICLE_PRESETS: readonly EmitterSpec[] = [
  {
    id: 'campfire',
    name: 'Campfire',
    rate: 70,
    burst: 0,
    duration: 0,
    life: [0.5, 1.1],
    speed: [0.8, 1.5],
    dir: [0, 1, 0],
    spread: 15,
    gravity: 1.2,
    drag: 0.7,
    size: [0.16, 0.03],
    colors: ['#fff3b0', '#ffd23f', '#ff9500', '#e63b00'],
    alpha: [0.9, 0],
    area: [0.18, 0.05, 0.18],
    additive: true,
  },
  {
    id: 'smoke',
    name: 'Smoke',
    rate: 14,
    burst: 0,
    duration: 0,
    life: [1.6, 3.2],
    speed: [0.25, 0.6],
    dir: [0, 1, 0],
    spread: 10,
    gravity: 0.35,
    drag: 0.5,
    size: [0.14, 0.85],
    colors: ['#5c5c5c', '#7d7d7d', '#9e9e9e'],
    alpha: [0.35, 0],
    area: [0.12, 0.12, 0.12],
    additive: false,
  },
  {
    id: 'snow',
    name: 'Snow',
    rate: 90,
    burst: 0,
    duration: 0,
    life: [4, 7],
    speed: [0.5, 1],
    dir: [0, -1, 0],
    spread: 12,
    gravity: -0.4,
    drag: 0.1,
    size: [0.07, 0.06],
    colors: ['#ffffff', '#e8f1ff'],
    alpha: [0.95, 0.75],
    area: [12, 0.5, 12],
    additive: false,
  },
  {
    id: 'rain',
    name: 'Rain',
    rate: 260,
    burst: 0,
    duration: 0,
    life: [0.6, 1],
    speed: [9, 13],
    dir: [0, -1, 0],
    spread: 2,
    gravity: -9.8,
    drag: 0,
    size: [0.05, 0.04],
    colors: ['#cfe4ff', '#eaf4ff'],
    alpha: [0.65, 0.35],
    area: [15, 0.5, 15],
    additive: false,
  },
  {
    id: 'sparks',
    name: 'Sparks',
    rate: 35,
    burst: 8,
    duration: 0,
    life: [0.35, 0.8],
    speed: [3, 7],
    dir: [0, 1, 0],
    spread: 55,
    gravity: -9.8,
    drag: 0.4,
    size: [0.05, 0.012],
    colors: ['#fff8c8', '#ffd23f', '#ff9500'],
    alpha: [1, 0],
    area: [0.05, 0.05, 0.05],
    additive: true,
  },
  {
    id: 'firework',
    name: 'Firework',
    rate: 0,
    burst: 120,
    duration: 0,
    life: [1.2, 2],
    speed: [6, 10],
    dir: [0, 1, 0],
    spread: 180,
    gravity: -3.5,
    drag: 0.85,
    size: [0.12, 0.04],
    colors: ['#ffffff', '#ffd23f', '#ff4d6d', '#4dd2ff', '#8dff5e', '#c77dff'],
    alpha: [1, 0],
    area: [0, 0, 0],
    additive: true,
  },
  {
    id: 'bubbles',
    name: 'Bubbles',
    rate: 9,
    burst: 0,
    duration: 0,
    life: [2.5, 4.5],
    speed: [0.25, 0.6],
    dir: [0, 1, 0],
    spread: 20,
    gravity: 0.5,
    drag: 0.3,
    size: [0.05, 0.14],
    colors: ['#bfe9ff', '#e6f7ff'],
    alpha: [0.7, 0.1],
    area: [0.3, 0.1, 0.3],
    additive: false,
  },
  {
    id: 'dust',
    name: 'Dust',
    rate: 0,
    burst: 26,
    duration: 0,
    life: [0.4, 0.9],
    speed: [0.6, 1.6],
    dir: [0, 1, 0],
    spread: 130,
    gravity: -0.6,
    drag: 0.9,
    size: [0.14, 0.45],
    colors: ['#d9c9a1', '#c4b088'],
    alpha: [0.55, 0],
    area: [0.2, 0.08, 0.2],
    additive: false,
  },
  {
    id: 'glitter',
    name: 'Glitter',
    rate: 60,
    burst: 0,
    duration: 0,
    life: [0.3, 0.7],
    speed: [0.15, 0.5],
    dir: [0, 1, 0],
    spread: 180,
    gravity: 0.05,
    drag: 0.6,
    size: [0.05, 0.015],
    colors: ['#ffd700', '#ff9ecb'],
    alpha: [1, 0],
    area: [0.5, 0.3, 0.5],
    additive: true,
  },
  {
    id: 'embers',
    name: 'Embers',
    rate: 7,
    burst: 0,
    duration: 0,
    life: [2.5, 5],
    speed: [0.4, 0.9],
    dir: [0, 1, 0],
    spread: 25,
    gravity: 0.45,
    drag: 0.25,
    size: [0.045, 0.012],
    colors: ['#ffb347', '#ff7b1c', '#e63b00'],
    alpha: [1, 0],
    area: [0.25, 0.05, 0.25],
    additive: true,
  },
  {
    id: 'splash',
    name: 'Splash',
    rate: 0,
    burst: 42,
    duration: 0,
    life: [0.5, 1],
    speed: [2.5, 5],
    dir: [0, 1, 0],
    spread: 35,
    gravity: -9.8,
    drag: 0.15,
    size: [0.06, 0.02],
    colors: ['#7cc4ff', '#d9efff'],
    alpha: [0.9, 0.15],
    area: [0.12, 0.04, 0.12],
    additive: false,
  },
  {
    id: 'confetti',
    name: 'Confetti',
    rate: 0,
    burst: 90,
    duration: 0,
    life: [2, 3.5],
    speed: [2, 4.5],
    dir: [0, 1, 0],
    spread: 70,
    gravity: -2.5,
    drag: 0.65,
    size: [0.07, 0.055],
    colors: ['#ff4d6d', '#ffd23f', '#4dd2ff', '#8dff5e', '#c77dff', '#ff9ecb'],
    alpha: [1, 0.85],
    area: [0.3, 0.1, 0.3],
    additive: false,
  },
];

const PRESET_INDEX = new Map<string, EmitterSpec>(PARTICLE_PRESETS.map((p) => [p.id, p]));

export function presetById(id: string): EmitterSpec | undefined {
  return PRESET_INDEX.get(id);
}