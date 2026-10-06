// Determinism, the fidelity maths and the budget governor (ported from the Arena drop's 29 specs, on our five tiers).
import test from "node:test";
import assert from "node:assert/strict";
import {
  DEVICES, STAGE_FI, TEXEL_LADDER, coherence, contentHash, deriveBudget, deviceFor,
  fidelityIndex, normalised, stageOf, stepFidelity, type FidelityState,
} from "../src";
import { CARTS, CART_A, STAGE_STATES } from "./fixtures";

test("contentHash is stable, key-order independent and pinned to 6 decimals", () => {
  const first = contentHash(CART_A.graph);
  for (let i = 0; i < 1000; i++) assert.equal(contentHash(CART_A.graph), first);
  assert.equal(
    contentHash({ alpha: 1, beta: [2, 3], gamma: { x: 0.1234567, y: 2 } }),
    contentHash({ gamma: { y: 2, x: 0.1234567 }, beta: [2, 3], alpha: 1 }),
  );
  assert.equal(contentHash(0.1 + 0.2), contentHash(0.3));
  assert.notEqual(contentHash(1.0000001), contentHash(1.1));
  assert.match(first, /^0x[0-9a-f]{8}$/);
});

test("stepFidelity replays identically over 1,200 ticks", () => {
  const emitters = [
    { id: "a", metric: "pxd" as const, tier: 1 as const, base: 12, clock: 3, cartridge: "rock", pos: [0, 0] as [number, number] },
    { id: "b", metric: "vtx" as const, tier: 0 as const, base: 9, clock: 4, pos: [8, 0] as [number, number] },
    { id: "c", metric: "lx" as const, tier: 2 as const, base: 7, clock: 2, pos: [0, 8] as [number, number] },
  ];
  const run = () => {
    let s: FidelityState = { pxd: 120, vtx: 80, lx: 40, aq: 2, tick: 0 };
    for (let i = 0; i < 1200; i++) s = stepFidelity(s, emitters, CARTS, { clockSupply: 260, maintenance: 0.8 });
    return s;
  };
  const a = run(), b = run();
  assert.deepEqual(a, b);
  assert.equal(a.tick, 1200);
  assert.ok(a.pxd > 120 && a.vtx > 80 && a.lx > 40, "emitters must raise their metrics");
});

test("too little power slows every emitter evenly, and no maintenance drains", () => {
  const emitters = [{ id: "a", metric: "pxd" as const, tier: 0 as const, base: 100, clock: 10, pos: [0, 0] as [number, number] }];
  const s: FidelityState = { pxd: 1e6, vtx: 1e6, lx: 1e6, aq: 1e6, tick: 0 };
  const full = stepFidelity(s, emitters, CARTS, { clockSupply: 1e9, maintenance: 1, ticks: 120 });
  const half = stepFidelity(s, emitters, CARTS, { clockSupply: 5, maintenance: 1, ticks: 120 });
  assert.ok(Math.abs((full.pxd - s.pxd) - 2 * (half.pxd - s.pxd)) < 1e-6, "half the power must give half the output");
  const decaying = stepFidelity(s, [], CARTS, { clockSupply: 0, maintenance: 0, ticks: 120 });
  assert.ok(decaying.pxd < s.pxd && decaying.aq < s.aq, "an unmaintained world must lose detail");
});

test("coherence is 1 for a balanced world and floors at 0.35", () => {
  assert.ok(Math.abs(coherence({ pxd: 1.24e8, vtx: 9.4e7, lx: 6.6e7, aq: 4.1e7, tick: 0 }) - 1) < 1e-9);
  assert.ok(Math.abs(coherence({ pxd: 1.24e8, vtx: 1, lx: 1, aq: 1, tick: 0 }) - 0.35) < 1e-9);
});

test("Fi is linear under uniform scaling (the exponents add up to 1)", () => {
  const base = fidelityIndex({ pxd: 1e5, vtx: 1e5, lx: 1e5, aq: 1e5, tick: 0 });
  const x10 = fidelityIndex({ pxd: 1e6, vtx: 1e6, lx: 1e6, aq: 1e6, tick: 0 });
  assert.ok(Math.abs(x10 / base - 10) < 1e-6);
});

test("stageOf matches the thresholds and the six canonical states", () => {
  for (let i = 1; i <= 6; i++) assert.equal(stageOf(STAGE_FI[i - 1]!), i);
  for (let i = 2; i <= 6; i++) assert.equal(stageOf(STAGE_FI[i - 1]! - 1), i - 1);
  let previous = -1;
  STAGE_STATES.forEach((s, i) => {
    const fi = fidelityIndex(s);
    assert.ok(fi > previous, "Fi must grow along the ladder");
    assert.equal(stageOf(fi), i + 1);
    previous = fi;
  });
});

test("normalised() grows along the ladder and stays in 0..1", () => {
  let previous = -1;
  for (const s of STAGE_STATES) {
    const n = normalised(s).pxd;
    assert.ok(n >= 0 && n <= 1);
    assert.ok(n > previous);
    previous = n;
  }
});

test("every tier's budget stays inside its caps, at every stage", () => {
  assert.equal(DEVICES.length, 5);
  for (const dev of DEVICES) {
    for (const s of STAGE_STATES) {
      const b = deriveBudget(s, dev);
      assert.ok(TEXEL_LADDER.includes(b.size));
      assert.ok(b.size <= dev.maxTexel, `${dev.id} exceeded its texel cap`);
      assert.ok(b.octaveBudget >= 1 && b.octaveBudget <= dev.maxOctaves && b.octaveBudget <= 6);
      assert.ok(b.relief >= 0.15 && b.relief <= 1.7);
      assert.ok(b.wetness >= 0 && b.wetness <= 1);
      assert.ok(b.shadowCascades >= 0 && b.shadowCascades <= 4);
    }
  }
});

test("the stage never depends on the tier (progress is never gated by hardware)", () => {
  for (const s of STAGE_STATES) assert.equal(new Set(DEVICES.map((d) => deriveBudget(s, d).stage)).size, 1);
});

test("demotions are reported, never silent", () => {
  assert.ok(deriveBudget(STAGE_STATES[5]!, deviceFor("potato")).demoted.length > 0);
  assert.deepEqual(deriveBudget(STAGE_STATES[5]!, deviceFor("ultra")).demoted, []);
});

test("texture size never shrinks as pxd grows", () => {
  let previous = 0;
  for (const s of STAGE_STATES) {
    const b = deriveBudget(s, deviceFor("ultra"));
    assert.ok(b.size >= previous);
    previous = b.size;
  }
  assert.equal(previous, 512);
});

test("deviceFor knows the game's tiers and falls back to Low", () => {
  for (const id of ["potato", "low", "medium", "high", "ultra"]) assert.equal(deviceFor(id).id, id);
  assert.equal(deviceFor("calculator").id, "low");
});

test("golden: the budget table for 6 stages x 5 tiers", () => {
  const rows = DEVICES.flatMap((dev) => STAGE_STATES.map((s) => {
    const b = deriveBudget(s, dev);
    return [dev.id, b.stage, b.size, b.octaveBudget, +b.relief.toFixed(4), b.normal, +b.wetness.toFixed(4), b.paletteLevels, b.shadowCascades, b.demoted.length];
  }));
  assert.equal(rows.length, 30);
  // an intentional tuning change updates this in the same commit, so the diff shows which rows moved
  assert.equal(contentHash(rows), GOLDEN_BUDGETS);
});

const GOLDEN_BUDGETS = "0x0ae5d1fa";
