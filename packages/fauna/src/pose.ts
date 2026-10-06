// Legs placed by closed-form two-bone IK from gait phase offsets: no animation clips (from the SetMix Arena drop).
import { FAUNA, totalPopulation, type DensityField, type FaunaId, type Gait } from "./field";
import type { Creature } from "./creatures";
import { clamp, clamp01 } from "./util";

/* ═══════════════════════════ 5 · PROCEDURAL LOCOMOTION (IK) ══ */

export interface LegPose {
  hip: [number, number, number];
  knee: [number, number, number];
  foot: [number, number, number];
  /** 0 planted … 1 at the top of the swing */
  lift: number;
  planted: boolean;
}

export interface CreaturePose {
  legs: LegPose[];
  /** spine bend in radians — leans into turns, arches over obstacles */
  spineBend: number;
  spinePitch: number;
  bodyY: number;
  /** wing flap phase for the legless species */
  wing: number;
}

/**
 *  Gait phase offsets. These four numbers are the difference between an
 *  animal and a sliding box, and they are the only "animation data" in the
 *  entire fauna system — there are no clips, no skeletons on disk, no
 *  retargeting. A six-legged tripod gait is three numbers.
 */
const GAIT_OFFSETS: Record<number, Record<Gait, number[]>> = {
  4: {
    WALK:    [0, 0.5, 0.25, 0.75],     // lateral sequence
    TROT:    [0, 0.5, 0.5, 0],         // diagonal pairs
    GALLOP:  [0, 0.1, 0.5, 0.6],       // rotary
    GLIDE:   [0, 0, 0, 0], SWIM: [0, 0.5, 0.25, 0.75],
  },
  6: {
    WALK:    [0, 0.5, 0, 0.5, 0, 0.5], // alternating tripod
    TROT:    [0, 0.5, 0, 0.5, 0, 0.5],
    GALLOP:  [0, 0.33, 0.66, 0.16, 0.5, 0.83],
    GLIDE:   [0, 0, 0, 0, 0, 0], SWIM: [0, 0.5, 0, 0.5, 0, 0.5],
  },
};

/** Closed-form two-bone IK — law of cosines, no iteration. */
function ik2(
  hip: [number, number, number], target: [number, number, number],
  l1: number, l2: number, pole: [number, number, number],
): [number, number, number] {
  const dx = target[0] - hip[0], dy = target[1] - hip[1], dz = target[2] - hip[2];
  const d = clamp(Math.hypot(dx, dy, dz), Math.abs(l1 - l2) + 1e-4, l1 + l2 - 1e-4);
  const ux = dx / d, uy = dy / d, uz = dz / d;
  const cosA = clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1);
  const a = Math.acos(cosA);
  const along = Math.cos(a) * l1, outD = Math.sin(a) * l1;
  // bend axis = pole projected perpendicular to the limb
  let bx = pole[0] - ux * (pole[0] * ux + pole[1] * uy + pole[2] * uz);
  let by = pole[1] - uy * (pole[0] * ux + pole[1] * uy + pole[2] * uz);
  let bz = pole[2] - uz * (pole[0] * ux + pole[1] * uy + pole[2] * uz);
  const bl = Math.hypot(bx, by, bz) || 1;
  bx /= bl; by /= bl; bz /= bl;
  return [hip[0] + ux * along + bx * outD, hip[1] + uy * along + by * outD, hip[2] + uz * along + bz * outD];
}

export function poseCreature(
  c: Creature, heightAt: (x: number, z: number) => number, dtTurn = 0,
): CreaturePose {
  const s = FAUNA[c.id];
  const legs: LegPose[] = [];
  const ch = Math.cos(c.heading), sh = Math.sin(c.heading);
  const bodyLift = s.legLenM * 0.72;

  if (s.legs === 0) {
    // legless: wings / fins. A sine with a phase lag along the span reads
    // as a travelling wave, which is what a manta actually does.
    return {
      legs: [], spineBend: dtTurn * 1.6,
      spinePitch: Math.sin(c.gaitPhase * 6.283) * 0.12,
      bodyY: c.y + 6 + Math.sin(c.gaitPhase * 6.283) * 0.9,
      wing: c.gaitPhase,
    };
  }

  const offsets = GAIT_OFFSETS[s.legs]![c.gait];
  const pairs = s.legs / 2;
  for (let i = 0; i < s.legs; i++) {
    const side = i % 2 === 0 ? 1 : -1;
    const row = Math.floor(i / 2);
    const fwd = (row - (pairs - 1) / 2) * s.bodyM * 0.52;
    const lat = side * s.bodyM * 0.3;

    const hip: [number, number, number] = [
      c.x + ch * fwd - sh * lat,
      c.y + bodyLift,
      c.z + sh * fwd + ch * lat,
    ];

    const ph = (c.gaitPhase + offsets[i]!) % 1;
    const swinging = ph < 0.4;
    const t = swinging ? ph / 0.4 : (ph - 0.4) / 0.6;
    // stride: the foot swings forward through the air, then is planted and
    // travels backward with the body — that contact phase is what sells it
    const stride = s.legLenM * 0.75 * clamp01(Math.hypot(c.vx, c.vz) / s.speedMs);
    const along = swinging ? (t - 0.5) * stride : (0.5 - t) * stride;
    const lift = swinging ? Math.sin(t * Math.PI) * s.legLenM * 0.33 : 0;

    const fx = hip[0] + ch * along;
    const fz = hip[2] + sh * along;
    const foot: [number, number, number] = [fx, heightAt(fx, fz) + lift, fz];

    const l = s.legLenM * 0.5;
    const pole: [number, number, number] = [ch, 0, sh];
    legs.push({ hip, knee: ik2(hip, foot, l, l, pole), foot, lift, planted: !swinging });
  }

  // spine: lean into the turn, arch to follow the ground under the feet
  const front = legs.slice(0, 2).reduce((a, l) => a + l.foot[1], 0) / 2;
  const back = legs.slice(-2).reduce((a, l) => a + l.foot[1], 0) / 2;
  return {
    legs,
    spineBend: clamp(dtTurn * 2.2, -0.5, 0.5),
    spinePitch: Math.atan2(front - back, s.bodyM),
    bodyY: c.y + bodyLift + Math.sin(c.gaitPhase * 6.283 * (s.legs / 2)) * 0.035 * s.bodyM,
    wing: 0,
  };
}

export interface FaunaTelemetry {
  populations: Record<FaunaId, number>;
  materialised: number;
  fieldCells: number;
  bytesResident: number;
  bytesIfEntities: number;
}

export function faunaTelemetry(f: DensityField, materialised: number): FaunaTelemetry {
  const populations = {} as Record<FaunaId, number>;
  let total = 0;
  for (const id of Object.keys(FAUNA) as FaunaId[]) {
    populations[id] = totalPopulation(f, id);
    total += populations[id];
  }
  const cells = f.res * f.res;
  return {
    populations, materialised, fieldCells: cells,
    // four Float32Arrays, regardless of how many animals exist
    bytesResident: cells * 4 * 4,
    // what a conventional entity-per-animal engine would hold
    bytesIfEntities: Math.round(total) * 96,
  };
}
