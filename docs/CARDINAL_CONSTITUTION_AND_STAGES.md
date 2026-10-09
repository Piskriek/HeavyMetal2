# FIDELITY: THE SETMIX MULTIVERSE // CARDINAL CONSTITUTION & FIDELITY STAGES
> **Scope**: Mathematical Foundation, Cardinal Rules, Simulation Purity & The 5 Fidelity Stages  
> **Repository**: `https://github.com/Piskriek/HeavyMetal2`  

---

## 1. THE CARDINAL CONSTITUTION (NON-NEGOTIABLE)

1. **Four Floats, One Formula**:
   $$\mathbf{S} = (\text{Pxd}, \text{Vtx}, \text{Lx}, \text{Aq})$$
   - $\text{Pxd}$ (Pixel Density): Texture resolution, Bayer dither step size, and palette bit-depth quantization.
   - $\text{Vtx}$ (Vertex Density): Dual-contouring mesh subdivision, geomorphic terrain swell, and geometric detail.
   - $\text{Lx}$ (Light Flux): Lighting model (unlit $\to$ Lambert $\to$ Gouraud $\to$ PBR), shadows, volumetric fog, and photosynthesis.
   - $\text{Aq}$ (Aquatic Level): Water table height, Gerstner wave displacement, and moisture diffusion.
   *Never propose a 5th global simulation metric. All world properties are derived from $\mathbf{S}$.*

2. **Simulation Purity is Load-Bearing**:
   - All simulation modules must be **100% deterministic pure functions**.
   - **Zero non-deterministic calls in simulation packages**: No `Date.now()`, no `Math.random()`, no direct I/O.
   - This ensures 120 Hz rollback netcode converges, ghost replays require only 9 bytes/frame, and complex planetary save files compress to under 50 KB.

3. **Single-File Zero-Dependency Distribution**:
   - The web client compiles into a completely self-contained, single-file bundle: `apps/web/dist/index.html`.
   - Zero external CDN scripts or dynamic runtime network fetches.

---

## 2. TERRAFORMING IS GRAPHICAL FIDELITY

In traditional survival-crafting games, machines raise abstract metrics like Oxygen, Heat, and Pressure to turn a desert green.  
In **FIDELITY**, **terraforming physically raises the graphic rendering engine of reality itself**.

$$\text{Stage 0 (1-bit Dither)} \longrightarrow \text{Stage 1 (16-color EGA)} \longrightarrow \text{Stage 2 (256-color VGA)} \longrightarrow \text{Stage 3 (Gouraud)} \longrightarrow \text{Stage 4 (Full PBR)}$$

---

## 3. THE FIVE FIDELITY STAGES

### Stage 0: 1-Bit Bayer Dither Monochrome Void
- **Aesthetic**: Retro Macintosh / Game Boy monochrome void.
- **Rendering**: Screen-space $4\times 4$ or $8\times 8$ Bayer matrix dithering over 1-bit high-contrast black and white.
- **Geometry**: Harsh, stepped bounding boxes and un-smoothed voxels.
- **Audio**: 8 kHz crushed mono audio feedback.
- **Narrative State**: Reality at the brink of total simulation collapse; buffer coherence rapidly depletes outside shielded zones.

### Stage 1: 16-Color EGA Chunky Voxels
- **Aesthetic**: Early 1990s PC gaming (Commander Keen, early shareware).
- **Rendering**: Quantized 16-color EGA palette. Stepped terrain begins slight chamfer relaxation.
- **Geometry**: Low-poly blocky meshes with flat-face shading.
- **Atmosphere**: Stark black sky begins to show faint stellar lattice points.

### Stage 2: 256-Color VGA with Integer Jitter
- **Aesthetic**: Mid-1990s MS-DOS & PSX classics (DOOM, Quake, original PlayStation).
- **Rendering**: 256-color VGA indexed palettes with affine texture warping and PSX-style integer vertex snapping.
- **Geometry**: Bevelled surfaces and coarse dual-contouring.
- **Atmosphere**: Sky develops early atmospheric scattering and colored horizons.

### Stage 3: Lit Gouraud Shading & Organic Biomes
- **Aesthetic**: Late 1990s / Dreamcast / Nintendo 64 era.
- **Rendering**: Smooth per-vertex Gouraud lighting, dynamic directional sun vectors, and volumetric fog.
- **Geometry**: Rolling organic hill contours with $C^1$ geometric continuity.
- **Flora**: Early procedural ground cover (moss, lichen, low conifers).

### Stage 4: Full Photorealistic PBR (Physical Reality)
- **Aesthetic**: Modern AAA engine fidelity.
- **Rendering**: Full Cook-Torrance physically-based rendering, normal mapping, roughness/metallic reflections, screen-space ambient occlusion, and dynamic point-light emission.
- **Hydrology**: Crystal-clear turquoise water bodies with Gerstner waves and caustic refraction.
- **Flora**: Dense volumetric canopies, procedural tree branches, and dynamic wind wake.
