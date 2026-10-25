/** Untrusted Spore data: strict, lossless schemas, resource bounds, and the real shared studio.kit.audit gate. */
import type { MaterialSpec } from '@hm/matstack';
import { BLEND_MODES, CHANNEL_GROUPS, MAX_LAYERS, MAX_MASK_INPUTS, MAX_RAMP_STOPS, NOISE_KINDS } from '@hm/matstack';
import { flatten, validate, type Kit } from '@hm/kitspec';
import { auditSummary, kitAudit } from '@hm/kitspec/audit';
import { buildCreatureKit, CREATURE_PRESET, type CreatureGenomeSpec } from '@hm/creature';
import { GENERATORS } from '@hm/partgen';
import { MESH_OPERATORS } from '@hm/meshops';
import {
  MultiverseGamePresetSchema, boolean, dictionary, frozenSchema, id, invalid, list, number, oneOf, optional, shape, text, vector,
  type JsonRule, type MultiverseGamePresetSpec,
} from '@hm/gamepreset';

const unit = number(0, 1);
const positive = number(0.000001, 1000);
const hex: JsonRule = (v, p) => { if (typeof v !== 'string' || !/^#[0-9a-f]{6}$/i.test(v)) invalid(p, 'expected #rrggbb'); };
const colour: JsonRule = (v, p) => { if (v !== 'paint1' && v !== 'paint2') hex(v, p); };
const tile = (colourVar = false): JsonRule => shape({
  tile: id, scale: number(0.001, 1000), bump: unit, roughVar: unit, space: optional(oneOf(['uv', 'world'])),
  ...(colourVar ? { colourVar: unit } : {}),
});
const surface = shape({
  name: text(128), colour, metal: unit, rough: unit, specular: unit,
  ramp: optional(list(shape({ at: unit, colour: hex }), MAX_RAMP_STOPS, 2)), tile: optional(tile(true)), detail: optional(tile()),
  coat: optional(shape({ amount: unit, rough: unit })), fuzz: optional(shape({ amount: unit, colour: hex })),
  aniso: optional(shape({ amount: unit, axis: oneOf(['u', 'v']) })), film: optional(shape({ amount: unit, thickness: number(0, 2000) })),
  emit: optional(shape({ colour: hex, intensity: number(0, 20) })),
});
const maskInput: JsonRule = (v, p) => {
  const kind = (v as { kind?: unknown } | null)?.kind;
  const extras: Record<string, JsonRule> = kind === 'edge' || kind === 'cavity' ? { width: number(0, 0.05) }
    : kind === 'up' || kind === 'down' ? { angle: number(0, 180), soft: number(0, 180) }
    : kind === 'ground' ? { height: number(-1000, 1000), soft: number(0, 1000) }
    : kind === 'noise' ? { noise: oneOf(NOISE_KINDS), scale: positive, seed: number(0, 0xffff_ffff, true), space: optional(oneOf(['uv', 'world'])) }
    : kind === 'streaks' ? { scale: positive, stretch: number(1, 1000), seed: number(0, 0xffff_ffff, true) } : {};
  shape({ kind: oneOf(['all', 'edge', 'cavity', 'up', 'down', 'ground', 'noise', 'streaks']), blend: oneOf(BLEND_MODES), opacity: unit, invert: boolean, ...extras })(v, p);
};
export const MaterialSpecSchema = frozenSchema<MaterialSpec>(shape({
  name: text(128), base: surface, paint: list(hex, 2, 2), age: unit,
  layers: list(shape({
    name: text(128), surface, mask: shape({ name: text(128), inputs: list(maskInput, MAX_MASK_INPUTS, 1), balance: number(-1, 1), contrast: unit, invert: boolean }),
    opacity: unit, writes: list(oneOf(CHANNEL_GROUPS), CHANNEL_GROUPS.length, 1), heightBlend: unit, weathering: boolean, visible: boolean,
  }), MAX_LAYERS),
}));

const motion = shape({ kind: oneOf(['reciprocate', 'spin', 'oscillate', 'gantry-slide', 'iris-aperture']), axis: oneOf(['x', 'y', 'z']), rateHz: number(-60, 60), amplitude: number(-1000, 1000), phaseRad: optional(number(-1e6, 1e6)) });
const socket = shape({ at: vector(), rot: optional(vector()), motion: optional(motion) });
const rank = oneOf([0, 1, 2]);
const params = dictionary(number(-1e6, 1e6), 64);
const materialTable = dictionary(text(8192), 32);
const ops: JsonRule = list((v, p) => {
  shape({ op: id, params })(v, p);
  const op = (v as { op: string }).op;
  if (!Object.hasOwn(MESH_OPERATORS, op)) invalid(p, 'unknown mesh operator');
  // kitspec.sourceBounds/audit describe the generator before operators. Deformers/CAD/cleanup could therefore
  // hide penetrations from that audit; even the wear operator can multiply triangles repeatedly. Only these two
  // UV-only operators provably preserve positions, topology and the audited envelope, regardless of parameters.
  if (op !== 'uv-box-triplanar' && op !== 'uv-cylindrical-unwrap') invalid(p, 'geometry-changing mesh operators cannot be anatomically audited; remove them before sharing');
}, 4);
const source: JsonRule = (v, p) => {
  const kind = (v as { kind?: unknown } | null)?.kind;
  if (kind === 'box') shape({ kind: oneOf(['box']), size: vector(0.000001, 1000) })(v, p);
  else if (kind === 'param') {
    shape({ kind: oneOf(['param']), gen: id, params, ops: optional(ops) })(v, p);
    if (!Object.hasOwn(GENERATORS, (v as { gen: string }).gen)) invalid(p, 'unknown part generator');
  } else if (kind === 'gen') {
    shape({ kind: oneOf(['gen']), asset: id, bounds: shape({ min: vector(), max: vector() }) })(v, p);
    const b = (v as { bounds: { min: number[]; max: number[] } }).bounds;
    if (b.min.some((n, i) => n >= b.max[i]!)) invalid(p, 'invalid source bounds');
  } else invalid(p, 'unknown part source');
};
const kitRule = shape({
  parts: dictionary(shape({ source, material: text(8192), slotMaterials: optional(materialTable), rank, sockets: optional(dictionary(socket, 128)), motion: optional(motion) }), 256, 1),
  assemblies: dictionary(shape({ sockets: optional(dictionary(socket, 128)), children: list(shape({
    ref: id, key: optional(id), on: optional(shape({ child: number(0, 255, true), socket: id, copy: optional(number(0, 63, true)) })),
    at: optional(vector()), rot: optional(vector()), mirror: optional(oneOf(['x', 'z'])), rank: optional(rank),
    repeat: optional(shape({ count: number(1, 64, true), step: vector() })), motion: optional(motion),
  }), 256, 1) }), 128, 1),
});

/** Bound the *expanded* graph before kitspec.flatten/audit (a tiny repeated DAG can otherwise grow exponentially). */
function checkKitGraph(kit: Kit): void {
  const counts = new Map<string, number>();
  const active = new Set<string>();
  function count(ref: string, depth: number): number {
    if (depth > 24 || active.has(ref)) invalid('kit', 'assembly cycle or depth limit');
    if (Object.hasOwn(kit.parts, ref)) return 1;
    const cached = counts.get(ref);
    if (cached !== undefined) return cached;
    if (!Object.hasOwn(kit.assemblies, ref)) invalid('kit', `unknown reference ${ref}`);
    active.add(ref);
    let n = 0;
    const assembly = kit.assemblies[ref]!;
    const keys = new Set<string>();
    for (const [i, child] of assembly.children.entries()) {
      if (child.key && keys.has(child.key)) invalid('kit', 'duplicate placement key');
      if (child.key) keys.add(child.key);
      if (child.on && child.on.child >= i) invalid('kit', 'socket parent must precede child');
      n += count(child.ref, depth + 1) * (child.repeat?.count ?? 1);
      if (n > 256) invalid('kit', 'expanded part budget exceeds 256');
    }
    active.delete(ref); counts.set(ref, n); return n;
  }
  for (const ref of Object.keys(kit.assemblies)) {
    if (Object.hasOwn(kit.parts, ref)) invalid('kit', 'part/assembly id collision');
    count(ref, 0);
  }
}
export const KitSpecSchema = frozenSchema<Kit>((v, p) => { kitRule(v, p); checkKitGraph(v as Kit); });

const socketPart = shape({
  id, gen: id, params: optional(params), material: text(8192), rank: optional(rank), mount: id,
  at: optional(vector()), rot: optional(vector()), group: optional(oneOf(['base', 'structure', 'mechanism', 'controls', 'subject'])),
  bone: optional(id), slotMaterials: optional(materialTable),
});
const genomeRule = shape({
  id, archetype: oneOf(['biped-astro', 'theropod', 'quadruped', 'hexapod', 'arachnid', 'serpentine', 'avian-drone']), seed: number(0, 0xffff_ffff, true),
  pelvis: shape({ restHeight: number(0.001, 100), radius: vector(0.000001, 100), matPresetId: text(8192), sacrumOffset: optional(vector()), bone: optional(id) }),
  spine: list(shape({ id, length: positive, radiusX: positive, radiusY: positive, pitchRestDeg: number(-360, 360), matPresetId: text(8192), direction: optional(vector(-1, 1)), bone: optional(id), kind: optional(oneOf(['vertebra', 'neck', 'cranium'])), knuckleRadius: optional(positive) }), 32, 1),
  limbs: list(shape({
    id, parentSegmentId: id, symmetry: oneOf(['bilateral', 'medial']), mountOffset: vector(), upperLength: positive, lowerLength: positive,
    kneeBendDir: vector(-1, 1), gaitPhaseOffset: unit, stepHeight: number(0, 100), strideLength: number(0, 100),
    effectorKind: oneOf(['boot', 'hoof', 'talon', 'hand', 'pincer', 'thruster']), upperDirection: optional(vector(-1, 1)), lowerDirection: optional(vector(-1, 1)),
    role: optional(oneOf(['leg', 'arm', 'tail'])), effectorDirection: optional(vector(-1, 1)), effectorLength: optional(positive),
    upperRadius: optional(positive), lowerRadius: optional(positive), knuckleRadius: optional(positive), bones: optional(shape({ upper: text(128), lower: text(128), effector: text(128) })),
  }), 24),
  sensoryControls: list(socketPart, 64), subjectEffectors: list(socketPart, 64), armour: optional(list(socketPart, 64)), harness: optional(list(socketPart, 64)),
  torso: optional(shape({ depth: optional(positive), material: optional(text(8192)) })), skinPaletteId: id, voiceStemId: id,
  strideFreqHz: optional(number(0.01, 60)), dutyFactor: optional(number(0.01, 0.99)),
});
export const CreatureGenomeSchema = frozenSchema<CreatureGenomeSpec>((v, p) => {
  genomeRule(v, p);
  const g = v as CreatureGenomeSpec;
  const names = [...g.spine.map((s) => s.id), ...g.limbs.map((l) => l.id)];
  if (new Set(names).size !== names.length || names.includes('pelvis')) invalid(p, 'duplicate skeleton id');
  for (const limb of g.limbs) if (limb.parentSegmentId !== 'pelvis' && !g.spine.some((s) => s.id === limb.parentSegmentId)) invalid(p, 'unknown limb parent');
  for (const part of [...g.sensoryControls, ...g.subjectEffectors, ...(g.armour ?? []), ...(g.harness ?? [])]) {
    if (!Object.hasOwn(GENERATORS, part.gen)) invalid(p, 'unknown part generator');
    const [target, slot, extra] = part.mount.split('.');
    const limbMount = target?.startsWith('limb:') && g.limbs.some((l) => target === `limb:${l.id}` || (l.symmetry === 'bilateral' && ["left-", "right-"].some((side) => target === `limb:${side}${l.id}`)));
    const bodyMount = ['pelvis', 'cage', 'torso', ...g.spine.map((s) => s.id)].includes(target ?? '');
    const slots = limbMount ? ['upper', 'lower', 'effector'] : ['front', 'back', 'top', 'bottom', 'left', 'right', 'segment', 'mid'];
    if ((!limbMount && !bodyMount) || extra !== undefined || (slot !== undefined && !slots.includes(slot))) invalid(p, 'unknown part mount');
  }
});

export type SporeCreation =
  | { readonly kind: 'material'; readonly spec: MaterialSpec }
  | { readonly kind: 'kit'; readonly spec: Kit; readonly preset: string }
  | { readonly kind: 'creature'; readonly spec: CreatureGenomeSpec }
  | { readonly kind: 'game'; readonly spec: MultiverseGamePresetSpec };
export interface SporeCard {
  readonly schema: 'hm2:spore-card:v1';
  readonly title: string;
  readonly author: string;
  readonly creation: SporeCreation;
}
const cardRule = shape({
  schema: oneOf(['hm2:spore-card:v1']), title: text(96), author: text(64),
  creation: (v, p) => {
    const kind = (v as { kind?: unknown } | null)?.kind;
    const spec: JsonRule = kind === 'material' ? (x) => { MaterialSpecSchema.parse(x); }
      : kind === 'kit' ? (x) => { KitSpecSchema.parse(x); }
      : kind === 'creature' ? (x) => { CreatureGenomeSchema.parse(x); }
      : kind === 'game' ? (x) => { MultiverseGamePresetSchema.parse(x); } : () => invalid(p, 'unknown creation kind');
    shape({ kind: oneOf(['material', 'kit', 'creature', 'game']), spec, ...(kind === 'kit' ? { preset: id } : {}) })(v, p);
  },
});
export const SporeCardSchema = frozenSchema<SporeCard>(cardRule);

/** Always recomputed locally. A green stamp in the image is not a signature and is never trusted. */
export function auditSporeCreation(creation: SporeCreation): string {
  if (creation.kind === 'material') return 'SCHEMA CLEAN · 6-ZONE MATERIAL';
  if (creation.kind === 'game') return 'SCHEMA CLEAN · RUNG 5';
  const kit = creation.kind === 'creature' ? KitSpecSchema.parse(buildCreatureKit(creation.spec)) : creation.spec;
  const preset = creation.kind === 'creature' ? CREATURE_PRESET : creation.preset;
  // Creature rest rigs use datum sockets across articulated groups; plain box-to-ground contact is not their
  // structural test (the existing creature suite uses ground:null too). The full anatomy audit below is unchanged.
  const problems = validate(kit, preset, creation.kind === 'creature' ? { ground: null } : {})
    .filter((issue) => creation.kind !== 'creature' || issue.code !== 'floating');
  if (problems.length > 0) invalid('audit', `studio.kit.validate: ${problems[0]!.code} (${problems[0]!.at})`);
  const report = kitAudit(kit, { preset });
  if (!report.ok) invalid('audit', `studio.kit.audit: ${auditSummary(report)}`);
  // Keep the builder's expansion bound explicit even if the audit implementation changes later.
  if (flatten(kit, preset).length > 256) invalid('audit', 'part budget');
  return `AUDIT CLEAN · ${report.parts} PARTS · 0 LOOSE ENDS`;
}
