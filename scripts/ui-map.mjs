/**
 * The screen map (MASTER_PLAN section 8, B14/B16): visits every screen, presses every control in a fresh copy of that screen, and records
 * what it did. Flags controls that do nothing, page errors, controls off screen or covered, and text that spills out; screenshots every
 * screen; writes ui-map/index.html (the map to review) and ui-map/map.json.
 *
 *   node scripts/ui-map.mjs                       (run `npm run build` first; E2E_GPU=1 E2E_SLOW=2 on a slow laptop)
 *   node scripts/ui-map.mjs --only home,island    (some screens)
 *   node scripts/ui-map.mjs --check               (also compare with tests/ui-contract.json: a button missing, new or doing
 *                                                  something else fails, exit code 1)
 *   node scripts/ui-map.mjs --approve             (write tests/ui-contract.json from this run, after reviewing the map)
 *
 * Never takes the real mouse: mouse capture is stubbed (the island falls back to right-drag looking) and the cursor clip is released.
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const chromePaths = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'];
if (!chromePaths.some(existsSync)) { console.log('ui-map: Chrome not found, skipped'); process.exit(0); }
const { chromium } = await import('playwright-core');
const root = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const opt = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const only = opt('--only')?.split(',');
const out = `${root}ui-map`;
const slow = Math.max(1, Number(process.env.E2E_SLOW) || 1);
const T = (ms) => Math.round(ms * slow);
const gpu = process.env.E2E_GPU === '1';
const port = 8196;
const W = 1366, H = 768;
/** What the hotbar can select and change (B18, docs/HOTBAR.md section 7): needs the TypeScript loader (`npm run ui-map` has it). */
const coverage = await import('../packages/buildkit/src/coverage.ts').then((m) => m.hotbarCoverage()).catch(() => null);
/** Most a screen may take (presses and restores), so one heavy screen cannot stall the run; the rest are listed as not pressed. */
const STATE_BUDGET_MS = Number(opt('--budget') ?? 600) * 1000;

// ---- the screens and how to reach each one from clean storage ----------------------------------------------------------------------
const text = (page, sel, t) => page.locator(sel, { hasText: t }).first();
const dom = (page, fn, a) => page.evaluate(fn, a);
const clickText = (page, sel, t) => dom(page, ([s, x]) => { [...document.querySelectorAll(s)].find((b) => (b.textContent ?? '').trim().startsWith(x))?.click(); }, [sel, t]);
const settle = (page, ms = 700) => page.waitForTimeout(T(ms));
const toIsland = async (page) => { await dom(page, () => document.querySelector('.sm-menu .sm-sub')?.click()); await page.waitForSelector('.hotbar', { timeout: T(60000) }); await settle(page, 5000); };
const toGoblin = async (page) => { await dom(page, () => document.querySelector('.gr-open')?.click()); await page.waitForSelector('.gr-front', { timeout: T(15000) }); await settle(page, 1400); };

/** Each state: the storage it starts from, how to get there from the home, and what tells it is ready. */
const STATES = [
  { id: 'home-new', doc: 'The SetMix home, first launch (nothing saved)', seed: 'fresh', go: async () => {} },
  { id: 'home', doc: 'The SetMix home, returning player', seed: 'returning', go: async () => {} },
  { id: 'settings', doc: 'Settings from the home', seed: 'returning', go: async (p) => { await clickText(p, '.sm-menu button', 'Settings'); await p.waitForSelector('[aria-label="Settings"]'); } },
  { id: 'avatars', doc: 'Avatars from the home', seed: 'returning', go: async (p) => { await clickText(p, '.sm-menu button', 'Avatars'); await p.waitForSelector('[aria-label="Avatars"]'); } },
  { id: 'avatar-new', doc: 'New avatar from the home: the three ways in', seed: 'returning', go: async (p) => { await clickText(p, '.sm-menu button', 'Avatars'); await p.waitForSelector('[aria-label="Avatars"]'); await clickText(p, '[aria-label="Avatars"] button', 'New avatar'); await p.waitForSelector('.new-chooser'); } },
  { id: 'avatar-maker', doc: 'The full avatar maker (Manual)', seed: 'returning', go: async (p) => { await clickText(p, '.sm-menu button', 'Avatars'); await p.waitForSelector('[aria-label="Avatars"]'); await clickText(p, '[aria-label="Avatars"] button', 'New avatar'); await p.waitForSelector('.new-chooser'); await clickText(p, '.nc-way', 'Manual'); await p.waitForSelector('.create-goblin'); } },
  { id: 'community', doc: 'Community', seed: 'returning', go: async (p) => { await clickText(p, '.sm-menu button', 'Community'); await p.waitForSelector('.shell-top'); } },
  { id: 'goblin', doc: "Goblin Racing's own menu", seed: 'returning', go: toGoblin },
  { id: 'goblin-modes', doc: "Goblin Racing's sections", seed: 'returning', go: async (p) => { await toGoblin(p); await clickText(p, '.gr-front .shell-menu button', 'Race modes'); await p.waitForSelector('.shell-racing'); } },
  { id: 'race-select', doc: 'Goblin Racing, Play: choosing a racer', seed: 'returning', go: async (p) => { await toGoblin(p); await clickText(p, '.gr-front .shell-menu button', 'Play'); await settle(p, 4000); } },
  { id: 'island', doc: 'Your island, walking (returning player)', seed: 'returning', go: toIsland },
  { id: 'island-esc', doc: "The island's Esc menu", seed: 'returning', go: async (p) => { await toIsland(p); await p.keyboard.press('Escape'); await p.waitForSelector('.island-menu'); } },
  { id: 'island-presets', doc: 'The presets window on the island (E)', seed: 'returning', go: async (p) => { await toIsland(p); await p.keyboard.press('e'); await p.waitForSelector('.presets'); } },
  { id: 'island-studio', doc: 'Studio mode on the island (B)', seed: 'returning', go: async (p) => { await toIsland(p); await p.keyboard.press('b'); await settle(p, 1200); } },
  { id: 'islands', doc: 'My planet: your islands (from the home)', seed: 'returning', go: async (p) => { await clickText(p, '.sm-menu button', 'My planet'); await p.waitForSelector('[aria-label="My planet"]'); } },
  { id: 'island-new', doc: 'A new island: the three ways in', seed: 'returning', go: async (p) => { await clickText(p, '.sm-menu button', 'My planet'); await p.waitForSelector('[aria-label="My planet"]'); await clickText(p, '[aria-label="My planet"] button', 'New island'); await p.waitForSelector('.new-chooser'); } },
  { id: 'island-wizard', doc: 'The new-island wizard', seed: 'returning', go: async (p) => { await clickText(p, '.sm-menu button', 'My planet'); await p.waitForSelector('[aria-label="My planet"]'); await clickText(p, '[aria-label="My planet"] button', 'New island'); await clickText(p, '.nc-way', 'Setup wizard'); await p.waitForSelector('.new-island.wizard'); } },
  { id: 'island-avatar', doc: 'Avatar mode on the island (P)', seed: 'returning', go: async (p) => { await toIsland(p); await p.keyboard.press('p'); await p.waitForSelector('.avatar-dock'); await settle(p, 1200); } },
  { id: 'activities', doc: 'Activities', seed: 'returning', go: async (p) => { await toIsland(p); await p.keyboard.press('Escape'); await p.waitForSelector('.island-menu'); await clickText(p, '.island-menu button', 'Activities'); await p.waitForSelector('[aria-label="Activities"]'); } },
  { id: 'track-editor', doc: 'The track editor', seed: 'returning', go: async (p) => { await toGoblin(p); await clickText(p, '.gr-front .shell-menu button', 'Race modes'); await p.waitForSelector('.shell-racing'); await clickText(p, '.shell-racing-nav button', 'Track editor'); await settle(p, 800); await clickText(p, '.shell-racing button', 'Open the track editor'); await settle(p, 6000); await clickText(p, '.help-card button', "Let's build"); await settle(p, 600); } },
  { id: 'island-kids', doc: 'Your island with grown-up mode off', seed: 'kids', go: toIsland },
];

// ---- what the page looks like right now -----------------------------------------------------------------------------------------------
/** Every control a player can see, with a stable name: the area it sits in, then its own label. */
function readControls() {
  const SEL = 'button, [role=tab], [role=option], a[href], input[type=checkbox], input[type=radio], input[type=range], input[type=color], input[type=text], input:not([type]), select, summary, [role=button]';
  const AREA_ROLES = new Set(['dialog', 'toolbar', 'tablist', 'group', 'listbox', 'navigation', 'menu', 'region']);
  const AREA_CLASS = /^(sm-menu|sm-home|gr-preview|gr-front|mode-bar|island-menu|galaxy-bar|hotbar|tab-strip|shell-top|shell-racing|shell-card|cg-panel|cg-kinds|cg-looks|presets|pw-tabs|pw-slots|pw-grid|tool-say|tour-card|fwin|create-goblin|avatar-dock|editor|settings-body)$/;
  const areaOf = (el) => {
    for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
      const role = a.getAttribute('role') ?? (a.tagName === 'NAV' ? 'navigation' : '');
      const label = a.getAttribute('aria-label');
      if (label && (AREA_ROLES.has(role) || ['NAV', 'ASIDE', 'SECTION', 'HEADER'].includes(a.tagName))) return label;
      const cls = [...a.classList].find((c) => AREA_CLASS.test(c));
      if (cls) return cls;
    }
    return 'page';
  };
  const nameOf = (el) => (el.getAttribute('aria-label') || (el.labels?.[0]?.innerText ?? '') || (el.tagName === 'SELECT' || el.tagName === 'INPUT' ? '' : el.innerText) || el.getAttribute('title') || el.getAttribute('data-label') || el.getAttribute('placeholder') || el.getAttribute('name') || el.type || '').replace(/\s+/g, ' ').trim().slice(0, 48);
  const seen = new Map();
  const list = [];
  for (const el of document.querySelectorAll(SEL)) {
    if (el.closest('[aria-hidden="true"], [inert]')) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    if (el.checkVisibility && !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) continue;
    // a layer faded out (opacity on an ancestor below 0.05) does not count
    let faded = false; for (let a = el; a; a = a.parentElement) { if (Number(getComputedStyle(a).opacity) < 0.05) { faded = true; break; } }
    if (faded) continue;
    const base = `${areaOf(el)} › ${nameOf(el) || el.tagName.toLowerCase()}`;
    const n = (seen.get(base) ?? 0) + 1; seen.set(base, n);
    const id = n > 1 ? `${base} #${n}` : base;
    const kind = el.tagName === 'SELECT' ? 'select' : el.tagName === 'INPUT' ? `input:${el.type || 'text'}` : el.getAttribute('role') ?? (el.tagName === 'A' ? 'link' : el.tagName === 'SUMMARY' ? 'summary' : 'button');
    const on = el.classList.contains('on') || el.getAttribute('aria-pressed') === 'true' || el.getAttribute('aria-selected') === 'true' || (el.tagName === 'INPUT' && el.checked) || (el.tagName === 'SUMMARY' && el.parentElement?.open);
    // what a player sees of it: off screen, covered by something else, text cut off, too small to hit
    const flags = [];
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const scrolls = (() => { for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) { const o = getComputedStyle(a).overflowY; if ((o === 'auto' || o === 'scroll') && a.scrollHeight > a.clientHeight + 2) return true; } return false; })();
    if (scrolls && (r.bottom > innerHeight || r.top < 0)) { /* below the fold of a scrolling panel: reachable by scrolling */ }
    else if (r.right < 0 || r.bottom < 0 || r.left > innerWidth || r.top > innerHeight) flags.push('off screen');
    else if (r.left < -1 || r.top < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1) flags.push('partly off screen');
    else { const top = document.elementFromPoint(cx, cy); if (top && top !== el && !el.contains(top) && !top.contains(el)) flags.push(`covered by ${top.tagName.toLowerCase()}${top.className && typeof top.className === 'string' ? '.' + top.className.split(' ')[0] : ''}`); }
    if (el.scrollWidth > el.clientWidth + 2 && getComputedStyle(el).overflow !== 'visible' && el.clientWidth > 0) flags.push('text cut off');
    if ((r.width < 20 || r.height < 20) && kind !== 'input:checkbox' && kind !== 'input:radio') flags.push('small target');
    if (el.disabled || el.getAttribute('aria-disabled') === 'true') flags.push('disabled');
    list.push({ id, kind, on: !!on, rect: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)], flags });
  }
  return list;
}

/** Where we are: the shell screen, open windows and overlays, notes, and what is saved (hashed). */
function readState() {
  const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && (!el.checkVisibility || el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })); };
  const LAYERS = ['.sm-home', '.gr-preview', '.gr-front', '.island-menu', '.tab-palette', '.create-goblin', '.shell-racing', '.hotbar', '.presets', '.tour-card', '.avatar-dock', '.crosshair.on'];
  const hash = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };
  const storage = {};
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); storage[k] = hash(localStorage.getItem(k) ?? ''); }
  return {
    screen: document.querySelector('.shell')?.getAttribute('data-screen') ?? document.querySelector('[data-screen]')?.getAttribute('data-screen') ?? '?',
    dialogs: [...document.querySelectorAll('[role=dialog]')].filter(vis).map((d) => d.getAttribute('aria-label') ?? '?').sort(),
    layers: LAYERS.filter((s) => { const e = document.querySelector(s); return e && vis(e); }),
    notes: [...document.querySelectorAll('[role=status], [role=alert]')].filter(vis).map((n) => (n.textContent ?? '').trim().slice(0, 80)).filter(Boolean),
    storage,
    pointer: !!document.pointerLockElement,
  };
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const where = (s) => ({ screen: s.screen, dialogs: s.dialogs, layers: s.layers });
/** What a press did, in words, most important first. */
function outcome(before, after, cBefore, cAfter) {
  const o = [];
  if (before.screen !== after.screen) o.push(`screen ${before.screen} → ${after.screen}`);
  for (const d of after.dialogs) if (!before.dialogs.includes(d)) o.push(`opens "${d}"`);
  for (const d of before.dialogs) if (!after.dialogs.includes(d)) o.push(`closes "${d}"`);
  for (const l of after.layers) if (!before.layers.includes(l)) o.push(`shows ${l}`);
  for (const l of before.layers) if (!after.layers.includes(l)) o.push(`hides ${l}`);
  const ids = (cs) => new Set(cs.map((c) => c.id));
  const a = ids(cBefore), b = ids(cAfter);
  const added = [...b].filter((x) => !a.has(x)).length, gone = [...a].filter((x) => !b.has(x)).length;
  if ((added || gone) && !o.length) o.push(`controls +${added} -${gone}`);
  const onB = new Set(cBefore.filter((c) => c.on).map((c) => c.id));
  const nowOn = cAfter.filter((c) => c.on && !onB.has(c.id)).map((c) => c.id.split(' › ').pop());
  if (nowOn.length) o.push(`selects ${nowOn.slice(0, 3).join(', ')}`);
  const keys = new Set([...Object.keys(before.storage), ...Object.keys(after.storage)]);
  const saved = [...keys].filter((k) => before.storage[k] !== after.storage[k]);
  if (saved.length) o.push(`saves ${saved.join(', ')}`);
  for (const n of after.notes) if (!before.notes.includes(n)) o.push(`says "${n}"`);
  if (after.pointer !== before.pointer) o.push(after.pointer ? 'captures the mouse' : 'frees the mouse');
  return o;
}
/** The one-line contract for a control: its main effect, without details that change run to run. */
const contractOf = (o) => {
  if (!o.length) return 'nothing';
  const first = o[0];
  if (first.startsWith('screen ')) return first;
  if (first.startsWith('opens ') || first.startsWith('closes ') || first.startsWith('shows ') || first.startsWith('hides ')) return first;
  if (first.startsWith('controls ')) return 'changes the controls';
  if (first.startsWith('selects ')) return 'selects';
  if (first.startsWith('saves ')) return 'saves';
  if (first.startsWith('says ')) return 'says something';
  return first;
};

// ---- the map page (rewritten after every screen, so a stopped run keeps what it found) ---------------------------------------------------
function writeReport(problems = []) {
  report.problems = problems;
  writeFileSync(`${out}/map.json`, JSON.stringify(report, null, 1));
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const isRed = (f) => f === 'does nothing' || f.startsWith('page error') || f.startsWith('test error') || f.startsWith('covered') || f.includes('off screen');
  const total = report.states.reduce((a, s) => a + s.controls.length, 0);
  const reds = report.states.reduce((a, s) => a + s.controls.filter((c) => c.flags.some(isRed)).length, 0);
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Screen map</title>
  <style>
  :root{--bg:#f4f5f7;--ink:#16181d;--dim:#5d6470;--line:#d9dce1;--red:#c0392b;--amber:#a76a00;--ok:#2f7d4f;--card:#fff}
  @media (prefers-color-scheme:dark){:root{--bg:#121417;--ink:#e9ebef;--dim:#9aa1ad;--line:#2a2e35;--red:#ff7a6b;--amber:#f0b44c;--ok:#6fcf97;--card:#1a1d22}}
  body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.5 system-ui,sans-serif}
  main{max-width:1240px;margin:0 auto;padding:24px 16px 64px}
  h1{font-size:22px;margin:0 0 4px}h2{font-size:17px;margin:0}p{margin:4px 0}
  .sum{color:var(--dim);margin-bottom:20px}
  .problems{border:1px solid var(--red);padding:10px 14px;margin:12px 0 20px;background:var(--card)}
  section{background:var(--card);border:1px solid var(--line);margin:0 0 18px;display:grid;grid-template-columns:minmax(0,420px) minmax(0,1fr);gap:16px;padding:14px}
  @media (max-width:820px){section{grid-template-columns:1fr}}
  section img{width:100%;border:1px solid var(--line);display:block}
  table{border-collapse:collapse;width:100%;font-size:13px}td{border-top:1px solid var(--line);padding:4px 6px;vertical-align:top}
  td:first-child{width:40%;word-break:break-word}.red{color:var(--red)}.amber{color:var(--amber)}.dim{color:var(--dim)}
  a{color:inherit}
  </style></head><body><main>
  <h1>Screen map</h1>
  <p class="sum">${esc(report.at)} · ${report.size.join('×')} · ${report.states.length} screens · ${total} controls · <span class="${reds ? 'red' : ''}">${reds} to look at</span> · ${Math.round((Date.now() - t0) / 60000)} min</p>
  ${problems.length ? `<div class="problems"><b>Contract</b><ul>${problems.map((p) => `<li>${esc(p)}</li>`).join('')}</ul></div>` : ''}
  ${coverage ? `<section class="coverage"><div><h2>What the hotbar can edit</h2><p class="dim">Every kind of thing in the world: can Select pick it, which tools change it (docs/HOTBAR.md). Red is missing.</p>${coverage.design.length ? `<ul>${coverage.design.map((d) => `<li class="red">${esc(d.says)}</li>`).join('')}</ul>` : ''}</div><div><table><tr><td><b>Thing</b></td><td><b>Select</b></td><td><b>Changed by</b></td></tr>${coverage.rows.map((r) => `<tr><td>${esc(r.kind.name)}</td><td class="${r.selectable ? '' : 'red'}">${r.selectable ? 'yes' : 'no'}</td><td>${Object.entries(r.changedBy).map(([tab, names]) => `${esc(tab)}: ${esc(names.slice(0, 6).join(', '))}${names.length > 6 ? ' …' : ''}`).join('<br>') || '<span class="red">nothing</span>'}</td></tr>`).join('')}</table></div></section>` : ''}
  ${report.states.map((s) => `<section id="${s.id}"><div><h2>${esc(s.id)}</h2><p class="dim">${esc(s.doc)}</p>${s.reachError ? `<p class="red">Could not reach it: ${esc(s.reachError)}</p>` : `<a href="${s.shot}"><img src="${s.shot}" alt="${esc(s.doc)}" loading="lazy"></a><p class="dim">${esc(s.where?.screen ?? '')} ${esc((s.where?.dialogs ?? []).join(', '))}</p>`}</div>
  <div><table>${s.controls.map((c) => `<tr><td>${esc(c.id)}</td><td>${c.outcome.length ? esc(c.outcome.join('; ')) : '<span class="red">does nothing</span>'}${c.esc ? ` <span class="dim">· Esc ${esc(c.esc)}</span>` : ''}${c.shot ? ` <a href="${c.shot}">picture</a>` : ''}${c.flags.filter((f) => f !== 'does nothing').map((f) => `<br><span class="${isRed(f) ? 'red' : 'amber'}">${esc(f)}</span>`).join('')}</td></tr>`).join('')}</table></div></section>`).join('\n')}
  </main></body></html>`;
  writeFileSync(`${out}/index.html`, html);

}

// ---- run ----------------------------------------------------------------------------------------------------------------------------
mkdirSync(`${out}/shots`, { recursive: true });
const server = spawn(process.execPath, ['scripts/serve.mjs'], { cwd: root, env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: gpu ? ['--ignore-gpu-blocklist', '--enable-gpu'] : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const report = { at: new Date().toISOString(), size: [W, H], states: [] };
const t0 = Date.now();
try {
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  page.setDefaultTimeout(T(30000));
  await page.addInitScript(() => {
    Element.prototype.requestPointerLock = function () { return Promise.reject(new Error('pointer lock is stubbed in tests')); };
    window.__errs = [];
    addEventListener('error', (e) => window.__errs.push(String(e.message).slice(0, 160)));
    addEventListener('unhandledrejection', (e) => window.__errs.push(String(e.reason?.message ?? e.reason).slice(0, 160)));
  });
  page.on('dialog', (d) => d.dismiss().catch(() => {}));
  const url = `http://127.0.0.1:${port}/`;

  // the storage each state starts from: fresh, or a returning player made the way a player makes one (My island, name, Done)
  const seeds = { fresh: {} };
  await page.goto(url); await page.evaluate(() => localStorage.clear()); await page.reload(); await page.waitForSelector('.sm-home', { timeout: T(30000) });
  await dom(page, () => document.querySelector('.sm-menu .sm-sub')?.click());
  await page.waitForSelector('.create-goblin', { timeout: T(20000) });
  await page.locator('.cg-name input').fill('Ada');
  await clickText(page, '.cg-panel button', 'Done');
  await page.waitForSelector('.hotbar', { timeout: T(60000) });
  await settle(page, 2000);
  const returning = await page.evaluate(() => Object.fromEntries(Object.keys(localStorage).map((k) => [k, localStorage.getItem(k)])));
  returning['hm.tour.v1'] = JSON.stringify({ mode: 'never', kind: 'build', progress: null });
  const prof = JSON.parse(returning['hm.profile.v2'] ?? '{}');
  returning['hm.profile.v2'] = JSON.stringify({ ...prof, tutorialDone: true, quality: 'low' });
  seeds.returning = returning;
  seeds.kids = { ...returning, 'hm.profile.v2': JSON.stringify({ ...prof, tutorialDone: true, quality: 'low', grownUp: false }) };

  const reach = async (st) => {
    await page.goto(url);
    await page.evaluate((s) => { localStorage.clear(); for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); }, seeds[st.seed]);
    await page.reload();
    await page.waitForSelector('.sm-home', { timeout: T(30000) });
    await settle(page, 1500);
    await st.go(page);
    await settle(page, 600);
    await page.evaluate(() => { window.__errs.length = 0; });
  };

  for (const st of STATES) {
    if (only && !only.includes(st.id)) continue;
    const ts = Date.now();
    const entry = { id: st.id, doc: st.doc, shot: `shots/${st.id}.png`, controls: [], errors: [], reachError: null };
    report.states.push(entry);
    try { await reach(st); } catch (e) { entry.reachError = String(e.message ?? e).split('\n')[0]; console.log(`FAIL ${st.id}: could not reach it (${entry.reachError})`); continue; }
    await page.screenshot({ path: `${out}/${entry.shot}` });
    const base = await page.evaluate(readState);
    const baseControls = await page.evaluate(readControls);
    entry.where = where(base);
    let fresh = true;
    let shotN = 0;
    for (const c of baseControls) {
      const rec = { id: c.id, kind: c.kind, flags: c.flags, outcome: [], esc: null };
      entry.controls.push(rec);
      if (Date.now() - ts > T(STATE_BUDGET_MS)) { rec.outcome = ['(not pressed: the screen ran out of time)']; continue; }
      if (c.flags.includes('disabled') || c.kind.startsWith('input:') && c.kind !== 'input:checkbox' || c.kind === 'select') { rec.outcome = ['(not pressed)']; continue; }
      try {
        if (!fresh) {
          const now = await page.evaluate(readState);
          if (!same(where(now), where(base))) { await reach(st); }
        }
        let controls = await page.evaluate(readControls);
        let here = controls.find((x) => x.id === c.id);
        if (here && (here.rect[1] < 0 || here.rect[1] + here.rect[3] > H)) {
          await page.evaluate(([x, y, w, h]) => { for (const e of document.querySelectorAll('*')) { const b = e.getBoundingClientRect(); if (Math.abs(b.left - x) < 2 && Math.abs(b.top - y) < 2 && Math.abs(b.width - w) < 2 && Math.abs(b.height - h) < 2) { e.scrollIntoView({ block: 'center' }); break; } } }, here.rect);
          await settle(page, 250);
          controls = await page.evaluate(readControls);
          here = controls.find((x) => x.id === c.id);
        }
        if (!here) { rec.outcome = ['(gone before it could be pressed)']; continue; }
        const before = await page.evaluate(readState);
        // press it the way a player does: the mouse on its middle (a covered control is pressed where it is covered, like a player would)
        const [x, y, w, h] = here.rect;
        if (c.kind === 'input:checkbox') await page.mouse.click(x + Math.min(10, w / 2), y + h / 2);
        else await page.mouse.click(x + w / 2, y + h / 2);
        await settle(page, 900);
        let after = await page.evaluate(readState);
        // something still on its way (a dive, a grow): give it time
        if (after.screen === 'zoom' || before.screen !== after.screen) { await settle(page, 2500); after = await page.evaluate(readState); }
        const cAfter = await page.evaluate(readControls);
        rec.outcome = outcome(before, after, controls, cAfter);
        const errs = await page.evaluate(() => window.__errs.splice(0));
        if (errs.length) rec.flags = [...rec.flags, ...errs.map((e) => `page error: ${e}`)];
        if (!rec.outcome.length) { if (here.on) rec.outcome = ['(already selected)']; else rec.flags = [...rec.flags, 'does nothing']; }
        // a new place: screenshot it, then see whether Esc brings you back
        if (!same(where(after), where(before))) {
          shotN++;
          rec.shot = `shots/${st.id}__${shotN}.png`;
          await page.screenshot({ path: `${out}/${rec.shot}` });
          await page.keyboard.press('Escape');
          await settle(page, 900);
          const back = await page.evaluate(readState);
          rec.esc = same(where(back), where(before)) ? 'returns' : same(where(back), where(after)) ? 'does nothing' : `goes to ${back.screen}${back.dialogs.length ? ' ' + back.dialogs.join(', ') : ''}`;
        }
        fresh = false;
      } catch (e) {
        rec.flags = [...rec.flags, `test error: ${String(e.message ?? e).split('\n')[0].slice(0, 120)}`];
        fresh = false;
      }
    }
    const red = entry.controls.filter((r) => r.flags.some((f) => f === 'does nothing' || f.startsWith('page error') || f.startsWith('covered') || f.includes('off screen'))).length;
    console.log(`${red ? 'WARN' : 'ok  '} ${st.id}: ${entry.controls.length} controls, ${red} to look at (${Math.round((Date.now() - ts) / 1000)} s)`);
    writeReport();
  }
} finally {
  await browser.close();
  server.kill();
  if (process.platform === 'win32') spawnSync('powershell', ['-NoProfile', '-Command', "Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public static class U { [DllImport(\"user32.dll\")] public static extern bool ClipCursor(IntPtr r); }'; [U]::ClipCursor([IntPtr]::Zero) | Out-Null"], { stdio: 'ignore' });
}

// ---- the contract: what every control must keep doing --------------------------------------------------------------------------------
const contract = {};
for (const s of report.states) { if (s.reachError) continue; contract[s.id] = Object.fromEntries(s.controls.map((c) => [c.id, c.outcome[0]?.startsWith('(') ? c.outcome[0] : contractOf(c.outcome)])); }
const contractFile = `${root}tests/ui-contract.json`;
let problems = [];
if (flag('--check')) {
  if (!existsSync(contractFile)) problems.push('no tests/ui-contract.json yet: review the map, then run with --approve');
  else {
    const want = JSON.parse(readFileSync(contractFile, 'utf8'));
    for (const [sid, controls] of Object.entries(want)) {
      if (only && !only.includes(sid)) continue;
      const got = contract[sid];
      if (!got) { problems.push(`${sid}: the screen could not be reached`); continue; }
      for (const [cid, does] of Object.entries(controls)) {
        if (!(cid in got)) problems.push(`${sid}: "${cid}" is missing`);
        else if (got[cid] !== does) problems.push(`${sid}: "${cid}" should ${does}, now ${got[cid]}`);
      }
      for (const cid of Object.keys(got)) if (!(cid in controls)) problems.push(`${sid}: new control "${cid}" (${got[cid]}): add it to the contract (--approve) once it is right`);
    }
  }
}
if (flag('--approve')) {
  const prev = existsSync(contractFile) ? JSON.parse(readFileSync(contractFile, 'utf8')) : {};
  writeFileSync(contractFile, JSON.stringify({ ...prev, ...contract }, null, 1) + '\n');
  console.log(`approved: tests/ui-contract.json (${Object.keys(contract).length} screens)`);
}
writeReport(problems);

const total = report.states.reduce((a, st) => a + st.controls.length, 0);
const reds = report.states.reduce((a, st) => a + st.controls.filter((c) => c.flags.some((f) => f === 'does nothing' || f.startsWith('page error') || f.startsWith('test error') || f.startsWith('covered') || f.includes('off screen'))).length, 0);
console.log(`ui-map: ${report.states.length} screens, ${total} controls, ${reds} to look at; ui-map/index.html (${Math.round((Date.now() - t0) / 60000)} min)`);
if (problems.length) { console.log(`contract: ${problems.length} problems`); for (const p of problems.slice(0, 40)) console.log(`  ${p}`); process.exit(1); }
