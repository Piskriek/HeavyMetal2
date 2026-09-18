# Goblin Rally

A playable, original four-lane fantasy-goblin slingshot racing game built with React, TypeScript, Vite, and Canvas 2D.

## Full-Game Expansion

Sections 1-3 of the requested four-part expansion are implemented, along with Parts 4.1 and 4.2 of the final section: a researched fantasy main menu, persistent settings, keyboard navigation, Quick Race/Tournament setup, selectable rider/capsule loadouts, three distinct dirt courses, blimps, airborne supplies, a versioned, validated tournament save that survives a page reload, and a painted PNG sprite library that replaced the placeholder vector art.

Choose **New Game > Competition > Rider & Capsule > Race Rules**. Quick Race selects one existing track; Tournament runs all three in order. Returning to **Main Menu** retains the race and cup; the contextual Resume/Continue action brings it back. Replacing an unfinished or unviewed event asks for confirmation.

Progress is durable: settings, the last setup, the top-20 race records and the whole active event (roster, loadout, difficulty, committed round results and an explicit phase) are saved on this device. Reload the tab and the menu offers **Continue Tournament**, **View Round Results** or **View Cup Results** as appropriate. An interrupted round restarts from that round's starting grid and says so; a committed round is never re-raced for points. Saving is round-boundary recovery only — a reload does not restore live physics mid-race. If the browser denies or runs out of storage, the game says so instead of silently losing progress. The contract is documented in `docs/PERSISTENCE.md`.

The riders, capsule shells, air supplies, blimp, landmarks and course previews are original painted PNGs under `public/art/`, cut from generated source sheets by `scripts/build-art.mjs`: magenta `#FF00FF` keying with per-cell matte detection, fringe-only despill, a fixed 452 px hull envelope so armour never changes the collision size, and a measured cockpit ellipse (plus a per-rider eye line, because a tall helmet sits differently in the crop) that positions the pilot bust inside each shell. `src/game/art-manifest.json` is the typed manifest, every sprite decodes before a race starts and is cached afterwards, and a broken file degrades to a visible placeholder instead of a blank. The Sprite Lab (The Workshop > Sprite Lab) lists every runtime sprite and every source sheet for download, and the pipeline contract is in `docs/ART_PIPELINE.md`.

Settings are reachable before any race starts. They include graphics quality, audio enable/volume with a sound test, menu animation, contrast, reduced motion, camera view, and trajectory assistance. Restore defaults does not erase records or alter the selected course or ball tuning.

Four riders (Rivet, Nix, Grub, Sprocket) and three capsules (Rustbucket, Springsteel, Siegebreaker) make 12 builds. All share a 24-point rating budget, with visible physics values and tradeoffs. The same stat function drives player and CPU physics. Rookie/Racer/Veteran affects AI decisions rather than granting hidden speed.

The Scrapdome Cup awards 9/6/3/1 points to finishers and zero to DNFs. Rivals have a 10-second finish window after the player crosses. Round results show the actual field and cup totals, with Next Race and replay actions. Crew, capsule, and challenge stay fixed across a cup; round-ID guards prevent duplicate scoring.

The courses now have separate elevation profiles, lane/hazard rhythms, scenery, and stadium finishes: Copperwood Valley, the Brass Quarries, and the Woolwind Downs. The camera is pulled back 14% and lanes are 240 units wide. Quiet dirt replaces the repetitive plank road.

See `docs/GAME_DESIGN.md` for the research and delivery contract, `docs/LOADOUT_BALANCE.md` for the preset matrix, and `docs/WORLD_AND_POWERUPS.md` for track/pickup rules. Section 4's full progression/results polish and empirical balance checks remain pending. Equal stat budgets are a starting design constraint, not evidence of equal win rates.

## Play

- Four goblins line up in four rubber-band slingshots. You control your selected rider in the orange capsule in lane 3; the other three riders are CPU opponents. Drag your ball back and release to launch the entire grid. The launch button and Enter also work.
- Arrow keys: left/right change launch power; up/down change the angle.
- A/D: change one lane left/right after launch. Touch players have steering arrows and a four-lane position indicator. A collision pushes racers sideways toward adjacent lanes; heavier capsules deliver stronger shoves. Steering briefly locks after a bump and throughout loops.
- W or J: a short ground-based bunny hop. Unlimited uses after landing; brief input buffering makes landings forgiving.
- Space: midair bounce. Three charges; spring pads replenish them.
- Shift: speed boost. Two charges; chevron pads replenish them.
- Jump through airborne supplies: amber Rocket Fuel refills a boost and adds a small surge; blue Skyward Shield absorbs one rival shove for up to six seconds; mint Air Spring refills an air bounce. The first racer to touch each supply collects it, and all racers follow the same rule.
- R: restart. P: pause or resume. M: toggle sound. F: fullscreen.
- During a run, the main action button pauses instead of discarding progress. Bounce is locked while riding a loop; boost remains available.
- Touch players can drag the capsule and use lane steering, Jump, Bounce, and Boost buttons.
- Reach the 36,000-meter finish in The Scrapdome stadium. The course descends through Alpine Ridge, a 12 km waterfall cliff with wet switchbacks, pinball bumpers, springs, fire rings, and recovery gaps, then continues through the cavern approach into the stadium.
- Competitive events lock the selected preset. Quick Race's **Custom physics practice** option enables the earlier 80-240 km/h and 40-240 kg sliders. These runs are labeled as practice; tournaments cannot enable custom tuning.

The workshop contains three circuits, sound and visual settings, the original concept art, and downloadable transparent PNG sprites. The Hall of Chaos saves the top 20 runs locally on the current device. There is no account or server dependency.

## Four-Racer Racing

All four racers share the same fixed-step gravity, rolling resistance, jumps, boosts, and loop physics. CPU drivers periodically score neighboring lanes, seek boost pads, avoid or jump gaps, spend their own ability charges, and sometimes steer into a rival. AI decisions are staggered rather than recalculated on every render frame.

The 960-unit-wide dirt track has four 240-unit lanes, a numbered starting grid, chalk dividers, and a finish banner spanning the whole track. Obstacles have lane positions; gaps remove specific lanes while leaving a route around them. Boost and spring usage is tracked per racer, while TNT, sheep, and airborne supplies are shared first-contact objects. The six racer pairs use mass-weighted collision impulses and short contact cooldowns. Shields cancel one collision's velocity/shove penalty without protecting against gaps.

Falls trigger a recovery penalty and brief collision protection rather than ending the race. Live standings show position, lane, relative distance, recovery, and finish state. The player's result stores finishing position, race time, rival bumps, and the opponents' standings. Finish times use the crossing fraction within the simulation step instead of racer update order.

## Art Pipeline

The concept was generated first and saved to `public/art/goblin-rally-concept.png`. It established the painted teal mountains, timber-and-iron machinery, orange accents, and goblin crowds used in the game.

`#00FF00` is green, not magenta. The supplied hex is used as the sprite matte. `src/game/assets.ts` removes that matte, trims the objects, suppresses green edge spill, and encodes real alpha-channel PNG textures at runtime. The sprite lab offers those processed PNGs as downloads.

The camera looks 20 degrees down-range, with a slightly elevated view and a 0.86 zoom factor. Drag input uses the matching inverse projection at the player's lateral position. The dirt road, gaps, supplies, finish line, and crowd rows share one world-space projection; shadows, particles, capsule rotation, and slingshot bands follow each racer's lane.

Road and earth-bank textures are generated once per course with low-contrast patches, faint ruts, and sparse stones. `public/art/deck-surface.png` remains a material for timber machinery, not the road. The rear-loading launcher and the ramps/loops retain their cached timber/iron appearance, and atlas reference scales prevent double scaling with the wider camera.

Each hill is a distinct precomputed, smoothly connected elevation profile rather than a tilted background. Downhill gravity accelerates the rolling capsule; inertia and resistance depend on weight. All elevation/slope queries take the selected course ID, including rendering, obstacles, supplies, camera height, and collisions. The actual capsule sprite rotates with travel distance, including while airborne.

Gap cross sections have opposing outward normals and are culled against the camera position. Warning paint remains on solid timber. Grandstands sit on continuous foundations that follow the hill. At the bottom, a multi-tier stadium, flags, green arena floor, near-side crowds, and a checkered finish replace the mountain descent. Boost pads are top-down chevron textures mapped directly onto the road's direction and grade.

Cached blimps, pine/quarry/windmill landmarks, contact shadows, torchlight, scorch marks, and depth-sorted particles give the three environments their identities. Blimps are scenery only. Supplies use distinct icons as well as colors, with a shield timer and collection feedback. The existing PNG cutout and machinery-atlas pipelines remain in use.

The mountains drift slowly, while grounded scenery derives its parallax from real camera depth instead of unrelated scroll multipliers. The foreground fades into black. The canvas is resolution-aware and scales for mobile, desktop, and fullscreen play. In **The Workshop > The Garage**, switch **Look down the track** off to compare with a flatter camera without resetting a run.

## Performance

- Machinery is baked into a small reusable atlas during loading, for both camera angles. There are no camera-distance-triggered mesh rebuilds, per-frame face rasterization, or per-obstacle model generation during a race.
- Course backgrounds, dirt, banks, landmarks, and blimps are a bounded three-entry art cache. Pickup icons are rasterized once. Normal road strips are 256 units long, reducing road texture mapping compared with the earlier 128-unit subdivision.
- The track and audience use lightweight projected texture strips. Torch, boost, stadium, and glow textures are prepared once. Stationary scenery and foregrounds retain full-layer caches.
- A spatial bucket index restricts physics checks to nearby obstacles. Off-screen scenery and particles are culled. The fixed atlas does not grow with the 36 km track; Section 2 waterfall spray is bounded and cached.
- Air supplies have a separate spatial bucket index and reuse a candidate set. Swept segment/sphere collection prevents fast racers from tunneling through a supply; same-step claims are resolved by earliest contact.
- Terrain visibility is calculated over both lateral extremes of each layer, not at the track center. A screen-space overscan margin and full extra tiles keep the right edge filled at speed. Stadium tiles are prepared at load time and enter from beyond the viewport without a camera-distance toggle.
- The four slingshots reuse the same atlas. Capsule colors are prepared once. All four positions, rotations, and lateral motion are interpolated, and the race HUD updates independently of the render rate.
- Auto graphics uses at most 1.1 megapixels and a 1.15 pixel ratio, adapting resolution when CPU frames exceed budget. Performance mode allows 0.72 megapixels and fewer cosmetic particles; High detail allows 1.85 megapixels. Input coordinates remain independent of buffer resolution.
- Physics runs at a fixed 120 Hz with bounded catch-up. The visible capsule position and rotation interpolate between simulation steps. Active drawing follows every display refresh instead of skipping alternate 120/144 Hz frames; ambient idle drawing is limited to 30 Hz. HUD updates are throttled independently.
- Paused games and blocked dialogs stop requesting redraws. Hidden tabs and off-screen games stop the animation loop, and active runs pause rather than advancing invisibly.
- The canvas exposes `data-render-fps`, `data-render-cpu-ms`, `data-render-resolution`, and `data-renderer="prebaked-atlas"` for local performance inspection. These are runtime diagnostics, not device-FPS promises.

Choose **The Workshop > The Garage > Graphics performance** for Auto, Performance, or High detail. Changing graphics settings does not reset a run.

## Structure

- `src/App.tsx`: full-game navigation, shared preferences/records, new-game confirmation, and main-menu dialogs.
- `src/screens/RaceScreen.tsx`: existing playable racing screen, workshop, engine lifetime, pause/resume, and race controls.
- `src/components/MainMenu.tsx`: illustrated fantasy menu and keyboard navigation.
- `src/components/SettingsPanel.tsx`: categorized, immediately applied sound/display/accessibility settings.
- `src/components/NewGameSetup.tsx`: mode selection, live rider/capsule workbench, course/difficulty choices, and replacement confirmation.
- `src/components/RoundResult.tsx`: basic race/cup standings and round continuation.
- `src/game/loadouts.ts`: shared preset definitions, rating budget, and actual physics mapping.
- `src/game/loadout-art.ts`: PNG rider/capsule art and the once-per-roster baked race capsule.
- `src/game/art-assets.ts`: typed access to `art-manifest.json`, the one-time decode cache, hatch geometry, and placeholder/failure reporting.
- `src/components/RacerFigure.tsx`: menu-side shell + pilot composite clipped to the measured hatch ellipse.
- `src/components/ArtGallery.tsx`: the Sprite Lab, listing and downloading the exact files the game draws.
- `scripts/build-art.mjs`: the build-time keying, despill, normalisation and hatch-measurement pipeline (`node scripts/build-art.mjs`).
- `src/game/session.ts`: separate event configuration, cup order/scoring, the explicit `SessionPhase` model, and idempotent round progression.
- `src/game/save.ts`: versioned, validated, atomic and idempotent storage of the active event, with backup-slot recovery and plain-language notices.
- `src/setup.css`: responsive fantasy workbench, selection states, and result presentation.
- `src/game/preferences.ts`: validated preference loading and optional local persistence.
- `src/menu.css`: forged-metal menu styling, fantasy typography, responsive dialogs, and contrast/motion overrides.
- `src/game/engine.ts`: substepped physics, track collisions, looping, camera following, and particles.
- `src/game/racers.ts`: four racer states, independent resources, interpolation snapshots, and finish ordering.
- `src/game/renderer.ts`: perspective scenery, depth sorting, grounded sprites, shadows, and lighting.
- `src/game/model-atlas.ts`: one-time layered machinery baking and road-aligned boost textures.
- `src/game/courses.ts`: forest/canyon/meadow identities, color palettes, elevation profiles, and sector names.
- `src/game/track-layout.ts`: distinct course-specific obstacle rhythms.
- `src/game/world-art.ts`: cached low-noise dirt, bank, sky, landmark, and blimp art; lightweight setup previews.
- `src/game/powerups.ts`: air-supply definitions, placement, icons, swept collection, and bob timing.
- `src/components/AirSupplies.tsx`: pickup legend, shield duration feedback, and handbook explanations.
- `src/game/environment.ts`: terrain, anchored crowds, foundations, gap culling, rails, and torches.
- `src/game/geometry.ts`: beveled mesh construction and lighting used when generating the atlas, not during racing.
- `src/game/performance.ts`: adaptive render resolution and reusable canvas-layer caches.
- `src/game/machinery.ts`: rear-loading launcher, winch, curved ramps, and loop geometry.
- `src/game/materials.ts`: timber PNG mapping and weathered metal materials.
- `src/game/previews.ts`: transparent, camera-matched assembly previews for the sprite workshop.
- `src/game/projection.ts`: shared world-to-screen camera and inverse pointer mapping.
- `src/game/texture.ts`: triangle-based texture mapping for the track and grandstands.
- `src/game/scene.ts`: 36 km three-stage profile, waterfall-cliff gravity/surface lookup, course sectors, and shared physics constants.
- `src/game/assets.ts`: image loading and transparent PNG processing.
- `src/game/audio.ts`: locally synthesized Web Audio sound effects.
- `src/game/types.ts`: courses, settings, and shared types.
- `src/components/Modal.tsx`: accessible dialogs with focus management and fullscreen support.
- `src/components/RaceControls.tsx`: launch angle/power feedback, ability charges, and safe pause/resume controls.
- `src/components/RaceStandings.tsx`: starting-grid roster and live four-racer standings.
- `src/components/BallTuning.tsx`: player-adjustable launch speed and weight.
- `src/index.css`: responsive visual design and reduced-motion support.
- `docs/GAME_DESIGN.md`: researched design direction and staged full-game roadmap.
- `docs/LOADOUT_BALANCE.md`: the 12-build matrix, exact stat formulas, and remaining empirical tests.
- `docs/WORLD_AND_POWERUPS.md`: Section 3 course and supply rules, performance choices, and verification boundaries.
- `docs/ART_PIPELINE.md`: Part 4.2 source sheets, matte/despill/normalisation rules, manifest schema, fallback behaviour, and art verification.

## Development

Install dependencies, then use `npm run dev`. The production build is `npm run build`.

No API keys or third-party game services are required. Sound is muted initially and can be enabled from the header or workshop. Settings, records and the active event remain optional when browser storage is unavailable; the game runs either way and reports the failure.

Verification: `npm run check` type-checks the app and runs the focused persistence/recovery tests; `npm run check:browser` builds the app and drives the reload-recovery flow in headless Chromium (start a cup, launch, reload mid-race, resume, restored standings, corrupt save, denied storage); `npm run check:art` builds the app and runs 25 checks that the drawn art really is the PNG library in headless Chromium (decoded sprites, the pilot seated square inside the measured port with its alpha box clear of the brass ring, layer swaps, no inline vectors, no broken images, painted pixels in the race frame, a complete Sprite Lab); the same suite can be pointed at a running server with `node tests/art-check.mjs http://127.0.0.1:5173`. Compilation, unit tests and the scripted browser runs are not a substitute for playtesting.