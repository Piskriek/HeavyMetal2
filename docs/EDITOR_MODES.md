# The 3D Map Editor: Easy Build, Pro, and keys

The editor has two modes; the switch is next to the **Forge** name in the top bar (or the `` ` `` key).
The choice is remembered (`hm2-builder-mode-v1`). New builders start in Easy Build.

## Easy Build (`src/components/builder/EasyBuildBar.tsx`, `src/game/builder/easy-build.ts`)

Build a track by walking down the road and picking what comes next.

- **The road strip** runs from the start of the course to its end, with every race piece and stunt
  marked on it (start in green, finish chequered). The footprints are the cursor. `,` and `.` walk it
  one stretch (48 stretches); click or drag the strip to jump. The camera glides behind the cursor,
  looking down the road; a brass bar across the road and a ring show where the next piece lands.
- **Shelves** (round buttons, `J` / `K`): Race, Stunts, Roadside, Nature, Rocks.
- **Pieces** (big tiles, `1`–`9`): a pick drops the piece at the cursor, lined up with the road.
  Race pieces and stunts go on the road, scenery beside it (alternating sides), start and finish
  lines snap across the middle. **Auto-walk** then moves the cursor on a stretch. `Enter` drops the
  last piece again. The spot buttons (`L` cycles) override where it goes: Auto, Left, Middle, Right,
  Roadside.
- **The picked piece**: turn 15° (`E` / `C`), mirror (`X`), smaller / bigger, delete. The move /
  rotate / scale handles in the top bar work too (`G` / `R` / `T`).
- **The checklist** says what the track still needs: a start line, a finish line, something to jump,
  a boost or a hazard, some scenery. **Test race** (`P`) races it.

## Pro

Every shelf (2D and 3D), the inspector, lanes, decorate, sculpt, sections, shaders, snapping, the
island ground and the file tools. Nothing was removed from Pro; it only got the new look.

## Keys (`src/game/builder/builder-keys.ts`)

One list of actions with default keys; `?` or `F1` opens the key sheet, where **Change** sets your own
key (saved in `hm2-builder-keys-v1`) and **Defaults** resets them. Rules the defaults keep:

- The fly keys only fly: `W A S D`, `Space` up, `Z` / `Q` down, `Shift` fast. The gizmo moved off
  W/E/R/Q (they flew and switched handles at once): `G` move, `R` rotate, `T` scale, `O` handle space.
- `Esc` never leaves the editor: it cancels a drag, puts the held piece down, or deselects.
  Leaving is `B` or the Menu button (work is saved as you go).
- Digits pick pieces in Easy Build; `5` is the nudge axis in Pro. Laptop camera views: `Alt+7/1/3/0`.
- A key belongs to one action per mode. Taking a key that is in use moves it (the sheet says from
  which action). The browser's own keys (`Ctrl+W`, `Ctrl+T`, `F5`, …) cannot be taken.

The lanes tool keeps its own keys while it is open (see `docs/LANE_NETWORK.md`).

## Look

`src/builder-theme.css` → *Forge theme*: the editor's Tailwind `zinc` / `amber` colours are redefined
on the editor's roots (and every portal it opens: add `forge-theme` to a new portal's root) as the
menus' green iron and brass; Cinzel for titles; `forge-tool`, `forge-tool-group`, `forge-cat`,
`forge-cta` for buttons.
