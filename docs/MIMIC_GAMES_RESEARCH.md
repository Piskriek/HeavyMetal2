# FIDELITY // Mimic-Game Research: which games to run so the harness can fill out the LitRPG presets
> **Why this exists**: the owner, 28 Oct 2026: "we will need more presets tho ... i can load up the games we require to mimic some mechanics as presets to fill out the lit rpg mechanics, do some research and ill get them downloaded and running". And: a player spawns at the 3rd stage of fidelity and can gate to other densities "or build a ship ... if we have thruster parts".
> **Read with**: [Plan 51](argo/plans/51-harness-mechanic-mimicry.md) (the observation ladder), [Plan 53](argo/plans/53-bridge-stage.md) (published constants count as a source), [Plan 57](argo/plans/57-seeded-worlds.md) (seeded worlds, the drone as "the System"), [GAME_BRIDGE_PERMISSIONS_RESEARCH](GAME_BRIDGE_PERMISSIONS_RESEARCH.md), [ISEKAI_WORLDS_RESEARCH](ISEKAI_WORLDS_RESEARCH.md) §2, [BASE_BUILDING_RESEARCH](BASE_BUILDING_RESEARCH.md).
> **Status**: research only. Nothing was installed, run or copied. "F1" to "F10" below are the owner's ten mechanic families, in his order.

---

## 0. Ground rules for every game below

- **What crosses:** numbers, rules and timings only. No assets, names or code (Plan 51, Rule 18). Open-source games (GPL, MIT) are the cleanest "game files" rung: reading their source is the licence's purpose, and we still keep only the numbers.
- **Safest channel first:** a published constant (a wiki table, the D&D SRD, an open-source formula) needs no running game and no ban risk. Plan 53 already accepts CS2's `sv_gravity` on that basis.
- **Solo and offline only.** Where a game has online modes, they are off limits to the bridge (Plan 53 §2.5, warn first). No store page below mentions an anti-cheat, but a store page's silence is not proof.
- **Prices** are what Steam showed this PC's region (South African Rand, "R") on 28 Oct 2026. **Min-spec** is my reading of the listed minimums against the laptop (i7-6700HQ, GTX 950M, 16 GB), not a benchmark.
- **Preset kinds.** Existing: `loc`, `logic`, `anim`, `harness`, `kit`, `material`, `light`, `sound`. "Partial" means a package holds the data but no share-code kind exists (`@hm/rocket`, `@hm/orbital`, `@hm/questline`, `@hm/itemdefs`). Everything else is "new" and listed under "New preset kinds needed".

## 1. Game cards (terms, spec, price)

| Game | Terms and anti-cheat | Min-spec | Price / store | Src |
|---|---|---|---|---|
| RimWorld | Single player; Workshop; "Moddable"; no formal modding API, community-driven; wiki is CC BY-SA 3.0 | OK (Core 2 Duo, HD 4000) | R315 Steam | 1, 22 |
| Stardew Valley | Co-op exists (keep it off); SMAPI is open source | OK (2 GB) | R159 Steam | 2, 43 |
| Skyrim SE | Single player; "Moddable"; SKSE follows only the latest Steam build, so patches break it | OK (GTX 470) | R599 Steam | 7, 48 |
| Caves of Qud | Single player; Workshop; XML data mods, C# mods, Harmony "last resort" | OK (1 GHz, 4 GB) | R279.99 Steam | 8, 23 |
| Cataclysm: DDA | Free to use, modify, redistribute; content CC BY-SA 3.0 | OK (not tested) | Free, GitHub | 41 |
| Shattered Pixel Dungeon | GPL-3.0, Java | OK | Open source; store price not checked | 40 |
| OpenMW + Morrowind | OpenMW is GPLv3 and needs your own Morrowind | OK (Morrowind min is a Pentium III) | OpenMW free; Morrowind R219 Steam | 18, 46 |
| D&D 5e SRD | CC-BY-4.0 (v5.2.1, May 2025) | None needed | Free text | 45 |
| Kenshi | Single player; Workshop; no anti-cheat listed | OK (6 GB, DX11) | R175 Steam | 15 |
| Bannerlord | Store lists a Modding Kit and Workshop; keep to single player | Borderline (GTX 660) | R849 Steam | 14, 54 |
| Valheim | Iron Gate: no official mod support, own risk, mods should be free; BepInEx is LGPL-2.1 (Mono stable) | Borderline (GTX 950 min, the 950M is a step below) | R360 Steam | 4, 31, 32 |
| Factorio | "Ground-up modding support"; official Lua API | OK (GTX 750 Ti or UHD 730) | R300 Steam | 3, 26 |
| Minecraft Java | Data packs are documented JSON; EULA and price not checked | Not checked | Not checked | 27, 28 |
| Luanti | Code MIT, content CC BY-SA 3.0; Lua API | Not stated | Free (donations) | 44 |
| Mindustry | GPL-3.0 | OK (not tested) | itch, F-Droid, Flathub; Steam page not opened | 39 |
| Dwarf Fortress | Mods may replace or remove raw entries; Lua; Workshop | OK (dual core, 1 GB VRAM) | R279.99 Steam; Classic downloads from Bay12 | 10, 49 |
| Hades | No official modding API on the store page; community loaders | OK (dual core, 1 GB VRAM) | R230 Steam | 11 |
| Slay the Spire | Workshop; ModTheSpire is MIT | OK (2 GHz, 2 GB) | R62.25 (promo to 3 Nov, R249 normal) | 12, 53 |
| Pokemon Showdown | Server is MIT, runs locally; the names stay out | OK (Node) | Free | 29 |
| Palworld | Online co-op, dedicated servers | **No** (GTX 1660, 16 GB, SSD) | R270 Steam | 16 |
| Outer Wilds | Mods via an unofficial manager "not affiliated with Mobius" | Borderline (GTX 660) | R240 Steam | 13, 51 |
| Evoland Legendary | No mods or anti-cheat listed | OK (Core 2 Duo, GTS 260) | R229.99 Steam | 17 |
| Disco Elysium | No mods listed | OK (Core 2 Duo, 512 MB) | R344.99 Steam | 19 |
| KSP 1 | Single player; "Moddable"; Take-Two's mod terms not found | OK (Core 2 Duo, DX10) | R379.95 Steam | 5, 34 |
| Space Engineers | Official C# modding API and in-game Programmable Block; admins punish heavy scripts | Borderline (i5 3 GHz, GTX 750) | R329.99 Steam | 6, 35 |
| Stormworks | Lua microcontrollers; online PvP/co-op exists | OK (i5-4440, HD 6000) | R230 Steam | 9 |
| Orbiter | MIT, free; Windows, 32-bit app | OK (500 MB, dual core) | Free | 37 |
| Pioneer | GPLv3 | Not stated | Price not stated | 38 |
| FlightGear | Not opened (licence unverified) | Not checked | Not checked | 59 |

## F1. Stats and attributes, derived stats, level and XP curves

| Game | Mimic and preset kind | Channel |
|---|---|---|
| Skyrim SE | XP to next character level = 25 x (L+3); cumulative 12.5N^2 + 62.5N - 75; +10 to one of Health/Magicka/Stamina per level; one perk point per level. `curve:` and `stat:` (new) | UESP formulas, published constants [20] |
| RimWorld | Skills 0-20; XP to advance 1000 x (L+1) up to level 9, then 2000 x (L-4); soft cap 4,000 XP a day, 20% beyond it. `curve:` (new) | RimWorld wiki [21]; Defs XML |
| D&D 5e SRD | Ability scores, classes, character origins, game rules as text. `stat:`, `curve:` (new) | The licensed text [45], no install |
| OpenMW | Actor stats and a `SkillProgression` interface in its Lua API. `stat:` (new) | Lua scripting [47]; GPL source |
| Caves of Qud | Attributes and mutations as XML data. `stat:` (new) | `ObjectBlueprints/*.xml` [23] |

**Finding:** curve shapes differ (quadratic, a 1.95 power law, piecewise linear), so one `curve:` kind needs a shape field plus parameters, not one formula.

## F2. Skills: use-based vs point-buy, trees, classes, titles

| Game | Mimic and preset kind | Channel |
|---|---|---|
| Skyrim SE | Use-based. XP per use = Use Mult x base + offset; cost = Improve Mult x (L-1)^1.95 + offset; per-skill table (Lockpicking 45/10, Speech 0.36). `skillgrow:` (new) | UESP table [20] (UESP flags the skill formulas "need verification") |
| RimWorld | Passion multipliers 35% / 100% / 150%; decay from level 10 (30 XP a day, rising to 3,600 at 20). `skillgrow:` (new) | Wiki [21] |
| Kenshi | Use-based, hard stall near 100.7 (combat) and about 96 (civil); training needs matching enemies. `skillgrow:` (new) | Player reports only [57] |
| Valheim | Use-based 0-100 with a death penalty, from memory (wiki returned 401). `skillgrow:` (new) | BepInEx [31] |
| Factorio | Technology tree as data. `tree:` (new) | `--dump-data` [24] |
| D&D SRD, Caves of Qud | Point-buy, classes, feats; Qud skills and mutations via XML [23]. `class:` (new) | [45], [23] |
| Bannerlord | Skills and perks as module XML (not confirmed) | Community docs [54] |

**Titles:** I found no game with a documented title mechanic. RimWorld's Royalty titles and Dwarf Fortress nobles are candidates, unverified. A title is a `class:` bundle plus a Plan 57 closed cause.

## F3. Status windows, notices (the "System" voice), quest logs

No Steam game found ships the LitRPG System voice as a mechanic (search found only an early-access itch.io title). What is mimicable is **when** a notice fires and **how** a quest tracks knowledge.

| Game | Mimic and preset kind | Channel |
|---|---|---|
| Skyrim SE | Skill-up and level-up notices as thresholds; quest stages. `notice:` (new), `quest:` (partial) | UESP numbers [20]; SKSE events [48]; quest records via xEdit (unverified) |
| Outer Wilds | A ship log where facts, not tasks, are progress. `quest:` (partial) | New Horizons config defines a system's ship log [50]; OWML manager [51] |
| Disco Elysium | Skills speak as voices; active check reported as 2d6 + skill + modifiers vs difficulty, passives about 7 + skill. `notice:` | Fan analysis only [60]; low confidence |
| OpenMW | Morrowind journal and quest state. `quest:` | Lua API [47]; journal calls not confirmed |

**Finding:** `logic:` already carries the trigger (a threshold edge). The new part is the template: Plan 57 §4 says a window reads real state, so `notice:` binds a wording to an event and a field, never a number of its own.

## F4. Combat: melee timing, hit and damage formulas, status effects, cooldowns

| Game | Mimic and preset kind | Channel |
|---|---|---|
| Pokemon Showdown | `baseDamage = floor(floor(floor(floor(2*level/5+2) * power * attack) / defense) / 50)`, plus 2, then spread 0.75, weather, crit 1.5, random, STAB 1.5, type, burn 0.5. `dmg:` (new) and `matrix:` (new) | Open-source `sim/battle-actions.ts` [30] |
| Hades | Dash, swing and ability timings, boon effects, cooldowns. `anim:`, `logic:` (exist), `effect:` (new) | Lua scripts; Hades II's are plainly readable per one report [52]; no official API on Hades 1's store page [11] |
| Slay the Spire | Stacking buffs and debuffs (Strength, Vulnerable, Weak, from memory). `effect:` (new) | ModTheSpire loader, MIT [53] |
| Valheim, Bannerlord | Stamina-gated melee, directional swings, parry windows (unverified). `logic:` delay chain | Screen and audio rungs |

**Finding:** the harness already turns shot times into a burst graph (Plan 51). A melee swing is the same shape: windup, active, recovery delays. Only open-source or Lua games give formulas by file; the rest need the screen rung.

## F5. Crafting, recipes, gathering, loot tables, rarity

| Game | Mimic and preset kind | Channel |
|---|---|---|
| Factorio | Items, recipes and technologies. `recipe:` (new) | `factorio --dump-data` writes `data.raw` as JSON [24][25]. The cleanest official channel in this doc |
| Minecraft Java | Pools, rolls, `bonus_rolls`, weighted entries, `quality` (luck), conditions, functions. `loot:` (partial: `@hm/itemdefs` already rolls weights) | Data-pack JSON [28] |
| Cataclysm: DDA | Recipes, item groups, materials. `recipe:`, `loot:` | `recipes.json`, item JSON [42] |
| Caves of Qud | Items and creatures in XML; recipes have no XML interface yet [23] | `Items.xml` |
| Mindustry | Production chains; GPL source [39] | Source |

## F6. Companions, party, NPC affinity

| Game | Mimic and preset kind | Channel |
|---|---|---|
| Stardew Valley | Gift points: loved 80, liked 45, quality x1.1 / 1.25 / 1.5 (liked and loved only), birthday x8, Winter Star x5. `bond:` (new) | Wiki numbers seen in a search summary [56]; SMAPI [43] |
| RimWorld | Passion work gives mood +8 or +14 [21]; wider opinion and thought systems not read. `bond:` | Defs XML |
| Kenshi, Bannerlord | Squad recruiting, companions, clan (unverified) | Not confirmed |

**Finding:** `bond:` should be a per-pair meter with gift and event deltas and threshold edges that fire `logic:`. It must sit beside Plan 56's polarity dyads, not replace them.

## F7. Taming, monsters, creatures

| Game | Mimic and preset kind | Channel |
|---|---|---|
| Pokemon Showdown | Type effectiveness and the damage chain. `matrix:`, `dmg:`. The catch formula lives on Bulbapedia (403 for me, unverified) | Open source [29][30] |
| Cataclysm: DDA | Monster stat blocks, pets. `tame:` (new) | JSON [42] |
| RimWorld, Valheim | Animal taming and training by feeding or time (from memory) | Defs; BepInEx |
| Shattered Pixel Dungeon | Mobs, buffs, loot; read the Java source [40] | GPL source |
| Palworld | Capture loop. **Not min-spec and online**, so skip | n/a |

## F8. Ship and vehicle building from parts, and flying it

The owner's question (thruster parts, build a ship, reach other fidelity planets) is answerable. Thrust, mass, fuel and orbits are published physics. Mimicry adds proportions and handling feel. The repo already has `@hm/rocket` (`PartDef`: mass, fuel, thrust, burn) and `@hm/orbital` (surface 0-120 m, orbit above 420 m, approach ring 180 m, `SMX-PLN` destinations).

| Game | Mimic and preset kind | Channel |
|---|---|---|
| KSP 1 | Engine thrust, specific impulse, tank dry mass, delta-v, patched-conic orbits, maneuver nodes, docking. `ship:` (partial), `body:` (partial) | kRPC runs a server inside the game and exposes most of KSP's API [33]; part `.cfg` files (from memory, wiki blocked); Tsiolkovsky equation. KSP 2 is dead: studio shut in June 2024 [34] |
| Space Engineers | Grid mass against thruster force, hydrogen tanks, connectors, gyros | Official Programmable Block (C#) reads any block or grid state and writes thruster values [35]. The MDK toolkit is fan-made [36] |
| Stormworks | Vehicle logic in Lua microcontrollers [9] | Not opened; unverified |
| Orbiter | Newtonian solar-system flight, rendezvous | MIT source, free [37] |
| Pioneer | Space adventure; ships in `data/` | GPLv3 source [38] |
| FlightGear | Atmospheric flight and thrust through a property tree | Telnet and "generic protocol" streaming, from a search summary only [59] |

**Finding:** KSP gives the cleanest ship numbers, Space Engineers the most documented in-game API. Orbiter and Pioneer are free fallbacks. Avorion, From the Depths, Empyrion and Starfield were not looked up.

## F9. Base and settlement building with natives (light)

Piece catalogues and stability are in BASE_BUILDING_RESEARCH. The gap here is the settlers.

| Game | Mimic and preset kind | Channel |
|---|---|---|
| RimWorld | Colonist needs, mood, work priorities, a storyteller. `logic:`, `bond:` | Defs XML; Workshop mods [1][22] |
| Dwarf Fortress | Raws alterable by mods; Lua; Workshop [49] | Raw files |
| Mindustry | Resource flow and defence waves [39] | Source |
| Space Engineers | Airtight rooms and grids (already in BASE_BUILDING_RESEARCH); settler logic is absent | Programmable Block [35] |

## F10. Travel between worlds of different fidelity or rules

| Game | Mimic and preset kind | Channel |
|---|---|---|
| Minecraft Java | `dimension_type`: `coordinate_scale`, `has_skylight`, `ambient_light`, monster spawn light limits, `min_y`/`height`, plus attributes such as water evaporating and fast lava. `rules:` (new) | Data-pack JSON [27]. The schema changed in snapshots 25w42a and 25w45a, so pin the version |
| Evoland Legendary | Art and battle system change as you progress: monochrome to full 3D, active-time to real-time bosses [17]. The closest match to FIDELITY's stage ladder | Screen and audio only, no data |
| Outer Wilds + New Horizons | Declarative JSON planets and custom star systems [50]. `body:` (partial) | Config JSON |
| KSP 1 | Per-body gravity, atmosphere, radius | Wiki constants; wiki blocked, unverified |

**Finding:** no data-driven game ties a world's art to its rules. Minecraft covers the rules half, Evoland the look half.

## The shopping list (ranked; the "Families" column uses F1 to F10)

| # | Game | Families | Channel | Anti-cheat / terms risk | Min-spec | Price |
|---|---|---|---|---|---|---|
| 1 | RimWorld | 1, 2, 4, 5, 6, 7, 9 | Defs XML, wiki, Workshop mods | None listed; solo | OK | R315 |
| 2 | Cataclysm: DDA | 1, 2, 5, 7 | Open JSON data | None; free licence | OK | Free |
| 3 | Skyrim SE | 1, 2, 3, 5 | UESP constants, SKSE | None listed; solo; patches break SKSE | OK | R599 |
| 4 | Stardew Valley | 2, 5, 6 | SMAPI, wiki numbers | None listed; co-op off | OK | R159 |
| 5 | Factorio | 2, 5 | `--dump-data` JSON | None listed | OK | R300 |
| 6 | KSP 1 | 8, 10 | kRPC, part configs, physics | None listed; Take-Two mod terms unverified | OK | R379.95 |
| 7 | Minecraft Java | 5, 10 | Data-pack JSON | EULA and price unchecked | Not checked | Not checked |
| 8 | Pokemon Showdown | 4, 7 | Open-source simulator | None; MIT | OK | Free |
| 9 | Valheim | 2, 4, 7, 8, 9 | BepInEx, wiki | Own-risk mods; solo | Borderline | R360 |
| 10 | Space Engineers | 8, 9 | Official Programmable Block | None listed; solo | Borderline | R329.99 |
| 11 | Outer Wilds | 3, 10 | New Horizons JSON, OWML | Unofficial mods | Borderline | R240 |
| 12 | Evoland Legendary | 10 | Screen and audio only | None listed | OK | R229.99 |

**Free first, today:** read the D&D SRD and the UESP and RimWorld wikis; clone Pokemon Showdown; install Cataclysm: DDA. They need no purchase.
**Second wave:** Hades (F4, combat timings), OpenMW with Morrowind (R219), Slay the Spire (R62.25 until 3 Nov), Kenshi (R175), Orbiter and Pioneer (free ships), Shattered Pixel Dungeon and Mindustry (open source), Luanti (free Minecraft-like).

## New preset kinds needed

1. `stat:` attribute set and derived-stat formulas.
2. `curve:` level, XP and cost curve (shape plus parameters).
3. `skillgrow:` growth rule: use multipliers, passion, decay, soft caps, point-buy costs.
4. `tree:` skill, perk or tech tree with prerequisites and costs.
5. `class:` class, job, caste or title: stat shifts, starting skills, unlock conditions.
6. `notice:` System-voice template and status-window layout, bound to a real event and field.
7. `quest:` stages, conditions, rewards and knowledge logs (partial in `@hm/questline`).
8. `dmg:` hit and damage formula with an ordered modifier chain, including roll rules.
9. `effect:` buff or debuff: stacks, duration, tick, cooldown.
10. `matrix:` type or element effectiveness table.
11. `recipe:` inputs, outputs, station, time, tech gate.
12. `loot:` weighted table with rarity, luck-adjusted quality, conditions (partial in `@hm/itemdefs`).
13. `bond:` pair affinity meter: gift tastes, event deltas, threshold edges.
14. `tame:` capture or taming rule: bait, time, success formula, ownership.
15. `ship:` thrust, specific impulse, tank mass fractions, RCS torque, docking tolerance (partial in `@hm/rocket`).
16. `body:` celestial body: gravity, atmosphere, radius (partial in `@hm/orbital`).
17. `rules:` per-world rule set (light, spawn limits, scale, fluids) tied to a stage; not `@hm/worldrules`, which is about digging.

## Not verified

- Stardew's wiki returned 403: gift values come from a search summary, and 250 points per heart is from memory.
- The KSP wiki sat behind a bot wall: part `.cfg` contents and body constants are from memory. The kRPC page did not list telemetry fields. I found no Take-Two statement on mods.
- Search summaries only: FlightGear's protocol, Kenshi's caps, Disco Elysium's checks, Hades' "not officially endorsed" (a Nexus page).
- Valheim skills, taming and ships, RimWorld's Defs path and animal rules, and Skyrim's xEdit route are from memory.
- Not opened: Minecraft's price and EULA, Mindustry's Steam page, Stormworks' API, Palworld's modding, Bulbapedia's catch formula, any title mechanic, Avorion, From the Depths, Empyrion, Starfield.
- UESP itself marks Skyrim's skill XP formulas as needing verification.
- The 950M comparisons are from listed minimums, not benchmarks.

## Sources

Steam store pages (opened 28 Oct 2026, prices in ZAR):
1. [RimWorld](https://store.steampowered.com/app/294100/RimWorld/)
2. [Stardew Valley](https://store.steampowered.com/app/413150/Stardew_Valley/)
3. [Factorio](https://store.steampowered.com/app/427520/Factorio/)
4. [Valheim](https://store.steampowered.com/app/892970/Valheim/)
5. [Kerbal Space Program](https://store.steampowered.com/app/220200/Kerbal_Space_Program/)
6. [Space Engineers](https://store.steampowered.com/app/244850/Space_Engineers/)
7. [Skyrim Special Edition](https://store.steampowered.com/app/489830/The_Elder_Scrolls_V_Skyrim_Special_Edition/)
8. [Caves of Qud](https://store.steampowered.com/app/333640/Caves_of_Qud/)
9. [Stormworks](https://store.steampowered.com/app/573090/Stormworks_Build_and_Rescue/)
10. [Dwarf Fortress](https://store.steampowered.com/app/975370/Dwarf_Fortress/)
11. [Hades](https://store.steampowered.com/app/1145360/Hades/)
12. [Slay the Spire](https://store.steampowered.com/app/646570/Slay_the_Spire/)
13. [Outer Wilds](https://store.steampowered.com/app/753640/Outer_Wilds/)
14. [Mount & Blade II: Bannerlord](https://store.steampowered.com/app/261550/Mount__Blade_II_Bannerlord/)
15. [Kenshi](https://store.steampowered.com/app/233860/Kenshi/)
16. [Palworld](https://store.steampowered.com/app/1623730/Palworld/)
17. [Evoland Legendary Edition](https://store.steampowered.com/app/1020470/Evoland_Legendary_Edition/)
18. [Morrowind GOTY](https://store.steampowered.com/app/22320/The_Elder_Scrolls_III_Morrowind_Game_of_the_Year_Edition/)
19. [Disco Elysium: The Final Cut](https://store.steampowered.com/app/632470/Disco_Elysium__The_Final_Cut/)

Rules and data sources:
20. [UESP: Skyrim Leveling](https://en.uesp.net/wiki/Skyrim:Leveling)
21. [RimWorld wiki: Skills](https://rimworldwiki.com/wiki/Skills)
22. [RimWorld wiki: Modding Tutorials](https://rimworldwiki.com/wiki/Modding_Tutorials)
23. [Caves of Qud wiki: Modding Overview](https://wiki.cavesofqud.com/wiki/Modding:Overview)
24. [Factorio wiki: Command line parameters](https://wiki.factorio.com/Command_line_parameters)
25. [Factorio wiki: Data.raw](https://wiki.factorio.com/Data.raw)
26. [Factorio Lua API](https://lua-api.factorio.com/latest/)
27. [Minecraft wiki: Dimension type](https://minecraft.wiki/w/Dimension_type)
28. [Minecraft wiki: Loot table](https://minecraft.wiki/w/Loot_table)
29. [Pokemon Showdown repo](https://github.com/smogon/pokemon-showdown)
30. [Pokemon Showdown: sim/battle-actions.ts](https://raw.githubusercontent.com/smogon/pokemon-showdown/master/sim/battle-actions.ts)
31. [BepInEx](https://github.com/BepInEx/BepInEx)
32. [PCGamesN: Valheim dev on free mods](https://www.pcgamesn.com/valheim/free-mods)
33. [kRPC documentation](https://krpc.github.io/krpc/latest/)
34. [Wikipedia: Kerbal Space Program](https://en.wikipedia.org/wiki/Kerbal_Space_Program)
35. [Space Engineers wiki: Programmable Block](https://spaceengineers.wiki.gg/wiki/Programmable_Block)
36. [MDK-SE wiki (fan-made)](https://github.com/malware-dev/MDK-SE/wiki)
37. [Orbiter](https://github.com/orbitersim/orbiter)
38. [Pioneer](https://github.com/pioneerspacesim/pioneer)
39. [Mindustry](https://github.com/Anuken/Mindustry)
40. [Shattered Pixel Dungeon](https://github.com/00-Evan/shattered-pixel-dungeon)
41. [Cataclysm: DDA](https://github.com/CleverRaven/Cataclysm-DDA)
42. [Cataclysm: DDA JSON_INFO](https://raw.githubusercontent.com/CleverRaven/Cataclysm-DDA/master/doc/JSON/JSON_INFO.md)
43. [SMAPI](https://smapi.io/)
44. [Luanti](https://www.luanti.org/en/)
45. [D&D Systems Reference Document](https://www.dndbeyond.com/resources/1781-systems-reference-document-srd)
46. [OpenMW](https://github.com/OpenMW/openmw)
47. [OpenMW Lua scripting overview](https://openmw.readthedocs.io/en/latest/reference/lua-scripting/overview.html)
48. [SKSE](https://skse.silverlock.org/)
49. [Bay12 Games: Dwarf Fortress](https://www.bay12games.com/dwarves/)
50. [Outer Wilds New Horizons](https://nh.outerwildsmods.com/)
51. [Outer Wilds Mods](https://outerwildsmods.com/)
52. [Gameblog: Hades II source access](https://www.gameblog.fr/jeu-video/ed/news/hades-2-acces-complet-code-source-jeu-568087)
53. [ModTheSpire](https://github.com/kiooeht/ModTheSpire)
54. [Bannerlord community docs](https://docs.bannerlordmodding.lt/)
55. Project docs: Plans 51, 53 and 57, GAME_BRIDGE_PERMISSIONS_RESEARCH, ISEKAI_WORLDS_RESEARCH, BASE_BUILDING_RESEARCH.

Search results only (pages not opened):
56. Stardew gift values: stardewvalleywiki.com/Gifts, via web search.
57. Kenshi skill caps: Steam community threads for app 233860, via web search.
58. Hades modding stance: a Nexus Mods Hades loader page, via web search.
59. FlightGear Generic Protocol: wiki.flightgear.org/Generic_Protocol, via web search.
60. Disco Elysium checks: Steam community and guide sites, via web search.
