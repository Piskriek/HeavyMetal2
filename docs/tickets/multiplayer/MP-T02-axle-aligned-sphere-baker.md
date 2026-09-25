# MP-T02: Axle-Aligned Sphere Geometry & Equirectangular Decal Baker

- **ID**: `MP-T02`
- **Priority**: High (Phase A / Visual Track)
- **Track**: 3D Graphics & Asset Baking
- **Estimate**: 4 days
- **Dependencies**: `MP-T01`
- **Target Files**: `src/game/ball/sphere-baker.ts`, `src/game/ball/materials.ts`, `src/game/ball/sphere-baker.worker.ts`, `src/game/renderer-3d.ts`, `src/game/loadout-art.ts`, `tests/sphere-baker.test.ts`

---

## Goal
Overhaul the marble rendering pipeline by rotating the underlying `SphereGeometry` to align its poles with the axle (`±X`), placing the polar pinch completely underneath the brass bearing caps. Implement an in-memory Web Worker texture baker that projects base finishes, circumferential racing stripes, and gnomonic steampunk decals onto a seamless 2:1 equirectangular texture.

---

## Evidence & Architectural Decisions
- **ADR-01**: In Three.js `SphereGeometry`, poles lie at `±Y`. By calling `sphereGeo.rotateZ(-Math.PI / 2)`, the poles move to `±X`, which are permanently covered by the brass bearing caps (`CAP_THETA ≈ 30°`).
- The rolling equator now receives uniform texel density, and horizontal texture bands wrap seamlessly as rolling stripes.
- **ADR-03**: Gnomonic projection transforms decal tangent coordinates `(X, Y)` onto the sphere normal without distortion, eliminating seam clipping and polar skew.

---

## Technical Specification

### 1. Geometry Axle Alignment
In `src/game/renderer-3d.ts:ensureRacerMeshes`:
```ts
const sphereGeo = new THREE.SphereGeometry(BALL_DRAW_RADIUS, 48, 24);
sphereGeo.rotateZ(-Math.PI / 2); // Pole +Y -> Local +X (hidden under cap)
```

### 2. Gnomonic Decal Projection Math
For a decal stamped at `(u₀, v₀)` with rotation `ρ` and scale `σ`:
1. `c = d(u₀, v₀)` (unit surface normal).
2. Compute orthonormal tangent basis `ê` (east), `n̂` (north), and rotate by `ρ` into `ê'`, `n̂'`.
3. For each candidate texel direction `d` where `d · c > 0.05`:
   - `X = (d · ê') / (d · c)`, `Y = (d · n̂') / (d · c)`
   - `s = X / (2 * tan(σ * π / 2)) + 0.5`, `t = 0.5 - Y / (2 * tan(σ * π / 2))`
   - If `(s, t) ∈ [0, 1]²`, sample decal and blend onto canvas.

### 3. Five Procedural Base Finishes
- **Scrap Iron**: 3-octave value noise, crushed pit darks, oxidized rust edge highlights.
- **Galvanized Brass**: Anisotropic brushed grain running along `u` (spins visibly with the roll).
- **Damascus / Springsteel**: Carbon-folded waves `sin((2πu + 6n) * 3 + 20v)`.
- **Scorched Obsidian**: Ridged magma fissure noise with separate emissive channel.
- **Boiler Copper**: Patinated turquoise pools contrasted against bright penny copper.

### 4. Ambient Floor Lift (Anti-Black Terminator)
- Bake an ambient lift of `0.15 * (1 - albedo)` into the texture and configure `MeshLambertMaterial` with `emissive: 0x1a1816` so shadowed sides remain readable.

---

## Acceptance Criteria
- [ ] Geometry rotation places all vertices with `|x| > cos(CAP_THETA) * r` beneath the caps.
- [ ] Gnomonic decal projection preserves square aspect ratios when viewed along the surface normal.
- [ ] Horizontal bands wrap with zero seam mismatch at `u = 0` and `u = 1`.
- [ ] Decal rebake completes in `≤ 40 ms` on the worker thread for 512x256 textures.
- [ ] Full output alpha is strictly `255` (zero transparent black corners).
- [ ] Shaded ball surface never drops below 18% luminance in dark track regions.

---

## Tests to Run
`node --import tsx --test tests/sphere-baker.test.ts`
