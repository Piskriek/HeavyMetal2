# MP-T05: Goblin DNA Codec, Occlusion Rules & SVG Compositor

- **ID**: `MP-T05`
- **Priority**: High (Phase B / Identity)
- **Track**: Avatar Engine
- **Estimate**: 3 days
- **Dependencies**: `MP-T01`
- **Target Files**: `src/game/avatar/goblin-dna.ts`, `goblin-compositor.ts`, `layer-registry.ts`, `rasterize.ts`, `tests/goblin-avatar.test.ts`

---

## Goal
Build a modular 2D goblin avatar generator that compiles 11 swappable anatomical and cosmetic layers into clean SVG and rasterized PNG sprites. Implement a compact 48-bit DNA string codec (`GOB-XXXX-XXXX-XXXX`) with checksum validation for lightweight multiplayer networking.

---

## Technical Specification

### 1. Layer Pipeline & Z-Index Ordering
```
z=0:  background (workshop wall, furnace glow, racing pennants, smog)
z=1:  ears (bat-pointed, notched fins, torn brass ring, droopy hound)
z=2:  head (angular, bloated, scrawny) [defines headW & headTop anchors]
z=3:  warpaint (mud stripes, red handprint, cog tattoo, soot smudges)
z=4:  mouth (lower tusks, gold jags, cigar stub, stitched scar)
z=5:  nose (hooked beak, warted bulb, prosthetic metal plate)
z=6:  eyes (bloodshot crazy, narrow squint, mismatched, sleepy)
z=7:  eyewear (welding goggles up/down, brass monocle, eyepatch)
z=8:  hair (grease mohawk, mutton chops, singed topknot, wire tufts)
z=9:  headgear (aviator cap, miner headlamp, pickelhaube, bowler)
z=10: neck (spiked collar, gear chain, boiler suit, tool bandolier)
```

### 2. Occlusion & Compatibility Rules
- Any headgear automatically occludes tall hairstyles (`grease-mohawk`, `singed-topknot`).
- `miner-headlamp` forces `goggles-down` to flip to `goggles-up`.
- `pickelhaube + mohawk` combination is automatically resolved to `wire-tufts`.

### 3. 48-Bit DNA Encoding (`GOB-XXXX-XXXX-XXXX`)
- 4-bit version header (`v=1`).
- 36-bit mixed-radix payload encoding 11 layer indices + 4 color palette indices.
- 8-bit FNV-1a checksum to detect typos in shared strings.
- Encodes into exactly 12 hexadecimal characters separated by dashes.

### 4. High-Performance Rasterization & Caching
- Compose SVG fragment $	o$ `createImageBitmap(Blob(svg))` $	o$ Canvas.
- Generates 256x256 (Profile / Hub), 128x128 (HUD badge), and 64x64 (mini map pointer).
- LRU cache capped at 256 entries (~64 MB RAM maximum).

---

## Acceptance Criteria
- [ ] 10,000 randomly generated DNA strings round-trip through encode/decode with 100% bit-exact fidelity.
- [ ] Single-character mutations in DNA strings fail checksum validation with `≥ 99.6%` probability.
- [ ] Occlusion rules are 100% respected across 10,000 randomized test avatars.
- [ ] `generateRandomGoblin(seed)` produces identical SVG hashes in both Node.js and browser environments.

---

## Tests to Run
`node --import tsx --test tests/goblin-avatar.test.ts`
