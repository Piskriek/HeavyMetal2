import { useState, type ReactNode } from 'react';
import { cn } from '../utils/cn';
import type { Verdict } from '../plan/types';

export function Section({ id, kicker, title, children, intro }: { id: string; kicker: string; title: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20 py-10">
      <p className="font-mono text-xs uppercase tracking-[0.25em] text-teal">{kicker}</p>
      <h2 className="mt-1 font-display text-2xl font-extrabold brass-text md:text-3xl">{title}</h2>
      {intro && <div className="mt-2 max-w-3xl text-sm leading-relaxed text-stone-400">{intro}</div>}
      <div className="mt-6">{children}</div>
    </section>
  );
}

const verdictStyle: Record<Verdict, string> = {
  accept: 'bg-emerald-900/50 text-emerald-300 border-emerald-700/60',
  amend: 'bg-amber-900/40 text-amber-300 border-amber-700/60',
  reject: 'bg-red-900/40 text-red-300 border-red-700/60',
};

export function VerdictBadge({ v }: { v: Verdict }) {
  return <span className={cn('rounded-md border px-2 py-0.5 font-mono text-[11px] font-semibold uppercase', verdictStyle[v])}>{v}</span>;
}

export function Chip({ children, tone = 'iron' }: { children: ReactNode; tone?: 'iron' | 'teal' | 'brass' | 'ember' }) {
  const t = {
    iron: 'border-iron-3 bg-iron-2 text-stone-300',
    teal: 'border-teal/50 bg-teal/10 text-teal',
    brass: 'border-brass/50 bg-brass/10 text-brass-2',
    ember: 'border-ember/50 bg-ember/10 text-orange-300',
  }[tone];
  return <span className={cn('inline-flex items-center rounded-md border px-1.5 py-0.5 font-mono text-[11px]', t)}>{children}</span>;
}

export function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-ghost !py-1 !text-xs"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          const ta = document.createElement('textarea');
          ta.value = text;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          ta.remove();
        }
        setDone(true);
        setTimeout(() => setDone(false), 1400);
      }}
    >
      {done ? '✓ Copied' : label}
    </button>
  );
}

export function Stat({ label, value, ok }: { label: string; value: ReactNode; ok?: boolean }) {
  return (
    <div className="rounded-lg border border-iron-3 bg-black/30 px-3 py-2">
      <div className="text-[10px] uppercase tracking-widest text-stone-500">{label}</div>
      <div className={cn('font-mono text-sm', ok === undefined ? 'text-stone-200' : ok ? 'text-emerald-300' : 'text-red-300')}>{value}</div>
    </div>
  );
}
