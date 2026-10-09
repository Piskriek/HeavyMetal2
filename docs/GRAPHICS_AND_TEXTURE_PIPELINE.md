# FIDELITY // GRAPHICS & TEXTURE PIPELINE SPECIFICATION
> **Scope**: Procedural Math Textures, Display Auto-Governor, Multi-Tier Hardware Scaling, and Pixel Plumes  
> **Repository**: `https://github.com/Piskriek/HeavyMetal2`  

---

## 1. THE CORE ENGINEERING RULE: "MAKE IT LOOK RIGHT, KEEP IT OPTIMAL, TOGGLE IF NOT OBVIOUS"

> *"If I say I want pixels spewing out, I mean I want it to look like pixels are spewing out and it be optimal. We should be making logical choices; if it's not an easy choice, then we make it a toggle setting, let the auto setting in the display decide, and then we move on."* — Owner Mandate

1. **Visual Fantasy**: Never sacrifice the core visual experience (pixels must visibly Billow and swirl into the atmosphere).
2. **Hardware Floor**: The baseline hardware is the owner's laptop (GTX 950M), which must maintain $\ge 50$ FPS on Low/Potato and 60 FPS where possible.
3. **The Toggle Rule**: Where multiple techniques compete, do not debate or stall—expose a toggle, default to `Auto`, and let the display governor select.

---

## 2. PROCEDURAL MATH TEXTURE CONTRACT (@hm/texgraph)

Textures in FIDELITY are generated from procedural mathematical graphs rather than heavy static image files.

### Hardware Tier Resolution & Octave Contract
| Tier | Ground Texture Tile | Model Texture Tile | Max Noise Octaves | Detail Blends Active |
|---|---|---|---|---|
| **Potato** | 128 px | 32 px | 2 | None |
| **Low** | 256 px | 64 px | 3 | Low only |
| **Medium** | 512 px | 128 px | 4 | Low + Medium |
| **High** | 512 px + Detail | 128 px | 5 | Up to High |
| **Ultra** | 1024 px + Detail | 256 px | 6 | All detail layers |

---

## 3. DISPLAY AUTO-GOVERNOR

The display auto-governor dynamically monitors GPU frame times and automatically adjusts rendering scale, plume density, and ground triangle budgets to prevent frame drops:
- **Target Frame Rate**: 60 FPS.
- **Governor Drops**: If frame times exceed threshold for $>2.5\text{ s}$, drops one tier down.
- **Manual Lock**: If player selects a specific tier in Settings, the governor locks and obeys player choice.

---

## 4. MULTI-TIER PIXEL PLUME SYSTEM

Terraforming machines spew colorful pixel plumes representing their active metric outputs:
- **Pxd (Pixel Density)**: Hot Magenta (`#ff3d8a`)
- **Vtx (Vertex Detail)**: Neon Green (`#7cff4d`)
- **Lx (Lumens)**: Solar Amber (`#ffc13d`)
- **Aq (Aquatic / Water)**: Electric Cyan (`#3dc8ff`)

### Tier Implementations
- **Ultra / High**: True 3D instanced geometry cubes with dynamic wind drift and point-light emission.
- **Medium**: High-performance GPU Gaussian splats with zero fill-rate penalty.
- **Low / Potato**: Fast screen-aligned Bayer dither sprites with sub-millisecond overhead.
