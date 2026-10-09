# SetMix: The Resolution Crafter — Phase 3: Field Sim, Smoothvox2 & Inception Outliner

> **Target Model**: The winning agent from Arena Battle 4 (Option A / `Winner_Plan.zip`).  
> **Source Repository**: [`https://github.com/Piskriek/HeavyMetal2`](https://github.com/Piskriek/HeavyMetal2)  
> **Context**: Answering his 5 `@hm/texgraph` questions, accepting his 4-PR merge plan, and commissioning the deep technical implementations for `@hm/setmix-field`, `@hm/smoothvox2` geomorphing, and the Inception Studio Outliner.

---

## Prompt to paste to the winning AI Arena Agent:

```markdown
# SETMIX: THE RESOLUTION CRAFTER — PHASE 3: CORE FIELD SIM, GEOMORPH & INCEPTION OUTLINER

Outstanding work on Phase 2. Your implementation in `Winner_Plan.zip` (`deriveBudget`, `adaptGraph`, copy-on-write `fuse`, `certify`, and the live Synthesizer/Fusion Matrix) is a direct bullseye on our monorepo architecture (`https://github.com/Piskriek/HeavyMetal2`). You followed our Kernel Principles (P1: one node type `Preset`, P2: UI from schema `VarDecl`, P3: Source is a tier, P4: Edits are Commands at 120 Hz ticks, P6: packages talk only through contracts) with surgical precision.

We are accepting your 4-PR merge plan. Here are the authoritative answers to your 5 `@hm/texgraph` questions from the core team, followed by the next deep systems we need you to architect.

---

### PART 1: OFFICIAL ANSWERS TO YOUR 5 TEXGRAPH QUESTIONS

1. **Q1: Bit-identical float output across platforms?**  
   * **Our Resolution**: We agree with your recommendation. We content-hash the immutable `TexGraph` JSON DAG and parameter records using your FNV-1a implementation (`contentHash(graph)`). We treat the evaluated `Float32Array` pixel buffers and textures as transient GPU/CPU cache. That guarantees 100% network and platform determinism for all cartridges and recipes without IEEE-754 cross-compiler drift.

2. **Q2: Incremental / partial-evaluation path for the terraform wave?**  
   * **Our Resolution**: Yes. `@hm/chunkworld` already streams the world in discrete chunks (16×16 / 32×32 voxels). We are updating `EvaluateOptions` in `@hm/texgraph` to accept an optional sub-region `bounds?: { x0: number; y0: number; x1: number; y1: number }`. When the terraform wave front touches a chunk, it only re-evaluates the boundary slice rather than re-computing the entire planet.

3. **Q3: 2-Channel vector driver for `warp`?**  
   * **Our Resolution**: **ACCEPTED.** We are expanding the `warp` node specification:
     ```typescript
     export interface WarpNode extends TexNode {
       type: "warp";
       input: string;       // target field to warp
       vectorField?: string;// optional 2-channel [dx, dy] vector input for true curl-noise
       by?: string;         // fallback 1-channel scalar offset
       amount: number;
     }
     ```
     This allows true divergence-free curl noise, fluid vortices, and volcanic flow fields.

4. **Q4: Node-level cost heuristic available internally?**  
   * **Our Resolution**: Your `graphCost()` implementation (instruction weights + texel count) is clean, lightweight, and perfectly suited for pre-flight export gating. We are promoting your `graphCost()` into the core `@hm/texgraph` export so that your `certify()` function uses the official engine heuristic.

5. **Q5: `ramp` with interpolation modes (`linear` | `smooth` | `constant`)?**  
   * **Our Resolution**: **ACCEPTED.** We are officially adding `interpolation?: "linear" | "smooth" | "constant"` to the `ramp` node. Setting `interpolation: "constant"` generates stepped palette quantization directly inside the texture evaluator, giving Stage 1 2-bit/4-color rendering without requiring a separate post-process pass.

---

### PART 2: THE 3 DEEP SYSTEMS TO IMPLEMENT

Now we want to tap your systems talent for the hardest remaining pieces of SetMix:

#### 1. The Full Terraform Wave Engine: `@hm/setmix-field`
In your `Ship.tsx` you sketched the 4-phase anti-popping band (alpha-hash resolve, $1.4\text{s}$ vertex geomorph, blue-noise prop spawn, and early audio whoosh). Now we need the complete, shippable TypeScript module for `@hm/setmix-field`:
- **Radial Shockwave Math**: Model the wave propagating radially outward from an emitter spire at position $(x_0, z_0)$ with velocity $v(t)$, shell thickness $\Delta r$ (8–14 m), and local Fidelity Index delta:
  $$r(t) = \int_0^t v(\tau) \, d\tau$$
- **Chunk State Machine**: How does each chunk in `@hm/chunkworld` query the wave field at 120 Hz?
  - States: `DORMANT` $\to$ `APPROACHING` $\to$ `INSIDE_BAND` $\to$ `STABILIZED`.
  - The geomorph curve: A $C^1$-continuous cubic smoothstep interpolation $H(x, z, t) = \text{lerp}(H_{prev}, H_{next}, S(\frac{r - \text{dist}}{\Delta r}))$ that smoothly swells the terrain without vertex pops.
- **The Reverse Wave**: When a cartridge is removed or a machine is destroyed, execute the reverse wave receding at $2\times$ velocity, replaying the command journal in reverse to cleanly restore the previous terrain state.
- Write pure TypeScript functions: `stepWaveField()`, `evaluateChunkWaveState()`, and `sampleWaveTransition()`.

#### 2. The Smoothvox2 Dynamic Meshing Pipeline: `@hm/setmix-mesh`
In Phase 2, `deriveBudget` scaled `relief` and normal maps, but we need the actual bridge to `@hm/smoothvox2`:
- How does Geometric Flux ($Vtx$) dynamically govern the dual-contouring meshing passes?
  - Stage 1: Pure cubic AABB voxels (8m blocks).
  - Stage 2: Chamfered / beveled cubes with 45° planar normals.
  - Stage 3+: Dual-contouring vertex relaxation ($180^\circ \cdot (1 - e^{-Vtx / 50000})$) into continuous smooth hills.
- **Seam Stitching**: What happens when Chunk $A$ is at Stage 3 (smooth) and adjacent Chunk $B$ is still at Stage 1 (stepped cubes) across the wave boundary? How does the boundary edge stitch so there are zero Z-fighting cracks or null gaps?
- Provide the TypeScript mesher adapter bridging `FidelityState` and `RenderBudget` into `@hm/smoothvox2` `SmoothMesh` generation and triplanar material weight assignment.

#### 3. The "Inception" Studio Outliner: `@hm/setmix-outliner`
The studio vision for SetMix is an all-in-one White Room Lab with a Maya-style Outliner that represents everything as a nested preset-in-a-preset (like *Inception*):
- **The Inception Hierarchy**:
  $$\text{Galaxy} \longleftrightarrow \text{Solar System} \longleftrightarrow \text{Moon} \longleftrightarrow \text{Biome} \longleftrightarrow \text{Chunk} \longleftrightarrow \text{Machine/Prop} \longleftrightarrow \text{Preset Cartridge} \longleftrightarrow \text{TexNode} \longleftrightarrow \text{Raw Variable}$$
- **Zoom & Navigation**:
  - Double-clicking zooms down into the sub-preset (e.g. from Moon into Biome, from Biome into Machine, from Machine into Cartridge, from Cartridge into raw `TexNode` float).
  - Pressing `Esc` steps back up one level in the hierarchy.
- **The Live Maya-Style Outliner**:
  - Tree view where every object is named, searchable, re-parentable, and renamable.
  - Hitting `Tab` swaps the active tool/preset held in the character's hands and updates the hotbar.
  - Contextual slide-out toolbars matching player intent:
    - **Pointer Tool**: 3D manipulator gizmos (Translate, Rotate, Scale).
    - **Brush Tool**: Surface painting (stamp, ramp, clone).
    - **Sculpt Tool**: Voxel sculpting brushes (additive, subtractive, smooth, pinch).
    - **Timeline Tool**: Animation keyframes and physics impulse curves.
    - **Speaker Tool**: Foley, soundscape, and procedural audio synth.
    - **Character Icon**: Drills down into the Goblin Avatar rig, suit layers, and customization presets.
- Provide the TypeScript state model and interactive React/Canvas component for the Inception Outliner.

Make the code modular, strictly typed against our monorepo contracts, and pure where appropriate.
```
