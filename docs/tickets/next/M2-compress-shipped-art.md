# M2: Compress Shipped Art with WebP Conversion and Size Budget Test

- **ID**: `M2`
- **Priority**: Medium
- **Component**: Art Pipeline / Performance / Asset Optimization
- **Conflicts with**: None
- **Needs art**: No

---

## Goal
The `public/art/` asset folder currently consumes 576+ MB of uncompressed and raw PNG assets, inflating repository clones, initial page loads, and memory usage. Convert oversized background paintings, skydome panoramas, UI frames, and still cutout sprites to optimized WebP format with alpha channel preservation, update the asset loader to load `.webp` with transparent fallback, achieve a $\ge 70\%$ bundle size reduction (target $<175$ MB total), and add a size-budget test to enforce limits.

---

## Evidence
- `public/art/`: Contains 576.3 MB across dozens of 2048x1024 skydome textures (`sky_*.png`), 512x512 uncompressed sprites, and high-resolution vistas.
- `src/game/art-manifest.json:1-160`: Points directly to `.png` paths for all cells and sheets.
- No automated CI test currently fails if new assets blow past the total art size budget.

---

## Solution
1. **Automated WebP Conversion Script**:
   - Create `scripts/compress-art-webp.mjs`:
     - Scan `public/art/**/*.png` (excluding active raw source sheets in `sheets/` if needed).
     - Encode to WebP using `sharp` or ImageMagick `cwebp`:
       - Backgrounds & panoramas: lossy WebP at quality 88 with sharp edges.
       - Cutout sprites & UI frames: lossless/near-lossless WebP to preserve sharp crisp alpha edges.
     - Replace or add `.webp` siblings and update `src/game/art-manifest.json` and asset paths.
2. **Asset Loader Update**:
   - In `src/game/art-assets.ts` and `src/game/renderer-3d.ts`, prefer `.webp` with `.png` fallback.
3. **Size Budget Test**:
   - Create `tests/asset-budget.test.ts`:
     - Measure total size of shipped production assets.
     - Assert total size of `public/art` is below 180 MB.
     - Assert no individual sprite file exceeds 15 MB.

### Files Allowed to Change
- `scripts/compress-art-webp.mjs` (new file)
- `tests/asset-budget.test.ts` (new file)
- `src/game/art-manifest.json`
- `src/game/art-assets.ts`
- `public/art/**`
- `package.json`

### Must NOT Change
- Alpha transparency and edge matte despill rules from `docs/ART_PIPELINE.md` Section 9

---

## Acceptance Criteria
- [ ] Total disk size of `public/art/` decreases from 576 MB to less than 180 MB.
- [ ] Visual fidelity of skydome panoramas, full-body riders, and UI borders remains indistinguishable from original PNGs.
- [ ] `npm run check:edges` passes with zero edge/magenta-bleed violations on the compressed assets.
- [ ] `tests/asset-budget.test.ts` passes and protects against asset bloat.

---

## Tests to Run
- `npm run check:edges`
- `node --import tsx --test tests/asset-budget.test.ts`
- `npm run check:art`
- `node scripts/check.mjs`
