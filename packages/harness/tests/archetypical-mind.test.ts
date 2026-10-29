import test from 'node:test';
import assert from 'node:assert/strict';
import { checkMem } from '@hm/shorthand';
import {
  SEVEN_STATION_ROLES,
  createPresetMemory,
  evaluateSevenStationCycle,
  getComplexStation,
  invokeArchetype,
  invokeArchetypeStation,
  resolveArchetypeStation,
} from '../src/index.js';

test('Plan 58 W3 (Track 3): SEVEN_STATION_ROLES, getComplexStation, and evaluateSevenStationCycle formalize Ra 7-station blueprint and Session 87.28 cross-wiring', () => {
  assert.equal(SEVEN_STATION_ROLES.length, 7);
  assert.equal(getComplexStation('mind', 1).tarotName, 'The Magician');
  assert.equal(getComplexStation('mind', 2).tarotName, 'The High Priestess');
  assert.equal(getComplexStation('body', 1).tarotName, 'Balanced Working');
  assert.equal(getComplexStation('body', 2).tarotName, 'The Hermit (Wisdom)');
  assert.equal(getComplexStation('choice', 1).tarotName, 'The Fool');
  assert.equal(resolveArchetypeStation('virgin-mind').number, 1);
  assert.equal(resolveArchetypeStation('faith').number, 22);

  const base = createPresetMemory('brain:d0e0');
  const masc = checkMem({ ...base, pol: 64 });
  const mascEval = evaluateSevenStationCycle(masc);
  assert.equal(mascEval.crossWiring.pole, 'intent');
  assert.equal(mascEval.crossWiring.mindLead.tarotName, 'The Magician');
  assert.equal(mascEval.crossWiring.bodyLead.tarotName, 'The Hermit (Wisdom)');

  const fem = checkMem({ ...base, pol: -64 });
  const femEval = evaluateSevenStationCycle(fem);
  assert.equal(femEval.crossWiring.pole, 'context');
  assert.equal(femEval.crossWiring.mindLead.tarotName, 'The High Priestess');
  assert.equal(femEval.crossWiring.bodyLead.tarotName, 'Balanced Working');
});

test('Plan 58 W3 (Track 3): Session 91.35 invokeArchetype("virgin-mind" | "faith") clears Blue/Indigo over-activation when open cause links clutter the mind', () => {
  const base = createPresetMemory('brain:d0e0');
  const cluttered = checkMem({
    ...base,
    hard: 0.8,
    bal: 0.42,
    charge: [0, 0, 12, 0, -48, 36, 0], // Ray 5 Throat starved (-48), Ray 6 Brow blocked (+36)
    cause: [
      { by: 'solar-control', d: 'throat-actualization', n: 3, open: true },
      { by: 'solar-anxiety', d: 'thirdeye-illumination', n: 2, open: true },
    ],
  });

  const cycleBefore = evaluateSevenStationCycle(cluttered);
  assert.equal(cycleBefore.blueIndigoOveractivated, true);
  assert.equal(cycleBefore.recommendedInvocation, 'virgin-mind');

  const res = invokeArchetype(cluttered, 'virgin-mind');
  assert.equal(res.clearedOverload, true);
  assert.equal(res.invoked.tarotName, 'The Magician');
  assert.ok(Math.abs(res.mem.charge[4]!) < Math.abs(cluttered.charge[4]!));
  assert.ok(Math.abs(res.mem.charge[5]!) < Math.abs(cluttered.charge[5]!));
  assert.ok(res.mem.bal > cluttered.bal);

  const faithRes = invokeArchetypeStation('faith', cluttered);
  assert.equal(faithRes.clearedOverload, true);
  assert.equal(faithRes.invoked.tarotName, 'The Fool');
});
