# T13a: the perimeter turret, the blue-sky push, peaceful drops and the scatter sidearm (TICKET-13, part a)

**Spec:** brief 32 (`docs/prompts/sidecar/32-heavy-terraformers-and-turrets.md`, with Argo's sign-off at the bottom), `docs/argo/notes/ARGO_NOTE_16_ticket13_turret_and_plumes.md`, and Argo's bundle `arena-gathered/argo-ticket13/` (6 files). **Opus's staging run:** Argo's 4 tests pass, and the 5 new files typecheck strictly.

**Not in this part (T13b, after T14 frees `play.tsx`):** the vehicle bay's gantry print timeline, the scout and hauler rear sockets, POL-50 and POL-51. `vehicle-bay.ts` lands now (pure, tested) but isn't wired.

## Copy or merge
- **Copy (new):**
  - `packages/plotsim/src/turret-brain.ts`, `peaceful-drops.ts` and `vehicle-bay.ts`, exported from `packages/plotsim/src/index.ts`;
  - `packages/plotsim/tests/ticket13-turret-drops-gantry.test.ts`;
  - `apps/web/src/play/turret-view.ts` and `window-c-hooks.ts`.
- **Fix their imports:** Argo's files import `../../../../packages/plotsim/src/...`; use `@hm/plotsim` like the rest of `apps/web`.

## The measured turret (Opus, from the packed parts, checked in a Blender assembly)
The parts are `turret-base`, `turret-yoke` and `turret-gun` in `apps/web/src/assets/gen/registry.json`. Load them with `getGenSync(id, genLevel)`, as `machine-props.ts` does. Each has a bottom-centre origin, and glTF +Z is the front. Put these numbers in `TURRET_SOCKET_CONSTANTS`, replacing Argo's placeholders:
- `YAW_AXIS_HEIGHT_M: 0.672` (the turntable top: the yoke's bottom sits here);
- `TRUNNION_HEIGHT_ON_YOKE_M: 0.639`;
- `TOTAL_TRUNNION_HEIGHT_M: 1.311`;
- **new:** `GUN_MESH_OFFSET_FROM_PIVOT_M: [0, -0.241, -0.091]` (place the gun mesh's origin here inside the pitch group, so the pivot bosses sit on the trunnion axis);
- `BARREL_COLLAR_OFFSET_M: [0, 0.059, 0.359]` and `LASER_EMITTER_OFFSET_M: [0, -0.101, 0.359]` (both from the pivot; the collar block is 0.15 m square, so keep the barrel radius at 0.045);
- `MUZZLE_TIP_OFFSET_M: [0, 0.059, 1.039]` (the collar, plus the 0.52 m barrel, plus the 0.16 m shroud).

The yoke yaws about the base's vertical axis, and the gun pitches about X at the trunnions, within ±60°. The yoke's inner gap is 0.486 m, and the gun fits it as packed: don't rescale either part.

## Do
1. **Install** the bundle as above, and run Argo's tests in the repo.
2. **The turret is a buildable piece.**
   - Add a `turret` kind to `@hm/structure`. It sits on a wall top (the corner and joint sockets along the top edge) and on roofs and floors, through the existing `snap()`. It never floats: `place()` refuses it anywhere else. Model it on how the small free-placed pieces (bin, repeater, life support) are handled.
   - Its footprint is the 0.9 m base plate.
   - **Bill (Opus's call, a POL for Argo to confirm):** 40 ore, 2 `prim-cube` and 1 `prim-column`; it unlocks at stage 2.
   - It shows in the build menu from the catalog data, with no `play.tsx` change.
3. **Power:** each turret draws 2 kW (`TURRET_POWER_DRAW_KW`) from the base's grid, on the same budget the HUD shows ("N of 12 kW"). Feed brownout satisfaction into `stepTurretBrain`, so a brownout slows its rate of fire.
4. **Combat (`play-scene.ts` Window C, one labelled section):**
   - each frame, step every turret's brain with:
     - the live monsters (position, archetype, from the monsters module);
     - the safe domes (the gate's 25 m, the pylons' 15 m and any beacon's);
     - the base pieces as solid boxes;
     - the player;
   - apply its shots through the existing monster damage path (the one the sidearm and beam use);
   - yaw the yoke and pitch the gun toward the target, and draw the amber `#ffc13d` targeting laser from the laser emitter to the target, only while it tracks;
   - an unpowered turret is still, with no laser.
5. **The blue-sky push (ruling 06):** the first heavy light projector running pushes the stage through `evaluateHeavyProjectorBlueSkyPush`, with T10's wave band. Find the real stage-raise path; Argo's snippet calls `this.raiseStage`, which may not exist.
6. **Peaceful drops:** add `PEACEFUL_COMBINER_RECIPES` to the lab combiner's recipes (`packages/cartlab`). Add a unit test that checks parity against leaksim's REAL drop table, not only Argo's own table: every monster drop has a non-combat source.
7. **The scatter sidearm:** add `SCATTER_SIDEARM_PRESET` to `apps/web/src/base/weapons.ts`, so the weapon bench can forge it from `weapon-frame`, `core-burst` and `barrel-scatter`.
8. **POL-76:** use `resolveGenMachineScale` in `createGenMachineProp` (`apps/web/src/assets/gen-props.ts`), or delete the unused function. Say which.
9. **Registry:** mark POL-24 closed (Argo confirmed it in ARGO_NOTE_16), and add the turret bill as a new POL for Argo.

## Verify
- **Unit tests:**
  - Argo's 4;
  - the parity test against the real tables;
  - structure: a turret on a wall top and on a roof places, and a floating one is refused;
  - the turret's draw counts against the 12 kW gate.
- **A new browser test, `scripts/test-ticket13.mjs`** (Flash is extending `test-campaign.mjs` for TICKET-16 at the same time, so don't edit it; model the new script on it and reuse its debug hooks):
  - build a heavy light projector on a hardpoint and see the stage push;
  - put a turret on a roof, and check it hits a swarmer at 30 m and ignores one inside the gate's dome;
  - zero console errors and zero HUD overlaps;
- **The whole campaign still passes:** run `node scripts/test-campaign.mjs` unchanged.
- **Shots** (prove the subject is in view; HUD hidden if the test can):
  - the turret tracking, its laser on a monster, from the side;
  - the turret on a wall top, from three sides (nothing floating);
  - the stage push.
  
  Look at every one.
- **Timings:** fps and GPU ms on Low with four turrets running (`--worker-only`), against the T03P-R numbers. Report the build size: the turret adds about 124 KB.
- **Runs:**
  - `npm run typecheck` on the laptop;
  - the rest through `scripts/test-on-3dpc.sh --worker-only --only "<your paths>"`: `npm test`, the build, and the campaign.

## Stay inside
- `packages/plotsim/`, `packages/structure/src/index.ts` and its tests, `packages/cartlab/src/index.ts` and its tests;
- `apps/web/src/play/turret-view.ts`, `window-c-hooks.ts` and `play-scene.ts` (Window C only);
- `apps/web/src/base/catalog.ts`, `apps/web/src/base/world.ts` (the turret and power only), `apps/web/src/base/weapons.ts` and `apps/web/src/assets/gen-props.ts` (POL-76 only);
- the new `scripts/test-ticket13.mjs`.

Another Haiku owns `play.tsx`, `apps/web/src/credits/`, `lab-room.ts`, `goblin-front.tsx` and the HUD zone files (T14). Flash owns `packages/plume/`. Never touch those. Use POL-291 to POL-300 for new registry entries.

## Git
- Commit by explicit paths, after checking `git diff --cached --stat`.
- End messages with `Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>`.
- Never commit `apps/web/dist/index.html`, and never push.
