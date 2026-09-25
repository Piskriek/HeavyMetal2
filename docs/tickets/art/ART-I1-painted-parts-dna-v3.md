# ART-I1: Register the painted goblin parts (DNA v3) and add tint masks

- **Priority**: High · **Type**: code (runs after the art PR with ART-B1 and ART-B2 is merged)
- **Conflicts with**: anything editing `src/game/meta/goblin-dna.ts` or `painted-parts.ts`
- **Needs art**: No (uses ART-B1/B2 outputs)

## Goal
Make the ~40 painted parts from ART-B1/B2 selectable in the Goblin Creator without breaking a single
existing DNA code, and let painted skin, hair and accents follow the swatches.

## Evidence
- `src/game/meta/goblin-dna.ts:54`: DNA v2's radix is `AVATAR_CATALOG[k].length`, the **live**
  catalog length. Appending any item silently changes what every v2 code decodes to.
  `V1_SIZES` (line 43) shows the fix already used for v1: freeze the sizes.
- `src/game/meta/painted-parts.ts`: `PAINTED_PARTS` declares only the six original parts; everything
  ART-B1/B2 produce is unregistered.
- Plan §9.6 (docs/multiplayer-plan/content/plan/09-avatar-png-pipeline.md): tint masks by hue band.

## Solution
1. **DNA v3.** Freeze `V2_SIZES` (the current catalog lengths) exactly like `V1_SIZES`; v2 decoding
   uses them forever. Add v3 with a wider payload (bump the header so it fits; keep the
   `GOB-XXXX-XXXX-XXXX[-…]` shape, append-only indices). `encodeGoblinDna` writes v3; v1 and v2 codes
   still decode to the same goblins (test with fixed codes).
2. **Catalog.** Append one `painted:<id>` item per new part to its layer in `AVATAR_CATALOG`
   (append only, never reorder). Backgrounds are painted panels: `painted:background-*`.
3. **Registration.** Add a `PAINTED_PARTS` entry per part with the pivot, anchor and width noted in
   the batch files. Ears: one PNG, drawn mirrored for the right ear. Headgear: `hidesHair` where the
   crown covers the scalp.
4. **Tint masks** (plan §9.6). A build step (`scripts/key-art.ts --masks` or a sibling script)
   classifies each keyed master by hue band into an RGBA mask PNG (R skin, G leather, B metal, A
   accent). The compositor draws the base PNG, then the swatch colour masked by the channel with
   `mix-blend-mode: color`. Parts that fail classification stay `skinLocked`.
5. **Registration QA** (plan §9.4): render every part on all three head shapes; the pivot lands within
   2 px of its anchor and the part's box stays inside the 256² frame. Output a contact sheet.

## Files allowed to change
`src/game/meta/goblin-dna.ts`, `painted-parts.ts`, `goblin-compositor.ts`, `interfaces.ts`,
`scripts/key-art.ts` (or a new mask script), `tests/goblin-dna.test.ts`, new `tests/painted-parts.test.ts`.

## Must NOT change
Any v1 or v2 DNA decoding result. `public/avatar-parts/keyed/*` (the art PR's output).

## Acceptance
- [ ] A fixed list of v1 and v2 codes decodes to identical configs before and after (test).
- [ ] Every painted part is selectable in the creator and composes on all three heads, pivot within
      2 px of its anchor (test over `PAINTED_PARTS`).
- [ ] 10,000 random v3 goblins round-trip; one-character mutations fail ≥ 99.6 % (existing tests).
- [ ] A painted green ear shows the chosen skin tone (manual check in the creator, screenshot in PR).

## Tests to run
`node --import tsx --test tests/goblin-dna.test.ts tests/painted-parts.test.ts tests/goblin-creator.test.tsx`, then `node scripts/check.mjs`.
