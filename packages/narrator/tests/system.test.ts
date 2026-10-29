// The drone's System voice (Plan 57 §8.1): notices carry their subject, a burst of one kind shows each in turn, story stays
// once-only, and every notice is tied to its event and reads with its subject.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createNarrator, noticeText, step, SYSTEM_NOTICE_IDS, SYSTEM_TRIGGERS, systemRules, trigger, type State } from '../src/index';

/** Runs the scheduler for `secs` in 0.1 s steps; returns each notice that started, with its words. */
function run(s0: State, secs: number): { readonly state: State; readonly shown: string[] } {
  const rules = systemRules();
  let s = s0;
  const shown: string[] = [];
  for (let i = 0; i < Math.round(secs * 10); i++) {
    const r = step(rules, s, 0.1);
    s = r.state;
    if (r.start) shown.push(noticeText(r.start, r.data) ?? `(${r.start})`);
  }
  return { state: s, shown };
}

test('a burst of one kind shows each notice in turn, each with its own subject', () => {
  const rules = systemRules();
  let s = createNarrator();
  for (const skill of ['Rock Drill', 'Ore Mill', 'Relay Cabinet']) s = trigger(rules, s, 'skill:gained', skill);
  assert.equal(s.queue.length, 3, 'all three wait');
  const { shown } = run(s, 20);
  assert.deepEqual(shown, ['Skill gained: Rock Drill.', 'Skill gained: Ore Mill.', 'Skill gained: Relay Cabinet.']);
});

test('the arrival is a story notice: once, ever, and first', () => {
  const rules = systemRules();
  let s = createNarrator();
  s = trigger(rules, s, 'quest:logged', 'Build a Stargate');
  s = trigger(rules, s, 'sim:arrive', 'Ada');
  s = trigger(rules, s, 'sim:arrive', 'Ada');
  const first = run(s, 15);
  assert.deepEqual(first.shown, ['System online. Welcome, Ada.', 'Quest logged: Build a Stargate.'], 'story first, then the quest; the second arrival is ignored');
  const again = run(trigger(rules, first.state, 'sim:arrive', 'Ada'), 10);
  assert.deepEqual(again.shown, [], 'a heard arrival never shows again');
});

test('a hint never nags: its cooldown holds back a second one', () => {
  const rules = systemRules();
  let { state } = run(trigger(rules, createNarrator(), 'hint', 'Hold E on a boulder for ore.'), 6);
  state = trigger(rules, state, 'hint', 'Hold E on a boulder for ore.');
  assert.deepEqual(run(state, 6).shown, [], 'within the cooldown');
});

test('every System notice is tied to an event and reads with its subject; one with no subject shows only its bare words', () => {
  const rules = systemRules();
  for (const id of SYSTEM_NOTICE_IDS) {
    assert.ok(rules.lines[id], id);
    assert.ok(Object.values(SYSTEM_TRIGGERS).some((ids) => ids.includes(id)), `${id} has an event`);
    assert.ok(noticeText(id, 'X')?.includes('X'), `${id} reads its subject`);
  }
  assert.equal(noticeText('SYS-ARRIVE'), 'System online.');
  assert.equal(noticeText('SYS-SKILL'), null, 'a skill notice with no skill shows nothing');
  assert.equal(noticeText('A1-01', 'X'), null, 'a mentor line is not a notice');
});
