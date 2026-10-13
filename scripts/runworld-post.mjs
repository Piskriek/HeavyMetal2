// Turns each generated model in zips/runworld/assets/<id>/model.glb into the game's three detail levels.
//   node scripts/runworld-post.mjs [id ...] [--levels=low,mid,high]   (--levels redoes only those levels)
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
import { lumGate } from './surface-luminance.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'zips', 'runworld', 'assets');
const BLENDER = 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe';
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs', 'runworld', 'assets.json'), 'utf8'));
const argv = process.argv.slice(2);
const only = argv.filter((x) => !x.startsWith('--'));
const levelsArg = argv.find((x) => x.startsWith('--levels='));
const levels = levelsArg ? levelsArg.slice('--levels='.length).split(',') : ['low', 'mid', 'high'];
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

/**
 * The yaw that faces a sloped piece the way its kit piece rises: `high` names the side its top lies on ('+z' for a
 * ramp, stair or pitched roof; '+x+z' for the roof corners), which the long-side rule cannot tell on a square cell.
 * All four quarter turns are scored by where the top band of vertices lies along that side (the per-axis fit absorbs
 * the aspect; an overhang makes a near-square cell look oblong, so the long-side rule is no guide here).
 */
function uphill(doc, high) {
  const want = [high.includes('+x') ? 1 : high.includes('-x') ? -1 : 0, high.includes('+z') ? 1 : high.includes('-z') ? -1 : 0];
  const pts = [];
  for (const mesh of doc.getRoot().listMeshes()) for (const prim of mesh.listPrimitives()) {
    const arr = prim.getAttribute('POSITION').getArray();
    for (let i = 0; i < arr.length; i += 3) pts.push(arr[i], arr[i + 1], arr[i + 2]);
  }
  let y0 = Infinity, y1 = -Infinity;
  for (let i = 1; i < pts.length; i += 3) { y0 = Math.min(y0, pts[i]); y1 = Math.max(y1, pts[i]); }
  const band = y1 - 0.15 * (y1 - y0);
  let best = 0, score = -Infinity;
  for (const yaw of [0, 90, 180, 270]) {
    const t = (yaw * Math.PI) / 180, c = Math.cos(t), sn = Math.sin(t);
    let sum = 0, n = 0;
    for (let i = 0; i < pts.length; i += 3) {
      if (pts[i + 1] < band) continue;
      const x = c * pts[i] + sn * pts[i + 2], z = -sn * pts[i] + c * pts[i + 2]; // as transformMesh turns it below
      sum += want[0] * x + want[1] * z; n++;
    }
    if (n && sum / n > score) { score = sum / n; best = yaw; }
  }
  return best;
}

function run(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', cwd: ROOT, timeout: 20 * 60 * 1000 });
  if (r.status !== 0) throw new Error(`${path.basename(cmd)} failed: ${(r.stdout + r.stderr).slice(-600)}`);
  return r.stdout;
}

// One post per asset at a time. The overnight loop and runworld-watch.mjs both reach a fresh model, and the second
// run deleted the first's low-raw.glb mid-bake (the 2026-10-13 "FAILED" lines, whose three levels were in fact
// written). A second run waits for the first to finish and then leaves its levels alone; a lock older than 40
// minutes is a crashed run's and is taken over.
const held = new Set();
process.on('exit', () => { for (const l of held) fs.rmSync(l, { force: true }); });
async function takeLock(d) {
  const lock = path.join(d, '.posting');
  for (;;) {
    try { fs.writeFileSync(lock, String(process.pid), { flag: 'wx' }); held.add(lock); return true; } catch (e) { if (e.code !== 'EEXIST') throw e; }
    const age = fs.existsSync(lock) ? Date.now() - fs.statSync(lock).mtimeMs : 0;
    if (age > 40 * 60 * 1000) { fs.rmSync(lock, { force: true }); continue; }
    while (fs.existsSync(lock)) await new Promise((r) => setTimeout(r, 5000));
    // the other run finished: skip if it made the levels, else (it failed) post them here
    if (fs.existsSync(path.join(d, 'high.glb'))) return false;
  }
}
function releaseLock(d) { const lock = path.join(d, '.posting'); fs.rmSync(lock, { force: true }); held.delete(lock); }

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
    const yaw = a.yaw ?? (a.high ? uphill(doc, a.high) : (dx >= dz) === (tw >= td) ? 0 : 90);
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
  // a reviewed `yaw` (degrees) turns any asset about its up axis first: a redo can come back facing another way
  // (the weapon bench's 2026-10-13 redo put its length along z)
  if (a.yaw && a.yaw % 360 !== 0) {
    const t = (a.yaw * Math.PI) / 180, c = Math.cos(t), sn = Math.sin(t);
    for (const mesh of doc.getRoot().listMeshes()) transformMesh(mesh, [c, 0, -sn, 0, 0, 1, 0, 0, sn, 0, c, 0, 0, 0, 0, 1]);
    b = getBounds(scene); dx = b.max[0] - b.min[0]; dy = b.max[1] - b.min[1]; dz = b.max[2] - b.min[2];
  }
  const s = size / (axis === 'height' ? dy : Math.max(dx, dz));
  const cx = (b.min[0] + b.max[0]) / 2, cz = (b.min[2] + b.max[2]) / 2;
  // translate to bottom-centre, then scale: m = S * T
  const m = [s, 0, 0, 0, 0, s, 0, 0, 0, 0, s, 0, -cx * s, -b.min[1] * s, -cz * s, 1];
  for (const mesh of doc.getRoot().listMeshes()) transformMesh(mesh, m);
  await doc.transform(prune());
  await io.write(dst, doc);
  return { w: dx * s, h: dy * s, d: dz * s, ...(a.yaw ? { yaw: a.yaw } : {}) };
}

for (const a of manifest.assets.filter((x) => only.length === 0 || only.includes(x.id))) {
  // the local multi-view model if there is one (local3d.mjs --views), else RUN's Hunyuan 3.1 Pro model, else the
  // local single-view one (scripts/local3d.mjs); a derived
  // piece (`derive: {from, op}`) is made from another asset's fitted mesh instead, every run, so it follows that
  // asset's regenerations: 'fit' reuses it as is (the per-axis fit below reshapes it, as roof-low is the pitched
  // roof at half the rise), 'hip' and 'valley' cut and mirror it into a roof corner (scripts/derive-roof.py)
  const d = path.join(OUT, a.id);
  let model = ['model-mv.glb', 'model.glb', 'model-local.glb'].map((f) => path.join(d, f)).find((f) => fs.existsSync(f));
  if (a.derive) {
    const from = path.join(OUT, a.derive.from, 'norm.glb');
    if (!fs.existsSync(from)) { console.log(`${a.id}: waiting for ${a.derive.from}`); continue; }
    fs.mkdirSync(d, { recursive: true });
    model = path.join(d, 'model-derived.glb');
    if (a.derive.op === 'fit') fs.copyFileSync(from, model);
    else run(BLENDER, ['-b', '--factory-startup', '-P', 'scripts/derive-roof.py', '--', from, model, a.derive.op]);
  }
  if (!model) continue;
  if (fs.existsSync(path.join(d, 'high.glb')) && only.length === 0) continue;
  if (!(await takeLock(d))) { console.log(`${a.id}: posted by another run`); continue; }
  // `budgets` on an asset overrides its class (a louvred chiller needs more low triangles than a plain box)
  const [low, mid, high] = a.budgets ?? manifest.budgets[a.class];
  const norm = path.join(d, 'norm.glb'), slim = 'scripts/slim-glb.mjs';
  const dims = await normalize(model, norm, a);
  // `fix`: the hidden side the image model invented, repaired on norm.glb before the levels (scripts/model-fix.py)
  if (a.fix?.length) run(BLENDER, ['-b', '--factory-startup', '-P', 'scripts/model-fix.py', '--', norm, ...a.fix]);
  // each level: Blender decimates (and for mid/high bakes the full-detail normals), then slim-glb packs it
  // (no further simplifying: --tris above the count; WebP maps at the level's size; meshopt).
  // low is a cage, rebuilt rather than decimated in place (lod-bake.py --retopo=0 --planar=4, smooth): the welded
  // surface drops the generated UV islands, flat regions dissolve to a few clean faces, the collapse takes it to the
  // budget, it is unwrapped fresh, its normals are softened by angle, and the full model's colour and tangent
  // normals are baked on at 512 px (packed to 256). Owner 2026-10-11: "soften the normals on the cage then bake the
  // details with normals and colors to the low poly cage model (cage with good uv layout that is your low)".
  // Tested 2026-10-11: the scout wheel (a round tyre with its tread at 600 triangles, where in-place decimation
  // made a faceted blob), the hauler body (no torn side panels), the scout body (clean panels and frames). The voxel
  // remesh variant (--retopo=160) broke the wheel apart (an open shell), so it is not used.
  // `lowInPlace`: decimate the low in place instead (the chiller's many louvre slats collapsed the cage to a wedge)
  const plan = [['low', low, 256, 'smooth', 512, a.lowInPlace ? [] : ['--retopo=0', '--planar=4']], ['mid', mid, 512, 'smooth', 512, []], ['high', high, 1024, 'smooth', 1024, []]];
  // `reach`: a longer bake ray for pieces with deep recesses (lod-bake.py --reach=K)
  const reach = a.reach ? [`--reach=${a.reach}`] : [];
  for (const [name, tris, tex, mode, bakePx, extra] of plan.filter((p) => levels.includes(p[0]))) {
    const raw = path.join(d, `${name}-raw.glb`), done = path.join(d, `${name}.glb`);
    run(BLENDER, ['-b', '--factory-startup', '-P', 'scripts/lod-bake.py', '--', norm, raw, String(tris), String(bakePx), mode, ...extra, ...reach]);
    if (a.box) await snap(raw, a.box);
    run('node', [slim, raw, done, '--tris', '100000000', '--tex', String(tex), '--meshopt']);
    fs.rmSync(raw);
  }
  const kb = (f) => Math.round(fs.statSync(path.join(d, f)).size / 1024);
  // the luminance gate (scripts/surface-luminance.mjs): reported here for the review; the pack step refuses a failure
  const lum = await lumGate(d);
  console.log(`${a.id}: ${dims.w.toFixed(2)} x ${dims.h.toFixed(2)} x ${dims.d.toFixed(2)} m${dims.yaw ? ` (turned ${dims.yaw} deg)` : ''}; low ${kb('low.glb')} KB, mid ${kb('mid.glb')} KB, high ${kb('high.glb')} KB; luminance low ${lum.low.toFixed(2)}, high ${lum.high.toFixed(2)}`);
  if (!lum.ok) console.log(`${a.id}: LUMINANCE FAIL (${lum.why}). Re-bake with a longer reach or lowInPlace; the pack refuses it unless a review sets lumOk.`);
  releaseLock(d);
}
