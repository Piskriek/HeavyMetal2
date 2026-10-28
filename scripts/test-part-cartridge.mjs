/**
 * TICKET-32, the owner's loop (plans 38 and 39; rulings in ARGO_NOTE_34): in the lab, the preset bench's Parts page prints a fat
 * green chamfered bolt onto a blank (paid in raw vertices and raw pixels), the cartridge goes in the rifle's port, a tap of
 * Apply at one skid bolt of the capacitor bank changes that bolt only, the change survives a reload, and a hold changes every
 * bolt on the bank.
 *   npm run build && node --import tsx scripts/test-part-cartridge.mjs
 * Shots in shots-run/part-cartridge/ (gitignored). Exit code 1 when a check fails.
 */
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const chromePath = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find(fs.existsSync);
if (!chromePath) {
  console.log('Chrome not found, skipping browser test');
  process.exit(0);
}
const root = fileURLToPath(new URL('../', import.meta.url));
const shotsDir = path.join(root, 'shots-run/part-cartridge');
fs.mkdirSync(shotsDir, { recursive: true });

const port = 8199;
const server = spawn(process.execPath, ['scripts/serve.mjs'], { cwd: root, env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ executablePath: chromePath, headless: true, args: ['--ignore-gpu-blocklist', '--enable-gpu'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.addInitScript(() => {
  try {
    if (!sessionStorage.getItem('part-test-booted')) {
      localStorage.clear();
      sessionStorage.setItem('part-test-booted', '1');
    }
  } catch {}
});
const pageErrors = [];
page.on('pageerror', (err) => pageErrors.push(err.message));

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` (${detail})` : ''}`);
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const frames = (n) => page.evaluate((k) => new Promise((res) => { let i = 0; const f = () => (++i >= k ? res() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
// the pack and every store the network reaches (a grant can land in the bridge store; the bill is paid from both)
const stock = (item) => page.evaluate((it) => { const w = window.hmPlay.base.world(); return [w.player, ...w.boxes].reduce((s, b) => s + b.slots.reduce((t, x) => t + (x && x.item === it ? x.n : 0), 0), 0); }, item);
const bolts = () => page.evaluate(() => window.__dev.kitPlaced('capacitor-bank').filter((p) => p.path.startsWith('bolts-')));

const boot = async () => {
  await page.goto(`http://localhost:${port}/?story&e2e`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForSelector('.sm-menu button', { timeout: 45000 });
  await page.locator('.sm-menu button', { hasText: 'Play' }).first().click();
  await page.waitForFunction(() => window.hmPlay?.ready === true && window.__playScene?.room && window.__dev, { timeout: 90000 });
  await page.evaluate(() => {
    [...document.querySelectorAll('.play-create .btns button')].find((b) => b.textContent.startsWith('Done'))?.click();
  });
  await frames(30);
  // the bank is built once its generated can has loaded
  await page.waitForFunction(() => window.__dev.kitPlaced('capacitor-bank').length > 0, { timeout: 30000 });
};

/** Stands beside the capacitor bank and turns until the beam's aim names a skid bolt; returns its path. */
const aimAtSkidBolt = async () => {
  for (const [x, z] of [[-6.2, 1.9], [-6.2, 0.1]]) {
    for (let p = 0; p < 4; p++) {
      for (let y = 0; y < 16; y++) {
        const yaw = (y / 16) * Math.PI * 2, pitch = -0.5 - p * 0.2;
        await page.evaluate(([xx, zz, yy, pp]) => window.__playScene.debug.teleport('lab', xx, zz, yy, pp), [x, z, yaw, pitch]);
        await frames(2); // the camera follows the player on the next frame
        const hit = await page.evaluate(() => window.__dev.aimKitPart());
        if (hit && hit.path.startsWith('bolts-')) return hit;
      }
    }
  }
  return null;
};

try {
  // the first boot makes the profile; the loop runs on High, where the skid bolts (rank 2) are drawn and so can be hit
  await boot();
  await page.evaluate(() => {
    const profile = JSON.parse(localStorage.getItem('hm.profile.v2') || 'null');
    if (profile) localStorage.setItem('hm.profile.v2', JSON.stringify({ ...profile, quality: 'high' }));
  });
  await boot();
  await page.evaluate(() => { window.__dev.powerGate(); window.__dev.seedBlank(); });
  await page.evaluate(() => { window.__dev.grantStock('vtx-rough', 40); window.__dev.grantStock('pxd-mono', 40); });
  await frames(5);
  const vtxBefore = await stock('vtx-rough'), pxdBefore = await stock('pxd-mono');
  check('the player holds raw vertices and raw pixels to print with', vtxBefore >= 5 && pxdBefore >= 5, `vtx ${vtxBefore}, pxd ${pxdBefore}`);

  // ---- the bench's Parts page
  await page.evaluate(() => window.hmPlay.openLabPanel('bench'));
  await page.locator('[data-testid="bench-tab-parts"]').click();
  await page.waitForSelector('[data-testid="bench-parts"]');
  await page.locator('[data-testid="bench-gen-bolt"]').click();
  await page.locator('[data-testid="bench-param-headWidth"]').fill('0.12');
  await page.locator('[data-testid="bench-mat-metal-green"]').click();
  await page.locator('[data-testid="bench-op-chamfer-hard-edges"]').click();
  // previews drive play (the owner, 2026-10-20): a live view of the part, chips with thumbnails, a hover try-on
  check('the Parts page shows a live preview of the part, with its size', await page.locator('[data-testid="part-preview"] canvas').isVisible()
    && /mm/.test((await page.locator('.part-preview figcaption').textContent()) ?? ''));
  const chips = await page.locator('[data-testid^="bench-gen-"]').count();
  const thumbs = await page.waitForFunction((n) => document.querySelectorAll('.bench-parts-gens img').length >= n && document.querySelectorAll('.bench-parts-gens img').length, chips, { timeout: 8000 }).then((h) => h.jsonValue(), () => 0);
  check('every part chip carries a thumbnail', chips >= 7 && thumbs === chips, `${thumbs} of ${chips}`);
  await page.locator('[data-testid="bench-mat-metal-copper"]').hover();
  const trying = await page.locator('[data-testid="part-preview-trying"]').textContent().catch(() => '');
  await page.locator('[data-testid="bench-parts"] h4').first().hover();
  const after = await page.locator('[data-testid="part-preview-trying"]').count();
  check('hovering a material tries it on in the preview; leaving puts it back', /copper/i.test(trying ?? '') && after === 0, `${trying} / ${after}`);
  await page.screenshot({ path: path.join(shotsDir, 'bench-parts.png') });
  check('the bench can print the fat green bolt', await page.locator('[data-testid="bench-print"]').isEnabled());
  await page.locator('[data-testid="bench-print"]').click();
  await frames(5);
  check('printing spends 5 raw vertices and 5 raw pixels (a small fastener)', (await stock('vtx-rough')) === vtxBefore - 5 && (await stock('pxd-mono')) === pxdBefore - 5,
    `vtx ${await stock('vtx-rough')}, pxd ${await stock('pxd-mono')}`);
  await page.evaluate(() => window.__dev.stepLab(25));
  const cart = await page.evaluate(() => window.hmPlay.state().lab.cartridges.find((c) => c.kind === 'part') ?? null);
  check('the bench prints a part cartridge carrying the fat green chamfered bolt', !!cart && cart.part.gen === 'bolt' && cart.part.params.headWidth === 0.12 && cart.part.slotMaterials.metal === 'green' && cart.part.ops[0]?.op === 'chamfer-hard-edges',
    cart ? `${cart.name}: ${JSON.stringify(cart.part.params)}` : 'none');
  await page.evaluate(() => window.hmPlay.openLabPanel(null));

  // ---- into the rifle
  check('the part cartridge loads into the rifle port', await page.evaluate((id) => window.__dev.loadCartridge(id), cart.id));

  // ---- a tap at one skid bolt
  const before = await bolts();
  check('the bank has four skid bolts, all gunmetal', before.length === 4 && before.every((b) => b.material === 'gunmetal'), JSON.stringify(before.map((b) => b.material)));
  const hit = await aimAtSkidBolt();
  check('the beam can aim at a skid bolt', !!hit, hit ? hit.path : 'none');
  await page.screenshot({ path: path.join(shotsDir, 'aimed-bolt.png') });
  const n1 = await page.evaluate(() => window.__dev.applyPart(false));
  await frames(5);
  const afterTap = await bolts();
  const changed = afterTap.filter((b) => b.material === 'green');
  check('a tap changes exactly the bolt it hits', n1 === 1 && changed.length === 1 && changed[0].path === hit.path, JSON.stringify(changed.map((b) => b.path)));
  check('the changed bolt carries the cartridge: fat head, chamfer', changed[0]?.params?.headWidth === 0.12 && changed[0]?.ops?.[0] === 'chamfer-hard-edges', JSON.stringify(changed[0]));
  await page.screenshot({ path: path.join(shotsDir, 'one-green-bolt.png') });

  // ---- the change survives a reload
  await boot();
  const saved = await page.evaluate(() => window.__dev.kitOverrides());
  const reloaded = await bolts();
  check('after a reload the green bolt is still green, the others are not', reloaded.filter((b) => b.material === 'green').map((b) => b.path).join() === hit.path,
    JSON.stringify(Object.keys(saved['capacitor-bank'] ?? {})));

  // ---- a hold changes every bolt of that kind on the bank
  const portAfter = await page.evaluate(() => window.__dev.port());
  check('the part cartridge is still in the rifle port after a reload', portAfter?.part?.gen === 'bolt' && portAfter.part.slotMaterials.metal === 'green', JSON.stringify(portAfter));
  const hit2 = await aimAtSkidBolt();
  const n2 = await page.evaluate(() => window.__dev.applyPart(true));
  await frames(5);
  const all = await bolts();
  check('a hold changes every bolt on the bank', !!hit2 && n2 === 4 && all.every((b) => b.material === 'green'), `${n2} changed; ${JSON.stringify(all.map((b) => b.material))}`);
  await page.screenshot({ path: path.join(shotsDir, 'all-green-bolts.png') });

  // ---- a material cartridge paints a part's skin (plan 39 step 2): a tap one bolt, a hold every bolt that wore the same
  const skinId = 'red_ochre_silt';
  const seeded = await page.evaluate((p) => window.__dev.seedCartridge(p), skinId);
  const skinCart = await page.evaluate((p) => window.hmPlay.state().lab.cartridges.find((c) => c.preset === p)?.id ?? null, skinId);
  check('a written material cartridge loads into the rifle port', seeded && !!skinCart && await page.evaluate((id) => window.__dev.loadCartridge(id), skinCart));
  const skinHit = await aimAtSkidBolt();
  const painted = skinHit ? await page.evaluate(() => window.__dev.applySkin(false)) : 0;
  await frames(5);
  const one = (await page.evaluate(() => window.__dev.kitOverrides()['capacitor-bank'] ?? {}))[skinHit?.path ?? ''];
  check('a tap paints that bolt\'s body with the material, and it keeps its fat chamfered shape', painted === 1 && one?.slotMaterials?.metal === `vault:${skinId}` && one?.params?.headWidth === 0.12,
    JSON.stringify(one));
  await page.screenshot({ path: path.join(shotsDir, 'skin-one-bolt.png') });
  const otherBolt = await (async () => {
    for (const [x, z] of [[-6.2, 1.9], [-6.2, 0.1]]) {
      for (let p = 0; p < 4; p++) for (let y = 0; y < 16; y++) {
        await page.evaluate(([xx, zz, yy, pp]) => window.__playScene.debug.teleport('lab', xx, zz, yy, pp), [x, z, (y / 16) * Math.PI * 2, -0.5 - p * 0.2]);
        await frames(2);
        const hit = await page.evaluate(() => window.__dev.aimKitPart());
        if (hit && hit.path.startsWith('bolts-') && hit.path !== skinHit?.path) return hit;
      }
    }
    return null;
  })();
  const broad = otherBolt ? await page.evaluate(() => window.__dev.applySkin(true)) : 0;
  await frames(5);
  const ov = await page.evaluate(() => window.__dev.kitOverrides()['capacitor-bank'] ?? {});
  const boltOvs = Object.entries(ov).filter(([p]) => p.startsWith('bolts-'));
  check('a hold paints every bolt that wore the same material (the other three green ones)', broad === 3 && boltOvs.length === 4 && boltOvs.every(([, o]) => o.slotMaterials?.metal === `vault:${skinId}`),
    `${broad}: ${JSON.stringify(boltOvs.map(([p, o]) => [p, o.slotMaterials?.metal]))}`);
  await page.screenshot({ path: path.join(shotsDir, 'skin-all-bolts.png') });

  // ---- the planet's Drafting Table prints a part at once (ARGO_NOTE_34 D.1): a blank from the rack, the cost from the stores, into the port
  await page.evaluate(() => { window.__dev.seedBlank(); window.__dev.grantStock('vtx-rough', 40); window.__dev.grantStock('pxd-mono', 40); });
  await page.evaluate(() => { window.hmPlay.teleportPlanet?.(); window.hmPlay.setPaused?.(false); });
  await page.waitForFunction(() => window.hmPlay?.where === 'planet', null, { timeout: 15000 });
  await frames(10);
  const vtxPlanet = await stock('vtx-rough'), pxdPlanet = await stock('pxd-mono');
  await page.evaluate(() => window.__hmHud?.openDrafting?.());
  await page.locator('[data-testid="drafting-tab-parts"]').click();
  await page.waitForSelector('[data-testid="drafting-parts-panel"] [data-testid="bench-parts"]');
  await page.locator('[data-testid="bench-gen-can"]').click();
  await page.locator('[data-testid="bench-mat-body-hazard"]').click();
  await page.screenshot({ path: path.join(shotsDir, 'drafting-parts.png') });
  check('the Drafting Table can print a hazard can', await page.locator('[data-testid="bench-print"]').isEnabled(),
    await page.locator('.hm-draft-parts .play-why').textContent().catch(() => ''));
  await page.locator('[data-testid="bench-print"]').click();
  await frames(5);
  check('the table spends 20 raw vertices and 15 raw pixels (a primary solid)', (await stock('vtx-rough')) === vtxPlanet - 20 && (await stock('pxd-mono')) === pxdPlanet - 15,
    `vtx ${await stock('vtx-rough')}, pxd ${await stock('pxd-mono')}`);
  const tablePort = await page.evaluate(() => window.__dev.port());
  check('the printed can goes straight into the rifle port, and the bolt cartridge back on the rack', tablePort?.part?.gen === 'can' && tablePort.part.slotMaterials.body === 'hazard'
    && (await page.evaluate(() => window.hmPlay.state().lab.cartridges.some((c) => c.kind === 'part' && c.part.gen === 'bolt' && c.slot === null))), JSON.stringify(tablePort));
  check('with no free blank left the table says where to make one', !(await page.locator('[data-testid="bench-print"]').isEnabled())
    && /lab rack/.test((await page.locator('.hm-draft-parts .play-why').textContent().catch(() => '')) ?? ''));
  await page.keyboard.press('Escape');

  // ---- Apply on a planet kit machine (TICKET-39 frames, switched on here: they ship off until TICKET-39b refits them):
  // the printed panel fitted onto a printable part of a heavy mill's frame, saved under the machine's plot kit id
  await page.evaluate(() => { window.__dev.kitFrames(true); window.hmPlay.give?.(2000); window.hmPlay.setStage?.(6); });
  await frames(10);
  let mill = null;
  for (const [x, z] of [[30, 6], [28, -8], [-30, 14], [-26, 20], [24, -20]]) {
    if (await page.evaluate(([px, pz]) => window.hmPlay.placeAt(px, pz, 'heavy-mill'), [x, z])) { mill = [x, z]; break; }
  }
  const millRow = mill ? await page.evaluate(([px, pz]) => window.hmPlay.state().plot.machines.find((m) => m.kind === 'heavy-mill' && Math.abs(m.x - px) < 0.01 && Math.abs(m.z - pz) < 0.01) ?? null, mill) : null;
  const millKit = millRow ? `plot:${millRow.id}@${millRow.built}` : null;
  await frames(20);
  const millParts = async () => (millKit ? await page.evaluate((k) => window.__dev.kitPlaced(k), millKit) : []);
  const millBefore = await millParts();
  check('a heavy mill stands on the plot in its kit frame', !!millKit && millBefore.some((p) => p.path === 'core') && millBefore.some((p) => p.gen !== null), `${millKit}: ${millBefore.length} parts`);
  // walk round the mill until the beam's aim names a part that matches `want`
  const findHit = async (want, pitches = [-0.05, -0.15, 0.05]) => {
    if (!mill) return null;
    for (let i = 0; i < 16; i++) {
      const ang = (i / 16) * Math.PI * 2;
      for (const r of [4.5, 6]) {
        const px = mill[0] + Math.sin(ang) * r, pz = mill[1] + Math.cos(ang) * r;
        const yaw = Math.atan2(px - mill[0], pz - mill[1]);
        for (const pitch of pitches) {
          await page.evaluate(([xx, zz, yy, pp]) => window.__playScene.debug.teleport('planet', xx, zz, yy, pp), [px, pz, yaw, pitch]);
          await frames(2);
          const hit = await page.evaluate(() => window.__dev.aimKitPart());
          if (hit && hit.kit === millKit && want(hit)) return hit;
        }
      }
    }
    return null;
  };
  const other = await findHit((h) => h.gen && h.gen !== 'can', [0.7, 0.55, 0.4, 0.2, -0.3, -0.45]);
  const refused = other ? await page.evaluate(() => window.__dev.applyPart(false)) : -1;
  await frames(5);
  const otherAfter = other ? (await millParts()).find((p) => p.path === other.path) : null;
  check('a can cartridge fired at a part of another kind is refused (like for like)', !!other && refused === 0 && otherAfter?.gen === other.gen,
    other ? `${other.path} (${other.gen}): ${refused}` : 'no other part found');
  const partHit = await findHit((h) => h.gen === 'can');
  check('the beam can aim at a can of the mill frame (a column)', !!partHit, partHit ? partHit.path : 'none');
  await page.screenshot({ path: path.join(shotsDir, 'planet-aimed-part.png') });
  const fitted = partHit ? await page.evaluate(() => window.__dev.applyPart(false)) : 0;
  await frames(10);
  const millAfter = await millParts();
  const hazardParts = millAfter.filter((p) => p.material === 'hazard');
  check('a tap fits the printed hazard can onto that part, and only it', fitted === 1 && hazardParts.length === 1 && hazardParts[0].path === partHit?.path && hazardParts[0].gen === 'can',
    JSON.stringify(hazardParts));
  await page.screenshot({ path: path.join(shotsDir, 'planet-hazard-part.png') });
  // a stage change rebuilds the machine; the fitted part is saved and stays
  await page.evaluate(() => window.hmPlay.setStage?.(5));
  await frames(20);
  const savedPaths = await page.evaluate((k) => Object.keys(window.__dev.kitOverrides()[k] ?? {}), millKit);
  const rebuilt = (await millParts()).filter((p) => p.material === 'hazard');
  check('the fitted part is saved and survives a rebuild', savedPaths.includes(partHit?.path) && rebuilt.length === 1 && rebuilt[0].path === partHit?.path,
    `${JSON.stringify(savedPaths)} ${JSON.stringify(rebuilt.map((p) => p.path))}`);

  check('no page errors', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));
} catch (err) {
  check('the test ran to the end', false, String(err?.stack ?? err).slice(0, 400));
} finally {
  await browser.close();
  server.kill();
}
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed} of ${results.length} part cartridge checks pass`);
process.exit(failed ? 1 : 0);
