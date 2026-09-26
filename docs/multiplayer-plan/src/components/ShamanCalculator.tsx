'use client';

import { useEffect, useMemo, useState } from 'react';
import { calculateResurrectionCost, costTable, seasonalNetWorth, wealthCrossover } from '@/hmgp2/shaman';
import type { ResurrectionCalculation } from '@/hmgp2/interfaces';

interface StoredQuote { id: string; deaths: number; elo: number; snw: number; fee: number; dominant: string }

const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

function Slider(props: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; suffix?: string }) {
  return (
    <label className="block text-sm">
      <span className="flex justify-between text-stone-300"><span>{props.label}</span><b className="text-amber-300">{fmt(props.value)}{props.suffix ?? ''}</b></span>
      <input type="range" className="w-full accent-amber-500" min={props.min} max={props.max} step={props.step} value={props.value} onChange={(e) => props.onChange(Number(e.target.value))} />
    </label>
  );
}

export default function ShamanCalculator() {
  const [deaths, setDeaths] = useState(2);
  const [elo, setElo] = useState(1612);
  const [wallet, setWallet] = useState(2340);
  const [inventory, setInventory] = useState(860);
  const [escrow, setEscrow] = useState(200);
  const [grossInflow, setGrossInflow] = useState(4900);
  const [server, setServer] = useState<ResurrectionCalculation | null>(null);
  const [recent, setRecent] = useState<StoredQuote[]>([]);

  const snw = useMemo(() => seasonalNetWorth({ liquidWallet: wallet, inventoryValue: inventory, betEscrow: escrow, grossSeasonalInflow: grossInflow }), [wallet, inventory, escrow, grossInflow]);
  const calc = useMemo(() => calculateResurrectionCost(deaths, elo, snw.snw, wallet), [deaths, elo, snw.snw, wallet]);
  const next = useMemo(() => calculateResurrectionCost(deaths + 1, elo, snw.snw, wallet), [deaths, elo, snw.snw, wallet]);
  const table = useMemo(() => costTable(), []);
  const maxBar = Math.max(calc.eloFloor, calc.wealthTax, 1);

  useEffect(() => {
    const t = setTimeout(async () => {
      const res = await fetch('/api/shaman/quote', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ deaths, elo, wallet, inventory, escrow, grossInflow }) }).catch(() => null);
      if (res?.ok) setServer(((await res.json()) as { quote: ResurrectionCalculation }).quote);
      const list = await fetch('/api/shaman/quote').catch(() => null);
      if (list?.ok) setRecent(((await list.json()) as { quotes: StoredQuote[] }).quotes);
    }, 400);
    return () => clearTimeout(t);
  }, [deaths, elo, wallet, inventory, escrow, grossInflow]);

  const recColor = calc.recommendation === 'resurrect' ? 'text-emerald-300' : calc.recommendation === 'retire' ? 'text-red-400' : 'text-amber-300';

  return (
    <div className="panel">
      <div className="panel-title">LIVE · Shaman Altar fee breakdown (runs <code>src/hmgp2/shaman.ts</code>)</div>
      <div className="grid gap-6 md:grid-cols-[280px_1fr]">
        <div className="space-y-3">
          <Slider label="Season death n" value={deaths} min={1} max={7} step={1} onChange={setDeaths} />
          <Slider label="Elo E" value={elo} min={600} max={2800} step={2} onChange={setElo} />
          <Slider label="Liquid wallet" value={wallet} min={0} max={200000} step={10} onChange={setWallet} suffix=" g" />
          <Slider label="Inventory resale" value={inventory} min={0} max={50000} step={10} onChange={setInventory} suffix=" g" />
          <Slider label="Open bet escrow" value={escrow} min={0} max={20000} step={10} onChange={setEscrow} suffix=" g" />
          <Slider label="Gross seasonal inflow" value={grossInflow} min={0} max={300000} step={50} onChange={setGrossInflow} suffix=" g" />
        </div>
        <div className="space-y-3 font-mono text-sm">
          <div>SNW = max(holdings {fmt(snw.holdings)}, λ·gross {fmt(snw.lambda * snw.grossSeasonalInflow)}) = <b className="text-amber-300">{fmt(snw.snw)} g</b></div>
          <div>
            <div className="flex justify-between"><span>ELO FLOOR  B({elo}) = {fmt(calc.eloFloorBase)} × 1.75^{deaths - 1}</span><b>{fmt(calc.eloFloor)} g</b></div>
            <div className="bar"><span style={{ width: `${(calc.eloFloor / maxBar) * 100}%` }} className={calc.dominantTerm === 'elo-floor' ? 'bg-amber-500' : 'bg-stone-600'} /></div>
          </div>
          <div>
            <div className="flex justify-between"><span>WEALTH TAX  {Math.round(calc.wealthTaxRate * 100)}% × SNW</span><b>{fmt(calc.wealthTax)} g</b></div>
            <div className="bar"><span style={{ width: `${(calc.wealthTax / maxBar) * 100}%` }} className={calc.dominantTerm === 'wealth-tax' ? 'bg-amber-500' : 'bg-stone-600'} /></div>
          </div>
          <div className="border-t border-stone-700 pt-3 text-base">
            FEE = <b className="text-2xl text-amber-300">{fmt(calc.fee)} g</b> <span className="text-stone-400">({calc.dominantTerm} dominant)</span>
          </div>
          <div>Soul Sickness: <b>{calc.soulSicknessHours} h</b> ranked lockout · Affordable: <b className={calc.affordable ? 'text-emerald-300' : 'text-red-400'}>{calc.affordable ? 'yes' : `no — short ${fmt(calc.liquidShortfall)} g`}</b></div>
          <div>Recommendation: <b className={recColor}>{calc.recommendation}</b> · next death (n={deaths + 1}) ≥ {fmt(next.fee)} g, {next.soulSicknessHours} h</div>
          <div className="text-stone-400">Wealth tax overtakes the floor at SNW* = {fmt(wealthCrossover(deaths, elo))} g</div>
          <div className="text-stone-400">Server quote (POST /api/shaman/quote): {server ? <b className={server.fee === calc.fee ? 'text-emerald-300' : 'text-red-400'}>{fmt(server.fee)} g {server.fee === calc.fee ? '✔ matches mirror' : '≠ mirror'}</b> : '…'}</div>
        </div>
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div>
          <div className="mb-2 text-xs uppercase tracking-widest text-stone-400">Spec table regenerated from code</div>
          <table className="mini">
            <thead><tr><th>n</th><th>1,000 Elo</th><th>1,800 Elo</th><th>2,400 Elo</th><th>P(n)</th><th>Lockout</th></tr></thead>
            <tbody>{table.map((r) => <tr key={r.n}><td>{r.n}</td>{r.floors.map((f, i) => <td key={i}>{fmt(f)}</td>)}<td>{Math.round(r.taxRate * 100)}%</td><td>{r.lockoutHours} h</td></tr>)}</tbody>
          </table>
        </div>
        <div>
          <div className="mb-2 text-xs uppercase tracking-widest text-stone-400">Recent server quotes (Postgres · shaman_quotes)</div>
          <table className="mini">
            <thead><tr><th>n</th><th>Elo</th><th>SNW</th><th>Fee</th><th>Term</th></tr></thead>
            <tbody>{recent.length === 0 ? <tr><td colSpan={5} className="text-stone-500">none yet</td></tr> : recent.map((q) => <tr key={q.id}><td>{q.deaths}</td><td>{Math.round(q.elo)}</td><td>{fmt(q.snw)}</td><td>{fmt(q.fee)}</td><td>{q.dominant}</td></tr>)}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
