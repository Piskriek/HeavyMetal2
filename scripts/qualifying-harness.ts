/**
 * T04 — the qualifying harness: plays real heats and prints the table.
 *
 * This is the same code path the tests and (later) the staging screen use, so the printed report is
 * evidence rather than a mock-up: real attempts, real gate crossings, real fallbacks, on the same
 * physics the race runs.
 *
 *   node --import tsx scripts/qualifying-harness.ts              # 4, 20 and 100-racer heats
 *   node --import tsx scripts/qualifying-harness.ts --seed 99    # a different heat
 *   node --import tsx scripts/qualifying-harness.ts --course boomtown --mystery
 *   node --import tsx scripts/qualifying-harness.ts --repeat     # rerun each heat and compare fingerprints
 */
import { createTrackLayout } from '../src/game/track-layout';
import { COURSES, type CourseId } from '../src/game/types';
import { normalizeRaceConfig } from '../src/game/contracts/config';
import { rankingTable, runQualifyingHeat } from '../src/game/qualifying/harness';
import { legacyParticipants, syntheticField } from '../src/game/qualifying/field';
import { speedToDisplay } from '../src/game/qualifying/gate';

interface Cli {
  readonly seed: number;
  readonly course: CourseId;
  readonly mystery: boolean;
  readonly repeat: boolean;
  readonly sizes: number[];
}

function parseArgs(argv: readonly string[]): Cli {
  let seed = 7;
  let course: CourseId = 'ridge';
  let mystery = false;
  let repeat = false;
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === '--seed') seed = Number(argv[++index]) | 0;
    else if (arg === '--course' && COURSES.some((entry) => entry.id === argv[index + 1])) course = argv[++index] as CourseId;
    else if (arg === '--mystery') mystery = true;
    else if (arg === '--repeat') repeat = true;
    else if (arg.startsWith('--')) console.log(`ignoring unknown flag ${arg}`);
  }
  return { seed, course, mystery, repeat, sizes: [4, 20, 100] };
}

const pad = (value: string | number, width: number, right = false) => {
  const text = String(value);
  return right ? text.padStart(width) : text.padEnd(width);
};

function reportHeat(label: string, cli: Cli, size: number): string {
  const config = normalizeRaceConfig({
    version: 1,
    fieldSize: size,
    course: cli.course,
    seed: cli.seed,
    participants: size <= 4 ? legacyParticipants() : syntheticField(size, cli.seed),
    qualifying: { retries: 2, deadlineSeconds: 20 },
    customPhysics: false,
  }).config;
  const started = Date.now();
  const heat = runQualifyingHeat({ config, humanControl: 'auto', mystery: cli.mystery });
  const elapsedMs = Date.now() - started;
  const layout = createTrackLayout(cli.course);
  const gate = heat.session.gate;
  const lines: string[] = [];
  lines.push(`${label} · ${cli.course} · seed ${cli.seed} · ${size} participants${cli.mystery ? ' · mystery routes on' : ''}`);
  lines.push(`  gate ${gate.id} at x=${gate.x.toFixed(0)} (race metre ${gate.distance.toFixed(0)}), lane ${gate.loopLane}, segment ${gate.segment}, tolerance ±${gate.altitudeTolerance}`);
  lines.push(`  loop anchor x=${gate.loop.x}, ring radius ${gate.ringRadius.toFixed(1)}, obstacles in layout ${layout.length}`);
  lines.push(`  heat finished in ${heat.seconds.toFixed(2)}s of simulated time (${heat.ticks} ticks at 120 Hz), ${elapsedMs} ms wall, ${heat.report.reduce((sum, entry) => sum + entry.attempts.length, 0)} real attempts`);
  lines.push(`  ${heat.counts.valid} valid · ${heat.counts.fallback} fallback · repairs: ${heat.repairs.length ? heat.repairs.join('; ') : 'none'}`);
  if (cli.mystery) {
    const routes = heat.report.map((entry) => entry.mystery).filter((route) => route !== null);
    const byEffect = routes.reduce<Record<string, number>>((tally, route) => { tally[route!.effect] = (tally[route!.effect] ?? 0) + 1; return tally; }, {});
    lines.push(`  mystery: ${routes.length} routes rolled for ${heat.report.length} participants · ${Object.entries(byEffect).map(([effect, count]) => `${effect}×${count}`).join(' ')}`);
  }
  lines.push('  speeds are the HUD unit (engine units/s × 0.16); times are seconds from the launch, to 1/120 s');
  lines.push('  rank  racer  status         attempt  time      gate v   peak v   adv  reward');
  for (const entry of heat.ranked.slice(0, size <= 20 ? size : 10)) {
    lines.push(`  ${pad(entry.rank, 4, true)}  ${pad(entry.racerId, 5, true)}  ${pad(entry.status === 'valid' ? 'valid' : `fallback:${entry.fallback}`, 14)}  ${pad(entry.attempt, 7, true)}  ${pad(entry.time === null ? '-' : `${entry.time.toFixed(3)}s`, 9)}  ${pad(speedToDisplay(entry.speed).toFixed(1), 7, true)}  ${pad(speedToDisplay(entry.peakSpeed).toFixed(1), 8, true)}  ${entry.advanced ? 'yes' : 'no '}  ${entry.rewardRolled ? 'yes' : 'no'}`);
  }
  if (size > 20) lines.push(`  … ${size - 10} more rows (ranking is complete: ${heat.ranked.length} entries)`);
  lines.push(`  fingerprint ${heat.fingerprint}  table sha ${rankingTable(heat.ranked).length} chars`);
  if (cli.repeat) {
    const again = runQualifyingHeat({ config, humanControl: 'auto', mystery: cli.mystery });
    const same = again.fingerprint === heat.fingerprint && rankingTable(again.ranked) === rankingTable(heat.ranked);
    lines.push(`  replay: ${same ? 'IDENTICAL — same seed, same table' : 'DIVERGED — this is a bug'}`);
    if (!same) process.exitCode = 1;
  }
  return lines.join('\n');
}

function main(): void {
  const cli = parseArgs(process.argv.slice(2));
  for (const size of cli.sizes) console.log(`${reportHeat(`QUALIFYING HEAT`, cli, size)}\n`);
}

main();
