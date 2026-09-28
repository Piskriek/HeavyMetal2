# H11: Tactical CPU Racing for the Rope Model with Pre-Hit Shove Tell

- **ID**: `H11`
- **Priority**: High
- **Component**: AI Driver / Physics Tactics / Animation
- **Conflicts with**: None
- **Needs art**: No

---

## Goal
The CPU AI driver in `src/game/sim/cpu-driver.ts` currently decides whether to ram adjacent rivals via an arbitrary pseudo-random coin flip (`randomAt(racer.id, runTime) > 0.43`), producing sudden, unpredictable shoves without telegraphing or tactical logic. Re-engineer the AI targeting to actively evaluate nearby rivals within ramming range, execute deliberate lane-swerving offensive rams when holding a weight or boost advantage, and display a 0.3-second pre-shove "wobble tell" (lateral weave vibration) so human players have time to react, counter-steer, or deploy defensive shields.

---

## Evidence
- `src/game/sim/cpu-driver.ts:150-155`:
  ```typescript
  for (const other of ctx.others) {
    if (other.id === racer.id || other.finished || other.falling) continue;
    if (Math.abs(other.x - racer.x) < 125 && Math.abs(other.z - candidate.z) < 90) {
      score += racer.weight > other.weight * 1.05 && randomAt(racer.id, runTime) > 0.43 ? 3.8 : -2.8;
    }
  }
  ```
  Ramming behavior is a simplistic binary threshold check without strategic evaluation of rivals or visual telegraphed anticipation.
- When an AI racer decides to shove, the target lane changes instantly without any tell, giving human racers zero reaction window.

---

## Solution
1. **Tactical Ram Evaluation**:
   - In `stepCpuDriver`:
     - Scan rivals within dynamic contact window: $|x_{\text{other}} - x_{\text{racer}}| < 160$ and $|z_{\text{other}} - z_{\text{racer}}| \le \text{LANE\_WIDTH}$.
     - Weigh ram decision against:
       - Relative mass advantage ($M_{\text{racer}} > M_{\text{other}}$).
       - Approaching hazards (attempt to shove rivals toward TNT or cliff gaps).
       - Relative shield/immunity status (avoid ramming shielded targets).
2. **0.3 s Pre-Shove Wobble Tell**:
   - When a CPU commits to an aggressive ram attack, set `racer.ramTargetId = other.id` and `racer.ramTelegraphUntil = runTime + 0.3`.
   - During the 0.3 s telegraph window:
     - Apply a high-frequency lateral oscillation to the attacking ball ($z_{\text{offset}} = \sin(t \cdot 40) \cdot 8\text{px}$).
     - Emit aggressive scrap/spark particles from the attacker's tires/rims.
   - When the timer elapses ($t \ge \text{ramTelegraphUntil}$), execute the definitive lane slam into the victim's trajectory.
3. **Difficulty Tuning**:
   - `veteran`: AI targets ruthlessly and times rams before gaps/hazards.
   - `rookie`: AI gives longer tell (0.5 s) and only rams when mass ratio $> 1.25$.

### Files Allowed to Change
- `src/game/sim/cpu-driver.ts`
- `src/game/racers.ts`
- `src/game/sim/racer-physics.ts`
- `tests/qualifying-session.test.ts`
- `tests/physics-parity.test.ts`

### Must NOT Change
- Physics impulse conservation formulas in `resolveBumps`

---

## Acceptance Criteria
- [ ] AI drivers actively target rivals based on mass, positioning, and track hazards rather than pure random chance.
- [ ] Attacking CPU racer visibly wobbles laterally for 0.3 seconds before launching a lane shove into an adjacent opponent.
- [ ] Telegraphing gives the defender an opportunity to avoid the hit by changing lanes or activating a shield.
- [ ] Deterministic qualifying and physics parity tests continue to pass without desynchronization.

---

## Tests to Run
- `node --import tsx --test tests/physics-parity.test.ts`
- `node --import tsx --test tests/qualifying-session.test.ts`
- `node scripts/check.mjs`
