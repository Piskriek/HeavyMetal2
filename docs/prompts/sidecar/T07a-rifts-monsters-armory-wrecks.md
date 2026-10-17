# T07a: S-Space rifts, monsters that spawn, the armory sidearm, the ammo badge, wreck salvage (TICKET-07, part A)

**Spec:** OPUS_NOTE_14 (in the Setmix Drive). **Source:** `arena-gathered/argo-ticket07/`.
- This part uses: `rift.ts` and its test, `monsters.ts` (full replacement, +140/−129) and its test, `armory-rack.ts` and its test, `lab-room.ts` (+2), `wreck-sites.ts` (+135/−8), `wrecks.ts` (+112/−30) and its test.
- `vehicle-juice.ts` belongs to T07b (Flash). Don't install it.
- None of the replaced files has changed since Argo's snapshot, so copy them.
- Opus's staging run: rift 2 of 2, armory 2 of 2. The monsters and wrecks tests import `apps/web/src/monsters/*`, so they only run once installed.

## Do
1. **Install** the files above, and run their tests in the repo.
2. **The rift:** it replaces the old leak marker (`apps/web/src/monsters/leak-visual.ts`, created through `createLeakVisuals` in `monsters.ts`) wherever Argo's `monsters.ts` swaps it. Open, sealing and sealed follow the leak's state. Keep `leak-visual.ts` only if something else still imports it.
3. **Spawning:** with Argo's `monsters.ts`, an open leak within about 40 m spawns its archetype at a readable pace, capped per leak. Sealed leaks stop spawning.
4. **The armory sidearm:** `lab-room.ts` places Argo's `armoryRack` on the east-wall rail. E on its pickup point equips the sidearm in the existing equipment slot, with the same say/toast pattern as other pickups. The SEMI ammo badge in `play.tsx` shows only when `shouldShowAmmoBadge` (equipment.sidearm) is true.
5. **Wrecks:** the trucks lie tilted and part-buried (Argo's `settleWreck`). Holding E on one salvages it, using the existing lab hold-E salvage pattern in `play.tsx` (`HOLD_E` with its progress ring). Its log goes through the existing `readLog` / lore-logs flow. Salvage items go to the pack, then the network, the way lab salvage does.

## Verify
- **A new `scripts/test-ticket07a.mjs`:**
  - a leak shows the rift (no old marker mesh), and turns amber while sealing;
  - standing near an open leak spawns at least one monster within 20 s; a sealed leak spawns none;
  - the SEMI badge is hidden before pickup and shown after picking up the armory sidearm;
  - a wreck truck's pitch or roll isn't 0 and it sits on or below the ground (never floating);
  - hold-E salvage on a truck adds its items and its log.
  Save shots of the rift (open and sealing), the armory, and a salvaged truck, and look at them.
- Run typecheck on the laptop. Run the rest through `scripts/test-on-3dpc.sh --only "<your paths>" "npm run build && …"`: `npm test`, the new test, `test-machine-inspector`, `test-build-ux` and `test-campaign` (45 of 45).

## Stay inside
`apps/web/src/play/monsters.ts`, `rift.ts`, `armory-rack.ts`, `lab-room.ts`, `wrecks.ts`, `wreck-sites.ts` and their tests; `apps/web/src/monsters/` (only if a swap needs it); `play.tsx` (the badge and the hold-E salvage only); and the new test. **Flash owns `play-scene.ts` right now: don't touch it.** If the rift or spawning truly needs a `play-scene.ts` hook, stop and report it.

## Git
- Commit by explicit paths, after checking `git diff --cached --stat`.
- End messages with `Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>`.
- Never commit `apps/web/dist/index.html`, and never push.
