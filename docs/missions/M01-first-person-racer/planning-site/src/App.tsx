import { useEffect, useState } from 'react';
import { Section, Chip } from './components/ui';
import { DecisionsView } from './components/DecisionsView';
import { InterfacesView } from './components/InterfacesView';
import { TicketsView } from './components/TicketsView';
import { BacklogView, CoverageMatrix, ExportPanel, QuestionsView, RisksView } from './components/ExtrasViews';
import { MergeDemo } from './demos/MergeDemo';
import { GyroDemo } from './demos/GyroDemo';
import { CockpitDemo } from './demos/CockpitDemo';
import { LaneEditor } from './demos/LaneEditor';
import { DECISIONS } from './plan/decisions';
import { INTERFACES } from './plan/interfaces';
import { TICKETS } from './plan/tickets';
import { cn } from './utils/cn';
import { BoundCalculator, CageStrobe, CritiqueBoard, RedTeamExtras, RevisedOrder, UnaskedView } from './components/RedTeamView';
import { CRITIQUES, UNASKED } from './plan/redteam';

const NAV = [
  ['brief', 'Brief'],
  ['redteam', 'Red team'],
  ['unasked', 'Unasked Qs'],
  ['coverage', 'Coverage'],
  ['decisions', 'Decisions'],
  ['interfaces', 'Interfaces'],
  ['tickets', 'Tickets'],
  ['proofs', 'Proofs'],
  ['risks', 'Risks'],
  ['questions', 'Questions'],
  ['backlog', 'Backlog'],
  ['export', 'Export'],
] as const;

const RUN = [
  { t: 'Start pad', d: "status 'ready', raised START_DROP" },
  { t: 'Goblin push', d: '48 ticks → 360·pace ±2%' },
  { t: 'Descent', d: 'gravity to vx 700–1100' },
  { t: 'Gate', d: 'x = 1184.44, full corridor (v2)' },
  { t: 'Pool', d: 'held, intangible, nearest free slot' },
  { t: 'Ready', d: 'player button / bots by rank' },
  { t: '3 · 2 · 1', d: '360 ticks, pausable' },
  { t: 'Align → release', d: 'to loop lane, 700·pace, ≥42-tick gaps' },
  { t: 'Race to survive', d: 'bumps resume after the ghost tail' },
];

function useActiveSection() {
  const [active, setActive] = useState('brief');
  useEffect(() => {
    const els = NAV.map(([id]) => document.getElementById(id)).filter(Boolean) as HTMLElement[];
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setActive(e.target.id)),
      { rootMargin: '-40% 0px -55% 0px' },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return active;
}

export default function App() {
  const active = useActiveSection();
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-brass/20 bg-[#0e1011]/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-2.5">
          <a href="#brief" className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-full border border-brass/60 bg-gradient-to-br from-[#3a3222] to-[#15130e] font-display text-sm font-extrabold text-brass-2">M01</span>
            <span className="hidden font-display text-sm font-extrabold tracking-wide text-brass-2 sm:block">OVERWATCH · GOBLIN RALLY</span>
          </a>
          <nav className="ml-auto flex gap-1 overflow-x-auto" aria-label="Sections">
            {NAV.map(([id, label]) => (
              <a key={id} href={`#${id}`} className={cn('shrink-0 rounded-md px-2.5 py-1 text-xs font-semibold transition', active === id ? 'bg-brass/15 text-brass-2' : 'text-stone-400 hover:text-stone-200')}>
                {label}
              </a>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4">
        {/* BRIEF */}
        <section id="brief" className="scroll-mt-20 pb-6 pt-12">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-teal">Planner reply to the Hands · Piskriek/HeavyMetal2 @ 2d1088a</p>
          <h1 className="mt-2 max-w-4xl font-display text-4xl font-extrabold leading-tight brass-text md:text-6xl">First-Person Goblin Racer</h1>
          <p className="mt-4 max-w-3xl text-base leading-relaxed text-stone-300">
            <span className="mr-1 rounded border border-teal/60 bg-teal/10 px-1.5 py-0.5 font-mono text-xs text-teal">v2: red-teamed</span>
            The decision record, frozen interfaces and eight ordered tickets (T0–T7). Together they turn the four-lane slingshot descent into a cockpit racer with a goblin push start, a first-loop merge pool and authorable lane paths. Every visual claim comes down to pure numbers a Hands test can assert, because{' '}
            <b className="text-orange-300">WebGL cannot be rendered in the sandbox</b>.
          </p>
          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-5">
            {[
              [String(DECISIONS.length), 'decisions recorded'],
              [String(TICKETS.length), 'ordered tickets'],
              [String(INTERFACES.length), 'frozen interfaces'],
              [String(CRITIQUES.length), 'red-team findings'],
              [String(UNASKED.length), 'unasked Qs, answered'],
            ].map(([n, l]) => (
              <div key={l} className="panel px-4 py-3">
                <div className="font-display text-3xl font-extrabold text-brass-2">{n}</div>
                <div className="text-xs uppercase tracking-wider text-stone-400">{l}</div>
              </div>
            ))}
          </div>

          <div className="panel mt-6 p-5">
            <h2 className="font-display text-lg font-extrabold text-brass-2">The new shape of a run</h2>
            <ol className="mt-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-9">
              {RUN.map((r, i) => (
                <li key={r.t} className="relative rounded-lg border border-iron-3 bg-black/30 p-2.5">
                  <span className="font-mono text-[10px] text-teal">{String(i + 1).padStart(2, '0')}</span>
                  <div className="text-sm font-semibold text-stone-100">{r.t}</div>
                  <div className="text-[11px] leading-snug text-stone-400">{r.d}</div>
                </li>
              ))}
            </ol>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            {[
              ['Reuse beats rewrite', 'R9/R10 reuse the tested gate.ts, staging/lifecycle and release/scheduler through one new pure MergePool. The wall-clock legacy checkpoint is deleted.'],
              ['A common release speed proves ordering', 'Every pooled rider leaves at 700 x-u/s, 42 ticks apart. The same speed through the same loop makes exit order equal entry order, which a test can prove rather than hope for.'],
              ['Layer, don’t replace', 'resolveLaneTarget(racer, null) is bit-identical to laneZ(targetLane). Authored lanes change only the target and bounds of the existing PD spring, so all 451 tests stay green.'],
              ['The sim owns the roll', 'rollPhase moves into the 120 Hz step. Caps and goblin use the zero-roll gyro quaternion, so the rider stays level by construction instead of by counter-rotation.'],
              ['The push is real energy', 'The start pad is flat (slope 0), so the goblin push is a seeded 48-tick ramp plus a re-authored descent, with gate speed bounded to [700, 1100] for every loadout.'],
              ['DOM cockpit, GL world', 'Bezel, gauges, yoke and arms are DOM and verifiable headlessly. The GL camera gets setViewOffset so the horizon sits in the aperture, not the screen centre.'],
            ].map(([t, d]) => (
              <div key={t} className="panel p-4">
                <h3 className="font-semibold text-brass-2">{t}</h3>
                <p className="mt-1 text-sm leading-relaxed text-stone-400">{d}</p>
              </div>
            ))}
          </div>
        </section>

        <Section
          id="redteam"
          kicker="Plan v2 · self-critique"
          title="Red team: where plan v1 was wrong"
          intro={<>A hostile read of the plan against the packet’s own evidence. Two findings are <b className="text-red-300">critical</b>: as specified, v1 could not sort 3 of 4 riders at the first loop, and the planner’s demo hid it. Every finding maps to a fix that is now patched into the decisions, tickets and export.</>}
        >
          <CritiqueBoard />
          <div className="mt-8">
            <h3 className="mb-3 font-display text-xl font-extrabold text-brass-2">Revised ticket order</h3>
            <RevisedOrder />
          </div>
        </Section>

        <Section
          id="unasked"
          kicker="What questions are we not asking?"
          title="Eighteen questions v1 never asked, with answers"
          intro="Each is answered with frozen numbers and the ticket it changes. Questions only the human can settle are marked and have defaults, so work is not blocked."
        >
          <UnaskedView />
          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <BoundCalculator />
            <CageStrobe />
          </div>
          <div className="mt-6">
            <RedTeamExtras />
          </div>
        </Section>

        <Section id="coverage" kicker="R1 – R14" title="Requirement coverage" intro="Each requirement maps to at least one ticket. Split requirements are marked.">
          <CoverageMatrix />
        </Section>

        <Section id="decisions" kicker="D1 – D15" title="Decision record" intro="Accept, amend or reject, with the frozen numbers the Hands may not invent. Click a row to expand it.">
          <DecisionsView />
        </Section>

        <Section id="interfaces" kicker="Frozen contracts" title="Frozen interfaces" intro="Signatures to implement exactly. The unit and coordinate space of every numeric field is in the comments.">
          <InterfacesView />
        </Section>

        <Section id="tickets" kicker="T1 – T7" title="Tickets, in order" intro="Each ticket has a goal, files, frozen interfaces, a tick-driven behaviour spec, numbered acceptance criteria, named tests, verification commands and an explicit UNVERIFIED line.">
          <TicketsView />
        </Section>

        <Section
          id="proofs"
          kicker="Executable spec"
          title="Interactive proofs of the frozen math"
          intro={<>These run the same pure functions the interfaces freeze, as reference implementations. They are a spec the human can play with, not a replacement for the Hands’ tests. <Chip tone="teal">no WebGL required</Chip></>}
        >
          <div className="space-y-10">
            <div id="proof-merge" className="scroll-mt-24">
              <h3 className="mb-1 font-display text-xl font-extrabold text-brass-2">T2 · First-loop merge pool (v1 vs v2)</h3>
              <p className="mb-3 max-w-3xl text-sm text-stone-400">MergePool is stepped at 120 Hz against a single-lane loop. Switch to v1 to watch C1 and C2 happen: riders turned away at the gate and bypassing the loop. v2 uses a full-width gate, nearest-slot glides, an align step before each release, and pace-scaled release speed. Ready up, or wait 15 s for auto-ready.</p>
              <MergeDemo />
            </div>
            <div>
              <h3 className="mb-1 font-display text-xl font-extrabold text-brass-2">T3 · Gyro ball</h3>
              <p className="mb-3 max-w-3xl text-sm text-stone-400">advanceRoll runs at 120 Hz. The core cage rolls at hypot(vx,vz)/RADIUS while the brass caps (CAP_THETA = 0.62 rad) and the goblin keep the gyro frame. Turn the gyro off to see why it matters in first person.</p>
              <GyroDemo />
            </div>
            <div id="proof-cockpit" className="scroll-mt-24">
              <h3 className="mb-1 font-display text-xl font-extrabold text-brass-2">T3 + T4 · Cockpit: window, gauges, yoke, arms, plus v2 answers</h3>
              <p className="mb-3 max-w-3xl text-sm text-stone-400">v2 adds IK elbows (UQ13), the sonar dial (UQ12), stage lighting (UQ14), the bump jolt (UQ11), and cage bars from inside the ball with anti-strobe blending (UQ3). Steering uses the verbatim PD spring from racer-physics.ts. The yoke angle is steerFrom(vz)·38°, the arms come from armPose() with shoulders below the viewport, the needles from needleAngle(), and the aperture from cockpitLayout(). Placeholder vector art stands in for the 9 planned PNGs.</p>
              <CockpitDemo />
            </div>
            <div>
              <h3 className="mb-1 font-display text-xl font-extrabold text-brass-2">T6 + T7 · Lane network editor</h3>
              <p className="mb-3 max-w-3xl text-sm text-stone-400">Drag nodes, split, merge, mark OOB, undo, and read the live validation. The test-drive ball steers with the same spring through resolveLaneTarget: split bias comes from your last input, and OOB nodes trigger recovery.</p>
              <LaneEditor />
            </div>
          </div>
        </Section>

        <Section id="risks" kicker="§5.8 · §5.10 · §7" title="Risks and mitigations">
          <RisksView />
        </Section>

        <Section id="questions" kicker="For the human" title="Open questions and retrieval requests" intro="Every question has a default so work is not blocked. Only Q8 (art approval) is a hard gate.">
          <QuestionsView />
        </Section>

        <Section id="backlog" kicker="Parked" title="Backlog and exclusions">
          <BacklogView />
        </Section>

        <Section id="export" kicker="§12 schema" title="Export the reply">
          <ExportPanel />
        </Section>

        <footer className="border-t border-iron-3 py-8 text-center text-xs text-stone-500">
          M01 Overwatch plan · fixed 120 Hz · pure sim, read-only renderer · no wall-clock gameplay · refusals are typed, never silent
        </footer>
      </main>
    </div>
  );
}
