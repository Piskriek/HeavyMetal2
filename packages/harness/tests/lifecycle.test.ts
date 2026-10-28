// Plan 56 W5 (§14, §15): kundalini rises ray by ray; ready = risen and mastered; a risen preset sees the next rung; ready
// presets astral-travel, read only, through open gates; the weekly majority adopts; harvest day graduates, waits or repeats;
// wanderers descend veiled and limited, calm others while balanced, and lend their cue; it is easier the second time.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ALIGNED, type Mem } from '@hm/shorthand';
import {
  ANCHOR_CALM_MAX, SQ_DISTORTION_CATALOG, anchorCalm, anchorLinks, astralTravel, awarenessOf, compileSystemMemory, createPresetMemory,
  descend, dream, dreamOpenness, harvestReady, harvestWeek, isRisen, kundalini, mastered, recordExperience, rungHarvestReady,
  weeklyAdoption, type Experience,
} from '../src/index';

const at = (t: number, over: Partial<Experience> = {}): Experience => ({
  t, stage: 'S3', cat: 'WEAPON_BURST_CADENCE', excitement: 0.5, error: 0.1, by: ALIGNED, ...over,
});
const write = (mem: Mem, xs: readonly Experience[]): Mem => xs.reduce(recordExperience, mem);
/** Eight calm, good moments: lived, balanced, mastered. */
const ripe = (of: string, t0 = 100): Mem => write(createPresetMemory(of), Array.from({ length: 8 }, (_, i) => at(t0 + i * 10)));
const ray = (d: keyof typeof SQ_DISTORTION_CATALOG): number => SQ_DISTORTION_CATALOG[d].rayIndex - 1;

test('kundalini rises ray by ray from red, never skipping; risen takes a lived life', () => {
  assert.equal(kundalini(createPresetMemory('loc:0001')), 7);
  assert.equal(isRisen(createPresetMemory('loc:0001')), false, 'a new preset is undistorted, not risen');
  const m = ripe('loc:0001');
  assert.equal(isRisen(m), true);
  // a charge on the sacral ray stops the rising at red
  const sacral = { ...m, charge: m.charge.map((c, i) => (i === ray('sacral-guilt') ? 40 : c)) };
  assert.equal(kundalini(sacral), 1);
  // a charge on red stops it at nothing, however clear the rays above are
  assert.equal(kundalini({ ...m, charge: m.charge.map((c, i) => (i === 0 ? 40 : c)) }), 0);
  // an open link on the solar ray stops it too, even at rest
  assert.equal(kundalini({ ...m, cause: [{ by: 'solar-control', d: 'solar-control', n: 1, open: true }] }), 2);
  assert.equal(kundalini({ ...m, cause: [{ by: 'solar-control', d: 'solar-control', n: 1, open: false }] }), 7, 'a closed link is a lesson, not a block');
});

test('ready to harvest: risen and mastered; a rung also leaves nothing open below and harmonizes only whole triads', () => {
  const m = ripe('loc:0001');
  assert.equal(mastered(m), true);
  assert.equal(harvestReady(m), true);
  assert.equal(harvestReady(write(createPresetMemory('loc:0002'), Array.from({ length: 8 }, (_, i) => at(i, { error: 0.6 })))), false, 'not mastered');
  const ego = ripe('brain:0e01');
  const below = recordExperience(ripe('loc:0003'), at(300, { by: 'solar-control', src: 'brain:0e01', excitement: 1 }));
  assert.equal(rungHarvestReady(ego, [below], []), false, 'it caused a distortion below that is still open');
  assert.equal(rungHarvestReady(ego, [ripe('loc:0003')], [{ observer: 'brain:0e01', whole: false }]), false, 'a triad it harmonizes is not whole');
  assert.equal(rungHarvestReady(ego, [ripe('loc:0003')], [{ observer: 'brain:0e01', whole: true }]), true);
});

test('a risen preset gains the next rung\'s awareness before the harvest; a risen ego sees the system; others see nothing yet', () => {
  const kit = ripe('kit:00aa');
  const loose = recordExperience(ripe('loc:0c0c'), at(400, { by: 'solar-control', excitement: 1 }));
  const egos = [{ ego: ripe('brain:0e01'), presets: ['kit:00aa', 'loc:0c0c'], weights: { prefer: { 'kit:00aa': 30 } } }];
  const pack = compileSystemMemory([kit, loose], egos);
  const seen = awarenessOf(pack, 'kit:00aa');
  assert.deepEqual(seen?.rungs.map((r) => [r.of, r.thinking]), [['brain:0e01', ALIGNED]]);
  assert.equal(seen?.home, null);
  assert.equal(awarenessOf(pack, 'loc:0c0c'), null, 'not risen: the rung above is still veiled');
  const egoView = awarenessOf(pack, 'brain:0e01');
  assert.equal(egoView?.rungs[0]?.of, 'overwatch');
  assert.ok(egoView?.system && typeof egoView.system.coherence === 'number');
  assert.equal(awarenessOf(pack, 'kit:ffff'), null);
});

test('a wanderer descends veiled and limited; risen again in the lower role, it remembers home', () => {
  const higher = ripe('brain:0e01');
  const w = descend(higher, 'loc:0d0d', 0.7);
  assert.deepEqual(w.wan, { from: 'brain:0e01', done: 1, lim: 0.7 });
  assert.equal(w.ep.length, 0, 'the veil: none of its higher memory comes along');
  assert.equal(descend({ ...higher, wan: { from: 'overwatch', done: 3, lim: 1 } }, 'loc:0d0e', 0.5).wan?.done, 4, 'its past risings add up');
  assert.throws(() => descend(higher, 'loc:0d0f', 1.5), /share/);
  // once it rises in the lower role, the awareness it gains names where it came from
  const risenAgain = write(w, Array.from({ length: 8 }, (_, i) => at(500 + i * 10)));
  const pack = compileSystemMemory([risenAgain], [{ ego: ripe('brain:0e02'), presets: ['loc:0d0d'], weights: { prefer: {} } }]);
  assert.equal(awarenessOf(pack, 'loc:0d0d')?.home, 'brain:0e01');
});

test('a balanced wanderer calms the moment for the presets acting with it; a distorted one calms no one', () => {
  const anchor = write(descend(ripe('brain:0e01'), 'loc:0d0d', 0.8), Array.from({ length: 8 }, (_, i) => at(100 + i * 10)));
  const bent = write(descend(ripe('brain:0e02'), 'loc:0d0e', 0.8), [at(100, { by: 'solar-control', excitement: 1 }), at(110, { by: 'solar-control', excitement: 1 }), at(120, { by: 'solar-control', excitement: 1 }), at(130, { by: 'solar-control', excitement: 1 })]);
  assert.equal(anchorCalm([anchor]), 0.3);
  assert.equal(anchorCalm([anchor, anchor, anchor]), ANCHOR_CALM_MAX);
  assert.equal(anchorCalm([bent]), 0, 'a healer balances itself first');
  assert.equal(anchorCalm([ripe('loc:0001')]), 0, 'only wanderers anchor');
  const m = createPresetMemory('mot:beef');
  const wild = recordExperience(m, at(200, { by: 'solar-control', excitement: 1 }));
  const calmed = recordExperience(m, at(200, { by: 'solar-control', excitement: 1, calm: anchorCalm([anchor]) }));
  assert.equal(calmed.ep[0]?.ex, 1, 'the excitement is still felt');
  assert.ok(calmed.ep[0]!.h < wild.ep[0]!.h && calmed.hard < wild.hard, 'it sets softer');
  assert.ok((calmed.charge[ray('solar-control')] ?? 0) < (wild.charge[ray('solar-control')] ?? 0), 'and distorts less');
});

test('the example: in dreams a balanced wanderer lends its cue to the presets it acted with; it is easier the second time', () => {
  const anchor = write(descend(ripe('brain:0e01'), 'loc:0d0d', 0.8), Array.from({ length: 8 }, (_, i) => at(100 + i * 10)));
  // a rigid preset that acted alongside it, then hardened under control
  const rigid = write(createPresetMemory('kit:00aa'), [...Array.from({ length: 4 }, (_, i) => at(102 + i * 10)), ...Array.from({ length: 6 }, (_, i) => at(300 + i, { by: 'solar-control', excitement: 1 }))]);
  const links = anchorLinks([anchor, rigid]);
  assert.deepEqual(links.map((l) => [l.a, l.b]), [['kit:00aa', 'loc:0d0d']]);
  const input = { ego: createPresetMemory('brain:0e09'), presets: [anchor, rigid], weights: { prefer: {} }, now: 400, cues: [] as const };
  assert.ok(dream(input).digest.refused.length > 0, 'alone, with no cue, it holds on');
  const withAnchor = dream({ ...input, dyads: links });
  assert.ok(withAnchor.digest.replayed.some((r) => r.of === 'kit:00aa' && r.partner === 'loc:0d0d'));
  assert.ok((withAnchor.presets[1]!.charge[ray('solar-control')] ?? 0) < (rigid.charge[ray('solar-control')] ?? 0));
  // easier for a wanderer who has risen before, but never past fully open
  const plain = { ...rigid };
  const wanderer = { ...rigid, wan: { from: 'brain:0e01', done: 2, lim: 0.8 } };
  assert.ok(dreamOpenness(wanderer, true) > dreamOpenness(plain, true));
  assert.ok(dreamOpenness({ ...wanderer, hard: 0, inv: 1, wan: { from: 'x:00', done: 9, lim: 1 } }, true) <= 1);
});

test('astral travel: only ready, only through open gates, only to hosts that resonate; read only; it brings lessons home', () => {
  const traveller = ripe('loc:0001');
  const hostLoc = { ...ripe('loc:0f01'), cause: [{ by: 'solar-control' as const, d: 'root-reactivity' as const, n: 6, open: false }] };
  const lowerLoc = { ...recordExperience(ripe('loc:0f02'), at(900, { by: 'solar-control', excitement: 1 })) };
  const otherKind = { ...ripe('kit:0f03'), cause: [{ by: 'sacral-guilt' as const, d: 'sacral-guilt' as const, n: 4, open: false }] };
  const host = { node: 'plot-17', access: 'open' as const, presets: [hostLoc, lowerLoc, otherKind] };
  const frozen = JSON.stringify(host);
  const r = astralTravel(traveller, host, 1000);
  assert.deepEqual(r.visited, ['loc:0f01'], 'its own kind, at its balance or above');
  assert.equal(JSON.stringify(host), frozen, 'it never writes to the host');
  const trip = r.mem.ep[r.mem.ep.length - 1]!;
  assert.equal(trip.cat, 'astral:plot-17');
  assert.ok(trip.ex > 0.2, 'novel lessons are exciting');
  assert.deepEqual(r.mem.cause.find((c) => c.d === 'root-reactivity'), { by: 'solar-control', d: 'root-reactivity', n: 3, open: false }, 'a lesson at half weight, closed');
  assert.equal(isRisen(r.mem), true, 'travelling keeps it balanced');
  assert.deepEqual(astralTravel(traveller, { ...host, access: 'code-only' }, 1000).visited, []);
  assert.deepEqual(astralTravel(traveller, { ...host, access: 'closed' }, 1000).visited, []);
  assert.match(astralTravel(createPresetMemory('loc:0002'), host, 1000).why, /not ready/);
  assert.throws(() => astralTravel(traveller, { ...host, node: 'Not A Node' }, 1000), /node/);
});

test('the weekly adoption: more than half of the slot\'s players, a quorum, and ready; otherwise the default holds', () => {
  const week = (entries: { code: string; players: number; ready: boolean }[], electorate = 20) => ({ slot: 'default:loc', current: 'LOC-OLD', electorate, entries });
  assert.equal(weeklyAdoption(week([{ code: 'LOC-NEW', players: 11, ready: true }])).adopted, 'LOC-NEW');
  assert.match(weeklyAdoption(week([{ code: 'LOC-NEW', players: 10, ready: true }])).why, /no majority: 10 of 20/);
  assert.equal(weeklyAdoption(week([{ code: 'LOC-NEW', players: 15, ready: false }])).adopted, null, 'only a ready variant');
  assert.match(weeklyAdoption(week([{ code: 'LOC-NEW', players: 6, ready: true }], 9)).why, /no quorum/);
  assert.match(weeklyAdoption(week([{ code: 'A', players: 5, ready: true }, { code: 'B', players: 5, ready: true }], 10)).why, /tie/);
  assert.match(weeklyAdoption(week([{ code: 'LOC-OLD', players: 14, ready: true }])).why, /holds its majority/);
  assert.equal(weeklyAdoption(week([{ code: 'LOC-NEW', players: 11, ready: true }])).defaultCode, 'LOC-NEW');
  assert.throws(() => weeklyAdoption(week([{ code: 'A', players: 15, ready: true }, { code: 'B', players: 15, ready: true }])), /once per slot/);
  assert.throws(() => weeklyAdoption(week([{ code: 'A', players: 1.5, ready: true }])), /whole numbers/);
});

test('harvest day: adopted and ready graduate, ready ones wait, unbalanced ones repeat after four weeks; nothing perishes', () => {
  const adopted = ripe('loc:0001');
  const waiting = ripe('loc:0002');
  const bent = recordExperience(ripe('loc:0003'), at(900, { by: 'solar-control', excitement: 1 }));
  const learning = write(createPresetMemory('loc:0004'), [at(1)]);
  let state = { presets: [adopted, waiting, bent, learning] as readonly Mem[], weeks: {} as Readonly<Record<string, number>> };
  let last = null as ReturnType<typeof harvestWeek> | null;
  for (let w = 1; w <= 4; w++) {
    last = harvestWeek({ week: w, presets: state.presets, adopted: ['loc:0001'], unbalancedWeeks: state.weeks });
    state = { presets: last.presets, weeks: last.unbalancedWeeks };
    if (w < 4) assert.equal(last.unbalancedWeeks['loc:0003'], w);
  }
  assert.deepEqual(last!.graduated, ['loc:0001']);
  assert.deepEqual(last!.waiting, ['loc:0002']);
  assert.deepEqual(last!.repeated, ['loc:0003']);
  const repeated = last!.presets[2]!;
  assert.equal(repeated.cyc, bent.cyc + 1);
  assert.deepEqual(repeated.ep, bent.ep, 'it repeats with every memory');
  assert.equal(last!.unbalancedWeeks['loc:0004'], undefined, 'balanced and still learning: not counted against it');
  assert.throws(() => harvestWeek({ week: -1, presets: [], adopted: [], unbalancedWeeks: {} }), /week/);
});
