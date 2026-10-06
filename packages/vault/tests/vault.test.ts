// The vault on our texgraph: the Arena drop claimed its 50 cartridges "run right now"; on ours 0 of 50 did.
// These tests hold the ported versions to it: valid, seamless, not flat, certified on every tier, knobs that point somewhere.
import test from "node:test";
import assert from "node:assert/strict";
import { evaluateGraph, validateGraph } from "@hm/texgraph";
import { DEVICES, adaptGraph, certify, deriveBudget, fuse, type FidelityState } from "@hm/fidelity";
import { CATEGORIES, SPECS, VAULT, VAULT_BY_ID, stripesAt } from "../src";

test("50 cartridges with unique ids, from 50 specs", () => {
  assert.equal(SPECS.length, 50);
  assert.equal(VAULT.length, 50);
  assert.equal(VAULT_BY_ID.size, 50);
  for (const c of VAULT) assert.ok(CATEGORIES.includes(c.category), `${c.id}: ${c.category}`);
});

/** The mean step across each column boundary (the last one is the wrap back to column 0). */
function columnSteps(data: Float32Array, size: number, channels: number): number[] {
  const steps: number[] = [];
  for (let x = 0; x < size; x++) {
    const next = (x + 1) % size;
    let total = 0;
    for (let y = 0; y < size; y++) for (let c = 0; c < channels; c++) total += Math.abs(data[(y * size + next) * channels + c]! - data[(y * size + x) * channels + c]!);
    steps.push(total / (size * channels));
  }
  return steps;
}

/** The image turned a quarter, so rows can be checked as columns. */
function transpose(data: Float32Array, size: number, channels: number): Float32Array {
  const out = new Float32Array(data.length);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) for (let c = 0; c < channels; c++) out[(x * size + y) * channels + c] = data[(y * size + x) * channels + c]!;
  return out;
}

test("every cartridge is a valid texture graph that tiles and is not flat", () => {
  for (const c of VAULT) {
    const check = validateGraph(c.graph);
    assert.ok(check.ok, `${c.id}: ${check.errors.join("; ")}`);
    const t = evaluateGraph(c.graph, { size: 48, seed: 1 });
    assert.ok(t.albedo && t.height && t.roughness, `${c.id} is missing an output`);
    let min = Infinity, max = -Infinity;
    for (const v of t.albedo) { if (v < min) min = v; if (v > max) max = v; }
    assert.ok(max - min > 0.05, `${c.id} albedo is flat (${(max - min).toFixed(3)})`);
    // grids and hard stripes line up with the tile's edge, so the wrap is one of their joints (an average-based check
    // calls that a seam): the wrap may be as sharp as the sharpest step inside the tile, no sharper. A texture that does
    // not tile steps at the wrap far more than smooth noise ever steps inside.
    for (const image of [t.albedo, transpose(t.albedo, 48, 3)]) {
      const steps = columnSteps(image, 48, 3);
      const wrap = steps[47]!, inside = Math.max(...steps.slice(0, 47));
      assert.ok(wrap <= inside * 1.1 + 0.02, `${c.id} wraps sharper (${wrap.toFixed(3)}) than any step inside (${inside.toFixed(3)})`);
    }
  }
});

test("the seam check catches a texture that does not tile", () => {
  // a ramp across the whole tile: smooth inside, a full jump at the wrap
  const t = evaluateGraph({ id: "bad", name: "bad", nodes: [
    { id: "s", type: "stripes", count: 1, softness: 1, vertical: true },
    { id: "half", type: "levels", in: "s", inLow: 0, inHigh: 1, gamma: 1, outLow: 0, outHigh: 1 },
    { id: "r", type: "ramp", in: "half", stops: [{ at: 0, r: 0, g: 0, b: 0 }, { at: 1, r: 1, g: 1, b: 1 }] },
  ], out: { albedo: "r" } }, { size: 48 });
  // shift the image half a tile sideways and cut it, which plants a jump at the wrap
  const cut = new Float32Array(t.albedo!.length);
  for (let y = 0; y < 48; y++) for (let x = 0; x < 48; x++) for (let c = 0; c < 3; c++) cut[(y * 48 + x) * 3 + c] = x < 24 ? 0 : t.albedo![(y * 48 + x) * 3 + c]!;
  const steps = columnSteps(cut, 48, 3);
  assert.ok(steps[47]! > Math.max(...steps.slice(0, 23)) * 1.1 + 0.02, "the check must see the planted jump");
});

test("every checkerboard has even counts (an odd one cannot tile)", () => {
  for (const c of VAULT) {
    for (const n of c.graph.nodes) {
      if (n.type !== "checker") continue;
      assert.equal((n.countX as number) % 2, 0, `${c.id}.${n.id}`);
      assert.equal((n.countY as number) % 2, 0, `${c.id}.${n.id}`);
    }
  }
});

test("every cartridge passes the export check on every tier", () => {
  for (const c of VAULT) {
    for (const d of DEVICES) {
      const cert = certify(c, d);
      assert.ok(cert.pass, `${c.id}@${d.id}: ${cert.failures.join("; ")}`);
    }
  }
});

test("every cartridge adapts to a valid graph at every stage on the minimum spec and the top tier", () => {
  const states: FidelityState[] = [2, 3.5, 5, 6.2, 7, 8.1].map((e) => {
    const v = Math.pow(10, e);
    return { pxd: v * 1.3, vtx: v, lx: v * 0.7, aq: v * 0.4, tick: 0 };
  });
  for (const c of VAULT) {
    for (const d of [DEVICES[0]!, DEVICES[1]!, DEVICES[4]!]) {
      for (const s of states) {
        const check = validateGraph(adaptGraph(c.graph, deriveBudget(s, d)));
        assert.ok(check.ok, `${c.id}@${d.id}: ${check.errors.join("; ")}`);
      }
    }
  }
});

test("every knob points at a number on a node of its own graph", () => {
  for (const c of VAULT) {
    assert.ok(c.vars.length >= 1 && c.vars.length <= 8);
    for (const v of c.vars) {
      const [nodeId, param] = v.path.split(".");
      const node = c.graph.nodes.find((n) => n.id === nodeId);
      assert.ok(node, `${c.id}: ${v.path} points at no node`);
      assert.equal(typeof node[param!], "number", `${c.id}: ${v.path} is not a number`);
      assert.ok(v.def >= v.min && v.def <= v.max, `${c.id}: ${v.path} starts outside its range`);
    }
  }
});

test("a cartridge is never usable before its stage, and the first tier has starters", () => {
  for (const c of VAULT) assert.ok(c.minStage <= c.tier, `${c.id}: stage ${c.minStage} > tier ${c.tier}`);
  assert.ok(VAULT.filter((c) => c.tier === 1).length >= 3);
});

test("every pair of vault cartridges fuses into a valid graph", () => {
  for (const a of VAULT) {
    for (const b of VAULT) {
      const { child } = fuse(a, b, 0.5);
      const check = validateGraph(child.graph);
      assert.ok(check.ok, `${a.id} x ${b.id}: ${check.errors.join("; ")}`);
    }
  }
});

test("angled stripes become whole counts on both axes", () => {
  assert.deepEqual(stripesAt(11, 0, 0.72), { count: 11, tilt: 0, vertical: true, softness: 1 - 0.72 });
  const steep = stripesAt(18, 78, 0);
  assert.equal(steep.vertical, false);
  assert.equal(steep.count, 18);
  assert.equal(steep.tilt, 4);
});
