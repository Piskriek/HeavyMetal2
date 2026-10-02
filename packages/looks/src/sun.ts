import { Vec3, LookParams } from './types';
import { kelvinToRgb } from './colour';

export function sunDirection(elevationDeg: number, azimuthDeg: number): Vec3 {
  const el = (elevationDeg * Math.PI) / 180;
  const az = (azimuthDeg * Math.PI) / 180;

  return [
    Math.cos(el) * Math.sin(az),
    Math.sin(el),
    -Math.cos(el) * Math.cos(az)
  ];
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export function sunColor(p: LookParams): Vec3 {
  const baseColor = kelvinToRgb(p.sunKelvin);
  const fade = smoothstep(-6, 2, p.sunElevation);
  const factor = p.sunIntensity * fade;

  return [
    baseColor[0] * factor,
    baseColor[1] * factor,
    baseColor[2] * factor
  ];
}
