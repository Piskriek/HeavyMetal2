import Link from 'next/link';
import CharacterCreatorStudio from '@/components/CharacterCreatorStudio';
import KeyingLab from '@/components/KeyingLab';

export const metadata = { title: 'Goblin Character Creator — Heavy Metal GP 2' };

export default function CreatorPage() {
  return (
    <main className="mx-auto max-w-[1500px] px-4 py-6 lg:px-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="font-black uppercase tracking-widest text-amber-400">Heavy Metal GP 2 · Goblin Studio</div>
          <div className="text-xs text-stone-400">Layered SVG + magenta-keyed painted PNG parts · DNA v2 with nudges · spec: plan §3, §5D, §8, §9</div>
        </div>
        <Link href="/#avatar-png" className="btn-ghost">← Back to the plan</Link>
      </div>
      <CharacterCreatorStudio />
      <KeyingLab />
    </main>
  );
}
