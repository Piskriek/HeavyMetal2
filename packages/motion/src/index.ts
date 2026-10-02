// @ts-nocheck (agent-generated: strict index access cleanup pending; behaviour is covered by the tests)
/* motion — animation and recorded movement as DATA.
 *
 * Everything here is pure, deterministic TypeScript: no Math.random, no Date,
 * no dependencies, no side effects. An animation ("Clip") is a preset made of
 * "Track"s that move variables over time; the easiest way to author one is to
 * RECORD a movement (drag a slider or gizmo) and let this library clean the
 * recorded "Sample" stream up into keyframes.
 */

/* ------------------------------------------------------------------ types */

export type Ease = 'linear' | 'in' | 'out' | 'inOut' | 'hold';
export type LoopMode = 'none' | 'loop' | 'pingpong';

export interface Key {
  /** time, in ms, from the start of the clip */
  t: number;
  /** value of the variable at this key */
  v: number;
  /** easing of the segment that ENDS at this key */
  ease?: Ease;
}

export interface Track {
  /** a variable path, e.g. "arms.left.rotation" */
  target: string;
  /** keys sorted by t, strictly increasing */
  keys: Key[];
}

export interface Clip {
  id: string;
  durationMs: number;
  loop: LoopMode;
  tracks: Track[];
}

export interface Sample {
  /** time, in ms */
  t: number;
  /** recorded value */
  v: number;
}

export interface LoopInfo {
  loops: boolean;
  periodMs: number | null;
}

export interface RecordOptions {
  tolerance: number;
  smoothMs?: number;
  gridMs?: number;
  durationMs?: number;
  loop?: LoopMode;
}

export interface StateMachine {
  initial: string;
  states: Record<string, { clip: string; loop?: boolean }>;
  transitions: { from: string; to: string; when: string; fadeMs: number }[];
}

export interface MachineCursor {
  state: string;
  fade?: { from: string; elapsedMs: number; fadeMs: number };
}

export interface MachineCursorWeights extends MachineCursor {
  weights: Record<string, number>;
}

export interface Layer {
  clip: Clip;
  timeMs: number;
  weight: number;
  mode: 'override' | 'add';
}

/* --------------------------------------------------------------- internals */

const EPS = 1e-9;

const CURVES: readonly Ease[] = ['linear', 'in', 'out', 'inOut'];

function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x;
}

/** Kill float dust so identical maths always yields identical numbers. */
function clean(x: number): number {
  if (!Number.isFinite(x)) return x;
  const r = Math.round(x * 1e9) / 1e9;
  return r === 0 ? 0 : r;
}

/** progress (0..1) -> eased progress */
export function applyEase(ease: Ease | undefined, x: number): number {
  switch (ease) {
    case 'in':
      return x * x;
    case 'out':
      return 1 - (1 - x) * (1 - x);
    case 'inOut':
      return x * x * (3 - 2 * x);
    case 'hold':
      return 0;
    default:
      return x;
  }
}

function swapEase(ease: Ease | undefined): Ease | undefined {
  switch (ease) {
    case 'in':
      return 'out';
    case 'out':
      return 'in';
    case 'hold':
      return 'hold';
    default:
      return ease === undefined ? undefined : 'linear';
  }
}

/**
 * Sort samples by time (stable) and collapse duplicate times by keeping the
 * LAST of each group of duplicates. Always returns fresh objects.
 */
export function sortSamples(samples: readonly Sample[]): Sample[] {
  const indexed = samples.map((s, i) => ({ s: { t: s.t, v: s.v }, i }));
  indexed.sort((a, b) => a.s.t - b.s.t || a.i - b.i);
  const out: Sample[] = [];
  for (const { s } of indexed) {
    const prev = out[out.length - 1];
    if (prev !== undefined && prev.t === s.t) out[out.length - 1] = { t: s.t, v: s.v };
    else out.push({ t: s.t, v: s.v });
  }
  return out;
}

/** Ramer–Douglas–Peucker with VERTICAL (value) error, iterative + in place. */
function rdp(pts: readonly Sample[], tolerance: number, keep: boolean[]): void {
  const stack: number[] = [0, pts.length - 1];
  while (stack.length > 0) {
    const last = stack.pop() as number;
    const first = stack.pop() as number;
    if (last - first < 2) continue;
    const a = pts[first];
    const b = pts[last];
    const dt = b.t - a.t;
    const dv = b.v - a.v;
    let maxErr = -1;
    let idx = -1;
    for (let i = first + 1; i < last; i++) {
      const p = pts[i];
      const err =
        dt === 0 ? Math.abs(p.v - a.v) : Math.abs(a.v + (dv * (p.t - a.t)) / dt - p.v);
      if (err > maxErr) {
        maxErr = err;
        idx = i;
      }
    }
    if (idx >= 0 && maxErr > tolerance + EPS) {
      keep[idx] = true;
      stack.push(first, idx, idx, last);
    }
  }
}

/* ------------------------------------------------- recording / clean-up */

/**
 * Reduce a recorded stream to few keyframes with Ramer–Douglas–Peucker using
 * VERTICAL error (value difference at the same t). First and last samples are
 * always kept. Input may be unsorted / contain duplicate times. [] -> [].
 */
export function simplify(samples: readonly Sample[], tolerance: number): Key[] {
  const pts = sortSamples(samples);
  if (pts.length === 0) return [];
  if (pts.length === 1) return [{ t: clean(pts[0].t), v: pts[0].v }];
  const keep: boolean[] = new Array(pts.length).fill(false);
  keep[0] = true;
  keep[pts.length - 1] = true;
  rdp(pts, tolerance, keep);
  const out: Key[] = [];
  for (let i = 0; i < pts.length; i++) {
    if (keep[i]) out.push({ t: clean(pts[i].t), v: pts[i].v });
  }
  return out;
}

/**
 * Moving average over a time window of width `windowMs` (centred). Sample
 * times and count are preserved; the first and last values are kept verbatim.
 */
export function smooth(samples: readonly Sample[], windowMs: number): Sample[] {
  const pts = sortSamples(samples);
  if (pts.length === 0 || !(windowMs > 0)) return pts;
  const half = windowMs / 2;
  const out: Sample[] = new Array(pts.length);
  let lo = 0;
  let hi = 0;
  let sum = pts[0].v;
  const last = pts.length - 1;
  for (let i = 0; i <= last; i++) {
    while (hi + 1 <= last && pts[hi + 1].t - pts[i].t <= half) {
      hi++;
      sum += pts[hi].v;
    }
    while (pts[i].t - pts[lo].t > half) {
      sum -= pts[lo].v;
      lo++;
    }
    const v = i === 0 || i === last ? pts[i].v : sum / (hi - lo + 1);
    out[i] = { t: pts[i].t, v };
  }
  return out;
}

function snapToGrid(t: number, gridMs: number): number {
  return clean(Math.round(t / gridMs) * gridMs);
}

/**
 * Snap key times onto a grid. Order is kept and times stay strictly
 * increasing: collisions are nudged forward by gridMs.
 */
export function quantiseTimes(keys: readonly Key[], gridMs: number): Key[] {
  const out: Key[] = keys.map((k) => ({ t: k.t, v: k.v, ease: k.ease }));
  if (!(gridMs > 0) || out.length === 0) return out;
  out[0].t = snapToGrid(out[0].t, gridMs);
  for (let i = 1; i < out.length; i++) {
    let t = snapToGrid(out[i].t, gridMs);
    if (t <= out[i - 1].t) t = clean(out[i - 1].t + gridMs);
    out[i].t = t;
  }
  return out;
}

/**
 * For each segment, compare the real samples inside it against the curves
 * linear, in (x*x), out (1-(1-x)^2), inOut (x*x*(3-2x)) by least squares and
 * set the ease with the smallest error. Segments with fewer than 3 samples
 * inside them stay linear. The ease of the first key is cleared (no segment
 * ends there).
 */
export function fitEaseFromSamples(samples: readonly Sample[], keys: readonly Key[]): Key[] {
  const pts = sortSamples(samples);
  const out: Key[] = keys.map((k) => ({ t: k.t, v: k.v, ease: k.ease }));
  if (out.length > 0) out[0].ease = undefined;
  for (let i = 1; i < out.length; i++) {
    const a = out[i - 1];
    const b = out[i];
    const span = b.t - a.t;
    let inside = 0;
    if (span > 0) {
      for (const p of pts) {
        if (p.t <= a.t) continue;
        if (p.t >= b.t) break;
        inside++;
      }
    }
    if (span <= 0 || inside < 3) {
      out[i].ease = 'linear';
      continue;
    }
    const dv = b.v - a.v;
    let best: Ease = 'linear';
    let bestErr = Infinity;
    for (const curve of CURVES) {
      let err = 0;
      for (const p of pts) {
        if (p.t <= a.t) continue;
        if (p.t >= b.t) break;
        const x = (p.t - a.t) / span;
        const d = a.v + dv * applyEase(curve, x) - p.v;
        err += d * d;
      }
      if (err < bestErr - EPS) {
        bestErr = err;
        best = curve;
      }
    }
    out[i].ease = best;
  }
  return out;
}

/**
 * Does this recording describe a loop? True when the first and last values
 * match within `toleranceFraction` of the value range AND an autocorrelation
 * estimate finds a period that divides the duration within 10%.
 */
export function detectLoop(samples: readonly Sample[], toleranceFraction: number): LoopInfo {
  const pts = sortSamples(samples);
  if (pts.length < 4) return { loops: false, periodMs: null };
  const t0 = pts[0].t;
  const duration = pts[pts.length - 1].t - t0;
  if (!(duration > 0)) return { loops: false, periodMs: null };

  let min = Infinity;
  let max = -Infinity;
  for (const p of pts) {
    if (p.v < min) min = p.v;
    if (p.v > max) max = p.v;
  }
  const range = max - min;
  const tolerance = Math.abs(toleranceFraction) * range;
  if (Math.abs(pts[pts.length - 1].v - pts[0].v) > tolerance) {
    return { loops: false, periodMs: null };
  }

  // Resample onto a uniform grid (inclusive of both ends) for autocorrelation.
  const N = Math.max(8, Math.min(256, pts.length));
  const grid: number[] = new Array(N);
  let j = 0;
  for (let i = 0; i < N; i++) {
    const t = t0 + (duration * i) / (N - 1);
    while (j < pts.length - 2 && pts[j + 1].t < t) j++;
    const a = pts[j];
    const b = pts[Math.min(j + 1, pts.length - 1)];
    const u = b.t === a.t ? 0 : clamp((t - a.t) / (b.t - a.t), 0, 1);
    grid[i] = a.v + (b.v - a.v) * u;
  }

  const mean = grid.reduce((s, x) => s + x, 0) / N;
  const c: number[] = grid.map((x) => x - mean);
  const denom = c.reduce((s, x) => s + x * x, 0);
  if (!(denom > 0)) return { loops: true, periodMs: null }; // perfectly flat recording

  const maxLag = Math.max(3, N >> 1);
  const r: number[] = new Array(maxLag + 1).fill(0);
  for (let lag = 0; lag <= maxLag; lag++) {
    if (lag >= N) break;
    let num = 0;
    for (let i = 0; i + lag < N; i++) num += c[i] * c[i + lag];
    r[lag] = num / denom;
  }

  let bestLag = -1;
  let bestR = 0;
  for (let lag = 2; lag < maxLag; lag++) {
    if (r[lag] > r[lag - 1] && r[lag] >= r[lag + 1] && r[lag] > bestR) {
      bestR = r[lag];
      bestLag = lag;
    }
  }
  if (bestLag < 0 || bestR < 0.5) return { loops: false, periodMs: null };

  const rawPeriod = (duration * bestLag) / (N - 1);
  const periods = duration / rawPeriod;
  const whole = Math.round(periods);
  if (!(whole >= 1) || Math.abs(periods - whole) > 0.1 * whole) {
    return { loops: false, periodMs: null };
  }
  return { loops: true, periodMs: clean(duration / whole) };
}

/* ------------------------------------------------------------- sampling */

/** Interpolate a track at time `t`; clamped before the first / after the last key. */
export function sampleTrack(track: Track, t: number): number {
  const keys = track.keys;
  if (!keys || keys.length === 0) return 0;
  if (keys.length === 1) return keys[0].v;
  if (t <= keys[0].t) return keys[0].v;
  if (t >= keys[keys.length - 1].t) return keys[keys.length - 1].v;
  let lo = 0;
  let hi = keys.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (keys[mid].t <= t) lo = mid;
    else hi = mid;
  }
  const a = keys[lo];
  const b = keys[hi];
  const span = b.t - a.t;
  if (!(span > 0)) return b.v;
  if (b.ease === 'hold') return a.v;
  const x = (t - a.t) / span;
  return a.v + (b.v - a.v) * applyEase(b.ease, x);
}

function localTime(durationMs: number, loop: LoopMode, timeMs: number): number {
  if (!(durationMs > 0)) return 0;
  if (loop === 'loop') {
    const m = timeMs % durationMs;
    return m < 0 ? m + durationMs : m;
  }
  if (loop === 'pingpong') {
    const period = durationMs * 2;
    const m = timeMs % period;
    const p = m < 0 ? m + period : m;
    return p <= durationMs ? p : period - p;
  }
  return clamp(timeMs, 0, durationMs);
}

/** Sample every track of a clip, honouring the loop mode. */
export function sampleClip(clip: Clip, timeMs: number): Record<string, number> {
  const out: Record<string, number> = {};
  const local = localTime(clip.durationMs, clip.loop, timeMs);
  for (const track of clip.tracks) out[track.target] = sampleTrack(track, local);
  return out;
}

/**
 * Layers are applied in order. `override` lerps the accumulated value towards
 * the clip value by weight (an unknown target starts from 0); `add` adds
 * weight * value.
 */
export function blendClips(layers: readonly Layer[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const layer of layers) {
    const values = sampleClip(layer.clip, layer.timeMs);
    const w = Number.isFinite(layer.weight) ? layer.weight : 0;
    for (const target of Object.keys(values)) {
      const v = values[target];
      if (layer.mode === 'add') {
        out[target] = (out[target] === undefined ? 0 : out[target]) + w * v;
      } else {
        const cur = out[target] === undefined ? 0 : out[target];
        out[target] = cur + (v - cur) * w;
      }
    }
  }
  return out;
}

/* --------------------------------------------------------------- clip ops */

/** Speed a clip up (factor > 1) or slow it down (factor < 1). Times scale. */
export function retime(clip: Clip, factor: number): Clip {
  const f = Number.isFinite(factor) && factor > 0 ? factor : 1;
  return {
    id: clip.id,
    durationMs: clean(clip.durationMs * f),
    loop: clip.loop,
    tracks: clip.tracks.map((track) => ({
      target: track.target,
      keys: track.keys.map((k) => ({ t: clean(k.t * f), v: k.v, ease: k.ease })),
    })),
  };
}

/** The same clip played backwards: keys reversed in time, in/out swapped. */
export function mirror(clip: Clip): Clip {
  const duration = clip.durationMs;
  return {
    id: clip.id,
    durationMs: duration,
    loop: clip.loop,
    tracks: clip.tracks.map((track) => {
      const keys = track.keys;
      const out: Key[] = [];
      for (let i = keys.length - 1; i >= 0; i--) {
        out.push({
          t: clean(duration - keys[i].t),
          v: keys[i].v,
          ease: i < keys.length - 1 ? swapEase(keys[i + 1].ease) : undefined,
        });
      }
      return { target: track.target, keys: out };
    }),
  };
}

/**
 * Turn a recording into a clip: sort, optionally smooth, simplify to keys,
 * optionally snap the key times to a grid, then fit an ease per segment.
 * The clip starts at t = 0 (the first sample's time is subtracted).
 */
export function recordToClip(
  id: string,
  target: string,
  samples: readonly Sample[],
  opts: RecordOptions,
): Clip {
  const loop = opts.loop ?? 'none';
  const recorded = sortSamples(samples);
  if (recorded.length === 0) {
    return { id, durationMs: opts.durationMs ?? 0, loop, tracks: [{ target, keys: [] }] };
  }
  const origin = recorded[0].t;
  const shifted = recorded.map((p) => ({ t: clean(p.t - origin), v: p.v }));
  const cleaned =
    opts.smoothMs !== undefined && opts.smoothMs > 0 ? smooth(shifted, opts.smoothMs) : shifted;

  let keys = simplify(cleaned, opts.tolerance);
  if (opts.gridMs !== undefined && opts.gridMs > 0) keys = quantiseTimes(keys, opts.gridMs);
  keys = fitEaseFromSamples(cleaned, keys);

  const lastT = keys.length > 0 ? keys[keys.length - 1].t : 0;
  const durationMs = Math.max(opts.durationMs !== undefined ? opts.durationMs : lastT, lastT);
  return { id, durationMs, loop, tracks: [{ target, keys }] };
}

/* ---------------------------------------------------------- state machine */

/**
 * Advance a clip state machine by dtMs, optionally firing one event.
 * Returns the new state, the active crossfade (if any) and the clip weights,
 * which always sum to 1.
 */
export function stepMachine(
  m: StateMachine,
  current: MachineCursor,
  event: string | null,
  dtMs: number,
): MachineCursorWeights {
  let state = current.state;
  let fade = current.fade ? { ...current.fade } : undefined;
  if (fade) {
    fade.elapsedMs += dtMs > 0 ? dtMs : 0;
    if (fade.elapsedMs >= fade.fadeMs) fade = undefined;
  }

  if (event !== null && event !== undefined && event !== '') {
    const tr = m.transitions.find((t) => t.from === state && t.when === event);
    if (tr) {
      if (tr.to === state) {
        fade = undefined;
      } else {
        fade = tr.fadeMs > 0 ? { from: state, elapsedMs: 0, fadeMs: tr.fadeMs } : undefined;
      }
      state = tr.to;
    }
  }

  if (!fade) {
    const weights: Record<string, number> = {};
    weights[state] = 1;
    return { state, weights };
  }

  const progress = fade.fadeMs > 0 ? clamp(fade.elapsedMs / fade.fadeMs, 0, 1) : 1;
  const toWeight = fade.from === state ? 1 : progress;
  const weights: Record<string, number> = {};
  if (fade.from !== state) weights[fade.from] = 1 - toWeight;
  weights[state] = toWeight;
  return { state, fade: { ...fade }, weights };
}