# 12 — The First Hour & Onboarding Plan: Zero-Dead-End Pacing from Cold Boot to First Color Bloom

## 1. The Goal: A 45-Minute Masterclass in Show-Don't-Tell Pacing

The first hour of **FIDELITY** is our hook. As noted in [`docs/argo/START_HERE.md`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/START_HERE.md) §5, the first hour has never been tuned with external players, and the owner's brother previously quit when he ran out of oxygen/ore and didn't know how to recover. Our goal is to pace Acts I through VI (`TASK-22`, [`docs/V1_1_ONBOARDING_PLAN.md`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/V1_1_ONBOARDING_PLAN.md)) so that every 3–5 minutes delivers an unforgettable visual/auditory payoff, zero tutorials rely on walls of text, and no player can ever stall on coherence, ore, or direction.

## 2. Where It Stands Today

- **What Exists:**
  - Acts I–III work end-to-end in [`apps/web/src/lab/lab-scene.ts`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/apps/web/src/lab/lab-scene.ts) and [`apps/web/src/play/quest.ts`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/apps/web/src/play/quest.ts): waking in the Lab ([`02-lab-act1-wake.jpg`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/02-lab-act1-wake.jpg)), powering the breaker wall ([`03-lab-power-wall.jpg`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/03-lab-power-wall.jpg)), inspecting the window storm ([`05-window-view-storm-and-breach.jpg`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/05-window-view-storm-and-breach.jpg)), opening the Gate ([`06-gate-open.jpg`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/06-gate-open.jpg)), and stepping onto the Stage 0 Moon ([`07-moon-stage0.jpg`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/07-moon-stage0.jpg)).
  - `TASK-11` fixed the early ore soft-lock (`Hold E` on boulders + free first Rock Drill).
  - `TASK-22` ([`docs/prompts/sidecar/22-campaign-chain.md`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/prompts/sidecar/22-campaign-chain.md)) extends `@hm/questline` through Acts IV–VI (`A4-01` pick up rifle $	o$ `A4-02` mine 50 dirt & refine $	o$ `A4-03` Studio schema edit $	o$ `A4-04` Stage 2 color bloom $	o$ `B-01` foundation $	o$ `B-05` linked bin).
- **What Is Weak or Missing:**
  - **The Brother's Quit Trigger (Suit Coherence / Oxygen Anxiety):** In early Stage 0, stepping onto a visually disorienting 1-bit dither landscape while a timer drains and 3 HUD banners overlap ([`07-moon-stage0.jpg`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/07-moon-stage0.jpg)) induces panic before the player even understands how to place a machine.
  - **Flat Set-Piece Beats:** Throwing the Lab breaker ([`04-lab-power-on.jpg`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/04-lab-power-on.jpg)) and pulling the Gate lever ([`06-gate-open.jpg`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/06-gate-open.jpg)) happen instantly without build-up, failing to match the drama of [`01-lab-first-play.png`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/concept/setmix/01-lab-first-play.png) and [`02-gate-power-on.png`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/concept/setmix/02-gate-power-on.png).
  - **Missing "Breadcrumb" Guidance Between Lab and Moon:** When the player needs to return to the Lab Armory (`A4-01`) or bring 50 Dirt back to the processor (`A4-02`), the monochrome Stage 0 terrain makes it easy to lose orientation relative to the Twin Gate if the player walked 80 m away.

## 3. What the Best Games Do (Research & Sources)

| Reference Game | First-Hour Onboarding Technique | Player Praise & Design Lesson |
| :--- | :--- | :--- |
| [***Portal 2***](https://developer.valvesoftware.com/wiki/Indicator_Lights_(Portal_2)) | **Environmental Indicator Lines & Single-Verb Isolation:** Valve introduces one mechanic at a time and uses floor/wall indicator light lines to connect switches to the exact device they power ([Valve Developer Wiki](https://developer.valvesoftware.com/wiki/Indicator_Lights_(Portal_2))). | Our steel floor cable covers ([`06-sheet-gate.png`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/concept/setmix/06-sheet-gate.png)) should act just like *Portal 2* indicator lines—pulsing amber from the breaker to the console, and from the console to the Gate plinth. |
| [***Subnautica***](https://store.steampowered.com/app/264710/Subnautica/) | **Safe Shallow Tether Before Deep Hazard:** The player starts inside the Lifepod (fire extinguisher tutorial), then swims in bright, shallow coral water where surfacing takes 2 seconds before ever facing deep O2 pressure ([Subnautica Beginner Guide](https://www.reddit.com/r/subnautica/comments/929xhc/tips_for_starting_outhabitat_building/)). | On the Moon, the **Twin Gate's foot pad must project a 25 m "Coherence Safe Dome"** where suit sync *never* drains, so the player can place their first machine and learn the build UI with zero timer stress. |
| [***The Planet Crafter***](https://store.steampowered.com/app/1284190/The_Planet_Crafter/) | **Immediate Visual Feedback on First Machine Placement:** Within 5 minutes of landing, placing a single drill and heater visibly ticks the global counter and powers indoor screens ([Steam Store](https://store.steampowered.com/app/1284190/The_Planet_Crafter/)). | Placing the free starter machine in Act III must trigger an immediate, unmistakable radial wave that sharpens Stage 0 dither perspective within 3 seconds. |
| [***Half-Life 2***](https://developer.valvesoftware.com/) / [***Abiotic Factor***](https://store.steampowered.com/app/427410/Abiotic_Factor/) | **The "Dry Fire" Tool Teaching Beat:** Letting the player pick up a tool, press fire, hear a distinct mechanical *clack/brrt*, and immediately see/hear why it needs a cartridge or battery. | Directly validates the owner's Act III beat in [`docs/V1_1_ONBOARDING_PLAN.md`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/V1_1_ONBOARDING_PLAN.md): pick up rifle $	o$ dry fire `"brrt"` $	o$ default mining works on dirt, cartridge required for sculpt/paint. |

## 4. Concrete Changes Ranked P0, P1, and P2

### Target 45-Minute First-Hour Pacing Timeline

| Minute Mark | Act & Quest ID | Player Action | Sensory & World Payoff | Fail-Safe / Anti-Quit Guardrail |
| :--- | :--- | :--- | :--- | :--- |
| **00:00 – 03:00** | **Act I: Cold Boot** (`A1-01` to `A1-03`) | Eyes open to dark ceiling; red alarm strobe; sit up; Dr. Haddy glitch portrait (`"Not that button"`); pull Power Wall breaker. | Capacitors thrum bottom-up; overhead strip lights flicker on row-by-row; machines spin up. | Zero drain inside the shielded Lab; flashing amber LED on the breaker handle. |
| **03:00 – 07:00** | **Act II: The Breach & The Gate** (`A2-01` to `A2-03`) | Walk to window (see 3D Breach storm); pull Console lever to ignite the freestanding Gate. | Gate's ribbed amber coils ignite sequentially over 3.5 s; portal aperture tears open to 1-bit Stage 0 Moon. | Floor cable ramps pulse with amber light guiding the eye from Breaker $	o$ Console $	o$ Gate. |
| **07:00 – 14:00** | **Act III: First Step & Shape Press** (`A3-01` to `A3-03`) | Step through Gate onto Stage 0 Moon; place free **Shape Press** inside the 25 m Gate Safe Dome; slot starter cartridge. | Green `#7cff4d` pixel plume rises; radial scan-wave sweeps outward, stabilizing Stage 0 dither into crisp Stage 1 EGA contours. | **25 m Gate Coherence Dome** prevents any sync/oxygen drain while learning the build menu (`B`). |
| **14:00 – 24:00** | **Act IV: Armory, Leak & Dirt Mining** (`A4-01`, `A4-02`) | Perimeter leak warning triggers; grab **Extraction Beam Rifle** from Lab wall rack; seal/defeat 2 perimeter imps; mine 50 Dirt; refine to Ore in Lab. | Terrain physically carves under the beam; first shareware anomaly dissolves into core shards; Dirt $	o$ Ore processor hums. | Twin Gate emits a persistent amber beacon beam into the sky so the player can always find the portal from anywhere on the plot. |
| **24:00 – 34:00** | **Act V: The Meta-Studio & Base Foundation** (`A4-03`, `B-01` to `B-05`) | Open Lab Studio console (*"It's not really dirt"*); inspect/edit schema variable; craft `smooth ground` + `Grass` cartridges; place first Foundation & Linked Bin. | Player sees live schema change; terrain craters smooth out under the rifle's Sculpt mode; outpost takes shape. | All resources in the Linked Bin (`B-05`) are automatically available to the build tool anywhere on the plot. |
| **34:00 – 45:00** | **Act VI–VII: First Color Bloom & Light Surge** (`A4-04`) | Slot Grass cartridge into **Texture Mill**; place **Rock Drill**, **Power Unit**, and **Light Projector**. | Pink/Green plume blooms emerald grass patches across the monochrome rock; **Light Projector** fires an amber sky wave that turns the black void into a blue atmospheric sky with real shadows. | Dr. Haddy transitions from step-by-step quest guide to contextual advisor; open sandbox unlocked. |

### P0 — Must Fix Before First Public Test

1. **P0-HOUR-01: Implement the 25 m Twin Gate Coherence Safe Dome & Graceful Desync Recovery (Fixing the Brother's Quit Point)**
   - **What to build:** In [`apps/web/src/play/`](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/apps/web/src/play) and [`packages/plotsim/`](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/packages/plotsim):
     1. Within `25 m` of the Planet Twin Gate (and `15 m` of any powered Relay Pylon or Shelter), **Suit Coherence (`Sync`) never drains and regenerates at `20%/sec`**.
     2. Only when venturing beyond the powered perimeter into raw Stage 0 unpowered terrain does Coherence drain (`90 seconds` full buffer).
     3. At `30%` Coherence, play a gentle radio static cue + amber compass arrow pointing straight back to the Twin Gate; if Coherence ever hits `0%`, **never delete items or reset progress**—emergency-recall the player to the Lab Gate threshold with 100% inventory intact and a witty line from Dr. Haddy (*"Pulled your buffer back before the static ate you. Stay near the relay line or drop a pylon."*).
   - **Needs:** **Code** (`apps/web/src/play/`, `packages/plotsim/`), **UI** (compass tether arrow).

2. **P0-HOUR-02: Stage Sequential Quest Banners (`TASK-22` + HUD Queue Fix)**
   - **What to build:** On first Moon arrival ([`07-moon-stage0.jpg`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/07-moon-stage0.jpg)), suppress the build-mode `"CANNOT PLACE"` warning unless the build menu (`B`) is actively open, and delay Dr. Haddy's voiceover line by `2.0 seconds` until the `STAGE 0 // LUNAR SUBSTRATE` location title card finishes fading out.
   - **Needs:** **Code** (`apps/web/src/shell/hud.tsx`, `apps/web/src/play/quest.ts`).

### P1 — Makes It Feel AAA

3. **P1-HOUR-03: Choreograph the 4-Second Act I Wake-Up & Act II Gate Ignition Sequences**
   - **What to build:**
     - **Act I Wake (`LabScene.ts`):** Start camera pitched `+65°` toward the dark ceiling under a rotating red emergency strobe (`1.2 Hz`), smoothly ease pitch to `0°` over `2.2 seconds` as the player sits up, then pop in Dr. Haddy's glitching CRT portrait in the top-left corner (`"Not that button..."`).
     - **Act II Gate Ignition (`LabScene.ts`):** When the console lever is pulled, ignite the 8 horizontal ribbed coil blocks on each Gate upright from bottom to top over `3.0 seconds` (`250 ms` per block) accompanied by a rising capacitor charge pitch, culminating in an amber arc flash that reveals the live Stage 0 Moon stencil view.
   - **Needs:** **Code** (`apps/web/src/lab/lab-scene.ts`), **Audio** (`packages/soundpack/`).

4. **P1-HOUR-04: Twin Gate Vertical Sky Beacon for Effortless Plot Orientation**
   - **What to build:** Render a subtle vertical amber telemetry beam (`#ffc13d`, additive cylinder fade up to 80 m height) rising from the top lintel of the Planet Twin Gate during Stages 0–2 so the player can always spot the way home across craters and boulders.
   - **Needs:** **Code** (`apps/web/src/crafter/world.ts`).

### P2 — Stretch Goals

5. **P2-HOUR-05: Interactive Schema Diff Toast When Renaming `Dirt` / `Ore` in Act V (`A4-03`)**
   - **What to build:** When the player changes the display label of `dirt` in the Studio terminal during `A4-03`, immediately flash a live `"SUBSTRATE PATCH APPLIED // 14 HUD REFERENCES UPDATED"` toast and show the player's custom word on every dirt chunk pickup and processor tooltip for the rest of the session.
   - **Needs:** **Code** (`apps/web/src/studio/`, `apps/web/src/shell/hud.tsx`).

## 5. Rules Touched (`docs/argo/RULES.md`)

- **Rule 23 (No soft-locks):** The 25 m Gate Coherence Safe Dome, zero-loss emergency recall, and `TASK-11` hand-mining guarantee no player can quit from oxygen/coherence death or ore starvation.
- **Rule 8 (Owner's words are logged verbatim):** Implements every beat of the owner's verbatim onboarding sequence from [`docs/V1_1_ONBOARDING_PLAN.md`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/V1_1_ONBOARDING_PLAN.md).

## 6. Owner Decisions Needed

1. **Coherence / Oxygen Drain Inside the Starting Plot Radius:**
   - *Question:* Your brother quit when he ran out of oxygen/ore early on. Do you want Suit Coherence (`Sync`) to be **100% infinite inside the powered Gate/Pylon radius** (only draining when exploring outside the powered zone or during a Monster Leak storm), or should it always drain slowly outdoors until the Life-Support Unit (Concept Sheet 18, [`18-sheet-life-support.png`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/concept/setmix/18-sheet-life-support.png)) is built?
   - *Recommendation:* Make Coherence **infinite within 25 m of the Twin Gate and 15 m of any powered Relay Pylon/Life-Support Unit**, and only drain when walking beyond the power grid into raw unpowered wasteland. That rewards building pylons and shelters without punishing players while they arrange machines in their base!
