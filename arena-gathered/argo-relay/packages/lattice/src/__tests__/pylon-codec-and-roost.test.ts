// ============================================================================
// File: packages/lattice/src/__tests__/pylon-codec-and-roost.test.ts
// Plans: P2-LOOP-06, P2-STUDIO-06 & P2-VFX-05 Unit Tests
// ============================================================================

import { describe, expect, it } from 'vitest';
import {
  evaluateTravelingPulseBead,
  sampleCatenaryPoint,
  type CatenarySpan,
} from '../pylon-pulse-beads';
import {
  decodeSmxBundle,
  encodeSmxBundle,
  type SmxCartridgeBundle,
} from '../../../presetcodec/src/smx-cartridge-card';
import {
  evaluateRoostBurst,
  getGlobalParticlePoolCap,
} from '../../../particles/src/stage-roost-and-footsteps';

const SPAN: CatenarySpan = {
  id: 'span-1',
  startX: 0,
  startY: 3.0,
  startZ: 0,
  endX: 10,
  endY: 3.0,
  endZ: 0,
  sagMeters: 0.8,
};

describe('Relay Pylon Catenary Pulse Beads (P2-LOOP-06)', () => {
  it('dips by sagMeters at the midpoint (t = 0.5) and slows during brownout', () => {
    const mid = sampleCatenaryPoint(SPAN, 0.5);
    expect(mid.x).toBe(5);
    expect(mid.y).toBeCloseTo(2.2, 3);

    const fullBead = evaluateTravelingPulseBead(SPAN, 0.5, 1.0, 'Pxd');
    const brownoutBead = evaluateTravelingPulseBead(SPAN, 0.5, 0.3, 'Pxd');
    expect(fullBead!.progress0to1).toBeGreaterThan(brownoutBead!.progress0to1);
    expect(fullBead!.colorHex).toBe(0xff3d8a);
  });
});

describe('.smx Cartridge Bundle Codec (P2-STUDIO-06)', () => {
  it('round-trips a custom cartridge and socket overrides under 4 KB', () => {
    const bundle: SmxCartridgeBundle = {
      version: 1,
      id: 'emerald-turf-v1',
      title: 'Emerald Crater Turf',
      author: 'Francois',
      dominantMetric: 'Pxd',
      macroSliders: {
        primaryHueDeg: 135,
        grainScale: 0.4,
        weatheringMoss: 0.8,
        roughness: 0.55,
        bumpDepth: 0.6,
      },
    };
    const bytes = encodeSmxBundle(bundle);
    expect(bytes.byteLength).toBeLessThan(4096);
    const decoded = decodeSmxBundle(bytes);
    expect(decoded.title).toBe('Emerald Crater Turf');
    expect(decoded.macroSliders.weatheringMoss).toBe(0.8);
  });
});

describe('Stage-Reactive Footstep & Rover Tire Roost (P2-VFX-05)', () => {
  it('adapts roost style from 1-bit pixels (S0) to hydro splash (S3) to meadow flecks (S6)', () => {
    expect(getGlobalParticlePoolCap('low')).toBe(2048);
    expect(getGlobalParticlePoolCap('high')).toBe(8192);

    const s0 = evaluateRoostBurst({ Pxd: 0.05, Vtx: 0.05, Lx: 0.05, Aq: 0 }, false, 12, true);
    expect(s0.style).toBe('stage0-1bit-pixels');

    const splash = evaluateRoostBurst({ Pxd: 0.6, Vtx: 0.6, Lx: 0.6, Aq: 0.5 }, true, 12, true);
    expect(splash.style).toBe('stage3-hydro-splash');
    expect(splash.primaryHex).toBe(0x3dc8ff);

    const meadow = evaluateRoostBurst({ Pxd: 0.9, Vtx: 0.9, Lx: 0.9, Aq: 0.9 }, false, 12, true);
    expect(meadow.style).toBe('stage46-meadow-flecks');
  });
});
