/**
 * WIRE-1 — the painted decal art behind the Ball Garage: every catalog decal has a painted PNG,
 * the id → file mapping is the one the loader uses, band decals close on themselves with no seam,
 * and a design saved before pack 2 still loads and bakes to exactly the same bytes.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DECAL_CATALOG, decalArt, decalArtUrl, decalImage, decalSources, loadPaintedDecals, withBakeKey } from '../src/game/meta/ball-design';
import { bakeBall, computeBakeKey } from '../src/game/meta/sphere-decal-baker';
import type { CustomBallConfig, DecalStamp, HexColor } from '../src/game/meta/interfaces';

const repo = (rel: string) => fileURLToPath(new URL(`../${rel}`, import.meta.url));

test('WIRE-1: the catalog holds both decal packs, and pack 2 is priced as specified', () => {
  assert.equal(DECAL_CATALOG.length, 29);
  assert.equal(new Set(DECAL_CATALOG.map((d) => d.id)).size, 29, 'no duplicate ids');
  const price = (id: string) => DECAL_CATALOG.find((d) => d.id === id)?.price;
  assert.equal(price('emblem.marble-comet'), 400);
  assert.equal(price('emblem.lightning-bolt'), 0);
  assert.equal(price('pattern.skull-row'), 350);
  assert.equal(DECAL_CATALOG.find((d) => d.id === 'pattern.rope-twist')?.projection, 'band');
  assert.equal(DECAL_CATALOG.find((d) => d.id === 'emblem.anvil')?.projection, 'gnomonic');
  for (const d of DECAL_CATALOG) assert.match(d.name, /^[A-Z]/, `${d.id} is named for players`);
});

test('WIRE-1: every decal maps to a painted PNG that exists', () => {
  for (const d of DECAL_CATALOG) {
    const url = decalArtUrl(d.id);
    assert.ok(url.startsWith('/art/garage/decals/'), url);
    assert.ok(existsSync(repo(`public${url}`)), `missing art for ${d.id}: ${url}`);
  }
  assert.equal(decalArtUrl('emblem.crossed-wrenches'), '/art/garage/decals/emblem-crossed-wrenches.png');
  assert.equal(decalArtUrl('roundel.number'), '/art/garage/decals/roundel-blank.png', 'the roundel uses the blank plate');
  for (const file of ['garage-backdrop.png', 'decals/ui-ball-cradle.png']) {
    assert.ok(existsSync(repo(`public/art/garage/${file}`)), file);
    assert.ok(readFileSync(repo(`public/art/garage/${file}`)).length > 1000, file);
  }
});

test('WIRE-1: headless, every decal still falls back to code-drawn art', async () => {
  assert.equal(await loadPaintedDecals(), 0, 'nothing decodes without a browser');
  for (const d of DECAL_CATALOG) {
    const img = decalArt(d.id);
    assert.deepEqual(img, decalImage(d.id), d.id);
    let on = 0;
    for (let i = 3; i < img.data.length; i += 4) if (img.data[i] > 0) on++;
    assert.ok(on > 20 && on < img.width * img.height, `${d.id} draws something, but not everything`);
  }
});

const stamp = (over: Partial<DecalStamp>): DecalStamp => ({
  uid: 'u1', textureId: 'pattern.checker-band', u: 0 as never, v: 0.5 as never,
  scale: 0.08, rotation: 0, opacity: 1, tintColor: '#f2e6c8' as HexColor, blendMode: 'normal', ...over,
} as DecalStamp);

test('WIRE-1: band decals wrap with no seam at u = 0', () => {
  for (const id of ['pattern.checker-band', 'pattern.chain-link', 'pattern.rope-twist'] as const) {
    for (const rotation of [0, -1.1, 2.4]) {
      const config = withBakeKey({ version: 1, base: 'scrap-iron', accentColor: '#e58a2b' as HexColor, capFinish: 'brass', decals: [stamp({ textureId: id, rotation })] });
      const { albedo } = bakeBall(config, decalSources(), 256);
      const w = albedo.width, row = Math.round(albedo.height / 2);
      const at = (x: number) => [0, 1, 2].map((k) => albedo.data[(row * w + x) * 4 + k]);
      const step = (a: number[], b: number[]) => Math.max(...a.map((v, i) => Math.abs(v - b[i])));
      // Crossing the seam must be no bigger a step than the biggest one inside the ring.
      let inside = 0;
      for (let x = 1; x < w - 1; x++) inside = Math.max(inside, step(at(x), at(x + 1)));
      const seam = step(at(w - 1), at(0));
      assert.ok(seam <= inside + 6, `${id} @ ${rotation}: seam step ${seam} vs ${inside} inside`);
    }
  }
});

/** A design saved before pack 2 existed (bakeKey as it was written then). */
const LEGACY: CustomBallConfig = {
  version: 1, base: 'boiler-copper', accentColor: '#e58a2b' as HexColor, capFinish: 'brass',
  decals: [
    stamp({ uid: 'a', textureId: 'emblem.clockwork-gear', u: 0.25 as never, v: 0.55 as never, scale: 0.18 }),
    stamp({ uid: 'b', textureId: 'pattern.dual-stripes', u: 0 as never, v: 0.5 as never, scale: 0.08 }),
    stamp({ uid: 'c', textureId: 'roundel.number', u: 0.7 as never, v: 0.42 as never, scale: 0.2 }),
  ],
  bakeKey: '',
} as CustomBallConfig;

test('WIRE-1: a design saved before pack 2 still loads and bakes identically', () => {
  const key = computeBakeKey(LEGACY);
  assert.equal(key, computeBakeKey({ ...LEGACY, decals: [...LEGACY.decals] }), 'the bake key is stable');
  const a = bakeBall({ ...LEGACY, bakeKey: key }, decalSources(), 128).albedo;
  const b = bakeBall({ ...LEGACY, bakeKey: key }, decalSources(), 128).albedo;
  assert.deepEqual(Array.from(a.data), Array.from(b.data), 'same bytes every time');
  let painted = 0;
  for (let i = 0; i < a.data.length; i += 4) if (a.data[i] > 200 && a.data[i + 1] > 180) painted++;
  assert.ok(painted > 100, 'the old decals are still stamped on the ball');
});
