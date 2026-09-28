# BLD-04: A placed ramp shows why it will not move

- **Priority**: Medium · **Needs art**: No

## Goal
Dragging a builder-placed timber ramp never feels stuck: while a move is invalid the ramp turns red
and says why, and on release it snaps to the nearest valid spot instead of silently jumping back.

## Evidence
- `src/game/track-builder-3d.ts:1584-1596`: every ramp transform is validated
  (`validateRampSupport`) and an invalid one is **reverted** with only a placement error; during a
  gizmo drag that happens on every frame, so the ramp appears frozen.
- `src/game/track-builder-3d.ts:278` `classifyPlacedRamp`: ramps must sit on the road ribbon and
  outside loop windows.

## Solution
1. During a drag, keep the ghost following the pointer; tint it red and show the rejection reason in
   the builder status bar when the candidate is invalid.
2. On release, place it at the last valid position along the drag (binary search between the last
   valid and the rejected transform), with a toast if it had to snap.
3. The inspector shows the ramp's allowed range ("on the road, outside loop windows").

## Files allowed to change
`src/game/track-builder-3d.ts`, `src/components/TrackBuilderUI.tsx`, tests: `builder-ramps`,
`track-builder-validation`.

## Acceptance
- [ ] Dragging a ramp off the road shows it red with a reason, and releasing puts it at the last
      valid spot (test through the builder API).
- [ ] The owner's `timber_ramp` is untouched until moved.

## Tests to run
`node --import tsx --test tests/builder-ramps.test.ts tests/track-builder-validation.test.ts`, then `node scripts/check.mjs`.
