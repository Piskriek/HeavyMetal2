# Hoop-Pod — the goblin racing ball, instanced (v2)

Status: **ready for integration review.** Replaces the legacy racer sphere + two brass caps with the
Hoop-Pod, renders a very low-poly pod at a distance, and puts the pod in the Ball Garage so every
garage tool paints it. Touches three existing files through anchored edits; everything else is new.

## What the player sees

Six parallel iron hoops roll with the ball. Between hoops 3 and 4 a **0.64 m sight slot** shows a
level inner ball with one **brass-rimmed porthole (0.6 m glass, clean)** facing the direction of
travel. Two domed hubcaps stay level. Nothing protrudes from the sphere silhouette.

| Part | Pose | Source |
| :--- | :--- | :--- |
| Hoops 1–6 (crowns + walls) | `gyro ∘ rotX(−rollPhase)` (+ differential while changing lanes) | `racer.rollPhase`, `racer.vz` |
| Inner ball, porthole, hubcaps | `gyro` (level) + pendulum pitch/lean | `racer.rollRate` delta, `racer.vz` |

## LOD — the pod at a distance

Chosen per racer **in screen space** every frame (`selectPodLodBand`), from the camera FOV and the
canvas height, so a narrow cockpit FOV and a wide chase FOV both get the right detail:

| Band | Mesh | Triangles | When (projected radius) |
| :--- | :--- | ---: | :--- |
| 0 | standard | ≈1,930 | ≥ 56 px |
| 1 | lite | ≈1,060 | ≥ 16 px |
| 2 | **far** | **≈170** | below 16 px — six flat crowns (8 segments), 8×4 inner ball, 6-sided caps; no walls or inner faces |
| — | hero | ≈3,020 | garage and previews only |

- **Hysteresis 1.18×**: a pod must cross a threshold by 18% before it changes band — no popping.
- **Culling**: pods outside the frustum (sphere test, 1.6 R) or beyond 52,000 units (the fog is
  opaque by 48,000) are not drawn at all; their shadow and shield are skipped too.
- **Dense packing**: each band's InstancedMesh only receives the pods in that band (count = band
  size), so the 2k-tri vertex shader never runs for distant racers. v1 wrote zero-scale matrices,
  which still paid vertex cost for every hidden instance — fixed.
- The bake array textures are mipmapped, so distant pods sample small mips (no shimmer).
- Every LOD keeps the same silhouette (ride height within 2%, tested) and is scaled by
  `RADIUS / rideHeight`, so contact hoops touch the road exactly where the collision sphere does.

Worst case, 100 racers all in band 0: ≈193k triangles. Typical grid-start chase view (≈8 near,
≈20 mid, the rest far or culled): ≈50k.

## Ball Garage

The garage (`BallCustomizer.tsx`) edits a `CustomBallConfig` and bakes it with `bakeBall` into an
equirect texture (u wraps the rolling circumference, v = 1 at the +X axle, CAP_THETA under each cap).
Only the showroom draws it, so the pod needed no change to any garage tool:

- `BallShowroom.tsx`'s default export now re-exports **`PodShowroom`** — same props, same DOM
  (`.garage-ball-3d`, `.garage-cradle`, fallback), same camera and lights. The sphere view stays
  exported as `SphereShowroom`.
- The hoop crowns sample the bake through `aBakeUv`. The paintable latitude `|lat| ≤ π/2 − CAP_THETA`
  is **tiled across the three crowns of each side** in angular proportion (4.7% stretch), so the
  slot and the hoop gaps hide nothing that was painted: pin-lines, bands and emblems all show.
- A still click on a hoop undoes the hoop roll and returns the exact bake `(u, v)` under the pointer
  (`bakeUvForPoint`), so decals land where you click. Caps and porthole clicks go to `onCap`
  (optional `onPorthole`).
- Metals, pin-line colour, cap finish, decal size/turn/strength/tint, undo/redo, the 12-decal cap,
  ownership and saving are unchanged — they only ever touched the design and the bake.
- The painted rivets, seams and edge AO of the pod atlas stay over the bake; rivets take the cap
  finish; hubcaps take the cap finish; emissive metals (Scorched Obsidian) glow on the crowns.

**In races** the player's pod wears their garage design: the design equipped under
`hm2-equipped-ball-v1` (`equipDesign(bakeKey)`), otherwise the most recently saved design, otherwise
the loadout livery. It is baked at 512×256 off the frame (`setTimeout`), re-baked once the painted
decal PNGs decode, and re-checked at each `setRacerCount` and on `storage` / `hm2:ball-design`
events. CPU racers keep their loadout liveries (capsule finish, team colour, rider emblem).

Precedence for `PLAYER_ID`: garage design → Paint Shop livery → loadout livery.

## Files

| File | Kind | Purpose |
| :--- | :--- | :--- |
| `src/game/pod/pod-geometry.ts` | three | Shapes, 4 LODs, screen-space LOD selection, garage bake mapping |
| `src/game/pod/pod-fleet.ts` | three | `HoopPodFleet`: banded, culled, packed instancing; bake array; player design |
| `src/game/pod/pod-material.ts` | three | Tint-mask + garage-bake shader (fog/ACES preserved) |
| `src/game/pod/pod-design.ts` | DOM-light | Which design races, `bakeDesign`, derived livery, `equipDesign` |
| `src/game/pod/pod-atlas.ts` | DOM | Shared detail atlas, livery mask, emblem sheet |
| `src/game/pod/pod-livery.ts` | pure | Loadout liveries, validation (`E_POD_LIVERY`), optional storage |
| `src/components/garage/PodShowroom.tsx` | UI | Garage showroom on the race pod |
| `src/components/PodPaintShop.tsx` + `src/pod-paint-shop.css` | UI | Optional tint-livery editor |
| `tests/hoop-pod.test.ts`, `tests/hoop-pod-lod.test.ts` | test | Livery contract; LOD budgets, hysteresis, bake mapping |
| `scripts/install-hoop-pod.mjs` | tool | All-or-nothing anchored edits; upgrades a v1 install |
| `patches/0001-hoop-pod-renderer.patch` | diff | The same edits for `git apply` |

## Integration

`node scripts/install-hoop-pod.mjs` (or `git apply -C3 patches/0001-hoop-pod-renderer.patch`):

- **renderer-3d.ts** — import; `pods` field; construct before `ensureRacerMeshes(4)`; `setCount` with
  the pool; legacy meshes hidden (the group stays the placement/first-person visibility carrier);
  the shield block becomes `pods.setRacer(...)`; `pods.commit(camera, dt, reducedMotion,
  canvasHeight)` **after** the camera is placed; `pods.dispose()` in `destroy()`.
- **BallShowroom.tsx** — default export → `PodShowroom`.
- **check.mjs** — both test files registered.

The renderer still writes nothing to the simulation (CONTRACTS rule 4).

## Performance

| | Legacy (per racer) | Hoop-Pod (whole field) |
| :--- | :--- | :--- |
| Draws at 100 racers | up to 500 | ≤ 5 (3 bands + shadows + shields) |
| Distant racer | 24×16 sphere + 2 caps ≈ 1,100 tris | ≈ 170 tris, or culled |
| Materials | 1 per racer + shared | 1 program for all bands |
| Textures | ≤48 baked canvases | 3 × 1024² shared + 4-layer 512×256 bake array |
| Livery change | canvas bake | 19 floats |
| Per-frame allocation | — | none |

## Acceptance evidence

| Criterion | Evidence |
| :--- | :--- |
| Very low poly at a distance | `far` ≈170 tris, screen-space bands, tested budget ≤ 300 |
| No LOD flicker | hysteresis test oscillating ±5% around a threshold |
| Garage tools work on the pod | same showroom props; click → exact bake texel (tested round trip) |
| Nothing painted is hidden | latitude tiling continuous across crowns, reaching the cap edge (tested) |
| Silhouette constant across LODs | ride height within 2% (tested) |
| Renderer writes nothing | fleet API is copy-in only |

## Verification boundaries

Written against `main` as read on GitHub; not yet compiled inside the repo or playtested. Run
`npm run check`, `npm run build`, `npm run check:art` and a 100-racer quick race. Tune by eye:
`POD_LOD_PIXELS` (56/16), the pendulum gains (0.0035, 0.0006). `check:art` may need its racer-sprite
expectations updated, since racers no longer draw the baked `raceBalls` canvases (retiring them
is a follow-up). The garage's texture-space editors, if any, keep using the unchanged bake.
