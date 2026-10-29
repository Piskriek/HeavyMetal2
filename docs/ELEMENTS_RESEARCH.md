# FIDELITY // Elements Research: how elemental sandboxes define matter, and what players like and hate
> **Why this exists**: Plan 57 §16 builds the world from the bottom up. Elements come first: rung-1 atoms, then rung-2 stacks (alloys and compounds), and Plasma's parts read their mass, friction and bounciness from their element stack ([§16.1](argo/plans/57-seeded-worlds.md)). Drift guard 4 says research comes before design. This is that research.
> **Read with**: [Plan 57 §16.1 and §16.4](argo/plans/57-seeded-worlds.md) (the four-float mapping, and the beings who share this reality), [Plan 41](argo/plans/41-layered-materials.md) (layered materials: the look, not the physics), `@hm/physmat` (today's hand-typed physics materials).
> **Status**: everything under "Proposals" (P1–P14) is a proposal for the owner and Argon. Nothing here is decided.

---

## 1. What was looked at

The brief named Noita, The Powder Toy and Oxygen Not Included. By the standing rule, those are examples of a category: **games whose matter is a table of element properties plus rules for how elements meet**. So the doc also looks at other members of that category, and at the newest engines.

| Game or project | What it teaches us |
|---|---|
| **Noita** | A material is a data record; reactions are data; rigid bodies come out of the pixel grid; chunked, dirty-rect simulation on the CPU. |
| **The Powder Toy** (2008, on Steam since 2024) | A fixed element record plus per-element code; probabilistic heat conduction; a separate air-pressure grid; sparks as a travelling state; wireless channels. |
| **Oxygen Not Included** | Elements with real-world-style physics (specific heat, conductivity, molar mass); one element per cell; heat transfer with documented formulas; known leaks of mass and heat. |
| **Sandboxels** (browser, 2021) | 546 elements described as plain data, reactions as a keyed table. |
| **Sandspiel / Sandspiel Studio** | A 4-byte cell; per-element update functions; players editing element rules with blocks. |
| **Sandustry** (release listed for August 2026) | A factory game where every pixel is a resource. |
| **sands-of-rust, Metalrain** | Falling sand on the GPU: block rules in WebGL 1 fragment shaders; WebGPU compute on a hex grid. |

The genre's lineage runs from World of Sand (about 2005) and the Powder Game (about 2007) to The Powder Toy, Sandspiel and Sandboxels. Some of these games also simulate air pressure, temperature and electrically conductive materials [S7].

Player sentiment comes from reviews, Steam threads, mod pages and an automated review-summary site (Vaporlens, whose method is not stated). That is vocal players, not surveys. Weigh it as recurring themes, not statistics. Vaporlens is used only where opened reviews or threads say the same thing.

---

## 2. How the three games define matter

### F1. Noita: a material is an XML record, and reactions are data too
**Properties.** The modding page lists the attributes of a material [S1]:
- **Type:** `cell_type` is `solid`, `liquid`, `fire` or `gas`. Powders are liquids with `liquid_sand` set ("behave as sand you can stand on").
- **General:** `hp`, `durability` (0–14), `density` ("how strongly it seeps through lighter materials"), `electrical_conductivity`, `stickyness`, `slippery`.
- **Solids:** `solid_restitution` (bounciness), `solid_friction`, `solid_gravity_scale`, `crackability`, and what it breaks into.
- **Liquids and gases:** gravity, flow speed, viscosity, damping; gas up, down and sideways speeds; a `lifetime`.
- **Fire:** `burnable`, `fire_hp` (how long it burns), `requires_oxygen`, `temperature_of_fire`, `autoignition_temperature`, `on_fire_convert_to_material`.
- **Melting and freezing:** `warmth_melts_to_material` and `cold_freezes_to_material` exist, but the wiki names them without explaining them.
- **Hints for enemy AI:** `danger_fire`, `danger_water`, `danger_poison`, `danger_radioactive`.

Bounciness and friction are typed in per material, not derived.

**Reactions.** A `<Reaction>` takes `input_cell1` and `input_cell2`, gives `output_cell1` and `output_cell2`, and has a `probability`. Tags in brackets match whole groups: the page's example turns any `[meltable]` material into its `_molten` version [S1]. Fungal shifts go further: they remap one material into another everywhere for the rest of the run, drawn from weighted tables [S5].

**Density** is mainly a liquid property: heavier liquids sink and lighter ones float, so they layer [S2]. **Durability** is the most damage a material resists; explosions spend "ray energy" against each pixel's HP [S2].

**Simulation.** Petri Purho describes it as "complex cellular automata" [S6]:
- liquids check down, then left or right, and compare densities to decide whether to swap;
- gases do the inverse;
- a burning pixel tries to ignite a random neighbour.

The world is split into 64×64 chunks. Each chunk keeps a dirty rect, so only changed areas update. For threads, chunks update in four checkerboard passes, and a pixel may move at most 32 pixels outside its chunk, so two threads never touch the same pixels. Rigid bodies are pixels that remember which body they belong to; when pixels are destroyed, the body is recalculated and may split [S6].

**Electricity** is covered on the wiki mostly through the Electricity perk: metals and liquids around the player "electrify constantly", and water spreads it to enemies [S3]. The pages opened do not explain how charge spreads. **Fire** produces smoke; water and many liquids put it out; lava ignites burnable and gunpowder materials [S4].

### F2. The Powder Toy: a fixed element record, plus code per element
The official wiki was behind bot protection, so this comes from the game's source on GitHub. The field meanings come from the names, values and code, not from documentation.

**The record.** Every element has the same fields [S15]:
- movement: `Advection`, `AirDrag`, `AirLoss`, `Loss`, `Collision`, `Gravity`, `NewtonianGravity`, `Diffusion`, `HotAir`, `Falldown`;
- material: `Flammable`, `Explosive`, `Meltable`, `Hardness`, `Weight`, `PhotonReflectWavelengths`;
- heat: `HeatConduct` (an unsigned byte, so 0–255) and `HeatCapacity` ("Volumetric heat capacity per one pixel… default value is 1.0f");
- `Properties` flags and `CarriesTypeIn`;
- four transitions: `LowPressure`/`HighPressure` and `LowTemperature`/`HighTemperature`, each with a target element;
- function pointers: `Update` (the element's own behaviour) and `Graphics`.

**Two examples.**
- **WATR:** `Weight` 30, `HeatConduct` 29; flags `TYPE_LIQUID | PROP_CONDUCTS | …`; freezes to ice at 273.15 K and boils to vapour at 373 K [S16]. Its reactions are code in its update function: with salt, a 1 in 50 chance per frame of becoming salt water; while moving, a 1 in 1000 chance of eroding rock into sand or stone.
- **METL:** `Weight` 100, `HeatConduct` 251, `Hardness` 1; flags `TYPE_SOLID | PROP_CONDUCTS | PROP_HOT_GLOW`; melts at 1273 K into lava, with the comment "METL -> LAVA(METL)" [S17]. The lava carries the type it came from.

**Heat** [S20]:
- **Conduction is probabilistic.** A particle runs its heat step only when `rng.chance(HeatConduct, 250)` passes, so about HeatConduct/250 of the time.
- **It is an instant local average.** When it runs, the particle and its 8 neighbours are averaged, weighted by heat capacity, and all of them are set to that value.
- **Air has its own heat.** Particles also exchange heat with an ambient air-heat grid.
- **Transitions are thresholds.** The boiling point shifts with local pressure. No latent-heat term was visible in the code read.

**Pressure** lives on a separate, coarser air grid (cells of `CELL` pixels) [S21]:
- pressure comes from velocity divergence, and velocity from the pressure gradient;
- both are smoothed and advected, with vorticity confinement;
- values are clamped to min and max limits;
- walls block air, and some walls block heat.

**Electricity** is a state, not a current [S18]:
- a conductor that is hit becomes `SPRK` for a few frames, keeping its real type in `ctype` and counting `life` down;
- a conductor can be sparked only when its own `life` is 0 and the sender's `life` is below 4, so each spark is a pulse with a recovery time;
- range is a 5×5 area with Manhattan distance under 4;
- insulators block; PSCN and NSCN act as diodes and switches;
- sparking warms metals by 10 K (below 673 K).

**Wireless.** `WIFI` picks a channel from its temperature, one channel per 100 degrees. A spark received by any WIFI makes every WIFI on that channel emit on the next frame. Its description: "transfers spark to any other wifi on the same temperature channel" [S19].

**Determinism.** Randomness comes from one `rng` object. Saves record its state, the frame count and an `ensureDeterminism` flag [S20]. The code read did not show where a load restores that state.

**Scale.** 258 elements as of February 2025. The game is GPLv3, and the Lua API can add elements [S14][S23].

### F3. Oxygen Not Included: an element is a physical record, and a cell holds one element
**The record** [S29]:
- heat: `specificHeatCapacity`, `thermalConductivity`;
- matter: `molarMass`, `hardness`, `strength`, `toxicity` (on some elements);
- transitions: `highTemp` and its target, plus an optional by-product ore and its mass share;
- mass: `defaultTemperature`, `defaultMass`, `maxMass` (per cell);
- radiation and light: `lightAbsorptionFactor`, `radiationAbsorptionFactor`, `radiationPer1000Mass`;
- `state`, tags, a material category, and sublimation settings.

Examples:
- **Iron:** specific heat 0.449, conductivity 55, melts at 1808 K into molten iron.
- **Katairite (Abyssalite):** conductivity 0.00001, which makes it the game's near-perfect insulator.

No electrical field appears in the element data; ONI's electricity is not an element property.

**Cells.**
- "Only 1 liquid may occupy a tile at a time". Each liquid has a maximum mass per tile, and the excess spills upward [S30].
- Liquid density is set equal to molecular weight, which the wiki calls "an inaccurate assumption" [S30].
- Gases layer by molar mass [S31].
- Tiny amounts are deleted: gas under 1 µg [S31], liquid under 10 g [S30].

**Heat transfer** has documented formulas [S26]:
- q = ΔT × Δt × k × a multiplier per pair of states.
- Between cells, k is the geometric mean of the two conductivities. Insulated tiles and creatures use the lower of the two.
- Solid to gas has an extra ×25, and liquid to liquid an extra ×625.
- Each tick's flow is capped at a quarter of the temperature gap.
- Nothing flows below 1 °C of difference or 0.1 DTU.
- Temperatures are 32-bit floats, so very small changes vanish. If either side fails to change, no exchange happens.

**Phase change** has hysteresis. A listed transition "does not actually occur until 3K past the displayed temperature", and afterwards the temperature moves 1.5 K back toward the old phase [S28]. Some changes leave by-products, such as sulfur from sour gas [S28]. Small pipe packets never change state [S32].

**Conservation is not guaranteed.** The wiki says ONI "does not fully ensure the conservation of energy or mass" and uses "a lot of hard-coded transitions" [S27]. The documented cases include:
- mining a natural tile drops half its mass, and so half its heat;
- buildings hold one fifth of their material's heat capacity;
- some machines output at a fixed temperature, whatever goes in [S32].

### F4. The rest of the category has the same shape
- **Sandboxels** describes each element as data [S39]:
  - `state`, `density` (kg/m³), `temp`, and `tempHigh`/`stateHigh`, `tempLow`/`stateLow`;
  - `conduct` (0–1), `insulate`, `superconductAt`, `charge`;
  - `burn`, `burnTime`, `burnInto`, `hardness`, `breakInto`, `viscosity`;
  - a `reactions` table keyed by the other element.

  It has 546 elements, 228 of them hidden until found [S40].
- **Sandspiel** stores a cell in 4 bytes: species, two free registers and a clock byte [S41]. Each element has its own update function. The clock byte stops a falling particle from being updated twice in one top-to-bottom scan. The grid uploads straight to the GPU as a texture.
- **Sandspiel Studio** (2022) "lets users create and modify elements by dragging-and-dropping blocks", with a gallery to share and remix them [S42].

**Across all of them:** an element is a small fixed record; states change at thresholds; reactions are pairs (A meets B, both become something else, with a chance); and a few systems (air, heat, charge) run beside the grid.

---

## 3. What players praise and complain about

### F5. The simulation is what players love
- **Noita:** a reviewer calls it "a stunning technical showcase" [S8]. Another praises emergent solutions such as blowing open a shortcut or steering water onto a fire [S9].
- **The Powder Toy:** "Overwhelmingly Positive" on Steam [S14]. Summaries stress free experimenting, its educational value and low system requirements [S25].
- **ONI:** players praise deep, linked systems and creative problem-solving, with temperature among the systems they enjoy managing [S38]. This one comes from the summary site only.

### F6. Unexplained rules are the top complaint in all three
- **Noita:**
  - the game explains few of its rules at first, and a few pixels of fire or ice can hide a hazard; audio cues help [S9];
  - the interface shows numbers rather than plain explanations [S8];
  - the review summary ranks "unclear rules and lack of guidance" as the biggest complaint [S11].
- **The Powder Toy:**
  - complaints are a steep learning curve and no tutorial [S25];
  - on its Steam board, "am i dumb or why does oxygen gas burn" had 37 replies when checked [S24].
- **ONI:** new players feel lost and lean on outside wikis and videos [S38]. An early Steam thread called temperature management "broken"; the fixes in the replies relied on hidden rules, such as machines that always output at a fixed temperature [S35].

### F7. What mods add is readouts
- **Thermal Tooltips** (ONI, 28,304 subscribers) shows, for most items [S36]:
  - temperature, thermal conductivity, thermal mass and total heat;
  - each freeze, condense, melt or boil point, with the element it turns into.
- **Noita Utility Box** reads the game's memory to show the material IDs and amounts in your flasks and pouches [S13].
- **Jacob1's Mod**, "tpt's longest lasting and most popular mod", adds an info and statistics display and a customizable HUD [S22].
- **Peter Han's mods** add a Thermo Sensor Tile and the Thermal Interface Plate [S37].

### F8. Physics that cheats starts arguments about exploits
In ONI, heat deletion is a standing debate. In "Is 'deleting heat' an exploit?", players split [S34]:
- some avoid any heat removal they cannot explain;
- some say the physics are not perfect and it is each player's choice;
- some note that without removal, geysers would overheat every base.

The wiki keeps a whole page sorting "unusual behaviours" (intended simplifications) from "exploits" (quirks and bugs) [S33]. Mass and heat leaks become strategy, and the strategy feels like cheating to some players.

### F9. Big simulations are CPU-bound and slow down
- **Noita:** a player reports about 4 fps in one level with enemies firing. Replies point to per-pixel work, off-screen fires and a mostly-CPU game [S10].
- **ONI:** late-game lag in large colonies is the most common technical complaint [S38]. A dedicated performance mod exists (Fast Track; its claims are under "Not verified").
- **The Powder Toy:** praised for low requirements, yet "performance issues" is still its most frequent complaint [S25].

### F10. Popular mods show unmet needs
- **Co-op.** Noita's Entangled Worlds (1.3k GitHub stars) syncs players, enemies, items, "grid world pixels", fungal shifts and polymorphing [S12]. Its README does not discuss determinism or desync.
- **Moving solids.** Jacob1's Mod adds up to 256 moving solids that fall, bounce and rotate; pressure over 10 breaks them [S22]. Noita has this built in [S6].
- **Editable rules.** Sandspiel Studio [S42], The Powder Toy's Lua element packs [S23] and Sandboxels' reaction tables [S39] all let players define elements.

---

## 4. The frontier (2024–2026)

### F11. The genre is active, on Steam and in the browser
- **The Powder Toy** reached Steam in June 2024 [S23].
- **Sandboxels** lists 546 elements (version 1.11.2) and runs in a browser, on Discord and on Steam [S40].
- **Sandustry**, where "every single pixel is a simulated resource", was signed by Hooded Horse; its page lists release for 13 August 2026 [S43].
- **Noita's co-op mod** has 1.3k stars on GitHub [S12].

### F12. GPU falling sand: fragment-shader block rules, or WebGPU compute
- **sands-of-rust** runs in WebGL 1.0 fragment shaders [S44]:
  - each step uses 2×2 block rules, with the block grid offset in turn (`t mod 4`), so no cell is written twice;
  - mirror-image rules are generated automatically;
  - it ran on an iPhone 6;
  - its README warns that the rule texture grows fast as substances are added.
- **Metalrain** (version of February 2026) runs all physics in WebGPU compute shaders on a hex grid [S45]. It needs a WebGPU browser and says nothing about determinism.
- **No compute in WebGL 2.** The WebGL 2.0 Compute specification is marked obsolete; the working group moved to WebGPU [S46]. On a WebGL 2 target, GPU simulation means fragment-shader ping-pong.

### F13. What is known about determinism
- **The Powder Toy** saves its random state and an `ensureDeterminism` flag [S20]. Its heat and reactions draw from one shared random stream. So the draw a particle gets depends on how many draws came before it (an inference from the code, not a documented fact).
- **ONI's** 32-bit float temperatures lose tiny changes [S26].
- **Noita's** checkerboard threading avoids conflicts [S6]. Its co-op mod syncs the pixels themselves [S12].
- **No GPU project** opened claims identical results across machines.
- **JavaScript itself:** MDN warns that many `Math` functions have "implementation-dependent" precision, and that "different browsers can give a different result" [S47]. That matters for FIDELITY, whose sim is pure TypeScript.

### F14. Two real laws already link the floats
- **Wiedemann–Franz** [S48]: in metals, heat and electricity are both carried by free electrons, so thermal conductivity tracks electrical conductivity (κ/σ = LT). Lattice vibrations (phonons) also carry heat, and that part does not follow the law.
- **Graham's law** [S49]: a gas's effusion rate is inversely proportional to the square root of its molar mass. The article says it is only approximate for diffusion.

So "conducts heat" can come honestly from the shell (Lx) plus the lattice (Pxd), and "spreads as a gas" from mass (Vtx).

---

## 5. Mapping: where each game's property can live in the four floats

The dispatch's mapping (Plan 57 §16.1):
- **The nucleus** is Vtx (mass, density) and Pxd (lattice, grain, hardness).
- **The shell** is Lx (charge, signal, luminous excitation) and Aq (fluid and heat capacitance).

| Property (games) | Home in FIDELITY | Honest? |
|---|---|---|
| Mass, density, `Weight`, `molarMass` (all) | **Vtx** | Yes, by definition. |
| Hardness, durability, strength (all) | **Pxd** | Yes, by definition. |
| Friction, restitution (Noita types them in) | Derived from **Pxd** (pair rule for two surfaces) and **Vtx** | A game rule, not physics. Say so in appraise. |
| Electrical conductivity, `PROP_CONDUCTS`, `conduct` | **Lx** | Yes. |
| Glow when hot, photon reflection, light absorption | **Lx** | Yes. |
| Specific heat capacity, `HeatCapacity` | **Aq** | Yes, Aq is heat capacitance by the mapping. |
| Thermal conductivity, `HeatConduct` | Derived: electron part from **Lx**, lattice part from **Pxd** | Yes, with a real basis [S48]. |
| Gas diffusion and speed | Derived from **Vtx** | Approximate [S49]. |
| Viscosity, `stickyness` | Derived from **Pxd** in the liquid state | Weak. A candidate only. |
| Melting and boiling points | Derived from **Pxd** (bond) and **Vtx** | A game rule. Real elements break any simple formula. |
| State (solid, liquid, gas, powder) | Not stored. It follows from stored heat against the thresholds. | Yes. |
| Temperature | Runtime state: heat stored ÷ Aq capacitance. Not an element float. | See open question Q1. |
| Pressure (TPT air grid, ONI mass per cell) | Runtime reading: fluid mass per cell (Vtx of the fluid) | Yes, as ONI does. Not a metric. |
| Flammable, explosive, `burn`, `fire_hp` | **No home.** A reaction preset (fuel + oxidiser → products + heat). | Forcing it into a float would lie. |
| Toxicity, stains, status effects | **No home in the element.** Effects on beings, produced by reactions. | — |
| Radioactivity (ONI `radiationPer1000Mass`, TPT neutrons) | **Unclear.** It could be a high-energy Lx emission, but that stretches "light flux". | Open question Q4. |
| Colour, texture | **Not physics.** It belongs to the look (Plan 41, Plan 27). Glow colour may come from Lx. | — |
| `lifetime`, `life`, `ctype` | Runtime state of a cell | — |
| AI danger hints (Noita `danger_*`) | **Must not exist.** Natives judge danger by appraising the same values (§16.4). | — |
| Wireless channel (TPT `WIFI`) | Entanglement: a relation between two shells, not a float | A relation is not a metric. |
| Global transmutation (Noita fungal shift) | A world event over the element table, not an element property | — |

---

## 6. Proposals

### P1. An element preset is four floats and nothing else
An element is `{ id, name, vtx, pxd, lx, aq }`, plus a reference to its look (Plan 41), which carries no physics. Every other property is derived (P2).
- Store the floats as integers on a fixed scale (for example 0–10000), and show them as 0.0000–1.0000. Sums and averages are then exact on every machine (F13).

This is the dispatch's mapping made literal. It avoids Noita's and The Powder Toy's long typed-in records, where friction, bounciness and flammability can contradict each other.

### P2. One derivation card, shown in full
Write one pure function that turns four floats into every physical value a part or cell needs. Each value keeps its formula, so appraise can show it.
- density from Vtx;
- hardness from Pxd;
- friction from the two touching surfaces' Pxd (a pair rule, like ONI's geometric mean for heat [S26]);
- restitution from Pxd and Vtx;
- electrical conductivity from Lx;
- thermal conductivity from Lx (electrons) plus Pxd (lattice) [S48];
- heat capacity from Aq;
- glow from Lx and stored heat;
- gas spread from Vtx, as 1/√mass [S49], using an integer square root or a table;
- melt and boil thresholds from Pxd and Vtx.

Rules:
- Only + − × ÷ and integer operations, or tables. No `Math.exp`, `pow` or `sin` in the sim, because their precision differs between engines [S47].
- **Test oracle:** `@hm/physmat` has nine hand-typed materials (wood, rubber, ice, metal, anvil, balloon, cork, stone, jelly). A stack built for each should derive bounce, friction and density close to today's values. If one cannot, the card is wrong, or the old value was.

### P3. Stacks (rung 2) keep their recipe
A compound or alloy is a list of (element, mass share).
- **Mixing:** its four floats come from the parts by a named rule per float. Vtx and Aq are mass-weighted. Pxd and Lx are open (Q3), because real alloys can be harder, and conduct worse, than their parts.
- **Phase change keeps identity**, as all three games do in some form:
  - The Powder Toy: "METL -> LAVA(METL)" and `CarriesTypeIn` [S15][S17];
  - Noita: `_molten` versions of `[meltable]` materials [S1];
  - ONI: transition targets and by-products [S28][S29].

  Molten steel cools back into the same steel, and appraise shows what it is made of.

### P4. Reactions are data, not code
A reaction preset has:
- two inputs (elements or stacks);
- conditions on derived values (a heat band, contact, a signal present);
- two outputs;
- the heat it releases or absorbs;
- a chance.

Flammability and explosiveness live here (§5), not in the floats.

This follows Noita's `<Reaction>` with tags [S1] and Sandboxels' reaction table with chance and temperature limits [S39]. It avoids The Powder Toy's pattern, where each element's reactions are C++ in its own update function [S16]. That is powerful, but it cannot be shared as a preset.

As data, reactions can be:
- edited in the Studio with live previews (Sandspiel Studio is the precedent [S42]);
- read and proposed by outside agents (Plan 40);
- shared as codes.

### P5. Conserve mass and heat exactly
- Mass and heat are integers. A transfer moves whole units, and remainders are carried, never deleted.
- A test sums both over the world every tick.
- Phase changes use a hysteresis band, as ONI does (3 K past the point, then 1.5 K back [S28]), so cells do not flicker. Appraise states both edges.
- Latent heat is optional (Q5). The Powder Toy shows none in the code read [S20].

**Why:** ONI's leaks turned into exploit debates [S33][S34], and tiny float changes vanish [S26]. FIDELITY has a harder reason as well: natives live by the same rules (§16.4), so a leak is a hidden rule. And the appraise lens must never show a number the world does not keep.

### P6. Deterministic by construction
- **No shared random stream.** Every chance is a hash of (world seed, cell, tick, reaction id). The result does not depend on update order, unlike a single stream such as The Powder Toy's [S20].
- **A fixed update order** that never moves a cell twice in one step. Use either a double-buffered pass, or 2×2 blocks with alternating offsets as sands-of-rust does [S44]. Sandspiel needs a clock byte because it scans in place [S41].
- **The authoritative simulation runs on the CPU**, in a pure package. The GPU draws only (plumes, dither, stage looks):
  - WebGL 2 has no compute shaders [S46];
  - no GPU engine found claims identical results across machines (F13).

### P7. Simulate only what matters, and coarsely
FIDELITY is not a falling-sand game. Three tiers:
1. **Parts** (rigid bodies): the element stack gives `@hm/physmat` values (P2). No cells.
2. **Plot fields:** a coarse per-cell grid for water, heat and gas where machines run. It follows ONI's model: one element per cell, with mass and heat [S30][S31]. `@hm/hydro` already decides where water lies.
3. **Looks:** shaders read the field and never write it.

Borrow Noita's chunks with dirty rects [S6]: a region sleeps until something in it changes.

For the memory budget, Sandspiel's 4 bytes per cell [S41] puts a 256×256 field at 256 KiB. Measure on the GTX 950M laptop before fixing any grid size.

### P8. One appraise lens for player, natives and drone
Hovering any element, stack or part shows:
- its four floats;
- each derived value with its formula (P2);
- each phase threshold, with what it becomes (the Thermal Tooltips pattern [S36]);
- the reactions it can have with what it touches.

The same function feeds what natives and the drone perceive (§16.4). There are no AI-only hints like Noita's `danger_*` flags [S1].

**Precision rises with the stage.** At Stage 0, appraise shows bands (low, mid, high); later stages show more digits. The value underneath is always the same: coarser, never different. This fits §16.3's LitRPG appraisal and §16.4's natives gaining senses as fidelity rises.

### P9. Signals ride on Lx; logic stays in the wiregraph
Plasma's logic stays in `@hm/wiregraph` (§16.2). A part's element Lx decides three things:
- whether it carries a signal;
- how much signal it loses;
- how much it warms while carrying it (The Powder Toy warms sparked metals [S18]).

Low-Lx materials insulate.

Do not build a cell-level spark simulation now. The Powder Toy's electronics are deep, but complexity and the learning curve are among its main complaints [S25]. A travelling pulse with a recovery time [S18] could come later as an advanced Studio toy.

### P10. Entanglement is a pair binding, not a broadcast channel
The Powder Toy's `WIFI` shares one flag per temperature channel: anyone on the channel hears everything [S19]. FIDELITY's entanglement (§16.1) binds two named shells instead:
- appraise shows both ends;
- it carries an Lx signal and adds no float;
- binding to a native mind needs that native's yes (§16.4, "No one is possessed").

### P11. Chaos you can read
Noita's unfair-feeling deaths come from hazards the player could not read [S8][S9]. So:
- the first time a reaction happens near the player, the System (§8.1) names it;
- it goes into a discovery log, which feeds the completionist feel of §16.3;
- sound and visual cues scale with the danger appraise computes, as Noita's audio cues help [S9].

### P12. Few atoms; variety from stacks and reactions
The Powder Toy has 258 elements and Sandboxels 546, and newcomers find The Powder Toy hard to learn [S25]. Start with a small set of atoms that spans the corners of the four-float space (a starting guess: 8 to 16), and let stacks and reactions give the variety. Sandboxels hides 228 elements until they are found [S40], which suits discovery.

### P13. Co-op leans on determinism
Noita's most-starred mod adds co-op and syncs the world's pixels [S12]. Plan 57's multiplayer sandbox can rely on P6 instead:
- every client runs the same element field;
- a per-tick hash of the field catches desync;
- sending field state stays the fallback.

### P14. Keep out what has no honest home
The following stay out of the element:
- flammability and explosiveness (reactions, P4);
- toxicity, stains and status effects (effects on beings, produced by reactions);
- colour (the look);
- world-wide transmutation (a world event).

Radioactivity waits for the owner (Q4). Nothing becomes a fifth float.

---

## 7. Open questions for the owner and Argon
- **Q1. Is a cell's stored heat allowed as runtime state?** The proposal treats temperature as heat stored on Aq's capacitance, the way a signal's voltage sits on Lx: state, not a metric. It sits close to the constitution, so it needs the owner's yes.
- **Q2. Units.** ONI and Sandboxels show real-world units; The Powder Toy shows abstract numbers. Should appraise show derived values in kg/m³ and °C, or only as 0–1?
- **Q3. Mixing rules** for Pxd and Lx in stacks (P3).
- **Q4. Radioactivity:** in, as part of Lx, or out?
- **Q5. Latent heat:** should melting absorb heat and freezing release it (P5)?
- **Q6. How does matter add up to a plot's S?** §16.1 says the plot's floats are what its matter adds up to. Which matter counts (terrain, machines, water), and how is it summed (a mass-weighted mean)?

---

## 8. Not verified
- **The Powder Toy wiki** (powdertoy.co.uk/Wiki) returned an access-denied page from bot protection. Field meanings above come from the source code and its names, not official documentation. The exact `CELL` size of the air grid was not in the code read. Whether loading a save restores the random state was not seen.
- **Fast Track** (ONI performance mod): its claimed late-game gain of 40% or more appeared only in search snippets. The Klei forum thread returned 403, and no Steam page for it was found. Only its folder in Peter Han's repository was opened.
- **Klei forum thread** on steam-turbine heat deletion: 403, not read.
- **"am i dumb or why does oxygen gas burn"** (The Powder Toy Steam board): only the title and reply count were seen. The thread itself could not be opened.
- **Noita:**
  - whether Noita keeps a per-pixel temperature is not stated on the pages opened;
  - `warmth_melts_to_material` and `cold_freezes_to_material` are named on the wiki without explanation;
  - how charge spreads is not explained on the pages opened.
- **GDC 2019 talk** "Exploring the Tech and Design of Noita": not watched. The 80.lv interview with the same developer was used instead.
- **Sandboxels Steam Edition release date** (May 2025 in a Product Hunt snippet): not opened. The wiki page gives no date.
- **TAGIT TR-18** (a 3D falling-sand report said to conserve matter): the PDF could not be read.
- **Vaporlens** summaries [S11][S25][S38] do not state their method. They are used only where opened reviews or threads agree.
- **Thermal Tooltips authorship:** the Steam page names "Stephen", and the mod is also listed in Peter Han's ONIMods repository. No author is claimed here.

---

## Sources

**Noita**
- [S1] [Modding: Making a custom material (noita.wiki.gg)](https://noita.wiki.gg/wiki/Modding:_Making_a_custom_material)
- [S2] [Materials (noita.wiki.gg)](https://noita.wiki.gg/wiki/Materials)
- [S3] [Electricity (noita.wiki.gg)](https://noita.wiki.gg/wiki/Electricity)
- [S4] [Fire (noita.wiki.gg)](https://noita.wiki.gg/wiki/Fire)
- [S5] [Fungal Shift (noita.wiki.gg)](https://noita.wiki.gg/wiki/Fungal_Shift)
- [S6] [Noita: a game based on falling sand simulation (80.lv interview with Petri Purho, 2019)](https://80.lv/articles/noita-a-game-based-on-falling-sand-simulation/)
- [S7] [Falling Sand Game (noita.wiki.gg)](https://noita.wiki.gg/wiki/Falling_Sand_Game)
- [S8] [Noita review (GameCritics, Mike Suskie)](https://gamecritics.com/mike-suskie/noita-review/)
- [S9] [Review: Noita (Hardcore Gamer)](https://hardcoregamer.com/reviews/review-noita/389883/)
- [S10] [Steam: "why is the frame rate so horrible in this?"](https://steamcommunity.com/app/881100/discussions/0/3041605810459500856)
- [S11] [Noita review summary (Vaporlens)](https://vaporlens.app/app/881100/noita.md)
- [S12] [Noita Entangled Worlds (GitHub)](https://github.com/IntQuant/noita_entangled_worlds)
- [S13] [Noita Utility Box](https://tangled.org/necauq.ua/noita-utility-box)

**The Powder Toy**
- [S14] [The Powder Toy (Wikipedia)](https://en.wikipedia.org/wiki/The_Powder_Toy)
- [S15] [Element.h (source)](https://raw.githubusercontent.com/The-Powder-Toy/The-Powder-Toy/master/src/simulation/Element.h)
- [S16] [WATR.cpp (source)](https://raw.githubusercontent.com/The-Powder-Toy/The-Powder-Toy/master/src/simulation/elements/WATR.cpp)
- [S17] [METL.cpp (source)](https://raw.githubusercontent.com/The-Powder-Toy/The-Powder-Toy/master/src/simulation/elements/METL.cpp)
- [S18] [SPRK.cpp (source)](https://raw.githubusercontent.com/The-Powder-Toy/The-Powder-Toy/master/src/simulation/elements/SPRK.cpp)
- [S19] [WIFI.cpp (source)](https://raw.githubusercontent.com/The-Powder-Toy/The-Powder-Toy/master/src/simulation/elements/WIFI.cpp)
- [S20] [Simulation.cpp (source)](https://raw.githubusercontent.com/The-Powder-Toy/The-Powder-Toy/master/src/simulation/Simulation.cpp)
- [S21] [Air.cpp (source)](https://raw.githubusercontent.com/The-Powder-Toy/The-Powder-Toy/master/src/simulation/Air.cpp)
- [S22] [Jacob1's Mod (GitHub)](https://github.com/jacob1/The-Powder-Toy)
- [S23] [The Powder Toy is now on Steam (GamingOnLinux, June 2024)](https://www.gamingonlinux.com/2024/06/classic-free-physics-sandbox-game-the-powder-toy-is-now-on-steam/)
- [S24] [The Powder Toy Steam discussions board](https://steamcommunity.com/app/1148350/discussions/)
- [S25] [The Powder Toy review summary (Vaporlens)](https://vaporlens.app/app/1148350/the_powder_toy.md)

**Oxygen Not Included**
- [S26] [Thermal Conductivity (oxygennotincluded.wiki.gg)](https://oxygennotincluded.wiki.gg/wiki/Thermal_Conductivity)
- [S27] [Specific Heat Capacity (oxygennotincluded.wiki.gg)](https://oxygennotincluded.wiki.gg/wiki/Specific_Heat_Capacity)
- [S28] [Elements (oxygennotincluded.wiki.gg)](https://oxygennotincluded.wiki.gg/wiki/Elements)
- [S29] [Module:Data/solid (oxygennotincluded.wiki.gg)](https://oxygennotincluded.wiki.gg/wiki/Module:Data/solid)
- [S30] [Liquid (oxygennotincluded.wiki.gg)](https://oxygennotincluded.wiki.gg/wiki/Liquid)
- [S31] [Gas (oxygennotincluded.wiki.gg)](https://oxygennotincluded.wiki.gg/wiki/Gas)
- [S32] [Hidden Mechanics (oxygennotincluded.wiki.gg)](https://oxygennotincluded.wiki.gg/wiki/Hidden_Mechanics)
- [S33] [Exploits (oxygennotincluded.wiki.gg)](https://oxygennotincluded.wiki.gg/wiki/Exploits)
- [S34] [Steam: "Is 'deleting heat' an exploit?"](https://steamcommunity.com/app/457140/discussions/0/1735506744739141980)
- [S35] [Steam: "Thermo regulator useless"](https://steamcommunity.com/app/457140/discussions/0/2549465882917417865)
- [S36] [Thermal Tooltips (Steam Workshop)](https://steamcommunity.com/sharedfiles/filedetails/?id=1983504552)
- [S37] [Peter Han's ONIMods (GitHub)](https://github.com/peterhaneve/ONIMods)
- [S38] [Oxygen Not Included review summary (Vaporlens)](https://vaporlens.app/app/457140/oxygen_not_included.md)

**The rest of the category, and the frontier**
- [S39] [Sandboxels: element properties list (sandboxels.wiki.gg)](https://sandboxels.wiki.gg/wiki/Modding/Element_properties/List)
- [S40] [Sandboxels (sandboxels.wiki.gg)](https://sandboxels.wiki.gg/wiki/Sandboxels)
- [S41] [Making Sandspiel (Max Bittker, 2019)](https://maxbittker.com/making-sandspiel)
- [S42] [Lu Wilson's portfolio: Sandspiel Studio (2022)](https://www.todepond.com/portfolio)
- [S43] [Sandustry: every single pixel is a simulated resource (GamingOnLinux, June 2025)](https://www.gamingonlinux.com/2025/06/in-the-side-scroller-automation-game-sandustry-every-single-pixel-is-a-simulated-resource/)
- [S44] [sands-of-rust (GitHub)](https://github.com/wg-romank/sands-of-rust)
- [S45] [Metalrain GPU Tests (itch.io)](https://metalraindev.itch.io/metalrain-gpu-tests)
- [S46] [WebGL 2.0 Compute specification, marked obsolete (Khronos)](https://registry.khronos.org/webgl/specs/latest/2.0-compute/)
- [S47] [Math (MDN): implementation-dependent precision](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math)

**Physics references**
- [S48] [Wiedemann–Franz law (Wikipedia)](https://en.wikipedia.org/wiki/Wiedemann%E2%80%93Franz_law)
- [S49] [Graham's law (Wikipedia)](https://en.wikipedia.org/wiki/Graham%27s_law)
