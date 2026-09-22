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

Pending fresh test/build runs. The original source includes 145 tests.

## Review findings

- `qualifyingForField()` is only a helper; the live session/engine does not run
  qualifying heats or enforce a qualifying gate. A UI note is not enforcement.
- Shrinking the renderer pool disposes materials but retains unused textures
  until destroy. This needs correction for the count-change criterion.
- Session save summaries discard rows needed to reconstruct full cup standings
  after reload. The policy marker alone does not preserve tournament ties/history.
- The engine adapter still requires a browser-created engine; helper tests are
  not proof of full-engine deterministic replay or live 100-racer performance.

Do not close #35 on the strength of the recovered agent's report alone.
