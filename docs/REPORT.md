# REPORT: where the game stands (end of the 2026-10-03 session)

For the owner, and for whoever picks this up on another PC. Every ask with its status is in `docs/STATUS.md`; the owner's own words are in `docs/OWNER_ASKS.md`. This file is the overview: what you can do today, how the screens connect, how testing starts, what is missing, and how to take over.

---

## 1. Where it stands, in one page

The harness runs as one web page (one 3.9 MB html file for RUN). You boot to a main menu over **your own island**, press Play, **make your goblin** (looks, colours, parts to wear, a name), and land on the island as that goblin. Everything you touch there is a **preset with an editor**:

- **Walk** as your goblin (third or first person). Its moves are animation presets.
- **Build** with the hotbar: tabs on F1 to F10 hold tools, animations, sounds, lights, activities, looks and cameras, nine slots each, with previews.
- **E** opens all presets of a tab: click one to hold it, Edit to change it in a movable window.
- **Tools set off plugs**: sprites, sounds, goblin moves and camera shakes, on use, right click, pick or let go. "+ attribute" adds more.
- **The world responds**: dug grass shows soil, then rock; plants follow the ground or get dug up; things you place stand on the ground.
- **Studio mode** (B) flies without the goblin, keeps the mouse free, focuses on one thing and hides the rest.
- **Lights, sounds, world rules and plant behaviours** are editable too, and the island saves itself.
- **A ten-step tour** ends with the **PBR reveal**: the flat voxel ground turns into the full ground with a flash.
- **Share** any preset or the whole island with a choice of who gets it (private, for sale, free, friends). It is checked and stays on this device until the platform is connected.
- **Multiplayer** is the galaxy as a black-and-white star chart with planets pinned over their stars; hover a planet to see what is played there.
- **Goblin Racing** is the example activity: menus, races, simulated tournaments. The old full editor is kept as "Race track editor".

Quality: the island has a volcano, palm groves, meadows, turquoise shallows with foam, clouds, flat or PBR ground, 18 lighting presets and graphics tiers up to Ultra. Automated: **1126 unit tests and 52 browser checks pass** on the production build.

What it is not yet: online. Friends, chat, real shares and real tournaments need the platform backend (RUN). There are no input replays, so there is no spectating. The parts library cannot swap the goblin's body yet (only add things to it). Most textures are still image files rather than math presets.

---

## 2. How the screens connect

```
Main menu (over your island; the camera sways round your goblin)
├── Play ──► Create your goblin (first time only) ──► your island, as the goblin
├── Multiplayer ──► the galaxy star chart (hub)
│                    ├── hover a planet: what is played there; click: details, Jump in
│                    ├── Community tab: shared presets (simulated) + Your shares
│                    └── Main menu / Back to Island
├── My Island ──► your island (skips the creator)
└── Settings ──► grown-up mode, name, skin (Flat/PBR), graphics, mouse and view
                 (speed, invert, field of view), the controls list, replay the tour

Your island
├── HUD: tab strip F1..F10, hotbar 1..9, what you hold, Walk/Studio, 1st/3rd, Flat/PBR
├── E: Your presets (cards) ──► Edit ──► movable editor windows
│      (tools + plugs + sprite editor, moves, sound + Sound Lab, lighting, world rules,
│       plant behaviour, looks + parts, activities, cameras), Share… in each
├── Hold Tab: the quick wheel of the open tab (clickable while the mouse is free)
├── The tour card (skip / not now / never; Show me = PBR reveal)
└── Esc (closes one thing at a time, then): Menu
       Main menu · Studio mode · Race track editor · Lighting · My Avatar ·
       Share my island · Show the tour · Activities · My islands · Multiplayer · Back
       + the galaxy bar on top: Back to galaxy, up a level (island overview), into
Activities ──► Goblin Racing menu (quick race, tournaments, rankings, settings) ──► races
My islands ──► create / duplicate / rename / delete / undo, open one
Race track editor (the older Maker) ──► Back to Island, Test drive
```

Every arrow here is walked by the e2e test except the inner racing pages and the Maker's panels.

---

## 3. How testing starts

### 3.1 The owner's first pass (laptop, about 20 minutes)

Start the dev server on this PC (`npx vite --port 5192 --host 0.0.0.0 apps/web`), then open `http://192.168.0.5:5192` on the laptop. To see what a new player sees, use a private window. Go through this list and note anything that feels wrong:

1. **Menu.** The goblin stands in a palm grove, the volcano behind, the camera sways. Nothing should clip through hills.
2. **Play.** Make a goblin: try the looks, the dice, a hat, something in hand, something on the back. Give it a name and press Done.
3. **Mouse.** On the island, click the world. The mouse should be captured: no cursor, mouse look. **This is the one thing that can only be tested on the laptop.** Esc should let the mouse go.
4. **Walking.** A walks left and D walks right. Space jumps, Shift runs, V switches to first person. Watch the goblin's arms and legs move.
5. **The tour.** Follow it, or Skip to "The big moment" and press Show me. The ground should turn PBR with a flash.
6. **Building.** F3 Sculpt: raise and dig ground near a palm; it should follow the ground or fall over. F2 Paint: paint sand. F9 Things: place a palm, then right click to take it away. Ctrl+Z undoes.
7. **Presets.** Press E, click Edit on a sculpt tool, then "+ attribute" and add Camera shake "When you let go". Use the tool and feel it. Edit its sprite.
8. **Sound.** F5, E, Edit any sound: change its pitch and play it. Roll a new one in the Sound Lab.
9. **Studio.** Press B: fly, F to focus on a placed thing, H to hide the rest, B to walk again.
10. **Lights.** Esc, then Lighting: try presets and move the Clouds knob. Check the sea from above (Esc, up arrow in the bar): no flicker (z-fighting) while it turns.
11. **Share.** Esc, then Share my island, then Up for sale with a price; check it appears in Multiplayer, Community, Your shares.
12. **Multiplayer.** Hover a planet in the star chart.
13. **Settings.** Change the mouse speed and invert, then walk again.

Report back in plain words. The next session turns each note into a fix, or adds it to `docs/STATUS.md`.

### 3.2 Automated checks (every commit)

```bash
npm run verify
```
```bash
npm run build
```
```bash
npm run e2e
```

`verify` runs the typecheck, every package test and the single-file build. `e2e` drives the **built** file in the installed Chrome through the whole flow above, so build first. It stubs pointer lock and never holds the real mouse; it needs Google Chrome installed.

What the automatic checks cannot see: how things look (no golden images), pointer lock on real hardware, frame rate on the laptop, and sound.

### 3.3 Next steps for testing

- Golden screenshots of the menu shot, the island overview and the creator, compared with a tolerance, so a look regression fails the build.
- A frame-time budget check in e2e at each quality tier.
- A short playtest with a child on a kid profile (grown-up off).

---

## 4. What is missing, in the order I would do it

1. **Fix what the owner's test pass finds** (section 3.1).
2. **Body parts in the creator**: swap heads, torsos and legs. The assembler's goblins need better proportions first (tiny heads, missing arms), then a rig built from the assembled part boxes.
3. **More island**: palm variants, rocks in the shallows, driftwood, terraces and a lava flow on the cone, steam at the crater, real waves.
4. **Goblin Racing live shot + spectate**: input replays (the sim is deterministic), a live island shot in the racing menu.
5. **Evolve**: branches of an activity's presets (C15), then evolution, winners' statues, majority rules (`docs/EVOLUTION.md`).
6. **Math textures**: texgraph presets for the PBR ground, so no image files remain (P3); pick up `pbrgrass` rev 2 from Arena.
7. **Platform**: shares, community, friends, chat and tournaments through `@hm/platform` (LocalSim first, then RUN). Deploying to RUN needs the owner's login.
8. **Controls**: rebinding, left-handed. Also the hierarchy zoom (double-click down to the raw value), goblin doodle art on the UI walls, auto-hide shelves.
9. The C4 "favourite preset" in the menu shot (for example the most used preset of the week as a prop or statue beside your goblin).

---

## 5. Hand-over to another PC

- **Code**: GitHub `Piskriek/HeavyMetal2`, branch `main` (this harness, replacing the old game code). The previous `main` is kept, untouched, on `archive/main-2026-10-03`, next to the older `archive/pre-cleanup-2026-09-28`. Open PR Piskriek/HeavyMetal2#62 (the Basalt Isle texture work) was made against the old main, so its diff against the new main is meaningless. Its branch is intact; rebase or retarget it if its tiles are still wanted.
- **Set up**: install Node 22 and Google Chrome, then:

```bash
git clone https://github.com/Piskriek/HeavyMetal2.git
```
```bash
npm install
```
```bash
npm run dev
```

- **Read first**: `docs/STATUS.md`, this file, `docs/OWNER_ASKS.md`, then `docs/handoff/CATCHUP.md` for the workflow (Arena battles, file transfer recipes) and history.
- **Rules that hold**: everything is a preset; sliders never lock; tests never take the owner's mouse; ask only before outward actions (posts, deploys, purchases); never sign in anywhere for the owner; at most two new Arena chats at a time; the owner's latest message wins.
- **Art pipeline**: lives outside this repo (`C:\Work\repo\hm2-art`, `E:\AI\hm2-art\out`). The tiles the island uses are copied into `apps/web/public/textures/`.
