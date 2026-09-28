# WIRE-2: The race uses the painted track, barrier and effect art

- **Replaces**: [ART-I3](../art/ART-I3-track-art.md), minus the speed lines (moved to WIRE-3, which owns the cockpit).
- **Art**: `public/art/track-obstacles/` (`tex/boost-pad-chevrons.png`, `tex/gap-pit.png`, `tex/ramp-deck.png`,
  `gap-warning-sign.png`, `rock-gate.png`, `water-rock.png`, `roller-rails.png`, `barrier-*.png` ×5,
  `shield-bubble-hex.png`) and `public/art/animated/alpha/anim-06`, `anim-53` … `anim-60`.

## Goal
The things on the road look like what they do: boost pads glow and point the way, gaps look like holes,
ramps look like ramps, obstacles and barriers are painted, and boosts, pickups, shields, springs,
landings and tree smashes each get their own painted effect.

## Evidence
- `src/game/obstacle-view.ts` `roadMaterial`: boost = flat orange, gap = black, ramp = brown.
- `src/game/obstacle-view.ts` `BLOCK_COLOURS`: spinner, rock gate, water rock, cauldron and roller rails are tinted boxes.
- `src/game/builder/prop-catalog.ts`: the five barrier props borrow unrelated prop art.
- `src/game/effects/events.ts`: only `explosion | impact | dust | smoke | sparks`.
- `src/game/renderer-3d.ts`: the shield is a wireframe sphere.

## Solution
1. **Road marks**: textured materials from the three `tex/` files: the chevrons repeat along the pad's
   length and scroll slowly toward the direction of travel (still under reduced motion). A `gap-warning-sign`
   billboard 400 units before each gap.
2. **Obstacle sprites**: `rock-gate`, `water-rock`, `roller-rails` as billboards; the cauldron from
   `anim-06-molten-cauldron`; the spinner from `anim-53-pinball-spinner`, its frame driven by the sim's spinner
   state (frame 0 under reduced motion).
3. **Barriers**: point the five barrier props' `url` at `public/art/track-obstacles/barrier-*.png`.
4. **Effects**: new `EffectKind`s `boost`, `boost-pad`, `pickup`, `shield-break`, `spring`, `landing`,
   `tree-smash` mapped to anim-54 … 60; emit them where the sim already reacts (performBoost, the boost pad hit,
   pickupCollected, a shield absorbing a hit, a spring, a hard landing, the tree-line smash). `pickup` is tinted
   by the pickup's colour. Effects stay presentation only.
5. **Shield**: `shield-bubble-hex.png` on the instanced shield instead of the wireframe (additive, a slow spin,
   no spin under reduced motion).
6. **Preload** every new texture and sheet from one `preloadTrackArt()` in your module, called with **one line**
   in `src/screens/RaceScreen.tsx`. Nothing decodes mid-race.

## Files allowed to change
`src/game/obstacle-view.ts`, `src/game/effects/events.ts`, `src/game/effects/renderer-fx.ts`,
`src/game/engine.ts` and `src/game/sim/racer-physics.ts` (emit calls only, no physics),
`src/game/renderer-3d.ts` (shield material only), `src/game/builder/prop-catalog.ts` (the five barrier urls only),
`src/screens/RaceScreen.tsx` (one preload line), tests `obstacle-view`, `effects`, `effect-coverage`, `pickup-view`.

## Must NOT change
Physics, collision sizes, the effect queue's determinism, anything in the cockpit (`CockpitHud.tsx`, `cockpit*`).

## Acceptance
- [ ] No obstacle kind in `track-layout.ts` is drawn as a tinted box or a flat colour (a test over every kind).
- [ ] Every new effect kind is emitted by the sim or engine and has a sheet (effect-coverage test).
- [ ] Reduced motion: no scrolling pads, the spinner and effects hold frame 0 (test).
- [ ] The physics parity and determinism tests still pass untouched.
- [ ] Screenshots: a boost pad, a gap with its sign, a ramp, the spinner, a barrier, the shield, a nitro burst.

## Tests to run
`node --import tsx --test tests/obstacle-view.test.ts tests/effects.test.ts tests/effect-coverage.test.ts tests/pickup-view.test.ts`, then `node scripts/check.mjs`.
