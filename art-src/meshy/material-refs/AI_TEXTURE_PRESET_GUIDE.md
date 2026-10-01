# AI Texture Preset Checkout Guide

> Mandatory: read this file before classifying, reviewing, regenerating, converting or implementing any material-reference image in this directory.

## Source of truth

- Naming grammar: [`docs/TEXTURE_PRESET_NAMING_STANDARD.md`](../../../docs/TEXTURE_PRESET_NAMING_STANDARD.md)
- Machine catalog: [`texture-preset-catalog.json`](./texture-preset-catalog.json)
- Human review registry: [`README.md`](./README.md)
- Mobile rules: [`docs/MOBILE_LOW_RES_MATERIAL_STANDARD.md`](../../../docs/MOBILE_LOW_RES_MATERIAL_STANDARD.md)
- Global sports taxonomy: [`docs/SPORTS_TEXTURE_PRESET_STANDARD.md`](../../../docs/SPORTS_TEXTURE_PRESET_STANDARD.md)

## Required AI behavior

1. Extract the stable `M###` registry ID from the filename.
2. Resolve that ID in `texture-preset-catalog.json` when a record exists.
3. Decode the canonical code from left to right; do not reorder or guess tokens.
4. Treat the catalog channel map as authoritative. Never infer that a pale quadrant is Height, Alpha or Roughness solely by appearance.
5. Use `intendedUses`, `prohibitedUses`, physical scale and runtime tier when judging suitability.
6. Recreate from the recipe record, not by copying accidental generated artifacts, labels, baked lighting or perspective.
7. Keep every channel spatially coordinated from one authoritative pattern/mask system.
8. Preserve palette, sampling, wrap and mip policies.
9. Report missing records, unknown tokens, source-file mismatches and code/field disagreement as validation errors.
10. Identify a preset in output as `<RID> / <canonicalCode>` at least once.

## Code anatomy

```text
HM2-TXP-RID-DOM-MAT-FORM-CH-STYLE-TIER-LAY-COND-PAL-SAMP-RREV
```

Example:

```text
M378 / HM2-TXP-M378-CHR-SKIN-TIL-BCNROH-CELPX-PX256-Q4-CLN-P10-PT-R01
```

This is a character skin tile with BaseColor, Normal, Roughness, AO and Height; retro cel-pixel style; 256-pixel target; four-quadrant reference layout; clean condition; 10-color palette; point sampling; recipe revision 1.

## Legacy coverage

M001–M370 keep stable readable filenames and registry IDs. Canonical catalog aliases are being backfilled incrementally. A missing legacy record is not permission to invent one silently: use the README description, declare the record missing, and create a reviewed catalog entry before production conversion.

M371 onward must receive a catalog entry before a batch is considered complete.

## Review response template

```text
Preset: M### / <canonical code>
Catalog: valid | missing | mismatch
Channels: <resolved list>
Runtime form/tier: <form>, <tier>
Intended use: <short list>
Decision: pass | constrained pass | regenerate
Reason: <material and production evidence>
```
