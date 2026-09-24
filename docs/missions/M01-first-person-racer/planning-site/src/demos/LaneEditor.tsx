import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import {
  adjacentPath, applyLaneEdit, corridorAt, describeRefusal, oobCrossed, resolveLaneTarget, sampleLane, sampleNetwork, snapNode,
  successorPath, validateLaneNetwork, type LaneEdit, type LaneNetwork, type LaneNodeKind,
} from '../sim/laneNetwork';
import { steerStep } from '../sim/gyro';
import { CopyButton, Stat } from '../components/ui';
import { cn } from '../utils/cn';

const W = 1000, H = 360, XMIN = 150, XMAX = 5800;
const px = (x: number) => ((x - XMIN) / (XMAX - XMIN)) * W;
const py = (z: number) => ((480 - z) / 960) * H;
const ex = (p: number) => XMIN + (p / W) * (XMAX - XMIN);
const ez = (p: number) => 480 - (p / H) * 960;
const PATH_COLORS = ['#d4a24c', '#5fb4c9', '#b388eb', '#9ccc65', '#e5642b', '#f06292', '#80cbc4', '#ffd54f'];
const KIND_COLOR: Record<LaneNodeKind, string> = { normal: '#cfc8b8', merge: '#3fb6a8', split: '#f1cf85', oob: '#ef5350' };

interface Drive { active: boolean; x: number; z: number; vz: number; pathId: string | null; bias: -1 | 0 | 1; biasUntil: number; t: number; flash: string | null; flashUntil: number; oobCount: number }

export function LaneEditor() {
  const [net, setNet] = useState<LaneNetwork>(sampleNetwork);
  const [undo, setUndo] = useState<LaneNetwork[]>([]);
  const [redo, setRedo] = useState<LaneNetwork[]>([]);
  const [sel, setSel] = useState<string | null>('s1');
  const [selPath, setSelPath] = useState<string | null>('E');
  const [mergeMode, setMergeMode] = useState(false);
  const [snap, setSnap] = useState({ lanes: true, grid: true });
  const [toast, setToast] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ id: string; base: LaneNetwork } | null>(null);
  const drive = useRef<Drive>({ active: false, x: 300, z: 120, vz: 0, pathId: 'B', bias: 0, biasUntil: 0, t: 0, flash: null, flashUntil: 0, oobCount: 0 });
  const netRef = useRef(net);
  netRef.current = net;
  const [, force] = useState(0);

  const validation = useMemo(() => validateLaneNetwork(net), [net]);
  const errors = validation.ok ? [] : validation.errors;
  const badNodes = new Set(errors.map((e) => ('nodeId' in e ? e.nodeId : '')).filter(Boolean));

  const flash = (m: string) => { setToast(m); window.setTimeout(() => setToast(null), 2600); };

  const commit = useCallback((edit: LaneEdit, base?: LaneNetwork) => {
    const from = base ?? netRef.current;
    const r = applyLaneEdit(from, edit);
    if (!r.ok) { flash(`Refused: ${r.reason}`); return false; }
    setUndo((u) => [...u.slice(-29), from]);
    setRedo([]);
    setNet(r.network);
    return true;
  }, []);

  const doUndo = () => { if (!undo.length) return; setRedo((r) => [net, ...r]); setNet(undo[undo.length - 1]); setUndo((u) => u.slice(0, -1)); };
  const doRedo = () => { if (!redo.length) return; setUndo((u) => [...u, net]); setNet(redo[0]); setRedo((r) => r.slice(1)); };

  const toSvg = (e: ReactPointerEvent) => {
    const svg = svgRef.current!;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    return { x: ex(p.x), z: ez(p.y) };
  };

  const onNodeDown = (e: ReactPointerEvent, id: string) => {
    e.stopPropagation();
    if (mergeMode && selPath) {
      commit({ op: 'merge', fromPathId: selPath, intoNodeId: id });
      setMergeMode(false);
      return;
    }
    setSel(id);
    const owner = net.paths.find((p) => p.nodeIds.includes(id));
    if (owner) setSelPath(owner.id);
    (e.target as Element).setPointerCapture(e.pointerId);
    drag.current = { id, base: net };
  };
  const onMove = (e: ReactPointerEvent) => {
    if (!drag.current) return;
    const p = toSvg(e);
    const s = snapNode(p.x, p.z, snap);
    const r = applyLaneEdit(drag.current.base, { op: 'moveNode', nodeId: drag.current.id, x: s.x, z: s.z });
    if (r.ok) setNet(r.network);
  };
  const onUp = () => {
    if (!drag.current) return;
    const base = drag.current.base;
    drag.current = null;
    if (base !== netRef.current) { setUndo((u) => [...u.slice(-29), base]); setRedo([]); }
  };

  const selNode = net.nodes.find((n) => n.id === sel) ?? null;
  const insertAfterSelected = () => {
    if (!selNode) return flash('Select a node first');
    const p = net.paths.find((q) => q.nodeIds.includes(selNode.id) && q.nodeIds.indexOf(selNode.id) < q.nodeIds.length - 1);
    if (!p) return flash('Selected node has no downstream segment');
    const next = net.nodes.find((n) => n.id === p.nodeIds[p.nodeIds.indexOf(selNode.id) + 1])!;
    commit({ op: 'insertNode', pathId: p.id, x: Math.round((selNode.x + next.x) / 2), z: Math.round((selNode.z + next.z) / 2) });
  };
  const splitSelected = () => {
    if (!selNode) return flash('Select a node first');
    commit({ op: 'split', nodeId: selNode.id, to: { x: selNode.x + 700, z: selNode.z > 0 ? selNode.z - 240 : selNode.z + 240 } });
  };
  const cycleKind = () => {
    if (!selNode) return;
    const order: LaneNodeKind[] = ['normal', 'merge', 'split', 'oob'];
    commit({ op: 'setKind', nodeId: selNode.id, kind: order[(order.indexOf(selNode.kind) + 1) % 4] });
  };

  const onKey = (e: ReactKeyboardEvent) => {
    const k = e.key.toLowerCase();
    const d = drive.current;
    if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); return e.shiftKey ? doRedo() : doUndo(); }
    if ((e.ctrlKey || e.metaKey) && k === 'y') { e.preventDefault(); return doRedo(); }
    if (d.active && (k === 'a' || k === 'arrowleft' || k === 'd' || k === 'arrowright')) {
      e.preventDefault();
      steerDrive(k === 'a' || k === 'arrowleft' ? -1 : 1);
      return;
    }
    if (k === 'delete' || k === 'backspace') { if (sel) { e.preventDefault(); if (commit({ op: 'deleteNode', nodeId: sel })) setSel(null); } }
    if (k === 'k') cycleKind();
    if (k === 'i') insertAfterSelected();
    if (k === 's') splitSelected();
    if (k === 'm' && selPath) setMergeMode(true);
    if (k === 'o' && selPath) commit({ op: 'markOob', pathId: selPath });
    if (k === 'escape') setMergeMode(false);
  };

  const steerDrive = (dir: -1 | 1) => {
    const d = drive.current;
    d.bias = dir;
    d.biasUntil = d.t + 0.8;
    if (!d.pathId) return;
    const adj = adjacentPath(netRef.current, d.pathId, d.x, dir);
    if (adj) d.pathId = adj;
  };

  // test-drive loop (fixed 120 Hz)
  useEffect(() => {
    let raf = 0, last = performance.now(), acc = 0, ui = 0;
    const loop = (now: number) => {
      acc += Math.min(0.1, (now - last) / 1000);
      last = now;
      const d = drive.current;
      const n = netRef.current;
      while (d.active && acc >= 1 / 120) {
        const dt = 1 / 120;
        d.t += dt;
        const prevX = d.x;
        d.x += 900 * dt;
        if (d.pathId) {
          const oob = oobCrossed(n, d.pathId, prevX, d.x);
          if (oob) {
            d.flash = `OOB node ${oob} reached → recoverRacer('oob')`;
            d.flashUntil = d.t + 1.6;
            d.oobCount++;
            Object.assign(d, { x: 300, z: 120, vz: 0, pathId: n.paths.find((p) => sampleLane(n, p.id, 300))?.id ?? null });
            continue;
          }
          if (!sampleLane(n, d.pathId, d.x)) {
            const bias = d.t < d.biasUntil ? d.bias : 0;
            d.pathId = successorPath(n, d.pathId, d.z, bias);
          }
        }
        const t = resolveLaneTarget({ targetLane: 1, pathId: d.pathId, x: d.x }, d.pathId ? n : null);
        const r = steerStep(d, t.targetZ, dt, 1, { zMin: t.zMin, zMax: t.zMax });
        d.z = r.z; d.vz = r.vz;
        if (d.x > XMAX - 50) {
          d.flash = 'Finish of the sample section: looping back';
          d.flashUntil = d.t + 1.2;
          Object.assign(d, { x: 300, z: 120, vz: 0, pathId: n.paths.find((p) => sampleLane(n, p.id, 300))?.id ?? null });
        }
        acc -= dt;
      }
      if (!d.active) acc = 0;
      if (now - ui > 33) { ui = now; force((x) => x + 1); }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const d = drive.current;
  const corr = corridorAt(net, d.x);
  const pathColor = (id: string) => PATH_COLORS[net.paths.findIndex((p) => p.id === id) % PATH_COLORS.length];
  const nodeById = new Map(net.nodes.map((n) => [n.id, n]));

  return (
    <div className="panel p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs text-stone-400">Selected:</span>
        <span className="font-mono text-sm text-brass-2">{sel ?? '—'}</span>
        {selNode && (
          <div className="flex gap-1" role="group" aria-label="Node kind">
            {(['normal', 'merge', 'split', 'oob'] as LaneNodeKind[]).map((k) => (
              <button key={k} type="button" className={cn('btn !px-2 !py-1 !text-xs', selNode.kind !== k && 'btn-ghost')} style={{ color: KIND_COLOR[k] }} onClick={() => commit({ op: 'setKind', nodeId: selNode.id, kind: k })} aria-pressed={selNode.kind === k}>{k}</button>
            ))}
          </div>
        )}
        <span className="mx-1 h-5 w-px bg-iron-3" />
        <button type="button" className="btn btn-ghost !py-1 !text-xs" onClick={insertAfterSelected}>Insert <span className="kbd">I</span></button>
        <button type="button" className="btn btn-ghost !py-1 !text-xs" onClick={() => sel && commit({ op: 'deleteNode', nodeId: sel }) && setSel(null)}>Delete <span className="kbd">Del</span></button>
        <button type="button" className="btn btn-ghost !py-1 !text-xs" onClick={splitSelected}>Split <span className="kbd">S</span></button>
        <button type="button" className={cn('btn !py-1 !text-xs', !mergeMode && 'btn-ghost')} onClick={() => (selPath ? setMergeMode((m) => !m) : flash('Click a path first'))}>Merge {selPath ? `(${selPath}) → click node` : ''} <span className="kbd">M</span></button>
        <button type="button" className="btn btn-ghost !py-1 !text-xs" onClick={() => selPath && commit({ op: 'markOob', pathId: selPath })}>End → OOB <span className="kbd">O</span></button>
        <button type="button" className="btn btn-ghost !py-1 !text-xs" onClick={() => commit({ op: 'addPath', at: [{ x: 700, z: 0 }, { x: 1900, z: 0 }] })}>+ Path</button>
        <span className="mx-1 h-5 w-px bg-iron-3" />
        <button type="button" className="btn btn-ghost !py-1 !text-xs" onClick={doUndo} disabled={!undo.length}>↶ Undo</button>
        <button type="button" className="btn btn-ghost !py-1 !text-xs" onClick={doRedo} disabled={!redo.length}>↷ Redo</button>
        <button type="button" className="btn btn-ghost !py-1 !text-xs" onClick={() => { setUndo((u) => [...u, net]); setNet(sampleNetwork()); }}>Reset sample</button>
      </div>
      <div className="mb-2 flex flex-wrap items-center gap-4 text-xs text-stone-300">
        <label className="flex items-center gap-1.5"><input type="checkbox" className="accent-amber-500" checked={snap.lanes} onChange={(e) => setSnap((s) => ({ ...s, lanes: e.target.checked }))} /> Snap to lane centres (±30 z)</label>
        <label className="flex items-center gap-1.5"><input type="checkbox" className="accent-amber-500" checked={snap.grid} onChange={(e) => setSnap((s) => ({ ...s, grid: e.target.checked }))} /> Grid 50 x</label>
        <span className="text-stone-500">Plan view: x runs down-track to the right; +z (lane 0, far/left) is at the top.</span>
      </div>

      <div className="relative">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="w-full touch-none select-none rounded-lg border border-iron-3 bg-[#141816] outline-none focus-visible:ring-2 focus-visible:ring-teal"
          tabIndex={0}
          onKeyDown={onKey}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerDown={() => { if (!mergeMode) { setSel(null); } }}
          aria-label="Lane network editor. Drag nodes; keys I insert, Delete, K kind, S split, M merge, O out-of-bounds, Ctrl+Z undo."
        >
          {[480, 240, 0, -240, -480].map((z) => <line key={z} x1={0} x2={W} y1={py(z)} y2={py(z)} stroke={Math.abs(z) === 480 ? '#6b5a3c' : '#262c2a'} strokeDasharray={Math.abs(z) === 480 ? '' : '4 6'} />)}
          {[360, 120, -120, -360].map((z, i) => <text key={z} x={4} y={py(z) + 3} fontSize={9} fill="#5b625e" fontFamily="JetBrains Mono">L{i}</text>)}
          {Array.from({ length: 12 }).map((_, i) => { const x = 500 * (i + 1); return <g key={x}><line x1={px(x)} x2={px(x)} y1={0} y2={H} stroke="#1e2422" /><text x={px(x) + 2} y={H - 4} fontSize={9} fill="#4b524e" fontFamily="JetBrains Mono">x{x}</text></g>; })}
          {corr && d.active && <rect x={px(d.x) - 1} y={py(corr.zMax)} width={2} height={py(corr.zMin) - py(corr.zMax)} fill="#3fb6a8" opacity={0.6} />}
          {net.paths.map((p) => {
            const ns = p.nodeIds.map((id) => nodeById.get(id)).filter(Boolean) as { x: number; z: number }[];
            if (ns.length < 2) return null;
            const top = ns.map((n) => `${px(n.x)},${py(n.z + p.halfWidth)}`);
            const bot = [...ns].reverse().map((n) => `${px(n.x)},${py(n.z - p.halfWidth)}`);
            const c = pathColor(p.id);
            return (
              <g key={p.id} onPointerDown={(e) => { e.stopPropagation(); setSelPath(p.id); }} className="cursor-pointer">
                <polygon points={[...top, ...bot].join(' ')} fill={c} opacity={selPath === p.id ? 0.2 : 0.08} />
                <polyline points={ns.map((n) => `${px(n.x)},${py(n.z)}`).join(' ')} fill="none" stroke={c} strokeWidth={selPath === p.id ? 3.5 : 2.2} />
                <polyline points={ns.map((n) => `${px(n.x)},${py(n.z)}`).join(' ')} fill="none" stroke="transparent" strokeWidth={14} />
                <text x={px(ns[0].x) + 6} y={py(ns[0].z) - 8} fontSize={10} fill={c} fontFamily="JetBrains Mono">{p.id} · {p.name}</text>
              </g>
            );
          })}
          {net.nodes.map((n) => {
            const isSel = n.id === sel;
            const bad = badNodes.has(n.id);
            return (
              <g key={n.id} transform={`translate(${px(n.x)} ${py(n.z)})`} onPointerDown={(e) => onNodeDown(e, n.id)} className="cursor-grab">
                {isSel && <circle r={13} fill="none" stroke="#fff" strokeDasharray="3 3" />}
                {bad && <circle r={15} fill="none" stroke="#ef5350" strokeWidth={2} />}
                {n.kind === 'split' ? <rect x={-7} y={-7} width={14} height={14} transform="rotate(45)" fill={KIND_COLOR.split} stroke="#111" />
                  : n.kind === 'merge' ? <rect x={-7} y={-7} width={14} height={14} fill={KIND_COLOR.merge} stroke="#111" />
                  : <circle r={n.kind === 'oob' ? 8 : 6} fill={KIND_COLOR[n.kind]} stroke="#111" />}
                {n.kind === 'oob' && <path d="M-4 -4 L4 4 M4 -4 L-4 4" stroke="#111" strokeWidth={2} />}
                <text y={20} textAnchor="middle" fontSize={9} fill="#8e948f" fontFamily="JetBrains Mono">{n.id}</text>
              </g>
            );
          })}
          {d.active && (
            <g transform={`translate(${px(d.x)} ${py(d.z)})`}>
              <circle r={9} fill="#f08a24" stroke="#1a1206" strokeWidth={2} />
              <circle r={4} fill="#f1cf85" />
            </g>
          )}
        </svg>
        {toast && <div role="status" className="absolute left-1/2 top-3 -translate-x-1/2 rounded-md border border-ember/60 bg-black/80 px-3 py-1.5 text-xs text-orange-200">{toast}</div>}
        {d.flash && d.t < d.flashUntil && <div role="status" className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-md border border-red-500/60 bg-black/80 px-3 py-1.5 font-mono text-xs text-red-200">{d.flash}</div>}
      </div>

      <div className="mt-3 grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <button type="button" className="btn btn-teal" onClick={() => { const dd = drive.current; dd.active = !dd.active; if (dd.active) { Object.assign(dd, { x: 300, z: 120, vz: 0, t: 0, pathId: net.paths.find((p) => sampleLane(net, p.id, 300) && Math.abs((sampleLane(net, p.id, 300)?.z ?? 0) - 120) < 1)?.id ?? net.paths[0]?.id ?? null }); svgRef.current?.focus(); } force((x) => x + 1); }}>
              {d.active ? '■ Stop test drive' : '▶ Test drive (A/D to change path)'}
            </button>
            <button type="button" className="btn btn-ghost !py-1" onClick={() => steerDrive(-1)} disabled={!d.active}>◀ lane −1 (+z)</button>
            <button type="button" className="btn btn-ghost !py-1" onClick={() => steerDrive(1)} disabled={!d.active}>lane +1 ▶</button>
          </div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
            <Stat label="racer.pathId" value={d.pathId ?? 'null (legacy)'} />
            <Stat label="x / z" value={`${d.x.toFixed(0)} / ${d.z.toFixed(0)}`} />
            <Stat label="corridor at x" value={corr ? `${corr.zMin.toFixed(0)}..${corr.zMax.toFixed(0)}` : '—'} />
            <Stat label="split bias" value={d.t < d.biasUntil ? (d.bias > 0 ? '+1 (−z)' : '−1 (+z)') : '0 (nearest)'} />
            <Stat label="OOB triggers" value={d.oobCount} />
            <Stat label="legacy parity (null net)" value={`targetZ ${resolveLaneTarget({ targetLane: 2, pathId: null, x: 0 }, null).targetZ}`} ok />
          </div>
        </div>
        <div>
          <div className="mb-2 flex items-center gap-2">
            <h4 className="font-mono text-[11px] uppercase tracking-widest text-teal">validateLaneNetwork()</h4>
            <span className={cn('rounded px-1.5 py-0.5 font-mono text-[11px]', validation.ok ? 'bg-emerald-900/50 text-emerald-300' : 'bg-red-900/50 text-red-300')}>{validation.ok ? 'OK: save enabled' : `${errors.length} refusal(s): save disabled`}</span>
            <span className="ml-auto"><CopyButton text={JSON.stringify(net, null, 2)} label="Copy JSON" /></span>
          </div>
          <ul aria-live="polite" className="max-h-40 space-y-1 overflow-auto text-xs">
            {errors.map((er, i) => (
              <li key={i}>
                <button type="button" className="w-full rounded border border-red-900/60 bg-red-950/30 px-2 py-1 text-left text-red-200 hover:bg-red-950/60" onClick={() => 'nodeId' in er && setSel(er.nodeId)}>
                  <span className="font-mono text-red-400">{er.code}</span> {describeRefusal(er)}
                </button>
              </li>
            ))}
            {validation.ok && <li className="text-stone-500">All topology rules hold: merge = ≥2 in / 1 out, split = 1 in / ≥2 out, OOB is terminal, x is monotone, |z| ≤ 443.</li>}
          </ul>
          <p className="mt-2 text-xs text-stone-500">Try setting <b>c1</b> to “merge”, dragging <b>d1</b> behind <b>s1</b> (the move is refused), or marking path F as OOB, then test drive into it.</p>
        </div>
      </div>
    </div>
  );
}
