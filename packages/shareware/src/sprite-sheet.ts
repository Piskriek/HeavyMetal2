/**
 * @hm/shareware/sprite-sheet: a kit's turntable as an 8-angle sprite sheet (plan 43, step 4).
 *
 * A shareware-era actor is eight pictures of the same thing from eight directions, picked by the angle between the actor and
 * the camera. The kit already knows the thing: `@hm/kitspec` holds every part as a box or a generated solid, placed by a
 * matrix. So the pictures are baked here, on the CPU, from the kit itself:
 *
 *  1. flatten the preset; each placed part is a parallelepiped (its source box through its matrix);
 *  2. for each of the sheet's angles, turn the model and project it orthographically into a square frame;
 *  3. draw the parts far to near, each as its six faces (back faces culled, flat-shaded by the light);
 *  4. quantise the frame into the Fidelity Stage's palette, in OKLab (`@hm/skin`), with the stage's own dither.
 *
 * The result is palette indices, exactly what a 1990s blitter wants; `sheetToRgba` turns it back into pixels for a canvas, and
 * `billboardFrameAt` is the one rule a billboard needs at runtime. Pure and deterministic: the same kit, the same options and
 * the same stage always bake the same sheet, byte for byte, so a `pxdc:` cartridge can carry the *recipe* and be re-baked
 * identically on the machine that applies it.
 */
import { flatten, sourceBounds, type Box3, type Kit, type Mat4, type Overrides } from '@hm/kitspec';
import {
  ditherBias,
  hexToOklab,
  fromOklch,
  indexedToRgba,
  nearestPaletteIndex,
  oklabToHex,
  paletteForStage,
  quantiseRgba,
  toHex,
  type Dither,
  type IndexedImage,
  type Palette,
} from '@hm/skin';

/** How many views a shareware actor has: eight, one every 45°. */
export const TURNTABLE_ANGLES = 8;

/** Where a sprite sheet's frames point, by index: frame 0 looks at the camera (its front), and the rest walk round. */
export const BILLBOARD_CYCLE: readonly number[] = Object.freeze([0, 1, 2, 3, 4, 5, 6, 7]);

/** What a part's material looks like when nobody said: steel and trim read grey, a lamp reads amber, and anything else gets a
 *  stable hue of its own, measured in OKLab so two random materials never accidentally look the same. */
export function defaultMaterialColour(material: string): string {
  switch (material) {
    case 'hull-steel':
    case 'steel':
      return '#8a8f98';
    case 'accent-hardware':
    case 'trim':
      return '#c8ccd4';
    case 'khaki-paint':
      return '#a89968';
    case 'hopper-slate':
      return '#5d646e';
    case 'rust':
      return '#9c5b33';
    case 'lamp':
      return '#ffc13d';
    default:
      break;
  }
  if (material.startsWith('lx:')) return '#ffc13d';
  // a stable hue from the name: FNV-1a, then OKLCH at a mid lightness and a shareable chroma
  let h = 2166136261;
  for (let i = 0; i < material.length; i += 1) {
    h ^= material.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const hue = ((h >>> 0) % 360) * (Math.PI / 180);
  return oklabToHex(fromOklch(0.62, 0.055, hue));
}

export interface SpriteBakeOptions {
  readonly kit: Kit;
  readonly preset: string;
  /** The Fidelity Stage whose palette and dither to bake with (S0 mono, S1 EGA, S2 VGA, S3+ full colour). */
  readonly stage?: number;
  /** Pixels per frame, square (16, 24, 32 or 48 are the era's own sizes). */
  readonly size?: number;
  readonly angles?: number;
  readonly dither?: Dither;
  readonly overrides?: Overrides;
  /** A material name to its '#rrggbb' ink (a kit's palette; defaults to `defaultMaterialColour`). */
  readonly colourOf?: (material: string) => string;
  /** A background ink, or null for a transparent sprite. */
  readonly background?: string | null;
  /** Camera elevation above the horizon, in degrees (a shareware sheet is usually a little above eye level). */
  readonly elevationDeg?: number;
  /** Margin inside the frame, in pixels. */
  readonly paddingPx?: number;
  /** Which way the light comes from, in view space (x right, y up, z away from the camera). */
  readonly lightDir?: readonly [number, number, number];
}

/** A baked turntable: one indexed picture per angle, all in one palette. */
export interface SpriteSheet {
  readonly preset: string;
  readonly stage: number;
  readonly size: number;
  readonly angles: number;
  /** The yaw each frame shows, in degrees (frame k looks at the model from `k * 360 / angles`). */
  readonly yawDeg: readonly number[];
  readonly palette: Palette;
  readonly frames: readonly IndexedImage[];
}

type Vec3 = readonly [number, number, number];

/** The eight corners of a box. */
function corners(box: Box3): Vec3[] {
  const out: Vec3[] = [];
  for (let i = 0; i < 8; i += 1) {
    out.push([
      i & 1 ? box.max[0] : box.min[0],
      i & 2 ? box.max[1] : box.min[1],
      i & 4 ? box.max[2] : box.min[2],
    ]);
  }
  return out;
}

/** A point through a 4×4 column-major matrix (kitspec's `Mat4`). */
function apply(m: Mat4, p: Vec3): Vec3 {
  const [x, y, z] = p;
  return [
    (m[0] as number) * x + (m[4] as number) * y + (m[8] as number) * z + (m[12] as number),
    (m[1] as number) * x + (m[5] as number) * y + (m[9] as number) * z + (m[13] as number),
    (m[2] as number) * x + (m[6] as number) * y + (m[10] as number) * z + (m[14] as number),
  ];
}

/** The six faces of the corner ordering above, each with the normal it faces (in the box's own frame, so a sign per axis). */
const FACES: readonly { readonly corners: readonly number[]; readonly axis: 0 | 1 | 2; readonly sign: 1 | -1 }[] = [
  { corners: [0, 2, 6, 4], axis: 0, sign: -1 },
  { corners: [1, 5, 7, 3], axis: 0, sign: 1 },
  { corners: [0, 4, 5, 1], axis: 1, sign: -1 },
  { corners: [2, 3, 7, 6], axis: 1, sign: 1 },
  { corners: [0, 1, 3, 2], axis: 2, sign: -1 },
  { corners: [4, 6, 7, 5], axis: 2, sign: 1 },
];

/** A solid's world normals: the three box axes through the matrix, normalised (a matrix may scale). */
function axes(m: Mat4): readonly [Vec3, Vec3, Vec3] {
  const norm = (v: Vec3): Vec3 => {
    const len = Math.hypot(v[0], v[1], v[2]) || 1;
    return [v[0] / len, v[1] / len, v[2] / len];
  };
  return [
    norm([m[0] as number, m[1] as number, m[2] as number]),
    norm([m[4] as number, m[5] as number, m[6] as number]),
    norm([m[8] as number, m[9] as number, m[10] as number]),
  ];
}

/** Rotate a point about Y by `a` radians, then tilt about X by `e` (the camera's own little crane). */
function toView(p: Vec3, a: number, e: number): Vec3 {
  const ca = Math.cos(a), sa = Math.sin(a);
  const x = ca * p[0] - sa * p[2];
  const z = sa * p[0] + ca * p[2];
  const ce = Math.cos(e), se = Math.sin(e);
  return [x, ce * p[1] - se * z, se * p[1] + ce * z];
}

/** Fill a convex polygon (screen space) into an RGBA buffer, flat shaded one colour. */
function fillConvex(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  points: readonly { readonly x: number; readonly y: number }[],
  colour: readonly [number, number, number],
): void {
  if (points.length < 3) return;
  let minY = Number.POSITIVE_INFINITY, maxY = Number.NEGATIVE_INFINITY;
  for (const p of points) {
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  const y0 = Math.max(0, Math.floor(minY));
  const y1 = Math.min(height - 1, Math.ceil(maxY));
  for (let y = y0; y <= y1; y += 1) {
    const sy = y + 0.5;
    let lo = Number.POSITIVE_INFINITY, hi = Number.NEGATIVE_INFINITY;
    for (let i = 0; i < points.length; i += 1) {
      const a = points[i] as { x: number; y: number };
      const b = points[(i + 1) % points.length] as { x: number; y: number };
      if ((a.y <= sy && b.y > sy) || (b.y <= sy && a.y > sy)) {
        const t = (sy - a.y) / (b.y - a.y);
        const x = a.x + t * (b.x - a.x);
        if (x < lo) lo = x;
        if (x > hi) hi = x;
      }
    }
    if (lo > hi) continue;
    const x0 = Math.max(0, Math.floor(lo));
    const x1 = Math.min(width - 1, Math.ceil(hi) - 1);
    for (let x = x0; x <= x1; x += 1) {
      const o = (y * width + x) * 4;
      rgba[o] = colour[0];
      rgba[o + 1] = colour[1];
      rgba[o + 2] = colour[2];
      rgba[o + 3] = 255;
    }
  }
}

/**
 * The turntable: `angles` frames of the preset, baked at `size` pixels square, palette-indexed for the stage. Frame 0 shows
 * the model's front (+z toward the camera), and the rest step counter-clockwise every `360 / angles` degrees. Pure.
 */
export function bakeTurntable(o: SpriteBakeOptions): SpriteSheet {
  const stage = Math.max(0, Math.min(6, Math.floor(Number.isFinite(o.stage) ? (o.stage as number) : 0)));
  const size = Math.max(4, Math.min(128, Math.floor(o.size ?? 32)));
  const angles = Math.max(1, Math.min(16, Math.floor(o.angles ?? TURNTABLE_ANGLES)));
  const palette = paletteForStage(stage);
  const dither: Dither = o.dither ?? (stage <= 0 ? 'bayer4' : stage <= 2 ? 'bayer2' : 'none');
  const colourOf = o.colourOf ?? defaultMaterialColour;
  const elevation = ((Number.isFinite(o.elevationDeg) ? (o.elevationDeg as number) : 12) * Math.PI) / 180;
  const padding = Math.max(0, Math.floor(o.paddingPx ?? 1));
  const lightRaw = o.lightDir ?? [-0.45, 0.8, -0.4];
  const lightLen = Math.hypot(lightRaw[0], lightRaw[1], lightRaw[2]) || 1;
  const light: Vec3 = [lightRaw[0] / lightLen, lightRaw[1] / lightLen, lightRaw[2] / lightLen];

  // the model: every placed part as a solid in the preset's own frame
  const placed = flatten(o.kit, o.preset, o.overrides);
  const solids: { readonly corners: readonly Vec3[]; readonly axes: readonly [Vec3, Vec3, Vec3]; readonly colour: string }[] = [];
  for (const part of placed) {
    const box = sourceBounds(part.source);
    const worldCorners = corners(box).map((c) => apply(part.matrix, c));
    solids.push({
      corners: worldCorners,
      axes: axes(part.matrix),
      colour: colourOf(part.material),
    });
  }

  // the frame fits the whole model at every angle, so the actor does not grow and shrink as it turns
  let minX = Number.POSITIVE_INFINITY, maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY, maxY = Number.NEGATIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY, maxZ = Number.NEGATIVE_INFINITY;
  for (const solid of solids) {
    for (const c of solid.corners) {
      if (c[0] < minX) minX = c[0];
      if (c[0] > maxX) maxX = c[0];
      if (c[1] < minY) minY = c[1];
      if (c[1] > maxY) maxY = c[1];
      if (c[2] < minZ) minZ = c[2];
      if (c[2] > maxZ) maxZ = c[2];
    }
  }
  const centre: Vec3 = [(minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2];
  const span = Math.max(maxX - minX, maxY - minY, maxZ - minZ, 1e-3);
  const usable = Math.max(1, size - padding * 2);
  const scale = usable / span;
  const mid = size / 2;

  const project = (p: Vec3, a: number): { x: number; y: number; z: number } => {
    const v = toView([p[0] - centre[0], p[1] - centre[1], p[2] - centre[2]], a, elevation);
    return { x: mid + v[0] * scale, y: mid - v[1] * scale, z: v[2] };
  };

  const background = o.background ?? null;
  const frames: IndexedImage[] = [];
  for (let k = 0; k < angles; k += 1) {
    const a = (k / angles) * Math.PI * 2;
    const rgba = new Uint8ClampedArray(size * size * 4);
    if (background) {
      const [br, bg, bb] = [
        parseInt(background.slice(1, 3), 16),
        parseInt(background.slice(3, 5), 16),
        parseInt(background.slice(5, 7), 16),
      ];
      for (let i = 0; i < size * size; i += 1) {
        rgba[i * 4] = br;
        rgba[i * 4 + 1] = bg;
        rgba[i * 4 + 2] = bb;
        rgba[i * 4 + 3] = 255;
      }
    }
    // far to near, then each part's faces far to near: a painter's algorithm over boxes is exact enough at 32 px
    const ordered = solids
      .map((s) => {
        let depth = 0;
        for (const c of s.corners) depth += project(c, a).z;
        return { solid: s, depth: depth / s.corners.length };
      })
      .sort((p, q) => q.depth - p.depth);
    for (const { solid } of ordered) {
      const ink = hexToOklab(solid.colour);
      const faces = FACES.map((f) => {
        const axis = solid.axes[f.axis];
        const normal: Vec3 = [axis[0] * f.sign, axis[1] * f.sign, axis[2] * f.sign];
        const viewNormal = toView(normal, a, elevation);
        // the camera looks along +z, so a face whose normal has a negative z component faces the camera
        const facing = viewNormal[2] < 0;
        const points = f.corners.map((i) => project(solid.corners[i] as Vec3, a));
        const depth = points.reduce((sum, p) => sum + p.z, 0) / points.length;
        return { points, normal: viewNormal, facing, depth, sign: f.sign };
      })
        .filter((f) => f.facing)
        .sort((p, q) => q.depth - p.depth);
      for (const face of faces) {
        const lambert = Math.max(0, -(face.normal[0] * light[0] + face.normal[1] * light[1] + face.normal[2] * light[2]));
        const shading = 0.42 + 0.58 * lambert;
        const shaded = oklabToHex({ l: Math.min(1, ink.l * shading + 0.04), a: ink.a * shading, b: ink.b * shading });
        const [r, g, b] = [
          parseInt(shaded.slice(1, 3), 16),
          parseInt(shaded.slice(3, 5), 16),
          parseInt(shaded.slice(5, 7), 16),
        ];
        fillConvex(rgba, size, size, face.points, [r, g, b]);
      }
    }
    // the palette step: dither on the coarse ladders, straight nearest-colour above them
    if (dither === 'none') {
      const indexed = quantiseRgba(rgba, size, size, palette, 'none');
      frames.push(indexed);
    } else {
      const indices = new Uint8Array(size * size);
      for (let y = 0; y < size; y += 1) {
        for (let x = 0; x < size; x += 1) {
          const i = y * size + x;
          const o4 = i * 4;
          if ((rgba[o4 + 3] ?? 0) === 0) {
            indices[i] = 0;
            continue;
          }
          const hex = toHex([(rgba[o4] ?? 0) / 255, (rgba[o4 + 1] ?? 0) / 255, (rgba[o4 + 2] ?? 0) / 255]);
          indices[i] = nearestPaletteIndex(hex, palette, ditherBias(x, y, dither));
        }
      }
      frames.push({ width: size, height: size, indices, palette });
    }
  }
  return {
    preset: o.preset,
    stage,
    size,
    angles,
    yawDeg: Array.from({ length: angles }, (_, k) => (k * 360) / angles),
    palette,
    frames,
  };
}

/** One frame as RGBA (for a canvas). */
export function frameToRgba(sheet: SpriteSheet, angle: number): Uint8ClampedArray {
  const frame = sheet.frames[Math.max(0, Math.min(sheet.angles - 1, Math.floor(angle)))] ?? sheet.frames[0];
  return indexedToRgba(frame as IndexedImage);
}

/** All frames side by side in one picture: the sheet a blitter actually loads. */
export function sheetToImage(sheet: SpriteSheet): IndexedImage {
  const width = sheet.size * sheet.angles;
  const indices = new Uint8Array(width * sheet.size);
  for (let a = 0; a < sheet.angles; a += 1) {
    const frame = sheet.frames[a] as IndexedImage;
    for (let y = 0; y < sheet.size; y += 1) {
      for (let x = 0; x < sheet.size; x += 1) {
        indices[y * width + a * sheet.size + x] = frame.indices[y * sheet.size + x] ?? 0;
      }
    }
  }
  return { width, height: sheet.size, indices, palette: sheet.palette };
}

/** All frames as one RGBA buffer, frames side by side. */
export function sheetToRgba(sheet: SpriteSheet): Uint8ClampedArray {
  return indexedToRgba(sheetToImage(sheet));
}

/**
 * Which frame a billboard shows at time `t`: eight views at eight frames a second, which is the shareware walk cycle's own
 * rate. Pure, so a paused or scrubbed clock shows the same frame the live one would.
 */
export function billboardFrameAt(tSec: number, fps = 8, angles = TURNTABLE_ANGLES): number {
  const n = Math.max(1, Math.floor(angles));
  const rate = Number.isFinite(fps) && fps > 0 ? fps : 8;
  const step = Math.floor(Math.max(0, Number.isFinite(tSec) ? tSec : 0) * rate);
  return ((step % n) + n) % n;
}

/** The angle a camera sees an actor from, as a frame index: `atan2` of the vector from actor to camera, in 45° steps. */
export function frameForView(dx: number, dz: number, angles = TURNTABLE_ANGLES): number {
  const n = Math.max(1, Math.floor(angles));
  const turn = Math.atan2(dx, dz); // 0 straight ahead (−z is the actor's front in the world's usual convention)
  const unit = ((turn / (Math.PI * 2)) * n) % n;
  return ((Math.round(unit) % n) + n) % n;
}
