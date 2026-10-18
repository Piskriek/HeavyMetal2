// ============================================================================
// Plan 36, Phase 1 check (RUN build): a friend's outpost, live, by room code, in the browser.
//   node --import tsx scripts/test-coop-outpost.mjs
// It starts `vite --mode run` (the RUN multiplayer plugin's local room server listens on port 9001 beside it), opens two pages,
// has the first host an outpost room, has the second join it by the room code, builds in both, and compares their world hashes
// through the console hook window.__outpost. Screenshots go to shots-run/coop-outpost/ (gitignored).
// If the RUN SDK cannot reach the local room server from a plain browser, the check fails with the SDK's own message: the
// node convergence test (apps/web/src/rooms/outpost-convergence.test.ts) is the acceptance until then.
// Window B (TICKET-11, co-op Phase 2) runs on the play screen, in the session: the guest sees the host's sculpt and the host's
// avatar, the plot's height matches plotHeightAt at 50 points (the gate's pad included), and neither screen sends the room a local
// tick (the room's 1 Hz tick is the only one). The wire is read through a WebSocket hook, with a positive control on the poses.
// ============================================================================
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { STARTER } from '../apps/web/src/base/catalog.ts';
import { OUTPOST_PLOT_SEED, plotHeightAt } from '../apps/web/src/base/plot-height.ts';

/** Counts what each page sends on its WebSocket (test only): local ticks, beam intents and poses. */
const WIRE_HOOK = `(() => {
  window.__wire = { frames: 0, binary: 0, tick: 0, beamIntent: 0, pose: 0, sample: [] };
  const send = WebSocket.prototype.send;
  const decoder = new TextDecoder();
  WebSocket.prototype.send = function (data) {
    let text = typeof data === 'string' ? data : '';
    window.__wire.frames += 1;
    if (typeof data !== 'string') {
      window.__wire.binary += 1;
      if (data instanceof ArrayBuffer) text = decoder.decode(data);
      else if (ArrayBuffer.isView(data)) text = decoder.decode(data);
    }
    if (window.__wire.sample.length < 3 && text) window.__wire.sample.push(text.slice(0, 160));
    if (/\\\\?"t\\\\?"\\s*:\\s*\\\\?"tick\\\\?"/.test(text)) window.__wire.tick += 1;
    if (/"msgType"\\s*:\\s*"beamIntent"/.test(text)) window.__wire.beamIntent += 1;
    if (/"msgType"\\s*:\\s*"pose"/.test(text)) window.__wire.pose += 1;
    return send.call(this, data);
  };
})();`;

/** A digest of the play screen's sculpt text (length and a rolling hash): the same plot gives the same digest on both pages. */
const sculptDigest = () => {
  const s = window.__playScene.beamFieldText();
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
  return `${s.length}:${h}`;
};

/** The plot's heights at 50 points, with the gate's pose and the sculpt text: 25 on the footing pad, 24 across the plot, 1 in the carve. */
const sampleHeights = () => {
  const s = window.__playScene;
  const g = s.gatePose();
  const c = Math.cos(g.yaw);
  const sn = Math.sin(g.yaw);
  const pts = [];
  for (let i = 0; i < 25; i++) {
    const lx = ((i % 5) - 2) * 0.8;
    const lz = (Math.floor(i / 5) - 2) * 0.5;
    pts.push([g.x + c * lx + sn * lz, g.z - sn * lx + c * lz]);
  }
  let seed = 20261018;
  const rnd = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < 24; i++) pts.push([(rnd() - 0.5) * 120, (rnd() - 0.5) * 120]);
  pts.push([-8, -6]);
  return { gate: g, pts, heights: pts.map(([x, z]) => s.heightAt(x, z)), sculpt: s.beamFieldText() };
};

const chromePaths = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'];
const chromePath = chromePaths.find((p) => fs.existsSync(p));
if (!chromePath) {
  console.error('FAIL: Chrome not found');
  process.exit(1);
}

const root = fileURLToPath(new URL('../', import.meta.url));
const web = path.join(root, 'apps/web');
const shots = path.join(root, 'shots-run/coop-outpost');
fs.mkdirSync(shots, { recursive: true });
const port = 5187;
const slow = Math.max(1, Number(process.env.E2E_SLOW) || 1);
const T = (ms) => Math.round(ms * slow);

const results = [];
const check = (label, ok, detail) => {
  results.push({ label, ok });
  const tail = detail === undefined ? '' : ` ${JSON.stringify(detail)}`;
  console.log(`${ok ? 'OK  ' : 'FAIL'}: ${label}${tail}`);
};

/** Resolves once something listens on the port, or rejects after the time runs out. */
function waitForPort(p, timeoutMs) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const probe = () => {
      const socket = net.connect(p, '127.0.0.1');
      socket.once('connect', () => {
        socket.destroy();
        resolve();
      });
      socket.once('error', () => {
        socket.destroy();
        if (Date.now() - started > timeoutMs) reject(new Error(`nothing listened on ${p}`));
        else setTimeout(probe, 500);
      });
    };
    probe();
  });
}

/** A seeded generator, so the random builds are the same on every run. */
function generator(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

const vite = spawn(process.execPath, [path.join(root, 'node_modules/vite/bin/vite.js'), '--mode', 'run', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
  cwd: web,
  stdio: ['ignore', 'pipe', 'pipe'],
});
let viteLog = '';
vite.stdout.on('data', (d) => { viteLog += d; });
vite.stderr.on('data', (d) => { viteLog += d; });

let browser = null;
let exitCode = 0;
try {
  await waitForPort(port, T(180000));
  browser = await chromium.launch({ executablePath: chromePath, headless: true, args: ['--ignore-gpu-blocklist', '--enable-gpu'] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await context.addInitScript(WIRE_HOOK);
  const host = await context.newPage();
  const guest = await context.newPage();
  const pageErrors = [];
  const consoleErrors = [];
  for (const page of [host, guest]) {
    page.on('pageerror', (err) => pageErrors.push(String(err.message ?? err)));
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 300));
    });
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load' });
    await page.waitForFunction(() => typeof window.__outpost === 'object', null, { timeout: T(120000) });
  }

  // the host opens the room; the code is the six characters a friend types
  let code = null;
  try {
    code = await host.evaluate(() => window.__outpost.host());
  } catch (err) {
    check('the host opens an outpost room', false, String(err?.message ?? err));
  }
  check('the host gets a 6-character room code', typeof code === 'string' && /^[A-Z0-9]{6}$/.test(code), code);

  if (typeof code === 'string') {
    const joined = await guest.evaluate((c) => window.__outpost.join(c), code);
    check('a friend joins by the room code', joined === code, joined);

    // the host grants stock and places the shelter (free), then both build
    await host.evaluate(() => window.__outpost.send({ t: 'grant', stock: [{ item: 'ore', n: 2000 }, { item: 'prim-cube', n: 120 }, { item: 'map-basalt', n: 120 }] }));
    await host.evaluate(() => window.__outpost.send({ t: 'shelter', cx: 8, cz: 8, yaw: 0 }));
    await host.waitForFunction(() => { const s = window.__outpost.state(); return s !== null && s.structure !== null; }, null, { timeout: T(15000) }).catch(() => null);
    const structure = await host.evaluate(() => window.__outpost.state()?.structure ?? null);
    check('the shelter stands in the shared base', typeof structure === 'number', structure);

    const kinds = ['foundation', 'floor', 'wall', 'bench'];
    const rand = generator(20261017);
    let hostBuilt = 0;
    let guestBuilt = 0;
    for (let attempt = 0; attempt < 300 && (hostBuilt < 8 || guestBuilt < 8); attempt++) {
      const cmd = () => ({
        t: 'place',
        at: { x: 8, z: 8 },
        blueprint: STARTER,
        piece: { s: structure, kind: kinds[Math.floor(rand() * kinds.length)], i: Math.floor(rand() * 7) - 3, j: Math.floor(rand() * 7) - 3, k: 0, r: rand() < 0.5 ? 0 : 1 },
      });
      if (hostBuilt < 8) {
        const r = await host.evaluate((c) => window.__outpost.send(c), cmd());
        if (r && !r.refused) hostBuilt += 1;
      }
      if (guestBuilt < 8) {
        const r = await guest.evaluate((c) => window.__outpost.send(c), cmd());
        if (r && !r.refused) guestBuilt += 1;
      }
    }
    check('the host makes 8 valid builds', hostBuilt === 8, hostBuilt);
    check('the friend makes 8 valid builds', guestBuilt === 8, guestBuilt);

    // both pages settle on the room's world
    let hostState = null;
    let guestState = null;
    const settled = await host.waitForFunction(() => { const a = window.__outpost.state(); return a !== null && a.version > 0; }, null, { timeout: T(20000) }).then(() => true).catch(() => false);
    for (let i = 0; i < 60; i++) {
      hostState = await host.evaluate(() => window.__outpost.state());
      guestState = await guest.evaluate(() => window.__outpost.state());
      if (hostState && guestState && hostState.version === guestState.version && hostState.hash === guestState.hash) break;
      await host.waitForTimeout(T(250));
    }
    check('the room has recorded the builds', settled && hostState !== null && hostState.version > 0, hostState?.version);
    check('both players show two people in the room', hostState?.roles.length === 2 && guestState?.roles.length === 2, [hostState?.roles, guestState?.roles]);
    check('both worlds end on the same hash', hostState !== null && guestState !== null && hostState.hash === guestState.hash && hostState.version === guestState.version, {
      host: hostState?.hash?.slice(0, 12),
      guest: guestState?.hash?.slice(0, 12),
      version: [hostState?.version, guestState?.version],
    });

    // the Planetary Grid's card on both pages: the host sees the room code, the friend sees the roster and a code in Visit joins live
    for (const page of [host, guest]) {
      await page.locator('.sm-menu button', { hasText: 'Planetary Grid' }).first().click();
      await page.waitForSelector('[data-testid="planetary-grid-screen"]', { timeout: T(20000) });
    }
    const codeShown = await host.locator('[data-testid="pg-coop-code"]').innerText().catch(() => '');
    check('the host grid shows the room code', codeShown.includes(code), codeShown.trim());
    await guest.locator('[data-testid="pg-roster-chip"]').first().waitFor({ timeout: T(15000) }).catch(() => null);
    const chips = await guest.locator('[data-testid="pg-roster-chip"]').count();
    check('the friend grid lists both players', chips === 2, chips);
    await guest.fill('[data-testid="pg-visit-input"]', code);
    await guest.waitForFunction(() => !(document.querySelector('[data-testid="pg-visit-status"]')?.textContent ?? '').includes('Checking'), null, { timeout: T(15000) }).catch(() => null);
    const visitStatus = (await guest.locator('[data-testid="pg-visit-status"]').innerText()).trim();
    check('a room code in Visit is taken as a live join', visitStatus.includes('joins the outpost live'), visitStatus);
    await host.screenshot({ path: path.join(shots, 'grid-host-card.png') });
    await guest.screenshot({ path: path.join(shots, 'grid-guest-card.png') });

    // Window B (TICKET-11, co-op Phase 2): both pages go from the Grid to their play screens, inside the session
    const toPlay = async (page) => {
      await page.locator('.pg-back-btn').first().click({ timeout: T(15000) });
      await page.locator('.sm-menu button').first().waitFor({ timeout: T(20000) });
      const labels = await page.locator('.sm-menu button').allTextContents();
      const want = labels.some((l) => l.includes('Continue')) ? 'Continue' : 'Expedition';
      await page.locator('.sm-menu button', { hasText: want }).first().click();
      await page.waitForFunction(() => typeof window.__playScene === 'object' && window.__playScene !== null && typeof window.__playScene.playerPose === 'function', null, { timeout: T(120000) });
      // a new profile is asked who it is first ("Who are you?"): the default look is kept, so the lab (and the plot) can be seen
      const done = page.locator('button', { hasText: 'Done: into the lab' }).first();
      await done.waitFor({ state: 'visible', timeout: T(8000) }).then(() => done.click()).catch(() => null);
    };
    const toGrid = async (page) => {
      // Esc opens the pause menu (it closes whatever is open first, so it may take two presses); its "Back to FIDELITY" leaves play
      const back = page.locator('button', { hasText: 'Back to FIDELITY' }).first();
      for (let press = 0; press < 3 && !(await back.isVisible().catch(() => false)); press++) {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(T(400));
      }
      // the pause menu runs past the bottom of the window, so the button is clicked in the DOM (a pointer click would miss it)
      await back.waitFor({ state: 'attached', timeout: T(15000) });
      await back.evaluate((el) => el.click());
      await page.locator('.sm-menu button', { hasText: 'Planetary Grid' }).first().click({ timeout: T(20000) });
      await page.waitForSelector('[data-testid="planetary-grid-screen"]', { timeout: T(20000) });
    };
    try {
      for (const page of [host, guest]) await toPlay(page);
      const made = await Promise.all([host, guest].map((page) => page.waitForFunction(() => window.__playScene.beamFieldReady() === true, null, { timeout: T(120000) }).then(() => true).catch(() => false)));
      check('both play screens open in the session, with the plot made', made.every(Boolean), made);

      // the host stands 5 m from the friend, both on the plot away from the base; the host carves, and leaving the page writes the save
      // and sends the room the sculpt (the page-leave event is the one the play screen flushes its beam save on)
      const hostSpot = { x: -14, z: 16, yaw: Math.PI, pitch: -0.1 };
      const guestSpot = { x: -14, z: 21, yaw: 0, pitch: -0.1 };
      await host.evaluate((v) => window.__playScene.debug.teleport('planet', v.x, v.z, v.yaw, v.pitch), hostSpot);
      await guest.evaluate((v) => window.__playScene.debug.teleport('planet', v.x, v.z, v.yaw, v.pitch), guestSpot);
      const carved = await host.evaluate(() => {
        for (let i = 0; i < 8; i++) window.__playScene.beamSculpt(-8, -6, 'carve', 0.5, 50);
        return window.__playScene.debug.sculptedCells();
      });
      await host.evaluate(() => window.dispatchEvent(new Event('pagehide')));
      check('the host carves the plot', carved > 0, carved);
      const hostDigest = await host.evaluate(sculptDigest);
      let guestDigest = '';
      for (let i = 0; i < 60; i++) {
        guestDigest = await guest.evaluate(sculptDigest);
        if (guestDigest === hostDigest) break;
        await host.waitForTimeout(T(250));
      }
      check('the friend sees the host\'s sculpt on the plot', hostDigest !== '0:0' && guestDigest === hostDigest, { host: hostDigest, guest: guestDigest });

      let avatars = { host: 0, guest: 0 };
      for (let i = 0; i < 40; i++) {
        avatars = { host: await host.evaluate(() => window.__playScene.debug.remotePeers()), guest: await guest.evaluate(() => window.__playScene.debug.remotePeers()) };
        if (avatars.host >= 1 && avatars.guest >= 1) break;
        await host.waitForTimeout(T(250));
      }
      check('each player sees the other as an avatar on the plot', avatars.host >= 1 && avatars.guest >= 1, avatars);

      // no local ticks in the session: the wire counts what each page sends for three seconds (poses are the positive control)
      for (const page of [host, guest]) await page.evaluate(() => { window.__wire.tick = 0; window.__wire.pose = 0; window.__wire.beamIntent = 0; });
      await host.waitForTimeout(T(3000));
      const wire = { host: await host.evaluate(() => window.__wire), guest: await guest.evaluate(() => window.__wire) };
      check('neither play screen ticks the world locally in the session (the room\'s 1 Hz tick is the only one)', wire.host.tick === 0 && wire.guest.tick === 0, { host: wire.host.tick, guest: wire.guest.tick, beamIntentFrames: [wire.host.beamIntent, wire.guest.beamIntent] });
      check('the poses reach the wire, so the tick count above is a real count', wire.host.pose > 0 && wire.guest.pose > 0, {
        host: wire.host.pose,
        guest: wire.guest.pose,
        frames: [wire.host.frames, wire.guest.frames],
        binary: [wire.host.binary, wire.guest.binary],
        sample: wire.host.sample,
      });

      // the plot's height: the scene and plotHeightAt (the room's and the clients' function) at 50 points, the pad's 25 included
      const worstOf = (sample) => {
        const at = plotHeightAt({ seed: OUTPOST_PLOT_SEED, sculpt: sample.sculpt, gate: sample.gate });
        let worst = 0;
        let padWorst = 0;
        sample.pts.forEach(([x, z], i) => {
          const d = Math.abs(at(x, z) - sample.heights[i]);
          worst = Math.max(worst, d);
          if (i < 25) padWorst = Math.max(padWorst, d);
        });
        return { points: sample.pts.length, worst, padWorst };
      };
      const hostSample = await host.evaluate(sampleHeights);
      const guestSample = await guest.evaluate(sampleHeights);
      const hostHeights = worstOf(hostSample);
      const guestHeights = worstOf(guestSample);
      check('the plot height matches plotHeightAt at 50 points on both pages, the gate pad included', hostHeights.points === 50 && guestHeights.points === 50 && hostHeights.worst < 1e-6 && guestHeights.worst < 1e-6, {
        host: hostHeights,
        guest: guestHeights,
        gate: hostSample.gate,
      });

      // the shots: the friend steps to 4 m in front of the host, so the avatar reads in the first person view (the own body is not drawn
      // there); each page shows the other player's avatar
      await guest.evaluate((v) => window.__playScene.debug.teleport('planet', v.x, v.z, v.yaw, v.pitch), { x: -14, z: 20, yaw: 0, pitch: -0.1 });
      await host.waitForTimeout(T(2000));
      await host.screenshot({ path: path.join(shots, 'play-host-avatar.png') });
      await guest.screenshot({ path: path.join(shots, 'play-guest-avatar.png') });
      // the friend steps 4 m to the side: the avatar moves in the host's view, so the figure in the shot is the friend and not the plot
      await guest.evaluate((v) => window.__playScene.debug.teleport('planet', v.x, v.z, v.yaw, v.pitch), { x: -10, z: 20, yaw: 0, pitch: -0.1 });
      await host.waitForTimeout(T(2000));
      await host.screenshot({ path: path.join(shots, 'play-host-avatar-moved.png') });
      for (const page of [host, guest]) await toGrid(page);
    } catch (err) {
      // a failed play screen is said with the page's own errors and a shot of each page, then the Grid checks go on
      check('the play screens run in the session', false, { error: String(err?.message ?? err).slice(0, 240), pageErrors: pageErrors.slice(0, 3), consoleErrors: consoleErrors.slice(0, 5) });
      for (const [name, page] of [['host', host], ['guest', guest]]) {
        await page.screenshot({ path: path.join(shots, `play-failed-${name}.png`) }).catch(() => null);
      }
      for (const page of [host, guest]) await toGrid(page).catch(() => null);
    }

    // Lead Architect controls on the host's Grid: Demote, a Field Observer's build refused, Promote, Undo, the default
    // guest role, and Kick. The friend is the only non-self roster chip, so its buttons are the first on the page.
    const roleOf = (page) => page.evaluate(() => window.__outpost.state()?.roles ?? []);
    const friendToggle = host.locator('[data-testid^="pg-role-toggle-"]').first();
    const hasToggle = await friendToggle.waitFor({ timeout: T(15000) }).then(() => true).catch(() => false);
    check('the Lead Architect sees Demote beside the friend on the Grid', hasToggle && (await friendToggle.innerText()).trim() === 'Demote', hasToggle ? (await friendToggle.innerText()).trim() : null);
    if (hasToggle) {
      await friendToggle.click();
      await host.waitForFunction(() => (window.__outpost.state()?.roles ?? []).includes('visitor'), null, { timeout: T(15000) }).catch(() => null);
      await guest.waitForFunction(() => (window.__outpost.state()?.roles ?? []).includes('visitor'), null, { timeout: T(15000) }).catch(() => null);
      check('Demote makes the friend a Field Observer on both pages', (await roleOf(host)).includes('visitor') && (await roleOf(guest)).includes('visitor'), [await roleOf(host), await roleOf(guest)]);

      const versionBeforeRefusal = (await host.evaluate(() => window.__outpost.state()?.version)) ?? -1;
      const refusal = await guest.evaluate((c) => window.__outpost.send(c), {
        t: 'place',
        at: { x: 8, z: 8 },
        blueprint: STARTER,
        piece: { s: structure, kind: 'foundation', i: 2, j: -2, k: 0, r: 0 },
      });
      await host.waitForTimeout(T(500));
      const versionAfterRefusal = (await host.evaluate(() => window.__outpost.state()?.version)) ?? -2;
      check("a Field Observer's build is refused", refusal?.refused === true && refusal.why === 'visitor-read-only' && versionAfterRefusal === versionBeforeRefusal, refusal);

      await friendToggle.click();
      await host.waitForFunction(() => !(window.__outpost.state()?.roles ?? []).includes('visitor'), null, { timeout: T(15000) }).catch(() => null);
      await guest.waitForFunction(() => !(window.__outpost.state()?.roles ?? []).includes('visitor'), null, { timeout: T(15000) }).catch(() => null);
      check('Promote gives the friend Co-Builder back on both pages', !(await roleOf(host)).includes('visitor') && !(await roleOf(guest)).includes('visitor'), [await roleOf(host), await roleOf(guest)]);

      const undoButton = host.locator('[data-testid^="pg-undo-"]').first();
      const versionBeforeUndo = (await host.evaluate(() => window.__outpost.state()?.version)) ?? 0;
      await undoButton.click();
      await host.waitForFunction((v) => (window.__outpost.state()?.version ?? 0) > v, versionBeforeUndo, { timeout: T(15000) }).catch(() => null);
      const afterUndo = await host.evaluate(() => window.__outpost.state());
      check("Undo reverts the friend's last build on the room", (afterUndo?.version ?? 0) > versionBeforeUndo, [versionBeforeUndo, afterUndo?.version]);

      const defaultRow = host.locator('[data-testid="pg-default-role-row"]');
      check('the Grid states the default role for new joiners', (await defaultRow.count()) === 1 && (await defaultRow.innerText()).includes('Co-Builder'), await defaultRow.innerText().catch(() => null));
      await host.locator('[data-testid="pg-default-role-toggle"]').click();
      await defaultRow.filter({ hasText: 'Field Observer' }).waitFor({ timeout: T(15000) }).catch(() => null);
      check('the default role changes to Field Observer', (await defaultRow.innerText()).includes('Field Observer'), (await defaultRow.innerText()).trim());
      await host.locator('[data-testid="pg-default-role-toggle"]').click();
      await defaultRow.filter({ hasText: 'Co-Builder' }).waitFor({ timeout: T(15000) }).catch(() => null);

      await host.locator('[data-testid^="pg-roster-chip"]').first().scrollIntoViewIfNeeded().catch(() => null);
      await host.screenshot({ path: path.join(shots, 'grid-host-roster.png') });

      await host.locator('[data-testid^="pg-kick-"]').first().click();
      await host.waitForFunction(() => (window.__outpost.state()?.roles ?? []).length === 1, null, { timeout: T(15000) }).catch(() => null);
      check('Kick removes the friend from the room', (await roleOf(host)).length === 1, await roleOf(host));
      await guest.waitForFunction(() => { const s = window.__outpost.state(); return s === null || s.connection === 'disconnected'; }, null, { timeout: T(15000) }).catch(() => null);
      const kickedState = await guest.evaluate(() => window.__outpost.state());
      check('the kicked friend is disconnected', kickedState === null || kickedState.connection === 'disconnected', kickedState?.connection ?? null);
    }

    await host.screenshot({ path: path.join(shots, 'host.png') });
    await guest.screenshot({ path: path.join(shots, 'guest.png') });
  }

  check('no page errors', pageErrors.length === 0, pageErrors.slice(0, 3));
} catch (err) {
  check('the check ran', false, String(err?.message ?? err));
} finally {
  if (browser) await browser.close();
  vite.kill();
  if (results.some((r) => !r.ok)) {
    exitCode = 1;
    fs.writeFileSync(path.join(shots, 'vite.log'), viteLog);
  }
}
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed} of ${results.length} checks passed`);
process.exit(exitCode);
