/* ============================================================================
 *  packages/goblin-controller/src/AvatarFidelityManager.ts
 *  ---------------------------------------------------------------------------
 *  48 TRIANGLES → 48,000, WITHOUT A SINGLE ASSET SWAP THE PLAYER CAN SEE.
 *
 *  Four subsystems, each of which is OFF at Stage 1 and fades in on its own
 *  schedule, so the avatar never visibly "upgrades" — it accumulates:
 *
 *    · two-bone analytical IK      (Vtx — needs slopes to stand on)
 *    · procedural head-look        (Lx  — needs to be able to see)
 *    · Verlet cape                 (Vtx + wind)
 *    · material accumulation       (Aq  — mud, wetness, wear)
 *
 *  Pure. Fixed-step. No DOM, no clock, no RNG.
 * ==========================================================================*/

import type { FidelityState } from "./contracts.setmix";
import { normalised } from "./fidelity";

export type Vec3 = [number, number, number];

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const clamp01 = (v: number) => clamp(v, 0, 1);
const smooth = (u: number) => { const t = clamp01(u); return t * t * (3 - 2 * t); };
const sub3 = (a: Vec3, b: Vec3): Vec3 => [a[0]-b[0], a[1]-b[1], a[2]-b[2]];
const add3 = (a: Vec3, b: Vec3): Vec3 => [a[0]+b[0], a[1]+b[1], a[2]+b[2]];
const mul3 = (a: Vec3, s: number): Vec3 => [a[0]*s, a[1]*s, a[2]*s];
const len3 = (a: Vec3) => Math.hypot(a[0], a[1], a[2]);
const norm3 = (a: Vec3): Vec3 => { const l = len3(a) || 1; return [a[0]/l, a[1]/l, a[2]/l]; };
const dot3 = (a: Vec3, b: Vec3) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
const cross3 = (a: Vec3, b: Vec3): Vec3 =>
  [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];

/* ═══════════════════════════════════════════ 1 · TWO-BONE ANALYTICAL IK ══ */

export interface IKResult {
  hip: Vec3;
  knee: Vec3;
  foot: Vec3;
  /** true when the target was out of reach and the chain is fully extended */
  stretched: boolean;
  /** knee bend in degrees, for the animation blend */
  bendDeg: number;
}

/**
 *  Law of cosines. No iteration, no CCD, no FABRIK — a two-bone chain has a
 *  closed-form solution and running an iterative solver on it is a tell that
 *  somebody reached for a library instead of a textbook.
 *
 *    cosθ = (L1² + d² − L2²) / (2·L1·d)
 *
 *  `poleDir` disambiguates the circle of valid knee positions: knees bend
 *  forward, so the pole is the character's facing vector.
 */
export function solveTwoBoneIK(
  hip: Vec3, target: Vec3, upperLen: number, lowerLen: number, poleDir: Vec3,
): IKResult {
  const toTarget = sub3(target, hip);
  const d = len3(toTarget);
  const maxReach = upperLen + lowerLen;
  const stretched = d >= maxReach - 1e-4;
  const dc = clamp(d, Math.abs(upperLen - lowerLen) + 1e-4, maxReach - 1e-4);
  const dir = norm3(toTarget);

  // project the pole perpendicular to the limb axis → the bend plane
  const poleN = norm3(poleDir);
  let bendAxis = sub3(poleN, mul3(dir, dot3(poleN, dir)));
  if (len3(bendAxis) < 1e-4) {
    // degenerate: pole parallel to the limb. Pick any perpendicular.
    const alt: Vec3 = Math.abs(dir[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    bendAxis = sub3(alt, mul3(dir, dot3(alt, dir)));
  }
  bendAxis = norm3(bendAxis);

  const cosA = clamp((upperLen*upperLen + dc*dc - lowerLen*lowerLen) / (2*upperLen*dc), -1, 1);
  const a = Math.acos(cosA);
  const along = Math.cos(a) * upperLen;
  const out = Math.sin(a) * upperLen;

  const knee = add3(hip, add3(mul3(dir, along), mul3(bendAxis, out)));
  const foot = stretched ? add3(hip, mul3(dir, maxReach)) : target;

  const u = norm3(sub3(hip, knee));
  const l = norm3(sub3(foot, knee));
  const bendDeg = Math.acos(clamp(dot3(u, l), -1, 1)) * (180 / Math.PI);

  return { hip, knee, foot, stretched, bendDeg };
}

export interface FootPlant {
  /** world target after ground probe + offset */
  target: Vec3;
  /** surface normal, used to roll the ankle */
  normal: Vec3;
  /** 0 planted … 1 fully lifted */
  lift: number;
  /** degrees of ankle pitch required */
  ankleDeg: number;
}

/**
 *  Foot placement on sloped voxels. The ray is cast from the *animated* foot
 *  position, not from the hip, so the IK corrects the animation rather than
 *  replacing it — which is the difference between "grounded" and "sliding".
 */
export function planFootPlant(
  animFoot: Vec3, height: (x: number, z: number) => number,
  blend: number, maxDropM = 0.55,
): FootPlant {
  const gy = height(animFoot[0], animFoot[2]);
  const delta = clamp(gy - animFoot[1], -maxDropM, maxDropM);
  const e = 0.22;
  const dx = height(animFoot[0] + e, animFoot[2]) - height(animFoot[0] - e, animFoot[2]);
  const dz = height(animFoot[0], animFoot[2] + e) - height(animFoot[0], animFoot[2] - e);
  const normal = norm3([-dx, 2 * e, -dz]);
  const lift = clamp01((animFoot[1] - gy) / 0.4);
  return {
    target: [animFoot[0], animFoot[1] + delta * blend * (1 - lift), animFoot[2]],
    normal,
    lift,
    ankleDeg: Math.acos(clamp(normal[1], -1, 1)) * (180 / Math.PI) * blend,
  };
}

/* ═══════════════════════════════════════════════ 2 · PROCEDURAL HEAD-LOOK ══ */

export interface PointOfInterest {
  id: string;
  pos: Vec3;
  /** spires 1.0, crystals 0.8, hazards 1.4, other players 1.6 */
  weight: number;
  kind: "SPIRE" | "CRYSTAL" | "HAZARD" | "PORTAL" | "PLAYER" | "MACHINE";
}

export interface HeadLookState {
  /** current aim direction, smoothed */
  dir: Vec3;
  targetId: string | null;
  /** 0..1 — how much the neck is actually turned */
  weight: number;
  yawDeg: number;
  pitchDeg: number;
}

const NECK_YAW_LIMIT = 72;
const NECK_PITCH_LIMIT = 38;

/**
 *  Scores every POI by weight / distance², gated by a cone in front of the
 *  character, then critically-damps the neck toward the winner. The gaze is
 *  clamped to real neck limits — an uncapped look-at is the single most
 *  common reason procedural head-look reads as "possessed".
 */
export function stepHeadLook(
  prev: HeadLookState, headPos: Vec3, facing: Vec3,
  pois: readonly PointOfInterest[], fi: FidelityState, dt: number,
): HeadLookState {
  const n = normalised(fi);
  // Lx gates this: at Stage 1 the avatar has no eyes and nothing to see by.
  const enable = smooth((n.lx - 0.12) / 0.3);
  if (enable <= 0.001)
    return { dir: facing, targetId: null, weight: 0, yawDeg: 0, pitchDeg: 0 };

  const f = norm3([facing[0], 0, facing[2]]);
  let best: PointOfInterest | null = null;
  let bestScore = 0;
  for (const poi of pois) {
    const to = sub3(poi.pos, headPos);
    const d = len3(to);
    if (d < 0.6 || d > 160) continue;
    const dirTo = mul3(to, 1 / d);
    const facingDot = dot3(norm3([dirTo[0], 0, dirTo[2]]), f);
    if (facingDot < 0.08) continue;                 // behind: necks do not swivel
    const score = (poi.weight * facingDot) / (d * d * 0.004 + 1);
    if (score > bestScore) { bestScore = score; best = poi; }
  }

  const desired = best ? norm3(sub3(best.pos, headPos)) : f;

  // yaw/pitch relative to facing, clamped to anatomy
  const right = norm3(cross3([0, 1, 0], f));
  let yaw = Math.atan2(dot3(desired, right), dot3(desired, f)) * (180 / Math.PI);
  let pitch = Math.asin(clamp(desired[1], -1, 1)) * (180 / Math.PI);
  const overYaw = Math.abs(yaw) > NECK_YAW_LIMIT;
  yaw = clamp(yaw, -NECK_YAW_LIMIT, NECK_YAW_LIMIT);
  pitch = clamp(pitch, -NECK_PITCH_LIMIT, NECK_PITCH_LIMIT);

  // critical damping: no overshoot, no spring wobble
  const k = 1 - Math.exp(-7.5 * dt);
  const targetW = best && !overYaw ? enable * clamp01(bestScore * 1.6) : 0;
  const weight = prev.weight + (targetW - prev.weight) * k;
  const dir = norm3([
    prev.dir[0] + (desired[0] - prev.dir[0]) * k,
    prev.dir[1] + (desired[1] - prev.dir[1]) * k,
    prev.dir[2] + (desired[2] - prev.dir[2]) * k,
  ]);

  return {
    dir, targetId: best?.id ?? null, weight,
    yawDeg: yaw * weight, pitchDeg: pitch * weight,
  };
}

/* ═══════════════════════════════════════════════════ 3 · THE VERLET CAPE ══ */

export interface ClothNode { p: Vec3; prev: Vec3; pinned: boolean }
export interface ClothState {
  nodes: ClothNode[];
  cols: number;
  rows: number;
  restX: number;
  restY: number;
  iterations: number;
}

export function makeCape(anchor: Vec3, cols = 6, rows = 8, w = 0.72, h = 0.95): ClothState {
  const nodes: ClothNode[] = [];
  const restX = w / (cols - 1), restY = h / (rows - 1);
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < cols; x++) {
      const p: Vec3 = [anchor[0] + (x - (cols - 1) / 2) * restX, anchor[1] - y * restY, anchor[2]];
      nodes.push({ p, prev: [...p] as Vec3, pinned: y === 0 });
    }
  return { nodes, cols, rows, restX, restY, iterations: 4 };
}

/**
 *  Position-based Verlet. Chosen over a spring-mass solver for three reasons:
 *  it is unconditionally stable at 120 Hz, velocity is implicit (so there is
 *  no separate state to desync on a save/load), and the constraint pass is
 *  trivially budgetable — Vtx simply buys more iterations.
 */
export function stepCape(
  cloth: ClothState, anchor: Vec3, anchorRight: Vec3,
  wind: Vec3, velocity: Vec3, fi: FidelityState, dt: number,
): ClothState {
  const n = normalised(fi);
  const enable = smooth((n.vtx - 0.2) / 0.3);
  if (enable <= 0.001) return cloth;    // no cape below Stage 2: no triangles for it

  const iterations = Math.max(1, Math.round(2 + n.vtx * 6));
  const nodes = cloth.nodes.map((nd) => ({ p: [...nd.p] as Vec3, prev: [...nd.prev] as Vec3, pinned: nd.pinned }));
  const g = -1.62;
  const damp = 0.986;

  // pin the top row to the shoulders
  for (let x = 0; x < cloth.cols; x++) {
    const nd = nodes[x];
    nd.p = add3(anchor, mul3(anchorRight, (x - (cloth.cols - 1) / 2) * cloth.restX));
    nd.prev = [...nd.p] as Vec3;
  }

  /* ── integrate ─────────────────────────────────────────────────── */
  for (let i = cloth.cols; i < nodes.length; i++) {
    const nd = nodes[i];
    const vx = (nd.p[0] - nd.prev[0]) * damp;
    const vy = (nd.p[1] - nd.prev[1]) * damp;
    const vz = (nd.p[2] - nd.prev[2]) * damp;
    nd.prev = [...nd.p] as Vec3;
    // wind + the character's own motion dragging the fabric
    const drag = 0.9 * enable;
    nd.p[0] += vx + (wind[0] * 0.018 - velocity[0] * 0.012) * drag * dt * 60;
    nd.p[1] += vy + g * dt * dt * 60;
    nd.p[2] += vz + (wind[2] * 0.018 - velocity[2] * 0.012) * drag * dt * 60;
  }

  /* ── constraints: structural + shear, Gauss-Seidel ─────────────── */
  const satisfy = (ia: number, ib: number, rest: number) => {
    const a = nodes[ia], b = nodes[ib];
    const d = sub3(b.p, a.p);
    const l = len3(d) || 1e-6;
    const diff = (l - rest) / l;
    const wa = a.pinned ? 0 : 0.5, wb = b.pinned ? 0 : 0.5;
    const s = wa + wb || 1;
    a.p = add3(a.p, mul3(d, diff * (wa / s)));
    b.p = sub3(b.p, mul3(d, diff * (wb / s)));
  };

  for (let it = 0; it < iterations; it++) {
    for (let y = 0; y < cloth.rows; y++)
      for (let x = 0; x < cloth.cols; x++) {
        const i = y * cloth.cols + x;
        if (x < cloth.cols - 1) satisfy(i, i + 1, cloth.restX);
        if (y < cloth.rows - 1) satisfy(i, i + cloth.cols, cloth.restY);
        // shear keeps the sheet from collapsing into a ribbon
        if (x < cloth.cols - 1 && y < cloth.rows - 1)
          satisfy(i, i + cloth.cols + 1, Math.hypot(cloth.restX, cloth.restY));
      }
  }

  return { ...cloth, nodes, iterations };
}

/* ═══════════════════════════════════════════ 4 · MESH & MATERIAL BUDGET ══ */

export interface AvatarBudget {
  /** triangle tier actually uploaded */
  triBudget: number;
  tier: "BLOCK" | "SEGMENTED" | "SKINNED" | "HERO";
  boneCount: number;
  /** subsystem enables, each a smooth 0..1 so nothing switches on visibly */
  ik: number;
  headLook: number;
  cape: number;
  blendshapes: number;
  /** shader uniforms consumed by the suit material */
  uniforms: {
    u_suitWear: number;
    u_mudLine: number;
    u_mudAmount: number;
    u_wetness: number;
    u_breathFog: number;
    u_visorReflect: number;
    u_emissiveTrim: number;
    u_sssDepth: number;
  };
  /** animation sampling, mirrored from the controller */
  animFps: number;
  /** 0 = hard 2-frame snap, 1 = full interpolation */
  animBlend: number;
}

/**
 *  The avatar's own fidelity ladder. Note it reads the SAME four metrics as
 *  the terrain, so the goblin cannot be more detailed than the ground it is
 *  standing on — which is what keeps the stylisation coherent at every rung
 *  instead of producing a hero character on a Minecraft planet.
 */
export function avatarBudget(fi: FidelityState, ctx: {
  distanceWalked: number; timeInMud: number; submersion: number; coldBiome: number;
}): AvatarBudget {
  const n = normalised(fi);
  const triBudget = Math.round(48 * Math.pow(1000, n.vtx));
  const tier: AvatarBudget["tier"] =
    triBudget < 400 ? "BLOCK" : triBudget < 4000 ? "SEGMENTED" : triBudget < 24000 ? "SKINNED" : "HERO";

  return {
    triBudget,
    tier,
    boneCount: tier === "BLOCK" ? 1 : tier === "SEGMENTED" ? 9 : tier === "SKINNED" ? 34 : 68,
    ik: smooth((n.vtx - 0.24) / 0.28),
    headLook: smooth((n.lx - 0.12) / 0.3),
    cape: smooth((n.vtx - 0.2) / 0.3),
    blendshapes: smooth((n.pxd - 0.55) / 0.3),
    uniforms: {
      // wear accumulates with distance and never resets — veteran goblins
      // look like veterans, and players stop cleaning their suits on purpose
      u_suitWear: clamp01(ctx.distanceWalked / 42000) * smooth(n.pxd / 0.4),
      u_mudLine: 0.18 + clamp01(ctx.timeInMud / 900) * 0.42,
      u_mudAmount: clamp01(ctx.timeInMud / 420) * smooth((n.aq - 0.2) / 0.4),
      u_wetness: clamp01(ctx.submersion * 1.3) * smooth((n.aq - 0.15) / 0.3),
      u_breathFog: ctx.coldBiome * smooth((n.lx - 0.45) / 0.3),
      u_visorReflect: smooth((n.lx - 0.08) / 0.35),
      u_emissiveTrim: smooth((n.pxd - 0.3) / 0.4),
      u_sssDepth: smooth((n.lx - 0.6) / 0.3) * 0.4,
    },
    animFps: Math.round(8 * Math.pow(7.5, n.vtx)),
    animBlend: smooth(n.vtx / 0.35),
  };
}

export const AVATAR_LADDER = [
  { tier: "BLOCK", tris: 48, bones: 1, note: "One box, a decal visor, a 2-frame walk snapping at 8 fps. No IK, no fingers, no neck. Position quantised to 0.25 m." },
  { tier: "SEGMENTED", tris: 420, bones: 9, note: "Limbs separate. 5-frame cycle at 15 fps, dithered albedo, a visor that samples one cubemap. The cape appears." },
  { tier: "SKINNED", tris: 2800, bones: 34, note: "Skeletal IK: the goblin finally stands correctly on a slope. Procedural head-look toward spires and crystals." },
  { tier: "HERO", tris: 48000, bones: 68, note: "Facial blendshapes, SSS, breath fog, mud that accumulates and does not wash off, raytraced eye caustics." },
] as const;
