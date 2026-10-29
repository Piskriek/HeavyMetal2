// The drone's System voice (Plan 57 §8.1): its notices answer real events in the drone's memory and the simulation, show one at
// a time with their subjects, and are logged; the arrival is heard once.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mastered } from '@hm/harness';
import { createDroneMemory, noteCatalyst, type DroneMemory } from './drone-memory';
import { DRONE_SKILLS, SYSTEM_LOG_MAX, SystemVoice, droneNotices, readSystemLog } from './system-voice';

/** Steps the voice for `secs` in 0.1 s steps; the words of each notice as it first shows. */
function watch(v: SystemVoice, secs: number): string[] {
  const seen: string[] = [];
  let last: unknown = null;
  for (let i = 0; i < Math.round(secs * 10); i++) {
    const n = v.step(0.1);
    if (n && n !== last) seen.push(n.text);
    last = n;
  }
  return seen;
}

test('a drone preset mastered is a skill gained, at the step it becomes mastered and not before', () => {
  let m: DroneMemory = createDroneMemory();
  let gained: { event: string; data: string }[] = [];
  for (let t = 1; t <= 40 && gained.length === 0; t++) {
    const next = noteCatalyst(m, { kind: 'down' }, t * 10, 3);
    const notices = droneNotices(m, next).filter((n) => n.event === 'skill:gained');
    if (notices.length) {
      assert.equal(mastered(m.presets.fire), false, 'not mastered the step before');
      assert.equal(mastered(next.presets.fire), true, 'mastered at this step');
      gained = notices;
    }
    m = next;
  }
  assert.deepEqual(gained, [{ event: 'skill:gained', data: DRONE_SKILLS.fire }]);
  assert.deepEqual(droneNotices(m, noteCatalyst(m, { kind: 'down' }, 999, 3)).filter((n) => n.event === 'skill:gained'), [], 'already mastered: no second notice');
});

test('the System shows its notices one at a time with their subjects, logs them, and greets once', () => {
  const v = new SystemVoice();
  v.trigger('sim:arrive', 'Ada');
  v.trigger('skill:gained', 'Steady Fire');
  v.trigger('stage:up', '4');
  assert.deepEqual(watch(v, 20), ['System online. Welcome, Ada.', 'Level up: Stage 4.', 'Skill gained: Steady Fire.']);
  assert.deepEqual(v.log().map((n) => n.id), ['SYS-ARRIVE', 'SYS-LEVEL', 'SYS-SKILL']);
  assert.equal(v.step(0.1), null, 'quiet between notices');
  // the next session starts from what was heard: no second greeting
  const next = new SystemVoice(v.heard());
  next.trigger('sim:arrive', 'Ada');
  assert.deepEqual(watch(next, 8), []);
});

test('a notice with no subject it needs shows nothing; the arrival has its own bare words', () => {
  const v = new SystemVoice();
  v.trigger('skill:gained');
  assert.equal(v.step(0.1), null, 'nothing queued for a skill with no name');
  v.trigger('sim:arrive');
  v.trigger('quest:logged', 'Restore Presence');
  assert.deepEqual(watch(v, 12), ['System online.', 'Quest logged: Restore Presence.'], 'the quest follows at once: no silent notice held the slot');
});

test('the log of what was learned is kept: a new session starts from it, and a damaged save reads as an empty log', () => {
  const v = new SystemVoice();
  v.trigger('sim:arrive', 'Ada');
  watch(v, 6);
  const saved = JSON.stringify(v.log());
  const next = new SystemVoice(v.heard(), readSystemLog(saved));
  next.trigger('quest:logged', 'Restore Presence');
  watch(next, 6);
  assert.deepEqual(next.log().map((n) => n.text), ['System online. Welcome, Ada.', 'Quest logged: Restore Presence.']);
  assert.deepEqual(readSystemLog('not json'), []);
  assert.deepEqual(readSystemLog(JSON.stringify([{ id: 'SYS-SKILL' }, 7, null])), [], 'only well-formed notices');
  const many = Array.from({ length: SYSTEM_LOG_MAX + 5 }, (_, i) => ({ id: 'SYS-HINT', text: `Hint: ${i}`, at: i }));
  assert.equal(readSystemLog(JSON.stringify(many)).length, SYSTEM_LOG_MAX, 'it keeps the newest');
});
