# TICKET-04: Character & Ball Selection Redesign (Full-Body Goblin + Standalone Ball Renders)

- **ID**: `TICKET-04`
- **Component**: UI / 2D Art / Character Rendering
- **Priority**: High (Phase 1 Art & Presentation)
- **Status**: Ready for Implementation
- **Dependencies**: `TICKET-01`, `TICKET-02`

---

## 1. Problem Statement & User Need
In the previous implementation (see Screenshot 3), the selection screen attempted to paste a tiny cropped goblin face through an awkward circular hatch cut into the ball capsule. The result was described by the user as a "broken inside looking out attempt" where the pilot looks clipped, disproportionate, and unexciting.

The user requires:
- **Complete redesign of the Character & Ball Select Screen**:
  - Replace the broken "cockpit hole" composite with a **heroic full-body (or 3/4 torso) goblin render standing proudly beside the ball of their choice**.
  - High-quality, standalone **Ball PNGs** with rich specular lighting, metallic seams, spikes, rivets, and magical effects.
  - Distinct character personalities: Rivet (aviator wrench mechanic), Nix (sneering daredevil), Grub (armored brute), Sprocket (crazy pyrotechnic tinkerer).

---

## 2. Technical Requirements & Specifications

### 2.1 Full-Body / Heroic Goblin Character Assets
- Source / generate full-body goblin illustrations in the Blizzard/Warcraft painted fantasy style:
  - **Rivet**: Practical leather flight suit, bronze goggles on forehead, massive wrench in hand, confident mechanic stance.
  - **Nix**: Sleek rogue leather, purple scarf fluttering, asymmetric grin, throwing daggers or oil canisters.
  - **Grub**: Heavy cast-iron shoulder pads, horned battered helm, massive jaw, burly stance leaning on the ball.
  - **Sprocket**: Copper goggles, smoking rocket pack or spark-spewing wrench, manic expression.
- Assets must be rendered as clean alpha PNGs (512x768 px) with zero green/magenta matte fringing.
- Can leverage portraits and character models from `PreGame/assets/portraits/` and generate full-body variants using the standard prompt template.

### 2.2 Standalone Ball Renders
- Disentangle balls from the rider art entirely. The ball is an independent mechanical powerhouse:
  - Leverage the rich high-res ball assets available in `PreGame/src/assets/game/`:
    - `ball-steel.webp` / `ball-spiked.webp` (Heavy armored Siegebreaker)
    - `ball-bronze.webp` / `ball-gold.webp` (Classic riveted Rustbucket)
    - `ball-cyan.webp` / `ball-blue.webp` (Aerodynamic Springsteel)
    - Bonus unlockable skins: `ball-lava.webp`, `ball-galaxy.webp`, `ball-red.webp`, `ball-green.webp`.
  - Render balls with dynamic drop shadows on the selection pedestal and subtle ambient rotation or gleaming highlight sweep.

### 2.3 Redesigned Selection Screen Stage (`NewGameSetup.tsx`)
- **Stage Layout**:
  - Center Stage: A lighted stone/brass pedestal featuring:
    - Left side: Full-body Goblin racer in an idle stance.
    - Right side: The selected high-gloss Ball with ground shadow and reflection.
  - Left Selection Deck: 4 Rider cards with portrait icons, names, and class tags (e.g. *The Mechanic*, *The Daredevil*).
  - Bottom Selection Deck: Horizontal carousel/grid of Ball choices with metallic previews.
  - Right Stat Deck: The visual Blizzard gauges implemented in `TICKET-02` (Launch, Handling, Boost, Stability) that animate smoothly as riders and balls are clicked.
- Immediate responsive updates: Selecting a new rider swaps the character figure; selecting a new ball swaps the ball render.

---

## 3. Implementation Plan
1. **Asset Pipeline & Generation**:
   - Extract or generate four clean full-body goblin character renders into `public/art/riders/fullbody/` (`rivet_full.png`, `nix_full.png`, `grub_full.png`, `sprocket_full.png`).
   - Copy or symlink high-res ball renders from `PreGame/src/assets/game/ball-*.webp` into `public/art/balls/`.
2. **Refactor Selection Component**:
   - Replace `<CapsulePreview>` in `src/components/NewGameSetup.tsx` with a new `<CharacterShowcase rider={rider} ball={ball} />` component.
   - Remove obsolete hatch measurement and clipping logic (`measureHatch()`, `assertHatch()`) from `scripts/build-art.mjs` and `loadout-art.ts`.
3. **In-Race Ball Representation**:
   - In actual racing, the ball rolls cleanly down the track with rider color accents, while the rider portrait appears in the HUD racer badge and off-screen pointers.

---

## 4. Acceptance Criteria
- [ ] No goblin head peeking out of a tiny hole in the ball on the selection screen.
- [ ] Rider displays as a full-body painted fantasy goblin standing beside their chosen ball.
- [ ] Selecting different combinations updates the character and ball visuals instantly with smooth transitions.
- [ ] High-detail ball textures showcase clean metallic/magical details without distortion.
