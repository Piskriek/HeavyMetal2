// ============================================================================
// File: packages/plotsim/src/gate-plot.ts
// PLAN-42-GATE: Movable, Lockable & Random-Dialable Stargate + Stage-6 Earth Restoration.
// Pure re-export/wrapper over @hm/coopnet's gate network logic so plot simulation
// callers (`PlotState` + machines/foundations) use the same deterministic helpers.
// Zero DOM, zero Three.js, zero Date/Math.random. Four Cardinal Floats only.
// ============================================================================

import {
  canDialGate as coopCanDialGate,
  dialRandomOpenGate as coopDialRandomOpenGate,
  isEarthSandboxUnlocked as coopIsEarthSandboxUnlocked,
  movePlotGate as coopMovePlotGate,
  setGateAccessMode as coopSetGateAccessMode,
} from '@hm/coopnet/gate-dialer';
import type {
  CardinalFloats,
  CardinalLike,
  GateAccessMode,
  GateDialFailure,
  GateDialResult,
  GateDialSuccess,
  GateDirectoryEntry,
  GatePlacement,
  MovePlotGatePose,
  MovePlotGateReason,
  MovePlotGateResult,
  SetGateAccessResult,
} from '@hm/coopnet/gate-dialer';
import { KINDS } from './index';

// Canonical gate-network types (single source of truth in @hm/coopnet).
export type {
  CardinalFloats,
  CardinalLike,
  GateAccessMode,
  GateDialFailure,
  GateDialResult,
  GateDialSuccess,
  GateDirectoryEntry,
  GatePlacement,
  MovePlotGatePose,
  MovePlotGateReason,
  MovePlotGateResult,
  SetGateAccessResult,
};
export {
  DEFAULT_GATE_PLACEMENT,
  DEFAULT_PLOT_RADIUS_M,
  EARTH_UNLOCK_CARDINAL_LEVEL,
  EARTH_UNLOCK_FIDELITY_STAGE,
  GATE_ARRIVAL_PAD_OFFSET_M,
  GATE_CHEVRON_COUNT,
  GATE_FOOTPRINT_RADIUS_M,
} from '@hm/coopnet/gate-dialer';

/**
 * PLAN-42-GATE access check: 'open' allows any explorer, 'code-only' requires an exact
 * `addressCode` match, 'closed' rejects all incoming dials. Deterministic pure function.
 */
export function canDialGate(entry: unknown, providedCode?: string): boolean {
  return coopCanDialGate(entry, providedCode);
}

/**
 * PLAN-42-GATE deterministic random explorer dialer: filters to `access === 'open'` and
 * `plotId !== callerPlotId`, selects via `seed`, returns the 6-chevron dial sequence and
 * target descriptor — or `{ ok: false, reason: 'no-open-gates' }`. Identical seeds select
 * identically. Deterministic pure function.
 */
export function dialRandomOpenGate(
  directory: readonly unknown[],
  callerPlotId: string,
  seed: number,
): GateDialResult {
  return coopDialRandomOpenGate(directory, callerPlotId, seed);
}

/**
 * PLAN-42-GATE Stage-6 Earth sandbox unlock: true when `stage >= 6` thresholds are met.
 * Cardinals use plotsim levels (0..100, Stage 6 = 100 each) or normalized 0..1 floats.
 * Deterministic pure function.
 */
export function isEarthSandboxUnlocked(stage: number, cardinals?: CardinalLike): boolean {
  return coopIsEarthSandboxUnlocked(stage, cardinals);
}

type MachineLike = {
  readonly x?: unknown;
  readonly z?: unknown;
  readonly radius?: unknown;
  readonly kind?: unknown;
};

function withKindRadii(plot: object): object {
  const p = plot as { readonly machines?: unknown };
  if (!Array.isArray(p.machines)) return plot;
  const machines = (p.machines as readonly MachineLike[]).map((m) => {
    if (!m || typeof m !== 'object') return m;
    if (typeof m.radius === 'number' && Number.isFinite(m.radius)) return m;
    if (typeof m.kind === 'string') {
      const spec = (KINDS as Readonly<Record<string, { readonly radius?: number }>>)[m.kind];
      if (spec && typeof spec.radius === 'number') return { ...m, radius: spec.radius };
    }
    return m;
  });
  return { ...plot, machines };
}

/**
 * PLAN-42-GATE movable gate reducer: validates bounds, `y >= 0` ground clearance, and
 * non-overlap with placed machines/foundations before updating the gate pose. Machine
 * radii default from plotsim `KINDS` when only `kind` is given. Pure: never mutates
 * `plot`; returns a hybrid result that is both the (next or unchanged) plot and
 * `{ ok, reason?, plot, gate, gatePose, arrivalPad }`.
 */
export function movePlotGate<T extends object>(plot: T, nextPose: MovePlotGatePose): MovePlotGateResult<T> {
  const enriched = withKindRadii(plot as object) as T;
  const result = coopMovePlotGate(enriched, nextPose);
  if (!result.ok) {
    // Report the caller's original plot on failure (no enrichment leakage).
    return { ...(plot as object), ok: false, reason: result.reason, plot, gate: result.gate, gatePose: result.gatePose, arrivalPad: result.arrivalPad } as MovePlotGateResult<T>;
  }
  // Success: next plot keeps the caller's machine records, only the gate moves.
  const nextPlot = { ...(plot as object), gate: result.gate } as T;
  return { ...(nextPlot as object), ok: true, plot: nextPlot, gate: result.gate, gatePose: result.gatePose, arrivalPad: result.arrivalPad } as MovePlotGateResult<T>;
}

/**
 * PLAN-42-GATE iris setter: sets the plot gate's access mode, preserving pose and share
 * code. Pure; returns a hybrid result that is both the next plot and `{ ok, plot, gate }`.
 */
export function setGateAccessMode<T extends object>(plot: T, access: GateAccessMode): SetGateAccessResult<T> {
  return coopSetGateAccessMode(plot, access);
}
