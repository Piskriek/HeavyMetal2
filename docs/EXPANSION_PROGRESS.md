# Expansion Progress

## Section 1: Implemented

- Main menu: New Game, contextual Resume Race, Settings, How to Play, Hall of Chaos, credits/research, sound toggle, and fullscreen.
- New Game: select one of the existing three tracks and open the starting grid. Existing races require replacement confirmation.
- Settings: display/audio/accessibility tabs, persistent immediate changes, non-destructive reset, and a local synthesized sound test.
- Styling: full-bleed original key art, fantasy serif identity, forged green-iron secondary controls, brass borders, crimson primary action, and optional low-cost ambient motion.
- Navigation: keyboard focus, arrow-key menu and track selection, Escape/back paths, focus-trapped dialogs, main-menu return, and in-memory resume.
- Performance: no race assets or atlas generation until a race screen is mounted; pause and stop visibility/input when another screen covers the race.
- Research: `docs/GAME_DESIGN.md` links primary Blizzard UI notes, a Blizzard artist interview, Microsoft game accessibility guidance, MDN canvas guidance, and Nintendo's Grand Prix guide.

## Section 2: Implemented

- Three-step New Game flow: Competition, Rider & Capsule, and Race Rules. Keyboard radio navigation, backward navigation, safe defaults, and replacement confirmation are supported.
- Quick Race chooses one of the existing courses. Tournament runs a real three-race Scrapdome Cup with the same crew and cumulative 9/6/3/1 scoring.
- Four riders (Rivet, Nix, Grub, Sprocket) and three capsules (Rustbucket, Springsteel, Siegebreaker) provide 12 loadouts. Every build shares a 24-point rating budget. Exact stat formulas and the matrix are recorded in `docs/LOADOUT_BALANCE.md`.
- Original SVG rider portraits and capsule previews are generated without external dependencies. The chosen appearance is rasterized once into race sprites; it is not just a menu-only cosmetic. (Superseded in Part 4.2: these are now painted PNGs cut from source sheets by `scripts/build-art.mjs`.)
- Loadouts affect launch speed, max speed, lane response, mass, boost response, hop control, and bump recovery. CPUs use the same preset calculations.
- Rookie/Racer/Veteran controls AI decisions, not hidden speed. Quick Race custom practice re-enables the earlier live tuning sliders; preset races and tournaments lock their physics.
- Basic round-end results, cup totals, next-race transitions, final cup ranking, rematches, and menu resume make both modes playable now. Rivals have a real 10-second finish window; DNFs earn zero.
- Session config is separate from display/audio preferences. Round results are committed once by session ID/round/course. Last setup and completed records persist; the active cup is retained in memory across menus but not yet restored after a page reload.
- Existing track and physics settings cannot silently change a competitive event from the workshop.

`src/App.tsx` owns `RaceSession`, while `src/game/session.ts` provides mode/config/scoring helpers. A round config keeps stable identity during HUD and result updates so the engine does not accidentally restart. `src/screens/RaceScreen.tsx` owns the live engine and invokes the round-complete callback.

## Section 3: Implemented

- Packed dirt replaces the noisy plank road. Earth banks, broad value patches, faint wheel ruts, and chalk lane boundaries keep the racing surface quiet.
- Four lanes are now 240 units wide, and the view pulls back to 0.86 scale. Projection and inverse aiming stay aligned; static atlas reference scale prevents double scaling.
- The three courses have distinct forest/canyon/meadow palettes, cached backgrounds and landmarks, elevation profiles, obstacle rhythms, sector names, and stadium identities.
- Cached original blimps drift through the sky without acting as hazards. Decorative movement respects reduced motion.
- Three airborne supplies are playable: Rocket Fuel (+1 boost and a small surge), Skyward Shield (one rival bump or six seconds), and Air Spring (+1 air bounce).
- Shared one-use pickups use swept collision checks, earliest-contact arbitration, lane/height placement, and per-round resets. CPUs value and collect them under the same rules.
- The HUD shows supply symbols, pickup counts, and a shield timer. The handbook explains effects and caps; race records store collected supplies and absorbed shoves.
- Quick Race previews and the cup itinerary show the three course identities. Existing fixed loadouts, custom-practice exception, and cup scoring remain intact.
- See `docs/WORLD_AND_POWERUPS.md` for implementation rules and the verification boundary.

## Section 4: Split Into Four Parts

Section 4 is implemented in four installments, one per user prompt.

### Part 4.1: Durable Events And Recovery — Implemented

- One versioned durable document (`goblin-rally-session-v1`, plus a `-backup` slot) stores the selected event, the fixed roster/loadout, the difficulty, the committed results with their full finishing field, the current round and an explicit phase (`setup`, `grid`, `racing`, `round-results`, `cup-results`).
- Hydration is total and non-destructive: a reload lands on the menu with a contextual Continue/View Results entry; a completed cup opens its final standings; a committed round opens its results; an unfinished round resumes at that round's starting grid with an explicit restart message. An earlier unfinished round is never skipped and later results are never deleted or double-scored.
- Round commits are atomic (phase and result in one write) and idempotent. Duplicate or mismatched records are dropped with a report; the Hall of Chaos replaces rather than appends a record for the same session round.
- Malformed data is handled explicitly: denied/full storage, invalid JSON, a corrupt primary (falls back to the last good copy), unsupported future schema versions (left untouched), out-of-range rounds, missing or duplicate racer IDs, impossible course order, malformed loadouts and mismatched result session IDs.
- The race screen no longer builds a live engine for a round that was already committed, so a restored result can never be replayed as unscored gameplay.
- `npm run check` runs `tsc --noEmit` plus 18 focused recovery tests in `tests/session-save.test.ts` (TAP output also written to `tests/artifacts/latest-test-run.tap`). Contract details and migration rules are in `docs/PERSISTENCE.md`.
- `npm run check:browser` builds the app and drives the reload flow in real headless Chromium (21 checks: start a cup, launch, reload mid-race, resume, restored cup standings, corrupt primary, denied storage). Screenshots and a TAP log land in `tests/artifacts/`.
- Recovery is round-boundary only: there is no engine snapshot, and the UI says so instead of pretending a reload restores live physics.

### Part 4.2: Original PNG Art Pass And Asset Integration — Implemented

- Every placeholder vector rider, capsule, supply, blimp, landmark and course preview is now a painted raster PNG. The only SVG left in the app is the logo mark and the dashed pull-back hint arrow — control/identity icons, which the brief allows to stay vector. Semantic UI text was never drawn into art.
- `public/art/sheets/` holds the eight sources: three generated sheets (`capsules-sheet.png`, `landmarks-sheet.png`, `blimp.png`), the generated `courses-sheet.png`, three individually generated supply icons, and `riders-source.png` — the predecessor project's painted portrait sheet (`PreGame/assets/portraits/user_portraits.png`), reused for the four riders as hinted. Cell mapping is row-major: 0 Rivet, 8 Nix, 11 Grub, 3 Sprocket.
- `scripts/build-art.mjs` is the single build-time pixel pipeline: per-cell border matte detection (magenta `#FF00FF` preferred because the subjects are green; `#00FF00` still supported), fringe-only despill that clamps just the matte channels, `-shave 6x6` per cell so painted dividers cannot join a subject, largest-component hull trimming, and normalisation of every shell hull to exactly 452 px on a 512 px canvas so armour never changes the collision envelope.
- The pilot's seat is the shell's ringed **port**, chosen the same way the pre-4.2 SVG drew it, and `measureHatch()` now *measures* it on every build instead of carrying hand-pinned numbers: of the near-black opaque blobs, the largest one whose centroid sits in the lower-right quadrant is the port, and its bounding box is fitted to an ellipse inset by 0.92 to clear the tilted opening's ring (iron 0.806,0.613 rx 0.089 ry 0.127 / springsteel 0.804,0.613 rx 0.079 ry 0.125 / siege 0.800,0.605 rx 0.082 ry 0.125). The earlier hand-pinned ellipse was offset and undersized against the artwork, so the bust clipped over the brass ring — the "portrait renders outside the capsule" defect a screenshot review caught. `assertHatch()` still verifies every fit against the freshly written sprite (dark interior, brighter painted ring sampled on three rings, luma contrast > 25), so artwork that moves a port fails the build rather than silently moving the pilot.
- The manifest records the **detected** matte hex next to the canonical target (`#FF00F8` detected / `#FF00FF` target), so a drifting sheet is visible in the Sprite Lab instead of silently passing.
- 18 runtime sprites: four 512² portraits and four 256² pilot busts, three 512² shells, three 256² supplies, four landmarks, the 900x576 blimp and three 800x440 course previews. All alpha sprites are true RGBA PNGs (verified with `identify`), and the opaque course previews stay opaque.
- Runtime: `src/game/art-assets.ts` types the manifest and exposes accessors plus a decode-once cache; `src/game/loadout-art.ts` bakes one 192² race capsule per racer (shell, pilot inside the measured ellipse, team-colour rim) and caches at most six, so racing still composites nothing per frame; `src/game/world-art.ts` decodes the blimp and landmarks before the first frame; `src/components/RacerFigure.tsx` composites the menu figure with the same measured ellipse.
- Failure behaviour is explicit: a 404 or decode error produces a visible painted placeholder, marks the sprite and logs `[Goblin Rally] art placeholders in use: ...` rather than drawing nothing.
- The Sprite Lab (The Workshop > Sprite Lab) lists the whole library plus the source sheets, with the detected key, target key, grid and runtime size, and its downloads are the exact files the race loads. The credits panel now names the art, the manifest, this pipeline and the reused predecessor portraits.
- The pilot's eye line is **measured per rider** (Rivet 0.44, Nix 0.44, Grub 0.52, Sprocket 0.49) instead of one shared constant: a tall helmet carries the eyes much lower in the 68% head crop, and the single 0.44 value pushed Grub's face into the lower rim of the port. `tests/artifacts/eyeline-probe.png` is regenerated by every build with 0.30/0.40/0.50/0.60 guide rows so the numbers stay re-checkable. Horizontally the busts are centred on the window (alpha centroids measure 0.47–0.52 of the crop), so no per-rider x offset was needed.
- Hull normalisation was fixed: it padded then `-roll`ed each shell by coordinates, which rolled the wrong way, wrapped a band of pixels around the canvas and pushed the sprite off-canvas (the shells leaked stray `iron-shell.png`/`siege-shell.png`/`springsteel-shell.png` files into the repo root as a side effect of being written to a relative path). Shells are now written to `public/art/` and centred with a single `-gravity center -extent 512x512`, so the pipeline reproduces a correctly framed shell from the source sheet.
- `pilotRuntime` in the manifest is written as `{ "width": 256, "height": 256 }`; it had been written as a `[width, height]` tuple, which type-checked through the manifest cast but made the Sprite Lab print `0x0` for every cockpit bust at runtime.
- The bust is seated square and inside the port: `racerLayers` used to draw it at `3.4 * rx` by `3.4 * ry` (1.7x the opening in both axes), which both stretched the face and pushed the goblin's helmet over the ring. It is now `2.4 * min(rx, ry)` on both axes, so the alpha bounding box of the bust stays inside the painted opening at every rider/capsule pair.
- Verification: `npm run check:art` (25 checks in headless Chromium, on the built app) and the same 25 checks against the live dev server (`node tests/art-check.mjs http://127.0.0.1:5173`), plus `tests/artifacts/alpha-check.png` (checkerboard contact sheet), `hatch-probe.png` (measured ellipses drawn over the shells) and `eyeline-probe.png` (pilot eye-line guides) reviewed as images by the implementing agent. The art checks assert geometry, not just presence: the pilot window's clip-path has to sit on the measured port centre (x 0.81 / y 0.61), the pilot box has to stay square, the bust's alpha box has to stay inside the dark area around the port rather than clipping over the brass ring, the pilot image has to stay inside the capsule silhouette, and picking another rider and capsule has to swap both painted layers. A separate file-level pass confirmed every shipped sprite starts with the PNG signature, the keyed sprites carry real alpha with a transparent corner, and `grep` finds no `data:image/svg` left in `src/**/*.ts{,x}`.
- Regenerating the library is `node scripts/build-art.mjs` (~45 s, ImageMagick 6 required at build time only). Contract, schema and fallback rules: `docs/ART_PIPELINE.md`.

### Parts 4.3–4.4: Awaiting User Prompts

Results/cup/progression presentation and persistent cup history; then empirical balance, end-to-end QA, frame pacing and release verification. A successful build is not proof of FPS, balance or accessibility.

## Phase 1 Ticket Suite

The ticket suite in `docs/tickets/` is implemented one issue at a time. `TICKET-01` (ornate frame system) shipped earlier; `TICKET-02` is implemented here.

### TICKET-02: UI Decluttering, Visual Gauges & Hierarchical Drill-Downs — Implemented

- `src/components/ui/BlizzardGauge.tsx` provides three engraved gauge modes in the molten orange/gold family: `arc` (270° circular meter with embossed needle, used for the four core loadout gauges), `dial` (tachometer-style speedometer with major/minor ticks, redline arc and a digital readout, used as the in-race top-right speedometer), and `meter` (horizontal engraved progress bar used inside the drill-down). Value changes animate via CSS transitions on stroke dash-offset and needle rotation, so selection changes sweep smoothly.
- The setup spec panel keeps only a short identity line, the four gauges (Launch, Handling, Boost, Stability), and a budget chip. Rider lore, capsule lore, trade-offs, the base/rider/capsule balance breakdown, the physics formulas and the stat glossary moved behind a `Tuning Details` `[i]` trigger that opens `src/components/ui/Drawer.tsx`, a flyout drawer over the dialog (Escape and scrim close it without closing the dialog; focus returns to the trigger).
- The in-race HUD replaced the verbose track-selector banner, the three-text telemetry cluster, the standings strip with pack-delta meters, and the wide air-supplies bar with: a top-right analog/digital speedometer plus `PositionMedallion` (gold/silver/bronze/iron for 1st–4th), a slim bottom mini track bar with the player ball and rival pips plus remaining distance, and a compact three-chip supply counter with charge badges in the bottom-left corner.
- The page's title bars (brand header, MAIN MENU / THE WORKSHOP / HALL OF CHAOS, event banner, wisdom footnote, footer) collapse while a round is live: an immersion mode grows the stage to the full viewport, and a single compact gear button in the top-left consolidates pause/resume, restart, sound, workshop, records, help, settings and main menu. The gear button auto-hides after ~2.4 s of pointer stillness during active play and returns on any pointer or key activity; opening it mid-flight pauses the race so browsing never costs the round.
- The control deck keeps only tactile inputs and live numbers: a short functional status word (Live / Recovering / In the loop / Paused / Finished / On the grid) replaces the flavor headline and description paragraph; steering, lane indicator, launch power / chaos points, jump/bounce/boost, and the primary action remain. Tutorial copy is hidden once the race launches.
- Styles live in `src/hud.css`; obsolete rules for the removed bars and text walls were deleted from `index.css`, `setup.css` and `menu.css`, and `RaceStandings.tsx` was removed.
- Verification: `tests/ticket02-visual.mjs` drives the built app in headless Chromium (24 checks: gauge count and live updates, drawer sections and Escape, removal of banner/standings/supplies-bar, dial + medallion + 4 track pips + 3 supply chips, immersion (header/footnote hidden, shell == viewport), gear auto-hide/return, gear menu contents and Escape) with screenshots in `tests/artifacts/` that were inspected as images. The 24 `ui-frame-check.mjs` regression checks still pass. Not verified: real-device frame pacing and long-session feel.

### TICKET-04: Character & Ball Selection Redesign (Full-Body Goblin + Standalone Ball Renders) — Implemented

- The broken "cockpit hole" composite is gone: `RacerFigure`, `racerLayers`, `measureHatch()` / `assertHatch()` and the three `*-shell.png` sprites are removed. No goblin head peeks out of a hatch anywhere.
- Four heroic full-body goblin renders (512x768 alpha PNGs, `public/art/riders/fullbody/<id>_full.png`) were generated per rider in the painted Warcraft-fantasy style, keyed on magenta with a defringe flood-fill for off-white side bars, and stand on the bottom edge of their box.
- Three standalone high-detail ball renders (512x512, `public/art/balls/<id>-ball.png`) replace the capsule shells as the capsule's runtime sprite, hull-normalised to the same 452px diameter so the race's draw scale and collision envelope are unchanged. (The ticket's 75px `PreGame` webp balls were too small to upscale without distortion, so high-res renders were generated in their style instead; no unlock system exists yet, so the ball deck stays at the three stat-bearing capsules.)
- `NewGameSetup` step 2 is now a stage: left rider deck (portrait, name, class tag), centre lit pedestal (`CharacterShowcase`) with the full-body rider beside the ball (ground shadows, faint reflection, gleam sweep that respects reduced motion), bottom ball deck with metallic previews, right stat deck with the TICKET-02 gauges. Swaps crossfade per figure.
- In the race the ball rolls cleanly with a rider-colour rim; the rider's head crop now appears in the off-screen pointer badge.
- The Sprite Lab catalogues full-body riders, badge portraits and racing balls; `tests/art-check.mjs` (20 checks) asserts the composite is retired, both stage figures decode and swap, and the race still paints; screenshots reviewed as images.

### TICKET-09 Asset Generation Manifest — Generated

- Five Section-3 track-part assets were generated into `public/art/track-parts/` per the ticket's asset generation manifest (issue #11 comment): `mine-rails.png` (512x512 alpha, vertically tileable iron-rail/wooden-sleeper segment), `mine-gate.png` (1024x512 alpha rock-archway cavern mouth with lantern posts, skull warning signs and iron chains), `lava-sheet.png` (512x512 seamless molten lava tile with basalt crust and fire veins), `cauldron-molten.png` (512x512 alpha swinging cast-iron smelting cauldron pouring molten slag), and `stadium-gantry.png` (1024x512 alpha brass-and-iron Scrapdome finish gantry with gears, checkered victory flags and victory horns).
- Pipeline: painted in the established hand-painted goblin-mine style matching `public/art/concepts/section3-mine-rollercoaster-concept.jpg`; sprites keyed on flat magenta `#FF00FF` (the repo keying convention from `docs/ART_PIPELINE.md`) with ImageMagick, trimmed and aspect-fit onto the exact manifest canvases; the lava sheet was made seamless with a half-roll pyramid-mask blend; tileability verified with 2x2 and 2x1 tile montages inspected as images, and alpha verified with corner probes plus contrasting-backdrop flatten checks. Integration into the track renderer belongs to the TICKET-09 implementation work packages.

### TICKET-09 Extended Asset Sets — Generated

On top of the five manifest assets, three generation batches extended
`public/art/track-parts/` into a full Section-3 kit (35 sprites). All new art was
painted on flat magenta, processed by `scripts/process-track-parts.mjs` (key →
fringe-only despill → trim → aspect-fit onto the exact runtime canvas, plus per-asset
transparent/opaque pixel probes that fail the run when wrong), and verified with
green-backdrop contact sheets and tile montages inspected as images.

**Rock/wall cutouts that frame track sections as tunnels or walls** (composited
corridor mock verified):
- `rock-tunnel-frame-a/b/c.png` 1024x1024 alpha — full-slab rock walls with a clean
  keyhole tunnel opening punched through (a/b brown rock with timber shoring, c dark
  rock veined with blue-green crystals); layer over a section to frame it as a tunnel mouth.
- `rock-ceiling-cutout.png` 1024x512 alpha — top-anchored stalactite ceiling strip.
- `rock-floor-ledge.png` 1024x512 alpha — bottom-anchored rocky floor strip.
- `rock-wall-left.png` / `rock-wall-right.png` 512x1024 alpha — edge-anchored cavern
  wall panels for framing a corridor from the sides.
- `rock-boulder-a/b.png` 512x512 alpha — standalone boulder clusters to place under
  platforms or along track edges.

**Platforms that sit on rocks with cheering goblins** (five variations):
- `goblin-bleacher-a/b.png` 1024x512 — boulder-base platforms with wooden bleachers,
  flag-waving crowds, drums, horns and torches.
- `goblin-bleacher-c.png` 512x512 — small rock perch, three goblins with a checkered flag.
- `goblin-bleacher-d.png` 512x512 — drum podium with skull banner.
- `goblin-bleacher-e.png` 1024x512 — broad two-row terrace carved into a cavern wall.

**Variant sets B and C of the five manifest assets** (multiple sets as requested):
- `mine-rails-b/c.png` 512x512 alpha, vertically tileable (rope-lashed weathered
  sleepers / blackened ember-cracked rails); vertical 2-tile montages verified.
- `mine-gate-b/c.png` 1024x512 alpha (low wide mushroom-lit mouth / crystal cavern mouth).
- `lava-sheet-b/c.png` 512x512 seamless (golden-veined / spectral emerald slag), made
  seamless with the half-roll cosine-mask blend; 2x2 montages verified seam-free.
- `cauldron-molten-b/c.png` 512x512 alpha (chain-hung pouring / boiling tripod cauldron).
- `stadium-gantry-b/c.png` 1024x512 alpha (stone towers with goblin walkway / night
  floodlights and fireworks).

**Section-3 hazards and dressing:** `rail-switch.png` (forking rails with lever),
`ore-cart.png`, `ore-bucket.png` (chain-hung swinging bucket), `tnt-crate.png`,
`lantern-post.png`, and `waterfall-curtain.png` 512x1024 alpha (translucent cascade
for the breakthrough moment).

Renderer integration of all track-parts remains part of the TICKET-09 implementation
work packages; this deliverable is the asset library plus the reproducible processing
script.

### Decoration Prop Variations (Batch 1 — 10 Variations with Magenta Key Transparency)

Generated 10 variations of roadside and track decoration props based on the original props (`lantern-post`, `ore-cart`, `tnt-crate`, `ore-bucket`, `rail-switch`, `rock-deflector`, `cauldron-molten`, `landmark-windmill`, `landmark-pines`, and `blimp`):

1. `public/art/props/prop-01-lantern-post-triple.png` (1024x1024) — Triple-lantern timber watchpost with chains, skull emblem, and cobblestone base.
2. `public/art/props/prop-02-ore-cart-spilling.png` (1024x1024) — Tilted minecart spilling glowing magma rocks, gold ore, and embers on rails.
3. `public/art/props/prop-03-tnt-powder-kegs.png` (1024x1024) — Gunpowder keg pyramid with dynamite bundles, skull TNT stencils, and sizzling fuse.
4. `public/art/props/prop-04-smelting-crucible.png` (1024x1024) — Spiked iron smelting bucket with goblin gear crest and dripping molten gold.
5. `public/art/props/prop-05-rail-turntable-switch.png` (1024x1024) — Railway switch tracks with dual-lever control box and signal lantern.
6. `public/art/props/prop-06-crystal-rock-deflector.png` (1024x1024) — Rugged granite boulder deflector embedded with glowing amber crystal clusters.
7. `public/art/props/prop-07-tripod-cauldron-molten.png` (1024x1024) — A-frame tripod smelting cauldron pouring molten metal onto glowing coals.
8. `public/art/props/prop-08-goblin-windmill-gears.png` (912x1146) — Wooden windmill with patched sails, exposed brass cogs, and smoking chimney.
9. `public/art/props/prop-09-pine-lookout-outcrop.png` (896x1197) — Mountain pine cluster with wooden goblin scout platform, hanging lantern, and ladder.
10. `public/art/props/prop-10-scout-blimp-zeppelin.png` (1264x843) — Goblin scout airship with brass ribs, spinning propellers, and hanging gondola.

- All 10 variations generated with pure magenta `#FF00FF` chroma key background in `public/art/props/`.
- Processed into true alpha-channel sprites via `scripts/process-props.mjs` in `public/art/props/alpha/`.
- Composite 5x2 sprite sheet on magenta key background generated in `public/art/sheets/props-sheet.png`.

### Decoration Prop Variations (Batch 2 — 10 Variations with Magenta Key Transparency)

Generated an additional 10 variations of trackside and decoration props (Props 11 to 20) based on the original props (`bridge-wooden-broken`, `cliff-scaffolding`, `mine-gate`, `stadium-gantry`, `goblin-bleacher`, `rock-arch-wide`, `rock-platform-drums`, `slingshot`, `grandstand`, and `rock-platform-springboard`):

11. `public/art/props/prop-11-broken-rope-bridge.png` (1408x768) — Broken wooden suspension rope bridge with snapped planks, fraying thick hemp ropes, and bolted timber anchor posts.
12. `public/art/props/prop-12-goblin-scaffold-tower.png` (768x1376) — Rickety multi-level goblin timber watchtower with thatched roof, ladder, iron brackets, red skull flag, and lantern.
13. `public/art/props/prop-13-cavern-mine-gate.png` (1408x768) — Heavy cavern mine entrance archway with jagged stone frame, timber beams, burning iron torches, and skull keystone.
14. `public/art/props/prop-14-scrapdome-finish-gantry.png` (1408x768) — Racetrack finish line gantry arch with riveted iron trusses, brass cogs, checkered flag banner, and brass horns.
15. `public/art/props/prop-15-goblin-spectator-terrace.png` (1408x768) — Tiered wooden bleacher terrace on mossy stone outcrop with spiked railings, skull banner, and flaming brazier.
16. `public/art/props/prop-16-molten-rock-natural-arch.png` (1408x768) — Jagged basalt rock arch bridge with glowing orange lava fissures and dripping molten slag stalactites.
17. `public/art/props/prop-17-goblin-war-drums.png` (1408x768) — Giant goblin war drum with stretched hide skin, spiked bronze rims, iron brackets, skull charms, and mallets.
18. `public/art/props/prop-18-goblin-slingshot-launcher.png` (1408x768) — Heavy mechanical track slingshot catapult launcher with torsion winch, brass cog gear, and spiked anchor sled.
19. `public/art/props/prop-19-racetrack-grandstand.png` (1408x768) — Covered wooden racetrack grandstand with tiered bench seating, corrugated rusty tin roof, and festive goblin pennant bunting.
20. `public/art/props/prop-20-goblin-springboard-platform.png` (1024x1024) — Goblin springboard catapult ledge on craggy stone outcrop with torch brazier, checkered flag, and cheering goblin spectators.

- All 20 variations generated with pure magenta `#FF00FF` chroma key background in `public/art/props/`.
- Processed into true alpha-channel sprites via `scripts/process-props.mjs` in `public/art/props/alpha/`.
- Composite 5x2 sprite sheet for Batch 2 generated in `public/art/sheets/props-sheet-b.png`.
- Full composite 5x4 sprite sheet of all 20 variations generated in `public/art/sheets/props-sheet.png`.

### Decoration Prop Variations (Batch 3 — 10 Variations with Magenta Key Transparency)

Generated an additional 10 variations of trackside and decoration props (Props 21 to 30) based on the original props (`landmark-quarry`, `landmark-pasture`, `sign-sheep`, `sign-tnt`, `timber-loop`, `tunnel-mouth-stone`, `rock-platform-spire`, `waterfall-curtain`, `rock-boulder-a`, and `slingshot-downrange`):

21. `public/art/props/prop-21-quarry-excavation-crane.png` (1224x864) — Heavy timber A-frame goblin quarry crane with steam boiler, brass gears, pulleys, and suspended iron claw gripping a chiseled sandstone boulder.
22. `public/art/props/prop-22-armored-sheep-pen.png` (1502x704) — Armored goblin racing ram in a weathered wooden paddock pen with barbed wire, glowing mushroom feed trough, and horned skull gatepost.
23. `public/art/props/prop-23-hazard-sign-sheep.png` (768x1024) — Rustic timber roadside caution signpost on cobblestone base with painted yellow warning diamond depicting explosive racing sheep, wooden arrow, and lantern.
24. `public/art/props/prop-24-hazard-sign-explosives.png` (1024x1024) — Roadside hazard signpost on cobblestone base with stenciled "BOOM-TOWN TNT", red dynamite bundle, sparking fuse, and hanging skull warning plate.
25. `public/art/props/prop-25-timber-coaster-loop.png` (1024x1024) — Spiral vertical timber roller coaster loop-de-loop with heavy notched pine beams, iron tie brackets, hanging amber lanterns, and guide rails.
26. `public/art/props/prop-26-granite-tunnel-portal.png` (1024x1024) — Heavy chiseled granite mountain tunnel entrance archway with reinforced timber lintels, beast skull trophy keystone, and burning iron sconces.
27. `public/art/props/prop-27-rock-spire-lookout.png` (720x1440) — Towering jagged rock needle pinnacle with goblin lookout crow's nest, hanging brass gong, rope ladder, and fluttering pennant.
28. `public/art/props/prop-28-cavern-waterwheel-cascade.png` (720x1440) — Roaring alpine waterfall tumbling over stepped slate rocks with a heavy mossy wooden goblin waterwheel, brass scoops, and splash trough.
29. `public/art/props/prop-29-spiked-boulder-barricade.png` (1024x1024) — Cluster of rugged sandstone boulders fortified with sharpened wooden palisade spikes, chains, glowing green mushrooms, goblin shield, and war horn.
30. `public/art/props/prop-30-goblin-slingshot-downrange.png` (1024x1536) — Mechanical track slingshot catapult launcher with steam boiler, brass gear winch, and heavy timber forks viewed downrange.

- All 30 variations generated with pure magenta `#FF00FF` chroma key background in `public/art/props/`.
- Processed into true alpha-channel sprites via `scripts/process-props.mjs` in `public/art/props/alpha/`.
- Composite 5x2 sprite sheet for Batch 3 generated in `public/art/sheets/props-sheet-c.png`.
- Full composite 5x6 sprite sheet of all 30 variations generated in `public/art/sheets/props-sheet.png`.

### Decoration Prop Variations (Batch 4 — 10 Variations with Magenta Key Transparency)

Generated an additional 10 variations of seam-hiding dressing and trackside structures (Props 31 to 40) based on the original props (`grass-fringe`, `rock-floor-ledge`, `rock-boulder-b`, `wall-timber-braced`, `wall-granite-strata`, `stadium-gantry` ironwork, `goblin-bleacher-a` timberwork, and `tunnel-mouth-timber`):

31. `public/art/props/prop-31-grass-seam-fringe-wide.png` (1584x672) — Wide dense grass fringe seam patch with tall blades, clover tufts, wildflowers, dirt clumps, and pebbles.
32. `public/art/props/prop-32-mossy-embankment-skirt.png` (1584x672) — Mossy dirt embankment skirt wedge with grass lip, hanging moss sheets, exposed roots, and embedded stones.
33. `public/art/props/prop-33-rubble-gravel-seam-strip.png` (1584x672) — Loose rubble and gravel seam strip with crushed granite chunks, cracked slabs, dirt clumps, and pebbles.
34. `public/art/props/prop-34-timber-crib-retaining-wall.png` (1376x768) — Timber crib retaining wall of stacked notched logs with iron spikes, corner brackets, moss, and dirt footing.
35. `public/art/props/prop-35-granite-strata-seam-wall.png` (1376x768) — Layered granite strata seam wall with chiseled bands, iron pitons, hanging moss, ferns, and rubble footing.
36. `public/art/props/prop-36-glowcap-mushroom-thicket.png` (1376x768) — Glowing green-capped mushroom thicket cluster with mossy fallen logs, drifting spores, and ferns.
37. `public/art/props/prop-37-fern-bramble-undergrowth.png` (1376x768) — Dense fern and bramble undergrowth patch with curled fronds, thorny vines, red berries, and leaf litter.
38. `public/art/props/prop-38-scrap-iron-barricade.png` (1376x768) — Scrap-iron junk barricade of leaning riveted plates, brass gears, chains, timber posts, and warning lantern.
39. `public/art/props/prop-39-goblin-pit-canopy-tent.png` (1408x768) — Goblin pit-crew canopy tent with patched canvas awning, timber poles, tool crates, tire stack, and pennant bunting.
40. `public/art/props/prop-40-timber-arch-gate-lanterns.png` (1408x768) — Heavy timber arch gate with crossed beams, iron brackets, hanging amber lanterns, and carved skull totem.

- All 40 variations stored with pure magenta `#FF00FF` chroma key background in `public/art/props/` (the script flood-normalises the connected backdrop; Batch 1 raws were standardised from shaded to pure magenta).
- Processed into true alpha-channel sprites via `scripts/process-props.mjs` in `public/art/props/alpha/`, now with fringe unmix-despill: each boundary pixel's magenta excess `e = min(R-G, B-G)` becomes coverage `c = 1-e`, colour `(R-e,G,B-e)/c` and alpha `c`, dissolving anti-aliased fringe and baked pink rim-light into smooth neutral edges while leaving interiors bit-identical. All 40 alphas were re-processed; opaque magenta-ish remnants now measure 0–0.14% per sprite (residuals are interior paint such as glow-mushroom neon, verified on remnant maps).
- `scripts/process-props.mjs` now also rebuilds the sprite sheets automatically and documents the 7-step batch protocol in its header for the next agent.
- Composite 5x2 sprite sheet for Batch 4 generated in `public/art/sheets/props-sheet-d.png`.
- Full composite 5x8 sprite sheet of all 40 variations generated in `public/art/sheets/props-sheet.png`.
- All 10 registered in `PROP_DEFINITIONS` (`src/game/track-builder-3d.ts`): seam-hiding foliage (31, 32, 33, 36, 37), trackside walls/structures (34, 38, 40), cavern rockwork (35), stadium pit tent (39).

### Decoration Prop Variations (Batch 5 — 10 Variations with Magenta Key Transparency)

Generated an additional 10 variations of cavern and stunt dressing (Props 41 to 50) based on the original props (`lava-sheet`, `waterfall-splash-b`, `mine-rails-b`, `ore-bucket`, `goblin-bleacher-b`, `rock-wall-left`, `rock-wall-right`, `rock-ceiling-cutout`, `tnt-crate`, and `flag-checkered`):

41. `public/art/props/prop-41-molten-slag-channel.png` (1376x768) — Molten slag runnel channel with glowing lava stream, black basalt crust banks, embers, and smoke wisps.
42. `public/art/props/prop-42-waterfall-plunge-basin.png` (1408x768) — Waterfall plunge basin with foaming splash pool, falling curtain, mist, and wet mossy boulders.
43. `public/art/props/prop-43-mine-rail-buffer-junction.png` (1376x768) — Mine rail junction with forking rails, red timber buffer stop, lever, lantern, and gravel bed.
44. `public/art/props/prop-44-chain-hoist-gantry.png` (1408x768) — Timber A-frame chain hoist gantry with iron brackets, hanging chains, hook block, ore bucket, and brass pulley.
45. `public/art/props/prop-45-goblin-cheer-platform-horn.png` (1376x768) — Goblin cheer platform with railing, giant brass war horn, pennant bunting, torch, and skull decoration.
46. `public/art/props/prop-46-cavern-wall-curtain-left.png` (768x1376) — Tall cavern rock wall curtain slab with green crystal clusters, hanging moss, ferns, and iron lantern.
47. `public/art/props/prop-47-cavern-wall-curtain-right.png` (848x1264) — Tall layered slate wall curtain slab with waterfall seep, amber crystal veins, mushrooms, and piton rope.
48. `public/art/props/prop-48-stalactite-ceiling-cluster.png` (1376x768) — Stalactite cave ceiling cluster with limestone spikes, green crystals, and hanging lanterns on chains.
49. `public/art/props/prop-49-blast-crater-scorched.png` (1376x768) — Scorched TNT blast crater bowl with blackened marks, cracked rim, debris, smoke wisps, and ember cracks.
50. `public/art/props/prop-50-pennant-flag-pole-row.png` (1376x768) — Checkered racing flag pole row with three tattered flags, skull finials, rope ties, brass bells, and cobblestone footings.

- All 50 variations stored with pure magenta `#FF00FF` chroma key background in `public/art/props/`.
- Processed into true alpha-channel sprites via `scripts/process-props.mjs` in `public/art/props/alpha/` (flood-normalise + fuzz-key + unmix-despill). Batch 5 remnants measure 0–0.05% per sprite; residuals verified as interior paint (torch flame, smoke shading) on remnant maps.
- Defect fix: the prop-42 generator render carried a magenta mist blob (~24% off-key, too big for the boundary ring); it was seed flood-filled to pure magenta in the raw (1.85% of pixels, rock untouched) and re-processed — blob eliminated (0.63% → 0.004%), mist now dissolves softly. Future agents: catch these on the remnant-map inspection step and seed-fill the raw the same way.
- Composite 5x2 sprite sheet for Batch 5 generated in `public/art/sheets/props-sheet-e.png`.
- Full composite 5x10 sprite sheet of all 50 variations generated in `public/art/sheets/props-sheet.png`.
- All 10 registered in `PROP_DEFINITIONS` (`src/game/track-builder-3d.ts`): cavern/mine rockwork and rails (41, 43, 44, 46, 47, 48), trackside water/crater dressing (42, 49), stadium cheer platform and flag poles (45, 50).

### Loose Goblin Cutouts (Batch 1 — 10 Working & Cheering Goblins with Magenta Key Transparency)

Generated 10 loose full-body goblin decoration cutouts (5 cheering fans, 5 working crew) in the game's painted identity (olive skin, weathered charcoal iron, warm brass, teal shadows):

1. `public/art/goblins/goblin-01-flag-waver.png` (848x1264) — Cheering goblin waving a large checkered racing flag overhead, shouting with joy.
2. `public/art/goblins/goblin-02-war-drummer.png` (768x1376) — Goblin drummer mid-beat with two mallets over a spiked war drum strapped at the waist.
3. `public/art/goblins/goblin-03-pit-mechanic.png` (848x1264) — Pit-crew mechanic goblin with an oversized brass wrench on the shoulder, oil-stained apron, goggles.
4. `public/art/goblins/goblin-04-torchbearer.png` (848x1264) — Cheering goblin thrusting a flaming iron torch high, other fist pumped.
5. `public/art/goblins/goblin-05-ore-miner.png` (768x1376) — Miner goblin with pickaxe over shoulder, lantern helmet, ore sack and rope at belt.
6. `public/art/goblins/goblin-06-horn-blower.png` (768x1376) — Goblin blowing a giant curved brass war horn with skull engraving, cheeks puffed.
7. `public/art/goblins/goblin-07-tnt-handler.png` (848x1264) — Grinning goblin hugging a wooden crate of sparking red dynamite with skull stencil.
8. `public/art/goblins/goblin-08-track-marshal.png` (768x1376) — Track marshal goblin with crossed yellow signal flags, striped vest, brass whistle.
9. `public/art/goblins/goblin-09-blacksmith.png` (848x1264) — Burly blacksmith goblin resting a huge forging hammer on one shoulder, leather apron.
10. `public/art/goblins/goblin-10-tankard-celebrant.png` (768x1376) — Celebrating goblin raising a foaming iron tankard high, other fist pumping.

- All 10 generated with near-magenta chroma key backgrounds in `public/art/goblins/`, flood-normalised to pure `#FF00FF` by the script.
- Processed into true alpha-channel sprites via the new `scripts/process-goblins.mjs` in `public/art/goblins/alpha/` (flood-normalise + fuzz-key + unmix-despill, same protocol as `process-props.mjs`). Remnants measure 0–0.027% per sprite; residuals verified as interior glow paint (torch flame, fuse spark) on remnant maps and 2x checkerboard edge crops.
- Composite 5x2 sprite sheet for Batch 1 generated in `public/art/sheets/goblins-sheet-a.png`; full composite sheet in `public/art/sheets/goblins-sheet.png`.
- New `goblins` category added to `PropCategory` with a "Goblins & Crew" palette tab in the Track Builder; all 10 registered in `PROP_DEFINITIONS` (`src/game/track-builder-3d.ts`).
- Next agent: follow the 7-step batch protocol in the `process-goblins.mjs` header (goblins 11–20 → `goblins-sheet-b.png`, etc.), then commit to this branch and update the open goblins PR — never open a second PR.

### Loose Goblin Cutouts (Batch 2 — 10 New Roles & Group Cutouts with Magenta Key Transparency)

Generated 10 more goblin decoration cutouts (5 new single roles, 5 duo/trio groups) in the same painted identity:

11. `public/art/goblins/goblin-11-lantern-warden.png` (848x1264) — Hooded night warden holding a tall lantern pole with a glowing amber lamp, signaling.
12. `public/art/goblins/goblin-12-ball-loader.png` (848x1264) — Track worker straining to push and roll a giant riveted iron racing ball.
13. `public/art/goblins/goblin-13-bell-ringer.png` (768x1376) — Cheering goblin ringing a big brass handbell overhead, horned helmet.
14. `public/art/goblins/goblin-14-scarf-fan.png` (848x1264) — Superfan cheering with a checkered racing scarf stretched wide overhead.
15. `public/art/goblins/goblin-15-track-sweeper.png` (848x1264) — Track sweeper with a big straw broom, bandana, goggles, oil can at belt.
16. `public/art/goblins/goblin-16-rope-heave-trio.png` (1376x768) — Three goblins heaving a thick hemp slingshot rope together in unison.
17. `public/art/goblins/goblin-17-shoulder-ride-duo.png` (768x1376) — Cheering duo: goblin kid riding on a big goblin's shoulders, arms triumphantly high.
18. `public/art/goblins/goblin-18-firework-crew.png` (1408x768) — Two celebrating goblins, one waving a fizzing sparkler, the other laughing with covered ears.
19. `public/art/goblins/goblin-19-tire-carry-duo.png` (1376x768) — Two pit mechanics carrying a big spiked iron racing tire together between them.
20. `public/art/goblins/goblin-20-victory-huddle.png` (1408x768) — Three goblins in a victory huddle, middle one thrusting a golden gear trophy cup high.

- Near-magenta backdrops flood-normalised to pure `#FF00FF`; keyed via `scripts/process-goblins.mjs` into `public/art/goblins/alpha/`.
- Defect fix: the goblin-11 render carried a magenta glow disc around the lamp (~1.73% opaque-pink, too big for the boundary ring); it was seed flood-filled to pure magenta in the raw (3.79% of pixels over two passes — outer halo, then the inner transition ring — lamp glass verified still amber) and re-processed — remnant eliminated (1.73% → 0.0045%), glow now dissolves softly. Same procedure as the Batch 5 prop-42 fix.
- Remaining Batch 2 remnants: 0–0.0045% except goblin-18 at 0.118% (sparkler flash core, verified interior glow paint on the remnant map, within the 0.14% props precedent).
- Composite 5x2 sprite sheet for Batch 2 generated in `public/art/sheets/goblins-sheet-b.png`; full 5x4 sheet of all 20 in `public/art/sheets/goblins-sheet.png`.
- All 10 registered in `PROP_DEFINITIONS` under `goblins` (singles at 560px height, landscape groups at 600px height).
- Next agent: goblins 21–30 → `goblins-sheet-c.png`, then commit to this branch and update the open goblins PR — never open a second PR.

### Loose Goblin Cutouts (Batch 3 — 10 Stands & Big Cheering Crowds with Magenta Key Transparency)

Generated 10 more goblin decoration cutouts (7 crowd stands, 3 pure cheering mobs) in the same painted identity:

21. `public/art/goblins/goblin-21-grandstand-roar.png` (1376x768) — Covered timber grandstand packed with fans, checkered flags, skull banner, bunting, drums.
22. `public/art/goblins/goblin-22-drum-podium-mob.png` (1376x768) — Round war-drum podium ringed by eight dancing goblins with mallets and torch braziers.
23. `public/art/goblins/goblin-23-flag-terrace.png` (1376x768) — Timber spectator terrace with spiked railings crowded with flag-waving fans and braziers.
24. `public/art/goblins/goblin-24-torch-crowd.png` (1376x768) — Dense night crowd of twelve cheering fans thrusting flaming torches high.
25. `public/art/goblins/goblin-25-horn-riser.png` (1376x768) — Two-tier scaffold riser with three war-horn blowers and three drummers, hanging lantern.
26. `public/art/goblins/goblin-26-mosh-pit.png` (1376x768) — Rowdy circle of nine jumping fans, one crowd-surfing aloft, flying tankards and scarves.
27. `public/art/goblins/goblin-27-fence-fans.png` (1376x768) — Trackside barrier fence crowded with eleven fans leaning over, blank banner, pennants.
28. `public/art/goblins/goblin-28-cheer-tower.png` (848x1264) — Tall two-level timber cheer tower with ten fans, drummer and horn on top deck, skull flag.
29. `public/art/goblins/goblin-29-victory-stage.png` (1376x768) — Champion victory stage with three racers on a podium, trophy cup, confetti, drummers, crowd.
30. `public/art/goblins/goblin-30-fan-aisle.png` (1376x768) — Two facing rows of cheering fans forming a victory aisle with flags, tankards, torch posts.

- Near-magenta backdrops flood-normalised to pure `#FF00FF`; keyed via `scripts/process-goblins.mjs` into `public/art/goblins/alpha/`. No defects: all 10 renders passed inspection first try (complete structures, blank banners, no ground planes, no text).
- Batch 3 remnants: 0.0007–0.0217% (interior paint only), verified on remnant metrics + 1.5x checkerboard edge crops (torch flames, grandstand railings/flags) + grey contact sheet — no halos or blocks.
- Composite 5x2 sprite sheet for Batch 3 generated in `public/art/sheets/goblins-sheet-c.png`; full 5x6 sheet of all 30 in `public/art/sheets/goblins-sheet.png`.
- All 10 registered in `PROP_DEFINITIONS` under `goblins` (stands at 700px height, pure crowds at 600px, tower portrait at 650px).
- Next agent: goblins 31–40 → `goblins-sheet-d.png`, then commit to this branch and update the open goblins PR — never open a second PR.

### Animated Decorations (Batch 1 — 10 Fire & Water 4-Frame Sheets with Magenta Key Transparency)

Built 10 animated decoration twins from the shipped alpha cutouts: each source keeps its body pixel-static while its fire/water element cycles 4 frames on a 2x2 sheet (TL=f0, TR=f1, BL=f2, BR=f3 — one horizontal + one vertical centre cut yields the frames). Frames derive travelling brightness bands through an element mask (fire: R>150, R>=G, R-B>38; spark adds a pink-burst branch; water: B>150, G>110, B>=R plus a foam-white branch), rising for fire and falling for water, with a per-frame flicker lift:

1. `public/art/animated/anim-01-torchbearer-flame.png` (1032x1536, frame 516x768) — Torchbearer flame licks upward @ 7fps.
2. `public/art/animated/anim-02-firework-sparkler.png` (1536x840, frame 768x420) — Sparkler burst strobes @ 9fps.
3. `public/art/animated/anim-03-torch-crowd.png` (1536x860, frame 768x430) — Torch-crowd flames ripple @ 7fps.
4. `public/art/animated/anim-04-lantern-warden.png` (1032x1536, frame 516x768) — Lantern lamp breathes @ 6fps.
5. `public/art/animated/anim-05-smelting-crucible.png` (1536x1536, frame 768x768) — Crucible slag surface roils @ 6fps.
6. `public/art/animated/anim-06-molten-cauldron.png` (1536x1536, frame 768x768) — Cauldron pour shimmers @ 6fps.
7. `public/art/animated/anim-07-slag-channel.png` (1536x860, frame 768x430) — Slag-channel lava pulses @ 5fps.
8. `public/art/animated/anim-08-waterwheel-cascade.png` (768x1536, frame 384x768) — Cascade rushes, foam churns @ 5fps.
9. `public/art/animated/anim-09-plunge-basin.png` (1536x840, frame 768x420) — Plunge spray churns @ 5fps.
10. `public/art/animated/anim-10-waterfall-curtain.png` (768x1536, frame 384x768) — Falls sheet ripples down @ 5fps.

- Frames are flattened onto pure `#FF00FF`, sheeted 2x2, then keyed via `scripts/process-animated.mjs` (flood-normalise, 20% fuzz key, 6px unmix-despill ring — identical to `scripts/process-goblins.mjs`) into `public/art/animated/alpha/`. Review contact sheet: `public/art/animated/animated-contact-sheet.png`.
- Remnants 0.000–0.068% (anim-02's 0.068% is the pink sparkler-burst paint itself, verified interior glow — same precedent as goblin-18's 0.118%). Frame deltas verified numerically (RMSE 0.017–0.040 between frames in element zones, ~0.002 on bodies) and the contact sheet inspected as an image: no halos, no black bands, flames/lava/water vibrant.
- Runtime: `PropDefinition.isAnimated` + `animCols/Rows/Fps`, `PlacedProp.animate` (default true), per-prop cloned textures showing one quadrant (`repeat` 1/cols × 1/rows, row-major UVs), `TrackBuilder3D.updateAnimations()` driven by the race loop (`Renderer3D.render`, frozen on frame 0 under reduced motion) and a gated 120ms editor preview tick. Twins desync via id-hash phase.
- Build menu: new `Animated` category tab (Clapperboard icon), `4-FRAME` badge on palette cards (cards preview the full sheet), `Animate` toggle in the single-select attribute window (ON/Playing vs OFF/Frame 1) plus an All PLAY/All PAUSE batch row for multi-select.
- All 10 registered in `PROP_DEFINITIONS` under `animated`, mirroring their source twins' world sizes.
- Tests: `tests/animated-props.test.ts` (15 checks: frame math, UVs, registry, sheet files + even dims, headless playback/freeze/batch/static paths), registered in `scripts/check.mjs`. `npm run check` 435/435 green; `npm run build` green.
- Next agent: anim 11–20 → append to `ANIMATED_VARIATIONS`, run the script, register under `animated`, then commit to this branch and update the open animated-decorations PR — never open a second PR.

### Animated Decorations (Batch 2 — 10 More Fire & Splash-Water 4-Frame Sheets)

Built 10 more animated twins with the same masked travelling-band pipeline (`scripts/process-animated.mjs`, unchanged algorithm — Batch 2 only appends entries):

11. `public/art/animated/anim-11-tnt-fuse-spark.png` (1032x1536, frame 516x768) — TNT-handler fuse spark strobes @ 9fps.
12. `public/art/animated/anim-12-drum-podium-braziers.png` (1536x860, frame 768x430) — Podium torch braziers flicker @ 7fps.
13. `public/art/animated/anim-13-horn-riser-lantern.png` (1536x860, frame 768x430) — Riser lantern breathes @ 6fps.
14. `public/art/animated/anim-14-fan-aisle-torches.png` (1536x860, frame 768x430) — Aisle torch posts ripple @ 7fps.
15. `public/art/animated/anim-15-triple-lantern-post.png` (1536x1536, frame 768x768) — Lantern-post lamps breathe @ 6fps.
16. `public/art/animated/anim-16-molten-rock-arch.png` (1536x840, frame 768x420) — Arch lava veins pulse @ 5fps.
17. `public/art/animated/anim-17-arch-gate-lanterns.png` (1536x840, frame 768x420) — Gate lanterns breathe @ 6fps.
18. `public/art/animated/anim-18-torch-sconce.png` (1536x1536, frame 768x768) — Wall sconce flame licks @ 7fps.
19. `public/art/animated/anim-19-waterfall-splash.png` (1024x1024, frame 512x512) — Splash burst churns @ 6fps.
20. `public/art/animated/anim-20-waterfall-splash-b.png` (1024x1024, frame 512x512) — Splash burst variant churns @ 6fps.

- Candidate masks probed before building (fire cover 2.6–8.6%, water 25.9–27.1% on the splashes); fully-opaque track-parts (`lava-sheet*`, `waterfall-sheet`) were skipped — the script requires real source transparency.
- Remnants 0.000–0.073%: anim-17's 0.073% is interior lantern-glow paint (zero edge-touching remnant pixels on the edge-overlap check — same precedent as anim-02's 0.068% / goblin-18's 0.118%).
- Frame deltas verified numerically on the keyed sheets (whole-quadrant RMSE f0–f1 / f0–f2: anim-11 0.015/0.021, anim-16 0.012/0.017, anim-17 0.009/0.013, anim-19 0.034/0.047 — clearly visible motion, bodies static).
- Reproducibility: re-running the script rebuilds Batch 1 sheets pixel-identical (RMSE=0 vs committed), so the Batch 1 raw files were left untouched — only metadata bytes differ. Contact sheet is now 5x4 (`animated-contact-sheet.png`, 1960x1568).
- All 10 registered in `PROP_DEFINITIONS` under `animated`, mirroring static-twin world sizes (anim-19/20 mirror `waterfall_splash` at 650x450); the Animated palette tab, 4-FRAME badges, Animate toggle and batch PLAY/PAUSE pick them up automatically. Test count bumped 10 → 20.

### Animated Decorations (Batch 1 Rebuild — 10 AI-Generated Sheets Replacing the Travelling-Band Frames)

The Batch 1/2 frames were derived by pushing travelling brightness bands through an
element mask. That produced four near-identical frames (RMSE between frames ≈ 0.015) —
technically a spritesheet, visually a still image. Batch 1 (anim 01–10) has been rebuilt
with the image generator; **anim 11–20 still ship the old band frames and are next.**

New pipeline (`scripts/`, all vision-free so it is verifiable without eyeballing art):

1. `scripts/build-anim-reference.mjs` — builds a 2x2 template (four copies of the still
   art on magenta, wide gutters) for every `ANIMATED_SOURCE` entry. Handing the model a
   sheet that already has the layout is what fixed the slicing: asking it to *invent* a
   2x2 grid made it fill the canvas, so the centre cut sliced the subject.
2. Generate with that template; raw output lands in `art-src/animated/<name>-src.png`.
3. `scripts/analyze-animated-sheets.mjs` — QA gate. Reports the magenta fraction of the
   exact cut lines (layout), per-quadrant coverage, and RMSE between consecutive frames
   (motion). `STATIC` (< 0.045) or `LAYOUT` (< 97% clean cut) = regenerate.
4. `scripts/process-generated-animated.mjs` — production build:
   - detects the panel grid from the magenta gutters (handles 2x2 and the 4x2 the model
     sometimes returns; merges gutters broken by splashes),
   - shaves 4px off gutter-adjacent edges so separator lines never enter a frame,
   - crops all four panels to the **union** of their content boxes so the subject is
     framed identically in every frame (no loop jitter),
   - pads the frame to the still artwork's aspect ratio, then runs the standard key
     pipeline (flood-normalise, 20% fuzz key, 6px unmix-despill) into
     `public/art/animated/alpha/`, refusing sheets whose backdrop is not magenta.

Rebuilt sheets (frame size, aspect matches the still art exactly):

| sheet | frame | fps | min frame Δ | remnant |
|---|---|---|---|---|
| anim-01 torchbearer flame | 328x488 | 7 | 0.270 | 0.000% |
| anim-02 firework sparkler | 918x500 | 9 | 0.133 | 0.012% |
| anim-03 torch crowd | 534x298 | 7 | 0.128 | 0.021% |
| anim-04 lantern warden | 298x444 | 6 | 0.266 | 0.042% |
| anim-05 smelting crucible | 482x482 | 6 | 0.183 | 0.002% |
| anim-06 molten cauldron | 340x340 | 6 | 0.217 | 0.000% |
| anim-07 slag channel | 950x530 | 5 | 0.073 | 0.000% |
| anim-08 waterwheel cascade | 330x660 | 5 | 0.259 | 0.040% |
| anim-09 plunge basin | 810x442 | 5 | 0.109 | 0.015% |
| anim-10 waterfall curtain | 494x986 | 5 | 0.148 | 0.004% |

Frame Δ is RMSE between consecutive frames; the replaced band frames sat at ≈0.015.

**anim 11–20 rebuilt** (the same ten sheets that shipped as band frames):

| sheet | frame | min frame Δ | remnant | source |
|---|---|---|---|---|
| anim-11 tnt fuse spark | 348x520 | 0.196 | 0.083% | 4x2 |
| anim-12 drum podium braziers | 634x354 | 0.146 | 0.163% | 2x2 |
| anim-13 horn riser lantern | 504x282 | 0.109 | 0.061% | 2x2 |
| anim-14 fan aisle torches | 530x296 | 0.139 | 0.004% | 4x2 |
| anim-15 triple lantern post | 454x454 | 0.105 | 0.024% | 2x2 |
| anim-16 molten rock arch | 600x328 | 0.125 | 0.000% | 2x2 |
| anim-17 arch gate lanterns | 476x260 | 0.156 | 0.032% | 2x2 |
| anim-18 torch sconce | 454x454 | 0.130 | 0.214% | 2x2 |
| anim-19 waterfall splash | 500x500 | 0.165 | 0.000% | 2x2 |
| anim-20 waterfall splash b | 446x446 | 0.155 | 0.004% | 2x2 |

All 20 sheets were additionally checked **pairwise** (all six frame pairs, not just
consecutive ones) so a duplicated pair cannot hide behind a healthy consecutive
delta — every sheet's minimum pair is 0.079–0.242.

`anim-14` and `anim-06` come back from the model as a **4x2** grid (eight panels)
rather than 2x2. The pipeline's `pickCuts()` detects the four evenly spaced
columns and salvages them; both were confirmed to hold four *distinct* frames
rather than a repeated pair, so neither needs regenerating. `anim-14` does trip
the `LAYOUT` gate in `scripts/analyze-animated-sheets.mjs` (96.6% clean cut) —
that gate assumes a 2x2 layout and reads the centre cut, which on a genuine 4x2
lands inside a panel, so the flag is expected there. Judge a 4x2 sheet on the
pairwise check and the shipped sheet instead.

`anim-19`'s alpha/content gap (0.082) is its bright foam reading as near-white,
not an opaque backdrop — its raw sheet is 65% magenta with the whites belonging
to the splash itself. Same check that caught the old `anim-05` white-studio
background.

### Frame registration — why the sheets used to look like they jumped

The first rebuilt sheets passed every gate that existed (clean cut, four distinct
frames, magenta backdrop) and still looked wrong in play. Two causes, neither of
which a frame-delta check can see:

1. **The union-bbox crop normalises the frame, not the subject.** When an
   animated element is drawn much larger in one panel than the others, the union
   box grows to fit it and every other frame's subject ends up looking smaller
   inside that box. The sprite appears to swell and shrink as it loops.
2. **Aligning centroids is not aligning outlines.** Registering on the body's
   centre of mass can be spot-on while the body around it sits several pixels
   out, whenever the common silhouette is small and off-centre.

Both are now fixed in `scripts/process-generated-animated.mjs`:

- **`registerFrames()`** stages the four panels on a padded canvas and aligns
  them on their **common silhouette** — the pixels opaque in *every* frame, i.e.
  the static body. A coarse pass aligns each frame's own centroid, then a
  refinement pass aligns the common silhouette, then a final cross-correlation
  pass searches ±8px and keeps whichever shift maximises silhouette overlap
  against frame 1. The body holds still; only the element moves.
- The generated prompts now also demand that the animated element keep a
  **consistent size across all four panels**, which is what stops the swelling.

**`scripts/onion-skin-check.mjs`** is the verification. For every sheet it
cross-correlates each consecutive pair and reports:

- `maxShift` — the largest shift that would align a pair better than zero shift
  does. Gated at 6px, but **only when shifting actually helps** (`gain` > 0.02):
  on a sheet whose element changes shape completely the correlator can always
  find some far-off shift that wins by a hair, which is noise, not
  misregistration.
- `fillSpread` — the ratio between the largest and smallest per-frame subject
  area. Gated at 1.6x; this is the number that catches the swelling.

It also writes an onion-skin overlay per sheet to
`art-src/animated/onion/<name>.png` — all four frames stacked, frame 1 white and
frames 2–4 tinted, so misalignment shows up as coloured fringing around the
silhouette and a size pop as a coloured halo.

Results after the fix: `maxShift` is **0.0px on 18 of 20 sheets** (the two
exceptions, anim-14 and anim-20, have zero overlap gain — noise), and
`fillSpread` is **1.04–1.37x** across all twenty, down from 1.10–2.15x.

### The STATIC gate had to be re-based

Once the bodies were registered, the plain whole-frame delta dropped on every
sheet — a perfectly registered sheet differs only where the element animates, so
the old `MIN_FRAME_DELTA` of 0.045 started failing sheets that were animating
perfectly well (anim-04 fell to 0.041, anim-15 to 0.033). The gate now measures
an **animation-only delta**: pixels are classed as the static body when they are
opaque in all four frames, and only the remaining element pixels are compared,
normalised over the element's own area. Element deltas are now 0.120–0.515,
versus ~0.015 for the band frames these replace.

Animated sheets are no longer a separate island: every sheet is wired to the still
decoration it was cut from.

- `ANIMATED_SOURCE_ART` (in `src/game/track-builder-3d.ts`) maps each animated type to
  the still art it came from; `linkAnimatedTwins()` runs at module load and sets
  `stillType` / `animatedTwin` on both sides. 19 of 20 link up; `anim_20` (source art has
  no still decoration) stays animated-only. Powerups/barriers that merely reuse prop art
  never claim a twin (test-enforced).
- **Animated toggle on the still version**: selecting a still decoration with a twin shows
  an *Animation* panel with an `ANIMATED / STILL` swap button — flipping it swaps the prop
  over to the 4-frame sheet in place, keeping its position, size and rotation. Frames are
  padded to the still art's aspect, so the swap is a like-for-like (no squash).
- **Speed −/+**: per-prop multiplier (`animSpeed`, 0.25–4.00 in 0.25 steps, with a RESET),
  displayed as effective fps. Group selection nudges every selected prop at once.
- **4 frame checkboxes**: `animFrames[4]`; unchecked frames are skipped by the loop rather
  than shown as blank holds. At least one frame is always kept, and a paused prop holds
  its first *enabled* frame.
- Palette cards for still decorations with a twin carry an `ANIM` badge; animated-category
  cards keep the `4-FRAME` badge and now show which still decoration they came from.
- State lives on `PlacedProp` (`animated`, `animSpeed`, `animFrames`), so it round-trips
  through save/load, undo/redo and duplication.
- Tests: `tests/animated-props.test.ts` grew 15 → 29 checks (twin links, aspect parity,
  frame skipping, speed, persistence, batch controls). `npm run check` 449/449 green;
  `npm run build` green.
- **All 20 fire/water sheets now carry real motion, and they are registered so the body holds still across the loop.** See "Frame registration" above.

### Animated Goblins (anim 21–28 — first batch of character animations)

The 30 goblin cutouts were stills only. Ten reference templates were built and
the first eight characters have been animated, each wired to its still twin the
same way the fire/water sheets are:

| sheet | still twin | frame | fps | min element Δ | remnant |
|---|---|---|---|---|---|
| anim-21 flag waver | goblin-01-flag-waver | 358x534 | 8 | 0.471 | 0.001% |
| anim-22 war drummer | goblin-02-war-drummer | 272x488 | 9 | 0.137 | 0.001% |
| anim-23 pit mechanic | goblin-03-pit-mechanic | 510x760 | 8 | 0.340 | 0.019% |
| anim-24 ore miner | goblin-05-ore-miner | 510x914 | 6 | 0.414 | 0.002% |
| anim-25 horn blower | goblin-06-horn-blower | 340x608 | 6 | 0.224 | 0.020% |
| anim-26 track marshal | goblin-08-track-marshal | 426x764 | 8 | 0.500 | 0.001% |
| anim-27 blacksmith | goblin-09-blacksmith | 500x744 | 9 | 0.339 | 0.024% |
| anim-28 tankard celebrant | goblin-10-tankard-celebrant | 298x532 | 6 | 0.334 | 0.000% |
| anim-29 ball loader | goblin-12-ball-loader | 408x608 | 7 | 0.475 | 0.087% |
| anim-30 bell ringer | goblin-13-bell-ringer | 486x870 | 7 | 0.340 | 0.004% |

The prompts carry the same two constraints that fixed the fire/water sheets:
the body must stay put and the same size in every panel, and the animated
element must keep a consistent size across panels.

**All ten goblins now pass both gates.** Full results across all 30 sheets:
`maxShift` is 0.0px on 24 of 30 (the six exceptions have zero overlap gain, so
they are correlator noise rather than misregistration), and `fillSpread` is
1.04-1.51x everywhere.

`anim-25-horn-blower` took three attempts. The sound rings are exactly the kind
of element a model scales freely: the first sheet came back at `fillSpread`
1.67x, the second at 1.95x (worse), and the third - after rewriting the prompt to
lead with "trace the goblin once and reuse that tracing in all four panels" -
landed at 1.34x. **The lesson for future prompts: state the size constraint as
reusing one tracing, not as "keep the same size", which the model reads as
advice.**

The prompts carry the same two constraints that fixed the fire/water sheets: the
body must stay put and the same size in every panel, and the animated element
must keep a consistent size across panels. Seven of the eight come back at
`maxShift` 0.0–2.2px and `fillSpread` 1.10–1.29x.

**Still to animate:** goblin-14, 15, 16, 17, 19, 20, 21, 23, 26, 27, 28, 29 —
twelve more characters. After those: explosion sprites and general-play sprites.

The registry test no longer hardcodes a sheet count (`exactly 20 animated
decorations` and `19 of the 20 sheets have a still counterpart`); it now derives
both from the sheets on disk and from `ANIMATED_SOURCE_ART`, so a new batch
cannot fail a green build on a stale literal.
  sheets into `art-src/animated/`, then `scripts/analyze-animated-sheets.mjs --all`
  (regenerate any `STATIC`/`LAYOUT` rows) and `scripts/process-generated-animated.mjs`.

## Verification Boundary

Production compilation is verified (`npm run build` / the provided build tool). Type-checking and 18 focused persistence tests are verified locally via `node scripts/check.mjs`. Scripted headless-Chromium runs are verified: 21 recovery checks via `npm run check:browser` and 20 art checks via `npm run check:art` (the art suite also runs against the live dev server with `node tests/art-check.mjs <url>`), with screenshots and the alpha montages left in `tests/artifacts/` — those images were inspected by the agent, so the art is verified as *decoded and drawn*, not merely built. Not verified: frame pacing on real desktop/mobile hardware, long-run stability, empirical race/loadout/course balance, and accessibility certification. Do not represent compilation, type-checking, unit tests or a scripted browser pass as measured FPS, playtesting, accessibility certification or tournament balance.