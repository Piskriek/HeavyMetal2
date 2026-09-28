# H5: Touch Controls Integration for Mobile and Coarse Pointers

- **ID**: `H5`
- **Priority**: High
- **Component**: Mobile UX / Input Handling
- **Conflicts with**: `H13` (both touch `RaceScreen.tsx`)
- **Needs art**: No

---

## Goal
The tactile on-screen touch deck `src/components/RaceControls.tsx` is fully implemented with steering buttons, boost, bounce, and primary action handlers, but is currently never rendered in `RaceScreen.tsx`. Render `RaceControls.tsx` when running on touch devices or coarse pointers (`window.matchMedia('(pointer: coarse)').matches` or touch events detected) and wire its callbacks directly to the engine's steering (`changeLane`), turbo boost (`boost`), air bounce (`bounce`), and launch/pause controls.

---

## Evidence
- `src/components/RaceControls.tsx:1-104`: Contains full UI component with tactile buttons for `onLane(-1)`, `onLane(1)`, `onBounce()`, `onBoost()`, and `onPrimary()`.
- `src/screens/RaceScreen.tsx`: Never imports or renders `RaceControls`. Mobile and tablet players with touchscreens have no visible way to steer, bounce, or boost during races.
- `src/screens/RaceScreen.tsx:584`: Mentions touch instructions in flavor text ("On a phone? Drag your orange ball, then use the lane arrows, Jump, Bounce, and Boost..."), but the control buttons are absent from the DOM.

---

## Solution
1. **Pointer Detection in `RaceScreen.tsx`**:
   - Detect coarse pointer via `window.matchMedia('(pointer: coarse)').matches` and track touch start events.
   - Maintain a `showTouchControls` state (enabled if coarse pointer detected, or toggleable in settings).
2. **Wire Callbacks**:
   - Render `<RaceControls />` within the game stage overlay when active.
   - Connect callbacks:
     - `onLane={(dir) => engine.changeLane(dir)}`
     - `onBounce={() => engine.bounce()}`
     - `onBoost={() => engine.boost()}`
     - `onPrimary={() => engine.status === 'ready' ? engine.start() : engine.status === 'flying' ? engine.togglePause() : engine.togglePause()}`
3. **Styling and Layout**:
   - Ensure the touch overlay anchors comfortably to the bottom edges without obscuring the cockpit viewport or speed/position meters.
   - Prevent default touch behaviors (pinch-to-zoom, scroll) on control button touch events.

### Files Allowed to Change
- `src/screens/RaceScreen.tsx`
- `src/components/RaceControls.tsx`
- `src/hud.css`

### Must NOT Change
- Physics simulation in `src/game/engine.ts`
- Keyboard binding contracts in `src/game/controls.ts`

---

## Acceptance Criteria
- [ ] On devices with coarse pointers or touch capability, `RaceControls` renders on screen during the race.
- [ ] Tapping left/right buttons calls `engine.changeLane(-1)` and `engine.changeLane(1)` without latency or page scroll.
- [ ] Tapping BOUNCE and BOOST triggers the corresponding engine abilities and updates charge badges.
- [ ] Touch buttons do not render on desktop setups with fine pointer (mouse) unless touch simulation is active.

---

## Tests to Run
- `node --import tsx --test tests/contracts.test.ts`
- `node scripts/check.mjs`
