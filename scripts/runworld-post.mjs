// Turns each generated model in zips/runworld/assets/<id>/model.glb into the game's three detail levels.
//   node scripts/runworld-post.mjs [id ...]
// For each asset (docs/runworld/assets.json):
//  1. norm.glb: decode Draco, bake node transforms into the mesh, scale it to its real size in metres (`size` along
//     `axis`: height = y, length = the longer of x and z), and stand it on the ground, centred (bottom-centre origin);
//  2. three levels via scripts/lod-bake.py (Blender Decimate, which works across the texture islands that stall
//     meshopt's simplifier): low = flat shaded (the faceted stage-1 look), mid and high = smooth by angle with the
//     full-detail normals baked back;
//  3. slim-glb packs each level: WebP maps at 256 / 512 / 1024 px, quantised, meshopt (three's MeshoptDecoder).
// Lattice pieces (`box` in the manifest) are fitted to their procedural kit piece's box instead, and every level's
// vertices near the box faces are snapped onto them (see snap()), so walls, floors and roofs tile flush.
// Pivots that are not bottom-centre (a rover body's axle line, a hinge) are set at integration, per asset.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { NodeIO, getBounds } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { clearNodeTransform, prune, transformMesh } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import draco3d from 'draco3dgltf';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'zips', 'runworld', 'assets');
const BLENDER = 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe';
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs', 'runworld', 'assets.json'), 'utf8'));
const only = process.argv.slice(2);
await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'draco3d.decoder': await draco3d.createDecoderModule(), 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });


/** Snap a lattice piece's vertices that lie within `eps` of its box faces onto them, so neighbours meet flush. */
async function snap(file, box, eps = 0.03) {
  const doc = await io.read(file), [lo, hi] = box;
  for (const mesh of doc.getRoot().listMeshes()) for (const prim of mesh.listPrimitives()) {
    const pos = prim.getAttribute('POSITION'), arr = pos.getArray().slice();
    for (let i = 0; i < arr.length; i++) {
      const k = i % 3;
      if (Math.abs(arr[i] - lo[k]) < eps) arr[i] = lo[k];
      else if (Math.abs(arr[i] - hi[k]) < eps) arr[i] = hi[k];
    }
    pos.setArray(arr);
  }
  await io.write(file, doc);
}

function run(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', cwd: ROOT, timeout: 20 * 60 * 1000 });
  if (r.status !== 0) throw new Error(`${path.basename(cmd)} failed: ${(r.stdout + r.stderr).slice(-600)}`);
  return r.stdout;
}

async function normalize(src, dst, a) {
  const { size, axis } = a;
  const doc = await io.read(src);
  for (const ext of doc.getRoot().listExtensionsUsed()) if (ext.extensionName === 'KHR_draco_mesh_compression') ext.dispose();
  for (const node of doc.getRoot().listNodes()) if (node.getMesh()) clearNodeTransform(node);
  const scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0];
  let b = getBounds(scene), dx = b.max[0] - b.min[0], dy = b.max[1] - b.min[1], dz = b.max[2] - b.min[2];
  if (a.box) {
    // a lattice piece: turn it so its long side matches the box (or by the asset's reviewed `yaw`), then fill the
    // kit piece's box exactly on each axis, so it sits in the lattice frame like the procedural piece it replaces
    const [lo, hi] = a.box, tw = hi[0] - lo[0], td = hi[2] - lo[2];
    const yaw = a.yaw ?? ((dx >= dz) === (tw >= td) ? 0 : 90);
    if (yaw % 360 !== 0) {
      const t = (yaw * Math.PI) / 180, c = Math.cos(t), sn = Math.sin(t);
      for (const mesh of doc.getRoot().listMeshes()) transformMesh(mesh, [c, 0, -sn, 0, 0, 1, 0, 0, sn, 0, c, 0, 0, 0, 0, 1]);
      b = getBounds(scene); dx = b.max[0] - b.min[0]; dy = b.max[1] - b.min[1]; dz = b.max[2] - b.min[2];
    }
    const sx = tw / dx, sy = (hi[1] - lo[1]) / dy, sz = td / dz;
    const fit = [sx, 0, 0, 0, 0, sy, 0, 0, 0, 0, sz, 0, lo[0] - b.min[0] * sx, lo[1] - b.min[1] * sy, lo[2] - b.min[2] * sz, 1];
    for (const mesh of doc.getRoot().listMeshes()) transformMesh(mesh, fit);
    await doc.transform(prune());
    await io.write(dst, doc);
    return { w: tw, h: hi[1] - lo[1], d: td, yaw };
  }
  const s = size / (axis === 'height' ? dy : Math.max(dx, dz));
  const cx = (b.min[0] + b.max[0]) / 2, cz = (b.min[2] + b.max[2]) / 2;
  // translate to bottom-centre, then scale: m = S * T
  const m = [s, 0, 0, 0, 0, s, 0, 0, 0, 0, s, 0, -cx * s, -b.min[1] * s, -cz * s, 1];
  for (const mesh of doc.getRoot().listMeshes()) transformMesh(mesh, m);
  await doc.transform(prune());
  await io.write(dst, doc);
  return { w: dx * s, h: dy * s, d: dz * s };
}

for (const a of manifest.assets.filter((x) => only.length === 0 || only.includes(x.id))) {
  // RUN's Hunyuan 3.1 Pro model if there is one, else the local 3080 pipeline's (scripts/local3d.mjs)
  const d = path.join(OUT, a.id), model = ['model.glb', 'model-local.glb'].map((f) => path.join(d, f)).find((f) => fs.existsSync(f));
  if (!model) continue;
  if (fs.existsSync(path.join(d, 'high.glb')) && only.length === 0) continue;
  const [low, mid, high] = manifest.budgets[a.class];
  const norm = path.join(d, 'norm.glb'), slim = 'scripts/slim-glb.mjs';
  const dims = await normalize(model, norm, a);
  // each level: Blender decimates (and for mid/high bakes the full-detail normals), then slim-glb packs it
  // (no further simplifying: --tris above the count; WebP maps at the level's size; meshopt)
  for (const [name, tris, tex, mode] of [['low', low, 256, 'flat'], ['mid', mid, 512, 'smooth'], ['high', high, 1024, 'smooth']]) {
    const raw = path.join(d, `${name}-raw.glb`), done = path.join(d, `${name}.glb`);
    run(BLENDER, ['-b', '--factory-startup', '-P', 'scripts/lod-bake.py', '--', norm, raw, String(tris), String(tex), mode]);
    if (a.box) await snap(raw, a.box);
    run('node', [slim, raw, done, '--tris', '100000000', '--tex', String(tex), '--meshopt']);
    fs.rmSync(raw);
  }
  const kb = (f) => Math.round(fs.statSync(path.join(d, f)).size / 1024);
  console.log(`${a.id}: ${dims.w.toFixed(2)} x ${dims.h.toFixed(2)} x ${dims.d.toFixed(2)} m${dims.yaw ? ` (turned ${dims.yaw} deg)` : ''}; low ${kb('low.glb')} KB, mid ${kb('mid.glb')} KB, high ${kb('high.glb')} KB`);
}
