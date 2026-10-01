# Sculptable and Paintable Interface Preset Standard

## Core rule

The interface is a recursively editable preset, not a fixed skin. The same adaptive paint, sculpt, stamp, material, condition, style and local-AI operations used for worlds, objects, parts, textures and Goblins also operate on interface scenes and components.

The canonical visual baseline remains `docs/interface-concepts/SCENE_FIRST_PROMPT_REFERENCE.md`: bright-white 3D stage, dominant scene canvas, compact six-button square toolbar, at most one shallow contextual drawer, detachable deeper drawers, sharp corners, restrained Goblin character and no window clutter.

## Interface preset graph

```text
Interface preset
├── stage / white room
├── canvas viewport
├── toolbar preset
│   └── icon-set preset
├── contextual drawer preset
│   ├── controls
│   └── icon-set preset
├── detachable deep drawers
├── typography preset
├── racing-line accent preset
├── connector / rivet material preset
├── inhabited-detail preset
└── accessibility and input preset
```

Every node may be detached, duplicated, painted, sculpted, restyled, reverted or saved as a child preset. Parent edits propagate unless a child explicitly overrides that property.

## Sculpt operations

Sculpting an interface changes structured geometry rather than painting fake depth:

- panel width, height, thickness and depth;
- straight edge profiles and machined bevel amount;
- drawer docking tracks and detachable anchors;
- toolbar spacing and button footprint;
- viewport framing and negative-space allocation;
- smooth metal connectors and gold-rivet placement;
- white wall/floor transitions;
- icon stroke weight, silhouette thickness and optical centering.

Sharp square corners remain the default. A preset may expose corner style as an override, but the approved HeavyMetal2 interface may not silently revert to rounded cards or pills.

## Paint and material operations

Interface painting supports:

- restrained white-surface value changes;
- vibrant perspective racing lines;
- selective acid-green Goblin tags;
- sparse scratches, handprints and graffiti;
- controlled paint spills that reveal limited jungle PBR growth;
- preview and thumbnail PBR materials;
- metal connectors and gold rivets;
- icon palette swaps and state colors;
- dirt, wear and recovery layers with per-component masks.

Paint must not turn the whole interface into a noisy texture or neon glow treatment. Functional readability and negative space have priority.

## Custom icon-set presets

Icon sets are semantic libraries, not baked toolbar screenshots. Each icon record includes:

- stable semantic action ID;
- canonical preset code and revision;
- base silhouette and optical bounds;
- normal, hover, active, disabled, warning and selected states;
- stroke/fill/material parameters;
- point, bilinear, SDF or vector rendering policy;
- minimum readable size and touch target;
- light/dark contrast metadata even when the approved interface is white;
- accessibility label and non-color state cue;
- input variants for pointer, touch, controller and keyboard.

Required initial families:

1. scene and preset navigation;
2. paint, sculpt, stamp, erase and sample;
3. material, texture and channel editing;
4. Goblin Creator anatomy, wardrobe and cosmetics;
5. vehicle and track construction;
6. weather, season, media and recovery;
7. destruction, carving, support and repair;
8. sports surfaces, markings, equipment and venue tools;
9. local-AI generate, vary, bake, validate and revert;
10. drawer detach, dock, close and clean-canvas controls.

## Icon art styles

Every semantic family may have coordinated variants:

- clean machined white-interface icons;
- mobile low-resolution icons;
- nostalgic pixel/dithered icons;
- Goblin punk paint icons;
- high-contrast accessibility icons;
- material-preview icons with restrained PBR.

Changing style must never change action meaning. A resolver maps semantic IDs to the selected icon-set child preset.

## Paintable icon construction

Icons may be painted using layers for silhouette, inset, accent, condition and state. Sculpting may alter stroke weight, bevel, cutout depth and silhouette proportions within semantic guardrails. Validation rejects:

- unreadable silhouettes;
- state changes communicated only by color;
- generated words or accidental labels;
- trademarked logos;
- detail that disappears below the registered minimum size;
- inconsistent meaning across style families.

## Preset encoding

Interface assets use domain `UI` in the canonical texture/preset naming system. Recommended material tokens include `ICON`, `TOOLBAR`, `DRAWER`, `STAGE`, `ACCENT`, `STATE`, `TYPE`, `CURSOR` and `WIDGET`.

An icon family example:

```text
HM2-TXP-M###-UI-ICON-ATL-BCNRAE-MOB-PX256-AT16-CLN-P06-BL-R01
```

The machine catalog must record semantic action IDs and state mapping in addition to the standard reconstruction recipe.

## Runtime and bake behavior

- Keep the scene canvas clean by allowing every nonessential drawer to close or detach.
- Bake selected interface presets into efficient atlases/SDFs while retaining editable source graphs.
- Preserve a mobile atlas and a high-contrast fallback.
- Validate icon meaning at 16, 24, 32 and 48 logical pixels and touch targets at platform minimums.
- Keep typography runtime-generated; icon textures must not contain labels.
- Local AI may propose variants but may not remap semantic action IDs.
