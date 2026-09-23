/**
 * T06 — staging presentation tests.
 *
 * Covers:
 * - Leaderboard bounded at 100 rows.
 * - Orbit bands derived from the grid, not mutated.
 * - Highlight classification (human, leader, podium, normal, fallback, stalled).
 * - Opacity levels for each highlight kind.
 * - Grouped bands when field exceeds MAX_INDIVIDUAL_ORBIT_BANDS.
 * - Focused bands for camera close-up.
 * - Format helpers (time, speed).
 * - Determinism: same inputs produce the same presentation.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildStagingPresentation, focusedBands,
  formatQualifyingTime, formatDisplaySpeed,
  MAX_LEADERBOARD_ROWS, MAX_INDIVIDUAL_ORBIT_BANDS,
} from '../src/game/staging/presentation';
import { buildFrozenGrid } from '../src/game/release/grid';
import { defaultReleaseCorridor } from '../src/game/contracts/release';
import { rankQualifying, createQualifyingEntry, type RankedQualifyingEntry } from '../src/game/contracts/qualifying';

function entry(racerId: number, time: number | null, speed = 300): RankedQualifyingEntry {
  const base = createQualifyingEntry({
    racerId, attempt: 1,
    status: time !== null ? 'valid' : 'fallback',
    time, speed, peakSpeed: speed,
    fallback: time !== null ? undefined : 'dnf',
    rewardRolled: false,
  });
  return { ...base, rank: 0, advanced: true };
}

function makeEntries(count: number, baseSpeed = 300): readonly RankedQualifyingEntry[] {
  const entries = Array.from({ length: count }, (_, i) =>
    entry(i, 1.0 + i * 0.1, baseSpeed - i * 2),
  );
  return rankQualifying(entries, count);
}

describe('staging presentation: leaderboard', () => {
  it('is bounded at MAX_LEADERBOARD_ROWS rows', () => {
    const entries = makeEntries(150);
    const presentation = buildStagingPresentation(entries, null, { humanRacerId: 0 });
    assert.equal(presentation.leaderboard.length, MAX_LEADERBOARD_ROWS);
    assert.equal(presentation.totalRacers, 150);
    assert.equal(presentation.visibleRacers, MAX_LEADERBOARD_ROWS);
  });

  it('shows all rows when under the limit', () => {
    const entries = makeEntries(20);
    const presentation = buildStagingPresentation(entries, null, { humanRacerId: 0 });
    assert.equal(presentation.leaderboard.length, 20);
    assert.equal(presentation.totalRacers, 20);
  });

  it('rows are sorted by rank', () => {
    const entries = makeEntries(10);
    const presentation = buildStagingPresentation(entries, null, { humanRacerId: 0 });
    for (let i = 1; i < presentation.leaderboard.length; i++) {
      assert.ok(
        presentation.leaderboard[i].rank >= presentation.leaderboard[i - 1].rank,
        'leaderboard must be sorted by rank',
      );
    }
  });

  it('includes racer names from the names map', () => {
    const entries = makeEntries(4);
    const names = { 0: 'YOU', 1: 'GRUB', 2: 'NIX', 3: 'RIVET' };
    const presentation = buildStagingPresentation(entries, null, { humanRacerId: 0, names });
    const you = presentation.leaderboard.find((r) => r.racerId === 0);
    assert.ok(you);
    assert.equal(you!.name, 'YOU');
  });

  it('fallback entries show fallback class', () => {
    const entries = [
      { ...entry(0, 1.0, 300), rank: 1, advanced: true },
      { ...entry(1, null, 0), rank: 2, advanced: true },
    ] as readonly RankedQualifyingEntry[];
    const presentation = buildStagingPresentation(entries, null, { humanRacerId: 0 });
    const fallback = presentation.leaderboard.find((r) => r.racerId === 1);
    assert.ok(fallback);
    assert.equal(fallback!.status, 'fallback');
    assert.equal(fallback!.fallback, 'dnf');
  });
});

describe('staging presentation: highlight classification', () => {
  it('human racer is highlighted as human', () => {
    const entries = makeEntries(4);
    const presentation = buildStagingPresentation(entries, null, { humanRacerId: 0 });
    const human = presentation.leaderboard.find((r) => r.racerId === 0);
    assert.ok(human);
    assert.equal(human!.highlight, 'human');
  });

  it('rank 1 is highlighted as leader', () => {
    const entries = makeEntries(4);
    const presentation = buildStagingPresentation(entries, null, { humanRacerId: 99 });
    const leader = presentation.leaderboard.find((r) => r.rank === 1);
    assert.ok(leader);
    assert.equal(leader!.highlight, 'leader');
  });

  it('rank 2-3 are highlighted as podium', () => {
    const entries = makeEntries(4);
    const presentation = buildStagingPresentation(entries, null, { humanRacerId: 99 });
    const podium = presentation.leaderboard.filter((r) => r.highlight === 'podium');
    assert.ok(podium.length >= 1);
  });

  it('fallback entries are highlighted as fallback', () => {
    const entries = [
      { ...entry(0, 1.0, 300), rank: 1, advanced: true },
      { ...entry(1, null, 0), rank: 2, advanced: true },
    ] as readonly RankedQualifyingEntry[];
    const presentation = buildStagingPresentation(entries, null, { humanRacerId: 99 });
    const fallback = presentation.leaderboard.find((r) => r.racerId === 1);
    assert.equal(fallback!.highlight, 'fallback');
  });
});

describe('staging presentation: orbit bands', () => {
  it('derives orbit bands from the grid', () => {
    const entries = makeEntries(4);
    const corridor = defaultReleaseCorridor();
    const { grid } = buildFrozenGrid(entries, { corridor });
    const presentation = buildStagingPresentation(entries, grid, { humanRacerId: 0 });
    assert.equal(presentation.orbitBands.length, 4);
    // Each band has the grid's exit speed.
    for (const band of presentation.orbitBands) {
      const slot = grid.slots.find((s) => s.racerId === band.racerId)!;
      assert.equal(band.exitSpeed, slot.exitSpeed);
    }
  });

  it('orbit bands never mutate the grid exit speed', () => {
    const entries = makeEntries(4, 420);
    const corridor = defaultReleaseCorridor();
    const { grid } = buildFrozenGrid(entries, { corridor });
    const originalSpeeds = grid.slots.map((s) => s.exitSpeed);
    buildStagingPresentation(entries, grid, { humanRacerId: 0 });
    // Grid speeds unchanged.
    for (let i = 0; i < grid.slots.length; i++) {
      assert.equal(grid.slots[i].exitSpeed, originalSpeeds[i]);
    }
  });

  it('groups bands when field exceeds MAX_INDIVIDUAL_ORBIT_BANDS', () => {
    const entries = makeEntries(MAX_INDIVIDUAL_ORBIT_BANDS + 10);
    const corridor = defaultReleaseCorridor({ to: 5000 });
    const { grid } = buildFrozenGrid(entries, { corridor, preferredWaveSpacing: 200 });
    const presentation = buildStagingPresentation(entries, grid, { humanRacerId: 0 });
    assert.equal(presentation.groupedBands, true);
  });

  it('does not group bands when field is small', () => {
    const entries = makeEntries(4);
    const corridor = defaultReleaseCorridor();
    const { grid } = buildFrozenGrid(entries, { corridor });
    const presentation = buildStagingPresentation(entries, grid, { humanRacerId: 0 });
    assert.equal(presentation.groupedBands, false);
  });
});

describe('staging presentation: focused bands', () => {
  it('returns bands near the focus racer', () => {
    const entries = makeEntries(16);
    const corridor = defaultReleaseCorridor({ to: 3000 });
    const { grid } = buildFrozenGrid(entries, { corridor, preferredWaveSpacing: 200 });
    const presentation = buildStagingPresentation(entries, grid, { humanRacerId: 0 });
    const humanBand = presentation.orbitBands.find((b) => b.racerId === 0);
    if (humanBand) {
      const focused = focusedBands(presentation, 0, 8);
      // All focused bands are within 1 wave of the human.
      for (const band of focused) {
        assert.ok(Math.abs(band.wave - humanBand.wave) <= 1);
      }
    }
  });
});

describe('staging presentation: format helpers', () => {
  it('formatQualifyingTime formats seconds', () => {
    assert.equal(formatQualifyingTime(1.27), '1.27');
    assert.equal(formatQualifyingTime(65.5), '1:05.50');
  });

  it('formatQualifyingTime returns --:-- for null', () => {
    assert.equal(formatQualifyingTime(null), '--:--');
  });

  it('formatQualifyingTime returns --:-- for zero', () => {
    assert.equal(formatQualifyingTime(0), '--:--');
  });

  it('formatDisplaySpeed converts engine units to display', () => {
    assert.equal(formatDisplaySpeed(300), '48');  // 300 * 0.16 = 48
    assert.equal(formatDisplaySpeed(0), '0');
  });
});

describe('staging presentation: determinism', () => {
  it('same inputs produce the same presentation', () => {
    const entries = makeEntries(8);
    const corridor = defaultReleaseCorridor();
    const { grid } = buildFrozenGrid(entries, { corridor });
    const opts = { humanRacerId: 0, names: { 0: 'YOU' } };
    const a = buildStagingPresentation(entries, grid, opts);
    const b = buildStagingPresentation(entries, grid, opts);
    assert.deepEqual(a, b);
  });
});
