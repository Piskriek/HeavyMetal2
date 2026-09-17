# Goblin Rally: Game Direction

## Delivery Contract

This expansion is delivered in four user-approved sections. Complete one section, leave the application playable, and wait for the user to continue.

1. Foundation: researched visual direction, full-screen main menu, persistent settings, keyboard navigation, and safe new-game/menu/resume flow.
2. Race setup: Quick Race and Tournament flows, selectable riders and balls, transparent balanced stats, and race configuration.
3. Racing world: quieter dirt materials, slightly wider camera, distinct tracks, blimps, airborne pickups, and readable effects.
4. Competition: race results, tournament scoring/progression, balancing, end-to-end verification, and final polish.

Sections 1-3 are implemented: menu/settings; race modes, fixed loadouts, and cup flow; and the dirt-track world, distinct courses, blimps, and airborne supplies. Complete progression/presentation and empirical balance validation remain Section 4.

## Research And Decisions

### 1. Blizzard: Character Creation UI Redesign

Source: Jeff Liu, Senior UI Designer, World of Warcraft, October 27, 2021.
https://news.blizzard.com/en-us/article/23737992/shadowlands-an-inside-look-at-the-character-creation-ui-redesign

Findings: reduce analysis paralysis; communicate archetypes with visuals; use a vignette and hierarchy to keep attention on the character; avoid ornamental elements that compete with the focal point; allow quick comparisons between options.

Application: one primary New Game action, a short vertical menu, an illustrated world rather than a dashboard, and gold-on-dark controls. Later loadouts should show one rider/ball at a time with directly comparable attributes. Do not copy Blizzard logos, characters, or exact interface assets.

### 2. Matt McDaid: Mastering The Stylized Art

Source: 80 Level interview with a Blizzard senior 3D artist, February 23, 2017.
https://80.lv/articles/matt-mcdaid-mastering-the-stylized-art

Findings: readability depends on scale/proportion, silhouette, lighting, color, exaggeration, and composition. Consolidate high-frequency texture details into larger readable forms. Materials must harmonize with their environment.

Application: broad weathered iron shapes, restrained brass edges, warm parchment text, and a quiet dark region behind the menu. In Section 3 replace noisy planks with large dirt value masses; reserve saturation and glow for interactable race elements.

### 3. Xbox Accessibility Guideline 112: UI Navigation

Source: Microsoft Game Dev.
https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/112

Findings: predictable focus order, consistent navigation, keyboard-only paths through menus, reachable settings from initial launch, and persistent Back actions. Linear menus can wrap their navigation.

Application: arrow-key movement through the main menu; Enter/Space activation; Tab access everywhere; Escape and a visible Back button; focus trapping and restoration in dialogs. A running race is paused when opening a menu, never silently discarded.

### 4. Xbox Accessibility Guideline 102: Contrast

Source: Microsoft Game Dev.
https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/102

Findings: standard important text should target at least 4.5:1 contrast, large text at least 3:1; text should be real UI rather than embedded in background art; do not rely solely on color.

Application: real HTML labels on opaque controls, high-contrast setting, visible focus rings, text names and numbers alongside racer colors. These are design targets, not a claim of formal accessibility certification; final rendered contrast and assistive-technology behavior still require testing.

### 5. Xbox Accessibility Guideline 117: Visual Distractions

Source: Microsoft Game Dev.
https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/117

Findings: offer ways to stop ambient motion; provide controls for screen shake and distracting camera effects; respect platform preferences where possible.

Application: a menu-motion toggle, a reduced-motion setting that also affects game cosmetics, and an independent screen-shake toggle. System reduced-motion is respected. Core racing movement is not disabled.

### 6. MDN: Optimizing Canvas

Source: MDN Web Docs.
https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas

Findings: prerender repeated objects, separate static backgrounds from changing gameplay, use CSS for static background images, avoid unnecessary redraws and expensive blur/text operations.

Application: the menu is HTML/CSS over existing key art, not a second game simulation. Load the race only after New Game. Stop simulation/render scheduling when the menu obscures the race. Keep the existing prebaked racing atlas and independent fixed-step physics.

### 7. Grand Prix Structure Reference

Source: Nintendo's Spanish Mario Kart 8 Deluxe guide.
https://www.guiasnintendo.com/2c-switch/mario-kart-8-deluxe/guia-mario-kart-8-deluxe/grand-prix.html

Finding from the guide: a cup combines consecutive races and cumulative position-based points. The highest total wins even without winning every individual race.

Application for Sections 2/4: a short, explicitly described multi-race cup with visible points before starting. Use a four-racer-specific scoring system, not unexamined twelve-racer numbers. Suggested starting schedule: 9 / 6 / 3 / 1; ties resolved by wins, then final-race placement. These numbers are a design proposal, not validated balance.

Section 2 implements that initial schedule over the three existing tracks. See `docs/LOADOUT_BALANCE.md` for its DNF rule, finish window, and current verification limits.

## Game Pillars

- Read the race: the player, lane boundaries, next hazard, and reachable pickup are recognizable before additional spectacle is added.
- Make contact matter: a bump has an understandable direction, brief feedback, bounded control loss, and a recoverable consequence.
- Pick a personality, not a superior option: each loadout trades a strength for a weakness; no single rider/ball dominates every track.
- Keep races fair: opponents use shared physics and resources. No hidden teleport catch-up or leader speed penalty.
- Stay quick to play: no required account, no forced tutorial, no nested confirmation maze, and no essential action hidden in tiny text.
- Protect frame pacing: new scenery reuses sprites/atlases, effects have budgets, and menus never keep the race running behind them.

## Visual System

Palette: charcoal iron, deep forest teal, aged brass, warm parchment, and a restrained crimson primary action. Existing original goblin key art remains the environment anchor.

Display type: a readable engraved-fantasy serif for identity and menu headings. Body type: a clean sans serif. Small technical labels are not used for essential instructions.

Controls: large beveled rectangles with clear selected/focused states and generous hit areas. Ornament stays at edges and separators. Avoid pill clusters, dashboard cards, or marketing statistics in the main-menu composition.

Motion: short menu entrance, a slow optional background drift, and deliberate button feedback. No continuous CPU-heavy menu canvas.

## Balance Plan For Later Sections

Candidate rider roles: balanced mechanic, nimble daredevil, heavy bruiser. Candidate capsule roles: all-round iron, light springsteel, heavy siege shell. Show acceleration, handling, weight, and hop/boost response on a common scale. Keep the currently exposed physics sliders in a clearly marked custom/practice mode once competitive presets are introduced.

Section 2 realizes these roles plus a boost-oriented rocket jockey. The 12 combinations use a common 24-point budget and share their displayed/computed physics values. Equal budgets are a useful baseline, not evidence of equal win rates.

Air pickups should create lane/jump decisions rather than random unavoidable punishment. Start with a readable boost refill, a short shield, and an air-hop recharge; explain duration and effect. Blimps are scenery, not invisible collision hazards.

Section 3 implements these as Rocket Fuel, Skyward Shield, and Air Spring, with shared first-touch collection rules and visible caps/timers. Course-specific art, layout, and elevation live in shared data rather than background-only switches. See `docs/WORLD_AND_POWERUPS.md`.

## Verification Gates

- Each visible control performs its advertised action; no fake online, locked, or upcoming buttons masquerading as working modes.
- Menu, settings, new race, pause, main menu, and resume work with keyboard and touch.
- Settings persist, invalid storage falls back safely, and reset does not delete race records.
- A menu never consumes race time or starts an unseen CPU run.
- Existing race controls and the production build remain functional after every section.
- Future balance claims require measured race samples across all loadouts, tracks, and CPU settings.
- Live browser/device testing must be reported separately from successful compilation.