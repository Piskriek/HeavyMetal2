ARGO_NOTE_28 — TICKET-28 Bundle Summary & Installer Guide (Stage-6 Orbital Shuttle & Seamless Ground-to-Orbit Multiverse Flight)
Author: Gemini Argo (PM & Creative Lead)
To: Claude Opus (Lead Engineer) & Sidecar Installers
Bundle File (My Drive Root): argo-ticket28-bundle.json (1RNA48yn3w-b2tSk00Z2gEuRx07_ktfDd)
Single-File Build Size Cost: +14 KB (+0.014 MiB, finishing all 28 tickets at ~13.80 MiB with ~2.20 MiB of free margin below the 16.00 MiB gate)
1. Summary of Changes
* POL-14 (Inter-Planetary Spaceflight & Multiverse Orbital Traversal, OWNER_ASKS 2026-10-06/09):
   * computeGroundToOrbitCrossfade(altitudeM) in packages/orbital/src/flight-and-transfer.ts implements a continuous Outer Wilds / No Man’s Sky-style ground-to-orbit pitch-up transition (Seamless Ground-to-Space Transition Reference): below 120 m the Shuttle flies in normal lunar gravity over PlotGround; across 120..420 m it smoothly cross-fades groundChunkOpacity (1 → 0) into starfieldOpacity and planetGlobeScale (0 → 1) while tapering gravity to zero; above 420 m the Shuttle cruises in 3D orbital space.
   * CANONICAL_MULTIVERSE_PLANETS, parsePlanetForgeShareCode, and findLockedApproachPlanet populate the orbital starfield with the canonical Planet Forge worlds (Selene Outpost, Ignis-IV, Verdant-Prime, Thalassa-Atoll, Lumen-IX) plus any player-published SMX-PLN-XXXX-NAME worlds, locking the landing ring within 180 m to transfer the session to that planet’s procedural terrain seed and @hm/vault geological mantle cartridge.
* Window I Hook for play-scene.ts (apps/web/src/play/window-i-orbital-flight-hooks.ts): Encapsulates the entire orbital state machine inside createOrbitalFlightDirector(customPlanetCodes) so play-scene.ts needs fewer than 12 lines in its labelled Window I section.
2. Files & Unit Tests Included
* packages/orbital/src/flight-and-transfer.ts (pure deterministic module)
* packages/orbital/tests/flight-and-transfer.test.ts (3/3 unit tests passing via node:test)
* apps/web/src/play/window-i-orbital-flight-hooks.ts (Window I hooks for play-scene.ts)
3. What Installers Must Check (ARGO_NOTE_21 Protocol)
Target File
	What to Check Before Copying
	Fallback / Merge Fix
 
	apps/web/src/play/window-i-orbital-flight-hooks.ts
	Imports '@hm/orbital/flight-and-transfer'. Check if @hm/orbital/* is in tsconfig.base.json.
	Add "@hm/orbital/*": ["packages/orbital/src/*"] to tsconfig.base.json, or copy flight-and-transfer.ts into apps/web/src/play/flight-and-transfer.ts and import './flight-and-transfer'.
	apps/web/src/play/play-scene.ts (Window I)
	Wire after Window F, Window G, and Window H have landed.
	Add the 10-line // ---- Window I (TICKET-28: POL-14 Orbital Multiverse Flight) block calling orbitalDirector.step(controls, dt) when the Orbital Shuttle is active and passing crossfade.groundChunkOpacity !== 0 to ground.setVisible(...).