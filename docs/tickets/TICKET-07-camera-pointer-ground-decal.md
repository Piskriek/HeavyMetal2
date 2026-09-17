# TICKET-07: Dynamic Ball Camera Tracking, Off-Screen Indicator & Airborne Lane Ground Decal

- **ID**: `TICKET-07`
- **Component**: Camera / Gameplay Feedback / 3D Physics
- **Priority**: High (Phase 2 Gameplay Polish)
- **Status**: Ready for Implementation
- **Dependencies**: None

---

## 1. Problem Statement & User Need
During fast downhill racing, aerial bounces, or heavy rival side shoves, the player's ball can quickly move far off-center or even fly completely off-screen, leaving the player disoriented. Furthermore, when jumping or launching high into the air, players cannot accurately tell which track lane they are hovering over, causing unpredictable landings on hazards or missed power-ups.

The user requires:
- A **Camera Option to follow your ball** so it never goes off-screen (smooth auto-tracking camera mode).
- An **Off-Screen Pointer Indicator** that points toward the player's ball whenever it leaves the visible camera frustum, showing distance and direction.
- A **Round Ground Decal / Highlight / Shadow** projected onto the track directly beneath the ball that expands and softens as altitude increases, allowing the player to accurately judge which lane they will land in.

---

## 2. Technical Requirements & Specifications

### 2.1 Dynamic Ball Camera Tracking (`src/game/projection.ts`, `renderer.ts`)
- Add a camera mode toggle in Settings and in-race options:
  - **Fixed Course Camera**: Traditional classic view with broad overview.
  - **Dynamic Ball Chase Camera (Default/New)**:
    - Camera X smoothly follows the player ball's lane position with an exponential smoothing factor (`lerp(camX, ballX, dt * 6)`).
    - Camera Y subtly pans upward when the player launches high in the air, maintaining framing on the ball.
    - Soft boundary clamping to ensure camera doesn't expose unrendered void outside the track borders.

### 2.2 Off-Screen HUD Pointer Indicator (`src/components/RaceControls.tsx` or `renderer.ts`)
- When the player's screen coordinates fall outside the viewport ($X < 0$, $X > \text{screenWidth}$, $Y < 0$, $Y > \text{screenHeight}$):
  - Clamp an ornate directional chevron/arrow to the screen edge pointing toward the off-screen ball.
  - Display the player's miniature character portrait badge inside the arrow.
  - Display a distance readout (e.g. `+45m` or `^ AIRBORNE`).
  - Animate a pulsing glow around the arrow in the player's assigned color (Orange).

### 2.3 Airborne Ground Highlight / Decal (`src/game/renderer.ts`, `scene.ts`)
- Track the player's physics height ($Z$ / altitude above ground):
  - When $Z > 0$ (during hops, spring air bounces, ramps, loops, or free-fall drops):
    - Project an elliptical ground decal directly onto the track lane at $(X_{\text{ball}}, Y_{\text{ground\_projection}})$.
    - **Scaling Equation**:
      $$\text{Radius} = R_{\text{base}} \times \left(1 + \frac{Z}{Z_{\text{max}}} \times 1.8\right)$$
    - **Alpha / Blur Equation**:
      $$\text{Opacity} = \text{clamp}\left(0.85 - \frac{Z}{Z_{\text{max}}} \times 0.45, 0.25, 0.85\right)$$
    - Style the decal as a magical glowing rune circle (with faint goblin gear or chevron markings) and a soft ambient occlusion drop shadow.
    - Lane boundary alignment: Decal clearly illuminates the active lane boundaries so the player can maneuver with A/D in mid-air to line up their landing lane perfectly.

---

## 3. Implementation Plan
1. **Camera Tracking Logic**:
   - Update `src/game/projection.ts` to accept a `cameraTargetX` and `cameraTargetY` derived from player position.
   - Add a toggle in `src/game/preferences.ts`: `cameraMode: 'follow_ball' | 'fixed'`.
2. **Ground Decal Rendering**:
   - In `src/game/renderer.ts`, add `renderGroundShadowAndHighlight()` before drawing racer sprites.
   - Render concentric circular glow with radial gradient: golden-orange center fading into track shadow.
3. **Off-Screen Pointer Component**:
   - Calculate screen projection bounds in `src/game/engine.ts`.
   - Render HUD arrow badge when ball position is culled or out of screen bounds.

---

## 4. Acceptance Criteria
- [ ] In "Follow Ball" mode, the player's ball remains framed within the center 60% of the screen under normal physics.
- [ ] If catapulted off-screen, an ornate orange indicator arrow clearly points to the ball's location at the viewport edge.
- [ ] When airborne, an expanding ground decal accurately mirrors the ball's lane position on the track below.
- [ ] Players can steer left/right in mid-air and visually verify their landing lane before touching down.
