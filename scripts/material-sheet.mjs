/**
 * The layered-material shelf on a test piece (plan 41 review): every `mat:` preset on a small kit (a plinth with a panel,
 * a can, a beam, a bracket and bolts, each a partgen part at its defaults), built through kit-build with the layered
 * renderer's prepareGeometry, at rank 0 (flattened per face), rank 1 (per pixel, standard) and rank 2 (per pixel,
 * physical where the material needs it), plus the top layer's mask view. Lit like the lab: a sun, a sky fill and the
 * room environment. Prints shader errors and how long each material took to prepare. Needs the Vite dev server.
 *   node scripts/material-sheet.mjs [out.png] [devServerUrl] [mat ids, comma separated]
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const out = path.resolve(root, process.argv[2] ?? 'docs/argo/plans/shots/41/material-sheet.png');
const base = process.argv[3] ?? 'http://localhost:5192';
const only = (process.argv[4] ?? '').split(',').filter(Boolean);
const chromePath = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find(fs.existsSync);
if (!chromePath) throw new Error('Chrome not found');

const browser = await chromium.launch({ executablePath: chromePath, headless: true, args: ['--ignore-gpu-blocklist', '--enable-gpu'] });
const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text().slice(0, 600)); });
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`${base}/?e2e`, { waitUntil: 'domcontentloaded', timeout: 60000 });
const result = await page.evaluate(async (only) => {
  const THREE = await import('/node_modules/.vite/deps/three.js');
  const { RoomEnvironment } = await import('/@fs/C:/MarbleGp/node_modules/three/examples/jsm/environments/RoomEnvironment.js');
  const partgen = await import('/@fs/C:/MarbleGp/packages/partgen/src/index.ts');
  const matstack = await import('/@fs/C:/MarbleGp/packages/matstack/src/index.ts');
  const { buildKitPreset } = await import('/src/play/kit-build.ts');
  const lm = await import('/src/play/layered-material.ts');

  // the test piece: a plinth, then each generator at its defaults, standing in a row on it
  const gens = ['panel', 'can', 'beam', 'bracket', 'bolt', 'bolt'];
  const sizes = gens.map((id) => {
    const g = partgen.GENERATORS[id];
    const md = g.build(partgen.resolveParams(g.params, {}), 2);
    return { id, min: md.min, max: md.max };
  });
  const gap = 0.05;
  const width = sizes.reduce((w, s) => w + (s.max[0] - s.min[0]) + gap, gap);
  const depth = Math.max(...sizes.map((s) => s.max[2] - s.min[2])) + 2 * gap;
  const PLINTH_H = 0.08;
  let x = -width / 2 + gap;
  const children = [{ ref: 'plinth', key: 'plinth' }];
  sizes.forEach((s, i) => {
    const w = s.max[0] - s.min[0];
    children.push({ ref: `p${i}`, key: `p${i}`, at: [x - s.min[0], PLINTH_H - s.min[1], -(s.min[2] + s.max[2]) / 2] });
    x += w + gap;
  });
  const kit = {
    parts: {
      plinth: { source: { kind: 'box', size: [width, PLINTH_H, depth] }, material: 'M', rank: 0 },
      ...Object.fromEntries(sizes.map((s, i) => [`p${i}`, { source: { kind: 'param', gen: s.id, params: {} }, material: 'M', rank: 0 }])),
    },
    assemblies: { piece: { children } },
  };

  const ids = only.length ? only : Object.keys(matstack.MATERIAL_SHELF);
  const V = 300, LABEL = 210, COLS = ['rank 0 (flat)', 'rank 1', 'rank 2', 'top layer mask'];
  const W = LABEL + V * COLS.length, H = V * ids.length + 30;
  const sheet = document.createElement('canvas');
  sheet.width = W; sheet.height = H;
  const ctx = sheet.getContext('2d');
  ctx.fillStyle = '#1b222b';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#9fb0bf';
  ctx.font = '14px sans-serif';
  COLS.forEach((c, i) => ctx.fillText(c, LABEL + i * V + 10, 20));

  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(V, V);
  renderer.setClearColor(0x2b3540, 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.5;
  scene.add(new THREE.HemisphereLight(0xe8f1fa, 0x2a3442, 1.2));
  const sun = new THREE.DirectionalLight(0xfff3e0, 2.4);
  sun.position.set(3, 6, 5);
  scene.add(sun);
  const camera = new THREE.PerspectiveCamera(28, 1, 0.02, 50);

  const timings = [];
  for (let r = 0; r < ids.length; r++) {
    const id = ids[r];
    const spec = matstack.resolveMatPreset(id);
    for (let c = 0; c < COLS.length; c++) {
      const rank = c === 3 ? 1 : c;
      const t0 = performance.now();
      const built = buildKitPreset(kit, 'piece', {
        materials: {},
        gen: () => null,
        maxRank: 2,
        resolveMaterial: (n) => (n === 'M' ? lm.layeredMaterial(id, rank) : null),
        layering: lm.kitLayering,
      });
      timings.push({ id, rank, ms: Math.round(performance.now() - t0) });
      const mat = lm.layeredMaterial(id, rank);
      if (c === 3) lm.setMaskView(mat, Math.max(0, spec.layers.filter((l) => l.visible).length - 1));
      scene.add(built.group);
      const box = new THREE.Box3().setFromObject(built.group);
      const centre = box.getCenter(new THREE.Vector3());
      const radius = 0.5 * box.getSize(new THREE.Vector3()).length();
      camera.position.copy(centre).addScaledVector(new THREE.Vector3(0.55, 0.5, 1).normalize(), (radius / Math.sin(THREE.MathUtils.degToRad(14))) * 1.02);
      camera.lookAt(centre);
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
      ctx.drawImage(renderer.domElement, LABEL + c * V, 30 + r * V);
      if (c === 3) lm.setMaskView(mat, -1);
      scene.remove(built.group);
      built.group.traverse((o) => o.geometry?.dispose?.());
    }
    ctx.fillStyle = '#e8eef1';
    ctx.font = 'bold 17px sans-serif';
    ctx.fillText(id.replace('mat:', ''), 14, 30 + r * V + 30);
    ctx.font = '13px sans-serif';
    ctx.fillStyle = '#9fb0bf';
    spec.layers.forEach((l, i) => ctx.fillText(`${i + 1}. ${l.name}${l.visible ? '' : ' (hidden)'}`, 14, 30 + r * V + 54 + i * 18));
  }
  return { url: sheet.toDataURL('image/png'), timings, ids };
}, only);
await browser.close();
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, Buffer.from(result.url.split(',')[1], 'base64'));
console.log(`wrote ${path.relative(root, out)}: ${result.ids.length} materials`);
const slow = result.timings.filter((t) => t.ms > 40);
console.log(`build + prepare: ${result.timings.map((t) => t.ms).reduce((a, b) => a + b, 0)} ms in all; over 40 ms: ${slow.map((t) => `${t.id}@${t.rank} ${t.ms}`).join(', ') || 'none'}`);
console.log(`console errors and warnings (${errors.length}):`);
for (const e of errors.slice(0, 12)) console.log('  ' + e);
