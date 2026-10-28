/**
 * Plan 51 wave 3 e2e: every gamebridge channel at once, with no install.
 *  A. The FIDELITY self-bridge. Tab B plays `?game=arena-survivor&telemetry-out` with its locomotion pinned to
 *     lunar-ballast (the game preset keeps its own Moon gravity, 1.62 m/s²); it jumps, and fires a round every 600 ms. Tab A (the campaign) says "bridge fidelity arena
 *     survivor":
 *     - the shipped FIDELITY profile maps B's telemetry;
 *     - A's body takes B's gravity and A's drone B's fire cadence, live;
 *     - B's jumps (mobility) reload A's weapon through the reflex slot;
 *     - "stop the bridge" puts it all back.
 *  B. The input-audio rung. Tab A says "bridge some indie" (a fake process). The bridge replays a recorded cadence-sampler
 *     stream: fire held with the game's own rounds at 6 a second, jump pressed every second. A's drone takes 6 rounds a
 *     second from the audio alone, and the jump presses reload A's weapon.
 * Boots the built game (run `npm run build` first); a private bridge on its own port; shots to shots-run/gamebridge/.
 *   node scripts/test-gamebridge-e2e.mjs
 */
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const outDir = path.join(root, 'shots-run/gamebridge');
fs.mkdirSync(outDir, { recursive: true });
const chromePath = [process.env.CHROME_PATH, '/opt/pw-browsers/chromium', 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium']
  .filter(Boolean).find(fs.existsSync);
if (!chromePath) { console.error('Chrome/Chromium not found; set CHROME_PATH.'); process.exit(1); }
const port = 8236;
const bridgePort = 8235;
const bridge = `http://127.0.0.1:${bridgePort}`;
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gamebridge-e2e-'));
const defaultsFile = path.join(tmpDir, 'kit-defaults.json');
fs.writeFileSync(defaultsFile, '{}\n');

// a recorded cadence-sampler stream: 9 s at 200 Hz, the game in focus, fire held 0.5..8.5 s with its rounds at 6 a second
// (each round 15 ms of sound, the session meter holding it), jump pressed for 100 ms every second, and the mirror's keys
// (7th column): W held 1..3 s, the player walking forward in the game
const replay = path.join(tmpDir, 'sampler.txt');
{
  const lines = [];
  for (let k = 0; k < 1800; k++) {
    const t = k / 200;
    const fire = t >= 0.5 && t < 8.5;
    const round = fire && ((t - 0.5) % (1 / 6)) < 0.015;
    const jump = (t % 1) < 0.1;
    const keys = t >= 1 && t < 3 ? 1 : 0;
    lines.push(`${t.toFixed(4)} 1 ${fire ? 1 : 0} ${jump ? 1 : 0} 0 ${(round ? 0.55 : 0.003).toFixed(4)} ${keys}`);
  }
  fs.writeFileSync(replay, `${lines.join('\n')}\n`);
}

const server = spawn(process.execPath, ['scripts/serve.mjs'], { cwd: root, env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
const bridgeProc = spawn(process.execPath, ['scripts/companion-bridge.mjs', '--port', String(bridgePort), '--defaults-file', defaultsFile, '--frame-dir', path.join(tmpDir, 'frames'),
  '--fake-processes', 'svchost.exe,chrome.exe,SomeIndie.exe', '--sampler-replay', replay], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
let bridgeLog = '';
for (const s of [bridgeProc.stdout, bridgeProc.stderr]) s.on('data', (d) => { bridgeLog = (bridgeLog + d).slice(-8000); });
await new Promise((r) => setTimeout(r, 1500));

const browser = await chromium.launch({ executablePath: chromePath, headless: true, args: ['--ignore-gpu-blocklist', '--enable-gpu'] });
const context = await browser.newContext({ viewport: { width: 1100, height: 640 } });
await context.addInitScript(() => {
  Element.prototype.requestPointerLock = function () { return Promise.reject(new Error('pointer lock stubbed in test')); };
  try { localStorage.clear(); } catch {}
  try { window.speechSynthesis.speak = () => {}; } catch {}
});
const pageErrors = [];
const results = [];
let lastEvents = null;
const check = (name, ok, detail = '') => {
  results.push({ name, ok: !!ok });
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? ` (${detail})` : ''}`);
};
const getJson = async (p) => (await fetch(`${bridge}${p}`)).json();
const postCommand = async (cmd) => (await fetch(`${bridge}/command`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cmd) })).json();
const events = async (type) => (await getJson('/events?after=0')).events.filter((e) => e.type === type);
const said = async (re) => (await events('companion-say')).find((e) => re.test(e.text));
const until = async (fn, ms, step = 250) => {
  const end = Date.now() + ms;
  for (;;) { const v = await fn(); if (v || Date.now() > end) return v; await new Promise((r) => setTimeout(r, step)); }
};

try {
  // --- tab B: the source game, streaming its own telemetry ---
  const b = await context.newPage();
  b.on('pageerror', (e) => pageErrors.push(`B: ${e.message}`));
  const bBodies = [];
  b.on('request', (q) => { if (q.url().includes('/telemetry/')) { bBodies.push(q.postData()); if (bBodies.length > 400) bBodies.splice(3, 1); } });
  await b.goto(`http://localhost:${port}/?story&game=arena-survivor&e2e&telemetry-out&bridge=${bridgePort}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await b.waitForFunction(() => window.hmPlay?.ready === true && window.__playScene && window.__dev, undefined, { timeout: 90000 });
  await b.evaluate(() => {
    window.__dev.setLocomotion('lunar-ballast'); // its jump and walk; the game preset's gravity still rules
    window.__dev.equip('shotgun');
    // the semi core (0.52 s cooldown) on an extended cell (20 rounds), through the dev seam so it sticks: a round every
    // 600 ms is within the weapon's own pace
    window.__dev.setWeapon({ core: 'core-semi', barrel: 'barrel-short', sight: 'sight-iron', cell: 'cell-extended' });
    window.__playScene.monsters.reload();
  });
  // a game preset sets its own gravity, 9.81 m/s² times its gravityScale (arena-survivor: 0.165, the Moon), over any
  // locomotion preset's: that is the gravity B's body really falls at, so it is what A must recover
  const gSource = 9.81 * 0.165;
  check('tab B streams its telemetry to the bridge', await until(async () => ((await getJson('/bridge-profiles')).telemetry?.['fidelity-arena-survivor'] ?? 0) > 10, 10000));

  // --- tab A: the campaign, where the drone bridges B ---
  const a = await context.newPage();
  a.on('pageerror', (e) => pageErrors.push(`A: ${e.message}`));
  await a.goto(`http://localhost:${port}/?story&e2e&bridge=${bridgePort}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await a.waitForSelector('.sm-menu button', { timeout: 45000 });
  await a.locator('.sm-menu button', { hasText: 'Play' }).first().click();
  await a.waitForFunction(() => window.hmPlay?.ready === true && window.__playScene && window.__dev, undefined, { timeout: 90000 });
  await a.evaluate(() => { [...document.querySelectorAll('.play-create .btns button')].find((x) => x.textContent.startsWith('Done'))?.click(); });
  await a.waitForFunction(() => Boolean(window.__companion), undefined, { timeout: 30000 });
  await a.evaluate(() => window.__dev.equip('shotgun'));
  check('tab A links to the bridge', await until(async () => (await getJson('/status')).gameLinked, 15000));
  // an order counts once the bridge logs it as the player's words; two tabs on the min-spec laptop can swallow a key press,
  // so the panel is opened and the words sent again until it does
  const panel = a.locator('[data-testid="companion-comms-panel"]');
  const order = async (text) => {
    for (let attempt = 0; attempt < 4; attempt++) {
      const since = Date.now();
      await a.bringToFront();
      if (!(await panel.isVisible().catch(() => false))) {
        await a.keyboard.press('Enter');
        await panel.waitFor({ state: 'visible', timeout: 4000 }).catch(() => {});
        if (!(await panel.isVisible().catch(() => false))) continue;
      }
      const input = a.locator('.companion-chat-input');
      await input.fill(text);
      await input.press('Enter');
      if (await until(async () => (await events('player-say')).some((e) => e.text === text && e.at >= since - 50), 4000)) return;
    }
    throw new Error(`the order "${text}" never reached the bridge`);
  };
  const gBefore = await a.evaluate(() => window.__dev.activeLocomotion().gravityMps2);
  const gapBefore = await a.evaluate(() => window.__playScene.companionTuning().roundGapS);

  // --- A. the self-bridge ---
  await order('bridge fidelity arena survivor');
  check('"bridge fidelity arena survivor" takes the shipped FIDELITY profile', Boolean(await until(() => said(/^FIDELITY arena survivor: permitted\. FIDELITY \(our own game\) checked its terms/), 6000)));
  // a background tab's timers run once a second, so B plays in front (A's 1.5 s poll is not slowed by that)
  await b.bringToFront();
  // B plays: a jump every 1.6 s, a round every 600 ms (reloading before the cell runs dry), for 34 s
  const play = b.evaluate(async () => {
    const t0 = performance.now();
    let nextJump = 0;
    // when each round really left the gun: the oracle for the cadence A must read (the loop's own overhead adds to 600 ms)
    const firedAt = [];
    while (performance.now() - t0 < 34000) {
      const t = performance.now() - t0;
      if (t >= nextJump) {
        nextJump += 1600;
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ' }));
        setTimeout(() => window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', key: ' ' })), 120);
      }
      if ((window.__dev.ammo()?.current ?? 0) <= 1) window.__playScene.monsters.reload();
      if (window.__dev.fire()?.fired) firedAt.push(performance.now() / 1000);
      await new Promise((r) => setTimeout(r, 600));
    }
    const gaps = firedAt.slice(1).map((t, i) => t - firedAt[i]).sort((x, y) => x - y);
    return gaps[gaps.length >> 1] ?? null;
  });
  const sentBefore = (await getJson('/bridge-profiles')).telemetry?.['fidelity-arena-survivor'] ?? 0;
  // while B plays (in front, streaming at full pace), A's body settles on B's gravity within a few batches: a batch with no
  // whole jump keeps the gravity it has, and each batch carries the last 8 s into the next, so a cut arc comes back whole
  const settled = await until(() => a.evaluate((g) => Math.abs(window.__dev.activeLocomotion().gravityMps2 - g) / g < 0.1, gSource), 36000, 500);
  const bGap = await play;
  // A takes the rest of the stream in its poll; in front again, its timers are not held to a background tab's pace
  await a.bringToFront();
  const live = await until(async () => (await events('mimic-result')).find((e) => e.live === true && e.game === 'FIDELITY arena survivor'), 25000);
  console.log(`  (A's gravity settled on B's while B played: ${Boolean(settled)})`);
  const sent = ((await getJson('/bridge-profiles')).telemetry?.['fidelity-arena-survivor'] ?? 0) - sentBefore;
  console.log('  (B posted ' + sent + ' payloads while it played)');
  if (!live) console.log('  B payloads:', bBodies.slice(0, 2).join(' | '), ' ... ', bBodies.slice(-2).join(' | '));
  check('B\'s telemetry becomes a live mimic in A', Boolean(live), JSON.stringify(live?.codes ?? null).slice(0, 100));
  const gLive = await a.evaluate(() => window.__dev.activeLocomotion().gravityMps2);
  check('A\'s body takes B\'s gravity', Math.abs(gLive - gSource) / gSource < 0.1, `A ${gLive} vs B ${gSource} (A was ${gBefore})`);
  const gapLive = await a.evaluate(() => window.__playScene.companionTuning().roundGapS);
  check('A\'s drone takes B\'s real fire cadence', bGap !== null && Math.abs(gapLive - bGap) / bGap < 0.1, `A ${gapLive?.toFixed(3)} s vs B's rounds ${bGap?.toFixed(3)} s apart (A was ${gapBefore})`);
  const reflexes = await events('reflex');
  check('B\'s jumps reload A\'s weapon through the reflex slot', reflexes.some((e) => e.gameId === 'fidelity-arena-survivor' && e.done.includes('reload')), JSON.stringify(reflexes.slice(0, 3).map((e) => [e.events[0], e.done])));
  await a.bringToFront();
  await a.screenshot({ path: path.join(outDir, '01-a-bridged-to-b.png') });
  await order('stop the bridge');
  check('"stop the bridge" puts A\'s gravity and drone back', Boolean(await until(() => said(/^Unbridged from FIDELITY arena survivor/), 4000))
    && Math.abs((await a.evaluate(() => window.__dev.activeLocomotion().gravityMps2)) - gBefore) < 1e-6
    && Math.abs((await a.evaluate(() => window.__playScene.companionTuning().roundGapS)) - gapBefore) < 1e-9);

  // --- B. the input-audio rung: a game with no telemetry, read from its own audio and the player's keys ---
  // the mirror replays the game's keys into A's own window as untrusted key events: watch for them
  await a.evaluate(() => { window.__mirrorSeen = []; const on = (e) => { if (!e.isTrusted) window.__mirrorSeen.push(`${e.type}:${e.code}`); }; window.addEventListener('keydown', on); window.addEventListener('keyup', on); });
  const walkFrom = await a.evaluate(() => { const p = window.__dev.eye(); return { x: p.x, z: p.z }; });
  await order('bridge some indie');
  check('"bridge some indie" starts the cadence sampler for SomeIndie.exe', Boolean(await until(async () => /\[SAMPLER\].*sampling SomeIndie\.exe \(replay\)/.test(bridgeLog), 6000)));
  // Plan 53 §2.6 (owner, 28 Oct): read only. The player's W in the game walks A's character here, nothing goes into the game
  const mirrored = await until(async () => { const s = await a.evaluate(() => window.__mirrorSeen); return s.includes('keydown:KeyW') && s.includes('keyup:KeyW') ? s : null; }, 8000);
  check('the mirror: the game\'s own W press (read from Windows) walks A here, down then up', Boolean(mirrored), JSON.stringify(await a.evaluate(() => window.__mirrorSeen)));
  const walkTo = await a.evaluate(() => { const p = window.__dev.eye(); return { x: p.x, z: p.z }; });
  check('...the character really moved, and the drone says it mirrors, read only', Math.hypot(walkTo.x - walkFrom.x, walkTo.z - walkFrom.z) > 0.5 && Boolean(await until(() => said(/^I see your presses in SomeIndie, and your character here does the same: read only/), 3000)),
    JSON.stringify({ walkFrom, walkTo }));
  const audio = await until(async () => (await events('mimic-result')).find((e) => e.live === true && e.channel === 'input-audio'), 20000);
  check('the sampler\'s stream becomes a live input-audio mimic', Boolean(audio), JSON.stringify(audio?.fire ?? null));
  const gapAudio = await a.evaluate(() => window.__playScene.companionTuning().roundGapS);
  check('A\'s drone takes the game\'s 6 rounds/s from its audio alone', Math.abs(gapAudio - 1 / 6) < 0.03, `round gap ${gapAudio} s`);
  check('the sampler\'s jump presses reload A\'s weapon live', (await events('reflex')).some((e) => e.gameId === 'someindie' && e.done.includes('reload')));
  await order('stop the bridge');
  check('closing the bridge stops the sampler', Boolean(await until(async () => /\[SAMPLER\].*stopped \(someindie/.test(bridgeLog), 4000)));

  // --- C. Plan 53: a bare "bridge" takes A to the bridge stage, bridges what crosses, stands FIDELITY in for the rest ---
  await a.evaluate(() => window.__dev.setMonstersSetting('calm'));
  const labSpot = await a.evaluate(() => { const p = window.__dev.eye(); return { where: window.__playScene.debug.where(), x: p.x, z: p.z }; });
  const manifestsBefore = (await events('bridge-manifest')).length;
  await order('bridge');
  check('a bare "bridge" says it is on the bridge pad', Boolean(await until(() => said(/^On the bridge pad: an empty stretch of the Moon/), 8000)));
  const pad = await until(() => a.evaluate(() => window.__playScene.bridgePadAt()), 8000);
  await a.waitForTimeout(1500);
  const onPad = await a.evaluate(() => { const p = window.__dev.eye(); return { where: window.__playScene.debug.where(), x: p.x, y: p.y, z: p.z }; });
  check('...on the Moon, standing on the pad\'s deck', pad && onPad.where === 'planet' && Math.hypot(onPad.x - pad.x, onPad.z - pad.z) < 6 && onPad.y - pad.y > 1.2 && onPad.y - pad.y < 2.2,
    JSON.stringify({ pad, onPad }));
  const manifest = await until(async () => (await events('bridge-manifest')).slice(manifestsBefore).find((e) => e.gameId === 'someindie'), 8000);
  const row = (id) => manifest?.aspects?.find((x) => x.id === id);
  check('the manifest names what crosses and what FIDELITY stands in for', row('rules')?.status === 'live' && row('movement')?.status === 'stand-in'
    && row('weapon')?.status === 'stand-in' && /the sidearm/.test(row('weapon')?.via ?? '') && row('characters')?.status === 'stand-in' && row('names')?.status === 'stand-in'
    && row('fire')?.status === 'waiting', JSON.stringify(manifest?.aspects?.map((x) => [x.id, x.status]) ?? null));
  const standIns = await a.evaluate((p) => window.__playScene.monsters.getMobList().filter((m) => Math.hypot(m.pos.x - p.x, m.pos.z - p.z) < 40).length, pad);
  check('FIDELITY monsters stand in for its opponents around the pad', standIns >= 3, `${standIns} near the pad`);
  check('FIDELITY\'s own movement stands in until the game\'s arrives', (await a.evaluate(() => window.__dev.activeLocomotion().id)) === 'stand-in:earth-standard');
  const fireLive = await until(async () => (await events('bridge-manifest')).slice(manifestsBefore).some((e) => e.gameId === 'someindie' && e.aspects.some((x) => x.id === 'fire' && x.status === 'live')), 20000);
  const gun = await a.evaluate(() => window.__playScene.monsters.getWeaponStats());
  check('the game\'s fire, heard from its audio, goes onto FIDELITY\'s stand-in gun, and the manifest turns it live', fireLive && gun && Math.abs(gun.cooldown - 1 / 6) < 0.03,
    `cooldown ${gun?.cooldown}`);
  await a.screenshot({ path: path.join(outDir, '02-bridge-stage.png') });
  await order('stop the bridge');
  await a.waitForTimeout(1200);
  const home = await a.evaluate(() => { const p = window.__dev.eye(); return { where: window.__playScene.debug.where(), x: p.x, z: p.z, pad: window.__playScene.bridgePadAt() }; });
  const leftovers = await a.evaluate((p) => window.__playScene.monsters.getMobList().filter((m) => Math.hypot(m.pos.x - p.x, m.pos.z - p.z) < 40).length, pad);
  check('"stop the bridge" takes A back where it stood, the pad and the stand-ins gone', home.where === labSpot.where && Math.hypot(home.x - labSpot.x, home.z - labSpot.z) < 0.5 && home.pad === null && leftovers === 0,
    JSON.stringify({ labSpot, home, leftovers }));
  // --- D. Plan 53: input goes into a game only where the game allows it (owner, 28 Oct), then by the player's choice ---
  const consoleLines = [];
  const fakeConsole = net.createServer((sock) => { let rest = ''; sock.on('data', (d) => { const parts = (rest + d).split('\n'); rest = parts.pop() ?? ''; consoleLines.push(...parts.filter(Boolean)); }); });
  await new Promise((r) => fakeConsole.listen(8237, '127.0.0.1', r));
  const activeBefore = (await events('bridge-active')).length;
  await order('bridge some indie');
  // a checked profile only applies to the game the player bridged, so it goes once the session is open
  await until(async () => (await events('bridge-active')).length > activeBefore, 10000);
  const indieProfile = (over) => ({
    schema: 'hm2:bridge-profile:v1', gameId: 'someindie', title: 'SomeIndie', verdict: 'limited', channels: [], streams: ['mechanics'], soloOnly: true,
    sources: [{ url: 'https://example.com/someindie-console', quote: 'the console listens on a port you choose' }], checkedBy: 'e2e (playing the checking AI)', setup: [], notes: [],
    inputRelay: { transport: 'console-tcp', port: 8237, launchOption: '-netconport 8237', bindings: { fire: '+attack', use: '+use', jump: '+jump' }, basis: 'single-player, and its developer documents the console for tools.' },
    ...over,
  });
  // first with an anti-cheat declared: nothing goes in, whatever is ticked, and no consent is even offered
  await postCommand({ action: 'bridge-profile', profile: indieProfile({ antiCheat: { system: 'TestGuard', scope: 'online', safeModes: ['offline play'], sources: [] } }) });
  await until(() => said(/^SomeIndie: limited/), 8000);
  await order('relay my input');
  const consent = a.locator('[data-testid="relay-consent"]');
  const refusedSaid = Boolean(await until(() => said(/^SomeIndie runs TestGuard, so nothing is sent into it, whatever is ticked\. Play SomeIndie with your own hands/), 5000));
  check('a game guarded by an anti-cheat gets no relay: the drone says why and offers playing it beside FIDELITY', refusedSaid && (await consent.count()) === 0,
    JSON.stringify({ refusedSaid, consent: await consent.count(), last: (await events('companion-say')).slice(-4).map((e) => e.text.slice(0, 90)) }));
  const guarded = await fetch(`${bridge}/input-relay/arm`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gameId: 'cs2', ticked: true, typed: 'RELAY', transport: 'synthetic-keys', process: 'cs2.exe' }) });
  check('...and the bridge itself refuses CS2 even with the box and the word', guarded.status === 400 && /guarded by an anti-cheat/.test((await guarded.json()).error ?? ''));
  // then the same game with no anti-cheat, whose profile allows input: the player's choice
  const saidBefore = (await events('companion-say')).length;
  await postCommand({ action: 'bridge-profile', profile: indieProfile({}) });
  check('the checking AI\'s profile, with its console relay, applies to the bridged game', Boolean(await until(async () => (await events('companion-say')).slice(saidBefore).some((e) => /^SomeIndie: limited/.test(e.text)), 8000)));
  await order('relay my input');
  check('"relay my input" opens the consent, with why the game allows input', await until(async () => (await consent.count()) > 0, 5000) && /documents the console for tools/.test(await consent.innerText()));
  const onBtn = a.locator('[data-testid="relay-on"]');
  const disabledAtFirst = await onBtn.isDisabled();
  await a.locator('[data-testid="relay-tick"]').check();
  const disabledTickOnly = await onBtn.isDisabled();
  await a.locator('[data-testid="relay-word"]').fill('relay');
  const enabledBoth = !(await onBtn.isDisabled());
  check('it turns on only with the box ticked AND the word typed', disabledAtFirst && disabledTickOnly && enabledBoth, JSON.stringify({ disabledAtFirst, disabledTickOnly, enabledBoth }));
  await onBtn.click();
  check('the drone says the relay is on by the player\'s choice', Boolean(await until(() => said(/^Input relay on for SomeIndie, by your choice/), 5000)));
  const forged = await fetch(`${bridge}/input-relay/press`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gameId: 'someindie', token: 'not-the-players', line: '+attack' }) });
  check('a press without the player\'s token (an AI on the bridge) is refused', forged.status === 400);
  const injected = await fetch(`${bridge}/input-relay/press`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gameId: 'someindie', token: 'x', line: 'quit' }) });
  check('...and so is anything that is not a whitelisted press', injected.status === 400);
  const box = await a.locator('canvas').first().boundingBox();
  if (box) { await a.mouse.move(box.x + box.width / 2, box.y + box.height / 3); await a.mouse.down(); await a.waitForTimeout(150); await a.mouse.up(); }
  check('the player\'s own fire press arrives at the game\'s console as +attack, then -attack', Boolean(await until(() => consoleLines.includes('+attack') && consoleLines.includes('-attack'), 5000)), JSON.stringify(consoleLines));
  await order('stop the relay');
  const offSaid = Boolean(await until(() => said(/^Input relay off\./), 4000));
  const relayState = await until(async () => { const s = await getJson('/input-relay'); return s.armed.length === 0 ? s : null; }, 4000);
  check('"stop the relay" turns it off on the bridge too', offSaid && Boolean(relayState), JSON.stringify(relayState?.armed ?? 'still armed'));
  await order('stop the bridge');
  fakeConsole.close();
  check('no page errors in either tab', pageErrors.length === 0, pageErrors.slice(0, 2).join(' | '));
} catch (e) {
  check('script completed', false, e.message);
} finally {
  try { const ev = (await getJson('/events?after=0')).events; lastEvents = { types: ev.reduce((m, e) => ({ ...m, [e.type]: (m[e.type] ?? 0) + 1 }), {}), refused: ev.filter((e) => e.type === 'mimic-refused').slice(0, 3), windows: ev.filter((e) => e.type === 'cadence-window'), batches: ev.filter((e) => e.type === 'telemetry-batch'), errors: ev.filter((e) => e.type === 'mimic-error'), says: ev.filter((e) => e.type === 'companion-say').map((e) => e.text.slice(0, 110)).slice(-12) }; } catch {}
  await browser.close().catch(() => {});
  server.kill();
  bridgeProc.kill();
  fs.rmSync(tmpDir, { recursive: true, force: true });
}
const failed = results.filter((r) => !r.ok);
if (failed.length && lastEvents) console.log('--- events by type ---', JSON.stringify(lastEvents));
if (failed.length) console.log(`\n--- the bridge's log (tail) ---\n${bridgeLog.slice(-3000)}`);
console.log(`\n${results.length - failed.length}/${results.length} gamebridge checks passed`);
process.exit(failed.length === 0 ? 0 : 1);
