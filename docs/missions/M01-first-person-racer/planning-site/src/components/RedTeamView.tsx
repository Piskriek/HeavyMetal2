import { useEffect, useRef, useState } from 'react';
import { CRITIQUES, UNASKED, NEW_RETRIEVAL, NEW_QUESTIONS, NEW_BACKLOG, type CritCategory, type CritSeverity } from '../plan/redteam';
import { catchUpBound, cageBarAlpha, PACE_MAX, PACE_MIN } from '../sim/redteam';
import { Chip, Stat } from './ui';
import { cn } from '../utils/cn';

const SEV: Record<CritSeverity, string> = {
  critical: 'bg-red-900/60 text-red-200 border-red-600/70',
  high: 'bg-orange-900/50 text-orange-200 border-orange-700/60',
  medium: 'bg-amber-900/40 text-amber-200 border-amber-700/60',
  low: 'bg-stone-800 text-stone-300 border-stone-600',
};

export function CritiqueBoard() {
  const [cat, setCat] = useState<CritCategory | 'all'>('all');
  const cats: (CritCategory | 'all')[] = ['all', 'bug', 'inconsistency', 'design', 'process', 'verification'];
  const shown = CRITIQUES.filter((c) => cat === 'all' || c.category === cat);
  const bySev = (s: CritSeverity) => CRITIQUES.filter((c) => c.severity === s).length;
  return (
    <div>
      <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4">
        {(['critical', 'high', 'medium', 'low'] as CritSeverity[]).map((s) => (
          <div key={s} className={cn('rounded-lg border px-3 py-2', SEV[s])}>
            <div className="font-display text-2xl font-extrabold">{bySev(s)}</div>
            <div className="text-[11px] uppercase tracking-widest">{s}</div>
          </div>
        ))}
      </div>
      <div className="mb-3 flex flex-wrap gap-1" role="group" aria-label="Filter critique">
        {cats.map((c) => (
          <button key={c} type="button" onClick={() => setCat(c)} aria-pressed={cat === c} className={cn('btn !py-1 !text-xs', cat !== c && 'btn-ghost')}>
            {c} {c === 'all' ? CRITIQUES.length : CRITIQUES.filter((x) => x.category === c).length}
          </button>
        ))}
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {shown.map((c) => (
          <article key={c.id} className="panel p-4">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm font-bold text-brass">{c.id}</span>
              <span className={cn('rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase', SEV[c.severity])}>{c.severity}</span>
              <Chip>{c.category}</Chip>
              <span className="ml-auto flex gap-1">{c.resolvedBy.map((r) => <Chip key={r} tone="teal">{r}</Chip>)}</span>
            </div>
            <h4 className="font-semibold text-stone-100">{c.title}</h4>
            <p className="mt-1 text-sm leading-relaxed text-stone-300">{c.finding}</p>
            <p className="mt-2 rounded border border-iron-3 bg-black/30 px-2 py-1 font-mono text-[11px] text-stone-400">evidence: {c.evidence}</p>
            <p className="mt-2 text-sm text-emerald-200/90"><b>Fix:</b> {c.fix}</p>
          </article>
        ))}
      </div>
    </div>
  );
}

export function UnaskedView() {
  const [open, setOpen] = useState<string | null>('UQ1');
  return (
    <div className="grid gap-2">
      {UNASKED.map((q) => {
        const isOpen = open === q.id;
        return (
          <article key={q.id} className={cn('panel overflow-hidden', isOpen && 'border-brass/50')}>
            <button type="button" className="flex w-full items-start gap-3 px-4 py-3 text-left" onClick={() => setOpen(isOpen ? null : q.id)} aria-expanded={isOpen}>
              <span className="w-12 shrink-0 font-mono text-sm font-bold text-brass">{q.id}</span>
              <span className="flex-1 font-semibold text-stone-100">{q.question}</span>
              {q.humanConfirm && <Chip tone="ember">confirm w/ human</Chip>}
              {q.proof && <Chip tone="teal">live proof</Chip>}
              <span className="hidden gap-1 md:flex">{q.tickets.map((t) => <Chip key={t} tone="brass">{t}</Chip>)}</span>
              <span className="text-stone-500">{isOpen ? '▾' : '▸'}</span>
            </button>
            {isOpen && (
              <div className="grid gap-4 border-t border-iron-3 px-4 py-4 md:grid-cols-2">
                <div className="space-y-2 text-sm leading-relaxed">
                  <p className="text-stone-400"><b className="text-stone-300">Why it matters.</b> {q.why}</p>
                  <p><b className="text-brass-2">Answer.</b> {q.answer}</p>
                  {q.proof && <a href={`#${q.proof}`} className="btn btn-teal !py-1 !text-xs">▶ Jump to the live proof</a>}
                </div>
                <div>
                  <p className="mb-2 font-mono text-[11px] uppercase tracking-widest text-teal">Frozen</p>
                  <ul className="space-y-1.5">
                    {q.frozen.map((f) => <li key={f} className="rounded-md border border-iron-3 bg-black/30 px-2.5 py-1.5 font-mono text-[12px] text-stone-200">{f}</li>)}
                  </ul>
                </div>
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}

export function BoundCalculator() {
  const [lo, setLo] = useState(PACE_MIN);
  const [hi, setHi] = useState(PACE_MAX);
  const [gap, setGap] = useState(42);
  const r = catchUpBound({ gapTicks: gap, paceMin: lo, paceMax: hi, rideDistance: 31 + 2 * Math.PI * 114.56, diameter: 66, margin: 20 });
  const pct = Math.min(100, (r.closing / Math.max(1, r.budget)) * 100);
  return (
    <div id="proof-bound" className="panel scroll-mt-24 p-4">
      <h4 className="font-display text-lg font-extrabold text-brass-2">UQ7 · Can pace survive the merge without breaking exit order?</h4>
      <p className="mt-1 text-sm text-stone-400">The worst case is the slowest leader followed by the fastest follower. The follower closes (vMax − vMin)·t over the leader’s ride to the loop exit, and that must stay under the release gap minus a diameter and a margin.</p>
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <label className="text-xs text-stone-300">pace floor {lo.toFixed(2)}<input type="range" min={0.8} max={1} step={0.01} value={lo} onChange={(e) => setLo(Math.min(+e.target.value, hi))} className="w-full accent-amber-500" /></label>
        <label className="text-xs text-stone-300">pace ceiling {hi.toFixed(2)}<input type="range" min={1} max={1.25} step={0.01} value={hi} onChange={(e) => setHi(Math.max(+e.target.value, lo))} className="w-full accent-amber-500" /></label>
        <label className="text-xs text-stone-300">release gap {gap} ticks<input type="range" min={12} max={90} value={gap} onChange={(e) => setGap(+e.target.value)} className="w-full accent-amber-500" /></label>
      </div>
      <div className="mt-3 h-4 overflow-hidden rounded-full border border-iron-3 bg-black/40" role="meter" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label="Closing distance as a share of budget">
        <div className={cn('h-full transition-all', r.ok ? 'bg-teal/70' : 'bg-red-500/80')} style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-6">
        <Stat label="vMin / vMax" value={`${r.vMin.toFixed(0)} / ${r.vMax.toFixed(0)}`} />
        <Stat label="ride time (s)" value={r.tRide.toFixed(2)} />
        <Stat label="closing (x-u)" value={r.closing.toFixed(0)} />
        <Stat label="budget (x-u)" value={r.budget.toFixed(0)} />
        <Stat label="order preserved" value={r.ok ? '✓ proven' : '✗ can overtake'} ok={r.ok} />
        <Stat label="vMin ≥ 650 loop min" value={r.loopMinOk ? '✓' : '✗ ride ≠ release'} ok={r.loopMinOk} />
      </div>
    </div>
  );
}

export function CageStrobe() {
  const ref = useRef<HTMLCanvasElement>(null);
  const [kmh, setKmh] = useState(140);
  const [fix, setFix] = useState(false);
  const p = useRef({ kmh, fix });
  p.current = { kmh, fix };
  useEffect(() => {
    let raf = 0, phase = 0, last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      // quantise to 60 fps to show what a 60 Hz display samples
      const frameDt = 1 / 60;
      const rate = p.current.kmh / 0.16 / 31;
      phase += rate * dt;
      const c = ref.current?.getContext('2d');
      if (c) {
        const W = 520, H = 170;
        c.clearRect(0, 0, W, H);
        c.fillStyle = '#0d1112';
        c.fillRect(0, 0, W, H);
        const a = cageBarAlpha(rate, frameDt);
        const barA = p.current.fix ? a.barAlpha : 1;
        const blurA = p.current.fix ? a.blurAlpha : 0;
        const cx = 90, cy = 85, R = 66;
        c.strokeStyle = '#9aa3a6'; c.lineWidth = 5;
        c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.stroke();
        for (let k = 0; k < 10; k++) {
          const ang = phase + (k / 10) * Math.PI * 2;
          c.strokeStyle = k === 0 ? `rgba(229,100,43,${barA})` : `rgba(160,168,172,${barA})`;
          c.lineWidth = 4;
          c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(ang) * R, cy + Math.sin(ang) * R); c.stroke();
        }
        if (blurA > 0) {
          c.fillStyle = `rgba(160,168,172,${0.35 * blurA})`;
          c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.fill();
        }
        c.fillStyle = '#b8a47a';
        c.font = '12px JetBrains Mono, monospace';
        c.fillText(`rollRate  ${rate.toFixed(1)} rad/s`, 190, 40);
        c.fillText(`per frame ${a.perFrame.toFixed(3)} rad @60Hz`, 190, 60);
        c.fillText(`Nyquist   ${a.nyquist.toFixed(3)} rad (10 bars)`, 190, 80);
        c.fillStyle = a.ratio >= 1 && !p.current.fix ? '#ef5350' : '#3fb6a8';
        c.fillText(`ratio     ${a.ratio.toFixed(2)} ${a.ratio >= 1 ? (p.current.fix ? '→ blended' : '→ ALIASING') : a.ratio > 0.5 ? '→ fading' : '→ crisp'}`, 190, 100);
        c.fillStyle = '#8e948f';
        c.fillText('The orange spoke goes backwards or freezes once ratio ≥ 1', 190, 130);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div id="proof-cage" className="panel scroll-mt-24 p-4">
      <h4 className="font-display text-lg font-extrabold text-brass-2">UQ3 · The rolling cage strobes at race speed</h4>
      <p className="mt-1 text-sm text-stone-400">At 140 km/h the core spins about 28 rad/s, so a 10-bar cage moves past its Nyquist limit on a 60 Hz display and looks like it is turning backwards. v2 fades the bars into a motion band before that happens.</p>
      <canvas ref={ref} width={520} height={170} className="mt-3 w-full max-w-[520px] rounded-lg border border-iron-3" aria-label="Spinning cage aliasing demo" />
      <div className="mt-3 flex flex-wrap items-center gap-4">
        <label className="text-xs text-stone-300">Speed {kmh} km/h<input type="range" min={0} max={320} value={kmh} onChange={(e) => setKmh(+e.target.value)} className="w-56 accent-amber-500" /></label>
        <label className="flex items-center gap-1.5 text-xs text-stone-300"><input type="checkbox" className="accent-amber-500" checked={fix} onChange={(e) => setFix(e.target.checked)} /> Apply cageBarAlpha fix</label>
      </div>
    </div>
  );
}

export function RevisedOrder() {
  const steps = [
    { id: 'T0', t: 'FP spike + eye-level audit', note: 'NEW · go/no-go on the preview URL', tone: 'teal' },
    { id: 'T1', t: 'Push + skill run-up + migrations', note: '+UQ2 UQ9 UQ17' },
    { id: 'T2', t: 'Merge v2: full gate, align, pace release', note: 'C1 C2 fixed' },
    { id: 'T3', t: 'FP rig, gyro, cage view', note: 'own ball visible' },
    { id: 'T4', t: 'Cockpit: IK arms, sonar, light, jolt, touch', note: '+UQ11–16' },
    { id: 'T5', t: 'Effects (no gore), cockpit FX', note: 'C11' },
    { id: 'T6', t: 'Lanes + course validation + analog steer', note: 'UQ6 UQ15' },
    { id: 'T7', t: 'Builder lane tool', note: 'inline warnings' },
  ];
  return (
    <div className="panel overflow-x-auto p-4">
      <div className="flex min-w-[900px] gap-2">
        {steps.map((s, i) => (
          <div key={s.id} className="flex flex-1 items-center gap-2">
            <div className={cn('flex-1 rounded-lg border p-2.5', s.tone ? 'border-teal/60 bg-teal/10' : 'border-iron-3 bg-iron-2')}>
              <div className="font-display text-lg font-extrabold text-brass-2">{s.id}</div>
              <div className="text-[11px] leading-tight text-stone-200">{s.t}</div>
              <div className="mt-1 font-mono text-[10px] text-teal">{s.note}</div>
            </div>
            {i < steps.length - 1 && <span className="text-brass/60">→</span>}
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-stone-500">T0 takes about half a day and settles the biggest unknown, whether the world holds up at eye level, before about 70% of the effort is committed. If the audit fails, T3 grows a dressing sub-ticket, and T1 and T2 still land unchanged because they don’t depend on the camera.</p>
    </div>
  );
}

export function RedTeamExtras() {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="panel p-4">
        <h4 className="mb-2 font-display text-lg font-extrabold text-brass-2">New retrieval requests</h4>
        <ul className="space-y-2 text-sm">{NEW_RETRIEVAL.map((r) => <li key={r.id} className="rounded border border-iron-3 bg-black/25 p-2"><span className="font-mono text-teal">{r.id}</span> {r.ask}<div className="text-xs text-stone-500">{r.why}</div></li>)}</ul>
      </div>
      <div className="panel p-4">
        <h4 className="mb-2 font-display text-lg font-extrabold text-brass-2">New questions for the human</h4>
        <ul className="space-y-2 text-sm">{NEW_QUESTIONS.map((q) => <li key={q.id} className="rounded border border-iron-3 bg-black/25 p-2"><span className="font-mono text-brass">{q.id}</span> {q.question}<div className="text-xs text-teal">default: {q.defaultAnswer}</div></li>)}</ul>
      </div>
      <div className="panel p-4">
        <h4 className="mb-2 font-display text-lg font-extrabold text-brass-2">New backlog</h4>
        <ul className="space-y-2 text-sm text-stone-300">{NEW_BACKLOG.map((b) => <li key={b} className="rounded border border-iron-3 bg-black/25 p-2">{b}</li>)}</ul>
      </div>
    </div>
  );
}
