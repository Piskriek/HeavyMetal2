/**
 * Renders goblins from the real creator UI (dist build) into a labelled contact sheet, for the
 * art-round verification loop. Each entry is pasted as a DNA into the Goblin Creator and the
 * stage is screenshotted at 400² with the rig guides on.
 *
 *   npm run build && node --import tsx scripts/goblin-sheet.mjs <spec.mjs> <out.png> [tilesDir]
 *
 * The spec module exports `entries = [{ label: string, config: GoblinAvatarConfig }]`.
 * A montage of all tiles is written to <out.png> (ImageMagick). Tiles also land in tilesDir
 * (default <out>-tiles/) — they are scratch, not committed.
 */
import { spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtemp, mkdir, readFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { brotliDecompressSync } from 'node:zlib';
import { extname, join, normalize, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';
import chromiumBundle from '@sparticuz/chromium';
import { encodeGoblinDna } from '../src/game/meta/goblin-dna.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = join(root, 'dist');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' };

const specPath = resolve(process.argv[2] ?? '');
const out = resolve(process.argv[3] ?? join(root, 'docs/art-rounds/sheet.png'));
const tilesDir = resolve(process.argv[4] ?? out.replace(/\.png$/, '-tiles'));
if (!existsSync(specPath)) { console.error(`spec not found: ${specPath}`); process.exit(2); }
if (!existsSync(join(dist, 'index.html'))) { console.error('dist/index.html is missing. Run `npm run build` first.'); process.exit(1); }
const { entries } = await import(pathToFileURL(specPath).href);
if (!Array.isArray(entries) || !entries.length) { console.error('spec must export a non-empty `entries` array'); process.exit(2); }

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', 'http://localhost');
  const file = join(dist, normalize(url.pathname).replace(/^(\.\.[/\\])+/, ''));
  const target = existsSync(file) && extname(file) ? file : join(dist, 'index.html');
  try {
    const body = await readFile(target);
    response.writeHead(200, { 'content-type': MIME[extname(target)] ?? 'application/octet-stream' });
    response.end(body);
  } catch { response.writeHead(404).end('not found'); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const baseUrl = `http://127.0.0.1:${server.address().port}`;

await mkdir(tilesDir, { recursive: true });
const libraryDir = await mkdtemp(join(tmpdir(), 'goblin-sheet-libs-'));
const archive = await readFile(join(root, 'node_modules/@sparticuz/chromium/bin/al2023.tar.br'));
const extraction = spawnSync('tar', ['-xf', '-', '-C', libraryDir], { input: brotliDecompressSync(archive) });
if (extraction.status !== 0) throw new Error('Could not extract the bundled browser libraries.');
chromiumBundle.setGraphicsMode = false;
const browser = await chromium.launch({
  args: [...chromiumBundle.args.filter((arg) => !['--single-process', '--in-process-gpu'].includes(arg)), '--disable-gpu'],
  executablePath: await chromiumBundle.executablePath(),
  headless: true,
  env: { ...process.env, LD_LIBRARY_PATH: `${libraryDir}/lib:${libraryDir}/al2023/lib:${process.env.LD_LIBRARY_PATH ?? ''}`, FONTCONFIG_PATH: join(tmpdir(), 'fonts') },
});

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addStyleTag({ content: '.mirror-note{display:none !important}' });
  await page.goto(baseUrl, { waitUntil: 'load' });
  await page.waitForSelector('main.main-menu', { timeout: 20000 });
  await page.getByRole('button', { name: 'Goblin Creator', exact: true }).click();
  await page.waitForSelector('.studio .stage-frame', { timeout: 20000 });
  // Rig guides live in the Fine-tune view; the DNA loader lives in the crew view.
  await page.getByRole('tab', { name: 'Fine-tune' }).click();
  await page.getByLabel('Show guides').check();
  await page.getByRole('tab', { name: /Your crew/ }).click();
  await page.getByLabel('Goblin code', { exact: true }).waitFor();
  for (const [i, entry] of entries.entries()) {
    const dna = encodeGoblinDna(entry.config);
    await page.getByRole('tab', { name: /Your crew/ }).click();
    const input = page.getByLabel('Goblin code', { exact: true });
    await input.fill(dna);
    await page.getByRole('button', { name: 'Load', exact: true }).click();
    await page.getByRole('tab', { name: 'Fine-tune' }).click();
    await page.waitForTimeout(450);
    const tile = join(tilesDir, `${String(i).padStart(2, '0')}-${entry.label.replace(/[^a-z0-9]+/gi, '_')}.png`);
    await page.locator('.stage-frame').screenshot({ path: tile });
    console.log(`${entry.label}  ${dna}  ->  ${tile}`);
  }
  if (errors.length) console.error('page errors:\n' + errors.join('\n'));
  await context.close();
} finally {
  await browser.close();
  await new Promise((r) => server.close(r));
  await rm(libraryDir, { recursive: true, force: true });
}

const montage = spawnSync('montage', [join(tilesDir, '*.png'), '-label', '%f', '-tile', '6x', '-geometry', '400x400+6+6', '-background', '#14171d', '-fill', '#dfe3ea', out]);
if (montage.status !== 0) { console.error(montage.stderr?.toString() ?? 'montage failed'); process.exit(1); }
console.log(`sheet -> ${out}`);
