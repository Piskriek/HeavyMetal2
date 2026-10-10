# Vehicle and weapon fabricators: research (2026-10-10)

> The owner's words (CLAUDE.md §6.5): "Vehicles and weapons are researched and built in-game via fabricator benches. In The Workshop, players can skin their rovers with imported vehicle meshes from their favorite games."
>
> This doc follows the research-first SOP (CLAUDE.md drift guard 4). The findings are below, with sources. Every R is a **proposal for the owner** wherever it goes beyond those words. Nothing is built from it yet.

## Findings

### F1. Vehicles come from a dedicated station, unlocked by progress
- **Subnautica: Below Zero.** You scan three fragments to unlock the Mobile Vehicle Bay, and craft the bay at the Fabricator. Every vehicle (Seamoth, Prawn suit, Seatruck modules) is then made at the bay, except the Snowfox, which has its own station [1].
- **Dune: Awakening.** A Vehicle Fabricator has to be built in your base before any buggy, and it costs 40 steel ingots and 30 complex machinery. Bigger craft (ornithopter, sandcrawler) sit behind the research tree and large inputs [3][4].
- **Astroneer.** Printers come in size tiers, and the largest replaced the old Vehicle Bay. A research catalog sorted by size sells schematics for Bytes. Big items print slowly [5][6].

### F2. Modular vehicle builders: what players praise and what they hate
- **Starfield's ship builder is praised:**
  - huge part variety;
  - snapping that is "quick and satisfying" because parts attach only at certain sockets: enough to customise anything, few enough that you never fiddle;
  - real stat trade-offs, such as engines against generator.
- **Starfield's ship builder is hated** [7]:
  - "invalid build" errors that don't say what is wrong;
  - the ship resetting on every edit, with fitted gear lost;
  - pieces that look connected but aren't;
  - part variants hidden behind arrow keys.
- **Trailmakers** shares blueprints as images, with the vehicle data inside the picture, plus a workshop. Players praise the sandbox and complain about blocks locked behind DLC [9].

### F3. Blueprint projection is powerful, but welding it is a chore
- **Space Engineers:** a projector shows a blueprint as ghost blocks, and you weld it in survival [8].
- **The pains** [8]:
  - one grid at a time, so rovers with rotors need split blueprints;
  - a projection can't start in mid-air without temporary support blocks;
  - non-structural blocks are "near impossible to weld".

### F4. Weapon modding works when it keeps a favourite gun alive
- **Fallout 4's workbench is praised** [10]:
  - you can rebuild a weapon from grip, barrel, sights, receiver, magazine and stock, each with its own stat changes;
  - the receiver sets damage and fire mode;
  - a weapon you like "can stay viable for dozens of hours".
- **Fallout 4's workbench is criticised:**
  - even simple swaps need the bench;
  - a thin base roster dressed up with variety;
  - odd universal components (adhesive everywhere).

### F5. Gating has to keep vehicles meaningful
- **Dune players ask for higher vehicle costs.** One thread says one testing station's loot builds two sandbikes, with leftovers [2]. That's one player's view.
- **Astroneer's catalog** makes unlocking a visible choice, but its printer renames confuse players and guides [5].

### F6. User-made vehicle skins need a moderation line
- **LEGO 2K Drive** moderates player vehicles before they appear in your hub, and shares them by code [12].
- **War Thunder** keeps validated Workshop skins apart from local custom files [11].
- **Twisted Metal's** open skin uploads raised the question of filtering at launch [11].
- None of these import another game's 3D meshes into a shared world. Meshes from "favorite games" are other studios' copyrighted assets.

## Proposals (owner decides)

| R | Proposal | Why |
|---|---|---|
| R1 | **A Vehicle Fabricator and a Weapon Bench are heavy stations.** They are built on the base lattice like the Drafting Table, cost primitives and maps, and pull from linked storage. Vehicles print slowly, at a power share, like refining. | F1: every genre lead uses a dedicated station. Our linked storage removes the material shuttling. |
| R2 | **A rover is a chassis plus module sockets** (wheels, drill, linked cargo bin, sensor mast, beam turret), snapped to fixed sockets on our lattice. It always says what's wrong in words, and an edit never loses a fitted module (it is refunded to linked storage). | F2: keep Starfield's snapping and variety, fix its three hated faults. |
| R3 | **Vehicles are built from a plan, like layouts.** The fabricator takes a vehicle blueprint, shows its ghost, and finishes it in one piece once paid. No welding, no temporary supports, no half vehicles. | F3: our `plan`/`fill` already solves Space Engineers' pains. |
| R4 | **A weapon is a frame plus four part slots** (core, barrel, sight, cell). Parts are crafted from primitives and texture maps: the four floats, with vertices as shape and pixels as finish. Swapping parts works in the field from the pack; the bench only makes new parts. | F4: Fallout's keep-your-favourite loop, without its bench-only swaps. |
| R5 | **The world's fidelity gates technology.** A tier unlocks as the plot's stage rises: a stage 2 rover, stage 4 heavier craft, stage 6 the best parts. The resolution wave is the research tree. | F5, and canon: "Terraforming IS graphical fidelity". It keeps vehicles earned, with no new currency (the four floats only). |
| R6 | **Imported meshes are local, cosmetic-only skins.** The Workshop imports a glTF, fits it to the rover's fixed hitbox and keeps it on this machine. It is never sent to the Synced world or the Nexus. Shared skins come only from our kit and paint presets. | F6: the owner's "skins from their favorite games" fits as a personal skin. Sharing other games' assets is a copyright and moderation risk. |
| R7 | **The mobile outpost (D16) is a rover chassis with a linked bin and a structure socket.** | It joins D16 to R2 with no new system. |

## Sources
1. [Subnautica: Below Zero, Mobile Vehicle Bay tips](https://data.mbrp.com/?p=643); [fragment locations (GameRevolution)](https://www.gamerevolution.com/?p=682419)
2. [Dune: Awakening Steam discussion, crafting costs](https://steamcommunity.com/app/1172710/discussions/0/813573650210896608)
3. [How to get a vehicle in Dune: Awakening](https://deltiasgaming.com/?p=252665); [buggy materials](https://thegamepost.com/how-to-get-buggy-in-dune-awakening/)
4. [Ornithopter crafting guide (KeenGamer)](https://www.keengamer.com/articles/guides/dune-awakening-how-to-get-ornithopter-fast-crafting-guide/); [sandcrawler](https://deltiasgaming.com/?p=274452)
5. [Astroneer wiki: Vehicle Bay](https://astroneer.wiki.gg/wiki/Vehicle_Bay); [Large Printer](https://astroneer.wiki.gg/wiki/Large_Printer); [Steam discussion on printers](https://steamcommunity.com/app/361420/discussions/0/1694914736008681751)
6. [Astroneer wiki: Modules](https://astroneer.wiki.gg/wiki/Modules); [Crafting](https://astroneer.gamepedia.com/Crafting)
7. [Starfield ship builder (TheGamer)](https://www.thegamer.com/starfield-ship-builder/); [Steam discussion](https://steamcommunity.com/app/1716740/discussions/0/3942399078926042762); [PC Gamer: ship sharing](https://pcgamer.com/starfield-needs-a-spaceship-sharing-feature-stat); [review](https://comiccrusaders.com/reviews/pc-game-review-starfield/)
8. [Space Engineers wiki: Projector](https://spaceengineers.wiki.gg/wiki/Projector); [Blueprint](https://spaceengineers.wiki.gg/wiki/Blueprint); [Steam discussion](https://steamcommunity.com/app/244850/discussions/0/1693788384138434877)
9. [Trailmakers wiki: Blueprints](https://trailmakers.wiki.gg/wiki/Blueprints); [review summary](https://vaporlens.app/app/585420/trailmakers.md)
10. [Fallout 4 on IMFDB](https://imfdb.org/wiki/Fallout_4); [Nexus mod author's view](https://www.nexusmods.com/fallout4/mods/59946); [Steam discussion](https://steamcommunity.com/app/377160/discussions/0/614286608894526479)
11. [Twisted Metal user skins (MP1st)](https://mp1st.com/news/twisted-metal-will-support-user-generated-skins); War Thunder skin install guide (the search result was a low-quality page, so it is not linked)
12. [LEGO 2K Drive Creators Hub](https://lego.2k.com/drive/creators-hub/)
