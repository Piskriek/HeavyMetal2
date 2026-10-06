// Mesh policy and seams. The seam test is the one the Arena drop failed (pair 9 disagreed): fixed by a total order in minPolicy.
import test from "node:test";
import assert from "node:assert/strict";
import { deriveBudget, deviceFor, meshPolicyFor, minPolicy, seamKeyFor, seamsAgree, type FidelityState, type MeshPolicy } from "../src";
import { diagonalState, lcg } from "./fixtures";

const ULTRA = deviceFor("ultra");
const policy = (s: FidelityState): MeshPolicy => meshPolicyFor(s, deriveBudget(s, ULTRA));

test("neighbouring chunks agree on their shared edge over 10,000 random pairs", () => {
  const rnd = lcg(0x5eed);
  for (let i = 0; i < 10000; i++) {
    const a = policy(diagonalState(rnd)), b = policy(diagonalState(rnd));
    assert.ok(seamsAgree(a, b, [0, 0], "E", "W"), `pair ${i} disagreed`);
  }
});

test("minPolicy is fully commutative and picks the coarser cell", () => {
  const rnd = lcg(0xbeef);
  for (let i = 0; i < 2000; i++) {
    const a = policy(diagonalState(rnd)), b = policy(diagonalState(rnd));
    assert.deepEqual(minPolicy(a, b), minPolicy(b, a));
    assert.equal(minPolicy(a, b).cellSize, Math.max(a.cellSize, b.cellSize));
  }
});

test("two chunks with the same mode but different chamfer pick the same edge (the drop's crack)", () => {
  const rnd = lcg(7);
  let found = 0;
  for (let i = 0; i < 20000 && found < 20; i++) {
    const a = policy(diagonalState(rnd)), b = policy(diagonalState(rnd));
    if (a.lod === b.lod && a.mode === b.mode && (a.chamfer !== b.chamfer || a.relaxIterations !== b.relaxIterations)) {
      found++;
      assert.equal(seamKeyFor(minPolicy(a, b), "E", [4, 8]), seamKeyFor(minPolicy(b, a), "E", [4, 8]));
    }
  }
  assert.ok(found > 0, "the sample must contain same-mode pairs");
});

test("the smoothing angle follows 180 (1 - e^(-vtx / 50000))", () => {
  for (const vtx of [0, 5e3, 5e4, 5e5, 5e6]) {
    const s: FidelityState = { pxd: vtx * 1.3 + 1, vtx, lx: vtx * 0.7 + 1, aq: vtx * 0.4 + 1, tick: 0 };
    assert.ok(Math.abs(policy(s).smoothAngleDeg - 180 * (1 - Math.exp(-vtx / 50000))) < 1e-9);
  }
});

test("the mode climbs CUBIC, CHAMFER, DUAL and never goes back", () => {
  const rank = { CUBIC: 0, CHAMFER: 1, DUAL: 2 } as const;
  let previous = -1;
  const seen: string[] = [];
  for (let e = 2; e <= 8; e += 0.25) {
    const v = Math.pow(10, e);
    const p = policy({ pxd: v * 1.3, vtx: v, lx: v * 0.7, aq: v * 0.4, tick: 0 });
    assert.ok(rank[p.mode] >= previous);
    if (rank[p.mode] > previous) seen.push(p.mode);
    previous = rank[p.mode];
  }
  assert.deepEqual(seen, ["CUBIC", "CHAMFER", "DUAL"]);
});

test("seam keys depend on the edge, the origin and the policy", () => {
  const p = policy({ pxd: 1e6, vtx: 1e6, lx: 1e6, aq: 1e6, tick: 0 });
  assert.notEqual(seamKeyFor(p, "E", [0, 0]), seamKeyFor(p, "E", [32, 0]));
  assert.notEqual(seamKeyFor(p, "E", [0, 0]), seamKeyFor(p, "N", [0, 0]));
  assert.equal(seamKeyFor(p, "E", [0, 0]), seamKeyFor(p, "E", [0, 0]));
});
