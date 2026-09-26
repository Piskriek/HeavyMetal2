/**
 * WIRE-3 / X12 — Tests for cockpit dashboard trinkets:
 * - spring-damper dynamics (steering sway, bounce on landings, reduced-motion stillness)
 * - tournament unlock rules (cups stay locked until earned)
 * - asset validation (all trinket PNGs exist and decode)
 * - persistence & defaults
 *
 * Run with: node --import tsx --test tests/cockpit-trinkets.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  ALL_TRINKET_FILES,
  ALL_TRINKET_IDS,
  TRINKET_DEFS,
  bestTournamentRank,
  createTrinketSpringState,
  isTrinketUnlocked,
  readDashboardTrinkets,
  saveDashboardTrinkets,
  stepTrinketSpring,
  trinketPlacement,
  DEFAULT_TRINKETS,
  TRINKETS_STORAGE_KEY,
} from '../src/game/cockpit-trinkets';
import type { RunRecord } from '../src/game/types';
import { cockpitLayout } from '../src/game/cockpit';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const publicFile = (url: string) => join(root, 'public', url.replace(/^\//, ''));

function pngSize(path: string) {
  const buffer = readFileSync(path);
  assert.equal(buffer.subarray(1, 4).toString('ascii'), 'PNG', `${path} must be a PNG`);
  return { w: buffer.readUInt32BE(16), h: buffer.readUInt32BE(20) };
}

test('every trinket art asset exists and decodes as a valid PNG', () => {
  assert.equal(ALL_TRINKET_FILES.length, 9, 'nine trinket sprites');
  for (const url of ALL_TRINKET_FILES) {
    const path = publicFile(url);
    assert.ok(existsSync(path), `${url} must exist on disk`);
    const { w, h } = pngSize(path);
    assert.ok(w >= 32 && h >= 32, `${url} must be real art (${w}x${h})`);
  }

  // Check sheep bobblehead pieces
  const sheepBody = pngSize(publicFile(TRINKET_DEFS.sheep.bodyFile!));
  const sheepHead = pngSize(publicFile(TRINKET_DEFS.sheep.headFile!));
  assert.ok(sheepBody.w > 0 && sheepHead.w > 0, 'sheep bobblehead has separate body and head');
});

test('trinket unlock rules: defaults are free, cups stay locked until tournament finishes', () => {
  // Empty records: default trinkets unlocked, cups locked
  const emptyRecords: RunRecord[] = [];
  assert.equal(isTrinketUnlocked('sheep', emptyRecords), true);
  assert.equal(isTrinketUnlocked('dice', emptyRecords), true);
  assert.equal(isTrinketUnlocked('horseshoe', emptyRecords), true);
  assert.equal(isTrinketUnlocked('rocket', emptyRecords), true);
  assert.equal(isTrinketUnlocked('hula', emptyRecords), true);
  assert.equal(isTrinketUnlocked('none', emptyRecords), true);

  assert.equal(isTrinketUnlocked('cup_bronze', emptyRecords), false, 'bronze locked without tournament podium');
  assert.equal(isTrinketUnlocked('cup_silver', emptyRecords), false, 'silver locked');
  assert.equal(isTrinketUnlocked('cup_gold', emptyRecords), false, 'gold locked');

  // Quick race 1st place does NOT unlock tournament cups
  const quickWinRecord: RunRecord = {
    id: 'q-1', distance: 10000, topSpeed: 300, score: 5000, sheep: 2, explosions: 0, loops: 1,
    course: 'ridge', date: '2026-09-26', completed: true, position: 1, mode: 'quick',
  };
  assert.equal(isTrinketUnlocked('cup_bronze', [quickWinRecord]), false, 'quick race win does not unlock cup');

  // A cup = three rounds in one session; the player (id 0) finishes `place` in every round,
  // so they end the cup ranked `place` of four.
  const cup = (sessionId: string, place: number, rounds = 3): RunRecord[] =>
    Array.from({ length: rounds }, (_, round) => ({
      id: `${sessionId}-${round}`, distance: 10000, topSpeed: 300, score: 5000, sheep: 2, explosions: 0, loops: 1,
      course: 'ridge', date: '2026-09-26', completed: true, position: place, mode: 'tournament', sessionId, round, fieldSize: 4,
      opponents: [0, 1, 2, 3].map((id) => {
        const position = id === 0 ? place : [1, 2, 3, 4].filter((p) => p !== place)[id - 1];
        return { id, name: `R${id}`, color: '#fff', position, finished: true, finishTime: 60 + position };
      }),
    }) as RunRecord);

  assert.equal(bestTournamentRank(cup('b', 3)), 3);
  assert.equal(isTrinketUnlocked('cup_bronze', cup('b', 3)), true, 'third in a finished cup earns bronze');
  assert.equal(isTrinketUnlocked('cup_silver', cup('b', 3)), false);
  assert.equal(isTrinketUnlocked('cup_gold', cup('b', 3)), false);

  assert.equal(bestTournamentRank(cup('s', 2)), 2);
  assert.equal(isTrinketUnlocked('cup_silver', cup('s', 2)), true);
  assert.equal(isTrinketUnlocked('cup_gold', cup('s', 2)), false);

  assert.equal(bestTournamentRank(cup('g', 1)), 1);
  assert.equal(isTrinketUnlocked('cup_gold', cup('g', 1)), true, 'winning the cup earns every cup');
  assert.equal(isTrinketUnlocked('cup_bronze', cup('g', 1)), true);

  assert.equal(bestTournamentRank(cup('fourth', 4)), 4);
  assert.equal(isTrinketUnlocked('cup_bronze', cup('fourth', 4)), false, 'fourth place earns nothing');

  // Leading after one or two rounds is not finishing the cup.
  assert.equal(isTrinketUnlocked('cup_gold', cup('p1', 1, 1)), false, 'a round-one win is not a cup win');
  assert.equal(isTrinketUnlocked('cup_gold', cup('p2', 1, 2)), false, 'two rounds of three is not a finished cup');

  // A cup saved with summarised standings has no final rank, so it never unlocks.
  const summarised = cup('sum', 1).map((record) => ({ ...record, opponentsSummary: { policy: 1, totalField: 4, kept: 4 } }));
  assert.equal(bestTournamentRank(summarised), Infinity);

  // The best cup across several wins.
  assert.equal(bestTournamentRank([...cup('x', 3), ...cup('y', 2)]), 2);
});

test('placement: standing trinkets clear the yoke on the ledge; hanging ones hang from the top of the window', () => {
  for (const [w, h] of [[1366, 657], [1920, 1080]]) {
    const layout = cockpitLayout(w, h);
    const { aperture, yoke } = layout;
    const yokeLeft = yoke.hub.x - yoke.w / 2;
    const yokeRight = yoke.hub.x + yoke.w / 2;
    const yokeTop = yoke.hub.y - yoke.h / 2;
    for (const id of ALL_TRINKET_IDS) {
      if (id === 'none') continue;
      const def = TRINKET_DEFS[id];
      for (const slot of [1, 2] as const) {
        const box = trinketPlacement(def, slot, aperture);
        assert.ok(box.x >= aperture.x && box.x + box.w <= aperture.x + aperture.w, `${id} slot ${slot} inside the window at ${w}x${h}`);
        if (def.type === 'hanging') {
          assert.equal(box.y, aperture.y, `${id} hangs from the top edge`);
          assert.ok(box.y + box.h < yokeTop, `${id} hangs clear above the yoke at ${w}x${h}`);
        } else {
          assert.ok(Math.abs(box.y + box.h * 0.92 - (aperture.y + aperture.h)) < 0.5, `${id} stands on the ledge`);
          assert.ok(box.x + box.w < yokeLeft || box.x > yokeRight, `${id} slot ${slot} is not hidden behind the yoke at ${w}x${h}`);
        }
      }
    }
    // Sizes follow the window, so the trinkets read the same at every resolution.
    const small = trinketPlacement(TRINKET_DEFS.sheep, 1, cockpitLayout(1366, 657).aperture);
    const large = trinketPlacement(TRINKET_DEFS.sheep, 1, cockpitLayout(1920, 1080).aperture);
    assert.ok(large.w > small.w * 1.3);
  }
});

test('spring-damper: sways with steering and dampens back to rest', () => {
  const spring = createTrinketSpringState();
  assert.equal(spring.angleDeg, 0);
  assert.equal(spring.angleVel, 0);

  // Steering left (steer = -1) exerts rightward centrifugal force (positive angle)
  for (let step = 0; step < 15; step++) {
    stepTrinketSpring(spring, { steer: -1, bob: 0, impact: 0, impactSide: 0, reducedMotion: false, dt: 0.016 });
  }
  assert.ok(spring.angleDeg > 3, `trinket should sway right when steering left, got ${spring.angleDeg.toFixed(2)}°`);
  assert.ok(spring.angleDeg <= 35, 'trinket angle is clamped to reasonable visual range');

  // Releasing steering eases back toward 0°
  for (let step = 0; step < 60; step++) {
    stepTrinketSpring(spring, { steer: 0, bob: 0, impact: 0, impactSide: 0, reducedMotion: false, dt: 0.016 });
  }
  assert.ok(Math.abs(spring.angleDeg) < 0.8, `trinket should settle near 0° after release, got ${spring.angleDeg.toFixed(2)}°`);
});

test('spring-damper: bounces with vertical jolts and bobbing', () => {
  const spring = createTrinketSpringState();

  // Landing / impact jolt compresses spring vertically
  stepTrinketSpring(spring, { steer: 0, bob: 4, impact: 0.8, impactSide: 0, reducedMotion: false, dt: 0.016 });
  assert.ok(spring.yVel !== 0, 'impact imparts vertical velocity');

  // Let it oscillate and dampen
  let maxBounce = 0;
  for (let step = 0; step < 30; step++) {
    stepTrinketSpring(spring, { steer: 0, bob: 0, impact: 0, impactSide: 0, reducedMotion: false, dt: 0.016 });
    maxBounce = Math.max(maxBounce, Math.abs(spring.yPx));
  }
  assert.ok(maxBounce > 0.5, `spring bounced by ${maxBounce.toFixed(2)} px`);

  // After 1 second of stillness, returns to rest
  for (let step = 0; step < 60; step++) {
    stepTrinketSpring(spring, { steer: 0, bob: 0, impact: 0, impactSide: 0, reducedMotion: false, dt: 0.016 });
  }
  assert.ok(Math.abs(spring.yPx) < 0.5, `vertical spring should settle near 0, got ${spring.yPx.toFixed(2)} px`);
});

test('reduced motion holds trinkets completely still at rest', () => {
  const spring = { angleDeg: 15, angleVel: 40, yPx: 8, yVel: -20 };
  const result = stepTrinketSpring(spring, {
    steer: -1,
    bob: 6,
    impact: 1,
    impactSide: 1,
    reducedMotion: true,
    dt: 0.016,
  });

  assert.equal(result.angleDeg, 0, 'angle must be 0 under reduced motion');
  assert.equal(result.angleVel, 0);
  assert.equal(result.yPx, 0, 'y offset must be 0 under reduced motion');
  assert.equal(result.yVel, 0);
});

test('persistence: defaults are sheep and dice; locked trinkets fall back gracefully', () => {
  // Mock localStorage
  const store = new Map<string, string>();
  const originalLocalStorage = globalThis.localStorage;
  (globalThis as any).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => store.clear(),
  };

  try {
    // Default read
    const def = readDashboardTrinkets([]);
    assert.deepEqual(def, DEFAULT_TRINKETS);

    // Save selection
    saveDashboardTrinkets({ slot1: 'rocket', slot2: 'hula' });
    const loaded = readDashboardTrinkets([]);
    assert.equal(loaded.slot1, 'rocket');
    assert.equal(loaded.slot2, 'hula');

    // Attempting to load an unearned cup falls back to 'none'
    saveDashboardTrinkets({ slot1: 'cup_gold', slot2: 'sheep' });
    const guarded = readDashboardTrinkets([]);
    assert.equal(guarded.slot1, 'none', 'unearned cup must fall back to none');
    assert.equal(guarded.slot2, 'sheep');
  } finally {
    (globalThis as any).localStorage = originalLocalStorage;
  }
});
