# TICKET-09: Multi-Section Track Expansion Part 2 — Subterranean Roller Coaster Mine, Spaghetti Rails, Lava Loops & Stadium Finale

- **ID**: `TICKET-09`
- **Component**: Track Design / Subterranean Environment / Multi-Tier Roller Coaster Mechanics / Climax Race Sequence
- **Priority**: High (Phase 3 Track Expansion)
- **Status**: Detailed & Ready for Implementation
- **Dependencies**: `TICKET-08`

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

### 1.1 Section 3 Concept Art: The Subterranean Roller Coaster Mine
![Section 3 Roller Coaster Mine Concept Art](file:///c:/MarbleGp/docs/tickets/assets/section3-mine-rollercoaster-concept.jpg)

### 1.2 Transition 3-to-Finale Concept Art: The Waterfall Breakthrough to Stadium
![Transition 3-to-Finale Concept Art](file:///c:/MarbleGp/docs/tickets/assets/transition3-mine-to-stadium-concept.jpg)

---

## 2. Problem Statement & Level Design Vision

Following the cliffside waterfall zigzag (`TICKET-08`), the race plunges deep into the earth for the ultimate subterranean climax before bursting into the stadium finish.

The user requires:
1. **Underground Roller Coaster Minecart Tracks**:
   - The track enters a gargantuan volcanic cavern with a labyrinthine "spaghetti" web of multi-tier wooden trestles and iron rails.
   - Tracks split into branching routes, criss-cross each other in 3D, and feature inverted loops and banked corkscrews.
2. **Lava, Fire & Industrial Hazards**:
   - Bubbling molten lava rivers and fiery slag pits beneath the trestles.
   - Flaming fire boost rings that reward daring high-altitude jumps.
   - Swinging ore cauldrons pouring molten metal across the rails on timed intervals.
   - Clustered TNT explosive barrels that launch careless racers sideways.
3. **Spectacle Transitions**:
   - **Transition 2 $\rightarrow$ 3 (The Cavern Maw)**: Plunging directly from the churning waterfall pool into darkness, transitioning instantly to glowing magma, amber lanterns, and goblin miners cheering in hanging iron cages.
   - **Transition 3 $\rightarrow$ Finish (The Waterfall Breakthrough)**: The subterranean rails converge into an explosive rocket-boosted climb that punches right through a thundering daylight waterfall curtain into the festive, firework-filled Scrapdome Stadium victory straight.

---

## 3. Detailed Technical Architecture & Specifications

### 3.1 Course Layout & Distance Budget (24,000m – 36,000m)

```
[24,000m -------------- 28,500m] --> [28,500m ------------------ 33,000m] --> [33,000m -------------- 36,000m]
   Zone 3.1: The Trestle Labyrinth      Zone 3.2: Lava Cavern & Loops           Zone 3.3: Breakthrough & Finale
   - Plunge into Cavern (24,000m)       - Magma Chamber (28,500m)               - Rocket Incline (33,000m)
   - 3-Way Rail Branch (25,200m)        - Vertical 360° Lava Loop (29,800m)     - Waterfall Curtain (34,200m)
   - Trestle Spaghetti (26,800m)        - Swinging Ore Cauldrons (31,200m)      - Stadium Sprint (34,800m)
   - Mineral Crates & TNT (27,900m)     - Flame Boost Rings (32,000m)           - Grand Brass Finish (36,000m)
```

---

### 3.2 Section 3 Step-by-Step Level Design & Geometry

#### 1. Transition 2 $\rightarrow$ 3: The Drowned Maw (24,000m – 25,200m)
- **Geometry**: The Section 2 waterfall torrent funnels into a churning whirlpool drain that drops 80 vertical units into a deep rock tunnel.
- **Atmospheric Shift**:
  - Outdoor skybox fades rapidly; cavern ceiling closes overhead.
  - Deep subterranean fog and smoke rise from below.
  - Amber lantern posts flicker on heavy timber struts; fluorescent green cave fungi dot the stone walls.
- **Audio Cue**: Roaring waterfall sound muffled as deep subterranean grinding, pickaxes, and bass cavern drone take over.

#### 2. Zone 3.1: The Spaghetti Rail Split (25,200m – 28,500m)
- **Rail Mechanics**: The track divides into 3 distinct branching roller coaster routes:
  1. **Route A: The High Roller Coaster (Upper Trestle)**:
     - High-altitude timber trestle hugging the cavern ceiling.
     - Narrow twin rails with +20% speed bonus (`rail_speed_multiplier = 1.20`).
     - High risk of falling off the unguarded curves directly into the lower cavern.
  2. **Route B: The Lower Brimstone Trench (Main Floor)**:
     - Banked stone trough running alongside the underground river.
     - Wider, safer, and lined with speed boost pads and TNT clusters (`skull-box.webp`, `crate.webp`).
  3. **Route C: The Minecart Siding (Secret High-Risk Shortcut)**:
     - Hidden jump ramp at `x = 26,100` accessible via <kbd>SPACE</kbd> Air Bounce that lands on a razor-thin single-rail line cutting 300m off the lap.
- **Dynamic Spectators**: Goblin miners in suspended iron cages, cheering and banging pickaxes against the bars.

#### 3. Zone 3.2: The Magma Chamber, Loops & Fire Rings (28,500m – 33,000m)
- **Lava Floor Hazard**:
  - The floor drops away into a bubbling magma lake (`#ff3b00` glow with dynamic heat distortion).
  - Touching the lava lake instantly vaporizes the ball in a cloud of black smoke, triggering an immediate checkpoint recovery onto the nearest rail.
- **The Vertical Lava Loop (29,800m – 30,500m)**:
  - A 360° roller coaster loop suspended directly over a molten fire pit.
  - Requires minimum speed of $v_x > 480$ km/h to clear the apex without stalling.
- **Flaming Boost Rings**:
  - Blazing iron rings suspended mid-air along the roller coaster descent.
  - Passing through grants a **Fiery Nitro Surge** (+80 km/h, rocket engine sound, flame particle exhaust).
- **Swinging Ore Cauldrons (31,200m – 32,400m)**:
  - 3 massive iron cauldrons swinging across the tracks like pendulums on timed cycles.
  - Molten gold/slag spills down in a hazardous stream that must be timed or dodged by switching rails (<kbd>A</kbd>/<kbd>D</kbd>).

#### 4. Transition 3 $\rightarrow$ Finish: The Waterfall Breakthrough & Stadium Finale (33,000m – 36,000m)
- **The Rocket Incline (33,000m – 34,200m)**:
  - All branching rails merge back into a four-lane iron track rising up a steep 30° rock shaft.
  - Staggered boost pads accelerate all racers to maximum terminal velocity ($> 750$ km/h).
- **The Waterfall Breakthrough (34,200m)**:
  - The mine tunnel bursts outward through a thundering curtain of daylight water cascading over the cavern exit archway.
  - **Screen VFX**: Explosive white-water splash particles burst outward across the camera, accompanied by sudden sunlight bloom and thunderous water crash audio.
- **The Scrapdome Victory Straight (34,500m – 36,000m)**:
  - Racers emerge into full daylight onto the wide, packed-dirt stadium straight.
  - Flanked on both sides by multi-tier grandstands packed with roaring goblin fans waving banners.
  - Fireworks and colored smoke rockets explode overhead.
  - Monumental brass and iron **Scrapdome Finish Line Gantry** with spinning checkered gears and celebratory victory horns.

---

### 3.3 Physics, Controls & Camera Specifications (`src/game/engine.ts`, `renderer.ts`)

1. **Minecart Rail Lock-In Traction**:
   - When a marble aligns with an iron rail lane ($\Delta z < 14$), snap into "Rail-Lock":
     - Rolling resistance reduced by 60%.
     - Metallic clatter and wheel-grind sound loops (`audio.play('rail_grind')`).
     - Sparks emit backwards from the ball contact point (`#ffd700`, 8 particles/frame).
2. **Roller Coaster 3D Camera Dynamic Roll**:
   - In looping and corkscrewing sections, smoothly roll camera bank angle:
     $$\text{roll}_{\text{cam}} = \text{clamp}(\text{trackSlope} \times 0.28, -0.4, 0.4)$$
   - Creates a dizzying, authentic roller coaster sensation without disorienting the player.
3. **Cavern Lighting System**:
   - Global darkness overlay: Dark slate tint (`rgba(10, 8, 14, 0.72)`).
   - Radial illumination halos around each racer's marble, lighting up the iron rails and wooden ties 200m ahead.
   - Warm flickering point lights positioned at each lantern post ($r = 180$, color `#ffaa33`).
   - Searing orange ambient uplight from molten lava pools ($y > 450$).

---

## 4. Implementation Steps & Work Packages

### Work Package 1: Cavern Assets & Rail Sprites
- [ ] Create or extract tileable iron rail and wooden sleeper textures (`rail-iron.png`, `trestle-wood.png`).
- [ ] Add swinging ore cauldron sprite with animated slag spill frame loop.
- [ ] Add flaming boost ring and glowing lantern post sprites to `public/art/track-parts/`.
- [ ] Create stadium finish gantry and firework particle bursts for the grand finale.

### Work Package 2: Spaghetti Rail Track Generator
- [ ] In `src/game/track-layout.ts`, implement `createStage3MineSection()`:
  - Generate the 3-way rail split (High Trestle, Lower Trench, Siding Shortcut).
  - Place vertical 360° lava loop and timed swinging cauldrons.
  - Place the ascending rocket chute and waterfall breakthrough portal.

### Work Package 3: Lighting, Rail Physics & Audio
- [ ] In `src/game/renderer.ts`:
  - Implement cavern dark lighting mask with racer headlight punch-throughs.
  - Add lava heat haze and water curtain breakthrough splash overlay.
- [ ] In `src/game/engine.ts`:
  - Implement rail-lock lateral attraction and speed bonus.
  - Add lava pit hazard collision boundary.
  - Trigger celebratory fireworks and crowd cheer upon crossing the 36,000m finish line.

---

## 5. Acceptance Criteria
- [ ] Seamless transition from Stage 2 waterfall pool into Stage 3 subterranean mine tunnels.
- [ ] Roller coaster rails feel fast, tactile, and distinct with metallic grind sounds and spark particles.
- [ ] Multi-tier spaghetti track offers genuine strategic choice: high-speed risky trestles vs safe lower routes.
- [ ] Lava pits, fire rings, and swinging cauldrons provide visceral, thrilling obstacles.
- [ ] Punching through the waterfall curtain into the bright stadium finish line delivers a triumphant, cinematic climax.
- [ ] Stable 60 FPS performance during cavern lighting and particle-heavy firework sequences.
