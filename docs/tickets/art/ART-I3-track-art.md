# ART-I3: Use the new track, barrier and effect art in the race

- **Priority**: High · **Type**: code (after the art PR with ART-B3 is merged)
- **Conflicts with**: `src/game/obstacle-view.ts`, `src/game/effects/*`, `src/game/renderer-3d.ts`
  (shield), `src/game/builder/prop-catalog.ts` (barrier urls)
- **Needs art**: No (uses ART-B3)

## Goal
The things on the road look like what they do: boost pads glow and point the way, gaps look like
holes, ramps look like ramps, obstacles are painted, and speed, pickups, shields, springs, landings and
tree smashes each have their own effect.

## Evidence
- `src/game/obstacle-view.ts:157` `roadMaterial`: boost = flat orange colour, gap = black, ramp = brown.
- `src/game/obstacle-view.ts:30` `BLOCK_COLOURS`: spinner, rock gate, water rock, cauldron and roller
  rails are tinted boxes.
- `src/game/builder/prop-catalog.ts:419-423`: the five barriers borrow unrelated prop art.
- `src/game/effects/events.ts`: only `explosion | impact | dust | smoke | sparks`.
- `src/game/renderer-3d.ts:1995`: the shield is a wireframe sphere.

## Solution
1. **Road marks**: textured materials from `tex/boost-pad-chevrons.png` (UV repeat along the pad's
   length, a slow scroll toward the direction of travel, still under reduced motion),
   `tex/gap-pit.png`, `tex/ramp-deck.png`. Add a `gap-warning-sign` billboard 400 units before each gap.
2. **Obstacle sprites**: `rock-gate`, `water-rock`, `roller-rails` as billboards; cauldron from
   `anim-06-molten-cauldron`; spinner from `anim-53-pinball-spinner`, its frame driven by the sim's
   spinner state (still under reduced motion).
3. **Barriers**: point the five barrier props' `url` at `public/art/track-obstacles/barrier-*.png`.
4. **Effects**: new `EffectKind`s `boost`, `boost-pad`, `pickup`, `shield-break`, `spring`, `landing`,
   `tree-smash` mapped to anim-54…60 (`EFFECT_SHEETS`, `EFFECT_ART_PATHS`); emit them where the sim
   already reacts (performBoost, the boost pad hit, pickupCollected, a shield absorbing a hit, a spring,
   a hard landing, the tree-line smash). `pickup` is tinted by the pickup's colour.
5. **Speed lines** (anim-61) as a screen overlay in the cockpit above ~80 % of top speed, fading in
   and out; off under reduced motion.
6. **Shield**: replace the wireframe material with `shield-bubble-hex.png` on the instanced shield
   (additive, gently spinning).
7. Preload every new sheet and texture with the race art (nothing decodes mid-race).

## Files allowed to change
`src/game/obstacle-view.ts`, `src/game/effects/events.ts`, `src/game/effects/renderer-fx.ts`,
`src/game/engine.ts` and `src/game/sim/racer-physics.ts` (emit calls only, no physics),
`src/game/renderer-3d.ts` (shield material), `src/game/builder/prop-catalog.ts` (barrier urls),
`src/components/CockpitHud.tsx` (speed lines), `src/screens/RaceScreen.tsx` (preload),
tests: `obstacle-view`, `effects`, `effect-coverage`, `pickup-view`.

## Must NOT change
Physics, collision sizes, the effect queue's determinism (effects stay presentation only).

## Acceptance
- [ ] No obstacle kind in `track-layout.ts` is drawn as a tinted box or flat colour (test over kinds).
- [ ] Every new effect kind is emitted by the sim or engine and has a sheet (effect-coverage test).
- [ ] Reduced motion: no scrolling pads, no speed lines, spinner and effects on frame 0 (test).
- [ ] Screenshots in the PR: a boost pad, a gap, a ramp, a spinner, a barrier, the shield, a nitro burst.

## Tests to run
`node --import tsx --test tests/obstacle-view.test.ts tests/effects.test.ts tests/effect-coverage.test.ts tests/pickup-view.test.ts`, then `node scripts/check.mjs`.
