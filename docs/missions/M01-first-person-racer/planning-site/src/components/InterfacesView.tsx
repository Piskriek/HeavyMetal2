import { useState } from 'react';
import { INTERFACES } from '../plan/interfaces';
import { Chip, CopyButton } from './ui';
import { cn } from '../utils/cn';

function highlight(code: string) {
  // tiny, safe highlighter: split into tokens, style comments/keywords/numbers/strings
  const lines = code.split('\n');
  return lines.map((line, i) => {
    const ci = line.indexOf('//');
    const body = ci >= 0 ? line.slice(0, ci) : line;
    const comment = ci >= 0 ? line.slice(ci) : '';
    const parts = body.split(/(\b(?:export|const|type|interface|function|class|readonly|constructor|number|string|boolean|null|void|unknown|true|false)\b|'[^']*'|\b\d+(?:\.\d+)?\b)/g);
    return (
      <div key={i}>
        {parts.map((p, j) => {
          if (!p) return null;
          if (/^'/.test(p)) return <span key={j} className="text-emerald-300">{p}</span>;
          if (/^\d/.test(p)) return <span key={j} className="text-orange-300">{p}</span>;
          if (/^(export|const|type|interface|function|class|readonly|constructor)$/.test(p)) return <span key={j} className="text-teal">{p}</span>;
          if (/^(number|string|boolean|null|void|unknown|true|false)$/.test(p)) return <span key={j} className="text-sky-300">{p}</span>;
          return <span key={j}>{p}</span>;
        })}
        {comment && <span className="text-stone-500">{comment}</span>}
        {'\n'}
      </div>
    );
  });
}

export function InterfacesView() {
  const [active, setActive] = useState(INTERFACES[0].id);
  const cur = INTERFACES.find((i) => i.id === active)!;
  return (
    <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
      <nav className="flex gap-2 overflow-x-auto lg:flex-col" aria-label="Frozen interfaces">
        {INTERFACES.map((i) => (
          <button key={i.id} type="button" onClick={() => setActive(i.id)} className={cn('shrink-0 rounded-lg border px-3 py-2 text-left transition', active === i.id ? 'border-brass/60 bg-brass/10' : 'border-iron-3 bg-iron-2/60 hover:border-iron-3 hover:bg-iron-2')}>
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-xs font-semibold text-brass-2">{i.id}</span>
              <Chip tone="teal">{i.ticket}</Chip>
            </div>
            <div className="mt-0.5 truncate font-mono text-[11px] text-stone-400">{i.file}</div>
          </button>
        ))}
      </nav>
      <div className="panel min-w-0 p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <code className="font-mono text-sm text-brass-2">{cur.file}</code>
          <span className="text-sm text-stone-400">— {cur.summary}</span>
          <span className="ml-auto"><CopyButton text={cur.code} /></span>
        </div>
        <pre className="code-block max-h-[560px] p-4 text-stone-200">{highlight(cur.code)}</pre>
        <p className="mt-3 text-xs text-stone-500">Units: <b>engine x</b> is in x-units down-track (START_X = 190), <b>lateral z</b> is ±480 lane units (+ = lane 0 / far-left), <b>s</b> is spline arc length, and <b>world</b> is three.js units. Any shape change needs a CONTRACTS_VERSION bump.</p>
      </div>
    </div>
  );
}
