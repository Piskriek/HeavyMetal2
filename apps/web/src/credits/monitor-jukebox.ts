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

import * as THREE from 'three';
import { gameAudio } from '../audio/game-audio';
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

// ============================================================================
// Lab `old-monitor`: the 4-colour equaliser on the screen and the overclocked track through its speaker (TICKET-14).
// Lives here, not in index.ts, so lab-room.ts can import it without pulling in the whole credits director.
// ============================================================================

export interface MonitorEqualizer3D {
  readonly group: THREE.Group;
  setActive(active: boolean): void;
  update(nowSec: number): void;
  dispose(): void;
}

/** Four 3D bars in the metric colours, mounted on the old monitor's screen (hidden until the track plays). */
export function createMonitorEqualizer3D(parent?: THREE.Object3D): MonitorEqualizer3D {
  const group = new THREE.Group();
  group.name = 'old-monitor-equalizer';
  group.visible = false;
  if (parent) parent.add(group);

  const barGeo = new THREE.BoxGeometry(0.04, 0.18, 0.008);
  barGeo.translate(0, 0.09, 0);
  const bars: THREE.Mesh[] = [];
  const mats: THREE.MeshBasicMaterial[] = [];
  for (let i = 0; i < 4; i++) {
    const mat = new THREE.MeshBasicMaterial({ color: MONITOR_EQ_COLOURS[i] });
    const mesh = new THREE.Mesh(barGeo, mat);
    mesh.position.set((i - 1.5) * 0.055, -0.08, 0.01);
    group.add(mesh);
    bars.push(mesh);
    mats.push(mat);
  }

  let isActive = false;
  let startSec = -1;
  return {
    group,
    setActive(on: boolean) {
      isActive = on;
      group.visible = on;
      if (!on) startSec = -1;
    },
    update(nowSec: number) {
      if (!isActive) return;
      if (startSec < 0) startSec = nowSec;
      const heights = monitorEqualizerHeights(nowSec - startSec);
      for (let i = 0; i < 4; i++) bars[i]!.scale.y = heights[i]!;
    },
    dispose() {
      barGeo.dispose();
      for (const m of mats) m.dispose();
      if (group.parent) group.parent.remove(group);
    },
  };
}

const MONITOR_KEY = 'old-monitor-overclocked';
const OVERCLOCKED_ID = 'music-ending-overclocked';
/** The AudioContext time when the overclocked track ends, or -1 when it is not playing. */
let overclockedEndsAt = -1;

/** True while the overclocked track is playing through the monitor (read per frame by the equaliser). */
export function isMonitorOverclockedPlaying(): boolean {
  if (overclockedEndsAt < 0) return false;
  try {
    return gameAudio.getContext().currentTime < overclockedEndsAt;
  } catch {
    return false;
  }
}

/**
 * Plays `"Four Floats (Overclocked)"` (`music-ending-overclocked`) from the monitor's speaker on the world bus. It waits for
 * the buffer first, so the equaliser and the track start together. Returns false when the audio is unavailable.
 */
export async function playMonitorOverclocked(
  monitorPos: { readonly x: number; readonly y: number; readonly z: number } = { x: -1.65, y: 1.15, z: 2.35 },
): Promise<boolean> {
  gameAudio.unlockWorldAudio();
  const buf = await gameAudio.loadBuffer(OVERCLOCKED_ID);
  if (!buf) return false;
  gameAudio.stopLoop3d(MONITOR_KEY, 0.05);
  const voice = gameAudio.play3d(OVERCLOCKED_ID, monitorPos, {
    key: MONITOR_KEY,
    volume: 0.9,
    refDistance: 2.5,
    maxDistance: 18,
    bus: 'world',
  });
  if (!voice) return false;
  overclockedEndsAt = gameAudio.getContext().currentTime + buf.duration;
  return true;
}

export function stopMonitorOverclocked(): void {
  gameAudio.stopLoop3d(MONITOR_KEY, 0.1);
  overclockedEndsAt = -1;
}
