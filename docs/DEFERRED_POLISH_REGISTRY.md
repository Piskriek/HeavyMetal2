# FIDELITY // DEFERRED POLISH & TUNING REGISTRY
> **Purpose**: Master tracking registry for all performance tuning, visual polish, and deferred tasks across *FIDELITY: The SetMix Multiverse*.  
> **Workflow**: Lead engineers (Claude Opus / Arena Agents) focus on core systems and game loops without getting bogged down in micro-polish. Items logged here can either be tackled in the final polish pass or handed off to the pair-programming sidecar agent for immediate tuning.  

---

## 1. Visual & Rendering Polish

| ID | Item | Source / Context | Action Required | Owner / Status |
|---|---|---|---|---|
| **POL-01** | **Main Menu Window Vista: Desolate Wasteland + Glitch** | Owner (2026-10-07 21:02) | The window/archway in the main menu should look out onto a **desolate wasteland** (Stage 0/1) instead of the finished lush planet, with an active **out-of-sync glitch effect** (dither flicker, chromatic aberration, CRT scanlines). | Handed to sidecar. |
| **POL-02** | **Plume Ground Glow** | Owner / Optimization Spec | Dynamic ground lighting/glow underneath pixel plume spires. Originally written, reverted to preserve Low-spec frame rate. | **Done in TASK-08** (Sidecar, 2026-10-08): added soft colored radial ground glow under pouring machines, conforming to terrain height via additive custom blending; wired behind Graphics setting `plumeGlow`. |
| **POL-03** | **Ultra Pixel Lighting** | Owner / Optimization Spec | Point light emission from floating voxel particles on Ultra graphics tier. | **Done in TASK-08** (Sidecar, 2026-10-08): added dynamic colored PointLight emission at the vent/plume of each pouring pixel machine with organic flicker; wired behind Graphics setting `pixelLights`. |
| **POL-04** | **Stage 4+ Low Spec Frame Rate (49.5 $\to$ 60 FPS)** | Claude Opus / Baseline Spec | Stage 4 on Low spec measures 49.5–50 FPS on laptop (governor threshold is 48 FPS). Needs capping of Low's distant planet grid lines or ground shader LOD steps. | **Done in TASK-08** (Sidecar, 2026-10-08): capped `PLANET_LINES['low']` to 480 (from 720) and Potato to 360, preventing fillrate penalty; reduced `GROUND_BUDGET.low` to 75k tris; verified 60 FPS hold. |
| **POL-05** | **47-Tile Blob Transition Set** | Terrain Specification | Replace raw 4x4 Bayer transition dither with curated 47-tile autotile blob set for smooth terrain block neighbours. | Texture pipeline pass. |
| **POL-17** | **Twin Gate Detail on the Planet** | Claude Opus (2026-10-07) | The planet's twin gate is built once at stage-1 detail; rebuild it at full detail when the plot reaches stage 2. | **Done in TASK-08** (Sidecar, 2026-10-08): `rebuildTwin` rebuilds twin gate at stage 6 on reaching stage 2. |
| **POL-06** | **Console & Mill Visual Upgrades** | Arena Battle `console-mill` | Richer 3D operator console and texture mill props from concept sheet 12. | **Done in TASK-08** (Sidecar, 2026-10-08): swapped `@hm/consolemill` operator console into lab room and texture mill into machine props. |
| **POL-23** | **Anomaly Field Node Concept Models** | Sidecar TASK-04 | Stand-in node geometries (dodecahedron, torus, icosahedron, cone) await dedicated concept art pass from Arena Codex/Art agents. | Concept Art pass. |
| **POL-24** | **Heavy Terraformer Industrial Models** | Sidecar TASK-04 | Heavy terraformer machines currently use 1.9x scaled stand-in props on 8m hardpoints. Await multi-tier industrial modular models. | 3D Asset pass. |
| **POL-25** | **Window Flash on the Lab Floor** | TASK-19 review 3 (2026-10-13) | A static burst in the window view should briefly light the lab floor. The light gain is up (+12 per unit of flash, capped at 0.7), but the capture lands about 0.3 s after the peak, so it cannot be shown yet. Add a peak hook in the vista and check it by eye. | Polish pass. |
| **POL-26** | **Stage-0 Storm Ground Speckle** | TASK-19 review 3 (2026-10-13) | At progress 0 the window's dust plain is EGA-quantised (Pxd 0.15) and speckles black and white. It follows the plan's fidelity, but it is busy. Kept for now; a candidate for the owner's Studio polish (raise the ground's Pxd or soften the dither). | Owner's Studio pass. |
| **POL-27** | **Single-File Size Watch** | Opus (2026-10-13) | Was 17.9 MB. **Closed 2026-10-13 (0e3a6f2e): 14.51 MB.** Astro's mid and high levels moved to the HD pack, and a duplicate QuickJS was removed. The build now fails above 16 MB (vite.config.ts, hm-size-gate). Next room if needed: vista-only props to a fetched side file behind the loading bar. TASK-24 still measures the load and parse time on the GTX 950M. | Closed; gate in the build. |
| **POL-28** | **Two-Hand IK on the Rifle** | TASK-21c (2026-10-13) | The third-person left hand aims at the beam's foregrip socket but isn't IK-placed on it; from the side the foregrip reads foreshortened. Add a two-bone IK for the left arm to the foregrip socket. | Polish pass. |
| **POL-29** | **Seam at the Sculpt-Refined Ground's Edge** | TASK-21d (2026-10-14) | Where refined chunks (16 m, near a cut) meet coarse ones, a thin straight line shows on the ground (docs/shots/beam/09-sculpt-third-person.png). The skirts do not hide it, and a full balance pass costs about 190k triangles. Stitch instead: snap the fine leaf's border vertices to the coarse neighbour's edge line (geomipmap crack fixing). | Polish pass. |
| **POL-30** | **Extract Ring Dashed on Slopes** | TASK-21d (2026-10-14) | The brush ring is lifted 0.06 m and reads dashed where the ground slopes (shot 07c). Lift it by the local slope, or draw it as a projected decal. | Polish pass. |
| **POL-31** | **Sappers and the Gate Dome (a ruling needed)** | TASK-24 (2026-10-14) | The gate's 25 m dome is a sanctuary the monsters never enter (P0-MON-03), and the base stands inside it. So a sapper stops at the dome's edge and cannot latch the fabricator or any other base machine in the campaign (beat 28c shows it; the latch is proven in unit tests). The owner or Opus must rule: may sappers enter the dome to drain machines, or do base machines stay safe there? | **Ruled (owner, 2026-10-15, via Opus):** the safe dome protects the player, not the whole base. Sappers can still brown out structures outside the 25 m dome (and outside the 15 m pylon and shelter domes). TASK-26 changes no sapper rule; beat 28c still holds inside the gate dome. |
| **POL-32** | **Monsters Stall at Built Walls (no route round)** | TASK-24 (2026-10-14) | Ground monsters keep out of built footprints (leaksim solids), but they slide or stall at a wall; nothing routes them round it. The path needs the base nav (`navFor` in `base/navgrid.ts`) with a pathfinder, fed to the brain as a pure input. | Build with brief 30 (Wave C). |
| **POL-33** | **Spitter Bolts Fly Over Walls** | TASK-24 (2026-10-14) | Bolts ignore built footprints (only the walkers are kept out). A wall should stop a bolt. | Polish pass. |
| **POL-34** | **Avatar Luminance in the Third-Person Moon Shot (not added)** | TASK-24 (2026-10-14) | The brief asks for a check that the avatar's pixel patch is above 35/255 in the third-person Moon shot. No such shot exists in the campaign, so the check is not in the run. Add it with the third-person capture. | Open. |
| **POL-35** | **Title Cards Hold Only CANNOT PLACE** | TASK-24 (2026-10-14) | P0-UI-01 says a title card holds every other banner until it fades. Only CANNOT PLACE is held (`body[data-title-up]`); the other toasts still replace each other at once. Queueing them would change the campaign's toast timing, so it waits for brief 25. | Brief 25. |
| **POL-36** | **Manual Sweep Not Finished** | TASK-24 (2026-10-14) | Not run by hand: building on a slope and carving under a piece, a full inventory, driving into a mob, reloading mid-print, entering the gate with the beam out, and a profile from before TASK-20. The campaign covers the chain, the carve and the wheel death (beat 26). | Open. |
| **POL-37** | **Fights Read Not Tuned** | TASK-24 (2026-10-14) | The brief asks for a fight shot per era at stages 1 and 6, and the overlay tuned down if a monster reads as a pink smear (campaign shot 39). The stage 6 fight shot is taken; the stage 1 shot and the overlay pass are not done. | Open (art pass). |
| **POL-38** | **Voice Metadata for the Leak Lines** | TASK-24 (2026-10-14) | `apps/web/public/vo/A4-LEAK-SEAL.mp3.json` and `A6-LEAK-SURGE.mp3.json` are untracked (the mp3s are tracked). The runtime does not read them, but they belong with the voiced lines. Opus to commit with the next voice batch. | Opus. |
| **POL-39** | **Machine Status LEDs on the Housing** | TASK-25 (2026-10-14) | Labels are aim-gated (14 m, 8 degrees, Alt). The square emissive LED on each housing (green running, amber blink for no ore or brownout, red unpowered) is not built. It needs a per-kind housing anchor in `apps/web/src/play/machine-props.ts`, so the LED sits on the surface. |
| **POL-40** | **Dr. Haddy Portrait in the Top-Left Zone** | TASK-25 (2026-10-14) | The portrait that slides in while she speaks needs an approved portrait asset, and none is in the repo. The subtitle pip stands in for it. |
| **POL-41** | **Pixel Font for the Low-Bit Skins** | TASK-25 (2026-10-14) | Share Tech Mono (or VT323), OFL, about 18 KB, is not in the repo and was not fetched (a download needs the owner's OK). Skins 0a, 0b and 1 fall back to monospace until it is embedded; CREDITS.md goes with it. |
| **POL-42** | **Skin Degauss Tick and EGA Metric Colours** | TASK-25 (2026-10-14) | The 40 ms degauss tick on `Combat_UI_Bus` (plan 28 section 5) is not wired. Metric bars carry their per-skin patterns, but the metric colours are not quantised to the EGA hardware palette in skin 1. |
| **POL-43** | **Bottom-Right Ticker Gaps** | TASK-25 (2026-10-14) | Linked-bin counts (`Ore 24 (+140)`) are not in the ticker. Gun ammo is a bottom-left badge, not in the ticker. Pickup toasts still share the title toast. |
| **POL-44** | **Driving Drift, Leak Bearings and the Gate Dome** | TASK-25 (2026-10-14) | Driving shows the speed badge but not drift. The compass shows the Gate only; leak bearings wait for TASK-23b-2. The suit gauge does not hide inside the 25 m gate dome until TASK-26 lands it. |
| **POL-45** | **Build Drawer Width Below 1280 px** | TASK-25 (2026-10-14) | The drawer caps its width at 100vw minus 496 px, so it clears the 200 px side stacks. At 1024 px it is 528 px wide and its cards scroll. |
| **POL-46** | **Build Drawer Bottom at 104 px, not 92 px** | TASK-25 (2026-10-14) | The brief says 92 px, but the hotbar is 76 px tall at bottom 24, so the drawer sits at 104 px to clear it. Opus to decide: shorten the hotbar, or keep 104 px. |
| **POL-47** | **Clean Shots for Driving and Fights** | TASK-25 (2026-10-14) | Not captured: the driving and fight states need a scripted setup. Shots exist for the planet HUD, the open and picked ribbon, the hologram lock, the aimed and Alt labels, and skin stages 3 and 6. |
| **POL-48** | **The Scan Wave Never Runs in Live Play** | TASK-27 (2026-10-15), closed 2026-10-15 | Fixed by the coordinator's ruling. A standing machine now starts stage 0b (one rule: `stage0IsDithered` in `@hm/plotsim`, used by the HUD skin and the scene's scan). Stage 1 comes from the first output of a pixel machine, not from placing one (`plotsim` `place` no longer sets the stage; `step` sets it on output). The scene is raised to stage 1 on that event (`play.tsx`). The campaign passed 40 of 40 with no beat setup change. |
| **POL-49** | **Turn Test Above the 10% Target** | TASK-27 (2026-10-15), target changed 2026-10-15 | `scripts/test-stage-looks.mjs`: the flip fraction of a 64 by 64 ground patch on a 5 degree yaw is 26.3% before (the pre-change shader) and 16 to 17% now. The target is now 10% (the measured floor at 6 px cells is 7 to 8%). It still fails at 16 to 17%: the rest is the cell-based contours and facet noise on rough ground. Logged as polish, not loosened further. |
| **POL-50** | **Modular Scout (Brief 27b, Item 4)** | TASK-27b (2026-10-15) | Not built. The raycast aerial, the square yoke in the empty cab and `VEHICLE_FIT` for the redone hauler are vehicle modelling, not rover camera work. Argo's drop does not contain `MODULAR_SCOUT_SOCKETS` in `rover-spring-arm.ts` (the guide says it does). |
| **POL-51** | **Rover Drive Test: Wall and Crater** | TASK-27b (2026-10-15) | Not run in a browser: the harness has no fabricated rover in the base world, so `enterVehicle` cannot be reached. The arm is unit-tested (`rover-camera.test.ts`: a wall at 3 m gives 2.65 m; the floor clamp holds on a lip; the horizon stays level; pitch lags 0.12 s). Still to do: drive into a crater and a rock wall, and sample the depth at screen centre (never under 0.3 m). |
| **POL-52** | **The Scan Ring Holds at 350 m** | TASK-27 (2026-10-15), logged per the ruling | The ring runs out to 350 m in 3.5 s and holds there while the wire outside it dissolves one bit at a time over 2 s. The ruling asks for the ring to fade out at its maximum radius rather than hold visibly; that is logged, not built. The far world does not sweep to the horizon. |
| **POL-53** | **Suit-Cam Overshoot and Settle** | TASK-27 (2026-10-15) | Plan 25's lab factor (0.65) gives +0.62 EV at the step, not the plan's +0.85. With the 0.28 s step-down the overshoot is a quarter (0.15 EV) at 0.4 s and under 0.02 EV at 1 s; the brief's "settles in about 0.4 s" is read as that quarter. Opus to confirm. |
| **POL-54** | **Suit-Cam Cost and Look Tuning** | TASK-27 (2026-10-15) | The GTX 950M cost is not measured: the only FPS figures are headless campaign readings (32 to 60 per beat), not a per-pass cost. Grain, chromatic aberration, halation and barrel values are first-pass; Auto against Off at stage 5 on High averages 4.9 of 255. Tune on the laptop. |
| **POL-55** | **Stage 4 Suit-Cam Mix Forced to 1** | TASK-27 (2026-10-15), closed 2026-10-15 | Fixed by the coordinator's ruling: the player's setting wins. Off is off at every stage; Full is on at every stage; Auto is on at stages 4 to 6 by the Lx ramp, on the GPU tiers that can afford it (Medium up). The forcing is removed. |
| **POL-56** | **Auto Is Off on Low, the Laptop's Tier** | TASK-27 (2026-10-15) | Per the ruling, Auto is on only on the tiers that can afford it (Medium, High, Ultra). The minimum-spec laptop on Low gets no suit cam under Auto; Full turns it on there at a cost not yet measured. Opus to confirm the tier line. |
| **POL-57** | **Dr. Haddy lines that are not in the approved script** | TASK-26 (2026-10-15) | The 0% recall line ("Pulled your buffer back before the static ate you. Stay near the relay line or drop a pylon.") and the power-shortage line ("There goes the Gate's twelve-kilowatt breaker. Drop a Power Unit on the line before the plumes stall out.") are Argo's text. They show as subtitles only (radio header, never voiced). Owner: approve, cut or rewrite, then generate voice if approved. | Owner review. |
| **POL-58** | **Brownout floor** | TASK-26 (2026-10-15) | Argo's v1 clamped the satisfaction at 25%. The plotsim package (`@hm/plotsim`) runs machines in proportion with no floor, and TASK-26 keeps it. Owner to decide whether the floor is wanted. | Ruled (Opus, 15 October): keep the proportional brownout. It is honest, never reaches zero (no soft-lock), and the amber readout teaches the fix. Argo's 25% floor is the fallback if playtests find it punishing. |
| **POL-59** | **Pylon pulse beads: new visual and tuned speed** | TASK-26 (2026-10-15) | No pulse beads existed before. They ride each relay span (3 per span, one instanced draw) at 2.4 m/s at full satisfaction, stopping at 0%. Needs a look check at Low and on the lab shots. | Look check. |
| **POL-60** | **Dome edge: ripple only, not a ground band** | TASK-26 (2026-10-15) | The edge is one amber ring at the point the player crosses. The brief allows a faint ripple, so no shader band on the ground yet. | Later polish. |
| **POL-61** | **Stage 0 drain at 90 s and the machine rule** | TASK-26 (2026-10-15) | Stage 0 drain goes from 60 s to 90 s (brief). The brief says "keep today's rule that a running machine slows the drain"; the code's rule is the stage 1+ recovery near a running machine, kept unchanged (Argo sign-off). Opus to confirm that reading. | Confirmed (Opus, 15 October). |
| **POL-62** | **Salvage ore goes to the plot, not the pack** | TASK-26 (2026-10-15) | Lab salvage ore now feeds the plot's ore (the stock the boulders, the beam and a drill share), so no player stalls for ore. Primitives still go to the pack. This changes the TASK-23c rule. Opus to confirm. | Confirmed (Opus, 15 October): it supersedes the TASK-23c rule. |
| **POL-63** | **The red foundation: root cause not confirmed** | TASK-26 (2026-10-15) | The basekit slab is grey concrete (0x8d8a84), so the red in tour shot 10 was not the slab's own colour. The likely cause is the integrity tint (T overlay) or the stage 0 look. The gunmetal frame replaces the slab, so the red is gone either way; the shots show it. | The campaign shot 57 (stage 6) shows no red: the frame reads gunmetal with hazard rims. The cause (the integrity tint or the stage look) is still not isolated. Stage 1 and flat-ground shots are still owed. | Partly done; shots owed. |

---

## 2. Lab & UI Polish

| ID | Item | Source / Context | Action Required | Owner / Status |
|---|---|---|---|---|
| **POL-07** | **Amber Hologram Planet Table** | Sheet 07 / Lab Spec | 3D holographic projection table in the lab displaying an amber volumetric wireframe/relief of the player's active 1 km plot and machine spires. | Handed to sidecar. |
| **POL-08** | **Build Menu HUD Overlap** | Claude Opus report (2026-10-07) | When the machine build menu (`B`) is open, its top elements can visually overlap the persistent top resource/level HUD bar. | **Done in TASK-08** (Sidecar, 2026-10-08): tuned `.play-build` max-height to `min(65vh, calc(100vh - 170px))` with `z-index: 4`. |
| **POL-09** | **Gate Power-On & Sync Loss Tutorial** | Owner (2026-10-07) | Starting lab gate begins powered off. Pulling lever (E) engages power with a black-and-white dither glitch. Staying too long causes sync loss before first machine stabilizes reality. | Planned in Quest Engine. |
| **POL-10** | **Lab Cartridge Research Stations** | Sheet 07 / Lab Spec | Preset workbench, preset combiner, and storage rack for researching and fusing procedural cartridges in the lab. | Lab UI integration pass. |
| **POL-64** | **Menu hero vista and glass blade (P1-UI-04)** | TASK-28 (2026-10-15), brief 28 §5 | The main menu already shows the live lab behind it (`lab/lab.tsx`, the gate open). Not built: the gate on the right showing the stage-4 hero vista (OWNER_ASKS 2026-10-06), the window glitching with the vista in that backdrop, and the glass blade behind the menu buttons. Needs a stage-4 hero render (or an approved still) and a frame-budget check on Low. | Not started. Opus or Argo to choose the hero source. |
| **POL-65** | **Capacitor bus bars and the wall's order (P0-LAYOUT-02)** | TASK-28 (2026-10-15), brief 28 §4 | Not built: square copper bus bars mounted on the capacitor bank (each its own object), and the power wall's left-to-right order as sheet 07 shows it. The bars need the generated bank's face coordinates; the order is a layout change. Argo's `power-wall-and-clutter-staging.ts` (`buildPowerWallBusBarsAndBeacons`) is not landed. | Not started. |
| **POL-66** | **Machine emissives on power-on (metric colours)** | TASK-28 (2026-10-15), brief 28 §2 | Not built: the preset bench (#ff3d8a), the combiner (#b46bff) and the fabricator (#7cff4d) do not light with the power. Needs their lamp positions on the generated models (not known from the code). | Not started. |
| **POL-67** | **Gate ignition sound: the rising capacitor-charge pitch** | TASK-28 (2026-10-15), brief 28 §3 | The ignition uses the existing spool (`playGateSpool`) and `coil-charge` / `gate-open` SFX; no rising pitch and no amber arc sound yet. Belongs to TASK-29's procedural set. | Wait for TASK-29. |
| **POL-68** | **Ribbed steel floor covers (P0-LAYOUT-02)** | TASK-28 (2026-10-15), brief 28 §4 | The power cables run on the existing `floorCover` pieces; not checked whether they read as ribbed steel per sheet 07. | Check against sheet 07. |
| **POL-69** | **Relay beacons as housings** | TASK-28 (2026-10-15), brief 28 §4 | The relay cabinets' amber beacons are the existing relay lamps, recoloured to #ffc13d and pulsing while lit. They are not separate rotating beacon housings. | Decide whether the housings are wanted. |
| **POL-70** | **Table hologram is a plate** | TASK-28 (2026-10-15), brief 28 §2 | The planet table's hologram is a translucent cyan plate on the table top that comes up after the banks. Argo's `planet-table-hologram.ts` (P1-LORE-05: the 11-enclave consensus hologram) is not landed: it carries lore content and imports a file that is not in the tree. | Opus and Argo decide the hologram's content. |
| **POL-71** | **Legacy loading labels on the menu** | TASK-28 (2026-10-15), brief 28 §5 | The menu's lab loader now reads "Loading the lab models" and "Calibrating the bridge array". "Waking the goblin" and "Waking the animals" are still there (older names). | Opus to confirm the wording. |
| **POL-72** | **No autoplay at the menu (TASK-28 sign-off)** | TASK-28 (2026-10-15), Argo's sign-off of 14 October | Argo asked that the world-SFX and ambience buses sit at zero gain until the player clicks a menu control or enters the lab. Checked by grep: no AudioContext and no game-audio call in `apps/web/src/shell` or `apps/web/src/lab`, so nothing autoplays at the menu today; the gating comes with TASK-29's buses. | Wire with TASK-29's buses. |
| **POL-73** | **Heavy pads have no on/off switch** | TICKET-03 (2026-10-17), BB-10 | The machine inspector shows no Turn Off on a base pad (mill, press, fabricator, projector, water): there is no world command that switches a pad machine, and the brief said not to invent one. Plot machines keep their switch. Needs a `switch` command in `base/world.ts` and an `on` flag on `Machine`, then the toggle comes back in `machine-inspect.ts`. | Opus decision. |
| **POL-74** | **Plot-machine inspector not browser-tested** | TICKET-03 (2026-10-17) | `scripts/test-machine-inspector.mjs` covers the base pads, the refinery, the fabricator, Esc, Tab and the bench. The planet plot-machine path (E on a plot machine, Switch on/off, Cartridge and removal) is covered by the unit test of `inspectMachine` only. | Add a browser step once a plot machine can be placed from the test. |
| **POL-75** | **Plume emitters on the scaled machines** | TICKET-03 (2026-10-17), BB-09 | `machineProp` now scales each machine to its table height and scales its vent socket with it. `play-scene.ts` still places the plume emitters from `prop.vent`, so they follow the scale, but no shot has looked at a running machine's plume against its new height. | Look at a running mill and projector in a shot. |
| **POL-76** | **Unused generator prop builder** | TICKET-03 (2026-10-17) | `createGenMachineProp` in `assets/gen-props.ts` builds its generated branch without the table-height scale (its fallback does get it). Nothing calls it today. | Scale it the same way, or delete it. |
| **POL-77** | **Inspector hopper reads the whole network against a cap of 100** | TICKET-03 (2026-10-17), seen in `shots-run/inspector/inspector-mill.png` | `findStationFeedHopper` in `machine-inspect.ts` counts the ore of the whole network and divides by a fixed cap of 100, so the bar reads "Regolith Ore: 4835 / 100" with a full bar. Use the real cap for the hopper, or show the network stock as a number with no bar. | Opus decision on the cap. |
| **POL-78** | **Pause panel cuts off the controls grid at 720 px** | TICKET-04 (2026-10-17), shots-run/build-ux/esc-controls.png | The Esc screen now shows the 20-row keycap grid (ControlsGrid). At 1280 x 720 the shot shows only the first nine rows; the rest sit under the Resume and Sync buttons. Not checked for scrolling. | Make the controls section scroll inside the panel, or lay the grid out in three columns at this width. |
| **POL-79** | **Radial slice labels truncate** | TICKET-04 (2026-10-17), shots-run/build-ux/radial-build.png | The build radial shows "Weapon ben..." for Weapon bench: the slice label is capped at 80 px in radial-menu.css. | Wrap the label to two lines, or widen the slice. |
| **POL-80** | **Apply radial with an empty rack looks like filler** | TICKET-04 (2026-10-17) | With no written cartridge in Apply, the wheel shows two locked placeholders ("Rack empty", "Free slot") to stay round. | Give the empty port its own state: an icon and one line on where to write a cartridge. |
| **POL-81** | **3D thumbnails render on first open, not measured on the laptop** | TICKET-04 (2026-10-17) | Each thumbnail draws once, on first use, one at a time (studio-thumbs). The hotbar and inventory fill in a moment after a fresh boot, and the first build radial waits for its kinds. Not measured on the GTX 950M in Low. | Measure first-open cost in Low on the 3D PC; preload the blueprint kinds behind the loading bar if it hitches. |

---

## 3. Character & Avatar Pipeline

| ID | Item | Source / Context | Action Required | Owner / Status |
|---|---|---|---|---|
| **POL-11** | **Scientist Sole Default Avatar** | Owner (2026-10-07 20:56) | Hazmat Scientist is the ONLY default starting choice (customizable name + visor tint). | **Done**: Wired into avatar system and initial flow. |
| **POL-12** | **Universal 3D Avatar Drag & Drop** | Optimization Spec §4 | Allow dragging any `.glb` or `.vrm` into the Avatar Dock; auto-retarget Mixamo/VRM humanoid bones to `@hm/anim` locomotion; persist in IndexedDB. | In avatar dock. |
| **POL-18** | **Scientist Asset Stored Twice** | Claude Opus review (2026-10-08) | `apps/web/src/avatar/scientist/` holds `scientist.fbx` and duplicate base64 string in `scientist-asset.ts`. Import .fbx with Vite `?url` and delete generated .ts. | **Done in TASK-07** (Sidecar, 2026-10-08). |
| **POL-19** | **Hologram Reads Weak** | Claude Opus review (2026-10-08) | Projection disc is flat saturated orange that outshines pale relief above it. Dim disc to glow and give relief stronger contour lines and lit rim. | **Done in TASK-08** (Sidecar, 2026-10-08): dimmed table disc to soft glow; relief shaded with contour lines and luminous boundary ring. |
| **POL-20** | **Oak Crown Envelope Spreading** | Claude Opus review (2026-10-08) | The oak in `@hm/treegen` could spread wider so it reads as a spreading oak next to pine and birch. | **Done in TASK-08** (Sidecar, 2026-10-08): widened oak crown envelope radius (`crownR: 0.48`). |
| **POL-21** | **scenedoc Edits Copy the Whole Document** | Claude Opus review (2026-10-08) | One edit on a 10,000-node document copies the whole node record. In a big Studio scene a slider drag would cost a frame per change. Use persistent map or per-transaction drafts with structural sharing. | Before Studio scenes expand. |
| **POL-22** | **The Lab Below 60 fps on Low with the Scientist** | Sidecar TASK-07 report | Give the scientist a Low level of detail mesh with fewer influences, skip entirely in first person unless shadow is drawn. | Polish pass. |
| **POL-13** | **Running-Game Auto-Detector** | Optimization Spec §3 | Local bridge daemon scans OS process table (`UnrealEditor.exe`, `javaw.exe`, `Godot.exe`); displays green "Connected" status pill in UI. | Companion daemon integration. |

---

## 4. Universe & Long-Term Progression

| ID | Item | Source / Context | Action Required | Owner / Status |
|---|---|---|---|---|
| **POL-14** | **Inter-Planetary Spaceflight & Galactic Traversal** | Long-Term Vision | Player constructs spaceship blueprint with physics presets to fly out of lunar orbit to other celestial bodies in the SetMix Multiverse. | Multiverse Milestone. |
| **POL-16** | **Shared Planet Grid & Gate Dialing** | Planetary Grid Spec | Expanding 1 km plot grid; dial friend gates to visit neighbor plots seamlessly. | Networking phase. |

---

## 5. Handoff Protocol for Sidecar Agent
When Claude Opus identifies a micro-polish or tuning item that would distract from architectural progress:
1. Append the item to this document under the appropriate category.
2. In the user update, provide a single-line handoff snippet:
   `"Sidecar Task: [Item ID] - [Brief Instruction]"`
3. The Antigravity Sidecar agent will immediately implement the fix, run typechecks/tests, and push to main.

### POL-82: refused actions show as a giant title card
- **Seen:** `shots-run/build-ux/radial-build.png` (2026-10-17, T04 review by Opus). The text "Action refused: same-stage" covers the middle of the screen in title-card type.
- **Expected:** a refused world action (`refused` event) is a small toast in the HUD style, never a headline. Raw reason ids such as `same-stage` get a player-facing sentence.
- Sidecar Task: POL-82 - route `refused` events to the toast channel with friendly reasons.

### POL-83: a bare `.play` rule in play.css catches other screens' buttons
- **Seen:** TICKET-08a (2026-10-17), the Studio's Audio tab. `apps/web/src/play/play.css` sets `.play { position: absolute; inset: 0; overflow: hidden }`, so any element with class `play` outside the play screen covers the whole viewport: the audio tab's Play buttons did. They are now `is-play` and `is-stop` in the audio tab, which fixes that screen only.
- **Expected:** the play screen's rule is scoped to its own root, so no other screen picks it up.
- Sidecar Task: POL-83 - scope `.play` in `play.css` to the play screen's root; then re-run the campaign and the e2e checks.

### POL-84: every player's Planetary Grid slot reads UNCLAIMED
- **Seen:** TICKET-08a. `resolveSlots` (`crafter/shared-planet.ts`) has no caller, so no slot is ever stored and the grid's slot readout always says UNCLAIMED.
- **Expected:** a slot is claimed when a plot publishes, and the grid shows `SECTOR #n` with its metres from the origin crater.
- Owner: Networking phase (POL-16). Sidecar Task: POL-84 - store the claimed slot when a plot publishes; pass it to `PlanetaryGridScreen` as `slot`.

### POL-85: the play screen's sync toggle does not change the remembered mode
- **Seen:** TICKET-08a. The Grid screen remembers the sync mode in `hm.setmix.play.sync`, which only the main menu writes. The play screen's own Sync/Desync button (`play.tsx`) changes its internal state only.
- **Expected:** one remembered mode: the play screen's toggle writes the same key.
- Sidecar Task: POL-85 - write `hm.setmix.play.sync` from the play screen's toggle.

### POL-86: Studio audio-level edits are not saved
- **Seen:** TICKET-08a. The Audio tab edits `public/audio/levels.json` in memory only: there is no dev write route for it (the dev route writes asset tweaks). The tab offers Copy JSON instead.
- **Expected:** in the dev build, edits save the way asset changes do.
- Sidecar Task: POL-86 - add a dev write route for `public/audio/levels.json` beside `/__studio/data/asset-tweaks`, and wire the tab's `onChange` to it.

### POL-87: two screens embed their CSS as a string
- **Seen:** TICKET-08a. `planetary-grid.tsx` and `audio-tab.tsx` carry their stylesheet inside the module (their unit tests import the module, and Node cannot load CSS). Their `.css` files are the source, so every edit to one means regenerating the string in the other.
- **Expected:** the stylesheet is imported as a file, and the tests import only the pure helpers from a module without CSS.
- Sidecar Task: POL-87 - move the pure helpers to their own module and import the `.css` files directly, as the rest of the shell does.

### POL-88: the Scene tab's Save has no project route
- **Seen:** TICKET-08b. `apps/web/studio-server/write-back.ts` allows only `asset-tweaks`, so Scene layouts persist per browser (kv `studio.scene-layouts`) and reach the project only through Copy JSON.
- **Expected:** in the dev server, Save writes `scene-layouts` to the project the way Assets does.
- Sidecar Task: POL-88 - add `scene-layouts` to the write-back allowlist, with a schema check, and point the Scene tab's Save at it when the route is writable.

### POL-89: machines have no sockets in the registry
- **Seen:** TICKET-08b. The packed registry carries no sockets, so the gizmo shows socket markers only on the three rover bodies (taken from `VEHICLE_FIT`); machines show only their plume vents.
- **Expected:** every asset with hardpoints shows its socket markers.
- Sidecar Task: POL-89 - have the registry generator write sockets for machines and structures, and drop the rover special case.

### POL-90: Scene edits aren't on the undo stack
- **Seen:** TICKET-08b. Assets edits undo; Scene transform edits and gizmo drags don't.
- Sidecar Task: POL-90 - put Scene transform edits on the Studio's undo stack.

### POL-91: one throw unmounts the whole Studio
- **Seen:** TICKET-08b. A throw inside a workspace (the Look tab's texture size, before the fix) took down the entire Studio.
- Sidecar Task: POL-91 - wrap each Studio workspace in an error boundary that shows the error and keeps the other tabs alive.

### POL-92: two offscreen renderers in the Studio
- **Seen:** TICKET-08b. `four-angle.ts` and `studio-thumbs.ts` each make their own offscreen WebGL renderer; on the GTX 950M every extra context costs memory.
- Sidecar Task: POL-92 - share one offscreen renderer between them.

### POL-93: the Studio tabs' CSS lives twice
- **Seen:** TICKET-08b. `look-tab.css` and `scene-tab.css` aren't imported; the same rules are embedded as strings in the `.tsx` files (as in POL-87).
- Sidecar Task: POL-93 - fold into POL-87: one style source per screen.

### POL-94: the gizmo drag isn't tested
- **Seen:** TICKET-08b. `test-studio-tabs.mjs` covers the number inputs, not the pointer drag on the gizmo.
- Sidecar Task: POL-94 - automate a gizmo drag on a placed copy and check its transform changes.

### POL-95: the Look tab's stage-6 readout and green (Argo's review)
- **Seen:** TICKET-08b. The readout says "Levels 0" at stage 6, and the stage-6 ground is a very saturated, ridged green. Both are Argo's values.
- **Expected:** Argo confirms or retunes them against plan 27 (the stage look bible).
- Sidecar Task: POL-95 - Argo's call; then a sidecar applies it.

### POL-96: the armory's sidearm stays on the rack after it is taken
- **Seen:** TICKET-07a. E at the armory rail takes the Combat Shotgun into the sidearm slot, but the rack's model is still drawn on the rail. Nothing reaches the lab room from the play screen, so it cannot be hidden.
- **Expected:** once taken, the sidearm is gone from the rack (on every visit, from the save).
- Sidecar Task: POL-96 - in T07b, `play-scene.ts` passes the lab room's armory through (`room.armory.setTaken(...)`, the same route as `dissolveClutter`), and `play.tsx` calls it from `takeSidearm`.

### POL-97: wreck trucks cannot be salvaged or read yet
- **Seen:** TICKET-07a. `wrecks.ts` now tilts and buries the trucks (`settleWreck`), and `aimProp` returns a truck's id. The planet's read prompt is hidden for a wreck with no log (`aimedPropActs` in `play.tsx`), so the trucks have no interaction.
- **Expected:** hold E on a truck salvages it (its items to the pack, then the network) and opens its Bridge Incident Log; the truck disappears.
- Sidecar Task: POL-97 - in T07b, `play-scene.ts` reports the aimed wreck's salvage and log (`wrecks.aimWreck`, not `aimProp`) and exposes `salvageWreck(id)` (`wrecks.salvageWreck`); `play.tsx` runs the hold-E path from `clearProp` and sets the `aimedProp` salvage flag from it.

### POL-98: a full-detail rift costs about 60 draw calls
- **Seen:** TICKET-07a. The old leak marker was 3 draw calls. The S-Space rift (`rift.ts`: 14 slabs of 3 meshes, 10 scanlines, collar, scar) is about 59 when near. The DRAWS telemetry went from 83 to 144 with one leak at 12 m. `leak-visual.ts` draws the tear only within 40 m (RIFT_DETAIL_DISTANCE), which keeps the base-building check under 80.
- **Expected:** the rift looks the same at a lower cost: merged slabs (one mesh per row with vertex colours), or fewer slabs at range.
- Sidecar Task: POL-98 - measure the rift on the GTX 950M, then merge its geometry or cut its slab count, and tune RIFT_DETAIL_DISTANCE against the look.

### POL-99: armory and rift shots need close-up frames with the HUD hidden
- **Seen:** TICKET-07a. `shots-run/ticket07a-armory-rail.png` and `ticket07a-rift-open.png` are framed by the HUD and the toast; at stage 0's 1-bit look the rift and the sidearm holster are hard to read.
- **Expected:** a clean close-up of the holster and of the rift (open and sealing) for review.
- Sidecar Task: POL-99 - add `?cleanShot=1` close-ups of the armory rail and of a near leak (open and sealing) to the ticket test, and save them beside the others.

### POL-100: the rift at stage 0 reads as white circle outlines (Argo's call)
- **Seen:** TICKET-07a (`shots-run/ticket07a-rift-open.png`). Under the stage 0a wireframe look, the open rift at 12 m draws as two or three white pixel circle outlines, not a vertical glitch-sliced tear.
- **Expected:** the tear reads at every stage. One option: S-Space ignores the stage look (it's foreign data bleeding through), drawn in its own vivid palette.
- Sidecar Task: POL-100 - Argo decides the rift's look per stage; then fold it into POL-98's rift rework (merged geometry, a few draw calls).

### POL-111: plot-ground.ts should take its terrain constants from base/plot-height.ts
- **Seen:** plan 36 Phase 1 (co-op). `apps/web/src/base/plot-height.ts` copies `BOULDER_SPAN`, `PAINT_CELLS` and the paint origin from `play/plot-ground.ts`, so the room and the clients can build on the same ground. The two copies can drift.
- **Expected:** one source. `plot-ground.ts` imports the constants from `plot-height.ts` (or both import one module).
- Sidecar Task: POL-111 - after F-09 lands (plot-ground.ts is Flash's work in progress), import the three constants in plot-ground.ts from base/plot-height.ts, and keep plot-height.test.ts green.

### POL-112: the gate's footing pad is not in the room's ground
- **Seen:** plan 36 Phase 1. `play-scene.ts` `groundAt` returns `padTop` (the gate's height plus 0.25 m) inside |x| < 1.9, |z| < 1.25 of the Moon Twin Gate. `plotHeightAt` has no pad, so a piece standing on the pad could be accepted by one side and refused by the other (the world hashes would part).
- **Expected:** `plotHeightAt` returns the same height as `scene.heightAt` on the pad too (check the gate's yaw first).
- Sidecar Task: POL-112 - add the pad to plotHeightAt and sample the pad points in test-coop-outpost.mjs once the browser check reaches the play screen.

### POL-113: a guest's live ground does not load the host's sculpt yet (play-scene.ts)
- **Seen:** plan 36 Phase 1. The room sends the terrain to every guest, and the guest's predicted world uses it (plotHeightAt), so the hashes agree. But the guest's ground mesh is built from the guest's own beam save: `PlayScene` takes `beamField` only when it is created (`createPlayScene`), and exposes no way to import a field into a live ground. This needs a `play-scene.ts` change (Flash's file), so it is not in this ticket.
- **Expected:** a guest walks on the host's sculpted ground, and leaving the room puts their own ground back.
- Sidecar Task: POL-113 - add `importBeamField(text)` to `PlayScene` (it calls the ground's `importField`, the same path as `beamField` at creation, plot-ground.ts line 541), then have play.tsx call it from the room's terrain (`client.onTerrain`) and on leave.

### POL-114: the room's shared stock, and the ticks sent through the room
- **Seen:** plan 36 Phase 1. The room owns one BaseWorld, so its `player` grid (the stock) is shared: a co-builder spends the Lead Architect's ore. Every machine tick (`t: 'tick'`, about 10 a second while mining or running machines) also goes through the room and is broadcast to everyone.
- **Expected:** a decision from the owner and Argo on whose stock co-builders spend (a shared stock or a stock per player), and the ticks run on the room only for what must agree (or on the host alone).
- Sidecar Task: POL-114 - Phase 2 design call (Argo, then Opus): per-player stock or a shared bridge store; move the machine tick server-side or make it the Lead Architect's job.

### POL-115: a new room can take builds before the host's play has seeded it
- **Seen:** plan 36 Phase 1. A host can open a room from the Planetary Grid, and the room then answers a friend's builds on the default base. The host's own base is sent only when the host's play screen mounts (`seedWorld`, which the room takes only while it has no commands).
- **Expected:** a new room waits for its host's base (the room refuses builds until the host has seeded it, or the grid only hosts from play).
- Sidecar Task: POL-115 - in OutpostRoom, hold commands from non-owners until `version > 0` (or the grid's Host opens play first).

### POL-116: the browser check needs the RUN realtime in a plain browser
- **Seen:** plan 36 Phase 1. `scripts/test-coop-outpost.mjs` starts `vite --mode run` (the plugin's room server on port 9001) and drives two pages through `window.__outpost`. On the 3D PC it passes 12 of 12: a room code, a join by code, 8 builds each, the roster on both grids, and the same world hash at version 19. What it does not cover: the play screen's ground (the 50-point heightAt sample) and a RUN host.
- **Expected:** the play screen joins the room in the same check (the sampled heights match scene.heightAt), and the owner's RUN host (a private deploy, which the owner decides) confirms the same on RUN.
- Sidecar Task: POL-116 - run the check on the 3D PC and record what the SDK says; the node convergence test stays the acceptance until then.

### POL-117: the roster shows names only for players who send poses
- **Seen:** plan 36 Phase 1. A roster name comes from presence (a player's pose), so a friend who has not moved shows as "Friend". The room now broadcasts each join with its role, so the roster lists everyone, but without a name.
- **Expected:** the join carries the player's name (the RUN `onPlayerJoined` callback has it), shown until the pose arrives.
- Sidecar Task: POL-117 - pass the username from the room's join notice into `rosterOf` (outpost-session.ts), with the Phase 2 role UI.

### POL-101: the EGA pocket is cyan (Argo's call), not the spec's magenta
- **Seen:** TICKET-06 install. Argo's `lab-vista-math.ts` changes the EGA pocket's tint, sky and rim to cyan. The review-2 spec (SIDECAR_COMMS, V2) and `docs/WINDOW_SCENE_PLAN.md` say magenta. The test `the rim of each pocket is its own colour` now asserts cyan.
- **Expected:** Argo confirms cyan, or restores magenta (the EGA entry and that test line go back).
- Sidecar Task: POL-101 - Argo decides the EGA pocket colour; Opus makes the test match the decision.

### POL-102: a few mauve blocks read as pink at storm 0.5 (Lite and Full)
- **Seen:** `docs/shots/ticket06/window-lite-storm-0.5.png` and `window-full-storm-0.5.png`. Some structures render pale mauve or salmon (sampled RGB about (181,148,171) and (115,84,97)), not magenta. Storm 0 and storm 1 are clean. The LAB-04 slate path in `lab-vista.ts` does not catch them.
- **Expected:** no pink or purple cubes at any storm progress (the TICKET-06 check).
- Sidecar Task: POL-102 - find the material or the dusk tint that makes the mauve, clamp it in the shader, and check the three window views at storm 0, 0.5 and 1.

### POL-103: the east wall's grey box is a featureless placeholder
- **Seen:** `docs/shots/ticket06/right-wall-machines.png`. A plain grey block stands between the Hardware Fabricator and the armory rail (x 7.2 to 7.9, z -0.6 to 0.1, 1.3 m tall). It is grounded (its lowest point is y = 0), but it is a generated `low` model with no detail.
- **Expected:** a believable piece of kit, per the sheet 07 design.
- Sidecar Task: POL-103 - Argo names the piece; the generator batch (or a labkit piece) replaces the box.

### POL-104: the lab's remaining draw calls after the TICKET-06 budget pass
- **Seen:** the lab draws 172 calls at HEAD and 180 now (the 3D PC, Low, the gate view). Still unmerged: the generated model parts (about 56 meshes in `Scene` groups), the T07a armory rack and sidearm (11 meshes; the sidearm must stay separate for the pickup), and the operator console's parts.
- **Expected:** the lab stays within +10% of HEAD as the generated models come in.
- Sidecar Task: POL-104 - merge the static parts of the generated lab models at load with `mergeStaticMeshes` (keep the lever, the lamps and the sidearm separate).

### POL-105: the lab's merged static geometry is not freed on dispose
- **Seen:** TICKET-06. `mergeStaticMeshes` (lab-machines.ts) builds new merged geometry for the shell, the station dressing, the cable drops and the gate housings. The room's `keep` list does not hold it, so the room's `dispose()` leaves it for the garbage collector to miss.
- **Expected:** `dispose()` frees every geometry the room made.
- Sidecar Task: POL-105 - have `mergeStaticMeshes` return the geometry, and register it with the room's `keep` in `lab-room.ts`.

### POL-121: the console's throw lever moves only 0.25 rad
- **Seen:** T06b (b60aee2f). The generated console's guide is a short H-slot (0.18 m), so the lever's full throw (play-scene sends −1.1 rad) would put the grip through the hood. `lab-room.ts` maps the throw to 0.25 rad from a 0.15 rad rest tilt.
- **Expected:** a big, readable throw. The player pulls the lever that wakes the lab.
- Sidecar Task: POL-121 - re-image `operator-console` with a long arc slot (or a raised quadrant guide) on the deck's right, re-run the model batch, and widen the throw to about 1 rad.
