/** MP-T04: the ball customiser's model and the Garage. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  DECAL_CATALOG, DEFAULT_DESIGN, HISTORY_LIMIT, OWNED_KEY, addDecal, decalImage, edit, listDesigns, redo, saveDesign,
  startHistory, texelUv, undo, unownedItems, updateDecal,
} from '../src/game/meta/ball-design';
import BallCustomizer from '../src/components/garage/BallCustomizer';

const memory = () => { const map = new Map<string, string>(); return { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => { map.set(k, v); } }; };

test('MP-T04: every catalog decal has generated art with something drawn', () => {
  for (const d of DECAL_CATALOG) {
    const img = decalImage(d.id);
    let on = 0; for (let i = 3; i < img.data.length; i += 4) if (img.data[i] > 0) on++;
    assert.ok(on > 20 && on < img.width * img.height, d.id);
  }
});

test('MP-T04: a click stamps at that texel, and the 12th decal is the last', () => {
  const { u, v } = texelUv(100.7, 40.2, 512, 256);
  assert.ok(Math.abs(u * 512 - 100.5) < 1e-9 && Math.abs((1 - v) * 256 - 40.5) < 1e-9, 'the centre of the clicked texel');
  let design = DEFAULT_DESIGN;
  for (let i = 0; i < 12; i++) { const r = addDecal(design, 'emblem.clockwork-gear', i / 12, 0.5); assert.equal(r.ok, true); if (r.ok) design = r.design; }
  const thirteenth = addDecal(design, 'emblem.clockwork-gear', 0.5, 0.5);
  assert.equal(thirteenth.ok, false);
  assert.match((thirteenth as { reason: string }).reason, /12 decals/);
});

test('MP-T04: undo keeps 50 steps and one drag is one step', () => {
  let h = startHistory();
  const r = addDecal(h.present, 'emblem.trefoil', 0.2, 0.5); assert.ok(r.ok); if (!r.ok) return;
  h = edit(h, r.design);
  for (let i = 1; i <= 30; i++) h = edit(h, updateDecal(h.present, r.stamp.uid, { scale: 0.1 + i / 100 }), 'drag-1');
  assert.equal(h.past.length, 2, 'the whole drag coalesced into one step');
  h = undo(h); assert.equal(h.present.decals[0].scale, r.design.decals[0].scale);
  h = redo(h); assert.ok(Math.abs(h.present.decals[0].scale - 0.4) < 1e-9);
  for (let i = 0; i < 80; i++) h = edit(h, { ...h.present, accentColor: (i % 2 ? '#c8372d' : '#3fa7a0') as never });
  assert.equal(h.past.length, HISTORY_LIMIT);
});

test('MP-T04: unowned items block saving; owned ones save', () => {
  const store = memory();
  const r = addDecal(DEFAULT_DESIGN, 'emblem.flaming-skull', 0.3, 0.5); assert.ok(r.ok); if (!r.ok) return;
  assert.deepEqual(unownedItems(r.design, new Set()), [{ id: 'emblem.flaming-skull', price: 400 }]);
  const blocked = saveDesign('Skull', r.design, store);
  assert.equal(blocked.ok, false);
  assert.match((blocked as { reason: string }).reason, /Buy first/);
  store.setItem(OWNED_KEY, JSON.stringify(['emblem.flaming-skull']));
  assert.equal(saveDesign('Skull', r.design, store).ok, true);
  assert.equal(listDesigns(store)[0].name, 'Skull');
  assert.ok(listDesigns(store)[0].config.bakeKey);
});

test('MP-T04: the Garage renders', () => {
  const html = renderToStaticMarkup(createElement(BallCustomizer));
  assert.match(html, /class="garage-ball-3d"/);
  assert.match(html, /0 \/ 12 decals/);
});
