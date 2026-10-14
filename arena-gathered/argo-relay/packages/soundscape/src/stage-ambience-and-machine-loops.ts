// ============================================================================
// File: packages/soundscape/src/stage-ambience-and-machine-loops.ts
// Brief: Brief 29 (P1-SOUND-03 Stage Ambience, P1-SOUND-04 4-Voice Machine Loops, P2-SOUND-06 Swell)
// Rules: Rule 3 & POL-27 (100% procedural Web Audio synthesis = 0 MB bundle weight)
// ============================================================================

import type { FourFloats } from '../../groundshader/src/stage-post.glsl';

export interface SpatialMachineSoundSource {
  id: string;
  machineType: 'rock-drill' | 'texture-mill' | 'shape-press' | 'light-projector' | 'water-maker';
  x: number;
  y: number;
  z: number;
  isPoweredAndRunning: boolean;
}

/**
 * Pure deterministic selector for the 4-Voice Proximity Culling Rule (P1-SOUND-04):
 * Returns at most 4 running machines within maxDistanceM (30m), sorted closest-first.
 */
export function selectActivePositionalMachineVoices(
  listenerPos: { x: number; y: number; z: number },
  machines: SpatialMachineSoundSource[],
  maxVoices = 4,
  maxDistanceM = 30.0
): Array<SpatialMachineSoundSource & { distanceM: number }> {
  return machines
    .filter((m) => m.isPoweredAndRunning)
    .map((m) => ({
      ...m,
      distanceM: Math.hypot(m.x - listenerPos.x, m.y - listenerPos.y, m.z - listenerPos.z),
    }))
    .filter((m) => m.distanceM <= maxDistanceM)
    .sort((a, b) => a.distanceM - b.distanceM)
    .slice(0, maxVoices);
}

export interface AmbienceStemGains {
  labHum50Hz: number;
  helmetRespirator: number;
  craterWind: number;
  hydroWaterLap: number;
  forestCanopyAndFauna: number;
}

/**
 * Pure deterministic crossfader for the 5 procedural ambience stems based on S = (Pxd, Vtx, Lx, Aq).
 */
export function computeStageAmbienceStemGains(
  s: FourFloats,
  isInsideLab: boolean
): AmbienceStemGains {
  if (isInsideLab) {
    return {
      labHum50Hz: 0.65,
      helmetRespirator: 0.0,
      craterWind: 0.05,
      hydroWaterLap: 0.0,
      forestCanopyAndFauna: 0.0,
    };
  }

  const helmetRespirator = s.Lx < 0.35 ? 0.45 * (1.0 - s.Lx / 0.35) : 0.0;
  const craterWind = Math.min(0.55, 0.15 + s.Lx * 0.45);
  const hydroWaterLap = s.Aq >= 0.40 ? Math.min(0.65, (s.Aq - 0.40) / 0.45) : 0.0;
  const meanS = (s.Pxd + s.Vtx + s.Lx + s.Aq) * 0.25;
  const forestCanopyAndFauna = meanS >= 0.75 ? Math.min(0.70, (meanS - 0.75) / 0.20) : 0.0;

  return {
    labHum50Hz: 0.0,
    helmetRespirator,
    craterWind,
    hydroWaterLap,
    forestCanopyAndFauna,
  };
}

/**
 * Triggers the 6-second Shepard-Tone / Lush Pad Stage-Transition Swell (P2-SOUND-06)
 * on the provided Web Audio destination node.
 */
export function playStageTransitionHarmonicSwell(
  ctx: AudioContext,
  destination: AudioNode,
  stageIndex1to6: number
): void {
  const now = ctx.currentTime;
  const baseFreq = 110 * Math.pow(2, (stageIndex1to6 - 1) * (2 / 12)); // Steps up whole tones per stage
  const chordRatios = [1.0, 1.25, 1.5, 2.0]; // Major triad + octave

  for (const ratio of chordRatios) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = stageIndex1to6 <= 2 ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(baseFreq * ratio * 0.5, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * ratio, now + 4.5);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.09, now + 2.5);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + 6.0);

    osc.connect(gain);
    gain.connect(destination);
    osc.start(now);
    osc.stop(now + 6.1);
  }
}
