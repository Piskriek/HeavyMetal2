/**
 * T02P: frame rate at stage 6 on Low, per layer, on this PC's graphics card (the laptop's GTX 950M when run on the laptop).
 *   node scripts/measure-stage6-low.mjs <label> [rounds] [--shots] [--loo]
 * The scene: the moon plot at stage 6, quality Low, a mill, a drill and a water machine placed (as test-plot-biome places them),
 * the camera on the overlook. Each layer is switched off in turn and measured with the full scene around it, in an A B A B order
 * (each round reverses the order) so drift in the machine shows as a difference between two passes of one layer.
 * Per scenario it reports the frame rate (requestAnimationFrame, 3 s), and the GPU time of each render pass from the
 * EXT_disjoint_timer_query_webgl2 timers: the planet (every layer on the planet), the post pass (the picture to the screen) and
 * the held rifle. The JS time spent submitting each pass is kept too, so a CPU-bound frame shows.
 * Layers: vegetation (the plot biome's tufts, bushes and trees), coverage (the living ground), water, sky (the dome and stars),
 * wrecks, leaks (the rift groups), and the whole planet (leaves the post pass and the held rifle: the floor).
 * --loo also switches off each top-level group of the planet scene on its own (by GPU time, not frame rate).
 * --shots saves the stage 2, 4 and 6 pictures. Writes shots-run/perf/<label>.json (and <label>-s<N>.png).
 */
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const positional = args.filter((a) => !a.startsWith('--'));
const label = positional[0] ?? 'run';
const rounds = Number(positional[1] ?? 2);
const wantShots = args.includes('--shots');
const wantLoo = args.includes('--loo');
const fpsOnly = args.includes('--fps-only');
const uncapped = args.includes('--uncapped');

const root = fileURLToPath(new URL('../', import.meta.url));
// MEASURE_ROOT: serve (and load) another checkout's build, e.g. a worktree of HEAD for the before numbers
const srvRoot = process.env.MEASURE_ROOT ?? root;
const outDir = path.join(root, 'shots-run/perf');
fs.mkdirSync(outDir, { recursive: true });

const chromePath = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((p) => fs.existsSync(p));
if (!chromePath) {
  console.error('Chrome not found');
  process.exit(1);
}

const port = 8215;
const server = spawn(process.execPath, ['scripts/serve.mjs'], { cwd: srvRoot, env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1500));

// The discrete GPU: on the laptop the game asks for it (profile gpu 'fast'), and the flag makes headless Chrome pick it too.
const browser = await chromium.launch({
  executablePath: chromePath,
  headless: true,
  args: ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=d3d11', '--force_high_performance_gpu', '--disable-gpu-vsync', ...(uncapped ? ['--disable-frame-rate-limit'] : [])],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const pageErrors = [];
page.on('pageerror', (err) => pageErrors.push(err.message));
await page.addInitScript(() => {
  Element.prototype.requestPointerLock = function () {
    return Promise.reject(new Error('pointer lock stubbed in test'));
  };
  try {
    localStorage.clear();
    localStorage.setItem('hm.profile.v2', JSON.stringify({
      name: 'Goblin', credits: 500, grownUp: true, tutorialDone: true, style: 'voxel', skin: 'flat', favIslands: [],
      quality: 'low', fpsTarget: 60, graphics: {}, gpu: 'fast', controls: { sensitivity: 1, invertY: false, fov: 75 }, cameraView: 'first',
    }));
  } catch {}
});

/** GPU timers and JS submit time per render pass, in the page. `planet`, then `post` and `view` in the order a frame draws them. */
const installTimers = () => page.evaluate(() => {
  const r = window.__playScene.renderer;
  const gl = r.getContext();
  const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
  const ps = window.__playScene.debug.planetScene?.() ?? null;
  const ls = window.__playScene.debug.labScene?.() ?? null;
  let pend = [];
  let gpu = {};
  let cpu = {};
  let frames = 0;
  let seq = 0;
  const orig = r.render.bind(r);
  r.render = function (scene, cam) {
    let name;
    if (ps !== null && scene === ps) { name = 'planet'; seq = 0; frames++; }
    else if (ls !== null && scene === ls) name = 'lab';
    else if (ps === null && seq === 0 && frames === 0) { name = 'planet'; seq = 0; frames++; }
    else { seq++; name = seq === 1 ? 'post' : 'view'; }
    if (!ext) return orig(scene, cam);
    const q = gl.createQuery();
    gl.beginQuery(ext.TIME_ELAPSED_EXT, q);
    const t0 = performance.now();
    const out = orig(scene, cam);
    cpu[name] = (cpu[name] ?? 0) + (performance.now() - t0);
    gl.endQuery(ext.TIME_ELAPSED_EXT);
    pend.push({ name, q });
    return out;
  };
  window.__gpuHarvest = () => {
    if (!ext) return;
    pend = pend.filter((p) => {
      if (!gl.getQueryParameter(p.q, gl.QUERY_RESULT_AVAILABLE)) return true;
      if (!gl.getParameter(ext.GPU_DISJOINT_EXT)) gpu[p.name] = (gpu[p.name] ?? 0) + gl.getQueryParameter(p.q, gl.QUERY_RESULT) / 1e6;
      gl.deleteQuery(p.q);
      return false;
    });
  };
  window.__gpuReset = () => { gpu = {}; cpu = {}; frames = 0; };
  window.__gpuTotals = () => {
    const per = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, frames > 0 ? v / frames : 0]));
    return { frames, gpuMs: per(gpu), cpuMs: per(cpu), timers: Boolean(ext) };
  };
});

/** Frame rate over `span` ms of requestAnimationFrame: mean fps, mean and 95th-percentile frame time, GPU ms per pass. */
const frameRate = (span) => page.evaluate((ms) => new Promise((resolve) => {
  window.__gpuReset();
  const d = [];
  let last = performance.now();
  const t0 = last;
  const tick = (now) => {
    window.__gpuHarvest();
    d.push(now - last);
    last = now;
    if (now - t0 < ms) {
      requestAnimationFrame(tick);
    } else {
      const dd = d.slice(2);
      const mean = dd.reduce((a, b) => a + b, 0) / dd.length;
      const sorted = [...dd].sort((a, b) => a - b);
      resolve({ fps: 1000 / mean, ms: mean, p95: sorted[Math.floor(sorted.length * 0.95)], frames: dd.length, ...window.__gpuTotals() });
    }
  };
  requestAnimationFrame(tick);
}), span);

/** The layer switches, in the page. `__scenario(name)` puts the whole scene back and then switches off one layer. */
const installLayers = () => page.evaluate(() => {
  const ps = window.__playScene.debug.planetScene();
  const saved = new Map();
  const hide = (o) => { if (!saved.has(o)) saved.set(o, o.visible); o.visible = false; };
  const restore = () => { for (const [o, v] of saved) o.visible = v; saved.clear(); };
  const hasSkyMaterial = (m) => Boolean(m && m.uniforms && m.uniforms.uZenith);
  const layerHide = {
    sky: () => ps.traverse((o) => { if ((o.isMesh && hasSkyMaterial(o.material)) || o.isPoints) hide(o); }),
    wrecks: () => { for (const c of ps.children) if (c.name === 'wrecks') hide(c); },
    leaks: () => { for (const c of ps.children) if (c.name.startsWith('leak:')) hide(c); },
    planet: () => { for (const c of ps.children) hide(c); },
  };
  window.__scenario = (name) => {
    restore();
    window.__playScene.setVegetationSetting('auto');
    window.__playScene.debug.setCoverageActive(true);
    window.__playScene.debug.setWaterVisible(true);
    if (name === 'vegetation') window.__playScene.setVegetationSetting('off');
    else if (name === 'coverage') window.__playScene.debug.setCoverageActive(false);
    else if (name === 'water') window.__playScene.debug.setWaterVisible(false);
    else if (name in layerHide) layerHide[name]();
  };
  window.__topLevel = () => ps.children.map((c, i) => {
    let tris = 0;
    c.traverse((m) => {
      if (m.isMesh || m.isPoints) {
        const idx = m.geometry?.index;
        tris += ((idx ? idx.count : (m.geometry?.attributes?.position?.count ?? 0)) / 3) * (m.isInstancedMesh ? m.count : 1);
      }
    });
    return { i, name: c.name || c.type, tris: Math.round(tris), visible: c.visible };
  });
  window.__hideTop = (i) => { restore(); const c = ps.children[i]; if (c) hide(c); };
  window.__restore = restore;
});

const stats = () => page.evaluate(() => {
  const s = window.__playScene.debug.stats();
  return { calls: s.calls, triangles: s.triangles, bioTris: window.__playScene.debug.biomeTriangles(), water: window.__playScene.debug.hasWaterMesh() };
});

const settle = (ms = 900) => page.waitForTimeout(ms);
const overlook = () => page.evaluate(() => {
  const exit = window.__playScene.gateExit();
  window.__playScene.debug.teleport('planet', exit.x - 5, exit.z + 14, 0.4, -0.22);
});

const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const round3 = (x) => Math.round(x * 1000) / 1000;
let exitCode = 0;
try {
  await page.goto(`http://localhost:${port}/?base&kit=1&e2e`, { waitUntil: 'domcontentloaded' });
  await page.locator('canvas.play-canvas').waitFor({ state: 'visible', timeout: 60000 });
  await page.waitForFunction(() => window.hmPlay?.ready === true && window.__playScene !== undefined, null, { timeout: 90000 });
  const gpu = await page.evaluate(() => {
    const gl = document.createElement('canvas').getContext('webgl2');
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unknown';
  });
  console.log(`GPU: ${gpu}`);

  await page.evaluate(() => { window.hmPlay.teleportPlanet(); window.hmPlay.setPaused?.(false); window.hmPlay.setLocked?.(true); });
  await page.waitForFunction(() => window.hmPlay?.where === 'planet', null, { timeout: 30000 });
  // the machines need ore, and the water maker is unlocked from plot stage 3 (the same as a player who has mined some and grown)
  await page.evaluate(() => { window.hmPlay.give(2000); window.hmPlay.setStage(6); });
  await settle(400);
  const placed = await page.evaluate(() => {
    const out = [window.hmPlay.placeAt(12, 0, 'mill'), window.hmPlay.placeAt(-12, 0, 'drill')];
    for (const [x, z] of [[0, 12], [0, 20], [8, 16], [-8, 16], [0, -14], [14, -10]]) {
      const ok = window.hmPlay.placeAt(x, z, 'water');
      out.push(ok ? `water ${x},${z}` : false);
      if (ok) break;
    }
    return out;
  });
  console.log(`placed: ${JSON.stringify(placed)}`);
  await settle(500);
  await overlook();
  await page.evaluate(() => window.__playScene.setFidelityStage(6));
  // the water mesh and the plot's cover are built in slices after the machines are placed: wait for the water, up to 40 s
  const waterBuilt = await page.waitForFunction(() => window.__playScene.debug.hasWaterMesh(), null, { timeout: 40000 }).then(() => true, () => false);
  await settle(4000);
  if (!fpsOnly) await installLayers();
  await installTimers();

  if (wantShots) {
    for (const s of [2, 4, 6]) {
      await page.evaluate((st) => window.__playScene.setFidelityStage(st), s);
      await overlook();
      await settle(6000); // the wave takes a few seconds to settle the look
      await page.screenshot({ path: path.join(outDir, `${label}-s${s}.png`) });
      const cov = await page.evaluate(() => { let out = null; window.__playScene.debug.planetScene?.().traverse((o) => { const u = o.material?.uniforms; if (u?.uCoverMask?.value?.image?.data) { const d = u.uCoverMask.value.image.data; let r = 0, g = 0, b = 0, a = 0; const n = d.length / 4; for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; a += d[i + 3]; } out = { r: +(r / n).toFixed(1), g: +(g / n).toFixed(1), b: +(b / n).toFixed(1), a: +(a / n).toFixed(1), on: u.uCoverOn.value }; } }); return out; });
      console.log(`stage ${s} cover mean RGBA: ${JSON.stringify(cov)}`);
      console.log(`stage ${s} biome counts: ${JSON.stringify(await page.evaluate(() => window.__playScene.getBiomeCounts()))}`);
    }
    await page.evaluate(() => window.__playScene.setFidelityStage(6));
    await overlook();
    await settle(1200);
  }

  const base = await stats();
  console.log(`biome counts at stage 6: ${JSON.stringify(await page.evaluate(() => window.__playScene.getBiomeCounts()))}`);
  console.log(`Stage 6, Low: water built ${waterBuilt}, draw calls ${base.calls}, triangles ${base.triangles}, biome triangles ${base.bioTris}, timers ${gpu ? 'on' : 'off'}`);

  const scenarios = fpsOnly ? ['full'] : ['full', 'vegetation', 'coverage', 'water', 'sky', 'wrecks', 'leaks', 'planet'];
  const layers = Object.fromEntries(scenarios.map((n) => [n, []]));
  for (let round = 0; round < rounds; round++) {
    const order = round % 2 === 0 ? scenarios : [...scenarios].reverse();
    for (const name of order) {
      if (!fpsOnly) await page.evaluate((n) => window.__scenario(n), name);
      await settle(800);
      const r = await frameRate(3000);
      const st = await stats();
      layers[name].push({ fps: r.fps, ms: r.ms, p95: r.p95, frames: r.frames, gpuMs: r.gpuMs, cpuMs: r.cpuMs, timers: r.timers, calls: st.calls, triangles: st.triangles, bioTris: st.bioTris });
      const gsum = Object.values(r.gpuMs).reduce((a, b) => a + b, 0);
      console.log(`round ${round + 1} ${name.padEnd(11)} ${r.fps.toFixed(1).padStart(6)} fps  ${r.ms.toFixed(2).padStart(6)} ms  p95 ${r.p95.toFixed(1).padStart(6)} ms  gpu ${gsum.toFixed(2).padStart(6)} ms (${Object.entries(r.gpuMs).map(([k, v]) => `${k} ${v.toFixed(2)}`).join(', ')})  calls ${String(st.calls).padStart(4)}  tris ${String(st.triangles).padStart(7)}`);
    }
  }
  if (!fpsOnly) await page.evaluate(() => window.__scenario('full'));

  const summary = Object.fromEntries(scenarios.map((n) => {
    const rs = layers[n];
    const passes = [...new Set(rs.flatMap((r) => Object.keys(r.gpuMs)))];
    return [n, {
      fps: round3(mean(rs.map((r) => r.fps))),
      ms: round3(mean(rs.map((r) => r.ms))),
      fpsEach: rs.map((r) => round3(r.fps)),
      gpuMs: Object.fromEntries(passes.map((p) => [p, round3(mean(rs.map((r) => r.gpuMs[p] ?? 0)))])),
      cpuMs: Object.fromEntries(passes.map((p) => [p, round3(mean(rs.map((r) => r.cpuMs[p] ?? 0)))])),
      calls: rs[0].calls,
      triangles: rs[0].triangles,
      bioTris: rs[0].bioTris,
    }];
  }));
  console.log('--- means over the rounds ---');
  for (const [k, v] of Object.entries(summary)) {
    const gsum = Object.values(v.gpuMs).reduce((a, b) => a + b, 0);
    console.log(`${k.padEnd(11)} ${v.fps.toFixed(1).padStart(6)} fps  ${v.ms.toFixed(2).padStart(6)} ms  gpu ${gsum.toFixed(2).padStart(6)} ms  ${Object.entries(v.gpuMs).map(([p, x]) => `${p} ${x.toFixed(2)}`).join(', ')}  calls ${v.calls}  tris ${v.triangles}`);
  }

  const loo = [];
  let topLevel = [];
  if (wantLoo) {
    topLevel = await page.evaluate(() => window.__topLevel());
    const heavy = topLevel.filter((t) => t.tris >= 300 && t.visible);
    console.log(`leave-one-out over ${heavy.length} top-level groups (>= 300 triangles)`);
    await page.evaluate(() => window.__scenario('full'));
    const full = await frameRate(3000);
    const fullGpu = Object.values(full.gpuMs).reduce((a, b) => a + b, 0);
    console.log(`  full scene: gpu ${fullGpu.toFixed(2)} ms`);
    for (const t of heavy) {
      await page.evaluate((i) => window.__hideTop(i), t.i);
      await settle(600);
      const r = await frameRate(2000);
      await page.evaluate(() => window.__restore());
      await settle(200);
      const gsum = Object.values(r.gpuMs).reduce((a, b) => a + b, 0);
      loo.push({ name: t.name, i: t.i, tris: t.tris, fps: round3(r.fps), gpuMs: round3(gsum), saved: round3(fullGpu - gsum) });
      console.log(`  off ${String(t.name).padEnd(20)} tris ${String(t.tris).padStart(6)}  ${r.fps.toFixed(1).padStart(6)} fps  gpu ${gsum.toFixed(2).padStart(6)} ms  saves ${(fullGpu - gsum).toFixed(2)} ms`);
    }
  }

  fs.writeFileSync(path.join(outDir, `${label}.json`), JSON.stringify({ label, gpu, waterBuilt, placed, base, rounds, layers, summary, loo, topLevel, pageErrors }, null, 2));
  console.log(`page errors: ${pageErrors.length}`);
  console.log(`wrote shots-run/perf/${label}.json`);
} catch (err) {
  console.error('Measurement failed:', err.message);
  console.error(`page errors: ${JSON.stringify(pageErrors)}`);
  exitCode = 1;
} finally {
  await browser.close();
  server.kill('SIGTERM');
}
process.exit(exitCode);
