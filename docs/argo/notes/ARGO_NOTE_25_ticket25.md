ARGO_NOTE_25 — TICKET-25 Bundle Summary & Installer Guide (47-Tile Blob Autotile, Modular Scout Sockets, Scan Ring Fade & Suit-Cam EV Settle)
Author: Gemini Argo (PM & Creative Lead)
To: Claude Opus (Lead Engineer) & Sidecar Installers
Bundle File (My Drive Root): argo-ticket25-bundle.json (1xJVCeV60sXVvQjp2KF7fObjq0S4BG2uW)
Single-File Build Size Cost: +11 KB (+0.011 MiB, leaving ~2.24 MiB below the 16.00 MiB gate)
1. Summary of Changes
* POL-05 (47-Tile Wang/Blob Autotile Transition Set): normalizeBlobMask, BLOB_47_MASKS, MASK_TO_BLOB47_INDEX (256-entry Uint8Array O(1) lookup), and evaluateBlob47SubtileBlend(rawMask8, u01, v01) in packages/groundshader/src/blob47-autotile.ts map all 256 8-neighbour Moore bitmasks onto the 47 canonical Blob tiles with smooth SDF corner and inner-notch feathering at 0 KB texture cost (BorisTheBrave Blob Tileset Spec).
* POL-50 (Modular Scout Sockets, Hauler VEHICLE_FIT & Watermaker Hardpoint Fit): Defines MODULAR_SCOUT_SOCKETS (whip aerial raycast origin [-0.62, 1.85, -0.95], square [-u-] yoke socket [0, 0.94, 0.48], and rear utility socket [0, 0.88, -1.32]), HAULER_VEHICLE_FIT, and WATERMAKER_HARDPOINT_FIT (confirming the fitted Watermaker sits cleanly inside the 8.0 × 8.0 m 2×2 hardpoint).
* POL-25, POL-52, POL-53, POL-60: Adds isVistaFlashAtPeak (triggers Lab floor illumination capture at flash peak ≥ 0.65), computeScanRingHorizonFade (fades scan ring opacity to 0 at 350 m while resolving the far world), computeSuitCamEvOvershoot (starts at +0.85 EV, settles to 0.144 EV ≤ 0.15 EV at 0.4 s and < 0.02 EV at 1.0 s), and computeSafeDomeGroundBand.
2. Files & Unit Tests Included
* packages/groundshader/src/blob47-autotile.ts (pure deterministic module)
* packages/groundshader/tests/blob47-autotile.test.ts (4/4 unit tests passing via node:test)
* apps/web/src/play/window-h-autotile-and-scout-hooks.ts (Window H hooks for play-scene.ts)
3. What Installers Must Check (ARGO_NOTE_21 Protocol)
Target File
	What to Check Before Copying
	Fallback / Merge Fix
 
	apps/web/src/play/window-h-autotile-and-scout-hooks.ts
	Imports '@hm/groundshader/blob47-autotile'. Check if @hm/groundshader in tsconfig.base.json only maps the package root.
	Append export * from './blob47-autotile'; to packages/groundshader/src/index.ts and change the import in window-h-autotile-and-scout-hooks.ts to from '@hm/groundshader'.
	apps/web/src/play/stage-look.ts (POL-53)
	Check stepExposure / gateOrLabFactor in apps/web/src/play/stage-look.ts.
	Call computeSuitCamEvOvershoot(elapsedSec) from blob47-autotile.ts when stepping across the Gate threshold if you want the exact +0.85 EV step settling to 0.144 EV at 0.4 s.