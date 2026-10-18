# T03P-R: Argo's five plume rulings (POL-261, ARGO_NOTE_16)

**Spec:** `docs/argo/notes/ARGO_NOTE_16_ticket13_turret_and_plumes.md` §2 (read it fully). **Builds on:** T03P (572f4434) and its follow-up (44b6107f). Find the plume code by searching for `PIXELS_OF`, `machinePlumeSpec`, `FABRICATOR_PLUME`, `GEN_FEED` and `findMachineVent`, not by line number.

## Do
1. **Live pixel counts (ruling 1).** The live count is rate × life. Set:
   - rock-drill: 48/s × 2.0 s (96 live);
   - texture-mill: 56/s × 2.5 s (140);
   - power-unit: 56/s × 2.0 s (112);
   - relay-pylon: 30/s × 1.2 s (36 corona sparks);
   - heavy-press, heavy-mill and heavy-water: 72/s × 2.5 s (180);
   - heavy-projector: 80/s × 2.5 s (200);
   - the fabricator while printing: 64/s × 2.0 s (128).
   
   Machines the ruling doesn't list (the starter press, the projector, the water maker) keep their current numbers. A machine that's off or out of ore still pours nothing, and the run-rate scaling still reaches 0.
2. **Power unit and pylon (ruling 2):** keep the violet steam and the corona sparks as they are. No change; the test still covers them.
3. **Feed hoppers (ruling 3).**
   - Ore cubes drop in on: the texture mill and heavy mill, the shape press and heavy press, the water maker and heavy water maker, and the fabricator while it prints.
   - No cubes on: the rock drill, the light projector and heavy projector, the power unit and the pylon. Remove any cube feed they have.
   - The fabricator has no measured hopper. Drop its cubes into the top of the print head (the `fabricator-head` part) while printing, following the head as it moves.
4. **The fabricator's colour (ruling 4):** Synthesis Violet `#b46bff` (`METRIC_COLOURS.all` in `@hm/plume`), replacing `#e6e9ee` in `FABRICATOR_PLUME`.
5. **Side-stack vents (ruling 5).** The mill (and heavy mill) and the press (and heavy press) pour from their measured `vent` sockets in `apps/web/src/assets/gen/registry.json`, not from the top: mill `(1.715, 2.28, -0.48)`, press-frame `(0, 3.44, -0.56)`. The heavy kinds add the ring height, as GEN_FEED does. The top openings take only the falling cubes. Read the vents from the registry, the way GEN_FEED reads the feeds; don't hard-code a raycast.
6. Update POL-261 in `docs/DEFERRED_POLISH_REGISTRY.md`: rulings 1 to 5 done, with the commit. The package half (gravity and a count uniform) is Flash's F-21; the pylon's ballistic arc waits for it.

## Verify
- **Extend `scripts/test-machine-plumes.mjs`:**
  - each listed machine's live count matches the ruling (within one pixel);
  - the drill, projectors, power unit and pylon drop no cubes;
  - the fabricator drops cubes into the head while printing, and none when idle;
  - the fabricator's plume colour is `#b46bff`;
  - the mill's and press's plume origin is at their side vent: more than 1 m from the top hopper, and within 0.3 m of the registry's vent after the machine's transform.
- **Shots** (close, HUD hidden if the test supports it; prove the subject is in view):
  - the mill and the press, showing cubes in at the top and pixels out of the side stack;
  - the fabricator printing in violet.
  
  Look at every one.
- **Timings:** `measure-stage6-low --fps-only` on the worker, with `--worker-only`. Report the GPU ms and draw calls against 0.80 ms and 126.
- **Runs:**
  - `npm run typecheck` on the laptop;
  - then `scripts/test-on-3dpc.sh --worker-only --only "apps/web/src/play/play-scene.ts apps/web/src/play/machine-props.ts scripts/test-machine-plumes.mjs" "npm run build && node scripts/test-machine-plumes.mjs"`;
  - `npm test`;
  - `node scripts/test-campaign.mjs` (45 of 45).

## Stay inside
`play-scene.ts` (the plume emitters and feed cubes only), `machine-props.ts`, `scripts/test-machine-plumes.mjs` and the registry entry. Another Haiku owns `play.tsx`, `apps/web/src/credits/`, `lab-room.ts`, `goblin-front.tsx` and the HUD zone files (T14). Flash owns `packages/plume/` (F-21). Never touch those. Use POL-281 to POL-290 for new registry entries.

## Git
- Commit by explicit paths, after checking `git diff --cached --stat`.
- End messages with `Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>`.
- Never commit `apps/web/dist/index.html`, and never push.
