'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import GoblinSvg from './GoblinSvg';
import { encodeGoblinDna, generateRandomGoblin } from '@/hmgp2/goblin-dna';

/** Plan-page teaser: deterministic seeds (generator v1 vs v2) + link to the full studio. */
export default function GoblinGallery() {
  const [base, setBase] = useState(1337);
  const [gen, setGen] = useState<1 | 2>(2);
  const seeds = useMemo(() => Array.from({ length: 8 }, (_, i) => base + i), [base]);
  return (
    <div className="panel">
      <div className="panel-title">LIVE · generateRandomGoblin(seed, generator) — identical on every client</div>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
        <button className={`chip ${gen === 1 ? '!border-amber-500' : ''}`} onClick={() => setGen(1)}>generator v1 (frozen, SVG only)</button>
        <button className={`chip ${gen === 2 ? '!border-amber-500' : ''}`} onClick={() => setGen(2)}>generator v2 (+ painted PNG parts)</button>
        <button className="btn" onClick={() => setBase((b) => b + 8)}>🎲 Next 8 seeds</button>
        <Link href="/creator" className="btn">Open the full Goblin Studio →</Link>
      </div>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
        {seeds.map((seed) => {
          const g = generateRandomGoblin(seed, gen);
          return (
            <div key={seed} className="rounded border border-stone-700 p-1">
              <GoblinSvg config={g} size={120} className="!h-auto !w-full aspect-square" />
              <div className="truncate text-[9px] text-stone-500">{seed} · {encodeGoblinDna(g)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
