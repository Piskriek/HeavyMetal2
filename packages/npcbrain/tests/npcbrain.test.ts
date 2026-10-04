import test from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32, newBrain, think, type Agent, type Behaviour, type Vec3 } from '../src/index';
const agent = (x = 0, z = 0): Agent => ({ pos: [x, 0, z], yaw: 0, speed: 2, sight: 10, reaction: 0.5 });
const run = (a: Agent, b: Behaviour, target: Vec3 | null, steps: number, dt = 0.1): Agent => {
  let brain = newBrain(b), cur = a;
  for (let i = 0; i < steps; i++) { const s = think(cur, b, brain, target, dt); brain = s.brain; cur = { ...cur, pos: s.pos, yaw: s.yaw }; }
  return cur;
};
const dist = (p: Vec3, q: Vec3): number => Math.hypot(p[0] - q[0], p[2] - q[2]);

test('the seeded random is mulberry32', () => {
  const r = mulberry32(1); const a = r(), b = r();
  assert.ok(a >= 0 && a < 1 && b >= 0 && b < 1 && a !== b);
  assert.equal(mulberry32(1)(), a);
});
test('walk-to moves at speed, faces the way, stops on arrival', () => {
  const b: Behaviour = { kind: 'walk-to', point: [0, 0, 10] };
  const s = think(agent(), b, newBrain(b), null, 1);
  assert.ok(Math.abs(s.pos[2] - 2) < 1e-9 && s.moving); assert.ok(Math.abs(s.yaw) < 1e-9);
  const end = run(agent(), b, null, 80);
  assert.ok(dist(end.pos, [0, 0, 10]) <= 0.3);
});
test('chase waits for the reaction time, then closes in; out of sight it stands', () => {
  const b: Behaviour = { kind: 'chase' };
  let brain = newBrain(b);
  const first = think(agent(), b, brain, [6, 0, 0], 0.1); brain = first.brain;
  assert.equal(first.moving, false);
  const later = run(agent(), b, [6, 0, 0], 20);
  assert.ok(dist(later.pos, [6, 0, 0]) < 6);
  const far = run(agent(), b, [50, 0, 0], 20);
  assert.ok(dist(far.pos, [0, 0, 0]) < 1e-9);
});
test('flee runs away', () => {
  const end = run(agent(), { kind: 'flee' }, [3, 0, 0], 30);
  assert.ok(end.pos[0] < -1);
});
test('patrol visits its points in order and comes back', () => {
  const b: Behaviour = { kind: 'patrol', points: [[4, 0, 0], [4, 0, 4]], mode: 'loop', wait: 3 };
  assert.ok(dist(run(agent(), b, null, 25).pos, [4, 0, 0]) <= 0.31);
  assert.ok(dist(run(agent(), b, null, 75).pos, [4, 0, 4]) <= 0.31);
});
test('follow keeps its distance', () => {
  const end = run(agent(), { kind: 'follow', distance: 3 }, [10, 0, 0], 100);
  const d = dist(end.pos, [10, 0, 0]);
  assert.ok(d >= 2.7 && d <= 3.6, String(d));
});
test('wander stays near home and is repeatable', () => {
  const b: Behaviour = { kind: 'wander', home: [0, 0, 0], radius: 5, seed: 7 };
  const a = run(agent(), b, null, 200), c = run(agent(), b, null, 200);
  assert.deepEqual(a.pos, c.pos); assert.ok(dist(a.pos, [0, 0, 0]) <= 5.3);
});

/* ------------------------------------------------------------------ extras */

test('mulberry32 spreads over [0, 1) and every seed starts somewhere else', () => {
  const r = mulberry32(1234);
  let lo = 1, hi = 0, sum = 0;
  for (let i = 0; i < 1000; i++) {
    const v = r();
    assert.ok(v >= 0 && v < 1, String(v));
    lo = Math.min(lo, v); hi = Math.max(hi, v); sum += v;
  }
  assert.ok(hi - lo > 0.9, `${lo} ${hi}`);
  assert.ok(Math.abs(sum / 1000 - 0.5) < 0.05, String(sum / 1000));
  assert.notEqual(mulberry32(1)(), mulberry32(2)());
});

test('newBrain tags the brain with the behaviour it was made for', () => {
  const all: Behaviour[] = [
    { kind: 'stand' },
    { kind: 'chase' },
    { kind: 'flee' },
    { kind: 'follow', distance: 2 },
    { kind: 'walk-to', point: [0, 0, 0] },
    { kind: 'patrol', points: [], mode: 'loop', wait: 0 },
    { kind: 'wander', home: [0, 0, 0], radius: 1, seed: 1 },
  ];
  for (const b of all) assert.equal(newBrain(b).kind, b.kind);
});

test('a brain left over from another behaviour is dropped for a fresh one', () => {
  const b: Behaviour = { kind: 'walk-to', point: [0, 0, 4] };
  const stale = newBrain({ kind: 'wander', home: [0, 0, 0], radius: 3, seed: 5 });
  const s = think(agent(), b, stale, null, 1);
  assert.equal(s.brain.kind, 'walk-to');
  assert.ok(Math.abs(s.pos[2] - 2) < 1e-9);
});

test('think leaves the agent it was handed alone', () => {
  const a = agent();
  const b: Behaviour = { kind: 'walk-to', point: [0, 0, 5] };
  think(a, b, newBrain(b), null, 1);
  assert.deepEqual(a.pos, [0, 0, 0]);
  assert.equal(a.yaw, 0);
});

test('y is carried through and never steers anything', () => {
  const b: Behaviour = { kind: 'walk-to', point: [0, -9, 4] };
  const a: Agent = { pos: [0, 7.5, 0], yaw: 0, speed: 2, sight: 10, reaction: 0.5 };
  const s = think(a, b, newBrain(b), null, 1);
  assert.equal(s.pos[1], 7.5);
  assert.equal(s.pos[0], 0);
  assert.ok(Math.abs(s.pos[2] - 2) < 1e-9);
});

test('zero dt and zero speed both mean standing still', () => {
  const b: Behaviour = { kind: 'walk-to', point: [5, 0, 5] };
  const s = think(agent(), b, newBrain(b), null, 0);
  assert.equal(s.moving, false);
  assert.deepEqual(s.pos, [0, 0, 0]);
  const slow: Agent = { ...agent(), speed: 0 };
  const t = think(slow, b, newBrain(b), null, 1);
  assert.equal(t.moving, false);
  assert.deepEqual(t.pos, [0, 0, 0]);
});

test('a goal inside the arrival radius is reached already, and it never lunges', () => {
  const b: Behaviour = { kind: 'walk-to', point: [0.25, 0, 0] };
  const s = think(agent(), b, newBrain(b), null, 0.001);
  assert.equal(s.moving, false);
  assert.deepEqual(s.pos, [0, 0, 0]);
});

test('once it has arrived it stays put', () => {
  const b: Behaviour = { kind: 'walk-to', point: [0, 0, 3] };
  const end = run(agent(), b, null, 100);
  const s = think(end, b, newBrain(b), null, 1);
  assert.equal(s.moving, false);
  assert.deepEqual(s.pos, end.pos);
});

test('it turns to face the way it walks, and keeps its yaw when it stands', () => {
  const b: Behaviour = { kind: 'walk-to', point: [4, 0, 4] };
  const s = think(agent(), b, newBrain(b), null, 0.1);
  const rad = (s.yaw * Math.PI) / 180;
  assert.ok(Math.abs(s.yaw - 45) < 1e-9, String(s.yaw));
  assert.ok(Math.abs(Math.sin(rad) * 0.2 - s.pos[0]) < 1e-9);
  assert.ok(Math.abs(Math.cos(rad) * 0.2 - s.pos[2]) < 1e-9);
  const still = think({ ...agent(), yaw: 12 }, { kind: 'stand' }, newBrain({ kind: 'stand' }), null, 1);
  assert.equal(still.yaw, 12);
  assert.equal(still.moving, false);
});

test('no tick ever covers more ground than speed * dt', () => {
  const b: Behaviour = { kind: 'wander', home: [0, 0, 0], radius: 6, seed: 3 };
  let brain = newBrain(b), cur = agent(1, -2);
  for (let i = 0; i < 500; i++) {
    const s = think(cur, b, brain, null, 0.05);
    assert.ok(dist(s.pos, cur.pos) <= cur.speed * 0.05 + 1e-12, String(dist(s.pos, cur.pos)));
    brain = s.brain; cur = { ...cur, pos: s.pos, yaw: s.yaw };
  }
});

test('the reaction clock restarts when the target slips out of sight', () => {
  const b: Behaviour = { kind: 'chase' };
  let brain = newBrain(b), cur = agent();
  for (let i = 0; i < 4; i++) {
    const s = think(cur, b, brain, [6, 0, 0], 0.1);
    brain = s.brain; cur = { ...cur, pos: s.pos };
  }
  assert.deepEqual(cur.pos, [0, 0, 0]); // 0.4 s in, still not reacting
  const out = think(cur, b, brain, [50, 0, 0], 0.1);
  brain = out.brain;
  assert.equal(out.moving, false);
  const back = think(cur, b, brain, [6, 0, 0], 0.1);
  assert.equal(back.moving, false); // the clock is back at 0.1 s
  assert.equal(back.brain.kind, 'chase');
});

test('a reaction of zero reacts on the very first tick', () => {
  const b: Behaviour = { kind: 'chase' };
  const a: Agent = { ...agent(), reaction: 0 };
  const s = think(a, b, newBrain(b), [4, 0, 0], 0.1);
  assert.equal(s.moving, true);
  assert.ok(s.pos[0] > 0);
});

test('chase gives up the moment the target is out of sight, and never overshoots it', () => {
  const b: Behaviour = { kind: 'chase' };
  let brain = newBrain(b), cur = agent();
  for (let i = 0; i < 20; i++) {
    const s = think(cur, b, brain, [6, 0, 0], 0.1);
    brain = s.brain; cur = { ...cur, pos: s.pos, yaw: s.yaw };
  }
  assert.ok(cur.pos[0] > 2, String(cur.pos[0]));
  const gave = think(cur, b, brain, [60, 0, 0], 0.1);
  assert.equal(gave.moving, false);
  assert.deepEqual(gave.pos, cur.pos);
  const quick: Agent = { ...agent(), reaction: 0 };
  const end = run(quick, b, [1, 0, 0], 100);
  const d = dist(end.pos, [1, 0, 0]);
  assert.ok(d <= 0.3 && end.pos[0] <= 1, `${d} ${end.pos[0]}`);
});

test('flee turns tail on the target, and backs off its own nose when cornered', () => {
  const b: Behaviour = { kind: 'flee' };
  let brain = newBrain(b), cur = agent();
  for (let i = 0; i < 10; i++) {
    const s = think(cur, b, brain, [3, 0, 0], 0.1);
    brain = s.brain; cur = { ...cur, pos: s.pos, yaw: s.yaw };
  }
  assert.ok(cur.pos[0] < -1, String(cur.pos[0]));
  assert.ok(Math.abs(cur.yaw + 90) < 1e-6, String(cur.yaw));
  const cornered: Agent = { pos: [0, 0, 0], yaw: 90, speed: 2, sight: 10, reaction: 0 };
  const s = think(cornered, b, newBrain(b), [0, 0, 0], 0.1);
  assert.equal(s.moving, true);
  assert.ok(s.pos[0] < 0 && Math.abs(s.pos[2]) < 1e-12);
});

test('follow: the dead band between distance and distance + 0.5 holds it still', () => {
  const b: Behaviour = { kind: 'follow', distance: 3 };
  const a = agent(7, 0);
  let brain = newBrain(b);
  let s = think(a, b, brain, [10, 0, 0], 0.1); brain = s.brain;
  assert.equal(s.moving, false); // gap 3.0
  s = think(a, b, brain, [10.4, 0, 0], 0.1); brain = s.brain;
  assert.equal(s.moving, false); // gap 3.4, still inside the band
  s = think(a, b, brain, [10.6, 0, 0], 0.1); brain = s.brain;
  assert.equal(s.moving, true); // gap 3.6, off it goes
  assert.ok(s.pos[0] > 7);
});

test('follow keeps pace with a target that strolls off', () => {
  const b: Behaviour = { kind: 'follow', distance: 2 };
  let brain = newBrain(b), cur = agent(0, 0), tx = 10;
  for (let i = 0; i < 200; i++) {
    const s = think(cur, b, brain, [tx, 0, 0], 0.1);
    brain = s.brain; cur = { ...cur, pos: s.pos, yaw: s.yaw };
    tx += 0.1; // the target walks at 1 m/s, the agent can do 2
  }
  const d = dist(cur.pos, [tx, 0, 0]);
  assert.ok(d >= 1.9 && d <= 2.6, String(d));
});

test('follow with nobody to follow just stands about', () => {
  const b: Behaviour = { kind: 'follow', distance: 2 };
  const s = think(agent(), b, newBrain(b), null, 0.1);
  assert.equal(s.moving, false);
  assert.deepEqual(s.pos, [0, 0, 0]);
});

test('patrol back-and-forth walks its line in both directions', () => {
  const b: Behaviour = { kind: 'patrol', points: [[0, 0, 0], [2, 0, 0]], mode: 'back-and-forth', wait: 0 };
  let brain = newBrain(b), cur = agent();
  const seen: number[] = [];
  for (let i = 0; i < 200; i++) {
    const s = think(cur, b, brain, null, 0.1);
    brain = s.brain; cur = { ...cur, pos: s.pos, yaw: s.yaw };
    seen.push(cur.pos[0]);
  }
  assert.ok(Math.max(...seen) > 1.5, String(Math.max(...seen)));
  assert.ok(Math.min(...seen) < 0.5, String(Math.min(...seen)));
});

test('wander pauses between strolls and never leaves the disc', () => {
  const home: Vec3 = [2, 0, -1];
  const b: Behaviour = { kind: 'wander', home, radius: 4, seed: 11 };
  let brain = newBrain(b), cur = agent(2, -1), pauses = 0;
  for (let i = 0; i < 400; i++) {
    const s = think(cur, b, brain, null, 0.1);
    brain = s.brain;
    if (!s.moving) pauses++;
    cur = { ...cur, pos: s.pos, yaw: s.yaw };
    assert.ok(dist(cur.pos, home) <= 4.0000001, String(dist(cur.pos, home)));
  }
  assert.ok(pauses >= 10, String(pauses));
});

test('wander with another seed wanders somewhere else', () => {
  const one: Behaviour = { kind: 'wander', home: [0, 0, 0], radius: 5, seed: 7 };
  const two: Behaviour = { kind: 'wander', home: [0, 0, 0], radius: 5, seed: 8 };
  const a = run(agent(), one, null, 200), c = run(agent(), two, null, 200);
  assert.ok(dist(a.pos, c.pos) > 1e-6, `${a.pos} ${c.pos}`);
});

test('the same inputs give the same outputs, tick for tick', () => {
  const b: Behaviour = { kind: 'patrol', points: [[3, 0, 0], [3, 0, 3], [0, 0, 3]], mode: 'loop', wait: 1 };
  const p = run(agent(), b, null, 300), q = run(agent(), b, null, 300);
  assert.deepEqual(p.pos, q.pos);
  assert.equal(p.yaw, q.yaw);
  const chase: Behaviour = { kind: 'chase' };
  const m = run(agent(), chase, [7, 0, 2], 40), n = run(agent(), chase, [7, 0, 2], 40);
  assert.deepEqual(m.pos, n.pos);
  assert.equal(m.yaw, n.yaw);
});