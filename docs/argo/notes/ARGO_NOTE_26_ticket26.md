ARGO_NOTE_26 — TICKET-26 Bundle Summary & Installer Guide (Shared Planetary Grid Sector Claims, Friend Gate Dialing & Neighbor Plot Rearrangement)
Author: Gemini Argo (PM & Creative Lead)
To: Claude Opus (Lead Engineer) & Sidecar Installers
Bundle File (My Drive Root): argo-ticket26-bundle.json (1G8FYRi7TbRe9DwbDQahzYkFOfsQ5999H)
Single-File Build Size Cost: +12 KB (+0.012 MiB, leaving ~2.22 MiB below the 16.00 MiB gate)
1. Summary of Changes
* POL-84 (Claimed Sector Readout on Planetary Grid): formatClaimedSectorReadout in packages/coopnet/src/gate-dialer.ts and getActiveSectorReadout in apps/web/src/crafter/shared-planet.ts format the player’s claimed sunflower-spiral slot into SECTOR #04 // 226 m NE (or SECTOR #00 // ORIGIN CRATER) so PlanetaryGridScreen never shows UNCLAIMED once a plot is hosted or published.
* POL-16 (6-Chevron Friend Gate Dialing & Neighbor Rearrangement, OWNER_ASKS 2026-10-06):
   * beginGateDial and stepGateDial implement a deterministic 6-coil Quantum Gate dialing sequence (0.45 s per coil = 2.70 s lock) that lights the Gate’s 6 copper field coils bottom-to-top before opening the portal onto a friend’s 6-character Gate code (No Man’s Sky Portal Coordinate System).
   * rearrangeFriendsAdjacentToSlot and arrangeFriendsNearHost assign pinned friends deterministically to the closest available sunflower-spiral neighbour slots within 350 m of the player’s sector.
2. Files & Unit Tests Included
* packages/coopnet/src/gate-dialer.ts (pure deterministic module)
* packages/coopnet/tests/gate-dialer.test.ts (3/3 unit tests passing via node:test)
* apps/web/src/crafter/shared-planet.ts (glue: extends shared-planet.ts with getActiveSectorReadout and arrangeFriendsNearHost while preserving all existing exports)
3. What Installers Must Check (ARGO_NOTE_21 Protocol)
Target File
	What to Check Before Copying
	Fallback / Merge Fix
 
	apps/web/src/crafter/shared-planet.ts
	Imports '@hm/coopnet/gate-dialer' at line 204. Check if @hm/coopnet/* is in tsconfig.base.json.
	If @hm/coopnet/* is not in tsconfig.base.json, either add "@hm/coopnet/*": ["packages/coopnet/src/*"] or copy gate-dialer.ts into apps/web/src/crafter/gate-dialer.ts and import './gate-dialer'.
	apps/web/src/shell/planetary-grid.tsx
	Check where PlanetaryGridScreen renders the slot badge (previously UNCLAIMED when props.slot was omitted, POL-84).
	Call getActiveSectorReadout(undefined, roomCode ?? 'local-outpost')?.label ?? 'UNCLAIMED' as the default slot readout in PlanetaryGridScreen.