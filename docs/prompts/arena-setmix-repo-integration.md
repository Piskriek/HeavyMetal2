# SetMix: The Resolution Crafter — Repo Integration & Technical Implementation Prompt

> **Target Model**: The winning agent from Arena Battle 4 (Option A / `setmix-game-design-concept (6).zip`).  
> **Source Repository**: [`https://github.com/Piskriek/HeavyMetal2`](https://github.com/Piskriek/HeavyMetal2)  
> **Workspace Context**: Monorepo with packages `@hm/texgraph`, `@hm/smoothvox2`, `@hm/chunkworld`, `@hm/machines`, `@hm/contracts`, `@hm/lighting`, `@hm/terrainops`, `@hm/goblins`.

---

## Prompt to paste to the winning AI Arena Agent:

```markdown
# SETMIX: THE RESOLUTION CRAFTER — PHASE 2: CODEBASE INTEGRATION & ARCHITECTURE SPECIFICATION

You previously authored the winning pre-production Game Design Document and interactive Fidelity Engine for **"SetMix: The Resolution Crafter"** — establishing the four core metrics (Pixel Density $Pxd$, Geometric Flux $Vtx$, Atmospheric Lumens $Lx$, Hydrology $Aq$), the Coherence Penalty formula, the 6-stage progression from 2-bit flat wireframe to Master Render, the Lab Machinery (Synthesizer, Fusion Matrix, Fabricator, Holotable, Cartridge Archive), and the seamless portal connecting the PBR creation studio to the low-poly moon.

Now, we are connecting your architecture directly into our production monorepo:
👉 **Repository**: `https://github.com/Piskriek/HeavyMetal2`

Below are the actual, live TypeScript interfaces and engine packages from our codebase. Your goal is to ground your GDD into concrete, shippable TypeScript systems that plug directly into this architecture.

---

### 1. OUR LIVE CODEBASE ARCHITECTURE & INTERFACES

#### A. `@hm/texgraph` (Mathematical Procedural Texture Engine)
Our procedural texture generator evaluates full DAG node graphs directly into Float32 arrays and tile bytes without external image assets:
```typescript
export interface TexNode {
  id: string;
  type: string; // 'noise' | 'cellular' | 'grain' | 'stripes' | 'checker' | 'constant' | 'warp' | 'blend' | 'levels' | 'invert' | 'ramp' | 'scaleBias'
  [param: string]: unknown;
}

export interface TexGraph {
  id: string;
  name: string;
  nodes: TexNode[];
  out: {
    albedo?: string;
    height?: string;
    roughness?: string;
  };
}

export interface EvaluateOptions {
  size?: number;     // e.g. 16, 32, 64, 128, 256, 512
  seed?: number;
  relief?: number;
  normal?: boolean;
}

export interface EvaluatedTexture {
  size: number;
  albedo?: Float32Array;   // 3 channels (RGB) per pixel
  height?: Float32Array;   // 1 channel per pixel
  roughness?: Float32Array;// 1 channel per pixel
  normal?: Float32Array;   // 2 channels (Nx, Ny) per pixel
}

export function evaluateGraph(graph: TexGraph, opts?: EvaluateOptions): EvaluatedTexture;
export function tileBytes(t: EvaluatedTexture): { colour: Uint8Array; maps: Uint8Array };
export function litPreview(t: EvaluatedTexture): Uint8ClampedArray;
```

#### B. `@hm/machines` (Procedural Factory, Node Graphs & Combinator Pipelines)
Our machine processing pipeline handles chains, inputs, knobs, wiring, and recipe generation:
```typescript
export type PortType = 'pixels' | 'mask' | 'texture';

export interface Knob {
  id: string;
  min: number;
  max: number;
  value: number;
}

export interface MachineKind {
  id: string;
  name: string;
  inputs: Record<string, PortType>;
  outputs: Record<string, PortType>;
  knobs: Knob[];
}

export interface Machine {
  id: string;
  kind: string;
  knobs: Record<string, number>;
}

export interface Wire {
  from: { machine: string; port: string };
  to: { machine: string; port: string };
}

export interface Chain {
  machines: Machine[];
  wires: Wire[];
}

export interface Recipe {
  kind: string;
  knobs: Record<string, number>;
  inputs: Record<string, Recipe>;
}

export function check(c: Chain): string[]; // Validates DAG, types, cycles
export function order(c: Chain): string[] | null; // Topological sort
export function recipe(c: Chain): Recipe | null; // Compiles chain to immutable recipe tree
export function cost(c: Chain, size: number): { ms: number; bytes: number };
export function fingerprint(r: Recipe): string;
```

#### C. `@hm/smoothvox2` (Voxel Surface Extraction, Meshing & Triplanar Shading)
Our meshing engine produces smoothed voxel terrain with multi-surface blending:
```typescript
export interface SmoothMesh {
  positions: Float32Array;
  normals: Float32Array;
  uvs: Float32Array;
  indices: Uint32Array;
  surfaceIds: Uint8Array;
}

export interface Surface {
  albedo: [number, number, number];
  roughness: number;
  metalness: number;
  triplanarScale: number;
}

export function triplanarWeights(m: SmoothMesh, sharpness: number): Float32Array;
export function groups(m: SmoothMesh, surfaceByPalette: readonly number[]): GroupedIndices;
export function surfaceBlend(m: SmoothMesh, ...): SurfaceBlendResult;
```

#### D. `@hm/chunkworld` (Voxel Streaming & World Chunks)
Our chunk streaming system streams voxel terrain around the player camera:
```typescript
export interface StreamLimits {
  loadRadius: number;
  unloadRadius: number;
  maxActiveChunks: number;
}

export class ChunkStreamer {
  setCenter(center: [number, number, number]): void;
  update(dt: number): { toLoad: string[]; toUnload: string[] };
}

export function decodeChunk(bytes: Uint8Array): { size: number; height: number; cells: Uint8Array | null };
export function encodeChunk(size: number, height: number, cells: Uint8Array): Uint8Array;
```

---

### 2. YOUR TASK & DELIVERABLES

We need you to design the **concrete implementation architecture** that bridges your game vision to this codebase. Provide:

#### 1. The `@hm/fidelity` Package Specification & Implementation
Write a production TypeScript package module (`@hm/fidelity`) that:
- Implements the authoritative $Fi$ formula:
  $$Fi = \kappa \cdot (Pxd^{0.30} \cdot Vtx^{0.30} \cdot Lx^{0.25} \cdot Aq^{0.15}) \cdot C$$
  where $C = 1 - 0.45 \cdot \frac{\sigma(\hat{n})}{\mu(\hat{n})}$
- Connects $Pxd$ directly to `@hm/texgraph`:
  - Dynamically calculates the runtime texture resolution ($16 \to 32 \to 64 \to 128 \to 256 \to 512$) and allowed noise octaves ($1 \to 6$) based on the current stage and $Pxd$.
  - Specifies how textures re-evaluate asynchronously without frame drops or memory leaks.
- Connects $Vtx$ directly to `@hm/smoothvox2`:
  - Dynamically drives the meshing subdivision depth and dual-contouring bevel angles ($180^\circ \cdot (1 - e^{-Vtx / 50000})$).
- Connects $Lx$ to lighting models (unlit $\to$ lambert $\to$ shadow cascades $\to$ GI).
- Connects $Aq$ to water level and caustics ($seaLevel = 42 \cdot \frac{Aq}{Aq + 8e5}$).

#### 2. The Preset Cartridge Contract (`@hm/contracts`)
Define the complete TypeScript interface for `PresetCartridge`:
- How an authored preset in the White Room Lab is serialized into a portable item.
- Schema covering:
  - `id`, `name`, `tier`, `category` (`SURFACE_MATERIAL`, `BIOME_RULE`, `TOPOLOGY_OPERATOR`, `PROP_SCATTER`).
  - Embedded `TexGraph` definition (compatible with `@hm/texgraph`).
  - Embedded `SmoothMesh` or voxel brush payload.
  - Emission rules: How a machine placed on the Moon consumes this cartridge to spew pixels and steer the planetary delta ($dFi/dt$).

#### 3. The Fusion Matrix as a First-Class Machine (`@hm/machines`)
Map your Fusion Matrix grammar into our existing `@hm/machines` system:
- Register the `MachineKind` definition for the Fusion Matrix and Lab Synthesizer.
- Provide the exact recipe transformation functions:
  - `fuseCartridges(slotA: PresetCartridge, slotB: PresetCartridge, dominance: number): PresetCartridge`
  - Show how `Recipe` DAGs and fingerprints from `@hm/machines` track recipe lineage and mutation.

#### 4. The Dual-Horizon Bridge (Web Engine to Nanite/Unreal Ceiling)
Detail how a `.setmix` bundle created in the web lab exports cleanly:
- Low/Mid horizon: Runs in real-time in the browser on `run.studio` (Vite, WebGL2/WebGPU, Three.js).
- High horizon: Exports as an authored asset package with high-res baking manifests, material graphs, and mesh LODs suitable for direct import into Unreal Engine 5.5 (Nanite geometry + Lumen PBR materials).

Make the code clean, modular, and fully typed against the interfaces provided above.
```
