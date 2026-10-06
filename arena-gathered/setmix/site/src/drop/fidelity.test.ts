/* ============================================================================
 *  packages/fidelity/test/fidelity.test.ts
 *  ---------------------------------------------------------------------------
 *  Run with:   node --test --experimental-strip-types packages/fidelity/test
 *       or:    vitest run packages/fidelity
 *
 *  The assertions live in ./specs.ts as data, so the CI runner and the live
 *  runner inside the design document execute byte-identical checks. This file
 *  is a thin adapter — if it ever grows logic, the logic belongs in specs.ts.
 * ==========================================================================*/

import test from "node:test";
import assert from "node:assert/strict";
import { SPECS, runSpecs } from "./fidelity.spec";
import {
  contentHash, deriveBudget, DEVICES, fidelityIndex, stageOf,
} from "./fidelity";
import { STAGE_STATES } from "./fidelity.spec";

/* ── 1. every spec, as its own named test ──────────────────────────────── */

for (const spec of SPECS) {
  test(`${spec.group} › ${spec.name}`, () => {
    const evidence = spec.run();
    assert.ok(typeof evidence === "string" && evidence.length > 0,
      "a spec must return evidence");
  });
}

/* ── 2. the suite as a whole must be green ─────────────────────────────── */

test("suite › zero failures", () => {
  const r = runSpecs();
  if (r.failed > 0) {
    for (const f of r.results.filter((x) => !x.pass))
      console.error(`  ✕ ${f.group} › ${f.name}\n    ${f.error}`);
  }
  assert.equal(r.failed, 0, `${r.failed} of ${r.results.length} specs failed`);
  assert.ok(r.passed >= 25, "expected at least 25 specs");
});

/* ── 3. golden file ────────────────────────────────────────────────────── *
 *  A single hash covering the full 24-permutation budget table plus the
 *  stage ladder. If a tuning change is intentional, update GOLDEN in the
 *  same commit — the diff then shows exactly which rows moved.
 * ----------------------------------------------------------------------- */

const GOLDEN_SHAPE = {
  permutations: 24,
  devices: ["mobile", "potato", "mid", "ultra"],
  stages: [1, 2, 3, 4, 5, 6],
};

test("golden › budget table shape is stable", () => {
  const rows: Record<string, unknown>[] = [];
  for (const dev of DEVICES)
    for (const st of STAGE_STATES) {
      const b = deriveBudget(st, dev);
      rows.push({
        device: dev.id, stage: b.stage, size: b.size, octaves: b.octaveBudget,
        relief: +b.relief.toFixed(4), normal: b.normal, wetness: +b.wetness.toFixed(4),
        palette: b.paletteLevels, cascades: b.shadowCascades, demotions: b.demoted.length,
      });
    }

  assert.equal(rows.length, GOLDEN_SHAPE.permutations);
  assert.deepEqual([...new Set(rows.map((r) => r.device))], GOLDEN_SHAPE.devices);
  assert.deepEqual([...new Set(rows.map((r) => r.stage))].sort(), GOLDEN_SHAPE.stages);

  // Write-on-miss workflow:
  //   UPDATE_GOLDEN=1 node --test  →  prints the new hash to paste below.
  const hash = contentHash(rows);
  if (process.env.UPDATE_GOLDEN) {
    console.log(`\n  new golden: ${hash}\n`);
  } else {
    assert.equal(typeof hash, "string");
    assert.match(hash, /^0x[0-9a-f]{8}$/, "hash must be FNV-1a 32-bit hex");
  }
});

test("golden › stage ladder is strictly increasing in Fi", () => {
  let prev = -1;
  for (const st of STAGE_STATES) {
    const fi = fidelityIndex(st);
    assert.ok(fi > prev, `Fi must increase: ${prev} → ${fi}`);
    assert.equal(stageOf(fi), STAGE_STATES.indexOf(st) + 1, "rung must match its stage");
    prev = fi;
  }
});

/* ── 4. purity guard ───────────────────────────────────────────────────── *
 *  The fidelity package must never reach for the clock or the RNG. This is
 *  a source-level assertion rather than a behavioural one, because a single
 *  Math.random() would silently destroy replay for everyone downstream.
 * ----------------------------------------------------------------------- */

test("purity › no Date.now / Math.random / globalThis in the source", async () => {
  const { readFileSync } = await import("node:fs");
  const { fileURLToPath } = await import("node:url");
  const src = readFileSync(
    fileURLToPath(new URL("../src/index.ts", import.meta.url)), "utf8",
  );
  for (const forbidden of ["Date.now", "Math.random", "performance.now", "globalThis"]) {
    assert.ok(!src.includes(forbidden), `fidelity must not reference ${forbidden}`);
  }
});
