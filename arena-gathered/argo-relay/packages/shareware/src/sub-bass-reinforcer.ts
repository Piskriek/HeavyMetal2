// ============================================================================
// File: packages/shareware/src/sub-bass-reinforcer.ts
// Plan: Plan 15 (P1-SOUND-05 Sub-Bass Reinforcement for 8-Bit 11 kHz WAD Audio)
// Rules: Rule 3 (0 MB procedural synthesis) & Rule 18 (Unmodified BSD WAD lumps)
// ============================================================================

export type WadSoundCategory = 'shotgun-blast' | 'monster-attack' | 'monster-pain';

export interface SubBassReinforceParams {
  startFreqHz: number;
  endFreqHz: number;
  durationSec: number;
  subGain: number;
  slapbackDelaySec: number;
}

export function getSubBassReinforceParams(
  category: WadSoundCategory
): SubBassReinforceParams {
  switch (category) {
    case 'shotgun-blast':
      return {
        startFreqHz: 64.0,
        endFreqHz: 31.0,
        durationSec: 0.12,
        subGain: 0.42,
        slapbackDelaySec: 0.045,
      };
    case 'monster-attack':
      return {
        startFreqHz: 58.0,
        endFreqHz: 34.0,
        durationSec: 0.10,
        subGain: 0.30,
        slapbackDelaySec: 0.055,
      };
    case 'monster-pain':
      return {
        startFreqHz: 52.0,
        endFreqHz: 36.0,
        durationSec: 0.08,
        subGain: 0.24,
        slapbackDelaySec: 0.04,
      };
  }
}

/**
 * Fires the procedural sub-bass transient punch synchronously alongside a WAD PCM buffer.
 */
export function triggerSharewareSubBassPunch(
  ctx: AudioContext,
  destination: AudioNode,
  category: WadSoundCategory = 'shotgun-blast'
): void {
  const params = getSubBassReinforceParams(category);
  const now = ctx.currentTime;

  const subOsc = ctx.createOscillator();
  const subGain = ctx.createGain();
  subOsc.type = 'sine';
  subOsc.frequency.setValueAtTime(params.startFreqHz, now);
  subOsc.frequency.exponentialRampToValueAtTime(params.endFreqHz, now + params.durationSec);

  subGain.gain.setValueAtTime(params.subGain, now);
  subGain.gain.exponentialRampToValueAtTime(0.001, now + params.durationSec);

  subOsc.connect(subGain);
  subGain.connect(destination);
  subOsc.start(now);
  subOsc.stop(now + params.durationSec + 0.01);
}
