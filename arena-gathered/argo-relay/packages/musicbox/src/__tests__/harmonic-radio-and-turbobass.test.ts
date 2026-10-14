// ============================================================================
// File: packages/musicbox/src/__tests__/harmonic-radio-and-turbobass.test.ts
// Purpose: Vitest unit suite for Harmonic Machine Choir, 85.2 MHz Radio & Turbo Bass
// ============================================================================

import { describe, expect, it } from 'vitest';
import {
  evaluateHarmonicMachineChoir,
  type ActiveMachineEmitter,
} from '../harmonic-machine-choir';
import { resolveRadioArrangementStyle } from '../../../content/src/diegetic-radio-and-tapes';
import {
  applyTurboBassSwarmerKnockback,
  evaluateBeatSyncedPlumeModulation,
} from '../../../tooljuice/src/beat-synced-plume-and-turbobass';

describe('Outer Wilds-Style 4-Machine Harmonic Convergence Choir', () => {
  it('locks Harmonic Convergence when all 4 field machine types run within 35m', () => {
    const machines: ActiveMachineEmitter[] = [
      { id: 'm1', stemRole: 'shape-press-bass', x: 5, y: 0, z: 0, isRunning: true, efficiency0to1: 1 },
      { id: 'm2', stemRole: 'texture-mill-arp', x: -5, y: 0, z: 0, isRunning: true, efficiency0to1: 1 },
      { id: 'm3', stemRole: 'light-projector-pad', x: 0, y: 0, z: 6, isRunning: true, efficiency0to1: 1 },
      { id: 'm4', stemRole: 'water-maker-lead', x: 0, y: 0, z: -6, isRunning: true, efficiency0to1: 1 },
    ];

    const state = evaluateHarmonicMachineChoir(0.0, 0, 0, 0, machines);
    expect(state.activeStemCount).toBe(4);
    expect(state.isHarmonicConvergenceLocked).toBe(true);
    expect(state.downbeatPulse0to1).toBeCloseTo(1.0, 2);
  });
});

describe('Portal-Style 85.2 MHz Radio & Transmission Received Easter Egg', () => {
  it('upgrades song arrangement across stages and decodes Tape #04 at the Twin Gate', () => {
    const s0 = resolveRadioArrangementStyle(
      'tape-01-setmix-theme',
      { Pxd: 0.05, Vtx: 0.05, Lx: 0.05, Aq: 0 },
      false,
      false
    );
    expect(s0.arrangement).toBe('stage0-8bit-chiptune');

    const s2 = resolveRadioArrangementStyle(
      'tape-01-setmix-theme',
      { Pxd: 0.45, Vtx: 0.45, Lx: 0.45, Aq: 0.2 },
      false,
      false
    );
    expect(s2.arrangement).toBe('stage2-16bit-fm-synthwave');

    const secret = resolveRadioArrangementStyle(
      'tape-04-vance-sstv-signal',
      { Pxd: 0.2, Vtx: 0.2, Lx: 0.2, Aq: 0 },
      true,
      false
    );
    expect(secret.unlockedTransmissionAchievement).toBe(true);
    expect(secret.decodedMessage).toContain('TRANSMISSION RECEIVED');
  });
});

describe('112 BPM Beat-Synced Plume & [V] Turbo Bass Swarmer Knockback', () => {
  it('boosts plume scale on the downbeat and knocks swarmers back up to 4m', () => {
    const mod = evaluateBeatSyncedPlumeModulation(1.0, true);
    expect(mod.cubeScaleMultiplier).toBeCloseTo(1.35, 2);

    const knocked = applyTurboBassSwarmerKnockback(0, 0, 1.0, [
      { id: 'swarmer-1', x: 3.0, z: 0.0 },
    ]);
    expect(knocked[0].wasKnockedBack).toBe(true);
    expect(knocked[0].newX).toBeGreaterThan(5.5);
  });
});
