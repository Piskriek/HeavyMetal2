import type { VariableDef } from '@hm/contracts';

/**
 * Plugs: a hotbar button (a tool preset) has plug points, moments where it can set other presets off. "+ attribute" on a tool lists every
 * plug point and the kinds of preset that fit it; picking one adds a plug that names a preset (a sprite burst, a sound, a goblin animation, a
 * camera shake), and that preset is itself editable. Pure data and checks; the island plays them.
 */
export type PlugEvent = 'use' | 'opposite' | 'pick' | 'release';
export type PlugKind = 'sprite' | 'sound' | 'anim' | 'shake';

export interface ToolPlug {
  readonly on: PlugEvent;
  readonly kind: PlugKind;
  /** The id of the preset it plays (a sprite, sound, animation or shake id). */
  readonly ref: string;
  /** How strongly it plays: 1 = as made (more sprites, louder, bigger shake). */
  readonly amount: number;
}

export interface PlugPoint { readonly on: PlugEvent; readonly label: string; readonly doc: string; readonly accepts: readonly PlugKind[] }
export const PLUG_POINTS: readonly PlugPoint[] = [
  { on: 'use', label: 'On use', doc: 'Every time the left button does its job.', accepts: ['sprite', 'sound', 'anim', 'shake'] },
  { on: 'opposite', label: 'On right click', doc: 'When the right button does the opposite.', accepts: ['sprite', 'sound', 'anim', 'shake'] },
  { on: 'pick', label: 'When you pick it', doc: 'When you choose this slot on the hotbar.', accepts: ['sprite', 'sound', 'anim'] },
  { on: 'release', label: 'When you let go', doc: 'When you let go of the button after using it.', accepts: ['sprite', 'sound', 'anim', 'shake'] },
];
export const PLUG_KINDS: Readonly<Record<PlugKind, { readonly label: string; readonly doc: string; readonly fallback: string }>> = {
  sprite: { label: 'Sprite', doc: 'A burst of little bits where you aim.', fallback: 'pop' },
  sound: { label: 'Sound', doc: 'A sound.', fallback: 'select' },
  anim: { label: 'Animation', doc: 'Your goblin does a move (not in studio mode, there is no goblin).', fallback: 'swing' },
  shake: { label: 'Camera shake', doc: 'The view shakes a little.', fallback: 'tap' },
};
/** More than this many plugs on one tool is refused (each one plays on every use). */
export const MAX_PLUGS = 12;

const EVENTS = PLUG_POINTS.map((p) => p.on);
const KINDS = Object.keys(PLUG_KINDS) as PlugKind[];
const pointOf = (on: PlugEvent): PlugPoint => PLUG_POINTS.find((p) => p.on === on)!;

/** The plugs a tool has when nobody changed them: its sprite and sound on use, and the goblin's swing for tools that work on the world. */
export const defaultPlugs = (sprite: string, sound: string, anim?: string): ToolPlug[] => [
  { on: 'use', kind: 'sprite', ref: sprite, amount: 1 },
  { on: 'use', kind: 'sound', ref: sound, amount: 1 },
  ...(anim ? [{ on: 'use' as const, kind: 'anim' as const, ref: anim, amount: 1 }] : []),
];

/** A stored list of plugs, cleaned (bad entries dropped, amounts clamped, at most MAX_PLUGS). Null when it is not a list at all. Never throws. */
export function normalizePlugs(v: unknown): ToolPlug[] | null {
  if (!Array.isArray(v)) return null;
  const out: ToolPlug[] = [];
  for (const x of v) {
    if (!x || typeof x !== 'object') continue;
    const o = x as Record<string, unknown>;
    const on = o.on as PlugEvent, kind = o.kind as PlugKind;
    if (!EVENTS.includes(on) || !KINDS.includes(kind) || !pointOf(on).accepts.includes(kind)) continue;
    const ref = typeof o.ref === 'string' && o.ref.trim() ? o.ref.trim().slice(0, 60) : PLUG_KINDS[kind].fallback;
    const a = Number(o.amount);
    out.push({ on, kind, ref, amount: Number.isFinite(a) ? Math.min(4, Math.max(0, a)) : 1 });
    if (out.length >= MAX_PLUGS) break;
  }
  return out;
}

export type PlugRefusal = 'not-accepted' | 'too-many';
/** Add a plug (a new attribute). Refuses kinds the point does not take and lists that are full. */
export function addPlug(plugs: readonly ToolPlug[], on: PlugEvent, kind: PlugKind, ref?: string): { plugs: ToolPlug[]; refused?: PlugRefusal } {
  if (!pointOf(on)?.accepts.includes(kind)) return { plugs: [...plugs], refused: 'not-accepted' };
  if (plugs.length >= MAX_PLUGS) return { plugs: [...plugs], refused: 'too-many' };
  return { plugs: [...plugs, { on, kind, ref: ref ?? PLUG_KINDS[kind].fallback, amount: 1 }] };
}
export const removePlug = (plugs: readonly ToolPlug[], i: number): ToolPlug[] => plugs.filter((_, k) => k !== i);
export function changePlug(plugs: readonly ToolPlug[], i: number, patch: Partial<Pick<ToolPlug, 'ref' | 'amount' | 'on'>>): ToolPlug[] {
  return plugs.map((p, k) => {
    if (k !== i) return p;
    const on = patch.on && pointOf(patch.on)?.accepts.includes(p.kind) ? patch.on : p.on;
    const amount = patch.amount === undefined || !Number.isFinite(patch.amount) ? p.amount : Math.min(4, Math.max(0, patch.amount));
    return { ...p, on, amount, ref: patch.ref && patch.ref.trim() ? patch.ref.trim() : p.ref };
  });
}
/** What plays for a moment, in order. */
export const plugsFor = (plugs: readonly ToolPlug[], on: PlugEvent): ToolPlug[] => plugs.filter((p) => p.on === on);

/** "+ attribute": every plug point with the kinds that fit it (all of them while the list has room). */
export function addable(plugs: readonly ToolPlug[]): { readonly point: PlugPoint; readonly kinds: readonly PlugKind[] }[] {
  if (plugs.length >= MAX_PLUGS) return [];
  return PLUG_POINTS.map((point) => ({ point, kinds: point.accepts }));
}

/** One line for a plug, for the screen: "On use: sprite Dust". */
export function plugLine(p: ToolPlug, name: (kind: PlugKind, ref: string) => string = (_k, r) => r): string {
  return `${pointOf(p.on).label}: ${PLUG_KINDS[p.kind].label.toLowerCase()} ${name(p.kind, p.ref)}${p.amount !== 1 ? ` x${Math.round(p.amount * 100) / 100}` : ''}`;
}

/* ------------------------------ sprite presets (the bursts) ------------------------------ */

export interface SpritePreset {
  readonly id: string;
  readonly name: string;
  /** How many bits fly out. */
  readonly count: number;
  readonly colorA: string;
  readonly colorB: string;
  readonly colorC: string;
  /** Size of one bit (metres at 1). */
  readonly size: number;
  readonly lifeMs: number;
  /** How fast they fly out (m/s). */
  readonly speed: number;
  /** 0 = straight up the surface normal, 1 = every direction of the half sphere. */
  readonly spread: number;
  /** Pulls them down (m/s2); negative floats them up. */
  readonly gravity: number;
  /** Glowing bits add light instead of covering. */
  readonly glow: boolean;
}

const sp = (id: string, name: string, count: number, colors: readonly [string, string, string], size: number, lifeMs: number, speed: number, spread: number, gravity: number, glow = false): SpritePreset =>
  ({ id, name, count, colorA: colors[0], colorB: colors[1], colorC: colors[2], size, lifeMs, speed, spread, gravity, glow });
export const SPRITE_PRESETS: readonly SpritePreset[] = [
  sp('dust', 'Dust', 26, ['#e3d3ad', '#cdbb93', '#f3e8cc'], 1.1, 650, 3.2, 0.9, -0.6),
  sp('sparkle', 'Sparkle', 22, ['#ffe7a1', '#ffb86b', '#ffffff'], 0.7, 800, 4.2, 1, 3, true),
  sp('debris', 'Debris', 18, ['#8a6a46', '#6e5a3e', '#a58760'], 0.55, 900, 5.2, 0.7, 14),
  sp('pop', 'Pop', 30, ['#ff2e88', '#ffd24a', '#7bd88f'], 0.8, 700, 6, 1, 6),
  sp('leaf', 'Leaves', 20, ['#5fa05a', '#7fc06a', '#3f7a42'], 0.7, 1100, 3.6, 1, 2.5),
  sp('splash', 'Splash', 24, ['#bfe7f2', '#8fd0e4', '#ffffff'], 0.8, 700, 4.6, 0.85, 12),
  sp('confetti', 'Confetti', 60, ['#ff2e88', '#6ab7ff', '#ffd24a'], 0.6, 1600, 7, 1, 4),
  sp('embers', 'Embers', 16, ['#ff7a2e', '#ffcf5a', '#ff3d1f'], 0.45, 1400, 2.4, 0.5, -2, true),
  sp('smoke', 'Smoke puff', 14, ['#9a9a96', '#c8c8c2', '#6e6e6a'], 1.8, 1300, 1.6, 0.8, -1.4),
  sp('stars', 'Stars', 12, ['#ffffff', '#fff3b0', '#b9e3ff'], 0.9, 900, 3, 1, 0, true),
];
export const spritePresetById = (id: string): SpritePreset | undefined => SPRITE_PRESETS.find((s) => s.id === id);

const hex = (v: unknown, d: string): string => (typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v) ? v.toLowerCase() : d);
const num = (v: unknown, d: number, lo: number, hi: number): number => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);

/** A ready-made sprite with the player's changes on top. Unknown ids fall back to Pop. Never throws. */
export function normalizeSprite(id: string, overrides: unknown): SpritePreset {
  const base = spritePresetById(id) ?? spritePresetById('pop')!;
  const o = overrides && typeof overrides === 'object' && !Array.isArray(overrides) ? (overrides as Record<string, unknown>) : {};
  return {
    ...base,
    name: typeof o.name === 'string' && o.name.trim() ? o.name.trim().slice(0, 40) : base.name,
    count: Math.round(num(o.count, base.count, 1, 400)),
    colorA: hex(o.colorA, base.colorA), colorB: hex(o.colorB, base.colorB), colorC: hex(o.colorC, base.colorC),
    size: num(o.size, base.size, 0.02, 20), lifeMs: num(o.lifeMs, base.lifeMs, 50, 10000), speed: num(o.speed, base.speed, 0, 80),
    spread: num(o.spread, base.spread, 0, 1), gravity: num(o.gravity, base.gravity, -100, 100), glow: typeof o.glow === 'boolean' ? o.glow : base.glow,
  };
}

export const SPRITE_VARIABLES: readonly VariableDef[] = [
  { key: 'name', type: 'string', label: 'Name', doc: 'What the burst is called.', tier: 'play', default: 'Pop', group: 'Sprite' },
  { key: 'count', type: 'int', label: 'How many', doc: 'How many bits fly out.', tier: 'play', default: 30, min: 1, max: 120, step: 1, hardMin: 1, hardMax: 400, group: 'Sprite' },
  { key: 'colorA', type: 'color', label: 'Colour 1', doc: 'Bits pick one of three colours.', tier: 'play', default: '#ff2e88', group: 'Sprite' },
  { key: 'colorB', type: 'color', label: 'Colour 2', doc: 'Bits pick one of three colours.', tier: 'play', default: '#ffd24a', group: 'Sprite' },
  { key: 'colorC', type: 'color', label: 'Colour 3', doc: 'Bits pick one of three colours.', tier: 'play', default: '#7bd88f', group: 'Sprite' },
  { key: 'size', type: 'number', label: 'Size', doc: 'How big one bit is.', tier: 'play', default: 0.8, min: 0.1, max: 3, step: 0.05, hardMin: 0.02, unit: 'm', group: 'Sprite' },
  { key: 'speed', type: 'number', label: 'Speed', doc: 'How fast the bits fly out.', tier: 'build', default: 6, min: 0, max: 20, step: 0.1, hardMin: 0, unit: 'm/s', group: 'Motion' },
  { key: 'spread', type: 'number', label: 'Spread', doc: '0 shoots straight out of the ground, 1 sprays every way.', tier: 'build', default: 1, min: 0, max: 1, step: 0.01, group: 'Motion' },
  { key: 'gravity', type: 'number', label: 'Gravity', doc: 'Pulls them down; below 0 they float up.', tier: 'build', default: 6, min: -10, max: 20, step: 0.1, unit: 'm/s²', group: 'Motion' },
  { key: 'lifeMs', type: 'number', label: 'Lasts', doc: 'How long the bits live.', tier: 'build', default: 700, min: 100, max: 3000, step: 10, hardMin: 50, hardMax: 10000, unit: 'ms', group: 'Motion' },
  { key: 'glow', type: 'boolean', label: 'Glow', doc: 'Glowing bits add light instead of covering.', tier: 'build', default: false, group: 'Look' },
];
export const spriteToParams = (s: SpritePreset): Record<string, number | string | boolean> => ({
  name: s.name, count: s.count, colorA: s.colorA, colorB: s.colorB, colorC: s.colorC, size: s.size, speed: s.speed, spread: s.spread, gravity: s.gravity, lifeMs: s.lifeMs, glow: s.glow,
});

/* ------------------------------ camera shakes ------------------------------ */

export interface ShakePreset { readonly id: string; readonly name: string; /** metres */ readonly amp: number; readonly ms: number; /** wobbles per second */ readonly freq: number }
export const SHAKES: readonly ShakePreset[] = [
  { id: 'tap', name: 'Tap', amp: 0.03, ms: 120, freq: 28 },
  { id: 'thump', name: 'Thump', amp: 0.09, ms: 220, freq: 18 },
  { id: 'rumble', name: 'Rumble', amp: 0.06, ms: 600, freq: 12 },
  { id: 'quake', name: 'Quake', amp: 0.25, ms: 700, freq: 9 },
];
export const shakeById = (id: string): ShakePreset => SHAKES.find((s) => s.id === id) ?? SHAKES[0]!;
/** The camera offset of a shake `t` ms after it started (0 when it is over): a decaying wobble on three axes. */
export function shakeOffset(s: ShakePreset, t: number, amount = 1): [number, number, number] {
  if (t < 0 || t >= s.ms || amount <= 0) return [0, 0, 0];
  const k = (1 - t / s.ms) ** 2 * s.amp * amount, w = (t / 1000) * s.freq * Math.PI * 2;
  return [Math.sin(w) * k, Math.sin(w * 1.31 + 1.7) * k, Math.sin(w * 0.87 + 4.1) * k];
}
