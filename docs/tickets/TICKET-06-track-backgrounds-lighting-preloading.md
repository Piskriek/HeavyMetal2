# TICKET-06: Epic Blizzard-Style Track Backdrops, Thematic Lighting & Asset Preloading

- **ID**: `TICKET-06`
- **Component**: Environment / Lighting / Asset Pipeline
- **Priority**: High (Phase 2 World Building)
- **Status**: Ready for Implementation
- **Dependencies**: `TICKET-05`

---

## 1. Problem Statement & User Need
In the live race screenshots (Screenshots 4 & 5), tracks like Boomtown Run and Woolly Wasteland display barren, flat procedural sky gradients with repetitive tan mesa cutouts. Furthermore, assets occasionally pop in during the initial seconds of a race, and the tracks lack distinctive atmospheric mood, dramatic lighting, and environmental identity.

The user requires:
- **Epic PNG fantasy backgrounds in the Blizzard style** for all tracks: towering peaks, smoldering volcanic quarry towers, ancient ruins, and massive canyon vistas.
- **Each track styled to its theme, lighting, and mood**: unique color palettes, ambient fog/sunbeams, track surface textures, and dynamic skyboxes.
- **Preload images**: A robust async asset preloading pipeline that decodes all track artwork and sprites before rendering the starting grid.

---

## 2. Technical Requirements & Specifications

### 2.1 Thematic Track Identities & Lighting Profiles
1. **Track 1: Rustbucket Ridge (Copperwood Valley)**
   - **Theme**: Dense autumnal goblin timberland and pine canyons.
   - **Lighting / Mood**: Warm golden hour sunlight breaking through pine needles, soft forest mist, dappled shadows, rich copper-ochre dirt track.
   - **Skybox**: Distant snow-dusted alpine spires and goblin logging camps with timber scaffolding.
2. **Track 2: Boomtown Run (Brass Quarries)**
   - **Theme**: Smoldering industrial volcanic open-pit mine.
   - **Lighting / Mood**: Dramatic dusk twilight with blazing crimson and burnt-orange forge glow, billowing coal smoke, sparks drifting across the road, dark obsidian/iron-tinted dirt.
   - **Skybox**: Giant brass smelters, smoking blast furnaces, iron aqueducts, and jagged red canyon mesas.
3. **Track 3: Woolly Wasteland (Woolwind Downs & Coliseum)**
   - **Theme**: Windswept highland ruins and turbulent sheep pastures.
   - **Lighting / Mood**: Moody overcast storm lighting, cool slate-blue/emerald tones, sunbeams piercing dark rainclouds, pale chalky highland dirt.
   - **Skybox**: Craggy mountain peaks, ancient stone monoliths, drifting wool zeppelins, distant waterfalls.

### 2.2 Multi-Layered Parallax Background Rendering
- Upgrade `src/game/environment.ts` and `src/game/world-art.ts`:
  - **Layer 1 (Far Sky)**: High-resolution painted panoramic sky (2048x1024) wrapping smoothly across camera turns.
  - **Layer 2 (Distant Mountains / City Silhouettes)**: Middle-distance parallax hills, giant goblin fortresses, smelters, and waterfalls moving at 0.15x speed.
  - **Layer 3 (Midground Scenery)**: Watchtowers, pine clusters, spectator scaffolding, and drifting airships moving at 0.4x speed.
  - **Layer 4 (Trackside Environment)**: Spectator crowd strips (`foreground-crowd.png`, `grandstand.png`), banner poles, stone kerbs.

### 2.3 Comprehensive Asset Preloader Pipeline
- Refactor `src/game/assets.ts` and `src/game/art-assets.ts`:
  - Implement `preloadRaceAssets(courseId: CourseId, roster: RacerRoster): Promise<void>`
  - Uses `HTMLImageElement.decode()` and canvas offscreen bitmap caching.
  - Tracks loading progress (0% to 100%) and feeds progress directly into the loading screen from `TICKET-03`.
  - Ensures all track textures, obstacle models, skyboxes, and racer sprites are resident in GPU memory before the starting grid countdown begins.

---

## 3. Implementation Plan
1. **Asset Sourcing & Generation**:
   - Create or generate the 3 epic painted track skyboxes under `public/art/tracks/`:
     - `sky_copperwood_ridge.webp`
     - `sky_boomtown_quarry.webp`
     - `sky_woolly_wasteland.webp`
2. **Track Lighting Configs**:
   - Update `src/game/courses.ts` to add lighting parameters: `skyboxUrl`, `fogColor`, `ambientLight`, `sunbeamIntensity`, `trackSurfaceTexture`.
3. **Renderer Upgrade**:
   - Update `src/game/renderer.ts` and `src/game/environment.ts` to composite multi-layer parallax backgrounds with proper horizontal tiling and zero pop-in.
4. **Preloader Integration**:
   - Tie preloader execution into `RaceScreen.tsx` during component mount.

---

## 4. Acceptance Criteria
- [ ] Every track displays an epic, hand-painted fantasy matte painting matching its thematic profile.
- [ ] Parallax scrolling across distant mountains and skies is smooth with no visible seam or pop-in at screen edges.
- [ ] Lighting tint, fog, and shadow colors accurately reflect each course's distinct atmosphere.
- [ ] No visual stutter, lag, or untextured placeholder rendering when the starting grid appears.
