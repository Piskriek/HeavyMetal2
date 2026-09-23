# T02 recovery — 2026-09-22

## Provenance

- Recovery source: existing `temp/temp.zip`, SHA-256 `656bdaed6c0e6a5e02dd52dc6a255f3ac730bd9826a6d6ff24ed2ca6d3290031`.
- Current base: `12b6736`; all work stays on `arena/01a0ca08-heavymetal2`.
- Restored the exported source, contracts, tests, scripts, and documentation.
  No previous `.git` history or original local commits were present in the ZIP.
- Draft PR #47 already contains identical application source and tests from this
  ZIP (195 exported files match its head `227454fc` byte-for-byte). Its branch is
  not writable from this session; this branch provides a recovery against the
  current base and will be linked from #47.
- Did not import generated test artifacts, dependencies, builds, or overwrite
  existing art/track assets. The ZIP's orphan baseline manifest has no accompanying
  snapshot payload and is not restored as a certified backup. Its root track-layout
  JSON remains available in the original ZIP, untouched.
- The original agent's documentation is historical; verification below supersedes
  its unverified claims of complete acceptance and bit-identical gameplay.

## Verification

- Recovered checkpoint: `npm run check` **145/145**, production build successful.
- After regression fixes: `npm run check` **151/151**, app TypeScript check clean.
- `npm run build`: successful; 1,459.22 kB HTML / 402.69 kB gzip.
- `node tests/ui-frame-check.mjs`: **40/40** checks across four viewports, including
  100-racer selection, experimental notice, and horizontal-overflow checks.
- `git diff --check`: clean.
- Added tests first: texture release on shrink (20/50/100), full cup save/reload,
  and invalid summary markers all failed on the recovered checkpoint before fixes.
- No full WebGL race or full-engine deterministic replay was executed.

## Corrections made after recovery

1. Reference-count shared racer textures. Shrink releases a texture at its last
   user, retained racers keep their textures, regrowth creates fresh disposed slots,
   and teardown disposes shared geometry/materials once. The tests exercise actual
   production methods and Three.js disposal events without a WebGL constructor.
2. Preserve all event-session standings in storage. Keep summary v1 only for the
   Hall of Chaos archive; tournament rankings and histories now survive reload.
3. Reject invalid summary metadata even with a full list. Old valid summarized
   sessions remain readable with a warning; their UI does not claim a final cup rank.
4. Correct setup/result wording: large fields are experimental, qualifying is not
   implemented, displayed cup scoring matches the selected field, and summaries
   are not presented as complete standings.

## Remaining review findings / handoff

- `qualifyingForField()` is only a helper; the live session/engine does not run
  qualifying heats or enforce a qualifying gate. A UI note is not enforcement.
- The adapter still requires a browser-created engine. `stepOnce` does not retain
  the frame loop's status/pause guards; command gating is captured once per batch;
  some command types are ignored. These are integration work, not replay evidence.
- Player lookup caches a dense index after registry creation. Helper tests do not
  prove focus survives arbitrary in-place roster reordering.
- Four-racer formula tests pass, but no whole-engine bit-identical compatibility
  comparison or live 100-racer performance test was run.
- Missing backup snapshot payloads cannot be reconstructed from the ZIP's orphan
  manifest. Existing protected data/art were not changed. The exported root layout
  remains in the ZIP (139,747 bytes; SHA-256
  `83a4d097066b7c9d44536b779a23c8354039637df4b586b8c3171356fdbfac6b`).

## GitHub handoff

- Recovery and follow-up code: draft **#48**, head `arena/01a0ca08-heavymetal2`.
- Original draft **#47** is linked to #48, not force-pushed, closed, or merged.
- Do not merge both recovery PRs. Review #48 as the updated recovery against this
  main snapshot. Keep #35 open; recovering the export is not completing every
  acceptance criterion in its original transcript.
- Only source/tests/docs were added. Dependency/build folders and screenshots are
  ignored; no new art, dependency tree, generated bundle, or archive was committed.
