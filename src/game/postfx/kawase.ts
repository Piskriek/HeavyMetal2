/**
 * IF-POSTFX: Dual-Kawase bloom downsample and upsample passes.
 * High-performance, wide-radius bloom with minimal GPU cost.
 */

import * as THREE from 'three';

export const KAWASE_OFFSETS = [0.5, 1.5, 2.5, 3.5];

export interface KawaseLevel {
  rtDown: THREE.WebGLRenderTarget;
  rtUp: THREE.WebGLRenderTarget;
  width: number;
  height: number;
}

export function createKawasePyramid(
  width: number,
  height: number,
  levels = 4,
): KawaseLevel[] {
  const pyramid: KawaseLevel[] = [];
  let w = Math.max(2, Math.floor(width / 2));
  let h = Math.max(2, Math.floor(height / 2));

  const options: THREE.RenderTargetOptions = {
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: false,
    stencilBuffer: false,
  };

  for (let i = 0; i < levels; i++) {
    pyramid.push({
      rtDown: new THREE.WebGLRenderTarget(w, h, options),
      rtUp: new THREE.WebGLRenderTarget(w, h, options),
      width: w,
      height: h,
    });
    w = Math.max(2, Math.floor(w / 2));
    h = Math.max(2, Math.floor(h / 2));
  }

  return pyramid;
}

export function disposeKawasePyramid(pyramid: KawaseLevel[]): void {
  for (const level of pyramid) {
    level.rtDown.dispose();
    level.rtUp.dispose();
  }
}
