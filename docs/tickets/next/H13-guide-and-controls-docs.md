# H13: Accurate In-Game Guide, Controls Settings, and Loading Screen Keybindings

- **ID**: `H13`
- **Priority**: High
- **Component**: Documentation / UI Text / Controls Settings / Loading Screen
- **Conflicts with**: `H5` (both touch `RaceScreen.tsx`)
- **Needs art**: No

---

## Goal
The in-game guide and accessibility labels in `src/screens/RaceScreen.tsx` contain obsolete mechanics from earlier prototypes: they instruct players to "drag your orange ball" (the slingshot launch was replaced by starter push and Spacebar) and to "ride loops for 350 points" (loops are 3D scenery). Furthermore, the recently added camera toggle `V` and slow-motion keys `[` and `]` are missing from `ControlsSettings.tsx` and `RaceLoadingScreen.tsx`. Update all guide copy, canvas ARIA labels, and keybinding diagrams to reflect current gameplay accurately.

---

## Evidence
- `src/screens/RaceScreen.tsx:464`: Canvas aria-label states:
  `"Four-lane Heavy Metal GP 2. Drag your orange ball to launch the 4 goblins. A and D change lanes and bump rivals. Space to air bounce..."`
- `src/screens/RaceScreen.tsx:584`: Hazard guide text states:
  `"On a phone? Drag your orange ball..."` and `"Loop-de-loop, hold the logic: Approach a loop with speed to ride the full circle and earn 350 chaos points."`
- `src/components/ControlsSettings.tsx:1-120`: Documents steer, bounce, boost, pause, but omits:
  - `V` / Camera Mode toggle (Cockpit vs Chase)
  - `[` / `]` Simulation Speed adjustment (0.1x to 2.0x slow motion)
- `src/components/RaceLoadingScreen.tsx:160-190`: The keyboard visualizer diagrams only show $A/D/\text{SPACE}/\text{SHIFT}$, missing $V$ and brackets.

---

## Solution
1. **Rewrite Obsolete Text in `RaceScreen.tsx`**:
   - Update canvas `aria-label`:
     `"Four-lane Heavy Metal GP 2. Press SPACE or Launch button to begin downhill push. A and D steer lanes and bump rivals. SPACE for air bounce, SHIFT for turbo boost, V for cockpit camera, [ and ] for slow motion."`
   - Update hazard description for loops:
     Clarify that timber roller coaster loops are atmospheric scenery and spectator landmarks.
   - Remove references to dragging the ball with the mouse/finger to launch.
2. **Document `V` and `[` / `]` in `ControlsSettings.tsx`**:
   - Add new actions in `ACTIONS` metadata (`src/game/controls.ts`):
     - `cameraToggle`: Label "Toggle Camera", default `['KeyV']`, description "Switch between Cockpit and Chase views"
     - `slowMo`: Label "Game Speed", default `['BracketLeft', 'BracketRight']`, description "Slow down or speed up simulation rate"
   - Render these in the controls remapping table.
3. **Update `RaceLoadingScreen.tsx`**:
   - Add $V$ (Cockpit view) and $[ / ]$ (Slow-Mo) pills to the pre-race tips and keyboard layout diagram.

### Files Allowed to Change
- `src/screens/RaceScreen.tsx`
- `src/game/controls.ts`
- `src/components/ControlsSettings.tsx`
- `src/components/RaceLoadingScreen.tsx`
- `tests/accessibility.test.ts`

### Must NOT Change
- Keybinding storage structure and migration logic in `controls.ts`

---

## Acceptance Criteria
- [ ] `RaceScreen.tsx` canvas ARIA label and hazard guides no longer mention dragging the ball or scoring 350 points from loops.
- [ ] `ControlsSettings.tsx` lists Camera Toggle ($V$) and Simulation Speed ($[ / ]$) with descriptive tooltips.
- [ ] `RaceLoadingScreen.tsx` displays $V$ and $[ / ]$ keys in the controls preview diagram.
- [ ] `tests/accessibility.test.ts` passes with updated screen reader strings.

---

## Tests to Run
- `node --import tsx --test tests/accessibility.test.ts`
- `node --import tsx --test tests/contracts.test.ts`
- `node scripts/check.mjs`
