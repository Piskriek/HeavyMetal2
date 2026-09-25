# P1: Cockpit Left Cluster Plate — Third Gauge Opening Art Pass

- **ID**: `P1`
- **Priority**: Polish
- **Component**: Cockpit Art / UI Graphics
- **Conflicts with**: None
- **Needs art**: Yes (Repainted/adjusted left cluster plate sprite `public/art/cockpit/cockpit-cluster-left.png` with a cutout opening in the painted third ring)

---

## Goal
In `public/art/cockpit/cockpit-cluster-left.png`, the left iron instrument plate depicts a painted third gauge ring, but unlike the other two gauge housings, it has no aperture cutout or dial needle mounted within it, appearing visually unfinished or broken. Update the cluster art to provide a functional bezel opening, and mount an interactive third instrument (a Nitro / Temperature or Gyro Tilt gauge) in `CockpitHud.tsx` to complete the goblin cockpit dashboard.

---

## Evidence
- `public/art/cockpit/cockpit-cluster-left.png`: Depicts three ornamental brass circular bezels, but `src/game/cockpit-art.json:7-19` only defines two dial anchors (`grade` at $x=42, y=60$ and `boost` at $x=134, y=148$). The third ring at the lower-left has no dial opening or corresponding meter.
- `src/components/CockpitHud.tsx:165-168`:
  `{dial(leftBig, COCKPIT_ART.dials[0], needles.grade, 'grade', 'GRADE')}`
  `{dial(leftSmall, COCKPIT_ART.dials[1], needles.boost, 'boost', 'BOOST')}`
  Leaves the third ring on the sprite unpopulated.

---

## Solution
1. **Art Asset Pass (`public/art/cockpit/`)**:
   - Update `cockpit-cluster-left.png` so the third ring features a clean, darkened recessed cavity matching the other two gauge housings.
   - Or paint an authentic riveted iron blanking cap with goblin skull engraving if intended as an unmounted auxiliary socket.
2. **Metadata & Hud Mount (`src/game/cockpit-art.json` & `CockpitHud.tsx`)**:
   - If mounting a gauge: define anchor coordinates in `cockpit-art.json` for dial 2 (e.g. `temp` or `tilt`), mount a third dial with matching needle, and drive it from `state.gradePct` or lateral $G$-force.
   - If mounting a plate: ensure the graphics cleanly cover the socket with ornate Warcraft-style brass rivets.

### Files Allowed to Change
- `public/art/cockpit/cockpit-cluster-left.png`
- `src/game/cockpit-art.json`
- `src/game/cockpit.ts`
- `src/components/CockpitHud.tsx`

### Must NOT Change
- Dimensions and aperture framing of the main cockpit bezel

---

## Acceptance Criteria
- [ ] Left instrument plate has no awkward "blank ring" graphics artifact.
- [ ] The third housing either features an active functioning dial with needle or an ornate riveted cover plate.
- [ ] Cockpit HUD renders crisply across all standard screen aspect ratios.

---

## Tests to Run
- `node --import tsx --test tests/cockpit.test.ts`
- `node --import tsx --test tests/cockpit-channel.test.ts`
- `npm run check:art`
