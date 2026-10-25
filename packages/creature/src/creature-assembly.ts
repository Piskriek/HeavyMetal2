/**
 * `@hm/creature` assembly: the declarative genome grown into an audited five-group `@hm/kitspec` kit (plan 44 section 2).
 *
 * The rule this file obeys, and the reason a creature needs no skinning at all:
 *
 *  **Every joint is a coaxial knuckle.** A limb link is a rigid `@hm/partgen` tube that stops short of the joint at each
 * end; a knuckle ball or a hinge disc sits exactly on the pivot, and the link is a *declared child* of the joint it hangs
 * from. A chain is therefore a declared `@hm/kitspec` joint throughout, so the audit treats the ball-in-socket overlap the
 * way it treats a bolt on a plate. Nothing is skinned, no vertex weights exist and no matrix is solved on the CPU: the
 * parts are placed once, in the rest pose, and a host rig (the Astro suit's Mixamo skeleton) turns the scene-graph nodes
 * they hang from.
 *
 * The kit is fitted so `kitAudit()` finds nothing to report:
 *
 *  - **Joint hierarchy.** `on: { child, socket }` placements are the joints: a child may interpenetrate its own parent,
 *    which is exactly what a knuckle is. Links are trimmed (`CREATURE_TRIM_M`) so two *siblings* — the upper and lower of
 *    a chain, a vertebra and its neighbour, a shin and its boot — never share space.
 *  - **Air gaps across groups.** `@hm/kitspec` can only mount a part on a sibling placement, so `base`, `structure`,
 *    `mechanism`, `controls` and `subject` cannot nest inside one another. Every cross-group contact is therefore held
 *    `CREATURE_CLEARANCE_M` apart and given a *standoff socket* on the neighbour: a socket is a mount datum and may sit
 *    outside the body that declares it, so the audit sees the part seated without the two solids overlapping.
 *  - **A deterministic settle.** Surface fittings (harness, plating, visor, telemetry, antenna, gloves) are placed by
 *    their genome's own mount, then fitted: the assembly flattens itself and pushes each fitting out of any neighbour it
 *    penetrates, along the shortest axis, until the boxes touch. Pure arithmetic, no clock, no randomness — the same
 *    genome always settles to the same millimetres, and the seat socket goes on whatever it ends up touching.
 *
 * A carapace is the one place where a box *contains* other parts, and the audit's model has no verb for containment: the
 * thoracic cage is therefore the declared parent of every vertebral body and hinge disc inside it, so each of those pairs
 * is a joint the audit accepts rather than an interpenetration it reports.
 *
 * The knuckles carry the kit's declared motion — a slow turn about their own axes — so the audit's eight motion phases
 * exercise real joints. The walk itself is not a `kitspec` motion: `evaluateCreatureGait()` solves it analytically.
 */
import {
  flatten,
  sourceBounds,
  type AssemblyDef,
  type Box3,
  type Kit,
  type KitMotionSpec,
  type PartDef,
  type Placement,
  type SocketDef,
  type Vec3,
} from '@hm/kitspec';
import {
  applyQuat,
  quatConj,
  quatFromEulerDeg,
  quatFromUnitVectors,
  quatMul,
  quatToEulerDeg,
  vAdd,
  vCross,
  vDot,
  vScale,
  vSub,
  vUnit,
  type CreatureGenomeSpec,
  type CreatureGroup,
  type CreatureQuat,
  type CreatureVec3,
  type KitSocketPartSpec,
} from './creature-spec';
import { creatureSkeleton, type CreatureSkeleton, type CreatureSpineFrame } from './creature-skeleton';

/** The preset every creature kit is flattened from. */
export const CREATURE_PRESET = 'creature';

/** The five group assemblies, in build order (the same order `kit-groups.ts` declares). */
export const CREATURE_ASSEMBLY_ORDER: readonly CreatureGroup[] = Object.freeze(['base', 'structure', 'mechanism', 'controls', 'subject']);

/** The air gap held between two parts that are not a declared joint. */
export const CREATURE_CLEARANCE_M = 0.006;

/** How far a link stops short of the joint at either end, so its siblings never meet. */
export const CREATURE_TRIM_M = 0.012;

/** The thickness of a hinge disc / of the sacral hub. */
export const CREATURE_DISC_M = 0.008;

/** A part as the assembly built it: where it went, which group owns it, and the host bone it binds to. */
export interface CreatureBuiltPart {
  readonly path: string;
  readonly part: string;
  readonly group: CreatureGroup;
  readonly bone: string | null;
}

export interface CreatureAssembly {
  readonly kit: Kit;
  readonly preset: string;
  readonly parts: readonly CreatureBuiltPart[];
  /** The bone each placed part binds to, by path (only the parts a genome gave a bone). */
  readonly bones: Readonly<Record<string, string>>;
  readonly skeleton: CreatureSkeleton;
}

/* ------------------------------------------------------------------ exact box arithmetic */

export interface CreatureAabb {
  readonly min: CreatureVec3;
  readonly max: CreatureVec3;
}

/** The box of a part source rotated by Euler `euler` degrees about its own origin. */
export function localAabb(source: PartDef['source'], euler: CreatureVec3): CreatureAabb {
  const box: Box3 = sourceBounds(source);
  const centre: CreatureVec3 = [(box.min[0] + box.max[0]) / 2, (box.min[1] + box.max[1]) / 2, (box.min[2] + box.max[2]) / 2];
  const half: CreatureVec3 = [(box.max[0] - box.min[0]) / 2, (box.max[1] - box.min[1]) / 2, (box.max[2] - box.min[2]) / 2];
  const q = quatFromEulerDeg(euler);
  const c = applyQuat(centre, q);
  const axes = [applyQuat([1, 0, 0], q), applyQuat([0, 1, 0], q), applyQuat([0, 0, 1], q)] as const;
  const min = [0, 0, 0];
  const max = [0, 0, 0];
  for (let i = 0; i < 3; i += 1) {
    let r = 0;
    for (let k = 0; k < 3; k += 1) r += Math.abs((axes[k] as CreatureVec3)[i] as number) * (half[k] as number);
    min[i] = (c[i] as number) - r;
    max[i] = (c[i] as number) + r;
  }
  return { min: min as unknown as CreatureVec3, max: max as unknown as CreatureVec3 };
}

/** A part source's box placed at `at` with Euler `euler` degrees: its axis-aligned box in the preset frame. */
export function aabbOf(source: PartDef['source'], at: CreatureVec3, euler: CreatureVec3): CreatureAabb {
  const b = localAabb(source, euler);
  return { min: vAdd(at, b.min), max: vAdd(at, b.max) };
}

const aabbCentre = (b: CreatureAabb): CreatureVec3 => [
  (b.min[0] + b.max[0]) / 2,
  (b.min[1] + b.max[1]) / 2,
  (b.min[2] + b.max[2]) / 2,
];

/** The gap between two axis-aligned boxes: 0 when they touch or overlap, positive when they are apart. */
function aabbGap(a: CreatureAabb, b: CreatureAabb): number {
  let gap = 0;
  for (let i = 0; i < 3; i += 1) {
    const d = Math.max((b.min[i] as number) - (a.max[i] as number), (a.min[i] as number) - (b.max[i] as number));
    gap = Math.max(gap, d);
  }
  return gap;
}

/** How far two axis-aligned boxes interpenetrate: 0 when they are apart or touching. */
function aabbOverlap(a: CreatureAabb, b: CreatureAabb): { depth: number; axis: 0 | 1 | 2; sign: 1 | -1 } {
  let best = { depth: 0, axis: 0 as 0 | 1 | 2, sign: 1 as 1 | -1 };
  let smallest = Number.POSITIVE_INFINITY;
  for (let i = 0; i < 3; i += 1) {
    const overlap = Math.min(a.max[i] as number, b.max[i] as number) - Math.max(a.min[i] as number, b.min[i] as number);
    if (overlap <= 0) return { depth: 0, axis: 0, sign: 1 };
    if (overlap < smallest) {
      smallest = overlap;
      const ca = (a.min[i] as number) + (a.max[i] as number);
      const cb = (b.min[i] as number) + (b.max[i] as number);
      best = { depth: overlap, axis: i as 0 | 1 | 2, sign: ca >= cb ? 1 : -1 };
    }
  }
  return best;
}

/** How far a placed part's solid reaches from its own origin along a world direction (its box's support). */
export function supportAlong(source: PartDef['source'], euler: CreatureVec3, dir: CreatureVec3): number {
  const b = localAabb(source, euler);
  return Math.max(vDot(b.min, dir), vDot(b.max, dir));
}

/** The Euler degrees (three.js 'XYZ') that turn a part's local +y onto `dir`. */
export const eulerForDirection = (dir: CreatureVec3): CreatureVec3 => quatToEulerDeg(quatFromUnitVectors([0, 1, 0], vUnit(dir)));

/** The local Euler a child needs to reach world orientation `child` under a parent at `parent`. */
const localEuler = (parent: CreatureQuat, child: CreatureQuat): CreatureVec3 => quatToEulerDeg(quatMul(quatConj(parent), child));

/** A point in a placed part's own frame, from its position in the preset frame (the inverse of the placement). */
function toLocal(point: CreatureVec3, at: CreatureVec3, euler: CreatureVec3): CreatureVec3 {
  return applyQuat(vSub(point, at), quatConj(quatFromEulerDeg(euler)));
}

type Face = 'front' | 'back' | 'top' | 'bottom' | 'left' | 'right';

/** The axis a face names and which way it points. */
const faceAxis = (face: Face): { axis: 0 | 1 | 2; sign: 1 | -1 } => {
  switch (face) {
    case 'left': return { axis: 0, sign: 1 };
    case 'right': return { axis: 0, sign: -1 };
    case 'top': return { axis: 1, sign: 1 };
    case 'bottom': return { axis: 1, sign: -1 };
    case 'front': return { axis: 2, sign: 1 };
    case 'back': return { axis: 2, sign: -1 };
  }
};

/** The two in-plane axes of a face, in a stable order. */
const facePlane = (axis: 0 | 1 | 2): [0 | 1 | 2, 0 | 1 | 2] => (axis === 0 ? [1, 2] : axis === 1 ? [0, 2] : [0, 1]);

/**
 * Where a part's origin goes so that its box sits `gap` outside one face of a target box, at in-plane offset `u`/`w`
 * from that face's centre. This is the tangency the assembly is built on: a face is met by a face, never by eye.
 */
export function tangentAt(target: CreatureAabb, source: PartDef['source'], euler: CreatureVec3, face: Face, u = 0, w = 0, gap = CREATURE_CLEARANCE_M): CreatureVec3 {
  const { axis, sign } = faceAxis(face);
  const [ua, wa] = facePlane(axis);
  const child = localAabb(source, euler);
  const centre = aabbCentre(target);
  const at: number[] = [centre[0], centre[1], centre[2]];
  at[ua] = (centre[ua] as number) + u;
  at[wa] = (centre[wa] as number) + w;
  at[axis] = sign > 0
    ? (target.max[axis] as number) + gap - (child.min[axis] as number)
    : (target.min[axis] as number) - gap - (child.max[axis] as number);
  return at as unknown as CreatureVec3;
}

/* ------------------------------------------------------------------ part factory */

const param = (gen: string, params: Readonly<Record<string, number>>): PartDef['source'] => ({ kind: 'param', gen, params });

interface PartOptions {
  readonly material: string;
  readonly rank?: 0 | 1 | 2;
  readonly motion?: KitMotionSpec;
  readonly slotMaterials?: Readonly<Record<string, string>>;
}

const partDef = (source: PartDef['source'], o: PartOptions): PartDef => ({
  source,
  material: o.material,
  rank: o.rank ?? 1,
  ...(o.motion ? { motion: o.motion } : {}),
  ...(o.slotMaterials ? { slotMaterials: o.slotMaterials } : {}),
});

/** A joint that turns slowly about its own axis: a sphere or a disc is rotation-invariant, so the audit sees motion. */
const spin = (rateHz: number, phase: number, amplitude: number, axis: 'x' | 'y' | 'z' = 'y'): KitMotionSpec => ({
  kind: 'oscillate',
  axis,
  rateHz,
  amplitude,
  phaseRad: phase,
});

/* ------------------------------------------------------------------ the builder */

/** One vertebral body as the assembly placed it. */
interface Body {
  readonly index: number;
  readonly id: string;
  readonly source: PartDef['source'];
  readonly at: CreatureVec3;
  readonly euler: CreatureVec3;
  readonly length: number;
  readonly frame: CreatureSpineFrame;
}

/** How far off perpendicular one segment runs to the next: the sine of the bend, for a disc's rim to clear by. */
const bendSin = (a: CreatureVec3, b: CreatureVec3): number => {
  const c = vCross(vUnit(a), vUnit(b));
  return Math.min(1, Math.sqrt(vDot(c, c)));
};

/**
 * Grow a genome into a `@hm/kitspec` kit: five group assemblies, every part placed on the rest pose the genome resolves.
 * Pure: the same genome gives the same kit, part for part and matrix for matrix.
 */
export function creatureAssembly(genome: CreatureGenomeSpec): CreatureAssembly {
  const skeleton = creatureSkeleton(genome);
  const mat = genome.pelvis.matPresetId;
  const gaitHz = genome.strideFreqHz ?? 1.6;

  const parts: Record<string, PartDef> = {};
  const sockets: Record<string, Record<string, SocketDef>> = {};
  const built: CreatureBuiltPart[] = [];
  const bones: Record<string, string> = {};
  /** The placements the settle pass seats (and, when movable, fits), keyed by their own placement object. */
  const fittings: Fitting[] = [];

  const add = (id: string, def: PartDef): string => {
    if (parts[id]) throw new Error(`@hm/creature: duplicate part id '${id}'`);
    parts[id] = def;
    return id;
  };
  const socket = (id: string, name: string, at: CreatureVec3): void => {
    const set = (sockets[id] ??= {});
    set[name] = { at: at as unknown as Vec3 };
  };
  const record = (path: string, part: string, group: CreatureGroup, bone: string | null): void => {
    built.push({ path, part, group, bone });
    if (bone) bones[path] = bone;
  };
  /**
   * A surface fitting: placed absolutely (its `at` is in the preset frame) and seated by the settle pass. `movable`
   * fittings are also pushed out of whatever they penetrate; a fixed one only gets its seat socket.
   */
  const fitting = (
    id: string,
    source: PartDef['source'],
    at: CreatureVec3,
    euler: CreatureVec3,
    target: string,
    group: CreatureGroup,
    bone: string | null,
    rot?: CreatureVec3,
    movable = true,
  ): Placement => {
    const placement: Placement = {
      ref: id,
      key: id,
      at: at as unknown as Vec3,
      ...(rot ? { rot } : {}),
    };
    fittings.push({ placement, source, euler, target, movable });
    record(`${group}/${id}`, id, group, bone);
    return placement;
  };

  const sacrum = skeleton.sacrum;

  /* ---------------------------------------------------------------- the axial chain, resolved before the pelvis */

  const discR = (frame: CreatureSpineFrame): number => Math.max(0.02, Math.min(frame.spec.radiusX, frame.spec.radiusY) * 0.72);
  const hubRadius = Math.max(0.055, (skeleton.spine[0]?.spec.radiusX ?? 0.1) * 1.02);
  const bends = skeleton.spine.map((frame, i) => {
    const prev = i === 0 ? ([0, 1, 0] as CreatureVec3) : (skeleton.spine[i - 1] as CreatureSpineFrame).dir;
    return bendSin(prev, frame.dir);
  });
  const vertebraeSource = (frame: CreatureSpineFrame, length: number): PartDef['source'] => param('vertebra', {
    length,
    radiusX: frame.spec.radiusX,
    radiusY: frame.spec.radiusY,
    sides: 8,
    keel: 0.22,
    collar: frame.kind === 'cranium' ? 0.75 : 0.55,
  });
  const jointTrim = (frame: CreatureSpineFrame, next: CreatureSpineFrame | undefined): number =>
    CREATURE_DISC_M / 2 + CREATURE_CLEARANCE_M + (next ? discR(frame) * bendSin(frame.dir, next.dir) : 0);
  const knuckleBox = (radius: number, at: CreatureVec3, dir: CreatureVec3): CreatureAabb => aabbOf(
    param('knuckle', { radius: Math.max(0.02, radius), sides: 10, rings: 4, bossFactor: 0.4 }),
    at,
    quatToEulerDeg(quatFromUnitVectors([0, 1, 0], dir)),
  );

  const allBalls = skeleton.limbs.map((l) => knuckleBox(l.knuckleRadius, l.root, l.upperDir));
  const hipBalls = skeleton.limbs
    .filter((l) => l.spec.parentSegmentId === 'pelvis')
    .map((l) => knuckleBox(l.knuckleRadius, l.root, l.upperDir));
  const shoulderBalls = skeleton.limbs
    .filter((l) => l.spec.parentSegmentId !== 'pelvis')
    .map((l) => knuckleBox(l.knuckleRadius, l.root, l.upperDir));

  /* ---------------------------------------------------------------- the trunk, whose box the pelvis must clear */

  const spineDir: CreatureVec3 = skeleton.spine[0]?.dir ?? [0, 1, 0];
  const spineQuat = quatFromUnitVectors([0, 1, 0], vUnit(spineDir));
  const firstSpine = skeleton.spine[0];
  const cageAnchor: CreatureVec3 = firstSpine
    ? vAdd(firstSpine.end, vScale(firstSpine.dir, jointTrim(firstSpine, skeleton.spine[1])))
    : vAdd(sacrum, [0, 0.12, 0]);
  const cageEuler = eulerForDirection(spineDir);
  const cageQuat = spineQuat;
  const along = (point: CreatureVec3): number => vDot(vSub(point, cageAnchor), spineDir);
  const neckLike = skeleton.spine.find((s) => s.kind !== 'vertebra');
  const lastSpine = skeleton.spine[skeleton.spine.length - 1];
  const cageTo = Math.max(
    neckLike ? along(neckLike.start) - CREATURE_CLEARANCE_M : Number.NEGATIVE_INFINITY,
    lastSpine ? along(lastSpine.end) - CREATURE_CLEARANCE_M : 0.16,
    0.16,
  );
  const cageHeight = Math.max(0.16, cageTo);
  const outerX = (b: CreatureAabb): number => Math.min(Math.abs(b.min[0]), Math.abs(b.max[0]));
  const cageWidth = shoulderBalls.length > 0
    ? Math.max(0.12, 2 * (Math.min(...shoulderBalls.map(outerX)) - 3 * CREATURE_CLEARANCE_M))
    : Math.max(0.12, Math.max(0.12, genome.pelvis.radius[0] * 2) * 0.8);
  const cageDepth = Math.max(0.12, genome.torso?.depth ?? 0.22);
  const cageSource = param('can', {
    width: cageWidth,
    depth: cageDepth,
    height: cageHeight,
    bevel: Math.min(0.035, cageWidth * 0.1),
    baseBand: 0.1,
    bands: 2,
  });
  const cageBoxUnlifted = aabbOf(cageSource, cageAnchor, cageEuler);
  /** The trunk's placement: lifted off the pelvis's top plane when the two would share space. */
  let cagePlaceAt: CreatureVec3 = cageAnchor;
  let cageBox: CreatureAabb = cageBoxUnlifted;

  /* ---------------------------------------------------------------- base: the pelvic root and its harness */

  // the pelvis is the slab between the femoral balls below it and every limb or trunk that hangs above it
  const pelvisBottom = hipBalls.length > 0 ? Math.max(...hipBalls.map((b) => b.max[1])) + CREATURE_CLEARANCE_M : sacrum[1] - 0.16;
  const intruders = allBalls.filter((b) => b.min[1] >= pelvisBottom + 0.02).map((b) => b.min[1]);
  // the trunk's underside: a horizontal spine's vertebral bodies straddle their own axis, so the pelvis's slab has to
  // stop below them or the two solids share space across the base/structure line, which kitspec cannot joint
  const spineLowY = skeleton.spine.reduce((low, frame, i) => {
    const next = skeleton.spine[i + 1];
    const euler = eulerForDirection(frame.dir);
    const seat = vAdd(frame.start, vScale(frame.dir, CREATURE_DISC_M / 2 + CREATURE_CLEARANCE_M));
    const source = vertebraeSource(frame, Math.max(0.03, frame.spec.length - jointTrim(frame, next)));
    return Math.min(low, aabbOf(source, seat, euler).min[1]);
  }, Number.POSITIVE_INFINITY);
  const pelvisTopLimit = Math.min(
    sacrum[1] - CREATURE_DISC_M - CREATURE_CLEARANCE_M,
    ...(intruders.length > 0 ? intruders.map((y) => y - CREATURE_CLEARANCE_M) : [Number.POSITIVE_INFINITY]),
    spineLowY - CREATURE_CLEARANCE_M,
  );
  const pelvisHeight = Math.max(0.05, Math.min(sacrum[1] - pelvisBottom, pelvisTopLimit - pelvisBottom));
  const pelvisWidth = Math.max(0.12, genome.pelvis.radius[0] * 2);
  const pelvisDepth = Math.max(0.12, genome.pelvis.radius[2] * 2);
  const pelvisSource = param('can', {
    width: pelvisWidth,
    depth: pelvisDepth,
    height: pelvisHeight,
    bevel: Math.min(0.03, pelvisHeight * 0.25),
    baseBand: 0.18,
    bands: 2,
  });
  const pelvisAt: CreatureVec3 = [0, pelvisBottom, 0];
  const pelvisBox = aabbOf(pelvisSource, pelvisAt, [0, 0, 0]);
  const pelvisAbove = pelvisBox.max[1] - pelvisBottom;
  const trunkLift = Math.max(0, pelvisBox.max[1] + 2 * CREATURE_CLEARANCE_M - cageBoxUnlifted.min[1]);
  if (trunkLift > 0) {
    cagePlaceAt = [cageAnchor[0], cageAnchor[1] + trunkLift, cageAnchor[2]];
    cageBox = aabbOf(cageSource, cagePlaceAt, cageEuler);
  }
  add('pelvis', partDef(pelvisSource, { material: mat, rank: 2 }));
  socket('pelvis', 'sacrum', [0, pelvisAbove / 2, 0]);
  const baseChildren: Placement[] = [{ ref: 'pelvis', key: 'pelvis', at: pelvisAt as unknown as Vec3 }];
  record('base/pelvis', 'pelvis', 'base', genome.pelvis.bone ?? null);

  for (const [i, spec] of (genome.harness ?? []).entries()) {
    const id = `harness-${i}`;
    const source = param(spec.gen, spec.params ?? {});
    add(id, partDef(source, {
      material: spec.material || mat,
      rank: spec.rank ?? 2,
      ...(spec.slotMaterials ? { slotMaterials: spec.slotMaterials } : {}),
    }));
    const offset = (spec.at ?? [0, pelvisAbove * 0.4, pelvisDepth * 0.55]) as CreatureVec3;
    const at = vAdd(pelvisAt, offset);
    // a harness is bolted to the pelvis: a declared joint, so the pelvis's box may hold it
    socket('pelvis', `harness-${i}`, toLocal(at, pelvisAt, [0, 0, 0]));
    baseChildren.push({ ref: id, key: `harness-${i}`, on: { child: 0, socket: `harness-${i}` }, ...(spec.rot ? { rot: spec.rot } : {}) });
    record(`base/harness-${i}`, id, 'base', spec.bone ?? null);
  }

  /* ---------------------------------------------------------------- structure: the Sushumna axis and the cage */

  const structureChildren: Placement[] = [];
  const hubBottom = Math.max(sacrum[1], pelvisBox.max[1]) + CREATURE_CLEARANCE_M;
  const hubAt: CreatureVec3 = [sacrum[0], hubBottom + CREATURE_DISC_M / 2, sacrum[2]];
  const hubSource = param('disc', { radius: hubRadius, thickness: CREATURE_DISC_M, sides: 12, rimFactor: 0.4 });
  const hubBox = aabbOf(hubSource, hubAt, [0, 0, 0]);
  add('sacral-hub', partDef(hubSource, { material: mat, rank: 2 }));
  socket('sacral-hub', 'spine', [0, CREATURE_DISC_M / 2 + CREATURE_CLEARANCE_M, 0]);
  structureChildren.push(fitting('sacral-hub', hubSource, hubAt, [0, 0, 0], 'base/pelvis', 'structure', null, undefined, false));
  const hubTop: CreatureVec3 = [hubAt[0], hubBox.max[1], hubAt[2]];

  // the vertebral bodies: each one trimmed inside its segment, so a hinge disc always has room on either side
  const bodies: Body[] = [];
  for (const [i, frame] of skeleton.spine.entries()) {
    const id = `spine-${i}`;
    const euler = eulerForDirection(frame.dir);
    const next = skeleton.spine[i + 1];
    const trim = jointTrim(frame, next);
    let at: CreatureVec3;
    let offset: number;
    if (i === 0) {
      // the sacral body sits on the hub's own top plane, lifted by however far its box hangs below its axis
      const dip = -localAabb(vertebraeSource(frame, Math.max(0.03, frame.spec.length - trim)), euler).min[1];
      at = [hubTop[0], hubTop[1] + CREATURE_CLEARANCE_M + Math.max(0, dip), hubTop[2]];
      offset = Math.max(CREATURE_DISC_M / 2 + CREATURE_CLEARANCE_M, vDot(vSub(at, frame.start), frame.dir));
    } else {
      const rim = discR(skeleton.spine[i - 1] as CreatureSpineFrame) * (bends[i] as number);
      offset = CREATURE_DISC_M / 2 + CREATURE_CLEARANCE_M + rim;
      at = vAdd(frame.start, vScale(frame.dir, offset));
    }
    const length = Math.max(0.03, frame.spec.length - offset - trim);
    const source = vertebraeSource(frame, length);
    add(id, partDef(source, { material: frame.spec.matPresetId || mat, rank: 2 }));
    socket(id, 'distal', [0, offset + length + trim, 0]);
    bodies.push({ index: i, id, source, at, euler, length, frame });
  }

  const lumbar = bodies[0];
  if (lumbar) {
    // the sacral vertebra is the pelvis's own: a declared joint, so the pelvis's box may close around it
    socket('pelvis', 'lumbar', toLocal(lumbar.at, pelvisAt, [0, 0, 0]));
    baseChildren.push({
      ref: lumbar.id,
      key: 'spine-0',
      on: { child: 0, socket: 'lumbar' },
      rot: lumbar.euler as unknown as Vec3,
    });
    record('base/spine-0', lumbar.id, 'base', lumbar.frame.bone);
  }

  // the thoracic cage: mounted on the lumbar's distal joint, running up the spine and wide enough to clear the shoulders
  add('rib-cage', partDef(cageSource, { material: genome.torso?.material ?? mat, rank: 2 }));
  structureChildren.push(fitting('rib-cage', cageSource, cagePlaceAt, cageEuler, lumbar ? 'base/spine-0' : 'base/pelvis', 'structure', null, cageEuler, false));
  const cageIndex = structureChildren.length - 1;

  // every remaining body and every hinge disc is a declared child of the cage (the trunk's own interior)
  for (const body of bodies.slice(1)) {
    socket('rib-cage', `body-${body.index}`, toLocal(body.at, cageAnchor, cageEuler));
    structureChildren.push({
      ref: body.id,
      key: `spine-${body.index}`,
      on: { child: cageIndex, socket: `body-${body.index}` },
      rot: localEuler(cageQuat, quatFromEulerDeg(body.euler)) as unknown as Vec3,
    });
    record(`structure/spine-${body.index}`, body.id, 'structure', body.frame.bone);
  }
  for (let i = 0; i + 1 < bodies.length; i += 1) {
    const lower = bodies[i] as Body;
    const joint = lower.frame.end;
    const id = `spine-joint-${i}`;
    const source = param('disc', { radius: discR(lower.frame), thickness: CREATURE_DISC_M, sides: 10, rimFactor: 0.35 });
    add(id, partDef(source, { material: mat, rank: 2 }));
    socket('rib-cage', `joint-${i}`, toLocal(joint, cageAnchor, cageEuler));
    structureChildren.push({
      ref: id,
      key: `spine-joint-${i}`,
      on: { child: cageIndex, socket: `joint-${i}` },
      rot: localEuler(cageQuat, quatFromUnitVectors([0, 1, 0], vUnit(lower.frame.dir))) as unknown as Vec3,
    });
    record(`structure/spine-joint-${i}`, id, 'structure', null);
  }

  // the cage's face sockets: where plating, the life-support pack and the senses mount
  for (const face of ['front', 'back', 'top', 'bottom', 'left', 'right'] as const) {
    const { axis, sign } = faceAxis(face);
    const centre = aabbCentre(cageBox);
    const at: number[] = [centre[0], centre[1], centre[2]];
    at[axis] = sign > 0 ? (cageBox.max[axis] as number) : (cageBox.min[axis] as number);
    socket('rib-cage', face, toLocal(at as unknown as CreatureVec3, cageAnchor, cageEuler));
  }

  /* ---------------------------------------------------------------- mechanism: the limb chains */

  const mechanismChildren: Placement[] = [];
  const endJoints: Record<string, { readonly at: CreatureVec3; readonly euler: CreatureVec3; readonly dir: CreatureVec3; readonly radius: number; readonly far: number }> = {};

  for (const limb of skeleton.limbs) {
    const label = limb.label;
    const ballR = Math.max(0.02, limb.knuckleRadius);
    const upperQuat = quatFromUnitVectors([0, 1, 0], limb.upperDir);
    const lowerQuat = quatFromUnitVectors([0, 1, 0], limb.lowerDir);
    const effectorQuat = quatFromUnitVectors([0, 1, 0], limb.effectorDir);
    const upperEuler = quatToEulerDeg(upperQuat);
    const effectorEuler = quatToEulerDeg(effectorQuat);
    // a leg is what the genome says carries weight: a hand grips, a tail sways, neither stands on the floor
    const isLeg = limb.role === 'leg';
    const midR = Math.max(0.022, Math.min(limb.upperRadius, limb.lowerRadius) * 1.35);
    const endR = Math.max(0.02, isLeg ? ballR * 0.8 : ballR * 0.7);
    const phase = limb.gaitPhaseOffset * Math.PI * 2;

    // 1. the femoral / humeral ball: centred on the chain's root joint, its own axis following the upper link
    const ballId = `${label}-knuckle-root`;
    const ballSource = param('knuckle', { radius: ballR, sides: 10, rings: 4, bossFactor: 0.4 });
    add(ballId, partDef(ballSource, { material: mat, rank: 2 }));
    socket(ballId, 'hub', [0, 0, 0]);
    mechanismChildren.push({ ref: ballId, key: `${label}-knuckle-root`, at: limb.root as unknown as Vec3, rot: upperEuler as unknown as Vec3 });
    record(`mechanism/${label}-knuckle-root`, ballId, 'mechanism', null);
    const ballIndex = mechanismChildren.length - 1;

    // 2. the upper link: a tube from the ball's surface to a knuckle's width short of the middle joint
    const upperId = `${label}-upper`;
    const upperLen = Math.max(0.03, limb.upperLength - midR - CREATURE_CLEARANCE_M);
    add(upperId, partDef(
      param('pipe', { radius: limb.upperRadius, length: upperLen, sides: 8, flangeWidth: Math.min(0.02, limb.upperRadius * 0.4), elbow: 0, armLength: 0.2 }),
      { material: mat, rank: 2 },
    ));
    socket(upperId, 'distal', [0, limb.upperLength, 0]);
    mechanismChildren.push({ ref: upperId, key: `${label}-upper`, on: { child: ballIndex, socket: 'hub' } });
    record(`mechanism/${label}-upper`, upperId, 'mechanism', limb.bones.upper);
    const upperIndex = mechanismChildren.length - 1;

    // 3. the hinge disc at the middle joint: its axis is the chain's own hinge, its centre the solver's joint
    const midId = `${label}-knuckle-mid`;
    const hinge = vUnit(vCross(limb.upperDir, limb.lowerDir), [1, 0, 0]);
    const midQuat = quatFromUnitVectors([0, 1, 0], hinge);
    const midSource = param('disc', { radius: midR, thickness: Math.max(0.014, midR * 0.4), sides: 10, rimFactor: 0.4 });
    add(midId, partDef(midSource, { material: mat, rank: 2, motion: spin(gaitHz, phase + Math.PI * 0.5, 6) }));
    socket(midId, 'hub', [0, 0, 0]);
    mechanismChildren.push({ ref: midId, key: `${label}-knuckle-mid`, on: { child: upperIndex, socket: 'distal' }, rot: localEuler(upperQuat, midQuat) as unknown as Vec3 });
    record(`mechanism/${label}-knuckle-mid`, midId, 'mechanism', null);
    const midIndex = mechanismChildren.length - 1;

    // 4. the lower link, hanging from the hinge disc at the same joint
    const lowerId = `${label}-lower`;
    const lowerLen = Math.max(0.03, limb.lowerLength - endR - CREATURE_CLEARANCE_M);
    add(lowerId, partDef(
      param('pipe', { radius: limb.lowerRadius, length: lowerLen, sides: 8, flangeWidth: Math.min(0.018, limb.lowerRadius * 0.4), elbow: 0, armLength: 0.2 }),
      { material: mat, rank: 2 },
    ));
    socket(lowerId, 'distal', [0, limb.lowerLength, 0]);
    mechanismChildren.push({ ref: lowerId, key: `${label}-lower`, on: { child: midIndex, socket: 'hub' }, rot: localEuler(midQuat, lowerQuat) as unknown as Vec3 });
    record(`mechanism/${label}-lower`, lowerId, 'mechanism', limb.bones.lower);
    const lowerIndex = mechanismChildren.length - 1;

    // 5. the distal knuckle (ankle / wrist), whose own axis follows the effector
    const endId = `${label}-knuckle-end`;
    const endSource = param('knuckle', { radius: endR, sides: 10, rings: 4, bossFactor: 0.3 });
    add(endId, partDef(endSource, { material: mat, rank: 2, motion: spin(gaitHz, phase + Math.PI, 6) }));
    socket(endId, 'foot', [0, 0, 0]);
    socket(endId, 'seat', [0, endR + CREATURE_CLEARANCE_M, 0]);
    mechanismChildren.push({ ref: endId, key: `${label}-knuckle-end`, on: { child: lowerIndex, socket: 'distal' }, rot: localEuler(lowerQuat, effectorQuat) as unknown as Vec3 });
    record(`mechanism/${label}-knuckle-end`, endId, 'mechanism', null);
    const endIndex = mechanismChildren.length - 1;
    endJoints[label] = { at: limb.end, euler: effectorEuler, dir: limb.effectorDir, radius: endR, far: endR + CREATURE_CLEARANCE_M };

    if (isLeg) {
      const bootId = `${label}-${limb.effectorKind}`;
      const bootWidth = Math.max(0.07, limb.lowerRadius * 3.2);
      const bootLength = Math.max(0.05, limb.effectorLength - endR * 0.5);
      const bootSource = param('can', {
        width: bootWidth,
        depth: bootWidth * 1.7,
        height: bootLength,
        bevel: bootWidth * 0.18,
        baseBand: 0.12,
        bands: 1,
      });
      add(bootId, partDef(bootSource, { material: `effector-${limb.effectorKind}`, rank: 2, slotMaterials: { trim: mat } }));
      // the sole is planted: the boot slides along the ankle's own axis until its lowest corner is on the genome's ground
      const bootDrop = -localAabb(bootSource, effectorEuler).min[1];
      const dropY = limb.effectorDir[1];
      const plant = Math.abs(dropY) > 1e-6 ? (skeleton.groundY + bootDrop - limb.end[1]) / dropY : endR + CREATURE_CLEARANCE_M;
      mechanismChildren.push({
        ref: bootId,
        key: `${label}-${limb.effectorKind}`,
        on: { child: endIndex, socket: 'foot' },
        at: [0, plant, 0] as Vec3,
      });
      record(`mechanism/${label}-${limb.effectorKind}`, bootId, 'mechanism', limb.bones.effector);
      endJoints[label] = {
        at: limb.end,
        euler: effectorEuler,
        dir: limb.effectorDir,
        radius: endR,
        far: endR + CREATURE_CLEARANCE_M + supportAlong(bootSource, effectorEuler, limb.effectorDir),
      };
    }
  }

  /* ---------------------------------------------------------------- controls: sensory & telemetry organs */

  const controlsChildren: Placement[] = [];
  const spineById = new Map<string, Body>(bodies.map((b) => [b.frame.spec.id, b]));
  const boxOfBody = (b: Body): CreatureAabb => aabbOf(b.source, b.at, b.euler);

  for (const [i, spec] of genome.sensoryControls.entries()) {
    const id = `control-${i}`;
    const source = param(spec.gen, spec.params ?? {});
    const euler = (spec.rot ?? [0, 0, 0]) as CreatureVec3;
    const seat = seatOf(spec, source, euler, cageBox, pelvisBox, spineById, boxOfBody);
    add(id, partDef(source, {
      material: spec.material || mat,
      rank: spec.rank ?? 2,
      ...(spec.slotMaterials ? { slotMaterials: spec.slotMaterials } : {}),
    }));
    controlsChildren.push(fitting(id, source, seat, euler, 'structure/rib-cage', 'controls', spec.bone ?? null, spec.rot, true));
  }

  /* ---------------------------------------------------------------- subject: manipulators & weapons */

  const subjectChildren: Placement[] = [];
  for (const [i, spec] of genome.subjectEffectors.entries()) {
    const id = `subject-${i}`;
    const source = param(spec.gen, spec.params ?? {});
    const mount = spec.mount.startsWith('limb:') ? spec.mount.slice('limb:'.length) : '';
    const joint = endJoints[mount];
    const euler = joint ? joint.euler : ((spec.rot ?? [0, 0, 0]) as CreatureVec3);
    const ownBack = Math.max(0, -localAabb(source, euler).min[1]);
    const at = joint
      ? vAdd(joint.at, vScale(joint.dir, joint.far + CREATURE_CLEARANCE_M + ownBack))
      : seatOf(spec, source, euler, cageBox, pelvisBox, spineById, boxOfBody);
    add(id, partDef(source, {
      material: spec.material || mat,
      rank: spec.rank ?? 2,
      ...(spec.slotMaterials ? { slotMaterials: spec.slotMaterials } : {}),
    }));
    subjectChildren.push(fitting(id, source, at, euler, `mechanism/${mount}-knuckle-end`, 'subject', spec.bone ?? null, euler, true));
  }

  /* ---------------------------------------------------------------- armour: plating, packs and the helmet */

  const armourChildren: Placement[] = [];
  for (const [i, spec] of (genome.armour ?? []).entries()) {
    const id = `armour-${i}`;
    const source = param(spec.gen, spec.params ?? {});
    const euler = (spec.rot ?? [0, 0, 0]) as CreatureVec3;
    const [target, slot] = spec.mount.split('.');
    const body = target ? spineById.get(target) : undefined;
    const offset = (spec.at ?? [0, 0, 0]) as CreatureVec3;
    let at: CreatureVec3;
    let rotation: CreatureVec3 = euler;
    let seatTarget = 'structure/rib-cage';
    if (body && (slot === 'segment' || slot === 'mid' || slot === undefined)) {
      // a collar around this body's own distal end: seated inside the body's own span, clear of its neighbour
      const b = localAabb(source, [0, 0, 0]);
      const half = (b.max[1] - b.min[1]) / 2;
      const along = Math.max(0, body.length - CREATURE_TRIM_M - half);
      at = vAdd(body.at, vScale(body.frame.dir, along));
      rotation = body.euler;
      seatTarget = `structure/spine-${body.index}`;
    } else {
      const targetBox = body ? boxOfBody(body) : cageBox;
      const face = (slot && slot !== 'segment' ? slot : 'back') as Face;
      at = tangentAt(targetBox, source, euler, face, offset[0], offset[1], 3 * CREATURE_CLEARANCE_M);
      if (body) seatTarget = `structure/spine-${body.index}`;
    }
    add(id, partDef(source, {
      material: spec.material || mat,
      rank: spec.rank ?? 2,
      ...(spec.slotMaterials ? { slotMaterials: spec.slotMaterials } : {}),
    }));
    armourChildren.push(fitting(id, source, at, rotation, seatTarget, 'structure', spec.bone ?? null, rotation, true));
  }

  /* ---------------------------------------------------------------- the assemblies, the settle, the seats */

  const assemblies: Record<string, AssemblyDef> = {
    base: { children: baseChildren },
    structure: { children: [...structureChildren, ...armourChildren] },
    mechanism: { children: mechanismChildren },
    controls: { children: controlsChildren },
    subject: { children: subjectChildren },
  };
  assemblies[CREATURE_PRESET] = {
    children: CREATURE_ASSEMBLY_ORDER.map((g) => ({ ref: g, key: g })),
    sockets: { root: { at: pelvisAt as unknown as Vec3 } },
  };

  const kit: Kit = { parts, assemblies };
  for (const [path, targetPart, local] of settleFittings(kit, fittings)) {
    const name = path.split('/').pop() ?? path;
    socket(targetPart, `seat-${name}`, local);
  }

  return { kit: { parts: mergeSockets(parts, sockets), assemblies }, preset: CREATURE_PRESET, parts: built, bones, skeleton };
}

/** Build the genome's audited five-group kit (the friendly name for `creatureAssembly(genome).kit`). */
export function buildCreatureKit(genome: CreatureGenomeSpec): Kit {
  return creatureAssembly(genome).kit;
}

/**
 * The host bone each placed part binds to, by part path: what a rigged host (the Astro suit's Mixamo skeleton) parents its
 * rigid parts to. Parts the genome gave no bone are absent: the kit's own motion specs pose them.
 */
export function creaturePartBones(genome: CreatureGenomeSpec): Readonly<Record<string, string>> {
  return creatureAssembly(genome).bones;
}

/* ------------------------------------------------------------------ the settle */

interface Fitting {
  readonly placement: Placement;
  readonly source: PartDef['source'];
  readonly euler: CreatureVec3;
  readonly target: string;
  readonly movable: boolean;
}

/** A placed part as the settle sees it: its path, part, world matrix and box. */
interface SettledPart {
  readonly path: string;
  readonly part: string;
  readonly matrix: readonly number[];
  readonly box: CreatureAabb;
}

const boxOfMatrix = (source: PartDef['source'], m: readonly number[]): CreatureAabb => {
  const b = sourceBounds(source);
  let min: CreatureVec3 = [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY];
  let max: CreatureVec3 = [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY];
  for (let k = 0; k < 8; k += 1) {
    const p: CreatureVec3 = [k & 1 ? b.max[0] : b.min[0], k & 2 ? b.max[1] : b.min[1], k & 4 ? b.max[2] : b.min[2]];
    const w: CreatureVec3 = [
      (m[0] as number) * p[0] + (m[4] as number) * p[1] + (m[8] as number) * p[2] + (m[12] as number),
      (m[1] as number) * p[0] + (m[5] as number) * p[1] + (m[9] as number) * p[2] + (m[13] as number),
      (m[2] as number) * p[0] + (m[6] as number) * p[1] + (m[10] as number) * p[2] + (m[14] as number),
    ];
    min = [Math.min(min[0], w[0]), Math.min(min[1], w[1]), Math.min(min[2], w[2])];
    max = [Math.max(max[0], w[0]), Math.max(max[1], w[1]), Math.max(max[2], w[2])];
  }
  return { min, max };
};

/** A world point in a placed part's own frame, from the flattened matrix (the inverse placement, rotation included). */
const pointInFrame = (point: CreatureVec3, m: readonly number[]): CreatureVec3 => {
  const d: CreatureVec3 = [point[0] - (m[12] as number), point[1] - (m[13] as number), point[2] - (m[14] as number)];
  return [
    (m[0] as number) * d[0] + (m[1] as number) * d[1] + (m[2] as number) * d[2],
    (m[4] as number) * d[0] + (m[5] as number) * d[1] + (m[6] as number) * d[2],
    (m[8] as number) * d[0] + (m[9] as number) * d[1] + (m[10] as number) * d[2],
  ];
};

const worldOrigin = (m: readonly number[]): CreatureVec3 => [m[12] as number, m[13] as number, m[14] as number];

/**
 * Fit the surface fittings: flatten the kit, push every fitting out of any neighbour it penetrates along the shortest
 * axis until the boxes touch, then name the nearest part as its seat. `kit` is mutated in place (the placements' `at`),
 * and the seats come back as `[fitting path, seating part id, the seat in that part's own frame]`.
 */
function settleFittings(kit: Kit, fittings: readonly Fitting[]): [string, string, CreatureVec3][] {
  const keyOf = (f: Fitting): string => f.placement.key ?? f.placement.ref;
  const iterate = (): SettledPart[] =>
    flatten(kit, CREATURE_PRESET).map((p) => ({ path: p.path, part: p.part, matrix: p.matrix, box: boxOfMatrix(p.source, p.matrix) }));

  let placed = iterate();
  const movable = fittings.filter((f) => f.movable);
  for (let sweep = 0; sweep < 3; sweep += 1) {
    let anyMoved = false;
    for (const f of movable) {
      const key = keyOf(f);
      for (let push = 0; push < 8; push += 1) {
        const self = placed.find((p) => p.path === key || p.path.endsWith(`/${key}`));
        if (!self) break;
        let hit: { depth: number; axis: 0 | 1 | 2; sign: 1 | -1 } | null = null;
        for (const other of placed) {
          if (other.path === self.path) continue;
          const overlap = aabbOverlap(self.box, other.box);
          if (overlap.depth > 0) {
            hit = overlap;
            break;
          }
        }
        if (!hit) break;
        const at = (f.placement.at ?? [0, 0, 0]) as CreatureVec3;
        const delta: CreatureVec3 = [0, 0, 0];
        (delta as unknown as number[])[hit.axis] = hit.sign * (hit.depth + 0.0005);
        (f.placement as { at?: Vec3 }).at = vAdd(at, delta) as unknown as Vec3;
        anyMoved = true;
        placed = iterate();
      }
    }
    if (!anyMoved) break;
  }

  const seats: [string, string, CreatureVec3][] = [];
  for (const f of fittings) {
    const key = keyOf(f);
    const self = placed.find((p) => p.path === key || p.path.endsWith(`/${key}`));
    if (!self) continue;
    let best: SettledPart | null = null;
    let bestGap = Number.POSITIVE_INFINITY;
    for (const other of placed) {
      if (other.path === self.path) continue;
      const gap = aabbGap(self.box, other.box);
      if (gap < bestGap) {
        bestGap = gap;
        best = other;
      }
    }
    if (!best) continue;
    seats.push([self.path, best.part, pointInFrame(worldOrigin(self.matrix), best.matrix)]);
  }
  return seats;
}

/* ------------------------------------------------------------------ helpers */

/** Fold the late-declared standoff sockets into the part definitions (they are datum points, not geometry). */
function mergeSockets(parts: Record<string, PartDef>, sockets: Record<string, Record<string, SocketDef>>): Record<string, PartDef> {
  const out: Record<string, PartDef> = {};
  for (const [id, def] of Object.entries(parts)) {
    const extra = sockets[id];
    out[id] = extra && Object.keys(extra).length > 0 ? { ...def, sockets: { ...(def.sockets ?? {}), ...extra } } : def;
  }
  return out;
}

/** Where a sense organ's own mount puts it: tangent to the box of the body it names. */
function seatOf(
  spec: KitSocketPartSpec,
  source: PartDef['source'],
  euler: CreatureVec3,
  cageBox: CreatureAabb,
  pelvisBox: CreatureAabb,
  spineById: ReadonlyMap<string, Body>,
  boxOfBody: (b: Body) => CreatureAabb,
): CreatureVec3 {
  const [target, slot] = spec.mount.split('.');
  const face = (slot || 'front') as Face;
  const offset = (spec.at ?? [0, 0, 0]) as CreatureVec3;
  if (target === 'cage' || target === 'torso') return tangentAt(cageBox, source, euler, face, offset[0], offset[1], 3 * CREATURE_CLEARANCE_M);
  if (target === 'pelvis') return tangentAt(pelvisBox, source, euler, face, offset[0], offset[1], 3 * CREATURE_CLEARANCE_M);
  const body = target ? spineById.get(target) : undefined;
  if (!body) return offset;
  return tangentAt(boxOfBody(body), source, euler, face, offset[0], offset[1]);
}
