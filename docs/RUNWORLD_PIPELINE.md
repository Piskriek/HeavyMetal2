# RUN.world: 3D pipeline, voice, and the credit plan

> Owner ask (2026-10-10, see OWNER_ASKS.md): install the RUN.world CLI; check whether its 3D pipeline helps us; keep credits back for the narrator voice-overs. The budget is 100k credits.
> Sources: the SDK docs shipped in `node_modules/@series-inc/rundot-game-sdk/docs` (v5.29; mainly `api/THREE_D_GEN.md`, `api/AUDIO_GEN.md`, `api/CREDITS.md`, `api/IMAGE_GEN.md`, `cli-reference.md`), the CLI's own `--help`, and https://events.run.world/events/cli-setup/agent.md.

## 1. Setup state
- The CLI is installed: `rundot` 7.17.0 at `%LOCALAPPDATA%\Programs\Rundot\rundot.exe`. It is not on PATH, so call it by that full path or add the folder to PATH.
- The official `install.ps1` fails to parse under Windows PowerShell 5.1. It is UTF-8 without a BOM, and its ✓ character decodes to a curly quote. I ran the same steps by hand instead: download the release zip from `series-ai/rundot-cli-releases`, unzip it, and copy `rundot.exe`.
- Signed in on 2026-10-10. The owner approved the CLI in their own browser. The balance is 100,000 credits; `rundot credits` shows usage per service.
- The repo already depends on `@series-inc/rundot-game-sdk` (apps/web, `src/platform/boot.ts`), so the SDK docs are already here.
- No game is registered yet (no `game.config.*.json`). Registering one (`rundot import`, then `init` and `deploy`) is a separate owner decision.

## 2. What it costs
- **1 credit = $0.001** (IMAGE_GEN.md lists "80 credits ($0.080)" and similar). So the 100k credits are about **$100**.
- **Images** have published prices: 42 to 200 credits each (Nano Banana 2 costs 80; Pro at 4K costs 300).
- **3D and TTS prices are not published.**
  - `rundot generate estimate` quotes TTS (`--text`) but has no 3D kind.
  - The one 3D price given is Tripo's texture tiers: $0.20, $0.30 or $0.40, which is 200 to 400 credits before any platform markup.
  - **Guess, to be checked with one draft run and `rundot credits`:** about 200 to 800 credits per generated model, plus remesh, rig and animate on top.
- Spending caps exist only at runtime (`rundot/threeDGen.config.json`, `rundot/audioGen.config.json`). The CLI is design time, so the budget below is held by discipline.

### Real quotes (2026-10-10, `rundot generate estimate`, free; RUN calls them exact)
| Item | Credits |
|---|---|
| TTS, eleven_v3 or multilingual_v2 | about **0.15 per character**: a 140-character line costs 23, 987 characters cost 149 |
| SFX, 3 s | 9 |
| Music, 60 s | 225 |
| Image, default model | 120 (the docs list 80, so live prices run about 1.5 times the docs) |
| 3D | no estimate kind exists; measure it with one draft run |

## 3. The 3D pipeline
All steps are on the CLI under `rundot game`, and each one downloads a GLB:
1. **`generate-3d`:** image to 3D or text to 3D.
   - Providers: `hunyuan3d-v3.1-pro` (default; PBR, and multi-view input with up to 6 images), `rodin-v2.5` (multi-view up to 5 images; T-pose or A-pose; `texture_delight` removes baked lighting), `meshy` (Meshy 6; `target_polycount`, `model_type: lowpoly`, `pose_mode`), `tripo-v2.5`, `pixal3d` and `trellis-2`.
   - Quality: `draft`, `standard` or `high`. A `seed` makes results reproducible.
2. **`remesh-3d`:** cuts the model to a set face count (`character` is about 5k, `prop` about 1k, or an exact count).
3. **`rig-3d`:** adds a humanoid skeleton (pass the height in metres).
4. **`animate-3d`:** Meshy's action library, with 587 actions (idle, walk, run, jump, attack, hit, fall, crouch, wave, dance, and so on). `animate --model-url` rigs and animates in one billed call. A separate `rig` first is charged twice.
- **Format:** the output is Draco + WebP. Our `scripts/pack-character.mjs` uses glTF-Transform, which needs `draco3dgltf` (a dev dependency) to read Draco. After reading, it repacks to our meshopt + WebP format. `rawModelUrl` gives the uncompressed file.
- **Related tools:**
  - `rundot image turnaround` (beta) renders other angles from one image, which can feed the multi-view input.
  - `remove-bg` and `upscale` clean up concept crops.

### Where it helps us
| Use | Why it fits |
|---|---|
| **Monster Mash creatures** | Rig and animate give a full clip set in one call. Designs must be **original** (shareware-era style, never copies of DOOM or Quake characters). |
| **The mentor scientist** (if she gets a body: a hologram or video-call figure) | Humanoid rig at a known height; the same Meshy rig family as Astro. |
| **More clips for Astro** | Astro already comes from Meshy. `animate-3d` can add hit, fall, crouch, pick-up and wave. They play natively on his rig, with no retargeting. |
| **Static props:** rocks, debris, anomalies, lab furniture, the portal frame | Remesh straight to a budget. |

### Where it does not fit
**Machines and rovers.** The base kit, the fabricator and the rovers need:
- sockets, colliders and hub frames;
- separate moving parts (wheels, the print head, the drill arm);
- grounded weld contacts;
- detail graded from S1 to S6.

A generated model is one textured shape with lighting baked in. Those stay as procedural Arena kits (rovergear and so on).

### The route (design time only, never at runtime)
1. Approved concept art from the Arena art agent.
2. Crop one image per view.
3. `generate-3d`: a `draft` first, then `standard`. Use Hunyuan multi-view and a fixed seed.
4. Review it myself in the dev gallery.
5. `remesh-3d` once per fidelity stage (S1 low to S6 high).
6. Pack with meshopt + WebP into the bundle.

Keeping it at design time means:
- the single-file bundle and determinism hold;
- players never spend credits;
- nothing depends on RUN being online.

## 4. Voice (narrator)
- **The engine:** ElevenLabs TTS (`eleven_v3` by default). It understands audio tags (`[whispers]`, `[pause]`). Stability goes 0 to 1: about 0.3 for expressive dialogue, 0.7 or more for flat UI narration.
- **Making the voice:** `generate design-voice --description` returns up to 3 candidates. `save-voice` keeps one permanently. `list-voices` shows the stock voices.
- **Script size:** the bible's script today is 10 lines, about 1,800 characters. A full Acts I to IV run with reactive barks is likely 15k to 25k characters, and about 3 times that once retakes are counted.
- **Price:** about 0.15 credits per character. The full script with retakes (about 75k characters) comes to about **11k credits**.
- **Library:** 762 voices: 21 premade, 410 professional, 287 generated, 44 cloned. Each one has a free preview clip. The shortlist for the mentor: Sarah, Lily, Matilda (premade); Cate, Tamsin, Nicola, Viktoria, Emily E. (professional). Hearing one of our own lines in a voice costs about 23 credits.

### The mentor's voice (chosen 2026-10-10)
- **"FIDELITY Mentor"**, voice id `eBTgYm9Qho6PFSGSs2wn`. It was designed from a description (candidate C of 3) and saved permanently on the owner's RUN account.
- The description: a lead physicist in her early forties at a lab on the edge of collapse, speaking to the one survivor over a field radio; calm under pressure, warm, dry-witted, quietly urgent; mid-low pitch; a clear neutral accent.
- The owner: "with some bg noise and atmospheric music it will sound right". So the VO files stay clean, and the game adds a radio band-pass filter, a static bed and the music at runtime, as separate stems that can be mixed and ducked.
- **The mix (owner, set by ear):** Voice 80, Radio 10, Static 30, Music 45, Overdrive 10, so mostly the clean voice with a light touch of radio. The values and the chain live in `apps/web/src/audio/mentor-mix.ts`, which both `/radio.html` and the game read.
- Line files are made with `rundot generate tts --voice-id eBTgYm9Qho6PFSGSs2wn --model eleven_v3 --stability 0.4`. v3 audio tags (`[breathes]`, `[pause]`, `[quietly]`) steer the delivery.
- Costs so far: the design call took 150 credits (the cost of its 3 previews).

## 4b. Test results (2026-10-10)
| Step | Credits | Time | Result |
|---|---|---|---|
| Image gen: clean product view of the life-support unit from concept panel 18 (reference image, Nano Banana 2) | 120 | 20 s | Faithful to the panel and isolated on white. One flaw: the fan box floats a little above the cabinet, which breaks the nothing-floats rule. Prompt for contact. |
| Hunyuan 3D v3.1 Pro, standard, image to 3D (that view; and the weapon frame panel 20) | about 1,013 each | 2.5 min | Excellent fronts. Plausible invented backs (blank on the cabinet, mirrored on the gun). About 500k triangles each, three 2048² maps (colour, normal, metal/roughness), 1.9 to 2.4 MB with Draco. |
| `remesh-3d` | 0 | | **Broken upstream:** fal retired its Meshy remesh endpoint (`THREE_D_GEN_DEPRECATED_ENDPOINT`). |
| Meshy v6, `target_polycount=5000` | **1,800** | over 10 min | **Lost.** The CLI times out at 600 s, the call is billed anyway, and `rundot assets list` does not list 3D jobs, so nothing can be recovered. Avoid Meshy through the CLI. |
| Local slim (`scripts/slim-glb.mjs --tris 5000 --angle 25`) | free | 1 min | 500k to 5k triangles. Plain smoothing with the old normal map goes blotchy, because that map was made for the dense surface. Auto smooth by angle (owner: "auto the normals at an angle") keeps hard edges crisp. |
| Blender normal bake (`scripts/bake-normals.py`, headless Blender 5.2, CPU) | free | under 1 min | Bakes the 500k detail into a new 1024² normal map on the 5k mesh, with tangents exported. Rails, screws and the round muzzle come back. **This is the route.** |
| TTS (eleven_v3, 250 characters) / SFX 20 s / music 60 s / voice design | 38 / 60 / 225 / 150 | seconds | All fine. |

**The route for a prop:**
1. Concept panel.
2. Image gen (a clean view on white): 120 credits.
3. Hunyuan standard: about 1,013 credits.
4. Review in `/glb.html`.
5. Slim to each stage's budget with `--angle 25..30`, then bake normals (free).
6. Pack.

About 1.1k credits per prop, so the 55k 3D pool covers about 45 to 50 props.

### Limits (owner: "there might be a limit to how much we are allowed to generate via the cli per day")
- **No published daily cap for creator (CLI) generation.**
  - The documented caps (about $500 per game per day, about $10 per user per day) are runtime defaults, for SDK calls made inside a deployed game.
  - The 3D docs mention "per-creator rate-limit tiers and monthly budget caps" without numbers.
  - The CLI has a `QUOTA_EXCEEDED` error.
- **Rate limit:** three calls at once drew "Rate limited; retry in about 20 s". Two 3D jobs at once were fine.
- **The tier:** only the two Standard image models are listed (no Power models), so this is a lower creator tier. Creator quests (`rundot quests`) pay out credits.
- **The plan:**
  - Run generation from one queue, one call at a time, with backoff. That means a script per batch, like `scratchpad gen-3d.ps1`.
  - Spread big batches across days.
  - Check `rundot credits --period today` after each batch.
  - Stop on the first `QUOTA_EXCEEDED` and note the day's total here; that is the real cap.
  - Do the VO first: it is cheap and its reserve is protected.
- **Windows note:** this PC's locale (en-ZA) uses a comma decimal, so the CLI rejects `--stability 0.4`. Set `DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=1`.

## 4c. The asset route from 2026-10-10 (owner)
- **3D: the owner's local Hunyuan3D pipeline** (RTX 3080 PC on the LAN; `scripts/local3d.mjs`). It is free and its jobs are polled, so nothing times out. About 7 minutes per model; one GPU job at a time.
  - RUN's hosted Hunyuan timed out four times that evening, and timeouts are billed and unrecoverable. It is no longer used for 3D.
- **Source images: RUN** (Nano Banana 2, about 120 credits), one per asset from its concept panel, each reviewed before 3D. The rules, all from the owner:
  - chunky, with no thin wires or tubes;
  - tubing set into solid bodies;
  - armour plates and skirts over undercarriage;
  - roll cages built into panels;
  - empty cabs and wheel arches (seats and steering wheels are separate assets);
  - leave out what is never really seen ("its just a waste of polygons").
- **Fix loop:** a piece that reduces badly is re-imaged without the problem part and re-run locally, at no 3D cost.
- **Audio: RUN** (ElevenLabs): the narration in the FIDELITY Mentor voice, then music and effects.
- Batch: `docs/runworld/assets.json` (63 assets). Scripts: `runworld-assets.mjs` (images), `local3d.mjs` (models), `runworld-post.mjs` (fit, levels, bake, pack), `runworld-contact.mjs` (review sheets).

## 4d. Packaging decision for the owner (measured 2026-10-11 on 23 finished assets)
- **Per asset, on average:** low 69 KB, mid 156 KB, high 298 KB, so about 523 KB.
  - At 64 assets that is **about 33 MB**, or **about 44 MB once inlined** into the single-file bundle (base64 adds a third).
  - The bundle is 9.7 MB today.
- **Options:**

| Option | Single file? | Bundle | Notes |
|---|---|---|---|
| A. All three levels inline | yes | ~54 MB | The constitution kept as is. A slow first load on the web and more memory. |
| B. Low + high inline (drop mid) | yes | ~41 MB | The Graphics setting picks low or high. Mid adds little over high on the min-spec laptop. |
| C. One shared colour and metal/roughness map per asset (only the normal map per level) | yes | saves ~3–4 MB on A or B | It costs no quality: the UVs are the same on every level. Do it whatever else is chosen. |
| D. Low inline, mid and high as an "HD pack" file beside the HTML (or fetched from the RUN.world deploy) | the game stays one file and playable; HD is optional | ~15 MB + pack ~30 MB | Breaks "zero-dependency" only for the optional upgrade. |

- **My recommendation:** C plus D. The single file stays playable and lean (the faceted low level is the stage-1 look anyway), and the HD pack upgrades it when present. B plus C is the choice if one file is non-negotiable.
- **Git:** about 33 MB of binary GLBs. Options: commit them (fine under GitHub's 100 MB per-file limit, but the repo grows with every regeneration), use Git LFS, or keep them in `zips/` and package from a release archive. My recommendation is Git LFS for `apps/web/src/assets/gen/**/*.glb`.

## 4e. The low level is rebuilt, not decimated (2026-10-11)
The owner asked: "are we reducing high poly meshes to produce low poly's? can the local 3d agent not generate low poly's models that look better than a reduced model?"

**Why the old lows looked bad.**
- The old lows were the 40k-triangle model decimated in place.
- Decimation had to keep the generated UV layout, which is thousands of small texture islands, because the colour map is laid out on it.
- Every island border pins the collapse, so thin, holed and treaded parts tore or went to blobs.
- The fault was keeping the generated UVs, not the reduction itself.

**The route now (`lod-bake.py --retopo=0`, low level only).** This is the usual high-to-low game-art route, done headless in Blender on the laptop, at about 1 minute per asset:
1. Weld a copy of the full model and drop its UV islands, so nothing pins the collapse.
2. Decimate it to the budget.
3. Unwrap it fresh (Smart UV Project).
4. Bake the full model's colour onto it at 512 px; it is packed to 256.

The generated models all carry metallic 1, which has no diffuse colour to bake. The bake reads a non-metal copy, and the low keeps metallic 1.

| Tested at the same budget | Decimated in place (old) | Rebuilt and rebaked (now) |
|---|---|---|
| Scout wheel, 600 tris | a faceted blob | a round tyre, the tread readable in the bake |
| Hauler body, 2,500 | torn side panels | closed panels; mirrors and cab intact |
| Wall, 400 | soft | crisp; rivet line and status lamp read |
| Iron sight, 900; weapon bench, 1,500 | fine | as good or crisper (the bench's pegboard tools blur in both: they are a split job, see the split rule) |

- **A voxel-remesh variant (`--retopo=160`) was rejected.** It makes one closed surface, but it broke the wheel apart, because the wheel is an open shell.
- **Mid and high still decimate in place.** At 1.5k triangles and up they hold, and they share one colour map in the HD pack. Rebuilding them would need a colour map per level, which is a later option.

**Can the local model generate low poly directly? No.**
- The 3080 runs Hunyuan3D 2.1. Its shape stage always makes a dense marching-cubes surface, which its own face reducer cuts to about 40k triangles. It has no low-poly mode.

**Native low-poly generation, as researched 2026-10-11:**
- **Hosted and closed:**
  - **Hunyuan:** Tencent's API has a `LowPoly` generate type ("intelligent polygon reduction", triangles or quads). Most sources say it runs on Hunyuan 3.0 and not on 3.1, which is what RUN hosts. Tencent's separate retopology model, Polygen 1.5, is suggested for 3.1 output.
  - **Meshy 6:** Low Poly mode (now "Topology Mesh") is a dedicated pipeline with a target face count. RUN exposes it as the `meshy` provider (`model_type: lowpoly`, `target_polycount`). Its own tutorial says it "solves the polygon budget, not the look".
  - **Tripo:** it claims native low-poly budgets.
- **Open research models:** MeshAnything V2, BPT, DeepMesh, FastMesh, and the 2026 papers (MeshRipple, PolyFlow, MeshFlow, QuadGPT, Nexus). These generate artist-style low-poly topology from a point cloud.
  - Third-party tests disagree with the papers. One 2026 retopology benchmark had DeepMesh finish 28.7% of runs; another reports BPT and FastMesh "frequently produce meshes with broken geometry, missing parts".
  - Their output is untextured, so it would still need the unwrap and bake above.
  - Hunyuan3D 2.1's texture stage already fills the 3080 (about 21 GB is quoted for texturing), so a second model there is a separate install for the owner's PC.
- **Not recommended for now:** a side-by-side of Meshy 6 Low Poly against the rebuilt low through RUN.
  - It costs about 1,800 credits a model.
  - Our one Meshy call through the CLI ran past the 600 s timeout and was lost, though billed (§4b).
  - It becomes worth a test if RUN lifts that timeout, or with a Meshy account used directly.

Sources:
- [Meshy: can AI generate low-poly assets, or should you decimate?](https://www.meshy.ai/topics/ai-low-poly-generate-or-decimate)
- [Meshy: make low poly 3D models](https://www.meshy.ai/tutorials/make-low-poly-3d-models)
- [Scenario: Hunyuan 3D models, the essentials](https://help.scenario.com/articles/5967392966-hunyuan-3d-models-the-essentials)
- [Tencent Cloud Hunyuan 3D API](https://intl.cloud.tencent.com/document/api/1284/75540)
- [Comfy: Tencent text-to-model node](https://docs.comfy.org/built-in-nodes/TencentTextToModelNode)
- [Runware: Hunyuan 3D 3.1 Pro](https://runware.ai/docs/models/tencent-hunyuan-3d-3-1-pro.md)
- [MeshRipple](https://arxiv.org/html/2512.07514v2)
- [FastMesh](https://arxiv.org/html/2508.19188v3)
- [DeepMesh](https://www.alphaxiv.org/overview/2503.15265)
- [PolyFlow](https://arxiv.org/pdf/2606.30673)
- [QuadGPT](https://arxiv.org/html/2509.21420v1)
- [Meshy T2 benchmark](https://arxiv.org/html/2607.28675)
- [StraySpark: decimate vs remesh](https://www.strayspark.studio/blog/reduce-polycount-ai-3d-model-blender-decimate-vs-remesh)
- [AIWiki: Hunyuan 3D (VRAM figures)](https://aiwiki.ai/wiki/hunyuan_3d)

## 4f. Modular parts, multi-view and cages (owner suggestion, 2026-10-11)
The owner's suggestion, in short:
- "give the 3d agent more angles to work from";
- "create modular detail seperately, add the details to the base shapes then build a cage around it";
- "soften the normals on the cage then bake the details with normals and colors to the low poly cage model (cage with good uv layout that is your low)";
- "if it cant be baked on to a texture like a headlight then it needs its own high and bake to cage and then it can be reused and attach snap to the vehicle";
- "if the models did a chassis and a body and we combined that with head lights and ariels and what ever else to get the final model it should work better".

**What the research says:**
- **The industry route is high-poly first, then a clean low, then a bake.** The normal map baked from the high carries the visual detail. Texturing after retopology beats texturing the raw generated mesh (Customuse, Tripo).
- **AI is weak at modular kits and exact mechanical parts.** Dimensions and snapping rules come from code or people (Wavect). For us that is the procedural kits: they already carry the dimensions, hubs, sockets and colliders (`packages/rovergear`: `hubs`, `sockets` such as `seat` and `dish`; `packages/basekit`).
- **Multi-view shape is open source: Hunyuan3D-2mv** (front, left, back and right; shape only). Hunyuan3D 2.1's paint stage can texture any mesh, so 2mv for the shape plus 2.1 for the paint fits the 3080. The install prompt for the local agent is `docs/prompts/local3d/01-multiview-and-parts.md`.
- **Hunyuan3D-Part (P3-SAM segmentation and X-Part completion) has open light weights.** It could split a generated mesh into parts automatically, which may be worth a test later.

**The route (the pilot is the scout, from sheet 19):**
1. **Parts, each generated on its own, with the parts list taken from the concept art:**
   - base shapes: the chassis (floor pan, belly armour, hub mounts) and the body shell (the panelled cab, with the roll protection built into the panels);
   - details: the headlight (one asset, mirrored), the rear tool rack, the cargo box, the seat and the steering wheel (both done);
   - the aerial is procedural: a thin rod is what reduction cannot do.
2. **More angles:**
   - one turnaround sheet per part (front, left, back and right in one image, which keeps the views consistent), cropped into four views for 2mv;
   - single-view 2.1 until 2mv is installed.
3. **The cage (the low, with a clean UV layout):**
   - built from the combined high: the welded copy is decimated with planar dissolve first (flat panels become a few clean faces), then collapse to the budget;
   - unwrapped fresh;
   - normals softened by angle.
   - Where a procedural kit piece matches the shape, that piece can be the cage. It then fits the physics and the lattice exactly.
4. **The bake:**
   - colour and tangent normals from the combined high onto the cage, so baked-in detail (panel seams, bolts, vents, grilles) costs no triangles;
   - this applies to every level, low included (low now softened plus a normal map, as the owner suggests);
   - about 20 KB more per inlined asset.
5. **Parts that change the silhouette** (headlights, the tool rack, mirrors, light bars):
   - each gets its own high, cage and bake, and is reused across vehicles;
   - each snaps on at a named socket on the base, as `rovergear` does for seats;
   - the game assembles the vehicle from base, wheels and parts at their sockets.

**Done when** the assembled scout reads like sheet 19 at every level. The test is the one that failed before: the lamps round, the aerial straight, the panels clean, at the same triangle totals as today's scout.

Sources:
- [Customuse: game-ready 3D models with AI](https://customuse.com/learn/making-game-ready-3d-models-with-ai)
- [Tripo: AI texture baking, high to low](https://www.tripo3d.ai/blog/explore/texture-baking-from-ai-high-poly-to-low-poly)
- [Tripo: AI asset pipeline for game studios](https://www.tripo3d.ai/blog/ai-3d-asset-pipeline-for-game-studios)
- [Wavect: AI 3D generators for game development 2026](https://wavect.io/blog/ai-3d-model-generators-game-development-2026/)
- [3D AI Studio: remesh and retopology](https://docs.3daistudio.com/processing/remesh)
- [Replicate: Hunyuan3D-2mv](https://replicate.com/tencent/hunyuan3d-2mv)
- [Comfy: Hunyuan3D 2 and 2mv](https://docs.comfy.org/tutorials/3d/hunyuan3D-2)
- [Hunyuan3D 2.1 paper](https://arxiv.org/html/2506.15442v1)
- [Hunyuan3D-Part](https://huggingface.co/tencent/Hunyuan3D-Part)

## 5. Credit plan (proposal for the owner)
| Pool | Credits | Notes |
|---|---|---|
| **Narrator VO (held first)** | **15,000** | The full script with retakes is about 11k at the quoted rate. The rest covers voice design and Act re-records. |
| 3D models | 55,000 | Creatures, props, and Astro's extra clips. Always run `draft` before `standard`. |
| Images (crops, turnarounds, UI or marketing) | 10,000 | |
| SFX and music | 5,000 | |
| Buffer | 15,000 | |

**Next steps:** audition the shortlisted voices on our own lines (about 25 credits each), then one `draft` `generate-3d` test to measure the real 3D price. Both wait for the owner to say yes.
