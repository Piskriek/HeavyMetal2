# TICKET-08: Multi-Section Track Expansion Part 1 — Vertical Pinball Drop, Pegs, Ramps, Loops & Waterfalls

- **ID**: `TICKET-08`
- **Component**: Track Design / 3D Track Layout / Physics Engine
- **Priority**: High (Phase 3 Track Expansion)
- **Status**: Ready for Implementation
- **Dependencies**: `TICKET-06`, `TICKET-07`

---

## 1. Problem Statement & User Need
The game currently terminates each track after a single 15 km straight downhill slope into a flat stadium finish line. This makes races feel short, repetitive, and unvaried. The user explicitly requested an ambitious multi-section track structure inspired by the original *Heavy Metal GP* (found in `PreGame/`):

The user requires:
- **Track Extension**: Instead of finishing after the initial downhill, the track **continues into Section 2**.
- **The Vertical Pinball Drop**:
  - The downhill ends at a dramatic cliff precipice leading into a **steep vertical drop**.
  - Filled with **pinball-style bumper pegs, wooden ramps, high-speed loops, and flaming fire boost rings**.
  - A frantic **zig-zag path cascading down alongside roaring waterfalls** (a direct 3D evolution of the classic 2D Heavy Metal GP track mechanics).
- **Leverage Free Assets from `PreGame/`**:
  - Use pinball bumpers (`PreGame/src/assets/game/bumper-spiked.webp`, `bumper-crown.webp`)
  - Use bounce springs (`PreGame/src/assets/game/spring.webp`)
  - Use skull hazard boxes and crates (`skull-box.webp`, `crate.webp`)
  - Use surface strips (`strip-metal.webp`, `strip-lava.webp`, `strip-hazard.webp`, `strip-wood.webp`).

---

## 2. Technical Requirements & Specifications

### 2.1 Multi-Section Course Architecture (`src/game/courses.ts`, `scene.ts`)
- Restructure each course into a 3-Stage Circuit:
  - **Stage 1 (0m – 12,000m)**: High-Speed Mountain Downhill (The current course layout).
  - **Stage 2 (12,000m – 24,000m)**: The Vertical Pinball Chasm & Waterfall Cascades.
  - **Stage 3 (24,000m – 36,000m)**: Subterranean Mine Tunnels & Grand Stadium Finale (Detailed in `TICKET-09`).

### 2.2 Section 2 Geometry & Feature Layout
1. **The Precipice Launch (Transition from Stage 1 to 2)**:
   - Downhill slopes down to a massive cliff lip.
   - Speed boost pads launch the four balls out into the open gorge over a roaring waterfall canyon.
2. **The Pinball Pegfield (13,000m – 16,500m)**:
   - A steep 65° plunge featuring staggered hexagonal bumper pegs:
     - `bumper-crown.webp` (Super Bumper: awards points, triggers loud bell audio, launches ball with 1.5x impulse).
     - `bumper-spiked.webp` (Spiked Bumper: repels ball with erratic side deflection).
     - `spring.webp` (Spring Launchers: vertical rebound kicking ball back up or forward into speed lanes).
   - Elastic physics collision: Matter.js restitution calculated with bouncy audio effects.
3. **The Timber Loop & Fire Rings (16,500m – 19,500m)**:
   - Full 360° vertical loop constructed from heavy timber slats.
   - Fire Boost Rings (`ring-spiked.webp`, `ring-steel.webp`) floating mid-loop; passing through grants +50 km/h hyper-speed and fire particle trails.
4. **The Waterfall Zig-Zag Cascade (19,500m – 24,000m)**:
   - Tight switchback bends hugging a massive sheer rock wall with rushing whitewater cascades on the outer edge.
   - Slippery wet wood planks (`strip-wood.webp`, `strip-moss.webp`) requiring careful steering.
   - Missing guardrails on hairpins where reckless players can fall off, suffering a recovery respawn penalty.

### 2.3 Physics & Collision Integrations (`src/game/engine.ts`)
- Extend the physics engine to handle vertical drop gravity acceleration ($g = 1.6\times$ normal down the chasm).
- Implement dynamic circular bumper collisions with recoil impulses.
- Add trigger zones for Fire Rings that grant immediate nitro acceleration and invulnerability frames.

---

## 3. Implementation Plan
1. **Asset Migration**:
   - Copy bumper, spring, crate, and strip assets from `PreGame/src/assets/game/` into `public/art/track-parts/`.
2. **Update Track Layout Generator**:
   - In `src/game/track-layout.ts`, create procedural/deterministic generation routines for the Pinball Drop and Waterfall Switchbacks.
3. **Physics Bumper Handlers**:
   - In `src/game/engine.ts`, register circular static bodies with high restitution for bumper pegs and springs.
4. **Visual Waterfall Effects**:
   - In `src/game/environment.ts`, add animated waterfall sheets with foaming water mist particles cascading behind the track.

---

## 4. Acceptance Criteria
- [ ] Track length extends seamlessly from Stage 1 downhill into Stage 2 pinball drop without loading pauses.
- [ ] Bumping into pegs, springs, and bumpers produces responsive, arcade-style pinball deflections and audio.
- [ ] Fire rings grant visible speed surges and nitro effects.
- [ ] Waterfall switchbacks challenge steering with wet surfaces and dramatic cliffside vertical drops.
- [ ] AI racers intelligently navigate bumpers, take ramps, and aim for fire rings.
