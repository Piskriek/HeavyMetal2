# Arena AI Fishing Benchmark: Procedural Math Textures & Tier-Linked Shading

> **How to use**: Copy everything below the horizontal line into LMSYS Chatbot Arena (Side-by-Side Blind Battle). It is 100% self-contained.
>
> **Goal**: This benchmark is intentionally open-ended. It tests whether an AI is an average code-completer or a frontier reasoning model (like Gemini 4 Argon / Claude 3.7 / Opus) capable of breakthrough procedural mathematics, shader architecture, and stylized artistic direction.

---

You are a world-class procedural graphics researcher, lead technical shader artist, and engine architect. 

We are developing a high-performance 3D sandbox engine (voxel avatars, fast-paced racing, customizable islands, and smoothed organic meshes). Our core technical philosophy is **zero texture downloads**: all materials, terrain surfaces, and character skins are generated entirely at runtime directly on the user's machine from compact **directed acyclic graphs (DAGs) of mathematical operations**.

### The Core Problem & Tension

Procedural texture generation in games usually suffers from three fatal flaws:
1. **The "Perlin Noise Soup" Curse**: Generic procedural shaders look sterile, muddy, repetitive, or like cheap mathematical wallpaper. They lack the deliberate artistic brushwork, chunky form readability, directional rim lighting, and tactile wear of hand-painted game art (e.g. World of Warcraft, Sea of Thieves, Zelda: Breath of the Wild).
2. **The Performance Cliff**: Complex procedural shaders run fine on desktop GPUs but choke on integrated mobile/laptop GPUs (e.g. Intel HD graphics or mobile chips running 60 fps).
3. **The LOD Color-Drift Dilemma**: When procedural noise octaves or sample counts are reduced for lower graphics settings, the average surface color, contrast, and visual silhouette shift dramatically, ruining the game's art direction across different player hardware.

### Your Mission

We want you to showcase your deepest technical creativity, mathematical intuition, and artistic sensibilities. Do **not** just output a textbook Perlin noise formula with a basic gradient. 

We need you to solve these challenges through procedural math and deliver:

1. **Your Architectural Philosophy**:
   - How do you mathematically eliminate tiling repetition and "noise soup" while keeping node counts minimal?
   - How do you bake the *illusion of hand-crafted lighting, edge bevels, and tactile surface form* directly into math without expensive 3D baking?
   - How do you formulate mathematical Level-of-Detail (LOD) such that **Potato Tier** (low resolution, minimal math ops) and **Ultra Tier** (high resolution, rich micro-detail) maintain **identical average color, luminance, and artistic identity**?

2. **Engine Nodes & Extensions**:
   Our baseline engine evaluates nodes on scalar or RGB floating-point buffers. The core primitives currently available are:
   - `noise`: periodic value noise with octaves & gain
   - `cellular`: Voronoi distances (F1, F2, F2-F1 edge)
   - `stripes`: periodic directional sine bands with controllable edge softness
   - `checker`: 2D checker grid
   - `warp`: domain distortion of one node by another scalar field
   - `blend`: modes (`mix`, `add`, `multiply`, `overlay`, `min`, `max`) with optional mask and optional `minTier` (`potato` | `low` | `medium` | `high`)
   - `levels`: threshold, contrast, and gamma remapping
   - `ramp`: color gradient mapping from scalar values to RGB stops
   - `scaleBias`: linear scale and offset
   - `invert`: `1.0 - x`
   - `grain`: fine micro-speckle
   - `constant`: scalar or RGB value

   *Challenge*: If you believe our primitive set is missing high-leverage mathematical operations (e.g. directional gradients, curvature approximations, domain folding/kaleidoscope, cellular cell-ID hashing, anisotropic flow, perceptual OKLab blending), **propose up to 3 novel math nodes**, define their exact math formulas, and explain why they unlock superior visual fidelity for fewer computational cycles.

3. **Mastery Showcase: 4 Diverse Benchmark Materials**:
   To prove your engine architecture, design 4 distinct procedural materials formatted as clean JSON graphs (`TexGraph` format below). You have complete creative freedom over palettes, themes, and algorithmic approach, but they must span these 4 demanding archetypes:
   - **Archetype 1 (Living / Organic)**: e.g. vibrant lush moss/flora, stylized alien bio-matter, or living skin. Must demonstrate organic growth patterns, warm sub-surface color shifts, and non-repetitive micro-forms.
   - **Archetype 2 (Hard Geological / Mineral)**: e.g. fractured obsidian, columnar basalt, or crystalline strata. Must demonstrate sharp geometric cleavage, directional fractures, and light-catching edge facets.
   - **Archetype 3 (Crafted / Weathered Industrial)**: e.g. weathered runic stonework, ancient nautical timber, or beaten dark iron. Must demonstrate material age, edge wear, and tactile grain.
   - **Archetype 4 (Discrete Voxel Block Face)**: A block face intended for a 0.5m voxel (evaluated at 16x16 to 32x32). Must prove how pure math creates pixel-art readability, deliberate bevelled rims, and chunky volume without looking like blurred noise.

### Output Graph Format

Every material graph is a JSON object with this structure:
```json
{
  "id": "unique-id",
  "name": "Human Readable Name",
  "tierStrategy": "Brief 1-line explanation of how this graph gracefully scales from Potato to Ultra",
  "nodes": [
    { "id": "macro", "type": "noise", "scale": 3, "octaves": 2, "gain": 0.5, "seed": 101 },
    ...
  ],
  "out": {
    "albedo": "<node-id-of-color-output>",
    "height": "<node-id-of-scalar-output>",
    "roughness": "<node-id-of-scalar-output>"
  }
}
```

*Rules for valid graphs*:
- Coordinates wrap seamlessly: all `scale` and `count` parameters must be positive integers.
- Keep total node count under 20 per graph (efficiency is paramount).
- `albedo` outputs linear RGB `[0..1]`.
- `height` outputs scalar `[0..1]` (neutral plane ~0.5). Tangent-space normal maps are baked automatically by the engine from this height field.
- `roughness` outputs scalar `[0..1]` (0 = mirror/wet, 1 = rough/matte).

### Evaluation Criteria

Your response will be judged on:
1. **Mathematical Ingenuity**: Do you use clever domain warps, harmonic frequency ratios, and non-linear mappings instead of just stacking noisy octaves?
2. **Visual & Stylistic Sophistication**: Does the resulting material feel like intentional, high-end game art with clear volume and lighting, or does it feel like accidental algorithmic noise?
3. **Engine-Level Practicality**: Is your tier-scaling strategy genuinely viable on low-end hardware?
4. **Depth of Insight**: Did your analysis and proposed extensions reveal genuine mastery of modern graphics programming and procedural synthesis?
