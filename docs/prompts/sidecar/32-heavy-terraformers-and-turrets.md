# TASK-32: the heavy terraformers from sheet 17, the vehicle fabricator's bay, the sidearm and the perimeter turret (Wave D)

After Wave C. The sources:
- Argo's `11-core-loop.md` (P1-LOOP-04, P1-LOOP-05);
- `19-vehicles-weapons.md` (P1-VEH-04, P1-VEH-05);
- his reply `ARGO_MASTER_PLAN_REPLY.md` §3, brief 32, and ruling 06, which win where they differ. **D3 stands:** the shape press, light projector and water maker are heavy hardpoint machines; the only field machines are the drill, the pylon and the starter mill. No weak field duplicates.

The research (Satisfactory's tiers, Planet Crafter's machine progression, Deep Rock's and Factorio's turrets) is in the plans' §3.

**The owner's rules:**
- terraformers are "more expensive, heavier, and far more efficient" (CLAUDE.md §6.1);
- machines are grounded, cabled, functional, square-sectioned, and spew pixel plumes only while running;
- nothing floats;
- no lettering.

## First: the art (Opus, before this task starts)
Opus generates and packs the models through the asset pipeline (RUN.world images, local Hunyuan3D, the post step, the four-angle review, the luminance gate):
- the heavy shape press, heavy light projector and heavy water maker from `docs/concept/setmix/17-sheet-heavy-terraformers.png`, replacing the 1.9× scaled stand-ins (POL-24);
- the vehicle fabricator's gantry from `19-sheet-vehicle-fabricator.png`;
- the perimeter turret from `20-sheet-weapons.png`, as separate parts (base, yoke, gun) per the split-parts rule.

This brief starts when they are in `registry.json`; the board will say so.

## Build
1. **Heavy terraformers on hardpoints (P1-LOOP-04).**
   - Each sits on an 8 m hardpoint: a snapped 2×2 foundation hardpoint (`@hm/structure`), fed from a linked bin (`@hm/lattice`).
   - Bind the new models to the existing heavy kinds (`heavy-press`, `heavy-projector`, `heavy-water`, and `heavy-mill` if sheet 17 has it) in `@hm/plotsim`, which already holds their draw and rates.
   - Their plumes leave from the exhaust sockets (TASK-29, TASK-31's socket file).
   - The first heavy light projector is the "blue sky" moment (ruling 06): make sure its stage push reads, with TASK-30's wave band.
2. **Peaceful drops (P1-LOOP-05).** Every core or fragment a monster drops can also come from sealing a dormant leak, or from fusing salvage and a blank cartridge at the lab's combiner, so Aggression Off and Calm never block progress. Check `@hm/leaksim`'s drop table against the recipes; add the combiner recipe if one is missing.
3. **The vehicle fabricator's bay (P1-VEH-04).**
   - Printing a scout or a hauler plays a 3 s gantry assembly on the new model, a pure timeline that is testable.
   - The scout gets one rear socket (a portable linked ore bin, or a sync beacon that makes a 15 m safe dome, TASK-26); the hauler gets three (bulk ore, or a turret).
   - The socketed items are base items with their existing rules.
4. **The sidearm and the turret (P1-VEH-05).**
   - **The sidearm:** the weapon bench already forges guns (F-03). Make sure a scatter configuration exists, square receiver and round barrel, for close defence against swarmers and chargers, using the packed parts (`barrel-scatter`, `core-burst`, `weapon-frame`).
   - **The turret:** a buildable on the sheet-13 corner and roof sockets, drawing grid power (about 1.5 kW on this game's scale; the gate gives 12). It targets sappers and swarmers within 35 m, shows an amber #ffc13d targeting laser, and fires through leaksim's raycast. It never fires into the safe dome, and never at the player or pieces. Brownout slows its rate of fire (TASK-26).

## Tests
- **Unit:**
  - a heavy machine needs its hardpoint and its bin feed;
  - the drop table against the peaceful recipes (every drop has another source);
  - the gantry timeline;
  - the sockets' capacity;
  - the turret's target choice (sappers and swarmers first, range, dome);
  - the turret under brownout.
- **Extend `scripts/test-campaign.mjs`:**
  - build a heavy projector on a hardpoint and see the stage push;
  - print a hauler with the gantry;
  - put a turret on a roof and have it hit a swarmer at 30 m and ignore one inside the dome.
- **Shots:**
  - each heavy machine running, from three sides;
  - the gantry mid-print;
  - the turret tracking.
  
  Look at every one.
- **The usual green set,** with the build size and fps on Low with four turrets running.

## Report
On the board:
- the shots;
- the drop table check;
- fps;
- the results.
