import { useMemo, useState } from 'react';
import { BACKLOG, NOT_ASKING, QUESTIONS, REQUIREMENTS, RETRIEVAL, RISKS } from '../plan/misc';
import { TICKETS } from '../plan/tickets';
import { buildMarkdown } from '../plan/markdown';
import { Chip, CopyButton } from './ui';
import { cn } from '../utils/cn';

export function CoverageMatrix() {
  return (
    <div className="panel overflow-x-auto p-4">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead>
          <tr className="text-xs text-stone-500">
            <th className="py-2 pr-3">Req</th>
            <th className="pr-3">User intent</th>
            {TICKETS.map((t) => <th key={t.id} className="w-12 text-center font-mono text-brass">{t.id}</th>)}
          </tr>
        </thead>
        <tbody>
          {REQUIREMENTS.map((r) => (
            <tr key={r.id} className="border-t border-iron-3">
              <td className="py-1.5 pr-3 font-mono text-teal">{r.id}</td>
              <td className="pr-3 text-stone-300">{r.text}</td>
              {TICKETS.map((t) => (
                <td key={t.id} className="text-center">
                  {r.tickets.includes(t.id) ? <span className={cn('inline-block h-3.5 w-3.5 rounded-full', r.tickets[0] === t.id ? 'bg-brass shadow-[0_0_8px_rgba(212,162,76,.7)]' : 'bg-teal/70')} title={r.tickets[0] === t.id ? 'primary' : 'completes'} /> : <span className="text-stone-700">·</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-xs text-stone-500"><span className="inline-block h-2.5 w-2.5 rounded-full bg-brass" /> primary ticket · <span className="inline-block h-2.5 w-2.5 rounded-full bg-teal/70" /> completed by a later ticket. R11's shove clamp gets its partial generalisation in T6. R12 and R13 are split between runtime (T6) and authoring (T7).</p>
    </div>
  );
}

export function RisksView() {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {RISKS.map((r) => (
        <div key={r.id} className="panel p-4">
          <div className="mb-1 flex items-center gap-2">
            <span className="font-mono text-sm font-semibold text-brass">{r.id}</span>
            <Chip tone={r.severity === 'high' ? 'ember' : r.severity === 'medium' ? 'brass' : 'teal'}>{r.severity}</Chip>
            <span className="font-mono text-[11px] text-stone-500">{r.ref}</span>
          </div>
          <p className="text-sm text-stone-200">{r.risk}</p>
          <p className="mt-2 text-sm text-emerald-200/90"><span className="font-semibold">↳ </span>{r.mitigation}</p>
        </div>
      ))}
    </div>
  );
}

export function QuestionsView() {
  return (
    <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <div className="space-y-2">
        {QUESTIONS.map((q) => (
          <div key={q.id} className="panel flex gap-3 p-3">
            <span className="font-display text-lg font-extrabold text-brass">{q.id}</span>
            <div>
              <p className="text-sm font-semibold text-stone-100">{q.question}</p>
              <p className="mt-1 text-xs text-stone-400">Default if unanswered: <span className="text-teal">{q.defaultAnswer}</span> · blocks: {q.blocks}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="panel h-fit p-4">
        <h3 className="font-display text-lg font-extrabold text-brass-2">Retrieval requests for the Hands</h3>
        <p className="mb-3 text-xs text-stone-400">Specific files and line ranges the plan depends on, per §0. These must be answered before the named ticket starts.</p>
        <ul className="space-y-2">
          {RETRIEVAL.map((r) => (
            <li key={r.id} className="rounded-md border border-iron-3 bg-black/25 p-2.5 text-sm">
              <span className="font-mono text-teal">{r.id}</span> {r.ask}
              <div className="mt-0.5 text-xs text-stone-500">{r.why}</div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function BacklogView() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="panel p-4">
        <h3 className="mb-3 font-display text-lg font-extrabold text-brass-2">Backlog (named, not specified)</h3>
        <ul className="space-y-1.5 text-sm text-stone-300">{BACKLOG.map((b) => <li key={b} className="rounded border border-iron-3 bg-black/20 px-2.5 py-1.5">{b}</li>)}</ul>
      </div>
      <div className="panel p-4">
        <h3 className="mb-3 font-display text-lg font-extrabold text-brass-2">What we are NOT asking for yet</h3>
        <ul className="space-y-1.5 text-sm text-stone-300">{NOT_ASKING.map((b) => <li key={b} className="flex gap-2 rounded border border-iron-3 bg-black/20 px-2.5 py-1.5"><span className="text-red-400">✕</span>{b}</li>)}</ul>
      </div>
    </div>
  );
}

export function ExportPanel() {
  const md = useMemo(() => buildMarkdown(), []);
  const [show, setShow] = useState(false);
  const download = () => {
    const blob = new Blob([md], { type: 'text/markdown' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'M01-overwatch-plan.md';
    a.click();
    URL.revokeObjectURL(a.href);
  };
  return (
    <div className="panel rivets p-5">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h3 className="font-display text-xl font-extrabold text-brass-2">Hand-off packet for the Hands</h3>
          <p className="text-sm text-stone-400">The whole plan as one Markdown reply in the §12 schema ({md.split('\n').length} lines, {(md.length / 1024).toFixed(1)} kB).</p>
        </div>
        <div className="ml-auto flex gap-2">
          <CopyButton text={md} label="Copy Markdown" />
          <button type="button" className="btn" onClick={download}>⬇ Download .md</button>
          <button type="button" className="btn btn-ghost" onClick={() => setShow((s) => !s)} aria-expanded={show}>{show ? 'Hide' : 'Preview'}</button>
        </div>
      </div>
      {show && <pre className="code-block mt-4 max-h-[520px] whitespace-pre-wrap p-4 text-stone-300">{md}</pre>}
    </div>
  );
}
