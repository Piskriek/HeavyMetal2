// The mean base colour a model's surface shows: sampled through its UVs and weighted by triangle area, so atlas space no
// triangle uses doesn't count (a plain texture mean would count the black padding of a baked atlas).
//   node scripts/surface-luminance.mjs <model.glb> [...]   prints each model's value
// lumGate() below is the asset gate: Argo's fifth acceptance check ("low.glb mean diffuse luminance >= 0.18, so no
// asset renders near-black in Stage 0-1") and a check for a low whose bake came out darker than its high.
// scripts/runworld-post.mjs reports it at review time; scripts/runworld-pack.mjs refuses to pack an asset that fails.
// The value: each triangle's colour (texture times factor, in linear light) gives a Rec. 709 luminance, encoded to sRGB
// (0 black, 1 white, roughly as the eye reads it), then averaged by area. A half-black half-white surface scores 0.5.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import draco3d from 'draco3dgltf';
import sharp from 'sharp';

const TRIANGLES = 4;
/** Barycentric points sampled per triangle: the centre and one towards each corner. */
const POINTS = [[1 / 3, 1 / 3, 1 / 3], [2 / 3, 1 / 6, 1 / 6], [1 / 6, 2 / 3, 1 / 6], [1 / 6, 1 / 6, 2 / 3]];
const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toSrgb = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);

async function decode(texture) {
  const { data, info } = await sharp(Buffer.from(texture.getImage())).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
}

/** Nearest texel at (u, v), wrapped (glTF's default sampler repeats), as sRGB-encoded 0..1 channels. */
function texel(img, u, v, out) {
  const x = Math.min(img.w - 1, Math.floor((u - Math.floor(u)) * img.w));
  const y = Math.min(img.h - 1, Math.floor((v - Math.floor(v)) * img.h));
  const i = (y * img.w + x) * 4;
  out[0] = img.data[i] / 255; out[1] = img.data[i + 1] / 255; out[2] = img.data[i + 2] / 255;
  return out;
}

/**
 * The area-weighted mean luminance (0..1) of a document's base colour, texture times factor, over every triangle of
 * every mesh node, in world space. 0 when it has no triangles.
 */
export async function surfaceLuminance(doc) {
  const images = new Map();
  const pa = [0, 0, 0], pb = [0, 0, 0], pc = [0, 0, 0], ua = [0, 0], ub = [0, 0], uc = [0, 0], rgb = [0, 0, 0];
  let total = 0, sum = 0;
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    const m = node.getWorldMatrix();
    const world = (p) => { const [x, y, z] = p; p[0] = m[0] * x + m[4] * y + m[8] * z + m[12]; p[1] = m[1] * x + m[5] * y + m[9] * z + m[13]; p[2] = m[2] * x + m[6] * y + m[10] * z + m[14]; return p; };
    for (const prim of mesh.listPrimitives()) {
      if (prim.getMode() !== TRIANGLES) continue;
      const pos = prim.getAttribute('POSITION');
      if (!pos) continue;
      const material = prim.getMaterial();
      // the factor is linear; the texture is sRGB-encoded, so they multiply in linear light
      const factor = material?.getBaseColorFactor() ?? [1, 1, 1, 1];
      const tex = material?.getBaseColorTexture() ?? null;
      const uv = tex ? prim.getAttribute(`TEXCOORD_${material.getBaseColorTextureInfo()?.getTexCoord() ?? 0}`) : null;
      let img = null;
      if (tex && uv) {
        img = images.get(tex);
        if (!img) { img = await decode(tex); images.set(tex, img); }
      }
      const idx = prim.getIndices();
      const n = idx ? idx.getCount() : pos.getCount();
      for (let t = 0; t + 2 < n; t += 3) {
        const a = idx ? idx.getScalar(t) : t, b = idx ? idx.getScalar(t + 1) : t + 1, c = idx ? idx.getScalar(t + 2) : t + 2;
        world(pos.getElement(a, pa)); world(pos.getElement(b, pb)); world(pos.getElement(c, pc));
        const e1x = pb[0] - pa[0], e1y = pb[1] - pa[1], e1z = pb[2] - pa[2], e2x = pc[0] - pa[0], e2y = pc[1] - pa[1], e2z = pc[2] - pa[2];
        const cx = e1y * e2z - e1z * e2y, cy = e1z * e2x - e1x * e2z, cz = e1x * e2y - e1y * e2x;
        const area = Math.sqrt(cx * cx + cy * cy + cz * cz) / 2;
        if (!(area > 0)) continue;
        let r = 0, g = 0, bl = 0;
        if (img) {
          uv.getElement(a, ua); uv.getElement(b, ub); uv.getElement(c, uc);
          for (const [wa, wb, wc] of POINTS) {
            texel(img, wa * ua[0] + wb * ub[0] + wc * uc[0], wa * ua[1] + wb * ub[1] + wc * uc[1], rgb);
            r += toLinear(rgb[0]); g += toLinear(rgb[1]); bl += toLinear(rgb[2]);
          }
          r /= POINTS.length; g /= POINTS.length; bl /= POINTS.length;
        } else { r = 1; g = 1; bl = 1; }
        const y = 0.2126 * r * factor[0] + 0.7152 * g * factor[1] + 0.0722 * bl * factor[2];
        sum += area * toSrgb(Math.min(1, y));
        total += area;
      }
    }
  }
  return total > 0 ? sum / total : 0;
}

let io = null;
/** A reader for the formats the pipeline writes (Draco downloads, meshopt-packed levels). */
export async function lumIo() {
  if (io) return io;
  await MeshoptDecoder.ready;
  io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'draco3d.decoder': await draco3d.createDecoderModule(), 'meshopt.decoder': MeshoptDecoder });
  return io;
}

/** The gate's limits: Argo's floor (no asset near-black at stages 0 and 1), and how much darker than its high a low may bake. */
export const LUM_FLOOR = 0.18, LUM_RATIO = 0.85;

/**
 * The luminance gate on a posted asset's folder (low.glb and high.glb): Argo's fifth acceptance check, plus the bake
 * check, since a bake ray too short for a recess comes out dark (the 2026-10-13 dark lows, fixed with `reach`).
 * Calibrated on 13 October 2026 over 215 posted assets: all 128 packed models pass (darkest low 0.27, ratios 0.94 and
 * up); 8 rejected ones fail the ratio (0.67 to 0.81). `why` is empty when it passes.
 */
export async function lumGate(dir) {
  const reader = await lumIo();
  const low = await surfaceLuminance(await reader.read(path.join(dir, 'low.glb')));
  const high = await surfaceLuminance(await reader.read(path.join(dir, 'high.glb')));
  const ratio = high > 0 ? low / high : 1;
  const why = [
    low < LUM_FLOOR ? `low ${low.toFixed(2)} is under the ${LUM_FLOOR} floor` : '',
    ratio < LUM_RATIO ? `low is ${Math.round((1 - ratio) * 100)}% darker than high` : '',
  ].filter(Boolean).join('; ');
  return { low, high, ratio, ok: !why, why };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const files = process.argv.slice(2);
  if (!files.length) { console.error('usage: node scripts/surface-luminance.mjs <model.glb> [...]'); process.exit(2); }
  const reader = await lumIo();
  for (const f of files) console.log(`${(await surfaceLuminance(await reader.read(f))).toFixed(3)}  ${f}`);
}
