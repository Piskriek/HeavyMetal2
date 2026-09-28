# 9 · Painted Avatar Parts: Magenta-Key PNG Pipeline & Player Nudges

**Try it:** [open the Goblin Studio →](/creator), which includes the live Keying Lab.
Implementation in this repo: `src/hmgp2/chroma-key.ts` (pure keyer) · `scripts/key-avatar-parts.ts` (build step) · `src/hmgp2/painted-parts.ts` (registration) · `goblin-compositor.ts` (nudges and painted layers) · `goblin-dna.ts` (DNA v2).

## 9.1 Why magenta, and why not ask the generator for alpha?

Image generators can't reliably produce true alpha. They fake transparency with a painted checkerboard or return opaque images. So we ask for a **flat #FF00FF field** and key it ourselves:
- Magenta is the colour least likely to appear in this art direction: goblin skin is green or ochre, leather is brown, metal is brass or steel, lenses are cyan or green. It's also maximally distant in chroma from all of those.
- Keying in the YCbCr chroma plane separates magenta from dark outlines cleanly (outline Cb/Cr ≈ 128, magenta ≈ 212/235).
- Hard rule enforced by QA: **no pink, purple or magenta anywhere in the art.** Accent regions that will later be tinted purple are generated in a neutral red and recoloured at runtime (§9.6).

## 9.2 End-to-end pipeline

```
prompt template (per layer) ─► generator ─► raw/  {id}.png|jpg      ← raw kept forever (re-key without regenerating)
   │                                          │ sniff magic bytes (never trust the extension)
   │                                          ▼
   │                          chroma-key.ts   detectKey → matte → decontaminate → despill → choke
   │                                          ▼
   │                          trim to alpha bbox (+2 px) → premultiplied downsample to 512 master
   │                                          ▼
   │                          QA gate: key drift · residual magenta · border touch · coverage
   │                                          ▼   fail → regenerate with the failing note appended to the prompt
   │                          keyed/{id}.png  + painted-parts.generated.ts (dims + QA)
   ▼                                          ▼
registration (painted-parts.ts): pivot (image space) → rig anchor · width = f(head shape)
                                              ▼
tint-mask pass (§9.6) → atlas pack per layer (2048² WebP-alpha) → catalog JSON (hot-loadable, versioned)
```

## 9.3 Keying algorithm (as implemented)

| Stage | Math | Why |
|---|---|---|
| Key detection | Median RGB of a 1 % border ring | Generators don't hit exact #FF00FF. **Measured:** keys came back as rgb(247–251, 2–3, 229–249). |
| Matte | d = ‖(Cb,Cr) − (Cb_k,Cr_k)‖ + w·\|Y − Y_k\|, α = smoothstep((d − inner)/(outer − inner)); defaults inner 38, outer 92, w 0.25 | Chroma-first keeps dark outlines and shadows opaque |
| Decontamination | F = (C − (1 − α)K) / α for α < 0.98 | Mathematically removes the magenta blended into anti-aliased edges, so there's no pink halo |
| Despill | s = max(0, min(R,B) − G); R −= s, B −= s | Zero for brass, cyan, white and green, so it only touches magenta-cast pixels |
| Choke | α′ = (α + min₄(α))/2, 0–2 passes | Cuts JPEG ringing on outlines |
| Downsample | Premultiplied box filter | Transparent pixels never bleed dark fringes into edges |

**Measured on the six generated parts** (Node, full resolution): 133–245 ms per part, all **PASS**, masters 111–249 KB PNG. The generator ignored the square request: sources came back 1254², 1774×887 and 1536×1024. That's why registration is **bbox + pivot based, never canvas based**.

## 9.4 Registration: pivot → rig anchor

Every part declares:

```ts
{ id, layer, pivot: [u, v] /* 0..1 in the trimmed PNG */, anchor: RigAnchorId, width: (head) => rigUnits, hidesHair?, skinLocked? }
```

- **Rig anchors** (256² space): `eye-left (104,130)`, `eye-mid (128,130)`, `eye-right (152,130)`, `brow-line (128,112)`, `crown (128, headTop+32)`, `nose`, `mouth (128,188)`, `chin (128,210)`. Toggle *Rig guides* in the studio to see them.
- **Why pivots:** the monocle's lens is not the centre of its bounding box (there's a sub-lens arm on the left and a chain below). Centring by bbox puts the chain on the eye, so its pivot is (0.60, 0.30), on the lens centre.
- **Head-shape aware widths:** headgear width = 2·headW + k, so one PNG fits angular (54), bloated (62) and scrawny (44) heads.
- Height always follows the PNG aspect ratio, never stretched.
- **Registration QA (T17):** render each part on all 3 heads with guides, then run an automated check that the part's bbox stays inside the frame and its pivot lands within 2 px of the anchor. The contact sheet goes to art review.

## 9.5 Prompt template (per layer)

```
Isolated 2D game cosmetic asset: {ITEM DESCRIPTION}, seen perfectly from the front{, empty — no head inside}.
Hand-painted cel-shaded illustration style, thick dark outlines, {symmetrical,} centered, filling about {FILL}% of the width.
Palette rules: skin = flat toxic green #7fb24a family · leather = dark brown · metal = brass/steel · accents = neutral red.
Background: perfectly flat solid pure magenta #FF00FF filling the entire image edge to edge, no gradient, no shadow,
no floor, no vignette, no texture. The object contains absolutely no pink, purple or magenta tones. No text, nothing else in frame.
```

| Layer | Fill % | Symmetric | Pivot convention | Notes |
|---|---|---|---|---|
| eyewear (pair) | 70 | yes | lens midpoint | strap stubs only; full straps fight headgear |
| eyewear (single) | 45 | no | lens centre | chains hang down: pivot top-third |
| headgear | 60–75 | yes | brow contact line | "empty, no head inside"; the face opening must key through |
| mouth | 70 | yes | mouth centre | **no pink tongue or gums** (would key out) |
| neck | 80 | yes | top-centre | crescent/bib shapes |
| ears (future) | 45 per side | generate one, mirror | root of ear | generate the LEFT ear only, mirror in build for perfect symmetry |
| hair (future) | 60 | mostly | scalp line | back-hair and front-hair as two PNGs sandwiching the head |

**Failure feedback loop:** QA notes are appended to the prompt on retry, e.g. "previous attempt contained magenta tones in the lens — make lenses cyan". Up to 3 retries, then escalate to a human.

## 9.6 Recolouring painted art: tint masks

Painted parts currently ignore the swatches. The studio flags this: the gold-tusk grin has painted green lips and shows a **skin** warning badge on non-green goblins.
- **Build step:** classify pixels of the keyed master by hue band into channel masks. Skin = hue 70–140° with sat > 0.25; leather = hue 15–40° with low value; metal = hue 35–55° with high saturation; accent = red band. Write them as one RGBA mask PNG (R = skin, G = leather, B = metal, A = accent).
- **Runtime (SVG):** inside an isolated group, draw the base PNG, then a rect filled with the target colour, masked by the channel mask with `mix-blend-mode: color`. The *color* blend keeps the painted luminance (shading and highlights) and swaps hue and saturation, so one PNG gives every palette.
- Parts that fail classification (mask coverage too noisy) are marked `skinLocked`/fixed-colour and only offered with compatible palettes.

## 9.7 Shipping format

- Per-layer atlas, 2048², WebP with alpha (typically much smaller than PNG — measure the actual saving in T17 before committing), shelf-packed with 4 px padding and edge extrusion to stop mip bleeding in the 3D billboard.
- The catalog is JSON data (item → atlas rect, pivot, anchor, width formula id, masks, price, unlock). It's hot-loadable, so new parts ship without a client release. DNA v2 indices append-only; retired items stay decodable forever.
- Budget: v1 target ~60 painted parts ≈ 60 generations + ~25 % retries ≈ 75 generations, ~12 MB masters (60 × ~200 KB, from the measured 111–249 KB), shipped atlas size to be measured.

## 9.8 Player nudges: up, down, sideways, and spread

Players can shift features after picking them. Implemented in the studio: drag on the portrait, arrow keys, or the D-pad; Shift+←/→ or Alt-drag for spread.

| Nudgeable layer | Step (px in 256² rig) | Range | Spread? | Parent |
|---|---|---|---|---|
| ears | 4 | ±3 | ✔ (4 px) | — |
| eyes | 3 | ±3 | ✔ (2 px) | — |
| eyewear | 3 | ±3 | inherits eyes | **eyes** (moves with the eyes, then its own offset) |
| nose, mouth, hair, headgear, warpaint | 3–4 | ±3 | — | — |
| background, head, neck | fixed | — | — | structural |

- **Why bounded steps, not free pixels:** (1) every combination stays on-model and inside the frame; (2) it encodes compactly; (3) the server can validate it (rejects anything out of range); (4) it's identical across screens and resolutions.
- **Spread without per-item art:** the layer is rendered twice through clip-paths. The left half shifts −s and the right half +s, and for s > 0 a centre strip back-fills bridges (goggle straps, monocle chains). This works for SVG and painted parts alike, with no extra assets.
- **Parenting:** `NUDGE_PARENT = { eyewear: 'eyes' }`. Spread the eyes and the goggles follow; nudge the goggles and only they move. Headgear is deliberately *not* parented to hair.
- **DNA v2 nudge block:** 8 layers × (x, y) + 2 spreads = 18 radix-7 digits (≈ 50.5 bits < 2⁵³, safe in a JS Number), base-36 encoded as 10 chars plus a 2-char checksum **seeded by the head segment**, so a nudge block can't be pasted onto another goblin. No nudges → the short v1-compatible form. Tested: 5,000 random round-trips, and 600/600 single-character corruptions rejected.
- **Where nudges apply:** portrait, HUD badge, off-screen pointer, 3D billboard and PNG export all go through the same `composeGoblinSvg`, so a nudge is never "lost" on one surface.
- **Gamepad:** left stick = nudge, right stick left/right = spread, L3 = reset layer, Select = reset all.
