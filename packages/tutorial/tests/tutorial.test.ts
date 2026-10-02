/*
 * test/tutorial.test.ts — place this folder one level above src/ so the
 * '../src' import resolves (src should re-export the tutorial module,
 * e.g. src/index.ts: export * from '../src'). Run with node --test.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { DEFAULT_STEPS, Tutorial, validateSteps } from '../src';
import type { Effect, SavedProgress, Step } from '../src';

/** Skip ahead until the tutorial is sitting on the step with this id. */
function toStep(t: Tutorial, id: string, now: number): void {
  for (let i = 0; i < 40 && (t.current()?.id ?? null) !== id; i++) {
    t.skip(now + i);
    // The very first step is not skippable; a step forward carries it.
    if ((t.current()?.id ?? null) !== id) t.event('moved', now + i + 1);
  }
  assert.equal(t.current()?.id, id);
}

test('default steps validate', () => {
  const res = validateSteps(DEFAULT_STEPS);
  assert.deepEqual(res.errors, []);
  assert.equal(res.ok, true);
});

test('walking through all steps with events in order ends done', () => {
  const t = new Tutorial(DEFAULT_STEPS);
  assert.equal(t.total(), 13);
  assert.equal(t.done(), false);
  assert.equal(t.current()?.id, 'welcome');
  assert.equal(t.progress(), 0);

  t.event('moved', 1000); // welcome
  t.event('looked', 2000); // look
  t.event('moved', 3000); // move
  t.event('jumped', 4000); // jump
  assert.equal(t.current()?.id, 'hotbar');
  assert.equal(t.progress(), 4 / 13);

  t.event('slot-selected', 5000); // hotbar
  t.event('used-sculpt', 6000); // sculpt 1/3
  t.event('used-sculpt', 6100); // sculpt 2/3
  assert.equal(t.current()?.id, 'sculpt');
  t.event('used-sculpt', 6200); // sculpt 3/3
  t.event('placed', 7000); // prop
  t.event('undo', 8000); // undo
  t.event('opened-inventory', 9000); // inventory
  t.event('opened-menu', 10_000); // menu
  assert.equal(t.current()?.id, 'reveal');

  const effects = t.button('show-pbr', 11_000);
  assert.equal(t.current()?.id, 'freeplay');
  const skin = effects.find((e) => e.stepId === 'reveal' && e.action.type === 'setSkin');
  const rev = effects.find((e) => e.stepId === 'reveal' && e.action.type === 'reveal');
  assert.ok(skin && skin.action.type === 'setSkin' && skin.action.skin === 'pbr');
  assert.ok(rev);

  assert.deepEqual(t.tick(13_000), []); // freeplay: 2000 ms elapsed
  const final = t.tick(13_500); // finish: 500 ms elapsed
  assert.equal(t.done(), true);
  assert.equal(t.current(), null);
  assert.equal(t.progress(), 1);
  assert.equal(final.length, 1);
  const last = final[0];
  assert.ok(last);
  assert.deepEqual(last, { stepId: 'finish', action: { type: 'credits', amount: 100 } });
  assert.deepEqual(t.skipAll(13_600), []); // nothing left; credits only once
});

test('the reveal step needs the button and yields setSkin pbr then reveal', () => {
  const t = new Tutorial(DEFAULT_STEPS);
  toStep(t, 'reveal', 100);
  assert.equal(t.current()?.id, 'reveal');

  assert.deepEqual(t.tick(50_000), []); // waiting never triggers it
  assert.deepEqual(t.button('wrong-button', 51_000), []);
  assert.equal(t.current()?.id, 'reveal');

  const effects: Effect[] = t.button('show-pbr', 52_000);
  const idxSkin = effects.findIndex(
    (e) => e.stepId === 'reveal' && e.action.type === 'setSkin' && e.action.skin === 'pbr',
  );
  const idxReveal = effects.findIndex((e) => e.stepId === 'reveal' && e.action.type === 'reveal');
  assert.ok(idxSkin >= 0);
  assert.ok(idxReveal > idxSkin);
  assert.equal(t.current()?.id, 'freeplay');
});

test('skip rules: non-skippable is ignored, a skipped reveal still lands on pbr', () => {
  const t = new Tutorial(DEFAULT_STEPS);
  assert.deepEqual(t.skip(0), []); // welcome is not skippable
  assert.equal(t.current()?.id, 'welcome');
  t.event('moved', 10); // welcome -> look
  t.skip(20); // look is skippable
  assert.equal(t.current()?.id, 'move');

  const t2 = new Tutorial(DEFAULT_STEPS);
  toStep(t2, 'reveal', 100);
  const effects = t2.skip(200); // skip the big moment
  const skin = effects.find((e) => e.stepId === 'reveal' && e.action.type === 'setSkin');
  const rev = effects.find((e) => e.stepId === 'reveal' && e.action.type === 'reveal');
  assert.ok(skin && skin.action.type === 'setSkin' && skin.action.skin === 'pbr');
  assert.ok(rev);
  assert.equal(t2.current()?.id, 'freeplay');

  const t3 = new Tutorial(DEFAULT_STEPS);
  t3.skipAll(0);
  assert.deepEqual(t3.skip(10), []); // nothing left to skip
});

test('skipAll yields pbr and credits exactly once', () => {
  const t = new Tutorial(DEFAULT_STEPS);
  const effects = t.skipAll(0);
  const pbr = effects.filter((e) => e.action.type === 'setSkin' && e.action.skin === 'pbr');
  const reveals = effects.filter((e) => e.action.type === 'reveal');
  const credits = effects.filter((e) => e.action.type === 'credits');
  assert.equal(pbr.length, 1);
  assert.equal(reveals.length, 1);
  assert.equal(credits.length, 1);
  const c = credits[0];
  assert.ok(c);
  if (c && c.action.type === 'credits') assert.equal(c.action.amount, 100);
  assert.equal(t.done(), true);
  assert.deepEqual(t.skipAll(50), []); // again: nothing new
  assert.deepEqual(t.tick(60), []);

  // Mid-tutorial skipAll: only the remaining steps, credits still once.
  const t2 = new Tutorial(DEFAULT_STEPS);
  toStep(t2, 'reveal', 10);
  const rest = t2.skipAll(20);
  assert.equal(rest.filter((e) => e.action.type === 'setSkin').length, 1);
  assert.equal(rest.filter((e) => e.action.type === 'credits').length, 1);
  assert.equal(t2.done(), true);
});

test('time conditions fire via tick', () => {
  const steps: Step[] = [
    {
      id: 'wait', title: 'W', text: 'Hold on a moment.',
      advance: { type: 'time', ms: 1000 }, skippable: true,
      onDone: [{ type: 'say', text: 'ok' }],
    },
    { id: 'finish', title: 'F', text: 'End.', advance: { type: 'time', ms: 250 }, skippable: true },
  ];
  const t = new Tutorial(steps);
  assert.deepEqual(t.tick(100), []); // first tick starts the clock
  assert.deepEqual(t.tick(1099), []);
  assert.equal(t.done(), false);
  const mid = t.tick(1100); // 1000 ms elapsed
  assert.equal(t.current()?.id, 'finish');
  assert.deepEqual(mid, [{ stepId: 'wait', action: { type: 'say', text: 'ok' } }]);
  assert.deepEqual(t.tick(1349), []);
  assert.equal(t.done(), false);
  t.tick(1350); // 250 ms on finish
  assert.equal(t.done(), true);
});

test('all and any conditions compose', () => {
  const steps: Step[] = [
    {
      id: 'both', title: 'B', text: 'Do both things.',
      advance: { type: 'all', of: [{ type: 'event', name: 'moved' }, { type: 'event', name: 'jumped', count: 2 }] },
      skippable: true,
    },
    {
      id: 'either', title: 'E', text: 'Either one works.',
      advance: { type: 'any', of: [{ type: 'event', name: 'placed' }, { type: 'button', id: 'go' }] },
      skippable: true,
    },
    { id: 'finish', title: 'F', text: 'End.', advance: { type: 'time', ms: 1 }, skippable: true },
  ];
  const t = new Tutorial(steps);
  t.event('moved', 0);
  assert.equal(t.current()?.id, 'both'); // jumped still 0
  t.event('jumped', 1);
  assert.equal(t.current()?.id, 'both'); // jumped 1 < 2
  t.event('jumped', 2); // both satisfied
  assert.equal(t.current()?.id, 'either');
  t.button('go', 3); // 'any' satisfied by the button
  assert.equal(t.current()?.id, 'finish');
  t.tick(4); // 1 ms elapsed
  assert.equal(t.done(), true);
});

test('event conditions count up to the requested number', () => {
  const steps: Step[] = [
    {
      id: 'sculpt', title: 'S', text: 'Sculpt three times.',
      advance: { type: 'event', name: 'used-sculpt', count: 3 }, skippable: true,
    },
    { id: 'finish', title: 'F', text: 'End.', advance: { type: 'time', ms: 1 }, skippable: true },
  ];
  const t = new Tutorial(steps);
  t.event('used-sculpt', 0);
  t.event('used-sculpt', 1);
  assert.equal(t.current()?.id, 'sculpt');
  t.event('noisy', 2); // unrelated event counts toward nothing
  assert.equal(t.current()?.id, 'sculpt');
  t.event('used-sculpt', 3);
  assert.equal(t.current()?.id, 'finish');
});

test('JSON round trip resumes where the player left off', () => {
  const t = new Tutorial(DEFAULT_STEPS);
  t.event('moved', 1000); // welcome
  t.event('looked', 1500); // look -> now on 'move'
  assert.equal(t.current()?.id, 'move');

  const raw: SavedProgress = t.toJSON();
  assert.equal(raw.stepId, 'move');
  assert.deepEqual(raw.completed, ['welcome', 'look']);

  const t2 = Tutorial.fromJSON(DEFAULT_STEPS, raw);
  assert.equal(t2.current()?.id, 'move');
  assert.equal(t2.index(), 2);
  assert.equal(t2.done(), false);
  t2.event('moved', 2000);
  assert.equal(t2.current()?.id, 'jump');
});

test('JSON round trip keeps partial counts', () => {
  const t = new Tutorial(DEFAULT_STEPS);
  toStep(t, 'sculpt', 100);
  t.event('used-sculpt', 200); // 1 of 3
  assert.equal(t.current()?.id, 'sculpt');
  const raw = t.toJSON();
  assert.equal(raw.counts['used-sculpt'], 1);

  const t2 = Tutorial.fromJSON(DEFAULT_STEPS, raw);
  assert.equal(t2.current()?.id, 'sculpt');
  t2.event('used-sculpt', 300); // 2 of 3
  assert.equal(t2.current()?.id, 'sculpt');
  t2.event('used-sculpt', 400); // 3 of 3
  assert.equal(t2.current()?.id, 'prop');
});

test('finished progress round trips as done', () => {
  const t = new Tutorial(DEFAULT_STEPS);
  t.skipAll(0);
  const raw = t.toJSON();
  assert.equal(raw.stepId, null);
  const t2 = Tutorial.fromJSON(DEFAULT_STEPS, raw);
  assert.equal(t2.done(), true);
  assert.equal(t2.current(), null);
  assert.equal(t2.progress(), 1);
});

test('fromJSON handles changed steps', () => {
  const t = new Tutorial(DEFAULT_STEPS);
  t.event('moved', 1000); // welcome
  t.event('looked', 1500); // -> on 'move'
  const raw = t.toJSON();
  assert.equal(raw.stepId, 'move');

  // Known step that moved to a different index: resume by id.
  const noWelcome = DEFAULT_STEPS.filter((s) => s.id !== 'welcome');
  const t2 = Tutorial.fromJSON(noWelcome, raw);
  assert.equal(t2.current()?.id, 'move');
  assert.equal(t2.index(), 1);

  // The saved step itself was removed: restart at the nearest earlier known step.
  const noMove = DEFAULT_STEPS.filter((s) => s.id !== 'move');
  const t3 = Tutorial.fromJSON(noMove, raw);
  assert.equal(t3.current()?.id, 'look');

  // An id that was never known: start from the beginning.
  const fake = { ...raw, stepId: 'totally-unknown', completed: ['also-unknown'] };
  const t4 = Tutorial.fromJSON(DEFAULT_STEPS, fake);
  assert.equal(t4.current()?.id, 'welcome');
});

test('replay resets the tutorial', () => {
  const t = new Tutorial(DEFAULT_STEPS);
  t.event('moved', 100);
  t.event('looked', 200);
  t.event('moved', 300);
  assert.equal(t.current()?.id, 'jump');
  assert.equal(t.index(), 3);

  t.replay();
  assert.equal(t.index(), 0);
  assert.equal(t.current()?.id, 'welcome');
  assert.equal(t.progress(), 0);
  assert.equal(t.done(), false);
  t.event('moved', 400);
  assert.equal(t.current()?.id, 'look');

  // Replay after finishing starts a fresh run.
  t.skipAll(500);
  assert.equal(t.done(), true);
  t.replay();
  assert.equal(t.current()?.id, 'welcome');
  const again = t.skipAll(600);
  assert.equal(again.filter((e) => e.action.type === 'credits').length, 1);
  assert.equal(t.done(), true);
});

test('junk input never throws', () => {
  const junk: unknown[] = [
    undefined,
    null,
    42,
    'progress',
    true,
    [],
    [{ id: 'x' }],
    {},
    { stepId: 5 },
    { stepId: {} },
    { stepId: 'nope', completed: 'x' },
    { stepId: 'nope', completed: ['also-nope'] },
    { index: -9, counts: 'y', pressed: [1, 2], startedAt: 'z' },
    { stepId: 'sculpt', counts: { 'used-sculpt': 'lots', moved: 2.7 }, pressed: { a: true, b: 'yes' }, startedAt: -5 },
  ];
  for (const j of junk) {
    const t = Tutorial.fromJSON(DEFAULT_STEPS, j);
    assert.ok(t.index() >= 0 && t.index() <= t.total());
    t.event('moved', 10); // still usable
    t.tick(20);
    t.skip(30);
  }

  // A junky-but-recognised save keeps only the sane parts.
  const t = Tutorial.fromJSON(DEFAULT_STEPS, {
    stepId: 'sculpt',
    counts: { 'used-sculpt': 2.9, bad: 'x' },
    pressed: { ok: true, no: 1 },
    startedAt: -5,
  });
  assert.equal(t.index(), 5);
  assert.equal(t.current()?.id, 'sculpt');
  const out = t.toJSON();
  assert.equal(out.counts['used-sculpt'], 2);
  assert.equal(out.counts['bad'], undefined);
  assert.deepEqual(out.pressed, { ok: true });
  assert.equal(out.startedAt, null);
});

test('one input can clear several steps when later conditions are already met', () => {
  const steps: Step[] = [
    {
      id: 'one', title: '1', text: 'Walk.',
      advance: { type: 'event', name: 'moved' }, skippable: true,
      onDone: [{ type: 'say', text: 'one done' }],
    },
    {
      id: 'two', title: '2', text: 'Blink.',
      advance: { type: 'time', ms: 0 }, skippable: true,
      onEnter: [{ type: 'say', text: 'two entered' }],
    },
    { id: 'finish', title: 'F', text: 'End.', advance: { type: 'event', name: 'jumped' }, skippable: true },
  ];
  const t = new Tutorial(steps);
  const effects = t.event('moved', 100);
  assert.equal(t.current()?.id, 'finish');
  assert.ok(effects.some((e) => e.stepId === 'one'));
  assert.ok(effects.some((e) => e.stepId === 'two'));
});

test('validateSteps catches broken presets', () => {
  const broken: Step[] = [
    { id: 'a', title: 'A', text: 'First.', advance: { type: 'event', name: 'moved', count: 0 }, skippable: true },
    { id: 'a', title: 'A2', text: '   ', advance: { type: 'time', ms: 0 }, skippable: true },
    { id: 'b', title: 'B', text: 'Second.', advance: { type: 'any', of: [] }, skippable: true, onDone: [{ type: 'reveal' }] },
    { id: 'c', title: 'C', text: 'Third.', advance: { type: 'event', name: 'x' }, skippable: true, onDone: [{ type: 'reveal' }] },
    { id: 'finish', title: 'F', text: 'Last.', advance: { type: 'time', ms: 1 }, skippable: true },
    { id: 'late', title: 'L', text: 'Too late.', advance: { type: 'time', ms: 1 }, skippable: true },
  ];
  const res = validateSteps(broken);
  assert.equal(res.ok, false);
  const joined = res.errors.join(' | ');
  for (const needle of ['duplicate', 'text', 'count', 'time', 'at least one', 'exactly one', 'setSkin', 'finish']) {
    assert.match(joined, new RegExp(needle, 'i'));
  }
});

test('an empty tutorial is already done and safe to poke', () => {
  const t = new Tutorial([]);
  assert.equal(t.total(), 0);
  assert.equal(t.done(), true);
  assert.equal(t.current(), null);
  assert.equal(t.progress(), 1);
  assert.deepEqual(t.event('moved', 0), []);
  assert.deepEqual(t.button('show-pbr', 0), []);
  assert.deepEqual(t.tick(0), []);
  assert.deepEqual(t.skip(0), []);
  assert.deepEqual(t.skipAll(0), []);
});