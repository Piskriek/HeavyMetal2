import { useRef, useState, type ReactElement } from 'react';
import { cmd, type PresetId } from '@hm/contracts';
import type { Runtime } from '@hm/engine';
import { WIRE_DOS } from '@hm/buildkit';
import { layers, portPos, wirePath, type GNode, type Graph, type Placed } from '@hm/wiregraph';
import { useRev } from '../use-rev';
import { fx } from '../maker/feedback';

/**
 * The Visual Wire Graph (hotbar spec V3, Advanced F7 Logic): it reads left to right like a sentence. Trigger
 * zones (and clocks) on the left, the things and lamps they act on on the right, each wire a purple cord from a zone's "walks in" or
 * "walks out" to what it acts on; @hm/wiregraph orders the columns so cords cross as little as possible. Drag from a zone's port onto a
 * thing or a lamp to wire it (it does what the tool's options say); click a cord to change what it does or take it away.
 */
const NODE_W = 150, NODE_H = 52, COL_GAP = 130, ROW_GAP = 14, PAD = 12;
const WHEN_WORDS: Readonly<Record<string, string>> = { enter: 'walks in', leave: 'walks out', tick: 'every few seconds' };
interface WireRow { readonly ref: string; readonly from: string; readonly when: string; readonly to: string; readonly does: string }

const curve = (a: [number, number], b: [number, number]): string => { const [p0, c1, c2, p1] = wirePath(a, b); return `M${p0[0]} ${p0[1]} C${c1[0]} ${c1[1]} ${c2[0]} ${c2[1]} ${p1[0]} ${p1[1]}`; };

export function WireGraph(props: { readonly rt: Runtime; readonly sceneId: PresetId; readonly does: string }): ReactElement {
  const { rt, sceneId } = props;
  useRev(rt);
  const [picked, setPicked] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ from: string; when: string; a: [number, number]; b: [number, number] } | null>(null);
  const [note, setNote] = useState('');
  const svg = useRef<SVGSVGElement>(null);
  const scene = rt.store.get(sceneId);
  const live = (slot: string): string[] => (scene?.children[slot] ?? []).filter((r) => rt.store.get(r.ref)).map((r) => r.ref as string);
  const zones = live('zones'), lamps = live('lamps'), things = live('models').slice(0, 40);
  const wires: WireRow[] = live('wires').map((ref) => { const pr = rt.store.resolve(ref as PresetId).params as Record<string, unknown>; return { ref, from: String(pr['from'] ?? ''), when: String(pr['when'] ?? 'enter'), to: String(pr['to'] ?? ''), does: String(pr['do'] ?? 'toggle') }; });
  const nameOf = (ref: string): string => rt.store.get(ref as PresetId)?.name ?? 'Gone';
  const zoneName = (ref: string): string => `Zone ${zones.indexOf(ref) + 1}`;
  const isLamp = (ref: string): boolean => lamps.includes(ref);

  // the graph: zones and clocks feed things and lamps
  const clocks = wires.filter((w) => w.when === 'every');
  const targets = [...things, ...lamps];
  const nodes: GNode[] = [
    ...zones.map((id) => ({ id, inputs: [], outputs: ['enter', 'leave'] })),
    ...clocks.map((w) => ({ id: `clock:${w.ref}`, inputs: [], outputs: ['tick'] })),
    ...targets.map((id) => { const ins = wires.filter((w) => w.to === id).map((w) => w.ref); return { id, inputs: ins.length ? ins : ['+'], outputs: [] }; }),
  ];
  const known = new Set(nodes.map((n) => n.id));
  const graph: Graph = {
    nodes,
    wires: wires.flatMap((w) => { const from = w.when === 'every' ? `clock:${w.ref}` : w.from; return known.has(from) && known.has(w.to) ? [{ from: { node: from, port: w.when === 'every' ? 'tick' : w.when }, to: { node: w.to, port: w.ref } }] : []; }),
  };
  // two columns, each in the order @hm/wiregraph's sweeps give (fewest crossings)
  const order = new Map(layers(graph).flat().map((id, i) => [id, i]));
  const left = nodes.filter((n) => n.outputs.length).sort((p, q) => (order.get(p.id) ?? 0) - (order.get(q.id) ?? 0));
  const right = nodes.filter((n) => !n.outputs.length).sort((p, q) => (order.get(p.id) ?? 0) - (order.get(q.id) ?? 0));
  const placed = new Map<string, Placed>();
  left.forEach((n, i) => placed.set(n.id, { id: n.id, x: PAD, y: PAD + i * (NODE_H + ROW_GAP), w: NODE_W, h: NODE_H }));
  right.forEach((n, i) => placed.set(n.id, { id: n.id, x: PAD + NODE_W + COL_GAP, y: PAD + i * (NODE_H + ROW_GAP), w: NODE_W, h: NODE_H }));
  const width = PAD * 2 + NODE_W * 2 + COL_GAP, height = PAD * 2 + Math.max(left.length, right.length, 1) * (NODE_H + ROW_GAP);
  const nodeOf = (id: string): GNode | undefined => nodes.find((n) => n.id === id);
  const port = (id: string, side: 'in' | 'out', p: string): [number, number] | null => { const pl = placed.get(id), n = nodeOf(id); return pl && n ? portPos(pl, n, side, p) : null; };

  const toSvg = (cx: number, cy: number): [number, number] => {
    const el = svg.current, m = el?.getScreenCTM();
    if (!el || !m) return [cx, cy];
    const pt = el.createSVGPoint(); pt.x = cx; pt.y = cy;
    const q = pt.matrixTransform(m.inverse());
    return [q.x, q.y];
  };
  const wire = (from: string, when: string, to: string): void => {
    const lampWanted = props.does === 'light-on' || props.does === 'light-off';
    if (lampWanted && !isLamp(to)) { setNote('Light on and off need a lamp: drop the cord on a lamp.'); return; }
    const id = `wire-${Date.now().toString(36)}`;
    rt.commands.transaction('Wire', () => {
      rt.commands.execute(cmd.put({ id, kind: 'logic-wire', name: 'Wire', params: { from, when, every: 3, to, do: props.does, sound: 'item-pickup', text: 'Hello!' } as never, tier: 'play' }, 'Wire'));
      rt.commands.execute(cmd.addChild(sceneId, 'wires', id, undefined, 'Wire'));
    });
    setPicked(id); setNote(''); fx('place', { volume: 0.5 });
  };
  const remove = (ref: string): void => {
    const i = (scene?.children['wires'] ?? []).findIndex((r) => r.ref === ref);
    if (i >= 0) rt.commands.execute(cmd.removeChild(sceneId, 'wires', i, 'Remove a wire'));
    setPicked(null); fx('delete', { volume: 0.5 });
  };
  const sel = wires.find((w) => w.ref === picked) ?? null;

  if (!zones.length && !wires.length) return <p className="wg-empty">No zones yet. Put one down with Trigger Volume (F7), then come back and drag a cord from it to a thing.</p>;
  return (
    <div className="wg">
      <div className="wg-canvas">
        <svg ref={svg} width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Wire graph"
          onPointerMove={(e) => { if (drag) setDrag({ ...drag, b: toSvg(e.clientX, e.clientY) }); }}
          onPointerUp={(e) => {
            if (!drag) return;
            const [x, y] = toSvg(e.clientX, e.clientY);
            const over = right.find((n) => { const p = placed.get(n.id)!; return x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h; });
            if (over) wire(drag.from, drag.when, over.id);
            setDrag(null);
          }}>
          {graph.wires.map((w) => {
            const a = port(w.from.node, 'out', w.from.port), b = port(w.to.node, 'in', w.to.port);
            if (!a || !b) return null;
            const on = picked === w.to.port, d = curve(a, b);
            return (
              <g key={w.to.port} className="wire" tabIndex={0} role="button" aria-label={`Wire to ${nameOf(w.to.node)}`} onClick={() => setPicked(w.to.port)} onKeyDown={(e) => { if (e.key === 'Enter') setPicked(w.to.port); if (e.key === 'Delete') remove(w.to.port); }}>
                <path className="hit" d={d} />
                <path className={`cord${on ? ' on' : ''}`} d={d} />
              </g>
            );
          })}
          {drag ? <path className="cord on" d={curve(drag.a, drag.b)} /> : null}
          {[...left, ...right].map((n) => {
            const p = placed.get(n.id)!;
            const zone = n.outputs.length > 0, clock = n.id.startsWith('clock:');
            const title = clock ? 'Clock' : zone ? zoneName(n.id) : nameOf(n.id);
            const sub = clock ? 'every few seconds' : zone ? 'a trigger zone' : isLamp(n.id) ? 'a lamp' : 'a thing';
            return (
              <g key={n.id} className={`node${zone ? ' zone' : ''}`} data-node={n.id}>
                <rect x={p.x} y={p.y} width={p.w} height={p.h} />
                {zone ? <rect className="bar" x={p.x} y={p.y} width={p.w} height={3} /> : null}
                <text className="title" x={p.x + 10} y={p.y + 21}>{title.length > 20 ? `${title.slice(0, 19)}…` : title}</text>
                <text className="sub" x={p.x + 10} y={p.y + 37}>{sub}</text>
                {n.outputs.map((o) => { const q = portPos(p, n, 'out', o)!; return (
                  <g key={o}>
                    {!clock ? <text className="sub port-word" x={q[0] - 8} y={q[1] + 3} textAnchor="end">{WHEN_WORDS[o] ?? o}</text> : null}
                    <rect className="port" x={q[0] - 4} y={q[1] - 4} width={8} height={8}
                      onPointerDown={(e) => { if (clock) return; e.preventDefault(); (e.target as Element).setPointerCapture?.(e.pointerId); setDrag({ from: n.id, when: o, a: q, b: q }); }} />
                  </g>
                ); })}
                {n.inputs.map((i) => { const q = portPos(p, n, 'in', i)!; return <rect key={i} className={`port${i === '+' ? ' open' : ''}`} x={q[0] - 4} y={q[1] - 4} width={8} height={8} />; })}
              </g>
            );
          })}
        </svg>
      </div>
      <div className="wg-bar" aria-live="polite">
        {sel ? (
          <>
            <span>{sel.when === 'every' ? 'Every few seconds' : sel.when === 'leave' ? `When a goblin walks out of ${zoneName(sel.from)}` : `When a goblin walks into ${zoneName(sel.from)}`}, {nameOf(sel.to)}:</span>
            <select value={sel.does} onChange={(e) => rt.commands.execute(cmd.setParam(`${sel.ref}.do`, e.target.value as never, 'Change a wire'))}>
              {WIRE_DOS.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <button onClick={() => remove(sel.ref)}>Take the wire away</button>
          </>
        ) : <span className="dim">{note || 'Drag from a zone’s square onto a thing or a lamp to wire it. Click a cord to change it.'}</span>}
      </div>
    </div>
  );
}
