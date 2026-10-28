/**
 * Plan 57 §5 (the menu): what the main menu costs while it sits idle. Boots the built game (run `npm run build` first),
 * waits on the menu, then samples Chrome's own counters over a window: main-thread task, script, style and layout time
 * per second of wall time, frames drawn, and the live WebGL canvases. Run it before and after a menu change, on the
 * min-spec laptop for the real numbers (headless rendering here is software, so read GPU-bound costs as relative only).
 *
 *   node scripts/measure-menu.mjs [--seconds 10]
 */
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const chromePath = [process.env.CHROME_PATH, '/opt/pw-browsers/chromium', 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium']
  .filter(Boolean).find(fs.existsSync);
if (!chromePath) { console.error('Chrome/Chromium not found; set CHROME_PATH.'); process.exit(1); }
const argSeconds = process.argv.indexOf('--seconds');
const seconds = argSeconds > 0 ? Number(process.argv[argSeconds + 1]) || 10 : 10;
const port = 8236;
const server = spawn(process.execPath, ['scripts/serve.mjs'], { cwd: root, env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));

const browser = await chromium.launch({ executablePath: chromePath, headless: true, args: ['--ignore-gpu-blocklist', '--enable-gpu'] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.addInitScript(() => { try { localStorage.clear(); } catch {} });
  await page.goto(`http://localhost:${port}/`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForSelector('.sm-menu button', { timeout: 45000 });
  // let the menu settle (fonts, first frames, any intro) before sampling
  await page.waitForTimeout(3000);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Performance.enable');
  const metrics = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));
  await page.evaluate(() => { window.__menuFrames = 0; const f = () => { window.__menuFrames++; requestAnimationFrame(f); }; requestAnimationFrame(f); });
  const profile = process.argv.includes('--profile');
  if (profile) { await cdp.send('Profiler.enable'); await cdp.send('Profiler.start'); }
  const a = await metrics();
  const t0 = Date.now();
  await page.waitForTimeout(seconds * 1000);
  const b = await metrics();
  if (profile) {
    // the functions that spent the most time themselves (self time), by name and where they live in the bundle
    const { profile: p } = await cdp.send('Profiler.stop');
    const dt = new Map();
    p.samples.forEach((id, i) => dt.set(id, (dt.get(id) ?? 0) + (p.timeDeltas[i] ?? 0)));
    const rows = p.nodes.map((n) => ({ fn: n.callFrame.functionName || '(anonymous)', at: `${n.callFrame.lineNumber}:${n.callFrame.columnNumber}`, ms: (dt.get(n.id) ?? 0) / 1000 }));
    const merged = new Map();
    for (const r of rows) { const k = `${r.fn} @${r.at}`; merged.set(k, (merged.get(k) ?? 0) + r.ms); }
    console.log('top self time:');
    for (const [k, ms] of [...merged].sort((x, y) => y[1] - x[1]).slice(0, 15)) console.log(`  ${ms.toFixed(0).padStart(6)} ms  ${k}`);
  }
  const wall = (Date.now() - t0) / 1000;
  const per = (k) => (((b[k] ?? 0) - (a[k] ?? 0)) * 1000) / wall;
  const live = await page.evaluate(() => ({
    frames: window.__menuFrames,
    // visible canvases only (asking for a context would make one on an unused canvas)
    canvases: [...document.querySelectorAll('canvas')].filter((c) => c.offsetParent !== null).length,
    screen: document.querySelector('[data-screen]')?.getAttribute('data-screen') ?? null,
  }));
  const out = {
    seconds: +wall.toFixed(1),
    mainThreadMsPerSec: +per('TaskDuration').toFixed(1),
    scriptMsPerSec: +per('ScriptDuration').toFixed(1),
    styleMsPerSec: +per('RecalcStyleDuration').toFixed(1),
    layoutMsPerSec: +per('LayoutDuration').toFixed(1),
    rafPerSec: +(live.frames / wall).toFixed(1),
    visibleCanvases: live.canvases,
    jsHeapMb: +((b.JSHeapUsedSize ?? 0) / 1048576).toFixed(1),
  };
  console.log(JSON.stringify(out, null, 2));
} finally {
  await browser.close().catch(() => {});
  server.kill();
}
