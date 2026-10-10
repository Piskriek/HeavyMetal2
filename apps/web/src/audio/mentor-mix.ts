/**
 * The mentor's radio mix: one source for the audition page (`/radio.html`) and the in-game voice-over.
 * The levels are the owner's, set by ear on 2026-10-10 ("here are the numbers for the voice"): mostly the clean
 * voice with a light touch of the field radio, over a quiet static bed and the music, which ducks under her lines.
 * Voice files stay clean (RUN.world TTS, voice "FIDELITY Mentor"); this chain is applied at playback.
 */
export const MENTOR_MIX = {
  /** Fader values, 0..100, as the audition page shows them. */
  levels: { voice: 80, radio: 10, static: 30, music: 45, overdrive: 10 },
  /** The radio band: wider than a phone line, the grating 2.5-4 kHz region cut, a low presence lift. */
  band: { highpassHz: 240, highpassQ: 0.6, lowpassHz: 4800, lowpassQ: 0.5 },
  presence: { hz: 1300, q: 0.8, gainDb: 2.5 },
  deHarsh: { hz: 3200, q: 1.2, gainDb: -3 },
  compressor: { thresholdDb: -20, ratio: 3, attackS: 0.008, releaseS: 0.18 },
  /** Gain scales from fader to node: voice ×1.4, static ×0.6; music ducks to 45% of its level while she talks. */
  scale: { voice: 1.4, static: 0.6 },
  duck: { to: 0.45, downS: 0.4, upS: 1.2 },
  /** The static bed is low-passed so it sits behind the voice. */
  staticLowpassHz: 5000,
} as const;

/** Equal-power wet/dry gains for a radio amount 0..1, so her level holds as the blend moves. */
export function radioBlend(amount: number): { wet: number; dry: number } {
  const a = Math.min(1, Math.max(0, amount));
  return { wet: Math.sin((a * Math.PI) / 2), dry: Math.cos((a * Math.PI) / 2) };
}

/** The radio speaker's soft clip curve for an overdrive amount 0..1. */
export function driveCurve(amount: number, n = 1024): Float32Array {
  const k = amount * 40, out = new Float32Array(n);
  for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; out[i] = ((1 + k) * x) / (1 + k * Math.abs(x)); }
  return out;
}
