// Grass that bends in the wind and gets flattened where things walk (from the SetMix Arena drop).
/* ════════════════════════════════════════ 6 · GRASS: WIND + WAKE ══ */

export interface GrassConfig {
  bladesPerM2: number;
  heightM: number;
  /** metres — Gerstner wavelength of the big rolling gusts */
  gustWavelength: number;
  gustSpeed: number;
  /** resolution of the dynamic flow canvas */
  wakeResolution: number;
  /** metres covered by the wake canvas, centred on the player */
  wakeExtentM: number;
  /** seconds for a flattened blade to spring back */
  recoverySec: number;
}

export const GRASS_DEFAULT: GrassConfig = {
  bladesPerM2: 42, heightM: 0.55, gustWavelength: 34, gustSpeed: 6.2,
  wakeResolution: 256, wakeExtentM: 64, recoverySec: 2.4,
};

/**
 *  THE WAKE CANVAS
 *  A single R8 texture centred on the player. Agents stamp a soft radial
 *  dent; every frame the whole canvas relaxes back toward zero. The grass
 *  shader reads it as a displacement field.
 *
 *  Why a canvas and not per-blade state: a blade has no identity. There are
 *  four million of them and they are generated in the vertex shader from
 *  gl_InstanceID. The only thing with identity is the DENT, and dents are
 *  sparse — so we store the sparse thing.
 */
export interface WakeField {
  res: number;
  extentM: number;
  data: Float32Array;
  /** world centre of the canvas */
  cx: number;
  cz: number;
}

export function makeWake(cfg: GrassConfig = GRASS_DEFAULT): WakeField {
  return {
    res: cfg.wakeResolution, extentM: cfg.wakeExtentM,
    data: new Float32Array(cfg.wakeResolution * cfg.wakeResolution), cx: 0, cz: 0,
  };
}

export function stampWake(
  w: WakeField, x: number, z: number, radiusM: number, strength = 1,
): void {
  const half = w.extentM / 2;
  const u = ((x - w.cx + half) / w.extentM) * w.res;
  const v = ((z - w.cz + half) / w.extentM) * w.res;
  const rp = (radiusM / w.extentM) * w.res;
  const x0 = Math.max(0, Math.floor(u - rp)), x1 = Math.min(w.res - 1, Math.ceil(u + rp));
  const z0 = Math.max(0, Math.floor(v - rp)), z1 = Math.min(w.res - 1, Math.ceil(v + rp));
  for (let j = z0; j <= z1; j++)
    for (let i = x0; i <= x1; i++) {
      const d = Math.hypot(i - u, j - v) / Math.max(1e-3, rp);
      if (d > 1) continue;
      const f = (1 - d * d) * strength;
      const k = j * w.res + i;
      if (f > w.data[k]!) w.data[k] = Math.min(1, f);
    }
}

/** Exponential relaxation — springs back, never snaps. */
export function relaxWake(w: WakeField, dt: number, cfg: GrassConfig = GRASS_DEFAULT): void {
  const k = Math.exp(-dt / cfg.recoverySec);
  const d = w.data;
  for (let i = 0; i < d.length; i++) d[i]! *= k;
}

/** Re-centre on the player; shifting by whole texels keeps it artefact-free. */
export function recentreWake(w: WakeField, x: number, z: number): void {
  const texel = w.extentM / w.res;
  const nx = Math.round(x / texel) * texel;
  const nz = Math.round(z / texel) * texel;
  const dx = Math.round((nx - w.cx) / texel);
  const dz = Math.round((nz - w.cz) / texel);
  if (!dx && !dz) return;
  const src = w.data.slice();
  w.data.fill(0);
  for (let j = 0; j < w.res; j++) {
    const sj = j + dz;
    if (sj < 0 || sj >= w.res) continue;
    for (let i = 0; i < w.res; i++) {
      const si = i + dx;
      if (si < 0 || si >= w.res) continue;
      w.data[j * w.res + i] = src[sj * w.res + si]!;
    }
  }
  w.cx = nx; w.cz = nz;
}
