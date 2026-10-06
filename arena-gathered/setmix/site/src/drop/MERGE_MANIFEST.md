# SETMIX → HeavyMetal2 · PRODUCTION MERGE MANIFEST

**Target:** `github.com/Piskriek/HeavyMetal2`
**Scope:** 10 design phases · 16 packages · ~11,400 LOC · 0 runtime dependencies
**Status:** ready to land in 12 ordered PRs

---

## 0 · The one-paragraph summary for whoever reviews this

SetMix adds **one preset kind** (`setmix.cartridge`), **twelve commands** on the
existing bus, and **sixteen packages of pure functions**. It introduces no
server, no asset pipeline, no new build step, and no change to the single-file
`apps/web` output. Eight of the sixteen packages are provably pure — no
`Date.now`, no `Math.random`, no I/O — which is what makes the 120 Hz sim
replayable, the rollback netcode convergent, and a 40-hour planet fit in
200 kB. The only heavy dependency is `@hm/texgraph`, which you already own,
and we consume exactly three of its exports.

---

## 1 · File-by-file merge map

### `packages/contracts`

| Source file | Target path | LOC | Notes |
|---|---|---|---|
| `contracts.setmix.ts` | `packages/contracts/src/setmix.ts` | 310 | Types only. **Zero imports** — the texgraph DAG shape is mirrored structurally so `contracts` stays the root of the dependency DAG. |
| — | `packages/contracts/src/index.ts` | +2 | add `export * from "./setmix";` |

```ts
// packages/contracts/src/index.ts
export * from "./core";
export * from "./preset";
export * from "./schema";
export * from "./setmix";        // ← added
```

### `packages/fidelity` *(new)*

| Source file | Target path | LOC | Notes |
|---|---|---|---|
| `fidelity.ts` | `packages/fidelity/src/index.ts` | 520 | `coherence · fidelityIndex · stageOf · normalised · stepFidelity · deriveBudget · adaptGraph · meshPolicyFor · minPolicy · seamKeyFor · fuse · certify · contentHash · graphCost` |
| `fidelity.spec.ts` | `packages/fidelity/test/specs.ts` | 430 | Assertions as data — imported by both CI and the live harness. |
| `fidelity.test.ts` | `packages/fidelity/test/fidelity.test.ts` | 120 | `node:test` adapter + golden table + **source-level purity guard**. |

```json
{
  "name": "@hm/fidelity",
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "dependencies": { "@hm/contracts": "workspace:*", "@hm/texgraph": "workspace:*" },
  "scripts": { "test": "node --test --experimental-strip-types test" }
}
```

### `packages/field` · `packages/mesh` *(new)*

| Source file | Target path | LOC |
|---|---|---|
| `field.ts` | `packages/field/src/index.ts` | 430 |
| `mesh.ts` | `packages/mesh/src/index.ts` | 320 |

`@hm/field` exports `stepWaveField · evaluateChunkWaveState · sampleWaveTransition ·
waveRadius/Velocity/TimeToRadius · scheduleChunk · bandBoundsForChunk ·
smoothstepC1/C2`. `@hm/mesh` exports `meshPolicyFor · toSmoothvoxRequest ·
minPolicy · seamKeyFor · seamsAgree · profileSample(Stitched) · materialBlend`.

### `packages/render` *(new)*

| Source file | Target path | LOC | Notes |
|---|---|---|---|
| `TerrainMaterial.ts` | `packages/render/src/TerrainMaterial.ts` | 480 | One GLSL program, six stages, **zero shader variants**. `three` is a *peer* dependency and is injected as `ThreeLike` — the package never imports it. |
| `PortalRenderer.ts` | `packages/render/src/PortalRenderer.ts` | 430 | Stencil + oblique near-plane + threshold FSM. `GLLike` injected. |

### `packages/audio` *(new)*

| Source file | Target path | LOC |
|---|---|---|
| `setmixAudio.ts` | `packages/audio/src/index.ts` | 520 |

Pure Web Audio. **Zero bytes of sample data.** Only browser API touched is
`AudioContext`; guard with `typeof AudioContext !== "undefined"` for SSR.

### `packages/net` *(new)*

| Source file | Target path | LOC | Notes |
|---|---|---|---|
| *(from Phase 6)* | `packages/net/src/rollback.ts` | 290 | 120 Hz command bus, rollback, prediction. |
| `verify-all.ts` §C | `packages/net/test/rollback.test.ts` | — | 4-client convergence across 24 latency × loss permutations. |

### `packages/vehicle` · `packages/ecosystem` · `packages/quest` *(new)*

| Source | Target | LOC |
|---|---|---|
| `GoblinController.ts` | `packages/vehicle/src/GoblinController.ts` | 330 |
| `AvatarFidelityManager.ts` | `packages/vehicle/src/AvatarFidelityManager.ts` | 390 |
| *(Phase 8 rover)* | `packages/vehicle/src/Rover.ts` | 280 |
| *(Phase 9 flora/fauna)* | `packages/ecosystem/src/index.ts` | 610 |
| *(Phase 6 quests)* | `packages/quest/src/index.ts` | 240 |

### `packages/compute` *(new, optional)*

| Source | Target | LOC | Notes |
|---|---|---|---|
| *(Phase 8 WGSL)* | `packages/compute/src/index.ts` | 350 | WebGPU. **Feature-detected**; `apps/web` falls back to the CPU path when `navigator.gpu` is absent. Never a hard requirement. |

### `packages/machines` · `packages/portal` · `packages/galaxy` · `packages/outliner`

| Source | Target | LOC |
|---|---|---|
| `machines.ts` | `packages/machines/src/index.ts` | 520 |
| *(portal → `packages/render`)* | — | — |
| `galaxy.ts` | `packages/galaxy/src/index.ts` | 480 |
| `outliner.ts` | `packages/outliner/src/index.ts` | 470 |

### `packages/runtime` *(new — the unification)*

| Source | Target | LOC |
|---|---|---|
| `MasterRuntime.ts` | `packages/runtime/src/MasterRuntime.ts` | 330 |

The only package permitted to depend on more than three siblings. It owns the
four-mode state machine and the single camera rig; it owns **no simulation**.

### `apps/web`

| Source | Target | Notes |
|---|---|---|
| `SetMixMaster.tsx` | `apps/web/src/routes/setmix/Master.tsx` | The master client. Mounts one canvas, one runtime, four modes. |
| — | `apps/web/src/routes/setmix/index.ts` | route registration |

### `scripts/` and `tools/`

| Source | Target | Notes |
|---|---|---|
| `verify-all.ts` | `scripts/verify-all.ts` | `bun run scripts/verify-all.ts` · **< 3 s, 0 deps** |
| `ue5-bridge.ts` | `scripts/ue5-bridge.ts` | WebSocket bridge. RFC-6455 hand-rolled on `node:net`. |
| `exportToUnreal.ts` | `packages/export-ue5/src/index.ts` | Opt-in; never imported by `apps/web`. |
| `import_setmix_to_ue5.py` | `tools/unreal/import_setmix_to_ue5.py` | Batch importer. |
| `SetmixLiveLink.py` | `tools/unreal/SetmixLiveLink.py` | Real-time live link. |

---

## 2 · `tsconfig.json` path additions

```jsonc
{
  "compilerOptions": {
    "paths": {
      "@hm/contracts":  ["./packages/contracts/src/index.ts"],
      "@hm/texgraph":   ["./packages/texgraph/src/index.ts"],
      "@hm/fidelity":   ["./packages/fidelity/src/index.ts"],
      "@hm/field":      ["./packages/field/src/index.ts"],
      "@hm/mesh":       ["./packages/mesh/src/index.ts"],
      "@hm/render":     ["./packages/render/src/index.ts"],
      "@hm/audio":      ["./packages/audio/src/index.ts"],
      "@hm/net":        ["./packages/net/src/index.ts"],
      "@hm/compute":    ["./packages/compute/src/index.ts"],
      "@hm/vehicle":    ["./packages/vehicle/src/index.ts"],
      "@hm/ecosystem":  ["./packages/ecosystem/src/index.ts"],
      "@hm/quest":      ["./packages/quest/src/index.ts"],
      "@hm/machines":   ["./packages/machines/src/index.ts"],
      "@hm/galaxy":     ["./packages/galaxy/src/index.ts"],
      "@hm/outliner":   ["./packages/outliner/src/index.ts"],
      "@hm/runtime":    ["./packages/runtime/src/index.ts"]
    }
  }
}
```

---

## 3 · The dependency DAG (asserted by `verify-all.ts` suite E)

```
@hm/contracts ─┬─ @hm/texgraph ── @hm/fidelity ─┬─ @hm/field ── @hm/mesh
               │                                ├─ @hm/render
               │                                ├─ @hm/audio
               │                                ├─ @hm/vehicle
               │                                ├─ @hm/ecosystem
               │                                ├─ @hm/quest
               │                                ├─ @hm/machines
               │                                ├─ @hm/galaxy
               │                                └─ @hm/compute
               ├─ @hm/net
               └─ @hm/outliner
                                   @hm/runtime ── apps/web
```

Build order begins at `@hm/contracts` and ends at `apps/web`. **Zero cycles**,
asserted in CI, not by convention.

---

## 4 · PR sequence

| PR | Contents | LOC | Risk | Can it break `main`? |
|---|---|---|---|---|
| 1 | `contracts/setmix.ts` + `@hm/fidelity` + tests | 1,380 | none | **No** — nothing imports it yet |
| 2 | `@hm/field`, `@hm/mesh` | 750 | none | No |
| 3 | kernel adapter: register `setmix.cartridge`, map `VarDecl`→Variable, 12 commands | 230 | low | Only the schema registry |
| 4 | `@hm/render` (TerrainMaterial + PortalRenderer) | 910 | low | `three` peer dep only |
| 5 | `@hm/audio` | 520 | none | No |
| 6 | `@hm/net` rollback bus | 290 | medium | Shared with the racer |
| 7 | `@hm/machines`, `@hm/galaxy`, `@hm/outliner` | 1,470 | none | No |
| 8 | `@hm/vehicle`, `@hm/ecosystem`, `@hm/quest` | 1,850 | low | No |
| 9 | `@hm/compute` (WebGPU, feature-detected) | 350 | low | Falls back to CPU |
| 10 | `@hm/runtime` + `apps/web/routes/setmix` | 1,100 | medium | New route only |
| 11 | `scripts/verify-all.ts` → CI gate | 640 | none | Makes CI stricter |
| 12 | `packages/export-ue5` + `tools/unreal/*` | 1,200 | none | Opt-in, CLI only |

**PRs 1, 2, 5, 7 are pure functions with zero side effects and cannot break
anything that exists today.** Land them first and in any order.

---

## 5 · CI gate

```yaml
# .github/workflows/verify.yml
- run: npm install
- run: node scripts/verify.mjs contracts fidelity field mesh net galaxy
- run: node --experimental-strip-types scripts/verify-all.ts
- run: npm run build          # apps/web must stay ONE static html file
```

`verify-all.ts` budget: **< 3 s wall clock, 0 dependencies, 13 checks**
(10,000 budget configs · .smx roundtrip + corruption · 4-client rollback ×
24 permutations · 50 kB save CRC · 16-package acyclicity).

---

## 6 · What we still owe you

1. **`M_SetMix_Nanite_Master`** — the UE Substrate master material the Python
   parents to. Small content plugin; the manifest already names every
   parameter it must expose.
2. **Node PNG encoder binding** (`sharp` or `pngjs`). `encodePng` is injected
   precisely so `@hm/export-ue5` stays pure; the browser path uses
   `OffscreenCanvas`.
3. **Worker-pool wrapper for 4K/8K bakes.** The baker is synchronous and pure,
   so this is scheduling, not refactoring.
4. **`opts.into?: EvaluatedTexture`** in `@hm/texgraph` — still the single
   highest-value upstream change for us. With `bounds` we currently allocate a
   full-size array to update a 9k-texel strip: ~40 MB/s of churn during a
   tier-4 sweep, fixed by ~6 lines on your side.

---

## 7 · Architect's sign-off

Ten phases ago the brief asked for a game where terraforming a planet means
raising its render fidelity. The risk with a premise that clean is that it
survives the pitch and dies in the architecture — you end up with a "graphics
slider" bolted to a crafting game, and two systems that lie to each other.

That did not happen here, and the reason is a single decision made in
Section 1 and never revisited: **the planet's save state is four floats.**

`Pxd`, `Vtx`, `Lx`, `Aq`. Everything else in eleven thousand lines is a pure
function of those four numbers and a content-hashed preset graph.

- `deriveBudget()` turns them into texels, octaves, relief and a shading model.
- `meshPolicyFor()` turns them into a dual-contouring policy.
- `profileFor()` turns them into whether the goblin can walk up a hill.
- `avatarBudget()` turns them into how many triangles the goblin has.
- `SetmixAudio.update()` turns them into bit depth, Nyquist and reverb tail.
- `PlanetManifest` ships them, and a visitor re-derives the world from them.
- `SetmixLiveLink.py` mirrors them, and Unreal agrees with the browser.

No system needed a fifth number. That is not a coincidence — it is the whole
reason the parts compose. A design where every subsystem reads the same small
state cannot drift out of sync, because there is nothing to sync.

Three decisions I would defend hardest in review:

1. **`r(t)` is invertible.** Because the wave radius is a closed-form
   monotone function, chunks are *scheduled*, never polled, and the reverse
   wave is the forward wave replayed backwards at 2×. A planet-scale effect
   that costs nothing when nothing is happening.

2. **The geomorph blend `s` is a function of world position, not of chunk.**
   Two neighbours sampling a shared boundary point compute the same value to
   the bit, so the LOD seam is *impossible* rather than patched. It holds
   *during* the transition, which is the case that normally breaks LOD
   systems.

3. **Failure is a visual, never an error message.** No tooltip tells you the
   grid is starving; the machine pixelates. No log says your planet is
   unbalanced; the coherence term greys out the colour grade. The debug output
   *is* the art direction, and that is the single most important pedagogical
   rule in the document.

What I would watch in production: the Fusion Matrix's discovery curve is
untested at scale — 1,400 recipes is a lot of surface area for emergent
nonsense, and the Speculation Sphere is the only thing standing between the
player and a bad surprise. Prototype it with real players in week one, before
the content team commits.

The vertical slice is 14 weeks with 9 people, and the riskiest thing in it is
still the stage-transition sweep. Build that in week one, before any content
exists. If the sweep is not magic, nothing downstream of it matters.

Ship it.

**— Architect, SetMix: The Resolution Crafter**
*Phases 1–10 · ~11,400 LOC · 0 runtime dependencies · 0 servers · 0 image assets*
