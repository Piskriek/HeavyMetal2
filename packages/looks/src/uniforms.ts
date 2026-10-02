import { Vec3, LookParams } from './types';
import { hexToLinear } from './colour';
import { sunDirection, sunColor } from './sun';

export interface LookUniforms {
  sunDir: Vec3;
  sunColor: Vec3;
  skyZenith: Vec3;
  skyHorizon: Vec3;
  skyGround: Vec3;
  ambientSky: Vec3;
  ambientGround: Vec3;
  ambientIntensity: number;
  fogColor: Vec3;
  fogDensity: number;
  exposure: number;
  bloom: number;
  saturation: number;
  contrast: number;
  vignette: number;
  waterColor: Vec3;
  waterOpacity: number;
  cloudCover: number;
}

export function lookToUniforms(p: LookParams): LookUniforms {
  return {
    sunDir: sunDirection(p.sunElevation, p.sunAzimuth),
    sunColor: sunColor(p),
    skyZenith: hexToLinear(p.skyZenith),
    skyHorizon: hexToLinear(p.skyHorizon),
    skyGround: hexToLinear(p.skyGround),
    ambientSky: hexToLinear(p.ambientSky),
    ambientGround: hexToLinear(p.ambientGround),
    ambientIntensity: p.ambientIntensity,
    fogColor: hexToLinear(p.fogColor),
    fogDensity: p.fogDensity,
    exposure: p.exposure,
    bloom: p.bloom,
    saturation: p.saturation,
    contrast: p.contrast,
    vignette: p.vignette,
    waterColor: hexToLinear(p.waterColor),
    waterOpacity: p.waterOpacity,
    cloudCover: p.cloudCover
  };
}
