/**
 * Goblin DNA — deterministic avatar serialization (Deliverable 3, revised in Plan §8/§9).
 * Target in game repo: `src/game/avatar/goblin-dna.ts`.
 *
 * v1  GOB-XXXX-XXXX-XXXX                 version 1 · frozen v1 radix table · FNV-8 checksum
 * v2  GOB-XXXX-XXXX-XXXX                 version 2 · frozen v2 radix table (the catalog as it was before art wave 1)
 * v3  GOB-XXXX-XXXX-XXXX-XXXX            version 3 · fixed per-layer capacities, so the catalog can keep growing
 *                                          (append-only) without ever changing what a code decodes to
 *     GOB-XXXX-XXXX-XXXX-NNNN-NNNN-NNNN  + base-36 nudge block (18 radix-7 digits + 2-char checksum
 *                                          seeded with the head, so blocks can't be spliced between goblins)
 * The encoder emits the SHORTEST valid form: v1 when only v1 items are used and nothing is nudged, else v2
 * when every item existed in v2, else v3. A goblin that v1 or v2 can express keeps its old code.
 * Any version may carry the nudge block except v1.
 * All arithmetic stays below 2^53 (no BigInt, no >32-bit bitwise ops).
 */
import type { AvatarLayerId, GoblinAvatarConfig, GoblinDna, NudgeLayerId, NudgeState, SkinToneId, SpreadLayerId } from './interfaces';
import { mulberry32 } from './economy-sim';

/** Catalog item names per layer. Index 0 of optional layers = none. APPEND-ONLY; never reorder. */
export const AVATAR_CATALOG: Readonly<Record<AvatarLayerId, readonly string[]>> = {
  // Art wave 1 (ART-B1/B2) appended the painted parts after each layer's v2 items.
  background: ['workshop-wall', 'furnace-glow', 'racing-pennants', 'smog-sky', 'painted:background-workshop-wall', 'painted:background-furnace-glow', 'painted:background-racing-pennants', 'painted:background-smog-sky'],
  ears: ['bat-pointed', 'notched-fins', 'torn-brass-ring', 'droopy-hound', 'painted:ears-bat-pointed', 'painted:ears-notched-fins', 'painted:ears-torn-brass-ring', 'painted:ears-droopy-hound'],
  head: ['angular', 'bloated', 'scrawny'],
  mouth: ['lower-tusks', 'gold-jags', 'cigar-stub', 'stitched-scar', 'painted:mouth-gold-tusk-grin', 'painted:mouth-lower-tusks', 'painted:mouth-gold-jag-teeth', 'painted:mouth-cigar-stub', 'painted:mouth-stitched-scar'],
  nose: ['hooked-beak', 'warted-bulb', 'prosthetic-plate', 'painted:nose-hooked-beak', 'painted:nose-warted-bulb', 'painted:nose-brass-prosthetic'],
  eyes: ['bloodshot-crazy', 'narrow-squint', 'wide-mismatched', 'sleepy-lidded', 'painted:eyes-bloodshot-crazy', 'painted:eyes-narrow-squint', 'painted:eyes-wide-mismatched', 'painted:eyes-sleepy-lidded'],
  eyewear: ['none', 'goggles-up', 'goggles-down', 'brass-monocle', 'leather-eyepatch', 'painted:eyewear-welding-goggles', 'painted:eyewear-clockwork-monocle', 'painted:eyewear-racing-goggles', 'painted:eyewear-leather-eyepatch', 'painted:eyewear-cracked-spectacles', 'painted:eyewear-cyclops-lens-rig'],
  hair: ['none', 'grease-mohawk', 'mutton-chops', 'singed-topknot', 'wire-tufts', 'painted:hair-grease-mohawk', 'painted:hair-mutton-chops', 'painted:hair-singed-topknot', 'painted:hair-wire-tufts'],
  headgear: ['none', 'aviator-cap', 'miner-headlamp', 'pickelhaube', 'grease-bowler', 'painted:headgear-aviator-helmet', 'painted:headgear-gear-tophat', 'painted:headgear-miner-headlamp', 'painted:headgear-spiked-pickelhaube', 'painted:headgear-grease-bowler', 'painted:headgear-scrap-crown'],
  neck: ['none', 'spiked-collar', 'gear-chain', 'boiler-suit', 'tool-bandolier', 'painted:neck-brass-gorget', 'painted:neck-spiked-collar', 'painted:neck-gear-chain', 'painted:neck-boiler-suit-collar', 'painted:neck-tool-bandolier'],
  warpaint: ['none', 'mud-stripes', 'red-handprint', 'cog-tattoo', 'soot-smudges'],
};

export const SKIN_TONES: readonly { id: SkinToneId; name: string; base: string; shade: string; light: string }[] = [
  { id: 'toxic-green', name: 'Toxic Green', base: '#7fb24a', shade: '#4e7a2a', light: '#b3de74' },
  { id: 'sallow-ochre', name: 'Sallow Ochre', base: '#c2a553', shade: '#8a7232', light: '#e4cd84' },
  { id: 'ash-grey', name: 'Ash Grey', base: '#8f978c', shade: '#5d655b', light: '#c1c8bd' },
  { id: 'mottled-olive', name: 'Mottled Olive', base: '#6f7a3c', shade: '#454d22', light: '#9ca865' },
];
export const ACCENT_PALETTE = ['#c8372d', '#e58a2b', '#e8c547', '#3fa7a0', '#4f6ed1', '#8d4fd1', '#e2e2d8', '#1f1f22'] as const;
export const LEATHER_PALETTE = ['#5a3a22', '#7b4a2a', '#2e2621', '#8c6b45'] as const;
export const METAL_PALETTE = ['#c08a2e', '#9aa0a8', '#b86b3a', '#5b5f66'] as const;

const LAYER_KEYS: readonly AvatarLayerId[] = ['background', 'ears', 'head', 'mouth', 'nose', 'eyes', 'eyewear', 'hair', 'headgear', 'neck', 'warpaint'];

/** FROZEN: catalog sizes at the time v1 shipped. Never edit — v1 codes in the wild depend on it. */
const V1_SIZES: Readonly<Record<AvatarLayerId, number>> = {
  background: 4, ears: 4, head: 3, mouth: 4, nose: 3, eyes: 4, eyewear: 5, hair: 5, headgear: 5, neck: 5, warpaint: 5,
};

/** FROZEN: catalog sizes when v2 shipped (before art wave 1). Never edit — v2 codes depend on it. */
const V2_SIZES: Readonly<Record<AvatarLayerId, number>> = {
  background: 4, ears: 4, head: 3, mouth: 5, nose: 3, eyes: 4, eyewear: 7, hair: 5, headgear: 7, neck: 6, warpaint: 5,
};

/**
 * FROZEN: v3's fixed room per layer. The catalog may grow up to these sizes with no format change;
 * the product (times the palettes) stays under 2^52, the 13 hex digits of a v3 payload.
 */
export const V3_CAPACITY: Readonly<Record<AvatarLayerId, number>> = {
  background: 12, ears: 12, head: 4, mouth: 20, nose: 12, eyes: 12, eyewear: 20, hair: 16, headgear: 24, neck: 20, warpaint: 12,
};

type Radix = readonly { key: string; size: number }[];
const paletteRadix = [
  { key: 'skin', size: SKIN_TONES.length }, { key: 'accent', size: ACCENT_PALETTE.length },
  { key: 'leather', size: LEATHER_PALETTE.length }, { key: 'metal', size: METAL_PALETTE.length },
];
type Version = 1 | 2 | 3;
const RADIX_BY_VERSION: Readonly<Record<Version, Radix>> = {
  1: [...LAYER_KEYS.map((k) => ({ key: k, size: V1_SIZES[k] })), ...paletteRadix],
  2: [...LAYER_KEYS.map((k) => ({ key: k, size: V2_SIZES[k] })), ...paletteRadix],
  3: [...LAYER_KEYS.map((k) => ({ key: k, size: V3_CAPACITY[k] })), ...paletteRadix],
};
const space = (v: Version) => RADIX_BY_VERSION[v].reduce((p, r) => p * r.size, 1);
export const PAYLOAD_SPACE = { 1: space(1), 2: space(2), 3: space(3) } as const;
/** Hex digits of payload per version (v1/v2: 9, v3: 13). */
const PAYLOAD_HEX: Readonly<Record<Version, number>> = { 1: 9, 2: 9, 3: 13 };
if (PAYLOAD_SPACE[2] >= 16 ** 9) throw new Error('DNA v2 payload no longer fits 36 bits');
if (PAYLOAD_SPACE[3] >= 16 ** 13) throw new Error('DNA v3 payload no longer fits 52 bits');
for (const k of LAYER_KEYS) {
  if (AVATAR_CATALOG[k].length > V3_CAPACITY[k]) throw new Error(`The ${k} catalog outgrew DNA v3 (${AVATAR_CATALOG[k].length} > ${V3_CAPACITY[k]}): add a v4`);
}

/* ───────────── Nudge block ───────────── */

export const NUDGE_LAYERS: readonly NudgeLayerId[] = ['ears', 'eyes', 'eyewear', 'nose', 'mouth', 'hair', 'headgear', 'warpaint'];
export const SPREAD_LAYERS: readonly SpreadLayerId[] = ['ears', 'eyes'];
export const NUDGE_RANGE = 3; // steps in [-3, +3] → radix 7
/** Pixel size of one nudge step in the 256² rig. */
export const NUDGE_STEP_PX: Readonly<Record<NudgeLayerId, number>> = { ears: 4, eyes: 3, eyewear: 3, nose: 3, mouth: 4, hair: 4, headgear: 4, warpaint: 4 };
export const SPREAD_STEP_PX: Readonly<Record<SpreadLayerId, number>> = { ears: 4, eyes: 2 };
/** Eyewear rides on the eyes: its effective offset = eyes offset + own offset, and it inherits eye spread. */
export const NUDGE_PARENT: Readonly<Partial<Record<NudgeLayerId, NudgeLayerId>>> = { eyewear: 'eyes' };

export const EMPTY_NUDGE: NudgeState = { offset: {}, spread: {} };
const clampStep = (n: number) => Math.max(-NUDGE_RANGE, Math.min(NUDGE_RANGE, Math.round(n || 0)));

export function nudgeDigits(n: NudgeState | undefined): number[] {
  const d: number[] = [];
  for (const l of NUDGE_LAYERS) { d.push(clampStep(n?.offset[l]?.x ?? 0) + NUDGE_RANGE, clampStep(n?.offset[l]?.y ?? 0) + NUDGE_RANGE); }
  for (const l of SPREAD_LAYERS) d.push(clampStep(n?.spread[l] ?? 0) + NUDGE_RANGE);
  return d;
}
export const isNudged = (n: NudgeState | undefined) => nudgeDigits(n).some((d) => d !== NUDGE_RANGE);

/* ───────────── Checksums ───────────── */

function fnv(text: string, seed = 0x811c9dc5) {
  let h = seed >>> 0;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h >>> 0;
}
const checksum8 = (s: string) => { const h = fnv(s); return (h ^ (h >>> 8) ^ (h >>> 16) ^ (h >>> 24)) & 0xff; };
export const checksum32 = (text: string) => fnv(text);

/* ───────────── Encode / decode ───────────── */

function configDigits(config: GoblinAvatarConfig, radix: Radix): number[] {
  const skinIndex = SKIN_TONES.findIndex((s) => s.id === config.skin);
  return radix.map((r) => {
    if (r.key === 'skin') return Math.max(0, skinIndex);
    if (r.key === 'accent' || r.key === 'leather' || r.key === 'metal') return config[r.key];
    return config.layers[r.key as AvatarLayerId];
  });
}

function packHead(version: Version, digits: number[]): string {
  const radix = RADIX_BY_VERSION[version];
  let payload = 0;
  for (let i = radix.length - 1; i >= 0; i--) {
    const d = digits[i];
    if (!Number.isInteger(d) || d < 0 || d >= radix[i].size) throw new RangeError(`DNA digit ${radix[i].key}=${d} out of range for v${version}`);
    payload = payload * radix[i].size + d;
  }
  const head = (version.toString(16) + payload.toString(16).padStart(PAYLOAD_HEX[version], '0')).toUpperCase();
  return head + checksum8(head).toString(16).padStart(2, '0').toUpperCase();
}

export function encodeGoblinDna(config: GoblinAvatarConfig): GoblinDna {
  const fitsV1 = LAYER_KEYS.every((k) => config.layers[k] < V1_SIZES[k]);
  const fitsV2 = LAYER_KEYS.every((k) => config.layers[k] < V2_SIZES[k]);
  const nudged = isNudged(config.nudge);
  const version: Version = fitsV1 && !nudged ? 1 : fitsV2 ? 2 : 3;
  const hex = packHead(version, configDigits(config, RADIX_BY_VERSION[version]));
  let dna = hex.match(/.{4}/g)!.reduce((out, group) => `${out}-${group}`, 'GOB');
  if (nudged) {
    let payload = 0;
    const d = nudgeDigits(config.nudge);
    for (let i = d.length - 1; i >= 0; i--) payload = payload * 7 + d[i];
    const body = payload.toString(36).toUpperCase().padStart(10, '0');
    const cs = (fnv(body, fnv(hex)) % 1296).toString(36).toUpperCase().padStart(2, '0');
    const block = body + cs;
    dna += `-${block.slice(0, 4)}-${block.slice(4, 8)}-${block.slice(8, 12)}`;
  }
  return dna as GoblinDna;
}

export function decodeGoblinDna(dna: string): GoblinAvatarConfig {
  // Groups after GOB: 3 (v1/v2) or 4 (v3) hex groups, then optionally the 3-group nudge block.
  const groups = dna.trim().toUpperCase().split('-');
  if (groups[0] !== 'GOB' || !groups.slice(1).every((g) => /^[0-9A-Z]{4}$/.test(g))) throw new SyntaxError('Malformed goblin DNA');
  const version = parseInt(groups[1]?.[0] ?? '', 16);
  if (version !== 1 && version !== 2 && version !== 3) {
    if (/^[0-9A-F]$/.test(groups[1]?.[0] ?? '')) throw new RangeError(`Unsupported DNA version ${version}`);
    throw new SyntaxError('Malformed goblin DNA');
  }
  const headGroups = version === 3 ? 4 : 3;
  if (groups.length !== 1 + headGroups && groups.length !== 1 + headGroups + 3) throw new SyntaxError('Malformed goblin DNA');
  const hex = groups.slice(1, 1 + headGroups).join('');
  if (!/^[0-9A-F]+$/.test(hex)) throw new SyntaxError('Malformed goblin DNA');
  const nudgeGroups = groups.slice(1 + headGroups);
  const m: (string | undefined)[] = [undefined, undefined, undefined, undefined, ...nudgeGroups];
  const head = hex.slice(0, -2);
  if (parseInt(hex.slice(-2), 16) !== checksum8(head)) throw new SyntaxError('Goblin DNA checksum mismatch');
  const radix = RADIX_BY_VERSION[version];
  let payload = parseInt(head.slice(1), 16);
  if (payload >= PAYLOAD_SPACE[version]) throw new RangeError('DNA payload out of range');
  const digits: number[] = [];
  for (const r of radix) { digits.push(payload % r.size); payload = Math.floor(payload / r.size); }
  const layers = {} as Record<AvatarLayerId, number>;
  radix.forEach((r, i) => { if (r.key in AVATAR_CATALOG) layers[r.key as AvatarLayerId] = digits[i]; });
  const at = (key: string) => digits[radix.findIndex((r) => r.key === key)];
  const config: GoblinAvatarConfig = { version: 1, layers, skin: SKIN_TONES[at('skin')].id, accent: at('accent'), leather: at('leather'), metal: at('metal') };
  // A layer index past what the catalog holds (a v3 code from a newer build) can't be drawn here.
  for (const k of LAYER_KEYS) if (layers[k] >= AVATAR_CATALOG[k].length) throw new RangeError(`This goblin uses a ${k} item this game doesn't have yet`);
  if (!m[4]) return config;
  if (version === 1) throw new SyntaxError('Nudge block requires DNA v2 or later');
  const block = (m[4] + m[5] + m[6]).toUpperCase();
  const body = block.slice(0, 10);
  if (parseInt(block.slice(10), 36) !== fnv(body, fnv(hex)) % 1296) throw new SyntaxError('Nudge block checksum mismatch');
  let np = parseInt(body, 36);
  const nd: number[] = [];
  for (let i = 0; i < NUDGE_LAYERS.length * 2 + SPREAD_LAYERS.length; i++) { nd.push((np % 7) - NUDGE_RANGE); np = Math.floor(np / 7); }
  if (np !== 0) throw new RangeError('Nudge block out of range');
  const offset: Partial<Record<NudgeLayerId, { x: number; y: number }>> = {};
  NUDGE_LAYERS.forEach((l, i) => { if (nd[i * 2] || nd[i * 2 + 1]) offset[l] = { x: nd[i * 2], y: nd[i * 2 + 1] }; });
  const spread: Partial<Record<SpreadLayerId, number>> = {};
  SPREAD_LAYERS.forEach((l, i) => { const v = nd[NUDGE_LAYERS.length * 2 + i]; if (v) spread[l] = v; });
  return { ...config, nudge: { offset, spread } };
}

/* ───────────── Deterministic generation (versioned) ───────────── */

/** v1 weights are frozen alongside V1_SIZES so `generateRandomGoblin(seed, 1)` never changes. */
const WEIGHTS: Readonly<Record<1 | 2 | 3, Partial<Record<AvatarLayerId, readonly number[]>>>> = {
  1: { eyewear: [4, 3, 2, 1, 1], hair: [2, 3, 2, 2, 3], headgear: [4, 2, 2, 1, 2], neck: [3, 2, 2, 2, 1], warpaint: [5, 2, 1, 1, 2] },
  2: { eyewear: [4, 3, 2, 1, 1, 2, 1], hair: [2, 3, 2, 2, 3], headgear: [4, 2, 2, 1, 2, 2, 2], neck: [3, 2, 2, 2, 1, 2], warpaint: [5, 2, 1, 1, 2], mouth: [3, 3, 2, 2, 1] },
  // v3 draws from the live catalog; layers not listed are uniform. "none" stays the likeliest single pick.
  3: {},
};
const noneWeighted = (size: number, noneWeight: number) => Array.from({ length: size }, (_, i) => (i === 0 ? noneWeight : 1));

function pickWeighted(rand: () => number, size: number, weights?: readonly number[]) {
  const w = weights && weights.length === size ? weights : Array.from({ length: size }, () => 1);
  const total = w.reduce((a, b) => a + b, 0);
  let roll = rand() * total;
  for (let i = 0; i < size; i++) { roll -= w[i]; if (roll < 0) return i; }
  return size - 1;
}

/**
 * Deterministic: identical (seed, generator) → identical goblin on every client/server/test run.
 * Lobbies persist the generator version they were created with, so AI faces never change mid-season
 * when the catalog grows (a question the first draft of the plan didn't ask).
 */
export function generateRandomGoblin(seed: number | string, generator: 1 | 2 | 3 = 2): GoblinAvatarConfig {
  const rand = mulberry32(typeof seed === 'number' ? seed : checksum32(seed));
  const layers = {} as Record<AvatarLayerId, number>;
  for (const layer of LAYER_KEYS) {
    if (generator === 3) {
      const size = AVATAR_CATALOG[layer].length;
      const optional = AVATAR_CATALOG[layer][0] === 'none';
      layers[layer] = pickWeighted(rand, size, optional ? noneWeighted(size, Math.max(2, Math.round(size / 4))) : undefined);
    } else {
      layers[layer] = pickWeighted(rand, RADIX_BY_VERSION[generator].find((r) => r.key === layer)!.size, WEIGHTS[generator][layer]);
    }
  }
  if (layers.headgear === 3 && layers.hair === 1) layers.hair = 4;
  if (layers.eyewear === 2 && layers.headgear === 2) layers.eyewear = 1;
  return {
    version: 1, layers,
    skin: SKIN_TONES[pickWeighted(rand, SKIN_TONES.length)].id,
    accent: pickWeighted(rand, ACCENT_PALETTE.length),
    leather: pickWeighted(rand, LEATHER_PALETTE.length),
    metal: pickWeighted(rand, METAL_PALETTE.length),
  };
}

export const DNA_VERSION = 2;
