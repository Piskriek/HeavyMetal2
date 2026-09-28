# M9: Seed Pinball Randomness and Route Engine Input Through Command Contracts

- **ID**: `M9`
- **Priority**: Medium
- **Component**: Determinism / Simulation Contracts / Command Pattern
- **Conflicts with**: None
- **Needs art**: No

---

## Goal
The simulation currently relies on unseeded `Math.random()` in two places: directly inside `GameEngine`'s step context (`src/game/engine.ts:202`) and for the pinball spinner bumper deflection in `src/game/sim/racer-physics.ts:308`, breaking replayability and deterministic validation across identical runs. Replace `Math.random()` with a seeded PRNG hash of `(seed, tick, racerId)`, and route all player inputs (steering, boost, bounce, pause, launch) through the typed command validation system in `src/game/contracts/commands.ts`.

---

## Evidence
- `src/game/engine.ts:202`:
  `random: () => Math.random(),`
  Exposes standard non-deterministic `Math.random()` directly to the physics simulation context.
- `src/game/sim/racer-physics.ts:306-308`:
  `case 'pinball_spinner': racer.vz = (ctx.random() > 0.5 ? 1 : -1) * 440;`
  Pinball spinner kick direction relies on non-deterministic randomness.
- `src/game/contracts/commands.ts:1-211`: Declares typed `GameCommand`, `CommandGate`, and validation verdicts (`allow` / `deny`), but `GameEngine` still directly mutates state on ad-hoc methods (`changeLane`, `boost`, `bounce`) without routing through `validateCommand()`.

---

## Solution
1. **Deterministic Pinball Randomness**:
   - In `src/game/engine.ts`, replace `random: () => Math.random()` with a deterministic hash:
     ```typescript
     random: (racerId: number) => hash01(this.pushSeed, this.tick, racerId)
     ```
   - In `src/game/sim/racer-physics.ts`, pass `racer.id` to `ctx.random(racer.id)` so the pinball rebound direction is perfectly deterministic for any given seed and tick.
2. **Command Dispatcher Pipeline**:
   - In `src/game/engine.ts`, introduce `dispatch(command: GameCommand): CommandVerdict`.
   - Before executing actions:
     - Check `validateCommand(command, this.currentGate())`.
     - If rejected, emit `command-rejected` event and return refusal reason.
     - If accepted, execute the corresponding internal action (`steer`, `boost`, `bounce`, `start`, `toggle-pause`).
   - Route keyboard, gamepad, and touch inputs through `engine.dispatch()`.

### Files Allowed to Change
- `src/game/engine.ts`
- `src/game/sim/racer-physics.ts`
- `src/game/contracts/commands.ts`
- `src/screens/RaceScreen.tsx`
- `tests/contracts.test.ts`
- `tests/physics-parity.test.ts`

### Must NOT Change
- Command types declared in `src/game/contracts/commands.ts`

---

## Acceptance Criteria
- [ ] Running a race with identical seed and inputs produces bit-identical trajectories for pinball spinner bounces.
- [ ] No direct `Math.random()` calls exist inside active physics simulation code.
- [ ] Player inputs pass through `validateCommand()`; illegal commands during unready phases are cleanly refused.
- [ ] `tests/contracts.test.ts` and `tests/physics-parity.test.ts` pass cleanly.

---

## Tests to Run
- `node --import tsx --test tests/contracts.test.ts`
- `node --import tsx --test tests/physics-parity.test.ts`
- `node scripts/check.mjs`
