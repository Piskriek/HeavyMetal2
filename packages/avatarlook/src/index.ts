import type { VariableDef } from '@hm/contracts';

/**
 * Your goblin's look as a preset: a name and a few colours (skin, speckles, eyes, vest, belt, loincloth, claws, shield). The colours recolour
 * the voxel goblin's palette by entry name, so every look keeps the same shape and the same bones (it animates the same way).
 * Pure; names are checked for length and for words that are not allowed.
 */

export interface AvatarLook {
  id: string;
  name: string;
  skin: string;
  speckle: string;
  eyes: string;
  vest: string;
  belt: string;
  cloth: string;
  claws: string;
  shield: string;
}

/** Which palette entry of the voxel goblin each colour paints (by entry name). */
export const LOOK_SLOTS: Readonly<Record<keyof Omit<AvatarLook, 'id' | 'name'>, readonly string[]>> = {
  skin: ['skin'], speckle: ['skin-speckle'], eyes: ['eye-glow'], vest: ['leather-vest'], belt: ['belt', 'buckle'], cloth: ['loincloth'], claws: ['claws', 'fangs'],
  shield: ['shield-wood'],
};
export type LookSlot = keyof typeof LOOK_SLOTS;
export const LOOK_SLOT_KEYS = Object.keys(LOOK_SLOTS) as LookSlot[];

const look = (id: string, name: string, c: Omit<AvatarLook, 'id' | 'name'>): AvatarLook => ({ id, name, ...c });
/** Ready-made looks. The first is the classic green goblin. */
export const LOOKS: readonly AvatarLook[] = [
  look('classic', 'Classic', { skin: '#529438', speckle: '#38702a', eyes: '#ffe60d', vest: '#6b4224', belt: '#382415', cloth: '#5c5238', claws: '#4d4740', shield: '#855c33' }),
  look('swamp', 'Swamp', { skin: '#6f8f3a', speckle: '#4d6627', eyes: '#ff9f1a', vest: '#3f4a2a', belt: '#2a2a1a', cloth: '#6b5a3a', claws: '#3a3a30', shield: '#5a4a2a' }),
  look('frost', 'Frost', { skin: '#7fb7c2', speckle: '#5d8f9c', eyes: '#d8f6ff', vest: '#2f3f63', belt: '#1c2438', cloth: '#d8dde8', claws: '#e8eef5', shield: '#8899aa' }),
  look('ember', 'Ember', { skin: '#b5502e', speckle: '#7f3420', eyes: '#ffd23a', vest: '#2a1a14', belt: '#140c0a', cloth: '#5a2a1a', claws: '#1c1410', shield: '#4a2a1a' }),
  look('night', 'Night', { skin: '#5a4a8a', speckle: '#3a2f63', eyes: '#7dffc8', vest: '#1a1a2a', belt: '#0e0e18', cloth: '#2a2a4a', claws: '#c8c8e0', shield: '#3a3a5a' }),
  look('gold', 'Gold digger', { skin: '#8fb04a', speckle: '#6a8a30', eyes: '#ff4d4d', vest: '#c79a2a', belt: '#7a5a14', cloth: '#e8d08a', claws: '#f2d880', shield: '#d8b040' }),
];
export const lookById = (id: string): AvatarLook => LOOKS.find((l) => l.id === id) ?? LOOKS[0]!;

const HEX = /^#[0-9a-f]{6}$/i;
export const BLOCKED_WORDS: readonly string[] = ['fuck', 'shit', 'cunt', 'nigg', 'fag', 'rape', 'nazi', 'hitler', 'kys', 'retard', 'whore', 'slut', 'dick', 'penis', 'vagina', 'porn', 'sex'];

/** Why a name is not allowed, or null when it is fine: 2 to 20 letters, digits, spaces, dashes or apostrophes, no blocked words, no links. */
export function nameProblem(raw: unknown): string | null {
  if (typeof raw !== 'string') return 'Give your goblin a name.';
  const name = raw.trim();
  if (name.length < 2) return 'A name needs at least 2 letters.';
  if (name.length > 20) return 'Keep the name to 20 letters or fewer.';
  if (!/^[\p{L}\p{N}][\p{L}\p{N} '\-]*$/u.test(name)) return 'Use letters, numbers, spaces, dashes and apostrophes only.';
  const flat = name.toLowerCase().replace(/[^a-z]/g, '');
  if (/https?|www|\.com/.test(name.toLowerCase())) return 'Names cannot be links.';
  if (BLOCKED_WORDS.some((w) => flat.includes(w))) return 'Pick a different name.';
  return null;
}

/** A legal look: unknown colours fall back to the classic goblin, the name is trimmed (a bad name becomes "Goblin"). Never throws. */
export function normalizeLook(raw: unknown): AvatarLook {
  const r = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const base = LOOKS[0]!;
  const out = { ...base, id: typeof r.id === 'string' && r.id ? r.id : 'mine', name: nameProblem(r.name) === null ? String(r.name).trim() : 'Goblin' };
  for (const k of LOOK_SLOT_KEYS) out[k] = typeof r[k] === 'string' && HEX.test(r[k] as string) ? (r[k] as string).toLowerCase() : base[k];
  return out;
}

export const LOOK_VARIABLES: readonly VariableDef[] = [
  { key: 'skin', type: 'color', label: 'Skin', doc: 'The colour of your goblin.', tier: 'play', default: LOOKS[0]!.skin, group: 'Look' },
  { key: 'speckle', type: 'color', label: 'Speckles', doc: 'The darker spots on the skin.', tier: 'play', default: LOOKS[0]!.speckle, group: 'Look' },
  { key: 'eyes', type: 'color', label: 'Eyes', doc: 'They glow.', tier: 'play', default: LOOKS[0]!.eyes, group: 'Look' },
  { key: 'vest', type: 'color', label: 'Vest', doc: 'The leather vest.', tier: 'play', default: LOOKS[0]!.vest, group: 'Clothes' },
  { key: 'belt', type: 'color', label: 'Belt', doc: 'Belt and buckle.', tier: 'build', default: LOOKS[0]!.belt, group: 'Clothes' },
  { key: 'cloth', type: 'color', label: 'Loincloth', doc: 'The cloth round the hips.', tier: 'build', default: LOOKS[0]!.cloth, group: 'Clothes' },
  { key: 'claws', type: 'color', label: 'Claws and fangs', doc: 'Claws and fangs.', tier: 'build', default: LOOKS[0]!.claws, group: 'Look' },
  { key: 'shield', type: 'color', label: 'Shield', doc: 'The wooden shield.', tier: 'play', default: LOOKS[0]!.shield, group: 'Gear' },
];

/** sRGB hex to 0..1 channels. */
export function hexToRgb01(hex: string): [number, number, number] {
  const v = HEX.test(hex) ? parseInt(hex.slice(1), 16) : 0x808080;
  return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
}

export interface PaletteEntryLike { name: string; color: readonly number[] | [number, number, number] }
/** A copy of a palette with the look's colours on the entries they name; other entries are kept. */
export function recolour<E extends PaletteEntryLike>(palette: readonly E[], look: AvatarLook): E[] {
  const byName = new Map<string, [number, number, number]>();
  for (const k of LOOK_SLOT_KEYS) for (const n of LOOK_SLOTS[k]) byName.set(n, hexToRgb01(look[k]));
  return palette.map((e) => { const c = byName.get(e.name); return c ? { ...e, color: c } : { ...e }; });
}

/** A random look from the ready-made colours, deterministic in the seed (the dice button in the creator). */
export function randomLook(seed: number, name = 'Goblin'): AvatarLook {
  let a = (seed >>> 0) || 1;
  const r = (): number => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const pick = (k: LookSlot): string => LOOKS[Math.floor(r() * LOOKS.length)]![k];
  const out: AvatarLook = { ...LOOKS[0]!, id: `random-${seed}`, name };
  for (const k of LOOK_SLOT_KEYS) out[k] = pick(k);
  return out;
}
