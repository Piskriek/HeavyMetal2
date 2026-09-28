# T01 — Frozen Shared Contracts And Integration Ownership

Status: **frozen for downstream tickets.** Owner: core architecture agent. Ticket: [#34](https://github.com/Piskriek/HeavyMetal2/issues/34).

`src/game/contracts/` is the shared language for T02–T12. The public surface is
`src/game/contracts/index.ts` (**`CONTRACTS_VERSION = 2`**). Tests: `tests/contracts.test.ts`
(40 checks, part of `npm run check`).

## The five rules

1. **Pure modules.** No DOM, no canvas, no three.js, no React, no I/O. Contracts may import
   each other plus the DOM-free data modules (`types.ts`, `loadouts.ts`, `session.ts`). That
   is what lets a heat be stepped in a plain Node test process.
2. **Effects are `fuel | shield | bounce`.** Mystery is a resolver, resolved exactly once at
   trigger time; the resolved effect is what is stored. `assertGameplayEffect('mystery')`
   throws, and a compile-time alias proves the set still matches `PowerupKind`.
3. **Identity is an ID, indices are lookup.** `createRacerRegistry` gives stable IDs and
   dense indices with no bit tricks (`1 << 32` wraps; IDs do not).
4. **The renderer writes nothing.** `createRenderView` returns deep-frozen plain data.
   Writing to it throws in strict mode, and the type is `DeepReadonly`.
5. **Refusals are typed.** Illegal transitions, commands, props, pickups and reservations
   return a `ContractError` with a stable `E_*` code or a discriminated result — never a
   silent repair and never a thrown string.

## Module map

| Module | Freezes | Key exports | Consumed by |
| :--- | :--- | :--- | :--- |
| `core.ts` | Error codes, `ContractError`, guards, `clamp` | `CONTRACTS_VERSION`, `ContractError` | all |
| `identity.ts` | Stable racer identity + dense lookup | `createRacerRegistry`, `RacerId` | T02, T04, T07, T09 |
| `config.ts` | Configuration defaults and legacy loading | `normalizeRaceConfig`, `validateRaceConfig`, `assertRaceConfig`, `FIELD_SIZES`, `DEFAULT_QUALIFYING` | T02, T04, T12 |
| `timing.ts` | Fixed-step tick timing | `FIXED_STEP`, `TICK_RATE`, `FixedStepClock` | T01 (engine), T04, T07, T11 |
| `effects.ts` | `fuel\|shield\|bounce`, mystery resolver, trigger vs resolved | `createPickupArbiter`, `createWeightedMysteryResolver` | T09 |
| `events.ts` | Typed gameplay event log | `RaceEvent`, `filterEvents`, `describeEvent` | T08–T12 |
| `qualifying.ts` | Results, fallback classes, gate validation, bounded staging | `rankQualifying`, `validateGateCrossing`, `cpuStagingDelay` | T04, T06 |
| `heat.ts` | Heat/participant transitions | `transitionHeat`, `advanceHeat`, `HeatController`, `LEGAL_HEAT_TRANSITIONS` | T05, T06, T12 |
| `props.ts` | Runtime prop registry schema | `createPropRegistry`, `RuntimePropDefinition`, `SCALE_CONVENTION` | T08, T09 |
| `release.ts` | Release corridor + reservations | `validateReleaseCorridor`, `createReservationLedger` | T05, T09, T12 |
| `dents.ts` | Dent slots, cap, recovery, read-only view | `applyDent`, `recoverDents`, `dentRenderView` | T09, T11 |
| `render.ts` | Read-only render frame | `createRenderView`, `deepFreeze`, `DeepReadonly` | T11, T12 |
| `commands.ts` | Typed commands instead of UI mutation | `validateCommand`, `dedupeCommands`, `CommandQueue`, `start` command, `sling_disabled` | T03, T05, T09 |
| `stepping.ts` | Headless stepping seam | `SimulationAdapter`, `runHeadless`, `HeatController` | T02, T04, T12 |

## Frozen decisions downstream tickets must not re-litigate

| Decision | Value / rule | Why it is fixed now |
| :--- | :--- | :--- |
| Tick rate | 120 Hz, `FIXED_STEP = 1 / 120`; stalls > 0.25 s are dropped, ≤ 30 ticks per frame | Two accumulated steps of the old `const STEP = 1 / 120` are now one source of truth |
| Field sizes | 4 / 20 / 50 / 100, `MAX_RACERS = 100` | T02's acceptance list |
| Qualifying | required above 4 participants, disabled at 4, 2 retries (3 attempts), 20 s deadline per attempt | Keeps the legacy four-racer path free of qualifying |
| Staging schedule | `cpuStagingDelay(slot, fieldSize)`, monotonic, identity-independent, capped at 2.5 s for every field size | The ticket explicitly forbids a delay that grows with the racer index |
| Fallback ranking | `dnf` → `invalid-crossing` → `deadline` → `retry-exhausted`, always after every valid entry | "Fallback results always rank behind valid results" |
| Pickup arbitration | same tick → earliest crossing fraction → lower racer ID; a better same-tick trigger wins outright, a later tick never can | T09's "crossing fraction then racer ID" |
| Mystery | resolved once per pickup; re-resolving returns the recorded effect; retries cannot re-roll | T04/T09 |
| Dent budget | 3 slots, `DENT_MAX_TOTAL_DEPTH = 18`, per-slot ≤ 10.8, exponential recovery at 0.35/s, 50% repair notice fires exactly once, impacts below severity 0.12 are cosmetic | T11's cap and exactly-once repair |
| Scale convention | `baked-extents`: extents are world units; a definition carrying both extents and a non-unit `scale` is rejected | T08's "scale and dimensions are not applied twice" |
| Heat phases | `staging → qualifying? → release → racing → settling → results → staging`; everything else is refused | T05/T06 |
| Commands | validated against `{ status, phase, inputEnabled, racerId, startMode? }`; identical repeats collapse and are never double-applied | T03/T05 input lifecycle |
| Start of a run | one `start` command; legal only while `status === 'ready'`, refused with `E_COMMAND` anywhere else. In `startMode: 'push'` the retired slingshot is refused as `{ ok: false, reason: 'sling_disabled' }`, which is the pattern every later "that control no longer exists" case copies | M01 · T1 retires the slingshot without deleting it |

## The headless stepping seam

```ts
interface SimulationAdapter {
  readonly id: string;
  readonly seed: number;
  reset(seed?: number): void;
  tick(index: number, step: number, commands: readonly GameCommand[]): void;
  observe?(): Readonly<Record<string, number>>;
}
```

`runHeadless` drives the adapter from an explicit frame-delta script
(`frameScript({ seconds, frameDelta, jitter })`) and returns ticks, simulated seconds and
dropped time. `HeatController` binds the phase machine to an adapter and keeps the event log.

**How `GameEngine` adopts this without a rewrite** (T02's first task):

```ts
const adapter: SimulationAdapter = {
  id: 'engine', seed,
  reset: () => engine.reset(),
  tick: (_index, _step, commands) => { engine.applyCommands(commands); engine.stepOnce(); },
  observe: () => ({ distance: engine.snapshot.distance, speed: engine.snapshot.speed }),
};
```

`engine.stepOnce()` does not exist yet: the current `frame()` owns the accumulator loop. T02
should extract that loop body into `stepOnce()` and implement `applyCommands` on top of
`validateCommand` + `dedupeCommands`, keeping the visual loop unchanged. Until then the seam
is exercised by `createNullAdapter()` and the contract tests, and by the phase machine.

## Version 2 — M01 · T1, the goblin push

`CONTRACTS_VERSION` moved from 1 to 2 in M01 · T1. The surface only grew; nothing v1 could do
was removed or reinterpreted, so every v1 call site keeps working.

| Addition | Shape | Meaning |
| :--- | :--- | :--- |
| `{ type: 'start' }` | `GameCommand` | Begin the run from the grid. Legal only while `status === 'ready'`; every other status refuses it with `E_COMMAND`. `Enter`, `Space` and the on-screen button all issue this one command. |
| `'pushing'` | `GameStatus` (src/game/types.ts) | The 48 fixed ticks (0.4 s) between the command and the first `'flying'` tick: the starter goblin owns `vx` and the pad owns the height. `steer`, `hop`, `bounce` and `boost` stay legal; `aim` and `launch` do not. |
| `gate.startMode?: 'push' \| 'sling'` | `CommandGate` | Absent or `'sling'` is the legacy slingshot envelope, byte-for-byte (this is what the regression path and the physics-parity fixture run). `'push'` refuses `aim`/`launch` with the typed reason `sling_disabled`. |

The refusal is `{ ok: false, code: 'E_COMMAND', reason: 'sling_disabled' }` — a typed reason, not
a silent drop, so the UI can say *why* the slingshot is gone. `E_PUSH_TICK` joins the
`ContractErrorCode` union for the push ramp's range check (`k` outside `1…48`).

## Engine touch in this ticket

`src/game/engine.ts` has exactly one change: `const STEP = 1 / 120` became
`const STEP = FIXED_STEP` (imported from `./contracts/timing`). Behaviour is identical; the
value is now single-sourced. This is the only file outside `contracts/`, `docs/` and `tests/`
that T01 modifies.

## Ownership rules (enforced socially, not by tooling)

- **One integration owner edits `engine.ts` at a time.** T01's engine change is landed and
  frozen; T02 is next in line.
- Likewise serialize `renderer-3d.ts`, `track-builder-3d.ts` and `TrackBuilderUI.tsx`.
- Pure modules (`contracts/**`, `qualifying`-style data modules, new test suites) can proceed
  concurrently against these interfaces without touching the serialized files.
- Anything that needs a new contract field must bump `CONTRACTS_VERSION`, update
  `docs/CONTRACTS.md` and extend `tests/contracts.test.ts` in the same change.

## Acceptance evidence (#34)

| Criterion | Evidence |
| :--- | :--- |
| Legal and illegal state transitions tested | `heat: the legal transition graph…`, `illegal transitions are refused…`, `four-racer heat … refuses to qualify`, `large field must qualify`, `release and finishing are once-only` |
| Old configs load as four racers with qualifying disabled | `config: an old setup loads as four racers…`, `hostile input is repaired…` |
| Snapshot reset does not share mutable arrays | `snapshot reset does not share mutable arrays with the previous state` |
| Repeated commands are harmless | `commands: repeated commands collapse and never double-apply`, `release and finishing are once-only and idempotent`, reservation `already-held` |
| Public contracts documented before downstream integration | this document; 40 contract tests green in `npm run check` |

Verified on this branch: `npx tsc --noEmit` clean · `node --import tsx --test tests/contracts.test.ts` → 40/40 · `npm run build` green (see `docs/archive/handoff-legacy.md`).
