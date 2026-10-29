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

## Free and low-cost alternatives (verified 28 Oct)

Checked against pages I opened on 28 Oct 2026 (sources 61 to 102). Prices are Steam ZAR on this PC. "Fit" is my reading of the listed minimums against the laptop (i7-6700HQ, GTX 950M 2 GB, 16 GB), not a benchmark. No page below mentions an anti-cheat; as in section 0, silence is not proof. Everything here plays solo and offline. Only numbers and rules cross, never assets, names or code.

| Game | Licence, cost, official source | Fit and solo | Families | Best channel |
|---|---|---|---|---|
| D&D 5e SRD 5.1 | CC-BY-4.0, "free of charge", attribution line required [61]; wizards.com SRD page [45] | No install | F1 F2 F4 | Text: XP table (300, 900, 2,700, 6,500 and on), class tables, Conditions appendix [61] |
| Battle for Wesnoth | Code GPL-2.0+; Free on Steam, also itch and wesnoth.org [62][63] | Steam min: 2 GHz dual-core, 2 GB; solo campaigns [63] | F1 F4 | Plain WML `.cfg` units: Bowman has hitpoints 33, experience 35, cost 14, level 1 [64][65] |
| Dungeon Crawl Stone Soup | GPLv2+; free Windows builds at crawl.develz.org [66][67] | No spec listed; offline builds | F1 F2 F4 | Source `skills.cc`: cost table, use-based `exercise()`, species aptitudes [68]; species and jobs as YAML [69] |
| Daggerfall Unity | Code MIT. Needs DOS Daggerfall, Free To Play on Steam, (c) Bethesda [70][71][72] | Min i3 Skylake, DX11 1 GB, 2 GB RAM [70] | F1 F2 F4 | `FormulaHelper.cs`: `CalculateAttackDamage`, `CalculateSuccessfulHit`, `CalculateSkillUsesForAdvancement` [71] |
| Dwarf Fortress Classic | Bay 12 press release: classic stays "at no cost" on its site [74]; the download page lists a Classic 53.16 Windows zip [49] | Classic spec not found; Premium min is dual-core 2.4 GHz, 4 GB [10] | F5 F9 | Raw files (see F9) |
| Mindustry | Code GPL-3.0 [39]; Steam R79 [75]; itch "name your own price", $0 not confirmed [76] | Steam min: 1 GB RAM, OpenGL 2.0; solo campaign [75] | F4 F5 F9 F10 | Java: `Blocks`, `Items`, `UnitTypes`, `StatusEffects`, `Planets`, two tech trees [77] |
| OpenTTD | GPL-2.0; free OpenGFX and OpenSFX replace the original files; openttd.org, Steam, GOG [81] | No spec listed | F5 F9 | Source tables `cargo_const.h`, `build_industry.h` [81] |
| Endless Sky | Code GPL-3, art public domain or CC; "free, open source"; GitHub, Steam, GOG [82] | OpenGL 2.0, 750 MB RAM [82] | F8 | Text data. X2700 Ion Thruster: `"mass"` 27, `"thrust"` 24.075, `"thrusting energy"` 1.1 [83] |
| Naev | GPL-3+ with exceptions [85]; Free on Steam, also itch [84] | OpenGL 3.3; 512 MB (Steam) or 2 GiB (Codeberg) [84][85] | F3 F8 | `dat/ships` XML, `dat/outfits`, Lua missions [85] |
| Orbiter | MIT, free; "Orbiter 2024" is the latest GitHub release [37][86] | Windows only, 32-bit; 500 MB, dual-core [37] | F8 F10 | MIT source, orbital flight |
| Pioneer | GPLv3, free download; Windows installer 543 MB, build 20260907 [38][88] | Spec not found | F8 | `data/ships`, `data/systems`, `data/economy` [38] |
| Luanti | Code MIT, content CC BY-SA 3.0; no price stated, donation link [44][89] | Windows 8 to 11, no hardware spec; single-player [44][89] | F5 F10 | Lua API for games and mods [44] |
| Veloren | GPL-3.0+ [90]; no price stated | Win10/11 64-bit, 4 GiB, DX12 or Vulkan GPU [91]; solo starts a local server [92]; 950M load untested | F2 F5 F7 | `.ron` folders `skill_trees`, `loot_tables`, `crafting`, `items` [93]. Taming is named on its site only |
| Unciv | MPL-2.0 code; itch says "free forever"; not on Steam [94][95] | No spec listed | F2 F9 F10 | JSON: `Techs`, `Buildings`, `UnitPromotions`, `Eras`, `Terrains`, `Quests` [94] |
| Flare RPG | Engine GPLv3, default mod GPLv3 and CC-BY-SA 3.0; v1.15 Windows installer 608 MB [96][97] | No spec listed | F2 F3 F4 F5 | INI-style text; mod folders `powers`, `items`, `loot`, `quests` [98] |
| Shattered Pixel Dungeon | GPL-3.0 [100]. The PC build is free: Windows 4.0.2 (103 MB) on itch, "name your own price", paid adds cosmetics [99]. Steam R100 [100] | Win10 64-bit, OpenGL 2.0, 250 MB [100] | F4 F5 F7 | Java source [40] |
| Factorio demo | A free demo is still offered (2.1.23), "a subset" of the full game [101]; Steam lists "Factorio Demo" [3] | As the Factorio card | F5 | Whether `--dump-data` works on the demo: unverified |

Also checked. OpenMW is GPLv3 and still needs Morrowind (R219, card table above). shapez costs R100 on Steam (R10 until 1 Nov, plus a demo [78]); its open repo is unmaintained and the Community Edition must be built from source [79][80]. It adds only F5, so skip it.

### The no-money plan

| Family | Free picks | What they give |
|---|---|---|
| F1 Stats, XP | D&D SRD 5.1, Wesnoth | XP and proficiency steps [61]; unit XP, level and cost fields [64]. UESP formulas are free too (doc [20]) |
| F2 Skills, classes | DCSS, SRD, Veloren | Use-based training with aptitudes [68]; classes [61]; skill trees as data [93] |
| F3 Status, notices, quests | Flare, Cataclysm: DDA | Quest and dialogue text [98]; talk topics and missions [102]. Thin: no free game has the System voice, and notice timing comes from UESP (doc [20]) |
| F4 Combat | Wesnoth, Daggerfall Unity, SRD Conditions | Damage and resistance fields; hit and damage functions [71]; conditions [61]. Pokemon Showdown is already free (doc [30]) |
| F5 Crafting, loot | Veloren, Cataclysm: DDA | `crafting` and `loot_tables` [93]; recipes and item groups (doc [42]) |
| F6 Companions | Cataclysm: DDA NPCs | Followers; opinion fields `trust`, `fear`, `value`, `anger`, `owed`, `favors` [102]. No free gift-point numbers |
| F7 Taming, creatures | Cataclysm: DDA, Pokemon Showdown | Monster blocks and pets (doc [42]); type chart (doc [30]). Veloren data unread |
| F8 Ships, flight | Endless Sky, then Naev; Orbiter for orbits | Mass, thrust and energy per part [83]; ship XML [85]; MIT source [37] |
| F9 Base, settlement | Mindustry, OpenTTD, Unciv | Resource flow and waves [39]; industries [81]; buildings JSON [94]. Settler needs: DF Classic raws |
| F10 Worlds with other rules or looks | Luanti, Mindustry | Per-game rules via Lua [44]; two planets with separate tech trees [77]. No free source for the art-style half |

Cost: R0 (Mindustry from itch or GitHub builds; Steam R79 is the sure price).

### If buying one or two

- **Stardew Valley, R159.** The cheapest fix for F6: gift points and birthday multipliers (doc [56]), plus F2 and F5. Free F6 is only the DDA opinion meter.
- **RimWorld, R315.** Covers F6 mood, F7 taming and F9 colonist needs in one purchase, plus F1, F2 and F5; it is already shopping-list #1. If only one purchase, this is it; Stardew first if the budget is under R200. Both together: R474.
- **Later, only if a gap shows.** Slay the Spire (R62.25 until 3 Nov, then R249) for stacking effects in F4 (doc entry is from memory); Evoland Legendary (R229.99) for the F10 look half; Morrowind (R219) for OpenMW's journal in F3.
- **Not needed first.** KSP 1 (R379.95), Skyrim SE (R599), Valheim (R360), Factorio (R300): the free ships, UESP and Veloren plus DDA already cover F8, Skyrim's F1 and F2, and F5.

### Unverified in this pass

- Orbiter 2016's official site did not resolve; Wikipedia confirms the 2016 release [87], but I saw only third-party download listings. Use Orbiter 2024 from GitHub.
- wesnoth.org and the Pioneer wiki sit behind a bot wall; Endless Sky's Steam page returned a region error. I used GitHub and Steam pages instead.
- No hardware spec found: DF Classic, DCSS, OpenTTD, Pioneer, Luanti, Unciv, Flare. DF Classic's "free" rests on the 2022 press release.
- No price stated: Luanti, Veloren. Mindustry's itch page does not say $0 is accepted.
- Daggerfall: no written terms for the original data. Only Bethesda's 2009 free release [73] and the Steam page [72] are evidence.

## The owner's Steam library (28 Oct)

The owner owns these on Steam and is downloading them. Only licensed copies are used. Unofficial downloads were left out, so no preset traces back to an unlicensed copy.

The Steam store pages were opened on 28 Oct for two facts:
- Enshrouded's minimum GPU is a GTX 1060 with 6 GB, beyond the GTX 950M;
- Rocket League's page lists no anti-cheat.

The data channels are from Opus's knowledge and are checked on install.

| Game | Families | Channel (check on install) | Notes |
|---|---|---|---|
| Kerbal Space Program | F8, F10 | part configs as text (`GameData/Squad/Parts/*.cfg`), kRPC | Ships from parts; each body has its own gravity and atmosphere, so each world runs different rules |
| Space Engineers | F8, F9 | block definitions (`Content/Data/*.sbc` XML), the in-game Programmable Block | Thrust, mass, gyros, power; borderline on the 950M |
| Dwarf Fortress | F1, F2, F6, F7, F9 and the pre-play history (Plan 57 §5) | raw text files (`data/vanilla/...`), DFHack | Use-based skills, relationships, taming, settlement, world history |
| Hades | F2, F3, F4, F5 (rarity), F6 | plain Lua scripts (`Content/Scripts`) | Weapon timings, boons and their rarities, affinity with characters, the prophecy list as a quest log |
| Satisfactory | F5, F9 | the game's own Docs.json (`CommunityResources/Docs`) | Recipes and throughput; only the data file is needed, which matters because the game is heavy for the 950M |
| Transport Fever 2 | F9, F5 | Lua configs and mods (`res/`) | Logistics, vehicles, economy |
| Plasma | F8, logic | visual-scripting machines | Machines built from parts with logic: wiregraph and `logic:` presets |
| Portal | logic, F10 | Source engine console constants | Physics puzzles, button and door logic |
| Rocket League | F8 (vehicle feel) | published physics constants; observe in offline Free Play or Exhibition only | Online-first: never touch an online match. Anti-cheat rule: the player is told first, offline modes only |
| Enshrouded | F2, F5, F9 | its wiki's numbers | **Will not run on the 950M** (minimum GTX 1060 6 GB). Skip the 28.9 GB download, or run it only on the 3D PC |

With the free picks above (the SRD 5.1, Cataclysm: DDA, Pokémon Showdown), this covers F1 to F10. The one thin family is F3, the "System" notices and quest logs. The SRD's text, DDA's missions and Hades' prophecy list cover it, and nothing more needs buying for it.

## Installed and checked (29 Oct)

The owner's downloads finished on D: (`D:SteamLibrarysteamappscommon`). Each folder was checked read-only for its data channel and for anti-cheat components on disk. A store page's silence is not proof, and neither is a folder's; Valve's VAC, for one, lives on the server.

| Game | Data channel on disk | Anti-cheat found | How we use it |
|---|---|---|---|
| Hades | `Content/Scripts` (plain Lua, 98 files) | none | read the numbers: boon rarities, affinity, weapon timings, the prophecy list (F2 to F6) |
| Dwarf Fortress | `data/vanilla` raws (plain text, 361 files) | none | skills by use, attributes, relationships, taming, settlement (F1, F2, F6, F7, F9) |
| Satisfactory | `CommunityResources/Docs` (the game's own JSON) | none | recipes and throughput (F5, F9); no need to run it on the 950M |
| Kerbal Space Program | `GameData/Squad/Parts` (.cfg text, 1,383 files) | none | ship parts: mass, thrust, fuel, and each world's own gravity (F8, F10) |
| Space Engineers | `Content/Data` (.sbc XML, 1,294 files) | none listed (it has online play: solo only) | blocks, thrusters, gyros and power (F8, F9) |
| Transport Fever 2 | `res/` (Lua configs, 830 files) | none | logistics, vehicles, economy (F9, F5) |
| Plasma | the game itself (visual-scripting machines) | none | a live session through the read-only mirror: machines from parts with logic, and its UI as `ui:` panels (§15) |
| Portal | Source engine files and console constants | none | physics puzzles, buttons and doors (logic) |
| Starbound | `assets/packed.pak` (its JSON, packed) | none | unpack with the game's own asset tool, then read the numbers (F5, F7, F10) |
| Valheim | Unity code assemblies (`valheim_Data/Managed`) | none on disk (online play exists: solo only) | the wiki's numbers only; game code is not decompiled |
| Rugby 22 | `Data` (format unknown) | none on disk | observe offline through the mirror; published numbers |
| Counter-Strike 2 | packed VPKs; `cfg` text | **VAC** (server side; nothing on disk) | published console constants only (Plan 53's `sv_gravity`), offline with bots; never an online match; no input |
| Rocket League | packed | **EasyAntiCheat** (`Binaries/Win64/EasyAntiCheat`) | published physics constants, and the read-only mirror in offline Free Play; **no input relay, ever** |
| Enshrouded | **the folder is empty**: the download did not land | n/a | skip: its minimum is a GTX 1060 6 GB, beyond the 950M |

- **The anti-cheat rule holds:** the owner is told first, about Rocket League's EasyAntiCheat and Counter-Strike's VAC (29 Oct). Neither gets input from the bridge; only published numbers and the read-only mirror in offline modes.
- **Order, safest channel first:** the plain-text data channels need no running game and no owner time (Hades, Dwarf Fortress, Satisfactory, KSP, Space Engineers, Transport Fever 2). The live sessions (Plasma, Portal, Rugby 22, Rocket League's Free Play) need the owner at the keyboard with the mirror on.

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

Free and low-cost alternatives (opened 28 Oct 2026; Steam prices in ZAR):
61. [D&D SRD 5.1 PDF (CC-BY-4.0 text, XP table, Conditions)](https://media.wizards.com/2023/downloads/dnd/SRD_CC_v5.1.pdf)
62. [Battle for Wesnoth repo](https://github.com/wesnoth/wesnoth)
63. [Battle for Wesnoth on Steam](https://store.steampowered.com/app/599390/Battle_for_Wesnoth/)
64. [Wesnoth unit file: Loyalist_Bowman.cfg](https://raw.githubusercontent.com/wesnoth/wesnoth/master/data/core/units/humans/Loyalist_Bowman.cfg)
65. [Wesnoth wiki: ReferenceWML](https://wiki.wesnoth.org/ReferenceWML)
66. [Dungeon Crawl Stone Soup repo](https://github.com/crawl/crawl)
67. [DCSS downloads](https://crawl.develz.org/download.htm)
68. [DCSS skills.cc](https://raw.githubusercontent.com/crawl/crawl/master/crawl-ref/source/skills.cc)
69. [DCSS species data folder](https://github.com/crawl/crawl/tree/master/crawl-ref/source/dat/species)
70. [Daggerfall Workshop (Daggerfall Unity)](https://www.dfworkshop.net/)
71. [Daggerfall Unity repo (MIT; FormulaHelper.cs in Assets/Scripts/Game/Formulas)](https://github.com/Interkarma/daggerfall-unity)
72. [The Elder Scrolls II: Daggerfall on Steam](https://store.steampowered.com/app/1812390/The_Elder_Scrolls_II_Daggerfall/)
73. [UESP: Daggerfall for Free (2009)](https://en.uesp.net/wiki/UESPWiki:News/Daggerfall_for_Free)
74. [Dwarf Fortress press release (Classic stays free)](https://gamespress.com/THE-LEGENDARY-DWARF-FORTRESS-GETS-A-WHOLE-NEW-LOOK-ON-DECEMBER-6)
75. [Mindustry on Steam](https://store.steampowered.com/app/1127400/Mindustry/)
76. [Mindustry on itch](https://anuke.itch.io/mindustry)
77. [Mindustry content folder](https://github.com/Anuken/Mindustry/tree/master/core/src/mindustry/content)
78. [shapez on Steam](https://store.steampowered.com/app/1318690/shapez/)
79. [shapez.io repo (unmaintained)](https://github.com/tobspr-games/shapez.io)
80. [shapez Community Edition](https://github.com/tobspr-games/shapez-community-edition)
81. [OpenTTD repo](https://github.com/OpenTTD/OpenTTD)
82. [Endless Sky repo](https://github.com/endless-sky/endless-sky)
83. [Endless Sky engines.txt](https://raw.githubusercontent.com/endless-sky/endless-sky/master/data/human/engines.txt)
84. [Naev on Steam](https://store.steampowered.com/app/598530/Naev/)
85. [Naev on Codeberg](https://codeberg.org/naev/naev)
86. [Orbiter releases (Orbiter 2024)](https://github.com/orbitersim/orbiter/releases)
87. [Wikipedia: Orbiter (simulator)](https://en.wikipedia.org/wiki/Orbiter_(simulator))
88. [Pioneer download page](https://pioneerspacesim.net/page/download/)
89. [Luanti downloads](https://www.luanti.org/en/downloads/)
90. [Veloren repo (GitLab)](https://gitlab.com/veloren/veloren)
91. [Veloren download page](https://veloren.net/download/)
92. [Veloren book: hosting a server (singleplayer)](https://book.veloren.net/players/server-hosting/introduction.html)
93. [Veloren assets/common](https://github.com/veloren/veloren/tree/master/assets/common)
94. [Unciv repo (jsons folder)](https://github.com/yairm210/Unciv)
95. [Unciv on itch](https://yairm210.itch.io/unciv)
96. [Flare engine repo](https://github.com/flareteam/flare-engine)
97. [Flare download page](https://flarerpg.org/download.html)
98. [Flare game data (Empyrean Campaign mod)](https://github.com/flareteam/flare-game/tree/master/mods/empyrean_campaign)
99. [Shattered Pixel Dungeon on itch](https://shattered-pixel.itch.io/shattered-pixel-dungeon)
100. [Shattered Pixel Dungeon on Steam](https://store.steampowered.com/app/1769170/Shattered_Pixel_Dungeon/)
101. [Factorio download page (free demo)](https://factorio.com/download)
102. [Cataclysm: DDA NPCs.md](https://raw.githubusercontent.com/CleverRaven/Cataclysm-DDA/master/doc/JSON/NPCs.md)
