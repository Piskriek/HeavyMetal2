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
- **Still to do for the strip:**
  - rebuild the labkit's procedural props (relay cabinet, breaker panel, control box, cable tray, planet table) as kits (RULES 8a, from scratch);
  - lab lights and sounds as presets;
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
  - **Next:** declare the play HUD's real sources (the stage, the next stage's needs, health, ore, power, the drone), express its panels as a `ui:` screen, and render them from it, the goal card first.
