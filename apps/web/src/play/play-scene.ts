// The first Play's 3D (SETMIX_PLAN Phase 2b): you walk the lab in first person; the gate is a two-sided doorway onto your
// plot; the planet is drawn at low resolution and post-processed by stage (black-and-white dither at stage 0, colour from
// stage 1, a wave between, sweeping out from your first machine); sync runs down while you are there.
//
// Two scenes, one walker. Crossing the gate's opening carries you (and the camera) from one gate's frame to the other's.
// Each frame the far side is drawn from a virtual camera into a texture, and the near side shows it in the opening.
import * as THREE from 'three';
import type { Kit, Overrides, PlacedPart } from '@hm/kitspec';
import { MACHINE_KITS } from './kit-machines';
import { CAPACITOR_BANK_KIT } from './kit-capacitor-bank';
import { GATE_KIT } from './kit-gate';
import { GATE_DAIS_KIT } from './kit-gate-dais';
import { STARGATE_KIT } from './kit-stargate';
import { withKitDefaults } from './kit-defaults';
import { nearestPingHit, pingPulse, pingSizeM, PING_VIOLET, type PingHit } from './ping';
import { buildKitPreset, type KitBuild } from './kit-build';
import type { SporeCreation } from '@hm/cartlab';
import { creatureGenomeById } from '@hm/creature';
import { buildSporeModel, preloadSporeCreation, sporeModelBinding } from '../studio/spore-model';
import { kitAudit } from '@hm/kitspec/audit';
import { gameVehicleKind, type MultiverseGamePresetSpec } from './game-presets';
// Plan 47 (Pillar 1): the driven rover's Sovereign Harness — vessel soul, Higher-Self bridge, somatic telemetry.
import { CAYLEY_PADE_OUT_LENGTH, StateIdx, type IHarnessTuning, type IVesselPreset } from '@hm/harness';
import { deriveRoverHarnessInput, stepRoverEscortHarness, type IRoverActuatorOutput } from '@hm/mobsim';
import { HARNESS_SHELF_PRESETS, decodeHarnessCartridgeCode, encodeHarnessCartridgeCode, toHarnessTuning, toVesselPreset, type IHarnessCartridgeSpec } from '@hm/cartlab';
import { computeHarnessHudViewModel, type IHarnessHudViewModel } from '../base/ui/harness-telemetry-hud';
import { CIRCUIT_CHECKPOINTS, gameCreatureIds, gameSpawn, gameStage } from './game-mode';
import { tickLights } from './light-material';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { Stage } from '@hm/fidelity';
import type { StageLook } from '../crafter/looks';
import { createWorld, PLANET_DIR, SUN, type Neighbour, type World } from '../crafter/world';
import { createPlume, type PlumeMode } from '@hm/plume';
import { GATE, GATE_DOME_RADIUS_M, KINDS, POWERED_DOME_RADIUS_M, WARN_LEVEL, inSafeDome, isWarnLevel, level as plotLevel, stage0IsDithered, type DomeSource, type Machine, type MachineKind, type PlotState } from '@hm/plotsim';
import { createPlotGround, type BoulderInfo, type PlotGround } from './plot-ground';
import { fx as sfx } from '../maker/feedback';
import { gameAudio } from '../audio/game-audio';
import * as kit from '@hm/labkit';
import { createLabRoom, GATE_AT, PLANET_TABLE_AT, POWER_OFF, POWER_ON, POWER_SECONDS, powerAt, preloadLabGenerated, ROOM, type LabRoom, type LabStationId } from './lab-room';
import { WAKE_SECONDS, wakeLift, type Power } from './lab-power';
import { preloadVista, VISTA_LEVEL, type WindowView } from './lab-vista';
import { createPlotHolo, type PlotHolo } from './plot-holo';
import { COLOUR_MARK_FRAGMENT, localMachineWaveAt, MARK_VERTEX, OPENING_FRAGMENT, OPENING_OFF_FRAGMENT, OPENING_OFF_VERTEX, OPENING_VERTEX, PIECE_HOLO_FRAGMENT, PIECE_HOLO_VERTEX, PLUME_GLOW_FRAGMENT, PLUME_GLOW_VERTEX, POST_FRAGMENT, QUAD_VERTEX, scanRingFadeAt, waveBandColourFor } from './portal-shaders';
import { CHEVRON_COUNT, applyEventHorizon, createEventHorizonMaterial, eventHorizonUniforms } from './event-horizon';
import { irisClosedForAccess } from './gate-logic';
import { MACHINE_FIELD, METRIC_COLOUR, stepSync, type PlayAvatar } from './quest';
import { disposeProp, FABRICATOR_PLUME, FABRICATOR_VENT, FEED_CUBES_FULL, feedCubeCount, feedCubeProgress, lineSpan, machinePlumeCount, machinePlumeCountOf, machinePlumeGravity, machinePlumeLook, machinePlumeLookOf, machinePlumeSpec, machinePlumeSteady, machineProp, PIXELS_OF, type MachineProp } from './machine-props';
import { RAM_CADENCE_RAD } from './kit-motion-specs';
import { activeLocomotion, locomotionChoice, locomotionSpeed, setLocomotionChoice } from './locomotion';
import { plotStargate, plotVehicleKit, plotVehicleWheel, setPlotEnvironment, clearPlotEnvironment } from './plot-kits';
import { STARGATE_APERTURE_R, STARGATE_RING_CENTRE_Y } from './kit-stargate';
import { vehicleKitSpec, SCOUT_WHEEL, HAULER_WHEEL } from './kit-vehicles';
import type { GateAccessMode } from '@hm/coopnet/gate-dialer';
import { warmLayeredMaterials, releaseLayeredEnv } from './layered-material';
import { beatPulse, evaluateBeatSyncedPlumeModulation } from '@hm/tooljuice';
import { evaluateHarmonicMachineChoir, type ActiveMachineEmitter, type MachineStemRole } from '@hm/musicbox';
import { applyScientistWindowFGate, createWindowFCoopSyncController, type WindowFCoopSyncController } from './window-f-lab-and-coop-hooks';
import { computeFightOverlayStrength, evaluateMoonAvatarLuminance, evaluateRoverCraterAndWallSafety, getTurretCornerCapParts, resolveTurretCornerMount } from './window-g-final-qa-hooks';
import { evaluateBlob47SubtileBlend, isVistaFlashAtPeak } from './window-h-autotile-and-scout-hooks';
import { createOrbitalFlightDirector, type OrbitalFlightDirector } from './window-i-orbital-flight-hooks';
import {
  createHorizonEnclaveDomes,
  type FourFloats,
  type HorizonEnclaveDomes3D,
  type PlanetTableHologram3D,
} from './planet-table-hologram';
import { beadSpeed, spanPoint, spanSag } from './brownout-visual';
import { castHeightfield, castSpheres, createRoverArmState, nearestHit, stepRoverArm, type CastSphere, type RoverArmState, type Vec3 as RoverVec3 } from './rover-camera';
import { createExposureState, createScanWave, exposureTargetLuminance, gateOrLabFactor, markScanWaveDone, scanFrame, stepExposure, suitCamMix, suitCamProfile, suitCamStrength, triggerScanWave, type ExposureState, type ScanWave, type SuitCamSetting } from './stage-look';
import { AVATAR_LIGHT_LAYER, createScientistInstance, scientistLevelFor, thirdPersonLightRig } from '../avatar/scientist/scientist-model';
import { ASTRO_SUIT_CREATURE_KIT, astroSuitBuildFor } from '../avatar/astro/astro-model';
import { socketMarkerGeometry, socketMarkerMaterial, socketMarkerOpacity } from './socket-markers';
import { outcropGeometry, outcropMaterial } from './outcrops';
import { loadScientistAnimations, type ClipName } from '../avatar/scientist/anims-loader';
import { createScientistAnimator, type OneShotKind, type ScientistAnimator } from '../avatar/scientist/animator';
import { loadRifleAnimations } from '../avatar/astro/rifle-clips';
import { createCompanionEntity, type CompanionEntity } from './companion';
import { barkLine, COMBAT_TUNING, FOCUS_ORDER_S, newCombatBrain, standDown, stepCombat, type CombatMob, type CombatMode, type CombatTuning, type CoverSide } from './companion-combat';
import type { PointOfInterest, ScoutCategory } from './companion-scout';
import { ARMORY_RAIL_POS } from './armory-rack';
import { GAME_SCREEN_KIT, GAME_SCREEN_SURFACE } from './kit-game-screen';
import { BRIDGE_PAD_DECK_TOP, BRIDGE_PAD_KIT, BRIDGE_PAD_SIZE } from './kit-bridge-pad';
import { handPose, viewPose } from './rifle-hold';
import { footprintSolids, navFor } from '../base/navgrid';
import { solveLeftArmForegripIk } from '../avatar/two-bone-ik';
import { slopeLiftAt } from './beam-visuals';
import { BEAM_START, BEAM_STROKE_RANGE, STROKE_RADIUS, strokeOf, type SculptTool } from './beam-tool';
import { keepOutZones, type KeepOutZone } from './beam-keepout';
import { createBeamVisuals, ringColourOf, type BeamVisuals } from './beam-visuals';
import { FEEL_START, feelStep, type RifleFeelState } from './rifle-feel';
import { applyRimFloor, setRimFloorOn, rimFloorOn } from './rim-floor';
import { createMonsters, type MonstersSystem } from './monsters';
import { createWrecks, type WreckSystem } from './wrecks';
import { type WreckInteraction } from './wreck-sites';
import { boostedInput, tireTracks, wheelRoost, printGantry, type TireTracks, type WheelRoost, type PrintGantry } from './vehicle-juice';
import { beamDamage, SEAL_REACH } from './monster-rules';
import { clutterById } from './lab-clutter';
import { safeZones as monsterSafeZones } from '../monsters/policy';
import { pieceAt } from '../base/world';
import * as F from '@hm/substrate';
import * as S from '@hm/structure';
import type { Kind } from '@hm/structure';
import { globalKitPieceCache, type Box } from '../base/kit-pieces';
import { beamEffect, createMaterials, extractionBeam, type BeamFx, type BeamMode, type BeamTool } from '@hm/beamkit';
import { BEAM_RANGE } from '../base/world';
import type { WalkWorld } from '../base/walk';
import { computeGateExitPose, pushCircle, pushCircleInFrame } from './static-colliders';
import { machineFootprint } from '../base/machine-footprints';
import { createPlotBiomeView, type PlotBiomeView, type BiomeInstanceCount, type TreeHit, type TreeVariantSpec } from './plot-biome-view';
import { buildBiomeInput, type BiomeInput } from './biome-input';
import { makeCoverTextures } from '@hm/groundshader';
import { bakePlotBiome } from '@hm/plotbiome';
import { flood, type Terrain as HydroTerrain, type Source as HydroSource } from '@hm/hydro';
import { buildWaterSurfaces } from './water-surfaces';
import { spawn as spawnRover, step as stepRover, speed as roverSpeed, ROVERS, DT as ROVER_DT, type RoverState, type RoverKind } from '@hm/rover';
import {
  createMaterials as createRovergearMaterials,
  setLamp as setRoverLamp,
  type Station as FabricatorStationMesh,
} from '@hm/rovergear';
import {
  createGenFabricator,
  genLevelForStage,
} from '../assets/gen-props';
import { genLevelFor } from '../assets/gen';
// ---- TICKET-13 Window C imports: the perimeter turret (its parts, its safe domes and its grid draw)
import { cachedTurretPart, createTurretInstance3D, loadMissingTurretParts, turretSolidBoxes, type TurretInstance3D } from './turret-view';
import { gateDome as turretGateDome, poweredPylonDomes, type TurretSolidBox } from '@hm/plotsim';
import { turretGridDrawKw } from '../base/world';
import { RIFT_LAYER, riftDepthUniforms } from './rift';
// ---- Window B (TICKET-11, co-op): the other players' avatars, the room's sculpt, and the gate's pose for the room
import { createRemotePeersController, type RemotePeersController } from './remote-peers';
import { currentOutpostSession } from '../net/outpost-session';
import { PAINT_CELL, PAINT_CELLS } from '../base/plot-height';
import { emptyField, encodeField } from '@hm/terrainbrush';
import { createVerticalJumpState, stepVerticalJump } from '@hm/kinematic';
import { aimKit, vehicleTargetable, type KitTarget, type KitTargetable, type VehicleTargetable } from './kit-target';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { earthEndgameState, type EndgameInput, type EndgameState } from './earth-endgame';

export type Where = 'lab' | 'planet';
/** What the screen gives the scene each frame. */
export interface Controls {
  /** Walk: x right, z forward, each -1..1. */
  readonly move: { readonly x: number; readonly z: number };
  /** Look: mouse movement since the last frame, in pixels. */
  readonly look: { readonly dx: number; readonly dy: number };
  readonly run: boolean;
  /** On-foot jump (Spacebar). */
  readonly jump?: boolean;
  /** Build camera controls (Alt held) */
  readonly altCam?: boolean;
  readonly flyUp?: number;
  readonly vehicleInput?: { throttle: number; steer: number; brake: boolean; boost?: boolean };
}
export type LabMachineKind = LabStationId | 'rack' | 'bench' | 'combiner';

/** What the scene tells the screen each frame. */
export interface FrameOut {
  readonly where: Where;
  readonly sync: number;
  /** You are looking at the main lever, close enough to pull it. */
  readonly atLever: boolean;
  /** You are looking at the console while the gate is on, close enough to dial a plot. */
  readonly atDial: boolean;
  /** Approaching the quantum gate / plinth. */
  readonly atGate: boolean;
  /** Looking at the west power wall. */
  readonly aimedPowerWall: boolean;
  /** Looking at the north observation window. */
  readonly aimedWindow: boolean;
  /** The build ghost's verdict, when building. */
  readonly ghost: { readonly ok: boolean; readonly why: string } | null;
  /** The machine you are looking at, close enough to use (its plot id), when not building. */
  readonly aimed: number | null;
  /** The boulder with ore you are looking at, close enough to gather from. */
  readonly aimedBoulder: number | null;
  /** The lab machine you are looking at, close enough to use. */
  readonly aimedLab: LabMachineKind | null;
  /** The lab clutter or wreck transponder you are looking at, close enough (TASK-23c): its id, and whether it is a salvage prop (hold E). */
  readonly aimedProp: { readonly id: string; readonly salvage: boolean } | null;
  /** The stage the picture shows (a wave brings the next one across the plot). */
  readonly stage: number;
  /** Something happened this frame ('stage-up': a wave has finished bringing `stage`; 'to-earth'/'to-moon': the gate crossed worlds). */
  readonly event: 'to-planet' | 'to-lab' | 'to-earth' | 'to-moon' | 'sync-lost' | 'powered' | 'stage-up' | null;
  /** You stand inside a safe dome (the gate's, a powered pylon's or the shelter's): sync holds and refills (TASK-26). */
  readonly inDome: boolean;
  /** Sync is at or below 30% outside a dome: the return arrow shows in the compass (TASK-26). */
  readonly warn: boolean;
  readonly drivingVehicle?: {
    readonly id: number; readonly kind: RoverKind; readonly speed: number;
    readonly boostEnergy?: number; readonly boosting?: boolean;
    /** World-frame velocity and heading, for the drift badge (plan 47). */
    readonly vx?: number; readonly vz?: number; readonly yaw?: number;
    /** The Sovereign Harness telemetry blade's view-model (plan 47, Pillar 2). */
    readonly harness?: IHarnessHudViewModel | null;
  } | null;
}

/** What the display governor and Settings change while you play: how the machines' pixels are drawn, and the ground's triangles. */
export interface Detail {
  readonly plumes: PlumeMode; readonly plumeDensity: number; readonly groundBudget: number;
  /** The most lines the planet is drawn at (the later stages' resolution is capped on the light tiers). */
  readonly planetLines: number;
  /** A soft coloured glow on the ground under each pouring machine. */
  readonly plumeGlow: boolean;
  /** Pouring pixels cast dynamic light on their surroundings (Ultra only). */
  readonly pixelLights: boolean;
  /** What the lab window shows (full: the 3D wasteland; lite: fewer parts; static: the flat storm picture). */
  readonly windowView: WindowView;
  /** The suit cam's optics (the Graphics setting), and whether this GPU tier can afford them on Auto (Medium up). */
  readonly suitCam: SuitCamSetting;
  readonly suitCamTier: boolean;
}

const EYE = 1.68, RADIUS = 0.3; // walk and sprint speed come from the locomotion preset in force (plan 43, loc:)
/**
 * Astro's suit on the planet (TASK-21c): its metal is capped (the baked metal map is up to 1, and metal with no reflection is
 * black), and it reflects the lab's room light (`roomEnvMap`). Only the character takes it: the planet's own look does not change.
 */
const SUIT_METAL_CAP = 0.6;
const SUIT_PLANET_ENV = 1.8;
/** The room's reflection on the rifle in the hand (third person). */
const RIFLE_HAND_ENV = 1.2;
/** The room's reflection on kit-built machines on the planet (plan 41: their metal is the material's own, not capped). */
const PLOT_KIT_ENV = 1.2;
/**
 * Each stage's look (the stages raise the resolution of one natural world): how many lines tall the planet is drawn, its colour
 * levels (0 = all) and stage 0's black-and-white dither. Stage 1 is about 240 lines, like a 1990s 3D game, whatever the screen; a
 * look's pixels are whole screen pixels, so the grid never shimmers. The planet's picture is drawn at a whole fraction of the screen,
 * as fine as the finest look shown and never coarser than stage 1.
 */
const STAGE_LOOK: readonly { readonly lines: number; readonly levels: number; readonly dither: boolean }[] = [
  { lines: 120, levels: 0, dither: true }, { lines: 240, levels: 10, dither: false }, { lines: 360, levels: 16, dither: false }, { lines: 480, levels: 28, dither: false },
  { lines: 720, levels: 0, dither: false }, { lines: 1080, levels: 0, dither: false }, { lines: 1e5, levels: 0, dither: false },
];
const BASE_LINES = 240;
/**
 * The wave never pops (owner, 2026-10-07: "the hill and the sky popped"): its front crosses your plot at a walk-and-a-half, then
 * races out ever faster over the plains and the neighbours to the horizon (the ground ends about 4.5 km from the gate), then climbs
 * the sky from the horizon to the zenith. Metres from the wave's centre, t seconds after it starts.
 */
const waveFront = (t: number): number => 25 * t + 4 * (Math.exp(0.6 * t) - 1);
const GROUND_REACH = 4800, SKY_SECONDS = 3.2;
/** When the front reaches the horizon (about 11.6 s). */
const GROUND_SECONDS = ((): number => { let lo = 0, hi = 60; for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (waveFront(m) < GROUND_REACH) lo = m; else hi = m; } return hi; })();
/** The pixels that race the front go no further than this (beyond it they would be a blur too small to see). */
const RACER_REACH = 300;
/** The planet's wind for the plumes: from the west-south-west, enough to lean a pour about 3 m downwind by the top. */
const WIND = { x: 0.94, z: 0.35, speed: 3.3 };
/** Each machine's pour now comes from its own kind's look and count (machine-props.ts, ARGO_NOTE_08). */
/** Most machines the feed hoppers draw at once (one instanced draw for every hopper's cubes). */
const MAX_FEED_MACHINES = 48;
/** Base fabricators with a print head to drop ore on (ARGO_NOTE_16 ruling 3): their cubes share the feed mesh after the machines'. */
const MAX_FEED_FABRICATORS = 8;

export interface PlayScene {
  /** Rung 5 configures this same renderer, camera, rig, and physics after the ordinary loading pipeline. */
  startGamePreset(): void;
  loadSporeCreation(creation: Exclude<SporeCreation, { readonly kind: 'game' }>, isCurrent?: () => boolean): Promise<void>;
  visibleCreatureIds(): readonly number[];
  setCircuitCheckpoint(index: number): void;
  /** Puts the planet in place (once, after its looks are baked). */
  setPlanet(base: StageLook, lookFor: (stage: Stage) => StageLook, neighbours: readonly Neighbour[]): void;
  /** The saved state, applied at once: the gate on or off, the plot's machines standing (already running), its stage. */
  restore(o: { readonly gateOn: boolean; readonly plot: PlotState; readonly running: ReadonlyMap<number, number>; readonly connected: ReadonlySet<number> }): void;
  /** The plot as it is now: machines built or removed appear or go (with their cables), running ones pour their pixels. */
  /** The plot, each machine's run (0..1, already at the grid's satisfaction), the wired machines, and the grid's satisfaction (TASK-26: the pulse beads). */
  setPlot(plot: PlotState, running: ReadonlyMap<number, number>, connected: ReadonlySet<number>, satisfaction?: number): void;
  /** Ore in the ground at x, z, 0..1 (rock and scree rich, dust poor): the drills' richness. */
  richness(x: number, z: number): number;
  /** Throws the main lever: the power-on sequence runs, then a 'powered' event. */
  pullLever(): void;
  /** Shows the build ghost of a machine (null hides it), on the planet; `check` says whether it may stand where it is aimed. */
  setBuilding(kind: MachineKind | null, check?: (x: number, z: number) => { readonly ok: boolean; readonly why: string }): void;
  /** The hologram lock (TASK-25, P2-UI-06): H freezes the ghost on the ground where it is, so the player can walk round it. */
  lockGhost(): boolean;
  releaseGhost(): void;
  /** Moves a locked ghost by (dx, dz) metres on the ground (the arrow keys nudge it 0.5 m). */
  nudgeGhost(dx: number, dz: number): void;
  ghostLocked(): boolean;
  /** Where the ghost stands, facing the gate, if it may stand there. */
  aim(): { readonly x: number; readonly z: number; readonly yaw: number } | null;
  /** Generic ghost for base building pieces. */
  setPieceGhost(group: THREE.Group | null): void;
  placePieceGhost(pose: { readonly x: number; readonly y: number; readonly z: number; readonly yaw: number } | null, tint: 'grounded' | 'ok' | 'weak' | 'bad'): void;
  /** Placed base pieces group for aim raycasting. */
  setPieces(group: THREE.Group | null): void;
  /** Sets the base structure for ground navigation and mob pathfinding. */
  setBase(base: S.Base | null): void;
  setWalkWorld(walkWorld: WalkWorld | null): void;
  /** The moon arrival pose (GATE-05): `dist` metres out from the Twin Gate's back (default 3), facing away from the gate. */
  gateExit(dist?: number): { readonly x: number; readonly z: number; readonly yaw: number };
  /** Plan 57 §14: the simulation start has no lab to refill your sync in, so it holds full (no drain, no recall). */
  setSyncHeld(held: boolean): void;
  /**
   * JOB-09: stand the traveller in an arrival sector (the Earth plot's pad, or home). The sector comes from
   * `earth-endgame.ts`'s `arrivalSector`, so the pose the player lands on is the one the gate dialer resolved.
   */
  gateArrival(sector: { readonly x: number; readonly y: number; readonly z: number; readonly yaw: number }): void;
  /**
   * Stands the plot's Gate where the world says it is (plan 42 section 4.3's `moveGate`): the twin's frame, its footing,
   * the arrival pad and the ground's keep-out all follow, so the pad a traveller lands on is the pad in front of the ring.
   */
  setPlotGate(pose: { readonly x: number; readonly y: number; readonly z: number; readonly yaw: number }): void;
  /** Sets the plot gate's iris (plan 42's `setGateAccess`): open shows the aperture, code-only and closed draw the shield. */
  setGateAccess(access: GateAccessMode): void;
  /**
   * The plot's species palette (plan 42's `PlotBiomePreset`, six slots): the trees the biome scatters grow as these
   * presets, picked by place. Returns how many slots took.
   */
  setSpeciesSlots(slots: readonly { readonly species: 'pine' | 'oak' | 'birch'; readonly params: Readonly<Record<string, number>> }[]): number;
  setSocketRings(poses: readonly { readonly x: number; readonly y: number; readonly z: number; readonly yaw: number }[]): void;
  setPlanGhosts(ghosts: readonly { readonly kind: Kind; readonly at: { readonly x: number; readonly y: number; readonly z: number }; readonly yaw: number }[]): void;
  setSheltered(sheltered: boolean): void;
  /** The starter shelter's centre on the planet, for its 15 m safe dome (TASK-26); null until the shelter stands. */
  setShelterDome(at: { readonly x: number; readonly z: number } | null): void;
  isSheltered(): boolean;
  heightAt(x: number, z: number): number;
  aimPoint(): { readonly x: number; readonly y: number; readonly z: number; readonly yaw: number; readonly normal: { readonly x: number; readonly y: number; readonly z: number }; readonly piece: number | null } | null;
  /** Sets or updates the field's anomaly node instanced markers. Rebuilds instances only when field updates. */
  setNodes(field: F.Field | null): void;
  /** Finds the anomaly node aimed at within reach (metres). */
  aimNode(field: F.Field | null, reach?: number): F.Node | null;
  /** Sets the extraction beam VFX state. */
  setBeam(from: { readonly x: number; readonly y: number; readonly z: number } | null, to: { readonly x: number; readonly y: number; readonly z: number } | null, mode: BeamMode, colour: string, on: boolean): void;
  /** Returns the world position of the extraction tool muzzle. */
  beamMuzzle(): { readonly x: number; readonly y: number; readonly z: number };
  /** The plot reached a stage: a wave from `from` (ground x, z) brings its look across the plot, out to the horizon and up the sky. */
  raiseStage(to: number, from: { readonly x: number; readonly z: number }): void;
  frame(now: number, dt: number, c: Controls): FrameOut;
  resize(width: number, height: number, pixelRatio: number): void;
  /** The live detail (the display governor's tier, with your own Settings on top). */
  setDetail(d: Detail): void;
  /** Whether the build drawer or a placement is open: the suit cam's optics halve while it is (plan 25). */
  setBuildOpen(open: boolean): void;
  /** Activity of the lab machines (bench writing, combiner mixing, rack cataloguing) for the lab plume. */
  setLabActivity(act: { readonly bench: number; readonly combiner: number; readonly rack: number; readonly fabricator?: number }): void;
  /** TICKET-15 (Window D): [V] Key Turbo Bass pulse + swarmer knockback. */
  triggerTurboBass(radiusM?: number, pushM?: number): number;
  /** TICKET-15: Collect cassette tape from a wreck transponder. */
  collectWreckTape(id: string): string | null;
  /** Shows or hides the held extraction rifle (the first-person view model) and sets its mode's screen. */
  setBeamHeld(held: boolean, mode: BeamMode): void;
  /** The held rifle's lamps and muzzle while the beam fires (on) or idles. */
  setBeamFiring(on: boolean): void;
  /** Whether the left button aims the held rifle (its aiming idle in the character's hands). */
  setBeamAiming(on: boolean): void;
  /** Sets first person (body hidden) or third person over the shoulder. */
  setCameraView(mode: 'first' | 'third'): void;
  getCameraView(): 'first' | 'third';
  /** Plays a scientist one-shot animation action (lever, button, plant, cheer, wave, point). */
  playAction(kind: OneShotKind): void;
  /** Updates the scientist avatar appearance. */
  setAvatar(avatar: PlayAvatar | null): void;
  /** Gathers ore from a boulder. */
  gatherBoulder(id: number, amount: number): number;
  /** The boulder with ore the view ray meets within `maxDist` metres (the held rifle's reach), or null. */
  aimBoulder(maxDist: number): number | null;
  /** The held rifle takes ore from boulder `id` for `dt` seconds; returns the ore taken and the boulder's centre (null if none). */
  beamGatherBoulder(id: number, dt: number): { readonly mined: number; readonly x: number; readonly y: number; readonly z: number } | null;
  /** The ground point the view ray meets within `reach` metres (the held rifle's aim point), or null. */
  beamAim(reach: number): { readonly x: number; readonly y: number; readonly z: number } | null;
  /** The held rifle paints the loaded preset on the ground under (x, z) for `dt` seconds (no ore); returns the cells changed. */
  beamPaint(x: number, z: number, preset: string, dt: number): number;
  /** The loaded cartridge's colour in the rifle's port (null: empty). */
  setBeamCartridge(colour: string | null): void;
  /** The sculpt stroke (TASK-21d): carve, raise or smooth at (x, z) for dt seconds, with the ore the player holds. Returns the ore after it and the cells cut. */
  beamSculpt(x: number, z: number, tool: SculptTool, dt: number, ore: number): { readonly ore: number; readonly cells: number; readonly gained: number };
  /** The zones the sculpt beam keeps out (the gate's apron, the structures, the machines); the play screen sets them as the base changes. */
  setBeamKeepOut(zones: readonly KeepOutZone[]): void;
  /** The sculpt edits and the paint as text, for the save (empty before the plot is made). */
  beamFieldText(): string;
  // ---- Window B (TICKET-11, co-op)
  /** The room's sculpt replaces this plot's (encodeField text; '' is the plot as made). Held until the plot is made. */
  importBeamField(text: string): void;
  /** Whether the plot is made, so beamFieldText is the plot's own sculpt. */
  beamFieldReady(): boolean;
  /** The Moon Twin Gate's pose on the plot (x, z in metres, yaw in radians): the footing pad's place (POL-112). */
  gatePose(): { readonly x: number; readonly z: number; readonly yaw: number };
  /** This player's pose for the room: the ground under their feet and the suit's facing (the yaw + PI the suit is drawn at). Null in the lab. */
  playerPose(): { readonly x: number; readonly y: number; readonly z: number; readonly yaw: number } | null;
  /** Seal (TASK-21d): while on, the rifle's rib and the ground ring show Seal's amber. TASK-23b-2 calls it at a leak; nothing here seals. */
  setBeamSealing(on: boolean): void;
  /** Whether the player is currently near water on the planet (TASK-29 / T09b). */
  isNearWater(): boolean;
  /** POL-301: Stage 0a wireframe post-pass look override (true = wireframe, false = normal, null = auto). */
  setWireframeLook(enabled: boolean | null): void;
  /** POL-304: Controls visibility of the first-person held weapon viewmodel. */
  setViewModelVisible(visible: boolean): void;
  /** POL-302: sets storm progress (0..1) on the lab room observation window. */
  setStorm(progress: number): void;
  /** POL-302: sets the old monitor equaliser active or direct bar levels. */
  setMonitorEqualizer(bars?: readonly number[] | boolean): void;
  /** POL-302: exposes the lab room methods. */
  readonly room?: {
    setStorm(progress: number): void;
    setMonitorEqualizer(bars?: readonly number[] | boolean): void;
    setWindowView(view: WindowView): void;
  };
  setConsensusCommitted(committed: boolean): void;
  isConsensusCommitted(): boolean;
  /** Window E #1: returns the 11 horizon enclave domes instance. */
  getHorizonDomes(): HorizonEnclaveDomes3D;
  /**
   * Compiles every shader the frames will need, for each place it draws, behind the loading bar: a compile mid-play is a hitch the
   * display governor would read as a slow machine (and the owner's rule is never to start a screen choppy).
   */
  warm(): void;
  /** Loads the lab's generated models (behind the loading bar) and puts them in the lab in place of the labkit fallbacks. */
  preloadLabGenerated(): Promise<void>;
  /** The monsters on the planet: the leaks, the guns, the seal (play/monsters.ts). */
  readonly monsters: MonstersSystem;
  /** The props in the world (TASK-23c): the cleared clutter goes at once, and the sealed leaks' wrecks stand restored (from the save). */
  setProps(o: { readonly cleared: readonly string[]; readonly sealed: readonly number[] }): void;
  /** Starts a salvage prop's dissolve in the lab; false when it is not standing (a fixture, or cleared already). */
  dissolveClutter(id: string): boolean;
  /** A leak was sealed: its wreck goes up a rung on the junk-model ladder. */
  sealWreck(site: number): void;
  /** Loads the wreck models at every level, behind the loading bar. */
  preloadWrecks(): Promise<void>;
  /** Whether the player is alive (the monsters do not strike the dead). The screen sets it from the health. */
  setPlayerAlive(alive: boolean): void;
  /** The ray the view looks along, on the ground (x and z), and the eye's ground point. */
  aimGround(): { origin: { x: number; z: number }; dir: { x: number; z: number } };
  /** Advances the monsters by whole seconds (the tests' clock). */
  stepMonsters(seconds: number): void;
  /** The leak the view is aimed at, within `range` m, or null (the beam's Seal hold). */
  aimLeak(range: number): number | null;
  /**
   * TICKET-32: the kit part the view is aimed at within `reach` m (its kit, path and generator), or null: the lab's kits,
   * or on the plot a kit-built machine (its kit id is `plot:<machine id>@<built>`).
   */
  aimKitPart(reach: number): { readonly kit: string; readonly path: string; readonly gen: string | null } | null;
  /**
   * Plan 49: what the crosshair is on within `reach` m — a kit part (with its part and material), a base piece, the lab's
   * shell or a prop, a boulder or the ground — the nearest of them, or null when the ray meets nothing.
   */
  pingTarget(reach: number): { readonly hit: PingHit; readonly where: Where } | null;
  /** Plan 49: drops the violet ping reticle on a hit (one at a time: a new ping replaces the old). */
  showPing(hit: PingHit): void;
  /**
   * Plan 50: the drone's standing combat orders. `focus` takes a monster id, the nearest or the biggest (for 60 s), or
   * null to drop it. Returns what the drone says about it ('' when there is nothing to say).
   */
  companionOrders(patch: { readonly mode?: CombatMode; readonly cover?: CoverSide; readonly focus?: number | 'nearest' | 'biggest' | null }): string;
  /** Plan 50 test seam: the fast brain's orders, target, clock and the monsters it sees. */
  companionCombat(): { readonly orders: import('./companion-combat').CombatOrders | null; readonly targetId: number | null; readonly t: number; readonly mobs: readonly CombatMob[] };
  /** Plan 50: a monster hit the player (it counts double in the drone's threat score for a few seconds). */
  noteCompanionHurtBy(mobId: number): void;
  /** Plan 50: the drone's barks since the last call (contact, target down, area clear), for the radio. */
  drainCompanionBarks(): string[];
  /** Plan 56 W6a: the drone's combat events since the last call (contact, target down, area clear), for its memory. */
  drainCombatEvents(): import('./companion-combat').CombatEvent[];
  /** Plan 56 W6c: how the drone's memory shows in its body (a stuttering fire rhythm, a sway off station); null steadies it. */
  setCompanionSymptoms(s: { gapFactor(step: number): number; sway(step: number): { readonly x: number; readonly z: number } } | null): void;
  /** Plan 56 W6c test seam: the symptoms the drone's fight would carry at a step. */
  companionSymptomsAt(step: number): { readonly gapFactor: number; readonly sway: { readonly x: number; readonly z: number } };
  /** Plan 51: retunes the drone's combat brain (a mimicked fire pattern's bursts); null restores the research's numbers. */
  setCompanionTuning(patch: Partial<CombatTuning> | null): void;
  /** The drone's fire rhythm now (a live mimic changes it). */
  companionTuning(): CombatTuning;
  /** Plan 51 wave 3 reflex: the drone fires at double rate for this long (a longer hold wins over a shorter one; 0 ends it). */
  companionOverclock(seconds: number): void;
  companionOverclockLeft(): number;
  /** Plan 51 wave 3 reflex: a zap chained through up to `links` monsters near the drone; how many it hit. */
  companionArc(links: number): number;
  /** Plan 50: everything of one category the drone can find in the current world. */
  pointsOfInterest(category: ScoutCategory): PointOfInterest[];
  /** Plan 50 §6: stands a screen 4.5 m ahead mirroring a linked window (another game), or takes it down with null. */
  showGameScreen(video: HTMLVideoElement | null): boolean;
  /** Plan 53: stands the bridge pad on the flattest spot `distance` m from the gate (or takes it down); where its deck is. */
  showBridgePad(on: boolean, distance?: number): { readonly x: number; readonly y: number; readonly z: number } | null;
  bridgePadAt(): { readonly x: number; readonly y: number; readonly z: number } | null;
  gameScreenShown(): boolean;
  /** The canvas the world is drawn on (the AI's eyes sample it, plan 50). */
  viewCanvas(): HTMLCanvasElement;
  /** Plan 49: the ping marker's state for tests: its age in seconds, or null when none shows. */
  pingMarkerAge(): number | null;
  /** Plan 49: the key a kit's shipped defaults are stored under ('machine:<kind>' for a plot machine), or null when it has none. */
  kitDefaultKey(kit: string): string | null;
  /** Plan 49: the kit definition behind a kit id (for planning a mutation), or null. */
  kitOf(kit: string): Kit | null;
  /** Rebuilds a lab kit with the beam's per-part overrides; false while its parts are not loaded yet. */
  setKitOverrides(kit: string, overrides: Overrides): boolean;
  /** Hangs a sprite cartridge's baked turntable over a machine as a billboard card, or takes it down with null. */
  setSpriteCard(
    kit: string,
    card: { readonly rgba: Uint8Array; readonly width: number; readonly height: number; readonly frames: number; readonly fps: number; readonly sizeM: number } | null,
  ): boolean;
  /** The card hanging over a machine: its frame count and cadence, or null. */
  spriteCardOf(kit: string): { readonly frames: number; readonly fps: number } | null;
  /** A lab kit's placed parts as last built. */
  kitPlaced(kit: string): readonly PlacedPart[];
  /** Rebuilds every machine on the plot (the debug switch for the kit frames). */
  rebuildMachines(): void;
  /** Plan 39 (Aq): the tree the view is aimed at within `reach` m on the plot (its place, kind and species), or null. */
  aimTree(reach: number): TreeHit | null;
  /** The beam's regrown trees, by place key; kept until the plot's biome is built, then re-applied on every rebuild. */
  setTreeOverrides(overrides: Readonly<Record<string, TreeVariantSpec>>): number;
  /** The shown trees of the same kind as the tree at `place` within `radiusM` of it (a hold of the beam). */
  treesLike(place: string, radiusM: number): string[];
  /** Immediately sets the world and mob visual fidelity stage (0 to 6). */
  setFidelityStage(stage: number): void;
  setVehicles(vehicles: readonly { readonly id: number; readonly kind: RoverKind; readonly x: number; readonly z: number; readonly yaw: number }[]): void;
  setFabricators(fabricators: readonly { readonly id: number; readonly x: number; readonly z: number; readonly yaw: number; readonly printing: boolean }[]): void;
  enterVehicle(id: number): boolean;
  exitVehicle(): { readonly id: number; readonly x: number; readonly z: number; readonly yaw: number } | null;
  /** Binds a `harness:`/`harnessc:` cartridge ref to the vehicle soul (null restores the default). False: the ref does not decode. */
  setVehicleHarness(ref: string | null): boolean;
  /** The vehicle soul's harness as a `harnessc:` code (what an undo puts back). */
  vehicleHarnessCode(): string;
  getDrivingVehicle(): { readonly id: number; readonly kind: RoverKind; readonly speed: number; readonly boostEnergy?: number; readonly boosting?: boolean } | null;
  getNearVehicle(reach?: number): { readonly id: number; readonly kind: RoverKind } | null;
  /** Returns the active in-game AI companion entity, if loaded. */
  getCompanion(): CompanionEntity | null;
  /** POL-96: marks the sidearm on the armory rail taken or standing. */
  setSidearmTaken(taken: boolean): void;
  /** POL-97: salvages the targeted wreck truck, returning its stock. */
  salvageWreck(id: string): (NonNullable<WreckInteraction['salvage']> & { readonly log?: string }) | null;
  /** The plot's biome scatter view (TICKET-02 item F). */
  buildBiome(input: BiomeInput): void;
  setVegetationSetting(v: 'auto' | 'off' | 'low' | 'high'): void;
  getBiomeCounts(): BiomeInstanceCount;
  /** Bakes the living coverage masks (stages 0 to 6) and hydro water surfaces behind the loading bar (TICKET-02 Items B and E). */
  bakeCoverage(): void;
  /** Whether the player is close to standing water (lake or active watermaker). */
  isNearWater(): boolean;
  /** For the tests and the e2e: where you are, and a way to stand somewhere. */
  readonly debug: {
    /**
     * JOB-09: the Earth endgame evaluated for the inputs the caller owns (stage, cardinals, plot, gate, stats, clock).
     * Pure — `earth-endgame.ts` has no state of its own, so this is a read and never a step.
     */
    earthEndgame(input: EndgameInput): EndgameState;
    biomeCounts(): BiomeInstanceCount | null;
    biomeTriangles(): number;
    biomeDrawCalls(): number;
    /** The wreck sites: each one's rung and whether it is broken or sealed (TASK-23c). */
    /** TASK-26 check hooks: set the sync (a dev hook, so a beat need not wait 90 s), and the plume's pixels now. */
    setSync(v: number): void;
    plumePixels(): number;
    /** TASK-26: each machine's run now (0..1, at the grid's satisfaction), by kind. */
    machineRuns(): readonly { readonly kind: string; readonly run: number }[];
    wreckRungs(): readonly { readonly site: number; readonly leak: boolean; readonly sealed: boolean; readonly broken: boolean; readonly rung: number }[];
    /** The window view's draw calls and triangles (lab-vista.ts). */
    vistaStats(): { readonly drawCalls: number; readonly triangles: number; readonly dust: number };
    power(): Power;
    coilsLit(): boolean[];
    wake(): { readonly t: number; readonly lift: number; readonly log: readonly { readonly t: number; readonly lift: number }[] };
    startWake(): void;
    setWake(t: number): void;
    /** Sets the window view directly (the budget check draws it in full; the governor sets it by tier otherwise). */
    setWindowView(view: WindowView): void;
    /** The wreck sites sealed so far. */
    sealedWrecks(): readonly number[];
    armoryTaken(): boolean;
    readonly wrecks: WreckSystem;
    aimWreck(reach?: number): ReturnType<NonNullable<WreckSystem['aimWreck']>>;
    tracks(): TireTracks;
    roost(): WheelRoost;
    gantries(): readonly PrintGantry[];
    roverBoostEnergy(): number;
    groundTriangles(): number; showGround(on: boolean): void; where(): Where; position(): THREE.Vector3; airborne(): boolean; teleport(where: Where, x: number, z: number, yaw: number, pitch?: number): void; sync(): number;
    stats(): { readonly triangles: number; readonly calls: number }; wave(): number; gatePlanet(): { x: number; z: number };
    /** The plot gate's iris state, and how many kit parts the ring drew (0 while the twin's own frame stands). */
    gateAccess(): GateAccessMode; gateKitParts(): number;
    /** The way the player faces (the scene's yaw, radians). */
    facing(): number;
    /** Each placed machine's anchor above its housing, projected for the aim-gated labels (TASK-25). */
    machineAnchors(): readonly { readonly id: number; readonly kind: string; readonly ndcX: number; readonly ndcY: number; readonly behind: boolean; readonly distanceM: number; readonly aimAngleDeg: number; readonly running: number }[];
    /** The drawn world bounds of one base piece (batched instances or its dynamic group), or null when not drawn. */
    pieceBounds(id: number): { readonly min: readonly [number, number, number]; readonly max: readonly [number, number, number]; readonly leaf?: { readonly centre: readonly [number, number, number]; readonly normal: readonly [number, number, number] } } | null;
    /** The detail in use, the planet picture's size, and the pixels each machine pours now. */
    detail(): Detail & { readonly planet: readonly [number, number]; readonly pixels: number };
    /** Machines standing on the plot, and how many pour pixels now. */
    machines(): { readonly standing: number; readonly pouring: number };
    /** Each machine's pour (ARGO_NOTE_08): its kind, whether its emitter is up, its pixel count now, its colour, its vent and its feed cubes.
     *  steady: its live count at full run (rate x lifetime, ARGO_NOTE_16 ruling 1); foot and yaw place its prop, so a test can read the registry's vent. */
    plumes(): readonly { readonly kind: string; readonly emitting: boolean; readonly pour: number; readonly steady: number; readonly arc: number; readonly colour: string; readonly base: readonly [number, number]; readonly foot: readonly [number, number, number]; readonly yaw: number; readonly vent: readonly [number, number, number] | null; readonly feed: readonly [number, number, number] | null; readonly feedCubes: number }[];
    /** Each base fabricator: its print state, whether its plume is up, its pixels now, its vent and its feed (the print head's top) in the world, and its cubes. */
    fabricators(): readonly { readonly id: number; readonly printing: boolean; readonly emitting: boolean; readonly pour: number; readonly colour: string; readonly vent: readonly [number, number, number]; readonly feed: readonly [number, number, number] | null; readonly feedCubes: number }[];
    holo(): { readonly visible: boolean; readonly machines: number };
    view(): 'first' | 'third';
    clipWeight(name: ClipName): number;
    /** Where the held rifle is: in the right hand of the character, in the first-person view, or put away. */
    rifleIn(): 'hand' | 'view' | 'none';
    /** How many plot cells carry a preset's paint. */
    paintedCells(): number;
    /** How many plot cells carry a sculpt edit (a cut or a raise), and the edit under a point in metres (negative: cut). */
    sculptedCells(): number;
    /** Window B (TICKET-11, co-op): the remote avatars standing on the plot. */
    remotePeers(): number;
    groundEdit(x: number, z: number): number;
    /** The height of the rendered ground (its chunk meshes) under (x, z), or null off the plot. */
    surfaceAt(x: number, z: number): number | null;
    /** Whether the ground is settled: every wanted chunk built, and no chunk waiting for a cut's rebuild. */
    groundSettled(): boolean;
    /** The ground ring's colour while the held beam is drawn (null: hidden), and whether the Extract stream is drawn. */
    ringColour(): string | null;
    streamShown(): boolean;
    /** Whether the rim and the floor are on (stages 0 to 2). */
    rimFloorOn(): boolean;
    /** The first-person rifle's feel this frame: the offset in metres (x, y, z) of its sway, bob and vibration. */
    rifleFeelOffset(): readonly number[];
    /** Whether the held blueprint's ghost is shown on the ground (it is not while the rifle is out). */
    pieceGhostShown(): boolean;
    /** The character: which scene it is in, whether it is shown, where it stands, and whether an alternate camera is on. */
    avatar(): { readonly in: string; readonly visible: boolean; readonly at: readonly number[]; readonly kids: number; readonly altCam: boolean };
    currentOneShot(): OneShotKind | null;
    animator(): ScientistAnimator | null;
    gather(amount: number): number;
    aimedBoulder(): number | null;
    boulders(): readonly BoulderInfo[];
    twinStage(): number;
    plumeGlowCount(): number;
    waterVisible(): boolean;
    hasWaterMesh(): boolean;
    coverageActive(): boolean;
    planetScene(): THREE.Scene;
    labScene(): THREE.Scene;
    /** TICKET-05 check hooks: the main camera, the beam core's state, the active socket marker's position, and the avatar layer. */
    camera(): THREE.PerspectiveCamera;
    beamCore(): { readonly shown: boolean; readonly colour: string | null };
    activeSocket(): readonly number[] | null;
    avatarLayer(): number;
    pinBeam(on: boolean): void;
    setWaterVisible(v: boolean): void;
    setCoverageActive(v: boolean): void;
    pixelLightCount(): number;
    testPieceAim(pieceId: number): { readonly x: number; readonly y: number; readonly z: number; readonly yaw: number; readonly normal: { readonly x: number; readonly y: number; readonly z: number }; readonly piece: number | null } | null;
    setAltCam(eye: { readonly x: number; readonly y: number; readonly z: number }, pitch: number, yaw: number, target?: { readonly x: number; readonly y: number; readonly z: number }): void;
    clearAltCam(): void;
    /** The locomotion preset in force (`auto` follows the ground), and the switch that pins one (plan 43, loc:). */
    locomotion(): string;
    setLocomotion(choice: string): string;
    groundHeight(x: number, z: number): number;
    /** A third-person side view at `metres` from the character (null: back to the over-the-shoulder camera). For the shots. */
    sideShot(metres: number | null): void;
    horizonDomes(): HorizonEnclaveDomes3D;
    windowFCoopSync(): WindowFCoopSyncController;
    applyScientistWindowFGate(opts: { where: string; cameraView: 'first' | 'third'; quality: string }): unknown;
    orbitalDirector(): OrbitalFlightDirector;
    planetTableHologram(): PlanetTableHologram3D;
    setFourFloats(floats: FourFloats): void;
    isViewModelVisible(): boolean;
    isWireframeLook(): boolean | null;
  };
  dispose(): void;
}

export function createPlayScene(o: {
  readonly canvas: HTMLCanvasElement; readonly gridSpacing: number; readonly antialias: boolean; readonly powerPreference: WebGLPowerPreference; readonly reducedMotion: boolean; readonly textureSize: number;
  /** The size of the ground's material tiles (by the starting tier), and the live detail to start with. */
  readonly groundTexture: number; readonly detail: Detail;
  readonly cameraView?: 'first' | 'third';
  readonly gamePreset?: MultiverseGamePresetSpec;
  readonly avatar?: PlayAvatar | null;
  /** The sculpt edits and the paint as saved (encodeField text), applied when the plot is made; null for a fresh plot. */
  readonly beamField?: string | null;
  readonly vegetation?: 'auto' | 'off' | 'low' | 'high';
  readonly hasSidearm?: boolean;
  /**
   * JOB-09: where a step through the plot's horizon takes the traveller (`earth-endgame.ts`'s transit rule, evaluated by
   * the caller that owns the stage, the cardinals and the biome). Null: nowhere, and the doorway keeps its lab/planet
   * crossing. The scene owns the geometry of the crossing; the caller owns what it means.
   */
  readonly earthTransit?: () => 'earth' | 'moon' | null;
  /** The step through the horizon changed worlds: the caller applies the biome and the arrival sector. */
  readonly onEarthTransit?: (to: 'earth' | 'moon') => void;
}): PlayScene {
  const worldSeed = o.gamePreset?.worldSeed ?? 7;
  const animTime = (t: number): number => o.gamePreset ? Math.floor(t * o.gamePreset.activeRules.stageAnimRateHz) / o.gamePreset.activeRules.stageAnimRateHz : t;
  const renderer = new THREE.WebGLRenderer({ canvas: o.canvas, antialias: o.antialias, powerPreference: o.powerPreference });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 1);
  const camera = new THREE.PerspectiveCamera(72, 1, 0.08, 9000);
  const virtual = new THREE.PerspectiveCamera(72, 1, 0.08, 9000);
  const owned: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(x: T): T => { owned.push(x); return x; };

  // ---- render targets: the planet (low res, with depth), its post-processed picture (for the lab's view), the lab (for the planet's view)
  const target = (w: number, h: number, depth: boolean, nearest: boolean): THREE.WebGLRenderTarget => {
    const t = new THREE.WebGLRenderTarget(w, h, { depthBuffer: true, ...(depth ? { depthTexture: new THREE.DepthTexture(w, h) } : {}) });
    t.texture.minFilter = t.texture.magFilter = nearest ? THREE.NearestFilter : THREE.LinearFilter;
    t.texture.generateMipmaps = false;
    return keep(t);
  };
  let planetRT = target(16, 16, true, true), viewRT = target(16, 16, false, true), labRT = target(16, 16, false, false);
  const screen = new THREE.Vector2(1, 1);
  let currentQuality: string = 'high';

  // ---- the lab
  const openingUniforms = { uView: { value: viewRT.texture as THREE.Texture }, uScreen: { value: screen }, uStatic: { value: 1 }, uTime: { value: 0 } };
  const openingMat = keep(new THREE.ShaderMaterial({ vertexShader: OPENING_VERTEX, fragmentShader: OPENING_FRAGMENT, uniforms: openingUniforms, side: THREE.DoubleSide }));
  const labScene = new THREE.Scene();
  const room: LabRoom = createLabRoom({ textureSize: o.textureSize, portalMaterial: openingMat, quality: currentQuality, windowView: o.detail.windowView });
  if (o.hasSidearm) room.armory.setTaken(true);
  labScene.add(room.group);
  // a burst of static (lab-vista.ts) is heard after its distance divided by the speed of sound
  let sceneAlive = true;
  room.vista.flash.onFlash((e) => {
    const dist = Math.hypot(e.x - camera.position.x, e.z - camera.position.z);
    setTimeout(() => {
      if (sceneAlive) gameAudio.play3d('sfx-storm', { x: e.x, y: 40, z: e.z }, { volume: 0.2 + 0.5 * e.strength, maxDistance: 4000 });
    }, (dist / 343) * 1000);
  });
  const holo: PlotHolo = createPlotHolo();
  room.group.add(holo.group);
  holo.group.position.set(PLANET_TABLE_AT.x, 0, PLANET_TABLE_AT.z);
  const pmrem = keep(new THREE.PMREMGenerator(renderer));
  const roomEnv = new RoomEnvironment();
  // one small room reflection, made once (behind the loading bar): the lab's light, and the planet's too (below), so Astro's
  // metal suit reads as armour on the planet instead of black (TASK-21c)
  const roomEnvTarget = keep(pmrem.fromScene(roomEnv, 0.04));
  const roomEnvMap = roomEnvTarget.texture;
  labScene.environment = roomEnvMap;
  labScene.environmentIntensity = 0.22;
  setPlotEnvironment({ map: roomEnvMap, intensity: PLOT_KIT_ENV });
  roomEnv.dispose();
  room.group.updateMatrixWorld(true);
  const labGateM = room.gate.group.matrixWorld.clone();

  // one plume for the lab's machines (@hm/plume)
  const labPlume = createPlume({ mode: o.detail.plumes, density: o.detail.plumeDensity, markAlpha: 0.5 });
  labScene.add(labPlume.object);
  keep(labPlume);

  let benchEmitter: number | null = null;
  let combinerEmitter: number | null = null;
  let rackEmitter: number | null = null;

  const setLabActivity = (act: { readonly bench: number; readonly combiner: number; readonly rack: number; readonly fabricator?: number }): void => {
    room.setStationOperating('preset-bench', act.bench > 0);
    room.setStationOperating('preset-combiner', act.combiner > 0);
    room.setStationOperating('preset-rack', act.rack > 0);
    room.setStationOperating('fabricator', (act.fabricator ?? 0) > 0);
    // bench pours pink (#ff3d8a) while writing (east wall, z ≈ -5)
    if (act.bench > 0 && benchEmitter === null) {
      benchEmitter = labPlume.add({ at: [7.5, 0.9, -5.0], colour: '#ff3d8a', count: 140, height: 2.2, spread: 0.9, life: 1.8 });
    } else if (act.bench <= 0 && benchEmitter !== null) {
      labPlume.remove(benchEmitter);
      benchEmitter = null;
    }
    // combiner pours violet (#b46bff) while mixing (east wall, z ≈ -3.4)
    if (act.combiner > 0 && combinerEmitter === null) {
      combinerEmitter = labPlume.add({ at: [7.5, 1.25, -3.4], colour: '#b46bff', count: 150, height: 2.4, spread: 1.1, life: 2.0 });
    } else if (act.combiner <= 0 && combinerEmitter !== null) {
      labPlume.remove(combinerEmitter);
      combinerEmitter = null;
    }
    // rack shows faint violet wisp at its indexer while cataloguing (east wall, z ≈ -7)
    if (act.rack > 0 && rackEmitter === null) {
      rackEmitter = labPlume.add({ at: [7.5, 1.4, -7.0], colour: '#b46bff', count: 80, height: 1.6, spread: 0.6, life: 1.5 });
    } else if (act.rack <= 0 && rackEmitter !== null) {
      labPlume.remove(rackEmitter);
      rackEmitter = null;
    }
  };

  // ---- the planet
  const planetScene = new THREE.Scene();
  const m = kit.createMaterials();
  let world: World | null = null, ground: PlotGround | null = null;
  let lookForFn: ((stage: Stage) => StageLook) | null = null;
  let twin = kit.gate(m, { twin: true, stage: 1 });
  let twinStage = 1;
  let gateOn = false;
  let powerT = -1;
  // JOB-08b: the event horizon. Its uniforms are evaluated from (clock, gate state, the last gate event) every frame and
  // written, never accumulated, so a scrub or a replay lands on exactly the frame the play-through showed.
  const horizonMat = keep(createEventHorizonMaterial({ innerRadius: 1, rimWidth: 0.12 }));
  /** When the gate last connected or its iris moved: the kawoosh's `tau = 0`. -Infinity: nothing has happened yet. */
  let lastGateEventT = Number.NEGATIVE_INFINITY;
  // GATE-03: the unpowered doorway shows the dim static (OPENING_OFF_FRAGMENT) until the gate is on, then the horizon
  const openingOffUniforms = { uTime: { value: 0 } };
  const openingOffMat = keep(new THREE.ShaderMaterial({ vertexShader: OPENING_OFF_VERTEX, fragmentShader: OPENING_OFF_FRAGMENT, uniforms: openingOffUniforms, side: THREE.DoubleSide }));
  const twinOpening = new THREE.Mesh(keep(new THREE.PlaneGeometry(twin.opening.width, twin.opening.height)), openingOffMat);
  twinOpening.position.set(0, twin.opening.sill + twin.opening.height / 2, twin.opening.z);
  twin.group.add(twinOpening);
  // the footing goes down into the ground, so the pad never floats on the slope of the peak
  const footing = new THREE.Mesh(keep(new THREE.BoxGeometry(3.6, 2.4, 2.6)), m.concrete);
  footing.position.y = -1.2;
  twin.group.add(footing);
  // ---- the plot's Gate as a modular kit (plan 42 section 4.3): the ring, nine chevron lamps, the ramp, the pedestal,
  // and the iris when the gate is not open. The twin's own frame stays as the collision and exit data; its meshes step
  // aside while the kit draws (and step back if a build fails, so the plot is never gateless).
  let gateAccess: GateAccessMode = 'open';
  let stargate: { readonly group: THREE.Group; readonly build: KitBuild } | null = null;
  const gateKitOverrides: { value: Overrides | undefined } = { value: undefined };
  const disposeStargate = (): void => {
    if (!stargate) return;
    twin.group.remove(stargate.group);
    stargate.group.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) mesh.geometry.dispose();
    });
    stargate = null;
  };
  const buildStargate = (): void => {
    disposeStargate();
    const built = plotStargate({
      access: gateAccess,
      stage: twinStage,
      genLevel: genLevelForStage(shown, currentQuality),
      ...((): { overrides?: Overrides } => {
        // the shipped defaults (plan 49) under the beam's overrides
        const ov = withKitDefaults('stargate', gateKitOverrides.value);
        return ov ? { overrides: ov } : {};
      })(),
    });
    if (!built) {
      // no kit (the frames are off, or a part would not build): the twin draws itself
      for (const c of twin.group.children) if (c !== twinOpening && c !== footing) c.visible = true;
      return;
    }
    stargate = built;
    for (const c of twin.group.children) if (c !== twinOpening && c !== footing) c.visible = false;
    twin.group.add(built.group);
    // the portal draws across the ring's own aperture, from its sill to its crown
    twinOpening.position.set(0, STARGATE_RING_CENTRE_Y, 0.03);
    twinOpening.scale.set((2 * STARGATE_APERTURE_R) / twin.opening.width, (2 * STARGATE_APERTURE_R) / twin.opening.height, 1);
  };
  // you step out facing the goblin planet: the twin's back (-z) looks that way
  const view = new THREE.Vector2(PLANET_DIR.x, PLANET_DIR.z).normalize();
  twin.group.rotation.y = Math.atan2(-view.x, -view.y);
  const gateYawDelta = twin.group.rotation.y;
  planetScene.add(twin.group);
  // ---- Window B (TICKET-11, co-op): the other players stand on the plot as avatars (none outside a session)
  const remotePeers: RemotePeersController = createRemotePeersController(planetScene);

  // ============================================================================
  // Window F (TICKET-19: POL-22 First-Person Scientist Gate & POL-171..173 Co-Op Sync)
  // ============================================================================
  const windowFCoopSync: WindowFCoopSyncController = createWindowFCoopSyncController();

  // ============================================================================
  // Window G (TICKET-22: POL-49, POL-51, POL-34/37 & ARGO_NOTE_20 Turret Corner Cap)
  // ============================================================================
  const buildTurretCornerCapGroup = (): THREE.Group => {
    const capGroup = new THREE.Group();
    capGroup.name = 'turret-corner-cap';
    for (const part of getTurretCornerCapParts()) {
      const geo = keep(new THREE.BoxGeometry(part.size[0], part.size[1], part.size[2]));
      const mat = part.materialSlot === 'hazard' ? m.hazard : part.materialSlot === 'gunmetal' ? m.gunmetal : m.darkSteel;
      const mesh = new THREE.Mesh(geo, mat);
      mesh.name = part.name;
      mesh.position.set(part.position[0], part.position[1], part.position[2]);
      capGroup.add(mesh);
    }
    return capGroup;
  };
  void evaluateMoonAvatarLuminance;
  void computeFightOverlayStrength;
  void evaluateRoverCraterAndWallSafety;

  // ============================================================================
  // Window H (TICKET-25: POL-05 47-Tile Blob Autotile & POL-25 Vista Flash Peak)
  // ============================================================================
  void evaluateBlob47SubtileBlend;
  void isVistaFlashAtPeak;

  // ============================================================================
  // Window I (TICKET-28: POL-14 Stage-6 Orbital Shuttle & Multiverse Flight)
  // ============================================================================
  const orbitalDirector: OrbitalFlightDirector = createOrbitalFlightDirector();
  let planetGateM = new THREE.Matrix4(), toPlanet = new THREE.Matrix4(), toLab = new THREE.Matrix4();
  /** TICKET-01 B: the moon's solids, each with its own frame: the twin's uprights and each field machine's footprint (rebuildPlanetStatic). */
  let planetSolids: { readonly m: readonly number[]; readonly boxes: readonly Box[] }[] = [];
  const rebuildPlanetStatic = (): void => {
    twin.group.updateMatrixWorld(true);
    const boxes = [...twin.colliders];
    if (!gateOn || gateAccess !== 'open') {
      boxes.push({ min: [-0.95, 0.4, -0.25], max: [0.95, 3.2, 0.25] });
    }
    const solids: { m: number[]; boxes: readonly Box[] }[] = [{ m: [...twin.group.matrixWorld.elements], boxes }];
    for (const v of views.values()) solids.push({ m: [...v.prop.group.matrixWorld.elements], boxes: [machineFootprint(v.m.kind)] });
    planetSolids = solids;
  };
  const syncPlanetMatrices = (): void => {
    twin.group.updateMatrixWorld(true);
    planetGateM = twin.group.matrixWorld.clone();
    toPlanet = planetGateM.clone().multiply(labGateM.clone().invert());
    toLab = toPlanet.clone().invert();
    rebuildPlanetStatic();
  };
  let padTop = 0;
  const groundAt = (x: number, z: number): number => {
    // on the footing pad you stand on the pad
    const local = new THREE.Vector3(x, 0, z).applyMatrix4(new THREE.Matrix4().copy(twin.group.matrixWorld).invert());
    if (Math.abs(local.x) < 1.9 && Math.abs(local.z) < 1.25) return padTop;
    return ground ? ground.heightAt(x, z) : 0;
  };

  // ---- the monsters: leaks on the plot's junked models, the guns (raycast), the seal (play/monsters.ts; the screen sets the events)
  const monsters = createMonsters({
    planetScene,
    camera,
    groundHeightAt: (x, z) => groundAt(x, z),
    initialStage: 1,
    seed: worldSeed,
    genomeRoster: o.gamePreset ? gameCreatureIds(o.gamePreset).map((id) => creatureGenomeById(id)!) : undefined,
    manualSpawnsOnly: !!o.gamePreset,
    passive: o.gamePreset?.hudBlade === 'ecosystem-observer',
    animationRateHz: o.gamePreset?.activeRules.stageAnimRateHz,
  });
  let playerAlive = true;
  const monsterFwd = new THREE.Vector3();
  monsters.setPlot(worldSeed, { x: twin.group.position.x, z: twin.group.position.z });
  // the wreck sites: the same seed and gate as the leaks (TASK-23c)
  const wrecks: WreckSystem = createWrecks({ scene: planetScene, groundHeightAt: (x, z) => groundAt(x, z), seed: worldSeed, gate: { x: twin.group.position.x, z: twin.group.position.z }, stage: 1 });

  // ---- Vehicles (@hm/rover & @hm/rovergear) and Station Fabricators
  const vehiclesGroup = new THREE.Group();
  vehiclesGroup.name = 'vehicles-root';
  planetScene.add(vehiclesGroup);

  const fabricatorsGroup = new THREE.Group();
  fabricatorsGroup.name = 'fabricators-root';
  planetScene.add(fabricatorsGroup);

  const roverMaterials = createRovergearMaterials();

  // T07b: Vehicle juice (tyre tracks, dust roost, boost, print gantry)
  const tracks: TireTracks = tireTracks({ scene: planetScene, heightAt: (x, z) => groundAt(x, z) });
  const roost: WheelRoost = wheelRoost({ scene: planetScene });
  const activeGantries: PrintGantry[] = [];
  let isInitialVehiclesSync = true;
  let roverBoostEnergy = 1.0;
  let isRoverBoosting = false;

  interface VehicleView {
    id: number;
    kind: RoverKind;
    group: THREE.Group;
    mesh: {
      body: THREE.Group;
      wheel: THREE.Group | null;
      wheelRadius: number;
      hubs: readonly (readonly [number, number, number])[];
      lamps: THREE.Mesh[];
      parts: Record<string, THREE.Object3D>;
    };
    wheelPivots: THREE.Group[];
    wheelMeshes: THREE.Group[];
    lamps: THREE.Mesh[];
    x: number;
    z: number;
    yaw: number;
    wheelAngle: number;
    target: VehicleTargetable | null;
  }

  /** emitter: the fabricator's plume while it prints; pour: its pixels now; vent: its exhaust, in the world; feedAt: where the ore
   *  lands on the print head, relative to the head's origin (station frame). */
  interface FabricatorView {
    id: number;
    group: THREE.Group;
    station: FabricatorStationMesh;
    printing: boolean;
    emitter: number | null;
    pour: number;
    vent: THREE.Vector3;
    feedAt: THREE.Vector3 | null;
  }

  const vehicleViews = new Map<number, VehicleView>();
  const fabricatorViews = new Map<number, FabricatorView>();
  let lastVehiclesList: readonly { readonly id: number; readonly kind: RoverKind; readonly x: number; readonly z: number; readonly yaw: number }[] = [];
  let lastFabricatorsList: readonly { readonly id: number; readonly x: number; readonly z: number; readonly yaw: number; readonly printing: boolean }[] = [];

  let drivingVehicleId: number | null = null;
  let drivingState: RoverState | null = null;
  let vehicleAcc = 0;
  let currentSpeed = 0;

  // Plan 47 (Pillar 1): the driven vehicle's Sovereign Harness runtime. The vessel soul runs on the
  // same fixed step as @hm/rover, fed only by measured somatics (lateral jolts, real impact
  // concussions, the world's gravity). Its traction output feathers the drive input; the rest is
  // telemetry for the Zone 8 HUD blade. Rebindable from a `harness:`/`harnessc:` rifle cartridge.
  let harnessSpec: IHarnessCartridgeSpec = HARNESS_SHELF_PRESETS['harness:escort-steadfast']!;
  let harnessVessel: IVesselPreset = toVesselPreset(harnessSpec);
  let harnessTuning: IHarnessTuning = toHarnessTuning(harnessSpec);
  const harnessState = new Float32Array(24);
  const harnessTel = new Float32Array(4);
  const harnessLedger = new Float64Array(4);
  const harnessLatch = new Int8Array(1);
  const harnessLatchAccum = new Float32Array(1);
  const harnessMastery = new Float32Array(1);
  const harnessScratch = new Float64Array(CAYLEY_PADE_OUT_LENGTH);
  const harnessActuator: IRoverActuatorOutput = {
    steerAngleRad: 0, driveTorqueNm: 0, activeSuspensionDampingNspm: 0,
    lateralErrorM: 0, tractionSlipRatio: 0, graduatedToSquadLeader: false,
  };
  let harnessPrevLatVel = 0;
  let harnessConcussionDb = 0;
  let harnessVm: IHarnessHudViewModel | null = null;

  /** A fresh soul on the centerline: reserve 5 J, calm priors, awareness at the newborn 0.12. */
  function resetHarnessRuntime(): void {
    harnessState.fill(0);
    harnessState[StateIdx.E_RESERVE] = 5.0;
    harnessState[StateIdx.PI_KIN] = harnessTuning.piBase;
    harnessState[StateIdx.PI_THERM] = 1.0;
    harnessState[StateIdx.PI_ACOUST] = 1.0;
    harnessState[StateIdx.PI_PRIOR] = harnessTuning.piBase;
    harnessState[StateIdx.A_AWARE] = 0.12;
    harnessState[StateIdx.H_COHERENCE] = 0.5;
    harnessTel.fill(0);
    harnessLedger.fill(0);
    harnessLatch[0] = 0;
    harnessLatchAccum[0] = 0;
    harnessMastery[0] = 0;
    harnessActuator.tractionSlipRatio = 0;
    harnessActuator.graduatedToSquadLeader = false;
    harnessPrevLatVel = 0;
    harnessConcussionDb = 0;
    harnessVm = null;
  }

  /** Binds a harness cartridge ref to the vehicle soul (null restores the steadfast default). */
  function setVehicleHarness(ref: string | null): boolean {
    const spec = ref === null ? HARNESS_SHELF_PRESETS['harness:escort-steadfast']! : decodeHarnessCartridgeCode(ref);
    if (!spec) return false;
    harnessSpec = spec;
    harnessVessel = toVesselPreset(spec);
    harnessTuning = toHarnessTuning(spec);
    resetHarnessRuntime();
    return true;
  }

  function buildVehicleView(v: { id: number; kind: RoverKind; x: number; z: number; yaw: number }): VehicleView {
    const activeLevel = genLevelForStage(shown, currentQuality);
    const spec = vehicleKitSpec(v.kind);
    const wheelRadius = v.kind === 'scout' ? SCOUT_WHEEL.radius : v.kind === 'hauler' ? HAULER_WHEEL.radius : 0.4;

    // Build the modular kit chassis and parts (with wheels separated for dynamic roll/steering)
    const kitBuild = plotVehicleKit(v.kind, activeLevel, Math.max(2, shown), {
      skip: (path) => path.includes('wheel'),
    });

    const group = new THREE.Group();
    group.name = `vehicle-${v.id}-${v.kind}`;

    const body = kitBuild ? kitBuild.group : new THREE.Group();
    body.position.set(0, -wheelRadius, 0);
    group.add(body);

    const wheelPivots: THREE.Group[] = [];
    const wheelMeshes: THREE.Group[] = [];
    const wheelProto = plotVehicleWheel(v.kind, activeLevel, Math.max(2, shown));

    if (wheelProto && spec.hubs.length > 0) {
      for (const hub of spec.hubs) {
        const pivot = new THREE.Group();
        pivot.position.set(hub[0], 0, hub[2]);
        const wheelClone = wheelProto.clone();
        if (hub[0] < 0) {
          wheelClone.rotation.y = Math.PI;
        }
        pivot.add(wheelClone);
        group.add(pivot);
        wheelPivots.push(pivot);
        wheelMeshes.push(wheelClone);
      }
    }

    const y = groundAt(v.x, v.z) + wheelRadius;
    group.position.set(v.x, y, v.z);
    group.rotation.set(0, v.yaw, 0);
    vehiclesGroup.add(group);

    const lamps: THREE.Mesh[] = [];
    if (kitBuild) {
      kitBuild.group.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.isMesh && (mesh.name.startsWith('kit:lx:') || mesh.name.startsWith('kit:lamp'))) lamps.push(mesh);
      });
    }

    const target = kitBuild ? vehicleTargetable(v.kind, kitBuild) : null;
    if (target) {
      target.setPose(v.x, y, v.z, v.yaw);
    }

    return {
      id: v.id,
      kind: v.kind,
      group,
      mesh: {
        body,
        wheel: wheelProto,
        wheelRadius,
        hubs: spec.hubs,
        lamps,
        parts: {},
      },
      wheelPivots,
      wheelMeshes,
      lamps,
      x: v.x,
      z: v.z,
      yaw: v.yaw,
      wheelAngle: 0,
      target,
    };
  }

  function setVehicles(list: readonly { readonly id: number; readonly kind: RoverKind; readonly x: number; readonly z: number; readonly yaw: number }[]): void {
    lastVehiclesList = list;
    const keepIds = new Set<number>();
    for (const v of list) {
      keepIds.add(v.id);
      let view = vehicleViews.get(v.id);
      if (!view) {
        view = buildVehicleView(v);
        vehicleViews.set(v.id, view);
        if (!isInitialVehiclesSync) {
          view.group.visible = false;
          const gy = groundAt(v.x, v.z);
          const gantry = printGantry({ x: v.x, y: gy, z: v.z, scene: planetScene, duration: 1.6 });
          activeGantries.push(gantry);
          const vRef = view;
          gantry.play(() => {
            vRef.group.visible = true;
            const idx = activeGantries.indexOf(gantry);
            if (idx !== -1) activeGantries.splice(idx, 1);
            gantry.dispose();
          });
        }
      } else if (drivingVehicleId !== v.id) {
        view.x = v.x;
        view.z = v.z;
        view.yaw = v.yaw;
        const y = groundAt(v.x, v.z) + view.mesh.wheelRadius;
        view.group.position.set(v.x, y, v.z);
        view.group.rotation.set(0, v.yaw, 0);
        // O(1): the kit's box is re-measured by the next aim that reaches it, not here
        view.target?.setPose(v.x, y, v.z, v.yaw);
      }
    }
    isInitialVehiclesSync = false;
    for (const [id, view] of vehicleViews.entries()) {
      if (!keepIds.has(id) && drivingVehicleId !== id) {
        vehiclesGroup.remove(view.group);
        vehicleViews.delete(id);
      }
    }
  }

  let scheduleBiomeRebuild: () => void = () => {};

  /** A base fabricator pours while it prints: printing is operating, so the print state alone turns the pour on and off. It has no
   *  row in ARGO_NOTE_08, so it pours FABRICATOR_PLUME (neutral, for Argo to name), from its station's vent (machine-props.ts). */
  const syncFabricatorPlume = (view: FabricatorView): void => {
    view.group.updateMatrixWorld(true);
    const vent = new THREE.Vector3(...FABRICATOR_VENT).applyMatrix4(view.group.matrixWorld);
    view.vent = vent;
    if (view.printing && view.emitter === null) {
      view.emitter = plume.add({
        at: [vent.x, vent.y, vent.z], colour: FABRICATOR_PLUME.colour, ...machinePlumeLookOf(FABRICATOR_PLUME),
        count: machinePlumeCountOf(FABRICATOR_PLUME, 1, clock), maxCount: machinePlumeSteady(FABRICATOR_PLUME), startAt: clock + 0.6,
      });
    } else if (!view.printing && view.emitter !== null) {
      plume.remove(view.emitter);
      view.emitter = null;
      view.pour = 0;
    }
  };
  /** Where the ore lands on a print head, relative to the head's origin (the station frame): the top of its box, centred. The head
   *  slides along the gantry while it prints, so the drop follows it (the cubes are placed each frame from the head's position). */
  const headFeedOffset = (station: FabricatorStationMesh): THREE.Vector3 | null => {
    const head = station.parts['head'];
    if (!head) return null;
    station.group.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(head);
    return new THREE.Vector3((box.min.x + box.max.x) / 2 - head.position.x, box.max.y - head.position.y, (box.min.z + box.max.z) / 2 - head.position.z);
  };
  function setFabricators(list: readonly { readonly id: number; readonly x: number; readonly z: number; readonly yaw: number; readonly printing: boolean }[]): void {
    lastFabricatorsList = list;
    const keepIds = new Set<number>();
    for (const f of list) {
      keepIds.add(f.id);
      let view = fabricatorViews.get(f.id);
      if (!view) {
        const activeLevel = genLevelForStage(shown, currentQuality);
        const station = createGenFabricator(activeLevel, Math.max(2, shown), roverMaterials);
        const feedAt = headFeedOffset(station); // measured while the station still stands at the origin, so the box is in its frame
        station.group.position.set(f.x, groundAt(f.x, f.z), f.z);
        station.group.rotation.set(0, f.yaw, 0);
        fabricatorsGroup.add(station.group);
        view = { id: f.id, group: station.group, station, printing: f.printing, emitter: null, pour: 0, vent: new THREE.Vector3(), feedAt };
        fabricatorViews.set(f.id, view);
      } else {
        view.printing = f.printing;
        view.group.position.set(f.x, groundAt(f.x, f.z), f.z);
        view.group.rotation.set(0, f.yaw, 0);
      }
      syncFabricatorPlume(view);
    }
    for (const [id, view] of fabricatorViews.entries()) {
      if (!keepIds.has(id)) {
        if (view.emitter !== null) plume.remove(view.emitter);
        fabricatorsGroup.remove(view.group);
        fabricatorViews.delete(id);
      }
    }
    scheduleBiomeRebuild();
    scheduleCoverRebuild();
  }

  function enterVehicle(id: number): boolean {
    const view = vehicleViews.get(id);
    if (!view) return false;
    drivingVehicleId = id;
    const hx = Math.sin(view.yaw);
    const hz = Math.cos(view.yaw);
    drivingState = spawnRover(view.kind, view.x, view.z, [hx, hz], {
      height: (gx, gz) => groundAt(gx, gz),
      g: o.gamePreset ? 9.81 * o.gamePreset.activeRules.gravityScale : 1.62,
    });
    for (const lamp of view.lamps) setRoverLamp(lamp, 1);
    currentSpeed = 0;
    vehicleAcc = 0;
    resetHarnessRuntime();
    const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(view.group.quaternion);
    const camDist = view.kind === 'scout' ? 4.6 : view.kind === 'hauler' ? 6.2 : 7.8;
    const camHeight = view.kind === 'scout' ? 1.8 : view.kind === 'hauler' ? 2.4 : 3.0;
    const lookHeight = view.kind === 'scout' ? 0.7 : view.kind === 'hauler' ? 1.0 : 1.3;
    const initialCamPos = view.group.position.clone().addScaledVector(fwd, -camDist).add(new THREE.Vector3(0, camHeight, 0));
    camera.position.copy(initialCamPos);
    camera.lookAt(view.group.position.clone().add(new THREE.Vector3(0, lookHeight, 0)));
    return true;
  }

  function exitVehicle(): { readonly id: number; readonly x: number; readonly z: number; readonly yaw: number } | null {
    if (drivingVehicleId === null) return null;
    const view = vehicleViews.get(drivingVehicleId);
    const exitedId = drivingVehicleId;
    drivingVehicleId = null;
    drivingState = null;
    currentSpeed = 0;
    harnessVm = null;
    if (view) {
      for (const lamp of view.lamps) setRoverLamp(lamp, 0);
      const exitDist = 2.4;
      pos.x = view.x - exitDist * Math.cos(view.yaw);
      pos.z = view.z + exitDist * Math.sin(view.yaw);
      pos.y = groundAt(pos.x, pos.z) + EYE;
      return { id: exitedId, x: view.x, z: view.z, yaw: view.yaw };
    }
    return null;
  }

  function getDrivingVehicle(): { readonly id: number; readonly kind: RoverKind; readonly speed: number; readonly boostEnergy?: number; readonly boosting?: boolean } | null {
    if (drivingVehicleId === null) return null;
    const view = vehicleViews.get(drivingVehicleId);
    if (!view) return null;
    return { id: drivingVehicleId, kind: view.kind, speed: currentSpeed, boostEnergy: roverBoostEnergy, boosting: isRoverBoosting };
  }

  function getNearVehicle(reach = 3.5): { readonly id: number; readonly kind: RoverKind } | null {
    if (drivingVehicleId !== null) return null;
    for (const view of vehicleViews.values()) {
      const d = Math.hypot(pos.x - view.x, pos.z - view.z);
      if (d <= reach) return { id: view.id, kind: view.kind };
    }
    return null;
  }

  // ---- the plot's machines (`@hm/plotsim`): each a prop (machine-props.ts) on the ground, its cable from the node that powers it,
  // the lines between pylons, and the pixels pouring from every pixel machine that runs (one plume for all, `@hm/plume`)
  /** share: the machine's run share as its pour uses it (a pylon's is 1 while its line is under load); pour: the pixels it pours now. */
  interface MachineView { readonly m: Machine; prop: MachineProp; vent: THREE.Vector3 | null; feed: THREE.Vector3 | null; emitter: number | null; running: number; share: number; pour: number; glow: THREE.Mesh | null; light: THREE.PointLight | null; printStartT?: number }
  const views = new Map<number, MachineView>();
  /**
   * The beam's part overrides on the plot's kit-built machines (plan 38, ARGO_NOTE_34 D.1), by plot kit id: the machine's
   * id and the time it was built, so a new plot that reuses an id does not inherit an old machine's parts.
   */
  const plotKitOverrides = new Map<string, Overrides>();
  const plotKitKey = (mm: Machine): string => `plot:${mm.id}@${mm.built}`;
  const kitBuildOf = (v: MachineView): KitBuild | null => (v.prop as MachineProp & { build?: KitBuild }).build ?? null;
  // TICKET-01 B: the moon's solids exist from the start (the twin's frame stands before any machine is placed)
  rebuildPlanetStatic();
  let cables: THREE.Mesh[] = [];
  /** TASK-26: the grid's satisfaction (the pulse beads' speed), and the pylon spans the beads ride (the cables' own ends and sag). */
  let gridSatisfaction = 1;
  let beadSpans: { readonly a: THREE.Vector3; readonly b: THREE.Vector3; readonly sag: number }[] = [];
  /** The detail the props are built at: chunky low poly until the plot shows stage 2. */
  let propStage = 1;
  let detail: Detail = o.detail;
  // every machine's pixels in one plume (`@hm/plume`, one draw call): drawn as the tier asks, always in colour (alpha 0.5 marks them)
  const plume = createPlume({ mode: detail.plumes, density: detail.plumeDensity, markAlpha: 0.5 });
  plume.setWind(WIND.x, WIND.z, WIND.speed);
  planetScene.add(plume.object);
  keep(plume);
  // TASK-26: pulse beads that run along the relay spans, one instanced draw for all of them; they slow with the grid and stop at 0%
  const BEADS_PER_SPAN = 3, MAX_SPANS = 64;
  const beadMat = keep(new THREE.MeshBasicMaterial({ color: 0xffffff }));
  const beadMesh = keep(new THREE.InstancedMesh(keep(new THREE.SphereGeometry(0.11, 8, 6)), beadMat, BEADS_PER_SPAN * MAX_SPANS));
  beadMesh.count = 0;
  beadMesh.visible = false;
  beadMesh.frustumCulled = false;
  planetScene.add(beadMesh);
  let beadPhase = 0;
  const beadMatrix = new THREE.Matrix4();
  const stepBeads = (dt: number): void => {
    beadPhase += dt * beadSpeed(gridSatisfaction);
    let k = 0;
    for (const sp of beadSpans) {
      if (k >= BEADS_PER_SPAN * MAX_SPANS) break;
      const len = sp.a.distanceTo(sp.b);
      if (len < 0.01) continue;
      for (let j = 0; j < BEADS_PER_SPAN; j++) {
        const along = (beadPhase + (j * len) / BEADS_PER_SPAN) % len;
        const q = spanPoint(sp.a, sp.b, sp.sag, along / len);
        beadMesh.setMatrixAt(k++, beadMatrix.makeTranslation(q.x, q.y, q.z));
      }
    }
    beadMesh.count = k;
    beadMesh.visible = k > 0;
    if (k > 0) beadMesh.instanceMatrix.needsUpdate = true;
  };
  // the feed hoppers (brief 29, item 6): dark grey ore cubes drop into each hopper while its machine consumes; the count follows the
  // run share (0 when the machine is off or out of ore). One instanced draw for every hopper.
  const feedMat = keep(new THREE.MeshLambertMaterial({ color: '#3b3f46' }));
  const feedMesh = keep(new THREE.InstancedMesh(keep(new THREE.BoxGeometry(1, 1, 1)), feedMat, (MAX_FEED_MACHINES + MAX_FEED_FABRICATORS) * FEED_CUBES_FULL));
  feedMesh.count = 0;
  feedMesh.visible = false;
  feedMesh.frustumCulled = false;
  feedMesh.name = 'machine-feed-cubes';
  planetScene.add(feedMesh);
  const feedM = new THREE.Matrix4(), feedQ = new THREE.Quaternion(), feedS = new THREE.Vector3(), feedP = new THREE.Vector3();
  const feedWorld = new THREE.Vector3(), feedHeadLocal = new THREE.Vector3();
  /** The ore's landing point on a fabricator's print head this frame (the head slides, so it is read from the head's position). */
  const fabricatorFeedAt = (f: FabricatorView): THREE.Vector3 | null => {
    const head = f.station.parts['head'];
    if (!head || !f.feedAt) return null;
    feedHeadLocal.copy(head.position).add(f.feedAt);
    return feedWorld.copy(feedHeadLocal).applyMatrix4(f.group.matrixWorld);
  };
  /** One feed's cubes into its slots: the first `drop` of FEED_CUBES_FULL fall onto the feed point, the rest are hidden. Returns the live ones. */
  const writeFeedCubes = (source: number, feed: THREE.Vector3 | null, drop: number, t: number): number => {
    let live = 0;
    for (let c = 0; c < FEED_CUBES_FULL; c++) {
      const slot = source * FEED_CUBES_FULL + c;
      if (feed === null || c >= drop) {
        feedM.makeScale(0, 0, 0);
      } else {
        const p = feedCubeProgress(t, c, FEED_CUBES_FULL);
        const q = Math.min(1, Math.max(0, (p - 0.8) / 0.2));
        const size = 0.08 * (1 - q * q * (3 - 2 * q));
        feedP.set(feed.x + Math.sin(c * 2.1) * 0.03, feed.y + 0.9 * (1 - p * p), feed.z);
        feedS.setScalar(size);
        feedM.compose(feedP, feedQ, feedS);
        live++;
      }
      feedMesh.setMatrixAt(slot, feedM);
    }
    return live;
  };
  /** Each frame: every pour's pixel count (one number from machine-props: rate x life x run share x cadence, T15 multiplies it by the beat)
   *  and every feed hopper's cubes: the machines' first, then the base fabricators' (into their print heads, while they print). */
  // ---- Window D (TICKET-15): Harmonic machine choir & 144 BPM beat-synced plume modulation
  const tickMachinePlumes = (t: number): void => {
    const activeChoirMachines: ActiveMachineEmitter[] = [];
    for (const v of views.values()) {
      if (v.emitter !== null && v.share > 0.05) {
        const stemRole: MachineStemRole | null =
          v.m.kind === 'press' || v.m.kind === 'heavy-press' ? 'shape-press-bass' :
          v.m.kind === 'mill' || v.m.kind === 'heavy-mill' ? 'texture-mill-arp' :
          v.m.kind === 'projector' || v.m.kind === 'heavy-projector' ? 'light-projector-pad' :
          v.m.kind === 'water' || v.m.kind === 'heavy-water' ? 'water-maker-lead' : null;
        if (stemRole) {
          activeChoirMachines.push({ id: String(v.m.id), stemRole, x: v.m.x, y: 0, z: v.m.z, isRunning: true, efficiency0to1: v.share });
        }
      }
    }
    const choirState = evaluateHarmonicMachineChoir(t, pos.x, pos.y, pos.z, activeChoirMachines);
    const choirMod = evaluateBeatSyncedPlumeModulation(choirState.downbeatPulse0to1, choirState.isHarmonicConvergenceLocked);
    // the breath only thins a pour (at most 1): each pour's count is its ruled live budget (ruling 1: the fabricator's 128),
    // and the plume pool is sized to those budgets
    const beatMult = choirState.isHarmonicConvergenceLocked ? Math.min(1, (0.85 + 0.3 * beatPulse(t)) * (choirMod.cubeScaleMultiplier / 1.1)) : 1;

    // the print head already slides along the station's own gantry while it prints (the feed and vent follow it); the
    // vehicle bay's assembly timeline (sampleGantryTimeline) is in the bay's frame and is not applied to the station's head
    for (const f of fabricatorViews.values()) {
      if (f.emitter !== null) {
        f.pour = Math.round(machinePlumeCountOf(FABRICATOR_PLUME, 1, t) * beatMult);
        plume.setCount(f.emitter, f.pour);
      }
    }
    let sources = 0;
    let live = 0;
    for (const v of views.values()) {
      // a machine is no longer printed from a generated model (JOB-08): kit machines stand whole from the first frame, so
      // there is no print sweep left to clip. The gantry's own timeline still runs in the vehicle bay.
      if (v.printStartT !== undefined) delete v.printStartT;
      if (v.emitter !== null) {
        v.pour = Math.round(machinePlumeCount(v.m.kind, v.share, t) * beatMult);
        plume.setCount(v.emitter, v.pour);
      }
      if (sources >= MAX_FEED_MACHINES) break;
      live += writeFeedCubes(sources++, v.feed, feedCubeCount(v.share), t);
    }
    for (const f of fabricatorViews.values()) {
      if (sources >= MAX_FEED_MACHINES + MAX_FEED_FABRICATORS) break;
      live += writeFeedCubes(sources++, fabricatorFeedAt(f), feedCubeCount(f.printing ? 1 : 0), t);
    }
    feedMesh.count = sources * FEED_CUBES_FULL;
    feedMesh.visible = live > 0;
    if (feedMesh.count > 0) feedMesh.instanceMatrix.needsUpdate = true;
  };
  const cableMat = m.rubber;
  const worldOf = (v: MachineView, local: THREE.Vector3): THREE.Vector3 => local.clone().applyMatrix4(v.prop.group.matrixWorld);
  const GLOW_RADIUS = 3.6, GLOW_SEGS = 8;
  const makePlumeGroundGlow = (x: number, z: number, colorHex: string): THREE.Mesh => {
    const geo = new THREE.PlaneGeometry(GLOW_RADIUS * 2, GLOW_RADIUS * 2, GLOW_SEGS, GLOW_SEGS);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const lx = pos.getX(i), lz = pos.getZ(i);
      const wx = x + lx, wz = z + lz;
      pos.setXYZ(i, wx, groundAt(wx, wz) + 0.04, wz);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    const mat = new THREE.ShaderMaterial({
      vertexShader: PLUME_GLOW_VERTEX,
      fragmentShader: PLUME_GLOW_FRAGMENT,
      uniforms: {
        uColour: { value: new THREE.Color(colorHex) },
        uStrength: { value: 0.8 },
        uTime: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneFactor,
      blendSrcAlpha: THREE.ZeroFactor,
      blendDstAlpha: THREE.OneFactor,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(0, 0, 0);
    mesh.visible = false;
    return mesh;
  };
  const setGlowStrength = (mesh: THREE.Mesh, strength: number): void => {
    const u = (mesh.material as THREE.ShaderMaterial).uniforms as Record<string, THREE.IUniform>;
    if (u['uStrength']) u['uStrength'].value = strength;
  };
  const setGlowTime = (mesh: THREE.Mesh, time: number): void => {
    const u = (mesh.material as THREE.ShaderMaterial).uniforms as Record<string, THREE.IUniform>;
    if (u['uTime']) u['uTime'].value = time;
  };
  const build = (mm: Machine): MachineView => {
    const prop = machineProp(m, mm.kind, propStage, genLevelForStage(shown, currentQuality), withKitDefaults(`machine:${mm.kind}`, plotKitOverrides.get(plotKitKey(mm))));
    prop.group.position.set(mm.x, groundAt(mm.x, mm.z) - 0.05, mm.z);
    prop.group.rotation.y = mm.yaw;
    planetScene.add(prop.group);
    prop.group.updateMatrixWorld(true);
    prop.light(0.1);
    const metric = PIXELS_OF[mm.kind];
    let glow: THREE.Mesh | null = null;
    let light: THREE.PointLight | null = null;
    if (metric) {
      glow = makePlumeGroundGlow(mm.x, mm.z, METRIC_COLOUR[metric]);
      planetScene.add(glow);
      if (prop.vent) {
        const vPos = prop.vent.clone().applyMatrix4(prop.group.matrixWorld);
        light = new THREE.PointLight(METRIC_COLOUR[metric], 0, 18, 1.2);
        light.position.set(vPos.x, vPos.y + 1.2, vPos.z);
        light.visible = false;
        planetScene.add(light);
      }
    }
    return {
      m: mm, prop,
      vent: prop.vent ? prop.vent.clone().applyMatrix4(prop.group.matrixWorld) : null,
      feed: prop.feed ? prop.feed.clone().applyMatrix4(prop.group.matrixWorld) : null,
      emitter: null, running: 0, share: 0, pour: 0, glow, light,
      printStartT: clock,
    };
  };
  /** One machine's pour (`@hm/plume`): its colour, look and pixel count, all from machine-props.ts (ARGO_NOTE_08). */
  const addPlume = (v: MachineView, vent: THREE.Vector3, startAt: number): number => {
    const look = machinePlumeLook(v.m.kind);
    v.pour = machinePlumeCount(v.m.kind, v.share, clock);
    // maxCount is the steady count: the per-frame count never exceeds it, so setCount only moves the count uniform (no rebuild)
    return plume.add({
      at: [vent.x, vent.y, vent.z], colour: machinePlumeSpec(v.m.kind).colour, ...look, count: v.pour, startAt,
      maxCount: machinePlumeSteady(machinePlumeSpec(v.m.kind)), gravity: machinePlumeGravity(v.m.kind),
    });
  };
  const unbuild = (v: MachineView): void => {
    planetScene.remove(v.prop.group);
    disposeProp(v.prop);
    if (v.emitter !== null) { plume.remove(v.emitter); v.emitter = null; }
    if (v.glow) {
      planetScene.remove(v.glow);
      v.glow.geometry.dispose();
      (v.glow.material as THREE.Material).dispose();
      v.glow = null;
    }
    if (v.light) {
      planetScene.remove(v.light);
      v.light.dispose();
      v.light = null;
    }
  };
  /** A cable lying on the ground from a to b (both world points). */
  const groundCable = (a: THREE.Vector3, b: THREE.Vector3): THREE.Mesh => {
    const pts: THREE.Vector3[] = [];
    const n = Math.max(6, Math.ceil(a.distanceTo(b) / 0.8));
    for (let i = 0; i <= n; i++) {
      const t = i / n, x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t;
      pts.push(new THREE.Vector3(x, i === 0 ? a.y : i === n ? b.y : groundAt(x, z) + 0.05, z));
    }
    return new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), n * 3, 0.045, 6, false), cableMat);
  };
  /** The cables: each connected machine from the node that powers it (the gate's junction box when in its reach, else the nearest
   *  connected pylon or power unit in reach); a pylon powered by a pylon hangs its line from top to top. */
  const relay = (connected: ReadonlySet<number>): void => {
    for (const c of cables) { planetScene.remove(c); c.geometry.dispose(); }
    cables = [];
    beadSpans = [];
    const junction = new THREE.Vector3(...twin.sockets.find((x) => x.name === 'rear-junction')!.at).applyMatrix4(twin.group.matrixWorld);
    const nodes = [...views.values()].filter((v) => KINDS[v.m.kind].reach > 0 && connected.has(v.m.id));
    const g = twin.group.position;
    for (const v of views.values()) {
      if (!connected.has(v.m.id)) continue;
      let from: MachineView | null = null;
      if (Math.hypot(v.m.x - g.x, v.m.z - g.z) > GATE.reach) {
        let best = Infinity;
        for (const n of nodes) {
          if (n === v) continue;
          const d = Math.hypot(n.m.x - v.m.x, n.m.z - v.m.z);
          if (d <= KINDS[n.m.kind].reach && d < best) { best = d; from = n; }
        }
      }
      let line: THREE.Mesh;
      if (from && from.prop.top && v.prop.top) {
        const a = worldOf(from, from.prop.top), b = worldOf(v, v.prop.top);
        line = lineSpan(m, a, b);
        beadSpans.push({ a, b, sag: spanSag(a.distanceTo(b)) });
      } else {
        line = groundCable(from ? worldOf(from, from.prop.power) : junction, worldOf(v, v.prop.power));
      }
      planetScene.add(line);
      cables.push(line);
    }
  };
  /** Rebuilds the planet's twin gate at stage 1 (chunky) or stage 6 (full detail). */
  const rebuildTwin = (wantStage: number): void => {
    if (wantStage === twinStage) return;
    twinStage = wantStage;
    const oldGroup = twin.group;
    oldGroup.remove(twinOpening);
    oldGroup.remove(footing);
    planetScene.remove(oldGroup);
    oldGroup.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh && mesh.geometry && mesh !== twinOpening && mesh !== footing) {
        mesh.geometry.dispose();
      }
    });
    const oldPos = oldGroup.position.clone();
    const oldRotY = oldGroup.rotation.y;

    twin = kit.gate(m, { twin: true, stage: twinStage });
    twinOpening.position.set(0, twin.opening.sill + twin.opening.height / 2, twin.opening.z);
    twin.group.add(twinOpening);
    twin.group.add(footing);
    twin.group.position.copy(oldPos);
    twin.group.rotation.y = oldRotY;
    planetScene.add(twin.group);
    buildStargate();
    syncPlanetMatrices();
  };
  /** Rebuilds one machine's prop (a new stage, or new kit parts), keeping how hard it runs and its pour. */
  const rebuildView = (id: number, v: MachineView): MachineView => {
    const running = v.running, emitter = v.emitter, share = v.share;
    v.emitter = null;
    unbuild(v);
    const nv = build(v.m);
    nv.running = running; nv.emitter = emitter; nv.share = share;
    if (running > 0.05) nv.prop.light(1);
    if (nv.glow) {
      nv.glow.visible = detail.plumeGlow && running > 0.05;
      setGlowStrength(nv.glow, Math.min(1.0, running) * 0.75);
    }
    if (nv.light) {
      nv.light.visible = detail.pixelLights && running > 0.05;
      nv.light.intensity = nv.light.visible ? running * 12.0 : 0;
    }
    views.set(id, nv);
    return nv;
  };
  /** Rebuilds every machine and the twin gate at the detail of the stage the plot shows (chunky until stage 2). */
  const rebuildProps = (stageShown: number): void => {
    const want = stageShown <= 1 ? 1 : 6;
    rebuildTwin(want);
    if (stageShown === propStage) return;
    propStage = stageShown;
    for (const [id, v] of views) rebuildView(id, v);
    relay(lastConnected);
    rebuildPlanetStatic();

    // Refresh vehicles and fabricators to match the new stage fidelity
    if (lastVehiclesList.length > 0) {
      for (const [id, view] of vehicleViews.entries()) {
        if (drivingVehicleId !== id) {
          vehiclesGroup.remove(view.group);
          vehicleViews.delete(id);
        }
      }
      setVehicles(lastVehiclesList);
    }

    refreshFabricators();
  };
  /** Rebuilds every fabricator station (a new stage, or the kit frames switched). */
  const refreshFabricators = (): void => {
    if (lastFabricatorsList.length === 0) return;
    for (const [id, view] of fabricatorViews.entries()) {
      if (view.emitter !== null) plume.remove(view.emitter);
      fabricatorsGroup.remove(view.group);
      fabricatorViews.delete(id);
    }
    setFabricators(lastFabricatorsList);
  };
  let lastConnected: ReadonlySet<number> = new Set();

  // the build ghost: the chosen machine's shape, green where it may stand, red where it may not; always in colour
  const ghostOk = keep(new THREE.ShaderMaterial({ vertexShader: MARK_VERTEX, fragmentShader: COLOUR_MARK_FRAGMENT, blending: THREE.NoBlending, uniforms: { uColour: { value: new THREE.Color('#6dff8a') }, uLit: { value: 1 } } }));
  const ghostBad = keep(new THREE.ShaderMaterial({ vertexShader: MARK_VERTEX, fragmentShader: COLOUR_MARK_FRAGMENT, blending: THREE.NoBlending, uniforms: { uColour: { value: new THREE.Color('#ff5a4a') }, uLit: { value: 1 } } }));
  let ghost: MachineProp | null = null, ghostKind: MachineKind | null = null;
  let ghostCheck: ((x: number, z: number) => { readonly ok: boolean; readonly why: string }) | null = null;
  const dropGhost = (): void => {
    if (!ghost) return;
    planetScene.remove(ghost.group);
    ghost.group.traverse((obj) => { const mesh = obj as THREE.Mesh; if (mesh.isMesh) mesh.geometry.dispose(); });
    ghost = null;
  };
  const paintGhost = (ok: boolean): void => ghost?.group.traverse((obj) => { const mesh = obj as THREE.Mesh; if (mesh.isMesh) mesh.material = ok ? ghostOk : ghostBad; });
  let building = false, ghostVerdict: { ok: boolean; why: string } = { ok: false, why: '' };
  const ghostAt = new THREE.Vector3();
  /** The hologram lock: while set, the ghost's ground point is this, whatever the crosshair says. */
  let ghostLock: { x: number; z: number } | null = null;
  /** Where the lock was set: a nudge may move the ghost at most MAX_NUDGE_M from here (Argo's 8 m cap). */
  let ghostLockOrigin: { x: number; z: number } | null = null;
  const MAX_NUDGE_M = 8;

  // piece build ghost for Valheim/Dune base-building (Hologram with Fresnel, scanlines, slow pulse)
  const holoUniforms = { uTime: { value: 0 } };
  const pieceGhostGrounded = keep(new THREE.ShaderMaterial({ vertexShader: PIECE_HOLO_VERTEX, fragmentShader: PIECE_HOLO_FRAGMENT, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: { uColour: { value: new THREE.Color('#38bdf8') }, uTime: holoUniforms.uTime } }));
  const pieceGhostOk = keep(new THREE.ShaderMaterial({ vertexShader: PIECE_HOLO_VERTEX, fragmentShader: PIECE_HOLO_FRAGMENT, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: { uColour: { value: new THREE.Color('#34d399') }, uTime: holoUniforms.uTime } }));
  const pieceGhostWeak = keep(new THREE.ShaderMaterial({ vertexShader: PIECE_HOLO_VERTEX, fragmentShader: PIECE_HOLO_FRAGMENT, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: { uColour: { value: new THREE.Color('#fbbf24') }, uTime: holoUniforms.uTime } }));
  const pieceGhostBad = keep(new THREE.ShaderMaterial({ vertexShader: PIECE_HOLO_VERTEX, fragmentShader: PIECE_HOLO_FRAGMENT, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: { uColour: { value: new THREE.Color('#ef4444') }, uTime: holoUniforms.uTime } }));
  let pieceGhost: THREE.Group | null = null;
  let piecesGroup: THREE.Group | null = null;
  let activeWalkWorld: WalkWorld | null = null;
  let altCamPos: THREE.Vector3 | null = null;
  let altCamTarget: THREE.Vector3 | null = null;
  let isSheltered = false;
  /** TASK-26: the starter shelter's dome centre, and the scratch list of the domes round the player each frame. */
  let shelterDome: { x: number; z: number } | null = null;
  const domeBuf: DomeSource[] = [];
  let debugAltCam = false;
  let sideShotM: number | null = null;
  let wireframeLookOverride: boolean | null = null;
  let viewModelHidden = false;
  let jumpState = createVerticalJumpState();

  // ============================================================================
  // Window E: 11 Neighbor Enclave Domes on the 4.2 km Lunar Horizon (T16b / A9-01)
  // ============================================================================
  const horizonDomes: HorizonEnclaveDomes3D = createHorizonEnclaveDomes(planetScene);
  keep(horizonDomes);
  let currentFloats: FourFloats = { Pxd: 0, Vtx: 0, Lx: 0, Aq: 0 };
  let consensusCommitted = false;

  const planGhostMat = keep(new THREE.MeshBasicMaterial({
    color: 0x00f0ff,
    transparent: true,
    opacity: 0.18,
    depthWrite: false,
    side: THREE.DoubleSide,
  }));
  const planGhostEdgeMat = keep(new THREE.LineBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.85,
  }));
  const planGhostsGroup = keep(new THREE.Group());
  planetScene.add(planGhostsGroup);

  // TICKET-05 (BB-05): square corner-bracket socket markers. One InstancedMesh (capped at 48) shows every open slot at the low
  // rest opacity; the slot the build ghost is about to take gets an overlay that pulses, so only that one reads bright.
  const socketRingGeo = keep(socketMarkerGeometry());
  const socketRingMat = keep(socketMarkerMaterial());
  const socketRingMesh = keep(new THREE.InstancedMesh(socketRingGeo, socketRingMat, 48));
  socketRingMesh.name = 'socket-markers';
  socketRingMesh.count = 0;
  socketRingMesh.visible = false;
  const socketActiveMat = keep(socketMarkerMaterial());
  const socketActiveMesh = keep(new THREE.Mesh(socketRingGeo, socketActiveMat));
  socketActiveMesh.name = 'socket-marker-active';
  socketActiveMesh.visible = false;
  socketActiveMesh.renderOrder = 1000;
  planetScene.add(socketActiveMesh);
  let socketPoses: readonly { readonly x: number; readonly y: number; readonly z: number; readonly yaw: number }[] = [];
  let ghostXZ: { readonly x: number; readonly z: number } | null = null;
  /** The slot the build ghost is about to take: the open socket nearest the ghost (within 0.6 m), or none. */
  const updateActiveSocket = (): void => {
    let best = -1;
    let bestD = 0.6 * 0.6;
    if (ghostXZ !== null && socketRingMesh.visible) {
      for (let i = 0; i < socketPoses.length; i++) {
        const sp = socketPoses[i]!;
        const d = (sp.x - ghostXZ.x) ** 2 + (sp.z - ghostXZ.z) ** 2;
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
    }
    if (best < 0) {
      socketActiveMesh.visible = false;
      return;
    }
    const sp = socketPoses[best]!;
    socketActiveMesh.position.set(sp.x, sp.y + 0.05, sp.z);
    socketActiveMesh.rotation.set(0, sp.yaw, 0);
    socketActiveMesh.visible = true;
  };
  // TASK-26: the safe dome's edge, a faint amber ripple where the player crosses it (one ring, one draw call)
  const domeRippleMat = keep(new THREE.MeshBasicMaterial({ color: 0xffc13d, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  const domeRipple = keep(new THREE.Mesh(keep(new THREE.RingGeometry(0.85, 1, 72)), domeRippleMat));
  domeRipple.rotation.x = -Math.PI / 2;
  domeRipple.renderOrder = 998;
  domeRipple.visible = false;
  planetScene.add(domeRipple);
  let rippleAge = -1;
  const startDomeRipple = (x: number, z: number): void => {
    rippleAge = 0;
    domeRipple.position.set(x, groundAt(x, z) + 0.08, z);
    domeRipple.visible = true;
  };
  const stepDomeRipple = (dt: number): void => {
    if (rippleAge < 0) return;
    rippleAge += dt;
    const t = rippleAge / 1.4;
    if (t >= 1) { rippleAge = -1; domeRipple.visible = false; return; }
    domeRipple.scale.setScalar(0.6 + 5.5 * t);
    domeRippleMat.opacity = 0.55 * (1 - t) * (1 - t);
  };
  socketRingMesh.renderOrder = 999;
  planetScene.add(socketRingMesh);

  // The anomaly nodes are grounded mineral outcrops (TICKET-05 Item F, outcrops.ts): one geometry and one material per kind,
  // each with a buried root skirt, so the InstancedMesh per kind stands on the ground instead of floating above it.
  const nodeGeometries: Record<F.Kind, THREE.BufferGeometry> = {
    dither: keep(outcropGeometry('dither', 1)),
    fold: keep(outcropGeometry('fold', 2)),
    chroma: keep(outcropGeometry('chroma', 3)),
    spire: keep(outcropGeometry('spire', 4)),
  };
  const nodeMaterials: Record<F.Kind, THREE.Material> = {
    dither: keep(outcropMaterial('dither')),
    fold: keep(outcropMaterial('fold')),
    chroma: keep(outcropMaterial('chroma')),
    spire: keep(outcropMaterial('spire')),
  };
  const nodeBaseColours: Record<F.Kind, THREE.Color> = {
    dither: new THREE.Color('#d9d9d9'),
    fold: new THREE.Color('#7dd3fc'),
    chroma: new THREE.Color('#ff4fd8'),
    spire: new THREE.Color('#22d3ee'),
  };
  const nodeMeshes: Partial<Record<F.Kind, THREE.InstancedMesh>> = {};

  // ---- Extraction Beam VFX (@hm/beamkit)
  const beamFx: BeamFx = beamEffect({ pixels: detail.plumes === 'dither' || detail.plumeDensity <= 0.5 ? 80 : 160 });
  planetScene.add(beamFx.object);
  beamFx.object.visible = false;
  // The beam's ground ring (the stroke's radius, coloured by mode) and the Extract stream (TASK-21d, P0-VFX-01). The sculpt field from
  // the save waits here until the plot is made (setPlanet).
  const beamVisuals: BeamVisuals = createBeamVisuals(planetScene, keep);
  let pendingBeamField: string | null = o.beamField ?? null;
  /** Window B (TICKET-11): the sculpt text last applied with importBeamField (a repeat of it is skipped). */
  let importedBeamText: string | null = null;
  let heldMode: BeamMode = 'extract';
  let beamSealingNow = false;
  /** A check's pin: the last beam stays drawn while the game asks for none (debug.pinBeam). */
  let beamPinned = false;
  /** The rifle's sway, bob and vibration (first person), and its rest pose and scratch objects. */
  let rifleFeel: RifleFeelState = FEEL_START;
  const viewRest = viewPose();
  const feelOffset = new THREE.Vector3();
  const feelQuat = new THREE.Quaternion();
  const feelEuler = new THREE.Euler();

  // The held rifle (TASK-21): a first-person view model, right of centre. It is not in the planet scene: it is drawn in its
  // own pass after the planet (see drawViewModel), with its own lights, so the stage's look (the 1-bit dither at stage 0,
  // which turns dark metal to black) never hides it. The rig copies the main camera's pose each frame.
  const heldBeam: BeamTool = extractionBeam(createMaterials(), { stage: 1 });
  heldBeam.group.visible = false;
  const viewModelScene = new THREE.Scene();
  const viewRig = new THREE.Group();
  viewRig.add(heldBeam.group);
  // the rifle is in the view in first person and in the right hand (the Astro's bone) in third; the avatar loads later
  let rifleHand: THREE.Object3D | null = null, leftHand: THREE.Object3D | null = null;
  const riflePoint = new THREE.Vector3();
  let rifleAimingNow = false, rifleFiringNow = false;
  // the rifle's own materials: in the hand on the planet they take the room's reflection, so its dark gunmetal reads (TASK-21c);
  // in the view they go back to the plain look (the view model's own lights)
  const rifleMats: THREE.MeshStandardMaterial[] = [];
  heldBeam.group.traverse((o) => {
    const mat = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
    for (const one of Array.isArray(mat) ? mat : mat ? [mat] : []) {
      if ((one as THREE.MeshStandardMaterial).isMeshStandardMaterial && !rifleMats.includes(one as THREE.MeshStandardMaterial)) rifleMats.push(one as THREE.MeshStandardMaterial);
    }
  });
  // the rim and the floor (TASK-21d, P0-LIGHT-01) for the rifle, in stages 0 to 2; the metal cap of TASK-21c stays
  for (const mat of rifleMats) applyRimFloor(mat);
  let rifleEnvOn = false;
  const attachRifle = (): void => {
    const inHand = cameraView === 'third' && rifleHand !== null;
    const parent: THREE.Object3D = inHand ? rifleHand! : viewRig;
    if (heldBeam.group.parent !== parent) { heldBeam.group.removeFromParent(); parent.add(heldBeam.group); }
    const pose = inHand ? handPose(heldBeam.sockets.grip, heldBeam.sockets.muzzle) : viewPose();
    heldBeam.group.position.copy(pose.position);
    heldBeam.group.quaternion.copy(pose.quaternion);
    if (inHand !== rifleEnvOn) {
      rifleEnvOn = inHand;
      for (const mat of rifleMats) { mat.envMap = inHand ? roomEnvMap : null; mat.envMapIntensity = RIFLE_HAND_ENV; mat.needsUpdate = true; }
    }
  };
  let leftUpperArm: THREE.Object3D | null = null, leftForeArm: THREE.Object3D | null = null;
  /**
   * In third person the grip socket sits on the right hand and the barrel points from it to the left hand (the foregrip): each
   * frame the rifle turns so its foregrip socket lies toward the left hand's bone, after the clip has posed the arms.
   */
  const holdRifleInHand = (): void => {
    if (cameraView !== 'third' || rifleHand === null || leftHand === null || heldBeam.group.parent !== rifleHand) return;
    scientistHolder.updateMatrixWorld(true);
    leftHand.getWorldPosition(riflePoint);
    const toLeft = rifleHand.worldToLocal(riflePoint);
    if (toLeft.lengthSq() < 1e-6) return;
    const axis = heldBeam.sockets.foregrip.clone().sub(heldBeam.sockets.grip).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(axis, toLeft.normalize());
    heldBeam.group.quaternion.copy(q);
    heldBeam.group.position.copy(heldBeam.sockets.grip).applyQuaternion(q).negate();
    heldBeam.group.updateMatrixWorld(true);
  };
  // ============================================================================
  // TICKET-10 WINDOW A (Self-Contained Hooks 1..5 for OPUS_NOTE_19)
  // ============================================================================
  const activatedMachineIds = new Set<number>();
  let localMachineWaveStart = -1;
  let localMachineWaveMetric: string | null = null;
  let lastTriggerMetric: string | null = 'pxd';

  // Hook 1: Wave band metric colour, 30 m / 1 s machine activation pulse, & 350 m scan ring fade (P1-LIGHT-04, POL-52)
  const syncWaveAndLocalPulseUniforms = (nowSec: number, scanRadius: number): void => {
    const waveRgb = waveBandColourFor(lastTriggerMetric);
    postUniforms.uWaveBandColour.value.set(waveRgb[0], waveRgb[1], waveRgb[2]);
    if (scanRadius >= 350 && scanRingFadeAt(scanRadius) <= 0) {
      postUniforms.uScanR.value = 350;
    }
    if (localMachineWaveStart >= 0) {
      const pulse = localMachineWaveAt(nowSec - localMachineWaveStart, localMachineWaveMetric);
      if (!pulse.active) {
        localMachineWaveStart = -1;
        postUniforms.uLocalWaveR.value = -1;
        postUniforms.uLocalWaveStrength.value = 0;
      } else {
        postUniforms.uLocalWaveR.value = pulse.radiusM;
        postUniforms.uLocalWaveStrength.value = pulse.strength;
        postUniforms.uLocalWaveColour.value.set(pulse.colour[0], pulse.colour[1], pulse.colour[2]);
      }
    }
  };

  const noteMachineActivationPulse = (mId: number, kind: MachineKind, x: number, z: number, runningNow: number): void => {
    const metric = PIXELS_OF[kind];
    if (runningNow > 0.05 && !activatedMachineIds.has(mId)) {
      activatedMachineIds.add(mId);
      if (metric) {
        lastTriggerMetric = metric;
        localMachineWaveMetric = metric;
        localMachineWaveStart = clock;
        postUniforms.uLocalWaveCentre.value.set(x, groundAt(x, z), z);
      }
    }
  };

  // Hook 2: Vista static-burst floor peak light in the Lab (+12 gain per unit of flash, capped at 0.7; POL-25)
  const vistaFloorFlashLight = new THREE.PointLight('#b8f2ff', 0, 18, 1.3);
  vistaFloorFlashLight.position.set(0, 2.8, -5.4);
  labScene.add(vistaFloorFlashLight);
  let vistaFlashPeakHold = 0;
  let vistaFlashPeakUntil = -1;
  room.vista.flash.onFlash((e) => {
    const peakUnit = Math.min(0.7, e.strength * 0.7);
    vistaFlashPeakHold = Math.max(vistaFlashPeakHold, peakUnit);
    vistaFlashPeakUntil = clock + 0.35;
  });
  const applyVistaFlashFloorPeak = (nowSec: number): void => {
    if (nowSec > vistaFlashPeakUntil) vistaFlashPeakHold = 0;
    const flashUnit = Math.min(0.7, Math.max(room.vista.flashLight, vistaFlashPeakHold));
    vistaFloorFlashLight.intensity = flashUnit * 12.0;
    vistaFloorFlashLight.visible = where === 'lab' && flashUnit > 0.005;
  };

  // Hook 3: Third-person left-arm analytical 2-bone IK to the rifle's foregrip socket (POL-28)
  const foregripWorldScratch = new THREE.Vector3();
  const poleWorldScratch = new THREE.Vector3();
  const applyThirdPersonForegripIk = (): void => {
    if (
      cameraView !== 'third' ||
      !heldBeam.group.visible ||
      heldBeam.group.parent !== rifleHand ||
      !leftUpperArm ||
      !leftForeArm ||
      !leftHand
    ) {
      return;
    }
    heldBeam.group.updateMatrixWorld(true);
    foregripWorldScratch.copy(heldBeam.sockets.foregrip).applyMatrix4(heldBeam.group.matrixWorld);
    // Elbow pole sits down, left, and slightly behind the chest in world space
    poleWorldScratch.set(-0.42, 0.88, -0.22).applyMatrix4(scientistHolder.matrixWorld);
    solveLeftArmForegripIk(leftUpperArm, leftForeArm, leftHand, foregripWorldScratch, poleWorldScratch);
  };

  // Hook 4: Slope-lifted Extract/Sculpt ground ring so sloped crater walls never read dashed (POL-30)
  const updateSlopeLiftedBeamRing = (
    aimed: { readonly x: number; readonly z: number } | null,
    radius: number,
    colour: string,
  ): void => {
    beamVisuals.setRing(
      aimed,
      radius,
      colour,
      (x, z) => groundAt(x, z) + Math.max(0, slopeLiftAt(groundAt, x, z, 0.06) - 0.06),
    );
  };

  // Hook 5: Feed base navgrid & built footprint solids into monsters so walkers route around walls & bolts stop on walls (POL-32, POL-33)
  const syncMonstersNavAndSolids = (base: S.Base | null): void => {
    const baseSolids = base ? footprintSolids(base) : [];
    const machineSolids = [...views.values()].map((v) => {
      const fp = machineFootprint(v.m.kind);
      const hu = 0.5 * (fp.max[0] - fp.min[0]);
      const hv = 0.5 * (fp.max[2] - fp.min[2]);
      return {
        x: v.m.x,
        z: v.m.z,
        ux: Math.cos(v.m.yaw),
        uz: Math.sin(v.m.yaw),
        hu,
        hv,
      };
    });
    monsters.setSolids([...baseSolids, ...machineSolids]);
    monsters.setMachines(
      [...views.values()].map((v) => {
        const fp = machineFootprint(v.m.kind);
        return {
          id: v.m.id,
          x: v.m.x,
          z: v.m.z,
          hu: 0.5 * Math.max(fp.max[0] - fp.min[0], fp.max[2] - fp.min[2]),
        };
      }),
    );
    if (base) {
      const nav = navFor(base, { x: twin.group.position.x, z: twin.group.position.z }, 64, 0.5);
      monsters.setNav?.(nav);
    } else {
      monsters.setNav?.(null);
    }
  };
  // ============================================================================
  // END TICKET-10 WINDOW A
  // ============================================================================
  // a key light fixed to the camera, up and to the right of the rifle, and a sky fill: the rifle reads at every stage
  const viewKey = new THREE.PointLight('#ffffff', 2.4, 6, 1.6);
  viewKey.position.set(0.7, 0.55, 0.1);
  viewRig.add(viewKey);
  const viewFill = new THREE.HemisphereLight('#dfe9ff', '#3a3a40', 1.6);
  viewModelScene.add(viewFill);
  viewModelScene.add(viewRig);
  planetScene.add(camera);
  // TICKET-05 (Item D): the third-person light rig rides the camera; its lights only reach the avatar layer (drawAvatarLayer)
  const avatarRig = thirdPersonLightRig(camera);
  /** The layer state the avatar and rifle meshes were last moved to (see syncAvatarLayers); -1 forces a move. */
  let avatarLayerState = -1;

  const beamCoreGeom = keep(new THREE.CylinderGeometry(0.04, 0.07, 1, 10));
  const beamCoreUniforms = { uColour: { value: new THREE.Color('#00e5ff') }, uLit: { value: 0 } };
  const beamCoreMat = keep(new THREE.ShaderMaterial({
    vertexShader: MARK_VERTEX,
    fragmentShader: COLOUR_MARK_FRAGMENT,
    blending: THREE.NoBlending,
    depthTest: true,
    depthWrite: false,
    uniforms: beamCoreUniforms,
  }));
  const beamCoreMesh = new THREE.Mesh(beamCoreGeom, beamCoreMat);
  beamCoreMesh.visible = false;
  planetScene.add(beamCoreMesh);

  const beamSparkGeom = keep(new THREE.SphereGeometry(0.24, 16, 16));
  const beamSparkUniforms = { uColour: { value: new THREE.Color('#00e5ff') }, uLit: { value: 0 } };
  const beamSparkMat = keep(new THREE.ShaderMaterial({
    vertexShader: MARK_VERTEX,
    fragmentShader: COLOUR_MARK_FRAGMENT,
    blending: THREE.NoBlending,
    depthTest: true,
    depthWrite: false,
    uniforms: beamSparkUniforms,
  }));
  const beamSparkMesh = new THREE.Mesh(beamSparkGeom, beamSparkMat);
  beamSparkMesh.visible = false;
  planetScene.add(beamSparkMesh);

  // ---- the post pass (planet picture by stage)
  const postUniforms = {
    uColour: { value: planetRT.texture as THREE.Texture }, uDepth: { value: planetRT.depthTexture as THREE.Texture | null }, uLab: { value: labRT.texture as THREE.Texture },
    uRes: { value: new THREE.Vector2(16, 16) }, uInvProj: { value: new THREE.Matrix4() }, uCamWorld: { value: new THREE.Matrix4() },
    uWaveCentre: { value: new THREE.Vector3() }, uWaveR: { value: -1 }, uSkyRise: { value: -1 }, uGlitch: { value: 0 }, uTime: { value: 0 }, uLost: { value: 0 },
    uWaveBandColour: { value: new THREE.Vector3(1.0, 0.2392, 0.5412) },
    uLocalWaveCentre: { value: new THREE.Vector3() }, uLocalWaveColour: { value: new THREE.Vector3(1.0, 0.2392, 0.5412) },
    uLocalWaveR: { value: -1 }, uLocalWaveStrength: { value: 0 },
    uLookOut: { value: new THREE.Vector4(0.01, 0.01, 0, 1) }, uLookIn: { value: new THREE.Vector4(0.01, 0.01, 0, 1) },
    uSunDir: { value: SUN.clone() }, uGatePos: { value: new THREE.Vector3() }, uScanCentre: { value: new THREE.Vector3() },
    uScanR: { value: -1 }, uWireMix: { value: 1 }, uFovY: { value: THREE.MathUtils.degToRad(camera.fov) },
    uSuitCam: { value: 0 }, uExposure: { value: 1 }, uSuitK1: { value: 0 }, uSuitGrain: { value: 0 }, uSuitWide: { value: 0 },
  };
  const postScene = new THREE.Scene();
  const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  postScene.add(new THREE.Mesh(keep(new THREE.PlaneGeometry(2, 2)), keep(new THREE.ShaderMaterial({ vertexShader: QUAD_VERTEX, fragmentShader: POST_FRAGMENT, uniforms: postUniforms, depthTest: false, depthWrite: false }))));

  // ---- you
  let where: Where = 'lab';
  const pos = new THREE.Vector3(room.spawn.x, EYE, room.spawn.z);
  let yaw = room.spawn.yaw, pitch = -0.04;
  let sync = 1, lostAt = -100, syncHeld = false;
  /** TASK-26: inside a safe dome now; last frame's state on the planet (null in the lab, so a crossing is only ever on the planet); the 30% warning. */
  let inDomeNow = false, inDomeLast: boolean | null = null, warnOn = false;
  /** Metres walked since the last footstep, and how many relay lamps the sequence has lit (one click each). */
  let stride = 0, relaysHeard = 0;
  powerT = -1;
  gateOn = false;
  /** GATE-03: the doorway is the dim static while the gate is off and the mark once it is on (called when gateOn changes). */
  const syncOpeningMaterial = (): void => {
    const want = gateOn ? horizonMat : openingOffMat;
    if (twinOpening.material !== want) twinOpening.material = want;
  };
  // the wake (TASK-28): the first time the player is in the lab before the lever, the camera starts 65 degrees up and sits up over 2.2 s
  let wakeT = -1, woke = false;
  /** The wake's frames so far (t and the lift), for the tests: the wake runs once per profile, from when the player has control. */
  const wakeLog: { t: number; lift: number }[] = [];
  const startWake = (): void => {
    if (woke || gateOn || where !== 'lab' || powerT >= 0) return;
    woke = true;
    wakeT = 0;
    wakeLog.length = 0;
  };
  /** The plot's stage, the stage the picture shows, and the stage a running wave brings (-1: none) and since when. */
  let stage = 0, shown = 0, waveTo = -1, waveStart = -1;
  /** Stage 0's first-machine scan wave (0a to 0b), the lagging exposure and the suit cam's smoothed strength (plan 25), the build drawer, the plot's Lx. */
  let scanWave: ScanWave = createScanWave();
  let exposure: ExposureState = createExposureState(1);
  let suitCamNow = 0, buildOpen = false, plotLx = 0;
  const suitLook = new THREE.Vector3();
  /** The rover's camera arm (P0-VEH-01): its state lives while a rover is driven. */
  let roverArm: RoverArmState = createRoverArmState(), roverArmOn = false;
  /** The drawn picture's size in pixels: a look's pixels are whole pixels of it. */
  let bufW = 16, bufH = 16, planetK = 0;
  let pendingEvent: FrameOut['event'] = null;
  let clock = 0;
  const audioCamFwd = new THREE.Vector3();
  const audioCamUp = new THREE.Vector3();
  let lastDrivingVehicleId: number | null = null;
  let lastRoverSpeed = 0;

  // ---- plot biome scatter view (TICKET-02 item F)
  let biomeView: PlotBiomeView | null = null;
  /** The beam's regrown trees (plan 39, Aq), held here so a biome built later still grows them. */
  let treeOverrides: Readonly<Record<string, TreeVariantSpec>> = {};
  let vegSetting: 'auto' | 'off' | 'low' | 'high' = o.vegetation ?? 'auto';
  let cachedBiomeInput: BiomeInput | null = null;
  let activeBase: S.Base | null = null;

  // ---- TICKET-13 WINDOW C (the perimeter turret and the blue-sky wave's focus). One labelled section: each turret stands on
  // a corner socket of the base, draws its 2 kW from the grid, steps its brain every planet frame and hits through the
  // monsters' own damage path (hurtMob). The gate's 25 m dome and the powered pylons' 15 m domes are never fired into.
  const turretMounts = new Map<number, { readonly inst: TurretInstance3D; readonly at: { readonly x: number; readonly y: number; readonly z: number } }>();
  let turretBaseSeen: S.Base | null | undefined = undefined;
  let turretSolidList: readonly TurretSolidBox[] = [];
  let projectorSeen = false;
  let blueSkyDecidedWave = -2;
  let blueSkyWaveOn = false;
  // the plot's grid for the turrets: the same supply and demand plotsim solves (the gate, the power units' ore share, the
  // field machines that are wired and on), plus the turrets' own draw. A brownout slows every turret's rate of fire.
  const turretGridSatisfaction = (): number => {
    let supply: number = GATE.supply;
    let demand = 0;
    for (const v of views.values()) {
      if (!lastConnected.has(v.m.id) || !v.m.on) continue;
      const k = KINDS[v.m.kind];
      if (k.draw < 0) supply += -k.draw * v.share;
      else demand += k.draw;
    }
    const total = demand + (activeBase ? turretGridDrawKw(activeBase) : 0);
    return total <= 0 ? 1 : Math.min(1, supply / total);
  };
  const syncTurretMounts = (base: S.Base | null): void => {
    if (turretBaseSeen === base) return;
    turretBaseSeen = base;
    const wanted = new Map<number, S.Piece>();
    for (const p of base?.pieces ?? []) if (p.kind === 'turret') wanted.set(p.id, p);
    for (const [id, mount] of turretMounts) {
      if (wanted.has(id)) continue;
      mount.inst.dispose();
      turretMounts.delete(id);
    }
    for (const [id, p] of wanted) {
      if (turretMounts.has(id) || !base) continue;
      const at = pieceAt(base, p);
      if (!at) continue;
      // the packed parts from the cache (the preload behind the loading bar); a part not loaded yet is its fallback, and
      // the model is swapped in as soon as it arrives
      const cornerMount = resolveTurretCornerMount('corner');
      const seatedAt = {
        x: at.x + cornerMount.localOffset.x,
        y: at.y + cornerMount.localOffset.y,
        z: at.z + cornerMount.localOffset.z,
      };
      const inst = createTurretInstance3D({
        id,
        position: seatedAt,
        parent: planetScene,
        baseMesh: cachedTurretPart('base'),
        yokeMesh: cachedTurretPart('yoke'),
        gunMesh: cachedTurretPart('gun'),
      });
      if (cornerMount.hasCornerCapBlock) {
        const cap = buildTurretCornerCapGroup();
        cap.position.set( -cornerMount.localOffset.x, -cornerMount.localOffset.y, -cornerMount.localOffset.z );
        inst.root.add(cap);
      }
      loadMissingTurretParts(inst);
      turretMounts.set(id, { inst, at: seatedAt });
    }
    turretSolidList = base ? turretSolidBoxes(base, (p) => pieceAt(base, p)) : [];
  };
  // ruling 06: the blue-sky wave starts at the first heavy light projector that runs (the plot's stage push is in plotsim)
  const focusBlueSkyWave = (): void => {
    if (waveTo < 0) {
      blueSkyWaveOn = false;
      return;
    }
    const projector = [...views.values()].find((v) => v.m.kind === 'heavy-projector' && v.share > 0);
    if (projector) projectorSeen = true;
    if (projectorSeen && blueSkyDecidedWave !== waveStart && waveTo >= 4) {
      blueSkyDecidedWave = waveStart;
      blueSkyWaveOn = projector !== undefined;
    }
    if (blueSkyWaveOn && projector) postUniforms.uWaveCentre.value.set(projector.m.x, groundAt(projector.m.x, projector.m.z), projector.m.z);
  };
  // one planet frame: the brains step, and the shots go through the monsters' damage path
  const stepTurrets = (dt: number, player: { readonly x: number; readonly z: number }): void => {
    syncTurretMounts(activeBase);
    focusBlueSkyWave();
    if (turretMounts.size === 0) return;
    const sat = turretGridSatisfaction();
    const mobs = monsters.getMobList().map((m) => ({ id: m.id, kind: m.kind, x: m.pos.x, y: m.pos.y, z: m.pos.z, hp: m.hp, phase: m.phase }));
    const gate = turretGateDome({ x: twin.group.position.x, z: twin.group.position.z });
    const extraSafeDomes = poweredPylonDomes([...views.values()].map((v) => v.m), lastConnected).map((d) => ({ x: d.x, z: d.z, r: d.radius, kind: 'pylon' as const }));
    for (const { inst, at } of turretMounts.values()) {
      // the turret's own mount is not a wall to shoot past: the boxes that hold its corner are left out
      const solids = turretSolidList.filter((b) => !(at.x >= b.minX - 0.3 && at.x <= b.maxX + 0.3 && at.z >= b.minZ - 0.3 && at.z <= b.maxZ + 0.3));
      const out = inst.update({
        satisfaction0to1: sat,
        dt,
        mobs,
        gateDome: { x: gate.x, z: gate.z, r: gate.radius },
        extraSafeDomes,
        player,
        solids,
      });
      if (out.fired && out.targetId !== null && out.damageDealt > 0) monsters.hurtMob(out.targetId, out.damageDealt);
    }
  };

  // The layout the default biome input is built from: machines, keep-outs, water sources and tier. Cheap (no terrain sampling), so the cover
  // and the scatter can check whether it has moved before they bake anything from it.
  const defaultLayout = () => {
    const machinesList: { x: number; z: number; r: number }[] = [];
    const waterSourcesList: { x: number; z: number }[] = [];

    // The Twin Gate as the first anchor (radius = pad + 1 m = 5.0 m)
    machinesList.push({ x: twin.group.position.x, z: twin.group.position.z, r: 5.0 });

    for (const v of views.values()) {
      const fp = machineFootprint(v.m.kind);
      const rFp = Math.max(Math.abs(fp.min[0]), Math.abs(fp.max[0]), Math.abs(fp.min[2]), Math.abs(fp.max[2]));
      machinesList.push({ x: v.m.x, z: v.m.z, r: rFp + 1.0 });
      if (v.m.kind === 'water' || v.m.kind === 'heavy-water') {
        waterSourcesList.push({ x: v.m.x, z: v.m.z });
      }
    }

    // Fabricators on hardpoints
    for (const fab of lastFabricatorsList) {
      if (!machinesList.some((m) => Math.hypot(m.x - fab.x, m.z - fab.z) < 1.0)) {
        machinesList.push({ x: fab.x, z: fab.z, r: 4.5 });
      }
    }

    const keepoutsList: { x0: number; z0: number; x1: number; z1: number }[] = [
      { x0: -4.0, z0: -4.0, x1: 4.0, z1: 4.0 }, // Twin gate pad
    ];

    if (activeBase) {
      for (const p of activeBase.pieces) {
        if (p.kind === 'hardpoint') {
          const pt = pieceAt(activeBase, p);
          if (pt && !machinesList.some((m) => Math.hypot(m.x - pt.x, m.z - pt.z) < 1.0)) {
            machinesList.push({ x: pt.x, z: pt.z, r: 4.5 });
          }
        }
      }
      for (const s of activeBase.structures) {
        const pieces = activeBase.pieces.filter((p) => p.s === s.id);
        if (pieces.length === 0) {
          keepoutsList.push({ x0: s.x - 4, z0: s.z - 4, x1: s.x + 4, z1: s.z + 4 });
        } else {
          let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
          for (const p of pieces) {
            const w = S.toWorld(s, (p.i + 0.5) * S.CELL, (p.j + 0.5) * S.CELL, 0);
            const half = S.CELL * 0.5;
            if (w.x - half < minX) minX = w.x - half;
            if (w.x + half > maxX) maxX = w.x + half;
            if (w.z - half < minZ) minZ = w.z - half;
            if (w.z + half > maxZ) maxZ = w.z + half;
          }
          keepoutsList.push({ x0: minX, z0: minZ, x1: maxX, z1: maxZ });
        }
      }
    }

    const effectiveTier = vegSetting === 'off' ? 'low' : vegSetting === 'high' ? 'high' : 'low';
    return { machines: machinesList, keepouts: keepoutsList, waterSources: waterSourcesList, tier: effectiveTier as BiomeInput['tier'] };
  };
  const defaultLayoutKeyOf = (L: ReturnType<typeof defaultLayout>): string => JSON.stringify([L.machines, L.keepouts, L.waterSources, L.tier]);
  const buildDefaultBiomeInput = (g: PlotGround): BiomeInput => {
    const L = defaultLayout();
    return buildBiomeInput({
      heightAt: (x, z) => g.heightAt(x, z),
      x0: -128,
      z0: -128,
      n: 256,
      cellM: 1,
      machines: L.machines,
      keepouts: L.keepouts,
      waterSources: L.waterSources,
      waterVolume: L.waterSources.length > 0 ? 60 : 0,
      stage: 6,
      s: { pxd: 0.5, vtx: 0.5, lx: 0.5, aq: 0.5 },
      seed: worldSeed,
      tier: L.tier,
    });
  };

  // ---- living coverage & water surfaces (TICKET-02 items B and E)
  const coverTiles = makeCoverTextures({ size: 64, seed: worldSeed * 100 + 1 });
  const stageCoverTextures: (THREE.DataTexture | null)[] = [null, null, null, null, null, null, null];
  let waterGroup: THREE.Group | null = null;
  let waterMesh: THREE.Mesh | null = null;
  let coverSliceTimer: ReturnType<typeof setTimeout> | null = null;

  const bakeStageCoverage = (s: number, input: BiomeInput): THREE.DataTexture => {
    const bake = bakePlotBiome({ ...input, stage: s });
    const tex = new THREE.DataTexture(
      bake.cover,
      input.n,
      input.n,
      THREE.RGBAFormat,
      THREE.UnsignedByteType,
    );
    tex.colorSpace = THREE.NoColorSpace;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    return tex;
  };

  const applyCoverage = (stageNum: number): void => {
    if (!ground) return;
    // the water is built once per layout now (not at every base tick), so its look follows the stage here, as it did when it was rebuilt
    const waterUniforms = waterMesh ? (waterMesh.material as THREE.ShaderMaterial).uniforms : null;
    if (waterUniforms?.uStage) waterUniforms.uStage.value = stageNum;
    const s = Math.max(0, Math.min(6, Math.floor(stageNum)));
    const input = cachedBiomeInput ?? buildDefaultBiomeInput(ground);
    cachedBiomeInput = input;
    let tex = stageCoverTextures[s];
    if (!tex) {
      tex = bakeStageCoverage(s, input);
      stageCoverTextures[s] = tex;
    }
    const size = input.n * input.cellM;
    const x0 = -size * 0.5;
    const z0 = -size * 0.5;
    ground.setCoverage({
      tex,
      x0,
      z0,
      size,
      tiles: coverTiles,
    });
  };

  const buildAndAttachWaterSurfaces = (stageNum: number): void => {
    if (!ground) return;
    if (waterGroup) {
      planetScene.remove(waterGroup);
      waterGroup.traverse((obj) => {
        const m = obj as THREE.Mesh;
        if (m.isMesh) {
          m.geometry.dispose();
          if (Array.isArray(m.material)) m.material.forEach((mat) => mat.dispose());
          else m.material.dispose();
        }
      });
      waterGroup = null;
      waterMesh = null;
    }

    const n = 256, cellM = 1, x0 = -128, z0 = -128;
    const waterSources: HydroSource[] = [];
    for (const v of views.values()) {
      if (v.m.kind === 'water' || v.m.kind === 'heavy-water') {
        const gx = Math.floor((v.m.x - x0) / cellM);
        const gz = Math.floor((v.m.z - z0) / cellM);
        if (gx >= 0 && gx < n && gz >= 0 && gz < n) {
          waterSources.push({ x: gx, z: gz, share: 1 });
        }
      }
    }

    const vol = waterSources.length > 0 ? (stageNum >= 4 ? 600 : 60) : 0;
    if (vol > 0 && waterSources.length > 0) {
      const count = n * n;
      const terrainHeights: number[] = new Array<number>(count);
      for (let z = 0; z < n; z++) {
        const wz = z0 + (z + 0.5) * cellM;
        const rOff = z * n;
        for (let x = 0; x < n; x++) {
          const wx = x0 + (x + 0.5) * cellM;
          terrainHeights[rOff + x] = ground.heightAt(wx, wz);
        }
      }
      const hydroTerrain: HydroTerrain = { size: n, cell: cellM, heights: terrainHeights };
      const w = flood(hydroTerrain, waterSources, vol);
      waterGroup = buildWaterSurfaces(w, (wx, wz) => ground!.heightAt(wx, wz), stageNum, {
        x0,
        z0,
        cellM,
        sunDir: SUN,
      });
      waterGroup.visible = stageNum >= 4;
      waterMesh = waterGroup.getObjectByName('hydro-water-mesh') as THREE.Mesh | null;
      planetScene.add(waterGroup);
    }
  };

  const bakeCoverage = (): void => {
    if (!ground) return;
    const layoutKey = defaultLayoutKeyOf(defaultLayout());
    const input = buildDefaultBiomeInput(ground);
    lastBiomeKey = lastCoverKey = layoutKey;
    cachedBiomeInput = input;
    for (let s = 0; s <= 6; s++) {
      stageCoverTextures[s] = bakeStageCoverage(s, input);
    }
    applyCoverage(shown);
    buildAndAttachWaterSurfaces(shown);
  };

  // A base tick (ten a second in play) calls these with the layout unchanged: when the key has not moved, nothing is baked again. Before this,
  // every tick restarted the sliced cover bake, which never got past stage 3, so stages 4 to 6 kept the cover of the first pass and the bake
  // and the scatter ran about 13 times a second (most of the frame on the laptop).
  let lastBiomeKey = '';
  let lastCoverKey = '';
  const scheduleCoverRebuild = (): void => {
    if (!ground) return;
    const coverKey = defaultLayoutKeyOf(defaultLayout());
    if (coverKey === lastCoverKey) return;
    lastCoverKey = coverKey;
    cachedBiomeInput = buildDefaultBiomeInput(ground);
    if (coverSliceTimer) clearTimeout(coverSliceTimer);
    let sIdx = 0;
    const stepCover = (): void => {
      coverSliceTimer = null;
      if (!ground) return;
      const input = cachedBiomeInput ?? buildDefaultBiomeInput(ground);
      cachedBiomeInput = input;
      const start = performance.now();
      while (sIdx <= 6) {
        const s = sIdx;
        sIdx++;
        stageCoverTextures[s] = bakeStageCoverage(s, input);
        if (s === Math.max(0, Math.min(6, Math.floor(shown)))) {
          applyCoverage(shown);
        }
        if (performance.now() - start > 8 && sIdx <= 6) {
          coverSliceTimer = setTimeout(stepCover, 0);
          return;
        }
      }
      buildAndAttachWaterSurfaces(shown);
    };
    coverSliceTimer = setTimeout(stepCover, 10);
  };

  let biomeRebuildTimer: ReturnType<typeof setTimeout> | null = null;
  scheduleBiomeRebuild = (): void => {
    if (!biomeView || !ground) return;
    if (biomeRebuildTimer) clearTimeout(biomeRebuildTimer);
    biomeRebuildTimer = setTimeout(() => {
      biomeRebuildTimer = null;
      if (!biomeView || !ground) return;
      const biomeKey = defaultLayoutKeyOf(defaultLayout());
      if (biomeKey === lastBiomeKey) return;
      lastBiomeKey = biomeKey;
      const input = buildDefaultBiomeInput(ground);
      cachedBiomeInput = input;
      biomeView.build(input, false);
      biomeView.setStage(shown);
      scheduleCoverRebuild();
    }, 50);
  };

  // ---- scientist character model & animation (TASK-07, POL-18)
  let cameraView: 'first' | 'third' = o.gamePreset ? (o.gamePreset.cameraMode === 'first-person-suit' ? 'first' : 'third') : o.cameraView ?? 'first';
  let scientistAnimator: ScientistAnimator | null = null;
  /** The player's suit as a kit build (JOB-24): the beam's target on the suit's own meshes, once the avatar has loaded. */
  let suitBuild: ReturnType<typeof astroSuitBuildFor> | null = null;
  const scientistHolder = new THREE.Group();
  scientistHolder.visible = cameraView === 'third';
  labScene.add(scientistHolder);

  let visorMaterials: THREE.MeshStandardMaterial[] = [];
  const setVisorColor = (hex: string): void => {
    const col = new THREE.Color(hex);
    for (const mat of visorMaterials) {
      mat.color.copy(col);
      mat.emissive.copy(col);
    }
  };

  /** The character's own suit materials (TASK-21c) and whether they take the room's reflection (on the planet only). */
  const suitMats: THREE.MeshStandardMaterial[] = [];
  let suitOnPlanet = false;
  const syncSuitEnv = (onPlanet: boolean): void => {
    if (onPlanet === suitOnPlanet) return;
    suitOnPlanet = onPlanet;
    for (const mat of suitMats) {
      mat.envMap = onPlanet ? roomEnvMap : null;
      mat.envMapIntensity = SUIT_PLANET_ENV;
      mat.needsUpdate = true;
    }
  };
  const initialVisor = o.avatar?.kind === 'scientist' ? o.avatar.visor : '#f59e0b';
  // TICKET-05 (Item D): the player's avatar loads at 'high' (scientistLevelFor drops it only on Low with fps under 30)
  void Promise.all([createScientistInstance(initialVisor, scientistLevelFor('high')), loadScientistAnimations(), loadRifleAnimations()]).then(
    ([{ group, visorMaterials: vm }, clips, rifleClips]) => {
      if (!sceneAlive) return;
      // Astro's suit is metal on a dark base: under the planet's 1-bit dither (stage 0) it reads as black. This instance gets its own
      // materials (the creator keeps the baked values), with the metal capped; syncSuitEnv gives them the room's reflection on the planet
      group.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        const mat = (mesh.material as THREE.MeshStandardMaterial).clone();
        mat.metalness = Math.min(mat.metalness, SUIT_METAL_CAP);
        mesh.material = mat;
        suitMats.push(mat);
        applyRimFloor(mat);
      });
      syncSuitEnv(where === 'planet');
      scientistHolder.add(group);
      // JOB-24: the player is a creature kit too. The suit's parts go at the beam's reach in the lab and on the plot, so a
      // cartridge can be fired at your own visor, thruster belt or gloves.
      suitBuild = astroSuitBuildFor(group);
      room.registerKit('astro-suit', suitBuild, ASTRO_SUIT_CREATURE_KIT.kit, ASTRO_SUIT_CREATURE_KIT.preset);
      visorMaterials = vm;
      scientistAnimator = createScientistAnimator(group, new Map([...clips, ...rifleClips]));
      rifleHand = group.getObjectByName('mixamorigRightHand') ?? null;
      leftHand = group.getObjectByName('mixamorigLeftHand') ?? null;
      leftUpperArm = group.getObjectByName('mixamorigLeftArm') ?? null;
      leftForeArm = group.getObjectByName('mixamorigLeftForeArm') ?? null;
      avatarLayerState = -1; // the new meshes take the avatar layer on the next frame
      attachRifle();
    }
  ).catch((err) => {
    console.warn('Failed to load scientist in Play:', err);
  });

  let companionEntity: CompanionEntity | null = null;
  void createCompanionEntity({ x: pos.x + 2.0, y: pos.y, z: pos.z + 1.2, yaw: yaw }).then((comp) => {
    if (!sceneAlive) { comp.dispose(); return; }
    companionEntity = comp;
    if (where === 'planet') {
      planetScene.add(comp.group);
    } else {
      labScene.add(comp.group);
    }
    (window as any).__companion = comp;
  }).catch((err) => {
    console.warn('Failed to load companion in Play:', err);
  });

  const LAB_GATE_CLOSED_BOX: Box = { min: [-0.85, 0.4, -1.25], max: [0.85, 3.4, -0.75] };
  /** Pushes the walker's circle of RADIUS out of the lab's boxes (TICKET-01 B: the swept resolver, from where the walker stood). */
  const collide = (p: THREE.Vector3, from: { readonly x: number; readonly z: number }): void => {
    const safeFrom = {
      x: Math.max(ROOM.left + RADIUS, Math.min(ROOM.right - RADIUS, from.x)),
      z: Math.max(ROOM.back + RADIUS, Math.min(ROOM.front - RADIUS, from.z)),
    };
    p.x = Math.max(ROOM.left + RADIUS, Math.min(ROOM.right - RADIUS, p.x));
    p.z = Math.max(ROOM.back + RADIUS, Math.min(ROOM.front - RADIUS, p.z));
    const colliders = gateOn ? room.colliders : [...room.colliders, LAB_GATE_CLOSED_BOX];
    const solid = pushCircle(safeFrom, p, room.floorHeight(safeFrom.x, safeFrom.z), RADIUS, colliders);
    p.x = Math.max(ROOM.left + RADIUS, Math.min(ROOM.right - RADIUS, solid.x));
    p.z = Math.max(ROOM.back + RADIUS, Math.min(ROOM.front - RADIUS, solid.z));
  };

  /** Where a point is in a gate's own frame. */
  const local = (gateM: THREE.Matrix4, p: THREE.Vector3): THREE.Vector3 => p.clone().applyMatrix4(gateM.clone().invert());

  const crossTo = (next: Where): void => {
    const M = next === 'planet' ? toPlanet : toLab;
    pos.applyMatrix4(M);
    yaw += next === 'planet' ? gateYawDelta : -gateYawDelta;
    if (where !== next) {
      if (next === 'planet') {
        labScene.remove(scientistHolder);
        planetScene.add(scientistHolder);
        if (companionEntity && companionEntity.group.parent !== planetScene) {
          labScene.remove(companionEntity.group);
          planetScene.add(companionEntity.group);
        }
      } else {
        planetScene.remove(scientistHolder);
        labScene.add(scientistHolder);
        if (companionEntity && companionEntity.group.parent !== labScene) {
          planetScene.remove(companionEntity.group);
          labScene.add(companionEntity.group);
        }
      }
    }
    where = next;
    pendingEvent = next === 'planet' ? 'to-planet' : 'to-lab';
    sfx('static-burst', { volume: 0.35 });
  };

  /** Over-the-shoulder third-person camera raycast/collision clamping against lab walls, props, and ground. */
  const resolveThirdPersonCamera = (head: THREE.Vector3, desired: THREE.Vector3, inWhere: Where): THREE.Vector3 => {
    const result = desired.clone();
    const dir = desired.clone().sub(head);
    const maxDist = dir.length();
    if (maxDist < 1e-4) return result;
    dir.normalize();

    let hitDist = maxDist;
    const ray = new THREE.Ray(head, dir);
    const hitPoint = new THREE.Vector3();

    if (inWhere === 'lab') {
      const margin = 0.32;
      result.x = Math.max(ROOM.left + margin, Math.min(ROOM.right - margin, result.x));
      result.y = Math.max(0.25 + margin, Math.min(ROOM.height - margin, result.y));
      result.z = Math.max(ROOM.back + margin, Math.min(ROOM.front - margin, result.z));
      hitDist = Math.min(hitDist, result.distanceTo(head));

      const colBox = new THREE.Box3();
      for (const b of room.colliders) {
        colBox.min.set(b.min[0] - 0.25, b.min[1] - 0.25, b.min[2] - 0.25);
        colBox.max.set(b.max[0] + 0.25, b.max[1] + 0.25, b.max[2] + 0.25);
        if (ray.intersectBox(colBox, hitPoint)) {
          const d = head.distanceTo(hitPoint);
          if (d < hitDist) {
            hitDist = Math.max(0.4, d - 0.1);
          }
        }
      }
      result.copy(head).addScaledVector(dir, hitDist);
    } else {
      for (let t = 0.3; t <= maxDist; t += 0.35) {
        const p = head.clone().addScaledVector(dir, t);
        const gy = groundAt(p.x, p.z) + 0.35;
        if (p.y < gy) {
          hitDist = Math.min(hitDist, Math.max(0.4, t - 0.2));
          break;
        }
      }
      result.copy(head).addScaledVector(dir, hitDist);
      const groundMin = groundAt(result.x, result.z) + 0.35;
      if (result.y < groundMin) result.y = groundMin;
    }

    return result;
  };

  /** The ground the view ray meets within `reach` metres (the planet's stroke reach for the beam is 25; the aim point is 36). */
  const aimGround = (reach = 36): THREE.Vector3 | null => {
    if (ghostLock) return new THREE.Vector3(ghostLock.x, groundAt(ghostLock.x, ghostLock.z), ghostLock.z);
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    const p = pos.clone();
    for (let d = 1; d < reach; d += 0.25) {
      const q = p.clone().addScaledVector(dir, d);
      if (q.y <= groundAt(q.x, q.z)) return q;
    }
    return null;
  };

  const visible = (mesh: THREE.Object3D, cam: THREE.Camera): boolean => {
    const f = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
    return f.intersectsBox(new THREE.Box3().setFromObject(mesh));
  };

  /** The S-Space rifts (play/rift.ts) after the stage look (POL-100): their own pass on RIFT_LAYER, one draw call a rift, depth-tested
   *  against the planet's depth so a rift still hides behind the ground and the walls. The planet's pass never drew them. */
  const drawRifts = (cam: THREE.PerspectiveCamera, to: THREE.WebGLRenderTarget | null): void => {
    riftDepthUniforms.uSceneDepth.value = planetRT.depthTexture;
    riftDepthUniforms.uDepthOn.value = 1;
    riftDepthUniforms.uNear.value = cam.near;
    riftDepthUniforms.uFar.value = cam.far;
    if (to) riftDepthUniforms.uOutRes.value.set(to.width, to.height);
    else renderer.getDrawingBufferSize(riftDepthUniforms.uOutRes.value);
    const mask = cam.layers.mask;
    const autoUpdate = planetScene.matrixWorldAutoUpdate;
    cam.layers.set(RIFT_LAYER);
    planetScene.matrixWorldAutoUpdate = false; // the planet's pass updated every matrix this frame
    renderer.setRenderTarget(to);
    renderer.autoClear = false;
    renderer.render(planetScene, cam);
    renderer.autoClear = true;
    planetScene.matrixWorldAutoUpdate = autoUpdate;
    cam.layers.mask = mask;
  };

  /**
   * TICKET-05: the avatar layer. On the planet the third-person avatar, and the rifle while it is in the hand, sit on
   * AVATAR_LIGHT_LAYER, so the world pass does not draw them and drawAvatarLayer does, under the rig's lights. In the lab, and
   * with the rifle in the view, they stay on layer 0. Called once per frame before any draw; it only moves meshes on a change.
   */
  const syncAvatarLayers = (): void => {
    const onPlanet = scientistHolder.parent === planetScene;
    const inHand = heldBeam.group.parent !== viewRig;
    const state = (onPlanet ? 2 : 0) + (inHand ? 1 : 0);
    if (state === avatarLayerState) return;
    avatarLayerState = state;
    const avatarLayer = onPlanet ? AVATAR_LIGHT_LAYER : 0;
    scientistHolder.traverse((o) => o.layers.set(avatarLayer));
    const rifleLayer = onPlanet && inHand ? AVATAR_LIGHT_LAYER : 0;
    heldBeam.group.traverse((o) => o.layers.set(rifleLayer));
  };
  /** The avatar pass: over the planet's picture (depth kept), drawn with the rig's lights only, so the world's lights never touch it. */
  const drawAvatarLayer = (cam: THREE.PerspectiveCamera): void => {
    if (scientistHolder.parent !== planetScene || !scientistHolder.visible) return;
    const mask = cam.layers.mask;
    const autoUpdate = planetScene.matrixWorldAutoUpdate;
    cam.layers.set(AVATAR_LIGHT_LAYER);
    planetScene.matrixWorldAutoUpdate = false; // the planet's pass updated every matrix this frame
    renderer.autoClear = false;
    renderer.render(planetScene, cam);
    renderer.autoClear = true;
    planetScene.matrixWorldAutoUpdate = autoUpdate;
    cam.layers.mask = mask;
  };

  const drawPlanet = (cam: THREE.PerspectiveCamera, to: THREE.WebGLRenderTarget | null, hideTwin: boolean): void => {
    twin.group.visible = !hideTwin;
    renderer.setRenderTarget(planetRT);
    renderer.clear();
    renderer.render(planetScene, cam); // layer 0 only: the rifts (RIFT_LAYER) are not in the planet's picture
    drawAvatarLayer(cam);
    twin.group.visible = true;
    postUniforms.uInvProj.value.copy(cam.projectionMatrixInverse);
    postUniforms.uCamWorld.value.copy(cam.matrixWorld);
    renderer.setRenderTarget(to);
    renderer.render(postScene, postCam); // the stage look
    drawRifts(cam, to);
  };

  /** The held rifle over the picture: its own pass, depth cleared so no wall or ground cuts it, its own lights (TASK-21). */
  const drawViewModel = (cam: THREE.PerspectiveCamera): void => {
    if (!heldBeam.group.visible || viewModelHidden) return;
    viewRig.position.copy(cam.position);
    viewRig.quaternion.copy(cam.quaternion);
    renderer.autoClear = false;
    renderer.setRenderTarget(null);
    renderer.clearDepth();
    renderer.render(viewModelScene, cam);
    renderer.autoClear = true;
  };

  /** The front on the ground (metres; -1 none, 1e7 done) and on the sky (the sine of the elevation it has climbed to). */
  const waveNow = (): { readonly r: number; readonly sky: number } => {
    if (waveTo < 0) return { r: -1, sky: -1 };
    const t = Math.max(0, clock - waveStart);
    if (t < GROUND_SECONDS) return { r: waveFront(t), sky: -1 };
    const p = (t - GROUND_SECONDS) / SKY_SECONDS;
    if (p >= 1) return { r: 1e7, sky: 1 };
    // from just below the horizon (the far ground's edge sits below eye level) to the zenith, easing in and out
    return { r: GROUND_REACH, sky: -0.25 + 1.25 * p * p * (3 - 2 * p) };
  };
  /** -1 before the first stage, 1e7 once a stage has crossed the plot (the e2e waits on it), the front while a wave runs. */
  const waveRadius = (): number => (waveTo >= 0 ? waveNow().r : shown >= 1 ? 1e7 : -1);

  /** A stage's look pixel in screen pixels: its lines on this screen, never finer than the tier allows. */
  const cellPx = (st: number): number => {
    const look = STAGE_LOOK[Math.max(0, Math.min(6, st))]!;
    return Math.max(1, Math.round(bufH / Math.min(look.lines, detail.planetLines)));
  };
  /** The looks either side of the wave, and the planet's picture as fine as the finest look shown (never coarser than stage 1). */
  const fitLooks = (): void => {
    const inStage = waveTo >= 0 ? waveTo : shown;
    const cOut = cellPx(shown), cIn = cellPx(inStage);
    const setLook = (v: THREE.Vector4, st: number, c: number): void => { const look = STAGE_LOOK[Math.max(0, Math.min(6, st))]!; v.set(c / bufW, c / bufH, look.levels, look.dither ? 1 : 0); };
    setLook(postUniforms.uLookOut.value, shown, cOut);
    setLook(postUniforms.uLookIn.value, inStage, cIn);
    const k = Math.max(1, Math.min(cOut, cIn, Math.round(bufH / BASE_LINES)));
    if (k === planetK) return;
    planetK = k;
    const pw = Math.max(64, Math.round(bufW / k)), ph = Math.max(36, Math.round(bufH / k));
    planetRT.dispose(); viewRT.dispose();
    planetRT = target(pw, ph, true, true);
    viewRT = target(pw, ph, false, true);
    postUniforms.uColour.value = planetRT.texture; postUniforms.uDepth.value = planetRT.depthTexture;
    postUniforms.uRes.value.set(pw, ph);
    openingUniforms.uView.value = viewRT.texture;
    plume.setViewport(ph);
  };

  let lastAimedBoulder: number | null = null;

  const pieceRaycaster = new THREE.Raycaster();
  /** The rover's cast (P0-VEH-01): the nearest of the ground, the boulders (as spheres of half their size) and the placed pieces. */
  const roverCast = (origin: RoverVec3, dir: RoverVec3, maxDist: number): number | null => {
    let hit = castHeightfield(origin, dir, maxDist, groundAt);
    const spheres: CastSphere[] = (ground?.getBoulders() ?? []).map((b) => ({ x: b.x, y: b.y, z: b.z, r: 0.5 * b.size }));
    hit = nearestHit(hit, castSpheres(origin, dir, maxDist, spheres));
    if (piecesGroup && piecesGroup.children.length > 0) {
      pieceRaycaster.set(new THREE.Vector3(origin.x, origin.y, origin.z), new THREE.Vector3(dir.x, dir.y, dir.z));
      pieceRaycaster.far = maxDist;
      const first = pieceRaycaster.intersectObjects(piecesGroup.children, true)[0];
      if (first) hit = nearestHit(hit, first.distance);
      pieceRaycaster.far = Infinity;
    }
    return hit;
  };
  const aimRayDir = new THREE.Vector3();
  /** The base piece a ray hit belongs to: the piece manager's instanced lookup, else a `pieceId` up the hit's parents. */
  const pieceIdOfHit = (hit: THREE.Intersection): number | null => {
    if (!piecesGroup) return null;
    const mgr = (piecesGroup.userData as { manager?: { pieceIdFromHit: (o: THREE.Object3D, inst?: number) => number | null } }).manager;
    const fromManager = mgr ? mgr.pieceIdFromHit(hit.object, hit.instanceId) : null;
    if (fromManager !== null) return fromManager;
    for (let curr: THREE.Object3D | null = hit.object; curr && curr !== piecesGroup; curr = curr.parent) {
      if (curr.userData?.pieceId !== undefined) return curr.userData.pieceId as number;
    }
    return null;
  };

  const aimPointFn = (): { readonly x: number; readonly y: number; readonly z: number; readonly yaw: number; readonly normal: { readonly x: number; readonly y: number; readonly z: number }; readonly piece: number | null } | null => {
    // 1. Raycast ground
    const groundHit = aimGround();
    const groundDist = groundHit ? camera.position.distanceTo(groundHit) : Infinity;

    // 2. Raycast pieces group
    let pieceHit: { readonly x: number; readonly y: number; readonly z: number; readonly yaw: number; readonly normal: { readonly x: number; readonly y: number; readonly z: number }; readonly piece: number | null } | null = null;
    let pieceDist = Infinity;

    // a locked ghost aims at its frozen ground point, not at whatever piece the crosshair crosses
    if (piecesGroup && piecesGroup.children.length > 0 && !ghostLock) {
      aimRayDir.set(0, 0, -1).applyQuaternion(camera.quaternion);
      pieceRaycaster.set(camera.position, aimRayDir);
      pieceRaycaster.far = 36;
      const hits = pieceRaycaster.intersectObjects(piecesGroup.children, true);
      if (hits.length > 0 && hits[0]) {
        const first = hits[0];
        pieceDist = first.distance;
        const pieceId = pieceIdOfHit(first);
        const norm = first.face ? first.face.normal.clone().transformDirection(first.object.matrixWorld) : new THREE.Vector3(0, 1, 0);
        pieceHit = {
          x: first.point.x,
          y: first.point.y,
          z: first.point.z,
          yaw,
          normal: { x: norm.x, y: norm.y, z: norm.z },
          piece: pieceId,
        };
      }
    }

    // 3. Return nearer hit (ground skirts into terrain must not eclipse ground in front)
    if (pieceHit && pieceDist <= groundDist) {
      return pieceHit;
    }
    if (groundHit) {
      return {
        x: groundHit.x,
        y: groundHit.y,
        z: groundHit.z,
        yaw,
        normal: { x: 0, y: 1, z: 0 },
        piece: null,
      };
    }
    return pieceHit;
  };

  type SporeModel = { readonly kit: string; build: KitBuild; readonly where: Where; readonly creation: SporeCreation; resources: Set<{ dispose(): void }> };
  const sporeModels: SporeModel[] = [];
  const buildImported = (creation: SporeCreation, overrides?: Overrides): { readonly build: KitBuild; readonly resources: SporeModel['resources'] } => {
    const resources: SporeModel['resources'] = new Set();
    try {
      const build = buildSporeModel(creation, <T extends { dispose(): void }>(x: T): T => { resources.add(x); return x; }, { map: roomEnvMap, intensity: 0.45 }, overrides);
      return { build, resources };
    } catch (e) { for (const resource of resources) resource.dispose(); throw e; }
  };
  const checkpointMaterials: THREE.MeshStandardMaterial[] = [];
  let playerRigBuild: KitBuild | null = null;
  let presetStarted = false;
  // ---- Plan 49: the ping. One cast over everything the crosshair can be on, and one violet reticle at a time.
  /** The kit part under the crosshair, with where it was hit: the lab's kits and creations, or the plot's machines, Gate, suit and vehicles. */
  const aimKitTarget = (reach: number): KitTarget | null => {
    camera.updateMatrixWorld(true);
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    // PLAN-42-GATE: the lab Gate kit ('gate', kit-gate.ts) aims via the room like the
    // capacitor bank, so mat:/lx:/part: cartridges customize it; plot Twin gates move via
    // pure movePlotGate/setGateAccessMode (@hm/coopnet) and keep labkit visuals for now.
    if (where === 'lab') {
      const hit = aimKit(sporeModels.filter((m) => m.where === 'lab'), camera.position, dir, reach);
      return hit ?? room.aimKitPart(camera.position, dir, reach);
    }
    // the plot's kit-built machines, through the two-stage AABB targeter (kit-target.ts): a machine the ray misses costs its box, not
    // its triangles, so every machine on the plot can be aimed at on the min-spec laptop
    const targetables: KitTargetable[] = sporeModels.filter((m) => m.where === 'planet');
    // the Gate itself is a kit: its segments, pedestal and chevron lamps take cartridges like a machine
    if (stargate) targetables.push({ kit: 'stargate', build: stargate.build });
    if (suitBuild) targetables.push({ kit: 'astro-suit', build: suitBuild });
    for (const v of views.values()) {
      const b = kitBuildOf(v);
      if (b) targetables.push({ kit: plotKitKey(v.m), build: b });
    }
    // the plot's vehicles: their kits name every part a cartridge can dress (JOB-08v)
    for (const view of vehicleViews.values()) if (view.target) targetables.push(view.target);
    return aimKit(targetables, camera.position, dir, reach);
  };
  const tuple3 = (t: readonly [number, number, number]): { x: number; y: number; z: number } => ({ x: t[0], y: t[1], z: t[2] });
  const pingDir = new THREE.Vector3();
  const pingCast = (reach: number): PingHit | null => {
    camera.updateMatrixWorld(true);
    const origin = camera.position;
    const dir = pingDir.set(0, 0, -1).applyQuaternion(camera.quaternion).normalize();
    const hits: (PingHit | null)[] = [];
    const kitHit = aimKitTarget(reach);
    if (kitHit) {
      const part = api.kitPlaced(kitHit.kit).find((p) => p.path === kitHit.path);
      hits.push({
        point: tuple3(kitHit.point), normal: tuple3(kitHit.normal), distance: kitHit.distance, source: 'kit',
        kitId: kitHit.kit, partId: kitHit.path, ...(part ? { part: part.part, material: part.material } : {}),
      });
    }
    if (where === 'lab') {
      const s = room.pingSurface(origin, dir, reach);
      if (s) hits.push({ point: tuple3(s.point), normal: tuple3(s.normal), distance: s.distance, source: s.source, ...(s.objectId ? { objectId: s.objectId } : {}) });
      return nearestPingHit(hits);
    }
    // plan 50: the monsters, as spheres about their middle, so "kill that" can name one
    for (const m of combatMobs()) {
      const ox = origin.x - m.x, oy = origin.y - m.y, oz = origin.z - m.z;
      const b = ox * dir.x + oy * dir.y + oz * dir.z;
      const c = ox * ox + oy * oy + oz * oz - 0.7 * 0.7;
      const disc = b * b - c;
      if (disc < 0) continue;
      const dist = -b - Math.sqrt(disc);
      if (dist <= 0 || dist > reach) continue;
      const p = origin.clone().addScaledVector(dir, dist);
      hits.push({ point: p, normal: new THREE.Vector3(p.x - m.x, p.y - m.y, p.z - m.z).normalize(), distance: dist, source: 'enemy', objectId: `mob:${m.id}`, part: m.kind });
    }
    // the base pieces
    if (piecesGroup && piecesGroup.children.length > 0) {
      pieceRaycaster.set(origin, dir);
      pieceRaycaster.far = reach;
      const first = pieceRaycaster.intersectObjects(piecesGroup.children, true)[0];
      pieceRaycaster.far = Infinity;
      if (first) {
        const id = pieceIdOfHit(first);
        const n = first.face ? first.face.normal.clone().transformDirection(first.object.matrixWorld) : new THREE.Vector3(0, 1, 0);
        if (n.dot(dir) > 0) n.negate();
        hits.push({ point: first.point.clone(), normal: n, distance: first.distance, source: 'piece', objectId: id === null ? 'piece' : `piece:${id}` });
      }
    }
    const o = { x: origin.x, y: origin.y, z: origin.z };
    const d = { x: dir.x, y: dir.y, z: dir.z };
    // the boulders, as the rover camera sees them (spheres of half their size)
    const boulders = ground?.getBoulders() ?? [];
    const rock = castSpheres(o, d, reach, boulders.map((b) => ({ x: b.x, y: b.y, z: b.z, r: 0.5 * b.size })));
    if (rock !== null) {
      const p = origin.clone().addScaledVector(dir, rock);
      let near = boulders[0];
      for (const b of boulders) if (near && Math.hypot(p.x - b.x, p.y - b.y, p.z - b.z) - 0.5 * b.size < Math.hypot(p.x - near.x, p.y - near.y, p.z - near.z) - 0.5 * near.size) near = b;
      const n = near ? new THREE.Vector3(p.x - near.x, p.y - near.y, p.z - near.z).normalize() : new THREE.Vector3(0, 1, 0);
      hits.push({ point: p, normal: n, distance: rock, source: 'ground', ...(near ? { objectId: `boulder:${near.id}` } : {}) });
    }
    // the ground: its normal from the heightfield's slope
    const at = castHeightfield(o, d, reach, groundAt);
    if (at !== null) {
      const p = origin.clone().addScaledVector(dir, at);
      const h = 0.25;
      const n = new THREE.Vector3(groundAt(p.x - h, p.z) - groundAt(p.x + h, p.z), 2 * h, groundAt(p.x, p.z - h) - groundAt(p.x, p.z + h)).normalize();
      hits.push({ point: { x: p.x, y: groundAt(p.x, p.z), z: p.z }, normal: n, distance: at, source: 'ground' });
    }
    return nearestPingHit(hits);
  };

  /**
   * The reticle (plan 49 §2): Ray-7 violet corner brackets lying on the surface, a square ripple, a square-section stalk along
   * the normal and a core diamond that shows through whatever stands between (no lettering in the world: the name is the
   * HUD's and the companion's). Built once, re-parented into whichever world the ping is in.
   */
  const pingMarker = ((): {
    readonly group: THREE.Group;
    readonly brackets: THREE.Mesh;
    readonly ripple: THREE.Mesh;
    readonly stalk: THREE.Mesh;
    readonly core: THREE.Mesh;
    readonly mats: { readonly bracket: THREE.MeshBasicMaterial; readonly ripple: THREE.MeshBasicMaterial; readonly stalk: THREE.MeshBasicMaterial; readonly core: THREE.MeshBasicMaterial };
    born: number;
    where: Where | null;
  } => {
    const flat = (w: number, d: number, x: number, z: number): THREE.BufferGeometry => new THREE.BoxGeometry(w, 0.012, d).translate(x, 0.006, z);
    // the reticle is 1 m across in its own frame (the group scales it by distance): four L corners, arms 0.28, bars 0.05
    const arm = 0.28, bar = 0.05, half = 0.5;
    const corners: THREE.BufferGeometry[] = [];
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        corners.push(flat(arm, bar, sx * (half - arm / 2), sz * (half - bar / 2)));
        corners.push(flat(bar, arm - bar, sx * (half - bar / 2), sz * (half - bar - (arm - bar) / 2)));
      }
    }
    const rippleBar = 0.022;
    const ripples = [
      flat(1, rippleBar, 0, -half + rippleBar / 2), flat(1, rippleBar, 0, half - rippleBar / 2),
      flat(rippleBar, 1 - 2 * rippleBar, -half + rippleBar / 2, 0), flat(rippleBar, 1 - 2 * rippleBar, half - rippleBar / 2, 0),
    ];
    const merge = (parts: THREE.BufferGeometry[]): THREE.BufferGeometry => {
      const merged = mergeGeometries(parts.map((g) => g.toNonIndexed()), false) ?? new THREE.BufferGeometry();
      for (const g of parts) g.dispose();
      return merged;
    };
    const mat = (colour: string, opacity: number, through: boolean): THREE.MeshBasicMaterial => new THREE.MeshBasicMaterial({
      color: colour, transparent: true, opacity, depthWrite: false, depthTest: !through, toneMapped: false,
      polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
    });
    const mats = {
      bracket: mat(PING_VIOLET, 0.95, false),
      ripple: mat('#e2b8ff', 0.8, false),
      stalk: mat(PING_VIOLET, 0.55, false),
      core: mat('#f3dcff', 1, true),
    };
    const group = new THREE.Group();
    group.name = 'ping-marker';
    group.visible = false;
    group.renderOrder = 998;
    const brackets = new THREE.Mesh(merge(corners), mats.bracket);
    const ripple = new THREE.Mesh(merge(ripples), mats.ripple);
    const stalk = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.6, 0.035).translate(0, 0.3, 0), mats.stalk);
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.07, 0), mats.core);
    core.position.y = 0.09;
    core.renderOrder = 999;
    for (const mesh of [brackets, ripple, stalk, core]) {
      mesh.frustumCulled = false;
      group.add(mesh);
    }
    return { group, brackets, ripple, stalk, core, mats, born: -1, where: null };
  })();
  const pingUp = new THREE.Vector3(0, 1, 0);
  const pingNormalV = new THREE.Vector3();
  const hidePing = (): void => {
    pingMarker.group.removeFromParent();
    pingMarker.group.visible = false;
    pingMarker.where = null;
    pingMarker.born = -1;
  };
  const showPingAt = (hit: PingHit): void => {
    hidePing();
    const n = pingNormalV.set(hit.normal.x, hit.normal.y, hit.normal.z);
    if (n.lengthSq() < 1e-8) n.set(0, 1, 0);
    n.normalize();
    pingMarker.group.position.set(hit.point.x, hit.point.y, hit.point.z).addScaledVector(n, 0.004);
    pingMarker.group.quaternion.setFromUnitVectors(pingUp, n);
    pingMarker.group.scale.setScalar(pingSizeM(hit.distance));
    pingMarker.group.visible = true;
    pingMarker.born = clock;
    pingMarker.where = where;
    (where === 'planet' ? planetScene : labScene).add(pingMarker.group);
    updatePing();
  };
  /** Turns the reticle to its pulse at the scene clock, and takes it down at the end of its life or when the player changes worlds. */
  const updatePing = (): void => {
    if (pingMarker.where === null) return;
    const pulse = pingPulse(clock - pingMarker.born);
    if (!pulse.alive || pingMarker.where !== where) {
      hidePing();
      return;
    }
    pingMarker.brackets.scale.set(pulse.scale, 1, pulse.scale);
    pingMarker.ripple.scale.set(pulse.ripple, 1, pulse.ripple);
    pingMarker.mats.bracket.opacity = 0.95 * pulse.alpha;
    pingMarker.mats.ripple.opacity = pulse.rippleAlpha;
    pingMarker.mats.stalk.opacity = 0.55 * pulse.alpha;
    pingMarker.mats.core.opacity = pulse.alpha;
    pingMarker.core.rotation.y = (clock - pingMarker.born) * 2.4;
  };

  // ---- Plan 50: Overwatch's fast brain. The drone fights at the frame rate; the slow brain only sets its orders.
  let combatBrain = newCombatBrain();
  /** Plan 51: the drone's combat tuning (a mimicked fire pattern can retune its bursts); the research's numbers by default. */
  let companionTuning: CombatTuning = COMBAT_TUNING;
  /** Plan 51 wave 3: seconds left of a reflex overclock (the drone's fire rhythm at double rate). */
  let overclockS = 0;
  /**
   * Plan 51 wave 3's arc reflex: a zap from the drone chained through up to `links` monsters (the nearest within 14 m of the
   * drone, then each next within 6 m of the last), each through the monsters' own hurt path. Holds to the drone's orders:
   * nothing on hold fire, off the planet, with the player down, or with the drone landed. Returns how many it hit.
   */
  const companionArc = (links: number): number => {
    const comp = companionEntity;
    if (!comp || where !== 'planet' || !playerAlive) return 0;
    const s = comp.getState();
    if (s.landed || comp.getCombatOrders().mode === 'hold-fire') return 0;
    const damage = Math.max(5, playerShotDamage() * 0.6);
    const hit = new Set<number>();
    let from = { x: s.x, y: s.y, z: s.z };
    for (let k = 0; k < Math.max(1, Math.min(5, links)); k++) {
      const reach = k === 0 ? 14 : 6;
      let best: { id: number; x: number; y: number; z: number } | null = null;
      let bestD = reach;
      for (const m of combatMobs()) {
        if (hit.has(m.id)) continue;
        const d = Math.hypot(m.x - from.x, m.y - from.y, m.z - from.z);
        if (d < bestD) { bestD = d; best = m; }
      }
      if (!best) break;
      hit.add(best.id);
      monsters.hurtMob(best.id, damage);
      comp.showShot({ x: best.x, y: best.y, z: best.z }, true);
      from = best;
    }
    return hit.size;
  };
  let companionHurtBy: { id: number; at: number } | null = null;
  const companionBarks: string[] = [];
  /** Plan 56 W6a: the drone's combat events waiting for its memory (the newest 32). */
  const combatEvents: import('./companion-combat').CombatEvent[] = [];
  /** Plan 56 W6c: the drone's symptoms from its memory (play sets them as the memory changes). */
  let companionSymptoms: { gapFactor(step: number): number; sway(step: number): { readonly x: number; readonly z: number } } | null = null;
  /** The living monsters as the brain sees them (aimed at their middle, winding up when they telegraph). */
  const combatMobs = (): CombatMob[] =>
    where !== 'planet' || !playerAlive
      ? []
      : monsters.getMobList().filter((m) => m.phase !== 'dead').map((m) => ({
          id: m.id, kind: m.kind, hp: m.hp, x: m.pos.x, y: m.pos.y + 0.8, z: m.pos.z, telegraph: m.phase === 'windup',
        }));
  /** The player's shot: the held weapon's mean damage per trigger pull (the drone deals a share of it). */
  const playerShotDamage = (): number => {
    const w = monsters.getWeaponStats();
    return w ? w.pellets * (w.damage[0] + w.damage[1]) / 2 : 10;
  };
  /** The player's sustained damage per second with the held weapon (the drone deals a share of it). */
  const playerDps = (): number => {
    const w = monsters.getWeaponStats();
    if (!w) return 20;
    return (w.pellets * ((w.damage[0] + w.damage[1]) / 2) * Math.max(1, w.burst)) / Math.max(0.05, w.cooldown + (Math.max(1, w.burst) - 1) * w.burstGap);
  };
  const companionFight = (dt: number): void => {
    overclockS = Math.max(0, overclockS - dt);
    const comp = companionEntity;
    if (!comp) return;
    comp.setEnvironment(where === 'planet' ? 'vacuum' : 'air');
    const s = comp.getState();
    // no fight in another world, with the player down, or on the ground: stand down without calling anything "down"
    if (where !== 'planet' || !playerAlive || s.landed) {
      if (combatBrain.targetId !== null || combatBrain.fought || combatBrain.seen.length > 0 || combatBrain.lastBarkAt !== -Infinity) combatBrain = standDown(combatBrain);
      comp.setCombat(null, null);
      return;
    }
    // plan 56 W6c: the symptoms change ten times a second of the fight: a stutter, not a slow drift
    const symptomStep = Math.floor(combatBrain.t * 10);
    const symptomTuning = (t: CombatTuning, step: number): CombatTuning => {
      const g = companionSymptoms ? companionSymptoms.gapFactor(step) : 1;
      return g === 1 ? t : { ...t, roundGapS: t.roundGapS * g, burstGapS: t.burstGapS * g };
    };
    const tick = stepCombat(combatBrain, {
      dt,
      drone: { x: s.x, y: s.y, z: s.z },
      player: { x: pos.x, z: pos.z, yaw, shotDamage: playerShotDamage(), dps: playerDps() },
      mobs: combatMobs(),
      orders: comp.getCombatOrders(),
      hurtBy: companionHurtBy,
      tuning: symptomTuning(overclockS > 0 ? { ...companionTuning, roundGapS: companionTuning.roundGapS / 2, burstGapS: companionTuning.burstGapS / 2 } : companionTuning, symptomStep),
    });
    combatBrain = tick.brain;
    // plan 56 W6c: an unbalanced flight sways off its station while it fights
    const sway = companionSymptoms && tick.station ? companionSymptoms.sway(symptomStep) : null;
    comp.setCombat(s.landed ? null : (tick.station && sway ? { x: tick.station.x + sway.x, z: tick.station.z + sway.z } : tick.station), tick.aimYaw);
    if (tick.shot) {
      // a hit goes through the monsters' own path, so its death, drop and the HUD are the same as the player's shot
      if (tick.shot.hit) monsters.hurtMob(tick.shot.mobId, tick.shot.damage);
      comp.showShot(tick.shot.at, tick.shot.hit);
    }
    if (tick.bark) companionBarks.push(barkLine(tick.bark));
    for (const e of tick.events) { combatEvents.push(e); if (combatEvents.length > 32) combatEvents.shift(); }
  };
  /** Everything of one category the drone can find in the world the player is in (plan 50 §3). */
  const pointsOfInterest = (category: ScoutCategory): PointOfInterest[] => {
    const out: PointOfInterest[] = [];
    const add = (x: number, y: number, z: number, label: string): void => { out.push({ category, x, y, z, label }); };
    const planet = where === 'planet';
    switch (category) {
      case 'enemies':
        for (const m of combatMobs()) add(m.x, m.y, m.z, `a ${m.kind}`);
        break;
      case 'hazards':
        if (planet) {
          for (const k of monsters.markers()) if (k.state === 'open' || k.state === 'warned') add(k.x, groundAt(k.x, k.z), k.z, k.state === 'warned' ? `a leak about to open (${Math.round(k.inSeconds ?? 0)} s)` : 'an open leak');
          for (const v of views.values()) if (monsters.isLatched(v.m.id)) add(v.m.x, groundAt(v.m.x, v.m.z), v.m.z, `a sapper on the ${v.m.kind}`);
        }
        break;
      case 'objectives':
        if (planet) for (const k of monsters.markers()) if (k.state !== 'sealed' && !k.dormant) add(k.x, groundAt(k.x, k.z), k.z, 'a leak to seal');
        if (!planet && !gateOn) add(GATE_AT.x, 1.2, GATE_AT.z, 'the gate (pull the lever on the console to power it)');
        break;
      case 'exits':
        if (planet) add(twin.group.position.x, twin.group.position.y + 1.5, twin.group.position.z, 'the Stargate home');
        else add(GATE_AT.x, 1.6, GATE_AT.z, gateOn ? 'the open gate' : 'the gate (not powered yet)');
        break;
      case 'weapons':
        if (!planet && !room.armory.isTaken()) add(ARMORY_RAIL_POS.x, ARMORY_RAIL_POS.y, ARMORY_RAIL_POS.z, 'the sidearm on the armory rack');
        if (planet) for (const f of lastFabricatorsList) add(f.x, groundAt(f.x, f.z) + 1, f.z, f.printing ? 'a fabricator, printing' : 'a fabricator (prints weapons and vehicles)');
        break;
      case 'resources':
        if (planet) for (const b of ground?.getBoulders() ?? []) if (b.ore > 0) add(b.x, b.y, b.z, 'an ore boulder');
        break;
      case 'salvage':
        if (planet) for (const w of wrecks.debugBuilt?.() ?? []) if (!w.salvaged && w.salvage) add(w.x, groundAt(w.x, w.z) + 0.5, w.z, 'a salvageable wreck');
        break;
      case 'secrets':
        if (planet) for (const w of wrecks.debugBuilt?.() ?? []) if (w.log) add(w.x, groundAt(w.x, w.z) + 0.5, w.z, 'a transponder with a log');
        break;
      case 'vehicles':
        if (planet) for (const v of lastVehiclesList) add(v.x, groundAt(v.x, v.z) + 0.8, v.z, `the ${v.kind}`);
        break;
      default:
        break; // ammo, health, armour, keys and currency: this world has none yet
    }
    return out;
  };

  // ---- Plan 53: the bridge pad, the stage a bare "bridge" order takes the player to (an empty stretch of the Moon)
  let bridgePad: { readonly group: THREE.Group; readonly owned: { dispose(): void }[]; readonly x: number; readonly z: number; readonly top: number } | null = null;
  /** The pad's deck height where (x, z) is on it, or -Infinity off it: the deck is floor, like a base piece. */
  const bridgePadFloor = (x: number, z: number): number => {
    const p = bridgePad;
    if (!p) return -Infinity;
    const h = BRIDGE_PAD_SIZE / 2;
    return Math.abs(x - p.x) <= h && Math.abs(z - p.z) <= h ? p.top : -Infinity;
  };
  const hideBridgePad = (): void => {
    if (!bridgePad) return;
    bridgePad.group.removeFromParent();
    for (const o of bridgePad.owned) o.dispose();
    bridgePad = null;
  };
  /**
   * Stands the pad on the flattest spot of a ring `distance` from the gate (deterministic: eight bearings, the least ground
   * spread under the footprint wins), its deck just above the highest ground under it and its plinth running down into the
   * regolith. Returns where the deck is.
   */
  const showBridgePad = (distance = 260): { readonly x: number; readonly y: number; readonly z: number } => {
    hideBridgePad();
    const gate = api.gateExit();
    const h = BRIDGE_PAD_SIZE / 2;
    let best = { x: gate.x + distance, z: gate.z, spread: Infinity, top: 0 };
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      const cx = gate.x + Math.cos(a) * distance, cz = gate.z + Math.sin(a) * distance;
      let lo = Infinity, hi = -Infinity;
      for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) {
        const g = groundAt(cx + (i / 2) * h, cz + (j / 2) * h);
        lo = Math.min(lo, g); hi = Math.max(hi, g);
      }
      if (hi - lo < best.spread) best = { x: cx, z: cz, spread: hi - lo, top: hi };
    }
    const owned: { dispose(): void }[] = [];
    const keepIt = <T extends { dispose(): void }>(x: T): T => { owned.push(x); return x; };
    const mats = {
      gunmetal: keepIt(new THREE.MeshStandardMaterial({ color: '#4b525b', metalness: 0.7, roughness: 0.38 })),
      darkSteel: keepIt(new THREE.MeshStandardMaterial({ color: '#2b3038', metalness: 0.6, roughness: 0.5 })),
      violet: keepIt(new THREE.MeshStandardMaterial({ color: '#2a0f3d', emissive: '#b84dff', emissiveIntensity: 2 })),
    };
    const built = buildKitPreset(BRIDGE_PAD_KIT, 'bridge-pad', { materials: mats, gen: () => null, maxRank: 2, keep: keepIt });
    const group = new THREE.Group();
    group.name = 'bridge-pad';
    if (built) group.add(built.group);
    const base = best.top + 0.02;
    group.position.set(best.x, base, best.z);
    planetScene.add(group);
    bridgePad = { group, owned, x: best.x, z: best.z, top: base + BRIDGE_PAD_DECK_TOP };
    return { x: best.x, y: bridgePad.top, z: best.z };
  };

  // ---- Plan 50 §6: the game screen (a linked window, mirrored live on a free-standing display in the world)
  let gameScreen: { readonly group: THREE.Group; readonly tex: THREE.VideoTexture; readonly owned: { dispose(): void }[] } | null = null;
  const hideGameScreen = (): void => {
    if (!gameScreen) return;
    gameScreen.group.removeFromParent();
    for (const o of gameScreen.owned) o.dispose();
    gameScreen = null;
  };
  const showGameScreen = (video: HTMLVideoElement | null): boolean => {
    hideGameScreen();
    if (!video) return false;
    const owned: { dispose(): void }[] = [];
    const keepIt = <T extends { dispose(): void }>(x: T): T => { owned.push(x); return x; };
    const mats = {
      gunmetal: keepIt(new THREE.MeshStandardMaterial({ color: '#4b525b', metalness: 0.7, roughness: 0.38 })),
      darkSteel: keepIt(new THREE.MeshStandardMaterial({ color: '#2b3038', metalness: 0.6, roughness: 0.5 })),
      violet: keepIt(new THREE.MeshStandardMaterial({ color: '#2a0f3d', emissive: '#b84dff', emissiveIntensity: 2 })),
    };
    const built = buildKitPreset(GAME_SCREEN_KIT, 'game-screen', { materials: mats, gen: () => null, maxRank: 2, keep: keepIt });
    if (!built) return false;
    const tex = keepIt(new THREE.VideoTexture(video));
    tex.colorSpace = THREE.SRGBColorSpace;
    const picture = new THREE.Mesh(
      keepIt(new THREE.PlaneGeometry(GAME_SCREEN_SURFACE.width, GAME_SCREEN_SURFACE.height)),
      keepIt(new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })),
    );
    picture.position.set(...GAME_SCREEN_SURFACE.centre);
    picture.name = 'game-screen-picture';
    built.group.add(picture);
    const group = new THREE.Group();
    group.name = 'game-screen';
    group.add(built.group);
    // stand it 4.5 m ahead on the ground, facing the player
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    const x = pos.x + fx * 4.5, z = pos.z + fz * 4.5;
    group.position.set(x, where === 'planet' ? groundAt(x, z) : room.floorHeight(x, z), z);
    group.rotation.y = Math.atan2(pos.x - x, pos.z - z);
    (where === 'planet' ? planetScene : labScene).add(group);
    gameScreen = { group, tex, owned };
    return true;
  };

  const api: PlayScene = {
    async loadSporeCreation(creation, isCurrent = () => true) {
      await preloadSporeCreation(creation);
      if (!sceneAlive || !isCurrent()) throw new Error('World closed during Spore import');
      if (sporeModels.length >= 32) throw new Error('This session already holds 32 Spore creations');
      const { build, resources } = buildImported(creation);
      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
      const x = pos.x + forward.x * 5, z = pos.z + forward.z * 5;
      build.group.position.set(x, where === 'planet' ? groundAt(x, z) : room.floorHeight(x, z), z);
      (where === 'planet' ? planetScene : labScene).add(build.group);
      sporeModels.push({ kit: `spore:${sporeModels.length + 1}`, build, resources, creation, where });
    },
    visibleCreatureIds() {
      const sample = new THREE.Vector3();
      return monsters.getMobList().filter((m) => {
        if (Math.hypot(m.pos.x - pos.x, m.pos.z - pos.z) > 40) return false;
        sample.set(m.pos.x, m.pos.y + 0.8, m.pos.z).project(camera);
        return sample.z >= -1 && sample.z <= 1 && Math.abs(sample.x) < 0.9 && Math.abs(sample.y) < 0.9;
      }).map((m) => m.id);
    },
    setCircuitCheckpoint(index) {
      checkpointMaterials.forEach((m, i) => { m.color.set(i === index ? '#7cffb4' : '#376075'); m.emissive.set(i === index ? '#196642' : '#000000'); });
    },
    startGamePreset() {
      const preset = o.gamePreset;
      if (!preset || presetStarted) return;
      presetStarted = true;
      api.setFidelityStage(gameStage(preset));
      const at = gameSpawn(preset);
      api.debug.teleport('planet', at.x, at.z, at.yaw, -0.08);
      api.setCameraView(preset.cameraMode === 'first-person-suit' ? 'first' : 'third');
      const vehicle = gameVehicleKind(preset.playerRigId);
      if (vehicle) {
        const entry = [...vehicleViews.values()].find((v) => v.kind === vehicle);
        if (!entry || !api.enterVehicle(entry.id)) throw new Error('Preset player vehicle is missing');
      } else if (preset.playerRigId !== 'kit:astro-suit' && preset.playerRigId !== 'astro-suit') {
        playerRigBuild = buildSporeModel({ kind: 'game', spec: preset }, keep, { map: roomEnvMap, intensity: 0.45 });
        planetScene.add(playerRigBuild.group);
        sporeModels.push({ kit: 'player-rig', build: playerRigBuild, creation: { kind: 'game', spec: preset }, resources: new Set(), where: 'planet' });
      }
      monsters.setUnlocked(preset.hudBlade === 'arena-wave-survivor');
      monsters.setSetting(preset.hudBlade === 'arena-wave-survivor' ? 'normal' : 'calm');
      if (preset.hudBlade === 'ecosystem-observer') {
        const genomes = gameCreatureIds(preset);
        const count = Math.max(genomes.length, Math.ceil(preset.activeRules.targetScoreOrTimeSec));
        for (let i = 0; i < Math.min(24, count); i++) {
          const angle = i * Math.PI * 2 / count;
          const g = creatureGenomeById(genomes[i % genomes.length] ?? 'theropod');
          monsters.placeMob(g?.archetype === 'avian-drone' ? 'flyer' : 'charger', at.x + Math.sin(angle) * 15, at.z + Math.cos(angle) * 15);
        }
      }
      if (preset.activeRules.winCondition === 'checkpoint-circuit') {
        for (const point of CIRCUIT_CHECKPOINTS) {
          const mat = keep(new THREE.MeshStandardMaterial({ color: '#376075', metalness: 0.5, roughness: 0.4 }));
          const checkpoint = buildKitPreset({
            parts: { post: { source: { kind: 'box', size: [0.4, 5, 0.4] }, material: 'checkpoint', rank: 0 }, bar: { source: { kind: 'box', size: [12.4, 0.4, 0.4] }, material: 'checkpoint', rank: 0 } },
            assemblies: { main: { children: [{ ref: 'post', at: [-6, 0, 0] }, { ref: 'post', at: [6, 0, 0] }, { ref: 'bar', at: [0, 5, 0] }] } },
          }, 'main', { materials: { checkpoint: mat }, maxRank: 0, gen: () => null, keep });
          if (!checkpoint) throw new Error('Cannot build circuit checkpoint');
          checkpoint.group.position.set(point.x, groundAt(point.x, point.z), point.z);
          planetScene.add(checkpoint.group); checkpointMaterials.push(mat);
        }
        api.setCircuitCheckpoint(0);
      }
    },
    setPlanet(base, lookFor, neighbours) {
      if (world) return;
      lookForFn = lookFor;
      // the plot's natural ground (its own terrain and materials); the old world brings the sky, the stars and the neighbours, seated on it
      const g = createPlotGround(planetScene, { seed: worldSeed, sunDir: SUN, stage: Math.max(1, stage), textureSize: o.groundTexture, budget: detail.groundBudget, cover: coverTiles });
      ground = g;
      // the gate's apron is always kept out (TASK-21d); the play screen adds the structures and machines as the base changes
      g.setKeepOut(keepOutZones({ gate: { x: 0, z: 0 }, structures: [], pieces: [], machines: [] }));
      // the saved sculpt edits and paint go in before the first chunks are built, so the ground is built as edited
      if (pendingBeamField !== null) {
        g.importField(pendingBeamField);
        pendingBeamField = null;
      }
      world = createWorld(planetScene, { gridSpacing: o.gridSpacing, reducedMotion: o.reducedMotion, ground: false });
      world.setPlanet(base, neighbours, { treeDetailRange: 150, height: (x, z) => g.terrain.height(x, z) + 0.6 });
      const currentLookStage = Math.max(1, Math.min(6, Math.floor(stage))) as Stage;
      world.show(lookFor(currentLookStage));
      const gy = g.heightAt(0, 0);
      padTop = gy + 0.25;
      twin.group.position.set(0, gy, 0);
      buildStargate();
      syncPlanetMatrices();
      g.update(0, 0, true);
      holo.build(g, { x: 0, z: 0 });

      // ---- plot biome scatter view (TICKET-02 item F)
      const effectiveTier = vegSetting === 'off' ? 'off' : vegSetting === 'high' ? 'high' : 'low';
      biomeView = createPlotBiomeView(planetScene, {
        heightAt: (x, z) => g.heightAt(x, z),
        tier: effectiveTier,
      });
      const bInput = cachedBiomeInput ?? buildDefaultBiomeInput(g);
      cachedBiomeInput = bInput;
      biomeView.build(bInput);
      biomeView.setStage(shown);
      if (Object.keys(treeOverrides).length > 0) biomeView.setTreeOverrides(treeOverrides);
      if (!stageCoverTextures[0]) {
        applyCoverage(shown);
        buildAndAttachWaterSurfaces(shown);
      }
    },
    restore(s) {
      gateOn = s.gateOn;
      rebuildPlanetStatic();
      syncOpeningMaterial();
      room.setPower(gateOn ? POWER_ON : POWER_OFF);
      if (gateOn) {
        room.lever.rotation.x = -1.1;
        gameAudio.startGateHum({ x: 0, y: 1.0, z: -1.0 });
        gameAudio.startCapacitorHum({ x: -7.2, y: 1.0, z: 1.0 });
      }
      openingUniforms.uStatic.value = gateOn ? 0 : 1;
      stage = shown = s.plot.stage;
      if (world && lookForFn) {
        const currentLookStage = Math.max(1, Math.min(6, Math.floor(stage))) as Stage;
        world.show(lookForFn(currentLookStage));
      }
      scanWave = createScanWave();
      if (s.plot.stage >= 1 || stage0IsDithered(s.plot.machines.length)) markScanWaveDone(scanWave);
      plotLx = plotLevel(s.plot, 'lx');
      currentFloats = {
        Pxd: plotLevel(s.plot, 'pxd'),
        Vtx: plotLevel(s.plot, 'vtx'),
        Lx: plotLevel(s.plot, 'lx'),
        Aq: plotLevel(s.plot, 'aq'),
      };
      room.setFloats(currentFloats);
      room.setStorm(Math.min(1, Math.max(0, stage / 6)));
      gameAudio.updateStormVolume(1.0 - Math.min(1, Math.max(0, stage / 6)));
      waveTo = -1;
      ground?.setStage(Math.max(1, stage));
      biomeView?.setStage(stage);
      applyCoverage(stage);
      if (waterGroup) waterGroup.visible = stage >= 4;
      fitLooks();
      propStage = stage <= 1 ? 1 : 6;
      rebuildTwin(propStage);
      if (where === 'lab') {
        if (scientistHolder.parent !== labScene) {
          planetScene.remove(scientistHolder);
          labScene.add(scientistHolder);
        }
        if (companionEntity && companionEntity.group.parent !== labScene) {
          planetScene.remove(companionEntity.group);
          labScene.add(companionEntity.group);
        }
      } else {
        if (scientistHolder.parent !== planetScene) {
          labScene.remove(scientistHolder);
          planetScene.add(scientistHolder);
        }
        if (companionEntity && companionEntity.group.parent !== planetScene) {
          labScene.remove(companionEntity.group);
          planetScene.add(companionEntity.group);
        }
      }
      api.setPlot(s.plot, s.running, s.connected);
      holo.setPlot(s.plot, s.running, s.connected);
      // a restored plot's machines are already running: their pixels show at once
      for (const v of views.values()) if (v.emitter !== null) { plume.remove(v.emitter); v.emitter = null; }
      for (const v of views.values()) {
        if (v.vent && Math.round(v.share * 100) > 5) v.emitter = addPlume(v, v.vent, -100);
        if (v.glow) {
          v.glow.visible = detail.plumeGlow && v.running > 0.05;
          setGlowStrength(v.glow, Math.min(1.0, v.running) * 0.75);
        }
        if (v.light) {
          v.light.visible = detail.pixelLights && v.running > 0.05;
          v.light.intensity = v.light.visible ? v.running * 12.0 : 0;
        }
      }
    },
    setPlot(plot, running, connected, satisfaction = 1) {
      gridSatisfaction = satisfaction;
      const ids = new Set(plot.machines.map((mm) => mm.id));
      let changed = false;
      for (const [id, v] of views) if (!ids.has(id)) { unbuild(v); views.delete(id); changed = true; }
      for (const mm of plot.machines) if (!views.has(mm.id)) { views.set(mm.id, build(mm)); changed = true; }
      if (changed) {
        scheduleBiomeRebuild();
        scheduleCoverRebuild();
      }
      rebuildPlanetStatic();
      const sameNet = connected.size === lastConnected.size && [...connected].every((id) => lastConnected.has(id));
      if (changed || !sameNet) { relay(connected); lastConnected = new Set(connected); }
      holo.setPlot(plot, running, connected);
      plotLx = plotLevel(plot, 'lx');
      currentFloats = {
        Pxd: plotLevel(plot, 'pxd'),
        Vtx: plotLevel(plot, 'vtx'),
        Lx: plotLevel(plot, 'lx'),
        Aq: plotLevel(plot, 'aq'),
      };
      room.setFloats(currentFloats);
      // the first machine standing on stage 0 starts the scan wave from its own spot (0a to 0b, the same rule as the HUD's skin); past stage 0 the world is resolved
      if (plot.stage >= 1) markScanWaveDone(scanWave);
      else if (!scanWave.done && scanWave.startSec === null && stage0IsDithered(plot.machines.length)) {
        const newest = plot.machines[plot.machines.length - 1];
        const view = newest ? views.get(newest.id) : undefined;
        if (view) {
          const p = view.prop.group.getWorldPosition(new THREE.Vector3());
          triggerScanWave(scanWave, clock, { x: p.x, y: p.y, z: p.z });
        }
      }
      if (changed) syncMonstersNavAndSolids(activeBase);
      // pixels pour from every machine while it operates (ARGO_NOTE_08): a machine that is off, unpowered or out of ore pours nothing.
      // A pylon sparks while its line is under load: connected, powered, and some machine on the grid runs.
      let gridLoaded = false;
      for (const x of running.values()) if (x > 0.05) { gridLoaded = true; break; }
      // lamps and housing status LEDs (POL-39) show which run
      for (const v of views.values()) {
        const r = running.get(v.m.id) ?? 0;
        v.share = v.m.kind === 'pylon' ? (connected.has(v.m.id) && satisfaction > 0 && gridLoaded ? 1 : 0) : r;
        noteMachineActivationPulse(v.m.id, v.m.kind, v.m.x, v.m.z, r);
        if ((r > 0.05) !== (v.running > 0.05)) v.prop.light(r > 0.05 ? 1 : 0.1);
        v.prop.setStatusLed?.(r, connected.has(v.m.id), satisfaction, clock);
        v.running = r;
        if (v.glow) {
          v.glow.visible = detail.plumeGlow && r > 0.05;
          setGlowStrength(v.glow, Math.min(1.0, r) * 0.75);
        }
        if (v.light) {
          v.light.visible = detail.pixelLights && r > 0.05;
          v.light.intensity = v.light.visible ? r * 12.0 : 0;
        }
        // the plume is up while the machine's run reads above 5% (the inspector's plumeOn: runPct > 5), and no longer
        const plumeOn = Math.round(v.share * 100) > 5;
        if (plumeOn && v.vent && v.emitter === null) v.emitter = addPlume(v, v.vent, clock + 0.6);
        else if (!plumeOn && v.emitter !== null) { plume.remove(v.emitter); v.emitter = null; v.pour = 0; }
        // TASK-26: the pour follows the run share (and its cadence each frame, in tickMachinePlumes)
        if (v.emitter !== null) { v.pour = machinePlumeCount(v.m.kind, v.share, clock); plume.setCount(v.emitter, v.pour); }
      }
    },
    richness(x, z) {
      if (!ground) return 0;
      // rock, scree, gravel, dust, cracked flats, red soil: ore is in the rock
      const w = ground.terrain.materials(x, z);
      const ore = [1, 0.85, 0.55, 0.1, 0.3, 0.6];
      let sum = 0, total = 0;
      w.forEach((v, i) => { sum += v * ore[i]!; total += v; });
      return total > 0 ? sum / total : 0;
    },
    pullLever() {
      if (gateOn || powerT >= 0) return;
      powerT = 0;
      relaysHeard = 0;
      gameAudio.playLever({ x: -6.5, y: 1.0, z: -7.8 });
      gameAudio.playBreaker({ x: -7.4, y: 1.0, z: -1.0 });
      sfx('lever-throw');
      scientistAnimator?.playOneShot('lever');
    },
    setBuilding(kind, check) {
      const k = kind && where === 'planet' ? kind : null;
      if (k !== ghostKind) { dropGhost(); ghostKind = k; if (k) { ghost = machineProp(m, k, propStage); paintGhost(false); planetScene.add(ghost.group); } }
      ghostCheck = check ?? null;
      building = !!k;
      if (ghost) ghost.group.visible = false;
      ghostVerdict = { ok: false, why: '' };
    },
    aim() {
      if (!building || !ghostVerdict.ok) return null;
      const g = twin.group.position;
      return { x: ghostAt.x, z: ghostAt.z, yaw: Math.atan2(ghostAt.x - g.x, ghostAt.z - g.z) };
    },
    setPieceGhost(group) {
      if (pieceGhost) {
        planetScene.remove(pieceGhost);
        pieceGhost.traverse((obj) => {
          const mesh = obj as THREE.Mesh;
          if (mesh.isMesh) mesh.geometry?.dispose();
        });
        pieceGhost = null;
      }
      if (group) {
        pieceGhost = group;
        pieceGhost.visible = false;
        planetScene.add(pieceGhost);
      }
    },
    placePieceGhost(pose, tint) {
      ghostXZ = pose && !heldBeam.group.visible ? { x: pose.x, z: pose.z } : null;
      updateActiveSocket();
      if (!pieceGhost) return;
      // the held rifle takes the hand: the held blueprint's ghost (and its verdict colour) waits until the rifle is put away
      if (!pose || heldBeam.group.visible) {
        pieceGhost.visible = false;
        return;
      }
      pieceGhost.visible = true;
      pieceGhost.position.set(pose.x, pose.y, pose.z);
      pieceGhost.rotation.y = pose.yaw;
      const mat =
        tint === 'grounded'
          ? pieceGhostGrounded
          : tint === 'ok'
            ? pieceGhostOk
            : tint === 'weak'
              ? pieceGhostWeak
              : pieceGhostBad;
      pieceGhost.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.isMesh) mesh.material = mat;
      });
    },
    setPieces(group) {
      if (piecesGroup && piecesGroup !== group) {
        planetScene.remove(piecesGroup);
      }
      piecesGroup = group;
      if (piecesGroup && !planetScene.children.includes(piecesGroup)) {
        planetScene.add(piecesGroup);
      }
    },
    setBase(base) {
      activeBase = base;
      // the sanctuaries: the gate dome, and each sealed room's life support (B-07)
      const lifeSupport = base ? base.pieces.filter((p) => p.kind === 'lifeSupport').map((p) => pieceAt(base, p)).filter((p): p is { x: number; y: number; z: number } => p !== null) : [];
      monsters.setSafeZones(monsterSafeZones({ x: twin.group.position.x, z: twin.group.position.z }, lifeSupport));
      syncMonstersNavAndSolids(base);
      scheduleBiomeRebuild();
      scheduleCoverRebuild();
    },
    setPlotGate(pose) {
      const gy = ground ? ground.heightAt(pose.x, pose.z) : pose.y;
      padTop = gy + 0.25;
      twin.group.position.set(pose.x, gy, pose.z);
      twin.group.rotation.y = pose.yaw;
      syncPlanetMatrices();
      holo.build(ground ?? undefined as unknown as PlotGround, { x: pose.x, z: pose.z });
      ground?.setKeepOut(keepOutZones({ gate: { x: pose.x, z: pose.z }, structures: [], pieces: [], machines: [] }));
      monsters.setPlot(worldSeed, { x: pose.x, z: pose.z });
    },
    setGateAccess(access) {
      if (access === gateAccess) return;
      gateAccess = access;
      // the iris moving is a gate event: the kawoosh's burst restarts from this frame (a pure timestamp, not a phase)
      lastGateEventT = clock;
      buildStargate();
      rebuildPlanetStatic();
    },
    setSpeciesSlots(slots) {
      return biomeView ? biomeView.setSpeciesSlots(slots) : 0;
    },
    gateArrival(sector) {
      // the pad the gate's own placement resolved: a point on the plot, facing away from the ring
      pos.set(sector.x, groundAt(sector.x, sector.z) + EYE, sector.z);
      yaw = sector.yaw;
      pitch = 0;
      building = false;
      if (ghost) ghost.group.visible = false;
      // stepping out of a horizon is a gate event: the kawoosh's burst restarts from this frame
      lastGateEventT = clock;
    },
    gateExit(dist) {
      twin.group.updateMatrixWorld(true);
      return computeGateExitPose(twin.group.matrixWorld.elements, gateYawDelta, dist);
    },
    setSyncHeld(held) { syncHeld = held; if (held) sync = 1; },
    setWalkWorld(walkWorld) {
      activeWalkWorld = walkWorld;
    },
    setSocketRings(poses) {
      const count = Math.min(48, poses.length);
      socketRingMesh.count = count;
      socketRingMesh.visible = count > 0;
      const m4 = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      const s = new THREE.Vector3(1, 1, 1);
      const p = new THREE.Vector3();
      for (let i = 0; i < count; i++) {
        const pose = poses[i]!;
        p.set(pose.x, pose.y + 0.05, pose.z);
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), pose.yaw);
        m4.compose(p, q, s);
        socketRingMesh.setMatrixAt(i, m4);
      }
      socketRingMesh.instanceMatrix.needsUpdate = true;
      socketPoses = poses.slice(0, count);
      updateActiveSocket();
    },
    setPlanGhosts(ghosts) {
      while (planGhostsGroup.children.length > 0) {
        const child = planGhostsGroup.children[0]!;
        planGhostsGroup.remove(child);
      }
      for (const g of ghosts) {
        const instance = globalKitPieceCache.instantiate(g.kind, 1, 0);
        const lines: THREE.LineSegments[] = [];
        instance.group.traverse((obj) => {
          if ((obj as THREE.Mesh).isMesh) {
            const mesh = obj as THREE.Mesh;
            mesh.material = planGhostMat;
            if (mesh.geometry) {
              const edges = new THREE.LineSegments(
                new THREE.EdgesGeometry(mesh.geometry, 24),
                planGhostEdgeMat
              );
              lines.push(edges);
            }
          }
        });
        for (const l of lines) {
          instance.group.add(l);
        }
        instance.group.position.set(g.at.x, g.at.y, g.at.z);
        instance.group.rotation.y = g.yaw;
        planGhostsGroup.add(instance.group);
      }
    },
    setShelterDome(at) {
      shelterDome = at ? { x: at.x, z: at.z } : null;
    },
    setSheltered(sheltered) {
      isSheltered = sheltered;
    },
    isSheltered() {
      return isSheltered;
    },
    heightAt: (x, z) => groundAt(x, z),
    aimPoint: () => aimPointFn(),
    lockGhost() {
      if (ghostLock) return true;
      const a = aimGround();
      if (!a) return false;
      ghostLock = { x: a.x, z: a.z };
      ghostLockOrigin = { x: a.x, z: a.z };
      return true;
    },
    releaseGhost() {
      ghostLock = null;
      ghostLockOrigin = null;
    },
    nudgeGhost(dx, dz) {
      if (!ghostLock || !ghostLockOrigin) return;
      const nx = ghostLock.x + dx, nz = ghostLock.z + dz;
      const ox = ghostLockOrigin.x, oz = ghostLockOrigin.z;
      const d = Math.hypot(nx - ox, nz - oz);
      const k = d > MAX_NUDGE_M ? MAX_NUDGE_M / d : 1;
      ghostLock = { x: ox + (nx - ox) * k, z: oz + (nz - oz) * k };
    },
    ghostLocked: () => ghostLock !== null,
    setNodes(field) {
      if (!field) {
        for (const k of (['dither', 'fold', 'chroma', 'spire'] as const)) {
          const m = nodeMeshes[k];
          if (m) m.visible = false;
        }
        return;
      }
      const mat4 = new THREE.Matrix4();
      const scaleV = new THREE.Vector3();
      const rotQ = new THREE.Quaternion();
      const posV = new THREE.Vector3();
      const col = new THREE.Color();

      for (const kind of (['dither', 'fold', 'chroma', 'spire'] as const)) {
        const list = field.nodes.filter((n) => n.kind === kind);
        let mesh = nodeMeshes[kind];
        if (!mesh || mesh.count !== list.length) {
          if (mesh) {
            planetScene.remove(mesh);
            mesh.dispose();
          }
          mesh = new THREE.InstancedMesh(nodeGeometries[kind], nodeMaterials[kind], list.length);
          mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
          nodeMeshes[kind] = mesh;
          planetScene.add(mesh);
        }
        mesh.visible = true;
        const maxVal = F.MAX[kind];
        const baseCol = nodeBaseColours[kind];

        for (let i = 0; i < list.length; i++) {
          const n = list[i]!;
          const ratio = Math.max(0, Math.min(1, n.reserve / maxVal));
          if (n.reserve <= 0.001) {
            scaleV.set(0, 0, 0);
          } else {
            const s = 0.4 + 0.6 * ratio;
            scaleV.set(s, s, s);
          }
          // the outcrop's buried root skirt (outcrops.ts) reaches below the ground at these heights, so no node floats
          const ny = groundAt(n.x, n.z) + (kind === 'spire' ? 0.7 : 0.35);
          posV.set(n.x, ny, n.z);
          rotQ.identity();
          mat4.compose(posV, rotQ, scaleV);
          mesh.setMatrixAt(i, mat4);

          col.copy(baseCol).multiplyScalar(0.35 + 0.65 * ratio);
          mesh.setColorAt(i, col);
        }
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      }
    },
    aimNode(field, reach = BEAM_RANGE) {
      if (!field || where !== 'planet') return null;
      const p = pos;
      const camPos = camera.position;
      const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
      let bestNode: F.Node | null = null;
      let bestDist = Infinity;

      for (const node of field.nodes) {
        if (node.reserve <= 0) continue;
        const dx = node.x - p.x;
        const dz = node.z - p.z;
        if (Math.hypot(dx, dz) > reach) continue;

        const ny = groundAt(node.x, node.z) + 0.5;
        const nodePos = new THREE.Vector3(node.x, ny, node.z);
        const toNode = nodePos.clone().sub(camPos);
        const proj = toNode.dot(dir);
        if (proj <= 0) continue;

        const rayPoint = camPos.clone().addScaledVector(dir, proj);
        const distToRay = rayPoint.distanceTo(nodePos);
        if (distToRay < 1.6 && distToRay < bestDist) {
          bestDist = distToRay;
          bestNode = node;
        }
      }
      return bestNode;
    },
    setBeam(from, to, mode, colour, on) {
      if (!on && beamPinned) return; // a check pins the last beam on screen (debug.pinBeam)
      if (on && from && to) {
        gameAudio.startBeamLoop(from);
        const vFrom = new THREE.Vector3(from.x, from.y, from.z);
        const vTo = new THREE.Vector3(to.x, to.y, to.z);
        const beamCol = colour === '#d9d9d9' ? '#00e5ff' : colour;
        beamFx.set(vFrom, vTo, mode, beamCol, true);
        // Extract's stream of chunks runs from the hit point into the muzzle (TASK-21d); Apply and Sculpt draw none
        beamVisuals.setStream(mode === 'extract' ? vTo : null, mode === 'extract' ? vFrom : null, clock);
        // TICKET-05 (Item E): the tapered glowing core from the muzzle (the rifle's socket, first and third person) to the hit, in every mode
        beamVisuals.setCore(vFrom, vTo, mode, clock, beamSealingNow);

        const dir = vTo.clone().sub(vFrom);
        const dist = dir.length();
        if (dist > 0.001) {
          const mid = vFrom.clone().add(vTo).multiplyScalar(0.5);
          beamCoreMesh.position.copy(mid);
          beamCoreMesh.scale.set(1, dist, 1);
          beamCoreMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
          beamCoreUniforms.uColour.value.set(beamCol);
          beamCoreMesh.visible = true;

          beamSparkMesh.position.copy(vTo);
          beamSparkUniforms.uColour.value.set(beamCol);
          beamSparkMesh.visible = true;

        } else {
          beamCoreMesh.visible = false;
          beamSparkMesh.visible = false;
        }
      } else {
        gameAudio.stopBeamLoop();
        beamFx.object.visible = false;
        beamVisuals.setStream(null, null, clock);
        beamVisuals.setCore(null, null, mode, clock);
        beamCoreMesh.visible = false;
        beamSparkMesh.visible = false;
      }
    },
    beamMuzzle() {
      // the held rifle's muzzle socket: in the view in first person, in the right hand in third; otherwise in front of the camera
      if (heldBeam.group.visible && cameraView === 'first') {
        const socket = heldBeam.sockets.muzzle.clone().applyQuaternion(heldBeam.group.quaternion).add(heldBeam.group.position);
        const w = camera.localToWorld(socket);
        return { x: w.x, y: w.y, z: w.z };
      }
      if (heldBeam.group.visible && rifleHand !== null) {
        const w = heldBeam.group.localToWorld(heldBeam.sockets.muzzle.clone());
        return { x: w.x, y: w.y, z: w.z };
      }
      const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
      const rgt = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
      const m = camera.position.clone().add(fwd.multiplyScalar(0.4)).add(rgt.multiplyScalar(0.2)).add(up.multiplyScalar(-0.15));
      return { x: m.x, y: m.y, z: m.z };
    },
    raiseStage(to, from) {
      if (to <= stage) return;
      scientistAnimator?.playOneShot('cheer');
      // a wave still running is overtaken: the stage it was bringing shows at once
      if (waveTo >= 0) {
        shown = waveTo;
        world?.settle();
        biomeView?.setStage(shown);
        applyCoverage(shown);
        if (waterGroup) waterGroup.visible = shown >= 4;
      }
      stage = to;
      room.setStorm(Math.min(1, Math.max(0, to / 6)));
      gameAudio.updateStormVolume(1.0 - Math.min(1, Math.max(0, to / 6)));
      gameAudio.setMoonStage(to);
      waveTo = to;
      waveStart = clock + (shown === 0 ? 2.0 : 0.8);
      postUniforms.uWaveCentre.value.set(from.x, groundAt(from.x, from.z), from.z);
      if (world && lookForFn) {
        const targetStage = Math.max(1, Math.min(6, Math.floor(to))) as Stage;
        world.setTarget(lookForFn(targetStage));
      }
      ground?.setStage(Math.max(1, to));
      monsters.setFidelityStage(to);
      wrecks.setStage(to);
      fitLooks();
    },
    setFidelityStage(to) {
      const s = Math.max(0, Math.min(6, Math.floor(to)));
      stage = s;
      if (s >= 1) markScanWaveDone(scanWave);
      shown = s;
      room.setStorm(Math.min(1, Math.max(0, s / 6)));
      gameAudio.updateStormVolume(1.0 - Math.min(1, Math.max(0, s / 6)));
      gameAudio.setMoonStage(s);
      waveTo = -1;
      if (world && lookForFn) {
        world.show(lookForFn(Math.max(1, s) as Stage));
      }
      ground?.setStage(Math.max(1, s));
      biomeView?.setStage(s);
      applyCoverage(s);
      if (waterGroup) waterGroup.visible = s >= 4;
      monsters.setFidelityStage(s);
      wrecks.setStage(s);
      fitLooks();
      rebuildProps(s);
    },
    frame(now, dt, c) {
      clock = now;
      beamFx.update(clock);
      updatePing();
      holoUniforms.uTime.value = now;
      openingOffUniforms.uTime.value = now;
      // the horizon's four envelopes, straight from the clock and the gate's state (JOB-08b)
      applyEventHorizon(
        horizonMat,
        eventHorizonUniforms(
          now,
          { open: gateOn, irisClosed: irisClosedForAccess(gateAccess), chevrons: gateOn ? CHEVRON_COUNT : 0 },
          lastGateEventT,
        ),
      );
      socketActiveMat.opacity = socketMarkerOpacity(true, now);
      // ---- the wake: the camera's lift above level, from its start to the 2.2 s the player takes to sit up
      if (wakeT >= 0) {
        if (wakeLog.length < 400) wakeLog.push({ t: wakeT, lift: wakeLift(wakeT) });
        wakeT += dt;
        if (wakeT >= WAKE_SECONDS) wakeT = -1;
      }
      // ---- the power-on sequence
      if (powerT >= 0) {
        const before = powerT;
        powerT += dt;
        const crossed = (at: number): boolean => before < at && powerT >= at;
        if (crossed(0.05)) gameAudio.playLever({ x: -6.5, y: 1.0, z: -7.8 });
        if (crossed(0.2)) gameAudio.playBreaker({ x: -7.4, y: 1.0, z: -1.0 });
        if (crossed(1.2)) {
          gameAudio.startCapacitorHum({ x: -7.2, y: 1.0, z: 1.0 });
          sfx('power-surge');
        }
        if (crossed(2.0)) {
          gameAudio.playGateSpool({ x: 0, y: 1.0, z: -1.0 });
          gameAudio.playGateIgnitionCharge();
          sfx('coil-charge');
        }
        if (crossed(3.8)) sfx('static-burst', { volume: 0.6 });
        if (crossed(POWER_SECONDS - 0.6)) sfx('gate-open');
        room.lever.rotation.x = -1.1 * Math.min(1, powerT / 0.35);
        const p = powerAt(powerT);
        const lit = Math.floor(p.relays * 12);
        while (relaysHeard < lit) {
          relaysHeard++;
          const pitch = 0.92 + (relaysHeard % 4) * 0.05;
          gameAudio.playRelay({ x: -7.6, y: 1.0, z: -2.6 - (relaysHeard % 4) * 0.9 }, pitch);
          sfx('relay-click', { pitch });
        }
        room.setPower(p);
        openingUniforms.uStatic.value = p.static;
        if (powerT >= POWER_SECONDS) {
          powerT = -1;
          gateOn = true;
          rebuildPlanetStatic();
          lastGateEventT = clock;
          syncOpeningMaterial();
          pendingEvent = 'powered';
          gameAudio.startGateHum({ x: 0, y: 1.0, z: -1.0 });
        }
      }
      // ---- look and walk
      const sens = 0.0024;
      yaw -= c.look.dx * sens;
      pitch = Math.max(-1.45, Math.min(1.45, pitch - c.look.dy * sens));
      // the locomotion preset in force (plan 43, loc:): speed, jump, gravity, air control and the landing spring all read
      // from it, so a switch mid-jump retunes the rest of the arc without resetting the state
      const baseLoco = activeLocomotion(where);
      const loco = o.gamePreset ? { ...baseLoco, gravityMps2: 9.81 * o.gamePreset.activeRules.gravityScale } : baseLoco;
      const speed = locomotionSpeed(loco, Boolean(c.run), !jumpState.onGround) * dt;
      const before = pos.clone();

      if (drivingVehicleId !== lastDrivingVehicleId) {
        if (drivingVehicleId !== null) {
          const vv = vehicleViews.get(drivingVehicleId);
          gameAudio.setDriving(true);
          if (vv) gameAudio.startRoverMotor(drivingVehicleId, vv.kind, vv.group.position);
        } else if (lastDrivingVehicleId !== null) {
          gameAudio.stopRoverMotor(lastDrivingVehicleId);
          gameAudio.setDriving(false);
        }
        lastDrivingVehicleId = drivingVehicleId;
      }

      if (drivingVehicleId !== null && drivingState) {
        const vView = vehicleViews.get(drivingVehicleId);
        if (vView) {
          const throttle = c.vehicleInput?.throttle ?? (c.move.z > 0.05 ? 1 : c.move.z < -0.05 ? -1 : 0);
          // VEH-02: A/Left (move.x < 0) is -1 (turn left), D/Right is +1 (turn right); see Input.steer in @hm/rover
          const steer = c.vehicleInput?.steer ?? (c.move.x < -0.05 ? -1 : c.move.x > 0.05 ? 1 : 0);
          const brake = c.vehicleInput?.brake ?? false;
          const boost = c.vehicleInput?.boost ?? c.run ?? false;
          const rawInput = { throttle, steer, brake };
          const boosted = boostedInput(rawInput, boost, roverBoostEnergy, dt);
          roverBoostEnergy = boosted.energy;
          isRoverBoosting = boosted.boosting;
          // Plan 47: the harness's traction output feathers the drive — τ ∝ (1 − 0.55·slip) — so a
          // skidding soul eases its own wheels. Smooth and causal (last step's slip); never a clamp.
          const tractionFeather = 1.0 - 0.55 * harnessActuator.tractionSlipRatio;
          const input = { throttle: boosted.throttle * tractionFeather, steer: boosted.steer, brake: boosted.brake };
          const gWorld = o.gamePreset ? 9.81 * o.gamePreset.activeRules.gravityScale : 1.62;

          vehicleAcc += Math.min(dt, 0.1);
          while (vehicleAcc >= ROVER_DT) {
            drivingState = stepRover(drivingState, input, {
              height: (gx, gz) => groundAt(gx, gz),
              g: gWorld,
            });
            // Plan 47 (Pillar 1): the vessel soul feels the same fixed step. Lateral velocity is
            // measured against the body's right axis; its change is the real chassis jolt.
            const hqx = drivingState.q[0], hqy = drivingState.q[1], hqz = drivingState.q[2], hqw = drivingState.q[3];
            const yawNow = Math.atan2(2 * (hqy * hqw + hqx * hqz), 1 - 2 * (hqy * hqy + hqz * hqz));
            const latVel = drivingState.v[0] * Math.cos(yawNow) - drivingState.v[2] * Math.sin(yawNow);
            harnessConcussionDb = Math.max(0, harnessConcussionDb - 240 * ROVER_DT);
            const harnessInput = deriveRoverHarnessInput(
              latVel, harnessPrevLatVel, ROVER_DT, harnessVessel.substrate.massKg, gWorld,
              harnessConcussionDb, Math.abs(roverSpeed(drivingState)),
            );
            stepRoverEscortHarness(
              harnessState, harnessTel, harnessLedger, harnessLatch, harnessLatchAccum, harnessMastery,
              harnessScratch, harnessVessel, harnessTuning, harnessInput, ROVER_DT, true, harnessActuator,
            );
            harnessPrevLatVel = latVel;
            vehicleAcc -= ROVER_DT;
          }

          currentSpeed = roverSpeed(drivingState);
          gameAudio.updateRoverMotor(drivingVehicleId, vView.group.position, currentSpeed, ROVERS[vView.kind].topSpeed);
          if (lastRoverSpeed - currentSpeed > 6.0) {
            gameAudio.playRoverImpact(vView.group.position);
            // The impact the player hears is the concussion the vessel soul feels (decays 240 dB/s).
            harnessConcussionDb = 120;
          }
          lastRoverSpeed = currentSpeed;
          harnessVm = computeHarnessHudViewModel(
            harnessState, harnessLedger, harnessLatch[0]!, harnessMastery[0]!,
            harnessVessel.evaluator.masteryWindowSec, harnessVessel.relativeAwarenessCeiling,
          );
          vView.x = drivingState.p[0];
          vView.z = drivingState.p[2];

          const qx = drivingState.q[0], qy = drivingState.q[1], qz = drivingState.q[2], qw = drivingState.q[3];
          vView.yaw = Math.atan2(2 * (qy * qw + qx * qz), 1 - 2 * (qy * qy + qz * qz));

          vView.group.position.set(drivingState.p[0], drivingState.p[1], drivingState.p[2]);
          vView.target?.setPose(drivingState.p[0], drivingState.p[1], drivingState.p[2], vView.yaw);
          vView.group.quaternion.set(qx, qy, qz, qw);
          vView.group.updateMatrixWorld(true);

          const wheelRadius = vView.mesh.wheelRadius;
          vView.wheelAngle += (currentSpeed * dt) / wheelRadius;
          const maxSteer = ROVERS[vView.kind].maxSteer;
          const steerAngle = steer * maxSteer;

          const wheelWorldPos = new THREE.Vector3();
          for (let i = 0; i < vView.wheelPivots.length; i++) {
            const hub = vView.mesh.hubs[i];
            const pivot = vView.wheelPivots[i];
            const wheel = vView.wheelMeshes[i];
            if (pivot && wheel) {
              if (hub && hub[2] > 0) {
                pivot.rotation.y = steerAngle;
              }
              wheel.rotation.x = vView.wheelAngle;
              pivot.getWorldPosition(wheelWorldPos);
              const gy = groundAt(wheelWorldPos.x, wheelWorldPos.z);
              if (Math.abs(currentSpeed) > 0.3 && Math.abs(wheelWorldPos.y - gy) < wheelRadius * 3.0) {
                tracks.add({ x: wheelWorldPos.x, y: gy, z: wheelWorldPos.z }, [0, 1, 0], vView.kind === 'hauler' ? 0.45 : 0.35, vView.yaw);
                roost.emit({ x: wheelWorldPos.x, y: gy, z: wheelWorldPos.z }, currentSpeed, Math.abs(steer) * 0.4, dt);
              }
            }
          }

          if (vView.mesh.parts['steeringWheel']) {
            vView.mesh.parts['steeringWheel'].rotation.z = -steerAngle * 2.2;
          }
          if (vView.mesh.parts['arm']) {
            vView.mesh.parts['arm'].rotation.x = -Math.PI / 8;
          }

          pos.x = drivingState.p[0];
          pos.z = drivingState.p[2];
          pos.y = drivingState.p[1] + EYE;
        }
      } else {
        isRoverBoosting = false;
        roverBoostEnergy = Math.min(1, roverBoostEnergy + 0.25 * dt);
      }
      if (debugAltCam && altCamPos) {
        // Locked by debug.setAltCam
      } else if (c.altCam && where === 'planet') {
        if (!altCamPos) {
          altCamPos = (cameraView === 'third' ? camera.position.clone() : pos.clone());
        }
        const flySpeed = locomotionSpeed(loco, Boolean(c.run), false) * 1.5 * dt;
        const camRot = new THREE.Euler(pitch, yaw, 0, 'YXZ');
        const fwd = new THREE.Vector3(0, 0, -1).applyEuler(camRot);
        const rgt = new THREE.Vector3(1, 0, 0).applyEuler(camRot);
        altCamPos.addScaledVector(fwd, c.move.z * flySpeed);
        altCamPos.addScaledVector(rgt, c.move.x * flySpeed);
        if (c.flyUp) {
          altCamPos.y += c.flyUp * flySpeed;
        }
        const dist = altCamPos.distanceTo(pos);
        if (dist > 30) {
          altCamPos.sub(pos).normalize().multiplyScalar(30).add(pos);
        }
      } else {
        altCamPos = null;
        const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
        pos.x += (fx * c.move.z + rx * c.move.x) * speed;
        pos.z += (fz * c.move.z + rz * c.move.x) * speed;
        if (jumpState.onGround) {
          stride += Math.hypot(pos.x - before.x, pos.z - before.z);
          if (stride > 1.35) {
            stride = 0;
            sfx('step-grit', where === 'planet' ? { pitch: 0.85 + Math.random() * 0.25, volume: 0.55 } : { pitch: 1.5 + Math.random() * 0.2, volume: 0.3 });
          }
        }
      }

      if (where === 'lab') {
        collide(pos, before);
        const fh = room.floorHeight(pos.x, pos.z);
        jumpState = stepVerticalJump(jumpState, { dt, jumpHeld: Boolean(c.jump), maxHeadroomM: 2.1 }, loco);
        if (jumpState.justJumped) sfx('step-grit', { pitch: 1.75, volume: 0.35 });
        if (jumpState.justLanded) sfx('step-grit', { pitch: 1.25, volume: 0.45 });
        pos.y = fh + EYE + jumpState.heightAboveFloor + jumpState.landingDip;
      } else if (drivingVehicleId === null) {
        // keep to your plot's surroundings; stand on the ground or base
        const r = Math.hypot(pos.x, pos.z);
        if (r > 420) { pos.x *= 420 / r; pos.z *= 420 / r; }
        if (!c.altCam) {
          // TICKET-01 B: the moon's solids (the twin's frame and the field machines), each in its own frame, block first; then the base's walk world
          const feetY = pos.y - EYE - jumpState.heightAboveFloor - jumpState.landingDip;
          let solid = { x: pos.x, z: pos.z };
          for (const sol of planetSolids) solid = pushCircleInFrame(before, solid, feetY, RADIUS, sol.boxes, sol.m);
          pos.x = solid.x;
          pos.z = solid.z;
          let standY = groundAt(pos.x, pos.z);
          if (activeWalkWorld) {
            const pushed = activeWalkWorld.push(pos.x, pos.z, feetY, 0.35);
            pos.x = pushed.x;
            pos.z = pushed.z;
            standY = activeWalkWorld.standAt(pos.x, pos.z, feetY, standY);
          }
          // plan 53: the bridge pad's deck is floor
          if (bridgePad) standY = Math.max(standY, bridgePadFloor(pos.x, pos.z));
          jumpState = stepVerticalJump(jumpState, { dt, jumpHeld: Boolean(c.jump) }, loco);
          if (jumpState.justJumped) sfx('step-grit', { pitch: 1.25, volume: 0.45 });
          if (jumpState.justLanded) sfx('step-grit', { pitch: 0.78, volume: 0.6 });
          if (!jumpState.onGround) {
            pos.y = standY + EYE + jumpState.heightAboveFloor;
          } else {
            const target = standY + EYE + jumpState.landingDip;
            pos.y += (target - pos.y) * Math.min(1, dt * 14);
          }
        }
      }
      // ---- through the gate (only when it is on and the picture is clear)
      if (gateOn && world) {
        const gateM = where === 'lab' ? labGateM : planetGateM;
        const a = local(gateM, before), b = local(gateM, pos);
        const op = where === 'lab' ? room.gate.opening : twin.opening;
        if (Math.sign(a.z - op.z) !== Math.sign(b.z - op.z) && Math.abs(b.x) < op.width / 2 - 0.15) {
          // JOB-09: on the planet, a live horizon may be a world and not a room. The caller's transit rule says which,
          // and it is evaluated here rather than kept in a cutscene object: the same step gives the same answer.
          const transit = where === 'planet' ? (o.earthTransit?.() ?? null) : null;
          if (transit) {
            pendingEvent = transit === 'earth' ? 'to-earth' : 'to-moon';
            o.onEarthTransit?.(transit);
          } else {
            crossTo(where === 'lab' ? 'planet' : 'lab');
          }
        }
      }
      // ---- sync (TASK-26: the safe domes). Inside the gate's 25 m dome, a powered pylon's or the shelter's 15 m dome, sync holds and
      // refills at 20% a second; outside it drains over 90 s. The running-machine field (stage 1 and up) is unchanged.
      let nearMachine = false;
      domeBuf.length = 0;
      domeBuf.push({ x: twin.group.position.x, z: twin.group.position.z, radius: GATE_DOME_RADIUS_M });
      if (shelterDome !== null) domeBuf.push({ x: shelterDome.x, z: shelterDome.z, radius: POWERED_DOME_RADIUS_M });
      for (const v of views.values()) {
        if (v.running <= 0.05) continue;
        if (v.m.kind === 'pylon') domeBuf.push({ x: v.m.x, z: v.m.z, radius: POWERED_DOME_RADIUS_M });
        if (shown >= 1 && waveTo < 0 && Math.hypot(v.m.x - pos.x, v.m.z - pos.z) < MACHINE_FIELD) nearMachine = true;
      }
      inDomeNow = where === 'planet' && (isSheltered || inSafeDome(pos, domeBuf));
      if (where === 'planet') {
        if (inDomeLast !== null && inDomeNow !== inDomeLast) startDomeRipple(pos.x, pos.z);
        inDomeLast = inDomeNow;
      } else inDomeLast = null;
      stepDomeRipple(dt);
      stepBeads(dt);
      sync = syncHeld || (o.gamePreset && o.gamePreset.hudBlade !== 'exploration-o2') ? 1 : stepSync(sync, dt, { onPlanet: where === 'planet', stage, nearMachine, inDome: inDomeNow });
      // the 30% warning: one soft radio-static burst as the buffer goes down past it, and the return arrow until it is back above
      if (where === 'planet' && !inDomeNow && isWarnLevel(sync)) {
        if (!warnOn) sfx('static-burst', { minGapMs: 1500, volume: 0.35 });
        warnOn = true;
      } else if (sync > WARN_LEVEL || inDomeNow) warnOn = false;
      if (where === 'planet' && sync <= 0) {
        sfx('sync-lost');
        // pulled back to the lab, in front of the gate, facing it
        lostAt = now;
        where = 'lab';
        pos.set(GATE_AT.x, EYE, GATE_AT.z + 3.2);
        yaw = 0; pitch = 0;
        sync = 0.05;
        building = false; if (ghost) ghost.group.visible = false;
        pendingEvent = 'sync-lost';
      }
      // ---- character model & animator (TASK-07, POL-18)
      scientistHolder.position.set(pos.x, pos.y - EYE - jumpState.landingDip, pos.z);
      scientistHolder.rotation.set(0, yaw + Math.PI, 0);
      scientistHolder.visible = !playerRigBuild && cameraView === 'third' && !altCamPos && drivingVehicleId === null;
      if (playerRigBuild) {
        playerRigBuild.group.position.set(pos.x, pos.y - EYE, pos.z);
        playerRigBuild.group.rotation.y = yaw + Math.PI;
        playerRigBuild.group.visible = cameraView === 'third' && !altCamPos && drivingVehicleId === null;
      }

      if (scientistAnimator && drivingVehicleId === null) {
        scientistAnimator.update(dt, {
          forward: c.move.z,
          strafe: c.move.x,
          run: c.run,
          jumping: jumpState.jumping,
          rifle: { held: heldBeam.group.visible, aiming: rifleAimingNow, firing: rifleFiringNow },
        });
        holdRifleInHand();
        applyThirdPersonForegripIk();
      }

      if (companionEntity) {
        const floorFn = where === 'planet' ? groundAt : room.floorHeight;
        companionEntity.step(dt, { x: pos.x, y: pos.y - EYE, z: pos.z, yaw }, floorFn);
        companionFight(dt);
      }

      if (drivingVehicleId === null) roverArmOn = false;
      if (altCamPos) {
        camera.position.copy(altCamPos);
        if (altCamTarget) {
          camera.lookAt(altCamTarget.x, altCamTarget.y, altCamTarget.z);
        } else {
          camera.rotation.set(pitch, yaw, 0, 'YXZ');
        }
      } else if (drivingVehicleId !== null && drivingState) {
        const vView = vehicleViews.get(drivingVehicleId);
        if (vView) {
          const roverPos = vView.group.position;
          const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(vView.group.quaternion);
          // P0-VEH-01: the sphere-cast arm, the floor clamp and the level horizon (rover-camera.ts); the arm starts fresh on each drive
          if (!roverArmOn) { roverArm = createRoverArmState(); roverArmOn = true; }
          const arm = stepRoverArm(roverArm, {
            chassis: roverPos, yaw: Math.atan2(fwd.x, fwd.z), pitch: Math.asin(Math.max(-1, Math.min(1, fwd.y))), dt,
            groundAt, cast: roverCast,
          });
          camera.position.set(arm.camera.x, arm.camera.y, arm.camera.z);
          camera.lookAt(arm.lookAt.x, arm.lookAt.y, arm.lookAt.z);
        }
      } else if (o.gamePreset?.cameraMode === 'isometric-tactical' && where === 'planet') {
        camera.position.copy(pos).add(new THREE.Vector3(20, 24, 20));
        camera.lookAt(pos.x, pos.y - EYE, pos.z);
      } else if (cameraView === 'third') {
        const camRot = new THREE.Euler(pitch, yaw, 0, 'YXZ');
        const rightVec = new THREE.Vector3(1, 0, 0).applyEuler(camRot);
        const upVec = new THREE.Vector3(0, 1, 0).applyEuler(camRot);
        const backVec = new THREE.Vector3(0, 0, 1).applyEuler(camRot);
        if (sideShotM !== null) {
          // a debug side view (the TASK-21c shots): the character's right side at chest height, its rifle in profile
          camera.position.copy(pos).addScaledVector(rightVec, sideShotM).add(new THREE.Vector3(0, -0.45, 0));
          camera.lookAt(pos.x, pos.y - 0.75, pos.z);
        } else {
          const desiredPos = pos.clone()
            .addScaledVector(rightVec, 0.38)
            .addScaledVector(upVec, 0.12)
            .addScaledVector(backVec, o.gamePreset?.cameraMode === 'third-person-orbit' ? 6.5 : 2.2);
          const clampedPos = resolveThirdPersonCamera(pos, desiredPos, where);
          camera.position.copy(clampedPos);
          if (o.gamePreset?.cameraMode === 'third-person-orbit') camera.lookAt(pos.x, pos.y - 0.5, pos.z);
          else camera.rotation.set(pitch, yaw, 0, 'YXZ');
        }
      } else {
        camera.position.copy(pos);
        camera.rotation.set(pitch + (wakeT >= 0 ? wakeLift(wakeT) : 0), yaw, 0, 'YXZ');
      }
      camera.updateMatrixWorld(true);
      // ---- the build ghost
      if (building && ghost) {
        const hit = aimGround();
        ghost.group.visible = !!hit;
        if (hit) {
          ghostAt.copy(hit);
          ghost.group.position.set(hit.x, groundAt(hit.x, hit.z), hit.z);
          ghost.group.rotation.y = Math.atan2(hit.x - twin.group.position.x, hit.z - twin.group.position.z);
          const verdict = ghostCheck ? ghostCheck(hit.x, hit.z) : { ok: false, why: '' };
          if (verdict.ok !== ghostVerdict.ok) paintGhost(verdict.ok);
          ghostVerdict = { ok: verdict.ok, why: verdict.why };
        } else ghostVerdict = { ok: false, why: 'Aim at the ground near the gate.' };
      }
      // ---- machines at work
      for (const v of views.values()) {
        v.prop.animate(animTime(now), v.running, propStage);
        if (v.running > 0.05) {
          const mPos = { x: v.m.x, y: groundAt(v.m.x, v.m.z), z: v.m.z };
          if (v.m.kind === 'mill' || v.m.kind === 'heavy-mill') {
            gameAudio.startMachineLoop(v.m.id, 'mill', mPos);
          } else if (v.m.kind === 'projector' || v.m.kind === 'heavy-projector') {
            gameAudio.startMachineLoop(v.m.id, 'projector', mPos);
          } else if (v.m.kind === 'water' || v.m.kind === 'heavy-water') {
            gameAudio.startMachineLoop(v.m.id, 'watermaker', mPos);
          } else if (v.m.kind === 'press' || v.m.kind === 'heavy-press') {
            // the strike is heard when the ram lands, on the ram's own cadence (kit-motion-specs), not a second sine wave
            const rate = v.m.kind === 'heavy-press' ? RAM_CADENCE_RAD.heavy : RAM_CADENCE_RAD.fast;
            if ((now * rate) % (Math.PI * 2) < dt * rate) {
              gameAudio.playPressStroke(mPos);
            }
          }
        } else {
          gameAudio.stopMachineLoop(v.m.id);
        }
        if (v.glow && v.glow.visible) setGlowTime(v.glow, now);
        if (v.light && v.light.visible) {
          const flicker = 0.88 + 0.12 * Math.sin(now * 8.5 + v.m.id * 2.7);
          v.light.intensity = v.running * 12.0 * flicker;
          if (v.vent) {
            v.light.position.set(
              v.vent.x + Math.sin(now * 2.5 + v.m.id) * 0.25,
              v.vent.y + 1.2 + Math.cos(now * 3.0) * 0.18,
              v.vent.z + Math.cos(now * 2.1 + v.m.id) * 0.25
            );
          }
        }
      }
      // ---- the light presets' patterns (plan 39, Lx): one tick for every lamp that wears one, lab or plot
      tickLights(now);
      // ---- fabricator animation
      for (const fab of fabricatorViews.values()) {
        const head = fab.station.parts['head'];
        if (head) {
          if (fab.printing) {
            gameAudio.startLoop3d('fab-' + fab.id, 'sfx-fabricator', fab.group.position);
            head.position.x = Math.sin(now * 3.5) * 1.5;
            if (fab.station.lamps[0]) setRoverLamp(fab.station.lamps[0], 1);
            if (fab.station.lamps[1]) setRoverLamp(fab.station.lamps[1], 1);
          } else {
            gameAudio.stopLoop3d('fab-' + fab.id);
            head.position.x = 0;
            if (fab.station.lamps[0]) setRoverLamp(fab.station.lamps[0], 0.2);
            if (fab.station.lamps[1]) setRoverLamp(fab.station.lamps[1], 0.2);
          }
        }
      }
      // ---- the wave, and the event when it has crossed
      const wave = waveNow(), r = wave.r;
      if (waveTo >= 0 && r > 1e6) {
        shown = waveTo;
        waveTo = -1;
        fitLooks();
        rebuildProps(shown);
        world?.settle();
        biomeView?.setStage(shown);
        applyCoverage(shown);
        if (waterGroup) waterGroup.visible = shown >= 4;
        pendingEvent = pendingEvent ?? 'stage-up';
        sfx('stage-up');
      }
      if (waveTo >= 0) {
        world?.setFront(r);
      }
      postUniforms.uWaveR.value = waveTo >= 0 ? r : -1;
      postUniforms.uSkyRise.value = wave.sky;
      // stage 0's scan wave (0a to 0b), the gate's amber pool, the sun, and the suit cam's optics (plan 25)
      const scan = scanFrame(scanWave, now);
      postUniforms.uScanR.value = wireframeLookOverride === true ? -1 : scan.radius;
      postUniforms.uWireMix.value = wireframeLookOverride === true ? 1.0 : wireframeLookOverride === false ? 0.0 : scan.wireMix;
      postUniforms.uScanCentre.value.set(scanWave.centre.x, scanWave.centre.y, scanWave.centre.z);
      syncWaveAndLocalPulseUniforms(now, scan.radius);
      postUniforms.uGatePos.value.copy(twin.group.position);
      const profile = suitCamProfile(detail.suitCam, detail.suitCamTier);
      camera.getWorldDirection(suitLook);
      const gateDistM = camera.position.distanceTo(twin.group.position);
      const lumTarget = exposureTargetLuminance(suitLook, SUN, gateOrLabFactor(where === 'lab', gateDistM));
      postUniforms.uExposure.value = stepExposure(exposure, lumTarget, dt, profile.swing).exposure;
      suitCamNow += (suitCamStrength(profile, suitCamMix(detail.suitCam, plotLx, stage), buildOpen) - suitCamNow) * (1 - Math.exp(-dt / 0.35));
      postUniforms.uSuitCam.value = suitCamNow;
      postUniforms.uSuitK1.value = profile.k1 * (buildOpen ? 0.5 : 1);
      postUniforms.uSuitGrain.value = profile.grain;
      postUniforms.uSuitWide.value = profile.wide ? 1 : 0;
      // a quarter of the pixels race out to the wave's front while it runs
      const wc = postUniforms.uWaveCentre.value;
      plume.setWave([wc.x, wc.y, wc.z], waveTo >= 0 ? Math.min(r, RACER_REACH) : -1);
      tickMachinePlumes(now);
      room.updateSpriteCards(now);
      plume.update(now);
      labPlume.update(now);
      beamFx.update(now);
      holoUniforms.uTime.value = now;
      if (waterMesh && waterMesh.material) {
        const mat = waterMesh.material as THREE.ShaderMaterial;
        if (mat.uniforms?.uTime) mat.uniforms.uTime.value = now;
      }
      if (where === 'planet') {
        horizonDomes.group.visible = true;
        horizonDomes.update(now, currentFloats, (x, z) => groundAt(x, z));
        camera.getWorldDirection(monsterFwd);
        monsters.update(dt, { x: pos.x, z: pos.z, yaw: Math.atan2(monsterFwd.x, monsterFwd.z), alive: playerAlive }, camera);
        stepTurrets(dt, pos); // TICKET-13 Window C: the perimeter turrets (their section is after activeBase)
        // T07b Item 5: continuous beam damage to monsters in extract mode
        if (rifleFiringNow && heldMode === 'extract' && !beamSealingNow) {
          const dmg = beamDamage('extract', dt, SEAL_REACH * 0.5, false);
          if (dmg > 0) {
            monsters.beamHit(
              { x: camera.position.x, z: camera.position.z },
              { x: monsterFwd.x, z: monsterFwd.z },
              SEAL_REACH,
              dmg
            );
          }
        }
      }
      tracks.update(dt);
      roost.update(dt);
      for (let i = activeGantries.length - 1; i >= 0; i--) {
        activeGantries[i]!.update(dt);
      }
      postUniforms.uTime.value = now;
      postUniforms.uGlitch.value = where === 'planet' ? Math.max(0, Math.min(1, (0.4 - sync) / 0.4)) : 0;
      postUniforms.uLost.value = Math.max(0, 1 - (now - lostAt) / 0.6);
      openingUniforms.uTime.value = now;
      room.update(animTime(now), dt);
      applyVistaFlashFloorPeak(now);
      const mainPower = powerT >= 0 ? powerAt(powerT).main : (gateOn ? 1 : 0);
      holo.update(now, dt, mainPower, waveTo >= 0 ? r : -1);
      // the ground's chunks follow you on the planet; from the lab, they stay round the gate
      ground?.regrow(dt);
      ground?.update(where === 'planet' ? pos.x : 0, where === 'planet' ? pos.z : 0);
      // the held rifle's feel (TASK-21d, P0-VFX-01): it sways on the look, bobs on the walk and vibrates while it fires
      const walked = Math.hypot(pos.x - before.x, pos.z - before.z);
      const feel = feelStep(rifleFeel, { lookX: c.look.dx, lookY: c.look.dy, walked, dt, firing: rifleFiringNow, time: now });
      rifleFeel = feel.state;
      if (heldBeam.group.visible && heldBeam.group.parent === viewRig) {
        heldBeam.group.position.copy(viewRest.position).add(feelOffset.set(feel.out.x, feel.out.y, feel.out.z));
        heldBeam.group.quaternion.copy(viewRest.quaternion).multiply(feelQuat.setFromEuler(feelEuler.set(feel.out.pitch, 0, feel.out.roll)));
      }
      // the rim and the floor (P0-LIGHT-01) are on in stages 0 to 2 only
      setRimFloorOn(shown <= 2);
      // the ring under the beam (POL-30): slope-lifted where the held rifle lands, coloured by its mode (Seal's amber while sealing)
      const beamAimed = heldBeam.group.visible && where === 'planet' ? aimGround(BEAM_STROKE_RANGE) : null;
      updateSlopeLiftedBeamRing(beamAimed ? { x: beamAimed.x, z: beamAimed.z } : null, STROKE_RADIUS, ringColourOf(heldMode, beamSealingNow));
      labScene.environmentIntensity = room.envLevel();
      syncSuitEnv(where === 'planet');
      world?.update(now, dt, where === 'planet' ? camera.position : virtual.position);

      // ---- audio listener update (zero allocations per frame)
      audioCamFwd.set(0, 0, -1).applyQuaternion(camera.quaternion);
      audioCamUp.set(0, 1, 0).applyQuaternion(camera.quaternion);
      gameAudio.update(dt, camera.position.x, camera.position.y, camera.position.z, audioCamFwd.x, audioCamFwd.y, audioCamFwd.z, audioCamUp.x, audioCamUp.y, audioCamUp.z);

      // ---- draw
      syncAvatarLayers();
      renderer.info.autoReset = false;
      renderer.info.reset();
      if (where === 'lab') {
        if (world && room.portal.visible && visible(room.portal, camera)) {
          virtual.matrixWorld.copy(camera.matrixWorld).premultiply(toPlanet);
          virtual.matrixWorld.decompose(virtual.position, virtual.quaternion, virtual.scale);
          virtual.updateMatrixWorld(true);
          drawPlanet(virtual, viewRT, true);
        }
        renderer.setRenderTarget(null);
        renderer.clear();
        // the view through the window first (its own scissor), then the lab over it after a depth clear
        const viewDrawn = room.vista.render(renderer, camera, o.canvas.clientWidth || o.canvas.width, o.canvas.clientHeight || o.canvas.height);
        renderer.autoClear = false;
        if (viewDrawn) renderer.clearDepth();
        renderer.render(labScene, camera);
        renderer.autoClear = true;
      } else {
        if (gateOn && visible(twinOpening, camera)) {
          virtual.matrixWorld.copy(camera.matrixWorld).premultiply(toLab);
          virtual.matrixWorld.decompose(virtual.position, virtual.quaternion, virtual.scale);
          virtual.updateMatrixWorld(true);
          room.gate.group.visible = false;
          // seen from the planet through the gate, the window shows the flat storm plane (no hole in the lab's wall, R8)
          room.setPlaneFallback(true);
          renderer.setRenderTarget(labRT);
          renderer.clear();
          renderer.render(labScene, virtual);
          room.setPlaneFallback(false);
          room.gate.group.visible = true;
        }
        drawPlanet(camera, null, false);
        drawViewModel(camera);
      }
      // ---- what you are looking at: a machine on the planet within reach of your hand, a boulder with ore, the lab's main lever, or lab machines
      let aimed: number | null = null;
      let aimedBoulder: number | null = null;
      if (where === 'planet' && !building) {
        const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
        let best = 6;
        for (const v of views.values()) {
          const c = new THREE.Vector3(v.m.x, groundAt(v.m.x, v.m.z) + 1.0, v.m.z).sub(pos);
          const t = c.dot(dir);
          if (t <= 0 || t >= best) continue;
          if (c.addScaledVector(dir, -t).length() < KINDS[v.m.kind].radius + 0.4) { best = t; aimed = v.m.id; }
        }
        if (ground) {
          const bId = ground.findAimedBoulder(pos, dir, 5.0);
          if (bId !== null) {
            if (aimed !== null) {
              const bInfo = ground.getBoulders().find((b) => b.id === bId);
              if (bInfo) {
                const bDist = Math.hypot(bInfo.x - pos.x, bInfo.z - pos.z);
                if (bDist < best) {
                  aimed = null;
                  aimedBoulder = bId;
                }
              }
            } else {
              aimedBoulder = bId;
            }
          }
        }
      }
      lastAimedBoulder = aimedBoulder;
      let atLever = false;
      let atDial = false;
      let atGate = false;
      let aimedPowerWall = false;
      let aimedWindow = false;
      let aimedLab: LabMachineKind | null = null;
      if (where === 'lab') {
        const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
        aimedPowerWall = dir.x < -0.55 && pos.x < 5.0;
        aimedWindow = dir.z < -0.55 && pos.z > -7.5;
        atGate = Math.hypot(pos.x - GATE_AT.x, pos.z - GATE_AT.z) < 3.5;
        const to = room.leverAt.clone().sub(pos);
        const atConsole = to.length() < 2.4 && to.normalize().dot(dir) > 0.86;
        if (!gateOn && powerT < 0) {
          atLever = atConsole;
        } else if (gateOn) {
          atDial = atConsole;
        }
        const st = room.aimStation(camera.position, dir) ?? room.aimStation(pos, dir);
        if (st) aimedLab = st.id;
      }
      // what you are looking at to read or salvage (TASK-23c): a lab prop, or a transponder on its wreck
      let aimedProp: { id: string; salvage: boolean } | null = null;
      if (where === 'lab') {
        const id = room.aimClutter(pos, new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion), 3.4);
        if (id) aimedProp = { id, salvage: clutterById(id)?.role === 'salvage' };
      } else if (where === 'planet' && !building) {
        const camDir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
        const aimed = wrecks.aimWreck?.(pos, camDir, 14);
        if (aimed) {
          aimedProp = { id: aimed.id, salvage: Boolean(aimed.interaction.salvage) };
        } else {
          const id = wrecks.aimProp(pos, camDir, 14);
          if (id) aimedProp = { id, salvage: false };
        }
      }
      // ---- Window B (TICKET-11, co-op): the other players' avatars, from the live session's samples (none outside a session)
      const coopSession = currentOutpostSession();
      remotePeers.setRemotePeers(coopSession ? coopSession.client.samplePeers() : []);
      const ev = pendingEvent;
      pendingEvent = null;
      return {
        where,
        sync,
        inDome: inDomeNow,
        warn: where === 'planet' && warnOn,
        atLever,
        atDial,
        atGate,
        aimedPowerWall,
        aimedWindow,
        ghost: building ? ghostVerdict : null,
        aimed,
        aimedBoulder,
        aimedLab,
        aimedProp,
        stage: shown,
        event: ev,
        drivingVehicle: drivingVehicleId !== null && drivingState ? {
          id: drivingVehicleId,
          kind: vehicleViews.get(drivingVehicleId)!.kind,
          speed: currentSpeed,
          boostEnergy: roverBoostEnergy,
          boosting: isRoverBoosting,
          vx: drivingState.v[0],
          vz: drivingState.v[2],
          yaw: vehicleViews.get(drivingVehicleId)!.yaw,
          harness: harnessVm,
        } : null,
      };
    },
    resize(width, height, pixelRatio) {
      renderer.setPixelRatio(pixelRatio);
      renderer.setSize(width, height, false);
      const buf = renderer.getDrawingBufferSize(new THREE.Vector2());
      screen.copy(buf);
      bufW = buf.x; bufH = buf.y;
      camera.aspect = virtual.aspect = width / Math.max(1, height);
      camera.updateProjectionMatrix(); virtual.updateProjectionMatrix();
      labRT.dispose();
      labRT = target(Math.round(buf.x / 2), Math.round(buf.y / 2), false, false);
      postUniforms.uLab.value = labRT.texture;
      // the planet's picture is fitted to the new screen
      planetK = 0;
      fitLooks();
    },
    setBuildOpen(open) { buildOpen = open; },
    setDetail(d) {
      detail = d;
      room.setWindowView(d.windowView);
      fitLooks();
      ground?.setBudget(d.groundBudget);
      plume.setMode(d.plumes);
      plume.setDensity(d.plumeDensity);
      labPlume.setMode(d.plumes);
      labPlume.setDensity(d.plumeDensity);
      for (const v of views.values()) {
        if (v.glow) v.glow.visible = detail.plumeGlow && v.running > 0.05;
        if (v.light) {
          v.light.visible = detail.pixelLights && v.running > 0.05;
          v.light.intensity = v.light.visible ? v.running * 12.0 : 0;
        }
      }
    },
    setLabActivity,
    triggerTurboBass(radiusM = 12, pushM = 4): number {
      gameAudio.playTurboBassPulse();
      return monsters.knockbackSwarmers({ x: pos.x, z: pos.z }, radiusM, pushM);
    },
    collectWreckTape(id: string): string | null {
      return wrecks.collectTape?.(id) ?? null;
    },
    setBeamHeld(held, mode) {
      heldMode = mode;
      heldBeam.setMode(mode);
      const was = heldBeam.group.visible;
      heldBeam.group.visible = held;
      attachRifle();
      if (held !== was) {
        if (!held) rifleAimingNow = rifleFiringNow = false;
        scientistAnimator?.playOneShot(held ? 'draw' : 'holster');
      }
    },
    setBeamFiring(on) {
      rifleFiringNow = on;
      heldBeam.setFiring(on ? 1 : 0);
    },
    setBeamAiming(on) {
      rifleAimingNow = on;
    },
    setCameraView(mode) {
      cameraView = mode;
      scientistHolder.visible = (mode === 'third');
      attachRifle();
    },
    getCameraView: () => cameraView,
    playAction(kind) {
      scientistAnimator?.playOneShot(kind);
    },
    setAvatar(avatar) {
      if (avatar?.kind === 'scientist') setVisorColor(avatar.visor);
    },
    gatherBoulder(id, amount) {
      return ground?.gather(id, amount) ?? 0;
    },
    aimBoulder(maxDist) {
      if (!ground) return null;
      const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
      return ground.findAimedBoulder(camera.position, dir, maxDist);
    },
    beamGatherBoulder(id, dt) {
      return ground?.beamGather(id, dt) ?? null;
    },
    beamAim(reach) {
      const hit = aimGround(reach);
      return hit ? { x: hit.x, y: hit.y, z: hit.z } : null;
    },
    beamPaint(x, z, preset, dt) {
      return ground?.paint(x, z, preset, dt) ?? 0;
    },
    setBeamCartridge(colour) {
      heldBeam.setCartridge(colour);
    },
    beamSculpt(x, z, tool, dt, ore) {
      const op = strokeOf({ ...BEAM_START, mode: 'sculpt', sculpt: tool }, { x, z }, dt);
      if (!ground || op === null) return { ore, cells: 0, gained: 0 };
      const r = ground.stroke(op, ore);
      return { ore: r.balance, cells: r.cells, gained: r.gained };
    },
    setBeamKeepOut(zones) {
      ground?.setKeepOut(zones);
    },
    beamFieldText() {
      return ground ? ground.exportField() : '';
    },
    // ---- Window B (TICKET-11, co-op)
    importBeamField(text) {
      if (!ground) {
        pendingBeamField = text;
        return;
      }
      const field = text.length > 0 ? text : encodeField(emptyField(PAINT_CELLS, PAINT_CELL));
      // the text last applied is skipped (exportField is always the encoded, centimetre-rounded field, so it cannot tell)
      if (field === importedBeamText) return;
      if (!ground.importField(field)) return;
      importedBeamText = field;
      // the footing pad stands on the ground as it now is (POL-112), so the room's plotHeightAt gives the same height under the gate
      const gy = ground.heightAt(twin.group.position.x, twin.group.position.z);
      padTop = gy + 0.25;
      twin.group.position.y = gy;
      syncPlanetMatrices();
    },
    beamFieldReady() {
      return ground !== null;
    },
    gatePose() {
      return { x: twin.group.position.x, z: twin.group.position.z, yaw: twin.group.rotation.y };
    },
    playerPose() {
      if (where !== 'planet') return null;
      return { x: pos.x, y: groundAt(pos.x, pos.z), z: pos.z, yaw: yaw + Math.PI };
    },
    setBeamSealing(on) {
      beamSealingNow = on;
      heldBeam.setSealing(on);
    },
    setProps(o) {
      room.removeClutter(o.cleared);
      wrecks.restore(o.sealed);
      monsters.setSealedSites(o.sealed);
    },
    dissolveClutter: (id) => room.dissolveClutter(id),
    sealWreck: (site) => wrecks.seal(site),
    preloadWrecks: () => wrecks.preload(),
    async preloadLabGenerated() {
      // the layered materials' noise atlas (plan 41), so the first one never builds it mid-play
      warmLayeredMaterials();
      await preloadLabGenerated(genLevelFor(currentQuality));
      await preloadVista(VISTA_LEVEL);
      room.adoptGenerated();
    },
    warm() {
      // each scene for each place it draws to (the screen's colour space differs from the targets'), hidden things included (the
      // plume's three ways), with one of every machine standing in, and again in the ghost's marks: what first appears mid-play is
      // compiled here, not as a hitch
      const kinds = Object.keys(KINDS) as MachineKind[];
      const stand = kinds.map((k) => { const p = machineProp(m, k, propStage); p.group.visible = false; planetScene.add(p.group); return p; });
      const passes: [THREE.Scene, THREE.Camera, THREE.WebGLRenderTarget | null][] = [
        [planetScene, camera, planetRT], [postScene, postCam, viewRT], [postScene, postCam, null], [labScene, camera, null], [labScene, camera, labRT],
      ];
      for (const [sc, cam, to] of passes) { renderer.setRenderTarget(to); renderer.compile(sc, cam); }
      for (const p of stand) p.group.traverse((obj) => { const mesh = obj as THREE.Mesh; if (mesh.isMesh) mesh.material = ghostOk; });
      renderer.setRenderTarget(planetRT);
      renderer.compile(planetScene, camera);
      // the rifts' program: they draw on RIFT_LAYER after the stage look (drawRifts), so compile that layer too
      const riftMask = camera.layers.mask;
      camera.layers.set(RIFT_LAYER);
      renderer.setRenderTarget(null);
      renderer.compile(planetScene, camera);
      camera.layers.mask = riftMask;
      renderer.setRenderTarget(null);
      for (const p of stand) { planetScene.remove(p.group); p.group.traverse((obj) => { const mesh = obj as THREE.Mesh; if (mesh.isMesh) mesh.geometry.dispose(); }); }
      holo.warm(renderer, camera);
    },
    isNearWater() {
      if (where !== 'planet' || !waterGroup || !waterGroup.visible) return false;
      for (const v of views.values()) {
        if ((v.m.kind === 'water' || v.m.kind === 'heavy-water') && Math.hypot(v.m.x - pos.x, v.m.z - pos.z) <= 35) return true;
      }
      if (Math.hypot(pos.x - (twin.group.position.x - 20), pos.z - (twin.group.position.z + 40)) <= 40) return true;
      return false;
    },
    setWireframeLook(enabled) { wireframeLookOverride = enabled; },
    setViewModelVisible(visible) { viewModelHidden = !visible; },
    setStorm: (p: number) => room.setStorm(p),
    setMonitorEqualizer: (b) => room.setMonitorEqualizer(b),
    room,
    setConsensusCommitted: (committed) => {
      consensusCommitted = committed;
      room.setConsensusCommitted(committed);
    },
    isConsensusCommitted: () => consensusCommitted,
    getHorizonDomes: () => horizonDomes,
    debug: {
      // JOB-09: the Earth endgame is a pure read (no state, no step): the transit rule, the monument, the telemetry, the roll
      earthEndgame: (input: EndgameInput) => earthEndgameState(input),
      setSync: (v: number) => { sync = Math.max(0, Math.min(1, v)); },
      plumePixels: () => plume.stats().pixels,
      machineRuns: () => [...views.values()].map((v) => ({ kind: v.m.kind, run: v.running })),
      wreckRungs: () => wrecks.rungs(),
      vistaStats: () => room.vista.stats(),
      power: () => room.power(),
      coilsLit: () => room.coilsLit(),
      wake: () => ({ t: wakeT, lift: wakeT >= 0 ? wakeLift(wakeT) : 0, log: wakeLog.slice() }),
      startWake,
      /** Sets the wake's clock (the shot of the wake's start); -1 ends it. */
      setWake: (t: number) => { wakeT = t; },
      setWindowView: (view) => room.setWindowView(view),
      sealedWrecks: () => wrecks.sealedSites(),
      armoryTaken: () => room.armory.isTaken(),
      wrecks,
      aimWreck: (reach: number = 14) => wrecks.aimWreck?.(camera.position, new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion), reach) ?? null,
      tracks: () => tracks,
      roost: () => roost,
      gantries: () => activeGantries,
      roverBoostEnergy: () => roverBoostEnergy,
      groundTriangles: () => ground?.triangles() ?? 0,
      showGround: (on) => ground?.setVisible(on),
      waterVisible: () => (waterGroup ? waterGroup.visible : false),
      hasWaterMesh: () => waterMesh !== null,
      coverageActive: () => Boolean(ground?.material.uniforms.uCoverOn?.value === 1),
      planetScene: () => planetScene,
      labScene: () => labScene,
      camera: () => camera,
      beamCore: () => ({ shown: beamVisuals.coreShown(), colour: beamVisuals.coreColour() }),
      activeSocket: () => (socketActiveMesh.visible ? socketActiveMesh.position.toArray() : null),
      avatarLayer: () => (scientistHolder.parent === planetScene ? AVATAR_LIGHT_LAYER : 0),
      pinBeam: (on: boolean) => { beamPinned = on; },
      setWaterVisible: (v: boolean) => { if (waterGroup) waterGroup.visible = v; },
      setCoverageActive: (v: boolean) => {
        if (ground) {
          ground.material.uniforms.uCoverOn!.value = v ? 1 : 0;
          ground.material.uniformsNeedUpdate = true;
        }
      },
      where: () => where,
      position: () => pos.clone(),
      airborne: () => !jumpState.onGround,
      facing: () => yaw,
      machineAnchors() {
        const out: { id: number; kind: string; ndcX: number; ndcY: number; behind: boolean; distanceM: number; aimAngleDeg: number; running: number }[] = [];
        const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
        for (const v of views.values()) {
          const p = new THREE.Vector3(v.m.x, groundAt(v.m.x, v.m.z) + 1.4, v.m.z);
          const toM = p.clone().sub(camera.position);
          const dist = toM.length();
          const cos = dist > 1e-6 ? THREE.MathUtils.clamp(fwd.dot(toM.clone().divideScalar(dist)), -1, 1) : 1;
          const ndc = p.clone().project(camera);
          out.push({
            id: v.m.id,
            kind: v.m.kind,
            ndcX: ndc.x,
            ndcY: ndc.y,
            behind: cos < 0,
            distanceM: dist,
            aimAngleDeg: THREE.MathUtils.radToDeg(Math.acos(cos)),
            running: v.running,
          });
        }
        return out;
      },
      teleport(w, x, z, y, p) {
        if (w === 'lab') {
          x = Math.max(ROOM.left + RADIUS, Math.min(ROOM.right - RADIUS, x));
          z = Math.max(ROOM.back + RADIUS, Math.min(ROOM.front - RADIUS, z));
        }
        if (where !== w) {
          if (w === 'planet') {
            labScene.remove(scientistHolder);
            planetScene.add(scientistHolder);
            if (companionEntity && companionEntity.group.parent !== planetScene) {
              labScene.remove(companionEntity.group);
              planetScene.add(companionEntity.group);
            }
          } else {
            planetScene.remove(scientistHolder);
            labScene.add(scientistHolder);
            if (companionEntity && companionEntity.group.parent !== labScene) {
              planetScene.remove(companionEntity.group);
              labScene.add(companionEntity.group);
            }
          }
          pendingEvent = w === 'planet' ? 'to-planet' : 'to-lab';
        }
        where = w; pos.set(x, w === 'lab' ? EYE : groundAt(x, z) + EYE, z); yaw = y; if (p !== undefined) pitch = p;
        wakeT = -1; // a moved player is not waking (the tests place the camera)
      },
      sync: () => sync,
      pieceBounds: (id) => {
        // The drawn world bounds of one base piece (its batched instances, and its dynamic group: a door's leaf, lamps),
        // and for a dynamic piece the first mesh of its group: that mesh's centre and face normal (its local +z).
        const g = piecesGroup;
        const mgr = (g?.userData as { manager?: { pieceIdFromHit: (o: THREE.Object3D, inst?: number) => number | null } } | undefined)?.manager;
        if (!g || !mgr) return null;
        g.updateMatrixWorld(true);
        const box = new THREE.Box3();
        const m = new THREE.Matrix4();
        let found = false;
        let leaf: { centre: [number, number, number]; normal: [number, number, number] } | undefined;
        g.traverse((o) => {
          if (o instanceof THREE.InstancedMesh) {
            const geom = o.geometry;
            if (!geom.boundingBox) geom.computeBoundingBox();
            for (let s = 0; s < o.count; s++) {
              if (mgr.pieceIdFromHit(o, s) !== id) continue;
              o.getMatrixAt(s, m);
              m.premultiply(o.matrixWorld);
              box.union(geom.boundingBox!.clone().applyMatrix4(m));
              found = true;
            }
          } else if (o.userData?.pieceId === id) {
            box.union(new THREE.Box3().setFromObject(o));
            found = true;
            if (!leaf) {
              o.traverse((c) => {
                if (leaf || !(c instanceof THREE.Mesh) || !c.geometry) return;
                if (!c.geometry.boundingBox) c.geometry.computeBoundingBox();
                const lc = c.geometry.boundingBox!.getCenter(new THREE.Vector3()).applyMatrix4(c.matrixWorld);
                const n = new THREE.Vector3(0, 0, 1).transformDirection(c.matrixWorld);
                leaf = { centre: [lc.x, lc.y, lc.z], normal: [n.x, n.y, n.z] };
              });
            }
          }
        });
        return found ? { min: [box.min.x, box.min.y, box.min.z], max: [box.max.x, box.max.y, box.max.z], leaf } : null;
      },
      stats: () => ({ triangles: renderer.info.render.triangles, calls: renderer.info.render.calls }),
      wave: () => waveRadius(),
      gatePlanet: () => ({ x: twin.group.position.x, z: twin.group.position.z }),
      gateAccess: () => gateAccess,
      gateKitParts: () => (stargate ? stargate.build.placed.length : 0),
      detail: () => ({ ...detail, planet: [postUniforms.uRes.value.x, postUniforms.uRes.value.y] as const, pixels: plume.stats().pixels }),
      machines: () => { let pouring = 0; for (const v of views.values()) if (v.emitter !== null) pouring++; return { standing: views.size, pouring }; },
      fabricators: () => [...fabricatorViews.values()].map((f) => {
        const feed = fabricatorFeedAt(f);
        return {
          id: f.id, printing: f.printing, emitting: f.emitter !== null, pour: f.pour, colour: FABRICATOR_PLUME.colour,
          vent: [f.vent.x, f.vent.y, f.vent.z] as const,
          feed: feed ? [feed.x, feed.y, feed.z] as const : null,
          feedCubes: feed ? feedCubeCount(f.printing ? 1 : 0) : 0,
        };
      }),
      plumes: () => [...views.values()].map((v) => {
        const spec = machinePlumeSpec(v.m.kind);
        return {
          kind: v.m.kind,
          emitting: v.emitter !== null,
          pour: v.pour,
          steady: machinePlumeSteady(spec),
          arc: v.emitter !== null ? machinePlumeGravity(v.m.kind) : 0,
          colour: spec.colour,
          base: [v.m.x, v.m.z] as const,
          foot: [v.prop.group.position.x, v.prop.group.position.y, v.prop.group.position.z] as const,
          yaw: v.m.yaw,
          vent: v.vent ? [v.vent.x, v.vent.y, v.vent.z] as const : null,
          feed: v.feed ? [v.feed.x, v.feed.y, v.feed.z] as const : null,
          feedCubes: v.feed ? feedCubeCount(v.share) : 0,
        };
      }),
      holo: () => holo.debug(),
      view: () => cameraView,
      clipWeight: (name: ClipName) => scientistAnimator?.getClipWeight(name) ?? 0,
      rifleIn: () => (!heldBeam.group.visible ? 'none' : heldBeam.group.parent === viewRig ? 'view' : rifleHand !== null && heldBeam.group.parent === rifleHand ? 'hand' : 'none'),
      paintedCells: () => ground?.paintedCells() ?? 0,
      sculptedCells: () => ground?.sculptedCells() ?? 0,
      remotePeers: () => remotePeers.getAvatarCount(),
      groundEdit: (x, z) => ground?.editAt(x, z) ?? 0,
      surfaceAt: (x, z) => ground?.surfaceAt(x, z) ?? null,
      groundSettled: () => ground?.settled() ?? false,
      ringColour: () => beamVisuals.ringColour(),
      streamShown: () => beamVisuals.streamShown(),
      rimFloorOn: () => rimFloorOn(),
      rifleFeelOffset: () => [feelOffset.x, feelOffset.y, feelOffset.z],
      pieceGhostShown: () => pieceGhost !== null && pieceGhost.visible,
      avatar: () => {
        const box = new THREE.Box3().setFromObject(scientistHolder);
        return { in: scientistHolder.parent === planetScene ? 'planet' : scientistHolder.parent === labScene ? 'lab' : 'none', visible: scientistHolder.visible, at: scientistHolder.position.toArray().map((v) => +v.toFixed(2)), kids: scientistHolder.children.length, altCam: !!altCamPos, box: [box.min.toArray(), box.max.toArray()].map((p) => p.map((v) => +v.toFixed(2))) };
      },
      currentOneShot: () => scientistAnimator?.currentOneShot ?? null,
      animator: () => scientistAnimator,
      gather(amount) {
        if (!ground) return 0;
        const targetId = lastAimedBoulder ?? ground.findNearestBoulder(pos);
        if (targetId === null) return 0;
        return ground.gather(targetId, amount);
      },
      aimedBoulder: () => lastAimedBoulder,
      boulders: () => ground?.getBoulders() ?? [],
      twinStage: () => twinStage,
      plumeGlowCount: () => {
        let count = 0;
        for (const v of views.values()) if (v.glow && v.glow.visible) count++;
        return count;
      },
      pixelLightCount: () => {
        let count = 0;
        for (const v of views.values()) if (v.light && v.light.visible) count++;
        return count;
      },
      testPieceAim(pieceId: number) {
        const g = new THREE.Group();
        const geom = new THREE.BoxGeometry(2, 2, 2);
        const mat = new THREE.MeshBasicMaterial();
        const mesh = new THREE.Mesh(geom, mat);
        const dir = new THREE.Vector3(0, 0, -3).applyQuaternion(camera.quaternion);
        mesh.position.copy(camera.position).add(dir);
        mesh.userData.pieceId = pieceId;
        g.add(mesh);
        g.updateMatrixWorld(true);
        const prevGroup = piecesGroup;
        piecesGroup = g;
        const hit = aimPointFn();
        piecesGroup = prevGroup;
        geom.dispose();
        mat.dispose();
        return hit;
      },
      setAltCam(eye, p, y, target) {
        debugAltCam = true;
        altCamPos = new THREE.Vector3(eye.x, eye.y, eye.z);
        altCamTarget = target ? new THREE.Vector3(target.x, target.y, target.z) : null;
        camera.position.copy(altCamPos);
        if (target) {
          camera.lookAt(target.x, target.y, target.z);
          pitch = camera.rotation.x;
          yaw = camera.rotation.y;
        } else {
          pitch = p;
          yaw = y;
          camera.rotation.set(pitch, yaw, 0, 'YXZ');
        }
        camera.updateMatrixWorld(true);
      },
      locomotion: () => locomotionChoice(),
      setLocomotion(name) {
        const applied = setLocomotionChoice(name);
        // the switch is live: the next frame's solve reads it, and the state it already had is kept
        return applied;
      },
      clearAltCam() {
        debugAltCam = false;
        altCamPos = null;
        altCamTarget = null;
      },
      groundHeight: (x, z) => groundAt(x, z),
      /** A third-person side view at `metres` from the character (null: the over-the-shoulder camera). Shots only. */
      sideShot(metres: number | null) { sideShotM = metres; },
      biomeCounts: () => (biomeView ? biomeView.counts() : null),
      biomeTriangles: () => (biomeView ? biomeView.triangles() : 0),
      biomeDrawCalls: () => (biomeView ? biomeView.drawCalls() : 0),
      horizonDomes: () => horizonDomes,
      windowFCoopSync: () => windowFCoopSync,
      applyScientistWindowFGate: (opts: { where: string; cameraView: 'first' | 'third'; quality: string }) => applyScientistWindowFGate(scientistHolder, opts),
      orbitalDirector: () => orbitalDirector,
      planetTableHologram: () => room.hologram,
      setFourFloats: (f: FourFloats) => {
        currentFloats = f;
        room.setFloats(f);
      },
      isViewModelVisible: () => !viewModelHidden,
      isWireframeLook: () => wireframeLookOverride,
    },
    buildBiome(input) {
      cachedBiomeInput = input;
      lastBiomeKey = lastCoverKey = '';
      if (biomeView) {
        biomeView.build(input);
        biomeView.setStage(shown);
      }
    },
    setVegetationSetting(v) {
      vegSetting = v;
      const effectiveTier = v === 'off' ? 'off' : v === 'high' ? 'high' : 'low';
      biomeView?.setTier(effectiveTier);
      biomeView?.setStage(shown);
    },
    getBiomeCounts() {
      return biomeView ? biomeView.counts() : { total: 0, trees: 0, byKind: { tuft: 0, bush: 0, pine: 0, oak: 0, birch: 0 } };
    },
    bakeCoverage() {
      bakeCoverage();
    },
    dispose() {
      sceneAlive = false;
      clearPlotEnvironment(roomEnvMap);
      releaseLayeredEnv({ map: roomEnvMap, intensity: PLOT_KIT_ENV });
      for (const model of sporeModels) { model.build.group.removeFromParent(); for (const resource of model.resources) resource.dispose(); }
      sporeModels.length = 0;
      scientistAnimator?.dispose();
      companionEntity?.dispose();
      avatarRig.dispose();
      labScene.remove(scientistHolder);
      planetScene.remove(scientistHolder);
      for (const v of views.values()) unbuild(v);
      for (const c of cables) c.geometry.dispose();
      dropGhost();
      if (biomeRebuildTimer) clearTimeout(biomeRebuildTimer);
      if (coverSliceTimer) clearTimeout(coverSliceTimer);
      if (waterGroup) {
        planetScene.remove(waterGroup);
        waterGroup.traverse((obj) => {
          const m = obj as THREE.Mesh;
          if (m.isMesh) {
            m.geometry.dispose();
            if (Array.isArray(m.material)) m.material.forEach((mat) => mat.dispose());
            else m.material.dispose();
          }
        });
        waterGroup = null;
        waterMesh = null;
      }
      for (const tex of stageCoverTextures) {
        tex?.dispose();
      }
      coverTiles.albedoHeight.dispose();
      coverTiles.normalRough.dispose();
      biomeView?.dispose();
      world?.dispose();
      ground?.dispose();
      holo.dispose();
      room.dispose();
      remotePeers.dispose();
      for (const x of owned) x.dispose();
      for (const mat of Object.values(m)) (mat as THREE.Material).dispose();
      for (const v of vehicleViews.values()) {
        vehiclesGroup.remove(v.group);
      }
      vehicleViews.clear();
      for (const f of fabricatorViews.values()) {
        if (f.emitter !== null) plume.remove(f.emitter);
        fabricatorsGroup.remove(f.group);
      }
      fabricatorViews.clear();
      planetScene.remove(vehiclesGroup);
      planetScene.remove(fabricatorsGroup);
      for (const mat of Object.values(roverMaterials)) (mat as THREE.Material).dispose();
      renderer.dispose();
      monsters.dispose();
      beamFx.dispose();
      beamVisuals.dispose();
      planetScene.remove(planGhostsGroup);
      beamCoreGeom.dispose();
      beamCoreMat.dispose();
      beamSparkGeom.dispose();
      beamSparkMat.dispose();
      for (const k of (['dither', 'fold', 'chroma', 'spire'] as const)) {
        nodeGeometries[k]?.dispose();
        nodeMaterials[k]?.dispose();
        const m = nodeMeshes[k];
        if (m) {
          planetScene.remove(m);
          m.dispose();
        }
      }
      tracks.dispose();
      hidePing();
      hideGameScreen();
      for (const mesh of [pingMarker.brackets, pingMarker.ripple, pingMarker.stalk, pingMarker.core]) mesh.geometry.dispose();
      for (const mat of Object.values(pingMarker.mats)) mat.dispose();
      roost.dispose();
      for (const g of activeGantries) g.dispose();
      activeGantries.length = 0;
    },
    monsters,
    setPlayerAlive(alive: boolean) { playerAlive = alive; },
    aimGround(): { origin: { x: number; z: number }; dir: { x: number; z: number } } {
      camera.getWorldDirection(monsterFwd);
      return { origin: { x: camera.position.x, z: camera.position.z }, dir: { x: monsterFwd.x, z: monsterFwd.z } };
    },
    /** Advances the monsters by whole seconds without a frame (the tests' clock: warn, waves, the seal). */
    stepMonsters(seconds: number): void {
      const p = pos;
      camera.getWorldDirection(monsterFwd);
      const yaw = Math.atan2(monsterFwd.x, monsterFwd.z);
      const n = Math.round(seconds * 30);
      for (let i = 0; i < n; i++) monsters.update(1 / 30, { x: p.x, z: p.z, yaw, alive: playerAlive }, camera);
    },
    aimKitPart(reach: number) {
      const hit = aimKitTarget(reach);
      return hit ? { kit: hit.kit, path: hit.path, gen: hit.gen } : null;
    },
    pingTarget(reach: number) {
      const hit = pingCast(reach);
      return hit ? { hit, where } : null;
    },
    showPing: showPingAt,
    companionOrders(patch) {
      const comp = companionEntity;
      if (!comp) return 'The drone is not up yet.';
      if (patch.mode) comp.setCombatOrders({ mode: patch.mode });
      if (patch.cover) comp.setCombatOrders({ cover: patch.cover });
      if (patch.focus !== undefined) {
        if (patch.focus === null) {
          comp.setCombatOrders({ focusId: null, focusUntil: 0 });
        } else {
          // only what is within the drone's leash of the player: no orders to snipe across the map
          const mobs = combatMobs().filter((m) => Math.hypot(m.x - pos.x, m.z - pos.z) <= COMBAT_TUNING.leashM);
          const s = comp.getState();
          const pick = typeof patch.focus === 'number'
            ? mobs.find((m) => m.id === patch.focus)
            : patch.focus === 'biggest'
              ? [...mobs].sort((a, b) => b.hp - a.hp)[0]
              : [...mobs].sort((a, b) => Math.hypot(a.x - s.x, a.z - s.z) - Math.hypot(b.x - s.x, b.z - s.z))[0];
          if (!pick) return 'No target to focus on.';
          comp.setCombatOrders({ focusId: pick.id, focusUntil: combatBrain.t + FOCUS_ORDER_S, ...(comp.getCombatOrders().mode === 'hold-fire' ? { mode: 'weapons-free' } : {}) });
          return `Focusing the ${pick.kind}.`;
        }
      }
      return '';
    },
    companionCombat() {
      return { orders: companionEntity?.getCombatOrders() ?? null, targetId: combatBrain.targetId, t: combatBrain.t, mobs: combatMobs() };
    },
    noteCompanionHurtBy(mobId: number) {
      companionHurtBy = { id: mobId, at: combatBrain.t };
    },
    setCompanionTuning(patch) {
      companionTuning = patch ? { ...COMBAT_TUNING, ...patch } : COMBAT_TUNING;
    },
    companionTuning: () => companionTuning,
    companionOverclock(seconds) { overclockS = seconds <= 0 ? 0 : Math.max(overclockS, Math.min(15, seconds)); },
    companionOverclockLeft: () => overclockS,
    companionArc,
    setCompanionSymptoms(s) {
      companionSymptoms = s;
    },
    companionSymptomsAt(step) {
      return { gapFactor: companionSymptoms?.gapFactor(step) ?? 1, sway: companionSymptoms?.sway(step) ?? { x: 0, z: 0 } };
    },
    drainCombatEvents() {
      return combatEvents.splice(0, combatEvents.length);
    },
    drainCompanionBarks() {
      return companionBarks.splice(0, companionBarks.length);
    },
    pointsOfInterest,
    showGameScreen,
    showBridgePad: (on, distance) => { if (!on) { hideBridgePad(); return null; } return showBridgePad(distance); },
    bridgePadAt: () => (bridgePad ? { x: bridgePad.x, y: bridgePad.top, z: bridgePad.z } : null),
    gameScreenShown: () => gameScreen !== null,
    viewCanvas: () => renderer.domElement,
    pingMarkerAge: () => (pingMarker.where === null ? null : clock - pingMarker.born),
    kitDefaultKey(kit: string) {
      if (kit === 'gate' || kit === 'gate-dais' || kit === 'capacitor-bank' || kit === 'stargate') return kit;
      if (kit.startsWith('plot:')) {
        for (const v of views.values()) if (plotKitKey(v.m) === kit) return `machine:${v.m.kind}`;
      }
      return null;
    },
    kitOf(kit: string) {
      if (kit === 'gate') return GATE_KIT;
      if (kit === 'gate-dais') return GATE_DAIS_KIT;
      if (kit === 'capacitor-bank') return CAPACITOR_BANK_KIT;
      if (kit === 'stargate') return STARGATE_KIT;
      if (kit.startsWith('plot:')) {
        for (const v of views.values()) if (plotKitKey(v.m) === kit) return MACHINE_KITS[v.m.kind] ?? null;
      }
      return null;
    },
    setSpriteCard(kitId, card) {
      return room.setSpriteCard(kitId, card);
    },
    spriteCardOf: (kitId) => room.spriteCardOf(kitId),
    setKitOverrides(kitId: string, overrides: Overrides) {
      const imported = sporeModels.find((model) => model.kit === kitId);
      if (imported) {
        const binding = sporeModelBinding(imported.creation);
        if (!kitAudit(binding.kit, { preset: binding.preset, overrides }).ok) return false;
        // Prepare the complete replacement before swapping. Failed edits leave the old model and its targeter intact.
        const next = buildImported(imported.creation, overrides);
        next.build.group.position.copy(imported.build.group.position);
        next.build.group.quaternion.copy(imported.build.group.quaternion);
        imported.build.group.parent?.add(next.build.group);
        imported.build.group.removeFromParent();
        for (const resource of imported.resources) resource.dispose();
        imported.build = next.build; imported.resources = next.resources;
        if (kitId === 'player-rig') playerRigBuild = next.build;
        return true;
      }
      // PLAN-42-GATE: the plot's own Gate kit rebuilds in place, keeping its iris state and its pose
      if (kitId === 'stargate') {
        gateKitOverrides.value = overrides;
        buildStargate();
        return stargate !== null;
      }
      // 'gate' (and 'capacitor-bank') rebuild via the room's Gate kit.
      if (!kitId.startsWith('plot:')) return room.setKitOverrides(kitId, overrides);
      // kept for the machine's next build; a standing machine is rebuilt now, keeping its pour
      plotKitOverrides.set(kitId, overrides);
      for (const [id, v] of views) if (plotKitKey(v.m) === kitId) return kitBuildOf(rebuildView(id, v)) !== null;
      return true;
    },
    aimTree(reach: number) {
      if (where !== 'planet' || !biomeView) return null;
      camera.updateMatrixWorld(true);
      const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
      return biomeView.treeAt([camera.position.x, camera.position.y, camera.position.z], [dir.x, dir.y, dir.z], reach);
    },
    setTreeOverrides(overrides) {
      treeOverrides = overrides;
      return biomeView ? biomeView.setTreeOverrides(overrides) : 0;
    },
    treesLike(place: string, radiusM: number) {
      return biomeView?.treesLike(place, radiusM) ?? [];
    },
    rebuildMachines() {
      for (const [id, v] of [...views]) rebuildView(id, v);
      refreshFabricators();
    },
    kitPlaced(kit: string) {
      const imported = sporeModels.find((model) => model.kit === kit);
      if (imported) return imported.build.placed;
      if (!kit.startsWith('plot:')) return room.kitPlaced(kit);
      for (const v of views.values()) if (plotKitKey(v.m) === kit) return kitBuildOf(v)?.placed ?? [];
      return [];
    },
    aimLeak(range: number): number | null {
      camera.getWorldDirection(monsterFwd);
      return monsters.leakUnder({ x: camera.position.x, z: camera.position.z }, { x: monsterFwd.x, z: monsterFwd.z }, range);
    },
    setSidearmTaken(taken: boolean) {
      room.armory.setTaken(taken);
    },
    salvageWreck(id: string) {
      return wrecks.salvageWreck?.(id) ?? null;
    },
    setVehicles,
    setFabricators,
    enterVehicle,
    setVehicleHarness,
    vehicleHarnessCode: () => encodeHarnessCartridgeCode(harnessSpec),
    exitVehicle,
    getDrivingVehicle,
    getNearVehicle,
    getCompanion: () => companionEntity,
  };
  (api as any).planetScene = planetScene;
  (api as any).labScene = labScene;
  (api as any).room = room;
  (api as any).renderer = renderer;
  (api as any).camera = camera;
  (api as any).THREE = THREE;
  return api;
}

/** Lab bounds, for the screen's hints. */
export const LAB_BOUNDS = ROOM;
