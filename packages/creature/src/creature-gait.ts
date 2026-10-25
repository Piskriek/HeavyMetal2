/**
 * `@hm/creature` gait: the pure function from `(genome, simTime, strideVelocity)` to a whole-organism pose (plan 44 §3).
 *
 * The two-bone legs and arms are wired into the project's own analytical Law-of-Cosines solver,
 * `apps/web/src/avatar/two-bone-ik.ts::solveTwoBoneIk` — the same code that puts Astro's left hand on the Beam Rifle's
 * foregrip. Nothing here raycasts, reads a clock, allocates per frame or keeps state between calls: the pose is a pure
 * function of the genome and the (quantised) time.
 *
 * The gait itself is the standard stance/swing curve:
 *
 *  - **stance** (`φ < duty`): the foot stays planted, travelling from the front of the stride to the back as the pelvis
 *    passes over it;
 *  - **swing** (`φ >= duty`): the foot lifts along a cycloid of height `stepHeight · sin(π · u)` to the next foothold.
 *
 * Three distance LOD tiers keep the GTX 950M in budget:
 *
 *  - **Tier 0** (`dist < 15 m`, player / active combat): solved every frame (60 Hz) with exact terrain or platform height —
 *    the caller's `raycastHeightAt` is honoured;
 *  - **Tier 1** (`15 m <= dist < 50 m`, the roster midground): evaluated at `stageAnimRateHz` (12–30 Hz, snapped to the
 *    Fidelity Stage's cadence) against the pure analytical heightfield, **0 raycasts**;
 *  - **Tier 2** (`dist >= 50 m`, far horizon): asleep. The pose is the rest pose and no matrix is written at all, so the
 *    caller can freeze the limb sub-assemblies (`matrixAutoUpdate = false`) or swap to a `@hm/shareware` billboard.
 */
import { solveTwoBoneIk } from '../../../apps/web/src/avatar/two-bone-ik';
import {
  quatToEulerDeg,
  rotateDeg,
  vAdd,
  vScale,
  vSub,
  vUnit,
  type CreatureGenomeSpec,
  type CreatureVec3,
} from './creature-spec';
import { creatureSkeleton, type CreatureLimbFrame } from './creature-skeleton';

/** The near tier's cut-off: inside this the feet conform to the real ground every frame. */
export const GAIT_TIER_NEAR_M = 15;
/** The far tier's cut-off: at or beyond this the organism sleeps. */
export const GAIT_TIER_FAR_M = 50;
/** Tier 0's sample rate: the frame rate the solver runs at (60 Hz). */
export const GAIT_NEAR_HZ = 60;
/** Tier 1's cadence bounds: the Fidelity Stage's animation ladder never runs slower or faster than this. */
export const GAIT_STAGE_HZ_MIN = 12;
export const GAIT_STAGE_HZ_MAX = 30;

/** 0: near, 60 Hz, exact ground. 1: midground, `stageAnimRateHz`, pure heightfield. 2: far, asleep. */
export type GaitLodTier = 0 | 1 | 2;

export interface CreatureGaitOptions {
  /** Distance from the camera, metres (default 0: the player's own organism). */
  readonly distanceM?: number;
  /** The Fidelity Stage's animation cadence for tier 1, Hz (clamped to 12–30; default 18). */
  readonly stageAnimRateHz?: number;
  /** The pure analytical heightfield `y = f(x, z)`: the only ground tier 1 reads (default: the flat plane y = 0). */
  readonly groundHeightAt?: (x: number, z: number) => number;
  /** Tier 0's exact terrain/platform height (a raycast in the game). Ignored by tier 1: 0 raycasts there. */
  readonly raycastHeightAt?: (x: number, z: number) => number;
  /** The pelvis's world offset this frame (the walker's translation), default the genome's rest pelvis. */
  readonly pelvisOffset?: CreatureVec3;
  /** Forces a tier (a test's handle on the schedule); absent means the distance decides. */
  readonly forceTier?: GaitLodTier;
}

/** One limb chain, posed. */
export interface CreatureLimbPose {
  readonly chainId: string;
  readonly label: string;
  readonly side: 1 | -1 | 0;
  /** The gait phase this limb is at, `[0..1)`. */
  readonly phase: number;
  readonly state: 'stance' | 'swing';
  /** The proximal joint in the preset frame, after the pelvis's own motion. */
  readonly root: CreatureVec3;
  /** Where the foot is asked to be (the IK target), in the preset frame. */
  readonly target: CreatureVec3;
  /** The solved middle joint (knee, elbow). */
  readonly joint: CreatureVec3;
  /** The solved end effector position (the solver's clamped reach). */
  readonly solved: CreatureVec3;
  /** The upper link's local rotation this frame, Euler degrees (what the scene graph writes on the joint node). */
  readonly upperRotationDeg: CreatureVec3;
  /** The lower link's local rotation this frame, Euler degrees. */
  readonly lowerRotationDeg: CreatureVec3;
  /** The straight-line distance the solver was asked to reach, metres. */
  readonly reachM: number;
  /** False when the target was beyond `L1 + L2` (or inside `|L1 - L2|`) and the reach was soft-clamped. */
  readonly withinReach: boolean;
}

export interface CreatureGait {
  readonly genomeId: string;
  readonly simTime: number;
  /** The time the pose was actually sampled at (quantised to the tier's cadence). */
  readonly evaluatedAt: number;
  readonly lodTier: GaitLodTier;
  /** The tier's sample rate, Hz (0 when asleep). */
  readonly lodHz: number;
  readonly strideFreqHz: number;
  readonly sleeping: boolean;
  readonly pelvis: {
    readonly pos: CreatureVec3;
    /** Vertical bob, metres (negative dips). */
    readonly bobM: number;
    /** Lateral sway, metres. */
    readonly swayM: number;
    readonly rollDeg: number;
  };
  /** Per vertebral segment: the axial flex this frame, degrees (small, and phase-locked to the gait). */
  readonly spineFlexDeg: readonly number[];
  readonly limbs: readonly CreatureLimbPose[];
}

/** The tier the schedule picks for a distance. */
export function creatureGaitTier(distanceM: number, force?: GaitLodTier): GaitLodTier {
  if (force !== undefined) return force;
  const d = Number.isFinite(distanceM) ? Math.max(0, distanceM) : Number.POSITIVE_INFINITY;
  return d < GAIT_TIER_NEAR_M ? 0 : d < GAIT_TIER_FAR_M ? 1 : 2;
}

/** The sample rate a tier runs at: 60 Hz near, the stage's cadence in the midground, asleep far. */
export function creatureGaitRate(tier: GaitLodTier, stageAnimRateHz = 18): number {
  if (tier === 0) return GAIT_NEAR_HZ;
  if (tier === 2) return 0;
  const hz = Number.isFinite(stageAnimRateHz) ? stageAnimRateHz : 18;
  return Math.max(GAIT_STAGE_HZ_MIN, Math.min(GAIT_STAGE_HZ_MAX, hz));
}

/** `t` quantised to a rate: the same pose for every frame inside one animation step. */
export function quantiseGaitTime(t: number, hz: number): number {
  if (!(hz > 0)) return 0;
  const safe = Number.isFinite(t) ? Math.max(0, t) : 0;
  return Math.floor(safe * hz + 1e-9) / hz;
}

/** The ground a tier reads: tier 0 may raycast, tier 1 only the analytical heightfield, tier 2 nothing. */
function groundAt(tier: GaitLodTier, x: number, z: number, o: CreatureGaitOptions): number {
  if (tier === 2) return 0;
  if (tier === 0 && o.raycastHeightAt) return o.raycastHeightAt(x, z);
  return o.groundHeightAt ? o.groundHeightAt(x, z) : 0;
}

/** The rest pose: what tier 2 (and a genome standing still) returns without solving anything. */
function restPose(genome: CreatureGenomeSpec, skeleton: ReturnType<typeof creatureSkeleton>, simTime: number, tier: GaitLodTier, hz: number, pelvisPos: CreatureVec3): CreatureGait {
  return {
    genomeId: genome.id,
    simTime,
    evaluatedAt: quantiseGaitTime(simTime, hz),
    lodTier: tier,
    lodHz: hz,
    strideFreqHz: 0,
    sleeping: tier === 2,
    pelvis: { pos: pelvisPos, bobM: 0, swayM: 0, rollDeg: 0 },
    spineFlexDeg: skeleton.spine.map(() => 0),
    limbs: skeleton.limbs.map((l) => ({
      chainId: l.chainId,
      label: l.label,
      side: l.side,
      phase: l.gaitPhaseOffset % 1,
      state: 'stance',
      root: vAdd(l.root, vSub(pelvisPos, skeleton.pelvis)),
      target: vAdd(l.tip, vSub(pelvisPos, skeleton.pelvis)),
      joint: l.middle,
      solved: l.end,
      upperRotationDeg: [0, 0, 0],
      lowerRotationDeg: [0, 0, 0],
      reachM: Math.hypot(l.upperLength, l.lowerLength),
      withinReach: true,
    })),
  };
}

/**
 * Pose the whole organism at `simTime` for a stride velocity (`m/s`). Pure: the same arguments give the same pose.
 */
export function evaluateCreatureGait(
  genome: CreatureGenomeSpec,
  simTime: number,
  strideVelocity: number,
  options: CreatureGaitOptions = {},
): CreatureGait {
  const skeleton = creatureSkeleton(genome);
  const tier = creatureGaitTier(options.distanceM ?? 0, options.forceTier);
  const hz = creatureGaitRate(tier, options.stageAnimRateHz);
  const rootOffset = options.pelvisOffset ? vSub(options.pelvisOffset, skeleton.pelvis) : [0, 0, 0] as CreatureVec3;
  const pelvisPos = vAdd(skeleton.pelvis, rootOffset);
  if (tier === 2) return restPose(genome, skeleton, simTime, tier, hz, pelvisPos);

  const velocity = Number.isFinite(strideVelocity) ? Math.max(0, strideVelocity) : 0;
  const moving = velocity > 0.05;
  const t = quantiseGaitTime(simTime, hz);
  const duty = Math.max(0.3, Math.min(0.9, genome.dutyFactor ?? 0.62));
  const strideLength = Math.max(0.1, skeleton.limbs[0]?.strideLength ?? 1);
  // a full cycle covers two strides (left + right), so the cycle frequency is v / (2 * strideLength)
  const freq = moving ? velocity / (2 * strideLength) : 0;
  const cycle = t * freq;
  // the crouch: how far the pelvis must drop for every stance foot to stay inside its own reach at half a stride out
  const crouchM = moving
    ? skeleton.limbs.reduce((deep, limb) => {
        if (limb.role !== 'leg') return deep;
        const maxReach = limb.upperLength + limb.lowerLength;
        const vertical = Math.abs(limb.root[1] - (limb.end[1] + (groundAt(tier, limb.tip[0], limb.tip[2], options) - limb.tip[1])));
        const lateral = Math.hypot(limb.end[0] - limb.root[0], limb.end[2] - limb.root[2]);
        const room = (maxReach * 0.97) ** 2 - (lateral + limb.strideLength / 2) ** 2;
        if (room <= 0) return Math.max(deep, vertical);
        return Math.max(deep, vertical - Math.sqrt(room));
      }, 0)
    : 0;
  const bobM = (moving ? Math.sin(cycle * Math.PI * 4) * 0.008 : Math.sin(t * Math.PI * 2 * 0.35) * 0.004) - crouchM;
  const swayM = moving ? Math.cos(cycle * Math.PI * 2) * 0.006 : 0;
  const rollDeg = moving ? Math.sin(cycle * Math.PI * 2) * 1.2 : 0;

  const limbs: CreatureLimbPose[] = [];
  for (const limb of skeleton.limbs) {
    const posed = poseLimb(limb, {
      phase: frac(cycle + limb.gaitPhaseOffset),
      duty,
      moving,
      tier,
      options,
      rootOffset,
      pelvisBob: bobM,
      sway: swayM,
    });
    limbs.push(posed);
  }

  // the axial spine flexes with the stride: a travelling wave down the Sushumna axis, degrees
  const spineFlexDeg = skeleton.spine.map((seg, i) => {
    const phase = frac(cycle + i * 0.12);
    const amp = seg.kind === 'cranium' ? 0.6 : seg.kind === 'neck' ? 0.9 : 1.4;
    return moving ? Math.sin(phase * Math.PI * 2) * amp : Math.sin(t * Math.PI * 2 * 0.35 + i * 0.4) * 0.25;
  });

  return {
    genomeId: genome.id,
    simTime,
    evaluatedAt: t,
    lodTier: tier,
    lodHz: hz,
    strideFreqHz: freq,
    sleeping: false,
    pelvis: { pos: pelvisPos, bobM, swayM, rollDeg },
    spineFlexDeg,
    limbs,
  };
}

const frac = (v: number): number => {
  const f = v - Math.floor(v);
  return f < 0 ? f + 1 : f;
};

interface LimbContext {
  readonly phase: number;
  readonly duty: number;
  readonly moving: boolean;
  readonly tier: GaitLodTier;
  readonly options: CreatureGaitOptions;
  readonly rootOffset: CreatureVec3;
  readonly pelvisBob: number;
  readonly sway: number;
}

/** One chain: the stance/swing curve, the foothold, the ground read and the analytical IK solution. */
function poseLimb(limb: CreatureLimbFrame, c: LimbContext): CreatureLimbPose {
  const shift: CreatureVec3 = [c.sway, c.pelvisBob, 0];
  const root = vAdd(vAdd(limb.root, c.rootOffset), shift);
  const stride = limb.strideLength;

  // a hand does not plant and a tail does not step: both swing from their own proximal joint, clear of the ground
  if (limb.role !== 'leg') {
    const swingDeg = c.moving ? Math.sin(c.phase * Math.PI * 2) * (limb.role === 'arm' ? 26 : 11) : 0;
    const swingDir = rotateDeg(limb.upperDir, limb.role === 'arm' ? [swingDeg, 0, 0] : [0, swingDeg, 0]);
    const reach = (limb.upperLength + limb.lowerLength) * 0.97;
    const target = vAdd(root, vScale(swingDir, reach));
    const pole = vAdd(root, vScale(limb.poleDir, Math.max(0.4, limb.upperLength)));
    const solution = solveTwoBoneIk({
      rootPos: { x: root[0], y: root[1], z: root[2] },
      midPos: { x: limb.middle[0] + c.rootOffset[0] + shift[0], y: limb.middle[1] + c.rootOffset[1] + shift[1], z: limb.middle[2] + c.rootOffset[2] + shift[2] },
      endPos: { x: limb.end[0] + c.rootOffset[0] + shift[0], y: limb.end[1] + c.rootOffset[1] + shift[1], z: limb.end[2] + c.rootOffset[2] + shift[2] },
      targetPos: { x: target[0], y: target[1], z: target[2] },
      polePos: { x: pole[0], y: pole[1], z: pole[2] },
    });
    return {
      chainId: limb.chainId,
      label: limb.label,
      side: limb.side,
      phase: c.phase,
      state: Math.abs(swingDeg) > 3 ? 'swing' : 'stance',
      root,
      target,
      joint: [solution.jointPos.x, solution.jointPos.y, solution.jointPos.z],
      solved: [solution.solvedEndPos.x, solution.solvedEndPos.y, solution.solvedEndPos.z],
      upperRotationDeg: quatToEulerDeg([solution.upperDeltaQuat.x, solution.upperDeltaQuat.y, solution.upperDeltaQuat.z, solution.upperDeltaQuat.w]),
      lowerRotationDeg: quatToEulerDeg([solution.lowerDeltaQuat.x, solution.lowerDeltaQuat.y, solution.lowerDeltaQuat.z, solution.lowerDeltaQuat.w]),
      reachM: solution.reachDist,
      withinReach: solution.withinReach,
    };
  }

  // the ankle's height above the ground at rest: the effector link's own length
  const ankleLift = Math.abs(limb.effectorLength);
  let target: CreatureVec3;
  let state: 'stance' | 'swing' = 'stance';

  if (!c.moving) {
    const ground = groundAt(c.tier, limb.tip[0] + c.rootOffset[0], limb.tip[2] + c.rootOffset[2], c.options);
    target = [limb.end[0] + c.rootOffset[0] + c.sway, ground + ankleLift, limb.end[2] + c.rootOffset[2]];
  } else if (c.phase < c.duty) {
    // stance: planted, sliding from the front of the stride to the back as the body passes over it
    const u = c.phase / c.duty;
    const z = limb.end[2] + (0.5 - u) * stride;
    const x = limb.end[0] + c.sway;
    const ground = groundAt(c.tier, x + c.rootOffset[0], z + c.rootOffset[2], c.options);
    target = [x, ground + ankleLift, z];
  } else {
    state = 'swing';
    const u = (c.phase - c.duty) / (1 - c.duty);
    const z = limb.end[2] + (-0.5 + u) * stride;
    const x = limb.end[0] + c.sway;
    const ground = groundAt(c.tier, x + c.rootOffset[0], z + c.rootOffset[2], c.options);
    // a cycloid: it leaves and lands with no vertical velocity
    target = [x, ground + ankleLift + Math.sin(Math.PI * u) * limb.stepHeight, z];
  }

  const pole = vAdd(root, vScale(limb.poleDir, Math.max(0.4, limb.upperLength)));
  const solution = solveTwoBoneIk({
    rootPos: { x: root[0], y: root[1], z: root[2] },
    midPos: { x: limb.middle[0] + c.rootOffset[0] + shift[0], y: limb.middle[1] + c.rootOffset[1] + shift[1], z: limb.middle[2] + c.rootOffset[2] + shift[2] },
    endPos: { x: limb.end[0] + c.rootOffset[0] + shift[0], y: limb.end[1] + c.rootOffset[1] + shift[1], z: limb.end[2] + c.rootOffset[2] + shift[2] },
    targetPos: { x: target[0], y: target[1], z: target[2] },
    polePos: { x: pole[0], y: pole[1], z: pole[2] },
  });

  return {
    chainId: limb.chainId,
    label: limb.label,
    side: limb.side,
    phase: c.phase,
    state,
    root,
    target,
    joint: [solution.jointPos.x, solution.jointPos.y, solution.jointPos.z],
    solved: [solution.solvedEndPos.x, solution.solvedEndPos.y, solution.solvedEndPos.z],
    upperRotationDeg: quatToEulerDeg([solution.upperDeltaQuat.x, solution.upperDeltaQuat.y, solution.upperDeltaQuat.z, solution.upperDeltaQuat.w]),
    lowerRotationDeg: quatToEulerDeg([solution.lowerDeltaQuat.x, solution.lowerDeltaQuat.y, solution.lowerDeltaQuat.z, solution.lowerDeltaQuat.w]),
    reachM: solution.reachDist,
    withinReach: solution.withinReach,
  };
}

/** The unit vector from `a` to `b`, or straight up for a degenerate pair. */
export const gaitDirection = (a: CreatureVec3, b: CreatureVec3): CreatureVec3 => vUnit(vSub(b, a), [0, 1, 0]);
