/**
 * T05 — frozen grid tests.
 *
 * Covers:
 * - Rank order → grid position (pole at front, no teleport).
 * - Lane assignment: 1-4 valid lanes, preferred lanes honoured.
 * - Wave spacing: preferred vs safety minimum (clamped, reported).
 * - Exit speed preservation: qualifying speed kept exactly, never boosted.
 * - Stalled entries: invalid speed flagged, not silently fixed.
 * - Narrowing corridor: smaller halfWidth still works.
 * - Determinism: same inputs → same grid.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildFrozenGrid, gridSpawnPoints, gridHasNoStalled, poleSlot,
  MIN_EXIT_SPEED, DEFAULT_WAVE_SPACING, resolveWaveSpacing,
  type FrozenGrid, type GridSlot,
} from '../src/game/release/grid';
import { defaultReleaseCorridor, validateReleaseCorridor } from '../src/game/contracts/release';
import { rankQualifying, createQualifyingEntry, type RankedQualifyingEntry } from '../src/game/contracts/qualifying';

function entry(racerId: number, time: number | null, speed = 300): RankedQualifyingEntry {
  const base = createQualifyingEntry({
    racerId,
    attempt: 1,
    status: time !== null ? 'valid' : 'fallback',
    time,
    speed,
    peakSpeed: speed,
    fallback: time !== null ? undefined : 'dnf',
    rewardRolled: false,
  });
  return { ...base, rank: 0, advanced: true };
}

function makeEntries(count: number, baseSpeed = 300): readonly RankedQualifyingEntry[] {
  const entries = Array.from({ length: count }, (_, i) =>
    entry(i, 1.0 + i * 0.1, baseSpeed - i * 5),
  );
  return rankQualifying(entries, count);
}

describe('frozen grid: rank order and positions', () => {
  it('places rank 1 at the front of the corridor', () => {
    const entries = makeEntries(4);
    const corridor = defaultReleaseCorridor();
    const { grid } = buildFrozenGrid(entries, { corridor });
    const pole = poleSlot(grid)!;
    assert.equal(pole.rank, 1);
    // Pole is at the front (highest x) of the corridor.
    assert.ok(pole.x <= corridor.to);
    assert.ok(pole.x >= corridor.from);
    // No teleport: pole never goes beyond the corridor front.
    assert.ok(pole.x <= corridor.to, 'pole must not teleport past corridor.to');
  });

  it('every subsequent rank is behind the one before it', () => {
    const entries = makeEntries(8);
    const corridor = defaultReleaseCorridor();
    const { grid } = buildFrozenGrid(entries, { corridor });
    const sorted = [...grid.slots].sort((a, b) => a.rank - b.rank);
    for (let i = 1; i < sorted.length; i++) {
      assert.ok(sorted[i].x <= sorted[i - 1].x, `rank ${sorted[i].rank} must not be ahead of rank ${sorted[i - 1].rank}`);
    }
  });

  it('no racer gets a ×1.08 boost — exit speed equals qualifying speed exactly', () => {
    const entries = makeEntries(4, 420);
    const corridor = defaultReleaseCorridor();
    const { grid } = buildFrozenGrid(entries, { corridor });
    for (const slot of grid.slots) {
      const source = entries.find((e) => e.racerId === slot.racerId)!;
      assert.equal(slot.exitSpeed, source.speed, `racer ${slot.racerId} exit speed must match qualifying speed`);
    }
  });
});

describe('frozen grid: lane assignment', () => {
  it('works with 1 lane', () => {
    const entries = makeEntries(4);
    const corridor = defaultReleaseCorridor();
    const { grid } = buildFrozenGrid(entries, { corridor, laneCount: 1 });
    assert.equal(grid.lanes, 1);
    assert.equal(grid.waves, 4);
    for (const slot of grid.slots) assert.equal(slot.lane, 0);
  });

  it('works with 2 lanes', () => {
    const entries = makeEntries(4);
    const corridor = defaultReleaseCorridor();
    const { grid } = buildFrozenGrid(entries, { corridor, laneCount: 2 });
    assert.equal(grid.lanes, 2);
    assert.equal(grid.waves, 2);
    const lanes = grid.slots.map((s) => s.lane);
    assert.ok(lanes.includes(0) && lanes.includes(1));
  });

  it('works with 3 lanes', () => {
    const entries = makeEntries(6);
    const corridor = defaultReleaseCorridor();
    const { grid } = buildFrozenGrid(entries, { corridor, laneCount: 3 });
    assert.equal(grid.lanes, 3);
    assert.equal(grid.waves, 2);
  });

  it('works with 4 lanes (default)', () => {
    const entries = makeEntries(4);
    const corridor = defaultReleaseCorridor();
    const { grid } = buildFrozenGrid(entries, { corridor });
    assert.equal(grid.lanes, 4);
    assert.equal(grid.waves, 1);
    // Each lane used exactly once.
    const used = new Set(grid.slots.map((s) => s.lane));
    assert.equal(used.size, 4);
  });

  it('honours preferred lanes when available', () => {
    const entries = makeEntries(4);
    const corridor = defaultReleaseCorridor();
    const { grid } = buildFrozenGrid(entries, {
      corridor,
      preferredLanes: { 0: 3, 1: 0, 2: 1, 3: 2 },
    });
    const slot0 = grid.slots.find((s) => s.racerId === entries[0].racerId)!;
    assert.equal(slot0.lane, 3);
  });

  it('no two racers in the same wave share a lane', () => {
    const entries = makeEntries(8);
    const corridor = defaultReleaseCorridor();
    const { grid } = buildFrozenGrid(entries, { corridor, laneCount: 4 });
    const waves = new Map<number, Set<number>>();
    for (const slot of grid.slots) {
      const waveLanes = waves.get(slot.wave) ?? new Set();
      assert.ok(!waveLanes.has(slot.lane), `wave ${slot.wave} has duplicate lane ${slot.lane}`);
      waveLanes.add(slot.lane);
      waves.set(slot.wave, waveLanes);
    }
  });
});

describe('frozen grid: wave spacing and safety', () => {
  it('clamps wave spacing up to the corridor safety minimum', () => {
    const entries = makeEntries(8);
    const corridor = defaultReleaseCorridor({ minSpacing: 200 });
    const { grid, diagnostics } = buildFrozenGrid(entries, { corridor, preferredWaveSpacing: 50 });
    assert.ok(grid.waveSpacing >= 200);
    assert.ok(diagnostics.clamped.length > 0);
  });

  it('uses preferred spacing when above safety minimum', () => {
    const entries = makeEntries(8);
    const corridor = defaultReleaseCorridor({ minSpacing: 50 });
    const { grid, diagnostics } = buildFrozenGrid(entries, { corridor, preferredWaveSpacing: 300 });
    assert.equal(grid.waveSpacing, 300);
    assert.equal(diagnostics.clamped.length, 0);
  });

  it('resolveWaveSpacing reports clamping', () => {
    const r1 = resolveWaveSpacing(50, 200);
    assert.equal(r1.spacing, 200);
    assert.equal(r1.clamped, true);
    const r2 = resolveWaveSpacing(300, 200);
    assert.equal(r2.spacing, 300);
    assert.equal(r2.clamped, false);
  });
});

describe('frozen grid: narrowing corridor', () => {
  it('works with a narrow corridor half-width', () => {
    const entries = makeEntries(4);
    const corridor = defaultReleaseCorridor({ halfWidth: 200 });
    const { grid } = buildFrozenGrid(entries, { corridor });
    for (const slot of grid.slots) {
      assert.ok(Math.abs(slot.z) <= corridor.halfWidth + 1, `slot z=${slot.z} must fit in halfWidth=${corridor.halfWidth}`);
    }
  });
});

describe('frozen grid: stalled entries', () => {
  it('flags a racer with zero speed as stalled', () => {
    const entries = makeEntries(4);
    const withZero = entries.map((e) => e.rank === 2 ? { ...e, speed: 0 } : e);
    const corridor = defaultReleaseCorridor();
    const { grid } = buildFrozenGrid(withZero, { corridor });
    const stalled = grid.slots.find((s) => s.racerId === withZero[1].racerId)!;
    assert.equal(stalled.status, 'stalled');
    assert.equal(stalled.exitSpeed, MIN_EXIT_SPEED);
    assert.equal(gridHasNoStalled(grid), false);
  });

  it('flags a racer with NaN speed as stalled', () => {
    const entries = makeEntries(4);
    const withNaN = entries.map((e) => e.rank === 3 ? { ...e, speed: NaN } : e);
    const corridor = defaultReleaseCorridor();
    const { grid } = buildFrozenGrid(withNaN, { corridor });
    const stalled = grid.slots.find((s) => s.racerId === withNaN[2].racerId)!;
    assert.equal(stalled.status, 'stalled');
  });

  it('flags a racer with negative speed as stalled', () => {
    const entries = makeEntries(4);
    const withNeg = entries.map((e) => e.rank === 1 ? { ...e, speed: -50 } : e);
    const corridor = defaultReleaseCorridor();
    const { grid } = buildFrozenGrid(withNeg, { corridor });
    assert.equal(grid.slots.find((s) => s.rank === 1)!.status, 'stalled');
  });

  it('a grid with all valid speeds reports no stalled', () => {
    const entries = makeEntries(4, 300);
    const corridor = defaultReleaseCorridor();
    const { grid } = buildFrozenGrid(entries, { corridor });
    assert.equal(gridHasNoStalled(grid), true);
  });
});

describe('frozen grid: spawn points and corridor validation', () => {
  it('spawn points pass the corridor validator', () => {
    const entries = makeEntries(4);
    const corridor = defaultReleaseCorridor();
    const { grid } = buildFrozenGrid(entries, { corridor });
    const spawns = gridSpawnPoints(grid);
    const report = validateReleaseCorridor(corridor, spawns);
    assert.equal(report.ok, true, `violations: ${report.violations.map((v) => v.message).join('; ')}`);
  });

  it('spawn points for 20 racers pass the corridor validator', () => {
    const entries = makeEntries(20);
    const corridor = defaultReleaseCorridor({ to: 2000 });
    const { grid } = buildFrozenGrid(entries, { corridor, preferredWaveSpacing: 200 });
    const spawns = gridSpawnPoints(grid);
    const report = validateReleaseCorridor(corridor, spawns);
    assert.equal(report.ok, true, `violations: ${report.violations.map((v) => v.message).join('; ')}`);
  });
});

describe('frozen grid: determinism', () => {
  it('same inputs produce the same grid', () => {
    const entries = makeEntries(8);
    const corridor = defaultReleaseCorridor();
    const opts = { corridor };
    const { grid: a } = buildFrozenGrid(entries, opts);
    const { grid: b } = buildFrozenGrid(entries, opts);
    assert.equal(a.slots.length, b.slots.length);
    for (let i = 0; i < a.slots.length; i++) {
      assert.deepEqual(a.slots[i], b.slots[i]);
    }
  });
});

describe('frozen grid: error handling', () => {
  it('throws on empty entries', () => {
    assert.throws(() => buildFrozenGrid([], { corridor: defaultReleaseCorridor() }), /at least one/);
  });

  it('throws on invalid corridor', () => {
    const entries = makeEntries(4);
    assert.throws(
      () => buildFrozenGrid(entries, { corridor: { id: 'bad', from: 100, to: 50, halfWidth: 100, minSpacing: 10, clearanceSeconds: 1 } }),
      /from/,
    );
  });
});
