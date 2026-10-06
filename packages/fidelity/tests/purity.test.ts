// The fidelity sources must never read the clock or roll dice: one Math.random breaks every replay and save.
import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

test("no Date.now, Math.random, performance.now or globalThis in the sources", () => {
  const dir = fileURLToPath(new URL("../src/", import.meta.url));
  const files = readdirSync(dir).filter((f) => f.endsWith(".ts"));
  assert.ok(files.length >= 6);
  for (const file of files) {
    const source = readFileSync(dir + file, "utf8");
    for (const forbidden of ["Date.now", "Math.random", "performance.now", "globalThis", "new Date("]) {
      assert.ok(!source.includes(forbidden), `${file} uses ${forbidden}`);
    }
  }
});
