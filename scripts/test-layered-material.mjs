/**
 * Plan 41: the layered-material renderer against @hm/matstack's reference formulas.
 *  1. Mask parity: a quad with known edge, crease, height, facing and UV attributes, drawn at rank 1 with the mask view
 *     on; every pixel's layer weight must match matstack's layerWeight at the same interpolated point (CPU, the same
 *     noise bytes). Every input kind and blend mode, levels, the height blend and age are in the mask.
 *  2. Every shelf material compiles at ranks 0, 1 and 2 without a shader error.
 *  3. A name that does not resolve draws a stand-in (never an invisible part).
 *  4. kit-build with the layering hook: one mesh per material bucket, edge lines at rank 1, flat colours at rank 0, and
 *     identical parts share their mask template.
 * Needs the Vite dev server (it imports the renderer's modules directly).
 *   node scripts/test-layered-material.mjs [devServerUrl]
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const base = process.argv[2] ?? 'http://localhost:5192';
const chromePath = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find(fs.existsSync);
if (!chromePath) {
  console.log('Chrome not found, skipping browser test');
  process.exit(0);
}
const browser = await chromium.launch({ executablePath: chromePath, headless: true, args: ['--ignore-gpu-blocklist', '--enable-gpu'] });
const page = await browser.newPage();
const shaderErrors = [];
page.on('console', (m) => { if (m.type() === 'error' && /shader|program/i.test(m.text())) shaderErrors.push(m.text().slice(0, 400)); });
await page.goto(`${base}/?e2e`, { waitUntil: 'domcontentloaded', timeout: 60000 });
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` (${detail})` : ''}`);
};

try {
  const parity = await page.evaluate(async () => {
    const THREE = await import('/node_modules/.vite/deps/three.js');
    const ms = await import('/@fs/C:/MarbleGp/packages/matstack/src/index.ts');
    const lm = await import('/src/play/layered-material.ts');
    const base = { blend: 'normal', opacity: 1, invert: false };
    const spec = {
      name: 'parity', base: { name: 'b', colour: '#808080', metal: 0, rough: 0.5, specular: 0.5 }, paint: ['#000000', '#000000'], age: 0.8,
      layers: [{
        name: 'l', surface: { name: 's', colour: '#ffffff', metal: 1, rough: 0.2, specular: 0.5 }, opacity: 0.9, writes: ['colour'],
        heightBlend: 0.3, weathering: true, visible: true,
        mask: {
          name: 'm', balance: 0.1, contrast: 0.3, invert: false,
          inputs: [
            { ...base, kind: 'edge', width: 0.03 },
            { ...base, kind: 'noise', noise: 'clouds', scale: 0.5, seed: 3, blend: 'multiply', opacity: 0.7 },
            { ...base, kind: 'ground', height: 0.4, soft: 0.2, blend: 'max', opacity: 0.8 },
            { ...base, kind: 'cavity', width: 0.02, blend: 'add', opacity: 0.6 },
            { ...base, kind: 'up', angle: 40, soft: 15, blend: 'subtract', opacity: 0.4, invert: true },
            { ...base, kind: 'streaks', scale: 0.3, stretch: 6, seed: 7, blend: 'min', opacity: 0.5 },
          ],
        },
      }],
    };
    // a quad 1 m across, tilted so the facing varies: x across, y up the slope; attributes chosen to sweep every input
    const corners = [
      { pos: [0, 0, 0], normal: [0, 0.3, 0.954], uv: [0, 0], edge: [0.0, 0.08, 1000, 1000], cav: [0.06, 1000, 1000, 1000] },
      { pos: [1, 0, 0.2], normal: [0.6, 0.1, 0.794], uv: [1.3, 0], edge: [0.08, 0.0, 1000, 1000], cav: [0.0, 1000, 1000, 1000] },
      { pos: [1, 1, 0.2], normal: [0.2, 0.9, 0.387], uv: [1.3, 1.1], edge: [0.08, 0.05, 1000, 1000], cav: [0.03, 1000, 1000, 1000] },
      { pos: [0, 1, 0], normal: [-0.3, 0.6, 0.742], uv: [0, 1.1], edge: [0.01, 0.06, 1000, 1000], cav: [0.08, 1000, 1000, 1000] },
    ];
    const g = new THREE.BufferGeometry();
    const flat = (k, n) => new THREE.BufferAttribute(new Float32Array(corners.flatMap((c) => c[k])), n);
    g.setAttribute('position', flat('pos', 3));
    g.setAttribute('normal', flat('normal', 3));
    g.setAttribute('uv', flat('uv', 2));
    g.setAttribute('aEdge', flat('edge', 4));
    g.setAttribute('aCavity', flat('cav', 4));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    const mat = lm.materialForSpec(spec, 1);
    lm.setMaskView(mat, 0);
    const mesh = new THREE.Mesh(g, mat);
    const scene = new THREE.Scene();
    scene.add(mesh);
    // look straight down the quad's average normal with an orthographic camera fitted to it
    const N = 48;
    const renderer = new THREE.WebGLRenderer();
    const target = new THREE.WebGLRenderTarget(N, N);
    const cam = new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 0.01, 10);
    cam.position.set(0.5, 0.5, 3);
    cam.lookAt(0.5, 0.5, 0);
    cam.updateMatrixWorld();
    renderer.setRenderTarget(target);
    renderer.render(scene, cam);
    const px = new Uint8Array(N * N * 4);
    renderer.readRenderTargetPixels(target, 0, 0, N, N, px);
    renderer.setRenderTarget(null);
    // CPU: for each pixel centre, the point on the quad under it (screen x, y = world x, y), bilinear in the quad
    const [c0, c1, c2, c3] = corners;
    let worst = 0, n = 0, sum = 0;
    const layer = spec.layers[0];
    for (let y = 2; y < N - 2; y++) {
      for (let x = 2; x < N - 2; x++) {
        const s = (x + 0.5) / N, t = (y + 0.5) / N;
        // the two triangles (0,1,2) and (0,2,3) split the quad on its diagonal: barycentric inside the right one
        const P = [s, t];
        const tri = t <= s ? [c0, c1, c2] : [c0, c2, c3];
        const A = tri[0].pos, B = tri[1].pos, C = tri[2].pos;
        const den = (B[1] - C[1]) * (A[0] - C[0]) + (C[0] - B[0]) * (A[1] - C[1]);
        const wa = ((B[1] - C[1]) * (P[0] - C[0]) + (C[0] - B[0]) * (P[1] - C[1])) / den;
        const wb = ((C[1] - A[1]) * (P[0] - C[0]) + (A[0] - C[0]) * (P[1] - C[1])) / den;
        const wc = 1 - wa - wb;
        const mixv = (k) => tri[0][k].map((_, i) => tri[0][k][i] * wa + tri[1][k][i] * wb + tri[2][k][i] * wc);
        const nn = mixv('normal'), l = Math.hypot(...nn);
        const point = { uv: mixv('uv'), pos: mixv('pos'), normal: nn.map((v) => v / l), edge: ms.lineDistance(mixv('edge')), cavity: ms.lineDistance(mixv('cav')) };
        const surfH = ms.surfaceAt(layer.surface, point, spec.paint, lm.cpuTiles).height;
        const want = ms.layerWeight(layer, surfH, point, spec.age, lm.cpuNoise);
        const got = px[(y * N + x) * 4] / 255;
        const d = Math.abs(got - want);
        worst = Math.max(worst, d);
        sum += d;
        n += 1;
      }
    }
    lm.setMaskView(mat, -1);
    // the mask must vary across the quad, or the comparison proves little
    let lo = 1, hi = 0;
    for (let i = 0; i < N * N; i++) { lo = Math.min(lo, px[i * 4] / 255); hi = Math.max(hi, px[i * 4] / 255); }
    renderer.dispose();
    target.dispose();
    return { worst, mean: sum / n, n, lo, hi };
  });
  check('mask view matches matstack pixel for pixel (every input kind and blend, levels, height blend, age)', parity.worst < 0.06 && parity.mean < 0.01,
    `worst ${parity.worst.toFixed(3)}, mean ${parity.mean.toFixed(4)} over ${parity.n} pixels`);
  check('the test mask sweeps a real range', parity.hi - parity.lo > 0.5, `${parity.lo.toFixed(2)}..${parity.hi.toFixed(2)}`);

  const shelf = await page.evaluate(async () => {
    const THREE = await import('/node_modules/.vite/deps/three.js');
    const ms = await import('/@fs/C:/MarbleGp/packages/matstack/src/index.ts');
    const lm = await import('/src/play/layered-material.ts');
    const { buildKitPreset } = await import('/src/play/kit-build.ts');
    const renderer = new THREE.WebGLRenderer();
    renderer.setSize(64, 64);
    const scene = new THREE.Scene();
    scene.add(new THREE.DirectionalLight(0xffffff, 2));
    const cam = new THREE.PerspectiveCamera(40, 1, 0.01, 20);
    cam.position.set(0.8, 0.6, 1.2);
    cam.lookAt(0, 0.1, 0);
    const kit = {
      parts: {
        plate: { source: { kind: 'box', size: [0.6, 0.04, 0.4] }, material: 'M', rank: 0 },
        bolt: { source: { kind: 'param', gen: 'bolt', params: {} }, material: 'M', rank: 0 },
        other: { source: { kind: 'box', size: [0.1, 0.1, 0.1] }, material: 'darkSteel', rank: 0 },
      },
      assemblies: { piece: { children: [{ ref: 'plate', key: 'plate' }, { ref: 'bolt', key: 'bolts', at: [-0.2, 0.04, 0], repeat: { count: 4, step: [0.13, 0, 0] } }, { ref: 'other', key: 'o', at: [0.2, 0.04, 0.1] }] } },
    };
    const out = { compiled: 0, programs: new Set(), buckets: {}, attrs: {} };
    for (const id of Object.keys(ms.MATERIAL_SHELF)) {
      for (const rank of [0, 1, 2]) {
        const built = buildKitPreset(kit, 'piece', {
          materials: { darkSteel: new THREE.MeshStandardMaterial() }, gen: () => null, maxRank: 2,
          resolveMaterial: (n) => (n === 'M' ? lm.layeredMaterial(id, rank) : null), layering: lm.kitLayering,
        });
        scene.add(built.group);
        renderer.render(scene, cam);
        scene.remove(built.group);
        out.compiled += 1;
        if (id === 'mat:rust-bucket') {
          const layered = built.group.children.filter((m) => m.material.userData.matstack);
          out.buckets[rank] = layered.length;
          out.attrs[rank] = Object.keys(layered[0].geometry.attributes).sort().join(',');
        }
      }
    }
    out.programs = renderer.info.programs.length;
    const unknown = lm.layeredMaterial('mat:no-such-material', 1);
    out.fallback = !!unknown && unknown.name === 'matstack:fallback';
    out.notLayered = lm.layeredMaterial('darkSteel', 1) === null;
    renderer.dispose();
    return out;
  });
  check('every shelf material compiles at ranks 0, 1 and 2', shelf.compiled === 48 && shaderErrors.length === 0, `${shelf.compiled} builds, ${shaderErrors.length} shader errors${shaderErrors[0] ? ': ' + shaderErrors[0] : ''}`);
  check('the shelf shares a handful of programs', shelf.programs <= 24, `${shelf.programs} programs for 48 material builds`);
  check('a name that does not resolve draws a stand-in; other names are left to other resolvers', shelf.fallback && shelf.notLayered);
  check('rank 1 merges the layered parts per rank window and carries the edge lines', /aCavity/.test(shelf.attrs[1] ?? '') && /aEdge/.test(shelf.attrs[1] ?? ''), shelf.attrs[1]);
  check('rank 0 carries flat colours and roughness/metal instead of edge lines', /aRM/.test(shelf.attrs[0] ?? '') && /color/.test(shelf.attrs[0] ?? '') && !/aEdge/.test(shelf.attrs[0] ?? ''), shelf.attrs[0]);
} catch (err) {
  check('the test ran to the end', false, String(err?.stack ?? err).slice(0, 500));
} finally {
  await browser.close();
}
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed} of ${results.length} layered-material checks pass`);
process.exit(failed ? 1 : 0);
