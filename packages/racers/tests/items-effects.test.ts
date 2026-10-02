import test from 'node:test';
import assert from 'node:assert/strict';
import type { Value } from '../src/types';
import { createRacerSystem, defineRacerComponents } from '../src/racers';
import { ctx, fakeDeps, fakeWorld } from './helpers';

const ITEMS: Record<string, { id: string; kind: 'self' | 'drop' | 'area'; durationMs: number }> = {
  oil: { id: 'oil', kind: 'drop', durationMs: 6000 }, shockwave: { id: 'shockwave', kind: 'area', durationMs: 0 }, freeze: { id: 'freeze', kind: 'area', durationMs: 2000 },
  mass: { id: 'mass', kind: 'self', durationMs: 4000 }, slipstream: { id: 'slipstream', kind: 'self', durationMs: 5000 }, ghost: { id: 'ghost', kind: 'self', durationMs: 4000 },
};
function setup() {
  const w = fakeWorld(); defineRacerComponents(w);
  const fd = fakeDeps({ itemById: (id) => ITEMS[id] });
  return { w, sys: createRacerSystem(fd.deps), ...fd };
}
const racer = (w: ReturnType<typeof fakeWorld>, extra: Record<string, Value> = {}, t: Record<string, number> = {}): number =>
  w.spawn({ transform: { x: 0, y: 0, z: 0, ...t }, velocity: { vx: 0, vy: 0, vz: 0 }, body: {}, racer: { ...extra }, race: {} });
const R = (w: ReturnType<typeof fakeWorld>, id: number) => w.get(id, 'racer')!;
const use = (w: ReturnType<typeof fakeWorld>, sys: ReturnType<typeof createRacerSystem>, c = ctx({ p1: { item: true } })): ReturnType<typeof ctx> => { sys.update(w, c); return c; };

test('freeze stops other racers within reach for a while, not the user, not far ones', () => {
  const { w, sys } = setup();
  const me = racer(w, { item: 'freeze' }), near = racer(w, { actor: 'p2' }, { x: 10 }), far = racer(w, { actor: 'p3' }, { x: 80 });
  use(w, sys);
  assert.ok((R(w, near)['freezeMs'] as number) > 1500);
  assert.equal(R(w, far)['freezeMs'], 0);
  assert.equal(R(w, me)['freezeMs'], 0);
});

test('a frozen racer cannot accelerate', () => {
  const { w, sys, forces } = setup();
  const e = racer(w, { freezeMs: 500 });
  sys.update(w, ctx({ p1: { throttle: 1 } }));
  assert.equal(forces.filter((f) => f[0] === e).length, 0);
});

test('shockwave pushes neighbours away; shielded or ghost racers are untouched', () => {
  const { w, sys, impulses } = setup();
  racer(w, { item: 'shockwave' });
  const hit = racer(w, { actor: 'p2' }, { x: 8 }), shielded = racer(w, { actor: 'p3', shieldMs: 3000 }, { x: 8 }), ghost = racer(w, { actor: 'p4', ghostMs: 3000 }, { x: -8 });
  use(w, sys);
  const mine = impulses.filter((i) => i[0] === hit);
  assert.equal(mine.length >= 1, true);
  assert.ok(mine.some((i) => i[1][0]! > 0 && i[1][1]! > 0));
  assert.equal(impulses.some((i) => i[0] === shielded || i[0] === ghost), false);
});

test('oil: drops a slick behind, a racer driving through it goes slippery, a shielded one does not', () => {
  const { w, sys } = setup();
  const dropper = racer(w, { item: 'oil' });
  const c = use(w, sys);
  assert.ok(c.events.log.some(([n]) => n === 'hazard:oil'));
  const victim = racer(w, { actor: 'p2' }, { x: -6 });
  const safe = racer(w, { actor: 'p3', shieldMs: 5000 }, { x: -6 });
  sys.update(w, ctx());
  assert.ok((R(w, victim)['slowMs'] as number) > 1000);
  assert.equal(R(w, safe)['slowMs'], 0);
  void dropper;
});

test('mass, slipstream and ghost start their timers and tick down', () => {
  const { w, sys } = setup();
  const a = racer(w, { item: 'mass' }), b = racer(w, { actor: 'p2', item: 'slipstream', controller: 'player' }), c = racer(w, { actor: 'p3', item: 'ghost' });
  sys.update(w, ctx({ p1: { item: true }, p2: { item: true }, p3: { item: true } }));
  assert.ok((R(w, a)['shieldMs'] as number) > 3900);
  assert.ok((R(w, b)['draftMs'] as number) > 4900);
  assert.ok((R(w, c)['ghostMs'] as number) > 3900);
  const before = R(w, a)['shieldMs'] as number;
  sys.update(w, ctx());
  assert.ok((R(w, a)['shieldMs'] as number) < before);
});

test('slipstream raises the top speed cap and thrust', () => {
  const { w, sys, forces } = setup();
  const plain = racer(w, {}, {});
  const drafting = racer(w, { actor: 'p2', draftMs: 1000 });
  sys.update(w, ctx({ p1: { throttle: 1 }, p2: { throttle: 1 } }));
  const f1 = forces.find((f) => f[0] === plain)![1][0]!, f2 = forces.find((f) => f[0] === drafting)![1][0]!;
  assert.ok(f2 > f1 * 1.3);
});
