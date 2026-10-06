// The recipe table as authored, with its gaps pinned: adding a missing ingredient as a cartridge must update this test.
import test from "node:test";
import assert from "node:assert/strict";
import { RECIPES, RECIPE_BY_ID, RECIPE_BY_OUT, VAULT, availableRecipes, missingIngredients, reachable } from "../src";

const VAULT_IDS = new Set(VAULT.map((c) => c.id));

test("100 recipes with unique ids and unique outputs", () => {
  assert.equal(RECIPES.length, 100);
  assert.equal(RECIPE_BY_ID.size, 100);
  assert.equal(RECIPE_BY_OUT.size, 100);
  for (const r of RECIPES) assert.ok(r.confidence >= 0 && r.confidence <= 100 && /^#[0-9a-f]{6}$/i.test(r.preview), r.id);
});

test("no recipe output collides with a vault cartridge", () => {
  for (const r of RECIPES) assert.ok(!VAULT_IDS.has(r.out), r.out);
});

test("the known gap: 9 ingredients exist nowhere, so 17 recipes can never be made", () => {
  const missing = missingIngredients(VAULT_IDS);
  assert.deepEqual(missing.map((m) => m.ingredient), [
    "altitude_mask", "curl_flow", "curvature_wear", "hexapod_walk", "kinematic_spring",
    "linear_strata_tool", "methane_fog", "photon_salt", "wind_erosion",
  ]);
  assert.equal(new Set(missing.flatMap((m) => m.recipes)).size, 17);
});

test("from the whole vault, 50 of the 100 outputs can be made; from the tier-1 starters, 1", () => {
  assert.equal([...reachable(VAULT_IDS).have].filter((id) => RECIPE_BY_OUT.has(id)).length, 50);
  const starters = new Set(VAULT.filter((c) => c.tier === 1).map((c) => c.id));
  assert.equal([...reachable(starters).have].filter((id) => RECIPE_BY_OUT.has(id)).length, 1);
  assert.equal(availableRecipes(starters).length, 1);
});
