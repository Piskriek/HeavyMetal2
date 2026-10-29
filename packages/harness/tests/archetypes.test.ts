import assert from 'node:assert/strict';
import test from 'node:test';
import type { Mem } from '@hm/shorthand';
import {
  ARCHETYPE_BLUEPRINT,
  activeArchetypeStation,
  bodyStep,
  createPresetMemory,
  crossWiredPolarity,
  dream,
  invokeArchetype,
  recordExperience,
} from '../src/index.js';

test('ARCHETYPE_BLUEPRINT defines all 22 stations (3 complexes × 7 stations + The Choice)', () => {
  assert.equal(ARCHETYPE_BLUEPRINT.length, 22);
  const mind = ARCHETYPE_BLUEPRINT.filter((a) => a.complex === 'mind');
  const body = ARCHETYPE_BLUEPRINT.filter((a) => a.complex === 'body');
  const spirit = ARCHETYPE_BLUEPRINT.filter((a) => a.complex === 'spirit');
  const choice = ARCHETYPE_BLUEPRINT.filter((a) => a.complex === 'choice');
  assert.equal(mind.length, 7);
  assert.equal(body.length, 7);
  assert.equal(spirit.length, 7);
  assert.equal(choice.length, 1);
  assert.equal(choice[0]?.number, 22);
  assert.equal(choice[0]?.tarotName, 'The Fool');
});

test('crossWiredPolarity maps Mind Matrix/Potentiator opposite to Body Matrix/Potentiator (Session 87.28)', () => {
  const intentMem: Mem = { ...createPresetMemory('kit:ab12cd34'), pol: 96, bal: 0.5, charge: [64, 0, 0, 0, 0, 0, 0] };
  const contextMem: Mem = { ...createPresetMemory('lx:ef56ab78'), pol: -96, bal: 0.5, charge: [0, 64, 0, 0, 0, 0, 0] };

  const intentCross = crossWiredPolarity(intentMem);
  assert.equal(intentCross.pole, 'intent');
  assert.equal(intentCross.mindLead.number, 1); // I. The Magician (Matrix of Mind)
  assert.equal(intentCross.mindComplement.number, 2); // II. The High Priestess (Potentiator of Mind)
  assert.equal(intentCross.bodyLead.number, 9); // IX. The Hermit (Potentiator of Body)
  assert.equal(intentCross.bodyComplement.number, 8); // VIII. Balanced Working (Matrix of Body)
  assert.ok(intentCross.logicControlBias > intentCross.excitementFlowBias);
  assert.equal(intentCross.integrated, false);

  const contextCross = crossWiredPolarity(contextMem);
  assert.equal(contextCross.pole, 'context');
  assert.equal(contextCross.mindLead.number, 2); // II. The High Priestess (Potentiator of Mind)
  assert.equal(contextCross.mindComplement.number, 1); // I. The Magician (Matrix of Mind)
  assert.equal(contextCross.bodyLead.number, 8); // VIII. Balanced Working (Matrix of Body)
  assert.equal(contextCross.bodyComplement.number, 9); // IX. The Hermit (Potentiator of Body)
  assert.ok(contextCross.excitementFlowBias > contextCross.logicControlBias);
  assert.equal(contextCross.integrated, false);

  // Once balanced (bal >= 0.9), the extreme veiled skew narrows while preserving native polarity
  const integratedIntent = crossWiredPolarity({ ...intentMem, bal: 1, charge: [0, 0, 0, 0, 0, 0, 0] });
  assert.equal(integratedIntent.integrated, true);
  assert.ok(
    Math.abs(integratedIntent.logicControlBias - integratedIntent.excitementFlowBias) <
      Math.abs(intentCross.logicControlBias - intentCross.excitementFlowBias),
  );
});

test('activeArchetypeStation progresses across the 7 stations from Matrix/Potentiator to Great Way with closed links intact', () => {
  let mem: Mem = { ...createPresetMemory('kit:11223344'), pol: 80 };
  // 1. Fresh intent preset starts at Station 1 (Matrix of Mind: The Magician)
  assert.equal(activeArchetypeStation(mem).station, 'matrix');
  // Fresh context preset starts at Station 2 (Potentiator of Mind: The High Priestess)
  assert.equal(activeArchetypeStation({ ...mem, pol: -80 }).station, 'potentiator');

  // 3. Light initial catalyst -> Station 3 (Catalyst: The Empress)
  mem = recordExperience(mem, { t: 1, stage: 'S3', cat: 'touch', excitement: 0.2, error: 0.1, by: 'aligned' });
  assert.equal(activeArchetypeStation(mem).station, 'catalyst');

  // 4. Hardened aligned experiences -> Station 4 (Experience: The Emperor)
  for (let t = 2; t <= 6; t++) {
    mem = recordExperience(mem, { t, stage: 'S3', cat: 'build', excitement: 0.9, error: 0.1, by: 'aligned' });
  }
  assert.equal(activeArchetypeStation(mem).station, 'experience');

  // 5. Distorted episode charges ray 3 -> Station 5 (Significator: The Hierophant)
  mem = recordExperience(mem, {
    t: 7,
    stage: 'S3',
    cat: 'clamp',
    excitement: 0.9,
    error: 0.7,
    by: 'solar-control',
    felt: 'solar-control',
    src: 'logic:11223344',
  });
  assert.equal(activeArchetypeStation(mem).station, 'significator');

  // 6. Cued dream repairs the distortion and closes the cause link -> Station 6 (Transformation: The Lovers)
  let ego = createPresetMemory('logic:55667788');
  for (let d = 0; d < 4; d++) {
    const res = dream({
      ego,
      presets: [{ ...mem, inv: 0.9 }],
      weights: { prefer: {} },
      now: 10 + d,
      cues: [{ of: mem.of, t: 7 }],
    });
    ego = res.ego;
    mem = res.presets[0]!;
  }
  assert.equal(mem.cause.some((c) => !c.open), true);
  assert.equal(activeArchetypeStation(mem).station, 'transformation');

  // 7. Reaching >= 8 lived episodes with all 7 rays clear (kundalini === 7) and closed links intact -> Station 7 (Great Way: The Chariot)
  mem = recordExperience(mem, { t: 20, stage: 'S3', cat: 'orbit', excitement: 0.8, error: 0.05, by: 'aligned' });
  assert.equal(activeArchetypeStation(mem).station, 'great-way');
});

test('invokeArchetype (Session 91.35 Virgin Mind) softens cognitive loops within RELEASE_RATE (itch, never sharp pain)', () => {
  let mem = createPresetMemory('logic:99aabbcc');
  // Stack two heavy cognitive distortions on Ray 5 so charge > 48 (exceeding 2x RELEASE_RATE)
  for (let t = 1; t <= 2; t++) {
    mem = recordExperience(mem, {
      t,
      stage: 'S3',
      cat: 'talk',
      excitement: 1.0,
      error: 0.85,
      by: 'solar-control',
      felt: 'throat-actualization',
      src: 'logic:99aabbcc',
    });
  }
  mem = recordExperience(mem, {
    t: 3,
    stage: 'S3',
    cat: 'plan',
    excitement: 0.95,
    error: 0.8,
    by: 'solar-anxiety',
    felt: 'thirdeye-illumination',
    src: 'logic:99aabbcc',
  });

  const step1 = bodyStep({ kind: 'mechanical', mem, prev: null, sideOf: () => 'right' });
  const beforeHard = step1.mem.hard;
  const beforeEpCount = step1.mem.ep.length;

  const res = invokeArchetype(step1.mem, 1, step1.body);
  assert.equal(res.clearedOverload, true);
  assert.equal(res.invoked.tarotName, 'The Magician');
  assert.ok(res.mem.hard < beforeHard);
  assert.equal(res.mem.ep.length, beforeEpCount);
  assert.ok(res.mem.cause.every((c) => c.open));

  // Verify the subsequent bodyStep registers 'itch' (gradual release <= RELEASE_RATE), never 'pain' or rebound
  const step2 = bodyStep({ kind: 'mechanical', mem: res.mem, prev: res.body, sideOf: () => 'right' });
  assert.equal(step2.body.zones.some((z) => z.signal === 'pain'), false);
  assert.equal(step2.body.zones.some((z) => z.signal === 'itch'), true);
  assert.ok(step2.body.zones.every((z) => z.rebound === 0));
});
