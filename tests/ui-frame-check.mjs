/** Viewport regression check for the repeat-safe Heavy Metal GP 2 frame system. */
import { spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtemp, mkdir, readFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { brotliDecompressSync } from 'node:zlib';
import { extname, join, normalize } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { chromium as playwright } from 'playwright-core';
import chromium from '@sparticuz/chromium';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = join(root, 'dist');
const artifacts = join(root, 'tests/artifacts');
const mime = { '.html': 'text/html', '.png': 'image/png', '.jpg': 'image/jpeg' };
if (!existsSync(join(dist, 'index.html'))) throw new Error('Build the app before the UI frame check.');
const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', 'http://localhost');
  const file = join(dist, normalize(url.pathname).replace(/^(\.\.[/\\])+/, ''));
  const target = existsSync(file) && extname(file) ? file : join(dist, 'index.html');
  try { response.writeHead(200, { 'content-type': mime[extname(target)] ?? 'application/octet-stream' }).end(await readFile(target)); }
  catch { response.writeHead(404).end(); }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
await mkdir(artifacts, { recursive: true });
const libraryDir = await mkdtemp(join(tmpdir(), 'hm2-ui-libs-'));
const archive = await readFile(join(root, 'node_modules/@sparticuz/chromium/bin/al2023.tar.br'));
const extraction = spawnSync('tar', ['-xf', '-', '-C', libraryDir], { input: brotliDecompressSync(archive) });
if (extraction.status !== 0) throw new Error('Could not extract browser libraries.');
chromium.setGraphicsMode = false;
const browser = await playwright.launch({
  args: [...chromium.args.filter((arg) => !['--single-process', '--in-process-gpu'].includes(arg)), '--disable-gpu'],
  executablePath: await chromium.executablePath(), headless: true,
  env: { ...process.env, LD_LIBRARY_PATH: `${libraryDir}/lib:${libraryDir}/al2023/lib:${process.env.LD_LIBRARY_PATH ?? ''}`, FONTCONFIG_PATH: join(tmpdir(), 'fonts') },
});

let failures = 0;
const report = (ok, message, detail = '') => { console.log(`${ok ? 'ok' : 'not ok'} - ${message}${detail ? ` :: ${detail}` : ''}`); if (!ok) failures++; };
try {
  for (const viewport of [{ width: 800, height: 600 }, { width: 1920, height: 1080 }, { width: 3840, height: 2160 }]) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${server.address().port}`, { waitUntil: 'load' });
    await page.waitForSelector('.forged-menu-button');
    const menu = await page.evaluate(() => {
      const button = document.querySelector('.forged-menu-button');
      const style = getComputedStyle(button);
      const cap = getComputedStyle(button, '::before');
      return { borderImage: style.borderImageSource, capWidth: cap.width, background: getComputedStyle(document.querySelector('.menu-world')).backgroundSize, overflow: document.documentElement.scrollWidth > innerWidth };
    });
    report(menu.borderImage === 'none', `${viewport.width}×${viewport.height}: menu buttons do not stretch border images`, menu.borderImage);
    report(menu.capWidth === '58px', `${viewport.width}×${viewport.height}: button end-cap stays fixed`, menu.capWidth);
    report(menu.background === 'cover', `${viewport.width}×${viewport.height}: menu painting preserves aspect ratio`, menu.background);
    report(!menu.overflow, `${viewport.width}×${viewport.height}: menu has no horizontal overflow`);

    await page.getByRole('button', { name: 'New Game' }).click();
    await page.waitForSelector('.setup-dialog');
    const frame = await page.evaluate(() => {
      const frame = document.querySelector('.setup-dialog').getBoundingClientRect();
      const corner = getComputedStyle(document.querySelector('.setup-dialog .ornate-corner'));
      return { frame: [frame.left, frame.top, frame.right, frame.bottom], corner: [parseInt(corner.width), parseInt(corner.height)], vw: innerWidth, vh: innerHeight };
    });
    report(frame.frame[0] >= 0 && frame.frame[1] >= 0 && frame.frame[2] <= frame.vw && frame.frame[3] <= frame.vh, `${viewport.width}×${viewport.height}: setup frame remains inside viewport`, frame.frame.join(','));
    const expected = viewport.width <= 700 ? [45, 42] : [56, 52];
    report(frame.corner[0] === expected[0] && frame.corner[1] === expected[1], `${viewport.width}×${viewport.height}: ornate corners stay fixed`, frame.corner.join('×'));
    if (viewport.width !== 1920) await page.screenshot({ path: join(artifacts, `ui-frame-${viewport.width}x${viewport.height}.png`) });
    await context.close();
  }
} finally {
  await browser.close(); server.close(); await rm(libraryDir, { recursive: true, force: true });
}
if (failures) process.exit(1);
