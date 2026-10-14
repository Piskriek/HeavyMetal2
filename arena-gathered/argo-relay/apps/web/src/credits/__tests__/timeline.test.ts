// ============================================================================
// File: apps/web/src/credits/__tests__/timeline.test.ts
// Brief: TASK-33 Unit Tests for 144 BPM Credits Video Timeline & Manifest
// ============================================================================

import { describe, expect, it } from 'vitest';
import {
  CREDITS_BPM,
  CREDITS_CHAPTERS,
  CREDITS_LYRIC_CUES,
  DEFAULT_OUTRO_META,
  buildCreditsRollManifest,
  getCreditsStateAt,
} from '../timeline';

describe('Credits Music Video Timeline ("Four Floats" v4b @ 144 BPM)', () => {
  it('locks tempo to 144 BPM (1.2x v4b)', () => {
    expect(CREDITS_BPM).toBe(144);
    expect(DEFAULT_OUTRO_META.bpm).toBe(144);
  });

  it('covers 0.0s to outroStart with 6 contiguous vocal chapters and loops on ch7', () => {
    expect(CREDITS_CHAPTERS).toHaveLength(7);
    for (let i = 0; i < 5; i++) {
      expect(CREDITS_CHAPTERS[i].tEnd).toBeCloseTo(CREDITS_CHAPTERS[i + 1].tStart, 2);
    }
    const ch7 = getCreditsStateAt(DEFAULT_OUTRO_META.outroStart + 19.5, DEFAULT_OUTRO_META);
    expect(ch7.chapter.id).toBe('ch7-outro-loop');
    expect(ch7.isLoopingOutro).toBe(true);
    expect(ch7.loopedAudioTime).toBeGreaterThanOrEqual(DEFAULT_OUTRO_META.loopStart);
    expect(ch7.loopedAudioTime).toBeLessThan(DEFAULT_OUTRO_META.loopEnd);
  });

  it('walks all 6 progressive HUD skins (0a -> 0b -> 1 -> 2 -> 3 -> 4-6)', () => {
    const skins = CREDITS_CHAPTERS.map((c) => c.hudSkin);
    expect(skins).toEqual(['0a', '0b', '1', '2', '3', '4-6', '4-6']);
  });

  it('includes the owner-approved v4b lyric line "you pulled it right in front of me"', () => {
    const hasV4bLine = CREDITS_LYRIC_CUES.some((cue) =>
      cue.line.toLowerCase().includes('you pulled it right in front of me')
    );
    expect(hasV4bLine).toBe(true);
  });

  it('enforces real-size rifle, armoured suit, and real lunar sky in shot descriptions', () => {
    const allText = JSON.stringify(CREDITS_CHAPTERS).toLowerCase();
    expect(allText).toContain('armoured');
    expect(allText).not.toContain('hazmat');
    expect(allText).not.toContain('goblin planet');
    expect(allText).not.toContain('1.65x');
  });

  it('credits Francois, Argo, Opus, Haiku, Arena.ai, Flash, Meshy.ai, Blender 5.2, and legal packs', () => {
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
      'Share Tech Mono',
    ]) {
      expect(text).toContain(required);
    }
  });
});
