# TICKET-08: Multi-Section Track Expansion Part 1 — Waterfall Cliff Zigzag, Protruding Rocks & Pinball Chasm

- **ID**: `TICKET-08`
- **Component**: Track Design / 3D Track Layout / Environmental Art & Physics Engine
- **Priority**: High (Phase 3 Track Expansion)
- **Status**: Implemented (waterfall drop and playable Section 3 mine handoff)
- **Dependencies**: `TICKET-06`, `TICKET-07`

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

## 1. Visual Concept & Art Reference

### 1.1 Section 2 Concept Art: The Cliffside Waterfall Zigzag
![Section 2 Waterfall Zigzag Concept Art](file:///c:/MarbleGp/docs/tickets/assets/section2-waterfall-zigzag-concept.jpg)

### 1.2 Transition 1-to-2 Concept Art: The Scrap Fall Crest Launch
![Transition 1-to-2 Cliff Launch Concept Art](file:///c:/MarbleGp/docs/tickets/assets/transition1-ridge-to-waterfall-concept.jpg)

---

## 2. Problem Statement & Level Design Vision

Currently, the race track terminates after a single 15 km alpine downhill into a flat stadium finish. This makes races feel short, predictable, and flat. The user requires an ambitious multi-section track structure:

1. **The Sheer Waterfall Cliff**:
   - The gentle alpine downhill ends at a massive cliff drop-off.
   - Section 2 descends a colossal granite cliff face alongside massive roaring waterfalls with mist, foam, and spray particles.
2. **Natural Switchback Zigzagging**:
   - Instead of an artificial flat board, the track descends in **natural flowing switchback zigzags** carved into the cliff face, featuring banked wooden turns, wet stone troughs, and precarious rock shelves.
3. **Protruding Rocks & Natural Deflectors**:
   - Jagged rocks and giant boulders stick out directly from the cliff walls and road shoulders.
   - They act as natural bumpers, ramps, and lane splitters, ricocheting balls down the cascade.
4. **Cliffside Goblin Spectator Scaffolding**:
   - Rickety multi-tiered wooden scaffolding, rope bridges, and viewing balconies cling to the cliff walls on both sides of the canyon.
   - Crowded with animated cheering goblins waving clan flags, swinging lanterns, and brandishing torches.
5. **Seamless Transitions**:
   - **Transition 1 $\rightarrow$ 2**: High-speed launch off the wooden lip of Scrap Fall Crest into freefall over the waterfall gorge.
   - **Transition 2 $\rightarrow$ 3**: Plunging from the churning base of the falls into a massive cavern maw that leads directly into the underground mine tunnels of Section 3.

---

## 3. Detailed Technical Architecture & Specifications

### 3.1 Course Layout & Distance Budget (`src/game/courses.ts`, `scene.ts`)
Each grand circuit expands to a 3-Stage Odyssey (36,000m total):
- **Stage 1 (0m – 12,000m)**: Alpine Ridge Downhill (Current Course Core).
- **Stage 2 (12,000m – 24,000m)**: **The Waterfall Cliff Zigzag & Pinball Chasm (This Ticket)**.
- **Stage 3 (24,000m – 36,000m)**: Subterranean Roller Coaster Mine & Stadium Finale (`TICKET-09`).

```
[0m -------------- 12,000m] --> [12,000m ------------------ 24,000m] --> [24,000m -------------- 36,000m]
   Stage 1: Alpine Ridge            Stage 2: Waterfall Zigzag & Cliff        Stage 3: Subterranean Mine
   (High-Speed Downhill)            - Scrap Fall Launch (12,000m)            - Cavern Mouth (24,000m)
                                    - Upper Tier Switchbacks (13,500m)       - Roller Coaster Rails (26,000m)
                                    - Mid-Cliff Rock Outcrops (17,000m)      - Lava Loops & Fire (29,000m)
                                    - Churning Foam Run (21,000m)            - Waterfall Breakthrough (33,500m)
                                    - Whirlpool Cavern Maw (23,800m)         - Stadium Victory Straight (36,000m)
```

---

### 3.2 Section 2 Step-by-Step Level Design & Geometry

#### 1. Transition 1 $\rightarrow$ 2: The Scrap Fall Crest (11,800m – 12,600m)
- **Geometry**: The Stage 1 downhill accelerates into a steep 35° wooden ramp terminating abruptly at a cliff lip at `x = 12,200`.
- **The Leap**: Boost pads fling all 4 racers 400m through open air over the roaring gorge.
- **Visuals**: Zeppelins float in the background; sunlight beams cut through water mist; wooden grandstands packed with screaming goblins line the cliff rim.
- **Camera**: Dynamic camera tracks the drop, expanding vertical range and tilting slightly downward to show the massive drop below.

#### 2. Upper Switchback Cascade (12,600m – 15,500m)
- **Descent Style**: Banked wooden berms hugging the granite cliff face.
- **Track Flow**:
  - **Hairpin 1 (13,200m)**: 180° right-hand sweeping wooden switchback with high timber banked wall (`#4a2f1b`).
  - **Hairpin 2 (14,400m)**: 180° left-hand switchback cutting right through a cascading whitewater veil.
- **Protruding Rocks**:
  - Center divider boulders force riders to choose between the **Tight Inside Line** (slick wet stone, high risk of clipping the wall) vs **Wide Banked Berm** (fast, safe, wooden slats).
- **Spectators**: Hanging wooden balconies overhang the switchbacks with cheering goblins and banners.

#### 3. The Mid-Cliff Pinball Rockfield (15,500m – 19,500m)
- **Elevation Drop**: Steep 55° plunge down jagged granite shelves.
- **Protruding Rock Formations**:
  - Granite Outcrops (`kind: 'rock-bumper'`): Natural rounded stone ledges with high bounce coefficient ($e = 1.45$). Bumping into them redirects the marble without killing forward momentum.
  - Spiked Boulders: Mineralized stone spikes that trigger a heavy impulse deflection and camera shake ($4.5$).
- **Integrated Arcade Props** (from `PreGame/` assets):
  - Spring Launchers (`spring.webp`): Mounted flush to rock faces to fling racers across wide gaps between switchback shelves.
  - Flaming Fire Rings (`ring-spiked.webp`): Suspended over outer cliff drop-offs; daring players who jump off the edge through the ring receive +60 km/h hyper-speed and safe landing on the tier below.

#### 4. The Wet Foam Run & Rope Bridge Crossings (19,500m – 23,800m)
- **Surface**: Wet weathered planks and mossy slate (`surfaceType: 'wet_wood' | 'moss_rock'`).
- **Hazard**: Missing guardrails on the canyon side. Going off the edge triggers the aerial recovery crew respawn.
- **Hanging Rope Bridge**: A swinging suspension wooden bridge spanning a 120m chasm between two cliff spires, swaying slightly under the weight of the rolling balls.
- **Spectator Density**: Wooden scaffolding towers 4 tiers high flank both sides with goblin drummers, flares, and horns.

#### 5. Transition 2 $\rightarrow$ 3: The Whirlpool Cavern Maw (23,500m – 24,200m)
- **Geometry**: The switchback path funnels into a deep rock channel where the waterfall's whitewater drains violently into a cavern funnel.
- **The Plunge**: Racers drop through the roaring whirlpool mouth into total darkness, triggering the transition into the subterranean mine tunnels of Section 3.
- **Audio/Visual Transition**: Thunderous waterfall roar transitions into deep subterranean echoes and cavern rumble. Daylight dims rapidly to pitch black before the glowing lava and lanterns of Stage 3 ignite.

---

### 3.3 Physics & Interaction Mechanics (`src/game/engine.ts`)

1. **Cliffside Vertical Gravity Scaling**:
   - In steep vertical cliff sections ($> 40^\circ$), adjust downward gravity:
     $$\text{gravity}_{\text{cliff}} = \text{GRAVITY} \times 1.45$$
   - Provides an exhilarating feeling of freefall while keeping steering responsive.
2. **Protruding Rock Collisions**:
   - Implement circular rock collider detection:
     $$\vec{v}_{\text{rebound}} = \text{reflect}(\vec{v}, \vec{n}) \times e_{\text{rock}}$$
   - Produces satisfying clattering stone impact sound effects and rock dust particles.
3. **Wet Surface Traction**:
   - `wet_wood` reduces lateral steering friction by 40%, demanding rhythmic steering adjustments through switchbacks.
4. **Air Bounce Shortcuts**:
   - Using the <kbd>SPACE</kbd> Air Bounce near a cliff switchback allows skilled players to hop over the dividing rock ridge to skip half the hairpin turn!

### 3.4 The 5-Tier Environmental Depth Stack for Section 2 (Waterfall Cliff)

To ensure the world feels expansive, believable, and cohesive, every asset in Section 2 must be assigned to and rendered within its designated depth plane:

```
[CAMERA]
   │
   ├── 0. FOREGROUND (Parallax: 1.20x - 1.35x)
   │      Water spray mist droplets on screen, overhanging moss clumps, jutting rock stalactites passing close-up
   │
   ├── 1. ACTIVE TRACK & RACERS (Parallax: 1.00x - Primary Game Plane)
   │      Banked wooden switchbacks, wet mossy slate, protruding rock bumpers, spring launchers, fire rings
   │
   ├── 2. RACE WALL, BARRIERS & SPECTATOR SCAFFOLDING (Parallax: 0.94x - 0.98x)
   │      Timber crash barriers, multi-tiered cliff scaffolding, cheering goblins with banners, horns, and torches
   │
   ├── 3. MIDGROUND: BEHIND RACE WALL & SCAFFOLDING (Parallax: 0.38x - 0.48x)
   │      Cliffside pine/fir trees clinging to rock cracks, secondary water chutes, wooden aqueducts, rock buttresses
   │
   ├── 4. DISTANT CANYON LANDSCAPE (Parallax: 0.15x - 0.22x)
   │      Opposite canyon cliff wall, gargantuan primary waterfall plunge, deep mist chasm floor
   │
   └── 5. SKYBOX & HORIZON (Parallax: 0.00x - 0.05x)
          Sunbeams piercing storm clouds, misty alpine peaks, high-altitude floating zeppelins
```

#### How Section 2 Layers Relate & Harmonize:
- **Foreground to Track**: Water spray and foreground rock edges frame the player's view, heightening speed and vertigo.
- **Track to Race Wall**: Banked wooden berms transition directly into timber crash railings and spectator platforms, ensuring players clearly perceive track boundaries.
- **Race Wall to Midground**: Behind the cheering crowds, the cliff face is richly populated with hardy alpine conifers, rocky spires, and wooden aqueducts, avoiding any blank wallpaper look.
- **Midground to Far Canyon**: As the terrain drops away, the midground trees and water chutes fade softly into the deep canyon mist and towering waterfall background.

---

## 4. Implementation Steps & Work Packages

### Work Package 1: Environmental Assets & Waterfall Renderer
- [ ] Move `PreGame/src/assets/game/bumper-*.webp`, `spring.webp`, `strip-wood.webp`, and `strip-moss.webp` into `public/art/track-parts/`.
- [ ] In `src/game/environment.ts`, build multi-layer parallax waterfall sheets:
  - Background cliff granite wall with running water texture.
  - Midground cascading white-water foam with animated vertical UV scroll.
  - Foreground mist particles rising from the bottom chasm.
- [ ] Add cliffside wooden spectator scaffolding sprites with animated crowd silhouettes and torches.

### Work Package 2: Track Layout & Switchback Generator
- [ ] In `src/game/track-layout.ts`, create `createStage2WaterfallSection()`:
  - Generate the 4 switchback tiers between `12,000m` and `24,000m`.
  - Place protruding rock outcrops, center divider boulders, and banked wooden turns.
  - Place spring launchers, fire boost rings, and aerial blimps over the gorge.

### Work Package 3: Physics & Collision Updates
- [ ] In `src/game/engine.ts`:
  - Support `rock-bumper` obstacle kind with radial bounce impulse and rock sound.
  - Support `wet_wood` surface friction modifier in `stepRacer`.
  - Add camera pitch adjustment for steep drops.

---

## 5. Acceptance Criteria
- [ ] Track length extends seamlessly from Stage 1 downhill into Stage 2 waterfall cliff without loading pauses or hitching.
- [ ] The waterfall cascade feels alive with rushing water, mist particles, and ambient roaring audio.
- [ ] Natural switchbacks feel thrilling to navigate: high-speed banked turns catch the marble, while protruding rocks challenge line selection.
- [ ] Cheering goblin spectators on wooden scaffolding give the cliff walls rich life and spectacle.
- [ ] Transition 1 $\rightarrow$ 2 (Scrap Fall launch) and Transition 2 $\rightarrow$ 3 (Cavern Maw plunge) are dramatic, visceral, and seamless.
- [ ] Maintains 60 FPS across both desktop and mobile viewports.
