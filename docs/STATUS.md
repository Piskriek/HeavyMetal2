# STATUS: everything the owner has asked for, and where it stands

Kept since 2026-10-02; rewritten 2026-10-03 at the end of the Opus 5.5 session. **Read this file first, then `docs/REPORT.md` (where the game stands and how testing starts), then `docs/OWNER_ASKS.md` (the owner's exact words), then `docs/PRODUCT_FLOW.md`.**

Rules for whoever works next (the owner has said these more than once):
1. Every message from the owner is checked against this file before work starts, and every ask is added here the same turn it is made, with its status. Half-done asks are marked PARTIAL, never DONE.
2. Update this file in the same commit as the work. A status line that is wrong is worse than no line.
3. Test it as the owner will see it: a real browser, a fresh profile, the production build (`npm run e2e`) and the dev server on the LAN. Look at screenshots. Say plainly what you could not test (the built-in browser cannot do pointer lock).
4. Let the Arena battle models write pure logic and presets (they are good at it); write acceptance tests before merging; integrate and polish yourself.
5. When the owner contradicts an older ask, the latest message wins (owner, 2026-10-03).

Status words: **DONE** (works, tested, seen in a browser) / **PARTIAL** (some of it works; the gap is stated) / **NOT STARTED** / **IN FLIGHT** (an Arena job is running) / **OWNER** (needs the owner's hands or eyes).

---

## 0. Where the owner tests, and how to run everything

| What | How |
|---|---|
| Dev server (owner tests here, from the laptop) | `npx vite --port 5192 --host 0.0.0.0 apps/web` in `E:\AI\hm2-art\harness\repo`, then `http://192.168.0.5:5192` (this PC: `http://127.0.0.1:5192`). |
| Production build as one html file | `npm run build` gives `apps/web/dist/index.html` (about 3.9 MB). `npm run host` serves it on 8080. |
| Gate before every commit | `npm run verify` (typecheck + every package test + build to ONE html) then `npm run build && npm run e2e` (e2e drives the **built** file in the installed Chrome: build first or it tests the old one; it stubs pointer lock and releases the mouse clip; it must never hold the owner's real mouse). **1121 tests and 60 e2e checks pass** at the end of the 2026-10-03 session. |
| Repo | `E:\AI\hm2-art\harness\repo` (git, npm workspaces `packages/*`, app in `apps/web`). Pushed to GitHub as `main` at the end of 2026-10-03 (see `docs/REPORT.md`, "Hand-over"). `C:\Work\repo` is NOT this project. |
| Arena (battle models) | Chat URLs are in `docs/NEXT_PHASE.md` section 4. Max TWO new chats at a time or captchas appear; the owner clicks captchas. NEVER sign in to Google/Arena. Send prompts by setting the textarea value and clicking `Send message`. |
| Getting code OUT of an Arena tab | Arena blocks fetch and images to localhost. Read each file from CodeMirror (`document.querySelector('.cm-content').cmTile.view.state.doc.toString()` after clicking the file), base64url a JSON `{path: text}` and set `location.href = 'http://127.0.0.1:8791/put?dir=NAME&name=bundle&i=0&n=1&unpack=1&d=...'`; `node prompts/recv.mjs` writes the files to `E:\AI\hm2-art\harness\arena-out\NAME`. That navigates the tab away: open the chat again afterwards. |
| Prompts for Arena | `prompts/battle/*.txt`, preambles `prompts/preambles/{engineering,ui-design}.txt`. |
| Standing limits | NOT authorised: opening PRs, merging others' work, RUN deploy, scheduled tasks, paid actions, accepting terms, real money, signing in anywhere, printing tokens. No secrets in Arena prompts. Heredocs with apostrophes break Bash here: write scripts with the Write tool and run them. Authorised once (2026-10-03): push this repo to `main` and archive the old `main`. |

---

## 1. The owner's principles (they apply to every task)

| # | Principle | Status |
|---|---|---|
| P1 | A **harness for a game engine**: every variable reachable, a preset for every single thing, a 6-year-old can operate it and a 20-year-old can customise down to the exact variable and change the source. | PARTIAL. Every island tool, animation, sprite burst, camera shake, light, world rule, plant behaviour, avatar look, control setting and tour step is a preset with an editor (the shared inspector). Missing: the hierarchy zoom "double-click down to the raw value" everywhere; the pro "change the source" path beyond QuickJS scripts. |
| P2 | **The goblin racer is only an example**; the harness is the product. | Guiding rule. |
| P3 | **Textures are hard stops**: replace file textures with math presets (texgraph). | PARTIAL. Flat skin is palettes (no files). The PBR skin still loads 256 px `.webp` tiles (now made seamless at load and blended with a macro tile; they look fine but are files). `@hm/texgraph` and `@hm/pbrgrass` are not wired. |
| P4 | **Models are presets** (voxel); pro sculpt tools. | PARTIAL. Voxel model presets everywhere (palms, rocks, bushes, flowers, grass, goblin). Island Select tools move, turn, size, copy, delete, focus, hide. No 3D gizmos. |
| P5 | Sound, animation and every root have good tools and are presets. | PARTIAL. Animation presets with live stick-figure previews and an editor; every sound is a preset: the Sound tab editor sets volume, pitch, on/off and reshapes it layer by layer (the Sound Lab: roll, wiggle, layers, JSON), saved with the island; sprite and shake presets. No timeline editor; the Sound Lab's own sliders still stop at their ends. |
| P6 | Modular; platform ports (`LocalSim` + `Run`), never the RUN SDK directly. | PARTIAL. `@hm/platform` exists, the app does not use it yet (shares and the community are local). |
| P7 | Launch on **run.studio** (one static file). | Build is one html file under the size budget. **OWNER**: deploy needs the owner's login. |
| P8 | **Sliders never lock.** | DONE in the shared inspector (every editor on the island and Settings uses it). Bespoke sliders remain in the Sound Lab layers, the racing menu and the Maker's sculpt bar. |
| P9, P10 | Reasoned steps; keep Arena busy; ask only for outward actions. | Process rules. |

---

## 2. Flow and shell (screens, navigation)

| ID | Ask | Status | Where / what is left |
|---|---|---|---|
| C1 | Always boot to the main menu: Play, Multiplayer, My Island, Settings | DONE | `shell/shell.tsx`. |
| C2 | My Island zooms to your goblin, third person (V = first) | DONE | From the menu it flies down from the orbit to the goblin. |
| C3 | Galaxy bar on Esc with Back to galaxy and hierarchy navigation | DONE | `shell/galaxy-bar.tsx`. |
| C4 | Main menu = a stunning orbiting view of your current island and favourite preset | PARTIAL | DONE: the menu sits over your own island (IslandWalk `showcase`): the camera sways round your goblin on the side away from the island's middle, so the goblin stands in the right third facing the camera with the volcano rising behind (it used to clip through the cone); Play/My Island fly down to it. Missing: the "favourite preset" part (no favourite is chosen or shown yet; idea: the most used preset of the week as a statue/prop in the shot). |
| C5 | Galaxy: no big glow; inverse black-and-white star field; planets in colour as markers above the field with a line to their star and a small box round the star; planet grows near the mouse and shows a card | DONE | `shell/galaxy.tsx` rewritten as a star chart (white paper, black stars in four arms, pinned planets, square box round each star, hover grows the planet and shows a card with what is played there and who is playing). e2e checks the card. |
| C6 | Play, then create and name your goblin, then your island | DONE | `avatar/create-goblin.tsx` (turntable with the animated goblin, 6 ready-made looks, colours, dice, a checked name). |
| C7 | Esc menu: Main menu, Build/Studio, Activities, Multiplayer, My islands, My Avatar | DONE | Plus Lighting, Race track editor, Share my island, Show the tour. |
| C8 | Activities window (Goblin Racing default; create/duplicate/remove) | DONE | |
| C9 | Multiplayer = galaxy hub, Goblin Racing highlighted; Community tab | PARTIAL | Planet cards on hover DONE; Community lists simulated presets plus **Your shares**. No friends list, chat or real listings (needs the platform backend). |
| C10 | My Islands with create/duplicate/delete/undo, first edit forks | PARTIAL | Works (e2e). Owner has not verified. Island share is checked against RUN's 100 KB limit (Volcano Isle is 77 KB). |
| C11 | Build mode shows MY island | DONE | The island itself is the build mode now; the old Maker opens as "Race track editor". |
| C12 | Pages connect, no traps | PARTIAL | e2e walks: Play, create, island, tour, activities, racing sections, hub with planet card, community, islands window, share, HUD tabs, presets, editors, plugs, studio, race track editor, back. The racing screens' inner pages are not all walked. |
| C13 | Under-age profile | PARTIAL | Grown-up switch hides building and gives a short tour. No chat exists to gate. |
| C14 | Remove **Items, Models, Evolve, Interface, Rules, Sounds** from the editor | DONE | Buttons were gone; their dead panels are removed. Race rules and Interface are added from the preset tree ("Add to this map"). `maker/evolution-panel.tsx` is kept (unreferenced) for C15. |
| C15 | Evolve = branch management of an activity's settings | NOT STARTED | `@hm/evolve`, `@hm/lineage`, `maker/evolution-panel.tsx`. |
| C16 | Header: Back to Island; Community with friends, chat, news | PARTIAL | Buttons exist; the panel behind Community is the simulated listing plus Your shares. |

---

## 3. Island, world and looks

| ID | Ask | Status | Where / what is left |
|---|---|---|---|
| D1 | Starting island textures match the voxel goblin (flat) | DONE | Flat skin from hand-picked palettes, half-metre blocks. |
| D2 | The default island should look great (volcano) | PARTIAL | Owner, 10-03: "the island looks nice, I can work with that". Volcano Isle is the default; every template is dressed. Still plain: groves, shoreline, clouds (section 6). |
| D3 | Trees floating, ugly | PARTIAL | Floating fixed (scale bug), voxel plants, plants follow the ground (N4), and scatter rules now grow in **patches** (`clump`: palm groves, bush thickets, flower drifts with meadows between; bigger plants in the thick middle). Still: one palm shape, no shoreline props (driftwood, rocks in the shallows). |
| D4 | Mouse captured on click, released on Esc | PARTIAL / **OWNER** | Works in code; the built-in browser cannot do pointer lock, so the owner must confirm on the laptop. |
| D6 | Walk / third person / fly toggle | DONE | Walk/Studio buttons top right (and B); 1st/3rd (and V). Studio flies. |
| D7 | Painting changes the ground | DONE | Paint tab (F2): 26 ground presets with swatches; brush size/strength/edge are tool variables. Owner to confirm it reads clearly. |
| D8 | Lighting presets, editable; manipulators; post and render presets; Ultra | PARTIAL | 18 setups, Lighting window, Lights tab with sky previews, quality tiers to ultra. Missing: sun dial / light gizmos, separate post/render preset kinds. |
| D10 | PBR reveal tutorial button | DONE | The island tour's last step: "Show me" switches the ground to PBR with a flash, confetti and a cheer; Flat/PBR buttons stay top right. |
| D11 | PBR texture is bad (grid repeat, normals disagree) | PARTIAL | Fixed this session: normals use the same anti-repeat offsets as the colours, every tile is made seamless at load (it had a dark border that showed as a lattice), a 3x macro tile blends in with distance, grass and moss tile at goblin scale. Still file textures; `@hm/pbrgrass` rev 2 (Arena) not picked up. |
| D12 | Smooth voxel geometry; math textures; texfit | NOT STARTED | `@hm/smoothvox` merged, unwired. |
| D13 | Lots of voxel models and parts | PARTIAL | 48 head parts, 66 body parts, 7 hero models, 3 nature models. |
| D14 | Scatter foliage | DONE | |

---

## 4. Build mode, tools and presets

| ID | Ask | Status | Where / what is left |
|---|---|---|---|
| B1 | The studio interface from the owner's prompt (white wall, goblin doodles, thumbnails not text, auto-hide shelves, hierarchy zoom) | PARTIAL | White-wall style, previews on every card. Missing: goblin doodle art, auto-hide shelves, hierarchy zoom. |
| B2 | Slide-out tool sets | REPLACED | By the owner's 10-03 hotbar (N9): tabs on F1..F10 holding tool presets (8 select, 26 paint, 11 sculpt, 10 things) plus animations, sounds, lights, activities, looks, cameras. `@hm/toolcatalog` is no longer used. |
| B3 | Esc contract; floating windows movable and closable | DONE | Every editor, the presets window, Lighting, sprites, share: movable, closable, Esc closes the front one. |
| B4 | Hold Tab for a wheel of presets | DONE | Wheel of the open tab; clickable while the mouse is free. |
| B5 | Right click is the opposite | DONE | Every tool says what each button does. |
| B6 | On-screen words; controls in Settings | DONE | |
| B7 | Hotbar buttons are presets with plug points: Edit, "+ attribute", pick a kind, get an editable preset (a sprite) | DONE | `@hm/buildkit` `plugs.ts`: plug points On use / On right click / When you pick it / When you let go; kinds sprite, sound, animation, camera shake; each plug has a preset (chooser with previews) and a strength; sprites open their own editor. Every tool starts with its sprite, sound and the goblin's swing. |
| B8 | Save/Share dialog: Keep private / Up for sale / Share freely / Share with friends + name + description | DONE (local) | `share/share-dialog.tsx` with `@hm/plugs` checks and licences, tags, price, size against 100 KB. Shares stay on the device until the platform backend exists. |
| B9 | Satisfying by default: sprite + sound on every edit | DONE | Plugs. |
| B10 | A tutorial; skip, close for now, close for good | DONE | `tutorial/*` + `@hm/tutorial` `ISLAND_STEPS` (10 steps) / `WALK_STEPS` (5). Gap: no racing-specific tour ("place your first Goblin Racing preset"). |
| B11 | Controls window: rebinding, sensitivity, invert Y, FOV, left-handed | PARTIAL | Mouse speed, invert, field of view (a preset in Settings). Rebinding and left-handed not done. |

---

## 5. Characters, racing and the world

| ID | Ask | Status | Where / what is left |
|---|---|---|---|
| E1 | My Avatar: a cool 3D voxel goblin creator | PARTIAL | Create your goblin and the Avatar tab (P): 6 looks, colours, name, dice, and **parts to wear** in five places (hat, hair, face, in hand, on the back: 32 parts from the voxel library) added to the hero goblin at measured anchor points; each part moves with its bone (`render` `dressAvatar`). Missing: swapping the body itself (heads, torsos, legs): the assembled goblins have odd proportions (tiny heads, missing arms) and are not used. |
| E2 | Avatar / rider split | NOT STARTED | |
| E3 | Defaults are presets; first edit forks | PARTIAL | Tools, animations, sprites and looks keep your changes over the ready-made preset (reset button on each). Islands and lighting fork on first edit. |
| E4 | Goblin Racing menu = live shot of the island + spectate | NOT STARTED | Needs input replays. |
| E5 | Racing profile | PARTIAL | |
| E6 | Tournaments, bookie (credits), rankings | PARTIAL | Simulated. |
| E7 | Evolution, branches, winner statues, majority rules | NOT STARTED | `docs/EVOLUTION.md`. |
| E8 | Spectate presets incl. embodied | PARTIAL | Camera rigs exist; embodiment not. |
| E9 | Classes (shaman, mechanic) | NOT STARTED | |
| E10 | Friends, chat, news | NOT STARTED | Needs the platform. |

---

## 6. The owner's 2026-10-03 list (N1 to N11)

| ID | Ask | Status | Where |
|---|---|---|---|
| N1 | A moves right: left/right swapped | DONE | `island.tsx` strafe vector. |
| N2 | Z-fighting with the water while it rotates | DONE / **OWNER** | Near plane follows camera distance; sea drawn with a depth bias. Owner to confirm on the laptop's GPU. |
| N3 | First person must give the mouse to click presets | DONE / **OWNER** | E, Tab and the windows free the mouse; clicking the world captures it again. Pointer lock itself is only testable on the laptop. |
| N4 | Trees adapt to terrain; behaviour presets; dug ground is no longer grass | DONE | `@hm/worldrules` (world rules + plant presets), applied when a stroke ends in the same undo step; editable from the presets window. |
| N5 | No animation; "we need presets" | DONE | `@hm/anim` (10 presets, animator), goblin split into bones (`render/avatar-view.ts`), Animate tab with moving previews and an editor. |
| N6 | Plan everything to the T | DONE | This file. |
| N7 | Buttons to switch to PBR | DONE | Flat / PBR top right, Settings, and the tour's reveal. |
| N8 | Previews wherever possible | DONE | Ground swatches, model thumbnails, sky gradients, moving stick figures, sound envelopes, planets, goblin looks, sprite bursts, camera shakes, tool icons. |
| N9 | F1..F12 tabs; E opens the preset window; wheel clickable | DONE | F1..F10 (F11 fullscreen and F12 dev tools belong to the browser), P = Avatar. |
| N10 | Studio mode: no goblin, fly, windows, attribute editors you open/close/move, focus, hide others | DONE | B or the Studio button. |
| N11 | Full report; push to main and archive the old main | DONE when `docs/REPORT.md` and the push are in | `docs/REPORT.md`. |

---

## 7. Honest quality assessment

1. **Ground level** looked at this session in both skins: flat reads as voxel blocks that match the goblin; PBR is a painted jungle floor, now without seams.
2. **Trees**: grounded, voxel, follow the ground, grow in groves and drifts; one palm shape, no shoreline props.
3. **The cone** is a smooth cone with a crater; no terraces, gullies, lava flow or steam.
4. **The sea** reads its depth from the island's height grid: turquoise shallows, deep blue further out, foam bands rolling in where it is under ~35 cm and a bright lip at the sand (shader in `render/environment.ts`). No real waves (the surface is flat). **No clouds.**
5. **The goblin** animates from presets now; it is the old hero model and the rig only fits that model.
6. **UI**: consistent white-wall style and previews; no goblin doodle art; the old Maker (Race track editor) still has its own older look.
7. Known test gaps: pointer lock (laptop only), golden-image tests for looks, the Maker's panels.

---

## 8. Built but not wired

`@hm/texgraph`, `@hm/smoothvox`, `@hm/juice` (superseded by tool plugs), `@hm/evolve`, `@hm/platform`, `@hm/looks` (replaced by `@hm/lighting`; delete), `@hm/toolcatalog` (replaced by the F-key tabs), `@hm/pbrgrass` (only the Grass Lab page), `@hm/assembler` + parts (only the Parts Lab page). Used indirectly: `@hm/goblins`, `@hm/racers`, `@hm/raceflow` (through `@hm/game` racing). Now wired this session: `@hm/tutorial`, `@hm/plugs` (publishing), `@hm/uistack` (windows, navigator).

---

## 9. What to do next (in order)

1. **Owner test pass on the laptop** (`docs/REPORT.md`, "How testing starts"): pointer lock, z-fighting, the tour, plugs, share, galaxy. Fix what they report first.
2. Avatar parts in the creator: rig assembled goblins (joints from the assembler's part boxes), then a parts picker in Create your goblin and the Avatar tab.
3. Island dressing: groves (3 to 7 palms round a tall one), 3 palm variants, rocks in the shallows, driftwood, flowers in drifts; shore foam; clouds; terraces and a lava flow on the cone.
4. Goblin Racing live shot + spectate (input replays: the sim is deterministic).
5. Evolve (C15) as branches of an activity's presets; then evolution, statues, majority rules.
6. Math textures: texgraph nodes for the PBR skin; pick up `pbrgrass` rev 2 from Arena.
7. Platform: shares, community, friends and chat through `@hm/platform` (LocalSim first, then RUN).
8. Controls rebinding; hierarchy zoom; goblin doodle art; auto-hide shelves.

---

## 10. File map (where things are)

- App shell: `apps/web/src/shell/*` (menu, galaxy star chart, galaxy bar, hub, activities, racing menu, islands window, settings with the controls preset, community with Your shares).
- The island: `island.tsx` (walk, studio, HUD, tour, reveal, windows), `build/*` (tabs and catalog, player store, cards and previews, editors, plugs list, preset window, windows, sprites, the build controller), `tutorial/*` (tour store and card), `share/*` (shares store and dialog), `avatar/create-goblin.tsx`, `lighting/lighting-window.tsx`, `look.ts`, `world.ts`.
- The old full editor (Race track editor): `maker/*`.
- Packages (pure and tested unless noted): `buildkit` (tabs, tools, plugs, sprites, shakes), `anim`, `avatarlook`, `worldrules`, `lighting`, `tutorial` (+ island steps), `plugs` (publish rules), `render` (three.js; terrain shader, avatar bones, bursts), `terrain` (+ volcano), `ui` (inspector), `voxel*`, `voxelnature`, `scatter`, `islands`, `activities`, `engine`, `kernel`, `contracts`.
- Docs: this file, `REPORT.md`, `OWNER_ASKS.md`, `PRODUCT_FLOW.md`, `EVOLUTION.md`, `NEXT_PHASE.md`, `MAKE_YOUR_OWN_RACE.md`, `handoff/CATCHUP.md`.
