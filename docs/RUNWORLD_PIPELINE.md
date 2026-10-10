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

## 5. Credit plan (proposal for the owner)
| Pool | Credits | Notes |
|---|---|---|
| **Narrator VO (held first)** | **15,000** | The full script with retakes is about 11k at the quoted rate. The rest covers voice design and Act re-records. |
| 3D models | 55,000 | Creatures, props, and Astro's extra clips. Always run `draft` before `standard`. |
| Images (crops, turnarounds, UI or marketing) | 10,000 | |
| SFX and music | 5,000 | |
| Buffer | 15,000 | |

**Next steps:** audition the shortlisted voices on our own lines (about 25 credits each), then one `draft` `generate-3d` test to measure the real 3D price. Both wait for the owner to say yes.
