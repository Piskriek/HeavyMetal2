/**
 * The machines as the game builds them today, from four sides, on one contact sheet (TICKET-40 reference for Argo, who
 * cannot open the generated models): every plot machine kind through machineProp at stage 6 on High, and the vehicle
 * fabricator, each framed alike with its real size written beside it. Needs the Vite dev server (it imports the game's
 * own modules), default http://localhost:5192.
 *   node scripts/machine-reference-sheet.mjs [out.png] [devServerUrl]
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const out = path.resolve(root, process.argv[2] ?? 'docs/argo/plans/shots/40/machines-reference.png');
const base = process.argv[3] ?? 'http://localhost:5192';
const chromePath = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find(fs.existsSync);
if (!chromePath) throw new Error('Chrome not found');

const browser = await chromium.launch({ executablePath: chromePath, headless: true, args: ['--ignore-gpu-blocklist', '--enable-gpu'] });
const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
await page.goto(`${base}/?e2e`, { waitUntil: 'domcontentloaded', timeout: 60000 });
const dataUrl = await page.evaluate(async () => {
  const THREE = await import('/node_modules/.vite/deps/three.js');
  const gen = await import('/src/assets/gen.ts');
  const props = await import('/src/play/machine-props.ts');
  const genProps = await import('/src/assets/gen-props.ts');
  const lab = await import('/@fs/C:/MarbleGp/packages/labkit/src/index.ts');
  for (const a of ['mill', 'press-frame', 'press-ram', 'watermaker', 'projector-mast', 'projector-head', 'fabricator-frame', 'fabricator-head']) {
    await gen.loadGen?.(a, 'high');
  }
  const mats = lab.createMaterials();
  const KINDS = ['drill', 'mill', 'press', 'projector', 'water', 'power', 'pylon', 'heavy-mill', 'heavy-press', 'heavy-projector', 'heavy-water'];
  const rows = KINDS.map((k) => ({ name: k, object: props.machineProp(mats, k, 6, 'high').group }));
  rows.push({ name: 'fabricator', object: genProps.createGenFabricator('high', 6).group });

  const V = 256, LABEL = 220, W = LABEL + V * 4, H = V * rows.length;
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
  const grid = new THREE.GridHelper(12, 12, 0x5a6878, 0x3a4652);
  scene.add(grid);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 200);
  const VIEWS = [['front', 0], ['right', Math.PI / 2], ['back', Math.PI], ['left', -Math.PI / 2]];
  rows.forEach((row, r) => {
    scene.add(row.object);
    row.object.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(row.object);
    const size = box.getSize(new THREE.Vector3()), centre = box.getCenter(new THREE.Vector3());
    const radius = 0.5 * size.length();
    const dist = (radius / Math.sin(THREE.MathUtils.degToRad(15))) * 1.05;
    VIEWS.forEach(([, yaw], c) => {
      const dir = new THREE.Vector3(Math.sin(yaw), 0.36, Math.cos(yaw)).normalize();
      camera.position.copy(centre).addScaledVector(dir, dist);
      camera.lookAt(centre);
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
      ctx.drawImage(renderer.domElement, LABEL + c * V, r * V);
    });
    scene.remove(row.object);
    ctx.fillStyle = '#e8eef1';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText(row.name, 14, r * V + 40);
    ctx.font = '15px sans-serif';
    ctx.fillStyle = '#9fb0bf';
    ctx.fillText(`${size.x.toFixed(2)} x ${size.y.toFixed(2)} x ${size.z.toFixed(2)} m`, 14, r * V + 66);
    ctx.fillText('views: front, right,', 14, r * V + 92);
    ctx.fillText('back, left (+z is front)', 14, r * V + 112);
    ctx.strokeStyle = '#0e1318';
    ctx.strokeRect(0.5, r * V + 0.5, W - 1, V - 1);
  });
  return sheet.toDataURL('image/png');
});
await browser.close();
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, Buffer.from(dataUrl.split(',')[1], 'base64'));
console.log(`wrote ${path.relative(root, out)} (${Math.round(fs.statSync(out).size / 1024)} KB)`);
