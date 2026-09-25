# P8: Style Test-Drive Toolbar with Blizzard Gold-and-Iron UI Framing

- **ID**: `P8`
- **Priority**: Polish
- **Component**: UI / Styling / Visual Theme Integration
- **Conflicts with**: `H7b`
- **Needs art**: No

---

## Goal
The newly introduced test-drive toolbar in `src/components/TestDriveBar.tsx:26-30` currently uses plain inline CSS styles (`background: '#1a1410e6', border: '1px solid #8a6a3a'`, flat system fonts), clashing starkly with the ornate Warcraft-inspired gold-and-iron 9-slice chrome established across all other menus and HUD panels. Restyle `TestDriveBar.tsx` using the project's standard 9-slice border frames (`.fantasy-dialog`, `.gold-frame`, `frames.css`), embossed fantasy typography, and tactile pressed-button states.

---

## Evidence
- `src/components/TestDriveBar.tsx:26-31`:
  ```typescript
  const button: React.CSSProperties = {
    font: '700 12px/1 Trebuchet MS, system-ui, sans-serif',
    background: '#1a1410e6', border: '1px solid #8a6a3a', borderRadius: 5, padding: '6px 9px',
  };
  ```
  Inline raw styles bypass the global design system established in `src/frames.css` and `src/hud.css`.
- In test drive mode, the top-right toolbar looks like an unstyled browser debug widget rather than part of the Goblin Rally universe.

---

## Solution
1. **Apply Design System Classes**:
   - Wrap `TestDriveBar` in `.fantasy-dialog` or `.gold-frame-compact` container utilizing `public/ui/frame-gold.png` 9-slice borders.
   - Restyle buttons to use `.fantasy-primary` / `.forged-menu-button` or `.pill-button` classes.
   - Use the game's font hierarchy (`font-sans` with warm gold/bronze text `#f0d8a8` and dark engraved text shadows).
2. **Tactile Button Styling**:
   - Active state (selected view): glowing warm amber border, subtle inner bevel.
   - Hover state: soft gold outer glow.
   - Stepper buttons (`−` and `+`): circular riveted brass buttons.
   - Speed readout: inset stone plate background with digital/embossed number styling.

### Files Allowed to Change
- `src/components/TestDriveBar.tsx`
- `src/hud.css`
- `src/frames.css`

### Must NOT Change
- Hotkeys ($V$, $[$, $]$) and callbacks (`onCameraMode`, `onTimeScale`)

---

## Acceptance Criteria
- [ ] Test drive toolbar displays an ornate gold-and-iron framed border consistent with `TICKET-01`.
- [ ] Buttons feature embossed textures, hover states, and distinct active highlights.
- [ ] Toolbar layout remains compact and does not obstruct the camera viewport.

---

## Tests to Run
- `npm run check:ui`
- `node scripts/check.mjs`
