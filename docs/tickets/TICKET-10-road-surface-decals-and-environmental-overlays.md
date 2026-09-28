# TICKET-10: High-Resolution Road Surface Decals & Environmental Overlays

- **ID**: `TICKET-10`
- **Component**: Track Art / 3D Decal Pipeline / Environmental Detail
- **Priority**: High (Visual Polish & Track Authenticity)
- **Status**: Ready for Implementation
- **Dependencies**: None

---
> [!IMPORTANT]
> ### ⚠️ Codex Agent Operational Directives & Session Rules
> 1. **Image Generation Quota (10 Per Turn)**:
>    - You can only generate up to **10 images per turn**.
>    - A turn reset requires user interaction: when you reach your 10-image limit, output **"[pause for turns to reset]"** and stop working so the user can reply with "Reset" to refresh your generation quota.
> 2. **Background Testing & Parallel Execution (< 300s Limit)**:
>    - Run tests in the background while continuing work; do not block or wait synchronously on long-running test suites.
>    - If any test or build task takes longer than **300 seconds**, split it into multiple smaller test suites running in parallel to prevent timeouts.
> 3. **GitHub Sandbox Token Expiry & Browser Refresh**:
>    - The GitHub sandbox authentication token will expire if sessions run excessively long without pushing.
>    - While local files are always preserved on disk, an expired token will reject remote pushes.
>    - If you experience token expiration or push failures, request the user to **refresh their browser session** to generate a fresh GitHub token.

---

## 1. Problem Statement & User Need
The 3D racetrack surfaces (dirt roads, alpine descent, canyon pass, and stadium straightaways) require rich, varied surface detailing to look authentic, dynamic, and weathered. While the core roadway now features seamless multi-frequency texturing and grass fringes, level designers need an expansive library of road decals in the 3D Track Builder to craft storytelling moments, braking zones, hazard warnings, and racing lines.

The user requires:
- A comprehensive set of high-resolution transparent road decals that can be placed flush onto the track surface in the 3D Track Builder.
- Decals must feature high-quality alpha transparency, weathered edges, and natural color palettes matching the Scrapdome / Heavy Metal GP aesthetic.
- Proper category registration in `PROP_DEFINITIONS` so all decals are immediately usable in the 3D Track Builder palette under the `decals` category.

---

## 2. Technical Requirements & Asset Specifications

### 2.1 Asset Format & Dimensions
- **File Format**: Transparent PNG with crisp alpha channel (no white halos or magenta fringing).
- **Target Resolutions**:
  - Square Decals: $512 \times 512$ or $1024 \times 1024$ px.
  - Elongated Strips / Lines: $1024 \times 256$ or $512 \times 128$ px.
- **Directory Location**: `public/art/decals/`

### 2.2 Required Road Decal Set (Codex Production Queue)

1. **Racing Lines & Tire Marks**:
   - `decal-skid-heavy-burnout.png` ($512 \times 512$): Intense dark rubber burnout donut / weave marks with rubber chunk splatter.
   - `decal-skid-hairpin-drift.png` ($1024 \times 512$): Arced drift trails for tight hairpin bends, showing inner/outer tire weight transfer.
   - `decal-tire-tread-mud.png` ($512 \times 512$): Wet mud and clay tire tracks on pavement.

2. **Fluid Spills & Track Hazards**:
   - `decal-oil-spill-large.png` ($512 \times 512$): Sprawling engine oil slick with iridescent magenta/cyan sheen and droplet trails.
   - `decal-coolant-leak.png` ($512 \times 512$): Glowing neon-cyan goblin radiator coolant puddle.
   - `decal-molten-slag-splatter.png` ($512 \times 512$): Hardened orange/black molten lava slag droplets on rock/wood.

3. **Road Damage & Structural Wear**:
   - `decal-crater-impact.png` ($512 \times 512$): Deep shell/boulder impact crater with radiating fracture cracks.
   - `decal-expansion-joint.png` ($512 \times 128$): Weathered tar-sealed asphalt seam / bridge expansion joint.
   - `decal-gravel-scatter.png` ($512 \times 512$): Loose gravel and crushed stone scatter on roadway edges.

4. **Goblin Industrial & Racing Markings**:
   - `decal-start-grid-box.png` ($512 \times 512$): Weathered white/yellow starting grid box with pole position numbers (1..8).
   - `decal-checkered-curb.png` ($512 \times 128$): Red-and-white rumble strip / apex curb pattern.
   - `decal-hazard-cross.png` ($512 \times 512$): Industrial yellow hazard "X" marking over dangerous track holes.
   - `decal-scrapdome-graffiti.png` ($512 \times 512$): Goblin spray-painted racing insignia, goblin skull, or gear emblem.
   - `decal-speed-boost-pad.png` ($512 \times 512$): Glowing mechanical speed boost chevron arrows with runic bronze inlay.

5. **Trackside Drainage & Infrastructure**:
   - `decal-grate-slotted.png` ($512 \times 512$): Rectangular industrial drainage grate with rusted crossbars.
   - `decal-manhole-heavy.png` ($512 \times 512$): Heavy round goblin foundry access hatch with pressure valves.

---

## 3. Integration into `PROP_DEFINITIONS` (`src/game/track-builder-3d.ts`)

Each decal is registered with `category: 'decals'` and `isDecal: true`:
```ts
{
  type: 'decal_skid_burnout',
  name: 'Burnout Donut Skid',
  category: 'decals',
  url: '/art/decals/decal-skid-heavy-burnout.png',
  defaultWidth: 800,
  defaultHeight: 800,
  isDecal: true,
}
```

In `TrackBuilder3D`, `isDecal: true` props:
- Lay flush on the road surface with normal-aligned quaternion.
- Apply `polygonOffset: true` with factors `(-2, -2)` to eliminate z-fighting against track ribbons and terrain meshes.
- Support in-place rotation / tilt, horizontal flipping, scaling, and track-tangent snapping.

---

## 4. Verification & Quality Acceptance Criteria
1. **No Halos or Artifacts**: Decals must blend seamlessly onto dirt, cobble, rock, and wood track textures.
2. **Zero Z-Fighting**: When placed on the track ribbon in Track Builder, decals must never flicker or clip through the surface.
3. **Responsive Scaling & Snapping**: Decals scale smoothly and respect track alignment and centerline snapping.
