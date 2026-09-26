# BLD-03b: Move, resize, delete and save race obstacles

- **Priority**: High · **Big move 1, part b** · **Depends on**: BLD-03a · **Conflicts with**: BLD-02
- **Needs art**: No

## Goal
A selected race obstacle can be dragged along the road and across lanes with the gizmo, resized where
its kind allows (ramp length/height, boost pad and gap length), deleted, undone and saved; the next
test drive races the edited layout.

## Evidence
- After BLD-03a the obstacles are a document but read-only.
- The prop gizmo (`src/game/builder/gizmo-adapter.ts`) and the lane-node gizmo already show the two
  patterns: prop transforms and constrained lane-space drags (`lane-gizmo-follow`).

## Solution
1. Attach the gizmo to a selected obstacle in **lane space**: drag moves `x` along the road and snaps
   `lane` (or the path, on a network); vertical drag is disabled (height comes from the course).
2. Per-kind handles: ramp `width`/`height`, boost and gap `width`; validation per kind (a gap never
   under the start pad or the merge gate; a ramp never inside a loop window, the same rule builder
   ramps use), refusing with a toast and a red outline rather than silently.
3. Delete (Del key and a button), undo/redo in the builder's one stack (props, lanes, obstacles),
   save with the lane Save button, disk backup (add-only safety copies like C2).
4. Test drive races the saved document.

## Files allowed to change
`src/game/obstacle-storage.ts`, `src/game/track-builder-3d.ts`, `src/game/builder/gizmo-adapter.ts`,
`src/components/TrackBuilderUI.tsx`, tests: `obstacle-storage`, `lane-builder`, new `obstacle-edit.test.ts`.

## Acceptance
- [ ] Dragging a ramp 500 units down the road and one lane over is stored and raced (headless: the
      engine's obstacle list reflects it).
- [ ] Undo restores the obstacle; a gap dragged onto the start pad is refused with a reason.
- [ ] A saved document survives a reload and a course switch.

## Tests to run
`node --import tsx --test tests/obstacle-edit.test.ts tests/obstacle-storage.test.ts tests/history.test.ts`, then `node scripts/check.mjs`.
