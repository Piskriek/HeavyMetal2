import test from 'node:test'; import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createNarrator, finish, hashNarrator, say, step, trigger, FIDELITY_LINE_IDS, FIDELITY_TRIGGERS, fidelityRules, type Rules, type State } from '../src/index';

const rules: Rules = {
  lines: {
    intro: { id: 'intro', priority: 'story', seconds: 4 },
    next: { id: 'next', priority: 'story', seconds: 3, after: 'intro' },
    warn: { id: 'warn', priority: 'warn', seconds: 2, cooldown: 30 },
    bark: { id: 'bark', priority: 'bark', seconds: 2, cooldown: 10 },
    bark2: { id: 'bark2', priority: 'bark', seconds: 2 },
    bark3: { id: 'bark3', priority: 'bark', seconds: 2 },
  },
  triggers: { wake: ['intro'], go: ['next'], hurt: ['warn'], oops: ['bark'], either: ['intro', 'bark2'] },
  queueMax: 2,
  ttl: { story: Infinity, warn: 12, bark: 5 },
  gap: 0.5,
};

/** Run for `seconds` in steps of `dt`, collecting what started and what was cut. */
function run(s: State, seconds: number, dt = 0.1): { s: State; started: string[]; cut: string[] } {
  const started: string[] = [], cut: string[] = [];
  for (let t = 0; t < seconds - 1e-9; t += dt) {
    const r = step(rules, s, dt);
    s = r.state;
    if (r.start) started.push(r.start);
    if (r.cut) cut.push(r.cut);
  }
  return { s, started, cut };
}

test('a story line plays once, ever, even across a saved log', () => {
  let s = trigger(rules, createNarrator(), 'wake');
  const a = run(s, 6); s = a.s;
  assert.deepEqual(a.started, ['intro']);
  s = trigger(rules, s, 'wake');
  assert.deepEqual(run(s, 6).started, []);
  const restored = trigger(rules, createNarrator(['intro']), 'wake');
  assert.deepEqual(run(restored, 6).started, []);
});

test('story order: a line waits for the one it follows', () => {
  let s = trigger(rules, createNarrator(), 'go');
  assert.deepEqual(run(s, 5).started, [], 'next is not eligible before intro');
  s = trigger(rules, createNarrator(), 'wake');
  s = run(s, 6).s;
  s = trigger(rules, s, 'go');
  assert.deepEqual(run(s, 5).started, ['next']);
});

test('repeatable lines respect their cooldown', () => {
  let s = createNarrator(), started: string[] = [];
  for (let i = 0; i < 12; i++) {
    s = trigger(rules, s, 'oops');
    const r = run(s, 3); s = r.s; started = started.concat(r.started);
  }
  // 36 seconds of nagging, a 10 s cooldown: it plays at 0, about 12, 24 and 36 at most
  assert.ok(started.length >= 3 && started.length <= 4, `bark played ${started.length} times`);
});

test('a story line cuts a playing bark; nothing cuts a story line', () => {
  let s = say(rules, createNarrator(), 'bark2');
  let r = step(rules, s, 0.1); s = r.state;
  assert.equal(r.start, 'bark2');
  s = trigger(rules, s, 'wake');
  r = step(rules, s, 0.1); s = r.state;
  assert.equal(r.cut, 'bark2');
  const after = run(s, 2);
  assert.deepEqual(after.started, ['intro'], 'the story line starts after the gap');
  s = say(rules, after.s, 'warn');
  const during = run(s, 1.5);
  assert.deepEqual(during.cut, [], 'a warning never cuts a story line');
  assert.deepEqual(during.started, []);
});

test('a bark never interrupts anything; it waits', () => {
  let s = say(rules, createNarrator(), 'warn');
  s = step(rules, s, 0.1).state;
  s = say(rules, s, 'bark2');
  const r = run(s, 1.5);
  assert.deepEqual(r.cut, []);
  assert.deepEqual(run(r.s, 3).started, ['bark2']);
});

test('the queue is capped by dropping barks, never story lines', () => {
  let s = say(rules, createNarrator(), 'intro');
  s = step(rules, s, 0.1).state; // intro plays for 4 s
  for (const id of ['bark2', 'bark3', 'bark']) s = say(rules, s, id);
  assert.equal(s.queue.length, 2);
  s = say(rules, s, 'warn');
  assert.ok(s.queue.some((w) => w.id === 'warn'), 'the warning displaces a bark');
  assert.equal(s.queue.length, 2);
});

test('stale barks are dropped, story lines wait as long as it takes', () => {
  let s = say(rules, createNarrator(), 'intro');
  s = step(rules, s, 0.1).state; // intro plays for 4 s
  s = say(rules, say(rules, s, 'next'), 'bark2'); // next (3 s) then the bark: it would wait about 8 s, its ttl is 5
  const r = run(s, 12);
  assert.deepEqual(r.started, ['next'], 'the story line waited its turn; the stale bark never played');
  assert.ok(!r.s.queue.some((w) => w.id === 'bark2'), 'the stale bark left the queue');
});

test('a trigger picks the first eligible candidate', () => {
  let s = run(trigger(rules, createNarrator(), 'wake'), 6).s;
  s = trigger(rules, s, 'either');
  assert.deepEqual(run(s, 3).started, ['bark2'], 'intro is heard, so the bark goes');
});

test('lines keep a gap between them, and finish() frees the radio early', () => {
  let s = say(rules, say(rules, createNarrator(), 'intro'), 'warn');
  let r = step(rules, s, 0.1); s = r.state;
  assert.equal(r.start, 'intro');
  s = finish(rules, s, 'intro');
  r = step(rules, s, 0.2); s = r.state;
  assert.equal(r.start, null, 'still inside the gap');
  r = step(rules, s, 0.4);
  assert.equal(r.start, 'warn');
});

test('the radio log keeps every line in the order it first played', () => {
  let s = say(rules, createNarrator(), 'intro');
  s = run(s, 6).s;
  s = say(rules, s, 'bark2');
  s = run(s, 3).s;
  s = trigger(rules, s, 'go');
  s = run(s, 5).s;
  assert.deepEqual(s.heard, ['intro', 'bark2', 'next']);
});

test('determinism: the same events and steps give the same state', () => {
  const script = (): string => {
    let s = createNarrator();
    const events = ['wake', 'oops', 'hurt', 'go', 'oops', 'either', 'hurt'];
    for (let i = 0; i < 400; i++) {
      if (i % 37 === 0) s = trigger(rules, s, events[(i / 37) % events.length] ?? 'wake');
      s = step(rules, s, 0.05 + (i % 7) * 0.01).state;
    }
    return hashNarrator(s);
  };
  assert.equal(script(), script());
});

test('FIDELITY: every line in the table is voiced, and every voiced line is in the table', () => {
  const vo = path.resolve(import.meta.dirname, '../../../apps/web/public/vo');
  const files = fs.readdirSync(vo).filter((f) => f.endsWith('.mp3')).map((f) => f.slice(0, -4)).sort();
  assert.deepEqual([...FIDELITY_LINE_IDS].sort(), files);
  const r = fidelityRules(Object.fromEntries(files.map((id) => [id, 3])));
  assert.equal(Object.keys(r.lines).length, files.length);
  for (const line of Object.values(r.lines)) if (line.after) assert.ok(r.lines[line.after], `${line.id} follows a missing line`);
});

test('FIDELITY: Act I runs in order from waking to power on', () => {
  const r = fidelityRules(Object.fromEntries(FIDELITY_LINE_IDS.map((id) => [id, 2])));
  let s = createNarrator();
  const played: string[] = [];
  for (const ev of ['look:power-wall', 'wake', 'look:power-wall', 'breaker:thrown', 'power:on', 'look:window']) {
    s = trigger(r, s, ev);
    for (let i = 0; i < 40; i++) { const x = step(r, s, 0.1); s = x.state; if (x.start) played.push(x.start); }
  }
  assert.deepEqual(played, ['A1-01', 'A1-02', 'A1-03', 'A1-04', 'A2-01']);
});

test('FIDELITY: stage 2 plays the journal line A4-04 and skips S-2 (they share the event; A4-04 is listed first)', () => {
  assert.deepEqual(FIDELITY_TRIGGERS['stage:2'], ['A4-04', 'S-2']);
  assert.equal(FIDELITY_TRIGGERS['bloom:first'], undefined);
  const r = fidelityRules({ 'A4-04': 4, 'S-2': 4 });
  const played: string[] = [];
  let s = trigger(r, createNarrator([]), 'stage:2');
  for (let i = 0; i < 80; i++) { const x = step(r, s, 0.1); s = x.state; if (x.start) played.push(x.start); }
  assert.deepEqual(played, ['A4-04']);
  // once A4-04 is heard, the same stage event plays S-2 instead
  const again: string[] = [];
  let t = trigger(r, createNarrator(['A4-04']), 'stage:2');
  for (let i = 0; i < 80; i++) { const x = step(r, t, 0.1); t = x.state; if (x.start) again.push(x.start); }
  assert.deepEqual(again, ['S-2']);
});
