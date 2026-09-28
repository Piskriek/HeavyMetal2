import { DECISIONS } from './decisions';
import { INTERFACES } from './interfaces';
import { TICKETS } from './tickets';
import { BACKLOG, NOT_ASKING, QUESTIONS, REQUIREMENTS, RETRIEVAL, RISKS } from './misc';
import { AMENDMENTS, CRITIQUES, DECISION_PATCHES, NEW_BACKLOG, NEW_QUESTIONS, NEW_RETRIEVAL, UNASKED } from './redteam';

const list = (items: string[], prefix = '- ') => items.map((i) => `${prefix}${i}`).join('\n');

export function buildMarkdown(): string {
  const out: string[] = [];
  out.push('# M01 — OVERWATCH PLAN: FIRST-PERSON GOBLIN RACER');
  out.push('');
  out.push('> Verification stance: WebGL cannot be rendered in the Hands sandbox. Every visual claim below is either pure math under `node --test`, headless DOM geometry, or explicitly handed to the human via the preview URL.');
  out.push('');
  out.push('## REQUIREMENT COVERAGE');
  out.push('| R | Requirement | Tickets |');
  out.push('|---|---|---|');
  REQUIREMENTS.forEach((r) => out.push(`| ${r.id} | ${r.text} | ${r.tickets.join(', ')} |`));
  out.push('');
  out.push('## DECISIONS');
  DECISIONS.forEach((d) => {
    out.push(`### ${d.id} — ${d.title} — **${d.verdict.toUpperCase()}**`);
    out.push(`**Choice:** ${d.choice}`);
    out.push('');
    out.push(`**Reason:** ${d.reason}`);
    out.push('');
    out.push('**Frozen:**');
    out.push(list(d.frozen));
    out.push('');
  });
  out.push('## FROZEN INTERFACES');
  INTERFACES.forEach((i) => {
    out.push(`### ${i.id} — \`${i.file}\` (${i.ticket})`);
    out.push(i.summary);
    out.push('```ts');
    out.push(i.code);
    out.push('```');
    out.push('');
  });
  out.push('## RETRIEVAL REQUESTS (answer before the named ticket)');
  RETRIEVAL.forEach((r) => out.push(`- **${r.id}** ${r.ask} _(${r.why})_`));
  out.push('');
  out.push('## TICKETS (in order)');
  TICKETS.forEach((t) => {
    out.push(`### ${t.id} — ${t.title}`);
    out.push(`**Requirements:** ${t.reqs.join(', ')} · **Decisions:** ${t.decisions.join(', ')} · **Depends on:** ${t.dependsOn.join('; ')}`);
    out.push('');
    out.push(`**Goal:** ${t.goal}`);
    out.push('');
    out.push('**Create:**');
    out.push(list(t.create.map((f) => `\`${f}\``)));
    out.push('**Modify:**');
    out.push(list(t.modify));
    out.push(`**Interfaces frozen:** ${t.interfaces.join(', ')}`);
    out.push('');
    out.push('**Behaviour spec:**');
    out.push(t.behaviour.map((b, i) => `${i + 1}. ${b}`).join('\n'));
    out.push('');
    out.push('**Acceptance criteria:**');
    out.push(list(t.acceptance));
    out.push('');
    out.push('**Required tests:**');
    t.tests.forEach((s) => out.push(`- \`${s.suite}\`: ${s.names.map((n) => `"${n}"`).join(', ')}`));
    out.push('');
    out.push('**Verify:**');
    out.push('```bash');
    out.push(t.verify.join('\n'));
    out.push('```');
    if (t.art?.length) {
      out.push('**Art:**');
      out.push(list(t.art));
    }
    out.push('**Out of scope:**');
    out.push(list(t.outOfScope));
    out.push(`**UNVERIFIED in sandbox:** ${t.unverifiable.length ? t.unverifiable.join('; ') : 'nothing (fully headless)'}`);
    out.push('');
  });
  out.push('## BACKLOG (named, not specified)');
  out.push(list(BACKLOG));
  out.push('');
  out.push('## RISKS + MITIGATIONS');
  out.push('| # | Ref | Severity | Risk | Mitigation |');
  out.push('|---|---|---|---|---|');
  RISKS.forEach((r) => out.push(`| ${r.id} | ${r.ref} | ${r.severity} | ${r.risk} | ${r.mitigation} |`));
  out.push('');
  out.push('## OPEN QUESTIONS FOR THE HUMAN');
  QUESTIONS.forEach((q) => out.push(`- **${q.id}** ${q.question} — _default if unanswered:_ ${q.defaultAnswer} (blocks: ${q.blocks})`));
  out.push('');
  out.push('## WHAT WE ARE NOT ASKING FOR YET');
  out.push(list(NOT_ASKING));
  out.push('');
  out.push('---');
  out.push('# RED-TEAM ADDENDUM (v2). Where it conflicts with the text above, this section wins.');
  out.push('');
  out.push('## CRITIQUE');
  out.push('| # | Severity | Category | Finding | Fix |');
  out.push('|---|---|---|---|---|');
  CRITIQUES.forEach((c) => out.push(`| ${c.id} | ${c.severity} | ${c.category} | **${c.title}.** ${c.finding} _(evidence: ${c.evidence})_ | ${c.fix} |`));
  out.push('');
  out.push('## QUESTIONS WE WERE NOT ASKING, AND THEIR ANSWERS');
  UNASKED.forEach((q) => {
    out.push(`### ${q.id} — ${q.question}${q.humanConfirm ? ' _(confirm with human)_' : ''}`);
    out.push(`**Why it matters:** ${q.why}`);
    out.push('');
    out.push(`**Answer:** ${q.answer}`);
    out.push('');
    out.push(`**Frozen (${q.tickets.join(', ')}):**`);
    out.push(list(q.frozen));
    out.push('');
  });
  out.push('## DECISION PATCHES');
  Object.entries(DECISION_PATCHES).forEach(([id, ps]) => { out.push(`- **${id}**`); out.push(list(ps, '  - ')); });
  out.push('');
  out.push('## TICKET PATCHES (+ add, ~ replace)');
  Object.entries(AMENDMENTS).forEach(([id, ps]) => { out.push(`- **${id}**`); out.push(list(ps, '  - ')); });
  out.push('');
  out.push('## NEW v2 INTERFACES (reference: src/sim/redteam.ts in the plan site)');
  out.push('```ts');
  out.push(`export function firstLoopMergeGate(course: CourseId, layout: TrackLayout): QualifyingGate; // corridor |z| ≤ 443
export function nearestFreeLane(z: number, taken: ReadonlySet<number>): number;
export const ALIGN_MAX_TICKS = 150;           // aligned: |z − gate.z| ≤ 6 && |vz| ≤ 30
export const PACE_MIN = 0.94, PACE_MAX = 1.06;
export const releaseVx = (pace: number) => 700 * clamp(pace, PACE_MIN, PACE_MAX);
export function catchUpBound(o: { gapTicks; paceMin; paceMax; rideDistance; diameter; margin }): { closing; budget; ok; loopMinOk };
export interface RaceTiming { runUpSeconds: number; raceSeconds: number; holdSeconds: number }
export const CAGE_BARS = 10;
export function cageBarAlpha(rollRate: number, frameDt: number, bars?: number): { ratio; barAlpha; blurAlpha };
export function twoBoneIK(shoulder: P, target: P, l1: number, l2: number, bend: 1 | -1): { elbow; hand; upperDeg; foreDeg; clamped };
export function radarBlips(player, others, range = 900): { id; sx; sy; dist01; closing }[];
export function cockpitLight(caveBlend: number, fogRGB: [number, number, number]): { brightness; tintRGB; tintAlpha };
export function cockpitJolt(prev: number, impulse: number, dt: number, reduced: boolean): number; // ≤ 10 px, decay 12/s
export function analogTargetZ(pathZ: number, halfWidth: number, axis: number): number; // EDGE_HOP_MS = 150
export function validateAgainstCourse(net: LaneNetwork, layout: TrackLayout): LaneWarning[]; // loop_uncovered | gate_uncovered | obstacle_straddle
export function eyeLevelAudit(track, props, fp): { thinBillboards; terrainEdgeExposures; decalsNearEye };`);
  out.push('```');
  out.push('');
  out.push('## NEW RETRIEVAL REQUESTS');
  NEW_RETRIEVAL.forEach((r) => out.push(`- **${r.id}** ${r.ask} _(${r.why})_`));
  out.push('');
  out.push('## NEW QUESTIONS FOR THE HUMAN');
  NEW_QUESTIONS.forEach((q) => out.push(`- **${q.id}** ${q.question} — _default:_ ${q.defaultAnswer}`));
  out.push('');
  out.push('## NEW BACKLOG');
  out.push(list(NEW_BACKLOG));
  out.push('');
  return out.join('\n');
}
