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
import { PAINTED_PARTS, paintedPlacement, rigAnchor, type RigAnchorId } from './painted-parts';

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

type LayerFn = (c: Ctx) => string;

const BG: Record<string, LayerFn> = {
  'workshop-wall': () => `<rect width="256" height="256" fill="#3a2f28"/><g stroke="#2a211c" stroke-width="3">${[40, 90, 140, 190, 240].map((y) => `<line x1="0" y1="${y}" x2="256" y2="${y}"/>`).join('')}</g>${[20, 236].map((x) => `<circle cx="${x}" cy="20" r="4" fill="#6b5a4a"/>`).join('')}`,
  'furnace-glow': (c) => `<defs><radialGradient id="${c.id('fg')}" cx="50%" cy="100%" r="80%"><stop offset="0" stop-color="#ff8a2a"/><stop offset="1" stop-color="#2a1208"/></radialGradient></defs><rect width="256" height="256" fill="url(#${c.id('fg')})"/>`,
  'racing-pennants': (c) => `<rect width="256" height="256" fill="#26303a"/><path d="M0 30 Q128 70 256 30" stroke="#111" fill="none"/>${[0, 1, 2, 3, 4, 5, 6].map((i) => `<path d="M${i * 40 + 6} ${38 + Math.sin(i) * 6} l14 28 l14 -26z" fill="${i % 2 ? c.accent : '#e8e2cf'}"/>`).join('')}`,
  'smog-sky': (c) => `<defs><linearGradient id="${c.id('sm')}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6c6a5d"/><stop offset="1" stop-color="#b19366"/></linearGradient></defs><rect width="256" height="256" fill="url(#${c.id('sm')})"/><rect x="20" y="120" width="18" height="136" fill="#2d2a26"/><rect x="200" y="100" width="22" height="156" fill="#2d2a26"/>`,
};

const EARS: Record<string, LayerFn> = {
  'bat-pointed': (c) => `<path d="M${128 - c.headW + 8} 130 L${128 - c.headW - 52} 70 L${128 - c.headW + 14} 108Z M${128 + c.headW - 8} 130 L${128 + c.headW + 52} 70 L${128 + c.headW - 14} 108Z" fill="${c.skin.base}" stroke="${c.skin.shade}" stroke-width="3"/>`,
  'notched-fins': (c) => `<path d="M${128 - c.headW + 6} 140 L${128 - c.headW - 40} 100 l10 14 l-14 4 l12 12 L${128 - c.headW + 6} 118Z M${128 + c.headW - 6} 140 L${128 + c.headW + 40} 100 l-10 14 l14 4 l-12 12 L${128 + c.headW - 6} 118Z" fill="${c.skin.base}" stroke="${c.skin.shade}" stroke-width="3"/>`,
  'torn-brass-ring': (c) => `<path d="M${128 - c.headW + 8} 132 L${128 - c.headW - 48} 78 l18 26 l-8 2 L${128 - c.headW + 12} 110Z M${128 + c.headW - 8} 132 L${128 + c.headW + 48} 74 L${128 + c.headW - 12} 110Z" fill="${c.skin.base}" stroke="${c.skin.shade}" stroke-width="3"/><circle cx="${128 + c.headW + 22}" cy="98" r="7" fill="none" stroke="${c.metal}" stroke-width="3"/>`,
  'droopy-hound': (c) => `<path d="M${128 - c.headW + 6} 118 Q${128 - c.headW - 40} 130 ${128 - c.headW - 26} 180 Q${128 - c.headW} 170 ${128 - c.headW + 10} 150Z M${128 + c.headW - 6} 118 Q${128 + c.headW + 40} 130 ${128 + c.headW + 26} 180 Q${128 + c.headW} 170 ${128 + c.headW - 10} 150Z" fill="${c.skin.base}" stroke="${c.skin.shade}" stroke-width="3"/>`,
};

const HEAD: Record<string, LayerFn> = {
  angular: (c) => `<path d="M${128 - c.headW} 110 L128 ${c.headTop} L${128 + c.headW} 110 L${128 + c.headW - 12} 190 L128 214 L${128 - c.headW + 12} 190Z" fill="${c.skin.base}" stroke="${c.skin.shade}" stroke-width="4"/>`,
  bloated: (c) => `<ellipse cx="128" cy="146" rx="${c.headW}" ry="70" fill="${c.skin.base}" stroke="${c.skin.shade}" stroke-width="4"/><ellipse cx="110" cy="120" rx="22" ry="14" fill="${c.skin.light}" opacity=".35"/>`,
  scrawny: (c) => `<path d="M128 ${c.headTop} C${128 + c.headW + 10} ${c.headTop} ${128 + c.headW} 180 128 218 C${128 - c.headW} 180 ${128 - c.headW - 10} ${c.headTop} 128 ${c.headTop}Z" fill="${c.skin.base}" stroke="${c.skin.shade}" stroke-width="4"/>`,
};

const WARPAINT: Record<string, LayerFn> = {
  none: () => '',
  'mud-stripes': () => `<g stroke="#4a3320" stroke-width="7" stroke-linecap="round" opacity=".8"><line x1="84" y1="150" x2="108" y2="156"/><line x1="86" y1="166" x2="108" y2="170"/><line x1="172" y1="150" x2="148" y2="156"/><line x1="170" y1="166" x2="148" y2="170"/></g>`,
  'red-handprint': () => `<g fill="#b3261e" opacity=".75"><ellipse cx="160" cy="160" rx="16" ry="14"/>${[0, 1, 2, 3].map((i) => `<rect x="${146 + i * 8}" y="128" width="6" height="22" rx="3"/>`).join('')}</g>`,
  'cog-tattoo': () => `<g transform="translate(96 176)" fill="none" stroke="#23405a" stroke-width="3"><circle r="9"/>${[0, 45, 90, 135, 180, 225, 270, 315].map((a) => `<line x1="0" y1="-9" x2="0" y2="-14" transform="rotate(${a})"/>`).join('')}</g>`,
  'soot-smudges': () => `<g fill="#1b1714" opacity=".35"><ellipse cx="100" cy="176" rx="18" ry="8"/><ellipse cx="164" cy="120" rx="12" ry="6"/></g>`,
};

const MOUTH: Record<string, LayerFn> = {
  'lower-tusks': () => `<path d="M100 186 Q128 198 156 186" stroke="#2a1a12" stroke-width="5" fill="none"/><path d="M106 190 l4 -20 l6 18Z M150 190 l-4 -20 l-6 18Z" fill="#efe6c8" stroke="#8b8062" stroke-width="2"/>`,
  'gold-jags': (c) => `<path d="M98 184 Q128 204 158 184 Z" fill="#2a1a12"/><path d="M104 186 l6 8 l6 -7 l6 8 l6 -8 l6 8 l6 -8 l6 7 l6 -8" stroke="${c.metal === METAL_PALETTE[1] ? '#e8c547' : c.metal}" stroke-width="3" fill="none"/>`,
  'cigar-stub': () => `<path d="M104 188 Q128 194 150 186" stroke="#2a1a12" stroke-width="5" fill="none"/><rect x="146" y="182" width="34" height="9" rx="3" fill="#6b3f22" transform="rotate(-12 146 186)"/><circle cx="180" cy="178" r="4" fill="#ff7a2a"/>`,
  'stitched-scar': () => `<path d="M100 188 Q128 196 156 188" stroke="#2a1a12" stroke-width="5" fill="none"/><path d="M142 168 L162 206" stroke="#5a2a22" stroke-width="3"/>${[0, 1, 2, 3].map((i) => `<line x1="${144 + i * 5}" y1="${176 + i * 8}" x2="${154 + i * 5}" y2="${172 + i * 8}" stroke="#5a2a22" stroke-width="2"/>`).join('')}`,
};

const NOSE: Record<string, LayerFn> = {
  'hooked-beak': (c) => `<path d="M128 138 Q148 160 136 176 Q128 172 122 166Z" fill="${c.skin.shade}"/>`,
  'warted-bulb': (c) => `<circle cx="128" cy="164" r="14" fill="${c.skin.shade}"/><circle cx="136" cy="158" r="3" fill="${c.skin.light}"/>`,
  'prosthetic-plate': (c) => `<path d="M118 142 L138 142 L142 172 L114 172Z" fill="${c.metal}" stroke="#2a2a2a" stroke-width="2"/><circle cx="120" cy="148" r="2" fill="#222"/><circle cx="136" cy="148" r="2" fill="#222"/>`,
};

const EYES: Record<string, LayerFn> = {
  'bloodshot-crazy': () => `<g><circle cx="104" cy="130" r="14" fill="#fff6d8" stroke="#b33" stroke-width="1.5"/><circle cx="152" cy="130" r="17" fill="#fff6d8" stroke="#b33" stroke-width="1.5"/><circle cx="107" cy="132" r="5" fill="#1a1a1a"/><circle cx="148" cy="127" r="6" fill="#1a1a1a"/></g>`,
  'narrow-squint': () => `<path d="M88 132 Q104 122 120 132 Q104 138 88 132Z M136 132 Q152 122 168 132 Q152 138 136 132Z" fill="#fff6d8"/><circle cx="104" cy="131" r="4" fill="#1a1a1a"/><circle cx="152" cy="131" r="4" fill="#1a1a1a"/>`,
  'wide-mismatched': (c) => `<circle cx="104" cy="130" r="12" fill="#f5e27a"/><circle cx="152" cy="130" r="12" fill="${c.accent}"/><rect x="101" y="122" width="6" height="16" rx="3" fill="#111"/><rect x="149" y="122" width="6" height="16" rx="3" fill="#111"/>`,
  'sleepy-lidded': (c) => `<circle cx="104" cy="132" r="11" fill="#fff6d8"/><circle cx="152" cy="132" r="11" fill="#fff6d8"/><circle cx="104" cy="135" r="4" fill="#111"/><circle cx="152" cy="135" r="4" fill="#111"/><path d="M92 132 A12 12 0 0 1 116 132Z M140 132 A12 12 0 0 1 164 132Z" fill="${c.skin.shade}"/>`,
};

const EYEWEAR: Record<string, LayerFn> = {
  none: () => '',
  'goggles-up': (c) => `<g transform="translate(0 -44)"><rect x="80" y="118" width="96" height="10" fill="${c.leather}"/><circle cx="104" cy="124" r="15" fill="#6fb7c9" stroke="${c.metal}" stroke-width="5"/><circle cx="152" cy="124" r="15" fill="#6fb7c9" stroke="${c.metal}" stroke-width="5"/></g>`,
  'goggles-down': (c) => `<rect x="76" y="124" width="104" height="12" fill="${c.leather}"/><circle cx="104" cy="130" r="17" fill="#3d6b52" opacity=".85" stroke="${c.metal}" stroke-width="6"/><circle cx="152" cy="130" r="17" fill="#3d6b52" opacity=".85" stroke="${c.metal}" stroke-width="6"/><circle cx="98" cy="124" r="4" fill="#fff" opacity=".6"/>`,
  'brass-monocle': (c) => `<circle cx="152" cy="130" r="18" fill="#cfe7ff" opacity=".25" stroke="${c.metal}" stroke-width="4"/><path d="M168 138 Q176 180 164 210" stroke="${c.metal}" stroke-width="2" fill="none"/>`,
  'leather-eyepatch': (c) => `<line x1="84" y1="104" x2="176" y2="150" stroke="${c.leather}" stroke-width="5"/><ellipse cx="104" cy="130" rx="17" ry="14" fill="${c.leather}"/>`,
};

const HAIR: Record<string, LayerFn> = {
  none: () => '',
  'grease-mohawk': (c) => `<path d="M112 ${c.headTop + 8} ${[0, 1, 2, 3, 4].map((i) => `L${116 + i * 6} ${c.headTop - 30 + (i % 2) * 12}`).join(' ')} L146 ${c.headTop + 8}Z" fill="#1d1d1f"/><path d="M118 ${c.headTop - 18} L140 ${c.headTop - 20}" stroke="#555" stroke-width="2"/>`,
  'mutton-chops': () => `<path d="M76 140 Q72 190 108 196 L108 176 Q88 170 90 140Z M180 140 Q184 190 148 196 L148 176 Q168 170 166 140Z" fill="#3a2b20"/>`,
  'singed-topknot': (c) => `<ellipse cx="128" cy="${c.headTop - 8}" rx="14" ry="12" fill="#2a2320"/><rect x="120" y="${c.headTop}" width="16" height="6" fill="${c.accent}"/><path d="M128 ${c.headTop - 20} q6 -8 0 -14 q-6 8 0 14" fill="#ff8a2a"/>`,
  'wire-tufts': (c) => `<g stroke="#44403a" stroke-width="3">${[-30, -14, 0, 14, 30].map((dx) => `<line x1="${128 + dx}" y1="${c.headTop + 10}" x2="${128 + dx * 1.5}" y2="${c.headTop - 18}"/>`).join('')}</g>`,
};

const HEADGEAR: Record<string, LayerFn> = {
  none: () => '',
  'aviator-cap': (c) => `<path d="M${128 - c.headW - 4} 118 Q128 ${c.headTop - 30} ${128 + c.headW + 4} 118 L${128 + c.headW + 6} 160 L${128 + c.headW - 10} 160 L${128 + c.headW - 12} 124 L${128 - c.headW + 12} 124 L${128 - c.headW + 10} 160 L${128 - c.headW - 6} 160Z" fill="${c.leather}" stroke="#1c140e" stroke-width="3"/>`,
  'miner-headlamp': (c) => `<path d="M${128 - c.headW} 112 Q128 ${c.headTop - 34} ${128 + c.headW} 112Z" fill="#d6b43a" stroke="#6b5a1c" stroke-width="3"/><circle cx="128" cy="${c.headTop - 2}" r="11" fill="#fff8c0" stroke="${c.metal}" stroke-width="4"/>`,
  pickelhaube: (c) => `<path d="M${128 - c.headW + 2} 114 Q128 ${c.headTop - 26} ${128 + c.headW - 2} 114Z" fill="#1f1f22" stroke="${c.metal}" stroke-width="3"/><path d="M122 ${c.headTop - 14} L128 ${c.headTop - 46} L134 ${c.headTop - 14}Z" fill="${c.metal}"/>`,
  'grease-bowler': (c) => `<ellipse cx="128" cy="112" rx="${c.headW + 16}" ry="10" fill="#1d1a18"/><path d="M${128 - c.headW + 10} 112 Q${128 - c.headW + 10} ${c.headTop - 30} 128 ${c.headTop - 30} Q${128 + c.headW - 10} ${c.headTop - 30} ${128 + c.headW - 10} 112Z" fill="#26211e"/><rect x="${128 - c.headW + 10}" y="100" width="${2 * c.headW - 20}" height="8" fill="${c.accent}"/>`,
};

const NECK: Record<string, LayerFn> = {
  none: () => '',
  'spiked-collar': (c) => `<rect x="92" y="212" width="72" height="14" fill="${c.leather}"/>${[0, 1, 2, 3, 4].map((i) => `<path d="M${98 + i * 15} 212 l5 -12 l5 12Z" fill="${c.metal}"/>`).join('')}`,
  'gear-chain': (c) => `<path d="M88 214 Q128 244 168 214" stroke="${c.metal}" stroke-width="4" fill="none" stroke-dasharray="6 3"/><circle cx="128" cy="234" r="10" fill="none" stroke="${c.metal}" stroke-width="5" stroke-dasharray="4 2"/>`,
  'boiler-suit': (c) => `<path d="M60 256 L90 214 L128 234 L166 214 L196 256Z" fill="${c.accent}" opacity=".85"/><path d="M90 214 L110 256 M166 214 L146 256" stroke="#1f1f22" stroke-width="3"/>`,
  'tool-bandolier': (c) => `<path d="M70 256 L186 208" stroke="${c.leather}" stroke-width="16"/>${[0, 1, 2].map((i) => `<rect x="${96 + i * 28}" y="${232 - i * 11}" width="8" height="18" fill="${c.metal}" transform="rotate(-22 ${100 + i * 28} ${240 - i * 11})"/>`).join('')}`,
};

const REGISTRY: Record<AvatarLayerId, Record<string, LayerFn>> = {
  background: BG, ears: EARS, head: HEAD, warpaint: WARPAINT, mouth: MOUTH, nose: NOSE,
  eyes: EYES, eyewear: EYEWEAR, hair: HAIR, headgear: HEADGEAR, neck: NECK,
};

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
  const hat = AVATAR_CATALOG.headgear[config.layers.headgear];
  const painted = PAINTED_PARTS.find((p) => `painted:${p.id}` === hat);
  if (painted) return (painted.hidesHair ?? []).includes(config.layers.hair);
  return config.layers.headgear !== 0 && [1, 3].includes(config.layers.hair);
}

export function occlusionNotes(config: GoblinAvatarConfig): string[] {
  const notes: string[] = [];
  if (hairHidden(config)) notes.push(`${AVATAR_CATALOG.headgear[config.layers.headgear].replace('painted:', '')} hides the ${AVATAR_CATALOG.hair[config.layers.hair]}`);
  const mouth = PAINTED_PARTS.find((p) => `painted:${p.id}` === AVATAR_CATALOG.mouth[config.layers.mouth]);
  if (mouth?.skinLocked && config.skin !== mouth.skinLocked) notes.push(`${mouth.name} has painted ${mouth.skinLocked} lips — tint mask pending (Plan §9.6)`);
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

function paintedFragment(item: string, c: Ctx, resolve: (u: string) => string): string {
  const place = paintedPlacement(item, c);
  if (!place) return '';
  return `<image href="${resolve(place.file.file)}" x="${place.x.toFixed(2)}" y="${place.y.toFixed(2)}" width="${place.w.toFixed(2)}" height="${place.h.toFixed(2)}" preserveAspectRatio="none"/>`;
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
  const fragments = RENDER_ORDER.map((layer) => {
    if (layer === 'background' && options.transparentBackground) return '';
    if (layer === 'hair' && hairHidden(config)) return '';
    const item = AVATAR_CATALOG[layer][config.layers[layer]];
    if (!item) return '';
    const ctx: Ctx = { ...base, item };
    const inner = item.startsWith('painted:') ? paintedFragment(item, ctx, resolve) : (REGISTRY[layer][item]?.(ctx) ?? '');
    if (!inner) return '';
    const t = layerTransform(config, layer);
    const body = spreadWrap(inner, t.spread, base.id, layer);
    const dim = options.focusLayer && options.focusLayer !== layer && layer !== 'background' ? ' opacity="0.35"' : '';
    return `<g data-layer="${layer}" data-item="${item}"${dim}><g transform="translate(${t.dx} ${t.dy})">${body}</g></g>`;
  });
  let guides = '';
  if (options.guides) {
    guides = `<g data-guides="1" pointer-events="none" font-family="monospace" font-size="6">${GUIDE_ANCHORS.map((a) => {
      const p = rigAnchor(a, base);
      return `<g stroke="#ff00ff" stroke-width="0.8"><line x1="${p.x - 5}" y1="${p.y}" x2="${p.x + 5}" y2="${p.y}"/><line x1="${p.x}" y1="${p.y - 5}" x2="${p.x}" y2="${p.y + 5}"/></g><text x="${p.x + 6}" y="${p.y - 3}" fill="#ff7cff">${a}</text>`;
    }).join('')}<line x1="128" y1="0" x2="128" y2="256" stroke="#ff00ff" stroke-width="0.5" stroke-dasharray="3 3"/></g>`;
  }
  const size = options.size ?? 256;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="${size}" height="${size}">${fragments.join('')}${guides}</svg>`;
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
  const urls = RENDER_ORDER.map((l) => AVATAR_CATALOG[l][config.layers[l]]).filter((i) => i?.startsWith('painted:'))
    .map((i) => paintedPlacement(i, { headW: 54, headTop: 70 })?.file.file).filter((u): u is string => !!u);
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
