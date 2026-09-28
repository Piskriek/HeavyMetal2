import { useState } from 'react';
import { DECISIONS } from '../plan/decisions';
import { DECISION_PATCHES } from '../plan/redteam';
import type { Verdict } from '../plan/types';
import { Chip, VerdictBadge } from './ui';
import { cn } from '../utils/cn';

export function DecisionsView() {
  const [filter, setFilter] = useState<Verdict | 'all'>('all');
  const [open, setOpen] = useState<string | null>('D9');
  const counts = DECISIONS.reduce<Record<string, number>>((m, d) => ((m[d.verdict] = (m[d.verdict] ?? 0) + 1), m), {});
  const shown = DECISIONS.filter((d) => filter === 'all' || d.verdict === filter);
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2" role="group" aria-label="Filter decisions">
        {(['all', 'accept', 'amend', 'reject'] as const).map((f) => (
          <button key={f} type="button" onClick={() => setFilter(f)} className={cn('btn !py-1 !text-xs', filter !== f && 'btn-ghost')} aria-pressed={filter === f}>
            {f} {f === 'all' ? DECISIONS.length : counts[f] ?? 0}
          </button>
        ))}
        <span className="ml-auto text-xs text-stone-500">
          {counts.reject ? `${counts.reject} rejected` : 'No outright rejections'}. {counts.accept ?? 0} accepted as proposed, {counts.amend ?? 0} amended with frozen numbers.
        </span>
      </div>
      <div className="grid gap-3">
        {shown.map((d) => {
          const isOpen = open === d.id;
          return (
            <article key={d.id} className="panel overflow-hidden">
              <button type="button" className="flex w-full items-center gap-3 px-4 py-3 text-left" onClick={() => setOpen(isOpen ? null : d.id)} aria-expanded={isOpen}>
                <span className="w-10 font-mono text-sm font-semibold text-brass">{d.id}</span>
                <VerdictBadge v={d.verdict} />
                <span className="flex-1 font-semibold text-stone-100">{d.title}</span>
                {DECISION_PATCHES[d.id] && <span className="rounded border border-teal/50 px-1.5 py-0.5 font-mono text-[10px] text-teal">v2 patched</span>}
                <span className="hidden gap-1 md:flex">{d.reqs.map((r) => <Chip key={r} tone="teal">{r}</Chip>)}</span>
                <span className="text-stone-500">{isOpen ? '▾' : '▸'}</span>
              </button>
              {isOpen && (
                <div className="grid gap-4 border-t border-iron-3 px-4 py-4 md:grid-cols-2">
                  <div className="space-y-3 text-sm leading-relaxed">
                    <p><span className="font-semibold text-brass-2">Choice. </span>{d.choice}</p>
                    <p className="text-stone-400"><span className="font-semibold text-stone-300">Reason. </span>{d.reason}</p>
                    {DECISION_PATCHES[d.id] && (
                      <div className="rounded-md border border-teal/50 bg-teal/5 p-2.5">
                        <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-teal">v2 red-team patch</p>
                        <ul className="space-y-1 text-[13px] text-stone-200">{DECISION_PATCHES[d.id].map((p) => <li key={p}>↳ {p}</li>)}</ul>
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="mb-2 font-mono text-[11px] uppercase tracking-widest text-teal">Frozen</p>
                    <ul className="space-y-1.5">
                      {d.frozen.map((f) => (
                        <li key={f} className="rounded-md border border-iron-3 bg-black/30 px-2.5 py-1.5 font-mono text-[12px] text-stone-200">{f}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
