# TICKET-09: Multi-Section Track Expansion Part 2 — Mine Tunnels, Minecart Rails & Waterfall Stadium Finale

- **ID**: `TICKET-09`
- **Component**: Track Design / Subterranean Environment / Climax Race Sequence
- **Priority**: High (Phase 3 Track Expansion)
- **Status**: Ready for Implementation
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

## 1. Problem Statement & User Need
Building on the Stage 2 Waterfall Cascades (`TICKET-08`), the race needs a thrilling subterranean climax before the final victory celebration. The user specifically specified the third and final stage of the grand race:

The user requires:
- **Section 3 (Mine Tunnels & Minecart Tracks)**:
  - The waterfall cascade plunges directly into an underground goblin cavern and deep mining complex.
  - Racers roll at blistering speeds across **iron minecart tracks and wooden railway trestles**.
  - Dynamic mining obstacles: TNT barrels, narrow track switches, low rock arches, and swinging ore buckets.
- **The Waterfall Spit-Out & Final Downhill**:
  - The mine tunnel abruptly ends as the track bursts through a massive rock archway through a roaring waterfall curtain.
  - Racers drop into daylight on one final, ultra-fast downhill sprint right into the roar of the **Scrapdome Stadium Finish Line**.

---

## 2. Technical Requirements & Specifications

### 2.1 Stage 3 Track Segments (24,000m – 36,000m)
1. **The Dark Tunnel Mouth (24,000m – 25,500m)**:
   - Abrupt transition from misty waterfall daylight into deep underground cavern gloom.
   - Screen lighting shifts dynamically: dark ambient rock walls, glowing amber goblin lanterns, and fluorescent green bioluminescent cave mushrooms.
2. **Minecart Dual & Quad Rails (25,500m – 30,000m)**:
   - Track surface transforms into iron rails on wooden railway sleepers (`strip-metal.webp`, `strip-hazard.webp` from `PreGame/`).
   - Four distinct rail lanes:
     - Riding on rails gives +15% top speed boost and high steering traction.
     - Slipping between rails onto gravel causes slight friction and sparks.
   - Railroad switches: Track splits into upper and lower tunnel bypasses with high-risk shortcuts.
3. **Mining Hazards (30,000m – 32,500m)**:
   - TNT explosive crates (`PreGame/src/assets/game/crate.webp`, `skull-box.webp`): Hitting triggers an explosion impulse launching balls sideways.
   - Runaway minecarts rolling on rival lanes that must be dodged or hopped over.
4. **The Waterfall Breakthrough & Final Sprint (32,500m – 36,000m)**:
   - Track plunges down a 45° mine shoot leading toward a bright opening.
   - **The Breakthrough**: Balls punch through a translucent cascading curtain of water (triggering screen splash droplet effects and water spray audio).
   - Emerge back into bright stadium floodlights and fireworks over a massive final downhill ramp.
   - The grand Scrapdome finish banner with cheering goblin crowds, checkered flags, and fireworks.

### 2.2 Visual & Shader Upgrades (`src/game/environment.ts`, `renderer.ts`)
- **Cavern Lighting**:
  - Implement a dynamic darkness filter with radial point-light halos around each racer's ball (illuminating the iron tracks ahead).
  - Lantern posts spaced along tunnel walls with flickering golden glow.
- **Water Curtain Particle Effect**:
  - Particle splash bursting outward when balls punch through the waterfall exit into the stadium.

---

## 3. Implementation Plan
1. **Cavern & Mine Tunnel Assets**:
   - Integrate mine rail textures, lanterns, and rock cavern wall sprites into `public/art/tracks/mine/`.
2. **Engine Track Layout**:
   - In `src/game/track-layout.ts`, implement `generateMineTunnelSection(difficulty: Difficulty)`.
   - Add dynamic track surface properties (`surfaceType: 'dirt' | 'wet_wood' | 'rail_iron' | 'stone'`).
3. **Lighting & Atmosphere Transitions**:
   - In `src/game/courses.ts`, define distance-based ambient light curves ($L_{\text{sun}} \rightarrow L_{\text{cave}} \rightarrow L_{\text{stadium}}$).
4. **Finish Line Climax**:
   - Ensure `onFinish()` callback in `RaceScreen.tsx` triggers only after passing the stadium gate at the end of Stage 3.

---

## 4. Acceptance Criteria
- [ ] Seamless transition from Stage 2 waterfalls into Stage 3 underground mine tunnels.
- [ ] Riding on minecart tracks provides distinct speed and metallic roll sounds.
- [ ] Cavern features atmospheric lighting with dynamic racer headlight cones and lantern glow.
- [ ] Spectacular waterfall exit bursts balls into daylight for the final stadium sprint.
- [ ] Full 3-stage circuit is fully performant, maintaining 60+ FPS throughout.
