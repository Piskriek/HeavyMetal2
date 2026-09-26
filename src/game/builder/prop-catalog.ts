/**
 * The track builder's prop catalog (M8: lifted out of track-builder-3d.ts, unchanged): every
 * placeable prop's definition, the animated-sheet helpers, the placed-prop shape, and the starter
 * decorations. track-builder-3d.ts re-exports all of it, so importers are unchanged.
 */
import type { MaterialDescriptor } from '../materials/material-descriptor';
import type { RoleConfig } from '../collision/obstacle-roles';
import { PRIMITIVE_DEFINITIONS } from './primitives';
import { LIGHT_DEFINITIONS } from './light-rig';

export type PropCategory = 'foliage' | 'trackside' | 'cavern_mine' | 'stadium' | 'decals' | 'goblins' | 'powerup' | 'barrier' | 'animated'
  /** M01 · T7 — not a prop shelf: this tab shows the Lanes & Paths panel instead of a card grid. */
  | 'lanes'
  /** 3D shapes that wear shaders; in this tab the course's own scenery can be selected too. */
  | 'primitives'
  /** Placed point and spot lights. */
  | 'lights'
  /** Not a shelf: edits to the course's generated scenery (never shown as cards). */
  | 'scenery';

export interface PropDefinition {
  type: string;
  name: string;
  category: PropCategory;
  url: string;
  defaultWidth: number;
  defaultHeight: number;
  defaultDepth?: number; // T08: explicit depth for 3D props
  defaultAltitude?: number;
  alignBottom?: boolean;
  isRamp?: boolean;
  isDecal?: boolean;
  is3DModel?: boolean;
  isSlingshot?: boolean;
  isPowerup?: boolean; // T08: powerup category
  isBarrier?: boolean; // T08: barrier category
  isAnimated?: boolean; // Animated category: url is a multi-frame sheet, one frame shown at a time
  animCols?: number; // sheet columns (default 2)
  animRows?: number; // sheet rows (default 2)
  animFps?: number; // playback speed (default 6)
  stillType?: string; // animated defs: type of the still decoration this sheet was cut from
  animatedTwin?: string; // still defs: type of the animated sheet cut from this decoration
}

export type DecalSide = 'front' | 'back' | 'left' | 'right';

/** Grid + speed resolved from a definition (2x2 @ 6fps unless overridden). */
export interface AnimGrid {
  cols: number;
  rows: number;
  fps: number;
}

export function animGridFor(def: PropDefinition): AnimGrid {
  const cols = def.animCols !== undefined && def.animCols > 0 ? Math.floor(def.animCols) : 2;
  const rows = def.animRows !== undefined && def.animRows > 0 ? Math.floor(def.animRows) : 2;
  const fps = def.animFps !== undefined && def.animFps > 0 ? def.animFps : 6;
  return { cols, rows, fps };
}

/** Speed slider bounds for the attribute window's +/- control. */
export const ANIM_SPEED_MIN = 0.25;
export const ANIM_SPEED_MAX = 4;
export const ANIM_SPEED_STEP = 0.25;

/** Clamp a stored speed multiplier into the supported range (default 1). */
export function animSpeedFor(prop: Pick<PlacedProp, 'animSpeed'> | undefined): number {
  const raw = prop?.animSpeed;
  if (raw === undefined || !Number.isFinite(raw)) return 1;
  return Math.min(ANIM_SPEED_MAX, Math.max(ANIM_SPEED_MIN, raw));
}

/**
 * Frame indices a prop is allowed to show. `animFrames` shorter than the sheet
 * (or missing) counts as "all frames on"; an empty selection falls back to
 * frame 0 so a prop can never vanish.
 */
export function animEnabledFrames(
  prop: Pick<PlacedProp, 'animFrames'> | undefined,
  total: number,
): number[] {
  const safeTotal = Math.max(1, Math.floor(total));
  const flags = prop?.animFrames;
  if (!Array.isArray(flags)) return Array.from({ length: safeTotal }, (_, i) => i);
  const list: number[] = [];
  for (let i = 0; i < safeTotal; i += 1) {
    if (flags[i] !== false) list.push(i);
  }
  return list.length > 0 ? list : [0];
}

/**
 * Which frame of a `total`-frame loop is showing at `timeSec` (phase desyncs
 * twins). When `enabled` is supplied the loop runs over that subset only, so
 * unchecked frames are skipped instead of showing as blank holds.
 */
export function animFrameAt(
  timeSec: number,
  fps: number,
  total: number,
  phase = 0,
  enabled?: readonly boolean[],
  delays?: readonly number[],
): number {
  if (!(total > 1) || !(fps > 0)) return 0;
  const list = enabled ? animEnabledFrames({ animFrames: [...enabled] }, total) : null;
  const frames = list ?? Array.from({ length: total }, (_, i) => i);
  if (frames.length === 0) return 0;
  if (frames.length === 1) return frames[0];

  const hasDelays = delays && delays.some((d) => typeof d === 'number' && Number.isFinite(d) && d > 0);
  if (!hasDelays) {
    const t = timeSec * fps + phase;
    if (!list) return ((Math.floor(t) % total) + total) % total;
    const i = ((Math.floor(t) % list.length) + list.length) % list.length;
    return list[i];
  }

  const baseDuration = 1 / fps;
  let totalDuration = 0;
  const durations: number[] = new Array(frames.length);
  for (let j = 0; j < frames.length; j += 1) {
    const frameIdx = frames[j];
    const extraDelay = delays?.[frameIdx];
    const d = baseDuration + (typeof extraDelay === 'number' && Number.isFinite(extraDelay) && extraDelay > 0 ? extraDelay : 0);
    durations[j] = d;
    totalDuration += d;
  }

  if (!(totalDuration > 0)) return frames[0];
  const phaseTime = phase / fps;
  let t = ((timeSec + phaseTime) % totalDuration + totalDuration) % totalDuration;
  let elapsed = 0;
  for (let j = 0; j < frames.length; j += 1) {
    elapsed += durations[j];
    if (t < elapsed) return frames[j];
  }
  return frames[frames.length - 1];
}

/** Animated sheet a prop currently renders, or null when it renders its still art. */
export function animSheetFor(prop: PlacedProp | undefined): {
  url: string;
  cols: number;
  rows: number;
  fps: number;
} | null {
  if (!prop) return null;
  const def = PROP_DEFINITIONS.find((d) => d.type === prop.type);
  if (!def) return null;
  if (def.isAnimated) return { url: def.url, ...animGridFor(def) };
  if (prop.animated === true && def.animatedTwin) {
    const twin = PROP_DEFINITIONS.find((d) => d.type === def.animatedTwin);
    if (twin?.isAnimated) return { url: twin.url, ...animGridFor(twin) };
  }
  return null;
}

/** The animated twin of a still definition (undefined when it has none). */
export function animatedTwinDef(def: PropDefinition | undefined): PropDefinition | undefined {
  if (!def || def.isAnimated || !def.animatedTwin) return undefined;
  return PROP_DEFINITIONS.find((d) => d.type === def.animatedTwin);
}

/** True when the prop has an animated sheet it can be swapped to (still twin or animated def). */
export function propHasAnimatedOption(prop: PlacedProp | undefined): boolean {
  if (!prop) return false;
  const def = PROP_DEFINITIONS.find((d) => d.type === prop.type);
  if (!def) return false;
  return def.isAnimated === true || animatedTwinDef(def) !== undefined;
}

/** Editable animation settings for one placed prop (see `setPropAnimation`). */
export interface AnimationSettings {
  animated?: boolean; // still props: use the animated twin sheet instead of the still art
  animate?: boolean; // play/pause frame cycling
  animSpeed?: number; // fps multiplier
  animFrames?: boolean[]; // per-frame enable flags
  animFrameDelays?: number[]; // per-frame hold delay in seconds (default 0)
}

/** Coerce a checkbox array to exactly `total` booleans (missing entries count as on). */
export function normalizeAnimFrames(frames: readonly boolean[] | undefined, total: number): boolean[] {
  const safeTotal = Math.max(1, Math.floor(total));
  const out: boolean[] = [];
  for (let i = 0; i < safeTotal; i += 1) out.push(frames ? frames[i] !== false : true);
  return out;
}

/** Coerce a delay array to exactly `total` non-negative numbers (in seconds, default 0). */
export function normalizeAnimFrameDelays(
  delays: readonly number[] | undefined,
  total: number,
): number[] {
  const safeTotal = Math.max(1, Math.floor(total));
  const out: number[] = [];
  for (let i = 0; i < safeTotal; i += 1) {
    const v = delays ? delays[i] : 0;
    out.push(
      typeof v === 'number' && Number.isFinite(v) && v > 0
        ? Math.max(0, Math.min(60, Math.round(v * 100) / 100))
        : 0,
    );
  }
  return out;
}

/**
 * UV origin of a frame in a row-major sheet (frame 0 = top-left).
 * THREE flipY puts v=1 at the image top, so row 0 sits at v = 1 - 1/rows.
 */
export function animFrameUV(frame: number, cols: number, rows: number): { u: number; v: number } {
  const c = Math.max(1, Math.floor(cols));
  const r = Math.max(1, Math.floor(rows));
  const f = ((Math.floor(frame) % (c * r)) + c * r) % (c * r);
  const col = f % c;
  const row = Math.floor(f / c);
  return { u: col / c, v: 1 - (row + 1) / r };
}

/** Stable 0..total-1 phase from a prop id so twin torches flicker out of sync. */
export function animPhaseFor(propId: string, total: number): number {
  if (!(total > 1)) return 0;
  let hash = 0;
  for (let i = 0; i < propId.length; i += 1) hash = (hash * 31 + propId.charCodeAt(i)) | 0;
  return Math.abs(hash) % total;
}

/**
 * T08: Extended PlacedProp with optional authoring fields.
 * Unknown fields are preserved during round-trip for forward compatibility.
 */
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
  width?: number; // T08: explicit width override (in world units)
  height?: number; // T08: explicit height override (in world units)
  depth?: number; // T08: explicit depth override (in world units)
  alignToTrack: boolean;
  trackDist?: number;
  cameraFacing?: boolean;
  flipX?: boolean;
  isDecal?: boolean;
  groupId?: string;
  lit?: boolean;
  visible?: boolean; // T08: visibility toggle (H key)
  animate?: boolean; // Animated category: frame playback on/off (default true)
  animated?: boolean; // Still props with a twin: swap in the animated sheet (default false)
  animSpeed?: number; // Playback speed multiplier (default 1, clamped 0.1..4)
  animFrames?: boolean[]; // Per-frame enable flags; unchecked frames are skipped (default all on)
  animFrameDelays?: number[]; // Per-frame hold delay in seconds (default 0)
  authoringNotes?: string; // T08: optional authoring metadata
  materialDesc?: MaterialDescriptor;
  roleConfig?: RoleConfig;
  customAssetId?: string;
  // Allow unknown fields for forward compatibility
  [key: string]: unknown;
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

  // --- T08: POWERUPS ---
  { type: 'powerup_speed_boost', name: 'Speed Boost Pickup', category: 'powerup', url: '/art/props/alpha/prop-03-tnt-powder-kegs.png', defaultWidth: 320, defaultHeight: 320, defaultDepth: 320, isPowerup: true },
  { type: 'powerup_shield', name: 'Shield Generator', category: 'powerup', url: '/art/props/alpha/prop-04-smelting-crucible.png', defaultWidth: 360, defaultHeight: 360, defaultDepth: 360, isPowerup: true },
  { type: 'powerup_missile', name: 'Missile Crate', category: 'powerup', url: '/art/props/alpha/prop-03-tnt-powder-kegs.png', defaultWidth: 340, defaultHeight: 340, defaultDepth: 340, isPowerup: true },
  { type: 'powerup_jump_pad', name: 'Jump Pad Platform', category: 'powerup', url: '/art/props/alpha/prop-20-goblin-springboard-platform.png', defaultWidth: 400, defaultHeight: 200, defaultDepth: 400, isPowerup: true },
  { type: 'powerup_repair_kit', name: 'Repair Kit', category: 'powerup', url: '/art/props/alpha/prop-07-tripod-cauldron-molten.png', defaultWidth: 300, defaultHeight: 300, defaultDepth: 300, isPowerup: true },

  // --- T08: BARRIERS ---
  { type: 'barrier_spike_wall', name: 'Spiked Barrier Wall', category: 'barrier', url: '/art/props/alpha/prop-29-spiked-boulder-barricade.png', defaultWidth: 800, defaultHeight: 600, defaultDepth: 200, isBarrier: true },
  { type: 'barrier_electric_fence', name: 'Electric Fence', category: 'barrier', url: '/art/props/alpha/prop-38-scrap-iron-barricade.png', defaultWidth: 1000, defaultHeight: 500, defaultDepth: 150, isBarrier: true },
  { type: 'barrier_fire_pit', name: 'Fire Pit Trap', category: 'barrier', url: '/art/props/alpha/prop-41-molten-slag-channel.png', defaultWidth: 600, defaultHeight: 400, defaultDepth: 600, isBarrier: true },
  { type: 'barrier_rock_slide', name: 'Rock Slide Zone', category: 'barrier', url: '/art/props/alpha/prop-35-granite-strata-seam-wall.png', defaultWidth: 1200, defaultHeight: 800, defaultDepth: 300, isBarrier: true },
  { type: 'barrier_mine_field', name: 'Mine Field', category: 'barrier', url: '/art/props/alpha/prop-02-ore-cart-spilling.png', defaultWidth: 500, defaultHeight: 300, defaultDepth: 500, isBarrier: true },

  // --- ANIMATED (4-frame 2x2 sheets; built by scripts/process-animated.mjs) ---
  { type: 'anim_01_torchbearer_flame', name: 'Torchbearer (Animated)', category: 'animated', url: '/art/animated/alpha/anim-01-torchbearer-flame.png', defaultWidth: 375, defaultHeight: 560, isAnimated: true, animCols: 2, animRows: 2, animFps: 7 },
  { type: 'anim_02_firework_sparkler', name: 'Firework Sparkler (Animated)', category: 'animated', url: '/art/animated/alpha/anim-02-firework-sparkler.png', defaultWidth: 1100, defaultHeight: 600, isAnimated: true, animCols: 2, animRows: 2, animFps: 9 },
  { type: 'anim_03_torch_crowd', name: 'Torch Crowd (Animated)', category: 'animated', url: '/art/animated/alpha/anim-03-torch-crowd.png', defaultWidth: 1075, defaultHeight: 600, isAnimated: true, animCols: 2, animRows: 2, animFps: 7 },
  { type: 'anim_04_lantern_warden', name: 'Lantern Warden (Animated)', category: 'animated', url: '/art/animated/alpha/anim-04-lantern-warden.png', defaultWidth: 375, defaultHeight: 560, isAnimated: true, animCols: 2, animRows: 2, animFps: 6 },
  { type: 'anim_05_smelting_crucible', name: 'Smelting Crucible (Animated)', category: 'animated', url: '/art/animated/alpha/anim-05-smelting-crucible.png', defaultWidth: 460, defaultHeight: 500, isAnimated: true, animCols: 2, animRows: 2, animFps: 6 },
  { type: 'anim_06_molten_cauldron', name: 'Molten Cauldron (Animated)', category: 'animated', url: '/art/animated/alpha/anim-06-molten-cauldron.png', defaultWidth: 480, defaultHeight: 520, isAnimated: true, animCols: 2, animRows: 2, animFps: 6 },
  { type: 'anim_07_slag_channel', name: 'Slag Channel (Animated)', category: 'animated', url: '/art/animated/alpha/anim-07-slag-channel.png', defaultWidth: 1100, defaultHeight: 600, isAnimated: true, animCols: 2, animRows: 2, animFps: 5 },
  { type: 'anim_08_waterwheel_cascade', name: 'Waterwheel Cascade (Animated)', category: 'animated', url: '/art/animated/alpha/anim-08-waterwheel-cascade.png', defaultWidth: 700, defaultHeight: 1400, isAnimated: true, animCols: 2, animRows: 2, animFps: 5 },
  { type: 'anim_09_plunge_basin', name: 'Plunge Basin (Animated)', category: 'animated', url: '/art/animated/alpha/anim-09-plunge-basin.png', defaultWidth: 1100, defaultHeight: 600, isAnimated: true, animCols: 2, animRows: 2, animFps: 5 },
  { type: 'anim_10_waterfall_curtain', name: 'Waterfall Curtain (Animated)', category: 'animated', url: '/art/animated/alpha/anim-10-waterfall-curtain.png', defaultWidth: 900, defaultHeight: 1400, isAnimated: true, animCols: 2, animRows: 2, animFps: 5 },
  { type: 'anim_11_tnt_fuse_spark', name: 'TNT Fuse Spark (Animated)', category: 'animated', url: '/art/animated/alpha/anim-11-tnt-fuse-spark.png', defaultWidth: 375, defaultHeight: 560, isAnimated: true, animCols: 2, animRows: 2, animFps: 9 },
  { type: 'anim_12_drum_podium_braziers', name: 'Drum Podium Braziers (Animated)', category: 'animated', url: '/art/animated/alpha/anim-12-drum-podium-braziers.png', defaultWidth: 1254, defaultHeight: 700, isAnimated: true, animCols: 2, animRows: 2, animFps: 7 },
  { type: 'anim_13_horn_riser_lantern', name: 'Horn Riser Lantern (Animated)', category: 'animated', url: '/art/animated/alpha/anim-13-horn-riser-lantern.png', defaultWidth: 1254, defaultHeight: 700, isAnimated: true, animCols: 2, animRows: 2, animFps: 6 },
  { type: 'anim_14_fan_aisle_torches', name: 'Fan Aisle Torches (Animated)', category: 'animated', url: '/art/animated/alpha/anim-14-fan-aisle-torches.png', defaultWidth: 1075, defaultHeight: 600, isAnimated: true, animCols: 2, animRows: 2, animFps: 7 },
  { type: 'anim_15_triple_lantern_post', name: 'Triple Lantern Post (Animated)', category: 'animated', url: '/art/animated/alpha/anim-15-triple-lantern-post.png', defaultWidth: 360, defaultHeight: 480, isAnimated: true, animCols: 2, animRows: 2, animFps: 6 },
  { type: 'anim_16_molten_rock_arch', name: 'Molten Rock Arch (Animated)', category: 'animated', url: '/art/animated/alpha/anim-16-molten-rock-arch.png', defaultWidth: 1400, defaultHeight: 760, isAnimated: true, animCols: 2, animRows: 2, animFps: 5 },
  { type: 'anim_17_arch_gate_lanterns', name: 'Arch Gate Lanterns (Animated)', category: 'animated', url: '/art/animated/alpha/anim-17-arch-gate-lanterns.png', defaultWidth: 1300, defaultHeight: 700, isAnimated: true, animCols: 2, animRows: 2, animFps: 6 },
  { type: 'anim_18_torch_sconce', name: 'Torch Sconce (Animated)', category: 'animated', url: '/art/animated/alpha/anim-18-torch-sconce.png', defaultWidth: 320, defaultHeight: 480, isAnimated: true, animCols: 2, animRows: 2, animFps: 7 },
  { type: 'anim_19_waterfall_splash', name: 'Waterfall Splash (Animated)', category: 'animated', url: '/art/animated/alpha/anim-19-waterfall-splash.png', defaultWidth: 650, defaultHeight: 450, isAnimated: true, animCols: 2, animRows: 2, animFps: 6 },
  { type: 'anim_20_waterfall_splash_b', name: 'Waterfall Splash B (Animated)', category: 'animated', url: '/art/animated/alpha/anim-20-waterfall-splash-b.png', defaultWidth: 650, defaultHeight: 450, isAnimated: true, animCols: 2, animRows: 2, animFps: 6 },
  { type: 'anim_21_flag_waver', name: 'Flag-Waving Fan (Animated)', category: 'animated', url: '/art/animated/alpha/anim-21-flag-waver.png', defaultWidth: 375, defaultHeight: 560, isAnimated: true, animCols: 2, animRows: 2, animFps: 8 },
  { type: 'anim_22_war_drummer', name: 'War Drummer (Animated)', category: 'animated', url: '/art/animated/alpha/anim-22-war-drummer.png', defaultWidth: 312, defaultHeight: 560, isAnimated: true, animCols: 2, animRows: 2, animFps: 9 },
  { type: 'anim_23_pit_mechanic', name: 'Pit Mechanic (Animated)', category: 'animated', url: '/art/animated/alpha/anim-23-pit-mechanic.png', defaultWidth: 375, defaultHeight: 560, isAnimated: true, animCols: 2, animRows: 2, animFps: 8 },
  { type: 'anim_24_ore_miner', name: 'Ore Miner (Animated)', category: 'animated', url: '/art/animated/alpha/anim-24-ore-miner.png', defaultWidth: 312, defaultHeight: 560, isAnimated: true, animCols: 2, animRows: 2, animFps: 6 },
  { type: 'anim_25_horn_blower', name: 'War Horn Blower (Animated)', category: 'animated', url: '/art/animated/alpha/anim-25-horn-blower.png', defaultWidth: 312, defaultHeight: 560, isAnimated: true, animCols: 2, animRows: 2, animFps: 6 },
  { type: 'anim_26_track_marshal', name: 'Track Marshal (Animated)', category: 'animated', url: '/art/animated/alpha/anim-26-track-marshal.png', defaultWidth: 312, defaultHeight: 560, isAnimated: true, animCols: 2, animRows: 2, animFps: 8 },
  { type: 'anim_27_blacksmith', name: 'Blacksmith (Animated)', category: 'animated', url: '/art/animated/alpha/anim-27-blacksmith.png', defaultWidth: 375, defaultHeight: 560, isAnimated: true, animCols: 2, animRows: 2, animFps: 9 },
  { type: 'anim_28_tankard_celebrant', name: 'Tankard Celebrant (Animated)', category: 'animated', url: '/art/animated/alpha/anim-28-tankard-celebrant.png', defaultWidth: 312, defaultHeight: 560, isAnimated: true, animCols: 2, animRows: 2, animFps: 6 },
  { type: 'anim_29_ball_loader', name: 'Ball Loader (Animated)', category: 'animated', url: '/art/animated/alpha/anim-29-ball-loader.png', defaultWidth: 375, defaultHeight: 560, isAnimated: true, animCols: 2, animRows: 2, animFps: 7 },
  { type: 'anim_30_bell_ringer', name: 'Bell Ringer (Animated)', category: 'animated', url: '/art/animated/alpha/anim-30-bell-ringer.png', defaultWidth: 312, defaultHeight: 560, isAnimated: true, animCols: 2, animRows: 2, animFps: 7 },
  { type: 'anim_31_scarf_fan', name: 'Scarf Fan (Animated)', category: 'animated', url: '/art/animated/alpha/anim-31-scarf-fan.png', defaultWidth: 340, defaultHeight: 560, isAnimated: true, animCols: 2, animRows: 2, animFps: 8 },
  { type: 'anim_32_track_sweeper', name: 'Track Sweeper (Animated)', category: 'animated', url: '/art/animated/alpha/anim-32-track-sweeper.png', defaultWidth: 360, defaultHeight: 560, isAnimated: true, animCols: 2, animRows: 2, animFps: 6 },
  { type: 'anim_33_rope_heave_trio', name: 'Rope Heave Trio (Animated)', category: 'animated', url: '/art/animated/alpha/anim-33-rope-heave-trio.png', defaultWidth: 400, defaultHeight: 560, isAnimated: true, animCols: 2, animRows: 2, animFps: 6 },
  { type: 'anim_34_shoulder_ride_duo', name: 'Shoulder Ride Duo (Animated)', category: 'animated', url: '/art/animated/alpha/anim-34-shoulder-ride-duo.png', defaultWidth: 420, defaultHeight: 560, isAnimated: true, animCols: 2, animRows: 2, animFps: 5 },
  { type: 'anim_35_tire_carry_duo', name: 'Tire Carry Duo (Animated)', category: 'animated', url: '/art/animated/alpha/anim-35-tire-carry-duo.png', defaultWidth: 440, defaultHeight: 560, isAnimated: true, animCols: 2, animRows: 2, animFps: 5 },
  { type: 'anim_36_victory_huddle', name: 'Victory Huddle (Animated)', category: 'animated', url: '/art/animated/alpha/anim-36-victory-huddle.png', defaultWidth: 400, defaultHeight: 560, isAnimated: true, animCols: 2, animRows: 2, animFps: 6 },
  { type: 'anim_37_grandstand_roar', name: 'Grandstand Roar (Animated)', category: 'animated', url: '/art/animated/alpha/anim-37-grandstand-roar.png', defaultWidth: 400, defaultHeight: 560, isAnimated: true, animCols: 2, animRows: 2, animFps: 8 },
  { type: 'anim_38_flag_terrace', name: 'Flag Terrace (Animated)', category: 'animated', url: '/art/animated/alpha/anim-38-flag-terrace.png', defaultWidth: 400, defaultHeight: 560, isAnimated: true, animCols: 2, animRows: 2, animFps: 6 },
  { type: 'anim_39_mosh_pit', name: 'Mosh Pit (Animated)', category: 'animated', url: '/art/animated/alpha/anim-39-mosh-pit.png', defaultWidth: 420, defaultHeight: 560, isAnimated: true, animCols: 2, animRows: 2, animFps: 9 },
  { type: 'anim_40_fence_fans', name: 'Fence Fans (Animated)', category: 'animated', url: '/art/animated/alpha/anim-40-fence-fans.png', defaultWidth: 400, defaultHeight: 560, isAnimated: true, animCols: 2, animRows: 2, animFps: 8 },
  { type: 'anim_41_cheer_tower', name: 'Cheer Tower (Animated)', category: 'animated', url: '/art/animated/alpha/anim-41-cheer-tower.png', defaultWidth: 400, defaultHeight: 560, isAnimated: true, animCols: 2, animRows: 2, animFps: 7 },
  { type: 'anim_42_victory_stage', name: 'Victory Stage (Animated)', category: 'animated', url: '/art/animated/alpha/anim-42-victory-stage.png', defaultWidth: 400, defaultHeight: 560, isAnimated: true, animCols: 2, animRows: 2, animFps: 7 },
  { type: 'anim_43_explosion_fire', name: 'Fire Explosion', category: 'animated', url: '/art/animated/alpha/anim-43-explosion-fire.png', defaultWidth: 480, defaultHeight: 480, isAnimated: true, animCols: 2, animRows: 2, animFps: 16 },
  { type: 'anim_44_spark_burst', name: 'Spark Burst', category: 'animated', url: '/art/animated/alpha/anim-44-spark-burst.png', defaultWidth: 420, defaultHeight: 420, isAnimated: true, animCols: 2, animRows: 2, animFps: 14 },
  { type: 'anim_45_smoke_puff', name: 'Smoke Puff', category: 'animated', url: '/art/animated/alpha/anim-45-smoke-puff.png', defaultWidth: 440, defaultHeight: 440, isAnimated: true, animCols: 2, animRows: 2, animFps: 10 },
  { type: 'anim_46_gore_burst', name: 'Gore Burst', category: 'animated', url: '/art/animated/alpha/anim-46-gore-burst.png', defaultWidth: 400, defaultHeight: 400, isAnimated: true, animCols: 2, animRows: 2, animFps: 14 },
  { type: 'anim_47_gore_green_burst', name: 'Green Gore Burst', category: 'animated', url: '/art/animated/alpha/anim-47-gore-green-burst.png', defaultWidth: 400, defaultHeight: 400, isAnimated: true, animCols: 2, animRows: 2, animFps: 14 },
  { type: 'anim_48_ground_impact', name: 'Ground Impact', category: 'animated', url: '/art/animated/alpha/anim-48-ground-impact.png', defaultWidth: 480, defaultHeight: 300, isAnimated: true, animCols: 2, animRows: 2, animFps: 14 },
  { type: 'anim_49_dust_puff', name: 'Dust Puff', category: 'animated', url: '/art/animated/alpha/anim-49-dust-puff.png', defaultWidth: 460, defaultHeight: 360, isAnimated: true, animCols: 2, animRows: 2, animFps: 10 },
  { type: 'anim_50_firework_red', name: 'Red Firework', category: 'animated', url: '/art/animated/alpha/anim-50-firework-red.png', defaultWidth: 460, defaultHeight: 460, isAnimated: true, animCols: 2, animRows: 2, animFps: 14 },
  { type: 'anim_51_firework_blue', name: 'Blue Firework', category: 'animated', url: '/art/animated/alpha/anim-51-firework-blue.png', defaultWidth: 460, defaultHeight: 460, isAnimated: true, animCols: 2, animRows: 2, animFps: 14 },
  { type: 'anim_52_firework_green', name: 'Green Firework', category: 'animated', url: '/art/animated/alpha/anim-52-firework-green.png', defaultWidth: 460, defaultHeight: 460, isAnimated: true, animCols: 2, animRows: 2, animFps: 14 },

  // --- SCENE KIT: primitives, lights, and the record type for edits to generated scenery ---
  ...PRIMITIVE_DEFINITIONS,
  ...LIGHT_DEFINITIONS,
  { type: 'terrain_edit', name: 'Scenery edit', category: 'scenery', url: 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" stroke="#f0b85e" stroke-width="2.5" stroke-linejoin="round"><path d="M6 50 22 24l10 14 8-10 18 22z"/></svg>'), defaultWidth: 100, defaultHeight: 100 },
];

/**
 * Source art every animated sheet was cut from. Mirrors the `src` field of
 * `ANIMATED_VARIATIONS` in `scripts/process-animated.mjs` — keep the two in
 * sync so still <-> animated twins stay wired to the art they share.
 *
 * `anim_20_waterfall_splash_b` is deliberately absent: its source
 * (`track-parts/waterfall-splash-b.png`) has no still decoration of its own,
 * so it stays an animated-only entry.
 */
export const ANIMATED_SOURCE_ART: Record<string, string> = {
  anim_01_torchbearer_flame: '/art/goblins/alpha/goblin-04-torchbearer.png',
  anim_02_firework_sparkler: '/art/goblins/alpha/goblin-18-firework-crew.png',
  anim_03_torch_crowd: '/art/goblins/alpha/goblin-24-torch-crowd.png',
  anim_04_lantern_warden: '/art/goblins/alpha/goblin-11-lantern-warden.png',
  anim_05_smelting_crucible: '/art/props/alpha/prop-04-smelting-crucible.png',
  anim_06_molten_cauldron: '/art/props/alpha/prop-07-tripod-cauldron-molten.png',
  anim_07_slag_channel: '/art/props/alpha/prop-41-molten-slag-channel.png',
  anim_08_waterwheel_cascade: '/art/props/alpha/prop-28-cavern-waterwheel-cascade.png',
  anim_09_plunge_basin: '/art/props/alpha/prop-42-waterfall-plunge-basin.png',
  anim_10_waterfall_curtain: '/art/track-parts/waterfall-curtain.png',
  anim_11_tnt_fuse_spark: '/art/goblins/alpha/goblin-07-tnt-handler.png',
  anim_12_drum_podium_braziers: '/art/goblins/alpha/goblin-22-drum-podium-mob.png',
  anim_13_horn_riser_lantern: '/art/goblins/alpha/goblin-25-horn-riser.png',
  anim_14_fan_aisle_torches: '/art/goblins/alpha/goblin-30-fan-aisle.png',
  anim_15_triple_lantern_post: '/art/props/alpha/prop-01-lantern-post-triple.png',
  anim_16_molten_rock_arch: '/art/props/alpha/prop-16-molten-rock-natural-arch.png',
  anim_17_arch_gate_lanterns: '/art/props/alpha/prop-40-timber-arch-gate-lanterns.png',
  anim_18_torch_sconce: '/art/props/alpha/prop-56-arch-torch-sconce.png',
  anim_19_waterfall_splash: '/art/track-parts/waterfall-splash.png',
  anim_21_flag_waver: '/art/goblins/alpha/goblin-01-flag-waver.png',
  anim_22_war_drummer: '/art/goblins/alpha/goblin-02-war-drummer.png',
  anim_23_pit_mechanic: '/art/goblins/alpha/goblin-03-pit-mechanic.png',
  anim_24_ore_miner: '/art/goblins/alpha/goblin-05-ore-miner.png',
  anim_25_horn_blower: '/art/goblins/alpha/goblin-06-horn-blower.png',
  anim_26_track_marshal: '/art/goblins/alpha/goblin-08-track-marshal.png',
  anim_27_blacksmith: '/art/goblins/alpha/goblin-09-blacksmith.png',
  anim_28_tankard_celebrant: '/art/goblins/alpha/goblin-10-tankard-celebrant.png',
  anim_29_ball_loader: '/art/goblins/alpha/goblin-12-ball-loader.png',
  anim_30_bell_ringer: '/art/goblins/alpha/goblin-13-bell-ringer.png',
  anim_31_scarf_fan: '/art/goblins/alpha/goblin-14-scarf-fan.png',
  anim_32_track_sweeper: '/art/goblins/alpha/goblin-15-track-sweeper.png',
  anim_33_rope_heave_trio: '/art/goblins/alpha/goblin-16-rope-heave-trio.png',
  anim_34_shoulder_ride_duo: '/art/goblins/alpha/goblin-17-shoulder-ride-duo.png',
  anim_35_tire_carry_duo: '/art/goblins/alpha/goblin-19-tire-carry-duo.png',
  anim_36_victory_huddle: '/art/goblins/alpha/goblin-20-victory-huddle.png',
  anim_37_grandstand_roar: '/art/goblins/alpha/goblin-21-grandstand-roar.png',
  anim_38_flag_terrace: '/art/goblins/alpha/goblin-23-flag-terrace.png',
  anim_39_mosh_pit: '/art/goblins/alpha/goblin-26-mosh-pit.png',
  anim_40_fence_fans: '/art/goblins/alpha/goblin-27-fence-fans.png',
  anim_41_cheer_tower: '/art/goblins/alpha/goblin-28-cheer-tower.png',
  anim_42_victory_stage: '/art/goblins/alpha/goblin-29-victory-stage.png',
};

/**
 * Wire every animated sheet to the still decoration it was cut from (and back).
 * Links are derived from shared art, so a still prop gains an "Animated"
 * toggle in the attribute window that swaps its sprite for the sheet.
 * Decorative definitions win over powerups/barriers that merely reuse the art.
 */
function linkAnimatedTwins(): void {
  for (const [animType, srcUrl] of Object.entries(ANIMATED_SOURCE_ART)) {
    const animDef = PROP_DEFINITIONS.find((d) => d.type === animType);
    if (!animDef) continue;
    const stillDef = PROP_DEFINITIONS.find(
      (d) =>
        d.type !== animType &&
        !d.isAnimated &&
        !d.isPowerup &&
        !d.isBarrier &&
        d.url === srcUrl,
    );
    if (!stillDef) continue;
    animDef.stillType = stillDef.type;
    stillDef.animatedTwin = animType;
  }
}

linkAnimatedTwins();

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
