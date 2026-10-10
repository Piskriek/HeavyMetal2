// Slims a generated model (RUN.world 3D, Meshy, Hunyuan...) to a game budget, locally and for free.
//   node scripts/slim-glb.mjs <in.glb> <out.glb> --tris 5000 [--tex 1024] [--angle 30 | --flat] [--meshopt]
// RUN's remesh-3d step is retired upstream (fal's Meshy remesh endpoint), so this does the job here:
//  - read the Draco-compressed download;
//  - weld, then simplify with meshoptimizer to the triangle target (UVs are kept, so the baked texture still fits);
//  - re-encode the textures as WebP at --tex (default 1024);
//  - --angle 30: drop the normal map (it was baked for the dense surface and goes blotchy once simplified) and
//    rebuild the normals by angle (auto smooth: faces within 30° blend, sharper edges stay hard); --flat is --angle 0;
//    without either, keep the map;
//  - optionally compress the geometry with meshopt (the game loads it through three's MeshoptDecoder).
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, meshopt, prune, simplify, textureCompress, unweld, weld } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import draco3d from 'draco3dgltf';
import sharp from 'sharp';

const args = process.argv.slice(2);
const flag = (name, fallback) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : fallback; };
const [src, dst] = args;
if (!src || !dst || src.startsWith('--')) { console.error('usage: node scripts/slim-glb.mjs <in.glb> <out.glb> --tris N [--tex 1024] [--angle 30 | --flat] [--meshopt]'); process.exit(2); }
const target = Number(flag('--tris', '5000')), tex = Number(flag('--tex', '1024'));

await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready, MeshoptSimplifier.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.decoder': await draco3d.createDecoderModule(),
  'meshopt.encoder': MeshoptEncoder,
  'meshopt.decoder': MeshoptDecoder,
});

const triangles = (doc) => doc.getRoot().listMeshes().reduce((n, m) => n + m.listPrimitives().reduce((k, p) => k + (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3, 0), 0);
const doc = await io.read(src);
// the decoded Draco extension must not be written back
for (const ext of doc.getRoot().listExtensionsUsed()) if (ext.extensionName === 'KHR_draco_mesh_compression') ext.dispose();
const before = triangles(doc);
await doc.transform(weld());
// meshopt's simplifier works to a ratio; it can stop short at UV seams, so tighten until under the target
let ratio = Math.min(1, target / before);
for (let pass = 0; pass < 4; pass++) {
  await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio, error: 0.01 }));
  const now = triangles(doc);
  if (now <= target * 1.05) break;
  ratio = Math.min(1, target / now);
}
/**
 * Auto smooth: each corner's normal averages (area-weighted) the faces around that position whose normals lie within
 * `deg` of its own face, so curved panels stay smooth and hard edges stay crisp. 0 is flat shading.
 * Runs on unwelded triangles (corner i belongs to face floor(i / 3)); a weld afterwards merges what came out equal.
 */
function autoSmooth(deg) {
  const cos = Math.cos((deg * Math.PI) / 180), buffer = doc.getRoot().listBuffers()[0];
  for (const mesh of doc.getRoot().listMeshes()) for (const prim of mesh.listPrimitives()) {
    const pos = prim.getAttribute('POSITION').getArray(), corners = pos.length / 3, faces = corners / 3;
    const area = new Float32Array(faces * 3), unit = new Float32Array(faces * 3);
    for (let f = 0; f < faces; f++) {
      const a = f * 9;
      const ux = pos[a + 3] - pos[a], uy = pos[a + 4] - pos[a + 1], uz = pos[a + 5] - pos[a + 2];
      const vx = pos[a + 6] - pos[a], vy = pos[a + 7] - pos[a + 1], vz = pos[a + 8] - pos[a + 2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, l = Math.hypot(nx, ny, nz) || 1;
      area.set([nx, ny, nz], f * 3); unit.set([nx / l, ny / l, nz / l], f * 3);
    }
    // corners grouped by position (quantised to 10 µm so seam duplicates meet)
    const at = new Map();
    for (let c = 0; c < corners; c++) {
      const k = `${Math.round(pos[c * 3] * 1e5)},${Math.round(pos[c * 3 + 1] * 1e5)},${Math.round(pos[c * 3 + 2] * 1e5)}`;
      const list = at.get(k); if (list) list.push(c); else at.set(k, [c]);
    }
    const out = new Float32Array(corners * 3);
    for (const list of at.values()) for (const c of list) {
      const f = Math.floor(c / 3); let x = 0, y = 0, z = 0;
      const seen = new Set();
      for (const d of list) {
        const g = Math.floor(d / 3);
        if (seen.has(g)) continue; seen.add(g);
        if (unit[f * 3] * unit[g * 3] + unit[f * 3 + 1] * unit[g * 3 + 1] + unit[f * 3 + 2] * unit[g * 3 + 2] < cos) continue;
        x += area[g * 3]; y += area[g * 3 + 1]; z += area[g * 3 + 2];
      }
      const l = Math.hypot(x, y, z);
      if (l > 0) out.set([x / l, y / l, z / l], c * 3); else out.set(unit.subarray(f * 3, f * 3 + 3), c * 3);
    }
    prim.setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(out).setBuffer(buffer));
  }
}
const angle = args.includes('--flat') ? 0 : args.includes('--angle') ? Number(flag('--angle', '30')) : null;
if (angle !== null) {
  for (const m of doc.getRoot().listMaterials()) m.setNormalTexture(null);
  await doc.transform(unweld());
  autoSmooth(angle);
  await doc.transform(weld());
}
await doc.transform(dedup(), prune(), textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [tex, tex] }));
if (args.includes('--meshopt')) await doc.transform(meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
await io.write(dst, doc);
console.log(`${src} -> ${dst}: ${Math.round(before).toLocaleString('en')} -> ${Math.round(triangles(doc)).toLocaleString('en')} triangles, textures ${tex}²`);
