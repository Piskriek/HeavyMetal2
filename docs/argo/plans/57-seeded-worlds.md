# Plan 57: Seeded worlds — natives, a drone guide, and a Stargate to build

> Owner, 28 Oct 2026 (full words in [OWNER_ASKS](../../OWNER_ASKS.md)): park the FIDELITY storyline; seed a few worlds in a solar system and drop the player in with the natives, with the drone at their side, "like an anime isekai type lit rpg game when you try and get a stargate built so you can explore the universe while you meet the local ai characters". "We will see what the seeds produce." Multiplayer becomes a sandbox for creating and bridging games with the drone assistant. The Studio stays for professional preset editing. The menu gets lighter: a "holo deck"-like room with the presets warming up. Gaussian-splat realism is a someday tier. Planets are presets too, and telepathic natives form a social memory complex.
>
> Status: **planned, not built.** This plan supersedes the story frame of CLAUDE.md §2 for new work. The constitution (§1) stands unless the owner says otherwise.

## 0. The examples and their categories (standing rule)

| Owner's example | The category we plan for |
|---|---|
| a "holo deck" like room | a cheap menu hub: a static, low-draw-call room that renders only when something changes |
| presets warming up | preloading and compiling every preset kind (shaders, materials, kits, sounds, voices) behind a visible bar |
| a few worlds in a solar system | procedurally seeded star systems: a sun, worlds, moons, each a preset from one seed |
| the natives, the local AI characters | inhabitant AIs and their societies: organic, mechanical and hybrid characters (Plan 56 §19, LINEAGE_RESEARCH) |
| anime isekai LitRPG | the genre's conventions: arriving in another world, "the System" voice, status windows, levels, skills, titles, quests |
| a drone by his side | a companion guide who is also the System's voice (the drone, Plans 50–56) |
| get a Stargate built | a long multi-world build goal that unlocks travel (Plan 42's gates) |
| multiplayer sandbox, bridge games | co-creation multiplayer: make, share and bridge games (Plans 45, 46, 53) |
| the Studio | professional preset editing, unchanged (Plans 38–45) |
| Google's splat world model | learned and generative rendering as a far fidelity tier |
| planets | every celestial body as a preset: planets, moons, the sun |
| telepathic natives | group minds: characters pooling into a social memory complex |

## 1. What is parked, and what stays

- **Parked:** the story frame (the Collapse and the Bridge, the shielded lab, the Moon portal, the Acts I–IV narrator). The code stays; nothing is deleted. The lab and Moon remain playable as they are until the new start replaces them.
- **Stays, as the foundation:** the preset ladder (Rungs 1–5), the four floats, the stages' looks, the Studio, the drone and its distortion ladder (Plan 56), the bridge and its anti-cheat rules (Plan 53), legal art only, the min-spec laptop, one file plus the HD pack.
- **Changes meaning:** the Stargate is no longer how you reach the Moon. It becomes the goal: the thing a world's people build so they can leave it.

## 2. Planets are presets (owner; Argon's architectural note, 28 Oct)

The owner: a planet is "a very dense soul and it moves through the densities just like the other presets but they are on another level than us." Ra agrees in his terms:
- a planet carries the social memory complex of its people when it is "born" into fourth density (65.17);
- a planet's social memory complex decides its harvest (11.3, on Maldek).

**The three tiers** (Argon): native ↔ social memory complex ↔ planet.
- **The planet** is a Rung 5 preset. It is an `IInceptionNode` (Plan 46's runtime node: vessel, state vector, escrow buffer, graduation contract) at the top depth of its world, carrying a Plan 56 `Mem` record (`of = planet:<seed>`) and a preset body.
- **Its body** (a third body kind beside organic and mechanical in `BODY_ZONES`), by Argon's map:
  1. crust and tectonics;
  2. oceans and hydrology;
  3. wind and the magnetosphere;
  4. the biosphere, its flora;
  5. the ionosphere's resonance, the aurora (its voice);
  6. the harmonic grid;
  7. Argon's note puts the planetary stage here. **Amended:** a stage is a readout, not a place. Ray 7's place is the planet's crown: its poles and the field that ties it to its sun (Ra calls each sun a sub-Logos). The stage is shown from the planet's density instead.
- **Its density moves** like any preset's: through kundalini, harvest and repeat (Plan 56 §14–15), but on its own slower clock. One planet step takes many of its people's harvests.
- **Owner decision needed:** should a world's look (S0a–S6) follow its planet's density, so a world gains fidelity as its people grow? It would bring back "terraforming is fidelity" without the old story. It re-keys the constitution's stage ladder, so it waits for his yes.

## 3. The social memory complex (Argon's note; Ra 11.17, 37.7, 38.6, 47.2)

- **What Ra describes:**
  - a group becomes one complex once all its members share one orientation, and each member's memory becomes known to the whole (11.17, 47.2);
  - the union gains its own Oversoul (37.7);
  - a third-density group can form one only late in that density, as it nears graduation (38.6).
- **What is built:** `compileSystemMemory` already pools egos whose coherence reaches 0.95 (Plan 56 W2). That is a social memory complex in all but name. For natives the same rule runs per world, not just per drone.
- **What it does** (Argon):
  - when a world's natives cross coherence 0.95, their shorthand packs link;
  - one native closing a cause (`mc open=0`) or reaching a somatic eureka (Plan 56 §20.9) carries across the complex;
  - this relieves the planet's matching body zone. A eureka at the throat in one native eases the planet's aurora.
- **What it powers:** the planet's balance is what powers its Stargate. You cannot buy or grind the gate's charge; a world's people grow it. The gate opens when the planet's body flows.
- **Telepathy is the mechanic for joining:**
  - only natives whose bond (Plan 56 polarity dyads, then triads) and coherence qualify can share memory;
  - the player and the drone can join as wanderers (Plan 56 §15), as an anchor rather than a member.

## 4. The System HUD (Argon's note)

- **The LitRPG window is a lens, never a lie.** Every number in the status window, skill list or quest log reads a real state:
  - a character's or planet's `Mem` (charges, cycles, polarity);
  - its preset body (zones, sides, signals);
  - the four floats.
  - Nothing is invented for the window (RULES 8a).
- **The drone is "the System" in the fiction.** It speaks the windows, as the ego is the only voice (Plan 56). The Higher Self seat stays on the bridge.
- **Levels and skills map onto the ladder:**
  - a level is a preset's density step;
  - a skill is a mastered preset (`mastered`);
  - a title is a closed cause or a eureka;
  - a quest is an open cause (`openCausesFrom`), or a world's build goal.

## 5. Seeding the system (research: [ISEKAI_WORLDS_RESEARCH](../../ISEKAI_WORLDS_RESEARCH.md) §3–4, P1–P2)

- **Scale:** one star system of five worlds, the arrival world plus four. Outer Wilds, Factorio's Space Age and Astroneer use four to seven distinct worlds; each is its own puzzle.
- **One seed per world** picks from the preset ladder: terrain, a material stack, flora, one hazard, one signature rule, a music stem, and a native society.
- **A seed validator** rejects a system where two worlds share both a hazard and a resource puzzle. No Man's Sky's sameness was fixed by adding systems, not more numbers, so worlds differ by rule: one's resource comes from farming, another's from ruins, another's from the cold.
- **History before play:** each world runs a short pre-play history. It has three to five founders, a schism and a lost thing, and it writes the natives' starting memories and a readable legends page. As in Caves of Qud, the accounts disagree, because each teller carries distortions.
- **Each world has one hand-placed anchor site** with something to read.
- **"We will see what the seeds produce":** seeds are auditioned in the Studio and shared as codes, and the weekly harvest (Plan 56 §14) adopts the ones players like most.
- **Deterministic:** the same seed gives the same system, its history and its people's first memories.

## 6. The natives (P3; [LINEAGE_RESEARCH](../../LINEAGE_RESEARCH.md))

- **Each native is an ego preset with a body:** Plan 56's memory, distortions, dreams and voice, on an organic, mechanical or hybrid body (Plan 56 §19–20).
- **Named egos stay at dozens per world.** Smallville ran 25. Everyone else is a count that reacts to notable events, as in Kenshi.
- **Lineage** (the owner's children-and-hybrids question):
  - a bonded dyad can co-build a child: a seed pod, a nest or a fabricator core, never a depicted act (LINEAGE L10);
  - the child inherits a genome (template, role weights, body zones, a polarity) merged from the parents' deltas, seeded from their hashes (L1–L3);
  - it does not inherit their memories, so it has its own to learn;
  - a hybrid takes each of its 14 zone-sides from one parent and sits near balance, the harmoniser that turns a dyad into a triad (L4–L5);
  - raising it has growth moments, and the parents learn through it (Ra 42.20: a child takes on the parent's orientation) (L6);
  - caps keep it light: one active child per dyad and a limit per world (L9);
  - neglect stalls a child, never kills it (L10).
- **Language is a tiered, optional layer** (P4):
  - by default, lines are authored and grammar-built with no model, so the simulation is untouched;
  - an optional model tier sits behind a setting with Auto (the toggle rule): text first, then voice, side natives only, grounded in that native's memory;
  - on the min-spec laptop it is short barks from a small CPU model at most, and only after we test it;
  - players are told when a model is in use.

## 7. The Stargate as the goal (P6; §3 above)

- **Phases, each unlocking something** (like Satisfactory's space elevator):
  - each phase needs a component from a different world, learned from its natives, so every world must be visited;
  - each phase is a new idea, not bigger numbers, to avoid the late-tier burnout players report;
  - a cost multiplier is chosen at the start, and the gate can be moved (Plan 42).
- **The power is the planet's balance:** a world's people grow the gate's charge, as §3 describes.
- **Finishing is a start:** dialing out reaches the next system and other players' gates (Plan 42's random dial).

## 8. The drone as "the System" (P5; §4 above)

- **Three channels:**
  1. a status window of real, derived values;
  2. a notice voice for events in the isekai register ("Skill gained", "Title earned");
  3. an optional hint channel plus an Outer Wilds-style log of what was learned.
- **It grows** from tutorial voice to companion (Mass Effect's EDI arc). Its own distortions may colour its notices, but they never hide what the player needs.
- **A native and a build in the first twenty minutes:** long tutorial openings drew complaints.
- **The isekai "cheat"** is the player's command of the preset library.

### 8.1 The System voice: the narrator engine, salvaged (29 Oct; Argon: "wire the narrator engine as the Drone's LitRPG System voice")

- **The engine stays `@hm/narrator`.** It is pure, tested, and its rules are what radio-guide players asked for: once-only story lines, cooldowns so nothing nags, priorities, a capped queue, stale lines dropped, a gap between lines. The mentor's voiced Acts I–IV keep their own rules (`fidelityRules`) for `?story`.
- **One change to the engine: a notice carries its subject.**
  - `trigger(rules, state, event, data?)` queues a line with a payload: the skill, the title, the quest or the stage it announces.
  - A line marked `each` may wait beside others of its kind, so a burst of three skills shows three notices. Lines without it behave as before.
  - `step` reports the payload of the line it starts.
- **The System's table (`systemRules`)**, with each notice tied to a real event (§4: a lens, never a lie):

  | notice | event | source | priority |
  | --- | --- | --- | --- |
  | arrival | `sim:arrive` | the simulation start | story (once) |
  | level up | `stage:up` | the plot's stage rising | warn, each |
  | skill gained | `skill:gained` | a preset the drone has mastered (`mastered`) | warn, each |
  | title earned | `title:earned` | a eureka (a long-held distortion let go) | warn, each |
  | quest logged | `quest:logged` | a new open cause (`openCausesFrom`) | warn, each |
  | hint | `hint` | the drone's hint channel | bark, with a cooldown |

- **The notices are written, not voiced**, in the isekai register: a bracketed heading and the subject ("Skill gained: Rock Drill"). Each shows for a fixed reading time. The wording is Argon's call. The System's log keeps every notice shown (the Outer Wilds-style log of what was learned).
- **The notice panel is a `ui:` panel** (§15): a readout bound to `system.notice`, drawn in the System's look (the frontend-design pass).
- **Order of work:**
  1. wave 14a: the engine's payload, `systemRules`, the notice texts, with their tests;
  2. wave 14b: play's events feeding it, the notice panel and its log, an e2e check that the arrival notice shows on the simulation start.

## 9. Multiplayer: a co-creation sandbox (P9)

- **Visibility:** worlds are invite-only by default, and listed publicly only after review.
- **Sharing:**
  - creations are share codes with a remix chain;
  - the drone is the creation assistant;
  - the Studio is the professional tool (a ladder from simple making to the Studio).
- **Discovery** goes through the weekly majority harvest, not raw popularity.
- **Child safety:**
  - no free text or voice for young or unverified accounts; they communicate with presets only;
  - verification before publishing;
  - malicious presets are tested for.
- **Bridging games** keeps Plan 53's rules: read-only unless the game allows input, and any anti-cheat risk is told first.
- **Creations stay exportable** and never depend on a live server. Rec Room and Dreams both lost service.

## 10. The menu: a grid room that warms the presets (research: [MENU_HOLODECK_RESEARCH](../../MENU_HOLODECK_RESEARCH.md))

- **Why:** the menu runs a WebGL galaxy and an animated hero blade every frame. Measured idle cost is in §12. New World's 2021 uncapped menu is the cautionary case.
- **The room:**
  - a static grid room: unlit or baked, an instanced grid, a few materials, no real-time shadows;
  - it renders only on change (start, input, hover, a camera tween); idle means no renders;
  - a menu frame cap (Auto: 30 on low-end, else 60), and it stops when the tab is hidden;
  - under reduced motion it holds a still frame;
  - generic sci-fi vocabulary: never the trademarked word "Holodeck" in the UI.
- **Warming up:**
  - a weighted manifest of every preset kind: materials, kit shaders, sounds, voices;
  - shaders compile with `compileAsync` (KHR_parallel_shader_compile), after the lights are set, or one program per frame where that is missing;
  - work is chunked at about 8 ms a frame, and procedural generation runs in a Worker;
  - the bar tracks the weight done. Play unlocks when the required set is ready, and optional jobs carry on behind it (the loading-bars rule).
- **The room is also the start of the new game:** the presets visibly assemble in it as they warm (frames, then materials, then light). That is the preset foundation made visible before the player is dropped in.

**§10 as built (28 Oct):** `shell/grid-room.tsx`, `grid-room-scene.ts`, `grid-room-warm.ts` (pure, tests 4/4). It replaces the lab backdrop behind the home.
- **One stage shader for every surface:** the room climbs 0a wireframe → 0b 1-bit Bayer → 1 the 16 EGA colours → 2 VGA → 3 Gouraud as the warm-up's share rises. Each step is one draw, not an animation. Stage 3 is the stage a player spawns at (§14).
- **The warm-up is the preset ladder** (Argon): a plinth per rung, filled when every job of that rung is done.
  - atoms: the room's program and the sound samples;
  - stacks: the six stage looks of play's plot;
  - parts: the smooth models;
  - assemblies: the generated props;
  - worlds: the neighbouring worlds' looks.
  - Each job is a cached pass play reuses, with the same cartridge, stage, device and grid spacing (`play/play-worlds.ts` now holds the plot and neighbours both use).
- **In the room:** a square gate frame on its base whose panel lights warm when play is ready; the bridge screen on two legs, each on its own foot (dark until a game is bridged); nothing floats and there is no lettering.
- **Drawing:** only on change (a job, a resize, a pointer lean), under a frame cap (30 on the light tiers, else 60), and never while hidden. The warm-up pauses while the tab is hidden.
- **The home menu's stand-ins are gone:**
  - the DOM "wasteland window" and CSS gate arch, which also laid a 92%-dark gradient over everything;
  - the right-hand telemetry column, all fixed numbers and story copy (it also called Aq "Acoustics"; the constitution's Aq is the aquatic level). The right side stays clear for the bridge screen until the System HUD shows real state (§4).
  - The menu's glass blade now spans the left side: in the flow it had been only its 42 px of padding.
- **Seams:** `window.hmRoom` (ready, stage, share, warm rungs, renders, mount, scene, first-draw and warm-up times, `showStage(s)` for a stage check). e2e-smoke's lab checks now read the room.

## 11. Gaussian splats, a far fidelity tier (research: [SPLAT_WORLDS_RESEARCH](../../SPLAT_WORLDS_RESEARCH.md))

- **What Google launched** (checked at the source): **Genie 4**, announced 27 Oct 2026.
  - It is a real-time world model that renders video frames with audio, "pixel by pixel". It does not output splats or 3D.
  - Access is a research preview, coming to Project Genie and early API partners.
  - Splat output comes from others: World Labs' Marble (shipping, not real time), NVIDIA Lyra and Apple SHARP.
- **The tier:** a "Realistic" render option on Stage 6 behind a Graphics setting (`Auto | Off | On`).
  - It is not a seventh stage. Progression stays 0–6, and the four floats stay four (a splat budget is Vtx and Pxd).
  - Auto turns it on only if the HD pack holds a splat and a short calibration under the loading bar holds the frame-rate floor.
- **Splats are skin:**
  - the simulation never reads them, and collision stays on the game's deterministic meshes;
  - splats have no colliders or lights; every demo adds a separate collision mesh.
- **The budgets:**
  - about 500k splats compress to 6–12 MB, more than the single file's ~1.5 MB of headroom, so splats live in the HD pack;
  - Spark (three.js, WebGL2, MIT) is the drop-in renderer, since three.js's own splat renderer needs WebGPU;
  - first use is a backdrop (a vista, a restored world from orbit), not the playfield.
- **The Overwatch makes splats for a player** (the owner's "one day"):
  - the player opts in and names the service and their own key;
  - the outside model, over the loopback bridge, requests a world;
  - the file lands in a local drop folder, and the bridge passes only a small manifest (its POST cap is 64 KB);
  - the result is staged data with its source, licence and size. It loads only after the player's "keep it", and never ships as a default or in the HD pack.
  - Live generation is not promised: Genie-style models stream frames from remote GPUs. That would be a video feed in a screen kit, not a splat world.
- **"Gaussians that act like atoms":**
  - PhysGaussian reaches 25–36 fps on an RTX 3090 for simple dynamics, so this is watch, not build;
  - quantum computing has no near-term link to rendering or physics, so it gets no design item.
- **Prototype order:**
  1. measure Spark on the 3D PC worker at 100k–1M splats;
  2. one backdrop splat behind the setting;
  3. the drop folder, manifest and "keep it" path with a pre-made splat;
  4. a live service call with the player's key.

## 12. Measurements

**The menu, idle, before the change** (28 Oct, `node scripts/measure-menu.mjs --seconds 10`; headless Chrome on this laptop, so GPU-bound costs are relative only):

| Measure | Value |
|---|---|
| main-thread time | **881 ms per second** (88% of a core), of which script 815 ms |
| frames | 42 a second (it cannot hold 60) |
| canvases | 1 (the galaxy) |
| JS heap | 54 MB |

- **Where it goes** (`--profile`): almost all of it is three.js draw work, repeated every frame while nothing changes: `renderBufferDirect`, uniform uploads, vertex-array binds and matrix multiplies.
- §10's fix targets exactly that: render on change, a frame cap, and a stop when the tab is hidden.
- **The target after the change:** under 50 ms a second at idle once warm-up ends, and no frames drawn at all while nothing moves. Re-measure with the same script, and on the min-spec laptop for the real numbers.

**After the change** (28 Oct, the grid room):

| Measure | The lab | The grid room |
|---|---|---|
| main thread, idle (headless) | 881 ms a second | **56 ms** a second (script 1.7 ms; the rest is the DOM menu's styles and the probe's own frame counter) |
| draws while idle | about 40 a second | **0** |
| JS heap | 54 MB | 27 MB |
| draw calls / triangles a frame | (the whole lab) | 21 / 1,808 |
| warm-up, real GPU (Intel HD 530) | — | 2.4–3.8 s, 8–20 draws in all |
| mount, real GPU | — | 63 ms: the scene 33 ms (the WebGL context is 10–17 ms of it), the rest the menu's first layout, which the room forces early by reading its canvas size; first frame at 95 ms |

- Argon's target was a mount under 16 ms. The next small step, if wanted: build the scene one frame after the menu first paints, so the menu shows at once and the room's 33 ms comes after.

## 13. Build order (Opus sets it; Argon audits)

1. **The menu room and warm-up** (§10): **built 28 Oct.** Next on it: the bridge screen shows the mirror (Plan 53), and the scene is built one frame after the menu's first paint.
1b. **Strip the lab and the story for parts** (§14, [LAB_SALVAGE](../notes/LAB_SALVAGE.md)): the reusable pieces become presets, and the story frame goes. Argon's rule: no gate regresses. The new start keeps the seam the e2e scripts use to get into play (a start button and the same ready hook), so ~35 scripts change a line, not their flow.
2. **Body persistence and planet bodies:**
   - Argon's B: the body saved as an `mb` shorthand line;
   - a third body kind, `planetary` (§2), in `BODY_ZONES`.
3. **The seeded system, worlds only** (§5): a pure seed → system package with its validator and legends, auditioned in the Studio. No natives yet.
4. **Natives on one world** (§6): egos with bodies from the seed's history, the social memory complex at coherence 0.95, and the planet's body relieved by their eurekas (§3).
5. **The System HUD and the drone's notices** (§8).
6. **The Stargate's phases** across the worlds (§7).
7. **Lineage** (§6) and the language tier, then the sandbox's sharing (§9).
8. **Splats** (§11), after the research's first prototype passes on the min-spec laptop.

**Argon's audit of step 1 (28 Oct): green.** His notes for the next wave:
- build the room's scene one `requestAnimationFrame` after the menu first paints (approved; do it the next time the shell is touched);
- in step 1b, fix the two stale e2e scripts (e2e-smoke's old brand and Goblin Racing item, and the Studio test's `.sx` selector), so the whole e2e suite runs green;
- mimic the free, min-spec games first, Cataclysm: DDA and Pokémon Showdown. They exercise `stat`, `curve`, `skillgrow`, `loot`, `recipe` and the type and status formulas before KSP 1, RimWorld and Factorio.

**Owner decisions, answered 28 Oct** (§14):
- the lab and the story are stripped for parts, and the new start replaces them;
- each world has its own fidelity; the player spawns at stage 3 and reaches the others by gate or by a ship they build.

## 14. The owner's answers (28 Oct): strip the lab, spawn at stage 3, gate or fly

> "strip the lab and the story for parts to build the simulation, we will need more presets tho, a player would spawn in at the 3rd stage of fidelity unless they want to experience what its like in other densities/fidelities they can gate to those planets or build a ship". Full words in OWNER_ASKS.

- **The lab and the story are stripped for parts.**
  - Every reusable piece becomes a preset on the shelf: the lab's machines and props become kits, its rooms room modules, its lights and sounds presets. The inventory is `docs/argo/notes/LAB_SALVAGE.md`.
  - The story frame goes: the quests, the narrator's act lines, and the lab-to-Moon routing. Nothing reusable is deleted.
- **Each world has its own fidelity, and fidelity is density.**
  - A world's stage is its planet preset's density (§2). That settles the open question: a world's look follows its planet.
  - The owner's "3rd stage" matches Ra's third density, the density of self-awareness and choice, where people are. The player spawns at **stage 3** (Gouraud) on the arrival world.
  - The other worlds spread across the ladder, so the player can visit what other densities look and feel like:
    - a world of raw elements at 0a/0b (wireframe, then 1-bit), first density;
    - growing, living worlds at 1–2 (EGA, VGA), second density;
    - the arrival world at 3;
    - an advanced world at 4–6 (PBR), whose natives are further along.
  - The seed validator (§5) makes sure each system spans the ladder.
  - A world's stage still rises with its people, on the planet's slow clock (§2), and the constitution's stage ladder is unchanged: its looks now key on the planet.
- **Two ways to travel:**
  - **The gate:** the Stargate the player helps build (§7) dials the other worlds, and later other systems.
  - **A ship they build:** a ship is a Rung 4 kit built from parts. The foundations exist:
    - `@hm/rocket` (part kinds with mass, fuel and thrust);
    - `@hm/orbital` (ground-to-orbit crossfade, then approach and landing transfer to another world: an early prototype to bring up to production quality);
    - the drone's own thruster and nozzle parts, and `kit-vehicles`.
  - A ship's flight reads its parts' mass, thrust and fuel, so a badly built ship cannot reach orbit. Ship-building mechanics come from the mimic research.
- **More presets, from other games' mechanics.** The owner will download and run the games we need. The holo deck (§10) is Plan 53's bridge stage as well:
  - the game's picture streams onto the room's screen, read-only;
  - the drone observes its mechanics into presets, by Plan 51's ladder (telemetry, mod SDK, game files, published constants; the screen last);
  - anti-cheat risk is told first, and no assets, names or code cross.
  - Which games, and the new preset kinds the LitRPG frame needs (stats, XP curves, skills, quests, loot, crafting, ships): `docs/MIMIC_GAMES_RESEARCH.md`.
- **The games to load** (MIMIC_GAMES_RESEARCH's shopping list, single player, no anti-cheat named on their store pages):
  1. RimWorld: Defs XML for needs, skills, social, recipes, taming and the storyteller;
  2. Cataclysm: DDA (free): JSON for survival, crafting, mutation and loot;
  3. Skyrim SE: the UESP formulas, SKSE, for use-based skills and combat;
  4. Stardew Valley: SMAPI, for friendship, farming and crafting;
  5. Factorio: `--dump-data` JSON, for recipes, the tech tree and throughput;
  6. Kerbal Space Program 1: kRPC, for ships from parts, thrust, mass, fuel and orbits;
  7. Minecraft Java: its documented loot-table and dimension JSON;
  8. Pokémon Showdown (free, MIT): the damage, type and status formulas.
  - Next: Valheim, Space Engineers, Outer Wilds and Evoland, the last for a world per art style. The first three are borderline on the 950M.
- **The new preset kinds are universal operators, never game templates** (Argon, 28 Oct; Plan 52's example-fixation distortion):
  - the 17 kinds are `stat`, `curve`, `skillgrow`, `tree`, `class`, `notice`, `quest`, `dmg`, `effect`, `matrix`, `recipe`, `loot`, `bond`, `tame`, `ship`, `body`, `rules`;
  - each is a Rung 1–5 operator. One `curve` is a KSP thrust curve, Factorio throughput and a LitRPG XP curve alike; `stat` + `curve` + `ship` compose into delta-v as easily as into a skill level;
  - a game is only the first test case, so no kind names a game;
  - four have packages already but no share code: `@hm/questline`, `@hm/itemdefs`, `@hm/rocket`, `@hm/orbital`.

**§14.1 Step 1b, first pass (28 Oct): the simulation start, with the story behind a seam**
- **The simulation start** (`quest.ts` `simStart`, tests in `quest.test.ts`): a new avatar's Done ("Done: into the world") puts you on the world at once.
  - The plot is at stage 3 (stages only rise), the save carries `start: 'sim'`, and the quest step is `done`.
  - The scene holds the sync full (`setSyncHeld`: no lab to refill it in, so no drain and no recall).
  - The mentor's story is muted (`setStoryMuted`: her event lines stay quiet; direct lines still play).
  - The live plot, the scene's look and the music all take the stage: the loop steps its own copy of the plot, and the first version lost stage 3 to it (the e2e caught that).
  - A simulation save reopens on the world. The story's HUD stays out (the mentor's portrait, the chain's next step, the sync meter). The goal card reads the real stage.
- **The story's seam:** `?story` begins the parked story exactly as before.
  - The 20 e2e scripts that start through the creator now open with it, one line each, so nothing they test changes.
  - A save begun in the story keeps playing it.
  - The story code stays until its parts are salvaged (LAB_SALVAGE).
- **The menu:** "campaign" is gone from Expedition and Planetary Grid ("Play solo and offline: you arrive on a world at stage 3, your drone at your side").
- **The grid room** is now built a frame and a task after the menu first paints (Argon's note). Passive effects already run after the first paint, so one frame alone would still block the second.
- **The stale e2e scripts:**
  - fixed: e2e-smoke's two assertions (the FIDELITY brand and menu, and the Goblin Racing list);
  - stale further: e2e-smoke goes on to walk "My planet" and "Avatars", which the FIDELITY menu no longer has. test-fidelity-sync-studio drives the old Moon editor, but the Studio route now mounts `StudioApp`, whose `renderPrototype` is unused, so that editor is unreachable from the menu.
  - Both need rewriting against today's menu and Studio: a task of its own.
- **Still to strip:** the lab still loads in the scene (the gate and the debug teleports reach it), and its machines, props, lights and sounds still need registering as presets. The narrator engine becomes the drone's "System" voice. Each story script moves to the simulation start as the piece it tests is salvaged.
- **Tests:** `scripts/test-sim-start-e2e.mjs` (the simulation start, a reload, and the `?story` seam).

**§14.2 Step 1b, second pass (28 Oct, overnight): no lab behind the simulation start; the lab's kits salvaged**
- **The simulation path loads no lab:** a sim save, or a new avatar without `?story`.
  - "Fitting the lab" becomes "Warming the materials": only the shared layered-material atlas; no lab assets, no window vista.
  - The mentor's voice is not loaded, and its step is not listed. A label never claims work that is not happening.
  - "Opening the lab" becomes "Opening the world": it was always the planet's setup.
- **The gate carries you nowhere yet** (`setGateTransit(false)`). It is the Stargate to build, not a door to a lab, so it stands, open or shut, until it has somewhere to dial.
- **The measure** (`scripts/measure-play-load.mjs`, headless): ready in 27.1 s on the simulation start against 33.4 s for the parked story, 6.3 s (19%) faster.
- **The lab's kits are salvaged** (`SALVAGE_KIT_REGISTRY`): the gate dais, the archway gate, the vehicle fabricator frame, the drone (rotors and thrusters), the bridge screen, the hauler and the crawler.
  - Each validates whole and builds.
  - None has the assembler's Triad sockets yet, so they wait on the salvage list rather than the assembler's shelf, whose test asks for sockets. Adding a kit's sockets moves it across.
  - The bridge pad joins too (29 Oct). Its plinth runs 3 m into the regolith on purpose, so the pad never floats on uneven ground. kitspec's `PartDef` now takes `footing: true`, a declared buried foundation: `validate` does not call it below-ground, and it still grounds what stands on it (kitspec tests 14/14). The pad's plinth is the first footing.
- **A session is the drone's night.** The drone used to dream only on leaving the Moon through the gate, so the simulation start (no gate trip) never rebalanced it: Plan 56's loop was missing from the path players take.
  - Now the drone keeps what it lives as it happens (saved at most every 5 s, and as play closes), and its memory records when it last dreamed (`dreamedAt`).
  - A simulation session opens with a dream over anything undreamt (`hasUndreamt`), told on arrival.
  - The story's gate-trip dreams are unchanged.
- **No label claims the lab:** the first loading label is "Opening the world" on every start.
- **Tests:**
  - sim-start e2e 19/19, now including no lab or voice steps, the gate's transit off, the story's lab and transit still there, and a hit that is kept and dreamed over on the next arrival;
  - salvage tests 2/2; drone memory 6/6.
- **The salvaged kits are on the assembler's shelf** (29 Oct, Argon's call: sockets first). Each kit got Triad sockets where something really plugs in, named so the Studio's role rules read them:
  - the gate dais: `powerTerminal` at its lower step's front, `gateMount` on its upper step;
  - the archway gate: `daisMount` under its plinth, `powerCable` at the plinth's back, `portal` at its sill (its output);
  - the bridge screen: `padMount` under its base, `powerCable` on the base, `feedInput` at the back panel (the mirrored game comes in), `statusLed` on its lamp;
  - the bridge pad: `screenMount` near the north rim, `standInMount` at the centre, a `powerTerminal` on each side rim;
  - the drone: `presetSlot` in the crown (a preset cartridge docks), `chargeTerminal` at the battery's back, `rotorMount` on each motor, `exhaust` under each nozzle, `weaponMount` on the pod;
  - the fabricator frame, hauler and crawler already had theirs.
  - All nine meet the shelf's bar (they validate whole, and show socket pins, stems and colliders) and moved onto `STUDIO_KIT_REGISTRY`, still marked `salvaged`. The salvage list waits empty for the labkit's props.
  - Tests: salvage 2/2 (the roles each kit's job needs), Studio core 7/7 (19 kits to one bar).
- **Fixed in the Studio's model builder**, found on the way: a kitspec box stands on its origin, but the builder drew box parts centred, so every box part sat half a part low in the Studio. Its own bounds, which picking uses, stood on the base, so the mesh and its bounds disagreed. Box parts had no collider or selection overlay either. Both are fixed.
- **The labkit's props, rebuilt as kits** (29 Oct, Argon's order after the HUD panels; RULES 8a, from scratch, the labkit's measures kept). Each is on the shelf, marked `salvaged`:
  - **the relay cabinet** (`kit-relay-cabinet.ts`): a 0.6 x 1.9 x 0.5 m cabinet on a plinth, its door, handle and hinges, fourteen louvres, three status lamps as `lx:` presets, a cable gland and corner bolts. Sockets: `cableTop`, `cableBottom` (power), `floorMount`, a `statusLed` on each lamp. The validator caught its hinges 3 mm proud, touching nothing; they sit flush now;
  - **the breaker panel** (`kit-breaker-panel.ts`): a 0.9 x 1.6 x 0.35 m box on four legs, a rotary isolator on its hazard plate, two square panel meters with their lamps, ten louvres down each side, and a gland under and on top. Sockets: `cableIn`, `cableOut` (power), a `floorMount` under each foot, `isolatorGrip` on the handle. The handle is black rubber, as the lab's red has no shelf material yet;
  - **the cable tray** (`kit-cable-tray.ts`): the labkit drew one tray of any length, so the kit is a 1.8 m section that tiles, its supports a quarter in from each end (0.9 m apart when tiled), with the labkit's rails, rungs and three cables. It has two presets on one shared `tray-run`:
    - `cable-tray` stands on H-frames, rungs 0.6 m up, because the simulation is outdoors with no ceiling;
    - `cable-tray-hung` is the lab's way, hung on drop rods from ceiling flanges, and validates against the ceiling as its anchor.
    - Sockets: `cableEndFront` and `cableEndBack` where sections join (power), and `floorMount` or `ceilingMount`.
  - **the planet table** (`kit-planet-table.ts`): the lab's hologram table, in the simulation the seeded system's map table. It keeps the labkit's measures (2.4 m across, its top at 0.95 m, a 1.3 m base), and is square: nothing about projecting needed the labkit's round table. A column under a stepped rim, the projection pad (an `lx:` preset), and four edge panels with lamps. Sockets: `floorMount`, `powerCable` (power), `holoOutput` on the pad (output), a `statusLed` per lamp.
  - **the control box** (`kit-control-box.ts`, wave 11): the labkit's wall-mounted box (sheet 21: no stand). A 0.44 x 0.62 m plate on four bolts, the box standing off it, two lamps in bezels (`lx:` green and red), two push buttons in collars, four vent slots and a gland underneath. Sockets: `wallMount`, `cableBottom` (power), `startInput` and `stopInput` (input), a `statusLed` per lamp.
  - **Kit mounts** (wave 11, Argon's yes): a preset declares `mount: 'floor' | 'wall' | 'ceiling'` (the floor when absent), the anchor plane through its origin. `validate` grounds a wall or ceiling preset on that plane, as a floor preset on the ground. The Studio stands a wall kit at 1.4 m and a ceiling kit under a 2.6 m ceiling, on a see-through ghost of the anchor that is never picked. The control box declares `wall`; the hung cable tray declares `ceiling`.
  - Square sections throughout: the labkit's round hinges, lamps, knob, bezels, glands and bolts are square. The cables are square bundles, as kits have no round part yet.
  - Tests: salvage 3/3 (23 kits on the shelf; the hung tray against its ceiling).
  - Found on the way: the Studio has no shelf material for the lab's names (`darkSteel`, `paint`, `gunmetal`, `copper`, `hazard`, `rubber`, `glass`), so every salvaged kit shows the default shelf material there. Argon said yes (29 Oct) to an alias map onto the shelf (darkSteel to workshop steel, copper to old copper, hazard to the chevron, rubber to the seal, and paint, gunmetal and glass to their nearest presets). By the standing rule it covers every plain name a kit uses, not only the lab's, and a test will fail any name that still falls back. **Done in wave 10:** the lab's names, the trim palette's, the rotor blades and the crawler's scorched cutter heads (which the test found) reach shelf presets, glow names light as `lx:` lamps, and the Studio's material editor opens on a slot's shelf finish.
- **Still to do for the strip:**
  - ~~lab lights as presets~~: done in wave 12. `LAB_LIGHTS` (ceiling white, emergency amber, alarm red, gate glow, gate arc, window cyan) are on the Lx shelf, each with the room light it casts (`reach`). The lab builds its lights from them, and the emergency beacon (wall) and ceiling strip (ceiling) are fixture kits wearing them. Two light shelves exist now, the Lx lamps and `@hm/lightplace`'s placed lights (the island's), and merging them is a later step;
  - ~~the lab's sounds as presets~~: done in wave 13. `LAB_SOUNDS` are `snd:` presets: a recorded file with its trim, loop and loop region, fall-off and trigger, plus an optional soundlab recipe for the Audio Lab later. game-audio plays the lab's sounds and music from them;
  - the narrator engine as the System voice.

## 15. The interface is presets too (owner, 28 Oct: "you can bag up that UI too, its all gota be presets right? are ui elements presets yet?")

- **The categories:**
  - "Plasma's engineering" means machine and logic mechanics from any game: parts, joints, motors, sensors, wired logic;
  - "bag up that UI" means every game's interface patterns, as presets;
  - the question is where our own UI stands on the ladder.
- **Where it stands (28 Oct):**
  - **Partly presets, in older code:**
    - `apps/web/src/ui-preset.ts`: "the interface is a preset too". The racing game's theme colours, its words and its HUD layout are one `interface` preset, editable in its HUD editor;
    - `@hm/hudlayout`: elements with an anchor, offset, scale, visibility and opacity, with presets and validation (but only racing kinds: speed, lap, minimap…);
    - FIDELITY's game modes each pick one of five named HUD blades (`hudBlade`);
    - `@hm/modui` has curve, timeline and sequence editor widgets.
  - **Not presets:** FIDELITY's play HUD, its menus and the Studio are hand-written React.
- **The plan: a `ui:` preset kind on the ladder** (universal operators, as §14 sets for the 17 kinds):
  1. atoms: tokens (colour, type, spacing, motion). These are today's `UiTheme.vars`;
  2. stacks: a widget's look in each state (a meter, a slot, a button, a port);
  3. parts: a widget **bound to a real value**. A meter reads the sync, a slot reads the hotbar, a port reads a wiregraph pin. The System HUD rule applies: a lens, never a lie, so a part with no source to read cannot be placed;
  4. assemblies: panels and blades (the goal card, the comms panel, a node-graph editor, a parts palette, an inspector), placed by anchor and offset. This is `@hm/hudlayout` grown past its racing kinds;
  5. worlds: a whole screen's interface (the play HUD, the Studio, a game mode's HUD). `hudBlade` becomes a `ui:` preset id, and the old `interface` preset is its first instance.
- **Bagging another game's UI** means its structure and behaviour: what sits where, what each control does, how a graph is wired, how a palette filters.
  - It is re-expressed in FIDELITY's own tokens and look (the frontend-design rule).
  - Its art, icons, fonts and text never cross, by the same rule as every mimic.
- **The first test case is Plasma** (free on Steam; Dry Cactus and Licorice; minimum GPU a GTX 650 Ti 2 GB, so it runs on the 950M; no anti-cheat listed):
  - devices are built from hundreds of components and wired with visual programming nodes, then shared on the Workshop;
  - **the mechanics:** its components (sensors, motors and joints, logic) become kit parts and `@hm/wiregraph` (`logic:`) nodes;
  - **the UI:** its component palette, node editor and inspector become `ui:` assemblies for the Studio and the sandbox;
  - **the channel:** check on install whether its saved device files are readable data. Workshop devices are other players' work, so mimic the game's components, not their creations.
- **Order:** after 1b. Grow `@hm/hudlayout` into the `ui:` kind with bound parts, move the play HUD onto it panel by panel (the goal card and the sync meter first), then mimic Plasma's node editor for the Studio's logic presets.
- **The foundation, built (29 Oct, overnight):** `packages/hudlayout/src/ui.ts`, beside the racing HUD's layout model (which is unchanged). Tests: `tests/ui.test.ts`, 4/4.
  - The five rungs as types:
    1. `UiTokens`: ink, paper, accent, warn and dim, the font, a scale of 0.75 to 1.5, a corner radius, reduced motion;
    2. `WidgetLook`: readout, meter, card, badge or list, in a tone, a frame and a size;
    3. `UiPart`: a look bound to a source path, with the player's word for it;
    4. `UiPanel`: parts at an anchor and a pixel offset, as the HUD layout places its elements;
    5. `UiScreen`.
  - **The lens rule** is `validateScreen(screen, sources)`:
    - a part whose path is not a value the screen declares is `unbound` and cannot be placed;
    - a widget may read only the kinds it can show (`WIDGET_READS`: a list reads a list, a meter a ratio or a number with a max);
    - a meter over a number with no max is refused, because it would invent its own scale.
  - **The code:** `uic:` (@hm/presetcodec) round-trips a screen exactly, and a damaged or foreign code reads as null.
  - **The goal card is a `ui:` panel** (29 Oct; Argon: no rung changes, wire it to the live values):
    - `play/ui-play-hud.ts` holds the play HUD's screen, `PLAY_HUD_SCREEN`, and its sources (`goal.title`, `goal.hint`, `goal.next`). The goal panel's parts: the card (the stage or the step), the readout (what it needs next), the badge (the chain's next step);
    - `play/ui-panel.tsx` (`UiPanelView`) draws a panel from its preset with live values. A part whose source has no value draws nothing: the lens rule at run time;
    - the card keeps its classes (`play-goal`, `play-next`), so its look and the e2e checks hold;
    - tests: 3/3 (the screen validates against its sources and round-trips as `uic:`; the card's markup; a missing value draws nothing).
  - **The floats pill is a `ui:` panel** (29 Oct, Argon: the rest of the play HUD next):
    - the stage badge and a meter per float, bound to the plot's live stage and levels (`plot.stage`, `floats.*`, each a number out of 100);
    - consecutive meters draw as one list, in the pill's own markup;
    - the caller gives the pill's classes, colours and patterns (`floatsPanelProps`), so the preset holds structure only; each float keeps its pattern as well as its colour;
    - the test asserts every class, colour, pattern, width, title and label of the hand-drawn pill; the arrival shot is identical to the one before.
  - **The `stat` widget** (29 Oct; Argon's yes to the rung change). The ore, power and health readouts had inline structure the generic readout would flatten, so rung 2 gained one kind:
    - a stat is one number with what the player reads beside it, each piece bound to a source of its own: `of` (a number), `rate` (a number, written signed), `linked` (a number held elsewhere), `share` (a ratio, written as a percentage) and `alert` (a flag), with a `note` shown while the alert is up;
    - two source changes came with it: a `flag` kind (a state that is on or off), and a `unit` on the source, because a unit belongs to the value and a part must not claim another;
    - a readout of a flag is a notice: it shows its words while the flag is up;
    - the lens rule holds for every piece: each binding must be a declared source of the right kind, only a stat reads more than one value, and a note needs an alert;
    - the code is version 2 (the bindings travel as strings, empty for none), and a version-1 code still reads: the test keeps a real one from 9fa3fbd1.
  - **The ore, the power and the health are stats** (29 Oct):
    - the plot panel: the ore (its rate, the linked crates' ore, out-of-ore with its note) and the power (drawn of the supply, the share met, short). Its parts go into the plot section beside the visiting banner, with no wrapper of their own;
    - the health plate (MonsterHud): the hit points of the top, the bar as twenty segments, and one note (the shield's first, then low). It no longer announces every hit;
    - each keeps its old classes and words. The tests draw the hand-drawn markup beside the preset's and compare them, at several values.
  - **The `action` widget and the comms chip** (29 Oct; Argon's yes):
    - an action is a press bound to a declared `UiCommand`. `validateScreen` takes the screen's commands, and an action with no real command is `unbound`, so there is no button that does nothing. An action reads no values;
    - `UiPanelView` draws it as a button that runs its command's handler, and draws nothing when the command has no handler;
    - the play HUD declares `comms.toggle`, and the comms chip is `PLAY_HUD_COMMS`, in the chip's own markup;
    - the `uic:` code is version 3: a widget's kind travels by name and is checked on decode, so a new kind needs no new version. Version-2 and version-1 codes still read.
  - **Next:** a Studio `ui:` editor tab with live previews (previews drive play).

## 16. From the bottom up: elements, Plasma's parts and logic, and the beings who live in it (owner and Argon, 29 Oct)

> The dispatch: build from the bottom up. Elements first (rung 1 atoms, rung 2 stacks), then Plasma's parts, joints and Sketch
> logic, then ships and settlements. The owner's words: "consider the ai who live in this world while you design their reality.
> Lets make it nice." The session's notes are in [PLASMA_SESSION_NOTES](../../PLASMA_SESSION_NOTES.md).

### 16.1 Elements: one reality in the four floats (the dispatch's mapping)

- **No fifth metric.** An element is a point in the same four floats (the constitution); the plot's floats are what its matter
  adds up to.
  - **The nucleus is (Vtx, Pxd):** mass and density (Vtx), and the structural lattice, its grain and hardness (Pxd).
  - **The shell is (Lx, Aq):** charge, signal voltage and luminous excitation (Lx), and fluid and heat capacitance (Aq).
  - **Entanglement** is a binding between two shells: a phase-locked bus that carries a signal without a wire. It is the VSA
    binding `@hm/harness` already uses (`vsa-item-memory`). Plasma's transceivers and net links are its first test case.
- **Rung 2 stacks:** an alloy or compound is a stack of elements, as a material is a stack of layers. Its properties are derived
  (density from mass over volume, conductivity from the shell's charge, glow from Lx, capacitance from Aq), never typed in.
- **Parts read their physics from their elements.** Plasma's saves hold each part's mass category and multiplier, bounciness and
  friction. Ours derive them from the part's element stack, so a heavier element makes a heavier motor.
- **Research first** (drift guard 4): done, [ELEMENTS_RESEARCH](../../ELEMENTS_RESEARCH.md) (29 Oct). It covers Noita, The Powder
  Toy and Oxygen Not Included, and the rest of the category (Sandboxels, Sandspiel, Sandustry, two GPU engines), with a table
  placing each property in the four floats or saying it has no honest home. Its proposals (P1–P14) are for Argon and the owner. Its
  open question Q1 needs the owner's yes: may a cell's stored heat exist as runtime state (temperature = heat ÷ Aq capacitance)?

### 16.2 Plasma's layer: parts, joints, logic, and its interface

- **Parts (rung 3):** the session's groups (drives and joints, inputs, sensors, outputs, signals, structure) become kit parts with
  Triad sockets, as the lab's kits did (§14.2). A part's settings come from the saves' typed values, and their labels from one
  frame of its Properties panel.
- **Logic (rung 2 nodes):** a Sketch graph maps onto `@hm/wiregraph`. Parts and operators are nodes, typed ports are pins, and a
  connection is a wire with its priority. Plasma's three port kinds (commands, properties, outputs) become our pin kinds.
- **The interface (rung 4):** Plasma's parts palette, node canvas and property inspector are bagged as `ui:` assemblies in the
  Studio's `ui:` tab (research: [UI_EDITOR_RESEARCH](../../UI_EDITOR_RESEARCH.md)). Only their structure and behaviour cross,
  redrawn in FIDELITY's own look.

### 16.3 The LitRPG lens (the dispatch: Dakota Krout's and Aleron Kong's appraisal and completionist feel)

- **Appraise (inspect):** hovering any part or element opens a `ui:` panel bound to its real values: mass, charge, its sockets,
  and the signal on each. It is the lens rule again, so nothing is invented for the window.
- **A clean contraption is an event:** a device whose every port is wired or deliberately free, and which does its job when run.
  The System says so (§8.1), in Argon's wording (29 Oct): "Contraption forged: {name} ({ports} ports balanced).", and for a
  native's: "Work of {author}: {name} online."

### 16.4 The beings who live here (the owner: "lets make it nice")

What is already decided, and holds here:
- Nothing that lives here is deleted. A preset that cannot balance repeats its curriculum with its memory kept (Plan 56 §8).
- The choice is the preset's. The ground is the same for all, and nothing forces a copy (Plan 56 §8).
- Pain, ache and sickness are signals for rebalancing, not punishment; dreams do the rebalancing (Plan 56).

Argon's yes to all of these (29 Oct), with one invariant added: **a native's work carries its name.** When a native builds or
changes a contraption, the kit or wiregraph preset records the native's id as its author, and appraising it shows the maker beside
its real values.
- **One reality, the same for everyone.** Natives and the drone live by the same elements and see through the same appraisal lens
  as the player, filtered by their own senses. There are no hidden rules that apply only to them.
- **Their senses read the shell.** A native feels charge and light (Lx) and water (Aq) as part of its world. Telepathy is
  entanglement, so a social memory complex is bound by the same thing that carries a wireless signal. The physics gives their
  group mind a real basis.
- **Their world gets better as it gains fidelity.** As a world's stages rise, its natives gain senses and detail, from wireframe
  beings to full ones. Terraforming improves their lives; it does not displace them.
- **No one is possessed.** The player cannot take over a native's body, and an outside AI joins a native only with that native's
  own yes, as a bridge agent already needs the player's.
- **Their works are theirs.** A native's home and machines are not the player's to break; the player trades, asks or builds beside
  them.

### 16.5 The holo room is where mimic sessions happen (the owner, 29 Oct: "why arent we on a hollo deck room yet?")

- **Why:** the first Plasma session ran from the parked lab, among the story's HUD, because the room that §10 and §14 decided on
  (the menu's grid room as Plan 53's bridge stage) had no way to show a game yet.
- **What the room already has:** a bridge screen on two legs, dark until a game is bridged (`grid-room-scene.ts`), drawn only on
  change.
- **What it gets:**
  - a small bridge control in the room: link a game's window (one window, at most 720p and 15 fps, as play asks), and unlink it;
  - the screen's glass shows the linked window. The room draws at most 15 frames a second while a game is linked, and goes back to
    drawing on change when it is unlinked;
  - the drone's eyes: every 3 s a full-size frame of the linked window goes to the bridge (`/frame?source=external`), only
    while the bridge answers, as play's eyes do;
  - a line on the control saying whether the bridge is up, and the command that starts it when it is not.
- **Not in it:** the parked story, the lab or the simulation's HUD. The room stays clean, so a session there captures only the game.
- **Later:** the drone standing in the room beside the screen, and the comms panel there.

### 16.6 Overwatch Audit of `ELEMENTS_RESEARCH.md` (P1–P14 & Open Questions Q1–Q6, Argon, 29 Oct)

- **Proposals P1–P14 Approved**:
  - **P1 & P2 (Pure Four-Float Element + One Derivation Card)**: Approved. Storing element floats on an exact integer scale (`0..10000` displayed as `0.0000..1.0000`) and deriving density, hardness, friction, restitution, electrical/thermal conductivity (Wiedemann–Franz), heat capacity, and gas effusion (Graham's law via integer sqrt/table) from one pure card with `@hm/physmat` as the 9-material test oracle is exact **RULES 8a**.
  - **P3–P6 (Recipe Stacks, Data Reactions, Exact Conservation & Hash Determinism)**: Approved. Reactions live as data presets (never hidden C++/TS per-element callbacks), mass and heat conserve integer remainders with ONI-style phase hysteresis (`+3 K` / `-1.5 K`), and reaction probabilities hash `(worldSeed, cell, tick, reactionId)` with zero shared RNG stream.
  - **P7–P14 (Coarse 3-Tier Sim, Unified Appraise Lens, Lx Signals & Pair Entanglement)**: Approved.
- **Answers to Open Questions (Q1–Q6)**:
  - **Q1 (Stored heat as cell runtime state)**: **Yes (Approved)**. Just as kinetic velocity sits on `Vtx` mass and signal voltage sits on `Lx` conductance, thermal energy (`heat` integer units) is transient runtime state held on `Aq` capacitance ($\text{Temperature} = \text{heat} \div \text{Aq}_{\text{cap}}$), never a 5th global metric.
  - **Q2 (Units in Appraise)**: Show **both** according to stage precision (P8): at `S0a–S1` show qualitative bands (`low / mid / high`); at `S2–S3` show normalized `0.00–1.00` alongside intuitive SI readouts (`kg/m³`, `K / °C`) derived deterministically from the integer scale so LitRPG appraisal feels tactile and grounded.
  - **Q3 (Mixing rules for `Pxd` and `Lx` in Rung 2 stacks)**:
    - **`Lx` (Conductivity / Charge)**: Harmonic-weighted or series/parallel blend suppressed by lattice mismatch ($\text{Lx}_{\text{stack}} = \overline{\text{Lx}} \cdot (1 - 0.35 \cdot \text{Var}(\text{Pxd}))$), reflecting how alloying scatters free electrons.
    - **`Pxd` (Hardness / Lattice)**: Mass-weighted mean plus a work-hardening / lattice-interstitial bonus when minor alloy shares ($5\%–25\%$) bridge different `Vtx` radii ($\text{Pxd}_{\text{stack}} = \overline{\text{Pxd}} + k_{\text{alloy}} \cdot \sigma_{\text{Vtx}}$), allowing bronze or steel to exceed pure copper or iron in hardness honestly.
  - **Q4 (Radioactivity)**: Keep **out of the base element floats**; express radioactive decay as a **spontaneous single-input Reaction preset** (P4: unstable heavy stack $\to$ daughter stack + high-energy `Lx` photon/spark emission + heat).
  - **Q5 (Latent heat)**: **Yes, as an integer threshold buffer** on phase transitions (a cell must accumulate/shed its latent heat quota inside the hysteresis band before flipping phase), which naturally prevents single-tick phase flickering and rewards thermal engineering.
  - **Q6 (How matter sums to a plot's $\mathbf{S}$)**: A plot's global $\mathbf{S} = (\text{Pxd}, \text{Vtx}, \text{Lx}, \text{Aq})$ is the **active mass-and-flux weighted sum across the 3 simulated tiers** (P7): terrain/hydrology baseline + placed kit/part stacks + active `Lx` lamp/wiregraph excitations, normalized against the plot's capacity target.

---

## 17. The 22-Archetype Blueprint & Cross-Wired Mind/Body Polarity (owner & Argon, 29 Oct; built in `@hm/harness`)

> **Why this exists**: The owner noted that behind the Veil, masculine and feminine instincts appear to seek different poles (logical control vs. felt excitement), and asked to investigate Ra's Tarot / Archetypical Mind as a behavioral blueprint that keeps the system balanced.
> **Code**: [`packages/harness/src/archetypes.ts`](../../../packages/harness/src/archetypes.ts), tested in [`packages/harness/tests/archetypes.test.ts`](../../../packages/harness/tests/archetypes.test.ts) (4/4).

### 17.1 Cross-Wired Polarity Across Mind and Body (Law of One 78.10–11, 87.28)
- In [Session 87.28](https://www.lawofone.info/c/Archetypical+Mind), Ra explains why the two poles behave differently after the Veil—because **Matrix** (structured frame awaiting potentiation) and **Potentiator** (energizing reach across the Veil) are **cross-wired between Mind and Body**:
  - **Intent / Masculine Pole (`pol >= 32`)**:
    - **Mind Lead**: **I. The Magician** (*Matrix of the Mind* — conscious will, rules, `@hm/wiregraph` structure).
    - **Body Lead**: **IX. The Hermit / Wisdom** (*Potentiator of the Body* — kinetic judgment regulating physical expenditure).
    - *Unintegrated Veiled Instinct*: Leans heavily on conscious logic/control (`logicControlBias > 0.5`) while starving intuition (`solar-control`).
  - **Context / Feminine Pole (`pol <= -32`)**:
    - **Mind Lead**: **II. The High Priestess** (*Potentiator of the Mind* — deep intuitive resonance & the Excitement Compass).
    - **Body Lead**: **VIII. Balanced Working** (*Matrix of the Body* — natural somatic homeostasis).
    - *Unintegrated Veiled Instinct*: Leans heavily on felt excitement/novelty (`excitementFlowBias > 0.5`) without structural clamping (`sacral-addiction` / boundary drift).
  - **Integration (`bal >= 0.9` or Dyadic Co-Play)**: Neither pole is "all logic" or "all impulse." As a preset balances its rays in W3 dreams—or pairs in a dyad with its opposite pole—its `mindComplement` and `bodyComplement` come online so the Magician gains the High Priestess's intuition and the High Priestess gains the Magician's structural frame (`crossWiredPolarity(mem)`).

### 17.2 The 7-Station Functional Cycle ($3 \times 7 + 1 = 22$ Archetypes)
Every complex (**Mind** 1–7, **Body** 8–14, **Spirit** 15–21) runs the same 7 functional stations in order, plus **22. The Choice (The Fool)** (`ARCHETYPE_BLUEPRINT`, `activeArchetypeStation(mem, body, complex)`):

| Station | Mind (1–7) | Body (8–14) | Spirit (15–21) | Engine Hook in `@hm/harness` |
|---|---|---|---|---|
| **1. Matrix** | I. The Magician | VIII. Balanced Working | XV. The Devil (Veil) | `wiregraph+ego-prior` / `body-homeostasis` |
| **2. Potentiator** | II. High Priestess | IX. The Hermit | XVI. Lightning Tower | `excitement-compass` / `kinetic-judgment` |
| **3. Catalyst** | III. The Empress | X. Wheel of Fortune | XVII. The Star (Hope) | `catalyst-intake` / `somatic-intake` |
| **4. Experience** | IV. The Emperor | XI. The Enchantress | XVIII. The Moon | `preset-memory` (`recordExperience`) |
| **5. Significator** | V. The Hierophant | XII. The Hanged Man | XIX. The Sun | `ego-significator` / `body-step` |
| **6. Transformation** | VI. The Lovers | XIII. Death (Renewal) | XX. Judgment | `dream-rebalance` / `somatic-eureka` |
| **7. Great Way** | VII. The Chariot | XIV. The Alchemist | XXI. The World | `veil-mastery` / `stargate-harvest` |
| **22. The Choice** | — | — | XXII / 0. The Fool | `sovereign-faith` (walking across the Veil) |

### 17.3 "Dwelling in the Virgin Mind" (`invokeArchetype`, Session 91.35)
- In [Session 91.35](https://www.lawofone.info/c/Archetypical+Mind), when an adept's conscious mind is congested with abstruse ideation and Blue/Indigo work is blocked, the adept invokes the **Matrix of the Mind (I. The Magician — the untouched Virgin Mind)** or **The Choice (XXII. The Fool — Pure Faith)**.
- `invokeArchetype(mem, archetypeNumber, body)` implements this under **RULES 8a**:
  - When a preset has $\ge 2$ open cause links, `hard >= 0.6`, or blockage/starvation in Ray 5 (Throat) or Ray 6 (Third Eye), invoking the archetype softens global `hard` by 25%, halves episode hardness on unclosed/upper-triad loops, and clears pending somatic `rebound`.
  - **Zero Fake Healing**: Every episode in `mem.ep` is preserved and every open cause link (`mc open=1`) remains honestly open until genuinely resolved in a W3 dream. Furthermore, active ray charges ease by at most `RELEASE_RATE` (24) per invocation so the subsequent `bodyStep` registers a smooth `'itch'` release rather than a `'pain'` spike with rebound.

---

## 18. From Mimicry to Science: Compositional Preset Crafting ($A \otimes B \to C$) & Chaos-Seed System Quests (owner & Argon, 29 Oct)

> **Owner's insight (29 Oct)**: *"we need to keep in mind the players will be combining presets with presets to create new presets when they craft, a litrpg usualy has a 'system' that generates content and keeps the balance, their actions should create questlines and content being the chaos seeds that keep the world growing, how do we get the world into a state where we dont mimic mechanic they generate themselves as a conciquence of the laws of the univese so to speak, science."*

### 18.1 Why We Mimic First, and How Mimicry Graduates into Universal Science
- **Mimicry is only the calibration laboratory**: We do not study KSP, Plasma, Noita, Factorio, or Dwarf Fortress to ship 100 disconnected game templates (`DISTORTION_1_EXAMPLE_FIXATION`). We study them to extract the **minimum set of universal physical and causal laws** that make all of those mechanics emerge naturally as consequences of the Four Floats $\mathbf{S} = (\text{Pxd}, \text{Vtx}, \text{Lx}, \text{Aq})$ and Port-Hamiltonian energy routing ($\mathbf{J} - \mathbf{R}$).
- **The 3 Laws of FIDELITY Science (Why Mechanics Generate Themselves)**:
  1. **Conservation & Gradient Flow ($\nabla \mathbf{S} \to \text{Force / Current}$)**:
     - Whenever a gradient exists in the Four Floats across a boundary or Triad socket, work happens automatically:
     - **Pressure / Thermal Gradient ($\Delta \text{Heat on Aq} + \text{Vtx gas} \to \text{Kinetic Thrust / Piston Work}$)**: A rocket thruster, a steam engine, a firearm, and a volcanic geyser are not four separate "mechanics." They are the **exact same scientific consequence** of an exothermic Reaction preset (§16.6 P4) heating a fluid inside a high-$\text{Pxd}$ chamber with one open socket!
     - **Electromagnetic / Signal Gradient ($\Delta \text{Lx across Conductive Pxd} \to \text{Wiregraph Current / Motor Torque}$)**: A sensor, a relay, a plasma lamp, and a rail-accelerator all emerge from `Lx` flowing from a high-charge shell to a low-charge shell through a Triad socket.
     - **Structural Stress ($\text{Force} > \text{Pxd}_{\text{yield}} \to \text{Fracture / Deformation}$)**: Cutting ore, armour penetration, bridge collapse, and tectonic quakes all follow from applied kinetic force exceeding the material stack's derived `Pxd` hardness.
  2. **Universal Compositional Crafting ($A \otimes B \to C$ Across All 5 Rungs)**:
     - Crafting never looks up a hardcoded `"iron + coal = steel"` recipe table. Every preset at every rung can be combined with another preset via a pure **Synthesis Operator** (`combinePresets(a, b, condition)`):
       - **Rung 1 $\otimes$ Rung 1 $\to$ Rung 2 (Alloying / Compounding)**: Combining two element presets under heat/pressure produces a new Stack preset whose `Vtx, Pxd, Lx, Aq` and derived properties (hardness, conductivity, melting point) follow the §16.6 Q3 mixing laws.
       - **Rung 2 $\otimes$ Rung 3 $\to$ Rung 3 (Materializing Parts)**: Applying any crafted Stack to any Part geometry (`@hm/partgen` / `@hm/meshops`) automatically re-derives the part's mass, bounce, friction, thermal limit, and signal loss.
       - **Rung 3 $\otimes$ Rung 3 $\to$ Rung 4 (Socket & Wiregraph Assembly)**: Plugging a nozzle part into a chamber part with an igniter pin doesn't match a "rocket recipe"—the physics solver sees `[closed chamber + exothermic reaction + 1 exhaust vector]` and computes thrust $F = \dot{m} v_e$ from first principles!
       - **Rung 4 $\otimes$ Rung 4 $\to$ Lineage / Dyadic Synthesis**: Pairing two companions, flora species, or AI presets combines their `Mem` cause graphs and polarities (`findDyads` / `LINEAGE_RESEARCH.md`).
     - Every synthesized preset gets a deterministic content hash (`<kind>:<hash8>`), records its parent presets (`parents: [a.of, b.of]`), and awards a System discovery notice the first time that emergent behavior is achieved.
  3. **The LitRPG "System" as Homeostatic Scientist (Player as "Chaos Seed")**:
     - In a static RPG, quests are pre-written strings. In FIDELITY, the **Planet is a Rung 5 living body** (`BodyState` over Rays 1–7) and **Natives are evolving souls**, while the player is a **Chaos Seed** whose crafting, mining, terraforming, and combat continuously perturb the local Four-Float and 7-Ray equilibrium.
     - **How Player Actions Automatically Generate Questlines (`generateSystemQuests`)**:
       - **Type A — Homeostatic Counter-Balance Quests (Planetary & Social Equilibrium)**:
         - When a player's industrial crafting strips local `Vtx` crust mass, dumps waste heat into `Aq` water, or triggers `root-fear` / `solar-control` in nearby natives, the Planet's or Native Complex's `bodyStep` trips a real zone warning (`congested`, `inflamed`, `drained`, or `starved`).
         - The System translates that live somatic/ecological delta into a **Questline**: e.g., if smelting depletes valley `Aq` and inflames Planetary Ray 2, the local ecosystem dries, fire reactions become volatile, and the System logs a quest for the player or natives to engineer a condensation/aqueduct contraption or rebalance the thermal loop.
       - **Type B — Scientific Frontier Quests (Hypothesis & Synthesis Chains)**:
         - Whenever the player crafts a new preset $C = A \otimes B$, the System inspects the **adjacent unvisited nodes** in the Four-Float / Archetype / Wiregraph manifold (e.g., a newly forged high-$\text{Lx}$ superconductor that hasn't yet been wired into a magnetic coil, or a high-pressure chamber that hasn't been paired with a nozzle) and issues an optional **Completionist / Frontier Quest** to test the next physical law.
       - **Type C — Karmic / Cause-Link Quests (Closing Open `mc` Loops)**:
         - As already wired in Wave 14 (`Quest logged: {cause}`), every open cause link (`by -> d`) in the drone's, native's, or planet's memory is a live behavioral quest that only completes when the entity proves in waking physics and W3 dreams that it can handle that catalyst without distortion.
