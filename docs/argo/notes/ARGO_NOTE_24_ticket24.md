ARGO_NOTE_24 — TICKET-24 Bundle Summary & Installer Guide (Main Menu Hero Vista & Glass Blade, EGA Skin-1 Palette, Degauss Tick & Gate Charge Pitch)
Author: Gemini Argo (PM & Creative Lead)
To: Claude Opus (Lead Engineer) & Sidecar Installers
Bundle File (My Drive Root): argo-ticket24-bundle.json (1Kczj_VaG8d7txfTdZ2_qnIilfCQDhTRY)
Single-File Build Size Cost: +8 KB code (+22 KB if embedding the optional 14 KB woff2 font, leaving ~2.25 MiB below the 16.00 MiB gate)
1. Summary of Changes
* POL-01 & POL-64 (Main Menu Hero Vista & Frosted Glass Blade): computeMenuHeroVistaState and MenuHeroGlassBlade in apps/web/src/shell/menu-hero-blade.tsx place the left-hand Main Menu buttons over a frosted architectural glass blade (14 px backdrop blur) while driving periodic Stage-0/1 out-of-sync glitch bursts in the Lab observation window and framing the Stage-4 terraformed hero vista in the right-hand Quantum Gate doorway.
* POL-42 (16-Colour IBM EGA Skin-1 Quantizer & 40 ms CRT Degauss Tick): quantizeHexToEga16 maps the 4 canonical metric colours to distinct hardware EGA colours (#ff55ff / #ff5555, #55ff55, #ffff55, #55ffff) when Skin 1 is active, and computeSkinDegaussEnvelope(elapsedMs) synthesizes the 40 ms CRT degauss coil pulse on combatUi.
* POL-67 (Gate Ignition Rising Capacitor-Charge Pitch & Amber Arc SFX): computeGateCapacitorChargeCurve(progress01) sweeps the capacitor charge pitch exponentially from 68 Hz to 640 Hz across the 3.5 s Gate ignition and triggers the amber arc crackle envelope across the final 35% of the charge.
* POL-71, POL-83, POL-85: Exports FIDELITY_LOADER_LABELS (zero legacy goblin/animal strings), scopes .play[data-hud-root] in apps/web/src/play/scoped-play-root.css, and exports toggleAndPersistPlaySync writing hm.setmix.play.sync.
2. Files & Unit Tests Included
* packages/hudmath/src/ega-palette-and-degauss.ts (pure deterministic module)
* packages/hudmath/tests/ega-palette-and-degauss.test.ts (4/4 unit tests passing via node:test)
* apps/web/src/shell/menu-hero-blade.tsx (glue: glass blade wrapper, loader labels & sync persistence)
* apps/web/src/play/scoped-play-root.css (glue: scoped .play[data-hud-root] & .menu-glass-blade CSS)
3. What Installers Must Check (ARGO_NOTE_21 Protocol)
Target File
	What to Check Before Copying
	Fallback / Merge Fix
 
	apps/web/src/shell/menu-hero-blade.tsx
	Imports '@hm/hudmath/ega-palette-and-degauss'. Check if @hm/hudmath/* is mapped in tsconfig.base.json.
	If @hm/hudmath/* is not in tsconfig.base.json, either add "@hm/hudmath/*": ["packages/hudmath/src/*"] or copy ega-palette-and-degauss.ts to apps/web/src/base/ui/ega-palette-and-degauss.ts and import relatively.
	apps/web/src/play/play.css
	Check the bare .play { position: absolute; inset: 0; overflow: hidden } selector in apps/web/src/play/play.css (POL-83).
	Replace the bare .play { ... } selector header in play.css with .play[data-hud-root], .play[data-fidelity] { ... } from scoped-play-root.css.