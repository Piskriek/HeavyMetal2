/**
 * @hm/skin: sprites and skins as palettes in **OKLab** (plan 43, step 4's `@hm/skin`).
 *
 * A shareware-era picture is a grid of palette indices, not colours, and which palette you get is a property of the Fidelity
 * Stage: one bit at S0 (a black-and-white dither), sixteen EGA colours at S1, a VGA ramp at S2, and the honest colour of the
 * art from S3 on. Quantising in sRGB picks the wrong neighbour — a red and an orange are far apart in RGB and close to the eye
 * — so every palette here is measured in OKLab, where a distance is a distance the eye would agree with (Björn Ottosson's
 * Oklab: `L` lightness, `a` green-red, `b` blue-yellow, all roughly perceptual).
 *
 * Pure: no DOM, no clock, no randomness. The only state is the frozen tables, and every function returns new data.
 */

/** An OKLab colour. `L` is 0 (black) to 1 (white); `a` and `b` are small signed numbers. */
export interface Lab {
  readonly l: number;
  readonly a: number;
  readonly b: number;
}

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
const fin = (v: number, fallback: number): number => (Number.isFinite(v) ? v : fallback);

/** '#rrggbb' (or '#rgb') to its three sRGB channels in 0..1. Anything unreadable is black. */
export function parseHex(hex: string): readonly [number, number, number] {
  const s = hex.trim().replace(/^#/, '');
  const full = s.length === 3 ? s.split('').map((c) => c + c).join('') : s;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return [0, 0, 0];
  return [parseInt(full.slice(0, 2), 16) / 255, parseInt(full.slice(2, 4), 16) / 255, parseInt(full.slice(4, 6), 16) / 255];
}

/** Three sRGB channels in 0..1 as '#rrggbb' (clamped, rounded). */
export function toHex(rgb: readonly [number, number, number]): string {
  const byte = (v: number): string => Math.round(clamp01(fin(v, 0)) * 255).toString(16).padStart(2, '0');
  return `#${byte(rgb[0])}${byte(rgb[1])}${byte(rgb[2])}`;
}

/** sRGB transfer function, inverse (the eye's curve): a channel in 0..1 to linear light. */
const toLinear = (c: number): number => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
/** Linear light back to an sRGB channel in 0..1. */
const toGamma = (c: number): number => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);

/** '#rrggbb' as OKLab. */
export function hexToOklab(hex: string): Lab {
  const [r, g, b] = parseHex(hex).map(toLinear) as [number, number, number];
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return {
    l: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  };
}

/** OKLab back to '#rrggbb'. Out-of-gamut values are clamped channel by channel, as a palette entry has to be. */
export function oklabToHex(lab: Lab): string {
  const lp = fin(lab.l, 0) + 0.3963377774 * fin(lab.a, 0) + 0.2158037573 * fin(lab.b, 0);
  const mp = fin(lab.l, 0) - 0.1055613458 * fin(lab.a, 0) - 0.0638541728 * fin(lab.b, 0);
  const sp = fin(lab.l, 0) - 0.0894841775 * fin(lab.a, 0) - 1.291485548 * fin(lab.b, 0);
  const l = lp * lp * lp;
  const m = mp * mp * mp;
  const s = sp * sp * sp;
  const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const b = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
  return toHex([toGamma(clamp01(r)), toGamma(clamp01(g)), toGamma(clamp01(b))]);
}

/** OKLab in cylindrical form: lightness, chroma (how colourful) and hue in radians. */
export function toOklch(lab: Lab): { readonly l: number; readonly c: number; readonly h: number } {
  return { l: lab.l, c: Math.hypot(lab.a, lab.b), h: Math.atan2(lab.b, lab.a) };
}

/** Cylindrical form back to OKLab (a hue in radians, chroma clamped to something a screen can show). */
export function fromOklch(l: number, c: number, h: number): Lab {
  const chroma = Math.max(0, Math.min(0.42, fin(c, 0)));
  return { l: fin(l, 0), a: Math.cos(fin(h, 0)) * chroma, b: Math.sin(fin(h, 0)) * chroma };
}

/** How far apart two colours look: Euclidean in OKLab, where about 0.02 is a just-noticeable difference. */
export function deltaOk(a: Lab, b: Lab): number {
  return Math.hypot(a.l - b.l, a.a - b.a, a.b - b.b);
}

/** What a palette is for. `minStage` is the first Fidelity Stage that shows it. */
export interface Palette {
  readonly id: string;
  readonly name: string;
  readonly minStage: number;
  /** Bits per channel-ish: the era's own word for how much colour it has (1 = a dither of two inks). */
  readonly bitDepth: number;
  readonly colours: readonly string[];
}

const palette = (id: string, name: string, minStage: number, bitDepth: number, colours: readonly string[]): Palette =>
  Object.freeze({ id, name, minStage, bitDepth, colours: Object.freeze([...colours]) });

/** Two inks, ordered dark to light: the 1-bit dither's own pair (shareware's black and white, or the amber pairs). */
const MONO = ['#000000', '#ffffff'];

/**
 * The sixteen EGA colours. The order is EGA's own register order (0 black, 1 blue, ... 15 white) so a sprite written against
 * a real card's indices reads the same colour here.
 */
const EGA_16 = [
  '#000000', '#0000aa', '#00aa00', '#00aaaa', '#aa0000', '#aa00aa', '#aa5500', '#aaaaaa',
  '#555555', '#5555ff', '#55ff55', '#55ffff', '#ff5555', '#ff55ff', '#ffff55', '#ffffff',
];

/**
 * A 32-colour VGA ramp: eight hues at three luminances plus the greys, chosen in OKLab so the steps are evenly spaced to the
 * eye rather than to the byte.
 */
const VGA_32 = [
  '#000000', '#222034', '#45283c', '#663931', '#8f563b', '#df7126', '#d9a066', '#eec39a',
  '#fbf236', '#99e550', '#6abe30', '#37946e', '#4b692f', '#524b24', '#323c39', '#3f3f74',
  '#306082', '#5b6ee1', '#639bff', '#5fcde4', '#cbdbfc', '#ffffff', '#9badb7', '#847e87',
  '#696a6a', '#595652', '#76428a', '#ac3232', '#d95763', '#d77bba', '#8f974a', '#8a6f30',
];

/** The stage ladder's palettes, coarsest first. Every stage 3 and up draws in full colour. */
export const PALETTES: Readonly<Record<'mono' | 'ega' | 'vga' | 'true', Palette>> = Object.freeze({
  mono: palette('mono', '1-bit dither', 0, 1, MONO),
  ega: palette('ega', 'EGA 16', 1, 4, EGA_16),
  vga: palette('vga', 'VGA 32', 2, 5, VGA_32),
  true: palette('true', 'Full colour', 3, 8, VGA_32),
});

/** The palette a Fidelity Stage draws with: one bit at S0, EGA at S1, VGA at S2, full colour from S3. Pure. */
export function paletteForStage(stage: number): Palette {
  const s = Math.max(0, Math.min(6, Math.floor(fin(stage, 0))));
  if (s <= 0) return PALETTES.mono;
  if (s === 1) return PALETTES.ega;
  if (s === 2) return PALETTES.vga;
  return PALETTES.true;
}

/** Every palette's colours as OKLab, once: the tables are frozen, so measuring them once is enough. */
const LAB_CACHE = new WeakMap<Palette, readonly Lab[]>();

/** A palette measured in OKLab (cached per palette object). */
export function paletteLab(p: Palette): readonly Lab[] {
  const hit = LAB_CACHE.get(p);
  if (hit) return hit;
  const out = p.colours.map((c) => hexToOklab(c));
  LAB_CACHE.set(p, out);
  return out;
}

/**
 * The palette index nearest a colour to the eye: the shortest OKLab distance, ties going to the lower index so the answer is
 * stable. `bias` shifts the search (a dither's threshold, or a lighting term) by nudging lightness before the match.
 */
export function nearestPaletteIndex(hex: string, p: Palette, bias = 0): number {
  const target = hexToOklab(hex);
  const probe: Lab = bias === 0 ? target : { l: target.l + bias, a: target.a, b: target.b };
  const labs = paletteLab(p);
  let best = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let i = 0; i < labs.length; i += 1) {
    const d = deltaOk(probe, labs[i] as Lab);
    if (d < bestDistance) {
      bestDistance = d;
      best = i;
    }
  }
  return best;
}

/** The 4×4 ordered (Bayer) matrix, 0..15: the classic dither, which turns a palette limit into texture rather than banding. */
export const BAYER_4: readonly number[] = Object.freeze([0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]);

/** The 2×2 ordered matrix, for the coarsest pictures. */
export const BAYER_2: readonly number[] = Object.freeze([0, 2, 3, 1]);

export type Dither = 'none' | 'bayer2' | 'bayer4';

/** The dither's lightness bias at a pixel, in OKLab L: one palette step's worth, spread over the matrix. Pure. */
export function ditherBias(x: number, y: number, dither: Dither, step = 0.06): number {
  if (dither === 'none') return 0;
  if (dither === 'bayer2') {
    const m = BAYER_2[(y % 2) * 2 + (x % 2)] ?? 0;
    return (m / 4 - 0.5) * step;
  }
  const m = BAYER_4[(y % 4) * 4 + (x % 4)] ?? 0;
  return (m / 16 - 0.5) * step;
}

/** An indexed picture: `width × height` palette indices, row-major. */
export interface IndexedImage {
  readonly width: number;
  readonly height: number;
  readonly indices: Uint8Array;
  readonly palette: Palette;
}

/**
 * An RGBA buffer of '#rrggbb' colours to a palette's indices, with optional ordered dithering. Transparent pixels (alpha 0)
 * map to index 0 and stay empty, so a sprite's background is not dithered into noise. Pure.
 */
export function quantiseRgba(
  rgba: Readonly<Uint8ClampedArray>,
  width: number,
  height: number,
  p: Palette,
  dither: Dither = 'none',
): IndexedImage {
  const indices = new Uint8Array(Math.max(0, width * height));
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = y * width + x;
      const o = i * 4;
      if ((rgba[o + 3] ?? 0) === 0) {
        indices[i] = 0;
        continue;
      }
      const hex = toHex([(rgba[o] ?? 0) / 255, (rgba[o + 1] ?? 0) / 255, (rgba[o + 2] ?? 0) / 255]);
      indices[i] = nearestPaletteIndex(hex, p, ditherBias(x, y, dither));
    }
  }
  return { width, height, indices, palette: p };
}

/** An indexed picture back to RGBA (opaque). Pure. */
export function indexedToRgba(image: IndexedImage): Uint8ClampedArray {
  const out = new Uint8ClampedArray(image.width * image.height * 4);
  for (let i = 0; i < image.indices.length; i += 1) {
    const hex = image.palette.colours[image.indices[i] as number] ?? '#000000';
    const [r, g, b] = parseHex(hex);
    out[i * 4] = Math.round(r * 255);
    out[i * 4 + 1] = Math.round(g * 255);
    out[i * 4 + 2] = Math.round(b * 255);
    out[i * 4 + 3] = 255;
  }
  return out;
}

/** How a skin shifts a palette: lightness, chroma (saturation) and hue in radians, all optional. */
export interface SkinShift {
  readonly lightness?: number;
  readonly chroma?: number;
  readonly hue?: number;
}

/**
 * A palette reskinned in OKLab: every colour's lightness moved, its chroma scaled, its hue rotated — the operation a "skin"
 * is. Black and white are left alone (a shift should not tint the ink), and the palette's own id gets the shift appended so
 * two skins never look like the same palette. Pure.
 */
export function shiftPalette(p: Palette, shift: SkinShift, id = `${p.id}+skin`): Palette {
  const dl = fin(shift.lightness ?? 0, 0);
  const dc = fin(shift.chroma ?? 1, 1);
  const dh = fin(shift.hue ?? 0, 0);
  const colours = p.colours.map((hex) => {
    const lab = hexToOklab(hex);
    const { c, h } = toOklch(lab);
    if (c < 1e-4) {
      // a grey stays grey, and the paper (black) and the ink (white) stay themselves: a skin must not tint them
      if (lab.l <= 1e-6 || lab.l >= 1 - 1e-6) return hex;
      return oklabToHex({ l: clamp01(lab.l + dl), a: lab.a, b: lab.b });
    }
    const moved = fromOklch(clamp01(lab.l + dl), c * dc, h + dh);
    return oklabToHex(moved);
  });
  return palette(id, `${p.name} (${id})`, p.minStage, p.bitDepth, colours);
}

/** A picture as ANSI-free ASCII: each pixel the first letter of the palette colour it uses (for previews and tests). */
export function asciiPreview(image: IndexedImage, ink = ' .:-=+*#%@'): string {
  const rows: string[] = [];
  for (let y = 0; y < image.height; y += 1) {
    let row = '';
    for (let x = 0; x < image.width; x += 1) {
      const index = image.indices[y * image.width + x] ?? 0;
      const colour = hexToOklab(image.palette.colours[index] ?? '#000000');
      const slot = Math.min(ink.length - 1, Math.max(0, Math.round(colour.l * (ink.length - 1))));
      row += ink[slot] ?? ' ';
    }
    rows.push(row);
  }
  return rows.join('\n');
}
