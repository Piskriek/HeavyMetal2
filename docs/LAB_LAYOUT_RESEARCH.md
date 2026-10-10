# The lab: research for a AAA layout (2026-10-10)

> Owner (2026-10-10): "the lab design is not final so feel free to make it nice as you can and have it match what your doing with the other stuff"; "the layout, it can all change if you feel there is a more AAA presentation we can aim for". This is research and proposals for the owner to decide. Nothing here is built.
>
> **What the story needs from the room** (docs/NARRATIVE_AND_LORE_BIBLE.md):
> - Act I: you wake in the dark, then pull a power relay.
> - Act II: you look out of the observation window at the void storm, then pull the gate lever.
> - Act III/IV: you come back for the extraction tool from the armory rack, then use the studio terminal and the preset machines.
>
> **What the room holds now** (`apps/web/src/play/lab-room.ts`): one rectangular white room with the gate and the power chain (capacitor bank, breaker panel, relay cabinets, control boxes, console), the preset bench, combiner and rack, the planet table and the observation window.

## Findings

### F1. A great hub is a place with an identity that visibly changes as you progress
- **Hades** turns the hub into the story: characters react to your progress there, and caring about that world is the central loop ([critical study](https://criticalvideogamestudies.com/hades-death-and-the-players-experience/), [mechanics essay](https://mechanicsofmagic.com/?p=33031)).
- **Satisfactory:** every HUB upgrade changes the HUB's appearance, so the base visibly grows with the campaign ([wiki: Tier 0](https://satisfactory.wiki.gg/wiki/Tier_0)).
- **The Planet Crafter:** players praise watching the barren world turn into a living one, and that visual change *is* the progression ([review](https://mobygames.com/game/182136/planet-crafter), [PS5 review](https://www.thumbculture.co.uk/?p=90300)).
- **Destiny:** Bungie built its replacement hub (the Farm) to feel alive, with survivors and characters who come and go ([VideoGamer](https://www.videogamer.com/news/bungie-shows-off-new-destiny-2-hub-which-has-a-proper-football-pitch/)).
- Hub design guidance agrees: give the hub its own character, and make it reflect progress ([bugnet](https://bugnet.io/blog/how-to-design-a-hub-world-that-works), [hub-areas thesis](https://www.theseus.fi/handle/10024/798594)).

### F2. Players hate long walks through empty space
- Players resent maps enlarged to pad thin content, and slow backtracking through empty rooms ([itch.io dev admission](https://itch.io/post/10914893), [Path of Exile threads](https://www.pathofexile.com/forum/view-thread/3619763)).
- Returnal's hub works, but the trip from the ship grows painful as runs get longer ([PlayStation](https://playstation.com/en-gb/editorial/everything-you-need-to-know-about-returnal)).
- A recurring hub can also make the world feel smaller ([Giant Bomb](https://giantbomb.com/users/3378/articles/when-do-hubs-work)).

### F3. A landmark you can see from everywhere orients the player
- A central landmark keeps players oriented ([hub design notes](https://littlebath.itch.io/perception/devlog/353825/hub-area-design)).
- Prey's Talos I lobby is praised because you can see outside from almost every nook, and the areas connect horizontally and vertically ([Backloggd](https://backloggd.com/u/yumebitsu_/likes/), [Electron Dance](https://www.electrondance.com/?p=11927)).

### F4. Diegetic screens immerse, but only when used sparingly and kept legible
- Dead Space folded saves, loading and the inventory into the world, but keeps only about 3 or 4 pieces of information diegetic at a time. More becomes a cognitive burden ([hudsandguis](https://www.hudsandguis.com/home/2012/08/22/dead-space-2-diegetic-interface-design), [The Diegetic Dilemma](https://indieklem.substack.com/p/19-the-diegetic-dilemma-benefits)).
- Alien: Isolation's terminals give background and clues and can trigger things in the room; its tiny terminal text is a known legibility complaint ([Xbox](https://news.xbox.com/en-us/2014/09/24/games-8-awesome-retro-gadgets-in-alien-isolation/), [Engadget](https://www.engadget.com/2014-10-07-alien-isolation-launch-interview.html)).

### F5. Dense, purposeful clutter tells the story, and the tutorial can live in the room
- Half-Life: Alyx's Russell's lab reads as an eccentric physicist's workshop through its set dressing: the glove workshop in a converted bathroom, the "DO NOT EAT" headcrab in the fridge, the whiteboard. Its backyard junk pile doubles as the weapons tutorial ([Combine OverWiki](https://combineoverwiki.net/wiki/Russell's_Lab), [preview](https://www.highgroundgaming.com/half-life-alyx-preview/)).

## Proposals (owner decides)

| L | Proposal | From |
|---|---|---|
| L1 | **The gate is the landmark at the room's heart.** It stands on a raised plinth, visible from every corner, with its power cables in floor covers radiating to it. Every sightline in the room passes it. | F3 |
| L2 | **The observation window faces the gate across the room, and the storm outside is the progress meter.** As plots are restored, the void storm visibly thins, then breaks, then shows a first patch of sky. Inside, the lab gains things over time: lit sections, restored-plot samples on shelves, models on the planet table. The window is the reason to come back, and it is the story. | F1, canon ("restore universal fidelity before the collapse spreads back to Earth") |
| L3 | **Compact: one room, about 16 by 12 m, every station within about 8 m of the gate.** No corridors to walk. Each zone is lit and reads at a glance. | F2 |
| L4 | **Zones that teach by layout:** |  |
|  | - **The power wall (Act I):** capacitor bank, then breaker panel, then relay cabinets, then control boxes, then the console with the lever, left to right. The cables visibly run along the wall in trays to the gate, so power flow is learned by looking. | F5 |
|  | - **The studio corner:** the preset bench, combiner, rack, and the planet table showing your plots as a hologram. | F1 |
|  | - **The armory nook:** the armory rack (Act III's extraction tool) and the weapon bench from sheet 20, so weapon parts can also be forged at home. | F5 |
| L5 | **Diegetic, but limited to about 3 live screens:** the console (the power state), the planet table (the plots) and the studio terminal (the schema). The mentor speaks through the console's radio grille, with a small live waveform. The rest stays in the normal HUD, legible first. | F4 |
| L6 | **Set dressing that tells the collapse:** the scientist's desk with notes about reversing the bridge, a coffee mug, a cot (she has been living here), and readings taped to the window. Everything is grounded and nothing floats (the believable-machines rule). All of it is generated through the same chunky RUN.world-to-local-3D route, so it matches the base kit. | F5 |

**Next if approved:**
1. A layout plan with a top-down sketch, as a numbered list.
2. A concept sheet from the Arena art agent (rule: concept art comes from the art agent).
3. The set-dressing assets through the batch pipeline.
