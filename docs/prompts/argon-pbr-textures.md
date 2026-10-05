# Arena AI Prompt: Open-Ended Procedural PBR Material Challenge (Gemini 4 Argon Fishing)

> **How to use**: Copy everything below the line into LMSYS Chatbot Arena battle chat.
> **Design Philosophy**: Open-ended capability test. Do not dictate colors or exact shapes; let the model prove its procedural graphics mastery, mathematical tier-scaling architecture, and stylized material design.

---

You are a lead technical graphics researcher and PBR material architect. We are designing a zero-download procedural texture engine for a vibrant 3D stylized sandbox (smoothed voxel meshes, terrain, and custom racing tracks).

Instead of pre-rendered bitmap images, every surface is generated at load time from a **compact directed acyclic graph (DAG) of math nodes** evaluated on the user's hardware.

### The Challenge

Procedural shaders often look like generic mathematical noise ("Perlin soup")—sterile, repetitive, and devoid of the deliberate lighting, bevelled edge wear, and tactile chunky readability found in top-tier stylized game art (e.g. World of Warcraft, Sea of Thieves, Zelda). Furthermore, when graphics settings drop on potato/mobile hardware, procedural textures either lag or their visual color/silhouette drastically shifts.

We need you to demonstrate how procedural mathematics can overcome these limits.

### Your Objectives

1. **Procedural Aesthetics & Math Philosophy**:
   - How do you create the illusion of hand-painted directional lighting, edge wear, and tactile depth using only 2D math operations?
   - How do you mathematically guarantee that your graphs degrade gracefully from **Potato/Low** (fewest ops, 128x128) to **Ultra** (512x512 with micro-surface depth) without changing the average luminance or color tone?

2. **Graph Primitives & Proposed Extensions**:
   Our runtime engine (`TexGraph`) supports:
   `noise` (value noise with octaves & gain), `cellular` (Voronoi F1, F2, F2-F1), `stripes`, `checker`, `warp` (domain distortion), `blend` (mix, add, multiply, overlay with optional `mask` and `minTier`), `levels` (range remapping/contrast), `invert`, `ramp` (scalar-to-RGB gradient), `scaleBias`, `grain`, `constant`.
   - *Optional Innovation*: Propose up to 2 novel mathematical node types if you believe our primitives are insufficient to achieve next-level procedural fidelity with minimal operations.

3. **Showcase: 4 Signature Stylized PBR Materials**:
   Provide 4 complete, self-contained JSON material graphs demonstrating your mathematical approach across 4 diverse physical archetypes:
   - **Organic / Flora**: (e.g. lush stylized canopy moss, wild overgrowth, or creature hide)
   - **Crystalline / Geological**: (e.g. sheared volcanic obsidian, layered mineral strata, or prismatic crystal)
   - **Crafted / Weathered**: (e.g. ancient runic stone pavement, weathered galleon oak, or beaten dark iron)
   - **Fluid / Dynamic**: (e.g. cooling molten lava crust with glowing fractures, or toxic bioluminescent sludge)

   *Output Requirements for each material*:
   - Clean JSON matching the schema below.
   - `albedo`: Linear RGB `[0..1]`.
   - `height`: Scalar `[0..1]` (neutral ~0.5). Normal maps are derived from this height field.
   - `roughness`: Scalar `[0..1]`.
   - All spatial scales must be positive integers for seamless tile wrapping.
   - Max 20 nodes per graph.

### JSON Schema

```json
{
  "id": "material-id",
  "name": "Material Name",
  "tierStrategy": "How this graph preserves color tone and silhouette when evaluated with fewer octaves/nodes on low-end hardware",
  "nodes": [
    { "id": "macro", "type": "noise", "scale": 4, "octaves": 2, "gain": 0.5, "seed": 42 }
  ],
  "out": { "albedo": "...", "height": "...", "roughness": "..." }
}
```

Impress us with your mathematical elegance, color harmony, and procedural ingenuity.
