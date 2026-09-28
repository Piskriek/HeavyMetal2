/**
 * AutoPaint — the runner behind the easy paint buttons.
 *
 * Takes a rule (or a whole preset), snapshots the rows it is about to touch, paints it, and records a
 * **job**: `{ rule, params, span }`. That is the whole trick: the mask stays the source of truth (plan
 * §3.2 — persist the mask, never a bake), while the jobs make a painted road *re-runnable* after the
 * track changes, *undoable* one pass at a time, and *reversible to factory* by clearing the base road.
 *
 * The job list rides inside the saved road-mask document (`jobs`), so a track loads exactly as it was
 * painted and its auto passes can be replayed by any author who opens it.
 *
 * Cost: one pass over the rows in the span (a row is 60 units, so the whole mountain is ~2 000 rows ×
 * 16 columns) and one undo snapshot of that rectangle — ~128 KB for the whole track, ten of which are
 * kept. The GPU sees a single dirty-rect upload on the next frame, because every texel write marks the
 * mask dirty.
 *
 * `preview` runs the identical code on a scratch copy of the mask, so the count the panel shows before
 * you click *is* what the click will do — there is no second implementation to drift out of sync.
 */
import type { TrackSpaceMap, TrackStageId } from '../track-space';
import type { MaskRect, MaskSnapshot } from './surface-mask';
import { SurfaceMask } from './surface-mask';
import type { RoadMask } from './road-mask';
import {
  PAINT_RULES, coverage, defaultPaintParams, paintPreset, paintRule,
  type PaintField, type PaintParams, type PaintRule, type RowInfo,
} from './paint-rules';

export const PAINT_JOB_VERSION = 1;
const MARKINGS_RULE_ID = 'markings';
/** Undo entries kept per road mask. Each is one rectangle of texels, not a copy of the mask. */
export const PAINT_UNDO_DEPTH = 10;

/** What one auto pass did, so it can be repeated, undone or explained. */
export interface PaintJob {
  readonly version: typeof PAINT_JOB_VERSION;
  readonly rule: string;
  readonly params: Readonly<PaintParams>;
  readonly span: readonly [number, number];
  readonly label: string;
  readonly at: number;
}

export interface PaintSpan { s0: number; s1: number }

export interface PaintRunResult {
  readonly job: PaintJob;
  /** Rows the rule accepted (a spared bridge or an undressed stage returns false). */
  readonly rows: number;
  /** Texels whose bytes actually changed. */
  readonly changed: number;
  readonly coverage: ReturnType<typeof coverage>;
}

interface UndoEntry extends MaskSnapshot {
  /** What the panel and `undo()` report back. */
  readonly label: string;
  /** Index of the first job this entry added; truncating `jobs` to it undoes the pass. */
  readonly jobIndex: number;
  /** Set only by a factory reset: the jobs to put back when the reset is undone. */
  readonly jobs?: PaintJob[];
}

const rectOf = (field: PaintField, row0: number, row1: number): MaskRect => ({ x0: 0, y0: row0, x1: field.across, y1: row1 });

/** How many texels differ between a snapshot and the mask now. */
function countChanged(before: MaskSnapshot, mask: SurfaceMask): number {
  const { x0, y0, x1, y1 } = before.rect;
  let n = 0;
  for (let row = y0; row < y1; row++) {
    for (let c = x0; c < x1; c++) {
      const i = mask.index(c, row);
      const k = (row - y0) * (x1 - x0) * 4 + (c - x0) * 4;
      if (before.bytes[k] !== mask.data[i] || before.bytes[k + 1] !== mask.data[i + 1]
        || before.bytes[k + 2] !== mask.data[i + 2] || before.bytes[k + 3] !== mask.data[i + 3]) n++;
    }
  }
  return n;
}

export class AutoPaint {
  readonly jobs: PaintJob[] = [];
  /**
   * Road lines (lane markings) are opt-in and off by default: the owner wants no lane paint unless a
   * course asks for it. While off, the Markings rule is a no-op, presets skip their markings step and the
   * stage theme never adds any.
   */
  lines = false;
  private readonly undoStack: UndoEntry[] = [];
  private batchDepth = 0;
  private scratchCache: PaintField | null = null;

  constructor(
    readonly field: PaintField,
    /** Called after any change, so the owner can upload and save. */
    private readonly onChangeCb?: () => void,
  ) {}

  private listeners: (() => void)[] = [];

  /** The panel's refresh hook; the owner's `onChange` callback (uploads, saves) runs too. */
  onChange(cb: () => void): () => void {
    this.listeners.push(cb);
    return () => { this.listeners = this.listeners.filter((l) => l !== cb); };
  }

  private notify(): void {
    this.onChangeCb?.();
    for (const cb of this.listeners) cb();
  }

  rules(): readonly PaintRule[] { return PAINT_RULES; }

  /** Paint a rule by id over a span (default: the whole track). */
  run(ruleId: string, params: Partial<PaintParams> = {}, span?: Partial<PaintSpan>, opts: { preview?: boolean; label?: string } = {}): PaintRunResult {
    const rule = paintRule(ruleId);
    if (!rule) throw new Error(`[auto-paint] unknown rule ${ruleId}`);
    return this.runRule(rule, params, span, opts);
  }

  runRule(rule: PaintRule, params: Partial<PaintParams> = {}, span?: Partial<PaintSpan>, opts: { preview?: boolean; label?: string } = {}): PaintRunResult {
    const full = { ...defaultPaintParams(rule), ...params } as PaintParams;
    if (!this.lines && rule.id === MARKINGS_RULE_ID) {
      const span0 = this.field.sOfRow(this.rowsFor({ s0: span?.s0 ?? 0, s1: span?.s1 ?? this.field.length })[0]);
      const job: PaintJob = { version: PAINT_JOB_VERSION, rule: rule.id, params: full, span: [span0, span0], label: opts.label ?? rule.name, at: Date.now() };
      return { job, rows: 0, changed: 0, coverage: coverage(this.field, 0, 0) };
    }
    if (!this.lines && 'markings' in full) full.markings = 0;
    const target = opts.preview ? this.scratch() : this.field;
    const [row0, row1] = this.rowsFor({ s0: span?.s0 ?? 0, s1: span?.s1 ?? this.field.length });
    const before = !opts.preview && this.batchDepth === 0 ? this.field.mask.snapshot(rectOf(this.field, row0, row1)) : null;

    let rows = 0;
    for (let row = row0; row < row1; row++) {
      if (rule.row(target, row, target.infoAt(this.field.sOfRow(row)), full)) rows++;
    }

    const job: PaintJob = {
      version: PAINT_JOB_VERSION, rule: rule.id, params: full,
      span: [this.field.sOfRow(row0), this.field.sOfRow(Math.max(row0, row1 - 1))],
      label: opts.label ?? rule.name, at: Date.now(),
    };
    if (opts.preview) return { job, rows, changed: 0, coverage: coverage(target, row0, row1) };

    this.jobs.push(job);
    if (before) {
      this.undoStack.push({ ...before, jobIndex: this.jobs.length - 1, label: job.label });
      this.trim();
    }
    // Inside a batch the batch notifies once at the end (a preset is one upload and one save, not five).
    if (this.batchDepth === 0) this.notify();
    return {
      job, rows,
      changed: before ? countChanged(before, this.field.mask) : rows * this.field.across,
      coverage: coverage(this.field, row0, row1),
    };
  }

  /** The "easy" buttons: a whole preset as one undo step. */
  runPreset(presetId: string, span?: Partial<PaintSpan>, overrides: Partial<PaintParams> = {}, opts: { preview?: boolean } = {}): { results: PaintRunResult[]; coverage: ReturnType<typeof coverage> } {
    const preset = paintPreset(presetId);
    if (!preset) throw new Error(`[auto-paint] unknown preset ${presetId}`);
    const [row0, row1] = this.rowsFor({ s0: span?.s0 ?? 0, s1: span?.s1 ?? this.field.length });
    const steps = preset.steps.map((step) => ({ rule: paintRule(step.rule), params: { ...step.params, ...overrides } })).filter((s): s is { rule: PaintRule; params: Partial<PaintParams> } => !!s.rule && (this.lines || s.rule.id !== MARKINGS_RULE_ID));

    if (opts.preview) {
      const scratch = this.scratch();
      for (const { rule, params } of steps) {
        const full = { ...defaultPaintParams(rule), ...params } as PaintParams;
        for (let row = row0; row < row1; row++) rule.row(scratch, row, scratch.infoAt(scratch.sOfRow(row)), full);
      }
      return { results: [], coverage: coverage(scratch, row0, row1) };
    }

    const results: PaintRunResult[] = [];
    this.batch('Auto-paint: ' + preset.name, () => {
      for (const { rule, params } of steps) results.push(this.runRule(rule, params, span, { label: `${preset.name} · ${rule.name}` }));
    });
    return { results, coverage: coverage(this.field, row0, row1) };
  }

  /** Several passes, one undo step. */
  batch(label: string, edit: () => void): void {
    const snapshot = this.field.mask.snapshot(rectOf(this.field, 0, this.field.rows));
    const jobIndex = this.jobs.length;
    this.batchDepth++;
    try { edit(); } finally { this.batchDepth--; }
    this.undoStack.push({ ...snapshot, jobIndex, label });
    this.trim();
    this.notify();
  }

  /** The rows a stage occupies, for the panel's "this stage" span. */
  spanForStage(stage: TrackStageId): PaintSpan {
    let s0 = 0, s1 = this.field.length;
    for (let row = 0; row < this.field.rows; row++) {
      if (this.field.infoAt(this.field.sOfRow(row)).stage === stage) { s0 = this.field.sOfRow(row); break; }
    }
    for (let row = this.field.rows - 1; row >= 0; row--) {
      const s = this.field.sOfRow(row);
      if (this.field.infoAt(s).stage === stage) { s1 = s; break; }
    }
    return { s0, s1 };
  }

  static windowAround(s: number, half: number, length: number): PaintSpan {
    return { s0: Math.max(0, s - half), s1: Math.min(length, s + half) };
  }

  /** Undo the last pass (or batch). Returns what was undone, or null when there is nothing to undo. */
  undo(): string | null {
    const entry = this.undoStack.pop();
    if (!entry) return null;
    this.field.mask.restore(entry);
    if (entry.jobs) this.jobs.push(...entry.jobs);
    else if (entry.jobIndex < 0) this.jobs.length = 0;
    else this.jobs.length = Math.min(this.jobs.length, entry.jobIndex);
    this.notify();
    return entry.label;
  }

  canUndo(): boolean { return this.undoStack.length > 0; }
  get undoDepth(): number { return this.undoStack.length; }

  /** Nothing painted at all. Undoable, so "reset to factory" is never destructive. */
  resetToFactory(): void {
    const snapshot = this.field.mask.snapshot(rectOf(this.field, 0, this.field.rows));
    const cleared = this.jobs.splice(0, this.jobs.length);
    this.field.mask.fill(rectOf(this.field, 0, this.field.rows), 0, 0);
    this.undoStack.push({ ...snapshot, jobIndex: -1, jobs: cleared, label: 'Reset to factory' });
    this.trim();
    this.notify();
  }

  /** Coverage of the whole mask, for the panel's readout. */
  stats() { return coverage(this.field, 0, this.field.rows); }

  /** Re-apply recorded jobs to the current mask (after a track change, or to re-run with new defaults). */
  replay(jobs: readonly PaintJob[] = this.jobs, opts: { replaceParams?: Partial<PaintParams> } = {}): number {
    let n = 0;
    this.batch('Re-run auto-paint', () => {
      for (const job of jobs) {
        const rule = paintRule(job.rule);
        if (!rule) continue;
        this.runRule(rule, { ...job.params, ...opts.replaceParams }, { s0: job.span[0], s1: job.span[1] }, { label: job.label });
        n++;
      }
    });
    return n;
  }

  /** A blank-but-copied mask of the same shape, so a preview is the real thing without the risk. */
  private scratch(): PaintField {
    if (!this.scratchCache || this.scratchCache.rows !== this.field.rows || this.scratchCache.across !== this.field.across) {
      this.scratchCache = {
        mask: new SurfaceMask(this.field.across, this.field.rows),
        across: this.field.across, rows: this.field.rows, step: this.field.step, length: this.field.length,
        rowAt: (s) => this.field.rowAt(s), sOfRow: (r) => this.field.sOfRow(r), infoAt: (s) => this.field.infoAt(s),
      };
    }
    this.scratchCache.mask.data.set(this.field.mask.data);
    this.scratchCache.mask.takeDirty();
    return this.scratchCache;
  }

  private rowsFor(span: PaintSpan): [number, number] {
    const row0 = Math.max(0, Math.floor(this.field.rowAt(Math.min(span.s0, span.s1))));
    const row1 = Math.min(this.field.rows, Math.ceil(this.field.rowAt(Math.max(span.s0, span.s1))) + 1);
    return [row0, Math.max(row0 + 1, row1)];
  }

  private trim(): void {
    while (this.undoStack.length > PAINT_UNDO_DEPTH) {
      const dropped = this.undoStack.shift();
      // Jobs older than the oldest kept entry can no longer be restored: forget them too.
      if (dropped && dropped.jobIndex >= 0 && !this.undoStack.some((u) => u.jobIndex >= 0 && u.jobIndex <= dropped.jobIndex)) {
        const cut = this.undoStack[0]?.jobIndex ?? this.jobs.length;
        this.jobs.length = Math.min(this.jobs.length, Math.max(0, cut));
      }
    }
  }
}

/* -----------------------------------------------------------------------------
   Jobs ↔ save data
   -------------------------------------------------------------------------- */
/** Jobs as they go into a save (plain data; the mask document carries them verbatim). */
export const jobsToDoc = (jobs: readonly PaintJob[]) =>
  jobs.map((j) => ({ version: PAINT_JOB_VERSION, rule: j.rule, params: { ...j.params }, span: [j.span[0], j.span[1]] as [number, number], label: j.label, at: j.at }));

/** Read jobs back, tolerating anything that is not a record we understand. */
export function jobsFromDoc(raw: unknown): PaintJob[] {
  if (!Array.isArray(raw)) return [];
  const out: PaintJob[] = [];
  for (const item of raw) {
    const j = item as Partial<PaintJob>;
    if (!j || j.version !== PAINT_JOB_VERSION || typeof j.rule !== 'string') continue;
    const params = (j.params && typeof j.params === 'object' ? j.params : {}) as PaintParams;
    const span = Array.isArray(j.span) ? [Number(j.span[0]) || 0, Number(j.span[1]) || 0] as [number, number] : [0, 0] as [number, number];
    out.push({ version: PAINT_JOB_VERSION, rule: j.rule, params, span, label: typeof j.label === 'string' ? j.label : j.rule, at: Number(j.at) || 0 });
  }
  return out;
}

/* -----------------------------------------------------------------------------
   The field a road gives us
   -------------------------------------------------------------------------- */
export interface RoadFieldSource {
  readonly mask: RoadMask;
  /** What the road is doing at an arc-length — the renderer's own sample, projected. */
  infoAt(s: number): RowInfo;
}

/** Wrap a `RoadMask` as something the rules can paint. */
export function roadPaintField(source: RoadFieldSource): PaintField {
  const mask = source.mask;
  return {
    mask: mask.mask,
    across: mask.across,
    rows: mask.rows,
    step: mask.step,
    length: mask.length,
    rowAt: (s) => mask.rowAt(s),
    sOfRow: (row) => mask.sOfRow(row),
    infoAt: (s) => source.infoAt(s),
  };
}

/**
 * A field over the renderer's compiled track map: the road's own per-sample `turnRate`, `onBridge` and
 * `inLoop`, read by arc-length. The rules steer by these — that is what puts scree on the outside of a
 * bend and keeps a plank bridge deck unpainted — and they come from the same table physics uses, so a
 * rule cannot disagree with the road.
 */
export function trackPaintField(mask: RoadMask, map: TrackSpaceMap): PaintField {
  interface MapSample { dist: number; halfWidth: number; stage: TrackStageId; turnRate?: number; onBridge?: boolean; inLoop?: boolean }
  const samples = map.samples as readonly MapSample[];
  const perArc = (map as { samplesPerArc?: number }).samplesPerArc ?? (samples.length > 1 ? (samples.length - 1) / map.length : 1);
  const info = new Map<number, RowInfo>();
  return {
    ...flatPaintField(mask),
    infoAt(s: number): RowInfo {
      const row = Math.floor(mask.rowAt(s));
      const cached = info.get(row);
      if (cached) return cached;
      const i = Math.max(0, Math.min(samples.length - 1, Math.round(Math.max(0, Math.min(map.length, s)) * perArc)));
      const sample = samples[i];
      const next: RowInfo = {
        stage: sample.stage,
        turnRate: sample.turnRate ?? 0,
        onBridge: sample.onBridge ?? false,
        inLoop: sample.inLoop ?? false,
        halfWidth: sample.halfWidth || 480,
      };
      if (info.size > 4096) info.clear();
      info.set(row, next);
      return next;
    },
  };
}

/** A field over a bare mask, with flat-road info — what the tests and offline tools use. */
export function flatPaintField(mask: RoadMask, stage: TrackStageId = 'alpine', halfWidth = 480): PaintField {
  return {
    mask: mask.mask,
    across: mask.across,
    rows: mask.rows,
    step: mask.step,
    length: mask.length,
    rowAt: (s) => mask.rowAt(s),
    sOfRow: (row) => mask.sOfRow(row),
    infoAt: () => ({ stage, turnRate: 0, onBridge: false, inLoop: false, halfWidth }),
  };
}
