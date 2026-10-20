# 37: TICKET-29, low poly without webs: modular kits, not a retrofit split (Opus decision, 2026-10-20)

Argo's ticket ([ARGO_NOTE_31](../notes/ARGO_NOTE_31.md), bundle in arena-gathered/argo-ticket29/) asked to cut each fused machine into parts, rebuild each part's low cage alone and rejoin them. We built and measured that (sections 1 to 3). It made every model worse, so the decision is section 4: repeated modules are generated once and assembled in code (the owner, 2026-10-20: 'why are we not just making one capacitor block and placing 6 of them?').

## 1. What we measured
- **Every source is one fused skin.** `zips/runworld/assets/<id>/norm.glb` for fabricator-frame, capacitor-bank, generator-small-a, gantry-crane-solid-a, crawler-body and chiller-block: 40,000 triangles each, **1 connected island**. Their shipped `low.glb` (300 to 3,000 triangles) is also 1 island.
- **So a crease split can't find the parts.** Argo's `scripts/blender-part-split-retopo.py` splits on concave dihedral angles of 50 degrees or more. On a marching-cubes skin, the web between two parts is a smooth fillet spread over many small faces, none past 50 degrees. Meanwhile it does cut real hard inner corners (the inside of one box). Its `edge_face_add` over every open boundary at once also bridges unrelated loops. A learned 3D part segmenter is needed.
- **The low level is not made where the ticket assumes.** Low lives at `apps/web/src/assets/gen/<id>.glb` (inlined) or `hd/<id>/low.glb` (on demand). `scripts/runworld-post.mjs` makes it: `lod-bake.py --retopo=0 --planar=4` rebuilds a cage, unwraps it, and bakes the full model's colour and normals at 512 px. `slim-glb` packs it, and the luminance gate and box snap check it. A separate script would skip the bake and the gates. There is no `public/hd/<id>.glb` and no `public/models/`.

## 2. Licence check (owner rule: legal only; research first)
| Tool | Licence | Use |
|---|---|---|
| [P3-SAM / X-Part (Hunyuan3D-Part)](https://github.com/Tencent-Hunyuan/Hunyuan3D-Part) | Tencent Hunyuan 3D-Part Community Licence, but the backbone is [Sonata](https://github.com/facebookresearch/sonata), whose **weights are CC-BY-NC 4.0** (code Apache 2.0) | **No**: the non-commercial weights carry into P3-SAM |
| [SAMPart3D](https://github.com/Pointcept/SAMPart3D) | MIT code and MIT [PTv3-object weights](https://huggingface.co/yhyang-myron/SAMPart3D); uses SAM and DINOv2 (both Apache 2.0) | Legal; not installed (the retrofit it would feed was rejected, section 3) |
| [HoloPart](https://github.com/VAST-AI-Research/HoloPart) (code and [weights](https://huggingface.co/VAST-AI/HoloPart)) | MIT | Legal; not needed (section 3) |
| [meshoptimizer / gltfpack](https://github.com/zeux/meshoptimizer) | MIT | Already used (slim-glb) |
| [QuadriFlow](https://github.com/hjwdzh/QuadriFlow) | BSD-style | Possible, not needed yet |
| [PartField](https://github.com/nv-tlabs/PartField) | NVIDIA Licence, non-commercial only | **No** |
| [MeshAnything V2](https://github.com/buaacyw/MeshAnythingV2) | S-Lab Licence 1.0, non-commercial only | **No** |
| [SAMesh](https://github.com/gtangg12/samesh) | No licence file (all rights reserved) | **No** |

## 3. The retrofit split, built and measured (rejected)
- **What ran:** CoACD (MIT, Windows wheel, venv `E:\AI\coacd\venv` on the 3D PC) cut each `norm.glb` at its concavities (1.5 to 6 minutes per model); each face took its nearest hull, giving fabricator-frame 11 parts, crawler-body 10, capacitor-bank 12, gantry-crane-solid-a 22. `lod-bake.py --parts` reduced each part on its own share of the budget, rejoined them unwelded, then ran the usual unwrap and bake. Each was compared with the current bake at the same budget in a 4-angle render.
- **Result: worse on all four.** The capacitor bank came out crumpled like paper, the gantry spiky and torn, the fabricator's uprights notched and its crossbar faceted, and the crawler's fin rack spiky (its cab did come out crisper). Two causes: each part's cut border collapses on its own, which opens cracks; and CoACD's cuts are convex pieces, not real parts (it slices the capacitor cans part way up). Locking the borders (`--parts-lock=100`) closed some cracks but blew the budgets (capacitor 2,964 of 2,000; gantry 2,500 of 600) and starved the parts' interiors.
- **The current cage bake is already clean** on these four at their budgets: crisp boxes, the bus bar sharp, no visible web (shots in [shots/37](shots/37/)). The code was removed again (`lod-bake.py` restored, `coacd-parts.py` deleted); it is in commits `cc2a2ae3` and `1d8cc36e` if it is ever wanted.

## 4. The decision: modular kits
A web forms when two parts that should be separate were generated as one skin. So repeated or separable modules are generated once, as their own asset, and assembled in code: instanced or merged into one draw call, with rails, skids, bars and frames as procedural square-section boxes (the owner's square-sections rule). This extends what already works: wheels, the crawler arm, the press rams, relay cabinets and control boxes are already their own assets placed several times.
- **Why it wins:** no gap to melt (the gaps are real), the budget spent once per module (a can at ~400 triangles reads sharper than three cans sharing 2,000), one draw call for the repeats, each module can animate or light on its own (like the lab's coil blocks), and less 3D PC time per machine.
- **First kit list (from the manifest, `docs/runworld/assets.json`):**

| Asset | Fused repeats now | Kit |
|---|---|---|
| capacitor-bank (lab) | 3 cans on a skid | `capacitor-can` once, instanced; skid procedural; bus bars already procedural (T19) |
| pallet-crates-a/b | 3 crates on a pallet | reuse `crate-large`; pallet procedural |
| cardboard-stack | 3 boxes | `cardboard-box` once, stacked with yaw jitter |
| preset-rack (lab) | rows of cartridges on shelves | rack shell plus `cartridge` instanced |
| fabricator-frame | 2 uprights and a crossbar | `fabricator-upright` once, mirrored; crossbar a procedural box |
| gantry-crane-solid-a/b (vista) | 2 legs and a top beam, all box beams | fully procedural square sections (600-triangle vista piece) |
| chiller-block (vista) | louvre slats (its cage collapsed to a wedge, hence `lowInPlace`) | plain box plus louvres as a normal map |

- **Order:** capacitor bank first (the lab, seen in the first minutes; it also helps the lab's 190 draw-call budget), then the fabricator, then the props and vistas. Each one: a new manifest entry and image for the module, the usual Hunyuan and `runworld-post.mjs` levels, an assembly function next to its scene code, and a 4-angle review against the old model.
- **Ask Argo:** which other machines read as repeats in the concept sheets (the mill, the watermaker, the hauler's six wheel bays), and whether any module should carry its own animation or lights.

## 5. The bundles
- `packages/studiomesh/src/part-split-retopo.ts`: its `auditSingleMeshMultiPartAsset` can still rank which assets look webbed, for the kit list. Its own split has the same crease limits; not installed.
- `scripts/blender-part-split-retopo.py` and `scripts/retopo-multipart-on-3dpc.mjs`: not used.
- TICKET-30 (the BYOA MCP protocol and the asset bench Regenerate button): Studio section 9 work, after the planned work. The Regenerate button calls `runworld-post.mjs <id> --levels=low`.
