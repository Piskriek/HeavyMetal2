# SetMix Studio: research and plan (2026-10-08)

The owner (2026-10-08, verbatim): "the studio is how i will polish the game, it need to have all the tools an artist/coder requires to build their own games using the most logical/popular tools associated with that part of game development with easy to apply presets that look good while having the ability to finetune the details or overhaul completely. so some research and planning is required. you can hand the bulk over to some arena ai, but first polish the scientist and base game".

Earlier, in `docs/SETMIX_PLAN.md`: Studio is a menu button, "the fully upgraded lab, for making presets for any game".

**Order:** the scientist and the base-game polish come first (sidecar TASK-07 and TASK-08). This document is the research and the plan. Nothing here is built until the owner has answered section 7.

## 1. What the Studio is
- **Where:** the fully upgraded lab, with every machine and tool unlocked.
- **Who and what:** an artist or coder builds their own games there. The owner polishes SetMix itself there.
- **Three depths in every tool:**
  1. **Preset:** one click, and it looks good.
  2. **Tune:** the preset's own parameters, live, with sensible ranges.
  3. **Overhaul:** the whole graph, data or code behind it, or the asset opened in the professional tool through a bridge.
- **What follows:** for the owner to polish SetMix in the Studio, everything SetMix shows must come from Studio data (presets). That covers the stage looks, the lab's lighting, materials, machine props, plumes, the HUD theme, the sounds and the animations. A refactor pass moves today's hard-coded looks into default presets (section 5, S1).

## 2. Research: what game makers use (and so already know)
- **Engines:** Unreal Engine 42%, Unity 30%, proprietary 19%, Godot 5%. Unreal leads at AA/AAA, Unity at older indies, Godot is rising among new indies ([GDC State of the Game Industry 2026](https://gamedevreports.substack.com/p/gdc-the-state-of-the-game-industry-fcf)). So the editor conventions to borrow are Unreal's and Unity's:
  - a viewport, an outliner, a details panel and a content browser;
  - W/E/R move/rotate/scale gizmos;
  - prefabs (Unity) and Blueprints (Unreal);
  - play-in-editor.
- **Art tools:** Photoshop is the most used, then Blender, Substance 3D Painter, Maya and ZBrush. Common pairings are Maya + Substance Painter, Substance Painter + ZBrush, and Blender + Photoshop ([ArtStation State of the Art 2026, via 80.lv](https://80.lv/articles/learn-what-recruiters-want-from-artists-in-artstation-s-report/)). Substance Painter is the dominant texturing tool for student and junior work ([The Rookies](https://www.therookies.co/blog/resources/best-3d-software)). So:
  - materials should feel like Substance (layered materials, smart presets) and Unreal's Material Editor (a node graph);
  - painting should feel like Photoshop (layers, brushes, blend modes);
  - modelling hands off to Blender.
- **In-game creation platforms:** Roblox Studio (Luau scripting, an AI assistant with MCP), UEFN (Unreal Engine 5 for Fortnite, Verse), Core (Lua) ([metavert.io](https://metavert.io/roblox-vs-user-generated-content), [uefncentral.com](https://uefncentral.com/blog/category/comparison)). The successful ones put full scripting and an AI assistant inside the world editor.
- **Specialist tools, by field (well known, not from a survey):**
  - VFX: Unreal Niagara, Unity VFX Graph (module stacks).
  - Animation: Mixamo (rig and clips, already in use here), Unity Mecanim and Unreal Animation Blueprints (state machines, blend spaces).
  - Audio: FMOD and Wwise (events, parameters, adaptive music), sfxr/jsfxr for retro sounds.
  - Cameras and cutscenes: Cinemachine, Unreal Sequencer.
  - Terrain: Unreal Landscape, World Machine and Gaea.
  - Dialogue and quests: ink, Yarn Spinner.
- **Files that move between tools:** glTF/GLB (and FBX in, VRM for avatars), PNG and KTX2, WAV and OGG, JSON.

## 3. The workspaces
Each workspace says what it is modelled on, its presets, what you can tune, the overhaul path, what we already have, and what to build. The bulk of "to build" goes to Arena (section 6).

| Workspace | Modelled on | Presets (one click) | Tune | Overhaul | We have | To build |
|---|---|---|---|---|---|---|
| Scene and world | Unreal and Unity editors | starter scenes | transform, snapping | the scene document | the old Studio mode (windows, attribute editors, fly), gizmo, things palette | `@hm/scenedoc` (document, selection, undo), editor shell |
| Terrain and biomes | Unreal Landscape, Gaea | desolate, dunes, alpine, archipelago, the stage ladder | height, erosion, materials, water, cover | sculpt and paint brushes, a heightmap in or out | `plotterrain`, `terrain`, `terrainops`, `groundshader`, `coverage`, `hydro`, `treegen`, `flora` | `@hm/terrainbrush`, biome presets |
| Materials and textures | Substance Designer and Painter, Unreal Material Editor | rust, painted steel, wet rock, sci-fi panel | every exposed parameter | a material node graph, layered painting | `texgraph`, `vault` (50 presets), `decals` | `@hm/matgraph` (a PBR graph compiled to a three.js material) |
| Lighting, sky and post | Unreal post-process volume, Unity Volume | dawn, noon, overcast, night, neon lab, the stage looks | sun, fog, exposure, grade, bloom | a LUT editor, a custom post chain | the island lighting menu, `STAGE_LOOK` | `@hm/postfx` (a preset post stack, cheap on Low) |
| VFX | Niagara, VFX Graph | smoke, sparks, fire, rain, pixel plume, glow | each module's values | the module stack, GPU emitters | `plume`, `tooljuice` | `@hm/vfx` (module-stack particles) |
| Models and props | Blender, ProBuilder, kitbashing | the prop kits, generators | generator parameters | import glTF/FBX, "Edit in Blender" (the Blender MCP bridge) | `labkit`, `fieldkit`, `consolemill`, `smoothvox`, `remesh`, `hull`, `schematic` | `@hm/kitbash` (snap-together parts), the import pipeline (LODs, colliders) |
| Characters and animation | VRoid, Mixamo, Mecanim and Animation Blueprints | the scientist and looks, the Mixamo clips | speeds, blends, visor and colours | a state machine graph, retargeting, IK | the scientist (TASK-07), `puppet`, `ragdoll`, `kinematic`, `toolanims` | `@hm/animgraph` (state machine, blend spaces, Mixamo-to-VRM retargeting) |
| Logic and gameplay | Blueprints, Unity Visual Scripting, Luau, Verse | game modes (race, collect, survive, build), quest templates | rules and numbers | a visual script graph, TypeScript in a sandbox | `questline`, `machines`, `market`, `plotsim`, `cartlab`, `kart`, `navgrid` | `@hm/visualscript` (an event-graph runtime), a safe script sandbox |
| UI and HUD | Unreal UMG, Unity UI Toolkit | HUD layouts, menu themes | theme tokens | a layout editor | the shell, CSS themes | `@hm/uikit` (data-driven HUD widgets) |
| Audio | FMOD and Wwise, sfxr | machine, UI and ambience packs, adaptive music | parameters | an audio graph, events and buses | `musicbox` | `@hm/sfx` (procedural sound synth), `@hm/audiomix` (events, buses, ducking) |
| Cameras and cutscenes | Cinemachine, Sequencer | follow, orbit, rail, over the shoulder | damping, framing | a timeline | the 1st/3rd person toggle (V) | `@hm/camrig`, `@hm/timeline` |
| Physics | PhysX and Jolt | bouncy, icy, sticky, vehicles | mass, friction | joints | `kinematic`, `kart`, `rocket`, `ragdoll` | later |
| Publish and share | Roblox and UEFN publishing | share a preset or a game | the min-spec budget meter | the files themselves | `plotcodec`, `storage`, the Community menu | `@hm/presetcodec` (any preset as a safe code, like `plotcodec`), the profiler panel, RUN publishing |

An AI assistant panel (as Roblox Studio has, over MCP) and the bridges come in later phases:
- Unreal, through the owner's SetMix_UE5 Python bridge (SM27);
- Blender, through its MCP;
- Mixamo, by download, as now.

## 4. Architecture
- **The hub is the lab.** Walk to a station (the preset bench for materials, the planet table for terrain, the console for logic) and it opens its workspace in a desktop editor layout: a viewport, an outliner, a details panel, a content browser and a timeline, all dockable. This reuses the old Studio mode's window system (STATUS N10). Esc returns to the lab.
- **One document model.** Every preset and asset is typed, versioned and JSON-serialisable, with a schema and migrations. Every edit is a command on one undo/redo stack. Autosave goes to IndexedDB; files can be imported and exported; sharing uses a validated code (as `plotcodec` does).
- **Schema-driven inspector.** Every parameter is declared once: type, range, default, group, and its cost per graphics tier. The details panel is generated from that (as `graphics-tuning` already does from its schema). So every tool gets "Tune" for free, and every preset's cost on the minimum spec shows live: fps, draw calls, triangles. The owner's low-end rule is built in.
- **Three depths in the data:** a preset is parameters plus an optional graph or script. "Overhaul" opens the graph or the script. A bridge sends the asset out to Blender or Unreal and takes it back in.
- **SetMix reads presets by id**, so the Studio's edits show in Play at once. This is how the owner polishes the game.
- **Safety:** shared presets and scripts come from other people, so they are validated like `plotcodec` (decoders that never throw, within limits). Scripts run in a sandbox with no DOM and no network.

## 5. Phases
- **S0, the foundation:**
  - Arena: `@hm/scenedoc` (the document, selection, a command stack with undo and redo, migrations), `@hm/presetcodec`.
  - Sidecar: the editor shell in the lab (dock layout, outliner, details from schemas, content browser).
- **S1, the look of SetMix:** the owner can start polishing the game here.
  - The data refactor: stage looks, lab lighting, materials, plumes and the HUD theme become presets.
  - Then the workspaces for materials (`texgraph` and `@hm/matgraph`), lighting and post (`@hm/postfx`) and VFX (`@hm/vfx`).
- **S2, world and objects:** terrain brushes and biomes, model import and kitbashing, the Blender bridge.
- **S3, characters and animation:** `@hm/animgraph`, retargeting, character presets.
- **S4, logic, UI, audio and cameras:** visual scripting plus a TypeScript sandbox, `@hm/uikit`, `@hm/sfx` and `@hm/audiomix`, `@hm/camrig` and `@hm/timeline`.
- **S5, publish and share:** Community sharing, the profiler panel, RUN publishing (needs the owner's login), the Unreal bridge (SM27) as the "overhaul in Unreal" path, and the AI assistant panel.

Every phase works the same way:
- Arena writes the self-contained modules, two battles at a time, from standalone briefs with acceptance tests.
- Claude lands the best answer, testing it and judging its look.
- The sidecar wires it into the Studio.
- The owner reviews each phase in the Studio itself.

## 6. The Arena backlog (briefs to write per phase)

| Phase | Module | One line |
|---|---|---|
| S0 | `@hm/scenedoc` | A typed scene/preset document with ids, a selection, a command stack (undo, redo, merge, transactions) and versioned migrations |
| S0 | `@hm/presetcodec` | Any schema'd preset as a short, canonical, validated code (`plotcodec` generalised) |
| S1 | `@hm/matgraph` | A PBR material node graph (noise, layers, masks, triplanar) compiled to a three.js material, with a preset library |
| S1 | `@hm/postfx` | A preset-driven post stack (exposure, grade, LUT, bloom, vignette, fog, dither looks), budgeted per tier |
| S1 | `@hm/vfx` | Module-stack particles (spawn, shape, velocity, forces, colour and size over life, collision), on the GPU where possible |
| S2 | `@hm/terrainbrush` | Sculpt and paint operations on a heightfield and material weights, undoable |
| S2 | `@hm/kitbash` | Snap-together parts with sockets, prop generators |
| S3 | `@hm/animgraph` | Animation state machines, blend spaces, Mixamo/VRM retargeting, two-bone IK |
| S4 | `@hm/visualscript` | An event-graph runtime with types, from a typed node library |
| S4 | `@hm/uikit` | HUD widgets driven by data and theme tokens |
| S4 | `@hm/sfx`, `@hm/audiomix` | Procedural sound synthesis with presets; events, buses, ducking, adaptive music |
| S4 | `@hm/camrig`, `@hm/timeline` | Camera rigs; a keyframe timeline for cutscenes |

## 7. Decisions for the owner
1. **Priority:** S0, then S1 (the look of SetMix first, since the Studio is how you will polish the game), then S2 to S5. Agree, or reorder?
2. **The layout:** walk to a station in the lab, and its workspace opens in a desktop editor layout. Or would you rather have a pure editor with no walking?
3. **The overhaul language:** a visual graph plus TypeScript (recommended: web-native, the code the game is written in), or Lua as Roblox and Core use?
4. **The bridges:** Blender (S2) and Unreal (S5) as the overhaul paths for models and scenes. Keep them both?
5. **The AI assistant** in the Studio (as Roblox's): in S5, or sooner?
