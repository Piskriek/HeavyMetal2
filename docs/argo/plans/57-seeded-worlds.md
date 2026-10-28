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

## 13. Build order (Opus sets it; Argon audits)

1. **The menu room and warm-up** (§10): it is concrete, it fixes a cost the owner feels now, and it shows the preset foundation. Load the frontend-design skill first.
2. **Body persistence and planet bodies:**
   - Argon's B: the body saved as an `mb` shorthand line;
   - a third body kind, `planetary` (§2), in `BODY_ZONES`.
3. **The seeded system, worlds only** (§5): a pure seed → system package with its validator and legends, auditioned in the Studio. No natives yet.
4. **Natives on one world** (§6): egos with bodies from the seed's history, the social memory complex at coherence 0.95, and the planet's body relieved by their eurekas (§3).
5. **The System HUD and the drone's notices** (§8).
6. **The Stargate's phases** across the worlds (§7).
7. **Lineage** (§6) and the language tier, then the sandbox's sharing (§9).
8. **Splats** (§11), after the research's first prototype passes on the min-spec laptop.

**Owner decisions needed:**
- should a world's look (S0a–S6) follow its planet's density (§2)?
- does the new start replace the lab, or does the lab become the grid room?
