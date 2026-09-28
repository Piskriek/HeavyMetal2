/**
 * Modular goblin compositor (Deliverable 3).
 * Target in game repo: `src/game/avatar/goblin-compositor.ts`.
 *
 * Pipeline: GoblinAvatarConfig → ordered layer fragments (pure strings, node-testable, snapshot-able)
 *           → one 256×256 SVG document → rasterized ONCE into a canvas (headshot / billboard sprite).
 * Every layer function is `(ctx) => string` and never reads global state, so the output for a DNA is
 * byte-identical across machines (required for the deterministic test suite).
 */
import type { AvatarLayerId, GoblinAvatarConfig, NudgeLayerId, SpreadLayerId } from './interfaces';
import {
  ACCENT_PALETTE, AVATAR_CATALOG, LEATHER_PALETTE, METAL_PALETTE, NUDGE_LAYERS, NUDGE_PARENT, NUDGE_STEP_PX,
  SKIN_TONES, SPREAD_LAYERS, SPREAD_STEP_PX,
} from './goblin-dna';
import { PAINTED_PARTS, drawnItem, paintedPlacement, rigAnchor, type RigAnchorId } from './painted-parts';
import { PART_MASKS, type MaskChannel } from './painted-masks.generated';
import { PART_DEPTH } from './painted-depth.generated';

/** The colours the parts are painted in: a swatch equal to these needs no re-tint. */
const PAINTED_DEFAULTS: Readonly<Record<MaskChannel, string>> = {
  skin: SKIN_TONES[0].base, leather: LEATHER_PALETTE[0], metal: METAL_PALETTE[0], accent: ACCENT_PALETTE[0],
};
export const maskUrl = (id: string, channel: MaskChannel) => `/avatar-parts/masks/${id}-${channel}.png`;
export const depthUrl = (id: string) => `/avatar-parts/depth/${id}.png`;

interface Ctx {
  skin: (typeof SKIN_TONES)[number];
  accent: string;
  leather: string;
  metal: string;
  item: string;
  headW: number; // half-width of head, depends on head shape
  headTop: number;
  id: (name: string) => string; // namespaced ids so many inline SVGs can share one DOM
}

/*
 * Every goblin is painted. The vector items of DNA v1/v2 keep their catalog index so old codes still
 * decode, but each one draws as its painted twin (painted-parts.ts `replaces`).
 */

/** Render order (back → front). Neck sits last so collars overlap the chin line. */
export const RENDER_ORDER: readonly AvatarLayerId[] = ['background', 'ears', 'head', 'warpaint', 'mouth', 'nose', 'eyes', 'eyewear', 'hair', 'headgear', 'neck'];

export interface ComposeOptions {
  size?: number;
  transparentBackground?: boolean;
  /** Prefix for gradient/clip ids — REQUIRED to be unique when several SVGs are inlined in one document. */
  idPrefix?: string;
  /** Map painted part URLs (e.g. to data: URIs for rasterization, where external hrefs are blocked). */
  resolveImage?: (url: string) => string;
  /** Draw rig anchors + selected layer's slot for the registration/nudge UI. */
  guides?: boolean;
  /** Dim every layer except this one (focus mode in the creator). */
  focusLayer?: AvatarLayerId | null;
}

export interface LayerTransform { dx: number; dy: number; spread: number }

const isNudgeLayer = (l: AvatarLayerId): l is NudgeLayerId => (NUDGE_LAYERS as readonly string[]).includes(l);
const isSpreadLayer = (l: string): l is SpreadLayerId => (SPREAD_LAYERS as readonly string[]).includes(l);

/** Resolved pixel transform for a layer, including parent inheritance (eyewear rides on the eyes). */
export function layerTransform(config: GoblinAvatarConfig, layer: AvatarLayerId): LayerTransform {
  if (!isNudgeLayer(layer)) return { dx: 0, dy: 0, spread: 0 };
  const own = config.nudge?.offset[layer];
  let dx = (own?.x ?? 0) * NUDGE_STEP_PX[layer];
  let dy = (own?.y ?? 0) * NUDGE_STEP_PX[layer];
  let spread = isSpreadLayer(layer) ? (config.nudge?.spread[layer] ?? 0) * SPREAD_STEP_PX[layer] : 0;
  const parent = NUDGE_PARENT[layer];
  if (parent) {
    const p = layerTransform(config, parent);
    dx += p.dx; dy += p.dy; spread = p.spread;
  }
  return { dx, dy, spread };
}

/** Hair occlusion: SVG headgear hides mohawk/topknot; painted parts declare their own hidden set. */
function hairHidden(config: GoblinAvatarConfig): boolean {
  const hat = drawnItem('headgear', AVATAR_CATALOG.headgear[config.layers.headgear]);
  const painted = PAINTED_PARTS.find((p) => `painted:${p.id}` === hat);
  return !!painted && (painted.hidesHair ?? []).includes(config.layers.hair);
}

export function occlusionNotes(config: GoblinAvatarConfig): string[] {
  const notes: string[] = [];
  const plain = (s: string) => s.replace('painted:', '').replace(/^(headgear|mouth)-/, '').replace(/-/g, ' ');
  const name = (layer: AvatarLayerId) => {
    const item = drawnItem(layer, AVATAR_CATALOG[layer][config.layers[layer]]);
    return (PAINTED_PARTS.find((p) => `painted:${p.id}` === item)?.name ?? plain(item)).toLowerCase();
  };
  if (hairHidden(config)) notes.push(`The ${name('headgear')} hides the ${name('hair')}.`);
  const mouth = PAINTED_PARTS.find((p) => `painted:${p.id}` === drawnItem('mouth', AVATAR_CATALOG.mouth[config.layers.mouth]));
  if (mouth?.skinLocked && config.skin !== mouth.skinLocked) notes.push(`The ${plain(mouth.id)} has painted green lips, so they keep their colour.`);
  return notes;
}

/** Symmetric spread: left half shifts −s, right half +s; a centre strip back-fills bridges (goggle straps). */
function spreadWrap(frag: string, s: number, id: (n: string) => string, key: string) {
  if (!s) return frag;
  const L = id(`${key}L`), R = id(`${key}R`), C = id(`${key}C`);
  const defs = `<defs><clipPath id="${L}"><rect x="-128" y="-128" width="256" height="512"/></clipPath><clipPath id="${R}"><rect x="128" y="-128" width="256" height="512"/></clipPath>${s > 0 ? `<clipPath id="${C}"><rect x="${128 - s}" y="-128" width="${2 * s}" height="512"/></clipPath>` : ''}</defs>`;
  const centre = s > 0 ? `<g clip-path="url(#${C})">${frag}</g>` : '';
  return `${defs}${centre}<g transform="translate(${-s} 0)"><g clip-path="url(#${L})">${frag}</g></g><g transform="translate(${s} 0)"><g clip-path="url(#${R})">${frag}</g></g>`;
}

type Pass = 'whole' | 'front' | 'back';

/**
 * One painted part. A part with a depth mask is drawn in two passes: 'back' (through the inverted mask,
 * behind the head) and 'front' (through the mask, in its own layer). The two add up to the part.
 * `clip` is a mask id the whole part is drawn through (war paint stays on the painted skin).
 */
function paintedFragment(item: string, c: Ctx, resolve: (u: string) => string, pass: Pass = 'whole', clip?: string): string {
  const place = paintedPlacement(item, c);
  if (!place) return '';
  const box = `x="${place.x.toFixed(2)}" y="${place.y.toFixed(2)}" width="${place.w.toFixed(2)}" height="${place.h.toFixed(2)}"`;
  // Tint masks (plan §9.6): the swatch colour through the channel's mask, blended as colour, so the
  // painted light and shade stay and only hue and saturation change.
  const swatch: Record<MaskChannel, string> = { skin: c.skin.base, leather: c.leather, metal: c.metal, accent: c.accent };
  const channels = (PART_MASKS[place.def.id] ?? []).filter((ch) => swatch[ch].toLowerCase() !== PAINTED_DEFAULTS[ch].toLowerCase());
  const maskId = (ch: MaskChannel) => c.id(`m-${place.def.id}-${ch}`);
  // Masks are defined once, outside the mirror, in user space: a mirrored ear reuses them mirrored.
  const defs = channels.length
    ? `<defs>${channels.map((ch) => `<mask id="${maskId(ch)}" maskUnits="userSpaceOnUse"><image href="${resolve(maskUrl(place.def.id, ch))}" ${box} preserveAspectRatio="none"/></mask>`).join('')}</defs>`
    : '';
  const tints = channels.map((ch) => `<rect ${box} fill="${swatch[ch]}" mask="url(#${maskId(ch)})" style="mix-blend-mode:color"/>`).join('');
  let part = `<image href="${resolve(place.file.file)}" ${box} preserveAspectRatio="none"/>${tints}`;
  let depthDefs = '';
  if (pass !== 'whole') {
    const d = c.id(`d-${place.def.id}-${pass}`);
    // White = in front. The back pass inverts the mask (in sRGB, so mid-greys stay symmetric).
    const invert = pass === 'back'
      ? `<filter id="${d}-i" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="-1 0 0 0 1 0 -1 0 0 1 0 0 -1 0 1 0 0 0 1 0"/></filter>`
      : '';
    depthDefs = `<defs>${invert}<mask id="${d}" maskUnits="userSpaceOnUse"><image href="${resolve(depthUrl(place.def.id))}" ${box} preserveAspectRatio="none"${pass === 'back' ? ` filter="url(#${d}-i)"` : ''}/></mask></defs>`;
    part = `<g mask="url(#${d})">${part}</g>`;
  }
  if (clip) part = `<g mask="url(#${clip})">${part}</g>`;
  // Ears: the right ear is the left one mirrored about the face's centre line (x = 128).
  return defs + depthDefs + (place.def.mirrorPair ? `${part}<g transform="translate(256 0) scale(-1 1)">${part}</g>` : part);
}

const GUIDE_ANCHORS: readonly RigAnchorId[] = ['eye-left', 'eye-mid', 'eye-right', 'brow-line', 'crown', 'nose', 'mouth', 'chin'];

export function composeGoblinSvg(config: GoblinAvatarConfig, options: ComposeOptions = {}): string {
  const skin = SKIN_TONES.find((s) => s.id === config.skin) ?? SKIN_TONES[0];
  const headShape = AVATAR_CATALOG.head[config.layers.head];
  const prefix = options.idPrefix ?? 'gob';
  const resolve = options.resolveImage ?? ((u: string) => u);
  const base: Omit<Ctx, 'item'> = {
    skin, accent: ACCENT_PALETTE[config.accent], leather: LEATHER_PALETTE[config.leather], metal: METAL_PALETTE[config.metal],
    headW: headShape === 'bloated' ? 62 : headShape === 'scrawny' ? 44 : 54,
    headTop: headShape === 'bloated' ? 78 : 70,
    id: (name) => `${prefix}-${name}`,
  };
  const shown = (layer: AvatarLayerId) => {
    if (layer === 'background' && options.transparentBackground) return '';
    if (layer === 'hair' && hairHidden(config)) return '';
    const item = AVATAR_CATALOG[layer][config.layers[layer]];
    return item ? drawnItem(layer, item) : '';
  };
  const dimmed = (layer: AvatarLayerId) => (options.focusLayer && options.focusLayer !== layer && layer !== 'background' ? ' opacity="0.35"' : '');
  const hasDepth = (item: string) => item.startsWith('painted:') && PART_DEPTH.has(item.slice(8));
  // War paint is clipped to the painted head's own outline, so strokes never land on the background.
  const head = shown('head');
  const headPlace = head ? paintedPlacement(head, base) : null;
  const skinClip = headPlace ? base.id('skin-clip') : undefined;
  const skinClipDefs = headPlace
    ? `<defs><mask id="${skinClip}" maskUnits="userSpaceOnUse" style="mask-type:alpha"><image href="${resolve(headPlace.file.file)}" x="${headPlace.x.toFixed(2)}" y="${headPlace.y.toFixed(2)}" width="${headPlace.w.toFixed(2)}" height="${headPlace.h.toFixed(2)}" preserveAspectRatio="none"/></mask></defs>`
    : '';
  const wrap = (layer: AvatarLayerId, item: string, inner: string, suffix = '') => {
    const t = layerTransform(config, layer);
    const body = spreadWrap(inner, t.spread, base.id, layer + suffix);
    return `<g data-layer="${layer}${suffix}" data-item="${item}"${dimmed(layer)}><g transform="translate(${t.dx} ${t.dy})">${body}</g></g>`;
  };
  // Back pass: the hidden half of every wrap-around part, drawn behind the ears and the head.
  const back = RENDER_ORDER.filter((l) => l !== 'background').map((layer) => {
    const item = shown(layer);
    if (!hasDepth(item)) return '';
    const inner = paintedFragment(item, { ...base, item }, resolve, 'back');
    return inner ? wrap(layer, item, inner, '-back') : '';
  }).join('');
  const fragments = RENDER_ORDER.map((layer) => {
    const item = shown(layer);
    if (!item.startsWith('painted:')) return '';
    const ctx: Ctx = { ...base, item };
    const inner = paintedFragment(item, ctx, resolve, hasDepth(item) ? 'front' : 'whole', layer === 'warpaint' ? skinClip : undefined);
    if (!inner) return '';
    return (layer === 'ears' ? back : '') + wrap(layer, item, inner);
  });
  // No ears: the back pass still goes right after the background.
  if (!shown('ears').startsWith('painted:')) fragments.splice(1, 0, back);
  let guides = '';
  if (options.guides) {
    guides = `<g data-guides="1" pointer-events="none" font-family="monospace" font-size="6">${GUIDE_ANCHORS.map((a) => {
      const p = rigAnchor(a, base);
      return `<g stroke="#ff00ff" stroke-width="0.8"><line x1="${p.x - 5}" y1="${p.y}" x2="${p.x + 5}" y2="${p.y}"/><line x1="${p.x}" y1="${p.y - 5}" x2="${p.x}" y2="${p.y + 5}"/></g><text x="${p.x + 6}" y="${p.y - 3}" fill="#ff7cff">${a}</text>`;
    }).join('')}<line x1="128" y1="0" x2="128" y2="256" stroke="#ff00ff" stroke-width="0.5" stroke-dasharray="3 3"/></g>`;
  }
  const size = options.size ?? 256;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="${size}" height="${size}">${skinClipDefs}${fragments.join('')}${guides}</svg>`;
}

/**
 * Browser rasterizer. External <image href> is blocked when an SVG is drawn as an image, so painted
 * parts are inlined as data: URIs first (fetched once, cached). Output feeds HUD/pointer/billboards.
 */
const dataUriCache = new Map<string, Promise<string>>();
export function toDataUri(url: string): Promise<string> {
  let p = dataUriCache.get(url);
  if (!p) {
    p = fetch(url).then((r) => r.blob()).then((b) => new Promise<string>((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result)); fr.onerror = rej; fr.readAsDataURL(b); }));
    dataUriCache.set(url, p);
  }
  return p;
}

export async function rasterizeGoblin(config: GoblinAvatarConfig, size = 256, transparentBackground = false): Promise<HTMLCanvasElement> {
  const urls = RENDER_ORDER.map((l) => drawnItem(l, AVATAR_CATALOG[l][config.layers[l]] ?? '')).filter((i) => i.startsWith('painted:')).flatMap((i) => {
    const place = paintedPlacement(i, { headW: 54, headTop: 70 });
    if (!place) return [];
    return [place.file.file, ...(PART_MASKS[place.def.id] ?? []).map((ch) => maskUrl(place.def.id, ch)), ...(PART_DEPTH.has(place.def.id) ? [depthUrl(place.def.id)] : [])];
  });
  const map = new Map<string, string>();
  await Promise.all(urls.map(async (u) => map.set(u, await toDataUri(u))));
  const svg = composeGoblinSvg(config, { size, transparentBackground, idPrefix: 'r', resolveImage: (u) => map.get(u) ?? u });
  const img = new Image();
  img.decoding = 'async';
  img.src = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d');
  if (!g) throw new Error('Canvas is unavailable.');
  g.drawImage(img, 0, 0, size, size);
  URL.revokeObjectURL(img.src);
  return canvas;
}
