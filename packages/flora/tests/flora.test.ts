// @hm/flora against its own claims: growth is a pure function of time, climate scales the clock (not the plant),
// branches unfold in order, scattering is deterministic, the water cycle stays in range.
import test from "node:test";
import assert from "node:assert/strict";
import {
  FLORA_STRIDE, SPECIES, bezier, buildSkeleton, evaluatePlant, growthRate, initialCycle, makeWake, packFloraInstances,
  relaxWake, scatterCell, stampWake, stepCycle, type Climate, type FloraSeed,
} from "../src";

const LUSH: Climate = { moisture: 0.8, light: 0.9, temperature: 20, exposure: 0 };
const seed = (species: FloraSeed["species"], variant = 0.5): FloraSeed => ({ x: 0, z: 0, plantedAt: 0, species, variant, cartridgeHash: "test" });

test("a plant only grows: height never falls as time passes, and it reaches full size", () => {
  for (const species of Object.keys(SPECIES) as FloraSeed["species"][]) {
    // kelp lives in water: it needs moisture above its 0.85 floor
    const climate = species === "ALIEN_KELP" ? { ...LUSH, moisture: 1 } : LUSH;
    let previous = -1;
    for (let t = 0; t <= 3000; t += 25) {
      const st = evaluatePlant(seed(species), t, 0, climate);
      assert.ok(st.heightM >= previous - 1e-9, `${species} shrank at ${t}s`);
      previous = st.heightM;
    }
    const grown = evaluatePlant(seed(species, 0.5), 3000, 0, climate);
    assert.ok(grown.scale > 0.95, `${species} never matured`);
    assert.ok(Math.abs(grown.heightM - SPECIES[species].maxHeight) < SPECIES[species].maxHeight * 0.05);
  }
});

test("climate scales the clock: half the growth rate for twice as long is the same plant", () => {
  const p = SPECIES.TREE;
  const full: Climate = { moisture: 1, light: 1, temperature: 22, exposure: 0 };
  const rate = growthRate(p, full);
  assert.ok(rate > 0.9);
  const half: Climate = { ...full, exposure: 1 }; // exposure takes 35% off the rate
  const slow = growthRate(p, half);
  const a = evaluatePlant(seed("TREE"), 200, 0, full), b = evaluatePlant(seed("TREE"), (200 * rate) / slow, 0, half);
  assert.ok(Math.abs(a.heightM - b.heightM) < 1e-9);
});

test("too dry or too dark, a plant does not grow at all", () => {
  const dry: Climate = { moisture: 0, light: 1, temperature: 20, exposure: 0 };
  assert.equal(growthRate(SPECIES.TREE, dry), 0);
  assert.ok(evaluatePlant(seed("TREE"), 10_000, 0, dry).heightM < 0.01);
});

test("the skeleton: a trunk from the ground to the top, then branches that unfold in order as it grows", () => {
  assert.deepEqual(buildSkeleton(seed("TREE"), evaluatePlant(seed("TREE"), 0, 0, { ...LUSH, moisture: 0 })), []);
  let previous = 0;
  for (const t of [100, 150, 200, 300, 600]) {
    const st = evaluatePlant(seed("TREE"), t, 0, LUSH);
    const branches = buildSkeleton(seed("TREE"), st);
    assert.ok(branches.length >= 1);
    const trunk = branches[0]!;
    assert.deepEqual(trunk.p0, [0, 0, 0]);
    assert.ok(Math.abs(trunk.p3[1] - st.heightM) < 1e-9, "the trunk reaches the top");
    assert.deepEqual(bezier(trunk, 0), trunk.p0);
    assert.ok(Math.abs(bezier(trunk, 1)[1] - trunk.p3[1]) < 1e-9);
    assert.ok(branches.length >= previous, "branches only ever appear");
    assert.ok(branches.length <= SPECIES.TREE.maxBranches + 1);
    previous = branches.length;
  }
  assert.ok(previous > 10, "a grown tree has branches");
});

test("scattering is the same every time, stays in its cell, and follows the density", () => {
  const dense = () => 1, sparse = () => 0.25, none = () => 0;
  const a = scatterCell(3, -2, 16, 7, dense, () => "TREE", "h");
  const b = scatterCell(3, -2, 16, 7, dense, () => "TREE", "h");
  assert.deepEqual(a, b);
  for (const s of a) assert.ok(s.x >= 48 && s.x <= 64 && s.z >= -32 && s.z <= -16, "a seed left its cell");
  assert.equal(scatterCell(0, 0, 16, 7, none, () => "TREE", "h").length, 0);
  let thick = 0, thin = 0;
  for (let i = 0; i < 40; i++) { thick += scatterCell(i, 1, 16, 9, dense, () => "SHRUB", "h").length; thin += scatterCell(i, 1, 16, 9, sparse, () => "SHRUB", "h").length; }
  assert.ok(thick > thin * 2, `dense ${thick}, sparse ${thin}`);
});

test("packing writes 8 numbers a plant and skips seedlings too small to see", () => {
  const seeds = scatterCell(0, 0, 16, 1, () => 1, () => "TREE", "h");
  const out = new Float32Array(seeds.length * FLORA_STRIDE);
  const n = packFloraInstances(seeds, 5000, () => LUSH, () => 2, out);
  assert.ok(n > 0 && n <= seeds.length);
  assert.equal(out[1], 2, "plants stand on the ground");
  assert.ok(out[3]! > 1, "a grown tree is taller than a metre");
  assert.equal(packFloraInstances(seeds, 0, () => LUSH, () => 0, out), 0, "nothing shows the moment it is planted");
});

test("the water cycle stays in range and a lit, wet world grows biomass", () => {
  let c = initialCycle();
  const wet = { pxd: 1e8, vtx: 9e7, lx: 6e7, aq: 4e7, tick: 0 };
  for (let i = 0; i < 2000; i++) {
    c = stepCycle(c, wet, 0.5);
    for (const v of [c.humidity, c.cloud, c.soilMoisture, c.surfaceWater, c.biomass]) assert.ok(v >= 0 && v <= 1 && Number.isFinite(v));
  }
  assert.ok(c.biomass > initialCycle().biomass * 5, `biomass ${c.biomass}`);
  const dry = stepCycle(initialCycle(), { pxd: 1e3, vtx: 1e3, lx: 1e2, aq: 0, tick: 0 }, 0.5);
  assert.equal(dry.surfaceWater, 0);
});

test("grass flattens where something walks and springs back", () => {
  const w = makeWake();
  stampWake(w, 0, 0, 2);
  const centre = (w.res / 2) * w.res + w.res / 2;
  assert.ok(w.data[centre]! > 0.9);
  relaxWake(w, 5);
  assert.ok(w.data[centre]! < 0.2);
});
