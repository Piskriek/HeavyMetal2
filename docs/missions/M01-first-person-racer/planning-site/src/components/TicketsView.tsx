import { useState } from 'react';
import { TICKETS } from '../plan/tickets';
import { AMENDMENTS } from '../plan/redteam';
import { Chip, CopyButton } from './ui';
import { cn } from '../utils/cn';

function Block({ title, items, mono, ordered }: { title: string; items: string[]; mono?: boolean; ordered?: boolean }) {
  const L = ordered ? 'ol' : 'ul';
  return (
    <div>
      <h4 className="mb-2 font-mono text-[11px] uppercase tracking-widest text-teal">{title}</h4>
      <L className={cn('space-y-1.5 text-sm leading-relaxed', ordered ? 'list-decimal pl-5 marker:text-brass' : '')}>
        {items.map((it) => (
          <li key={it} className={cn(!ordered && 'rounded-md border border-iron-3 bg-black/25 px-2.5 py-1.5', mono && 'font-mono text-[12px]')}>{it}</li>
        ))}
      </L>
    </div>
  );
}

export function TicketsView() {
  const [active, setActive] = useState('T1');
  const t = TICKETS.find((x) => x.id === active)!;
  return (
    <div>
      {/* dependency rail */}
      <div className="panel mb-5 overflow-x-auto p-4">
        <div className="flex min-w-[760px] items-stretch gap-2">
          {TICKETS.map((x, i) => (
            <div key={x.id} className="flex flex-1 items-center gap-2">
              <button
                type="button"
                onClick={() => setActive(x.id)}
                aria-pressed={active === x.id}
                className={cn('flex-1 rounded-lg border px-3 py-2 text-left transition', active === x.id ? 'border-brass bg-brass/15 shadow-[0_0_20px_rgba(212,162,76,.2)]' : 'border-iron-3 bg-iron-2 hover:border-brass/40')}
              >
                <div className="font-display text-lg font-extrabold text-brass-2">{x.id}</div>
                <div className="line-clamp-2 text-[11px] leading-tight text-stone-300">{x.title}</div>
                <div className="mt-1 flex flex-wrap gap-1">{x.reqs.map((r) => <span key={r} className="font-mono text-[10px] text-teal">{r}</span>)}</div>
              </button>
              {i < TICKETS.length - 1 && <span className="text-brass/60">→</span>}
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-stone-500">Order rationale (v2): T0 settles the eye-level perception risk cheaply before anything else. The run shape (T1 push, T2 merge) changes physics and status flow, so it lands next. The camera (T3) must survive the hold and the loop. Presentation (T4, T5) then reads frozen state. The lane network (T6) generalises the shove clamp T2 left in place, and the builder (T7) authors it.</p>
      </div>

      <article className="panel rivets p-5">
        <header className="flex flex-wrap items-start gap-3">
          <div>
            <p className="font-mono text-xs text-teal">{t.reqs.join(' · ')} — decisions {t.decisions.join(', ')}</p>
            <h3 className="font-display text-2xl font-extrabold text-brass-2">{t.id} — {t.title}</h3>
          </div>
          <div className="ml-auto flex gap-2"><CopyButton text={t.verify.join('\n')} label="Copy verify cmds" /></div>
        </header>
        <p className="mt-3 max-w-4xl text-sm leading-relaxed text-stone-300">{t.goal}</p>
        {AMENDMENTS[t.id] && (
          <div className="mt-4 rounded-lg border border-teal/50 bg-teal/5 p-3">
            <p className="mb-1.5 font-mono text-[11px] uppercase tracking-widest text-teal">Red-team v2 patch: these override the v1 text below</p>
            <ul className="space-y-1 text-sm text-stone-200">
              {AMENDMENTS[t.id].map((a) => <li key={a} className="font-mono text-[12px]"><span className={a.startsWith('+') ? 'text-emerald-300' : 'text-amber-300'}>{a.slice(0, 1)}</span>{a.slice(1)}</li>)}
            </ul>
          </div>
        )}
        {t.id === 'T0' && <p className="mt-3 rounded-md border border-teal/50 bg-teal/10 px-3 py-2 text-xs text-teal">NEW in v2: added by red-team finding C6.</p>}
        <p className="mt-2 text-xs text-stone-400"><b className="text-stone-300">Depends on:</b> {t.dependsOn.join('; ')} · <b className="text-stone-300">Interfaces:</b> {t.interfaces.map((i) => <Chip key={i} tone="brass">{i}</Chip>)}</p>

        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <Block title="Create" items={t.create} mono />
          <Block title="Modify" items={t.modify} mono />
        </div>
        <div className="mt-5"><Block title="Behaviour spec (tick-driven)" items={t.behaviour} ordered /></div>
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <Block title="Acceptance criteria" items={t.acceptance} />
          <div className="space-y-5">
            <div>
              <h4 className="mb-2 font-mono text-[11px] uppercase tracking-widest text-teal">Required tests</h4>
              <div className="space-y-2">
                {t.tests.map((s) => (
                  <div key={s.suite} className="rounded-md border border-iron-3 bg-black/25 p-2.5">
                    <div className="font-mono text-[12px] text-brass-2">{s.suite}</div>
                    <div className="mt-1 flex flex-wrap gap-1">{s.names.map((n) => <Chip key={n}>{n}</Chip>)}</div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h4 className="mb-2 font-mono text-[11px] uppercase tracking-widest text-teal">Verification</h4>
              <pre className="code-block p-3 text-emerald-200">{t.verify.map((v) => `$ ${v}`).join('\n')}</pre>
            </div>
            {t.art && <Block title="Art budget" items={t.art} />}
            <Block title="Out of scope" items={t.outOfScope} />
            <div className="rounded-md border border-ember/40 bg-ember/10 p-2.5 text-sm text-orange-200">
              <b>UNVERIFIED in sandbox:</b> {t.unverifiable.length ? t.unverifiable.join('; ') : 'nothing. This ticket is fully headless.'}
            </div>
          </div>
        </div>
      </article>
    </div>
  );
}
