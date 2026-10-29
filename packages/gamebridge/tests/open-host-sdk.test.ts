import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CAPITAL_EMPIRE_OPEN_PROFILE,
  checkBridgeProfile,
  computeTournamentDaySatisfaction,
  createOpenHostProfile,
  createOpenHostTownSession,
  relayAllowed,
  runPopulationNightDream,
  stepMacroTownCatalyst,
  syncPersistentPopulation,
} from '../src/index.js';

test('Plan 58 W4 (Part B.1): createOpenHostProfile registers CapitalEmpire in 1 call and passes relayAllowed cleanly under RULES 8a', () => {
  const profile = createOpenHostProfile({
    id: 'capital-empire',
    title: 'Capital Empire: Maple Falls Golf & Town Manager',
    license: 'open-source',
    hasAntiCheat: false,
    relay: {
      enabled: true,
      basis: 'owner-open-source-sdk: creator owns all rights and enabled @hm/gamebridge',
    },
  });

  assert.equal(profile.gameId, 'capital-empire');
  assert.equal(profile.verdict, 'permitted');
  assert.equal(profile.soloOnly, false);
  assert.ok(profile.streams.includes('entity-kinds'));

  const checked = checkBridgeProfile(profile);
  assert.ok(checked !== null);

  const relay = relayAllowed(profile, []);
  assert.equal(relay.ok, true);
  assert.equal(relayAllowed(CAPITAL_EMPIRE_OPEN_PROFILE, []).ok, true);
});

test('Plan 58 W4 (Part B.2): syncPersistentPopulation binds persistent people & vehicles to Organic/Mechanical Bodies, Cross-Wired Archetypes & Expressive Utterances', () => {
  const session0 = createOpenHostTownSession({
    townId: 'town:maple-falls',
    townName: 'Maple Falls Valley',
    locale: 'en',
  });

  const { session: session1, decisions } = syncPersistentPopulation(
    session0,
    [
      {
        id: 'walker-01',
        kind: 'person',
        role: 'resident',
        position: { x: 420, y: 512 },
        catalystEvent: 'ON_TIME_ARRIVAL',
      },
      {
        id: 'visitor-02',
        kind: 'person',
        role: 'visitor',
        position: { x: 428, y: 518 },
        catalystEvent: 'LONG_QUEUE_WAIT',
        queueWaitMin: 24,
      },
      {
        id: 'competitor-03',
        kind: 'person',
        role: 'competitor',
        position: { x: 610, y: 740 },
        catalystEvent: 'GREAT_VIEWING_18TH',
      },
      {
        id: 'shuttle-01',
        kind: 'vehicle',
        role: 'shuttle',
        position: { x: 380, y: 490 },
        catalystEvent: 'SMOOTH_SHUTTLE_RIDE',
      },
      {
        id: 'car-404',
        kind: 'vehicle',
        role: 'car',
        position: { x: 210, y: 300 },
        catalystEvent: 'TRAFFIC_JAM_DELAY',
        exitDelayMin: 65,
      },
    ],
    120,
  );

  assert.equal(decisions.length, 5);
  assert.equal(session1.entities.size, 5);

  const resident = decisions.find((d) => d.id === 'walker-01')!;
  assert.equal(resident.body.kind, 'organic');
  assert.equal(resident.intent.preservesFreeWill, true);
  assert.ok(resident.utterance.code.startsWith('utt:'));
  assert.ok(['The Magician', 'The High Priestess'].includes(resident.archetype.mindLead));

  const jammedCar = decisions.find((d) => d.id === 'car-404')!;
  assert.equal(jammedCar.body.kind, 'mechanical');
  assert.ok(jammedCar.mem.bal < 1);
  assert.ok(jammedCar.utterance.spokenText.length > 10);
});

test('Plan 58 W4 (Part B.3): stepMacroTownCatalyst & runPopulationNightDream compute CapitalEmpire daySatisfaction, update Town 4-Floats, and emit Morning Town SitRep', () => {
  let session = createOpenHostTownSession({
    townId: 'town:maple-falls',
    townName: 'Maple Falls Valley',
    initialTier: 3,
    initialReputation: 65,
  });

  session = syncPersistentPopulation(
    session,
    [
      { id: 'res-1', kind: 'person', role: 'resident', position: { x: 100, y: 100 }, catalystEvent: 'ON_TIME_ARRIVAL' },
      { id: 'vis-1', kind: 'person', role: 'visitor', position: { x: 120, y: 110 }, catalystEvent: 'LONG_QUEUE_WAIT', queueWaitMin: 22 },
      { id: 'comp-1', kind: 'person', role: 'competitor', position: { x: 140, y: 130 }, catalystEvent: 'GREAT_VIEWING_18TH' },
      { id: 'cart-1', kind: 'vehicle', role: 'golf-cart', position: { x: 150, y: 140 }, catalystEvent: 'SMOOTH_SHUTTLE_RIDE' },
    ],
    200,
  ).session;

  // Verify exact parity with CapitalEmpire's daySatisfaction formula:
  // onTime=4500, late=500, missed=0 -> arrival = 4750/5000 = 0.95
  // exitP95Min=30 -> exit = 1.0
  // avgQueueMin=5 -> queue = 1.0
  // viewing=0.9 -> viewing = 0.9
  // total = 100 * (0.4*0.95 + 0.2*1 + 0.2*1 + 0.2*0.9) = 96
  const dayFacts = {
    onTime: 4500,
    late: 500,
    missed: 0,
    exitP95Min: 30,
    avgQueueMin: 5,
    viewing: 0.9,
  };
  assert.equal(computeTournamentDaySatisfaction(dayFacts), 96);

  const surgeRes = stepMacroTownCatalyst(session, {
    tick: 300,
    tournamentTier: 3,
    reputation: 65,
    dayFacts,
    courseFacts: { holes: 18, lengthM: 6200, builtNeedsCount: 14 },
  });

  assert.equal(surgeRes.daySatisfactionScore, 96);
  // reputationAfter(65, 96) = 65 + 0.3 * 31 = 74.3
  assert.equal(surgeRes.nextReputation, 74.3);
  assert.ok(surgeRes.townFourFloats.Pxd > 0.85);
  assert.ok(surgeRes.townFourFloats.Aq > 0.9);

  const nightRes = runPopulationNightDream(surgeRes.session, 600);
  assert.equal(nightRes.sitRep.schema, 'hm2:morning-sitrep:v1');
  assert.equal(nightRes.sitRep.bounty.readinessBoost, 0.05);
  assert.ok(nightRes.sitRep.ghostReplayShareCode.startsWith('clip:'));
  assert.ok(nightRes.townCoherenceH > 0.85);
});

