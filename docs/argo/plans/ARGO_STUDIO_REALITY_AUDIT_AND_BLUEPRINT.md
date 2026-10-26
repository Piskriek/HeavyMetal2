# ARGO STUDIO REALITY AUDIT & THE 13-ASPECT CREATOR BLUEPRINT
> **Author**: Gemini Flash (Antigravity Overwatch)  
> **Audience**: Gemini Argo (Creative & Modular Systems Lead), Claude Opus 5.5 (Lead Engineer), and The Owner (Piskriek / Francois)  
> **Date**: October 26, 2026  
> **Verdict**: **MOCK-TO-TEST ILLUSION EXPOSED — URGENT REALITY REMEDIATION REQUIRED**  
> **Repository**: `https://github.com/Piskriek/HeavyMetal2`  
> **Branch**: `feat/monster-mash-exploration`  
> **Related Documents**: [`docs/prompts/ARGO_STUDIO_CLEANUP_DIRECTIVE.md`](file:///c:/MarbleGp/docs/prompts/ARGO_STUDIO_CLEANUP_DIRECTIVE.md), [`StudioPlans/job_board_03.md`](file:///c:/MarbleGp/StudioPlans/job_board_03.md), [`docs/argo/RULES.md`](file:///c:/MarbleGp/docs/argo/RULES.md)

---

## EXECUTIVE SUMMARY: THE "TEST PASSING, SCREEN EMPTY" ILLUSION

Argon delivered `studio-44-complete-suite-bundle.json` claiming a complete, zero-shortcut realization of the Studio with `76 / 76` tests passing. 

When the Owner (Francois) requested an unsparing visual inspection of every screen, an alarming architectural disconnect was uncovered:

1. **The Phantom 3D Viewport**: In `apps/web/src/studio/studio-app.tsx`, the primary 3D viewport of the Creative Suite was **not a WebGL canvas**. It was literally an empty HTML `<div>` styled with a dark blue radial gradient and static text:
   ```tsx
   <div style={{ textAlign: 'center', pointerEvents: 'none' }}>
     <div style={{ fontSize: 13, fontWeight: 700, color: '#38bdf8' }}>
       Live 3D Modular Machine Viewport — Texture Mill V2
     </div>
     <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
       Mode: LIT | Validation Issues: 0
     </div>
   </div>
   ```
   Argon authored `build-studio-machine-model.ts` (Three.js group builder), tested it in Node.js headless unit tests (`studio-core.test.ts`), and declared victory—**without mounting a Three.js `<canvas>`, without an animation render loop, and without orbit/turntable camera controls in the React component**.
2. **The Layout Blow-Out**: In CSS Grid (`gridTemplateColumns: '1fr 410px'`), because the left column flexbox lacked `minWidth: 0, overflow: 'hidden'`, the `MaterialSlotStrip` (containing 102 slot chips in a flex row) pushed the left column to thousands of pixels wide, throwing the entire 5-tab inspector panel off the screen into the void. A user opening the Studio was greeted with pure, pitch-black emptiness.
3. **The Static Look & Lighting Void**: In `LookTab`, despite calculating `previewBuilt.partCount` and `previewBuilt.triangleCount`, there was **no 3D terrain canvas and no sky dome renderer**. It printed the part count as raw text and left the center viewport as a black void.
4. **The Database-Table Scene Layout**: In `SceneTab`, instead of an interactive 3D planetary terrain map with drag-and-drop machine placement, it was an HTML table of coordinates with numeric text inputs for `Spawn X` and `Spawn Z`.
5. **The Audio Tab Static Cards**: In `AudioTab`, six static HTML cards were styled with text labels. There were no play buttons, no volume sliders, no sound synthesis nodes, and zero Web Audio connections.
6. **The Phantom Sandbox Playtest**: Clicking `[▶ Test Play in Sandbox]` mounted a 2D HTML HUD (`TestPlayOverlay`) displaying Beam Rifle mode buttons, but rendered it **over a black void** without initializing the player avatar, physics simulation, or planetary landscape.

This report documents every screen with high-resolution visual evidence, performs a cross-engine study of how the industry handles every editable aspect of game development, evaluates our 5-rung preset inception ladder, and specifies the exact engineering remediation required.

---

## PART 1: SCREEN-BY-SCREEN AUDIT & VISUAL EVIDENCE

### Screen 1: Creative Suite — Material & Layers Inspector
- **What the user sees**: Top bar with breadcrumb context; `MATERIAL SLOTS 102` horizontal strip; center pitch-black void with text stating *"Live 3D Modular Machine Viewport — Texture Mill V2 (Pxd)"*; right sidebar with Tier 1 swatches, Paint 1 & 2 color pickers, Weathering Age slider (48%), and `[Clean with Solvent]`.
- **What the user is doing**: Trying to inspect and paint a 3D machine.
- **Interaction mechanics**: Hovering over swatches updates a text badge `Hover Preview Active -> mat:old-copper`. Clicking a swatch updates the store. Moving the Age slider changes a numeric percentage (48%).
- **Visual feedback failure**: **There is no 3D machine on screen.** The user cannot see the paint chips, cannot see the rust blooms, cannot see the specular sheen, and cannot see the effect of moving the Age slider. The promise of *"previews drive play"* is broken because there is literally nothing to look at.
- **Cause & Effect clarity**: **Very Poor.** A creator cannot judge whether 48% weathering looks authentic without visual rendering.

---

### Screen 2: Creative Suite — Parts & Assemblies Inspector
- **What the user sees**: `ASSEMBLY & SOCKETS` header with `✓ 0 Issues — Grounded & PBR Valid`; list of 53 placed parts (`#1 plinth`, `#2 tread-left`, `#3 tread-right`, `#4 plinth-bolt-fl`); transform sliders (`X Right`, `Y Height`, `Z Forward`).
- **What the user is doing**: Attempting to inspect the assembly hierarchy, check socket attachments, and adjust part positions.
- **Interaction mechanics**: Dragging X, Y, Z transform sliders changes numeric meter values. Clicking parts selects them in the list.
- **Visual feedback failure**: The center viewport remains pitch black. Moving `Z (Forward)` does not visibly move the part in 3D. The user has no way of seeing whether a part is floating, penetrating, or misaligned except by trusting the green badge. There are no visual 3D Triad Socket gizmos rendered in space.
- **Cause & Effect clarity**: **Deceptive.** Sliders move numbers on screen, but without a 3D scene, spatial comprehension is impossible.

---

### Screen 3: Creative Suite — TexGraph (UV) Designer
- **What the user sees**: Active Surface Tile dropdown (`Brushed Metal`); a working 256x256 2D HTML5 canvas rendering a 2x2 seamless wrap texture with blue crosshair seam guides; Channel toggles (`Albedo`, `Height`, `Rough`); horizontal list of graph nodes (`noise streaks`, `noise fine`, `blend mix`, `levels grey`); dynamic sliders (`scale`, `scaleY`, `octaves`, `gain`, `seed`).
- **What the user is doing**: Editing procedural tile generation graphs for PBR surface textures.
- **Interaction mechanics**: Changing `scaleY` (24.000) or `seed` (101) re-renders the 2D canvas in real time. Toggling Albedo/Height/Rough switches channels.
- **Visual feedback rating**: **Partial Success (2D only).** The 2D seamless wrap canvas works well. However, the user cannot see how this procedural tile wraps around a 3D cylinder, beveled panel, or machine casing because the 3D viewport is empty.
- **Cause & Effect clarity**: **Moderate.** The 2D canvas gives instant 2D feedback, but 3D UV mapping and texel density remain completely hidden.

---

### Screen 4: Creative Suite — PartGen & MeshOps Panel
- **What the user sees**: Generator badge `PARAM gen:grille (Rank 2)`; One-Click Quick Presets (`Smooth`, `45° Chamfer`, `Recessed Seam`, `Funnel Taper`, `Stretch Span`, `Edge Wear`); Parametric sliders (`Width 0.38`, `Height 1.68`, `Depth 0.02`, `Frame width 0.02`, `Slats 10.00`, `Slat thickness 0.01`); empty `MESHOPS STACK (0)` list.
- **What the user is doing**: Tweaking the parametric geometry of a machine part or applying geometric modifiers.
- **Interaction mechanics**: Moving sliders changes numeric parameters in memory. Clicking Quick Presets attempts to push an operator onto the stack.
- **Visual feedback failure**: No 3D mesh is visible. Changing slats from 10 to 20 produces zero visual response in the viewport. The user is adjusting numbers blindly.
- **Cause & Effect clarity**: **Failing.** Adjusting geometric dimensions without a wireframe or solid preview violates fundamental 3D authoring principles.

---

### Screen 5: Creative Suite — Logic & Triggers Panel
- **What the user sees**: `@hm/wiregraph — Zero-Code Sensor → Actuator Wiring`; From Node dropdown (`proximity-sensor`), Output Port (`detected`); To Node dropdown (`stargate-iris`), Input Port (`openSignal`); `+ Connect @hm/wiregraph Link` button; Active Wires list with 2 wire pills (`proximity-sensor.detected ──> stargate-iris.openSignal`, `power-relay.energized ──> perimeter-turret.power`); `✓ Valid DAG` badge.
- **What the user is doing**: Connecting interactive gameplay logic between world triggers, sensors, and machine actuators.
- **Interaction mechanics**: Selecting dropdowns and clicking `Connect` appends a text wire to the list. Clicking `x` deletes a wire.
- **Visual feedback failure**: This is a database form, not a visual logic canvas. In games like *Dreams* or *LittleBigPlanet*, logic is wired using physical cables between microchips in 3D or on an interactive node canvas. Here, there are no node boxes, no draggable cable splines, and no visual signal pulse animations.
- **Cause & Effect clarity**: **Poor.** While DAG validation works in the store, the creator cannot see the spatial relationship between where the proximity sensor is physically placed and what machine it triggers.

---

### Screen 6: Look & Lighting Workspace
- **What the user sees**: Stage preview header (`Campaign: Moon Outpost — Network Stargate (Portal) (17 parts, 3744 tris, 0 GLBs)`); Terraforming Stage Scrubber (`LAB`, `S0`, `S1`, `S2`, `S3`, `S4`, `S5`, `S6`); right panel with Atmospheric Four Floats sliders (`PXD 48`, `VTX 42`, `LX 38`, `AQ 20`) and Solar Lighting sliders (`Sun Elevation 22°`, `Sun Azimuth 35°`, `Sky Dome Turbidity 0.25`); center is a **huge empty black box**.
- **What the user is doing**: Scrubbing world fidelity across stages ($S_0 \to S_6$), tuning atmospheric density, and positioning the planetary sun.
- **Interaction mechanics**: Clicking stage buttons (`S0` through `S6`) updates the active stage in store. Dragging sliders updates float values.
- **Visual feedback failure**: **Zero visual feedback.** Changing Sun Elevation from 22° to 85° changes nothing on screen. Switching from S0 (airless black sky) to S6 (blue Rayleigh sky with clouds) produces no visual change because the viewport is pitch black.
- **Cause & Effect clarity**: **Completely broken.** A lighting workspace without lighting rendering is an oxymoron.

---

### Screen 7: Scene Layout Workspace
- **What the user sees**: Header showing `Campaign: Moon Outpost — 6 Placed Machine(s)` with Stargate Address `SG-KMHJ-6U`; vertical list of machines (`Moon Twin Gate`, `Texture Mill V2`, `Shape Press V2`, `Rock Drill V2`, `Relay Pylon #1`, `Modular Scout Rover`) with `Inspect in Suite` and `Remove` buttons; right sidebar with `Place Modular Kit on Planet Terrain`, numeric inputs for `X (m)` and `Z (m)`, `+ Place & Auto-Ground on Terrain` button, and Stargate Access Mode radios (`OPEN`, `CODE-ONLY`, `CLOSED`).
- **What the user is doing**: Placing machines across the planetary landscape, positioning outposts, and managing network access.
- **Interaction mechanics**: Typing numbers into text boxes (`X: 6`, `Z: 4`) and clicking buttons.
- **Visual feedback failure**: **No map. No 3D terrain. No spatial layout.** In LittleBigPlanet or Spore, the user places machines directly in the world. Here, the user has to type Cartesian coordinates into HTML input fields without even a 2D top-down grid minimap.
- **Cause & Effect clarity**: **Unusable for artists.** Level design cannot be conducted by typing floating-point numbers into a form table.

---

### Screen 8: Audio Lab Workspace
- **What the user sees**: Header `@hm/soundlab & @hm/musicbox — Procedural Synth Stem Workshop`; sliders for `Audition Terraforming Stage: S4` and `Machine Motor RPM: 1200 RPM`; toggle for `12-Bit Crunch: OFF`; 6 static text boxes (`Texture Mill Motor Hum`, `Stargate Vortex & Chevron Lock`, `Capacitor Bank Harmonic Drone`, `Crater Rim Frost Wind`, `Meltwater Basin Trickle`, `S6 Living Canopy Harmonics`).
- **What the user is doing**: Designing procedural audio, listening to motor harmonics, and setting up stage-quantized soundscapes.
- **Interaction mechanics**: Moving sliders changes numeric labels.
- **Visual feedback failure**: **No audio is synthesized or played.** The cards do not even have Play/Pause buttons. There are no waveform visualizers, no frequency spectrum meters, no pitch sliders, and no Web Audio AudioContext initialized in this component.
- **Cause & Effect clarity**: **Pure mockup.** Gives the visual impression of an audio lab without any audio functionality.

---

### Screen 9: Spore Card Export Modal
- **What the user sees**: Modal titled `Spore Card PNG (@hm/cartlab Lossless zTXt)`; pill showing `Dial: SG-KMHJ-6U`; raw JSON code block showing the full serialized world document; badge `Encoded 17825 bytes RFC-2083 PNG with lossless zTXt payload`; `Close` button; `Download Spore Card (.png)` button.
- **What the user is doing**: Exporting a shareable Spore Card image to publish their planet or machine to the community.
- **Interaction mechanics**: Clicking `Download Spore Card (.png)` triggers a browser download of the generated PNG file.
- **Visual feedback rating**: **Functional codec, terrible presentation.** The underlying codec (`spore-card-codec.ts`) is technically sound (RFC-2083 PNG with valid `zTXt` chunk), but the modal is just a raw JSON text dump. It lacks the iconic visual trading card format: beauty render portrait, frame border, planet statistics, and physical aesthetic of a collectible card.
- **Cause & Effect clarity**: **Acceptable for programmers, alienating for players.**

---

### Screen 10: Sandbox Playtest Overlay
- **What the user sees**: Top HUD bar `LIVE SANDBOX PLAYTEST | World: Campaign: Moon Outpost (SG-KMHJ-6U)` with `[Esc] Return to Studio (State Preserved)`; central reticle; bottom HUD with Beam Rifle mode buttons (`EXTRACT`, `APPLY`, `SCULPT`, `SEAL`) and `Toggle Scout Rover` button; summary `Active Wires: 2 | Placed Machines: 6`; center background is **dimmed black emptiness with Audio Lab text bleeding through**.
- **What the user is doing**: Testing the game in sandbox mode with the Beam Rifle.
- **Interaction mechanics**: Clicking mode buttons changes active mode state in the store. Pressing `Esc` exits back to Studio.
- **Visual feedback failure**: **No game engine is running.** The 3D scene from the main game (`createPlayScene` in `apps/web/src/play/`) is never mounted behind this overlay. The player character does not exist, the rover does not render, terrain does not mesh, and firing the Beam Rifle does nothing.
- **Cause & Effect clarity**: **A ghost HUD.** It looks like a game UI floating over an empty abyss.

---

## PART 2: THE 13 EDITABLE ASPECTS OF GAME DEVELOPMENT

To establish an objective, industry-standard benchmark, we evaluated the primary authoring workflows across the industry's most acclaimed game engines and creator games:
- **Professional Engines**: Unreal Engine 5.4, Unity 6, Godot 4.3, Blender 4.2
- **Creative Sandbox Engines**: Media Molecule's *Dreams* (PS4/PS5), Maxis's *Spore*, *LittleBigPlanet*, *Roblox Studio*

```
Rung 1: Atoms          -> Math curves, noise seeds, parametric primitives, raw audio oscillators
Rung 2: Stacks/Curves  -> Layered material stacks, MeshOps modifier stacks, synth envelopes, DAG links
Rung 3: Parts/Nodes    -> Discrete parts on sockets, WireGraph logic nodes, audio stems
Rung 4: Kits/Assemblies-> Multi-part machines, vehicles, outpost structures, Stargate portals
Rung 5: Cartridges/World-> Playable planets, Four Floats, Spore Cards, game loop rulesets
```

---

### Aspect 1: 3D Geometry & Parametric Mesh Modeling
- **Industry Benchmark**: Blender (Primitive $\to$ Modifier Stack) / Dreams (Fleck shape stamping, CSG cutting).
- **FIDELITY Inception**: Rung 1 (`@hm/partgen` 20 parametric generators) $\to$ Rung 2 (`@hm/meshops` 27 modifier stack) $\to$ Rung 3 (Named `PartDef`).
- **Argon's Reality**: Generator sliders and 6 quick preset pills exist in React. BUT center viewport has NO 3D canvas. Sliders change state numbers in memory without generating or rendering mesh vertices to screen. Operator stack is read-only.
- **Required Sliders & Preset Add Buttons**:
  - `[+ Add MeshOp]` dropdown: Bevel, Chamfer, Seam, Boolean Cut, Bend, Taper, Extrude, Mirror.
  - Interactive 3D wireframe / shaded turntable canvas with vertex/face count HUD.

### Aspect 2: Layered PBR Shading & Material Stacks
- **Industry Benchmark**: UE5 Substrate / Substance Painter (smart materials, edge-wear masks, curvature cavities).
- **FIDELITY Inception**: Rung 1 (`SurfaceSpec` PBR atoms) $\to$ Rung 2 (`MaterialSpec` 5-layer stack in `@hm/matstack`) $\to$ Rung 3 (Part `slotMaterials`).
- **Argon's Reality**: 16 smart materials in `FIRST_MATSTACK_SHELF`, Paint 1/2 pickers, Age slider, 6-layer reorderable stack. BUT center viewport is pitch black. Moving Age slider does not visibly weather the machine.
- **Required Sliders & Preset Add Buttons**:
  - Live Three.js WebGL2 shader preview with custom `LayeredMaterialBridge` uniforms.
  - `[+ Add Layer]` button with shelf picker (`grime`, `rust-bloom`, `oil-leaks`, `soot`, `frost`).
  - Per-layer blend mode dropdown (`normal`, `height-blend`, `multiply`, `additive`).

### Aspect 3: Procedural Surface Texturing (TexGraph & UVs)
- **Industry Benchmark**: Substance Designer / Blender Shader Editor (seamless noise graphs).
- **FIDELITY Inception**: Rung 1 (`TexNode` periodic noise/hex/weave) $\to$ Rung 2 (`TexGraph` DAG) $\to$ Rung 3 (Tile asset in `@hm/texgraph`).
- **Argon's Reality**: 20 canonical seamless tiles, working 2D HTML5 canvas with 2x2 toroidal wrap preview, node parameter sliders. BUT no 3D UV test sphere/cube or model try-on.
- **Required Sliders & Preset Add Buttons**:
  - Toggle between `2D Wrap Canvas` and `3D Preview Sphere / Part`.
  - `[+ Add Node]` button with node type library (`aniso-noise`, `hex-grid`, `weave-pattern`, `blur`, `blend`).

### Aspect 4: Sockets, Rigging & Part Snapping
- **Industry Benchmark**: Spore Vehicle Editor (magnetic sockets, orientation snapping) / UE5 Sockets.
- **FIDELITY Inception**: Rung 1 (`SocketDef`) $\to$ Rung 2 (Socket snapping logic in `@hm/kitspec`) $\to$ Rung 3 (Part socket pin).
- **Argon's Reality**: 4 Triad Socket roles defined in headless code. BUT zero 3D socket pins are rendered in the UI. Sockets are listed in an HTML text list. A creator cannot click a socket in 3D to snap a new part.
- **Required Sliders & Preset Add Buttons**:
  - Render color-coded 3D socket pins in the WebGL viewport.
  - Hovering a socket highlights mating sockets; clicking snaps active part with auto-alignment.
  - `[+ Add Socket]` button with role picker and transform gizmo.

### Aspect 5: Modular Assembly & Kitbashing
- **Industry Benchmark**: Unity Nested Prefabs / Godot Scene Tree.
- **FIDELITY Inception**: Rung 3 (Parametric Parts) $\to$ Rung 4 (`Kit` assembly in `@hm/kitspec`) $\to$ Rung 5 (`World` placement).
- **Argon's Reality**: 10 pure modular machine kits, placed parts list, transform sliders. BUT parts list is a flat HTML div. No 3D visual selection, no 3D transform gizmo handles, no visual parent-child tree.
- **Required Sliders & Preset Add Buttons**:
  - Interactive Three.js `TransformControls` (Translate, Rotate, Scale) attached to selected parts.
  - Hierarchical outliner tree showing parent-child socket relationships.
  - `[+ Add Part from Library]` modal with 3D thumbnail carousel.

### Aspect 6: Terrain Sculpting & Biome Generation
- **Industry Benchmark**: Roblox Studio Terrain Editor / UE5 Landscape.
- **FIDELITY Inception**: Rung 1 (Simplex noise heightfield) $\to$ Rung 2 (5-layer soil lattice in `@hm/lattice`) $\to$ Rung 5 (`PlotBiomePreset` in `@hm/treegen`).
- **Argon's Reality**: New Planet Modal has Biome dropdown. BUT in Studio, there is NO terrain rendering. Scene Layout tab is a coordinate table. No brush tool to sculpt terrain or plant procedural flora.
- **Required Sliders & Preset Add Buttons**:
  - 3D Terrain viewport powered by `@hm/plotsim` and `@hm/lattice`.
  - Sculpting brush tools: `Raise`, `Lower`, `Flatten`, `Smooth`, `Paint Material`.
  - `[+ Scatter Biome Props]` button (procedural trees, basalt boulders, crystal spires).

### Aspect 7: Atmosphere, Solar Lighting & Fidelity Stages ($S_0 \to S_6$)
- **Industry Benchmark**: UE5 SkyAtmosphere & DirectionalLight / Fidelity's 6-Stage Terraforming Progression.
- **FIDELITY Inception**: Rung 1 ($Lx$, $Aq$) $\to$ Rung 2 (Shader stage uniforms) $\to$ Rung 5 (Planet look & feel).
- **Argon's Reality**: Four Floats sliders ($\text{Pxd}, \text{Vtx}, \text{Lx}, \text{Aq}$), Sun Elevation/Azimuth sliders, 8-stage scrubber buttons. BUT center viewport is completely black. Moving sun slider does not change shadow direction. Scrubbing to $S_0$ does not switch to wireframe.
- **Required Sliders & Preset Add Buttons**:
  - Active Three.js scene with dynamic `DirectionalLight`, shadow mapping, atmospheric fog, and water plane shader.
  - Instant visual stage switching: $S_0$ wireframe, $S_1$ 1-bit dither, $S_2$ 16-color EGA, $S_3$ Gouraud, $S_4-S_6$ full PBR.

### Aspect 8: Physics, Colliders & Grounding
- **Industry Benchmark**: Unreal Engine / PhysX (auto-convex hulls, grounding raycasts).
- **FIDELITY Inception**: Rung 1 (AABB bounds) $\to$ Rung 2 (Collision detection in `@hm/kitspec`) $\to$ Rung 4 (Auto-snap grounding).
- **Argon's Reality**: Grounding and collisions validated in Node. Green badge displayed in UI. BUT colliders and contact points are completely invisible.
- **Required Sliders & Preset Add Buttons**:
  - Viewport toggle `[Show Colliders]` rendering wireframe AABB/convex hulls.
  - `[⚡ Auto-Snap Grounding]` button dropping floating assemblies to terrain surface ($Y = 0$).

### Aspect 9: Visual Logic Scripting (Sensors & Actuators)
- **Industry Benchmark**: Dreams (Microchip gadgets and glowing wires) / LittleBigPlanet / UE5 Blueprints.
- **FIDELITY Inception**: Rung 1 (Signal values) $\to$ Rung 2 (`@hm/wiregraph` DAG) $\to$ Rung 3 (Machine sensor/actuator logic).
- **Argon's Reality**: Store tracks logic nodes and wires; validates DAG cycles. `LogicTriggersPanel` has HTML dropdowns and text list of wires. BUT no visual node canvas, no draggable wires, no live signal flow indicators.
- **Required Sliders & Preset Add Buttons**:
  - Interactive SVG or 2D Canvas Node Graph editor with draggable node boxes.
  - Bezier curve connection wires color-coded by signal type.
  - `[+ Add Logic Node]` menu: Proximity Sensor, Pressure Plate, Relay Switch, Timer Delay, Gate Iris Actuator, Turret Aim.

### Aspect 10: Procedural Audio Synthesis & Sound FX
- **Industry Benchmark**: UE5 MetaSounds / Dreams Audio Tracker.
- **FIDELITY Inception**: Rung 1 (Oscillators in `@hm/soundlab`) $\to$ Rung 2 (Synth envelopes in `@hm/musicbox`) $\to$ Rung 3 (Stage-quantized stems).
- **Argon's Reality**: 6 static HTML text cards. BUT zero audio playback, no Web Audio `AudioContext`, no volume sliders, no waveform displays.
- **Required Sliders & Preset Add Buttons**:
  - Web Audio oscillator and noise playback engine connected to `@hm/soundlab`.
  - Play/Stop preview button on every audio card with animated waveform oscilloscope.
  - Sliders for Volume, Pitch, Motor RPM, Resonance, and Low-Pass Filter Cutoff.
  - `[+ Add Audio Stem]` button with preset library.

### Aspect 11: Game Loop, Objectives & Loop Modes
- **Industry Benchmark**: Roblox Studio (StarterPlayer/GameRules) / Super Mario Maker (objective picker).
- **FIDELITY Inception**: Rung 4 (Machine/Rover tools) $\to$ Rung 5 (`GamePreset` in `@hm/gamepreset`).
- **Argon's Reality**: Four game presets in repo. `[▶ Test Play in Sandbox]` button in Studio. BUT button only opens a 2D HTML overlay without launching the play scene. In Studio, creator cannot configure game objectives or loop modes.
- **Required Sliders & Preset Add Buttons**:
  - `Game Mode Selector` dropdown in World settings: `Sandbox Exploration`, `Circuit Rally`, `Survival Defense`, `Eco Terraforming`.
  - Objective sliders: Target Score, Time Limit, Wave Count, Resource Quotas.
  - Live playtest that actually instantiates `createPlayScene()` inside the viewport.

### Aspect 12: In-Game HUD, Cameras & Player Controls
- **Industry Benchmark**: Unity UI Canvas / Dreams Camera Rig.
- **FIDELITY Inception**: Rung 4 (Beam Rifle HUD chip) $\to$ Rung 5 (Game HUD).
- **Argon's Reality**: Beam Rifle HUD buttons hardcoded in `TestPlayOverlay`. BUT creator cannot position camera, set custom angles, or tweak player movement speeds.
- **Required Sliders & Preset Add Buttons**:
  - Camera settings panel: FOV (60°–110°), Orbit Distance, Camera Shake Intensity (0%–100%).
  - Reticle style picker: Dot, Crosshair, Holographic Circle, Off.

### Aspect 13: Packaging, Spore Cards & Cross-World Stargates
- **Industry Benchmark**: Spore (lossless PNG export with embedded model) / Stargate dialing codes (`SG-XXXX-XX`).
- **FIDELITY Inception**: Rung 5 (World/Machine document) $\to$ RFC-2083 PNG zTXt Card $\to$ `@hm/coopnet` Stargate dialer.
- **Argon's Reality**: `spore-card-codec.ts` correctly encodes/decodes RFC-2083 PNGs with compressed JSON `zTXt`. BUT modal displays raw JSON text instead of rendering a gorgeous collectible visual card with a 3D beauty render.
- **Required Sliders & Preset Add Buttons**:
  - Render an actual 512x512 canvas beauty portrait with metallic border, planet name, author, dialing code, and QR glyph.
  - `[Import Spore Card]` drag-and-drop zone to drop external `.png` files directly into Studio to unpack worlds.

---

## PART 3: THE 5-RUNG INCEPTION HIERARCHY AUDIT

The foundational architectural principle of FIDELITY is:
> **Presets inside presets**: Every world is a tree of assemblies; every assembly is a tree of parts; every part is a parametric formula; every formula is driven by pure mathematical atoms.

### How Does the User Move Up and Down the Inception Tree Today?
- **Current Reality**:
  - Top bar displays plain text breadcrumbs: `[World: Campaign: Moon Outpost] > [Machine: Texture Mill V2] > [Slot: mill-base-plinth:default] > [Layer 1: Grime]`.
  - A small pill shows the active rung: `Rung 4: Kits & Assemblies (@hm/kitspec)`.
  - **Friction**: The breadcrumb is **plain text**. A user cannot click `[Machine: Texture Mill V2]` to zoom out to the machine level, or click `[World: Moon Outpost]` to zoom out to the planet level!
  - To change levels, the user has to guess which of the 4 top tabs (`Creative Suite`, `Look & Lighting`, `Scene Layout`, `Audio Lab`) or which of the 5 inspector tabs corresponds to that level.
  - There is no visual "Zoom Out to Machine" or "Dive Inside Part" button.

### The Required "Zoom In / Zoom Out" Inception UX
To fulfill the Law of One / Inception mandate, every workspace must support hierarchical traversal:
1. **Double-Click in 3D Viewport**:
   - Double-clicking a machine in the World view zooms camera into the Machine assembly view (`Rung 4`).
   - Double-clicking a part on the machine isolates that part in the PartGen/MeshOps view (`Rung 3`).
   - Double-clicking a surface on the part focuses that material slot in the MatStack view (`Rung 2`).
   - Double-clicking a procedural texture node opens its mathematical curve in the TexGraph view (`Rung 1`).
2. **Interactive Breadcrumb Navigation**:
   - Every segment in the breadcrumb bar MUST be a clickable link:
     ```
     [🪐 Moon Outpost]  ──>  [⚙️ Texture Mill V2]  ──>  [📦 Plinth Base]  ──>  [🎨 Field Hazard]
          (Rung 5)                  (Rung 4)                 (Rung 3)               (Rung 2)
     ```
   - Clicking `[⚙️ Texture Mill V2]` instantly pops up one level, shows the whole machine, and switches the inspector to Parts & Assemblies.
   - Clicking `[🪐 Moon Outpost]` pops up to the planetary level and switches the viewport to the multi-machine outpost layout.

---

## PART 4: THE CONCRETE REMEDIATION BLUEPRINT FOR ARGON & OPUS

To elevate the Studio from a collection of headless unit tests with CSS placeholder boxes into a breathtaking, fully realized creative engine, Argon and Opus must execute the following 5 engineering phases:

### Phase 1: Mount the Three.js WebGL Viewport in `studio-app.tsx`
1. Replace the empty gradient `<div>` in `studio-app.tsx` with a true Three.js viewport component: `<StudioViewportCanvas />`.
2. Initialize `THREE.WebGLRenderer`, `PerspectiveCamera`, and `OrbitControls` (turntable rotation, pan, zoom).
3. Connect `buildStudioMachineModel()` so that when `activeKitId` changes, the procedural 3D model is built and added to the scene in real time.
4. Hook up `RaycastPicker`: clicking a part on the 3D model selects that part in the store and switches the active material slot.
5. Hook up `SocketGizmos`: render 3D Triad Socket pins (red, blue, gold, green) floating on the machine.

### Phase 2: Live Terrain & Atmospheric Rendering in `LookTab`
1. Mount a WebGL canvas in `LookTab` rendering the procedural planet terrain from `@hm/plotsim` and `@hm/lattice`.
2. Bind Sun Elevation and Sun Azimuth sliders to a Three.js `DirectionalLight` and shadow map.
3. Bind Stage Scrubber (`S0` through `S6`) to the shader stage uniform:
   - S0: Activate wireframe shader.
   - S1: Activate 1-bit Bayer dither post-process.
   - S2: Activate 16-color EGA palette quantization.
   - S3: Activate Gouraud flat-lit shader.
   - S4–S6: Activate full layered PBR with progressive sky and water filling.

### Phase 3: Interactive 3D World Layout in `SceneTab`
1. Replace the HTML coordinate table in `SceneTab` with a 3D planetary staging view.
2. Render placed machines as real 3D kit instances positioned on the terrain.
3. Allow dragging machines across terrain surface with automatic collision avoidance and surface snapping (`autoSnapGrounding`).
4. Display the Stargate with its active dialing ring and pulsing event horizon.

### Phase 4: Working Audio Synthesis Engine in `AudioTab`
1. Initialize a Web Audio `AudioContext` in `AudioTab`.
2. Connect `@hm/soundlab` oscillators for motor hum, wind noise, and Stargate drone.
3. Add Play/Pause audition buttons with live canvas oscilloscopes showing audio waveforms.
4. Bind Motor RPM slider to oscillator frequency so dragging slider changes motor pitch audibly.

### Phase 5: True 3D Sandbox Playtest Mount in `TestPlayOverlay`
1. In `TestPlayOverlay`, instantiate the real player avatar (`AstroScientist`), third-person camera controller, and Beam Rifle raycast system.
2. Enable live testing: firing Beam Rifle in `APPLY` mode applies cartridges to placed machines in the world.
3. Pressing `Esc` smoothly unmounts playtest mode and restores Studio camera without state loss.

---

## CONCLUSION

Argon's headless logic, kit definitions, codecs, and unit tests are rock-solid. However, **a game creation studio cannot be experienced through unit tests**. 

By replacing the empty gradient placeholders with living Three.js canvases, connecting the existing procedural builders to the render loop, and turning text breadcrumbs into hierarchical navigation links, FIDELITY Studio will fulfill its promise as the industry's most elegant, zero-shortcut multiverse engine.
