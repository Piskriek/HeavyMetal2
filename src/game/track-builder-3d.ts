/* =============================================================================
   HEAVY METAL GP 2 — FULL 3D TRACK BUILDER
   Complete 3D world editor: free-fly camera, raycast surface snapping onto
   track & terrain, categorized prop palette, 3D manipulation, undo/redo,
   and JSON persistence.
   ============================================================================= */
import * as THREE from 'three';
import { wedgeMesh, createSlingshotMesh, type TrackData, type TrackSample } from './renderer-3d';
import { classifyPlacedRamp, getTrackSpace } from './track-space';

export type PropCategory = 'foliage' | 'trackside' | 'cavern_mine' | 'stadium' | 'decals' | 'goblins';

export interface PropDefinition {
  type: string;
  name: string;
  category: PropCategory;
  url: string;
  defaultWidth: number;
  defaultHeight: number;
  defaultAltitude?: number;
  alignBottom?: boolean;
  isRamp?: boolean;
  isDecal?: boolean;
  is3DModel?: boolean;
  isSlingshot?: boolean;
}

export type DecalSide = 'front' | 'back' | 'left' | 'right';

export interface PlacedProp {
  id: string;
  type: string;
  name: string;
  x: number;
  y: number;
  z: number;
  rotY: number;
  rotZ?: number;
  rotX?: number;
  quaternion?: [number, number, number, number];
  scale: number;
  alignToTrack: boolean;
  trackDist?: number;
  cameraFacing?: boolean;
  flipX?: boolean;
  isDecal?: boolean;
  groupId?: string;
  lit?: boolean;
}

export const PROP_DEFINITIONS: PropDefinition[] = [
  // --- FOLIAGE & NATURE ---
  { type: 'prop_09_pine_lookout', name: 'Pine Lookout Outcrop', category: 'foliage', url: '/art/props/alpha/prop-09-pine-lookout-outcrop.png', defaultWidth: 800, defaultHeight: 1080 },
  { type: 'prop_08_windmill_gears', name: 'Goblin Windmill & Gears', category: 'foliage', url: '/art/props/alpha/prop-08-goblin-windmill-gears.png', defaultWidth: 720, defaultHeight: 920 },
  { type: 'prop_22_armored_sheep_pen', name: 'Armored Sheep Pen', category: 'foliage', url: '/art/props/alpha/prop-22-armored-sheep-pen.png', defaultWidth: 1200, defaultHeight: 560 },
  { type: 'prop_27_rock_spire_lookout', name: 'Rock Spire Lookout', category: 'foliage', url: '/art/props/alpha/prop-27-rock-spire-lookout.png', defaultWidth: 600, defaultHeight: 1200 },
  { type: 'prop_28_cavern_waterwheel', name: 'Cavern Waterwheel Cascade', category: 'foliage', url: '/art/props/alpha/prop-28-cavern-waterwheel-cascade.png', defaultWidth: 700, defaultHeight: 1400 },
  { type: 'pines_cluster', name: 'Pine Forest Wall', category: 'foliage', url: '/art/treewall-pines.png', defaultWidth: 1400, defaultHeight: 950 },
  { type: 'pine_landmark', name: 'Pine Outcrop', category: 'foliage', url: '/art/landmark-pines.png', defaultWidth: 800, defaultHeight: 1000 },
  { type: 'boulder_a', name: 'Granite Boulder A', category: 'foliage', url: '/art/track-parts/rock-boulder-a.png', defaultWidth: 420, defaultHeight: 360 },
  { type: 'boulder_b', name: 'Granite Boulder B', category: 'foliage', url: '/art/track-parts/rock-boulder-b.png', defaultWidth: 360, defaultHeight: 310 },
  { type: 'pasture', name: 'Green Pasture', category: 'foliage', url: '/art/landmark-pasture.png', defaultWidth: 800, defaultHeight: 500 },
  { type: 'prop_31_grass_seam_fringe', name: 'Grass Seam Fringe', category: 'foliage', url: '/art/props/alpha/prop-31-grass-seam-fringe-wide.png', defaultWidth: 1200, defaultHeight: 500 },
  { type: 'prop_32_mossy_embankment', name: 'Mossy Embankment Skirt', category: 'foliage', url: '/art/props/alpha/prop-32-mossy-embankment-skirt.png', defaultWidth: 1200, defaultHeight: 500 },
  { type: 'prop_33_rubble_seam_strip', name: 'Rubble Gravel Seam Strip', category: 'foliage', url: '/art/props/alpha/prop-33-rubble-gravel-seam-strip.png', defaultWidth: 1200, defaultHeight: 500 },
  { type: 'prop_36_glowcap_thicket', name: 'Glowcap Mushroom Thicket', category: 'foliage', url: '/art/props/alpha/prop-36-glowcap-mushroom-thicket.png', defaultWidth: 900, defaultHeight: 500 },
  { type: 'prop_37_fern_undergrowth', name: 'Fern Bramble Undergrowth', category: 'foliage', url: '/art/props/alpha/prop-37-fern-bramble-undergrowth.png', defaultWidth: 900, defaultHeight: 500 },

  // --- TRACKSIDE & STUNTS ---
  { type: 'slingshot_3d_launcher', name: 'Starting Grid Slingshot (3D)', category: 'trackside', url: '/art/props/alpha/prop-18-goblin-slingshot-launcher.png', defaultWidth: 320, defaultHeight: 420, is3DModel: true, isSlingshot: true },
  { type: 'timber_ramp', name: 'Timber Stunt Ramp', category: 'trackside', url: '/art/track-parts/bridge-wooden-broken.png', defaultWidth: 960, defaultHeight: 260, isRamp: true },
  { type: 'rock_springboard', name: 'Rock Springboard Ramp', category: 'trackside', url: '/art/track-parts/rock-platform-springboard.png', defaultWidth: 800, defaultHeight: 280, isRamp: true },
  { type: 'prop_01_lantern_post', name: 'Triple Lantern Post', category: 'trackside', url: '/art/props/alpha/prop-01-lantern-post-triple.png', defaultWidth: 360, defaultHeight: 480 },
  { type: 'prop_23_sign_sheep', name: 'Sign: Beware Sheep', category: 'trackside', url: '/art/props/alpha/prop-23-hazard-sign-sheep.png', defaultWidth: 320, defaultHeight: 430 },
  { type: 'prop_24_sign_tnt', name: 'Sign: High Explosive', category: 'trackside', url: '/art/props/alpha/prop-24-hazard-sign-explosives.png', defaultWidth: 380, defaultHeight: 380 },
  { type: 'prop_11_broken_rope_bridge', name: 'Broken Rope Bridge', category: 'trackside', url: '/art/props/alpha/prop-11-broken-rope-bridge.png', defaultWidth: 1100, defaultHeight: 600 },
  { type: 'prop_12_goblin_scaffold', name: 'Goblin Scaffold Tower', category: 'trackside', url: '/art/props/alpha/prop-12-goblin-scaffold-tower.png', defaultWidth: 600, defaultHeight: 1100 },
  { type: 'prop_16_molten_rock_arch', name: 'Molten Rock Natural Arch', category: 'trackside', url: '/art/props/alpha/prop-16-molten-rock-natural-arch.png', defaultWidth: 1400, defaultHeight: 760 },
  { type: 'prop_18_slingshot_launcher', name: 'Goblin Slingshot Launcher', category: 'trackside', url: '/art/props/alpha/prop-18-goblin-slingshot-launcher.png', defaultWidth: 1000, defaultHeight: 550 },
  { type: 'prop_20_springboard_platform', name: 'Goblin Springboard Platform', category: 'trackside', url: '/art/props/alpha/prop-20-goblin-springboard-platform.png', defaultWidth: 800, defaultHeight: 800 },
  { type: 'prop_21_quarry_crane', name: 'Quarry Excavation Crane', category: 'trackside', url: '/art/props/alpha/prop-21-quarry-excavation-crane.png', defaultWidth: 1100, defaultHeight: 780 },
  { type: 'prop_25_timber_coaster_loop', name: 'Timber Coaster Loop', category: 'trackside', url: '/art/props/alpha/prop-25-timber-coaster-loop.png', defaultWidth: 1100, defaultHeight: 1100 },
  { type: 'prop_29_spiked_barricade', name: 'Spiked Boulder Barricade', category: 'trackside', url: '/art/props/alpha/prop-29-spiked-boulder-barricade.png', defaultWidth: 700, defaultHeight: 700 },
  { type: 'prop_30_slingshot_downrange', name: 'Goblin Slingshot Downrange', category: 'trackside', url: '/art/props/alpha/prop-30-goblin-slingshot-downrange.png', defaultWidth: 800, defaultHeight: 1200 },
  { type: 'prop_34_timber_crib_wall', name: 'Timber Crib Retaining Wall', category: 'trackside', url: '/art/props/alpha/prop-34-timber-crib-retaining-wall.png', defaultWidth: 1100, defaultHeight: 600 },
  { type: 'prop_38_scrap_barricade', name: 'Scrap Iron Barricade', category: 'trackside', url: '/art/props/alpha/prop-38-scrap-iron-barricade.png', defaultWidth: 1000, defaultHeight: 550 },
  { type: 'prop_40_timber_arch_gate', name: 'Timber Arch Gate', category: 'trackside', url: '/art/props/alpha/prop-40-timber-arch-gate-lanterns.png', defaultWidth: 1300, defaultHeight: 700 },
  { type: 'prop_51_goblin_start_archway', name: 'Grand Goblin Start Archway', category: 'trackside', url: '/art/props/alpha/prop-51-goblin-start-archway.png', defaultWidth: 1800, defaultHeight: 1650 },
  { type: 'prop_52_arch_pillar_stone', name: 'Archway Stone Pillar', category: 'trackside', url: '/art/props/alpha/prop-52-arch-pillar-stone.png', defaultWidth: 500, defaultHeight: 1200 },
  { type: 'prop_53_arch_lintel_timber', name: 'Archway Timber Crossbeam', category: 'trackside', url: '/art/props/alpha/prop-53-arch-lintel-timber.png', defaultWidth: 1600, defaultHeight: 450 },
  { type: 'prop_54_arch_curve_timber', name: 'Archway Curved Header', category: 'trackside', url: '/art/props/alpha/prop-54-arch-curve-timber.png', defaultWidth: 1500, defaultHeight: 800 },
  { type: 'prop_55_arch_banner_flags', name: 'Archway Checkered Pennants', category: 'trackside', url: '/art/props/alpha/prop-55-arch-banner-flags.png', defaultWidth: 1400, defaultHeight: 520 },
  { type: 'prop_56_arch_torch_sconce', name: 'Archway Wall Torch Sconce', category: 'trackside', url: '/art/props/alpha/prop-56-arch-torch-sconce.png', defaultWidth: 320, defaultHeight: 480 },
  { type: 'prop_57_arch_crest_spikes', name: 'Archway Spiked Crest Trophy', category: 'trackside', url: '/art/props/alpha/prop-57-arch-crest-spikes.png', defaultWidth: 520, defaultHeight: 520 },
  { type: 'prop_42_plunge_basin', name: 'Waterfall Plunge Basin', category: 'trackside', url: '/art/props/alpha/prop-42-waterfall-plunge-basin.png', defaultWidth: 1100, defaultHeight: 600 },
  { type: 'prop_49_blast_crater', name: 'Scorched Blast Crater', category: 'trackside', url: '/art/props/alpha/prop-49-blast-crater-scorched.png', defaultWidth: 1000, defaultHeight: 550 },
  { type: 'cliff_scaffold', name: 'Cliff Scaffolding', category: 'trackside', url: '/art/track-parts/cliff-scaffolding.png', defaultWidth: 650, defaultHeight: 750 },
  { type: 'waterfall_curtain', name: 'Waterfall Curtain', category: 'trackside', url: '/art/track-parts/waterfall-curtain.png', defaultWidth: 900, defaultHeight: 1400 },
  { type: 'waterfall_splash', name: 'Waterfall Spray', category: 'trackside', url: '/art/track-parts/waterfall-splash.png', defaultWidth: 650, defaultHeight: 450 },

  // --- CAVERN & MINE ---
  { type: 'prop_13_cavern_mine_gate', name: 'Cavern Mine Gate', category: 'cavern_mine', url: '/art/props/alpha/prop-13-cavern-mine-gate.png', defaultWidth: 1400, defaultHeight: 760 },
  { type: 'prop_26_granite_tunnel_portal', name: 'Granite Tunnel Portal', category: 'cavern_mine', url: '/art/props/alpha/prop-26-granite-tunnel-portal.png', defaultWidth: 1300, defaultHeight: 1300 },
  { type: 'prop_02_ore_cart_spilling', name: 'Spilling Lava Ore Cart', category: 'cavern_mine', url: '/art/props/alpha/prop-02-ore-cart-spilling.png', defaultWidth: 500, defaultHeight: 400 },
  { type: 'prop_03_tnt_powder_kegs', name: 'TNT Powder Kegs', category: 'cavern_mine', url: '/art/props/alpha/prop-03-tnt-powder-kegs.png', defaultWidth: 420, defaultHeight: 420 },
  { type: 'prop_04_smelting_crucible', name: 'Smelting Crucible', category: 'cavern_mine', url: '/art/props/alpha/prop-04-smelting-crucible.png', defaultWidth: 460, defaultHeight: 500 },
  { type: 'prop_05_rail_turntable', name: 'Rail Turntable Switch', category: 'cavern_mine', url: '/art/props/alpha/prop-05-rail-turntable-switch.png', defaultWidth: 600, defaultHeight: 400 },
  { type: 'prop_06_crystal_deflector', name: 'Crystal Rock Deflector', category: 'cavern_mine', url: '/art/props/alpha/prop-06-crystal-rock-deflector.png', defaultWidth: 480, defaultHeight: 420 },
  { type: 'prop_07_tripod_cauldron', name: 'Tripod Molten Cauldron', category: 'cavern_mine', url: '/art/props/alpha/prop-07-tripod-cauldron-molten.png', defaultWidth: 480, defaultHeight: 520 },
  { type: 'prop_35_granite_strata_wall', name: 'Granite Strata Seam Wall', category: 'cavern_mine', url: '/art/props/alpha/prop-35-granite-strata-seam-wall.png', defaultWidth: 1100, defaultHeight: 600 },
  { type: 'prop_41_molten_slag_channel', name: 'Molten Slag Channel', category: 'cavern_mine', url: '/art/props/alpha/prop-41-molten-slag-channel.png', defaultWidth: 1100, defaultHeight: 600 },
  { type: 'prop_43_rail_junction', name: 'Mine Rail Buffer Junction', category: 'cavern_mine', url: '/art/props/alpha/prop-43-mine-rail-buffer-junction.png', defaultWidth: 1000, defaultHeight: 550 },
  { type: 'prop_44_chain_hoist', name: 'Chain Hoist Gantry', category: 'cavern_mine', url: '/art/props/alpha/prop-44-chain-hoist-gantry.png', defaultWidth: 1100, defaultHeight: 600 },
  { type: 'prop_46_wall_curtain_left', name: 'Cavern Wall Curtain Left', category: 'cavern_mine', url: '/art/props/alpha/prop-46-cavern-wall-curtain-left.png', defaultWidth: 600, defaultHeight: 1050 },
  { type: 'prop_47_wall_curtain_right', name: 'Cavern Wall Curtain Right', category: 'cavern_mine', url: '/art/props/alpha/prop-47-cavern-wall-curtain-right.png', defaultWidth: 650, defaultHeight: 950 },
  { type: 'prop_48_stalactite_cluster', name: 'Stalactite Ceiling Cluster', category: 'cavern_mine', url: '/art/props/alpha/prop-48-stalactite-ceiling-cluster.png', defaultWidth: 1100, defaultHeight: 600 },
  { type: 'tunnel_mouth', name: 'Stone Maw Tunnel', category: 'cavern_mine', url: '/art/track-parts/tunnel-mouth-stone.png', defaultWidth: 1800, defaultHeight: 1400 },
  { type: 'tunnel_frame', name: 'Rock Tunnel Frame', category: 'cavern_mine', url: '/art/track-parts/rock-tunnel-frame-a.png', defaultWidth: 1600, defaultHeight: 1200 },
  { type: 'mine_rails', name: 'Mine Rail Siding', category: 'cavern_mine', url: '/art/track-parts/mine-rails.png', defaultWidth: 700, defaultHeight: 300 },

  // --- STADIUM & SPECTATORS ---
  { type: 'prop_14_scrapdome_gantry', name: 'Scrapdome Finish Gantry', category: 'stadium', url: '/art/props/alpha/prop-14-scrapdome-finish-gantry.png', defaultWidth: 1500, defaultHeight: 820 },
  { type: 'prop_15_spectator_terrace', name: 'Goblin Spectator Terrace', category: 'stadium', url: '/art/props/alpha/prop-15-goblin-spectator-terrace.png', defaultWidth: 1300, defaultHeight: 710 },
  { type: 'prop_19_racetrack_grandstand', name: 'Racetrack Grandstand', category: 'stadium', url: '/art/props/alpha/prop-19-racetrack-grandstand.png', defaultWidth: 1400, defaultHeight: 760 },
  { type: 'prop_17_goblin_war_drums', name: 'Goblin War Drums', category: 'stadium', url: '/art/props/alpha/prop-17-goblin-war-drums.png', defaultWidth: 900, defaultHeight: 490 },
  { type: 'prop_10_scout_blimp', name: 'Scout Zeppelin Blimp', category: 'stadium', url: '/art/props/alpha/prop-10-scout-blimp-zeppelin.png', defaultWidth: 1200, defaultHeight: 800 },
  { type: 'bleacher_a', name: 'Goblin Bleacher A', category: 'stadium', url: '/art/track-parts/goblin-bleacher-a.png', defaultWidth: 1100, defaultHeight: 850 },
  { type: 'bleacher_b', name: 'Goblin Bleacher B', category: 'stadium', url: '/art/track-parts/goblin-bleacher-b.png', defaultWidth: 1100, defaultHeight: 850 },
  { type: 'crowd_banner', name: 'Cheering Crowd Banner', category: 'stadium', url: '/art/foreground-crowd.png', defaultWidth: 1500, defaultHeight: 500 },
  { type: 'checkered_flag', name: 'Checkered Flag', category: 'stadium', url: '/art/flag-checkered.png', defaultWidth: 380, defaultHeight: 380 },
  { type: 'prop_39_pit_canopy_tent', name: 'Goblin Pit Canopy Tent', category: 'stadium', url: '/art/props/alpha/prop-39-goblin-pit-canopy-tent.png', defaultWidth: 1300, defaultHeight: 700 },
  { type: 'prop_45_cheer_platform', name: 'Goblin Cheer Platform', category: 'stadium', url: '/art/props/alpha/prop-45-goblin-cheer-platform-horn.png', defaultWidth: 1100, defaultHeight: 600 },
  { type: 'prop_50_flag_pole_row', name: 'Pennant Flag Pole Row', category: 'stadium', url: '/art/props/alpha/prop-50-pennant-flag-pole-row.png', defaultWidth: 1200, defaultHeight: 650 },

  // --- ROAD & TERRAIN DECALS (BLIZZARD DIRT, STONE, & MODULAR BREAKUP PANELS) ---
  // Blizzard Hand-Painted Dirt & Stone
  { type: 'decal_blizzard_dirt_patch', name: 'Blizzard Compacted Dirt', category: 'decals', url: '/art/decals/decal-blizzard-dirt-patch.png', defaultWidth: 550, defaultHeight: 550, isDecal: true },
  { type: 'decal_blizzard_stone_slab', name: 'Blizzard Cobble & Flagstone', category: 'decals', url: '/art/decals/decal-blizzard-stone-slab.png', defaultWidth: 560, defaultHeight: 560, isDecal: true },
  { type: 'decal_blizzard_rock_crag', name: 'Blizzard Slate Bedrock Crag', category: 'decals', url: '/art/decals/decal-blizzard-rock-crag.png', defaultWidth: 550, defaultHeight: 550, isDecal: true },
  { type: 'decal_blizzard_gravel_earth', name: 'Blizzard Earth & Gravel Crater', category: 'decals', url: '/art/decals/decal-blizzard-gravel-earth.png', defaultWidth: 550, defaultHeight: 550, isDecal: true },

  // Modular Breakup Panels: Steel & Wood
  { type: 'decal_panel_scrap_steel', name: 'Goblin Scrap Steel Plating', category: 'decals', url: '/art/decals/decal-panel-scrap-steel.png', defaultWidth: 580, defaultHeight: 580, isDecal: true },
  { type: 'decal_panel_wood_planks', name: 'Rough Timber Deck Planks', category: 'decals', url: '/art/decals/decal-panel-wood-planks.png', defaultWidth: 580, defaultHeight: 580, isDecal: true },
  { type: 'decal_panel_reinforced_wood', name: 'Reinforced Iron-Wood Panel', category: 'decals', url: '/art/decals/decal-panel-reinforced-wood.png', defaultWidth: 580, defaultHeight: 580, isDecal: true },
  { type: 'decal_panel_iron_grate', name: 'Goblin Heavy Cast Grate', category: 'decals', url: '/art/decals/decal-panel-iron-grate.png', defaultWidth: 520, defaultHeight: 520, isDecal: true },

  // Warcraft RTS Dirt & Grass Seams
  { type: 'decal_wc_grass_patch', name: 'Lush Grass Patch', category: 'decals', url: '/art/decals/decal-wc-grass-patch.png', defaultWidth: 500, defaultHeight: 500, isDecal: true },
  { type: 'decal_wc_grass_seam', name: 'Grass-to-Dirt Seam', category: 'decals', url: '/art/decals/decal-wc-grass-seam.png', defaultWidth: 520, defaultHeight: 520, isDecal: true },
  { type: 'decal_wc_rocky_dirt', name: 'Dirt & Grass Rim', category: 'decals', url: '/art/decals/decal-wc-rocky-dirt.png', defaultWidth: 550, defaultHeight: 550, isDecal: true },
  { type: 'decal_wc_mud_puddle', name: 'Muddy Dirt Puddle', category: 'decals', url: '/art/decals/decal-wc-mud-puddle.png', defaultWidth: 480, defaultHeight: 480, isDecal: true },
  { type: 'decal_wc_flagstone', name: 'Mossy Flagstone Pavers', category: 'decals', url: '/art/decals/decal-wc-flagstone.png', defaultWidth: 500, defaultHeight: 500, isDecal: true },
  { type: 'decal_wc_gravel', name: 'Gravel & River Stones', category: 'decals', url: '/art/decals/decal-wc-gravel.png', defaultWidth: 500, defaultHeight: 500, isDecal: true },
  { type: 'decal_wc_cart_ruts', name: 'Wagon Cart Dirt Ruts', category: 'decals', url: '/art/decals/decal-wc-cart-ruts.png', defaultWidth: 580, defaultHeight: 580, isDecal: true },
  { type: 'decal_grass_fringe', name: 'Grass Fringe Border Strip', category: 'decals', url: '/art/decals/grass-fringe.png', defaultWidth: 600, defaultHeight: 300, isDecal: true },

  // Legacy mappings updated to Blizzard theme
  { type: 'decal_tire_skid', name: 'Timber Planks (Legacy Skid)', category: 'decals', url: '/art/decals/decal-panel-wood-planks.png', defaultWidth: 520, defaultHeight: 520, isDecal: true },
  { type: 'decal_oil_spill', name: 'Dirt Patch (Legacy Oil)', category: 'decals', url: '/art/decals/decal-blizzard-dirt-patch.png', defaultWidth: 440, defaultHeight: 440, isDecal: true },
  { type: 'decal_cracks', name: 'Rock Crag (Legacy Cracks)', category: 'decals', url: '/art/decals/decal-blizzard-rock-crag.png', defaultWidth: 460, defaultHeight: 460, isDecal: true },
  { type: 'decal_pothole', name: 'Gravel Crater (Legacy Pothole)', category: 'decals', url: '/art/decals/decal-blizzard-gravel-earth.png', defaultWidth: 400, defaultHeight: 400, isDecal: true },
  { type: 'decal_hazard_stripes', name: 'Scrap Steel (Legacy Hazard)', category: 'decals', url: '/art/decals/decal-panel-scrap-steel.png', defaultWidth: 620, defaultHeight: 310, isDecal: true },
  { type: 'decal_speed_arrow', name: 'Directional Speed Chevron', category: 'decals', url: '/art/decals/decal-speed-arrow.png', defaultWidth: 380, defaultHeight: 380, isDecal: true },
  { type: 'decal_drain_grate', name: 'Iron Grate (Legacy Drain)', category: 'decals', url: '/art/decals/decal-panel-iron-grate.png', defaultWidth: 360, defaultHeight: 360, isDecal: true },
  { type: 'decal_arch_start', name: 'Start Archway (Decal)', category: 'decals', url: '/art/props/alpha/prop-51-goblin-start-archway.png', defaultWidth: 1400, defaultHeight: 1200, isDecal: true },
  { type: 'decal_arch_banner', name: 'Archway Banner (Decal)', category: 'decals', url: '/art/props/alpha/prop-55-arch-banner-flags.png', defaultWidth: 1000, defaultHeight: 380, isDecal: true },

  // --- LOOSE GOBLINS (WORKING CREW & CHEERING FANS, BATCH 1: 01-10) ---
  { type: 'goblin_01_flag_waver', name: 'Flag-Waving Fan', category: 'goblins', url: '/art/goblins/alpha/goblin-01-flag-waver.png', defaultWidth: 375, defaultHeight: 560 },
  { type: 'goblin_02_war_drummer', name: 'War Drummer', category: 'goblins', url: '/art/goblins/alpha/goblin-02-war-drummer.png', defaultWidth: 312, defaultHeight: 560 },
  { type: 'goblin_03_pit_mechanic', name: 'Pit Mechanic', category: 'goblins', url: '/art/goblins/alpha/goblin-03-pit-mechanic.png', defaultWidth: 375, defaultHeight: 560 },
  { type: 'goblin_04_torchbearer', name: 'Torchbearer Fan', category: 'goblins', url: '/art/goblins/alpha/goblin-04-torchbearer.png', defaultWidth: 375, defaultHeight: 560 },
  { type: 'goblin_05_ore_miner', name: 'Ore Miner', category: 'goblins', url: '/art/goblins/alpha/goblin-05-ore-miner.png', defaultWidth: 312, defaultHeight: 560 },
  { type: 'goblin_06_horn_blower', name: 'War Horn Blower', category: 'goblins', url: '/art/goblins/alpha/goblin-06-horn-blower.png', defaultWidth: 312, defaultHeight: 560 },
  { type: 'goblin_07_tnt_handler', name: 'TNT Handler', category: 'goblins', url: '/art/goblins/alpha/goblin-07-tnt-handler.png', defaultWidth: 375, defaultHeight: 560 },
  { type: 'goblin_08_track_marshal', name: 'Track Marshal', category: 'goblins', url: '/art/goblins/alpha/goblin-08-track-marshal.png', defaultWidth: 312, defaultHeight: 560 },
  { type: 'goblin_09_blacksmith', name: 'Blacksmith', category: 'goblins', url: '/art/goblins/alpha/goblin-09-blacksmith.png', defaultWidth: 375, defaultHeight: 560 },
  { type: 'goblin_10_tankard_celebrant', name: 'Tankard Celebrant', category: 'goblins', url: '/art/goblins/alpha/goblin-10-tankard-celebrant.png', defaultWidth: 312, defaultHeight: 560 },
  { type: 'goblin_11_lantern_warden', name: 'Lantern Warden', category: 'goblins', url: '/art/goblins/alpha/goblin-11-lantern-warden.png', defaultWidth: 375, defaultHeight: 560 },
  { type: 'goblin_12_ball_loader', name: 'Ball Loader', category: 'goblins', url: '/art/goblins/alpha/goblin-12-ball-loader.png', defaultWidth: 375, defaultHeight: 560 },
  { type: 'goblin_13_bell_ringer', name: 'Bell Ringer', category: 'goblins', url: '/art/goblins/alpha/goblin-13-bell-ringer.png', defaultWidth: 312, defaultHeight: 560 },
  { type: 'goblin_14_scarf_fan', name: 'Scarf Fan', category: 'goblins', url: '/art/goblins/alpha/goblin-14-scarf-fan.png', defaultWidth: 375, defaultHeight: 560 },
  { type: 'goblin_15_track_sweeper', name: 'Track Sweeper', category: 'goblins', url: '/art/goblins/alpha/goblin-15-track-sweeper.png', defaultWidth: 375, defaultHeight: 560 },
  { type: 'goblin_16_rope_heave_trio', name: 'Rope-Heave Trio', category: 'goblins', url: '/art/goblins/alpha/goblin-16-rope-heave-trio.png', defaultWidth: 1075, defaultHeight: 600 },
  { type: 'goblin_17_shoulder_ride_duo', name: 'Shoulder-Ride Duo', category: 'goblins', url: '/art/goblins/alpha/goblin-17-shoulder-ride-duo.png', defaultWidth: 312, defaultHeight: 560 },
  { type: 'goblin_18_firework_crew', name: 'Firework Crew', category: 'goblins', url: '/art/goblins/alpha/goblin-18-firework-crew.png', defaultWidth: 1100, defaultHeight: 600 },
  { type: 'goblin_19_tire_carry_duo', name: 'Tire-Carry Duo', category: 'goblins', url: '/art/goblins/alpha/goblin-19-tire-carry-duo.png', defaultWidth: 1075, defaultHeight: 600 },
  { type: 'goblin_20_victory_huddle', name: 'Victory Huddle', category: 'goblins', url: '/art/goblins/alpha/goblin-20-victory-huddle.png', defaultWidth: 1100, defaultHeight: 600 },
  { type: 'goblin_21_grandstand_roar', name: 'Grandstand Roar', category: 'goblins', url: '/art/goblins/alpha/goblin-21-grandstand-roar.png', defaultWidth: 1254, defaultHeight: 700 },
  { type: 'goblin_22_drum_podium_mob', name: 'Drum Podium Mob', category: 'goblins', url: '/art/goblins/alpha/goblin-22-drum-podium-mob.png', defaultWidth: 1254, defaultHeight: 700 },
  { type: 'goblin_23_flag_terrace', name: 'Flag Terrace', category: 'goblins', url: '/art/goblins/alpha/goblin-23-flag-terrace.png', defaultWidth: 1254, defaultHeight: 700 },
  { type: 'goblin_24_torch_crowd', name: 'Torch Crowd', category: 'goblins', url: '/art/goblins/alpha/goblin-24-torch-crowd.png', defaultWidth: 1075, defaultHeight: 600 },
  { type: 'goblin_25_horn_riser', name: 'Horn Riser Band', category: 'goblins', url: '/art/goblins/alpha/goblin-25-horn-riser.png', defaultWidth: 1254, defaultHeight: 700 },
  { type: 'goblin_26_mosh_pit', name: 'Mosh Pit', category: 'goblins', url: '/art/goblins/alpha/goblin-26-mosh-pit.png', defaultWidth: 1075, defaultHeight: 600 },
  { type: 'goblin_27_fence_fans', name: 'Fence Fans', category: 'goblins', url: '/art/goblins/alpha/goblin-27-fence-fans.png', defaultWidth: 1254, defaultHeight: 700 },
  { type: 'goblin_28_cheer_tower', name: 'Cheer Tower', category: 'goblins', url: '/art/goblins/alpha/goblin-28-cheer-tower.png', defaultWidth: 436, defaultHeight: 650 },
  { type: 'goblin_29_victory_stage', name: 'Victory Stage', category: 'goblins', url: '/art/goblins/alpha/goblin-29-victory-stage.png', defaultWidth: 1254, defaultHeight: 700 },
  { type: 'goblin_30_fan_aisle', name: 'Fan Aisle', category: 'goblins', url: '/art/goblins/alpha/goblin-30-fan-aisle.png', defaultWidth: 1075, defaultHeight: 600 },
];

export const DEFAULT_TRACK_PROPS: PlacedProp[] = [
  {
    id: 'prop_start_slingshot',
    type: 'slingshot_3d_launcher',
    name: 'Starting Grid Slingshot (3D)',
    x: 0,
    y: 18000,
    z: -2500,
    rotY: 0,
    scale: 1.2,
    alignToTrack: true,
  },
  {
    id: 'prop_start_lantern_left',
    type: 'prop_01_lantern_post',
    name: 'Triple Lantern Post',
    x: -620,
    y: 18000,
    z: -2100,
    rotY: 0.3,
    scale: 1.1,
    alignToTrack: false,
  },
  {
    id: 'prop_start_lantern_right',
    type: 'prop_01_lantern_post',
    name: 'Triple Lantern Post',
    x: 620,
    y: 18000,
    z: -2100,
    rotY: -0.3,
    scale: 1.1,
    alignToTrack: false,
  },
  {
    id: 'prop_start_goblin_left',
    type: 'goblin_01_flag_waver',
    name: 'Flag-Waving Fan',
    x: -720,
    y: 18000,
    z: -1950,
    rotY: 0.4,
    scale: 1.0,
    alignToTrack: false,
  },
  {
    id: 'prop_start_goblin_right',
    type: 'goblin_02_war_drummer',
    name: 'War Drummer Goblin',
    x: 720,
    y: 18000,
    z: -1950,
    rotY: -0.4,
    scale: 1.0,
    alignToTrack: false,
  },
  {
    id: 'prop_start_flags_left',
    type: 'prop_50_flag_pole_row',
    name: 'Pennant Flag Pole Row',
    x: -700,
    y: 18000,
    z: -1650,
    rotY: 0,
    scale: 1.0,
    alignToTrack: false,
  },
  {
    id: 'prop_start_flags_right',
    type: 'prop_50_flag_pole_row',
    name: 'Pennant Flag Pole Row',
    x: 700,
    y: 18000,
    z: -1650,
    rotY: 0,
    scale: 1.0,
    flipX: true,
    alignToTrack: false,
  },
  {
    id: 'prop_start_archway',
    type: 'prop_51_goblin_start_archway',
    name: 'Grand Goblin Start Archway',
    x: 0,
    y: 18000,
    z: -1400,
    rotY: 0,
    scale: 1.0,
    alignToTrack: false,
  },
  {
    id: 'prop_decal_skid_1',
    type: 'decal_tire_skid',
    name: 'Rough Timber Deck Planks',
    x: 0,
    y: 18002,
    z: -1900,
    rotY: 0,
    scale: 1.2,
    isDecal: true,
    alignToTrack: true,
  },
  {
    id: 'prop_decal_skid_2',
    type: 'decal_tire_skid',
    name: 'Rough Timber Deck Planks',
    x: 0,
    y: 18002,
    z: -700,
    rotY: 0,
    scale: 1.1,
    isDecal: true,
    alignToTrack: true,
  },
  {
    id: 'prop_decal_grass_bandaid_left',
    type: 'decal_wc_grass_patch',
    name: 'Lush Grass Patch (Bandaid)',
    x: -480,
    y: 18002,
    z: -1100,
    rotY: 0.2,
    scale: 1.0,
    isDecal: true,
    alignToTrack: false,
  },
  {
    id: 'prop_decal_grass_bandaid_right',
    type: 'decal_wc_grass_patch',
    name: 'Lush Grass Patch (Bandaid)',
    x: 480,
    y: 18002,
    z: -1100,
    rotY: -0.2,
    scale: 1.0,
    isDecal: true,
    alignToTrack: false,
  },
  {
    id: 'prop_pine_wall_left',
    type: 'pines_cluster',
    name: 'Pine Forest Wall',
    x: -1600,
    y: 18100,
    z: -1400,
    rotY: 0.2,
    scale: 1.3,
    alignToTrack: false,
  },
  {
    id: 'prop_pine_wall_right',
    type: 'pines_cluster',
    name: 'Pine Forest Wall',
    x: 1700,
    y: 18100,
    z: -1400,
    rotY: -0.2,
    scale: 1.3,
    alignToTrack: false,
  },
];

export class TrackBuilder3D {
  private placedProps: PlacedProp[] = [];
  /** T03: last visible rejection of an unsupported gameplay-prop placement. */
  private placementErrorState: string | null = null;
  private propObjects = new Map<string, THREE.Object3D>();
  private selectedPropIds: Set<string> = new Set();
  private activePropType: string | null = null;
  private ghostSprite: THREE.Sprite | null = null;
  private ghostMesh: THREE.Object3D | null = null;
  private selectionBoxes = new Map<string, THREE.BoxHelper>();
  private rotationHandle: THREE.Group | null = null;

  private undoStack: string[] = [];
  private redoStack: string[] = [];

  readonly freeFly = {
    active: false,
    x: 0,
    y: 18200,
    z: -1200,
    yaw: 0,
    pitch: -0.1,
    speed: 1200,
  };

  snapping = {
    alignToTrack: true,
    snapToCenterline: false,
    gridSnap: 0,
    cameraFacingDefault: true,
    decalDefault: false,
    decalLightingDefault: true,
  };

  private readonly textureLoader = new THREE.TextureLoader();
  private readonly textureCache = new Map<string, THREE.Texture>();
  private readonly raycaster = new THREE.Raycaster();
  private readonly mouseNdc = new THREE.Vector2();

  private decalSideHandlesGroup: THREE.Group | null = null;
  private readonly decalSideBoxes = new Map<DecalSide, THREE.Mesh>();

  private backupIntervalTimer: any = null;
  private backupDebounceTimer: any = null;
  private lastBackupTimestamp = 0;
  private backupStatus: 'idle' | 'saving' | 'saved' | 'error' = 'idle';
  private backupStatusListeners: ((info: { status: 'idle' | 'saving' | 'saved' | 'error'; timestamp: number; count: number }) => void)[] = [];
  private courseId = 'ridge';

  private listeners: (() => void)[] = [];
  private currentSkyId = 'ridge';
  private onSkyboxChangeCb?: (skyId: string) => void;

  onSkyboxChange(cb: (skyId: string) => void) {
    this.onSkyboxChangeCb = cb;
  }

  setInitialSky(skyId: string) {
    this.currentSkyId = skyId;
  }

  getSkybox(): string {
    return this.currentSkyId;
  }

  setSkybox(skyId: string) {
    this.currentSkyId = skyId;
    try {
      localStorage.setItem('hm2-3d-track-sky', skyId);
    } catch {
      // Storage unavailable
    }
    this.onSkyboxChangeCb?.(skyId);
    this.notify();
  }

  setCourse(courseId: string) {
    this.courseId = courseId;
  }

  getCourse(): string {
    return this.courseId;
  }

  onBackupStatus(cb: (info: { status: 'idle' | 'saving' | 'saved' | 'error'; timestamp: number; count: number }) => void) {
    this.backupStatusListeners.push(cb);
    cb({
      status: this.backupStatus,
      timestamp: this.lastBackupTimestamp,
      count: this.placedProps.length,
    });
    return () => {
      this.backupStatusListeners = this.backupStatusListeners.filter((l) => l !== cb);
    };
  }

  private notifyBackupStatus(status: 'idle' | 'saving' | 'saved' | 'error') {
    this.backupStatus = status;
    const info = {
      status,
      timestamp: this.lastBackupTimestamp,
      count: this.placedProps.length,
    };
    this.backupStatusListeners.forEach((cb) => {
      try { cb(info); } catch {}
    });
  }

  startPeriodicBackupTimer(intervalMs = 30000) {
    if (this.backupIntervalTimer) {
      clearInterval(this.backupIntervalTimer);
    }
    this.backupIntervalTimer = setInterval(() => {
      if (this.placedProps.length > 0) {
        this.backupToFile(false);
      }
    }, intervalMs);
    if (this.backupIntervalTimer && typeof (this.backupIntervalTimer as any).unref === 'function') {
      (this.backupIntervalTimer as any).unref();
    }
  }

  constructor(
    private readonly scene: THREE.Scene,
    private readonly camera: THREE.PerspectiveCamera,
    private readonly track: TrackData,
    private readonly materials?: any,
  ) {
    this.initDecalSideHandles();
    if (typeof localStorage !== 'undefined') {
      try {
        const savedFacing = localStorage.getItem('hm2-builder-camera-facing-default');
        if (savedFacing !== null) {
          this.snapping.cameraFacingDefault = savedFacing === 'true';
        }
        const savedDecal = localStorage.getItem('hm2-builder-decal-default');
        if (savedDecal !== null) {
          this.snapping.decalDefault = savedDecal === 'true';
        }
        const savedLighting = localStorage.getItem('hm2-builder-decal-lighting-default');
        if (savedLighting !== null) {
          this.snapping.decalLightingDefault = savedLighting === 'true';
        }
      } catch {}
    }
    this.loadFromStorage();
    if (typeof window !== 'undefined') {
      this.startPeriodicBackupTimer(30000);
    }
  }

  setCameraFacingDefault(facing: boolean) {
    this.snapping.cameraFacingDefault = facing;
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem('hm2-builder-camera-facing-default', String(facing));
      } catch {}
    }
    this.updateGhostSprite();
    this.notify();
  }

  setDecalDefault(isDecal: boolean) {
    this.snapping.decalDefault = isDecal;
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem('hm2-builder-decal-default', String(isDecal));
      } catch {}
    }
    this.updateGhostSprite();
    this.notify();
  }

  setDecalLightingDefault(enabled: boolean) {
    this.snapping.decalLightingDefault = enabled;
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem('hm2-builder-decal-lighting-default', String(enabled));
      } catch {}
    }
    this.notify();
  }

  onChange(cb: () => void) {
    this.listeners.push(cb);
  }

  private notify() {
    this.listeners.forEach((cb) => cb());
  }

  get selectedPropId(): string | null {
    if (this.selectedPropIds.size === 0) return null;
    return Array.from(this.selectedPropIds)[0];
  }

  getProps(): readonly PlacedProp[] {
    return this.placedProps;
  }

  /** T03: surface the last physical-placement rejection to the UI (read by TrackBuilderUI). */
  getPlacementError(): string | null {
    return this.placementErrorState;
  }
  clearPlacementError(): void {
    if (this.placementErrorState !== null) {
      this.placementErrorState = null;
      this.notify();
    }
  }
  /**
   * T03 required decision: builder ramps are gameplay props. A ramp only gets
   * elevation when the shared track-space adapter can compile it into a
   * physical surface; otherwise the placement/resize/move is rejected here
   * (visible message) instead of leaving a render-only elevation physics
   * cannot reproduce.
   */
  private validateRampSupport(type: string, vals: { id?: string; x: number; y: number; z: number; scale: number; trackDist?: number }): string | null {
    const def = PROP_DEFINITIONS.find((d) => d.type === type);
    if (!def?.isRamp) return null;
    const verdict = classifyPlacedRamp(getTrackSpace(), {
      id: vals.id, x: vals.x, y: vals.y, z: vals.z, scale: vals.scale, trackDist: vals.trackDist,
    });
    if (verdict.supported) return null;
    return `Ramp not physical here — ${verdict.detail ?? verdict.reason ?? 'unsupported transform'}`;
  }

  getSelectedProp(): PlacedProp | null {
    if (this.selectedPropIds.size === 0) return null;
    const firstId = Array.from(this.selectedPropIds)[0];
    return this.placedProps.find((p) => p.id === firstId) ?? null;
  }

  getSelectedProps(): PlacedProp[] {
    return this.placedProps.filter((p) => this.selectedPropIds.has(p.id));
  }

  getSelectedPropIds(): string[] {
    return Array.from(this.selectedPropIds);
  }

  isPropSelected(id: string): boolean {
    return this.selectedPropIds.has(id);
  }

  getActivePropType(): string | null {
    return this.activePropType;
  }

  setActivePropType(type: string | null) {
    this.activePropType = type;
    this.updateGhostSprite();
    this.notify();
  }

  selectProp(id: string | null, multi = false) {
    if (!id) {
      this.selectedPropIds.clear();
    } else {
      const prop = this.placedProps.find((p) => p.id === id);
      if (!prop) {
        this.selectedPropIds.clear();
      } else if (multi) {
        if (this.selectedPropIds.has(id)) {
          if (prop.groupId) {
            this.placedProps.filter((p) => p.groupId === prop.groupId).forEach((p) => this.selectedPropIds.delete(p.id));
          } else {
            this.selectedPropIds.delete(id);
          }
        } else {
          if (prop.groupId) {
            this.placedProps.filter((p) => p.groupId === prop.groupId).forEach((p) => this.selectedPropIds.add(p.id));
          } else {
            this.selectedPropIds.add(id);
          }
        }
      } else {
        this.selectedPropIds.clear();
        if (prop.groupId) {
          this.placedProps.filter((p) => p.groupId === prop.groupId).forEach((p) => this.selectedPropIds.add(p.id));
        } else {
          this.selectedPropIds.add(id);
        }
      }
    }
    this.updateSelectionBox();
    this.notify();
  }

  selectMultipleProps(ids: string[]) {
    this.selectedPropIds = new Set(ids);
    this.updateSelectionBox();
    this.notify();
  }

  groupSelected(): string | null {
    const selected = this.getSelectedProps();
    if (selected.length < 2) return null;
    this.pushUndo();
    const groupId = `group_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    for (const prop of selected) {
      prop.groupId = groupId;
    }
    this.saveToStorage();
    this.notify();
    return groupId;
  }

  ungroupSelected(): boolean {
    const selected = this.getSelectedProps();
    if (selected.length === 0) return false;
    this.pushUndo();
    for (const prop of selected) {
      delete prop.groupId;
    }
    this.saveToStorage();
    this.notify();
    return true;
  }

  isSelectionGrouped(): boolean {
    const selected = this.getSelectedProps();
    if (selected.length < 2) return false;
    const firstGroup = selected[0].groupId;
    return Boolean(firstGroup && selected.every((p) => p.groupId === firstGroup));
  }

  getGroupCentroid(): { x: number; y: number; z: number } {
    const selected = this.getSelectedProps();
    if (selected.length === 0) return { x: 0, y: 0, z: 0 };
    let sx = 0, sy = 0, sz = 0;
    for (const p of selected) {
      sx += p.x;
      sy += p.y;
      sz += p.z;
    }
    const n = selected.length;
    return {
      x: Math.round(sx / n),
      y: Math.round(sy / n),
      z: Math.round(sz / n),
    };
  }

  moveSelectedProps(dx: number, dy: number, dz: number) {
    const selected = this.getSelectedProps();
    if (selected.length === 0 || (dx === 0 && dy === 0 && dz === 0)) return;
    for (const prop of selected) {
      this.updatePropTransform(prop.id, {
        x: prop.x + dx,
        y: prop.y + dy,
        z: prop.z + dz,
      }, false);
    }
    this.updateSelectionBox();
    this.saveToStorage();
    this.notify();
  }

  rotateSelectedProps(deltaAngle: number) {
    const selected = this.getSelectedProps();
    if (selected.length === 0) return;
    const centroid = this.getGroupCentroid();
    const qOrbit = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), deltaAngle);

    for (const prop of selected) {
      const offset = new THREE.Vector3(prop.x - centroid.x, 0, prop.z - centroid.z);
      offset.applyQuaternion(qOrbit);

      this.updatePropTransform(prop.id, {
        x: Math.round(centroid.x + offset.x),
        z: Math.round(centroid.z + offset.z),
        rotY: prop.rotY + deltaAngle,
      }, false);
    }
    this.updateSelectionBox();
    this.saveToStorage();
    this.notify();
  }

  scaleSelectedProps(multiplier: number) {
    const selected = this.getSelectedProps();
    if (selected.length === 0 || multiplier <= 0) return;
    const centroid = this.getGroupCentroid();
    for (const prop of selected) {
      const newScale = Math.max(0.1, Math.min(6.0, prop.scale * multiplier));
      const ox = prop.x - centroid.x;
      const oz = prop.z - centroid.z;
      const nx = ox * multiplier;
      const nz = oz * multiplier;
      this.updatePropTransform(prop.id, {
        x: Math.round(centroid.x + nx),
        z: Math.round(centroid.z + nz),
        scale: Math.round(newScale * 100) / 100,
      }, false);
    }
    this.updateSelectionBox();
    this.saveToStorage();
    this.notify();
  }

  tiltSelectedProps(deltaRadians: number) {
    const selected = this.getSelectedProps();
    if (selected.length === 0) return;
    for (const prop of selected) {
      this.updatePropTransform(prop.id, { rotZ: (prop.rotZ ?? 0) + deltaRadians }, false);
    }
    this.updateSelectionBox();
    this.saveToStorage();
    this.notify();
  }

  flipSelectedProps() {
    const selected = this.getSelectedProps();
    if (selected.length === 0) return;
    const centroid = this.getGroupCentroid();
    for (const prop of selected) {
      const ox = prop.x - centroid.x;
      this.updatePropTransform(prop.id, {
        x: Math.round(centroid.x - ox),
        flipX: !prop.flipX,
      }, false);
    }
    this.updateSelectionBox();
    this.saveToStorage();
    this.notify();
  }

  setSelectedPropsLighting(lit: boolean) {
    const selected = this.getSelectedProps();
    if (selected.length === 0) return;
    this.pushUndo();
    for (const prop of selected) {
      this.updatePropTransform(prop.id, { lit }, false);
    }
    this.saveToStorage();
    this.notify();
  }

  getPropTrackSection(prop: PlacedProp): 'alpine' | 'canyon' | 'cavern' | 'stadium' {
    if (this.track?.samples && this.track.samples.length > 0) {
      let minDist = Infinity;
      let stage = 'alpine';
      const step = Math.max(1, Math.floor(this.track.samples.length / 500));
      for (let i = 0; i < this.track.samples.length; i += step) {
        const s = this.track.samples[i];
        const dx = s.pos.x - prop.x;
        const dy = s.pos.y - prop.y;
        const dz = s.pos.z - prop.z;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < minDist) {
          minDist = d2;
          stage = s.stage;
        }
      }
      if (stage === 'alpine') return 'alpine';
      if (stage === 'canyon' || stage === 'zigzag') return 'canyon';
      if (stage === 'cavern' || stage === 'mine') return 'cavern';
      if (stage === 'breakthrough' || stage === 'stadium') return 'stadium';
      return 'alpine';
    }
    if (prop.x < 25600) return 'alpine';
    if (prop.x < 48000) return 'canyon';
    if (prop.x < 68400) return 'cavern';
    return 'stadium';
  }

  setAllDecalsLighting(lit: boolean, filterSection: 'all' | 'alpine' | 'canyon' | 'cavern' | 'stadium' = 'all'): number {
    this.pushUndo();
    let count = 0;
    for (const prop of this.placedProps) {
      if (!this.isPropDecal(prop)) continue;
      if (filterSection !== 'all') {
        const sec = this.getPropTrackSection(prop);
        if (sec !== filterSection) continue;
      }
      this.updatePropTransform(prop.id, { lit }, false);
      count++;
    }
    this.saveToStorage();
    this.notify();
    return count;
  }

  // --- FREE FLY CAMERA UPDATE ---
  updateFlyCamera(dt: number, keys: Set<string>) {
    if (!this.freeFly.active) return;

    const speed = this.freeFly.speed * (keys.has('ShiftLeft') || keys.has('ShiftRight') ? 3.0 : 1.0);
    const move = new THREE.Vector3();

    // Horizontal direction vectors from yaw
    const forward = new THREE.Vector3(Math.sin(this.freeFly.yaw), 0, Math.cos(this.freeFly.yaw));
    const right = new THREE.Vector3(-Math.cos(this.freeFly.yaw), 0, Math.sin(this.freeFly.yaw));

    if (keys.has('KeyW')) move.add(forward);
    if (keys.has('KeyS')) move.sub(forward);
    if (keys.has('KeyD')) move.add(right);
    if (keys.has('KeyA')) move.sub(right);
    if (keys.has('Space')) move.y += 1;
    if ((keys.has('KeyZ') || keys.has('KeyQ')) && !keys.has('ControlLeft') && !keys.has('ControlRight') && !keys.has('MetaLeft') && !keys.has('MetaRight')) {
      move.y -= 1;
    }

    if (move.lengthSq() > 0) {
      move.normalize().multiplyScalar(speed * dt);
      this.freeFly.x += move.x;
      this.freeFly.y += move.y;
      this.freeFly.z += move.z;
    }

    // Apply to Three.js camera
    this.camera.position.set(this.freeFly.x, this.freeFly.y, this.freeFly.z);
    const lookDir = new THREE.Vector3(
      Math.sin(this.freeFly.yaw) * Math.cos(this.freeFly.pitch),
      Math.sin(this.freeFly.pitch),
      Math.cos(this.freeFly.yaw) * Math.cos(this.freeFly.pitch),
    );
    this.camera.lookAt(this.camera.position.clone().add(lookDir));
  }

  rotateCamera(deltaX: number, deltaY: number) {
    if (!this.freeFly.active) return;
    this.freeFly.yaw -= deltaX * 0.003;
    this.freeFly.pitch = Math.max(-1.45, Math.min(1.45, this.freeFly.pitch - deltaY * 0.003));

    const lookDir = new THREE.Vector3(
      Math.sin(this.freeFly.yaw) * Math.cos(this.freeFly.pitch),
      Math.sin(this.freeFly.pitch),
      Math.cos(this.freeFly.yaw) * Math.cos(this.freeFly.pitch),
    );
    this.camera.lookAt(this.camera.position.clone().add(lookDir));
  }

  jumpToStage(stageName: string) {
    const s = this.track.samples.find((sample) => sample.stage === stageName);
    if (s) {
      this.freeFly.x = s.pos.x - s.tangent.x * 600;
      this.freeFly.y = s.pos.y + 450;
      this.freeFly.z = s.pos.z - s.tangent.z * 600;
      this.freeFly.yaw = Math.atan2(s.tangent.x, s.tangent.z);
      this.freeFly.pitch = -0.15;
    }
  }

  // --- RAYCASTING & SURFACE SNAPPING ---
  // --- RAYCASTING & SURFACE SNAPPING ---
  raycastProp(clientX: number, clientY: number, canvas: HTMLCanvasElement): PlacedProp | null {
    if (this.placedProps.length === 0) return null;

    const rect = canvas.getBoundingClientRect();
    this.mouseNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.mouseNdc.y = -(((clientY - rect.top) / rect.height) * 2 - 1);

    this.raycaster.setFromCamera(this.mouseNdc, this.camera);
    const objects = Array.from(this.propObjects.values());
    const hits = this.raycaster.intersectObjects(objects, true);

    if (hits.length > 0) {
      let hitObj: THREE.Object3D | null = hits[0].object;
      while (hitObj && !hitObj.userData?.propId) {
        hitObj = hitObj.parent;
      }
      if (hitObj?.userData?.propId) {
        const found = this.placedProps.find((p) => p.id === hitObj!.userData.propId);
        if (found) return found;
      }
    }

    // Screen-space proximity fallback:
    let bestProp: PlacedProp | null = null;
    let bestDistanceSq = Infinity;

    for (const prop of this.placedProps) {
      const def = PROP_DEFINITIONS.find((p) => p.type === prop.type);
      if (!def) continue;

      const w = def.defaultWidth * prop.scale;
      const h = def.defaultHeight * prop.scale;

      const centerY = def.alignBottom !== false ? prop.y + h / 2 : prop.y;
      const worldPos = new THREE.Vector3(prop.x, centerY, prop.z);

      // Check if in front of camera
      const cameraDir = this.camera.getWorldDirection(new THREE.Vector3());
      const toProp = worldPos.clone().sub(this.camera.position);
      if (cameraDir.dot(toProp) <= 0) continue;

      const ndc = worldPos.clone().project(this.camera);
      if (ndc.z > 1 || ndc.z < -1) continue;

      const screenX = ((ndc.x + 1) / 2) * rect.width + rect.left;
      const screenY = ((-ndc.y + 1) / 2) * rect.height + rect.top;

      const dist = toProp.length();
      const vFovRad = (this.camera.fov * Math.PI) / 180;
      const screenH = (h / (2 * Math.tan(vFovRad / 2) * Math.max(10, dist))) * rect.height;
      const screenW = (w / (2 * Math.tan(vFovRad / 2) * Math.max(10, dist))) * rect.height;

      const halfW = Math.max(30, screenW / 2);
      const halfH = Math.max(30, screenH / 2);

      if (
        clientX >= screenX - halfW - 20 &&
        clientX <= screenX + halfW + 20 &&
        clientY >= screenY - halfH - 20 &&
        clientY <= screenY + halfH + 20
      ) {
        const d2 = (clientX - screenX) ** 2 + (clientY - screenY) ** 2;
        if (d2 < bestDistanceSq) {
          bestDistanceSq = d2;
          bestProp = prop;
        }
      }
    }

    return bestProp;
  }

  raycastSurface(clientX: number, clientY: number, canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect();
    this.mouseNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.mouseNdc.y = -(((clientY - rect.top) / rect.height) * 2 - 1);

    this.raycaster.setFromCamera(this.mouseNdc, this.camera);
    const intersects = this.raycaster.intersectObjects(this.scene.children, true);

    for (const hit of intersects) {
      const obj = hit.object;
      // Skip sky, markers, gizmos, ghosts, sprites, placed props, and handles
      if (
        obj.name === 'Sky' ||
        obj.name === 'Ghost' ||
        obj.name === 'GhostMesh' ||
        obj.name === 'GhostDecalMesh' ||
        obj.name === 'GhostSlingshotMesh' ||
        (obj as any).isSprite ||
        obj.name === 'DebugMarkers' ||
        obj.name?.startsWith('PlacedProp_') ||
        obj.name?.startsWith('DecalSide') ||
        obj.name?.startsWith('DecalHandle') ||
        obj.name === 'RotationHandleGroup' ||
        obj.name === 'DecalSideHandlesGroup'
      ) continue;

      // Find closest track sample
      let closestSample: TrackSample | undefined;
      let minD = Infinity;
      for (let i = 0; i < this.track.samples.length; i += 4) {
        const s = this.track.samples[i];
        const dist = s.pos.distanceTo(hit.point);
        if (dist < minD) {
          minD = dist;
          closestSample = s;
        }
      }

      return {
        point: hit.point,
        normal: hit.face ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld).normalize() : new THREE.Vector3(0, 1, 0),
        sample: minD < 1800 ? closestSample : undefined,
      };
    }

    return null;
  }

  // --- GHOST PREVIEW ---
  updateGhostPosition(clientX: number, clientY: number, canvas: HTMLCanvasElement) {
    if (!this.activePropType) return;

    const hit = this.raycastSurface(clientX, clientY, canvas);
    if (!hit) {
      if (this.ghostSprite) this.ghostSprite.visible = false;
      if (this.ghostMesh) this.ghostMesh.visible = false;
      return;
    }

    let pos = hit.point.clone();
    if (this.snapping.snapToCenterline && hit.sample) {
      pos.copy(hit.sample.pos);
    }

    if (this.ghostMesh && this.ghostMesh.visible) {
      this.ghostMesh.position.copy(pos);
      if ((this.ghostMesh as any)._isDecalMesh) {
        this.ghostMesh.position.y += 2;
        let rotY: number;
        if (this.snapping.alignToTrack && hit.sample) {
          rotY = Math.atan2(hit.sample.tangent.x, hit.sample.tangent.z);
        } else {
          let dx = this.camera.position.x - pos.x;
          let dz = this.camera.position.z - pos.z;
          if (Math.hypot(dx, dz) < 1e-2) {
            dx = -Math.sin(this.freeFly.yaw);
            dz = -Math.cos(this.freeFly.yaw);
          }
          rotY = Math.atan2(dx, dz);
        }
        if (hit.normal) {
          const F_horiz = new THREE.Vector3(Math.sin(-rotY), 0, Math.cos(-rotY)).normalize();
          const F_surface = F_horiz.clone().sub(hit.normal.clone().multiplyScalar(F_horiz.dot(hit.normal))).normalize();
          const R_surface = new THREE.Vector3().crossVectors(F_surface, hit.normal).normalize();
          const mBasis = new THREE.Matrix4().makeBasis(R_surface, F_surface, hit.normal);
          this.ghostMesh.quaternion.setFromRotationMatrix(mBasis);
        } else {
          this.ghostMesh.rotation.order = 'YXZ';
          this.ghostMesh.rotation.x = -Math.PI / 2;
          this.ghostMesh.rotation.y = -rotY;
          this.ghostMesh.rotation.z = 0;
        }
      } else if (this.snapping.alignToTrack && hit.sample) {
        this.ghostMesh.rotation.y = Math.atan2(hit.sample.tangent.x, hit.sample.tangent.z);
      } else {
        let dx = this.camera.position.x - pos.x;
        let dz = this.camera.position.z - pos.z;
        if (Math.hypot(dx, dz) < 1e-2) {
          dx = -Math.sin(this.freeFly.yaw);
          dz = -Math.cos(this.freeFly.yaw);
        }
        this.ghostMesh.rotation.y = Math.atan2(dx, dz);
      }
    } else if (this.ghostSprite && this.ghostSprite.visible) {
      this.ghostSprite.position.copy(pos);
    }
  }

  private updateGhostSprite() {
    if (!this.activePropType) {
      if (this.ghostSprite) this.ghostSprite.visible = false;
      if (this.ghostMesh) this.ghostMesh.visible = false;
      return;
    }

    const def = PROP_DEFINITIONS.find((p) => p.type === this.activePropType);
    if (!def) return;

    const isDecal = def.isDecal || this.snapping.decalDefault;

    if (isDecal) {
      if (this.ghostSprite) this.ghostSprite.visible = false;
      const tex = this.getTexture(def.url);
      if (!this.ghostMesh || (this.ghostMesh as any)._forType !== def.type || (this.ghostMesh as any)._isDecalMesh !== true) {
        if (this.ghostMesh) this.scene.remove(this.ghostMesh);
        const geom = new THREE.PlaneGeometry(def.defaultWidth, def.defaultHeight);
        const mat = new THREE.MeshBasicMaterial({
          map: tex,
          transparent: true,
          opacity: 0.65,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        this.ghostMesh = new THREE.Mesh(geom, mat);
        (this.ghostMesh as any)._forType = def.type;
        (this.ghostMesh as any)._isDecalMesh = true;
        this.ghostMesh.name = 'GhostDecalMesh';
        this.scene.add(this.ghostMesh);
      }
      this.ghostMesh.visible = true;
    } else if (def.isRamp) {
      if (this.ghostSprite) this.ghostSprite.visible = false;
      if (!this.ghostMesh || (this.ghostMesh as any)._isRampMesh !== true) {
        if (this.ghostMesh) this.scene.remove(this.ghostMesh);
        const ghostMat = new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0.5, wireframe: true });
        this.ghostMesh = wedgeMesh(def.defaultWidth, 1100, def.defaultHeight, ghostMat);
        this.ghostMesh.name = 'GhostMesh';
        (this.ghostMesh as any)._isRampMesh = true;
        this.scene.add(this.ghostMesh);
      }
      this.ghostMesh.visible = true;
    } else if (def.isSlingshot || def.is3DModel) {
      if (this.ghostSprite) this.ghostSprite.visible = false;
      if (!this.ghostMesh || (this.ghostMesh as any)._forType !== def.type) {
        if (this.ghostMesh) this.scene.remove(this.ghostMesh);
        const ghostModel = createSlingshotMesh(1, this.materials);
        ghostModel.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.material = new THREE.MeshBasicMaterial({
              color: 0xffaa00,
              wireframe: true,
              transparent: true,
              opacity: 0.45,
            });
          }
        });
        ghostModel.name = 'GhostSlingshotMesh';
        (ghostModel as any)._forType = def.type;
        (ghostModel as any)._is3DModel = true;
        this.ghostMesh = ghostModel;
        this.scene.add(ghostModel);
      }
      if (this.ghostMesh) {
        this.ghostMesh.visible = true;
      }
    } else if (this.snapping.cameraFacingDefault === false) {
      if (this.ghostSprite) this.ghostSprite.visible = false;
      const tex = this.getTexture(def.url);
      if (!this.ghostMesh || (this.ghostMesh as any)._forType !== def.type || (this.ghostMesh as any)._isRampMesh === true) {
        if (this.ghostMesh) this.scene.remove(this.ghostMesh);
        const geom = new THREE.PlaneGeometry(def.defaultWidth, def.defaultHeight);
        if (def.alignBottom !== false) {
          geom.translate(0, def.defaultHeight / 2, 0);
        }
        const mat = new THREE.MeshBasicMaterial({
          map: tex,
          transparent: true,
          opacity: 0.55,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        this.ghostMesh = new THREE.Mesh(geom, mat);
        (this.ghostMesh as any)._forType = def.type;
        this.ghostMesh.name = 'GhostMesh';
        this.scene.add(this.ghostMesh);
      }
      this.ghostMesh.visible = true;
    } else {
      if (this.ghostMesh) this.ghostMesh.visible = false;
      const tex = this.getTexture(def.url);
      if (!this.ghostSprite) {
        const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.55, depthWrite: false });
        this.ghostSprite = new THREE.Sprite(mat);
        this.ghostSprite.name = 'Ghost';
        this.scene.add(this.ghostSprite);
      } else {
        this.ghostSprite.material.map = tex;
        this.ghostSprite.material.needsUpdate = true;
      }
      this.ghostSprite.center.set(0.5, def.alignBottom !== false ? 0 : 0.5);
      this.ghostSprite.scale.set(def.defaultWidth, def.defaultHeight, 1);
      this.ghostSprite.visible = true;
    }
  }

  // --- PROP CREATION, MANIPULATION & SELECTION ---
  placeActiveProp(clientX: number, clientY: number, canvas: HTMLCanvasElement): PlacedProp | null {
    if (!this.activePropType) return null;
    const def = PROP_DEFINITIONS.find((p) => p.type === this.activePropType);
    if (!def) return null;

    const hit = this.raycastSurface(clientX, clientY, canvas);
    if (!hit) return null;

    // T03: gameplay props in unsupported regions must not be placed.
    const rampRejection = this.validateRampSupport(def.type, {
      x: hit.point.x, y: hit.point.y, z: hit.point.z, scale: 1, trackDist: hit.sample?.dist,
    });
    if (rampRejection) {
      this.placementErrorState = rampRejection;
      this.notify();
      return null;
    }

    this.pushUndo();

    let pos = hit.point.clone();
    let rotY = 0;
    if (this.snapping.alignToTrack && hit.sample) {
      rotY = Math.atan2(hit.sample.tangent.x, hit.sample.tangent.z);
    } else {
      let dx = this.camera.position.x - pos.x;
      let dz = this.camera.position.z - pos.z;
      if (Math.hypot(dx, dz) < 1e-2) {
        dx = -Math.sin(this.freeFly.yaw);
        dz = -Math.cos(this.freeFly.yaw);
      }
      rotY = Math.atan2(dx, dz);
    }

    const isPhysical3D = Boolean(def.isRamp || def.isSlingshot || def.is3DModel);
    const isDecal = isPhysical3D ? false : Boolean(def.isDecal || this.snapping.decalDefault);

    let quaternion: [number, number, number, number] | undefined;
    let rotX = 0;
    let rotZ = 0;

    if (isDecal && hit.normal) {
      const F_horiz = new THREE.Vector3(Math.sin(-rotY), 0, Math.cos(-rotY)).normalize();
      const F_surface = F_horiz.clone().sub(hit.normal.clone().multiplyScalar(F_horiz.dot(hit.normal))).normalize();
      const R_surface = new THREE.Vector3().crossVectors(F_surface, hit.normal).normalize();
      const mBasis = new THREE.Matrix4().makeBasis(R_surface, F_surface, hit.normal);
      const q = new THREE.Quaternion().setFromRotationMatrix(mBasis);
      quaternion = [q.x, q.y, q.z, q.w];
      rotX = Math.asin(F_surface.y);
      rotZ = Math.asin(R_surface.y);
    }

    const prop: PlacedProp = {
      id: `prop_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type: def.type,
      name: def.name,
      x: Math.round(pos.x),
      y: Math.round(pos.y),
      z: Math.round(pos.z),
      rotY,
      rotX,
      rotZ,
      quaternion,
      scale: 1,
      alignToTrack: this.snapping.alignToTrack,
      trackDist: hit.sample ? Math.round(hit.sample.dist) : undefined,
      cameraFacing: (isPhysical3D || isDecal) ? false : this.snapping.cameraFacingDefault,
      flipX: false,
      isDecal: isPhysical3D ? false : isDecal,
      lit: isDecal ? this.snapping.decalLightingDefault : undefined,
    };

    this.placedProps.push(prop);
    this.createPropSprite(prop);
    this.selectProp(prop.id);
    this.saveToStorage();
    this.notify();
    return prop;
  }

  duplicateSelected(): PlacedProp[] {
    const selected = this.getSelectedProps();
    if (selected.length === 0) return [];

    this.pushUndo();
    const newGroupId = selected.length > 1 ? `group_${Date.now()}_${Math.random().toString(36).slice(2, 6)}` : undefined;
    const duplicated: PlacedProp[] = [];
    const newIds: string[] = [];

    for (const prop of selected) {
      const newId = `prop_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const dup: PlacedProp = {
        ...prop,
        id: newId,
        x: prop.x + 120,
        z: prop.z + 120,
        groupId: newGroupId || (prop.groupId ? `group_${Date.now()}_${Math.random().toString(36).slice(2, 6)}` : undefined),
      };
      this.placedProps.push(dup);
      this.createPropSprite(dup);
      duplicated.push(dup);
      newIds.push(newId);
    }

    this.selectMultipleProps(newIds);
    this.saveToStorage();
    this.notify();
    return duplicated;
  }

  deleteSelected() {
    const selected = this.getSelectedProps();
    if (selected.length === 0) return;
    this.pushUndo();
    for (const prop of selected) {
      const idx = this.placedProps.findIndex((p) => p.id === prop.id);
      if (idx >= 0) {
        const obj = this.propObjects.get(prop.id);
        if (obj) {
          this.scene.remove(obj);
          this.propObjects.delete(prop.id);
        }
        const box = this.selectionBoxes.get(prop.id);
        if (box) {
          this.scene.remove(box);
          this.selectionBoxes.delete(prop.id);
        }
        this.placedProps.splice(idx, 1);
      }
    }
    this.selectedPropIds.clear();
    this.updateSelectionBox();
    this.saveToStorage();
    this.notify();
  }

  deleteProp(id: string) {
    this.pushUndo();

    const idx = this.placedProps.findIndex((p) => p.id === id);
    if (idx >= 0) {
      const prop = this.placedProps[idx];
      const obj = this.propObjects.get(prop.id);
      if (obj) {
        this.scene.remove(obj);
        this.propObjects.delete(prop.id);
      }
      const box = this.selectionBoxes.get(prop.id);
      if (box) {
        this.scene.remove(box);
        this.selectionBoxes.delete(prop.id);
      }
      this.placedProps.splice(idx, 1);
    }

    this.selectedPropIds.delete(id);
    this.updateSelectionBox();
    this.saveToStorage();
    this.notify();
  }

  focusProp(id: string) {
    const prop = this.placedProps.find((p) => p.id === id);
    if (!prop) return;

    this.selectProp(id);

    const def = PROP_DEFINITIONS.find((p) => p.type === prop.type);
    const h = (def?.defaultHeight ?? 600) * prop.scale;

    const viewDist = Math.max(900, h * 1.5);
    this.freeFly.x = prop.x;
    this.freeFly.y = prop.y + h * 0.5 + 200;
    this.freeFly.z = prop.z - viewDist;
    this.freeFly.yaw = 0;
    this.freeFly.pitch = -0.15;

    this.camera.position.set(this.freeFly.x, this.freeFly.y, this.freeFly.z);
    this.camera.lookAt(prop.x, prop.y + h * 0.4, prop.z);
    this.notify();
  }

  updatePropTransform(id: string, updates: Partial<PlacedProp>, autoSync = true) {
    const prop = this.placedProps.find((p) => p.id === id);
    if (!prop) return;

    const def = PROP_DEFINITIONS.find((p) => p.type === prop.type);

    // T03: keep ramps inside the physically representable region — reject
    // (and revert) transforms that would orphan their elevation.
    if (def?.isRamp) {
      const touchesGeometry = ['x', 'y', 'z', 'scale', 'trackDist'].some((k) => updates[k as keyof PlacedProp] !== undefined);
      if (touchesGeometry) {
        const candidate = { ...prop, ...updates };
        const rampRejection = this.validateRampSupport(prop.type, {
          id: prop.id, x: candidate.x, y: candidate.y, z: candidate.z, scale: candidate.scale, trackDist: candidate.trackDist,
        });
        if (rampRejection) {
          this.placementErrorState = rampRejection;
          this.notify();
          return;
        }
      }
    }
    const isPhysical3D = Boolean(def?.isRamp || def?.isSlingshot || def?.is3DModel);
    const oldCameraFacing = prop.cameraFacing !== false;
    const oldIsDecal = isPhysical3D ? false : (prop.isDecal !== undefined ? prop.isDecal : (def?.isDecal ?? false));
    const oldLit = prop.lit !== false;

    const willBeDecal = isPhysical3D ? false : (updates.isDecal !== undefined ? updates.isDecal : oldIsDecal);

    // Decal rotation handling:
    // When rotY is updated on a decal without an explicit quaternion update,
    // spin the decal in-place around its local surface normal (0, 0, 1) by deltaYaw,
    // and recalculate rotX (pitch) and rotZ (roll) so all transform parameters remain in sync.
    if (willBeDecal && updates.rotY !== undefined && updates.quaternion === undefined) {
      let deltaYaw = updates.rotY - (prop.rotY ?? 0);
      while (deltaYaw > Math.PI) deltaYaw -= 2 * Math.PI;
      while (deltaYaw < -Math.PI) deltaYaw += 2 * Math.PI;

      if (Math.abs(deltaYaw) > 0.0001) {
        let q: THREE.Quaternion;
        if (prop.quaternion) {
          q = new THREE.Quaternion(...prop.quaternion);
        } else {
          const qFlat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
          const qYaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -(prop.rotY ?? 0));
          const qPitch = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), prop.rotX ?? 0);
          const qRoll = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), prop.rotZ ?? 0);
          q = qFlat.multiply(qYaw).multiply(qPitch).multiply(qRoll);
        }

        const qSpin = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), deltaYaw);
        q.multiply(qSpin).normalize();
        updates.quaternion = [q.x, q.y, q.z, q.w];

        const F = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
        const R = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
        updates.rotX = Math.asin(Math.max(-1, Math.min(1, F.y)));
        updates.rotZ = Math.asin(Math.max(-1, Math.min(1, R.y)));
      }
    } else if (willBeDecal && updates.rotZ !== undefined && updates.rotY === undefined && updates.quaternion === undefined && prop.quaternion) {
      // If rotZ is adjusted on a decal without rotY, apply roll tilt around decal local Y
      const deltaRoll = updates.rotZ - (prop.rotZ ?? 0);
      if (Math.abs(deltaRoll) > 0.0001) {
        const q = new THREE.Quaternion(...prop.quaternion);
        const qTilt = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), deltaRoll);
        q.multiply(qTilt).normalize();
        updates.quaternion = [q.x, q.y, q.z, q.w];
      }
    }

    if (updates.rotY !== undefined) {
      let normalizedRotY = updates.rotY;
      while (normalizedRotY > Math.PI) normalizedRotY -= 2 * Math.PI;
      while (normalizedRotY < -Math.PI) normalizedRotY += 2 * Math.PI;
      updates.rotY = normalizedRotY;
    }

    // When switching from billboard (cameraFacing: true) to fixed 3D (cameraFacing: false),
    // orient the prop to face the current camera angle so it doesn't snap to an arbitrary heading
    if (updates.cameraFacing === false && oldCameraFacing === true && updates.rotY === undefined && !oldIsDecal) {
      let dx = this.camera.position.x - prop.x;
      let dz = this.camera.position.z - prop.z;
      if (Math.hypot(dx, dz) < 1e-2) {
        dx = -Math.sin(this.freeFly.yaw);
        dz = -Math.cos(this.freeFly.yaw);
      }
      updates.rotY = Math.atan2(dx, dz);
    }

    Object.assign(prop, updates);
    if (isPhysical3D) {
      prop.isDecal = false;
    }

    const newCameraFacing = prop.cameraFacing !== false;
    const newIsDecal = isPhysical3D ? false : (prop.isDecal !== undefined ? prop.isDecal : (def?.isDecal ?? false));
    const newLit = prop.lit !== false;

    // If cameraFacing, isDecal, or lit changed, recreate the 3D object
    if (oldCameraFacing !== newCameraFacing || oldIsDecal !== newIsDecal || (updates.lit !== undefined && oldLit !== newLit)) {
      const oldObj = this.propObjects.get(id);
      if (oldObj) {
        this.scene.remove(oldObj);
        this.propObjects.delete(id);
      }
      this.createPropSprite(prop);
    } else {
      const obj = this.propObjects.get(id);
      if (obj) {
        obj.position.set(prop.x, prop.y, prop.z);
        const flip = prop.flipX ? -1 : 1;
        if (def) {
          if (def.isRamp) {
            obj.rotation.y = prop.rotY;
            obj.rotation.z = prop.rotZ ?? 0;
            obj.scale.set(prop.scale * flip, prop.scale, prop.scale);
          } else if (def.isSlingshot || def.is3DModel) {
            obj.rotation.y = prop.rotY;
            obj.rotation.z = prop.rotZ ?? 0;
            obj.scale.set(prop.scale * flip, prop.scale, prop.scale);
          } else if (newIsDecal || (obj as any).userData?.isDecal) {
            this.applyDecalTransform(obj, prop, def);
          } else if (prop.cameraFacing === false) {
            obj.rotation.y = prop.rotY;
            obj.rotation.z = prop.rotZ ?? 0;
            obj.scale.set(prop.scale * flip, prop.scale, prop.scale);
          } else {
            // Sprite
            if (obj instanceof THREE.Sprite) {
              obj.material.rotation = prop.rotZ ?? 0;
              obj.scale.set(def.defaultWidth * prop.scale * flip, def.defaultHeight * prop.scale, 1);
            }
          }
        }
      }
    }
    if (autoSync) {
      this.updateSelectionBox();
      this.saveToStorage();
      this.notify();
    }
  }

  isPropDecal(prop: PlacedProp): boolean {
    const def = PROP_DEFINITIONS.find((d) => d.type === prop.type);
    if (def?.isRamp || def?.isSlingshot || def?.is3DModel) return false;
    if (prop.isDecal !== undefined) return prop.isDecal;
    return def?.isDecal ?? false;
  }

  private applyDecalTransform(obj: THREE.Object3D, prop: PlacedProp, _def?: PropDefinition) {
    const flip = prop.flipX ? -1 : 1;
    obj.position.set(prop.x, prop.y + 2, prop.z);
    obj.scale.set(prop.scale * flip, prop.scale, prop.scale);

    if (prop.quaternion) {
      obj.quaternion.set(prop.quaternion[0], prop.quaternion[1], prop.quaternion[2], prop.quaternion[3]);
    } else {
      const qFlat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
      const qYaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -prop.rotY);
      const qPitch = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), prop.rotX ?? 0);
      const qRoll = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), prop.rotZ ?? 0);
      obj.quaternion.copy(qFlat).multiply(qYaw).multiply(qPitch).multiply(qRoll);
    }
  }

  private initDecalSideHandles() {
    this.decalSideHandlesGroup = new THREE.Group();
    this.decalSideHandlesGroup.name = 'DecalSideHandlesGroup';
    this.decalSideHandlesGroup.visible = false;

    const boxGeo = new THREE.BoxGeometry(34, 34, 34);
    const boxMat = new THREE.MeshStandardMaterial({
      color: 0xffea00,
      emissive: 0x665500,
      roughness: 0.35,
      metalness: 0.1,
      depthTest: false,
    });

    const sides: DecalSide[] = ['front', 'back', 'left', 'right'];
    for (const side of sides) {
      const handleGroup = new THREE.Group();
      handleGroup.name = `DecalHandle_${side}`;

      const mesh = new THREE.Mesh(boxGeo, boxMat.clone());
      mesh.name = `DecalSideBox_${side}`;
      mesh.userData = { isDecalSideHandle: true, side };
      mesh.renderOrder = 10002;

      // High-contrast black outline
      const edges = new THREE.EdgesGeometry(boxGeo);
      const lineMat = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2, depthTest: false });
      const wireframe = new THREE.LineSegments(edges, lineMat);
      wireframe.renderOrder = 10003;
      mesh.add(wireframe);

      handleGroup.add(mesh);
      this.decalSideHandlesGroup.add(handleGroup);
      this.decalSideBoxes.set(side, mesh);
    }

    this.scene.add(this.decalSideHandlesGroup);
  }

  getPlacedRamps(): readonly PlacedProp[] {
    return this.placedProps.filter((p) => {
      const def = PROP_DEFINITIONS.find((d) => d.type === p.type);
      return def?.isRamp || p.type === 'timber_ramp' || p.type === 'rock_springboard' || p.type === 'springboard';
    });
  }

  // --- SELECTION BOX HIGHLIGHT & ROTATION HANDLE ---
  private updateSelectionBox() {
    const selected = this.getSelectedProps();
    if (selected.length === 0 || !this.freeFly.active) {
      this.selectionBoxes.forEach((box) => { box.visible = false; });
      if (this.rotationHandle) this.rotationHandle.visible = false;
      if (this.decalSideHandlesGroup) this.decalSideHandlesGroup.visible = false;
      return;
    }

    const currentSelectedIds = new Set(selected.map((p) => p.id));

    // Hide boxes for unselected props
    for (const [id, box] of this.selectionBoxes.entries()) {
      if (!currentSelectedIds.has(id)) {
        box.visible = false;
      }
    }

    const isGroup = selected.length > 1;
    const boxColor = isGroup ? 0x38bdf8 : 0xffdd00;

    // Create or update box helpers for each selected prop
    for (const prop of selected) {
      const obj = this.propObjects.get(prop.id);
      if (!obj) continue;
      let box = this.selectionBoxes.get(prop.id);
      if (!box) {
        box = new THREE.BoxHelper(obj, boxColor);
        (box.material as THREE.LineBasicMaterial).depthTest = false;
        (box.material as THREE.LineBasicMaterial).transparent = true;
        (box.material as THREE.LineBasicMaterial).opacity = 0.95;
        box.renderOrder = 9999;
        this.scene.add(box);
        this.selectionBoxes.set(prop.id, box);
      } else {
        box.setFromObject(obj);
        (box.material as THREE.LineBasicMaterial).color.setHex(boxColor);
        box.visible = true;
      }
    }

    // Centroid of selected group
    const centroid = this.getGroupCentroid();
    const allDecals = selected.every((p) => this.isPropDecal(p));
    let maxHandleY = allDecals ? centroid.y + 35 : centroid.y + 120;
    for (const prop of selected) {
      const def = PROP_DEFINITIONS.find((p) => p.type === prop.type);
      const h = (def?.defaultHeight ?? 500) * prop.scale;
      const isDecal = this.isPropDecal(prop);
      const hy = prop.y + (isDecal ? 35 : (def?.isSlingshot ? 440 * prop.scale : h + 70));
      if (hy > maxHandleY) maxHandleY = hy;
    }

    if (!this.rotationHandle) {
      this.rotationHandle = new THREE.Group();
      this.rotationHandle.name = 'RotationHandleGroup';

      // Stem line
      const stemGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 45, 0),
      ]);
      const stemMat = new THREE.LineBasicMaterial({ color: 0x38bdf8, depthTest: false });
      const stem = new THREE.Line(stemGeo, stemMat);
      stem.renderOrder = 10000;
      this.rotationHandle.add(stem);

      // Rotation ring / torus - oriented horizontally (Math.PI / 2) for smooth top-down/isometric dragging
      const ringGeo = new THREE.TorusGeometry(40, 7, 10, 32);
      const ringMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, depthTest: false });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.y = 45;
      ring.rotation.x = Math.PI / 2;
      ring.renderOrder = 10000;
      ring.userData = { isRotationHandle: true };
      this.rotationHandle.add(ring);

      this.scene.add(this.rotationHandle);
    }

    this.rotationHandle.position.set(centroid.x, maxHandleY, centroid.z);
    this.rotationHandle.visible = true;

    // Decal side handles (4 yellow manipulation boxes on Front, Back, Left, Right edges)
    const isSingleDecal = selected.length === 1 && this.isPropDecal(selected[0]);
    if (isSingleDecal && this.decalSideHandlesGroup) {
      const prop = selected[0];
      const obj = this.propObjects.get(prop.id);
      const def = PROP_DEFINITIONS.find((d) => d.type === prop.type);
      if (obj && def) {
        this.decalSideHandlesGroup.position.copy(obj.position);
        this.decalSideHandlesGroup.quaternion.copy(obj.quaternion);

        const w = (def.defaultWidth || 500) * prop.scale;
        const h = (def.defaultHeight || 500) * prop.scale;
        const hw = w / 2;
        const hh = h / 2;

        const frontHandle = this.decalSideHandlesGroup.getObjectByName('DecalHandle_front');
        if (frontHandle) frontHandle.position.set(0, hh, 14);

        const backHandle = this.decalSideHandlesGroup.getObjectByName('DecalHandle_back');
        if (backHandle) backHandle.position.set(0, -hh, 14);

        const leftHandle = this.decalSideHandlesGroup.getObjectByName('DecalHandle_left');
        if (leftHandle) leftHandle.position.set(-hw, 0, 14);

        const rightHandle = this.decalSideHandlesGroup.getObjectByName('DecalHandle_right');
        if (rightHandle) rightHandle.position.set(hw, 0, 14);

        this.decalSideBoxes.forEach((box) => {
          box.userData.propId = prop.id;
        });

        this.decalSideHandlesGroup.visible = true;
      } else {
        this.decalSideHandlesGroup.visible = false;
      }
    } else if (this.decalSideHandlesGroup) {
      this.decalSideHandlesGroup.visible = false;
    }
  }

  raycastRotateHandle(clientX: number, clientY: number, canvas: HTMLCanvasElement): boolean {
    if (!this.rotationHandle || !this.rotationHandle.visible) return false;
    const rect = canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.mouseNdc.set(x, y);
    this.raycaster.setFromCamera(this.mouseNdc, this.camera);
    const hits = this.raycaster.intersectObjects(this.rotationHandle.children, true);
    return hits.length > 0;
  }

  raycastDecalSideHandle(clientX: number, clientY: number, canvas: HTMLCanvasElement): { side: DecalSide; prop: PlacedProp } | null {
    if (!this.decalSideHandlesGroup || !this.decalSideHandlesGroup.visible) return null;
    const rect = canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.mouseNdc.set(x, y);
    this.raycaster.setFromCamera(this.mouseNdc, this.camera);
    const hits = this.raycaster.intersectObjects(this.decalSideHandlesGroup.children, true);
    if (hits.length > 0) {
      let obj: THREE.Object3D | null = hits[0].object;
      while (obj && !obj.userData?.isDecalSideHandle) {
        obj = obj.parent;
      }
      if (obj?.userData?.isDecalSideHandle) {
        const prop = this.placedProps.find((p) => p.id === obj!.userData.propId);
        if (prop) {
          return { side: obj.userData.side as DecalSide, prop };
        }
      }
    }
    return null;
  }

  alignDecalToTerrain(propId?: string): { hit: boolean; pitchDeg: number; rollDeg: number } | null {
    const id = propId ?? this.selectedPropIds.values().next().value;
    if (!id) return null;
    const prop = this.placedProps.find((p) => p.id === id);
    if (!prop || !this.isPropDecal(prop)) return null;

    this.pushUndo();

    // Raycast down from above the decal
    const rayOrigin = new THREE.Vector3(prop.x, prop.y + 1500, prop.z);
    this.raycaster.set(rayOrigin, new THREE.Vector3(0, -1, 0));
    let hits = this.raycaster.intersectObjects(this.scene.children, true);

    let validHit: THREE.Intersection | null = null;
    for (const h of hits) {
      const o = h.object;
      if (
        o.name === 'Sky' ||
        o.name === 'Ghost' ||
        o.name === 'GhostMesh' ||
        o.name === 'GhostDecalMesh' ||
        (o as any).isSprite ||
        o.name === 'DebugMarkers' ||
        o.name?.startsWith('PlacedProp_') ||
        o.name?.startsWith('DecalSide') ||
        o.name?.startsWith('DecalHandle') ||
        o.name === 'RotationHandleGroup' ||
        o.name === 'DecalSideHandlesGroup'
      ) continue;
      validHit = h;
      break;
    }

    if (!validHit) {
      this.raycaster.set(new THREE.Vector3(prop.x, 25000, prop.z), new THREE.Vector3(0, -1, 0));
      hits = this.raycaster.intersectObjects(this.scene.children, true);
      for (const h of hits) {
        const o = h.object;
        if (
          o.name === 'Sky' ||
          o.name === 'Ghost' ||
          o.name === 'GhostMesh' ||
          o.name === 'GhostDecalMesh' ||
          (o as any).isSprite ||
          o.name === 'DebugMarkers' ||
          o.name?.startsWith('PlacedProp_') ||
          o.name?.startsWith('DecalSide') ||
          o.name?.startsWith('DecalHandle') ||
          o.name === 'RotationHandleGroup' ||
          o.name === 'DecalSideHandlesGroup'
        ) continue;
        validHit = h;
        break;
      }
    }

    if (!validHit || !validHit.face) return { hit: false, pitchDeg: 0, rollDeg: 0 };

    const normal = validHit.face.normal.clone().transformDirection(validHit.object.matrixWorld).normalize();
    const yaw = prop.rotY ?? 0;
    const F_horiz = new THREE.Vector3(Math.sin(-yaw), 0, Math.cos(-yaw)).normalize();
    const F_surface = F_horiz.clone().sub(normal.clone().multiplyScalar(F_horiz.dot(normal))).normalize();
    const R_surface = new THREE.Vector3().crossVectors(F_surface, normal).normalize();
    const mBasis = new THREE.Matrix4().makeBasis(R_surface, F_surface, normal);
    const q = new THREE.Quaternion().setFromRotationMatrix(mBasis);

    const pitch = Math.asin(F_surface.y);
    const roll = Math.asin(R_surface.y);

    prop.x = Math.round(validHit.point.x);
    prop.y = Math.round(validHit.point.y + 2);
    prop.z = Math.round(validHit.point.z);
    prop.rotX = pitch;
    prop.rotZ = roll;
    prop.quaternion = [q.x, q.y, q.z, q.w];

    this.updatePropTransform(prop.id, {
      x: prop.x,
      y: prop.y,
      z: prop.z,
      rotX: prop.rotX,
      rotZ: prop.rotZ,
      quaternion: prop.quaternion,
    }, true);

    return {
      hit: true,
      pitchDeg: (pitch * 180) / Math.PI,
      rollDeg: (roll * 180) / Math.PI,
    };
  }

  nudgeDecalSide(propId: string, side: DecalSide, deltaElevation: number, pushUndo = false, autoSave = true) {
    const prop = this.placedProps.find((p) => p.id === propId);
    if (!prop || !this.isPropDecal(prop) || deltaElevation === 0) return;

    if (pushUndo) {
      this.pushUndo();
    }

    const def = PROP_DEFINITIONS.find((d) => d.type === prop.type);
    const W = (def?.defaultWidth || 500) * prop.scale;
    const H = (def?.defaultHeight || 500) * prop.scale;
    const hw = W / 2;
    const hh = H / 2;

    let q: THREE.Quaternion;
    if (prop.quaternion) {
      q = new THREE.Quaternion(...prop.quaternion);
    } else {
      const qFlat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
      const qYaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -prop.rotY);
      const qPitch = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), prop.rotX ?? 0);
      const qRoll = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), prop.rotZ ?? 0);
      q = qFlat.multiply(qYaw).multiply(qPitch).multiply(qRoll);
    }

    let pos = new THREE.Vector3(prop.x, prop.y, prop.z);
    const R_world = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
    const F_world = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
    const N_world = new THREE.Vector3(0, 0, 1).applyQuaternion(q);

    let axis: THREE.Vector3;
    let dTheta: number;

    if (side === 'front') {
      axis = R_world;
      dTheta = deltaElevation / (2 * hh);
    } else if (side === 'back') {
      axis = R_world;
      dTheta = -deltaElevation / (2 * hh);
    } else if (side === 'left') {
      axis = F_world;
      dTheta = deltaElevation / (2 * hw);
    } else {
      // right
      axis = F_world;
      dTheta = -deltaElevation / (2 * hw);
    }

    const qDelta = new THREE.Quaternion().setFromAxisAngle(axis, dTheta);
    q = qDelta.multiply(q);
    pos.addScaledVector(N_world, deltaElevation / 2);

    const pitch = Math.asin(new THREE.Vector3(0, 1, 0).applyQuaternion(q).y);
    const roll = Math.asin(new THREE.Vector3(1, 0, 0).applyQuaternion(q).y);

    prop.x = Math.round(pos.x);
    prop.y = Math.round(pos.y);
    prop.z = Math.round(pos.z);
    prop.rotX = pitch;
    prop.rotZ = roll;
    prop.quaternion = [q.x, q.y, q.z, q.w];

    this.updatePropTransform(prop.id, {
      x: prop.x,
      y: prop.y,
      z: prop.z,
      rotX: prop.rotX,
      rotZ: prop.rotZ,
      quaternion: prop.quaternion,
    }, autoSave);
  }

  resetDecalFlat(propId?: string) {
    const id = propId ?? this.selectedPropIds.values().next().value;
    if (!id) return;
    const prop = this.placedProps.find((p) => p.id === id);
    if (!prop || !this.isPropDecal(prop)) return;

    this.pushUndo();
    prop.rotX = 0;
    prop.rotZ = 0;
    delete prop.quaternion;

    this.updatePropTransform(prop.id, {
      rotX: 0,
      rotZ: 0,
      quaternion: undefined,
    }, true);
  }

  getDecalAngles(prop: PlacedProp): { pitchDeg: number; rollDeg: number } {
    if (prop.quaternion) {
      const q = new THREE.Quaternion(...prop.quaternion);
      const F = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
      const R = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
      return {
        pitchDeg: Math.round((Math.asin(F.y) * 180) / Math.PI),
        rollDeg: Math.round((Math.asin(R.y) * 180) / Math.PI),
      };
    }
    return {
      pitchDeg: Math.round(((prop.rotX ?? 0) * 180) / Math.PI),
      rollDeg: Math.round(((prop.rotZ ?? 0) * 180) / Math.PI),
    };
  }

  rotateDecal(propId?: string, deltaRadians = Math.PI / 12, pushUndo = true) {
    const id = propId ?? this.selectedPropIds.values().next().value;
    if (!id) return;
    const prop = this.placedProps.find((p) => p.id === id);
    if (!prop || !this.isPropDecal(prop) || deltaRadians === 0) return;

    if (pushUndo) {
      this.pushUndo();
    }

    this.updatePropTransform(prop.id, {
      rotY: (prop.rotY ?? 0) + deltaRadians,
    }, true);
  }

  tiltSelectedProp(deltaRadians: number) {
    this.tiltSelectedProps(deltaRadians);
  }

  flipSelectedProp() {
    this.flipSelectedProps();
  }

  // --- SPRITE & MESH CREATION & TEXTURE CACHE ---
  private getTexture(url: string): THREE.Texture {
    let tex = this.textureCache.get(url);
    if (!tex) {
      if (typeof document === 'undefined') {
        tex = new THREE.Texture();
      } else {
        tex = this.textureLoader.load(url);
        tex.colorSpace = THREE.SRGBColorSpace;
      }
      this.textureCache.set(url, tex);
    }
    return tex;
  }

  private createPropSprite(prop: PlacedProp): THREE.Object3D {
    const def = PROP_DEFINITIONS.find((p) => p.type === prop.type);
    if (!def) return new THREE.Object3D();

    let obj: THREE.Object3D;
    const flip = prop.flipX ? -1 : 1;
    const isDecal = prop.isDecal !== undefined ? prop.isDecal : (def.isDecal ?? false);

    if (def.isRamp) {
      // Create 3D wedge ramp mesh using base dimensions (scale 1.0)
      const w = def.defaultWidth || 960;
      const len = 1100;
      const h = def.defaultHeight || 260;
      const mat = this.materials?.wood ?? new THREE.MeshStandardMaterial({
        color: 0x9b6b3b,
        roughness: 0.7,
      });
      const mesh = wedgeMesh(w, len, h, mat);
      mesh.name = `PlacedProp_${prop.id}`;
      mesh.userData = { propId: prop.id, isRamp: true };
      mesh.position.set(prop.x, prop.y, prop.z);
      mesh.rotation.y = prop.rotY;
      mesh.rotation.z = prop.rotZ ?? 0;
      mesh.scale.set(prop.scale * flip, prop.scale, prop.scale);
      obj = mesh;
    } else if (def.isSlingshot || def.is3DModel) {
      // Create 3D Slingshot Model
      const model = createSlingshotMesh(prop.scale, this.materials);
      model.name = `PlacedProp_${prop.id}`;
      model.userData = { propId: prop.id, is3DModel: true, isSlingshot: true };
      model.position.set(prop.x, prop.y, prop.z);
      model.rotation.y = prop.rotY;
      model.rotation.z = prop.rotZ ?? 0;
      model.scale.set(prop.scale * flip, prop.scale, prop.scale);
      obj = model;
    } else if (isDecal) {
      // Flat surface decal (lies flat on track/ground)
      const tex = this.getTexture(def.url);
      const geom = new THREE.PlaneGeometry(def.defaultWidth, def.defaultHeight);
      const isLit = prop.lit !== false;
      const mat = isLit
        ? new THREE.MeshStandardMaterial({
            map: tex,
            transparent: true,
            roughness: 0.95,
            metalness: 0.0,
            side: THREE.DoubleSide,
            depthWrite: false,
            polygonOffset: true,
            polygonOffsetFactor: -3,
            polygonOffsetUnits: -3,
          })
        : new THREE.MeshBasicMaterial({
            map: tex,
            transparent: true,
            side: THREE.DoubleSide,
            depthWrite: false,
            polygonOffset: true,
            polygonOffsetFactor: -3,
            polygonOffsetUnits: -3,
          });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.name = `PlacedProp_${prop.id}`;
      mesh.userData = { propId: prop.id, isDecal: true };
      this.applyDecalTransform(mesh, prop, def);
      obj = mesh;
    } else if (prop.cameraFacing === false) {
      // Fixed 3D World Orientation (Double-sided plane mesh)
      const tex = this.getTexture(def.url);
      const geom = new THREE.PlaneGeometry(def.defaultWidth, def.defaultHeight);
      if (def.alignBottom !== false) {
        geom.translate(0, def.defaultHeight / 2, 0);
      }
      const isLit = prop.lit !== false;
      const mat = isLit
        ? new THREE.MeshStandardMaterial({
            map: tex,
            transparent: true,
            roughness: 0.95,
            metalness: 0.0,
            side: THREE.DoubleSide,
            depthWrite: true,
            alphaTest: 0.2,
          })
        : new THREE.MeshBasicMaterial({
            map: tex,
            transparent: true,
            side: THREE.DoubleSide,
            depthWrite: true,
            alphaTest: 0.2,
          });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.name = `PlacedProp_${prop.id}`;
      mesh.userData = { propId: prop.id, isMeshProp: true };
      mesh.position.set(prop.x, prop.y, prop.z);
      mesh.rotation.y = prop.rotY;
      mesh.rotation.z = prop.rotZ ?? 0;
      mesh.scale.set(prop.scale * flip, prop.scale, prop.scale);
      obj = mesh;
    } else {
      // Camera Facing (Billboard Sprite)
      const tex = this.getTexture(def.url);
      const mat = new THREE.SpriteMaterial({
        map: tex,
        transparent: true,
        depthWrite: false,
        rotation: prop.rotZ ?? 0,
      });
      const sprite = new THREE.Sprite(mat);
      sprite.name = `PlacedProp_${prop.id}`;
      sprite.userData = { propId: prop.id };
      sprite.position.set(prop.x, prop.y, prop.z);
      sprite.center.set(0.5, def.alignBottom !== false ? 0 : 0.5);
      sprite.scale.set(def.defaultWidth * prop.scale * flip, def.defaultHeight * prop.scale, 1);
      obj = sprite;
    }

    this.scene.add(obj);
    this.propObjects.set(prop.id, obj);
    return obj;
  }

  // --- UNDO / REDO ---
  pushUndo() {
    this.undoStack.push(JSON.stringify(this.placedProps));
    if (this.undoStack.length > 30) this.undoStack.shift();
    this.redoStack.length = 0;
  }

  undo() {
    if (!this.undoStack.length) return;
    this.redoStack.push(JSON.stringify(this.placedProps));
    const state = JSON.parse(this.undoStack.pop()!);
    this.restorePropsState(state);
    this.notify();
  }

  redo() {
    if (!this.redoStack.length) return;
    this.undoStack.push(JSON.stringify(this.placedProps));
    const state = JSON.parse(this.redoStack.pop()!);
    this.restorePropsState(state);
    this.notify();
  }

  private restorePropsState(props: PlacedProp[]) {
    // Remove current objects
    this.propObjects.forEach((s) => this.scene.remove(s));
    this.propObjects.clear();
    this.selectionBoxes.forEach((box) => this.scene.remove(box));
    this.selectionBoxes.clear();

    this.placedProps = props;
    this.placedProps.forEach((p) => this.createPropSprite(p));
    this.selectProp(null);
    this.saveToStorage();
  }

  // --- PERSISTENCE & PERIODIC DISK BACKUP ---
  saveToStorage() {
    try {
      localStorage.setItem('hm2-3d-track-props', JSON.stringify(this.placedProps));
      if (this.placedProps.length > 0) {
        const backupEntry = {
          course: this.courseId,
          timestamp: Date.now(),
          count: this.placedProps.length,
          props: this.placedProps,
        };
        localStorage.setItem('hm2-3d-track-props-backup-latest', JSON.stringify(backupEntry));

        // Rolling local backup history (up to 5 in localStorage)
        try {
          const rawHist = localStorage.getItem('hm2-3d-track-props-backup-history');
          const hist = rawHist ? JSON.parse(rawHist) : [];
          if (Array.isArray(hist)) {
            hist.unshift({
              course: this.courseId,
              timestamp: Date.now(),
              count: this.placedProps.length,
              props: this.placedProps,
            });
            localStorage.setItem('hm2-3d-track-props-backup-history', JSON.stringify(hist.slice(0, 5)));
          }
        } catch {}
      }
    } catch {
      // Storage full or unavailable
    }

    // Schedule debounced disk backup (e.g. 2.5 seconds after user edit)
    if (this.backupDebounceTimer) {
      clearTimeout(this.backupDebounceTimer);
    }
    if (typeof window !== 'undefined') {
      this.backupDebounceTimer = setTimeout(() => {
        this.backupToFile(false);
      }, 2500);
      if (this.backupDebounceTimer && typeof (this.backupDebounceTimer as any).unref === 'function') {
        (this.backupDebounceTimer as any).unref();
      }
    }
  }

  private loadFromStorage() {
    let loaded = false;
    try {
      const raw = localStorage.getItem('hm2-3d-track-props');
      if (raw) {
        const props: PlacedProp[] = JSON.parse(raw);
        if (Array.isArray(props) && props.length > 0) {
          this.placedProps = props;
          this.placedProps.forEach((p) => this.createPropSprite(p));
          loaded = true;
        }
      }
    } catch {
      // Invalid JSON
    }

    // If empty or missing, try browser local backup
    if (!loaded) {
      try {
        const rawBackup = localStorage.getItem('hm2-3d-track-props-backup-latest');
        if (rawBackup) {
          const parsed = JSON.parse(rawBackup);
          const props: PlacedProp[] = Array.isArray(parsed) ? parsed : parsed.props;
          if (Array.isArray(props) && props.length > 0) {
            this.placedProps = props;
            this.placedProps.forEach((p) => this.createPropSprite(p));
            loaded = true;
          }
        }
      } catch {}
    }

    // If still no props, bootstrap immediately with default track decorations
    if (!loaded) {
      this.placedProps = JSON.parse(JSON.stringify(DEFAULT_TRACK_PROPS));
      this.placedProps.forEach((p) => this.createPropSprite(p));
      this.saveToStorage();
      loaded = true;
    }

    // Sync latest from disk in background
    this.syncLatestFromDisk();
  }

  private async syncLatestFromDisk() {
    if (typeof fetch === 'undefined') return;
    try {
      const res = await fetch('/api/backup-props');
      if (!res.ok) return;
      const data = await res.json();
      const diskProps = data?.latest?.props;
      if (Array.isArray(diskProps) && diskProps.length > 0) {
        // If scene currently only has default starter items, check if disk has custom items
        if (this.placedProps.length === 0 || this.placedProps.length === DEFAULT_TRACK_PROPS.length) {
          this.restorePropsState(diskProps);
          this.notify();
        }
      }
    } catch {
      // Offline / standalone preview
    }
  }

  async backupToFile(force = false): Promise<{ success: boolean; count: number; timestamp: number } | null> {
    if (typeof fetch === 'undefined') return null;
    const now = Date.now();
    if (!force && this.lastBackupTimestamp && now - this.lastBackupTimestamp < 15000) {
      return null;
    }

    this.notifyBackupStatus('saving');
    try {
      const payload = {
        course: this.courseId,
        timestamp: now,
        props: this.placedProps,
      };

      const res = await fetch('/api/backup-props', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        this.lastBackupTimestamp = now;
        this.notifyBackupStatus('saved');
        return { success: true, count: this.placedProps.length, timestamp: now };
      } else {
        this.notifyBackupStatus('error');
        return null;
      }
    } catch {
      this.notifyBackupStatus('idle');
      return null;
    }
  }

  async fetchBackups(): Promise<{ latest: any; history: any[]; localHistory: any[] }> {
    let latest = null;
    let history: any[] = [];
    const localHistory: any[] = [];

    if (typeof fetch !== 'undefined') {
      try {
        const res = await fetch('/api/backup-props');
        if (res.ok) {
          const data = await res.json();
          latest = data.latest ?? null;
          history = data.history ?? [];
        }
      } catch {}
    }

    try {
      const rawLatest = localStorage.getItem('hm2-3d-track-props-backup-latest');
      if (rawLatest) {
        const parsed = JSON.parse(rawLatest);
        localHistory.push({
          source: 'localStorage',
          title: 'Browser Auto-Save (Latest)',
          count: parsed.count || parsed.props?.length || 0,
          timestamp: parsed.timestamp || 0,
          props: parsed.props || parsed,
        });
      }
      const rawHist = localStorage.getItem('hm2-3d-track-props-backup-history');
      if (rawHist) {
        const list = JSON.parse(rawHist);
        if (Array.isArray(list)) {
          list.forEach((item, idx) => {
            localHistory.push({
              source: 'localStorage',
              title: `Browser History #${idx + 1}`,
              count: item.count || item.props?.length || 0,
              timestamp: item.timestamp || 0,
              props: item.props || item,
            });
          });
        }
      }
    } catch {}

    return { latest, history, localHistory };
  }

  async restoreBackupFile(filename: string): Promise<boolean> {
    if (typeof fetch === 'undefined') return false;
    try {
      const res = await fetch('/api/restore-backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename }),
      });
      if (res.ok) {
        const data = await res.json();
        const props = Array.isArray(data) ? data : data.props;
        if (Array.isArray(props)) {
          this.pushUndo();
          this.restorePropsState(props);
          this.notify();
          await this.backupToFile(true);
          return true;
        }
      }
    } catch (e) {
      console.error('Failed to restore backup file:', e);
    }
    return false;
  }

  async restoreDefaultPreset(): Promise<boolean> {
    this.pushUndo();
    this.restorePropsState(JSON.parse(JSON.stringify(DEFAULT_TRACK_PROPS)));
    this.notify();
    await this.backupToFile(true);
    return true;
  }

  exportJson(): string {
    return JSON.stringify(this.placedProps, null, 2);
  }

  importJson(jsonStr: string) {
    try {
      const props: PlacedProp[] = JSON.parse(jsonStr);
      if (Array.isArray(props)) {
        this.pushUndo();
        this.restorePropsState(props);
        this.notify();
        this.backupToFile(true);
      }
    } catch (e) {
      console.error('Failed to import track props JSON:', e);
    }
  }

  clearAll() {
    this.pushUndo();
    this.restorePropsState([]);
    this.notify();
  }

  destroy() {
    if (this.backupIntervalTimer) clearInterval(this.backupIntervalTimer);
    if (this.backupDebounceTimer) clearTimeout(this.backupDebounceTimer);
    if (this.ghostSprite) this.scene.remove(this.ghostSprite);
    if (this.ghostMesh) this.scene.remove(this.ghostMesh);
    this.selectionBoxes.forEach((box) => this.scene.remove(box));
    this.selectionBoxes.clear();
    if (this.rotationHandle) this.scene.remove(this.rotationHandle);
    this.propObjects.forEach((s) => this.scene.remove(s));
    this.propObjects.clear();
    this.listeners.length = 0;
    this.backupStatusListeners.length = 0;
  }
}
