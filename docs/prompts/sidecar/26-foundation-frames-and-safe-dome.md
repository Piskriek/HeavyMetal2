# TASK-26: industrial foundations, the safe dome, no soft-lock, brownout you can see (Wave B)

After `main` (Wave A); it can run beside TASK-25 if you stay out of the HUD zone module (`base/ui/hud-zones*`).

**The sources:**
- Argo's plans: `13-layouts-and-lab.md` (P0-LAYOUT-01), `12-first-hour.md` (P0-HOUR-01), `11-core-loop.md` (P0-LOOP-01, P0-LOOP-02);
- the master plan's §0 handoff, which puts all four in this brief;
- his reply `ARGO_MASTER_PLAN_REPLY.md`, which wins where it differs:
  - **D3 stands:** the field machines are only the rock drill, the relay pylon and the starter texture mill; the press, projector and water maker are heavy machines on foundation hardpoints;
  - **the safe domes:** 25 m at the gate and 15 m at a powered pylon or the shelter.

The research (Satisfactory's foundations, Subnautica's safe shallows, Factorio's brownout) is in each plan's §3.

## Build
1. **Foundations from sheet 13 (P0-LAYOUT-01).**
   - **Today:** a placed foundation reads as a flat red slab with blue rings (tour shot `docs/argo/tour/10-foundation-placed.jpg`).
   - **Find where the base game draws it:** `base/kit-pieces.ts` (procedural) or the generated `foundation` model in `assets/gen/registry.json`, a lattice piece with its box. TASK-10b gave every lattice kind its generated model; find why this one does not read that way (the material, a stage tint, the socket rings).
   - **The target** is sheet 13 (`docs/concept/setmix/13-sheet-base-construction.png`): a gunmetal box-section frame, a grated deck and a hazard-striped rim.
   - **Socket indicators** show only while placing.
   - **Corner legs on slopes:** square-section legs (the owner's rule) extend from each corner down to the ground, up to 3 m. Each leg is its own object, standing on the terrain, never floating.
   - Keep the lattice snapping and the integrity rules exactly as they are.
2. **The safe dome (P0-HOUR-01).**
   - Sync already drains on the planet and refills in the lab (`play/quest.ts`, `quest.test.ts`).
   - **Inside a dome sync never drains, and refills at 20% a second.** The domes are 25 m round the gate, and 15 m round any powered relay pylon and the starter shelter.
   - **Outside, it drains over 90 s** of raw stage-0 ground. Keep today's rule that a running machine slows the drain.
   - **At 30%:** a soft radio-static cue, plus an amber arrow pointing to the gate, in the compass when TASK-25 has it, else at the screen edge.
   - **At 0%:** recall the player to the lab side of the gate (Argo's plan) with **nothing lost**: the same zero-loss rules as a death (campaign beat 26).
   - **Dr. Haddy's line:** use an approved line from `docs/NARRATION_SCRIPT.md` if one fits. If not, show Argo's text as a subtitle-only radio message, flagged on the board for the owner. Never generate voice.
   - **Visual:** the dome's edge is a faint amber ripple only where the player crosses it. Monsters already respect the 25 m gate dome (TASK-23b-2).
3. **No soft-lock (P0-LOOP-01).** Prove with a test that from ore 0 and no running drill, the player can always reach a rock drill's cost (18 ore) by holding E on boulders, by the beam's Extract, or by lab salvage (TASK-23c). All three feed the same inventory. Fix any path that cannot.
4. **Brownout you can see (P0-LOOP-02).**
   - **The sim already runs machines in proportion** (`@hm/plotsim`: satisfaction = min(1, supply/demand), and an `underpowered` event). The game toasts "Not enough power", and the machine panel says "Running at X%". **Keep the kW scale** (the gate 12, the drill 3, the mill 4, the press 4, the projector 8, a power unit +16). It already makes Argo's point: the gate runs the first three machines, and a projector tips you into brownout until you build power.
   - **Make it visible:**
     - every plume's emission scales with its machine's run rate;
     - the relay pylons' pulse beads slow with the satisfaction;
     - the power readout turns amber with the percentage (in TASK-25's bottom-right zone if it has landed);
     - Dr. Haddy's power prompt plays once per shortage, with the same rule for the line as above.

## Tests
- **Unit (pure):**
  - the dome rules: inside, outside, a pylon's dome only when powered;
  - the drain and refill rates;
  - the recall keeps everything;
  - the soft-lock proof;
  - the plume and pulse rates as functions of satisfaction.
- **Extend `scripts/test-campaign.mjs`:**
  - place a foundation on a slope: the legs reach the ground (a raycast from each leg foot finds the terrain within 5 cm);
  - stand in the dome: no drain;
  - walk out: it drains;
  - at 0%: recalled, inventory intact;
  - over-build power: the plume rate drops and the warning shows.
- **Shots:** a foundation on flat ground and on a slope, at stages 1 and 6, from three sides; the dome edge; a brownout. Look at every one.
- **The usual green set,** with the build size.

## Report
On the board:
- before and after of tour shot 10;
- the dome numbers;
- the soft-lock proof;
- the brownout shots;
- the results.

## Argo's sign-off (14 October, docs/argo/plans/23-brief-review.md)
Approved as written, plus:
- **Stage 0 too:** `stepSync` in `apps/web/src/play/quest.ts` (about line 205) refills sync near a machine only from stage 1 (`o.stage >= 1 && o.nearMachine`, `MACHINE_FIELD` 28). The gate's 25 m dome and the powered pylon's and shelter's 15 m domes must hold and refill sync **at stage 0** as well. Keep the machine rule as it is.
