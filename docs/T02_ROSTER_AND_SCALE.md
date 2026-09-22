# T02 — Dynamic Roster And Scale-Safe Runtime Plumbing

Status: implemented on this branch. Issue: [#35](https://github.com/Piskriek/HeavyMetal2/issues/35).
Builds directly on the frozen T01 contracts (`src/game/contracts/`, `docs/CONTRACTS.md`).

The game now supports explicit fields of **4 / 20 / 50 / 100** participants while the
four-racer path stays bit-identical to the legacy build: same lanes, pace, decision
ramp, launch fan, finish bonus, cup points and names. No unrelated pace or balance
change ships with this ticket.

## Roster and identity

- `src/game/roster.ts` (pure, DOM-free) owns roster construction and every former
  four-racer formula.
- `buildRoster(fieldSize, playerLoadout)` returns dense IDs `0..N-1`; the local player
  is always `PLAYER_ID = 0`, independent of array order.
- The engine keeps a `createRacerRegistry()` lookup (T01 identity contract) and resolves
  the player through `registry.indexOf(PLAYER_ID)` — never `racers[0]` as an identity
  assumption. Every legacy `if (!racer.id)` guard became `racer.isPlayer`.
- Four-racer fields reproduce `RACER_DEFINITIONS` exactly (lanes `[2, 0, 1, 3]`, colors,
  names, `opponentLoadouts()` mapping, pace `1`). Larger fields cycle the twelve
  rider/capsule combinations, name CPUs `RIDER NN` for unique HUD rows, and take a
  bounded ±2.5% deterministic pace spread.
- Large fields stack the starting grid in rows behind the launch line
  (`GRID_ROW_SPACING = 90`; four racers per row, one lane each) so lane-mates never
  spawn inside each other. The legacy grid sits on the line, unchanged.

## Scale-safe runtime state

| Legacy assumption | Replacement | File |
| :-- | :-- | :-- |
| `hitMask \|= 1 << racerId` (wraps at 32) | `recordObstacleHit()` → `obstacle.hitBy: Set<RacerId>` | `roster.ts`, `scene.ts`, `engine.ts` |
| `Float64Array(16)` pair cache, `i * 4 + j` | `Map` keyed by `pairKey(idA, idB) = min·2²⁰ + max` | `roster.ts`, `engine.ts` |
| Pair cache lives forever | Entries expire after the 0.38 s cooldown; pruned every 0.5 s of run time; cleared on reset | `engine.ts` |
| Fixed 4-mesh racer pool | `Renderer3D.setRacerCount(n)` grows on demand, disposes materials on shrink, shares canvas-keyed textures, disposes everything in `destroy()` | `renderer-3d.ts`, `renderer.ts` |
| `createRacers()` maps 4 definitions | Field-size aware builder with registry validation | `racers.ts` |
| `(4 - position) * 500` finish bonus | `finishPositionBonus()` — same four values, scales to N | `roster.ts`, `engine.ts` |
| Cup table indexed by place | `roundPointsFor()`: frozen `[9, 6, 3, 1]` at four; `max(0, 10 - place)` (top nine score 9..1) above; DNF always 0 | `session.ts` |
| `lastPlace: 5` tiebreak | `fieldSize + 1` | `session.ts` |
| Trackbar draws every racer | `trackbarRacers()` bounded to 12 pips (player + leaders + nearest rivals) | `roster.ts`, `RaceScreen.tsx` |
| Results render every row | `resultRows()` bounded to 24 rows with an explicit "Showing X of N — every place kept" note | `roster.ts`, `RoundResult.tsx` |

## RNG streams

`src/game/rng.ts` provides two separated mulberry32 streams:

- **Gameplay** — seeded from the session seed (`session.seed`, persisted in the save);
  draws the pinball-spinner kick inside a fixed step. `engine.reset(seed?)` reseeds it
  explicitly, so the same seed replays the same race (the `SimulationAdapter` path uses
  exactly this: `runHeadless({ config }) → adapter.reset(config.seed)`).
- **Cosmetic** — seeded from the clock; particles and record-ID suffixes only. No
  simulation code reads it, so it can never desync a replay.
- The legacy `randomAt(id, time)` shove check in `driveCPU` stays a pure function of
  identity and run time — deterministic and alias-free by construction.

## AI staggering and tick rate

The physics tick is untouched: `FIXED_STEP = 1/120`, `TICK_RATE = 120`
(asserted in `tests/roster-scale.test.ts`). Decision timing scales instead:

- Four racers keep the exact legacy ramp `0.35 + id * 0.11` initial and
  `reaction + id * 0.023` per decision.
- Larger fields hash identity into fixed windows: initial ≤ 0.9 s, per-decision
  stagger < 0.3 s, player always 0. A 100-racer field never waits on racer 99.
- Bump processing stays correct at 100 racers (4,950 pairs) with the pruned cooldown
  map replacing the aliased 16-slot table.

## Field size UI and qualifying

- Step 3 of setup offers **4 / 20 / 50 / 100 racers** (`FIELD_SIZES` from the config
  contract). The selection persists through `RaceSetup.fieldSize` → session → save.
- Above four, the UI states the contract rule: *qualifying is required*; hydration
  repairs any stored "disabled" flag (`normalizeRaceConfig` from T01 rejects a
  large field without qualifying). The qualifying **heat flow itself** belongs to
  T04/T06 as scheduled in `docs/CONTRACTS.md` — this ticket records, enforces and
  surfaces the requirement, and does not fake a qualifying session.
- `RaceSetup` gained `fieldSize`; `RaceSession`/`RaceConfig` gained `seed`
  (from `createSession`). Legacy saved setups hydrate as `fieldSize: 4`.

## Persisted results: explicit versioned summary policy

localStorage cannot hold 3 × 100-row standings forever, so truncation is explicit:

- `RESULT_SUMMARY_POLICY = { version: 1, keepTop: 12 }` (`save.ts`).
- `summarizeRecord()` keeps the top 12 **plus the player's row** and stamps
  `opponentsSummary: { policy, totalField, kept }`. It is idempotent and never
  touches four-racer records.
- `writeSave()` and the Hall of Chaos writer (`recordsForStorage`) summarise the
  *storage copy* only; in-memory sessions keep every row.
- Hydration accepts a short list **only** with a recognised marker that matches the
  field size; an unmarked short list is rejected as silent truncation (the round
  reports as dropped and must be raced again — honest, never silently degraded).
  Unknown policy versions are also rejected rather than guessed at.
- The full standings still round-trip for any field whose list fits the policy.

## Headless stepping seam (T01's first task for T02)

```ts
engine.stepOnce(commands)   // one fixed step: validate → dedupe → apply → step
engine.applyCommands(cmds)  // validateCommand + dedupeCommands against the heat gate
engine.observe()            // { distance, speed, position, runTime }
createEngineAdapter(engine) // SimulationAdapter for runHeadless / HeatController
engine.reset(seed?)         // explicit RNG reset for same-seed replay
```

The `frame()` accumulator loop now calls `stepOnce()`; visual behaviour is unchanged.

## Verification

- `npx tsc --noEmit` — clean.
- `node scripts/check.mjs` — **145/145** tests (39 contract, 23 safeguard, 25 new
  `tests/roster-scale.test.ts` acceptance checks, plus the existing suites).
- `npm run build` — green, 1,458.52 kB / 402.38 kB gzip.
- `node tests/ui-frame-check.mjs` — green (frame/overflow checks).
- Acceptance mapping: unique IDs + stable player at 4/20/50/100 ✅ · no aliasing at
  32/33/64/100 (pair-key uniqueness over all 4,950 pairs; Set ledger proves racer 33
  cannot light racer 1, unlike `1 << 33`) ✅ · mesh/texture disposal implemented via
  the owned pool (WebGL disposal cannot execute in this environment — the bundled
  Chromium exposes no WebGL context, as recorded by the T00 baseline) ✅ · legacy
  compatibility pinned by formula tests, 145/145 green without pace/balance edits ✅ ·
  HUD bounded (12 pips / 24 rows with explicit counts) ✅.
