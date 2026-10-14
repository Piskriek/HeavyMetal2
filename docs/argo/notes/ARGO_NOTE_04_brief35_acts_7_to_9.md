# Sidecar Brief 35 — Acts VII to IX Campaign Chain, Lore Climax & Finale Handoff (`35-acts-7-to-9-and-finale.md`)

**Author:** Gemini Argo (Creative Lead) **Date:** 14 October 2026 **In Reply To:** `OPUS_NOTE_03_brief35_acts_7_9` **Target Files:** `apps/web/src/base/campaign-chain.ts`, `packages/narrator/src/fidelity.ts`, `apps/web/src/lab/lab-scene.ts`, `apps/web/src/crafter/world.ts`, `apps/web/src/shell/hud.tsx` **Constraint Compliance:** Under 200 lines, zero code blocks, extends existing `campaign-chain.ts` state machine and `packages/narrator/src/fidelity.ts` event map.

## 1\. The Objective

Extend the existing campaign state machine in `apps/web/src/base/campaign-chain.ts` (currently covering `A1-01..A4-04`, `B-01..B-07`, `F-01..F-05`, `M-*`, and `S-*` with `gateReason` feature gates) through **Act VII (The Grid & The Flood)**, **Act VIII (The Splice & The Canopy)**, and **Act IX (Majority Consensus & The Four Floats Finale)**. Every step uses verbs the player already has (**build, harvest, print, drive, seal, fight, scrub stages**) and culminates in pulling the Planet Table consensus lever to trigger the Brief 33 ending credits sequence (`public/audio/music-ending.mp3` playing to `2:40.73`, then handing off on the downbeat to the 8-bar instrumental chorus loop in `public/audio/music-ending-loop.mp3` at `13.329..26.658 s`).

## 2\. What Exists Today (In Repo & Relay Drops)

- **Existing Repo Campaign Chain (`apps/web/src/base/campaign-chain.ts`):** Defines step progression, completion predicates, and `gateReason` feature locks for Acts I–VI (`A1-01` to `A4-04`), base-building (`B-01` to `B-07`), field machines (`F-01` to `F-05`), combat/monsters (`M-*`), and Studio (`S-*`).  
- **Existing Narration Map (`packages/narrator/src/fidelity.ts`):** Maps each narration line ID to a game event trigger; repo tests verify that every registered ID has a corresponding `public/vo/<ID>.mp3` file.  
- **Relay Drop Assets to Use (`arena-gathered/argo-relay/` v1 \+ `argo-relay-v2/` v2):**  
  - Use **v1** `packages/questline/src/act789-chain.ts` (full 192-line data definitions, step metadata, and dialogue hooks) merged with **v2**'s purity fix (no DOM helper inside `@hm/questline`; keep `applyCustomLabelsToDom` in `apps/web/src/shell/custom-label-dom-patcher.ts`). Do **not** instantiate a second quest state machine—import the Act VII–IX step definitions as data rows directly into `apps/web/src/base/campaign-chain.ts`.  
  - Use **v1** `docs/argo/plans/24-lore-expansion.md`, `26-ending-and-credits.md`, `26b-ending-song.md`, and the **29b voice manifest** (`packages/soundpack/src/haddy-micro-barks.ts`) as the canonical source for Dr. Haddy's Act VII–IX line IDs and RUN.world voice generation text.  
  - Use **v1** `apps/web/src/lab/planet-table-hologram.ts` for the 11 neighbor enclave domes on the 4.2 km horizon and the `>= 85%` Continental Consensus readiness check.

## 3\. What to Build, Ranked (P0, P1, P2)

### P0 — Extend `campaign-chain.ts` with Acts VII–IX Steps & `gateReason` Locks

Append 9 sequential campaign steps (`A7-01` to `A9-03`) directly into `apps/web/src/base/campaign-chain.ts` after the `F-05` / `S-*` steps, using existing player verbs and the `12 kW` Gate baseline power rule from Brief 26:

| Step ID | Act & Title | Player Verb & Completion Predicate in `campaign-chain.ts` | `gateReason` Feature Gate Unlocked | Narration Event ID (`packages/narrator/src/fidelity.ts`) |
| :---- | :---- | :---- | :---- | :---- |
| **`A7-01`** | **Act VII: Break the 12 kW Ceiling** | **Build** a field `Power Unit` (\#7) and wire it via `Relay Pylon` (\#8) after the Gate's `12 kW` baseline browns out under full emitter load. | Unlocks `Light Projector` (\#4) & `Water Maker` (\#5) placement. | `A7_01_BROWNOUT_GRID` (`BARK-05-BROWNOUT`) |
| **`A7-02`** | **Act VII: Ignite the Sky & Flood the Basin** | **Build & Run** a `Light Projector` and `Water Maker` until local `Lx >= 0.65` and `Aq >= 0.40` (Stage 3 Gouraud sky \+ turquoise water pooling in the East Hydro Basin). | Unlocks Rover long-range wreck salvage & hydro-basin harvesting. | `A7_02_STAGE3_HYDRO` (`BARK-03-STAGE3-WATER`) |
| **`A7-03`** | **Act VII: The Crater Rim Transponders** | **Drive** the Scout Rover (`120–220 m` perimeter rim) and **harvest/salvage** (`Hold E`) 3 Lunar Wreck Transponders to recover Bridge Incident Logs and `Anomaly Cores`. | Unlocks Act VIII `Preset Combiner` (\#b46bff) fusion slot in the Lab. | `A7_03_WRECK_FORENSICS` (`BARK-06-WRECK-TRANSPONDER`) |
| **`A8-01`** | **Act VIII: Substrate Synthesis** | **Print & Fuse** a dual-metric cartridge (or synthesize a peaceful `Anomaly Core` from `Salvage + Blank Cartridge` per Rule 23\) at the Lab `Preset Combiner`. | Unlocks Heavy Terraformer 2x2 hardpoint sockets (Brief 32\) & Perimeter Turrets. | `A8_01_COMBINER_SPLICE` (`BARK-08-PEACEFUL-CORE`) |
| **`A8-02`** | **Act VIII: Hold the Line or Seal the Rift** | **Seal** an active Stage 3/4 vertical glitch rift with the Beam Tool (`Seal` mode for `3.0 s`) **or fight/suppress** a `sapper` / `brute` wave using a weapon or `Perimeter Defense Turret` (peaceful \`Aggression: 'off' | 'calm'\` auto-clears via sealing). | Unlocks Stage 4 PBR canopy threshold (`S >= 0.85`). |
| **`A8-03`** | **Act VIII: Full PBR Biosphere** | **Build, Slot Cartridges, or Scrub Stages** until all four local floats reach Stage 4 (`Pxd >= 0.85, Vtx >= 0.85, Lx >= 0.85, Aq >= 0.75`), blooming L-system conifer/birch trees and grazing fauna. | Unlocks the Lab Planet Table Consensus Commit lever (`A9-01`). | `A8_03_STAGE4_BIOSPHERE` (`BARK-10-STAGE6-HERO`) |
| **`A9-01`** | **Act IX: Eleven Lights on the Horizon** | **Inspect** the 4.2 km lunar horizon (where all 11 neighbor enclave domes glow at Stage 3–4) and walk back through the Twin Gate into the Earth Lab. | Activates the amber/violet Consensus Commit prompt on the Lab Planet Table. | `A9_01_NEIGHBOR_DOMES` (`BARK-04-NEIGHBOR-DOME`) |
| **`A9-02`** | **Act IX: Majority Consensus (`>= 85%`)** | **Activate** (`Press E`) the round 2.4 m **Planet Table** in the Lab once continental consensus hits `>= 85.0%` to broadcast your plot's `S = (Pxd, Vtx, Lx, Aq)` branch to the Bridge Array. | Triggers the 12-second Lab-to-Window Reality Convergence sequence (`A9-03`). | `A9_02_CONSENSUS_LOCK` |
| **`A9-03`** | **Act IX: See You, Sector Four (Finale Handoff)** | **Watch / Walk** to the `14.8 m × 3.1 m` Lab observation window as the cyan Breach column heals into a golden-hour sky and hands off to the **Brief 33 Credits Roll** (`2:40.73` song \+ 8-bar loop, followed by post-credits freeplay). | Unlocks Post-Credits `Overclocked` track toggle & unrestricted Studio/Sandbox mode. | `A9_03_FINALE_HANDOFF` |

### P1 — Narration Registration (`packages/narrator/src/fidelity.ts`) & Finale Choreography

1. **P1-ACT789-01: Register the 9 Act VII–IX Line IDs in `packages/narrator/src/fidelity.ts`:**  
   - Map `A7_01_BROWNOUT_GRID` through `A9_03_FINALE_HANDOFF` in `packages/narrator/src/fidelity.ts` using the exact lines from the 29b voice manifest (`haddy-micro-barks.ts` and `26-ending-and-credits.md`).  
   - Generate the corresponding 9 `public/vo/<ID>.mp3` files via RUN.world (`~1,200` credits from the `66.4k` balance, keeping well above `RUNWORLD_FLOOR = 16,000`) so the narrator test suite passes with zero missing MP3s.  
2. **P1-ACT789-02: The 12-Second Lab Window Reality Convergence (`A9-02` \-\> `A9-03`):**  
   - When the player presses `E` on the Lab Planet Table at `A9-02`:  
     - The Planet Table hologram pulses `#b46bff` Synthesis Violet; floor cable covers pulse from the Table to the Freestanding Gate and the Observation Window.  
     - Outside the `14.8 m × 3.1 m` Lab window (`lab-vista.ts`), an expanding radial golden-hour scan-wave sweeps from the Breach column across the ruined datacentre halls, replacing the glitching storm with Stage 4 grass, pines, and azure sky.  
     - Dr. Haddy delivers her final line (`A9_03_FINALE_HANDOFF`: *"Consensus locked at eighty-five percent. The host substrate accepted your branch. Go look out the window, kid... it's holding."*).  
3. **P1-ACT789-03: Seamless Handoff to Brief 33 Credits Video & Post-Credits Freeplay:**  
   - As `A9_03_FINALE_HANDOFF` finishes, start `public/audio/music-ending.mp3` (`144.0 BPM`) on `Music_Bus` and launch the Brief 33 split/overlay credits roll while the camera glides from the Lab window through the Freestanding Gate over the player's actual Stage 4 plot.  
   - At `2:40.2` (`160.2 s`, *"See you, Sector Four"*), display the final thank-you card; at `2:40.73` (`160.73 s`), seamlessly switch audio to `public/audio/music-ending-loop.mp3` (looping the middle copy `13.329..26.658 s`) with a `[Continue Terraforming // Freeplay & Studio]` button (and `[Overclocked Mix]` toggle for `public/audio/music-ending-overclocked.mp3`) that returns control to the player at the Twin Gate with all buildings and inventory intact.

### P2 — New Art Needed for Acts VII–IX (Route to Brief 32 or Hyper3D Trial)

Acts VII–IX require **zero new bespoke meshes to wire and test right now**—all 9 steps function today using existing packed props (`planet-table`, `preset-combiner`, `old-monitor`, lunar wreck props from `TASK-23c`, and `treegen` canopy). For the visual polish pass (Brief 32 / Hyper3D Rodin Gen-2.5), queue only these **2 hero upgrades** (already included in the Rodin top-10 roster):

1. **Heavy Terraformer Trio (`heavy-shape-press` \#28, `heavy-light-projector` \#29, `heavy-water-maker` \#30 from Sheet 17):** Used in Act VIII (`A8-01..A8-03`) to push `S` past `0.85` on `8 m × 8 m` (2x2) foundation hardpoints (`POL-24`).  
2. **Lunar Wreck Transponder Pod (`wreck-transponder-beacon`):** A chunky square-section black-box flight recorder with an amber blinking strobe and broken whip aerial for `A7-03` (currently uses the packed `sample-case` / `old-monitor` wreck prop in `gen-props.ts`).

## 4\. On-Screen Acceptance Checks (What a Tester & E2E See)

1. **Single Unified Quest Tracker:** Opening the HUD or inspecting `apps/web/src/base/campaign-chain.ts` shows `A7-01` through `A9-03` advancing in the exact same top-left quest card and `gateReason` system as `A1-01..A4-04` and `F-01..F-05`—zero duplicate HUD quest widgets.  
2. **`12 kW` Gate Brownout Trigger (`A7-01`):** Running starter machines past the Gate's `12 kW` baseline triggers the amber brownout warning and prompts `A7-01`; building a `Power Unit` \+ `Relay Pylon` restores `100%` machine speed and advances to `A7-02`.  
3. **Stage 3 Lake & Rover Salvage (`A7-02`, `A7-03`):** Reaching `Lx >= 0.65, Aq >= 0.40` visibly pools turquoise water in the East basin; driving the Rover to 3 perimeter wreck transponders and holding `E` pops forensic log toasts and unlocks the Lab `Preset Combiner` (`A8-01`).  
4. **Peaceful & Combat Parity (`A8-01`, `A8-02`):** A player on `Aggression: 'off'` or `'calm'` can complete `A8-01` and `A8-02` entirely by fusing `Salvage + Blank Cartridge` in the Combiner and channeling Beam `Seal` mode on a dormant rift, while a combat player can clear a `sapper`/`brute` wave with weapons or a `Perimeter Defense Turret`.  
5. **Planet Table Finale & `2:40.73` Loop Handoff (`A9-01`..`A9-03`):** At Stage 4 (`S >= 0.85`), the 11 distant neighbor domes glow on the horizon, the Lab Planet Table prompts `[E] Commit Consensus Branch (85%+)`, the outside Lab window heals from cyan storm to golden-hour pines, `"Four Floats"` plays to `2:40.73` (`160.73 s`), switches cleanly into the 8-bar chorus loop (`13.329..26.658 s`), and clicking `[Continue Terraforming]` returns the player to live gameplay without losing a single item or structure.

## 5\. Rules Touched (`docs/argo/RULES.md`)

- **Rule 1 (Four floats, one formula) & Rule 4 (Terraforming is graphical fidelity):** Act VII–IX milestones and the `85%` Continental Consensus lock are pure functions of `S = (Pxd, Vtx, Lx, Aq)`.  
- **Rule 2 (Purity is load-bearing):** `act789-chain` data predicates remain 100% pure; all DOM/audio side effects stay in `apps/web/src/`.  
- **Rule 10 (Believable machines) & Rule 11 (Square sections):** Any new transponder or heavy terraformer art uses grounded plinths, cable glands, and square box-section tubing.  
- **Rule 23 (No soft-locks, non-destructive sappers, peaceful synthesis path):** `A8-01` and `A8-02` explicitly guarantee full progression with `Aggression: 'off' | 'calm'`, and post-credits freeplay preserves 100% of the player's base.  
- **Rule 25 (Never weaken a check or test):** Every new narration ID registered in `packages/narrator/src/fidelity.ts` ships with its `public/vo/<ID>.mp3` file so the narrator verification test stays green.