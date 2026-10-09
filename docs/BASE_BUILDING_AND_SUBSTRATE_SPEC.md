# FIDELITY // BASE-BUILDING, SUBSTRATE HARVESTING & LINKED STORAGE SPECIFICATION
> **Status**: Pinned Immediate Next Milestone  
> **Directive Origin**: Verbatim Owner Mandate (2026-10-09)  
> **Inspirations**: *Valheim*, *Dune: Awakening*, *Space Engineers*, *The Planet Crafter*  

---

## 1. ARCHITECTURAL PHILOSOPHY: FROM MACHINE SPAM TO FREEFORM ENGINEERING

### The Problem With Machine Spam
In early terraforming prototypes, raising world metrics required placing dozens of identical small machines across the landscape. The owner has explicitly rejected this pattern:
> *"No chimney, no machine spam. Machines must be heavier, more expensive, and dramatically more efficient. Players should build with structural freedom."*

### The New Paradigm
1. **High-Yield Industrial Terraformers**: Terraformers are massive, heavy industrial installations requiring significant resources, substantial power, and structured base foundations. A single tuned installation produces the output of fifty prototype machines.
2. **Freeform Base Architecture**: Players construct modular physical bases using snap-socketed structural components (foundations, pillars, walls, airlocks, ramps, and roof vaults).
3. **Sealed Atmospheric Enclaves**: Bases with complete sealed enclosures provide pressurized life-support, eliminating sync-drain and shielding players from harsh lunar conditions.

---

## 2. STRUCTURAL CONSTRUCTION SYSTEM (VALHEIM / DUNE STYLE)

```
┌────────────────────────────────────────────────────────────────────────┐
│                   STRUCTURAL PIECE TAXONOMY & SOCKETS                  │
├─────────────────────┬─────────────────────┬────────────────────────────┤
│ FOUNDATIONS         │ ENCLOSURES          │ SOCKETS & HARDPOINTS       │
│ • Heavy Slab (4x4m) │ • Structural Wall   │ • Heavy Terraformer Socket │
│ • Raised Pillar     │ • Reinforced Airlock│ • Power Conduit Hardpoint  │
│ • Grid Framework    │ • Sloped Roof Ramp  │ • Storage Trunk Sockets    │
└─────────────────────┴─────────────────────┴────────────────────────────┘
```

### Snapping & Stability Model
- **Cardinal Socket Snapping**: Building pieces expose male/female connection sockets along edges and corners. When holding a blueprint piece, pointing near an existing socket snaps the hologram with 0.1m precision.
- **Structural Integrity**: Foundations anchored to lunar bedrock provide maximum load support. Each successive cantilevered piece computes structural stability; overextended pieces fracture unless supported by columns or arches.
- **Surface Conformance**: Foundations project leveling skirts downward into the terrain mesh, eliminating floating gaps regardless of terrain slope.

---

## 3. SUBSTRATE RESOURCE HARVESTING & MATERIAL SYNTHESIS

Rather than mining generic ores, the player directly harvests the mathematical substrate of reality:

### The Two Fundamental Substrates
1. **Raw Pixels ($\text{Pxd}$)**:
   - Harvested from chromatic anomalies, corrupted dither zones, and terraformed biomes using the Extraction Rifle.
   - Refined at the **Texture Mill** into **Procedural Material Texture Maps** (Regolith Basalt, Polished Obsidian, Reflective Quartz, Luminescent Moss).
2. **Raw Geometry Vertices ($\text{Vtx}$)**:
   - Extracted from terrain topological folds, crystal spires, and geomorphic rifts.
   - Refined at the **Shape Press** into **3D Geometric Primitives** (Structural Cubes, Cylindrical Columns, Chamfered Beams, Chassis Frameworks).

### The Drafting Table & Blueprint Synthesis
- In the base or lab, players interact with the **Drafting Table**.
- The player combines Geometric Primitives + Texture Maps to engineer custom structural parts and functional blueprints:
  $$\text{Primitive } [\text{Structural Cube}] + \text{Texture Map } [\text{Basalt Ceramic}] \longrightarrow \text{Blueprint } [\text{Reinforced Foundation}]$$
- Blueprints can be saved, hotkeyed to the build hotbar, and exported to the Community Nexus.

---

## 4. LINKED QUANTUM BRIDGE STORAGE

### The Inter-Dimensional Shared Inventory
- Manual inventory management and running between storage chests is completely eliminated.
- Utilizing the laboratory's quantum bridge technology, all physical storage containers constructed within a base perimeter link into a single **Unified Quantum Storage Lattice**.
- **Automatic Crafting Pull**: Fabricator benches, Drafting Tables, and refinery machines automatically draw required ingredients from the linked storage network without requiring manual item transfer.
- **Range & Expansion**: Linking is maintained via base power grid relays. Placing Quantum Repeater Pylons extends the shared storage perimeter across multiple outposts.

---

## 5. PLAYER INVENTORY & HOTBAR ARCHITECTURE

- **Grid Inventory (E key)**: Clean, slot-based grid inventory with weight limits, stack counts, and material categorizations.
- **Active Hotbar (1–9 keys)**: Quick-access action slots for tools, weapons, and active building blueprints.
- **Equipment Slots**: Dedicated armor/suit slots (Visor, Shield Generator, Oxygen Rebreather, Extraction Beam, Sidearm).

---

## 6. IN-GAME VEHICLE & WEAPON FABRICATION

1. **In-Game Fabricator Benches**:
   - Rovers, mining drones, and weapons are researched and manufactured directly in-game using synthesized substrate blueprints.
2. **The Workshop Customizer**:
   - In The Workshop, players can skin their fabricated rovers using imported community meshes (`.glb`, `.fbx`, `.md2`), customizing tire slip, suspension height, and livery colors.
