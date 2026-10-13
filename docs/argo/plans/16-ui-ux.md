# 16 — UI, UX & HUD Architecture Plan: Zero-Overlap Telemetry and Non-Blocking Craftsmanship

## 1. The Goal: A Diegetic-First Telemetry HUD Where Two Text Elements Never Collide

Look at [`07-moon-stage0.jpg`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/07-moon-stage0.jpg) and [`09-build-menu.jpg`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/09-build-menu.jpg) in [`docs/argo/TOUR.md`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/TOUR.md): right now, the UI is the single most visible source of prototype friction. On Moon arrival, **three separate text layers overlap in the center of the screen** (the big location title, the `"CANNOT PLACE"` build readout, and Dr. Haddy's radio subtitle). When pressing `B` to build ([`09-build-menu.jpg`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/09-build-menu.jpg)), a giant dark modal covers the entire center viewport so you cannot see the foundation ghost you are trying to place. And the Main Menu ([`01-main-menu.jpg`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/01-main-menu.jpg)) is a plain vertical list of text over a dark background.

Our goal is to enforce a **strict 9-zone spatial HUD grid with priority queuing** in [`apps/web/src/shell/hud.tsx`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/apps/web/src/shell/hud.tsx), convert the Build Menu into a **compact bottom-docked ribbon (`< 22%` screen height)** so the center 78% of the 3D world remains unobstructed during placement, and turn the Main Menu into the live 3D Lab + glitching window showcase promised in [`04-menu-setmix.png`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/concept/setmix/04-menu-setmix.png) and `POL-01`.

## 2. Where It Stands Today

- **What Exists:**
  - [`docs/UI_DESIGN_SYSTEM_AND_TOKENS.md`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/UI_DESIGN_SYSTEM_AND_TOKENS.md), [`packages/ui/`](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/packages/ui), [`packages/uistack/`](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/packages/uistack), [`packages/hudlayout/`](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/packages/hudlayout), and [`apps/web/src/shell/hud.tsx`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/apps/web/src/shell/hud.tsx) establish the Oxanium/Inter typography, glassmorphic dark panels, and glowing metric tokens (`#ff3d8a`, `#7cff4d`, `#ffc13d`, `#3dc8ff`, `#b46bff`).
  - [`docs/HOTBAR_V3_SPEC.md`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/HOTBAR_V3_SPEC.md) defines the 10-slot hotbar and `F1–F10` mode tabs.
- **What Is Weak or Missing:**
  - **Center-Screen Collision (`07-moon-stage0.jpg`):** Location banners, build-ghost status labels, and subtitles all anchor near `top: 50%–75%` without a shared layout manager (`@hm/hudlayout` is not enforcing mutual exclusion across React overlays).
  - **Viewport-Blocking Build Menu (`09-build-menu.jpg`):** Opening `B` spawns a large centered modal over the crosshair.
  - **Cluttered 3D World Labels (`08-first-machine.jpg`):** Floating 3D text tags over placed machines render at full opacity regardless of distance or camera aim, cluttering the horizon.
  - **Flat Main Menu (`01-main-menu.jpg`):** Missing the live 3D Lab backdrop, the desolate glitching window vista (`POL-01`), and the active plot portal preview ([`04-menu-setmix.png`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/concept/setmix/04-menu-setmix.png)).
  - **Generic Inventory (`11-inventory.jpg`):** Works functionally, but lacks a visual 3D/silhouette Scientist rig preview showing suit visor tint, slotted cartridges, and linked `@hm/lattice` depot totals.

## 3. What the Best Games Do (Research & Sources)

| Reference Game | UI / UX Architecture | Player Praise & Design Lesson |
| :--- | :--- | :--- |
| [***Dead Space***](https://deadspace.fandom.com/wiki/Resource_Integration_Gear) | **Diegetic Rig & Weapon Displays + Uncluttered Center Reticle:** Health, energy, and ammo live on the character's suit spine and weapon rear housing (`RIG`), keeping the center 60% of the screen completely clear of floating text ([Dead Space UI Analysis](https://medium.com/@lorenzoardeni/dead-space-the-ui-art-that-disappears-in-the-game-world-289718133c29)). | Move Beam Tool mode (`Extract / Apply / Sculpt / Seal`) and charge readout onto a crisp diegetic OLED strip on the rear of the rifle viewmodel + a minimal 4-dot reticle arc, eliminating redundant center-screen text. |
| [***Satisfactory 1.0***](https://www.youtube.com/watch?v=oPsb7OFp1gg) | **Compact Build Drawer + Hologram Lock (`H`) + Nudge (`Arrow Keys`) + Linked Depot Bar:** Pressing `B` opens a quick-select bar/drawer that immediately closes on selection; while aiming a build ghost, a small bottom-right keybind pill shows `H: Lock Hologram`, `R: Rotate`, and pulls materials from both pockets and the [Dimensional Depot](https://www.youtube.com/watch?v=oPsb7OFp1gg). | Directly solves [`09-build-menu.jpg`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/09-build-menu.jpg): selecting a piece or pressing `B` must keep the center viewport 100% open so the player can see the 3D hologram snap onto sockets. |
| [***Subnautica***](https://store.steampowered.com/app/264710/Subnautica/) & [***The Planet Crafter***](https:// planet-crafter.fandom.com/wiki/Terraformation_Index) | **Corner-Pinned Terraformation Telemetry & Raycast-Only World Labels:** Global metrics (`Ti` / `Fi`) sit cleanly in the top-right corner; machine status readouts in the 3D world only appear when the player's crosshair raycasts within `6°` of the machine within `12 m`. | Eliminates the floating text soup in [`08-first-machine.jpg`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/08-first-machine.jpg). |

## 4. Concrete Changes Ranked P0, P1, and P2

### Canonical 9-Zone Non-Overlapping HUD Grid (`apps/web/src/shell/hud.tsx`)

| Screen Zone | Reserved Coordinates | Assigned Widget (Strict Single-Owner Rule) | Collision / Queue Rule |
| :--- | :--- | :--- | :--- |
| **Top-Left** | `top: 24px, left: 24px` (`max-width: 340px`) | **Dr. Haddy Radio Portrait & Active Quest Step** (`1–2` plain sentences + key hint pill). | Portrait slides in only during active VO or quest step update. |
| **Top-Center** | `top: 20px, center` (`height: 44px`) | **Compass Ribbon & Coherence Safe-Dome Indicator** (shows Gate beacon bearing, Leak bearings, and `SYNC: STABLE / DRAINING`). | Act/Stage Milestone Title Cards (`STAGE 1 REACHED`) drop down at `top: 72px` for `3.0 s` and **suppress** any secondary banner while visible. |
| **Top-Right** | `top: 24px, right: 24px` (`width: 240px`) | **The 4-Float Fidelity Telemetry Pill (`S = Pxd, Vtx, Lx, Aq`)** + Current Stage Badge (`S0`–`S4`) + Profile Chip (on Menu). | Compact 4-bar sparkline using canonical colors (`#ff3d8a`, `#7cff4d`, `#ffc13d`, `#3dc8ff`). |
| **Center Crosshair** | `50% x, 50% y` (`radius: 48px` clear zone) | **Minimal Reticle + Contextual Raycast Prompt (`[E] Salvage Monitor` / `CANNOT PLACE: Needs Flat Ground`)**. | **Hard Rule:** `"CANNOT PLACE"` only renders when `buildGhostActive === true`, positioned `36px` below the reticle—never overlapping bottom subtitles. |
| **Bottom-Center (Upper)** | `bottom: 108px, center` (`max-width: 680px`) | **Radio Subtitle Banner** (single dark-glass pill with `2px` left amber border). | Never rises above `bottom: 160px`, guaranteeing at least `180px` vertical clearance from the center crosshair. |
| **Bottom-Center (Lower)** | `bottom: 20px, center` | **10-Slot Hotbar (`1–0`) + Build Ribbon Drawer (`B`)** (`docs/HOTBAR_V3_SPEC.md`). | When `B` is pressed, a sleek horizontal category dock (`Machines | Structures | Heavy | Plans`) rises `88px` above the hotbar (`bottom: 92px`), leaving the top 78% of the screen completely clear! |
| **Bottom-Left** | `bottom: 24px, left: 24px` | **Suit Coherence Gauge & Stamina/Jet Bar** (or **Rover Speed/Drift Telemetry** when driving). | Hides automatically at 100% Coherence inside the Lab or Gate Safe Dome to keep the screen clean. |
| **Bottom-Right** | `bottom: 24px, right: 24px` | **Active Tool / Cartridge Readout + Linked Lattice Resource Ticker** (`Dirt | Ore | Power kW`). | Shows both Pocket count and `+Linked Bin` count (`Ore: 24 (+140)`). |

### P0 — Must Fix Before First Public Test

1. **P0-UI-01: Enforce the 9-Zone HUD Layout & Eliminate the 3-Way Overlap in `07-moon-stage0.jpg`**
   - **What to build:** Refactor [`apps/web/src/shell/hud.tsx`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/apps/web/src/shell/hud.tsx) and wire [`packages/hudlayout/`](https://github.com/Piskriek/HeavyMetal2/tree/feat/monster-mash-exploration/packages/hudlayout) so every overlay mounts into its dedicated grid slot above. Specifically:
     - Gate `"CANNOT PLACE"` strictly on `isPlacingStructure && !canPlace`.
     - Pin Radio Subtitles to `bottom: 108px` (`z-index: 20`).
     - Queue Act/Location Title Cards (`top: 72px`) so they fade out (`2.5 s`) before non-critical tutorial hints appear.
   - **Needs:** **Code** (`apps/web/src/shell/hud.tsx`, `packages/hudlayout/`).

2. **P0-UI-02: Convert the Build Menu (`B`) from a Center-Screen Blocker into a Bottom-Docked Ribbon (`09-build-menu.jpg` Fix)**
   - **What to build:** Replace the full-screen modal in [`09-build-menu.jpg`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/09-build-menu.jpg) with a bottom-docked glassmorphic drawer (`bottom: 92px`, `height: 136px`, `max-width: 820px`) displaying crisp 3D/icon cards for `Machines`, `Structures`, `Heavy`, and `Plans`, plus a live keybind strip (`[R] Rotate 45°`, `[H] Lock Ghost & Nudge`, `[F] Demolish 100% Refund`, `[RMB/Esc] Cancel`). Clicking a card immediately collapses the drawer to a minimal header pill so the player has an unobstructed view of the 3D placement ghost.
   - **Needs:** **Code** (`apps/web/src/base/`, `apps/web/src/shell/hud.tsx`).

3. **P0-UI-03: Cull Floating 3D Machine Labels to Crosshair Raycast + Proximity (`08-first-machine.jpg` Fix)**
   - **What to build:** In [`apps/web/src/crafter/world.ts`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/apps/web/src/crafter/world.ts) and [`apps/web/src/base/view.ts`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/apps/web/src/base/view.ts), hide all floating 3D machine text billboards unless the player is within `14 m` **and** aiming within `8°` of the machine (or holding `Alt` for `"Tactical Telemetry View"`). When not aimed at, a machine's state is communicated purely by its physical LED (`Green = Running`, `Amber Blink = Brownout/No Ore`, `Red = Unpowered`) and its pixel plume!
   - **Needs:** **Code** (`apps/web/src/base/view.ts`, `apps/web/src/crafter/world.ts`).

### P1 — Makes It Feel AAA

4. **P1-UI-04: Upgrade the Main Menu to the Live 3D Lab + Glitching Window & Active Gate Backdrop (`01-main-menu.jpg` & `POL-01`)**
   - **What to build:** Replace the dark static menu backdrop in [`01-main-menu.jpg`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/01-main-menu.jpg) with the live camera composition from [`04-menu-setmix.png`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/concept/setmix/04-menu-setmix.png):
     - Left third: Sleek angled glassmorphic menu blade (`Expedition`, `Planetary Grid`, `The Studio`, `The Workshop`, `Community Nexus`, `Settings`) with clean engineering copy (replace `"Growing the trees"` during preload with real subsystem stages: `"Compiling S-Space Shaders..."`, `"Syncing Lunar Lattice..."`, `"Calibrating Bridge Array..."` per Rule 22).
     - Center-Left Window: Shows the desolate 3D Bridge Array wasteland actively glitching (`POL-01`).
     - Right Third Freestanding Gate: Renders a live stencil preview of the active profile's plot (or a hero Stage 4 preview if hovering over `Planetary Grid`).
   - **Needs:** **Code** (`apps/web/src/shell/`, `apps/web/src/lab/lab-scene.ts`).

5. **P1-UI-05: Upgrade the Inventory & Suit Rig Screen (`11-inventory.jpg`) with Visor Customizer & Linked Depot View**
   - **What to build:** In [`11-inventory.jpg`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/argo/tour/11-inventory.jpg), add a live interactive 3D preview of the Scientist hazmat avatar in the left pane (with the owner-approved **Name + Visor Color Picker** and `.glb`/`.vrm` custom avatar dropzone from `OWNER_ASKS.md` 2026-10-07), a dedicated **Cartridge Bandolier** section in the middle pane (color-coded by `#ff3d8a` / `#7cff4d` / `#ffc13d` / `#3dc8ff` / `#b46bff`), and a **Linked Lattice Depot (`@hm/lattice`)** summary on the right.
   - **Needs:** **Code** (`apps/web/src/shell/`, `apps/web/src/avatar/`).

### P2 — Stretch Goals

6. **P2-UI-06: Hologram Lock (`H`) & Arrow-Key Nudge Mode During Base Building**
   - **What to build:** Adopting the most praised UX feature from [*Satisfactory 1.0*](https://www.youtube.com/watch?v=oPsb7OFp1gg) (`docs/BASE_BUILDING_RESEARCH.md` `R5`), pressing `H` while aiming a foundation or machine ghost freezes the hologram in world space so the player can walk around it to inspect socket alignment and use the arrow keys to nudge it by `0.5 m` steps before left-clicking to commit.
   - **Needs:** **Code** (`packages/structure/`, `apps/web/src/base/`).

## 5. Rules Touched (`docs/argo/RULES.md`)

- **Rule 22 (Loading bars):** Preload screen uses real subsystem progress bars with clean technical telemetry copy.
- **Rule 24 (UI quality):** Strictly uses the Oxanium/Inter glassmorphic telemetry design system from [`docs/UI_DESIGN_SYSTEM_AND_TOKENS.md`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/UI_DESIGN_SYSTEM_AND_TOKENS.md), with zero bare DOM and clean screenshot mode toggle (`F12` / automated test flag hides pointer-lock overlays).

## 6. Owner Decisions Needed

1. **Main Menu Gate Preview (`04-menu-setmix.png` vs. `POL-01`):**
   - *Question:* On the Main Menu ([`04-menu-setmix.png`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/concept/setmix/04-menu-setmix.png)), the left window shows the desolate glitching Bridge wasteland (`POL-01`). For the freestanding Gate on the right side of the Main Menu, should it show **the player's current save plot stage** (e.g., off/dark if they haven't started Act I yet, Stage 1 if their save is at Stage 1, Stage 4 if they reached Stage 4), or should the Main Menu Gate always preview a **lush Stage 4 hero vista** to inspire new players?
   - *Recommendation:* Show the **lush Stage 4 hero vista on the Main Menu** (exactly as you specified on 2026-10-06 18:40 in [`docs/OWNER_ASKS.md`](https://github.com/Piskriek/HeavyMetal2/blob/feat/monster-mash-exploration/docs/OWNER_ASKS.md): *"a gateway on the right showing the planet in all its glory after terraforming"*), and then when they click **Play / New Expedition**, they wake in the dark power-starved Lab with the Gate off!
