# MP-T15: Painted Avatar Parts Chroma-Key Pipeline & Rig Anchors

- **ID**: `MP-T15`
- **Priority**: Medium (Phase B / Asset Pipeline)
- **Track**: Asset Keying & Art Integration
- **Estimate**: 3 days
- **Dependencies**: `MP-T05`
- **Target Files**: `src/hmgp2/chroma-key.ts`, `scripts/key-avatar-parts.ts`, `src/hmgp2/painted-parts.ts`, `tests/avatar-keying.test.ts`

---

## Goal
Implement the production chroma-keying and asset registration pipeline for painted goblin avatar parts. Process raw `#FF00FF` magenta-backed generator outputs, clean fringe halos via YCbCr decontamination, and bind parts to standardized Rig Anchors.

---

## Technical Specification

### 1. YCbCr Chroma-Plane Keyer
- **Key Detection**: Calculate median RGB of a 1% border ring around the image to handle slight generator color drift.
- **Matte Extraction**: Compute Euclidean distance in `(Cb, Cr)` chroma space to keep dark outlines fully opaque.
- **Decontamination**: Mathematically unmix residual magenta from anti-aliased edge pixels ($F = (C - (1-alpha)K)/alpha$).
- **Despill Pass**: Clamp excess magenta cast down to neutral tones without altering goblin skin or brass metals.

### 2. Rig Anchor Binding & Head-Shape Scaling
- Register each part with a normalized `pivot: [u, v]` mapped to standard Rig Anchors:
  `eye-left (104, 130)`, `eye-mid (128, 130)`, `eye-right (152, 130)`, `brow-line (128, 112)`, `crown (128, headTop + 32)`, `nose (128, 160)`, `mouth (128, 188)`, `chin (128, 210)`.
- Headgear scales dynamically with head width: `width = 2 * headW + k`, fitting angular, bloated, and scrawny head shapes seamlessly.

---

## Acceptance Criteria
- [ ] Keyer processes raw parts with 0 residual magenta edge bleed.
- [ ] Trimmed bounding boxes and pivot points align within `≤ 2 px` of Rig Anchors across all 3 head shapes.
- [ ] Downsampling uses premultiplied alpha to prevent dark edge fringing.
- [ ] Processed parts pass `scripts/check-edge-magenta.mjs` with 0 failures.

---

## Tests to Run
`node --import tsx --test tests/avatar-keying.test.ts`
`node scripts/check-edge-magenta.mjs avatar`
