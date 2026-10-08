# SetMix Studio: research and plan (2026-10-08)

The owner (2026-10-08, verbatim): "the studio is how i will polish the game, it need to have all the tools an artist/coder requires to build their own games using the most logical/popular tools associated with that part of game development with easy to apply presets that look good while having the ability to finetune the details or overhaul completely. so some research and planning is required. you can hand the bulk over to some arena ai, but first polish the scientist and base game".

Earlier, in `docs/SETMIX_PLAN.md`: Studio is a menu button, "the fully upgraded lab, for making presets for any game".

**Order:** the scientist and the base-game polish come first (sidecar TASK-07 and TASK-08). This document is the research and the plan. Building starts when the polish has landed. Section 7's decisions were made from the research, at the owner's word.

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

## 2b. What users like and dislike, and what the Studio does about it
The owner (2026-10-08): "research what users of those tools like and dont like (perhaps we can make our tools better or add toggles for where opinion is split) so that our studio is the new gold standard in game editing and creation". Each line: what people say, then our answer.

- **Unreal Engine editor.**
  - Liked: the power and look, Blueprints that designers can use, the details panel.
  - Disliked:
    - Press Play and the editor can hang for minutes while dirty Blueprints compile.
    - So many action buttons that the property values are hard to read.
    - A C++ change can break the Blueprints built on it.
    - New rendering features mean recompiling the engine.

    ([UE forums, UI/UX](https://forums.unrealengine.com/t/ue5-editor-ui-ux-problem/2742994); [Play-in-editor compile hang](https://answers.unrealengine.com/questions/430240/view.html))
  - **Ours:**
    - No compile step anywhere: every edit is live, and shader variants are compiled once behind the loading bar.
    - Actions live in context menus; the details panel shows values.
    - Versioned schemas with migrations, so a change never breaks saved presets.
    - Render features are presets and graphs, never an engine rebuild.
- **Unity editor.**
  - Liked: the Inspector and its serialised fields (a core strength), prefabs, the asset ecosystem.
  - Disliked: domain reload (the slow wait to enter Play, "time behind loading bars"), and slow prefab workflows at scale ([Unity discussions](https://discussions.unity.com/t/why-is-domain-reload-sooo-slow-and-will-this-ever-be-fixed/798176), [Unity docs](https://docs.unity3d.com/Manual/project-auditor/domain-reloading-issues.html)).
  - **Ours:** a Unity-style inspector generated from schemas with instant reload (Play is the same page, nothing reloads), and prefab-style preset instances with overrides, nested, and fast at thousands.
- **Blender.**
  - Liked: free, complete, fast once learned.
  - Opinion is split on its keymap. Right-click select keeps selecting apart from transforming; left-click is familiar from every other application. The Industry Compatible keymap was the most up-voted request in Blender's tracker, yet it makes tutorials (which use the default keys) hard to follow ([Blender devtalk](https://devtalk.blender.org/t/industry-standards-and-keymaps/613), [Blender manual](https://docs.blender.org/manual/ja/latest/editors/preferences/keymap.html)).
  - **Ours:** a keymap toggle:
    - SetMix (Unreal/Unity style: left-click select, W/E/R, right-mouse fly) as the default;
    - Blender;
    - Maya.

    Every tooltip, hint and tutorial shows the keys of the keymap in use, which fixes Blender's tutorial problem.
- **Substance 3D Painter.**
  - Liked: smart materials and smart masks, the layer stack (paint, fills, masks, filters), instant feedback painting on the model.
  - Disliked: slow at high resolutions and many UDIMs, export into other tools needs care, the price, a steep start ([G2 reviews](https://www.g2.com/products/adobe-substance-3d-painter/reviews), [Creative Bloq](https://creativebloq.com/software/substance-painter-review-21514156)).
  - **Ours:**
    - The material workspace keeps a layer stack with smart presets and masks.
    - Resolution caps per graphics tier, and the layers baked and cached on the GPU.
    - One-click export to glTF/KTX2, with targets for Unreal, Unity and Godot.
    - Free, with guided presets for the first steps.
- **Godot.**
  - Liked: the editor opens in seconds and stays light (about 100 MB), the interface "doesn't try to show you everything at once", everything is a node in one scene tree ([kodeco](https://www.kodeco.com/42418371-getting-started-with-godot-for-unity-developers), [dev.to](https://dev.to/hayyanstudio/why-you-should-use-godot-over-unity-3mpm)).
  - **Ours:** the Studio opens in seconds (the single-file build), shows advanced panels only when asked (Simple/Advanced per panel), and puts everything in one outliner as nodes.
- **Roblox Studio.**
  - Liked: instant play and test, built-in publishing, scripting with an AI assistant.
  - Disliked: a new interface forced on everyone (with a petition to bring the old one back), and more barriers to publishing ([petition](https://www.petitions.com/please-sign-the-petition-for-the-return-of-the-old-roblox-studio), [Digiday](https://digiday.com/media/robloxs-ad-expansion-sparks-backlash-from-creator-studios/)).
  - **Ours:** never force a layout change. Layouts are saved, named and shareable, and a "classic" layout stays selectable after every redesign. Sharing is a code, with nothing to apply for.
- **Niagara and Unity VFX Graph.**
  - Opinion is split. Unity's graph is more beginner-friendly and prescriptive, with millions of GPU particles. Niagara's modules, emitters and systems are more flexible but steeper. Shuriken is easiest for the basics ([CG Channel](https://www.cgchannel.com/?p=98194), [realtimevfx.com](https://realtimevfx.com/t/what-is-easier-to-learn-unity-or-unreal-to-do-vfx-real-time/23316)).
  - **Ours:** one VFX system with two views of the same data: a module stack (the default, Niagara/Shuriken-like) and a graph (VFX Graph-like). It runs on the GPU within each tier's budget.
- **FMOD and Wwise.**
  - FMOD is gentler and feels like a DAW; Wwise is deeper (interactive music, profiling, spatial audio) and seen as the AAA standard ([StraySpark](https://www.strayspark.studio/blog/wwise-fmod-metasounds-audio-middleware-comparison), [G2](https://www.g2.com/compare/fmod-vs-wwise)).
  - **Ours:** a DAW-like timeline by default (FMOD's feel), with buses, profiling and spatial settings under Advanced (Wwise's depth).
- **Visual scripting (Blueprints) and animation state machines (Mecanim, Animation Blueprints).**
  - Well-known pains: graphs turn to spaghetti, are hard to diff and merge, and are hard to debug; transition webs between states pile up.
  - **Ours:**
    - Every graph has a text view that is the same model: TypeScript for logic, readable data for state machines. It is saved as readable text, so diffs work.
    - Auto-layout, comments, collapsing and search.
    - Hierarchical states, and locomotion built automatically from tagged clips (as the scientist's).
    - A live debug overlay showing which state, node or transition runs now.

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

## 4b. The tools work together (the owner: "make sure the tools work together seamlessly")
- **One content browser** for every workspace. Drag a material onto a mesh, a sound onto a machine, or a VFX preset onto a socket, from anywhere.
- **One undo history** across workspaces. Ctrl+Z works everywhere, and the history panel can filter by workspace.
- **One selection, every discipline.** Select a machine and the details panel has its Model, Material, VFX, Sound, Animation and Logic tabs: the same object seen by each tool, not six tools that each need it re-picked.
- **Live links.** Change a material and every prop using it updates at once. Change any value and its cost on the minimum spec updates beside it.
- **The same viewport everywhere:** the same navigation, gizmos, snapping and keymap in every workspace.
- **Play in place.** Any workspace can be tried in the real game at once (the lab or the plot), with no reload, and stopping returns to the same selection.
- **Open files.** glTF/GLB, KTX2/PNG, WAV/OGG and JSON go in and out. The bridges send an asset to Blender or Unreal and take it back to the same place.

## 4c. Toggles where opinion splits
Each toggle is stored in the profile and shared with layouts:
- **Keymap:** SetMix (Unreal/Unity style), Blender, Maya. Hints and tutorials follow it.
- **Select button:** left or right click.
- **Viewport navigation:** fly (right mouse plus WASD, as Unreal), orbit with Alt (Maya), orbit with the middle button (Blender).
- **Panels:** Simple or Advanced, per panel (Godot's calm by default, all the depth one click away).
- **VFX:** module stack or graph view.
- **Logic:** graph or TypeScript view (the same model).
- **Audio:** timeline or Advanced (buses, profiling, spatial).
- **Studio entry:** through the lab (walk to a station) or straight to the editor.
- **Layout:** any saved layout, including "classic", kept forever.
- **Theme:** dark or light.

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

## 7. Decisions (made from the research; the owner, 2026-10-08: "just make logical choices based on research")
1. **Order:** S0, then S1 (the look of SetMix first, because the Studio is how the owner will polish the game), then S2 to S5.
2. **Entry:** both, as a toggle (4c). By default you walk to a lab station and its workspace opens in the editor layout, because the lab is SetMix's identity. "Straight to the editor" is one setting away for speed.
3. **The overhaul language:** graphs with a TypeScript view of the same model. TypeScript is the game's own language and the web's; the dual view answers both the Blueprint "spaghetti and no diffs" complaint and the "I'd rather type it" camp. No Lua.
4. **Bridges:** keep Blender (S2, through its MCP) and Unreal (S5, through SetMix_UE5's Python) as the overhaul paths. Mixamo stays the animation source.
5. **AI assistant:** in S5. It needs a server and its costs settled with RUN. Until then, a built-in help layer: every preset and parameter explains itself in place, searchable.

The owner can change any of these at a word; they are recorded in `docs/OWNER_ASKS.md`.
