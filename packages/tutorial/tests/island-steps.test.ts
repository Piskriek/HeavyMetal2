import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ISLAND_STEPS, Tutorial, WALK_STEPS, validateSteps } from '../src';

test('the island tour and the short tour are valid presets with exactly one reveal at the end', () => {
  for (const steps of [ISLAND_STEPS, WALK_STEPS]) {
    assert.deepEqual(validateSteps(steps), { ok: true, errors: [] });
    assert.equal(steps[steps.length - 1]!.id, 'finish');
    assert.equal(steps[steps.length - 2]!.id, 'reveal');
  }
});

test('playing the island tour: events move it on, the sculpt step hands you Mound Builder, the reveal switches to PBR then reveals, credits once', () => {
  const t = new Tutorial(ISLAND_STEPS);
  let now = 1000;
  const all: string[] = [];
  const run = (fx: { action: { type: string } & Record<string, unknown> }[]): void => { for (const e of fx) all.push(e.action.type === 'give' ? `give:${String(e.action.item)}` : e.action.type === 'setSkin' ? `skin:${String(e.action.skin)}` : e.action.type); };
  run(t.event('moved', now++) as never); run(t.event('moved', now++) as never);
  assert.equal(t.current()!.id, 'welcome', 'three steps or looks are needed');
  run(t.event('looked', now++) as never); run(t.event('looked', now++) as never); run(t.event('looked', now++) as never);
  assert.equal(t.current()!.id, 'jump');
  run(t.event('jumped', now++) as never);
  assert.equal(t.current()!.id, 'sculpt');
  assert.ok(all.includes('give:mound-builder'));
  for (let i = 0; i < 3; i++) run(t.event('used-sculpt', now++) as never);
  assert.equal(t.current()!.id, 'place');
  assert.ok(all.includes('give:plant-oak'));
  for (const e of ['placed', 'undo', 'mode-switched', 'edited', 'opened-menu']) run(t.event(e, now++) as never);
  assert.equal(t.current()!.id, 'reveal');
  run(t.event('moved', now++) as never);
  assert.equal(t.current()!.id, 'reveal', 'only the button reveals');
  run(t.button('show-pbr', now++) as never);
  assert.deepEqual(all.slice(-2), ['skin:pbr', 'reveal']);
  assert.equal(t.current()!.id, 'finish');
  run(t.tick(now + 7001) as never);
  assert.ok(t.done());
  assert.equal(all.filter((a) => a === 'credits').length, 1);
});

test('the tour survives a reload half way', () => {
  const t = new Tutorial(ISLAND_STEPS);
  t.skip(1); t.skip(2);
  const saved = JSON.parse(JSON.stringify(t.toJSON()));
  const back = new Tutorial(ISLAND_STEPS, saved);
  assert.equal(back.current()!.id, 'sculpt');
});
