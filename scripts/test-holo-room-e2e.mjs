/**
 * Plan 57 §16.5: the menu room's game bridge, end to end. It serves apps/web/dist (run `npm run build` first) and a stand-in
 * bridge on its own port. The stand-in answers /status like the real one and counts the frames it is sent, so this never touches
 * a live bridge on 8220. It checks:
 * - once the room is warm, the game bridge shows under the room's screen; with no bridge it says so and gives the command;
 * - with the bridge up, linking a window (a canvas stream standing in for the picker) puts it on the screen, the room draws at
 *   the screen's pace, and the drone's eyes send frames at the size the window is shared (not scaled down);
 * - unlinking stops both, and the room goes back to drawing only on change;
 * - no page errors.
 * Shots in shots-run/holo-room/.
 */
import http from 'node:http';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const outDir = path.join(root, 'shots-run/holo-room');
fs.mkdirSync(outDir, { recursive: true });
const chromePath = [process.env.CHROME_PATH, '/opt/pw-browsers/chromium', 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium']
  .filter(Boolean).find(fs.existsSync);
if (!chromePath) { console.error('Chrome/Chromium not found; set CHROME_PATH.'); process.exit(1); }

const port = 8244;
const bridgePort = 8245;
/** The stand-in bridge: /status answers, /frame counts and records each JPEG's size. */
const frames = [];
const jpegSize = (b) => {
  // walk the JPEG's segments to its start-of-frame marker, which holds the height and width
  for (let i = 2; i + 9 < b.length;) {
    if (b[i] !== 0xff) return null;
    const m = b[i + 1], len = b.readUInt16BE(i + 2);
    if (m >= 0xc0 && m <= 0xc3) return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) };
    i += 2 + len;
  }
  return null;
};
const stand = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin ?? '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  if (req.url?.startsWith('/status')) { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"ok":true}'); return; }
  if (req.url?.startsWith('/frame') && req.method === 'POST') {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => { frames.push(jpegSize(Buffer.concat(chunks))); res.writeHead(200); res.end('{}'); });
    return;
  }
  res.writeHead(404); res.end();
});
let bridgeOn = false;
const startBridge = () => new Promise((r) => { stand.listen(bridgePort, '127.0.0.1', () => { bridgeOn = true; r(); }); });

const server = spawn(process.execPath, ['scripts/serve.mjs'], { cwd: root, env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch({ executablePath: chromePath, headless: true, args: ['--ignore-gpu-blocklist', '--enable-gpu'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(e.message));
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok: !!ok });
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? ` (${detail})` : ''}`);
};
const shot = (name) => page.screenshot({ path: path.join(outDir, `${name}.png`) });
const plate = () => page.evaluate(() => { const el = document.querySelector('[data-testid="room-bridge"]'); return el ? { text: el.textContent ?? '', cls: el.className } : null; });

try {
  // the bridge is down first: the room's bridge must say so, and give the command
  await page.goto(`http://localhost:${port}/?e2e&bridge=${bridgePort}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForFunction(() => window.hmRoom?.ready === true, null, { timeout: 90000 });
  await page.waitForFunction(() => /not running/.test(document.querySelector('[data-testid="room-bridge"]')?.textContent ?? ''), null, { timeout: 8000 }).catch(() => {});
  let p = await plate();
  check('once the room is warm, its game bridge shows, and with no bridge it says so with the command', p && /not running/.test(p.text) && /companion-bridge\.mjs/.test(p.text), p?.text);
  await shot('01-bridge-offline');

  // the bridge comes up: within its next check the control says it is ready
  await startBridge();
  await page.waitForFunction(() => /Bridge ready/.test(document.querySelector('[data-testid="room-bridge"]')?.textContent ?? ''), null, { timeout: 8000 }).catch(() => {});
  p = await plate();
  check('...and when the bridge runs, it says it is ready to link a game', p && /Bridge ready/.test(p.text) && /room-bridge--ready/.test(p.cls), p?.text);

  // a 1024x576 canvas stands in for a picked game window
  const idle = await page.evaluate(async () => { const r0 = window.hmRoom.renders; await new Promise((r) => setTimeout(r, 1000)); return window.hmRoom.renders - r0; });
  await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 1024; c.height = 576;
    const g = c.getContext('2d');
    let n = 0;
    const paint = () => { g.fillStyle = n % 2 ? '#2a6' : '#62a'; g.fillRect(0, 0, 1024, 576); g.fillStyle = '#fff'; g.font = '48px sans-serif'; g.fillText(`frame ${n++}`, 60, 300); };
    paint();
    window.__paint = setInterval(paint, 100);
    window.hmRoom.linkStream(c.captureStream(15));
  });
  const drawn = await page.evaluate(async () => { const r0 = window.hmRoom.renders; await new Promise((r) => setTimeout(r, 2000)); return window.hmRoom.renders - r0; });
  p = await plate();
  check('a linked window puts the control in its linked state', p && /Watching/.test(p.text) && /room-bridge--linked/.test(p.cls), p?.text);
  check('...and the room draws at the screen\'s pace while linked (about 15 a second, from none while idle)', idle <= 2 && drawn >= 15 && drawn <= 40, `idle ${idle}/s, linked ${drawn}/2s`);
  await shot('02-game-on-the-screen');
  await page.waitForTimeout(6500);
  const sent = frames.filter(Boolean);
  check('the drone\'s eyes send the linked window\'s frames to the bridge', sent.length >= 2, `${frames.length} frames`);
  check('...at the size the window is shared, not scaled down (1024x576)', sent.length > 0 && sent.every((f) => f.w === 1024 && f.h === 576), JSON.stringify(sent.slice(0, 3)));
  const seen = await plate();
  check('...and the control counts what the drone has seen', /seen [1-9]\d* frame/.test(seen?.text ?? ''), seen?.text);

  // unlink: the screen goes dark again, the eyes stop, and the room draws only on change
  await page.evaluate(() => { window.hmRoom.linkStream(null); clearInterval(window.__paint); });
  const before = frames.length;
  const after = await page.evaluate(async () => { await new Promise((r) => setTimeout(r, 300)); const r0 = window.hmRoom.renders; await new Promise((r) => setTimeout(r, 4000)); return window.hmRoom.renders - r0; });
  p = await plate();
  check('unlinking stops the eyes and the room goes back to drawing only on change', frames.length <= before + 1 && after <= 3 && !/Watching/.test(p?.text ?? ''), `${frames.length - before} frames after, ${after} draws in 4 s, "${p?.text}"`);
  check('no page errors', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));
} catch (e) {
  check('script completed', false, e.message);
} finally {
  await browser.close();
  server.kill();
  if (bridgeOn) stand.close();
}
const passed = results.filter((r) => r.ok).length;
console.log(`\n${passed}/${results.length} holo room checks passed`);
process.exit(passed === results.length ? 0 : 1);
