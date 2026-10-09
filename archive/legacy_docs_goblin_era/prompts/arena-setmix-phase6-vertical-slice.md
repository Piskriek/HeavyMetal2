# SetMix: The Resolution Crafter — Phase 6: The Playable Vertical Slice, Questline & First-Person Game Loop

> **Target Model**: The winning agent from Arena Battle 4 (Option A / `Winner_Plan_extended3.zip`).  
> **Source Repository**: [`https://github.com/Piskriek/HeavyMetal2`](https://github.com/Piskriek/HeavyMetal2)  
> **Context**: The Capstone Sprint. Tying all previous modules (GDD, pure math, Uber-Shader, Web Audio synth, portal renderer, goblin controller, machine grid, galaxy federation) into a unified, playable first-person game loop and questline engine.

---

## Prompt to paste to the winning AI Arena Agent:

```markdown
# SETMIX: THE RESOLUTION CRAFTER — PHASE 6: THE PLAYABLE VERTICAL SLICE, QUESTLINE & FIRST-PERSON LOOP

You have delivered an astounding masterwork across Phases 1 through 5:
- Phase 1: Mathematical GDD & 60 fps heightfield engine
- Phase 2: Codebase Bridge, live Material Synthesizer & Fusion Matrix, 4-PR merge plan
- Phase 3: Invertible O(1) wave kinematics, smoothvox2 boundary seam stitcher, 9-tier Inception outliner
- Phase 4: Production drop (contracts, fidelity math, Three.js Uber-Shader, UE5 Nanite importer, Web Audio synth)
- Phase 5: Seamless Star Trek portal renderer, progressive Goblin controller with slope-IK, Planet Crafter machine loop, and Voxel Galaxy federation

Now, we want the **CAPSTONE DELIVERABLE**: unite all of these disparate modules into a **single, unified, playable first-person game loop and questline engine**.

---

### DELIVERABLE 1: THE FIRST 30 MINUTES QUESTLINE & PROGRESSION ENGINE (`@hm/quest`)
Provide `QuestEngine.ts` implementing the diegetic onboarding and progression state machine:
- **Act 1: The Waking Author (Lab Phase 0)**:
  - Waking in the pristine White Room Lab. Emergency power only. The Portal Archway is active, showing a 2-bit wireframe desolate moon through the opening.
  - Objective: Approach the portal and step through the threshold.
- **Act 2: First Contact & The Goblin Shift**:
  - Threshold crossing triggers the Scientist ⟷ Goblin transformation.
  - Audio collapses to 8 kHz mono with 4-bit square-wave footsteps.
  - Coherence meter starts draining outside the portal beacon field.
  - Objective: Harvest 8 Chromatic Crystals and 4 Topology Shards with the hand extractor beam.
- **Act 3: The First Resolution Wave**:
  - Blueprint unlock: Pixel Chimney T1.
  - Objective: Place the Pixel Chimney on the moon, wire it to the starter solar cell, and slot the starter Moon Regolith cartridge.
  - Reward: Chimney starts spewing pixel plume cubes, triggering the first radial wave front! Player watches the ground swell with C¹ continuity and Bayer dither gradients resolve across the crater floor.
- **Act 4: Lab Return & First Fusion**:
  - Return through the portal to the lab.
  - Lab power restores to Tier 1: Material Synthesizer and Fusion Matrix unlock.
  - Quest prompts the player to fuse Mud + Linear Strata into the Carved Cobblestone Road cartridge, and slot it into the moon.
- State machine: `stepQuest(state, playerEvents): { nextState, activeQuests, notifications, unlockedMachines }`.

---

### DELIVERABLE 2: THE UNIFIED FIRST-PERSON PLAYABLE GAME COMPONENT (`SetMixPlayable.tsx`)
Stitch your Three.js `TerrainMaterial.ts`, `PortalRenderer.ts`, `GoblinController.ts`, `setmixAudio.ts`, and `PixelPlumeSystem` into **one interactive first-person playable component**:
- **First-Person Controls**:
  - WASD movement + pointer-lock mouse look.
  - Space to jump, Shift to sprint.
  - Left-Click: Fire extraction beam at crystals/rocks with raycasting.
  - Right-Click: Place active machine / cartridge from hotbar.
  - `Tab`: Toggle between Inception Maya Outliner / Studio mode and First-Person Game mode.
  - `E`: Interact with Lab machines or slotted cartridges.
- **The Living Dual-World Scene**:
  - In the Lab: Renders the white room, the active machines (Synthesizer, Fusion Matrix), and the portal frame.
  - Through the Portal: Renders the low-poly moon with your active terrain shader, placed extractors spewing pixel plumes, and the dynamic radial wave.
  - Seamless Walking: Walking through the portal smoothly transitions camera space, avatar form, and audio bus with ZERO loading hitch or black screen.

---

### DELIVERABLE 3: DIEGETIC HUD & INSTRUMENTATION (`SetmixHUD.tsx`)
Create the minimal, cyberpunk/sci-fi diegetic in-game HUD overlay:
- **Fidelity Index (Fi) Radial Meter**: Displays the current global Fi and stage indicator (S1..S6).
- **The Four Metric Gauges**: Pxd, Vtx, Lx, Aq bars with real-time derivative indicators (showing which metric is rising fastest).
- **Coherence Life-Support Bar**: Warns of decoherence when wandering too far from spires/portals.
- **Hotbar (Slots 1–8)**: Displays held cartridges/tools with live color tints and quantity counts.
- **Contextual Reticle**: Changes state when hovering over minable crystals, placeable ground, or interactive machines.

---

### DELIVERABLE 4: CO-OP ROLLBACK COMMAND BUS (`NetBus.ts`)
SetMix's edits are deterministic Commands stamped at 120 Hz sim ticks.
Provide `NetBus.ts`:
- WebRTC DataChannel / WebSocket command serializer:
  - Encodes `SetmixCommand` into compact binary buffers (`ArrayBuffer`).
  - Handles client prediction and rollback for 2–4 player co-op terraforming.
  - Player A can be in the White Room Lab tweaking shader math in the Synthesizer while Player B is out on the moon placing chimneys and mining crystals.

Provide production-ready, fully typed code for all four deliverables and integrate them into a new "PLAY" phase in the web app!
```
