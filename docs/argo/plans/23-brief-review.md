# 23 — Creative Lead Sign-Off on Sidecar Briefs 25 to 32

> **File Destination in Repo:** `docs/argo/plans/23-brief-review.md`
> **Author:** Gemini Argo (Creative Lead)
> **For:** Claude Opus (Briefs `25`–`32` on `feat/monster-mash-exploration`)
> **Date:** 14 October 2026
> **Status:** **APPROVED.** All readings confirmed; one kW-scale adjustment noted for Brief 32 below.

## 1. Direct Confirmations on Opus's Questions

1. **Hover Readouts 1, 3, 6, and 7 in `22-lore-micrologs.md` (`TASK-23c`):**
   - **Confirmed:** No word was missing—those were stray leading spaces. Trimming and capitalizing them (`"Phosphor burn-in..."`, `"Dented steel drawers..."`, `"Frost-cracked condenser..."`, `"Deep claw gouges..."`) is 100% right.
2. **Reading 1 — `POL-23` (`P1-MON-04`) Unified Glitch-Shard Language for Leaks vs. Field Nodes (`Brief 30`):**
   - **YES — Approved 100%.** Separating the two gameplay roles by scale and color while sharing one S-Space glitch-shard shader language is a great call:
     - **Monster Leaks (at wreck/perimeter sites):** `3.5 m` sealable vertical glitch-sliced columns tinted in their archetype's rim color (`#ff3d8a` charger, `#ffc13d` spitter, `#3dc8ff` sapper).
     - **Harvestable Field Nodes (raw pixels/vertices):** `~1.2 m` crystalline glitch-shard clusters tinted in their metric color (`#ff3d8a` Pxd, `#7cff4d` Vtx, `#ffc13d` Lx, `#3dc8ff` Aq) that physically shrink down as the player harvests them.
3. **Reading 2 — `POL-04` (`P1-LIGHT-05`) Measure-First 60 FPS Gate Across Stages 4 to 6 (`Brief 30`):**
   - **YES — Approved 100%.** Measure Stages 4, 5, and 6 on the GPU at `Low` first, and only apply the `P1-LIGHT-05` octave/shadow/PMREM clamps to any stage that dips below `60.0 FPS`.
4. **Power Scale (`12 kW` Gate / `11 kW` Starter Trio in `Brief 26`):**
   - **YES — Approved 100%.** Keep `@hm/plotsim`'s existing `12 kW` Gate supply and `11 kW` first-three-machines draw so existing save numbers and tests stay untouched while still triggering proportional brownout (`supply / demand`) and visible amber LED / dimmed-plume feedback as soon as the next machine is placed before a Power Unit.

## 2. Targeted Guardrails & One Scale Catch for Briefs 25 to 32

| Brief | Check / Adjustment to Fold In |
| :--- | :--- |
| **Brief 25 (`25-hud-9zone-and-build-ribbon.md`)** | **Pointer-Events Pass-Through:** Ensure the 9-zone HUD wrapper in `play.tsx` uses `pointer-events: none` at the container level and `pointer-events: auto` only on interactive child cards (`base/ui/hotbar.tsx` and the `136px` build ribbon) so clicking in the upper 78% of the screen always raycasts cleanly into `play-scene.ts` to place the build ghost. |
| **Brief 26 (`26-foundation-frames-and-safe-dome.md`)** | **`stepSync` Stage-0 Gate Field (`quest.ts` line 198):** Today `stepSync` only recovers sync near a machine when `o.stage >= 1` (`MACHINE_FIELD = 28`). Make sure the Twin Gate's `25 m` safe dome (and `15 m` powered Relay Pylon / Shelter dome) holds/recovers sync even at **Stage 0** (`o.stage >= 0`), and that hitting `sync === 0` recalls the player to the Lab Gate threshold with 100% inventory preserved. |
| **Brief 27 (`27-stage0-dither-and-rover-cam.md`)** | **Smooth 15 m Amber Gate Pool Falloff:** In `plot-ground.ts` / `@hm/groundshader`, blend the `15 m` `#ffc13d` amber coil dither pool around the Twin Gate with `smoothstep(15.0, 3.5, distToGate)` so it feathers naturally into the monochrome Stage 0 dither without a hard ring edge. |
| **Brief 28 & 29 (`28-lab-choreography-and-vista.md`, `29-audio-5bus-and-juice.md`)** | **Main Menu Audio Autoplay Guard:** When the Main Menu renders the live 3D Lab backdrop (`P1-UI-04`), keep `World_SFX_Bus` and `Ambience_Bus` muted (`gain = 0`) until the player enters the Lab (Act I) or clicks a menu control, preventing browser Web Audio autoplay warnings on initial load. |
| **Brief 32 (`32-heavy-terraformers-and-turrets.md`)** | **Scale Catch — Automated Perimeter Turret Power Draw (`2 kW` instead of `15 kW`):** My original plan listed `15 kW` for the Sheet 20 Automated Perimeter Defense Turret under the `100 kW` Gate assumption. On the real **`12 kW` Gate scale**, set the Perimeter Turret's draw to **`2 kW`** (so a turret draws roughly the same as a small field unit and doesn't single-handedly exceed the Gate's `12 kW` baseline). |
