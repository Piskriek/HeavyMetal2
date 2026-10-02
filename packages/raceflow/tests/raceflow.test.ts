import test from 'node:test';
import assert from 'node:assert/strict';
import { createRaceDirector, createChampionship, restoreChampionship, type DirectorEvent, type Progress } from '../src';

const ids = ['a', 'b', 'c'];
const P = (a: number, b: number, c: number, fin: [boolean, boolean, boolean] = [false, false, false]): Record<string, Progress> => ({ a: { progress: a, finished: fin[0] }, b: { progress: b, finished: fin[1] }, c: { progress: c, finished: fin[2] } });
const types = (ev: DirectorEvent[]): string[] => ev.map((e) => (e.type === 'phase' ? `phase:${e.phase}` : e.type === 'countdown' ? `cd:${e.value}` : e.type === 'finish' ? `fin:${e.id}#${e.position}` : e.type === 'dnf' ? `dnf:${e.id}` : 'results'));

test('director: countdown events, lights and the switch to racing', () => {
  const d = createRaceDirector({ racers: ids, laps: 3 });
  assert.equal(d.state.phase, 'lobby'); assert.deepEqual(d.update(100, P(0, 0, 0)), []);
  assert.deepEqual(types(d.start()), ['phase:countdown', 'cd:3']); assert.deepEqual(d.start(), []);
  assert.equal(d.state.lights, 3);
  assert.deepEqual(types(d.update(500, P(0, 0, 0))), []);
  assert.deepEqual(types(d.update(500, P(0, 0, 0))), ['cd:2']); assert.equal(d.state.lights, 2);
  assert.deepEqual(types(d.update(1000, P(0, 0, 0))), ['cd:1']);
  assert.deepEqual(types(d.update(1100, P(0, 0, 0))), ['cd:0', 'phase:racing']);
  assert.equal(d.state.phase, 'racing'); assert.equal(d.state.lights, 0); assert.ok(Math.abs(d.state.raceTimeMs - 100) < 1e-9, `leftover ${d.state.raceTimeMs}`);
  assert.deepEqual(d.update(-5, P(0, 0, 0)), []); assert.deepEqual(d.update(Number.NaN, P(0, 0, 0)), []);
});

function racing(cfg = {}) { const d = createRaceDirector({ racers: ids, laps: 3, ...cfg }); d.start(); d.update(3000, P(0, 0, 0)); return d; }

test('director: finishing order, live ranking, grace period and DNF, finished hold, results', () => {
  const d = racing({ finishGraceMs: 10000, finishedHoldMs: 1000 });
  assert.equal(d.state.phase, 'racing');
  d.update(5000, P(1, 2, 1.5));
  assert.deepEqual(d.state.order, [{ id: 'b', position: 1 }, { id: 'c', position: 2 }, { id: 'a', position: 3 }]);
  assert.deepEqual(types(d.update(1000, P(2.5, 3, 2.9, [false, true, false]))), ['fin:b#1']);
  assert.equal(d.state.finishTimes['b'], 6000);
  assert.deepEqual(d.state.order[0], { id: 'b', position: 1 });
  assert.deepEqual(types(d.update(2000, P(3, 3, 2.99, [true, true, false]))), ['fin:a#2']);
  assert.deepEqual(types(d.update(7999, P(3, 3, 2.99, [true, true, false]))), []);
  assert.deepEqual(types(d.update(2, P(3, 3, 2.99, [true, true, false]))), ['dnf:c', 'phase:finished']);
  assert.deepEqual(d.state.dnf, ['c']);
  assert.deepEqual(types(d.update(999, P(3, 3, 2.99, [true, true, false]))), []);
  const end = d.update(2, P(3, 3, 2.99, [true, true, false]));
  assert.deepEqual(types(end), ['phase:results', 'results']);
  const res = end[1]!; assert.equal(res.type, 'results');
  if (res.type === 'results') assert.deepEqual(res.results, [{ id: 'b', position: 1, timeMs: 6000 }, { id: 'a', position: 2, timeMs: 8000 }, { id: 'c', position: 3, dnf: true }]);
  assert.deepEqual(d.update(5000, P(3, 3, 3)), []);
});

test('director: simultaneous finishers are ordered by progress then by racer order; everybody finishing ends the race at once', () => {
  const d = racing({ finishedHoldMs: 500 });
  const ev = d.update(1000, P(3.2, 3.5, 3.5, [true, true, true]));
  assert.deepEqual(types(ev), ['fin:b#1', 'fin:c#2', 'fin:a#3', 'phase:finished']);
  assert.deepEqual(types(d.update(600, P(3.2, 3.5, 3.5, [true, true, true]))), ['phase:results', 'results']);
});

test('director: max race time and abort', () => {
  const d = racing({ maxRaceMs: 2000 });
  assert.deepEqual(types(d.update(2000, P(1, 1, 1))), ['dnf:a', 'dnf:b', 'dnf:c', 'phase:finished']);
  const e = racing(); const ev = e.abort();
  assert.deepEqual(types(ev), ['dnf:a', 'dnf:b', 'dnf:c', 'phase:results', 'results']); assert.equal(e.state.phase, 'results');
  assert.deepEqual(e.abort(), []);
  assert.deepEqual(types(e.start()), ['phase:countdown', 'cd:3']);
});

test('director: snapshot and restore continue identically', () => {
  const a = racing({ finishGraceMs: 5000 }); a.update(3000, P(1, 2, 1.5)); a.update(500, P(3, 3, 2, [false, true, false]));
  const b = createRaceDirector({ racers: ['x'], laps: 1 }); b.restore(a.snapshot());
  assert.deepEqual(b.state, a.state);
  const run = (d: typeof a): string[] => [...types(d.update(4000, P(3, 3, 2.5, [true, true, false]))), ...types(d.update(2000, P(3, 3, 2.5, [true, true, false]))), ...types(d.update(2000, P(3, 3, 2.5, [true, true, false])))];
  assert.deepEqual(run(b), run(a));
  assert.throws(() => b.restore('not json'), /restore|json|invalid/i); assert.throws(() => b.restore('{"a":1}'), /restore|shape|invalid/i);
});

const R = (id: string, position: number, dnf = false) => ({ id, position, ...(dnf ? { dnf: true } : {}) });
test('championship: points, wins, tie-breaks, winner, snapshot', () => {
  const c = createChampionship({ raceIds: ['r1', 'r2', 'r3'], racers: ['a', 'b', 'c'] });
  assert.deepEqual(c.current(), { index: 0, raceId: 'r1' }); assert.equal(c.finished, false); assert.equal(c.winner, null);
  c.record([R('a', 1), R('b', 2), R('c', 3)]);
  assert.deepEqual(c.table().map((r) => [r.id, r.points, r.wins]), [['a', 25, 1], ['b', 18, 0], ['c', 15, 0]]);
  c.record([R('b', 1), R('a', 2), R('c', 3, true)]);
  assert.deepEqual(c.table().map((r) => [r.id, r.points, r.wins, r.best]), [['a', 43, 1, 1], ['b', 43, 1, 1], ['c', 15, 0, 3]]);
  assert.deepEqual(c.current(), { index: 2, raceId: 'r3' });
  const mid = restoreChampionship(c.snapshot()); assert.deepEqual(mid.table(), c.table()); assert.equal(mid.index, 2);
  c.record([R('c', 1)]);
  assert.equal(c.finished, true); assert.equal(c.current(), null); assert.equal(c.winner, 'a'.length ? c.table()[0]!.id : null);
  assert.deepEqual(c.table().map((r) => [r.id, r.points]), [['c', 40], ['a', 43], ['b', 43]].sort((x, y) => (y[1] as number) - (x[1] as number) || String(x[0]).localeCompare(String(y[0]))));
  assert.throws(() => c.record([R('a', 1)]), /over|finished/i);
  assert.equal(c.history().length, 3);
});
test('championship: validation', () => {
  const c = createChampionship({ raceIds: ['r1'], racers: ['a', 'b'] });
  assert.throws(() => c.record([R('zzz', 1)]), /zzz|unknown/i);
  assert.throws(() => restoreChampionship('{'), /restore|json|invalid/i);
  const tie = createChampionship({ raceIds: ['r1', 'r2'], racers: ['x', 'y'] });
  tie.record([R('x', 1), R('y', 2)]); tie.record([R('y', 1), R('x', 2)]);
  assert.deepEqual(tie.table().map((r) => r.id), ['x', 'y']);
});
