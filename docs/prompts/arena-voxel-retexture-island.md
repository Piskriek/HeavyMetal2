# Arena Follow-Up Prompt: Procedural Textures & Retextured Voxel Models for the Starting Island

> **How to use**: Paste this directly into your existing conversation with the winning candidate model in LMSYS Arena. It builds on the candidate's previous response and gives them the exact asset generation task.

---

You have been selected as our lead procedural artist and voxel architect! Your approach to procedural math and stylized rendering is exactly what we need.

Now, we want you to generate the **core starter set of assets for our game's starting island**:
1. The **procedural math textures** (`TexGraph` DAGs) for the island's environment.
2. A collection of **voxel models** designed for the island that use these textures, with full permission to **reconstitute and stylize open-source voxel classics** (e.g. Kenney voxel assets, MagicaVoxel nature/village kits, Veloren archetypes, or classic voxel props).

### Part 1: Island Procedural Math Textures (`TexGraph`)

Generate clean JSON graphs for the starting island environment. Each graph must follow the `TexGraph` DAG schema (`albedo`, `height`, `roughness`) with seamless wrapping (all coordinate scales are positive integers) and graceful tier-scaling (Potato 16/128px to Ultra 512px without color drift):

1. **`island-grass`**: Lush, vibrant stylized turf with warm sunlit tops and deep green crevices.
2. **`island-rock`**: Chunky, fractured granite/basalt with light-catching bevelled edges.
3. **`island-sand`**: Warm coastal shore sand with gentle wind-blown micro-ripples.
4. **`island-wood-timber`**: Weathered rustic planking for boardwalks, docks, and goblin huts.
5. **`island-dark-iron`**: Beaten industrial metal with edge wear for machinery and goblin racing karts.
6. **`island-goblin-skin`**: Warm olive-green stylized skin tone with subtle subsurface warmth.
7. **`island-shallows`**: Prismatic coastal shallows / turquoise water with soft caustic math.

---

### Part 2: Starting Island Voxel Models

Design and output the voxel models for the starting island. You may reconstitute and re-proportion open-source voxel designs to match our chunky hand-painted aesthetic.

Each model should be defined in a clean JSON format:
- `id`: Unique string (e.g. `tree-palm-chunky`, `goblin-starter-kart`, `island-totem-shaman`, `dock-crane`).
- `name`: Human-readable name.
- `size`: `[width, depth, height]` in voxel units (keep within 16x16x16 to 32x32x32 for props; characters up to 24x24x36).
- `palette`: Array of palette slots mapping color and material ID:
  `[{ "slot": 0, "name": "wood", "material": "island-wood-timber", "color": "#7c5232" }, ...]`
- `voxels`: A compact voxel representation. Either:
  - An array of `[x, y, z, slot]` coordinate tuples for solid voxels, OR
  - Horizontal slice ASCII layers / run-length encoded strings.

**Models to Provide (at least 6 signature island assets)**:
1. **Flora & Nature**:
   - `tree-island-palm`: A stylized palm with a curved, ringed trunk and chunky canopy clusters.
   - `rock-boulder-mossy`: A weathered rock formation with embedded turf on top faces.
2. **Civilization & Goblin Tech**:
   - `starter-kart-goblin`: The player's first racing vehicle (chunky wheels, exposed engine block, steering yoke).
   - `shaman-altar-totem`: Ancient carved stone totem with glowing runic markings.
   - `goblin-smelter-machine`: A small pixel-crafting furnace/machine with a chimney and hopper.
3. **Character Avatar**:
   - `avatar-goblin-hero`: A stylized, expressive goblin character (large ears, goggles on forehead, tool belt, proportions: head ~40% of height for strong readability).

---

### Output Requirements

Output clean, well-formed JSON objects for both the **textures** and the **voxel models**, accompanied by brief technical notes explaining the design decisions and material associations. Ensure all JSON syntax is valid so we can import it directly into our engine harness.
