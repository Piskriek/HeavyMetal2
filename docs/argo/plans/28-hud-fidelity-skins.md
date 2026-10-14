# 28 — Stage-Reactive HUD Fidelity Skins (`data-fidelity="0a"` to `"4-6"`)

> **File Destination in Repo:** `docs/argo/plans/28-hud-fidelity-skins.md`
> **Author:** Gemini Argo (Creative Lead) & Claude Opus (Engineering Lead)
> **Origin:** Owner Directive (`OWNER_ASKS.md`, 14 October 2026: *"if the hud elements changed style according to the fidelity you are standing in that would really sell it"*)
> **Target Brief:** Fold into **Sidecar Brief 25** (`25-hud-9zone-and-build-ribbon.md`)
> **Date:** 14 October 2026
> **Status:** **APPROVED FOR IMPLEMENTATION.**

## 1. Creative & UX Principle: Same 9-Zone Muscle Memory, Six Era-Authentic Skins

Having the suit's HUD physically upgrade (and downgrade!) its rendering medium based on the **local fidelity stage directly beneath the player's boots** (`worldAt(player.x, player.z)`) is one of the strongest diegetic hooks in the game. When you step out of your lush Stage 4 outpost perimeter into raw Stage 0b terrain, your suit telemetry literally drops from sleek glassmorphic visor optics back to a 1-bit dithered Macintosh/HyperCard readout with a `120 ms` scanline glitch.

To make this feel AAA without ever hurting playability (`Rule 24`), all six skins obey **four ironclad UX invariants**:
1. **Zero Layout Shift:** Every zone in the 9-zone grid (`Plan 16` / `Brief 25`) keeps the exact same `top/bottom/left/right` coordinates, `padding`, and bounding-box dimensions across all six skins.
2. **Hard Legibility Floor:** Body and label text never drop below **`12px` at `720p`** (`0.75rem`) and always maintain **WCAG AA/AAA contrast (`>= 7.0:1` for primary text, `>= 4.5:1` for secondary labels)**.
3. **The 5 Metric Colors Always Survive Quantization:** The player relies on the 5 canonical metric colors (`#ff3d8a` Pxd, `#7cff4d` Vtx, `#ffc13d` Lx, `#3dc8ff` Aq, `#b46bff` Mix) to read machine and cartridge states at a glance (`Rule 1`). In low-bit stages (`0a`, `0b`, `1`), panel chrome quantizes to monochrome/EGA, while the 5 metric bars use **era-authentic hardware colors + distinct geometric fill patterns** so they remain 100% distinguishable even to colorblind players.
4. **Shielded Lab Rule:** Inside the Earth Lab, `data-fidelity` locks to **`"3"`** when power is off (Act I wake) and **`"4-6"`** once the main breaker is thrown.

## 2. Research Grounding: How Classic Computing Eras Styled Their UIs

| Fidelity Skin | Historical & Game Reference | Signature Visual Mechanics We Adopt |
| :--- | :--- | :--- |
| **`0a` (Vector Wireframe)** | [Battlezone (1980)](https://en.wikipedia.org/wiki/Battlezone_(1980_video_game)) & Oscilloscope Vector CRTs | Hairline `1px` bright phosphor strokes on pitch black, zero rounded corners (`0px`), corner crosshair ticks (`+`), hollow vector bar gauges with a bright leading-edge dot. |
| **`0b` (1-Bit Flat Dither)** | [Return of the Obra Dinn](https://dukope.com/devlogs/obra-dinn/tig-32/) ([1-Bit Dither-Punk Analysis](https://www.gamedeveloper.com/design/lucas-pope-and-the-rise-of-the-1-bit-dither-punk-aesthetic)) & 1984 Macintosh System 1 | Stark `2px solid` high-contrast borders, 50% 2×2 checkerboard dither header strips, hard `3px 3px 0px` offset drop shadows, and patterned fill bars. |
| **`1` (16-Color EGA)** | [IBM EGA/VGA Text Mode UIs](https://en.wikipedia.org/wiki/VGA_text_mode) & [INT10h DOS Typography](https://int10h.org/blog/2019/05/de-uglifying-40-column-text-games-for-vga/) | Deep navy-slate panel fills (`#0a0e1a`), `3px double` box-drawing borders, stepped 8-cell block progress meters (`■■■■□□□□`), and high-intensity CGA/EGA metric colors. |
| **`2` (256-Color VGA)** | [1990s VGA Beveled Windowing](https://peteroupc.github.io/classic-wallpaper/docs/uielements.html) (*Doom* / *System Shock* status bars) | Gunmetal panel fills (`#181c24`) with chiseled 3D light/dark bevel borders (`#6c7a89` top-left, `#080a0e` bottom-right), recessed black gauge wells, and specular bar highlights. |
| **`3` (16-Bit Gouraud)** | Early-2000s Tactical Sci-Fi HUDs (*Halo: CE* / *Metroid Prime*) | Chamfered `4px` corners, semi-translucent slate glass (`rgba(14, 20, 32, 0.84)`), `4px` backdrop blur, subtle scanline overlay, and smooth linear-gradient metric bars. |
| **`4-6` (Suit-Cam PBR)** | [Dead Space RIG](https://deadspace.fandom.com/wiki/Resource_Integration_Gear) & Modern Helmet Visor Optics (`Plan 25`) | Deep frosted glass (`backdrop-filter: blur(12px) saturate(140%)`), `8px` radius, `1px` specular rim border, soft optical halation glow (`0 0 12px`), and subtle corner chromatic aberration. |

## 3. Complete CSS Token Table Across All Six `data-fidelity` Skins

Embed one lightweight OFL monospace/pixel font (`Share Tech Mono` or `VT323`, `~18 KB` WOFF2) alongside `Oxanium` and `Inter` so `dist/index.html` stays well under the `16.0 MB` cap (`POL-27`):

| CSS Variable | `data-fidelity="0a"` (Vector CRT) | `data-fidelity="0b"` (1-Bit Mac/Obra) | `data-fidelity="1"` (16-Color EGA) | `data-fidelity="2"` (256-Color VGA) | `data-fidelity="3"` (16-Bit Gouraud) | `data-fidelity="4-6"` (Suit-Cam Visor) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`--hud-font-display`** | `'Share Tech Mono', monospace` | `'Share Tech Mono', monospace` | `'Share Tech Mono', monospace` | `'Oxanium', monospace` | `'Oxanium', sans-serif` | `'Oxanium', sans-serif` |
| **`--hud-font-body`** | `'Share Tech Mono', monospace` | `'Share Tech Mono', monospace` | `'Share Tech Mono', monospace` | `'Inter', sans-serif` | `'Inter', sans-serif` | `'Inter', sans-serif` |
| **`--hud-bg`** | `rgba(5, 6, 8, 0.90)` | `#050608` (Solid 1-bit black) | `rgba(10, 14, 26, 0.94)` | `rgba(24, 28, 36, 0.94)` | `rgba(14, 20, 32, 0.84)` | `rgba(10, 14, 22, 0.72)` |
| **`--hud-backdrop`** | `none` | `none` | `none` | `none` | `blur(4px)` | `blur(12px) saturate(140%)` |
| **`--hud-border`** | `1px solid #e8eef5` | `2px solid #e8eef5` | `3px double #a8b8d0` | `2px solid` (`#6c7a89` TL / `#080a0e` BR) | `1px solid rgba(140, 180, 220, 0.35)` | `1px solid rgba(255, 255, 255, 0.14)` |
| **`--hud-radius`** | `0px` | `0px` | `0px` | `2px` | `4px` | `8px` |
| **`--hud-shadow`** | `0 0 6px rgba(232, 238, 245, 0.35)` | `3px 3px 0px #e8eef5` | `4px 4px 0px #000000` | `inset 1px 1px 0 #8a99ad, 2px 2px 0 #000` | `0 4px 14px rgba(0, 0, 0, 0.45)` | `0 8px 28px rgba(0, 0, 0, 0.55), 0 0 16px rgba(61, 200, 255, 0.08)` |
| **`--hud-text`** | `#e8eef5` (`18.4:1`) | `#e8eef5` (`18.4:1`) | `#ffffff` (`19.2:1`) | `#f0f4f8` (`16.5:1`) | `#f0f6fc` (`16.8:1`) | `#f4f8ff` (`17.2:1`) |
| **`--hud-text-dim`** | `#9aa8b8` (`7.8:1`) | `#b0bccb` (`10.2:1`) | `#55ffff` (EGA Cyan `12.1:1`) | `#a0aec0` (`7.4:1`) | `#94a3b8` (`6.8:1`) | `#94a3b8` (`6.8:1`) |

## 4. How the 5 Metric Colors & Bars Render in Each Skin

To guarantee that `Pxd`, `Vtx`, `Lx`, `Aq`, and `Mix` never blur together in low-bit stages:

1. **`data-fidelity="0a"` (Vector Wireframe):**
   - Metric bars are **hollow `1px` vector boxes** (`background: transparent`) with a `1px solid` phosphor stroke in their metric hue (`--c-pxd: #ff5599`, `--c-vtx: #7cff4d`, `--c-lx: #ffc13d`, `--c-aq: #3dc8ff`, `--c-mix: #b46bff`) and a bright `4px × 100%` glowing cursor tick at the current fill percentage.
2. **`data-fidelity="0b"` (1-Bit Flat Dither):**
   - Metric bars use a **2×2 ordered Bayer dither pattern** (`repeating-conic-gradient(var(--metric-color) 0% 25%, #050608 0% 50%) 0 0 / 4px 4px`) with a `1px solid #e8eef5` border—giving an authentic 1-bit stippled gauge while retaining each metric's color identity (`80%` saturation).
3. **`data-fidelity="1"` (16-Color EGA):**
   - Metric bars render as **discrete 8-segment EGA blocks** (`background-image: linear-gradient(90deg, currentColor 75%, transparent 75%); background-size: 12.5% 100%`) using high-intensity 16-color hardware hexes (`#ff55ff` Pxd, `#55ff55` Vtx, `#ffff55` Lx, `#55ffff` Aq, `#aa55ff` Mix).
4. **`data-fidelity="2"` (256-Color VGA):**
   - Solid indexed fill inside a recessed `inset 1px 1px 0 #000` well with a crisp `2px` white-tinted specular highlight stripe along the top edge of the bar.
5. **`data-fidelity="3"` & `"4-6"` (Gouraud & Suit-Cam PBR):**
   - Smooth luminous gradient fill with a soft outer bloom (`box-shadow: 0 0 10px var(--metric-color)`) that reacts to Suit-Cam highlight halation (`Plan 25`).

## 5. Boundary-Crossing Glitch Transition (`120 ms`)

Whenever `data-fidelity` changes (either because a radial stage scan-wave passes over the player, or because the player walks across a fidelity pocket boundary):
- Add class `.hud-fidelity-shift` to the HUD root for **`120 ms`**:
  - Keyframes (`0% -> 40% -> 80% -> 100%`): horizontal `translateX(+-3px)` skew, `clip-path` scanline slice, and a brief `1.3x` brightness flash, paired with a quiet `40 ms` CRT degauss tick on `Combat_UI_Bus`.
- **Hysteresis Guard:** Add a `0.5 s` debounce (or `1.5 m` spatial hysteresis) on foot-sampled `data-fidelity` changes so standing right on a pocket border never rapid-strobes the HUD.
