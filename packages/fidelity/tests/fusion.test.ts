// The Fusion Matrix and the export check.
import test from "node:test";
import assert from "node:assert/strict";
import { evaluateGraph, validateGraph } from "@hm/texgraph";
import { DEVICES, certify, contentHash, deviceFor, fuse, graphCost, type Cartridge } from "../src";
import { CART_A, CART_B, CART_C } from "./fixtures";

const PAIRS: [Cartridge, Cartridge][] = [[CART_A, CART_B], [CART_A, CART_C], [CART_B, CART_C], [CART_B, CART_A], [CART_C, CART_A], [CART_A, CART_A], [CART_B, CART_B]];

test("fuse is a pure function of (a, b, dominance, seed)", () => {
  const hashes = new Set<string>();
  for (let i = 0; i < 200; i++) hashes.add(fuse(CART_A, CART_B, 0.6, 7).child.hash);
  assert.equal(hashes.size, 1);
  assert.notEqual(fuse(CART_A, CART_B, 0.6, 7).child.hash, fuse(CART_A, CART_B, 0.6, 8).child.hash);
});

test("fuse never changes its parents, and the child cites both", () => {
  const before = [contentHash(CART_A), contentHash(CART_B)];
  const child = fuse(CART_A, CART_B, 0.75, 1).child;
  assert.deepEqual([contentHash(CART_A), contentHash(CART_B)], before);
  assert.ok(child.parents.includes(CART_A.hash) && child.parents.includes(CART_B.hash));
});

test("every fusion is a valid texture graph that evaluates", () => {
  for (const [a, b] of PAIRS) {
    for (const f of [0, 0.25, 0.5, 1]) {
      const { child } = fuse(a, b, f, 3);
      const check = validateGraph(child.graph);
      assert.ok(check.ok, `${a.id} x ${b.id} at ${f}: ${check.errors.join("; ")}`);
      assert.ok(child.graph.out.albedo, `${a.id} x ${b.id} lost its albedo`);
      assert.ok(evaluateGraph(child.graph, { size: 16 }).albedo);
    }
  }
});

test("the grammar: material and verb keeps the material, a rule keeps its subject", () => {
  assert.equal(fuse(CART_A, CART_B, 0.5).grammar, "MATERIAL + OPERATOR");
  assert.equal(fuse(CART_A, CART_B, 0.5).child.cls, "MATERIAL");
  assert.equal(fuse(CART_B, CART_B, 0.5).child.cls, "OPERATOR");
  assert.equal(fuse(CART_C, CART_A, 0.5).child.cls, "MATERIAL");
  assert.ok(fuse(CART_C, CART_A, 0.5).child.graph.nodes.some((n) => n.mask !== undefined), "a rule must mask");
});

test("the child's knobs still point at its own nodes", () => {
  const { child } = fuse(CART_A, CART_B, 0.5);
  const ids = new Set(child.graph.nodes.map((n) => n.id));
  assert.ok(child.vars.length <= 8);
  for (const v of child.vars.slice(1)) assert.ok(ids.has(v.path.split(".")[0]!), `${v.path} points nowhere`);
});

test("well-formed cartridges and their fusions pass the export check on every tier", () => {
  for (const c of [CART_A, CART_B, CART_C]) for (const d of DEVICES) assert.ok(certify(c, d).pass, `${c.id}@${d.id}: ${certify(c, d).failures.join("; ")}`);
  for (const [a, b] of PAIRS) {
    for (const f of [0, 0.5, 1]) {
      const cert = certify(fuse(a, b, f, 3).child, deviceFor("medium"));
      assert.ok(cert.pass, `${a.id} x ${b.id} at ${f}: ${cert.failures.join("; ")}`);
    }
  }
});

test("the export check refuses more than 8 knobs and knobs without an explanation", () => {
  const bad: Cartridge = {
    ...CART_A,
    vars: Array.from({ length: 9 }, (_, i) => ({ path: `n.p${i}`, label: "x", real: "x", unit: "-", min: 0, max: 1, step: 0.1, def: 0.5, explain: "short", tier: 1 as const })),
  };
  const cert = certify(bad, deviceFor("medium"));
  assert.equal(cert.pass, false);
  assert.ok(cert.failures.some((f) => f.includes("the cap is 8")));
  assert.ok(cert.failures.some((f) => f.includes("no explanation")));
});

test("the export check refuses a graph texgraph cannot evaluate", () => {
  const broken: Cartridge = { ...CART_A, graph: { ...CART_A.graph, nodes: CART_A.graph.nodes.map((n) => (n.id === "cell" ? { ...n, mode: "hexagons" } : n)) } };
  const cert = certify(broken, deviceFor("ultra"));
  assert.equal(cert.pass, false);
  assert.ok(cert.failures.some((f) => f.includes("not a valid texture graph")));
});

test("the cost estimate grows with the texel count", () => {
  assert.ok(Math.abs(graphCost(CART_A.graph, 256).evalMs / graphCost(CART_A.graph, 128).evalMs - 4) < 1e-9);
});
