/**
 * @file mechanic-mimicry.ts
 * @module @hm/harness
 * @description The Live PC Mechanic Observer & Preset Mimicry Transducer (Plan 51; the owner's and Argon's directive of
 * 27 Oct). A mechanic observed in a game running on the PC is decompiled into FIDELITY's own presets:
 *
 *   observation  ──▶  MDL spectral sieve + closed-form fits + VSA-4096 associative match  ──▶  loc: / logic: / anim: / harness:
 *
 * The observation comes from the best channel the game permits (the observer ladder: official telemetry or API, a mod
 * SDK, a permitted mod loader, the game's own files, and screen/audio only as the last resort). This module never sees
 * pixels, assets or memory: only numbers (a trajectory, shot times, a named event log). Nothing of the other game is
 * copied; its feel is re-expressed with FIDELITY's parameters.
 *
 * What is IDENTIFIED (exact for the signal kind, tested against a known preset as the oracle):
 *  - gravity and jump impulse from a least-squares parabola over each airborne arc (g = −2c, v₀ = √(2·g·h));
 *  - walk and run speed from the ground-speed distribution (two-means split);
 *  - fire cadence from shot intervals (intra-burst vs inter-burst split), and trigger→effect rules from event delays;
 *  - the dominant structural rhythm of a stream from the Rissanen MDL sieve (`runMdlSpectralSieve`).
 * What is MAPPED (documented heuristics, not physics, reported as such in `notes`): the four harness sliders (awareness
 * ceiling from structural richness, Π₀ from the structure-to-residual ratio, α from the dominant rhythm, R_syntropic from
 * air control), and any locomotion field the observation cannot show (coyote time, buffer, step-up, ceiling, landing
 * spring) is taken from the nearest shelf preset found by the VSA-4096 item memory.
 *
 * Pure and deterministic: no Date.now, no Math.random, no I/O.
 */
import { LOCOMOTION_PRESETS, type KitMotionSpec, type LocomotionPreset } from '@hm/kinematic';
import { WIREGRAPH_SHELF, validateWireGraph, type ActuatorKind, type ActuatorSpec, type LogicNodeSpec, type SensorSpec, type TriggerSensorKind, type WireGraphSpec } from '@hm/wiregraph';
import { runMdlSpectralSieve, type IMdlSieveResult } from './sieve-mdl.js';
import { createItemMemory, nearestRecord, type FeatureRange } from './vsa-item-memory.js';

/** The rung of the observer ladder an observation came from, best first; `screen` is the last resort. */
export type ObserverChannel = 'telemetry' | 'mod-sdk' | 'mod-loader' | 'game-files' | 'screen' | 'synthetic';
export const OBSERVER_LADDER: readonly ObserverChannel[] = ['telemetry', 'mod-sdk', 'mod-loader', 'game-files', 'screen'];

/** One observed mechanic signature. Times in seconds, positions in metres (the observer converts its game's units). */
export interface MechanicObservation {
  readonly game: string;
  readonly channel: ObserverChannel;
  /** The player's (or an entity's) path: same-length arrays, time increasing, y up. */
  readonly trajectory?: { readonly t: readonly number[]; readonly x: readonly number[]; readonly y: readonly number[]; readonly z: readonly number[] };
  /** Shot times, and optionally each shot's recoil kick (metres of camera or weapon travel). */
  readonly shots?: { readonly t: readonly number[]; readonly kick?: readonly number[] };
  /** A named event log ("enter-zone", "door-open", "hit", "chain-arc"...), time increasing. */
  readonly events?: readonly { readonly t: number; readonly name: string }[];
}

/** The four harness sliders of an `IHarnessCartridgeSpec` (cartlab encodes them as a `harnessc:` code). */
export interface HarnessSliders {
  readonly relativeAwarenessCeiling: number;
  readonly baselinePrecisionPi0: number;
  readonly annealRateAlpha: number;
  readonly syntropicDampingNspm: number;
}

/** A weapon's fire pattern, as identified from shot times. */
export interface FirePattern {
  readonly burst: number;
  readonly roundGapS: number;
  /** Seconds from the last round of a burst to the next burst's first (0 for full auto). */
  readonly burstGapS: number;
  readonly roundsPerSecond: number;
}

export interface MimicryResult {
  readonly game: string;
  readonly channel: ObserverChannel;
  readonly locomotion: LocomotionPreset | null;
  readonly fire: FirePattern | null;
  readonly logic: WireGraphSpec | null;
  readonly motion: KitMotionSpec | null;
  readonly harness: HarnessSliders;
  /** Fields of a dash the observation showed (no LocomotionPreset field holds it yet). */
  readonly dashImpulseMps: number | null;
  readonly nearest: { readonly locomotion: { readonly id: string; readonly similarity: number } | null; readonly logic: { readonly id: string; readonly similarity: number } | null };
  readonly sieve: { readonly structuralModeCount: number; readonly residualStd: number; readonly dominantHz: number } | null;
  readonly evidence: { readonly jumps: number; readonly groundSamples: number; readonly shots: number; readonly rules: number };
  /** 0 to 1: how much the observation supports the result (fewer samples, a lower-rung channel: less). */
  readonly confidence: number;
  /** What was identified, what was mapped, and what was inherited, in plain words. */
  readonly notes: readonly string[];
}

// ------------------------------------------------------------------ small pure helpers

const median = (xs: readonly number[]): number => {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};
const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));
const round3 = (v: number): number => Math.round(v * 1000) / 1000;

/** Least-squares parabola y = a + b·t + c·t² over the points (t relative to t0 for conditioning). */
function fitParabola(ts: readonly number[], ys: readonly number[]): { a: number; b: number; c: number; t0: number } | null {
  const n = ts.length;
  if (n < 4) return null;
  const t0 = ts[0]!;
  let s0 = 0, s1 = 0, s2 = 0, s3 = 0, s4 = 0, y0 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < n; i++) {
    const t = ts[i]! - t0, y = ys[i]!, t2 = t * t;
    s0 += 1; s1 += t; s2 += t2; s3 += t2 * t; s4 += t2 * t2;
    y0 += y; y1 += y * t; y2 += y * t2;
  }
  // solve the 3x3 normal equations by Cramer's rule
  const det = s0 * (s2 * s4 - s3 * s3) - s1 * (s1 * s4 - s2 * s3) + s2 * (s1 * s3 - s2 * s2);
  if (Math.abs(det) < 1e-12) return null;
  const a = (y0 * (s2 * s4 - s3 * s3) - s1 * (y1 * s4 - y2 * s3) + s2 * (y1 * s3 - y2 * s2)) / det;
  const b = (s0 * (y1 * s4 - y2 * s3) - y0 * (s1 * s4 - s2 * s3) + s2 * (s1 * y2 - s2 * y1)) / det;
  const c = (s0 * (s2 * y2 - s3 * y1) - s1 * (s1 * y2 - s2 * y1) + y0 * (s1 * s3 - s2 * s2)) / det;
  return { a, b, c, t0 };
}

/** Splits values into a low and a high cluster at the widest ratio gap (two-means on the log scale, deterministic). */
function splitTwo(values: readonly number[], minRatio: number): { low: number[]; high: number[] } | null {
  const s = [...values].filter((v) => v > 0).sort((a, b) => a - b);
  if (s.length < 4) return null;
  let bestI = -1, bestRatio = minRatio;
  for (let i = 1; i < s.length; i++) {
    const r = s[i]! / s[i - 1]!;
    if (r > bestRatio && i >= 2 && s.length - i >= 2) { bestRatio = r; bestI = i; }
  }
  return bestI < 0 ? null : { low: s.slice(0, bestI), high: s.slice(bestI) };
}

/** Resamples (t, v) onto a uniform grid of a power-of-two length (at most 256), for the spectral sieve. */
function resample(ts: readonly number[], vs: readonly number[]): { stream: Float32Array; windowSec: number } | null {
  const n = ts.length;
  if (n < 16) return null;
  const N = Math.min(256, 1 << Math.floor(Math.log2(n)));
  const t0 = ts[0]!, t1 = ts[n - 1]!;
  const span = t1 - t0;
  if (!(span > 0)) return null;
  const stream = new Float32Array(N);
  let j = 0;
  let mean = 0;
  for (let i = 0; i < N; i++) {
    const t = t0 + (span * i) / N;
    while (j < n - 2 && ts[j + 1]! < t) j++;
    const u = (t - ts[j]!) / Math.max(1e-9, ts[j + 1]! - ts[j]!);
    stream[i] = vs[j]! + (vs[j + 1]! - vs[j]!) * clamp(u, 0, 1);
    mean += stream[i]!;
  }
  mean /= N;
  for (let i = 0; i < N; i++) stream[i] = stream[i]! - mean;
  return { stream, windowSec: span };
}

// ------------------------------------------------------------------ the associative shelves (VSA-4096 item memories)

const LOC_RANGES: readonly FeatureRange[] = [
  { min: 0, max: 10 }, // walk
  { min: 0, max: 16 }, // run
  { min: 0, max: 12 }, // jump impulse
  { min: 0, max: 30 }, // gravity
  { min: 0, max: 1 }, // air control
];
const locMemory = createItemMemory(LOC_RANGES);
const locFeatures = (p: Pick<LocomotionPreset, 'walkSpeedMps' | 'runSpeedMps' | 'jumpImpulseMps' | 'gravityMps2' | 'airControl'>): number[] =>
  [p.walkSpeedMps, p.runSpeedMps, p.jumpImpulseMps, p.gravityMps2, p.airControl];
const LOC_SHELF = Object.values(LOCOMOTION_PRESETS).map((p) => ({ id: String(p.id), preset: p, hv: locMemory.encode(locFeatures(p)) }));

const NODE_KINDS = ['and', 'or', 'not', 'delay', 'latch', 'counter', 'threshold'] as const;
const LOGIC_RANGES: readonly FeatureRange[] = [...NODE_KINDS.map(() => ({ min: 0, max: 6 })), { min: 0, max: 6 }, { min: 0, max: 6 }];
const logicMemory = createItemMemory(LOGIC_RANGES);
const logicFeatures = (g: WireGraphSpec): number[] => [
  ...NODE_KINDS.map((k) => g.nodes.filter((n) => n.kind === k).length),
  g.sensors.length,
  g.actuators.length,
];
const LOGIC_SHELF = Object.values(WIREGRAPH_SHELF).map((g) => ({ id: g.id, hv: logicMemory.encode(logicFeatures(g)) }));

// ------------------------------------------------------------------ the three decompilers

interface LocomotionReading {
  readonly gravity: number | null;
  readonly jumpImpulse: number | null;
  readonly walk: number | null;
  readonly run: number | null;
  readonly airControl: number | null;
  readonly dash: number | null;
  readonly jumps: number;
  readonly groundSamples: number;
}

/** Ground speed, airborne arcs and dashes from a trajectory. */
function readLocomotion(tr: NonNullable<MechanicObservation['trajectory']>, notes: string[]): LocomotionReading {
  const n = Math.min(tr.t.length, tr.x.length, tr.y.length, tr.z.length);
  const empty: LocomotionReading = { gravity: null, jumpImpulse: null, walk: null, run: null, airControl: null, dash: null, jumps: 0, groundSamples: 0 };
  if (n < 8) {
    notes.push('trajectory too short to read (fewer than 8 samples)');
    return empty;
  }
  // the ground: the floor of the window (a flat stretch is assumed; the observer sends a level ground or a height-relative y)
  const floor = [...tr.y.slice(0, n)].sort((a, b) => a - b)[Math.floor(n * 0.05)]!;
  const EPS = 0.04;
  const airborne = (i: number): boolean => tr.y[i]! - floor > EPS;

  // arcs: each contiguous airborne run with ground on both sides
  const gs: number[] = [], vs: number[] = [];
  let i = 0;
  while (i < n) {
    if (!airborne(i)) { i++; continue; }
    const start = i;
    while (i < n && airborne(i)) i++;
    const end = i - 1;
    if (start === 0 || i >= n || end - start < 4) continue;
    const fit = fitParabola(tr.t.slice(start, end + 1), tr.y.slice(start, end + 1));
    if (!fit || fit.c >= 0) continue;
    const g = -2 * fit.c;
    const apexY = fit.a - (fit.b * fit.b) / (4 * fit.c);
    const h = apexY - floor;
    if (h > 0.05) { gs.push(g); vs.push(Math.sqrt(2 * g * h)); }
  }

  // ground speeds and the in-air steering authority
  const groundSpeeds: number[] = [], groundAcc: number[] = [], airAcc: number[] = [];
  let prevV: { vx: number; vz: number; t: number } | null = null;
  for (let k = 1; k < n; k++) {
    const dt = tr.t[k]! - tr.t[k - 1]!;
    if (!(dt > 0)) continue;
    const vx = (tr.x[k]! - tr.x[k - 1]!) / dt, vz = (tr.z[k]! - tr.z[k - 1]!) / dt;
    const air = airborne(k) && airborne(k - 1);
    if (!air) groundSpeeds.push(Math.hypot(vx, vz));
    if (prevV) {
      const a = Math.hypot(vx - prevV.vx, vz - prevV.vz) / Math.max(1e-6, tr.t[k]! - prevV.t);
      if (a > 0.05) (air ? airAcc : groundAcc).push(a);
    }
    prevV = { vx, vz, t: tr.t[k]! };
  }
  const moving = groundSpeeds.filter((s) => s > 0.3);
  const split = splitTwo(moving, 1.3);
  let walk: number | null = null, run: number | null = null;
  if (split) { walk = median(split.low); run = median(split.high); }
  else if (moving.length >= 4) { walk = median(moving); notes.push('one ground speed seen: run speed inherited'); }
  // a dash: a short spike well above the run speed
  const top = run ?? walk;
  const dashes = top ? moving.filter((s) => s > top * 1.6) : [];
  const dash = dashes.length > 0 ? median(dashes) - (top ?? 0) : null;
  const airControl = airAcc.length >= 3 && groundAcc.length >= 3 ? clamp(median(airAcc) / median(groundAcc), 0, 1) : null;

  if (gs.length > 0) notes.push(`identified gravity and jump impulse from ${gs.length} airborne arc${gs.length === 1 ? '' : 's'} (least-squares parabola)`);
  else notes.push('no complete jump arc seen: gravity and jump impulse inherited');
  return {
    gravity: gs.length ? median(gs) : null,
    jumpImpulse: vs.length ? median(vs) : null,
    walk, run, airControl, dash,
    jumps: gs.length,
    groundSamples: groundSpeeds.length,
  };
}

/** Burst structure from shot times. */
function readFire(shots: NonNullable<MechanicObservation['shots']>): FirePattern | null {
  const t = [...shots.t].filter(Number.isFinite).sort((a, b) => a - b);
  if (t.length < 3) return null;
  const gaps: number[] = [];
  for (let i = 1; i < t.length; i++) gaps.push(t[i]! - t[i - 1]!);
  const split = splitTwo(gaps, 1.8);
  if (!split) {
    const g = median(gaps);
    return { burst: 1, roundGapS: g, burstGapS: 0, roundsPerSecond: 1 / g };
  }
  const roundGap = median(split.low);
  const burstGap = median(split.high);
  // rounds per burst: runs of short gaps, plus one
  const runs: number[] = [];
  let run = 1;
  for (const g of gaps) {
    if (g < (roundGap + burstGap) / 2) run++;
    else { runs.push(run); run = 1; }
  }
  runs.push(run);
  const burst = Math.max(1, Math.round(median(runs)));
  return { burst, roundGapS: roundGap, burstGapS: burstGap, roundsPerSecond: burst / ((burst - 1) * roundGap + burstGap) };
}

/** The logic graph a fire pattern means: a trigger, one delay per round of the burst, a fire actuator each. */
function fireGraph(game: string, f: FirePattern): WireGraphSpec {
  const sensors: SensorSpec[] = [{ id: 'trigger', kind: 'cardinal-threshold', threshold: 1, target: 'trigger' }];
  const nodes: LogicNodeSpec[] = [];
  const actuators: ActuatorSpec[] = [];
  if (f.burst <= 1) {
    // full auto: the trigger held latches the weapon, which fires at its rate (the actuator's value, rounds per minute)
    nodes.push({ id: 'held', kind: 'latch', inputs: ['trigger'], resetInput: 'trigger' });
    actuators.push({ id: 'fire', kind: 'fire-turret', input: 'held', target: 'weapon', value: Math.round(f.roundsPerSecond * 60) });
  } else {
    for (let k = 0; k < f.burst; k++) {
      nodes.push({ id: `round-${k}`, kind: 'delay', inputs: ['trigger'], delayMs: Math.round(k * f.roundGapS * 1000) });
      actuators.push({ id: `fire-${k}`, kind: 'fire-turret', input: `round-${k}`, target: 'weapon', value: 1 });
    }
  }
  return { id: `mimic-fire-${slug(game)}`, name: `${game} fire pattern`, sensors, nodes, actuators };
}

const slug = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32) || 'game';

const SENSOR_WORDS: readonly (readonly [RegExp, TriggerSensorKind])[] = [
  [/near|enter|approach|proximity|zone/, 'proximity'],
  [/leak|rift/, 'leak-active'],
  [/stage|level-up|tier/, 'stage-reached'],
  [/brownout|power-low|power/, 'power-brownout'],
  [/hopper|empty|low-ammo/, 'hopper-low'],
];
const ACTUATOR_WORDS: readonly (readonly [RegExp, ActuatorKind])[] = [
  [/door|open/, 'open-door'],
  [/fire|shot|shoot|arc|chain|proc|zap/, 'fire-turret'],
  [/lamp|light|glow/, 'set-lamp-lx'],
  [/sound|sfx|beep|chime|alarm/, 'play-sound'],
  [/spawn|summon/, 'spawn-monster'],
  [/gate|dial|portal/, 'dial-gate'],
  [/iris|lock/, 'lock-iris'],
  [/track|aim/, 'turret-track'],
];
const kindOf = <K>(name: string, table: readonly (readonly [RegExp, K])[], fallback: K): K => table.find(([re]) => re.test(name.toLowerCase()))?.[1] ?? fallback;

/** Trigger → effect rules from an event log: a steady delay makes a delay node, an every-N-th effect a counter. */
function readRules(game: string, events: NonNullable<MechanicObservation['events']>, notes: string[]): WireGraphSpec | null {
  const byName = new Map<string, number[]>();
  for (const e of events) if (typeof e.name === 'string' && Number.isFinite(e.t)) (byName.get(e.name) ?? byName.set(e.name, []).get(e.name)!).push(e.t);
  for (const ts of byName.values()) ts.sort((a, b) => a - b);
  const sensors: SensorSpec[] = [];
  const nodes: LogicNodeSpec[] = [];
  const actuators: ActuatorSpec[] = [];
  const names = [...byName.keys()].sort();
  for (const a of names) {
    for (const b of names) {
      if (a === b) continue;
      const ta = byName.get(a)!, tb = byName.get(b)!;
      if (ta.length < 3 || tb.length < 2) continue;
      // each effect's latest preceding cause, within 5 s
      const delays: number[] = [];
      for (const t of tb) {
        let prev = -Infinity;
        for (const s of ta) if (s <= t) prev = s;
        if (t - prev <= 5) delays.push(t - prev);
      }
      if (delays.length < 2 || delays.length < tb.length * 0.8) continue;
      const m = median(delays);
      const spread = median(delays.map((d) => Math.abs(d - m)));
      if (spread > Math.max(0.03, m * 0.25)) continue;
      const every = Math.round(ta.length / tb.length);
      const sensorId = `on-${slug(a)}`;
      if (!sensors.some((s) => s.id === sensorId)) sensors.push({ id: sensorId, kind: kindOf(a, SENSOR_WORDS, 'cardinal-threshold'), threshold: 1, target: a });
      let input = sensorId;
      if (every >= 2) {
        nodes.push({ id: `${slug(a)}-every-${every}`, kind: 'counter', inputs: [input], counterTarget: every });
        input = `${slug(a)}-every-${every}`;
      }
      if (m > 0.02) {
        nodes.push({ id: `${slug(a)}-to-${slug(b)}`, kind: 'delay', inputs: [input], delayMs: Math.round(m * 1000) });
        input = `${slug(a)}-to-${slug(b)}`;
      }
      actuators.push({ id: `do-${slug(b)}`, kind: kindOf(b, ACTUATOR_WORDS, 'toggle-machine'), input, target: b });
      notes.push(`rule: "${a}" → "${b}" after ${Math.round(m * 1000)} ms${every >= 2 ? `, every ${every}th` : ''} (${delays.length} pairs)`);
    }
  }
  if (actuators.length === 0) return null;
  return { id: `mimic-rules-${slug(game)}`, name: `${game} rules`, sensors, nodes, actuators };
}

// ------------------------------------------------------------------ the transducer

const CHANNEL_WEIGHT: Readonly<Record<ObserverChannel, number>> = { telemetry: 1, 'mod-sdk': 0.95, 'mod-loader': 0.9, 'game-files': 0.85, screen: 0.6, synthetic: 1 };

/** Decompiles one observed mechanic into FIDELITY presets. */
export function transduceMechanic(obs: MechanicObservation): MimicryResult {
  const notes: string[] = [];
  if (obs.channel === 'screen') notes.push('observed through the screen (the last-resort rung): positions carry tracking error');

  // 1. locomotion: identified fields, then the nearest shelf preset (VSA-4096 item memory) for what the observation cannot show
  let locomotion: LocomotionPreset | null = null;
  let nearestLoc: { id: string; similarity: number } | null = null;
  let reading: LocomotionReading | null = null;
  let sieve: MimicryResult['sieve'] = null;
  let sieveRaw: IMdlSieveResult | null = null;
  let structuralRms = 0;
  if (obs.trajectory) {
    reading = readLocomotion(obs.trajectory, notes);
    const seen = reading;
    // the match marginalizes what was not observed: each shelf preset is compared with the observation completed by its
    // own values, so an unseen field (often air control) neither helps nor hurts any candidate
    let near: { record: (typeof LOC_SHELF)[number]; similarity: number } | null = null;
    for (const item of LOC_SHELF) {
      const p = item.preset;
      const probe = {
        walkSpeedMps: seen.walk ?? p.walkSpeedMps, runSpeedMps: seen.run ?? p.runSpeedMps, jumpImpulseMps: seen.jumpImpulse ?? p.jumpImpulseMps,
        gravityMps2: seen.gravity ?? p.gravityMps2, airControl: seen.airControl ?? p.airControl,
      };
      const s = nearestRecord(locMemory.encode(locFeatures(probe)), [item])!.similarity;
      if (!near || s > near.similarity) near = { record: item, similarity: s };
    }
    near = near!;
    nearestLoc = { id: near.record.id, similarity: round3(near.similarity) };
    const base = near.record.preset;
    locomotion = {
      ...base,
      id: `mimic:${slug(obs.game)}`,
      name: `${obs.game} (mimic)`,
      walkSpeedMps: round3(reading.walk ?? base.walkSpeedMps),
      runSpeedMps: round3(reading.run ?? (reading.walk ? reading.walk * (base.runSpeedMps / base.walkSpeedMps) : base.runSpeedMps)),
      jumpImpulseMps: round3(reading.jumpImpulse ?? base.jumpImpulseMps),
      gravityMps2: round3(reading.gravity ?? base.gravityMps2),
      airControl: round3(reading.airControl ?? base.airControl),
    };
    notes.push(`nearest shelf locomotion: ${near.record.id} (VSA similarity ${nearestLoc.similarity}); coyote, buffer, step-up, ceiling and landing spring inherited from it`);
    if (reading.airControl === null) notes.push('air control inherited (too few in-air direction changes seen)');
    // the spectral sieve over height: the dominant structural rhythm (gait bob or jump cadence) and the residual noise
    const rs = resample(obs.trajectory.t, obs.trajectory.y);
    if (rs) {
      const out = new Float32Array(rs.stream.length), res = new Float32Array(rs.stream.length);
      sieveRaw = runMdlSpectralSieve(rs.stream, out, res);
      let rms = 0;
      for (const v of out) rms += v * v;
      structuralRms = Math.sqrt(rms / out.length);
      const strongest = sieveRaw.modes.filter((m) => m.structural).sort((a, b) => b.energy - a.energy)[0];
      sieve = { structuralModeCount: sieveRaw.structuralModeCount, residualStd: round3(sieveRaw.residualStd), dominantHz: strongest ? round3(strongest.k / rs.windowSec) : 0 };
    }
  }

  // 2. fire pattern → logic graph + a recoil motion; or trigger → effect rules
  const fire = obs.shots ? readFire(obs.shots) : null;
  let logic: WireGraphSpec | null = null;
  let motion: KitMotionSpec | null = null;
  if (fire) {
    logic = fireGraph(obs.game, fire);
    const kicks = (obs.shots?.kick ?? []).filter((k) => Number.isFinite(k) && k > 0);
    motion = { kind: 'reciprocate', axis: 'z', rateHz: round3(1 / fire.roundGapS), amplitude: round3(kicks.length ? median(kicks) : 0.02), phaseRad: 0 };
    notes.push(`fire: ${fire.burst > 1 ? `${fire.burst}-round bursts, ${Math.round(fire.roundGapS * 1000)} ms apart, ${Math.round(fire.burstGapS * 1000)} ms between bursts` : `full auto, ${Math.round(fire.roundsPerSecond * 60)} rounds per minute`}`);
    if (!kicks.length) notes.push('no recoil kick observed: the recoil motion uses a 2 cm default');
  }
  if (obs.events && obs.events.length > 0) {
    const rules = readRules(obs.game, obs.events, notes);
    if (rules) logic = logic ? { ...logic, id: `mimic-${slug(obs.game)}`, name: `${obs.game} mechanics`, sensors: [...logic.sensors, ...rules.sensors], nodes: [...logic.nodes, ...rules.nodes], actuators: [...logic.actuators, ...rules.actuators] } : rules;
  }
  if (!motion && sieve && sieve.dominantHz > 0 && sieveRaw) {
    // no weapon: the strongest rhythm of the body's height becomes an oscillation (a gait bob, or a hover)
    const strongest = sieveRaw.modes.filter((m) => m.structural).sort((a, b) => b.energy - a.energy)[0]!;
    const n = obs.trajectory ? Math.min(256, 1 << Math.floor(Math.log2(obs.trajectory.t.length))) : 1;
    motion = { kind: 'oscillate', axis: 'y', rateHz: sieve.dominantHz, amplitude: round3((2 * Math.hypot(strongest.re, strongest.im)) / n), phaseRad: round3(Math.atan2(-strongest.im, strongest.re)) };
  }
  let nearestLogic: { id: string; similarity: number } | null = null;
  if (logic) {
    const issues = validateWireGraph(logic);
    if (issues.length > 0) {
      notes.push(`the induced logic graph did not validate (${issues[0]}); dropped`);
      logic = null;
    } else {
      const near = nearestRecord(logicMemory.encode(logicFeatures(logic)), LOGIC_SHELF);
      if (near) nearestLogic = { id: near.record.id, similarity: round3(near.similarity) };
    }
  }

  // 3. the harness sliders (MAPPED, documented): richness → awareness, structure/noise → Π₀, rhythm → α, air control → R
  const richness = sieve ? clamp(sieve.structuralModeCount / 16, 0, 1) : 0.5;
  const snr = sieve && sieve.residualStd > 0 ? structuralRms / sieve.residualStd : 3;
  const rhythmHz = sieve?.dominantHz || fire?.roundsPerSecond || 1;
  const harness: HarnessSliders = {
    relativeAwarenessCeiling: round3(0.1 + 0.9 * richness),
    baselinePrecisionPi0: round3(clamp(0.5 + (4.5 * snr) / (snr + 3), 0.5, 5)),
    annealRateAlpha: round3(clamp(4 + 26 * Math.min(1, rhythmHz / 10), 4, 30)),
    syntropicDampingNspm: round3(clamp(0.5 + 7.5 * (locomotion?.airControl ?? 0.5), 0.5, 8)),
  };
  notes.push('harness sliders are mapped (awareness from structural richness, Π₀ from structure/noise, α from rhythm, R_syntropic from air control), not identified');

  // 4. how much to trust it
  const evidence = { jumps: reading?.jumps ?? 0, groundSamples: reading?.groundSamples ?? 0, shots: obs.shots?.t.length ?? 0, rules: logic?.actuators.length ?? 0 };
  const support = Math.min(1, (evidence.jumps >= 2 ? 0.4 : evidence.jumps * 0.2) + (evidence.groundSamples >= 20 ? 0.3 : evidence.groundSamples / 66) + (evidence.shots >= 6 ? 0.3 : evidence.shots / 20) + (evidence.rules > 0 ? 0.3 : 0));
  const confidence = round3(support * CHANNEL_WEIGHT[obs.channel]);

  return {
    game: obs.game, channel: obs.channel, locomotion, fire, logic, motion, harness,
    dashImpulseMps: reading?.dash !== null && reading?.dash !== undefined ? round3(reading.dash) : null,
    nearest: { locomotion: nearestLoc, logic: nearestLogic },
    sieve, evidence, confidence, notes,
  };
}

/** Is this a usable observation? (A bridge or a test checks before transducing; the transducer itself never throws on data.) */
export function isMechanicObservation(v: unknown): v is MechanicObservation {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  if (typeof o.game !== 'string' || typeof o.channel !== 'string' || !([...OBSERVER_LADDER, 'synthetic'] as string[]).includes(o.channel)) return false;
  const nums = (a: unknown, max = 20000): boolean => Array.isArray(a) && a.length <= max && a.every((x) => typeof x === 'number' && Number.isFinite(x));
  if (o.trajectory !== undefined) {
    const t = o.trajectory as Record<string, unknown>;
    if (!nums(t.t) || !nums(t.x) || !nums(t.y) || !nums(t.z)) return false;
  }
  if (o.shots !== undefined) {
    const s = o.shots as Record<string, unknown>;
    if (!nums(s.t) || (s.kick !== undefined && !nums(s.kick))) return false;
  }
  if (o.events !== undefined && !(Array.isArray(o.events) && o.events.length <= 20000 && o.events.every((e) => typeof e === 'object' && e !== null && typeof (e as { t: unknown }).t === 'number' && typeof (e as { name: unknown }).name === 'string'))) return false;
  return o.trajectory !== undefined || o.shots !== undefined || o.events !== undefined;
}
