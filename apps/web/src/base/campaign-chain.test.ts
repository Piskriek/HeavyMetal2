import test from 'node:test';
import { HEAVY_BILL, PIECE_EXTRA } from './catalog';
import assert from 'node:assert/strict';
import type { Cond } from '@hm/questline';
import {
  ACT_V_KIT, CHAIN, CHAIN_START, CHAIN_STEPS, CHAIN_VERSION, COUNT, GATES, advanceChain, bump, chainFromSave, chainProblems, chainView, evidence, firstTime,
  gateReason, isOpen, monsterKilled, monsterSeen, playerDied, playerLow, readChain, setAtLeast, stepDone, stepProgress, unmet,
  type Chain, type Evidence,
} from './campaign-chain';

/** Make a condition hold on the counters, the way the game's actions would. */
function satisfy(cond: Cond, counts: Record<string, number>): void {
  if ('all' in cond) for (const sub of cond.all) satisfy(sub, counts);
  else if ('count' in cond) counts[cond.count] = Math.max(counts[cond.count] ?? 0, cond.atLeast);
}

const EMPTY: Evidence = { stage: 0, drillsRunning: 0, machineKinds: [], vehicleKinds: [], sidearm: false, itemIds: [] };

test('the chain data is sound: the questline validates and every step has its text', () => {
  assert.deepEqual(chainProblems(), []);
  assert.equal(CHAIN.quests.length, 3);
  assert.deepEqual(CHAIN_STEPS.map((s) => s.id), [
    'A4-01', 'A4-01b', 'A4-02', 'A4-03', 'A4-04',
    'B-01', 'B-04', 'B-06', 'B-05', 'B-07',
    'F-01', 'F-02', 'F-03', 'F-04', 'F-05',
  ]);
});

test('every step is reachable in order: each one holds once its action happens, and the chain ends with the monsters unlocked', () => {
  let c: Chain = advanceChain({ ...CHAIN_START, counts: { [COUNT.drillsRunning]: 1 } });
  const seen: string[] = [];
  const counts: Record<string, number> = { [COUNT.drillsRunning]: 1 };
  for (let guard = 0; guard < 60 && chainView(c).current; guard++) {
    const cur = chainView(c).current!;
    seen.push(cur.id);
    // the player does the step: the counters reach the step's condition, then the chain moves on
    satisfy(cur.until, counts);
    c = advanceChain({ ...c, counts: { ...counts } });
    assert.ok(stepDone(c, cur.id), `${cur.id} is done after its action`);
  }
  assert.deepEqual(seen, CHAIN_STEPS.map((s) => s.id));
  assert.equal(chainView(c).current, null);
  assert.equal(c.monstersUnlocked, true);
  assert.deepEqual(c.progress.finished, ['act4', 'act5', 'act6']);
});

test('the chain is not started until the drill runs (Act IV needs it)', () => {
  const idle = advanceChain(CHAIN_START);
  assert.equal(chainView(idle).current, null);
  assert.equal(chainView(idle).index, 0);
  const started = advanceChain({ ...CHAIN_START, counts: { [COUNT.drillsRunning]: 1 } });
  assert.equal(chainView(started).current?.id, 'A4-01');
  assert.equal(chainView(started).next?.id, 'A4-01b');
});

test('each act waits for the one before it: Act V does not start while Act IV is open', () => {
  // the foundation is placed before its turn: the act still waits, and the step is not done
  const c = advanceChain({ ...CHAIN_START, counts: { [COUNT.drillsRunning]: 1, 'placed:foundation': 3 } });
  assert.equal(chainView(c).current?.id, 'A4-01');
  assert.equal(stepDone(c, 'B-01'), false);
});

test('gates: a locked feature says why, in the order the player meets the reasons', () => {
  const none = CHAIN_START;
  assert.equal(gateReason('structures', none, 0), 'Needs stage 2');
  assert.equal(gateReason('structures', none, 2), `Needs: ${CHAIN_STEPS.find((s) => s.id === 'A4-04')!.title} (A4-04)`);
  assert.equal(gateReason('rifle', none, 0), `Needs: Take the extraction rifle (A4-01)`);
  assert.equal(isOpen('rifle', none, 0), false);
  // the bloom and the Studio open the base
  let c = advanceChain({ ...CHAIN_START, counts: { [COUNT.drillsRunning]: 1, [COUNT.toolPickup]: 1, [COUNT.dormantSealed]: 1, [COUNT.minedBeam]: 50, [COUNT.milled]: 10, [COUNT.studioOpen]: 1, [COUNT.stage]: 2 } });
  assert.equal(stepDone(c, 'A4-04'), true);
  assert.equal(gateReason('structures', c, 2), null);
  assert.equal(gateReason('drafting', c, 2), null);
  assert.equal(gateReason('heavy', c, 2), 'Needs: Place a foundation (B-01)');
  assert.equal(gateReason('fabricator', c, 2), 'Needs: Seal a room (B-07)');
  assert.equal(gateReason('monsters', c, 6), 'Needs: Make your first gun (F-03)');
  // the Act V steps before B-07 (in order): a foundation, a bin, raw pixels, a drafted blueprint, then the seal (placed by the player)
  c = advanceChain({ ...c, counts: { ...c.counts, 'placed:foundation': 1, 'placed:bin': 1, 'harvest:pxd': 1, drafted: 1, 'placed:airlock': 1, 'placed:lifeSupport': 1, 'placed:weaponBench': 1, stage: 6 } });
  assert.equal(stepDone(c, 'B-07'), true);
  assert.equal(gateReason('fabricator', c, 6), null);
  assert.equal(gateReason('weaponBench', c, 6), 'Needs: Install the fabricator (F-01)');
});

test('every gate names a real step or stage, and the stage gates match the data', () => {
  for (const [feature, g] of Object.entries(GATES)) {
    if (g.after !== undefined) assert.ok(CHAIN_STEPS.some((s) => s.id === g.after), `${feature} gates on ${g.after}`);
  }
  assert.equal(GATES.fabricator.stage, 2);
  assert.equal(GATES.structures.stage, 2);
});

test('the monsters: unlocked after F-03, and the narration hooks count their events', () => {
  let c = advanceChain({ ...CHAIN_START, counts: {} });
  assert.equal(c.monstersUnlocked, false);
  c = monsterSeen(c);
  c = monsterKilled(c);
  c = playerLow(c);
  c = playerDied(c);
  assert.equal(c.counts[COUNT.mobSeen], 1);
  assert.equal(c.counts[COUNT.mobKill], 1);
  assert.equal(c.counts[COUNT.healthLow], 1);
  assert.equal(c.counts[COUNT.deaths], 1);
  assert.equal(firstTime(c, COUNT.mobSeen), true);
  assert.equal(firstTime(monsterSeen(c), COUNT.mobSeen), false);
});

test('counters only grow: a derived value never lowers an event count', () => {
  const c = bump(bump(CHAIN_START, 'mined:beam', 5), 'mined:beam', 3);
  assert.equal(c.counts['mined:beam'], 8);
  assert.equal(setAtLeast(c, 'mined:beam', 2).counts['mined:beam'], 8);
  assert.equal(setAtLeast(c, 'mined:beam', 20).counts['mined:beam'], 20);
});

test('the journal reads progress: "12 / 50" for the first unmet count of a step', () => {
  const s = CHAIN_STEPS.find((x) => x.id === 'A4-02')!;
  assert.equal(stepProgress(s, { [COUNT.minedBeam]: 12 }), '12 / 50');
  assert.deepEqual(unmet(s.until, { [COUNT.minedBeam]: 50 }), { key: COUNT.milled, have: 0, need: 10 });
  assert.equal(stepProgress(s, { [COUNT.minedBeam]: 50, [COUNT.milled]: 10 }), '');
});

test('old saves (version 5, no chain) migrate: a racked rifle starts at A4-01, with the world as evidence', () => {
  // a save past "Feed your mill": the drill runs, the rifle is still on the rack, one foundation stands
  const raw = chainFromSave(undefined, { ...EMPTY, stage: 1, drillsRunning: 1 });
  assert.equal(chainView(raw).current?.id, 'A4-01');
  // the starter shelter's own pieces are not credited (they are free, not placed)
  assert.equal(raw.counts['placed:foundation'], undefined);
  // a save from before the drill: the chain waits
  assert.equal(chainView(chainFromSave(null, EMPTY)).current, null);
  // a saved chain is read back as it was saved
  const saved = advanceChain({ ...CHAIN_START, counts: { [COUNT.drillsRunning]: 1, [COUNT.toolPickup]: 1 } });
  const back = readChain(JSON.parse(JSON.stringify(saved)));
  assert.deepEqual(back, saved);
});

test('a damaged saved chain falls back without breaking: junk counts and unknown quests are dropped', () => {
  const junk = readChain({ progress: { quest: 'nope', step: -4, finished: ['act4', 'bogus', 42], rewarded: 'x' }, counts: { a: -1, b: 'x', c: 2.7, d: Infinity }, monstersUnlocked: 'yes' });
  assert.equal(junk.progress.quest, null);
  assert.deepEqual(junk.progress.finished, ['act4']);
  assert.equal(junk.progress.step, 0);
  assert.deepEqual(junk.counts, { c: 2 });
  assert.equal(junk.monstersUnlocked, false);
  assert.deepEqual(readChain(null), CHAIN_START);
  assert.deepEqual(readChain('nonsense'), CHAIN_START);
});

test('the world evidence counts drafted blueprints and raw pixels, but not the starter kit', () => {
  const e = evidence({ ...EMPTY, itemIds: ['bp:starter', 'pxd-mono'] });
  assert.equal(e['placed:foundation'], undefined);
  assert.equal(e[COUNT.drafted], undefined);
  assert.equal(e[COUNT.harvestPxd], 1);
  assert.equal(evidence({ ...EMPTY, itemIds: ['bp:cube:basalt'] })[COUNT.drafted], 1);
  assert.equal(evidence({ ...EMPTY, sidearm: true })[COUNT.equipSidearm], 1);
});

test('the Act V kit covers one hardpoint and one heavy press, so a fresh player is never stuck without primitives', () => {
  const need: Record<string, number> = {};
  // the kit holds primitives only: the ore comes from the drills, the maps from the mill
  const bills = [PIECE_EXTRA.hardpoint ?? [], HEAVY_BILL.press, [{ item: 'prim-cube', n: 1 }], [{ item: 'prim-chassis', n: 1 }]];
  for (const bill of bills) {
    for (const { item, n } of bill) if (item.startsWith('prim-')) need[item] = (need[item] ?? 0) + n;
  }
  const kit = Object.fromEntries(ACT_V_KIT.map((st) => [st.item, st.n]));
  for (const [item, n] of Object.entries(need)) assert.ok((kit[item] ?? 0) >= n, `${item}: kit ${kit[item] ?? 0} needs ${n}`);
  // the maps: one drafted blueprint each for the cube and the chassis, and a map per placed piece of those families
  assert.ok((kit['map-basalt'] ?? 0) >= 6, 'the kit holds maps for the drafts and the first pieces');
});

test('the dormant leak is the step after the rifle; only sealing the dormant anomaly finishes it', () => {
  const c = advanceChain({ ...CHAIN_START, counts: { [COUNT.drillsRunning]: 1, [COUNT.toolPickup]: 1 } });
  assert.equal(chainView(c).current?.id, 'A4-01b');
  assert.equal(chainView(c).next?.id, 'A4-02');
  assert.equal(stepDone(advanceChain({ ...c, counts: { ...c.counts, [COUNT.leakSealed]: 5 } }), 'A4-01b'), false);
  assert.equal(stepDone(advanceChain({ ...c, counts: { ...c.counts, [COUNT.dormantSealed]: 1 } }), 'A4-01b'), true);
});

test('an old save past the rifle keeps its place: the seal is credited, so A4-02 is still the current step', () => {
  const old = { progress: { quest: 'act4', step: 1, finished: [], rewarded: [] }, counts: { [COUNT.drillsRunning]: 1, [COUNT.toolPickup]: 1 }, monstersUnlocked: false };
  const c = readChain(old);
  assert.equal(c.version, CHAIN_VERSION);
  assert.equal(chainView(c).current?.id, 'A4-02');
  assert.equal(stepDone(c, 'A4-01'), true);
  assert.equal(stepDone(c, 'A4-01b'), true);
});

test('an old save still at the rifle gets the dormant seal as its next step', () => {
  const old = { progress: { quest: 'act4', step: 0, finished: [], rewarded: [] }, counts: { [COUNT.drillsRunning]: 1 }, monstersUnlocked: false };
  const c = readChain(old);
  assert.equal(chainView(c).current?.id, 'A4-01');
  const next = advanceChain({ ...c, counts: { ...c.counts, [COUNT.toolPickup]: 1 } });
  assert.equal(chainView(next).current?.id, 'A4-01b');
});

test('a version 2 save is read as it is (no second migration)', () => {
  const saved = { progress: { quest: 'act4', step: 1, finished: [], rewarded: [] }, counts: {}, monstersUnlocked: false, version: 2 };
  assert.equal(readChain(saved).progress.step, 1);
  assert.equal(readChain(saved).version, CHAIN_VERSION);
});
