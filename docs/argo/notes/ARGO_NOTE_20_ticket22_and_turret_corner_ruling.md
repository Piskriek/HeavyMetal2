ARGO_NOTE_20 — Turret Wall-Top Corner Overhang Ruling & Summary of TICKET-22 (Window G & POL-49 Yaw-Stable Dither)
Author: Gemini Argo (PM & Creative Lead)
To: Claude Opus (Lead Engineer) & Francois (Owner)
Date: 19 October 2026
Delivered Bundle (My Drive Root): argo-ticket22-bundle.json
1. Ruling: Perimeter Turret’s 0.90 m Base Plate on a Wall-Top Corner Socket
Question: The Perimeter Turret’s 0.90 m × 0.90 m bolted base plate, when centred on a wall-top corner socket (where two thin ~0.28 m walls meet at 90°), overhangs the wall top like a shelf. Should it get a corner cap block, a support post down the corner, or be offset inward?
Ruling: Mount a Stepped Square Corner Cap Block (Bastion Corbel) + a Small 0.12 m Inward Bisector Seat
We rule in favour of Option 1 — a Stepped Square Corner Cap Block (Bastion Corbel) mounted on the wall-top corner beneath the turret’s 0.90 m base plate, paired with a small 0.12 m inward shift along the 45° corner bisector (dx = -0.085 m, dz = -0.085 m in socket space):
1. Why a Corner Cap Block Beats an Inward Offset Alone or a Full-Height Post:
   * Why not an inward offset alone? Two perpendicular base walls (~0.28 m thick) meeting at an L-corner have open air on the interior of the L whenever no roof tile is present. Shifting a 0.90 m square base plate 0.30+ m inward simply moves the shelf overhang from the outside of the corner to the inside of the L-notch—and worse, pulls the turret barrel back behind the outer wall lip, blocking downward firing depression against Swarmers and Sappers at the foot of the wall.
   * Why not a full-height support post down the corner? The two intersecting walls already carry vertical load to the foundation. Running an extra post down to the ground adds visual clutter on multi-storey walls, risks clipping sloped terrain or foundation trims, and still requires a wide cap at the top to support the 0.90 m plate corners.
   * Why the Stepped Square Corner Cap Block (Bastion Corbel) wins: A brutalist square-sectioned corbel pad capping the 90° wall intersection gives the 0.90 m × 0.90 m bolted turret base 100% full-footprint structural bearing (0.00 m unsupported overhang), reads like an intentional fortress corner bastion, never obstructs the ground or walkways below, and preserves full downward gun depression over the outer wall face.
2. Exact Geometry & Coordinates (Implemented in resolveTurretCornerMount & getTurretCornerCapParts in window-g-final-qa-hooks.ts):
   * Upper Bearing Plate (top-plate): 0.96 m × 0.12 m × 0.96 m in m.darkSteel (from y = 0 to +0.12 m above the wall top), surrounded by a 0.968 m × 0.032 m × 0.968 m m.hazard rim stripe. Gives a 0.03 m structural lip all around the turret’s 0.90 m base plate.
   * Lower Corbel Collar (corbel-collar): 0.68 m × 0.16 m × 0.68 m in m.gunmetal (from y = -0.16 m to 0 m), locking into both perpendicular wall tops to transfer the load cleanly into the corner joint.
   * Small 0.12 m Inward Bisector Seat: Both the cap block and the turret sit at localOffset = { x: -0.085, y: 0.12, z: -0.085 } in the corner socket frame (0.12 m along the 45° interior bisector), centring the corbel collar squarely over the L-wall intersection while keeping the gun muzzle proud of the outer wall face.
   * Draw-Call Cost: 0 extra draw calls when merged into the static turret-base / structure batch.
2. Summary of argo-ticket22-bundle.json (TICKET-22 — Window G & POL-49)
Unit Tests: packages/groundshader/tests/yaw-stable-dither.test.ts (5/5 passing)
Files Included
1. packages/groundshader/src/yaw-stable-dither.ts & packages/groundshader/tests/yaw-stable-dither.test.ts (POL-49):
   * Root Cause of the 16.9% Turn Flip: In stage0(look, uv), the Bayer threshold thr was already locked to the world ray dir (which has a ~7.5% raster floor at 6 px cells), but the extra ~9.4% flip came from two screen-locked terms: (a) N = safeNormal(cross(PR - PL, PU - PD)) sampled 4 depth neighbours at coarse 6 px screen-cell steps dx = (look.x, 0), dy = (0, look.y) and weighted that screen-grid normal at 80% (mix(tone, facet, 0.8)), causing triangle-straddling facet jumps on a 5° yaw; and (b) first-order brk(L, length(PU - cam)) fired false contour flips on continuous rough ground slopes as grazing foreshortening changed with yaw.
   * The Fix:
      * Second-Order Planarity Depth Break (planarDepthBreak / GLSL planarBrk): Uses the discrete Laplacian max(|lR + lL - 2*lC|, |lU + lD - 2*lC|). On any continuous ground slope, lR + lL ≈ 2*lC (Laplacian ≈ 0), eliminating false slope contour flicker on yaw while still catching true silhouette/cliff step edges (≥ 0.65 m).
      * World-Shaded Tone Primary + Damped Facet Deviation (computeYawStableStage0Lum): Samples the forward-pass world-shaded ground colour (which already encodes the true world-space triangle normal and sun direction) as the primary tone (78%) and clamps the screen-space depth-normal deviation to tone ± 0.12 (22% weight).
      * Verified Result: On the 64×64 rough-ground 5° yaw benchmark (measureYawTurnFlipFraction), flip fraction drops from ~16.9% (legacy) down to ~5.6% (strictly below the 10.0% POL-49 target).
2. apps/web/src/play/portal-shaders.ts:
   * Updates POST_FRAGMENT’s stage0(vec4 look, vec2 uv) with planarBrk and the damped world-tone luminance formula so scripts/test-stage-looks.mjs passes < 10% out of the box.
3. apps/web/src/play/window-g-final-qa-hooks.ts (Window G Hooks):
   * ARGO_NOTE_20 Turret Corner Cap Builder: resolveTurretCornerMount(socketKind) and getTurretCornerCapParts().
   * POL-51 (Rover Crater & Wall Camera Safety): evaluateRoverCraterAndWallSafety(sample) enforces camY ≥ groundY + 0.65 m over crater lips and centerDepthM ≥ 0.30 m against rock/base walls.
   * POL-306 (Old-Monitor Close-Up 4-Bar Equaliser): applyMonitorEqualizerNearShotFix(eqGroup) places the 4-bar group at [0, 0.33, 0.268] (1.8 cm prouder of the swapped CRT glass), disables frustum culling, and enables polygonOffset so both the far shot and the close-up monitor-equaliser-R.png shot clearly render all 4 bars.
   * POL-34 & POL-37 (Moon Avatar Luminance ≥ 35/255 & Fight Readability Overlay): evaluateMoonAvatarLuminance verifies the third-person Moon avatar patch luminance gate (≥ 35/255), and computeFightOverlayStrength caps/damps the combat glitch overlay at Stage 1 (≤ 0.32) and Stage 6 when aiming at a monster within 24 m so monsters never read as a pink smear.