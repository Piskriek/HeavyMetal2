/**
 * MP-T04 — the ball customiser's model: the decal catalog (generated art, no image files), a design
 * with undo/redo, the 12-decal cap, ownership, and designs saved on this device. Pure apart from
 * the optional storage argument; the Garage UI (src/components/garage/BallCustomizer.tsx) drives it.
 */
import { MAX_DECALS_PER_BALL, type BaseMaterialId, type CustomBallConfig, type DecalStamp, type DecalTextureId, type HexColor } from './interfaces';
import { computeBakeKey, type DecalSource, type RgbaImage } from './sphere-decal-baker';

export interface CatalogDecal { id: DecalTextureId; name: string; projection: 'gnomonic' | 'band'; price: number }

/** Every decal; price 0 is owned by everyone, the rest are bought with gold (MP-T07's ledger). */
export const DECAL_CATALOG: readonly CatalogDecal[] = [
  { id: 'emblem.crossed-wrenches', name: 'Crossed Wrenches', projection: 'gnomonic', price: 0 },
  { id: 'emblem.flaming-skull', name: 'Flaming Skull', projection: 'gnomonic', price: 400 },
  { id: 'emblem.clockwork-gear', name: 'Clockwork Gear', projection: 'gnomonic', price: 0 },
  { id: 'emblem.goblin-fist', name: 'Goblin Fist', projection: 'gnomonic', price: 250 },
  { id: 'emblem.trefoil', name: 'Trefoil', projection: 'gnomonic', price: 150 },
  { id: 'pattern.dual-stripes', name: 'Dual Stripes', projection: 'band', price: 0 },
  { id: 'pattern.hazard-chevrons', name: 'Hazard Chevrons', projection: 'band', price: 200 },
  { id: 'pattern.checker-band', name: 'Checker Band', projection: 'band', price: 300 },
  { id: 'pattern.boiler-rivets', name: 'Boiler Rivets', projection: 'band', price: 0 },
  { id: 'tech.patch-plate', name: 'Patch Plate', projection: 'gnomonic', price: 0 },
  { id: 'tech.pressure-gauge', name: 'Pressure Gauge', projection: 'gnomonic', price: 350 },
  { id: 'tech.exhaust-louver', name: 'Exhaust Louver', projection: 'gnomonic', price: 200 },
  { id: 'roundel.number', name: 'Number Roundel', projection: 'gnomonic', price: 0 },
  // Pack 2 — painted in the same white-on-transparent style, tinted by the stamp colour.
  { id: 'emblem.hot-rod-flames', name: 'Hot Rod Flames', projection: 'gnomonic', price: 300 },
  { id: 'emblem.crossbones', name: 'Crossbones', projection: 'gnomonic', price: 250 },
  { id: 'emblem.marble-comet', name: 'Marble Comet', projection: 'gnomonic', price: 400 },
  { id: 'emblem.lightning-bolt', name: 'Lightning Bolt', projection: 'gnomonic', price: 0 },
  { id: 'emblem.sheep-head', name: 'Sheep Head', projection: 'gnomonic', price: 350 },
  { id: 'emblem.tnt-bundle', name: 'TNT Bundle', projection: 'gnomonic', price: 300 },
  { id: 'emblem.winged-cog', name: 'Winged Cog', projection: 'gnomonic', price: 250 },
  { id: 'emblem.spiked-star', name: 'Spiked Star', projection: 'gnomonic', price: 0 },
  { id: 'emblem.anvil', name: 'Anvil', projection: 'gnomonic', price: 200 },
  { id: 'emblem.bomb-fuse', name: 'Bomb Fuse', projection: 'gnomonic', price: 250 },
  { id: 'pattern.flame-band', name: 'Flame Band', projection: 'band', price: 300 },
  { id: 'pattern.lightning-band', name: 'Lightning Band', projection: 'band', price: 250 },
  { id: 'pattern.sawtooth-band', name: 'Sawtooth Band', projection: 'band', price: 0 },
  { id: 'pattern.chain-link', name: 'Chain Link', projection: 'band', price: 200 },
  { id: 'pattern.rope-twist', name: 'Rope Twist', projection: 'band', price: 0 },
  { id: 'pattern.skull-row', name: 'Skull Row', projection: 'band', price: 350 },
];
export const BASE_PRICES: Readonly<Record<BaseMaterialId, number>> = { 'scrap-iron': 0, 'galvanized-brass': 0, damascus: 900, 'scorched-obsidian': 1200, 'boiler-copper': 600 };

/** A decal's white-on-transparent art, drawn in code (tinted by the stamp). */
export function decalImage(id: DecalTextureId): RgbaImage {
  const band = id.startsWith('pattern.');
  const w = 64, h = band ? 16 : 64, data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const u = (x + 0.5) / w * 2 - 1, v = (y + 0.5) / h * 2 - 1, r = Math.hypot(u, v), a = Math.atan2(v, u);
    let on = false;
    switch (id) {
      case 'emblem.crossed-wrenches': on = (Math.abs(u - v) < 0.18 || Math.abs(u + v) < 0.18) && r < 0.9 || (r > 0.72 && r < 0.9 && Math.abs(Math.abs(u) - Math.abs(v)) < 0.3); break;
      case 'emblem.flaming-skull': on = (Math.hypot(u, v + 0.1) < 0.55 && !(Math.hypot(Math.abs(u) - 0.22, v + 0.1) < 0.14) && !(v > 0.3 && Math.abs(u) < 0.08)) || (v < -0.55 && Math.abs(u) < 0.6 * (1 + v) + 0.5 && Math.sin(u * 14) > -0.2); break;
      case 'emblem.clockwork-gear': on = r < 0.62 + (Math.cos(a * 10) > 0.3 ? 0.22 : 0) && r > 0.25; break;
      case 'emblem.goblin-fist': on = (Math.abs(u) < 0.45 && v > -0.35 && v < 0.55) || (v < -0.3 && v > -0.7 && Math.abs(u) < 0.5 && Math.sin(u * 12) > -0.6); break;
      case 'emblem.trefoil': on = [0, 2.094, 4.189].some((t) => Math.hypot(u - 0.38 * Math.cos(t), v - 0.38 * Math.sin(t)) < 0.34); break;
      case 'pattern.dual-stripes': on = Math.abs(v) > 0.35 && Math.abs(v) < 0.8; break;
      case 'pattern.hazard-chevrons': on = ((x + Math.abs(y - h / 2) * 2) % 16) < 8; break;
      case 'pattern.checker-band': on = ((Math.floor(x / 8) + Math.floor(y / 8)) % 2) === 0; break;
      case 'pattern.boiler-rivets': on = Math.hypot(((x % 16) - 8) / 8, v) < 0.45; break;
      case 'tech.patch-plate': on = Math.abs(u) < 0.8 && Math.abs(v) < 0.6 && !(Math.hypot(Math.abs(u) - 0.65, Math.abs(v) - 0.45) < 0.08); break;
      case 'tech.pressure-gauge': on = (r > 0.7 && r < 0.9) || (Math.abs(u * 0.7 + v * 0.7) < 0.07 && r < 0.6) || r < 0.1; break;
      case 'tech.exhaust-louver': on = Math.abs(u) < 0.8 && Math.abs(v) < 0.7 && ((y >> 3) % 2 === 0); break;
      case 'roundel.number': on = r < 0.9 && !(r > 0.7 && r < 0.78); break;
      // Pack 2 fallbacks: only used headless (in the browser the painted PNGs replace them).
      case 'emblem.hot-rod-flames': on = v > -0.6 + 0.35 * Math.sin(u * 7) - 0.25 * Math.cos(u * 3) && v < 0.75 && Math.abs(u) < 0.92; break;
      case 'emblem.crossbones': on = ((Math.abs(u - v) < 0.14 || Math.abs(u + v) < 0.14) && r < 0.82)
        || [[-1, -1], [-1, 1], [1, -1], [1, 1]].some(([sx, sy]) => Math.hypot(u - sx * 0.62, v - sy * 0.62) < 0.26); break;
      case 'emblem.marble-comet': on = Math.hypot(u - 0.35, v) < 0.38 || (u < 0.3 && Math.abs(v) < 0.26 * (1 + u) && Math.sin((u + 1) * 12) > -0.4); break;
      case 'emblem.lightning-bolt': on = Math.abs(u - (0.45 - 0.9 * ((v + 1) / 2)) - (v > 0 ? 0.25 : -0.25)) < 0.24 && Math.abs(v) < 0.92; break;
      case 'emblem.sheep-head': on = Math.hypot(u, (v + 0.12) * 1.25) < 0.5
        || [-1, 1].some((s) => Math.abs(Math.hypot(u - s * 0.52, v - 0.28) - 0.3) < 0.11 && v < 0.5); break;
      case 'emblem.tnt-bundle': on = (Math.abs(v) < 0.45 && [-0.5, 0, 0.5].some((c) => Math.abs(u - c) < 0.19))
        || (v > 0.45 && v < 0.85 && Math.abs(u - 0.3 * Math.sin((v - 0.45) * 8)) < 0.07); break;
      case 'emblem.winged-cog': on = (r < 0.5 + (Math.cos(a * 9) > 0.35 ? 0.16 : 0) && r > 0.2)
        || (Math.abs(u) > 0.5 && Math.abs(u) < 0.98 && Math.abs(v - 0.18 * (Math.abs(u) - 0.5)) < 0.16 - 0.1 * (Math.abs(u) - 0.5)); break;
      case 'emblem.spiked-star': on = r < 0.35 + 0.55 * Math.abs(Math.cos(a * 2.5)) ** 1.5; break;
      case 'emblem.anvil': on = (v > 0.32 && v < 0.78 && Math.abs(u) < 0.85 - 0.25 * (v - 0.32))
        || (Math.abs(v) < 0.34 && Math.abs(u) < 0.3) || (v < -0.34 && v > -0.78 && Math.abs(u) < 0.62); break;
      case 'emblem.bomb-fuse': on = Math.hypot(u, v + 0.18) < 0.6
        || (v > 0.4 && Math.abs(u - 0.35 * Math.sin((v - 0.4) * 7)) < 0.08); break;
      case 'pattern.flame-band': on = v > 0.55 - 1.3 * Math.abs(Math.sin(x * Math.PI / 8)) ** 0.6; break;
      case 'pattern.lightning-band': on = Math.abs(v - (((x % 16) < 8 ? (x % 16) : 16 - (x % 16)) / 8 - 0.5) * 1.3) < 0.34; break;
      case 'pattern.sawtooth-band': on = v > 1 - 2 * ((x % 16) / 16); break;
      case 'pattern.chain-link': on = Math.abs(Math.hypot(((x % 16) - 8) / 7, v) - 0.62) < 0.26; break;
      case 'pattern.rope-twist': on = [0, Math.PI].some((p) => Math.abs(v - 0.55 * Math.sin(x * Math.PI / 8 + p)) < 0.3); break;
      case 'pattern.skull-row': on = Math.hypot(((x % 16) - 8) / 7, v * 1.1) < 0.62
        && !([-3, 3].some((d) => Math.hypot((x % 16) - 8 - d, (y - h / 2) + 1) < 1.6)); break;
    }
    const i = (y * w + x) * 4;
    data[i] = data[i + 1] = data[i + 2] = 255; data[i + 3] = on ? 255 : 0;
  }
  return { width: w, height: h, data };
}

/* ───────────── Painted decal art (browser) ───────────── */

/** Where a decal's painted PNG lives: the id's dot becomes a dash; the roundel uses the blank plate. */
export const DECAL_ART_DIR = '/art/garage/decals';
export const decalArtUrl = (id: DecalTextureId): string =>
  `${DECAL_ART_DIR}/${id === 'roundel.number' ? 'roundel-blank' : id.replace('.', '-')}.png`;

/** Painted art decoded from the PNGs; empty headless, so `decalImage()` stays the fallback. */
const painted = new Map<DecalTextureId, RgbaImage>();
export const paintedDecal = (id: DecalTextureId): RgbaImage | null => painted.get(id) ?? null;
/** The art a bake uses for an id: painted if it decoded, code-drawn otherwise. */
export const decalArt = (id: DecalTextureId): RgbaImage => painted.get(id) ?? decalImage(id);

async function decodePng(url: string): Promise<RgbaImage> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`missing ${url}`);
  const blob = await response.blob();
  const bitmap = await createImageBitmap(blob);
  try {
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width; canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('no 2d context');
    ctx.drawImage(bitmap, 0, 0);
    const { data, width, height } = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
    return { width, height, data };
  } finally { bitmap.close?.(); }
}

let loading: Promise<number> | null = null;
/**
 * Decodes every catalog decal's painted PNG once (browser only). Resolves with how many loaded;
 * anything that fails simply keeps its code-drawn fallback. Call before the garage's first bake.
 */
export function loadPaintedDecals(): Promise<number> {
  if (loading) return loading;
  if (typeof document === 'undefined' || typeof fetch === 'undefined') return Promise.resolve(0);
  loading = Promise.all(DECAL_CATALOG.map(async (d) => {
    try { painted.set(d.id, await decodePng(decalArtUrl(d.id))); return 1; } catch { return 0; }
  })).then((results) => {
    sources = null; // the next bake picks the painted art up
    return results.reduce<number>((a, b) => a + b, 0);
  });
  return loading;
}

/** The bake's decal sources, built once per art generation (painted art rebuilds them). */
let sources: Map<string, DecalSource> | null = null;
export function decalSources(): ReadonlyMap<string, DecalSource> {
  if (!sources) sources = new Map(DECAL_CATALOG.map((d) => [d.id, { projection: d.projection, image: decalArt(d.id) }]));
  return sources;
}

export type DesignFields = Omit<CustomBallConfig, 'bakeKey'>;
export const DEFAULT_DESIGN: DesignFields = { version: 1, base: 'scrap-iron', accentColor: '#e58a2b' as HexColor, capFinish: 'brass', decals: [] };
export const withBakeKey = (design: DesignFields): CustomBallConfig => ({ ...design, bakeKey: computeBakeKey(design) });

/** Undo/redo over designs: 50 steps; edits sharing a `coalesce` key (one drag) make one step. */
export interface DesignHistory { past: DesignFields[]; present: DesignFields; future: DesignFields[]; coalesce: string | null }
export const HISTORY_LIMIT = 50;
export const startHistory = (design: DesignFields = DEFAULT_DESIGN): DesignHistory => ({ past: [], present: design, future: [], coalesce: null });
export function edit(h: DesignHistory, next: DesignFields, coalesce: string | null = null): DesignHistory {
  if (next === h.present) return h;
  if (coalesce !== null && coalesce === h.coalesce) return { ...h, present: next, future: [] };
  return { past: [...h.past, h.present].slice(-HISTORY_LIMIT), present: next, future: [], coalesce };
}
export const undo = (h: DesignHistory): DesignHistory => h.past.length ? { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future], coalesce: null } : h;
export const redo = (h: DesignHistory): DesignHistory => h.future.length ? { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1), coalesce: null } : h;

let uidCounter = 0;
/** Adds a decal at (u, v), or refuses past the 12-decal cap with a friendly reason. */
export function addDecal(design: DesignFields, textureId: DecalTextureId, u: number, v: number): { ok: true; design: DesignFields; stamp: DecalStamp } | { ok: false; reason: string } {
  if (design.decals.length >= MAX_DECALS_PER_BALL) return { ok: false, reason: `A ball holds ${MAX_DECALS_PER_BALL} decals. Remove one first.` };
  const band = DECAL_CATALOG.find((d) => d.id === textureId)?.projection === 'band';
  const stamp: DecalStamp = {
    uid: `d${Date.now().toString(36)}${(uidCounter++).toString(36)}`, textureId,
    u: (((u % 1) + 1) % 1) as never, v: Math.max(0, Math.min(1, v)) as never,
    scale: band ? 0.08 : 0.18, rotation: 0, opacity: 1, tintColor: '#f2e6c8' as HexColor, blendMode: 'normal',
  };
  return { ok: true, design: { ...design, decals: [...design.decals, stamp] }, stamp };
}
export const updateDecal = (design: DesignFields, uid: string, change: Partial<DecalStamp>): DesignFields =>
  ({ ...design, decals: design.decals.map((d) => (d.uid === uid ? { ...d, ...change } : d)) });
export const removeDecal = (design: DesignFields, uid: string): DesignFields => ({ ...design, decals: design.decals.filter((d) => d.uid !== uid) });

/** A click on the flat equirect preview → exactly the (u, v) of that texel's centre. */
export const texelUv = (px: number, py: number, width: number, height: number) =>
  ({ u: (Math.floor(px) + 0.5) / width, v: 1 - (Math.floor(py) + 0.5) / height });

/** What in a design the player does not own yet (saving is blocked until it is bought). */
export function unownedItems(design: DesignFields, owned: ReadonlySet<string>): { id: string; price: number }[] {
  const out: { id: string; price: number }[] = [];
  if (BASE_PRICES[design.base] > 0 && !owned.has(design.base)) out.push({ id: design.base, price: BASE_PRICES[design.base] });
  for (const id of new Set(design.decals.map((d) => d.textureId))) {
    const price = DECAL_CATALOG.find((d) => d.id === id)?.price ?? 0;
    if (price > 0 && !owned.has(id)) out.push({ id, price });
  }
  return out;
}

export const DESIGNS_KEY = 'hm2-ball-designs-v1';
export const OWNED_KEY = 'hm2-owned-cosmetics-v1';
interface StorageLike { getItem(key: string): string | null; setItem(key: string, value: string): void }
const storage = (): StorageLike | null => { try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; } };

export function ownedCosmetics(store = storage()): Set<string> {
  try { const list = JSON.parse(store?.getItem(OWNED_KEY) ?? '[]'); return new Set(Array.isArray(list) ? list.filter((x) => typeof x === 'string') : []); } catch { return new Set(); }
}

export function listDesigns(store = storage()): { name: string; config: CustomBallConfig }[] {
  try { const list = JSON.parse(store?.getItem(DESIGNS_KEY) ?? '[]'); return Array.isArray(list) ? list : []; } catch { return []; }
}

/** Saves a design under a name, unless something in it is not owned. */
export function saveDesign(name: string, design: DesignFields, store = storage()): { ok: true } | { ok: false; reason: string } {
  const label = name.trim().slice(0, 24);
  if (!label) return { ok: false, reason: 'Name the design first.' };
  const missing = unownedItems(design, ownedCosmetics(store));
  if (missing.length) return { ok: false, reason: `Buy first: ${missing.map((m) => `${m.id} (${m.price} gold)`).join(', ')}.` };
  const list = [{ name: label, config: withBakeKey(design) }, ...listDesigns(store).filter((d) => d.name !== label)].slice(0, 20);
  try { store?.setItem(DESIGNS_KEY, JSON.stringify(list)); } catch { return { ok: false, reason: 'This device would not save the design.' }; }
  return { ok: true };
}
