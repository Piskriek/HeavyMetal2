import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const outDir = 'docs/tickets/multiplayer';
mkdirSync(outDir, { recursive: true });

const tickets = [
  {
    file: 'README.md',
    content: `# Heavy Metal GP 2: Multiplayer, Customization & Permadeath Epic Backlog

## 1. Executive Summary & Architecture Decisions
This epic covers the **Season Zero** meta-game evolution for *Heavy Metal GP 2*, establishing 3D ball customization, modular goblin avatars, online multiplayer hubs, high-stakes seasonal permadeath, the Shaman's Resurrection Altar, a balanced gold economy, and the Goblin Bookie betting parlor.

### Architecture Decision Records (ADRs):
- **ADR-01 (Axle-Aligned Equirect)**: Rotate \`SphereGeometry\` by \`-π/2\` so the equirect poles lie directly under the brass bearing caps on \`±X\`. The rolling circumference aligns with the equator, ensuring uniform texel density and zero pole distortion.
- **ADR-02 (Bake Once, Never In-Race)**: Composite base metals, decals, and accent pin-lines once in a Web Worker at customization time. In-race rendering retains 100% zero-composite performance.
- **ADR-03 (Gnomonic Decal Projection)**: Tangent-plane projection provides mathematically exact, seam-safe, and pole-safe decal stamps.
- **ADR-04 (Goblin DNA Codec)**: 48-bit (12 hex digit) seed representation allows lightweight networking (18 bytes) and deterministic client-side SVG composition.
- **ADR-05 (Hybrid High-Water Mark with Gross Inflow Guard)**: Resurrection fee is \`max(EloFloor, WealthTax)\` using \`SNW = max(holdings, 0.6 * grossSeasonalInflow)\`, eliminating offshore alt laundering and pauper god-racer exploits.
- **ADR-06 (Pari-Mutuel Default)**: Bookie operates on a pooled pari-mutuel model with house takeout (5–12%), eliminating house bankruptcy risk.
- **ADR-07 (Authoritative Real-Time Ranked & Ghost Unranked)**: Ranked runs 120 Hz server-authoritative simulation with client prediction; unranked uses ghost stream sync.
- **ADR-08 (Integer Ledger & Idempotency)**: Double-entry ledger with unique idempotency keys prevents double-spending and race conditions.

---

## 2. Dependency Graph & Phase Matrix

\`\`\`
Phase A — Foundations & Core Math
  MP-T01 (Meta Contracts & Pure Math) ──┬──► MP-T02 (Axle-Aligned Sphere Baker) ──► MP-T03 (Array-Texture Pool)
                                        ├──► MP-T05 (Goblin DNA & Compositor)   ──► MP-T06 (Character Creator)
                                        └──► MP-T14 (Deterministic Math Layer)  ──► MP-T13 (Authoritative Race Server)

Phase B — Identity & Garage (Visual Track)
  MP-T02 & MP-T03 ──► MP-T04 (Ball Customizer Studio Modal)
  MP-T05          ──► MP-T15 (Painted Parts Magenta Pipeline)

Phase C — Server, Stakes & Economy
  MP-T01 ──► MP-T07 (Meta Server: Ledger & Seasons) ──► MP-T08 (Hub Scheduler & Matchmaking)
                                                     ├──► MP-T09 (Permadeath & Shaman Altar)
                                                     └──► MP-T10 (Sheep Hire & AI Pilot Safety Net)

Phase D — Social, Betting & Integrity
  MP-T08 & MP-T09 ──► MP-T11 (Goblin Bookie & Betting Parlor)
  MP-T11 & MP-T14 ──► MP-T12 (Integrity Engine & Telemetry Tripwires)
\`\`\`

---

## 3. Master Ticket Index

| Ticket ID | Title | Estimate | Track | Dependencies |
| :--- | :--- | :---: | :--- | :--- |
| [\`MP-T01\`](MP-T01-meta-contracts-math-core.md) | Meta Contracts, Branded Types & Pure Math Core | 3 days | Core / Math | None |
| [\`MP-T02\`](MP-T02-axle-aligned-sphere-baker.md) | Axle-Aligned Sphere Geometry & Equirectangular Decal Baker | 4 days | 3D Graphics | \`MP-T01\` |
| [\`MP-T03\`](MP-T03-array-texture-racer-pool.md) | Array-Texture Racer Pool & 1-Draw-Call Cores | 3 days | WebGL / Perf | \`MP-T02\` |
| [\`MP-T04\`](MP-T04-ball-customizer-decal-catalog.md) | Ball Customizer Studio Modal & Decal Catalog | 5 days | UI / Garage | \`MP-T02\`, \`MP-T03\` |
| [\`MP-T05\`](MP-T05-goblin-dna-compositor.md) | Goblin DNA Codec, Occlusion Rules & SVG Compositor | 3 days | Avatar Engine | \`MP-T01\` |
| [\`MP-T06\`](MP-T06-character-creator-modal.md) | Modular Character Creator Studio & Legend Migration | 4 days | UI / Identity | \`MP-T05\` |
| [\`MP-T07\`](MP-T07-meta-server-ledger-profiles.md) | Meta Server Architecture: Idempotent Ledger & Seasons | 6 days | Server / DB | \`MP-T01\` |
| [\`MP-T08\`](MP-T08-hub-scheduler-multiplayer-screen.md) | Hub Scheduler, Matchmaking & Multiplayer Hub Screen | 6 days | Server / UI | \`MP-T07\` |
| [\`MP-T09\`](MP-T09-permadeath-shaman-profile-altar.md) | High-Stakes Permadeath, Shaman Altar & Profile Screen | 5 days | Gameplay / UI | \`MP-T07\`, \`MP-T08\`, \`MP-T05\` |
| [\`MP-T10\`](MP-T10-economy-sheep-hire-ai-pilot.md) | Economy Faucets: Sheep Hire & AI Pilot Safety Net | 3 days | Economy / Sim | \`MP-T08\`, \`MP-T09\` |
| [\`MP-T11\`](MP-T11-goblin-bookie-betting-parlor.md) | The Goblin Bookie Parlor & 100-Racer Wagering Engine | 6 days | Wagering / UI | \`MP-T08\` |
| [\`MP-T12\`](MP-T12-integrity-tripwires-suspicion.md) | Integrity Engine: Server Re-Sim & Suspicion Audits | 5 days | Anti-Cheat | \`MP-T11\`, \`MP-T09\` |
| [\`MP-T13\`](MP-T13-authoritative-race-server-prediction.md) | Authoritative Race Server & Client Prediction | 8 days | Netcode | \`MP-T07\`, \`MP-T08\` |
| [\`MP-T14\`](MP-T14-deterministic-math-cross-engine-ci.md) | Deterministic Math Layer & Cross-Engine Replay CI | 4 days | Sim / CI | \`MP-T01\` |
| [\`MP-T15\`](MP-T15-painted-parts-magenta-pipeline.md) | Painted Avatar Parts Chroma-Key Pipeline & Rig Anchors | 3 days | Asset Pipeline | \`MP-T05\` |

**Total Estimated Effort**: ~68 Engineer-Days (Client/Visual Track: 19 days, Server/Stakes Track: 49 days).
`
  },
  {
    file: 'MP-T01-meta-contracts-math-core.md',
    content: `# MP-T01: Meta Contracts, Branded Types & Pure Math Core

- **ID**: \`MP-T01\`
- **Priority**: Critical (Phase A Foundation)
- **Track**: Core Math & Contracts
- **Estimate**: 3 days
- **Dependencies**: None
- **Target Files**: \`src/game/meta/interfaces.ts\`, \`src/game/meta/shaman.ts\`, \`src/game/meta/prng.ts\`, \`tests/meta-contracts.test.ts\`, \`scripts/check.mjs\`

---

## Goal
Implement the central, zero-dependency TypeScript contracts, branded types, and pure mathematical calculation engines for Heavy Metal GP 2's meta-game. Establish the **Hybrid High-Water Mark** Shaman resurrection formula, the Seasonal Net Worth (SNW) gross-inflow guard, and deterministic PRNG generators without any Three.js or DOM dependencies.

---

## Evidence & Architectural Decisions
- **ADR-05 & §1.1**: Types must use nominal branding (\`Gold\`, \`RacerId\`, \`EpochMs\`, \`UnitU\`, \`UnitV\`) so quantities like Elo ratings and Gold currencies cannot be accidentally swapped.
- **ADR-08**: Calculations must be deterministic, pure functions operating on integer pennies/gold.
- Naive percentage resurrection formulas suffer from the **Offshore Mule**, **Pauper God-Racer**, and **Anti-Grind** exploits. The hybrid formula resolves these by enforcing \`max(B(E) * k^(n-1), P(n) * SNW)\`.

---

## Technical Specification

### 1. Branded Types & Validation Helpers
\`\`\`ts
export type Gold = number & { readonly __brand: unique symbol };
export const gold = (n: number): Gold => Math.max(0, Math.round(Number.isFinite(n) ? n : 0)) as Gold;
export const goldDelta = (n: number): number => Math.round(Number.isFinite(n) ? n : 0);
\`\`\`

### 2. The Hybrid High-Water Mark Formula
\`\`\`ts
export function calculateResurrectionCost(
  deaths: number,
  elo: number,
  snw: number,
  liquidWallet?: number
): ResurrectionCalculation {
  const n = Math.max(1, Math.min(10_000, Math.floor(deaths)));
  const safeElo = Math.max(100, Math.min(3500, elo));
  const base = 250 * Math.pow(safeElo / 1000, 2);
  const eloFloor = gold(Math.min(Number.MAX_SAFE_INTEGER, base * Math.pow(1.75, n - 1)));
  const rates = [0.15, 0.25, 0.40, 0.60, 0.85];
  const rate = rates[Math.min(n, 5) - 1];
  const wealthTax = gold(rate * Math.max(0, snw));
  const fee = gold(Math.max(eloFloor, wealthTax));
  const soulSicknessHours = ([0, 2, 6, 12, 24] as const)[Math.min(n, 5) - 1];

  return {
    inputs: { deaths: n, elo: safeElo, snw: gold(snw) },
    eloFloorBase: base,
    deathMultiplier: Math.pow(1.75, n - 1),
    eloFloor,
    wealthTaxRate: rate,
    wealthTax,
    fee,
    dominantTerm: eloFloor >= wealthTax ? 'elo-floor' : 'wealth-tax',
    soulSicknessHours,
    affordable: liquidWallet !== undefined ? fee <= liquidWallet : true,
    liquidShortfall: liquidWallet !== undefined ? gold(Math.max(0, fee - liquidWallet)) : gold(0),
    recommendation: n >= 4 ? 'retire' : n === 3 || (liquidWallet !== undefined && fee > liquidWallet) ? 'consider-retiring' : 'resurrect',
  };
}
\`\`\`

### 3. Seasonal Net Worth (SNW) Gross-Inflow Guard
\`\`\`ts
export function calculateSeasonalNetWorth(holdings: number, grossSeasonalInflow: number, lambda = 0.6): Gold {
  const safeHoldings = Math.max(0, holdings);
  const safeInflow = Math.max(0, grossSeasonalInflow);
  return gold(Math.max(safeHoldings, lambda * safeInflow));
}
\`\`\`

---

## Acceptance Criteria
- [ ] All interfaces in \`src/game/meta/interfaces.ts\` compile under strict TypeScript with 0 \`any\` types.
- [ ] \`costTable()\` matches the §6.3 reference table cell-by-cell across all 15 permutations (1,000 / 1,800 / 2,400 Elo across Deaths 1–5).
- [ ] \`calculateResurrectionCost\` handles NaN, Infinity, and negative values gracefully without throwing.
- [ ] \`calculateSeasonalNetWorth\` enforces \`0.6 * grossSeasonalInflow\` floor when holdings are dumped.
- [ ] Strict lint check: zero imports of \`three\` or \`react\` inside \`src/game/meta/**\`.
- [ ] Registered in \`scripts/check.mjs\` with 100% test pass rate.

---

## Tests to Run
\`node --import tsx --test tests/meta-contracts.test.ts\`
`
  },
  {
    file: 'MP-T02-axle-aligned-sphere-baker.md',
    content: `# MP-T02: Axle-Aligned Sphere Geometry & Equirectangular Decal Baker

- **ID**: \`MP-T02\`
- **Priority**: High (Phase A / Visual Track)
- **Track**: 3D Graphics & Asset Baking
- **Estimate**: 4 days
- **Dependencies**: \`MP-T01\`
- **Target Files**: \`src/game/ball/sphere-baker.ts\`, \`src/game/ball/materials.ts\`, \`src/game/ball/sphere-baker.worker.ts\`, \`src/game/renderer-3d.ts\`, \`src/game/loadout-art.ts\`, \`tests/sphere-baker.test.ts\`

---

## Goal
Overhaul the marble rendering pipeline by rotating the underlying \`SphereGeometry\` to align its poles with the axle (\`±X\`), placing the polar pinch completely underneath the brass bearing caps. Implement an in-memory Web Worker texture baker that projects base finishes, circumferential racing stripes, and gnomonic steampunk decals onto a seamless 2:1 equirectangular texture.

---

## Evidence & Architectural Decisions
- **ADR-01**: In Three.js \`SphereGeometry\`, poles lie at \`±Y\`. By calling \`sphereGeo.rotateZ(-Math.PI / 2)\`, the poles move to \`±X\`, which are permanently covered by the brass bearing caps (\`CAP_THETA ≈ 30°\`).
- The rolling equator now receives uniform texel density, and horizontal texture bands wrap seamlessly as rolling stripes.
- **ADR-03**: Gnomonic projection transforms decal tangent coordinates \`(X, Y)\` onto the sphere normal without distortion, eliminating seam clipping and polar skew.

---

## Technical Specification

### 1. Geometry Axle Alignment
In \`src/game/renderer-3d.ts:ensureRacerMeshes\`:
\`\`\`ts
const sphereGeo = new THREE.SphereGeometry(BALL_DRAW_RADIUS, 48, 24);
sphereGeo.rotateZ(-Math.PI / 2); // Pole +Y -> Local +X (hidden under cap)
\`\`\`

### 2. Gnomonic Decal Projection Math
For a decal stamped at \`(u₀, v₀)\` with rotation \`ρ\` and scale \`σ\`:
1. \`c = d(u₀, v₀)\` (unit surface normal).
2. Compute orthonormal tangent basis \`ê\` (east), \`n̂\` (north), and rotate by \`ρ\` into \`ê'\`, \`n̂'\`.
3. For each candidate texel direction \`d\` where \`d · c > 0.05\`:
   - \`X = (d · ê') / (d · c)\`, \`Y = (d · n̂') / (d · c)\`
   - \`s = X / (2 * tan(σ * π / 2)) + 0.5\`, \`t = 0.5 - Y / (2 * tan(σ * π / 2))\`
   - If \`(s, t) ∈ [0, 1]²\`, sample decal and blend onto canvas.

### 3. Five Procedural Base Finishes
- **Scrap Iron**: 3-octave value noise, crushed pit darks, oxidized rust edge highlights.
- **Galvanized Brass**: Anisotropic brushed grain running along \`u\` (spins visibly with the roll).
- **Damascus / Springsteel**: Carbon-folded waves \`sin((2πu + 6n) * 3 + 20v)\`.
- **Scorched Obsidian**: Ridged magma fissure noise with separate emissive channel.
- **Boiler Copper**: Patinated turquoise pools contrasted against bright penny copper.

### 4. Ambient Floor Lift (Anti-Black Terminator)
- Bake an ambient lift of \`0.15 * (1 - albedo)\` into the texture and configure \`MeshLambertMaterial\` with \`emissive: 0x1a1816\` so shadowed sides remain readable.

---

## Acceptance Criteria
- [ ] Geometry rotation places all vertices with \`|x| > cos(CAP_THETA) * r\` beneath the caps.
- [ ] Gnomonic decal projection preserves square aspect ratios when viewed along the surface normal.
- [ ] Horizontal bands wrap with zero seam mismatch at \`u = 0\` and \`u = 1\`.
- [ ] Decal rebake completes in \`≤ 40 ms\` on the worker thread for 512x256 textures.
- [ ] Full output alpha is strictly \`255\` (zero transparent black corners).
- [ ] Shaded ball surface never drops below 18% luminance in dark track regions.

---

## Tests to Run
\`node --import tsx --test tests/sphere-baker.test.ts\`
`
  },
  {
    file: 'MP-T03-array-texture-racer-pool.md',
    content: `# MP-T03: Array-Texture Racer Pool & 1-Draw-Call Cores

- **ID**: \`MP-T03\`
- **Priority**: High (Phase A / Performance)
- **Track**: WebGL Performance / 3D Engine
- **Estimate**: 3 days
- **Dependencies**: \`MP-T02\`
- **Target Files**: \`src/game/ball/ball-texture-pool.ts\`, \`src/game/renderer-3d.ts\`, \`tests/ball-texture-pool.test.ts\`

---

## Goal
Eliminate per-texture draw call explosion for 100-racer pelotons by consolidating custom ball textures into a single \`THREE.DataArrayTexture\`. Render all 100 customized marble cores in a single instanced draw call using a custom vertex attribute (\`aBallLayer\`) and shader injection.

---

## Evidence & Architectural Decisions
- At 100 racers, if every player has a distinct custom ball texture, standard \`InstancedMesh\` must break into up to 100 separate draw calls (one per unique canvas).
- By uploading all baked 256x128 textures into an array texture with \`N\` layers (\`THREE.DataArrayTexture\`), a single \`InstancedMesh\` can render the entire field with 1 draw call.
- Total VRAM footprint for 100 racers at 256x128x4 bytes: \`100 * 256 * 128 * 4 ≈ 13.1 MB\` (well within budget).

---

## Technical Specification

### 1. DataArrayTexture Pool Architecture
\`\`\`ts
export class BallTexturePool {
  private arrayTexture: THREE.DataArrayTexture;
  private readonly layerMap = new Map<string, number>(); // bakeKey -> layer index
  
  constructor(maxRacers = 100, width = 256, height = 128) { ... }
  
  allocateLayer(bakeKey: string, imageData: Uint8ClampedArray): number { ... }
  releaseLayer(bakeKey: string): void { ... }
}
\`\`\`

### 2. Shader Injection in RacerCoreMaterial
Inject custom attribute and sampler into \`MeshLambertMaterial\`:
\`\`\`glsl
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
\`\`\`

### 3. Graceful WebGL1 Fallback
- Check \`renderer.capabilities.isWebGL2\`. If false, fall back seamlessly to the existing canvas-keyed \`CoreBatch\` system.

---

## Acceptance Criteria
- [ ] A 100-racer peloton with 100 distinct customized balls renders in \`≤ 2 draw calls\` for all ball cores.
- [ ] Total GPU texture memory for 100 racers does not exceed 25 MB.
- [ ] Adding/removing racers from the lobby dynamically updates layers without re-allocating the entire array texture buffer.
- [ ] WebGL1 environments cleanly fall back to multi-batch instancing without throwing errors.

---

## Tests to Run
\`node --import tsx --test tests/ball-texture-pool.test.ts\`
`
  },
  {
    file: 'MP-T04-ball-customizer-decal-catalog.md',
    content: `# MP-T04: Ball Customizer Studio Modal & Decal Catalog

- **ID**: \`MP-T04\`
- **Priority**: High (Phase B / Visual Track)
- **Track**: Frontend UI & Garage System
- **Estimate**: 5 days
- **Dependencies**: \`MP-T02\`, \`MP-T03\`
- **Target Files**: \`src/components/garage/BallCustomizerModal.tsx\`, \`DecalGizmo.tsx\`, \`UnwrapMinimap.tsx\`, \`src/game/ball/decal-catalog.ts\`, \`public/decals/*.png\`

---

## Goal
Deliver an interactive, dieselpunk-styled 3D Ball Customizer Modal ("The Garage") that allows players to inspect their marble in an orbit viewer, select base finishes, stamp up to 12 customizable decals with live 3D surface raycasting, tweak colors and layers, and preview their design with spin physics.

---

## UI/UX Specification

### 1. Viewport Layout (1440x900 & Mobile Responsive)
- **Left Drawer (320px)**: Finish selector (Scrap Iron, Galvanized Brass, Damascus, Obsidian, Boiler Copper), primary accent color picker, seam rivet toggle.
- **Center Stage**: Interactive Three.js 3D viewport. Left-click drag orbits camera, scroll zooms, right-click pans. Includes "Test Spin" toggle to watch circumferential bands roll.
- **Right Drawer (360px)**:
  - Active Decal Stack: Drag-and-drop layer reordering (0 to 12 stamps).
  - Selected Stamp Controls: Scale slider (0.05 to 0.5), rotation knob (-180° to +180°), opacity slider, blend mode radio (\`normal\`, \`multiply\`, \`overlay\`), tint color palette.
  - Number Roundel input (0 to 99).
- **Bottom Bar**: 2D Equirectangular Unwrap Minimap with polar bearing cap occlusion guides, 50-step Undo/Redo buttons, Cart Cost readout, "Save to Slot" button.

### 2. Raycast Decal Stamping
- Clicking directly on the 3D marble surface casts a ray onto the rotated sphere.
- Normal vector is converted to \`(u, v)\` coordinates; a new \`DecalStamp\` is instantly created and selected.
- Debounced Web Worker bake updates the 3D texture in \`< 40 ms\`.

### 3. Try-Before-Buy Economy Integration
- Unowned finishes or premium decals display an ornate brass lock icon and gold price.
- Players can freely experiment; clicking "Save" tallies the total gold cost and executes a ledger transaction if affordable.

---

## Acceptance Criteria
- [ ] Modal opens and renders at 60 fps across desktop (≥ 1024px) and tablet viewports.
- [ ] Surface raycasting stamps decals within 1 texel of the cursor impact point.
- [ ] Undo/Redo stack supports 50 historical actions with coalesced drag events.
- [ ] 12-decal cap strictly enforced; attempting to add a 13th decal displays a friendly warning toast.
- [ ] Unowned items block saving until confirmed and purchased via the gold ledger.

---

## Tests to Run
\`npm run check:ui\`
`
  },
  {
    file: 'MP-T05-goblin-dna-compositor.md',
    content: `# MP-T05: Goblin DNA Codec, Occlusion Rules & SVG Compositor

- **ID**: \`MP-T05\`
- **Priority**: High (Phase B / Identity)
- **Track**: Avatar Engine
- **Estimate**: 3 days
- **Dependencies**: \`MP-T01\`
- **Target Files**: \`src/game/avatar/goblin-dna.ts\`, \`goblin-compositor.ts\`, \`layer-registry.ts\`, \`rasterize.ts\`, \`tests/goblin-avatar.test.ts\`

---

## Goal
Build a modular 2D goblin avatar generator that compiles 11 swappable anatomical and cosmetic layers into clean SVG and rasterized PNG sprites. Implement a compact 48-bit DNA string codec (\`GOB-XXXX-XXXX-XXXX\`) with checksum validation for lightweight multiplayer networking.

---

## Technical Specification

### 1. Layer Pipeline & Z-Index Ordering
\`\`\`
z=0:  background (workshop wall, furnace glow, racing pennants, smog)
z=1:  ears (bat-pointed, notched fins, torn brass ring, droopy hound)
z=2:  head (angular, bloated, scrawny) [defines headW & headTop anchors]
z=3:  warpaint (mud stripes, red handprint, cog tattoo, soot smudges)
z=4:  mouth (lower tusks, gold jags, cigar stub, stitched scar)
z=5:  nose (hooked beak, warted bulb, prosthetic metal plate)
z=6:  eyes (bloodshot crazy, narrow squint, mismatched, sleepy)
z=7:  eyewear (welding goggles up/down, brass monocle, eyepatch)
z=8:  hair (grease mohawk, mutton chops, singed topknot, wire tufts)
z=9:  headgear (aviator cap, miner headlamp, pickelhaube, bowler)
z=10: neck (spiked collar, gear chain, boiler suit, tool bandolier)
\`\`\`

### 2. Occlusion & Compatibility Rules
- Any headgear automatically occludes tall hairstyles (\`grease-mohawk\`, \`singed-topknot\`).
- \`miner-headlamp\` forces \`goggles-down\` to flip to \`goggles-up\`.
- \`pickelhaube + mohawk\` combination is automatically resolved to \`wire-tufts\`.

### 3. 48-Bit DNA Encoding (\`GOB-XXXX-XXXX-XXXX\`)
- 4-bit version header (\`v=1\`).
- 36-bit mixed-radix payload encoding 11 layer indices + 4 color palette indices.
- 8-bit FNV-1a checksum to detect typos in shared strings.
- Encodes into exactly 12 hexadecimal characters separated by dashes.

### 4. High-Performance Rasterization & Caching
- Compose SVG fragment $\to$ \`createImageBitmap(Blob(svg))\` $\to$ Canvas.
- Generates 256x256 (Profile / Hub), 128x128 (HUD badge), and 64x64 (mini map pointer).
- LRU cache capped at 256 entries (~64 MB RAM maximum).

---

## Acceptance Criteria
- [ ] 10,000 randomly generated DNA strings round-trip through encode/decode with 100% bit-exact fidelity.
- [ ] Single-character mutations in DNA strings fail checksum validation with \`≥ 99.6%\` probability.
- [ ] Occlusion rules are 100% respected across 10,000 randomized test avatars.
- [ ] \`generateRandomGoblin(seed)\` produces identical SVG hashes in both Node.js and browser environments.

---

## Tests to Run
\`node --import tsx --test tests/goblin-avatar.test.ts\`
`
  },
  {
    file: 'MP-T06-character-creator-modal.md',
    content: `# MP-T06: Modular Character Creator Studio & Legend Migration

- **ID**: \`MP-T06\`
- **Priority**: High (Phase B / Identity)
- **Track**: Frontend UI & Character Creation
- **Estimate**: 4 days
- **Dependencies**: \`MP-T05\`
- **Target Files**: \`src/components/profile/CharacterCreatorModal.tsx\`, \`src/game/loadouts.ts\`, \`src/game/avatar/legends.ts\`

---

## Goal
Build an interactive character creation studio modal where players customize their goblin racer across swappable facial features, accessories, colors, and racing archetypes. Migrate legacy character presets (\`rivet\`, \`grub\`, \`nix\`, \`sprocket\`) into selectable "Legend" skins.

---

## UI/UX Specification

### 1. Wizard Workflow
- **Step 1 · Archetype Selection**: Choose racing archetype (Mechanic, Daredevil, Bruiser, Rocket Jockey) defining physics stat offsets.
- **Step 2 · Appearance Studio**:
  - Live interactive 256x256 goblin bust preview.
  - Tabbed category drawers: Head & Ears, Eyes & Nose, Mouth & Tusks, Headgear & Hair, Collars & Warpaint.
  - Palette swatches for Skin Tone, Accent Color, Leather, and Metal.
  - Layer lock buttons (allows locking nose/eyes while hitting "Randomize").
  - "Copy DNA" and "Paste DNA" buttons with instant visual update.
- **Step 3 · Identity & Name**:
  - Goblin name generator (e.g. *Grimlock Cogsnapper*, *Brak Boltchewer*) or custom input with profanity filtering.
  - Custom racer bio and motto.

### 2. Legacy Legend Migration
- Existing saves with legacy \`RiderId\` are migrated to:
  \`AvatarSource = { kind: 'legend', rider: id } | { kind: 'dna', dna: string }\`.
- Legacy portraits remain selectable as exclusive "Legend Skins" with original art preserved.

---

## Acceptance Criteria
- [ ] Character creation wizard completes all 3 steps and commits new racer profiles to local storage.
- [ ] Randomize button respects locked layers.
- [ ] Pasting a valid DNA string updates all UI sliders and previews instantly.
- [ ] Invalid or tampered DNA strings display a descriptive inline validation message.
- [ ] Legacy saved games hydrate without losing rider identities or stat ratings.

---

## Tests to Run
\`npm run check:ui\`
`
  },
  {
    file: 'MP-T07-meta-server-ledger-profiles.md',
    content: `# MP-T07: Meta Server Architecture: Idempotent Ledger & Seasons

- **ID**: \`MP-T07\`
- **Priority**: High (Phase C / Server Track)
- **Track**: Backend Infrastructure & Database
- **Estimate**: 6 days
- **Dependencies**: \`MP-T01\`
- **Target Files**: \`server/db/schema.ts\`, \`server/ledger.ts\`, \`server/profile.ts\`, \`server/season.ts\`, \`src/net/meta-client.ts\`, \`tests/ledger.test.ts\`

---

## Goal
Implement the authoritative Meta Server backend with a PostgreSQL database and Drizzle ORM. Build a strict, double-entry financial ledger with idempotency keys, support up to 5 racer slots per account, and manage the 30-day monthly season lifecycle with soft Elo resets.

---

## Technical Specification

### 1. PostgreSQL Schema (Drizzle ORM)
- \`accounts\`: \`id\`, \`display_name\`, \`wallet_cache\`, \`slots_owned\` (1..5), \`created_at\`.
- \`racers\`: \`id\`, \`account_id\`, \`slot\`, \`status\` (\`alive\`, \`dead\`, \`retired\`), \`elo\`, \`season_deaths\`, \`dna\`, \`ball_config\` (JSONB), \`soul_sickness_until\`.
- \`ledger_tx\`: \`id\`, \`account_id\`, \`kind\`, \`delta\`, \`balance_after\`, \`idempotency_key\` (UNIQUE), \`created_at\`.
- \`hall_of_fame\`: \`id\`, \`racer_snapshot\` (JSONB), \`season\`, \`peak_elo\`, \`cause_of_retirement\`.

### 2. Double-Entry Idempotent Ledger Write Path
\`\`\`sql
BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE;
-- Lock account row
SELECT wallet_cache FROM accounts WHERE id = $accountId FOR UPDATE;
-- Validate balance sufficiency for debits
-- Insert append-only transaction
INSERT INTO ledger_tx (account_id, kind, delta, balance_after, idempotency_key)
VALUES ($accountId, $kind, $delta, $newBalance, $idempotencyKey)
ON CONFLICT (idempotency_key) DO NOTHING;
-- Update cached wallet
UPDATE accounts SET wallet_cache = $newBalance WHERE id = $accountId;
COMMIT;
\`\`\`

### 3. 30-Day Season Rollover Job
- Soft reset Elo: \`E_new = 1000 + 0.5 * (E_current - 1000)\`.
- Distribute seasonal reward purses to top 1% and 10% leaderboard tiers.
- Permanently retire dead racers to the Hall of Fame.
- Reset \`season_deaths\` and \`gross_seasonal_inflow\` counters.

---

## Acceptance Criteria
- [ ] 50 concurrent parallel debit requests with the same idempotency key execute exactly once without double-charging.
- [ ] Account balances are strictly derived from immutable ledger transactions.
- [ ] Additional racer slots (2 through 5) require explicit ledger purchases (2,500g $\to$ 6,000g $\to$ 12,000g $\to$ 25,000g).
- [ ] Season rollover job executes cleanly in transaction test, updating ratings and archiving dead racers.

---

## Tests to Run
\`node --import tsx --test tests/ledger.test.ts\`
`
  },
  {
    file: 'MP-T08-hub-scheduler-multiplayer-screen.md',
    content: `# MP-T08: Hub Scheduler, Matchmaking & Multiplayer Hub Screen

- **ID**: \`MP-T08\`
- **Priority**: High (Phase C / Server Track)
- **Track**: Multiplayer Systems & UI
- **Estimate**: 6 days
- **Dependencies**: \`MP-T07\`
- **Target Files**: \`server/scheduler.ts\`, \`server/matchmaker.ts\`, \`server/ws.ts\`, \`src/components/hub/MultiplayerHubScreen.tsx\`, \`LobbyRoomDrawer.tsx\`, \`CreateRaceDialog.tsx\`, \`src/game/session.ts\`

---

## Goal
Implement the central Multiplayer Hub screen with WebSocket lobby clocks and matchmaking. Schedule unranked races every 10 minutes and high-stakes ranked heats every 30 minutes. Support 100-racer Elo matchmaking with provably fair commit-reveal seed generation and custom lobby creation.

---

## Technical Specification

### 1. Cadence & Scheduling Architecture
- **Unranked Heats**: Start every 10 minutes on the server clock (e.g. :00, :10, :20, :30, :40, :50). Free entry, casual matchmaking, zero permadeath.
- **Ranked Heats**: Start every 30 minutes (:00, :30). 100-racer grid, strict Elo brackets, permadeath enabled.
- **Provably Fair Commit-Reveal**:
  - At T-25:00, server publishes \`seedCommit = sha256(secretSeed)\`.
  - At T-00:00 (race start), server reveals \`secretSeed\`. Clients independently verify \`sha256(secretSeed) === seedCommit\`.

### 2. Matchmaking Engine
- Bins queued players into Elo brackets (\`[0-1199]\`, \`[1200-1599]\`, \`[1600-1999]\`, \`[2000+]\`).
- Fills remaining grid slots up to 100 racers with deterministic AI racers generated via \`generateRandomGoblin(\`\${lobby.seed}:\${slot}\`)\`.

### 3. Hub UI Components
- **Top Navigation Bar**: Server status, active season countdown, current wallet gold.
- **Queue Cards**:
  - *Join Unranked*: Live countdown, entry fee ("FREE"), active player count.
  - *Join Ranked*: Live countdown, Elo requirements, permadeath warning skull, Shaman fee preview.
  - *Create Race*: Custom lobby setup modal (track, laps, entry stakes, collisions).
  - *Bookie Betting Parlor*: Direct link to active wagering markets.

---

## Acceptance Criteria
- [ ] Client countdown clocks sync to server time with \`≤ 250 ms\` drift over WebSocket.
- [ ] Ranked lobbies assemble up to 100 racers with deterministic AI fill-ins matching the seed.
- [ ] Players leaving a queue before T-02:00 receive immediate, automated entry fee refunds.
- [ ] Revealed seeds match the published SHA-256 commit hash in 100% of tested heats.

---

## Tests to Run
\`node --import tsx --test tests/matchmaking.test.ts\`
`
  },
  {
    file: 'MP-T09-permadeath-shaman-profile-altar.md',
    content: `# MP-T09: High-Stakes Permadeath, Shaman Altar & Profile Screen

- **ID**: \`MP-T09\`
- **Priority**: High (Phase C / Core Loop)
- **Track**: Gameplay Logic & UI
- **Estimate**: 5 days
- **Dependencies**: \`MP-T07\`, \`MP-T08\`, \`MP-T05\`
- **Target Files**: \`src/game/sim/hazards.ts\`, \`server/shaman.ts\`, \`src/components/profile/GoblinProfileScreen.tsx\`, \`ShamanAltar.tsx\`, \`HoldToConfirmButton.tsx\`, \`tests/shaman-flow.test.ts\`

---

## Goal
Implement the high-stakes permadeath trigger in ranked mode and build the Goblin Profile screen featuring career statistics, rank tier badges, and the Shaman's Resurrection Altar with Soul Sickness lockout management.

---

## Technical Specification

### 1. In-Sim Ranked Permadeath Triggers
In \`src/game/sim/hazards.ts\`:
- Permadeath triggers **only** when \`lobby.permadeath === true\`:
  1. *Lava Lake Submersion*: Staying submerged $> 1.2$ seconds.
  2. *TNT Chain Detonation*: Contact with high-yield explosives at high speed.
  3. *Terminal Chasm Fall*: Falling below course death planes.
  4. *High-Speed Impact Smash*: Wall collision velocity $\Delta v > 1,400$ units/sec.
- On death: Mark racer status \`dead\`, log \`DeathRecord\` with timestamp, track, and sim tick for replay seeking.

### 2. Goblin Profile Screen Layout
- **Racer Dossier**: 256x256 modular goblin portrait, custom ball 3D orbit preview, career rank tier (Rookie $\to$ Grease Monkey $\to$ Gearhead $\to$ Pit Boss $\to$ Grand Champion).
- **Career Stats Grid**: Races, Wins, Podium %, DNF Count, Elo Rating, Seasonal Net Worth.
- **Badge Showcase**: Visual badges earned through achievements.

### 3. The Shaman's Resurrection Altar (When Dead)
- Displays tombstone graphic and cause of death.
- Live cost breakdown calculated via \`calculateResurrectionCost\`:
  - Base Elo Floor: $B(E) \cdot 1.75^{n-1}$.
  - Wealth Tax: $P(n) \cdot \text{SNW}$.
  - Active Dominant Term highlighted in gold.
- "Hold to Resurrect" button (requires 1.5s press to prevent misclicks).
- Soul Sickness timer: Ranked queue lockout (2h, 6h, 12h, 24h). Unranked/Garage remains accessible.
- "Retire to Hall of Fame" option: Retires veteran permanently and opens Character Creator for a new slot.

---

## Acceptance Criteria
- [ ] Permadeath triggers strictly in ranked heats; unranked races retain standard recovery.
- [ ] Shaman Altar fee matches the exact formula output cell-for-cell.
- [ ] Soul Sickness locks players out of ranked queues while keeping unranked and garage modes active.
- [ ] Retiring a racer creates an immutable Hall of Fame record and frees the character slot.

---

## Tests to Run
\`node --import tsx --test tests/shaman-flow.test.ts\`
`
  },
  {
    file: 'MP-T10-economy-sheep-hire-ai-pilot.md',
    content: `# MP-T10: Economy Faucets: Sheep Hire & AI Pilot Safety Net

- **ID**: \`MP-T10\`
- **Priority**: Medium (Phase C / Economy Balance)
- **Track**: Economic Balancing & Sim Entities
- **Estimate**: 3 days
- **Dependencies**: \`MP-T08\`, \`MP-T09\`
- **Target Files**: \`server/contracts.ts\`, \`src/game/sim/sheep.ts\`, \`src/components/hub/AiPilotContractCard.tsx\`, \`scripts/sim/economy-season.ts\`

---

## Goal
Balance the in-game gold economy by implementing two crucial faucets: Trackside Sheep Hire for steady unranked grinding, and the AI Pilot Bankruptcy Contract as an anti-softlock safety net for destitute players.

---

## Technical Specification

### 1. Trackside Sheep Hire
- **Contract Cost**: 25 gold rental fee per race.
- **Mechanism**: A friendly escort sheep spawns alongside the player's marble in unranked races, hoovering track scrap.
- **Payout**: Yields 50 to 100 gold depending on scrap collected.
- **Diminishing Returns**:
  - Races 1–12 per day: 100% payout (net +25g to +75g per race).
  - Races 13–24 per day: 50% payout.
  - Races 25+ per day: 10% payout (net-negative to deter botting).

### 2. AI Pilot Contract (The Broke Safety Net)
- **Eligibility Snapshot**: Enforced strictly server-side:
  - Account wallet $< 25$ gold (cannot afford sheep hire).
  - Active racer is dead and cannot afford Shaman fee.
  - No sellable inventory items remaining.
- **Contract Terms**:
  - Player joins an active race queue as an AI runner pilot.
  - Payout: Exactly **50% of an average sheep payout** (25 to 50 gold) with zero entry fee.
  - Anti-AFK Validation: Requires $\ge 60\%$ human input ticks during the race; otherwise voided.

### 3. Automated 30-Day Economy Simulation Test
- A simulation test in CI running 2,000 agents over 30 days under seed 1337.
- Asserts that faucet/sink ratio remains strictly $\in [0.9, 1.2]$ and $\ge 50\%$ of bankrupt agents recover to $\ge 1,000$ gold.

---

## Acceptance Criteria
- [ ] Sheep hire contract applies daily diminishing returns after 12 and 24 races.
- [ ] AI pilot contracts are available exclusively when the bankruptcy eligibility check passes.
- [ ] Anti-AFK check voids payout if input ticks drop below 60%.
- [ ] 30-day CI simulation test passes with zero runaway inflation.

---

## Tests to Run
\`node --import tsx scripts/sim/economy-season.ts\`
`
  },
  {
    file: 'MP-T11-goblin-bookie-betting-parlor.md',
    content: `# MP-T11: The Goblin Bookie Parlor & 100-Racer Wagering Engine

- **ID**: \`MP-T11\`
- **Priority**: High (Phase D / Social Track)
- **Track**: Wagering Engine & Compliance
- **Estimate**: 6 days
- **Dependencies**: \`MP-T08\`
- **Target Files**: \`server/bookie/pricing.ts\`, \`server/bookie/settle.ts\`, \`src/components/bookie/BookieParlorModal.tsx\`, \`OddsBoard.tsx\`, \`BetSlip.tsx\`, \`tests/bookie.test.ts\`

---

## Goal
Deliver the Goblin Bookie Betting Parlor, allowing players and spectators to place gold wagers on 100-racer ranked heats. Implement a zero-liability pari-mutuel wagering engine with strict lock timers, anti-match-fixing rules, and regional compliance toggles.

---

## Technical Specification

### 1. Betting Window & Schedule
- Opens at T-25:00 (25 minutes before race).
- **Hard Lock at T-05:00**: Server rejects any wagers placed within 5 minutes of race start (T-04:59.999 is rejected).

### 2. Wagering Markets
1. *Outright Winner*: Pari-mutuel pool with 8% house takeout (rake).
2. *Podium Place*: Pays on 1st, 2nd, or 3rd place finishes.
3. *Over/Under Casualties*: Will more than $X$ racers die in the heat?
4. *Head-to-Head*: Fixed decimal odds on which of two rival racers finishes higher (with liability caps).

### 3. Anti-Corruption & Match-Fixing Protections
- **No Self-Sabotage**: Racers cannot wager against themselves or bet on their own death.
- **Self-Win Cap**: A racer betting on themselves to win is capped at 10% of their Seasonal Net Worth.
- **Regional Compliance Toggle**: In-game gold cannot be bought or cashed out for real money. Bookie parlor includes an admin toggle to disable betting per jurisdiction without breaking the core loop.

### 4. UI Odds Board & Bet Slip
- Virtualized 100-racer odds board updating at 60 fps with 2-second throttled WebSocket odds diffs.
- Interactive bet slip with stake slider, potential return calculator, and "Submit Wager" confirmation.

---

## Acceptance Criteria
- [ ] Hard lock strictly enforces T-05:00 closure down to millisecond precision.
- [ ] Pari-mutuel settlement property test: \`sum(payouts) + rake + breakage === totalPool\` across 10,000 randomized pools.
- [ ] System automatically rejects any attempt by a participant to bet against their own racer.
- [ ] Regional toggle cleanly hides bookie interfaces when disabled.

---

## Tests to Run
\`node --import tsx --test tests/bookie.test.ts\`
`
  },
  {
    file: 'MP-T12-integrity-tripwires-suspicion.md',
    content: `# MP-T12: Integrity Engine: Server Re-Sim & Suspicion Audits

- **ID**: \`MP-T12\`
- **Priority**: High (Phase D / Anti-Cheat)
- **Track**: Integrity & Telemetry Heuristics
- **Estimate**: 5 days
- **Dependencies**: \`MP-T11\`, \`MP-T09\`
- **Target Files**: \`server/integrity/replay.ts\`, \`server/integrity/suspicion.ts\`, \`src/game/sim/telemetry-tripwires.ts\`, \`server/integrity/cluster.ts\`, \`tests/integrity.test.ts\`

---

## Goal
Build the match-fixing and fraud detection engine that evaluates player telemetry during high-stakes ranked races. Combine telemetry tripwires, payout anomaly tracking, and a composite Suspicion Score to freeze fraudulent payouts into escrow and penalize win-trading syndicates.

---

## Technical Specification

### 1. In-Race Telemetry Tripwires
During race replay re-simulation, inspect participant inputs:
- *Brake-Check Tripwire*: Sudden sustained braking on open straights with a following racer within drafting range.
- *Route Abandonment*: Intentional steering into hazard zones (lava lakes, pits) without evasive maneuvers.
- *Input Cessation*: Dropping throttle inputs for $> 2.0$ seconds while in a podium position.

### 2. Suspicion Score ($S \in [0, 100]$)
A composite index calculated from:
$$S = 0.35 \cdot S_{\\text{telemetry}} + 0.35 \cdot S_{\\text{betting-volume}} + 0.30 \cdot S_{\\text{payout-deviation}}$$
- High underdog betting spikes from linked accounts increase $S_{\\text{betting-volume}}$.
- Payout deviations $> 3.5\\sigma$ above historical baseline elevate $S_{\\text{payout-deviation}}$.

### 3. Automated Enforcement Ladder
- **$S \ge 65$**: Payout is placed in Bookie Escrow for 1 hour pending automated audit.
- **$S \ge 85$**: Bookie Cooldown applied (account wagering privileges suspended for 24 hours).
- **Syndicate Match-Fixing Flag**: Confiscates winnings to the Goblin Mob Fund and applies an Elo penalty.

---

## Acceptance Criteria
- [ ] Server re-simulation verifies bit-exact finishing order from uploaded input streams.
- [ ] Synthetic telemetry test streams trigger tripwires for deliberate deceleration and hazard steering.
- [ ] Accounts exceeding $S \ge 65$ have payouts automatically held in escrow.
- [ ] Escrowed funds release automatically after 1 hour if audit score remains clean.

---

## Tests to Run
\`node --import tsx --test tests/integrity.test.ts\`
`
  },
  {
    file: 'MP-T13-authoritative-race-server-prediction.md',
    content: `# MP-T13: Authoritative Race Server & Client Prediction

- **ID**: \`MP-T13\`
- **Priority**: Critical (Phase C / Architecture)
- **Track**: Netcode & Physics Parity
- **Estimate**: 8 days
- **Dependencies**: \`MP-T07\`, \`MP-T08\`
- **Target Files**: \`server/race-server.ts\`, \`server/race-instance.ts\`, \`src/net/prediction.ts\`, \`src/net/interpolation.ts\`, \`tests/netcode-parity.test.ts\`

---

## Goal
Implement a server-authoritative 120 Hz headless simulation for ranked heats. Clients send 60 Hz input packets and predict local ball movement with rollback reconciliation, while interpolating remote marbles from 20 Hz server snapshots.

---

## Technical Specification

### 1. Performance Spike & Benchmark Gate
- Benchmark headless Node.js simulation with 100 marbles colliding on the Ridge track.
- Gate: Server tick duration must stay $\le 2.0$ ms per tick on the target cloud CPU.

### 2. Client-Side Prediction & Rollback
- Client simulates local marble ahead of server time.
- On receiving authoritative snapshot:
  - If discrepancy $> 0.5$ units: snap state back to snapshot tick and replay unacknowledged inputs.
  - Smooth visual position error over 100 ms to eliminate jitter.

### 3. Remote Entity Interpolation
- Server broadcasts compressed position/rotation snapshots at 20 Hz.
- Client buffers snapshots with a 100 ms interpolation delay, using Hermite spline interpolation for smooth motion.

---

## Acceptance Criteria
- [ ] 100-racer headless server simulation executes in $\le 2.0$ ms per tick.
- [ ] Client prediction handles up to 150 ms simulated network latency with zero visual snap under normal driving.
- [ ] Rollback reconciliation correctly corrects collisions and track hazard impacts.
- [ ] Remote racers move smoothly at 60 fps without rubber-banding under steady 20 Hz snapshot delivery.

---

## Tests to Run
\`node --import tsx --test tests/netcode-parity.test.ts\`
`
  },
  {
    file: 'MP-T14-deterministic-math-cross-engine-ci.md',
    content: `# MP-T14: Deterministic Math Layer & Cross-Engine Replay CI

- **ID**: \`MP-T14\`
- **Priority**: Critical (Phase A / Sim Integrity)
- **Track**: Deterministic Simulation & CI
- **Estimate**: 4 days
- **Dependencies**: \`MP-T01\`
- **Target Files**: \`src/game/sim/deterministic-math.ts\`, \`tests/cross-engine-determinism.test.ts\`, \`scripts/check-transcendentals.mjs\`

---

## Goal
Eliminate cross-engine floating-point divergence by replacing implementation-defined JavaScript transcendental functions (\`Math.sin\`, \`Math.cos\`, \`Math.pow\`) with deterministic, IEEE-754 correctly-rounded polynomial approximations. Establish CI verification across V8, SpiderMonkey, and JavaScriptCore.

---

## Technical Specification

### 1. Transcendental-Free Math Library
- Replace \`Math.sin\` and \`Math.cos\` with Chebyshev 7th-degree polynomial approximations using only \`+\`, \`-\`, \`*\`, \`/\`, and \`sqrt\` (which IEEE-754 guarantees to be correctly rounded).
- Use precomputed high-resolution lookup tables for track spline curvature and lane positions.

### 2. AST Linter Rule
- Add custom linter script (\`scripts/check-transcendentals.mjs\`) that forbids direct calls to native \`Math.sin/cos/tan/pow/exp\` inside \`src/game/sim/**\`.

### 3. Cross-Engine Playwright CI Test
- Run 100 recorded race input streams in Node (V8), Chromium (V8), Firefox (SpiderMonkey), and WebKit (JavaScriptCore) using Playwright.
- Hash racer state vectors every 120 ticks; assert 100% bit-exact hash equivalence across all engines.

---

## Acceptance Criteria
- [ ] \`scripts/check-transcendentals.mjs\` reports 0 disallowed \`Math\` calls in the physics sim.
- [ ] Polynomial approximations evaluate within \`1e-7\` of reference doubles.
- [ ] 100 recorded race replays achieve bit-exact state hash matches across V8, SpiderMonkey, and JavaScriptCore.

---

## Tests to Run
\`node scripts/check-transcendentals.mjs\`
\`node --import tsx --test tests/cross-engine-determinism.test.ts\`
`
  },
  {
    file: 'MP-T15-painted-parts-magenta-pipeline.md',
    content: `# MP-T15: Painted Avatar Parts Chroma-Key Pipeline & Rig Anchors

- **ID**: \`MP-T15\`
- **Priority**: Medium (Phase B / Asset Pipeline)
- **Track**: Asset Keying & Art Integration
- **Estimate**: 3 days
- **Dependencies**: \`MP-T05\`
- **Target Files**: \`src/hmgp2/chroma-key.ts\`, \`scripts/key-avatar-parts.ts\`, \`src/hmgp2/painted-parts.ts\`, \`tests/avatar-keying.test.ts\`

---

## Goal
Implement the production chroma-keying and asset registration pipeline for painted goblin avatar parts. Process raw \`#FF00FF\` magenta-backed generator outputs, clean fringe halos via YCbCr decontamination, and bind parts to standardized Rig Anchors.

---

## Technical Specification

### 1. YCbCr Chroma-Plane Keyer
- **Key Detection**: Calculate median RGB of a 1% border ring around the image to handle slight generator color drift.
- **Matte Extraction**: Compute Euclidean distance in \`(Cb, Cr)\` chroma space to keep dark outlines fully opaque.
- **Decontamination**: Mathematically unmix residual magenta from anti-aliased edge pixels ($F = (C - (1-\alpha)K)/\alpha$).
- **Despill Pass**: Clamp excess magenta cast down to neutral tones without altering goblin skin or brass metals.

### 2. Rig Anchor Binding & Head-Shape Scaling
- Register each part with a normalized \`pivot: [u, v]\` mapped to standard Rig Anchors:
  \`eye-left (104, 130)\`, \`eye-mid (128, 130)\`, \`eye-right (152, 130)\`, \`brow-line (128, 112)\`, \`crown (128, headTop + 32)\`, \`nose (128, 160)\`, \`mouth (128, 188)\`, \`chin (128, 210)\`.
- Headgear scales dynamically with head width: \`width = 2 * headW + k\`, fitting angular, bloated, and scrawny head shapes seamlessly.

---

## Acceptance Criteria
- [ ] Keyer processes raw parts with 0 residual magenta edge bleed.
- [ ] Trimmed bounding boxes and pivot points align within \`≤ 2 px\` of Rig Anchors across all 3 head shapes.
- [ ] Downsampling uses premultiplied alpha to prevent dark edge fringing.
- [ ] Processed parts pass \`scripts/check-edge-magenta.mjs\` with 0 failures.

---

## Tests to Run
\`node --import tsx --test tests/avatar-keying.test.ts\`
\`node scripts/check-edge-magenta.mjs avatar\`
`
  }
];

console.log('Writing multiplayer tickets to', outDir);
for (const t of tickets) {
  const target = join(outDir, t.file);
  writeFileSync(target, t.content.trim() + '\n', 'utf8');
  console.log('Wrote:', t.file);
}
console.log('All 16 ticket files generated successfully.');
