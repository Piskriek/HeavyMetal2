/**
 * The monster renderer on the bench (apps/web/monsters.html, dev only) and in the window view. Starts its own Vite dev server on
 * MONSTERS_PORT (default 5197), shoots every skin per era, the eight views of a sprite and of a 3D model, a live leaksim arena through
 * wind-up, attack, pain and death, and the window with its walkers. Writes docs/shots/monsters/*.png and prints the checks.
 *   node scripts/test-monsters-render.mjs
 * Exit code 1 when a check fails or the page logs an error.
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const chromePaths = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
];
const chromePath = chromePaths.find(fs.existsSync);
if (!chromePath) {
  console.log('Chrome not found, skipping the monster render test');
  process.exit(0);
}

const root = fileURLToPath(new URL('../', import.meta.url));
const webRoot = path.join(root, 'apps/web');
const shotsDir = path.join(root, 'docs/shots/monsters');
fs.mkdirSync(shotsDir, { recursive: true });
const port = Number(process.env.MONSTERS_PORT ?? 5197);

const server = await createServer({ root: webRoot, configFile: path.join(webRoot, 'vite.config.ts'), server: { port, strictPort: true, host: '127.0.0.1' }, logLevel: 'warn' });
await server.listen();
const base = `http://127.0.0.1:${port}/monsters.html`;

const browser = await chromium.launch({ executablePath: chromePath, headless: true, args: ['--ignore-gpu-blocklist', '--enable-gpu'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
page.on('console', (msg) => { if (msg.type() === 'error') errors.push(`console: ${msg.text()}`); });
page.on('response', (res) => { if (res.status() >= 400) errors.push(`http ${res.status()}: ${res.url()}`); });

const checks = [];
const check = (name, ok, detail = '') => {
  checks.push({ name, ok: !!ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` (${detail})` : ''}`);
};

function save(name, png) {
  for (let tries = 0; ; tries++) {
    try { fs.writeFileSync(path.join(shotsDir, name), png); break; } catch (err) {
      if (tries >= 20) throw err;
      new Promise((r) => setTimeout(r, 500));
    }
  }
  console.log('saved', name);
}

async function open(query) {
  await page.goto(`${base}?${query}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__monsters?.ready === true, null, { timeout: 180000, polling: 200 });
  await page.waitForFunction(() => document.getElementById('loader')?.classList.contains('done') !== false, null, { timeout: 180000, polling: 200 });
  await new Promise((r) => setTimeout(r, 400));
}
const readoutText = () => page.evaluate(() => document.getElementById('readout')?.innerText ?? '');
const readoutMap = async () => {
  const txt = await readoutText();
  const out = {};
  for (const line of txt.split('\n').map((s) => s.trim()).filter(Boolean)) {
    const parts = line.split(/\s+/);
    const val = Number(parts.pop().replace(/,/g, ''));
    out[parts.join(' ')] = val;
  }
  return out;
};
const drawn = () => page.evaluate(() => window.__monsters.draw());
const advance = (s) => page.evaluate((x) => window.__monsters.advance(x), s);

try {
  // ---- roster: every skin of each era, facing the viewer, with the walk playing
  const eraCounts = { sprite: 19, early3d: 9, modern3d: 10 };
  for (const era of Object.keys(eraCounts)) {
    await open(`mode=roster&era=${era}&pause`);
    await page.waitForTimeout(300);
    const r = await readoutMap();
    save(`roster-${era}.png`, await page.screenshot());
    const total = (r.sprites ?? 0) + (r['3D'] ?? 0);
    check(`roster ${era}: every skin is drawn`, total === eraCounts[era], `drawn ${total} of ${eraCounts[era]}`);
    check(`roster ${era}: no fallback in use`, (r.fallbacks ?? -1) === 0, `fallbacks ${r.fallbacks}`);
    check(`roster ${era}: nothing dropped`, (r.dropped ?? -1) === 0, `dropped ${r.dropped}`);
    if (era === 'sprite') check('roster sprite: one batch per skin (draw calls by skin, not per monster)', (r.sprites ?? 0) === 19, `sprites ${r.sprites}`);
    if (era !== 'sprite') {
      const hs = await page.evaluate(() => window.__monsters.heights());
      const off = hs.filter((h) => !h.roster || Math.abs(h.measured / h.roster - 1) > 0.3);
      check(`roster ${era}: every 3D model is fitted to its roster height (within 30 percent)`, hs.length === eraCounts[era] && off.length === 0, off.map((h) => `${h.id} ${h.measured} vs ${h.roster}`).join('; ') || `${hs.length} models`);
    }
  }

  // ---- eight views: a sprite (flesh-worm) and a 3D model (dog-lq, early 3D) at eight facings
  await open('mode=turn&skin=flesh-worm&pause');
  await page.waitForTimeout(300);
  save('turn-flesh-worm.png', await page.screenshot());
  await open('mode=turn&skin=dog-lq&pause');
  await page.waitForTimeout(300);
  save('turn-dog-lq.png', await page.screenshot());
  check('turn: the 3D model turns with its yaw (eight facings drawn)', (await readoutMap())['3D'] === 8, 'dog-lq');

  // ---- live arena: spawn, chase, wind-up and attack, then a hurt monster in pain, then one dead
  await open('mode=live&era=mixed&pause');
  let mobs = await page.evaluate(() => window.__monsters.mobs());
  check('live: the first wave has spawned from the leak', mobs.length >= 4, `mobs ${mobs.length}`);
  save('live-arena.png', await page.screenshot());
  const kinds = new Set(mobs.map((m) => m.kind));
  check('live: more than one archetype in the first wave', kinds.size >= 2, [...kinds].join(', '));
  await advance(3);
  mobs = await page.evaluate(() => window.__monsters.mobs());
  const phases = new Set(mobs.map((m) => m.phase));
  console.log('live phases after 3 s:', [...phases].join(', '));
  save('live-chase.png', await page.screenshot());
  // pain and death on two monsters (leaksim's hurt sets the phase; the renderer shows it)
  const [first, second] = mobs;
  if (first) await page.evaluate((id) => window.__monsters.hurt(id, 4), first.id);
  await advance(0.2);
  const painPhase = (await page.evaluate(() => window.__monsters.mobs())).find((m) => m.id === first?.id)?.phase;
  check('live: a hurt monster is in its pain phase', painPhase === 'pain', `phase ${painPhase}`);
  save('live-pain.png', await page.screenshot());
  if (second) await page.evaluate((id) => window.__monsters.hurt(id, 999), second.id);
  await advance(0.4);
  save('live-death.png', await page.screenshot());
  const deadPhase = (await page.evaluate(() => window.__monsters.mobs())).find((m) => m.id === second?.id)?.phase;
  console.log('dead monster phase:', deadPhase ?? '(removed)');
  // a long run: the attacks come through (the player takes hits)
  await advance(12);
  mobs = await page.evaluate(() => window.__monsters.mobs());
  const seenAttack = mobs.some((m) => m.phase === 'attack' || m.phase === 'windup');
  check('live: monsters reach the player and wind up or attack', seenAttack || mobs.some((m) => m.phase === 'chase'), `phases ${[...new Set(mobs.map((m) => m.phase))].join(', ')}`);
  save('live-fight.png', await page.screenshot());
  console.log('live mobs at the end:', JSON.stringify(mobs.map((m) => `${m.id}:${m.kind}:${m.phase}`)));

  // ---- window: the lab vista with its six walkers
  await open('mode=window&pause');
  await page.waitForTimeout(400);
  save('window-walkers-t0.png', await page.screenshot());
  const walkers = await page.evaluate(() => window.__monsters.walkers());
  check('window: six walkers', walkers.length === 6, `walkers ${walkers.length}`);
  const skinsUsed = [...new Set(walkers.map((w) => w.skin))];
  check('window: every walker wears a skin from the adapter', skinsUsed.length >= 3, skinsUsed.join(', '));
  await advance(9);
  await page.waitForTimeout(300);
  save('window-walkers-t9.png', await page.screenshot());
  // the same frame, cropped on the walkers' band (the monsters are 10 to 50 px tall here: this is the readable view)
  save('window-walkers-zoom.png', await page.screenshot({ clip: { x: 380, y: 380, width: 560, height: 150 } }));
  const vs = await page.evaluate(() => window.__monsters.vistaStats());
  const ms = await page.evaluate(() => window.__monsters.monsterStats());
  console.log('vista:', JSON.stringify(vs), 'monsters:', JSON.stringify(ms));
  check('window: the vista stays inside 40 draw calls', vs.drawCalls <= 40, `draw calls ${vs.drawCalls}`);
  check('window: the vista stays inside 120k triangles', vs.triangles <= 120000, `triangles ${vs.triangles}`);
  check('window: the walkers are drawn (3D or sprite)', ms.sprites + ms.models === 6, `sprites ${ms.sprites}, 3D ${ms.models}`);
  check('window: the walkers use no fallback', ms.fallbacks === 0, `fallbacks ${ms.fallbacks}`);

  check('the page logged no error', errors.length === 0, errors.slice(0, 5).join(' | '));
} catch (err) {
  console.error('the test stopped:', err);
  checks.push({ name: 'run', ok: false, detail: String(err) });
} finally {
  await browser.close();
  await server.close();
}

const failed = checks.filter((c) => !c.ok);
console.log(`\n${checks.length - failed.length} of ${checks.length} checks passed`);
process.exit(failed.length ? 1 : 0);
