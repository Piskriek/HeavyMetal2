import type { VariableDef } from '@hm/contracts';

/**
 * An avatar's look as a preset: its kind (a goblin, a human ...), a name and a few colours. The colours recolour that kind's voxel model by
 * palette entry name, so every look of a kind keeps the same shape and the same bones (it animates the same way). The eight colour slots are
 * shared by every kind and mean what that kind wears: a goblin's vest is a human's shirt. Pure; names are checked for length and for words
 * that are not allowed.
 */

/** What an avatar is: its body, its bones and what its colour slots mean. The first game you play makes a goblin; you can make any kind. */
export type AvatarKind = 'goblin' | 'human';
export const AVATAR_KINDS: readonly { readonly id: AvatarKind; readonly name: string; readonly says: string }[] = [
  { id: 'goblin', name: 'Goblin', says: 'Green skin, pointy ears, glowing eyes, a vest and a shield.' },
  { id: 'human', name: 'Human', says: 'A shirt, trousers, shoes and a neckerchief.' },
];

export interface AvatarLook {
  id: string;
  name: string;
  /** Left out: a goblin (every look made before there were kinds). */
  kind?: AvatarKind;
  skin: string;
  speckle: string;
  eyes: string;
  vest: string;
  belt: string;
  cloth: string;
  claws: string;
  shield: string;
  /** Parts added to the goblin, by place: hat, hair, face, in hand, on the back (part ids from the parts library). */
  parts?: Readonly<Partial<Record<PartPlace, string>>>;
}

/** Where parts can go on your goblin. */
export const PART_PLACES = ['hat', 'hair', 'face-extra', 'handheld', 'back'] as const;
export type PartPlace = (typeof PART_PLACES)[number];

/** Which palette entry of the voxel goblin each colour paints (by entry name). */
export const LOOK_SLOTS: Readonly<Record<keyof Omit<AvatarLook, 'id' | 'name' | 'parts' | 'kind'>, readonly string[]>> = {
  skin: ['skin'], speckle: ['skin-speckle'], eyes: ['eye-glow'], vest: ['leather-vest'], belt: ['belt', 'buckle'], cloth: ['loincloth'], claws: ['claws', 'fangs'],
  shield: ['shield-wood'],
};
export type LookSlot = keyof typeof LOOK_SLOTS;
export const LOOK_SLOT_KEYS = Object.keys(LOOK_SLOTS) as LookSlot[];
/** The same slots on the voxel human: skin, hair, eyes, shirt, belt, trousers, shoes, neckerchief. */
export const HUMAN_SLOTS: Readonly<Record<LookSlot, readonly string[]>> = {
  skin: ['skin', 'skin-shade'], speckle: ['hair'], eyes: ['eyes'], vest: ['shirt'], belt: ['belt', 'buckle'], cloth: ['trousers'], claws: ['shoes'], shield: ['scarf'],
};
export const kindOf = (look: Pick<AvatarLook, 'kind'>): AvatarKind => (look.kind === 'human' ? 'human' : 'goblin');
export const slotsFor = (kind: AvatarKind | undefined): Readonly<Record<LookSlot, readonly string[]>> => (kind === 'human' ? HUMAN_SLOTS : LOOK_SLOTS);

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
/** Ready-made human looks: varied skin and hair, everyday clothes. */
export const HUMAN_LOOKS: readonly AvatarLook[] = [
  look('explorer', 'Explorer', { kind: 'human', skin: '#c68d6a', speckle: '#3b2a1e', eyes: '#3a2a1c', vest: '#d9c9a3', belt: '#5a3b22', cloth: '#5f6b4a', claws: '#3d2b1e', shield: '#c0392b' }),
  look('mechanic', 'Mechanic', { kind: 'human', skin: '#8d5a3c', speckle: '#1c1714', eyes: '#2a1d14', vest: '#3f5f8a', belt: '#2a2a2a', cloth: '#30343c', claws: '#1f1f22', shield: '#e3a03a' }),
  look('sailor', 'Sailor', { kind: 'human', skin: '#f1c9a5', speckle: '#c9a04a', eyes: '#3a6a9a', vest: '#f2f2ee', belt: '#283a5a', cloth: '#1f2f52', claws: '#2a2420', shield: '#2f6fb8' }),
  look('ranger', 'Ranger', { kind: 'human', skin: '#a8704d', speckle: '#5a2f1a', eyes: '#2f4a2a', vest: '#4f6b3a', belt: '#3a2a1a', cloth: '#6b5a3a', claws: '#2e2318', shield: '#c9a23a' }),
  look('artist', 'Artist', { kind: 'human', skin: '#e0ac86', speckle: '#a3342c', eyes: '#3a2a20', vest: '#e8d84a', belt: '#5a4a3a', cloth: '#2a2a2e', claws: '#b8432f', shield: '#3aa39a' }),
  look('night-owl', 'Night owl', { kind: 'human', skin: '#5e3b28', speckle: '#e8e8ea', eyes: '#2a2a3a', vest: '#2a2a3a', belt: '#141418', cloth: '#3a3a52', claws: '#e8e8ea', shield: '#8a6ad8' }),
];
/** The ready-made looks of a kind. */
export const looksFor = (kind: AvatarKind | undefined): readonly AvatarLook[] => (kind === 'human' ? HUMAN_LOOKS : LOOKS);
export const lookById = (id: string): AvatarLook => LOOKS.find((l) => l.id === id) ?? HUMAN_LOOKS.find((l) => l.id === id) ?? LOOKS[0]!;

const HEX = /^#[0-9a-f]{6}$/i;
export const BLOCKED_WORDS: readonly string[] = ['fuck', 'shit', 'cunt', 'nigg', 'fag', 'rape', 'nazi', 'hitler', 'kys', 'retard', 'whore', 'slut', 'dick', 'penis', 'vagina', 'porn', 'sex'];

/** Why a name is not allowed, or null when it is fine: 2 to 20 letters, digits, spaces, dashes or apostrophes, no blocked words, no links. */
export function nameProblem(raw: unknown): string | null {
  if (typeof raw !== 'string') return 'Give your avatar a name.';
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
  const human = r.kind === 'human';
  const base = human ? HUMAN_LOOKS[0]! : LOOKS[0]!;
  const out: AvatarLook = { ...base, id: typeof r.id === 'string' && r.id ? r.id : 'mine', name: nameProblem(r.name) === null ? String(r.name).trim() : human ? 'Wanderer' : 'Goblin' };
  if (!human) delete out.kind;
  for (const k of LOOK_SLOT_KEYS) out[k] = typeof r[k] === 'string' && HEX.test(r[k] as string) ? (r[k] as string).toLowerCase() : base[k];
  const rp = r.parts && typeof r.parts === 'object' && !Array.isArray(r.parts) ? (r.parts as Record<string, unknown>) : {};
  const parts: Partial<Record<PartPlace, string>> = {};
  for (const place of PART_PLACES) { const v = rp[place]; if (typeof v === 'string' && /^[a-z0-9_-]{1,40}$/.test(v)) parts[place] = v; }
  return Object.keys(parts).length ? { ...out, parts } : out;
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
/** The same eight colours as a human wears them. */
export const HUMAN_LOOK_VARIABLES: readonly VariableDef[] = [
  { key: 'skin', type: 'color', label: 'Skin', doc: 'The colour of your skin.', tier: 'play', default: HUMAN_LOOKS[0]!.skin, group: 'Look' },
  { key: 'speckle', type: 'color', label: 'Hair', doc: 'Your hair.', tier: 'play', default: HUMAN_LOOKS[0]!.speckle, group: 'Look' },
  { key: 'eyes', type: 'color', label: 'Eyes', doc: 'Your eyes.', tier: 'play', default: HUMAN_LOOKS[0]!.eyes, group: 'Look' },
  { key: 'vest', type: 'color', label: 'Shirt', doc: 'Your shirt.', tier: 'play', default: HUMAN_LOOKS[0]!.vest, group: 'Clothes' },
  { key: 'belt', type: 'color', label: 'Belt', doc: 'Belt and buckle.', tier: 'build', default: HUMAN_LOOKS[0]!.belt, group: 'Clothes' },
  { key: 'cloth', type: 'color', label: 'Trousers', doc: 'Your trousers.', tier: 'play', default: HUMAN_LOOKS[0]!.cloth, group: 'Clothes' },
  { key: 'claws', type: 'color', label: 'Shoes', doc: 'Your shoes.', tier: 'build', default: HUMAN_LOOKS[0]!.claws, group: 'Clothes' },
  { key: 'shield', type: 'color', label: 'Neckerchief', doc: 'The scarf round your neck.', tier: 'play', default: HUMAN_LOOKS[0]!.shield, group: 'Clothes' },
];
export const lookVariablesFor = (kind: AvatarKind | undefined): readonly VariableDef[] => (kind === 'human' ? HUMAN_LOOK_VARIABLES : LOOK_VARIABLES);

/** sRGB hex to 0..1 channels. */
export function hexToRgb01(hex: string): [number, number, number] {
  const v = HEX.test(hex) ? parseInt(hex.slice(1), 16) : 0x808080;
  return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
}

export interface PaletteEntryLike { name: string; color: readonly number[] | [number, number, number] }
/** A copy of a palette with the look's colours on the entries they name (by the look's kind); other entries are kept. */
export function recolour<E extends PaletteEntryLike>(palette: readonly E[], look: AvatarLook): E[] {
  const byName = new Map<string, [number, number, number]>();
  const slots = slotsFor(look.kind);
  for (const k of LOOK_SLOT_KEYS) for (const n of slots[k]) byName.set(n, hexToRgb01(look[k]));
  return palette.map((e) => { const c = byName.get(e.name); return c ? { ...e, color: c } : { ...e }; });
}

/** A random look of a kind from its ready-made colours, deterministic in the seed (the dice button in the avatar maker). */
export function randomLook(seed: number, name = 'Goblin', kind: AvatarKind = 'goblin'): AvatarLook {
  let a = (seed >>> 0) || 1;
  const r = (): number => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const pool = looksFor(kind);
  const pick = (k: LookSlot): string => pool[Math.floor(r() * pool.length)]![k];
  const out: AvatarLook = { ...pool[0]!, id: `random-${seed}`, name };
  for (const k of LOOK_SLOT_KEYS) out[k] = pick(k);
  return out;
}
