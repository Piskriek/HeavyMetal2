# TICKET-01: Blizzard/Warcraft Ornate UI Frame & Border System

- **ID**: `TICKET-01`
- **Component**: UI / Styling / Assets
- **Priority**: High (Phase 1 Foundation)
- **Status**: Ready for Implementation
- **Dependencies**: None

---

## 1. Problem Statement & User Need
In the current implementation (see Screenshots 1, 3, 4), modal dialogs (New Game Setup, Settings, Rules) and HUD containers use flat dark-green rectangular panels with thin vector borders. While the main menu buttons feature forged brass/stone textures, the interior UI feels generic, flat, and lacks the tactile, chunky, ornate Blizzard/Warcraft fantasy aesthetic.

The user requires:
- The UI redone in a **Warcraft/Blizzard fantasy style** featuring ornate borders using PNG assets.
- **No stretching**: Borders must use 9-slice grid techniques or modular corner/edge pieces so frames scale cleanly without distortion.
- Support for **magenta `#00FF00` key transparency** when cutting or rendering ornate trim pieces from sprite sheets.

---

## 2. Technical Requirements & Specifications

### 2.1 9-Slice / Modular Border Framework
- Implement a reusable CSS/React component system for ornate modal windows, panels, and cards:
  - Corner pieces (Top-Left, Top-Right, Bottom-Left, Bottom-Right) must remain at **1:1 fixed pixel scale** (no scaling or stretching).
  - Edge pieces (Top, Bottom, Left, Right) must **repeat (`repeat` or `round`)**, never stretch horizontally or vertically.
  - Center/body fill must use textured repeating parchment, dark iron mesh, or dark stone tile from `PreGame/assets/ui/repeatingBG.png`.
- Alternative approach: CSS `border-image` with `border-image-slice` and `repeat` keyword.

### 2.2 Asset Sources from `PreGame/`
- Leverage existing UI kit assets in `PreGame/assets/ui/`:
  - `PreGame/assets/ui/gamegraphics kit 1.png` (Ornate gold, brass, and carved iron frames, filigree headers, rivets)
  - `PreGame/assets/ui/gamegraphics kit 2.png` (Ribbons, medallions, ornate scroll plates, corner brackets)
  - `PreGame/assets/ui/uikit.png` & `uikit_nobackground.png` (Warcraft-style stone slabs, golden rims, embossed headers)
  - `PreGame/assets/ui/repeatingBG.png` (Seamless dark iron/stone background tile)
  - `PreGame/src/assets/ui/frame-steel.webp`, `frame-wood.webp`, `frame-hazard.webp`, `frame-red.webp` (Pre-sliced modular frame elements)
- If new frames are generated, use magenta `#00FF00` (or true PNG alpha) border padding so the runtime/build-time despill and cutout script (`scripts/build-art.mjs`) cleanly extracts them.

### 2.3 UI Components to Retrofit
1. `src/components/Modal.tsx`: Wrap the base modal container in an ornate 9-slice Blizzard-style frame with brass corner brackets and an embossed header banner.
2. `src/components/NewGameSetup.tsx`:
   - Step 1 (Competition Selection): Ornate card frames for Quick Race vs. Tournament.
   - Step 2 (Rider & Capsule Select): Detailed equipment showcase frame.
   - Step 3 (Race Rules): Gold-inlaid parchment/slate rule panel.
3. `src/components/SettingsPanel.tsx`: Forged iron/brass framed settings drawer with ornate tab bar.
4. `src/components/RoundResult.tsx`: Grand victory/defeat scoreboard frame with ornamental crest.

---

## 3. Implementation Plan
1. **Frame Slice Extractor / CSS Classes**:
   - Create `src/ui/frames.css` with modular classes: `.frame-blizzard-modal`, `.frame-blizzard-card`, `.frame-blizzard-header`.
   - Implement either 9-slice CSS (`border-image`) or a `<BlizzardFrame variant="brass|iron|gold">` React wrapper.
2. **Asset Pipeline Integration**:
   - Add slice coordinates for UI frames to `scripts/build-art.mjs` (or extract individual corner/edge PNGs into `public/art/ui/`).
   - Ensure `#00FF00` key transparency filter handles anti-aliased edge despill.
3. **Component Refactoring**:
   - Replace flat border CSS in `Modal.tsx`, `NewGameSetup.tsx`, and `SettingsPanel.tsx` with the new Blizzard frame styling.

---

## 4. Acceptance Criteria
- [ ] No border texture stretching or distortion at any modal aspect ratio (tested from 800x600 to 4K).
- [ ] Modals display ornate metallic/carved fantasy borders with distinctive corner brackets and embossed headers.
- [ ] Transparency around ornate corners is clean with zero green/magenta matte fringing.
- [ ] Keyboard navigation and accessibility focus rings remain distinct and visible around ornate interactive elements.
