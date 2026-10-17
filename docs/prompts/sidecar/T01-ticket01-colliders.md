# TICKET-01: colliders, the gate exit, the roof level and the steering sign

**From:** Opus. **Spec:** OPUS_NOTE_07 (Setmix Drive). **Code:** Argo's bundle, unpacked in `arena-gathered/argo-ticket01/`; its paths mirror the repo. **His wiring notes:** ARGO_NOTE_06. Where they disagree with this brief, this brief wins: his notes assume a class with `this`, and the repo has none.

The bundle code is reviewed. Install it as it is. If a file fails typecheck or a test, make the smallest fix and list it in your report.

## 0. Install
Copy these six files from `arena-gathered/argo-ticket01/` into place:
- `apps/web/src/play/static-colliders.ts` and its `.test.ts`;
- `apps/web/src/base/machine-footprints.ts` and its `.test.ts`;
- `packages/structure/src/roof-level.ts`;
- `packages/structure/tests/roof-level.test.ts`.

Then move `OPENING_OFF_FRAGMENT` out of static-colliders.ts and into `apps/web/src/play/portal-shaders.ts`, next to `OPENING_MARK_FRAGMENT`. Shaders live there.

## 1. Item B: static colliders (GATE-04, field machines, LAB-10)
- `play-scene.ts` is a closure factory. Use its closure variables `twin`, `gateOn`, `gateYawDelta`, `room` and `pos`; there is no `this`.
- **The lab:** `collide()` lives in play-scene.ts (about line 1262), not in lab-room.ts. Replace its body with `pushCircle(before, pos, feetY, RADIUS, room.colliders)`, taking `feetY` from `room.floorHeight` at the previous spot so the gate plinth's steps stay climbable.
- **The moon:** add a closure array `planetStatic: Box[]`. Rebuild it in `syncPlanetMatrices()`, after the twin rebuild (about lines 866–890), and whenever the field machines change. Find where the machine props go onto the plot with `grep machineProp(`. It holds the twin's colliders through `boxesToWorld`, plus one `machineFootprint(kind)` per machine. In the moon walk step (about line 2111), call `pushCircle` before `activeWalkWorld.push`.
- **The twin's opening must stay passable.** The crossing check at about line 2131 needs you to walk through it. Prove it in the browser check (step 8).
- **LAB-10:** the generated lab models replace the labkit visuals but keep the labkit colliders (lab-room.ts about lines 41 and 54; the east and west wall models turn half a turn). For each such prop, compare the loaded model's visible bounds with its colliders once, when the model loads. Where the visual sticks out more than 0.1 m past the colliders, add a collider from the visible bounds. The gate opening, the cot and the walkways must stay clear.

## 2. Item C: the gate exit (GATE-05)
- Add `gateExit(dist?: number): { x: number; z: number; yaw: number }` to the `PlayScene` interface (about line 190) and implement it with `computeGateExitPose(twin.group.matrixWorld.elements, gateYawDelta, dist)`.
- In play.tsx, route the moon arrivals through it: about lines 1055, 2515 and 3042–3044.
- Look at line 2925 before you change it. If it is a deliberate shot position for a test, leave it alone.

## 3. Item D: the unpowered doorway (GATE-03)
- Use an `OPENING_OFF_FRAGMENT` material on `twinOpening` while `!gateOn`, and the existing mark material while it is on. Swap only when `gateOn` changes.
- The debug moon teleports and checkpoint moon boots power the gate through the existing restore path, which also starts the hums. You can't be on the moon without having powered the gate.

## 4. Item E: the roof level (BB-07)
- Re-export `roofLevel` and `isRoofKind` from `packages/structure/src/index.ts`.
- In `snap()` (about line 1257), `k` is computed once per structure, before the kinds are tried. Apply `k = Math.max(k, roofLevel(base, s, i, j))` where the roof kind and its cell are known, without changing `k` for any other kind.

## 5. Item F: the machine footprints
These feed `planetStatic` in item B. Check that every `MachineKind` the plot can place has a footprint (the test covers it).

## 6. VEH-02: the steering sign
- Swap the steer mappings so A/Left gives -1 and D/Right gives +1, in play.tsx (about line 1917) and in the fallback in play-scene.ts (about line 2019).
- Add a doc line on `Input.steer` in packages/rover: "+1 = turn right (clockwise seen from above)".
- Add a test in `packages/rover/tests/` asserting that steer -1 gives a positive yaw rate (`w[1] > 0`) and +1 a negative one, for the scout and the hauler.

## 7. BB-02: does a second structure collide?
Argo's repro: on the moon, walk away from the starter shelter and place a standalone foundation, then a ramp, wall, window, door and roof (a new structure, `s >= 1`), and walk into them.
- `piece-meshes.ts` builds `placedForWalk` (about lines 115–303), and play.tsx calls `scene.setWalkWorld` after each dispatch (about line 938).
- Reproduce it first, in the browser check. If those pieces don't collide, find the root cause, fix it, and name it in your report. Also check that a ramp on uneven ground is enterable from its low edge.

## 8. Verify (foreground, in this order)
- Write `scripts/test-ticket01-collision.mjs`, using `scripts/test-base-building.mjs` as the pattern. Boot `?base&kit=1&e2e`, then drive `__playScene.debug.teleport` and `scene.frame(t, dt, { move, look, run })` steps. Assert:
  1. Lab: walking into the east-wall machines, the west-wall gear and the gate posts stops you before the visuals. Walking through the powered gate opening crosses to the moon.
  2. Moon: the twin's frame blocks you. Its powered opening crosses you to the lab.
  3. Spawn: after a moon teleport, you face away from the gate: the forward vector (-sin yaw, -cos yaw) dotted with (spawn - gate) is above 0.
  4. A standalone foundation, wall and ramp placed away from the shelter through the base API: the wall blocks, the ramp climbs at least 2 m and the foundation is stood on.
  5. A roof snapped while aiming at floor height lands at k=1.
  6. Field machines block you.
  7. While driving, steer -1 turns the rover left (yaw goes up).
  Save screenshots in `docs/shots/ticket01/`: the lab gate posts, the twin gate up close, the spawn view, and the standalone build.
- Then run `npm run typecheck`, `npm test`, `npm run build`, `node scripts/test-ticket01-collision.mjs`, `node scripts/test-base-building.mjs` (the ramp regression) and `node scripts/test-debug-menu.mjs`. On this laptop the fieldkit and plotgrid timing tests fail; that is known.

## 9. Commit and report
- Never commit `apps/web/dist/index.html`. The git index is shared, so run `git diff --cached --stat` first, then `git commit -m "..." -- <paths>`. Do not push; Opus pushes after review.
- Post `TICKET-01 [DONE]` on `docs/SIDECAR_COMMS.md`, with the pass/fail line of each command.
- Report back in 25 lines or fewer: the commits, each command's result, the BB-02 root cause (or "not reproduced"), every change you made to Argo's files, and anything left undone.
