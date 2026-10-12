# TASK-18: Studio S1a, the asset bench (touch-ups and a one-click model redo)

**The owner, 2026-10-12:** "we have some models that need redoing with the no holes, square, no round etc rules ... put a easy way for the user to redo models in the studio after they connect their 3d ai api, we can use the local 3d to test via the studio".

Builds on TASK-17: the shell, the Changes panel, write-back, and `asset-tweaks.json`. Plan: `docs/STUDIO_CREATIVE_SUITE_SPEC.md` §8c step 2.

## 1. The Assets workspace
- **Content browser:** every asset in `apps/web/src/assets/gen/registry.json`.
  - A thumbnail per asset, rendered lazily on demand by a small offscreen renderer, then cached.
  - Its name and class, filtered by class (vehicle, machine, structure, lab, weapon part and so on).
  - A search box.
- **Viewport:** the selected asset, with:
  - Levels: Low | Mid | High | All three side by side;
  - Wireframe and Normals overlay toggles;
  - a 1.8 m figure for scale (a simple capsule);
  - stats: triangles per level, real size in metres, file sizes.
  - Toggle "In context" to show the asset where the game uses it (a lattice piece on a 4 m grid; a lab piece against a wall).
- **Details (the schema panel):**
  - **Fit** (Simple): offset x, y and z, uniform scale, yaw. The gizmo in the viewport edits the same values.
  - **Material** (Simple): a tint colour, metalness, roughness, emissive colour and intensity. Plus **Presets**: a strip of one-click looks taken from `@hm/vault`'s material presets, mapped to tint, metal and rough, and named the same.
  - **Info** (Advanced): the asset's class, budgets, and its description from `docs/runworld/assets.json` (read-only here; editable in Redo).
- Every edit goes through the Changes panel, and Accept writes `asset-tweaks.json`. The game shows it at once (hot reload).

## 2. Redo a model (the owner's request)
A "Redo model" panel in the Assets workspace.

**Connect a 3D AI** (once):
- Providers:
  - **Local Hunyuan3D** (URL plus a bearer token), the one to build and test now;
  - Meshy, Tripo and RUN.world, listed as "coming soon".
- The connection is stored only in `/.studio-secrets.json` at the repository root, through a dev-endpoint route. Add the file to `.gitignore` in the same commit.
  - The UI never echoes the token back (it shows "connected").
  - It is never written into the bundle, the repo, a log or a URL.
  - The owner types it in themselves.
- A "Test connection" button calls the provider's health route.

**The redo flow, one asset, with progress and a log in the panel:**
1. **Describe.** The description from `assets.json`, editable, with the owner's rules shown beside it as a checklist:
   - square sections;
   - nothing round unless it must be (wheels, tyres, barrels);
   - no holes, no thin tubes or cables;
   - wall-mounted things are separate objects;
   - nothing floats.

   Saving writes the new description to `assets.json` through the endpoint (add it to the allowlist as a special case: only the `subject` field of that asset changes).
2. **New image:** runs `node scripts/runworld-assets.mjs images <id>` after moving the old `source.png` and its `.json` into `zips/runworld/assets/<id>/old/<timestamp>/`. Show the image beside the old one. Buttons: "Use this" (creates `approved`) or "Try again".
3. **Make 3D:** runs `node scripts/local3d.mjs model <id>`. It reads the connection from `.studio-secrets.json`; extend `local3d.mjs` so `LOCAL3D_URL` and the token can come from that file when it exists, keeping `.local3d-token` working. Show the job's progress.
4. **Process and pack:** `node scripts/runworld-post.mjs <id>`, then `node scripts/runworld-pack.mjs <id>`.
5. **Compare:** the old and new models side by side at every level. "Keep" leaves the new one (Vite reloads it). "Revert" restores the archived files and re-packs.

**Each step is a dev-endpoint route that runs one of these scripts:**
- fixed arguments only;
- `<id>` validated against the ids in `assets.json`;
- one job at a time;
- stdout streamed to the panel (polling a job log is fine).

No other commands can be run through the endpoint.

## 3. Test it on a real case
**The weapon bench**, owner: "the tools on that table with the tools against the wall is pretty dismal". Redo it through the Studio flow using the local 3D: the bench alone, with no pegboard and no hanging tools (the split rule: wall-mounted things are separate objects). The tools come later, as their own assets.

Record the run in the `[DONE]` post: each step's time and the before/after shots.

## Done when
- The workspace works for every asset, and the Fit and Material tweaks round-trip through the Changes panel into the game.
- The redo flow has run end to end on the weapon bench against the local 3D, and the new bench is in the game.
- An e2e covers the browser, a tweak accepted and seen in the game, and the redo routes refusing a bad id. Mock the long scripts in the test.
- **Shots,** looked at: the workspace, the three levels side by side, the material presets, the redo panel at each step, and the weapon bench before and after.
- Typecheck shows 0 errors, the tests are green (apart from the known timing tests), `npm run build` succeeds, and `npm run e2e` passes.
- Never print or commit a token.
- Git: commit your own paths in small steps and push. Post `[DONE]`.
