/**
 * Probe (plan 48 follow-up, owner: "only the name tag showed up"): boots the built game, calls the companion 2.2 m in
 * front, and reports what its body is made of and whether the camera can see it: mesh count, visible meshes, world
 * size, distance and on-screen position, plus a clean screenshot (shots-run/companion/probe-body.png).
 *   node scripts/probe-companion-body.mjs
 */
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const outDir = path.join(root, 'shots-run/companion');
fs.mkdirSync(outDir, { recursive: true });
const chromePath = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium']
  .filter(Boolean).find(fs.existsSync);
const port = 8225;
const server = spawn(process.execPath, ['scripts/serve.mjs'], { cwd: root, env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ executablePath: chromePath, headless: true, args: ['--ignore-gpu-blocklist', '--enable-gpu'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.addInitScript(() => {
  Element.prototype.requestPointerLock = function () { return Promise.reject(new Error('stubbed')); };
  try { localStorage.clear(); } catch {}
});
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'warning' || m.type() === 'error') { const t = m.text(); if (/companion|scientist|glb|gltf/i.test(t)) errors.push(`console: ${t}`); } });
const frames = (n) => page.evaluate((k) => new Promise((res) => { let i = 0; const f = () => (++i >= k ? res() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
try {
  await page.goto(`http://localhost:${port}/?story&e2e&bridge=8228`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForSelector('.sm-menu button', { timeout: 45000 });
  await page.locator('.sm-menu button', { hasText: 'Play' }).first().click();
  await page.waitForFunction(() => window.hmPlay?.ready === true && window.__playScene && window.__dev, { timeout: 90000 });
  await page.evaluate(() => { [...document.querySelectorAll('.play-create .btns button')].find((b) => b.textContent.startsWith('Done'))?.click(); });
  await page.waitForFunction(() => Boolean(window.__companion), { timeout: 30000 });
  await frames(30);
  // stand in the open middle of the lab facing the gate, and call the companion in front
  await page.evaluate(() => window.__playScene.debug.teleport('lab', 0, 2.6, 0, 0.25));
  await frames(10);
  await page.evaluate(() => {
    const s = window.hmPlay.pose();
    window.__companion.hoverAt(s.x - Math.sin(s.yaw) * 2.2, s.z - Math.cos(s.yaw) * 2.2);
  });
  await page.waitForFunction(() => window.__companion.getState().state === 'hover', { timeout: 15000 }).catch(() => {});
  await frames(20);
  const report = await page.evaluate(() => {
    const THREE = window.__playScene.THREE;
    const cam = window.__playScene.camera;
    const g = window.__companion.group;
    let meshes = 0, visibleMeshes = 0, skinned = 0, tris = 0;
    const layers = new Set();
    const mats = new Set();
    g.traverse((o) => {
      if (o.isMesh || o.isSkinnedMesh) {
        meshes++;
        if (o.isSkinnedMesh) skinned++;
        let shown = true;
        for (let c = o; c; c = c.parent) if (!c.visible) shown = false;
        if (shown) visibleMeshes++;
        layers.add(o.layers.mask);
        const m = Array.isArray(o.material) ? o.material[0] : o.material;
        if (m) mats.add(`${m.type}:${m.transparent ? 't' : 'o'}:${m.opacity}:${m.visible}`);
        const idx = o.geometry?.index;
        tris += idx ? idx.count / 3 : (o.geometry?.attributes?.position?.count ?? 0) / 3;
      }
    });
    g.updateMatrixWorld(true);
    const box = new THREE.Box3();
    g.traverse((o) => { if ((o.isMesh || o.isSkinnedMesh) && !o.isSprite) box.expandByObject(o); });
    const size = box.getSize(new THREE.Vector3());
    const centre = box.getCenter(new THREE.Vector3());
    const ndc = centre.clone().project(cam);
    return {
      state: window.__companion.getState(),
      parent: g.parent?.type ?? null,
      parentIsLab: g.parent === window.__playScene.labScene,
      groupVisible: g.visible, groupScale: g.scale.toArray(),
      meshes, visibleMeshes, skinned, tris: Math.round(tris), layers: [...layers], cameraMask: cam.layers.mask, mats: [...mats].slice(0, 6),
      size: size.toArray().map((v) => +v.toFixed(2)), centre: centre.toArray().map((v) => +v.toFixed(2)),
      camera: cam.position.toArray().map((v) => +v.toFixed(2)),
      distance: +cam.position.distanceTo(centre).toFixed(2),
      onScreen: { x: +ndc.x.toFixed(2), y: +ndc.y.toFixed(2), inFront: ndc.z < 1 && ndc.z > -1 },
    };
  });
  console.log(JSON.stringify(report, null, 2));
  await page.screenshot({ path: path.join(outDir, 'probe-body.png') });
  // the hips bone and the clips actually driving it, for the companion and (in third person) the player's own avatar
  const rig = () => page.evaluate(() => {
    const out = {};
    const describe = (root) => {
      const hips = root.getObjectByName('mixamorigHips');
      if (!hips) return { hips: null };
      const w = hips.getWorldPosition(new window.__playScene.THREE.Vector3());
      const chain = [];
      for (let c = hips.parent; c && c !== root.parent; c = c.parent) chain.push(`${c.name || c.type}:${c.scale.x.toFixed(3)}`);
      return { hipsLocal: hips.position.toArray().map((v) => +v.toFixed(3)), hipsWorld: w.toArray().map((v) => +v.toFixed(2)), parentScales: chain.slice(0, 5), astroClips: Boolean(root.userData?.astroClips) };
    };
    out.companion = describe(window.__companion.group.children.find((c) => c.getObjectByName('mixamorigHips')) ?? window.__companion.group);
    const lab = window.__playScene.labScene;
    const holders = lab.children.filter((c) => c !== window.__companion.group && c.getObjectByName && c.getObjectByName('mixamorigHips'));
    out.player = holders.length ? { visible: holders[0].visible, ...describe(holders[0].children.find((c) => c.getObjectByName('mixamorigHips')) ?? holders[0]) } : null;
    return out;
  });
  console.log('rig (first person):', JSON.stringify(await rig(), null, 2));
  // which clips the Astro GLB carries, and which actions drive the hips now (with their hips height)
  console.log('clips:', JSON.stringify(await page.evaluate(() => {
    const root = window.__companion.group.children.find((c) => c.userData?.astroClips);
    const own = (root?.userData.astroClips ?? []).map((c) => c.name);
    const mixer = root?.userData.__mixer;
    const hipsY = (clip) => {
      const t = clip.tracks.find((tr) => /Hips\.position$/.test(tr.name));
      return t ? +t.values[1].toFixed(3) : null;
    };
    return { own, ownHipsY: (root?.userData.astroClips ?? []).map((c) => [c.name, hipsY(c)]), hasMixer: Boolean(mixer) };
  }), null, 1));
  await page.evaluate(() => window.__playScene.debug.teleport('lab', 3.5, -4.5, 0, -0.1));
  await frames(10);
  await page.keyboard.press('KeyV');
  await frames(30);
  console.log('rig (after V, third person):', JSON.stringify(await rig(), null, 2));
  await page.screenshot({ path: path.join(outDir, 'probe-third-person.png') });
  console.log('errors:', errors.slice(0, 6));
} catch (e) {
  console.log('probe failed:', e.message);
} finally {
  await browser.close().catch(() => {});
  server.kill();
}
