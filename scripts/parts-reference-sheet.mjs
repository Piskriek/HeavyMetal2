/**
 * Every Shape Press part at its default sliders, on one contact sheet: rank 0, rank 1 and rank 2 from the front-right,
 * then rank 2 from the back-left, each material slot in its own colour (named under the part). For reviewing new
 * generators (TICKET-40). Needs the Vite dev server (it imports the game's own modules), default http://localhost:5192.
 *   node scripts/parts-reference-sheet.mjs [out.png] [devServerUrl]
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const out = path.resolve(root, process.argv[2] ?? 'docs/argo/plans/shots/40/parts-reference.png');
const base = process.argv[3] ?? 'http://localhost:5192';
// optional: only these generators (comma list), drawn larger
const only = (process.argv[4] ?? '').split(',').filter(Boolean);
const chromePath = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find(fs.existsSync);
if (!chromePath) throw new Error('Chrome not found');

const browser = await chromium.launch({ executablePath: chromePath, headless: true, args: ['--ignore-gpu-blocklist', '--enable-gpu'] });
const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
await page.goto(`${base}/?e2e`, { waitUntil: 'domcontentloaded', timeout: 60000 });
const result = await page.evaluate(async (only) => {
  const THREE = await import('/node_modules/.vite/deps/three.js');
  const partgen = await import('/@fs/C:/MarbleGp/packages/partgen/src/index.ts');
  const { partGeometry } = await import('/src/play/part-preview.tsx');
  const SLOT_COLOURS = ['#c9c6bd', '#e5b84a', '#3f8fd0', '#b5723f', '#3c9a5a', '#c04a6a', '#8a7ad0'];
  const gens = Object.values(partgen.GENERATORS).filter((g) => only.length === 0 || only.includes(g.id));
  const V = only.length ? 380 : 200, LABEL = 230, W = LABEL + V * 4, H = V * gens.length;
  const sheet = document.createElement('canvas');
  sheet.width = W; sheet.height = H;
  const ctx = sheet.getContext('2d');
  ctx.fillStyle = '#1b222b';
  ctx.fillRect(0, 0, W, H);
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(V, V);
  renderer.setClearColor(0x2b3540, 1);
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xe8f1fa, 0x2a3442, 2.0));
  const sun = new THREE.DirectionalLight(0xfff3e0, 2.6);
  sun.position.set(4, 8, 6);
  scene.add(sun);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.001, 200);
  const mats = SLOT_COLOURS.map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, metalness: 0.1, flatShading: true }));
  const issues = [];
  gens.forEach((g, r) => {
    const params = partgen.resolveParams(g.params, {});
    const views = [[0, 1], [1, 1], [2, 1], [2, -1]];
    views.forEach(([rank, side], c) => {
      const md = g.build(params, rank);
      if (!md || md.indices.length === 0) { issues.push(`${g.id} rank ${rank}: empty`); return; }
      const names = [...g.slots];
      for (const s of md.slots) if (!names.includes(s.name)) names.push(s.name);
      const mesh = new THREE.Mesh(partGeometry(md, names), names.map((_, i) => mats[i % mats.length]));
      scene.add(mesh);
      const box = new THREE.Box3().setFromObject(mesh);
      if (box.min.y < -1e-6) issues.push(`${g.id} rank ${rank}: below its base (min y ${box.min.y.toFixed(4)})`);
      const centre = box.getCenter(new THREE.Vector3()), radius = 0.5 * box.getSize(new THREE.Vector3()).length();
      const dist = (Math.max(radius, 0.005) / Math.sin(THREE.MathUtils.degToRad(15))) * 1.05;
      camera.position.copy(centre).addScaledVector(new THREE.Vector3(side, 0.9, 1.35 * side).normalize(), dist);
      camera.near = dist / 100; camera.far = dist * 100;
      camera.lookAt(centre);
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
      ctx.drawImage(renderer.domElement, LABEL + c * V, r * V);
      scene.remove(mesh);
      mesh.geometry.dispose();
      if (c === 2) {
        const size = box.getSize(new THREE.Vector3());
        ctx.fillStyle = '#9fb0bf';
        ctx.font = '13px sans-serif';
        ctx.fillText(`${size.x.toFixed(2)} x ${size.y.toFixed(2)} x ${size.z.toFixed(2)} m`, 14, r * V + 64);
        ctx.fillText(`${Math.round(md.indices.length / 3)} tris at rank 2`, 14, r * V + 82);
      }
    });
    ctx.fillStyle = '#e8eef1';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText(g.label, 14, r * V + 30);
    ctx.font = '12px sans-serif';
    ctx.fillStyle = '#9fb0bf';
    ctx.fillText(g.id, 14, r * V + 46);
    g.slots.forEach((s, i) => {
      ctx.fillStyle = SLOT_COLOURS[i % SLOT_COLOURS.length];
      ctx.fillRect(14, r * V + 100 + i * 16, 10, 10);
      ctx.fillStyle = '#c8d3dc';
      ctx.fillText(s, 30, r * V + 109 + i * 16);
    });
    ctx.strokeStyle = '#0e1318';
    ctx.strokeRect(0.5, r * V + 0.5, W - 1, V - 1);
  });
  ctx.fillStyle = '#6f8090';
  ctx.font = '12px sans-serif';
  return { url: sheet.toDataURL('image/png'), issues, count: gens.length };
}, only);
await browser.close();
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, Buffer.from(result.url.split(',')[1], 'base64'));
console.log(`wrote ${path.relative(root, out)}: ${result.count} parts (${Math.round(fs.statSync(out).size / 1024)} KB)`);
for (const i of result.issues) console.log('ISSUE:', i);
