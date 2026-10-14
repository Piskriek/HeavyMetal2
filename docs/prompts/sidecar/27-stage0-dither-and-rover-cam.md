# TASK-27: the stage-0 dither glued to the world, the gate's amber pool, the rover camera, the modular scout (Wave B)

After `main` (Wave A). The sources:
- Argo's `14-lighting.md` (P0-LIGHT-02);
- `19-vehicles-weapons.md` (P0-VEH-01, P0-VEH-03);
- the master plan's DEC-06 (the gate's amber pool);
- his reply `ARGO_MASTER_PLAN_REPLY.md` §3, brief 27. It wins where it differs: **stages stay 0 to 6 with five looks** (0 one-bit, 1 EGA, 2 VGA, 3 Gouraud, 4 to 6 full PBR, told apart by the water, coverage and forest blooms). Never renumber.

The research: Lucas Pope's Obra Dinn devlog on stable 1-bit dither (`https://dukope.com/devlogs/obra-dinn/tig-32/`), and spring-arm cameras with sphere casts, in the plans' §3.

## Where it lives
- **The stage looks** are one post pass, `POST_FRAGMENT` in `apps/web/src/play/portal-shaders.ts`. Stage 0 is `lookAt()` with `look.w > 0.5`: a 4×4 Bayer threshold indexed by the **screen** cell (`floor(uv / look.xy)`), so the pattern swims when you turn. The pass already has the depth (`uDepth`), `uInvProj` and `uCamWorld` (`worldAt()`).
- **The uniforms** are set in `apps/web/src/play/play-scene.ts` (`setLook`, about line 1205).
- **The driving camera:** `play-scene.ts` about lines 1875 to 1905 (`roverPos`, `lookAt`).
- **The modular scout:** `USE_MODULAR_SCOUT` in `apps/web/src/assets/gen-props.ts` (off; `?scout=modular` tests it).

## Build
1. **The dither glued to the world (P0-LIGHT-02, stage 0 only).**
   - Keep sampling the colour at the screen cell (the picture stays pixelated on screen). Index the Bayer threshold by the **view direction** instead, Obra Dinn's way:
     - take the ray through the pixel: from `uInvProj` and `uCamWorld`, without depth;
     - its spherical angles are `atan(d.x, d.z)` and `asin(d.y)`;
     - divide by the angular size of one look pixel (the field of view over the look's resolution).
   - The pattern then holds still on the hills while you turn. A translation still moves it slightly, which is fine.
   - Check the poles and the ±π seam for a visible line, and handle them.
   - Add the two depth cues:
     - a gentle distance gradient in the one-bit threshold;
     - a one-pixel contour at depth breaks (neighbouring look cells whose linear depth differs by more than a ratio), so crater rims at 50, 150 and 500 m separate into planes.
   - Stage 1 and above are unchanged.
2. **The gate's amber pool (DEC-06, stage 0):** within 15 m of the gate, the dither's light tone is warm amber #ffc13d instead of white, fading out by 15 m (use `worldAt()` and a new gate-position uniform). The rest of the Moon stays stark black and white (#050608 and #e8eef5).
3. **The rover camera (P0-VEH-01)** as a small pure module (`apps/web/src/play/rover-camera.ts`, unit-tested):
   - **The arm:** from a pivot 1.4 m above the chassis to the wanted spot 5.5 m behind and 2.1 m up, cast a 0.35 m sphere against the terrain heightfield, boulders and placed pieces. On a hit, pull in to the hit minus 0.35 m: snap in within 25 ms, ease back out over 250 ms.
   - **The floor clamp:** the camera never goes below the terrain height plus 0.65 m at its own x and z.
   - **The horizon:** roll stays 0; pitch follows with a 0.12 s lag, so small bumps do not shake it.
4. **The modular scout (P0-VEH-03).**
   - Raycast the aerial's socket onto the rear shell (flush, no gap).
   - Check the square yoke inside the empty cab.
   - Re-check the hauler's `VEHICLE_FIT` (wheel wells and travel) for its redone body.
   - Then set `USE_MODULAR_SCOUT = true` and show it from three sides. Opus reviews the shots at acceptance and will revert the switch if a part floats or clips.

## Tests
- **Unit:**
  - the spherical dither index (the same world direction gives the same threshold after a yaw of the camera);
  - the arm (a wall at 3 m pulls the camera to 2.65 m; the floor clamp holds on a crater lip; roll stays 0);
  - the pool's falloff.
- **A turn test** (extend `scripts/test-campaign.mjs` or a capture script): at stage 0, two frames 5° of yaw apart. Compare a 64×64 patch of the ground re-projected: under 5% of its pixels flip (today, most of them do).
- **Rover:** drive into a crater and against a rock wall; the camera never shows the inside of geometry. Check by sampling the depth buffer at the screen centre: never under 0.3 m.
- **Shots** (`?cleanShot=1`):
  - the stage-0 arrival with the amber pool (tour shot 07's moment);
  - two frames of a turn, side by side;
  - the rover at a wall and in a crater;
  - the modular scout from three sides.
  
  Look at every one.
- **The usual green set,** with the build size and fps at stage 0 on Low (the pass must stay within the frame budget on the GTX 950M).

## Report
On the board:
- the turn test's flip fraction, before and after;
- the camera cases;
- the scout shots;
- fps;
- the results.

Opus refreshes Argo's tour shots 07 and 12.

## Argo's sign-off (14 October, docs/argo/plans/23-brief-review.md)
Approved as written, plus:
- **The amber pool feathers:** blend it with `smoothstep(15.0, 3.5, distanceToGate)`, full within 3.5 m and gone by 15 m, so there is no hard ring edge.

## Addition: the suit-cam optics (Argo's plan 25, 14 October; the owner's idea)
The top of the fidelity ladder becomes a capture medium too: Astro's suit camera. Build `docs/argo/plans/25-camera-realism.md` §4 into the **same post pass** (`POST_FRAGMENT`), ramping in with `uSuitCamMix = smoothstep(0.45, 0.85, Lx)`, so it is fully on at stages 4 to 6:
- analytical lagging auto-exposure (no GPU readback): a CPU RC filter over the sun direction, the view pitch, and lab or gate, passed as one `uExposure`;
- a CMOS S-curve with an early warm white clip;
- 4-tap halation (wide bleed on Mid and High only);
- a 3×3 luma micro-sharpen;
- grain capped at 2.5% and weighted to the midtones;
- a cos⁴ vignette;
- a gentle barrel (k1 = -0.035) with corner-only chromatic aberration;
- all halved while the build ribbon is open, and off in the Studio unless its stage pill shows S4 or above.

**Never** motion blur, camera roll or loose aim: those are the comfort complaints the research found.
- The setting is **Suit-Cam Optics: Auto | Full | Subtle | Off** under Graphics (the toggle rule).
- Within 0.45 ms on the GTX 950M; report the cost.
- The research was checked by Opus: the Bodycam Steam page and its "Accessibility & Performance Tips" announcement are real; the motion-blur complaints are confirmed by third-party guides; the fisheye sickness by similar games' threads. The Reddit link could not be fetched.
- **Tests:**
  - the exposure filter (a step into daylight overshoots, then settles in about 0.4 s);
  - Off is byte-identical to today's look;
  - a stage-5 shot with Off and with Auto, side by side.

## Addition: the stage-look bible (Argo's plan 27, 14 October; the owner's wireframe and facets idea)
`docs/argo/plans/27-stage-look-bible.md` is now the canonical ladder:
- **0a, wireframe on arrival:** until the first machine runs (`uWireframeMix`);
- **0b, 1-bit dither over flat facets:** from the first machine, swept in by the scan wave;
- **1:** EGA;
- **2:** VGA;
- **3:** Gouraud;
- **4 to 6:** PBR through the suit camera (the addition above).

The progression stays 0 to 6, so nothing renumbers. Build its §4 into this task's post pass:
- **One pass for every object (Opus's recommendation).** Rebuild the normal per pixel from the depth buffer (`worldAt()` and screen-space derivatives). On a triangle mesh it is constant per triangle, so it gives the flat facets for the terrain and every prop at once, with no per-material shader work. The same normal and depth breaks give the hidden-line edges for 0a; the 2 m terrain grid comes from `worldAt()`.
- **0a:** black fill, 1 px light edges, and the converging world grid fading by 180 m. The gate's amber pool, plumes, the build ghost and the HUD stay in colour (the 0.5 alpha mark).
- **0a to 0b:** the first machine's tick sends the scan wave (350 m over 3.5 s). Inside the ring the world resolves into 0b; outside it stays wireframe until the wave passes. Test it, and take a shot mid-wave.
- **0b and 1:** the flat-facet lighting feeds the world-locked dither (0b) and the EGA ramp (1); it blends to smooth normals as Vtx rises (the bible's mix).
- **Tests:**
  - 0a shows edges and the grid, with no filled shading;
  - the first machine flips 0a to 0b through the wave;
  - the facets read in a shot at 50, 150 and 500 m;
  - the monsters' quantisation and the window walkers still follow their stage.

## Split (14 October)
This brief is now the **stage looks** (the dither, the pool, the suit cam, the wireframe and facets). Its rover-camera and modular-scout items (Build 3 and 4) run separately as **TASK-27b** (`27b-rover-cam-and-scout.md`), after this one.
