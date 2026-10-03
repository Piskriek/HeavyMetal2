# STATUS: everything the owner has asked for, and where it stands

Kept since 2026-10-02; rewritten 2026-10-03 at the end of the Opus 5.5 session. **Read this file first, then `docs/REPORT.md` (where the game stands and how testing starts), then `docs/OWNER_ASKS.md` (the owner's exact words), then `docs/PRODUCT_FLOW.md`.**

Rules for whoever works next (the owner has said these more than once):
1. Every message from the owner is checked against this file before work starts, and every ask is added here the same turn it is made, with its status. Half-done asks are marked PARTIAL, never DONE.
2. Update this file in the same commit as the work. A status line that is wrong is worse than no line.
3. Test it as the owner will see it: a real browser, a fresh profile, the production build (`npm run e2e`) and the dev server on the LAN. Look at screenshots. Say plainly what you could not test (the built-in browser cannot do pointer lock).
4. Let the Arena battle models write pure logic and presets (they are good at it); write acceptance tests before merging; integrate and polish yourself.
5. When the owner contradicts an older ask, the latest message wins (owner, 2026-10-03).
6. **Load the `frontend-design` skill at the start of every design-related task** (screens, menus, layout, styling, fonts, visual polish), before writing markup or CSS, even if it was loaded earlier in the session (owner, 2026-09-26 and 2026-10-03). Follow its plan, check, build, critique-with-screenshots process.

Status words: **DONE** (works, tested, seen in a browser) / **PARTIAL** (some of it works; the gap is stated) / **NOT STARTED** / **IN FLIGHT** (an Arena job is running) / **OWNER** (needs the owner's hands or eyes).

---

## 0. Where the owner tests, and how to run everything

| What | How |
|---|---|
| Dev server (owner tests here, from the laptop) | `npx vite --port 5192 --host 0.0.0.0 apps/web` in `E:\AI\hm2-art\harness\repo`, then `http://192.168.0.5:5192` (this PC: `http://127.0.0.1:5192`). |
| Production build as one html file | `npm run build` gives `apps/web/dist/index.html` (about 3.9 MB). `npm run host` serves it on 8080. |
| Gate before every commit | `npm run verify` (typecheck + every package test + build to ONE html) then `npm run build && npm run e2e` (e2e drives the **built** file in the installed Chrome: build first or it tests the old one; it stubs pointer lock and releases the mouse clip; it must never hold the owner's real mouse). **1126 tests and 52 e2e checks pass** at the end of the 2026-10-03 session. On the owner's laptop (slower CPU) run the e2e on the graphics card with longer waits: `E2E_GPU=1 E2E_SLOW=2 node scripts/e2e-smoke.mjs` (software rendering there cannot draw the island fast enough). Frame rates: `node scripts/perf.mjs low,medium,high 5` after a build. |
| Repo | `E:\AI\hm2-art\harness\repo` (git, npm workspaces `packages/*`, app in `apps/web`). On GitHub as `Piskriek/HeavyMetal2` `main` since 2026-10-03; the old game code is on `archive/main-2026-10-03` (see `docs/REPORT.md` section 5). `C:\Work\repo` is NOT this project. |
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
| P3 | **Textures are hard stops**: replace file textures with math presets (texgraph). Performance rule (2026-10-03): math presets are evaluated once (at load or on edit) into a texture or a few numbers, never per pixel per frame; the flat ground's baked blocks and the low tier's light probe are the pattern. | PARTIAL. Flat skin is palettes (no files). The PBR skin still loads 256 px `.webp` tiles (now made seamless at load and blended with a macro tile; they look fine but are files). `@hm/texgraph` and `@hm/pbrgrass` are not wired. |
| P4 | **Models are presets** (voxel); pro sculpt tools. | PARTIAL. Voxel model presets everywhere (palms, rocks, bushes, flowers, grass, goblin). Island Select tools move, turn, size, copy, delete, focus, hide. No 3D gizmos. |
| P5 | Sound, animation and every root have good tools and are presets. | PARTIAL. Animation presets with live stick-figure previews and an editor; every sound is a preset: the Sound tab editor sets volume, pitch, on/off and reshapes it layer by layer (the Sound Lab: roll, wiggle, layers, JSON; every layer number on the shared never-locking slider, hard limits widened to 12 s fades, 20 s sounds, two octaves of detune), saved with the island; sprite and shake presets. No timeline editor. |
| P6 | Modular; platform ports (`LocalSim` + `Run`), never the RUN SDK directly. | PARTIAL. `@hm/platform` exists, the app does not use it yet (shares and the community are local). |
| P7 | Launch on **run.studio** (one static file). | Build is one html file under the size budget. **OWNER**: deploy needs the owner's login. |
| P8 | **Sliders never lock.** | DONE in the shared inspector (every editor on the island and Settings uses it). Bespoke sliders remain in the Sound Lab's wiggle amount, the engine and music labs, the racing menu and the Maker's sculpt bar. |
| P9, P10 | Reasoned steps; keep Arena busy; ask only for outward actions. | Process rules. |
| P11 | **The owner's laptop is the minimum spec** (Intel i7-6700HQ, GTX 950M + Intel HD 530, 12 GB, 2015): "if it can run smooth on low settings we will be happy" (2026-10-03). | PARTIAL. Measured with `node scripts/perf.mjs` (production build, 1920x1080, the Intel HD 530 Chrome picks on this laptop). Low tier, island with flat ground: **7 fps -> 49 fps**; the SetMix home (galaxy + Goblin Racing's window) 51 fps (the island behind the window shades only the window's pixels, `renderer.setClip`; the galaxy draws at 30 fps while untouched); Goblin Racing's menu 45. Fixed: dark lamps were still shaded for every pixel (left out now); low has no sky reflection map (a light probe gives the same soft sky light, the sea takes the sky colour by angle); the flat ground is its own shader, its surface lookup baked per half-metre block (`render/terrain/flat-blocks.ts`) and the lookup rewritten without indexed arrays; low renders at most 1280x720 worth of pixels (`render/pixel-ratio.ts`); distant plants use a halved, far ones a quartered voxel model and on low the plants out of view are skipped (`render/decor-lod.ts`, `decor.ts`: 595k -> 80k triangles); on low the flat ground and the plants use plain diffuse (Lambert) lighting (they are matte, so they look the same); the sky is drawn last so its clouds are shaded only where you see sky; low sea foam without noise. **Still to do**: 60 fps on low (49 now; the slowest frames still dip to ~30), medium is ~98 ms a frame (shadows, glow, reflections), PBR ground on low ~50 ms. "Auto" now guesses from the graphics chip's name (`@hm/game` `gpuClass`: integrated and older laptop chips start on low; it used to start this laptop on ultra from its 8 CPU threads), drops a tier within ~2.5 s of slow frames (two tiers when very slow), and the race track editor follows the Settings tier too (it was always high). |

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
| D15 | A few satellite islands round the starting island, with coral and fish: "I want it to feel alive" (2026-10-03) | NOT STARTED | Must stay cheap on the low tier (P11): instanced fish, coral as voxel/scatter presets, both drawn sparingly on low. |
| D17 | Auto with a frame-rate target: 15 / 30 / 60 fps, "pretty and laggy or fast and less pretty" (2026-10-03) | DONE | Settings, Graphics Auto shows "Aim for 15 / 30 / 60 fps" (`profile.fpsTarget`, default 60). `@hm/game` `createAdaptiveQuality({ targetFps })`: drops below ~80% of the target, rises one tier after two windows with 40% to spare, never retries a tier that ran too slow (no bouncing); at 60 the screen cap hides spare room so it only drops. Checked on this laptop at 15: low (50 fps) tries medium (12 fps), returns to low after ~8 s and stays. Each switch stutters ~1 s while shaders compile (could be pre-warmed). Also fixed: changing Graphics in Settings now applies at once (it only applied when the island next opened). **The tiers are a preset too** (owner: "everything is a preset"): kind `graphics` (`render/graphics.ts`, registered in the engine's core schemas): picture size (720p on low), sharpness, supersample, picture effects, glow, contact shadows (+ quality), smooth edges, shadows (off/on/detailed/finest), sky reflections, simple lighting, full-detail plant distance, skip plants out of view, simple sea. Low/Medium/High/Ultra are the ready-made values (`GRAPHICS_TIERS`); Settings, "Fine-tune graphics" shows the tier drawing now with your own changes on top (`profile.graphics`, kept whichever tier auto picks, each resettable, "Use the tiers as made"); the renderer takes `setGraphics(settings)` and `setQuality(tier)` is a shortcut. |
| D16 | Choose the graphics card in Settings (2026-10-03) | DONE / **OWNER** | Settings, Graphics card: Ask for the fast one / Ask for the battery saver / Let the browser choose (`profile.gpu` -> WebGL `powerPreference` for the island, the race and the race track editor) and "In use: <card>". A page can only ask: on this laptop Chrome still gives the Intel HD 530, so the hint explains the one-time Windows switch (Settings, System, Display, Graphics, the browser, High performance). Owner to try that switch and report the frame rate on the GTX 950M. |

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
| B12 | Make it easy for any AI (the owner's brother's Claude, Arena battle models, players' own AIs) to make presets and whole games in the harness (2026-10-03) | NOT STARTED | Plan: (1) one AI guide (`docs/AI_GUIDE.md`, also shipped as a Claude skill and the Arena preamble): the preset model, kinds, a worked example, the rules; (2) a schema catalogue generated from the live registry (JSON Schema per preset kind: every variable, range, unit, doc) plus typings for scripts; (3) a checker the AI can run (`scripts/preset-check.mjs`) with plain-words errors and fixes; (4) in the game: paste a preset or bundle (JSON or share code) into the presets window, and "Copy for an AI" on any preset (its JSON + its schema + the guide, ready to paste into a chat). Builds on the existing `hm-bundle` format, `exportBundle`/`importBundle` and share codes. |
| B13 | **Making anything new offers three ways in** (owner, 2026-10-03: "when you create new on anything there should be a setup wizard, or quick setup or manual set options"): **Quick setup** (pick a ready-made start, one click, change later), **Setup wizard** (a few plain questions, one per step, with a preview that updates as you answer), **Manual** (the full editor, every variable) | PARTIAL | `shell/new-thing.tsx` `NewChooser` (remembers your last way per kind). Done for New avatar (island dock and the Avatars window; Quick = a ready-made look and a name, Wizard = look, colours, wears, name with the avatar showing each choice, Manual = the full editor) and New island (`islands/new-island.tsx`: ready-made islands drawn as maps from above; a five-question wizard whose map redraws as you answer; Manual opens a plain island). Still to do: activities, presets, tracks, lighting. |
| B14 | **A map of every screen** (owner, 2026-10-03): something that presses every button on every screen, screenshots what comes up and builds a map of the interface, so it can be checked that everything connects (no dead ends, Esc always goes back) and every layout is logical, modular and looks good (the frontend-design review); an ongoing check as the game grows | IN PROGRESS | `scripts/ui-map.mjs` runs: every screen, every control pressed in a fresh copy, outcome, Esc, layout flags, screenshots, `ui-map/index.html`, `--approve`/`--check` against `tests/ui-contract.json`. Next: review the map, approve the contract, put `--check` in the routine. |
| B15 | **The tutorial and the interface map stay in step** (owner, 2026-10-03: "the tutorial can be a preset generated by the interfaces so that the tutorial is always correct, or vice versa") | NOT STARTED | Every button and window gets a stable name (`data-ui="settings.graphics.potato"`); the tour becomes a `tutorial` preset whose steps point at those names ("press `home.my-island`", "open `island.tab.avatar`"). The map (B14) checks each step: the name exists on that screen and pressing it leads where the step says; a broken step is red in the map and fails the e2e test. The other way round: the map can draft a tour from a path through it (pick screens, it writes the steps), so new games get a tour for free. |
| B16 | **Automated tests that everything is hooked up** (owner, 2026-10-03: "scripts that test that everything is hooked up, that buttons exist and do what they are supposed to do") | IN PROGRESS | See B14; `docs/MASTER_PLAN.md` section 8 for the layers. |

---

## 5. Characters, racing and the world

| ID | Ask | Status | Where / what is left |
|---|---|---|---|
| E1 | My Avatar: a cool 3D voxel goblin creator | PARTIAL | Create your goblin and the Avatar tab (P): 6 looks, colours, name, dice, and **parts to wear** in five places (hat, hair, face, in hand, on the back: 32 parts from the voxel library) added to the hero goblin at measured anchor points; each part moves with its bone (`render` `dressAvatar`). Missing: swapping the body itself (heads, torsos, legs): the assembled goblins have odd proportions (tiny heads, missing arms) and are not used. |
| E11 | **Avatar mode** (the Avatar tab, P) (owner, 2026-10-03): switches to **3rd person facing your current avatar**, ready to edit its own presets (look, colours, parts, animations); **a row above of your full characters** (every avatar you own, whole) to swap to in one click; a **"+ New avatar"** box to make another | DONE (first version) | P or the Avatar tab: the camera turns to face your avatar (right-drag turns, wheel zooms), a dock on the right with your characters (one click swaps) and + New avatar, then the one you wear: Looks, Colours, Wears, Moves; Esc, Done or P goes back. `avatar/avatar-dock.tsx`, `island.tsx` (mirror camera). |
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
| N11 | Full report; push to main and archive the old main | DONE | `docs/REPORT.md`; pushed to `Piskriek/HeavyMetal2` `main`, the old main kept on `archive/main-2026-10-03`. |

---

## 6a. SetMix Harness: the harness and the goblin game are two different things (owner, 2026-10-03, latest)

The harness is called **SetMix Harness** (so it is clear what is harness and what is goblin). The world you enter is the harness; goblin stuff is for goblins.

| ID | Ask | Status | Plan |
|---|---|---|---|
| H1 | Name: "SetMix Harness" everywhere the harness speaks (title, menus, docs); goblin words only inside Goblin Racing | PARTIAL | Page title, the home wordmark, Community header, the island's Esc menu (Home, Community) and the activity description are SetMix/neutral. Still goblin-worded: the avatar maker ("Create your goblin"), the tour, some build texts, README/docs. | Main menu wordmark, page title, docs/README, the AI guide (B12). |
| H2 | The harness main menu is the **galaxy view**, with a new **modern cyberpunk display font**, Goblin Racing already selected and **its menu shown as a preview** you can enlarge to start using it | DONE | Galaxy star chart as the home screen; a live preview card of the Goblin Racing menu beside the selected planet; enlarge = open it full screen. Font from Google Fonts (allowed on RUN), chosen in a design pass. |
| H3 | **Goblin Racing** owns the Play / Multiplayer / Settings style menu that orbits **the Goblin Racing island** (today's main menu moves into the activity) | DONE | Today's menu-over-the-island becomes the Goblin Racing activity's front menu; the racing sections (quick race, tournaments, track editor ...) sit under it. |
| H4 | The player has **many avatars**: the first game you play creates the first one (a goblin), and you can make a new human or any other avatar | DONE (first kinds) | SetMix menu, Avatars: every avatar as a card (kind, where it is used: walks your island / races in Goblin Racing), Use, Change, Remove (your last stays), New avatar. Looks have a `kind` (`@hm/avatarlook`: goblin or human; the eight colour slots mean what each kind wears, with their own labels, ready-made looks and dice). New voxel human (`@hm/voxelart` `human`, 28x47x20, tested symmetric and connected) with `HUMAN_RIG` (`@hm/render`) so every animation preset works, and its own part attach points (`avatar/accessories.ts` `KINDS`). The island walks your avatar in use, whatever its kind; Goblin Racing races as your goblin (its Play makes one if you have none). Next: more kinds (by Arena voxel jobs), body parts swapping per kind (E1). |
| H5 | The harness carries the world (galaxy, your planets and islands, avatars, building tools, settings); activities are games inside it | NOT STARTED | Esc menu, galaxy bar and Settings become harness-level; activity menus stay inside their activity. Owner (answer): walking and building your own island is **harness level**. |
| H6 | **Two launches on RUN** (owner: "should we launch the harness by itself too so we have place for storing players home islands and set mix stuff?" Yes): SetMix Harness as its own RUN game, Goblin Racing as another; the galaxy reaches Goblin Racing either way | NOT STARTED | From the RUN SDK docs (node_modules/@series-inc/rundot-game-sdk/docs/rundot-developer-platform/api): `navigateToGame` / `pushAppAsync` launch another RUN game with data and bring the player back (NAVIGATION.md). Storage (STORAGE.md): **SetMix `appStorage`** = home islands, your presets and builds; **`ownerStorage`** (shared per player across all games by the same creator) = avatars, profile, settings, so one goblin shows in both; **Goblin Racing `appStorage`** = per-player racing data; **`sharedStorage`** = hand-offs such as "submit my island as an evolution". Cross-player data (all submissions, the weekly tally) still needs a home: read FILES.md / SERVER_AUTHORITATIVE.md / LEADERBOARD.md before building it. Code stays one codebase: the app boots as SetMix or as Goblin Racing by build mode or launch context, through `@hm/platform` (P6), never the SDK directly. Deploys need the owner's RUN login. |
| H8 | **The SetMix galaxy is a real universe (a hierarchy)**: planets orbit their own star; at galaxy level each star shows a **logo/icon** (not the planets); a **hierarchy explorer tab** navigates the universe's branches, with search and the technical details | PARTIAL (My planet done) | Owner direction 2026-10-03: from the galaxy you go to **My planet**, see your islands with previews, go into one (DONE: the home menu, the planet window, the My planet screen with island maps). Recommendation taken as the plan: **your star is your solar system** (your planet and the activities you make orbit it); **friends move in** (adding a friend brings their home planet into your system as a neighbour to visit); **other creators are other stars** (Goblin Racing's studio is the goblin world's star); **you fly your rocket** out of your system across the galaxy to reach the goblin planet (H9: a short flight first, later the rocket you built matters). Still to build: the star and orbits view, logos, the explorer tab with search. |
| H9 | **Progression (owner idea, 2026-10-03):** in the SetMix world you learn to build with the harness presets until you **build a space ship** and fly to the goblin world; arriving unlocks the first unlock, **classes**, starting with the **Shaman**; each new game introduces new classes | NOT STARTED | Fits the class/ability plan (CATCHUP 12k: classes are bundles of abilities made only from existing presets; the Shaman resurrects) and the tour (`@hm/tutorial`). Plan: the SetMix tour becomes building lessons (presets, sculpt, paint, place, script) ending in a ship blueprint (a voxel model preset you assemble from parts); a "ship ready" check unlocks the flight to Goblin Racing's star; there a quest grants the Shaman class (`class` + `ability` kinds); later games register their own classes. Unlocks are data (an `unlock` preset kind: condition + reward), so new games add theirs. |
| H7 | The Goblin Racing island = **a copy of the owner's own island**: the owner submits the first evolution, it becomes the island; then players submit evolutions for the weekly majority-rules change; the island grows; its files ship with the Goblin Racing game files on run.studio | NOT STARTED | First step locally: "Submit as an evolution" on an island makes a Goblin Racing island version (a preset bundle); the racing menu orbits the current version. The weekly tally needs H6's cross-player store. |

**How the SetMix home works (2026-10-03):** `shell/shell.tsx` boots to screen `home`: the galaxy star chart (hub mode, Goblin Racing focused and framed left of centre), the SetMix wordmark in Oxanium and the harness menu (My island, Community, Settings, each with what it is for). Goblin Racing's island (`hm.racing.map.v2`, template `goblin-racing`: the racing island with its track, dressed) renders full-screen behind a window (`.gr-stage`, an opening onto a fixed `.gr-scene`, so growing never resizes the 3D view); a leader line ties the window to its planet (`GalaxyCanvas.onFocusScreen`). The window shows the game's description, what Play will do for you, and Play / Multiplayer / Settings; opening it grows it into screen `goblin` (Goblin / Racing wordmark, "a SetMix game", Play, Multiplayer = the sections, Settings, Back to SetMix). Play makes your first avatar (a goblin) the first time, then races; My island makes it if Goblin Racing has not. Runtimes remember which map they were loaded from (`maker/storage.ts`), so the two islands never save into each other.

## 6b. The owner's 2026-10-03 laptop list (S1 to S6), do these first

| ID | Ask | Status | Where / what is left |
|---|---|---|---|
| S1 | Esc menu on the island (as the goblin): a **Settings** button replaces Lighting; Settings holds the settings presets (graphics, controls ...) and a button that jumps to the lighting presets (maybe a day/night cycle preset) | DONE (day/night cycle NOT STARTED) | Esc, Settings opens a movable Settings window on the island (`shell/settings-body.tsx`, shared with the main menu's Settings) with "Lighting presets and time of day" at the top. A day/night cycle preset (the clock moving on its own) is still to do. |
| S2 | **Graphics presets as one-click buttons** in Settings, down to a "calculator" version (the lightest possible) | DONE | A `potato` graphics preset (first called Calculator, see S8) below Low (smaller picture, no clouds, plants drawn only nearby ...) plus Low/Medium/High/Ultra/Auto as buttons; extra variables in `render/graphics.ts` where Low cannot go lower yet. |
| S3 | The hierarchy (galaxy bar) drops down over the Walk/Studio buttons: in studio mode show it there with the Walk/Studio toggles on top of it, nothing covered | DONE | `shell/galaxy-bar.tsx`, the mode bar in `island.tsx`, `studio.css`. |
| S4 | The selected item in the hierarchy shows as a black block ("blacked out") | DONE | `.galaxy-bar ol button.on` loses to the global `button.on` dark fill (and hover). |
| S5 | Race track editor must not be in the Esc menu | DONE | Move its entrance to the Goblin Racing activity menu (it edits race tracks); update the e2e walk. |
| S6 | Finish all the implementation and polish | ONGOING | Everything in this file marked PARTIAL or NOT STARTED, performance first. |
| S7 | Looking round with the mouse on the island freezes for a split second, then the view jumps all the way in the direction the mouse was going | FIXED, owner to confirm | Measured first (`look-probe`: captured mouse at 250 Hz, 1920x1080, walking, Potato and Auto): steady 60 fps, no frame over 50 ms, no shader compiles, so the game itself does not stall. The jump matches a known Chrome-on-Windows bug: with the mouse captured the OS-adjusted way, it now and then reports one huge move. Fixes: the mouse is captured with raw movement (`unadjustedMovement`, `shell/capture-mouse.ts`, used by the island and the dive onto it), a guard drops a single move far bigger than the ones before it (`lookFilter`), and the tour no longer saves and redraws on every look report. Raw movement skips Windows pointer acceleration, so the mouse may feel a little different: Settings, Mouse speed. |
| S8 | Rename the lightest graphics preset "Calculator" to **"Potato"** (people would think "Calculator" works out the best setting, which is Auto) | DONE | Tier `potato` everywhere (Settings buttons, fine-tuning, the race settings); saves that say `calculator` load as Potato (`parseQuality`). |

## 7. Honest quality assessment

1. **Ground level** looked at this session in both skins: flat reads as voxel blocks that match the goblin; PBR is a painted jungle floor, now without seams.
2. **Trees**: grounded, voxel, follow the ground, grow in groves and drifts; one palm shape, no shoreline props.
3. **The cone** is a smooth cone with a crater; no terraces, gullies, lava flow or steam.
4. **The sea** reads its depth from the island's height grid: turquoise shallows, deep blue further out, foam bands rolling in where it is under ~35 cm and a bright lip at the sand (shader in `render/environment.ts`). No real waves (the surface is flat). **Clouds**: every lighting preset has a cloud cover (0 clear to 1 overcast, editable as "Clouds" in the Sky group); a drifting cloud layer lit from the sun's side, dark at night.
5. **The goblin** animates from presets now; it is the old hero model and the rig only fits that model.
6. **UI**: consistent white-wall style and previews; no goblin doodle art; the old Maker (Race track editor) still has its own older look.
7. Known test gaps: pointer lock (laptop only), golden-image tests for looks, the Maker's panels.

---

## 8. Built but not wired

`@hm/texgraph`, `@hm/smoothvox`, `@hm/juice` (superseded by tool plugs), `@hm/evolve`, `@hm/platform`, `@hm/looks` (replaced by `@hm/lighting`; delete), `@hm/toolcatalog` (replaced by the F-key tabs), `@hm/pbrgrass` (only the Grass Lab page), `@hm/assembler` + parts (only the Parts Lab page). Used indirectly: `@hm/goblins`, `@hm/racers`, `@hm/raceflow` (through `@hm/game` racing). Now wired this session: `@hm/tutorial`, `@hm/plugs` (publishing), `@hm/uistack` (windows, navigator).

---

## 9. What to do next (in order)

000. **The master plan** (`docs/MASTER_PLAN.md`, owner 2026-10-03: re-plan everything, the full view, then continue): the map of every place, the journeys start to finish, the gaps G1 to G15, the owner's decisions Q1 to Q5, all front-end design as one batch, and the automated tests (B16). Work in its section 7 order.
00. **The owner's laptop list S1 to S6 (section 6b)**: Settings in the Esc menu with graphics preset buttons down to a Potato version, the hierarchy bar and Walk/Studio toggles not covering each other, the hierarchy highlight, the race track editor out of the Esc menu.
0. **Performance first, every session** (owner, 2026-10-03: "continue with optimization as a priority going forward"). Smooth on low on the owner's laptop (P11): 60 fps on low, auto picks the right tier, GPU choice in Settings (D16); every new feature (the satellite islands with coral and fish, D15) is built cheap on low from the start and measured with `scripts/perf.mjs`.
1. **Owner test pass on the laptop** (`docs/REPORT.md`, "How testing starts"): pointer lock, z-fighting, the tour, plugs, share, galaxy. Fix what they report first.
2. Avatar parts in the creator: rig assembled goblins (joints from the assembler's part boxes), then a parts picker in Create your goblin and the Avatar tab.
3. Island dressing: groves (3 to 7 palms round a tall one), 3 palm variants, rocks in the shallows, driftwood, flowers in drifts; shore foam; clouds; terraces and a lava flow on the cone.
4. Goblin Racing live shot + spectate (input replays: the sim is deterministic).
5. Evolve (C15) as branches of an activity's presets; then evolution, statues, majority rules.
6. Math textures: texgraph nodes for the PBR skin; pick up `pbrgrass` rev 2 from Arena.
7. Platform: shares, community, friends and chat through `@hm/platform` (LocalSim first, then RUN).
8. Controls rebinding; hierarchy zoom; goblin doodle art; auto-hide shelves.

---

## 9b. Ideas the owner raised, not planned yet

- 2026-10-03: "a jev type model might be particularly useful to us ... its cheap outputs can be useful for npc characters?" ([Jev](https://en.wikipedia.org/wiki/Jev_(AI_model)), TypeSafe AI, early access since 2026-09-15: takes state as JSON plus typed questions (choice, score, yes/no) and returns typed answers with confidence, 70-500 ms, much cheaper than chat models, API only, proprietary). Fit: NPC brains as presets whose questions map onto preset variables (choice = enum, score = range, yes/no = switch): the shaman's next action, a guard's suspicion, goblin-law verdicts and sentences; also moderation of shared names/presets and "is this change gameplay?" for evolution. Design rules if adopted: every answer is recorded as an input event (replays and spectating stay exact without calling it again); calls go through the platform's server side or a relay (no key in the page; RUN pages fetch only from their own origin); Jev is one plug-in behind a "brain" port with the rule-based behaviour presets as the offline, free fallback; decisions every few seconds, never per frame. Belongs with E9 (classes, NPCs) and the goblin laws.

## 10. File map (where things are)

- App shell: `apps/web/src/shell/*` (menu, galaxy star chart, galaxy bar, hub, activities, racing menu, islands window, settings with the controls preset, community with Your shares).
- The island: `island.tsx` (walk, studio, HUD, tour, reveal, windows), `build/*` (tabs and catalog, player store, cards and previews, editors, plugs list, preset window, windows, sprites, the build controller), `tutorial/*` (tour store and card), `share/*` (shares store and dialog), `avatar/create-goblin.tsx`, `lighting/lighting-window.tsx`, `look.ts`, `world.ts`.
- The old full editor (Race track editor): `maker/*`.
- Packages (pure and tested unless noted): `buildkit` (tabs, tools, plugs, sprites, shakes), `anim`, `avatarlook`, `worldrules`, `lighting`, `tutorial` (+ island steps), `plugs` (publish rules), `render` (three.js; terrain shader, avatar bones, bursts), `terrain` (+ volcano), `ui` (inspector), `voxel*`, `voxelnature`, `scatter`, `islands`, `activities`, `engine`, `kernel`, `contracts`.
- Docs: this file, `REPORT.md`, `OWNER_ASKS.md`, `PRODUCT_FLOW.md`, `EVOLUTION.md`, `NEXT_PHASE.md`, `MAKE_YOUR_OWN_RACE.md`, `handoff/CATCHUP.md`.
