import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import EconomyReport from '@/components/EconomyReport';
import GoblinGallery from '@/components/GoblinGallery';
import ShamanCalculator from '@/components/ShamanCalculator';
import Link from 'next/link';
import { simulateSeason } from '@/hmgp2/economy-sim';

export const dynamic = 'force-static';

const SECTIONS: { file: string; id: string; label: string }[] = [
  { file: '00-overview.md', id: 'overview', label: '0 · Summary & ADRs' },
  { file: '01-data-models.md', id: 'data-models', label: '1 · Data models' },
  { file: '02-ball-baker.md', id: 'ball-baker', label: '2 · Ball baker' },
  { file: '03-avatar.md', id: 'avatar', label: '3 · Goblin compositor' },
  { file: '04-economy-shaman.md', id: 'economy', label: '4 · Economy & Shaman' },
  { file: '05a-menu-hub.md', id: 'ui-hub', label: '5A · Menu & Hub' },
  { file: '05b-profile-altar.md', id: 'ui-profile', label: '5B · Profile & Altar' },
  { file: '05c-ball-customizer.md', id: 'ui-garage', label: '5C · Ball Customizer' },
  { file: '05d-character-creator.md', id: 'ui-creator', label: '5D · Character Creator' },
  { file: '05e-bookie.md', id: 'ui-bookie', label: '5E · Bookie Parlor' },
  { file: '06-anticheat.md', id: 'anticheat', label: '6 · Anti-cheat' },
  { file: '07-tickets.md', id: 'tickets', label: '7 · Tickets T01–T12' },
  { file: '08-critique.md', id: 'critique', label: '8 · Red team & unasked Qs' },
  { file: '09-avatar-png-pipeline.md', id: 'avatar-png', label: '9 · PNG parts & nudges' },
];

export default async function Page() {
  const docs = await Promise.all(SECTIONS.map(async (s) => ({ ...s, body: await readFile(path.join(process.cwd(), 'content/plan', s.file), 'utf8') })));
  const report = simulateSeason(1337, 2000);
  const extras: Record<string, ReactNode> = {
    avatar: <GoblinGallery />,
    economy: (<><ShamanCalculator /><EconomyReport report={report} /></>),
    'ui-creator': (<Link href="/creator" className="studio-cta">🧌 Open the interactive Goblin Studio — nudges, painted PNG parts, DNA v2, keying lab →</Link>),
    'avatar-png': (<Link href="/creator" className="studio-cta">🧪 Try the Keying Lab and nudge controls live →</Link>),
  };

  return (
    <div className="mx-auto flex max-w-[1500px] gap-8 px-4 py-8 lg:px-8">
      <nav className="sticky top-6 hidden h-[calc(100vh-3rem)] w-60 shrink-0 overflow-y-auto lg:block">
        <div className="mb-4 font-black uppercase tracking-widest text-amber-400">Heavy Metal GP 2</div>
        <div className="mb-6 text-xs text-stone-400">Meta-game architecture plan · Season Zero</div>
        <Link href="/creator" className="studio-cta mb-4 !block !text-center">🧌 Goblin Studio</Link>
        <ul className="space-y-1 text-sm">
          {SECTIONS.map((s) => (
            <li key={s.id}><a className="block rounded px-2 py-1 text-stone-300 hover:bg-stone-800 hover:text-amber-300" href={`#${s.id}`}>{s.label}</a></li>
          ))}
        </ul>
        <div className="mt-6 border-t border-stone-800 pt-4 text-xs leading-relaxed text-stone-500">
          Code: <code>src/hmgp2/*</code><br />Schema: <code>src/db/schema.ts</code><br />API: <code>/api/shaman/quote</code>
        </div>
      </nav>
      <main className="min-w-0 flex-1">
        {docs.map((d) => (
          <section key={d.id} id={d.id} className="plan mb-14 scroll-mt-6">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{d.body}</ReactMarkdown>
            {extras[d.id]}
          </section>
        ))}
      </main>
    </div>
  );
}
