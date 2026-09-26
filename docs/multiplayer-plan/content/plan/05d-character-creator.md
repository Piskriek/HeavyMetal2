# 5D · `CharacterCreatorModal.tsx`

Opens from: Profile "Edit Goblin", Racer Slots "+ Create racer", and post-retirement flow (pre-seeded descendant). Two-step wizard for new racers, single step (appearance only) for edits.

## 5D.1 Step flow

```
NEW RACER:   ① Archetype (stats) ─► ② Appearance ─► ③ Name & Title ─► Confirm (slot N)
EDIT:        ② Appearance only (name locked; title selectable from earned titles)
```

Step ① reuses the existing `RIDERS` stat offsets as **archetypes** — Mechanic (balanced), Daredevil, Bruiser, Rocket Jockey — shown as the current `rider-card` deck with stat bars from `loadoutStats()`; the art on each card is a *silhouette*, since the face comes from step ②.

## 5D.2 Appearance layout (1280 × 800 modal)

```
┌─ CREATE YOUR GOBLIN · Step 2 of 3 ─────────────────────────────────── [🎲 Randomize] [✕] ┐
├──────────────────────────┬──────────────────────────────────────────────────────────────┤
│ PORTRAIT STAGE (440)     │ LAYER RAIL (vertical tabs)  │  ITEM GRID for selected layer    │
│ ┌──────────────────────┐ │ ▸ Background                │ ┌────┐┌────┐┌────┐┌────┐┌────┐   │
│ │                      │ │ ▸ Ears                      │ │none││ ⌐■ ││ ◎◎ ││ ◉  ││ ▬  │   │
│ │   live composite     │ │ ▸ Head & Skin               │ │    ││ up ││down││mono││patch│  │
│ │   256² scaled ×1.6   │ │ ▸ Mouth & Tusks             │ └────┘└────┘└────┘└────┘└────┘   │
│ │                      │ │ ▸ Nose                      │  (each tile = that item rendered  │
│ │                      │ │ ● Eyes & Eyewear            │   on YOUR current goblin, 96²)    │
│ └──────────────────────┘ │ ▸ Hair & Facial Hair        │                                   │
│ Preview as: [Portrait]   │ ▸ Headgear                  │  🔒 tiles show price or badge req │
│ [HUD 128] [Pointer 64]   │ ▸ Neck & Bodywear           │                                   │
│ [Billboard in 3D]        │ ▸ War Paint                 │  COLOUR SWATCHES (context-aware)  │
│                          │                             │  Skin    ●●●●                     │
│ DNA  GOB-1A2B-3C4D-5E6F  │  Lock 🔒 per layer (kept    │  Accent  ●●●●●●●●                 │
│ [⧉ Copy] [⤓ Paste DNA]   │  on Randomize)              │  Leather ●●●●   Metal ●●●●        │
├──────────────────────────┴─────────────────────────────┴───────────────────────────────────┤
│ [◀ Back]           Occlusion note: "Pickelhaube hides the mohawk"          [Next: Name ▶]   │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

## 5D.3 Behaviour

- **Contextual thumbnails:** every item tile is `composeGoblinSvg({...current, layers: {...current.layers, [layer]: i}})` at 96 px — the player sees *their* goblin in each option. Rendered via data-URI `<img>`, memoized by DNA (≈ 5 tiles × 11 layers; cheap string work).
- **Colour swatches** appear only for channels the selected layer `uses` (e.g., Headgear shows Leather + Metal + Accent; Head shows Skin).
- **Randomize** = `generateRandomGoblin(crypto seed)` but respects per-layer locks. Shift-click randomizes only the current layer. History supports undo (Ctrl-Z) for 30 steps.
- **Paste DNA** validates via `decodeGoblinDna` (checksum error → inline "That DNA is smudged — check the code"). Items the player doesn't own are shown with a lock overlay and a "Buy all (N g)" button.
- **Occlusion note** is generated from the same rules used by the compositor, so UI and render never disagree.
- **Name step:** 3–16 chars, `[A-Za-z0-9-']`, server-side profanity + uniqueness within active racers (a numeric suffix is appended like `RIVET-7`). Titles: dropdown of earned titles; new racers get archetype default ("The Mechanic").
- **Confirm:** creates `RacerProfile` (status alive, Elo 1000, provisional 10), consumes the slot, and routes to the Garage to pick a ball preset.

## 5D.4 Accessibility

- Layer rail is a `role="tablist"`; item grid a `role="radiogroup"` with arrow-key navigation (mirrors the existing `rider-deck` radiogroup pattern).
- Each tile has `aria-label="Goggles down, leather strap"`; swatches have names ("Toxic Green"), not just colours.
- Reduced motion: disables the idle blink/ear-twitch animation on the stage.
