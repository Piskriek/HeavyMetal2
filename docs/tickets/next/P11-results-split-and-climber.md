# P11: Post-Race Results — Split Rank Medallions and "Biggest Climber" Award

- **ID**: `P11`
- **Priority**: Polish
- **Component**: Results Screen / Tournament Analytics / UI
- **Conflicts with**: `H9`
- **Needs art**: No

---

## Goal
The race completion results view currently presents only the final crossing order and total elapsed times. With the introduction of the solo first split and subsequent loop merge releases, players cannot see where they stood during the opening mountain sector versus the finish, nor do dramatic comeback drives get celebrated. Enhance the post-race results table to display each racer's Split 1 sector rank side-by-side with their final finish placement, and highlight the "Biggest Climber" (racer who gained the most positions from Split 1 to the finish line) with a dedicated goblin trophy badge.

---

## Evidence
- `src/screens/RaceScreen.tsx:515-560`: Renders final standings list with elapsed time, best speed, and reward points, but lacks intermediate sector timing or rank progression.
- `src/game/engine.ts:303, 331`: Tracks `this.splitReached` and solo sector timings, but does not record racers' rank at the split gate for post-race comparison.

---

## Solution
1. **Record Intermediate Split Rank**:
   - In `src/game/engine.ts`, when a racer crosses the first split checkpoint, record their `splitRank` and `splitTime` in their racer record.
2. **Results Table Expansion**:
   - In the results standings table:
     - Add a "SPLIT 1" column showing sector position (e.g. `P14` $\rightarrow$ `P3`).
     - Display a position delta indicator: green $\blacktriangle +11$ for positions gained, red $\blacktriangledown -2$ for positions lost.
3. **"Biggest Climber" Highlighting**:
   - Calculate $\max(0, \text{splitRank} - \text{finishRank})$ across all competitors.
   - Award the top gainer the "BIGGEST CLIMBER" honorary medallion with bonus scrap points and custom flavor commendation ("Passed 18 marbles down the scrap chutes!").

### Files Allowed to Change
- `src/game/engine.ts`
- `src/game/types.ts`
- `src/screens/RaceScreen.tsx`
- `src/hud.css`
- `tests/session-save.test.ts`

### Must NOT Change
- Total tournament standings accumulation logic in `src/game/session.ts`

---

## Acceptance Criteria
- [ ] Post-race results screen displays each competitor's Split 1 rank alongside final finish position.
- [ ] Positive and negative position shifts are clearly color-coded with delta arrows.
- [ ] The racer with the greatest position gain is awarded the "Biggest Climber" banner and bonus points.
- [ ] `tests/session-save.test.ts` passes cleanly.

---

## Tests to Run
- `node --import tsx --test tests/session-save.test.ts`
- `node scripts/check.mjs`
