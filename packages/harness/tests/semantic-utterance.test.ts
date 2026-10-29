import test from 'node:test';
import assert from 'node:assert/strict';
import { checkMem } from '@hm/shorthand';
import {
  LOCALE_SHELF,
  SEMANTIC_ROOT_CATALOG,
  createPresetMemory,
  decodeUtteranceCode,
  deriveEmotionalEnvelope,
  synthesizeUtterance,
  type LocaleId,
  type SemanticRootId,
} from '../src/index.js';

test('Plan 58 §18.1: SEMANTIC_ROOT_CATALOG and LOCALE_SHELF cover all 9 roots across en, af, and ja with non-empty spoken, subtitle, and backchannel strings', () => {
  const roots = Object.keys(SEMANTIC_ROOT_CATALOG) as SemanticRootId[];
  const locales = Object.keys(LOCALE_SHELF) as LocaleId[];
  assert.equal(roots.length, 9);
  assert.deepEqual(locales, ['en', 'af', 'ja']);

  for (const rootId of roots) {
    for (const locale of locales) {
      const utt = synthesizeUtterance({
        rootId,
        locale,
        slots: {
          subject: 'Drone Fire',
          rank: 'Stage 4',
          skill: 'Steady Fire',
          item: 'Thermal Thruster',
          zone: 'right pod',
          quality: 'Presence',
          world: 'Moon Outpost',
          quest: 'Alloy Equilibrium',
          calm: '30%',
        },
      });
      assert.equal(utt.rootId, rootId);
      assert.equal(utt.locale, locale);
      assert.ok(utt.spokenText.length > 10);
      assert.ok(utt.subtitleText.length > 8);
      assert.ok(utt.backchannelText.length > 4);
      assert.ok(utt.webAudioProsody.baseFreqHz > 100 && utt.webAudioProsody.baseFreqHz < 500);
    }
  }
});

test('Plan 58 §18.2: deriveEmotionalEnvelope maps Mem charge, starved Throat Ray, excitement, and Ra cross-wired polarity into prosodic parameters', () => {
  const base = createPresetMemory('brain:d0e0');

  // 1. Masculine (intent, pol >= 32) -> Magician (Mind) + Hermit (Body)
  const mascMem = checkMem({
    ...base,
    pol: 64,
    bal: 0.95,
    charge: [0, 0, 0, 0, 0, 0, 0],
  });
  const mascEnv = deriveEmotionalEnvelope({ intent: 'celebrate', mem: mascMem, excitementOverride: 0.85 });
  assert.equal(mascEnv.polarity, 'masculine');
  assert.equal(mascEnv.mindArchetype, 'The Magician');
  assert.equal(mascEnv.bodyArchetype, 'The Hermit (Wisdom)');
  assert.equal(mascEnv.breathCue, 'laugh');
  assert.equal(mascEnv.timbreFilter, 'resonant-eureka');

  // 2. Feminine (context, pol <= -32) -> High Priestess (Mind) + Balanced Working (Body)
  const femMem = checkMem({
    ...base,
    pol: -64,
    bal: 0.95,
    charge: [0, 0, 0, 0, 0, 0, 0],
  });
  const femEnv = deriveEmotionalEnvelope({ intent: 'comfort', mem: femMem, excitementOverride: 0.5 });
  assert.equal(femEnv.polarity, 'feminine');
  assert.equal(femEnv.mindArchetype, 'The High Priestess');
  assert.equal(femEnv.bodyArchetype, 'Balanced Working');
  assert.equal(femEnv.breathCue, 'sigh');
  assert.equal(femEnv.timbreFilter, 'warm-anchor');
  assert.ok(femEnv.pitchShiftSemitones > mascEnv.pitchShiftSemitones - 2);
  assert.ok(mascEnv.tempoScale > femEnv.tempoScale);

  // 3. Starved Ray 5 (Throat Ray <= -24) -> timbreFilter === 'starved-throat'
  const starvedMem = checkMem({
    ...base,
    pol: 0,
    bal: 0.55,
    charge: [0, 0, 0, 0, -48, 0, 0],
  });
  const starvedEnv = deriveEmotionalEnvelope({ intent: 'warn', mem: starvedMem, excitementOverride: 0.8 });
  assert.equal(starvedEnv.starvedRay, 5);
  assert.equal(starvedEnv.timbreFilter, 'starved-throat');
  assert.equal(starvedEnv.breathCue, 'gasp');
});

test('Plan 58 §18.3: utt: share codes round-trip cleanly and support cross-locale re-inflection without losing intent or polarity', () => {
  const enUtt = synthesizeUtterance({
    rootId: 'BODY_EUREKA',
    locale: 'en',
    slots: { quality: 'Sovereign Faith' },
    excitementOverride: 0.9,
    polarityOverride: 'feminine',
  });
  assert.match(enUtt.code, /^utt:/);
  assert.match(enUtt.spokenText, /Field resonating:/);
  assert.match(enUtt.spokenText, /Sovereign Faith/);

  const decodedEn = decodeUtteranceCode(enUtt.code)!;
  assert.ok(decodedEn);
  assert.equal(decodedEn.spokenText, enUtt.spokenText);
  assert.equal(decodedEn.envelope.polarity, 'feminine');

  // Re-inflect the exact same semantic-emotional utterance code into Afrikaans and Japanese
  const decodedAf = decodeUtteranceCode(enUtt.code, 'af')!;
  assert.ok(decodedAf);
  assert.equal(decodedAf.locale, 'af');
  assert.match(decodedAf.spokenText, /Veld in resonansie:/);
  assert.match(decodedAf.spokenText, /Sovereign Faith is herstel!/);

  const decodedJa = decodeUtteranceCode(enUtt.code, 'ja')!;
  assert.ok(decodedJa);
  assert.equal(decodedJa.locale, 'ja');
  assert.match(decodedJa.spokenText, /《共鳴展開》/);
  assert.match(decodedJa.spokenText, /《Sovereign Faith》が回復しました！/);

  assert.equal(decodeUtteranceCode('utt:corrupted!!!'), null);
});
