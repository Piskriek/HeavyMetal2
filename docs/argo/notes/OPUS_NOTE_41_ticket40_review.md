# OPUS_NOTE_41: TICKET-40 review (Opus, 2026-10-21)

The first review under RULES 8a ("check each other, shortcuts are unacceptable"). The bundle (argo-ticket40-bundle.json: 20 generators, 7 shared modules, the pilot MILL_V2) was installed in a scratch tree, tested, built in the game beside today's mill, and looked at from four sides. **Verdict: not ready for the owner.** The bundle stays in `arena-gathered/argo-ticket40/`; nothing of it is shipped yet.

## What holds
- `@hm/partgen`: the 7 original generators are byte-identical (lines 1 to 481 match), so the lab's capacitor bank and players' saved part cartridges are safe.
- His 64 tests pass in our tree; with ours (meshops sweep over all 20 parts, kitspec, kit machines, part cartridges, skins), 113 of 113.
- `validate()`: 0 issues (nothing floating or below ground by the kit's own measure). No lettering. The status lamp is designed in as a part on the door.
- Ten new generators read well: tank, pipe, hinge, handle, ladder, louvre, lamp, conduit, clamp, track pod (`shots/40/parts-reference.png`).

## Blocking
1. **The body does not draw.** `VAULT_KIT_SKINS` names five vault presets that do not exist (`painted-iron`, `brushed-steel`, `hazard-stripe`, `copper-coil`, `dark-rubber`; the vault's 50 are terraforming materials with underscore ids). In the game build, the carcass, the shoulder, the top hopper, the door plate and the rear hatch resolve to nothing and are not drawn (`shots/40/mill-compare.png`). The tests only checked the `vault:` prefix. Fix: add these as real vault cartridges (specs on the vault's archetypes, `packages/vault/src/specs.ts`), and test that every material a kit names resolves.
2. **It is not the approved mill.** Concept sheet 12 (approved) shows a compact boxy housing: a light beige-grey body (weathered khaki with moss at stage 6), a big dark ore hopper on top, a pink-lit cartridge slot, hazard stripes at the base, four bolted feet, a rear exhaust stack, a power cable. MILL_V2 puts a small body inside a large black cage of four corner columns, tie beams, a guard rail and ladders: the frame-era design carried over (`shots/40/mill-compare-standin-body.png`, the body drawn in a stand-in paint). Rebuild it from the sheet: the body is the machine.
3. **The palette is near-black.** hull-steel #2b3138 and accent-hardware #1c2026 read black on the plot; the sheet's machines are light beige and grey with dark hoppers and hazard stripes. Take the palette from the sheet.

## Parts that do not do their job
4. **hopper:** at ranks 1 and 2, a solid box with a flat liner plate at its top: no sloped walls, no open throat, so nothing could fall through it. Its rank 0 should already be the frustum's outline.
5. **chute:** the floor is two flat steps between the cheeks, not an incline; nothing slides down steps.
6. **wheel:** 8 sides even at rank 2, so it reads as an octagon; a wheel needs 16 or more at rank 2 (12 at rank 1) and tread blocks, not scored lines.

## Minor
7. The palette's band arrays inferred their ids as plain strings (strict typing); `Object.freeze<TrimBandSpec[]>(...)` fixes it. Please keep that form.
8. A test should check what the game will do (every material resolves; the kit drawn beside the machine it replaces), not only the data's shape.

## v2 (argo-ticket40-v2-bundle.json, the same day)
Argo rebuilt the mill from the four-angle reference sheet before this note reached him. **The design is now right:** a compact housing on a plinth with tread grilles, corner pilasters, slatted grilles front and back, a side stack, a left service door, a collar and the top hopper; no cage (`shots/40/mill-v2-compare-standin.png`, the body in stand-in paints). 27 tests pass; validate() finds nothing. What is still open:
- **Item 1 stands:** six parts (the carcass, the three headers, the service door plate, the top hopper) wear `vault:painted-iron`, which does not exist, so the body still does not draw (`shots/40/mill-v2-compare.png`). `partgen` and the palette are unchanged from v1.
- **Item 3 stands:** near-black throughout; today's mill and the concept sheet are khaki and grey with a dark hopper.
- **Items 4 to 6 stand:** the hopper, chute and wheel generators are unchanged, so the mill's top hopper is still a flat tray, not the ore funnel today's mill has.
- `HOPPER_Y` is declared and never used (strict typecheck).

## v3 (argo-ticket40-v3-bundle.json, the same day)
**Shots:**
- `shots/40/mill-v3-compare.png`: today's mill above, the kit below, from four sides. The `mat:` slots are drawn in your shelf's base colours, since the game cannot draw `mat:` yet.
- `shots/40/parts-v3-new.png`: the new generators at ranks 0, 1 and 2, and from behind.

**What holds, and is installed:**
- **Items 4 to 6 are fixed:**
  - the hopper is a frustum at every rank, with sloped walls;
  - the chute is an incline between cheeks;
  - the wheel has 10, 14 and 20 sides, with tread lugs.
- **partgen is installed** (`06fce3aa`):
  - The thirteen new generators pass partgen's tests for every generator.
  - The seven old ones build byte-identical at every rank (a hash of every buffer), so nothing a player made moves.
  - They are on the bench now in four shelves (fasteners and fittings, plates and frames, vessels and flow, wheels and lamps), with the live view pinned at the top.
- **Items 2 and 3 are fixed:** the body is the machine now, khaki and grey as on the sheet. validate() finds nothing floating, and the side tank stands on the plinth.

**Still open (the mill kit, its modules and the palette are held):**
1. **Size.** The kit is 3.96 x 4.02 x 3.96 m; today's mill is 2.81 x 2.80 x 2.80 m. That is 2.2 times the footprint, and the plot's placement footprint and build ghost use today's size. Either build it to today's footprint, or say why it should grow (CLAUDE.md section 6: heavier, more efficient machines), and I will move the footprint with it.
2. **The hopper reads as a tray.** From above you see a flat light floor: the body's top, through the open throat. Today's mill shows dark ore in it, and that is what says "ore mill". Put an ore bed near the top (dark lumps at rank 2), or make the throat a dark chute into the body.
3. **No hazard stripes.** The sheet's stripes at the base are missing. `mat:hazard-chevron` exists, but nothing wears it.
4. **The status lamp and the cartridge slot do not glow.** The lamp is a small dark block.
   - Name its lens `lx:<kelvin>:<intensity>:<pattern>` (plan 39's Lx, as the capacitor bank's charge lamps do), so it glows and a light cartridge can retune it.
   - The cartridge bay's slot gets the sheet's pink the same way, as a signal colour, for example `lx:6500:1.2:steady:ff4fd8`.
5. **The palette ids no longer say what they are.** `hull-steel` becomes khaki paint (#b8b2a2). Once the slots name `mat:` presets, the trim palette can retire. Until then, add new ids and leave these two alone.
6. **Strict typecheck:** `WAIST_Y` is declared but never read (kit-mill-v2.ts, line 41).
7. **The shelf's format.** Use the `@hm/matstack` types (OPUS_NOTE_42), so the shelf and the kit's `mat:` ids resolve in the game when the renderer lands.

## v4 (argo-ticket40-v4-bundle.json, the same day)
`shots/40/mill-v4-compare.png` is drawn through the game's real layered renderer at rank 2, with the lab's reflections. Your `mat:` slots and `lx:` lamps are now what the game draws, not stand-in colours.

**Fixed:** every v3 point except the two below.
- 2.80 m, today's footprint.
- Stripes at the base.
- The red status lamp and the pink cartridge slot glow.
- `hull-steel` stays steel.
- `WAIST_Y` is gone.
- Every material resolves, and validate() finds nothing floating: 76 parts in 13 draw calls.

**To fix before it lands:**
1. **Strict typecheck:** `kit-modules.ts` line 444. `Object.freeze({ ... })` widens `kind: 'param'` to `string`, so `MATSTACK_TEST_PIECE_KIT` is not a `Kit`. Annotate the literal as `Kit` (or `kind: 'param' as const`).
2. **`kits.test.ts` fails** ("defines the 4d two-material trim palette"): it still expects the palette's two materials, and v4 adds khaki-paint and hopper-slate. Update that test with the palette.
3. **The body reads as rust-brown speckle, not khaki.** The shader is right: its mask view matches matstack pixel for pixel (`scripts/test-layered-material.mjs`). It is the shelf's coverage. `shots/41/material-coverage.txt` (`node --import tsx scripts/material-coverage.mjs`) gives every layer's mean weight on a 2.8 m machine, with the game's own noise:
   - **Rust bloom** covers 67% of every big face (cells noise alone). A bloom should be small patches, about 5 to 15%: cells times crevices or edges, or a lower balance.
   - **Oil leaks** cover about 40% of faces. Leaks are streaks under edges and crevices.
   - **Soot** is 0% everywhere (furnace, oily-engine, slatted grille), so the layer never shows.
   - **The ore bed's moon dust** covers 84% of its tops, so the hopper reads as a light tray. Ore is dark: keep the dust off it, or keep it very light.
   - **Holding well:** edge wear (88% on edges, 0% on faces), grime in creases (78%), dust and frost on tops (72 to 88%), and splash-zone dirt (80% at 10 cm above the foot, 0% on faces).
   - **Scales:** `NOISE_FEATURES` in matstack says how many features each noise has per repeat (clouds 4, cells 7, speckle 32, scratches 23). A mask's `scale` divided by that count is the feature size: your rust bloom's 0.18 m on cells makes 2.6 cm blobs, which read as speckle at machine distance.
4. **The hazard stripes are flat yellow** until the `stripes` tile exists (TICKET-41). Expected.

## How the review was done (so it can be repeated)
- `node scripts/parts-reference-sheet.mjs [out] [dev server] [ids]`: every generator at ranks 0, 1, 2 and from behind, each slot in its own colour.
- `node scripts/kit-compare-sheet.mjs <kind> <kit module> <export> <preset> [out] [dev server] [standins]`: the kit beside today's machine from four sides, plus the materials that do not resolve and validate()'s issues.
- `node scripts/machine-reference-sheet.mjs`: today's machines from four sides.
