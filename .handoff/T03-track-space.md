# T03 (issue #36) handoff — 2026-09-22

Branch: `arena/01a0ca15-heavymetal2`. Base: `f9ca189` (main). Baseline `npm run check`: 58/58 green.

## What landed (all committed locally, `git log` order)

1. `5c6414c` — `src/game/track-space.ts`: headless immutable track-space adapter (no THREE/WebGL; compiled once per process via `getTrackSpace()`).
   - Waypoint table + loop insertion replicated from the legacy renderer; Catmull-Rom spline + arc-length reparameterization ported verbatim from THREE (getPoint/getTangent FD Δt=1e-4, getPointAt(u) via uToTmapping, distAtWaypoint lerp indexing) so headless physics agrees with rendering by construction.
   - Arc-length table (6001 knots), frame marching (transport-up Gram–Schmidt with gravity lerp `0.12·clamp(up.y,0,1)`, banking lerp 0.15 clamp ±0.35 gain 7, loop windows `[start−60, end+60]`) — **verified bit-faithful to the legacy renderer frame basis: position exact, up/right ≤ 8.5e-16, turnRate ≤ 8.7e-19** (test 3 of the suite replicates the legacy `buildTrack` pipeline with THREE vector ops and compares against the adapter).
   - Continuous frames (`frameAt` = nlerp + re-orthonormalize; right = normalize(cross(tangent, up)) left-handed convention preserved), continuous `halfWidthAt` (width plateaus per section, bridge pinches).
   - Distance mapping: engine x ⇒ distance (`engineDistanceFromX`), distance ⇒ track arc (`trackDistFromEngineDistance`), arc ⇒ engine distance (inverse, round-trip tested). Piecewise-affine & continuous ⇒ no velocity jump at section boundaries.
   - Placement model: `placementFromEngine(space, {x, distance, y, z, grounded}, rampSurfaces)` → world position `pos + right·(z/480)(halfWidth−1.2·RADIUS) + up·(RADIUS + altitude)`; `worldFromEngine` throws `TrackSpaceError` for non-finite/out-of-envelope transforms; `engineFromWorld` projects world points back and flags `ambiguous` when two ribbon sheets (loop crossover decks) are within the discrimination window.
   - Ramps: `classifyPlacedRamp` + `compileRampSurfaces` (immutable `PhysicalRampSurface[]`, incline model `h = 260·(δ/1100)^1.4` rising to crest). Rejection codes: `non-finite | invalid-scale | projection-failed | ambiguous-backing | insufficient-width | unsupported-region-loop`. The legacy renderer-only scripted 750-unit past-crest arc was **removed** (ballistics owned by physics).
   - Map facts: total length **159094.46** world units, 3182 samples at `SAMPLE_SPACING=50`; stages: alpine 0→38366.5, canyon →44539.6, zigzag →88718.8, cavern →97384.4, mine →146326.8, breakthrough →153092.3, stadium →159094.5; loops at 18821–27674 (alpine), 105958–116059 and 129402–138877 (mine); `TRACK_DISTANCE=36000` engine-distance maps onto `[1100, D_END]`.
2. `db0e007` — `tests/track-space.test.ts` (20 checks) wired into `scripts/check.mjs`.
3. `ed6766b` — renderer refactor: `renderer-3d.ts` consumes the adapter (deleted duplicated waypoints/spline/frame code; `TrackData.curve` removed; racer placement via `placementFromEngine`; `trackDistFromDistance` delegates; ramp elevation from `compileRampSurfaces` with per-prop `[track-space] placed ramp is not physical:` console.warn for rejected props; `get3DRampElevation` deleted), builder gates (`track-builder-3d.ts` `placementErrorState`/`getPlacementError`/`clearPlacementError` + rejection paths), UI toast (`TrackBuilderUI.tsx`).
4. `97895ab` — `docs/TRACK_SPACE.md` (spaces/units — engine x = 190 + 2·distance, vx in x-units/s, exit-speed preservation across mappings; physical altitude vs visual bobbing/shake/spin separation), plus `tests/track-builder-validation.test.ts` (3 checks) wired into `scripts/check.mjs`.

## Verified (exact evidence)

- `npm run check` (tsc --noEmit + tsx node:test): **81/81 pass** (58 baseline + 20 track-space + 3 builder-validation), exit 0, ~2.3 s (`/tmp/check5.log`).
- `npm run build`: exit 0.
- Browser suite `tests/browser-recovery.mjs`: **fails identically on the base commit and this branch** in this sandbox — race stage renders, assets reach 100%, WebGL available with `--enable-unsafe-swiftshader`, but stage class is stuck at `status-loading` with zero pageerrors (unbuilt WebGL at default flags makes it fail earlier). Pre-existing environment limitation, unrelated to T03; the renderer could not be smoke-tested in-browser here. tsc confirmed clean throughout the refactor.

## Remaining / blockers

- **GitHub auth expired mid-session**: `GH_TOKEN`/`GITHUB_TOKEN` in env now return "Bad credentials"; pushes fail (`could not read Username … terminal prompts disabled`). 4 local commits on `arena/01a0ca15-heavymetal2` are ready to push; then open the draft PR against issue #36 (use `gh api repos/Piskriek/HeavyMetal2/issues/36` — `gh issue view` errors with a "Projects (classic)" GraphQL failure). **Reconnect GitHub in Arena to unblock.**
- Draft PR body is drafted in `.handoff/T03-pr-body.md`.
- Non-goals documented in `docs/TRACK_SPACE.md`: grounded-state engine-elevation ≡ RADIUS quirk preserved (zero visual drift); `track-geometry-3d.ts` legacy module intentionally not unified (dead except shared types); ramp past-crest ballistics are physics-owned.

## Verification recipe to re-run

```
npm install        # node_modules present
npm run check      # expect 81/81, exit 0
npm run build      # expect exit 0
git push origin arena/01a0ca15-heavymetal2 && gh pr create --draft --title "T03: shared headless track-space adapter" --body-file .handoff/T03-pr-body.md
```
