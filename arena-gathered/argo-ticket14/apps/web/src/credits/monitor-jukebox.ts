// ============================================================================
// File: apps/web/src/credits/monitor-jukebox.ts
// TICKET-14 (Brief 33 — Lab `old-monitor` Jukebox & Four-Colour Equaliser):
// - Pure 4-bar chiptune equaliser math (`monitorEqualizerHeights`) in the 4 canonical
//   metric colours (#ff3d8a, #7cff4d, #ffc13d, #3dc8ff).
// - Self-contained 3D equaliser attachment for `old-monitor` in `lab-room.ts`
//   (`createMonitorEqualizerMesh`, zero text on 3D art).
// - Jukebox audio helper playing `"Four Floats (Overclocked)"` (`music-ending-overclocked`)
//   through the Lab monitor speaker on `World_SFX_Bus` (`bus: 'world'`).
// ============================================================================

import { CREDITS_BPM } from './timeline';

export const MONITOR_EQ_COLOURS: readonly [string, string, string, string] = [
  '#ff3d8a', // Pxd (Pink)
  '#7cff4d', // Vtx (Green)
  '#ffc13d', // Lx  (Amber)
  '#3dc8ff', // Aq  (Cyan)
];

export const OVERCLOCKED_BPM = CREDITS_BPM * 1.2; // 172.8 BPM (1.2x pitch-up track)

export interface MonitorActionSpec {
  readonly id: 'play-credits' | 'play-overclocked';
  readonly label: string;
  readonly description: string;
}

export const OLD_MONITOR_ACTIONS: readonly MonitorActionSpec[] = [
  {
    id: 'play-credits',
    label: 'Play Ending Credits: "Four Floats" (v4b)',
    description: 'Launch the full real-time 144 BPM in-engine credits music video.',
  },
  {
    id: 'play-overclocked',
    label: 'Play "Four Floats (Overclocked)"',
    description: 'Play the 1.2x pitch-up track through the Lab monitor speaker with the 4-colour equaliser.',
  },
];

/**
 * Pure deterministic 4-bar equaliser heights (each in 0.12 .. 1.0) at `elapsedSec`
 * for the four floats (`#ff3d8a`, `#7cff4d`, `#ffc13d`, `#3dc8ff`).
 */
export function monitorEqualizerHeights(
  elapsedSec: number,
  bpm = OVERCLOCKED_BPM,
): readonly [number, number, number, number] {
  const safeT = Number.isFinite(elapsedSec) && elapsedSec >= 0 ? elapsedSec : 0;
  const beatSec = 60 / Math.max(1, bpm);
  const totalBeats = safeT / beatSec;
  const beatIdx = Math.floor(totalBeats);
  const frac = totalBeats - beatIdx;
  const downPulse = Math.max(0, 1 - frac * 2.2);

  const h0 = Math.min(1, Math.max(0.14, 0.25 + 0.72 * downPulse + 0.12 * Math.sin(safeT * 11.0)));
  const h1 = Math.min(1, Math.max(0.14, 0.22 + 0.55 * (beatIdx % 2 === 1 ? downPulse : 0.35) + 0.18 * Math.cos(safeT * 14.5)));
  const h2 = Math.min(1, Math.max(0.14, 0.28 + 0.62 * (beatIdx % 4 === 2 ? 0.9 : downPulse * 0.7) + 0.15 * Math.sin(safeT * 17.3 + 1.1)));
  const h3 = Math.min(1, Math.max(0.14, 0.20 + 0.68 * (beatIdx % 4 === 3 ? 0.95 : downPulse * 0.65) + 0.16 * Math.cos(safeT * 19.7 + 2.4)));

  return [
    Math.round(h0 * 1000) / 1000,
    Math.round(h1 * 1000) / 1000,
    Math.round(h2 * 1000) / 1000,
    Math.round(h3 * 1000) / 1000,
  ];
}
