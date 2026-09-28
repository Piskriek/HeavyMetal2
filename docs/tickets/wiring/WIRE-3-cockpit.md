# WIRE-3: A painted cockpit: glass, cracks, needles, the rope-reel goblin, dashboard trinkets

- **Builds on**: P2 (glass, done in SVG), H6 (rope reel, done with borrowed art), X12 (trinkets, not built),
  and ART-I3's speed lines.
- **Art**: `public/art/cockpit/cockpit-glass-grime.png` (1920×1080), `cockpit-glass-crack-1.png`,
  `cockpit-glass-crack-2.png` (1024², light on pure black: use `mix-blend-mode: screen`),
  `cockpit-needle-large.png`, `cockpit-needle-small.png` (pointing up, hub at the bottom centre),
  `public/art/cockpit/trinkets/*.png` (9), `public/art/animated/alpha/anim-62-goblin-rope-reel.png`,
  `public/art/animated/alpha/anim-61-speed-lines.png`.

## Goal
Nothing in the cockpit is vector-drawn any more (owner's rule), the reel goblin is the painted one, and the
dashboard carries a couple of trinkets that sway with the ride.

## Evidence
- `src/components/CockpitHud.tsx` draws the glass (`glassScratches`), the cracks (`crackPath`) and the
  needles as SVG paths.
- `src/game/rope-reel-view.ts` `ROPE_REEL_ART` uses `anim-33-rope-heave-trio` (no new art).
- No trinkets exist; X12 describes them.

## Solution
1. **Glass**: replace the SVG scratches with `cockpit-glass-grime.png` over the aperture (screen blend, about
   0.5 opacity, `object-fit: cover`). Replace `crackPath` with one of the two crack PNGs, chosen by a seed from
   the existing crack state, rotated toward `state.impactSide`, fading with the existing `crackOpacity`. Keep
   the thresholds and the reduced-motion rule. Remove the now-unused SVG helpers and their tests, or adapt them.
2. **Needles**: the speed dial uses `cockpit-needle-large.png`, the small dials `cockpit-needle-small.png`,
   rotated about the hub with the existing `needleAngle` (scale each to its dial's radius from
   `src/game/cockpit-art.json`).
3. **Rope reel**: `ROPE_REEL_ART` → `anim-62-goblin-rope-reel.png` (2×2, 8 fps); size it to read as one goblin
   (the old art was a trio). Frame 0 under reduced motion.
4. **Speed lines**: `anim-61-speed-lines.png` as a screen overlay inside the aperture above ~80 % of top speed,
   fading in and out; off under reduced motion.
5. **Trinkets** (X12, a lean first version):
   - Up to **two** trinkets on the dashboard ledge, drawn as sprites inside the cockpit layer. The sheep
     bobblehead is two sprites (`…-body` fixed, `…-head` on a spring); dice and horseshoe hang and swing from
     their hook; the others rock on their base.
   - Motion from a small spring-damper driven by the ride: lateral acceleration (steering), vertical jolts
     (landings, `cockpitBob`), and hits (`yokeJolt`). Pure functions in `src/game/cockpit-trinkets.ts`, tested;
     presentation only (never in the sim). Held still under reduced motion.
   - Choosing them: a "Dashboard" row in the cockpit section of Settings: two slots, each a small painted
     thumbnail picker (none, or any unlocked trinket). Stored per device with the other cockpit settings.
   - Unlocks: sheep, dice, horseshoe, rocket and hula goblin from the start; the gold, silver and bronze cups
     after finishing a tournament 1st, 2nd or 3rd (read the existing records; never write to them).
6. **Preload** the cockpit art from one `preloadCockpitArt()` called with **one line** in `src/screens/RaceScreen.tsx`.

## Files allowed to change
`src/components/CockpitHud.tsx`, `src/game/cockpit.ts`, `src/game/cockpit-art.json` (only if a needle anchor
needs a value), new `src/game/cockpit-trinkets.ts`, `src/game/rope-reel-view.ts`, `src/cockpit.css`,
the cockpit section of `src/components/ControlsSettings.tsx` (where the cockpit settings live),
`src/screens/RaceScreen.tsx` (one preload line), tests `cockpit`, `cockpit-trinkets` (new), `rope-reel-view` if it exists.

## Must NOT change
The race sim, records files, anything WIRE-2 owns (obstacle view, effects, the shield).

## Acceptance
- [ ] No SVG path art left in the cockpit (glass, cracks and needles are the PNGs) (test).
- [ ] The reel shows the painted rope-reel goblin (screenshot during a reset).
- [ ] Speed lines appear above ~80 % top speed and never under reduced motion (test).
- [ ] Two chosen trinkets sway with steering and bounce on landings; still under reduced motion; cups stay
      locked until earned (tests on the spring and on the unlock rule).
- [ ] Screenshots at 1366×657 and 1920×1080: cockpit at speed, a crack, the Dashboard settings row.

## Tests to run
`node --import tsx --test tests/cockpit.test.ts tests/cockpit-trinkets.test.ts`, then `node scripts/check.mjs`.
