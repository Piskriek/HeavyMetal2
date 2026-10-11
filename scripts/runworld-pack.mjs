// Packs the reviewed generated assets for the game (owner, 2026-10-11: "Lean file + HD pack").
//   node scripts/runworld-pack.mjs [id ...]
// For each asset in docs/runworld/assets.json that has low/mid/high levels in zips/runworld/assets/<id>/:
//  - low:  apps/web/src/assets/gen/<id>.glb, a self-contained GLB that the single-file build inlines (the game is
//          playable from the one HTML file with the faceted low models);
//  - HD:   apps/web/public/hd/<id>/{mid,high}.gltf + .bin, copied beside index.html as the optional HD pack. Both
//          levels point at ONE shared colour map and ONE metal/roughness map (color.webp, mr.webp); only the baked
//          normal map is per level (normal-mid.webp, normal-high.webp). The UVs are the same on every level, so
//          sharing costs no quality and the browser downloads each shared texture once.
//  - apps/web/src/assets/gen/registry.json: id, class, real size (m), the lattice box for structures.
import fs from 'node:fs';
import path from 'node:path';
import { NodeIO, getBounds } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';

const ROOT = path.resolve(import.meta.dirname, '..');
const SRC = path.join(ROOT, 'zips', 'runworld', 'assets');
const LOW = path.join(ROOT, 'apps', 'web', 'src', 'assets', 'gen');
const HD = path.join(ROOT, 'apps', 'web', 'public', 'hd');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs', 'runworld', 'assets.json'), 'utf8'));
const only = process.argv.slice(2);

await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
fs.mkdirSync(LOW, { recursive: true });
fs.mkdirSync(HD, { recursive: true });

/** Point a level's textures at the shared files; the normal map gets the level's own name. */
function nameTextures(doc, level) {
  for (const mat of doc.getRoot().listMaterials()) {
    const set = (tex, uri) => { if (tex) { tex.setURI(uri); tex.setMimeType('image/webp'); } };
    set(mat.getBaseColorTexture(), 'color.webp');
    set(mat.getMetallicRoughnessTexture(), 'mr.webp');
    set(mat.getNormalTexture(), `normal-${level}.webp`);
  }
  for (const buf of doc.getRoot().listBuffers()) buf.setURI(`${level}.bin`);
}

const registryPath = path.join(LOW, 'registry.json');
const registry = fs.existsSync(registryPath) ? JSON.parse(fs.readFileSync(registryPath, 'utf8')) : {};
let packed = 0;
for (const a of manifest.assets.filter((x) => only.length === 0 || only.includes(x.id))) {
  const d = path.join(SRC, a.id), has = (f) => fs.existsSync(path.join(d, f));
  if (!has('low.glb') || !has('mid.glb') || !has('high.glb')) continue;
  fs.copyFileSync(path.join(d, 'low.glb'), path.join(LOW, `${a.id}.glb`));
  const out = path.join(HD, a.id);
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  // high first, so the shared colour and metal/roughness files on disk are high's (1024 px); mid's same-named
  // images are written first and then replaced, which is why mid is written before high
  const mid = await io.read(path.join(d, 'mid.glb')), high = await io.read(path.join(d, 'high.glb'));
  nameTextures(mid, 'mid');
  nameTextures(high, 'high');
  await io.write(path.join(out, 'mid.gltf'), mid);
  await io.write(path.join(out, 'high.gltf'), high);
  const b = getBounds(high.getRoot().getDefaultScene() ?? high.getRoot().listScenes()[0]);
  registry[a.id] = { class: a.class, size: [b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]].map((v) => Math.round(v * 1000) / 1000), ...(a.box ? { box: a.box, kind: a.kind } : {}) };
  const kb = (f) => Math.round(fs.statSync(f).size / 1024);
  const hdKb = fs.readdirSync(out).reduce((n, f) => n + kb(path.join(out, f)), 0);
  console.log(`${a.id}: low ${kb(path.join(LOW, `${a.id}.glb`))} KB inline, HD ${hdKb} KB`);
  packed++;
}
fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2) + '\n');
console.log(`packed ${packed}; registry has ${Object.keys(registry).length} assets`);
