/**
 * Plan 58 Wave 5 (Track 1): Executable Live Bridge Verification Runner (`scripts/verify-capital-empire-bridge.mjs`)
 * connecting the latest `c:\CapitalEmpire` (`71894704`, PR #854) directly to `@hm/gamebridge` & `@hm/harness`.
 *
 * Usage:
 *   node --import tsx scripts/verify-capital-empire-bridge.mjs
 *
 * Verifies:
 * 1. Direct import & parity with `c:\CapitalEmpire\src\game\golf\tour.ts`, `tournamentday.ts`, `latereasons.ts`,
 *    `galleries.ts`, and `crew.ts`.
 * 2. A full 4-day Tier 4 (`Maple Falls Classic`, 12,000–25,000 spectators) tournament cycle across persistent
 *    residents, visitors, competitors, greenkeepers (`gk`), mower operators (`mo`), cars, shuttle buses, and utility carts.
 * 3. Day 1 traffic/carpark/gate bottlenecks (`scoreTournamentDay` + `lateReasons`) charge distortions (`solar-anxiety`,
 *    `sacral-frustration`, `root-lack`) in persistent visitors and vehicles.
 * 4. Across Nights 1–3, Town Manager infrastructure fixes (`upgrade-junctions`, `add-park-and-ride`,
 *    `add-gate-lanes`, `add-hospitality-tents`) cue `runPopulationNightDream` to heal distortions, close open cause links,
 *    and raise `daySatisfaction` (from <55% on Day 1 to >92% on Day 4) and `H_town` (>= 0.95 Social Memory Complex).
 */
import assert from 'node:assert/strict';
import {
  TIERS,
  reputationAfter as ceReputationAfter,
  spectatorDemand,
  dayShare,
} from 'file:///c:/CapitalEmpire/src/game/golf/tour.ts';
import { scoreTournamentDay } from 'file:///c:/CapitalEmpire/src/game/golf/tournamentday.ts';
import {
  lateReasons,
  trafficSatisfaction,
  tentSpendFactor,
} from 'file:///c:/CapitalEmpire/src/game/golf/latereasons.ts';
import { gallerySpots, pickSpot } from 'file:///c:/CapitalEmpire/src/game/golf/galleries.ts';
import { CREW_OUT, SPEED } from 'file:///c:/CapitalEmpire/src/game/golf/crew.ts';
import {
  CAPITAL_EMPIRE_OPEN_PROFILE,
  computeTournamentDaySatisfaction,
  createOpenHostTownSession,
  relayAllowed,
  runPopulationNightDream,
  stepMacroTownCatalyst,
  syncPersistentPopulation,
} from '../packages/gamebridge/src/index.ts';

console.log('================================================================================');
console.log('FIDELITY @hm/gamebridge <-> c:\\CapitalEmpire (71894704) Live 4-Day Verification');
console.log('================================================================================');

// 1. Verify Open-Source Host Profile & Relay Permission
const relayCheck = relayAllowed(CAPITAL_EMPIRE_OPEN_PROFILE, []);
assert.equal(relayCheck.ok, true, 'CAPITAL_EMPIRE_OPEN_PROFILE must pass relayAllowed');
console.log(`[1/4] Checked Profile: ${CAPITAL_EMPIRE_OPEN_PROFILE.title} (relayAllowed=${relayCheck.ok})`);
console.log(`      CapitalEmpire Tiers loaded: ${TIERS.map((t) => `T${t.tier}:${t.name}`).join(' | ')}`);
console.log(`      Grounds Crew out at ${CREW_OUT / 60}:00 (walk=${SPEED.walk}, cart=${SPEED.cart}, reel=${SPEED.reel} tiles/min)`);

// 2. Build 18-hole gallery spots from CapitalEmpire's galleries.ts
const tees = Array.from({ length: 18 }, (_, i) => ({ hole: i + 1, x: 200 + i * 40, y: 300 + (i % 4) * 35 }));
const pins = Array.from({ length: 18 }, (_, i) => ({ hole: i + 1, x: 230 + i * 40, y: 325 + (i % 4) * 35 }));
const spots = gallerySpots(tees, pins, []);
assert.equal(spots.length, 36, '18 holes should generate 36 tee + green gallery spots');
const spotFill = new Array(spots.length).fill(0);
const chosenSpotIdx = pickSpot(spots, spotFill, 0.85);
assert.ok(chosenSpotIdx >= 0 && chosenSpotIdx < spots.length);

// 3. Initialize Maple Falls Open Host Town Session (Tier 4: Maple Falls Classic)
let session = createOpenHostTownSession({
  townId: 'town:maple-falls',
  townName: 'Maple Falls Valley',
  locale: 'en',
  initialTier: 4,
  initialReputation: 75,
});

const peakSpectators = spectatorDemand(4, session.reputation);

// 4-Day Tournament Scenario:
// Day 1: Severe Maple Hwy junction jam + carpark overflow + 2-lane gate bottleneck
// Day 2: Upgraded junctions + added Park & Ride (traffic & carpark relieved, tent queues remain)
// Day 3: Added express gate lanes + hospitality tents (smooth queues, high viewing)
// Day 4: Championship Sunday — full 18th grandstand roar, 0 missed spectators, SMC coherence >= 0.95
const FOUR_DAY_PLAN = [
  {
    dayNumber: 1,
    tick: 1000,
    gateLanes: 2,
    expressGates: false,
    trafficDelayMin: 38,
    trafficMissed: 1400,
    carsParked: 3200,
    carsTurnedAway: 600,
    exitP95Min: 95,
    tentQueueMin: 24,
    viewing: 0.55,
    meanTripS: 480,
    freeFlowS: 180,
    fixesAppliedTonight: ['upgrade-junctions', 'add-park-and-ride'],
  },
  {
    dayNumber: 2,
    tick: 2000,
    gateLanes: 4,
    expressGates: false,
    trafficDelayMin: 18,
    trafficMissed: 250,
    carsParked: 4800,
    carsTurnedAway: 80,
    exitP95Min: 52,
    tentQueueMin: 14,
    viewing: 0.72,
    meanTripS: 270,
    freeFlowS: 180,
    fixesAppliedTonight: ['add-gate-lanes', 'add-hospitality-tents'],
  },
  {
    dayNumber: 3,
    tick: 3000,
    gateLanes: 8,
    expressGates: true,
    trafficDelayMin: 6,
    trafficMissed: 0,
    carsParked: 6200,
    carsTurnedAway: 0,
    exitP95Min: 32,
    tentQueueMin: 5,
    viewing: 0.88,
    meanTripS: 205,
    freeFlowS: 180,
    fixesAppliedTonight: ['add-18th-grandstand'],
  },
  {
    dayNumber: 4,
    tick: 4000,
    gateLanes: 10,
    expressGates: true,
    trafficDelayMin: 3,
    trafficMissed: 0,
    carsParked: 7400,
    carsTurnedAway: 0,
    exitP95Min: 26,
    tentQueueMin: 3.5,
    viewing: 0.96,
    meanTripS: 192,
    freeFlowS: 180,
    fixesAppliedTonight: [
      'upgrade-junctions',
      'add-park-and-ride',
      'add-gate-lanes',
      'add-hospitality-tents',
      'add-18th-grandstand',
    ],
  },
];

const dailySatisfactions = [];
const dailyCoherenceH = [];
let totalClosedCauses = 0;

for (const dayCfg of FOUR_DAY_PLAN) {
  const share = dayShare(dayCfg.dayNumber - 1, 4);
  const targetCrowd = Math.round(peakSpectators * share);
  const arrivalsPerMinute = Array.from({ length: 120 }, () => Math.round(targetCrowd / 120));

  // Score the day through CapitalEmpire's real scoreTournamentDay()
  const ceScored = scoreTournamentDay({
    tier: 4,
    reputation: session.reputation,
    gates: [
      {
        lanes: dayCfg.gateLanes,
        arrivalsPerMinute,
        trafficDelayMin: dayCfg.trafficDelayMin,
      },
    ],
    carparks: [
      {
        carsParked: dayCfg.carsParked,
        carsTurnedAway: dayCfg.carsTurnedAway,
        feePerCar: 15,
        exitTimesMin: [dayCfg.exitP95Min * 0.7, dayCfg.exitP95Min * 0.85, dayCfg.exitP95Min],
      },
    ],
    expressGates: dayCfg.expressGates,
    trafficMissed: dayCfg.trafficMissed,
    otherQueueMin: dayCfg.tentQueueMin,
    viewingOverride: dayCfg.viewing,
  });

  // Verify exact parity between CapitalEmpire's daySatisfaction/reputationAfter and our SDK
  const sdkSat = computeTournamentDaySatisfaction(ceScored.facts);
  assert.ok(
    Math.abs(sdkSat - ceScored.satisfaction) < 0.01,
    `SDK satisfaction (${sdkSat}) must match CapitalEmpire daySatisfaction (${ceScored.satisfaction})`,
  );

  // Diagnose late reasons using CapitalEmpire's real lateReasons() & trafficSatisfaction()
  const reasons = lateReasons({
    onRoadAtFirstTee: dayCfg.trafficMissed,
    turnedAway: dayCfg.carsTurnedAway * 2.5,
    stranded: 0,
    lost: 0,
    lateAtGate: ceScored.facts.late,
    worstJunctions: ['Maple Hwy Exit 4', 'Clubhouse Roundabout'],
  });
  const trafficSat = trafficSatisfaction(dayCfg.meanTripS, dayCfg.freeFlowS);
  const spendFactor = tentSpendFactor(trafficSat);

  // Build persistent entity batch for this day
  const isJammedDay = dayCfg.dayNumber === 1;
  const entitiesBatch = [
    {
      id: 'gk-01',
      kind: 'person',
      role: 'greenkeeper',
      position: { x: pins[17].x, y: pins[17].y },
      catalystEvent: 'CUP_CUT_ON_TIME',
    },
    {
      id: 'mo-01',
      kind: 'person',
      role: 'mower-operator',
      position: { x: tees[8].x, y: tees[8].y },
      catalystEvent: 'FAIRWAY_STRIPE_MOWN',
    },
    {
      id: 'comp-01',
      kind: 'person',
      role: 'competitor',
      position: { x: pins[17].x, y: pins[17].y },
      catalystEvent: dayCfg.viewing >= 0.85 ? 'GREAT_VIEWING_18TH' : 'ON_TIME_ARRIVAL',
    },
    {
      id: 'res-01',
      kind: 'person',
      role: 'resident',
      position: { x: 400, y: 420 },
      catalystEvent: isJammedDay ? 'TRAFFIC_JAM_DELAY' : 'ON_TIME_ARRIVAL',
      exitDelayMin: dayCfg.exitP95Min,
    },
    {
      id: 'vis-01',
      kind: 'person',
      role: 'visitor',
      position: { x: spots[chosenSpotIdx].x, y: spots[chosenSpotIdx].y },
      catalystEvent: isJammedDay ? 'LONG_QUEUE_WAIT' : 'GREAT_VIEWING_18TH',
      queueWaitMin: dayCfg.tentQueueMin,
    },
    {
      id: 'vis-02',
      kind: 'person',
      role: 'gallery-fan',
      position: { x: pins[17].x, y: pins[17].y },
      catalystEvent: isJammedDay ? 'TURNED_AWAY_CARPARK_FULL' : 'GREAT_VIEWING_18TH',
      exitDelayMin: dayCfg.exitP95Min,
    },
    {
      id: 'car-101',
      kind: 'vehicle',
      role: 'car',
      position: { x: 180, y: 260 },
      catalystEvent: isJammedDay ? 'TRAFFIC_JAM_DELAY' : 'TOLL_GATE_PASS',
      exitDelayMin: dayCfg.exitP95Min,
    },
    {
      id: 'shuttle-01',
      kind: 'vehicle',
      role: 'shuttle',
      position: { x: 310, y: 340 },
      catalystEvent: 'SMOOTH_SHUTTLE_RIDE',
    },
    {
      id: 'cart-gk-01',
      kind: 'vehicle',
      role: 'golf-cart',
      position: { x: pins[0].x, y: pins[0].y },
      catalystEvent: 'SMOOTH_SHUTTLE_RIDE',
    },
    {
      id: 'mower-reel-01',
      kind: 'vehicle',
      role: 'mower-reel',
      position: { x: tees[4].x, y: tees[4].y },
      catalystEvent: 'FAIRWAY_STRIPE_MOWN',
    },
  ];

  const syncRes = syncPersistentPopulation(session, entitiesBatch, dayCfg.tick);
  session = syncRes.session;

  const prevRep = session.reputation;
  const macroRes = stepMacroTownCatalyst(session, {
    tick: dayCfg.tick + 100,
    tournamentTier: 4,
    reputation: prevRep,
    dayFacts: ceScored.facts,
    courseFacts: { holes: 18, lengthM: 6550, builtNeedsCount: 12 + dayCfg.dayNumber * 2 },
  });
  session = macroRes.session;
  assert.ok(
    Math.abs(macroRes.nextReputation - ceReputationAfter(prevRep, ceScored.satisfaction)) < 0.01,
    'SDK nextReputation must match CapitalEmpire reputationAfter',
  );

  // Run Nightly Dream with the Town Manager's infrastructure fixes
  const nightRes = runPopulationNightDream(
    session,
    dayCfg.tick + 500,
    dayCfg.fixesAppliedTonight,
  );
  session = nightRes.session;

  dailySatisfactions.push(macroRes.daySatisfactionScore);
  dailyCoherenceH.push(nightRes.townCoherenceH);
  totalClosedCauses += nightRes.closedCausesCount;

  const sampleVisitor = syncRes.decisions.find((d) => d.id === 'vis-01');
  console.log(
    `[Day ${dayCfg.dayNumber}] Crowd=${ceScored.admitted} | Sat=${macroRes.daySatisfactionScore.toFixed(1)}% | TrafficSat=${trafficSat}% (tentSpend=${spendFactor.toFixed(2)}x) | Net=$${ceScored.money.net.toLocaleString()}`,
  );
  if (reasons.length > 0) {
    console.log(`        Top Bottleneck: "${reasons[0].label}" (${reasons[0].fans} fans) -> Fix: ${reasons[0].fix}`);
  }
  console.log(
    `        Visitor Voice: ${sampleVisitor.utterance.spokenText} [${sampleVisitor.utterance.envelope.timbreFilter}]`,
  );
  console.log(
    `        Night ${dayCfg.dayNumber} Dream: balanced=${nightRes.balancedCount}, closedLinks=${nightRes.closedCausesCount}, H_town=${nightRes.townCoherenceH} (SMC=${nightRes.isTownSocialMemoryComplex})`,
  );
  console.log(`        Morning SitRep: ${nightRes.sitRep.headline}`);
}

// Assertions proving the 4-day arc
assert.ok(dailySatisfactions[0] < 55, `Day 1 satisfaction (${dailySatisfactions[0]}) should reflect severe bottleneck (<55%)`);
assert.ok(dailySatisfactions[3] > 92, `Day 4 satisfaction (${dailySatisfactions[3]}) should exceed 92% after infrastructure fixes`);
assert.ok(dailySatisfactions[3] > dailySatisfactions[0], 'Satisfaction must climb from Day 1 to Day 4');
assert.ok(totalClosedCauses >= 1, `Nightly dreams with infrastructure fixes must close at least 1 open cause link (closed=${totalClosedCauses})`);
assert.ok(dailyCoherenceH[3] >= 0.95, `Day 4 H_town (${dailyCoherenceH[3]}) must reach Social Memory Complex threshold (>= 0.95)`);

console.log('================================================================================');
console.log(
  `PASS: 4-Day CapitalEmpire <-> @hm/gamebridge verification green (Sat ${dailySatisfactions[0].toFixed(1)}% -> ${dailySatisfactions[3].toFixed(1)}%, H_town=${dailyCoherenceH[3]}, closedLinks=${totalClosedCauses}).`,
);
console.log('================================================================================');
