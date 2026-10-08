# Sidecar task 10: the Studio's editor shell (Studio phase S0)

Do this after TASK-05. Read `docs/STUDIO_PLAN.md` first: what the Studio is, the research, and especially sections 4, 4b and 4c. Pull `main` first. Work on `main` and push there (no PRs). Before you push, run `node scripts/verify.mjs` and `E2E_GPU=1 node scripts/e2e-smoke.mjs`; both must pass. Commit the built `apps/web/dist/index.html` with `git add -f`. Never delete or weaken an existing check.

## The pieces (landed and tested; read their APIs first)
- **`@hm/scenedoc`** (`packages/scenedoc`): typed nodes, ops, one undo history with transactions and slider-drag merging (`mergeKey`), selection, save and load with migrations. POL-21: a single edit on a very large document is slow; fine at the plot's size.
- **`@hm/presetcodec`** (`packages/presetcodec`): any schema'd preset as a share code.
- **The old island game's Studio mode** (STATUS N10: windows and attribute editors you open, close and move; fly; focus). Reuse its window system where it fits, rather than starting over.

Add both packages to the `tsconfig.json` paths and the `apps/web/vite.config.ts` aliases.

## Build
1. **The way in.** The home menu's Studio button opens the lab in Studio mode: everything unlocked, no quest, the gate on, flying allowed.
   - Walking up to a station and pressing E opens the editor layout. The stations are the console, the preset bench, the planet table and the combiner.
   - A profile setting, "Studio entry: through the lab / straight to the editor", skips the walk (STUDIO_PLAN 4c).
2. **The editor layout.** Dockable panels, with the layout saved in the profile and a "Classic" layout that always stays available:
   - **Viewport:** the lab or the plot, with W/E/R move/rotate/scale gizmos, snapping, and focus on the selection.
   - **Outliner:** the scenedoc tree.
   - **Details:** generated from the selected node's scenedoc type. Number sliders with their ranges (dragging merges into one undo step through `mergeKey`), enums, colours, vec3 fields and refs. A Simple/Advanced switch per panel. A help line for each field.
   - **Content browser:** the vault's presets plus saved ones. Drag one onto an object to apply it.
   - **History:** the labelled undo steps; click one to go back to it.
   - **The minimum-spec cost** (fps, draw calls, triangles on the Low tier) shown live in a corner.
3. **The data.** Build the Studio's scenedoc document from the plot: each machine is a node of a `machine` type (kind, position, yaw, on, cartridge), plus the lab's props.
   - Edits in the Studio apply to the plot at once (a live link): moving a machine in the Studio moves it on the plot.
   - Ctrl+Z and Ctrl+Y work in every panel.
4. **Sharing.** "Copy as code" on any preset or selection that has a schema (presetcodec), and "Paste code" to bring one in. A bad code shows a plain sentence and never crashes anything.
5. **The keymap setting:** SetMix (Unreal/Unity style: left-click select, W/E/R, right-mouse plus WASD fly), Blender, Maya. Every tooltip shows the keys of the chosen keymap.
6. **Tests:**
   - Unit: the schema-to-details mapping, and the keymap tables.
   - e2e:
     1. Open the Studio and select a machine in the outliner.
     2. Change its yaw in Details and check the plot's machine turned.
     3. Undo, and check it is back.
     4. Copy a preset as a code and paste it back.
     5. Switch the keymap and check a tooltip changes.

## Report back
What changed, verify and e2e results, fps on Low in the Studio, and screenshots of the editor layout with a machine selected.
