/* ============================================================================
 *  packages/content/src/recipes.ts
 *  ---------------------------------------------------------------------------
 *  THE FUSION MATRIX PERIODIC TABLE — 100 curated recipes.
 *
 *  This is a DIRECTED ACYCLIC GRAPH, not a flat list. Tier-1 bases fuse into
 *  tier-2 alloys, which fuse into tier-3 living hybrids, and so on to tier-6
 *  Legendary Masterpieces. Outputs of lower recipes are legal INPUTS to higher
 *  ones, which is what makes the Codex feel like a tech tree you found rather
 *  than a menu you were given.
 *
 *  Authoring rules we held ourselves to:
 *    1. Every recipe must be GUESSABLE IN HINDSIGHT. "Obsidian + Clathrate →
 *       Prismatic Geode" should make a player say "of course", never "how?".
 *    2. No recipe is random. All 100 are hand-placed, so the Speculation
 *       Sphere's confidence number is honest.
 *    3. Every output carries a gameplay reason to exist, not just a look.
 *    4. The preview colour is the child's dominant hue, so the Sphere can
 *       tease the result before the player commits the parents.
 *
 *  Pure data. Zero dependencies beyond the preset ids.
 * ==========================================================================*/

export type RecipeTier = 1 | 2 | 3 | 4 | 5 | 6;
export type RecipeClass =
  | "ALLOY" | "BIOME" | "HAZARD" | "ROAD" | "UTILITY"
  | "RULE" | "VEHICLE" | "WEATHER" | "LANDMARK" | "LEGENDARY";

export interface Recipe {
  id: string;
  a: string;
  b: string;
  /** stable id of the produced cartridge */
  out: string;
  outName: string;
  tier: RecipeTier;
  cls: RecipeClass;
  /** shown in the Codex before discovery — a nudge, never a solution */
  hint: string;
  /** what it DOES, revealed on discovery */
  effect: string;
  /** dominant hue previewed in the Speculation Sphere */
  preview: string;
  /** 0..100 — the Sphere's honest confidence in resolving a child */
  confidence: number;
}

/* Compact tuple authoring: [id, a, b, out, name, tier, cls, hint, effect, colour, conf] */
type Row = [string, string, string, string, string, RecipeTier, RecipeClass, string, string, string, number];

const ROWS: Row[] = [
  /* ════════════════ TIER 1 → 2 · BASE ALLOYS (24) ════════════════════ */
  ["r001","lunar_anorthosite","red_ochre_silt","compacted_marl","Compacted Marl",2,"ALLOY","Two dusts, one roller.","First buildable ground. +22% rover grip, and machines placed on it stop sinking.","#8d7a63",96],
  ["r002","lunar_anorthosite","photon_salt","iridescent_solar_highway","Iridescent Solar Highway",2,"ROAD","What does grey dust do when you give it light to keep?","Paving that charges by day and routes Lumens to the grid at night. +1.4× Lx within 40 m.","#e8d49a",93],
  ["r003","obsidian_glass","permafrost_clathrate","prismatic_obsidian_geode","Prismatic Obsidian Geode",2,"ALLOY","Quench the glass again, colder.","Thermal shock fractures the glass into a prism lattice. Splits incident light into a visible spectrum.","#6fd4e8",91],
  ["r004","red_ochre_silt","linear_strata_tool","carved_cobble_road","Carved Cobblestone Road",2,"ROAD","A material and a direction.","The classic. +28% move speed and the road acts as a Coherence conduit.","#a9754a",98],
  ["r005","basalt_joint","wind_erosion","organ_pipe_canyon","Whistling Organ-Pipe Canyon",2,"LANDMARK","Hollow out something that was already tuned.","Pipe length drives pitch. Your terrain becomes a playable instrument.","#7d7fa8",89],
  ["r006","pyrite_strata","shock_quartz","resonant_pyrite_lens","Resonant Pyrite Lens",2,"UTILITY","Metal that rings, glass that remembers.","Focuses Coherence broadcast into a beam. +120% beacon range along one axis.","#d6b44e",85],
  ["r007","magnetite","pyrite_strata","ferrous_ballast","Ferrous Ballast",2,"ALLOY","Heavy plus heavy.","Anchoring aggregate. Structures built on it are immune to flood displacement.","#4a5260",92],
  ["r008","sulfur_vent_crust","crater_calcite","gypsum_bloom","Gypsum Bloom",2,"ALLOY","Acid meets carbonate.","Desert rose crystals that passively scrub Entropy Slag at 3/s.","#e6d9b4",90],
  ["r009","permafrost_clathrate","crater_calcite","frost_travertine","Frost Travertine",2,"ALLOY","Water that keeps depositing after it freezes.","Terraced mineral steps. Holds Aq against evaporation at 2.4×.","#cfe4ea",88],
  ["r010","obsidian_glass","magnetite","ferroglass_sheet","Ferroglass Sheet",2,"ALLOY","Glass that answers a magnet.","Mirror-finish plate with a magnetic substrate. The prerequisite for mag-lev.","#2d3a4a",87],
  ["r011","shock_quartz","crater_calcite","piezo_chalk","Piezoelectric Chalk",2,"UTILITY","Squeeze the soft one.","Generates 14 cyc/s under footfall or rover traffic. Roads that power themselves.","#f0e7cd",84],
  ["r012","lunar_anorthosite","curvature_wear","patina_aging_rule","Patina Aging Rule",2,"RULE","Where does dust settle first?","A RULE: everything you ever build now accumulates believable edge wear. Retroactive.","#a35c35",94],
  ["r013","red_ochre_silt","permafrost_clathrate","rust_mudflat","Oxidising Mudflat",2,"BIOME","Iron plus water plus time.","Wet iron flats that slowly redden. +1.9× Aq retention, −18% rover grip.","#8a4428",91],
  ["r014","basalt_joint","magnetite","lodestone_colonnade","Lodestone Colonnade",2,"LANDMARK","Columns that point.","Every column aligns to magnetic north. A compass you can see from 2 km.","#39414f",86],
  ["r015","sulfur_vent_crust","obsidian_glass","fumarole_glaze","Fumarole Glaze",2,"ALLOY","Bake the yellow onto the black.","Vitrified sulfur crust. Hard, bright, and it vents heat at 1.7× for anything built on it.","#c9a02a",88],
  ["r016","pyrite_strata","red_ochre_silt","hematite_banding","Banded Hematite",2,"ALLOY","The oldest sedimentary story there is.","Banded iron formation. +1.35× harvest yield and a 2-colour palette expansion.","#6e3220",90],
  ["r017","crater_calcite","wind_erosion","yardang_field","Yardang Field",2,"LANDMARK","Let the wind choose the shape.","Wind-carved ridges aligned to the prevailing vector. Natural windbreaks for your base.","#b5ab96",89],
  ["r018","magnetite","linear_strata_tool","induction_trackbed","Induction Trackbed",2,"ROAD","Lay the magnet in a line.","Trackbed for mag-lev. Useless alone; required for everything fast later.","#303744",83],
  ["r019","shock_quartz","obsidian_glass","tektite_scatter","Tektite Scatter",2,"ALLOY","Both of these were present at the impact.","Glass droplets flash-frozen mid-flight. High Pxd yield, comes with a crater story.","#231d2e",87],
  ["r020","permafrost_clathrate","sulfur_vent_crust","sour_slush","Sour Slush",2,"HAZARD","Cold and corrosive is a bad pairing.","Hazard terrain: −0.4 coherence/s, but the richest Clathrate node in the game.","#9db87a",82],
  ["r021","lunar_anorthosite","shock_quartz","regolith_sinter","Sintered Regolith Block",2,"ALLOY","Melt the dust, do not add anything.","The cheapest structural material. Printable anywhere, strong enough for T2 machines.","#8e939c",97],
  ["r022","crater_calcite","photon_salt","glowstone_aggregate","Glowstone Aggregate",2,"UTILITY","Charge the soft bright one.","Stores 40 Lumens and releases them over the night cycle. Night-time solar, basically.","#f2dd8e",92],
  ["r023","red_ochre_silt","wind_erosion","loess_plain","Loess Plain",2,"BIOME","Fine dust, patiently moved.","Deep fertile wind-blown soil. The only Tier-2 terrain flora will germinate in.","#c08a5e",90],
  ["r024","basalt_joint","curvature_wear","weathered_causeway","Weathered Causeway",2,"ROAD","Old stone, walked on.","Columnar tops worn flat into a natural road. Free paving wherever basalt outcrops.","#5a5f69",91],

  /* ════════════════ TIER 2 → 3 · LIVING HYBRIDS (22) ═════════════════ */
  ["r025","loess_plain","neon_mycelium","spore_cloud_forest","Spore Cloud Forest",3,"BIOME","Give the network something to eat.","Mycelium fruits into a drifting spore canopy. +0.62 biomass, permanent soft fog.","#2fd68a",93],
  ["r026","neon_mycelium","methane_fog","drifting_murk_wood","Drifting Murk Wood",3,"BIOME","Fog feeds it; it thickens the fog.","Self-reinforcing humid forest. Aq retention 2.2×, visibility 40 m.","#1f8a62",88],
  ["r027","rust_mudflat","sulfur_moss","pioneer_flat","Pioneer Flat",3,"BIOME","Something has to go first.","First self-sustaining biome. Produces 2 Aq/s with no machine at all.","#8a9a3c",94],
  ["r028","gypsum_bloom","phosphor_spore","luminous_desert_rose","Luminous Desert Rose",3,"LANDMARK","Crystals that someone moved into.","Gypsum blades colonised by phosphor spores. A 60 m coherence beacon that grows.","#c9a8f0",87],
  ["r029","frost_travertine","cyan_kelp","glacial_kelp_terrace","Glacial Kelp Terrace",3,"BIOME","Cold water still has current.","Stepped pools each holding a different kelp density. Classic screenshot biome.","#4fc0d6",86],
  ["r030","prismatic_obsidian_geode","phosphor_spore","spectral_geode_hollow","Spectral Geode Hollow",3,"LANDMARK","Light the inside of the prism.","Spore glow refracts through the geode. Projects a moving spectrum on every wall.","#8a5ce0",84],
  ["r031","carved_cobble_road","neon_mycelium","living_road","Living Road",3,"ROAD","The network follows traffic.","Mycelium colonises the joints and self-repairs the road. Zero maintenance forever.","#5aa862",89],
  ["r032","piezo_chalk","spore_meadow","hum_meadow","Humming Meadow",3,"UTILITY","Wind pushes grass; grass pushes rock.","Wind-driven piezo field: 26 cyc/s with no machine, no fuel, no heat.","#b8cf6a",85],
  ["r033","hematite_banding","hydro_coral_lichen","ferric_reef","Ferric Reef",3,"BIOME","Iron is a nutrient if you are patient.","Rust-red reef structure. +1.8× harvest and the best early underwater biome.","#c0583c",88],
  ["r034","sour_slush","sulfur_moss","acid_bog","Acid Bog",3,"HAZARD","Something learned to like it.","Hazard biome with the planet's only Logic Substrate surface node. Worth the burns.","#7e8a2a",83],
  ["r035","glowstone_aggregate","violet_puffball","beacon_fungus","Beacon Fungus",3,"UTILITY","Store light in something that spreads.","Self-propagating light source. Plant one, return in an hour to a lit valley.","#b574e0",90],
  ["r036","yardang_field","spore_meadow","windrow_steppe","Windrow Steppe",3,"BIOME","Ridges catch what the wind carries.","Seeds accumulate in the lee of each ridge. Striped biome, visually unmistakable.","#9fbf43",87],
  ["r037","regolith_sinter","amber_resin","resin_bonded_block","Resin-Bonded Block",3,"ALLOY","Glue the dust with something organic.","Structural block at a third of the Substrate cost. Quietly the best economy unlock.","#c08a40",92],
  ["r038","ferroglass_sheet","glowworm_shimmer","signal_mirror_array","Signal Mirror Array",3,"UTILITY","A mirror and something that blinks.","Relays Bandwidth optically between two points in line of sight. No pylons needed.","#6ec4e8",84],
  ["r039","living_road","piezo_chalk","generative_causeway","Generative Causeway",3,"ROAD","A road that repairs itself and a road that pays.","Self-healing road producing 18 cyc/s from traffic. The mid-game logistics backbone.","#78a870",86],
  ["r040","pioneer_flat","kinematic_spring","bouncing_hazard_geyser","Bouncing Hazard Geyser",3,"HAZARD","Bind a rhythm to something viscous.","A hazard that is also an elevator. Players farm these into vertical cargo highways.","#58f2b0",88],
  ["r041","giant_crystal_stalk","wind_erosion","singing_spire_field","Singing Spire Field",3,"LANDMARK","Erode something that already resonates.","Spires tuned by wear. The soundtrack of your planet becomes a readout of its shape.","#6e8ff0",85],
  ["r042","brackish_slime","photon_salt","thin_film_shallows","Thin-Film Shallows",3,"LIQUID" as RecipeClass,"Interference needs a light source.","Iridescent shallows. +2.0× Lumen capture over water, and it is gorgeous.","#56c9a0",87],
  ["r043","compacted_marl","hydro_coral_lichen","marl_reef_shelf","Marl Reef Shelf",3,"BIOME","Soft ground, hard tenants.","Shallow shelf that accretes upward. Grows new buildable land over real time.","#c08478",86],
  ["r044","fumarole_glaze","thermal_vent_reed","whistling_glazeworks","Whistling Glazeworks",3,"LANDMARK","Glass tubes and steam.","Vent reeds grow through glazed crust. Audible from 400 m; a natural waypoint.","#d98a3c",83],
  ["r045","lodestone_colonnade","signal_mirror_array","orienting_relay","Orienting Relay",3,"UTILITY","Something that points, plus something that sends.","Auto-aiming bandwidth relay. Finds its partner on placement. Logistics QoL unlock.","#4e6a9e",82],
  ["r046","tektite_scatter","geode_amethyst","shatterglass_minefield","Shatterglass Minefield",3,"HAZARD","Fracture a perfect mirror.","Thousands of tiny mirrors. Lethal, beautiful, and it farms Lumens at 3.1×.","#cfd8e8",81],

  /* ════════════════ TIER 3 → 4 · ECOSYSTEMS (20) ═════════════════════ */
  ["r047","spore_cloud_forest","cyan_kelp","tidal_spore_estuary","Tidal Spore Estuary",4,"BIOME","Where the forest meets the water.","Ecotone biome: both parents' species coexist. +0.3 Variety bonus to global Fi.","#38b8a0",90],
  ["r048","ferric_reef","geode_amethyst","amethyst_reef_crown","Amethyst Reef Crown",4,"LANDMARK","Let the reef grow onto the crystal.","Reef colonising geode cavities. The highest harvest-yield node in Tier 4.","#a05cc0",86],
  ["r049","glacial_kelp_terrace","curl_flow","tidal_current_garden","Tidal Current Garden",4,"BIOME","Give the water a direction.","True divergence-free flow drives the whole bay. One cartridge, four systems upgraded.","#3fb8e0",89],
  ["r050","beacon_fungus","giant_crystal_stalk","cathedral_of_light","Cathedral of Light",4,"LANDMARK","Light inside a cathedral.","Selenite chamber lit from within. 90 m coherence radius; the game's first true safe haven.","#a8c4ff",87],
  ["r051","acid_bog","amber_resin","preserving_tar_pit","Preserving Tar Pit",4,"HAZARD","Acid plus resin equals a very good archive.","Hazard that preserves anything dropped in it perfectly. Players use it as cold storage.","#6e5a1e",82],
  ["r052","windrow_steppe","altitude_mask","alpine_snowline","Alpine Snowline Governance",4,"RULE","Decide WHERE, not what.","A RULE binding cover to altitude. Raise a mountain and it snow-caps itself. Forever.","#dfe9f5",93],
  ["r053","hum_meadow","solar_absorb_grid","harvest_prairie","Harvest Prairie",4,"UTILITY","Wind and sun on the same hectare.","Combined-cycle power biome: 74 cyc/s and 1.9× Lx, zero heat, zero fuel.","#c9d66a",88],
  ["r054","generative_causeway","hex_paver","hexlink_arterial","Hexlink Arterial",4,"ROAD","Tessellate the self-healing road.","Four-lane arterial. +1.6× rover grip, +1.45× speed, carries Clock AND Bandwidth.","#6e7c88",91],
  ["r055","thin_film_shallows","coral_atoll","opalescent_lagoon","Opalescent Lagoon",4,"BIOME","Thin film over a reef.","Nacre-bright lagoon. Highest Pxd yield of any water biome and the best postcard.","#8fd8e8",88],
  ["r056","drifting_murk_wood","glowworm_shimmer","lantern_bog","Lantern Bog",4,"BIOME","Hang lights in the fog.","Fog scatters the glow into volumetric shafts. The first time volumetrics pay rent.","#3f9fe8",87],
  ["r057","singing_spire_field","resonant_pyrite_lens","harmonic_amplifier","Harmonic Amplifier",4,"UTILITY","Focus what is already singing.","Broadcasts Coherence 220 m along the resonant axis. Expedition infrastructure.","#d6b44e",84],
  ["r058","marl_reef_shelf","red_mangrove","living_coastline","Living Coastline",4,"BIOME","Roots need somewhere to grip.","Self-extending shoreline that grows buildable land and resists Null Tides entirely.","#c0423a",89],
  ["r059","pioneer_flat","hexapod_walk","scrap_strider","Scrap Strider Mount",4,"VEHICLE","A silhouette and a gait.","IK retargets to any chassis with six sockets. Leg length → step height → terrain access.","#d8a24a",90],
  ["r060","spectral_geode_hollow","aurora_lichen","prismatic_grotto","Prismatic Grotto",4,"LANDMARK","Lichen that answers the magnetic field, inside a prism.","Flares visibly during solar events. A barometer you can stand inside.","#36d6b0",85],
  ["r061","resin_bonded_block","heat_shield_tile","ablative_habitat","Ablative Habitat Shell",4,"STRUCTURE" as RecipeClass,"Cheap block, expensive skin.","Habitat shell at 40% cost with full thermal rating. The base-building breakthrough.","#c6b49a",89],
  ["r062","whistling_glazeworks","thermal_vent_reed","steam_organ","The Steam Organ",4,"LANDMARK","Tune the whistles on purpose.","Player-tunable: carve the vents and it plays your melody. Several will go viral.","#e0934a",83],
  ["r063","shatterglass_minefield","solar_absorb_grid","heliostat_field","Heliostat Field",4,"UTILITY","Point every shard at the same place.","Concentrated solar: 3.4× Lx in the focus ring, and anything organic standing there cooks.","#f0d070",85],
  ["r064","orienting_relay","maglev_rail","autonomous_freight_line","Autonomous Freight Line",4,"ROAD","A rail that knows where it is going.","Self-routing cargo. The Factorio moment: logistics stop being your problem.","#3f7ad0",88],
  ["r065","tidal_spore_estuary","petrified_opal_bark","opal_mangrove_delta","Opal Mangrove Delta",4,"BIOME","Let the estuary fossilise slowly.","Living and petrified growth interleaved. +0.4 Variety; the richest Tier-4 ecology.","#c09868",86],
  ["r066","bouncing_hazard_geyser","curl_flow","vortex_launcher","Vortex Launcher",4,"VEHICLE","A spring and a vector field.","Launches you along the flow field, not just up. Skill-based traversal unlocks here.","#58f2b0",84],

  /* ════════════════ TIER 4 → 5 · MATURE WORLDS (18) ══════════════════ */
  ["r067","opal_mangrove_delta","emerald_canopy","primordial_rainforest","Primordial Rainforest",5,"BIOME","Add three storeys.","The planet's climax ecosystem. Biomass 1.0, and the weather system starts self-sustaining.","#39a648",92],
  ["r068","living_coastline","liquid_neon_shore","luminous_tideline","Luminous Tideline",5,"BIOME","Every wave writes its own outline.","Bioluminescent surf visible from orbit. 3.0× Lumen gain along the whole coast.","#2fe0ff",90],
  ["r069","cathedral_of_light","runic_granite","hall_of_first_light","Hall of First Light",5,"LANDMARK","Precursor stone, modern light.","A precursor structure you have relit. +140 Fi/s trickle and a 120 m safe radius.","#9c94b0",86],
  ["r070","harvest_prairie","solar_fern_glade","photosynthetic_grid","Photosynthetic Grid",5,"UTILITY","Plants already solved solar tracking.","Living power plant: 160 cyc/s, self-repairing, cooler than ambient. Endgame power.","#b8a032",89],
  ["r071","hexlink_arterial","prism_road","retroreflective_interchange","Retroreflective Interchange",5,"ROAD","Make the arterial throw light back.","A convoy at night drives on a star field. +2.7× Lx and +1.5× speed.","#6e48c0",87],
  ["r072","amethyst_reef_crown","pearl_coral","nacre_cathedral","Nacre Cathedral",5,"LANDMARK","Line the crown with 400 nm platelets.","Structural colour at architectural scale. The single most-photographed object in the Galaxy.","#e8dcc8",85],
  ["r073","tidal_current_garden","chrono_kelp","temporal_eddy","Temporal Eddy",5,"EXOTIC" as RecipeClass,"Current that arrives late.","Objects in the eddy lag reality by 4–9 s. Puzzle traversal, and nobody has explained it.","#44b6e0",78],
  ["r074","lantern_bog","aether_spore_forest","floating_lantern_wood","Floating Lantern Wood",5,"BIOME","Lights that hover.","Buoyant fruiting bodies at head height. The most beloved biome in playtest, by far.","#7a52d6",88],
  ["r075","alpine_snowline","aurora_lichen","polar_aurora_cap","Polar Aurora Cap",5,"BIOME","Bind the glow to altitude.","Magnetic lichen above the snowline. The whole cap ripples during a flare.","#36d6b0",87],
  ["r076","prismatic_grotto","prismata_grass","diffraction_valley","Diffraction Valley",5,"BIOME","A grating on every blade.","A different rainbow at every sun angle. Entirely cosmetic. Nobody cares, it is perfect.","#7fd43c",86],
  ["r077","ablative_habitat","pneumatic_deck","arcology_module","Arcology Module",5,"STRUCTURE" as RecipeClass,"Shell plus floor equals a place to live.","Stackable habitat with integrated life support. Base building becomes city building.","#63747f",91],
  ["r078","autonomous_freight_line","harmonic_amplifier","resonant_logistics_web","Resonant Logistics Web",5,"UTILITY","Freight that broadcasts.","Cargo line doubling as a Coherence network. Your supply chain becomes your safety net.","#d6b44e",85],
  ["r079","heliostat_field","gilded_basalt_terrace","solar_forge_terrace","Solar Forge Terrace",5,"UTILITY","Focus the sun onto gold.","Smelts Logic Substrate directly from ore at 4× rate. The late-game economy breakpoint.","#f0d68c",87],
  ["r080","preserving_tar_pit","runic_granite","precursor_archive","Precursor Archive",5,"LANDMARK","Perfect preservation, in a place that was built.","Yields intact precursor cartridges. The only source of three Tier-6 recipes.","#7d7585",80],
  ["r081","scrap_strider","maglev_rail","levitating_strider","Levitating Strider",5,"VEHICLE","Take the legs off the ground.","Frictionless walker. Crosses water, lava and Null Pits. The exploration endgame.","#4a86d0",86],
  ["r082","steam_organ","singing_spire_field","planetary_chorus","Planetary Chorus",5,"LANDMARK","Tune the whole continent.","Every resonant feature on the planet plays in key. Generative score, permanently.","#c08a4a",82],
  ["r083","vortex_launcher","liquid_neon_shore","neon_slipstream","Neon Slipstream",5,"VEHICLE","Ride the glowing current.","High-speed traversal lane along any coast. Looks absurd. Is absurd. Ship it.","#2fe0ff",84],
  ["r084","photosynthetic_grid","obsidian_garden","shadow_garden_reactor","Shadow Garden Reactor",5,"UTILITY","Plants that prefer the dark.","Power from the night side. Finally closes the 24-minute day/night energy gap.","#4e3a60",83],

  /* ════════════════ TIER 5 → 6 · LEGENDARY MASTERPIECES (16) ═════════ */
  ["r085","primordial_rainforest","celestial_orchid","world_tree_basin","The World Tree Basin",6,"LEGENDARY","The jungle, and the flower that only blooms in eclipse.","Biomass 1.0, +260 Fi/s, and the canopy flowers planet-wide during every eclipse.","#b45cd6",88],
  ["r086","luminous_tideline","chrono_kelp","eternal_tide","The Eternal Tide",6,"LEGENDARY","Light that remembers where the water was.","The shoreline glows with its own history: nine seconds of past surf, always visible.","#44b6e0",79],
  ["r087","nacre_cathedral","archway_pylon","the_pearl_gate","The Pearl Gate",6,"LEGENDARY","A cathedral with a doorway in it.","A second portal. Bandwidth 192 ch — the first structure that can host a visitor.","#fff6ea",84],
  ["r088","hall_of_first_light","precursor_archive","the_relit_city","The Relit City",6,"LEGENDARY","Archive plus hall equals who built this.","The narrative payoff. Unlocks the precursor lore chain and three unique cartridges.","#9c94b0",81],
  ["r089","polar_aurora_cap","floating_lantern_wood","the_hanging_aurora","The Hanging Aurora",6,"LEGENDARY","Lights that float, under lights that ripple.","Two light layers moving at different speeds. Pure spectacle; +2.9× Lx planet-wide.","#36d6b0",85],
  ["r090","diffraction_valley","prism_road","the_spectrum_highway","The Spectrum Highway",6,"LEGENDARY","Pave the rainbow.","Traversal at 2.1× speed through a valley that is a continuous prism. Trailer shot.","#9b6ef0",86],
  ["r091","arcology_module","vault_plinth","the_deep_arcology","The Deep Arcology",6,"LEGENDARY","Build the city on the thing that was already there.","Subterranean megastructure. 300 m coherence, immune to every weather event.","#4a4a60",87],
  ["r092","solar_forge_terrace","shadow_garden_reactor","perpetual_foundry","The Perpetual Foundry",6,"LEGENDARY","Day power and night power, married.","Never browns out. 640 cyc/s flat, forever. The last power building you will place.","#e0b45c",88],
  ["r093","resonant_logistics_web","the_pearl_gate","galaxy_freight_exchange","Galaxy Freight Exchange",6,"LEGENDARY","Freight, meet the second portal.","Cross-world logistics. Ship cartridges to another player's moon while you sleep.","#8fd0ff",82],
  ["r094","temporal_eddy","precursor_archive","the_recursion_pool","The Recursion Pool",6,"LEGENDARY","Preserved time, in moving water.","Replays your own command journal as visible ghosts. The game watching itself be played.","#5aa0c8",74],
  ["r095","world_tree_basin","aether_spore_forest","the_breathing_continent","The Breathing Continent",6,"LEGENDARY","Make the whole landmass one organism.","The continent inhales on a 6-minute cycle. Terrain rises and falls. +400 Fi/s.","#7a52d6",77],
  ["r096","planetary_chorus","the_hanging_aurora","the_auroral_symphony","The Auroral Symphony",6,"LEGENDARY","The chorus, lit.","Light and sound locked to the same generative score. The intended final screenshot.","#6ee0c0",80],
  ["r097","levitating_strider","neon_slipstream","the_comet_rider","The Comet Rider",6,"LEGENDARY","Frictionless, on a glowing lane.","310 km/h sustained. Circumnavigate the moon in eleven minutes. Players will time it.","#2fe0ff",83],
  ["r098","the_relit_city","the_deep_arcology","the_restored_civilisation","The Restored Civilisation",6,"LEGENDARY","Above and below, reunited.","Victory-adjacent: the precursor settlement functions again. Unlocks Legacy Mode.","#c0b8d0",85],
  ["r099","the_spectrum_highway","galaxy_freight_exchange","the_open_road","The Open Road",6,"LEGENDARY","A road that leaves the planet.","The highway terminates in a portal. Drive from your moon into somebody else's.","#b49cf0",81],
  ["r100","the_breathing_continent","the_auroral_symphony","setmix","SETMIX",6,"LEGENDARY","Everything, at once.","The final fusion. The planet, its light, its sound and its motion become one preset — exportable, forkable, and somebody else's Stage 1 inspiration.","#ffffff",69],
];

export const RECIPES: Recipe[] = ROWS.map(([id, a, b, out, outName, tier, cls, hint, effect, preview, confidence]) => ({
  id, a, b, out, outName, tier, cls, hint, effect, preview, confidence,
}));

export const RECIPE_BY_ID = new Map(RECIPES.map((r) => [r.id, r]));
export const RECIPE_BY_OUT = new Map(RECIPES.map((r) => [r.out, r]));

/* ─────────────────────────────── the discovery graph, as a graph ─────── */

export interface RecipeNode {
  id: string;
  name: string;
  tier: number;
  /** recipes that consume this as an input */
  unlocks: string[];
  /** the recipe that produces it, if any (bases have none) */
  from: string | null;
  isBase: boolean;
}

export function buildDiscoveryGraph(baseIds: readonly string[]): Map<string, RecipeNode> {
  const g = new Map<string, RecipeNode>();
  const touch = (id: string, name: string, tier: number, isBase: boolean) => {
    if (!g.has(id)) g.set(id, { id, name, tier, unlocks: [], from: null, isBase });
    return g.get(id)!;
  };
  for (const b of baseIds) touch(b, b, 1, true);
  for (const r of RECIPES) {
    const child = touch(r.out, r.outName, r.tier, false);
    child.from = r.id;
    touch(r.a, r.a, Math.max(1, r.tier - 1), baseIds.includes(r.a)).unlocks.push(r.id);
    touch(r.b, r.b, Math.max(1, r.tier - 1), baseIds.includes(r.b)).unlocks.push(r.id);
  }
  return g;
}

/** Which recipes become visible given a set of owned cartridge/output ids. */
export function availableRecipes(owned: ReadonlySet<string>): Recipe[] {
  return RECIPES.filter((r) => owned.has(r.a) && owned.has(r.b));
}

/** Everything reachable from `owned`, by repeated fusion. The Codex uses this
 *  to show "3 recipes away" rather than a flat locked list. */
export function reachable(owned: ReadonlySet<string>, maxDepth = 8) {
  const have = new Set(owned);
  const depth = new Map<string, number>();
  for (let d = 1; d <= maxDepth; d++) {
    let grew = false;
    for (const r of RECIPES) {
      if (have.has(r.out)) continue;
      if (have.has(r.a) && have.has(r.b)) {
        have.add(r.out);
        depth.set(r.out, d);
        grew = true;
      }
    }
    if (!grew) break;
  }
  return { have, depth };
}

export const RECIPE_STATS = {
  total: RECIPES.length,
  byTier: [1, 2, 3, 4, 5, 6].map((t) => ({ t, n: RECIPES.filter((r) => r.tier === t).length })),
  byClass: [...new Set(RECIPES.map((r) => r.cls))].map((c) => ({ c, n: RECIPES.filter((r) => r.cls === c).length })),
  legendary: RECIPES.filter((r) => r.cls === "LEGENDARY").length,
  avgConfidence: Math.round(RECIPES.reduce((a, r) => a + r.confidence, 0) / RECIPES.length),
};
