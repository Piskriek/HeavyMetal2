# 11 — Core Loop, Mechanics, Progression & Economy Plan: Closing the Feedback Circuit

## 1. The Goal: A Self-Reinforcing Loop Where Every Machine Visibly Upgrades Reality

A AAA survival-automation game lives or dies by how tightly its micro-loop (gather $	o$ process $	o$ build) drives its macro-loop (world transformation $	o$ new hazards $	o$ new tools). In **FIDELITY**, every resource gathered and every machine wired must produce an immediate, visible, local change in the four floats `S = (Pxd, Vtx, Lx, Aq)`, culminating in radial stage-upgrade waves that physically transform the 1 km plot and unlock deeper Studio synthesis.

## 2. Where It Stands Today

- **What Exists:**
  - Pure math and economy packages: [`packages/fidelity/`](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/packages/fidelity), [`packages/plotsim/`](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/packages/plotsim), [`packages/structure/`](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/packages/structure), [`packages/lattice/`](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/packages/lattice), [`packages/substrate/`](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/packages/substrate), [`packages/cartlab/`](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/packages/cartlab), and [`packages/vault/`](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/packages/vault) (50 texture cartridges + 100 fusion recipes).
  - First-hour loop (Lab wake $	o$ Gate $	o$ Moon arrival $	o$ first Texture Mill in [`08-first-machine.jpg`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/08-first-machine.jpg)) and the `TASK-11` ore soft-lock fix (hand-gathering boulders with `E` + free first Rock Drill).
  - `TASK-22` ([`docs/prompts/sidecar/22-campaign-chain.md`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/prompts/sidecar/22-campaign-chain.md)) wires Acts IV–VI quests (`A4-01` pick up rifle $	o$ `A4-02` mine 50 dirt & process at mill $	o$ `A4-03` Studio terminal $	o$ `A4-04` first Stage 2 color bloom $	o$ `B-01` foundation $	o$ `B-05` linked bin).
- **What Is Weak or Missing:**
  - **Disjointed Early Economy (`Dirt` vs. `Ore` vs. `Salvage`):** Because hand-gathering boulders (`TASK-11`), beam-mining 50 dirt (`TASK-22`), and dissolving lab clutter (`TASK-23c`) were added in consecutive passes, their conversion rates and machine roles need one unified table so players never wonder whether a machine wants Dirt, Ore, Salvage, or a Cartridge.
  - **Flat Stage Thresholds:** Crossing from Stage 0 to Stage 1 or Stage 2 currently happens when a float crosses a threshold, but lacks a local **Spatial Radius of Influence** per machine—meaning players don't feel the satisfaction of placing Relay Pylons ([`12-sheet-field-machines.png`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/concept/setmix/12-sheet-field-machines.png) #8) to push the high-fidelity frontier outward across their 1 km plot.
  - **Underused Cartridge Economy:** `@hm/vault` has 50 cartridges and 100 recipes, but in normal play the player only slots 1–2 basic cartridges before reaching Stage 2.

## 3. What the Best Games Do (Research & Sources)

| Reference Game | Core Loop & Economy Mechanism | Player Praise & Design Lesson |
| :--- | :--- | :--- |
| [***The Planet Crafter***](https://store.steampowered.com/app/1284190/The_Planet_Crafter/) | **Multiplicative Tier Unlocks Coupled to Visible World States:** Each metric (`O2`, `Heat`, `Pressure`, `Biomass`) has dedicated generator tiers; crossing a global index milestone unlocks recipes that require the newly formed environmental resource (e.g., harvesting water and algae only after ice melts into lakes) ([Planet Crafter Wiki](https://planet-crafter.fandom.com/wiki/Terraformation_Index)). | Players love when the *world itself* becomes the new resource node at each stage—e.g., Stage 3 water pools enabling hydro-condensers and moss harvesting. |
| [***Satisfactory 1.0***](https://www.youtube.com/watch?v=oPsb7OFp1gg) | **Dimensional Depot / Linked Cloud Bins & Zero-Tedium Building:** Once a player links a storage bin (`@hm/lattice`), building and crafting pull directly from linked bins across the plot ([Dimensional Depot Guide](https://www.youtube.com/watch?v=oPsb7OFp1gg)). | Eliminates the "walk back to 6 chests because you are 2 iron short" frustration noted in [`docs/BASE_BUILDING_RESEARCH.md`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/BASE_BUILDING_RESEARCH.md) (`D13–D16`). |
| [***Factorio***](https://store.steampowered.com/app/427520/Factorio/) | **Readable Power Satisfaction Bar & Brownout Grace:** If power demand exceeds supply (`Power Unit` + `Gate Junction`), machines slow down proportionally (brownout) and flash an amber status LED rather than shutting off 100% of the base at once ([Factorio Power Discussions](https://www.reddit.com/r/factorio/comments/szb97e/power_outage_in_factory_need_help/)). | Prevents catastrophic blackout spirals while clearly motivating the player to build a `Power Unit` ([`12-sheet-field-machines.png`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/concept/setmix/12-sheet-field-machines.png) #7) before placing high-draw machines like the `Light Projector` (#4). |
| [***Abiotic Factor***](https://store.steampowered.com/app/427410/Abiotic_Factor/) & [***Subnautica***](https://store.steampowered.com/app/264710/Subnautica/) | **Clutter Disassembly into Starter Tech:** Breaking down lab office/server furniture yields the exact components needed for your first field tools and storage bins ([Abiotic Factor Guide](https://steamcommunity.com/sharedfiles/filedetails/?id=3296702187)). | Makes the starting lab feel interactive and rewards thorough exploration before stepping into hostile territory. |

## 4. Concrete Changes Ranked P0, P1, and P2

### Unified Resource & Machine Loop Specification

| Resource / Item | How the Player Gets It (Guaranteed Non-Soft-Lock) | What Consumes It | Visual Readability |
| :--- | :--- | :--- | :--- |
| **Raw Regolith (`Dirt`)** | Infinite via Beam Tool (`Extract` mode) carving terrain anywhere on the plot (`TASK-21/22`). | **Dirt $	o$ Ore Processor** (2 Dirt $	o$ 1 Ore) and **Beam Sculpt Mode** (fills holes). | Dark grey/ochre voxel clumps vacuumed into the rifle muzzle. |
| **Substrate `Ore`** | Hand-mining boulders (`Hold E`), automated **Rock Drill** (#1), or refined from Dirt. | Building foundations, field machines, Relay Pylons, and blank **Cartridges**. | Chunky metallic polyhedrons discharged into the drill's front tray ([`12-sheet-field-machines.png`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/concept/setmix/12-sheet-field-machines.png) #1). |
| **Lab `Salvage` & `Anomaly Cores`** | Dissolving lab clutter (`Hold E` in `TASK-23c`), lunar wreck sites, or sealing/defeating **Containment Leaks** (`TASK-23b` — also synthesizable peacefully in the Combiner per Rule 23). | Upgrading tool tiers, building **Heavy Terraformers** (Sheet 17), and splicing cartridges in the **Preset Combiner**. | Glowing cyan/violet circuit modules and stabilized shareware cores. |
| **Cartridges (`.smx` / `@hm/vault`)** | Crafted blank at **Fabricator**, written at **Preset Bench** (`#ff3d8a` / `#7cff4d` / `#ffc13d` / `#3dc8ff`), or fused at **Preset Combiner** (`#b46bff`). | Slotted into **Beam Tool** (Apply/Sculpt modes) or **Field Machines** to multiply their `S` output by `2.5x` and imprint custom biome looks. | Physical chunky cassette with color-coded LED spine matching its metric. |

### P0 — Must Fix Before First Public Test

1. **P0-LOOP-01: Unify the Dirt $	o$ Ore $	o$ Cartridge Progression Table in `@hm/substrate` and `apps/web/src/play/`**
   - **What to build:** Ensure the three gathering paths (`Hold E` on boulders, `Beam Extract` on terrain for Dirt, `Hold E` on Lab/Wreck clutter for Salvage) feed a single deterministic inventory table in [`packages/substrate/`](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/packages/substrate) and [`apps/web/src/play/quest.ts`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/apps/web/src/play/quest.ts). Guarantee Rule 23 (No Soft-Locks): if `Ore == 0` and no drill is running, mining 20 Dirt with the Beam Tool or holding `E` on any surface boulder always yields enough Ore to build a Rock Drill or Blank Cartridge.
   - **Needs:** **Code** (`packages/substrate/`, `apps/web/src/play/quest.ts`).

2. **P0-LOOP-02: Enforce Proportional Power Brownout Instead of Hard Stall on the Gate & Relay Line**
   - **What to build:** In [`packages/plotsim/`](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/packages/plotsim) and [`apps/web/src/base/`](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/apps/web/src/base), set the Planet Twin Gate's foot junction box ([`06-sheet-gate.png`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/concept/setmix/06-sheet-gate.png)) to supply `100 kW` baseline power—enough for the first `Shape Press` (`30 kW`), `Texture Mill` (`35 kW`), and `Rock Drill` (`25 kW`). Placing the `Light Projector` (`120 kW`) without first building a `Power Unit` (`+250 kW`, [`12-sheet-field-machines.png`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/concept/setmix/12-sheet-field-machines.png) #7) triggers a visible brownout warning (plumes dim to 25% rate, white pulse beads on Relay Pylons slow down, and Dr. Haddy plays the Act VII power prompt).
   - **Needs:** **Code** (`packages/plotsim/`, `apps/web/src/base/`), **UI** (power bar in build HUD).

### P1 — Makes It Feel AAA

3. **P1-LOOP-03: Cartridge Multiplicative Yield & Visual Plume Tinting**
   - **What to build:** Running a field machine (`Texture Mill`, `Shape Press`, `Light Projector`, `Water Maker`) *without* a cartridge outputs `1.0x` baseline float growth with default regolith styling. Slotting a crafted cartridge from `@hm/vault` boosts that machine's float rate to `2.5x`, tints its square pixel exhaust plume to match the cartridge's dominant chromatic signature, and imprints that cartridge's procedural material (`@hm/texgraph`) onto the surrounding terrain radius.
   - **Needs:** **Code** (`packages/plotsim/`, `apps/web/src/crafter/world.ts`), **VFX** (plume tint uniform).

4. **P1-LOOP-04: Heavy Terraformer Hardpoint Progression (Stage 2 $	o$ Stage 4)**
   - **What to build:** Replace the 1.9x scaled stand-in heavy machines (`POL-24`) with the dedicated 8 m hardpoint socket progression from [`17-sheet-heavy-terraformers.png`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/concept/setmix/17-sheet-heavy-terraformers.png) (`#28 Heavy Shape Press`, `#29 Heavy Light Projector`, `#30 Heavy Water Maker`). Require a snapped 2x2 foundation hardpoint (`@hm/structure`) and linked `@hm/lattice` bin feed to construct them, creating a clear mid-game engineering goal between Stage 2 and Stage 4.
   - **Needs:** **Art** (pack Sheet 17 models via `runworld-pack.mjs`), **Code** (`packages/structure/`, `packages/plotsim/`).

5. **P1-LOOP-05: Peaceful Synthesis Alternative for All Monster Leak Drops (Rule 23 Enforcement)**
   - **What to build:** Every `Anomaly Core` or `Shareware Fragment` dropped by `@hm/leaksim` monsters must also be obtainable by sealing a dormant reality leak with the Beam Tool (`Seal` mode) *or* fusing `Salvage + Blank Cartridge` inside the Lab's Preset Combiner (`Aggression: 'off' | 'calm'` compatibility).
   - **Needs:** **Code** (`packages/leaksim/`, `packages/substrate/`).

### P2 — Stretch Goals

6. **P2-LOOP-06: Automated Relay Pylon Logistics Pulse (`@hm/lattice` Visual Beads)**
   - **What to build:** When a `Rock Drill` is connected to a `Texture Mill` or `Linked Bin` via Relay Pylons ([`12-sheet-field-machines.png`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/concept/setmix/12-sheet-field-machines.png) #8), travel a bright white energy bead (`#ffffff`) and color-coded packet pulse along the catenary sag cables whenever `@hm/lattice` transfers ore or power.
   - **Needs:** **Code** (`apps/web/src/base/view.ts`).

## 5. Rules Touched (`docs/argo/RULES.md`)

- **Rule 1 (Four floats, one formula):** Every machine and cartridge modifies only `S = (Pxd, Vtx, Lx, Aq)`.
- **Rule 2 (Purity is load-bearing):** All economy ticks, brownout ratios, and lattice transfers remain 100% deterministic pure functions in `@hm/plotsim` and `@hm/lattice`.
- **Rule 10 (Believable machines):** Material goes in at the dark feed hopper; colored pixels exit from the rear/top exhaust stack ([`12-sheet-field-machines.png`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/concept/setmix/12-sheet-field-machines.png)).
- **Rule 23 (No soft-locks):** Infinite terrain dirt mining + hand-boulder gathering + brownout grace + non-destructive monsters guarantee zero dead-end states.

## 6. Owner Decisions Needed

1. **Rock Drill Exhaust Wisp (From Concept Sheet 12 Callout):**
   - *Question:* In [`12-sheet-field-machines.png`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/concept/setmix/12-sheet-field-machines.png) ("FOR THE OWNER"), the sheet asks: *"the drill's faint wisp is unrefined motes — keep or drop it?"*
   - *Recommendation:* **Keep a faint, low-altitude grey/dust mote wisp** at the Rock Drill's rear stack when running, distinct from the tall, saturated neon pixel plumes (`#ff3d8a`, `#7cff4d`, `#ffc13d`, `#3dc8ff`) of the four fidelity processors. That way players can tell from 200 m away whether their drill is powered and mining without confusing it with a fidelity emitter. Do you agree?
2. **Starting Field Machine Set for Act III–VII:**
   - *Question:* Sheet 12 presents 8 candidate field machines (`1 Rock Drill`, `2 Texture Mill`, `3 Shape Press`, `4 Light Projector`, `5 Water Maker`, `6 Preset Mixer`, `7 Power Unit`, `8 Relay Pylon`). Should `6 Preset Mixer` stay exclusively inside the Lab (as the `Preset Combiner` on Sheet 07) during the first hour so players have a reason to walk back through the Gate, unlocking the field `Preset Mixer` only at Stage 3?
   - *Recommendation:* **Yes—keep Preset Mixing inside the Lab until Stage 3.** That preserves the dual-world Portal loop in Acts I–VI while rewarding late-game builders with field automation.
