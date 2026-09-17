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
- Cockpit openings are measured, not guessed: the near-black opaque blob in each shell is fitted to an ellipse (iron 0.819,0.617 rx 0.102 ry 0.144; springsteel 0.817,0.618 rx 0.090 ry 0.143; siege 0.813,0.610 rx 0.096 ry 0.142) and written to the manifest with a `measured` flag and a conservative fallback.
- The manifest records the **detected** matte hex next to the canonical target (`#FF00F8` detected / `#FF00FF` target), so a drifting sheet is visible in the Sprite Lab instead of silently passing.
- 18 runtime sprites: four 512² portraits and four 256² pilot busts, three 512² shells, three 256² supplies, four landmarks, the 900x576 blimp and three 800x440 course previews. All alpha sprites are true RGBA PNGs (verified with `identify`), and the opaque course previews stay opaque.
- Runtime: `src/game/art-assets.ts` types the manifest and exposes accessors plus a decode-once cache; `src/game/loadout-art.ts` bakes one 192² race capsule per racer (shell, pilot inside the measured ellipse, team-colour rim) and caches at most six, so racing still composites nothing per frame; `src/game/world-art.ts` decodes the blimp and landmarks before the first frame; `src/components/RacerFigure.tsx` composites the menu figure with the same measured ellipse.
- Failure behaviour is explicit: a 404 or decode error produces a visible painted placeholder, marks the sprite and logs `[Goblin Rally] art placeholders in use: ...` rather than drawing nothing.
- The Sprite Lab (The Workshop > Sprite Lab) lists the whole library plus the source sheets, with the detected key, target key, grid and runtime size, and its downloads are the exact files the race loads. The credits panel now names the art, the manifest, this pipeline and the reused predecessor portraits.
- Verification: `npm run check:art` (17 checks in headless Chromium) and `tests/artifacts/alpha-check.png` (checkerboard contact sheet) plus `hatch-probe.png` (measured ellipses drawn over the shells) were reviewed as images by the implementing agent.
- Regenerating the library is `node scripts/build-art.mjs` (~45 s, ImageMagick 6 required at build time only). Contract, schema and fallback rules: `docs/ART_PIPELINE.md`.

### Parts 4.3–4.4: Awaiting User Prompts

Results/cup/progression presentation and persistent cup history; then empirical balance, end-to-end QA, frame pacing and release verification. A successful build is not proof of FPS, balance or accessibility.

## Verification Boundary

Production compilation is verified (`npm run build` / the provided build tool). Type-checking and 18 focused persistence tests are verified locally via `node scripts/check.mjs`. Scripted headless-Chromium runs are verified: 21 recovery checks via `npm run check:browser` and 17 art checks via `npm run check:art`, with screenshots and the alpha/hatch montages left in `tests/artifacts/` — those images were inspected by the agent, so the art is verified as *decoded and drawn*, not merely built. Not verified: frame pacing on real desktop/mobile hardware, long-run stability, empirical race/loadout/course balance, and accessibility certification. Do not represent compilation, type-checking, unit tests or a scripted browser pass as measured FPS, playtesting, accessibility certification or tournament balance.