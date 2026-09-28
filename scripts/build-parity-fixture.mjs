/**
 * Generates `tests/fixtures/legacy-engine-sim.ts` — a verbatim copy of the simulation half of
 * `src/game/engine.ts` at a chosen revision, used by `tests/physics-parity.test.ts` to prove that
 * the extraction into `src/game/sim/*` (T04) preserved behaviour bit for bit.
 *
 * Why a generator instead of a hand-copied fixture: the whole point of the fixture is that nobody
 * retyped the legacy code. Only three mechanical transforms are applied:
 *
 *  1. declaration modifiers (`private`, `readonly`) are stripped from the first token of each
 *     copied member, so the test and its adapter can reach it;
 *  2. `systemReducedMotion`'s initializer (`window.matchMedia(...)`) becomes a plain `false`
 *     field, because a Node test process has no matchMedia;
 *  3. the browser-bound members are not copied at all — the constructor, the canvas/renderer/audio
 *     objects, and everything that only exists to drive a frame loop or a pointer. The fixture
 *     supplies stubs with the same shape instead, so the copied bodies stay untouched.
 *
 * Every copied member *body* is byte-identical to the source revision. If the shipped fixture and
 * `src/game/sim/*` agree tick for tick, the port is faithful.
 *
 * Usage:
 *   node scripts/build-parity-fixture.mjs [rev]            write (default rev f9ca189)
 *   node scripts/build-parity-fixture.mjs [rev] --check     fail if the committed fixture is stale
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const cwd = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2);
const check = args.includes('--check');
const rev = args.find((arg) => !arg.startsWith('--')) ?? 'f9ca189';
const outPath = new URL('../tests/fixtures/legacy-engine-sim.ts', import.meta.url);

/** Members copied verbatim: everything the simulation touches, and only that. */
const KEEP = [
  // state the step reads or writes
  'frameId', 'lastFrame', 'lastRender', 'lastNotify', 'accumulator', 'needsRender', 'visible', 'destroyed',
  'controlsEnabled', 'reducedMotion', 'time', 'runTime', 'camera', 'cameraY', 'pointerDrift', 'drift', 'shake',
  'isDragging', 'grabOffset', 'topSpeed', 'noticeUntil', 'counts', 'racers', 'renderRacers', 'collisionTimes',
  'obstacles', 'pickups', 'pickupBuckets', 'pickupCount', 'shieldBlocks', 'pickupCandidates', 'buckets',
  'particles', 'airSheep', 'trail', 'trailSample', 'snapshot', 'lastSnapshot', 'standingsKey', 'pausedForBuild',
  // queries and actions
  'player', 'y', 'slope', 'customPhysics', 'status', 'getTrackY', 'trackObstacles', 'setTrackObstacles',
  'requestRender', 'setOptions', 'reset', 'teleport', 'launch', 'changeLane', 'setLane', 'adjustAim',
  'canHop', 'jump', 'performHop', 'bounce', 'performBounce', 'boost', 'performBoost', 'togglePause',
  'makeTrack', 'nearby', 'inGap', 'surfaceAt',
  // the tick, and everything it feeds
  'stepRace', 'driveCPU', 'stepRacer', 'recover', 'resolveBumps', 'shove', 'absorbShield',
  'resolvePickups', 'collectPickup', 'hitObstacle', 'refreshSnapshot', 'standings', 'finish',
  'say', 'emit', 'updateParticles', 'notify', 'invalidate',
];

/** Members deliberately left out: browser plumbing the fixture must not carry. */
const DROP = [
  'constructor', 'canvas', 'renderer', 'audio', 'assets', 'systemReducedMotion', 'inputEnabled', 'view',
  'trackRenderer', 'trackBuilder', 'isBuildPaused', 'setBuildPaused', 'resize', 'setVisible', 'visibilityChanged',
  'frame', 'schedule', 'coordinates', 'pointerDown', 'pointerMove', 'pointerUp', 'pointerCancel', 'pointerLeave',
  'destroy',
];

const CLASS_OPEN = 'export class GameEngine {';
const KEEP_SET = new Set(KEEP);

function extract(src, revision) {
  const lines = src.split('\n');
  const start = lines.findIndex((line) => line.trim() === CLASS_OPEN);
  if (start === -1) throw new Error(`class opening not found in ${revision}:src/game/engine.ts`);
  const depthOf = (line) => {
    let delta = 0;
    for (const ch of line) {
      if (ch === '{' || ch === '(' || ch === '[') delta++;
      else if (ch === '}' || ch === ')' || ch === ']') delta--;
    }
    return delta;
  };
  const closesMember = (text) => text.endsWith(';') || text.endsWith('}');

  const found = new Map();
  const seen = new Set();
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i];
    if (line === '}') break; // end of the class
    const head = /^  (?:private |protected |public |static |readonly |abstract )*(?:get |set )?([A-Za-z_$][\w$]*)/.exec(line);
    if (!head) continue;
    const name = head[1];
    seen.add(name);
    let depth = depthOf(line);
    const body = [line];
    if (depth > 0 || !closesMember(line.trim())) {
      while (i + 1 < lines.length && !(depth === 0 && closesMember(body[body.length - 1].trim()))) {
        i++;
        body.push(lines[i]);
        depth += depthOf(lines[i]);
        if (depth < 0) break;
      }
    }
    if (!KEEP_SET.has(name)) continue;
    found.set(name, body.join('\n'));
  }
  const missing = KEEP.filter((name) => !found.has(name));
  if (missing.length) throw new Error(`members not found in ${revision}: ${missing.join(', ')}`);
  const unknown = [...seen].filter((name) => !KEEP_SET.has(name) && !DROP.includes(name));
  if (unknown.length) throw new Error(`unclassified members in ${revision}: ${unknown.join(', ')} — update KEEP/DROP`);
  return found;
}

/** Transform 1: drop declaration modifiers so tests and the adapter can reach the member. */
function demodify(text) {
  const first = text.split('\n')[0];
  const stripped = first.replace(/^(  )(?:private |protected |public |static |readonly |abstract )+(?=(?:get |set )?[A-Za-z_$])/, '$1');
  return stripped === first ? text : stripped + text.slice(first.length);
}

const header = `/**
 * GENERATED FILE — do not edit by hand.
 *
 * Produced by \`node scripts/build-parity-fixture.mjs ${rev}\` from
 * \`src/game/engine.ts\` at \`${rev}\`. It is the **pre-refactor** simulation half of the engine: every
 * copied member body is byte-identical to that revision, with only the three mechanical transforms
 * described in the generator's header. \`tests/physics-parity.test.ts\` drives this class and
 * \`src/game/sim/*\` through the same tick loop and asserts the two agree on every physics field,
 * every snapshot field and every mutable obstacle/pickup — which is the evidence that lifting
 * \`stepRacer\`, \`driveCPU\`, \`hitObstacle\`, \`recover\` and \`resolvePickups\` into the shared sim
 * changed no behaviour.
 *
 * If the engine's simulation changes, this file is *supposed* to keep describing the old one:
 * regenerate it deliberately, never edit it casually.
 */

import { createRacers, raceOrder, type Racer } from '../../src/game/racers';
import {
  AIM_ANCHOR, FINISH, GROUND, GRAVITY, HEIGHT, LANE, LANE_COUNT, PLAYER_LANE,
  RADIUS, STADIUM_START, START_X, START_Y, TRACK_DISTANCE, closestLane, courseY, courseSlope,
  laneZ, launchVelocity, loopGeometry, obstacleZ, occupiesLane, rampSurface, sectorAt, weightImpulse,
  type AirSheep, type Obstacle, type Particle, type RacerFrame,
} from '../../src/game/scene';
import { INITIAL_SNAPSHOT, type GameOptions, type GameSnapshot, type GameStatus, type RacerStanding, type RunRecord } from '../../src/game/types';
import type { RaceConfig } from '../../src/game/session';
import { createTrackLayout } from '../../src/game/track-layout';
import { POWERUPS, SHIELD_DURATION, createAirPickups, hopTiming, pickupIntercept, pickupY, type AirPickup } from '../../src/game/powerups';

const TAU = Math.PI * 2;
const STEP = 1 / 120;
const BUCKET = 512;
const EMPTY: Obstacle[] = [];
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
const randomAt = (id: number, time: number) => { const value = Math.sin(id * 91.37 + Math.floor(time * 3) * 17.23) * 13791.73; return value - Math.floor(value); };

// --- browser replacements ---------------------------------------------------
// The fixture imports in a plain Node process, so the objects the engine talked to are replaced by
// recorders. They are observable, so the parity test can compare what the game *did* as well as
// where the racers ended up; none of them reach for document, window, a canvas or an AudioContext.
export interface SimCanvas {
  style: { cursor?: string };
  addEventListener(): void;
  removeEventListener(): void;
}
export interface SimView {
  width: number;
  configure(width: number, camera: number, downrange: boolean, cameraY: number): void;
  unproject(): { x: number; y: number };
  followOffset(x: number): number;
}
export interface SimRenderer {
  view: SimView;
  lowDetail: boolean;
  readonly renders: number;
  resize(width: number, height: number): void;
  render(frame: unknown, interval: number): void;
  destroy(): void;
}
export interface SimAudio {
  readonly cues: string[];
  play(name: string): void;
  setEnabled(value: boolean): void;
  setVolume(value: number): void;
  unlock(): void;
  destroy(): void;
}
export function createSimCanvas(): SimCanvas {
  return { style: {}, addEventListener: () => {}, removeEventListener: () => {} };
}
export function createSimRenderer(): SimRenderer {
  let renders = 0;
  const noop = () => {};
  return {
    view: { width: 1280, configure: noop, unproject: () => ({ x: 0, y: 0 }), followOffset: (x: number) => x },
    lowDetail: false,
    get renders() { return renders; },
    resize: noop,
    render: () => { renders++; },
    destroy: noop,
  };
}
export function createSimAudio(): SimAudio {
  const cues: string[] = [];
  return {
    cues,
    play: (name: string) => { cues.push(name); },
    setEnabled: () => {},
    setVolume: () => {},
    unlock: () => {},
    destroy: () => {},
  };
}

/** Every member the generator copies verbatim; asserted by the parity test. */
export const LEGACY_ENGINE_SIM_MEMBERS = ${JSON.stringify([...KEEP].sort())} as const;

export type LegacySnapshotListener = (snapshot: GameSnapshot) => void;
export type LegacyFinishListener = (record: RunRecord) => void;

export class LegacyEngineSim {
  canvas: SimCanvas;
  options: GameOptions;
  config?: RaceConfig;
  renderer: SimRenderer;
  audio: SimAudio;
  onUpdate: LegacySnapshotListener;
  onFinish: LegacyFinishListener;
  reducedMotion = false; // was: systemReducedMotion || options.reducedMotion (no matchMedia in Node)
`;

const footer = `
  // --- hand-written constructor (the only rewritten member) ----------------
  // The original built a RangeRenderer and a GameAudio here, then attached five pointer listeners
  // and a visibilitychange listener. Construction did nothing else, so this is equivalent minus DOM.
  constructor(
    canvas: SimCanvas,
    options: GameOptions,
    onUpdate: LegacySnapshotListener,
    onFinish: LegacyFinishListener,
    config?: RaceConfig,
  ) {
    this.canvas = canvas;
    this.options = options;
    this.onUpdate = onUpdate;
    this.onFinish = onFinish;
    this.config = config;
    this.renderer = createSimRenderer();
    this.audio = createSimAudio();
    this.reset();
  }

  // \`invalidate()\` is copied verbatim and ends in \`schedule()\`, which queues a
  // requestAnimationFrame in the engine. A fixture with nothing to draw has nothing to queue.
  schedule(): void {}
}
`;

const src = execFileSync('git', ['show', `${rev}:src/game/engine.ts`], { cwd, encoding: 'utf8' });
const members = extract(src, rev);

const reducedMotionField = members.get('reducedMotion') ?? '';
if (!reducedMotionField.includes('this.systemReducedMotion || this.options.reducedMotion')) {
  throw new Error(`${rev}: the reduced-motion getter changed shape; update the generator instead of guessing`);
}
const invalidateField = members.get('invalidate') ?? '';
if (!invalidateField.includes('this.schedule()')) {
  throw new Error(`${rev}: invalidate() no longer calls schedule(); the stub may need to change`);
}

const short = execFileSync('git', ['log', '-1', '--format=%s', rev], { cwd, encoding: 'utf8' }).trim();
if (!/^\w/.test(short)) throw new Error(`unexpected subject line for ${rev}`);
if (!members.get('stepRace')?.includes('this.resolveBumps();')) throw new Error('unexpected stepRace shape; refusing to generate');
if (!members.get('resolveBumps')?.includes('const pair = i * 4 + j;')) throw new Error('resolveBumps does not look like the pre-T02 engine; refusing to generate');

const copied = KEEP.filter((name) => name !== 'reducedMotion')
  .map((name) => demodify(String(members.get(name))))
  .join('\n\n');

const output = `${header}${copied}\n${footer}`.replace(/\n{3,}/g, '\n\n');
const file = fileURLToPath(outPath);

if (check) {
  if (!existsSync(file)) {
    console.error(`FAIL: ${file} does not exist. Run: node scripts/build-parity-fixture.mjs`);
    process.exit(1);
  }
  if (readFileSync(file, 'utf8') !== output) {
    console.error(`FAIL: ${file} is not what this script generates from ${rev}.`);
    console.error('      regenerate with: node scripts/build-parity-fixture.mjs');
    process.exit(1);
  }
  console.log(`ok: ${file.replace(`${cwd}/`, '')} matches the generated output for ${rev}`);
} else {
  writeFileSync(file, output, 'utf8');
  console.log(`wrote ${file.replace(`${cwd}/`, '')} (${output.split('\n').length} lines) from ${rev} [${short}]`);
}
