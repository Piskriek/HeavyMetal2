# 2 · Spherical Decal & Ball Baker Engine

Source: **`src/hmgp2/sphere-decal-baker.ts`** (target `src/game/ball/sphere-baker.ts` + worker wrapper).

## 2.1 Root cause of today's artefacts

`bakeRaceBall` paints a *front-facing picture of a ball* (a disc) onto a square canvas and feeds it to `SphereGeometry(r, 24, 16)`. The sphere's UVs are equirectangular: u = φ/2π wraps the equator, v = 1 − θ/π runs pole-to-pole. Consequences:

1. The disc's top/bottom rows collapse to single points → **polar pinch**.
2. The disc's left/right edges meet at u = 0/1 → a **visible vertical seam** where two unrelated edges touch.
3. The transparent corners outside the disc are black after sRGB decode → **pitch-black sides**, made worse by Lambert's dark terminator.
4. The ball rolls around local **X** (caps are on ±X), but the geometry's poles are on **±Y**. The rolling great circle is therefore a *meridian* that passes through both pinched poles — the worst possible orientation.

## 2.2 Fix: re-orient the sphere, not the texture

```ts
// renderer-3d.ts · ensureRacerMeshes()
const sphereGeo = new THREE.SphereGeometry(BALL_DRAW_RADIUS, 48, 24); // 48×24: smoother equator at same cost class
sphereGeo.rotateZ(-Math.PI / 2);   // geometry pole +Y → local +X (the axle)
```

Now the equirect **poles sit under the brass caps** (`CAP_THETA` already covers the polar region) and the **equator is the rolling circumference**. Texel density along the rolling direction is uniform; stripes drawn as horizontal rows in the texture become perfect rings around the rolling path, and the u-seam runs *across* the rolling direction where it is covered by the accent pin-lines and hidden by mip filtering with `wrapS = RepeatWrapping`.

Distortion budget: visible band |lat| ≤ 90° − CAP_THETA. For CAP_THETA ≈ 30°, horizontal stretch 1/cos(60°) = 2.0× at the band edge, 1.0× at the equator — and gnomonic decals compensate exactly anyway.

## 2.3 Coordinate conventions & math

Texture W×H, W = 2H. Texel centre (x, y) → u = (x + ½)/W, v = 1 − (y + ½)/H. Row 0 is v = 1 (+X cap) because `flipY = true`.

Surface direction (texture frame, pole = +Y, matching un-rotated `SphereGeometry`):

```
φ = 2πu,  θ = π(1 − v)
d(u,v) = ( −cos φ · sin θ,  cos θ,  sin φ · sin θ )
```

### Gnomonic stamp (emblems, plates, gauges, roundels)

For a stamp at (u₀, v₀), rotation ρ, scale σ:

```
c = d(u₀, v₀)                                   decal centre (unit normal)
ê = (sin φ₀, 0, cos φ₀)                          east  = ∂d/∂φ normalised (defined at poles too)
n̂ = c × ê                                        north (toward v = 1)
ê' =  cos ρ · ê + sin ρ · n̂                      rotated tangent basis
n̂' = −sin ρ · ê + cos ρ · n̂
α  = σ · π/2                                      angular half-width,  T = tan α

for each texel direction d with d·c > 0.05:
   X = (d·ê') / (d·c)     Y = (d·n̂') / (d·c)      gnomonic projection onto the tangent plane
   s = X/(2T) + ½          t = ½ − Y/(2T)          decal image coords; reject outside [0,1]²
```

The tangent-plane projection is *exact*: a square decal remains a square as seen from its normal, whatever its latitude, and a stamp can straddle the u-seam or even the pole without special cases.

**Polar compensation** appears only in the *bounding box* (to avoid touching all 131 k texels per stamp):

```
reach = atan(T·√2)                               rotated-square corner
rows:  lat ∈ [lat₀ − reach, lat₀ + reach]
cols:  Δu = reach / (2π · cos(lat_worst))        widen by 1/cos(lat); full row if the cap touches a pole
x wraps modulo W                                 seam-safe
```

### Band projection (stripes, chevrons, checker equator, rivet rows)

A band at latitude v₀ with half-height h paints rows v ∈ [v₀ − h, v₀ + h] across all u with an *integer* repeat count `R`, sampling the strip with `wrapS` → mathematically seamless at u = 0/1. Rotation shifts the phase (s = frac(u·R + ρ/2π)).

### Blend

Per channel, with a = dst, b = src·tint: `normal = b`, `multiply = a·b`, `overlay = a < ½ ? 2ab : 1 − 2(1−a)(1−b)`, then `dst += (mix − dst)·α·opacity`. Output alpha is always 255 (ball is opaque — kills the black-corner bug permanently).

## 2.4 Base materials

Procedural recipe per `BaseMaterialDef` (palette stops + noise kind). **Noise is sampled on the 3-D direction vector**, not on (u, v): it is automatically continuous across the seam and non-pinched at the poles.

| Finish | Noise | Signature trick | Unlock |
|---|---|---|---|
| Scrap Iron | 3-oct pitted value noise | low values crushed ×0.4 → pits; rust stops at top of palette | default |
| Galvanized Brass | brushed, anisotropy along **u** | grain runs with the roll → motion reads as spin | 1,200 g |
| Damascus / Springsteel | folded-wave: sin((2πu + 6n)·3 + 20v) | high-contrast folds | 2,500 g |
| Scorched Obsidian | ridged "fissure" 1 − |2n − 1| | t > 0.93 written to a separate **emissive** map (lava cracks glow in the dark sections of tracks) | 4,000 g |
| Boiler Copper | thresholded patina | turquoise pools vs raw penny copper | 1,800 g |

**Anti-black-side fix:** each finish bakes `bakedAmbient` (0.12–0.20) as a lift proportional to (1 − albedo), *and* the material gets `emissiveMap = albedo, emissiveIntensity = 0.12` (plus the obsidian emissive layer when present). Lambert still shades a terminator so the roll stays legible, but the far side never drops below ~20 % luminance.

## 2.5 Bake pipeline & caching

**Measured cost (reference TS in Node, 512×256):** full cold bake with 4-octave obsidian ≈ 400 ms. The base-metal pass is the expensive part, so it is **seeded per finish, not per config**: the base layer depends only on `(base, accentColor)` and is cached (5 finishes × 8 accents, or baked on GPU as a render-to-texture fragment shader with identical math). Per-edit work is then just the decal pass over each stamp's bounding box (tens of ms), which is what the drag loop pays for.

```
Garage edit ──(debounced 120 ms)──► sphere-baker.worker.ts
   postMessage({config, decalImages:ImageBitmap[]}, transfer)          OffscreenCanvas 1024×512 (preview)
   base layer: cache hit by (base, accent) → copy · decals: bbox-limited inverse mapping
◄── ImageBitmap (preview) ────────────────────────────────────────────── decal-only rebake per edit
Save ──► bake 1024×512 (own racer) + 512×256 (field LOD) ──► IndexedDB 'ball-bakes' keyed by bakeKey
Race load ──► prepareRaceBalls(roster: {loadout, ball}[]) ──► Promise<BallLayer[]>  (cache hit ⇒ 0 ms)
```

- Remote racers' configs arrive as `CustomBallConfig` (≈ 0.5 KB) and are baked locally in the worker during the grid countdown; the lobby shows 30 s minimum → 100 bakes × 512×256 fits comfortably. Until a bake lands, the slot uses the capsule's default finish (never blocks the race).
- Legacy `prepareRaceBalls(roster: Loadout[])` keeps its signature via an adapter: `Loadout → defaultBallFor(capsule, RIM_COLORS[i])`.

## 2.6 Renderer integration — one draw call for 100 custom balls

Today each distinct canvas is its own `CoreBatch` (`racerTextures: Map<canvas, CoreBatch>`). With 100 unique balls that's 100 draw calls. Replace with a **layered texture pool**:

```ts
// src/game/ball/ball-texture-pool.ts
export class BallTexturePool {
  readonly texture: THREE.DataArrayTexture;   // 512×256×capacity RGBA8, wrapS = Repeat, mipmaps on
  readonly emissive: THREE.DataArrayTexture;  // same dims, black by default
  private layerOf = new Map<string, number>(); // bakeKey → layer
  constructor(capacity = 128) {
    this.texture = new THREE.DataArrayTexture(new Uint8Array(512 * 256 * 4 * capacity), 512, 256, capacity);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.wrapS = THREE.RepeatWrapping;
    this.texture.generateMipmaps = true;
    this.texture.minFilter = THREE.LinearMipmapLinearFilter;
    // emissive analogous…
  }
  upload(bakeKey: string, rgba: Uint8ClampedArray): number {
    const layer = this.layerOf.get(bakeKey) ?? this.allocate(bakeKey);
    this.texture.image.data.set(rgba, layer * 512 * 256 * 4);
    this.texture.addLayerUpdate(layer);      // three ≥ r165: partial layer upload
    this.texture.needsUpdate = true;
    return layer;
  }
}
```

Material patch (single `MeshLambertMaterial` for all cores):

```ts
material.onBeforeCompile = (shader) => {
  shader.uniforms.ballAtlas = { value: pool.texture };
  shader.uniforms.ballEmissive = { value: pool.emissive };
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nattribute float aBallLayer;\nvarying float vBallLayer;')
    .replace('#include <uv_vertex>', '#include <uv_vertex>\nvBallLayer = aBallLayer;');
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>\nuniform highp sampler2DArray ballAtlas, ballEmissive;\nvarying float vBallLayer;')
    .replace('#include <map_fragment>',
      'vec4 ballTex = texture(ballAtlas, vec3(vMapUv, vBallLayer));\ndiffuseColor *= ballTex;')
    .replace('#include <emissivemap_fragment>',
      'totalEmissiveRadiance += ballTex.rgb * 0.12 + texture(ballEmissive, vec3(vMapUv, vBallLayer)).rgb;');
};
material.customProgramCacheKey = () => 'ball-array-v1';
```

- `aBallLayer` is an `InstancedBufferAttribute(Float32Array(capacity), 1)` on the single `RacerCores` mesh; `growRacerBatches` grows it alongside `instanceColor`.
- `buildRacerSlot(index)` becomes `{ layer: pool.layerFor(raceBalls[index].bakeKey), … }`; `coreBatch()` and the `racerTextures` map are deleted.
- Memory: 512×256×4 × 128 layers ≈ 64 MB + mips (≈ 85 MB) — too much for low-end. **LOD rule:** fields ≤ 20 use 512×256; fields of 50/100 use 256×128 layers (≈ 21 MB total) and the local player keeps a dedicated 1024×512 `CanvasTexture` batch (2 draw calls total).
- WebGL1 fallback (no `sampler2DArray`): keep the existing per-canvas `CoreBatch` path behind `renderer.capabilities.isWebGL2`.

## 2.7 Acceptance tests (added to `scripts/check.mjs`)

1. `uvToDir` ↔ `SphereGeometry` vertex parity: for every vertex of an un-rotated `SphereGeometry(1, 48, 24)`, `uvToDir(uv)` equals position within 1e-6.
2. Seam continuity: mean |Δrgb| between columns W−1 and 0 must not exceed the mean |Δrgb| of a sub-texel-matched control column pair elsewhere (+0.5). *(Max-delta is the wrong metric: hard-edged art legitimately produces 255 steps anywhere.)* Measured on the reference baker: base only 0.01 vs 0.38 interior · band 0.69 vs 0.66 · emblem straddling the seam 1.23 vs matched control 1.63. ✔
3. Gnomonic isotropy: a white square stamp at v ∈ {0.5, 0.7, 0.85} covers equal **solid angle** (Σ texel area · cos(lat)) within 3 %.
4. Determinism: same config → identical SHA-256 of the RGBA buffer across 3 runs.
5. Opaque output: every alpha byte = 255.
6. Draw-call budget: 100-racer field renders cores in ≤ 2 draw calls (`renderer.info.render.calls` delta).
