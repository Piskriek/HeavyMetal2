// The monsters' rules (policy.ts): the setting, the eras, the budget, the leak sites, the sanctuaries, the health and the drops.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SKINS } from './roster';
import {
  CORE_ITEM, DEFAULT_MONSTERS, DORMANT_REWARD, GATE_DOME_RADIUS, LEAK_SITE_COUNT, LIFE_SUPPORT_RADIUS, LOW_HP_FRACTION, MIN_GATE_DISTANCE, MONSTER_SETTINGS, OPEN_STAGE,
  PLAYER_MAX_HP, PIXEL_ITEM, REGEN_DELAY, SEAL_REWARD, VERTEX_ITEM, clearOfGate, dropStack, eraForStage, hitBearing, hurt, inSafeZone, isLow, kindsForEra,
  killDrop, leakSites, monsterCap, parseMonsters, regen, safeZones,
} from './policy';

test('the setting is Off, Calm, Normal or Hard; anything else is Normal', () => {
  assert.deepEqual([...MONSTER_SETTINGS], ['off', 'calm', 'normal', 'hard']);
  assert.equal(DEFAULT_MONSTERS, 'normal');
  assert.equal(parseMonsters('hard'), 'hard');
  assert.equal(parseMonsters('off'), 'off');
  assert.equal(parseMonsters('nightmare'), 'normal');
  assert.equal(parseMonsters(undefined), 'normal');
});

test('the era follows the stage: sprite at 0 and 1, early 3D at 2 and 3, modern 3D at 4 to 6', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6].map(eraForStage), ['sprite', 'sprite', 'early3d', 'early3d', 'modern3d', 'modern3d', 'modern3d']);
  assert.equal(eraForStage(9), 'modern3d');
});

test('every archetype a leak of an era leaks has a skin in that era (the early-3D leaks leave swarmers out)', () => {
  for (const era of ['sprite', 'early3d', 'modern3d'] as const) {
    for (const kind of kindsForEra(era)) {
      assert.ok(SKINS.some((s) => s.era === era && s.archetype === kind), `${era} has no ${kind} skin`);
    }
  }
  assert.ok(!kindsForEra('early3d').includes('swarmer'));
});

test('the budget: 8 living on Low (and Potato), 16 on Medium, 24 on High and Ultra', () => {
  assert.equal(monsterCap('potato'), 8);
  assert.equal(monsterCap('low'), 8);
  assert.equal(monsterCap('medium'), 16);
  assert.equal(monsterCap('high'), 24);
  assert.equal(monsterCap('ultra'), 24);
  assert.equal(monsterCap('unknown'), 8);
});

test('the leak sites are deterministic, ten of them, and every one is clear of the gate', () => {
  const gate = { x: 12, z: -7 };
  const a = leakSites(42, gate), b = leakSites(42, gate), c = leakSites(43, gate);
  assert.equal(a.length, LEAK_SITE_COUNT);
  assert.deepEqual(a, b, 'the same plot gives the same sites');
  assert.notDeepEqual(a.map((s) => [s.x, s.z]), c.map((s) => [s.x, s.z]), 'another plot gives other sites');
  for (let seed = 1; seed <= 60; seed++) {
    for (const s of leakSites(seed, gate)) {
      assert.ok(clearOfGate(s, gate), `seed ${seed}: site ${s.index} is ${Math.hypot(s.x - gate.x, s.z - gate.z).toFixed(1)} m from the gate`);
    }
  }
});

test('site 0 is the dormant anomaly; the live sites open in stage order, a few a stage', () => {
  const sites = leakSites(7, { x: 0, z: 0 });
  assert.equal(sites[0]!.dormant, true);
  assert.equal(sites[0]!.openStage, 0);
  assert.ok(sites.slice(1).every((s) => !s.dormant && s.openStage >= 1));
  for (let i = 2; i < sites.length; i++) assert.ok(sites[i]!.openStage >= sites[i - 1]!.openStage, 'the stages do not go back');
  assert.equal(OPEN_STAGE.length, LEAK_SITE_COUNT);
  assert.ok(sites.every((s) => s.junk.length > 0), 'every site sits on a junked model');
});

test('the gate dome is 25 m, a life-support room 5 m; a point on the edge is outside', () => {
  const gate = { x: 0, z: 0 };
  assert.equal(GATE_DOME_RADIUS, 25);
  assert.equal(LIFE_SUPPORT_RADIUS, 5);
  const zones = safeZones(gate, [{ x: 60, z: 0 }]);
  assert.equal(zones.length, 2);
  assert.equal(inSafeZone({ x: 24.9, z: 0 }, zones), true);
  assert.equal(inSafeZone({ x: 25.1, z: 0 }, zones), false);
  assert.equal(inSafeZone({ x: 62, z: 0 }, zones), true, 'inside the sealed room');
  assert.equal(inSafeZone({ x: 70, z: 0 }, zones), false);
  assert.equal(MIN_GATE_DISTANCE, 30);
});

test('health: hits take it down and never below zero; it comes back after the quiet delay; low at 30', () => {
  assert.equal(hurt(100, 15), 85);
  assert.equal(hurt(10, 99), 0);
  assert.equal(hurt(50, -5), 50, 'a negative hit does nothing');
  assert.equal(regen(60, REGEN_DELAY - 0.1, 1), 60, 'no regen during the quiet delay');
  assert.ok(regen(60, REGEN_DELAY, 1) > 60);
  assert.equal(regen(0, 99, 1), 0, 'the dead do not regenerate');
  assert.ok(regen(99.9, 99, 10) <= PLAYER_MAX_HP);
  assert.equal(LOW_HP_FRACTION, 0.3);
  assert.equal(isLow(30), true);
  assert.equal(isLow(31), false);
  assert.equal(isLow(0), false, 'the dead are not low, they are dead');
});

test('drops: sprites give raw pixels, 3D monsters raw vertices; sealing gives the substrate, the dormant anomaly the first core', () => {
  assert.deepEqual(dropStack({ item: 'pixels', n: 4 }), { item: PIXEL_ITEM, n: 4 });
  assert.deepEqual(dropStack({ item: 'vertices', n: 3 }), { item: VERTEX_ITEM, n: 3 });
  assert.equal(killDrop('brute').item, VERTEX_ITEM);
  assert.equal(killDrop('charger').item, PIXEL_ITEM);
  assert.ok(SEAL_REWARD.some((s) => s.item === PIXEL_ITEM) && SEAL_REWARD.some((s) => s.item === VERTEX_ITEM));
  assert.deepEqual(DORMANT_REWARD, [{ item: CORE_ITEM, n: 1 }]);
});

test('the bearing of a hit is zero straight ahead and turns with the facing', () => {
  assert.ok(Math.abs(hitBearing({ x: 0, z: 0, yaw: 0 }, { x: 0, z: 10 })) < 1e-9, 'straight ahead');
  assert.ok(Math.abs(hitBearing({ x: 0, z: 0, yaw: 0 }, { x: 10, z: 0 }) - Math.PI / 2) < 1e-9, 'to +x');
  assert.ok(Math.abs(hitBearing({ x: 0, z: 0, yaw: Math.PI / 2 }, { x: 10, z: 0 })) < 1e-9, 'turned with the facing');
  const wrapped = hitBearing({ x: 0, z: 0, yaw: 3 }, { x: 0, z: -10 });
  assert.ok(wrapped >= -Math.PI && wrapped <= Math.PI);
});
