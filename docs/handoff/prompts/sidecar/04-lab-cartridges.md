# Sidecar task 04: the lab makes cartridges, the plot's machines take them (POL-10)

The rules are landed: `packages/cartlab` (`@hm/cartlab`, 23 tests, strict clean). Add it to `tsconfig.json` paths and the `apps/web/vite.config.ts` aliases the way `@hm/plotsim` is. Do this after tasks 01 to 03.

Pull `main` first. Work on `main` and push there (no PRs). Before you push, run `node scripts/verify.mjs` and `E2E_GPU=1 node scripts/e2e-smoke.mjs`; both must pass. Commit the built `apps/web/dist/index.html` with `git add -f`. Log rough spots in `docs/DEFERRED_POLISH.md`; do not tune frame rates.

## The game (rules: `packages/cartlab/src/index.ts`; read its API first)
A cartridge in a pixel machine's slot scales what the machine pours, per metric, by its affinity. The lab makes cartridges with the three machines the owner picked from concept sheet 07:
- **Blanks** cost ore (`RULES.blankCost`). Ore is the plot's one stock (`plot.ore`), because the gate links the lab and the plot. `makeBlank` returns `oreUsed`; take it off `plot.ore`.
- **The preset bench** writes a preset onto a blank (`startWrite`).
  - Presets come from `@hm/vault`: `VAULT` entries have `id`, `name`, `affinity` and `minStage`. Pass them as `env.presets`.
  - Only presets the plot's stage has opened can be written.
- **The preset combiner** mixes 2 to 4 written cartridges into one (`startCombine`).
  - Preview the result before starting: `step(startCombine(lab, env, ids), env, RULES.combineSeconds)` on the pure state gives the finished mix without touching the real state.
- **The preset rack** holds them (`RULES.rackSize`).
- **Power:** the lab works only while the gate is on (`env.powered = gateOn`). `env.stage = plot.stage`.

## Where things are
- **Play:** `apps/web/src/play/play.tsx`, the screen, refs, the loop, the planet machine panel.
  - The panel currently offers vault presets by stage (`cartridgesFor`, `affinityOf`). Replace that with the rack.
- **The save:** `apps/web/src/play/quest.ts` (`PlayState`; task 01 bumps `v` to 3).
- **The lab's props** (`presetBench`, `presetCombiner`, `presetRack`) are placed in `apps/web/src/play/lab-room.ts`. Their sockets are in `packages/labkit/src/index.ts`.
- **Aiming:** `apps/web/src/play/play-scene.ts` already aims at planet machines (`aimed`) and at the lever. Add the lab's three machines the same way.

## Build
1. **The save.** Add `lab: LabState` to `PlayState`. Bump `v` and migrate: `newLab()` for old saves.
   - An old save whose plot machine holds a vault preset id as its cartridge gets that preset as a written cartridge in the lab, slotted in that machine, so nobody loses a cartridge.
   - Unit-test the migration.
2. **The loop.** Every frame: `step(lab, env, dt)`.
   - Toast the events: "Mud written.", "Mix ready: Mud + Terrain shaping.", "The bench stopped: no power."
   - Save on events and with the plot's 5-second commit.
3. **Panels in the lab** (E on the machine; the same look and the same `freeMouse`/no-pause behaviour as the planet machine panel):
   - **Rack:** every cartridge (name, kind, each metric's effect as +/-% in `METRIC_COLOUR`), which machine holds it, and "Make a blank (12 ore)".
   - **Bench:** pick a blank and an opened preset (locked ones say "opens at stage N"), Start, and a progress bar.
   - **Combiner:** pick 2 to 4 written cartridges, see the preview mix, Start, and a progress bar.
   - Every refusal shows cartlab's own `why` sentence.
4. **The planet machine panel:** the cartridge list becomes the rack's written cartridges that are free, plus the one in this machine.
   - Choosing one calls `slotInto` (cartlab) and `setCartridge` (plotsim); taking it out calls `unslot` and `setCartridge(null)`.
   - plotsim's `env.affinity` becomes `(id, metric) => affinityOf(lab, id, metric)`.
   - Taking a machine down unslots its cartridge (back to the rack).
   - A machine holds one cartridge. cartlab's `canSlot` does not check the machine, so when the player picks another cartridge for a machine that holds one, unslot the old one first.
5. **Pixels while working** (the machine language: "a machine that is off spews nothing"). Use one `@hm/plume` in the lab:
   - the bench pours pink (`#ff3d8a`) while writing;
   - the combiner pours violet (`#b46bff`) while mixing;
   - the rack shows a faint violet wisp at its indexer while cataloguing.
   - Drive them from `activity(lab, env)`, with the emitters at the props' sockets.
   - Compile it behind the loading bar (`warm()`).
6. **e2e** (`scripts/e2e-smoke.mjs`, Play section): add `hmPlay.lab()` (the state) and `hmPlay.labStep(seconds)` (fast-forward) hooks. Then check, in order:
   - make a blank;
   - write a preset;
   - fast-forward;
   - see it written;
   - slot it into the mill from the planet panel;
   - the mill's metric rate changes by the cartridge's affinity.

## Report back
What changed, verify and e2e results, screenshots of the three lab panels and of the bench pouring pink.
