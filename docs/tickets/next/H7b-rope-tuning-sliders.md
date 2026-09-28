# H7b: Rope Tuning Dev Sliders in Builder Test Drive

- **ID**: `H7b`
- **Priority**: High
- **Component**: Physics Tuning / Track Builder Dev Tools
- **Conflicts with**: `P8` (both touch test drive bar / builder UI)
- **Needs art**: No

---

## Goal
The lane rope simulation (`src/game/sim/rope.ts`) binds each marble to its lane with retractable elasticity following collisions. Key parameters—`ROPE_PAYOUT_S` (slack duration), `ROPE_REEL_S` (reel-in recovery time), and `EDGE_SMASH_VZ` (threshold speed for tree-line collision)—are currently hardcoded constants. Expose these parameters as interactive developer sliders within the builder test drive interface, allowing the designer to tune rope tension and recovery feel live during test runs.

---

## Evidence
- `src/game/sim/rope.ts:12-20`: Hardcoded frozen constants:
  - `export const ROPE_PAYOUT_S = 0.6;`
  - `export const ROPE_REEL_S = 1.7;`
  - `export const EDGE_SMASH_VZ = 220;`
- `src/components/TestDriveBar.tsx:1-63`: Has time scale and camera toggles, but no physics tuning sliders.
- Developers currently must edit TypeScript files and recompile to test different rope recovery timings.

---

## Solution
1. **Dynamic Rope Configuration**:
   - In `src/game/sim/rope.ts`, define a mutable/configurable `RopeConfig` object initialized with default values:
     - `payoutDuration: number` (0.1s to 2.0s, default 0.6s)
     - `reelDuration: number` (0.5s to 4.0s, default 1.7s)
     - `edgeSmashVz: number` (100 to 500, default 220)
   - Update `ropeAt()` to accept or read active `RopeConfig`.
2. **Engine Exposure**:
   - Expose `setRopeConfig(partial: Partial<RopeConfig>)` and `getRopeConfig()` on `GameEngine`.
3. **Builder Dev UI**:
   - In `src/components/TestDriveBar.tsx` (or a collapsible "Rope Dev" drawer), add three precision sliders:
     - Slack Duration (`ROPE_PAYOUT_S`): 0.1s – 2.0s (step 0.05s)
     - Reel-in Time (`ROPE_REEL_S`): 0.5s – 4.0s (step 0.1s)
     - Edge Smash Vz (`EDGE_SMASH_VZ`): 100 – 500 (step 10)
   - Add a "Reset Defaults" button restoring 0.6s, 1.7s, 220.

### Files Allowed to Change
- `src/game/sim/rope.ts`
- `src/game/engine.ts`
- `src/components/TestDriveBar.tsx`
- `tests/lane-rope.test.ts`

### Must NOT Change
- Pure mathematical functions in `ropeAt` calculation curve

---

## Acceptance Criteria
- [ ] Adjusting sliders in the test drive UI changes the live rope payout, reel duration, and edge smash threshold in real time.
- [ ] Reset button restores default values (0.6s payout, 1.7s reel, 220 edge smash).
- [ ] Default values without slider interaction remain identical to previous constants.
- [ ] `tests/lane-rope.test.ts` passes with configurable inputs.

---

## Tests to Run
- `node --import tsx --test tests/lane-rope.test.ts`
- `node scripts/check.mjs`
