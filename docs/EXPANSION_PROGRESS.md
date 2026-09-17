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
- Original SVG rider portraits and capsule previews are generated without external dependencies. The chosen appearance is rasterized once into race sprites; it is not just a menu-only cosmetic.
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

## Section 4: Next, Await User Prompt

Enrich the basic Section 2 results and cup flow with dedicated presentation and persistent tournament recovery. Add balance analysis, accessibility/interaction review, and final performance verification. Do not confuse the existing functional cup scoring with fully playtested competitive balance.

## Verification Boundary

Production compilation is verified with the provided build tool. No browser automation or live device testing tool is available in this environment. Do not represent successful compilation as measured FPS, gameplay testing, or accessibility certification.