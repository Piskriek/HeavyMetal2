# T02 — Dynamic roster and scale-safe runtime plumbing (working plan)

Issue: https://github.com/Piskriek/HeavyMetal2/issues/35 — depends on T01 contracts (PR #46,
`src/game/contracts/`, `docs/CONTRACTS.md`). This branch is based on `pr/46`.

## Scope → implementation map

| Scope item | Where | How |
| :-- | :-- | :-- |
| 4/20/50/100 explicit participants | `src/game/roster.ts` (new) | `buildRoster()` + `buildRosterLoadouts()`; ids dense from 0, player is `PLAYER_ID = 0`; validated with `createRacerRegistry` from the identity contract |
| Preserve four-racer definitions/compat | `roster.ts`, `racers.ts` | `fieldSize === 4` reproduces `RACER_DEFINITIONS` lanes `[2,0,1,3]`, paces, `opponentLoadouts()` mapping, legacy stagger `0.35 + id*0.11` and `id*0.023`, launch offset `(id-2)*1.2`, bonus `(4-pos)*500`, cup points `[9,6,3,1]` — all exact |
| Remove count assumptions (arrays, mesh pools, interpolation, AI, standings, results, session) | `engine.ts`, `renderer-3d.ts`, `racers.ts`, `session.ts`, `save.ts`, `preferences.ts`, UI | Dynamic racer arrays everywhere; renderer mesh pool sized by field with disposal; cup points policy; N-aware save sanitizers |
| Replace racer-ID bit shifts with scalable state | `engine.ts` + `roster.ts` | `obstacle.hitMask |= 1 << id` → `recordObstacleHit()` storing a `Set<RacerId>`; pair-cooldown key `minId * 2**20 + maxId` (no shifts, no 32-bit wrap) |
| Stable identity independent of array order | `engine.ts` | Engine keeps a `RacerRegistry` + `playerId`; player resolved by ID lookup, every `!racer.id` check becomes an explicit player check |
| Bound pair-event cache lifetime | `engine.ts` | `Map<pairKey, runTime>` pruned of expired entries on a timer; cleared on reset |
| Separate gameplay RNG from cosmetic RNG | `src/game/rng.ts` (new) + `engine.ts` | mulberry32 streams; gameplay seeded from the session seed (pinball kicks), cosmetic seeded from the clock (particles, record ids); `randomAt()` stays a pure function of (id, time) for legacy AI |
| Explicit RNG reset for same-seed replay | `engine.ts` | `reset(seed?)` reseeds the gameplay stream from `config.seed` (default `DEFAULT_SEED`); adapter `reset(seed)` flows through `runHeadless` |
| Stagger AI without touching tick rate | `engine.ts` + `roster.ts` | `FIXED_STEP` unchanged (120 Hz); decision phase = bounded identity hash for fields > 4 (`boundedStagger`), legacy `id*0.023` at 4 |
| Field-size UI, qualifying required above four | `NewGameSetup.tsx`, `session.ts` | 4/20/50/100 selector; `qualifyingForField()` derives the contract rule (enabled > 4, disabled at 4) and is stored/validated; heat gameplay itself remains T04/T06 |
| Explicit versioned summary policy for persisted results | `save.ts`, `preferences.ts` | `RESULT_SUMMARY_POLICY = { version: 1, keepTop: 12 }`; `summarizeRecord()` marks `opponentsSummary`; sanitizers accept a marked summary and **reject** an unmarked short list — standings are never silently discarded |

## Acceptance → evidence plan

- Unique IDs / stable player focus at 4/20/50/100 → `tests/roster-scale.test.ts`
- No aliasing at 32/33/64/100 → pair-key uniqueness test + hit-ledger test (id 33 must not mark id 1, which `1 << 33` would)
- Mesh/texture disposal on count change → renderer pool owns its textures/materials; `disposeRacerPool()` on shrink/destroy; pure pool-planning helper unit-tested (no WebGL available in CI per T00 baseline)
- Legacy compatibility without pace/balance changes → roster/engine constant tests pin every four-racer formula
- Bounded high-count HUD → `trackbarRacers()`/`resultRows()` caps with explicit "showing X of N" notes

## Seam adoption (docs/CONTRACTS.md says this is T02's first task)

`GameEngine.stepOnce(commands)` extracted from the `frame()` accumulator loop;
`applyCommands()` validates through `validateCommand` + `dedupeCommands`;
`createEngineAdapter(engine)` implements `SimulationAdapter`.
