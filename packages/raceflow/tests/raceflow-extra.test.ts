import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createRaceDirector,
  createChampionship,
  restoreChampionship,
  type DirectorEvent,
  type Progress,
} from '../src';

const types = (ev: DirectorEvent[]): string[] =>
  ev.map((e) =>
    e.type === 'phase'
      ? `phase:${e.phase}`
      : e.type === 'countdown'
        ? `cd:${e.value}`
        : e.type === 'finish'
          ? `fin:${e.id}#${e.position}`
          : e.type === 'dnf'
            ? `dnf:${e.id}`
            : 'results'
  );

const P3 = (a: number, b: number, c: number, fin: [boolean, boolean, boolean] = [false, false, false]): Record<string, Progress> => ({
  a: { progress: a, finished: fin[0] },
  b: { progress: b, finished: fin[1] },
  c: { progress: c, finished: fin[2] },
});

test('extra: custom countdown lengths use 2/3 and 1/3 thresholds', () => {
  const d = createRaceDirector({ racers: ['a', 'b'], laps: 2, countdownMs: 6000 });
  assert.deepEqual(types(d.start()), ['phase:countdown', 'cd:3']);
  assert.equal(d.state.lights, 3);
  assert.deepEqual(types(d.update(1000, { a: { progress: 0, finished: false }, b: { progress: 0, finished: false } })), []);
  assert.equal(d.state.lights, 3); // 5000 left -> ceil(2.5)=3
  assert.deepEqual(types(d.update(1000, { a: { progress: 0, finished: false }, b: { progress: 0, finished: false } })), ['cd:2']);
  assert.equal(d.state.lights, 2);
  assert.deepEqual(types(d.update(2000, { a: { progress: 0, finished: false }, b: { progress: 0, finished: false } })), ['cd:1']);
  assert.equal(d.state.lights, 1);
  assert.deepEqual(types(d.update(2000, { a: { progress: 0, finished: false }, b: { progress: 0, finished: false } })), ['cd:0', 'phase:racing']);
  assert.equal(d.state.lights, 0);
  assert.equal(d.state.raceTimeMs, 0);
});

test('extra: single racer race finishes at once', () => {
  const d = createRaceDirector({ racers: ['solo'], laps: 5 });
  d.start();
  d.update(3000, { solo: { progress: 0, finished: false } });
  assert.equal(d.state.phase, 'racing');
  const ev = d.update(1000, { solo: { progress: 5.1, finished: true } });
  assert.deepEqual(types(ev), ['fin:solo#1', 'phase:finished']);
  const end = d.update(1500, { solo: { progress: 5.1, finished: true } });
  assert.deepEqual(types(end), ['phase:results', 'results']);
  const res = end[1]!;
  assert.equal(res.type, 'results');
  if (res.type === 'results') {
    assert.deepEqual(res.results, [{ id: 'solo', position: 1, timeMs: 1000 }]);
  }
});

test('extra: laps config is ignored for logic', () => {
  const mk = (laps: number) => {
    const d = createRaceDirector({ racers: ['a', 'b'], laps });
    d.start();
    d.update(3000, { a: { progress: 0, finished: false }, b: { progress: 0, finished: false } });
    return d;
  };
  const d1 = mk(1);
  const d99 = mk(99);
  const e1 = types(d1.update(500, { a: { progress: 1.5, finished: false }, b: { progress: 0.5, finished: false } }));
  const e99 = types(d99.update(500, { a: { progress: 1.5, finished: false }, b: { progress: 0.5, finished: false } }));
  assert.deepEqual(e1, e99);
  const f1 = types(d1.update(500, { a: { progress: 2, finished: true }, b: { progress: 1, finished: false } }));
  const f99 = types(d99.update(500, { a: { progress: 2, finished: true }, b: { progress: 1, finished: false } }));
  assert.deepEqual(f1, f99);
  assert.deepEqual(f1, ['fin:a#1']);
});

test('extra: 12 racers, only ten score', () => {
  const racers = Array.from({ length: 12 }, (_, i) => `p${i + 1}`);
  const c = createChampionship({ raceIds: ['gp1'], racers });
  c.record(racers.map((id, i) => ({ id, position: i + 1 })));
  const t = c.table();
  const pts = new Map(t.map((r) => [r.id, r.points] as const));
  assert.equal(pts.get('p1'), 25);
  assert.equal(pts.get('p2'), 18);
  assert.equal(pts.get('p3'), 15);
  assert.equal(pts.get('p4'), 12);
  assert.equal(pts.get('p5'), 10);
  assert.equal(pts.get('p6'), 8);
  assert.equal(pts.get('p7'), 6);
  assert.equal(pts.get('p8'), 4);
  assert.equal(pts.get('p9'), 2);
  assert.equal(pts.get('p10'), 1);
  assert.equal(pts.get('p11'), 0);
  assert.equal(pts.get('p12'), 0);
  // order: p1..p10 then p11 (best 11) then p12 (best 12)
  assert.deepEqual(t.map((r) => r.id), [...racers]);
});

test('extra: DNF-only championship race gives no points and id order', () => {
  const c = createChampionship({ raceIds: ['r1'], racers: ['b', 'a'] });
  c.record([
    { id: 'a', position: 1, dnf: true },
    { id: 'b', position: 2, dnf: true },
  ]);
  const t = c.table();
  assert.deepEqual(t.map((r) => [r.id, r.points, r.wins, r.best]), [
    ['a', 0, 0, 0],
    ['b', 0, 0, 0],
  ]);
  assert.equal(c.finished, true);
  assert.equal(c.winner, 'a');
});

test('extra: restore championship mid-way and continue identically', () => {
  const mk = () => createChampionship({ raceIds: ['r1', 'r2', 'r3'], racers: ['a', 'b', 'c'] });
  const orig = mk();
  orig.record([
    { id: 'a', position: 1 },
    { id: 'b', position: 2 },
  ]);
  const snap = orig.snapshot();
  const copy = restoreChampionship(snap);
  assert.deepEqual(copy.table(), orig.table());
  assert.equal(copy.index, 1);
  const second: { id: string; position: number }[] = [
    { id: 'b', position: 1 },
    { id: 'c', position: 2 },
  ];
  orig.record(second);
  copy.record(second);
  assert.deepEqual(copy.table(), orig.table());
  assert.deepEqual(copy.history(), orig.history());
  orig.record([{ id: 'c', position: 1 }]);
  copy.record([{ id: 'c', position: 1 }]);
  assert.equal(copy.finished, true);
  assert.equal(copy.winner, orig.winner);
  assert.deepEqual(copy.table(), orig.table());
});

test('extra: deterministic replay of a scripted race twice', () => {
  const script: { dt: number; prog: Record<string, Progress> }[] = [
    { dt: 3000, prog: P3(0, 0, 0) },
    { dt: 1000, prog: P3(1, 1.2, 0.8) },
    { dt: 1000, prog: P3(2, 2.5, 2.1) },
    { dt: 500, prog: P3(3, 3.1, 2.9, [true, true, false]) },
    { dt: 5000, prog: P3(3, 3.1, 2.95, [true, true, false]) },
  ];
  const runOnce = () => {
    const d = createRaceDirector({ racers: ['a', 'b', 'c'], laps: 3, finishGraceMs: 6000, finishedHoldMs: 1000 });
    const out: string[] = [...types(d.start())];
    for (const s of script) out.push(...types(d.update(s.dt, s.prog)));
    // drain to results
    out.push(...types(d.update(1000, P3(3, 3.1, 2.95, [true, true, false]))));
    out.push(...types(d.update(1000, P3(3, 3.1, 2.95, [true, true, false]))));
    return { out, snap: d.snapshot(), phase: d.state.phase };
  };
  const r1 = runOnce();
  const r2 = runOnce();
  assert.deepEqual(r1.out, r2.out);
  assert.equal(r1.snap, r2.snap);
  assert.equal(r1.phase, r2.phase);
});

test('extra: abort from countdown marks everyone DNF', () => {
  const d = createRaceDirector({ racers: ['a', 'b', 'c'], laps: 3 });
  d.start();
  d.update(500, P3(0, 0, 0));
  const ev = d.abort();
  assert.deepEqual(types(ev), ['dnf:a', 'dnf:b', 'dnf:c', 'phase:results', 'results']);
  assert.equal(d.state.phase, 'results');
  const last = ev[ev.length - 1]!;
  assert.equal(last.type, 'results');
  if (last.type === 'results') {
    assert.deepEqual(
      last.results.map((r) => r.id),
      ['a', 'b', 'c']
    );
    assert.ok(last.results.every((r) => r.dnf === true));
  }
});

test('extra: abort from lobby and results returns [], start from results resets', () => {
  const d = createRaceDirector({ racers: ['a', 'b'], laps: 1 });
  assert.deepEqual(d.abort(), []);
  d.start();
  d.update(3000, { a: { progress: 0, finished: false }, b: { progress: 0, finished: false } });
  const ev = d.abort();
  assert.deepEqual(types(ev), ['dnf:a', 'dnf:b', 'phase:results', 'results']);
  assert.deepEqual(d.abort(), []);
  assert.deepEqual(types(d.start()), ['phase:countdown', 'cd:3']);
  assert.equal(d.state.phase, 'countdown');
  assert.equal(d.state.raceTimeMs, 0);
  assert.deepEqual(d.state.dnf, []);
  assert.deepEqual(d.state.finishTimes, {});
});

test('extra: snapshot and restore during countdown continues identically', () => {
  const mk = () => createRaceDirector({ racers: ['a', 'b', 'c'], laps: 3 });
  const a = mk();
  a.start();
  a.update(500, P3(0, 0, 0));
  const snap = a.snapshot();
  const b = createRaceDirector({ racers: ['zzz'], laps: 9 });
  b.restore(snap);
  assert.deepEqual(b.state, a.state);
  const seq: string[] = [];
  const seq2: string[] = [];
  seq.push(...types(a.update(600, P3(0, 0, 0))));
  seq2.push(...types(b.update(600, P3(0, 0, 0))));
  seq.push(...types(a.update(2000, P3(0, 0, 0))));
  seq2.push(...types(b.update(2000, P3(0, 0, 0))));
  assert.deepEqual(seq, seq2);
  assert.deepEqual(b.state, a.state);
  assert.deepEqual(b.snapshot(), a.snapshot());
});

test('extra: large dt crosses all countdown thresholds at once with leftover', () => {
  const d = createRaceDirector({ racers: ['a'], laps: 1 });
  d.start();
  const ev = d.update(5000, { a: { progress: 0, finished: false } });
  assert.deepEqual(types(ev), ['cd:2', 'cd:1', 'cd:0', 'phase:racing']);
  assert.equal(d.state.phase, 'racing');
  assert.ok(Math.abs(d.state.raceTimeMs - 2000) < 1e-9);
  assert.equal(d.state.lights, 0);
});

test('extra: finisher in the same update as grace expiry still finishes', () => {
  const d = createRaceDirector({ racers: ['a', 'b', 'c'], laps: 3, finishGraceMs: 2000, finishedHoldMs: 500 });
  d.start();
  d.update(3000, P3(0, 0, 0));
  assert.deepEqual(types(d.update(1000, P3(1, 2, 1, [false, true, false]))), ['fin:b#1']);
  // deadline = 1000 + 2000 = 3000 ; jump to exactly 3000 with 'a' finishing
  const ev = d.update(2000, P3(3, 3, 1.5, [true, true, false]));
  assert.deepEqual(types(ev), ['fin:a#2', 'dnf:c', 'phase:finished']);
});

test('extra: table tie-break by best finish then id', () => {
  const c = createChampionship({ raceIds: ['a', 'b'], racers: ['p', 'q', 'r'] });
  c.record([
    { id: 'r', position: 1 },
    { id: 'p', position: 2 },
    { id: 'q', position: 3 },
  ]);
  c.record([
    { id: 'r', position: 1 },
    { id: 'p', position: 4 },
    { id: 'q', position: 3 },
  ]);
  // r: 50pts, p: 18+12=30 best2, q:15+15=30 best3
  const t = c.table();
  assert.deepEqual(t.map((r) => r.id), ['r', 'p', 'q']);
  assert.deepEqual(t.map((r) => [r.points, r.wins, r.best]), [
    [50, 2, 1],
    [30, 0, 2],
    [30, 0, 3],
  ]);
});

test('extra: missing racers in record count as DNF', () => {
  const c = createChampionship({ raceIds: ['r1'], racers: ['a', 'b', 'c'] });
  c.record([{ id: 'a', position: 1 }]);
  const t = c.table();
  assert.deepEqual(t.map((r) => [r.id, r.points, r.wins, r.best]), [
    ['a', 25, 1, 1],
    ['b', 0, 0, 0],
    ['c', 0, 0, 0],
  ]);
  assert.equal(c.finished, true);
  assert.equal(c.winner, 'a');
});
