# Heavy Metal GP 2: Master Epic & Ticket Tracker

Welcome to the comprehensive ticket tracker for **Heavy Metal GP 2 (Goblin Rally)**. This ticket backlog directly addresses the user's feedback, transforming the game from a flat prototype into a tactile, exciting, Blizzard/Warcraft-inspired fantasy racer.

---

## Ticket Overview & Execution Matrix

| Ticket ID | Title | Priority | Area | Dependencies | Status |
| :--- | :--- | :---: | :--- | :--- | :---: |
| [`TICKET-01`](file:///c:/MarbleGp/docs/tickets/TICKET-01-warcraft-ornate-ui-borders.md) | Blizzard/Warcraft Ornate UI Frame & Border System | **P1** | UI / Styling / 9-Slice | None | Ready |
| [`TICKET-02`](file:///c:/MarbleGp/docs/tickets/TICKET-02-ui-declutter-gauges-drawers.md) | UI Decluttering, Visual Gauges & Hierarchical Drill-Downs | **P1** | UI / UX / Gauges | `TICKET-01` | Ready |
| [`TICKET-03`](file:///c:/MarbleGp/docs/tickets/TICKET-03-custom-controls-loading-screen.md) | Customizable Controls & Loading Screen Controls Visualizer | **P1** | Settings / Input / Loading | `TICKET-01` | Ready |
| [`TICKET-04`](file:///c:/MarbleGp/docs/tickets/TICKET-04-character-ball-selection-full-body.md) | Character & Ball Selection Redesign (Full-Body Goblin + Ball Renders) | **P1** | Character Art / 2D Presentation | `TICKET-01`, `TICKET-02` | Ready |
| [`TICKET-05`](file:///c:/MarbleGp/docs/tickets/TICKET-05-menu-animated-backgrounds.md) | Menu Overhaul with Animated Painted Fantasy Backdrops | **P2** | Environmental Art / Menus | `TICKET-01`, `TICKET-04` | Ready |
| [`TICKET-06`](file:///c:/MarbleGp/docs/tickets/TICKET-06-track-backgrounds-lighting-preloading.md) | Epic Blizzard Track Backdrops, Thematic Lighting & Asset Preloading | **P1** | Environment / Asset Pipeline | `TICKET-05` | Ready |
| [`TICKET-07`](file:///c:/MarbleGp/docs/tickets/TICKET-07-camera-tracking-pointer-ground-decal.md) | Dynamic Ball Camera Tracking, Off-Screen Indicator & Airborne Lane Ground Decal | **P1** | Camera / Physics / HUD Feedback | None | Ready |
| [`TICKET-08`](file:///c:/MarbleGp/docs/tickets/TICKET-08-track-section2-vertical-pinball-drop.md) | Multi-Section Track Expansion Part 1: Vertical Pinball Drop, Pegs & Waterfalls | **P1** | Track Design / Physics / Bumpers | `TICKET-06`, `TICKET-07` | Ready |
| [`TICKET-09`](file:///c:/MarbleGp/docs/tickets/TICKET-09-track-section3-mine-tunnels-waterfall-finish.md) | Multi-Section Track Expansion Part 2: Mine Tunnels, Rails & Stadium Finale | **P1** | Track Design / Subterranean | `TICKET-08` | Ready |

---

## Recommended Execution Roadmap for Codex Agents

### Phase 1: Core Presentation & Polish (Tickets 01, 02, 03, 04)
1. **Implement `TICKET-01`**: Establish the 9-slice Blizzard border system using `PreGame/assets/ui/` assets.
2. **Implement `TICKET-02`**: Strip text clutter, build animated circular/arc stat gauges, and hide secondary lore in flyout drawers.
3. **Implement `TICKET-03`**: Add the Controls customization tab in Settings and build the loading screen diagram.
4. **Implement `TICKET-04`**: Replace the broken "cockpit hole" composite with full-body hero goblin renders standing beside standalone glossy balls.

### Phase 2: Atmosphere, Camera & Quality of Life (Tickets 05, 06, 07)
5. **Implement `TICKET-05`**: Add high-res painted menu backgrounds with subtle embers/smoke/lantern flicker.
6. **Implement `TICKET-06`**: Composite multi-layer painted track skyboxes, configure per-course lighting, and build async asset preloader.
7. **Implement `TICKET-07`**: Implement follow-ball camera tracking, off-screen indicator arrows, and airborne expanding lane ground decal.

### Phase 3: The Grand Track Expansion (Tickets 08, 09)
8. **Implement `TICKET-08`**: Build Section 2 (the Vertical Pinball Drop with pegs, springs, ramps, loops, and waterfall zig-zags).
9. **Implement `TICKET-09`**: Build Section 3 (the Subterranean Mine Tunnels with minecart rails, lantern lighting, and waterfall breakthrough into the final stadium sprint).

---

## Important Guidelines for Codex Agents
- **Asset Re-use**: You are strongly encouraged to use existing high-quality assets in [`PreGame/`](file:///c:/MarbleGp/PreGame) (`ball-*.webp`, `bumper-*.webp`, `spring.webp`, `strip-*.webp`, `uikit.png`, `repeatingBG.png`).
- **Image Generation Quota**: When generating new assets, you are limited to 10 image generation calls per turn. To reset the quota, say **"Reset please"** and stop working; you will receive a confirmation to continue with 10 more calls.
- **Transparency**: When generating sheets or cutting assets, use `#00FF00` (or magenta `#FF00FF` / true PNG alpha) with clean despill filters in `scripts/build-art.mjs`. Never stretch border images!
