# FIDELITY // Base-Building Research: what similar games do, what players like and hate
> **Why this exists**: the owner (2026-10-10): "i dont see roof pieces, this just preliminary? did you do the required research on similar games?" The first kit (sheet 13) was designed from memory of Valheim and Dune, without research. This is that research. It changes the piece list, the rules and the build UX below.
> **Read with**: [`BASE_BUILDING_ARCHITECTURE.md`](BASE_BUILDING_ARCHITECTURE.md) (decisions D1–D11). New proposals here are R1–R12; the ones needing the owner are marked **OWNER**.

---

## 1. What was looked at

| Game | What it teaches us |
|---|---|
| **Valheim** | Stability colours by distance from the ground; 26° and 45° roofs; the most-used building mods. |
| **Dune: Awakening** | Grid-snapped bases; blueprints of whole layouts (Solido Replicator) and full base backups; the backlash against upkeep and decay. |
| **Conan Exiles** | A large catalogue: wedge and triangle foundations, sloped roofs, window frames, doorways, stairs; stability 100, minus 20 per step. |
| **Enshrouded** | Crafting from base chests, but locked behind upgrades (and players complain). |
| **Satisfactory 1.0** | Dimensional Depot (build straight from remote storage); Blueprint Designer (save an arrangement, reuse it as a module). |
| **Space Engineers** | Airtight rooms; airlocks as two doors; hidden leaks. |
| **No Man's Sky, ARK, Once Human, Palworld** | Snapping and placement complaints, and free-placement toggles. |
| **7 Days to Die** | "Craft From Containers" is a top quality-of-life mod. |

Sources are at the end. Most player sentiment comes from Steam threads and mod pages, so it is vocal players, not surveys. Weigh it as recurring themes, not statistics.

---

## 2. Findings and what we do about them

### F1. Every comparable game has a far bigger piece catalogue, and roofs are central
Valheim ships 26° and 45° roof sets (pitch matters: steep roofs shed snow). Conan's base list alone has foundations, wedge foundations, triangle ceilings, window frames, doorways, sloped roofs, sloped wedges, roof angles, staircases (straight, railed, corner), ceiling bevels and ramps. Our 11 pieces have no pitched roof, no window, no doorframe, no stairs, no half wall and no corner piece. Bases would be the "boxy" look Dune players complained about.

**R1, extend the kit (structure round 4 + art sheet 15):**
- **pitched roof**: one storey over one cell (about 37°), r = downhill side
- **low roof**: half a storey over one cell (about 21°)
- **inner and outer roof corners**, and a **ridge cap**
- **gable wall**: the triangle that closes a pitched roof's end, an edge piece
- **half wall**: 1.5 m high
- **window wall**: seals like a wall
- **doorframe**: an open edge
- **interior door**: seals only when shut, like the airlock but light
- **stairs**: one storey over one cell; the ramp's slot, with steps
- **ladder**: an edge piece, one storey
- **railing**: a half-height edge piece, no barrier
- **diagonal brace**: a support piece, see F3

Triangle and wedge pieces (off the square lattice) are left for later. Conan players report they snap badly against square pieces, and they would break our exact slot model. Revisit only if bases still look boxy.

### F2. Snapping is the most-hated part of every building system
These complaints recur across ARK, Once Human, Palworld, Orebound and No Man's Sky:
- the preview shows one place and the piece lands in another
- roofs and stairs won't snap
- rotation never reaches the fourth side
- there is no 90° key
- thin pieces lose their snap
- you need scaffolding just to reach a snap point

Valheim's most-recommended mods fix exactly this: Gizmo (fine rotation), Build Camera (a free-floating camera, so no scaffolding) and Craft From Containers.

Our lattice snap is deterministic, and the ghost shows exactly `snap()`'s answer, so "preview here, lands there" cannot happen by construction. Keep that guarantee as a test. The rest becomes UX work:

**R2, the build UX bar:**
1. **R** turns 90° through all four directions.
2. Open sockets on nearby pieces glow, so you see where things can go.
3. Snap reach is generous: 3 m from the aim (done).
4. A **build camera**: hold a key in build mode to fly the camera free (with reach measured from the player). No scaffolding, ever.
5. **Fixtures** (bins, benches, repeaters, decor) also get a free placement mode: any yaw (Shift + wheel in 15° steps, Alt for 1°) and sub-cell position inside their cell. Structure stays on the lattice; furniture does not have to.
6. The refusal reason is always shown under the reticle in plain words (done in TASK-01).

### F3. Stability: players want it, but "my roof went red" is the classic failure
Both systems agree with ours:
- Valheim: blue grounded, then green, yellow, orange, red; collapse on red.
- Conan: about 4 segments from support.

The recurring pain is roofs and long spans going red, fixed by stacking posts.

**R3:** keep D2's colours, adding **orange** between yellow and red (Valheim's five steps). Make roofs easy to hold up:
- a pitched roof is supported by the wall or beam under its low edge, by the opposite roof at the ridge, and by a gable under its end;
- a **diagonal brace** (wall face to the floor above) gives a cantilevered floor vertical support.
Hovering a piece with the build tool shows its exact support number, as Conan's Tab view does.

### F4. Crafting and building from linked storage is the single most wanted quality-of-life feature
- Valheim and 7 Days to Die: "Craft From Containers" is among the first mods recommended.
- Enshrouded has it, but locks it behind magic-chest upgrades that repeat per tier, and players ask for it by default.
- Satisfactory's Dimensional Depot lets you build straight from remote storage; its upload caps and slow speeds are the tedious part.

The owner's linked quantum storage is exactly this. **R4:** it works from the first bin (the lab bridge links everything near the gate on day one), with no upgrade gate and no transfer speed limit (as D9 already does). Repeaters only extend its range.

### F5. Whole-base blueprints are expected now
- Dune: Awakening's Solido Replicator saves a base's layout (structure only) to rebuild elsewhere, and a Base Backup tool stores a whole base with its contents.
- Satisfactory's Blueprint Designer saves an arrangement inside a box and places it again as a module (stack four floors from one).

**R5 (OWNER):** **layout blueprints**. At the Drafting Table, save a structure (or a selection) as a layout. Place it later as a ghost that you fill: pieces appear as you pay for them, from linked storage. Share it in the Community Nexus. The codec we just landed (`@hm/structure` encode/decode, round 3) is exactly the format.

This goes beyond the owner's words ("Drafting Table to combine primitives + maps into custom structural blueprints"). It extends them, so it is the owner's call.

### F6. Upkeep and decay are the most hated mechanic in the genre right now
Dune players lose their whole base, and everything in it, after weeks of neglect, and the developers kept the system. **R6:** no upkeep, no decay, ever. That also matches the plot rule "metrics only rise, nothing is ever taken from the plot".

### F7. Pressure needs a source, and airlocks are two doors
In Space Engineers a room is airtight only when fully enclosed by airtight faces; vents do the pressurising, and only while every door is shut. A single door works, but wastes air each time it opens; the classic airlock is two doors back to back. Hidden leaks (blocks you would expect to seal, but don't) are a top frustration.

Our `rooms()` already finds sealed rooms exactly, so no hidden leaks are possible, and the HUD can show which edge leaks. **R7 (OWNER):**
- A sealed room becomes pressurised (no sync drain inside) only with a **life-support fixture** in it, powered.
- An **airlock** keeps pressure when it is a vestibule: two airlock doors on one cell, which open in turn (interlocked).
- A single door straight to the outside works too, but repressurising takes a few seconds after each opening.

### F8. Modular rooms help day one
The Planet Crafter builds from ready-made room modules. Dune, Valheim and Conan build from parts. **R8 (OWNER):** keep parts, but give a new player a **starter shelter layout** (one sealed cell with an airlock), placed in one action from a free layout blueprint. It teaches walls, roof, airlock and pressure in one step, and it uses R5's mechanism.

### F9. Let structures meet rocks
Dune players complain that walls cannot clip into rock faces, which pushes bases onto flat open ground. **R9:** walls, pillars and fixtures may clip into terrain (they already skip the terrain check). Only floors and foundations refuse terrain above their top. Keep it so.

### F10. Smaller notes
- **R10:** taking down refunds 100% (Valheim), as in D11. Keep it, so players experiment.
- **R11:** a piece cap per plot, for performance, shown in the HUD long before it is reached. Dune limits base size for server load; ours runs on a GTX 950M. Start at 1,500 pieces per plot and measure.
- **R12:** the build menu shows each piece's support behaviour in one line ("roof: needs a wall or beam under its low edge").

### F11. The frontier: newest releases and announcements (2025–2026)
- **Bases that move.** PC Gamer counts at least six 2026 survival games where the base is a train (Steel Ark, Railborn, Enginefall), plus a camper van (Outbound) and wagons (Westlanders). The base travels with you and adapts to each landscape.
  **R13 (OWNER):** our structures already carry their own pose, so a structure can ride on a fabricated rover chassis. That would be a **mobile outpost** that docks at plots and carries a linked bin. It fits the in-game fabricators of the pinned milestone. A proposal only; nothing is built.
- **Hytale (early access January 2026)** ships a creative suite:
  - prefabs saved as assets and kept as a personal, shareable building library
  - a separate Prefab Editor world for browsing and editing them
  - asset-defined brushes (mountains, procedural ruins) editable in its node editor
  - a sculpt brush, undo, block rotation and previews
  This confirms R5 (layout blueprints as a shareable library through the Community Nexus). It is also the bar for the Studio: brushes and prefabs as data, with undo everywhere.
- **Rust's 2025 blueprint rework** drew mixed reactions, and **Solarpunk** sells "very few restrictions". There is no detail yet worth copying; check again before round 4.
- Post-launch builder sentiment on Hytale's tools was not findable yet. Check r/hytale and its forums before the Studio's next pass.

---

## 3. What changes now

| Change | Who | When |
|---|---|---|
| Art sheet 15: pitched and low roofs, corners, ridge, gable, half wall, window wall, doorframe, interior door, stairs, ladder, railing, diagonal brace, life-support fixture (S1 and S6, one design each) | Arena art agent | now |
| `@hm/structure` round 4: the R1 kinds and their slots and support (R3); `rooms()` counts roofs as ceilings and window walls and gables as barriers; brace support | Arena battle (same chat) | after sheet 15 is approved |
| Five-step integrity colours, support number on hover, socket glow, build camera, fixture free placement, refusal readout | Flash (TASK-05) | after TASK-04 |
| Life support and pressure (R7), layout blueprints (R5), starter shelter (R8) | design waits for the owner | after the owner decides |
| Piece cap (R11) | me, in `world.ts` | with the perf pass |

---

## Sources

**Valheim**
- [Valheim general building guide (Mobalytics)](https://mobalytics.gg/gamebase/guides/valheim-general-building-guide)
- [How to build a roof in Valheim (eip.gg)](https://eip.gg/valheim/guides/how-to-build-a-roof-valheim/)
- [Deep North base building: snow and roof pitch (pixelnitro)](https://pixelnitro.com/?p=18266)
- [Steam: Valheim roofing support](https://steamcommunity.com/app/892970/discussions/0/3144053275967089472)
- [Recommended Valheim mods (xgamingserver)](https://xgamingserver.com/docs/valheim/recommended-mods)
- [10 best Valheim mods (eip.gg)](https://eip.gg/valheim/guides/10-best-mods/)

**Dune: Awakening**
- [Steam: Dune Awakening building discussion](https://steamcommunity.com/app/1172710/discussions/0/813573979618948996)
- [Dune Awakening: your settlements are an assault on good taste (Galaxus)](https://www.galaxus.ch/en/page/dune-awakening-your-settlements-are-an-assault-on-good-taste-38904)
- [Dune DLC critique: base loss (mein-mmo)](https://mein-mmo.de/en/dune-awakening-analyse-kritik-dlc-lost-harvest-verlust-basis,1524817)
- [How to move your base (Icy Veins)](https://www.icy-veins.com/other-games/news/how-to-move-your-base-in-dune-awakening/)
- [Base Reconstruction Tool (awakening.wiki)](https://awakening.wiki/Base_Reconstruction_Tool)

**Conan Exiles**
- [Building pieces list (Steam workshop post)](https://steamcommunity.com/workshop/filedetails/discussion/1411872074/3160848559785722982)
- [Stability guide (conanexiles.com wiki)](https://conanexiles.com/wp-content/wiki/2693562384.html)
- [Steam: stability per segment](https://steamcommunity.com/app/440900/discussions/0/2844543519797993562)
- [Roof snapping issues (Funcom forum)](https://forums.funcom.com/t/roof-snapping-issues-for-inverted-towers/124611)
- [45° triangle ceiling and wedge (Funcom forum)](https://forums.funcom.com/t/45-triangle-ceiling-wedge-foundation-horisontal/60460)

**Enshrouded**
- [Feature request: auto-pull from local chests](https://enshrouded.featureupvote.com/suggestions/713754/crafting-materials-should-autopull-from-local-chests-by-default)
- [Enshrouded storage (wiki.gg)](https://enshrouded.wiki.gg/wiki/Storage)
- [Steam: crafting from chests](https://steamcommunity.com/app/1203620/discussions/0/4630359652384664311)

**Satisfactory**
- [Dimensional Depot (wiki.gg)](https://satisfactory.wiki.gg/wiki/Dimensional_Depot)
- [Dimensional Depot Uploader (wiki.gg)](https://satisfactory.wiki.gg/wiki/Dimensional_Depot_Uploader)
- [Blueprint Designer (wiki.gg)](https://satisfactory.wiki.gg/wiki/Blueprint_Designer)
- [How to use the Blueprint Designer (Prima)](https://primagames.com/?p=282290)

**Space Engineers**
- [Airtightness (wiki.gg)](https://spaceengineers.wiki.gg/wiki/Airtightness)
- [Air Vent (wiki.gg)](https://spaceengineers.wiki.gg/wiki/Air_Vent)

**No Man's Sky, ARK, Once Human, Palworld**
- [Steam: No Man's Sky snapping](https://steamcommunity.com/app/275850/discussions/0/3092275748072936871)
- [Steam: No Man's Sky free placement](https://steamcommunity.com/app/275850/discussions/0/4202490864586160727)
- [Steam: ARK snapping](https://steamcommunity.com/app/346110/discussions/0/1835685838065733855)
- [Steam: Once Human building](https://steamcommunity.com/app/2139460/discussions/0/4410795908426156457)
- [Steam: Palworld building](https://steamcommunity.com/app/1623730/discussions/0/4414173015254665141)

**Frontier (2025–2026)**
- [Trains are taking over the survival genre (PC Gamer)](https://www.pcgamer.com/games/survival-crafting/trains-are-taking-over-the-survival-genre-there-are-a-half-dozen-survival-base-builders-on-rails-coming-in-2026/)
- [A good year for survival crafting (PC Gamer)](https://www.pcgamer.com/games/survival-crafting/it-was-a-good-year-for-survival-crafting-sickos-and-ill-be-playing-some-of-these-well-into-2026/)
- [Hytale creative mode (hytale.com)](https://hytale.com/news/2025/11/hytale-creative-mode)
- [Hytale is finally here (hytale.com)](https://hytale.com/news/2026/1/hytale-is-finally-here)
- [Hytale prefabs guide (The Spike)](https://www.thespike.gg/hytale/beginner-guides/prefabs-guide)

**7 Days to Die**
- [Craft From Containers proximity logic (7d2d wiki)](https://wiki.7d2d.net/mods/craft-from-containers/)
- [Steam: 20 quality-of-life mods for v1.0](https://steamcommunity.com/app/251570/discussions/5/4417550696871641620)
