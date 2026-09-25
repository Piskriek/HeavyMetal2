# Track-space mapping (T03)

`src/game/track-space.ts` is the single source of truth for the mapping the
race engine and the 3D renderer share. It is **headless**: immutable data +
pure math, no THREE, no WebGL. The renderer (`renderer-3d.ts`) consumes it for
the rendered world and for placed-prop elevation; physics can consume it
without a GPU.

## Spaces and units

| Space | Variable | Unit | Notes |
|---|---|---|---|
| Engine x | `x` | x-units | `START_X = 190`; physics velocity `vx` is **x-units per second** |
| Engine distance | `distance` | engine-distance | **`engine x = 190 + 2 × distance`** — engine-distance moves half an x-unit per x-unit |
| Track distance | `s` | spline arc-length (world units) | sampled every `SAMPLE_SPACING = 50`; `s ∈ [0, L]` |
| Lane position | `z` | lane units | `z ∈ [±480]` across the local track half-width |
| Altitude | — | world units | height of the **ball bottom** above the ribbon surface (see quirk) |
| World | — | world units | the spline-frame position the renderer draws and physics collides in |

Track distance ↔ engine distance is a piecewise-linear reparameterization
(`trackDistFromEngineDistance` / inverse) that preserves **exit speed**:
`Ds/d(distance)` is constant locally, so velocity magnitude is unchanged by
the mapping. Ramps do not add spline arc — a ramp's length is measured along
the flattened start→crest span, so crossing a ramp does not distort engine
speed units (speed-up on ramps comes from physics, not the reparameterization).

Velocity check enforced in tests: on flat straights where `|∂P/∂s| = 1`,
`|v_world| ≈ (vx/2) × ARC_PER_ENGINE_DISTANCE`, verified against
finite-differenced positions to 2%.

## Placement model (what "space" a racer's position lives in)

```
world position = frame.pos
               + frame.right × (z / 480) × (halfWidth(s) − 1.2 × RADIUS)
               + frame.up    × (RADIUS + altitude)
```

`frameAt(s)` returns a re-orthonormalized frame marched along the spline
(see below). `RADIUS = 31` (ball radius), `RADIUS × 1.2` is the edge margin.

**Physical versus visual.** The altitude composition (`ramp vs course
elevation`, both measured from the surface under the ball; M5 retired the slingshot-era
height above the flat legacy ground) is **physical state** — it is part of the canonical
position and of the rendered mesh. Camera smoothing, screen shake, HUD
bobbing, and ball *spin* are **visual only** and never feed back into
positions or velocities — the tests treat the placement transform as exact.

**Grounded-state quirk (documented, preserved).** When grounded, the legacy
engine resolves `y = surfaceAt(x,z).y − RADIUS`, which makes
`engine elevation ≡ RADIUS` regardless of terrain. `placementFromEngine`
therefore treats grounded altitude as ball-bottom height and places the ball
center at `up × (RADIUS + altitude)`. The quirk is preserved so T03 produces
zero visual/physical drift; fixing it is out of scope.

## Frames

Frames are marched along the spline with a tangent-aligned transport
(verbatim port of the legacy `buildTrack` loop: Gram–Schmidt transport of
`up` with a gravity lerp `k = 0.12 · clamp(up.y, 0, 1)` where a horizontal
gravity direction exists, banking with lerp `0.15` clamped to `±0.35`, loop
windows `s ∈ [start − 60, end + 60]`). The renderer now **converts these
frames** instead of running its own copy; the frame basis matches the legacy
THREE pipeline to `≤ 1e-15` (`tests/track-space.test.ts`, test 3), so the
swap is bit-faithful.

Right-handed convention: `right = normalize(cross(tangent, up))`. For
forward `+z` this yields `(−1, 0, 0)`; lane `z = +480` sits along `+right`.

## Speed units and exit-speed preservation

- Engine velocity: `vx` in x-units/s. Distance rate: `distance-rate = vx/2`.
- World rate: `s-rate = distance-rate × (ds/d distance)` locally.
- The mapping is monotone and piecewise affine; at section boundaries it is
  continuous (tested) so speed never jumps.
- `worldVelocity` / `canonicalVelocityFromEngine` implement the analytic
  Jacobian of the placement model; tests compare against finite differences
  (`DT = 1e-4`) with relative error `< 1e-3`, including slopes, curves,
  loops, section boundaries, and the stadium flat.

## Placed ramps — the required decision

Renderer-only ramp elevation is gone. A placed ramp prop either compiles to
a physical surface shared by rendering and physics, or it is **rejected
visibly**:

- `compileRampSurfaces(props)` → `{ supported: PhysicalRampSurface[] ,
  rejected: { prop, reason, detail }[] }`. Compiles only surfaces physics
  can represent (incline model `h = height · (δ/length)^exponent` rising to
  the crest, measured along the flattened spline span); the legacy scripted
  past-crest arc is removed (ballistics are physics-owned).
- `classifyPlacedRamp(space, prop)` explains a single prop; rejection codes:
  - `non-finite` — non-finite transform;
  - `invalid-scale` — scale ≤ 0 or larger than the documented envelope;
  - `projection-failed` — prop is farther than 1200 units from the ribbon
    (no backing surface);
  - `ambiguous-backing` — two overlapping track sheets (loop crossover)
    within the discrimination window, so the ramp's backing is ambiguous;
  - `insufficient-width` — the ramp footprint overhangs the ribbon by more
    than one ball radius;
  - `unsupported-region-loop` — the footprint intersects a loop window.
- The renderer draws `supported` ramps only and logs
  `[track-space] placed ramp is not physical: …` for rejected ones instead
  of silently elevating them.
- The 3D builder rejects invalid ramp placements/moves/resizes up front with
  a UI toast ("Ramp not physical here — …") and no state change.

## Singular/ambiguous transforms

- `worldFromEngine` throws `TrackSpaceError` for non-finite transforms or
  lanes/altitudes outside the documented envelope — failing visibly instead
  of landing in a silently wrong location.
- `engineFromWorld` projections return `ambiguous: true` when two ribbon
  sheets (e.g. the loop crossover deck) lie within the discrimination
  window; mid-way points are flagged, on-deck points are not (tested).

## Headless use

```ts
import { getTrackSpace, placementFromEngine, engineDistanceFromX } from './track-space';
const space = getTrackSpace();            // immutable, built once per process
const d = engineDistanceFromX(x);
const placement = placementFromEngine(space, { x, distance: d, y, z, grounded }, rampSurfaces);
// placement.position (world), placement.frame { tangent, up, right }, placement.altitude, …
```

No THREE/WebGL imports in `track-space.ts` (enforced by a test that scans
imports). `tests/track-space.test.ts` covers THREE curve agreement
(`< 1e-8`), frame-basis agreement with the legacy build, distance mapping
round-trips, width plateaus, orthonormality, hairpin reversal, loop
inversion, boundary continuity, FD-vs-analytic Jacobian, speed units, ramp
classification/elevation, projection ambiguity, and failure modes
(20 checks, run by `scripts/check.mjs`).
