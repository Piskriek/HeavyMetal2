# Arena AI Prompt: Open-Ended Voxel Block Procedural Math Challenge (Gemini 4 Argon Fishing)

> **How to use**: Copy everything below the line into LMSYS Chatbot Arena battle chat.
> **Design Philosophy**: Open-ended capability test for discrete voxel block faces (16x16 / 32x32). Tests whether a model can generate pixel-art readability, bevels, and lighting from pure math without being spoon-fed recipes.

---

You are an expert procedural graphics engineer and stylized technical artist. We are creating a zero-download voxel sandbox where block textures are evaluated at runtime from compact **directed acyclic graphs (DAGs) of mathematical functions**.

A single voxel face represents a 0.5-metre cube face evaluated at **16x16 (Potato/Low) to 32x32 (High/Ultra)**.

### The Challenge: Pure Math as Pixel Art

Voxel block textures must NOT look like blurry, continuous procedural noise scaled down. Instead, they must capture the essence of **crisp, deliberate pixel art**:
- Chunky, readable silhouettes (4 to 6 dominant harmonious tones).
- Distinct edge bevels and subtle ambient occlusion corners baked directly into the math.
- Clean height and roughness that make blocks pop under dynamic lights without messy micro-grain.
- **Graceful tier scaling**: At 16x16 with minimum compute, the block must be instantly recognizable and share the exact same mean color and silhouette as when evaluated at 32x32 with extra detail octaves.

### Your Objectives

1. **Voxel Shading Mathematics**:
   - How do you construct crisp, bevelled voxel block faces, light-direction accents, and ambient corners using only 2D math nodes (Voronoi/cellular, noise, stripes, warping, thresholding)?
   - How do you avoid the muddy "noise soup" look at low resolutions?

2. **Node Primitives & Innovations**:
   The engine supports: `cellular` (F1, F2, F2-F1), `noise` (value noise with octaves), `stripes`, `checker`, `warp`, `blend` (mix, add, multiply, overlay), `levels` (threshold/contrast), `invert`, `ramp` (gradient), `scaleBias`, `constant`.
   - If a mathematical operator is missing that would drastically improve voxel-edge or pixel-clustering math (e.g. discrete quantize/posterize, Manhattan/Chebyshev distance metrics, or directional edge filters), propose it!

3. **Showcase: 4 Signature Voxel Block Types**:
   Design 4 complete, self-contained JSON voxel block graphs (`TexGraph` format) for 4 distinct gameplay surfaces of your choice:
   - **Voxel Ground / Flora**: (e.g. stylized tufted turf, fungal mushroom cap, or alien moss)
   - **Voxel Mineral / Masonry**: (e.g. chiselled dungeon brick, cracked basalt block, or crystalline ore)
   - **Voxel Manufactured**: (e.g. riveted industrial copper plate, banded wooden plank, or futuristic energy grid)
   - **Voxel Hazard / Element**: (e.g. bubbling magma block, toxic slime container, or frozen glacial ice)

   *Rules*:
   - Seamless wrapping: all coordinate scales and counts must be positive integers.
   - Total node count <= 18 per graph.
   - `albedo`: Linear RGB `[0..1]`.
   - `height`: Scalar `[0..1]` (neutral ~0.5). Normal maps are baked from this.
   - `roughness`: Scalar `[0..1]`.

### JSON Schema

```json
{
  "id": "voxel-block-id",
  "name": "Block Name",
  "tierStrategy": "How this block preserves pixel-art clarity at 16x16 vs 32x32",
  "nodes": [
    ...
  ],
  "out": { "albedo": "...", "height": "...", "roughness": "..." }
}
```

Show us your most creative, elegant mathematical solutions.
