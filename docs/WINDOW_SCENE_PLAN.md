# The view from the lab window: a planned 3D scene

**The owner, 2026-10-12:** "right now is snos static with no depth so it looks liek a tv screen, it needs to be a planned 3d scene that looks cool, use the props and stuff we have to make it look like all the fidelity layers are interacting, props flying around dust and wind, lighting with static explosions. choose any logical setting, turn it into a waste land and have time space pockets where the fidelity is diffrent float about ... do research. cloth and many small parts in a heap is also a 'no no' for the 3d agent".

**Today:** `lab-room.ts` draws one 50 × 24 m shader plane, 8 m behind the north wall, with dithered static (`STORM_FRAGMENT`, driven by `setStorm`). It has no parallax, so it reads as a TV screen.

## 1. Research (sources)
- **The Source engine's 3D skybox** (Half-Life 2, Left 4 Dead) keeps a distant scene cheap and deep:
  - a separate miniature scene is rendered first, from a camera that copies the player's view, and the level is drawn over it;
  - it is real geometry, so it parallaxes as the player moves, and it stays non-interactive;
  - HL2's Citadel is the classic case: it grows as you approach because it lives in the 3D skybox.
  - Sources: [Valve Developer Wiki: 3D Skybox](https://developer.valvesoftware.com/wiki/3D_Skybox), [Wikipedia: Skybox](https://en.wikipedia.org/wiki/Skybox_(video_games)), [TWHL tutorial](https://twhl.info/wiki/page/Tutorial%3A_3D_Skyboxes).
  - The lesson for us: a separate vista scene and camera, a far plane in kilometres, and the lab drawn on top after a depth clear.
- **STALKER 2's storms and blowouts** are what players stop to watch:
  - a review praised radioactive storms that turn the sky red or toxic green and keep the world threatening;
  - a player wrote that a blowout "forced me to stop and take a break while I watched".
  - Sources: [Kyiv Post review](https://kyivpost.com/post/42682), [Steam thread](https://steamcommunity.com/app/1643320/discussions/0/4626980894528265510).
  - One complaint: outdoor light so harsh it looked like a nuclear blast ([Steam](https://steamcommunity.com/app/1643320/discussions/0/6765052826998353641)). So our flashes are short, and the lab never whites out.
- **Two looks in one frame:**
  - Insomniac's rift tech talk, [GDC: Shifts and Rifts](https://gdcvault.com/play/1027872/Shifts-and-Rifts-Dimensional-Tech);
  - a patent on rendering one object in two styles and blending per region ([US7995060B2](https://patents.google.com/patent/US7995060)).
  - Our version: every vista material reads the pockets and picks its own fidelity per pixel and per vertex. No post pass, so it costs little.
- **The owner's model rules apply to everything outside too:**
  - square, solid, no cloth, no heaps;
  - the flying debris and the pockets are the only things that float, because the owner asked for them.

## 2. The setting: the Bridge Array
The lab was built at the edge of the compute farm that fed **the Bridge**: rows of windowless datacentre halls, chillers, a pylon line and a highway overpass for the trucks that brought the racks. When the limit was breached, the farm's main hall became the epicentre.
- **The wasteland:** grey dust over cracked concrete.
- **The Breach:** a square column of raw static, rising from the split main hall into the clouds.
- **Around it:** a slow vortex of the farm's own junk (containers, racks, crates).
- **The pockets:** bubbles of space-time drift over the plain where the world renders at another fidelity. Each pocket is a point in S-space, the game's own four floats.

This is the canon of `CLAUDE.md` §2 made visible: the lab, quantum-shielded, looks out at what its experiment did.

## 3. Composition through the window
The window is 14.8 × 3.1 m (a 4.8:1 letterbox), and the gate stands centred in front of it. So the hero is off-centre.

```
 far  ridge silhouette ─────────────────────────────────────────── sky dome, storm clouds lit from below
      ┌───────────┐  ▓▓ BREACH column (1/3 from left)   halls, far rows     ┌ debris vortex orbits the breach ┐
 mid  overpass spans, snapped ═══ ═══   ═══          ▯▯▯▯ datacentre halls + chillers      pylon ┼ ┼ ┼ line
 near   rubble slab ◣    tilted container ▭          dust curtain           ▭▭ container stack     pylon ┼ (60 m)
 apron  concrete slab, square bollards ▪ ▪ ▪ ▪          dust motes streaming left → right past the glass
```
- **The hero:** the Breach, about 1.2 km out, a third of the way in from the left, so the gate never covers it.
- **Leading lines:**
  - the pylon line runs from near-right (60 m) diagonally to the Breach;
  - the broken overpass marches from mid-left toward it.
- **Depth cues, all of them:** parallax (real geometry), exp2 fog in the horizon colour (aerial perspective), size falloff, dust curtains at three depths, and silhouettes rim-lit by the Breach.

## 4. The layers (vista space: origin at the window's outer face, −z away from the lab, metres)
| Layer | Distance | Contents |
|---|---|---|
| L0 apron | 3–25 m | A concrete slab; 6 square bollards and 4 square fence posts (procedural boxes); one `shipping-container` lying tilted; 2 `rubble-slab`; one `chiller-block` knocked onto its side. Densest dust motes. |
| L1 near field | 30–120 m | Cracked ground (procedural low-poly, seeded); a 2-high `shipping-container` stack; 3 `rubble-slab`; the first `pylon-tower` at 60 m to the right; dust curtain 1 at 45 m. |
| L2 the farm | 150–500 m | 6–8 `datacentre-hall` in two rows with `chiller-block`s; 3–4 `overpass-segment`s in a line with gaps, left; the pylon line continues; dust curtain 2 at 200 m. |
| L3 the Breach | 600–2000 m | The main hall (`datacentre-hall` × 3 scale, split); the Breach column (procedural, square, glitch-sliced, slowly turning, about 600 m tall, into the clouds); the debris vortex; far hall silhouettes; a ridge silhouette mesh; dust curtain 3 at 700 m. |
| Sky | 4 km dome | Layered fbm clouds moving with the wind, lit from below by the Breach and the flashes. Below full fidelity it is dithered (reuse `STORM_FRAGMENT`'s noise). |

The hero pieces are placed by hand from a fixed layout table. A seeded PRNG (mulberry32) scatters only the rubble, the dust and the schedules, so the view is planned and the same every time.

## 5. Fidelity pockets (the interaction the owner asked for)
**A pocket** is `{ centre, radius, S: [Pxd, Vtx, Lx, Aq] }`. There are up to 6, in a uniform array.
- **Every vista material** (gen models, ground, procedural boxes) gets an `onBeforeCompile` injection. It finds the strongest pocket around each world position, with a soft 15% edge, and blends to that pocket's S from the outside world's base S.
- **What each float does:**
  - **Pxd (pixels):** 0 is a 1-bit Bayer dither on luminance, 0.25 the 16-colour EGA palette (nearest), 0.5 the 256-colour 3-3-2 quantise, 1 full colour.
  - **Vtx (vertices):** the vertex shader snaps world positions to a grid of `mix(1.5 m, 0, Vtx)`, so low pockets crunch the geometry (PS1 wobble).
  - **Lx (light):** 0 is unlit flat colour, 0.5 flat Lambert (derivative normals), 1 full PBR.
  - **Aq (aquatic):** a blue-green tint, moving caustics and a slow vertical sway: a drowned pocket.
- **The base S outside** is about (0.15, 0.3, 0.3, 0), the storm world. **Starting pockets:**
  1. **"Old Earth":** S = (1, 1, 1, 0). Inside, the ground tints to grass green and the shell's back faces paint a blue-sky gradient.
  2. **1-bit:** (0, 0.2, 0, 0), stark black and white.
  3. **EGA:** (0.25, 0.4, 0.5, 0), magenta and cyan.
  4. **Drowned:** (0.7, 0.8, 0.8, 1).
  5. **Wire-crunch:** (0.5, 0, 0.6, 0), very coarse vertex snapping.
- **The shell:** a sphere with a fresnel rim of scanline static. The back faces carry the pocket's sky colour, so the pocket reads as a window into another time.
- **Motion:** each pocket drifts on a seeded Lissajous path at 1–3 m/s and breathes its radius ±10%. Every 20–40 s one collapses in a static burst (§6) and forms again elsewhere.
- **The payoff shot:** flying debris crosses a pocket and changes fidelity as it passes through (a crate turns 1-bit, then back to colour).

## 6. Static explosions
On a seeded schedule, every 5–12 s, more often near the Breach, each burst lasts about 1.2 s:
1. **Bolt:** a jagged billboard of 1-bit noise from the clouds to the ground, 0.15 s.
2. **Burst:** an expanding shell of static noise, its alpha falling over 0.8 s.
3. **Light:**
   - a `uFlash` uniform (position, intensity) that every vista material adds as a point light with falloff;
   - the sky brightens around the burst;
   - **in the lab**, the existing light by the window pulses, so the floor flickers with each flash. The flash is short and capped: never a whiteout (the STALKER 2 complaint).
4. **Shockwave:** a ring decal expanding across the ground.
5. **Debris kick:** flying props within range get an outward impulse.
6. **Sound:** the static-thunder SFX, delayed by distance / 343 m/s, through `game-audio.ts` (the storm loop already exists: `startStormLoop` and `updateStormVolume`).

## 7. Wind, dust and flying props
- **Dust motes:** one `InstancedMesh` of camera-facing quads, at most 800 to 1000, in three depth bands. They are advected by the wind plus a curl-like noise in the vertex shader (GPU only, with no per-frame CPU work).
- **Dust curtains:** 3 big vertical planes (45, 200 and 700 m) with an fbm alpha scrolling sideways, giving a cheap volumetric feel and a strong depth cue.
- **Ground drift:** a scrolling noise band low over the ground near the horizon.
- **Flying props** use the packed gen models (low level), one `InstancedMesh` per model, with matrices updated on the CPU (at most 30 a frame):
  - **The crosswind stream:** crate-small, cardboard-stack, toolbox, coolant-can, sample-case, old-monitor and filing-cabinet tumble left to right at 20–80 m, then respawn off-screen.
  - **The Breach vortex:** shipping-container, server-rack, rubble-slab and crate-large rise on a slow helix at 300–600 m around the column.

## 8. Lighting and progress
- **The vista's own lights:**
  - a cold hemisphere (storm violet-grey sky, brown ground);
  - the Breach as the key light (cyan-white, a point light plus emissive), rim-lighting the silhouettes;
  - the flashes.
- **Fog:** exp2 in the horizon colour.
- **`setStorm(progress)` keeps its API.** As progress goes 0 → 1:
  - the storm thins and the sky clears to dusk;
  - the dust and the flashes drop off;
  - the base S rises and the high-fidelity pockets grow;
  - at 1 the plain is calm at full PBR and the Breach has closed to a faint scar.

## 9. Technique and budget (the min spec is the GTX 950M)
- **A separate `vistaScene` and `vistaCamera`, the Source 3D skybox approach:**
  - the camera copies the lab camera's rotation, fov and offset from the window each frame;
  - near 1, far 5000;
  - render order: the vista first, then clear depth, then the lab (the window cut-out shows it).
- **Scissor:** project the window's four corners each frame and draw the vista only inside that screen rect. Skip it entirely when the window is off-screen.
- **Budget:**
  - at most 40 draw calls (instancing everywhere);
  - at most 120k triangles (gen low levels);
  - at most 6 pockets in the shader loop;
  - the dust at most 1000 instances.
- **The toggle rule:** a Graphics setting "Window view: Full / Lite / Static", with Auto.
  - Lite drops the curtains and the pocket shells and halves the dust.
  - Static is today's shader plane.
- **Purity:** this is render code (client), but layouts and schedules are seeded, with no `Math.random`. That keeps shots repeatable for the tests.

## 10. Assets (the 3D agent, class `vista` in `docs/runworld/assets.json`)
- **Generated and approved on 2026-10-12:** datacentre-hall, chiller-block, shipping-container, pylon-tower, overpass-segment and rubble-slab.
- **Reused:** the lab clutter props (§7).
- **Procedural:** the Breach column, the ground, bollards and posts, the ridge, the sky, the dust and the pockets.

## 11. Open, for the owner
- Concept art of this view by the art agent, if wanted before building: one panel, the window letterbox, using this plan.
- Whether pockets drift into the lab later (gameplay) or stay a view only. They stay a view in this plan.
