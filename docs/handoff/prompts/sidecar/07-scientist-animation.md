# Sidecar task 07: the scientist moves (Mixamo animations), and no more T-pose

The owner (2026-10-08): "first polish the scientist and base game". **This comes before TASK-06 and TASK-05.** Pull `main` first. Work on `main` and push there (no PRs). Before you push, run `node scripts/verify.mjs` and `E2E_GPU=1 node scripts/e2e-smoke.mjs`; both must pass. Commit the built `apps/web/dist/index.html` with `git add -f`. Never delete or weaken an existing check. Log rough spots in `docs/DEFERRED_POLISH.md`.

## The clips
14 Mixamo animations for the scientist's own rig (Mixamo bone names `mixamorig:*`). They are FBX Binary, without skin, at 30 fps, with locomotion "in place". They are in `zips/Models/rigged/anims/` (gitignored, 8.4 MB):
- breathing-idle, looking-around;
- walking, running, left-strafe-walking, right-strafe-walking, walking-backwards, jump;
- pulling-lever, button-pushing, plant-a-plant, waving, cheering, pointing.

Each clip was checked by its mean hips height: all stand (about 1 m) except plant-a-plant, which kneels as it should (about 0.5 m). A seated typing clip and a crouched pointing clip were set aside in `_unused/`; do not use them.

The model is in `apps/web/src/avatar/scientist/`. Fix POL-18 while you are there: import the .fbx with Vite `?url` and delete the 1.6 MB base64 `.ts`.

## Build
1. **Pack the clips.** Write `scripts/pack-anims.mjs`, which reads the 14 FBX files once, offline, with three's `FBXLoader` (it parses animation-only FBX in Node).
   - Keep the bone rotation tracks and the hips' position. Drop scale, and drop any track that never moves.
   - Thin the keys within a small error, quantise the quaternions to 16 bits, and write one binary, `apps/web/src/avatar/scientist/anims.bin`.
   - Add a loader that rebuilds `THREE.AnimationClip`s from it. Unit-test the loader's decoding (a round trip within the quantisation error).
   - **Budget:** the packed clips add at most 800 KB to `apps/web/dist/index.html`. Report the size.
   - Commit the script and the `.bin`; the FBX stay in zips. Add "Animations: Adobe Mixamo (mixamo.com)" to `CREDITS.md`.
2. **The animator.** Write `apps/web/src/avatar/scientist/animator.ts` around one `AnimationMixer`:
   - **idle:** breathing, with a looking-around every 12 to 25 s.
   - **locomotion:** walk, run, the two strafes and walking backwards, blended by speed and direction.
   - **jump.**
   - **one-shots:** lever, button pushing, plant, wave, cheer and point. Each crossfades in and out over about 0.25 s and returns to idle.
3. **Where it shows:**
   - **The creator preview:** breathing idle, an occasional looking-around, and a wave when the player presses Done. This replaces the hand-set relaxed pose.
   - **The SetMix menu:** the scientist at the gate breathes and looks around (no T-pose). Now and then, every 30 to 60 s, they point at the open gate.
   - **Play, a third-person view:**
     - V switches between first person (as now, the body hidden) and an over-the-shoulder third-person camera that does not pass through the lab's walls or props.
     - In third person the scientist walks, runs, strafes and jumps with the player's movement.
     - The player's own actions play their clips: pulling the main lever plays the lever clip, placing a machine plays plant, a stage rising plays cheer, and a lab panel open plays button pushing (standing at the console or the machine).
     - In first person nothing changes, apart from the clips running for the shadow if one is drawn.
     - The view choice is saved in the profile.
   - **The Goblin Racing edition** keeps its goblin; nothing here changes it.
4. **Low-end check:** one skinned mesh at about 33k triangles and one mixer is cheap. Measure third person on Low in the lab and on the plot, and report fps (do not tune it; log any gap).
5. **e2e:**
   - In the creator, a bone of the scientist moves between two frames (it is animating).
   - In the menu, the figure's upper arms hang down (no T-pose).
   - In Play, V gives third person; while walking (a debug hook may push the move), the walk clip's weight is above 0.5; the lever plays the lever clip.

## Report back
What changed, the packed size, verify and e2e results, fps in third person on Low, and screenshots: the creator, the menu, and third person walking on the plot.
