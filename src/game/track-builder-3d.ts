/* =============================================================================
   HEAVY METAL GP 2 — FULL 3D TRACK BUILDER
   Complete 3D world editor: free-fly camera, raycast surface snapping onto
   track & terrain, categorized prop palette, 3D manipulation, undo/redo,
   and JSON persistence.
   ============================================================================= */
import * as THREE from 'three';
import { wedgeMesh, type TrackData, type TrackSample } from './renderer-3d';

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
}

export interface PlacedProp {
  id: string;
  type: string;
  name: string;
  x: number;
  y: number;
  z: number;
  rotY: number;
  rotZ?: number;
  scale: number;
  alignToTrack: boolean;
  trackDist?: number;
  cameraFacing?: boolean;
  flipX?: boolean;
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

  // --- ROAD DECALS (WARCRAFT RTS DIRT ROAD STYLE) ---
  { type: 'decal_wc_grass_patch', name: 'Lush Grass Patch', category: 'decals', url: '/art/decals/decal-wc-grass-patch.png', defaultWidth: 500, defaultHeight: 500, isDecal: true },
  { type: 'decal_wc_grass_seam', name: 'Grass Fringe & Seam Blender', category: 'decals', url: '/art/decals/decal-wc-grass-seam.png', defaultWidth: 520, defaultHeight: 520, isDecal: true },
  { type: 'decal_wc_rocky_dirt', name: 'Rocky Dirt Cutout', category: 'decals', url: '/art/decals/decal-wc-rocky-dirt.png', defaultWidth: 550, defaultHeight: 550, isDecal: true },
  { type: 'decal_wc_mud_puddle', name: 'Muddy Dirt Puddle', category: 'decals', url: '/art/decals/decal-wc-mud-puddle.png', defaultWidth: 480, defaultHeight: 480, isDecal: true },
  { type: 'decal_wc_flagstone', name: 'Mossy Flagstone Pavers', category: 'decals', url: '/art/decals/decal-wc-flagstone.png', defaultWidth: 500, defaultHeight: 500, isDecal: true },
  { type: 'decal_wc_gravel', name: 'Gravel & River Stones', category: 'decals', url: '/art/decals/decal-wc-gravel.png', defaultWidth: 500, defaultHeight: 500, isDecal: true },
  { type: 'decal_wc_cart_ruts', name: 'Wagon Cart Dirt Ruts', category: 'decals', url: '/art/decals/decal-wc-cart-ruts.png', defaultWidth: 580, defaultHeight: 580, isDecal: true },

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

export class TrackBuilder3D {
  private placedProps: PlacedProp[] = [];
  private propObjects = new Map<string, THREE.Object3D>();
  private selectedPropId: string | null = null;
  private activePropType: string | null = null;
  private ghostSprite: THREE.Sprite | null = null;
  private ghostMesh: THREE.Mesh | null = null;
  private selectionBox: THREE.BoxHelper | null = null;
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
  };

  private readonly textureLoader = new THREE.TextureLoader();
  private readonly textureCache = new Map<string, THREE.Texture>();
  private readonly raycaster = new THREE.Raycaster();
  private readonly mouseNdc = new THREE.Vector2();

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

  constructor(
    private readonly scene: THREE.Scene,
    private readonly camera: THREE.PerspectiveCamera,
    private readonly track: TrackData,
    private readonly materials?: any,
  ) {
    this.loadFromStorage();
  }

  onChange(cb: () => void) {
    this.listeners.push(cb);
  }

  private notify() {
    this.listeners.forEach((cb) => cb());
  }

  getProps(): readonly PlacedProp[] {
    return this.placedProps;
  }

  getSelectedProp(): PlacedProp | null {
    if (!this.selectedPropId) return null;
    return this.placedProps.find((p) => p.id === this.selectedPropId) ?? null;
  }

  getActivePropType(): string | null {
    return this.activePropType;
  }

  setActivePropType(type: string | null) {
    this.activePropType = type;
    this.updateGhostSprite();
    this.notify();
  }

  selectProp(id: string | null) {
    this.selectedPropId = id;
    this.updateSelectionBox();
    this.notify();
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
    if (keys.has('KeyQ') || keys.has('ControlLeft')) move.y -= 1;

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
      // Skip sky, markers, gizmos, ghosts, sprites, and placed props
      if (
        obj.name === 'Sky' ||
        obj.name === 'Ghost' ||
        obj.name === 'GhostMesh' ||
        (obj as any).isSprite ||
        obj.name === 'DebugMarkers' ||
        obj.name?.startsWith('PlacedProp_')
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
        normal: hit.face ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld) : new THREE.Vector3(0, 1, 0),
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
        this.ghostMesh.rotation.x = -Math.PI / 2;
        if (this.snapping.alignToTrack && hit.sample) {
          const rotY = Math.atan2(hit.sample.tangent.x, hit.sample.tangent.z);
          this.ghostMesh.rotation.z = -rotY;
        }
      } else if (this.snapping.alignToTrack && hit.sample) {
        this.ghostMesh.rotation.y = Math.atan2(hit.sample.tangent.x, hit.sample.tangent.z);
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

    if (def.isDecal) {
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

    this.pushUndo();

    let pos = hit.point.clone();
    let rotY = 0;
    if (this.snapping.alignToTrack && hit.sample) {
      rotY = Math.atan2(hit.sample.tangent.x, hit.sample.tangent.z);
    }

    const prop: PlacedProp = {
      id: `prop_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type: def.type,
      name: def.name,
      x: Math.round(pos.x),
      y: Math.round(pos.y),
      z: Math.round(pos.z),
      rotY,
      rotZ: 0,
      scale: 1,
      alignToTrack: this.snapping.alignToTrack,
      trackDist: hit.sample ? Math.round(hit.sample.dist) : undefined,
      cameraFacing: (def.isRamp || def.isDecal) ? false : this.snapping.cameraFacingDefault,
      flipX: false,
    };

    this.placedProps.push(prop);
    this.createPropSprite(prop);
    this.selectProp(prop.id);
    this.saveToStorage();
    this.notify();
    return prop;
  }

  duplicateSelected(): PlacedProp | null {
    const selected = this.getSelectedProp();
    if (!selected) return null;

    this.pushUndo();
    const dup: PlacedProp = {
      ...selected,
      id: `prop_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      x: selected.x + 120,
      z: selected.z + 120,
    };

    this.placedProps.push(dup);
    this.createPropSprite(dup);
    this.selectProp(dup.id);
    this.saveToStorage();
    this.notify();
    return dup;
  }

  deleteSelected() {
    if (!this.selectedPropId) return;
    this.deleteProp(this.selectedPropId);
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
      this.placedProps.splice(idx, 1);
    }

    if (this.selectedPropId === id) {
      this.selectProp(null);
    }
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

  updatePropTransform(id: string, updates: Partial<PlacedProp>) {
    const prop = this.placedProps.find((p) => p.id === id);
    if (!prop) return;

    const oldCameraFacing = prop.cameraFacing !== false;
    Object.assign(prop, updates);
    const newCameraFacing = prop.cameraFacing !== false;

    // If cameraFacing changed, recreate the 3D object
    if (oldCameraFacing !== newCameraFacing) {
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
        const def = PROP_DEFINITIONS.find((p) => p.type === prop.type);
        const flip = prop.flipX ? -1 : 1;
        if (def) {
          if (def.isDecal || (obj as any).userData?.isDecal) {
            obj.position.y = prop.y + 2;
            obj.rotation.x = -Math.PI / 2;
            obj.rotation.z = -(prop.rotY + (prop.rotZ ?? 0));
            obj.scale.set(prop.scale * flip, prop.scale, prop.scale);
          } else if (def.isRamp) {
            obj.rotation.y = prop.rotY;
            obj.rotation.z = prop.rotZ ?? 0;
            obj.scale.set(prop.scale * flip, prop.scale, prop.scale);
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
    this.updateSelectionBox();
    this.saveToStorage();
    this.notify();
  }

  getPlacedRamps(): readonly PlacedProp[] {
    return this.placedProps.filter((p) => {
      const def = PROP_DEFINITIONS.find((d) => d.type === p.type);
      return def?.isRamp || p.type === 'timber_ramp' || p.type === 'rock_springboard' || p.type === 'springboard';
    });
  }

  // --- SELECTION BOX HIGHLIGHT & ROTATION HANDLE ---
  private updateSelectionBox() {
    const prop = this.getSelectedProp();
    if (!prop || !this.freeFly.active) {
      if (this.selectionBox) this.selectionBox.visible = false;
      if (this.rotationHandle) this.rotationHandle.visible = false;
      return;
    }

    const obj = this.propObjects.get(prop.id);
    if (!obj) return;

    if (!this.selectionBox) {
      this.selectionBox = new THREE.BoxHelper(obj, 0xffdd00);
      (this.selectionBox.material as THREE.LineBasicMaterial).depthTest = false;
      (this.selectionBox.material as THREE.LineBasicMaterial).transparent = true;
      (this.selectionBox.material as THREE.LineBasicMaterial).opacity = 0.95;
      this.selectionBox.renderOrder = 9999;
      this.scene.add(this.selectionBox);
    } else {
      this.selectionBox.setFromObject(obj);
      this.selectionBox.visible = true;
    }

    // Position in-place rotation handle above the prop
    const def = PROP_DEFINITIONS.find((p) => p.type === prop.type);
    const h = (def?.defaultHeight ?? 500) * prop.scale;
    const handleY = prop.y + (def?.isDecal ? 40 : h + 70);

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

      // Rotation ring / torus
      const ringGeo = new THREE.TorusGeometry(32, 6, 8, 24);
      const ringMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, depthTest: false });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.y = 45;
      ring.renderOrder = 10000;
      ring.userData = { isRotationHandle: true };
      this.rotationHandle.add(ring);

      this.scene.add(this.rotationHandle);
    }

    this.rotationHandle.position.set(prop.x, handleY, prop.z);
    this.rotationHandle.visible = true;
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

  tiltSelectedProp(deltaRadians: number) {
    const prop = this.getSelectedProp();
    if (!prop) return;
    const current = prop.rotZ ?? 0;
    this.updatePropTransform(prop.id, { rotZ: current + deltaRadians });
  }

  flipSelectedProp() {
    const prop = this.getSelectedProp();
    if (!prop) return;
    this.updatePropTransform(prop.id, { flipX: !prop.flipX });
  }

  // --- SPRITE & MESH CREATION & TEXTURE CACHE ---
  private getTexture(url: string): THREE.Texture {
    let tex = this.textureCache.get(url);
    if (!tex) {
      tex = this.textureLoader.load(url);
      tex.colorSpace = THREE.SRGBColorSpace;
      this.textureCache.set(url, tex);
    }
    return tex;
  }

  private createPropSprite(prop: PlacedProp): THREE.Object3D {
    const def = PROP_DEFINITIONS.find((p) => p.type === prop.type);
    if (!def) return new THREE.Object3D();

    let obj: THREE.Object3D;
    const flip = prop.flipX ? -1 : 1;

    if (def.isRamp) {
      // Create 3D wedge ramp mesh
      const w = (def.defaultWidth || 960) * prop.scale * flip;
      const len = 1100 * prop.scale;
      const h = (def.defaultHeight || 260) * prop.scale;
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
      obj = mesh;
    } else if (def.isDecal) {
      // Flat surface decal (lies flat on track/ground)
      const tex = this.getTexture(def.url);
      const geom = new THREE.PlaneGeometry(def.defaultWidth, def.defaultHeight);
      const mat = new THREE.MeshBasicMaterial({
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
      mesh.position.set(prop.x, prop.y + 2, prop.z);
      mesh.rotation.x = -Math.PI / 2;
      mesh.rotation.z = -(prop.rotY + (prop.rotZ ?? 0));
      mesh.scale.set(prop.scale * flip, prop.scale, prop.scale);
      obj = mesh;
    } else if (prop.cameraFacing === false) {
      // Fixed 3D World Orientation (Double-sided plane mesh)
      const tex = this.getTexture(def.url);
      const geom = new THREE.PlaneGeometry(def.defaultWidth, def.defaultHeight);
      if (def.alignBottom !== false) {
        geom.translate(0, def.defaultHeight / 2, 0);
      }
      const mat = new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: true,
        alphaTest: 0.05,
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
  private pushUndo() {
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

    this.placedProps = props;
    this.placedProps.forEach((p) => this.createPropSprite(p));
    this.selectProp(null);
    this.saveToStorage();
  }

  // --- PERSISTENCE ---
  private saveToStorage() {
    try {
      localStorage.setItem('hm2-3d-track-props', JSON.stringify(this.placedProps));
    } catch {
      // Storage full or unavailable
    }
  }

  private loadFromStorage() {
    try {
      const raw = localStorage.getItem('hm2-3d-track-props');
      if (raw) {
        const props: PlacedProp[] = JSON.parse(raw);
        if (Array.isArray(props)) {
          this.placedProps = props;
          this.placedProps.forEach((p) => this.createPropSprite(p));
        }
      }
    } catch {
      // Invalid JSON
    }
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
    if (this.ghostSprite) this.scene.remove(this.ghostSprite);
    if (this.ghostMesh) this.scene.remove(this.ghostMesh);
    if (this.selectionBox) this.scene.remove(this.selectionBox);
    if (this.rotationHandle) this.scene.remove(this.rotationHandle);
    this.propObjects.forEach((s) => this.scene.remove(s));
    this.propObjects.clear();
    this.listeners.length = 0;
  }
}
