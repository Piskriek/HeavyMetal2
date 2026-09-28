/**
 * M01 · T0 — the eye-level audit (pure).
 *
 * The race was dressed for a chase camera 430 units up and 950 units back. Before the cockpit work
 * starts, this module answers the only question that matters: *what does the road look like from
 * 24 units above the ball?* It does that with arithmetic over authored data, not with screenshots,
 * because this sandbox has no WebGL.
 *
 * Three checks, each of which the plan calls out by name:
 *
 * 1. **Thin billboards** — a painted prop that is *not* camera-facing is a flat plane. Seen from
 *    within a few degrees of its own plane it collapses to a line (or disappears). The check reports
 *    every such prop the eye path passes within `THIN_RANGE` world units of, with the smallest
 *    |normal · view| it reaches and the eye sample that produces it.
 * 2. **Terrain edge exposure** — at eye level the road edge is much closer to the horizon than it is
 *    from a chase camera. The check reports, per eye sample, the distance ahead at which the
 *    horizontal field of view first reaches past the drivable half-width.
 * 3. **Decals under the nose** — decals within `DECAL_RANGE` world units of the eye are inspected
 *    face-on rather than obliquely, which is where a low-resolution decal reads as mud.
 *
 * Everything is deterministic: inputs are sorted into a canonical order before output, and
 * `serializeEyeAudit` produces a stable string a test can compare twice. Nothing here reads the
 * clock, the DOM or `Math.random`.
 */

/* -----------------------------------------------------------------------------
   1. CONSTANTS
   -------------------------------------------------------------------------- */

export const EYE_AUDIT_VERSION = 1;
/** A non-camera-facing plane is "thin" when the view ray is within this of its plane. */
export const THIN_NORMAL_DOT = 0.2;
/** Props beyond this many world units from the eye path are not the spike's problem. */
export const THIN_RANGE = 3000;
/** Decals closer than this to the eye path are reported (they are read face-on). */
export const DECAL_RANGE = 400;
/** The eye pose T0 ships with (mirrors `first-person.ts`, kept here so the audit is self-contained). */
export const AUDIT_EYE_LIFT = 62 + 24;
export const AUDIT_FOV = 74;

/* -----------------------------------------------------------------------------
   2. INPUTS
   -------------------------------------------------------------------------- */

export interface AuditPoint {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** One point on the eye path: the ball centre lifted along the frame up. */
export interface AuditEyeSample {
  /** Spline arc distance (s). */
  readonly s: number;
  readonly stage: string;
  readonly eye: AuditPoint;
  /** Drivable half-width of the ribbon at this sample, world units. */
  readonly halfWidth: number;
}

/**
 * How the prop is actually drawn, which decides whether it can be seen edge-on at all:
 * - `plane` — a fixed vertical plane (`cameraFacing: false`): its normal is real, so it can collapse
 *   to a line. This is the only kind the thin-billboard check applies to.
 * - `billboard` — a camera-facing sprite: it always faces the eye and can never be thin.
 * - `decal` — painted flat on the ground: seen from above, never edge-on, but it *is* read face-on,
 *   so it belongs in the decal list.
 * - `model` — a real mesh (ramp, slingshot, 3D prop) with volume: not a plane.
 */
export type AuditItemKind = 'plane' | 'billboard' | 'decal' | 'model';

export interface AuditItem {
  readonly id: string;
  readonly kind: AuditItemKind;
  readonly name: string;
  /** World position of the item's centre (not its origin: a bottom-anchored plane is lifted). */
  readonly position: AuditPoint;
  /** Half extents of the painted plane, world units. */
  readonly halfWidth: number;
  readonly halfHeight: number;
  /** Yaw about the world up axis, radians (the plane normal is `(sin yaw, 0, cos yaw)`). */
  readonly yaw: number;
  /** Where the item came from, so the report can say who owns it. */
  readonly source: 'builder' | 'catalogue';
}

/* -----------------------------------------------------------------------------
   3. OUTPUTS
   -------------------------------------------------------------------------- */

export interface ThinFinding {
  readonly id: string;
  readonly name: string;
  readonly kind: AuditItemKind;
  readonly source: AuditItem['source'];
  /** Smallest |normal · view| over the eye path (0 = dead edge-on). */
  readonly minFacing: number;
  /** Eye s where that minimum happens. */
  readonly s: number;
  /** Distance from that eye sample to the item centre, world units. */
  readonly distance: number;
}

export interface ExposureFinding {
  readonly s: number;
  readonly stage: string;
  readonly halfWidth: number;
  /** Distance ahead at which the FOV cone first passes the drivable edge, world units. */
  readonly edgeDistance: number;
}

export interface DecalFinding {
  readonly id: string;
  readonly name: string;
  readonly s: number;
  readonly distance: number;
  /** World units across the decal at that distance; the number that decides "readable or mud". */
  readonly angularSizeDeg: number;
}

export interface StageAudit {
  readonly stage: string;
  readonly samples: number;
  /** Nearest edge-exposure distance in this stage (small = the eye sees past the road sooner). */
  readonly minEdgeDistance: number;
  readonly thin: number;
  readonly decals: number;
}

export interface EyeAuditReport {
  readonly version: number;
  readonly eye: {
    readonly fov: number;
    readonly aspect: number;
    readonly spacing: number;
    readonly samples: number;
  };
  readonly totals: {
    readonly items: number;
    readonly planes: number;
    readonly billboards: number;
    readonly decals: number;
    readonly models: number;
    readonly thin: number;
    /** Smallest edge distance on the whole course: how soon the road runs out in the frame. */
    readonly worstEdgeDistance: number;
    readonly medianEdgeDistance: number;
    readonly decalsNear: number;
  };
  readonly stages: readonly StageAudit[];
  readonly thin: readonly ThinFinding[];
  /** The worst `limit` eye samples by edge distance, worst first (ties by s). */
  readonly exposed: readonly ExposureFinding[];
  /** One entry per stage: the single most exposed sample in it. */
  readonly stageWorst: readonly ExposureFinding[];
  readonly decals: readonly DecalFinding[];
}

export interface EyeAuditInput {
  readonly samples: readonly AuditEyeSample[];
  readonly items: readonly AuditItem[];
  /** Distance between consecutive eye samples (world units along the spline). */
  readonly spacing: number;
  readonly aspect?: number;
  readonly fov?: number;
  /** Cap on the returned finding lists, after the worst-first sort. */
  readonly limit?: number;
}

/* -----------------------------------------------------------------------------
   4. THE AUDIT
   -------------------------------------------------------------------------- */

const DEG = 180 / Math.PI;

export function runEyeLevelAudit(input: EyeAuditInput): EyeAuditReport {
  const samples = [...input.samples].sort((a, b) => a.s - b.s);
  const items = [...input.items].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const fov = input.fov ?? AUDIT_FOV;
  const aspect = input.aspect ?? 16 / 9;
  const limit = input.limit ?? 20;
  const halfH = Math.tan((fov * 0.5) / DEG);
  const halfW = halfH * aspect;

  const thin: ThinFinding[] = [];
  const decals: DecalFinding[] = [];

  for (const item of items) {
    const normal = item.kind === 'plane'
      ? { x: Math.sin(item.yaw), y: 0, z: Math.cos(item.yaw) }
      : null;
    let best: { facing: number; s: number; distance: number } | null = null;
    let nearestDecal: { s: number; distance: number } | null = null;

    for (const sample of samples) {
      const dx = sample.eye.x - item.position.x;
      const dy = sample.eye.y - item.position.y;
      const dz = sample.eye.z - item.position.z;
      const distance = Math.hypot(dx, dy, dz);
      if (distance > THIN_RANGE) continue;
      if (distance < DECAL_RANGE && (!nearestDecal || distance < nearestDecal.distance)) {
        nearestDecal = { s: sample.s, distance };
      }
      if (!normal || distance < 1e-6) continue;
      const inv = 1 / distance;
      const facing = Math.abs(normal.x * dx * inv + normal.y * dy * inv + normal.z * dz * inv);
      if (!best || facing < best.facing) best = { facing, s: sample.s, distance };
    }

    if (normal && best && best.facing < THIN_NORMAL_DOT) {
      thin.push(Object.freeze({
        id: item.id, name: item.name, kind: item.kind, source: item.source,
        minFacing: best.facing, s: best.s, distance: best.distance,
      }));
    }
    if (nearestDecal && item.kind === 'decal') {
      const across = item.halfWidth * 2;
      decals.push(Object.freeze({
        id: item.id, name: item.name, s: nearestDecal.s, distance: nearestDecal.distance,
        angularSizeDeg: 2 * Math.atan(across / 2 / Math.max(1, nearestDecal.distance)) * DEG,
      }));
    }
  }

  const exposed: ExposureFinding[] = [];
  for (const sample of samples) {
    const edgeDistance = sample.halfWidth / halfW;
    exposed.push(Object.freeze({
      s: sample.s, stage: sample.stage, halfWidth: sample.halfWidth, edgeDistance,
    }));
  }

  thin.sort((a, b) => a.minFacing - b.minFacing || (a.id < b.id ? -1 : 1));
  decals.sort((a, b) => a.distance - b.distance || (a.id < b.id ? -1 : 1));
  const exposedWorst = [...exposed].sort((a, b) => a.edgeDistance - b.edgeDistance || a.s - b.s);

  const stageWorst: ExposureFinding[] = [];
  {
    const seen = new Set<string>();
    for (const entry of exposedWorst) {
      if (seen.has(entry.stage)) continue;
      seen.add(entry.stage);
      stageWorst.push(entry);
    }
  }

  const stages: StageAudit[] = [];
  for (const sample of samples) {
    let stage = stages.find((entry) => entry.stage === sample.stage);
    if (!stage) {
      stage = { stage: sample.stage, samples: 0, minEdgeDistance: Infinity, thin: 0, decals: 0 };
      stages.push(stage);
    }
    (stage as { samples: number }).samples += 1;
    if (sample.halfWidth / halfW < stage.minEdgeDistance) {
      (stage as { minEdgeDistance: number }).minEdgeDistance = sample.halfWidth / halfW;
    }
  }
  for (const item of thin) {
    const stage = stageAt(stages, samples, item.s);
    if (stage) (stage as { thin: number }).thin += 1;
  }
  for (const decal of decals) {
    const stage = stageAt(stages, samples, decal.s);
    if (stage) (stage as { decals: number }).decals += 1;
  }

  const sortedEdge = exposed.map((entry) => entry.edgeDistance).sort((a, b) => a - b);
  const median = sortedEdge.length === 0 ? 0 : sortedEdge[Math.floor(sortedEdge.length / 2)];

  return Object.freeze({
    version: EYE_AUDIT_VERSION,
    eye: Object.freeze({ fov, aspect, spacing: input.spacing, samples: samples.length }),
    totals: Object.freeze({
      items: items.length,
      planes: items.filter((item) => item.kind === 'plane').length,
      billboards: items.filter((item) => item.kind === 'billboard').length,
      decals: items.filter((item) => item.kind === 'decal').length,
      models: items.filter((item) => item.kind === 'model').length,
      thin: thin.length,
      worstEdgeDistance: sortedEdge.length ? sortedEdge[0] : 0,
      medianEdgeDistance: median,
      decalsNear: decals.length,
    }),
    stages: Object.freeze(stages.map((stage) => Object.freeze(stage))),
    thin: Object.freeze(thin.slice(0, limit)),
    exposed: Object.freeze(exposedWorst.slice(0, limit)),
    stageWorst: Object.freeze(stageWorst),
    decals: Object.freeze(decals.slice(0, limit)),
  });
}

function stageAt(stages: readonly StageAudit[], samples: readonly AuditEyeSample[], s: number): StageAudit | null {
  let lo = 0;
  let hi = samples.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (samples[mid].s < s) lo = mid + 1;
    else hi = mid;
  }
  const sample = samples[lo];
  if (!sample) return null;
  return stages.find((stage) => stage.stage === sample.stage) ?? null;
}

/**
 * Stable serialisation: key order is fixed by construction, arrays are already sorted, and no
 * timestamp is included. Two runs over the same inputs produce byte-identical strings.
 */
export function serializeEyeAudit(report: EyeAuditReport): string {
  const round = (value: number) => (Number.isFinite(value) ? Number(value.toFixed(4)) : null);
  return JSON.stringify({
    version: report.version,
    eye: { fov: report.eye.fov, aspect: round(report.eye.aspect), spacing: round(report.eye.spacing), samples: report.eye.samples },
    totals: report.totals,
    stages: report.stages.map((stage) => ({
      stage: stage.stage, samples: stage.samples, minEdgeDistance: round(stage.minEdgeDistance),
      thin: stage.thin, decals: stage.decals,
    })),
    thin: report.thin.map((find) => ({
      id: find.id, name: find.name, kind: find.kind, source: find.source,
      minFacing: round(find.minFacing), s: round(find.s), distance: round(find.distance),
    })),
    exposed: report.exposed.map((find) => ({
      s: round(find.s), stage: find.stage, halfWidth: round(find.halfWidth), edgeDistance: round(find.edgeDistance),
    })),
    stageWorst: report.stageWorst.map((find) => ({
      s: round(find.s), stage: find.stage, halfWidth: round(find.halfWidth), edgeDistance: round(find.edgeDistance),
    })),
    decals: report.decals.map((find) => ({
      id: find.id, name: find.name, s: round(find.s), distance: round(find.distance), angularSizeDeg: round(find.angularSizeDeg),
    })),
  });
}
