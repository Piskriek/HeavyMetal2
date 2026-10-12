# TASK-17: Studio S0, the editor shell and write-back

**The owner, 2026-10-12:** "for me to do anything we need the tools ... get the tools in". The plan is `docs/STUDIO_CREATIVE_SUITE_SPEC.md`; read §3, §4, §4b, §4c and §8 first. This task is §8c step 1, the shell everything else plugs into.

**For the owner first** (§8: "Me first, players later"). It is a developer tool. It runs on the dev server and writes into the project. Nothing in it may break the game: keep all new code under `apps/web/src/studio/` (plus the small hooks listed below).

## 1. How the owner opens it
- **`STUDIO.bat`** at the repository root (CRLF line endings; copy the style of `PLAY.bat`): runs the Vite dev server on port 5173 and opens `http://localhost:5173/?studio`. Vite's hot reload means an accepted change shows in the game at once.
- **The main menu's "The Studio" button** opens the new Studio. The old prototype (Moon editor, Planet Forge) moves into a workspace tab named "Moon (prototype)". Do not delete it.
- **On the production build** (`PLAY.bat`, no dev server), the Studio opens read-only, with a clear banner: "Open STUDIO.bat to save changes".

## 2. The editor layout (Unreal/Unity conventions, §2)
Dark theme, in the game's telemetry look: Oxanium/Inter, glass panels, glowing accents. Load the frontend-design skill before any UI work.
- **Top bar:** workspace tabs (Assets, Scene, Look, Audio, Moon (prototype)), with only Assets and Moon live in this task; the others show "coming next". Then undo, redo, the keymap selector, Simple/Advanced, and Save.
- **Left:** the content browser and outliner, with a search box.
- **Centre:** the viewport. A three.js canvas with orbit/fly navigation per the keymap toggle (§4c: SetMix, Blender, Maya), a grid, and the move/rotate/scale gizmo from `@hm/gizmo` (W/E/R in the SetMix keymap).
- **Right:** the details panel, generated from a schema. Each parameter is declared once: type, range, default, group, a help line, and whether it is Simple or Advanced. Build a small schema-to-panel renderer: number slider plus field, colour, toggle, select, vector3.
- **Bottom: the Changes panel.**
  - Every edit is a command on the `@hm/scenedoc` command stack (undo/redo, merged while dragging).
  - The panel lists the pending changes grouped by object: object, field, old → new.
  - Accept or discard per row, or all. Accept writes through the write-back endpoint (section 3). This is the Hot Tuner / GDTuner pattern from the research.
- **Layouts:** panel sizes are draggable and saved (localStorage through `kv`), with a "classic" reset.

## 3. Write-back (dev only)
- **A Vite plugin** in `apps/web/vite.config.ts` (`configureServer`, so it exists only on the dev server), with the route handlers in `apps/web/studio-server/` (Node).
- **`GET /__studio/data/<name>`** and **`POST /__studio/data/<name>`** read and write one JSON file in `apps/web/src/studio-data/`.
  - Names are matched against `^[a-z0-9-]+$`, and must be on an allowlist in the handler (start with `asset-tweaks`).
  - The body is validated JSON under 2 MB.
  - Write to a temp file, then rename.
  - Refuse every other path. No path from the client ever reaches the filesystem unchecked.
- **Accept** in the Changes panel calls POST, then marks those rows saved. Vite's hot reload picks the file up.

## 4. The asset tweaks the game reads (this task builds the pipe; TASK-18 builds the UI on it)
- `apps/web/src/studio-data/asset-tweaks.json`: `{ "<assetId>": { offset?: [x,y,z], scale?: number | [x,y,z], yaw?: number, tint?: "#rrggbb", metalness?: number, roughness?: number, emissive?: "#rrggbb", emissiveIntensity?: number } }`. Start it as `{}`.
- `apps/web/src/assets/gen.ts` imports it statically, so it is baked into the single file, and applies an asset's tweak in `loadScene` / `getGenSync` after loading, so every use of an asset gets it.
  - Transform tweaks go on a wrapper group, not the mesh.
  - Material tweaks clone the materials, so the shared cache is not mutated twice.
- **A test:** a tweak applied to an asset shows on `getGenSync` and on `loadGen`, and `{}` changes nothing.

## Done when
- `STUDIO.bat` opens the Studio.
- The layout is complete, with Assets showing the content browser over `registry.json` (names only in this task; TASK-18 adds the bench), and Moon (prototype) working as before.
- Undo and redo work. The Changes panel lists edits and Accept writes the file: prove it with an e2e that edits a test field, accepts, and reads the file back. Then restore the file in the test teardown.
- **Shots,** looked at: the Studio layout, the Changes panel with two pending rows, and the read-only banner on the production build.
- Typecheck shows 0 errors, `npm test` is green (apart from the known timing tests), `npm run build` succeeds, and `npm run e2e` (the playthrough) still passes.
- Git: commit your own paths in small steps and push. Never restore or check out files you did not change. Post `[DONE]`.
