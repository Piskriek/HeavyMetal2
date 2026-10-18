// ============================================================================
// File: packages/musicbox/src/harmonic-machine-choir.ts
// TASK-34 / TICKET-15: Outer Wilds-Style 4-Machine Harmonic Convergence Choir
// - Locked to 144 BPM ("Four Floats" v4b at 1.2x) and D Major stem progression
// - Routes through T09a buses ('world' for individual machines, 'music' on 4/4 lock;
//   never 'voice')
// - Pure deterministic math: no Date.now(), no Math.random()
// ============================================================================

export const SETMIX_SONG_BPM = 144.0;
export const SETMIX_SONG_KEY = 'D Major' as const;
export const BEAT_DURATION_SEC = 60.0 / SETMIX_SONG_BPM; // 0.4166667s per beat
export const BAR_DURATION_SEC = BEAT_DURATION_SEC * 4.0; // 1.6666667s per 4/4 bar
export const HARMONIC_CONVERGENCE_RADIUS_M = 35.0;

export type ChoirTargetBus = 'world' | 'music';

export type MachineStemRole =
  | 'shape-press-bass'       // Vtx (#7cff4d): 144 BPM hydraulic bassline (D2 -> A2 -> B2 -> G2)
  | 'texture-mill-arp'       // Pxd (#ff3d8a): 16th-note sparkling pixel chime arpeggio
  | 'light-projector-pad'    // Lx  (#ffc13d): Warm analog brass/pad chordal swell
  | 'water-maker-lead';      // Aq  (#3dc8ff): Crystalline marimba/droplet harmonic melody

export interface ActiveMachineEmitter {
  readonly id: string;
  readonly stemRole: MachineStemRole;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly isRunning: boolean;
  readonly efficiency0to1: number; // Scales with power brownout (0.25..1.0)
}

export interface HarmonicChoirStepState {
  readonly bpm: number;
  readonly keySignature: typeof SETMIX_SONG_KEY;
  readonly barIndex: number;
  readonly beatInBar0to3: number;
  readonly beatPhase0to1: number;
  readonly downbeatPulse0to1: number; // Peaks at 1.0 on every beat for visual plume/LED sync
  readonly stemGains: Record<MachineStemRole, number>;
  readonly currentMidiNotes: Record<MachineStemRole, number>;
  readonly currentFreqHz: Record<MachineStemRole, number>;
  readonly activeStemCount: number;
  readonly isHarmonicConvergenceLocked: boolean;
  readonly targetBus: ChoirTargetBus;
}

// 4-bar D Major progression from "Four Floats" (v4b @ 144 BPM stems): D | A | Bm7 | G
export const BASS_MIDI_BY_BAR: readonly number[] = [38, 45, 47, 43]; // D2, A2, B2, G2
export const PAD_ROOT_MIDI_BY_BAR: readonly number[] = [62, 57, 59, 55]; // D4, A3, B3, G3
export const ARP_OFFSETS_16TH: readonly number[] = [0, 4, 7, 12, 11, 7, 4, 7, 0, 4, 9, 12, 11, 9, 7, 4];
export const LEAD_MELODY_8TH: readonly number[] = [74, 73, 71, 69, 71, 74, 69, 66]; // D5, C#5, B4, A4, B4, D5, A4, F#4

export function midiToFreqHz(midi: number): number {
  return Number((440.0 * Math.pow(2.0, (midi - 69.0) / 12.0)).toFixed(2));
}

/**
 * Resolves which T09a bus the choir feeds:
 * - Individual running machines (< 4 stems) play on `'world'` (passing through DEC-07's stage bit-depth mirror).
 * - Full 4/4 Harmonic Convergence locks onto `'music'` (ducking cleanly under Dr. Haddy's voice bus).
 * Never routes to `'voice'`.
 */
export function resolveChoirBus(isHarmonicConvergenceLocked: boolean): ChoirTargetBus {
  return isHarmonicConvergenceLocked ? 'music' : 'world';
}

/**
 * Evaluates the phase-locked musical notes, stem gains, and Harmonic Convergence state
 * for all running field machines near the player at timeSec (144 BPM).
 */
export function evaluateHarmonicMachineChoir(
  timeSec: number,
  playerX: number,
  playerY: number,
  playerZ: number,
  machines: readonly ActiveMachineEmitter[],
): HarmonicChoirStepState {
  const t = Number.isFinite(timeSec) ? Math.max(0, timeSec) : 0;
  const totalBeats = t / BEAT_DURATION_SEC;
  const barIndex = Math.floor(totalBeats / 4.0) % 4;
  const beatInBar0to3 = Math.floor(totalBeats) % 4;
  const beatPhase0to1 = Number((totalBeats - Math.floor(totalBeats)).toFixed(3));

  // Sharp exponential decay pulse on each quarter-note beat for visual plume & LED sync
  const downbeatPulse0to1 = Number(Math.exp(-4.5 * beatPhase0to1).toFixed(3));

  const stemGains: Record<MachineStemRole, number> = {
    'shape-press-bass': 0,
    'texture-mill-arp': 0,
    'light-projector-pad': 0,
    'water-maker-lead': 0,
  };

  for (const m of machines) {
    if (!m.isRunning || m.efficiency0to1 <= 0.01) continue;
    const dist = Math.hypot(playerX - m.x, playerY - m.y, playerZ - m.z);
    if (dist > HARMONIC_CONVERGENCE_RADIUS_M) continue;

    const proximityGain = Math.max(
      0.15,
      1.0 - dist / HARMONIC_CONVERGENCE_RADIUS_M,
    );
    const gain = Number((proximityGain * Math.min(1, Math.max(0, m.efficiency0to1))).toFixed(3));
    if (gain > stemGains[m.stemRole]) {
      stemGains[m.stemRole] = gain;
    }
  }

  const step16th = Math.floor(totalBeats * 4.0) % 16;
  const step8th = Math.floor(totalBeats * 2.0) % 8;

  const bassMidi = BASS_MIDI_BY_BAR[barIndex] ?? 38;
  const padMidi = PAD_ROOT_MIDI_BY_BAR[barIndex] ?? 62;
  const arpMidi = padMidi + (ARP_OFFSETS_16TH[step16th] ?? 0);
  const leadMidi = LEAD_MELODY_8TH[step8th] ?? 74;

  const currentMidiNotes: Record<MachineStemRole, number> = {
    'shape-press-bass': bassMidi,
    'texture-mill-arp': arpMidi,
    'light-projector-pad': padMidi,
    'water-maker-lead': leadMidi,
  };

  const currentFreqHz: Record<MachineStemRole, number> = {
    'shape-press-bass': midiToFreqHz(bassMidi),
    'texture-mill-arp': midiToFreqHz(arpMidi),
    'light-projector-pad': midiToFreqHz(padMidi),
    'water-maker-lead': midiToFreqHz(leadMidi),
  };

  const activeStemCount = Object.values(stemGains).filter((g) => g > 0.1).length;
  const isHarmonicConvergenceLocked = activeStemCount === 4;

  return {
    bpm: SETMIX_SONG_BPM,
    keySignature: SETMIX_SONG_KEY,
    barIndex,
    beatInBar0to3,
    beatPhase0to1,
    downbeatPulse0to1,
    stemGains,
    currentMidiNotes,
    currentFreqHz,
    activeStemCount,
    isHarmonicConvergenceLocked,
    targetBus: resolveChoirBus(isHarmonicConvergenceLocked),
  };
}
