/**
 * @hm/ui — Player HUD Telemetry & Lab Bench Turntable Preview Readouts for Plan 46
 * Repository Path: apps/web/src/base/ui/harness-telemetry-hud.tsx
 *
 * Implements Pillar 2 of HARNESS_CONSUMER_INTEGRATION_ARGON_CREATIVE_PASS:
 * 1. AttractorTrenchGauge: Visualizes U(x) = -0.5 * Pi_prior * (x - mu_prior)^2 & Latch L_ij in [-127..127]
 * 2. CyberneticMirrorReticle: Concentric phase rings for q(t) vs mu_prior * A(t) + interference scanlines
 * 3. SyntropicBufferBar: Dual-chamber Higher-Self Escrow (amber) -> Exploration Reserve (emerald) + Gate g_escrow
 * 4. GraduationAscentAura: Ray-7 Violet (#b84dff) corona & mastery ring when H_system >= 0.95
 *
 * Pure deterministic view-model projection + React HUD blade (RULES 8a).
 */

import type { ReactElement } from 'react';
import { StateIdx } from '@hm/harness';

export interface IHarnessHudViewModel {
  /** Attractor Trench Widget */
  readonly trenchDepthNorm: number;       // [0..1] normalized well depth
  readonly piPrior: number;               // Precision weight
  readonly latchLogOdds: number;          // [-127..+127]
  readonly breakerAnnealingActive: boolean;
  readonly trenchColorHex: '#3dc8ff' | '#ffc13d' | '#ff3d8a';
  readonly svgWellPathD: string;          // 120x44 SVG quadratic/Gaussian potential well curve

  /** Cybernetic Mirror R Widget */
  readonly mirrorErrorNorm: number;       // [0..1]
  readonly awarenessRatio: number;        // A(t) / A_relative in [0..1]
  readonly phaseLockDeg: number;          // [0..180] angular phase offset between inner & outer reticle rings
  readonly scanlineGlitchOpacity: number; // [0..0.85]

  /** Syntropic Buffer B_syntropic Widget */
  readonly escrowBalanceJ: number;
  readonly explorationReserveJ: number;
  readonly escrowGateOpenRatio: number;   // g_escrow in [0..1]

  /** Graduation G_ascent Aura Widget */
  readonly coherenceH: number;            // H_system in [0..1]
  readonly masteryProgressRatio: number;  // [0..1]
  readonly graduatedRay7AuraActive: boolean;
  readonly auraHex: '#3dc8ff' | '#3eff8b' | '#b84dff';
}

/**
 * Pure deterministic projection from the 24-float state vector and syntropic buffer
 * into the 4 HUD widget view-models (callable in both headless tests and 60 FPS React HUD).
 */
export function computeHarnessHudViewModel(
  stateVec: Float32Array,
  syntropicBuffer: Float64Array,
  latchLogOdds: number,
  masteryElapsedSec: number,
  masteryRequiredSec: number,
  relativeAwarenessCap: number,
  targetTrueX = 0.0,
): IHarnessHudViewModel {
  const qx = stateVec[StateIdx.QX]!;
  const muPrior = stateVec[StateIdx.MU_PXD]!;
  const piPrior = stateVec[StateIdx.PI_PRIOR]!;
  const awareness = stateVec[StateIdx.A_AWARE]!;
  const ftle = stateVec[StateIdx.LAMBDA_FTLE]!;
  const coherenceH = stateVec[StateIdx.H_COHERENCE]!;

  // 1. Attractor Trench Depth & SVG Potential Curve (120x44 px)
  const rawTrenchJ = 0.5 * piPrior * (qx - muPrior) * (qx - muPrior) + 0.15 * Math.max(0, piPrior - 1.5);
  const trenchDepthNorm = Math.min(1.0, rawTrenchJ / 25.0);
  const breakerAnnealingActive = ftle > 0.18 && piPrior < 8.0;
  const trenchColorHex =
    piPrior > 10.0 ? '#ff3d8a' : breakerAnnealingActive ? '#ffc13d' : '#3dc8ff';

  const wellCenterPx = Math.max(16, Math.min(104, Math.round(60 + (muPrior - targetTrueX) * 14)));
  const wellDipPx = Math.round(6 + 34 * trenchDepthNorm);
  const wellWidthPx = Math.max(6, Math.round(28 / Math.sqrt(Math.max(0.5, piPrior * 0.25))));
  const xL = Math.max(4, wellCenterPx - wellWidthPx);
  const xR = Math.min(116, wellCenterPx + wellWidthPx);
  const svgWellPathD = `M 0 6 L ${xL} 6 Q ${wellCenterPx} ${wellDipPx} ${xR} 6 L 120 6`;

  // 2. Cybernetic Mirror R Discrepancy & Phase Reticle
  const mirrorDiscrepancy = Math.abs((qx - targetTrueX) + awareness * (muPrior - targetTrueX));
  const mirrorErrorNorm = Math.min(1.0, mirrorDiscrepancy / 2.5);
  const awarenessRatio = Math.min(1.0, awareness / Math.max(0.05, relativeAwarenessCap));
  const phaseLockDeg = Math.round(mirrorErrorNorm * 180.0);
  const scanlineGlitchOpacity = Number((mirrorErrorNorm * 0.85).toFixed(3));

  // 3. Syntropic Buffer Escrow & Exploration Reserve
  const escrowBalanceJ = syntropicBuffer[0]!;
  const explorationReserveJ = stateVec[StateIdx.E_RESERVE]!;
  const escrowGateOpenRatio = Math.min(1.0, Math.exp(-piPrior / 1.5));

  // 4. Graduation G_ascent Ray-7 Violet Aura
  const masteryProgressRatio = Math.min(1.0, masteryElapsedSec / Math.max(0.1, masteryRequiredSec));
  const graduatedRay7AuraActive = masteryProgressRatio >= 1.0 && coherenceH >= 0.95;
  const auraHex = graduatedRay7AuraActive
    ? '#b84dff'
    : coherenceH >= 0.90
      ? '#3eff8b'
      : '#3dc8ff';

  return {
    trenchDepthNorm,
    piPrior,
    latchLogOdds,
    breakerAnnealingActive,
    trenchColorHex,
    svgWellPathD,
    mirrorErrorNorm,
    awarenessRatio,
    phaseLockDeg,
    scanlineGlitchOpacity,
    escrowBalanceJ,
    explorationReserveJ,
    escrowGateOpenRatio,
    coherenceH,
    masteryProgressRatio,
    graduatedRay7AuraActive,
    auraHex,
  };
}

/** A joule reading squeezed into a [0..1] bar width: saturating, so small reserves still show. */
const barFill = (joules: number): number => joules / (joules + 8.0);

const RING_R = 15;
const RING_C = 2 * Math.PI * RING_R;

/**
 * The Sovereign Harness Telemetry Blade (plan 47, Pillar 2): the four diegetic instruments —
 * Attractor Trench potential well, Cybernetic Mirror phase reticle, Syntropic Buffer chambers,
 * and the Graduation mastery ring — rendered from the pure view-model. Docks in HUD zone 8
 * (bottom-right) while the player pilots a harnessed vehicle.
 */
export function HarnessTelemetryHud(props: { readonly vm: IHarnessHudViewModel | null }): ReactElement | null {
  const vm = props.vm;
  if (!vm) return null;
  const latchSign = vm.latchLogOdds > 0 ? '+' : '';
  const escrowPct = Math.round(vm.escrowGateOpenRatio * 100);
  return (
    <div className="hud-harness-blade" data-hud-zone="bottom-right" role="status" aria-label="Soul harness telemetry">
      <div className="hud-harness-row" data-testid="harness-trench">
        <svg className="hud-harness-well" viewBox="0 0 120 44" width="120" height="44" aria-hidden="true">
          <path d={vm.svgWellPathD} fill="none" stroke={vm.trenchColorHex} strokeWidth="2" strokeLinecap="round" />
        </svg>
        <span className="hud-harness-pill" style={{ color: vm.trenchColorHex, borderColor: vm.trenchColorHex }}>
          Π {vm.piPrior >= 100 ? vm.piPrior.toFixed(0) : vm.piPrior.toFixed(2)} · L {latchSign}{vm.latchLogOdds}
        </span>
      </div>
      <div className="hud-harness-row" data-testid="harness-mirror">
        <svg className="hud-harness-reticle" viewBox="0 0 48 48" width="34" height="34" aria-hidden="true">
          <circle cx="24" cy="24" r="10" fill="none" stroke="#9fe8ff" strokeWidth="2" opacity="0.9" />
          <g transform={`rotate(${vm.phaseLockDeg} 24 24)`}>
            <circle cx="24" cy="24" r="17" fill="none" stroke={vm.mirrorErrorNorm < 0.05 ? '#3eff8b' : '#3dc8ff'}
              strokeWidth="2" strokeDasharray={`${17 * Math.PI * (0.55 + 0.45 * vm.awarenessRatio)} ${17 * Math.PI * 2}`} />
          </g>
          <line x1="4" y1="24" x2="44" y2="24" stroke="#ff3d8a" strokeWidth="1.5" opacity={vm.scanlineGlitchOpacity} />
        </svg>
        <span className="hud-harness-read">MIRROR Δ{vm.phaseLockDeg}° · A {(vm.awarenessRatio * 100).toFixed(0)}%</span>
      </div>
      <div className="hud-harness-row hud-harness-buffer" data-testid="harness-buffer">
        <i className="hud-harness-chamber" aria-hidden="true">
          <b className="is-escrow" style={{ width: `${barFill(vm.escrowBalanceJ) * 100}%` }} />
        </i>
        <span className="hud-harness-gate">⇥{escrowPct}%</span>
        <i className="hud-harness-chamber" aria-hidden="true">
          <b className="is-reserve" style={{ width: `${barFill(vm.explorationReserveJ) * 100}%` }} />
        </i>
        <span className="hud-harness-read">{vm.escrowBalanceJ.toFixed(1)}J → {vm.explorationReserveJ.toFixed(1)}J</span>
      </div>
      <div className={`hud-harness-row hud-harness-aura${vm.graduatedRay7AuraActive ? ' is-graduated' : ''}`} data-testid="harness-aura">
        <svg viewBox="0 0 36 36" width="26" height="26" aria-hidden="true">
          <circle cx="18" cy="18" r={RING_R} fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="3" />
          <circle cx="18" cy="18" r={RING_R} fill="none" stroke={vm.auraHex} strokeWidth="3" strokeLinecap="round"
            strokeDasharray={RING_C} strokeDashoffset={RING_C * (1 - vm.masteryProgressRatio)} transform="rotate(-90 18 18)" />
        </svg>
        <span className="hud-harness-read" style={{ color: vm.auraHex }}>
          H {(vm.coherenceH * 100).toFixed(1)}%{vm.graduatedRay7AuraActive ? ' ★ N+1' : ''}
        </span>
      </div>
    </div>
  );
}
