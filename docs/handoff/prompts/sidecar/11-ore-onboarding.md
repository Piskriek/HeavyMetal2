# Sidecar task 11: no ore soft-lock, and teach where ore comes from (URGENT: a playtest blocker)

**Do this next: finish the TASK-08 item you are on, push it, then do this before the rest of TASK-08.** Pull `main` first. Work on `main` and push there (no PRs). Before you push, run `node scripts/verify.mjs` and `E2E_GPU=1 node scripts/e2e-smoke.mjs`; both must pass. Commit the built `apps/web/dist/index.html` with `git add -f`. Never delete or weaken an existing check.

## What happened
The owner's brother played: "he put down a texture mill and ran out of ore and stopped playing cos he didnt know how to get more ore". It is a real soft-lock:
- A new plot starts with 60 ore (`newPlot`, `@hm/plotsim`). The mill costs 24 and burns 0.6 ore a second, so the rest runs out in about a minute.
- A rock drill costs 18, so once the ore is gone the player can never afford one. Taking the mill down refunds only 12.
- After the first machine, the objective only lists the next stage's needs (`objective` in `apps/web/src/play/quest.ts`). Nothing says that ore comes from rock drills.

## The rule (now in `docs/SETMIX_PLAN.md` Phase 5a)
A player can always get ore. No state of the plot leaves them without a way forward, and the game says plainly what that way is.

## Build
1. **Gather ore by hand.** This is how factory games start (Factorio and Satisfactory both hand-mine first).
   - Look at a boulder on the plot (the ground already scatters boulders round the gate) and hold E to gather ore: 3 ore a second while held.
   - Each boulder holds about 40 ore; it shrinks as you take it and crumbles when empty. Boulders regrow slowly, one every few minutes, near rock and scree.
   - The hint reads "Hold E: gather ore". In third person the scientist kneels (the plant clip) while gathering.
   - The first time, a toast: "Ore gathered by hand. A rock drill mines it for you."
2. **A quest step for the drill.** After the first texture mill stands, a new step comes before 'done':
   - Title "Feed your mill". Hint: "It burns ore. Build a rock drill (B) on rocky ground: rock and scree hold the most."
   - While this step is open, the rock drill's card in the build menu is highlighted.
   - **The first rock drill is free** in this step, so even a player who waited until the ore ran out can place one.
   - The step ends when a drill runs; then 'done' (the stage goals) as now. Bump the save version with a migration: a plot at 'done' with no drill goes back to this step.
3. **Out of ore with no drill.** The HUD's ore line turns amber with "Out of ore: hold E on a boulder, or build a rock drill". The existing ore-out toast says the same. The ore rate shows its sign (+0.1/s, -0.6/s), so falling ore is obvious before it hits zero.
4. **Tests:**
   - Unit (quest): the new step and its migration, and that the first drill is free in that step.
   - e2e:
     1. Place the first mill: the objective says to build a rock drill, and the drill card is highlighted.
     2. Drain the ore to 0 (a debug hook): a gathering hook (hold E on a boulder, or `hmPlay.gather(seconds)`) raises ore.
     3. The free drill can be placed at 0 ore, and the step moves on when it runs.

## Report back
What changed, verify and e2e results, and screenshots of the "Feed your mill" objective with the highlighted card and of gathering at a boulder (no overlays).
