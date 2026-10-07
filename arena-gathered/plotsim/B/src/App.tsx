import { useEffect, useMemo, useRef, useState } from 'react';
import {
  KINDS,
  GATE,
  METRICS,
  newPlot,
  level,
  network,
  running,
  canPlace,
  place,
  step,
  nextStage,
  rates,
  type Env,
  type MachineKind,
  type PlotState,
  type Metric,
} from './index';

// A flat, generous testing ground: richness is good almost everywhere,
// a little poorer at the rim, so the reference player always finds ore.
const env: Env = {
  gate: { x: 0, z: 0 },
  plotRadius: 220,
  richness: (x, z) => {
    const d = Math.hypot(x, z);
    return Math.max(0.15, 0.85 - d / 500);
  },
};

const METRIC_COLOR: Record<Metric, string> = {
  pxd: '#f59e0b',
  vtx: '#8b5cf6',
  lx: '#eab308',
  aq: '#38bdf8',
};

const KIND_COLOR: Record<MachineKind, string> = {
  drill: '#78716c',
  mill: '#f59e0b',
  pylon: '#94a3b8',
  press: '#8b5cf6',
  power: '#ef4444',
  projector: '#eab308',
  water: '#38bdf8',
};

// The reference player from the acceptance tests: build the next wish every
// 15 s of sim time, at the first free spot on widening rings.
const WISH: MachineKind[] = [
  'mill', 'drill', 'drill', 'press', 'power', 'drill', 'mill', 'press', 'pylon', 'projector', 'power', 'drill',
  'mill', 'press', 'projector', 'pylon', 'water', 'power', 'drill', 'water', 'mill', 'press', 'projector', 'water',
  'power', 'pylon', 'drill', 'mill', 'press', 'projector', 'water', 'power',
];

function autoBuild(s: PlotState, wish: number): { s: PlotState; wish: number } {
  if (wish >= WISH.length) return { s, wish };
  const kind = WISH[wish]!;
  for (let ring = 8; ring <= 220; ring += 7) {
    for (let deg = 0; deg < 360; deg += 15) {
      const x = Math.cos((deg * Math.PI) / 180) * ring;
      const z = Math.sin((deg * Math.PI) / 180) * ring;
      if (canPlace(s, env, kind, x, z).ok) {
        return { s: place(s, env, kind, x, z, 0), wish: wish + 1 };
      }
    }
  }
  return { s, wish };
}

const SPEED = 60; // the brief asks for the reference player at 60x

export default function App() {
  const [plot, setPlot] = useState<PlotState>(() => newPlot());
  const [wish, setWish] = useState(0);
  const [running_, setRunning] = useState(true);
  const [log, setLog] = useState<string[]>([]);
  const nextWishTick = useRef(0);

  useEffect(() => {
    if (!running_) return;
    const id = setInterval(() => {
      setPlot((prev) => {
        let s = prev;
        // Every 15 simulated seconds, let the reference player act.
        if (s.time >= nextWishTick.current) {
          nextWishTick.current += 15;
          const b = autoBuild(s, wish);
          s = b.s;
          if (b.wish !== wish) setWish(b.wish);
        }
        const { state, events } = step(s, env, SPEED / 10);
        if (events.length) {
          setLog((l) =>
            [
              ...events.map((e) => (e.type === 'stage-up' ? `stage ${e.stage} reached at t=${state.time.toFixed(0)}s` : `${e.type} at t=${state.time.toFixed(0)}s`)),
              ...l,
            ].slice(0, 12),
          );
        }
        return state;
      });
    }, 100);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running_, wish]);

  const net = useMemo(() => network(plot, env), [plot]);
  const run = useMemo(() => running(plot, env), [plot]);
  const r = useMemo(() => rates(plot, env), [plot]);
  const next = nextStage(plot);

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-slate-900 to-zinc-950 p-6 text-slate-100">
      <div className="mx-auto max-w-6xl space-y-4">
        <header className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Plot Economy — preview</h1>
            <p className="text-sm text-slate-400">
              A pure, deterministic simulation. This page runs the reference player from the test suite at {SPEED}×
              speed.
            </p>
          </div>
          <button
            onClick={() => setRunning((v) => !v)}
            className="rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-sm font-medium hover:bg-slate-700"
          >
            {running_ ? 'Pause' : 'Resume'}
          </button>
        </header>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
          <div className="rounded-2xl border border-slate-700 bg-black/40 p-3">
            <svg viewBox="-220 -220 440 440" className="w-full" style={{ aspectRatio: '1/1' }}>
              <circle cx={0} cy={0} r={env.plotRadius} fill="none" stroke="#334155" strokeDasharray="4 4" />
              <circle cx={0} cy={0} r={GATE.reach} fill="#38bdf822" stroke="#38bdf855" />
              <circle cx={0} cy={0} r={GATE.pad} fill="#ffffff22" stroke="#ffffff66" />
              <circle cx={0} cy={0} r={4} fill="#e2e8f0" />
              {plot.machines.map((m) => {
                const spec = KINDS[m.kind];
                const r2 = run.get(m.id) ?? 0;
                return (
                  <g key={m.id} transform={`translate(${m.x} ${m.z})`}>
                    {spec.reach > 0 && <circle r={spec.reach} fill="none" stroke={KIND_COLOR[m.kind] + '55'} strokeDasharray="2 3" />}
                    <circle r={spec.radius} fill={KIND_COLOR[m.kind]} opacity={0.35 + 0.65 * r2} stroke={KIND_COLOR[m.kind]} />
                  </g>
                );
              })}
            </svg>
            <p className="mt-2 text-center text-xs text-slate-500">
              scale: 1 grid ≈ plot radius {env.plotRadius} m · gate reach {GATE.reach} m (blue halo)
            </p>
          </div>

          <div className="space-y-3">
            <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
              <div className="flex items-baseline justify-between">
                <span className="text-lg font-semibold">Stage {plot.stage}</span>
                <span className="text-sm text-slate-400">t = {plot.time.toFixed(0)} s</span>
              </div>
              <div className="mt-1 text-sm text-slate-300">Ore: {plot.ore.toFixed(1)} ({r.ore >= 0 ? '+' : ''}{r.ore.toFixed(2)}/s)</div>
              <div className="mt-1 text-sm text-slate-300">
                Power: {net.satisfaction < 0.999 ? `${(net.satisfaction * 100).toFixed(0)}% satisfied` : 'healthy'} (
                {net.demand.toFixed(0)} / {net.supply.toFixed(0)} kW)
              </div>
              {next && (
                <div className="mt-2 text-xs text-slate-400">
                  Next: stage {next.stage} — {(next.progress * 100).toFixed(0)}% there (
                  {Object.entries(next.needs)
                    .map(([m, v]) => `${m}≥${v}`)
                    .join(', ')}
                  )
                </div>
              )}
            </div>

            <div className="space-y-2 rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
              {METRICS.map((m) => (
                <div key={m} className="space-y-1">
                  <div className="flex justify-between text-xs uppercase tracking-wide text-slate-400">
                    <span>{m}</span>
                    <span>{level(plot, m).toFixed(1)}</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${level(plot, m)}%`, backgroundColor: METRIC_COLOR[m] }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
              <div className="mb-2 text-xs uppercase tracking-wide text-slate-400">Events</div>
              <ul className="space-y-1 text-xs text-slate-300">
                {log.length === 0 && <li className="text-slate-600">—</li>}
                {log.map((l, i) => (
                  <li key={i}>{l}</li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4 text-xs text-slate-400">
              <div className="mb-1 font-medium text-slate-300">Machines ({plot.machines.length})</div>
              {Object.keys(KINDS).map((k) => {
                const kind = k as MachineKind;
                const count = plot.machines.filter((m) => m.kind === kind).length;
                return (
                  <div key={kind} className="flex justify-between">
                    <span style={{ color: KIND_COLOR[kind] }}>{KINDS[kind].name}</span>
                    <span>{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
