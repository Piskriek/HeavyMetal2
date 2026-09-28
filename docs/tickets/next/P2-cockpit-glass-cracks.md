# P2: Cockpit Windshield Glass Scratches and Impact Fracture Overlays

- **ID**: `P2`
- **Priority**: Polish
- **Component**: Cockpit Presentation / Visual FX / Environmental Polish
- **Conflicts with**: None
- **Needs art**: Yes (Glass texture with subtle grime/scratches, plus spiderweb fracture overlay sprites in `public/art/cockpit/`)

---

## Goal
The first-person cockpit viewport currently looks out through a completely transparent opening with zero glass glare, dust, or material presence, feeling like a vacant hole cut into the UI. Introduce a subtle, painted curved glass overlay with faint grime, wiper streaks, and scratches, and trigger temporary dynamic spiderweb fracture cracks on high-velocity collisions and TNT blasts that slowly fade or wipe clear.

---

## Evidence
- `src/components/CockpitHud.tsx:157-185`: The cockpit viewport aperture has no intermediate glass layer between the 3D WebGL scene and the bezel framing.
- Heavy rival impacts and obstacle collisions rock the chassis but leave the windshield looking pristine.

---

## Solution
1. **Art Asset Pass**:
   - `public/art/cockpit/cockpit-glass-grime.png`: Subtle, low-opacity (8–12%) texture containing faint specular highlights along the circular edge, oil smudges, and goblin tool scratches.
   - `public/art/cockpit/cockpit-glass-crack-1.png`, `...-crack-2.png`: Stylized radial spiderweb fractures with chipping, painted in goblin aesthetic.
2. **Glass Layer in `CockpitHud.tsx`**:
   - Add a `<div className="cockpit-glass">` directly behind the bezel layer, matching the aperture bounds.
   - Render the persistent grime/scratch layer.
3. **Dynamic Cracking State**:
   - When `engine.shake` exceeds threshold ($>2.5$) or on TNT impacts:
     - Activate crack overlay at the impact contact angle.
     - Hold crack visible for 2 seconds, then smoothly fade out over 1.5 seconds.
     - Omit cracking if `reducedMotion` is set.

### Files Allowed to Change
- `public/art/cockpit/**`
- `src/components/CockpitHud.tsx`
- `src/game/cockpit.ts`
- `src/cockpit.css`

### Must NOT Change
- Aperture geometry measured in `src/game/cockpit.ts`

---

## Acceptance Criteria
- [ ] First-person cockpit displays subtle glass surface reflections and scratches without impairing forward track readability.
- [ ] Violent collisions and TNT explosions trigger realistic spiderweb glass fractures that fade out cleanly.
- [ ] When reduced motion is enabled, fractures are omitted.

---

## Tests to Run
- `node --import tsx --test tests/cockpit.test.ts`
- `npm run check:edges`
