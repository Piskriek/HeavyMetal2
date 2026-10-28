/**
 * Plan 51 wave 3: the Mimic Reflex Slot. While a bridge is live, every event of the bridged game (a telemetry field
 * changing, an input or audio edge from the cadence sampler) is fed, as it happens, into `logic:` graphs whose actuators
 * are FIDELITY reflexes on the suit and the drone:
 *  - the slot's own preset, `mimic-reflex` (WIREGRAPH_SHELF, editable like any logic preset), reads event CLASSES
 *    (`class:threat`, `class:mobility`, ...), so it works for any game whatever it calls things, names anonymized or not;
 *  - the bridged game's own rule graphs (the harness's trigger -> effect rules) read event NAMES, with their delays and
 *    counters, so that game's rhythm plays out here.
 * A live temporary slot, not a print: no lab blank is spent, and "stop the bridge" clears it.
 *
 * Pure: the caller owns the clock (dtMs) and runs the actions; no DOM, no randomness.
 */
import { classifyEventField, type EventClass } from '@hm/gamebridge';
import {
  WIREGRAPH_SHELF, createWireGraphState, evaluateWireGraph, validateWireGraph,
  type WireGraphSpec, type WireGraphState,
} from '@hm/wiregraph';

/** What the slot asks play to do. */
export type ReflexAction =
  | { readonly kind: 'pulse-shield'; readonly ms: number }
  | { readonly kind: 'overclock-fire'; readonly ms: number }
  | { readonly kind: 'reload-weapon' }
  | { readonly kind: 'arc-chain'; readonly links: number };

/** The slot's own preset: event classes to reflexes. */
export const MIMIC_REFLEX_PRESET_ID = 'mimic-reflex';

/**
 * Which sensors an external event reads: its class (`class:<name>`, for the slot's preset) and its own name (for the
 * bridged game's rule graphs). The name may already be an anonymous label ("boss.state:#2"): the class comes from the
 * field path, which is the telemetry API's structure, not the game's words.
 */
export function bindAnonymousEventToFidelitySlot(name: string, classes?: Readonly<Record<string, EventClass>>): { readonly eventClass: EventClass | null; readonly targets: readonly string[] } {
  const eventClass = classifyEventField(name, classes);
  return { eventClass, targets: eventClass ? [`class:${eventClass}`, name] : [name] };
}

/** A bridged rule graph as an event graph: its sensors read an event's arrival (1 the step it arrives), whatever kind its words picked. */
function asEventGraph(g: WireGraphSpec): WireGraphSpec {
  return { ...g, sensors: g.sensors.map((s) => ({ ...s, kind: 'cardinal-threshold' as const, threshold: 1 })) };
}

/** Each reflex at most once per this long (noisy telemetry must not machine-gun reloads). */
const REFRACTORY_MS: Readonly<Record<ReflexAction['kind'], number>> = { 'pulse-shield': 250, 'overclock-fire': 250, 'reload-weapon': 600, 'arc-chain': 350 };

export interface ReflexSlot {
  /** Feeds this step's events (names) and advances the clock; returns the reflexes to run now. */
  step(events: readonly string[], dtMs: number): ReflexAction[];
  /** Adds a bridged game's rule graph (a refinement replaces the graph with the same id). Invalid graphs are refused. */
  addGraph(graph: WireGraphSpec): boolean;
  /** The ids of the graphs in the slot. */
  graphIds(): readonly string[];
}

export function createReflexSlot(opts: { readonly classes?: Readonly<Record<string, EventClass>>; readonly preset?: WireGraphSpec } = {}): ReflexSlot {
  const own = opts.preset ?? WIREGRAPH_SHELF[MIMIC_REFLEX_PRESET_ID];
  const graphs: { spec: WireGraphSpec; state: WireGraphState }[] = own ? [{ spec: own, state: createWireGraphState() }] : [];
  let clock = 0;
  const lastAt = new Map<ReflexAction['kind'], number>();
  return {
    step(events, dtMs) {
      clock += Math.max(0, dtMs);
      const lit = new Set<string>();
      for (const e of events) for (const t of bindAnonymousEventToFidelitySlot(e, opts.classes).targets) lit.add(t);
      const out: ReflexAction[] = [];
      const want = (a: ReflexAction): void => {
        const prev = lastAt.get(a.kind);
        if (prev !== undefined && clock - prev < REFRACTORY_MS[a.kind]) return;
        if (out.some((o) => o.kind === a.kind)) return;
        lastAt.set(a.kind, clock);
        out.push(a);
      };
      for (const g of graphs) {
        const readings: Record<string, number> = {};
        for (const s of g.spec.sensors) readings[s.id] = s.target !== undefined && lit.has(s.target) ? 1 : 0;
        const r = evaluateWireGraph(g.spec, g.state, readings, dtMs);
        g.state = r.state;
        for (const o of r.outputs) {
          if (o.kind === 'pulse-shield') want({ kind: 'pulse-shield', ms: Math.max(250, Math.min(15000, o.value)) });
          else if (o.kind === 'overclock-fire') want({ kind: 'overclock-fire', ms: Math.max(250, Math.min(15000, o.value)) });
          else if (o.kind === 'reload-weapon') want({ kind: 'reload-weapon' });
          else if (o.kind === 'arc-chain') want({ kind: 'arc-chain', links: Math.max(1, Math.min(5, Math.round(o.value))) });
          // a bridged rule's shot or zap is the drone's arc here; its doors, lamps and spawners have nothing to bind to
          else if (o.kind === 'fire-turret' && g.spec !== own) want({ kind: 'arc-chain', links: 1 });
        }
      }
      return out;
    },
    addGraph(graph) {
      const ev = asEventGraph(graph);
      if (validateWireGraph(ev).length > 0) return false;
      const i = graphs.findIndex((g) => g.spec.id === ev.id);
      if (i >= 0) graphs[i] = { spec: ev, state: createWireGraphState() };
      else graphs.push({ spec: ev, state: createWireGraphState() });
      return true;
    },
    graphIds: () => graphs.map((g) => g.spec.id),
  };
}
