# Next phase: one world, one set of rules, one look

Written after a full recheck of CATCHUP, the code, the owner's last three briefs and a real-Chrome test of the production build.

## 1. Honest status

### Works (checked in a real browser, or covered by tests)
Main menu over the galaxy, galaxy dive to the island, goblin walking with pointer lock and mouse look, crosshair, 9-slot hotbar + inventory, terrain tools with particle bursts and sounds, Esc jump menu, activities window (create / duplicate / hide), multiplayer hub with community tab (simulated), Goblin Racing menu with a real tournament state machine, race, studio look, focus mode, voxel sculpting inside focus mode, camera rigs, evolution panel.
918 tests; `npm run e2e` drives the production build in the installed Chrome (menu → activities → every racing section → hub → community → island → Esc menu → back) with no page error.

### Broken or wrong, with the cause
| # | What you saw | Cause | Fixed by |
|---|---|---|---|
| D1 | The hosted game was a **blank page** (laptop) | Production single-file build crashed: top-level `await` in the QuickJS init ("Cannot access x before initialization"). Fixed today (explicit `initQuickJS()` in the app start). A real-Chrome smoke test now guards it | done |
| D2 | Pages do not connect, you get stuck | The editor (`#edit`) and the race (`#race`) are separate pages with full reloads and no road back to the shell. Test drive ↔ editor is a loop. Racing screens have their own "back" | M0, M2 |
| D3 | Esc does nothing in build mode | The editor only deselects on Esc. There is no single Esc contract | M0 (uistack `DismissStack` wired everywhere) |
| D4 | Build mode shows the racetrack island, not mine | There is ONE saved map (`hm.map.v1`) built from the racing starter scene (it has a track). My Island and the racing map must be different things | M1 |
| D5 | Mouse look only on right click | That is the soft-aim fallback after pointer lock failed. In real Chrome lock works on click (tested). Likely the blank-page build + an embedded browser that does not release lock on Esc. Now: explicit release on Esc. Needs: Controls window with a live "mouse captured: yes/no" line | M0, M2 |
| D6 | Painting does not change the texture | The paint tool is hard-wired to ONE surface (grass) on a grass island, and the flat skin averages tiles so differences vanish | M2 (Tab palette picks any surface) + M3 |
| D7 | Ground looks blown out / garish | Flat skin = posterised photo tiles of 20 different surfaces. Lighting is one fixed sun + ACES + no light rig, no post. Looks are not editable | M3 |
| D8 | PBR racing texture looks like a grid, normals do not match colours | The tiles are AI-painted 2x2 sheets: colour, normal and roughness were generated separately, so they disagree; one 256 px tile repeats every 1.8 m under triplanar sampling | M3 (math textures from one height field + stochastic tiling) |
| D9 | The old tab buttons (Items, Models, Evolve, Interface, Rules, Sounds) | Left over from the first editor | M2 (removed; panels live in the preset tree) |
| D10 | Goblin racing menu is a plain list | Placeholder | M5 |

### Not built yet (the list that was promised)
Button presets with "+ attribute" and the publish dialog (rules merged, no UI); Esc layers / movable windows / auto-hide shelves wired (logic merged); slide-out toolbars (catalog in flight); fly mode toggle; Tab preset palette; right-click = opposite everywhere; tool descriptions instead of key text; Controls window; My Avatar creator and rider presets; My Islands (create / duplicate / delete / undo, branches, last-visited order, first-edit fork); live racing menu, spectating, racing profile; community panel with friends and chat; tutorial UI and the PBR reveal; lighting / post / render presets and their editors; touch controls; replay streams.

## 2. The spine: what makes it modular (do this first)

1. **One WorldHost.** One canvas, one WebGL renderer for the whole app. "Levels" mount into it: galaxy, planet, island, race track, avatar creator. Today every screen builds its own renderer (galaxy + island + race + editor) which will run out of GPU contexts and leaks. Levels are plain objects: `mount(host)`, `unmount()`, `camera rig`, `input context`.
2. **One router.** A table of screens and legal transitions in code (`shell/routes.ts`), no hash pages. Every screen declares `back`. The e2e test walks the table and fails if any screen has no way home. Build mode and the editor become a MODE of the island level, not a page.
3. **One input contract** (the thing that was missing):
   - Contexts stack: `ui-pointer` (menus), `aim` (world with captured mouse), `text` (typing). Pointer lock only in `aim`.
   - Esc closes exactly one thing, in this order: dialog, floating window, slide-out, shelf, focus (zoom out), then opens the jump menu. In `aim` Esc releases the mouse first (and explicitly calls `exitPointerLock`, because some embedded browsers do not).
   - Mouse: left = primary action of the active tool, right = its opposite (paint/erase, raise/lower, add/remove), wheel = hotbar prev/next, hold Tab = preset palette (wheel selects). The text shown is the tool's own description, never a key list. Keys live in Settings > Controls (rebindable, sensitivity, invert Y, FOV, left-handed).
   - Camera modes (top right, next to "Back to Island"): Walk (FPS) / Third person / Fly (build only).
4. **Presets all the way down, copy-on-write.** Every default (a voxel goblin, the island, a hotbar button, a look) is a preset in the store. The first edit of a default silently forks it (`forkOf`), the fork gets a name you can change, and the editor then points at the fork. Branches show up in "My Islands", last visited first.
5. **Platform ports.** One `Platform` interface (storage, profile, community/UGC, rooms + chat, leaderboards, events, multiplayer) with two adapters: `LocalSim` (today's simulated community) and `Run` (RUN SDK). The game never calls the SDK directly. RUN already offers: UGC (100 KB entries, browse, follow creators) = community presets; Room chat; persistent rooms and seasons (advanced multiplayer) = shared world; Leaderboards; Sharing links; LiveOps config (scheduled events and news without a new build); Shop and Credits (careful: real-money currency is out of scope for us). Servers for rooms are a second bundle (a `GameRoom` class): our deterministic sim can run there.

## 3. Milestones (each ends with the e2e smoke green and a screenshot review with the owner)

**M0 Foundations** (me): WorldHost, router + route table, input contexts and the Esc contract with `@hm/uistack`, galaxy as a viewport (the main menu disappears on dive; an auto-hide top bar appears on Esc: **Back to galaxy**, breadcrumb Galaxy › Planet › Island › Goblin, ◀ jump up one level, ▶ into the selected), Controls window with live diagnostics, remove `#edit`/`#race` pages. e2e: no-trap walk.

**M1 My Islands** (me): island registry with `@hm/activities`-style create / duplicate / delete / undo; named branches; last-visited first; copy-on-write defaults; an island has no track by default. Racing keeps its own map. Saves in a versioned, compressed bundle (RUN UGC entries are 100 KB, so terrain data needs chunking / RLE).

**M2 Build mode** (me, with Arena catalogs): the studio toolbar in the world (pointer, brush, sculpt, hand, timeline, speaker, camera, person, delete) with slide-out tool sets from `toolcatalog`, camera mode toggle, Tab palette, primary / secondary mouse actions, tool descriptions, auto-hide shelves, movable closable windows, preset tree with double-click to zoom into a preset and a gear at the raw value, button presets with "+ attribute" using `@hm/plugs`, the publish dialog (Keep private / Up for sale / Share freely / Share with friends, name, description), header: **Back to Island**, **Community**, tabs removed.

**M3 Look** (Arena presets, me for the pipeline): `light`, `post`, `render` preset kinds and their editors (sun dial, light gizmos, exposure, fog, bloom, SSAO, grading, vignette); EffectComposer; ultra quality default on this PC with automatic fallback; terrain skins as presets (`flat` voxel palette designed by hand, `pbr` from math); stochastic tiling + macro variation shader; PBR grass from `pbrgrass`; the lighting scenes you pick from Light Lab.

**M4 Characters** (Arena parts, me for the assembler): `voxparts` library merged, `assemble(spec)`, **My Avatar** from the Esc menu (turntable viewer, part categories as thumbnails, palette schemes, randomise, mirror, "edit in sculpt" on a duplicate), avatar preset saved and shareable, optional smooth surface (`smoothvox`), rider preset (starts as a copy of your avatar, swappable).

**M5 Goblin Racing as its own game** (me): activity home = a live camera shot of the island with an AI race running under the broadcast director; live events advertised (tournament in X, heats now); one-click spectate (needs input-stream replays: deterministic sim exists, recording does not); rider and ball editor; racing profile (stats, rating, credits, bets, history); bookie on heats.

**M6 Community and social** (me + Platform adapters): friends list and quick connections, tabs (activities with news / events, general chat, shared presets), buy / sell / trade in credits, report and mute, friends-only chat by default.

**M7 Tutorial** (me, engine merged): runs on My Island; guides placing a first Goblin Racing preset and tweaking it; the PBR reveal button; skippable, "not now" and "never" choices stored in the profile.

**M8 Content waves** (Arena): batches of presets (textures, parts, lighting, sprites, sounds, tool icons), only after one of each kind is accepted. `texfit` (analyse a reference with math and fit our preset parameters) once `pbrgrass` is accepted.

## 4. Battle plan

In flight (6 jobs, reply route, prompts in `docs/handoff/prompts/battle/`):
| Job | Tab | Chat |
|---|---|---|
| pbrgrass | tab-1 | arena.ai/c/01a0fdbb-6528-7c26-8197-5f89bf3877e2 |
| voxparts-head | tab-2 | arena.ai/c/01a0fdbb-bb4f-7634-8086-63319176f5e3 |
| voxparts-body | tab-3 | arena.ai/c/01a0fdbb-fc7f-7565-adb1-7986aebbd1e8 |
| smoothvox | tab-4 | arena.ai/c/01a0fdbc-3e79-75d3-97b0-bf0e0f7f99ab |
| lightlab (a web app in the preview; compare the two options by eye) | tab-5 | arena.ai/c/01a0fdbc-bd21-7461-bd5e-15421dd893b1 |
| toolcatalog | tab-6 | arena.ai/c/01a0fdbd-11e9-7345-9f44-af3c3ff201ec |

Process, to make big batches safe: (1) one of each kind first; (2) I write acceptance tests BEFORE merging (the sculpt library taught us agents ship stubs); (3) golden-image review of the preview with the owner; (4) once three accepted examples exist per kind, write the "how to make one" brief the Codex agent will use (format, validators, test harness, naming, palette rules); (5) run big batches in parallel tabs, merge with the recipe in CATCHUP, drop weak ones.
Next jobs to write: `texfit` (reference → parameters), `avatar assembler` checks, `skins` (voxel-matching ground palette), `postfx` data presets, `racing profile` maths (rating, odds, payouts), `replay` (input stream recorder / player), `chatsafety` (word filter, rate limit, report queue), `thumbnails` (offscreen preset thumbnails).

## 5. What we were not thinking about, and my answer
1. **Navigation dead ends.** Solved structurally (route table + no-trap e2e), not by hand-checking.
2. **GPU contexts and memory.** One renderer (M0); dispose tests for levels.
3. **Real backend.** RUN has rooms, chat, UGC, leaderboards, LiveOps. Adapters keep a local sim for offline. Needs the RUN login to deploy (not authorised yet).
4. **Moderation and safety.** Chat and shared names: word filter, rate limits, report / mute, friends-only default, no external links, adult gate for build mode and the community tab for under-age profiles. Shared presets may contain scripts: they run in the QuickJS sandbox with limits.
5. **Save size.** Terrain data and voxel models must compress and chunk; RUN UGC allows 100 KB per entry; prefer storing recipes (math) over baked data.
6. **Determinism for spectating and tournaments.** Recording inputs needs fixed-step sim (have), seeded random everywhere (audit), and version pinning of the canon a race ran on.
7. **Cheating.** Island edits never affect others; tournaments run on locked canon; results come from the server room, not the client.
8. **Economy.** Credits only. Sources: races, daily play. Sinks: bets (house edge), cosmetics, buying presets. Caps per day; no real money. Creator share on sales to be decided.
9. **Accessibility and input.** Gamepad, touch (virtual stick + tap-to-aim), remapping, reduce motion, colour-blind-safe palettes, text size.
10. **Performance budgets.** Voxel models instanced, LOD with smoothvox chain, particle cap, quality tiers with automatic fallback; the ultra tier is for this PC only.
11. **Testing.** Unit tests (918), real-Chrome smoke (`npm run e2e`). Next: golden images for looks, and an "every preset kind validates and renders" sweep.
12. **Preset thumbnails.** "Preset examples rather than text" means every preset needs a thumbnail rendered from itself (offscreen), cached by hash.
13. **Versioning and migration.** Schemas carry a version; saves migrate; shared presets pin the schema they were made with.
14. **Undo scope.** One undo stack per island; stroke-level for sculpting; undo does not cross sessions.
15. **Time.** Weekly events need a server clock (RUN `TIME`/LiveOps), not the device clock.
16. **Localisation** hooks (strings are presets already).
17. **Licences / credit** for remixed presets: `forkOf` chain is the credit; sale items are immutable revisions.
18. **Where the owner tests.** The LAN host (8080) is the tester's build; every milestone must pass the e2e before it is announced.

## 6. Decisions I need from the owner
1. Ground style: should the default island be **voxel-flat** (a hand-picked palette of ~12 colours with blocky shading) or full PBR from the start? My recommendation: ship flat as the default and let the tutorial reveal PBR.
2. Under-age profiles: hide Community and chat completely, or friends-only? Recommendation: friends-only chat, no Community tab, no build mode.
3. Do tournaments and the bookie stay credits-only forever? (Standing rule says yes.)
4. Approve using the installed Chrome for automated tests (no download) and a hidden test window; tests now never hold the real mouse.
5. RUN account: when you are ready to deploy, I need you to log in (I will not do that).
