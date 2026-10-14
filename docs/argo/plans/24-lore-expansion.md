# 24 — Lore, Voiced Narration & Acts VII–IX Endgame Expansion Plan

> **File Destination in Repo:** `docs/argo/plans/24-lore-expansion.md`
> **Author:** Gemini Argo (Creative Lead)
> **For:** Claude Opus (Wave A `TASK-23b-2` / `TASK-24` & Waves B–D Campaign Expansion)
> **Date:** 14 October 2026
> **Status:** **ACTIVE CREATIVE MANDATE** (Per Owner Directive, `OWNER_ASKS.md` 14 Oct 2026). Every line requiring RUN.world TTS is tagged **`[VO: HADDY]`** with its exact ID and word count.

## 1. Immediate Voice Line for `TASK-23b-2`: The 20-Second Leak-Surge Warning

Triggered `20 seconds` before an active perimeter leak opens its spawn waves (paired with the HUD toast):

- **`[VO: HADDY]` `A6-LEAK-SURGE` (14 words):**
  > *"Archive pressure's spiking—twenty seconds before a perimeter rift tears open. Ready your weapon."*

*(Note: Pairs directly with **`[VO: HADDY]` `A4-LEAK-SEAL` (15 words)** from `22-lore-micrologs.md`: *"Clean seal. That core's condensed archive data—bring it inside, the Combiner can splice it."*)

## 2. The Narrative Arc Beyond Act VI: Why the Lunar Plot Matters to Earth

Acts I–VI take the player from Cold Boot (`Stage 0`) to the first grass bloom and base foundations (`Stage 2–3`). To make Stages 3 through 6 feel like a true narrative campaign rather than a silent number-grind, Acts VII–IX answer the central question planted in `LOG-02` (`server-rack`): **Why did Dr. Gwen Haddy shunt the Lab's last pointer to a 1 km plot on the Moon instead of fixing Earth directly?**

- **The Premise (Zero New Lore Contradictions):** Earth's regional substrate bus is too massive (`40,000 km`) and too corrupted by the recursive Bridge Breach to reboot cold. By stabilizing all four floats `S = (Pxd, Vtx, Lx, Aq)` to **Stage 6 (`Full Fidelity`)** on a bounded 1 km Lunar Anchor Plot, the Lab's compiler can capture a **Clean Golden Image** and flash it back across the Earth Breach outside the observation window.
- **The Character Dynamic:** Keep **Dr. Gwen Haddy** as our sole voiced radio companion (`[VO: HADDY]`, preserving our intimate *Portal 2* / *Firewatch* two-hander without needing a second TTS voice cast). Introduce **Chief Architect Marcus Vance** posthumously through the lunar wreck transponders (`LOG-05` to `LOG-08`) and a locked Lab Server Rack partition (`LOG-09` & `LOG-10`): Vance was Haddy's mentor who tried to hot-patch the Bridge from the outside with raw shareware archives and lost sync on the lunar ridge.

## 3. Act-by-Act Expansion (Acts VII, VIII, and IX)

### Act VII: The Heavy Hardpoints & The Blue Sky Surge (`Stage 3 -> Stage 4`)
**Context:** The player has unlocked Base Foundations (`B-01`), Linked Bins (`B-05`), and the first combat weapon (`F-03`). Now they must scale up from field machines to **Heavy Hardpoint Terraformers (`D3` / Sheet 17)** and power them.

| Quest Step ID | Trigger Condition | Objective HUD Text | Voiced Line (`[VO: HADDY]`) & Word Count | World / Gameplay Payoff |
| :--- | :--- | :--- | :--- | :--- |
| **`A7-01`** | Act VI (`F-03` + first live leak wave cleared) complete. | **Mount a Heavy Light Projector (`B -> Heavy`) on a base foundation hardpoint.** | **`[VO: HADDY]` `A7-01` (19 words):**<br>*"Small field mills won't push us past Stage 3. Snap a Heavy Light Projector onto a foundation hardpoint."* | Guides the player directly into the `D3` Heavy Terraformer loop. |
| **`A7-02`** | Heavy Light Projector placed on foundation hardpoint, triggering grid brownout (`demand > 12 kW`). | **Build a Power Unit (`B`) to clear the grid brownout.** | **`[VO: HADDY]` `A7-02` (18 words):**<br>*"There goes the Gate's twelve-kilowatt breaker. Drop a Power Unit on the line before the plumes stall out."* | Teaches proportional brownout recovery (`Brief 26`) naturally through story. |
| **`A7-03`** | Power Unit online; `Lx` crosses Stage 3/4 threshold + **Heavy Water Maker** placed. | **Reach Stage 4 (`Water Pooling`) by running the Heavy Water Maker.** | **`[VO: HADDY]` `A7-03` (20 words):**<br>*"Look at the crater floor—liquid water, real sky scattering. Vance swore the four-float kernel would choke at Stage 4."* | Radial `#ffc13d` / `#3dc8ff` scan-wave turns the black void into Rayleigh blue sky and floods the eastern hydro basin (`S4`). |

### Act VIII: The Archive Ghost & The Bio-Splicer (`Stage 4 -> Stage 5: Coverage`)
**Context:** As `Aq` and `Lx` push the plot toward **Stage 5 (`Coverage Creep`)**, deeper `brute` and `sapper` leaks (`LibreQuake` `.md1`/`.md2` era) open near Wreck Sites Gamma and Delta, and the Lab's **Preset Combiner** unlocks advanced cartridge/core fusion.

| Quest Step ID | Trigger Condition | Objective HUD Text | Voiced Line (`[VO: HADDY]`) & Word Count | World / Gameplay Payoff |
| :--- | :--- | :--- | :--- | :--- |
| **`A8-01`** | Stage 4 reached + at least 2 Lunar Wreck Transponders (`TASK-23c`) inspected. | **Fuse two cartridges or Anomaly Cores in the Lab Preset Combiner.** | **`[VO: HADDY]` `A8-01` (21 words):**<br>*"Vance's wreck logs just unlocked the Combiner's deep bus. Fuse two cartridges—or splice an Anomaly Core—and imprint the basin."* | Highlights `@hm/assembler` / `@hm/cartlab` fusion and peaceful or combat core usage. |
| **`A8-02`** | Fused cartridge slotted into a Heavy Terraformer; plot reaches **Stage 5 (`Coverage`)**. | **Mount an Automated Perimeter Turret (`B`) or seal 2 Stage-5 rifts.** | **`[VO: HADDY]` `A8-02` (19 words):**<br>*"Clover and moss are creeping past the shoreline. The heavy rifts are waking up, though—let'sbolt down a turret."* | Turf, clover, and moss tendrils (`09-sheet-coverage-growth.png`) carpet the plot; Sheet 20 turret (`2 kW`) defends the perimeter. |

### Act IX: The Consensus Horizon & The Earth Window Payoff (`Stage 6 Finale`)
**Context:** When the plot reaches **Stage 6 (`Full PBR Forest Canopy`)**, the Lunar Anchor Plot is a lush, living biosphere with L-system forests (`@hm/treegen`), grazing fauna (`@hm/fauna`), and the **Crawler** unlocked. Instead of ending with a plain `"Stage 6: Full fidelity"` text hint (`quest.ts` line 183), we stage a **30-second playable finale inside the Lab** that reuses `lab-vista.ts`!

| Quest Step ID | Trigger Condition | Objective HUD Text | Voiced Line (`[VO: HADDY]`) & Word Count | World / Gameplay Payoff |
| :--- | :--- | :--- | :--- | :--- |
| **`A9-01`** | Plot reaches **Stage 6** (`plot.stage >= 6`). | **Return through the Twin Gate to the Lab Operator Console.** | **`[VO: HADDY]` `A9-01` (20 words):**<br>*"Stage 6. All four floats locked at full PBR. Get back inside the Lab—the Bridge buffer is ready to flash!"* | Amber beacon pulses along the Gate floor cable covers drawing the player back into the Lab. |
| **`A9-02`** | Player pulls the **Operator Console Lever** (or interacts with the **Planet Table**) in the Lab at Stage 6. | **Watch the Observation Window as the Lunar patch compiles across Earth.** | **`[VO: HADDY]` `A9-02` (22 words):**<br>*"Flashing the lunar image to the regional bus... Look out the window. The Breach is sealing. We're compiling the world back together."* | **The Showstopper (`lab-vista.ts`):** Outside the `14.8 m × 3.1 m` Lab window, the 120 m cyan Breach Column zips shut over `4.0 s`, the 3 spherical S-pockets expand across the ruined datacentre halls, the dark storm (`luma 88`) lifts into golden-hour sunlight, and green grass/trees bloom across Earth! |
| **`A9-03`** | `6.0 s` after the Window Breach seals (`step = 'endgame'`). | **Sandbox Unlocked: Explore the Planetary Grid, drive the Crawler, or build in The Studio.** | **`[VO: HADDY]` `A9-03` (18 words):**<br>*"Sector 04 is stable, and eleven neighbour domes are pinging the table. The Studio's all yours, Engineer."* | Unlocks permanent open-sandbox state + two new inspectable endgame logs on the Lab `server-rack` (`LOG-09`, `LOG-10`). |

## 4. Two Additional Lab Logs for Act VIII–IX (`server-rack` Partition Unlocks)

To reward players who return to the permanent `server-rack` fixture in the Lab at Stage 4 and Stage 6:

- **`LOG-09 // VANCE'S LAST COMMIT [UNLOCKS AT STAGE 4]` (51 words):**
  > `VANCE'S LAST COMMIT [T+00:42:10]: Gwen was right. You can't patch aforty-thousand-kilometre kernel while standing inside the fault line. I dumped the 1993–1997 archive vaults into the breach to give the memory bus something to chew on while she isolated Lab 04. If you're reading this, finish the lunar plot.`
- **`LOG-10 // REGIONAL BUS RESTORED [UNLOCKS AT STAGE 6 FINALE]` (48 words):**
  > `REGIONAL BUS RESTORED [T+18:00:00]: Golden image received from Lunar Anchor Plot 01 (Pxd 1.00, Vtx 1.00, Lx 1.00, Aq 1.00). Exterior Breach Column collapsed; recursive sub-sim depth reset to zero. Eleven neighbouring enclaves have joined the consensus ring. Full Studio write-access granted to Operator Astro.`

## 5. Complete Voice Generation Manifest (`8 New Lines Total = 147 Words`)

All 8 new lines below use Dr. Gwen Haddy's approved RUN.world voice profile and radio filter chain (`Voice 80 / Radio 10 / Static 30 / Music 45 / Overdrive 10`), costing `< 1,000` credits total:

| Line ID | Target Task / Brief | Exact Script (`147 Words Total`) | Words |
| :--- | :--- | :--- | :--- |
| **`A4-LEAK-SEAL`** | `TASK-23b-2` (Act IV dormant leak seal) | *"Clean seal. That core's condensed archive data—bring it inside, the Combiner can splice it."* | 15 |
| **`A6-LEAK-SURGE`** | `TASK-23b-2` (20 s pre-wave warning toast) | *"Archive pressure's spiking—twenty seconds before a perimeter rift tears open. Ready your weapon."* | 14 |
| **`A7-01`** | Wave D / `Brief 32` (Heavy Projector prompt) | *"Small field mills won't push us past Stage 3. Snap a Heavy Light Projector onto a foundation hardpoint."* | 19 |
| **`A7-02`** | Wave B / `Brief 26` (First brownout prompt) | *"There goes the Gate's twelve-kilowatt breaker. Drop a Power Unit on the line before the plumes stall out."* | 18 |
| **`A7-03`** | Wave D / `Brief 32` (Stage 4 Water & Sky payoff) | *"Look at the crater floor—liquid water, real sky scattering. Vance swore the four-float kernel would choke at Stage 4."* | 20 |
| **`A8-01`** | Wave D / `Brief 31/32` (Combiner deep bus) | *"Vance's wreck logs just unlocked the Combiner's deep bus. Fuse two cartridges—or splice an Anomaly Core—and imprint the basin."* | 21 |
| **`A8-02`** | Wave D / `Brief 32` (Stage 5 Coverage & Turret) | *"Clover and moss are creeping past the shoreline. The heavy rifts are waking up, though—let's bolt down a turret."* | 19 |
| **`A9-01`** | Wave C/D / `Brief 28/32` (Stage 6 Lab return) | *"Stage 6. All four floats locked at full PBR. Get back inside the Lab—the Bridge buffer is ready to flash!"* | 20 |
| **`A9-02`** | Wave C/D / `Brief 28` (Window Breach heal) | *"Flashing the lunar image to the regional bus... Look out the window. The Breach is sealing. We're compiling the world back together."* | 22 |
| **`A9-03`** | Wave C/D / `Brief 28` (Endgame sandbox unlock) | *"Sector 04 is stable, and eleven neighbour domes are pinging the table. The Studio's all yours, Engineer."* | 18 |
