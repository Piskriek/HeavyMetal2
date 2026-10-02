import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DismissStack, Navigator, Shelf, WindowManager } from '../src';
import type { Layer } from '../src';

/* ---------------------------------- fixtures ---------------------------------- */

// universe > galaxy > system > planet > { cube > model > { faces > f1, vertices > raw }, moon }
const parent: Record<string, string | null> = {
  universe: null,
  galaxy: 'universe',
  system: 'galaxy',
  planet: 'system',
  cube: 'planet',
  moon: 'planet',
  model: 'cube',
  faces: 'model',
  vertices: 'model',
  f1: 'faces',
  raw: 'vertices',
};
const parentOf = (id: string): string | null => parent[id] ?? null;
const childrenOf = (id: string): string[] => Object.keys(parent).filter((k) => parent[k] === id);
const makeNav = (root = 'planet', start = root): Navigator => new Navigator(parentOf, childrenOf, root, start);

const rectOf = (wm: WindowManager, id: string) => {
  const w = wm.get(id);
  assert.ok(w, `window "${id}" should exist`);
  return w.rect;
};
const ids = (wm: WindowManager): string[] => wm.list().map((w) => w.id);
const xy = (wm: WindowManager): number[][] => wm.list().map((w) => [w.rect.x, w.rect.y]);

/* ------------------------------ 1. Navigator ------------------------------ */

describe('Navigator — hierarchy navigation', () => {
  it('zooms in only to direct children and reports path/depth/breadcrumb/leaf', () => {
    const n = makeNav();
    assert.deepEqual(n.path(), ['planet']);
    assert.equal(n.depth(), 0);
    assert.equal(n.lastMove(), null);
    assert.equal(n.zoomIn('model'), false); // grandchild, not a direct child
    assert.equal(n.zoomIn('ghost'), false);
    assert.equal(n.zoomIn('cube'), true);
    assert.equal(n.zoomIn('model'), true);
    assert.equal(n.current(), 'model');
    assert.deepEqual(n.path(), ['planet', 'cube', 'model']);
    assert.equal(n.depth(), 2);
    assert.deepEqual(n.lastMove(), { from: 'cube', to: 'model', direction: 'in' });
    assert.deepEqual(
      n.breadcrumb((id) => id.toUpperCase()),
      [{ id: 'planet', label: 'PLANET' }, { id: 'cube', label: 'CUBE' }, { id: 'model', label: 'MODEL' }],
    );
    assert.deepEqual(n.children(), ['faces', 'vertices']);
    assert.equal(n.canZoomIn('faces'), true);
    assert.equal(n.canZoomIn('raw'), false);
    assert.equal(n.isLeaf('raw'), true); // RAW level: the gear icon edits the value
    assert.equal(n.isLeaf('f1'), true);
    assert.equal(n.isLeaf('model'), false);
  });

  it('zooms out to the parent and answers at-top at the root of the scale', () => {
    const n = makeNav('planet', 'model');
    assert.deepEqual(n.path(), ['planet', 'cube', 'model']);
    assert.equal(n.zoomOut(), 'moved');
    assert.equal(n.current(), 'cube');
    assert.deepEqual(n.lastMove(), { from: 'model', to: 'cube', direction: 'out' });
    assert.equal(n.zoomOut(), 'moved');
    assert.equal(n.zoomOut(), 'at-top');
    assert.equal(n.current(), 'planet');
    assert.equal(n.pendingUpper(), null);
    assert.equal(makeNav('planet', 'galaxy').current(), 'planet'); // start outside the scale → root
  });

  it('zoomTo jumps through ancestors but refuses nodes outside the scale', () => {
    const n = makeNav();
    assert.equal(n.zoomTo('raw'), true);
    assert.deepEqual(n.path(), ['planet', 'cube', 'model', 'vertices', 'raw']);
    assert.equal(n.depth(), 4);
    assert.deepEqual(n.lastMove(), { from: 'planet', to: 'raw', direction: 'jump' });
    assert.equal(n.zoomTo('galaxy'), false);
    assert.equal(n.zoomTo('ghost'), false);
    assert.equal(n.current(), 'raw');
    assert.equal(n.zoomTo('planet'), true);
    assert.deepEqual(n.path(), ['planet']);
  });

  it('back/forward walk the visited nodes and a new move drops the forward branch', () => {
    const n = makeNav();
    n.zoomIn('cube');
    n.zoomIn('model');
    assert.deepEqual(n.history(), ['planet', 'cube', 'model']);
    assert.equal(n.forward(), false);
    assert.equal(n.back(), true);
    assert.equal(n.current(), 'cube');
    assert.deepEqual(n.lastMove(), { from: 'model', to: 'cube', direction: 'out' });
    assert.equal(n.back(), true);
    assert.equal(n.current(), 'planet');
    assert.equal(n.back(), false);
    assert.equal(n.canBack(), false);
    assert.equal(n.forward(), true);
    assert.deepEqual(n.lastMove(), { from: 'planet', to: 'cube', direction: 'in' });
    assert.equal(n.zoomTo('moon'), true);
    assert.deepEqual(n.history(), ['planet', 'cube', 'moon']);
    assert.equal(n.canForward(), false);
    assert.equal(n.back(), true);
    assert.deepEqual(n.lastMove(), { from: 'moon', to: 'cube', direction: 'jump' });
  });

  it('asks for the upper scale at the root; confirm moves there, decline stays', () => {
    const n = makeNav();
    n.setUpperScales(['system', 'galaxy']);
    assert.equal(n.zoomOut(), 'ask-upper');
    assert.equal(n.pendingUpper(), 'system');
    n.declineUpper();
    assert.equal(n.pendingUpper(), null);
    assert.equal(n.confirmUpper(), false);
    assert.equal(n.current(), 'planet');
    assert.equal(n.zoomOut(), 'ask-upper');
    assert.equal(n.zoomIn('cube'), true); // any move cancels the question
    assert.equal(n.pendingUpper(), null);
    assert.equal(n.zoomOut(), 'moved');
    assert.equal(n.zoomOut(), 'ask-upper');
    assert.equal(n.confirmUpper(), true);
    assert.equal(n.current(), 'system');
    assert.equal(n.root(), 'system');
    assert.deepEqual(n.path(), ['system']);
    assert.deepEqual(n.lastMove(), { from: 'planet', to: 'system', direction: 'out' });
    assert.deepEqual(n.upperScales(), ['galaxy']);
    assert.equal(n.zoomIn('planet'), true);
    assert.deepEqual(n.path(), ['system', 'planet']);
    assert.equal(n.zoomOut(), 'moved');
    assert.equal(n.zoomOut(), 'ask-upper');
    assert.equal(n.pendingUpper(), 'galaxy');
    assert.equal(n.confirmUpper(), true);
    assert.equal(n.current(), 'galaxy');
    assert.equal(n.zoomOut(), 'at-top');
    assert.equal(n.pendingUpper(), null);
  });
});

/* ----------------------------- 2. DismissStack ---------------------------- */

describe('DismissStack — Esc layers', () => {
  it('closes dialog > floating > slideout > shelf > focus > menu, newest first within a layer', () => {
    const stack = new DismissStack();
    const closed: string[] = [];
    const reg = (layer: Layer, id: string) => stack.register(layer, id, () => { closed.push(id); });
    reg('menu', 'jump-menu');
    reg('focus', 'preset-focus');
    reg('shelf', 'left-shelf');
    reg('slideout', 'brush-tools');
    reg('floating', 'win-a');
    reg('floating', 'win-b');
    reg('dialog', 'confirm');
    assert.equal(stack.count(), 7);
    assert.equal(stack.count('floating'), 2);
    const expected = [
      ['dialog', 'confirm'],
      ['floating', 'win-b'],
      ['floating', 'win-a'],
      ['slideout', 'brush-tools'],
      ['shelf', 'left-shelf'],
      ['focus', 'preset-focus'],
      ['menu', 'jump-menu'],
    ] as const;
    for (const [layer, id] of expected) {
      assert.deepEqual(stack.press(), { handled: true, layer, id, fallback: 'none' });
    }
    assert.deepEqual(closed, expected.map(([, id]) => id));
    assert.equal(stack.count(), 0);
    assert.deepEqual(stack.press(), { handled: false, layer: null, id: null, fallback: 'open-menu' });
  });

  it('falls back to open-menu when nothing is registered and closes the menu once it is open', () => {
    const stack = new DismissStack();
    assert.deepEqual(stack.press(), { handled: false, layer: null, id: null, fallback: 'open-menu' });
    let menuClosed = 0;
    stack.register('menu', 'jump', () => { menuClosed++; });
    assert.deepEqual(stack.press(), { handled: true, layer: 'menu', id: 'jump', fallback: 'none' });
    assert.equal(menuClosed, 1);
    assert.equal(stack.press().fallback, 'open-menu');
    assert.equal(menuClosed, 1);
  });

  it('unregister removes exactly that item, is idempotent, and is safe inside a close handler', () => {
    const stack = new DismissStack();
    const closed: string[] = [];
    const offA = stack.register('floating', 'a', () => { closed.push('a'); });
    stack.register('floating', 'b', () => { closed.push('b'); });
    offA();
    offA();
    assert.equal(stack.count('floating'), 1);
    assert.equal(stack.press().id, 'b');
    assert.deepEqual(closed, ['b']);
    const offSelf: () => void = stack.register('dialog', 'self', () => { offSelf(); });
    assert.equal(stack.press().id, 'self');
    assert.equal(stack.count(), 0);
    stack.register('shelf', 'x', () => { closed.push('x-old'); });
    stack.register('shelf', 'y', () => { closed.push('y'); });
    stack.register('shelf', 'x', () => { closed.push('x-new'); }); // re-register → moves to the top
    assert.equal(stack.count('shelf'), 2);
    assert.equal(stack.press().id, 'x');
    assert.deepEqual(closed, ['b', 'x-new']);
    stack.clear();
    assert.equal(stack.count(), 0);
    assert.equal(stack.press().handled, false);
  });
});

/* ----------------------------- 3. WindowManager --------------------------- */

describe('WindowManager — floating windows', () => {
  it('clamps so at least 48 px of the title bar stays on screen, also after viewport changes', () => {
    const wm = new WindowManager(1000, 800);
    wm.open('a', { x: -500, y: -50, w: 300, h: 200 });
    assert.deepEqual(rectOf(wm, 'a'), { x: -252, y: 0, w: 300, h: 200 });
    assert.equal(wm.moveTo('a', 2000, 2000), true);
    assert.deepEqual(rectOf(wm, 'a'), { x: 952, y: 752, w: 300, h: 200 });
    assert.equal(wm.move('a', -5000, -10), true);
    assert.deepEqual(rectOf(wm, 'a'), { x: -252, y: 742, w: 300, h: 200 });
    assert.equal(wm.move('ghost', 1, 1), false);
    assert.equal(wm.moveTo('ghost', 1, 1), false);
    wm.moveTo('a', 100, 100);
    wm.setViewport(320, 120);
    assert.deepEqual(rectOf(wm, 'a'), { x: 100, y: 72, w: 300, h: 120 });
  });

  it('resize respects min sizes and the viewport', () => {
    const wm = new WindowManager(1000, 800);
    wm.open('b', { x: 0, y: 0, w: 300, h: 200 }, { minW: 200, minH: 100, title: 'Brushes' });
    assert.equal(wm.get('b')?.title, 'Brushes');
    assert.equal(wm.resize('b', 10, 10), true);
    assert.deepEqual(rectOf(wm, 'b'), { x: 0, y: 0, w: 200, h: 100 });
    wm.resize('b', 5000, 5000);
    assert.deepEqual(rectOf(wm, 'b'), { x: 0, y: 0, w: 1000, h: 800 });
    wm.moveTo('b', 990, 790);
    assert.deepEqual(rectOf(wm, 'b'), { x: 952, y: 752, w: 1000, h: 800 });
    assert.equal(wm.resize('ghost', 1, 1), false);
    wm.open('tiny', { x: 10, y: 10, w: 1, h: 1 }); // default minimum 96 × 48
    assert.deepEqual(rectOf(wm, 'tiny'), { x: 10, y: 10, w: 96, h: 48 });
  });

  it('keeps z-order: list is back to front, bringToFront/open focus, close drops', () => {
    const wm = new WindowManager(1000, 800);
    assert.equal(wm.focused(), null);
    wm.open('a', { x: 0, y: 0, w: 200, h: 100 });
    wm.open('b', { x: 300, y: 0, w: 200, h: 100 });
    wm.open('c', { x: 600, y: 0, w: 200, h: 100 });
    assert.deepEqual(ids(wm), ['a', 'b', 'c']);
    assert.equal(wm.focused(), 'c');
    assert.equal(wm.bringToFront('a'), true);
    assert.deepEqual(ids(wm), ['b', 'c', 'a']);
    assert.equal(wm.focused(), 'a');
    assert.equal(wm.bringToFront('zzz'), false);
    assert.equal(wm.close('a'), true);
    assert.equal(wm.close('a'), false);
    assert.equal(wm.focused(), 'c');
    wm.open('b', { x: 0, y: 0, w: 1, h: 1 }); // already open → only focused, rect untouched
    assert.deepEqual(ids(wm), ['c', 'b']);
    assert.deepEqual(rectOf(wm, 'b'), { x: 300, y: 0, w: 200, h: 100 });
    const zs = wm.list().map((w) => w.z);
    assert.deepEqual(zs, [...zs].sort((p, q) => p - q));
    assert.equal(new Set(zs).size, zs.length);
  });

  it('cascades: new windows never stack exactly and cascade() lays them out 28 px apart', () => {
    const wm = new WindowManager(1000, 800);
    const same = { x: 100, y: 100, w: 300, h: 200 };
    wm.open('a', same);
    wm.open('b', same);
    wm.open('c', same);
    assert.deepEqual(xy(wm), [[100, 100], [128, 128], [156, 156]]);
    wm.cascade();
    assert.deepEqual(xy(wm), [[0, 0], [28, 28], [56, 56]]);
    const small = new WindowManager(200, 200);
    for (const id of ['p', 'q', 'r']) small.open(id, { x: 0, y: 0, w: 150, h: 150 });
    small.cascade(); // the third one would overflow → wraps back to the origin
    assert.deepEqual(xy(small), [[0, 0], [28, 28], [0, 0]]);
  });

  it('round-trips through JSON and swallows junk without throwing', () => {
    const wm = new WindowManager(1000, 800);
    wm.open('a', { x: 10, y: 20, w: 300, h: 200 }, { title: 'Alpha', minW: 150, minH: 90 });
    wm.open('b', { x: 400, y: 20, w: 320, h: 240 }, { title: 'Beta' });
    wm.bringToFront('a');
    const json = JSON.parse(JSON.stringify(wm)) as unknown; // toJSON() is picked up by JSON.stringify
    const restored = new WindowManager(1000, 800);
    assert.equal(restored.fromJSON(json), true);
    assert.deepEqual(restored.list(), wm.list());
    assert.deepEqual(restored.toJSON(), wm.toJSON());
    assert.equal(restored.focused(), 'a');
    assert.equal(restored.fromJSON(JSON.stringify(wm.toJSON())), true);
    assert.deepEqual(restored.list(), wm.list());
    restored.resize('a', 1, 1); // min sizes survived the trip
    assert.deepEqual(rectOf(restored, 'a'), { x: 10, y: 20, w: 150, h: 90 });
    const before = restored.list();
    for (const junk of [null, undefined, 42, 'nope{', '[]', { windows: 'x' }, { windows: null }]) {
      assert.equal(restored.fromJSON(junk), false);
    }
    assert.deepEqual(restored.list(), before);
    const messy = new WindowManager(1000, 800);
    const ok = messy.fromJSON({
      windows: [
        null, 7, 'str', { rect: {} },
        { id: 'ok', rect: { x: 'a', y: NaN, w: -5, h: 1e9 }, z: 'top' },
        { id: 'ok', rect: { x: 0, y: 0, w: 100, h: 100 } }, // duplicate id → skipped
      ],
    });
    assert.equal(ok, true);
    assert.deepEqual(messy.list(), [{ id: 'ok', rect: { x: 0, y: 0, w: 96, h: 800 }, z: 1, title: 'ok' }]);
  });
});

/* --------------------------------- 4. Shelf -------------------------------- */

describe('Shelf — auto-hide edge panels', () => {
  it('reveals within peek px and eases the slide over 180 ms', () => {
    const s = new Shelf({ edge: 'left', hideAfterMs: 1000, peek: 12 });
    assert.deepEqual(s.tick(0), { open: false, progress: 0 });
    assert.equal(s.pointerNear(20, 0), false); // too far from the edge
    assert.deepEqual(s.tick(50), { open: false, progress: 0 });
    assert.equal(s.pointerNear(12, 100), true);
    assert.equal(s.isOpen(), true);
    assert.deepEqual(s.tick(100), { open: true, progress: 0 });
    assert.deepEqual(s.tick(190), { open: true, progress: 0.875 }); // ease-out cubic at 50 %
    assert.deepEqual(s.tick(280), { open: true, progress: 1 });
    assert.deepEqual(s.tick(900), { open: true, progress: 1 });
  });

  it('hides hideAfterMs after the last touch and reverses mid-slide when touched again', () => {
    const s = new Shelf({ edge: 'right', hideAfterMs: 1000, peek: 12 });
    s.pointerNear(0, 100);
    s.tick(280);
    assert.deepEqual(s.tick(1099), { open: true, progress: 1 });
    assert.deepEqual(s.tick(1100), { open: false, progress: 1 }); // slide-out starts exactly at the deadline
    assert.deepEqual(s.tick(1190), { open: false, progress: 0.125 });
    s.pointerNear(0, 1190); // touched while hiding → slides back from 0.125
    assert.deepEqual(s.tick(1190), { open: true, progress: 0.125 });
    assert.deepEqual(s.tick(1370), { open: true, progress: 1 });
    s.pointerInside(1500); // the pointer inside the panel keeps it open
    assert.deepEqual(s.tick(2499), { open: true, progress: 1 });
    assert.deepEqual(s.tick(2500), { open: false, progress: 1 });
    assert.deepEqual(s.tick(2680), { open: false, progress: 0 });
    assert.deepEqual(s.tick(9000), { open: false, progress: 0 });
  });

  it('pinned shelves never auto-hide; unpinning restarts the timer', () => {
    const s = new Shelf({ edge: 'bottom', hideAfterMs: 500, peek: 8 });
    s.pointerNear(0, 0);
    s.pin(true);
    assert.equal(s.isPinned(), true);
    assert.deepEqual(s.tick(5000), { open: true, progress: 1 });
    s.pin(false, 5000);
    assert.deepEqual(s.tick(5499), { open: true, progress: 1 });
    assert.deepEqual(s.tick(5500), { open: false, progress: 1 });
    assert.deepEqual(s.tick(5680), { open: false, progress: 0 });
    const s2 = new Shelf({ edge: 'top', hideAfterMs: 500, peek: 8 });
    s2.pointerNear(0, 0);
    s2.pin(true);
    s2.tick(10000);
    s2.pin(false); // no time given → the timer starts at the next tick
    assert.equal(s2.tick(10000).open, true);
    assert.equal(s2.tick(10499).open, true);
    assert.equal(s2.tick(10500).open, false);
  });

  it('show()/hide() slide from the next tick (or from t) and show() still auto-hides', () => {
    const s = new Shelf({ edge: 'left', hideAfterMs: 1000, peek: 10 });
    s.show();
    assert.deepEqual(s.tick(0), { open: true, progress: 0 });
    assert.deepEqual(s.tick(180), { open: true, progress: 1 });
    s.hide();
    assert.deepEqual(s.tick(200), { open: false, progress: 1 });
    assert.deepEqual(s.tick(380), { open: false, progress: 0 });
    s.show(380);
    assert.deepEqual(s.tick(560), { open: true, progress: 1 });
    s.hide(600);
    assert.deepEqual(s.tick(690), { open: false, progress: 0.125 });
    assert.deepEqual(s.tick(780), { open: false, progress: 0 });
    s.show(1000);
    assert.deepEqual(s.tick(1180), { open: true, progress: 1 });
    assert.deepEqual(s.tick(1999), { open: true, progress: 1 });
    assert.deepEqual(s.tick(2000), { open: false, progress: 1 });
  });
});