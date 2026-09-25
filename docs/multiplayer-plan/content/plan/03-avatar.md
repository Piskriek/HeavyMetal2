# 3 · Modular Goblin Avatar Compositor

> **Revised:** DNA is now v2 (painted parts + nudge block) and the generator is versioned. See §8 Q10 and §9. The v1 details below still describe the frozen v1 wire format.

Sources: **`src/hmgp2/goblin-dna.ts`** (codec + generator) and **`src/hmgp2/goblin-compositor.ts`** (layer registry + SVG composer + rasterizer).

## 3.1 Layer pipeline & z-index

| z | Layer | Items (catalog index order — append-only) | Colour channels | Optional |
|---|---|---|---|---|
| 0 | `background` | workshop-wall · furnace-glow · racing-pennants · smog-sky | accent | no |
| 1 | `ears` | bat-pointed · notched-fins · torn-brass-ring · droopy-hound | skin, metal | no |
| 2 | `head` | angular · bloated · scrawny | skin | no |
| 3 | `warpaint` | none · mud-stripes · red-handprint · cog-tattoo · soot-smudges | — | yes |
| 4 | `mouth` | lower-tusks · gold-jags · cigar-stub · stitched-scar | metal | no |
| 5 | `nose` | hooked-beak · warted-bulb · prosthetic-plate | skin, metal | no |
| 6 | `eyes` | bloodshot-crazy · narrow-squint · wide-mismatched · sleepy-lidded | accent, skin | no |
| 7 | `eyewear` | none · goggles-up · goggles-down · brass-monocle · leather-eyepatch | leather, metal | yes |
| 8 | `hair` | none · grease-mohawk · mutton-chops · singed-topknot · wire-tufts | accent | yes |
| 9 | `headgear` | none · aviator-cap · miner-headlamp · pickelhaube · grease-bowler | leather, metal, accent | yes |
| 10 | `neck` | none · spiked-collar · gear-chain · boiler-suit · tool-bandolier | leather, metal, accent | yes |

Why war paint sits at z = 3 (not last as in the brief): paint is *on the skin*, so eyes, nose, tusks and goggles must overlap it. Neck sits last so collars overlap the chin line.

**Geometry parameters from `head`:** each head shape exports `headW` (half-width) and `headTop`; ear, hair and headgear fragments are expressed relative to these, so every combination aligns without per-pair art.

**Occlusion rules** (`AvatarLayerItem.occludes`): any headgear hides `grease-mohawk` and `singed-topknot`; `miner-headlamp` forces `goggles-down → goggles-up`; `pickelhaube + mohawk` is re-rolled to `wire-tufts` by the generator. Rules are data, evaluated in one place (`composeGoblinSvg`).

## 3.2 DNA format — `GOB-XXXX-XXXX-XXXX`

```
48 bits = 12 hex digits
┌────┬──────────────────────────────────────┬──────────┐
│ v4 │ payload: mixed-radix over 15 digits   │ FNV-8 cs │
│ 4b │ 36 bits (3,686,400,000 used states)   │ 8 bits   │
└────┴──────────────────────────────────────┴──────────┘
radix order: background, ears, head, mouth, nose, eyes, eyewear, hair, headgear, neck, warpaint,
             skin(4), accent(8), leather(4), metal(4)
payload = Σ dᵢ · Π_{j<i} radixⱼ                     (little-endian mixed radix)
```

- Plain `Number` arithmetic (max 2⁴⁸ < 2⁵³) — no BigInt, no 32-bit bitwise overflow.
- Checksum catches typos when players share codes in chat; decoding rejects version ≠ 1.
- **Forward compatibility:** new items are appended to catalogs → radix grows → DNA **v2**. `decode` keeps a v1 radix table, so v1 codes decode forever.

## 3.3 Deterministic generation

```ts
generateRandomGoblin(seed: number | string): GoblinAvatarConfig
```

1. `seed` string → FNV-1a-32 → `mulberry32` PRNG (same PRNG the economy sim uses; shared test vectors).
2. Per layer, weighted pick. Optional layers weight "none" high (eyewear 4:3:2:1:1, headgear 4:2:2:1:2) so randoms look like goblins, not costume shops.
3. Compatibility fix-ups (see occlusion rules).
4. Palette picks (skin, accent, leather, metal).

AI opponents get `generateRandomGoblin(\`${lobby.seed}:${slot}\`)` → every client sees the same 100 faces without networking a single portrait.

## 3.4 Rasterization

```
config ─► composeGoblinSvg()  — pure string, <g data-layer data-item> per layer (snapshot-testable in Node)
       ─► createImageBitmap(Blob(svg))  ─► canvas 256² (profile / lobby) · 128² (HUD badge) · 64² (pointer)
       ─► transparentBackground=true ─► THREE.SpriteMaterial for 3D billboards above racers (spectator cam)
LRU cache key: `${dna}@${size}${bg ? '' : ':t'}` — 256 entries ≈ 64 MB worst case at 256², 1 MB at 64²
```

Gradient `id`s are namespaced per DNA when inlined into the DOM (`fg-${dna}`) to avoid collisions; for `<img>` usage we use data URIs so ids are isolated.

## 3.5 Migration of legacy riders

`rivet`, `grub`, `nix`, `sprocket` keep their painted PNGs as **Legend skins** (`AvatarSource = { kind: 'legend', rider } | { kind: 'dna', dna }`). Stat offsets move to "archetype" selection in the Character Creator step 1, so a DNA goblin can still be a Bruiser.

## 3.6 Tests

- Round-trip: 10 000 seeded goblins, `decode(encode(c)) ≡ c`.
- Checksum: flipping any single hex digit is rejected (≥ 99.6 % by construction; exhaustive test over all 12×15 single-digit edits of 100 codes).
- Snapshot: `composeGoblinSvg(generateRandomGoblin(42))` SHA-256 pinned.
- Occlusion: no output contains both `data-item="pickelhaube"` and `data-item="grease-mohawk"`.
