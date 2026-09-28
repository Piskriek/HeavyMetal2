# MP-T06: Modular Character Creator Studio & Legend Migration

- **ID**: `MP-T06`
- **Priority**: High (Phase B / Identity)
- **Track**: Frontend UI & Character Creation
- **Estimate**: 4 days
- **Dependencies**: `MP-T05`
- **Target Files**: `src/components/profile/CharacterCreatorModal.tsx`, `src/game/loadouts.ts`, `src/game/avatar/legends.ts`

---

## Goal
Build an interactive character creation studio modal where players customize their goblin racer across swappable facial features, accessories, colors, and racing archetypes. Migrate legacy character presets (`rivet`, `grub`, `nix`, `sprocket`) into selectable "Legend" skins.

---

## UI/UX Specification

### 1. Wizard Workflow
- **Step 1 · Archetype Selection**: Choose racing archetype (Mechanic, Daredevil, Bruiser, Rocket Jockey) defining physics stat offsets.
- **Step 2 · Appearance Studio**:
  - Live interactive 256x256 goblin bust preview.
  - Tabbed category drawers: Head & Ears, Eyes & Nose, Mouth & Tusks, Headgear & Hair, Collars & Warpaint.
  - Palette swatches for Skin Tone, Accent Color, Leather, and Metal.
  - Layer lock buttons (allows locking nose/eyes while hitting "Randomize").
  - "Copy DNA" and "Paste DNA" buttons with instant visual update.
- **Step 3 · Identity & Name**:
  - Goblin name generator (e.g. *Grimlock Cogsnapper*, *Brak Boltchewer*) or custom input with profanity filtering.
  - Custom racer bio and motto.

### 2. Legacy Legend Migration
- Existing saves with legacy `RiderId` are migrated to:
  `AvatarSource = { kind: 'legend', rider: id } | { kind: 'dna', dna: string }`.
- Legacy portraits remain selectable as exclusive "Legend Skins" with original art preserved.

---

## Acceptance Criteria
- [ ] Character creation wizard completes all 3 steps and commits new racer profiles to local storage.
- [ ] Randomize button respects locked layers.
- [ ] Pasting a valid DNA string updates all UI sliders and previews instantly.
- [ ] Invalid or tampered DNA strings display a descriptive inline validation message.
- [ ] Legacy saved games hydrate without losing rider identities or stat ratings.

---

## Tests to Run
`npm run check:ui`
