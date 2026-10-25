/**
 * The plot gate's own logic (plan 42 §4.3's iris, plan 43 `logic:`): when the Stargate's iris is shut and when its ramp
 * door is open, evaluated as a `@hm/wiregraph` rule from `WIREGRAPH_SHELF` rather than by an `if` in the scene.
 *
 * The rule is `stargate-iris-lock`: a proximity-free, purely stateful gate —
 *
 *   privacy-open ─┐
 *                 ├─ or ── asked ─┐
 *   code ─────────┘               ├─ and ─┬─ shut = not(admit) ─→ lock-iris   (the iris shield)
 *   privacy-closed ── not ─ not-closed ───┘        └─ admit ──────→ open-door  (the ramp door, open with the iris)
 *
 * A `closed` plot admits nobody, code or no code: privacy outranks the code.
 *
 * so the two things the game used to decide in two places are one graph with one truth: the shield is drawn because a
 * `lock-iris` actuator fired, and the door is open because an `open-door` actuator fired. Evaluating it is pure and
 * deterministic in `(readings, dt)`, which is what lets the Studio's scrubbar and the Beam Rifle's logic cartridges replay
 * a gate's behaviour at any timestamp.
 *
 * The kit's geometry still asks `stargateIrisClosed(access)` — which kit to build is a drawing question. What changed is
 * who decides the access: `accessFromIris` turns the graph's answer back into the mode the world stores.
 */
import {
  createWireGraphState,
  evaluateWireGraph,
  WIREGRAPH_SHELF,
  type ActuatorOutput,
  type WireGraphSpec,
  type WireGraphState,
} from '@hm/wiregraph';
import type { GateAccessMode } from '@hm/coopnet/gate-dialer';

/** The shelf rule the plot gate runs: the iris lock and the ramp door, from the plot's privacy and the visitor's code. */
export const GATE_LOGIC_PRESET_ID = 'stargate-iris-lock';

/** The graph itself (a shelf preset): the same data the Beam Rifle's `logic:` cartridge carries. */
export function gateLogicSpec(): WireGraphSpec {
  const spec = WIREGRAPH_SHELF[GATE_LOGIC_PRESET_ID];
  if (!spec) throw new Error(`the wiregraph shelf has no ${GATE_LOGIC_PRESET_ID} rule`);
  return spec;
}

/** What the gate sensor sees this frame: the plot's stored privacy, and whether the visitor's code was accepted. */
export interface GateReadings {
  readonly access: GateAccessMode;
  /** The visitor presented the plot's code and it was accepted (the owner on their own plot, or a traveller with the code). */
  readonly codeAccepted?: boolean;
}

export interface GateLogicStep {
  readonly state: WireGraphState;
  /** True while the iris shield is drawn (the `lock-iris` actuator fired). */
  readonly irisClosed: boolean;
  /** True while the ramp door is open (the `open-door` actuator fired): the same condition as the iris being open. */
  readonly doorOpen: boolean;
  readonly outputs: readonly ActuatorOutput[];
}

/** A fresh gate logic state (nothing latched; the graph is combinational, so it holds no memory of its own). */
export function createGateLogicState(): WireGraphState {
  return createWireGraphState();
}

/**
 * Step the gate's rule. Readings are the plot's privacy and the visitor's code; the outputs are the iris lock and the ramp
 * door. Pure: the returned state depends only on the arguments, so a scrub or a replay lands on the same gate.
 */
export function stepGateLogic(state: WireGraphState, readings: GateReadings, dtMs: number): GateLogicStep {
  const result = evaluateWireGraph(
    gateLogicSpec(),
    state,
    {
      'privacy-open': readings.access === 'open' ? 1 : 0,
      'privacy-closed': readings.access === 'closed' ? 1 : 0,
      code: readings.codeAccepted ? 1 : 0,
    },
    dtMs,
  );
  const fired = (kind: 'lock-iris' | 'open-door'): boolean => result.outputs.some((o) => o.kind === kind);
  return { state: result.state, irisClosed: fired('lock-iris'), doorOpen: fired('open-door'), outputs: result.outputs };
}

/**
 * The access mode the world stores, from the graph's answer. A shut iris on a plot that is not `closed` is `code-only`:
 * the shield stands and the code still opens it. Pure.
 */
export function accessFromIris(irisClosed: boolean, privacy: GateAccessMode = 'closed'): GateAccessMode {
  if (!irisClosed) return 'open';
  return privacy === 'closed' ? 'closed' : 'code-only';
}

/**
 * Whether the iris is shut for a stored privacy, with no visitor code: the answer the kit and the world ask for. Memoised by
 * mode, because it is asked on every rebuild and answers the same for the same mode (the graph is combinational).
 */
const IRIS_BY_ACCESS = new Map<GateAccessMode, boolean>();
export function irisClosedForAccess(access: GateAccessMode): boolean {
  const hit = IRIS_BY_ACCESS.get(access);
  if (hit !== undefined) return hit;
  const closed = gateStateNow({ access }).irisClosed;
  IRIS_BY_ACCESS.set(access, closed);
  return closed;
}

/** One call for a frame: the gate evaluated from nothing, for a caller that has no state to keep (the scene's apply). */
export function gateStateNow(readings: GateReadings, dtMs = 0): GateLogicStep {
  return stepGateLogic(createGateLogicState(), readings, dtMs);
}

/**
 * The access mode to draw for a plot's stored privacy on this frame: the graph's answer, mapped back. This is the one call
 * the scene's `setGateAccess` takes, so the shield on screen is the shield the rule fired. Pure.
 */
export function irisAccessFor(readings: GateReadings, dtMs = 0): GateAccessMode {
  return accessFromIris(gateStateNow(readings, dtMs).irisClosed, readings.access);
}
