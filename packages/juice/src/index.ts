// juice.ts — data-driven "juice" presets for a goblin building game.
// Pure, deterministic, no globals, no DOM, no Date, no Math.random.

export interface Sprite {
  id: string;
  name: string;
  doc: string;
  count: number;
  colors: string[]; // #rrggbb
  size: number;
  lifeMs: number;
  speed: number;
  spread: number; // 0 narrow jet .. 1 hemisphere
  gravity: number; // positive pulls -Y
  additive: boolean;
  drag: number;
  fade: 'linear' | 'quad';
  shrink: number; // 0..1
}

export interface Juice {
  id: string;
  name: string;
  sprite: string | null;
  sound: string | null;
  shake: number; // 0..1
  squash: number; // 0..1
  hitStopMs: number;
  rateLimitMs: number;
}

export interface ValidationResult { ok: boolean; errors: string[] }

export interface RenderParticle {
  x: number; y: number; z: number; size: number;
  r: number; g: number; b: number; alpha: number; additive: boolean;
}

export const RANGES = {
  count: [1, 400], size: [0.05, 6], lifeMs: [100, 4000], speed: [0, 30],
  spread: [0, 1], gravity: [-20, 40], drag: [0, 20], shrink: [0, 1],
  shake: [0, 1], squash: [0, 1], hitStopMs: [0, 500], rateLimitMs: [0, 1000],
} as const;

export const MAX_PARTICLES = 3000;
export const SHAKE_MS = 600;
export const SQUASH_MS = 180;

export const SOUNDS: string[] = [
  'sculpt-tick', 'paint-tick', 'place', 'delete', 'select', 'snap', 'ui-success',
  'ui-error', 'ui-click', 'tool-switch', 'undo', 'redo', 'save',
];

export const SOUND_PHRASES: Record<string, string> = {
  'sculpt-tick': 'a soft tick', 'paint-tick': 'a wet dab', 'place': 'a solid thunk',
  'delete': 'a dry crunch', 'select': 'a tiny blip', 'snap': 'a crisp snap',
  'ui-success': 'a happy chime', 'ui-error': 'a grumpy buzz', 'ui-click': 'a click',
  'tool-switch': 'a swap clack', 'undo': 'a rewind whirr', 'redo': 'a forward whirr',
  'save': 'a warm ding',
};

export const SPRITES: Sprite[] = [
  { id: 'dust-puff', name: 'Dust puff', doc: 'A soft low cloud of grit kicked up when a tool nudges the ground.', count: 18, colors: ['#c8b89a', '#a89878', '#e0d4bb'], size: 0.22, lifeMs: 620, speed: 2.4, spread: 0.75, gravity: 1.5, additive: false, drag: 3.2, fade: 'linear', shrink: 0.6 },
  { id: 'sparkle', name: 'Sparkle', doc: 'Tiny bright glints that twinkle outward for successful picks and snaps.', count: 14, colors: ['#ffffff', '#ffe9a8', '#b8ecff'], size: 0.1, lifeMs: 450, speed: 4.5, spread: 1, gravity: 0, additive: true, drag: 5, fade: 'quad', shrink: 0.9 },
  { id: 'debris-chips', name: 'Debris chips', doc: 'Chunky rock flakes that fly off the dig point and tumble down.', count: 22, colors: ['#7d7367', '#5d564d', '#9b9184'], size: 0.16, lifeMs: 900, speed: 6.5, spread: 0.45, gravity: 16, additive: false, drag: 0.6, fade: 'linear', shrink: 0.2 },
  { id: 'pop-confetti', name: 'Pop confetti', doc: 'Flat party scraps that burst wide and flutter to the floor.', count: 60, colors: ['#ff5d8f', '#ffd166', '#06d6a0', '#4cc9f0'], size: 0.14, lifeMs: 1600, speed: 7, spread: 1, gravity: 7, additive: false, drag: 1.8, fade: 'linear', shrink: 0.1 },
  { id: 'leaves', name: 'Leaves', doc: 'Lazy green blades that drift sideways after brushing foliage.', count: 16, colors: ['#5ca04a', '#7dbd5f', '#3f7a35'], size: 0.2, lifeMs: 1800, speed: 2, spread: 0.9, gravity: 2.2, additive: false, drag: 2.4, fade: 'linear', shrink: 0.15 },
  { id: 'water-splash', name: 'Water splash', doc: 'A cold crown of droplets thrown up where the tool breaks the surface.', count: 34, colors: ['#8fd6ff', '#cdefff', '#4aa8dd'], size: 0.12, lifeMs: 700, speed: 8, spread: 0.3, gravity: 20, additive: false, drag: 0.8, fade: 'quad', shrink: 0.5 },
  { id: 'smoke', name: 'Smoke', doc: 'Slow grey billows that swell and thin out above the edit.', count: 12, colors: ['#9a9a9a', '#bdbdbd', '#787878'], size: 0.5, lifeMs: 2200, speed: 1.2, spread: 0.6, gravity: -2, additive: false, drag: 1.4, fade: 'quad', shrink: 0 },
  { id: 'embers', name: 'Embers', doc: 'Hot orange motes that rise, wobble and wink out.', count: 20, colors: ['#ff7b2e', '#ffd05b', '#ff3b1f'], size: 0.09, lifeMs: 1400, speed: 2.2, spread: 0.85, gravity: -3.5, additive: true, drag: 1.1, fade: 'quad', shrink: 0.7 },
  { id: 'stars', name: 'Stars', doc: 'Fat cartoon stars that pop out and hang briefly for saves.', count: 10, colors: ['#ffe066', '#fff3bf', '#ffc300'], size: 0.3, lifeMs: 800, speed: 3.2, spread: 0.8, gravity: 4, additive: true, drag: 2.6, fade: 'linear', shrink: 0.5 },
  { id: 'bubbles', name: 'Bubbles', doc: 'Round translucent spheres that float up and gently vanish.', count: 15, colors: ['#bfefff', '#ffffff', '#7fd4f5'], size: 0.18, lifeMs: 2000, speed: 1.4, spread: 1, gravity: -4, additive: false, drag: 1.2, fade: 'linear', shrink: 0 },
  { id: 'snow', name: 'Snow', doc: 'Fine cold flecks that fall slowly and settle out of sight.', count: 26, colors: ['#ffffff', '#e8f4ff', '#cfe6f7'], size: 0.08, lifeMs: 2600, speed: 0.8, spread: 1, gravity: 1.2, additive: false, drag: 2, fade: 'linear', shrink: 0.2 },
  { id: 'coins', name: 'Coins', doc: 'Spinning gold discs that arc up then clatter back down.', count: 12, colors: ['#ffd700', '#ffb700', '#fff0a3'], size: 0.24, lifeMs: 1200, speed: 7.5, spread: 0.35, gravity: 22, additive: false, drag: 0.4, fade: 'linear', shrink: 0 },
  { id: 'hearts', name: 'Hearts', doc: 'Soft pink hearts that bob upward when a goblin approves.', count: 8, colors: ['#ff6b9a', '#ffb3c9', '#e63f73'], size: 0.26, lifeMs: 1500, speed: 1.6, spread: 0.5, gravity: -2.5, additive: false, drag: 1.6, fade: 'linear', shrink: 0.3 },
  { id: 'lightning-zap', name: 'Lightning zap', doc: 'A short violent spray of white-blue sparks for refused actions.', count: 24, colors: ['#ffffff', '#9ad7ff', '#4f7bff'], size: 0.07, lifeMs: 260, speed: 12, spread: 0.6, gravity: 0, additive: true, drag: 7, fade: 'quad', shrink: 0.8 },
  { id: 'crumble', name: 'Crumble', doc: 'Dry collapsing grains that drop straight down as material is removed.', count: 30, colors: ['#8c7b63', '#6b5d49', '#a8977c'], size: 0.13, lifeMs: 800, speed: 1.8, spread: 0.95, gravity: 18, additive: false, drag: 1, fade: 'linear', shrink: 0.4 },
  { id: 'sand-spray', name: 'Sand spray', doc: 'A flat fan of pale sand flung along the surface by a flatten pass.', count: 40, colors: ['#e3cf9e', '#cdb682', '#f3e6c4'], size: 0.09, lifeMs: 560, speed: 5.5, spread: 0.2, gravity: 9, additive: false, drag: 2.8, fade: 'quad', shrink: 0.65 },
  { id: 'goblin-puff', name: 'Goblin puff', doc: 'A cheeky swamp-green cloud that marks anything goblin-made.', count: 20, colors: ['#7ac74f', '#4e8c33', '#b6e388'], size: 0.28, lifeMs: 900, speed: 2.6, spread: 0.9, gravity: -1, additive: false, drag: 2.5, fade: 'quad', shrink: 0.5 },
  { id: 'gold-burst', name: 'Gold burst', doc: 'A loud shower of golden shards reserved for winning a build.', count: 90, colors: ['#ffd700', '#fff6c2', '#ffae00', '#ffffff'], size: 0.16, lifeMs: 1800, speed: 11, spread: 1, gravity: 12, additive: true, drag: 1.2, fade: 'quad', shrink: 0.35 },
  { id: 'rainbow', name: 'Rainbow', doc: 'A wide arc of saturated colour for level-ups and silly milestones.', count: 70, colors: ['#ff4d4d', '#ffa64d', '#ffe24d', '#4dff88', '#4dc3ff', '#b84dff'], size: 0.15, lifeMs: 1700, speed: 8.5, spread: 1, gravity: 6, additive: true, drag: 1.5, fade: 'linear', shrink: 0.25 },
  { id: 'pixel-blocks', name: 'Pixel blocks', doc: 'Hard little cubes that pop out when a model snaps into the world.', count: 16, colors: ['#ffffff', '#9bd1ff', '#ffd79b'], size: 0.2, lifeMs: 500, speed: 4, spread: 0.55, gravity: 10, additive: false, drag: 2, fade: 'linear', shrink: 0.9 },
];

export const JUICE: Juice[] = [
  { id: 'raise-ground', name: 'Raise ground', sprite: 'dust-puff', sound: 'sculpt-tick', shake: 0.12, squash: 0.5, hitStopMs: 0, rateLimitMs: 45 },
  { id: 'lower-ground', name: 'Lower ground', sprite: 'crumble', sound: 'sculpt-tick', shake: 0.14, squash: 0.45, hitStopMs: 0, rateLimitMs: 45 },
  { id: 'dig', name: 'Dig', sprite: 'debris-chips', sound: 'sculpt-tick', shake: 0.3, squash: 0.7, hitStopMs: 25, rateLimitMs: 70 },
  { id: 'paint', name: 'Paint', sprite: 'goblin-puff', sound: 'paint-tick', shake: 0.05, squash: 0.35, hitStopMs: 0, rateLimitMs: 35 },
  { id: 'flatten', name: 'Flatten', sprite: 'sand-spray', sound: 'snap', shake: 0.18, squash: 0.55, hitStopMs: 0, rateLimitMs: 60 },
  { id: 'smooth', name: 'Smooth', sprite: 'smoke', sound: 'sculpt-tick', shake: 0.04, squash: 0.25, hitStopMs: 0, rateLimitMs: 55 },
  { id: 'place-model', name: 'Place model', sprite: 'pixel-blocks', sound: 'place', shake: 0.25, squash: 0.8, hitStopMs: 40, rateLimitMs: 90 },
  { id: 'delete-model', name: 'Delete model', sprite: 'crumble', sound: 'delete', shake: 0.3, squash: 0.6, hitStopMs: 50, rateLimitMs: 90 },
  { id: 'pick', name: 'Pick', sprite: 'sparkle', sound: 'select', shake: 0, squash: 0.3, hitStopMs: 0, rateLimitMs: 30 },
  { id: 'undo', name: 'Undo', sprite: 'smoke', sound: 'undo', shake: 0.08, squash: 0.2, hitStopMs: 0, rateLimitMs: 80 },
  { id: 'save', name: 'Save', sprite: 'stars', sound: 'save', shake: 0.06, squash: 0.4, hitStopMs: 0, rateLimitMs: 400 },
  { id: 'win', name: 'Win', sprite: 'gold-burst', sound: 'ui-success', shake: 0.8, squash: 1, hitStopMs: 120, rateLimitMs: 1000 },
  { id: 'level-up', name: 'Level up', sprite: 'rainbow', sound: 'ui-success', shake: 0.55, squash: 0.9, hitStopMs: 90, rateLimitMs: 1000 },
  { id: 'error', name: 'Error', sprite: 'lightning-zap', sound: 'ui-error', shake: 0.35, squash: 0.15, hitStopMs: 60, rateLimitMs: 250 },
];

/* ------------------------------- validation ------------------------------ */

const ID_RE = /^[a-z0-9][a-z0-9-]*$/;
const HEX_RE = /^#[0-9a-fA-F]{6}$/;

function isObj(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

function show(v: unknown): string {
  if (v === null) return 'null';
  if (v === undefined) return 'undefined';
  if (typeof v === 'string') return JSON.stringify(v);
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) return `an array of ${v.length}`;
  return typeof v;
}

function checkId(errs: string[], o: Record<string, unknown>, key: string): void {
  const v = o[key];
  if (typeof v !== 'string' || v.length === 0) { errs.push(`${key} must be a non-empty string (got ${show(v)})`); return; }
  if (!ID_RE.test(v)) errs.push(`${key} must be lowercase letters, digits and dashes (got ${show(v)})`);
}

function checkText(errs: string[], o: Record<string, unknown>, key: string, min: number): void {
  const v = o[key];
  if (typeof v !== 'string') { errs.push(`${key} must be a string (got ${show(v)})`); return; }
  if (v.trim().length < min) errs.push(`${key} must be at least ${min} characters of real text (got ${show(v)})`);
}

function checkNum(errs: string[], o: Record<string, unknown>, key: string, range: readonly [number, number], integer = false): void {
  const v = o[key];
  const [min, max] = range;
  if (typeof v !== 'number' || !Number.isFinite(v)) { errs.push(`${key} must be a finite number between ${min} and ${max} (got ${show(v)})`); return; }
  if (integer && !Number.isInteger(v)) { errs.push(`${key} must be a whole number between ${min} and ${max} (got ${v})`); return; }
  if (v < min || v > max) errs.push(`${key} must be between ${min} and ${max} (got ${v})`);
}

export function validateSprite(x: unknown): ValidationResult {
  const errs: string[] = [];
  if (!isObj(x)) return { ok: false, errors: [`sprite must be an object (got ${show(x)})`] };
  checkId(errs, x, 'id');
  checkText(errs, x, 'name', 1);
  checkText(errs, x, 'doc', 10);
  checkNum(errs, x, 'count', RANGES.count, true);
  checkNum(errs, x, 'size', RANGES.size);
  checkNum(errs, x, 'lifeMs', RANGES.lifeMs);
  checkNum(errs, x, 'speed', RANGES.speed);
  checkNum(errs, x, 'spread', RANGES.spread);
  checkNum(errs, x, 'gravity', RANGES.gravity);
  checkNum(errs, x, 'drag', RANGES.drag);
  checkNum(errs, x, 'shrink', RANGES.shrink);
  const colors = x['colors'];
  if (!Array.isArray(colors) || colors.length === 0) {
    errs.push(`colors must be a non-empty array of #rrggbb strings (got ${show(colors)})`);
  } else {
    if (colors.length > 8) errs.push(`colors must hold at most 8 entries (got ${colors.length})`);
    for (let i = 0; i < colors.length; i++) {
      const c = colors[i];
      if (typeof c !== 'string' || !HEX_RE.test(c)) errs.push(`colors[${i}] must look like #rrggbb (got ${show(c)})`);
    }
  }
  if (typeof x['additive'] !== 'boolean') errs.push(`additive must be true or false (got ${show(x['additive'])})`);
  const fade = x['fade'];
  if (fade !== 'linear' && fade !== 'quad') errs.push(`fade must be "linear" or "quad" (got ${show(fade)})`);
  return { ok: errs.length === 0, errors: errs };
}

export function validateJuice(x: unknown, sprites?: Sprite[]): ValidationResult {
  const errs: string[] = [];
  if (!isObj(x)) return { ok: false, errors: [`juice must be an object (got ${show(x)})`] };
  checkId(errs, x, 'id');
  checkText(errs, x, 'name', 1);
  checkNum(errs, x, 'shake', RANGES.shake);
  checkNum(errs, x, 'squash', RANGES.squash);
  checkNum(errs, x, 'hitStopMs', RANGES.hitStopMs);
  checkNum(errs, x, 'rateLimitMs', RANGES.rateLimitMs);
  const sprite = x['sprite'];
  if (sprite !== null && typeof sprite !== 'string') {
    errs.push(`sprite must be a sprite id or null (got ${show(sprite)})`);
  } else if (typeof sprite === 'string') {
    if (sprite.length === 0) errs.push('sprite must be a non-empty sprite id or null');
    else if (sprites && !sprites.some((s) => s.id === sprite)) errs.push(`sprite "${sprite}" is not a known sprite preset`);
  }
  const sound = x['sound'];
  if (sound !== null && typeof sound !== 'string') errs.push(`sound must be a sound id or null (got ${show(sound)})`);
  else if (typeof sound === 'string' && !SOUNDS.includes(sound)) errs.push(`sound "${sound}" is not one of: ${SOUNDS.join(', ')}`);
  return { ok: errs.length === 0, errors: errs };
}

/* -------------------------------- helpers -------------------------------- */

function clamp(v: number, lo: number, hi: number): number {
  if (!Number.isFinite(v)) return lo;
  return v < lo ? lo : v > hi ? hi : v;
}
function clamp01(v: number): number { return clamp(v, 0, 1); }

function hexToRgb(hex: string): [number, number, number] {
  if (!HEX_RE.test(hex)) return [255, 255, 255];
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function normalize3(v: [number, number, number]): [number, number, number] {
  const [x, y, z] = v;
  const len = Math.sqrt(x * x + y * y + z * z);
  if (!Number.isFinite(len) || len < 1e-9) return [0, 1, 0];
  return [x / len, y / len, z / len];
}

function safeVec(v: unknown): [number, number, number] {
  if (!Array.isArray(v)) return [0, 0, 0];
  const a = typeof v[0] === 'number' && Number.isFinite(v[0]) ? v[0] : 0;
  const b = typeof v[1] === 'number' && Number.isFinite(v[1]) ? v[1] : 0;
  const c = typeof v[2] === 'number' && Number.isFinite(v[2]) ? v[2] : 0;
  return [a, b, c];
}

/* ----------------------------- particle sim ------------------------------ */

interface P {
  x: number; y: number; z: number; vx: number; vy: number; vz: number;
  age: number; life: number; size: number; r: number; g: number; b: number;
  gravity: number; drag: number; shrink: number; quad: boolean; additive: boolean;
}

export class ParticleSim {
  private state: number;
  private live: P[] = [];

  constructor(seed = 1) {
    const s = Number.isFinite(seed) ? Math.floor(seed) : 1;
    this.state = (s >>> 0) || 0x9e3779b9;
  }

  /** deterministic mulberry32 in [0,1) */
  private rnd(): number {
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  reset(seed = 1): void {
    const s = Number.isFinite(seed) ? Math.floor(seed) : 1;
    this.state = (s >>> 0) || 0x9e3779b9;
    this.live = [];
  }

  count(): number { return this.live.length; }

  emit(sprite: Sprite, pos: [number, number, number], normal: [number, number, number]): number {
    if (!isObj(sprite)) return 0;
    const colors = Array.isArray(sprite.colors) && sprite.colors.length > 0 ? sprite.colors : ['#ffffff'];
    const count = Math.round(clamp(sprite.count, RANGES.count[0], RANGES.count[1]));
    const life = clamp(sprite.lifeMs, RANGES.lifeMs[0], RANGES.lifeMs[1]);
    const speed = clamp(sprite.speed, RANGES.speed[0], RANGES.speed[1]);
    const spread = clamp01(sprite.spread);
    const size = clamp(sprite.size, RANGES.size[0], RANGES.size[1]);
    const gravity = clamp(sprite.gravity, RANGES.gravity[0], RANGES.gravity[1]);
    const drag = clamp(sprite.drag, RANGES.drag[0], RANGES.drag[1]);
    const shrink = clamp01(sprite.shrink);
    const quad = sprite.fade === 'quad';
    const additive = sprite.additive === true;

    const [px, py, pz] = safeVec(pos);
    const n = normalize3(safeVec(normal));
    const ref: [number, number, number] = Math.abs(n[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
    const t1 = normalize3([
      ref[1] * n[2] - ref[2] * n[1],
      ref[2] * n[0] - ref[0] * n[2],
      ref[0] * n[1] - ref[1] * n[0],
    ]);
    const t2: [number, number, number] = [
      n[1] * t1[2] - n[2] * t1[1],
      n[2] * t1[0] - n[0] * t1[2],
      n[0] * t1[1] - n[1] * t1[0],
    ];
    const cosMax = Math.cos(spread * Math.PI * 0.5);

    for (let i = 0; i < count; i++) {
      const u = this.rnd();
      const c = 1 - u * (1 - cosMax);
      const s = Math.sqrt(Math.max(0, 1 - c * c));
      const phi = 2 * Math.PI * this.rnd();
      const cp = Math.cos(phi), sp = Math.sin(phi);
      const dx = n[0] * c + t1[0] * s * cp + t2[0] * s * sp;
      const dy = n[1] * c + t1[1] * s * cp + t2[1] * s * sp;
      const dz = n[2] * c + t1[2] * s * cp + t2[2] * s * sp;
      const sp2 = speed * (0.65 + 0.35 * this.rnd());
      const hex = colors[i % colors.length] ?? '#ffffff';
      const [r, g, b] = hexToRgb(hex);
      this.live.push({
        x: px, y: py, z: pz, vx: dx * sp2, vy: dy * sp2, vz: dz * sp2,
        age: 0, life, size, r, g, b, gravity, drag, shrink, quad, additive,
      });
    }
    if (this.live.length > MAX_PARTICLES) this.live.splice(0, this.live.length - MAX_PARTICLES);
    return count;
  }

  step(dtMs: number): void {
    if (!Number.isFinite(dtMs) || dtMs <= 0) return;
    const dt = dtMs / 1000;
    const next: P[] = [];
    for (const p of this.live) {
      p.age += dtMs;
      if (p.age >= p.life) continue;
      p.vy -= p.gravity * dt;
      const k = Math.exp(-p.drag * dt);
      p.vx *= k; p.vy *= k; p.vz *= k;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      next.push(p);
    }
    this.live = next;
  }

  particles(): RenderParticle[] {
    const out: RenderParticle[] = [];
    for (const p of this.live) {
      const t = clamp01(p.age / p.life);
      const alpha = clamp01(p.quad ? (1 - t) * (1 - t) : 1 - t);
      out.push({
        x: p.x, y: p.y, z: p.z, size: Math.max(0, p.size * (1 - p.shrink * t)),
        r: p.r, g: p.g, b: p.b, alpha, additive: p.additive,
      });
    }
    return out;
  }
}

/* --------------------------------- shake --------------------------------- */

export class Shake {
  private amp = 0;
  private remaining = 0;
  private tick = 0;
  private readonly seed: number;

  constructor(seed = 7) { this.seed = (Number.isFinite(seed) ? Math.floor(seed) : 7) >>> 0; }

  kick(amount: number): void {
    const a = clamp01(amount);
    if (a <= 0) return;
    this.amp = Math.max(this.amp, a);
    this.remaining = Math.max(this.remaining, SHAKE_MS * a);
  }

  private noise(i: number): number {
    let t = (Math.imul(i + this.seed, 0x27d4eb2d) ^ 0x165667b1) >>> 0;
    t = Math.imul(t ^ (t >>> 15), t | 1) >>> 0;
    t = (t ^ (t >>> 13)) >>> 0;
    return (t / 4294967296) * 2 - 1;
  }

  step(dtMs: number): { x: number; y: number } {
    if (this.remaining <= 0) { this.amp = 0; return { x: 0, y: 0 }; }
    const dt = Number.isFinite(dtMs) && dtMs > 0 ? dtMs : 0;
    this.remaining -= dt;
    if (this.remaining <= 0) { this.remaining = 0; this.amp = 0; return { x: 0, y: 0 }; }
    this.tick += 1;
    const k = this.remaining / SHAKE_MS;
    const env = this.amp * k * k;
    return { x: env * this.noise(this.tick * 2), y: env * this.noise(this.tick * 2 + 1) };
  }

  active(): boolean { return this.remaining > 0; }
}

export function squashScale(juice: Juice, tMs: number): number {
  const s = isObj(juice) ? clamp01((juice as unknown as Juice).squash) : 0;
  if (!Number.isFinite(tMs) || tMs <= 0 || tMs >= SQUASH_MS) return 1;
  const p = tMs / SQUASH_MS;
  const pulse = 0.5 - 0.5 * Math.cos(2 * Math.PI * p);
  return 1 + 0.15 * s * pulse;
}

/* ------------------------------ juice player ----------------------------- */

export interface JuiceEvent {
  sprite: Sprite | null; sound: string | null; shake: number; squash: number; hitStopMs: number;
}

export class JuicePlayer {
  private last = new Map<string, number>();
  private readonly sprites: Sprite[];

  constructor(sprites: Sprite[] = SPRITES) { this.sprites = Array.isArray(sprites) ? sprites : SPRITES; }

  reset(): void { this.last.clear(); }

  play(juice: Juice, ctx: { now: number }): JuiceEvent | null {
    if (!isObj(juice)) return null;
    const now = isObj(ctx) && typeof ctx.now === 'number' && Number.isFinite(ctx.now) ? ctx.now : 0;
    const id = typeof juice.id === 'string' ? juice.id : '';
    const limit = clamp(juice.rateLimitMs, 0, RANGES.rateLimitMs[1]);
    const prev = this.last.get(id);
    if (prev !== undefined && now - prev < limit) return null;
    this.last.set(id, now);
    const sprite = typeof juice.sprite === 'string' ? this.sprites.find((s) => s.id === juice.sprite) ?? null : null;
    const sound = typeof juice.sound === 'string' && SOUNDS.includes(juice.sound) ? juice.sound : null;
    return {
      sprite, sound, shake: clamp01(juice.shake), squash: clamp01(juice.squash),
      hitStopMs: clamp(juice.hitStopMs, 0, RANGES.hitStopMs[1]),
    };
  }
}

function shakeWord(v: number): string {
  const s = clamp01(v);
  if (s <= 0) return 'no shake';
  if (s <= 0.2) return 'light shake';
  if (s <= 0.5) return 'medium shake';
  return 'heavy shake';
}

export function describeJuice(j: Juice, sprites: Sprite[] = SPRITES): string {
  if (!isObj(j)) return 'Unknown juice: no particles and no sound, no shake';
  const list = Array.isArray(sprites) ? sprites : SPRITES;
  const name = typeof j.name === 'string' && j.name.length > 0 ? j.name : 'Unnamed';
  const sprite = typeof j.sprite === 'string' ? list.find((s) => s.id === j.sprite) : undefined;
  const spritePart = sprite ? sprite.name : 'No particles';
  const soundPart = typeof j.sound === 'string' && SOUND_PHRASES[j.sound] !== undefined
    ? SOUND_PHRASES[j.sound] ?? 'a sound'
    : 'no sound';
  return `${name}: ${spritePart} and ${soundPart}, ${shakeWord(typeof j.shake === 'number' ? j.shake : 0)}`;
}