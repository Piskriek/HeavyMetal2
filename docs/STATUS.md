# STATUS: everything the owner has asked for, and where it stands

Written 2026-10-02 at the owner's request ("a full report ... ready with details on what I've asked for") for the next session. **Read this file first, then `docs/OWNER_ASKS.md` (their exact words), then `docs/NEXT_PHASE.md` and `docs/PRODUCT_FLOW.md`.**

Rules for whoever works next (the owner has said these more than once):
1. Every message from the owner is checked against this file before work starts, and every ask is added here the same turn it is made, with its status. Half-done asks are marked PARTIAL, never DONE.
2. Update this file in the same commit as the work. A status line that is wrong is worse than no line.
3. Test it as the owner will see it: a real browser, a fresh profile, the production build (`npm run e2e`) and the dev server on the LAN. Look at screenshots. Say plainly what you could not test (the built-in browser cannot do pointer lock).
4. Let the Arena battle models write pure logic and presets (they are good at it); write acceptance tests before merging; integrate and polish yourself.

Status words: **DONE** (works, tested, seen in a browser) / **PARTIAL** (some of it works; the gap is stated) / **NOT STARTED** / **IN FLIGHT** (an Arena job is running) / **OWNER** (needs the owner's hands).

---

## 0. Where the owner tests, and how to run everything

| What | How |
|---|---|
| Dev server (owner tests here, from the laptop) | `npx vite --port 5192 --host 0.0.0.0 apps/web` in `E:\AI\hm2-art\harness\repo`, then `http://192.168.0.5:5192` (this PC: `http://127.0.0.1:5192`). It was running at the end of this session (also stray: a vite on 5230, `serve-prompts.mjs`, and `recv.mjs` on 8791: stop the first two if they are still there). |
| Production build as one html file | `npm run build` gives `apps/web/dist/index.html` (about 3.8 MB). `npm run host` serves it on 8080. |
| Gate before every commit | `node scripts/verify.mjs` (typecheck + every package test + build to ONE html) then `node scripts/e2e-smoke.mjs` (drives the production build in the installed Chrome; it stubs pointer lock and releases the mouse clip; it must never hold the owner's real mouse). 1079 tests at the end of this session. |
| Repo on the LAN (read-only, no GitHub token works) | `git clone git://192.168.0.5/repo` |
| Where the code lives | `E:\AI\hm2-art\harness\repo` (git, npm workspaces `packages/*`, app in `apps/web`). Not `C:\Work\repo` (that is the ai-stack repo and is not a git repo for this project). |
| Arena (battle models) | Six tabs are open in the built-in browser (tab-1 .. tab-6, plus tab-7 = Parts Lab). Chat URLs are in `docs/NEXT_PHASE.md` section 4. Max TWO new chats at a time or captchas appear; the owner clicks captchas, wait for them. NEVER sign in to Google/Arena. Send prompts by setting the textarea value and clicking the `Send message` button. |
| Getting code OUT of an Arena tab | Arena's page blocks fetch and images to localhost. Read each file from the CodeMirror view (`document.querySelector('.cm-content').cmTile.view.state.doc.toString()` after clicking the file in the tree), base64url a JSON `{path: text}` and set `location.href = 'http://127.0.0.1:8791/put?dir=NAME&name=bundle&i=0&n=1&unpack=1&d=...'`; `prompts/recv.mjs` (start it with `node prompts/recv.mjs`) writes the files to `E:\AI\hm2-art\harness\arena-out\NAME`. That navigates the tab away: open the chat URL again afterwards. For plain code blocks: `document.querySelectorAll('pre')`, the second of each pair is the raw text. |
| Prompts for Arena | `prompts/battle/*.txt`, preambles `prompts/preambles/{engineering,ui-design}.txt` (paste the preamble first: it makes the models plan and write tests that pass). |
| Standing limits | NOT authorised: opening PRs, merging, RUN deploy, scheduled tasks, paid actions, accepting terms, real-money anything, signing in anywhere, printing tokens. My GitHub token is invalid (no pushes). No secrets in Arena prompts. Heredocs with apostrophes break Bash here: write scripts with the Write tool and run them. |

Model note: the owner is switching to Opus 5.5 for the next session. This session ran on Sonnet 5.5.

---

## 1. The owner's principles (they apply to every task)

| # | Principle | Status |
|---|---|---|
| P1 | A **harness for a game engine**: every variable reachable, a preset for every single thing, so a 6-year-old can operate it and a 20-year-old can customise down to the exact variable and change the source. Play / Build / Pro tiers. | PARTIAL. Schemas, tiers (`play`/`build`/`pro`) and a generic inspector exist for every preset kind. Missing: "double-click to zoom through the hierarchy to the raw value with a gear" everywhere (only the Maker's preset tree has a version), the pro "change the source" path beyond QuickJS scripts. |
| P2 | **The goblin racer is only an example** of building a race from presets; the harness is the product. | Guiding rule. `docs/MAKE_YOUR_OWN_RACE.md` exists. |
| P3 | **Textures are hard stops**: replace file textures with math presets built from combinable pieces (noise, cellular, graphs, randomizers, warps, ramps, repeat controls) producing PBR channels; every layer editable; the game gets smaller. Ask Arena to recreate each PBR sheet. "That goes for any hard-coded stuff." | PARTIAL. `@hm/texgraph` (the node vocabulary) is merged but **not wired** (0 imports in the app). The island's default (flat) skin no longer uses texture files (hand-picked palettes). The PBR skin still loads 256 px `.webp` tiles from `public/textures`. `@hm/pbrgrass` (math grass) is merged but not wired and its quality is poor (see 6). |
| P4 | **Models are presets** (voxel, no mesh files); a Minecraft-inspired high-detail voxel example built by Arena; pro mode needs proper 3D sculpt/manipulation tools. | PARTIAL. `model` preset kind, `@hm/voxel`, `@hm/voxelsculpt` (sculpt inside focus mode in the Maker). Pro-mode gizmos (move/rotate/scale) do not exist. |
| P5 | **Sound, animation and every root need good manipulation tools** and are presets too (plug randomizers, graphs, timelines, textures, data streams into any value). | PARTIAL. Sound lab, modulators/drivers (wobble, pulse, ...), `@hm/motion` exist. No timeline/animation editor UI, no speaker/waveform tools on the island rail (listed as "soon"). |
| P6 | **Modular above all.** Platform ports (`LocalSim` + `Run` adapters), never call the RUN SDK directly. | PARTIAL. `@hm/platform` has both adapters; the app barely uses it. |
| P7 | Launch on **run.studio** (static single file; South Africa). Automate what can be. | Build is one html file. **OWNER**: RUN deploy needs the owner's login. |
| P8 | **Sliders never lock** (rules in `docs/OWNER_ASKS.md`, last section). | DONE for every number in the shared inspector (`@hm/ui`). PARTIAL overall: bespoke sliders in the sound lab, HUD editor, sculpt bar, racing menu still stop at their ends. |
| P9 | **"Slow and steady is well-reasoned steps"**, use extra reasoning, let the Arena models code. | Process rule. |
| P10 | **Don't wait on Arena while idle**; keep several jobs in flight; ask the owner only for outward/irreversible actions and captchas. | Process rule. |

---

## 2. Flow and shell (screens, navigation)

| ID | Ask (date) | Status | Where / what is left |
|---|---|---|---|
| C1 | Always boot to the main menu: Play, Multiplayer, My Island, Settings, galaxy behind (10-02) | DONE | `apps/web/src/shell/shell.tsx`. |
| C2 | My Island zooms galaxy to planet preset to island to goblin and stops, third person (and first person with V) | DONE | `myIsland()` + `GalaxyCanvas.diveTo`. |
| C3 | Galaxy as a viewport: the menu goes away after the dive, an auto-hide galaxy bar on Esc with "Back to galaxy" and hierarchy navigation (left = up, right = into selected) | DONE | `shell/galaxy-bar.tsx` (uses `@hm/uistack` `Navigator`). |
| **C4** | **NEW (10-02 19:47): the main menu must be a stunning orbiting view of your current island and your favourite preset** | **NOT STARTED** | Today the menu is the galaxy. Design in section 5, item 3. |
| **C5** | **NEW: the galaxy view: remove the big glow; make the star field an inverse black-and-white field; planets in colour at the size of the blue-pink planet, sitting above the star field like a marker with a line to the star they connect to and a small box around the star; the planet grows as the mouse gets near and highlights with a dialog showing the planet / activity info** | **NOT STARTED** | `shell/galaxy.tsx` (three.js `GalaxyCanvas`). Design in section 5, item 4. |
| **C6** | **NEW: "my island should show after you click Play and have to create your goblin and name them"** | **NOT STARTED** | Today Play opens the Activities window. Needs a first-run flow: Play, then (no goblin yet) create your goblin (look + name), then your island. Design in section 5, item 2. |
| C7 | Esc menu with the most logical places: Main menu, Build mode, Activities, Multiplayer, My islands, **My Avatar** | PARTIAL | `island.tsx` menu has all but My Avatar (no avatar creator yet). |
| C8 | Activities window: Goblin Racing is a default preset you can select; Create new / Duplicate / Remove (defaults can only be hidden) | DONE | `@hm/activities` registry in the shell. |
| C9 | Multiplayer = the galaxy hub with the Goblin Racing planet (hosting the tournament) highlighted; top tabs incl. Community (share/view presets, buy/sell/trade); other activities appear as hosted; click one for details and jump in | PARTIAL | Hub and a simulated community exist (`shell/community.tsx`, credits only). No friends list, no chat, no real listings; planet info dialogs missing (see C5). |
| C10 | My Islands: create / duplicate / delete / undo like Activities; defaults are presets and the first edit forks them into a renameable branch that becomes the default; last visited on top | PARTIAL | `@hm/islands` + `islands/island-store.ts` + the My islands window; first-edit fork exists with a toast. Not verified by the owner. Bundles are not chunked for RUN's 100 KB UGC limit. |
| C11 | Build mode must show MY island, not the racetrack | PARTIAL | The Maker opens the active island's world; racing has its own map key. Not re-verified on the laptop. |
| C12 | Pages connect, no traps ("you can get stuck") | PARTIAL | One shell with a route table; e2e walks menu, activities, racing sections, hub, community, island, Esc menu, build, back. Not every route is covered; the Maker's inner panels are not a route. |
| C13 | Under-age profile: friends-only chat, no Community tab, no build mode | PARTIAL | The grown-up switch hides build mode. Chat/Community gating not built (no chat). |
| C14 | Remove the buttons **Items, Models, Evolve, Interface, Rules, Sounds** from the editor | **NOT DONE** | They are still in `apps/web/src/maker/maker.tsx` (panel toggles). Their panels should move into the preset tree. |
| C15 | **Evolve** = branch management of an activity's settings | NOT STARTED | `@hm/evolve` and `@hm/lineage` exist; the Evolve panel in the Maker is old. |
| C16 | Header buttons: "Preview" becomes **Back to Island**; "Share" becomes **Community** (friends list, quick connections, tabs for activities with news/events, general chat, share presets) | PARTIAL | "Back to Island" and a Community button exist in the Maker. The panel behind Community is the simulated listing only. |

---

## 3. Island, world and looks

| ID | Ask | Status | Where / what is left |
|---|---|---|---|
| D1 | Starting island textures that match the voxel goblin (flat, stylised) | DONE | Flat skin from `FLAT_PALETTES` (hand-picked tones per surface, half-metre blocks). |
| D2 | **The default island should look great**: bigger, a volcano in the middle maybe; the owner repaints it | PARTIAL | "Volcano Isle" template (cone, crater, lava) is the default; dressed with voxel palms/rocks/bushes/grass/flowers. **The owner says it still looks bad** (10-02 19:47). Known problems in section 6. |
| **D3** | **NEW: "trees floating everywhere and not even good looking ones"** | PARTIAL | Root cause found and fixed: the foliage recipes (`@hm/scatter`) define a cylinder's height as `scale.y` metres but the renderer doubled it and shrank it by the radius, so trunks were a quarter long and crowns hung in the air. Fixed in `render/src/decor.ts` (`partScale`) with tests that every prop stands on the ground. Palms, rocks, bushes, grass clumps and flower patches are now voxel models (`@hm/voxelart`, `@hm/voxelnature`) so they match the goblin. **Still weak**: palms look thin and sit in regular rows; bushes and grass are small; no variety of size/colour; no forest/clearing structure; no LOD; look at ground level has not been judged. |
| D4 | Mouse captured on click, no cursor, mouse look (not right-click), released on Esc | PARTIAL | Pointer lock on the shell root, explicit `exitPointerLock` on Esc, soft-aim fallback after 3 refusals. **Cannot be tested in the built-in browser**; the owner has to confirm on the laptop. |
| D5 | Crosshair look; V = first person | DONE | |
| D6 | Walk / third person / **fly** toggle, top right next to "Back to Island" | **NOT DONE** | Only V (first/third). Fly exists in the Maker's focus mode (`veil.mode`), not on the island. |
| D7 | Painting the ground changes the texture | PARTIAL | Paint tool uses the surface chosen with the Tab palette; flat blocks show the palette colour. Needs the owner to confirm it reads clearly. |
| D8 | Proper lighting; lighting presets that are **editable**; lighting **manipulators**; post-effect presets; render presets; this PC renders Ultra | PARTIAL | DONE: `@hm/lighting` (18 setups from Arena Light Lab option B, blend, time of day, 70 variables as the `light-setup` kind), `LightingRig` + `PostChain` (GTAO, bloom, tone mapping, grade, FXAA), tiers low..ultra with auto-detect, Lighting window (Esc, Lighting). NOT DONE: manipulators (sun dial, light gizmos in the world), separate `post` and `render` preset kinds (they are folded into the light setup), saving a render preset, golden-hour/sunset haze is heavy from the island overview. |
| D9 | Scenes with different lighting in the browser, pick the best (Light Lab) | DONE | Option B (inspector, 18 looks) taken; option A had the nicer island scene. |
| D10 | **PBR reveal**: a tutorial button switches presets to the PBR default skin | NOT STARTED | `@hm/tutorial` engine is merged and unwired; the PBR skin exists as `profile.skin = 'pbr'` but is ugly (grid repeat, normals disagree). |
| D11 | PBR racing texture is bad (grid repeat, normals disagree with colours): make a modular PBR grass from code that follows the preset parameters | IN FLIGHT | `@hm/pbrgrass` v1 merged (kept, passes its tests, but colours are very dark and blades read as noise). Revision 2 was sent to Arena tab-1 (`prompts/battle/pbrgrass-rev2.txt`, measured numeric targets); the first revision came back worse and was NOT merged. Not wired into the terrain shader (needs stochastic tiling + macro variation). |
| D12 | Merge voxel boxes into solid models and **smooth the geometry** instead of just adding voxels; add PBR from reference + voxel math textures; high-res math textures; analyse references with math and do the reverse into presets (`texfit`) | NOT STARTED beyond the mesher | `@hm/smoothvox` (surface nets) is merged and unwired; `texfit` not written. |
| D13 | Lots of voxel models and pieces to build characters | PARTIAL | 48 head parts, 66 body parts, 7 hero models, 3 nature models. More waves are planned only after one accepted example per kind (they are accepted now). |
| D14 | Scatter: foliage/rocks over the island | DONE/PARTIAL | `dress()`; rules in `@hm/scatter`; the look is the problem (D3). |

---

## 4. Build mode, tools and presets

| ID | Ask | Status | Where / what is left |
|---|---|---|---|
| B1 | The studio interface exactly as in the owner's prompt (`docs/OWNER_ASKS.md`, end): white wall, warm off-white, **vibrant 3D goblin doodles painting the walls**, no rounded corners / bevels / shadows / glows / cartoony fonts, a stylish modern font, **preset examples (thumbnails) rather than text**, auto-hide shelves, toolbar pointer/brush/hand/timeline/speaker/camera/person/delete with slide-outs per tool, double-click zoom through the preset hierarchy to the raw value with a gear, Esc back out, planet/sun/galaxy ask when you go up | PARTIAL | `studio.css` is the default look (Inter + Bricolage Grotesque 800, terracotta accent, hairlines). Rail + slide-outs on the island: DONE. NOT DONE: goblin doodles on the walls, auto-hide shelves, thumbnails instead of text in most lists, hierarchy zoom everywhere, the person tool opening the character branch. |
| B2 | Slide-out tool sets from the catalog (113 sub-tools across 9 sets) | PARTIAL | `@hm/toolcatalog` drives the rail. **11 sub-tools are wired** (`apps/web/src/build/wiring.ts`: pick, brush, eyedropper, draw, clay buildup, inflate, smooth, flatten, voxel dig, voxel add, delete). The other ~100 show as dashed "not on the island yet". |
| B3 | Esc contract: Esc hides open toolbars; with none open, Esc opens the jump menu; **any floating window is movable and closable (x / Esc)** | PARTIAL | Esc closes the slide-out, then the menu. `@hm/uistack` (DismissStack, WindowManager, Shelf) is merged but only its `Navigator` is used. The Lighting window and the sculpt bar are NOT movable. |
| B4 | Hold **Tab** for a palette of suggested presets (like an emote wheel but opaque top right, not blocking the view), wheel selects prev/next | DONE | `PaletteWheel` (`@hm/buildkit`) + `TabPalette`. Categories: Ground, Things, Roads. "Suggested" is just all of them (no suggestion logic). |
| B5 | Right click is the opposite of left click | PARTIAL | Sculpt lowers, paint uses a smaller brush, place/delete removes. Other tools none. |
| B6 | On-screen text describes the selected tool, **controls live in Settings > Controls** | DONE | `ToolSay` + `shell/controls-list.tsx` (read-only list + live mouse-capture status). Not rebindable. |
| B7 | **Customisable hotbar**; hotbar buttons are presets with plug points: in build mode select a button, Edit, "+ attribute" lists every preset kind that can plug in (on click, on delete ...), choosing one gives an editable parameter that can itself be a preset (a sprite) | **NOT STARTED (UI)** | `@hm/plugs` (plug points, validation) is merged and unwired. Hotbar slots hold plain items (`build/hotbar.ts`) with a hard-coded sprite and sound per item. |
| B8 | Save/Share dialog: "Share with the community?" Keep private / Up for sale / Share freely / Share with friends + name + description | NOT STARTED | `ShareDialog` in the Maker is the old map-code dialog. `@hm/plugs` has the licence logic. |
| B9 | Satisfying by default: every edit plays a sprite burst and a noise | PARTIAL | Sprites (`Bursts`) and sounds on the island tools. `@hm/juice` (sprite/sound presets) merged, unwired; literals still in `hotbar.ts`. |
| B10 | A **tutorial** that guides placing your first Goblin Racing preset and tweaking it; skip a dialog, close it permanently or until next time | NOT STARTED (UI) | `@hm/tutorial` engine merged and unwired. |
| B11 | Controls window with rebinding, sensitivity, invert Y, FOV, left-handed | NOT STARTED | Only the read-only list. |

---

## 5. Characters, racing and the world

| ID | Ask | Status | Where / what is left |
|---|---|---|---|
| E1 | **My Avatar**: a cool 3D voxel goblin creator (the owner asked Arena to make it) | PARTIAL | Parts (`@hm/voxpartshead` 48, `@hm/voxpartsbody` 66), `@hm/assembler` (spec to model, tests), Parts Lab page `/parts.html` with thumbnails of every part and 12 assembled goblins. **No creator UI.** Known: proportions look odd, `randomSpec` couples arms and hands, parts' palettes are limited. |
| E2 | Avatar / rider split: the goblin rider is not your avatar but starts as a copy; swap or edit it in a "goblin racer" preset | NOT STARTED | |
| E3 | The voxel defaults (and every default) are presets you can duplicate then edit; first edit forks | PARTIAL | Islands and lighting fork on first edit; the goblin and models do not yet. |
| E4 | Goblin Racing menu is a **live shot of the island** with live events advertised and an easy spectate button | NOT STARTED | Needs replay recording (inputs per tick) which does not exist; the sim is deterministic so it is feasible. Current menu is a plain list. |
| E5 | Racing profile: stats, rating, money, bets, history | PARTIAL | `shell/profile.ts` (credits, tournament state), simulated; screens are basic. |
| E6 | Tournaments with sign-up, no-show penalties; the bookie takes credit bets; rankings; customise your goblin ball | PARTIAL | `@hm/activities` `Tournament` state machine in the shell; credits only (standing rule). No server, so heats are simulated. |
| E7 | **Evolution**: entering the planet = an instance of the latest canon; spectate and change presets; changes that affect racing prompt "suggest for the next evolution" or "keep as a branch"; branches branch; week-long tournaments; winners' avatars become giant statues in the next island evolution; the next evolution is chosen by majority rules (the preset most used per slot) | NOT STARTED | Design in `docs/EVOLUTION.md`; packages `@hm/lineage`, `@hm/evolve` merged and unwired. |
| E8 | Spectate presets: first person, **embodied** (you walk as a goblin who can die, go to jail, obey goblin laws, wait for resurrection as a ghost), ghost, cinematic (jumps to action) | PARTIAL | `@hm/camerarig` has chase, first-person, orbit, helicam, topdown, free, ghost, director; used in the race. Embodiment, death, jail, resurrection: NOT STARTED. |
| E9 | A **shaman** class resurrects bodies using game presets; people copy classes; week 2 balls break and a mechanic class repairs; each week adds a class | NOT STARTED | Needs the class preset kind and a scripted NPC. |
| E10 | Friends list, quick connections, general chat, tabs for activities with news/events, share presets with friends | NOT STARTED | Needs the Platform adapters (RUN rooms and chat); `LocalSim` could fake it for offline tests. |

---

## 6. Honest quality assessment (why the owner says it "looks like a turd")

1. **Island ground level has never been judged by a person.** Every screenshot in this session was the overview or a quick walk. Walk it, in third person, from the beach to the cone, and fix what is ugly.
2. **Trees**: grounded now, but thin palms in regular rows (the Poisson scatter is uniform), small bushes and grass, one palm shape, no colour or size variety, no clearings or groves, nothing at the water's edge, sparse near the cone. Needs: clustering rules (groves of 3 to 7 with a tall one in the middle), size and lean variation, 3 palm variants, rocks in the shallows, driftwood, reeds, a beach strip with shells, flowers in drifts not dots.
3. **The cone is a smooth lump**: flanks need terraces, gullies, rock bands, a lava flow down one side, steam particles at the crater, a glow lamp; the lowland is flat green.
4. **The sea** is a flat translucent disc over a deep-colour disc: needs animated waves/foam at the shore, a depth gradient.
5. **The sky and lighting** are fine at noon; golden hour is a fog soup from above; clouds are missing.
6. **The goblin** is the old model, small in frame, no animation (a walk cycle).
7. **UI**: the white-wall style is applied but there is no goblin doodle art, no auto-hide shelves, text lists where the owner wants thumbnails.
8. `@hm/pbrgrass` albedo is nearly black and blades read as noise.
9. Known test gaps: no automated check for pointer lock, none for the Maker's panels, no golden-image tests for looks.

---

## 7. Arena jobs: in flight and parked

| Job | State | Next |
|---|---|---|
| pbrgrass rev 2 (tab-1, chat `01a0fdbb-6528-7c26-8197-5f89bf3877e2`) | Sent 10-02; generating at the time of writing | Pull with the recv.mjs recipe in section 0; compare against `prompts/battle/pbrgrass-rev2.txt` targets (means per preset, luminance std 22 to 45, ao 0.35 to 0.9); merge only if its tests pass and the Grass Lab (`/grass.html`) looks right. v1 is in the repo. |
| lightlab | MERGED as `@hm/lighting` (option B). Option A's island scene was nicer: its source is only in tab-5's chat. | Optional: harvest A's scene ideas for the island. |
| voxparts-head / body, smoothvox, toolcatalog, islands, assembler, uistack, plugs, activities, tutorial, juice | MERGED (see section 8 for which are wired) | |
| Not yet written | `texfit`, `replay` (input recorder/player), `thumbnails`, `chatsafety`, `postfx` data presets, `racing profile` maths, a **trees and terrain dressing** brief, a **galaxy renderer** brief, an **avatar creator UI** brief | Write these first; they are the Arena-suitable pieces of the plan below. |

---

## 8. Built but not wired (so it does nothing for the owner yet)

`@hm/texgraph` (math textures), `@hm/pbrgrass`, `@hm/smoothvox`, `@hm/plugs` (button presets, publish), `@hm/juice`, `@hm/tutorial`, `@hm/evolve`, `@hm/lineage` (used only by islands), `@hm/uistack` (only `Navigator`), `@hm/platform` (adapters), `@hm/assembler` + parts (only Parts Lab), `@hm/looks` (replaced by `@hm/lighting`; delete it once nothing imports it), `@hm/goblins`, `@hm/racers`, `@hm/raceflow`, `@hm/sim`, `@hm/physics` (used through `@hm/engine`).

---

## 9. The plan (session of 2026-10-03, Opus 5.5). The owner's latest message wins where it differs from older ones

### 9.1 What the owner asked for on 2026-10-03 (new IDs)
| ID | Ask | Plan |
|---|---|---|
| N1 | A moves right: left/right are swapped for the goblin | Fix the strafe vector in `island.tsx`. |
| N2 | Z-fighting with the water while the overview rotates | Near plane follows the camera distance (far views get a bigger near plane), water drawn with a depth bias. |
| N3 | First person must give me the mouse to click presets | E (preset window), Tab (wheel), T (tools) and the hotbar tabs all release the mouse; clicking the world captures it again. The wheel is clickable while the mouse is free. |
| N4 | Trees adapt when I change the terrain; behaviour presets; dug ground is no longer grass | `@hm/worldrules` (pure): `plant` behaviour presets (allowed ground, follow ground, die when dug / drowned / too steep) and `world-rules` (dig exposes soil, deep dig exposes rock, underwater becomes sand). Applied when a stroke ends, in the same undo step. Editable in the Sculpt tab. |
| N5 | No animation on my character; "we need presets!" | `@hm/anim` (pure): bones (body, head, arms, legs), `animation` presets (idle, walk, run, jump, use, wave, dance ...) as editable numbers, an animator that picks and blends them from movement. Render: the goblin split into bones (`AvatarView`). Animate tab plays and edits them. |
| N6 | Plan everything to the T | This section; updated as work lands. |
| N7 | I don't know how to switch to PBR: buttons | Top-right buttons: Flat / PBR (and in the Lights tab). |
| N8 | Wherever a preset could show a preview, show it | Preset cards everywhere: ground swatches, model thumbnails, light gradients, animated stick-figure previews for animations, sound envelopes, tool icons, activity planets. |
| N9 | The hotbar is wrong: F1 to F12 switch tabs: Select, Paint, Sculpt, Animate, Sound, Lights, Activities, Avatar (P); E opens your preset window to customise with the mouse | Tabs on F1..F10 (F11 and F12 belong to the browser: fullscreen and dev tools). F9 Things (place models), F10 Camera. Each tab has 9 slots (1 to 9) holding presets of that tab; E opens the preset window for the tab (cards with previews, click to put in a slot, Edit opens a movable attribute editor). |
| N10 | Studio mode = first person without the goblin, you fly, more settings windows open, tools have attribute editors you can open, close and move, focus on an item and hide the others | Walk / Studio toggle top right (and B). Studio: free fly camera, cursor free, tools act where the cursor points, attribute editor windows (uistack WindowManager), Focus (F) and Hide others (H) on the selected thing. |
| N11 | Final report: where the game stands, what is missing, how testing starts, the UI is connected; push to main and archive the old main so another session can continue | Last step of the session: `docs/REPORT.md`, push. |

### 9.2 Order of work this session
1. Bugs N1, N2, N3 (mouse), plus the world-rules core (N4) so the tools work.
2. Presets: `@hm/anim`, `@hm/worldrules`, tool presets + tabs + hotbar model in `@hm/buildkit` (pure, tested).
3. The new build HUD on the island (N9, N8, N7): tab strip with F keys, slots with previews, preset window (E) with cards and attribute editors (movable windows), clickable wheel, top-right Walk/Studio, Flat/PBR, 1st/3rd.
4. Animation in the renderer (N5): bones, animator, Animate tab with live previews.
5. Studio mode (N10).
6. Play flow: Play, create and name your goblin, then the island (C6); P opens the avatar tab.
7. Main menu = orbiting view of your island (C4).
8. Galaxy redesign (C5).
9. Then, as time allows: hotbar button plugs (+ attribute) and publish (B7, B8), tutorial and PBR reveal (B10, D10), remove the old editor buttons (C14).
10. Report, push to main, archive the old main (N11).

Each step ends with: tests green, `npm run e2e` green, a screenshot looked at, this file updated.

### 9.3 Older plan items still open (from 2026-10-02)
Dress the island better (groves, variants), sculpt detail on the cone, shoreline foam, clouds; goblin doodle art on the walls; auto-hide shelves; full avatar creator; Goblin Racing live shot + spectate (needs replays); evolution, classes, community and chat on the Platform adapters; math textures (texgraph, pbrgrass rev 2, texfit, stochastic tiling); smoothvox; RUN deploy (owner login).

## 10. File map (where things are)

- App: `apps/web/src/shell/*` (menu, galaxy, galaxy-bar, hub, activities, racing menu, islands window, settings, controls list), `island.tsx` (walking, build HUD), `build/*` (rail, slide-out, palette, wiring, hotbar, controller), `lighting/lighting-window.tsx`, `look.ts` (scene lighting glue), `maker/*` (the old full editor: panels, preset tree, focus mode, drivers), `avatar/*` (Parts Lab, thumbnails), `islands/island-store.ts`, `studio.css` (the look).
- Packages (all pure and tested unless noted): `lighting`, `render` (three.js; `LightingRig`, `PostChain`, `DecorView`, terrain skin shader), `terrain` (+ volcano), `ui` (inspector, SmartSlider logic in `range.ts`), `buildkit`, `toolcatalog`, `voxel*`, `voxelnature`, `scatter`, `islands`, `activities`, `engine`, `kernel`, `contracts`.
- Docs: this file, `OWNER_ASKS.md`, `NEXT_PHASE.md` (milestones M0 to M8, older), `PRODUCT_FLOW.md`, `EVOLUTION.md`, `MAKE_YOUR_OWN_RACE.md`, `handoff/CATCHUP.md` (workflow loop and history; section 12aa is the latest), memory in `C:\Users\RAMPAGE\.claude\projects\C--Work-repo\memory\`.
