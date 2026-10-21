/**
 * A kit-built machine beside the machine it replaces, from four sides (TICKET-40 review): the old prop as the game builds
 * it today (machineProp at stage 6 on High), then the kit preset built as the game would build it (the plot's kit
 * materials and Texture Mill skins, every rank). Also lists every placed part whose material does not resolve (it would
 * not be drawn) and kitspec's validate() issues (floating or below-ground parts). Needs the Vite dev server.
 *   node scripts/kit-compare-sheet.mjs <kind> <kitModule> <kitExport> <preset> [out.png] [devServerUrl]
 *   node scripts/kit-compare-sheet.mjs mill /src/play/kit-mill-v2.ts MILL_V2_KIT mill-v2
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const [kind, kitModule, kitExport, preset, outArg, baseArg, standinArg] = process.argv.slice(2);
// optional, for review only: "a=b,c=d" draws a missing material a as b, another material or a flat "#rrggbb" (to see a shape whose skin does not resolve)
const standins = Object.fromEntries((standinArg ?? '').split(',').filter(Boolean).map((p) => p.split('=')));
if (!kind || !kitModule || !kitExport || !preset) throw new Error('usage: kind kitModule kitExport preset [out] [devServerUrl]');
const root = fileURLToPath(new URL('../', import.meta.url));
const out = path.resolve(root, outArg ?? `docs/argo/plans/shots/40/${kind}-compare.png`);
const base = baseArg ?? 'http://localhost:5192';
const chromePath = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find(fs.existsSync);
if (!chromePath) throw new Error('Chrome not found');

const browser = await chromium.launch({ executablePath: chromePath, headless: true, args: ['--ignore-gpu-blocklist', '--enable-gpu'] });
const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
await page.goto(`${base}/?e2e`, { waitUntil: 'domcontentloaded', timeout: 60000 });
const result = await page.evaluate(async ([kind, kitModule, kitExport, preset, standins]) => {
  const THREE = await import('/node_modules/.vite/deps/three.js');
  const gen = await import('/src/assets/gen.ts');
  const props = await import('/src/play/machine-props.ts');
  const lab = await import('/@fs/C:/MarbleGp/packages/labkit/src/index.ts');
  const kitspec = await import('/@fs/C:/MarbleGp/packages/kitspec/src/index.ts');
  const { buildKitPreset } = await import('/src/play/kit-build.ts');
  const { plotKitMaterials } = await import('/src/play/plot-kits.ts');
  const { vaultSkin } = await import('/src/play/vault-skin.ts');
  const { lightMaterial } = await import('/src/play/light-material.ts');
  const lm = await import('/src/play/layered-material.ts');
  const { RoomEnvironment } = await import('/@fs/C:/MarbleGp/node_modules/three/examples/jsm/environments/RoomEnvironment.js');
  const kit = (await import(kitModule))[kitExport];
  for (const a of ['mill', 'press-frame', 'press-ram', 'watermaker', 'projector-mast', 'projector-head']) await gen.loadGen?.(a, 'high');

  const mats = plotKitMaterials();
  // a stand-in may also be a flat colour ('#rrggbb'), for a material the game cannot draw yet (a kit's base colours)
  const flat = new Map();
  const hex = (name) => {
    if (!/^#[0-9a-f]{6}$/i.test(name)) return null;
    if (!flat.has(name)) flat.set(name, new THREE.MeshStandardMaterial({ color: name, roughness: 0.6, metalness: 0.15 }));
    return flat.get(name);
  };
  // as the game resolves a kit's names: kit swatches, Texture Mill skins, lamps (lx:), layered materials (mat:, rank 2)
  const resolve = (name) => mats[name] ?? vaultSkin(name, true) ?? lightMaterial(name) ?? lm.layeredMaterial(name, 2) ?? hex(name);
  const drawn = (name) => resolve(name) ?? (standins[name] ? resolve(standins[name]) : null);
  const placed = kitspec.flatten(kit, preset);
  const missing = new Set();
  for (const p of placed) {
    const names = [p.material, ...Object.values(p.slotMaterials ?? {})];
    for (const n of names) if (!resolve(n)) missing.add(`${n} (on ${p.path})`);
  }
  const issues = kitspec.validate(kit, preset, {}).map((i) => JSON.stringify(i));
  const old = props.machineProp(lab.createMaterials(), kind, 6, 'high').group;
  const built = buildKitPreset(kit, preset, { materials: mats, gen: (a) => gen.getGenSync(a, 'high'), maxRank: 2, resolveMaterial: (n) => (standins[n] ? resolve(standins[n]) : null) ?? vaultSkin(n, true) ?? lightMaterial(n) ?? lm.layeredMaterial(n, 2), layering: lm.kitLayering });
  const rows = [{ name: `${kind} (today)`, object: old }, { name: `${preset} (kit)`, object: built.group }];

  const V = 360, LABEL = 200, W = LABEL + V * 4, H = V * rows.length;
  const sheet = document.createElement('canvas');
  sheet.width = W; sheet.height = H;
  const ctx = sheet.getContext('2d');
  ctx.fillStyle = '#1b222b';
  ctx.fillRect(0, 0, W, H);
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(V, V);
  renderer.setClearColor(0x2b3540, 1);
  const scene = new THREE.Scene();
  // the lab's reflections, so metal reads as metal
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.35;
  scene.add(new THREE.HemisphereLight(0xe8f1fa, 0x2a3442, 2.0));
  const sun = new THREE.DirectionalLight(0xfff3e0, 2.6);
  sun.position.set(4, 8, 6);
  scene.add(sun);
  scene.add(new THREE.GridHelper(12, 12, 0x5a6878, 0x3a4652));
  const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 200);
  const VIEWS = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
  // both rows framed alike (the larger of the two), so their sizes compare
  const boxes = rows.map((r) => new THREE.Box3().setFromObject(r.object));
  const radius = Math.max(...boxes.map((b) => 0.5 * b.getSize(new THREE.Vector3()).length()));
  rows.forEach((row, r) => {
    scene.add(row.object);
    const centre = boxes[r].getCenter(new THREE.Vector3());
    const dist = (radius / Math.sin(THREE.MathUtils.degToRad(15))) * 1.05;
    VIEWS.forEach((yaw, c) => {
      camera.position.copy(centre).addScaledVector(new THREE.Vector3(Math.sin(yaw), 0.36, Math.cos(yaw)).normalize(), dist);
      camera.lookAt(centre);
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
      ctx.drawImage(renderer.domElement, LABEL + c * V, r * V);
    });
    scene.remove(row.object);
    const size = boxes[r].getSize(new THREE.Vector3());
    ctx.fillStyle = '#e8eef1';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText(row.name, 14, r * V + 34);
    ctx.font = '14px sans-serif';
    ctx.fillStyle = '#9fb0bf';
    ctx.fillText(`${size.x.toFixed(2)} x ${size.y.toFixed(2)} x ${size.z.toFixed(2)} m`, 14, r * V + 58);
    ctx.fillText('front, right, back, left', 14, r * V + 80);
  });
  return { url: sheet.toDataURL("image/png"), missing: [...missing], issues, parts: placed.length, calls: built.calls(2) };
}, [kind, kitModule, kitExport, preset, standins]);
await browser.close();
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, Buffer.from(result.url.split(',')[1], 'base64'));
console.log(`wrote ${path.relative(root, out)}: ${result.parts} parts, ${result.calls} draw calls`);
console.log(`materials that do not resolve (${result.missing.length}):`);
for (const m of result.missing) console.log('  ' + m);
console.log(`validate issues (${result.issues.length}):`);
for (const i of result.issues.slice(0, 30)) console.log('  ' + i);
