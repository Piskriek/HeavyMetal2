# TICKET-05: Menu Overhaul with Animated Painted Fantasy Backdrops

- **ID**: `TICKET-05`
- **Component**: UI / Environmental Art / Animation
- **Priority**: Medium (Phase 2 Presentation)
- **Status**: Ready for Implementation
- **Dependencies**: `TICKET-01`, `TICKET-04`

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
Currently, the Main Menu features an evocative concept painting (`goblin-rally-concept.png`), but once the player clicks "New Game", "Settings", or "Rules", they are presented with a dim translucent overlay on top of the same static screen (see Screenshots 1 & 3). The secondary screens lack their own sense of place, atmosphere, and visual drama.

The user requires:
- **Big painted fantasy backgrounds** for each primary menu screen in the rich Blizzard/Warcraft style.
- **Subtle ambient animations** (e.g. flickering lantern light, rising chimney smoke, glowing forge embers, drifting mountain clouds, floating dust motes) that make each menu feel alive without causing distraction or hurting performance.

---

## 2. Technical Requirements & Specifications

### 2.1 Screen-Specific Painted Backdrops (1920x1080)
1. **Main Menu**: The classic Scrapdome starting line with towering wooden loop, slingshot, cheering crowd, and distant misty alpine peaks.
2. **Competition & Track Selection**: Mountain Arena War Room / Grandstand overlook (leveraging `PreGame/assets/poster/*.png` or `PreGame/public/art/mountain-arena.png`), with battle maps, chalkboards, and panoramic vistas.
3. **Character & Ball Garage**: Goblin Engineering Armory / Workshop, filled with grinding cogwheels, hot cauldrons, iron anvils, suspended mechanical balls, and oil barrels.
4. **Settings & Controls Screen**: Tinkerer's Blueprint Desk, cluttered with calipers, brass dials, parchment schematics, and ticking pocket watches.
5. **Hall of Chaos / Trophy Podium**: Gilded Goblin Vault overflowing with gold coins, brass trophies, dented helmets, and celebratory confetti.

### 2.2 Subtle Ambient Animation Engine
- Implement low-cost, GPU-accelerated CSS and canvas ambient layers:
  - **Forge / Embers Layer**: 15–25 soft glowing orange particles drifting upwards with random oscillation.
  - **Chimney / Smog Smoke**: Smooth opacity pulsing and slow horizontal drift.
  - **Lantern / Torch Flicker**: Subtle CSS filter brightness modulation (`brightness(0.95)` to `brightness(1.05)`) on a 2-second organic loop.
  - **Parallax Mouse Tilt**: Gentle 2D camera shift ($\pm 8$ px) tied to mouse position to give a 2.5D depth feeling.
- **Accessibility & Performance Constraint**:
  - Automatically disable ambient particle movement if `prefers-reduced-motion` is detected or if "Reduced Motion" is enabled in game settings.

---

## 3. Implementation Plan
1. **Asset Creation & Integration**:
   - Save or generate 1920x1080 painted backdrops under `public/art/menus/`:
     - `menu_main.webp`
     - `menu_workshop.webp`
     - `menu_arena.webp`
     - `menu_vault.webp`
2. **Create Ambient Background Wrapper Component**:
   - Create `src/components/ui/AnimatedMenuBackground.tsx` capable of rendering the backdrop with optional particle/lighting overlay.
3. **Connect Screens to Unique Themes**:
   - Update `MainMenu.tsx`, `NewGameSetup.tsx`, `SettingsPanel.tsx`, and `RoundResult.tsx` to render their respective backdrops.

---

## 4. Acceptance Criteria
- [ ] Each major menu and setup flow displays a dedicated, high-resolution painted fantasy environment.
- [ ] Subtle ambient effects (smoke, embers, lighting flicker) run smoothly at 60 FPS without high CPU usage.
- [ ] Animations automatically pause or simplify when Reduced Motion is enabled.
- [ ] UI elements and text remain sharp, legible, and high-contrast against the atmospheric backgrounds.
