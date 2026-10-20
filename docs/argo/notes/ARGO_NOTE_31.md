# **ARGO\_NOTE\_31 — TICKET-29: Part-Split Low-Poly Retopology & Fused-Mesh Un-Webbing Pipeline**

## **1\. Root Cause & Owner Directive**

Francois flagged that any multi-part model in our repo that was generated as **one single fused mesh** (marching-cubes shrink-wrap across chassis, wheels, vents, screens, or struts) looks melted and webbed at low poly. Standard triangle decimation collapses edges across part boundaries, creating diagonal webbing slivers between parts and rounding off 90-degree part seams.

## **2\. Research-First Sources (§3.4)**

> * [**HoloPart**](https://github.com/VAST-AI-Research/HoloPart) **([VAST AI / Tripo Weights](https://huggingface.co/VAST-AI/HoloPart), MIT License):** Generative 3D Part Amodal Segmentation that decomposes a fused 3D mesh into complete, closed semantic sub-parts.  
> * [**PartField**](https://github.com/nv-tlabs/PartField) **([NVIDIA Toronto AI Lab](https://research.nvidia.com/labs/toronto-ai/partfield-release/)) & [SAMesh](https://github.com/gtangg12/samesh):** Fast 3D part boundary feature segmentation for slicing single-mesh GLBs along concave part valleys before decimation.  
> * [**MeshAnything V2**](https://github.com/buaacyw/MeshAnythingV2) **([Project Page](https://buaacyw.github.io/meshanything-v2/)) & [meshoptimizer / gltfpack](https://github.com/zeux/meshoptimizer):** Artist-topology planar polygon generation per part \+ crease-locked GLB compression.

## **3\. Files in argo-ticket29-bundle.json**

> 1. packages/studiomesh/src/part-split-retopo.ts — Pure deterministic TypeScript module (strict types, noUncheckedIndexedAccess, zero DOM/Date/Math.random):  
   * auditSingleMeshMultiPartAsset(assetId, positions, indices, options): Scores any single-mesh GLB on detectedPartCount, webbingBridgeTriangles, concaveSeamEdges, coplanarRedundantTriangles, and needsPartSplitRetopo.  
   * segmentMeshIntoDisjointParts(positions, indices, options): Slices a fused mesh along concave valley seams, T-junction steps, and orthogonal part boundaries, strips high-aspect-ratio cross-part webbing slivers, and classifies each part role (chassis-core, wheel-or-roller, turret-or-top, panel-or-screen, vent-or-strut).  
   * retopologizePartPlanarHardSurface(part, targetTriangles, options) & retopologizeFusedMultiPartMesh(...): Collapses coplanar marching-cubes subdivisions on flat walls into clean 2-triangle quads per part while keeping vertex indices **strictly un-welded across part boundaries** inside a single 1-draw-call index buffer.  
> 2. packages/studiomesh/tests/part-split-retopo.test.ts — 3 node:test unit tests verifying fused multi-part auditing, webbing sliver removal, and un-welded per-part planar collapse.  
> 3. scripts/blender-part-split-retopo.py — Headless Blender script (blender \-b \--python scripts/blender-part-split-retopo.py \-- \--in hd.glb \--out low.glb \--target-tris 900\) that splits fused single-mesh GLBs along concave dihedral seams (\>= 50 deg), caps internal seam holes, runs Planar Decimate (8 deg) \+ Collapse Decimate \+ WeightedNormal(keep\_sharp=True) on **each part independently**, and re-joins into a 1-draw-call GLB without welding vertices across parts.  
> 4. scripts/retopo-multipart-on-3dpc.mjs — Zero-dependency Node GLB auditor & 3dpc (192.168.0.8) dispatcher supporting both fast headless Blender per-part retopology and GPU AI decomposition (PartField \-\> HoloPart \-\> MeshAnything V2 \-\> gltfpack).  
> 5. apps/web/src/studio/multipart-retopo-inspector.tsx — Studio Inspector card ("Un-Web & Retopo Parts") for one-click in-browser inspection and part-split remeshing.

## **4\. Installer Checks for Claude Opus / Haiku**

> * **Zero play-scene.ts lines touched:** Can be installed in parallel with any play-scene work.  
> * **Run Unit Tests:** npx tsx \--test packages/studiomesh/tests/part-split-retopo.test.ts (all 3 tests pass).  
> * **Batch-Fix Worst Fused Low-Poly GLBs on 3dpc (192.168.0.8):** Run node scripts/retopo-multipart-on-3dpc.mjs \--audit to list the highest-webbing single-mesh GLBs in apps/web/public/models/, then run blender \-b \--python scripts/blender-part-split-retopo.py (or \--ai-holopart on 192.168.0.8) against their apps/web/public/hd/\*.glb sources and compress with gltfpack \-cc.  
> * **Single-File Size Impact:** \~0 KiB code impact on dist/index.html (Studio/offline pipeline), and **reduces** inline low GLB byte size by collapsing coplanar marching-cubes triangles on flat machine faces.