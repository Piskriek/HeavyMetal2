# Product flow: a game inside a game

## The loop
Main menu (galaxy behind it) -> **My Island** (you are the goblin) -> build, play activities, share presets -> **Multiplayer** (the galaxy hub) -> jump into an activity (Goblin Racing is the first) -> back to your island.

## Screens and states
| State | What you see | Esc does |
|---|---|---|
| `menu` | Galaxy backdrop. Buttons in order: Play, Multiplayer, My Island, Settings | nothing |
| `zoom` | Camera dives galaxy -> planet preset -> island -> goblin, then hands over | skips to the goblin |
| `island` | Third/first person goblin, crosshair, hotbar (1-9), inventory (E) | closes open toolbars/windows, else opens the **jump menu** |
| `jump menu` | Main menu / Build mode / Activities / Settings / Back to walking | closes it |
| `build` | The island with the build toolbar; inside a preset the world whites out (focus) | zooms out one level, else jump menu |
| `activities` | Cards: Goblin Racing (default preset), other activities; Create new / Duplicate / Remove (defaults cannot be removed, only hidden) | closes |
| `hub` (Multiplayer) | The galaxy; the Goblin Racing planet hosting the tournament is highlighted; top tabs: Hub, Community, (Market, Friends later) | back to menu |
| `activity:<id>` | A separate game's own menu. Goblin Racing: Quick race, Tournaments, Spectate, Rankings, Settings, My Goblin (customize the ball), the Bookie | back to the hub |

Esc is layered (one press closes exactly one thing): dialog > floating window > slide-out toolbar > shelf > focus (zoom out) > jump menu.

## Build mode
- Crosshair + pointer lock. Click = use the hotbar slot under your hand.
- The hotbar is a list of **button presets**. A button preset has attributes with plug points (on click, on hover, on place, ...). "+ attribute" lists exactly the preset kinds that fit that plug (sprite, sound, tool, script, model...). Pick one and it appears as an editable parameter, which can itself be a preset (inception).
- Default hotbar: 1 Select, 2 Brush, 3 Sculpt, 4 Place, 5 Dress, 6 Models, 7 Track, 8 Camera, 9 Delete. Every use is satisfying by default: a dust/sparkle burst + a sound.
- Save asks: share with the community? **Keep private / Up for sale / Share freely / Share with friends**, name, description.

## The questions we were not asking, and the decisions
1. **Who is allowed in build mode?** "For adults". Build mode sits behind a grown-up switch (profile age band; on RUN, the platform rating). Kids profile: My Island walking and activities only. The gate is a data variable, not hard-coded.
2. **No server (static hosting). How is multiplayer real?** Asynchronous first: tournaments and rankings are deterministic replays + leaderboards stored with the platform; spectating = replaying input streams; live netcode later. Until a backend exists the hub runs on a seeded local "sim community" so the whole flow can be tested offline.
3. **Currency, buying, selling, trading, the bookie.** In-game credits only, never real money (standing rule). A ledger with integer credits, no negative balances, every transfer an auditable entry. The bookie takes bets in credits on tournament heats.
4. **Shared presets can contain scripts.** They run in the QuickJS sandbox, size-limited (RUN UGC bundles are 100 KB), no network. Every published preset carries its lineage (`forkOf`), author, version, hash. Report/hide exists from day one; sold presets are immutable revisions.
5. **Griefing.** Your island is private; visitors are read-only; trading moves copies of presets, never edits someone else's world.
6. **Fairness in tournaments.** Tournaments run on the canon rules (locked presets). Island edits never change anyone else's race.
7. **Remix rights.** Licence = the visibility choice: private / for sale (buyer may use, not resell the original) / free (remix allowed, credit kept via lineage) / friends. Forks always credit the source.
8. **Discoverability.** Presets need a thumbnail, tags, kind, popularity. Thumbnails are rendered from the preset itself (a small offscreen render), never uploaded files.
9. **Falling off / dying / stuck.** The goblin respawns at the island spawn point; a "Home" action always exists in the jump menu.
10. **Name and description safety.** Length limits + a blocked-word filter; names are checked before publish; no external links.
11. **First run and the tutorial.** The tutorial is a state machine of steps with conditions; it is skippable and resumable, runs in My Island, and its climax is the **PBR reveal**: until then everything wears the flat voxel skin; a button switches presets to the PBR default skin. Returning players never see it again unless they ask (Settings > Replay tutorial).
12. **Skins.** `skin` is a preset kind: `flat` (voxel-matching, posterised, no relief) and `pbr` (full normal/roughness). The island starts flat to match the voxel goblin.
13. **Input and accessibility.** Mouse + keyboard (pointer lock), gamepad, touch (virtual stick + tap). Every action has a key; reduced motion setting turns the cinematic into a cut.
14. **Performance.** Quality tiers; this PC runs `ultra`; phones auto-drop. The cinematic must hold frame rate on all tiers (it is just camera + stars).
15. **Saving.** Local first (RUN cloud storage shim), versioned; autosave; the island and hotbar are presets in one bundle so export/share is one code.
16. **What if two players want different canon?** Branches (see EVOLUTION.md): the activity declares the canon it runs; your island may use any branch.
17. **Audio.** Starts muted until the first click (browser policy), music and effects separate, every feedback sound is a preset.

## Build order
1. Shell: state machine, main menu over the galaxy, zoom cinematic, Esc layers + jump menu.
2. Island play: crosshair, hotbar, inventory, juice (sprite + sound on every edit).
3. Button presets with plug points, the publish dialog.
4. Activities registry + Goblin Racing menus, tournaments, bookie.
5. Multiplayer hub on the sim community, Community tab (list/buy/sell/trade).
6. Tutorial with the PBR reveal; flat skin first.
Pure logic (navigation/Esc stack, plugs and publishing, activities, tournaments, tutorial, juice/VFX) is delegated to the battle agents; glue is written here.
