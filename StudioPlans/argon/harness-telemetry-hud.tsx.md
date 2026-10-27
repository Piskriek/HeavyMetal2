/\*\*  
 \* @hm/ui — Player HUD Telemetry & Lab Bench Turntable Preview Readouts for Plan 46  
 \* Repository Path: apps/web/src/base/ui/harness-telemetry-hud.tsx  
 \*  
 \* Implements Pillar 2 of HARNESS\_CONSUMER\_INTEGRATION\_ARGON\_CREATIVE\_PASS:  
 \* 1\. AttractorTrenchGauge: Visualizes U(x) \= \-0.5 \* Pi\_prior \* (x \- mu\_prior)^2 & Latch L\_ij in \[-127..127\]  
 \* 2\. CyberneticMirrorReticle: Concentric phase rings for q(t) vs mu\_prior \* A(t) \+ interference scanlines  
 \* 3\. SyntropicBufferBar: Dual-chamber Higher-Self Escrow (amber) \-\> Exploration Reserve (emerald) \+ Gate g\_escrow  
 \* 4\. GraduationAscentAura: Ray-7 Violet (\#b84dff) corona & mastery ring when H\_system \>= 0.95  
 \*  
 \* Pure deterministic view-model projection \+ React HUD blade (RULES 8a).  
 \*/

import { StateIdx } from '../../../../../packages/harness/src/types';

export interface IHarnessHudViewModel {  
  /\*\* Attractor Trench Widget \*/  
  readonly trenchDepthNorm: number;       // \[0..1\] normalized well depth  
  readonly piPrior: number;               // Precision weight  
  readonly latchLogOdds: number;          // \[-127..+127\]  
  readonly breakerAnnealingActive: boolean;  
  readonly trenchColorHex: '\#3dc8ff' \| '\#ffc13d' \| '\#ff3d8a';  
  readonly svgWellPathD: string;          // 120x44 SVG quadratic/Gaussian potential well curve

  /\*\* Cybernetic Mirror R Widget \*/  
  readonly mirrorErrorNorm: number;       // \[0..1\]  
  readonly awarenessRatio: number;        // A(t) / A\_relative in \[0..1\]  
  readonly phaseLockDeg: number;          // \[0..180\] angular phase offset between inner & outer reticle rings  
  readonly scanlineGlitchOpacity: number; // \[0..0.85\]

  /\*\* Syntropic Buffer B\_syntropic Widget \*/  
  readonly escrowBalanceJ: number;  
  readonly explorationReserveJ: number;  
  readonly escrowGateOpenRatio: number;   // g\_escrow in \[0..1\]

  /\*\* Graduation G\_ascent Aura Widget \*/  
  readonly coherenceH: number;            // H\_system in \[0..1\]  
  readonly masteryProgressRatio: number;  // \[0..1\]  
  readonly graduatedRay7AuraActive: boolean;  
  readonly auraHex: '\#3dc8ff' \| '\#3eff8b' \| '\#b84dff';  
}

/\*\*  
 \* Pure deterministic projection from the 24-float state vector and syntropic buffer  
 \* into the 4 HUD widget view-models (callable in both headless tests and 60 FPS React HUD).  
 \*/  
export function computeHarnessHudViewModel(  
  stateVec: Float32Array,  
  syntropicBuffer: Float64Array,  
  latchLogOdds: number,  
  masteryElapsedSec: number,  
  masteryRequiredSec: number,  
  relativeAwarenessCap: number,  
  targetTrueX \= 0.0,  
): IHarnessHudViewModel {  
  const qx \= stateVec\[StateIdx.Q\_X\];  
  const muPrior \= stateVec\[StateIdx.MU\_PXD\];  
  const piPrior \= stateVec\[StateIdx.PI\_PRIOR\];  
  const awareness \= stateVec\[StateIdx.A\_AWARE\];  
  const ftle \= stateVec\[StateIdx.LAMBDA\_FTLE\];  
  const coherenceH \= stateVec\[StateIdx.H\_COHERENCE\];

  // 1\. Attractor Trench Depth & SVG Potential Curve (120x44 px)  
  const rawTrenchJ \= 0.5 \* piPrior \* (qx \- muPrior) \* (qx \- muPrior) \+ 0.15 \* Math.max(0, piPrior \- 1.5);  
  const trenchDepthNorm \= Math.min(1.0, rawTrenchJ / 25.0);  
  const breakerAnnealingActive \= ftle \> 0.18 && piPrior \< 8.0;  
  const trenchColorHex \=  
    piPrior \> 10.0 ? '\#ff3d8a' : breakerAnnealingActive ? '\#ffc13d' : '\#3dc8ff';

  const wellCenterPx \= Math.max(16, Math.min(104, Math.round(60 \+ (muPrior \- targetTrueX) \* 14)));  
  const wellDipPx \= Math.round(6 \+ 34 \* trenchDepthNorm);  
  const wellWidthPx \= Math.max(6, Math.round(28 / Math.sqrt(Math.max(0.5, piPrior \* 0.25))));  
  const xL \= Math.max(4, wellCenterPx \- wellWidthPx);  
  const xR \= Math.min(116, wellCenterPx \+ wellWidthPx);  
  const svgWellPathD \= \`M 0 6 L \${xL} 6 Q \${wellCenterPx} \${wellDipPx} \${xR} 6 L 120 6\`;

  // 2\. Cybernetic Mirror R Discrepancy & Phase Reticle  
  const mirrorDiscrepancy \= Math.abs((qx \- targetTrueX) \+ awareness \* (muPrior \- targetTrueX));  
  const mirrorErrorNorm \= Math.min(1.0, mirrorDiscrepancy / 2.5);  
  const awarenessRatio \= Math.min(1.0, awareness / Math.max(0.05, relativeAwarenessCap));  
  const phaseLockDeg \= Math.round(mirrorErrorNorm \* 180.0);  
  const scanlineGlitchOpacity \= Number((mirrorErrorNorm \* 0.85).toFixed(3));

  // 3\. Syntropic Buffer Escrow & Exploration Reserve  
  const escrowBalanceJ \= syntropicBuffer\[0\];  
  const explorationReserveJ \= stateVec\[StateIdx.E\_RESERVE\];  
  const escrowGateOpenRatio \= Math.min(1.0, Math.exp(-piPrior / 1.5));

  // 4\. Graduation G\_ascent Ray-7 Violet Aura  
  const masteryProgressRatio \= Math.min(1.0, masteryElapsedSec / Math.max(0.1, masteryRequiredSec));  
  const graduatedRay7AuraActive \= masteryProgressRatio \>= 1.0 && coherenceH \>= 0.95;  
  const auraHex \= graduatedRay7AuraActive  
    ? '\#b84dff'  
    : coherenceH \>= 0.90  
      ? '\#3eff8b'  
      : '\#3dc8ff';

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
