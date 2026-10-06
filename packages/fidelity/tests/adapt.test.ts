// adaptGraph: every rewritten graph must still be a valid texture graph that evaluates (the drop never checked this).
import test from "node:test";
import assert from "node:assert/strict";
import { evaluateGraph, validateGraph } from "@hm/texgraph";
import { DEVICES, EDGE_KEYS, adaptGraph, deriveBudget, deviceFor } from "../src";
import { CART_A, CART_B, CART_C, STAGE_STATES } from "./fixtures";

const CARTS = [CART_A, CART_B, CART_C];

test("every cartridge, tier and stage adapts to a valid graph that evaluates", () => {
  let checked = 0;
  for (const cart of CARTS) {
    for (const dev of DEVICES) {
      for (const s of STAGE_STATES) {
        const b = deriveBudget(s, dev);
        const g = adaptGraph(cart.graph, b);
        const check = validateGraph(g);
        assert.ok(check.ok, `${cart.id}@${dev.id} stage ${b.stage}: ${check.errors.join("; ")}`);
        assert.ok(g.out.albedo, `${cart.id}@${dev.id} stage ${b.stage} lost its albedo`);
        const t = evaluateGraph(g, { size: 16 });
        assert.ok(t.albedo && t.albedo.every((v) => v >= 0 && v <= 1));
        checked++;
      }
    }
  }
  assert.equal(checked, 3 * 5 * 6);
});

test("no edge points at a missing node after warps are skipped or cellular is swapped", () => {
  for (const cart of CARTS) {
    for (const dev of DEVICES) {
      for (const s of STAGE_STATES) {
        const g = adaptGraph(cart.graph, deriveBudget(s, dev));
        const ids = new Set(g.nodes.map((n) => n.id));
        for (const n of g.nodes) for (const k of EDGE_KEYS) if (typeof n[k] === "string") assert.ok(ids.has(n[k] as string), `${n.id}.${k}`);
        for (const o of [g.out.albedo, g.out.height, g.out.roughness]) if (o) assert.ok(ids.has(o));
      }
    }
  }
});

test("noise octaves never exceed the budget, including the noise that stands in for cellular", () => {
  // the Arena drop gave the stand-in a fixed 2 octaves; on its weakest tier the budget is 1 (its own test caught it)
  for (const dev of DEVICES) {
    for (const s of STAGE_STATES) {
      const b = deriveBudget(s, dev);
      for (const n of adaptGraph(CART_A.graph, b).nodes) {
        if (n.type === "noise") assert.ok((n.octaves as number) <= b.octaveBudget, `${dev.id}: ${String(n.octaves)} > ${b.octaveBudget}`);
      }
    }
  }
});

test("cellular is drawn as noise where the tier cannot afford it", () => {
  const b = deriveBudget(STAGE_STATES[0]!, deviceFor("potato"));
  assert.equal(b.allowCellular, false);
  const g = adaptGraph(CART_A.graph, b);
  assert.equal(g.nodes.find((n) => n.id === "cell")?.type, "noise");
  assert.ok(b.demoted.some((d) => d.includes("cellular")));
});

test("warps are skipped where not allowed, and their users read the warp's input", () => {
  const b = deriveBudget(STAGE_STATES[0]!, deviceFor("ultra"));
  assert.equal(b.allowWarp, false);
  const g = adaptGraph(CART_B.graph, b);
  assert.equal(g.nodes.some((n) => n.type === "warp"), false);
  assert.equal(g.nodes.find((n) => n.id === "alb")?.in, "streak");
  assert.equal(g.out.height, "streak");
});

test("ramps are a hard palette at stage 1 and smooth at stage 6", () => {
  const ramp = (stage: number) => adaptGraph(CART_A.graph, deriveBudget(STAGE_STATES[stage - 1]!, deviceFor("ultra"))).nodes.find((n) => n.type === "ramp");
  assert.equal(ramp(1)?.interpolation, "constant");
  assert.equal(ramp(6)?.interpolation, "smooth");
});

test("a curl warp turns plain below 64 texels", () => {
  const curly = { ...CART_B.graph, nodes: CART_B.graph.nodes.map((n) => (n.type === "warp" ? { ...n, curl: true } : n)) };
  const small = deriveBudget(STAGE_STATES[2]!, deviceFor("potato"));
  const big = deriveBudget(STAGE_STATES[4]!, deviceFor("high"));
  assert.ok(small.size <= 32 || !small.allowWarp, "the test needs a small budget");
  assert.ok(big.size > 32 && big.allowWarp);
  assert.equal(adaptGraph(curly, big).nodes.find((n) => n.type === "warp")?.curl, true);
  const smallWarp = adaptGraph(curly, small).nodes.find((n) => n.type === "warp");
  assert.ok(smallWarp === undefined || smallWarp.curl === false);
});

test("water lays the wetness pass over the albedo exactly once", () => {
  const wet = adaptGraph(CART_A.graph, deriveBudget(STAGE_STATES[5]!, deviceFor("ultra")));
  const dry = adaptGraph(CART_A.graph, deriveBudget(STAGE_STATES[0]!, deviceFor("ultra")));
  assert.equal(wet.nodes.filter((n) => n.id === "__wet_mix").length, 1);
  assert.equal(dry.nodes.filter((n) => n.id === "__wet_mix").length, 0);
  assert.equal(wet.out.albedo, "__wet_mix");
  assert.ok(validateGraph(wet).ok);
});

test("adapting never changes the cartridge it was given", () => {
  const before = JSON.stringify(CART_B.graph);
  for (const dev of DEVICES) for (const s of STAGE_STATES) adaptGraph(CART_B.graph, deriveBudget(s, dev));
  assert.equal(JSON.stringify(CART_B.graph), before);
});
