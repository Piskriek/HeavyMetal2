// ============================================================================
// File: packages/musicbox/src/harmonic-machine-choir.ts
// Fix: SETMIX_SONG_BPM = 144.0 (matching "Four Floats" v4b at 1.2x),
// every array/record index guarded for noUncheckedIndexedAccess.
// ============================================================================

export const SETMIX_SONG_BPM = 144.0;
export const BEAT_DURATION_SEC = 60.0 / SETMIX_SONG_BPM; // 0.416667s per beat
export const BAR_DURATION_SEC = BEAT_DURATION_SEC * 4.0; // 1.666667s per bar (8 bars = 13.333s)
export const HARMONIC_CONVERGENCE_RADIUS_M = 35.0;

export type MachineStemRole =
  | 'shape-press-bass'
  | 'texture-mill-arp'
  | 'light-projector-pad'
  | 'water-maker-lead';

export interface ActiveMachineEmitter {
  id: string;
  stemRole: MachineStemRole;
  x: number;
  y: number;
  z: number;
  isRunning: boolean;
  efficiency0to1: number;
}

export interface HarmonicChoirStepState {
  bpm: number;
  barIndex: number;
  beatInBar0to3: number;
  beatPhase0to1: number;
  downbeatPulse0to1: number;
  stemGains: Record<MachineStemRole, number>;
  currentMidiNotes: Record<MachineStemRole, number>;
  currentFreqHz: Record<MachineStemRole, number>;
  activeStemCount: number;
  isHarmonicConvergenceLocked: boolean;
}

const BASS_MIDI_BY_BAR: readonly number[] = [38, 46, 43, 45];
const PAD_ROOT_MIDI_BY_BAR: readonly number[] = [62, 58, 55, 57];
const ARP_OFFSETS_16TH: readonly number[] = [
  0, 3, 7, 12, 10, 7, 3, 7, 0, 5, 7, 12, 10, 7, 5, 3,
];
const LEAD_MELODY_8TH: readonly number[] = [74, 72, 69, 67, 69, 72, 69, 65];

export function midiToFreqHz(midi: number): number {
  return Number((440.0 * Math.pow(2.0, (midi - 69.0) / 12.0)).toFixed(2));
}

export function evaluateHarmonicMachineChoir(
  timeSec: number,
  playerX: number,
  playerY: number,
  playerZ: number,
  machines: ActiveMachineEmitter[]
): HarmonicChoirStepState {
  const t = Math.max(0, timeSec);
  const totalBeats = t / BEAT_DURATION_SEC;
  const barIndex = Math.floor(totalBeats / 4.0) % 4;
  const beatInBar0to3 = Math.floor(totalBeats) % 4;
  const beatPhase0to1 = Number((totalBeats - Math.floor(totalBeats)).toFixed(3));
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
      1.0 - dist / HARMONIC_CONVERGENCE_RADIUS_M
    );
    const gain = Number((proximityGain * m.efficiency0to1).toFixed(3));
    const prevGain = stemGains[m.stemRole] ?? 0;
    if (gain > prevGain) {
      stemGains[m.stemRole] = gain;
    }
  }

  const step16th = Math.floor(totalBeats * 4.0) % 16;
  const step8th = Math.floor(totalBeats * 2.0) % 8;

  const bassMidi = BASS_MIDI_BY_BAR[barIndex] ?? 38;
  const padMidi = PAD_ROOT_MIDI_BY_BAR[barIndex] ?? 62;
  const arpOffset = ARP_OFFSETS_16TH[step16th] ?? 0;
  const arpMidi = padMidi + arpOffset;
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

  return {
    bpm: SETMIX_SONG_BPM,
    barIndex,
    beatInBar0to3,
    beatPhase0to1,
    downbeatPulse0to1,
    stemGains,
    currentMidiNotes,
    currentFreqHz,
    activeStemCount,
    isHarmonicConvergenceLocked: activeStemCount === 4,
  };
}
