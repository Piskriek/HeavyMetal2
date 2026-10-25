/**
 * `@hm/creature`: the declarative genome every morphogenetic organism in the multiverse is grown from (plan 44).
 *
 * A creature is not a mesh and it is not a skeleton of skinned vertices: it is a *genome* — a pelvis, an axial chain of
 * vertebral segments, a set of articulated limb chains, and the sensory and manipulator parts that mount on them. The
 * genome maps 1:1 onto the five canonical groups `apps/web/src/play/kit-groups.ts` declares, because a creature and a
 * machine are the same kind of assembly to the builder, the beam and the audit:
 *
 *  - `base`      — the pelvic root, the sacral hub, the tail/thruster socket, the acetabular (hip) bearings: the centre of
 *                  mass and the frame locomotion drives.
 *  - `structure` — the `Sushumna` axial spine, the thoracic rib cage, the cervical neck seal, the cranium: the silhouette
 *                  and what carries the pectoral (shoulder) sockets.
 *  - `mechanism` — the bilateral articulated limb chains (femur/humerus, tibia/ulna, tarsus/calcaneus), each link a rigid
 *                  part on a coaxial knuckle, driven by `solveTwoBoneIk()` and a declarative gait phase.
 *  - `controls`  — eyes, visors, horns, antennae, telemetry organs: the faces a player and a beam act on.
 *  - `subject`   — hands, claws, talons, stingers: the end effectors that hold the Beam Rifle or a tool.
 *
 * Zero closures: every field is data (numbers, ids, tuples). Two genomes with the same fields grow the same organism,
 * byte for byte, and the same genome always flattens to the same kit.
 *
 * Frames: metres, y up, the preset frame is the world. Bone directions are unit-ish tuples; a `null`/absent optional means
 * "derive it" (see `creature-skeleton.ts` for the exact derivation).
 */

/** A point or direction, `[x, y, z]`, metres (the same tuple `@hm/kitspec` uses). */
export type CreatureVec3 = readonly [number, number, number];

/** The seven archetypes a genome can be authored for (plan 44 section 4). */
export type CreatureArchetype =
  | 'biped-astro'
  | 'theropod'
  | 'quadruped'
  | 'hexapod'
  | 'arachnid'
  | 'serpentine'
  | 'avian-drone';

/** The five canonical anatomy groups, in build order (kept structurally identical to `kit-groups.ts`). */
export type CreatureGroup = 'base' | 'structure' | 'mechanism' | 'controls' | 'subject';

export const CREATURE_GROUPS: readonly CreatureGroup[] = Object.freeze(['base', 'structure', 'mechanism', 'controls', 'subject']);

/** What a chain is for: a leg carries the body, an arm swings free, a tail or neck frill sways clear of both. */
export type CreatureLimbRole = 'leg' | 'arm' | 'tail';

/** What a limb ends in: the shape of the last link and the material the audit and the beam read as high-contrast. */
export type CreatureEffectorKind = 'boot' | 'hoof' | 'talon' | 'hand' | 'pincer' | 'thruster';

/** The pelvic root: the centre of mass, the sacral hub the spine grows from, and the hip sockets. */
export interface CreaturePelvisSpec {
  /** Height of the pelvis origin above the ground, metres. */
  readonly restHeight: number;
  /** Half extents of the pelvic girdle, metres. */
  readonly radius: CreatureVec3;
  /** Rung-4 `@hm/matstack` preset id for the pelvis and its harness. */
  readonly matPresetId: string;
  /** Where the axial spine mounts, in the pelvis frame (default: the pelvis's own top, `[0, radius[1], 0]`). */
  readonly sacrumOffset?: CreatureVec3;
  /** The rigged host's bone this root binds to (`mixamorigHips` for the Astro suit). */
  readonly bone?: string;
}

/** One vertebral segment of the axial spine (`structure`). */
export interface CreatureSpineSegmentSpec {
  readonly id: string;
  /** Axial length along the segment's own direction, metres. */
  readonly length: number;
  /** Lateral half-width, metres. */
  readonly radiusX: number;
  /** Dorsal-ventral half-height, metres. */
  readonly radiusY: number;
  /** Natural spinal curve: the turn about x this segment adds to the previous segment's direction, degrees. */
  readonly pitchRestDeg: number;
  /** Rung-4 `@hm/matstack` preset id for this segment. */
  readonly matPresetId: string;
  /** The segment's rest direction in the preset frame, when the chain's accumulated pitch does not describe it. */
  readonly direction?: CreatureVec3;
  /** The rigged host's bone this segment binds to (the Astro suit's `mixamorigSpine`, `mixamorigNeck`, ...). */
  readonly bone?: string;
  /** What the segment is: a plain vertebra, the cervical neck, or the cranium the sensory organs mount on. */
  readonly kind?: 'vertebra' | 'neck' | 'cranium';
  /** Radius of the coaxial knuckle disc at this segment's proximal end (default: a quarter of the smaller radius). */
  readonly knuckleRadius?: number;
}

/** One bilateral articulated limb chain (`mechanism`). */
export interface CreatureLimbChainSpec {
  readonly id: string;
  /** The segment the chain hangs from: `'pelvis'` or a spine segment id. */
  readonly parentSegmentId: string;
  /** `bilateral` grows a left and a right chain; `medial` grows one on the centre line (a tail, a stinger, a neck frill). */
  readonly symmetry: 'bilateral' | 'medial';
  /** The proximal joint (hip, shoulder, coxa), in the parent's frame. A bilateral chain mirrors x for the right side. */
  readonly mountOffset: CreatureVec3;
  /** Length of the upper link (femur / humerus), metres: L1 of `solveTwoBoneIk()`. */
  readonly upperLength: number;
  /** Length of the lower link (tibia / ulna), metres: L2 of `solveTwoBoneIk()`. */
  readonly lowerLength: number;
  /** The pole vector hint for the middle joint, in the preset frame (mirrored x on the right side). */
  readonly kneeBendDir: CreatureVec3;
  /** Phase offset in the gait cycle, `[0..1)`: biped 0 / 0.5, quadruped 0 / 0.5 / 0.25 / 0.75, hexapod alternating tripods. */
  readonly gaitPhaseOffset: number;
  /** How high the foot lifts in swing, metres. */
  readonly stepHeight: number;
  /** The stride one full gait cycle covers at the genome's cadence, metres. */
  readonly strideLength: number;
  readonly effectorKind: CreatureEffectorKind;
  /** The upper link's rest direction (default: straight down, `[0, -1, 0]`). */
  readonly upperDirection?: CreatureVec3;
  /** The lower link's rest direction (default: the upper link's). */
  readonly lowerDirection?: CreatureVec3;
  /** What this chain does: a leg carries weight and steps on the ground, an arm swings free (default: from the effector). */
  readonly role?: CreatureLimbRole;
  /** The effector's rest direction (default: the lower link's). */
  readonly effectorDirection?: CreatureVec3;
  /** Length of the effector link (foot, hand, talon), metres (default: a fifth of the lower link). */
  readonly effectorLength?: number;
  /** Radius of the upper link at its waist, metres (default: a tenth of its length). */
  readonly upperRadius?: number;
  /** Radius of the lower link at its waist, metres (default: a tenth of its length). */
  readonly lowerRadius?: number;
  /** Radius of the coaxial knuckle ball at each joint, metres (default: 1.2x the wider of the two links). */
  readonly knuckleRadius?: number;
  /** The rigged host's bones, with `{Side}` replaced by `Left` / `Right` (the Astro suit's `mixamorig{Side}Arm`). */
  readonly bones?: {
    readonly upper: string;
    readonly lower: string;
    readonly effector: string;
  };
}

/**
 * A part that mounts on the genome's own skeleton rather than being grown from a chain: a visor, a horn, a telemetry
 * organ (`controls`) or a hand, a claw, a stinger (`subject`). Also used for the `structure` plates (rib cage, life
 * support pack, helmet dome) and the `base` harness, through `CreatureGenomeSpec.armour` and `.harness`.
 */
export interface KitSocketPartSpec {
  readonly id: string;
  /** The `@hm/partgen` generator that draws it. */
  readonly gen: string;
  /** Its slider values (defaults come from the generator). */
  readonly params?: Readonly<Record<string, number>>;
  /** Rung-4 `@hm/matstack` preset id, or a trim name the lab resolves to a material. */
  readonly material: string;
  readonly rank?: 0 | 1 | 2;
  /**
   * Where it mounts: `'pelvis'`, a spine segment id, a limb chain id (`'limb:left-leg'`, the chain's proximal joint), or a
   * chain link (`'limb:left-leg.effector'`, its distal end).
   */
  readonly mount: string;
  /** Offset in the mount's own frame (the pelvis/joint frame at the root, or the link's end frame), metres. */
  readonly at?: CreatureVec3;
  /** Extra Euler turn about the mount frame, degrees (three.js 'XYZ', as `@hm/kitspec` places parts). */
  readonly rot?: CreatureVec3;
  /** Which of the five groups owns it (defaults: `controls` in `sensoryControls`, `subject` in `subjectEffectors`). */
  readonly group?: CreatureGroup;
  /** The rigged host's bone this part binds to. */
  readonly bone?: string;
  /** Material per `@hm/partgen` slot, when the part's slots read differently (`{ lens: 'visor-gold' }`). */
  readonly slotMaterials?: Readonly<Record<string, string>>;
}

/**
 * The whole organism. Grow it into an audited `@hm/kitspec` kit with `buildCreatureKit()`, pose it with
 * `evaluateCreatureGait()`, and bind it to a rigged host with `creaturePartBones()`.
 */
export interface CreatureGenomeSpec {
  readonly id: string;
  readonly archetype: CreatureArchetype;
  /** The deterministic seed every derived choice reads (materials, horn count, palette jitter): no randomness anywhere. */
  readonly seed: number;
  readonly pelvis: CreaturePelvisSpec;
  readonly spine: readonly CreatureSpineSegmentSpec[];
  readonly limbs: readonly CreatureLimbChainSpec[];
  /** Sensory and telemetry organs (`controls`). */
  readonly sensoryControls: readonly KitSocketPartSpec[];
  /** Manipulators and weapons (`subject`). */
  readonly subjectEffectors: readonly KitSocketPartSpec[];
  /** Structural plates beyond the spine: rib cage, life-support pack, helmet dome (`structure`). */
  readonly armour?: readonly KitSocketPartSpec[];
  /** Base harness beyond the pelvis: thruster belt, battery packs, tail socket (`base`). */
  readonly harness?: readonly KitSocketPartSpec[];
  /**
   * The thoracic carapace the assembly grows between the pelvis and the neck (`structure`). Its width is not authored: it
   * is computed so its side planes are exactly tangent to the humeral balls, which is what keeps the shoulder joint a
   * socket rather than an interpenetration. `depth` is how far the chest stands off the spine.
   */
  readonly torso?: { readonly depth?: number; readonly material?: string };
  /** `@hm/skin` OKLab palette + Bayer dither binding. */
  readonly skinPaletteId: string;
  /** `@hm/soundlab` vocal and footstep stem id. */
  readonly voiceStemId: string;
  /** The gait cadence at the stride velocity the genome was authored for, Hz (default 1.6). */
  readonly strideFreqHz?: number;
  /** The fraction of a gait cycle a foot spends on the ground (default 0.62). */
  readonly dutyFactor?: number;
}

/* ------------------------------------------------------------------ small pure math (no dependencies) */

const RAD = Math.PI / 180;

export const vAdd = (a: CreatureVec3, b: CreatureVec3): CreatureVec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const vSub = (a: CreatureVec3, b: CreatureVec3): CreatureVec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const vScale = (a: CreatureVec3, k: number): CreatureVec3 => [a[0] * k, a[1] * k, a[2] * k];
export const vDot = (a: CreatureVec3, b: CreatureVec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const vCross = (a: CreatureVec3, b: CreatureVec3): CreatureVec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const vLen = (a: CreatureVec3): number => Math.hypot(a[0], a[1], a[2]);
export const vDist = (a: CreatureVec3, b: CreatureVec3): number => vLen(vSub(a, b));

/** A unit vector; `fallback` for a zero-length one (so a degenerate genome never produces NaNs). */
export function vUnit(a: CreatureVec3, fallback: CreatureVec3 = [0, 1, 0]): CreatureVec3 {
  const l = vLen(a);
  return l > 1e-9 ? [a[0] / l, a[1] / l, a[2] / l] : fallback;
}

/** A quaternion, `[x, y, z, w]` (three.js order). */
export type CreatureQuat = readonly [number, number, number, number];

/** `rotateDeg(v, [x, y, z])`: the vector turned by Euler degrees in three.js 'XYZ' order (`Rx * Ry * Rz`). */
export function rotateDeg(v: CreatureVec3, eulerDeg: CreatureVec3): CreatureVec3 {
  return applyQuat(v, quatFromEulerDeg(eulerDeg));
}

/** Cosine and sine of an angle in degrees, exact for the multiples of 90 (so axis-aligned parts stay exact). */
function cosSinDeg(deg: number): readonly [number, number] {
  const q = ((deg % 360) + 360) % 360;
  if (q === 0) return [1, 0];
  if (q === 90) return [0, 1];
  if (q === 180) return [-1, 0];
  if (q === 270) return [0, -1];
  return [Math.cos(q * RAD), Math.sin(q * RAD)];
}

/** Euler degrees in three.js 'XYZ' order to a quaternion. */
export function quatFromEulerDeg(eulerDeg: CreatureVec3): CreatureQuat {
  const [c1, s1] = cosSinDeg(eulerDeg[0] / 2);
  const [c2, s2] = cosSinDeg(eulerDeg[1] / 2);
  const [c3, s3] = cosSinDeg(eulerDeg[2] / 2);
  return [
    s1 * c2 * c3 + c1 * s2 * s3,
    c1 * s2 * c3 - s1 * c2 * s3,
    c1 * c2 * s3 + s1 * s2 * c3,
    c1 * c2 * c3 - s1 * s2 * s3,
  ];
}

export function quatMul(a: CreatureQuat, b: CreatureQuat): CreatureQuat {
  return [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
  ];
}

export const quatConj = (q: CreatureQuat): CreatureQuat => [-q[0], -q[1], -q[2], q[3]];

export function quatNorm(q: CreatureQuat): CreatureQuat {
  const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1;
  return [q[0] / l, q[1] / l, q[2] / l, q[3] / l];
}

export function applyQuat(v: CreatureVec3, q: CreatureQuat): CreatureVec3 {
  const ix = q[3] * v[0] + q[1] * v[2] - q[2] * v[1];
  const iy = q[3] * v[1] + q[2] * v[0] - q[0] * v[2];
  const iz = q[3] * v[2] + q[0] * v[1] - q[1] * v[0];
  const iw = -q[0] * v[0] - q[1] * v[1] - q[2] * v[2];
  return [
    ix * q[3] + iw * -q[0] + iy * -q[2] - iz * -q[1],
    iy * q[3] + iw * -q[1] + iz * -q[0] - ix * -q[2],
    iz * q[3] + iw * -q[2] + ix * -q[1] - iy * -q[0],
  ];
}

/** The shortest rotation taking unit vector `from` onto unit vector `to`. */
export function quatFromUnitVectors(from: CreatureVec3, to: CreatureVec3): CreatureQuat {
  const a = vUnit(from), b = vUnit(to);
  let r = vDot(a, b) + 1;
  if (r < 1e-8) {
    // opposite: any perpendicular axis is a valid half turn
    const axis = Math.abs(a[0]) > Math.abs(a[2]) ? [-a[1], a[0], 0] : [0, -a[2], a[1]];
    const n = vUnit([axis[0] as number, axis[1] as number, axis[2] as number], [1, 0, 0]);
    return [n[0], n[1], n[2], 0];
  }
  const c = vCross(a, b);
  const mag = Math.hypot(c[0], c[1], c[2], r);
  return [c[0] / mag, c[1] / mag, c[2] / mag, r / mag];
}

/** Euler degrees in three.js 'XYZ' order from a quaternion (the inverse of `quatFromEulerDeg`). */
export function quatToEulerDeg(q: CreatureQuat): CreatureVec3 {
  const [x, y, z, w] = quatNorm(q);
  const m11 = 1 - 2 * (y * y + z * z);
  const m12 = 2 * (x * y - z * w);
  const m13 = 2 * (x * z + y * w);
  const m22 = 1 - 2 * (x * x + z * z);
  const m23 = 2 * (y * z - x * w);
  const m32 = 2 * (y * z + x * w);
  const m33 = 1 - 2 * (x * x + y * y);
  const ey = Math.asin(Math.max(-1, Math.min(1, m13)));
  if (Math.abs(m13) < 0.9999999) {
    return [Math.atan2(-m23, m33) / RAD, ey / RAD, Math.atan2(-m12, m11) / RAD];
  }
  return [Math.atan2(m32, m22) / RAD, ey / RAD, 0];
}

/** The `{Side}` token a genome's bone names carry: `Left` for +x, `Right` for -x. */
export const creatureSideLabel = (side: 1 | -1): 'Left' | 'Right' => (side > 0 ? 'Left' : 'Right');
