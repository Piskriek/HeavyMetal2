import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addPoints,
  aiControl,
  createLapTracker,
  normalizeStats,
  onTrack,
  pointAt,
  pointsFor,
  project,
  rankRacers,
  rankTable,
  rollItem,
  scoreRace,
  trackLength,
  updateRatings,
  validateStats,
  type Track,
} from '../src';

const oval: Track = {
  points: [[0, 0], [30, -10], [60, 0], [80, 20], [60, 40], [30, 50], [0, 40], [-20, 20]],
  width: 12,
};

test('normalization is bounded and idempotent', () => {
  const normalized = normalizeStats({ weight: 12.7, speed: -4, bounce: 4.6 });
  assert.deepEqual(normalized, { weight: 9, speed: 1, bounce: 5 });
  assert.deepEqual(normalizeStats(normalized), normalized);
  assert.ok(normalized.weight + normalized.speed + normalized.bounce <= 15);
});

test('normalization breaks largest-stat ties in weight, speed, bounce order', () => {
  assert.deepEqual(normalizeStats({ weight: 10, speed: 10, bounce: 2 }), { weight: 6, speed: 7, bounce: 2 });
});

test('validation names every invalid stat and rejects a non-finite value', () => {
  const result = validateStats({ weight: Number.NaN, speed: 0, bounce: 11 });
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /weight/);
  assert.match(result.errors.join(' '), /speed/);
  assert.match(result.errors.join(' '), /bounce/);
});

test('invalid places score zero and scoring does not mutate the table', () => {
  assert.equal(pointsFor(1.1), 0);
  assert.deepEqual(scoreRace([{ id: 'a', position: 1.1 }, { id: 'b', position: 1, dnf: true }]), { a: 0, b: 0 });
  const table = { a: 4 };
  assert.deepEqual(addPoints(table, [{ id: 'a', position: 1 }, { id: 'c', position: 2 }]), { a: 29, c: 18 });
  assert.deepEqual(table, { a: 4 });
});

test('rankTable includes all listed racers with zero wins for empty history', () => {
  assert.deepEqual(rankTable({ zed: 9, ada: 9, bob: 2 }, []), [
    { id: 'ada', points: 9, wins: 0 },
    { id: 'zed', points: 9, wins: 0 },
    { id: 'bob', points: 2, wins: 0 },
  ]);
});

test('rankTable excludes a DNF winner from wins tiebreaks', () => {
  const table = { a: 10, b: 10 };
  const history = [[{ id: 'a', position: 1, dnf: true }, { id: 'b', position: 2 }]];
  assert.deepEqual(rankTable(table, history).map((row) => [row.id, row.wins]), [['a', 0], ['b', 0]]);
});

test('projection is stable at vertices and on repeated zero-length segments', () => {
  const vertex = project({ points: [[0, 0], [100, 0], [100, 100], [0, 100]], width: 10 }, [100, 0]);
  assert.equal(vertex.segment, 0);
  assert.equal(vertex.t, 1);
  assert.equal(vertex.s, 100);

  const repeated: Track = { points: [[0, 0], [0, 0], [10, 0], [10, 10]], width: 4 };
  const atStart = project(repeated, [0, 0]);
  assert.equal(atStart.segment, 0);
  assert.equal(atStart.distance, 0);
  const alongEdge = project(repeated, [5, 1]);
  assert.equal(alongEdge.segment, 1);
  assert.equal(alongEdge.t, 0.5);
  assert.equal(alongEdge.s, 5);
  assert.ok(Number.isFinite(alongEdge.lateral));
});

test('zero-length tracks have a stable point and are not drivable', () => {
  const collapsed: Track = { points: [[3, 4], [3, 4], [3, 4]], width: 10 };
  assert.equal(trackLength(collapsed), 0);
  assert.deepEqual(pointAt(collapsed, 100), [3, 4]);
  assert.equal(project(collapsed, [6, 8]).distance, 5);
  assert.equal(onTrack(collapsed, [3, 4]), false);
});

test('on-track boundaries are inclusive', () => {
  const straight: Track = { points: [[0, 0], [100, 0], [100, 100], [0, 100]], width: 10 };
  assert.equal(onTrack(straight, [50, -5]), true);
  assert.equal(onTrack(straight, [50, 5]), true);
  assert.equal(onTrack(straight, [50, -5.01]), false);
});

test('a non-square oval lap advances through all eight ordered checkpoints', () => {
  const length = trackLength(oval);
  const tracker = createLapTracker(oval, 2);
  let completed = 0;
  for (let i = 0; i <= 240; i += 1) {
    const state = tracker.update(pointAt(oval, (length * i) / 240));
    if (state.lapCompleted) completed += 1;
  }
  assert.equal(completed, 1);
  assert.equal(tracker.state.lap, 2);
  assert.ok(tracker.state.progress >= 1);
});

test('lap state snapshots are immutable and reset clears the checkpoint sequence', () => {
  const tracker = createLapTracker(oval, 3);
  const snapshot = tracker.state;
  tracker.update(pointAt(oval, 0));
  tracker.update(pointAt(oval, 12));
  assert.equal(snapshot.progress, 0);
  tracker.reset();
  assert.deepEqual(tracker.state, { lap: 1, progress: 0, finished: false, lapCompleted: false });
});

test('AI stays finite on curved geometry and with a degenerate segment', () => {
  const track: Track = { points: [[0, 0], [20, 0], [20, 0], [30, 15], [10, 30], [-10, 15]], width: 8 };
  for (let i = 0; i < 20; i += 1) {
    const p = pointAt(track, trackLength(track) * i / 20);
    const control = aiControl(track, { x: p[0] + 1, z: p[1] - 1, hx: 0, hz: 1, speed: 22 }, {
      lookahead: 14,
      cornerCare: 0.8,
      noise: 0.4,
    }, () => 0.75);
    assert.ok(Number.isFinite(control.steer));
    assert.ok(Number.isFinite(control.throttle));
    assert.ok(control.steer >= -1 && control.steer <= 1);
    assert.ok(control.throttle >= 0.25 && control.throttle <= 1);
  }
});

test('single-racer item rolls stay deterministic and use the back bucket', () => {
  assert.equal(rollItem(1, 1, () => 0).id, 'boost');
  assert.equal(rollItem(1, 1, () => 0.999999).id, 'ghost');
});

test('rankRacers emits each id once and keeps that racer at its best progress', () => {
  assert.deepEqual(rankRacers([
    { id: 'b', progress: 2 },
    { id: 'a', progress: 1 },
    { id: 'a', progress: 3 },
  ]), [
    { id: 'a', position: 1 },
    { id: 'b', position: 2 },
  ]);
});

test('rating updates handle no racers and preserve a one-racer rating', () => {
  assert.deepEqual(updateRatings([]), {});
  assert.deepEqual(updateRatings([{ id: 'solo', rating: 987.65 }]), { solo: 987.65 });
});