# BLD-03a: The race's obstacles become a document you can see and select in build mode

- **Priority**: High · **Big move 1, part a** · **Conflicts with**: BLD-01 (engine track build)
- **Needs art**: No

## Goal
The ramps, boost pads, gaps, springs, sheep, TNT, spinners and rock gates you drive over become a
per-course **obstacle document**, like the lane network: generated once from today's layout, stored,
drawn in build mode, and selectable, with an inspector that shows what the obstacle is and does.
This part is read-only (moving is BLD-03b), so it cannot break a race.

## Evidence
- `src/game/engine.ts:963-972` `makeTrack` rebuilds the obstacles from `createTrackLayout` every
  reset; they exist nowhere else.
- `src/game/obstacle-view.ts` draws them; it is not a builder prop, and
  `src/game/track-builder-3d.ts:1090` `raycastProp` only tests `propObjects`, so a click never finds them.
- `src/game/lane-storage.ts` / `lane-network.ts` are the model to copy: a versioned document per
  course, validated, stored under its own key, with the builder editing it.

## Solution
1. `src/game/obstacle-storage.ts`: `ObstacleDocument { version: 1, course, obstacles: Obstacle[] }`,
   seeded from `createTrackLayout(course, { skipBeforeX: passageMouthX(), keepLoopsFromX })` exactly
   as the engine does now, validated (kinds, lanes, x ranges, no overlap with the start pad or the
   merge gate), stored under `hm2-obstacles-v1:<course>` with a disk backup through the dev server
   (like lane paths).
2. The engine loads the stored document when there is one, else the seed: **a course with no stored
   document races exactly as today** (fingerprint test).
3. Build mode draws the obstacles with the same `ObstacleView` plus pick proxies; `raycastProp`
   (or a sibling `raycastObstacle`) returns an obstacle hit; selecting one shows an inspector: kind,
   lane, distance, size, and one line on what it does ("boost pad: +speed and a boost charge").

## Files allowed to change
New `src/game/obstacle-storage.ts`; `src/game/engine.ts` (`makeTrack`), `src/game/obstacle-view.ts`
(pick proxies), `src/game/track-builder-3d.ts` (selection), `src/components/TrackBuilderUI.tsx`
(inspector), `vite.config.ts` (backup endpoint), tests: new `obstacle-storage.test.ts`, `start-zone`.

## Must NOT change
Race behaviour with no stored document (the layout fingerprint stays identical), lane storage, props.

## Acceptance
- [ ] With no stored document every course's obstacle list equals today's (fingerprint test, all courses).
- [ ] In build mode, clicking a ramp, boost pad, gap or spinner selects it and the inspector names it.
- [ ] A stored document round-trips and a corrupt one falls back to the seed with a toast.

## Tests to run
`node --import tsx --test tests/obstacle-storage.test.ts tests/start-zone.test.ts tests/obstacle-view.test.ts`, then `node scripts/check.mjs`.
