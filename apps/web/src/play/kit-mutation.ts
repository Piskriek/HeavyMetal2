/**
 * Kit mutations on what the player pinged (plan 49, Mission 2): pure planning over a kit's placed parts.
 *
 * "Remove the black and yellow chevrons on the base piece" is a `strip-hazard`: the hazard trim is re-dressed in the
 * material of the part it sits on, so the stripes go and the surface reads as one piece (a part override can change a
 * part's material, not delete the part, and a 12 mm band in the step's own paint is the step). The screen applies the
 * plan through the same override path the Beam Rifle's Apply uses (props save + setKitOverrides).
 *
 * Scope of a strip, from the pinged part:
 *  - the pinged part is hazard trim: the hazard trim on the body it sits on (the four bands of one dais step, the gate's
 *    front and back rims on its plinth), else every copy of its own definition;
 *  - the pinged part is a body (the dais step, the gate's plinth): the hazard trim touching it ("the chevrons on the base");
 *  - neither finds any, or nothing was pinged on this kit: every hazard part of the kit.
 */
import { sourceBounds, transformBox, type Box3, type Kit, type Overrides, type PartOverride, type PlacedPart } from '@hm/kitspec';

/** Materials that are hazard paint: the lab's striped 'hazard', the shelf's hazard layered materials, any chevron. */
const HAZARD_MATERIAL_RE = /hazard|chevron|caution|warning-stripe/i;
/** Part ids that name hazard trim (what a part is for, even when its swatch is a plain khaki). */
const HAZARD_PART_RE = /hazard|chevron|caution|stripe/i;
/** Materials a strip never uses as the replacement: lamps and lights glow, they are not a surface to paint trim with. */
const LIGHT_MATERIAL_RE = /^(lx:|lamp)/;

export type KitMutation =
  | { readonly kind: 'strip-hazard'; readonly path?: string }
  /** Puts the hazard trim back in its kit's own hazard paint (works over a shipped default that stripped it, unlike a reset). */
  | { readonly kind: 'restore-hazard' }
  | { readonly kind: 'set-material'; readonly paths: readonly string[]; readonly material: string }
  | { readonly kind: 'reset'; readonly paths?: readonly string[] };

/** One part's change: the override to merge over its current one, or null to take its override off. */
export interface KitPartChange {
  readonly path: string;
  readonly override: PartOverride | null;
  /** The material it wore and the one it wears after (for the companion's report). */
  readonly from: string;
  readonly to: string;
}

export interface KitMutationPlan {
  readonly changes: readonly KitPartChange[];
  /** How the scope was found: the trim on the pinged trim's base, its own kind, the trim touching it, the whole kit, or the paths named. */
  readonly scope: 'same-base' | 'same-part' | 'touching' | 'whole-kit' | 'named' | 'none';
}

/** True when this placed part is hazard trim: it wears hazard paint, or its id names hazard trim and it still wears its kit default. */
export function isHazardPart(p: PlacedPart, kit?: Kit): boolean {
  if (HAZARD_MATERIAL_RE.test(p.material)) return true;
  const def = kit?.parts[p.part];
  return HAZARD_PART_RE.test(p.part) && (!def || def.material === p.material);
}

/** A placed part's box in the kit's preset frame. */
export function placedBox(p: PlacedPart): Box3 {
  return transformBox(sourceBounds(p.source), p.matrix);
}

/** The volume two boxes share once each is grown by `eps` (touching faces share a thin slab; apart, nothing). */
export function contactVolume(a: Box3, b: Box3, eps = 0.01): number {
  let v = 1;
  for (let k = 0; k < 3; k++) {
    const lo = Math.max((a.min[k] as number) - eps, (b.min[k] as number) - eps);
    const hi = Math.min((a.max[k] as number) + eps, (b.max[k] as number) + eps);
    if (hi <= lo) return 0;
    v *= hi - lo;
  }
  return v;
}

/** A part trim can sit on: not trim itself, not a light, not a generated core. */
const isBodyFor = (trim: PlacedPart, kit?: Kit) => (p: PlacedPart): boolean =>
  p.path !== trim.path && p.source.kind !== 'gen' && !isHazardPart(p, kit) && !LIGHT_MATERIAL_RE.test(p.material);

/** The body a trim part sits on: the one it touches most, or null when it touches none. */
export function bodyUnder(trim: PlacedPart, placed: readonly PlacedPart[], kit?: Kit): PlacedPart | null {
  const isBody = isBodyFor(trim, kit);
  const box = placedBox(trim);
  let best: { part: PlacedPart; v: number } | null = null;
  for (const p of placed) {
    if (!isBody(p)) continue;
    const v = contactVolume(box, placedBox(p));
    if (v > 0 && (!best || v > best.v)) best = { part: p, v };
  }
  return best?.part ?? null;
}

/**
 * The material a hazard part should wear instead: the material of the body it sits on, else the kit's most-worn body
 * material, else null. Lights, generated cores and other hazard trim are never the answer.
 */
export function bodyMaterialUnder(trim: PlacedPart, placed: readonly PlacedPart[], kit?: Kit): string | null {
  const under = bodyUnder(trim, placed, kit);
  if (under) return under.material;
  const isBody = isBodyFor(trim, kit);
  const counts = new Map<string, number>();
  for (const p of placed) if (isBody(p)) counts.set(p.material, (counts.get(p.material) ?? 0) + 1);
  let most: string | null = null;
  for (const [m, n] of counts) if (most === null || n > (counts.get(most) ?? 0)) most = m;
  return most;
}

/** The hazard parts a strip from `path` reaches, and how they were found. */
export function hazardScope(placed: readonly PlacedPart[], path: string | undefined, kit?: Kit): { parts: PlacedPart[]; scope: KitMutationPlan['scope'] } {
  const hazard = placed.filter((p) => isHazardPart(p, kit));
  if (hazard.length === 0) return { parts: [], scope: 'none' };
  const pinged = path === undefined ? undefined : placed.find((p) => p.path === path);
  if (pinged) {
    if (isHazardPart(pinged, kit)) {
      // a band pinged: every band on the body it sits on ("the chevrons on the base piece"), else its own kind
      const base = bodyUnder(pinged, placed, kit);
      if (!base) return { parts: hazard.filter((p) => p.part === pinged.part), scope: 'same-part' };
      const baseBox = placedBox(base);
      return { parts: hazard.filter((p) => contactVolume(baseBox, placedBox(p)) > 0), scope: 'same-base' };
    }
    const box = placedBox(pinged);
    const touching = hazard.filter((p) => contactVolume(box, placedBox(p)) > 0);
    if (touching.length > 0) return { parts: touching, scope: 'touching' };
  }
  return { parts: hazard, scope: 'whole-kit' };
}

/** Plans a mutation over a kit's placed parts (as last built, with the current overrides applied). */
export function planKitMutation(placed: readonly PlacedPart[], m: KitMutation, kit?: Kit): KitMutationPlan {
  switch (m.kind) {
    case 'strip-hazard': {
      const { parts, scope } = hazardScope(placed, m.path, kit);
      const changes: KitPartChange[] = [];
      for (const p of parts) {
        const to = bodyMaterialUnder(p, placed, kit);
        if (to && to !== p.material) changes.push({ path: p.path, override: { material: to }, from: p.material, to });
      }
      return { changes, scope: changes.length > 0 ? scope : 'none' };
    }
    case 'restore-hazard': {
      const changes: KitPartChange[] = [];
      for (const p of placed) {
        const def = kit?.parts[p.part];
        if (!def || !(HAZARD_MATERIAL_RE.test(def.material) || HAZARD_PART_RE.test(p.part))) continue;
        if (p.material !== def.material) changes.push({ path: p.path, override: { material: def.material }, from: p.material, to: def.material });
      }
      return { changes, scope: changes.length > 0 ? 'whole-kit' : 'none' };
    }
    case 'set-material': {
      const byPath = new Map(placed.map((p) => [p.path, p] as const));
      const changes: KitPartChange[] = [];
      for (const path of m.paths) {
        const p = byPath.get(path);
        if (p && p.material !== m.material) changes.push({ path, override: { material: m.material }, from: p.material, to: m.material });
      }
      return { changes, scope: changes.length > 0 ? 'named' : 'none' };
    }
    case 'reset': {
      const wanted = m.paths ? new Set(m.paths) : null;
      const changes = placed
        .filter((p) => !wanted || wanted.has(p.path))
        .map((p) => ({ path: p.path, override: null, from: p.material, to: kit?.parts[p.part]?.material ?? p.material }));
      return { changes, scope: wanted ? 'named' : 'whole-kit' };
    }
  }
}

/** A kit's override record with a plan applied: changes merge over each part's override, a null takes it off. */
export function applyKitPlan(current: Overrides | undefined, plan: KitMutationPlan): Overrides {
  const out: Record<string, PartOverride> = { ...(current ?? {}) };
  for (const c of plan.changes) {
    if (c.override === null) delete out[c.path];
    else out[c.path] = { ...(out[c.path] ?? {}), ...c.override };
  }
  return out;
}
