// The fidelity maths: how much of each metric a world has, its Fi, its stage, and the sim step.
import type { Cartridge, Emitter, FidelityState, MetricKey, Stage, StepOptions } from "./types";
import { FI_WEIGHTS, METRIC_TARGET, STAGE_FI, TICK_HZ } from "./types";

const KEYS: readonly MetricKey[] = ["pxd", "vtx", "lx", "aq"];

/** Clamps v into a..b. */
export const clamp = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v);

/** C1 smoothstep: 0 at 0, 1 at 1, flat at both ends. */
export function smoothstepC1(u: number): number {
  const t = clamp(u, 0, 1);
  return t * t * (3 - 2 * t);
}

/** C = 1 - 0.45 sd/mean of the four metrics against their targets, at least 0.35: pumping one metric alone is worth less. */
export function coherence(s: FidelityState): number {
  const n = KEYS.map((k) => s[k] / METRIC_TARGET[k]);
  const mu = n.reduce((a, b) => a + b, 0) / 4;
  if (mu <= 1e-12) return 1;
  let acc = 0;
  for (const v of n) acc += (v - mu) * (v - mu);
  return clamp(1 - 0.45 * (Math.sqrt(acc / 4) / mu), 0.35, 1);
}

/** Fi = pxd^0.30 vtx^0.30 lx^0.25 aq^0.15 times coherence. The exponents add up to 1, so 10x everything is 10x Fi. */
export function fidelityIndex(s: FidelityState): number {
  let product = 1;
  for (const k of KEYS) product *= Math.pow(Math.max(s[k], 1e-6), FI_WEIGHTS[k]);
  return product * coherence(s);
}

/** The stage a Fi has reached (1 to 6). */
export function stageOf(fi: number): Stage {
  for (let i = 6; i >= 1; i--) if (fi >= STAGE_FI[i - 1]!) return i as Stage;
  return 1;
}

/** Each metric as 0..1 of its target, on a log scale raised to 2.5 so the six stages land on the texel ladder. */
export function normalised(s: FidelityState): Record<MetricKey, number> {
  const f = (v: number, target: number) => Math.pow(clamp(Math.log1p(Math.max(0, v)) / Math.log1p(target), 0, 1), 2.5);
  return { pxd: f(s.pxd, METRIC_TARGET.pxd), vtx: f(s.vtx, METRIC_TARGET.vtx), lx: f(s.lx, METRIC_TARGET.lx), aq: f(s.aq, METRIC_TARGET.aq) };
}

/** Output multiplier per emitter tier. */
export const TIER_MULT: readonly [number, number, number, number] = [1, 6.5, 42, 400];

/**
 * One fixed step of the world (call it at TICK_HZ). Pure: the same state, emitters and options give the same
 * next state on every machine, which is what replays and saves rely on.
 */
export function stepFidelity(
  s: FidelityState,
  emitters: readonly Emitter[],
  carts: ReadonlyMap<string, Cartridge>,
  opts: StepOptions = { clockSupply: Infinity, maintenance: 1 },
): FidelityState {
  const ticks = opts.ticks ?? 1;
  const dt = ticks / TICK_HZ;

  let demand = 0;
  for (const e of emitters) demand += e.clock * (1 + e.tier * 1.4);
  const saturation = demand <= 0 ? 1 : Math.min(1, opts.clockSupply / demand);

  const add: Record<MetricKey, number> = { pxd: 0, vtx: 0, lx: 0, aq: 0 };
  for (const e of emitters) {
    const cart = e.cartridge ? carts.get(e.cartridge) : undefined;
    const affinity = cart?.affinity[e.metric] ?? 1;
    add[e.metric] += e.base * TIER_MULT[e.tier] * saturation * affinity;
  }

  // an unmaintained world slowly loses detail, faster the more it has
  const drain = 0.015 * Math.pow(Math.max(fidelityIndex(s), 0), 0.82) * (1 - opts.maintenance);
  const next = (k: MetricKey) => Math.max(0, s[k] + (add[k] - drain * FI_WEIGHTS[k] * 4) * dt);
  return { pxd: next("pxd"), vtx: next("vtx"), lx: next("lx"), aq: next("aq"), tick: s.tick + ticks };
}
