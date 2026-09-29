/**
 * Goblin creator audit: renders creator parts on a standard goblin, straight from the compositor, into
 * labelled contact sheets (Chromium, the parts loaded from public/). Use it to check registration
 * (does a part land where it belongs?) and front/back (does it wrap round the head right?) on every
 * head shape before and after an art round.
 *
 *   node --import tsx scripts/goblin-audit.ts <out-prefix> [layers] [heads] [item-filter]
 *     layers       comma list (default: every layer but background)
 *     heads        'heads' renders each part on all 8 head masters (one row per part)
 *     item-filter  comma list of substrings, e.g. ear-defenders,turbo-helm
 *
 * Writes <out-prefix>.html and <out-prefix>-0.png, -1.png … (5 rows per image). Scratch: never commit.
 * Needs Chromium at /opt/pw-browsers/chromium (or set CHROMIUM_PATH).
 */
import { writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AVATAR_CATALOG } from '../src/game/meta/goblin-dna';
import { composeGoblinSvg } from '../src/game/meta/goblin-compositor';
import type { GoblinAvatarConfig } from '../src/game/meta/interfaces';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PUB = fileURLToPath(new URL('../public', import.meta.url));
const OUT = resolve(process.argv[2] ?? 'goblin-audit');
const cache = new Map<string, string>();
const resolveImage = (u: string) => {
  if (cache.has(u)) return cache.get(u)!;
  const f = join(PUB, u.replace(/^\//, ''));
  const d = existsSync(f) ? `file://${f}` : u;
  cache.set(u, d); return d;
};
const idx = (layer: string, name: string) => AVATAR_CATALOG[layer as 'head'].indexOf(name);
const base = (): Record<string, number> => ({
  background: idx('background', 'painted:background-workshop-wall'), body: 0,
  ears: idx('ears', 'painted:ears-bat-pointed'), head: idx('head', 'angular'), warpaint: 0, mouth: idx('mouth', 'painted:mouth-lower-tusks'),
  nose: idx('nose', 'painted:nose-hooked-beak'), eyes: idx('eyes', 'painted:eyes-narrow-squint'), eyewear: 0, hair: 0, headgear: 0, neck: 0,
});
const HEADS = ['angular', 'bloated', 'scrawny', 'painted:head-lantern', 'painted:head-wedge', 'painted:head-peanut', 'painted:head-jowls', 'painted:head-bigchin'];
const tiles: { label: string; svg: string; group: string }[] = [];
const layers = (process.argv[3] ?? 'ears,head,mouth,nose,eyes,eyewear,hair,headgear,neck,warpaint,body').split(',');
const allHeads = process.argv[4] === 'heads';
for (const layer of layers) {
  AVATAR_CATALOG[layer as 'head'].forEach((item, i) => {
    if (!item.startsWith('painted:')) return;
    if (process.argv[5] && !process.argv[5].split(',').some((f) => item.includes(f))) return;
    const heads = allHeads ? HEADS : ['angular'];
    for (const h of heads) {
      const L = base(); L[layer] = i; if (layer !== 'head') L.head = idx('head', h);
      const config = { version: 1, layers: L, skin: 'toxic-green', accent: 0, leather: 0, metal: 0 } as unknown as GoblinAvatarConfig;
      const svg = composeGoblinSvg(config, { size: 256, idPrefix: `t${tiles.length}`, resolveImage });
      tiles.push({ label: `${item.replace('painted:', '')}${allHeads ? ' · ' + h.replace('painted:head-', '') : ''}`, svg, group: layer });
    }
  });
}
const html = `<html><body style="margin:0;background:#222;font:11px sans-serif;color:#eee"><div style="display:flex;flex-wrap:wrap;width:${8 * 262}px">${tiles.map((t) => `<div style="width:256px;margin:3px"><div style="height:256px">${t.svg}</div><div>${t.label}</div></div>`).join('')}</div></body></html>`;
writeFileSync(OUT + '.html', html);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium', args: ['--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: 8 * 262, height: 800 } });
await page.goto(`file://${OUT}.html`, { waitUntil: 'load' });
await page.waitForTimeout(4000);
const H = await page.evaluate(() => document.body.scrollHeight);
const CH = 5 * 275;
for (let y = 0, i = 0; y < H; y += CH, i++) {
  await page.setViewportSize({ width: 8 * 262, height: Math.min(CH, H - y) });
  await page.evaluate((yy) => window.scrollTo(0, yy), y);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}-${i}.png` });
}
await browser.close();
console.log(tiles.length, 'tiles');
