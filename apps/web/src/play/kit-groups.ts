/**
 * The five functional groups every machine and vehicle kit is decomposed into (JOB-08; `wheresryan22/anatomy`).
 *
 * The taxonomy is not a labelling exercise: it is the decomposition the builder, the beam and the audit all key on.
 *
 *  - `base` — the foundation: the skid, the mounting plates, the levelers. It carries the weight and touches the ground.
 *  - `structure` — frame rails, bulkheads, the protective roll-cage: the silhouette, and what protects what is inside it.
 *  - `mechanism` — rams, motors, gears, drive axles, pistons: the parts that move, each on a `KitMotionSpec`.
 *  - `controls` — valves, breaker levers, status lights, cartridge ports: the faces a person and a beam act on.
 *  - `subject` — the hopper ore bed, the fabricator nozzle, the turbine core: what the machine is *for*.
 *
 * A kit expresses the decomposition structurally: five assemblies named after the five groups, placed by the preset.
 * That makes the groups inspectable data (this module), auditable geometry (`studio.kit.audit`), and targetable parts
 * (`kit-target.ts` names a hit's group), without a second source of truth beside the kit.
 */
import { flatten, type Kit, type PlacedPart } from '@hm/kitspec';

/** The five groups, in the order a machine is built and read. */
export type KitGroup = 'base' | 'structure' | 'mechanism' | 'controls' | 'subject';

export const KIT_GROUPS: readonly KitGroup[] = Object.freeze(['base', 'structure', 'mechanism', 'controls', 'subject']);

/** A one-line statement of what each group promises, for the Studio skill file and the audit's report. */
export const KIT_GROUP_DOCTRINE: Readonly<Record<KitGroup, string>> = Object.freeze({
  base: 'foundation skid, mounting plates and levelers: it stands on the ground, level, and carries everything above it',
  structure: 'frame rails, bulkheads and protective roll-cage: the silhouette, clear of itself and of the mechanism',
  mechanism: 'rams, motors, gears, drive axles and pistons: everything that moves, each on its own KitMotionSpec',
  controls: 'valves, breaker levers, status lights and cartridge ports: what a person and a beam can act on',
  subject: 'hopper ore bed, fabricator nozzle, turbine core: what the machine is for, and where its product leaves',
});

/** Whether a name (an assembly key or a part id) is one of the five groups. */
export function isKitGroup(name: string): name is KitGroup {
  return (KIT_GROUPS as readonly string[]).includes(name);
}

/** What the decomposition of one preset is: the parts of each group, and anything that escaped the five. */
export interface GroupReport {
  /** Part paths by group, in flatten order. */
  readonly groups: Readonly<Record<KitGroup, readonly string[]>>;
  /** Placed parts that no group owns (a part at the preset root): a kit with any of these is not decomposed. */
  readonly ungrouped: readonly string[];
  /** Every group the preset does not place: a complete machine has none. */
  readonly missing: readonly KitGroup[];
  readonly counts: Readonly<Record<KitGroup, number>>;
  readonly parts: number;
}

const groupOfPath = (path: string): KitGroup | null => {
  // the first segment names the group when the preset places five group assemblies; a part id may also carry the
  // group as its prefix (`base-skid`, `mechanism-ram`), which covers a flat kit written before the groups existed
  const cut = path.indexOf('/');
  const head = cut < 0 ? path : path.slice(0, cut);
  if (isKitGroup(head)) return head;
  const bare = head.replace(/\[\d+\]$/, '');
  if (isKitGroup(bare)) return bare;
  for (const g of KIT_GROUPS) if (bare.startsWith(`${g}-`) || bare.startsWith(`${g}_`)) return g;
  return null;
};

/** The five-group decomposition of a preset: which parts are in which group, and what escaped. */
export function kitGroups(kit: Kit, preset: string, placed?: readonly PlacedPart[]): GroupReport {
  const parts = placed ?? flatten(kit, preset);
  const groups: Record<KitGroup, string[]> = { base: [], structure: [], mechanism: [], controls: [], subject: [] };
  const ungrouped: string[] = [];
  for (const p of parts) {
    const g = groupOfPath(p.path);
    if (g) groups[g].push(p.path);
    else ungrouped.push(p.path);
  }
  const counts: Record<KitGroup, number> = {
    base: groups.base.length,
    structure: groups.structure.length,
    mechanism: groups.mechanism.length,
    controls: groups.controls.length,
    subject: groups.subject.length,
  };
  return {
    groups,
    ungrouped,
    missing: KIT_GROUPS.filter((g) => counts[g] === 0),
    counts,
    parts: parts.length,
  };
}

/** Whether a kit is decomposed: all five groups present, nothing ungrouped. */
export function auditKitGroups(kit: Kit, preset: string, placed?: readonly PlacedPart[]): { readonly ok: boolean; readonly report: GroupReport; readonly why: readonly string[] } {
  const report = kitGroups(kit, preset, placed);
  const why: string[] = [];
  if (report.missing.length > 0) why.push(`missing group(s): ${report.missing.join(', ')}`);
  if (report.ungrouped.length > 0) why.push(`${report.ungrouped.length} part(s) outside the five groups (e.g. ${report.ungrouped.slice(0, 3).join(', ')})`);
  return { ok: why.length === 0, report, why };
}

/** The parts a group holds, by their part ids (what a cartridge menu lists for that group). */
export function groupParts(kit: Kit, preset: string, group: KitGroup): readonly { readonly path: string; readonly part: string }[] {
  return flatten(kit, preset)
    .filter((p) => groupOfPath(p.path) === group)
    .map((p) => ({ path: p.path, part: p.part }));
}

/** The group a placed part path belongs to, or null (the same rule `kitGroups` uses). */
export function groupOfPartPath(path: string): KitGroup | null {
  return groupOfPath(path);
}
