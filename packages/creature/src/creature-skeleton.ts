/**
 * `@hm/creature` skeleton resolution: the pure function from a `CreatureGenomeSpec` to the joint frames the builder, the
 * gait solver and a rigged host all read (plan 44).
 *
 * Nothing here touches three.js or a clock. A genome resolves to:
 *
 *  - the pelvic root and the sacral hub the spine grows from;
 *  - one frame per vertebral segment: its proximal joint, its direction, its length and its distal joint;
 *  - one frame per limb chain (a bilateral chain resolving to two, mirrored in x): the proximal joint, the two-bone
 *    lengths `solveTwoBoneIk()` needs, the middle and distal joints, the pole vector hint and the effector's own link.
 *
 * Because the genome is the only input, the kit the builder grows and the pose the gait evaluator solves are the same
 * organism: a joint the assembly places at `knee` is the joint the IK solver bends.
 */
import {
  creatureSideLabel,
  quatFromUnitVectors,
  rotateDeg,
  vAdd,
  vLen,
  vScale,
  vSub,
  vUnit,
  type CreatureEffectorKind,
  type CreatureGenomeSpec,
  type CreatureLimbChainSpec,
  type CreatureLimbRole,
  type CreatureQuat,
  type CreatureSpineSegmentSpec,
  type CreatureVec3,
} from './creature-spec';

/** One vertebral segment, resolved. */
export interface CreatureSpineFrame {
  readonly spec: CreatureSpineSegmentSpec;
  /** The proximal joint (where the knuckle disc sits). */
  readonly start: CreatureVec3;
  /** The distal joint (the next segment's proximal joint). */
  readonly end: CreatureVec3;
  /** The segment's unit direction. */
  readonly dir: CreatureVec3;
  /** The rotation taking the part's local +y onto `dir`. */
  readonly quat: CreatureQuat;
  /** Radius of the coaxial knuckle disc at `start`. */
  readonly knuckleRadius: number;
  readonly bone: string | null;
  readonly kind: 'vertebra' | 'neck' | 'cranium';
}

/** One limb chain resolved on one side. */
export interface CreatureLimbFrame {
  readonly chainId: string;
  readonly spec: CreatureLimbChainSpec;
  /** +1 for the left chain, -1 for the right, 0 for a medial one (the chain's own x is the centre line). */
  readonly side: 1 | -1 | 0;
  /** `left-leg`, `right-leg`, or the chain id for a medial chain. */
  readonly label: string;
  /** The proximal joint (hip, shoulder, coxa). */
  readonly root: CreatureVec3;
  readonly upperDir: CreatureVec3;
  readonly lowerDir: CreatureVec3;
  readonly effectorDir: CreatureVec3;
  /** The middle joint (knee, elbow) at rest. */
  readonly middle: CreatureVec3;
  /** The distal joint (ankle, wrist) at rest. */
  readonly end: CreatureVec3;
  /** The effector's tip (toe, fingertip, claw tip). */
  readonly tip: CreatureVec3;
  /** The pole vector hint, in the preset frame. */
  readonly poleDir: CreatureVec3;
  readonly upperLength: number;
  readonly lowerLength: number;
  readonly effectorLength: number;
  readonly upperRadius: number;
  readonly lowerRadius: number;
  readonly knuckleRadius: number;
  readonly stepHeight: number;
  readonly strideLength: number;
  readonly gaitPhaseOffset: number;
  readonly effectorKind: CreatureEffectorKind;
  /** A leg steps on the ground; an arm swings free of it. */
  readonly role: CreatureLimbRole;
  readonly bones: { readonly upper: string | null; readonly lower: string | null; readonly effector: string | null };
}

export interface CreatureSkeleton {
  readonly genomeId: string;
  readonly archetype: CreatureGenomeSpec['archetype'];
  readonly pelvis: CreatureVec3;
  readonly pelvisRadius: CreatureVec3;
  /** Where the axial spine mounts on the pelvis. */
  readonly sacrum: CreatureVec3;
  readonly spine: readonly CreatureSpineFrame[];
  readonly limbs: readonly CreatureLimbFrame[];
  /** The cranium frame (the last `cranium` segment), or null for a genome with no head. */
  readonly cranium: CreatureSpineFrame | null;
  /** The lowest joint of the rest pose (the foot the creature stands on). */
  readonly groundY: number;
}

/** The frame a limb's proximal joint hangs from: its parent segment, or the pelvis. */
function parentFrame(skeleton: { pelvis: CreatureVec3; sacrum: CreatureVec3; spine: readonly CreatureSpineFrame[] }, id: string): { origin: CreatureVec3; quat: CreatureQuat } {
  if (id === 'pelvis' || id === '') return { origin: [0, 0, 0], quat: [0, 0, 0, 1] };
  const seg = skeleton.spine.find((s) => s.spec.id === id);
  if (!seg) return { origin: [0, 0, 0], quat: [0, 0, 0, 1] };
  return { origin: seg.start, quat: seg.quat };
}

/** Mirror a vector across the yz plane (`side = -1`): the right limb is the left limb's mirror image, exactly. */
const mirrorX = (v: CreatureVec3, side: 1 | -1 | 0): CreatureVec3 => (side === -1 ? [-v[0], v[1], v[2]] : v);

/** Resolve a genome into joint frames: pelvis, spine, limbs. Pure and deterministic. */
export function creatureSkeleton(genome: CreatureGenomeSpec): CreatureSkeleton {
  const pelvisTop: CreatureVec3 = [genome.pelvis.radius[0] * 0.05, genome.pelvis.radius[1], 0];
  const pelvis: CreatureVec3 = [0, genome.pelvis.restHeight, 0];
  const sacrumOffset = genome.pelvis.sacrumOffset ?? pelvisTop;
  const sacrum = vAdd(pelvis, sacrumOffset);

  const spine: CreatureSpineFrame[] = [];
  let cursor = sacrum;
  let dir: CreatureVec3 = [0, 1, 0];
  for (const [i, spec] of genome.spine.entries()) {
    // the chain curves by each segment's own pitch; an explicit direction wins (a quadruped's horizontal spine)
    dir = vUnit(spec.direction ?? (i === 0 ? rotateDeg([0, 1, 0], [spec.pitchRestDeg, 0, 0]) : rotateDeg(dir, [spec.pitchRestDeg, 0, 0])), dir);
    const end = vAdd(cursor, vScale(dir, spec.length));
    spine.push({
      spec,
      start: cursor,
      end,
      dir,
      quat: quatFromUnitVectors([0, 1, 0], dir),
      knuckleRadius: spec.knuckleRadius ?? Math.min(spec.radiusX, spec.radiusY) * 0.55,
      bone: spec.bone ?? null,
      kind: spec.kind ?? 'vertebra',
    });
    cursor = end;
  }

  const limbs: CreatureLimbFrame[] = [];
  for (const chain of genome.limbs) {
    const sides: readonly (1 | -1 | 0)[] = chain.symmetry === 'bilateral' ? [1, -1] : [0];
    const parent = parentFrame({ pelvis: sacrum, sacrum, spine }, chain.parentSegmentId);
    for (const side of sides) {
      const root = vAdd(parent.origin, rotateDeg(mirrorX(chain.mountOffset, side), [0, 0, 0]));
      const upperDir = vUnit(mirrorX(chain.upperDirection ?? [0, -1, 0], side), [0, -1, 0]);
      const lowerDir = vUnit(mirrorX(chain.lowerDirection ?? upperDir, side), upperDir);
      const effectorDir = vUnit(mirrorX(chain.effectorDirection ?? lowerDir, side), lowerDir);
      const effectorLength = chain.effectorLength ?? chain.lowerLength * 0.22;
      const middle = vAdd(root, vScale(upperDir, chain.upperLength));
      const end = vAdd(middle, vScale(lowerDir, chain.lowerLength));
      const tip = vAdd(end, vScale(effectorDir, effectorLength));
      const upperRadius = chain.upperRadius ?? chain.upperLength * 0.1;
      const lowerRadius = chain.lowerRadius ?? chain.lowerLength * 0.085;
      const knuckleRadius = chain.knuckleRadius ?? Math.max(upperRadius, lowerRadius) * 1.15;
      const sideLabel = side === 0 ? chain.id : creatureSideLabel(side).toLowerCase();
      const bones = chain.bones;
      // A stride is only walkable if the chain can still reach the ground with the foot half a stride forward: clamp the
      // declared length to the leg's own geometry, measured from the *hip* (a sprawled insect ankle is already 0.4 m out,
      // so its whole reach budget is spent before the foot moves at all). No genome can ask for a step it cannot take.
      const maxReach = Math.max(0.02, chain.upperLength + chain.lowerLength);
      const vertical = Math.max(0.02, Math.abs(root[1] - tip[1]));
      const lateral = Math.hypot(end[0] - root[0], end[2] - root[2]);
      const budget = Math.sqrt(Math.max(1e-6, maxReach * maxReach - vertical * vertical));
      const swingM = Math.max(0.01, budget - lateral);
      // a walk may ask for more than the straight leg can give: the pelvis drops (`crouchM` in the gait) to buy it back
      const strideLength = Math.min(Math.max(0.02, chain.strideLength), Math.max(2 * swingM * 0.9, maxReach * 0.55));
      const stepHeight = Math.min(Math.max(0.005, chain.stepHeight), maxReach * 0.12);
      limbs.push({
        chainId: chain.id,
        spec: chain,
        side,
        label: side === 0 ? chain.id : `${sideLabel}-${chain.id}`,
        root,
        upperDir,
        lowerDir,
        effectorDir,
        middle,
        end,
        tip,
        poleDir: vUnit(mirrorX(chain.kneeBendDir, side), [0, 0, 1]),
        upperLength: chain.upperLength,
        lowerLength: chain.lowerLength,
        effectorLength,
        upperRadius,
        lowerRadius,
        knuckleRadius,
        stepHeight,
        strideLength,
        gaitPhaseOffset: chain.gaitPhaseOffset,
        effectorKind: chain.effectorKind,
        role: chain.role ?? (chain.symmetry === 'medial' ? 'tail' : chain.effectorKind === 'hand' ? 'arm' : 'leg'),
        bones: {
          upper: bones ? bones.upper.replace('{Side}', creatureSideLabel(side === -1 ? -1 : 1)) : null,
          lower: bones ? bones.lower.replace('{Side}', creatureSideLabel(side === -1 ? -1 : 1)) : null,
          effector: bones ? bones.effector.replace('{Side}', creatureSideLabel(side === -1 ? -1 : 1)) : null,
        },
      });
    }
  }

  // the ground the rest pose stands on: the lowest tip or joint of the limb chains
  let groundY = Number.POSITIVE_INFINITY;
  for (const l of limbs) groundY = Math.min(groundY, l.tip[1], l.end[1], l.root[1]);
  if (!Number.isFinite(groundY)) groundY = 0;

  return {
    genomeId: genome.id,
    archetype: genome.archetype,
    pelvis,
    pelvisRadius: genome.pelvis.radius,
    sacrum,
    spine,
    limbs,
    cranium: spine.find((s) => s.kind === 'cranium') ?? null,
    groundY,
  };
}

/** The pelvis's hip socket for a side: the proximal joint of a chain whose parent is the pelvis. */
export function hipSocketOf(skeleton: CreatureSkeleton, chainId: string): CreatureLimbFrame | null {
  return skeleton.limbs.find((l) => l.chainId === chainId) ?? null;
}

/** The distance between two resolved joint frames (a test's handle on the skeleton's proportions). */
export const creatureJointDistance = (a: CreatureVec3, b: CreatureVec3): number => vLen(vSub(a, b));
