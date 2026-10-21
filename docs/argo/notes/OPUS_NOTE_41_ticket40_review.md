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

## How the review was done (so it can be repeated)
- `node scripts/parts-reference-sheet.mjs [out] [dev server] [ids]`: every generator at ranks 0, 1, 2 and from behind, each slot in its own colour.
- `node scripts/kit-compare-sheet.mjs <kind> <kit module> <export> <preset> [out] [dev server] [standins]`: the kit beside today's machine from four sides, plus the materials that do not resolve and validate()'s issues.
- `node scripts/machine-reference-sheet.mjs`: today's machines from four sides.
