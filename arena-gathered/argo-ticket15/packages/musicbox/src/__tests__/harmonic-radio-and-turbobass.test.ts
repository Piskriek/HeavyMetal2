// ============================================================================
// File: packages/musicbox/src/__tests__/harmonic-radio-and-turbobass.test.ts
// Purpose: node:test unit suite for Harmonic Machine Choir (144 BPM),
//          85.2 MHz Bridge FM Radio & Wreck Tapes (#01..#04), [V] Turbo Bass,
//          and T09a 5-Bus Routing
// ============================================================================

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  BEAT_DURATION_SEC,
  BASS_MIDI_BY_BAR,
  evaluateHarmonicMachineChoir,
  resolveChoirBus,
  SETMIX_SONG_BPM,
  SETMIX_SONG_KEY,
  type ActiveMachineEmitter,
} from '../harmonic-machine-choir';
import {
  COLLECTIBLE_MUSIC_TAPES,
  radioBusForContext,
  resolveRadioArrangementStyle,
  tapeForTransponder,
  tapeForWreckSite,
  WRECK_TAPE_BY_SITE,
} from '../../../content/src/diegetic-radio-and-tapes';
import {
  applyTurboBassSwarmerKnockback,
  beatPulse,
  evaluateBeatSyncedPlumeModulation,
  TURBO_BASS_BUS,
} from '../../../tooljuice/src/beat-synced-plume-and-turbobass';
import { BUS_START, busOfSound } from '../../../audiomix/src/index';

describe('Outer Wilds-Style 4-Machine Harmonic Convergence Choir (144 BPM)', () => {
  it('locks SETMIX_SONG_BPM to 144 in D Major and locks Harmonic Convergence when all 4 machine types run within 35m', () => {
    assert.equal(SETMIX_SONG_BPM, 144);
    assert.equal(SETMIX_SONG_KEY, 'D Major');
    assert.ok(Math.abs(BEAT_DURATION_SEC - 60 / 144) < 1e-6);
    assert.deepEqual(BASS_MIDI_BY_BAR, [38, 45, 47, 43]); // D2, A2, B2, G2

    const machines: ActiveMachineEmitter[] = [
      { id: 'm1', stemRole: 'shape-press-bass', x: 5, y: 0, z: 0, isRunning: true, efficiency0to1: 1 },
      { id: 'm2', stemRole: 'texture-mill-arp', x: -5, y: 0, z: 0, isRunning: true, efficiency0to1: 1 },
      { id: 'm3', stemRole: 'light-projector-pad', x: 0, y: 0, z: 6, isRunning: true, efficiency0to1: 1 },
      { id: 'm4', stemRole: 'water-maker-lead', x: 0, y: 0, z: -6, isRunning: true, efficiency0to1: 1 },
    ];

    const state = evaluateHarmonicMachineChoir(0.0, 0, 0, 0, machines);
    assert.equal(state.bpm, 144);
    assert.equal(state.activeStemCount, 4);
    assert.equal(state.isHarmonicConvergenceLocked, true);
    assert.equal(state.targetBus, 'music');
    assert.ok(Math.abs(state.downbeatPulse0to1 - 1.0) < 0.01);

    // Partial choir (< 4 stems) routes to 'world' so individual machines pass through the stage bit-depth mirror
    const partial = evaluateHarmonicMachineChoir(0.0, 0, 0, 0, machines.slice(0, 2));
    assert.equal(partial.isHarmonicConvergenceLocked, false);
    assert.equal(partial.targetBus, 'world');
  });
});

describe('Portal-Style 85.2 MHz Radio, Wreck Tapes (#01..#04) & Transmission Received Easter Egg', () => {
  it('upgrades song arrangement across stages and decodes Tape #04 at the Twin Gate', () => {
    const s0 = resolveRadioArrangementStyle(
      'tape-01-setmix-theme',
      { Pxd: 0.05, Vtx: 0.05, Lx: 0.05, Aq: 0 },
      false,
      false,
    );
    assert.equal(s0.arrangement, 'stage0-8bit-chiptune');
    assert.equal(s0.targetBus, 'music');

    const s2 = resolveRadioArrangementStyle(
      'tape-01-setmix-theme',
      { Pxd: 0.45, Vtx: 0.45, Lx: 0.45, Aq: 0.2 },
      false,
      false,
    );
    assert.equal(s2.arrangement, 'stage2-16bit-fm-synthwave');

    const secret = resolveRadioArrangementStyle(
      'tape-04-vance-sstv-signal',
      { Pxd: 0.2, Vtx: 0.2, Lx: 0.2, Aq: 0 },
      true,
      false,
    );
    assert.equal(secret.unlockedTransmissionAchievement, true);
    assert.ok(secret.decodedMessage?.includes('TRANSMISSION RECEIVED'));
    assert.ok(secret.decodedMessage?.includes('144 BPM'));
  });

  it('hangs all 4 collectible tapes (TAPE #01 to #04) on wreck sites 1..4 placed by T07a and TRIFT', () => {
    assert.equal(COLLECTIBLE_MUSIC_TAPES.length, 4);
    for (const siteIdx of [1, 2, 3, 4] as const) {
      const tape = tapeForWreckSite(siteIdx);
      assert.ok(tape, `Expected tape on wreck site ${siteIdx}`);
      assert.equal(tape.wreckSiteIndex, siteIdx);
      assert.equal(tape.bpm, 144);
      assert.equal(WRECK_TAPE_BY_SITE[siteIdx], tape.id);
      assert.equal(tapeForTransponder(tape.transponderId)?.id, tape.id);
    }
  });
});

describe('144 BPM Beat-Synced Plume & [V] Turbo Bass Swarmer Knockback', () => {
  it('boosts plume scale on the 144 BPM downbeat and knocks swarmers back up to 4m', () => {
    const p0 = beatPulse(0.0, 144);
    assert.equal(p0, 1.0);
    const mod = evaluateBeatSyncedPlumeModulation(p0, true);
    assert.ok(Math.abs(mod.cubeScaleMultiplier - 1.35) < 0.01);

    const knocked = applyTurboBassSwarmerKnockback(0, 0, 1.0, [
      { id: 'swarmer-1', x: 3.0, z: 0.0 },
    ]);
    assert.equal(knocked[0]?.wasKnockedBack, true);
    assert.ok((knocked[0]?.newX ?? 0) > 5.5);
  });
});

describe('T09a 5-Bus Routing & MENTOR_MIX Preservation', () => {
  it('routes choir and radio to music/world, Turbo Bass to combatUi, never voice, and keeps MENTOR_MIX untouched', () => {
    assert.equal(BUS_START.voice, 0.8);
    assert.equal(BUS_START.music, 0.45);
    assert.equal(TURBO_BASS_BUS, 'combatUi');
    assert.equal(busOfSound('sfx-turbobass-pulse'), 'combatUi');
    assert.equal(busOfSound('synth-radio-stage0-8bit-chiptune'), 'music');
    assert.equal(busOfSound('synth-choir-convergence'), 'music');
    assert.equal(busOfSound('synth-choir-machine-step'), 'world');
    assert.equal(resolveChoirBus(false), 'world');
    assert.equal(resolveChoirBus(true), 'music');
    assert.equal(radioBusForContext(true), 'world');
    assert.equal(radioBusForContext(false), 'music');

    for (const id of [
      'sfx-turbobass-pulse',
      'synth-radio-stage0-8bit-chiptune',
      'synth-choir-convergence',
      'synth-choir-machine-step',
      'tape-01-setmix-theme',
    ]) {
      assert.notEqual(busOfSound(id), 'voice');
    }
  });
});
