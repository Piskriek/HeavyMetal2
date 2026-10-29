/**
 * Typed pins (Plan 57 §16.2): a node's ports carry a kind and a value type, as the ports of a Sketch graph do in Plasma, the
 * first game mimicked for its machines and logic (docs/PLASMA_SESSION_NOTES.md). Three kinds:
 * - a command runs an action when a signal reaches it (a motor's start, a door's open);
 * - a property sets a value (a motor's speed, a lamp's colour);
 * - an output sends a value or a pulse (a button pressed, a sensor's distance).
 * A wire runs from an output to a command or a property. A property takes one source; a command may take several, run in their
 * priority order; an output feeds any number. A graph is balanced when every pin is wired or deliberately left free: the System's
 * "Contraption forged: {name} ({ports} ports balanced)." reads it (Argon, 29 Oct). A graph a native built carries the native as its
 * author, so appraising it shows its maker (§16.4).
 *
 * Pure and deterministic. `toGraph` gives the plain graph the existing layout works on.
 */
import type { End, GNode, Graph } from './index';

export type PinKind = 'command' | 'property' | 'output';
export const PIN_KINDS: readonly PinKind[] = ['command', 'property', 'output'];

/** What a pin carries: a bare pulse, or a value of one of the types a part's settings have. */
export type ValueType = 'pulse' | 'number' | 'boolean' | 'color' | 'text' | 'selection' | 'sound' | 'number-list' | 'text-list';
export const VALUE_TYPES: readonly ValueType[] = ['pulse', 'number', 'boolean', 'color', 'text', 'selection', 'sound', 'number-list', 'text-list'];

export interface Pin {
  readonly id: string;
  readonly kind: PinKind;
  readonly type: ValueType;
  /** The player's word for it. */
  readonly label: string;
  /** Deliberately left unwired: it counts as balanced. */
  readonly free?: true;
}

export interface TypedNode {
  readonly id: string;
  /** The preset this node is: a part (a motor, a button) or a logic operator. */
  readonly of: string;
  readonly pins: readonly Pin[];
}

export interface TypedWire {
  readonly from: End;
  readonly to: End;
  /** Lower runs first, when several wires reach one command. */
  readonly priority?: number;
}

export interface TypedGraph {
  readonly id: string;
  readonly name: string;
  /** Who built it: a native's or the player's id (§16.4). */
  readonly author?: string;
  readonly nodes: readonly TypedNode[];
  readonly wires: readonly TypedWire[];
}

/**
 * What a pin of each type accepts from an output of each type. Anything can reach a command (a signal arriving runs it); a value
 * is converted only where the meaning is plain: a boolean is 0 or 1 as a number, a number is true when not 0, and any value can
 * be written as text.
 */
export function accepts(to: Pin, fromType: ValueType): boolean {
  if (to.kind === 'command') return true;
  if (to.type === fromType) return true;
  if (to.type === 'number') return fromType === 'boolean';
  if (to.type === 'boolean') return fromType === 'number';
  if (to.type === 'text') return fromType !== 'pulse';
  return false;
}

export type TypedIssueCode =
  | 'duplicate-node'
  | 'duplicate-pin'
  | 'unknown-end'
  | 'from-not-output'
  | 'to-output'
  | 'type-mismatch'
  | 'property-two-sources'
  | 'self-loop';

export interface TypedIssue {
  readonly code: TypedIssueCode;
  readonly at: string;
  readonly detail: string;
}

const pinOf = (g: TypedGraph, end: End): Pin | undefined => g.nodes.find((n) => n.id === end.node)?.pins.find((p) => p.id === end.port);
const endName = (e: End): string => `${e.node}.${e.port}`;

/** Everything wrong with a typed graph; [] when it can run. Never throws. */
export function typedProblems(g: TypedGraph): TypedIssue[] {
  const out: TypedIssue[] = [];
  const nodeIds = new Set<string>();
  for (const n of g.nodes) {
    if (nodeIds.has(n.id)) out.push({ code: 'duplicate-node', at: n.id, detail: `node ${n.id} is used twice` });
    nodeIds.add(n.id);
    const pinIds = new Set<string>();
    for (const p of n.pins) {
      if (pinIds.has(p.id)) out.push({ code: 'duplicate-pin', at: `${n.id}.${p.id}`, detail: `pin ${p.id} is used twice on ${n.id}` });
      pinIds.add(p.id);
    }
  }
  const sources = new Map<string, number>();
  g.wires.forEach((w, i) => {
    const at = `wire ${i} (${endName(w.from)} -> ${endName(w.to)})`;
    const from = pinOf(g, w.from);
    const to = pinOf(g, w.to);
    if (!from || !to) { out.push({ code: 'unknown-end', at, detail: `${!from ? endName(w.from) : endName(w.to)} is not a pin of this graph` }); return; }
    if (w.from.node === w.to.node) out.push({ code: 'self-loop', at, detail: 'a node wired to itself would run without end' });
    if (from.kind !== 'output') out.push({ code: 'from-not-output', at, detail: `a wire starts at an output, not a ${from.kind}` });
    if (to.kind === 'output') out.push({ code: 'to-output', at, detail: 'a wire ends at a command or a property, not an output' });
    else if (!accepts(to, from.type)) out.push({ code: 'type-mismatch', at, detail: `a ${to.type} ${to.kind} cannot take a ${from.type}` });
    if (to.kind === 'property') sources.set(endName(w.to), (sources.get(endName(w.to)) ?? 0) + 1);
  });
  for (const [end, n] of sources) if (n > 1) out.push({ code: 'property-two-sources', at: end, detail: `${n} wires set one property; it takes one source` });
  return out;
}

/** How balanced a graph is: every pin wired or deliberately free. `loose` lists the pins that are neither. */
export function balance(g: TypedGraph): { readonly ports: number; readonly balanced: number; readonly loose: readonly string[] } {
  const wired = new Set<string>();
  for (const w of g.wires) { wired.add(endName(w.from)); wired.add(endName(w.to)); }
  let ports = 0;
  let balanced = 0;
  const loose: string[] = [];
  for (const n of g.nodes) {
    for (const p of n.pins) {
      ports += 1;
      const name = `${n.id}.${p.id}`;
      if (p.free || wired.has(name)) balanced += 1;
      else loose.push(name);
    }
  }
  return { ports, balanced, loose };
}

/** A clean contraption's wiring: nothing wrong, and every pin wired or deliberately free (the System's crafted notice). */
export const isClean = (g: TypedGraph): boolean => typedProblems(g).length === 0 && balance(g).loose.length === 0;

/** The plain graph the existing layout works on: commands and properties are inputs, outputs are outputs. */
export function toGraph(g: TypedGraph): Graph {
  const nodes: GNode[] = g.nodes.map((n) => ({
    id: n.id,
    inputs: n.pins.filter((p) => p.kind !== 'output').map((p) => p.id),
    outputs: n.pins.filter((p) => p.kind === 'output').map((p) => p.id),
  }));
  const wires = [...g.wires]
    .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0))
    .map((w) => ({ from: { node: w.from.node, port: w.from.port }, to: { node: w.to.node, port: w.to.port } }));
  return { nodes, wires };
}
