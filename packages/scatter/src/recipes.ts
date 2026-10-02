import { IDENTITY, TAU, axisAngle, leanDir, mulQuat, tiltQuat, varyColor, yawQuat, type Quat } from './recipe-math';
import { mixSeed, mulberry32 } from './rng';
import type { Vec3 } from './types';

/**
 * One drawable primitive of a prop, in prop space (origin on the ground, +Y up).
 * Geometry convention: sphere radius = size; box edge = size; cylinder radius = size and height = 1.
 * The final extents are the unit geometry times `scale` (prop scale already included), so a cylinder's
 * scale.y is its length in metres. `rotation` is a unit quaternion [x, y, z, w].
 */
export interface PartRecipe {
  shape: 'sphere' | 'box' | 'cylinder';
  size: number;
  position: Vec3;
  rotation: readonly [number, number, number, number];
  scale: Vec3;
  color: string;
  roughness: number;
  metalness: number;
}

export const RECIPE_IDS: readonly string[] = ['palm', 'bush', 'tuft', 'boulder', 'tiki', 'reeds', 'log'];

type Rng = () => number;
/** Builds a part from unit-prop coordinates, applying the uniform prop scale to position and scale. */
type Mk = (shape: PartRecipe['shape'], size: number, pos: Vec3, rot: Quat, stretch: Vec3, color: string, roughness?: number) => PartRecipe;
type Builder = (rng: Rng, mk: Mk) => PartRecipe[];

const maker =
  (s: number): Mk =>
  (shape, size, pos, rot, stretch, color, roughness = 0.85) => ({
    shape,
    size,
    position: [pos[0] * s, pos[1] * s, pos[2] * s],
    rotation: rot,
    scale: [stretch[0] * s, stretch[1] * s, stretch[2] * s],
    color,
    roughness,
    metalness: 0,
  });

const times = (d: Vec3, k: number): Vec3 => [d[0] * k, d[1] * k, d[2] * k];

const palm: Builder = (rng, mk) => {
  const height = 4.6 + rng() * 0.8;
  const az = rng() * TAU;
  const lean = 0.04 + rng() * 0.1;
  const dir = leanDir(az, lean);
  const top = times(dir, height);
  const parts = [mk('cylinder', 0.12, times(dir, height / 2), tiltQuat(az, lean), [1, height, 1], varyColor('#7a5a3a', rng, 0.1))];
  const fronds = 5 + Math.floor(rng() * 3);
  const phase = rng() * TAU;
  for (let i = 0; i < fronds; i++) {
    const a = phase + (i / fronds) * TAU;
    const droop = 0.25 + rng() * 0.25;
    const rot = mulQuat(yawQuat(-a), axisAngle(0, 0, 1, -droop));
    const pos: Vec3 = [top[0] + Math.cos(a) * 0.55, top[1] + 0.12 - droop * 0.3, top[2] + Math.sin(a) * 0.55];
    parts.push(mk('sphere', 0.5, pos, rot, [1.5, 0.16, 0.55], varyColor('#2f7d3a', rng, 0.18)));
  }
  const nuts = 2 + Math.floor(rng() * 2);
  for (let i = 0; i < nuts; i++) {
    const b = rng() * TAU;
    const pos: Vec3 = [top[0] + Math.cos(b) * 0.16, top[1] - 0.2 - rng() * 0.08, top[2] + Math.sin(b) * 0.16];
    parts.push(mk('sphere', 0.1, pos, IDENTITY, [1, 1, 1], varyColor('#5a3b1f', rng, 0.1), 0.55));
  }
  return parts;
};

const bush: Builder = (rng, mk) => {
  const n = 3 + Math.floor(rng() * 2);
  const phase = rng() * TAU;
  const parts: PartRecipe[] = [];
  for (let i = 0; i < n; i++) {
    const a = phase + (i / n) * TAU + (rng() - 0.5) * 0.6;
    const off = 0.12 + rng() * 0.22;
    const r = 0.36 + rng() * 0.16;
    const sy = 0.78 + rng() * 0.17;
    const pos: Vec3 = [Math.cos(a) * off, r * sy, Math.sin(a) * off];
    parts.push(mk('sphere', r, pos, IDENTITY, [1, sy, 1], varyColor('#3a8a3c', rng, 0.16), 0.9));
  }
  return parts;
};

const tuft: Builder = (rng, mk) => {
  const n = 5 + Math.floor(rng() * 3);
  const phase = rng() * TAU;
  const parts: PartRecipe[] = [];
  for (let i = 0; i < n; i++) {
    const a = phase + (i / n) * TAU + (rng() - 0.5) * 0.4;
    const lean = 0.15 + rng() * 0.4;
    const h = 0.45 + rng() * 0.35;
    const w = 0.045 + rng() * 0.02;
    const d = times(leanDir(a, lean), h / 2);
    const pos: Vec3 = [Math.cos(a) * 0.05 + d[0], d[1], Math.sin(a) * 0.05 + d[2]];
    const rot = mulQuat(tiltQuat(a, lean), yawQuat(Math.PI / 2 - a)); // blade faces outwards, then leans
    parts.push(mk('box', 1, pos, rot, [w, h, 0.015], varyColor('#5a9a3a', rng, 0.14), 0.9));
  }
  return parts;
};

const boulder: Builder = (rng, mk) => {
  const n = 1 + Math.floor(rng() * 3);
  const parts: PartRecipe[] = [];
  for (let i = 0; i < n; i++) {
    const r = i === 0 ? 0.5 + rng() * 0.12 : 0.28 + rng() * 0.16;
    const a = rng() * TAU;
    const off = i === 0 ? 0 : 0.35 + rng() * 0.15;
    const sy = 0.6 + rng() * 0.2;
    const pos: Vec3 = [Math.cos(a) * off, r * sy * 0.95, Math.sin(a) * off];
    const stretch: Vec3 = [1 + rng() * 0.25, sy, 0.85 + rng() * 0.2];
    parts.push(mk('sphere', r, pos, yawQuat(rng() * TAU), stretch, varyColor('#7d7a74', rng, 0.09), 0.9));
  }
  return parts;
};

const tiki: Builder = (rng, mk) => {
  const poleH = 1.9 + rng() * 0.4;
  const headH = 0.5 + rng() * 0.12;
  const headY = poleH + headH / 2;
  const eye = '#f0e6d2';
  return [
    mk('cylinder', 0.2, [0, poleH / 2, 0], IDENTITY, [1, poleH, 1], varyColor('#6b4a2d', rng, 0.08), 0.8),
    mk('box', 1, [0, headY, 0], IDENTITY, [0.62, headH, 0.55], varyColor('#6b4a2d', rng, 0.08), 0.8),
    mk('sphere', 0.06, [-0.14, headY + 0.06, 0.28], IDENTITY, [1, 1, 0.6], eye, 0.5),
    mk('sphere', 0.06, [0.14, headY + 0.06, 0.28], IDENTITY, [1, 1, 0.6], eye, 0.5),
  ];
};

const reeds: Builder = (rng, mk) => {
  const n = 6 + Math.floor(rng() * 4);
  const parts: PartRecipe[] = [];
  for (let i = 0; i < n; i++) {
    const a = rng() * TAU;
    const off = rng() * 0.3;
    const az = rng() * TAU;
    const lean = 0.05 + rng() * 0.25;
    const h = 0.9 + rng() * 0.7;
    const d = times(leanDir(az, lean), h / 2);
    const pos: Vec3 = [Math.cos(a) * off + d[0], d[1], Math.sin(a) * off + d[2]];
    parts.push(mk('cylinder', 0.022 + rng() * 0.01, pos, tiltQuat(az, lean), [1, h, 1], varyColor('#6f9a42', rng, 0.12), 0.85));
  }
  return parts;
};

const log: Builder = (rng, mk) => {
  const r = 0.16 + rng() * 0.06;
  const len = 1.4 + rng() * 0.4;
  const lying = axisAngle(0, 0, 1, Math.PI / 2); // cylinder axis Y -> X: horizontal
  const end = len / 2 + 0.005;
  const cut = varyColor('#b08a5a', rng, 0.08);
  return [
    mk('cylinder', r, [0, r, 0], lying, [1, len, 1], varyColor('#6e4b2a', rng, 0.1), 0.9),
    mk('cylinder', r * 0.92, [-end, r, 0], lying, [1, 0.03, 1], cut, 0.8),
    mk('cylinder', r * 0.92, [end, r, 0], lying, [1, 0.03, 1], cut, 0.8),
  ];
};

const BUILDERS = new Map<string, Builder>([
  ['palm', palm],
  ['bush', bush],
  ['tuft', tuft],
  ['boulder', boulder],
  ['tiki', tiki],
  ['reeds', reeds],
  ['log', log],
]);

/**
 * Parts of prop `id` at uniform `scale`; `seed` varies colours, lean and counts slightly.
 * Unknown ids, and scales that are not finite and > 0 (a zero-size prop has nothing to draw), give [].
 */
export function recipeParts(id: string, scale: number, seed: number): PartRecipe[] {
  const build = BUILDERS.get(id);
  if (!build || !Number.isFinite(scale) || scale <= 0) return [];
  return build(mulberry32(mixSeed(seed, RECIPE_IDS.indexOf(id))), maker(scale));
}
