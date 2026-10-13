# 10 — Lore, Narrative & Environmental Storytelling Plan: Making the Collapse Physical

## 1. The Goal: A World That Tells Its Story Without Pausing Gameplay

In AAA narrative-survival games, lore is never trapped inside a wall of text in a design doc—it is discovered through the physical environment, machine interfaces, and reactive voiceover. Our goal is to translate the rich premise in [`docs/NARRATIVE_AND_LORE_BIBLE.md`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/NARRATIVE_AND_LORE_BIBLE.md) and [`docs/NARRATION_SCRIPT.md`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/NARRATION_SCRIPT.md) (*"A simulation cannot sustain simulations running inside of it"*) into tangible environmental beats across the Earth Lab, the Window Vista, the Moon plot, and the Studio terminal.

## 2. Where It Stands Today

- **What Exists:**
  - [`docs/NARRATIVE_AND_LORE_BIBLE.md`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/NARRATIVE_AND_LORE_BIBLE.md) and [`docs/NARRATION_SCRIPT.md`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/NARRATION_SCRIPT.md) establish the Bridge Array catastrophe, Dr. Gwen Haddy's character voice, and Acts I–VI dialogue lines.
  - Voiced audio files (`public/vo/`) and radio filter chains exist in [`apps/web/src/audio/`](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/apps/web/src/audio).
  - [`apps/web/src/play/lab-room.ts`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/apps/web/src/play/lab-room.ts) and [`apps/web/src/assets/gen/registry.json`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/apps/web/src/assets/gen/registry.json) include 10 lab clutter props (`filing-cabinet`, `server-rack`, `old-monitor`, `sample-case`, etc.) and 28 lunar wreck/vista props (`TASK-23c`).
- **What Is Weak or Missing:**
  - As noted in [`docs/argo/START_HERE.md`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/START_HERE.md) §5, the lore is **strong in the bible and thin in the game**.
  -Salvaging lab clutter in [`apps/web/src/play/lab-room.ts`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/apps/web/src/play/lab-room.ts) yields raw materials when holding `E`, but carries zero narrative payoff—no terminal logs, no sticky notes, no audio fragments explaining *what* the Bridge experiment was doing minutes before the collapse.
  - The lunar wreck sites (`TASK-23c`) and leaked shareware monsters (`TASK-23b`) appear mechanically without in-world forensic traces linking them to the Bridge Array's compute exhaustion.
  - Act V's philosophical turning point (*"It's not really dirt, you get that right?"* in [`docs/V1_1_ONBOARDING_PLAN.md`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/V1_1_ONBOARDING_PLAN.md)) needs diegetic reinforcement inside the Studio UI so editing a schema variable feels like hacking the simulation substrate.

## 3. What the Best Games Do (Research & Sources)

| Reference Game | Narrative Technique | Player Praise & Design Lesson |
| :--- | :--- | :--- |
| [***Subnautica***](https://store.steampowered.com/app/264710/Subnautica/) | **Non-Blocking Audio Logs at Salvage Wrecks:** Scanning or salvaging a wreck triggers a 12–20 second voiced/radio databank entry that plays *while* the player continues moving and mining ([Steam Community Guide](https://steamcommunity.com/app/264710/discussions/0/506208224013267336/)). | Players hate lore that freezes movement in a modal text reader; short radio/log bursts during salvage double the reward of clearing clutter. |
| [***Outer Wilds***](https://store.steampowered.com/app/753640/Outer_Wilds/) | **Rumor-Mode Node Graph & Forensic Props:** Every discovered log updates a visual connection board ([Ship Log Guide](https://steamcommunity.com/sharedfiles/filedetails/?id=3500382207)), and every ruin has a physical purpose (pointing toward the next signal or anomaly). | Players praise *Outer Wilds* because text logs are always anchored to a physical prop you can see from a distance and never exceed 3–4 punchy lines per node. |
| [***Control***](https://www.gamedeveloper.com/art/the-real-buildings-that-inspired-i-control-i-s-oldest-house) & [***Abiotic Factor***](https://store.steampowered.com/app/427410/Abiotic_Factor/) | **Bureaucratic Workplace Realism Amid Cosmic Collapse:** Dry technical containment memos and mundane lab equipment juxtaposed with reality-breaking anomalies ([Oldest House Analysis](https://www.reddit.com/r/controlgame/comments/1vshfnv/the_oldest_house_cold_bureaucratic_and_deeply/)). | Grounded workplace details (maintenance tags on breakers, incident tickers on old monitors, coffee-stained test logs) make the sci-fi catastrophe believable. |
| [***Portal 2***](https://developer.valvesoftware.com/wiki/Clean_(Portal_2)) | **Reactive Mentor Commentary:** The guide reacts to specific player micro-actions (firing an empty tool, staring out the window, standing near a hazard) with dry wit. | Turns tutorial guardrails into memorable character moments—just like the owner's `"Not that button"` and `"It's not really dirt"` beats in [`docs/V1_1_ONBOARDING_PLAN.md`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/V1_1_ONBOARDING_PLAN.md). |

## 4. Concrete Changes Ranked P0, P1, and P2

### P0 — Must Fix Before First Public Test

1. **P0-LORE-01: Wire Micro-Lore Inspections to the 10 Lab Clutter Props & Lunar Wreck Sites (`TASK-23c` Integration)**
   - **What to build:** Extend the clutter salvage table in [`apps/web/src/play/lab-room.ts`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/apps/web/src/play/lab-room.ts) and lunar wreck props in [`apps/web/src/assets/gen-props.ts`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/apps/web/src/assets/gen-props.ts) so that 8 key props (`old-monitor`, `server-rack`, `filing-cabinet`, `sample-case`, plus 4 lunar wreck transponders) display a 2-sentence forensic readout on hover and unlock a compact `"Bridge Incident Log"` entry in the HUD databank when salvaged with `E`.
   - **Content examples:**
     - `old-monitor`: *"BRIDGE TELEMETRY [T-00:04:12]: Recursive sub-sim allocation hit 99.4% of host substrate. Exterior terrain meshes dropping to 1-bit fallback."*
     - `sample-case`: *"CONTAINMENT LOG #09: Archive shareware sectors (1993–1997) breached quarantine. Sprite and MD2 entities materializing along low-Pxd fault lines."*
   - **Needs:** **Code** (`apps/web/src/play/lab-room.ts`, `packages/content/`), **Audio** (short CRT data-chirp SFX on log unlock).

2. **P0-LORE-02: Stage the Act I–II Window & Gate Reveal Beats Around Physical Sightlines**
   - **What to build:** In [`apps/web/src/lab/lab-scene.ts`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/apps/web/src/lab/lab-scene.ts) and [`apps/web/src/play/quest.ts`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/apps/web/src/play/quest.ts), gate Dr. Haddy's Act II window line (*"That's you if you didn't turn the power on just now"*) on a camera frustum/proximity trigger within 3.5 m of the observation window looking at the Breach column ([`05-window-view-storm-and-breach.jpg`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/05-window-view-storm-and-breach.jpg)), rather than firing on a blind timer while the player is still facing the power wall.
   - **Needs:** **Code** (`apps/web/src/play/quest.ts`, `apps/web/src/lab/lab-scene.ts`).

### P1 — Makes It Feel AAA

3. **P1-LORE-03: Diegetic "Substrate Memory" Framing for Monster Leaks & Cartridges**
   - **What to build:** When a reality leak spawns on the Moon (`packages/leaksim/src/index.ts`), display a brief diegetic telemetry tag over the rift before monsters emerge (e.g., `LEAK DETECTED: SECTOR_WAD_1994 // UNCOMPILED IMP ARCHETYPE`). When sealed with the Beam Tool (`Seal` mode), Dr. Haddy or the suit HUD logs which vintage computing block was reclaimed into the local `S` budget.
   - **Needs:** **Code** (`apps/web/src/play/`, `packages/leaksim/`), **UI** (`apps/web/src/shell/hud.tsx`).

4. **P1-LORE-04: Contextual Micro-Barks for Dr. Haddy Across Acts IV–VI**
   - **What to build:** Add 10 short, non-repeating contextual radio barks in [`docs/NARRATION_SCRIPT.md`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/NARRATION_SCRIPT.md) triggered by player state:
     - Firing the Extraction Beam before slotting a tool cartridge (*"You need a tool cartridge to use it for anything other than mining"* — already in [`docs/V1_1_ONBOARDING_PLAN.md`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/V1_1_ONBOARDING_PLAN.md), verify VO hook in `TASK-22`).
     - First time renaming `dirt` or `ore` in the Studio schema inspector (*"It's not really dirt, you get that right? We're just calling it that for your sake."*).
     - Stepping into water at Stage 3 (`Aq >= 0.40`).
     - First time a neighboring player enclave's fidelity dome becomes visible on the 4.2 km horizon.
   - **Needs:** **Code** (`apps/web/src/play/quest.ts`, `apps/web/src/audio/`), **Audio** (RUN.world voice generation from `RUNWORLD_FLOOR` reserve).

5. **P1-LORE-05: Diegetic Planet Table Hologram Showing Real-Time Continent Sync Branches**
   - **What to build:** Upgrade the amber Planet Table in the Lab ([`07-sheet-lab-power-and-machines.png`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/concept/setmix/07-sheet-lab-power-and-machines.png) panel 4) so interacting with it shows the 40,000 km shared planet with glowing markers for the Bridge Epicenter, the Lunar Gate anchor, and neighboring player sync branches, tying the "majority consensus reality" lore from [`docs/V1_1_ONBOARDING_PLAN.md`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/V1_1_ONBOARDING_PLAN.md) to a physical centerpiece.
   - **Needs:** **Code** (`apps/web/src/lab/lab-scene.ts`), **Art** (shader update on existing Planet Table prop).

### P2 — Stretch Goals

6. **P2-LORE-06: "Bridge Archive" Node Map Tab in the Inventory/Databank**
   - **What to build:** An [*Outer Wilds*](https://store.steampowered.com/app/753640/Outer_Wilds/)-style visual node card view inside a secondary tab of the `Tab` menu showing recovered Bridge logs, discovered monster archetypes, and unlocked cartridge recipes connected by causal links.
   - **Needs:** **Code** (`apps/web/src/shell/`).

## 5. Rules Touched (`docs/argo/RULES.md`)

- **Rule 1 (Four floats, one formula):** All lore explanations of the collapse strictly reference `Pxd`, `Vtx`, `Lx`, and `Aq`—no fifth metric is ever mentioned in logs or dialogue.
- **Rule 12 (No lettering, numbers or logos on generated models):** Forensic logs and labels are rendered solely via HUD hover cards and screen shaders, never baked onto 3D model textures.
- **Rule 14 (No unrequested branding):** The phrase `"Monster Mash"` is never used in-world; monsters are referred to in-universe as **Containment Leaks** or **Uncompiled Archive Entities**.
- **Rule 18 (Legal assets only):** Archive references in lore logs strictly cite generic computing eras or BSD/CC0 communities (*Freedoom*, *LibreQuake*, *Blasphemer*), never trademarked commercial titles.

## 6. Owner Decisions Needed

1. **Salvage Clutter Behaviour (Permanent Removal vs. Respawn/Toggle):**
   - *Question:* When the player holds `E` to dissolve the 10 Lab clutter props (`crate-large`, `old-monitor`, etc.) in `TASK-23c` to clear floor space and read their logs, should those props stay permanently gone on that save profile, or should the narrative terminal (`server-rack` / `old-monitor`) remain permanently mounted on the desk/wall so the player can re-read logs?
   - *Recommendation:* Keep `old-monitor` and one `server-rack` as permanent inspectable fixtures against the wall, while allowing all floor crates, lockers, and coolant cans to dissolve into salvage.
2. **Additional RUN.world Voice Lines for Acts IV–VI:**
   - *Question:* Should we budget ~1,500 credits from the 66.4k RUN.world balance (well above the 16k voice floor in [`docs/RESUME.md`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/RESUME.md)) to voice the 10 new contextual micro-barks and Act IV–VI transitions, or keep new barks subtitle + radio-chirp only until `TASK-24` passes?
   - *Recommendation:* Keep subtitle + radio-chirp for `TASK-24` merge to `main`, then batch-generate the 10 voice files in one pass once the exact wording is locked.
