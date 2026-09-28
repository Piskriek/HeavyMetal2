# T02 — dynamic roster and scale-safe runtime plumbing

**Status: recovered implementation; draft, not full acceptance of #35.**
See [T02_RECOVERY.md](T02_RECOVERY.md) for export provenance, current verification,
and gaps discovered during recovery. This document replaces the exported agent's
claims of bit-identical gameplay and completed qualifying enforcement.

## Recovered implementation

- `roster.ts` builds fields of **4 / 20 / 50 / 100**, with dense IDs `0..N-1`.
  Player ID is `0`. `createRacers` preserves the four-racer lane/loadout/name,
  pace, launch-offset and decision-time formulas covered by the tests.
- Larger grids use rows of four, 90 units apart, numbered CPU names and bounded
  pace variation. Physics stays at 120 Hz; larger fields use bounded AI staggering.
- Obstacle hits use `Set<RacerId>` instead of racer-ID bit shifts. Collision pair
  keys are `minId * 2^20 + maxId` (safe for the generated IDs, not a universal
  arbitrary-ID encoding). Cooldowns expire after 0.38 s and are pruned every 0.5 s.
- Gameplay pinball randomness uses a seeded resettable generator; particle and
  record-ID randomness use a separate cosmetic stream. Legacy AI's `randomAt`
  remains a pure function of ID and simulation time.
- `Renderer3D.setRacerCount` grows/shrinks the mesh pool. Each slot owns its material;
  canvas-keyed textures have reference counts and are disposed on last release.
  Shared sphere/shadow/shield resources are retained for reuse, disposed on teardown.
  Loadout/rim canvas baking is deduplicated.
- The trackbar selects at most 12 pips; results select at most 24 rows, retaining the
  player. Labels disclose display limits and distinguish old partial saves.
- Legacy cup points remain `[9, 6, 3, 1]`; above four, positions 1–9 earn 9–1 points,
  with remaining positions and DNFs earning zero. The setup displays the right rule.

## Persistence correction made during recovery

`RESULT_SUMMARY_POLICY = { version: 1, keepTop: 12 }` keeps the top 12 plus the
player and stamps `opponentsSummary: { policy, totalField, kept }`.

This policy is now **archive-only** (`recordsForStorage` for Hall of Chaos).
Authoritative event saves keep **every row**: cup ties, previous placements, and
zero-point racers cannot be reconstructed from a top-12 summary. Tests save and
reload every round at 4/20/50/100 racers and compare complete cup standings.

Recognized older summaries are still readable, with an explicit partial-standings
warning; final cup rank/winner claims are suppressed for those sessions. Missing
rows cannot be invented. Invalid/unknown markers are rejected even on full lists.
Unmarked short lists are rejected as before. Normal storage-quota error handling
remains in place; no silent fallback truncation is introduced.

## Qualifying and adapter limitations

The setup exposes all four field sizes. **Qualifying heats are not implemented or
required by the live launch path.** `qualifyingForField` and the separate frozen
config validator express the rule but are not integrated as a runtime gate. The UI
now explicitly labels larger fields experimental and discloses this limitation.

`stepOnce`, `applyCommands`, `observe`, and `createEngineAdapter` were recovered.
They do not make `GameEngine` DOM-free: construction still needs browser rendering.
Review also found that `stepOnce` lacks the frame loop's status/pause guards and
command gating is computed once per batch; some command types are no-ops. These
require further integration/testing before relying on the seam for replay.

The engine caches the player's dense index after registry construction. Generated
rosters are stable, but arbitrary in-place array reordering has not been validated.
Formula tests are not proof of bit-identical whole-engine replay or 100-racer pace.

## Current verification

- `npm run check`: app type-check plus **151/151 tests**, no failures/skips.
- `npm run build`: successful (1,459.22 kB HTML, 402.69 kB gzip).
- `node tests/ui-frame-check.mjs`: **40/40 checks**, at 578×760, 800×600,
  1920×1080 and 3840×2160, including the 100-racer selector and warning.
- `tests/racer-pool.test.ts`: production pool methods, real Three.js disposal
  events for 20/50/100 → 4 → original size → teardown, without creating WebGL.
  This verifies resource ownership calls, not GPU-driver behavior.
- No live 100-racer WebGL race, complete legacy replay comparison, or performance
  benchmark was run. Keep #35 open pending its remaining acceptance work.
