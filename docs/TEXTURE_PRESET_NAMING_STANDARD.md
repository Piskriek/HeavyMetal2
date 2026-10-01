# Texture Preset Naming and Reconstruction Standard

## Purpose

Every texture preset must be identifiable, resolvable and reconstructable without relying on a thumbnail or an informal filename. The system has two linked identifiers:

1. a compact canonical preset code that works like a barcode;
2. a machine-readable catalog record containing the complete recipe and usage contract.

A code is descriptive enough for sorting and routing. The catalog record is authoritative for recreation. Never attempt to infer missing recipe fields from pixels alone.

## Canonical code

```text
HM2-TXP-<RID>-<DOM>-<MAT>-<FORM>-<CH>-<STYLE>-<TIER>-<LAY>-<COND>-<PAL>-<SAMP>-R<REV>
```

Example:

```text
HM2-TXP-M371-ENV-ROCK-TIL-BCNROH-PXL3D-PX128-Q4-WRN-P12-PT-R01
```

The example means: HeavyMetal2 texture preset M371; environment rock; seamless tiling surface; BaseColor, Normal, Roughness, AO and Height channels; early-3D pixel-painted style; intended 128-pixel tier; four-quadrant reference sheet; weathered condition; 12-color palette; point-sampled; recipe revision 1.

### Token order and vocabulary

| Position | Meaning | Examples |
|---|---|---|
| `HM2` | Project namespace | fixed |
| `TXP` | Asset kind: texture preset | fixed |
| `RID` | Stable registry ID | `M371` |
| `DOM` | Primary domain | `ENV`, `VEH`, `CHR`, `BLD`, `VFX`, `UI`, `GEN` |
| `MAT` | Material/content family | `ROCK`, `SKIN`, `METAL`, `TRACK`, `FOL`, `GLASS`, `FX` |
| `FORM` | Runtime use/form | `TIL` seamless tile, `ATL` atlas, `MSK` mask, `DEC` decal, `TRN` transition |
| `CH` | Channels in canonical order | tokens below |
| `STYLE` | Registered art-direction token | e.g. `NAT`, `MOB`, `PXL3D`, `D16`, `Y2K`, `CELPX` |
| `TIER` | Intended longest-side runtime tier | `PX64`, `PX128`, `PX256`, `PX512`, `PX1K`, `PX2K` |
| `LAY` | Delivered reference layout | `Q4` four quadrants, `AT16` sixteen-cell atlas, `SET` packed runtime set |
| `COND` | Dominant condition | `CLN`, `WRN`, `WET`, `DRY`, `RST`, `BRN`, `MIX` |
| `PAL` | Palette contract | `PFULL`, or `P04`–`P64` limited colors |
| `SAMP` | Preferred sampling | `PT` point, `BL` bilinear, `TR` trilinear/aniso |
| `R<REV>` | Recipe revision, not file revision | `R01` |

### Channel tokens

Channel letters are concatenated in this order:

| Token | Channel |
|---|---|
| `BC` | BaseColor |
| `N` | tangent-space Normal |
| `R` | Roughness |
| `M` | Metallic |
| `O` | Ambient occlusion |
| `H` | Height or authoring displacement |
| `A` | Alpha or coverage |
| `E` | Emissive |
| `T` | Transmission/opacity control |
| `D` | Distortion/flow |
| `S` | Subsurface/thickness |

Examples: `BCNROH`, `BCNRA`, `BCNRAE`, `RNAT`, `BCNRS`.

## Filenames

The canonical code is stored in the catalog and metadata. Source filenames remain readable:

```text
<RID>-<short-semantic-name>-<deliverable>.<ext>
```

New sidecars use:

```text
<RID>.preset.json
```

Do not rename legacy image files merely to embed the full code. The stable registry ID joins the readable filename to its catalog record and avoids broken documentation links.

## Reconstruction contract

A receiving system recreates a preset as follows:

1. Parse and validate the canonical code.
2. Resolve `RID` in `art-src/meshy/material-refs/texture-preset-catalog.json`.
3. Verify that every code token agrees with the catalog fields.
4. Read `recipe.intent`, `recipe.required`, `recipe.forbidden`, palette and frequency rules.
5. Rebuild all listed channels from the same authoritative pattern/mask coordinates.
6. Apply declared wrap mode, sampling, alpha treatment and mip policy.
7. Validate at the declared runtime tier and fallback tier.
8. Preserve `parentPreset` and recursive overrides so edits can propagate safely.
9. Increment recipe revision whenever reconstruction output is expected to change.

The generated reference image is evidence and visual guidance. It is not the only reconstruction source.

## Required catalog fields

Every new preset must include:

- stable registry ID and canonical code;
- readable name and source file;
- domain, material family, runtime form and art style;
- channel list and quadrant/packing map;
- target tier, fallback tier and physical scale;
- wrap, sampling, color space, mip and alpha policy;
- palette budget and frequency limits;
- intended and prohibited uses;
- deterministic recipe intent, required features and forbidden features;
- parent preset and recursively editable parameters;
- status, recipe revision and provenance.

## AI checkout rule

Any AI or automation examining these images must read:

1. `art-src/meshy/material-refs/AI_TEXTURE_PRESET_GUIDE.md`;
2. this standard;
3. `art-src/meshy/material-refs/texture-preset-catalog.json`.

It must refer to presets by registry ID and canonical code, must not invent channel semantics from quadrant appearance, and must report code/catalog mismatches as errors.