// Contact sheet for a batch of packed monsters (TASK-23a look check).
//   node scripts/monster-sheet.mjs --batch N [--out docs/shots/monsters/batch-N.png]
// One row per monster. Sprites: walk (rotation 1), walk (rotation 3), walk (rotation 5), attack (rotation 1),
// the last death frame (rotation 1). 3D models: walk at 25%, 50%, 75%, attack at 50%, death at the end.
// 3D rows are rendered in headless Chrome with three.js (the same loaders the game uses), from the packed files.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { chromium } from 'playwright-core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flag = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const batch = Number(flag('--batch') ?? 1);
const outFile = path.resolve(ROOT, flag('--out') ?? `docs/shots/monsters/batch-${batch}.png`);
const CELL = 200;
const LABEL_W = 300;
const BG = { r: 27, g: 29, b: 34 };

const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/monsters/packed.json'), 'utf8'));
const monsters = Object.values(manifest.monsters).filter((m) => m.batch === batch).sort((a, b) => a.id.localeCompare(b.id));
if (monsters.length === 0) throw new Error(`no packed monsters in batch ${batch}`);

const chromePath = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find(fs.existsSync);
if (!chromePath) throw new Error('Chrome not found');

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.glb': 'model/gltf-binary' };
const PAGE = `<!doctype html><meta charset="utf-8"><title>sheet</title>
<script type="importmap">{"imports":{"three":"/files/node_modules/three/build/three.module.js","three/addons/":"/files/node_modules/three/examples/jsm/"}}</script>
<body style="margin:0;background:#1b1d22"><script type="module">
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
const canvas = document.createElement('canvas');
canvas.width = 256; canvas.height = 256; document.body.appendChild(canvas);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(256, 256, false);
renderer.setClearColor(0x1b1d22, 1);
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
window.renderPoses = async (url, facing, poses) => {
  const gltf = await loader.loadAsync(url);
  const scene = gltf.scene;
  scene.traverse((o) => { if (o.isMesh) { o.material.side = THREE.DoubleSide; } });
  const box = new THREE.Box3().setFromObject(scene);
  const size = box.getSize(new THREE.Vector3());
  const centre = box.getCenter(new THREE.Vector3());
  const radius = Math.max(size.x, size.y, size.z) * 0.62;
  const fov = 30;
  const camera = new THREE.PerspectiveCamera(fov, 1, 0.01, 1000);
  const dist = radius / Math.sin((fov * Math.PI) / 360);
  const dir = new THREE.Vector3(Math.sin(0.5) * facing, 0.18, Math.cos(0.5) * facing).normalize();
  camera.position.copy(centre).addScaledVector(dir, dist);
  camera.lookAt(centre.x, centre.y + size.y * 0.02, centre.z);
  scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x3a3228, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 1.8); sun.position.set(2, 4, 3); scene.add(sun);
  const mixer = new THREE.AnimationMixer(scene);
  const out = [];
  for (const pose of poses) {
    mixer.stopAllAction();
    const clip = gltf.animations.find((c) => c.name === pose.clip);
    if (!clip) { out.push(null); continue; }
    const action = mixer.clipAction(clip);
    action.reset(); action.play();
    mixer.update(0);
    mixer.update(clip.duration * pose.at);
    renderer.render(scene, camera);
    out.push(canvas.toDataURL('image/png'));
  }
  mixer.stopAllAction();
  return out;
};
window.ready = true;
</script>`;

const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/' || url === '/sheet.html') {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(PAGE);
    return;
  }
  if (url.startsWith('/files/')) {
    const rel = url.slice('/files/'.length);
    const allowed = rel.startsWith('node_modules/three/') || rel.startsWith('apps/web/public/monsters/') || rel.startsWith('apps/web/src/assets/monsters/');
    const file = path.resolve(ROOT, rel);
    if (allowed && file.startsWith(ROOT) && fs.existsSync(file)) {
      res.writeHead(200, { 'content-type': MIME[path.extname(file)] ?? 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
      return;
    }
  }
  res.writeHead(404);
  res.end('not found');
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;

const browser = await chromium.launch({ executablePath: chromePath, headless: true, args: ['--ignore-gpu-blocklist', '--enable-gpu'] });
const page = await browser.newPage({ viewport: { width: 300, height: 300 } });
page.on('pageerror', (e) => console.error('page error:', e.message));
await page.goto(`http://127.0.0.1:${port}/`);
await page.waitForFunction(() => window.ready === true, null, { timeout: 60000 });

async function render3d(m) {
  const url = `/files/${m.dir}/model.glb`;
  const facing = m.source === 'librequake' ? -1 : 1; // Quake models face -z after the axis change
  const poses = [
    { clip: 'walk', at: 0.25 }, { clip: 'walk', at: 0.5 }, { clip: 'walk', at: 0.75 },
    { clip: 'attack', at: 0.5 }, { clip: 'death', at: 0.999 },
  ];
  const urls = await page.evaluate(([u, f, p]) => window.renderPoses(u, f, p), [url, facing, poses]);
  return urls.map((d) => (d ? Buffer.from(d.split(',')[1], 'base64') : null));
}

async function spriteCells(m) {
  const dir = path.join(ROOT, m.dir);
  const json = JSON.parse(fs.readFileSync(path.join(dir, 'sprite.json'), 'utf8'));
  const atlas = path.join(dir, 'sprite.webp');
  const cut = async (view) => {
    if (!view) return null;
    const [x, y, w, h] = view;
    return sharp(atlas).extract({ left: x, top: y, width: w, height: h }).png().toBuffer();
  };
  const walk = json.groups.walk.frames;
  const attack = json.groups.attack.frames;
  const death = json.groups.death.frames;
  return [
    await cut(walk[0].views[0]),
    await cut(walk[0].views[2]),
    await cut(walk[0].views[4]),
    await cut(attack[0].views[0]),
    await cut(death[death.length - 1].views[0]),
  ];
}

const rows = [];
for (const m of monsters) {
  const cells = m.era === 'sprite' ? await spriteCells(m) : await render3d(m);
  rows.push({ m, cells });
  console.log(`rendered ${m.id}`);
}
await browser.close();
server.close();

// compose: label column, then the cells
const cols = 5;
const rowH = CELL + 10;
const width = LABEL_W + cols * (CELL + 10) + 10;
const height = rows.length * rowH + 10;
const composites = [];
for (let r = 0; r < rows.length; r++) {
  const { m, cells } = rows[r];
  const top = 10 + r * rowH;
  const label = `<svg width="${LABEL_W}" height="${CELL}" xmlns="http://www.w3.org/2000/svg">
    <text x="10" y="42" font-family="Arial, sans-serif" font-size="26" font-weight="700" fill="#e8ecf4">${m.id}</text>
    <text x="10" y="74" font-family="Arial, sans-serif" font-size="17" fill="#9fb3c8">${m.era} | ${m.archetype} | ${m.heightM} m</text>
    <text x="10" y="100" font-family="Arial, sans-serif" font-size="15" fill="#7d8ea3">${m.source}: ${m.entry}</text>
    <text x="10" y="124" font-family="Arial, sans-serif" font-size="14" fill="#7d8ea3">${m.bytes} bytes, ${m.frames} frames</text>
  </svg>`;
  composites.push({ input: Buffer.from(label), top, left: 0 });
  for (let c = 0; c < cols; c++) {
    const left = LABEL_W + 10 + c * (CELL + 10);
    const cell = cells[c];
    if (!cell) continue;
    const img = await sharp(cell).resize(CELL - 8, CELL - 8, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
    composites.push({ input: img, top: top + 4, left: left + 4 });
  }
}
const base = await sharp({ create: { width, height, channels: 3, background: BG } }).composite(composites.map((c) => ({ ...c, input: c.input }))).png().toBuffer();
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, base);
console.log(`wrote ${path.relative(ROOT, outFile)} (${width}x${height})`);
