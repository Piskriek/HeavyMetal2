# TICKET-02: UI Decluttering, Visual Gauges & Hierarchical Drill-Downs

- **ID**: `TICKET-02`
- **Component**: UI / UX / Information Architecture
- **Priority**: High (Phase 1 Foundation)
- **Status**: Implemented (branch `arena/01a0b433-heavymetal2`; see `docs/EXPANSION_PROGRESS.md` → TICKET-02)
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
As shown in Screenshots 3, 4, and 5, the interface is currently overwhelmed by paragraphs of tiny flavor text and cluttered metadata:
- **Setup Screen (Screenshot 3)**: Has walls of text ("A LITTLE OF EVERYTHING", "Steady hands. A suspiciously dependable set of tools...", "24-point budget...", "Good at: ...", "The catch: ...").
- **Start Grid & In-Race HUD (Screenshots 4 & 5)**: Shows redundant banners ("YOUR BALL. THEIR PROBLEM.", "4 GOBLINS / 15 KM DOWNHILL 02", "Looking gloriously irresponsible. 35% downhill...", "THROTTLE REFILLED. TRY NOT TO SHARE."), plus excessive static labels taking up over 35% of the screen height.

The user requires:
- **Declutter the game**: Eliminate tiny text walls, non-essential commentary, and visual clutter.
- **Use gauges and icons**: Replace text statistics with intuitive circular or arc gauges and glyphs.
- **Hierarchical drill-downs**: Move deep explanations, lore, and secondary formulas into collapsible info drawers or popover modals accessed via clean "More Info" / "?" buttons.

---

## 2. Technical Requirements & Specifications

### 2.1 Visual Gauges for Rider & Vehicle Attributes
- In `NewGameSetup.tsx` and the in-race HUD:
  - Replace raw text metrics ("Launch speed 160 km/h", "Race weight 120 kg", "Boost impulse +69 km/h") with **tactile visual gauges** (circular tachometer-style dials or Blizzard-style engraved progress meters).
  - Four Core Gauges:
    1. **Launch Power** (Explosive start acceleration)
    2. **Handling / Traction** (Lane-switching responsiveness and drift recovery)
    3. **Boost Velocity** (Nitro/Rocket top speed and burst multiplier)
    4. **Stability / Mass** (Bumping weight and collision deflection resistance)
  - Color-code gauge fills with warm molten orange/gold gradients and embossed metal needles/brackets.

### 2.2 In-Race HUD Decluttering (`RaceScreen.tsx`, `RaceControls.tsx`)
- **Remove during race**:
  - Remove the bottom multi-line flavor text ("Looking gloriously irresponsible...").
  - Remove verbose starting pack distance delta text.
  - Consolidate top title bars (`GOBLIN RALLY / MAIN MENU / THE WORKSHOP...`) into a compact, auto-hiding top-left gear icon.
- **Retain & Elevate Primary Racing Telemetry**:
  - **Speedometer**: Prominent circular analog/digital speedometer gauge in the top-right corner.
  - **Mini Track Bar**: Slim progress rail showing player ball and rival pips with distance remaining.
  - **Position Medallion**: Ornate 1st/2nd/3rd/4th place medallion (gold/silver/bronze/iron).
  - **Air Supply Icons**: Clean, compact icon counter in bottom corner showing collected Rocket / Shield / Spring charges.

### 2.3 Hierarchical Information Drill-Down
- Add an ornate `[i]` (Info) or `[Details]` button on setup cards:
  - Clicking opens an optional flyout drawer or tooltip with stat balance breakdowns, lore snippets, and physics math.
  - Default view remains clean, punchy, and focused on immediate decision-making.

---

## 3. Implementation Plan
1. **Create Gauge Component**:
   - Create `src/components/ui/BlizzardGauge.tsx` supporting circular arc and horizontal meter modes with needle or animated fill.
2. **Refactor `NewGameSetup.tsx`**:
   - Strip out redundant paragraphs and bullet points.
   - Replace linear text stats with `BlizzardGauge`.
   - Add a collapsible `<Drawer title="Tuning Details">` for in-depth specs.
3. **Streamline `RaceScreen.tsx` & `RaceControls.tsx`**:
   - Condense HUD overlays to minimize screen obstruction.
   - Hide tutorial copy once a race has launched.

---

## 4. Acceptance Criteria
- [ ] Screen real estate occupied by UI during racing reduced by at least 40%, maximizing visibility of the 3D track.
- [ ] No tiny low-contrast paragraph text during active gameplay.
- [ ] Rider/capsule stats visually communicated via gauges that update smoothly upon selection.
- [ ] Deep technical/lore descriptions accessible on demand via a clean info trigger without cluttering the primary flow.
