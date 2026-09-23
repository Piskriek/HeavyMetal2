# T03 — Shared track-space & collision-coordinate adapter

Closes #36 (T03, P0, depends T01). Owner: geometry/physics.

## Summary

Introduces `src/game/track-space.ts`, a **headless, immutable track-space adapter** that is now the single source of truth for the mapping shared by the renderer and physics, and rewires the renderer + 3D track builder onto it.

- **Spline & sampling**: centerline waypoints + loop insertion unified; Catmull-Rom evaluation, tangent FD (Δt=1e-4), and arc-length reparameterization ported verbatim from THREE so headless physics and rendering agree by construction (curve point agreement < 1e-8).
- **Frames**: arc-length sampled every 50 units with exact knots; continuous `frameAt(s)` (nlerp + re-orthonormalized) preserving the renderer's `right = normalize(cross(tangent,up))` convention. Frame basis matches the legacy renderer build **bit-for-bit** (position exact; up/right ≤ 8.5e-16; turnRate ≤ 8.7e-19) — verified by a test that replicates the legacy `buildTrack` pipeline with THREE vector ops — so the renderer swap produces zero visual drift.
- **Distance/velocity mapping**: `engine x = 190 + 2·distance`; `distance ↔ track arc` reparameterization is piecewise-affine and continuous across section boundaries, so **exit speed is preserved** (no velocity jump at seams). `ARC_PER_ENGINE_DISTANCE = (D_END − 1100)/TRACK_DISTANCE`; tests verify `|v_world| ≈ (vx/2)·ARC_PER_ENGINE_DISTANCE` on flat straights to 2% and FD-vs-analytic-Jacobian agreement (DT=1e-4) to < 1e-3 across width variation, slopes, curves, loops, and section boundaries.
- **Placement model**: physical canonical state vs visual effects separated — `placementFromEngine` composes lateral/altitude exactly as the renderer draws; bobbing/shake/spin stay visual-only. Grounded-state quirk (engine elevation ≡ RADIUS when grounded) is documented and preserved.
- **Ramps — required decision implemented**: renderer-only ramp elevation is gone. Placed ramps compile to immutable `PhysicalRampSurface`s shared by renderer and physics; props that can't compile are **rejected visibly**: builder blocks placement/move/resize with a UI toast, and previously stored props emit `[track-space] placed ramp is not physical:` console warnings instead of silently elevating. The scripted 750-unit post-crest renderer arc is deleted (ballistics belong to physics). Rejection codes: `non-finite`, `invalid-scale`, `projection-failed`, `ambiguous-backing`, `insufficient-width`, `unsupported-region-loop`.
- **Singular/ambiguous transforms fail visibly**: `worldFromEngine` throws `TrackSpaceError`; `engineFromWorld` flags `ambiguous` for unresolved sheet projections (loop crossover decks — dynamically discovered in tests).
- **Docs**: `docs/TRACK_SPACE.md` — spaces/units table, speed units & exit-speed preservation, physical-vs-visual separation, ramp support policy, failure modes, headless usage.

No THREE/WebGL/DOM imports in the adapter (enforced by test). Legacy `renderer-3d.ts` centerline/spline/frame machinery and the unused `TrackData.curve` are deleted. `track-geometry-3d.ts` is intentionally not unified (dead outside type imports) — documented.

## Verified

- `npm run check`: **81/81 pass** (58 baseline + 20 track-space + 3 builder-validation), exit 0.
- `npm run build`: exit 0.
- Browser recovery suite fails identically on `main` in this sandbox (headless GL limitation: race stage never leaves `status-loading` despite WebGL available and assets at 100%, no page errors — base commit `f9ca189` behaves the same). Not caused by this change; noted honestly per repo conventions (build success ≠ gameplay proof).

## Acceptance criteria coverage

1. Renderer & physics agree on representative positions — shared adapter + bit-faithful frame test. ✅
2. FD velocity/Jacobian checks — DT=1e-4, rel err < 1e-3 across track features. ✅
3. Varying width, slopes, curves, loops, section boundaries — covered in `tests/track-space.test.ts`. ✅
4. Singular/ambiguous transforms fail visibly — `TrackSpaceError`, `ambiguous` flag, builder toast, console warnings. ✅
5. Prop transform support documented — `docs/TRACK_SPACE.md` + rejection codes. ✅
