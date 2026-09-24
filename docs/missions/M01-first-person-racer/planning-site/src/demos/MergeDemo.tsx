import { useCallback, useEffect, useRef, useState } from 'react';
import {
  COUNTDOWN_TICKS, GATE_X, LOOP_LENGTH, LOOP_START_X, LOOP_Z, TICK_HZ, createDemoWorld, loopProgress, mergeOrder, stepDemo,
  type DemoRacer, type DemoWorld, type MergeMode,
} from '../sim/merge';
import { Stat } from '../components/ui';
import { cn } from '../utils/cn';

const W = 960, H = 340, BASE = 262, SCALE = 0.4, X0 = 30, LAT = 0.05;
const CX = X0 + (LOOP_START_X - 190) * SCALE;
const R = 88;

function place(rc: DemoRacer) {
  const lat = -rc.z * LAT;
  if (rc.loopT !== null) {
    const th = (rc.loopT / LOOP_LENGTH) * Math.PI * 2;
    return { x: CX + R * Math.sin(th), y: BASE - R * (1 - Math.cos(th)) + lat * Math.cos(th) };
  }
  return { x: X0 + (rc.x - 190) * SCALE, y: BASE + lat };
}

function draw(ctx: CanvasRenderingContext2D, w: DemoWorld) {
  ctx.clearRect(0, 0, W, H);
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#16201f');
  sky.addColorStop(1, '#0c0f10');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#231f1b';
  ctx.fillRect(0, BASE - 480 * LAT, W, 960 * LAT);
  [360, 120, -120, -360].forEach((z, i) => {
    ctx.strokeStyle = z === LOOP_Z ? 'rgba(63,182,168,0.35)' : 'rgba(212,162,76,0.13)';
    ctx.setLineDash([6, 8]);
    ctx.beginPath();
    ctx.moveTo(X0, BASE - z * LAT);
    ctx.lineTo(W, BASE - z * LAT);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#5b625e';
    ctx.font = '9px JetBrains Mono, monospace';
    ctx.fillText(`L${i}`, 4, BASE - z * LAT + 3);
  });
  // single-lane loop (lane 2)
  ctx.strokeStyle = '#7d6a45';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(CX, BASE - LOOP_Z * LAT - R, R + 8, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 1;
  // gate footprint
  const gx = X0 + (GATE_X - 190) * SCALE;
  const hw = w.pool.opts.gateHalfWidth;
  ctx.fillStyle = w.mode === 'v2' ? 'rgba(63,182,168,0.18)' : 'rgba(239,83,80,0.22)';
  ctx.fillRect(gx - 3, BASE - (w.pool.opts.gateZ + hw) * LAT, 6, 2 * hw * LAT);
  ctx.fillStyle = '#3fb6a8';
  ctx.font = '11px JetBrains Mono, monospace';
  ctx.fillText(`GATE ±${hw}z`, gx - 34, BASE - 480 * LAT - 8);
  ctx.fillStyle = '#b8a47a';
  ctx.fillText('first loop · lane 2 only', CX - 70, BASE - LOOP_Z * LAT - 2 * R - 24);
  ctx.fillText('START PAD', X0, BASE - 480 * LAT - 8);
  const sorted = [...w.racers].sort((a, b) => a.x - b.x);
  for (const rc of sorted) {
    const p = place(rc);
    if (p.x > W + 20) continue;
    ctx.globalAlpha = rc.ghost ? 0.5 : 1;
    ctx.fillStyle = rc.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y - 10, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = rc.bypassed ? '#ef5350' : '#1a1206';
    ctx.lineWidth = rc.bypassed ? 3 : 2;
    ctx.stroke();
    if (rc.held) {
      const e = w.pool.entries.find((x) => x.racerId === rc.id);
      ctx.strokeStyle = e?.aligning ? '#f1cf85' : '#8fe8dd';
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.arc(p.x, p.y - 10, 16, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#efe6d2';
    ctx.font = '10px Inter, sans-serif';
    ctx.fillText(rc.name + (rc.bypassed ? ' ✗ bypassed loop' : ''), p.x - 14, p.y - 26);
  }
  const label = w.pool.countdownLabel(w.tick);
  if (label) {
    ctx.fillStyle = label === 'GO!' ? '#9ccc65' : '#f1cf85';
    ctx.font = '800 64px Cinzel, serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, W * 0.8, 96);
    ctx.textAlign = 'left';
  }
}

export function MergeDemo() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState<MergeMode>('v2');
  const worldRef = useRef<DemoWorld>(createDemoWorld(7, false, 'v2'));
  const [seed, setSeed] = useState(7);
  const [stall, setStall] = useState(false);
  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState(3);
  const [, force] = useState(0);
  const acc = useRef(0);

  const reset = useCallback((s: number, st: boolean, m: MergeMode) => {
    worldRef.current = createDemoWorld(s, st, m);
    acc.current = 0;
    force((n) => n + 1);
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) draw(ctx, worldRef.current);
  }, []);

  useEffect(() => { reset(seed, stall, mode); }, [seed, stall, mode, reset]);

  useEffect(() => {
    if (!running) return;
    let raf = 0, last = performance.now(), lastUi = 0;
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      acc.current += dt * speed;
      const w = worldRef.current;
      let steps = 0;
      while (acc.current >= 1 / TICK_HZ && steps < 1500) {
        stepDemo(w);
        acc.current -= 1 / TICK_HZ;
        steps++;
      }
      const ctx = canvasRef.current?.getContext('2d');
      if (ctx) draw(ctx, w);
      if (now - lastUi > 100) { lastUi = now; force((n) => n + 1); }
      const allGone = w.racers.every((r) => r.exitTick !== null && w.tick > r.exitTick + 240);
      if (allGone || w.tick > 120 * 60) { setRunning(false); force((n) => n + 1); return; }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [running, speed]);

  const w = worldRef.current;
  const pool = w.pool;
  const entryOrder = mergeOrder(pool.entries);
  const complete = w.racers.every((r) => r.exitTick !== null);
  const pooledAll = pool.entries.length === w.racers.length;
  const rodeAll = w.racers.every((r) => r.rodeLoop);
  const orderOk = complete && entryOrder.length === w.racers.length && entryOrder.join() === w.exitOrder.join();
  const player = pool.entries.find((e) => e.isPlayer);
  const canReady = !!player && player.readyTick === null && player.releaseTick === null;
  const autoIn = player && player.readyTick === null ? Math.max(0, (player.entryTick + 1800 - w.tick) / TICK_HZ) : null;

  return (
    <div className="panel p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex overflow-hidden rounded-lg border border-iron-3" role="group" aria-label="Plan version">
          {(['v1', 'v2'] as const).map((m) => (
            <button key={m} type="button" onClick={() => { setRunning(false); setMode(m); }} aria-pressed={mode === m}
              className={cn('px-3 py-1.5 text-xs font-semibold', mode === m ? (m === 'v1' ? 'bg-red-900/60 text-red-200' : 'bg-teal/25 text-teal') : 'text-stone-400')}>
              {m === 'v1' ? 'Plan v1 (as first shipped)' : 'Plan v2 (red-team fix)'}
            </button>
          ))}
        </div>
        <button type="button" className="btn" onClick={() => setRunning((r) => !r)}>{running ? '❚❚ Pause' : '▶ Run'}</button>
        <button type="button" className="btn btn-ghost" onClick={() => { setRunning(false); reset(seed, stall, mode); }}>↺ Reset</button>
        <button type="button" className="btn btn-ghost" onClick={() => { setRunning(false); setSeed((s) => s + 1); }}>🎲 Seed {seed}</button>
        <label className="flex items-center gap-2 text-xs text-stone-300">
          <input type="checkbox" checked={stall} onChange={(e) => { setRunning(false); setStall(e.target.checked); }} className="accent-amber-500" />
          Stall Snotbolt
        </label>
        <div className="ml-auto flex items-center gap-1" role="group" aria-label="Simulation speed">
          {[1, 3, 8].map((s) => (
            <button key={s} type="button" className={cn('btn !px-2 !py-1 !text-xs', speed !== s && 'btn-ghost')} onClick={() => setSpeed(s)} aria-pressed={speed === s}>{s}×</button>
          ))}
        </div>
      </div>
      {mode === 'v1' && (
        <p className="mb-2 rounded-md border border-red-800/60 bg-red-950/40 px-3 py-2 text-xs text-red-200">
          v1 reproduces C1 and C2: the gate’s ±120 lane containment turns away lanes 0, 1 and 3, and the lane-2-only loop is bypassed by anyone released from a side slot. In v1 the loop took everyone, which is why the check showed green.
        </p>
      )}
      <canvas ref={canvasRef} width={W} height={H} className="w-full rounded-lg border border-iron-3" aria-label="Plan view of the run-up, merge gate and single-lane first loop" />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="button" className="btn btn-teal text-base" disabled={!canReady} onClick={() => { pool.ready(0, w.tick); force((n) => n + 1); }}>
          ⚑ READY UP {player ? '' : '(reach the gate first)'}
        </button>
        {autoIn !== null && <span className="text-xs text-stone-400">auto-ready in {autoIn.toFixed(1)} s</span>}
        <span className="ml-auto font-mono text-xs text-stone-400">tick {w.tick} · phase <b className="text-brass-2">{pool.phase}</b> · countdown {COUNTDOWN_TICKS} ticks</span>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-stone-500">
              <tr><th className="py-1">#</th><th>Rider</th><th>pace</th><th>entryTime</th><th>slot z</th><th>release</th><th>release vx</th><th>flags</th></tr>
            </thead>
            <tbody className="font-mono">
              {pool.entries.map((e, i) => {
                const rc = w.racers[e.racerId];
                return (
                  <tr key={e.racerId} className="border-t border-iron-3">
                    <td className="py-1 text-brass-2">{i + 1}</td>
                    <td style={{ color: rc.color }}>{rc.name}</td>
                    <td>{rc.pace.toFixed(3)}</td>
                    <td>{e.entryTime.toFixed(3)}</td>
                    <td>{e.slotZ}</td>
                    <td>{e.releaseTick ?? (e.aligning ? 'aligning' : '—')}</td>
                    <td>{e.releaseTick !== null ? rc.vx.toFixed(0) : '—'}</td>
                    <td className="text-orange-300">{e.flags.join(', ') || '—'}</td>
                  </tr>
                );
              })}
              {pool.refusals.map((r) => (
                <tr key={`ref-${r.racerId}`} className="border-t border-red-900/60 text-red-300">
                  <td className="py-1">✗</td>
                  <td>{w.racers[r.racerId].name}</td>
                  <td colSpan={6}>refused: {r.reason} (z = {w.racers[r.racerId].z.toFixed(0)})</td>
                </tr>
              ))}
              {pool.entries.length === 0 && pool.refusals.length === 0 && <tr><td colSpan={8} className="py-2 text-stone-500">No riders at the gate yet. Press Run.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Stat label="All riders pooled (R9)" value={`${pool.entries.length} / ${w.racers.length}`} ok={pooledAll || (!complete ? undefined : false)} />
          <Stat label="All rode first loop" value={`${w.racers.filter((r) => r.rodeLoop).length} / ${w.racers.length}`} ok={complete ? rodeAll : undefined} />
          <Stat label="Exit = entry order (R10)" value={complete ? (orderOk ? '✓ PASS' : '✗ FAIL') : 'pending'} ok={complete ? orderOk : undefined} />
          <Stat label="Min exit spacing ≥ 200" value={Number.isFinite(w.minExitSpacing) ? `${w.minExitSpacing.toFixed(0)} x-u` : '—'} ok={Number.isFinite(w.minExitSpacing) ? w.minExitSpacing >= 200 : undefined} />
          <Stat label="Illegal contacts" value={w.illegalContacts} ok={w.illegalContacts === 0} />
          <Stat label="Exit order" value={w.exitOrder.map((id) => w.racers[id].name).join(' → ') || '—'} />
          <Stat label="Hold (s)" value={(pool.holdTicks() / TICK_HZ).toFixed(2)} />
          <Stat label="Prev. loop progress" value={w.lastReleased === null ? '—' : loopProgress(w.racers[w.lastReleased]).toFixed(2)} />
        </div>
      </div>
      <p className="mt-3 text-xs text-stone-500">This is reference code, not the repo. The loop is modelled as lane-filtered (|Δz| ≤ 58 + 31) until RQ-7 confirms it. v2 works either way: aligning is harmless if the scan turns out not to filter by lane.</p>
    </div>
  );
}
