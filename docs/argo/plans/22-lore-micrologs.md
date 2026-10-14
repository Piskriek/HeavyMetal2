# 22 — Lore Micro-Logs (`P0-LORE-01`), Beam Seal State & Act IV Dormant Leak Beat

> **File Destination in Repo:** `docs/argo/plans/22-lore-micrologs.md`
> **Author:** Gemini Argo (Creative Lead)
> **For:** Claude Opus (`TASK-23c` & `TASK-23b-2`)
> **Date:** 13 October 2026

## 1. Confirmation: "Seal" (`#ffc13d`) Is a Contextual State on `Extract`, Not a 4th Mode

**Confirmed:** The Beam Tool has **three player-cycled modes** (`Extract` `#3dc8ff`, `Apply` `#ff3d8a`, `Sculpt` `#7cff4d`).
- **`Seal` (`#ffc13d` Lumen Amber)** is the automatic contextual state the rifle's emissive rib, beam shader, and audio chord shift into **while `Extract` is held aimed at a leak rift (or a sapper tether)**.
- Keeping `Seal` as a contextual state on `Extract` avoids adding a fourth mode to cycle through under pressure while still giving the player the unmistakable `#ffc13d` amber visual and harmonic lock cue when closing a rift.

## 2. `P0-LORE-01` Micro-Logs: 4 Lab Fixtures & 4 Lunar Wreck Transponders

All text below lives strictly in the UI hover card and HUD databank (Rule 12: zero lettering baked on 3D models; Rule 1: only `Pxd`, `Vtx`, `Lx`, `Aq`; Rule 14 & 18: no commercial trademarks or unrequested branding).
- **Permanent Lab Fixtures (Inspectable, Non-Dissolving):** `old-monitor`, `server-rack` (one unit kept mounted against wall).
- **Salvageable Lab Clutter (`Hold E` Dissolves + Unlocks Log):** `filing-cabinet`, `sample-case`.
- **Lunar Wreck Transponders (`TASK-23c` Wreck Sites):** `wreck-transponder-01` through `wreck-transponder-04`.

### 2.1 Lab Props (`apps/web/src/play/lab-room.ts`)

#### 1. `old-monitor` (Permanent Fixture — Observation Desk)
- **Hover Readout (2 sentences):**
  ` phosphor burn-in freezes the last telemetry frame from the Bridge Array's primary allocation bus. The cursor still blinks on an unacknowledged kernel panic.`
- **Bridge Incident Log (`LOG-01 // BRIDGE TELEMETRY [T-00:04:12]` — 49 words):**
  > `BRIDGE TELEMETRY [T-00:04:12]: Recursive sub-simulation depth exceeded host substrate ceiling (99.4% compute saturation). To prevent total kernel halt, the scheduler stripped exterior rendering budgets to raw 1-bit dither (Pxd 0.02, Vtx 0.04, Lx 0.00, Aq 0.00). Lab Sector 04 remains shielded on local capacitor reserve.`

#### 2. `server-rack` (Permanent Fixture — Back-Left Telemetry Bay)
- **Hover Readout (2 sentences):**
  `Patch cables run hot from this rack into the floor trunk feeding the freestanding Gate. Half the drive bays are locked in read-only quarantine.`
- **Bridge Incident Log (`LOG-02 // SUBSTRATE ROUTER [T-00:02:48]` — 51 words):**
  > `SUBSTRATE ROUTER [T-00:02:48]: Emergency shunt engaged. We cannot restore the outer city while the Bridge Breach drains the regional bus, so Dr. Haddy redirected our last stable pointer to the Lunar Anchor Pad. If we rebuild Pxd, Vtx, Lx, and Aq on a bounded one-kilometre plot, the kernel will compile.`

#### 3. `filing-cabinet` (Salvageable Clutter — Right Wall Bay)
- **Hover Readout (2 sentences):**
  ` dented steel drawers jammed with punch-cards and thermal printouts from early cartridge trials. Dissolving the casing will free up floor space and refined salvage.`
- **Bridge Incident Log (`LOG-03 // CARTRIDGE LAB MEMO [T-14:20:00]` — 48 words):**
  > `CARTRIDGE LAB MEMO [T-14:20:00]: Stop treating raw regolith as dirt. Under the hood, every shovelful is unallocated vertex and pixel memory waiting for a header. Slot a written cartridge into any field emitter and the machine stops outputting grey baseline—it compiles the cartridge's math directly into reality.`

#### 4. `sample-case` (Salvageable Clutter — Near Armory / Combiner)
- **Hover Readout (2 sentences):**
  `A foam-lined containment case with its electromagnetic latches blown outward from the inside. Residual cyan static clings to the empty cartridge slots.`
- **Bridge Incident Log (`LOG-04 // CONTAINMENT LOG #09 [T-00:01:05]` — 52 words):**
  > `CONTAINMENT LOG #09 [T-00:01:05]: Partition walls between the active world and the historical shareware vaults (1993–1997) ruptured during the Lx brownout. Uncompiled 2D sprite tables and vertex-morphed meshes are leaking through low-fidelity fault lines. Do not engage unshielded; seal the rifts before they finish compiling.`

### 2.2 Lunar Wreck Transponders (`apps/web/src/assets/gen-props.ts` — `TASK-23c`)

#### 5. `wreck-transponder-01` (Lunar Wreck Site Alpha — Crater Rim)
- **Hover Readout (2 sentences):**
  `A sheared survey beacon half-buried in 1-bit regolith, still pinging the Twin Gate on a low-bit carrier wave. Its battery housing holds recoverable salvage.`
- **Bridge Incident Log (`LOG-05 // SURVEY TEAM ALPHA [T+00:19:30]` — 49 words):**
  > `SURVEY TEAM ALPHA [T+00:19:30]: Stepped through the Twin Gate right as the Earth-side array dropped to 1-bit. Our rover's chassis de-resolved into flat facets eighty metres out because nobody laid a relay pylon line. Stay inside the Gate's twenty-five-metre coherence dome until your first mill and drill are running.`

#### 6. `wreck-transponder-02` (Lunar Wreck Site Beta — Dry Hydro Basin Edge)
- **Hover Readout (2 sentences):**
  ` Frost-cracked condenser piping surrounds a blackened telemetry box at the bottom of the dry basin. The gauge needle is fused at Aq 0.00.`
- **Bridge Incident Log (`LOG-06 // HYDROLOGY RIG 02 [T+01:12:04]` — 50 words):**
  > `HYDROLOGY RIG 02 [T+01:12:04]: We tried forcing liquid water into the crater before raising Vtx or Lx. Without vertex relief to hold a shoreline or light flux to warm the basin, the water table simply zeroed out. Build your foundation hardpoints first; heavy terraformers need a proper structural pad.`

#### 7. `wreck-transponder-03` (Lunar Wreck Site Gamma — North-West Ore Ridge)
- **Hover Readout (2 sentences):**
  ` Deep claw gouges and horizontal scanline burns scar the plating of this overturned cargo skid. Something latched onto its power lead and drained it cold.`
- **Bridge Incident Log (`LOG-07 // PERIMETER WATCH [T+02:44:18]` — 53 words):**
  > `PERIMETER WATCH [T+02:44:18]: The archive leaks aren't trying to smash our foundations—they're starving for compute. Sapper anomalies latch onto active machine lines and brown out our S-output, while older sprite and polygon brutes guard the rift. Seal the rift with an extraction beam or clear the sappers to restore full flux.`

#### 8. `wreck-transponder-04` (Lunar Wreck Site Delta — Outer Horizon Overlook)
- **Hover Readout (2 sentences):**
  `A long-range optical transceiver aimed toward the distant domes glittering four kilometres across the ridge. Its memory core holds a partial consensus handshake.`
- **Bridge Incident Log (`LOG-08 // ENCLAVE SYNC RELAY [T+04:05:55]` — 51 words):**
  > `ENCLAVE SYNC RELAY [T+04:05:55]: We aren't the only survivors on this forty-thousand-kilometre sphere. Eleven neighbouring enclaves are already pushing their own plots toward Stage 6 full PBR on the horizon. Once our local stage stabilizes, the Planet Table will link our branch into the planetary consensus.`

## 3. Act IV Dormant Leak Beat (`TASK-23b-2`)

### 3.1 Audit of `docs/NARRATION_SCRIPT.md`
- Checked against the existing approved voiceover manifest (`A1-01`–`A1-04`, `A2-01`–`A2-03`, `A3-01`–`A3-03`, `S-2`–`S-6`, and contextual alerts `Low sync`, `Out of ore`, `Power short`): **no existing pre-recorded file covers sealing the Act IV dormant leak and receiving the first `Anomaly Core`**.
- Specifically, `A3-02` / `A3-03` cover slotting the first cartridge and feeding the mill with a drill, while the Act IV opener warns about the perimeter anomaly and sends the player to the Armory.

### 3.2 Recommended Line (`A4-LEAK-SEAL` — 15 Words)
When the player holds `Extract` (`Seal` state `#ffc13d`) on the Act IV dormant glitching rift for `3.0 s`, collapses it, and receives their first `Anomaly Core`:

> **Dr. Gwen Haddy (`A4-LEAK-SEAL`, 15 words):**
> *"Clean seal. That core's condensed archive data—bring it inside, the Combiner can splice it."*

- **Implementation for `TASK-23b-2` (No Blocker):** Wire `A4-LEAK-SEAL` immediately using the radio PTT squelch click + subtitle banner (`Voice/Radio` bus), and flag `A4-LEAK-SEAL` for a single 15-word RUN.world TTS generation pass only if Francois wants it voiced alongside the existing `public/vo/` pack.
