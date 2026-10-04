# QUESTLINE: from your island to the goblin world (owner, 2026-10-04)

Written 2026-10-04 by a side session (Opus 5.5, while the main session worked on the hotbar V3). **For the main session:** these are new owner asks. They are logged in `OWNER_ASKS.md` (2026-10-04, 18:22), tracked in `STATUS.md` (D12, D20, section 6c QL1 to QL10), and slotted into the schedule in `STATUS.md` section 9 and `handoff/CATCHUP.md` 12af. Finish the hotbar V3 glue you are on first, then pick these up in the order in section 6 below. Hand the pure logic to Arena as usual (section 7 lists the battles).

---

## 1. The owner's idea in one paragraph

You start on your own island in SetMix. A **questline teaches you to build**: first a base, then **machines**. You **dig up resources** from the island: the island's own vertices are worth credit, so you can mine them, move them and convert them. Call them **pixels**. Machines turn pixels into **textures**. Each machine has settings, stamps normals or applies algorithms. Good-looking, highly optimised algorithmic textures are **the commodity**. You save what you make as **presets you can sell**. With the credits you **buy a rocket preset**, or better, **build the rocket** from the logic presets you learned to put together. You fly to the goblin world and **crash**. A **Shaman revives you**, and now you **look like a goblin**. That starts the **racing questline**, which earns you the **Shaman class**. By then there will be more games with their own questlines. The new game mode ties straight into the questline, so it teaches the player how to build anything.

## 2. How it fits what is already planned

| Already planned | Where | What this adds |
|---|---|---|
| H9: learn to build, build a ship, fly to the goblin world, unlock classes (Shaman first) | STATUS 6a | The concrete steps: base, machines, pixels, selling, buy or build the rocket, the crash and the revival |
| H8: your solar system, the flight to Goblin Racing's star | STATUS 6a, MASTER_PLAN | The flight ends in a crash landing on the goblin world |
| E9: classes (`class` + `ability` kinds) | STATUS 5, CATCHUP 12k | The revival is the first time the player sees the Shaman's resurrection ability, before they can earn it |
| Life state machine (alive, dead, ghost, jailed, resurrecting) | CATCHUP 12k | The crash uses it: the player is "dead" on arrival, the Shaman runs "resurrecting" |
| `@hm/tutorial` (ISLAND_STEPS, 10 steps) | packages/tutorial | Becomes chapter 1 of the questline (quest steps are tutorial presets) |
| `@hm/texgraph` (math textures, 26 surfaces) | packages/texgraph | **Machines are texgraph nodes you can stand next to**: the node's variables are the machine's knobs |
| Share economy and the 100 KB size limit | B8, `@hm/plugs` | "Highly optimised" can be measured: looks against bytes and GPU cost |
| Credits | E6 (bookie, simulated) | Credits become a real harness-level wallet, earned by selling presets and mining pixels |
| `unlock` preset kind (condition + reward) | H9 plan | "Ship ready" is satisfied by a bought rocket **or** a built one |

## 3. The pieces (each a preset kind, so new games can add their own)

1. **`quest`** and **`questline`**: a quest = steps (each a `tutorial` step: a goal you can check, words, a pointer at a `data-ui` name, B15) + a reward (an `unlock`). A questline = quests in order, with branches. Saved per player. Games register their own questlines (Goblin Racing's racing questline, later games' ones).
2. **`unlock`**: condition (an expression over the player's state: owns preset X, quest Y done, wallet at least N, a built thing passes a check) + reward (credits, a preset, a class, a place you can travel to).
3. **Pixels (a resource)**: the island's ground and voxel models are made of points. Digging (F3) or a mining tool takes them out and puts them in your **pixel store**: count, plus what they were (grass, sand, rock, coral, the surface they came from). They can be moved (placed somewhere else, the ground fills back) and converted. Rules: an island has a budget, so mining is a choice, and the ground regrows slowly or not at all (a `worldrules` variable). Keep it cheap: pixels are counts per surface, not per-point objects.
4. **`machine`**: a placed thing (a voxel model) with an input (pixels of some kinds), a recipe (one texgraph node or a small texgraph: noise, warp, stamp normals, blur, palette map, tile-seamless ...), settings (the node's variables as knobs on the machine and in its editor), and an output (a texture preset). Machines chain with the F7 logic wires: one machine's output into the next. The texture's cost (bytes when shared, ms to bake) is shown next to its preview.
5. **Selling**: a texture or any preset goes on sale through the Share dialog (B8 already has "Up for sale" and a price). Locally simulated buyers first (`@hm/platform` LocalSim, like the community), RUN later. Price feedback: buyers prefer good looks at low cost.
6. **`wallet`**: harness-level credits (`ownerStorage` on RUN, so Goblin Racing sees the same wallet; H6).
7. **The rocket**: a `rocket` blueprint = a voxel model plus logic presets (engine, fuel, steering, a launch sequence on wires). The shop sells a ready-made one. Building your own uses the same parts; a **"ship ready" check** (an `unlock` condition: has a hull, an engine wired to a launch button, fuel) passes either way. Later the built rocket's numbers matter (range, speed: H8).
8. **The crash and the revival**: a short scripted sequence (camera presets, effects, the life state machine): the flight (H8), the crash on the goblin world, the screen goes dark, the Shaman's resurrection ability plays, and your avatar becomes a goblin (a new goblin avatar is made from your current look's colours, H4; your old avatar stays in your Avatars). Then the racing questline starts in Goblin Racing.
9. **The racing questline**: Goblin Racing's own questline; its last reward is the Shaman class (E9).

## 4. Chapters (first draft, the owner to adjust)

1. **Wake up on your island** (today's tour: walk, look, hop).
2. **Make a base**: sculpt a flat spot, place walls and a roof from building blocks (F3), paint them (F2), a door on a wire (F7).
3. **Your first machine and a portal** (owner, 2026-10-04: "the questline shows you in the beginning how to do with a machine then hook it up to a portal and then step into voxel worlds on the other side"): place the Importer machine, import the starter model (a CC0 .vox we ship), wire the Importer to a portal (Magic Cord), step through to the open-source world the owner picks, bring one thing back. After this the player finds their own sources (their own files; links to worlds whose hosts allow it). Built in `RELEASE_PLAN.md` Milestone 2.
4. **Dig**: mine pixels, see the pixel store fill, move a hill.
5. **Your second machine**: place a Noise machine, feed it pixels, turn its knobs, get a texture, use it on your base.
6. **A chain**: Noise into Stamp normals into Palette; compare looks against cost.
7. **Sell**: put your texture up for sale, get your first credits.
8. **The rocket**: buy the ready-made one, or build it (hull, engine, fuel, a launch button on a wire). "Ship ready".
9. **Fly**: out of your system to the goblin world's star (H8).
10. **Crash, revival, goblin**: the Shaman, your goblin self.
11. **Goblin Racing's questline** begins; it ends with the Shaman class.

Each chapter teaches one hotbar tab (V3) and ends with something you keep. The new game mode (the questline) is the tour: B15's rule holds, every step points at a real `data-ui` name and the screen map checks it.

## 5. The two rendering asks raised at the same time

### 5a. Voxel to smooth low-poly models (D12)
Goal (owner): Arena makes highly detailed voxel models; maths smooths them into low-poly meshes that work with the PBR texture set.
- `@hm/smoothvox` has it: `meshModel` (surface nets, smoothing that keeps creases, colour blend, AO), `decimate`, `lodChain` (near, mid, far). Unwired.
- Missing: **no UVs or tangents**; the output is vertex colours plus `paletteIndex`. Plan: each palette entry maps to a surface of the SetMix texture set (a `material-map` on the model preset), drawn triplanar in the shader (no UVs needed); tangents from the triplanar frame.
- Wire it: in PBR detail the renderer draws models with the smooth LOD chain (owner, D19: "the pbr mode should use the smooth meshes"); voxel flat keeps the blocks. Cache the meshes per model revision. Start with the hero goblin, the palm and the rock; then the avatar parts.
- Measure: triangles and frame time on Low and Potato (`scripts/perf.mjs`).

### 5b. Voxel flat mode: transitions between surfaces are hard squares (D20)
Cause: `packages/render/src/terrain/terrain-glsl.ts`, the ISL_FLAT path (around lines 264 to 270): where two surfaces meet, each half-metre block flips a coin weighted by the blend (`hMix < lw`) and shows **one whole surface**. So a shoreline is a scatter of random full squares, and no block mixes the two.
Fix, in order:
1. **Ordered (Bayer) dither inside transition blocks** at the face's pixel-art resolution: each pixel-art pixel of the face picks surface A or B against a 4x4 or 8x8 Bayer threshold of `lw`. Blocks that are fully one surface do not change. Cheap (one more texture fetch only in transition blocks).
2. Optionally shape it with low-frequency noise so the boundary wanders inside the block.
3. Later: hand-made transition tiles (edges and corners, 47-tile blob set) from the Arena texture agent, chosen per block from the neighbours.
Check: e2e screenshot of a grass-sand shore in voxel flat, before and after; Potato frame time unchanged.

## 6. Order of work (after the current hotbar V3 glue)

1. D20 dither (small, visible, the owner noticed it).
2. QL2 `unlock` + QL1 `quest`/`questline` kinds, with today's tour moved into chapter 1.
3. QL3 pixels and QL6 wallet.
4. QL4 machines on texgraph, chained by wires.
5. QL5 selling (LocalSim buyers).
6. D12 smooth models in PBR detail.
7. QL7 rocket (buy, then build) and the "ship ready" check.
8. QL8 crash and revival, QL9 racing questline to the Shaman class (with E9).
9. QL10 the questline is the new game mode's tour (B15 checks it).

## 7. Arena battles to write (pure logic, tests first)

- `questline`: quest/questline/unlock data, a pure evaluator (state in, which steps are done, what unlocks), branches, save/load, validation.
- `pixels`: pixel store and mining rules over a height grid (take, move, fill back, budget, regrow), deterministic.
- `machines`: a machine = texgraph sub-graph + input/output ports; chain validation; cost estimate (bytes, bake ms) of a texture preset.
- `market`: simulated buyers (taste for looks vs cost, price curve), deterministic with a seed.
- `rocket`: blueprint parts and the "ship ready" check; flight numbers (range, speed) from the parts.
- `voxdither`: not Arena; a few lines of GLSL, do it yourself.
- `smoothvox` follow-up: palette-to-surface triplanar mapping and tangents (prompt as a rev 2 of the existing battle).

## 8. Open questions for the owner

1. Do pixels regrow on your island, or is every dig permanent (so selling pixels empties your island)?
2. Can players sell raw pixels, or only what machines make?
3. Is the goblin you become a new avatar (your old one kept), or does your avatar turn into a goblin?
4. Does the crash cost anything (lost cargo, a broken rocket to repair: a hook for the mechanic class)?
