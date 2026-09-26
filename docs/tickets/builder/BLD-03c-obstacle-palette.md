# BLD-03c: Add race obstacles from a palette

- **Priority**: Medium · **Big move 1, part c** · **Depends on**: BLD-03b · **Art**: uses ART-B3 when merged

## Goal
A new **Track** tab in the builder shelf lists the race's obstacle kinds (boost pad, ramp, gap,
spring, sheep, TNT, pinball spinner, rock gate, water rock) with real thumbnails; clicking the road
places one at that distance and lane, ready to move (BLD-03b).

## Solution
1. Shelf tab `track` with one entry per kind, default sizes taken from `track-layout.ts`, icons from
   the existing sprites (sheep, TNT, spring) and ART-B3 (boost pad, gap, ramp, spinner, rock gate,
   water rock); a neutral fallback icon until ART-B3 is merged.
2. Placement raycasts the road, converts to engine x and lane, and adds to the obstacle document with
   the same validation as BLD-03b.
3. Keep a per-course count budget (like the lane network) so a layout stays raceable.

## Files allowed to change
`src/game/obstacle-storage.ts`, `src/game/track-builder-3d.ts`, `src/components/TrackBuilderUI.tsx`,
tests: new `obstacle-palette.test.ts`.

## Acceptance
- [ ] Every obstacle kind in the tab places, validates and races (headless test per kind).
- [ ] The tab's icons are the kinds' own art (no borrowed prop art).

## Tests to run
`node --import tsx --test tests/obstacle-palette.test.ts tests/obstacle-edit.test.ts`, then `node scripts/check.mjs`.
