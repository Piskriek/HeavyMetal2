# 5C · `BallCustomizerModal.tsx` (Garage)

Full-screen modal (100 vw × 100 vh, esc/B to close with unsaved-changes guard). Three-column workbench that mirrors the existing `loadout-workbench` visual language.

## 5C.1 Layout (1440 × 900)

```
┌─ GARAGE · Preset 2 "Lava Lord" ▾ ───────── [↶ Undo] [↷ Redo] ─── [Revert] [💾 Save 1,200 g] [✕]┐
├──────────────────────┬─────────────────────────────────────────────────┬──────────────────────┤
│ LEFT: CATALOG (320)  │ CENTER: 3D PREVIEW STAGE (flex)                 │ RIGHT: INSPECTOR(340)│
│ [Finish][Decals][Cap]│                                                 │ LAYERS (drag reorder)│
│ ── BASE FINISH ──    │         ╭────────────────────────╮              │ ≡ 👁 🔒 Roundel "47"  │
│ ◉ Scrap Iron   free  │        ╱   brass cap (−X)        ╲             │ ≡ 👁 🔒 Crossed wr.   │
│ ○ Galv. Brass 1,200  │       │   ═══ accent pin-line ═══ │  ← gizmo    │ ≡ 👁 🔒 Hazard band  ▲│
│ ○ Damascus   2,500 🔒│       │    [ selected decal ]     │    ring     │ ≡ 👁 🔒 Dual stripes │
│ ○ Obsidian   4,000 🔒│        ╲   brass cap (+X)        ╱             │ (12 max · 4 used)    │
│ ○ Boiler Cu  1,800   │         ╰────────────────────────╯              │──────────────────────│
│ ── DECALS ──         │  view: [Orbit] [Race cam] [Unwrap 2:1]          │ TRANSFORM            │
│ Emblems  ▸ 5         │  roll: [⏸ ▶ spin at race speed]  light: ☀/🌋   │ u   ━━━━●━━━  0.62   │
│ Patterns ▸ 4         │                                                 │ v   ━━●━━━━━  0.41   │
│ Tech     ▸ 3         │ ┌─ UNWRAP MINIMAP (2:1, 360×180) ─────────────┐ │ scale ━●━━━━  0.18   │
│ Roundels ▸ 0–99      │ │ equirect canvas with decal bounding boxes;   │ │ rot   ━━━●━━  35°    │
│ [search decals…]     │ │ shaded bands = hidden under caps; seam line │ │ opacity ━━━━●  90%   │
│ ┌──┐┌──┐┌──┐┌──┐     │ └──────────────────────────────────────────────┘ │ blend [N|×|◐]        │
│ │⚙ ││☠ ││✊││☢ │ drag │                                                 │ tint  ●●●●●●●● [#…]  │
│ └──┘└──┘└──┘└──┘ onto│ STAT NOTE: "Cosmetic only — Siegebreaker physics │ mirror ☐  snap 15° ☑ │
│ ball ▸              │ unchanged" (always visible)                      │ [Duplicate] [Delete] │
├──────────────────────┴─────────────────────────────────────────────────┴──────────────────────┤
│ ACCENT: ●●●●●●●●  · CAP FINISH: [Brass][Gunmetal][Copper][Chrome] · Bake: ✔ 34 ms · 512×256    │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

## 5C.2 Interaction model

**Placement is on the sphere, not on the texture.** Pointer events on the preview raycast the ball mesh; the hit's `uv` (after the axle rotation) gives (u, v) directly.

| Gesture | Effect | Math |
|---|---|---|
| Drag decal from catalog onto ball | Creates `DecalStamp` at hit (u, v), default scale | raycast → `intersection.uv` |
| Drag selected decal | Moves along the surface | Δ(u, v) from successive hits; u wraps mod 1; v clamped to visible band [0.18, 0.82] with a soft "under the cap" warning |
| Gizmo outer ring | Rotate | ρ = atan2 of pointer around the decal's screen-projected centre; `Shift` snaps 15° |
| Gizmo corner handles / wheel | Scale | σ clamped [0.02, 0.6]; band decals scale height only |
| Drag empty ball area | Orbit camera (OrbitControls, damping) | — |
| `Alt`-drag | Roll the ball around its axle | preview the rolling read |
| Unwrap minimap click | Select/move in texture space | inverse of the mapping; shows seam + cap bands |

Gizmo is drawn as a screen-space SVG overlay (not in WebGL) aligned to the decal's projected tangent frame — cheap and crisp.

**Gamepad:** left stick moves u/v, right stick orbits, triggers scale, bumpers rotate, A place/select, X duplicate, Y delete, D-pad cycles layers.

## 5C.3 State

```ts
interface CustomizerState {
  draft: CustomBallConfig;           // bakeKey recomputed via computeBakeKey on each commit
  saved: CustomBallConfig;
  selectedUid: string | null;
  history: { past: CustomBallConfig[]; future: CustomBallConfig[] };   // cap 50, coalesce drags
  bake: { status: 'idle' | 'baking' | 'ready' | 'error'; ms: number; bitmap: ImageBitmap | null };
  ownership: Set<BaseMaterialId | DecalTextureId>;
  cart: { items: (BaseMaterialId | DecalTextureId)[]; total: Gold };  // un-owned items used in draft
}
```

- Every transform commit (pointer-up, slider release) pushes history and posts to the worker; during a drag the worker bakes at **256×128** for 60 fps feedback, then a 1024×512 bake on release.
- **Try-before-buy:** unowned finishes/decals can be used in the draft (watermarked "PREVIEW" strip at the u-seam). Save button becomes "Buy & Save N g", listing the cart. Race use requires ownership (server validates every `CustomBallConfig` against inventory at queue time).
- Validation (client + server): ≤ 12 decals, opacity ∈ [0.1, 1], scale ∈ [0.02, 0.6], roundel number 0–99, hex colours. Invalid configs are *clamped* on load, never rejected (a bad preset must not brick the garage).

## 5C.4 Loading/empty/error

- First open: "Firing up the furnace…" skeleton; worker boot + default bake < 300 ms target.
- Worker failure → fall back to main-thread bake at 512×256 with a small warning chip.
- WebGL context loss → preview replaced by the unwrap minimap (full width) so editing continues.
