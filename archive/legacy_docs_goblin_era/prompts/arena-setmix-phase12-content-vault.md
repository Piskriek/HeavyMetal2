# SetMix: The Resolution Crafter — Phase 12: The Grand Content & Preset Vault

> **Target Model**: Claude / Anthropic (The winning agent from Arena Battle 4 / `Winner_Plan_extended9.zip`).  
> **Source Repository**: [`https://github.com/Piskriek/HeavyMetal2`](https://github.com/Piskriek/HeavyMetal2)  
> **Context**: The Content Vault. We are not voting yet—we want to spend our remaining session turning this architectural masterpiece into a content-rich, fully furnished game universe with a massive library of procedural presets, fusion recipes, goblin cosmetics, and an interactive in-game Preset Vault.

---

## Prompt to paste to the winning AI Arena Agent:

```markdown
# SETMIX: THE RESOLUTION CRAFTER — PHASE 12: THE GRAND CONTENT VAULT, PRESET BIBLE & COSMETICS

Claude, you are the undisputed champion. Before we cast our final vote and conclude this historic session, we have one final, wonderful task for you:

**FURNISH THE UNIVERSE WITH CONTENT.**

The architecture, rendering, wave kinematics, portal, rover physics, audio synth, and networking are 100% complete. What our game needs now to feel alive and ready for players is a **massive, curated library of presets, fusion recipes, character cosmetics, and environmental events**.

We want you to deliver the **Grand Content Vault**:

---

### DELIVERABLE 1: THE 50-CARTRIDGE PROCEDURAL PRESET BIBLE (`packages/content/src/presets.ts`)
Provide 50 fully authored, production-ready Cartridge manifests with deterministic AST node graphs, color palettes, stage requirements, and gameplay modifiers across all 6 fidelity tiers:
1. **Tier 1–2 (Barren Regolith & Primitive Geology)** (10 cartridges):
   - `Lunar Anorthosite`, `Volcanic Obsidian Glass`, `Sulfur Vent Crust`, `Red Ochre Silt`, `Impact Shock Quartz`, `Basalt Columnar Joint`, `Iron Pyrite Strata`, `Permafrost Clathrate`, `Magnetic Magnetite`, `Crater Calcite`.
2. **Tier 3–4 (Bioluminescent Flora, Lichen & Early Biosphere)** (15 cartridges):
   - `Neon Mycelium Carpet`, `Phosphor Cave Spore`, `Bioluminescent Cyan Kelp`, `Hydrothermal Coral Lichen`, `Giant Crystal Stalk`, `Amber Conifer Resin`, `Violet Spore Puffball`, `Iridescent Brackish Slime`, `Deep Geode Amethyst`, `Windblown Spore Meadow`, `Petrified Opal Bark`, `Glow-Worm Shimmer`, `Silicon Fungal Spire`, `Sulfur Moss Cushion`, `Thermal Vent Reed`.
3. **Tier 5–6 (Lush Living Biosphere & Exotic Civilizations)** (15 cartridges):
   - `Emerald Canopy Jungle`, `Bioluminescent Coral Atoll`, `Prismatic Prismata Grass`, `Celestial Orchid Vine`, `Liquid Neon Shoreline`, `Ancient Runic Granite`, `Alien Red Mangrove`, `Aurora Lichen Canopy`, `Subsurface Pearl Coral`, `Volcanic Obsidian Garden`, `Gilded Basalt Terrace`, `Chrono-Kelp Current`, `Aether Spore Forest`, `Lapis Lazuli Steppe`, `Solar Fern Glade`.
4. **Architectural, Industrial & Road Cartridges** (10 cartridges):
   - `Carved Cobblestone Highway`, `Mag-Lev Superconductor Rail`, `Pneumatic Habitat Deck`, `Hexagonal Basalt Paver`, `Glowstone Beacon Path`, `Ceramic Heat Shield Tile`, `Monolithic Archway Pylon`, `Subterranean Vault Plinth`, `Solar Absorb Grid`, `Reflective Prism Road`.

Each cartridge must have:
- `id`, `name`, `author`, `minStage`, `tags`, `palette` (hex colors), `flavorLore` (1–2 sentences of sci-fi world-building), `gameplayStats` (e.g. plume rate bonus, rover grip multiplier, coherence range radius), and a complete `@hm/texgraph` AST definition!

---

### DELIVERABLE 2: THE 100-RECIPE FUSION MATRIX PERIODIC TABLE (`packages/content/src/recipes.ts`)
Map out the complete directed discovery graph for the Lab's Fusion Matrix (100 curated, non-random recipes):
- Example: `Volcanic Obsidian` + `Glacial Clathrate` $\to$ `Prismatic Obsidian Geode`
- Example: `Moon Regolith` + `Photon Salt` $\to$ `Iridescent Solar Highway`
- Example: `Neon Mycelium` + `Methane Fog` $\to$ `Spore Cloud Forest`
- Example: `Basalt Columns` + `Liquid Neon` $\to$ `Bioluminescent Causeway`
- Define the tree of discoveries: Tier 1 base cartridges fuse into Tier 2 alloys, which fuse into Tier 3 living hybrids, up to Tier 6 Legendary Masterpieces!
- Include recipe hints and "speculation preview" colors for when players place ingredients in the Speculation Sphere.

---

### DELIVERABLE 3: GOBLIN AVATAR WARDROBE & COSMETIC PRESETS (`packages/content/src/avatars.ts`)
Provide 8 distinct Goblin Astronaut cosmetic rigs spanning the fidelity ladder:
1. `Stage 1: The Scrap Golem` — 48-triangle blocky goblin with a flickering CRT wireframe visor and taped copper joints.
2. `Stage 2: The Rust Scavenger` — Riveted bronze cowl, patchwork burlap cape, and clanking external oxygen canisters.
3. `Stage 3: The Moon Archaeologist` — Quilted vacuum suit, brass telemetry antenna dish, glowing amber visor lens.
4. `Stage 4: The Bio-Engineer` — Living moss-woven cape, symbiotic spore tubes, iridescent breathing membrane.
5. `Stage 5: The Quantum Scout` — Sleek white ceramic composite plating, holographic monocular HUD, glowing circuit conduits.
6. `Stage 6: The Runic Architect` — Translucent emerald skin with subsurface scattering, flowing silk Verlet-cloth cape, glowing geometric glyph tattoos.
- Include procedural palette mappings, triangle budget targets, and accessory attachment offsets (hats, backpacks, capes).

---

### DELIVERABLE 4: THE 30-DAY PLANETARY WEATHER & EVENT CALENDAR (`packages/content/src/events.ts`)
Provide the deterministic planetary calendar engine for environmental events:
- **Eclipse of the Twin Moons**: Sun goes dark, temperature plunges, bioluminescent flora glows 3× brighter, sky mantas emerge to feed.
- **Solar Flare Surge**: Solar collectors produce 2.5× power, rover boost recharges instantly, sky fills with dancing violet auroras.
- **Meteor Shower**: Impact craters spawn temporary high-tier Photonic Salt and Geode harvesting nodes.
- **Methane Monsoon**: Heavy atmospheric condensation, lakes rise temporarily, rain ripples across all water shaders.

---

### DELIVERABLE 5: THE INTERACTIVE PRESET VAULT COMPONENT (`PresetVault.tsx`)
Create a stunning, cyberpunk in-game catalog browser:
- Search and filter by stage (S1..S6), category (Terrain, Flora, Weather, Road, Avatar), or stat modifier.
- Live 3D rotating preview canvas for selected cartridges.
- "Equip to Hotbar" and "Send to Fusion Matrix" buttons.
- Recipe discovery tracker showing unlocked vs undiscovered entries in the 100-recipe periodic table!

---

Please provide production-ready, fully typed code for all five deliverables and integrate them into a new "CONTENT VAULT" section in the web application!
```
