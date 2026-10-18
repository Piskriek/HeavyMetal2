import { ch1ColdBoot } from '../ch/ch1-cold-boot';
import { ch2OneBitFacets } from '../ch/ch2-one-bit-facets';
import { ch3ChorusBloom } from '../ch/ch3-chorus-bloom';
import { ch4ArchiveRifts } from '../ch/ch4-archive-rifts';
import { ch5WindowHeal } from '../ch/ch5-window-heal';
import { ch6SuitcamFinale } from '../ch/ch6-suitcam-finale';
import { ch7OutroLoop } from '../ch/ch7-outro-loop';
// ============================================================================
// File: apps/web/src/credits/__tests__/timeline.test.ts
// Unit tests for TICKET-14 (Brief 33: 144 BPM Credits Video Timeline,
// 2:40.73 switch, levels.json loop, Monitor Equaliser, and the POL-41 pixel font).
// Imports ONLY modules in ticket14-context.json / this bundle.
// ============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CREDITS_BPM,
  CREDITS_CHAPTERS,
  CREDITS_LYRIC_CUES,
  DEFAULT_OUTRO_META,
  VOCAL_LINE_END_SEC,
  VOCAL_SWITCH_SEC,
  buildCreditsRollManifest,
  getCreditsStateAt,
  parseOutroMeta,
} from '../timeline';
import {
  MONITOR_EQ_COLOURS,
  OLD_MONITOR_ACTIONS,
  monitorEqualizerHeights,
} from '../monitor-jukebox';

test('locks tempo to 144 BPM and switches after "See you, Sector Four" (2:40.2) at 2:40.73 (160.73 s)', () => {
  assert.equal(CREDITS_BPM, 144);
  assert.equal(DEFAULT_OUTRO_META.bpm, 144);
  assert.equal(VOCAL_LINE_END_SEC, 160.20);
  assert.equal(VOCAL_SWITCH_SEC, 160.73);
  assert.equal(DEFAULT_OUTRO_META.outroStart, 160.73);
  assert.ok(DEFAULT_OUTRO_META.loopEnd > DEFAULT_OUTRO_META.loopStart);
});

test('covers 0.0s to 160.73s with 6 contiguous vocal chapters and loops on ch7 within levels.json start..end', () => {
  assert.equal(CREDITS_CHAPTERS.length, 7);
  assert.equal(CREDITS_CHAPTERS[0]!.tStart, 0);
  for (let i = 0; i < 6; i++) {
    assert.ok(
      Math.abs(CREDITS_CHAPTERS[i]!.tEnd - CREDITS_CHAPTERS[i + 1]!.tStart) < 1e-6,
      `chapter ${i + 1} tEnd (${CREDITS_CHAPTERS[i]!.tEnd}) must match chapter ${i + 2} tStart (${CREDITS_CHAPTERS[i + 1]!.tStart})`,
    );
  }
  assert.equal(CREDITS_CHAPTERS[5]!.tEnd, 160.73);

  const ch7 = getCreditsStateAt(DEFAULT_OUTRO_META.outroStart + 19.5, DEFAULT_OUTRO_META);
  assert.equal(ch7.chapter.id, 'ch7-outro-loop');
  assert.equal(ch7.isLoopingOutro, true);
  assert.ok(ch7.loopedAudioTime >= DEFAULT_OUTRO_META.loopStart);
  assert.ok(ch7.loopedAudioTime < DEFAULT_OUTRO_META.loopEnd);

  // Also parses levels.json structure directly
  const parsed = parseOutroMeta({
    levels: {
      'music-ending-loop': { gain: 0, start: 13.328957, end: 26.657914 },
    },
  });
  assert.equal(parsed.loopStart, 13.328957);
  assert.equal(parsed.loopEnd, 26.657914);
});

test('walks all 6 progressive HUD skins (0a -> 0b -> 1 -> 2 -> 3 -> 4-6)', () => {
  const skins = CREDITS_CHAPTERS.map((c) => c.hudSkin);
  assert.deepEqual(skins, ['0a', '0b', '1', '2', '3', '4-6', '4-6']);
});

test('includes v4b lyric line "you pulled it right in front of me" and ends vocals on "See you, Sector Four" at 160.2s', () => {
  const hasV4bLine = CREDITS_LYRIC_CUES.some((cue) =>
    cue.line.toLowerCase().includes('you pulled it right in front of me'),
  );
  assert.equal(hasV4bLine, true);

  const sectorFourCue = CREDITS_LYRIC_CUES.find((cue) =>
    cue.line.includes('See you, Sector Four'),
  );
  assert.ok(sectorFourCue, 'has "See you, Sector Four" cue');
  assert.equal(sectorFourCue!.tEnd, 160.20);
});

test('enforces real-size rifle, armoured suit, and real lunar sky in shot descriptions', () => {
  const allText = JSON.stringify(CREDITS_CHAPTERS).toLowerCase();
  assert.ok(allText.includes('armoured'));
  assert.equal(allText.includes('hazmat'), false);
  assert.equal(allText.includes('goblin planet'), false);
  assert.equal(allText.includes('1.65x'), false);
});

test('credits Francois, Argo, Opus, Haiku, Arena.ai, Flash, Meshy.ai, Blender 5.2, and legal packs', () => {
  const text = JSON.stringify(buildCreditsRollManifest('Pilot Test'));
  for (const required of [
    'Francois',
    'Gemini Argo',
    'Claude Opus',
    'Claude Haiku',
    'Arena.ai',
    'Gemini Flash',
    'Pilot Test',
    'Meshy.ai',
    'Blender 5.2',
    'Hunyuan3D',
    'RUN.world',
    'Freedoom',
    'Blasphemer',
    'LibreQuake',
    'Quaternius',
    'Oxanium',
    'Inter',
    'PIXEL TYPEFACE',
  ]) {
    assert.ok(text.includes(required), `missing required credit: ${required}`);
  }
});

test('Lab old-monitor equaliser has four bars in the four metric colours', () => {
  assert.deepEqual(MONITOR_EQ_COLOURS, ['#ff3d8a', '#7cff4d', '#ffc13d', '#3dc8ff']);
  assert.equal(OLD_MONITOR_ACTIONS.length, 2);
  const bars = monitorEqualizerHeights(1.25);
  assert.equal(bars.length, 4);
  for (const h of bars) {
    assert.ok(h >= 0.12 && h <= 1.0);
  }
});


test('drives all 7 chapter modules (ch1..ch7) against PlayScene and LabRoom targets', () => {
  const drivers = [
    ch1ColdBoot,
    ch2OneBitFacets,
    ch3ChorusBloom,
    ch4ArchiveRifts,
    ch5WindowHeal,
    ch6SuitcamFinale,
    ch7OutroLoop,
  ];
  let stage = -1;
  let cameraView: 'first' | 'third' = 'first';
  let stormProgress = -1;
  let windowView: 'static' | 'lite' | 'full' = 'static';
  let altCamCalls = 0;

  const mockScene = {
    setFidelityStage: (s: number) => { stage = s; },
    raiseStage: (s: number) => { stage = s; },
    setLabActivity: () => {},
    setBeamHeld: () => {},
    setBeamFiring: () => {},
    setBeamSealing: () => {},
    setCameraView: (v: 'first' | 'third') => { cameraView = v; },
    debug: {
      teleport: () => {},
      setAltCam: () => { altCamCalls++; },
      clearAltCam: () => {},
      setWake: () => {},
      setWindowView: (v: 'static' | 'lite' | 'full') => { windowView = v; },
      setWaterVisible: () => {},
      setCoverageActive: () => {},
    },
    room: {
      setStorm: (p: number) => { stormProgress = p; },
      setWindowView: (v: 'static' | 'lite' | 'full') => { windowView = v; },
    },
  };

  const sampleTimes = [5.0, 30.0, 60.0, 85.0, 124.0, 150.0, 165.0];
  for (let i = 0; i < drivers.length; i++) {
    const drv = drivers[i]!;
    const state = getCreditsStateAt(sampleTimes[i]!, DEFAULT_OUTRO_META);
    assert.equal(state.chapter.id, drv.id);
    const shotKf = drv.keyframes[state.activeShot.id];
    assert.ok(shotKf, `Missing keyframe for ${state.activeShot.id} in ${drv.id}`);
    drv.apply(mockScene, state, shotKf.start.pos, shotKf.start.lookAt);
    if (drv.id === 'ch6-suitcam-finale') {
      assert.equal(cameraView, 'third');
    }
  }

  assert.equal(stage, 6);
  assert.equal(cameraView, 'third');
  assert.equal(windowView, 'full');
  assert.equal(stormProgress, 1);
  assert.equal(altCamCalls, 7);
});
