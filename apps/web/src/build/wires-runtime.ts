import { LogicGraph, validate, type Action, type Node, type Vec3 } from '@hm/triggers';

/**
 * Trigger zones and wires, running (the Logic tab, F7): the island's zones and wires become a @hm/triggers graph (a zone's enter or leave,
 * or a clock, feeds an action), stepped every frame with where the goblins are. What fires comes back as plain effects for the island:
 * hide or show a thing (only for show, like the rules), switch a lamp, play a sound, say words, send you somewhere. The graph is rebuilt
 * only when the zones or wires change.
 */
export interface PlacedZone { readonly ref: string; readonly x: number; readonly y: number; readonly z: number; readonly half: number }
export interface PlacedWire { readonly ref: string; readonly from: string; readonly when: 'enter' | 'leave' | 'every'; readonly every: number; readonly to: string; readonly do: string; readonly sound: string; readonly text: string }
export type WireEffect =
  | { readonly kind: 'hide' | 'show' | 'toggle'; readonly thing: string }
  | { readonly kind: 'light-on' | 'light-off'; readonly lamp: string }
  | { readonly kind: 'sound'; readonly sound: string }
  | { readonly kind: 'say'; readonly text: string }
  | { readonly kind: 'teleport'; readonly to: string };

/** The graph for a set of zones and wires (pure). A wire to a zone that is gone is left out. */
export function graphOf(zones: readonly PlacedZone[], wires: readonly PlacedWire[]): Node[] {
  const nodes: Node[] = [];
  const have = new Set<string>();
  const zoneById = new Map(zones.map((z) => [z.ref, z]));
  for (const w of wires) {
    let source: string;
    if (w.when === 'every') { source = `t:${w.ref}`; nodes.push({ id: source, kind: 'timer', every: Math.max(0.2, w.every) }); }
    else {
      const z = zoneById.get(w.from);
      if (!z) continue;
      source = `z:${z.ref}:${w.when}`;
      if (!have.has(source)) { have.add(source); nodes.push({ id: source, kind: w.when, centre: [z.x, z.y, z.z], half: [z.half, Math.max(2, z.half), z.half] }); }
    }
    // the action carries what the island needs; @hm/triggers only fires it on each rising edge
    const action: Action = w.do === 'sound' ? { kind: 'sound', sound: w.sound } : w.do === 'say' ? { kind: 'say', text: w.text }
      : w.do === 'teleport' ? { kind: 'teleport', to: [0, 0, 0] } : w.do === 'light-on' || w.do === 'light-off' ? { kind: w.do, target: w.to }
      : { kind: w.do === 'show' ? 'show' : w.do === 'hide' ? 'hide' : 'open', target: w.to };
    nodes.push({ id: `a:${w.ref}`, kind: 'action', inputs: [source], action, repeat: 0 });
  }
  return nodes;
}

export class WiresRuntime {
  private graph: LogicGraph | null = null;
  private key = '';
  private wireByAction = new Map<string, PlacedWire>();

  /** One frame: rebuild if the zones or wires changed, step with the goblins' positions, return what to do. */
  step(dt: number, zones: readonly PlacedZone[], wires: readonly PlacedWire[], actors: readonly Vec3[]): WireEffect[] {
    const key = JSON.stringify([zones, wires]);
    if (key !== this.key) {
      this.key = key;
      const nodes = graphOf(zones, wires);
      this.graph = nodes.length && validate(nodes).length === 0 ? new LogicGraph(nodes) : null;
      this.wireByAction = new Map(wires.map((w) => [`a:${w.ref}`, w]));
    }
    if (!this.graph) return [];
    const fired = this.graph.step({ dt, actors: actors.map((a) => [a[0], a[1], a[2]] as Vec3), pressed: [] });
    const out: WireEffect[] = [];
    for (const f of fired) {
      const w = this.wireByAction.get(f.node);
      if (!w) continue;
      if (w.do === 'sound') out.push({ kind: 'sound', sound: w.sound });
      else if (w.do === 'say') out.push({ kind: 'say', text: w.text });
      else if (w.do === 'teleport') out.push({ kind: 'teleport', to: w.to });
      else if (w.do === 'light-on' || w.do === 'light-off') out.push({ kind: w.do, lamp: w.to });
      else out.push({ kind: w.do === 'show' ? 'show' : w.do === 'hide' ? 'hide' : 'toggle', thing: w.to });
    }
    return out;
  }
}
