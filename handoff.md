# Goblin Rally (Heavy Metal GP 2): Project Status And Codex Handoff

> [!IMPORTANT]
> **Predecessor Assets & Image Quota Policy**:
> - You can find all files from predecessor game "Heavy Metal 1" in the [`PreGame/`](file:///c:/MarbleGp/PreGame) folder (`PreGame/assets/`, `PreGame/src/assets/`). You are **strongly encouraged** to use existing PNG/WebP assets from there (e.g. `ball-*.webp`, `bumper-*.webp`, `spring.webp`, `strip-*.webp`, `uikit.png`, `repeatingBG.png`) to style and extend the game.
> - **Image Generation Quota**: You can only generate **10 images per turn** before your quota needs to be reset. To reset them, simply say **"Reset please"** and stop working; the user will reply with "turns reset", and you can continue with 10 more calls.

## Latest User Direction & Actionable Ticket Suite

The user reviewed live gameplay and screenshots (Screenshots 1-5) and requested a major aesthetic and gameplay upgrade to make the game exciting, tactile, and immersive. A comprehensive 9-ticket suite has been created under [`docs/tickets/`](file:///c:/MarbleGp/docs/tickets/README.md):

1. [`TICKET-01`: Blizzard/Warcraft Ornate UI Frame & Border System](file:///c:/MarbleGp/docs/tickets/TICKET-01-warcraft-ornate-ui-borders.md)
   - Redo modal & card UI with ornate metallic/carved borders using non-stretching 9-slice framing and `#00FF00` key transparency.
2. [`TICKET-02`: UI Decluttering, Visual Gauges & Hierarchical Drill-Downs](file:///c:/MarbleGp/docs/tickets/TICKET-02-ui-declutter-gauges-drawers.md)
   - Strip text walls, replace stats with circular/arc gauges, and hide lore/specs in collapsible info drawers.
3. [`TICKET-03`: Customizable Controls & Loading Screen Controls Visualizer](file:///c:/MarbleGp/docs/tickets/TICKET-03-custom-controls-loading-screen.md)
   - Add Controls remapping in Settings; display mapped controls on the loading screen before entering the grid.
4. [`TICKET-04`: Character & Ball Selection Redesign (Full-Body Goblin + Ball Renders)](file:///c:/MarbleGp/docs/tickets/TICKET-04-character-ball-selection-full-body.md)
   - Eliminate the "broken inside looking out" cockpit hole. Render full-body goblins standing proudly beside high-gloss standalone balls.
5. [`TICKET-05`: Menu Overhaul with Animated Painted Fantasy Backdrops](file:///c:/MarbleGp/docs/tickets/TICKET-05-menu-animated-backgrounds.md)
   - Big painted 1920x1080 fantasy environments for all menus with subtle embers, smoke, and lantern flicker.
6. [`TICKET-06`: Epic Blizzard Track Backdrops, Thematic Lighting & Asset Preloading](file:///c:/MarbleGp/docs/tickets/TICKET-06-track-backgrounds-lighting-preloading.md)
   - Hand-painted multi-layer skyboxes for all tracks, distinct lighting/mood per course, and async preloader.
7. [`TICKET-07`: Dynamic Ball Camera Tracking, Off-Screen Indicator & Airborne Lane Ground Decal](file:///c:/MarbleGp/docs/tickets/TICKET-07-camera-pointer-ground-decal.md)
   - Follow-ball camera mode, off-screen HUD pointer arrow, and expanding circular ground decal/shadow for airborne lane alignment.
8. [`TICKET-08`: Multi-Section Track Expansion Part 1: Vertical Pinball Drop, Pegs & Waterfalls](file:///c:/MarbleGp/docs/tickets/TICKET-08-track-section2-vertical-pinball-drop.md)
   - Extend downhill into Stage 2: vertical cliff drop with pinball bumpers, springs, ramps, loops, fire rings, and waterfall switchbacks.
9. [`TICKET-09`: Multi-Section Track Expansion Part 2: Mine Tunnels, Rails & Stadium Finale](file:///c:/MarbleGp/docs/tickets/TICKET-09-track-section3-mine-tunnels-waterfall-finish.md)
   - Stage 3 subterranean minecart rails, cave lighting, and waterfall breakthrough into the final stadium sprint.


## Copy-Paste Prompt For The Next Codex Agent

You are taking over Goblin Rally, an existing React/TypeScript/Vite browser game. Read `handoff.md`, `docs/EXPANSION_PROGRESS.md`, `docs/PERSISTENCE.md`, `docs/GAME_DESIGN.md`, `docs/LOADOUT_BALANCE.md`, and `docs/WORLD_AND_POWERUPS.md`, then inspect the relevant implementation. Continue the existing game, not a replacement mockup.

Sections 1-3 and Section 4 Parts 4.1 and 4.2 are implemented. The user wants the final Section 4 divided into FOUR parts, completed ONE AT A TIME. Part 4.3 (Results, Cup Completion, And Progression Polish) has NOT begun: await the user's prompt before starting it, and stop after it is implemented, documented and built.

Preserve the current original Warcraft-inspired fantasy identity: chunky painted goblins, iron/brass machinery, muted dirt roads, readable silhouettes, and a green-iron/gold/crimson game UI. Do not use Blizzard logos, proprietary characters, or imply affiliation. Preserve the researched clarity/accessibility principles. This is a full game, not a marketing website.

Protect the optimized renderer. Do not reintroduce per-frame mesh construction, image generation, expensive filters, or camera-triggered atlas rebaking. New art must be loaded and decoded before racing and reused. Retain fixed 120 Hz physics and interpolated rendering, four lane-aware racers, CPU opponents, physical side bumps, terrain-specific elevation, and the menu's ability to pause a race without losing it.

Use tools for file operations. Use `apply_patch` for source changes. Do not directly edit `package.json` or `vite.config.ts`; install dependencies with the package tool if needed. Use the provided `build_project` tool for the production build after each implementation installment. Research unfamiliar APIs before integrating them. If browser/test tools are available in your environment, use them to actually play and profile the game. Report exactly what was and was not verified; a successful build is not proof of FPS, gameplay balance, or accessibility compliance.

### Part 4.1: Durable Events And Recovery

Implement versioned, validated, non-destructive tournament/session persistence. Save the selected event, fixed roster/loadout, difficulty, committed results, current round, and phase. Preserve settings and historical records. Hydrate a coherent Continue Tournament/View Results flow after reload. Persist round commits atomically and idempotently. Never duplicate points or records, skip an unfinished round, replay an already committed round as unscored gameplay, or replace an event without confirmation.

Minimum reliable recovery contract: completed rounds and cup standings survive reload; an interrupted active round resumes at that round's starting grid with an explicit message that the unfinished round restarts. Exact mid-race recovery is optional only if implemented with a complete validated engine snapshot; never pretend session metadata restores live physics. A full snapshot would need all racer kinematics/resources, AI timers, visited obstacle IDs, shared obstacle/pickup state, shields, finish states/times, RNG state, clock, and camera state. Round-boundary recovery is safer than a half-working snapshot.

Use an explicit persisted phase such as `setup`, `grid`, `racing`, `round-results`, and `cup-results`; avoid using the presence of a React component or `results.length` alone to decide hydration. Handle storage denied/full, invalid JSON, unsupported schema versions, out-of-range round indices, missing/duplicate racer IDs, impossible course order, malformed loadouts, and mismatched result session IDs. The current code can create a fresh live engine even when passed a completed result; fix that before enabling persisted hydration. Add focused tests if tooling permits. Document the save contract and migrations. Do not start the PNG replacement work in this part; prepare an art inventory/manifest plan if useful.

### Part 4.2: Original PNG Art Pass And Asset Integration

Generate new cohesive high-quality raster artwork using the available image tool. Replace current SVG character/vehicle/pickup/track-preview art in actual selection screens and races. Follow the detailed art brief below. Create a typed asset manifest, decode/crop metadata, robust load errors, and genuinely alpha-transparent PNGs. Keep a fallback until all replacements work. Bake composite rider/capsule/race-color variants once, not each frame. Do not compromise perspective, dirt readability, or the four-sling starting grid. Update credits and the sprite lab so downloads match the art actually used in the game. Verify on both dark and light checkerboards and at actual HUD/race size. Stop after this installment.

### Part 4.3: Results, Cup Completion, And Progression Polish

Evolve the existing functional results into a cohesive dedicated race/cup flow. Show actual finishing order, times or explicit DNF, pickup/shield/bump stats, the chosen rider/capsule, round points, accumulated cup points, and a clear next action. Add a podium/trophy presentation using Part 4.2 art, short skippable or reduced-motion-safe sequences, and honest tie handling. Provide Next Race, Rematch, New Setup, Main Menu, and abandon confirmation where appropriate. Preserve the same roster/loadout across a cup. Separate practice results from competitive preset records. Add persistent cup history and optional cosmetic achievements without performance upgrades or grind. Ensure event restoration lands on the correct results screen. Stop after this installment.

### Part 4.4: Empirical Balance, End-To-End QA, Performance, And Release

Run the complete matrix of rider/capsule/course/difficulty tests and real playtests. Test the menu, keyboard/touch navigation, setup, start grid, lane changes, bump boundaries, hops, boosts, loops, falls/recovery, airborne supply arbitration, shield expiry/consumption, pause, fullscreen, main-menu resume, persisted reload recovery, all three tournament rounds, ties/DNFs, replay, and corrupt storage. Measure frame pacing on desktop/mobile and long runs. Tune based on measured finish times, DNF rates, pickup reachability, and win rates, not just the equal rating budget. Keep AI difficulty based on decisions, not hidden speed cheats. Add a deterministic simulation/test harness if practical. Finish docs, controls/help/credits, build verification, and a candid release status.

## Current Project Status

### Implemented Section 1

- Full-screen fantasy main menu with original concept art, engraved-style `Cinzel` typography, gold/brass framing, green-iron secondary buttons, crimson primary action, and optional slow CSS motion.
- New Game, contextual Resume/View Results, Settings, How to Play, Hall of Chaos, credits/research links, mute, and fullscreen.
- Display/audio/accessibility settings: Auto/Performance/High-detail rendering, volume and sound test, menu motion, reduced motion, contrast, camera view, parallax, and launch trajectory.
- Keyboard navigation and focus-trapped dialogs. Settings and completed records survive local-storage failures gracefully.
- Race is retained in memory when returning to the menu; simulation/render work is suspended when inactive.

### Implemented Section 2

- Three-step setup: Competition, Rider & Capsule, Race Rules.
- Quick Race on one course, or three-round Scrapdome Cup on `ridge`, `boomtown`, and `sheep`.
- Four riders: Rivet/mechanic, Nix/daredevil, Grub/bruiser, Sprocket/rocket jockey.
- Three capsules: Rustbucket (`iron`), Springsteel (`springsteel`), Siegebreaker (`siege`). Twelve combinations.
- Each combination has a shared 24-point budget across Launch, Handling, Boost, Stability. Stats drive actual speed, mass, steering, impulses, maximum speed, and bump recovery. CPUs use the same functions.
- Rookie/Racer/Veteran adjusts AI decisions, not a hidden physics advantage.
- Presets lock for races/cups; Quick Race custom practice alone enables live speed and weight sliders.
- Cup points 9/6/3/1, DNF zero. Rivals have a real 10-second finish window after the player finishes. Ties use wins, then final-round place, then racer ID as a deterministic last fallback.
- Basic race/round/final-cup tables, continuation, rematches, and in-memory cup state exist. Session/round/course guards prevent double commits.

### Implemented Section 3

- Three distinct 15 km downhill dirt courses, with separate elevation profiles, sector names, obstacle rhythms, palettes, landmarks, and stadium identities.
- Rustbucket Ridge: Copperwood Valley, flowing ochre dirt, pines, Scrapdome finish.
- Boomtown Run: Brass Quarries, red canyon/mesa scenery, steeper bursts and more TNT, Blast Furnace finish.
- Woolly Wasteland: Woolwind Downs, pasture hills, lighter dirt, sheep/springs and single-lane gaps, Woolly Coliseum finish.
- Four 240-unit lanes (960 total); camera zoom is 0.86. Inverse pointer projection and cached atlas reference scaling match.
- Four loaded rear-view rubber-band slingshots, one player in lane 3 and three CPUs. A/D or touch arrows steer; mass-weighted bumps shove racers sideways. Falls cause a recovery penalty, not immediate game over.
- W/J bunny hop, Space air bounce, Shift boost. All capsules visibly rotate.
- Cached blimps and regional landmarks. Blimps are background scenery, not collision hazards.
- Air supplies: Rocket Fuel (+1 boost and small surge), Skyward Shield (one rival shove or six seconds), Air Spring (+1 air bounce). Capped charges, one-use shared objects, earliest swept collision claims, same CPU rules.
- Shield ring/timer/break effect, pickup icons/counts, handbook explanations, and result counters.
- Full-depth visibility bounds and extra off-screen tiles address the earlier right-edge scenery pop-in.

### Implemented Section 4 Part 4.1

- Versioned durable event save (`goblin-rally-session-v1` + backup slot) with an explicit persisted phase (`setup`, `grid`, `racing`, `round-results`, `cup-results`). Reload hydrates the menu with Continue Tournament / View Round Results / View Cup Results as appropriate.
- Atomic and idempotent round commits; duplicate, mismatched or out-of-range records are dropped with a report, and `mergeRunRecord` replaces rather than appends per `sessionId:round`.
- Interrupted rounds restart at that round's grid with an explicit message; an earlier unfinished round is never skipped, and later committed results are preserved without double-scoring.
- Corrupt primary falls back to the last valid backup; unsupported future schema versions are left untouched; denied/full storage is reported in the menu and race header.
- The race screen builds no live engine for an already-committed round, so a restored result cannot be replayed for unscored points.
- `node scripts/check.mjs` = `tsc --noEmit` + 18 focused tests (`tests/session-save.test.ts`, TAP artifact under `tests/artifacts/`). Round-boundary recovery only: no engine snapshot, and the UI says as much.

### Implemented Section 4 Part 4.2

- Eight source sheets in `public/art/sheets/` (capsules, landmarks, blimp, courses, three individual supplies, and the predecessor project's portrait sheet copied to `riders-source.png`) produce 18 runtime PNGs in `public/art/`: four 512² rider portraits with four 256² pilot busts, three 512² capsule shells, three 256² supply icons, four landmarks, a 900x576 blimp and three 800x440 course previews. All alpha sprites are true RGBA.
- `scripts/build-art.mjs` does all pixel work at build time: per-cell border matte detection (magenta `#FF00FF` preferred — the subjects are green — with `#00FF00` still supported), fringe-only despill that clamps just the matte channels so olive skin and mint springs survive, `-shave 6x6` per cell so painted dividers cannot join a subject, largest-component hull trimming, and normalisation of every shell hull to 452 px on a 512 px canvas.
- The seat is the shell's ringed port, measured from the artwork on every build (`measureHatch()`: largest near-black opaque blob in the lower-right quadrant, fitted to an ellipse inset by 0.92) and stored with `rx`/`ry`/`radius`/`measured` — iron 0.806,0.613 rx 0.089 ry 0.127; springsteel 0.804,0.613 rx 0.079 ry 0.125; siege 0.800,0.605 rx 0.082 ry 0.125. The pilot bust is drawn **square** at `2.4 * min(rx, ry)` with its eye line on the window centre and clipped to 99% of the ellipse, in menus (`RacerFigure`), in the baked race capsule (`prepareRaceCapsules`, 192², cached per roster) and in the preload path. The earlier hand-pinned ellipse (0.82/0.61) was offset and undersized against the art and the `3.4 * rx` by `3.4 * ry` box stretched the face, so the goblin clipped over the brass ring: that was the "portrait renders outside / overlapping the capsule" screenshot defect, now covered by checks on the port centre, the square box and the bust's alpha box. The eye line is per rider (Rivet 0.44, Nix 0.44, Grub 0.52, Sprocket 0.49) and re-checkable via `eyeline-probe.png`; horizontally the busts are centred on the window.
- The manifest records the detected key hex next to the canonical target (`#FF00F8` detected / `#FF00FF` target), so a drifting generated sheet shows up in the Sprite Lab instead of passing silently.
- Removed the superseded first-pass sheets (`riders-sheet.png`, `supplies-sheet.png`) and stray scratch PNGs; the tree no longer carries unused art sources.
- Remaining SVG in the app is deliberate: the logo mark and the dashed pull-back hint arrow. Semantic text is still real HTML; no UI text is baked into art.
- `npm run check:art` builds the app and runs 25 art checks in headless Chromium (or checks a live server: `node tests/art-check.mjs http://127.0.0.1:5173`); `tests/artifacts/alpha-check.png` (checkerboard contact sheet), `hatch-probe.png` (measured ellipses drawn over the shells) and `eyeline-probe.png` (pilot eye-line guides) were inspected as images during implementation. The suite asserts geometry, not just decoding: the pilot window's clip-path, the pilot staying inside the silhouette, and both layers swapping when the rider/capsule changes.

### Not Yet Complete

- Polished results/podium presentation and persistent cup history (4.3), empirical balance/QA/performance (4.4).
- No measured proof of balance, smooth FPS, keyboard accessibility, mobile usability, or full tournament correctness. These need actual tests/play sessions.
- Do not call the game fully finished merely because features exist and compilation passes.

## Architecture And Important Files

| File | Responsibility |
| --- | --- |
| `src/App.tsx` | App entry point, menu/race routing, global preferences/records, in-memory `RaceSession`, modal setup, round commits, continuation |
| `src/screens/RaceScreen.tsx` | Engine mounting/lifetime, asset preparation, effective fixed race options, HUD, pause/fullscreen, finish callback, current result |
| `src/game/session.ts` | RaceSetup/RaceConfig/RaceSession, three-round order, commit guards, standings/tiebreaks, last-setup loading |
| `src/game/preferences.ts` | Options/record validation and local-storage writes |
| `src/game/types.ts` | Options, RunRecord, GameSnapshot, race standings and IDs |
| `src/game/loadouts.ts` | Rider/capsule definitions and shared stat formulas |
| `src/game/loadout-art.ts` | PNG rider/capsule art (`riderArt`, `capsuleArt`, `loadoutArt`, `loadoutArtAlt`) and `prepareRaceCapsules`, the once-per-roster 192² baked race capsule |
| `src/game/art-assets.ts` | Typed `art-manifest.json` access, one-time decode cache, hatch/pilot-box geometry, placeholder and failure reporting |
| `src/game/art-manifest.json` | GENERATED sprite metadata (sheets, cell rects, runtime sizes, hull diameter, measured hatch ellipses) — regenerate with `node scripts/build-art.mjs`, never hand-edit |
| `scripts/build-art.mjs` | Build-time-only ImageMagick pipeline: matte detection, despill, shave/trim, hull normalisation, hatch measurement, verification montages |
| `src/components/RacerFigure.tsx` | Menu-side shell + pilot composite clipped to the measured hatch ellipse |
| `src/components/ArtGallery.tsx` | The Sprite Lab: runtime sprites and source sheets with detected keys, sizes and downloads |
| `docs/ART_PIPELINE.md` | Part 4.2 pipeline contract, manifest schema, fallback rules, art verification |
| `src/game/racers.ts` | Four racer states/resources, loadout application, visited obstacles, finish order |
| `src/game/engine.ts` | Fixed-step physics, CPU planning, lane steering, collision impulses, recovery, pickups/shields, finish window |
| `src/game/scene.ts` | Track lengths, lane geometry, course-specific elevation tables, pickup/racer frame types |
| `src/game/courses.ts` | Region identities, colors, elevation profiles, sectors, stadium names |
| `src/game/track-layout.ts` | Deterministic course-specific ground obstacle placement |
| `src/game/powerups.ts` | Supply definitions/placement, swept pickup test, painted HUD icons drawn from the shared PNG sprite map |
| `src/game/world-art.ts` | Cached canvas skies/dirt/banks plus `prepareWorldArt()` (blimp + landmarks decoded before racing); course previews are the painted PNG rasters |
| `src/game/renderer.ts` | Zoomed perspective rendering, lane-aware sprites, pickups, shield effects, race sprite choices |
| `src/game/environment.ts` | Dirt strip rendering, terrain, crowds, blimps, landmarks, gaps and stadium |
| `src/game/projection.ts` | 0.86 world/screen projection, inverse aiming, visibleSpan overscan, culling |
| `src/game/model-atlas.ts` | One-time layered launcher/ramp/loop baking and aligned `>>>` pad texture |
| `src/game/geometry.ts`, `machinery.ts`, `materials.ts` | Atlas-generation geometry; do not put the old per-frame mesh path back in use |
| `src/game/assets.ts` | Existing image loading, green-key removal, alpha PNG runtime conversion, sprite sheet splitting |
| `src/game/previews.ts` | PNG downloads derived from current model atlas |
| `src/game/performance.ts` | Bounded adaptive render resolution and stationary layer caching |
| `src/game/audio.ts` | Local synthesized effects, master volume |
| `src/components/NewGameSetup.tsx` | Mode/loadout/course/difficulty selection, confirmation and previews |
| `src/components/RoundResult.tsx` | Existing basic round/cup results and action buttons |
| `src/components/MainMenu.tsx` | Main menu and contextual resume label |
| `src/components/RaceControls.tsx`, `RaceStandings.tsx`, `AirSupplies.tsx` | Lane buttons, loadout HUD, standings, supply feedback |
| `src/components/SettingsPanel.tsx`, `Modal.tsx` | Settings and focus-trapped dialogs |
| `src/index.css`, `src/menu.css`, `src/setup.css` | Race, menu, setup, results, mobile and accessibility styles |

`RaceConfig` is memoized in App by session ID and round. Preserve stable identity during HUD/results changes; changing it unnecessarily reinitializes the engine. Display/audio preferences must not mutate competitive course/loadout config.

## Persistence Details And Hazards

- Keys: `goblin-rally-options-v1`, `goblin-rally-records-v1`, `goblin-rally-setup-v2` (legacy draft, still written and read as a migration source), `goblin-rally-session-v1` and `goblin-rally-session-v1-backup`.
- Options, the top 20 records, the last setup and the whole active event are persisted. `docs/PERSISTENCE.md` is the authoritative contract; do not weaken atomicity or the duplicate-result guards.
- `RaceSession` has `id`, `setup`, `rounds`, `round`, `roster`, and `results`; it has no explicit saved phase or schema version.
- `commitRound()` validates record session ID, current round and course, then ignores duplicate round entries. Preserve these guards.
- `RaceScreen` stores local result state and constructs a GameEngine in an effect. Hydrating a completed round requires preventing that fresh engine from replacing the saved results with a ready race.
- Never persist Sets or canvases directly. Use stable IDs and plain validated JSON for engine state, if doing mid-race snapshots.
- Preserve completed cup rounds when restarting an unfinished one. Rematch of a completed cup must create a NEW session ID.
- During in-memory menu navigation, `active`, `activeRef`, `resumeAfterScreen`, engine `inputEnabled`, and `setVisible()` coordinate suspension/resume. Test transitions around fullscreen and settings rather than assuming they work.
- Classify legacy/practice/quick/cup records distinctly. Do not let arbitrary practice tuning pollute competitive achievements or cup ranking.

## PNG Replacement Inventory

### Current SVG Game Artwork

- `src/game/loadout-art.ts`: `riderArt()`, `loadoutArt()`, `capsuleArt()`. The latter composes four rider designs with three capsule designs as SVG strings. `prepareRaceCapsules()` loads them and rasterizes each into a 192x192 canvas with race color accents.
- `src/game/powerups.ts`: `powerupIcon()` returns SVG; `preparePowerupSprites()` rasterizes 128x128 icons. These appear in the world, HUD, and guide.
- `src/game/world-art.ts`: `coursePreview()` returns a 400x220 SVG for course selection/itinerary.
- `src/components/GoblinMark.tsx` and `public/favicon.svg`: small original brand mark. Replace with generated PNG if the user wants absolutely all branded art rasterized. Do not confuse semantic Lucide arrows/checks/settings controls with illustration placeholders; keeping them vector is appropriate unless explicitly requested otherwise.

### Existing Raster Files

`public/art/goblin-rally-concept.png`, `mountain-arena.png`, `track-sprites.png`, `foreground-crowd.png`, `grandstand.png`, `slingshot.png`, `slingshot-downrange.png`, `timber-loop.png`, `track-tile.png`, `deck-surface.png`.

Important: earlier tools reported several files with `.png` extensions as JPEG-encoded data. They are browser-decodable, but are not guaranteed true PNGs or alpha textures. Inspect actual file signatures before claiming format conversion. The existing runtime cutout pipeline outputs genuine PNG data URLs. Generated replacements must have correct file content, not just a PNG extension.

The earlier image tool reached its 10-generation session cap during Section 1. No new menu image was saved from that failed call. Do not reference `/art/main-menu.jpg`; it does not exist. A new agent may or may not have a refreshed quota: check tools and budget first, and be transparent if generation is unavailable. Do not present flat SVG-to-PNG conversion as newly painted art.

## Art Direction And Asset Brief

Use `public/art/goblin-rally-concept.png` as the palette/material/shape reference, not an exact layout template. Desired result: original polished hand-painted fantasy racing art, chunky readable silhouettes, warm brass and weathered dark iron, restrained teal shadows, muted earth, expressive green goblins. Avoid photorealism, excessive fine grain, random spikes on collision silhouettes, baked words, franchise marks, and generic flat vector illustrations.

Use a consistent slightly elevated three-quarter rear/side camera: track travel goes RIGHT and slightly AWAY. The launcher must be visibly loaded from the rear, with winch/pouch behind forks. Its firing axis runs along the lane, not into either spectator row. Do not undo the user's repeated orientation fixes.

| Asset Group | Required Content | Suggested Output |
| --- | --- | --- |
| Rider portraits | Rivet, Nix, Grub, Sprocket, coherent head/shoulder angle and scale | Four 512x512 alpha PNGs |
| Rider cockpit inserts | The same faces/gear, cropped to a common cockpit opening | Four 256x256 alpha PNGs, or extracted from portraits with validated masks |
| Capsule shells | Rustbucket, Springsteel, Siegebreaker; common centered round envelope and standardized hatch | Three 512x512 alpha shells with open hatch, matching back/inner rim if needed |
| Combined racers | All 12 loadouts, consistent position and scale | Compose once from real painted shell/pilot PNGs; cache 192/256px racing variants and 512px preview variants |
| Air supply icons | Amber bolt/fuel can, blue shield, mint winged spring/arrow | Three 256x256 alpha PNGs; readable at 24-48px; same silhouette everywhere |
| Course previews | Pine valley, copper quarry, green pasture | Three 800x440 raster thumbnails, no text |
| Main menu | Goblin capsule/racetrack on right, calm dark forest on left for UI | One 1920x1080 PNG or optimized JPEG background; actual title stays HTML |
| Regional skies | Broad pine mountains, layered red mesas, soft meadow hills | Three wide backgrounds around 2048x1024; quiet lower horizon and seamless-friendly edges |
| Blimps | Goblin brass/cloth airship with envelope/fins/rigging/gondola | One reusable 768x384 alpha sprite, or three palette-matched variants |
| Landmarks | Pine clusters; quarry rock/smokestack; windmill/hay/stone pasture elements | One padded sheet, extracted into 256-512px alpha PNGs |
| Crowd layers | Rear head/shoulder silhouettes for foreground; front-facing stand crowd farther away | Horizontally repeatable strips, alpha above silhouettes, ground baseline metadata; foreground fades to black |
| Dirt materials | Calm ochre, copper-red, pale pasture earth | Three tileable 512x512 textures or a neutral texture tinted once; subtle ruts, very sparse stones, no planks |
| Results art | Goblin-engineered cup with gold/silver/bronze materials, modest podium backdrop | Padded trophy sheet plus one wide backdrop; no baked result text |
| UI material accents | Brass corners, worn iron/wood trim, select/confirm medallion if useful | Small reusable atlas/nine-slice sources; keep the screen uncluttered |

Portrait personalities: Rivet has leather aviator headgear and practical tools; Nix is lean and mischievous with purple scarf/asymmetric hair; Grub has a broad jaw, heavy brow, battered helmet and olive gear; Sprocket has copper-red hair/rocket-tinkerer details. Keep all skin olive rather than pure chroma green.

Capsule personalities: Rustbucket is balanced dark iron/brass; Springsteel is lighter cool alloy with a few readable spring ribs; Siegebreaker is heavy steel with broad armored panels. Weight differences are already physics data; do not change collision radius merely because armor artwork is bigger.

### Practical Generation Budget

If limited to 10 image-generation calls, prioritize coherent sheets: one 2x2 rider portrait sheet, one 3-capsule shell sheet, one 3-supply icon sheet, one course-preview sheet, one blimp/landmark sheet, one trophy sheet, one main-menu background, then reserve the remaining calls for regional background improvements. This is a budget strategy, not permission to pack unrelated scales into one unmanageable atlas.

For sprite sheets require an exact grid, generous flat matte padding, no overlap, no text, common lighting, and complete uncropped silhouettes. Inspect cell boundaries and real object bounds; do not blindly assume generated art follows the requested grid. Prefer individual output files after verified extraction.

### Reusable Generation Prompt Template

"Premium original hand-painted fantasy goblin racing game asset, consistent with the supplied Goblin Rally concept: chunky exaggerated readable forms, weathered charcoal iron, warm brass, olive goblin skin, warm upper-right light and cool teal shadows, restrained texture noise. [SUBJECT AND PRECISE ORIENTATION]. Entire silhouette visible with 10 percent padding. [DIMENSIONS / EXACT GRID]. No words, labels, logos, watermark, border, UI, or cast shadows on empty background. Transparent background if supported; otherwise perfectly uniform solid #00FF00 matte in every empty region. Never paint pure #00FF00 inside the subject. The image will be extracted as a true alpha-channel PNG and used at small racing scale."

For environment paintings replace the transparency clause with the composition requirement, keep horizon height consistent, and leave safe legible space for menus/HUD. Do not put texture or labels over the player's racing line.

### Integration Requirements

- Original request said "magenta #00FF00"; that hex is GREEN. Follow #00FF00 if keying, or true alpha. Do not introduce a magenta matte based only on the word.
- Convert keyed assets to genuine alpha PNG at build/preparation time where tools permit. Despill edges without erasing olive skin, mint pickup effects, or blue-green glass. Test on black, white, and checkerboard backgrounds.
- Keep art under `public/art/` with predictable relative URLs. Add a typed manifest with frame rectangles, anchor/pivot, baseline, and hatch coordinates. Store source sheets separately from runtime crops.
- Preserve `riderArt`, `loadoutArt`, `capsuleArt`, `powerupIcon`, and `coursePreview` call contracts or update all callers together. Share one image source between gameplay and UI; don't leave old SVG previews with different PNG race art.
- Generate all 12 combinations without 12 costly separate paintings by using a common hatch/pilot compositing convention. Color/team accents should be baked once and keep the player orange. Names/numbers must still identify racers independently of color.
- Keep the complete capsule rotating as implemented. If making the cockpit independently stabilized, make that an intentional visible design choice rather than reverting to an apparently stationary ball.
- The warm tint and silhouette must not alter collision geometry, loop trajectories, or drop pickup clarity. Normalize racer center and effective radius across all composites.
- Preload/decode/cache before entering a round. Report load failures with retry. No base64 encodes, SVG parsing, or image generation in `render()`/physics ticks.
- Preserve layered machinery occlusion. Existing model atlases are pre-baked from geometry; only replace them if orientation, near/far mask layers, entry/exit alignment, and cost are verified. The static geometry path can remain as a fallback.
- Keep HUD/menu labels as HTML with keyboard focus and screen-readable text. Decorative imagery should not be made into an unreadable text-filled bitmap.
- Optimize memory: bounded atlases, sensible runtime sizes, no 4K transparent sprite for a 60px object. Prefer shared sheets and decoded images. Do not dispose globally shared caches when a single round unmounts.

## Research Already Recorded

`docs/GAME_DESIGN.md` cites Blizzard's character-creation UI redesign, Matt McDaid's stylized-art/readability interview, Xbox accessibility guidelines 102/112/117, MDN canvas optimization, and Nintendo's Grand Prix guide. Apply those findings rather than claiming vague research:

- One focal point; concise choices; visible comparable tradeoffs.
- Broad readable forms, not ornamental noise.
- Consistent Back actions, keyboard radio navigation, focus restoration/trapping, high-contrast and reduced-motion paths.
- Keep static background work off the per-frame renderer.
- Cup scoring is cumulative and visible before starting; four-player values are 9/6/3/1, not copied twelve-player values.

## Controls And Non-Regression Checklist

- Player is racer ID 0, orange, home lane 3 (zero-based 2). Opponents retain IDs 1-3 across cup rounds, with the selected roster fixed.
- Drag/release or Enter launches all four. Arrow keys adjust launch aim/power before launch.
- A/D change lanes. W/J ground hop. Space air bounce. Shift boost. P pause. R restart unfinished round. M mute. F fullscreen.
- Competitive presets fixed; custom sliders only in labeled Quick Race practice. Don't let display settings or a workshop track switch mutate the cup.
- Shields cancel one shove for up to six seconds, not gaps. Supplies are one-use shared objects, reset each round. Earliest swept contact wins.
- Falls recover with time/score cost and short protection. Do not teleport opponents invisibly to fabricate a close race.
- The lane-aware side impulse, ground heights, atlas orientation, and rotating capsule are repeated user priorities.
- The three track profiles must be passed explicitly through engine/renderer/landscape/pickup helpers. Accidentally using default `ridge` will desynchronize collision and art.
- Preserve full-width/near/far overscan; the user specifically reported right-edge background pop-in.
- New supplies or art must respect reduced motion, bounded particles, contrast, and small-screen readability.

## Verification Status At Handoff

Parts 4.1 + 4.2 verification: `npm run build` succeeded at 641.46 kB / 199.46 kB gzip; `node scripts/check.mjs` passed `tsc --noEmit` plus 18 focused persistence tests; `node scripts/browser-check.mjs` passed 21 recovery checks; `node scripts/browser-check.mjs art` passed 25 art checks (the same 25 pass against the live dev server on 5173); `node scripts/build-art.mjs` rebuilt all 18 sprites from 8 sheets with every matte detected as magenta `#FF00F8` (target `#FF00FF`) and every port re-measured and verified. Screenshots, the alpha contact sheet, the hatch probe and a manifest copy are in `tests/artifacts/` (git-ignored).

What the browser tooling does and does not prove: it runs the real app in headless Chromium and inspects decoded images, the composited pilot, the drawn race frame's pixels, and the recovery flow. It does not measure frame pacing, race balance, touch ergonomics, or accessibility conformance, and it does not represent a human playtest. Those remain 4.4 work.

A Vite preview configuration (`vite.preview.config.ts`) is available for the sandbox's proxied preview host; `vite.config.ts` itself was left untouched.
## TICKET-04 Session (arena/01a0b559-heavymetal2)

TICKET-04 (character & ball selection redesign) is implemented on this branch. The cockpit
composite (`RacerFigure`, `racerLayers`, `measureHatch()` / `assertHatch()`, the three
`*-shell.png` sprites and `capsules-sheet.png`) is retired. New generated art: four
full-body goblin renders (`public/art/sheets/riders-fullbody/*-full-src.png` ->
`public/art/riders/fullbody/<id>_full.png`, 512x768) and three standalone ball renders
(`public/art/sheets/balls/*-ball-src.png` -> `public/art/balls/<id>-ball.png`, 512x512,
hull-normalised to the retired shells' 452px diameter). `build-art.mjs` gained
`defringeWhite()` (flood-fills off-white side bars with the matte before keying) and
`fitStance()` (feet on the bottom edge of the portrait box); `loadout-art.ts` now exposes
`prepareRaceBalls()` (ball + team rim, no pilot insert) and `riderFullBody()`; the
selection screen uses the new `CharacterShowcase` component (full-body rider beside the
ball on a lit pedestal, crossfade per figure, reflection and reduced-motion-aware gleam);
the off-screen pointer badge draws the player's pilot portrait (`assets.playerBadge`).

Verification on this branch: `npm run check` (tsc + 24 unit tests) green; `npm run build`
green; `tests/art-check.mjs` 20/20; `tests/ticket02-visual.mjs` 24/24;
`tests/ticket07-visual.mjs` green; `tests/ui-frame-check.mjs` green. Screenshots reviewed
as images (`tests/artifacts/art-1-loadout.png`, `art-4-race.png`). The art-check and
ticket07 suites were also de-flaked while here: the loading cover owns Enter until
dismissed (there is no auto-dismiss), the race screen has no header nav (workshop and main
menu live in the gear menu), and launches retry until the status flips.

## T00 Session (arena/01a0c8b7-heavymetal2, draft PR #46)

Ticket [#33](https://github.com/Piskriek/HeavyMetal2/issues/33) — repository baseline and
protected-data safeguards. Tooling only: no `src/**` or `public/**` byte changed.

Added:

- `scripts/protect-baseline.mjs` — read-only safeguard for the user-authored decoration
  baseline. `inventory` (status + blocker), `snapshot` (exclusive timestamped snapshot +
  manifest of the original bytes, read-back comparison, recovery-copy verification) and
  `verify` (re-hash snapshot, live source and recovery copies). Refuses path escapes,
  absolute paths, NUL bytes, symlinked components and any write inside `backups/props/**`;
  never overwrites, never restores automatically; records counts/IDs as `advisory: true`
  observations. Exit codes: 0 ok, 1 blocked/failed (`E_*` code), 2 usage.
- `tests/protect-baseline.test.ts` — 20 fixture-only checks (path safety, observations,
  exclusivity, tamper detection, CLI codes); registered in `scripts/check.mjs`.
- `package.json` — `inventory:baseline`, `protect:baseline`, `verify:baseline`.
- `docs/BASELINE_INVENTORY.md` — engine/renderer/builder/script/test/lockfile/storage
  inventory, the protected-data record and the explicit missing-data blocker.
- `docs/BASELINE_VERIFICATION.md` — the actual baseline commands, results and exit codes.

Baseline in this sandbox: `npm ci` 0; `npm run check` 0 (tsc clean, 78 tests pass);
`npm run build` 0 (`dist/index.html` 1,444.64 kB / 397.96 kB gzip); `tests/ui-frame-check.mjs`
24/24; `tests/ticket05-visual.mjs` 29/29. Existing failures, distinguished from regressions:
`check:edges` exits 1 with 13 stale-fringe findings on decals, `check:textures` exits 1
(`public/textures/grass-fringe.png` is 512×256, expected 1024×256), and the four
race-entering browser suites (`browser-recovery`, `art-check`, `ticket02-visual`,
`ticket07-visual`) time out because this sandbox's bundled Chromium cannot create a WebGL
context — probed across nine launch configurations; the race screen needs
`THREE.WebGLRenderer` (`src/game/renderer-3d.ts:1657`). Re-run those suites where WebGL
exists.

Blocked, not solved: the authoritative decoration baseline cannot be certified from inside
this checkout. The live copy is browser `localStorage['hm2-3d-track-props']`; every disk
copy lives in the same working tree with no signed provenance (`.gitignore:8` references an
absent `3DTrack/`). The hashes in `docs/BASELINE_INVENTORY.md` are observations of tracked
mirrors — the primary is `backups/props/track-props-latest.json`, sha256
`0721aa4b1e0e37f273cf0782fc643ff891455ba6f712c36ea851cd9d4f38a7a5`, 94,867 bytes, 237 props.
T12's "protected bytes verified against a real baseline" stays blocked until the user
authorises a source or points `--source`/`--recovery` at the real file.
