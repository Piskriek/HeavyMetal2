// ============================================================================
// File: packages/content/src/diegetic-radio-and-tapes.ts
// TASK-34 / TICKET-15: Portal-Style 85.2 MHz Bridge FM Radio & 4 Wreck Cassette Tapes
// - Pure deterministic data & functions: no Date.now(), no Math.random()
// - Maps TAPE #01..#04 onto wreck sites 1..4 placed by T07a and TRIFT
// - Routes audio strictly to T09a 'music' or 'world' buses (never 'voice')
// ============================================================================

export interface FourFloats {
  readonly Pxd: number;
  readonly Vtx: number;
  readonly Lx: number;
  readonly Aq: number;
}

export type RadioArrangementStyle =
  | 'stage0-8bit-chiptune'
  | 'stage2-16bit-fm-synthwave'
  | 'stage4-lush-stereo-studio'
  | 'sstv-hidden-transmission';

export type RadioTargetBus = 'music' | 'world';

export interface CollectibleMusicTape {
  readonly id: string;
  readonly tapeNumber: 1 | 2 | 3 | 4;
  readonly wreckSiteIndex: 1 | 2 | 3 | 4;
  readonly transponderId: string;
  readonly title: string;
  readonly frequencyMhz: string;
  readonly discoveryLocation: string;
  readonly bpm: number;
  readonly haddyDiscoveryBark: string;
  readonly isSecretTransmissionTape?: boolean;
}

export const COLLECTIBLE_MUSIC_TAPES: readonly CollectibleMusicTape[] = Object.freeze([
  {
    id: 'tape-01-setmix-theme',
    tapeNumber: 1,
    wreckSiteIndex: 1,
    transponderId: 'transponder-01',
    title: 'TAPE #01: "Four Floats" (SetMix Theme v4b)',
    frequencyMhz: '85.2 MHz',
    discoveryLocation: 'Wreck Site #01 (Battery Pack Transponder)',
    bpm: 144,
    haddyDiscoveryBark:
      "Hey, you found Tape #01 on that wreck! Leave the tuner on 85.2 MHz—the old girl hums cleaner when she's locked to 144 BPM.",
  },
  {
    id: 'tape-02-haddy-holiday-demo',
    tapeNumber: 2,
    wreckSiteIndex: 2,
    transponderId: 'transponder-02',
    title: 'TAPE #02: "Sub-Bass & Solder" (2024 Bridge Holiday Demo)',
    frequencyMhz: '91.6 MHz',
    discoveryLocation: 'Wreck Site #02 (Old Terminal Wreck)',
    bpm: 144,
    haddyDiscoveryBark:
      'Wait... is that my old synth demo from the 2024 Bridge Christmas party?! Who compiled that into a wreck cartridge?! Turn it up!',
  },
  {
    id: 'tape-03-goblin-drift',
    tapeNumber: 3,
    wreckSiteIndex: 3,
    transponderId: 'transponder-03',
    title: 'TAPE #03: "Low-G Pacejka Drift" (Rover Cruising Mix)',
    frequencyMhz: '98.4 MHz',
    discoveryLocation: 'Wreck Site #03 (Control Box Salvage Wreck)',
    bpm: 144,
    haddyDiscoveryBark:
      'Now that is a proper rover-cruising track. Try not to launch the Scout into a crater on the chorus.',
  },
  {
    id: 'tape-04-vance-sstv-signal',
    tapeNumber: 4,
    wreckSiteIndex: 4,
    transponderId: 'transponder-04',
    title: 'TAPE #04: "Sector-Vance Harmonic Carrier" (Encrypted SSTV)',
    frequencyMhz: '104.9 MHz',
    discoveryLocation: 'Wreck Site #04 (Perimeter Radar Panel Wreck)',
    bpm: 144,
    haddyDiscoveryBark:
      "Hold on—that's not music, that's a phase-encoded carrier from Vance's enclave! Carry that tape through the Twin Gate into the Lab!",
    isSecretTransmissionTape: true,
  },
]);

/** Maps leak/wreck site indices 1..4 (placed by T07a and TRIFT) to TAPE #01..#04. */
export const WRECK_TAPE_BY_SITE: Readonly<Record<number, string>> = Object.freeze({
  1: 'tape-01-setmix-theme',
  2: 'tape-02-haddy-holiday-demo',
  3: 'tape-03-goblin-drift',
  4: 'tape-04-vance-sstv-signal',
});

/** Maps transponder IDs on wreck sites 1..4 to their collectible cassette tape ID. */
export const WRECK_TAPE_BY_TRANSPONDER: Readonly<Record<string, string>> = Object.freeze({
  'transponder-01': 'tape-01-setmix-theme',
  'transponder-02': 'tape-02-haddy-holiday-demo',
  'transponder-03': 'tape-03-goblin-drift',
  'transponder-04': 'tape-04-vance-sstv-signal',
});

export function tapeForWreckSite(siteIndex: number): CollectibleMusicTape | null {
  const id = WRECK_TAPE_BY_SITE[siteIndex];
  if (!id) return null;
  return COLLECTIBLE_MUSIC_TAPES.find((t) => t.id === id) ?? null;
}

export function tapeForTransponder(transponderId: string | undefined): CollectibleMusicTape | null {
  if (!transponderId) return null;
  const id = WRECK_TAPE_BY_TRANSPONDER[transponderId];
  if (!id) return null;
  return COLLECTIBLE_MUSIC_TAPES.find((t) => t.id === id) ?? null;
}

/**
 * Resolves the T09a bus for the 85.2 MHz Bridge FM radio:
 * - Spatial emitter on a field wreck or desk monitor routes to `'world'` (bit-depth mirror).
 * - Suit/Rover HUD cassette deck routes to `'music'`.
 * Never routes to `'voice'`.
 */
export function radioBusForContext(isSpatialWorldEmitter: boolean): RadioTargetBus {
  return isSpatialWorldEmitter ? 'world' : 'music';
}

/**
 * Selects the acoustic arrangement of the active song based on the plot's Fidelity Stage,
 * or triggers the Portal-style "Transmission Received" easter egg when Tape #04 crosses the Gate.
 */
export function resolveRadioArrangementStyle(
  tapeId: string,
  s: FourFloats,
  isNearTwinGateThreshold: boolean,
  isInsideLab: boolean,
  isSpatialWorldEmitter = false,
): {
  arrangement: RadioArrangementStyle;
  sampleRateHz: number;
  wowFlutterDepth: number;
  unlockedTransmissionAchievement: boolean;
  decodedMessage: string | null;
  targetBus: RadioTargetBus;
} {
  const targetBus = radioBusForContext(isSpatialWorldEmitter);

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
        'TRANSMISSION RECEIVED [104.9 MHz]: "If our four machines sing in 144 BPM D-Major, the Bridge Array remembers the trees."',
      targetBus,
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
      targetBus,
    };
  }

  if (minFloat < 0.70 && !isInsideLab) {
    return {
      arrangement: 'stage2-16bit-fm-synthwave',
      sampleRateHz: 22050,
      wowFlutterDepth: 0.012,
      unlockedTransmissionAchievement: false,
      decodedMessage: null,
      targetBus,
    };
  }

  return {
    arrangement: 'stage4-lush-stereo-studio',
    sampleRateHz: 48000,
    wowFlutterDepth: 0.002,
    unlockedTransmissionAchievement: false,
    decodedMessage: null,
    targetBus,
  };
}
