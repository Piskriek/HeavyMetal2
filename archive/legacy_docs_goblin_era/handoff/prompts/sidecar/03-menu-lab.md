# Sidecar task 03: the main menu shows the new lab, with a glitching wasteland outside its window (POL-01)

Pull `main` first. Work on `main` and push there (no PRs). Before you push, run `node scripts/verify.mjs` and `E2E_GPU=1 node scripts/e2e-smoke.mjs`; both must pass. Commit the built `apps/web/dist/index.html` with `git add -f`. Log rough spots in `docs/DEFERRED_POLISH.md`; do not tune frame rates. Do this after task 02 (the hologram table), because both touch `apps/web/src/play/lab-room.ts`.

## What the owner wants (2026-10-07, verbatim in `docs/OWNER_ASKS.md`)
"The main menu window currently still shows an old lush view of a round arch portal door. It needs to be the new lab, and add to the polish changing the landscape to a desolate barren wasteland (Stage 0/1) outside the window, with the environment actively glitching (black-and-white CRT dither, scanline jitter, and chromatic aberration like when you lose sync in Stage 0)."

## Where things are
- **The menu's 3D view:** `apps/web/src/lab/lab.tsx` and `apps/web/src/lab/lab-scene.ts`. That is the OLD lab: white panels, a round archway in the back wall, the finished lush planet through it. The HTML menu over it is `apps/web/src/shell/goblin-front.tsx` (`.sm-home`).
- **The new lab** is Play's: `createLabRoom()` in `apps/web/src/play/lab-room.ts`, with the `@hm/labkit` props: the free-standing gate, the console, the relays, the planet table, the preset rack, the bench and the combiner. Its window shows a painted forest (`paintForest`) with rain on the glass.
  - `lab-room.ts` imports `panelTextures` and others from `lab-scene.ts`. Keep those working, or move them into the new lab's module.
- **The target art:** `docs/concept/setmix/04-menu-setmix.png` (SetMix) and `05-menu-goblin-racing.png` (the Goblin Racing edition, `EDITION === 'goblin-racing'`). Keep the left third calm: the menu sits there.
- **The sync-loss glitch to match:** Play's stage-0 look and its sync-loss glitch, in `apps/web/src/play/portal-shaders.ts` and `play-scene.ts`.

## Build
1. **One lab.** The menu draws Play's lab room, not the old arch lab. Use the same `createLabRoom` with the gate powered on, lit as in the concept art. Through the gate, show what 04 and 05 show for each edition.
   - Pick the camera framing from the art.
   - Delete the old arch lab code that nothing uses any more. Do not keep two labs.
2. **The window (POL-01), in `lab-room.ts`, so Play's lab gets it too.** Replace the painted forest with a desolate, barren wasteland: the stage 0/1 planet (rock, dust, scree, no plants). It glitches all the time:
   - a black-and-white CRT dither;
   - scanlines that jitter sideways now and then;
   - chromatic aberration that flares and settles, as when you lose sync at stage 0.

   Draw it in one shader on the window plane: no extra scene. The rain on the glass stays.
3. **Rules that hold.**
   - It loads behind the existing loading bar; the e2e waits for `window.hmLab.ready && window.hmLab.frames > 5`. Keep that hook.
   - Hold 60 fps on the minimum-spec laptop on Low; the old menu did.
   - No pop when the menu opens.
4. **e2e:** keep the home checks passing. Add one check: the menu's lab has the free-standing gate, and no arch. Expose something cheap on `window.hmLab` for that.

## Report back
What changed and what was deleted, verify and e2e results, and screenshots of the SetMix menu and the Goblin Racing menu.
