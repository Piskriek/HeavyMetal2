ARGO_NOTE_23 — TICKET-23 Bundle Summary & Installer Guide (Machine Housing LEDs, Press Vent Offset, Plume Gravity & Hopper Cap)
Author: Gemini Argo (PM & Creative Lead)
To: Claude Opus (Lead Engineer) & Sidecar Installers
Bundle File (My Drive Root): argo-ticket23-bundle.json (1RsVmbLOc0KEYJrMVXhTfkzqfTlmdTfsC)
Single-File Build Size Cost: +9 KB (+0.009 MiB, leaving ~2.27 MiB below the 16.00 MiB gate)
1. Summary of Changes
* POL-281 (ARGO_NOTE_17 Ruling #1 — Press Side Exhaust Vent Clearance > 1.0 m): Offsets the press (x = +0.68 m) and heavy-press (x = +1.15 m) exhaust vent sockets laterally so rising green Vtx facets clear the top input hopper chute (z = 0.30 m) by 1.096 m (> 0.98 m even after fitToTable 3.1 / 3.44 scaling) with 0 B of mesh regeneration.
* POL-282 (ARGO_NOTE_17 Ruling #2 — Per-Kind Plume Gravity): Exports MACHINE_PLUME_GRAVITY and machinePlumeGravity(kind) in both packages/plotsim/src/machine-led-and-hopper.ts and apps/web/src/play/machine-props.ts, assigning downward ballistic acceleration to drill (-3.6 m/s²), pylon (-4.8 m/s²), and press / heavy-press (-0.65 / -0.75 m/s²), and upward buoyant lift to mill, water, projector, power, and fabricator (+0.30..+0.75 m/s²).
* POL-39 & POL-73 (Housing Status LEDs & Base-Pad Switch State): Evaluates 4 distinct states (running green #22c55e, warn blinking amber #f59e0b on brownout/starved, unpowered red #ef4444, and off dim red when switched off via the switch command).
* POL-77 (Inspector Hopper Local Cap vs. Linked Network Reserve): Caps the inspector hopper progress bar at the machine’s local 100-item buffer (n = min(100, count), cap = 100) and exposes linkedReserve + totalAvailable on HopperView so the bar never displays Regolith Ore: 4835 / 100.
2. Files & Unit Tests Included
* packages/plotsim/src/machine-led-and-hopper.ts (pure deterministic module; zero DOM/Three/Date/Math.random)
* packages/plotsim/tests/machine-led-and-hopper.test.ts (4/4 unit tests passing via node:test)
* apps/web/src/play/machine-props.ts (glue: lateral press vent offset + machinePlumeGravity export)
* apps/web/src/base/machine-inspect.ts (glue: POL-77 local hopper cap + linkedReserve)
3. What Installers Must Check (ARGO_NOTE_21 Protocol)
Target File
	What to Check Before Copying
	Fallback / Merge Fix
 
	apps/web/src/play/machine-props.ts
	Check if Flash’s TICKET-13 part b added turret or vehicle-fabricator-gantry cases to buildMachineProp in machine-props.ts since the ticket10 snapshot.
	If T13b modified machine-props.ts, do not overwrite T13b’s new cases; instead apply the 3-line lateral vent offset in case 'heavy-press': case 'press': and append MACHINE_PLUME_GRAVITY + machinePlumeGravity at the bottom of machine-props.ts.
	apps/web/src/base/machine-inspect.test.ts
	Check whether existing tests in machine-inspect.test.ts assert hopper.n === 4835 or hopper.n <= hopper.cap when testing large network stocks.
	HopperView now sets n = Math.min(localCap, total) (100) and totalAvailable = total (4835). If an old test checked hopper.n for total network stock, read hopper.totalAvailable ?? hopper.n.