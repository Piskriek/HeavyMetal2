# TICKET-06.2: Midground Environmental Depth Layers (Treetops, Props & Crowd Separation)

- **ID**: `TICKET-06.2`
- **Component**: Environmental Art / Multi-Layer Parallax Pipeline / World Rendering
- **Priority**: High (Visual Polish & Atmosphere)
- **Status**: Completed
- **Dependencies**: `TICKET-06`

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

## 1. Visual Concept & Layer Breakdown Reference

![Midground Depth Layers Concept Art](file:///c:/MarbleGp/docs/tickets/assets/midground-environmental-depth-concept.jpg)
*Figure 1: Architectural breakdown showing the clear separation between the foreground track, the spectator crowd railing, the dense midground treetop canopy/structures, and the distant mountain skybox.*

---

## 2. Problem Statement & User Need

While `TICKET-06` introduces epic far backdrops and skyboxes, a noticeable visual void currently exists in the **midground**: the empty spatial gap directly behind the spectator crowd and crash barriers, before reaching the distant horizon. 

Without a rich midground, the world feels like a flat stage set with a 2D wallpaper glued behind it. The user explicitly requires:
1. **Populate the Area Between Race Wall / Crowd and the Far Backdrop**:
   - Fill the intermediate depth layer with map-appropriate scenery (e.g. dense pine/fir treetops, forest canopies, wooden watchtowers, smoking industrial chimneys, or rustic windmills).
2. **Standardize the 5-Tier Environmental Depth Stack**:
   - Establish a unified rule for how the **Foreground**, **Track**, **Race Wall / Crowd**, **Behind Race Wall (Midground)**, and **Far Backdrop (Skybox)** visually relate and layer together across all sections and tracks.

---

## 3. The Unified 5-Tier Environmental Depth Model

Every track section and course in Heavy Metal GP 2 must be structured into five coherent depth planes:

```
[CAMERA]
   │
   ├── 0. FOREGROUND OVERLAY (Parallax: 1.15x - 1.30x)
   │      Overhanging rock arches, dangling cave stalactites, foliage leaf fringes, near torch flares
   │
   ├── 1. ACTIVE TRACK & RACERS (Parallax: 1.00x - Primary Game Plane)
   │      The 4 racing lanes, obstacles (TNT, sheep, loops, bumpers), ball physics, pickups, and ground decals
   │
   ├── 2. RACE WALL, BARRIER & SPECTATOR STANDS (Parallax: 0.92x - 0.98x)
   │      Timber track borders, stone curbs, wooden grandstands, spectator goblins cheering along the fence
   │
   ├── 3. MIDGROUND: BEHIND RACE WALL (Parallax: 0.35x - 0.50x)  <-- [FOCUS OF THIS TICKET]
   │      Treetops, dense forest canopies, rocky knolls, lookout towers, industrial derricks, secondary trestles
   │
   ├── 4. DISTANT LANDSCAPE & LANDMARKS (Parallax: 0.12x - 0.20x)
   │      Colossal mountain spires, canyon bluffs, goblin fortresses, distant waterfall chasms
   │
   └── 5. SKYBOX & HORIZON (Parallax: 0.00x - 0.05x)
          Sky gradient, painted cloud banks, sun/moon glare, soaring high-altitude zeppelins
```

---

## 4. Map-Specific Midground Specifications

### 4.1 Course: Alpine Ridge (`ridge`)
- **Theme**: High-altitude coniferous wilderness, jagged granite crags, and goblin scouting posts.
- **Midground Elements (Layer 3)**:
  - **Pine & Fir Treetops**: Dense layers of evergreen treetops peaking just above the grandstands and dipping down into forested valleys.
  - **Forest Silhouettes & Canopy Fill**: Overlapping clusters of dark pine foliage (`#1b3022`, `#24422e`) creating depth behind the crowd.
  - **Wooden Lookout Watchtowers**: Rickety wooden guard stations and rope bridges strung between tall trees.
  - **Rocky Knolls & Mist**: Granite rock crests with low-lying mountain mist rolling between the tree trunks.

### 4.2 Course: Boomtown Volcanic Basin (`boomtown`)
- **Theme**: Heavy industrial goblin mining colony, molten ironworks, and toxic smog.
- **Midground Elements (Layer 3)**:
  - **Charred Deadwood Trees**: Gnarled, blackened tree trunks with glowing amber ember hollows.
  - **Iron Smokestacks & Exhaust Vents**: Rusted metal pipes and chimneys puffing sulfurous smoke and furnace sparks.
  - **Slag Heaps & Waste Berms**: Heaps of dark industrial tailings and discarded machinery gears.
  - **Wooden Cranes & Gantry Derricks**: Towering wooden A-frame winches hoisting heavy iron ore buckets over the crowd.

### 4.3 Course: Sheep Meadow (`sheep`)
- **Theme**: Bucolic rolling farmland, rustic orchards, and eccentric pastoral goblin contraptions.
- **Midground Elements (Layer 3)**:
  - **Lush Deciduous Treetops**: Round oak, apple, and weeping willow canopies in warm olive and golden greens (`#4d6b2c`, `#6c8f38`).
  - **Spinning Rustic Windmills**: Low wooden windmill towers with spinning cloth or wooden blades visible behind the spectator stands.
  - **Hedgerows, Haystacks & Barn Silhouettes**: Overlapping thatched farm roofs, hayrick piles, and stone pasture walls.
  - **Gentle Grassy Hills**: Soft rolling green knolls with wild buttercups and clover.

---

## 5. Technical Implementation & Rendering Architecture

### 5.1 Parallax Calculation & Camera Coupling (`src/game/environment.ts`)
The midground layer must move smoothly relative to camera motion without jitter:
```ts
// Parallax coordinates for Midground (Layer 3)
const midgroundParallax = 0.42;
const screenX = (worldX - cameraX * midgroundParallax) * cameraZoom;

// Vertical anchoring to track terrain
// Smoothly tracks the general slope of courseY(x) while maintaining natural skyline elevation
const terrainElevation = courseY(worldX, course);
const screenY = (terrainElevation - cameraY * 0.75 - midgroundHeightOffset) * cameraZoom;
```

### 5.2 Asset Format & Blending Rules
1. **Asset Type**: High-resolution transparent PNG or WebP sprites with crisp alpha transparency (no halos or green spill).
2. **Asset Dimensions**: 512x256 or 1024x512 tileable horizontal strips representing tree clusters and props.
3. **Color Grading & Aerial Perspective**:
   - To sell depth, the midground layer must have slight atmospheric tinting matching the course sky:
     - *Ridge*: Tinted with cool blue-grey atmospheric haze (`rgba(40, 65, 80, 0.15)`).
     - *Boomtown*: Tinted with warm amber/brown sulfur haze (`rgba(70, 45, 20, 0.18)`).
     - *Sheep*: Tinted with soft sunny morning haze (`rgba(80, 85, 45, 0.10)`).

---

## 6. Implementation Steps

1. **Asset Generation & Placement**:
   - Create or cut transparent PNG strips for midground foliage under `public/art/tracks/midground/`:
     - `ridge-treetops.png` (evergreen conifers, watchtowers, rock knolls)
     - `boomtown-smokestacks.png` (charred trees, chimneys, derricks, slag heaps)
     - `sheep-orchard.png` (deciduous canopies, windmills, barns, hedgerows)
2. **Environment Layer Integration (`ArenaEnvironment`)**:
   - In `src/game/environment.ts`, add `drawMidgroundScenery()` called between the spectator stands / track boundary and the background skybox canvas.
   - Implement horizontal strip wrapping so the midground seamlessly tiles across the entire 36,000m track length.
3. **Course Lighting & Color Adjustment**:
   - Hook midground tinting into `src/game/courses.ts` lighting definitions.

---

## 7. Acceptance Criteria
- [ ] The visual void behind the spectator grandstands is fully populated with map-appropriate midground scenery.
- [ ] Parallax speed feels natural ($~0.42\times$), creating a convincing 3D sense of depth between the foreground crowd and far mountains.
- [ ] Midground vertical height gracefully tracks the course hills without clipping into the track or floating unnaturally in the sky.
- [ ] All assets are clean PNGs with crisp alpha blending and zero artifact halos.
- [ ] Maintains 60 FPS with zero performance degradation.
