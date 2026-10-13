// Packs the monster roster (docs/monsters/roster.json) into the game's asset folders (TASK-23a).
//   node scripts/pack-monsters.mjs [--batch N] [--only id,id]
//
// Sources (read only, never fetched): Freedoom WAD (sprites), LibreQuake PAKs (Quake MDL), Quaternius glTF (CC0).
// Blasphemer is held out (no licence text in its archive; see the roster's "held" entry).
//
// Output, per monster, in one folder named by its id:
//   core (one per archetype, inlined by the bundler):  apps/web/src/assets/monsters/<id>/
//   everything else (fetched at runtime behind the loading bar): apps/web/public/monsters/<id>/
//   sprite: sprite.webp (one atlas) + sprite.json (frame rects, origins, mirror flags, ticks)
//   3D:     model.glb (morph-target walk/attack/pain/death for MDL; clips for Quaternius, meshopt-compressed)
// Also writes docs/monsters/packed.json (the manifest the test reads) and apps/web/public/monsters/credits.json.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { register } from 'tsx/esm/api';
import sharp from 'sharp';
import { Document, Logger, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { meshopt, prune, textureCompress } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flag = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const onlyIds = flag('--only')?.split(',').filter(Boolean);
const onlyBatch = flag('--batch') !== undefined ? Number(flag('--batch')) : undefined;

const CORE_BUDGET_BYTES = 1.2 * 1024 * 1024;
const SRC = {
  freedoomWad: path.join(ROOT, 'zips/monsters/freedoom/freedoom-0.13.0/freedoom2.wad'),
  freedoomCopying: path.join(ROOT, 'zips/monsters/freedoom/freedoom-0.13.0/COPYING.txt'),
  libreDir: path.join(ROOT, 'zips/monsters/librequake/lite/id1'),
  libreCopying: path.join(ROOT, 'zips/monsters/librequake/lite/id1/docs/COPYING'),
  quaterniusDir: path.join(ROOT, 'zips/monsters/quaternius-ultimate'),
  quaterniusLicence: path.join(ROOT, 'zips/monsters/quaternius-ultimate/License.txt'),
};
const OUT_CORE = path.join(ROOT, 'apps/web/src/assets/monsters');
const OUT_PUBLIC = path.join(ROOT, 'apps/web/public/monsters');
const MANIFEST = path.join(ROOT, 'docs/monsters/packed.json');
const ROSTER = path.join(ROOT, 'docs/monsters/roster.json');

// the TypeScript parsers in @hm/shareware (pure, no I/O: the bytes come from here)
register();
const wadMod = await import(pathToFileURL(path.join(ROOT, 'packages/shareware/src/wad.ts')).href);
const pakMod = await import(pathToFileURL(path.join(ROOT, 'packages/shareware/src/pak.ts')).href);
const mdlMod = await import(pathToFileURL(path.join(ROOT, 'packages/shareware/src/mdl.ts')).href);

await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready]);
const LOG = new Logger(Logger.Verbosity.WARN);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'meshopt.encoder': MeshoptEncoder,
  'meshopt.decoder': MeshoptDecoder,
});
io.setLogger(LOG);

/** A Node Buffer as an ArrayBuffer holding just its bytes. */
function toArrayBuffer(buf) {
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

/** Shelf packing: rectangles into a width-limited sheet, tallest first. Returns the sheet size and each rect's place. */
function shelfPack(items, maxWidth = 1024, pad = 1) {
  const order = [...items].sort((a, b) => b.h - a.h || a.key.localeCompare(b.key));
  let x = 0, y = 0, rowH = 0, width = 0;
  const places = new Map();
  for (const it of order) {
    if (x + it.w > maxWidth) { x = 0; y += rowH + pad; rowH = 0; }
    places.set(it.key, { x, y });
    x += it.w + pad;
    rowH = Math.max(rowH, it.h);
    width = Math.max(width, x);
  }
  return { width: Math.max(1, width), height: Math.max(1, y + rowH), places };
}

// ---------- sprites (Freedoom, a WAD) ----------
const wadCache = new Map();
function loadWad(file) {
  if (!wadCache.has(file)) {
    const wad = wadMod.parseWad(toArrayBuffer(fs.readFileSync(file)));
    wadCache.set(file, { wad, palette: wadMod.extractPlaypal(wad, 0) });
  }
  return wadCache.get(file);
}

async function packSprite(m) {
  const { wad, palette } = loadWad(SRC.freedoomWad);
  const base = m.entry;
  // one rendered patch per lump, however many views use it
  const patches = new Map();
  const groups = {};
  const warnings = [];
  for (const [groupName, spec] of Object.entries(m.sprite.groups)) {
    const frames = [];
    for (const letter of spec.letters) {
      const slots = wadMod.spriteViewsForFrame(wad, base, letter);
      if (slots.every((s) => s === undefined)) {
        warnings.push(`${m.id}: no lumps for ${base}${letter} (${groupName})`);
        continue;
      }
      const views = slots.map((slot) => {
        if (!slot) return null;
        if (!patches.has(slot.lump)) {
          patches.set(slot.lump, wadMod.extractPatch(wad, slot.lump, palette));
        }
        return { lump: slot.lump, mirrored: slot.mirrored };
      });
      frames.push({ letter, views });
    }
    if (frames.length === 0) throw new Error(`${m.id}: group ${groupName} has no frames`);
    groups[groupName] = { ticks: spec.ticks, frames };
  }

  // the atlas holds each lump once
  const items = [...patches.entries()].map(([key, p]) => ({ key, w: p.width, h: p.height }));
  const sheet = shelfPack(items);
  const composites = [];
  for (const [key, p] of patches) {
    const at = sheet.places.get(key);
    composites.push({ input: Buffer.from(p.data), raw: { width: p.width, height: p.height, channels: 4 }, left: at.x, top: at.y });
  }
  const atlas = await sharp({ create: { width: sheet.width, height: sheet.height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(composites)
    .webp({ quality: 90, alphaQuality: 100, effort: 6 })
    .toBuffer();

  let pixelHeight = 0;
  for (const p of patches.values()) pixelHeight = Math.max(pixelHeight, p.height);
  const rectOf = (lump) => {
    const p = patches.get(lump);
    const at = sheet.places.get(lump);
    return { x: at.x, y: at.y, w: p.width, h: p.height, ox: p.leftOffset, oy: p.topOffset };
  };
  const outGroups = {};
  for (const [name, g] of Object.entries(groups)) {
    outGroups[name] = {
      ticks: g.ticks,
      frames: g.frames.map((f) => ({
        letter: f.letter,
        views: f.views.map((v) => {
          if (!v) return null;
          const r = rectOf(v.lump);
          return [r.x, r.y, r.w, r.h, r.ox, r.oy, v.mirrored ? 1 : 0];
        }),
      })),
    };
  }
  const json = {
    id: m.id,
    name: m.name ?? m.id,
    era: 'sprite',
    source: m.source,
    entry: m.entry,
    archetype: m.archetype,
    heightM: m.heightM,
    pixelHeight,
    metresPerPixel: Number((m.heightM / pixelHeight).toFixed(6)),
    atlas: { file: 'sprite.webp', width: sheet.width, height: sheet.height },
    views: 'Eight views per frame, rotation 1 to 8 (index 0 to 7). Each view is null or [x, y, w, h, originX, originY, mirrored]. A mirrored view draws the rect flipped left to right, with its origin at (w - originX, originY).',
    groups: outGroups,
  };
  const frameCount = Object.values(outGroups).reduce((n, g) => n + g.frames.length, 0);
  return {
    files: { 'sprite.webp': atlas, 'sprite.json': Buffer.from(JSON.stringify(json)) },
    stats: { frames: frameCount, groups: Object.fromEntries(Object.entries(outGroups).map(([k, g]) => [k, g.frames.length])), atlas: [sheet.width, sheet.height] },
    warnings,
  };
}

// ---------- MDL (LibreQuake PAK) ----------
const pakCache = new Map();
function loadPaks() {
  if (pakCache.size === 0) {
    // Quake reads the later pak first: pak1 overrides pak0
    for (const name of ['pak1.pak', 'pak0.pak']) {
      const file = path.join(SRC.libreDir, name);
      pakCache.set(name, pakMod.parsePak(toArrayBuffer(fs.readFileSync(file))));
    }
  }
  return [...pakCache.values()];
}
function pakFile(name) {
  for (const pak of loadPaks()) {
    const bytes = pakMod.readPakEntry(pak, name);
    if (bytes) return bytes;
  }
  throw new Error(`not in the LibreQuake paks: ${name}`);
}

async function packMdl(m) {
  const bytes = pakFile(m.entry);
  const model = mdlMod.parseMdl(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  const palette = pakFile('gfx/palette.lmp');
  const skinRgba = mdlMod.mdlSkinRgba(model.skin, palette);
  const skinWebp = await sharp(Buffer.from(skinRgba), { raw: { width: model.skinWidth, height: model.skinHeight, channels: 4 } })
    .webp({ quality: 88, effort: 6 })
    .toBuffer();

  // clip frames, as inclusive 0-based ranges
  const clipFrames = {};
  for (const [clip, range] of Object.entries(m.clips)) {
    const [a, b] = range;
    if (a < 0 || b >= model.frames.length || a > b) throw new Error(`${m.id}: clip ${clip} range ${a}..${b} is outside 0..${model.frames.length - 1}`);
    clipFrames[clip] = Array.from({ length: b - a + 1 }, (_, i) => a + i);
  }
  const usedFrames = [...new Set(Object.values(clipFrames).flat())];
  const baseFrame = clipFrames.walk?.[0] ?? usedFrames[0];

  const layout = mdlMod.layoutMdlMesh(model);
  // Quake's winding can come out inside-out; flip it so the volume is positive (outward)
  const srcTris = model.triangles.map((t) => [t.v[0], t.v[1], t.v[2]]);
  const baseQuake = model.frames[baseFrame].positions;
  const volume = mdlMod.mdlSignedVolume(baseQuake, srcTris.flat());
  const flip = volume < 0;
  const swapTri = (arr) => {
    const out = new (arr.constructor)(arr.length);
    for (let i = 0; i + 2 < arr.length; i += 3) {
      out[i] = arr[i]; out[i + 1] = arr[i + 2]; out[i + 2] = arr[i + 1];
    }
    return out;
  };
  const srcIdx = flip ? swapTri(Uint32Array.from(srcTris.flat())) : Uint32Array.from(srcTris.flat());
  const expIdx = flip ? swapTri(layout.indices) : layout.indices;

  // Quake axes to glTF, then scale and stand the model on y = 0 at the requested height
  const toGltf = (positions) => {
    const out = new Float32Array(positions.length);
    for (let i = 0; i < positions.length; i += 3) {
      const [x, y, z] = mdlMod.mdlQuakeToGltf(positions[i], positions[i + 1], positions[i + 2]);
      out[i] = x; out[i + 1] = y; out[i + 2] = z;
    }
    return out;
  };
  const baseG = toGltf(baseQuake);
  let minY = Infinity, maxY = -Infinity;
  for (let i = 1; i < baseG.length; i += 3) { minY = Math.min(minY, baseG[i]); maxY = Math.max(maxY, baseG[i]); }
  const s = m.heightM / (maxY - minY);
  const place = (g) => {
    const out = new Float32Array(g.length);
    for (let i = 0; i < g.length; i += 3) {
      out[i] = g[i] * s; out[i + 1] = (g[i + 1] - minY) * s; out[i + 2] = g[i + 2] * s;
    }
    return out;
  };
  const basePlaced = place(baseG);
  const normalsSource = mdlMod.mdlVertexNormals(basePlaced, srcIdx);

  // one GPU vertex per (model vertex, seam side): gather every frame through the layout
  const vcount = layout.sourceIndex.length;
  const gather = (srcPositions) => {
    const out = new Float32Array(vcount * 3);
    for (let e = 0; e < vcount; e++) {
      const src = layout.sourceIndex[e] * 3;
      out[e * 3] = srcPositions[src]; out[e * 3 + 1] = srcPositions[src + 1]; out[e * 3 + 2] = srcPositions[src + 2];
    }
    return out;
  };
  const basePos = gather(basePlaced);
  const baseNormals = new Float32Array(vcount * 3);
  for (let e = 0; e < vcount; e++) {
    const src = layout.sourceIndex[e] * 3;
    baseNormals[e * 3] = normalsSource[src]; baseNormals[e * 3 + 1] = normalsSource[src + 1]; baseNormals[e * 3 + 2] = normalsSource[src + 2];
  }

  const doc = new Document();
  doc.setLogger(LOG);
  const buffer = doc.createBuffer();
  const acc = (type, arr) => doc.createAccessor().setType(type).setArray(arr).setBuffer(buffer);
  const indexArr = vcount < 65536 ? Uint16Array.from(expIdx) : Uint32Array.from(expIdx);
  const tex = doc.createTexture('skin').setImage(skinWebp).setMimeType('image/webp');
  const mat = doc.createMaterial(m.id)
    .setBaseColorTexture(tex)
    .setBaseColorFactor([1, 1, 1, 1])
    .setMetallicFactor(0)
    .setRoughnessFactor(1);
  const prim = doc.createPrimitive()
    .setAttribute('POSITION', acc('VEC3', basePos))
    .setAttribute('NORMAL', acc('VEC3', baseNormals))
    .setAttribute('TEXCOORD_0', acc('VEC2', layout.uv))
    .setIndices(acc('SCALAR', indexArr))
    .setMaterial(mat);

  // morph targets: each used frame as a delta from the base frame
  const targetOf = new Map();
  for (const f of usedFrames) {
    const framePos = gather(place(toGltf(model.frames[f].positions)));
    const delta = new Float32Array(vcount * 3);
    for (let i = 0; i < delta.length; i++) delta[i] = framePos[i] - basePos[i];
    const target = doc.createPrimitiveTarget(`f${f}`).setAttribute('POSITION', acc('VEC3', delta));
    prim.addTarget(target);
    targetOf.set(f, targetOf.size);
  }
  const mesh = doc.createMesh(m.id).addPrimitive(prim);
  const node = doc.createNode(m.id).setMesh(mesh);
  doc.createScene(m.id).addChild(node);

  // one animation per clip: STEP weights, one key per frame, the frame's own interval between keys
  const nTargets = targetOf.size;
  const clipReport = {};
  for (const [clip, frames] of Object.entries(clipFrames)) {
    const times = [];
    let t = 0;
    for (const f of frames) { times.push(t); t += model.frames[f].interval; }
    const weights = new Float32Array(frames.length * nTargets);
    frames.forEach((f, k) => { weights[k * nTargets + targetOf.get(f)] = 1; });
    const sampler = doc.createAnimationSampler().setInterpolation('STEP')
      .setInput(acc('SCALAR', Float32Array.from(times)))
      .setOutput(acc('SCALAR', weights));
    const channel = doc.createAnimationChannel().setTargetNode(node).setTargetPath('weights').setSampler(sampler);
    doc.createAnimation(clip).addSampler(sampler).addChannel(channel);
    clipReport[clip] = { frames: frames.length, seconds: Number(t.toFixed(3)), range: m.clips[clip] };
  }

  // No meshopt here: its quantize pass scales the base positions into a node transform that the morph
  // deltas do not follow, so the models came out at the wrong size (seen on the sheet). Uncompressed is fine at this size.
  await doc.transform(prune());
  const glb = Buffer.from(await io.writeBinary(doc));
  const json = {
    id: m.id,
    name: m.name ?? m.id,
    era: m.era,
    source: m.source,
    entry: m.entry,
    archetype: m.archetype,
    heightM: m.heightM,
    model: { file: 'model.glb', vertices: vcount, triangles: expIdx.length / 3, morphTargets: nTargets, skin: [model.skinWidth, model.skinHeight], flippedWinding: flip, meshopt: false },
    clips: clipReport,
  };
  return {
    files: { 'model.glb': glb, 'model.json': Buffer.from(JSON.stringify(json)) },
    stats: { frames: Object.values(clipReport).reduce((n, c) => n + c.frames, 0), clips: clipReport, targets: nTargets, flippedWinding: flip },
    warnings: [],
  };
}

// ---------- Quaternius (CC0 glTF) ----------
async function packQuaternius(m) {
  const file = path.join(SRC.quaterniusDir, m.entry);
  const doc = await io.read(file);
  const root = doc.getRoot();
  const wanted = m.clips;
  const have = root.listAnimations().map((a) => a.getName());
  for (const [clip, name] of Object.entries(wanted)) {
    if (!have.includes(name)) throw new Error(`${m.id}: ${m.entry} has no clip "${name}" (has ${have.join(', ')})`);
  }
  for (const anim of root.listAnimations()) {
    const name = anim.getName();
    const std = Object.keys(wanted).find((k) => wanted[k] === name);
    if (std) anim.setName(std);
    else anim.dispose();
  }
  // height: bind-pose bounds of every primitive (the packed meshes sit at their own origin)
  let minY = Infinity, maxY = -Infinity;
  for (const mesh of root.listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION');
      if (!pos) continue;
      minY = Math.min(minY, pos.getMin([])[1]);
      maxY = Math.max(maxY, pos.getMax([])[1]);
    }
  }
  const s = m.heightM / (maxY - minY);
  const scene = root.getDefaultScene() ?? root.listScenes()[0];
  const wrap = doc.createNode(m.id).setScale([s, s, s]).setTranslation([0, -minY * s, 0]);
  for (const child of scene.listChildren()) {
    scene.removeChild(child);
    wrap.addChild(child);
  }
  scene.addChild(wrap);
  await doc.transform(textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [512, 512] }));
  await doc.transform(prune(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  const glb = Buffer.from(await io.writeBinary(doc));
  const clipReport = {};
  const after = doc.getRoot();
  for (const anim of after.listAnimations()) {
    const frames = anim.listSamplers()[0]?.getInput()?.getCount() ?? 0;
    clipReport[anim.getName()] = { keys: frames, seconds: Number((anim.listSamplers()[0]?.getInput()?.getMax([])[0] ?? 0).toFixed(3)) };
  }
  const json = {
    id: m.id,
    name: m.name ?? m.id,
    era: m.era,
    source: m.source,
    entry: m.entry,
    archetype: m.archetype,
    heightM: m.heightM,
    model: { file: 'model.glb', scaleFromRaw: Number(s.toFixed(6)) },
    clips: clipReport,
  };
  return {
    files: { 'model.glb': glb, 'model.json': Buffer.from(JSON.stringify(json)) },
    stats: { frames: Object.values(clipReport).reduce((n, c) => n + c.keys, 0), clips: clipReport, scaleFromRaw: Number(s.toFixed(6)) },
    warnings: [],
  };
}

// ---------- run ----------
const roster = JSON.parse(fs.readFileSync(ROSTER, 'utf8'));
let monsters = roster.monsters;
if (onlyIds) monsters = monsters.filter((m) => onlyIds.includes(m.id));
if (onlyBatch !== undefined) monsters = monsters.filter((m) => m.batch === onlyBatch);
if (monsters.length === 0) throw new Error('no monsters selected');

// one core per archetype is the rule; checked against the full roster, not the selection
const coreByArch = new Map();
for (const m of roster.monsters) {
  if (m.core) coreByArch.set(m.archetype, (coreByArch.get(m.archetype) ?? 0) + 1);
}
for (const [arch, n] of coreByArch) {
  if (n !== 1) throw new Error(`archetype ${arch} has ${n} core monsters (need exactly 1)`);
}

// existing manifest entries for monsters not in this run are kept
let manifest = { version: 1, core: [], public: [], monsters: {}, held: roster.held ?? [] };
if (fs.existsSync(MANIFEST)) {
  const prev = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  manifest = { ...manifest, monsters: prev.monsters ?? {} };
}
// monsters that left the roster (dropped, or moved to "held") lose their folders and manifest entries
const rosterIds = new Set(roster.monsters.map((m) => m.id));
for (const id of Object.keys(manifest.monsters)) {
  if (rosterIds.has(id)) continue;
  for (const root of [OUT_CORE, OUT_PUBLIC]) fs.rmSync(path.join(root, id), { recursive: true, force: true });
  delete manifest.monsters[id];
}

const packed = [];
for (const m of monsters) {
  const where = m.core ? 'core' : 'public';
  const dir = path.join(m.core ? OUT_CORE : OUT_PUBLIC, m.id);
  let result;
  if (m.source === 'freedoom') result = await packSprite(m);
  else if (m.source === 'librequake') result = await packMdl(m);
  else if (m.source === 'quaternius') result = await packQuaternius(m);
  else throw new Error(`${m.id}: unknown source ${m.source}`);

  fs.mkdirSync(dir, { recursive: true });
  const sizes = {};
  for (const [name, buf] of Object.entries(result.files)) {
    fs.writeFileSync(path.join(dir, name), buf);
    sizes[name] = buf.length;
  }
  // a monster in the other folder from an earlier run would be stale
  const other = path.join(m.core ? OUT_PUBLIC : OUT_CORE, m.id);
  if (fs.existsSync(other)) fs.rmSync(other, { recursive: true, force: true });

  const bytes = Object.values(sizes).reduce((n, v) => n + v, 0);
  manifest.monsters[m.id] = {
    id: m.id,
    name: m.name ?? m.id,
    batch: m.batch,
    source: m.source,
    entry: m.entry,
    era: m.era,
    archetype: m.archetype,
    heightM: m.heightM,
    where,
    dir: path.relative(ROOT, dir).split(path.sep).join('/'),
    files: sizes,
    bytes,
    frames: result.stats.frames,
    detail: result.stats,
    warnings: result.warnings,
  };
  packed.push(`${m.id} (${where}, ${bytes} bytes, ${result.stats.frames} frames)`);
  for (const w of result.warnings) console.warn(`warning: ${w}`);
}

// the core and public lists are derived from the full manifest, not this run
const all = Object.values(manifest.monsters);
manifest.core = all.filter((m) => m.where === 'core').map((m) => m.id).sort();
manifest.public = all.filter((m) => m.where === 'public').map((m) => m.id).sort();
const coreBytes = all.filter((m) => m.where === 'core').reduce((n, m) => n + m.bytes, 0);
const publicBytes = all.filter((m) => m.where === 'public').reduce((n, m) => n + m.bytes, 0);
manifest.totals = { coreBytes, publicBytes, coreBudgetBytes: CORE_BUDGET_BYTES };
manifest.batches = roster.batches;
if (coreBytes > CORE_BUDGET_BYTES) {
  throw new Error(`inline core is ${coreBytes} bytes, over the ${CORE_BUDGET_BYTES} budget`);
}

// credits: the notices as shipped in the archives, for the game to show later
const readText = (file) => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8').replace(/^﻿/, '').trim() : '');
const credits = {
  sources: [
    {
      id: 'freedoom',
      name: 'Freedoom 0.13.0 (freedoom2.wad sprites)',
      licence: 'BSD-3-Clause',
      url: 'https://freedoom.github.io/',
      notice: readText(SRC.freedoomCopying),
    },
    {
      id: 'librequake',
      name: 'LibreQuake (lite, id1 pak0/pak1: progs/*.mdl, gfx/palette.lmp)',
      licence: 'BSD-3-Clause (the models, textures and sounds; the GPL-2 files are not used)',
      url: 'https://github.com/lavenderdotpet/LibreQuake',
      notice: readText(SRC.libreCopying),
    },
    {
      id: 'quaternius',
      name: 'Quaternius, Ultimate Monsters packs (Big, Blob, Flying)',
      licence: 'CC0 1.0 Universal (public domain dedication)',
      url: 'https://quaternius.com/',
      notice: 'CC0 1.0 Universal. Thanks to Quaternius (quaternius.com) for the free monster packs.',
      note: 'The License.txt inside the downloaded folder is headed "Ultimate Platformer Pack"; the CC0 status is taken from the brief and the pack owner. Check it before shipping.',
    },
  ],
  monsters: all
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((m) => ({ id: m.id, name: m.name, source: m.source, entry: m.entry, era: m.era, archetype: m.archetype, where: m.where })),
  held: roster.held ?? [],
};
const creditsPath = path.join(OUT_PUBLIC, 'credits.json');
fs.mkdirSync(OUT_PUBLIC, { recursive: true });
fs.writeFileSync(creditsPath, JSON.stringify(credits, null, 2));

fs.mkdirSync(path.dirname(MANIFEST), { recursive: true });
fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');

console.log(`packed ${packed.length}:`);
for (const line of packed) console.log('  ' + line);
console.log(`inline core: ${coreBytes} bytes (budget ${CORE_BUDGET_BYTES}); public: ${publicBytes} bytes`);
