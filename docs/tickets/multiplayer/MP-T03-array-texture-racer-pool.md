# MP-T03: Array-Texture Racer Pool & 1-Draw-Call Cores

- **ID**: `MP-T03`
- **Priority**: High (Phase A / Performance)
- **Track**: WebGL Performance / 3D Engine
- **Estimate**: 3 days
- **Dependencies**: `MP-T02`
- **Target Files**: `src/game/ball/ball-texture-pool.ts`, `src/game/renderer-3d.ts`, `tests/ball-texture-pool.test.ts`

---

## Goal
Eliminate per-texture draw call explosion for 100-racer pelotons by consolidating custom ball textures into a single `THREE.DataArrayTexture`. Render all 100 customized marble cores in a single instanced draw call using a custom vertex attribute (`aBallLayer`) and shader injection.

---

## Evidence & Architectural Decisions
- At 100 racers, if every player has a distinct custom ball texture, standard `InstancedMesh` must break into up to 100 separate draw calls (one per unique canvas).
- By uploading all baked 256x128 textures into an array texture with `N` layers (`THREE.DataArrayTexture`), a single `InstancedMesh` can render the entire field with 1 draw call.
- Total VRAM footprint for 100 racers at 256x128x4 bytes: `100 * 256 * 128 * 4 ≈ 13.1 MB` (well within budget).

---

## Technical Specification

### 1. DataArrayTexture Pool Architecture
```ts
export class BallTexturePool {
  private arrayTexture: THREE.DataArrayTexture;
  private readonly layerMap = new Map<string, number>(); // bakeKey -> layer index
  
  constructor(maxRacers = 100, width = 256, height = 128) { ... }
  
  allocateLayer(bakeKey: string, imageData: Uint8ClampedArray): number { ... }
  releaseLayer(bakeKey: string): void { ... }
}
```

### 2. Shader Injection in RacerCoreMaterial
Inject custom attribute and sampler into `MeshLambertMaterial`:
```glsl
// Vertex Shader
attribute float aBallLayer;
varying float vBallLayer;
void main() {
  vBallLayer = aBallLayer;
  // standard Three.js transforms...
}

// Fragment Shader
precision highp sampler2DArray;
uniform sampler2DArray uBallArray;
varying float vBallLayer;
void main() {
  vec4 texColor = texture(uBallArray, vec3(vUv, vBallLayer));
  gl_FragColor = texColor * ...;
}
```

### 3. Graceful WebGL1 Fallback
- Check `renderer.capabilities.isWebGL2`. If false, fall back seamlessly to the existing canvas-keyed `CoreBatch` system.

---

## Acceptance Criteria
- [ ] A 100-racer peloton with 100 distinct customized balls renders in `≤ 2 draw calls` for all ball cores.
- [ ] Total GPU texture memory for 100 racers does not exceed 25 MB.
- [ ] Adding/removing racers from the lobby dynamically updates layers without re-allocating the entire array texture buffer.
- [ ] WebGL1 environments cleanly fall back to multi-batch instancing without throwing errors.

---

## Tests to Run
`node --import tsx --test tests/ball-texture-pool.test.ts`
