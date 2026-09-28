# M11: Throttle Lane Panel Re-Renders to Animation Frame Rate

- **ID**: `M11`
- **Priority**: Medium
- **Component**: Track Builder UI / React Performance
- **Conflicts with**: `M8` (both touch `TrackBuilderUI.tsx` / `LanePanel.tsx`)
- **Needs art**: No

---

## Goal
While editing lane networks in the 3D track builder, dragging a node handle or slider dispatches synchronous notifications on every single pointermove event, triggering redundant React reconciliation and re-rendering of `src/components/builder/LanePanel.tsx` 60–120 times per second. Throttle `LanePanel` state updates using `requestAnimationFrame`, coalescing rapid pointermove events into a single batched render per display frame to eliminate UI stuttering during active lane manipulation.

---

## Evidence
- `src/components/TrackBuilderUI.tsx:943, 3452`: Passes `lanePanelModel` to `<LanePanel />`.
- `src/game/track-builder-3d.ts:3200-3217`: `applyLaneEditToDoc` calls `this.notify()` on every single drag frame (`onMove`).
- `src/components/builder/LanePanel.tsx:46-120`: The entire panel (all buttons, node coordinates, paths list, and half-width sliders) re-renders synchronously on every notification, consuming significant CPU time while dragging nodes.

---

## Solution
1. **rAF Coalescing in `TrackBuilderUI.tsx`**:
   - In `TrackBuilderUI.tsx`, wrap the lane panel model subscription inside a `requestAnimationFrame` coalescing loop:
     - When `builder.subscribe` fires, record a pending update flag.
     - Schedule `requestAnimationFrame` if not already scheduled.
     - Update the React `lanePanelModel` state once per display frame.
2. **Component Memoization**:
   - Wrap `LanePanel` in `React.memo` with a custom comparison function or shallow equality on `model.selectedNode` coordinates and path counts.
   - Separate static action buttons from live numeric coordinate displays.
3. **Smooth Dragging Experience**:
   - Ensure the 3D Three.js gizmo updates at native monitor refresh rate without waiting on React DOM updates.

### Files Allowed to Change
- `src/components/TrackBuilderUI.tsx`
- `src/components/builder/LanePanel.tsx`
- `tests/lane-panel.test.tsx`

### Must NOT Change
- Pure model derivation in `src/game/lane-panel-model.ts`
- Lane edit command contracts

---

## Acceptance Criteria
- [ ] Dragging lane nodes in the builder triggers at most one `LanePanel` React re-render per display frame.
- [ ] Frame rate remains at 60 FPS without DOM stutter during continuous node dragging.
- [ ] Selected node X/Z coordinates update in real time in the panel inspector.
- [ ] `tests/lane-panel.test.tsx` passes cleanly.

---

## Tests to Run
- `node --import tsx --test tests/lane-panel.test.tsx`
- `node --import tsx --test tests/lane-gizmo.test.ts`
- `node scripts/check.mjs`
