# FIDELITY // Splat Worlds Research: generated and learned rendering as a "realistic" tier
> **Why this exists**: the owner (28 Oct 2026): "there is also an idea of the gaussian splat realistic world fidelity, ive seen google launched a very impressive world model that generates real time gaussian splats, if we can get the drone overwatch to produce those for a player one day that would be pretty cool, not sure how we train gaussians to act like atoms but quantum compute is on its way so we will see".
> **Category (examples mean categories)**: learned or generative rendering as a future realistic fidelity tier: world models, generative 3D, Gaussian splatting, and physical splats. Splats are the first test case.
> **Read with**: [`ENGINE_OPTIMIZATION_AND_BRIDGING_SPEC.md`](ENGINE_OPTIMIZATION_AND_BRIDGING_SPEC.md) (GPU splats for plumes; this doc is splats as a world), [`RESUME.md`](RESUME.md) (the Overwatch bridge), [`DEFERRED_POLISH_REGISTRY.md`](DEFERRED_POLISH_REGISTRY.md) (POL-27, the size gate).
> **Status**: research and proposals (P1 to P8), no decisions. [n] means source n was opened for this doc.

---

## 0. Bottom line

- No Google page I opened says a Google world model outputs Gaussian splats. Google's real-time model, **Genie 4** (27 Oct 2026), renders frames "pixel by pixel" [2]. Splat-producing models come from **World Labs** (Marble, Atlas), NVIDIA (Lyra) and Apple (SHARP).
- Splat **rendering** in a browser works today (Spark, PlayCanvas, three.js r186). Splat **generation** is not real time and mostly runs on a server.
- Splats carry no collision, lighting or physics; every game demo found adds a separate collision mesh.
- No measured splat frame rate for a GTX 950M or similar 2016 GPU was found. Measure that first.
- Quantum computing has no near-term link to rendering or game physics in the sources.

---

## 1. What Google launched, and who else makes splats

### 1.1 Google: Genie 4 (27 Oct 2026), Genie 3, Project Genie
| | Output | Real time | Access |
|---|---|---|---|
| **Genie 4** | Worlds and native audio, rendered "pixel by pixel" [1][2]. No mesh, splat or 3D export is described on DeepMind's, Google's or TechCrunch's pages [2][3][4][5]. | Yes, steered by keyboard and text [2]. No resolution or frame rate published [1][3]. | Research preview for trusted testers; "coming soon" to AI Ultra via Project Genie and to early-access partners on the Gemini API and AI Studio [3][5]. No price, licence or hardware given [1][3]. |
| **Genie 3** (Aug 2025) | Frames generated one at a time, 720p, 24 fps, consistent for a few minutes [6]. | Yes | Limited preview [6] |
| **Project Genie** (29 Jan 2026) | Video of explored worlds; generations capped at 60 s; no 3D export mentioned [7]. | Yes | US, 18+, Google AI Ultra subscribers [7] |

- Genie 4 session length conflicts: TechCrunch says consistent "up to two minutes" [4]; DeepMind says "a few minutes" and that details can drift [5].
- DeepMind's Genie 3 post says NeRFs and Gaussian splatting give consistent 3D "but depend on the provision of an explicit 3D representation"; Genie 3 uses none [6]. One analysis notes neither announcement shows exportable "production-ready geometry" [8].
- **Reading of the owner's message:** he most likely saw Genie 4, announced the day before, and merged it with World Labs splat news. **Unverified:** a separate Google splat product I did not find (several searches, five of them extended, returned none).

### 1.2 Models that do output splats
| Model | Output | Real time | Access, licence, cost |
|---|---|---|---|
| **World Labs Marble** (public launch Nov 2025) | Persistent worlds; export SPZ or PLY splats (about 2 M full, about 500 k "optimized for real-time playback"), meshes, video [9]. SPZ at 100 k, 500 k and full size, plus a collider GLB [12]. | The export renders in real time; the launch article makes no real-time generation claim [9]. | Hosted API. About $1.26 to $1.28 per world (marble-1.1); draft model $0.18 to $0.20; PLY export free; textured mesh $2.80 [10]. Free plan cannot export; Standard exports splats and collider meshes; Pro adds textured meshes and commercial rights [11]. |
| **World Labs Atlas** (1 Sep 2026) | 3D splats, depth, point clouds, and up to 1 min of 1440p video [13][14]. | No real-time claim [14]. | Early access, select partners. No paper, model card or code; no price or latency [13][14]. |
| **World Labs RTFM** (Oct 2025) | Frames, explicitly not splats [15]. | Interactive on one H100 [15]. | Public research demo [15]. |
| **NVIDIA Lyra** | Text or one image to 3D Gaussians in a feed-forward pass; dynamic scenes from monocular video [16]. | Rendering yes; generation speed not stated [16]. | Code Apache-2.0; model licences are per model folder (not read) [17]. |
| **Apple SHARP** | One photo to a metric 3D Gaussian `.ply` in under a second on a standard GPU [18]. | Under 1 s per image [18] | Runs on CPU, CUDA or MPS [18]. Weights licence is `apple-amlr`; terms not read [19]. |
| **Tencent HunyuanWorld 1.0** | Mesh export for game pipelines; no splats mentioned [20]. | Not stated | Open code and weights (26 Jul 2025); a Lite version targets 4090-class cards; licence terms not read [20]. |

Meta was not checked.

---

## 2. Rendering splats in the browser

**Renderers**
- **Spark** (World Labs; MIT; three.js; WebGL2): PLY, SPZ, SPLAT, KSPLAT, SOG; per-splat transforms, colour edits, displacement and a GPU shader graph [21]. Spark 2.0 adds a level-of-detail tree with a per-frame budget of roughly 500 K to 2.5 M splats, a streamable `.RAD` format, and paging [23]. Sorting: distances on the GPU, read back, then a radix sort in a worker, because WebGL2 makes GPU sorting impractical [23].
- **mkkellogg GaussianSplats3D** (MIT): CPU sort in a worker; "no longer in active development", the author recommends Spark [24].
- **antimatter15/splat**: WebGL 1, plain JS, CPU sort in a worker (about 150 ms per 1 M splats) [25].
- **PlayCanvas / SuperSplat**: WebGL2 sorts on the CPU in a worker (fast camera moves can show stale order); WebGPU sorts on the GPU [28]. WebGPU reaches about 85 % of users per the vendor [27].
- **three.js r186** (Sep 2026) has a native `GaussianSplat`, written with WebGPU compute (TSL) and a plain-JS sort fallback on the WebGL backend of `WebGPURenderer`. First version: SH0 colour only, no LoD, streaming or workers [30][31]. The repo pins `three ^0.186.1` and its scenes use `THREE.WebGLRenderer` (checked in `apps/web/src`), so the native class would need a renderer change; Spark does not.

**Numbers reported (none on a 2016 laptop)**
- Spark's budget rule for 60 fps: Quest 3 about 1 M, Android 1 to 2 M, iPhone 1 to 3 M, computers 1 to 5 M; dense clusters on a small screen area can bottleneck blending below that [22].
- PlayCanvas, M4 Max: WebGL2 137 fps at 1 M splats, 48 at 10 M, 13 at 35 M; WebGPU 76 at 35 M. iPhone 13 Pro Max: WebGL2 38 fps at 1 M and 20 at 4 M; WebGPU 78 and 42 [27].
- Research, no device numbers in the abstracts: Mobile-GS drops sorting for order-independent blending [34]; WebSplatter claims 1.2x to 4.5x over web viewers on WebGPU [32]; Visionary runs ONNX models per frame in a WebGPU renderer [33].
- **Unverified:** any frame rate on a GTX 950M, and whether its browser exposes WebGPU.

**Sizes** (derived from reported ratios, not measured)
- PLY is about 2.3 GB per 10 M splats, SPZ about 200 to 250 MB [23] (SPZ is MIT, about 10x smaller than PLY [29]); SOG is 15 to 20x smaller than PLY [26]. That gives about 230 B per splat for PLY, 20 to 25 B for SPZ, 12 to 15 B for SOG.

| Splats | SPZ | SOG |
|---|---|---|
| 100 k | 2 to 2.5 MB | 1.2 to 1.5 MB |
| 500 k | 10 to 12.5 MB | 6 to 7.5 MB |
| 1 M | 20 to 25 MB | 12 to 15 MB |

- The single file is 14.51 MB against a 16 MB gate (POL-27): about 1.5 MB left, roughly 60 to 75 k SPZ splats at best. Splats belong in the HD pack; `RUNWORLD_PIPELINE.md` projected a pack of about 30 MB, with no cap stated.

**Formats:** glTF `KHR_gaussian_splatting` is marked "Complete, Ratified" in Khronos's repo (kernel `ellipse`, SH colour, a point-cloud fallback) [35]. A ratification date of 3 Sep 2026 appeared only in search snippets of third-party GitHub issues, which I did not open: unverified.

---

## 3. Splats that act physically ("like atoms")

| Work | What it does | Speed and limits |
|---|---|---|
| **PhysGaussian** (CVPR 2024) | Material Point Method run directly on the Gaussian kernels, "what you see is what you simulate"; elastic, metal, non-Newtonian, granular [36]. | Plane 30 fps, toast 25, jam 36 on an RTX 3090 and an i9, "simple dynamics" only; material parameters set by hand; no shadow evolution [37]. |
| **Spring-Gaus, OmniPhysGS** | Spring-mass on Gaussians learned from multi-view video, elastic objects [38]; each Gaussian mixes 12 expert materials, weighted by a video diffusion model [39]. | No speed claims [38][39]. |
| **VR-GS, RAF** | Interactive physics-aware splats in VR [40]; splats, meshes and fluids in one particle set with MPM, SPH, PBD and rigid solvers, the captured scene giving static collision [41]. | "Real-time" without figures [40]; no frame rates [41]. |
| **Mesh-Gaussian** (2026) | Fixed-topology mesh for collision, splats for looks; 4.65x speedup over varying-topology baselines [42]. | Converted reconstructions lost 65 to 80 % of geometric quality [42]. |
| **4D Gaussians** | Dynamic scenes learned from video; "real-time rendering" claimed [43]. | Training about 8 to 30 minutes; no fps listed [43]. |
| **PRTGS** | Precomputed radiance transfer for relighting: 30+ fps at 1080p [44]. | Low-frequency lighting only; GPU not named [44]. |

**Collisions in games:** a splat has "no triangles, no colliders, no navmesh, no lights" [45]. The PlayCanvas shooter voxelises the splat into a `.collision.glb`, attaches it to an invisible static body, and replaces relighting with a baked 1 m luminance grid [46]. Unity's SplatBridge builds a MeshCollider from opacity-weighted voxels [47]. Marble ships a collider GLB [12].

**"Atoms":** the nearest thing is a particle-per-Gaussian continuum solver (PhysGaussian). It runs near real time on a desktop RTX card for single objects with simple dynamics. No source shows it at scene scale, in a browser, or on min-spec hardware. Learned per-Gaussian materials (OmniPhysGS) are a research result.

---

## 4. Splats beside stylised and game rendering

- **Shipped use:** I found no commercial game with a splat world. The clearest demo is a PlayCanvas browser shooter (30 Apr 2026): a scanned location, a 68 MB build, SOG chunks streamed, a generated collision mesh, no benchmarks [45][46].
- **Engine support, Sep 2026:** Unity 6 (SplatBridge), Babylon.js 9.27.1 (splats write depth, normal and velocity), Blender 5.3 alpha, Open3D 0.20 (depth-occluded against meshes) [47][48]. PlayCanvas splats do not write depth, so depth effects need a proxy mesh [28].
- **Game meshes to splats:** EA SEED's open-source Mesh2Splat converts a GLB mesh to splats with texture lookups; early stage, Windows, OpenGL GPU [49].
- **Stylising:** G-Style transfers an image style onto a splat scene in minutes, not real time [50]. I found no web project that dithers or palette-quantises splats; Spark's per-splat colour edits and shader graph make it possible [21]. **Unverified:** how a stage palette or dither pass would look on splats.

---

## 5. Quantum computing (one paragraph)

IBM targets "Starling" in 2029 (about 200 logical qubits, 100 million gates), after Kookaburra in 2026, Cockatoo in 2027 and a magic-state demonstration in 2028 [51]. Google Quantum AI reports beyond-classical computation (2019), an error-correction prototype (2023) and below-threshold correction on Willow (2024), with a long-lived logical qubit next; its October 2025 "Quantum Echoes" result studies quantum systems such as molecules [53]. In March 2026 it added neutral-atom hardware, and a trade report quotes "by the end of the decade" for commercially relevant machines [52]. These are company targets. **There is no near-term link to rendering or game physics in any source I opened.** The one splatting-and-quantum paper swaps colour networks for variational circuits; its abstract does not say it ran on quantum hardware [54].

---

## 6. Design implications for FIDELITY (proposals only)

**P1. A "Realistic" option on Stage 6, behind a Graphics setting: `Auto | Off | On`.**
- A render option, not a seventh stage: progression stays 0 to 6 and the four floats stay four (splat count is a Vtx and Pxd budget).
- `Auto` turns on only if the HD pack holds a splat asset and a short calibration under the loading bar holds the other tiers' frame-rate floor. On min-spec it stays Off until P7 step 1 reports.
- Because: toggle rule; Spark and PlayCanvas numbers [22][27]; no min-spec data.

**P2. Splats are skin; the collider stays deterministic.**
- The simulation never reads splats. Collision uses a mesh: the game's own geometry, or a collider GLB or voxel mesh delivered with the splat [12][46][47].
- Because: the constitution (pure, deterministic simulation) and "no colliders" [45]; Mesh-Gaussian splits physics from looks the same way [42].

**P3. First use is a backdrop, not the playfield.**
- Candidates: the lab vista (`apps/web/src/play/lab-vista.ts`) and the Stage 6 view of a restored Earth: few splats, no collision, no relighting.
- Because: sub-500 k scenes fit the budgets; relighting, physics and dithering are unproven [37][44].

**P4. The Overwatch produces splats through the bridge, on the player's opt-in.**
- Flow: the player turns a job on and names the service and their own key. The outside model, linked over the loopback bridge, requests a world (Marble: about $1.28, draft about $0.20 [10]; or a local model such as SHARP if the player's GPU and the licence allow [18][19]). The file lands in a local drop folder and the bridge passes only a small manifest.
- The bridge caps POST bodies at 64 KB (`RESUME.md`), so splat bytes cannot ride it; the game reads the file from disk.
- The result is **staged data** with its source, licence and size. It loads only after the player's "keep it", as AI edits already do; it is never a default and never ships in the file or the HD pack. The loader enforces splat-count and byte caps and magic-byte checks, and parses in a worker.
- Marble commercial rights need Pro [11]; SHARP and Lyra weight licences are unread [17][19]. Store a licence field; block network publishing when it is unknown.
- Because: the owner's words ("produce those for a player"), the staging rule, and the legal-art rule.

**P5. A preset like everything else.** Sliders with live preview: splat budget, `maxStdDev` (Spark's `sqrt(5)` looks "perceptually very similar" to the default and costs less [22]), tint toward the stage palette.

**P6. Do not promise live generation.** Genie 4 and RTFM output frames from remote GPUs [2][15]; splat generators run offline or on servers [10][13]. A live generated view would be a video feed in a screen kit, not a splat; Genie 4 terms are unread and access is unreleased [3].

**P7. Prototype order**
1. Measure: Spark in a scratch page on the 3D PC rig with a Marble SPZ at 100 k and 500 k and one SOG; fps at 100 k, 250 k, 500 k and 1 M, WebGL2 and (if exposed) WebGPU.
2. One backdrop splat in the lab vista behind P1, lit by a baked luminance grid as in [46].
3. The drop-folder, manifest and "keep it" path with a pre-made splat as a stub, before any live service.
4. A live service call with the player's key.
5. Later: SHARP on a screenshot from the Overwatch's "eyes" frames.

**P8. Physics and quantum: watch, do not build.** Revisit "atoms" if a solver runs splat physics at scene scale in a browser. Quantum needs no design item.

---

## 7. Sources
1. https://radiancefields.com/google-deepmind-announces-genie-4-real-time-world-model
2. https://deepmind.google/blog/genie-4-a-new-generation-of-world-simulation/
3. https://blog.google/innovation-and-ai/models-and-research/google-deepmind/introducing-genie-4/
4. https://techcrunch.com/2026/10/27/googles-genie-4-world-model-adds-audio-more-realistic-worlds-and-real-time-steering/
5. https://deepmind.google/models/genie/
6. https://deepmind.google/blog/genie-3-a-new-frontier-for-world-models/
7. https://blog.google/innovation-and-ai/models-and-research/google-deepmind/project-genie/
8. https://dev.to/jamilxt/genie-4-vs-genie-3-what-changed-in-googles-interactive-world-models-53m5
9. https://radiancefields.com/world-labs-formally-launches-marble-a-generative-world-model
10. https://docs.worldlabs.ai/api/pricing
11. https://docs.worldlabs.ai/marble/export/gaussian-splat/index
12. https://docs.worldlabs.ai/llms-full.txt (first 100,000 characters read)
13. https://radiancefields.com/world-labs-announces-new-world-model-atlas
14. https://kingy.ai/blog/world-labs-atlas-world-model-deep-dive/
15. https://radiancefields.com/world-labs-announces-realtime-frame-model-(rtfm)
16. https://research.nvidia.com/labs/toronto-ai/lyra
17. https://github.com/nv-tlabs/lyra
18. https://github.com/apple/ml-sharp
19. https://huggingface.co/apple/Sharp
20. https://github.com/Tencent-Hunyuan/HunyuanWorld-1.0
21. https://github.com/sparkjsdev/spark
22. https://sparkjs.dev/docs/performance/
23. https://www.worldlabs.ai/blog/spark-2.0
24. https://github.com/mkkellogg/GaussianSplats3D
25. https://github.com/antimatter15/splat
26. https://developer.playcanvas.com/user-manual/gaussian-splatting/formats/sog/
27. https://blog.playcanvas.com/new-in-supersplat-webgpu-and-streaming-bring-huge-performance-wins
28. https://developer.playcanvas.com/user-manual/gaussian-splatting/rendering-architecture/renderers/
29. https://github.com/nianticlabs/spz
30. https://radiancefields.com/three.js-merges-a-native-gaussian-splat-renderer-for-webgpu-in-r186
31. https://radiancefields.com/three.js-ships-its-native-gaussian-splat-renderer-and-splat-raycasting-in-r186
32. https://arxiv.org/abs/2602.03207
33. https://arxiv.org/abs/2512.08478
34. https://arxiv.org/abs/2603.11531
35. https://github.com/KhronosGroup/glTF/blob/main/extensions/2.0/Khronos/KHR_gaussian_splatting/README.md
36. https://arxiv.org/abs/2311.12198
37. https://arxiv.org/html/2311.12198v3
38. https://arxiv.org/abs/2403.09434
39. https://arxiv.org/abs/2501.18982
40. https://arxiv.org/abs/2401.16663
41. https://visual-ai.github.io/raf/
42. https://arxiv.org/abs/2606.00444
43. https://github.com/hustvl/4DGaussians
44. https://arxiv.org/abs/2408.03538
45. https://80.lv/articles/developer-uses-gaussian-splats-to-build-fps-game-that-runs-in-browser
46. https://blog.playcanvas.com/turning-a-gaussian-splat-into-a-videogame/
47. https://radiancefields.com/splatbridge-brings-streamed-gaussian-splats-and-splat-colliders-to-unity-6
48. https://radiancefields.substack.com/p/gaussian-splatting-in-september-2026
49. https://radiancefields.com/mesh2splat-instant-3d-mesh-conversion-to-3d-gaussian-splatting
50. https://arxiv.org/abs/2408.15695
51. https://www.ibm.com/quantum/blog/large-scale-ftqc
52. https://thequantuminsider.com/2026/03/24/google-paves-a-two-lane-quantum-roadmap-by-adding-neutral-atom-systems/
53. https://blog.google/innovation-and-ai/technology/research/quantum-hardware-verifiable-advantage/
54. https://arxiv.org/abs/2602.05047
