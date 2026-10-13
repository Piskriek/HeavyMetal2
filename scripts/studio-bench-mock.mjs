// TEST FIXTURE for the Studio's asset bench (TASK-18). Never run by hand. The dev server runs it instead of every step
// (image, 3D model, post, pack) only when STUDIO_BENCH_MOCK=1, which scripts/test-studio.mjs sets together with
// STUDIO_BENCH_DIR, a temporary folder shaped like the repository (zips/runworld/assets, apps/web/src/assets/gen,
// apps/web/public/hd, docs/runworld/assets.json). The fixture writes nothing outside that folder, and it refuses to run
// without it. It never calls the network and never runs Blender.
//   node scripts/studio-bench-mock.mjs <images|model|post|pack> <id>
// Each step writes small synthetic files that differ from run to run (a new colour per archive), so the page shows a
// real old and new. An optional <STUDIO_BENCH_DIR>/mock-control.json lets a test make a step write nothing ("skip") or
// fail ("fail"), without a restart: {"skip":["post"],"fail":["model"]}.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const dataDir = process.env.STUDIO_BENCH_DIR;
const [step, id] = process.argv.slice(2);
const STEPS = ['images', 'model', 'post', 'pack'];
if (!dataDir) {
  console.log('refused: STUDIO_BENCH_DIR is not set (the fixture only runs in a temporary folder)');
  process.exit(2);
}
if (!STEPS.includes(step) || !id || !/^[a-z0-9-]{1,40}$/.test(id)) {
  console.log('usage: studio-bench-mock.mjs <images|model|post|pack> <id>');
  process.exit(2);
}

const dir = path.join(dataDir, 'zips', 'runworld', 'assets', id);
const oldDir = path.join(dir, 'old');
const genDir = path.join(dataDir, 'apps', 'web', 'src', 'assets', 'gen');
const hdDir = path.join(dataDir, 'apps', 'web', 'public', 'hd', id);
const PALETTE = [[0.93, 0.55, 0.18], [0.2, 0.6, 0.92], [0.45, 0.88, 0.38], [0.82, 0.3, 0.72]];
const say = (line) => console.log(line);

function readControl() {
  try {
    const c = JSON.parse(fs.readFileSync(path.join(dataDir, 'mock-control.json'), 'utf8'));
    return { skip: Array.isArray(c.skip) ? c.skip : [], fail: Array.isArray(c.fail) ? c.fail : [] };
  } catch {
    return { skip: [], fail: [] };
  }
}
const control = readControl();
const run = (fs.existsSync(oldDir) ? fs.readdirSync(oldDir).length : 0) + 1;
const colour = PALETTE[(run - 1) % PALETTE.length];

// ---- a plain box as a GLB (24 vertices, 36 indices, per-face normals, one PBR material with a colour)
function boxGlb(size, rgb) {
  const pos = [];
  const nrm = [];
  const idx = [];
  const h = size.map((s) => s / 2);
  for (let axis = 0; axis < 3; axis++) {
    const a = axis;
    const b = (axis + 1) % 3;
    const c = (axis + 2) % 3;
    for (const sign of [-1, 1]) {
      const base = pos.length / 3;
      const N = [0, 0, 0];
      N[a] = sign;
      for (const [tb, tc] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        const P = [0, 0, 0];
        P[a] = sign * h[a];
        P[b] = tb * h[b];
        P[c] = tc * h[c];
        pos.push(...P);
        nrm.push(...N);
      }
      idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }
  const posBuf = Buffer.from(new Float32Array(pos).buffer);
  const nrmBuf = Buffer.from(new Float32Array(nrm).buffer);
  const idxBuf = Buffer.from(new Uint16Array(idx).buffer);
  const bin = Buffer.concat([posBuf, nrmBuf, idxBuf]);
  const min = [0, 1, 2].map((k) => Math.min(...pos.filter((_, i) => i % 3 === k)));
  const max = [0, 1, 2].map((k) => Math.max(...pos.filter((_, i) => i % 3 === k)));
  const json = {
    asset: { version: '2.0', generator: 'studio-bench-mock (test fixture)' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, name: id }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0, NORMAL: 1 }, indices: 2, material: 0 }] }],
    materials: [{
      name: 'mock',
      doubleSided: true,
      pbrMetallicRoughness: { baseColorFactor: [...rgb, 1], metallicFactor: 0, roughnessFactor: 0.7 },
    }],
    accessors: [
      { bufferView: 0, componentType: 5126, count: pos.length / 3, type: 'VEC3', min, max },
      { bufferView: 1, componentType: 5126, count: nrm.length / 3, type: 'VEC3' },
      { bufferView: 2, componentType: 5123, count: idx.length, type: 'SCALAR' },
    ],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: posBuf.length, target: 34962 },
      { buffer: 0, byteOffset: posBuf.length, byteLength: nrmBuf.length, target: 34962 },
      { buffer: 0, byteOffset: posBuf.length + nrmBuf.length, byteLength: idxBuf.length, target: 34963 },
    ],
    buffers: [{ byteLength: bin.length }],
  };
  let jsonBuf = Buffer.from(JSON.stringify(json), 'utf8');
  jsonBuf = Buffer.concat([jsonBuf, Buffer.alloc((4 - (jsonBuf.length % 4)) % 4, 0x20)]);
  const binPad = Buffer.concat([bin, Buffer.alloc((4 - (bin.length % 4)) % 4, 0)]);
  const head = Buffer.alloc(12);
  head.write('glTF', 0, 'ascii');
  head.writeUInt32LE(2, 4);
  head.writeUInt32LE(12 + 8 + jsonBuf.length + 8 + binPad.length, 8);
  const jh = Buffer.alloc(8);
  jh.writeUInt32LE(jsonBuf.length, 0);
  jh.write('JSON', 4, 'ascii');
  const bh = Buffer.alloc(8);
  bh.writeUInt32LE(binPad.length, 0);
  bh.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([head, jh, jsonBuf, bh, binPad]);
}

// ---- a striped PNG (for the new image), with the same colour as the model
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, 'ascii'), data])), 0);
  return Buffer.concat([len, Buffer.from(type, 'ascii'), data, crc]);
}
function pngOf(rgb, w = 128, h = 128) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const light = ((x >> 4) + (y >> 4)) % 2 === 0 ? 1 : 0.62;
      const o = y * (w * 3 + 1) + 1 + x * 3;
      raw[o] = Math.round(rgb[0] * 255 * light);
      raw[o + 1] = Math.round(rgb[1] * 255 * light);
      raw[o + 2] = Math.round(rgb[2] * 255 * light);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---- the steps
if (control.fail.includes(step)) {
  say(`fixture ${step} ${id}: failing (mock-control)`);
  process.exit(1);
}
if (control.skip.includes(step)) {
  say(`fixture ${step} ${id}: writing nothing (mock-control)`);
  process.exit(0);
}

const write = (dest, data) => {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, data);
  say(`  wrote ${path.relative(dataDir, dest).split(path.sep).join('/')}`);
};
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
say(`fixture ${step} ${id}: run ${run}`);
await pause(200);

if (step === 'images') {
  write(path.join(dir, 'source.png'), pngOf(colour));
  write(path.join(dir, 'source.png.json'), Buffer.from(JSON.stringify({ mock: true, run }, null, 2) + '\n'));
} else if (step === 'model') {
  write(path.join(dir, 'model-local.glb'), boxGlb([1.2, 0.6, 2.4], colour));
} else if (step === 'post') {
  write(path.join(dir, 'norm.glb'), boxGlb([1.2, 0.6, 2.4], colour));
  for (const level of ['low', 'mid', 'high']) {
    await pause(120);
    write(path.join(dir, `${level}.glb`), boxGlb([1.2, 0.6, 2.4], colour));
  }
} else if (step === 'pack') {
  const low = path.join(dir, 'low.glb');
  if (!['low', 'mid', 'high'].every((l) => fs.existsSync(path.join(dir, `${l}.glb`)))) {
    say('fixture pack: the levels are missing');
    process.exit(1);
  }
  write(path.join(genDir, `${id}.glb`), fs.readFileSync(low));
  // the HD pack is a stub here (the game never reads the temporary folder); the verify step only checks it was written
  for (const level of ['mid', 'high']) write(path.join(hdDir, `${level}.gltf`), Buffer.from('{"asset":{"version":"2.0"}}\n'));
}
say(`fixture ${step} ${id}: done`);
