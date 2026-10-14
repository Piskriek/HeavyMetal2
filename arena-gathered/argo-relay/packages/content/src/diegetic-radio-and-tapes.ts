// ============================================================================
// File: packages/content/src/diegetic-radio-and-tapes.ts
// R&D Innovation: Portal-Style 85.2 MHz Radio Easter Egg & Wreck Cassette Tapes
// ============================================================================

import type { FourFloats } from '../../groundshader/src/stage-post.glsl';

export type RadioArrangementStyle =
  | 'stage0-8bit-chiptune'
  | 'stage2-16bit-fm-synthwave'
  | 'stage4-lush-stereo-studio'
  | 'sstv-hidden-transmission';

export interface CollectibleMusicTape {
  id: string;
  title: string;
  frequencyMhz: string;
  discoveryLocation: string;
  bpm: number;
  haddyDiscoveryBark: string;
  isSecretTransmissionTape?: boolean;
}

export const COLLECTIBLE_MUSIC_TAPES: CollectibleMusicTape[] = [
  {
    id: 'tape-01-setmix-theme',
    title: 'TAPE #01: "Standing Inside the Progress Bar" (SetMix Theme)',
    frequencyMhz: '85.2 MHz',
    discoveryLocation: 'Lab Observation Desk (Starter Tape)',
    bpm: 112,
    haddyDiscoveryBark:
      "Hey, you found the Lab radio! Leave it on 85.2 MHz—the old girl hums cleaner when she's got a beat.",
  },
  {
    id: 'tape-02-haddy-holiday-demo',
    title: 'TAPE #02: "Sub-Bass & Solder" (2024 Bridge Holiday Demo)',
    frequencyMhz: '91.6 MHz',
    discoveryLocation: 'Behind Lab Capacitor Bank Skid',
    bpm: 120,
    haddyDiscoveryBark:
      'Wait... is that my old synth demo from the 2024 Bridge Christmas party?! Who compiled that into a cartridge?! Turn it up!',
  },
  {
    id: 'tape-03-goblin-drift',
    title: 'TAPE #03: "Low-G Pacejka Drift" (Rover Cruising Mix)',
    frequencyMhz: '98.4 MHz',
    discoveryLocation: 'NW Bouldered Ore Ridge SalvagePod',
    bpm: 128,
    haddyDiscoveryBark:
      'Now that is a proper rover-cruising track. Try not to launch the Scout into a crater on the chorus.',
  },
  {
    id: 'tape-04-vance-sstv-signal',
    title: 'TAPE #04: "Sector-Vance Harmonic Carrier" (Encrypted SSTV)',
    frequencyMhz: '104.9 MHz',
    discoveryLocation: 'Perimeter Wreck Rim Transponder',
    bpm: 112,
    haddyDiscoveryBark:
      "Hold on—that's not music, that's a phase-encoded carrier from Vance's enclave! Carry that tape through the Twin Gate into the Lab!",
    isSecretTransmissionTape: true,
  },
];

/**
 * Selects the acoustic arrangement of the active song based on the plot's Fidelity Stage,
 * or triggers the Portal-style "Transmission Received" easter egg when Tape #04 crosses the Gate.
 */
export function resolveRadioArrangementStyle(
  tapeId: string,
  s: FourFloats,
  isNearTwinGateThreshold: boolean,
  isInsideLab: boolean
): {
  arrangement: RadioArrangementStyle;
  sampleRateHz: number;
  wowFlutterDepth: number;
  unlockedTransmissionAchievement: boolean;
  decodedMessage: string | null;
} {
  if (
    tapeId === 'tape-04-vance-sstv-signal' &&
    (isNearTwinGateThreshold || isInsideLab)
  ) {
    return {
      arrangement: 'sstv-hidden-transmission',
      sampleRateHz: 48000,
      wowFlutterDepth: 0.0,
      unlockedTransmissionAchievement: true,
      decodedMessage:
        'TRANSMISSION RECEIVED [104.9 MHz]: "If our four machines sing in 112 BPM D-Dorian, the Bridge Array remembers the trees."',
    };
  }

  const minFloat = Math.min(s.Pxd, s.Vtx, s.Lx);
  if (minFloat < 0.25 && !isInsideLab) {
    return {
      arrangement: 'stage0-8bit-chiptune',
      sampleRateHz: 11025,
      wowFlutterDepth: 0.035,
      unlockedTransmissionAchievement: false,
      decodedMessage: null,
    };
  }

  if (minFloat < 0.70 && !isInsideLab) {
    return {
      arrangement: 'stage2-16bit-fm-synthwave',
      sampleRateHz: 22050,
      wowFlutterDepth: 0.012,
      unlockedTransmissionAchievement: false,
      decodedMessage: null,
    };
  }

  return {
    arrangement: 'stage4-lush-stereo-studio',
    sampleRateHz: 48000,
    wowFlutterDepth: 0.002,
    unlockedTransmissionAchievement: false,
    decodedMessage: null,
  };
}
