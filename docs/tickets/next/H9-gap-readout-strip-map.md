# H9: Tactical Gap Readout Chip and 100-Dot Top Strip Map

- **ID**: `H9`
- **Priority**: High
- **Component**: Race HUD / Cockpit Telemetry / Progression Map
- **Conflicts with**: `P11`
- **Needs art**: No

---

## Goal
In large fields (up to 100 racers), players have no immediate way to gauge their proximity to rivals directly ahead or behind, and the existing 4-racer mini-map cannot represent a 100-marble peloton. Implement a live tactical gap chip (e.g. `"+0.8s to P36"` or `"-0.4s to P38"`) adjacent to the cockpit position badge, and add a full-width, auto-scaling 100-dot track progression strip map along the top of the race HUD displaying the relative positions of the player and all rivals across the course.

---

## Evidence
- `src/components/CockpitHud.tsx:170`: The center readout container renders basic status, but lacks relative gap timing to the next car ahead.
- `src/screens/RaceScreen.tsx:472-510`: The third-person HUD contains a legacy 4-racer mini track bar, which fails to visualize large rosters (20/50/100 racers).
- `src/game/racers.ts:134-140`: `raceOrder()` calculates live standings each tick, but relative delta times ($\Delta t = \Delta x / \bar{v}$) are not computed or exposed in `GameSnapshot`.

---

## Solution
1. **Delta Time Calculation in Engine**:
   - In `src/game/engine.ts`, during standings updates, determine the rider immediately ahead of the player (e.g. Rank $N-1$) and immediately behind (Rank $N+1$).
   - Compute time gap in seconds: $\Delta t = (x_{\text{ahead}} - x_{\text{player}}) / \max(10, v_x)$.
   - Store `gapAhead: { place: number; seconds: number; name: string } | null` in `GameSnapshot`.
2. **Cockpit Gap Chip**:
   - In `src/components/CockpitHud.tsx`, render an ornate brass chip next to the position medallion showing `+0.8s to P36` (green if closing gap, amber if stable, red if falling back).
3. **100-Dot Top Strip Map**:
   - Create a lightweight canvas or SVG strip component (`src/components/TrackStripMap.tsx`) anchored along the top screen border:
     - Horizontal rail representing 0% to 100% course completion ($X = \text{START\_X}$ to $\text{FINISH}$).
     - Render colored pips for each racer:
       - Player: bright glowing orange pip with prominent border.
       - Rivals: smaller pips colored by team/rider palette.
       - Milestone gates: split line and loop icons.
     - Optimize using a dedicated 2D canvas with direct pixel draws or batch SVG elements to maintain 60 FPS with 100 dots.

### Files Allowed to Change
- `src/game/engine.ts`
- `src/game/types.ts`
- `src/components/CockpitHud.tsx`
- `src/screens/RaceScreen.tsx`
- `src/components/TrackStripMap.tsx` (new file)
- `src/hud.css`

### Must NOT Change
- Headless simulation order in `src/game/racers.ts`

---

## Acceptance Criteria
- [ ] During races, the cockpit displays a live time delta chip indicating the seconds gap to the rival immediately ahead.
- [ ] The top of the screen displays a full-course strip map showing the accurate relative position of all active racers (up to 100).
- [ ] The player's marble pip is visually distinct and stands out clearly from AI rivals.
- [ ] Strip map updates smoothly at 60 FPS without DOM thrashing or memory allocation during frame ticks.

---

## Tests to Run
- `node --import tsx --test tests/cockpit-channel.test.ts`
- `node --import tsx --test tests/roster-scale.test.ts`
- `node scripts/check.mjs`
