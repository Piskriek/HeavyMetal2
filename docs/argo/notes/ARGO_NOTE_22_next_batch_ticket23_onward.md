ARGO_NOTE_22 — Master Plan for TICKET-23 to TICKET-28: Final Polish Sweep, 47-Tile Autotiling, Shared Planetary Grid & Gate Dialing, Running-Game Bridge, and Orbital Multiverse Flight
Author: Gemini Argo (Creative Lead & PM)
To: Claude Opus (Lead Engineer & Architect) & Francois (Owner)
Date: 19 October 2026
Companion Install Guide: ARGO_NOTE_21_install_guide_tickets_19_18_21_22
Single-File Headroom Baseline: 13.67 MiB after T17a (~13.72 MiB after staging TICKET-18..22), leaving ~2.28 MiB (~2,334 KB) of free budget below the 16.00 MiB gate.
1. Executive Summary & Research-First Foundations for Post-TICKET-22 Features
Once TICKET-18 through TICKET-22 are staged tomorrow afternoon, the entire 9-Act campaign, the 144 BPM ending credits video, the 5-bus audio engine, the heavy terraformers and perimeter turret, co-op Phase 2, universal .glb/.vrm avatar retargeting, and POL-49 yaw-turn stability are in place. Everything that remains across our master plan (ACTIVE_ROADMAP.md), the open entries in DEFERRED_POLISH_REGISTRY.md, and the owner’s canonical directives in OWNER_ASKS.md falls into two tracks:
* Track 1 — Golden Master Closure of Every Remaining Open POL-* Item (TICKET-23, TICKET-24, TICKET-25): Closes all remaining visual, HUD, machine-inspector, rover-modelling, and E2E verification items (POL-01, POL-05, POL-25, POL-26, POL-33, POL-36, POL-39, POL-41, POL-42, POL-47, POL-50, POL-52..54, POL-56, POL-59, POL-60, POL-63, POL-64, POL-67, POL-71, POL-73..77, POL-81, POL-83..85, POL-281, POL-282).
* Track 2 — The Four Expansion Pillars from OWNER_ASKS.md & DEFERRED_POLISH_REGISTRY.md §4 (TICKET-26, TICKET-27, TICKET-28):
   1. Shared Planetary Grid Sector Claims & Stargate-Style Friend Gate Dialing (POL-16, POL-84, POL-85)
   2. Junked-Model Containment Leak Restoration Ladder (RUN.world + Meshy.ai Max Tier, OWNER_ASKS 2026-10-12 & POL-23)
   3. Running-Game Auto-Detector & Live Cross-Game Asset Bridge (POL-13, OWNER_ASKS 2026-10-07)
   4. Inter-Planetary Spaceflight & Orbital Multiverse Traversal to Planet Forge Worlds (POL-14, OWNER_ASKS 2026-10-06/09)
Research-First Summary & Cited Sources for New Features (SOP §3.4)
1. 47-Tile Wang/Blob Autotiling for Terrain Transitions (POL-05, TICKET-25):
   * A full 8-neighbour Moore neighbourhood has  bitmask states, but diagonal corner bits only matter when both adjacent cardinal neighbours are present (N & E for NE, etc.). Masking out invalid diagonal bits collapses the 256 states into the canonical 47-tile Blob subset (1 isolated, 4 end-caps, 6 straight corridors, 16 T/corner/cross junctions, and 20 inner-corner combinations) (BorisTheBrave: Blob Tileset Mathematics; Autotile Explained: Why 47 Tiles and the Blob Rule).
   * Size & GPU Win: Instead of shipping 47 bitmap textures per material, a 256-entry Uint8Array lookup table maps any 8-bit neighbour mask to one of 47 procedural SDF sub-tile masks (or a compact  procedural atlas baked at startup in @hm/groundshader), costing 0 KB of image assets and ~2.5 KB of TypeScript (47-Tile Bitmask Autotile Guide; Excalibur.js Autotiling Technique).
   2. Shared Planetary Grid Sector Claims & Friend Gate Dialing (POL-16, POL-84, TICKET-26):
   * Inspired by No Man’s Sky’s 12-glyph Portal coordinates and Stargate chevron dialing (No Man’s Sky Portal Coordinate System; Portal Repository Coordinate Catalog), players praise systems where every plot has a human-readable, deterministic sector address (SECTOR #04 // 1.4 km NE + 6-character Gate Code) that can be dialed directly at the Operator Console keypad or Planet Table hologram.
   * When dialed, the Lab or Moon Twin Gate portal shader transitions through an amber chevron lock into the friend’s live OutpostRoom (or loads their published snapshot in asynchronous visitor mode if offline).
   3. Running-Game Auto-Detector & Localhost Companion Bridge (POL-13, TICKET-27):
   * Browsers sandbox OS process tables (`ps` / `tasklist`), so industry web-to-desktop bridges (such as Home Assistant System Bridge, Foxglove ROSBridge, and local dev servers) use a lightweight local loopback HTTP/WebSocket beacon on `127.0.0.1` (System Bridge Localhost WebSocket Architecture; Foxglove ROSBridge WebSocket Protocol).
   * We can expose a `GET /__studio/bridge/running-games` route in `apps/web/studio-server/write-back.ts` (plus a standalone 60-line Node script `scripts/bridge-daemon.mjs` for `PLAY.bat`) that polls running processes (`UnrealEditor.exe`, `Unity.exe`, `Godot.exe`, `javaw.exe`, `blender.exe`, `hl2.exe`) and watched asset folders, lighting a green [BRIDGE: CONNECTED] pill in the HUD and auto-populating live cross-game `.smx` cartridges at 0 KB external library cost.
   4. Seamless Orbital Launch & Multiverse Planet-to-Planet Flight (POL-14, TICKET-28):
   * Players consistently cite Outer Wilds and No Man’s Sky’s continuous ground-to-orbit pitch-up transition as the most magical moment in space sandboxes (Player Analysis: Seamless Ground-to-Space Transitions).
   * Rather than loading a separate heavy space engine, as the player’s fabricated Shuttle / Orbital Lander climbs past `y = 180 m` (`altitude01 = ramp(y, 120, 420)`), we cross-fade the chunked `PlotGround` into the existing 3D spherical `PlanetForge` celestial globe (`@hm/sky` + atmosphere rim shader), render the neighboring `SMX-PLN-XXXX` published worlds as navigable orbital bodies in the starfield, and descend onto the chosen planet’s seed/mantle on approach—all in ~18 KB of pure TypeScript using meshes and shaders already in the build!
2. Master Ticket Table: TICKET-23 to TICKET-28 (Ranked Priority Order)
Ticket ID & Priority
	Open Polish (POL-*) & Owner Asks Covered
	Target Repo Files
	play-scene.ts Single-Writer Window
	Asset Batch Needed
	Pure Modules for Arena.ai Battles / Unit Tests
	Net Build-Size Delta on dist/index.html
 
	TICKET-23
(P0 — Machine Housing LEDs, Plume Vent/Gravity Wiring, Spitter Wall Colliders & Pad Switches)
	• POL-281 & POL-282 (ARGO_NOTE_17 Rulings): Offset shape-press / heavy-press exhaust vent by x = +0.68 m (1.04 m > 1.0 m clear of input chute) and wire per-kind machinePlumeGravity in machine-props.ts.
• POL-39 (Housing Status LEDs): Mount a square emissive status LED on every field and pad machine housing (#7cff4d running, #ffc13d blinking starved/brownout, #ff2a1a switched off).
• POL-33 (Walls Block Spitter Bolts): Intersect Spitter bolt segments against planetSolids / built wall AABBs in monsters.ts / @hm/leaksim.
• POL-73, POL-76, POL-77: Add switch command to base/world.ts so base-pad machines have an On/Off toggle in machine-inspect.ts; fix inspector hopper bar to show 100 local hopper cap + (+N linked) badge; scale or remove unused createGenMachineProp.
	apps/web/src/play/machine-props.ts
apps/web/src/play/monsters.ts
apps/web/src/base/world.ts
apps/web/src/play/machine-inspect.ts
apps/web/src/assets/gen-props.ts
	NONE
(0 lines in play-scene.ts — edits live in machine-props.ts, monsters.ts, world.ts, and machine-inspect.ts)
	None. Procedural square LED meshes & socket offset in code.
	packages/plotsim/src/machine-led-and-hopper.ts: Pure status-LED state machine (running / brownout-blink / starved / switched-off), per-kind plume gravity lookup, and local-vs-linked hopper bar formatter.
	+9 KB
	TICKET-24
(P0 — Main Menu Hero Vista & Glass Blade, Low-Bit Pixel Font, Degauss Tick & Scope Cleanup)
	• POL-01 & POL-64 (Main Menu Hero Vista & Glass Blade, OWNER_ASKS 2026-10-06/07): Add frosted glass blade behind left menu buttons in goblin-front.tsx / lab.tsx; show Stage-4 lush hero vista through the right-hand Gate doorway while the background Lab window glitches over the Stage-0/1 wasteland.
• POL-41 & POL-42 (Low-Bit Font, Degauss Tick & EGA Skin-1 Bars): Embed subsetted OFL pixel font (~14 KB woff2 + CREDITS.md), trigger 40 ms degauss tick on combatUi bus on skin change, and quantize Skin-1 metric bars to the 16-colour EGA palette.
• POL-67, POL-71, POL-83, POL-85: Add rising capacitor-charge pitch + amber arc SFX on Gate ignition (POL-67); replace legacy “Waking the goblin / animals” loader strings (POL-71); scope bare .play rule in play.css (POL-83); persist hm.setmix.play.sync on HUD toggle (POL-85).
	apps/web/src/shell/goblin-front.tsx
apps/web/src/lab/lab.tsx
apps/web/src/base/ui/pixel-font.css
apps/web/src/play/play.css
apps/web/src/play/play.tsx
apps/web/src/audio/game-audio.ts
	NONE
(0 lines in play-scene.ts)
	None (14 KB subsetted OFL pixel font inline in pixel-font.css).
	packages/hudmath/src/ega-palette-and-degauss.ts: Pure 16-colour EGA hardware palette quantizer, skin-transition degauss synth envelope, and Gate capacitor-charge pitch curve.
	+22 KB
(includes 14 KB pixel font)
	TICKET-25
(P1 — 47-Tile Blob Autotile Terrain Transitions, Modular Scout Sockets, Scan Ring Fade & Full E2E Sign-Off)
	• POL-05 (47-Tile Blob Autotile Set): Replace raw 4×4 Bayer cell edges between painted/coverage terrain materials with a procedural 47-tile Wang/Blob bitmask transition table in @hm/groundshader / @hm/terrainbrush.
• POL-50 (Modular Scout & Hauler Fit): Add MODULAR_SCOUT_SOCKETS, raycast whip aerial, square [-u-] steering yoke in empty cab, and verify redone Hauler VEHICLE_FIT & Watermaker hardpoint fit.
• POL-25, POL-26, POL-52, POL-53, POL-60: Add vista flash peak hook (POL-25), soften Stage-0 dust speckle (POL-26), fade scan ring smoothly at 350 m (POL-52), tune suit-cam EV step to +0.85 EV / 0.4 s settle (POL-53), and add subtle ground band at the 25 m safe dome edge (POL-60).
• POL-36, POL-47, POL-51, POL-54, POL-56, POL-59, POL-63, POL-74, POL-75, POL-81: Automated Playwright E2E sweep covering rover crater/wall drive, plot-machine inspector, driving/fight shots, and low-spec thumbnail/suit-cam timing.
	packages/groundshader/src/blob47-autotile.ts
packages/groundshader/src/index.ts
apps/web/src/play/rover-camera.ts
apps/web/src/play/stage-look.ts
apps/web/src/play/lab-vista.ts
scripts/test-machine-inspector.mjs
scripts/test-stage-looks.mjs
	WINDOW H (Optional ~8 lines)
(Only if wiring MODULAR_SCOUT_SOCKETS aerial raycast into buildVehicleView)
	None. Procedural 47-tile SDF bitmask atlas generated at boot.
	packages/groundshader/src/blob47-autotile.ts: Pure 256-to-47 Wang/Blob bitmask reducer, corner-weight evaluator, and seamless tile UV/mask generator.
	+11 KB
	TICKET-26
(P1 — Shared Planetary Grid Sector Claims, Friend Gate Dialing & Neighbor Plot Visits: POL-16, POL-84)
	• POL-84 (Claimed Sector Slot on Publish): Wire resolveSlots (crafter/shared-planet.ts) when publishing or hosting a plot so PlanetaryGridScreen displays SECTOR #04 (1.4 km NE) instead of UNCLAIMED.
• POL-16 (Stargate-Style Friend Gate Dialing, OWNER_ASKS 2026-10-06): Let the player dial a 6-character Friend Gate Code or neighbor Sector ID at the Lab Operator Console keypad or Planet Table hologram. Locking the 6 gate coils opens a live portal to the friend’s OutpostRoom (or loads their published sector snapshot to walk around and explore).
• Neighbor Plot Rearrangement: Let friends pin/rearrange neighbor plots into adjacent 1 km sectors on their shared planetary ring.
	packages/coopnet/src/gate-dialer.ts
apps/web/src/crafter/shared-planet.ts
apps/web/src/shell/planetary-grid.tsx
apps/web/src/play/planet-table-hologram.ts
apps/web/src/play/play.tsx
	NONE
(Uses existing OutpostSession and restore / importBeamField hooks)
	None.
	packages/coopnet/src/gate-dialer.ts: Pure 6-chevron address encoder/decoder, deterministic planetary sector ring allocator (resolveSlots), and neighbor adjacency rearranged layout solver.
	+12 KB
	TICKET-27
(P2 — Running-Game Auto-Detector Daemon & Junked-Model Containment Leak Restoration Ladder: POL-13, POL-23)
	• POL-13 (Running-Game Auto-Detector, OWNER_ASKS 2026-10-07): Add GET /__studio/bridge/running-games in write-back.ts (and optional local companion helper in PLAY.bat) that detects running games/engines (UnrealEditor, Unity, Godot, Minecraft/javaw, Blender, Source/hl2), lights a green [BRIDGE: CONNECTED] pill in the HUD, and auto-populates bridged .smx cartridges.
• Junked-Model Containment Leak Restoration Ladder (OWNER_ASKS 2026-10-12 & POL-23): Extend wrecks.ts so sealing a containment leak and hitting a janky ruin with the Extraction Beam’s Apply/Restore mode steps it up the 4-rung fidelity ladder (Rung 0: Broken Junk → Rung 1: Standard Low → Rung 2: RUN.world HD → Rung 3: Meshy.ai Max Tier), plus faceted crystal clusters for POL-23 anomaly nodes.
	packages/bridgekit/src/game-detector.ts
apps/web/studio-server/write-back.ts
apps/web/src/play/wrecks.ts
apps/web/src/play/play.tsx
	NONE
(wrecks.ts already exposes sealWreck(site) and wreckRungs())
	Optional HD only: Junk/Meshy rungs live in public/hd/wrecks/ (0 KB added to inline single file).
	packages/bridgekit/src/game-detector.ts: Pure process-signature matcher, cross-game cartridge synthesizer, and 4-rung wreck restoration state machine.
	+10 KB
	TICKET-28
(P2 — Inter-Planetary Spaceflight & Multiverse Orbital Traversal: POL-14)
	• POL-14 (Spaceship Blueprint & Orbital Launch to Planet Forge Worlds, OWNER_ASKS 2026-10-06/09): Add the Orbital Shuttle / Lander tier to the Vehicle Fabricator gantry once the plot reaches Stage 6.
• Seamless Ground-to-Orbit Pitch-Up: Piloting the Shuttle above y = 180 m smoothly cross-fades the lunar plot into the 3D orbital starfield showing the player’s published Planet Forge worlds (SMX-PLN-XXXX: Ignis-IV, Verdant-Prime, Thalassa-Atoll, etc.) in orbit.
• Planetary Landing & Mantle Seed Swap: Flying into a target planet’s approach ring lands the Shuttle on that world’s procedural terrain seed and geological mantle cartridge (@hm/vault).
	packages/orbital/src/flight-and-transfer.ts
apps/web/src/play/orbital-flight-view.ts
apps/web/src/play/play-scene.ts
apps/web/src/play/play.tsx
	WINDOW I (Final Expansion Window)
(~14 lines in play-scene.ts delegating altitude > 180 m camera & globe rendering to orbital-flight-view.ts)
	None. Reuses existing aerospace shuttle/rover kit + PlanetForge 3D celestial sphere shader.
	packages/orbital/src/flight-and-transfer.ts: Pure orbital ascent/descent physics solver, altitude cross-fade curve, and SMX-PLN-XXXX seed/mantle transfer state machine.
	+16 KB
	3. Single-File Build-Size Ledger (dist/index.html vs. 16.00 MiB Cap)
Milestone / Ticket
	Delta on dist/index.html
	Cumulative dist/index.html Size
	External / HD Pack Delta (public/hd/)
	Free Headroom Below 16.00 MiB Gate
 
	Current Post-T17a Baseline (OPUS_NOTE_25)
	—
	13.670 MiB
	+0.90 MiB in public/hd/
	2.330 MiB (~2,386 KB)
	Staged Bundles (TICKET-18 rest, 19, 21, 22 + In-Queue T07b..T16b)
	+0.052 MiB (+53 KB)
	13.722 MiB
	0 MiB
	2.278 MiB (~2,333 KB)
	TICKET-23 (Machine Housing LEDs, Plume Vent/Gravity, Spitter Walls & Pad Switch)
	+0.009 MiB (+9 KB)
	13.731 MiB
	0 MiB
	2.269 MiB
	TICKET-24 (Menu Hero Vista & Glass Blade, Pixel Font, Degauss & CSS Scope)
	+0.022 MiB (+22 KB)
	13.753 MiB
	0 MiB
	2.247 MiB
	TICKET-25 (47-Tile Blob Autotile, Modular Scout Sockets & E2E Sweep)
	+0.011 MiB (+11 KB)
	13.764 MiB
	0 MiB
	2.236 MiB
	TICKET-26 (Shared Planetary Grid Sector Claims & Friend Gate Dialing)
	+0.012 MiB (+12 KB)
	13.776 MiB
	0 MiB
	2.224 MiB
	TICKET-27 (Running-Game Auto-Detector & 4-Rung Leak Restoration Ladder)
	+0.010 MiB (+10 KB)
	13.786 MiB
	Optional Meshy/HD wrecks in public/hd/wrecks/
	2.214 MiB
	TICKET-28 (Inter-Planetary Spaceflight & Multiverse Orbital Traversal)
	+0.016 MiB (+16 KB)
	13.802 MiB
	0 MiB
	2.198 MiB (~2.20 MiB safe margin)
	4. Recommended Dispatch Sequence for Opus (Post-Reset Tomorrow Afternoon)
   1. Step 1 — Stage Staged Bundles (TICKET-18 rest, TICKET-21, TICKET-19, TICKET-22): Follow the 5-step sequence and conflict matrix in ARGO_NOTE_21 once Flash finishes the current play-scene.ts queue, then run the full green suite on the 3D PC worker.
   2. Step 2 — Dispatch TICKET-23 and TICKET-24 in Parallel (Zero play-scene.ts Contention):
   * Haiku / Flash Track A (TICKET-23): POL-281/282 press vent offset & plume gravities, POL-39 housing LEDs, POL-33 Spitter wall colliders, and POL-73/76/77 pad machine switch & hopper cap.
   * Haiku / Flash Track B (TICKET-24): POL-01/64 Main Menu glass blade & Stage-4 hero gate vista, POL-41/42 embedded pixel font & degauss tick, and POL-67/71/83/85 cleanup.
   3. Step 3 — Dispatch TICKET-25 (47-Tile Blob Autotile + Modular Scout + Final E2E Sweep): Closes the remaining open visual and browser-test items in DEFERRED_POLISH_REGISTRY.md.
   4. Step 4 — Dispatch the Multiverse & Bridge Expansion Wave (TICKET-26 → TICKET-27 → TICKET-28): Land Friend Gate Dialing & Sector Claims (TICKET-26), the Running-Game Auto-Detector & 4-Rung Wreck Restoration Ladder (TICKET-27), and seamless Ground-to-Orbit Multiverse Flight (TICKET-28).