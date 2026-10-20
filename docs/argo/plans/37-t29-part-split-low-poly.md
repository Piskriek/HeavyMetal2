# 37: TICKET-29, part-split low poly (Opus decision, 2026-10-20)

Argo's ticket ([ARGO_NOTE_31](../notes/ARGO_NOTE_31.md), bundle in `arena-gathered/argo-ticket29/`) is right about the problem and the shape of the fix: cut each machine into its parts, rebuild every part's low cage alone, and rejoin them without welding across parts (still 1 draw call). This doc records what we measured, the licence check, and how it plugs into the pipeline we already have.

## 1. What we measured
- **Every source is one fused skin.** `zips/runworld/assets/<id>/norm.glb` for fabricator-frame, capacitor-bank, generator-small-a, gantry-crane-solid-a, crawler-body and chiller-block: 40,000 triangles each, **1 connected island**. Their shipped `low.glb` (300 to 3,000 triangles) is also 1 island.
- **So a crease split can't find the parts.** Argo's `scripts/blender-part-split-retopo.py` splits on concave dihedral angles of 50 degrees or more. On a marching-cubes skin, the web between two parts is a smooth fillet spread over many small faces, none past 50 degrees. Meanwhile it does cut real hard inner corners (the inside of one box). Its `edge_face_add` over every open boundary at once also bridges unrelated loops. A learned 3D part segmenter is needed.
- **The low level is not made where the ticket assumes.** Low lives at `apps/web/src/assets/gen/<id>.glb` (inlined) or `hd/<id>/low.glb` (on demand). `scripts/runworld-post.mjs` makes it: `lod-bake.py --retopo=0 --planar=4` rebuilds a cage, unwraps it, and bakes the full model's colour and normals at 512 px. `slim-glb` packs it, and the luminance gate and box snap check it. A separate script would skip the bake and the gates. There is no `public/hd/<id>.glb` and no `public/models/`.

## 2. Licence check (owner rule: legal only; research first)
| Tool | Licence | Use |
|---|---|---|
| [P3-SAM / X-Part (Hunyuan3D-Part)](https://github.com/Tencent-Hunyuan/Hunyuan3D-Part) | Tencent Hunyuan 3D-Part Community Licence (not valid in the EU, UK, South Korea) | **Yes**: the same licence family as the Hunyuan models the 3D PC already runs |
| [SAMPart3D](https://github.com/Pointcept/SAMPart3D) | MIT | Fallback segmenter (slower: it distils 2D SAM per shape) |
| [HoloPart](https://github.com/VAST-AI-Research/HoloPart) (code and [weights](https://huggingface.co/VAST-AI/HoloPart)) | MIT | Later, to complete hidden part surfaces; needs a face mask from a segmenter |
| [meshoptimizer / gltfpack](https://github.com/zeux/meshoptimizer) | MIT | Already used (slim-glb) |
| [QuadriFlow](https://github.com/hjwdzh/QuadriFlow) | BSD-style | Possible, not needed yet |
| [PartField](https://github.com/nv-tlabs/PartField) | NVIDIA Licence, non-commercial only | **No** |
| [MeshAnything V2](https://github.com/buaacyw/MeshAnythingV2) | S-Lab Licence 1.0, non-commercial only | **No** |
| [SAMesh](https://github.com/gtangg12/samesh) | No licence file (all rights reserved) | **No** |

## 3. The plan
1. **Segment on the 3D PC (RTX 3080, 12 GB):** P3-SAM in its own folder and venv on E: (`E:\AI\p3sam`, HF cache on E:, since C: has 22 GB free). It is never mixed into the Hunyuan pipeline's environment. Output: a per-face part id for `norm.glb` (`parts.npy`, saved as `parts.json` next to it). It runs only when the worker lock is free and the pipeline's VRAM gate is not in use.
2. **`lod-bake.py --parts=<parts.json>` (new option, low level only):** separate `norm.glb` by part id, then run the existing cage rebuild (`--retopo=0 --planar=4`, collapse to budget) on each part. Each part's budget is its share of area, floor 12. Join without welding, then do the existing unwrap, colour and normal bake, slim-glb, luminance gate and box snap unchanged. Mid and high stay as they are.
3. **Opt in per asset:** `"lowParts": true` in `docs/runworld/assets.json`. `runworld-post.mjs` passes `--parts` when the asset has it and a `parts.json` exists.
4. **Trial first:** fabricator-frame, capacitor-bank, gantry-crane-solid-a, crawler-body. Compare old and new low in a 4-angle render, plus triangles, KB and luminance. Roll out only if the parts read crisp and the bake holds.
5. **Later:** HoloPart (MIT) or X-Part to close each part's hidden faces where a part was occluded in the fused skin.

## 4. What to keep from the bundles
- `packages/studiomesh/src/part-split-retopo.ts`: keep `auditSingleMeshMultiPartAsset` as the Studio's webbing **audit** (it ranks which assets to fix). Its segmenter has the same crease limits, so the Studio inspector should show the P3-SAM parts, not its own split.
- `scripts/blender-part-split-retopo.py`: not used; its per-part decimate idea lives on in `lod-bake.py --parts`.
- `scripts/retopo-multipart-on-3dpc.mjs`: replace with a P3-SAM runner over `test-on-3dpc.sh`'s SSH setup, with the right paths.
- TICKET-30 (BYOA MCP protocol, the asset bench Regenerate button): it is Studio section 9 work, queued after the planned work. The Regenerate button should call `runworld-post.mjs <id> --levels=low`, which picks up `--parts` by itself.
