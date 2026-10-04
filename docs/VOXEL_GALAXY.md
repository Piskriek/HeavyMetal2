# VOXEL GALAXY: Streaming Minecraft, Roblox & Open-Source Worlds

> **FOR THE MAIN CLAUDE SESSION:**  
> This is a **new strategic architectural proposal** from the owner (2026-10-04, 19:13).  
> **DO NOT execute or start coding this now.** Do not divert from your current work schedule (hotbar V3 glue, D20 dither, and the questline in `docs/QUESTLINE.md`).  
> This document is for your planning, mental model, and future universe expansion milestones (H8/H11). Review it, consider its implications, and schedule it when the galaxy and universe architecture is reached.

---

> **Update, 2026-10-04 (owner, later):** "lets make it possible to bring in the voxel models from other games so the user can bring them in themselves ... a machine then hook it up to a portal and then step into voxel worlds on the other side, ill find an opensource one they can connect to the first time and then do their own research". So the first step is player-driven: the Importer machine, portals, the owner's first open-source world. Planned in `RELEASE_PLAN.md` Milestone 2 and `QUESTLINE.md` chapter 3. The curated galaxy below stays later (H11).

## 1. The Owner's Vision (2026-10-04, 19:13)

> *"im thinking we have another galaxy? voxel galaxy where you can find all the big minecraft, roblox, voxel builds and explore them and on those worlds the preset suggestions link to opensource voxel content"*
> *"is there a way to link to the builds and stream the content instead of downloading it all?"*

The SetMix universe expands from a single galaxy into a **Multiverse with two sister galaxies**:
1. **The SetMix Galaxy** (Current Hub):
   - The player's home solar system (their island, base, pixel mining, machines, rocket launchpad).
   - Goblin Racing's solar system and creator star systems.
2. **The Voxel Galaxy** (The Explorer's Paradise):
   - Dedicated galaxy showcasing the world's most epic voxel builds (Minecraft Middle-Earth, Westeros, Greenfield, Roblox showcases, Veloren realms).
   - **Zero Bulk Downloads**: Worlds stream on-demand using HTTP Range requests on standard `.mca` chunk region files.
   - **Living Preset Ecosystem**: When exploring these worlds, the hotbar and preset shelves display **contextual preset suggestions** linking directly to open-source voxel assets (Kenney CC0 kits, Veloren props, MagicaVoxel modular sets).

---

## 2. Streaming Architecture (Zero-Server, Zero-Bulk Download)

The key question: *Can a browser explore a 30 GB Minecraft Middle-Earth build without downloading 30 GB?*
**Yes.** We stream chunks on-demand identical to how a Minecraft client or Google Earth operates.

### The Mechanism: HTTP Range Requests on Anvil Region Files (`.mca`)
Minecraft divides worlds into region files (`r.X.Z.mca`), each containing 32 × 32 chunks (512 × 512 blocks).
1. **The 4 KB Header Table**:
   - The first 4,096 bytes of every `.mca` file contain a compact offset lookup table: exact byte positions and lengths of all 1,024 chunks.
2. **On-Demand Fetching via HTTP Range**:
   - When entering a world, the browser fetches *only* the 4 KB header:
     `fetch(regionUrl, { headers: { Range: 'bytes=0-4095' } })`
   - As the player moves, SetMix queries the table and issues lightweight requests (20 KB–60 KB each) *only for the chunks within viewing radius*.
   - A player walking through Minas Tirith downloads **5–15 MB total**, not 30 GB.
3. **Local Cache**:
   - Chunks are stored in browser `CacheStorage` / IndexedDB. Revisiting an area costs 0 network bytes.
4. **Spatial LOD (Level-of-Detail)**:
   - For distant horizons, a pre-computed low-poly mesh (e.g. 500 KB for all of Mount Doom or Minas Tirith) renders far away, transitioning into voxel chunks as the player approaches.

---

## 3. The Content Catalog in the Voxel Galaxy

| Star System / World | Origin | What Players Explore | Preset Suggestions Featured |
|---|---|---|---|
| **Middle-Earth** | MCME / Tolkien Community | Minas Tirith, Helm's Deep, Bag End, Rivendell, Moria | Medieval timber framing, stone bricks, gothic arches, fantasy taverns |
| **Westeros** | WesterosCraft Community | King's Landing, Winterfell, The Wall | Castle battlements, iron portcullises, cobblestones, banners |
| **Kenney Space Outpost** | Kenney.nl (CC0) | Modular lunar station, solar arrays, orbital rovers | CC0 sci-fi corridors, thrusters, solar panels, airlocks |
| **Veloren Fantasy Realm** | Veloren (CC-BY-SA) | Ancient ruins, dungeon catacombs, crystal caverns | Bioluminescent flora, glowing crystal nodes, ancient obelisks |
| **Roblox Classic Showcase** | Roblox Archive (`.rbxmx`) | Retro Crossroads, vintage obbies, classic stud architecture | Stud blocks, neon glowing bricks, truss ladders |

---

## 4. Preset Suggestions Linked to Open-Source Content

When a player walks on a world in the Voxel Galaxy:
- **Contextual Shelf**: The **F9 Things** or **E Presets** tab detects the world type (e.g. `tag: sci-fi`, `tag: medieval`, `tag: tolkien`).
- **Open-Source Palette**: The shelf highlights ready-made presets derived from CC0/open-source libraries:
  - Inside a medieval fortress ➔ suggests Kenney Castle props, Veloren wooden furniture, iron lanterns.
  - Inside a space station ➔ suggests Kenney Space modules, NASA probe parts, robotic arms.
- **Inspect & Learn**: Players can use the V3 tool **Carve / Paint a thing** on any structure, duplicate parts into their own inventory, save them as their own presets, and bring them back to their home island in the SetMix Galaxy.

---

## 5. Heavy Lifting via Arena Battle AIs

When we are ready to implement this, the heavy lifting of writing binary decoders should be delegated to pure Arena battle models:

1. **`@hm/nbt`**:
   - Pure TypeScript, zero-dependency streaming NBT parser + Gzip decompressor (`DecompressionStream`).
   - Reads Big/Little Endian compounds in under 200 lines.
2. **`@hm/schematic`**:
   - Sponge `.schem` + Legacy MCEdit `.schematic` + Vanilla Structure `.nbt` converter.
   - Outputs standard SetMix `VoxelModel` objects.
3. **`@hm/chunk-streamer`**:
   - Reads `.mca` region headers over HTTP Range requests.
   - Manages chunk LRU cache, priority queues based on camera distance, and mesh generation.
4. **`@hm/vox`**:
   - Native MagicaVoxel binary reader for all Kenney and voxel community assets.
5. **`@hm/roblox-xml`**:
   - DOMParser-based `.rbxmx` XML translator converting Roblox Parts into SetMix voxel structures.

---

## 6. Strategic Takeaway for the Integrator

- **Status**: Kept as an architectural plan (`H11`) under `docs/STATUS.md`.
- **Current Priority**: Keep momentum on the active hotbar V3 tasks, D20 dither, and the base questline.
- **When to Open**: When reaching the Universe/Galaxy expansion milestone (`H8`/`H11`).

---

## 7. The main session's considerations (2026-10-04, evening; not scheduled, as asked)

Read and kept off the active plan. What I would settle before any of it is built:

1. **Rights decide the catalog, not the tech.**
   - Kenney is CC0: safe to ship and to sell things made from it.
   - Veloren's art is share-alike (CC-BY-SA). Anything made from it has to stay share-alike, with credit, so it cannot go through QL5 selling like the rest.
   - Community Minecraft worlds (Middle-earth, Westeros) are their builders' work, on top of other people's stories. Showing them inside SetMix needs those communities' written yes, and the story owners may still object.
   - Roblox's terms forbid extracting other creators' assets. Only a player's own exports, or a creator's explicit licence, are usable.
   - So every imported preset carries a `license` and a `source`. Selling is blocked for share-alike and no-commercial content. Credits show wherever the content is shown.
2. **Streaming needs a host that lets us.**
   - A browser can only Range-read another site's files if that site sends CORS headers. Most world downloads do not.
   - Hotlinking also spends their bandwidth.
   - The workable shape: converting content we may use, once, into our own chunked format on our storage (RUN), and streaming that with Range requests. The 4 KB `.mca` header trick still applies to our own format.
3. **The minimum spec sets the budget.** The GTX 950M has 2 GB of video memory. That needs:
   - chunk meshing in a worker (greedy faces);
   - a small view radius on Low with fog at its edge;
   - far LOD meshes;
   - a hard cap on cached chunks (IndexedDB plus a memory LRU).
4. **No Minecraft textures.** Minecraft's block textures belong to Mojang. Blocks map to SetMix surfaces through a block-to-surface table, drawn with our own texgraph sets. That table is the real work in `@hm/schematic`.
5. **A safe, small first step that serves the questline:**
   - **import your own builds**: drop a `.schem`, `.nbt` or `.vox` file you made, and get a VoxelModel preset, with size limits;
   - then a Kenney CC0 star system to explore;
   - only then streamed worlds, each with its makers' permission.
