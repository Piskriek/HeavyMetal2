# RUN.world: 3D pipeline, voice, and the credit plan

> Owner ask (2026-10-10, see OWNER_ASKS.md): install the RUN.world CLI; check whether its 3D pipeline helps us; keep credits back for the narrator voice-overs. The budget is 100k credits.
> Sources: the SDK docs shipped in `node_modules/@series-inc/rundot-game-sdk/docs` (v5.29; mainly `api/THREE_D_GEN.md`, `api/AUDIO_GEN.md`, `api/CREDITS.md`, `api/IMAGE_GEN.md`, `cli-reference.md`), the CLI's own `--help`, and https://events.run.world/events/cli-setup/agent.md.

## 1. Setup state
- The CLI is installed: `rundot` 7.17.0 at `%LOCALAPPDATA%\Programs\Rundot\rundot.exe`. It is not on PATH, so call it by that full path or add the folder to PATH.
- The official `install.ps1` fails to parse under Windows PowerShell 5.1. It is UTF-8 without a BOM, and its ✓ character decodes to a curly quote. I ran the same steps by hand instead: download the release zip from `series-ai/rundot-cli-releases`, unzip it, and copy `rundot.exe`.
- Sign-in is still to do: the owner runs `rundot login` in their browser. Until then nothing can be priced or generated.
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
- **Price:** run `rundot generate estimate tts --text "<a line>"` after login. Then size the reserve from the real figure.

## 5. Credit plan (proposal for the owner)
| Pool | Credits | Notes |
|---|---|---|
| **Narrator VO (held first)** | **30,000** | Voice design, the full script with retakes, and the Act re-records. Generous until the TTS quote comes in. |
| 3D models | 45,000 | Creatures, props, and Astro's extra clips. Always run `draft` before `standard`. |
| Images (crops, turnarounds, UI or marketing) | 10,000 | |
| SFX and music | 5,000 | |
| Buffer | 10,000 | |

**First steps after login:**
1. `rundot credits`
2. `rundot generate estimate tts`
3. One `draft` `generate-3d` test on a single concept crop, to measure the real 3D price.
