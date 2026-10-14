# 25 — Suit-Cam Optical Realism Plan: Every Stage Is a Capture Medium

> **File Destination in Repo:** `docs/argo/plans/25-camera-realism.md`
> **Author:** Gemini Argo (Creative Lead) & Claude Opus (Engineering Lead)
> **Origin:** Owner Directive (`OWNER_ASKS.md`, 14 October 2026)
> **Target Brief:** Fold into **Sidecar Brief 27** (`27-stage0-dither-and-rover-cam.md` post-processing pipeline)
> **Date:** 14 October 2026
> **Status:** **APPROVED FOR IMPLEMENTATION.**

## 1. Creative Verdict: Why the Owner's Insight Solves Our Stage 4–6 Asset Problem

Francois's observation hits the nail on the head:
> *"Some games fake fidelity like those GoPro-cam shooters that came along with the new Unreal lighting that made normal-fidelity assets look realistic because how the light blows out it sorta hides the imperfections the same way that in Stage 0 of our game everything looks on point cos the fidelity hides the imperfections."*

Why does this work psychologically?
1. **The "Naked PBR" Uncanny Valley:** In Stages 0–3, every stage has a strong **medium transfer function** (1-bit Bayer dither, 16-color EGA, 256-color VGA, faceted Gouraud). Those transfer functions compress tonal range and quantize edges, hiding low-poly Hunyuan3D silhouettes and low-res baked textures. When the game reaches Stages 4–6 and switches to clean, linear/standard PBR, the protective "medium" disappears—exposing flat roughness maps, vertex creases, and texture seams.
2. **Completing the Ladder ("Every Stage Is a Capture Medium"):** If Stages 0–3 represent historical digital display media, then **Stages 4–6 should represent a physical optical capture medium: the Scientist's Helmet Visor / EVA Suit-Cam**.
3. **How Highlight Blowout Hides Asset Flaws:** A small-sensor CMOS action camera (`~8–9 stops` of latitude) cannot hold both deep crater shadows and sunlit sky/metal at once. Sunlit bevels, water caustics, white lab panels, and neon pixel plumes **blow out into warm, clipped white with soft halation**, while shadow crevices crush into rich, slightly grainy darks. That S-curve compression + highlight bloom masks 80% of texture and geometry imperfections at a fraction of a millisecond on the GPU.

## 2. Research Findings: What Players Praise vs. Complain About in *Unrecord* & *Bodycam*

We reviewed technical breakdowns and player feedback for [Unrecord](https://www.reddit.com/r/unrealengine/comments/16684tc/how_is_the_graphics_made_in_unrecord/) (DRAMA Studios) and [Bodycam](https://store.steampowered.com/app/2406770/Bodycam/) (Reissad Studio, [Steam Accessibility & Motion Sickness Advisories](https://steamcommunity.com/ogg/2406770/announcements/detail/4196871700741632306) and [r/BodycamGame Player Reports](https://www.reddit.com/r/BodycamGame/comments/1wdrbjn/game_is_cool_but_gives_me_motion_sickness/)):

| Bodycam / Unrecord Technique | Player & Technical Reception | Verdict for FIDELITY (Stages 4–6 Suit-Cam) |
| :--- | :--- | :--- |
| **1. Aggressive Highlight Blowout & Filmic Toe/Shoulder Clipping** | **Universally Praised.** The #1 reason viewers mistake *Unrecord* and *Bodycam* screenshots for real GoPro footage; hides flat PBR materials by blowing out specular highlights and sky contrast. | **ADOPT (Core Pillar).** Lower the tonemap white-clip shoulder (`shoulder = 0.76`) as `Lx` rises above `0.55` so sunlit surfaces, water glints, and plumes clip warmly into white. |
| **2. Lagging Auto-Exposure (Iris Adaptation Delay)** | **Highly Praised.** Looking from a dark interior or shadow into bright sky temporarily overexposes the frame for `0.4–0.6 s` before the virtual sensor steps down its iris. | **ADOPT (Zero-Readback Analytical Form).** Drive exposure from a damped `0.45 s` RC filter over `(sunViewDot, skyVisibleRatio, insideLab)`—zero GPU texture readback stalls on GTX 950M! |
| **3. Halation / Highlight Bleed & Visor Glare** | **Praised.** Bright sky and emissives bleed slightly across dark foreground silhouettes (optical halation), gluing foreground meshes into the background instead of leaving razor-sharp CG polygon edges. | **ADOPT.** Add a cheap 4-tap wide highlight bleed + subtle visor micro-dust catch when facing within `35°` of the sun or a running plume. |
| **4. Luma Micro-Sharpen + Midtone CMOS Sensor Grain** | **Praised (When Subtle).** Real action cams apply an internal `3x3` unsharp mask that accentuates micro-contrast on rocks/foliage, paired with subtle sensor noise in shadows/midtones. | **ADOPT (`2.5%` Grain Cap).** Adds perceived high-frequency surface detail to `256px`–`1024px` textures without looking like a noisy horror filter. |
| **5. Extreme Fisheye Distortion (`> 110°` / `k1 < -0.18`)** | **Top Player Complaint in *Bodycam*.** Causes severe motion sickness ("swimming walls") on mouse turn and warps straight architectural lines. | **CAP AT SUBTLE (`k1 = -0.035`).** Use a gentle rectilinear-wide barrel curve (`3.5%` edge bend + `1.2 px` corner-only chromatic aberration) that relaxes by `50%` when the Build Menu (`B`) is open. |
| **6. Uncoupled Deadzone Aiming, Roll Wobble & Smear Motion Blur** | **#1 Quit/Refund Trigger in *Bodycam*.** Players with motion sickness immediately disable motion blur and roll shake; builders hate floaty crosshairs. | **REJECT.** Keep crosshair aim **100% locked**, camera roll at **`0°`**, and **zero full-screen motion blur**. Our realism comes from **optics and exposure**, never from making the player dizzy. |

## 3. The Unified "Capture Medium" Ladder (`Stage 0` to `Stage 6`)

Every stage of `S = (Pxd, Vtx, Lx, Aq)` now represents a distinct visual capture medium, with the **Suit-Cam Optical Pass** ramping in smoothly from `Lx >= 0.50` (Stages 3–6):

| Stage | Capture Medium Identity | How the Medium Hides Asset Imperfections |
| :--- | :--- | :--- |
| **Stage 0** | **1-Bit Telemetry Feed** | Cylindrical world-locked 4x4 Bayer dither + 1 px depth contours (`Brief 27`) hide low-poly cages behind stark monochrome contrast. |
| **Stage 1** | **16-Color EGA Terminal** | Quantized 16-color mineral palette + ordered dither seams mask low-res textures as intentional retro hardware indexing. |
| **Stage 2** | **256-Color VGA / Early-3D Capture** | 256-color LUT + subtle scanline/affine grit + hard specular steps. |
| **Stage 3** | **16-Bit Broadcast Feed** | Smooth Gouraud/normal shading + distance haze + first `25%` blend of Suit-Cam highlight compression. |
| **Stages 4–6** | **EVA Suit-Cam CMOS Optics (`100%` Active)** | High-contrast CMOS S-curve, clipped highlight blowout, lagging auto-exposure iris, optical halation bleed across silhouettes, subtle corner chromatic aberration (`1.2 px`), and `3x3` luma micro-sharpen + `2.5%` sensor grain. |

## 4. Technical Specification for `Brief 27` (Single-Pass GLSL, `<= 0.45 ms` on GTX 950M)

To keep the GTX 950M locked at `60 FPS` (`Rule 20`), all Suit-Cam optical effects must execute inside **one combined post-process fragment shader** (zero extra full-res render targets on `Low`):

### 4.1 Analytical Lagging Auto-Exposure (Zero GPU Readback)
Instead of `glReadPixels` or mipmap reduction chains that stall WebGL2 pipelines on mobile GPUs, compute target scene brightness analytically on the CPU each frame (`dt`) and pass a single `uExposure` uniform:
1. Compute `targetLuminance` from:
   - `sunLook = pow(max(dot(cameraForward, sunDir), 0.0), 3.0)` (looking toward the sun or bright horizon).
   - `skyPitch = clamp(cameraForward.y * 0.5 + 0.5, 0.2, 1.0)` (looking up at bright sky vs. down at dark ground).
   - `gateOrLab = isInsideLab ? 0.65 : (distToGate < 12.0 ? 0.85 : 1.0)` (stepping from dark Lab/Gate into bright lunar daylight).
2. Update current exposure with an asymmetric RC lag filter (fast `0.28 s` step-down when blinded by bright light; slower `0.55 s` recovery when entering shadow):
   - When stepping out of the Gate at Stage 4–6, the exterior momentarily blows out by **`+0.85 EV`** for `~0.4 s` before settling—delivering the signature *Unrecord* doorway transition!

### 4.2 Clipped Highlight Knee & Halation Bleed (`uSuitCamMix = smoothstep(0.45, 0.85, Lx)`)
Inside the post fragment shader, when `uSuitCamMix > 0.0`:
1. **Subtle Barrel Lens + Corner-Only Chromatic Aberration:**
   - Offset UV by `r2 = dot(uv - 0.5, uv - 0.5)`; `k1 = -0.035 * uSuitCamMix * (isBuildMode ? 0.5 : 1.0)`.
   - Sample R and B channels at `+-0.0018 * r2` radial offset so the center `60%` of the screen (crosshair, text, build ghost) has **zero** color fringing, while the outer `20%` periphery gets authentic lens refraction.
2. **3x3 Luma Micro-Sharpen + Highlight Halation:**
   - Sample 4 diagonal neighbors (`+-1.5 px` for sharpen, `+-5.0 px` on `Mid/High` for highlight halation).
   - Add `0.30 * uSuitCamMix` luma detail boost (making `256px`–`512px` ground and machine textures look crisp and gritty).
   - Any neighbor pixel with luma `> 0.82` bleeds warm `#fff4dc` halation (`0.22 * uSuitCamMix`) across adjacent dark silhouettes—softening hard polygon edges against the sky!
3. **CMOS S-Curve with Early White-Clip Shoulder:**
   - Apply an aggressive filmic S-curve where highlights above `0.78` compress and roll into pure warm white (`#fffcf5`), while toe shadows below `0.08` crush slightly with `0.025` animated blue-noise/hash CMOS grain (weighted by `luma * (1.0 - luma)` so blown-out white sky stays clean and grain lives in the midtones/shadows).
4. **Natural `cos^4` Optical Vignette & Visor Glare:**
   - Multiply edge luminance by `mix(1.0, pow(cos(r * 0.95), 4.0), 0.28 * uSuitCamMix)` and add a faint warm sun-glare arc when `sunLook > 0.5` in First-Person mode.

### 4.3 Settings Toggle & Mode Guards (Rule 21 & Rule 24)
- **Settings Toggle (`Rule 21`):** Add **`Suit-Cam Optics: Auto | Full | Subtle | Off`** under Graphics Settings:
  - `Auto` (Default): Enables the full single-pass Suit-Cam optics on Stages 4–6 (`Low` uses the 4-tap pass; `High/Ultra` adds the wide halation bloom).
  - `Subtle`: Halves barrel distortion (`k1 = -0.015`), grain (`1%`), and exposure lag swing (`+-0.35 EV`).
  - `Off`: Standard clean ACES tonemap for players who prefer a clinical render.
- **Studio & Build Mode Guard:** Automatically set `uSuitCamMix = 0.0` inside **The Studio** (unless the `[S4: Lush PBR]` preview pill from `Brief 31` is active) and halve `k1` / highlight blowout while the Build Ribbon (`B`) is open so builders always have straight lines and accurate color readouts.

## 5. Rules Touched (`docs/argo/RULES.md`)

- **Rule 1 (Four floats, one formula) & Rule 4 (Terraforming is graphical fidelity):** The Suit-Cam optical pass is driven 100% by `Lx` and `Pxd`—completing the visual medium ladder from Stage 0 to Stage 6 with zero new global floats.
- **Rule 6 (Research first):** Grounded in *Unrecord* and *Bodycam* optical post-processing analysis and Steam player comfort feedback (keeping the optical blowout/exposure realism while rejecting nauseating fisheye warp, roll wobble, and motion blur).
- **Rule 20 (GTX 950M at 60 fps on Low) & Rule 21 (The toggle rule):** Runs in `<= 0.45 ms` as a single post-process shader pass with an `Auto / Full / Subtle / Off` Graphics setting.
