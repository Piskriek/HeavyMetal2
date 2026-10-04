// tests/questline.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  START, TUTORIAL, advance, check, current, skip, targets, validate,
  type Cond, type PlayerState, type Progress, type Questline, type Reward,
} from '../src/index';

const line: Questline = { id: 'main', title: 'Main', quests: [
  { id: 'wake', title: 'Wake up', steps: [{ id: 'walk', text: 'Walk', until: { count: 'moved', atLeast: 3 } }], reward: { credits: 10 } },
  { id: 'base', title: 'A base', steps: [
    { id: 'block', text: 'Place a block', target: 'island.slot.toy-brick', until: { count: 'placed', atLeast: 1 } },
    { id: 'paint', text: 'Paint it', target: 'island.tab.F2', until: { count: 'painted', atLeast: 1 } }], reward: { credits: 20, unlock: ['portal'] } },
] };
const st = (counts: Record<string, number>): PlayerState => ({ counts, owns: [], done: [] });
test('conditions', () => {
  assert.equal(check({ all: [{ count: 'a', atLeast: 1 }, { not: { owns: 'x' } }] }, st({ a: 1 })), true);
  assert.equal(check({ any: [{ count: 'a', atLeast: 2 }, { done: 'q' }] }, st({ a: 1 })), false);
});
test('advances through steps and quests, paying once', () => {
  assert.deepEqual(validate(line), []);
  let r = advance(line, st({ moved: 3 }), START);
  assert.equal(r.progress.quest, 'base'); assert.equal(r.progress.step, 0);
  assert.deepEqual(r.rewards, [{ credits: 10 }]);
  r = advance(line, st({ moved: 3, placed: 1 }), r.progress);
  assert.equal(r.progress.step, 1); assert.deepEqual(r.rewards, []);
  r = advance(line, st({ moved: 3, placed: 1, painted: 1 }), r.progress);
  assert.equal(r.progress.quest, null); assert.deepEqual(r.progress.finished, ['wake', 'base']);
  assert.deepEqual(r.rewards, [{ credits: 20, unlock: ['portal'] }]);
  assert.equal(current(line, st({}), r.progress), null);
  assert.deepEqual(targets(line), ['island.slot.toy-brick', 'island.tab.F2']);
});

test('requires gates a quest', () => {
  const gated: Questline = { id: 'g', title: 'G', quests: [
    { id: 'a', title: 'A', steps: [{ id: 's1', text: 'dig', until: { count: 'dug', atLeast: 1 } }], reward: {} },
    { id: 'b', title: 'B', requires: { owns: 'key' }, steps: [{ id: 's2', text: 'open', until: { count: 'opened', atLeast: 1 } }], reward: { credits: 5 } },
  ] };
  assert.deepEqual(validate(gated), []);
  const noKey: PlayerState = { counts: { dug: 1 }, owns: [], done: [] };
  let r = advance(gated, noKey, START);
  assert.deepEqual(r.progress.finished, ['a']);
  assert.equal(r.progress.quest, null);                       // b is gated
  assert.equal(current(gated, noKey, r.progress), null);
  const withKey: PlayerState = { counts: { dug: 1 }, owns: ['key'], done: ['a'] };
  assert.equal(current(gated, withKey, r.progress), 'b');
  r = advance(gated, withKey, r.progress);
  assert.equal(r.progress.quest, 'b'); assert.equal(r.progress.step, 0);
  assert.deepEqual(r.rewards, []);                            // not finished, nothing paid
});

test('skip moves past steps and lets advance finish the quest', () => {
  const s: PlayerState = { counts: {}, owns: [], done: [] };
  let p = advance(line, s, START).progress;                   // stuck on wake / walk
  assert.equal(p.quest, 'wake'); assert.equal(p.step, 0);
  p = skip(line, p);                                          // skip the only step
  assert.equal(p.step, 1);
  const r = advance(line, s, p);                              // wake finishes via skip
  assert.deepEqual(r.rewards, [{ credits: 10 }]);
  assert.equal(r.progress.quest, 'base'); assert.equal(r.progress.step, 0);
  assert.deepEqual(skip(line, START), START);                 // nothing active: no-op copy
});

test('validate finds duplicates and bad conditions', () => {
  const dupQuests: Questline = { id: 'd', title: 'D', quests: [
    { id: 'same', title: 'One', steps: [{ id: 'x', text: 'x', until: { count: 'c', atLeast: 1 } }], reward: {} },
    { id: 'same', title: 'Two', steps: [{ id: 'y', text: 'y', until: { count: 'c', atLeast: 1 } }], reward: {} },
  ] };
  assert.ok(validate(dupQuests).some((m) => m.includes('duplicate quest id')));

  const dupSteps: Questline = { id: 'd2', title: 'D2', quests: [
    { id: 'q', title: 'Q', steps: [
      { id: 's', text: 'a', until: { count: 'c', atLeast: 1 } },
      { id: 's', text: 'b', until: { count: 'c', atLeast: 2 } }], reward: {} },
  ] };
  assert.ok(validate(dupSteps).some((m) => m.includes('duplicate step id')));

  const bad: Questline = { id: 'b', title: 'B', quests: [
    { id: 'q', title: 'Q', steps: [
      { id: 's', text: 'x', until: { done: 'ghost' } },                       // unknown quest
      { id: 's2', text: 'y', until: { count: 'c' } as unknown as Cond },      // missing atLeast
    ], reward: { credits: -5 } },                                             // negative reward
    { id: 'empty', title: 'E', steps: [], reward: {} },                       // no steps
  ] };
  const problems = validate(bad);
  assert.ok(problems.some((m) => m.includes('unknown quest "ghost"')));
  assert.ok(problems.some((m) => m.includes('atLeast')));
  assert.ok(problems.some((m) => m.includes('credits')));
  assert.ok(problems.some((m) => m.includes('no steps')));

  let deep: Cond = { count: 'c', atLeast: 1 };
  for (let i = 0; i < 20; i += 1) deep = { not: deep };                       // 21 levels deep
  const deepLine: Questline = { id: 'dp', title: 'Dp', quests: [
    { id: 'q', title: 'Q', steps: [{ id: 's', text: 'x', until: deep }], reward: {} }] };
  assert.ok(validate(deepLine).some((m) => m.includes('nested deeper')));
});

test('rewards pay once', () => {
  const done: PlayerState = { counts: { moved: 3, placed: 1, painted: 1 }, owns: [], done: [] };
  const first = advance(line, done, START);
  assert.equal(first.rewards.length, 2);
  // Replay with finished cleared but rewarded kept: quests re-finish, nothing is paid again.
  const replay: Progress = { quest: null, step: 0, finished: [], rewarded: [...first.progress.rewarded] };
  const second = advance(line, done, replay);
  assert.deepEqual(second.rewards, []);
  assert.deepEqual(second.progress.finished, ['wake', 'base']);
  // Advancing an already-complete progress also pays nothing.
  assert.deepEqual(advance(line, done, first.progress).rewards, []);
});

test('nested all/any/not', () => {
  const s: PlayerState = { counts: { gears: 2 }, owns: ['wrench'], done: ['base'] };
  const c: Cond = { all: [
    { any: [{ done: 'rocket' }, { all: [{ owns: 'wrench' }, { count: 'gears', atLeast: 2 }] }] },
    { not: { any: [{ owns: 'curse' }, { count: 'strikes', atLeast: 3 }] } },
  ] };
  assert.equal(check(c, s), true);
  assert.equal(check(c, { ...s, owns: ['wrench', 'curse'] }), false);         // not-branch flips
  assert.equal(check(c, { ...s, counts: { gears: 1 } }), false);              // inner all fails
  assert.equal(check({ not: c }, s), false);
});

test('tutorial questline is well formed and ends with the rocket', () => {
  assert.deepEqual(validate(TUTORIAL), []);
  const counts: Record<string, number> = {
    'camera-moved': 1, moved: 9, 'placed:toy-brick': 4, 'placed:roof': 1,
    'placed:generator': 1, 'placed:assembler': 1, wired: 1,
    'placed:portal-frame': 8, 'used:crystal': 1,
    'placed:launch-pad': 1, fueled: 1, launched: 1,
  };
  let p: Progress = START;
  let paid: Reward[] = [];
  for (let i = 0; i < 6; i += 1) {                            // game loop: caller mirrors finished into done
    const s: PlayerState = { counts, owns: [], done: [...p.finished] };
    const r = advance(TUTORIAL, s, p);
    p = r.progress; paid = paid.concat(r.rewards);
  }
  assert.deepEqual(p.finished, ['wake', 'base', 'machines', 'portal', 'rocket']);
  assert.deepEqual(paid.flatMap((r) => r.unlock ?? []), ['machines', 'portal', 'class:shaman', 'space']);
  assert.equal(paid.reduce((sum, r) => sum + (r.credits ?? 0), 0), 385);
  assert.equal(targets(TUTORIAL).length, 9);
});