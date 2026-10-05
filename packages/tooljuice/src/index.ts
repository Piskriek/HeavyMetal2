// src/index.ts
// Tool juice: feedback effects for the goblin's eleven hand tools.
// Pure data + validator + timeline helpers. No DOM, no Date, no randomness, no imports.

// ---------------------------------------------------------------------------
// The game's existing formats
// ---------------------------------------------------------------------------

export interface Sprite {
  id: string;
  name: string;
  doc: string;
  count: number;
  colors: string[];
  size: number;
  lifeMs: number;
  speed: number;
  spread: number;
  gravity: number;
  additive: boolean;
  drag: number;
  fade: 'linear' | 'quad';
  shrink: number;
}

export interface Juice {
  id: string;
  name: string;
  sprite: string | null;
  sound: string | null;
  shake: number;
  squash: number;
  hitStopMs: number;
  rateLimitMs: number;
}

export const RANGES: { readonly [k: string]: readonly [number, number] } = Object.freeze({
  count: [1, 400],
  size: [0.05, 6],
  lifeMs: [100, 4000],
  speed: [0, 30],
  spread: [0, 1],
  gravity: [-20, 40],
  drag: [0, 20],
  shrink: [0, 1],
  shake: [0, 1],
  squash: [0, 1],
  hitStopMs: [0, 500],
  rateLimitMs: [0, 1000],
} as const);

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

export type Shape = 'beam' | 'rings' | 'cone' | 'ripple' | 'stamp' | 'confetti';

export type ToolId =
  | 'magnet'
  | 'can'
  | 'rollingPin'
  | 'baton'
  | 'boombox'
  | 'flashlight'
  | 'zapGun'
  | 'camera'
  | 'windupKey'
  | 'spade'
  | 'fairyWand';

export const TOOL_IDS: readonly ToolId[] = Object.freeze([
  'magnet',
  'can',
  'rollingPin',
  'baton',
  'boombox',
  'flashlight',
  'zapGun',
  'camera',
  'windupKey',
  'spade',
  'fairyWand',
] as const);

/** Squash and stretch over the effect: scale of the goblin along y (x and z get 1/sqrt(y) to keep volume), as keys of [ms, y]. */
export interface ToolJuice {
  tool: ToolId;
  shape: Shape;
  juice: Juice;
  sprites: Sprite[];
  squashCurve: [number, number][];
  bursts: number[];
}

/** Default paint colour for the spray can. */
export const DEFAULT_PAINT = '#ff66aa';

/** Colour word per tool, used by describe(). */
const COLOUR_WORDS: Readonly<Record<ToolId, string>> = {
  magnet: 'blue-and-red',
  can: 'paint-pink',
  rollingPin: 'dusty beige',
  baton: 'gold',
  boombox: 'purple',
  flashlight: 'warm white',
  zapGun: 'cyan',
  camera: 'white',
  windupKey: 'brass',
  spade: 'brown',
  fairyWand: 'pastel rainbow',
};

type SpriteNums = Omit<Sprite, 'id' | 'name' | 'doc' | 'colors'>;

const SPRITE_DEFAULTS: SpriteNums = {
  count: 20,
  size: 0.3,
  lifeMs: 600,
  speed: 4,
  spread: 0.3,
  gravity: 0,
  additive: false,
  drag: 2,
  fade: 'linear',
  shrink: 0.5,
};

function sprite(id: string, name: string, doc: string, colors: string[], o: Partial<SpriteNums>): Sprite {
  return { id, name, doc, colors, ...SPRITE_DEFAULTS, ...o };
}

function juice(id: string, name: string, spriteId: string | null, sound: string | null, o: Omit<Juice, 'id' | 'name' | 'sprite' | 'sound'>): Juice {
  return { id, name, sprite: spriteId, sound, ...o };
}

const DATA: Record<ToolId, ToolJuice> = {
  magnet: {
    tool: 'magnet',
    shape: 'beam',
    juice: juice('tool.magnet', 'Magnet', 'magnet.sparks', 'magnet_hum', { shake: 0.15, squash: 0.2, hitStopMs: 0, rateLimitMs: 90 }),
    sprites: [
      sprite('magnet.sparks', 'Pull sparks', 'Sparks streaming along a line toward the goblin, alternating poles (the beam shape emits from target to goblin).', ['#3a7bff', '#ff3b3b', '#cfe0ff'], {
        count: 36, size: 0.18, lifeMs: 420, speed: 9, spread: 0.06, gravity: 0, additive: true, drag: 0.5, fade: 'quad', shrink: 0.7,
      }),
      sprite('magnet.field', 'Field shimmer', 'Faint arcs hugging the beam.', ['#6f9bff', '#ff7a7a'], {
        count: 8, size: 0.6, lifeMs: 300, speed: 1, spread: 0.2, additive: true, drag: 4, shrink: 0.2,
      }),
    ],
    squashCurve: [[0, 1], [60, 1.08], [200, 0.95], [360, 1]],
    bursts: [0, 100, 200, 300, 400],
  },

  can: {
    tool: 'can',
    shape: 'cone',
    juice: juice('tool.can', 'Spray can', 'can.mist', 'spray_hiss', { shake: 0.05, squash: 0.1, hitStopMs: 0, rateLimitMs: 50 }),
    sprites: [
      sprite('can.mist', 'Paint mist', 'Fine droplets fanning out in a cone in the current paint colour.', [DEFAULT_PAINT, '#ff8fc0', '#ffd1e6'], {
        count: 60, size: 0.12, lifeMs: 520, speed: 8, spread: 0.35, gravity: 2, drag: 6, fade: 'quad', shrink: 0.3,
      }),
      sprite('can.drip', 'Drips', 'A few heavy drops that fall out of the cone.', [DEFAULT_PAINT], {
        count: 4, size: 0.2, lifeMs: 700, speed: 3, spread: 0.2, gravity: 18, drag: 0.5, shrink: 0.1,
      }),
    ],
    squashCurve: [[0, 1], [40, 0.96], [300, 0.98], [420, 1]],
    bursts: [0, 60, 120, 180, 240],
  },

  rollingPin: {
    tool: 'rollingPin',
    shape: 'ripple',
    juice: juice('tool.rollingPin', 'Rolling pin', 'rollingPin.rings', 'pin_roll_thump', { shake: 0.3, squash: 0.45, hitStopMs: 20, rateLimitMs: 220 }),
    sprites: [
      sprite('rollingPin.rings', 'Flatten rings', 'Low rings pressing outward along the ground.', ['#d9c7a3', '#c8b48c', '#efe3c8'], {
        count: 3, size: 1.6, lifeMs: 650, speed: 5, spread: 0, gravity: 0, drag: 3, fade: 'quad', shrink: 0,
      }),
      sprite('rollingPin.flour', 'Flour puff', 'Dusty puff kicked up at the edges.', ['#efe3c8', '#d9c7a3'], {
        count: 24, size: 0.35, lifeMs: 900, speed: 2.5, spread: 0.8, gravity: -0.5, drag: 3, shrink: 0.2,
      }),
    ],
    squashCurve: [[0, 1], [80, 0.8], [180, 1.1], [320, 1]],
    bursts: [0, 80],
  },

  baton: {
    tool: 'baton',
    shape: 'rings',
    juice: juice('tool.baton', 'Baton', 'baton.notes', 'baton_chime', { shake: 0.1, squash: 0.3, hitStopMs: 0, rateLimitMs: 180 }),
    sprites: [
      sprite('baton.notes', 'Music notes', 'Notes rising in widening rings around the goblin.', ['#ffd24a', '#ffb800', '#fff1b8'], {
        count: 12, size: 0.4, lifeMs: 1200, speed: 2, spread: 1, gravity: -3, additive: true, drag: 1, shrink: 0.3,
      }),
      sprite('baton.glint', 'Baton glint', 'A short gold glint at the baton tip.', ['#fff1b8'], {
        count: 5, size: 0.2, lifeMs: 250, speed: 1.5, spread: 0.5, additive: true, drag: 3, fade: 'quad', shrink: 0.9,
      }),
    ],
    squashCurve: [[0, 1], [90, 1.15], [220, 0.92], [400, 1]],
    bursts: [0, 180, 360],
  },

  boombox: {
    tool: 'boombox',
    shape: 'ripple',
    juice: juice('tool.boombox', 'Boombox', 'boombox.bass', 'boombox_bass_drop', { shake: 0.85, squash: 0.6, hitStopMs: 30, rateLimitMs: 400 }),
    sprites: [
      sprite('boombox.bass', 'Bass rings', 'Thick purple rings pulsing out on every beat.', ['#8a3cff', '#b57bff', '#4b1a99'], {
        count: 2, size: 2.4, lifeMs: 800, speed: 9, spread: 0, gravity: 0, additive: true, drag: 2, fade: 'quad', shrink: 0,
      }),
      sprite('boombox.dust', 'Floor dust', 'Dust hopping off the floor with the bass.', ['#b8a6d9', '#7d6aa8'], {
        count: 30, size: 0.18, lifeMs: 500, speed: 4, spread: 0.9, gravity: 14, drag: 1, shrink: 0.4,
      }),
    ],
    squashCurve: [[0, 1], [50, 0.7], [140, 1.2], [260, 0.9], [400, 1]],
    bursts: [0, 250, 500, 750],
  },

  flashlight: {
    tool: 'flashlight',
    shape: 'cone',
    juice: juice('tool.flashlight', 'Flashlight', 'flashlight.motes', 'torch_click_soft', { shake: 0, squash: 0.05, hitStopMs: 0, rateLimitMs: 300 }),
    sprites: [
      sprite('flashlight.cone', 'Light cone', 'A soft additive cone of warm light.', ['#fff4d6', '#ffe9b0'], {
        count: 1, size: 5, lifeMs: 1500, speed: 0, spread: 0.25, additive: true, drag: 0, shrink: 0,
      }),
      sprite('flashlight.motes', 'Dust motes', 'Slow motes drifting inside the beam.', ['#fff8e6', '#ffe9b0'], {
        count: 18, size: 0.08, lifeMs: 2400, speed: 0.4, spread: 0.25, gravity: -0.2, additive: true, drag: 0.5, fade: 'quad', shrink: 0,
      }),
    ],
    squashCurve: [[0, 1], [120, 1.03], [300, 1]],
    bursts: [0],
  },

  zapGun: {
    tool: 'zapGun',
    shape: 'beam',
    juice: juice('tool.zapGun', 'Zap gun', 'zapGun.bolt', 'zap_crackle', { shake: 0.4, squash: 0.35, hitStopMs: 60, rateLimitMs: 250 }),
    sprites: [
      sprite('zapGun.bolt', 'Zigzag bolt', 'A jagged cyan bolt from muzzle to target.', ['#00e5ff', '#bff9ff', '#ffffff'], {
        count: 14, size: 0.25, lifeMs: 160, speed: 28, spread: 0.12, additive: true, drag: 0, fade: 'quad', shrink: 0.2,
      }),
      sprite('zapGun.sparks', 'Impact sparks', 'Sparks bouncing off the hit point.', ['#00e5ff', '#ffffff'], {
        count: 26, size: 0.1, lifeMs: 380, speed: 12, spread: 1, gravity: 20, additive: true, drag: 2, shrink: 0.8,
      }),
    ],
    squashCurve: [[0, 1], [30, 0.85], [120, 1.1], [240, 1]],
    bursts: [0, 60],
  },

  camera: {
    tool: 'camera',
    shape: 'stamp',
    juice: juice('tool.camera', 'Camera', 'camera.flash', 'camera_click', { shake: 0.1, squash: 0.1, hitStopMs: 40, rateLimitMs: 600 }),
    sprites: [
      sprite('camera.flash', 'Flash square', 'A single white square that pops and fades fast.', ['#ffffff'], {
        count: 1, size: 3, lifeMs: 180, speed: 0, spread: 0, additive: true, drag: 0, fade: 'quad', shrink: 0,
      }),
      sprite('camera.afterglow', 'Afterglow specks', 'Tiny specks lingering after the flash.', ['#ffffff', '#f2f2ff'], {
        count: 8, size: 0.1, lifeMs: 450, speed: 1, spread: 1, additive: true, drag: 3, shrink: 1,
      }),
    ],
    squashCurve: [[0, 1], [40, 0.94], [120, 1.02], [200, 1]],
    bursts: [0],
  },

  windupKey: {
    tool: 'windupKey',
    shape: 'rings',
    juice: juice('tool.windupKey', 'Wind-up key', 'windupKey.spring', 'ratchet_spring', { shake: 0.2, squash: 0.4, hitStopMs: 0, rateLimitMs: 700 }),
    sprites: [
      sprite('windupKey.tick', 'Ratchet tick', 'A small brass ring clicking out on each turn.', ['#c9a14a', '#e6c77a'], {
        count: 1, size: 0.7, lifeMs: 200, speed: 3, spread: 0, additive: false, drag: 4, fade: 'quad', shrink: 0,
      }),
      sprite('windupKey.spring', 'Spring burst', 'The wound spring lets go in a big brass ring with glints.', ['#c9a14a', '#e6c77a', '#fff0c2'], {
        count: 40, size: 0.22, lifeMs: 700, speed: 10, spread: 1, gravity: 6, additive: true, drag: 2.5, shrink: 0.6,
      }),
    ],
    squashCurve: [
      [0, 1], [60, 0.95], [150, 1], [210, 0.94], [300, 1], [360, 0.92],
      [480, 0.88], [560, 1.3], [700, 0.95], [820, 1],
    ],
    bursts: [0, 150, 300, 520],
  },

  spade: {
    tool: 'spade',
    shape: 'stamp',
    juice: juice('tool.spade', 'Spade', 'spade.clods', 'dirt_thud', { shake: 0.5, squash: 0.8, hitStopMs: 45, rateLimitMs: 350 }),
    sprites: [
      sprite('spade.clods', 'Dirt clods', 'Chunky clods flung up and falling back.', ['#7a4a22', '#5c3517', '#9b6a3c'], {
        count: 16, size: 0.35, lifeMs: 900, speed: 9, spread: 0.6, gravity: 24, drag: 0.5, shrink: 0.1,
      }),
      sprite('spade.dust', 'Dirt dust', 'A brown puff at the dig spot.', ['#a07a55', '#7a5a3a'], {
        count: 20, size: 0.5, lifeMs: 700, speed: 2, spread: 1, gravity: -0.5, drag: 4, shrink: 0.3,
      }),
    ],
    squashCurve: [[0, 1], [120, 0.55], [200, 1.2], [320, 0.95], [440, 1]],
    bursts: [120, 160],
  },

  fairyWand: {
    tool: 'fairyWand',
    shape: 'confetti',
    juice: juice('tool.fairyWand', 'Fairy wand', 'fairyWand.stars', 'wand_twinkle', { shake: 0.08, squash: 0.3, hitStopMs: 0, rateLimitMs: 200 }),
    sprites: [
      sprite('fairyWand.stars', 'Stars', 'Pastel stars tumbling out of the wand tip.', ['#ffb3ba', '#ffdfba', '#ffffba', '#baffc9', '#bae1ff', '#d7baff'], {
        count: 30, size: 0.3, lifeMs: 1100, speed: 6, spread: 1, gravity: 3, additive: false, drag: 2, shrink: 0.5,
      }),
      sprite('fairyWand.sparkles', 'Sparkles', 'Tiny additive twinkles.', ['#ffffff', '#fff6fb'], {
        count: 40, size: 0.08, lifeMs: 600, speed: 3, spread: 1, gravity: -1, additive: true, drag: 3, fade: 'quad', shrink: 1,
      }),
    ],
    squashCurve: [[0, 1], [80, 1.12], [260, 0.97], [420, 1]],
    bursts: [0, 80, 160],
  },
};

export const TOOL_JUICE: Readonly<Record<ToolId, ToolJuice>> = Object.freeze(DATA);

// ---------------------------------------------------------------------------
// Validator
// ---------------------------------------------------------------------------

const HEX = /^#[0-9a-fA-F]{6}$/;
const SQUASH_MIN = 0.5;
const SQUASH_MAX = 1.6;
const BURST_MAX_MS = 2000;

function inRange(where: string, key: string, v: number, out: string[]): void {
  const r = RANGES[key];
  if (r === undefined) {
    out.push(`${where}: no range for ${key}`);
    return;
  }
  if (!Number.isFinite(v) || v < r[0] || v > r[1]) out.push(`${where}.${key} = ${v} outside [${r[0]}, ${r[1]}]`);
}

/** Problems: any number outside RANGES, a colour not #rrggbb, juice.sprite not among its sprites (or null), squash keys not in time order or y outside 0.5..1.6, a curve that does not start and end at y = 1, bursts not ascending or beyond 2000 ms. */
export function check(t: ToolJuice): string[] {
  const out: string[] = [];
  const w = t.tool;

  // juice numbers
  inRange(`${w}.juice`, 'shake', t.juice.shake, out);
  inRange(`${w}.juice`, 'squash', t.juice.squash, out);
  inRange(`${w}.juice`, 'hitStopMs', t.juice.hitStopMs, out);
  inRange(`${w}.juice`, 'rateLimitMs', t.juice.rateLimitMs, out);

  // sprites
  const ids = new Set<string>();
  for (const s of t.sprites) {
    const sw = `${w}.sprite[${s.id}]`;
    if (ids.has(s.id)) out.push(`${sw}: duplicate sprite id`);
    ids.add(s.id);
    inRange(sw, 'count', s.count, out);
    inRange(sw, 'size', s.size, out);
    inRange(sw, 'lifeMs', s.lifeMs, out);
    inRange(sw, 'speed', s.speed, out);
    inRange(sw, 'spread', s.spread, out);
    inRange(sw, 'gravity', s.gravity, out);
    inRange(sw, 'drag', s.drag, out);
    inRange(sw, 'shrink', s.shrink, out);
    if (s.colors.length === 0) out.push(`${sw}: no colours`);
    for (const c of s.colors) if (!HEX.test(c)) out.push(`${sw}: colour "${c}" is not #rrggbb`);
  }

  // sprite reference
  if (t.juice.sprite !== null && !ids.has(t.juice.sprite)) {
    out.push(`${w}.juice.sprite "${t.juice.sprite}" is not one of its sprites`);
  }

  // squash curve
  const c = t.squashCurve;
  if (c.length < 2) out.push(`${w}.squashCurve: needs at least two keys`);
  let prevMs = -Infinity;
  for (const [ms, y] of c) {
    if (!Number.isFinite(ms) || ms <= prevMs) out.push(`${w}.squashCurve: key at ${ms} ms is not in time order`);
    if (!Number.isFinite(y) || y < SQUASH_MIN || y > SQUASH_MAX) out.push(`${w}.squashCurve: y ${y} at ${ms} ms outside ${SQUASH_MIN}..${SQUASH_MAX}`);
    prevMs = ms;
  }
  const first = c[0];
  const last = c[c.length - 1];
  if (first !== undefined && first[1] !== 1) out.push(`${w}.squashCurve: starts at y ${first[1]}, not 1`);
  if (last !== undefined && last[1] !== 1) out.push(`${w}.squashCurve: ends at y ${last[1]}, not 1`);

  // bursts
  if (t.bursts.length === 0) out.push(`${w}.bursts: none`);
  let prevB = -Infinity;
  for (const b of t.bursts) {
    if (!Number.isFinite(b) || b <= prevB) out.push(`${w}.bursts: ${b} ms is not ascending`);
    if (b < 0 || b > BURST_MAX_MS) out.push(`${w}.bursts: ${b} ms outside 0..${BURST_MAX_MS}`);
    prevB = b;
  }

  return out;
}

// ---------------------------------------------------------------------------
// Timeline helpers
// ---------------------------------------------------------------------------

/** Goblin y scale at ms (linear between keys, 1 outside). */
export function squashAt(t: ToolJuice, ms: number): number {
  const c = t.squashCurve;
  const first = c[0];
  const last = c[c.length - 1];
  if (first === undefined || last === undefined) return 1;
  if (!(ms >= first[0]) || ms > last[0]) return 1;
  for (let i = 1; i < c.length; i++) {
    const a = c[i - 1];
    const b = c[i];
    if (a === undefined || b === undefined) continue;
    if (ms <= b[0]) {
      const span = b[0] - a[0];
      if (span <= 0) return b[1];
      return a[1] + (b[1] - a[1]) * ((ms - a[0]) / span);
    }
  }
  return first[1]; // single-key curve, ms equals its time
}

/** Which bursts fire between two times (from exclusive, to inclusive), for a frame-stepped player. */
export function burstsBetween(t: ToolJuice, fromMs: number, toMs: number): number[] {
  return t.bursts.filter((b) => b > fromMs && b <= toMs);
}

/** One line for a tooltip, e.g. "Zap gun: cyan beam, hit-stop 60 ms, shake 0.4". */
export function describe(t: ToolJuice): string {
  const parts = [`${t.juice.name}: ${COLOUR_WORDS[t.tool]} ${t.shape}`];
  if (t.juice.hitStopMs > 0) parts.push(`hit-stop ${t.juice.hitStopMs} ms`);
  parts.push(t.juice.shake > 0 ? `shake ${t.juice.shake}` : 'no shake');
  return parts.join(', ');
}