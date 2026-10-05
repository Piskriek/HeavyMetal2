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

export const RANGES: { readonly [k: string]: readonly [number, number] } = {
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
};

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

export const TOOL_IDS: readonly ToolId[] = [
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
];

export interface ToolJuice {
  tool: ToolId;
  shape: Shape;
  juice: Juice;
  sprites: Sprite[];
  squashCurve: [number, number][];
  bursts: number[];
}

export const TOOL_JUICE: Readonly<Record<ToolId, ToolJuice>> = {
  magnet: {
    tool: 'magnet',
    shape: 'beam',
    juice: {
      id: 'j_magnet',
      name: 'Magnet',
      sprite: 'sp_magnet',
      sound: 'magnet_hum',
      shake: 0.25,
      squash: 0.2,
      hitStopMs: 0,
      rateLimitMs: 200,
    },
    sprites: [
      {
        id: 'sp_magnet',
        name: 'Magnetic Sparks',
        doc: 'blue and red',
        count: 40,
        colors: ['#1e90ff', '#ff3344'],
        size: 1.2,
        lifeMs: 350,
        speed: 14,
        spread: 0.25,
        gravity: -4,
        additive: true,
        drag: 4,
        fade: 'linear',
        shrink: 0.8,
      },
    ],
    squashCurve: [
      [0, 1],
      [60, 1.18],
      [140, 0.9],
      [220, 1],
    ],
    bursts: [0, 60, 120],
  },
  can: {
    tool: 'can',
    shape: 'cone',
    juice: {
      id: 'j_can',
      name: 'Paint can',
      sprite: 'sp_can',
      sound: 'spray_hiss',
      shake: 0.08,
      squash: 0.15,
      hitStopMs: 0,
      rateLimitMs: 150,
    },
    sprites: [
      {
        id: 'sp_can',
        name: 'Paint Spray Mist',
        doc: 'paint',
        count: 60,
        colors: ['#ff66aa'],
        size: 0.8,
        lifeMs: 450,
        speed: 8,
        spread: 0.45,
        gravity: 6,
        additive: false,
        drag: 6,
        fade: 'quad',
        shrink: 0.3,
      },
    ],
    squashCurve: [
      [0, 1],
      [40, 0.92],
      [100, 1.06],
      [180, 1],
    ],
    bursts: [0, 50, 100],
  },
  rollingPin: {
    tool: 'rollingPin',
    shape: 'ripple',
    juice: {
      id: 'j_rollingPin',
      name: 'Rolling pin',
      sprite: 'sp_rollingPin',
      sound: 'roll_thud',
      shake: 0.35,
      squash: 0.4,
      hitStopMs: 0,
      rateLimitMs: 300,
    },
    sprites: [
      {
        id: 'sp_rollingPin',
        name: 'Dough Dust Rings',
        doc: 'dusty beige',
        count: 45,
        colors: ['#d2b48c', '#e6dac3'],
        size: 1.6,
        lifeMs: 500,
        speed: 6,
        spread: 0.8,
        gravity: 8,
        additive: false,
        drag: 5,
        fade: 'linear',
        shrink: 0.5,
      },
    ],
    squashCurve: [
      [0, 1],
      [70, 0.65],
      [160, 1.15],
      [260, 1],
    ],
    bursts: [0, 90],
  },
  baton: {
    tool: 'baton',
    shape: 'rings',
    juice: {
      id: 'j_baton',
      name: 'Baton',
      sprite: 'sp_baton',
      sound: 'chime_twirl',
      shake: 0.1,
      squash: 0.25,
      hitStopMs: 0,
      rateLimitMs: 250,
    },
    sprites: [
      {
        id: 'sp_baton',
        name: 'Music Note Rings',
        doc: 'gold',
        count: 32,
        colors: ['#ffd700', '#ffea70'],
        size: 1.8,
        lifeMs: 650,
        speed: 5,
        spread: 0.6,
        gravity: -8,
        additive: true,
        drag: 2,
        fade: 'quad',
        shrink: 0.4,
      },
    ],
    squashCurve: [
      [0, 1],
      [60, 1.2],
      [140, 0.94],
      [220, 1],
    ],
    bursts: [0, 75, 150],
  },
  boombox: {
    tool: 'boombox',
    shape: 'ripple',
    juice: {
      id: 'j_boombox',
      name: 'Boombox',
      sprite: 'sp_boombox',
      sound: 'bass_drop',
      shake: 0.95,
      squash: 0.6,
      hitStopMs: 0,
      rateLimitMs: 400,
    },
    sprites: [
      {
        id: 'sp_boombox',
        name: 'Bass Shockwaves',
        doc: 'purple',
        count: 85,
        colors: ['#9933ff', '#cc66ff', '#4b0082'],
        size: 2.5,
        lifeMs: 600,
        speed: 10,
        spread: 0.9,
        gravity: 2,
        additive: true,
        drag: 3,
        fade: 'quad',
        shrink: 0.2,
      },
    ],
    squashCurve: [
      [0, 1],
      [50, 0.6],
      [120, 1.35],
      [200, 0.85],
      [300, 1],
    ],
    bursts: [0, 120, 240],
  },
  flashlight: {
    tool: 'flashlight',
    shape: 'cone',
    juice: {
      id: 'j_flashlight',
      name: 'Flashlight',
      sprite: 'sp_flashlight',
      sound: 'click_beam',
      shake: 0,
      squash: 0.05,
      hitStopMs: 0,
      rateLimitMs: 100,
    },
    sprites: [
      {
        id: 'sp_flashlight',
        name: 'Light Dust Motes',
        doc: 'warm white',
        count: 24,
        colors: ['#fff8e7', '#fffaed'],
        size: 0.6,
        lifeMs: 800,
        speed: 2,
        spread: 0.35,
        gravity: -1,
        additive: true,
        drag: 1,
        fade: 'linear',
        shrink: 0.1,
      },
    ],
    squashCurve: [
      [0, 1],
      [30, 1.03],
      [80, 0.98],
      [140, 1],
    ],
    bursts: [0],
  },
  zapGun: {
    tool: 'zapGun',
    shape: 'beam',
    juice: {
      id: 'j_zapGun',
      name: 'Zap gun',
      sprite: 'sp_zapGun',
      sound: 'zap_laser',
      shake: 0.4,
      squash: 0,
      hitStopMs: 60,
      rateLimitMs: 350,
    },
    sprites: [
      {
        id: 'sp_zapGun',
        name: 'Lightning Bolt Sparks',
        doc: 'cyan',
        count: 50,
        colors: ['#00ffff', '#70ffff'],
        size: 1.4,
        lifeMs: 250,
        speed: 22,
        spread: 0.15,
        gravity: 0,
        additive: true,
        drag: 8,
        fade: 'linear',
        shrink: 0.9,
      },
    ],
    squashCurve: [
      [0, 1],
      [30, 0.85],
      [90, 1.2],
      [180, 1],
    ],
    bursts: [0],
  },
  camera: {
    tool: 'camera',
    shape: 'stamp',
    juice: {
      id: 'j_camera',
      name: 'Camera',
      sprite: 'sp_camera',
      sound: 'shutter_click',
      shake: 0.2,
      squash: 0.1,
      hitStopMs: 0,
      rateLimitMs: 300,
    },
    sprites: [
      {
        id: 'sp_camera',
        name: 'Flash Square',
        doc: 'white',
        count: 16,
        colors: ['#ffffff', '#f0f0f0'],
        size: 3.5,
        lifeMs: 200,
        speed: 5,
        spread: 0.1,
        gravity: 0,
        additive: true,
        drag: 10,
        fade: 'linear',
        shrink: 0.7,
      },
    ],
    squashCurve: [
      [0, 1],
      [40, 0.92],
      [100, 1.04],
      [160, 1],
    ],
    bursts: [0],
  },
  windupKey: {
    tool: 'windupKey',
    shape: 'rings',
    juice: {
      id: 'j_windupKey',
      name: 'Windup key',
      sprite: 'sp_windupKey',
      sound: 'ratchet_spring',
      shake: 0.3,
      squash: 0.45,
      hitStopMs: 0,
      rateLimitMs: 500,
    },
    sprites: [
      {
        id: 'sp_windupKey',
        name: 'Ratchet Spring Sparks',
        doc: 'brass',
        count: 42,
        colors: ['#b5a642', '#d4af37', '#e1c16e'],
        size: 1.1,
        lifeMs: 400,
        speed: 11,
        spread: 0.7,
        gravity: 12,
        additive: true,
        drag: 4,
        fade: 'linear',
        shrink: 0.6,
      },
    ],
    squashCurve: [
      [0, 1],
      [50, 0.9],
      [100, 1.05],
      [150, 0.88],
      [220, 1.3],
      [320, 1],
    ],
    bursts: [0, 80, 160, 260],
  },
  spade: {
    tool: 'spade',
    shape: 'stamp',
    juice: {
      id: 'j_spade',
      name: 'Spade',
      sprite: 'sp_spade',
      sound: 'shovel_dig',
      shake: 0.5,
      squash: 0.75,
      hitStopMs: 0,
      rateLimitMs: 350,
    },
    sprites: [
      {
        id: 'sp_spade',
        name: 'Dirt Clods',
        doc: 'brown',
        count: 55,
        colors: ['#8b4513', '#a0522d', '#5c2c16'],
        size: 2.0,
        lifeMs: 600,
        speed: 14,
        spread: 0.5,
        gravity: 28,
        additive: false,
        drag: 3,
        fade: 'linear',
        shrink: 0.4,
      },
    ],
    squashCurve: [
      [0, 1],
      [80, 0.55],
      [170, 1.25],
      [280, 1],
    ],
    bursts: [0, 100],
  },
  fairyWand: {
    tool: 'fairyWand',
    shape: 'confetti',
    juice: {
      id: 'j_fairyWand',
      name: 'Fairy wand',
      sprite: 'sp_fairyWand',
      sound: 'fairy_sparkle',
      shake: 0.15,
      squash: 0.35,
      hitStopMs: 0,
      rateLimitMs: 250,
    },
    sprites: [
      {
        id: 'sp_fairyWand',
        name: 'Rainbow Sparkles',
        doc: 'pastel rainbow',
        count: 75,
        colors: ['#ffb3ba', '#ffdfba', '#ffffba', '#baffc9', '#bae1ff'],
        size: 1.3,
        lifeMs: 700,
        speed: 7,
        spread: 0.85,
        gravity: -3,
        additive: true,
        drag: 2,
        fade: 'quad',
        shrink: 0.6,
      },
    ],
    squashCurve: [
      [0, 1],
      [60, 1.25],
      [130, 0.92],
      [220, 1],
    ],
    bursts: [0, 50, 100, 150],
  },
};

const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;

export function check(t: ToolJuice): string[] {
  const problems: string[] = [];

  const checkRange = (key: string, val: number, ctx: string): void => {
    const range = RANGES[key];
    if (range) {
      const [min, max] = range;
      if (typeof val !== 'number' || Number.isNaN(val) || val < min || val > max) {
        problems.push(`${ctx}: ${key} value ${val} outside [${min}, ${max}]`);
      }
    }
  };

  const spriteIds: string[] = [];
  for (let i = 0; i < t.sprites.length; i++) {
    const s = t.sprites[i];
    if (!s) continue;
    spriteIds.push(s.id);
    const sCtx = `sprite[${s.id}]`;
    checkRange('count', s.count, sCtx);
    checkRange('size', s.size, sCtx);
    checkRange('lifeMs', s.lifeMs, sCtx);
    checkRange('speed', s.speed, sCtx);
    checkRange('spread', s.spread, sCtx);
    checkRange('gravity', s.gravity, sCtx);
    checkRange('drag', s.drag, sCtx);
    checkRange('shrink', s.shrink, sCtx);

    for (let c = 0; c < s.colors.length; c++) {
      const col = s.colors[c];
      if (!col || !HEX_COLOR_REGEX.test(col)) {
        problems.push(`${sCtx}: color "${col}" is not in #rrggbb format`);
      }
    }
  }

  const jCtx = `juice[${t.juice.id}]`;
  checkRange('shake', t.juice.shake, jCtx);
  checkRange('squash', t.juice.squash, jCtx);
  checkRange('hitStopMs', t.juice.hitStopMs, jCtx);
  checkRange('rateLimitMs', t.juice.rateLimitMs, jCtx);

  if (t.juice.sprite !== null && !spriteIds.includes(t.juice.sprite)) {
    problems.push(`juice.sprite "${t.juice.sprite}" is not among sprites: [${spriteIds.join(', ')}]`);
  }

  const curve = t.squashCurve;
  if (!Array.isArray(curve) || curve.length < 2) {
    problems.push('squashCurve must have at least 2 keys');
  } else {
    const first = curve[0];
    const last = curve[curve.length - 1];

    if (!first || first[1] !== 1) {
      problems.push('squashCurve must start at y = 1');
    }
    if (!last || last[1] !== 1) {
      problems.push('squashCurve must end at y = 1');
    }

    for (let i = 0; i < curve.length; i++) {
      const key = curve[i];
      if (!key) continue;
      const [ms, y] = key;
      if (typeof y !== 'number' || Number.isNaN(y) || y < 0.5 || y > 1.6) {
        problems.push(`squash key ${i} y value ${y} outside [0.5, 1.6]`);
      }
      if (i > 0) {
        const prev = curve[i - 1];
        if (prev && ms <= prev[0]) {
          problems.push(`squash keys not in time order: key ${i} (${ms}ms) <= key ${i - 1} (${prev[0]}ms)`);
        }
      }
    }
  }

  for (let i = 0; i < t.bursts.length; i++) {
    const b = t.bursts[i];
    if (typeof b !== 'number' || Number.isNaN(b) || b < 0 || b > 2000) {
      problems.push(`burst ${i} time ${b} outside [0, 2000] ms`);
    }
    if (i > 0) {
      const prev = t.bursts[i - 1];
      if (prev !== undefined && b <= prev) {
        problems.push(`bursts not ascending: burst ${i} (${b}ms) <= burst ${i - 1} (${prev}ms)`);
      }
    }
  }

  return problems;
}

export function squashAt(t: ToolJuice, ms: number): number {
  const curve = t.squashCurve;
  if (curve.length === 0) return 1;
  const first = curve[0];
  const last = curve[curve.length - 1];
  if (!first || !last) return 1;
  if (ms <= first[0]) return first[1];
  if (ms >= last[0]) return last[1];

  for (let i = 0; i < curve.length - 1; i++) {
    const p0 = curve[i];
    const p1 = curve[i + 1];
    if (!p0 || !p1) continue;
    const [t0, y0] = p0;
    const [t1, y1] = p1;
    if (ms >= t0 && ms <= t1) {
      if (t1 === t0) return y0;
      const progress = (ms - t0) / (t1 - t0);
      return y0 + (y1 - y0) * progress;
    }
  }
  return 1;
}

export function burstsBetween(t: ToolJuice, fromMs: number, toMs: number): number[] {
  return t.bursts.filter(b => b > fromMs && b <= toMs);
}

export function describe(t: ToolJuice): string {
  const parts: string[] = [];
  const color = t.sprites[0]?.doc;
  parts.push(color ? `${color} ${t.shape}` : t.shape);

  if (t.juice.hitStopMs > 0) {
    parts.push(`hit-stop ${t.juice.hitStopMs} ms`);
  }
  if (t.juice.shake > 0) {
    parts.push(`shake ${t.juice.shake}`);
  }
  if (t.juice.squash > 0) {
    parts.push(`squash ${t.juice.squash}`);
  }

  return `${t.juice.name}: ${parts.join(', ')}`;
}