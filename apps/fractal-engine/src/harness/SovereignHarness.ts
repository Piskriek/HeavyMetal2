/**
 * SovereignHarness.ts — Grounded 24-Float Port-Hamiltonian Sovereign Reality Harness
 * Direct integration of Plan 46 Spike 8 verified mechanics.
 */
import type { SovereignTelemetry } from '../rungs/RungTypes';

export class SovereignHarness {
  // 24-Float Flat State Vector
  public readonly x: Float64Array = new Float64Array(24);

  // Vessel Presets
  private readonly massKg: number = 2.0;
  private readonly stiffnessNpm: number = 8.0;
  private readonly dampingNspm: number = 1.4;
  private readonly awarenessBound: number = 0.65;
  private readonly limbL1: number = 0.70;
  private readonly limbL2: number = 0.70;
  private readonly annealAlpha: number = 18.0;
  private readonly flowBeta: number = 2.4;
  private readonly lyapunovCrit: number = 0.18;

  // Syntropic Buffer
  public escrowJoules: number = 0.0;
  public absorbedJoules: number = 0.0;
  public reserveJoules: number = 5.0;

  // Mastery timer for graduation
  private masteryTimerSec: number = 0.0;
  public isGraduated: boolean = false;

  constructor() {
    this.reset();
  }

  public reset(): void {
    this.x.fill(0);
    // Initial generative priors
    this.x[12] = 0.25; // Pxd
    this.x[13] = 0.50; // Vtx
    this.x[14] = 0.75; // Lx
    this.x[15] = 0.10; // Aq
    // Precision diagonal
    this.x[16] = 1.5; // Pi_kin
    this.x[17] = 1.0; // Pi_therm
    this.x[18] = 0.8; // Pi_acoust
    this.x[19] = 1.5; // Pi_prior
    // Awareness and Coherence
    this.x[20] = 0.12; // A_aware
    this.x[23] = 0.95; // H_coherence
  }

  /**
   * Symplectic Port-Hamiltonian Step
   */
  public step(dt: number, externalAttractor?: { x: number; y: number; z: number }): SovereignTelemetry {
    const qx = this.x[0];
    const qy = this.x[1];
    const qz = this.x[2];
    let px = this.x[3];
    let py = this.x[4];
    let pz = this.x[5];

    // Awareness growth bounded by vessel relative awareness
    if (this.x[20] < this.awarenessBound) {
      this.x[20] = Math.min(this.awarenessBound, this.x[20] + 0.02 * dt);
    }
    const aware = this.x[20];

    // Attractor target
    const targetX = externalAttractor ? externalAttractor.x : 0.0;
    const targetY = externalAttractor ? externalAttractor.y : 0.0;
    const targetZ = externalAttractor ? externalAttractor.z : 0.0;

    // Harmonic restoring force (skew-symmetric J) + Damping (R)
    const errX = qx - targetX;
    const errY = qy - targetY;
    const errZ = qz - targetZ;

    const forceX = -this.stiffnessNpm * errX - this.dampingNspm * (px / this.massKg);
    const forceY = -this.stiffnessNpm * errY - this.dampingNspm * (py / this.massKg);
    const forceZ = -this.stiffnessNpm * errZ - this.dampingNspm * (pz / this.massKg);

    // Symplectic momentum and position integration
    px += forceX * dt;
    py += forceY * dt;
    pz += forceZ * dt;

    this.x[0] += (px / this.massKg) * dt;
    this.x[1] += (py / this.massKg) * dt;
    this.x[2] += (pz / this.massKg) * dt;

    this.x[3] = px;
    this.x[4] = py;
    this.x[5] = pz;

    // 3D Capture Point xi = q + v / omega0
    const omega0 = Math.sqrt(9.81 / Math.max(0.1, 0.45 + qy));
    const vx = px / this.massKg;
    const vz = pz / this.massKg;
    this.x[6] = this.x[0] + vx / omega0;
    this.x[7] = this.x[2] + vz / omega0;

    // Conformal G_{4,1} knee IK altitude: h_IK = sqrt(L1^2 - (supportRadius)^2)
    const planarR = Math.sqrt(errX * errX + errZ * errZ) * 0.25;
    const legSpan = Math.min(this.limbL1 * 0.98, planarR);
    this.x[8] = Math.sqrt(Math.max(0.01, this.limbL1 * this.limbL1 - legSpan * legSpan));

    // Elastic Strain energy: 0.5 * k * err^2
    const strainJ = 0.5 * this.stiffnessNpm * (errX * errX + errY * errY + errZ * errZ);
    this.x[9] = strainJ;

    // Thermal dissipation energy: integral of R * v^2
    const vSq = vx * vx + (py / this.massKg) * (py / this.massKg) + vz * vz;
    const heatIncrement = this.dampingNspm * vSq * dt;
    this.x[10] += heatIncrement;

    // Precision Annealing ODE (Pi_prior): release rigid priors continuously
    const piPrior = this.x[19];
    const lyapunov = Math.abs(errX) * 0.42;
    this.x[22] = lyapunov;

    // Differential annealing without hard clamps
    const sigAnneal = 1.0 / (1.0 + Math.exp(-(lyapunov - this.lyapunovCrit) * 10.0));
    const dPi = -this.annealAlpha * sigAnneal * piPrior + this.flowBeta * (1.5 - piPrior);
    this.x[19] = Math.max(0.05, piPrior + dPi * dt);

    // Syntropic Transmutation: harvest dissipated strain into reserve exploration pool
    if (strainJ > 0.01) {
      const harvested = heatIncrement * 0.85;
      this.reserveJoules += harvested;
      this.absorbedJoules += harvested;
    }
    this.x[11] = this.reserveJoules;

    // System Coherence: H = exp(-strain / 5.0) * (1 - min(1, lyapunov))
    const coherence = Math.max(0.0, Math.min(1.0, Math.exp(-strainJ / 2.0) * Math.max(0.1, 1.0 - lyapunov * 0.5)));
    this.x[23] = coherence;

    // Graduation test
    if (coherence >= 0.95) {
      this.masteryTimerSec += dt;
      if (this.masteryTimerSec >= 1.5) {
        this.isGraduated = true;
      }
    } else {
      this.masteryTimerSec = Math.max(0, this.masteryTimerSec - dt * 0.5);
    }

    return {
      q: [this.x[0], this.x[1], this.x[2]],
      p: [this.x[3], this.x[4], this.x[5]],
      xi: [this.x[6], this.x[7], this.x[8]],
      strainJoules: this.x[9],
      thermalJoules: this.x[10],
      reserveJoules: this.x[11],
      fourFloats: [this.x[12], this.x[13], this.x[14], this.x[15]],
      awareness: aware,
      distortion: this.x[21],
      lyapunovFTLE: this.x[22],
      coherence: this.x[23],
      graduated: this.isGraduated,
    };
  }
}

