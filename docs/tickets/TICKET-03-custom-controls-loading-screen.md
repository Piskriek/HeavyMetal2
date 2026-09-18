# TICKET-03: Customizable Controls & Loading Screen Controls Visualizer

- **ID**: `TICKET-03`
- **Component**: Settings / Input / UX
- **Priority**: High (Phase 1 Foundation)
- **Status**: Ready for Implementation
- **Dependencies**: `TICKET-01`

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
Players currently have hard-coded key bindings (A/D for steering, W/J for hops, Space for bounce, Shift for boost). There is no way in the Settings panel to view or customize these keys, which limits accessibility, ergonomics, and support for alternative layouts (such as arrow keys, ESDF, or gamepad controllers). Furthermore, new players enter the starting grid without a dedicated controls introduction during track loading.

The user requires:
- A **Controls button** in the Settings panel allowing full customization of game controls.
- An **informative loading screen** displaying current mapped controls and visual controller/keyboard glyphs while the race assets and track load.

---

## 2. Technical Requirements & Specifications

### 2.1 Customizable Controls Architecture
- Configurable Key Action Bindings:
  1. `Steer Left` (Default: `KeyA` / `ArrowLeft`)
  2. `Steer Right` (Default: `KeyD` / `ArrowRight`)
  3. `Hop / Jump` (Default: `KeyW` / `KeyJ` / `ArrowUp`)
  4. `Air Bounce` (Default: `Space`)
  5. `Turbo Boost` (Default: `ShiftLeft` / `ShiftRight`)
  6. `Pause Game` (Default: `KeyP` / `Escape`)
- **Key Listening & Conflict Detection**:
  - Modal or inline key capture listening for `keydown` events.
  - Detect duplicate/conflicting key assignments and highlight them in crimson.
  - "Reset to Defaults" button.
- **Persistence**:
  - Store bindings in `localStorage` under `goblin-rally-keybindings-v1`.
  - Provide fallback defaults if storage is unavailable or corrupt.

### 2.2 Settings Panel Integration (`SettingsPanel.tsx`)
- Add a dedicated **"Controls"** tab or prominent button in the Settings dialog alongside Display and Audio.
- Render an interactive keybinding table styled in forged iron frames:
  - Action name
  - Primary key pill button (clickable to rebind)
  - Secondary / alternate key pill button.

### 2.3 Loading Screen Controls Visualizer (`RaceScreen.tsx`)
- Introduce a pre-race loading overlay prior to the starting grid countdown:
  - Leverage `PreGame/src/assets/bg/loading-wide.webp` or `loading-tall.webp` as the atmospheric backdrop.
  - Display a clean graphic showing a keyboard / gamepad diagram highlighting the player's active bindings:
    - `[A] / [D]` $\rightarrow$ Switch Lanes / Shoulder Rivals
    - `[W]` $\rightarrow$ Bunny Hop Ground Obstacles
    - `[SPACE]` $\rightarrow$ Air Bounce off Springs
    - `[SHIFT]` $\rightarrow$ Turbo Nitro Boost
  - Display helpful gameplay tips ("Bumping rivals at high speeds deflects them off-course", "Air springs provide extra aerial hang time").
  - Dismiss automatically once assets are decoded or with a "Press Any Key / Click to Enter Grid" prompt.

---

## 3. Implementation Plan
1. **Input System Refactoring**:
   - Create `src/game/controls.ts` managing user key bindings, event listeners, and mapping lookup.
   - Update `src/screens/RaceScreen.tsx` and `src/game/engine.ts` to query `controls.ts` rather than hard-coded `e.code === 'KeyA'`.
2. **Controls Settings UI**:
   - Create `src/components/ControlsSettings.tsx` to handle key binding capture and storage.
   - Add "Controls" tab to `SettingsPanel.tsx`.
3. **Loading Screen Component**:
   - Create `src/components/RaceLoadingScreen.tsx` rendering the Blizzard-style backdrop, mapped keys diagram, and loading progress bar.

---

## 4. Acceptance Criteria
- [ ] Users can remap all primary racing controls to arbitrary keyboard keys.
- [ ] Custom controls persist across page reloads in `localStorage`.
- [ ] Invalid/duplicate key assignments are prevented or visibly flagged.
- [ ] Loading screen renders mapped keys clearly before entering the starting grid.
- [ ] Controls screen is fully keyboard navigable and accessible.
