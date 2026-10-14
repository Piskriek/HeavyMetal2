// ============================================================================
// File: packages/musicbox/src/harmonic-machine-choir.ts
// R&D Innovation: Outer Wilds-Style 4-Machine Harmonic Convergence Choir
// Rules: Rule 1 (Strictly 4 floats Pxd, Vtx, Lx, Aq), Rule 2 (100% pure math)
// ============================================================================

export const SETMIX_SONG_BPM = 112.0;
export const BEAT_DURATION_SEC = 60.0 / SETMIX_SONG_BPM; // ~0.5357s per beat
export const BAR_DURATION_SEC = BEAT_DURATION_SEC * 4.0; // ~2.1428s per 4/4 bar
export const HARMONIC_CONVERGENCE_RADIUS_M = 35.0;

export type MachineStemRole =
  | 'shape-press-bass'       // Vtx (#7cff4d): 112 BPM hydraulic bassline (D2 -> F2 -> G2 -> A2)
  | 'texture-mill-arp'       // Pxd (#ff3d8a): 16th-note sparkling pixel chime arpeggio
  | 'light-projector-pad'    // Lx  (#ffc13d): Warm analog brass/pad chordal swell
  | 'water-maker-lead';      // Aq  (#3dc8ff): Crystalline marimba/droplet harmonic melody

export interface ActiveMachineEmitter {
  id: string;
  stemRole: MachineStemRole;
  x: number;
  y: number;
  z: number;
  isRunning: boolean;
  efficiency0to1: number; // Scales with power brownout (0.25..1.0)
}

export interface HarmonicChoirStepState {
  bpm: number;
  barIndex: number;
  beatInBar0to3: number;
  beatPhase0to1: number;
  downbeatPulse0to1: number; // Peaks at 1.0 on every beat for visual plume/LED sync
  stemGains: Record<MachineStemRole, number>;
  currentMidiNotes: Record<MachineStemRole, number>;
  currentFreqHz: Record<MachineStemRole, number>;
  activeStemCount: number;
  isHarmonicConvergenceLocked: boolean;
}

// 4-bar D Dorian progression: Dm9 | BbMaj7 | Gm7 | A7sus4
const BASS_MIDI_BY_BAR = [38, 46, 43, 45]; // D2, Bb2, G2, A2
const PAD_ROOT_MIDI_BY_BAR = [62, 58, 55, 57]; // D4, Bb3, G3, A3
const ARP_OFFSETS_16TH = [0, 3, 7, 12, 10, 7, 3, 7, 0, 5, 7, 12, 10, 7, 5, 3];
const LEAD_MELODY_8TH = [74, 72, 69, 67, 69, 72, 69, 65]; // D5, C5, A4, G4...

export function midiToFreqHz(midi: number): number {
  return Number((440.0 * Math.pow(2.0, (midi - 69.0) / 12.0)).toFixed(2));
}

/**
 * Evaluates the phase-locked musical notes, stem gains, and Harmonic Convergence state
 * for all running field machines near the player at timeSec.
 */
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
      1.0 - dist / HARMONIC_CONVERGENCE_RADIUS_M
    );
    const gain = Number((proximityGain * m.efficiency0to1).toFixed(3));
    if (gain > stemGains[m.stemRole]) {
      stemGains[m.stemRole] = gain;
    }
  }

  const step16th = Math.floor(totalBeats * 4.0) % 16;
  const step8th = Math.floor(totalBeats * 2.0) % 8;

  const bassMidi = BASS_MIDI_BY_BAR[barIndex];
  const padMidi = PAD_ROOT_MIDI_BY_BAR[barIndex];
  const arpMidi = padMidi + ARP_OFFSETS_16TH[step16th];
  const leadMidi = LEAD_MELODY_8TH[step8th];

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
