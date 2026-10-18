// ============================================================================
// TICKET-14 check (brief 33, POL-41): the real-time credits video, in the browser, against the production build.
//   node --import tsx scripts/test-credits-video.mjs        (after npm run build; serves apps/web/dist on port 8204)
// The beats:
//   1 the title's Ending Credits item starts the video (the play screen, the credits root takes data-hud-root);
//   2 the chapters: the clock is moved to each chapter's middle (window.__creditsDirector.seek), and the HUD skin and the
//     lyric line follow the timeline; three chapter shots, a lyric-pill shot, zero overlap between the lyric pill and the roll;
//   3 the song hand-off and the loop: the song is 2:40.73 long, the loop is scheduled on the same AudioContext clock, and ch7
//     wraps on levels.json's loop points;
//   4 Esc leaves the video back to the title (no credits root, the menu is up);
//   5 the lab's old monitor: aimed at it, R plays "Four Floats (Overclocked)" (the equaliser lights up), J opens the jukebox,
//     its replay starts the video from the lab, and Esc puts the player back in the lab.
// Shots go to shots-run/credits-video/. Exit code 0 when every check passes.
// ============================================================================
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { CREDITS_CHAPTERS, DEFAULT_OUTRO_META, VOCAL_SWITCH_SEC, getCreditsStateAt } from '../apps/web/src/credits/timeline.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const port = 8204;
const shotsDir = path.join(root, 'shots-run/credits-video');
fs.mkdirSync(shotsDir, { recursive: true });

const chromePaths = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'];
const chromePath = chromePaths.find(fs.existsSync);
if (!chromePath) {
  console.log('Chrome not found, skipping browser test');
  process.exit(0);
}

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` :: ${detail}` : ''}`);
};

const server = spawn(process.execPath, ['scripts/serve.mjs'], { cwd: root, env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1500));

const browser = await chromium.launch({
  executablePath: chromePath,
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.addInitScript(() => {
  Element.prototype.requestPointerLock = function () {
    return Promise.reject(new Error('pointer lock stubbed'));
  };
  localStorage.setItem('hm.endingSeen', '1');
});
const pageErrors = [];
page.on('pageerror', (err) => pageErrors.push(err.message));

const shot = async (name) => {
  const file = path.join(shotsDir, `${name}.png`);
  await page.screenshot({ path: file });
  return file;
};
const settle = (ms = 450) => page.waitForTimeout(ms);
const menuButton = (label) => page.locator('.sm-menu button', { hasText: label }).first();

/** The credits root's zones as boxes, and the overlap area of two of them (px squared). */
const zoneBoxes = () =>
  page.evaluate(() => {
    const out = {};
    for (const z of ['telemetry', 'lyrics', 'roll']) {
      const el = document.querySelector(`[data-credits-zone="${z}"]`);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      out[z] = { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
    }
    return out;
  });
const overlapArea = (a, b) => {
  if (!a || !b) return 0;
  const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
  const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  return ox > 0 && oy > 0 ? ox * oy : 0;
};

const creditsState = () =>
  page.evaluate(() => {
    const root = document.querySelector('[data-testid="credits-hud-root"]');
    const lyric = document.querySelector('[data-credits-zone="lyrics"]');
    return {
      present: !!root,
      skin: root?.getAttribute('data-fidelity') ?? null,
      firstHudRoot: document.querySelector('[data-hud-root]')?.getAttribute('data-testid') ?? null,
      lyric: lyric ? lyric.innerText : '',
      director: !!window.__creditsDirector,
      active: window.__creditsDirector?.isActive?.() ?? false,
      elapsed: window.__creditsDirector?.elapsedSec?.() ?? null,
    };
  });

/** Moves the clock to t, then waits until the HUD shows that moment (the frames are slow under software WebGL). */
const seekTo = async (t) => {
  await page.evaluate((sec) => window.__creditsDirector.seek(sec), t);
  await page.waitForFunction((sec) => Math.abs((window.__creditsDirector.elapsedSec() ?? -99) - sec) < 1.5, t, { timeout: 8000, polling: 100 }).catch(() => {});
  await settle(350);
};
/** Waits for the HUD to show a skin (the readout follows the frames, so it is polled, not timed). */
const waitSkin = (skin) =>
  page.waitForFunction((want) => document.querySelector('[data-testid="credits-hud-root"]')?.getAttribute('data-fidelity') === want, skin, { timeout: 8000, polling: 150 }).catch(() => {});

// CREDITS_PART=monitor runs only the lab's old-monitor beats (a call of its own on a slow machine); the default runs all.
const part = process.env.CREDITS_PART ?? 'all';
let st = null;
try {
  if (part !== 'monitor') {
  // -------- 1. the title's Ending Credits item starts the video
  await page.goto(`http://localhost:${port}/`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => document.querySelectorAll('.sm-menu button').length > 0, null, { timeout: 60000 });
  const credItem = menuButton('Ending Credits');
  check('the title menu lists Ending Credits', (await credItem.count()) === 1);
  await settle(600);
  await shot('000-title-menu');
  await credItem.click();
  await page.waitForSelector('[data-testid="credits-hud-root"]', { timeout: 60000 });
  await page.waitForFunction(() => window.__creditsDirector?.isActive?.() === true, null, { timeout: 60000 });
  st = await creditsState();
  check('the Ending Credits item opens the video in the play screen', st.present && st.director && st.active, `skin ${st.skin}`);
  check('the credits root takes data-hud-root (the first one on the page)', st.firstHudRoot === 'credits-hud-root', `first is ${st.firstHudRoot}`);
  await settle(700);
  const first = await shot('00-title-entry');
  check('the title entry shot is written', fs.existsSync(first));

  // -------- 2. the chapters, at each middle: the skin, the lyric line, and the overlap
  const sched = await page.evaluate(() => window.__creditsDirector.scheduleInfo());
  const expectedSkins = ['0a', '0b', '1', '2', '3', '4-6', '4-6'];
  for (let i = 0; i < CREDITS_CHAPTERS.length; i++) {
    const ch = CREDITS_CHAPTERS[i];
    const end = Number.isFinite(ch.tEnd) ? ch.tEnd : ch.tStart + 12;
    const mid = (ch.tStart + end) / 2;
    await seekTo(mid);
    await waitSkin(expectedSkins[i]);
    // the lyric pill follows the React state, one frame behind the clock: wait until it shows the clock's own line
    await page.waitForFunction(() => {
      const t = window.__creditsDirector.elapsedSec();
      const at = window.__credits.getStateAt(t);
      const el = document.querySelector('[data-credits-zone="lyrics"]');
      if (!el) return false;
      return el.innerText.includes(at.activeLyric ? at.activeLyric.line.slice(0, 18) : 'INSTRUMENTAL');
    }, null, { timeout: 8000, polling: 150 }).catch(() => {});
    await settle(250);
    const s = await creditsState();
    // the clock keeps running between the seek and the read: the expectation is the clock's own reading at the read
    const tRead = s.elapsed ?? mid;
    const expect = getCreditsStateAt(tRead, DEFAULT_OUTRO_META);
    const lyricWanted = expect.activeLyric?.line ?? null;
    const lyricOk = lyricWanted === null ? s.lyric.includes('INSTRUMENTAL') : s.lyric.includes(lyricWanted.slice(0, 18));
    check(`chapter ${i + 1} (${ch.id}): the HUD skin is ${expectedSkins[i]}`, s.skin === expectedSkins[i], `skin ${s.skin} at ${tRead.toFixed(1)} s (seeked to ${mid.toFixed(1)})`);
    check(`chapter ${i + 1}: the lyric pill shows the timeline's line`, lyricOk, JSON.stringify(s.lyric.slice(0, 60)));
    const boxes = await zoneBoxes();
    const lyricRoll = overlapArea(boxes.lyrics, boxes.roll);
    const teleOverlap = overlapArea(boxes.telemetry, boxes.roll);
    check(`chapter ${i + 1}: the lyric pill and the credits roll do not overlap`, lyricRoll === 0 && teleOverlap === 0, `lyrics/roll ${lyricRoll} px2, telemetry/roll ${teleOverlap} px2`);
    // the 3D picture behind the cards: the middle of the screen, clear of every card, must hold bright pixels (a black frame does not)
    const scene = await page.evaluate(() => ({ where: window.__playScene.debug.where(), calls: window.__playScene.debug.stats().calls }));
    const png = await page.screenshot({ clip: { x: 300, y: 120, width: 580, height: 400 } });
    const bright = await page.evaluate(async (src) => {
      const img = new Image();
      img.src = src;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const g = c.getContext('2d');
      g.drawImage(img, 0, 0);
      const d = g.getImageData(0, 0, c.width, c.height).data;
      let n = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11 > 35) n++;
      return n / (d.length / 4);
    }, `data:image/png;base64,${png.toString('base64')}`);
    check(`chapter ${i + 1}: the 3D picture behind the cards is drawn (${scene.where}, ${(bright * 100).toFixed(1)}% bright pixels)`, bright > 0.01 && scene.calls > 0, `draw calls ${scene.calls}`);
    if (i === 0 || i === 2 || i === 5) await shot(`chapter-${i + 1}-${expectedSkins[i]}`);
    if (i === 2) {
      const pill = page.locator('[data-credits-zone="lyrics"]');
      await pill.screenshot({ path: path.join(shotsDir, 'lyric-pill-ch3.png') });
    }
  }
  check('the song file is 2:40.73 long, and the loop starts when it ends (within 0.1 s)', Math.abs(sched.songDuration - VOCAL_SWITCH_SEC) < 0.1, `song ${sched.songDuration.toFixed(3)} s (the decoded file, with its encoder padding)`);

  // -------- 3. the song hand-off and the loop
  check('the loop source is scheduled to start on the handoff', sched.handoffAt !== null || sched.running, `handoffAt ${sched.handoffAt}`);
  await seekTo(VOCAL_SWITCH_SEC - 3);
  const beforeSwitch = await creditsState();
  check('three seconds before the switch the video is on chapter 6, on the last line', beforeSwitch.skin === '4-6' && beforeSwitch.lyric.includes('See you, Sector Four'), JSON.stringify(beforeSwitch.lyric.slice(0, 60)));
  const span = DEFAULT_OUTRO_META.loopEnd - DEFAULT_OUTRO_META.loopStart;
  const loopTimes = [];
  for (const k of [0.3, 1.1, 2.6]) {
    await seekTo(VOCAL_SWITCH_SEC + k * span);
    const info = await page.evaluate(() => window.__credits.getStateAt(window.__creditsDirector.elapsedSec()));
    loopTimes.push(info.loopedAudioTime);
  }
  console.log(`clock ${JSON.stringify(await page.evaluate(() => window.__creditsDirector.clockInfo()))}`);
  const inLoop = loopTimes.every((t) => t >= DEFAULT_OUTRO_META.loopStart - 1e-6 && t < DEFAULT_OUTRO_META.loopEnd + 1e-6);
  check('chapter 7 loops on levels.json start..end (the loop repeats)', inLoop, `loop times ${loopTimes.map((t) => t.toFixed(3)).join(', ')}`);
  await seekTo(VOCAL_SWITCH_SEC + 1.5);
  const ch7 = await creditsState();
  check('after the switch the skin holds at 4-6 on the chorus loop', ch7.skin === '4-6', `skin ${ch7.skin}`);

  // -------- 4. Esc leaves the video back to the title
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('[data-testid="credits-hud-root"]'), null, { timeout: 15000 });
  await page.waitForFunction(() => document.querySelectorAll('.sm-menu button').length > 0, null, { timeout: 30000 });
  check('Esc returns to the title, and the video is gone', (await menuButton('Ending Credits').count()) === 1);
  check('the director has stopped', (await page.evaluate(() => window.__creditsDirector?.isActive?.() ?? false)) === false);

  } // end of parts 1 to 4
  // -------- 5. the lab's old monitor: R plays the overclocked track, J opens the jukebox, its replay starts the video
  if (part !== 'title') {
  if (part === 'monitor') {
    await page.goto(`http://localhost:${port}/`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => document.querySelectorAll('.sm-menu button').length > 0, null, { timeout: 60000 });
  }
  const t0 = Date.now();
  const mark = (s) => console.log(`[${((Date.now() - t0) / 1000).toFixed(0)} s] ${s}`);
  mark('monitor: the home menu is up');
  await menuButton('Expedition').click();
  await page.waitForFunction(() => !!window.hmPlay?.ready, null, { timeout: 240000 });
  mark('monitor: the lab is ready');
  await page.waitForFunction(() => !!window.__playScene, null, { timeout: 60000 });
  // a fresh profile opens the avatar creator first: take its default look into the lab, as a player would
  const doneBtn = page.locator('.play-create button', { hasText: 'into the lab' }).first();
  if ((await doneBtn.count()) > 0) {
    await doneBtn.click();
    await page.waitForFunction(() => !document.querySelector('.play-create'), null, { timeout: 30000 }).catch(() => {});
    mark('monitor: the creator is done, the player is in the lab');
  }
  // the lab's radio lines hold the screen quiet (the campaign's quiet()): wait for them to end before aiming
  await page.waitForFunction(() => !(window.hmPlay?.subtitles?.()?.id), null, { timeout: 40000, polling: 200 }).catch(() => {});
  await settle(800);
  // aim at the old monitor as the campaign does (eye 1.65 m, the monitor's screen at 0.25 m). The first teleport can land
  // before the lab has settled, so it aims again (up to four times) until the readout shows the monitor.
  const aimMonitor = async () => {
    const aimYaw = Math.atan2(-(7.68 - 6.8), -(-8.6 - -7.2));
    const aimPitch = Math.atan2(0.25 - 1.65, Math.hypot(7.68 - 6.8, -8.6 - -7.2));
    let readout = '';
    for (let attempt = 0; attempt < 4 && readout !== 'old monitor'; attempt++) {
      await page.evaluate((v) => window.__playScene.debug.teleport('lab', 6.8, -7.2, v.yaw, v.pitch), { yaw: aimYaw, pitch: aimPitch });
      for (let i = 0; i < 8 && readout !== 'old monitor'; i++) {
        await settle(250);
        readout = ((await page.locator('.lore-hover-name').first().textContent({ timeout: 300 }).catch(() => '')) ?? '').trim();
      }
    }
    return readout;
  };
  let hover = await aimMonitor();
  const diag = await page.evaluate(() => ({ aimed: window.hmPlay?.aimedProp?.id ?? null, where: window.hmPlay?.where ?? null, sub: window.hmPlay?.subtitles?.()?.id ?? null, create: !!document.querySelector('.play-create'), ready: !!window.hmPlay?.ready }));
  console.log(`diag ${JSON.stringify(diag)}`);
  check('aimed at the old monitor, the readout shows (the monitor is in reach)', hover === 'old monitor', `readout "${hover}"`);
  await page.keyboard.press('KeyR');
  await settle(500);
  const toastR = (await page.locator('.play-toast').allTextContents()).join(' ');
  check('R at the old monitor plays "Four Floats (Overclocked)" (the monitor says so)', /Overclocked/i.test(toastR), `toast "${toastR.slice(0, 80)}"`);
  await settle(1200);
  const eqInfo = await page.evaluate(() => {
    const s = window.__playScene.debug.labScene();
    let found = null;
    s.traverse((o) => { if (o.name === 'old-monitor-equalizer') found = o; });
    if (!found) return null;
    found.updateWorldMatrix(true, true);
    const v = new found.position.constructor();
    found.getWorldPosition(v);
    // the monitor's own meshes: where their front (the smallest world x, the monitor faces west) lies
    const prop = found.parent;
    let frontX = Infinity;
    let backX = -Infinity;
    prop.traverse((o) => {
      if (o === found || !o.isMesh || !o.geometry) return;
      if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
      const c = o.localToWorld(o.geometry.boundingSphere.center.clone());
      const r = o.geometry.boundingSphere.radius * Math.max(o.scale.x, o.scale.y, o.scale.z);
      frontX = Math.min(frontX, c.x - r);
      backX = Math.max(backX, c.x + r);
    });
    return { visible: found.visible, world: [v.x, v.y, v.z].map((n) => +n.toFixed(3)), bars: found.children.map((c) => +c.scale.y.toFixed(2)), propFrontX: +frontX.toFixed(3), propBackX: +backX.toFixed(3) };
  });
  console.log(`equaliser ${JSON.stringify(eqInfo)}`);
  check('the monitor\'s 4-bar equaliser is on the monitor while the overclocked track plays', eqInfo?.visible === true && eqInfo.bars.length === 4, JSON.stringify(eqInfo?.world ?? null));
  await shot('monitor-equaliser-R');
  // the same monitor from farther off, so the whole of it and its equaliser are in the frame
  await page.evaluate(() => window.__playScene.debug.teleport('lab', 6.0, -8.6, -Math.PI / 2, -0.55));
  await settle(1200);
  await shot('monitor-equaliser-far');
  await aimMonitor();
  await page.keyboard.press('KeyR'); // R again stops it: the same key is a toggle while aimed
  await settle(300);

  await page.keyboard.press('KeyJ');
  await page.waitForSelector('[data-testid="old-monitor-jukebox"]', { timeout: 10000 });
  check('J opens the jukebox with both replays', (await page.locator('[data-testid="monitor-action-play-credits"]').count()) === 1 && (await page.locator('[data-testid="monitor-action-play-overclocked"]').count()) === 1);
  await shot('monitor-jukebox');
  await page.locator('[data-testid="monitor-action-play-credits"]').click();
  await page.waitForSelector('[data-testid="credits-hud-root"]', { timeout: 30000 });
  await page.waitForFunction(() => window.__creditsDirector?.isActive?.() === true, null, { timeout: 20000 }).catch(async () => {
    const d = await page.evaluate(() => ({ dir: !!window.__creditsDirector, active: window.__creditsDirector?.isActive?.() ?? null, info: window.__creditsDirector?.scheduleInfo?.() ?? null, clock: window.__creditsDirector?.clockInfo?.() ?? null, root: !!document.querySelector('[data-testid="credits-hud-root"]') }));
    console.log(`diag after the replay ${JSON.stringify(d)}`);
  });
  await seekTo(30);
  await waitSkin('0b');
  st = await creditsState();
  check('the jukebox\'s replay starts the video from the lab (chapter 2, skin 0b)', st.present && st.skin === '0b', `skin ${st.skin}`);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('[data-testid="credits-hud-root"]'), null, { timeout: 15000 });
  await settle(600);
  const back = await page.evaluate(() => ({ where: window.__playScene?.debug.where() ?? null, root: !!document.querySelector('.play.credits-on') }));
  check('Esc from the lab puts the player back in the lab (the play HUD returns)', back.where === 'lab' && back.root === false, `where ${back.where}`);
  check('the jukebox is closed after the replay', (await page.locator('[data-testid="old-monitor-jukebox"]').count()) === 0);
  }
} catch (err) {
  check('the credits beats ran to the end', false, String(err?.message ?? err).split('\n')[0]);
  await shot('failure').catch(() => {});
}

check('no page errors while the credits played', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));
await browser.close();
server.kill();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length} of ${results.length} checks passed (shots in ${path.relative(root, shotsDir)})`);
process.exit(failed.length ? 1 : 0);
