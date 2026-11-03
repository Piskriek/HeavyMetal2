import * as THREE from 'three';

export type DensityLevel = 'D1' | 'D2' | 'D3' | 'D4' | 'D5' | 'D6' | 'D7';

export interface SovereignTelemetry {
  readonly q: readonly [number, number, number];
  readonly p: readonly [number, number, number];
  readonly xi: readonly [number, number, number]; // [xi_x, xi_z, h_IK]
  readonly strainJoules: number;
  readonly thermalJoules: number;
  readonly reserveJoules: number;
  readonly fourFloats: readonly [number, number, number, number]; // [Pxd, Vtx, Lx, Aq]
  readonly awareness: number;
  readonly distortion: number;
  readonly lyapunovFTLE: number;
  readonly coherence: number;
  readonly graduated: boolean;
}

export interface IRungNode extends THREE.Object3D {
  readonly rungIndex: number;
  readonly density: DensityLevel;
  readonly rungName: string;
  readonly scaleRangeM: readonly [number, number];
  update(time: number, dt: number, telemetry: SovereignTelemetry): void;
  setTransitionAlpha(alpha: number, isDirectFocus: boolean): void;
}

