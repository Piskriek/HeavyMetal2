# Durable Events And Recovery (Part 4.1)

This document is the save contract for the tournament/session persistence added in Part 4.1.
`src/game/save.ts` implements it; `tests/session-save.test.ts` covers the recovery matrix.

## What Is Stored

Keys (all plain JSON in `localStorage`):

| Key | Contents |
| --- | --- |
| `goblin-rally-session-v1` | The current durable document (primary). |
| `goblin-rally-session-v1-backup` | The previous *valid* primary document, written just before an overwrite. |
| `goblin-rally-setup-v2` | Legacy last-setup key. Still written for compatibility and read once as a migration source. |
| `goblin-rally-options-v1`, `goblin-rally-records-v1` | Unchanged: display/audio settings and the top-20 completed race records. |

Document shape (`version: 1`):

```ts
{
  version: 1,
  revision: number,        // monotonic; increments on every real write
  savedAt: string,         // ISO timestamp
  phase: 'setup' | 'grid' | 'racing' | 'round-results' | 'cup-results',
  draft: RaceSetup,        // selected event options / last setup, always present
  session: { id, setup, rounds, round, roster, results } | null
}
```

A document with `phase: 'setup'` has `session: null` (draft only). Every other phase requires a session.
The `session` payload stores the selected event, the fixed roster/loadout, difficulty, the committed
results with their full finishing field, the current round index and the explicit phase. No `Set`,
canvas, engine object or function is ever persisted; only stable IDs and plain validated JSON.

## Phase Model

`setup → grid → racing → round-results → (grid | cup-results)`

- `setup`: only a draft selection exists. The menu offers New Game; nothing is mid-event.
- `grid`: an event is live at the starting grid of `session.round`, which has no committed result.
- `racing`: the same, but the engine was launched. This phase is what makes an interrupted round
  recoverable *as a restart*.
- `round-results`: `session.round` has a committed result and more rounds remain.
- `cup-results`: every round has a committed result.

Hydration never infers the phase from a mounted component, from `results.length` alone, or from the
presence of a React screen. `App.tsx` owns the phase; `RaceScreen` may only move it between `grid`
and `racing` while a round is live.

## Recovery Rules

Reads are total: `readSave()` never throws and always returns a usable draft, a phase and any notices.
Invalid data is repaired from canonical game data or dropped with a notice — never invented.

1. **All rounds committed** → `cup-results`; `session.round` is the final round.
2. **Current round committed (others open)** → `round-results`; the committed standings are restored.
3. **A round before the current one is unfinished** → progression is blocked: `session.round` moves
   back to the first open round, the phase becomes `grid`, and an explicit restart notice is returned
   ("… was never finished, so it restarts from the starting grid. Later rounds keep their saved results.").
   Result records for later rounds are preserved, never deleted or double-scored.
4. **The current round was `racing` or has no valid result** → `grid` at that round plus a notice
   ("… was interrupted before the finish. It restarts from the starting grid." or
   "No valid result was saved for … It must be raced again.").

Validation performed on read:

- Session must have a non-empty `id` and a non-empty list of distinct, known course IDs, otherwise the
  document is rejected and the backup/legacy path is tried.
- Tournaments must use the official three-round order; any other order is replaced with the Scrapdome
  order and reported. Quick races are reduced to a single round.
- Missing or malformed `setup` fields fall back per field; a malformed rider/capsule falls back to the
  default Rustbucket build with a notice.
- The roster is derived data (`opponentLoadouts`), so it is re-derived whenever it is missing, contains
  duplicate riders, does not start with the player's rider, or has non-deterministic capsules.
- A result is kept only when its `sessionId` matches, its round is in range, its course equals
  `rounds[round]`, its required numbers are finite, and its opponent field is a complete four-racer
  standings list (ids 0–3, positions 1–4). Duplicate rounds are dropped after the first. Counts of
  dropped and duplicate records are reported.
- `customPhysics` is only possible for a non-tournament event.

**Scope:** recovery is round-boundary only. There is no engine snapshot, so a reload during a race
restarts that round from the grid — the contract says so in the UI. Pretending to restore live physics
is explicitly out of scope.

## Writes

- **Atomic:** one `setItem` stores the whole document (phase + result together). A failed write leaves
  the previous document intact.
- **Idempotent:** a payload identical to the stored one is not rewritten and keeps its revision. This
  is what makes a duplicated commit harmless.
- **Non-destructive:** before overwriting, the previous primary document is copied to the backup slot,
  but only when it parses as a document of the current version. Corrupt text is never promoted.
- **Failing storage:** missing `localStorage`, a denied write (`SecurityError`), or a full quota
  (`QuotaExceededError`) all return `{ ok: false, error }`. The menu footer and the race header then
  say progress cannot be saved on this device. Nothing throws into the render path.
- **Idempotent round commits:** `commitRound` refuses a record whose session ID, round or course does
  not match, or whose round is already committed. `mergeRunRecord` replaces (never appends) a record
  with the same `sessionId:round`, so the Hall of Chaos cannot double-count a reloaded result.

## Migration

- `version !== 1` (a newer document) is reported as `unsupported`, is never rewritten, and the user is
  told the progress is from a newer version. The draft falls back to defaults.
- Documents of version 1 missing optional fields are repaired in place; the repaired document is
  written back on the next persist, with the previous copy left in the backup slot.
- If no version-1 document exists but `goblin-rally-setup-v2` does, the draft is imported from it
  (`source: 'legacy'`). A future schema bump must add a migration branch in `sanitizeDocument` and a
  new `SAVE_VERSION`, keeping version 1 readable for at least one release.

## Deliberate Non-Goals

- Mid-race engine snapshots (kinematics, AI timers, visited obstacles, RNG, camera).
- Persistent cup history/achievements (Part 4.3) and PNG art (Part 4.2).
- Multi-tab arbitration: two tabs share one key; last write wins and the revision counter keeps the
  order. This is recorded rather than solved, because the handoff scoped Part 4.1 to reload recovery.

## Verification

`npm run check` (= `node scripts/check.mjs`) runs `tsc --noEmit` and 18 focused tests covering:
completed/interrupted/committed/gap recovery, duplicate and mismatched results, malformed
loadout/roster/course order, out-of-range rounds, corrupt primary with a good backup, unsupported
future versions, legacy migration, write idempotency, backup promotion, denied storage, atomic
phase+result commits, and record merging.

`npm run check:browser` (= `node scripts/browser-check.mjs`) builds the app, serves `dist/`, and drives
the real UI in headless Chromium via `playwright-core` + `@sparticuz/chromium`. Its 21 checks cover the
reload flow end to end: a fresh browser stores `setup`; starting a cup through the UI persists
`phase: grid`, round 0, the Scrapdome order and a four-racer roster; launching persists `racing`; a
mid-race reload offers **Continue Tournament** with the restart explanation; resuming re-persists
`grid` without inventing a result; a completed cup restores its standings without rebuilding an engine
or duplicating results; a corrupt primary restores the backup; and denied storage is announced while
the game stays playable. Screenshots land in `tests/artifacts/`.

Still **not** verified: performance or FPS under recovery, mobile/touch reload behaviour, and the
full three-round playthrough with real physics finishes. Do not read compilation, unit tests or the
mocked-standings browser run as gameplay/balance/accessibility evidence; see the verification boundary
in `docs/EXPANSION_PROGRESS.md`.
