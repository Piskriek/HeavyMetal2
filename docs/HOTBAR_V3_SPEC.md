# The hotbar spec V3 (the owner, 2026-10-04, planned with a flash model)

Kept verbatim; read with `docs/ARENA_PLAN.md` (how it maps onto SetMix and who builds what). The owner's message with it:

> ive gone and done the planning for the hotbar with a flash model, it should atleast be enough for you to plan it properly. then i want you to see what were missing and create prompts for arena.ai battle ai to code the missing parts for you(there should be some protocols on arena.ai in the catchup or docs).make the actual master plan where arena ai do all the hard work. doing that should push your session context to the limit so once the master plan is ready and the catchup is updated we compact the session, and start implimenting with arena ai. here is the flash hotbar plan :

```yaml
# ==============================================================================
# ULTIMATE 3D GAME ENGINE EDITOR HOTBAR SPECIFICATION (V3)
# Modes: Game Mode (Diegetic/Animated) | Simplified Mode | Advanced Mode
# ==============================================================================

# ==============================================================================
# GLOBAL VIEWPORT ENGINE RULES (SIMPLIFIED & ADVANCED MODES)
# ==============================================================================
GLOBAL_TRANSFORM_GIZMO_SYSTEM:
  Target_Modes: [SIMPLIFIED, ADVANCED]
  Activation: "Always automatically bound to any active selection pivot"
  Components:
    - Translation: 3-Axis orthogonal arrows (RGB -> XYZ) + planar bounding quads
    - Rotation: 3-Axis circular trackball rings + screen-space view roll ring
    - Scale: 3-Axis box terminators + central uniform-scaling triangle
  Gizmo_Sizing_Controls:
    Key_Plus (+): "Increases gizmo scale by +15% per press (larger click targets / far distance)"
    Key_Minus (-): "Decreases gizmo scale by -15% per press (reduces screen clutter / fine work)"
    Numpad_Plus/Minus: "Mirrored alternate sizing bindings"
  Snapping_Modifiers:
    Shift_Hold: "Snap translation to active grid increment (0.1m, 0.5m, 1m)"
    Ctrl_Hold: "Snap rotation to angle steps (5°, 15°, 45°, 90°)"
    Alt_Drag: "Duplicate selected entity while translating along chosen axis"

# ==============================================================================
# MODE 1: GAME MODE (Diegetic In-Game / High-Juice Animations & Feedback)
# Character: Plays first-person/third-person animations with squash-and-stretch
# Audio/VFX: Immediate punchy visual cues (pop, squish, flash, bounce)
# ==============================================================================

GAME_MODE:
  F1_GRAB_TOOL:
    Icon: "🧲 Magic Magnet / Hand"
    Character_Anim: "Extends robotic hand or glowing magnet forward with an elastic jerk"
    Tool_Feedback:
      Beam_FX: "Cyan tractor-beam lightning arches from player hand to target"
      Target_Reaction: "Target wobbles like jelly, lifts slightly off ground, drops a soft drop-shadow"
      Release_Pop: "Target snaps to rest with a tiny rubbery squash-and-stretch bounce"
    Presets:
      1: "Grab Single Toy (Picks whatever crosshair hits)"
      2: "Vacuum Bubble (Draws all small clutter into a levitating cluster)"
      3: "Freeze Wand (Flash freeze sound; ice crystals encase item in mid-air)"
      4: "Toss / Pitch (Player winds up arm and launches item forward with wind trail)"
      5: "Clone Popper (Plays 'POP!' bubble sound; item splits into two with a confetti burst)"
      6: "Trash Zap (Target shrinks into cartoon black hole and disappears with a squeak)"

  F2_COLOR_SPRAY:
    Icon: "🎨 Spray Can & Stickers"
    Character_Anim: "Shakes can vigorously (metal ball rattle sound), presses nozzle with thumb"
    Tool_Feedback:
      Spray_FX: "Conical mist of paint droplets spurts continuously from nozzle tip"
      Target_Reaction: "Rippling wet liquid wave spreads across surface from hit point"
      Decal_Thud: "Stamping stickers plays a heavy rubber stamp 'THWACK!' with cartoon star particles"
    Presets:
      1: "Rainbow Spray (Splashes bright saturated paint in a circular spread)"
      2: "Glitter Gloss (Surfaces gleam with high-specular glint stars)"
      3: "Glow Paint (Emits pulsing neon rings visible through walls)"
      4: "Sticker Stamp: Emotes (Slaps animated smiling/winking face decals on walls)"
      5: "Sticker Stamp: Splats (Splatters messy cartoon slime drips)"
      6: "Water Sponge (Player whips out giant wet sponge, wiping paint with squeaky clean sound)"

  F3_BLOCKS_AND_CLAY:
    Icon: "🧱 Toy Builder & Play-Doh"
    Character_Anim:
      Blocks: "Player tosses a small glowing capsule onto ground"
      Clay: "Player wields oversized wooden rolling pin or soft cartoon mallet"
    Tool_Feedback:
      Block_Spawn: "Capsule pops with a 'POOF' smoke cloud; block drops and settles with a thud"
      Clay_Dent: "Hitting surface depresses geometry with a wet 'SQUISH' sound and play-doh dent"
      Clay_Pull: "Yanking surface pulls geometry outwards like stretchy chewing gum"
    Presets:
      1: "Toy Brick (Drops stackable interlocking plastic block)"
      2: "Smooth Ball (Spawns sphere that immediately bounces once on impact)"
      3: "Ramp / Slide (Drops wedge ramp aligned directly to player viewing angle)"
      4: "Clay Plump (Squirts blob of clay that adds volume to terrain or prop)"
      5: "Clay Scoop (Scoops out a round bite mark from target surface)"
      6: "Clay Flatten (Whacks surface with oversized iron to press flat)"
      7: "Punch Hole (Cookie-cutter laser rings punch clean round doorway through wall)"

  F4_PUPPET_SHOW:
    Icon: "🕺 Dance & Moves"
    Character_Anim: "Pulls out musical conductor's baton and swings it rhythmically"
    Tool_Feedback:
      Visual_Cues: "Glowing golden strings attach to target's limbs like a marionette"
      Character_Reaction: "Target looks up, blinks twice, does an enthusiastic hop"
    Presets:
      1: "Live Puppet (Drag character limbs directly in real-time; character follows cursor)"
      2: "Silly Dance (Target does continuous goofy shuffle dance to cartoon kazoo music)"
      3: "Walk to Me (Target whistles and runs directly to stand in front of player)"
      4: "Follow The Leader (Target spawns trailing yellow footsteps following player path)"
      5: "Freeze Statue (Target strikes dynamic superhero pose and turns to faux-bronze)"

  F5_BOOMBOX:
    Icon: "📻 Noise Maker"
    Character_Anim: "Slaps a retro boombox onto shoulder with a tape-deck 'CLACK'"
    Tool_Feedback:
      Audio_Visual: "Pulsing concentric stereo sound waves emanate through the air"
      Subwoofer_Shake: "Ground vibrates slightly; nearby dust motes jump on every beat"
    Presets:
      1: "Funny Sounds (Fart, boing, spring, airhorn; floating musical note particles)"
      2: "Monster Roar (Screen shakes slightly; fiery red shockwave radiates out)"
      3: "Jukebox Track (Spawns floating turntable that plays looping groove)"
      4: "Echo Dome (Spawns shimmering soap bubble; talking inside gives cathedral reverb)"
      5: "Step Doorbell (Places golden floor bell that rings with a chime when stepped on)"

  F6_LANTERN:
    Icon: "💡 Flashlight & Sun Clock"
    Character_Anim: "Points high-powered brass flashlight or twists a pocket sundial"
    Tool_Feedback:
      Switch_Click: "Heavy mechanical switch 'CLACK'; bright volumetric light cone cuts darkness"
      Sun_Dial: "Player spins sundial hand; sky rapidly transitions day/night with whistling wind"
    Presets:
      1: "Sticky Flashlight (Sticks hovering glowing light orb to whatever surface is clicked)"
      2: "Campfire Glow (Spawns crackling fire orb with warm embers and dancing shadows)"
      3: "Party Strobe (Multicolor disco beam sweeps in rhythm to music)"
      4: "Turn to Noon (Sun leaps across sky; rooster crow sound effect)"
      5: "Turn to Night (Sun drops below horizon; moon rises with cricket soundscapes)"

  F7_MAGIC_CORD:
    Icon: "⚡ Zap Wire"
    Character_Anim: "Points zap-gun and fires glowing electrical plug"
    Tool_Feedback:
      Tether_FX: "Thick humming electrical cord stretches from start switch to target object"
      Plug_In: "Target emits sparks; giant electric plug snaps into place with a 'ZAP!'"
    Presets:
      1: "Step-Pad to Door (Draw cord from floor button to blast door)"
      2: "Lever to Light (Draw cord from wall switch to streetlamp)"
      3: "Tripwire Alarm (Shoots red laser beam; breaks trigger loud siren and flashing beacon)"
      4: "Bouncy Launch Pad (Cord from button to jump pad; stepping launches player up)"
      5: "Wire Cutter (Player snips cord with giant shears; sparks spray and cord recoils away)"

  F8_PHOTO_CAM:
    Icon: "📷 Snap Camera"
    Character_Anim: "Brings retro instant camera to eye; camera lens extends with whirr"
    Tool_Feedback:
      Viewfinder: "Screen darkens around edges with camera crosshairs and battery indicators"
      Shutter: "Bright white screen flash; loud shutter sound; printed polaroid ejects out"
    Presets:
      1: "Instant Polaroid (Takes shot and hangs physical photo card in 3D air)"
      2: "Selfie Stick (Camera flips to face player; character makes peace sign / thumbs up)"
      3: "Flying Drone (Spawns miniature flying camera bumblebee that player pilots)"
      4: "Slow-Mo Cam (Clock tick slows down; world drops to 20% speed for action stunts)"

  F9_TOY_BOX:
    Icon: "👾 Friend & Creature Spawner"
    Character_Anim: "Winds up large golden wind-up key, places wrapped gift package"
    Tool_Feedback:
      Unbox_Burst: "Gift box lid pops off with spring-loaded boing sound and ribbon confetti"
      Spawn_Life: "Creature jumps out of box, shakes off dust, and waves at player"
    Presets:
      1: "Playful Pet (Spawns bouncy puppy/kitten that chases balls and barks)"
      2: "Bouncing Dummy (Spawns wobbly inflatable bobo doll that springs back when hit)"
      3: "Go-Kart Toy (Drops tiny micro-car that player can jump into and drive immediately)"
      4: "Target Practice (Spawns wooden bullseye target that flips back when struck)"
      5: "Respawn Flag (Plants colorful flag; fireworks launch when player touches it)"

  F10_DIRT_AND_TREES:
    Icon: "🌲 Sandbox & Shovel"
    Character_Anim: "Drives cartoon garden spade into soil with both hands"
    Tool_Feedback:
      Dig_Heave: "Dirt chunks and pebble particles launch in arcs from the shovel point"
      Tree_Sprout: "Sprouts tiny seedling that inflates like an accordion into full tree in 0.5s"
    Presets:
      1: "Mound Builder (Ground balloons upward under cursor with rumbling earth sound)"
      2: "Pit Digger (Ground collapses inward smoothly creating a swimming hole or moat)"
      3: "Lawn Roller (Pushes giant green roller that leaves behind manicured grass)"
      4: "Plant Oak Tree (Instant leafy tree sprouts with rustling leaf cascade)"
      5: "Flower Sprinkler (Sprays watering can; daisy and tulip heads pop open instantly)"

  F11_PHYSICS_PLAY:
    Icon: "🎈 Bouncy Ball & Float"
    Character_Anim: "Taps target item with glowing star-tipped fairy wand"
    Tool_Feedback:
      Aura_FX: "Target gains colorful rim-lighting aura representing its physics type"
      Physics_Haptics: "Bouncy items stretch into oval shapes; heavy items drop with screen-shake"
    Presets:
      1: "Super Bouncy (Item rebounds wildly off surfaces with rubbery 'BOING' sounds)"
      2: "Zero Friction (Item slides infinitely across floors like wet puck on ice)"
      3: "Tether Balloon (Ties red helium balloon to item; gently floats up to ceiling)"
      4: "Super Anvil (Item gains 10,000kg weight; falls like lead and cannot be nudged)"
      5: "Push Hammer (Giant wooden hammer swings and sends all nearby clutter flying)"

  F12_MAGIC_WAND:
    Icon: "✨ Magic Sparkles"
    Character_Anim: "Twirls wand in circular flourish; wand tip leaves sparkling rainbow trail"
    Tool_Feedback:
      Sparkle_Spray: "Fountain of colored glitter falls and bounces on ground surfaces"
      Firework_Launch: "Rocket whistles upwards and explodes into glowing starburst rings"
    Presets:
      1: "Firework Launcher (Fires celebratory bursts of multicolored star sparks)"
      2: "Bonfire Flame (Summons cozy crackling cartoon fire with dancing embers)"
      3: "Bubble Stream (Continuous flow of soap bubbles that pop on character touch)"
      4: "Dust Cloud (Puffs cloud of soft white smoke that lingers and dissipates)"
      5: "Shooting Star Trail (Draws 3D glowing light ribbon that traces player movements)"

---

# ==============================================================================
# MODE 2: SIMPLIFIED MODE (Universal Gizmo Active + Plain Sliders)
# ==============================================================================

SIMPLIFIED_MODE:
  SELECTION_RULE: "Selecting ANY entity displays active Move/Rotate/Scale Gizmo"
  GIZMO_HOTKEYS: "'+' to scale gizmo up, '-' to scale gizmo down"

  F1_SELECT:
    Name: "Pick & Box Select"
    SubTools:
      1: "Click Picker"
         Sliders: [Reach Distance: 1-100m, Outline Thickness: 1-5px]
         Presets: [Pick Anything, Only Props, Only Characters, Only Lights]
      2: "Box Drag"
         Sliders: [Depth Limit: On/Off]
         Presets: [Enclosed Only, Touch Any Part]
      3: "Group Linker"
         Sliders: [None]
         Presets: [Link as Single Object, Unlink Object, Lock in Place]

  F2_PAINT:
    Name: "Color & Material Painter"
    SubTools:
      1: "Surface Color Paint"
         Sliders: [Brush Size: 0.1-10m, Color Picker: RGB, Opacity: 0-100%]
         Presets: [Matte Paint, Glossy Car Finish, Glowing Neon, Metallic Chrome]
      2: "Decal Sticker"
         Sliders: [Size: 0.1-5m, Rotation: 0-360°, Fade Edges: 0-100%]
         Presets: [Dirt & Grime, Cracks & Holes, Posters, Road Markings]
      3: "Color Eraser"
         Sliders: [Eraser Radius: 0.1-10m, Softness: 0-100%]
         Presets: [Erase Layer, Revert to Default Material]

  F3_SHAPES_AND_SCULPT:
    Name: "Basic Shapes & Clay Sculpt"
    SubTools:
      1: "Add Building Block"
         Sliders: [Width: 0.1-50m, Height: 0.1-50m, Snap to Grid: 0.25/0.5/1m]
         Presets: [Cube, Ball, Cylinder, Wedge, Staircase, Hollow Box]
      2: "Clay Modeling"
         Sliders: [Brush Size: 0.1-5m, Push/Pull Strength: 1-100%, Surface Softness: 1-100%]
         Presets: [Add Clay, Dig Out, Smooth Surface, Flatten Flat]
      3: "Cut & Carve (Booleans)"
         Sliders: [Hole Border Bevel: 0-10cm]
         Presets: [Cut Hole Out, Join Shapes Together, Cut in Half]

  F4_ANIMATE:
    Name: "Character Moves & Sequences"
    SubTools:
      1: "Pose Adjuster"
         Sliders: [Limb Turn: -180 to +180°, Mirror Other Side: Toggle]
         Presets: [Standing Rest, Action Ready, Sitting Down, Fallen Down]
      2: "Walk Path Creator"
         Sliders: [Move Speed: 1-20 km/h, Wait at Stop: 0-60s]
         Presets: [Back & Forth Loop, Circle Track, One-Way Trip]
      3: "Quick Animator"
         Sliders: [Play Speed: 0.25x-2.0x, Loop: Yes/No]
         Presets: [Idle Breathe, Walk, Run, Jump, Cheer, Defeat]

  F5_AUDIO:
    Name: "Sound & Ambience"
    SubTools:
      1: "Place Sound Effect"
         Sliders: [Loudness: 0-100%, Hearing Distance: 1-50m, Pitch: 50-150%]
         Presets: [Footstep Click, Machine Hum, Water Drop, Explosion Boom]
      2: "Background Ambience Zone"
         Sliders: [Volume: 0-100%, Fade In/Out Area: 1-10m]
         Presets: [Forest Birds, Windy Hill, Creepy Cave, Busy City, Rainy Day]

  F6_LIGHTS:
    Name: "Lighting & Sun"
    SubTools:
      1: "Add Light Bulb"
         Sliders: [Brightness: 0-100%, Glow Range: 1-30m, Light Color: Palette]
         Presets: [Soft Desk Lamp, Tight Flashlight, Overhead Ceiling, Color Mood]
      2: "Sky & Time of Day"
         Sliders: [Time Slider: 0:00-24:00, Sun Strength: 0-100%, Cloudiness: 0-100%]
         Presets: [Bright Noon, Golden Sunset, Clear Starry Night, Stormy Dark]

  F7_RULES:
    Name: "Simple Logic & Switches"
    SubTools:
      1: "Trigger Zones"
         Sliders: [Zone Size: 1-20m, Trigger Delay: 0-10s]
         Presets: [Player Enters Area, Player Leaves Area, Player Presses 'E']
      2: "Action Links"
         Sliders: [Repeat Limit: Once/Infinite, Delay Before Action: 0-30s]
         Presets: [Open Door, Turn On Light, Play Sound, Damage Player, Teleport]

  F8_CAMERA:
    Name: "Camera & Cutscenes"
    SubTools:
      1: "Camera Placer"
         Sliders: [Field of View: 30-110°, Blur Background: 0-100%]
         Presets: [Cinematic 16:9, Close-up Portrait, Wide Scenic View]
      2: "Fly-Through Track"
         Sliders: [Flight Duration: 1-60s, Smoothness: 1-100%]
         Presets: [Gentle Pan, Fast Flyby, Spin Around Object]

  F9_CHARACTERS:
    Name: "Characters & Simple AI"
    SubTools:
      1: "Spawn Character"
         Sliders: [Health: 1-1000, Movement Speed: 1-10m/s]
         Presets: [Player Start Point, Friendly NPC, Wandering Animal, Guard Enemy]
      2: "AI Behavior"
         Sliders: [Sight Distance: 5-50m, Reaction Delay: 0.1-2.0s]
         Presets: [Stand Still, Patrol Line, Chase Player, Flee from Player]

  F10_TERRAIN:
    Name: "Ground & Foliage"
    SubTools:
      1: "Ground Sculptor"
         Sliders: [Brush Width: 1-100m, Raise/Lower Speed: 1-100%]
         Presets: [Make Mountain, Dig Valley, Flat Plateau, Smooth Bumps]
      2: "Plant Scatter"
         Sliders: [Forest Density: 1-100%, Size Randomness: 0-100%]
         Presets: [Lawn Grass, Dense Forest, River Rocks, Desert Cactus]

  F11_PHYSICS:
    Name: "Physics & Collisions"
    SubTools:
      1: "Solid Boundaries"
         Sliders: [Thickness: 0.05-1m]
         Presets: [Walk-Through Ghost, Solid Wall, Invisible Barrier, Climbable Ladder]
      2: "Physical Material"
         Sliders: [Bounciness: 0-100%, Heaviness: 0.1-1000kg, Friction/Grip: 0-100%]
         Presets: [Normal Wood, Super Bouncy Rubber, Slippery Ice, Heavy Metal]

  F12_EFFECTS:
    Name: "Visual VFX & Atmosphere"
    SubTools:
      1: "Particle Spawner"
         Sliders: [Effect Size: 0.1-10m, Particle Count: 1-500, Particle Speed: 1-100%]
         Presets: [Campfire & Smoke, Falling Snow, Torrential Rain, Dust Sparks]
      2: "Screen Mood Filter"
         Sliders: [Filter Strength: 0-100%, Screen Vignette: 0-100%]
         Presets: [Warm Vintage, Cold Sci-Fi, Horror Dark, Retro Arcade Comic]

---

# ==============================================================================
# MODE 3: ADVANCED MODE (Universal Gizmo Active + Full Production Pipeline)
# ==============================================================================

ADVANCED_MODE:
  SELECTION_RULE: "Selecting ANY entity displays active Move/Rotate/Scale Gizmo"
  GIZMO_HOTKEYS: "'+' to scale gizmo up, '-' to scale gizmo down"

  F1_SELECTION:
    Tools: [Raycast Pointer, Marquee Box, Lasso, Surface Paint, Hierarchy, Similar]
    Filters: [Static Mesh, Lights, Skeletal Mesh, Triggers, Splines, Decals]
    Modifiers: [Ctrl+Click Append, Alt+Click Invert, Shift+DblClick Connected]

  F2_BRUSHES:
    Tools: [PBR Surface Paint, Vertex Color, Triplanar Projection, Clone Stamp]
    Filters: [Albedo RGB, Roughness, Metalness, Tangent Normal, Ambient Occlusion]
    Modifiers: [[ / ] Radius Adjust, Shift+Drag Laplacian Smooth, Alt Eyedropper]

  F3_GEOMETRY:
    Tools: [Primitive Generator, ZBrush Clay Sculpt, DynMesh, CSG Booleans, Retopo]
    Presets:
      1: "Clay Buildup (Dynamic Volumetric Sculpting)"
      2: "DynMesh / Dyntopo (Procedural Tessellation On Stroke)"
      3: "Texture Heightmap Sculpt (16-bit Float Displacement)"
      4: "Tangent Normal Micro-Groove Sculpt (Vector Displace)"
      5: "Hard-Surface Trim Planar Polish & Crease"
      6: "CSG Union / Difference / Intersect Booleans"
      7: "Quad-Remesh & Edge-Loop Slicer"
    Modifiers: [Ctrl+Drag Invert Sculpt, Shift+Drag Relax, M Toggle Texture/Geo]

  F4_ANIMATION:
    Tools: [Auto-Key Transform, Spline Path, Dope Sheet, Onion Skinning, Root Lock]
    Filters: [Key Hierarchy, Key Selected Bones, Mirrored Pose, Tangent Bezier/Step]
    Modifiers: [I Keyframe Punch, J/K/L Video Shuttle Scrub, Alt+R Reset Rotation]

  F5_SOUND:
    Tools: [3D Point Emitter, Reverb Volume, Directional Cone, Occlusion Mask]
    Filters: [Logarithmic Falloff, Doppler Link, HF Wall Dampening, Audio Busses]
    Modifiers: [Alt+Scale Falloff Radii, P Audition Spatial Audio At Cursor]

  F6_LIGHTS:
    Tools: [Point Light, Spot Light, Directional Sun, Rect Softbox, Reflection Probe]
    Filters: [Color Temp Kelvin, Stationary/Movable/Static, Volumetric Fog Multiplier]
    Modifiers: [Ctrl+L+Drag Aim Directional Sun, C Pilot Light as Viewport Camera]

  F7_LOGIC:
    Tools: [Trigger Volume, Visual Wire Graph, Gate Relay, Actor Factory, Debug Probe]
    Filters: [Overlap Events, Hit Events, Blackboard Flags, Logic AND/OR/Branch]
    Modifiers: [Shift+Drag Wire Pin to Target, Alt+Click Sever Signal Line]

  F8_CAMERA:
    Tools: [Cine Dolly Camera, Boom Arm, Ortho Blueprint, Viewport Bookmark]
    Filters: [Sensor Size 35mm, Aperture f/1.4-f/22, ISO, Focal Length 14-200mm]
    Modifiers: [Ctrl+1..9 Save Slot, 1..9 Recall Slot, Ctrl+Shift+P Pilot Mode]

  F9_AVATARS:
    Tools: [Spawn Point, Waypoint Spline, Socket Anchor, Ragdoll Joint, AI Tree]
    Filters: [Team Tags, Behavior Trees, Sockets (Weapon/Hand/Spine), Hitboxes]
    Modifiers: [Alt+Drag Duplicate Patrol Waypoint, G Toggle Game View Gizmos]

  F10_TERRAIN:
    Tools: [Heightmap Sculpt, Hydraulic Erosion, Spline Road/River, Biome Scatter]
    Filters: [Slope Constraints (>45° Stone), Altitude Masks, Triplanar Blends]
    Modifiers: [Ctrl+Drag Carve Canyon, Shift+Paint Density Trim, Ctrl+Wheel Density]

  F11_PHYSICS:
    Tools: [Convex Hull Auto-Fit, Physics Joint Hinge, NavMesh Bounds, Force Field]
    Filters: [Kinematic / Dynamic, Elasticity, Static Friction, NavMesh Cost Area]
    Modifiers: [P Trigger Live Physics Simulation, Shift+P Reset Transforms]

  F12_MATERIALS_VFX:
    Tools: [Material Sampler, Post-Process Volume, Niagara System, Triplanar UV]
    Filters: [LUT Color Grading, Depth of Field Bokeh, GTAO, Cel-Shade, Niagara GPU]
    Modifiers: [Shift+Click Propagate Material, Spacebar Re-trigger Particle Burst]
```

## V3.1: what Claude added and changed (2026-10-04)

The owner, after "no hybrid": "now is the time to make changes if you feel the hotbar can be improved, is there somthing were missing, add or adjust and get to work". The spec above stays as written; these are the changes on top of it. `packages/buildkit/src/v3.ts` holds the result as data (the names above, word for word, plus what is listed here).

### Buttons V3 had no place for

- **Props.** V3 places blocks, plants and creatures, but nowhere the island's own things: barrels, trophies, plinths, goblin statues, ball racers, bushes, rocks.
  - Game F3 gets preset 8, **Prop Box**: a row of props pops up while you hold it, and the next click drops the one you picked with a POOF.
  - Simplified F3 gets sub-tool 4, **Place Props**: sliders Size (50 to 200%) and Random Turn; presets Palm, Bush, Rock, Flowers, Barrel, Trophy, Plinth, Goblin Statue, Ball Racer.
  - Advanced F3 gets the tool **Prop Placer**, with the whole catalogue in its options row.
- **Ground materials.** "Color & Material Painter" (Simplified F2) painted things but not the ground. It gets sub-tool 4, **Ground Material**: sliders Brush Size and Softness; presets Grass, Sand, Rock, Moss, Mud, Lava, Cobbles, Dirt Road.
- **Paths and water.** Roads, rivers and rain wear were built for Advanced F10 only.
  - Simplified F10 gets sub-tool 3, **Paths & Water**: Dirt Path, Stone Road, River, Rain Wear.
  - Game F10 gets preset 6, **Creek Digger**: click along, then click the last spot again, and a stream fills it.
- **Save as Toy** (Simplified F1, Group Linker; coming): a linked group becomes one of your toys in the Prop Box, under My Toys.
- **Undo and Redo buttons** at the end of the hotbar in every mode. Ctrl+Z and Ctrl+Y work as always.
- **Find a tool**: `/` searches every button of the mode by name, and Enter takes you there.
- **Dress up**: the goblin mirror (the old Avatar tab) moves to a Dress up button in the top bar and the Esc menu. This frees P for the spec's own P keys.

### Keys changed (a browser game: some of the spec's keys belong to the browser or to walking)

- F8 Advanced, **Ctrl+1..9** switches browser tabs, so **Shift+1..9** saves a camera slot instead. 1..9 recall a slot only while Viewport Bookmark is held; with any other tool, 1..9 pick tools.
- F8 Advanced, **Ctrl+Shift+P** opens a private window in Firefox, so **Alt+P** starts Pilot Mode.
- F12 Advanced, **Spacebar** jumps (and flies up), so **R** re-triggers a particle burst.
- F6 Advanced, **C** flies down, so **Alt+C** pilots a light as the camera.
- **F11 and F12** belong to the browser (full screen, developer tools), so **Shift+F1** and **Shift+F2** open them. Every tab can also be clicked.
- **E** stays the player's interact key (the spec's "Player Presses 'E'"). It no longer opens a presets window.
- **Backtick (`)** switches mode: Game, then Simplified, then Advanced.
- **Tab** frees the mouse for the sliders, presets and filters while you walk. Tab again, or a click in the world, takes it back.

### Rules added

- **Switching mode keeps your tab.** Each F-key is one topic in all three modes: F3 is Blocks and Clay, Shapes and Sculpt, and Geometry.
- **Left does, right does the opposite**: dig and add, paint and sponge, place and take away. Every button's tooltip says both.
- **The wheel** steps through the slots. Coming: while Grab carries a toy, the wheel turns it and Shift+wheel sizes it, because Game Mode has no gizmo. The carried toy has to show in your hands first.
- **The gizmo follows the selection in every tab** of Simplified and Advanced, not only F1.
- **Each tab remembers** its slot and preset in each mode. Simplified's sliders remember their values per sub-tool and have a Reset.
- **No custom rows.** The buttons are the spec's and they are fixed; the old Hotbar settings and the E window go.
- **Nothing is a dead click.** A button whose engine is not built yet shows as coming (a dot on it) and says so when used.
- **Comfort and safety**: nothing flashes more than three times a second, anywhere. Party Strobe sweeps without strobing, and the shutter flash is a soft fade. Reduce motion turns screen shakes and wobbles off.
- **Low-end (GTX 950M, the minimum)**: on Low, Glow Paint's through-wall rings, volumetric light cones, GTAO and depth of field step down or switch off.
