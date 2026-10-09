# SetMix design system

One set of parts, two voices. Read before any UI work (and load the frontend-design skill). Every screen is checked on the screen map (`scripts/ui-map.mjs`) after a change. The owner's own brief is the studio prompt at the end of `OWNER_ASKS.md`.

## The two voices

| | SetMix (the harness) | Goblin Racing (a game inside it) |
|---|---|---|
| Where | The home and galaxy, your island and its HUD, windows, Settings, Avatars, Community, the track editor | Its window and front menu, race modes, the race screens (select, loading, pause, results, standings) |
| Feeling | A clean studio: white walls, the work is the colour | A goblin game: loud, painted, fast |
| Display face | Oxanium (`--font-setmix`), sentence case, weights 600 to 800 | Bricolage Grotesque (`--font-display`), heavy, tight |
| Text face | Inter | Inter |
| Colour | Neutral walls and ink, one signal colour for the one thing to press; the galaxy is the one dark place (space) | Goblin green and racing gold over the island scene |
| Corners | Square. No bevels, inner shadows, glows or drop shadows (owner) | Square |
| Words | Plain, sentence case, what it does for you | Same rules, a bit of goblin swagger allowed in headlines |

## Tokens (`apps/web/src/studio.css`, `:root`)

Change a colour here, never in a component. Current values:

| Token | Use |
|---|---|
| `--bg` | the wall |
| `--paper`, `--panel` | windows, docks, cards |
| `--hm-inset` | a selected tile's well |
| `--line` | hairlines between things |
| `--text`, `--dim`, `--faint` | ink, secondary, hints |
| `--accent` | the one thing to press (`button.go`), the marker on a hovered menu row |
| `--danger` | destructive actions only |
| `--font-setmix`, `--font-display` | the two display faces |
| `--ease-out` | every motion that answers a press |

## Parts (use these, do not make new ones)

| Part | Class / component | Rules |
|---|---|---|
| Window | `FloatingWindow` (island), `.shell-window` (SetMix screens) | Title in sentence case, Close top right, Esc closes the front one |
| Side dock | `.avatar-dock` | Right side, full height under the HUD; a phone gets it as a bottom sheet |
| Preset tile | `PresetPreview` in a bordered button | The picture first, the name under it; selected = ink outline + inset well |
| Tabs | `.ad-tabs`, `.pw-tabs` | Underline marks the open one |
| Segmented choice | `.seg` | For 2 to 6 short options |
| Three ways in | `NewChooser` | Every "new": Quick setup, Setup wizard, Manual; the last way used is marked |
| Wizard steps | `.ad-steps` | Numbered (it is a sequence), each step one question, the result visible while answering |
| Note | `.island-note`, `.shell-note` | One line, says what happened in the same words as the button |
| Loading | a bar with words, never a frozen screen (hard rule) | |
| Empty state | one line that says what to do, and the button to do it | |

## Rules

1. One loud element per screen; everything around it quiet.
2. Previews instead of words wherever a preset is shown (owner).
3. Every control has a way back; Esc closes exactly one thing.
4. Group menus by where they act (this island / SetMix), not alphabetically.
5. No all-caps labels, no tracked-out eyebrows; the smallest text is 11 px (key caps 10 px).
6. Motion only to answer a press or to show where something went; reduced motion respected.
7. Phone width: no horizontal scroll, docks become bottom sheets, targets at least 24 px.
8. Measure on Potato and Low after any change that draws (`scripts/perf.mjs`).

## The routine after any UI change

1. `npm run verify` (types, tests, build) and `npm run e2e` (the journeys).
2. `npm run ui-map -- --check` (on this laptop with `E2E_GPU=1 E2E_SLOW=2`): every screen, every control pressed; it fails if a button went missing, appeared undeclared, or does something else than before.
3. Look at `ui-map/index.html`: every screenshot against the rules above.
4. When a change is meant (a new button, a new screen), review it there, then `npm run ui-map -- --approve` writes the new contract (`tests/ui-contract.json`); commit it with the change.
