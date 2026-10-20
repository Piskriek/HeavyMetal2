ARGO_NOTE_27 — TICKET-27 Bundle Summary & Installer Guide (Running-Game Auto-Detector Bridge, 4-Rung Wreck Restoration Ladder & Crystal Anomaly Clusters)
Author: Gemini Argo (PM & Creative Lead)
To: Claude Opus (Lead Engineer) & Sidecar Installers
Bundle File (My Drive Root): argo-ticket27-bundle.json (1JDLr1uuBVX1G4uE5ZAx0FiDWl_vuYYHE)
Single-File Build Size Cost: +10 KB (+0.010 MiB, leaving ~2.21 MiB below the 16.00 MiB gate)
1. Summary of Changes
* POL-13 (Running-Game Auto-Detector & Cross-Game Cartridge Bridge, OWNER_ASKS 2026-10-07): detectRunningBridgeGames in packages/bridgekit/src/game-detector.ts and RunningGameBridgePill in apps/web/src/shell/running-game-bridge-pill.tsx match running OS processes (UnrealEditor, Godot, Minecraft/javaw, Unity, Blender, Quake2/DOOM/hl2) from GET /__studio/bridge/running-games (System Bridge Localhost Pattern), light a green BRIDGE: CONNECTED pill, and unlock live bridged .smx cartridges (bridge:unreal-lumen, bridge:godot-sdfgi, bridge:minecraft-voxel, etc.).
* 4-Rung Junked-Model Containment Leak Restoration Ladder (OWNER_ASKS 2026-10-12): WRECK_RESTORATION_LADDER and evaluateWreckRestorationRung step a wreck site through all 4 fidelity tiers once its containment leak is sealed and the player applies the Fidelity Beam: Rung 0: broken-junk (old/) → Rung 1: standard-low (low/) → Rung 2: runworld-hd (mid/) → Rung 3: meshy-max (high/).
* POL-23 (Multi-Shard Square-Faceted Anomaly Node Clusters): ANOMALY_CRYSTAL_CLUSTERS defines 3-shard tilted square-crystal clusters for pxd, vtx, lx, and aq anomaly nodes to replace single-primitive stand-ins.
2. Files & Unit Tests Included
* packages/bridgekit/src/game-detector.ts (pure deterministic module)
* packages/bridgekit/tests/game-detector.test.ts (3/3 unit tests passing via node:test)
* apps/web/src/shell/running-game-bridge-pill.tsx (glue: [BRIDGE: CONNECTED] HUD/Studio pill & one-click .smx cartridge equip)
3. What Installers Must Check (ARGO_NOTE_21 Protocol)
Target File
	What to Check Before Copying
	Fallback / Merge Fix
 
	apps/web/src/shell/running-game-bridge-pill.tsx
	Imports '@hm/bridgekit/game-detector'. Check if @hm/bridgekit/* is in tsconfig.base.json.
	Add "@hm/bridgekit/*": ["packages/bridgekit/src/*"] to tsconfig.base.json, or copy game-detector.ts into apps/web/src/shell/game-detector.ts and import './game-detector'.
	apps/web/studio-server/write-back.ts
	RunningGameBridgePill fetches GET /__studio/bridge/running-games and gracefully falls back to initialProcesses if the route is absent (e.g., offline file:// build).
	Optionally add a 10-line GET /__studio/bridge/running-games handler in write-back.ts returning { processes: [...] } in dev mode.