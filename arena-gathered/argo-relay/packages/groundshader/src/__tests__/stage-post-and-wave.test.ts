// ============================================================================
// File: packages/groundshader/src/__tests__/stage-post-and-wave.test.ts
// Briefs: Brief 27, Brief 30 & Plan 25 Unit Tests
// ============================================================================

import { describe, expect, it } from 'vitest';
import { computeStagePostUniforms } from '../stage-post.glsl';
import {
  createRadialScanWaveState,
  getStageGovernorProfile,
  stepRadialScanWave,
  triggerRadialScanWave,
} from '../radial-scan-wave';

describe('Stage Post-Shader & Progressive HUD Skin Uniforms (Brief 27 & Plan 25/28)', () => {
  it('starts in Stage 0a Hidden-Line Wireframe before the first machine ticks on the Moon', () => {
    const u0a = computeStagePostUniforms({ Pxd: 0.01, Vtx: 0.01, Lx: 0.05, Aq: 0 }, false);
    expect(u0a.uStageMode).toBe(0);
    expect(u0a.uWireframeMix).toBe(1.0);
    expect(u0a.hudSkin).toBe('0a');
  });

  it('transitions to Stage 0b 1-Bit Flat-Faceted Dither as soon as the first machine ticks', () => {
    const u0b = computeStagePostUniforms({ Pxd: 0.05, Vtx: 0.05, Lx: 0.08, Aq: 0 }, true);
    expect(u0b.uStageMode).toBe(1);
    expect(u0b.uDitherMix).toBe(1.0);
    expect(u0b.hudSkin).toBe('0b');
  });

  it('steps through EGA (1), VGA (2), Gouraud (3), and Suit-Cam PBR (4-6) as floats rise', () => {
    const ega = computeStagePostUniforms({ Pxd: 0.25, Vtx: 0.25, Lx: 0.20, Aq: 0 }, true);
    expect(ega.hudSkin).toBe('1');

    const vga = computeStagePostUniforms({ Pxd: 0.50, Vtx: 0.50, Lx: 0.40, Aq: 0.1 }, true);
    expect(vga.hudSkin).toBe('2');

    const gouraud = computeStagePostUniforms({ Pxd: 0.70, Vtx: 0.70, Lx: 0.70, Aq: 0.2 }, true);
    expect(gouraud.hudSkin).toBe('3');

    const suitCam6 = computeStagePostUniforms({ Pxd: 0.90, Vtx: 0.90, Lx: 0.90, Aq: 0.90 }, true);
    expect(suitCam6.hudSkin).toBe('4-6');
    expect(suitCam6.uSuitCamMix).toBe(1.0);
  });
});

describe('Radial Volumetric Scan-Wave & POL-04 Low-Spec 60 FPS Governor (Brief 30)', () => {
  it('expands the radial scan-wave from 0m to 450m over 4.5s and then deactivates', () => {
    const wave = createRadialScanWaveState();
    triggerRadialScanWave(wave, 10.0, 5, -8, 0, 1, 0xff3d8a);
    expect(wave.isActive).toBe(true);

    stepRadialScanWave(wave, 12.25); // Midpoint
    expect(wave.currentRadiusM).toBeGreaterThan(200);
    expect(wave.currentRadiusM).toBeLessThan(450);

    stepRadialScanWave(wave, 14.6); // Past 4.5s
    expect(wave.isActive).toBe(false);
    expect(wave.currentRadiusM).toBeCloseTo(450, 1);
  });

  it('caps distant ground noise octaves at 2 and disables neighbor dome shadows on Low (POL-04)', () => {
    const low = getStageGovernorProfile('low');
    const high = getStageGovernorProfile('high');
    expect(low.maxGroundNoiseOctavesFar).toBe(2);
    expect(low.renderNeighborDomeShadows).toBe(false);
    expect(low.enablePlumePointLights).toBe(false);
    expect(high.enablePlumePointLights).toBe(true);
  });
});
