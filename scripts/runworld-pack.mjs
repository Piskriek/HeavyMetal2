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
import { lumGate } from './surface-luminance.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const SRC = path.join(ROOT, 'zips', 'runworld', 'assets');
const LOW = path.join(ROOT, 'apps', 'web', 'src', 'assets', 'gen');
const HD = path.join(ROOT, 'apps', 'web', 'public', 'hd');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs', 'runworld', 'assets.json'), 'utf8'));
// Packing writes inline lows into the single file, so a bare run that packs EVERY asset with levels on disk can blow the
// 16 MB cap (2026-10-18: 79 unreferenced vista props, about 5 MB, sat untracked in gen/ and broke PLAY.bat's build).
// Name the ids you mean to pack, or pass --all on purpose.
const all = process.argv.includes('--all');
const only = process.argv.slice(2).filter((a) => a !== '--all');
if (!all && only.length === 0) {
  console.log('usage: node scripts/runworld-pack.mjs <id ...>   (or --all to pack every asset with levels on disk)');
  process.exit(2);
}

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

/**
 * Painted steel, as the base kit's `paint` material (packages/basekit: metalness 0.1, roughness 0.55). The generated
 * models arrive fully metallic (metallic 1, roughness 0.9, with no metal/roughness map), and a fully metallic surface
 * has no diffuse colour: on the Moon, with only black space to reflect, the rovers rendered as black silhouettes
 * (TASK-10 review, 2026-10-11).
 */
function paint(doc) {
  for (const mat of doc.getRoot().listMaterials()) {
    if (mat.getMetallicRoughnessTexture()) continue; // a real map carries its own values
    mat.setMetallicFactor(0.1).setRoughnessFactor(0.55);
  }
}

const registryPath = path.join(LOW, 'registry.json');
const registry = fs.existsSync(registryPath) ? JSON.parse(fs.readFileSync(registryPath, 'utf8')) : {};
let packed = 0;
const refused = [];
for (const a of manifest.assets.filter((x) => only.length === 0 || only.includes(x.id))) {
  const d = path.join(SRC, a.id), has = (f) => fs.existsSync(path.join(d, f));
  if (!has('low.glb') || !has('mid.glb') || !has('high.glb')) continue;
  // the luminance gate (Argo's fifth acceptance check, scripts/surface-luminance.mjs), measured on the files packed now.
  // `lumOk` in the manifest is a reviewed exception for a model that is dark by design.
  const lum = await lumGate(d);
  if (!lum.ok && !a.lumOk) { console.log(`${a.id}: NOT PACKED, luminance (${lum.why})`); refused.push(a.id); continue; }
  const low = await io.read(path.join(d, 'low.glb'));
  paint(low);
  await io.write(path.join(LOW, `${a.id}.glb`), low);
  const out = path.join(HD, a.id);
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  // high first, so the shared colour and metal/roughness files on disk are high's (1024 px); mid's same-named
  // images are written first and then replaced, which is why mid is written before high
  const mid = await io.read(path.join(d, 'mid.glb')), high = await io.read(path.join(d, 'high.glb'));
  paint(mid);
  paint(high);
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

export const MACHINE_AND_STRUCTURE_SOCKETS = {
  'scout-body': [{ name: 'seat', at: [0, 0.27, -0.1] }],
  'hauler-body': [{ name: 'seat', at: [-0.45, 0.6, 1.9] }, { name: 'seat', at: [0.45, 0.6, 1.9] }, { name: 'dish', at: [0, 1.13, -0.3] }],
  'crawler-body': [{ name: 'seat', at: [0.35, 0.55, -1.5] }, { name: 'drill', at: [0, 0.45, 3.6] }, { name: 'mast', at: [0.4, 1.75, -1.5] }],
  'mill': [{ name: 'hopper', at: [0, 4.16, 0] }, { name: 'vent', at: [1.715, 2.28, -0.48] }, { name: 'power', at: [0, 0.1, -1.58] }],
  'press-frame': [{ name: 'chute', at: [0, 4.26, 0] }, { name: 'vent', at: [0, 3.44, -0.56] }, { name: 'power', at: [-0.56, 0.24, 1] }],
  'projector-mast': [{ name: 'lens', at: [0, 4.362, 0.562] }, { name: 'vent', at: [0, 3.821, -0.598] }, { name: 'power', at: [-0.56, 0.24, 0.88] }],
  'watermaker': [{ name: 'hopper', at: [3.05, 1.6, 0] }, { name: 'vent', at: [0, 3.155, -0.58] }, { name: 'power', at: [-0.11, 0.24, 0.88] }],
  'fabricator-frame': [{ name: 'bed', at: [0, 0.7, 0] }, { name: 'power', at: [-2.4, 0.55, -2.6] }],
  'pylon-tower': [{ name: 'top', at: [1.02, 5.76, 0] }, { name: 'box', at: [0.78, 0.5, 0.87] }],
  'operator-console': [{ name: 'cable', at: [0, 0.35, -0.23] }],
  'relay-cabinet': [{ name: 'cable-top', at: [0, 1.95, 0] }, { name: 'cable-bottom', at: [0, 0.02, -0.19] }],
  'breaker-panel': [{ name: 'in', at: [-0.27, 0.23, 0] }, { name: 'out', at: [0.27, 1.64, 0] }],
  'capacitor-bank': [{ name: 'out', at: [1.02, 0.89, 0] }],
  'control-box': [{ name: 'cable', at: [0, -0.265, 0.04] }],
  'hardpoint': [{ name: 'mount', at: [4, 0.78, 4] }, { name: 'power', at: [7.96, 0.35, 3.22] }],
  'bin': [{ name: 'link', at: [2, 2.18, 2] }],
  'drafting': [{ name: 'screen', at: [2.035, 0.97, 2] }],
  'repeater': [{ name: 'top', at: [2, 6.99, 2] }, { name: 'box', at: [2, 0.68, 2.83] }],
  'gate': [{ name: 'rear-junction', at: [1.075, 0.37, -0.5] }],
};

const socketsDataFile = path.join(ROOT, 'apps', 'web', 'src', 'studio-data', 'sockets.json');
const authoredSockets = fs.existsSync(socketsDataFile) ? JSON.parse(fs.readFileSync(socketsDataFile, 'utf8')) : {};

for (const [id, entry] of Object.entries(registry)) {
  const socks = authoredSockets[id] ?? MACHINE_AND_STRUCTURE_SOCKETS[id];
  if (socks) {
    entry.sockets = socks;
  }
}

fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2) + '\n');
console.log(`packed ${packed}; registry has ${Object.keys(registry).length} assets`);
if (refused.length) {
  console.log(`refused by the luminance gate: ${refused.join(', ')} (re-bake with a longer reach or lowInPlace, or review and set lumOk)`);
  process.exitCode = 1;
}
