# Mobile and Low-Resolution Material Standard

## Purpose

This tier preserves the project's material identity on low-end machines and phones. It is authored deliberately for small texture footprints rather than produced by blindly shrinking desktop textures.

## Registered texture tiers

| Tier | Typical use | Maximum source set |
|---|---|---|
| Mobile hero | Goblins, player vehicle, major interactive props | `256 × 256` per packed texture set |
| Mobile standard | Repeated environment, track, buildings, common props | `128 × 128` per packed texture set |
| Mobile atlas | Foliage cards, decals, markings and repeated small props | `256 × 256` atlas, normally 8–16 elements |
| Emergency low | Distant scenery and memory-pressure fallback | `64 × 64`, derived from an approved 128 source |

A material may use a rectangular `128 × 256` allocation when grain or wrapping direction benefits from it. The total texel area should remain comparable to the target tier.

## Visual rules

1. Design BaseColor around four to six dominant color/value groups.
2. Judge every source at `128 × 128`, `64 × 64`, and through generated mip levels.
3. Use large clustered condition shapes. Do not distribute uniform micro-noise.
4. Exaggerate broad material identity: bark grooves, rubber ribs, rock planes, cloth crossings and paint islands.
5. Keep Normal detail low-frequency and low amplitude. Geometry carries major silhouettes.
6. Group Roughness into clear material regions rather than noisy pixel-level variation.
7. Avoid features narrower than two texels at the intended runtime tier.
8. Remove tiny cracks, pinholes, hairs, isolated specks and subpixel scratches.
9. Preserve the project's restrained palette, with selective acid-green and racing-color accents.
10. Do not bake lighting, reflection, AO shadows or directional highlights into BaseColor.

## Alpha and foliage

- Use thick silhouettes, broad leaves and compact clusters.
- Remove unnecessary internal holes and hair-thin stems.
- Pad every atlas element generously to protect lower mip levels.
- Generate alpha-coverage-preserving mipmaps.
- Prefer alpha clipping or alpha-to-coverage over expensive transparent blending where acceptable.
- Provide simplified geometry or opaque impostors for the farthest LODs.

## Packing and runtime

The preferred mobile packed set is:

- texture A: sRGB BaseColor plus Alpha;
- texture B: linear tangent Normal, with optional reconstructed Z;
- texture C: linear packed Roughness, Metallic, AO, and material mask.

Where memory is constrained, AO may be omitted and derived from authored vertex color or baked lighting probes. Height is an authoring reference and should not require parallax on the mobile tier. Expensive clearcoat, refraction, subsurface scattering and view-angle color effects must have inexpensive scalar or lookup-based fallbacks.

## Validation gate

A mobile material passes only when:

- its identity remains obvious at `128 × 128`;
- the `64 × 64` fallback does not become grey noise;
- mips do not shimmer during camera motion;
- alpha coverage remains stable;
- channel coordinates agree;
- compression does not create dominant blocks or halos;
- it reads under the game's modest and cinematic lighting presets;
- GPU cost and texture residency fit the active platform budget.

High-resolution and mobile materials remain recursively linked presets. Editing the parent material may propagate broad palette and condition changes, but the mobile child keeps hand-authored frequency limits, masks and packing decisions.

## Nostalgic PBR variants

Nostalgic style presets are first-class material children, not post-process filters. They may use deliberate pixel clusters, limited palettes, ordered or hand-placed dithering, chunky painted shapes, hard texel transitions and era-inspired color ramps while retaining physically useful material channels.

- BaseColor carries the nostalgic palette but no baked illumination or highlights.
- Normal uses broad stepped forms; noisy modern microdetail is removed.
- Roughness and Metallic remain materially plausible, though grouped into bold bands.
- Alpha silhouettes must preserve intentional pixel steps through mip generation.
- Emissive uses compact palette ramps without baked bloom.
- Dither patterns must be evaluated under texture compression and at every target mip.
- Point sampling is optional per preset; filtered and point-sampled variants share the same recursive parent.
- Era-inspired presentation must not require unstable affine warping, shimmer or reduced gameplay readability.

The planned nostalgic family covers early pixel-painted 3D, 16-bit dithered nature, fifth-generation console surfaces, colorful arcade racing, early-2000s glossy plastics, hand-painted fantasy materials, retro cel-banded Goblin skin, limited-palette effects and CRT-era condition overlays.