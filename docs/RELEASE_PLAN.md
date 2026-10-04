# From here to a polished release (written 2026-10-04, end of the laptop session)

The owner, with about 10% of the week's usage left: "make the most of the last 10% by planing out the next steps untill polished release down to the last detail". This is that plan. It is the order of work from now on; `STATUS.md` keeps the item-by-item state and `handoff/CATCHUP.md` 12ag says where the last session stopped.

**How to use it (next session):**
- Read CATCHUP 12ag, then this file top to bottom.
- **The order after the critique (section 11):**
  1. Milestone 0.5 (foundations).
  2. Milestone 1, P0: Game Mode's buttons and juice.
  3. Milestone 2: import, machine, portal.
  4. Milestone 3, chapters 1 to 3 (the first hour).
  5. Milestone 1, P1: Simplified.
  6. The rest of Milestone 3.
  7. Milestone 4, then Milestone 5.
  8. Milestone 1, P2: Advanced, cut to section 12's line.
  9. Milestone 6, then Milestone 7, then Milestone 8.
- Inside a milestone, follow the work-package order.
- Every task names how it is built:
  - **Arena** means a battle prompt: pure logic, tests first, the CATCHUP 12ad routine.
  - **Glue** means me, in the island.
  - **Art** means an Arena art or voxel agent; review its output yourself (memory: art-agent-lessons).
- Every task names how it is checked: a unit test, an e2e check, a perf number, or the owner's eye.
- When a task lands, put it in its STATUS row and tick it here.

---

## 0. Rules that hold for every task

- **Log first.** Every owner message goes into `OWNER_ASKS.md` verbatim, before anything else.
- **The hotbar is the spec V3.** Not a hybrid (memory: hotbar-v3-no-hybrid). New behaviour goes behind a V3 button's `bind` in `packages/buildkit/src/v3.ts`. My additions go in the spec's V3.1 section and in the test's ADDED list.
- **Everything is a preset.**
  - New things are preset kinds with a schema (`packages/engine/src/schemas.ts`), saved in the island, undoable (one action, one step).
  - Settings knobs belong in the graphics preset (as `ditherDistance` does) or in a schema.
- **The minimum spec is the owner's laptop** (i7-6700HQ, GTX 950M). Low must hold 60 fps on the island.
  - Anything heavy is off on Low and Potato, and says so.
  - Measure with `node scripts/perf.mjs low 6`, twice: the first run after a heavy job is slow.
- **Loading bars.** No screen ever starts choppy: preload behind a visible bar (memory: loading-bars-rule).
- **Safety.**
  - Nothing flashes more than three times a second; a test keeps the lamps under that.
  - Reduce motion turns shakes off. Any new flashing effect gets the same test.
- **Design.** Load the frontend-design skill at the start of every design task (memory). The SetMix voice: white wall, square, Oxanium and Inter, one accent.
- **Tests never take the owner's mouse.** Stub `requestPointerLock`; `ClipCursor` is released in the e2e's `finally`.
- **What I may do:**
  - Allowed: push to `main`.
  - Not allowed:
    - opening PRs;
    - merging others' work;
    - the RUN deploy;
    - scheduled tasks;
    - paid actions;
    - accepting terms;
    - money;
    - signing in;
    - printing tokens.
  - The owner deploys.
- **The gate.**
  - `npm run verify`: typecheck, about 1456 unit tests, and the build.
  - `E2E_GPU=1 E2E_SLOW=2 node scripts/e2e-smoke.mjs`: 139 checks; on a fast PC, `E2E_SLOW=1`.
  - Commit the build with `git add -f apps/web/dist/index.html`.
- **Writing scripts.** Write them with the Write tool, not bash heredocs: quotes and backticks break. In JS replacements use split/join, because `$$` in `String.replace` becomes `$`.

---

## 0.5. Milestone 0.5: foundations the critique found missing (before anything else)

| Task | Why (section 11) | Check |
|---|---|---|
| **Ways registry.** Move each tab's ways out of `island.tsx` into `apps/web/src/build/ways/<tab>.ts`. A way id maps to a handler, which gets one context (aim, store, say, fx, runtimes). `useHeld` and `useV3Way` become one lookup. | Q6: 87 more buttons would not fit in one 2,000-line file | unit tests per handler; e2e unchanged and green |
| **Storage on IndexedDB.** Islands, models and imports go behind one storage module with a quota check and a plain message when full; localStorage keeps preferences only. Saves are versioned with migrations. **Export / import an island** as a `.setmix` file. | Q7, Q12: localStorage overflows silently at about 5 MB | unit: migration from a beta save fixture; e2e: export, wipe, import gives the same island |
| **Island budgets.** Per tier: things, total voxels, lamps, effects, characters, sound spots, imports. A meter in Simplified and Advanced (Game Mode only when nearly full); placing over budget is refused with a plain message. | Q8: players can sink Low to 10 fps | e2e: the 101st lamp on Low is refused; perf with a full budget holds 50+ fps on Low |
| **e2e suites.** Shell, island-game, island-simplified, island-advanced, import-portal, racing. Each starts from a seeded save, they run in parallel pages, and key screens get pixel snapshots with a tolerance. | Q9: one serial script will not scale | all suites green; total under 4 minutes on this laptop |
| **Shift + wheel cycles tabs** (V3.1 addition), and the tab keys can be rebound in Controls. | Q5: laptops with media keys | e2e: Shift+wheel moves F3 to F4 |
| **Fuzzing rule** for every reader (Arena tests include truncated, huge and garbage input), and portal fetch rules (credentials omitted, byte and time caps, data only). | Q11 | written into the vox, schematic and chunkworld prompts |

## 1. Milestone 1: the V3 hotbar complete (87 buttons still "coming")

**Priorities (critique Q1):**
- **P0** is Game Mode: WP1.1 and WP1.2, now.
- **P1** is Simplified (WP1.3), after the questline's chapters 1 to 3.
- **P2** is Advanced (WP1.4), last. The heaviest of P2 may go to 1.1 (section 12).

Every button in `v3.ts` with `todo` gets built, its pip goes, and an e2e check proves it. To get the current list, walk `V3_TABS` for `bind.todo`; CATCHUP 12af has a script. Each work package below is a commit, so the owner can try it.

### WP1.1 Game Mode first (the owner's main mode; 18 buttons)

| Button | How | Check |
|---|---|---|
| F3 Punch Hole | Glue: `@hm/voxelcsg` carve with a cylinder along the view ray, right through the thing (radius from the tool size). | e2e: a wall block gets a through-hole, one undo step |
| F1 Toss / Pitch | Glue: `physics-runtime` throw: the thing you point at (or carry) gets a velocity along your view; lands for good as one undo step. | e2e: barrel ends up more than 3 m away |
| F1 Freeze Wand | Glue: model param `frozen`; physics leaves it where it is, even in mid air; a snow burst and a pale-blue tint (palette lerp, kept in its own param so it can be undone). | e2e: a dropped barrel stays in the air |
| F1 Vacuum Bubble | Glue: things under 1 m within 4 m float into a cluster that follows you (render-only poses, like walk paths); click again to drop them where you point (one undo step). | e2e: 3 small things move to the cluster, then drop |
| F2 Glitter Gloss, Glow Paint (+ Simplified Glossy, Neon, Chrome) | Glue: the palette entry's `roughness` / `metalness` / `emissive` (the voxel palette has them); check that `voxel-view` honours them. Glow "through walls" is an outline pass that is **off on Low**; Medium and up get it. | unit: recolour keeps 0..1; e2e: emissive > 0 after Glow Paint |
| F2 Sticker Stamps (Emotes, Splats) + Simplified Decal Sticker (4) | **Arena B1 `@hm/decals`** (placement maths, atlas cells, fade, rotation, a pure projection onto a heightfield or a box). Glue: three.js `DecalGeometry` meshes; emotes animate by flipbook cells. | unit (Arena) + e2e: sticker count 1, undo 0 |
| F4 Live Puppet | **Arena `@hm/puppet`**: 2-bone IK for the goblin rig (arm and leg chains), drag a limb end to a target, joint limits. Glue: a character's pose follows the drag (render-only), Enter keeps it as a pose preset. | unit (Arena) + e2e: limb end within 2 cm of target |
| F5 Jukebox Track | **Arena `@hm/musicbox`**: 4 procedural loops (bass, chords, drums, lead) as data for the existing synth `@hm/audio` beds; tempo, key. Glue: a placed turntable thing plays a loop zone. | e2e: a music bed is live after placing |
| F5 Echo Dome | Glue in `@hm/audio`: a reverb send (a `ConvolverNode` with a generated impulse) and a dome zone in the soundscape that fades the send in. Shares code with Advanced Reverb Volume. | unit: impulse length matches decay; e2e: zone count |
| F7 Tripwire Alarm | Glue: two clicks make a thin long zone (the beam, a red overlay line); wired to a siren (sound) and a beacon lamp that flashes **at most 2 times a second**. | e2e: walkInto fires the siren |
| F7 Bouncy Launch Pad | Glue: new wire action `launch` (`@hm/triggers` action kind + the island sets the goblin's upward speed); a pad model. | e2e: walkInto sets vy > 0 |
| F8 Selfie Stick | Glue: the camera swings round to face the goblin, it plays Cheer, a photo is taken (cam-photo path). | e2e: photos +1, camera faces goblin |
| F9 Go-Kart Toy | **Arena `@hm/kart`**: arcade car on a heightfield (steer, throttle, drift, bumps; deterministic step). Glue: a kart model (Art), E to get in and out, camera follows. | unit (Arena) + e2e: kart moves 5 m |
| F9 Target Practice | Glue: a target thing that flips (render pose) and counts when a tossed or hammered thing hits it. | e2e: a toss hits, score 1 |
| F9 Respawn Flag | Glue: kind `spawn-flag`; touching it sets your respawn point and fires the Firework effect (once); falling in the sea or Damage brings you back. | e2e: respawn moves you to the flag |
| F12 Shooting Star Trail | Glue: an overlay ribbon behind the goblin (the walk-path ribbon code) plus sparkles, for a few seconds each click, held while moving. | e2e: ribbon shown |

### WP1.2 Game Mode juice (the spec's Character_Anim and Tool_Feedback for all 12 tabs)

- **Arena B6 `tooljuice`**: per tab, as data for the existing plugs:
  - the beam, rings, cone, ripple, stamp or confetti;
  - squash and stretch curves;
  - timing.
- **Arena B7 `toolanims`**: the goblin's holding and using animations per tab, as `@hm/anim` presets: the magnet jerk, the can shake, the rolling pin, the baton, the boombox slap, the flashlight, the zap gun, the camera lift, the wind-up key, the spade, the fairy wand.
- Glue: the island plays them on pick and on use in Game Mode only (Simplified and Advanced stay quiet).
- Checks: e2e (`hmJuice` counts the effects fired per use); the owner's eye.

### WP1.3 Simplified Mode (37 buttons)

| Button(s) | How |
|---|---|
| F1 Only Characters, Only Lights (+ Advanced filters Lights, Skeletal Mesh, Triggers, Splines, Decals) | Glue: picking learns lamps, characters, zones, walk paths and decals (ray tests against their boxes); the gizmo moves them all; filters gate them. This also closes STATUS B17 ("Select selects anything"). |
| F1 Link as Single Object, Unlink, Lock in Place, Save as Toy (V3.1) | Glue:<br>• Link and Unlink use a `group` kind (children refs; the gizmo moves the group).<br>• Lock is a `locked` param (not pickable, not movable).<br>• **Save as Toy** joins the group's voxels into one model with `@hm/voxelcsg` (transforms applied), makes it a thing preset under "My toys", and adds it to the Prop Box options. |
| F1 Box Drag: Depth Limit | Glue: the box only takes things nearer than the first hit plus 10 m. |
| F3 Join Shapes Together, Cut in Half | Glue: `@hm/voxelcsg` join (two things into one) and cut (a plane through the thing, two pieces). |
| F4 Pose Adjuster (Standing Rest, Action Ready, Sitting Down, Fallen Down) + Limb Turn, Mirror | Glue + data: 4 static poses as `@hm/anim` presets; Limb Turn turns the picked bone; Mirror copies to the other side. Uses `@hm/keyframes` for the stored pose. |
| F4 Quick Animator: Defeat + Play Speed, Loop | Data: a `defeat` anim preset; glue: the animator's play speed and loop flag. |
| F5 Pitch, Fade In/Out Area | Glue: the sound-spot `pitch` param (playback rate) and the ambience zone `fade` param (gain ramp distance). |
| F6 Glow Range, Light Color, Sun Strength | Glue: lamp params `range` and `color` (the LightPool takes them over the preset's); the light preset's sun intensity. |
| F7 Player Presses 'E' | Glue: `@hm/triggers` already takes `pressed`; E near a zone counts as a press. The zone's `when: 'press'`. |
| F7 Damage Player + Trigger Delay, Repeat Limit, Delay Before Action | Glue:<br>• **health**: 3 hearts on the HUD; damage removes one; at 0 you respawn (flag or start) with a loading-safe fade.<br>• Wire params `delay` and `once` (the triggers graph has delays).<br>• Zone `delay`. |
| F8 Camera Placer (Cinematic 16:9, Close-up Portrait, Wide Scenic View) + FOV, Blur | Glue:<br>• kind `camera-spot` (position, look, fov, blur), placed where you stand; Look through it (Esc back).<br>• Blur is depth of field in the post pass (**off on Low**).<br>• Cinematic adds letterbox bars. |
| F8 Gentle Pan, Fast Flyby + Smoothness | Glue: `@hm/camtrack` keys from clicked points; pan = slow linear, flyby = fast eased; Smoothness = Catmull-Rom tension. |
| F9 Player Start Point + Health, Movement Speed, Sight Distance, Reaction Delay | Glue:<br>• kind `start-point` (where you appear on the island).<br>• Character params `health`, `speed`, `sight`, `reaction` passed to `@hm/npcbrain` (it has sight and reaction). |
| F10 Desert Cactus + Size Randomness | Art: a cactus voxel model (and a few more desert things). Glue: the scatter's size spread param. |
| F11 Solid Boundaries (Walk-Through Ghost, Solid Wall, Invisible Barrier, Climbable Ladder) + Thickness | **Arena `@hm/kinematic`**: capsule against boxes and voxel models (slide along, step up 0.3 m, ladders climb). Glue: the goblin's movement uses it; things get a `solid` param (ghost / solid / invisible / ladder). Physical Material sliders (Bounciness, Heaviness, Friction) become per-thing overrides on `@hm/physmat`. |
| F12 Screen Mood Filter (Warm Vintage, Cold Sci-Fi, Horror Dark, Retro Arcade Comic) + Filter Strength, Vignette; Particle Count, Particle Speed | Glue:<br>• mood presets for the post pass (grading LUT, vignette, posterize for Retro); on Low a cheap one-pass colour matrix, so the mood still shows.<br>• Particle Count and Speed as effect params. |
| Remaining sliders | Click Picker Reach Distance and Outline Thickness; Surface Color Paint Brush Size and Opacity (a soft paint on things means per-voxel colour, so first decide: Opacity mixes the new colour into the palette entry); Add Building Block Height (a non-cube block: scale y) and Snap to Grid; Clay Modeling Surface Softness; Cut & Carve Bevel. Each gets a `drives` value and a handler. |

### WP1.4 Advanced Mode (32 buttons, plus filters and keys)

- **Selection.**
  - Lasso and Similar use `@hm/selectset` (it has lasso).
  - Surface Paint select brushes over things to add them.
  - Hierarchy works already.
- **Brushes.**
  - Triplanar Projection waits for D12 (smooth meshes).
  - The Alt eyedropper and the `[ ]` keys are done.
  - Shift+Drag Laplacian smooth uses the terrain smooth.
- **Geometry.** DynMesh, Retopo and the Quad-Remesh preset are **Arena C5 remesh**, after D12.
- **Animation.** Auto-Key Transform, Dope Sheet, Onion Skinning and Root Lock need:
  - a **timeline window** (a design task) on `@hm/keyframes` (merged): tracks per thing, keys, scrub with J/K/L, I keys a transform;
  - onion skins drawn as ghost models at nearby keys.
- **Sound.**
  - Reverb Volume shares Echo Dome's code.
  - Directional Cone uses the `PannerNode` cone.
  - Occlusion Mask: a low-pass filter when the ground blocks the ray to you.
  - P auditions at the cursor.
- **Lights.**
  - Rect Softbox is three.js `RectAreaLight`, Medium and up.
  - Reflection Probe is a cube camera, rendered once per change, High and up.
  - The keys: Ctrl+L+Drag aims the sun; Alt+C pilots a light as the camera.
- **Logic.**
  - Gate Relay: AND, OR and delay nodes. `@hm/triggers` has gates; show them in the wire graph.
  - Actor Factory: spawn a preset on a signal.
  - Debug Probe: the wire graph shows live signals.
- **Camera.**
  - Cine Dolly and Boom Arm are camtrack rigs.
  - Ortho Blueprint is an orthographic top camera.
  - Viewport Bookmark: Shift+1..9 save and 1..9 recall while held; Alt+P pilots.
- **Avatars.**
  - Socket Anchor: things ride a bone.
  - Ragdoll Joint is **Arena `@hm/ragdoll`** (a verlet chain on the goblin rig).
  - The AI Tree is done.
  - G toggles the game-view gizmos.
- **Physics.**
  - Convex Hull Auto-Fit is **Arena `@hm/hull`** (quickhull 3D on voxel corners).
  - Physics Joint Hinge: doors swing about an axis, on physmat.
  - NavMesh Bounds is **Arena `@hm/navgrid`** (a walkable grid from the heightfield and solids, with A*), used by npcbrain.
  - P runs a live sim; Shift+P resets.
- **Materials & VFX.**
  - Material Sampler: the eyedropper takes a thing's palette entry into Paint.
  - Post-Process Volume: a zone that applies a mood.
  - Triplanar UV waits for D12.
  - R re-triggers a burst.
  - Shift+Click propagates a material to the same model everywhere.
- **Filters that still say coming:** make each real, or leave it with its pip and its reason in the tooltip. Never a dead toggle.

**Milestone 1 is done when:**
- `v3.ts` has no `todo` left, except those waiting on D12 (listed and visible as coming);
- every button has an e2e check;
- e2e passes twice in a row;
- Low holds 60 fps on the island with everything placed once.

---

## 2. Milestone 2: bring your own voxel builds, a machine, a portal (owner, 2026-10-04, latest)

The owner: "lets make it possible to bring in the voxel models from other games so the user can bring them in themselves, maybe the questline shows you in the beginning how to do with a machine then hook it up to a portal and then step into voxel worlds on the other side, ill find an opensource one they can connect to the first time and then do their own research".

1. **File readers (Arena, two battles at once).** Both produce `VoxelModel` exactly as `@hm/voxel` has it:
   - `{ id, name, size: [x, y, z], pivot, palette: { name, color: [r, g, b] in 0..1, roughness, metalness, emissive, alpha }[], cells: Uint8Array }`;
   - y up; index `x + sx * (y + sy * z)`; a cell holds palette index + 1, 0 is empty;
   - at most 255 palette entries;
   - dimensions at most 96 (`clampDim`); bigger builds come back split into tiles of 96, or halved by majority vote, the caller's choice.

   The two battles:
   - **`@hm/vox`**: MagicaVoxel `.vox` (RIFF chunks: MAIN, PACK, SIZE, XYZI, RGBA, MATL; z-up to y-up; several models with their nTRN offsets; without RGBA, a fallback palette and a flag). Plus a writer, so players can take their models back out.
   - **`@hm/schematic`** (with an NBT reader inside):
     - formats: Sponge `.schem` v2 and v3 (Palette, varint BlockData), MCEdit `.schematic` (Blocks, Data), structure `.nbt` (size, palette, blocks);
     - **block-to-colour mapping without Mojang textures**: about 80 named blocks plus keyword rules (wool and concrete in 16 dye colours, wood types, stone types, glass becomes alpha, water and lava, air skipped), so the names are kept and the colours are ours;
     - gzip through `DecompressionStream` in the caller (the reader takes plain bytes and reports `isGzip`).
   - Write both prompts in `docs/handoff/prompts/battle/` (vox.txt, schematic.txt) with acceptance tests I work through by hand: a 2x2x2 `.vox` built byte by byte; a tiny `.schem` built from NBT bytes.
2. **The importer machine (glue).**
   - A machine preset (the first `machine`, QL4's kind) placed from the Toy Box: an **Importer**. Using it opens a drop window (a file picker as well).
   - The file is read, fitted and saved as a thing preset under **My imports**, which shows in the Prop Box, Place Props and Prop Placer options.
   - Every import carries `source` (the file name, and where it came from if the player says) and `license` (asked once: "I made it", "it is CC0 or CC-BY", "someone else's: only for me").
   - Rules:
     - "Only for me" can never be shared or sold (QL5).
     - Size limits: 2 MB per file, 96 cubed per tile, at most 64 tiles.
     - A loading bar while reading.
3. **The portal (glue + Arena).**
   - Kind `portal`: a frame model with a `link` param, hooked up to a machine with F7 Magic Cord (the importer feeds it a world).
   - Walking through it loads the world on the other side into its own scene, behind a loading bar, with a portal back.
   - The world comes from a link:
     - **World manifest**: a small JSON with a name, the licence, the source, the chunk size, the chunk URLs or a region-file URL, and a spawn point.
     - **Chunks**: our voxel format or Minecraft `.mca` regions, read with Range requests: the 4 KB header first, then only the chunks in view.
   - **Arena `@hm/chunkworld`**: the chunk index, an LRU cache (IndexedDB plus memory), the fetch priority by distance to the camera, greedy meshing in a worker, LOD rings, and the Low limits (radius, memory cap).
   - **The first world:** the owner finds an open-source one. The next session asks for its link and its licence, writes its manifest, and checks that its host allows cross-site reads (CORS) and Range requests. If it does not, convert it once and host it on our storage, with the owner's yes (a hosting cost).
   - **Players' own research:** the portal takes any link.
     - When the host refuses (CORS), it says so plainly: download the file and drop it into the Importer instead.
     - It never re-hosts what it streams.
     - Shown on the portal: the world's name, licence and source.
4. **Questline chapter:** "Your first machine and a portal" moves to chapter 3 of `QUESTLINE.md`, after the base and before digging. Steps, each pointing at a real `data-ui` name (B15):
   - place the Importer;
   - import the starter model (we ship one CC0 `.vox`);
   - wire the Importer to a portal;
   - step through to the owner's open-source world;
   - bring one thing back.
5. **Checks.**
   - Unit tests (Arena).
   - e2e:
     - import a bundled `.vox` from a test file input; a thing appears under My imports;
     - place it;
     - open a portal to a local test world served by `scripts/serve.mjs` (with Range support).
   - Perf: Low holds 50 fps inside the test world at a 4-chunk radius.

---

## 3. Milestone 3: the questline (QUESTLINE.md, with Milestone 2 as chapter 3)

The order and pieces are as `QUESTLINE.md` section 6 sets them:

1. **QL2 + QL1.**
   - Kinds `unlock`, `quest` and `questline`; a pure evaluator (**Arena `@hm/questline`**).
   - Today's tour becomes chapter 1.
   - The quest card replaces the tour card (same design vocabulary).
   - B15: the e2e checks that every step's `data-ui` exists.
2. **QL3 pixels + QL6 wallet.**
   - **Arena `@hm/pixels`**: the pixel store, mining, move and fill-back, the island budget, regrowth.
   - The wallet is harness-level (localStorage now; `ownerStorage` on RUN later).
   - Mining uses Game F10 Pit Digger and Simplified Dig Valley, with a toggle "keep what you dig".
3. **QL4 machines.**
   - **Arena `@hm/machines`**: a machine is a texgraph sub-graph with ports; chain checks; a cost estimate (bytes, bake ms).
   - Glue: machine models, a machine window (its knobs are the node's variables), outputs as texture presets, chains on F7 wires.
4. **QL5 selling.**
   - **Arena `@hm/market`**: simulated buyers, deterministic with a seed.
   - The Share dialog's "Up for sale" becomes real.
   - Licences gate selling (Milestone 2).
5. **D12 smooth models** (Milestone 4) before the rocket, because the rocket wants to look good in PBR.
6. **QL7 rocket.**
   - **Arena `@hm/rocket`**: blueprint parts, the "ship ready" check, flight numbers.
   - The shop sells a ready-made one; building your own uses the same parts and logic presets.
7. **QL8 crash and revival.**
   - The flight (H8), the crash (camera presets, effects, life states), the Shaman's resurrection.
   - A goblin avatar made from your look's colours (H4).
8. **QL9 racing questline** to the Shaman class (E9 `class` + `ability` kinds).
9. **QL10:** activities register their own questlines.

Owner questions to ask first (QUESTLINE.md section 8):
- Do pixels regrow?
- Can raw pixels be sold?
- Is the goblin a new avatar or a change to yours?
- Does the crash cost anything?

---

## 4. Milestone 4: the world looks finished

- **D12 smooth models.**
  - `@hm/smoothvox` is merged but not wired: `meshModel`, `decimate`, `lodChain`.
  - **Arena smoothvox rev 2**: palette entry to SetMix surface, triplanar shading, tangents.
  - Glue: PBR detail draws things with the smooth LOD chain; voxel flat keeps the blocks.
  - Start with the goblin, the palm, the rock. Cache by model revision.
  - Perf: triangle budget per tier.
- **D11 PBR ground:** pick up `@hm/pbrgrass` rev 2; check the grid repeat at 20, 50 and 100 m in screenshots.
- **D2 / D3 / D13 / D15:**
  - the volcano island dressing (groves of 3 to 7 palms, 3 palm variants, rocks in the shallows, driftwood, flower drifts, shore foam, a lava flow);
  - no floating trees: a test asserts every decor instance sits within 5 cm of the ground;
  - more models (Art);
  - satellite islands with coral and fish (instanced, few on Low).
- **Dither:**
  - D20 done, plus the distance slider and the filter.
  - Later: hand-made transition tiles (47-tile blob set, Art) chosen per block from its neighbours.
- **D8 lighting:** sun dial and light gizmos; separate post and render preset kinds.
- **P3 math textures:** the remaining file textures become texgraph presets, evaluated once (never per frame).

---

## 5. Milestone 5: performance on the minimum spec (P11)

Today, steady after warm-up:
- Low island, flat ground: 60 fps (13.7 ms a frame).
- Low island, PBR ground: about 50 ms a frame.
- Low Goblin Racing menu: 25 to 45 fps.
- Medium: about 98 ms a frame.

Targets:
- Low holds 60 fps on every screen; Medium holds 30.
- The slowest 5% of frames stays above 45 fps on Low.

Work:
- PBR ground on Low: fewer layers, no parallax, half-resolution detail.
- Medium: shadow cascades and SSAO tuned.
- The Goblin Racing menu and the home: the island behind the window at half resolution.
- Auto picks right on first run.

Gate: `scripts/perf.mjs` gets thresholds and fails the run when a screen misses its target on this PC (with a warm-up run first).

---

## 6. Milestone 6: shell, flow and Goblin Racing (STATUS sections 2, 5 and 6a)

- **C4** the main menu orbits your island and favourite presets.
- **C9 / C16 / E10** community, friends, chat, news:
  - `@hm/platform` LocalSim first, RUN later;
  - Multiplayer comes back with online play.
- **C10** My Islands: duplicate, delete, undo, first edit forks.
- **C12** no traps: the ui-map presses every button on every screen; zero dead ends.
- **C13** the under-age profile: no build mode, no community, no selling.
- **C15 / E7** Evolve as branches of an activity's presets; winner statues; majority rules.
- **E1 / E2 / E3** avatar creator parts (rigged), the avatar and rider split, defaults fork on first edit.
- **E4 / E8** the Goblin Racing menu as a live shot of the island, and spectate (input replays: the sim is deterministic).
- **E5 / E6** the racing profile, tournaments, the bookie (credits from the wallet), rankings.
- **E9** classes, Shaman first (with QL9).
- **H5 / H6** the harness carries the world; two launches on RUN (the owner deploys).
- **H7** the Goblin Racing island is the owner's island; the weekly vote.
- **H8** the universe: stars, solar systems, flying (with QL7 and QL8).
- **B11** controls rebinding (the window exists; rebinding missing).
- **B12** any AI can make presets: a documented preset JSON with a schema download, and an "Import preset" in the presets library.
- **B13** every "new" offers Quick, Wizard and Manual.
- **B15 / B18** the tour and the interface map stay in step; the screen map finds what the hotbar cannot edit (`hotbarCoverage` exists).

---

## 7. Milestone 7: polish pass (everything the player touches)

- **Words.**
  - Every button, tooltip and message in the plain SetMix voice: sentence case, active verbs.
  - Errors say what happened and what to do; no "coming" left that Milestone 1 should have built.
- **Design consistency.**
  - The V3 hotbar, the windows, the menus and the race screens in one vocabulary.
  - The track editor and the race screens still have their older look: redo them (load the design skill).
  - Goblin doodles on the white walls (B1, Art), auto-hide shelves.
- **Feel.**
  - Every action has its sound and its little motion; nothing is silent.
  - Undo works for everything placed.
  - Loading bars on every screen that loads.
- **Accessibility.**
  - Keyboard reachable everywhere, focus always visible.
  - Contrast AA.
  - Reduce motion respected.
  - Nothing flashes more than three times a second.
  - Subtitles for the tour's spoken words, if any are added.
  - Text size option.
- **Saves.**
  - Versioned saves with migrations (the player store and the islands).
  - A save survives a reload mid-change.
  - Backups in `backups/island/` stay clean of test props (memory: browser-save-stubs).
- **Crashes.**
  - An error boundary per screen ("Something broke here. Back to the island").
  - No page errors in e2e.
- **Docs.**
  - `BETA.md` and in-game help match the game.
  - A credits screen lists every third-party asset and its licence.

---

## 8. Milestone 8: release

1. **Content lock.** All Milestone 1 to 4 items done or explicitly cut by the owner. Owner sign-off on the volcano island, the tour, Game Mode.
2. **Legal.**
   - Every third-party asset listed with its licence: Kenney CC0, fonts, sounds.
   - Imported content rules enforced (Milestone 2).
   - No Mojang textures; no Roblox assets.
   - The privacy note (what is stored on the device and on RUN).
3. **Test passes.**
   - The whole gate.
   - e2e twice.
   - The ui-map shows no dead ends.
   - Perf on the minimum spec.
   - The owner's laptop test (`REPORT.md`, "How testing starts"), and a fresh-profile run on the other PC.
4. **Release notes and version** (`apps/web` version, shown in Settings, You).
5. **Deploy: the owner runs it** (not me). Two launches (H6). Then watch for issues the owner reports and fix them first.

---

## 9. Arena battle backlog (in send order; two at a time; CATCHUP 12ad routine)

| Order | Prompt (to write) | Package | For |
|---|---|---|---|
| 1 | vox.txt | `@hm/vox` | Milestone 2 importer |
| 1 | schematic.txt | `@hm/schematic` (+ NBT) | Milestone 2 importer |
| 2 | decals.txt (B1) | `@hm/decals` | stickers, splats, decals |
| 2 | puppet.txt | `@hm/puppet` | Live Puppet (IK) |
| 3 | tooljuice.txt (B6) | data | Game Mode feedback |
| 3 | toolanims.txt (B7) | data | Game Mode character animations |
| 4 | kart.txt | `@hm/kart` | Go-Kart |
| 4 | kinematic.txt | `@hm/kinematic` | Solid Boundaries, ladders, the goblin against walls |
| 5 | musicbox.txt | `@hm/musicbox` | Jukebox |
| 5 | chunkworld.txt | `@hm/chunkworld` | portals and streamed worlds |
| 6 | questline.txt | `@hm/questline` | QL1 and QL2 |
| 6 | pixels.txt | `@hm/pixels` | QL3 |
| 7 | machines.txt | `@hm/machines` | QL4 |
| 7 | market.txt | `@hm/market` | QL5 |
| 8 | smoothvox rev 2 | `@hm/smoothvox` | D12 |
| 8 | remesh.txt (C5) | `@hm/remesh` | DynMesh, Retopo |
| 9 | rocket.txt | `@hm/rocket` | QL7 |
| 9 | ragdoll.txt, hull.txt, navgrid.txt | as named | Advanced physics and avatars |

Each prompt follows `walkpath.txt`'s shape:
- START FROM A CLEAN SLATE; two code blocks; the STOP sentence; strict TypeScript, no imports in src;
- the API exactly;
- the rules;
- acceptance tests whose numbers I worked through by hand.

---

## 10. Things to settle with the owner (ask when the milestone comes up)

- The first open-source world's link and licence (Milestone 2); whether we may host converted worlds (cost).
- The questline questions above (Milestone 3).
- Whether to cut any Advanced buttons from the release (some are big: ragdoll, navmesh, reflection probe).
- The release name and date; the two launches on RUN.
- **The cut line** in section 12: what must be in 1.0.
- **Arena's terms:** may we ship the code and the art its models write?
- **Moderation:** who checks reported shares? Is the 1.0 showcase curated by the owner?
- **Analytics:** none in 1.0, only a Send feedback button. Opt-in analytics on RUN later?
- **Languages:** English only for 1.0? If other languages are likely, start the string table now; it is cheap early and expensive late.
- **Browsers:** may the e2e download Playwright's Firefox (a download needs the owner's yes)?
- **Hosting:** a world we convert and host costs storage and bandwidth. Who pays, and what is the limit?

---

## 11. Critique: the questions this plan was not asking, and the answers (owner: "do a full critique of the plan, what questions are we not asking? and solve for those questions")

Read as a reviewer would, the plan above was a feature list in build order. It never said:
- who the release is for;
- what a player does in their first hour;
- where the line between release and later falls;
- what breaks when real players put real content in.

Here are the twenty questions it skipped. Each has an answer and says what changed. The changes are already in sections 0.5, 1 and 12.

### The product

1. **Who is the release for, and what is the first hour?** Not answered anywhere. Answer:
   - Players aged 8 and up on a desktop browser, plus the grown-ups who build with them.
   - The first hour is the questline's chapters 1 to 3: wake up, a base, the first machine and portal. That needs Game Mode working end to end, and only Game Mode.
   - Changed: Milestone 1 has priorities. Game Mode's 18 buttons and its juice come first (P0). Simplified's are P1. Advanced's 32 are P2: built after the questline's first chapters, and some may go to 1.1 (section 12).
2. **Why come back tomorrow?** The loop was never written down. Answer: **build, show, play, earn, unlock.**
   - You build on your island and show it (friends, sharing).
   - You play (Goblin Racing, the questline).
   - You earn credits.
   - You unlock tools, the rocket, worlds behind portals.
   - Every milestone is checked against this loop: a feature that feeds none of the five waits.
3. **Where is the cut line?** 87 buttons, 18 Arena packages, a universe and online play will not all fit. Answer: section 12 splits the release into 1.0 must, 1.0 should and later. The owner confirms the split (question added to section 10).
4. **Which mode does a new player start in, and does the questline ever teach the other two?** Answer:
   - New players start in Game Mode. Every questline step must be doable in Game Mode; a test checks that each step's target is a Game Mode button or a world thing.
   - Simplified and Advanced get optional side quests ("go deeper"), unlocked by the main line.
5. **What do laptops without F-keys do?**
   - Many laptops send media keys unless Fn is held, so F1 to F12 may never reach the game.
   - Answer: the tabs stay clickable. **Shift + the wheel cycles tabs** (a V3.1 addition, Milestone 0.5). The Controls window lets players rebind the tab keys (B11).

### Engineering

6. **Can `island.tsx` take 87 more buttons?** It is about 2,000 lines, with every way's glue in it. Answer: before Milestone 1, move each tab's ways into `apps/web/src/build/ways/<tab>.ts` behind one registry: a way id maps to a handler, which gets the aim, the store, `say`, `fx` and the runtimes. Each new button is then one small handler with its own unit test (Milestone 0.5).
7. **Where do saves live, and how big can they get?**
   - localStorage holds about 5 MB.
   - Imported builds (up to 64 tiles of 96 cubed), many voxel things and the player store will overflow it, and the island is lost silently.
   - Answer: islands and models move to **IndexedDB**, behind one storage module with a quota check and a plain message when full. localStorage keeps small preferences.
   - Islands can be exported and imported as one `.setmix` file (backup and sharing by hand).
   - This blocks Milestone 2, so it goes in Milestone 0.5.
8. **What stops a player from placing so much that Low falls to 10 fps?** Nothing yet: lamps have a pool, nothing else has a limit. Answer:
   - **Island budgets** per tier: things, total voxels, lamps, effects (particles), characters, sound spots, imports.
   - A small meter in Simplified and Advanced (Game Mode shows it only when nearly full).
   - Placing over budget is refused with a plain message.
   - Measured on the minimum spec (Milestone 0.5, numbers in Milestone 5).
9. **Will the e2e scale?** One serial script, 139 checks, 5 minutes on this laptop, will be 400 checks and too slow and fragile. Answer:
   - Split it into suites (shell, island-game, island-simplified, island-advanced, import-portal, racing).
   - Each suite starts from a seeded save (the ui-map's seeds).
   - Run them in parallel pages.
   - Add pixel snapshots of key screens with a tolerance (pngjs, as the dither flicker check does).
   - The smoke path stays short.
10. **What if the Arena is down, or gets worse?** Answer:
    - Every prompt is complete and kept in the repo, so it can go to any model, or be written by the session directly (slower, same tests).
    - No milestone waits on a single battle: if one comes back weak twice, write it.
    - Ask the owner to confirm that Arena's terms let us ship what it writes (question added to section 10).
11. **Are imported files and portal worlds safe to read?** Untrusted binary input is the classic way to crash or hang a reader. Answer:
    - Readers are fuzzed: the Arena tests include truncated, oversized and garbage input; nothing may throw past the boundary or loop forever.
    - Size and time limits sit in the caller.
    - Portals fetch with `credentials: 'omit'`, run nothing (worlds are data, never scripts), cap the bytes per world, and time out.
    - Shared presets never carry runnable JavaScript (Logic stays blocks; the script sandbox only ever runs our own interpreter).
12. **What happens to old saves and shared presets when a kind changes?** Schemas have versions, but nothing tests migration. Answer: every kind change ships a migration and a test that loads a saved example from the previous version. Old islands from the beta are kept as fixtures.
13. **Which browsers?** Only Chrome is tested. Answer:
    - The release supports Chrome, Edge and Firefox on desktop.
    - Safari is "should work": WebGL2 and DecompressionStream need Safari 16.4+.
    - A manual check on Firefox and Edge before each release.
    - Adding Firefox to the e2e needs a Playwright browser download: ask the owner first.
    - Touch and phones are out of scope for 1.0, except racing's touch controls. Say so on the home.

### Safety, law and money

14. **Kids, sharing and chat.** The plan has community, chat, friends and selling, and the players include children. Answer for 1.0:
    - No open chat.
    - Sharing is friends-only or a curated showcase.
    - Every shared thing has a Report button.
    - The under-age profile (C13) cannot share, sell, chat or open portals to links. It can visit the owner's curated world.
    - Names are checked against a word list.
    - The owner decides who moderates (question added).
15. **Is the economy safe?** Credits, a bookie, selling. Answer:
    - In 1.0, credits are only earned, never bought, and there is no real money anywhere.
    - The bookie is hidden from under-age profiles.
    - If credits are ever sold for money, the bookie and any random rewards need a legal review first (betting and loot-box rules for minors).
16. **Do we own what we ship?** Answer, a release checklist (Milestone 8):
    - a trademark search for "SetMix" and "Goblin Racing";
    - the fonts' licences (Oxanium, Inter and Bricolage are OFL; keep the notices);
    - every Arena-made model and texture (the terms question above);
    - no Minecraft or Roblox assets, no Mojang textures;
    - a privacy note: what lives on the device, what on RUN, nothing sold or tracked.
17. **How do we learn what players struggle with after release, without spying?** Answer: no analytics in 1.0. A "Send feedback" button copies a short report (the screen, the last actions, the graphics tier, the browser) for the player to paste where the owner collects feedback. Opt-in analytics on RUN only if the owner wants it (question added).

### Craft

18. **Is there an art bible?** The Arena art agents make models one prompt at a time, and nothing keeps them one family. Answer, before mass-producing models: a one-page voxel art bible covering
    - the scale (0.125 m a voxel for blocks, the goblin's proportions);
    - the palette families per biome;
    - silhouette rules;
    - no outlines in the voxels;
    - how many colours a thing may use;
    - a reference sheet of the 10 best existing models.

    Every new model is reviewed against it.
19. **Is the sound release-quality?** Everything is synthesized, and nobody has mixed it. Answer: an audio pass in Milestone 7:
    - loudness levels per category;
    - loud effects (roar, siren) capped and ducked;
    - variety: no single sound repeating three times in a row;
    - music under the island at a low level, with an off switch.
20. **What does "polished" mean, so we know when to stop?** Answer, the release exit criteria:
    - Low holds 60 fps on every screen of the minimum spec; the slowest 5% stays above 45.
    - No "coming" in Game Mode or Simplified.
    - e2e is green twice; the ui-map shows no dead end.
    - No known crash.
    - Saves migrate.
    - The legal checklist is done.
    - The owner plays the first hour on his laptop and the other PC without help.

---

## 12. The release scope (critique Q3; the owner confirms)

**1.0 must have:**
- The V3 hotbar's Game Mode, complete with its juice.
- Simplified, complete.
- The questline chapters 1 to 7: island, base, machine and portal, dig, machines, a chain, selling.
- Bring your own voxel builds, and the owner's first open-source world.
- Goblin Racing as it is, plus spectate.
- My planet, avatars, Settings with everything in it.
- Saves on IndexedDB with export.
- Island budgets.
- Performance on the minimum spec.
- The polish pass.
- The legal checklist.
- The under-age profile.
- The release exit criteria of Q20.

**1.0 should have, if time allows:**
- Advanced's lighter half: selection tools, dope sheet, sound volumes, gates, factory and probe, camera rigs and bookmarks, the material sampler.
- D12 smooth models.
- The rocket and the crash (chapters 8 to 10).
- Satellite islands.

**Later (1.1 and on):**
- Advanced's heaviest tools: ragdoll, convex hull, hinge joints, navmesh, reflection probes, softboxes, triplanar, DynMesh, Retopo.
- The racing questline and classes.
- The universe (H8) and the Voxel Galaxy (H11).
- Online play: friends, chat, the weekly vote, evolution.
- Real-money anything (only after a legal review).
