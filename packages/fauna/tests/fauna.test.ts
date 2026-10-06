// @hm/fauna against its own claims: herds follow the plants and the water, predators thin their prey, the field never
// goes negative, the animals you see are the same for everyone, legs keep their length.
import test from "node:test";
import assert from "node:assert/strict";
import { FAUNA, makeField, materialise, poseCreature, steerCreature, stepField, totalPopulation, type AgentCtx, type DensityField, type EcoCtx } from "../src";

const green = (aq: number): EcoCtx => ({ biomass: () => 0.9, water: () => 0.8, aq, dtHours: 0.05 });
const run = (f: DensityField, ctx: EcoCtx, steps: number): DensityField => { for (let i = 0; i < steps; i++) f = stepField(f, ctx); return f; };

test("a green, wet world fills with herds; a dry one stays empty", () => {
  const lush = run(makeField(12, 512), green(0.9), 400);
  const dead = run(makeField(12, 512), { ...green(0), biomass: () => 0, water: () => 0 }, 400);
  assert.ok(totalPopulation(lush, "MOON_STRIDER") > 100, `striders ${totalPopulation(lush, "MOON_STRIDER")}`);
  assert.equal(totalPopulation(dead, "MOON_STRIDER"), 0);
});

test("the field never goes negative or blows up, and repeats exactly", () => {
  const a = run(makeField(10, 512), green(0.9), 600), b = run(makeField(10, 512), green(0.9), 600);
  for (const id of Object.keys(FAUNA) as (keyof typeof FAUNA)[]) {
    for (const v of a.n[id]) assert.ok(v >= 0 && Number.isFinite(v));
    assert.deepEqual(a.n[id], b.n[id]);
    // never far above the carrying capacity
    assert.ok(Math.max(...a.n[id]) <= FAUNA[id].K * 0.262 * 1.6 + 1, `${id} overshot`);
  }
});

test("species need enough water to exist at all", () => {
  const shallow = run(makeField(8, 512), green(0.3), 400);
  assert.ok(totalPopulation(shallow, "MOON_STRIDER") > 10);
  assert.equal(totalPopulation(shallow, "GLIMMER_SHOAL"), 0, "fish need Aq above 0.5");
});

test("predators thin their prey", () => {
  const withMantas = run(makeField(8, 512), green(0.9), 800);
  const f = makeField(8, 512);
  let noMantas = f;
  for (let i = 0; i < 800; i++) { noMantas = stepField(noMantas, green(0.9)); noMantas.n.SKY_MANTA.fill(0); }
  assert.ok(totalPopulation(withMantas, "SKY_MANTA") > 0);
  assert.ok(totalPopulation(withMantas, "MOON_STRIDER") < totalPopulation(noMantas, "MOON_STRIDER"));
});

test("the animals you see are the same every time, near you, and only where the herd is", () => {
  const f = run(makeField(12, 512), green(0.9), 400);
  const ground = () => 1;
  const a = materialise(f, "MOON_STRIDER", 3000, 3000, ground, 300), b = materialise(f, "MOON_STRIDER", 3000, 3000, ground, 300);
  assert.ok(a.length > 0);
  assert.deepEqual(a, b);
  for (const c of a) assert.ok(Math.hypot(c.x - 3000, c.z - 3000) <= 300 && c.y === 1);
  assert.equal(materialise(makeField(12, 512), "MOON_STRIDER", 3000, 3000, ground).length, 0);
});

test("a creature keeps to its speed and runs from a threat", () => {
  const f = run(makeField(12, 512), green(0.9), 400);
  const c = materialise(f, "MOON_STRIDER", 3000, 3000, () => 0, 300)[0]!;
  const ctx: AgentCtx = { biomass: () => 0.9, water: () => 0.5, heightAt: () => 0, timeOfDay: 0.5, threats: [{ x: c.x - 5, z: c.z, loudness: 1 }], dt: 0.05 };
  let s = steerCreature(c, [], ctx);
  assert.equal(s.state, "FLEE");
  for (let i = 0; i < 200; i++) s = steerCreature(s, [], ctx);
  // out of range it goes back to its business, well away from the threat
  assert.ok(s.x > c.x + 10, "it ran away from the threat");
  assert.ok(Math.hypot(s.vx, s.vz) <= FAUNA.MOON_STRIDER.speedMs * 1.6 + 1e-9);
});

test("legs keep their length and planted feet stand on the ground", () => {
  const f = run(makeField(12, 512), green(0.9), 400);
  const ground = (x: number, z: number) => Math.sin(x * 0.1) + Math.cos(z * 0.1);
  for (const id of ["MOON_STRIDER", "CRYSTAL_TORTOISE"] as const) {
    const c = { ...materialise(f, id, 3000, 3000, ground, 300)[0]!, vx: 2, vz: 0 };
    const pose = poseCreature(c, ground);
    assert.equal(pose.legs.length, FAUNA[id].legs);
    const bone = FAUNA[id].legLenM * 0.5;
    for (const leg of pose.legs) {
      const d1 = Math.hypot(leg.knee[0] - leg.hip[0], leg.knee[1] - leg.hip[1], leg.knee[2] - leg.hip[2]);
      assert.ok(Math.abs(d1 - bone) < 1e-6, `${id} thigh ${d1} not ${bone}`);
      if (leg.planted) assert.ok(Math.abs(leg.foot[1] - ground(leg.foot[0], leg.foot[2])) < 1e-9);
    }
  }
  const manta = poseCreature({ ...materialise(f, "MOON_STRIDER", 3000, 3000, () => 0, 300)[0]!, id: "SKY_MANTA" }, () => 0);
  assert.equal(manta.legs.length, 0);
  assert.ok(manta.bodyY > 4, "mantas fly");
});
