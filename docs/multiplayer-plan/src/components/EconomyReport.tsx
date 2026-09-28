import type { SeasonReport } from '@/hmgp2/economy-sim';

const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

export default function EconomyReport({ report }: { report: SeasonReport }) {
  const w = 640, h = 200, pad = 28;
  const maxFlow = Math.max(...report.days.flatMap((d) => [d.faucet, d.sink]));
  const maxPc = Math.max(...report.days.map((d) => d.perCapita));
  const x = (i: number) => pad + (i / (report.days.length - 1)) * (w - pad * 2);
  const yFlow = (v: number) => h - pad - (v / maxFlow) * (h - pad * 2);
  const yPc = (v: number) => h - pad - (v / maxPc) * (h - pad * 2);
  const line = (fn: (d: SeasonReport['days'][number]) => number, y: (v: number) => number) =>
    report.days.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(fn(d)).toFixed(1)}`).join(' ');
  const faucets = [['Sheep payouts', report.flows.sheepPayout], ['AI pilot contracts', report.flows.aiPilot], ['Season rewards', report.flows.seasonReward]] as const;
  const sinks = [['Sheep fees', report.flows.sheepFee], ['Ranked rake', report.flows.rankedRake], ['Resurrections', report.flows.resurrection], ['Cosmetics', report.flows.cosmetics], ['Slots', report.flows.slots], ['Bookie takeout', report.flows.bookieVig]] as const;

  return (
    <div className="panel">
      <div className="panel-title">LIVE · 30-day season simulation (seed {report.seed}, {fmt(report.players)} players · <code>src/hmgp2/economy-sim.ts</code>)</div>
      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {[
          ['Faucet / sink', report.faucetSinkRatio.toFixed(2)],
          ['Per-capita start → end', `${fmt(report.startSupply / report.players)} → ${fmt(report.endSupply / report.players)} g`],
          ['Ever bankrupt', `${report.everBrokePct}%`],
          ['…recovered ≥ 1k g', `${report.recoveredPct}%`],
          ['Resurrections', fmt(report.resurrections)],
          ['Retirements (avg n)', `${fmt(report.retirements)} (${report.avgDeathsAtRetirement})`],
        ].map(([k, v]) => (
          <div key={k} className="stat"><div className="text-[11px] uppercase tracking-wider text-stone-400">{k}</div><div className="text-lg font-bold text-amber-300">{v}</div></div>
        ))}
      </div>
      <div className="mt-4 grid gap-6 lg:grid-cols-2">
        <svg viewBox={`0 0 ${w} ${h}`} className="w-full rounded bg-stone-950/60" role="img" aria-label="Daily faucet vs sink">
          <text x={pad} y={16} fill="#a8a29e" fontSize="11">Daily faucet (green) vs sink (red), gold</text>
          <path d={line((d) => d.faucet, yFlow)} fill="none" stroke="#4ade80" strokeWidth="2" />
          <path d={line((d) => d.sink, yFlow)} fill="none" stroke="#f87171" strokeWidth="2" />
          <text x={w - pad} y={h - 8} fill="#78716c" fontSize="10" textAnchor="end">day 30</text>
        </svg>
        <svg viewBox={`0 0 ${w} ${h}`} className="w-full rounded bg-stone-950/60" role="img" aria-label="Per-capita money supply">
          <text x={pad} y={16} fill="#a8a29e" fontSize="11">Per-capita wallet → converges toward W* (max {fmt(maxPc)} g)</text>
          <path d={line((d) => d.perCapita, yPc)} fill="none" stroke="#f59e0b" strokeWidth="2.5" />
          <text x={w - pad} y={h - 8} fill="#78716c" fontSize="10" textAnchor="end">day 30</text>
        </svg>
      </div>
      <div className="mt-4 grid gap-6 lg:grid-cols-3">
        <table className="mini"><thead><tr><th>Faucet</th><th>Gold</th></tr></thead><tbody>{faucets.map(([k, v]) => <tr key={k}><td>{k}</td><td>{fmt(v)}</td></tr>)}</tbody></table>
        <table className="mini"><thead><tr><th>Sink</th><th>Gold</th></tr></thead><tbody>{sinks.map(([k, v]) => <tr key={k}><td>{k}</td><td>{fmt(v)}</td></tr>)}</tbody></table>
        <table className="mini"><thead><tr><th>Archetype</th><th>n</th><th>Wallet</th><th>Elo</th></tr></thead>
          <tbody>{Object.entries(report.byArchetype).map(([k, v]) => <tr key={k}><td>{k}</td><td>{v.players}</td><td>{fmt(v.avgWallet)}</td><td>{v.avgElo}</td></tr>)}</tbody></table>
      </div>
    </div>
  );
}
