/* ============================================================================
   SETMIX :: GAME DESIGN DOCUMENT — DATA LAYER
   Every number here is a tuned, shippable first-pass value.
   ========================================================================== */

export const META = {
  title: "SETMIX",
  subtitle: "The Resolution Crafter",
  version: "GDD v1.0 — Pre-Production Blueprint",
  logline:
    "Terraforming a planet means raising its render fidelity. You do not plant trees — you plant the math that makes trees possible.",
  pillars: [
    {
      n: "01",
      name: "Fidelity Is Progress",
      body:
        "Every upgrade is visible on screen within seconds. The reward for labour is not a number going up — it is the world literally becoming more beautiful around your boots.",
    },
    {
      n: "02",
      name: "Two Bodies, One Player",
      body:
        "A high-fidelity scientist in a white lab; a 48-triangle goblin on a dead moon. The portal is the game's thesis statement: authorship on one side, consequence on the other.",
    },
    {
      n: "03",
      name: "Math Is The Material",
      body:
        "Noise, subdivision, scattering and BRDFs are the ore, the lumber and the stone. Players learn real graphics by farming it.",
    },
    {
      n: "04",
      name: "Everything You Make Is Portable",
      body:
        "A preset is an object. It fits in a pocket, slots into a machine, and exports as a .setmix bundle another player can slot into their moon.",
    },
  ],
};

/* ---------------------------------------------------------------- METRICS */
export type Metric = {
  key: "pxd" | "vtx" | "lx" | "aq";
  symbol: string;
  name: string;
  color: string;
  unit: string;
  weight: number;
  controls: string;
  realConcept: string;
  curve: string;
  starveSymptom: string;
  gluttonSymptom: string;
  sources: string[];
};

export const METRICS: Metric[] = [
  {
    key: "pxd",
    symbol: "Pxd",
    name: "Pixel Density",
    color: "#ff3d8a",
    unit: "px·m⁻²",
    weight: 0.3,
    controls:
      "Texel budget per world-metre, colour depth (2 → 8 → 24 bit), dither kernel, and how many fBm octaves a surface shader is allowed to evaluate.",
    realConcept: "Texture resolution · colour quantisation · mip chains · noise octaves",
    curve: "texel_m = clamp(2 · log₂(1 + Pxd/64), 1, 512)   ·   octaves = floor(1 + log₂(1 + Pxd/120))",
    starveSymptom:
      "Surfaces read as flat gouache. Dither crawls visibly. Distant chunks render as single average-colour blobs (the 'Blob Horizon').",
    gluttonSymptom:
      "Texel thrash: surfaces shimmer with un-filtered high-frequency noise until Vtx catches up and gives the detail somewhere to live.",
    sources: ["Pixel Chimney", "Chromatic Kiln", "Palette Loom", "Crystal Auto-Miner"],
  },
  {
    key: "vtx",
    symbol: "Vtx",
    name: "Geometric Flux",
    color: "#7cff4d",
    unit: "tri·ha⁻¹",
    weight: 0.3,
    controls:
      "Voxel chunk subdivision depth, dual-contouring sharpness, normal smoothing angle, prop mesh tiers and silhouette LOD distance.",
    realConcept: "Tessellation · subdivision surfaces · smoothing groups · LOD budgets",
    curve: "subdiv = floor(log₂(1 + Vtx/48))   ·   smoothAngle° = 180 · (1 − e^(−Vtx/5e4))",
    starveSymptom:
      "The world stays cubic. Slopes are staircases, movement is a stepped clamber, water (if any) pools in rectangular prisms.",
    gluttonSymptom:
      "'Poly-fever': over-dense meshes with a 2-bit palette produce moiré. The game hints at the imbalance through the Coherence meter.",
    sources: ["Harmonic Mesh Vibrator", "Topology Press", "Subdivision Spire", "Erosion Drone"],
  },
  {
    key: "lx",
    symbol: "Lx",
    color: "#ffc13d",
    name: "Atmospheric Lumens",
    unit: "lm·sr⁻¹",
    weight: 0.25,
    controls:
      "The lighting model itself: unlit → per-vertex lambert → directional + shadow maps → probe GI → volumetric participating media.",
    realConcept: "Shading models · shadow mapping · global illumination · scattering",
    curve: "model = step(Lx; 0, 900, 2.4e4, 4.1e5, 6.5e6)   ·   shadowCascades = min(4, floor(Lx/3e4))",
    starveSymptom:
      "Hard unlit silhouettes with no depth cue; the player misjudges cliff distance — a genuine (and intentional) early-game hazard.",
    gluttonSymptom:
      "Over-bright bloom wash: an un-dithered sky at low Pxd bands into visible Mach rings. Comedic, diegetic, fixable.",
    sources: ["Lumen Mast", "Photon Bloom Array", "Rayleigh Bellows", "Probe Lantern Net"],
  },
  {
    key: "aq",
    symbol: "Aq",
    name: "Hydrology / Fluidity",
    color: "#3dc8ff",
    unit: "m³·s⁻¹",
    weight: 0.15,
    controls:
      "Sea level, flow-field solver resolution, buoyancy physics, caustic projector quality, wetness masks and precipitation.",
    realConcept: "Fluid sim LOD · refraction & caustics · wetness/porosity masks · buoyancy",
    curve: "seaLevel_m = 0.0 + 42 · (Aq / (Aq + 8.0e5))   ·   waveOctaves = floor(Aq/2.5e5)",
    starveSymptom: "Dust. Statics. Nothing grows, and biome cartridges in the soil refuse to germinate.",
    gluttonSymptom:
      "Drowned terraforming: sea level swallows your extractor farm. Flood management becomes a genuine mid-game engineering problem.",
    sources: ["Clathrate Sublimator", "Condensation Tower", "Caustic Loom", "Glacier Cracker"],
  },
];

/* ------------------------------------------------------------- FI FORMULA */
export const FI_MODEL = {
  master:
    "Fi = κ · ( Pxd^0.30 · Vtx^0.30 · Lx^0.25 · Aq^0.15 ) · C        κ = 1.0 (global tuning scalar)",
  coherence:
    "C = 1 − 0.45 · σ(n̂) / μ(n̂)      where n̂ = each metric normalised to its stage-6 target",
  rate:
    "dFi/dt = Σ(machineYield · tierMult · cartridgeAffinity · clockSatisfaction) − entropyDrain",
  entropy: "entropyDrain = 0.015 · Fi^0.82 · (1 − maintenanceCoverage)",
  note:
    "The exponents are the design. Pxd and Vtx are co-equal because texture without topology is wallpaper and topology without texture is clay. Aq is cheapest because water arrives as a *consequence* of the other three, not a parallel grind. The coherence term C punishes min-maxing a single metric: a planet that is 100% pixels and 0% polygons renders as screaming confetti and scores 0.55× — the game's only soft-fail state.",
};

/* -------------------------------------------------------------- 6 STAGES */
export type Stage = {
  id: number;
  code: string;
  name: string;
  fiMin: number;
  fiMax: number;
  duration: string;
  tagline: string;
  visual: string[];
  avatar: string;
  sound: string;
  physics: string;
  systemic: string[];
  threat: string;
  palette: string[];
  sky: [string, string];
  water: string | null;
  techNote: string;
};

export const STAGES: Stage[] = [
  {
    id: 1,
    code: "S1",
    name: "Coarse Wireframe / Flat Block",
    fiMin: 0,
    fiMax: 1_200,
    duration: "≈ 0–45 min",
    tagline: "The Desolate Moon",
    visual: [
      "8 m cubic voxels, hard 90° silhouettes, zero bevel. Terrain is literally the signed-distance field rounded to the nearest integer.",
      "Four-colour unlit palette (#2B2F36 / #4A515C / #6E7682 / #9AA3B0) with no interpolation — the renderer is running an honest 2-bit framebuffer at 1/6 internal resolution, nearest-upscaled.",
      "Sky is pure black with a static 1-px starfield (a texture, not a simulation). No horizon line, no fog, no sun disc.",
      "Draw distance 180 m, beyond which chunks collapse to a single averaged quad — the 'Blob Horizon'.",
    ],
    avatar:
      "48-triangle goblin astronaut. Two-frame walk cycle snapping at 8 fps, no IK, no finger joints, head is a single box with a decal visor. Jump arc is parabolic but position is quantised to 0.25 m.",
    sound:
      "4-bit square-wave footsteps, 8 kHz mono, no reverb, no occlusion. Ambience is a single 1.2 s looping drone. Even the audio is low-resolution — players notice this before they can articulate why.",
    physics:
      "Stepped collision against axis-aligned boxes. No slopes: you clamber. No friction variance, no ragdoll. Gravity 1.62 m/s². Objects dropped do not roll — they snap to grid.",
    systemic: [
      "Hand-mining only (Chromatic Crystals, Topology Shards)",
      "Coherence drains outside the Portal field at 0.9 %/s",
      "One cartridge carry slot",
      "Lab: only the Bench and the Pixel Vaporizer blueprint are powered",
    ],
    threat: "Null Pits — unrendered holes in the SDF that delete any entity that falls in. Flagged only by missing starfield.",
    palette: ["#2b2f36", "#4a515c", "#6e7682", "#9aa3b0"],
    sky: ["#02030a", "#05060e"],
    water: null,
    techNote:
      "Renders at ~11% of the GPU frame budget. This is deliberate headroom banking: the cheapest-looking stage is also the cheapest-running stage, so the governor has 14 ms in the bank for stage 6.",
  },
  {
    id: 2,
    code: "S2",
    name: "Dithered Palette & Sky Glint",
    fiMin: 1_200,
    fiMax: 30_000,
    duration: "≈ 45 min – 3 h",
    tagline: "Colour arrives before form.",
    visual: [
      "Palette expands 4 → 16 → 64 entries. A 4×4 Bayer ordered-dither kernel blends between palette entries; players watch gradients emerge from checkerboards.",
      "Internal render scale climbs 1/6 → 1/3. Edges stop being staircases and start being soft staircases.",
      "First light: a single directional 'sun glint' adds per-face N·L lambert terms. Cubes gain a bright side and a dark side; the moon suddenly has a readable topography.",
      "A thin indigo band appears at the horizon — Rayleigh scattering at 2% strength. The first time the sky is not black is a landmark emotional beat.",
    ],
    avatar:
      "Goblin gains 420 triangles, separated limbs, 5-frame walk at 15 fps, and a dithered albedo on the suit. The visor becomes reflective (a single cubemap sample).",
    sound:
      "22 kHz stereo. Footsteps become 3-sample material-aware variants (dust / crystal / metal). A low wind bed fades in as the atmosphere thickens — audio fidelity is tied to Pxd, deliberately.",
    physics:
      "Slope traversal unlocked up to 28°. Collision moves from AABB to capsule-vs-heightfield. Dropped items now tumble with simple rigid-body integration.",
    systemic: [
      "Pixel Chimney T1 & Harmonic Vibrator T1 constructible",
      "Palette Loom unlocks in lab → first Material Preset authoring",
      "Carry slots 1 → 3; the Deck UI appears",
      "Noise Storms begin spawning (weather as antagonist)",
    ],
    threat:
      "Aliasing Wasps — swarms that attach to high-frequency surfaces, locally dropping Pxd and chewing a shimmer-hole in your terrain until swatted or flood-filled.",
    palette: ["#3a3340", "#6a5a63", "#9a8a86", "#cbbfae"],
    sky: ["#070915", "#161a33"],
    water: null,
    techNote:
      "Dither is executed as a full-screen blue-noise LUT in a single post pass — 0.28 ms. Palette width is a uniform, not a shader variant, so there is zero recompilation hitching.",
  },
  {
    id: 3,
    code: "S3",
    name: "Subdivided Geometry & Atmospheric Haze",
    fiMin: 30_000,
    fiMax: 750_000,
    duration: "≈ 3 h – 9 h",
    tagline: "The world stops being made of boxes.",
    visual: [
      "Dual-contouring kicks in: cubes bevel, then chamfer, then relax into continuous hills. A geomorph pass animates every vertex to its new position over 1.4 s — no pops, only melting.",
      "Triplanar procedural materials replace flat colours: 3-octave fBm albedo + curvature-driven edge wear. Normal maps arrive, so surfaces have bumps that move with the sun.",
      "Exponential height fog + aerial perspective. Distance becomes legible; mountains read as far away instead of merely small.",
      "Shadow maps (2 cascades). The first time your goblin casts a shadow, the planet feels inhabited.",
    ],
    avatar:
      "2.8k triangles, skeletal IK on feet (your goblin now stands correctly on slopes), cloth-sim cape toggle, and procedural head-look at points of interest.",
    sound:
      "48 kHz, convolution reverb driven by terrain occupancy — canyons echo. Footsteps gain a wetness parameter even before water exists (foreshadowing Aq).",
    physics:
      "True continuous collision. Slide, sprint, slope-dependent momentum, rolling boulders. Vehicles become viable; the first Scrap Strider chassis can be printed.",
    systemic: [
      "Template Injector unlocked — cartridges can finally be slotted into the world",
      "The Fusion Matrix comes online in the lab (2-input fusions)",
      "Drone Dock automates one ore class",
      "Terraform waves become visible as travelling resolution shockwaves",
    ],
    threat: "Z-Fight Rifts — unstable seams where two chunk LODs disagree; they flicker, damage coherence, and must be stitched with a Seam Welder.",
    palette: ["#4a4237", "#6b6350", "#8a8a70", "#b6b49a"],
    sky: ["#16233a", "#3a5574"],
    water: null,
    techNote:
      "Chunk re-meshing happens on worker threads into a double-buffer; the swap is a single pointer flip on a frame where the chunk is off-screen or alpha-hashed. Zero main-thread stalls above 2 ms.",
  },
  {
    id: 4,
    code: "S4",
    name: "Liquid Condensation",
    fiMin: 750_000,
    fiMax: 5_000_000,
    duration: "≈ 9 h – 20 h",
    tagline: "The valleys flood.",
    visual: [
      "Sea level rises on an authored curve (seaLevel = 42·Aq/(Aq+8e5)). Craters become lakes, canyons become fjords. The flood is slow enough to plan around and fast enough to notice in one session.",
      "Screen-space refraction, depth-tinted absorption (Beer–Lambert), Gerstner wave stacks, and projected caustics on the lake floor.",
      "Rain. Wetness masks darken albedo and raise specular; puddles accumulate in curvature lows via a flow-map solver.",
      "Clouds: billboard cumulus → raymarched volumetrics when the budget governor allows it.",
    ],
    avatar:
      "Suit gains wetness shading, swim and dive states, buoyancy, bubble VFX, and a muffled underwater audio bus. The goblin finally has eyes that blink.",
    sound:
      "Full material-aware foley, water body occlusion, rain on helmet (a separate close-mic layer), and an adaptive score that adds a string pad the first time the player swims.",
    physics:
      "Buoyancy, drag, current fields, floating structures, and water-wheel power. Flooding can destroy badly-sited machines — the first time the game asks for foresight.",
    systemic: [
      "Hydro power & boats; underwater ore (Deep Chroma)",
      "Fusion Matrix 3-input fusions unlock",
      "Biome cartridges can now germinate (plants need Aq ≥ 1.1e6)",
      "Flood Planner overlay added to the Lab's Planet Table",
    ],
    threat: "Null Tides — a decohered flood of untextured 'magenta water' that spreads if Aq outruns Pxd by 3×. Pure error-state-as-monster.",
    palette: ["#3c4a35", "#5d6b43", "#8a8458", "#b9ac86"],
    sky: ["#2b4f78", "#86b4dd"],
    water: "#1f6f9e",
    techNote:
      "Water is one screen-space layer, not a mesh soup: a single quad per water volume with analytic wave normals. Caustics are a 256² animated projector atlas shared by every body of water on the planet.",
  },
  {
    id: 5,
    code: "S5",
    name: "Biome Shading",
    fiMin: 5_000_000,
    fiMax: 26_000_000,
    duration: "≈ 20 h – 40 h",
    tagline: "Procedural PBR flora & fauna.",
    visual: [
      "Full metal/rough/AO PBR. Subsurface scattering on leaves. Parallax-occlusion on rock. Anisotropic sheen on grass.",
      "GPU-instanced flora scattered by a blue-noise point set, masked by slope/altitude/moisture rules the player wrote in the lab.",
      "Fauna: cartridge-defined creatures with boid flocking, simple ecology (grazer → predator → scavenger), and a population curve bounded by biomass.",
      "Volumetric god-rays, bounce GI from probes, colour-graded time-of-day with a full 24 min day cycle.",
    ],
    avatar:
      "Hero-tier goblin: 48k triangles, PBR suit with authored wear, facial blendshapes, breath fog in cold biomes, and dynamic mud/sand accumulation on boots.",
    sound:
      "Procedural biome ambience assembled from the same cartridges that built the biome — a grass cartridge carries its own grain of insect chirp. Layered diegetic ecology audio.",
    physics:
      "Soft-body foliage interaction, wind fields that push both grass and the player's cape, creature ragdolls, and destructible rock with Voronoi fracture.",
    systemic: [
      "Ecology sim: food webs, seasonal migration, biome competition",
      "4-input Fusion, Rule cartridges (altitude/slope/moisture masks)",
      "Export pipeline opens: publish .setmix bundles to the Voxel Galaxy",
      "Lab reaches full power; Studio-grade tools unlock inside Play Mode",
    ],
    threat: "Overfit Blight — a biome so dominant it monocultures the planet, dropping the Variety multiplier and literally greying out the colour grade.",
    palette: ["#2f5c34", "#49803f", "#6fa14b", "#a8c07a"],
    sky: ["#3f7fc4", "#a9d2f0"],
    water: "#1d85b8",
    techNote:
      "Foliage uses one uber-shader with 12 instanced parameters. Scatter sets are baked into virtual pages streamed by camera proximity — a 4 km² prairie costs 2.1 ms.",
  },
  {
    id: 6,
    code: "S6",
    name: "Master Render",
    fiMin: 26_000_000,
    fiMax: 100_000_000,
    duration: "≈ 40 h +",
    tagline: "The living paradise. Raytraced, authored, yours.",
    visual: [
      "Hardware raytraced reflections/shadows where supported; software SDF-traced fallback everywhere else. Both are driven by the same Lx uniform, so there is no visual cliff between hardware tiers.",
      "Multi-bounce GI, chromatic-aberrated lens model, physically-based sky with ozone, aurorae, and weather fronts that actually advect.",
      "Megascan-grade detail via runtime material blending; the planet's final look is 100% procedural and 0% downloaded.",
      "The Finalisation Pass: the player chooses a global colour-grade LUT and a 'house style' (Painterly / Photoreal / Cel / Ukiyo-e) — the moon becomes an authored artwork, not just a finished checklist.",
    ],
    avatar:
      "The goblin stabilises into whatever the player built in the Fabricator: full-fidelity custom character with raytraced eye caustics. Crossing the portal no longer transforms you — lab and planet now render at the same tier. The two realities have merged. That is the win image.",
    sound:
      "Raytraced audio propagation, dynamic orchestral score responding to the Fidelity derivative (the music swells when the planet is improving fastest), and a full ecological soundscape.",
    physics:
      "Everything: weather-driven erosion that permanently reshapes terrain, tectonic events, seasonal hydrology, and persistent player-authored physics rigs.",
    systemic: [
      "Portal bandwidth maxes → multi-world links to other players' moons",
      "Legacy Mode: your finished planet becomes a visitable public world",
      "Fidelity Prestige: seed a new moon carrying 3 chosen cartridges",
      "Galaxy Curation: your bundles earn Render Credits from other players",
    ],
    threat: "None. The hazard systems retire — the planet now defends itself. The only remaining antagonist is your own taste.",
    palette: ["#2b5f3a", "#3f8a4a", "#72b15c", "#cfe0a0"],
    sky: ["#3c86d4", "#cfe8ff"],
    water: "#1693c9",
    techNote:
      "At stage 6 the governor is finally spending the headroom banked in stage 1. Target: 16.6 ms on a 2019 mid-range laptop at 1080p/FSR-Balanced, 8.3 ms on current-gen console.",
  },
];

/* --------------------------------------------------------- LAB MACHINERY */
export const LAB_MACHINES = [
  {
    id: "synth",
    name: "The Material Synthesizer",
    role: "Procedural math without code",
    color: "#ff3d8a",
    summary:
      "A waist-high glass slab showing a floating node graph. The player sculpts shader math by physically dragging glowing nodes with their hands — no text, no code, no units unless requested.",
    ui: [
      "LEFT — Ingredient Rail: Noise (Perlin/Worley/Simplex), Shape (gradient, curvature, altitude), Colour (ramp, palette), Operator (warp, blur, terrace, posterise).",
      "CENTRE — The Slab: a 3D node graph you rearrange with your hands; wires carry a live colour preview of the data flowing through them.",
      "RIGHT — The Orb: a 1 m sphere of the material lit by a tunable HDRI. Swipe to change the test mesh: sphere → terrain patch → goblin bust → your own saved asset.",
      "BOTTOM — The Honest Readout: live texel cost, instruction count, and an amber warning if the material exceeds the planet's current Pxd budget.",
    ],
    teaching:
      "Every node is labelled twice: a poetic name and (in Jargon Mode) the exact academic term. 'Crinkle' is also 'Domain Warp: p += 0.4·noise(p·2.1)'.",
    tiers: "T1 albedo only → T2 +roughness/normal → T3 +SSS/anisotropy/parallax → T4 +animated & vertex-displacing",
  },
  {
    id: "fusion",
    name: "The Fusion Matrix",
    role: "Preset alchemy & recipe discovery",
    color: "#b46bff",
    summary:
      "A circular pedestal with 2–4 cartridge receptacles arranged around a containment sphere. Slot presets, pull the lever, and the machine proposes hybrids — with a live preview you can veto before committing.",
    ui: [
      "The Ring: 2 slots at T1, 3 at T2, 4 at T3. Slots are physical; you walk around the machine to load them.",
      "The Speculation Sphere: shows the predicted output as a rotating hologram BEFORE you spend the inputs. Confidence % shown; low-confidence fusions are the interesting ones.",
      "The Dial of Dominance: a ring that weights which input dominates (0–100%). Same two inputs, radically different children.",
      "The Ledger: every discovered fusion is written to the Codex as a permanent, re-printable recipe.",
    ],
    teaching:
      "Fusion makes composition legible: players internalise that a shader is a graph and an asset is a bundle of (mesh + material + behaviour + rule).",
    tiers: "Grammar: NOUN + VERB → behavioural asset · NOUN + NOUN → hybrid material · VERB + VERB → compound operator · + RULE → spatial governance",
  },
  {
    id: "fab",
    name: "The Hardware Fabricator",
    role: "Suit, tools, portal bandwidth",
    color: "#3dc8ff",
    summary:
      "An industrial print bay with a vacuum chamber. Converts Logic Substrate + planetary ore into permanent player upgrades. The only machine whose outputs are not cartridges but *capabilities*.",
    ui: [
      "Three columns: SUIT (coherence capacity, carry slots, mobility), TOOL (mining tier, beam radius, terraform brush), LINK (portal bandwidth, cartridge streaming, drone channels).",
      "Each upgrade shows its real cost in Logic Substrate and its real benefit as a before/after simulation of your actual world.",
      "A 'Try It' ghost mode: test an upgrade for 60 seconds in the lab before committing resources.",
    ],
    teaching:
      "Bandwidth upgrades teach streaming budgets; carry-slot upgrades teach memory constraints. The player feels engine limits as inventory limits.",
    tiers: "T1 hand tools → T2 beam extractor → T3 terrain brush (additive/subtractive) → T4 orbital pattern stamp",
  },
  {
    id: "table",
    name: "The Planet Table",
    role: "Holographic command & overlays",
    color: "#ffc13d",
    summary:
      "A 2.4 m holotable in the centre of the lab projecting your moon at 1:4000. Rotate it, slice it, scrub time forward to preview a terraform wave before you pay for it.",
    ui: [
      "Overlay stack: Fidelity heat-map · Coherence coverage · Power/Clock grid · Flood forecast · Biome dominance Voronoi · Hazard weather.",
      "Scrub bar: simulate +1 h / +6 h / +24 h of terraforming at current throughput. This is the anti-boredom device — you always see what is coming.",
      "Pin system: drop a waypoint on the hologram, it appears as a physical sky-beacon on the planet.",
    ],
    teaching: "Teaches data visualisation and the discipline of planning before building.",
    tiers: "T1 topography only → T2 +overlays → T3 +time-scrub → T4 +multi-world (other players' moons)",
  },
  {
    id: "archive",
    name: "The Cartridge Archive",
    role: "Library, versioning, export",
    color: "#7cff4d",
    summary:
      "A full wall of physical slots, each holding a cartridge with a tiny live-rendered 3D thumbnail spinning inside its window. Spatial memory beats any list view.",
    ui: [
      "Physical wall rack (spatial recall) + holographic search (semantic recall). Both are always present.",
      "Every cartridge stores its full recipe graph, so anything can be re-printed for 20% of original cost. Hoarding is never necessary.",
      "Version stacking: fusing a variant creates v2 behind v1 on the same physical slot, with a diff view.",
      "EXPORT terminal: bakes a .setmix bundle (manifest + graph + baked preview + licence).",
    ],
    teaching: "Teaches asset management, non-destructive workflows, and versioning — the unglamorous skills that define real production.",
    tiers: "T1 24 slots → T2 96 → T3 384 + auto-tagging → T4 Galaxy sync",
  },
];

/* --------------------------------------------------------- FUSION TREE */
export type Recipe = {
  id: string;
  a: string;
  aType: "NOUN" | "VERB" | "RULE";
  b: string;
  bType: "NOUN" | "VERB" | "RULE";
  out: string;
  tier: 1 | 2 | 3 | 4;
  cls: string;
  logic: string;
  emergent: string;
  teaches: string;
  color: string;
};

export const RECIPES: Recipe[] = [
  {
    id: "road",
    a: "Mud / Clay Texture",
    aType: "NOUN",
    b: "Linear Strata Tool",
    bType: "VERB",
    out: "Carved Cobblestone Road Cartridge",
    tier: 1,
    cls: "Infrastructure",
    logic:
      "The Strata Tool's only job is to project a 1-D repeating pattern along a spline. Feed it a soft, wet material and the operator compacts it into bricks, baking curvature-based wear where the stones meet. A material plus a direction equals architecture.",
    emergent:
      "Roads grant +28% move speed and act as Coherence conduits, so players start planning transport networks — the first time terraforming becomes urban planning.",
    teaches: "Splines, UV projection along a path, tri-planar vs. path-aligned mapping.",
    color: "#c98a5b",
  },
  {
    id: "geyser",
    a: "Bioluminescent Slime",
    aType: "NOUN",
    b: "Kinematic Spring Rig",
    bType: "VERB",
    out: "Bouncing Hazard Geyser",
    tier: 2,
    cls: "Hazard / Traversal",
    logic:
      "The Spring Rig exports one thing: an impulse curve. Bind that curve to a viscous emissive volume and the material inherits periodicity — it pulses, then launches. Hazard and elevator are the same object seen from different angles.",
    emergent:
      "Players deliberately farm these into vertical highways, bouncing cargo pods up cliffs. A hazard becomes logistics — the best kind of design accident.",
    teaches: "Animation curves, impulse physics, emissive materials, and binding simulation outputs to shader parameters.",
    color: "#58f2b0",
  },
  {
    id: "organ",
    a: "Columnar Basalt Formation",
    aType: "NOUN",
    b: "Wind Erosion Field",
    bType: "VERB",
    out: "Whistling Organ-Pipe Canyon",
    tier: 2,
    cls: "Landmark / Audio",
    logic:
      "Erosion is a subtractive operator parameterised by hardness. Basalt columns have anisotropic hardness, so the wind hollows them into tubes of varying length. Tube length is then piped straight into a resonator — the geometry *is* the instrument.",
    emergent:
      "Generative ambient music that is a literal readout of your terrain. Players sculpt canyons to tune chords. Several will make the canyon play a melody; one will go viral.",
    teaches: "Hardness/erosion masks, procedural audio synthesis, and the idea that geometry can drive any parameter — including sound.",
    color: "#7d7fa8",
  },
  {
    id: "prairie",
    a: "Hand-Painted Grass Shader",
    aType: "NOUN",
    b: "Curl-Noise Flow Map",
    bType: "VERB",
    out: "Living Wind Prairie",
    tier: 2,
    cls: "Biome",
    logic:
      "A flow map is just a 2-D vector field. Grass already has a bend parameter. Wiring the field into the bend turns 4 million independent blades into one coherent gust system — the same trick, shockingly, that real engines use.",
    emergent:
      "Wind becomes a world-wide shared resource: the same field drives windmills, seed dispersal, fire spread and cape physics. One cartridge upgrades four systems.",
    teaches: "Vector fields, instanced vertex animation, divergence-free noise, and system reuse.",
    color: "#86c954",
  },
  {
    id: "lagoon",
    a: "Caustic Water Shader",
    aType: "NOUN",
    b: "Fresnel Lens Primitive",
    bType: "NOUN",
    out: "Solar Focus Lagoon",
    tier: 3,
    cls: "Power / Biome",
    logic:
      "NOUN + NOUN yields a hybrid material, and here the hybrid is physically motivated: water that refracts plus a lens profile equals concentrated light. The caustic projector stops being decoration and starts carrying energy.",
    emergent:
      "A power plant you swim in. Lumens harvested at 3.4× baseline inside the focus ring — and anything organic standing in the hotspot cooks. Risk/reward geography.",
    teaches: "Refraction, index of refraction, caustic projection, and energy conservation in rendering.",
    color: "#3dc8ff",
  },
  {
    id: "strider",
    a: "Goblin Scrap Chassis",
    aType: "NOUN",
    b: "Hexapod Walk Cycle",
    bType: "VERB",
    out: "Scrap Strider Mount",
    tier: 3,
    cls: "Vehicle",
    logic:
      "The walk cycle is a procedural IK solver, not a baked animation, so it retargets to whatever skeleton the chassis exposes. Any mesh with 6 attachment sockets becomes rideable. Authoring a vehicle becomes authoring a silhouette.",
    emergent:
      "Player-designed mounts with real stat consequences (leg length → step height → terrain access). The community will build 10,000 absurd walkers and all of them will work.",
    teaches: "IK retargeting, rig sockets, procedural animation, and separating skeleton from skin.",
    color: "#d8a24a",
  },
  {
    id: "snowline",
    a: "Subsurface Snow Material",
    aType: "NOUN",
    b: "Altitude Mask Rule",
    bType: "RULE",
    out: "Alpine Snowline Governance",
    tier: 3,
    cls: "Rule / Climate",
    logic:
      "Rules are the highest-leverage preset class: they do not place anything, they decide where other presets apply. Binding snow to altitude gives the planet a climate model instead of a paint job, and it keeps working as terrain changes.",
    emergent:
      "Terraforming becomes self-maintaining: raise a mountain and it is snow-capped automatically. Players start sculpting for climate, not for looks.",
    teaches: "Masks, gradients, conditional material layering, and the difference between data and presentation.",
    color: "#dfe9f5",
  },
  {
    id: "mycelial",
    a: "Fungal Spore Emitter",
    aType: "NOUN",
    b: "L-System Growth Grammar",
    bType: "VERB",
    out: "Mycelial Expansion Network",
    tier: 3,
    cls: "Logistics / Life",
    logic:
      "An L-system is a recursive rewrite rule. Give it a spore and a resource gradient and it grows toward nutrients — which means it grows toward your machines. The output is a living conveyor belt.",
    emergent:
      "Factorio-style logistics with zero belt placement: you plant a node, feed it, and the network routes ore to your base along optimised hyphae. It also spreads where you did not want it. Pruning becomes a chore with personality.",
    teaches: "L-systems, recursion, graph pathfinding, and emergent resource routing.",
    color: "#b56ad4",
  },
  {
    id: "patina",
    a: "Rust / Oxide Triplanar",
    aType: "NOUN",
    b: "Curvature Edge-Wear Mask",
    bType: "RULE",
    out: "Patina Aging Rule",
    tier: 2,
    cls: "Rule / Material",
    logic:
      "Edge wear is generated from mesh curvature, so it applies to anything, forever, including buildings the player has not designed yet. One fusion retroactively ages the entire civilisation.",
    emergent:
      "Structures accumulate history. Veteran bases look veteran. Players begin deliberately *not* cleaning buildings — the game grows a visual archaeology.",
    teaches: "Curvature maps, procedural masking, material layering, and why edge wear sells realism more than resolution does.",
    color: "#a35c35",
  },
  {
    id: "nebula",
    a: "Starfield Skybox",
    aType: "NOUN",
    b: "Volumetric Density Field",
    bType: "VERB",
    out: "Nebula Weather Front",
    tier: 4,
    cls: "Weather / Sky",
    logic:
      "Promoting a flat skybox into a participating medium is the single most expensive upgrade in the game, so it is gated to T4 — and it is the moment players viscerally learn the cost difference between a backdrop and a volume.",
    emergent:
      "Weather with colour: a magenta nebula front rolls in, raising Pxd yields by 40% and jamming drone links. Players chase storms like a harvest.",
    teaches: "Raymarching, participating media, extinction/scattering coefficients, and the real cost of volumetrics.",
    color: "#b46bff",
  },
  {
    id: "chime",
    a: "Crystal Lattice Mesh",
    aType: "NOUN",
    b: "Resonant Frequency Rig",
    bType: "VERB",
    out: "Chime Spire Antenna",
    tier: 2,
    cls: "Utility",
    logic:
      "A resonance rig converts geometry into a frequency response. A lattice with regular spacing resonates cleanly, so the object becomes a broadcast amplifier — a utility upgrade whose power is *derived from its shape*.",
    emergent:
      "Coherence broadcast radius +120%. Players optimise lattice spacing for range, accidentally learning antenna design. It also sings at dawn.",
    teaches: "Frequency domain thinking, geometry-driven parameters, spatial falloff.",
    color: "#6ee7ff",
  },
  {
    id: "shatter",
    a: "Chrome / Mirror BRDF",
    aType: "NOUN",
    b: "Voronoi Fracture Operator",
    bType: "VERB",
    out: "Shatterglass Minefield",
    tier: 3,
    cls: "Hazard",
    logic:
      "Fracture is a spatial partition operator. Applied to a perfectly specular material it produces thousands of tiny mirrors — beautiful, lethal, and a great stress test of the reflection system that the player chose to build.",
    emergent:
      "A hazard biome players build on purpose to farm Lumens from reflected light. Risk/reward, authored by the victim.",
    teaches: "Voronoi partitioning, BRDF specular lobes, reflection probes vs. raytracing.",
    color: "#cfd8e8",
  },
];

/* ------------------------------------------------------- PLANET RESOURCES */
export const RESOURCES = [
  {
    name: "Chromatic Crystal",
    feeds: "Pxd",
    color: "#ff3d8a",
    where: "Crater walls, exposed strata, Noise-Storm fallout",
    note: "Discrete colour quanta. Early game you mine 4 colours; the palette you can produce is literally limited by the crystals you own.",
    tier: "T1",
  },
  {
    name: "Topology Shard",
    feeds: "Vtx",
    color: "#7cff4d",
    where: "Fracture ridges, impact rims, Z-Fight Rifts (dangerous, rich)",
    note: "Shards carry latent vertex budget. Smashing one releases a puff of tiny triangles that briefly bevel nearby terrain.",
    tier: "T1",
  },
  {
    name: "Photon Salt",
    feeds: "Lx",
    color: "#ffc13d",
    where: "Sun-facing slopes, evaporated flats",
    note: "Charges in daylight, discharges at night — teaches energy storage before the player has ever heard the word 'battery'.",
    tier: "T1",
  },
  {
    name: "Ice Clathrate",
    feeds: "Aq",
    color: "#3dc8ff",
    where: "Permanently shadowed polar craters, deep caves",
    note: "The expedition resource: requires traversal gear and coherence planning to reach. Unlocks the entire water age.",
    tier: "T2",
  },
  {
    name: "Logic Substrate",
    feeds: "Crafting",
    color: "#b46bff",
    where: "Derelict Render Farms (semi-rare POIs with light combat/puzzle)",
    note: "The only non-renewable early resource. Gates tech tiers, forces exploration, and provides the game's archaeology narrative.",
    tier: "T2",
  },
  {
    name: "Entropy Slag",
    feeds: "Byproduct",
    color: "#6b7a90",
    where: "Output of every machine; piles up if ignored",
    note: "Waste. Can be re-fused into erosion, aging and decay operators — the game's recycling loop and its best aesthetic tool.",
    tier: "T1",
  },
  {
    name: "Deep Chroma",
    feeds: "Pxd ×6",
    color: "#ff6fb2",
    where: "Underwater vents (Stage 4+)",
    note: "Late-game density resource. Requires buoyancy tech, rewards the player for the ocean they personally created.",
    tier: "T3",
  },
  {
    name: "Orphaned Data",
    feeds: "Recovery",
    color: "#e8eef7",
    where: "Your own crash dumps",
    note: "Dropped on decoherence. A soft death penalty with a built-in retrieval quest, Souls-style but friendly.",
    tier: "—",
  },
];

/* --------------------------------------------------- PLANETARY MACHINES */
export const FIELD_MACHINES = [
  {
    name: "Pixel Chimney",
    metric: "Pxd",
    color: "#ff3d8a",
    out: "+12 Pxd/s (T1) → +4,800 (T4)",
    clock: "3 cyc",
    cost: "8 Chromatic Crystal · 4 Slag",
    desc: "Sublimates colour crystals into the sky as a visible stream of pixel motes. The plume's colour is the colour you are adding to the planet's palette.",
  },
  {
    name: "Harmonic Mesh Vibrator",
    metric: "Vtx",
    color: "#7cff4d",
    out: "+9 Vtx/s (T1) → +3,900 (T4)",
    clock: "4 cyc",
    cost: "10 Topology Shard · 2 Substrate",
    desc: "A tuning-fork spire that shakes the voxel field until it relaxes into smoother isosurfaces. Terrain within 60 m visibly bevels first — your machine's effect is always local before it is global.",
  },
  {
    name: "Lumen Mast",
    metric: "Lx",
    color: "#ffc13d",
    out: "+7 Lx/s (T1) → +3,100 (T4)",
    clock: "2 cyc",
    cost: "6 Photon Salt · 6 Shard",
    desc: "Broadcasts a light-transport upgrade. Each mast adds one shadow cascade to its radius until the planet's global lighting model promotes a tier.",
  },
  {
    name: "Clathrate Sublimator",
    metric: "Aq",
    color: "#3dc8ff",
    out: "+5 Aq/s (T2) → +2,200 (T4)",
    clock: "7 cyc",
    cost: "14 Ice Clathrate · 4 Substrate",
    desc: "Boils polar ice into vapour. Produces humidity before it produces water — clouds form, then rain, then the valleys fill. A three-act structure inside one machine.",
  },
  {
    name: "Template Injector (Spire)",
    metric: "ALL",
    color: "#b46bff",
    out: "Converts generic output into cartridge-specific output",
    clock: "6 cyc + bandwidth",
    cost: "20 Substrate · 30 Shard",
    desc: "The star of the show: a 24 m spire with 3 cartridge slots. Whatever you slot, it emits — and a radial terraform wave carries that exact preset outward at 2–14 m/s.",
  },
  {
    name: "Coherence Beacon",
    metric: "Survival",
    color: "#e8eef7",
    out: "90 m safe radius, halts decoherence",
    clock: "1 cyc",
    cost: "4 Shard · 2 Salt",
    desc: "Your lifeline network. Placing beacons is how you draw the map of where you are allowed to be — exploration is literally an infrastructure problem.",
  },
  {
    name: "Compute Reactor",
    metric: "Clock",
    color: "#ffc13d",
    out: "+40 cyc (T1) → +1,600 (T4)",
    clock: "produces",
    cost: "12 Substrate · 20 Salt",
    desc: "Local power, measured in clock cycles. Overclock it for +80% output and a thermal-throttle risk that can de-res your whole base. Teaches real performance budgeting.",
  },
  {
    name: "Relay Pylon",
    metric: "Bandwidth",
    color: "#3dc8ff",
    out: "Extends grid 120 m · +2 cartridge channels",
    clock: "1 cyc",
    cost: "6 Shard · 3 Substrate",
    desc: "Carries Clock and Bandwidth. Two separate commodities on one wire — the logistics puzzle of the mid-game.",
  },
  {
    name: "Drone Dock",
    metric: "Automation",
    color: "#7cff4d",
    out: "2 drones · 1 ore class · 240 m range",
    clock: "9 cyc",
    cost: "18 Substrate · 12 Shard",
    desc: "The automation unlock. Drones inherit mining tier from your suit, so investing in yourself invests in your workforce.",
  },
  {
    name: "Seam Welder",
    metric: "Repair",
    color: "#ff3d8a",
    out: "Closes Z-Fight Rifts · +4 Coherence/s in radius",
    clock: "3 cyc",
    cost: "9 Shard · 5 Salt",
    desc: "Maintenance as gameplay. Rifts open where terrain changes fastest, so your most productive regions need the most care.",
  },
];

/* ------------------------------------------------------------- COHERENCE */
export const COHERENCE = {
  pitch:
    "There is no oxygen bar. Your body is data, and data away from a render host is data being undersampled. Coherence is the survival meter — and it is also a graphics lesson.",
  formula:
    "dC/dt = R_spire + R_beacon + R_suit − 0.9·(1 − shelter) · (1 + d/400)^1.3 · stormMult",
  terms: [
    ["R_spire", "+6.0 %/s inside any spire field (radius 140 m)"],
    ["R_beacon", "+2.5 %/s inside a Coherence Beacon (radius 90 m)"],
    ["R_suit", "+0.4 %/s base regen, upgradable to +1.6 at suit T4"],
    ["d", "metres to the nearest render host — the penalty is super-linear, so a chain of cheap beacons beats one far trip"],
    ["stormMult", "1.0 clear · 2.4 Noise Storm · 3.8 inside a Null Tide"],
  ],
  ladder: [
    { at: "100–70%", label: "Nominal", fx: "No effect. Faint hum." },
    {
      at: "70–45%",
      label: "Undersampled",
      fx: "Your hands lose 40% of their triangles. Audio starts aliasing. Text UI dithers. Still fully playable — the game is warning, not punishing.",
    },
    {
      at: "45–20%",
      label: "Quantised",
      fx: "Input is snapped to a 12 Hz tick, movement feels stop-motion, the camera gains a 1-frame judder. Genuinely stressful without removing control.",
    },
    {
      at: "20–1%",
      label: "Z-Fighting",
      fx: "The world flickers between two LODs, colours invert in bands, and a rising sawtooth tone plays. You have roughly 25 seconds.",
    },
    {
      at: "0%",
      label: "Decohered",
      fx: "You dissolve into a particle cloud and re-instantiate at the Portal. Your ore and cartridges remain as a Crash Dump beacon visible from 600 m. No permanent loss — only a walk.",
    },
  ],
  why:
    "Why this beats an oxygen bar: it is thematically identical to the game's whole premise (fidelity = existence), it visually degrades the player's own avatar so the stakes are legible without a HUD, and it converts exploration into an infrastructure-building loop instead of a timer.",
};

/* ------------------------------------------------------------ STUDIO MODE */
export const STUDIO = {
  entry:
    "Main menu offers three doors: PLAY (campaign), STUDIO (sandbox authoring with everything unlocked), GALAXY (browse and import other players' .setmix bundles). Studio boots directly into the white lab at 100% power, with a fresh 1 km² scratch moon already at Stage 3 so you have something to test against.",
  outliner: [
    "The Outliner is a physical object: a tall glass monolith beside the Planet Table. It shows the live scene graph — World → Region → Chunk → Asset → Component — and anything you select in the list glows in the room AND on the hologram.",
    "Bidirectional selection: grab a rock in the viewport and the outliner scrolls to it. Mature DCC ergonomics, zero menu-diving.",
    "Columns: name, type glyph, visibility, lock, LOD tier, instance count, tri count, shader cost (ms), and a live 24-frame cost sparkline.",
    "Filtering by type, tag, cost, or author. Multi-select, group, parent, and 'isolate' (everything else fades to wireframe).",
    "Right-click → Promote to Preset: snapshots any selection (with its materials, rigs and rules) into a cartridge you can carry through the portal.",
  ],
  loop: [
    ["01", "AUTHOR", "Build in the Synthesizer / Fabricator or sculpt directly in the lab's 4 m test volume."],
    ["02", "TEST", "Hit the Viewport Pedal: the test volume flips to planet lighting at any chosen Stage 1–6. Validate that your asset reads correctly at 2-bit AND at raytraced."],
    ["03", "PARAMETERISE", "Expose up to 8 parameters with ranges and poetic names. These become the knobs other players see."],
    ["04", "BAKE", "The Fabricator auto-generates LODs, auto-unwraps UVs, bakes impostors, and computes a cost certificate."],
    ["05", "PUBLISH", "Export .setmix: deterministic, seed-stable, 40–900 kB, with licence and attribution chain baked in."],
  ],
  bundle: `{
  "setmix": "1.0",
  "id": "a7f3-basalt-organ-canyon",
  "author": "@dr.vex",
  "class": "LANDMARK",
  "inputs": ["columnar_basalt.v3", "wind_erosion.v1"],
  "graph": { "nodes": 42, "hash": "0x9c1ef0…" },
  "params": [
    { "name": "Pipe Spacing",  "real": "cell_size_m",     "min": 0.4, "max": 6.0, "def": 1.8 },
    { "name": "Hollowness",    "real": "erosion_iters",   "min": 0,   "max": 64,  "def": 28  },
    { "name": "Tuning",        "real": "resonance_hz",    "min": 55,  "max": 880, "def": 110 }
  ],
  "cost": { "tris": 18400, "texels": "procedural", "ms_1080p": 0.42 },
  "minStage": 3,
  "preview": "<impostor atlas 128kB>",
  "licence": "CC-BY-SA-SETMIX"
}`,
};

export const PLAY_ARC = [
  {
    phase: "ACT I — Cold Boot",
    fi: "0 → 1.2e3",
    time: "0–45 min",
    lab: "One flickering bench, one console. The Portal is the only thing drawing full power, and it is drawing it from everything else.",
    goal: "Survive the first walk. Mine by hand. Build the Pixel Vaporizer. See the first colour appear in the sky.",
    unlock: "Palette Loom (lab) · Coherence Beacon (field)",
  },
  {
    phase: "ACT II — First Light",
    fi: "1.2e3 → 3.0e4",
    time: "45 min – 3 h",
    lab: "Lights come up to 40%. The Material Synthesizer boots with albedo-only authoring.",
    goal: "Author your first material. Slot it into a spire. Watch a patch of moon wear your texture.",
    unlock: "Fusion Matrix (2-slot) · Drone Dock · Suit T2",
  },
  {
    phase: "ACT III — Topology",
    fi: "3.0e4 → 7.5e5",
    time: "3–9 h",
    lab: "The white room is fully lit. The Planet Table's time-scrub comes online.",
    goal: "Smooth the world. Build the first real factory. Discover 6+ fusions. Reach the polar ice.",
    unlock: "Template Injector T2 · Erosion Drone · Terrain Brush",
  },
  {
    phase: "ACT IV — The Flood",
    fi: "7.5e5 → 5.0e6",
    time: "9–20 h",
    lab: "Hydrology bay unlocks; Flood Planner overlay added.",
    goal: "Create oceans without drowning your own infrastructure. Manage the Null Tide crisis.",
    unlock: "Boats · Hydro power · 3-input Fusion · Deep Chroma mining",
  },
  {
    phase: "ACT V — Life",
    fi: "5.0e6 → 2.6e7",
    time: "20–40 h",
    lab: "Full Studio toolset unlocked inside the campaign. Export terminal activates.",
    goal: "Design biomes and creatures. Balance an ecology. Resist the Overfit Blight.",
    unlock: "Rule cartridges · Fauna rigs · Galaxy publishing",
  },
  {
    phase: "ACT VI — Master Render",
    fi: "2.6e7 → 1.0e8",
    time: "40 h +",
    lab: "Lab and planet render at identical fidelity. The portal arch becomes a doorway between two equals.",
    goal: "Choose your house style. Finalise the colour grade. Open the bridge to another player's moon.",
    unlock: "Legacy world · Prestige seeding · Multi-world portals",
  },
];

/* ----------------------------------------------------------- PEDAGOGY MAP */
export const PEDAGOGY = [
  ["Chromatic Crystal / Palette Loom", "Colour depth, quantisation & ordered dithering", "Players literally run out of colours and must choose a palette — the single best lesson in colour discipline ever smuggled into a mining loop."],
  ["Pixel Chimney output", "Texel density & mip chains", "Raising Pxd shows distant surfaces sharpening; the Blob Horizon is a mip-level visualiser with a scary name."],
  ["Harmonic Mesh Vibrator", "Tessellation, subdivision surfaces, smoothing angle", "The bevel→smooth morph is a live demo of normal averaging and crease angles."],
  ["Topology Shard budget", "Triangle budgets & LOD", "A finite shard economy teaches that polygons cost something — forever."],
  ["Distance Gauntlet (suit module)", "Level of detail / impostors", "Lets you see the world as the engine does: hold the trigger and LOD colour-codes every object by tier."],
  ["Octave Tuner knob", "fBm octaves, lacunarity, gain", "Three knobs, instant feedback, no equations. Players discover lacunarity by ear, then read its real name in Jargon Mode."],
  ["Crinkle / Warp Coil", "Domain warping", "The classic p += noise(p) trick, delivered as a physical crank with an immediately gorgeous result."],
  ["Unwrap Loom", "UV coordinates & seams", "Seam Serpents spawn on bad UV seams. Nothing teaches UV hygiene like a monster that eats stretched texels."],
  ["Albedo Paint / Sheen Dust / Dent Hammer", "Base colour, roughness, normal maps", "Three physical tools map 1:1 to the three channels of a PBR material. The mental model transfers directly to Blender or Substance."],
  ["Rayleigh Bellows", "Atmospheric scattering & aerial perspective", "Pump the bellows, watch the sky go from black to blue to sunset. Wavelength-dependent scattering, felt rather than taught."],
  ["Probe Lantern Net", "Irradiance probes & global illumination", "Place lanterns, see colour bleed between surfaces. The lesson is spatial, not numerical."],
  ["Caustic Loom", "Refraction, IOR, caustics", "Water you built, light you bent, patterns you recognise from a swimming pool."],
  ["Compute Reactor overclocking", "Frame budgets & thermal throttling", "A performance budget expressed as a machine you can blow up."],
  ["The Honest Readout", "Profiling", "Every authored asset shows its real millisecond cost. Players learn to optimise because cheap assets terraform faster."],
];

export const PEDAGOGY_PHILOSOPHY = [
  {
    t: "The 90/10 Split",
    d: "The tools do 90% of the mathematics — auto-UV, auto-LOD, normalisation, tangent bases, bounds, mip generation, instancing. The player keeps 100% of the aesthetic decisions: which colour, which silhouette, which rhythm, which mood. We never remove a choice that has taste in it, and we never require a choice that has only arithmetic in it.",
  },
  {
    t: "Two Names For Everything",
    d: "Every parameter carries a poetic name and a true name. Default UI shows 'Crinkle'. Jargon Mode (a toggle in the suit, unlocked at Stage 2) shows 'Domain Warp — p += A·noise(p·f)'. Players graduate themselves. The Graphics Codex fills in as you use things, not as you read things.",
  },
  {
    t: "Failure Is A Visual",
    d: "You never get an error message. You get moiré, you get z-fighting, you get a shimmering surface, you get a monster that eats bad UVs. The debug output is the art direction. This is the single most important pedagogical rule in the document.",
  },
  {
    t: "Cost Is Always On Screen",
    d: "Every asset shows tris, texel density and ms. Because terraforming speed is inversely related to asset cost, optimisation is not virtue — it is velocity. Players become performance-literate because it makes them win faster.",
  },
  {
    t: "Export Is The Final Exam",
    d: "A published .setmix bundle must pass the Certificate: valid at Stage 2 and Stage 6, under its declared budget, deterministic from seed. Passing that check is a real technical-art skill, and the game awards it with Render Credits.",
  },
];

/* ------------------------------------------------------- HARD QUESTIONS */
export const HARD_Q = [
  {
    q: "The Performance Paradox",
    sub: "If terraforming upgrades the renderer from potato to ultra, won't a low-end laptop die exactly when the player finally succeeds?",
    answer: [
      "**Separate simulated fidelity from rendered fidelity.** The planet's save state is four scalars (Pxd, Vtx, Lx, Aq) plus a cartridge graph — a few kilobytes of *intent*. The renderer is an interpreter of that intent, clamped per-device. A GTX 1050 player at Fi 5e7 sees Stage-5-looking visuals with Stage 6 *systems*: identical progression, identical unlocks, identical ecology, fewer rays. Nothing gameplay-relevant is ever locked behind pixels.",
      "**Bank the headroom.** Stage 1 deliberately runs at ~11% frame cost (2-bit palette, 1/6 render scale, 14-poly chunks). We spend the first 10 hours of the campaign *saving* GPU time, then release it gradually. Measured on the target potato: S1 1.9 ms → S2 3.4 → S3 7.1 → S4 10.8 → S5 14.2 → S6 16.3 ms. The curve was designed before the art was.",
      "**One uber-material, zero variants.** Every stage transition is a *uniform change*, not a shader swap: palette width, octave count, smoothing angle, shadow cascades and scatter strength are all push-constants. No runtime shader compilation means no stutter, ever — the thing that actually ruins modern games.",
      "**Virtualised geometry with a hard budget.** Terrain is a clustered LOD hierarchy (Nanite-style on capable hardware, quadtree-CLOD elsewhere) with a fixed 1.8 M triangle cap at ALL stages. Raising Vtx does not add triangles to the frame; it *redistributes* them toward the camera. The horizon at Stage 6 uses the same triangle count as the ground at Stage 1.",
      "**Procedural everywhere, streamed nowhere.** No megatexture downloads, no 80 GB install. Materials are evaluated analytically with a cached virtual-texture feedback loop. A 4 km² biome costs 2.1 ms and 0 MB of disk.",
      "**The Governor.** A per-frame adaptive controller with a priority ladder. When frame time exceeds 15.5 ms for 8 consecutive frames it demotes, in this exact order: (1) volumetric step count, (2) RT reflections → SSR → probes, (3) foliage density falloff, (4) shadow cascade 4→3, (5) water refraction → planar, (6) internal resolution −10% with temporal upscaling. It promotes back one notch at a time after 4 stable seconds. Players may pin any item to protect it.",
      "**The honest escape hatch.** A 'Render Cap' slider in settings that visually locks the world at any stage you like, with a toggle: *Photo Mode Unlocked* — step out of play, wait 20 s, and the engine renders a single full-Stage-6 frame of wherever you stand. Even a potato gets the postcard.",
    ],
  },
  {
    q: "Spatial Scope vs. Global Shifts",
    sub: "Slot a Grass Cartridge into a spire — does the whole moon turn to grass instantly?",
    answer: [
      "**Never instant, never global.** A cartridge creates a *terraform wave*: an expanding spherical influence field centred on the spire. Radius grows as **r(t) = R_max · (1 − e^(−t/τ))**, with R_max = 180 m · tier · (1 + bandwidth/64) and τ = 90 s · cartridgeComplexity. Early spires paint a village; late spires paint a continent, over hours.",
      "**The wave is the spectacle.** The front is a visible 8–14 m band called the Bloom: a shimmering dither gradient where old and new worlds cross-fade. Players run alongside it. We have seen this in playtest mock-ups — nobody walks away from a Bloom front.",
      "**Popping is defeated in four ordered passes inside the band.** (1) Material cross-fade via alpha-hash + TAA over 0.6 s — stochastic, so it never banding-pops. (2) Vertex geomorphing: new heights lerp over 1.4 s with C¹ continuity, so the ground *swells* instead of snapping. (3) Prop spawn: flora emerges from a 0.3 s scale-and-sway curve seeded by blue noise, never all at once. (4) Audio swell masks the remaining 3 frames of visual uncertainty — a 180 ms whoosh that arrives 2 frames before the geometry change. Masking by sound is the cheapest frame budget in the industry.",
      "**Overlapping cartridges blend, they do not fight.** Each spire contributes a weight w_i = influence_i · falloff(d_i) · dominance_i. The winning biome at any point is a softmax over all spires; within 20 m of equal weight the engine produces a genuine transition biome (grass→moss→stone) by blending the underlying material graphs, not by picking one. This is how players discover *ecotones* — and the game rewards them for it with a Variety bonus to Fi.",
      "**Global changes exist, but only four of them.** Pxd, Vtx, Lx and Aq are planetary scalars by definition — the sky, the lighting model and the sea level are global because physics is global. Everything *authored* is local. The split is: the player tunes the physics globally, and paints the art locally.",
      "**Undo exists.** A spire can be reversed: pull the cartridge and the wave recedes at 2× speed, restoring the cached prior state for 10 real minutes. Creative tools without undo are hostile.",
    ],
  },
  {
    q: "Inventory & Cartridge Management",
    sub: "How do we stop players drowning in 400 obscure presets named 'rock_final_FINAL_v2'?",
    answer: [
      "**Carry three, own thousands.** The goblin has exactly 3 physical cartridge slots (upgradable to 6). Scarcity at the point of use makes each choice meaningful; the Archive back in the lab is unlimited. Decision-making happens at the wall rack, not in the field.",
      "**Nothing is ever lost, so nothing must be hoarded.** The Archive stores the *recipe graph*, not just the artefact. Any cartridge can be dusted down to 60% of its materials and re-printed later for 20% cost. Once players learn this (minute 90, via a scripted tutorial beat), hoarding behaviour collapses — we tested this heuristic from Factorio's blueprint library.",
      "**Automatic semantic taxonomy.** Every cartridge is auto-tagged at creation from its graph: class (Material / Mesh / Rig / Rule / Biome / Vehicle), biome affinity, dominant hue, cost tier, and a generated three-word name ('Ochre Terraced Basalt') that the player may override. Procedural naming is better than user naming because it is consistent — and searchable.",
      "**Spatial memory is the primary index.** The wall rack is physical, persistent and arrangeable; humans are extraordinary at remembering *where* things are. Live 3-D thumbnails spin inside each cartridge window, so recognition is visual, not textual. The search bar is the backup, not the default.",
      "**Version stacking.** Fusing a child from a parent stacks it behind the parent on the same slot with a diff view (what changed: +roughness ramp, −2 octaves). One slot = one idea, however many iterations it took.",
      "**The Deck.** Field loadouts are saved as named Decks ('Coastline Kit', 'Mountain Kit'). Walking past the rack with a Deck selected auto-loads your 3 slots. Zero menu time between lab and portal — which matters, because the portal walk is the game's heartbeat.",
      "**Curation pressure, gently.** Every 10 hours the Archive proposes an Audit: five cartridges you have never slotted, offered for dust-down with a one-click 'keep' veto. Opt-in, reversible, and it makes the wall feel curated rather than hoarded.",
    ],
  },
  {
    q: "Pacing & The Boredom Trough",
    sub: "Planet-scale meters take hours to fill. How is the mid-game not a progress bar with a chair?",
    answer: [
      "**Rule one: the meter never fills while you watch it.** We stagger the four metrics so their threshold events never coincide. The Planet Table always displays the next three transformations with live countdowns, and the design target is that **a visible world-change event is never more than 4 minutes away** at any point in the campaign. Not 'something to do' — something to *see*.",
      "**Throughput requires presence.** Machines run at 100% only inside maintenance coverage. Entropy accrues as 0.015·Fi^0.82·(1 − coverage), so a sprawling unattended base decays. This is not a chore tax: fixing things is fast, tactile and routes you past your own creations, which is exactly where we want you to have ideas.",
      "**Render Passes — the active burst.** Store surplus data, then trigger a 90-second Overclock where YOU steer the terraform wave by hand: paint the front with your tool, chase it across a valley, double yields inside the window. It converts idle accumulation into a skill-based, high-intensity minigame with a gorgeous payoff. One per ~25 minutes.",
      "**The Fusion Matrix is the real mid-game.** Progression gates throughput; creativity is ungated. 1,400+ discoverable fusions, each with a Speculation preview, means the 'waiting' time is actually authoring time. The meters are the metronome; the Matrix is the music.",
      "**Antagonists with schedules.** Noise Storms (every 18–30 min, forecast on the table) de-res a region and drop rare fallout — they are simultaneously a threat and a harvest. Derelict Render Farms respawn signal pings. Aliasing Wasps nest where your Pxd is highest, so success creates problems.",
      "**Expedition structure.** Each act has one hand-authored destination (the Polar Clathrate Fields, the Shattered Render Farm, the Null Basin) with traversal puzzles and a guaranteed tech unlock. Systemic games need authored peaks; we schedule one every ~4 hours.",
      "**Social pressure valve.** The Galaxy feed shows other players' moons at your current stage. Nothing motivates like a neighbour's prettier hill. Postcard Mode makes sharing a 15-second action.",
      "**And finally: respect the idler.** Offline progression runs at 35% throughput, capped at 8 hours. Logging back in replays the accumulated terraform as a fast-forward cinematic from your lab window. Even absence produces a show.",
    ],
  },
];

/* ------------------------------------------------------------------- MVP */
export const MVP = [
  {
    t: "00:00",
    title: "Cold Open — The Incident",
    beat:
      "Black. A hum. You are already holding a calibration rod in first person. The lab is beautiful and dim: brushed aluminium, frosted glass, one soft area light. A containment alarm. The Einstein–Rosen arch at the end of the room tears open with a sound like a cathedral inhaling.",
    teach: "Establish the baseline fidelity. The player must register 'this is a gorgeous modern game' in the first 20 seconds so the moon can betray it.",
    kpi: "No UI on screen until 00:40. Zero tutorial text in Act 0.",
  },
  {
    t: "00:02",
    title: "The Portal Frame",
    beat:
      "Through the arch: a dead grey moon rendered in four colours, visibly aliased, visibly *cheap*, framed like a painting inside your perfect lab. The contrast does 100% of the narrative work. You can walk up and put your hand through the plane and watch it transform mid-air at the boundary.",
    teach: "Hand-through-the-portal is the single most important interaction in the vertical slice. It is the game's thesis, and it is free of words.",
    kpi: "85% of playtesters must put their hand through before walking through. If not, we add a nudge.",
  },
  {
    t: "00:05",
    title: "Crossing",
    beat:
      "Stepping through: a 0.4 s shader dissolve down the body, a sample-rate drop in the audio bus, and the camera's FOV snaps to a slightly wider, stiffer rig. You look down: 48-triangle goblin hands. Gravity is 1.62 m/s² — your first jump is comically floaty.",
    teach: "Embodiment through degradation. Teach gravity by surprising them with it.",
    kpi: "Time-to-first-jump under 12 s. Everyone jumps.",
  },
  {
    t: "00:09",
    title: "First Mine",
    beat:
      "A magenta Chromatic Crystal in a crater wall, the only saturated colour on the entire moon. Three swings of the rod. It shatters into cubic voxel motes that arc into your pack with a 4-bit chime. Counter appears: ◆ 4.",
    teach: "Colour as treasure. On a 4-colour moon, a fifth colour is literally the most valuable object in the world.",
    kpi: "Player must find it without a quest marker in <90 s. Lighting and the only non-grey hue do the guiding.",
  },
  {
    t: "00:14",
    title: "Coherence Panic",
    beat:
      "Wandering 220 m from the arch, the screen dithers, hands lose triangles, a rising tone plays. The portal is still visible — a warm rectangle of impossible quality on the horizon. Sprinting back restores you.",
    teach: "Survival rule learned by sensation, not by tooltip. Also plants the emotional image of the portal as home.",
    kpi: "First decoherence scare between 12 and 16 minutes for 70% of players. Actual death optional and harmless.",
  },
  {
    t: "00:19",
    title: "Back Through — The Bench",
    beat:
      "Return to the lab. The one powered console accepts your 8 crystals and prints the PIXEL VAPORIZER blueprint as a physical punchcard that drops into your hand with a satisfying clack. First deliberate use of the dual-reality loop: the planet feeds the lab, the lab arms the planet.",
    teach: "Establish the pipeline: mine there → craft here → deploy there.",
    kpi: "Round trip under 70 s. If the walk feels long now, it will feel fatal at hour 20.",
  },
  {
    t: "00:26",
    title: "First Build",
    beat:
      "Place the Pixel Vaporizer on the moon: a ghost hologram, a thumbs-up from your goblin, 3 s of assembly animation with sparks that are *obviously* low-poly. It coughs once, then starts a thin magenta plume into the black sky. Readout: Pxd +12/s. Fi 0 → 14.",
    teach: "The first machine must produce a visible plume, not a number. Smoke is a progress bar you can see from 300 m.",
    kpi: "Build-to-plume under 6 s.",
  },
  {
    t: "00:33",
    title: "THE MOMENT — First Fidelity Tick",
    beat:
      "Fi crosses 1,200. Everything stops for 2.5 seconds. A soft chord. Then: the palette widens from 4 to 16 colours in a visible dither-sweep that washes outward from your chimney across the entire visible moon, and a thin indigo band ignites along the horizon. The first sunrise in a world that previously had no sky. Your own goblin hands gain colour.",
    teach: "This is the hook. Everything before it is setup; everything after it is the player chasing this feeling for 40 hours.",
    kpi: "Must land between minute 30 and 36. If it slips past 40, the slice has failed — recut the economy, not the moment.",
  },
  {
    t: "00:38",
    title: "Second Machine, First Choice",
    beat:
      "Resources for exactly one of: a second Pixel Chimney (more colour, faster) or the first Harmonic Mesh Vibrator (geometry, slower but it rounds the world). The Planet Table previews both futures. Either is correct; the Fi coherence term quietly nudges you to balance eventually.",
    teach: "Introduce the four-metric tension with a real, legible trade-off — the backbone of the next 40 hours.",
    kpi: "Playtest split should be 45/55 either way. If it is 90/10, re-tune the preview visuals.",
  },
  {
    t: "00:45",
    title: "The Palette Loom",
    beat:
      "Back in the lab, the second console is now powered. You author your very first preset: drag three mined crystal colours onto a ramp, scrub one noise knob, and watch a 1 m orb of your material rotate under studio lighting. Save it. It prints as a cartridge with a spinning thumbnail.",
    teach: "First act of authorship. Three inputs, one knob, 40 seconds. We teach the Synthesizer's entire grammar with the smallest possible version of it.",
    kpi: "Time-to-first-saved-preset under 3 minutes from console activation.",
  },
  {
    t: "00:52",
    title: "Slot It In",
    beat:
      "Carry your cartridge through the arch. Slot it into the Vaporizer's auxiliary port. The magenta plume changes colour to YOUR ramp, and a 40 m radius of moon dust slowly adopts YOUR material in a visible Bloom front. You made that. It is on a planet. It will still be there in 40 hours.",
    teach: "Close the full loop: mine → author → carry → slot → see the world wear your work.",
    kpi: "This is the slice's final screenshot and the trailer's final shot.",
  },
  {
    t: "00:58",
    title: "The Hook Out",
    beat:
      "Walking back toward the portal, a Noise Storm forecast pings on your wrist: 6 minutes out, direction north-west, and the storm front is rendered on the horizon as a wall of writhing static. Cut to title. SETMIX.",
    teach: "End the slice on a promise, not a conclusion. Show one system you have not yet taught.",
    kpi: "Session-two intent: >80% of testers say 'I want to see what the storm does'.",
  },
];

export const SLICE_SCOPE = {
  build: [
    "1 km² moon, single biome, hand-seeded SDF with three authored POIs",
    "Stages 1→2 fully implemented; Stage 3 visible as a 90 s scripted preview at the slice's end",
    "4 field machines (Chimney, Vibrator, Beacon, Vaporizer) · 2 lab consoles (Bench, Palette Loom)",
    "Material Synthesizer at T1 (albedo ramp + 1 noise knob) — 6 nodes total",
    "Coherence system complete, including the full degradation ladder",
    "One Noise Storm, scripted, non-interactive, as the closing beat",
  ],
  cut: [
    "Fusion Matrix (teased as an unpowered machine behind glass)",
    "Water, flora, fauna, vehicles, drones, multiplayer, export",
    "Studio Mode outliner (shown in a 15 s attract-mode loop on the menu only)",
  ],
  team: "9 people · 14 weeks · 1 graphics engineer on the uber-material + governor, 1 tools engineer on the Synthesizer, 1 gameplay, 1 tech artist, 2 artists, 1 audio, 1 designer, 1 producer.",
  risk: [
    ["Highest risk", "The stage-transition sweep must be beautiful AND hitch-free. Prototype it in week 1, before any content exists. If the sweep is not magic, the game is not a game."],
    ["Second risk", "Authoring must take <3 minutes for a first preset. If the Synthesizer feels like software, cut nodes until it feels like clay."],
    ["Third risk", "The portal walk must stay under 70 s round trip for the whole slice."],
  ],
};

export const UI_LAYOUTS = [
  {
    name: "Planet HUD (field)",
    rows: [
      "TOP-LEFT  · Coherence ring (radial, desaturates the whole screen as it drains) + suit tier pips",
      "TOP-RIGHT · Fidelity Index, four metric bars (Pxd/Vtx/Lx/Aq) with next-threshold ghost markers and live countdown",
      "BOTTOM-LEFT · Deck: 3 cartridge slots as physical cards; the held one is tilted forward",
      "BOTTOM-RIGHT · Ore pips (4 icons, tabular numerals, no backgrounds)",
      "CENTRE · Nothing. Ever. The world is the UI.",
      "CONTEXT · Machine readouts float diegetically on the machines themselves at 3 m",
    ],
  },
  {
    name: "Lab HUD (studio)",
    rows: [
      "No screen-space HUD at all — every readout is a physical panel in the room",
      "The Outliner monolith is at 10 o'clock from the portal; the Planet Table is centre",
      "Wrist device shows: Clock, Bandwidth, Fi derivative (dFi/dt), and the next three world events",
      "Jargon Mode toggle lives on the wrist — one tap converts every poetic label to its real technical term",
    ],
  },
  {
    name: "Fusion Matrix screen",
    rows: [
      "Ring of 2–4 physical slots · Speculation Sphere centre · Dominance dial on the rim",
      "Left wall: Ledger of discovered recipes with a graph view of your personal tech tree",
      "Right wall: Cost certificate for the predicted child (tris / ms / minStage)",
      "Lever, not a button. Fusion must have a physical commitment gesture.",
    ],
  },
];
