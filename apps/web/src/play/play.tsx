// Play (owner, 2026-10-07; STATUS SM22, SM30): the lab in first person, your human made there, the gate turned on, the stage-0
// planet looked round, the first machine placed; then the plot's game loop (`@hm/plotsim`): mine ore, run power out, build the
// machines whose pixels raise the plot's four fidelity metrics, and climb the six stages. The scene is play-scene.ts, the
// tutorial quest.ts; this screen loads them behind a bar, reads your keys and mouse, runs the plot, saves, and says what to do.
import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { deviceFor, type Stage } from '@hm/fidelity';
import { VAULT, VAULT_BY_ID } from '@hm/vault';
import { createAdaptiveQuality, parseQuality, type Quality } from '@hm/game';
import { pixelRatioFor, resolveGraphics, type GraphicsSettings } from '@hm/render';
import { noteTier, powerPreferenceOf, saveProfile, type Profile } from '../shell/profile';
import { tierFor } from '../crafter/crafter';
import { bakeLookCached } from '../crafter/looks';
import type { Plot } from '../crafter/planet';
import { SMOOTH_IDS, smoothModel } from '../crafter/smooth-models';
import { CreateScientist } from '../avatar/create-scientist';
import type { ClipName } from '../avatar/scientist/anims-loader';
import type { OneShotKind } from '../avatar/scientist/animator';
import { createPlayScene, type Detail, type FrameOut, type LabMachineKind, type PlayScene } from './play-scene';
import { assertPlayablePreset, gateSandboxPreset, type MultiverseGamePresetSpec } from './game-presets';
import { gameBaseWorld, gamePlayState, NEW_GAME_PROGRESS, stepGameProgress, type GameProgress } from './game-mode';
import { GameHudBlade } from './game-hud';
import { bindSporeCardDrop, downloadSporeCard } from '../studio/spore-card';
import { canPlace, KINDS, level, METRICS, network, place, TARGET, rates, remove as removeMachine, running, setCartridge, setOn, step as stepPlot, type Env, type Machine, type MachineKind, type Metric, type PlotState } from '@hm/plotsim';
import {
  activity as labActivity,
  affinityOf as cartlabAffinityOf,
  canCombine,
  canMakeBlank,
  canWrite,
  makeBlank,
  rackCount,
  RULES as CARTLAB_RULES,
  slotInto,
  startCombine,
  startWrite,
  canWritePart,
  startPartWrite,
  canPrintPart,
  printPart,
  freeBlank,
  step as stepCartlab,
  unslot,
  type Cartridge,
  type LabEnv,
  type LabState,
  type PartSpec,
  type SpeciesSpec,
  type LightSpec,
  canWritePrint,
  startPrintWrite,
  readPrint,
  printKind,
  type Print,
  decodeHarnessCartridgeCode,
  type HarnessPrintSpec,
  type MaterialPrintSpec,
  type SpritePrintSpec,
  type SoundPrintSpec,
} from '@hm/cartlab';
import { renderStem } from '@hm/soundlab';
import { bakeSpritePrint, spriteAtlas, spriteBill, spriteFps, stemAtStage } from './sprite-sound-cartridge';
import type { PartOverride } from '@hm/kitspec';
import { LAYER_SHELF, materialName, resolveMatPreset, specOfName } from '@hm/matstack';
import { BenchParts } from './bench-parts';
import { BenchSpecies } from './bench-species';
import { BenchLights } from './bench-lights';
import { BenchMaterials } from './bench-materials';
import { BenchSprites } from './bench-sprites';
import { BenchSounds } from './bench-sounds';
import { BenchHarness } from './bench-harness';
import { CompanionChat } from './companion-chat';
import { HarnessTelemetryHud, type IHarnessHudViewModel } from '../base/ui/harness-telemetry-hud';
import { computeDrivingDriftBadge, type DrivingDriftBadgeState } from '@hm/hudmath/toast-queue-and-compass';
import { MY_PRESETS_KEY, parseMyPresets, presetsOf, savePreset, serializeMyPresets, type MyPresets } from './my-presets';
import { isLampPart, lightOverride } from './light-presets';
import { rifleLook } from './rifle-look';
import { MAX_TREE_VARIANTS, treeVariantKey } from './plot-biome-view';
import { setKitFrames } from './plot-kits';
import { bodyOverride, bodyMaterial, skinOverride } from './vault-skin';
import { GENERATORS } from '@hm/partgen';
import { overrideFromPart, partBill } from './part-cartridge';
import { fx } from '../maker/feedback';
import { FRESH, METRIC_COLOUR, METRIC_NAME, SAVE_KEY, arrived, created, isFreeDrill, loadState, objective, poweredOn, returned, withLab, withPlot, type PlayState } from './quest';
import { Journal } from './journal';
import { ACT_V_KIT, COUNT, advanceChain, bump, chainView, completeStepChain, finishedSteps, gateReason, monsterKilled, monsterSeen, placedKey, playerDied, playerLow, stepDone, syncChain, type Chain, type Evidence } from '../base/campaign-chain';
import { DebugMenu, readInstantBuilds, writeInstantBuilds, type DebugApi } from './debug-menu';
import type { BaseEvent } from '../base/world';
import { encodePlot, decodePlot, plotOfSnapshot } from './plot-code';
import type { Snapshot } from '@hm/plotcodec';
import { SEAL_REACH, type MonsterMobStatus, type MonsterStats } from './monsters';
import { MonsterHud, type RadarLeak } from '../monsters/hud';
import type { Archetype } from '../monsters/roster';
import type { MonstersSetting } from '../monsters/policy';
import { weaponStats, type WeaponStats } from '../base/weapons';
import { LOW_BARK_COOLDOWN, PLAYER_MAX_HP, hitBearing, hurt as hurtHp, isLow, parseMonsters, regen as regenHp } from '../monsters/policy';
import { usePlaySettings } from '../shell/play-settings';
import { captureMouse, lookFilter } from '../shell/capture-mouse';
import { kv } from '../storage/profile-storage';
import { BASE_SAVE_KEY, saveWorld } from '../base/save';
import { OUTPOST_PLOT_SEED } from '../base/plot-height';
import { ROLE_LABELS } from '../net/protocol';
import { currentOutpostSession, leaveOutpostSession, rosterOf, subscribeOutpostSession, takePendingHostSave, type OutpostSession } from '../net/outpost-session';
import { startCampaignWorld } from '../base/campaign-world';
import { BaseHud } from '../base/ui/base-hud';
import { footprintSolids, HARDPOINT_HALF } from '../base/navgrid';
import { createWorldViewSource, WorldViewSource, formatRefusalToast, formatWhy } from '../base/world-view';
import {
  apply, pieceAt, pieceAtIn, preview, withBridgeStore, BRIDGE_RANGE, BRIDGE_STORE,
  BEAM_RANGE, structureEnv, planGhosts, layoutPieces, roomAt, machineAt, INSTANT_TIME_SCALE,
  turretGridDrawKw,
  type BaseWorld, type BaseCommand, type WorldEnv, type Applied, type Plan,
} from '../base/world';
import { PieceMeshManager } from '../base/piece-meshes';
import { globalKitPieceCache, integrityColorName } from '../base/kit-pieces';
import { planFrameLegs } from '../base/foundation-legs';
import { preloadAllGenAssets, genLevelForStage, createGenFixture } from '../assets/gen-props';
import { PROPS_SAVE_KEY, parsePropsSave, serializePropsSave, clearedProp, readLog, sealedSite, withKitOverride, withTrees, withSpriteCard, withMachineHum, type PropsSave, type TreePreset } from './props-save';
import { clutterById, salvageSplit } from './lab-clutter';
import { loreFor } from './lore-logs';
import { ARMORY_PICKUP_REACH, ARMORY_RAIL_POS, SIDEARM_ITEM_ID, shouldShowAmmoBadge } from './armory-rack';
import { LoreHover, DataBank, propLabel } from './lore-ui';

const isFixture = (kind: Kind): boolean => kind === 'bin' || kind === 'bench' || kind === 'repeater' || kind === 'lifeSupport' || kind === 'weaponBench';
/** The lab's spawn beside the cot, facing north (lab-room.ts, the room's spawn): the debug menu's "The lab" teleport. */
const LAB_SPAWN = { x: -2.5, z: 1.0, yaw: 0 } as const;
import { VEHICLE, blueprint, ITEMS, pieceCost, type VehicleKind } from '../base/catalog';
import { BuildMenu, BuildPill, KIND_LABEL, type BuildTab, type MenuBlueprint, type MenuHeavy, type MenuMachine } from './build-menu';
import { MachinePickerModal } from '../base/ui/machine-picker-modal';
import { RefineryModal } from '../base/ui/refinery-modal';
import { FabricatorModal } from '../base/ui/fabricator-modal';
import { WeaponBenchModal } from '../base/ui/weapon-bench-modal';
import { MachineInspector } from '../base/ui/machine-inspector';
import { inspectMachine, type InspectAction } from '../base/machine-inspect';
import * as S from '@hm/structure';
import type { Kind } from '@hm/structure';
import * as L from '@hm/lattice';
import { BEAM_COLOURS, type BeamMode } from '@hm/beamkit';
import { BEAM_STROKE_RANGE, cycleBeamMode, SCULPT_TOOLS, cycleSculptTool, type SculptTool } from './beam-tool';
import { allWrittenOnRack, reloadedLab, writtenOnRack } from './beam-port';
import { keepOutZones } from './beam-keepout';
import { RadialMenu } from '../base/ui/radial-menu';
import { HoldRing, thumbFor, ThumbImg } from '../base/ui/hud-bits';
import type { ThumbRef } from '../base/ui/thumb-map';
import { ControlsGrid } from './controls-grid';

/** The extraction rifle's modes, as the player reads them (the chip and the toasts). */
const BEAM_LABEL: Readonly<Record<BeamMode, string>> = { extract: 'Extract', apply: 'Apply', sculpt: 'Sculpt' };
/** The sculpt tools as the player reads them (TASK-21d): picked from the X radial in Sculpt (TICKET-04). */
const SCULPT_LABEL: Readonly<Record<SculptTool, string>> = { carve: 'Carve', raise: 'Raise', smooth: 'Smooth' };
/** One slice of the X radial (TICKET-04): what it picks, its picture when it has one, and why it is locked. */
interface RadialItem { readonly id: string; readonly label: string; readonly ref: ThumbRef | null; readonly locked: string | null }
/** What the X radial shows right now, built from the held rifle's mode or the held blueprint; `pick` runs on the chosen slice. */
interface RadialSpec { readonly hint: string; readonly items: readonly RadialItem[]; readonly emptyState?: string | { readonly message: string; readonly icon?: string } | null; readonly pick: (id: string) => void }
/** How long Z is held to remove the aimed piece (TICKET-04). A tap removes nothing. */
const REMOVE_HOLD_MS = 500;
import {
  GameNarratorController,
  preloadMentorVo,
  getVoiceClipInfo,
  loadRadioLog,
  loadDialogueSettings,
  saveDialogueSettings,
} from '../audio/mentor-voice';
import {
  gameAudio,
  loadAudioSettings,
  type AudioSettings,
} from '../audio/game-audio';
import { CreditsDirector, OldMonitorJukeboxModal, isMonitorOverclockedPlaying, playMonitorOverclocked, stopMonitorOverclocked } from '../credits';
import { CreditsPlayer } from '../credits/credits-player';
import { HaddyCrtPortrait } from '../shell/haddy-crt-portrait';
import { evaluateContinentalConsensus, evaluateFinaleWindowHeal } from './planet-table-hologram';
import { GATE_AT, PRESET_BENCH_AT, stationById } from './lab-room';
import { PlanetaryGridScreen } from '../shell/planetary-grid';
import { loadRecentCodes, rememberRecentCode } from '../storage/recent-codes';
import { GATE_ACCESS_MODES, isGateAccessMode } from '../base/world';
import { irisAccessFor } from './gate-logic';
import type { GateAccessMode } from '@hm/coopnet/gate-dialer';
import { CHEVRON_LOCK_SECONDS, GATE_ARRIVAL_PAD_OFFSET_M, GATE_CHEVRON_COUNT, beginGateDial, stepGateDial } from '@hm/coopnet/gate-dialer';
import { dialRandomPlot, dialSeed, gateDirectory, openGateCount, ownGateEntry } from './gate-directory';
import { EARTH_BIOME_PRESET, MOON_BIOME_PRESET, biomeSlotSpecies, earthPlotUnlock } from '../base/biome-preset';
import { GATE_CHEVRONS, arrivalSector, creditsProgress, earthEndgameState, transitArrival, type EndgameInput } from './earth-endgame';
import { isBiosphereCoherent } from '@hm/questline';
import { fidelityRules, FIDELITY_LINE_IDS } from '@hm/narrator';
import { HudZone, CompassRibbon, DrivingHudBadge, FloatsPill, MachineLabel, SyncWord } from '../base/ui/hud-zones';
import { DiegeticRadioTunerWidget } from '../shell/diegetic-radio-tuner-widget';
import { COLLECTIBLE_MUSIC_TAPES, resolveRadioArrangementStyle } from '@hm/content';
import {
  FIDELITY_SHIFT_MS,
  fidelitySkinFor,
  isTitleCardText,
  shouldRenderMachineBillboard,
  startFidelityTrack,
  stepFidelityTrack,
} from '../base/ui/hud-zones-logic';
import '../base/base.css';
import './play.css';

/** Your plot's cartridge until the ground shader battle lands: sandy desert tones, the nearest in the vault to the concept art's stage 1. */
const PLOT = 'crater_calcite';
const SYNC_BLOCKS = 20;
/** How long Dr. Haddy's portrait stays in the top-left zone after the quest step changes (POL-40, plan 16), in ms. */
const PORTRAIT_QUEST_PING_MS = 4000;
/** Other players' plots, 1 km across like yours (owner, 2026-10-07): seen from your plot as greener, wetter patches 1.1 to 3 km away.
 *  Samples until the shared planet is wired (SETMIX_PLAN Phase 5). */
const NEIGHBOURS: readonly Plot[] = ([
  ['Mossfold', 35, 1150, 170, 'emerald_canopy', 6], ['Kettle Rise', 112, 1480, 150, 'spore_meadow', 5], ['Fernreach', 168, 1900, 190, 'solar_fern_glade', 6],
  ['Low Atoll', 214, 2350, 210, 'coral_atoll', 6], ['Prism Flats', 262, 1320, 120, 'prismata_grass', 4], ['Greywater', 305, 2700, 230, 'emerald_canopy', 5],
  ['Stillgrove', 340, 3000, 240, 'spore_meadow', 6],
] as const).map(([name, deg, dist, r, cartridge, stage]) => ({ name, r, cartridge, stage, x: Math.cos((deg * Math.PI) / 180) * dist, z: Math.sin((deg * Math.PI) / 180) * dist }));

/** The ground's triangles by tier (the display governor changes it as you play). */
const GROUND_BUDGET: Readonly<Record<Quality, number>> = { potato: 60000, low: 75000, medium: 200000, high: 200000, ultra: 280000 };
/** The most lines the planet is drawn at by tier: the later stages' resolution is capped on the light tiers, so they hold their frame rate. */
const PLANET_LINES: Readonly<Record<Quality, number>> = { potato: 360, low: 480, medium: 1080, high: 1e5, ultra: 1e5 };
const detailOf = (g: GraphicsSettings, q: Quality): Detail => ({ plumes: g.pixelPlumes, plumeDensity: g.plumeDensity, groundBudget: GROUND_BUDGET[q], planetLines: PLANET_LINES[q], plumeGlow: g.plumeGlow, pixelLights: g.pixelLights, windowView: g.windowView, suitCam: g.suitCamOptics, suitCamTier: q === 'medium' || q === 'high' || q === 'ultra' });
/** The bearing from the player's facing to the planet's gate (degrees, positive to the right) and the distance in metres. */
function gateBearingOf(scene: PlayScene | null): { readonly relativeDeg: number; readonly distanceM: number } | null {
  if (!scene) return null;
  const p = scene.debug.position();
  const g = scene.debug.gatePlanet();
  const dx = g.x - p.x;
  const dz = g.z - p.z;
  const yaw = scene.debug.facing();
  // the forward direction on the ground for this yaw, and the Gate's direction from the player
  const fwd = Math.atan2(-Math.sin(yaw), -Math.cos(yaw));
  const off = fwd - Math.atan2(dx, dz);
  return { relativeDeg: (Math.atan2(Math.sin(off), Math.cos(off)) * 180) / Math.PI, distanceM: Math.hypot(dx, dz) };
}

/** What each stage brings, for the toast when its wave has crossed the plot. */
const STAGE_SAYS: readonly string[] = [
  'Stage 0: 1-Bit Dither. Reality degraded; digital entities roam unbound.',
  'Stage 1: 16-Color EGA. Colour reaches the moon; basic geometry stabilizes.',
  'Stage 2: 256-Color VGA. Shapes smooth out; resolution wave gathers strength.',
  'Stage 3: Lit Gouraud. Diffuse light returns; deeper sky over the craters.',
  'Stage 4: Full PBR & Detail. High fidelity restored; spreading toward Earth.',
  'Stage 5: Life takes hold across the planetary surface.',
  'Stage 6: Full fidelity: reality is healed and stabilized.',
];


/** What the world shows, for the chain's derived counters (TASK-22, campaign-chain.ts). */
function worldEvidence(w: BaseWorld, plot: PlotState): Evidence {
  const stacks = [...w.player.slots, ...w.boxes.flatMap((b) => b.slots), ...Object.values(w.equipment)];
  const localS = { Pxd: plot.points.pxd, Vtx: plot.points.vtx, Lx: plot.points.lx, Aq: plot.points.aq };
  const bio = isBiosphereCoherent(localS);
  return {
    stage: plot.stage,
    drillsRunning: plot.machines.filter((m) => m.kind === 'drill' && m.on).length,
    machineKinds: w.machines.map((m) => m.kind),
    vehicleKinds: w.vehicles.map((v) => v.kind),
    sidearm: !!w.equipment.sidearm,
    itemIds: stacks.flatMap((st) => (st ? [st.item] : [])),
    biosphereStage4: bio,
  };
}

/** The counters a batch of base events moves (TASK-22). */
function chainPairs(events: readonly BaseEvent[]): [string, number][] {
  const out: [string, number][] = [];
  for (const ev of events) {
    if (ev.type === 'placed') out.push([placedKey(ev.kind), 1]);
    else if (ev.type === 'drafted') out.push([COUNT.drafted, 1]);
    else if (ev.type === 'forged') out.push([COUNT.forged, 1]);
    else if (ev.type === 'fitted') out.push([COUNT.fitted, 1]);
    else if (ev.type === 'printed' && ev.kind === 'scout') out.push([COUNT.printedScout, 1]);
    else if (ev.type === 'installed' && ev.kind === 'fabricator') out.push([COUNT.installedFabricator, 1]);
    else if (ev.type === 'harvested' && ev.items.some((i) => ITEMS[i.item]?.kind === 'raw-pxd')) out.push([COUNT.harvestPxd, 1]);
  }
  return out;
}

function loadSaved(): PlayState { try { return loadState(JSON.parse(kv.get(SAVE_KEY) ?? 'null')); } catch { return FRESH; } }
function save(s: PlayState): void { try { kv.set(SAVE_KEY, JSON.stringify(s)); } catch { /* storage unavailable: progress lives for this visit */ } }
/**
 * The beam's save (TASK-21d): the sculpt edits and the paint (encodeField text), and the cartridge in the port. It has its own
 * profile key: not the base world's save and not the play save. A broken or old save starts a fresh plot, with an empty port.
 */
const BEAM_SAVE_KEY = 'hm.setmix.beam';
/** `?cleanShot=1`: the review shots' switch. The pointer-lock prompt, the stats panel and the HUD overlays stay hidden (TASK-24). */
const cleanShotMode = typeof location !== 'undefined' && new URLSearchParams(location.search).has('cleanShot');
/** Hold E this long on a salvage prop in the lab to clear it (TASK-23c). */
const CLEAR_HOLD_SECONDS = 1.0;
/** The armory rail's pickup point, in the lab (armory-rack.ts): E within ARMORY_PICKUP_REACH of it takes the sidearm (TICKET-07 Item D). */
const ARMORY_PICKUP_AT = { x: ARMORY_RAIL_POS.x - 0.08, z: ARMORY_RAIL_POS.z } as const;
function nearArmoryPickup(p: { readonly x: number; readonly z: number }): boolean {
  return Math.hypot(p.x - ARMORY_PICKUP_AT.x, p.z - ARMORY_PICKUP_AT.z) <= ARMORY_PICKUP_REACH;
}
/** Whether E does something with the aimed prop: a lab prop (read or salvage), or a planet prop with a log. A wreck with no log is not one. */
function aimedPropActs(p: { readonly id: string; readonly salvage: boolean }, where: FrameOut['where']): boolean {
  return p.salvage || where === 'lab' || loreFor(p.id) !== null;
}
/** Where a lab salvage goes: the pack first, then the network in reach of the gate (the bridge). */
const SALVAGE_AT = { x: 0, z: 0 } as const;
interface BeamSave { readonly field: string | null; readonly port: Cartridge | null }
function loadBeamSave(): BeamSave {
  try {
    const raw = JSON.parse(kv.get(BEAM_SAVE_KEY) ?? 'null') as { readonly v?: unknown; readonly field?: unknown; readonly port?: unknown } | null;
    if (!raw || raw.v !== 1) return { field: null, port: null };
    const p = raw.port as Partial<Cartridge> | null | undefined;
    // a written preset, or a print (a part, a species, a light: it travels in the port, so it must survive the reload too)
    const print = p && (p.kind === 'part' || p.kind === 'species' || p.kind === 'light') ? readPrint(p) : null;
    const printOk = print !== null && printKind(print) === p?.kind;
    const port = p && typeof p === 'object' && typeof p.id === 'string' && typeof p.name === 'string' && (typeof p.preset === 'string' || printOk) ? (p as Cartridge) : null;
    return { field: typeof raw.field === 'string' && raw.field.length > 0 ? raw.field : null, port };
  } catch {
    return { field: null, port: null };
  }
}
/** A session's host save: the room's world, written into this device's base save when the session ends (plan 36, Phase 1). */
function writePendingHostSave(): void {
  const world = takePendingHostSave();
  if (!world) return;
  try {
    kv.set(BASE_SAVE_KEY, saveWorld(world));
  } catch (e) {
    console.warn('[host save sync error]', e);
  }
}

const LINK_TEXT: Readonly<Record<string, string>> = {
  connecting: 'Connecting',
  connected: 'Connected',
  reconnecting: 'Reconnecting',
  disconnected: 'Disconnected',
  error: 'Connection error',
};

/** The room in the sync indicator: its code, the link, who is in it with their role, and a way out. */
function OutpostRoster({ session }: { readonly session: OutpostSession }) {
  const [, bump] = useState(0);
  useEffect(() => session.client.onStateChange(() => bump((n) => n + 1)), [session]);
  const link = session.client.state().connectionState;
  const roster = rosterOf(session.client);
  return (
    <div
      role="group"
      aria-label="Outpost room"
      data-testid="play-roster"
      style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 5, fontFamily: 'Inter, system-ui, sans-serif', fontSize: 11, color: '#e2e8f0', pointerEvents: 'auto' }}
    >
      <span data-testid="play-roster-code">Room {session.code ?? '------'}, {LINK_TEXT[link] ?? link}</span>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'flex-start', maxWidth: 300 }}>
        {roster.map((p) => (
          <li key={p.id} data-testid="play-roster-chip" style={{ padding: '3px 8px', borderRadius: 999, border: '1px solid rgba(255,255,255,0.16)', background: 'rgba(6,10,18,0.78)' }}>
            <b style={{ fontWeight: 600 }}>{p.name}</b>{' '}
            <span style={{ color: p.role === 'owner' ? '#ffc13d' : p.role === 'cobuilder' ? '#3dc8ff' : '#94a3b8' }}>{ROLE_LABELS[p.role]}</span>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => leaveOutpostSession()}
        style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(61,200,255,0.4)', background: 'rgba(61,200,255,0.14)', color: '#3dc8ff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
      >
        Leave room
      </button>
    </div>
  );
}

function saveBeam(field: string, port: Cartridge | null): void {
  try { kv.set(BEAM_SAVE_KEY, JSON.stringify({ v: 1, field: field.length > 0 ? field : null, port })); } catch { /* storage unavailable: the edits live for this visit */ }
}

/** The plot's numbers for the HUD. */
interface PlotHud { readonly ore: number; readonly oreRate: number; readonly supply: number; readonly demand: number; /** Kilowatts supplied over asked, capped at 1: the machines run at this share (TASK-26). */ readonly satisfaction: number; readonly levels: Readonly<Record<Metric, number>>; readonly stage: number }
interface Hud { readonly where: FrameOut['where']; readonly sync: number; readonly inDome: boolean; readonly warn: boolean; readonly atLever: boolean; readonly atDial: boolean; readonly ghost: FrameOut['ghost']; readonly aimed: number | null; readonly aimedBoulder: FrameOut['aimedBoulder']; readonly aimedLab: FrameOut['aimedLab']; readonly aimedProp: FrameOut['aimedProp']; readonly plot: PlotHud; readonly visitingOwner: string | null; readonly atArmory: boolean }
const NO_PLOT: PlotHud = { ore: 0, oreRate: 0, supply: 0, demand: 0, satisfaction: 1, levels: { pxd: 0, vtx: 0, lx: 0, aq: 0 }, stage: 0 };
/** The build menu, in the order the plot needs them. */
const BUILD_ORDER: readonly MachineKind[] = ['mill', 'drill', 'pylon', 'press', 'power', 'projector', 'water'];
const BLURB: Readonly<Record<MachineKind, string>> = {
  mill: 'Grinds ore into texture detail: pink pixels.', drill: 'Mines ore from the ground, best on rock and scree.', pylon: 'Carries power further out.',
  press: 'Stamps the plot\'s shapes finer: green pixels.', power: 'Burns ore to make more power.', projector: 'Raises the light: amber pixels.',
  water: 'Condenses water from gravel: cyan pixels.',
  // heavy kinds are installed on a base hardpoint, never from this menu (BUILD_ORDER leaves them out)
  'heavy-mill': 'Refines raw pixels into texture maps and floods the plot with pink pixels.',
  'heavy-press': 'Presses raw vertices into primitives and floods the plot with green pixels.',
  'heavy-projector': 'Floods the plot with amber light pixels.',
  'heavy-water': 'Floods the plot with cyan water pixels.',
};
const signed = (v: number): string => `${v >= 0 ? '+' : ''}${v.toFixed(1)}`;
/** The heavy machines, installed on a base hardpoint (the Heavy tab of the build menu). */
const HEAVY_CARDS: readonly MenuHeavy[] = [
  { kind: 'mill', name: 'Heavy mill', blurb: BLURB['heavy-mill'] },
  { kind: 'press', name: 'Heavy press', blurb: BLURB['heavy-press'] },
  { kind: 'projector', name: 'Heavy projector', blurb: BLURB['heavy-projector'] },
  { kind: 'water', name: 'Heavy water', blurb: BLURB['heavy-water'] },
];
/** The hint line under the play screen: the few keys a new player needs first. */
const KEYS: readonly [string, string][] = [['W A S D', 'walk'], ['Mouse', 'look'], ['E', 'use'], ['B', 'build'], ['V', 'view'], ['Esc', 'pause']];
/** Every key of the campaign, as the pause menu lists them (one meaning per key: E interacts, V views, T integrity). */
const CONTROLS: readonly [string, string][] = [
  ['W A S D', 'Walk'], ['Mouse', 'Look (click the world to capture the mouse)'], ['Shift', 'Run'],
  ['E', 'Use: leave or enter a vehicle, use a station, machine or bin; hold on a boulder to gather ore'],
  ['B', 'Build menu: Machines, Structures, Heavy, Plans; B again ends the build'], ['Q', 'Previous structure kind (the wheel too); with the beam out, the beam mode'],
  ['R', 'Rotate the piece you hold, or the layout while you place it; with the beam out, reload its port'],
  ['X', 'Radial wheel: the structure kinds you hold, the beam cartridges (Apply) or the sculpt tools (Sculpt)'],
  ['Hold Z', 'Remove the piece you aim at (keep Z down for half a second)'],
  ['G', 'Draw or holster the extraction beam (the rifle)'], ['Left mouse', 'Hold with the beam out: mine a boulder (Extract), paint the port (Apply), cut or raise the ground (Sculpt)'],
  ['F', 'Build the plan you stand near'], ['T', 'Structural integrity overlay'], ['V', 'First or third person view'],
  ['Space', 'Jump (on foot); brake a vehicle'], ['Tab or I', 'Inventory'], ['K', 'Drafting table'],
  ['L', 'Lattice storage'], ['1 to 9', 'Hotbar slot, always (sculpt included)'], ['Esc', 'Close the open thing, then pause'],
];

/** The iris states as the player reads them (plan 42 section 4.3: the world's three `GATE_ACCESS_MODES`). */
const GATE_ACCESS_LABEL: Readonly<Record<GateAccessMode, string>> = {
  open: 'Open',
  'code-only': 'Code only',
  closed: 'Closed (iris locked)',
};
const GATE_ACCESS_DOC: Readonly<Record<GateAccessMode, string>> = {
  open: 'Your gate is listed: explorers dialing at random can land here.',
  'code-only': 'Unlisted: only a traveller with your six-chevron code can dial in.',
  closed: 'The iris is shut: nobody dials in, and your own outbound dialing still works.',
};

/** Where the shell sends the player in: a visit dials a plot code; a spawn puts the player in the lab or at the moon gate (TICKET-08a). */
/** TICKET-14: a credits run on this screen, and where it started (the title's Ending Credits item, or the old monitor). */
interface CreditsRun { readonly from: 'title' | 'lab'; readonly director: CreditsDirector }
/** Where the player stood when the credits began, so Esc puts them back there. */
interface CreditsSave { readonly where: 'lab' | 'planet'; readonly x: number; readonly z: number; readonly yaw: number; readonly stage: number }
/** The old monitor's place in the lab (lab metres), for the overclocked track's speaker. */
const OLD_MONITOR_AT = { x: 7.68, y: 1.0, z: -8.6 } as const;

export type PlayEntry = { readonly kind: 'visit'; readonly code: string } | { readonly kind: 'spawn'; readonly where: 'lab' | 'gate' } | { readonly kind: 'credits' };

export function PlayScreen(props: {
  readonly profile: Profile;
  /** Opens the Studio from the journal (the shell's Studio route). */
  readonly onStudio?: () => void;
  readonly onBack: () => void;
  readonly initialSyncMode?: 'desynced' | 'synced';
  /** Applied once, when the lab is ready (the Planetary Grid's visit or spawn). */
  readonly entry?: PlayEntry;
  readonly gamePreset?: MultiverseGamePresetSpec;
  readonly onGamePreset?: (preset: MultiverseGamePresetSpec) => void;
}): ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<PlayScene | null>(null);
  const reduced = useMemo(() => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } }, []);
  const tier = useMemo(() => tierFor(props.profile), [props.profile.quality]); // eslint-disable-line react-hooks/exhaustive-deps
  const [syncMode, setSyncMode] = useState<'desynced' | 'synced'>(() => props.initialSyncMode ?? 'desynced');
  const [state, setState] = useState<PlayState>(() => props.gamePreset ? gamePlayState(props.gamePreset) : loadSaved());
  const featureLock: typeof gateReason = (feature, chain, stage) => props.gamePreset ? null : gateReason(feature, chain, stage);
  const [gameProgress, setGameProgress] = useState<GameProgress>(NEW_GAME_PROGRESS);
  const gameProgressRef = useRef(NEW_GAME_PROGRESS);
  const waveMobIds = useRef<readonly number[]>([]);
  const stateRef = useRef(state);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(props.gamePreset ? `Opening ${props.gamePreset.title}` : 'Opening the lab');
  const [failed, setFailed] = useState(false);
  const [locked, setLocked] = useState(false);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  useEffect(() => { pausedRef.current = paused; }, [paused]);
  const [menu, setMenu] = useState(false);
  const [buildTab, setBuildTab] = useState<BuildTab>('machines');
  const [building, setBuilding] = useState<MachineKind | null>(null);
  const [hud, setHud] = useState<Hud>({ where: 'lab', sync: 1, inDome: false, warn: false, atLever: false, atDial: false, ghost: null, aimed: null, aimedBoulder: null, aimedLab: null, aimedProp: null, plot: NO_PLOT, visitingOwner: null, atArmory: false });
  const firstGatherRef = useRef(false);

  // TICKET-14: the credits video. The title's Ending Credits item starts it here, and so does the old monitor's replay.
  // One director per screen. The frame loop steps it before the scene draws; Esc ends it.
  const [creditsRun, setCreditsRun] = useState<CreditsRun | null>(null);
  const pendingGatePresetRef = useRef<MultiverseGamePresetSpec | null>(null);
  const creditsRef = useRef<CreditsRun | null>(null);
  const creditsDirectorRef = useRef<CreditsDirector | null>(null);
  const creditsSaveRef = useRef<CreditsSave | null>(null);
  const startCreditsRef = useRef<((from: CreditsRun['from']) => void) | null>(null);
  const [jukeboxOpen, setJukeboxOpen] = useState(false);
  const jukeboxRef = useRef(false);
  jukeboxRef.current = jukeboxOpen;
  const [endingSeen, setEndingSeen] = useState<boolean>(() => {
    try { return kv.get('hm.endingSeen') === '1'; } catch { return false; }
  });
  const finaleRef = useRef<{
    active: boolean;
    startWallMs: number;
    voiceTriggered: boolean;
    done: boolean;
  } | null>(null);
  /** The credits' director, made once per screen. Its three tracks are read in the background, so a replay starts at once. */
  const prepareCredits = (): CreditsDirector | null => {
    const scene = sceneRef.current;
    if (!scene) return null;
    const director = creditsDirectorRef.current ?? new CreditsDirector(scene.debug.camera(), {}, scene);
    creditsDirectorRef.current = director;
    void director.loadAssets();
    return director;
  };
  const startCredits = (from: CreditsRun['from']): void => {
    if (creditsRef.current) return;
    const scene = sceneRef.current;
    if (!scene) return;
    const director = prepareCredits();
    if (!director) return;
    director.setSceneTarget(scene);
    // where the player stands now: Esc puts them back here
    const at = scene.debug.position();
    creditsSaveRef.current = { where: scene.debug.where() === 'planet' ? 'planet' : 'lab', x: at.x, z: at.z, yaw: scene.debug.facing(), stage: stateRef.current.plot.stage };
    const run: CreditsRun = { from, director };
    creditsRef.current = run;
    setCreditsRun(run);
    setJukeboxOpen(false);
    document.exitPointerLock?.();
    gameAudio.setMusicContext('silent');
    const allowCreditsHook = debugHooks || (typeof location !== 'undefined' && (location.hostname === 'localhost' || location.hostname === '127.0.0.1'));
    if (allowCreditsHook) {
      (window as unknown as { __creditsDirector?: CreditsDirector }).__creditsDirector = director;
    }
    void director.loadAssets().then(() => {
      if (creditsRef.current === run) director.start(false);
    });
  };
  startCreditsRef.current = startCredits;
  const stopCredits = (): void => {
    const run = creditsRef.current;
    if (!run) return;
    run.director.stop();
    creditsRef.current = null;
    setCreditsRun(null);
    const allowCreditsHook = debugHooks || (typeof location !== 'undefined' && (location.hostname === 'localhost' || location.hostname === '127.0.0.1'));
    if (allowCreditsHook) {
      delete (window as unknown as { __creditsDirector?: CreditsDirector }).__creditsDirector;
    }
    const scene = sceneRef.current;
    const save = creditsSaveRef.current;
    if (scene && save) {
      scene.setBeamHeld(false, 'extract');
      scene.setBeamSealing(false);
      scene.setBeamFiring(false);
      scene.setFidelityStage(stateRef.current.plot.stage);
      scene.setCameraView(props.profile.cameraView ?? 'first');
      scene.debug.teleport(save.where, save.x, save.z, save.yaw);
    }
    gameAudio.setMusicContext(save?.where === 'planet' ? 'moon' : 'lab');
    if (run.from === 'title') props.onBack();
    else if (pendingGatePresetRef.current) {
      const preset = pendingGatePresetRef.current; pendingGatePresetRef.current = null;
      props.onGamePreset?.(preset); // first-time campaign credits finish before the shared preset gateway opens
    }
  };
  const replayCredits = (): void => {
    creditsRef.current?.director.start(false);
  };
  const toggleMonitorOverclocked = (): void => {
    if (isMonitorOverclockedPlaying()) {
      stopMonitorOverclocked();
      say('Monitor', 'The overclocked track is off.');
      return;
    }
    void playMonitorOverclocked(OLD_MONITOR_AT).then((ok) => {
      if (!ok) say('Monitor', 'No sound on this device.');
    });
    say('Monitor', 'Four Floats (Overclocked), through the lab monitor.');
  };

  // TASK-11 Mentor Narration Controller & UI
  // The radio log belongs to the profile's one save. It was keyed by the avatar's name, which is only known after the
  // creator, so a reload read an empty log and the wake (A1-01) played again. One key now; an avatar-keyed log from an
  // older save is read too, so nothing replays for it.
  const slotKey = props.gamePreset ? `game:${props.gamePreset.id}` : 'campaign';
  const avatarLogKey = state.avatar ? (state.avatar.kind === 'custom' ? state.avatar.key : state.avatar.name) : null;
  const savedHeard = (): string[] => (state.step === 'create' ? [] : [...new Set([...loadRadioLog(slotKey), ...(avatarLogKey ? loadRadioLog(avatarLogKey) : [])])]);
  const narratorRef = useRef<GameNarratorController | null>(null);
  /**
   * The highest stage whose line has been triggered. A stage is reported twice (the placement or the skip, then the wave's
   * own stage-up event when it finishes); the second report must not queue the next story line (S-2 after A4-04 at stage 2).
   */
  const stageLinedRef = useRef<number>(state.plot.stage);
  const triggerStageLine = (stage: number): void => {
    if (stage <= stageLinedRef.current) return;
    stageLinedRef.current = stage;
    narratorRef.current?.trigger(`stage:${stage}`);
  };
  const [subtitle, setSubtitle] = useState<{ id: string; text: string; cleanText: string } | null>(null);
  // the HUD's skin (TASK-25, plan 28): the stage under the player picks it; a flip waits 0.5 s, then glitches for 120 ms
  const [skinTrack, setSkinTrack] = useState(() => startFidelityTrack('3', 0));
  const [skinGlitch, setSkinGlitch] = useState(false);
  const whereRef = useRef<Hud['where']>('lab');
  whereRef.current = hud.where;
  // the scene's own where, set every frame: the HUD state (hud) is written at most every 90 ms, so a key pressed on arrival reads this instead
  const liveWhereRef = useRef<Hud['where']>('lab');
  // a stage title card holds the radio line that follows it (P0-HOUR-02): the line waits until the card's 3 s are up
  const titleCardUntilRef = useRef(0);
  const subtitleHoldRef = useRef<{ id: string; text: string; cleanText: string } | null>(null);
  const altHeldRef = useRef(false);
  // a placement session: a piece picked from the build ribbon. Its pill and the open drawer hold the radio line back.
  const pieceSessionRef = useRef(false);
  const [radioLogOpen, setRadioLogOpen] = useState(false);
  const [collectedTapes, setCollectedTapes] = useState<string[]>([]);
  const labWindowClosedAtRef = useRef<{ bench: number; combiner: number; rack: number; fabricator: number }>({ bench: -10, combiner: -10, rack: -10, fabricator: -10 });
  const [journalOpen, setJournalOpen] = useState(false);
  /** The debug menu (Esc, then Debug menu): the testers' panel, in every build. Its hooks are set by the dev effect below. */
  const [debugOpen, setDebugOpen] = useState(false);
  const debugApiRef = useRef<DebugApi | null>(null);
  /** Running seconds of the texture mill and metres driven, whole units go to the chain (TASK-22). */
  const millAccRef = useRef(0);
  const driveAccRef = useRef(0);
  const [heardLogs, setHeardLogs] = useState<readonly string[]>(savedHeard);
  const [dialogueSettings, setDialogueSettings] = useState(() => loadDialogueSettings());
  const [audioSettings, setAudioSettings] = useState<AudioSettings>(() => loadAudioSettings());
  const lookPowerWallTimerRef = useRef(0);
  const lookWindowTimerRef = useRef(0);
  const prevSyncRef = useRef(1);
  const audioInitializedRef = useRef(false);

  const initNarratorAudio = useCallback(() => {
    if (audioInitializedRef.current || typeof AudioContext === 'undefined' || !narratorRef.current) return;
    try {
      const ctx = gameAudio.getContext();
      narratorRef.current.initAudio(ctx, gameAudio.getDialogueBus());
      narratorRef.current.setDuckCallback((ducked) => gameAudio.duckMusic(ducked));
      audioInitializedRef.current = true;
    } catch (e) {
      console.warn('[mentor-voice] audio init error:', e);
    }
  }, []);

  useEffect(() => {
    if (props.gamePreset) return; // no campaign narration, intro or radio-log writes in standalone play
    if (!narratorRef.current) {
      const defaultRules = fidelityRules(Object.fromEntries(FIDELITY_LINE_IDS.map((id) => [id, 3])));
      const initialLogs = savedHeard();
      narratorRef.current = new GameNarratorController(defaultRules, initialLogs, loadDialogueSettings(), slotKey);
    }
    const unsubSub = narratorRef.current.onSubtitle((s) => {
      // a line that arrives under a stage title card waits for the card (P0-HOUR-02); a clear always goes through
      const wait = titleCardUntilRef.current - performance.now();
      if (s && wait > 0) {
        subtitleHoldRef.current = s;
        window.setTimeout(() => {
          if (subtitleHoldRef.current !== s) return;
          subtitleHoldRef.current = null;
          setSubtitle(s);
        }, wait);
        return;
      }
      if (!s) subtitleHoldRef.current = null;
      setSubtitle(s);
    });
    const unsubLog = narratorRef.current.onRadioLog(setHeardLogs);
    return () => {
      unsubSub();
      unsubLog();
    };
  }, [slotKey]);
  /** The machine whose panel is open (its plot id). */
  const [panel, setPanel] = useState<number | null>(null);
  /** The lab machine whose panel is open ('rack' | 'bench' | 'combiner'). */
  const [labPanel, setLabPanel] = useState<LabMachineKind | null>(null);
  const [benchBlank, setBenchBlank] = useState<string | null>(null);
  /** The preset bench's page: authored terraforming presets, or Shape Press parts (TICKET-32). */
  const [benchTab, setBenchTab] = useState<'presets' | 'parts' | 'species' | 'lights' | 'sprites' | 'sounds' | 'harness'>('presets');
  /** The Materials page's shelf (plan 41): the ground's terraforming materials, or the machines' layered ones. */
  const [materialShelf, setMaterialShelf] = useState<'ground' | 'machines'>('ground');
  /** The player's own presets (plan 39 section 7): "Yours" on every bench page, kept in the profile. */
  const [myPresets, setMyPresets] = useState<MyPresets>(() => parseMyPresets(kv.get(MY_PRESETS_KEY)));
  /** Keeps a print in the player's presets and says so (or that it was already there). */
  const saveMyPreset = (print: Print): void => {
    const { presets, preset } = savePreset(myPresets, print);
    if (presets === myPresets) {
      say('Already in your presets', `${preset.name} is in Yours.`);
      return;
    }
    try { kv.set(MY_PRESETS_KEY, serializeMyPresets(presets)); } catch { /* the list still holds it for this session */ }
    setMyPresets(presets);
    say(`Saved: ${preset.name}`, 'It is in Yours on the bench, the Drafting Table and the Studio.');
  };
  const [benchPreset, setBenchPreset] = useState<string | null>(null);
  const [combineIds, setCombineIds] = useState<readonly string[]>([]);
  /** State of visiting another player's plot via code. */
  const [visiting, setVisiting] = useState<{ readonly snapshot: Snapshot; readonly plot: PlotState; readonly lab: LabState } | null>(null);
  const visitingRef = useRef<{ readonly snapshot: Snapshot; readonly plot: PlotState; readonly lab: LabState } | null>(null);
  const [dialOpen, setDialOpen] = useState(false);
  const [dialInput, setDialInput] = useState('');
  const [dialError, setDialError] = useState<string | null>(null);
  /** The plot's iris state as the panel shows it (the world holds the truth; this mirrors it so the buttons re-paint). */
  const [gateAccess, setGateAccess] = useState<GateAccessMode>('open');
  /** The random dial's chevron lock: which chevrons are lit, and the pressed count the walk is on. */
  const [gateDial, setGateDial] = useState<{ readonly code: string; readonly locked: number } | null>(null);
  const [randomError, setRandomError] = useState<string | null>(null);
  /** The plots this explorer has walked this session (the random dial prefers one it has not). */
  const [walkedPlots, setWalkedPlots] = useState<readonly string[]>([]);
  const gatePresses = useRef(0);
  const dialRef = useRef<((code: string) => { readonly ok: boolean; readonly why?: string }) | null>(null);
  const openDialRef = useRef<(() => void) | null>(null);
  /** Set while a menu takes the mouse: losing the pointer lock then does not pause. */
  const quietRef = useRef(false);
  /** The plot runs every frame here; the saved state catches up every few seconds and on events. */
  const plotRef = useRef<PlotState>(state.plot);
  const labRef = useRef<LabState>(state.lab);
  const envRef = useRef<Env | null>(null);
  const placeRef = useRef<((kind: MachineKind, x: number, z: number, yaw: number) => boolean) | null>(null);
  const [toast, setToast] = useState<{ readonly text: string; readonly sub: string; readonly id: number } | null>(null);
  const [statusToast, setStatusToast] = useState<{ readonly text: string; readonly id: number } | null>(null);
  const statusToastTimerRef = useRef<number | null>(null);
  const showStatusToast = useCallback((text: string) => {
    if (statusToastTimerRef.current !== null) window.clearTimeout(statusToastTimerRef.current);
    const id = Date.now();
    setStatusToast({ text, id });
    statusToastTimerRef.current = window.setTimeout(() => {
      setStatusToast((cur) => (cur?.id === id ? null : cur));
      statusToastTimerRef.current = null;
    }, 3000);
  }, []);
  const isMashTest = typeof location !== 'undefined' && (new URLSearchParams(location.search).has('mash') || new URLSearchParams(location.search).has('monstermash'));
  const isDevSeed = typeof location !== 'undefined' && new URLSearchParams(location.search).get('kit') === '1';
  /** The debug switch (TASK-20): `window.__dev` exists in dev builds and when the URL has `?e2e`. Players never get it. */
  const debugHooks = import.meta.env.DEV || (typeof location !== 'undefined' && new URLSearchParams(location.search).has('e2e'));
  /** The draw-call readout (Settings: Show performance stats; on under `?e2e`). Players see it only when they turn it on. */
  const showStatsOn = !cleanShotMode && ((typeof location !== 'undefined' && new URLSearchParams(location.search).has('e2e')) || resolveGraphics('low', props.profile.graphics).showStats);
  const creating = state.step === 'create' && !isMashTest;

  useEffect(() => {
    if (isDevSeed && plotRef.current.machines.length === 0) {
      plotRef.current = {
        ...plotRef.current,
        ore: Math.max(plotRef.current.ore, 600),
        machines: [
          {
            id: 1,
            kind: 'power',
            x: 0,
            z: -6,
            yaw: 0,
            on: true,
            cartridge: null,
            built: 0,
          },
        ],
        nextId: 2,
      };
    }
  }, [isDevSeed]);

  const commit = useCallback((next: PlayState) => { stateRef.current = next; setState(next); if (!props.gamePreset) save(next); }, [props.gamePreset]);
  /** The campaign chain (TASK-22): change the counters, read the world as evidence, run the questline, save if it moved. */
  const updateChain = useCallback((f: (c: Chain) => Chain) => {
    if (props.gamePreset) return;
    const before = stateRef.current.chain;
    const next = advanceChain(syncChain(f(before), worldEvidence(baseWorldRef.current, plotRef.current)));
    if (JSON.stringify(next) === JSON.stringify(before)) return;
    commit(withLab(withPlot({ ...stateRef.current, chain: next }, plotRef.current), labRef.current));
    const newly = finishedSteps(next.progress).filter((id) => !finishedSteps(before.progress).includes(id));
    if (newly.includes('A4-02')) narratorRef.current?.trigger('dirt:process');
    if (newly.includes('A4-04')) {
      // Act V opens: the bridge store gets the primitives a hardpoint and a heavy press need (campaign-chain.ts ACT_V_KIT),
      // through the logged `grant` command, so a replay of the base's log holds the same stock
      dispatchBaseRef.current({ t: 'grant', stock: ACT_V_KIT });
      say('Bridge stock delivered', 'Primitives for a hardpoint and a heavy press are on the bridge.');
    }
  }, [commit]);
  const say = useCallback((text: string, sub = '') => setToast({ text, sub, id: Date.now() }), []);
  /** The debug menu's "Complete this step": the chain moves exactly one step on (completeStepChain). Returns the step id, or null. */
  const completeStepNow = useCallback((): string | null => {
    const before = stateRef.current.chain;
    const current = chainView(before).current;
    if (!current) return null;
    const moved = completeStepChain(before);
    const next = stepDone(moved, 'F-03') ? { ...moved, monstersUnlocked: true } : moved;
    commit(withLab(withPlot({ ...stateRef.current, chain: next }, plotRef.current), labRef.current));
    if (stepDone(next, 'F-03')) sceneRef.current?.monsters.setUnlocked(true);
    return current.id;
  }, [commit]);
  /** The debug menu's "Complete this act": the act's quest is marked finished, as the dev hook finishAct does. Returns the act id, or null. */
  const completeActNow = useCallback((): string | null => {
    const quest = stateRef.current.chain.progress.quest;
    if (quest === null) return null;
    updateChain((c) => advanceChain({ ...c, progress: { ...c.progress, finished: [...c.progress.finished.filter((x) => x !== quest), quest] } }));
    return quest;
  }, [updateChain]);
  useEffect(() => {
    if (!toast) return undefined;
    // a title card holds the other banners (CANNOT PLACE) until it fades: 3 s, at 72 px from the top (P0-UI-01)
    document.body.dataset.titleUp = '1';
    if (isTitleCardText(toast.text)) titleCardUntilRef.current = performance.now() + 3000;
    const t = window.setTimeout(() => setToast((x) => (x?.id === toast.id ? null : x)), 3000);
    return () => {
      window.clearTimeout(t);
      delete document.body.dataset.titleUp;
    };
  }, [toast]);
  // the suit cam's optics halve while the build drawer or a placement is open (plan 25)
  useEffect(() => { sceneRef.current?.setBuildOpen(menu || building !== null); }, [menu, building]);
  // the skin follows the ground under the player: a candidate must hold 0.5 s before the HUD flips (fidelity skins)
  useEffect(() => {
    const id = window.setInterval(() => {
      const candidate = fidelitySkinFor({
        stage: plotRef.current.stage,
        machinesOnPlot: plotRef.current.machines.length,
        inShieldedLab: whereRef.current === 'lab',
        labPowerOn: stateRef.current.gateOn,
      });
      setSkinTrack((t) => stepFidelityTrack(t, candidate, performance.now()));
    }, 250);
    return () => window.clearInterval(id);
  }, []);
  // a flip plays its 120 ms glitch once; the timer is not tied to the track, so the next tick cannot cut it short
  useEffect(() => {
    if (!skinTrack.flipped) return;
    setSkinGlitch(true);
    gameAudio.playSkinDegauss();
    window.setTimeout(() => setSkinGlitch(false), FIDELITY_SHIFT_MS);
  }, [skinTrack]);
  // the build readout drops its wheel and rotation hints while a radio line is on screen (TASK-25: the two bands never meet)
useEffect(() => {
    const shown = !!subtitle && dialogueSettings.subtitlesEnabled && !(menu || building !== null || placingLayoutId !== null || pieceSessionRef.current);
    if (shown) document.body.dataset.subtitleUp = '1';
    else delete document.body.dataset.subtitleUp;
  });
  // Alt is the tactical view: every machine label shows while it is held
  useEffect(() => {
    const on = (e: KeyboardEvent): void => { altHeldRef.current = e.altKey; };
    window.addEventListener('keydown', on);
    window.addEventListener('keyup', on);
    return () => {
      window.removeEventListener('keydown', on);
      window.removeEventListener('keyup', on);
    };
  }, []);



  const hasSaveOnBootRef = useRef<boolean>(false);

  /** The base world this profile starts with: its save, or a fresh world (campaign-world.ts). Read once, on mount. */
  const initBaseWorld = (): BaseWorld => {
    if (props.gamePreset) { hasSaveOnBootRef.current = true; return gameBaseWorld(props.gamePreset); }
    writePendingHostSave();
    let rawSave: string | null = null;
    try {
      rawSave = kv.get(BASE_SAVE_KEY);
    } catch (e) {
      console.warn('[base save load error]', e);
    }
    const start = startCampaignWorld(rawSave, { seed: 1, devKit: isDevSeed });
    hasSaveOnBootRef.current = start.played;
    return start.world;
  };
  const [initialBase] = useState<BaseWorld>(initBaseWorld);
  const baseWorldRef = useRef<BaseWorld>(initialBase);
  /** The live outpost session, if this screen is in one (plan 36): its base is the room's, and this device's base save is left alone. */
  const outpostRef = useRef<OutpostSession | null>(props.gamePreset ? null : currentOutpostSession());
  const [, setOutpostTick] = useState(0);
  /** The sculpt text last sent to the room (the host's ground), so a change goes up once. */
  const lastTerrainRef = useRef<string | null>(null);
  const pieceManagerRef = useRef<PieceMeshManager>(new PieceMeshManager());
  const buildKindRef = useRef<Kind | null>(null);
  const buildRotationRef = useRef<number>(0);
  const ghostKindRef = useRef<Kind | null>(null);
  const [hoverSupport, setHoverSupport] = useState<{ text: string; color: string } | null>(null);
  const [wheelCycleText, setWheelCycleText] = useState<string | null>(null);
  const [rotationText, setRotationText] = useState<string | null>(null);

  // Layouts & Plans state
  const [placingLayoutId, setPlacingLayoutId] = useState<string | null>(null);
  /** The scene's mouse handler is set up once, so it reads the layout being placed through this ref (not the state). */
  const placingLayoutRef = useRef<string | null>(null);
  placingLayoutRef.current = placingLayoutId;
  /** The extraction rifle (TASK-21): out in hand or racked, and its mode. The mouse and wheel handlers read the refs. */
  const beamHeldRef = useRef(false);
  const beamModeRef = useRef<BeamMode>('extract');
  const forceBeamFiringRef = useRef(false);
  /** The test hook's seal (hmPlay.setBeamSealing): the frame loop seals on a leak's column, or while this is set. */
  const forceBeamSealingRef = useRef(false);
  const [beamHud, setBeamHud] = useState<{ readonly held: boolean; readonly mode: BeamMode }>({ held: false, mode: 'extract' });
  /** The sculpt tool (TASK-21d): carve, raise or smooth. The frame loop reads the ref; the chip reads the state. */
  const sculptToolRef = useRef<SculptTool>('carve');
  const [sculptTool, setSculptTool] = useState<SculptTool>('carve');
  const chooseSculptTool = (tool: SculptTool): void => {
    sculptToolRef.current = tool;
    setSculptTool(tool);
  };
  /** The beam's save: edits since the last write, when it was written, and the last support count and check time (TASK-21d). */
  const beamDirtyRef = useRef(false);
  const beamSaveAtRef = useRef(0);
  const keepOutAtRef = useRef(-1e9);
  const supportAtRef = useRef(-1e9);
  const lostSupportRef = useRef(0);
  const setBeamHeld = (held: boolean, mode: BeamMode): void => {
    beamHeldRef.current = held;
    beamModeRef.current = mode;
    if (held && sceneRef.current?.monsters.isEquipped()) {
      sceneRef.current?.monsters.equip(false);
      setGunEquipped(false);
    }
    sceneRef.current?.setBeamHeld(held, mode);
    setBeamHud({ held, mode });
  };
  /** The X radial (TICKET-04): what it offers now, its thumbnails once they resolve, and whether Z is being held to remove. */
  const [radial, setRadial] = useState<RadialSpec | null>(null);
  const [radialThumbs, setRadialThumbs] = useState<readonly (string | null)[]>([]);
  const [removeHolding, setRemoveHolding] = useState(false);
  const removeHoldRef = useRef<number | null>(null);
  useEffect(() => {
    if (radial === null) return;
    let live = true;
    void Promise.all(radial.items.map((it) => (it.ref ? thumbFor(it.ref) : Promise.resolve(null)))).then((urls) => {
      if (live) setRadialThumbs(urls);
    });
    return () => { live = false; };
  }, [radial]);
  useEffect(() => () => {
    if (removeHoldRef.current !== null) window.clearTimeout(removeHoldRef.current);
  }, []);
  const lastAmbienceCheckRef = useRef<{ at: number; where: string; stage: number; nearWater: boolean }>({
    at: -1e9,
    where: '',
    stage: -1,
    nearWater: false,
  });
  const syncAmbience = useCallback((forceWhere?: 'lab' | 'planet', forceStage?: number) => {
    const curWhere = forceWhere ?? (liveWhereRef.current as 'lab' | 'planet' ?? 'lab');
    const curStage = forceStage ?? plotRef.current.stage;
    const pts = plotRef.current.points;
    const floats = {
      pxd: Math.max(0, Math.min(1, (pts?.pxd ?? 0) / 100)),
      vtx: Math.max(0, Math.min(1, (pts?.vtx ?? 0) / 100)),
      lx: Math.max(0, Math.min(1, (pts?.lx ?? 0) / 100)),
      aq: Math.max(0, Math.min(1, (pts?.aq ?? 0) / 100)),
    };
    const nearWater = curWhere === 'planet' && (sceneRef.current?.isNearWater?.() ?? false);
    const last = lastAmbienceCheckRef.current;
    if (last.where !== curWhere || last.stage !== curStage || last.nearWater !== nearWater) {
      lastAmbienceCheckRef.current = { at: performance.now(), where: curWhere, stage: curStage, nearWater };
      gameAudio.setAmbience({
        where: curWhere,
        stage: curStage,
        floats,
        nearWater,
      });
    }
  }, []);
  const placingLayoutRotationRef = useRef<number>(0);
  const [planPrompt, setPlanPrompt] = useState<string | null>(null);
  const nearestPlanRef = useRef<Plan | null>(null);
  const currentAimedStructureIdRef = useRef<number | null>(null);

  // Pressure & Life Support state
  const [shelterState, setShelterState] = useState<'pressurized' | 'sealed-no-power' | 'none'>('none');
  const lastRoomCheckTimeRef = useRef<number>(0);

  // Placed & filled pieces running counter
  const [placedCounter, setPlacedCounter] = useState<{ count: number; name: string; fading?: boolean } | null>(null);
  const placedCounterTimerRef = useRef<number | null>(null);

  // Overlay visibility toggle for clean screenshot capture
  const [hideOverlays, setHideOverlays] = useState(cleanShotMode);
  const [renderCalls, setRenderCalls] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (sceneRef.current) {
        setRenderCalls(sceneRef.current.debug.stats().calls);
      }
    }, 150);
    return () => window.clearInterval(interval);
  }, []);

  // Throttled persistence
  const lastSavedTickRef = useRef(-1);
  const lastSaveTimeRef = useRef(0);
  const shelterAttemptedRef = useRef(false);
  const baseViewSourceRef = useRef<any>(null);

  const incrementPlacedCounter = useCallback((n: number, name = 'pieces') => {
    setPlacedCounter((prev) => ({
      count: (prev ? prev.count : 0) + n,
      name,
      fading: false,
    }));
    if (placedCounterTimerRef.current !== null) {
      window.clearTimeout(placedCounterTimerRef.current);
    }
    placedCounterTimerRef.current = window.setTimeout(() => {
      setPlacedCounter((prev) => (prev ? { ...prev, fading: true } : null));
      placedCounterTimerRef.current = window.setTimeout(() => {
        setPlacedCounter(null);
      }, 400);
    }, 2000);
  }, []);

  const persistBaseWorld = useCallback((force = false) => {
    // in a session the base is the room's: this device's save is left as it was (a guest keeps their own base)
    if (props.gamePreset || outpostRef.current) return;
    const world = baseWorldRef.current;
    const now = performance.now();
    if (!force && (world.tick === lastSavedTickRef.current || now - lastSaveTimeRef.current < 2000)) {
      return;
    }
    try {
      kv.set(BASE_SAVE_KEY, saveWorld(world));
      lastSavedTickRef.current = world.tick;
      lastSaveTimeRef.current = now;
    } catch (e) {
      console.warn('[persistBaseWorld error]', e);
    }
  }, []);

  const lastPreviewRef = useRef<{
    prev: { snap: S.Snap | null; cost: readonly L.Stack[]; short: readonly L.Stack[] };
    aim: { x: number; y: number; z: number; yaw: number };
    bp: { id: string; name: string };
    kind: Kind;
  } | null>(null);
  const dispatchBaseRef = useRef<(cmd: BaseCommand) => Applied | void>(() => {});
  const tryPlaceBaseRef = useRef<() => boolean>(() => false);
  const [machinePickerHardpoint, setMachinePickerHardpoint] = useState<number | null>(null);
  const [refineryMachineId, setRefineryMachineId] = useState<number | null>(null);
  const [fabricatorMachineId, setFabricatorMachineId] = useState<number | null>(null);
  /** The machine inspector (TICKET-03): a base hardpoint machine, or a plot machine (its own id space, so the source is kept). */
  const [inspect, setInspect] = useState<{ readonly src: 'base' | 'plot'; readonly id: number } | null>(null);
  const [, setInspectTick] = useState(0);
  const [weaponBenchOpen, setWeaponBenchOpen] = useState(false);
  const [planetTableOpen, setPlanetTableOpen] = useState(false);
  const [drivingSpeed, setDrivingSpeed] = useState<number | null>(null);
  const [drivingBoostEnergy, setDrivingBoostEnergy] = useState<number | undefined>(undefined);
  const [drivingBoosting, setDrivingBoosting] = useState(false);
  /** Plan 47: the driven vehicle's Sovereign Harness telemetry blade (Zone 8) and the drift badge beside it. */
  const [drivingHarness, setDrivingHarness] = useState<IHarnessHudViewModel | null>(null);
  const [drivingDrift, setDrivingDrift] = useState<DrivingDriftBadgeState | null>(null);
  const [baseWorldVersion, setBaseWorldVersion] = useState(0);
  const [baseWindowOpen, setBaseWindowOpen] = useState(false);
  const [beamHarvest, setBeamHarvest] = useState<{ count: number; name: string; fading?: boolean } | null>(null);
  const beamHarvestTimerRef = useRef<number | null>(null);
  /**
   * Where the held rifle's beam lands this frame: a boulder it takes ore from (amber), or the ground it paints (the loaded
   * preset's colour). Null when it lands nowhere. The ore not yet on the counter, and when it was last shown.
   */
  const beamBoulderTargetRef = useRef<{ readonly x: number; readonly y: number; readonly z: number; readonly colour: string } | null>(null);
  const beamOreAccRef = useRef(0);
  const beamOreFlushRef = useRef(0);
  /** The rifle's port (TASK-21): the written cartridge loaded from the lab rack, and its preset and colour. Not saved yet (TASK-21c). */
  /** The rifle's port: a material preset cartridge (preset set) or a part cartridge (part set, preset ''; TICKET-32). */
  const beamPortRef = useRef<{ readonly cartridge: Cartridge; readonly preset: string; readonly name: string; readonly colour: string; readonly part?: PartSpec; readonly species?: SpeciesSpec; readonly light?: LightSpec; readonly material?: MaterialPrintSpec; readonly sprite?: SpritePrintSpec; readonly sound?: SoundPrintSpec; readonly harness?: HarnessPrintSpec } | null>(null);
  /** A part shot in progress: when the left button went down and whether Shift was held (tap = one part, hold or Shift = all of that kind). */
  const partShotRef = useRef<{ readonly t0: number; readonly shift: boolean } | null>(null);
  /** A light cartridge's shot at a lamp (plan 39, Lx), decided on release like a part shot. */
  const lightShotRef = useRef<{ readonly t0: number; readonly shift: boolean } | null>(null);
  /** A material cartridge's Apply in progress (plan 41): decided on release, like a part's. */
  const materialShotRef = useRef<{ readonly t0: number; readonly shift: boolean } | null>(null);
  /** A species cartridge's shot at a tree (plan 39, Aq), decided on release like a part shot. */
  const speciesShotRef = useRef<{ readonly t0: number; readonly shift: boolean } | null>(null);
  /** A material cartridge's shot at a machine part (plan 39 step 2), decided on release like a part shot. */
  const skinShotRef = useRef<{ readonly t0: number; readonly shift: boolean } | null>(null);
  const [beamPort, setBeamPort] = useState<{
    readonly name: string;
    readonly preset?: string;
    readonly colour?: string;
    readonly id?: string;
    readonly kind?: string;
  } | null>(null);
  const flashBeamHarvest = (count: number, name: string): void => {
    setBeamHarvest((prev) => ({ count: (prev ? prev.count : 0) + count, name, fading: false }));
    if (beamHarvestTimerRef.current !== null) window.clearTimeout(beamHarvestTimerRef.current);
    beamHarvestTimerRef.current = window.setTimeout(() => {
      setBeamHarvest((prev) => (prev ? { ...prev, fading: true } : null));
      beamHarvestTimerRef.current = window.setTimeout(() => {
        setBeamHarvest(null);
      }, 400);
    }, 2000);
  };
  /**
   * R on the held rifle (TASK-21): a written cartridge from the lab rack goes into the port. A cartridge already in the port goes
   * back on the rack first. A cartridge a lab job still needs stays where it is.
   */
  /**
   * The keep-out zones the sculpt beam leaves alone now (TASK-21d): the gate's apron, every structure (its origin), every placed
   * piece (its cell's centre, so a long structure is kept out along its length) and every plot machine.
   */
  const sculptZones = () => {
    const base = baseWorldRef.current.base;
    const byId = new Map(base.structures.map((s) => [s.id, s] as const));
    const pieces: { x: number; z: number }[] = [];
    for (const p of base.pieces) {
      const s = byId.get(p.s);
      if (!s) continue;
      const c = S.toWorld(s, (p.i + 0.5) * S.CELL, (p.j + 0.5) * S.CELL, 0);
      pieces.push({ x: c.x, z: c.z });
    }
    return keepOutZones({
      gate: envRef.current?.gate ?? { x: 0, z: 0 },
      structures: base.structures.map((s) => ({ x: s.x, z: s.z })),
      pieces,
      machines: plotRef.current.machines,
    });
  };
  /** The edits and the port as the save holds them now (the scene owns the field). */
  // ---- Window B (TICKET-11, co-op): the plot's sculpt is the Lead Architect's, shared through the room
  /**
   * The Lead Architect's sculpt goes up to the room whenever it changes: the room keeps it with the plot and its gate's pose (POL-112), and
   * relays it to the guests. Only the room's owner sends it, and only once the plot is made (so an empty scene never clears the room's).
   */
  const pushTerrain = (): void => {
    const session = outpostRef.current;
    const scene = sceneRef.current;
    if (!session || !scene || !scene.beamFieldReady() || session.client.state().role !== 'owner') return;
    const sculpt = scene.beamFieldText();
    if (sculpt === lastTerrainRef.current) return;
    lastTerrainRef.current = sculpt;
    session.client.setTerrain({ seed: OUTPOST_PLOT_SEED, sculpt, gate: scene.gatePose() });
    // the sculpt text keeps each cut to a centimetre (encodeField), so the Lead Architect's ground takes those same values too: the
    // room and every guest then stand on exactly the ground the host builds on
    scene.importBeamField(sculpt);
  };
  /** A guest's plot takes the room's sculpt, now and whenever the Lead Architect changes it. The owner's own sculpt is the source, so it is left alone. */
  const importRoomTerrain = (): void => {
    const session = outpostRef.current;
    if (!session || session.client.state().role === 'owner') return;
    sceneRef.current?.importBeamField(session.client.state().terrain.sculpt);
  };
  const flushBeam = (): void => {
    if (props.gamePreset) return;
    // a guest's device keeps its own beam save in a session: the room's sculpt is not written to it
    const session = outpostRef.current;
    if (!session || session.client.state().role === 'owner') {
      saveBeam(sceneRef.current?.beamFieldText() ?? '', beamPortRef.current ? beamPortRef.current.cartridge : null);
    }
    pushTerrain();
  };
  /**
   * The support re-check after a cut (TASK-21d): every placed piece's support is read again on the ground as it now is (the base's own
   * integrity). A rise in the count of pieces under the minimum is said once; the structure view is redrawn for the integrity overlay.
   */
  const recheckSupport = (): void => {
    const support = S.supports(baseWorldRef.current.base, structureEnv(getBaseEnv()));
    let lost = 0;
    for (const v of support.values()) if (v < S.MIN_SUPPORT) lost += 1;
    if (lost > lostSupportRef.current) {
      say(`${lost} ${lost === 1 ? 'piece has' : 'pieces have'} lost support`, 'The ground under them was cut. Raise it back, or move them.');
    }
    lostSupportRef.current = lost;
    (baseViewSource as WorldViewSource).notify?.();
  };
  /**
   * Boards a vehicle and wakes its Sovereign Harness soul (plan 47): a harness cartridge in the
   * rifle's port binds (and persists on the vehicle in the plot save); otherwise a saved soul
   * wakes; otherwise the steadfast default rides along. Used by the E key and the e2e hook.
   */
  const boardVehicle = (id: number, kind: string): boolean => {
    const entered = sceneRef.current?.enterVehicle(id);
    if (!entered) return false;
    const heldHarness = beamPortRef.current?.harness;
    const savedRef = baseWorldRef.current.vehicles.find((v) => v.id === id)?.harness ?? null;
    if (heldHarness && sceneRef.current?.setVehicleHarness(heldHarness.ref)) {
      dispatchBase({ t: 'bindHarness', vehicle: id, ref: heldHarness.ref });
      say(`Driving ${kind.toUpperCase()} · ${heldHarness.name} bound`, 'WASD to drive, Space to brake, E to exit.');
    } else if (savedRef !== null && sceneRef.current?.setVehicleHarness(savedRef)) {
      const soulName = decodeHarnessCartridgeCode(savedRef)?.name ?? 'Bound soul';
      say(`Driving ${kind.toUpperCase()} · ${soulName} woken`, 'WASD to drive, Space to brake, E to exit.');
    } else {
      sceneRef.current?.setVehicleHarness(null);
      say(`Driving ${kind.toUpperCase()}`, 'WASD to drive, Space to brake, E to exit.');
    }
    return true;
  };

  /** Puts a written cartridge from the lab rack into the rifle's port: R takes the first one, the X radial in Apply the one picked. */
  const loadBeamCartridge = (written: Cartridge): void => {
    // a written material, or a print (plans 39 and 41): a part, a species, a light or a machine material, each glowing its own colour in the port
    const look = rifleLook(written);
    if (!look) return;
    const port = beamPortRef.current;
    const next = reloadedLab(labRef.current, written, port ? port.cartridge : null);
    beamPortRef.current = { cartridge: written, preset: look.preset, name: written.name, colour: look.colour, ...(look.print ?? {}) };
    const kind = look.print ? printKind(look.print) : null;
    labRef.current = next;
    commit(withLab(withPlot(stateRef.current, plotRef.current), next));
    setBeamPort({
      name: written.name,
      preset: look.preset,
      colour: look.colour,
      id: written.id,
      kind: kind ?? undefined,
    });
    sceneRef.current?.setBeamCartridge(beamPortRef.current.colour);
    sceneRef.current?.playAction('reload');
    beamDirtyRef.current = true;
    say(`Loaded: ${written.name}`, port ? `${port.name} went back on the rack.`
      : kind === 'part' ? 'Fire Apply at a machine part: a tap fits one, a hold or Shift fits every part of its kind.'
        : kind === 'species' ? 'Fire Apply at a tree on the plot: a tap regrows it, a hold or Shift every tree of its kind nearby.'
          : kind === 'light' ? 'Fire Apply at a machine lamp: a tap sets it, a hold or Shift every lamp on the machine.'
            : kind === 'material' ? 'Fire Apply at a machine part: a tap dresses it, a hold or Shift every part that wears the same.'
            : kind === 'harness' ? 'Enter a vehicle (E) with this loaded to bind its vessel soul; the Zone 8 blade shows it living.'
              : 'Hold the left button in Apply to paint the ground, or fire it at a machine part to paint the part.');
  };
  const cycleBeamCartridge = (step: 1 | -1 = 1): void => {
    const list = allWrittenOnRack(labRef.current).filter((c) => rifleLook(c) !== null);
    if (list.length === 0 && !beamPortRef.current) {
      say('The port stays empty', 'No written cartridge is on the lab rack. Write one at the bench.');
      return;
    }
    if (list.length === 0) {
      say(`Holding: ${beamPortRef.current?.name ?? 'Cartridge'}`, 'No other written cartridge on the rack to swap.');
      return;
    }
    const currentId = beamPortRef.current?.cartridge.id;
    const curIdx = currentId ? list.findIndex((c) => c.id === currentId) : -1;
    const nextIdx = (curIdx + step + list.length) % list.length;
    const nextCart = list[nextIdx]!;
    loadBeamCartridge(nextCart);
  };
  const reloadBeam = (): void => {
    const written = writtenOnRack(labRef.current);
    if (!written || !rifleLook(written)) {
      say('The port stays empty', 'No written cartridge is on the lab rack. Write one at the bench.');
      return;
    }
    loadBeamCartridge(written);
  };
  const forceBeamRef = useRef<number | null>(null);
  const isAnyBaseWindowOpen = menu || baseWindowOpen || machinePickerHardpoint !== null || refineryMachineId !== null || fabricatorMachineId !== null || weaponBenchOpen || planetTableOpen || inspect !== null;
  const hardpointToPlotMachineRef = useRef<Map<number, number>>(new Map());
  const isLmbDownRef = useRef(false);
  const harvestAccRef = useRef(0);
  const baseEnvRef = useRef<WorldEnv | null>(null);
  // the debug menu's Instant builds: the base env reads the ref on every tick, so the switch takes effect at once
  const [instantBuilds, setInstantBuilds] = useState<boolean>(readInstantBuilds);
  const instantBuildsRef = useRef(instantBuilds);
  useEffect(() => { instantBuildsRef.current = instantBuilds; writeInstantBuilds(instantBuilds); }, [instantBuilds]);

  const lastPreviewTickRef = useRef(-1);
  const lastPreviewBpRef = useRef<string | null>(null);
  const lastPreviewKindRef = useRef<string | null>(null);
  const lastPreviewAimRef = useRef<{ x: number; y: number; z: number; yaw: number } | null>(null);

  const getBaseEnv = useCallback((): WorldEnv => {
    if (baseEnvRef.current) return baseEnvRef.current;
    const gate = sceneRef.current?.debug.gatePlanet() ?? { x: 0, z: 0 };
    const env: WorldEnv = {
      heightAt: (x, z) => sceneRef.current?.heightAt(x, z) ?? 0,
      bridge: { x: gate.x, z: gate.z, range: BRIDGE_RANGE },
      // the machines' time scale: real time, or the Instant builds scale (read per tick, not cached)
      get timeScale(): number { return instantBuildsRef.current ? INSTANT_TIME_SCALE : 1; },
    };
    baseEnvRef.current = env;
    return env;
  }, []);

  // Save on pagehide and visibilitychange
  useEffect(() => {
    const handleHide = () => {
      persistBaseWorld(true);
    };
    window.addEventListener('pagehide', handleHide);
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        persistBaseWorld(true);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('pagehide', handleHide);
      document.removeEventListener('visibilitychange', handleVisibility);
      persistBaseWorld(true);
    };
  }, [persistBaseWorld]);

  const dropStarterShelter = useCallback((scene: PlayScene) => {
    if (shelterAttemptedRef.current || baseWorldRef.current.shelter) return;
    shelterAttemptedRef.current = true;

    const gate = scene.debug.gatePlanet();
    const bEnv = getBaseEnv();

    // Candidate spots: first 12 m directly in front of the gate (facing -z from gate, so gate is at +z relative to shelter), then 8-spot rings at 12, 18, 24 m
    const candidates: Array<{ cx: number; cz: number; yaw: number }> = [
      { cx: gate.x, cz: gate.z - 12, yaw: 0 },
    ];
    for (const d of [12, 18, 24]) {
      for (let k = 0; k < 8; k++) {
        const phi = (k * 2 * Math.PI) / 8;
        const cx = gate.x + d * Math.sin(phi);
        const cz = gate.z - d * Math.cos(phi);
        const yaw = Math.atan2(gate.x - cx, gate.z - cz);
        candidates.push({ cx, cz, yaw });
      }
    }

    for (const spot of candidates) {
      const res = apply(baseWorldRef.current, bEnv, { t: 'shelter', cx: spot.cx, cz: spot.cz, yaw: spot.yaw });
      if (!res.events.some((e) => e.type === 'refused')) {
        baseWorldRef.current = res.world;
        scene.setBase(baseWorldRef.current.base);
        pieceManagerRef.current.sync(baseWorldRef.current, bEnv, false);
        scene.setWalkWorld(pieceManagerRef.current.walkWorld);
        say(
          "I've dropped you a shelter.",
          "It's sealed: the door's an airlock. The Drafting Table inside is where every blueprint starts."
        );
        persistBaseWorld(true);
        baseViewSourceRef.current?.notify?.();
        break;
      }
    }
  }, [getBaseEnv, persistBaseWorld, say]);

  const baseViewSource = useMemo(() => {
    const src = createWorldViewSource({
      getWorld: () => baseWorldRef.current,
      env: () => getBaseEnv(),
      getAt: () => {
        const p = sceneRef.current?.aimPoint();
        if (p) return { x: p.x, z: p.z };
        return { x: 0, z: 0 };
      },
      dispatch: (cmd) => dispatchBaseRef.current(cmd),
      getBuildKind: () => buildKindRef.current,
      getPreview: () => lastPreviewRef.current?.prev ?? null,
    });
    baseViewSourceRef.current = src;
    return src;
  }, [getBaseEnv]);

  /** Redraws the base's view from baseWorldRef: the pieces, the walk world, the vehicles, the fabricators and the weapon stats. */
  const refreshBaseView = useCallback((): void => {
    const scene = sceneRef.current;
    const world = baseWorldRef.current;
    const bEnv = getBaseEnv();
    scene?.setBase(world.base);
    const integrity = (baseViewSource as WorldViewSource).get?.()?.build?.integrity ?? false;
    pieceManagerRef.current.sync(world, bEnv, integrity);
    scene?.setWalkWorld(pieceManagerRef.current.walkWorld);
    scene?.setVehicles(world.vehicles);
    const fabs = world.machines.filter((m) => m.kind === 'fabricator').map((m) => {
      const hp = world.base.pieces.find((p) => p.id === m.id);
      const pt = hp ? pieceAt(world.base, hp) : null;
      return {
        id: m.id,
        x: pt?.x ?? 0,
        z: pt?.z ?? 0,
        yaw: 0,
        printing: m.jobs.length > 0,
      };
    });
    scene?.setFabricators(fabs);
    scene?.monsters.setWeaponStats(devWeaponRef.current ?? weaponStats(world.loadout));
    (baseViewSource as WorldViewSource).notify?.();
    setBaseWorldVersion((v) => v + 1);
  }, [getBaseEnv, baseViewSource]);

  const dispatchBase = useCallback((cmd: BaseCommand) => {
    const scene = sceneRef.current;
    const bEnv = getBaseEnv();
    const prevField = baseWorldRef.current.field;
    // in a session the command goes through the client: it shows at once, and the room confirms it (or refuses it)
    const session = outpostRef.current;
    const res = session ? session.client.send(cmd) : apply(baseWorldRef.current, bEnv, cmd);
    if (!res || !res.world) return;
    baseWorldRef.current = res.world;
    scene?.setBase(baseWorldRef.current.base);

    if (cmd.t === 'craft') {
      if (cmd.recipe.includes('scout') || cmd.recipe.includes('rover')) narratorRef.current?.trigger('fab:scout');
      else narratorRef.current?.trigger('dirt:process');
    }
    if (cmd.t === 'fit') {
      narratorRef.current?.trigger('weapon:swap');
    }

    for (const ev of res.events) {
      if (ev.type === 'refused') {
        // in a session the room answers every command, and that answer shows the refusal once (the session's listener below)
        if (session) continue;
        console.warn('[dispatchBase refused]', ev);
        showStatusToast(formatRefusalToast(ev));
        gameAudio.playRefuse();
        narratorRef.current?.trigger('build:refused');
      } else if (ev.type === 'placed') {
        incrementPlacedCounter(1);
        gameAudio.playPlace({ x: 0, y: 0, z: 0 });
        if (ev.kind === 'wall' || ev.kind === 'foundation') gameAudio.playWeld({ x: 0, y: 0, z: 0 });
        if (ev.kind === 'airlock') gameAudio.playAirlock({ x: 0, y: 0, z: 0 });
        pieceManagerRef.current.triggerPrintSweep(ev.id);
        if (ev.kind === 'foundation') narratorRef.current?.trigger('build:foundation');
        if (ev.kind === 'bin') narratorRef.current?.trigger('bin:linked');
        if (ev.kind === 'airlock' || ev.kind === 'wall') narratorRef.current?.trigger('room:sealed');
      } else if (ev.type === 'removed') {
        incrementPlacedCounter(-(1 + ev.collapsed.length), 'deconstructed');
        pieceManagerRef.current.handleRemoval(ev.id, ev.collapsed);
        if (ev.collapsed.length > 0) {
          gameAudio.playCollapse({ x: 0, y: 0, z: 0 });
          narratorRef.current?.trigger('build:collapse');
        }
      } else if (ev.type === 'drafted') {
        say(`Drafted Blueprint: ${ev.blueprint}`);
        gameAudio.playUiSelect();
        narratorRef.current?.trigger('drafting:blueprint');
      } else if (ev.type === 'stacked') {
        say(`Deposited ${ev.n} item(s) to Quantum Lattice.`);
        gameAudio.playPickup(1);
      } else if (ev.type === 'door') {
        say(ev.open ? 'Airlock opened.' : 'Airlock closed.');
        gameAudio.playDoor({ x: 0, y: 0, z: 0 });
      } else if (ev.type === 'harvested') {
        narratorRef.current?.trigger('harvest:pixels');
        gameAudio.playPickup(2);
        let totalHarvested = 0;
        let itemName = 'Raw Material';
        for (const item of ev.items) {
          totalHarvested += item.n;
          itemName = ITEMS[item.item]?.name ?? item.item;
        }
        flashBeamHarvest(totalHarvested, itemName);

        fx('relay-click', { minGapMs: 80 });
        if (ev.lost.length > 0) {
          say('Pack full', 'Storage lost: cannot fit cargo');
        }
      } else if (ev.type === 'finished') {
        say(`Refined: ${ev.n}x ${ITEMS[ev.item]?.name ?? ev.item}`, 'Ready for collection');
        gameAudio.playPickup(1);
        fx('snap');
      } else if (ev.type === 'installed') {
        if (ev.kind === 'fabricator') narratorRef.current?.trigger('fab:installed');
        const pad = baseWorldRef.current.base.pieces.find((p) => p.id === ev.machine);
        if (pad && envRef.current) {
          const padCenter = pieceAt(baseWorldRef.current.base, pad);
          if (padCenter) {
            try {
              const nextPlot = place(plotRef.current, envRef.current, ('heavy-' + ev.kind) as any, padCenter.x, padCenter.z, 0);
              plotRef.current = nextPlot;
              commit(withPlot(stateRef.current, nextPlot));
              const placed = nextPlot.machines[nextPlot.machines.length - 1];
              if (placed) hardpointToPlotMachineRef.current.set(ev.machine, placed.id);
              scene?.setPlot(nextPlot, running(nextPlot, envRef.current), network(nextPlot, envRef.current).connected, network(nextPlot, envRef.current).satisfaction);
              say(`Heavy ${ev.kind.toUpperCase()} installed!`, 'Operational on hardpoint grid.');
            } catch (err: any) {
              console.warn('Plotsim placement refusal:', err?.message ?? err);
              say(`Installed ${ev.kind.toUpperCase()}`, err?.message ?? 'Installed on base hardpoint');
            }
          }
        }
      } else if (ev.type === 'queued') {
        say('Queued refinement job');
      } else if (ev.type === 'collected') {
        say(`Collected ${ev.n} refined item(s)`);
      } else if (ev.type === 'gateMoved') {
        // plan 42: the ring, its footing, the arrival pad and the ground's keep-out all follow the world's pose
        scene?.setPlotGate(ev.pose);
        say('Gate moved', `The gate now stands at ${ev.pose.x.toFixed(1)}, ${ev.pose.z.toFixed(1)} with its pad ${GATE_ARRIVAL_PAD_OFFSET_M.toFixed(1)} m in front.`);
      } else if (ev.type === 'biome') {
        scene?.setSpeciesSlots(ev.preset.species);
        say(ev.preset.label, `Six species slots set to ${biomeSlotSpecies(ev.preset).join(', ')}.`);
      } else if (ev.type === 'gateAccess') {
        // the shield on screen is the shield the gate's own rule fired (plan 43, logic:): the world stores the privacy, the
        // `stargate-iris-lock` graph decides the iris and the ramp door from it
        scene?.setGateAccess(irisAccessFor({ access: ev.access }));
        setGateAccess(ev.access);
        say(GATE_ACCESS_LABEL[ev.access], GATE_ACCESS_DOC[ev.access]);
      } else if (ev.type === 'filled') {
        incrementPlacedCounter(ev.built.length);
        gameAudio.playWeld({ x: 0, y: 0, z: 0 });
        if (ev.left === 0) {
          say('Plan completed!', 'All blueprint pieces have been constructed.');
        }
      }
    }

    updateChain((c) => chainPairs(res.events).reduce((x, [k, n]) => bump(x, k, n), c));
    if (res.world.field !== prevField || res.events.some((e) => e.type === 'harvested' || e.type === 'stage')) {
      scene?.setNodes(res.world.field);
    }

    refreshBaseView();
    persistBaseWorld(false);
    (baseViewSource as WorldViewSource)?.notify?.();
    return res;
  }, [say, baseViewSource, getBaseEnv, commit, incrementPlacedCounter, persistBaseWorld, refreshBaseView]);

  dispatchBaseRef.current = dispatchBase;

  // The shared outpost (plan 36, Phase 1): while a session is open this screen's base is the room's. A guest's own save is never
  // written (persistBaseWorld stands down), so leaving gives them their own base back; the host's save takes the room's on leave.
  useEffect(() => {
    if (props.gamePreset) return;
    let bound: OutpostSession | null = null;
    let offState: (() => void) | null = null;
    let offEvents: (() => void) | null = null;
    let terrainTimer: ReturnType<typeof setInterval> | null = null;
    let offTerrain: (() => void) | null = null;
    const unbind = (): void => {
      offState?.();
      offEvents?.();
      offTerrain?.();
      if (terrainTimer !== null) clearInterval(terrainTimer);
      offState = null;
      offEvents = null;
      offTerrain = null;
      terrainTimer = null;
    };
    const attach = (): void => {
      const session = currentOutpostSession();
      if (session === bound) return;
      const wasInSession = bound !== null;
      const wasOwner = bound !== null && bound.client.state().role === 'owner';
      unbind();
      bound = session;
      outpostRef.current = session;
      if (session) {
        if (session.host) {
          // a new room takes this base once; the sculpt goes up when the plot is made, and again whenever it changes
          session.client.seedWorld(baseWorldRef.current);
          lastTerrainRef.current = null;
          pushTerrain();
          terrainTimer = setInterval(() => {
            if (lastTerrainRef.current === null) pushTerrain();
          }, 1000);
        }
        // Window B (TICKET-11, co-op): a guest's plot is the room's sculpt, now and after each change the Lead Architect makes
        offTerrain = session.client.onTerrain(() => importRoomTerrain());
        importRoomTerrain();
        baseWorldRef.current = session.client.state().world;
        refreshBaseView();
        offState = session.client.onStateChange((state) => {
          if (state.world === baseWorldRef.current) return;
          baseWorldRef.current = state.world;
          refreshBaseView();
        });
        offEvents = session.client.onEvents((events, meta) => {
          if (!meta.confirmed) return;
          const me = session.client.state().playerId;
          for (const ev of events) {
            if (ev.type === 'refused' && meta.actorId === me) {
              showStatusToast(formatRefusalToast(ev));
              gameAudio.playRefuse();
              narratorRef.current?.trigger('build:refused');
            } else if (ev.type === 'removed' && meta.actorId !== me) {
              pieceManagerRef.current.handleRemoval(ev.id, ev.collapsed);
            }
          }
        });
      } else if (wasInSession) {
        // the session ended: the host's save takes the room's world, and this screen shows this device's own base again
        writePendingHostSave();
        lastTerrainRef.current = null;
        // Window B: a guest's plot goes back to the sculpt this device saved (the room's was only shown in the session)
        if (!wasOwner) sceneRef.current?.importBeamField(loadBeamSave().field ?? '');
        baseWorldRef.current = initBaseWorld();
        refreshBaseView();
      }
      setOutpostTick((t) => t + 1);
    };
    attach();
    const unsubscribe = subscribeOutpostSession(attach);
    return () => {
      unsubscribe();
      unbind();
    };
  }, [say, refreshBaseView]);

  const tryPlaceBase = useCallback((): boolean => {
    const lp = lastPreviewRef.current;
    if (!lp || !lp.prev.snap) return false;
    const { snap, short } = lp.prev;
    if (!snap.ok || short.length > 0) {
      if (short.length > 0) {
        showStatusToast(`Missing: ${short.map((s) => `${s.n} ${ITEMS[s.item]?.name ?? s.item}`).join(', ')}`);
      } else if (snap.why) {
        showStatusToast(formatWhy(snap.why));
      }
      return false;
    }
    const lock = featureLock(snap.mode === 'place' && snap.piece.kind === 'weaponBench' ? 'weaponBench' : 'structures', stateRef.current.chain, plotRef.current.stage);
    if (lock) { showStatusToast(`Locked: ${lock}`); return false; }
    if (snap.mode === 'place') {
      let finalR = snap.piece.r;
      if (
        snap.piece.kind === 'ramp' ||
        snap.piece.kind === 'bench' ||
        snap.piece.kind === 'bin' ||
        snap.piece.kind === 'repeater'
      ) {
        finalR = ((snap.piece.r + buildRotationRef.current) % 4) as any;
      }
      const { mat, id, ...pieceSpec } = snap.piece as any;
      pieceSpec.r = finalR;
      dispatchBase({
        t: 'place',
        at: { x: lp.aim.x, z: lp.aim.z },
        blueprint: lp.bp.id,
        piece: pieceSpec,
      });
      return true;
    } else if (snap.mode === 'found') {
      dispatchBase({
        t: 'found',
        at: { x: lp.aim.x, z: lp.aim.z },
        blueprint: lp.bp.id,
        cx: snap.cx,
        cz: snap.cz,
        yaw: snap.yaw,
      });
      return true;
    }
    return false;
  }, [dispatchBase, say]);

  tryPlaceBaseRef.current = tryPlaceBase;

  // ---- the gun (the sidearm's shotgun), the health, and the monsters' events: the HUD, the narration, the chain, the items
  const [gunEquipped, setGunEquipped] = useState(props.gamePreset?.hudBlade === 'arena-wave-survivor');
  const [hitMarker, setHitMarker] = useState(false);
  const [gunAmmo, setGunAmmo] = useState({ current: 8, max: 8 });
  const hitMarkerTimeout = useRef<number | null>(null);
  // the health: the monsters' hits take it down; it comes back after a quiet spell; the death sends the player back to the gate
  const gameTimeRef = useRef(0); // milliseconds of simulation, excluding standalone pause time
  const hpRef = useRef<number>(PLAYER_MAX_HP);
  const lastHitRef = useRef(-1e9);
  const lowBarkRef = useRef(-1e9);
  const regenAtRef = useRef(0);
  const sealAimRef = useRef<number | null>(null);
  // a loadout the tests set: the real loadout re-applies whenever the base changes, so the fire re-applies this one
  const devWeaponRef = useRef<WeaponStats | null>(null);
  const [vitals, setVitals] = useState<{ readonly hp: number; readonly hitAt: number; readonly bearing: number }>({ hp: PLAYER_MAX_HP, hitAt: -1e9, bearing: 0 });
  const [radar, setRadar] = useState<readonly RadarLeak[]>([]);
  const [sealView, setSealView] = useState<{ readonly pct: number; readonly inReach: boolean } | null>(null);

  const fireWeapon = useCallback(() => {
    const scene = sceneRef.current;
    if (!scene || !scene.monsters.isEquipped()) return;
    const ray = scene.aimGround();
    const res = scene.monsters.fire(ray.origin, ray.dir);
    if (res.fired) {
      setGunAmmo(scene.monsters.getAmmo());
      if (res.hits > 0) {
        setHitMarker(true);
        if (hitMarkerTimeout.current) window.clearTimeout(hitMarkerTimeout.current);
        hitMarkerTimeout.current = window.setTimeout(() => setHitMarker(false), 110);
      }
    } else if (res.reason === 'empty') {
      gameAudio.playDryFire();
    }
  }, []);

  const dieNow = useCallback(() => {
    // a death: the screen takes the player back to the gate; the inventory and the save stay (TASK-22)
    updateChain((c) => playerDied(c));
    if (props.gamePreset?.hudBlade === 'arena-wave-survivor' && gameProgressRef.current.status !== 'complete') {
      gameProgressRef.current = NEW_GAME_PROGRESS; setGameProgress(NEW_GAME_PROGRESS);
    }
    hpRef.current = PLAYER_MAX_HP;
    lastHitRef.current = -1e9;
    setVitals((v) => ({ ...v, hp: PLAYER_MAX_HP }));
    const scene = sceneRef.current;
    if (scene) {
      scene.monsters.clearMobs();
      scene.setPlayerAlive(true);
      // a death at the wheel (TASK-24): the rover is left where it stands, parked, and the player walks back from the gate
      if (scene.getDrivingVehicle()) scene.exitVehicle();
      const exit = scene.gateExit(); // GATE-05: out from the gate's back, facing away from it
      scene.debug.teleport('planet', exit.x, exit.z, exit.yaw, 0);
    }
    say('Pulled back to the gate', props.gamePreset?.hudBlade === 'arena-wave-survivor' ? 'Assault restarted. Survive all ten waves in one life.' : 'Your inventory and your progress are kept.');
  }, [say, updateChain, props.gamePreset]);

  const takeHit = useCallback((damage: number, bearing: number) => {
    const now = performance.now();
    const next = hurtHp(hpRef.current, damage);
    hpRef.current = next;
    lastHitRef.current = props.gamePreset ? gameTimeRef.current : now;
    setVitals({ hp: next, hitAt: now, bearing });
    if (next <= 0) {
      sceneRef.current?.setPlayerAlive(false);
      dieNow();
      return;
    }
    if (isLow(next) && now - lowBarkRef.current > LOW_BARK_COOLDOWN * 1000) {
      lowBarkRef.current = now;
      narratorRef.current?.trigger('health:low');
      updateChain(playerLow);
    }
  }, [dieNow, updateChain, props.gamePreset]);

  // ---- the props in the world (TASK-23c): the saved clutter and logs (per profile), the databank, and the hold E that clears a prop
  const propsRef = useRef<PropsSave>(parsePropsSave(props.gamePreset ? null : kv.get(PROPS_SAVE_KEY)));
  const clearHoldRef = useRef(0);
  const clearPropRef = useRef<(id: string) => void>(() => {});
  const takeSidearmRef = useRef<() => void>(() => {});
  const [databank, setDatabank] = useState<string | null>(null);
  const savePropsSave = useCallback((next: PropsSave): void => {
    propsRef.current = next;
    if (!props.gamePreset) kv.set(PROPS_SAVE_KEY, serializePropsSave(next));
  }, []);
  /**
   * The beam's Apply with a part cartridge (TICKET-32, ARGO_NOTE_34 D.3): a tap fits the part onto the part aimed at; a
   * hold (0.45 s or more) or Shift fits it onto every part of that generator on the machine. Returns how many changed.
   */
  const applyPartShot = (broadcast: boolean): number => {
    const scene = sceneRef.current;
    const part = beamPortRef.current?.part;
    if (!scene || !part) return 0;
    const hit = scene.aimKitPart(BEAM_STROKE_RANGE);
    if (!hit) {
      say('Nothing to fit', 'Aim at a part of a machine: a bolt, a panel, a can.');
      return 0;
    }
    if (!hit.gen) {
      say('That piece takes no part cartridge', 'Part cartridges fit the printed parts: bolts, panels, brackets, grilles.');
      return 0;
    }
    // like for like: a bolt cartridge fits bolts (a panel fired at a column would take away what holds the crown up)
    if (hit.gen !== part.gen) {
      const name = (gen: string): string => (GENERATORS[gen]?.label ?? gen).toLowerCase();
      say(`That is a ${name(hit.gen)}`, `This cartridge fits ${name(part.gen)} parts. Print a ${name(hit.gen)} at the bench to change it.`);
      return 0;
    }
    const paths = broadcast
      ? scene.kitPlaced(hit.kit).filter((p) => p.source.kind === 'param' && p.source.gen === hit.gen).map((p) => p.path)
      : [hit.path];
    const next = withKitOverride(propsRef.current, hit.kit, paths, overrideFromPart(part));
    savePropsSave(next);
    scene.setKitOverrides(hit.kit, next.kits?.[hit.kit] ?? {});
    say(paths.length === 1 ? `Fitted: ${part.name}` : `Fitted ${paths.length} parts: ${part.name}`,
      broadcast ? 'Every part of that kind on the machine changed.' : 'Hold the trigger, or Shift, to change every part of that kind.');
    return paths.length;
  };
  const applyPartShotRef = useRef<(broadcast: boolean) => number>(() => 0);
  applyPartShotRef.current = applyPartShot;
  /**
   * The beam's Apply with a material cartridge at a machine part (plan 39 step 2): a tap puts the material on the part's
   * body (a panel keeps its bolts); a hold or Shift puts it on every part of the machine that wore the same material. A
   * generated core keeps its own texture. Returns how many parts changed.
   */
  const applySkinShot = (broadcast: boolean): number => {
    const scene = sceneRef.current;
    const port = beamPortRef.current;
    if (!scene || !port || port.part || !port.preset) return 0;
    const hit = scene.aimKitPart(BEAM_STROKE_RANGE);
    if (!hit) {
      say('Nothing to paint', 'Aim at a part of a machine: a panel, a column, a skid.');
      return 0;
    }
    const placed = scene.kitPlaced(hit.kit);
    const target = placed.find((p) => p.path === hit.path);
    if (!target || target.source.kind === 'gen') {
      say('The core keeps its own skin', 'A material cartridge paints the parts around it: panels, columns, skids.');
      return 0;
    }
    const was = bodyMaterial(target);
    const parts = broadcast ? placed.filter((p) => p.source.kind !== 'gen' && bodyMaterial(p) === was) : [target];
    let next = propsRef.current;
    for (const p of parts) {
      const ov = skinOverride(port.preset, p, next.kits?.[hit.kit]?.[p.path]);
      if (ov) next = withKitOverride(next, hit.kit, [p.path], ov);
    }
    savePropsSave(next);
    scene.setKitOverrides(hit.kit, next.kits?.[hit.kit] ?? {});
    say(parts.length === 1 ? `Painted: ${port.name}` : `Painted ${parts.length} parts: ${port.name}`,
      broadcast ? 'Every part that wore the same material changed.' : 'Hold the trigger, or Shift, to paint every part that wears the same material.');
    return parts.length;
  };
  const applySkinShotRef = useRef<(broadcast: boolean) => number>(() => 0);
  applySkinShotRef.current = applySkinShot;
  /**
   * The beam's Apply with a species cartridge (plan 39, Aq): a tap regrows the tree it is fired at as the cartridge's
   * species; a hold or Shift every tree of that tree's kind within 12 m. Like for like: it fits trees only. A plot holds
   * MAX_TREE_VARIANTS species presets at once; a shot that would need one more says so. Returns how many trees changed.
   */
  const applySpeciesShot = (broadcast: boolean): number => {
    const scene = sceneRef.current;
    const sp = beamPortRef.current?.species;
    if (!scene || !sp) return 0;
    if (whereRef.current !== 'planet') {
      say('No trees here', 'A species cartridge regrows the plot\'s trees: fire it on the moon.');
      return 0;
    }
    const hit = scene.aimTree(BEAM_STROKE_RANGE);
    if (!hit) {
      say('No tree in the beam', 'Aim at a tree\'s trunk.');
      return 0;
    }
    const places = broadcast ? scene.treesLike(hit.place, 12) : [hit.place];
    const next = withTrees(propsRef.current, places, { species: sp.species as TreePreset['species'], params: sp.params });
    const presets = new Set(Object.values(next.trees ?? {}).map((t) => treeVariantKey(t)));
    if (presets.size > MAX_TREE_VARIANTS) {
      say(`The plot holds ${MAX_TREE_VARIANTS} tree presets`, 'Fire one of the presets already growing here, or regrow those trees as this one.');
      return 0;
    }
    savePropsSave(next);
    scene.setTreeOverrides(next.trees ?? {});
    say(places.length === 1 ? `Regrown: ${sp.name}` : `Regrew ${places.length} trees: ${sp.name}`,
      broadcast ? 'Every tree of that kind within 12 m changed.' : 'Hold the trigger, or Shift, to regrow every tree of its kind nearby.');
    return places.length;
  };
  const applySpeciesShotRef = useRef<(broadcast: boolean) => number>(() => 0);
  applySpeciesShotRef.current = applySpeciesShot;
  /**
   * The beam's Apply with a light cartridge (plan 39, Lx): a tap sets the lamp it is fired at to the light; a hold or
   * Shift every lamp on that machine. Like for like: it fits lamps only. Returns how many lamps changed.
   */
  const applyLightShot = (broadcast: boolean): number => {
    const scene = sceneRef.current;
    const light = beamPortRef.current?.light;
    if (!scene || !light) return 0;
    const hit = scene.aimKitPart(BEAM_STROKE_RANGE);
    if (!hit) {
      say('No lamp in the beam', 'Aim at a machine\'s lamp.');
      return 0;
    }
    const placed = scene.kitPlaced(hit.kit);
    const target = placed.find((p) => p.path === hit.path);
    if (!target || !isLampPart(target)) {
      say('That is not a lamp', 'A light cartridge sets lamps: the small glowing lenses on a machine.');
      return 0;
    }
    const lamps = broadcast ? placed.filter(isLampPart) : [target];
    let next = propsRef.current;
    for (const p of lamps) {
      const ov = lightOverride(light, p, next.kits?.[hit.kit]?.[p.path]);
      if (ov) next = withKitOverride(next, hit.kit, [p.path], ov);
    }
    savePropsSave(next);
    scene.setKitOverrides(hit.kit, next.kits?.[hit.kit] ?? {});
    say(lamps.length === 1 ? `Set: ${light.name}` : `Set ${lamps.length} lamps: ${light.name}`,
      broadcast ? 'Every lamp on the machine changed.' : 'Hold the trigger, or Shift, to set every lamp on the machine.');
    return lamps.length;
  };
  const applyLightShotRef = useRef<(broadcast: boolean) => number>(() => 0);
  applyLightShotRef.current = applyLightShot;
  /**
   * The beam's Apply with a sprite cartridge (plan 43, step 4): bakes the print's turntable at its stage and hangs the card
   * over the machine it is fired at, where it turns at that stage's cadence. Returns 1 when a card was hung.
   */
  const applySpriteShot = (broadcast: boolean): number => {
    const scene = sceneRef.current;
    const sprite = beamPortRef.current?.sprite;
    if (!scene || !sprite) return 0;
    const hit = scene.aimKitPart(BEAM_STROKE_RANGE);
    if (!hit) {
      say('Nothing to hang a card on', 'Aim at a machine: the Gate, a mill, a press.');
      return 0;
    }
    const sheet = bakeSpritePrint(sprite);
    const atlas = spriteAtlas(sheet);
    const hung = scene.setSpriteCard(hit.kit, {
      rgba: atlas.rgba,
      width: atlas.width,
      height: atlas.height,
      frames: sheet.angles,
      fps: spriteFps(sprite.stage),
      sizeM: Math.max(0.5, sprite.size / 32),
    });
    if (!hung) {
      say('That takes no card', 'A sprite card hangs over the lab machines and the Gate.');
      return 0;
    }
    savePropsSave(withSpriteCard(propsRef.current, hit.kit, sprite));
    gameAudio.playCartridgeSnap();
    say(`Card hung: ${sprite.name}`,
      broadcast
        ? `${sheet.angles} frames, turned ${spriteFps(sprite.stage)} times a second: the whole machine shows them.`
        : `${sheet.angles} frames at ${sprite.size} px, turned ${spriteFps(sprite.stage)} times a second.`);
    return 1;
  };
  const applySpriteShotRef = useRef<(broadcast: boolean) => number>(() => 0);
  applySpriteShotRef.current = applySpriteShot;
  /**
   * The beam's Apply with a sound cartridge (plan 43, step 4): the printed stem becomes the machine's hum, looped where the
   * print is a loop and struck once where it is a verb. Firing the same print at the same machine again stops it. Returns 1
   * when the hum changed.
   */
  const applySoundShot = (broadcast: boolean): number => {
    const scene = sceneRef.current;
    const sound = beamPortRef.current?.sound;
    if (!scene || !sound) return 0;
    const hit = scene.aimKitPart(BEAM_STROKE_RANGE);
    if (!hit) {
      say('Nothing to hum', 'Aim at a machine: a hum belongs to a machine.');
      return 0;
    }
    const key = `hum:${hit.kit}`;
    if (!broadcast && gameAudio.printVoicePlaying(key)) {
      gameAudio.stopPrintSamples(key);
      savePropsSave(withMachineHum(propsRef.current, hit.kit, null));
      say(`Hum stopped: ${sound.name}`, 'Fire the same cartridge at the machine again to start it.');
      gameAudio.playCartridgePing();
      return 1;
    }
    const { stem } = stemAtStage(sound, sound.stage);
    const rendered = renderStem(stem, sound.stage, 3);
    const loop = sound.loopSeconds !== undefined;
    gameAudio.playPrintSamples(rendered.channels, rendered.sampleRateHz, { key, loop, gain: 0.16 });
    savePropsSave(withMachineHum(propsRef.current, hit.kit, sound));
    gameAudio.playCartridgeSnap();
    say(`${loop ? 'Hum set' : 'Struck'}: ${sound.name}`,
      `Heard at stage ${sound.stage}, ${loop ? `a ${Math.round((sound.loopSeconds ?? 0) * 1000)} ms loop` : 'once'}.`);
    return 1;
  };
  const applySoundShotRef = useRef<(broadcast: boolean) => number>(() => 0);
  applySoundShotRef.current = applySoundShot;
  /**
   * The beam's Apply with a layered material (plan 41): a tap puts the material on the part it is fired at (a panel keeps
   * its bolts); a hold or Shift on every part of the machine that wore the same material. Like for like: a generated
   * core keeps its own texture. Returns how many parts changed.
   */
  const applyMaterialShot = (broadcast: boolean): number => {
    const scene = sceneRef.current;
    const mat = beamPortRef.current?.material;
    if (!scene || !mat) return 0;
    const hit = scene.aimKitPart(BEAM_STROKE_RANGE);
    if (!hit) {
      say('Nothing to dress', 'Aim at a part of a machine: a panel, a column, a skid.');
      return 0;
    }
    const placed = scene.kitPlaced(hit.kit);
    const target = placed.find((p) => p.path === hit.path);
    if (!target || target.source.kind === 'gen') {
      say('The core keeps its own skin', 'A material cartridge dresses the parts around it: panels, columns, skids.');
      return 0;
    }
    const was = bodyMaterial(target);
    const parts = broadcast ? placed.filter((p) => p.source.kind !== 'gen' && bodyMaterial(p) === was) : [target];
    let next = propsRef.current;
    for (const p of parts) {
      const ov = bodyOverride(mat.ref, p, next.kits?.[hit.kit]?.[p.path]);
      if (ov) next = withKitOverride(next, hit.kit, [p.path], ov);
    }
    savePropsSave(next);
    scene.setKitOverrides(hit.kit, next.kits?.[hit.kit] ?? {});
    say(parts.length === 1 ? `Dressed: ${mat.name}` : `Dressed ${parts.length} parts: ${mat.name}`,
      broadcast ? 'Every part that wore the same material changed.' : 'Hold the trigger, or Shift, to dress every part that wears the same material.');
    return parts.length;
  };
  const applyMaterialShotRef = useRef<(broadcast: boolean) => number>(() => 0);
  applyMaterialShotRef.current = applyMaterialShot;
  /** Whether the base's stores (the pack and the linked bins) hold a bill: a dry run of the base's `pay` command. */
  const stockCheck = (
    bill: readonly { readonly item: string; readonly n: number }[],
    reason: string,
  ): { readonly ok: boolean; readonly why: string } => {
    if (bill.length === 0) return { ok: true, why: '' };
    const at = sceneRef.current?.debug.position() ?? { x: 0, z: 0 };
    const dry = apply(baseWorldRef.current, getBaseEnv(), { t: 'pay', at, bill, reason });
    const refused = dry.events.find((ev) => ev.type === 'refused');
    if (refused && refused.type === 'refused') {
      const named = (refused.short ?? []).map((x) => `${x.n} ${x.item === 'vtx-rough' ? 'raw vertices' : x.item === 'pxd-mono' ? 'raw pixels' : x.item}`);
      return { ok: false, why: `Short of ${named.join(' and ') || 'raw stock'}.` };
    }
    return { ok: true, why: '' };
  };
  /** Whether the stores hold a part's cost. */
  const partStockCheck = (spec: PartSpec): { readonly ok: boolean; readonly why: string } => stockCheck(partBill(spec), 'part');
  const payForStock = (bill: readonly { readonly item: string; readonly n: number }[], reason: string): void => {
    if (bill.length === 0) return;
    const at = sceneRef.current?.debug.position() ?? { x: 0, z: 0 };
    dispatchBase({ t: 'pay', at, bill, reason });
  };
  const payForPart = (spec: PartSpec): void => payForStock(partBill(spec), `part:${spec.gen}`);
  /**
   * The planet's Drafting Table prints a part (ARGO_NOTE_34 D.1): it draws a blank from the rack through the quantum
   * bridge, pays the part's raw vertices and raw pixels, prints at once, and puts the cartridge in the rifle's port.
   */
  const printPartOnTable = (spec: PartSpec): void => {
    const blank = freeBlank(labRef.current);
    if (blank === null || !canPrintPart(labRef.current, blank, spec).ok || !partStockCheck(spec).ok) return;
    payForPart(spec);
    const next = printPart(labRef.current, blank, spec);
    labRef.current = next;
    commit(withLab(stateRef.current, next));
    const printed = next.cartridges.find((c) => c.id === blank);
    if (printed) loadBeamCartridge(printed);
  };
  const openLog = useCallback((log: string): void => {
    if (!propsRef.current.logs.includes(log)) savePropsSave(readLog(propsRef.current, log));
    setDatabank(log);
  }, [savePropsSave]);
  const closeDatabank = useCallback((): void => setDatabank(null), []);
  // a salvage prop goes into the pack first (the base's salvage command, logged); refused whole when it does not fit, and the prop stays
  const clearProp = useCallback((id: string): void => {
    const scene = sceneRef.current;
    if (!scene || propsRef.current.cleared.includes(id)) return;
    const item = clutterById(id);
    if (item) {
      if (item.role !== 'salvage') return;
      // TASK-26: the salvage's ore is the plot's ore (the stock the boulders, the beam and a drill's cost share), so a player with no ore
      // can always reach a drill here; the primitives go into the pack, refused whole when they do not fit, as before
      const split = salvageSplit(item);
      const cmd: BaseCommand = { t: 'salvage', at: SALVAGE_AT, stock: [...split.pack] };
      if (split.pack.length > 0) {
        const res = apply(baseWorldRef.current, getBaseEnv(), cmd);
        if (!res || res.events.some((e) => e.type === 'refused')) {
          say('The pack is full', 'Make room for the salvage, then hold E again.');
          gameAudio.playRefuse();
          return;
        }
      }
      if (!scene.dissolveClutter(id)) return;
      if (split.pack.length > 0) dispatchBase(cmd);
      if (split.plotOre > 0) plotRef.current = { ...plotRef.current, ore: Math.min(1e5, plotRef.current.ore + split.plotOre) };
      savePropsSave(clearedProp(propsRef.current, id));
      commit(withLab(withPlot(stateRef.current, plotRef.current), labRef.current));
      const lines: string[] = [];
      if (split.plotOre > 0) lines.push(`${split.plotOre} ore went to your plot`);
      if (split.pack.length > 0) lines.push(`${split.pack.map((st) => `${st.n} ${ITEMS[st.item]?.name ?? st.item}`).join(', ')} went into your pack`);
      say(`${item.label.charAt(0).toUpperCase()}${item.label.slice(1)} salvaged`, `${lines.join('; ')}.`);
      if (item.log) openLog(item.log);
    } else {
      // POL-97: wreck truck hold-E salvage on the planet
      const salvage = scene.salvageWreck(id);
      if (!salvage) return;
      const cmd: BaseCommand = { t: 'salvage', at: SALVAGE_AT, stock: [{ item: salvage.item, n: salvage.n }] };
      const res = apply(baseWorldRef.current, getBaseEnv(), cmd);
      if (!res || res.events.some((e) => e.type === 'refused')) {
        say('The pack is full', 'Make room for the salvage, then hold E again.');
        gameAudio.playRefuse();
        return;
      }
      dispatchBase(cmd);
      savePropsSave(clearedProp(propsRef.current, id));
      commit(withLab(withPlot(stateRef.current, plotRef.current), labRef.current));
      const itemName = ITEMS[salvage.item]?.name ?? salvage.item;
      say('Wreck salvaged', `${salvage.n} ${itemName} went into your pack.`);
      const log = salvage.log ?? loreFor(id)?.log;
      if (log) openLog(log);
    }
  }, [dispatchBase, getBaseEnv, say, openLog, savePropsSave, commit]);
  clearPropRef.current = clearProp;

  // the armory's sidearm (TICKET-07 Item D): E at the rail puts the Combat Shotgun into the sidearm slot. It goes through the pack first
  // (the base's salvage, logged) and is then moved into the slot; refused whole when the pack has no free slot, so nothing is lost.
  const takeSidearm = useCallback((): void => {
    const w = baseWorldRef.current;
    if (w.equipment.sidearm) { say('The sidearm is already in hand', 'Its rounds show bottom left.'); return; }
    const refuse = (): void => { say('The pack is full', 'Make room for the sidearm, then take it again.'); gameAudio.playRefuse(); };
    if (!w.player.slots.some((s) => s === null)) { refuse(); return; }
    const salvage: BaseCommand = { t: 'salvage', at: SALVAGE_AT, stock: [{ item: SIDEARM_ITEM_ID, n: 1 }] };
    const res = apply(w, getBaseEnv(), salvage);
    if (!res || !res.world || res.events.some((e) => e.type === 'refused')) { refuse(); return; }
    // the stack lands in the pack, or in linked storage in reach when the pack is too heavy: the move takes it from wherever it went
    const packIndex = res.world.player.slots.findIndex((s) => s?.item === SIDEARM_ITEM_ID);
    const box = packIndex >= 0 ? undefined : res.world.boxes.find((bx) => bx.slots.some((s) => s?.item === SIDEARM_ITEM_ID));
    const boxIndex = box ? box.slots.findIndex((s) => s?.item === SIDEARM_ITEM_ID) : -1;
    dispatchBase(salvage);
    if (packIndex >= 0) dispatchBase({ t: 'move', at: SALVAGE_AT, from: { at: 'inventory', index: packIndex }, to: { at: 'equipment', slot: 'sidearm' }, n: 1 });
    else if (box && boxIndex >= 0) dispatchBase({ t: 'move', at: SALVAGE_AT, from: { at: 'box', box: box.id, index: boxIndex }, to: { at: 'equipment', slot: 'sidearm' }, n: 1 });
    if (!baseWorldRef.current.equipment.sidearm) {
      say('The sidearm stays in storage', 'Move it from your inventory into the sidearm slot.');
      return;
    }
    sceneRef.current?.setSidearmTaken(true);
    narratorRef.current?.trigger('tool:pickup');
    say('Combat sidearm taken', 'It sits in the sidearm slot. Its rounds show bottom left on the planet.');
  }, [dispatchBase, getBaseEnv, say]);
  takeSidearmRef.current = takeSidearm;

  // a drop goes to the bridge store: the linked storage that the refinery and the benches draw from (a logged grant, as the Act V kit)
  const payDrop = useCallback((item: string, n: number) => {
    dispatchBaseRef.current({ t: 'grant', stock: [{ item, n }] });
  }, []);

  // the monsters' events reach the game here, once the scene is ready
  useEffect(() => {
    const scene = sceneRef.current;
    if (!ready || !scene) return undefined;
    scene.monsters.setEvents({
      onSeen: () => {
        narratorRef.current?.trigger('mob:seen');
        updateChain(monsterSeen);
      },
      onWarn: (mk) => {
        say('Leak surging', mk.inSeconds !== null ? `A wave in ${Math.ceil(mk.inSeconds)} s. Keep your back to the gate.` : 'A wave is due.');
        // Haddy's surge warning (A6-LEAK-SURGE, Argo's line); the narrator's cooldown keeps it from repeating
        narratorRef.current?.trigger('leak:surge');
      },
      onHitPlayer: (damage, bearing) => takeHit(damage, bearing),
      onDeath: (_mob, drop) => {
        narratorRef.current?.trigger('mob:kill');
        updateChain(monsterKilled);
        payDrop(drop.item, drop.n);
      },
      onSealed: (mk, reward) => {
        gameAudio.playSeal();
        for (const r of reward) payDrop(r.item, r.n);
        // the leak's wreck goes up a rung, and the seal is saved for this profile (TASK-23c)
        sceneRef.current?.sealWreck(mk.site);
        savePropsSave(sealedSite(propsRef.current, mk.site));
        if (mk.dormant) {
          updateChain((c) => bump(c, COUNT.dormantSealed));
          say('Anomaly Core recovered', '1 on the bridge store.');
          // Argo's line for the dormant seal (docs/argo/plans/22-lore-micrologs.md §3), voiced in Haddy's voice (A4-LEAK-SEAL)
          narratorRef.current?.trigger('leak:dormant-sealed');
        } else {
          updateChain((c) => bump(c, COUNT.leakSealed));
          say('Leak sealed', `${reward[0]?.n ?? 0} raw pixels and ${reward[1]?.n ?? 0} raw vertices went to the bridge store.`);
        }
      },
    });
    return () => {
      sceneRef.current?.monsters.setEvents({});
    };
  }, [ready, say, updateChain, takeHit, payDrop]);

  // the Monsters setting (Settings: Off, Calm, Normal, Hard) and the living-monster budget by the graphics tier
  const monstersSetting = usePlaySettings().monsters;
  useEffect(() => {
    sceneRef.current?.monsters.setSetting(props.gamePreset ? (props.gamePreset.hudBlade === 'arena-wave-survivor' ? 'normal' : 'calm') : parseMonsters(monstersSetting));
  }, [ready, monstersSetting]);
  useEffect(() => {
    sceneRef.current?.monsters.setQuality(tier);
  }, [ready, tier]);

  const dial = useCallback((raw: string): { readonly ok: boolean; readonly why?: string } => {
    const code = raw.trim();
    if (!code) return { ok: false, why: 'That is not a plot code.' };
    const snap = decodePlot(code);
    if (!snap) return { ok: false, why: 'That code is damaged.' };
    const env = envRef.current;
    if (!env) return { ok: false, why: 'Lab not ready.' };
    const reconstructed = plotOfSnapshot(snap, env.gate);
    const vPlot = {
      snapshot: snap,
      plot: reconstructed.plot,
      lab: reconstructed.lab,
    };
    visitingRef.current = vPlot;
    setVisiting(vPlot);
    const vEnv: Env = {
      gate: env.gate,
      plotRadius: env.plotRadius,
      richness: env.richness,
      affinity: (id, metric) => cartlabAffinityOf(reconstructed.lab, id, metric),
    };
    const vRun = running(reconstructed.plot, vEnv);
    const vNet = network(reconstructed.plot, vEnv);
    sceneRef.current?.restore({
      gateOn: true,
      plot: reconstructed.plot,
      running: vRun,
      connected: vNet.connected,
    });
    say(`Dialed ${snap.owner}'s plot`, 'Step through the gate to visit.');
    return { ok: true };
  }, [say]);
  dialRef.current = dial;

  /** The plot's own gate id for the directory (one plot per profile). */
  const ownPlotId = `plot:${(props.profile.name || 'player').trim().toLowerCase()}`;
  const dialTimer = useRef<number | null>(null);
  /** Stops the chevron lock (closing the console mid-dial leaves nothing running). */
  const stopGateDial = useCallback(() => {
    if (dialTimer.current !== null) {
      window.clearInterval(dialTimer.current);
      dialTimer.current = null;
    }
    setGateDial(null);
  }, []);
  useEffect(() => () => {
    if (dialTimer.current !== null) window.clearInterval(dialTimer.current);
  }, []);
  /**
   * Dial Random Gate (plan 42 section 4.3): `@hm/coopnet` picks an open plot that is not this one and not one just
   * walked, the six chevrons lock at `CHEVRON_LOCK_SECONDS` each, and the gate then dials the plot code the entry stands
   * for. All of the choosing is pure (`./gate-directory`), so a press count always gives the same plot.
   */
  const dialRandom = useCallback(() => {
    const own = ownGateEntry({ plotId: ownPlotId, access: gateAccess, stage: plotRef.current.stage });
    const pick = dialRandomPlot(gateDirectory(own), own.plotId, dialSeed(gatePresses.current, own.plotId), walkedPlots);
    if (!pick.ok) {
      setRandomError(pick.reason === 'no-open-gates'
        ? 'No plot on the network is open to strangers just now.'
        : 'That plot code would not write.');
      return;
    }
    gatePresses.current += 1;
    setRandomError(null);
    setDialError(null);
    let state = beginGateDial(pick.entry.addressCode);
    setGateDial({ code: pick.entry.addressCode, locked: state.chevronsLocked });
    if (dialTimer.current !== null) window.clearInterval(dialTimer.current);
    let last = performance.now();
    const arrive = (): void => {
      if (dialTimer.current !== null) {
        window.clearInterval(dialTimer.current);
        dialTimer.current = null;
      }
      setGateDial(null);
      const res = dial(pick.code);
      if (!res.ok) {
        setRandomError(res.why ?? 'That plot could not be dialed.');
        return;
      }
      setWalkedPlots((prev) => (prev.includes(pick.entry.plotId) ? prev : [...prev, pick.entry.plotId]));
      rememberRecentCode(pick.code);
      say(`Dialed ${pick.entry.label ?? pick.entry.plotId}`, `Six chevrons locked on ${pick.entry.addressCode}.`);
    };
    dialTimer.current = window.setInterval(() => {
      const now = performance.now();
      state = stepGateDial(state, (now - last) / 1000);
      last = now;
      setGateDial({ code: pick.entry.addressCode, locked: state.chevronsLocked });
      if (state.status === 'locked') arrive();
    }, 50);
  }, [dial, gateAccess, ownPlotId, say, walkedPlots]);

  /**
   * Moves the plot's Gate by one step (plan 42 section 4.3): `forward` walks along the gate's own facing (the way its
   * arrival pad points), `turn` rotates it. The world's `moveGate` is the authority — it grounds the pose on the terrain
   * and refuses anything outside the plot — so this only proposes the point.
   */
  const nudgeGate = useCallback((forward: number, turn: number) => {
    const pose = baseWorldRef.current.gatePose;
    const yaw = pose.yaw + turn;
    const next = {
      x: Number((pose.x + Math.sin(pose.yaw) * forward).toFixed(3)),
      z: Number((pose.z + Math.cos(pose.yaw) * forward).toFixed(3)),
    };
    dispatchBase({ t: 'moveGate', at: next, yaw });
  }, [dispatchBase]);

  const endVisit = useCallback(() => {
    if (!visitingRef.current) return;
    const owner = visitingRef.current.snapshot.owner;
    visitingRef.current = null;
    setVisiting(null);
    const env = envRef.current;
    if (env) {
      const run = running(plotRef.current, env);
      const net = network(plotRef.current, env);
      sceneRef.current?.restore({
        gateOn: stateRef.current.gateOn,
        plot: plotRef.current,
        running: run,
        connected: net.connected,
      });
    }
    say('Back at your plot', `Visit to ${owner}'s plot ended.`);
  }, [say]);

  // the shell's entry (the Planetary Grid): applied once the lab is ready. A visit dials the code (the existing flow: step through the gate to walk it);
  // a spawn moves the player to the lab's spawn point, or out from the moon gate's back, facing away from it
  const entryDone = useRef(false);
  useEffect(() => {
    if (props.gamePreset || !ready || !props.entry || entryDone.current) return;
    entryDone.current = true;
    const entry = props.entry;
    if (entry.kind === 'credits') {
      startCreditsRef.current?.('title');
      return;
    }
    if (entry.kind === 'visit') {
      const r = dialRef.current?.(entry.code) ?? { ok: false, why: 'The lab is not ready.' };
      if (!r.ok) say('Visit refused', r.why ?? 'That code could not be dialed.');
      return;
    }
    const scene = sceneRef.current;
    if (!scene) return;
    if (entry.where === 'lab') scene.debug.teleport('lab', LAB_SPAWN.x, LAB_SPAWN.z, LAB_SPAWN.yaw);
    else {
      const exit = scene.gateExit();
      scene.debug.teleport('planet', exit.x, exit.z, exit.yaw, 0);
    }
  }, [ready, props.entry, say]);

  /**
   * JOB-09: the endgame's inputs, read from the state the plot already keeps — the fidelity stage and the four
   * cardinals, the gate's access, which world the biome says we stand on, and the clock the scene is at. The scene calls
   * this the frame a step crosses the horizon, so a crossing is never evaluated against a stale snapshot.
   */
  const endgameInputNow = (): EndgameInput => {
    const plot = plotRef.current;
    const world = baseWorldRef.current;
    const access = world.gateAccess ?? 'open';
    return {
      stage: plot.stage,
      cardinals: { pxd: level(plot, 'pxd'), vtx: level(plot, 'vtx'), lx: level(plot, 'lx'), aq: level(plot, 'aq') },
      plot: world.biome?.world === 'earth' ? 'earth' : 'moon',
      // the grid is powered when a machine on the plot is switched on: that is what the gate's conduits see
      gate: { powered: plot.machines.some((m) => m.on), open: true, irisClosed: access === 'closed', access, chevrons: GATE_CHEVRONS },
      breachStabilised: plot.stage >= 6,
      stats: {
        machinesPowered: plot.machines.filter((m) => m.built).length,
        machinesTotal: Math.max(1, plot.machines.length),
        cartridgesApplied: 0,
        auditsGreen: true,
        coverage: 0,
      },
      simTime: 0,
      lastGateEventTime: 0,
    };
  };

  // ---- the scene, built behind the loading bar
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const low = tier === 'potato' || tier === 'low';
    const device = deviceFor(tier), gridSpacing = low ? 1 : 0.5;
    // the display governor (SETMIX_PLAN rule 6): auto follows the frame time from the starting tier; a tier chosen in Settings is kept.
    // What it can change while you play: the picture's sharpness, the plumes and the ground's triangles; the rest is the starting tier's.
    const adaptive = createAdaptiveQuality(tier, { locked: parseQuality(props.profile.quality) !== null, targetFps: props.profile.fpsTarget });
    let graphics = resolveGraphics(tier, props.profile.graphics);
    noteTier(tier);
    let scene: PlayScene;
    try {
      scene = createPlayScene({
        canvas,
        gridSpacing,
        antialias: !low,
        powerPreference: powerPreferenceOf(props.profile.gpu),
        reducedMotion: reduced,
        textureSize: low ? 512 : 1024,
        groundTexture: low ? 128 : 256,
        detail: detailOf(graphics, tier),
        cameraView: props.profile.cameraView ?? 'first',
        gamePreset: props.gamePreset,
        avatar: stateRef.current.avatar,
        beamField: props.gamePreset ? null : loadBeamSave().field,
        vegetation: (props.profile.graphics.vegetation as 'auto' | 'off' | 'low' | 'high' | undefined) ?? 'auto',
        hasSidearm: Boolean(baseWorldRef.current.equipment.sidearm),
        // JOB-09: a step through a live horizon at stage six changes worlds; `earth-endgame.ts` decides, the scene only
        // reports that the aperture was crossed. Everything the rule reads is the state the HUD already shows.
        earthTransit: () => props.gamePreset
          ? props.gamePreset.id.startsWith('gate:') ? baseWorldRef.current.biome.world === 'earth' ? 'moon' : 'earth' : null
          : transitArrival(endgameInputNow())?.to ?? null,
        onEarthTransit: (to) => {
          if (props.gamePreset) { props.onGamePreset?.(gateSandboxPreset(to, props.gamePreset.worldSeed)); return; }
          const next = gateSandboxPreset(to);
          const scene = sceneRef.current;
          scene?.gateArrival(arrivalSector(to));
          dispatchBaseRef.current({ t: 'setBiome', preset: to === 'earth' ? EARTH_BIOME_PRESET : MOON_BIOME_PRESET });
          if (to !== 'earth') { props.onGamePreset?.(next); return; }
          // the Multiverse's win: the breach is stable and the traveller is standing on Earth. The roll plays once; the
          // sandbox (building, driving, cartridges) stays open behind it.
          let seen = false;
          try { seen = kv.get('hm.endingSeen') === '1'; } catch { seen = endingSeen; }
          if (seen) { props.onGamePreset?.(next); return; }
          pendingGatePresetRef.current = next;
          try { kv.set('hm.endingSeen', '1'); } catch { /* storage unavailable: the run still counts */ }
          setEndingSeen(true);
          startCreditsRef.current?.('lab');
        },
      });
    } catch (err) {
      console.error('Failed to createPlayScene:', err);
      setFailed(true);
      return undefined;
    }
    sceneRef.current = scene;
    if (baseWorldRef.current.equipment.sidearm) {
      scene.setSidearmTaken(true);
    }
    // Window B (TICKET-11, co-op): a guest who opens play in a session takes the room's sculpt as the scene is made
    importRoomTerrain();
    // the props saved for this profile: the cleared clutter is gone, the sealed leaks' wrecks stand restored (TASK-23c)
    scene.setProps(propsRef.current);
    // the beam's part overrides on the lab's kit-built props (TICKET-32): stored now, applied as each kit builds
    for (const [kit, ov] of Object.entries(propsRef.current.kits ?? {})) scene.setKitOverrides(kit, ov);
    scene.setTreeOverrides(propsRef.current.trees ?? {});
    // plan 43: the cards hung over the machines and the hums they were given are part of this profile's world
    for (const [kit, print] of Object.entries(propsRef.current.sprites ?? {})) {
      const sheet = bakeSpritePrint(print);
      const atlas = spriteAtlas(sheet);
      scene.setSpriteCard(kit, {
        rgba: atlas.rgba, width: atlas.width, height: atlas.height,
        frames: sheet.angles, fps: spriteFps(print.stage), sizeM: Math.max(0.5, print.size / 32),
      });
    }
    for (const [kit, print] of Object.entries(propsRef.current.sounds ?? {})) {
      const { stem } = stemAtStage(print, print.stage);
      const rendered = renderStem(stem, print.stage, 3);
      gameAudio.playPrintSamples(rendered.channels, rendered.sampleRateHz, {
        key: `hum:${kit}`, loop: print.loopSeconds !== undefined, gain: 0.16,
      });
    }
    if (typeof window !== 'undefined') {
      (window as any).__playScene = scene;
      (window as any).__createGenFixture = createGenFixture;
      (window as any).__globalKitPieceCache = globalKitPieceCache;
      (window as any).__pieceManager = pieceManagerRef.current;
    }
    const size = (): void => {
      const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
      scene.resize(w, h, pixelRatioFor(graphics, w, h, window.devicePixelRatio || 1));
    };
    size();
    window.addEventListener('resize', size);

    const look = (id: string, st: Stage) => bakeLookCached(VAULT_BY_ID.get(id)!, st, device, gridSpacing);
    const steps: [string, () => void | Promise<void>][] = [
      ['Loading voice narration', async () => {
        if (props.gamePreset) return;
        const { rules } = await preloadMentorVo();
        if (narratorRef.current) {
          (narratorRef.current as any).rules = rules;
        }
      }],
      ['Loading audio & sound effects', async () => {
        await gameAudio.preloadStartupAudio();
        // the base world is part of the campaign now (one game): the moon's audio always loads behind the bar
        await gameAudio.preloadMoonAudio();
      }],
      ['Loading generated assets', async () => {
        const s = stateRef.current.plot.stage || 1;
        await preloadAllGenAssets(genLevelForStage(s, props.profile.quality));
      }],
      ['Loading the wreck sites', async () => { await scene.preloadWrecks(); }],
      ['Fitting the lab', async () => { await scene.preloadLabGenerated(); }],
      ...SMOOTH_IDS.map((id): [string, () => void] => ['Shaping the boulders', () => { smoothModel(id); }]),
      ...([1, 2, 3, 4, 5, 6] as const).map((s): [string, () => void] => [
        `Growing stage ${s}`,
        () => { look(PLOT, s); },
      ]),
      ...[...new Set(NEIGHBOURS.map((n) => `${n.cartridge}@${n.stage}`))].map((k): [string, () => void] => {
        const [id, st] = k.split('@') as [string, string];
        return ['Finding the neighbours', () => { look(id, Number(st) as Stage); }];
      }),
      ['Opening the lab', () => {
        scene.setPlanet(look(PLOT, 1), (st: Stage) => look(PLOT, st), NEIGHBOURS.map((plot) => ({ plot, look: look(plot.cartridge, plot.stage) })));
        // the cartridge that was in the rifle's port comes back into it (TASK-21d): it left the rack when it was loaded
        const savedPort = props.gamePreset ? null : loadBeamSave().port;
        const savedLook = savedPort ? rifleLook(savedPort) : null;
        if (savedPort && savedLook) {
          beamPortRef.current = { cartridge: savedPort, preset: savedLook.preset, name: savedPort.name, colour: savedLook.colour, ...(savedLook.print ?? {}) };
          scene.setBeamCartridge(savedLook.colour);
          setBeamPort({
            name: savedPort.name,
            preset: savedLook.preset,
            colour: savedLook.colour,
            id: savedPort.id,
          });
        }
        env = {
          gate: scene.debug.gatePlanet(),
          plotRadius: 500,
          richness: (x, z) => scene.richness(x, z),
          affinity: (id, metric) => cartlabAffinityOf(labRef.current, id, metric),
          extraDrawKw: () => turretGridDrawKw(baseWorldRef.current.base),
        };
        envRef.current = env;
        plotRef.current = stateRef.current.plot;
        if (isDevSeed && plotRef.current.machines.length === 0) {
          const powerUnit: Machine = {
            id: 1,
            kind: 'power',
            x: env.gate.x,
            z: env.gate.z - 6,
            yaw: 0,
            on: true,
            cartridge: null,
            built: 0,
          };
          plotRef.current = {
            ...plotRef.current,
            ore: Math.max(plotRef.current.ore, 600),
            machines: [powerUnit],
            nextId: 2,
          };
          commit(withPlot(stateRef.current, plotRef.current));
        }
        scene.restore({ gateOn: stateRef.current.gateOn, plot: plotRef.current, running: running(plotRef.current, env), connected: network(plotRef.current, env).connected });
        const gate = scene.debug.gatePlanet();
        const bEnv = { heightAt: (x: number, z: number) => scene.heightAt(x, z), bridge: { x: gate.x, z: gate.z, range: BRIDGE_RANGE } };
        if (!baseWorldRef.current.boxes.some((b) => b.id === BRIDGE_STORE)) {
          baseWorldRef.current = withBridgeStore(baseWorldRef.current, bEnv);
        }
        if (!hasSaveOnBootRef.current && !baseWorldRef.current.shelter && scene.debug.where() === 'planet') {
          dropStarterShelter(scene);
        }
        scene.setPieces(pieceManagerRef.current.getMeshes());
        scene.setBase(baseWorldRef.current.base);
        scene.setNodes(baseWorldRef.current.field);
        // plan 42: the plot's Gate stands where the save left it, with the iris in the state the save holds
        scene.setPlotGate(baseWorldRef.current.gatePose);
        scene.setGateAccess(irisAccessFor({ access: isGateAccessMode(baseWorldRef.current.gateAccess) ? baseWorldRef.current.gateAccess : 'open' }));
        scene.setSpeciesSlots(baseWorldRef.current.biome.species);
        if (isGateAccessMode(baseWorldRef.current.gateAccess)) setGateAccess(baseWorldRef.current.gateAccess);
        else setGateAccess('open');
        pieceManagerRef.current.sync(baseWorldRef.current, bEnv, false);
        scene.setWalkWorld(pieceManagerRef.current.walkWorld);
        scene.setVehicles(baseWorldRef.current.vehicles);
        const initFabs = baseWorldRef.current.machines.filter((m) => m.kind === 'fabricator').map((m) => {
          const hp = baseWorldRef.current.base.pieces.find((p) => p.id === m.id);
          const pt = hp ? pieceAt(baseWorldRef.current.base, hp) : null;
          return {
            id: m.id,
            x: pt?.x ?? 0,
            z: pt?.z ?? 0,
            yaw: 0,
            printing: m.jobs.length > 0,
          };
        });
        scene.setFabricators(initFabs);
        scene.monsters.setWeaponStats(devWeaponRef.current ?? weaponStats(baseWorldRef.current.loadout));
        for (const m of baseWorldRef.current.machines) {
          const piece = baseWorldRef.current.base.pieces.find((p) => p.id === m.id);
          if (piece) {
            const center = pieceAt(baseWorldRef.current.base, piece);
            if (center) {
              const match = plotRef.current.machines.find(
                (pm) => pm.kind === ('heavy-' + m.kind) && Math.hypot(pm.x - center.x, pm.z - center.z) < 2
              );
              if (match) hardpointToPlotMachineRef.current.set(m.id, match.id);
            }
          }
        }
      }],
      ['Growing the vegetation', () => { scene.bakeCoverage(); }],
      ...(props.gamePreset ? [[`Configuring ${props.gamePreset.title}`, () => { scene.startGamePreset(); if (props.gamePreset?.hudBlade === 'arena-wave-survivor') scene.monsters.equip(true); }] as [string, () => void]] : []),
      ['Compiling shaders', () => { scene.warm(); }],
    ];
    const hook = { frames: 0, ready: false, step: stateRef.current.step, where: 'lab', sync: 1, wave: -1, triangles: 0, calls: 0, tier: tier as Quality, aimedProp: null as string | null };
    const keys = new Set<string>();
    let dx = 0, dy = 0, cancelled = false, raf = 0, at = 0, timer = 0, last = performance.now(), hudAt = 0, savedAt = 0;
    let env: Env | null = null;
    /** Builds a machine if it may stand there: the plot pays, the scene shows it, and a stage it lifts sends the wave from it. */
    const tryPlace = (kind: MachineKind, x: number, z: number, yaw: number): boolean => {
      if (visitingRef.current) {
        say(`Visiting ${visitingRef.current.snapshot.owner}'s plot`, 'Visits are read-only.');
        return false;
      }
      if (!env || scene.debug.where() !== 'planet') return false;
      const before = plotRef.current;
      const isFree = isFreeDrill(stateRef.current, kind);
      const checkPlot = isFree ? { ...before, ore: Math.max(before.ore, KINDS[kind].cost) } : before;
      const can = canPlace(checkPlot, env, kind, x, z);
      if (!can.ok) {
        console.warn(`[canPlace refused]: ${kind} at (${x.toFixed(1)}, ${z.toFixed(1)}): ${can.why}`);
        return false;
      }
      const placed = place(checkPlot, env, kind, x, z, yaw);
      const after = isFree ? { ...placed, ore: before.ore } : placed;
      plotRef.current = after;
      commit(withPlot(stateRef.current, after));
      updateChain((c) => c);
      scene.setPlot(after, running(after, env), network(after, env).connected, network(after, env).satisfaction);
      fx('mill-start');
      scene.playAction('plant');
      if (after.machines.length === 1) narratorRef.current?.trigger('machine:first');
      if (after.stage > before.stage) {
        scene.raiseStage(after.stage, { x, z });
        triggerStageLine(after.stage);
        if (after.stage === 4) narratorRef.current?.trigger('fab:hauler');
        if (after.stage === 6) narratorRef.current?.trigger('fab:crawler');
      }
      return true;
    };
    placeRef.current = tryPlace;
    // while a hologram is locked the arrows nudge it instead of walking (WASD still walks round it)
    const onKey = (e: KeyboardEvent, down: boolean): void => {
      const nudging = !!sceneRef.current?.ghostLocked() && e.code.startsWith('Arrow');
      if (down && !nudging) keys.add(e.code); else keys.delete(e.code);
    };
    const kd = (e: KeyboardEvent) => onKey(e, true), ku = (e: KeyboardEvent) => onKey(e, false);
    const realMove = lookFilter();
    const onMove = (e: MouseEvent): void => {
      if (document.pointerLockElement === canvas) {
        if (!realMove(e.movementX, e.movementY)) return;
        dx += e.movementX;
        dy += e.movementY;
      }
    };
    const onMouseDown = (e: MouseEvent): void => {
      if (e.button === 0 && document.pointerLockElement === canvas) {
        isLmbDownRef.current = true;
        if (scene.monsters.isEquipped() && !beamHeldRef.current) {
          scene.monsters.setTrigger(true);
          fireWeapon();
        } else {
          // A part cartridge in Apply (TICKET-32): the shot is decided on release (tap = one part, hold or Shift = all of that kind)
          if (beamHeldRef.current && beamModeRef.current === 'apply' && beamPortRef.current?.part) {
            partShotRef.current = { t0: performance.now(), shift: e.shiftKey };
            return;
          }
          // A light cartridge in Apply sets the lamp it is fired at (decided on release: a tap one, a hold every lamp on the machine)
          if (beamHeldRef.current && beamModeRef.current === 'apply' && beamPortRef.current?.light) {
            lightShotRef.current = { t0: performance.now(), shift: e.shiftKey };
            return;
          }
          // A sprite cartridge in Apply hangs its card over the machine it is fired at (at once: a card is per machine)
          if (beamHeldRef.current && beamModeRef.current === 'apply' && beamPortRef.current?.sprite) {
            applySpriteShotRef.current(e.shiftKey);
            return;
          }
          // A sound cartridge in Apply gives the machine its hum (at once: the same cartridge again stops it)
          if (beamHeldRef.current && beamModeRef.current === 'apply' && beamPortRef.current?.sound) {
            applySoundShotRef.current(e.shiftKey);
            return;
          }
          // A layered material in Apply dresses the part it is fired at (decided on release: a tap one, a hold every part that wore the same)
          if (beamHeldRef.current && beamModeRef.current === 'apply' && beamPortRef.current?.material) {
            materialShotRef.current = { t0: performance.now(), shift: e.shiftKey };
            return;
          }
          // A species cartridge in Apply regrows the tree it is fired at (decided on release: a tap one, a hold its kind nearby)
          if (beamHeldRef.current && beamModeRef.current === 'apply' && beamPortRef.current?.species) {
            speciesShotRef.current = { t0: performance.now(), shift: e.shiftKey };
            return;
          }
          // A material cartridge aimed at a machine part paints the part's skin (decided on release); aimed anywhere else
          // it paints the ground as before
          if (beamHeldRef.current && beamModeRef.current === 'apply' && beamPortRef.current?.preset && scene.aimKitPart(BEAM_STROKE_RANGE)) {
            skinShotRef.current = { t0: performance.now(), shift: e.shiftKey };
            return;
          }
          // A held rifle takes the mouse: the beam mines in the frame loop, and the other modes' strokes are the next step.
          if (beamHeldRef.current) return;
          if (placingLayoutRef.current !== null) {
            const hit = scene.aimPoint();
            if (hit) {
              const yaw = (placingLayoutRotationRef.current * Math.PI) / 2;
              dispatchBase({
                t: 'plan',
                layout: placingLayoutRef.current,
                cx: hit.x,
                cz: hit.z,
                yaw,
              });
              setPlacingLayoutId(null);
              say('Plan placed in world', 'Press F near plan to construct pieces.');
              return;
            }
          }
          const w = baseWorldRef.current;
          const slot = w.player.slots[w.hotbar];
          const activeBp = slot && slot.n > 0 ? blueprint(slot.item) : null;
          if (activeBp) {
            tryPlaceBaseRef.current();
          }
        }
      }
    };
    const onMouseUp = (e: MouseEvent): void => {
      if (e.button === 0) {
        isLmbDownRef.current = false;
        scene.monsters.setTrigger(false);
        const shot = partShotRef.current;
        if (shot) {
          partShotRef.current = null;
          applyPartShotRef.current(shot.shift || performance.now() - shot.t0 >= 450);
        }
        const skin = skinShotRef.current;
        if (skin) {
          skinShotRef.current = null;
          applySkinShotRef.current(skin.shift || performance.now() - skin.t0 >= 450);
        }
        const tree = speciesShotRef.current;
        if (tree) {
          speciesShotRef.current = null;
          applySpeciesShotRef.current(tree.shift || performance.now() - tree.t0 >= 450);
        }
        const lamp = lightShotRef.current;
        if (lamp) {
          lightShotRef.current = null;
          applyLightShotRef.current(lamp.shift || performance.now() - lamp.t0 >= 450);
        }
        const dress = materialShotRef.current;
        if (dress) {
          materialShotRef.current = null;
          applyMaterialShotRef.current(dress.shift || performance.now() - dress.t0 >= 450);
        }
      }
    };
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku); window.addEventListener('mousemove', onMove);
    // the beam's edits are written when the page leaves (TASK-21d); the loop writes them every 1.5 s while they change
    const flushOnHide = (): void => { flushBeam(); };
    window.addEventListener('pagehide', flushOnHide);
    window.addEventListener('mousedown', onMouseDown); window.addEventListener('mouseup', onMouseUp);
    // the base the monsters last kept their footprints from (rebuilt when the base changes, P0-MON-03)
    let solidsBase: BaseWorld['base'] | null = null;
    // Window B (TICKET-11, POL-114): what this screen last sent the room in a session (the beam intent, and the pose's clock)
    let coopIntentKey: string | null = null;
    let coopIntentAt: { x: number; z: number } | null = null;
    let coopPoseClock = 0;
    const loop = (ms: number): void => {
      if (cancelled) return;
      const frameMs = ms - last;
      const dt = props.gamePreset && pausedRef.current ? 0 : Math.min(0.1, frameMs / 1000);
      last = ms;
      gameTimeRef.current += dt * 1000;
      pieceManagerRef.current.update(dt);
      const w = baseWorldRef.current;
      const playerPos = scene.debug.position();
      const coop = props.gamePreset ? null : currentOutpostSession();
      // Window B (TICKET-11, co-op): this player's pose goes to the room ten times a second, while they stand on the plot
      if (coop) {
        coopPoseClock += dt;
        const pose = coopPoseClock >= 0.1 ? scene.playerPose() : null;
        if (pose) {
          coopPoseClock = 0;
          coop.client.sendPose(pose);
        }
      }

      // a held beam core fires on every tick it can (its 0.1 s cooldown paces it), not once per pull (TASK-23b-2)
      if (isLmbDownRef.current && scene.monsters.isEquipped() && scene.monsters.getWeaponStats()?.mode === 'beam') fireWeapon();

      // 1. Tick accumulator for 100ms ticks (node regrowth, beam extraction, machine refinement)
      harvestAccRef.current += dt;
      const aimedNode = scene.aimNode(w.field, BEAM_RANGE);
      // A held rifle mines in Extract mode; in Apply and Sculpt it does not mine (the equipped beam still does, as before).
      const hasBeam = beamHeldRef.current ? beamModeRef.current === 'extract' : w.equipment.beam?.item === 'tool-beam';
      const targetNode = forceBeamRef.current !== null
        ? (w.field.nodes.find((n) => n.id === forceBeamRef.current) ?? aimedNode)
        : aimedNode;
      const isMining = (isLmbDownRef.current || forceBeamRef.current !== null) && hasBeam && targetNode !== null && (!scene.monsters.isEquipped() || beamHeldRef.current);
      const isFiringBeam = (isLmbDownRef.current && beamHeldRef.current) || forceBeamFiringRef.current;
      scene.setBeamFiring(isMining || beamBoulderTargetRef.current !== null || isFiringBeam);
      scene.setBeamAiming((isLmbDownRef.current || forceBeamFiringRef.current) && beamHeldRef.current);

      if (harvestAccRef.current >= 0.1) {
        const powerMap: Record<number, number> = {};
        if (envRef.current) {
          const runMap = running(plotRef.current, envRef.current);
          for (const m of w.machines) {
            const pId = hardpointToPlotMachineRef.current.get(m.id);
            if (pId !== undefined) {
              powerMap[m.id] = runMap.get(pId) ?? 0;
            }
          }
        }
        // the sappers (P0-MON-03): the built machines are what the brain's sappers go for, and a machine a sapper holds
        // works at half its share this tick
        const machineSpots: { id: number; x: number; z: number; hu: number }[] = [];
        for (const m of w.machines) {
          const at = machineAt(w, m.id);
          if (at) machineSpots.push({ id: m.id, x: at.x, z: at.z, hu: HARDPOINT_HALF });
        }
        scene.monsters.setMachines(machineSpots);
        if (solidsBase !== w.base) {
          solidsBase = w.base;
          scene.monsters.setSolids(footprintSolids(w.base));
        }
        const latched = w.machines.filter((m) => scene.monsters.isLatched(m.id)).map((m) => m.id);
        // Window B (TICKET-11, POL-114): in a session the room ticks the machines and the harvest once a second, on its own clock. This
        // screen sends its beam intent instead, when the target or the power shares change (and as the player walks on a beam), so the
        // world never advances twice. Solo play still ticks here, as before.
        if (coop) {
          const beam = isMining && targetNode ? { node: targetNode.id, power: 1 } : null;
          const at = { x: playerPos.x, z: playerPos.z };
          const key = JSON.stringify({ beam, power: powerMap, latched });
          const walked = coopIntentAt === null || Math.hypot(at.x - coopIntentAt.x, at.z - coopIntentAt.z) > 1;
          if (key !== coopIntentKey || (beam !== null && walked)) {
            coopIntentKey = key;
            coopIntentAt = at;
            coop.client.sendBeamIntent({ at, beam, power: powerMap, latched });
          }
        } else {
          coopIntentKey = null;
          coopIntentAt = null;
        }
        while (harvestAccRef.current >= 0.1) {
          harvestAccRef.current -= 0.1;
          if (coop) continue;
          dispatchBaseRef.current({
            t: 'tick',
            at: { x: playerPos.x, z: playerPos.z },
            dt: 0.1,
            beam: isMining && targetNode ? { node: targetNode.id, power: 1 } : null,
            power: powerMap,
            latched,
          });
        }
      }

      // 2. Beam VFX update
      if (isMining && targetNode) {
        const muzzle = scene.beamMuzzle();
        const target = { x: targetNode.x, y: scene.heightAt(targetNode.x, targetNode.z) + 0.35, z: targetNode.z };
        const col = targetNode.kind === 'dither' ? '#d9d9d9' : targetNode.kind === 'fold' ? '#7dd3fc' : targetNode.kind === 'chroma' ? '#ff4fd8' : '#22d3ee';
        scene.setBeam(muzzle, target, 'extract', col, true);
      } else if (beamBoulderTargetRef.current !== null) {
        // the rifle takes ore from a boulder (amber) or paints the ground (the preset's colour): the beam runs from the muzzle to it
        scene.setBeam(scene.beamMuzzle(), beamBoulderTargetRef.current, beamModeRef.current, beamBoulderTargetRef.current.colour, true);
      } else if (isFiringBeam) {
        const muzzle = scene.beamMuzzle();
        const fwd = scene.aimGround().dir;
        const target = { x: muzzle.x + fwd.x * 20, y: muzzle.y, z: muzzle.z + fwd.z * 20 };
        scene.setBeam(muzzle, target, beamModeRef.current, (beamModeRef.current as string) === 'seal' ? '#f59e0b' : '#38bdf8', true);
      } else {
        scene.setBeam(null, null, 'extract', '#ffffff', false);
      }

      // 3. Throttled preview for build ghost
      const slot = w.player.slots[w.hotbar];
      const activeBp = slot && slot.n > 0 ? blueprint(slot.item) : null;
      if (activeBp && drivingSpeed === null) {
        const curKind = (buildKindRef.current && activeBp.kinds.includes(buildKindRef.current)
          ? buildKindRef.current
          : activeBp.kinds[0]!) as Kind;
        if (ghostKindRef.current !== curKind) {
          scene.setPieceGhost(globalKitPieceCache.instantiate(curKind, w.stage, 0).group);
          ghostKindRef.current = curKind;
        }
        const aim = scene.aimPoint();
        if (aim) {
          const bEnv = getBaseEnv();
          const shouldRecompute =
            !lastPreviewRef.current ||
            w.tick !== lastPreviewTickRef.current ||
            activeBp.id !== lastPreviewBpRef.current ||
            curKind !== lastPreviewKindRef.current ||
            !lastPreviewAimRef.current ||
            Math.hypot(aim.x - lastPreviewAimRef.current.x, aim.z - lastPreviewAimRef.current.z) > 0.25 ||
            Math.abs(aim.yaw - lastPreviewAimRef.current.yaw) > (5 * Math.PI / 180);

          let prev = lastPreviewRef.current?.prev;
          if (shouldRecompute || !prev) {
            prev = preview(w, bEnv, { x: playerPos.x, z: playerPos.z }, activeBp.id, curKind, {
              x: aim.x,
              y: aim.y,
              z: aim.z,
              yaw: aim.yaw,
            });
            lastPreviewRef.current = { prev, aim, bp: activeBp, kind: curKind };
            lastPreviewTickRef.current = w.tick;
            lastPreviewBpRef.current = activeBp.id;
            lastPreviewKindRef.current = curKind;
            lastPreviewAimRef.current = { x: aim.x, y: aim.y, z: aim.z, yaw: aim.yaw };

            // Socket glow (Item C2): ok slots within 8m of aim, on aimed level and level above, max 48
            const okSlots: { x: number; y: number; z: number; yaw: number }[] = [];
            const sEnv = structureEnv(bEnv);
            const structures = w.base.structures.filter(
              (st) => Math.hypot(aim.x - st.x, aim.z - st.z) <= 16
            );
            for (const structure of structures) {
              const dx = aim.x - structure.x;
              const dz = aim.z - structure.z;
              const cos = Math.cos(structure.yaw);
              const sin = Math.sin(structure.yaw);
              const u = dx * cos + dz * sin;
              const v = -dx * sin + dz * cos;
              const ci = Math.floor(u / S.CELL);
              const cj = Math.floor(v / S.CELL);
              const aimedK = Math.max(0, Math.round((aim.y - structure.y) / S.LEVEL));

              for (let k = aimedK; k <= aimedK + 1; k++) {
                for (let i = ci - 2; i <= ci + 2; i++) {
                  for (let j = cj - 2; j <= cj + 2; j++) {
                    const candidatePieces: S.Piece[] = [];
                    if (curKind === 'wall' || curKind === 'airlock') {
                      candidatePieces.push(
                        { id: -1, s: structure.id, kind: curKind, i, j, k, r: 0, mat: activeBp.mat },
                        { id: -1, s: structure.id, kind: curKind, i, j, k, r: 1, mat: activeBp.mat },
                      );
                    } else if (curKind === 'pillar' || curKind === 'hardpoint') {
                      candidatePieces.push({ id: -1, s: structure.id, kind: curKind, i, j, k, r: 0, mat: activeBp.mat });
                    } else {
                      const rRot = (curKind === 'ramp' || isFixture(curKind)) ? ((buildRotationRef.current) % 4 as any) : 0;
                      candidatePieces.push({ id: -1, s: structure.id, kind: curKind, i, j, k, r: rRot, mat: activeBp.mat });
                    }

                    for (const cand of candidatePieces) {
                      const cWorld = pieceAtIn(structure, cand);
                      if (Math.hypot(cWorld.x - aim.x, cWorld.z - aim.z) <= 8) {
                        const verdict = S.check(w.base, sEnv, cand);
                        if (verdict.ok) {
                          let exAngle = 0;
                          if (cand.kind === 'wall' || cand.kind === 'airlock') {
                            if (cand.r === 1) exAngle = -Math.PI / 2;
                          } else if (cand.kind === 'ramp' || cand.kind === 'bench' || cand.kind === 'bin' || cand.kind === 'repeater') {
                            exAngle = -cand.r * (Math.PI / 2);
                          }
                          okSlots.push({
                            x: cWorld.x,
                            y: cWorld.y,
                            z: cWorld.z,
                            yaw: -structure.yaw + exAngle,
                          });
                          if (okSlots.length >= 48) break;
                        }
                      }
                    }
                    if (okSlots.length >= 48) break;
                  }
                  if (okSlots.length >= 48) break;
                }
                if (okSlots.length >= 48) break;
              }
              if (okSlots.length >= 48) break;
            }
            scene.setSocketRings(okSlots);
          }
          const snap = prev.snap;
          if (snap) {
            if (snap.mode === 'place') {
              const st = w.base.structures.find((s) => s.id === snap.piece.s);
              const pPos = pieceAt(w.base, { ...snap.piece, id: -1, mat: '' });
              let extraAngle = 0;
              if (snap.piece.kind === 'wall' || snap.piece.kind === 'airlock') {
                if (snap.piece.r === 1) extraAngle = -Math.PI / 2;
              } else if (
                snap.piece.kind === 'ramp' ||
                snap.piece.kind === 'bench' ||
                snap.piece.kind === 'bin' ||
                snap.piece.kind === 'repeater' ||
                snap.piece.kind === 'hardpoint'
              ) {
                const rRot = (snap.piece.r + buildRotationRef.current) % 4;
                extraAngle = -rRot * (Math.PI / 2);
              }
              const yaw = (st ? -st.yaw : 0) + extraAngle;
              const pose = pPos ? { x: pPos.x, y: pPos.y, z: pPos.z, yaw } : null;
              let tint: 'grounded' | 'ok' | 'weak' | 'bad' = 'ok';
              if (!snap.ok || prev.short.length > 0) tint = 'bad';
              else if (snap.support >= 0.99) tint = 'grounded';
              else if (snap.support >= 0.5) tint = 'ok';
              else tint = 'weak';
              scene.placePieceGhost(pose, tint);
            } else if (snap.mode === 'found') {
              const cosine = Math.cos(snap.yaw);
              const sine = Math.sin(snap.yaw);
              const C = 4;
              const pts = [
                { x: snap.cx - (C / 2) * cosine + (C / 2) * sine, z: snap.cz - (C / 2) * sine - (C / 2) * cosine },
                { x: snap.cx + (C / 2) * cosine + (C / 2) * sine, z: snap.cz + (C / 2) * sine - (C / 2) * cosine },
                { x: snap.cx - (C / 2) * cosine - (C / 2) * sine, z: snap.cz - (C / 2) * sine + (C / 2) * cosine },
                { x: snap.cx + (C / 2) * cosine + (C / 2) * sine, z: snap.cz + (C / 2) * sine + (C / 2) * cosine },
                { x: snap.cx, z: snap.cz },
              ];
              let highest = -Infinity;
              for (const pt of pts) {
                const h = scene.heightAt(pt.x, pt.z);
                if (h > highest) highest = h;
              }
              const pose = { x: snap.cx, y: highest, z: snap.cz, yaw: -snap.yaw };
              const tint: 'grounded' | 'ok' | 'weak' | 'bad' = (!snap.ok || prev.short.length > 0) ? 'bad' : 'grounded';
              scene.placePieceGhost(pose, tint);
            }
          } else {
            scene.placePieceGhost(null, 'bad');
          }
        } else {
          scene.placePieceGhost(null, 'bad');
        }

        if (activeBp && activeBp.kinds.length > 1) {
          setWheelCycleText(`wheel: ${activeBp.kinds.map((k) => KIND_LABEL[k] ?? k).join(' · ')}`);
        } else {
          setWheelCycleText(null);
        }
        if (activeBp && (curKind === 'ramp' || isFixture(curKind))) {
          setRotationText(`R: ${buildRotationRef.current * 90}°`);
        } else {
          setRotationText(null);
        }
      } else {
        if (ghostKindRef.current !== null) {
          scene.setPieceGhost(null);
          ghostKindRef.current = null;
        }
        lastPreviewRef.current = null;
        scene.setSocketRings([]);
        setWheelCycleText(null);
        setRotationText(null);
      }

      // 4. Hover support % check & structure tracking
      const aimHit = scene.aimPoint();
      if (aimHit && aimHit.piece !== null) {
        const placedP = w.base.pieces.find((x) => x.id === aimHit.piece);
        if (placedP) {
          currentAimedStructureIdRef.current = placedP.s;
        }
      }

      const isIntegrityOn = (baseViewSource as WorldViewSource).get?.()?.build?.integrity ?? false;
      const isPlaceableGhostActive = lastPreviewRef.current?.prev?.snap?.ok === true;
      if (!isPlaceableGhostActive && aimHit && aimHit.piece !== null && (isIntegrityOn || activeBp !== null)) {
        const placedP = w.base.pieces.find((x) => x.id === aimHit.piece);
        if (placedP) {
          const bEnv = getBaseEnv();
          const supMap = S.supports(w.base, structureEnv(bEnv));
          const supVal = supMap.get(placedP.id) ?? 0;
          const colName = integrityColorName(supVal);
          const hexColor =
            colName === 'blue'
              ? '#38bdf8'
              : colName === 'green'
                ? '#22c55e'
                : colName === 'yellow'
                  ? '#eab308'
                  : colName === 'orange'
                    ? '#f97316'
                    : '#ef4444';
          setHoverSupport({
            text: `Support ${Math.round(supVal * 100)}% · ${colName}`,
            color: hexColor,
          });
        } else {
          setHoverSupport(null);
        }
      } else {
        setHoverSupport(null);
      }

      // 5. Starter shelter drop check on planet
      if (!hasSaveOnBootRef.current && !w.shelter && scene.debug.where() === 'planet') {
        dropStarterShelter(scene);
      }

      // 6. 4 Hz Room pressure & life-support check (D14)
      const nowRoomMs = performance.now();
      if (nowRoomMs - lastRoomCheckTimeRef.current >= 250) {
        lastRoomCheckTimeRef.current = nowRoomMs;
        if (scene.debug.where() === 'planet') {
          const bEnv = getBaseEnv();
          const feetY = playerPos.y - 1.7;
          const { room, pressurized } = roomAt(w, bEnv, { x: playerPos.x, y: feetY, z: playerPos.z });
          scene.setSheltered(pressurized);
          // the starter shelter's 15 m dome: its first foundation, the one placed at first boot (TASK-26)
          const shelterFoundation = w.base.pieces.filter((q) => q.kind === 'foundation').sort((a, b) => a.id - b.id)[0];
          const shelterAt = w.shelter && shelterFoundation ? pieceAt(w.base, shelterFoundation) : null;
          scene.setShelterDome(shelterAt ? { x: shelterAt.x, z: shelterAt.z } : null);
          setShelterState(pressurized ? 'pressurized' : (room && room.sealed ? 'sealed-no-power' : 'none'));
        } else {
          scene.setSheltered(false);
          setShelterState('none');
        }
      }

      // 7. Plan proximity check within 8m
      if (scene.debug.where() === 'planet') {
        const nearPlan = w.plans.find(
          (p) => Math.hypot(p.cx - playerPos.x, p.cz - playerPos.z) <= 8.0
        );
        if (nearPlan) {
          setPlanPrompt(`F: build next (${nearPlan.left.length} left)`);
          nearestPlanRef.current = nearPlan;
        } else {
          setPlanPrompt(null);
          nearestPlanRef.current = null;
        }
      } else {
        setPlanPrompt(null);
        nearestPlanRef.current = null;
      }

      // 8. Plan ghosts and layout placement ghosts
      if (placingLayoutId !== null) {
        const layout = w.layouts.find((l) => l.id === placingLayoutId);
        const pieces = layout ? layoutPieces(layout.code) : null;
        const aimHitPos = scene.aimPoint();
        if (pieces && aimHitPos) {
          const yaw = (placingLayoutRotationRef.current * Math.PI) / 2;
          const c = Math.cos(yaw), sn = Math.sin(yaw), h = S.CELL / 2;
          const x = aimHitPos.x - h * c + h * sn, z = aimHitPos.z - h * sn - h * c;
          const corners = [[0, 0], [S.CELL, 0], [0, S.CELL], [S.CELL, S.CELL]] as const;
          const y = Math.max(...corners.map(([u, v]) => scene.heightAt(x + u * c - v * sn, z + u * sn + v * c)));
          const pose: S.Structure = { id: -1, x, y, z, yaw };
          const ghosts = pieces.map((piece) => {
            let extraAngle = 0;
            if (
              piece.kind === 'wall' ||
              piece.kind === 'airlock' ||
              piece.kind === 'halfWall' ||
              piece.kind === 'windowWall' ||
              piece.kind === 'doorframe' ||
              piece.kind === 'door' ||
              piece.kind === 'railing'
            ) {
              if (piece.r === 1) extraAngle = -Math.PI / 2;
            } else if (piece.deg !== undefined) {
              extraAngle = -(piece.deg * Math.PI) / 180;
            } else if (
              piece.kind === 'ramp' ||
              piece.kind === 'stairs' ||
              piece.kind === 'bench' ||
              piece.kind === 'bin' ||
              piece.kind === 'repeater' ||
              piece.kind === 'lifeSupport' ||
              piece.kind === 'roof' ||
              piece.kind === 'lowRoof' ||
              piece.kind === 'roofOuter' ||
              piece.kind === 'roofInner' ||
              piece.kind === 'ridgeCap'
            ) {
              extraAngle = -piece.r * (Math.PI / 2);
            }
            return {
              kind: piece.kind,
              at: pieceAtIn(pose, piece),
              yaw: -yaw + extraAngle,
            };
          });
          scene.setPlanGhosts(ghosts);
        }
      } else if (w.plans.length > 0) {
        const bEnv = getBaseEnv();
        const allGhosts: { kind: Kind; at: { x: number; y: number; z: number }; yaw: number }[] = [];
        for (const pl of w.plans) {
          const pghosts = planGhosts(w, bEnv, pl.id);
          for (const pg of pghosts) {
            let extraAngle = 0;
            if (
              pg.piece.kind === 'wall' ||
              pg.piece.kind === 'airlock' ||
              pg.piece.kind === 'halfWall' ||
              pg.piece.kind === 'windowWall' ||
              pg.piece.kind === 'doorframe' ||
              pg.piece.kind === 'door' ||
              pg.piece.kind === 'railing'
            ) {
              if (pg.piece.r === 1) extraAngle = -Math.PI / 2;
            } else if (pg.piece.deg !== undefined) {
              extraAngle = -(pg.piece.deg * Math.PI) / 180;
            } else if (
              pg.piece.kind === 'ramp' ||
              pg.piece.kind === 'stairs' ||
              pg.piece.kind === 'bench' ||
              pg.piece.kind === 'bin' ||
              pg.piece.kind === 'repeater' ||
              pg.piece.kind === 'lifeSupport' ||
              pg.piece.kind === 'roof' ||
              pg.piece.kind === 'lowRoof' ||
              pg.piece.kind === 'roofOuter' ||
              pg.piece.kind === 'roofInner' ||
              pg.piece.kind === 'ridgeCap'
            ) {
              extraAngle = -pg.piece.r * (Math.PI / 2);
            }
            allGhosts.push({
              kind: pg.piece.kind,
              at: pg.at,
              yaw: -pg.yaw + extraAngle,
            });
          }
        }
        scene.setPlanGhosts(allGhosts);
      } else {
        scene.setPlanGhosts([]);
      }

      // 9. Throttled auto-save
      persistBaseWorld(false);
      const live = !pausedRef.current && stateRef.current.step !== 'create' && creditsRef.current === null;
      // the governor judges only the frames you play (the creator draws its own turntable over the lab)
      const next = live ? adaptive.frame(frameMs) : null;
      if (next) {
        graphics = resolveGraphics(next, props.profile.graphics);
        scene.setDetail(detailOf(graphics, next));
        size();
        noteTier(next);
        hook.tier = next;
      }
      // TICKET-14: while the credits play, the video drives the camera and the scene's looks before the frame is drawn
      const creditsNow = creditsRef.current;
      if (creditsNow?.director.isActive()) creditsNow.director.stepAtTime(undefined, dt);

      // TICKET-16 Part a: 12-second golden-hour reality convergence at the observation window (A9-02 -> A9-03 -> credits)
      if (finaleRef.current?.active) {
        const fin = finaleRef.current;
        const elapsedSec = (performance.now() - fin.startWallMs) / 1000;
        const heal = evaluateFinaleWindowHeal(elapsedSec);

        // TICKET-16 part b: connect Lab observation window golden-hour heal visual
        scene.setStorm(heal.windowStormHeal0to1);

        if (heal.shouldTriggerEpilogueVoice && !fin.voiceTriggered) {
          fin.voiceTriggered = true;
          narratorRef.current?.trigger('act9:finale-handoff');
        }

        if (heal.shouldStartCredits && !fin.done) {
          fin.done = true;
          fin.active = false;
          updateChain((c) => bump(c, COUNT.finaleWindowHealed, 1));
          try { kv.set('hm.endingSeen', '1'); } catch { /* storage unavailable: the save's chain still records A9-03 */ }
          setEndingSeen(true);
          startCredits('lab');
        }
      }
      const isAltCam = keys.has('AltLeft') || keys.has('AltRight');
      const flyUp = (keys.has('Space') ? 1 : 0) - (keys.has('ControlLeft') || keys.has('ControlRight') ? 1 : 0);
      const axis = (a: string[], b: string[]) => (a.some((k) => keys.has(k)) ? 1 : 0) - (b.some((k) => keys.has(k)) ? 1 : 0);
      const drivingVehicle = scene.getDrivingVehicle();
      const vehicleInput = drivingVehicle ? {
        throttle: axis(['KeyW', 'ArrowUp'], ['KeyS', 'ArrowDown']),
        steer: axis(['KeyD', 'ArrowRight'], ['KeyA', 'ArrowLeft']),
        brake: keys.has('Space'),
        boost: keys.has('ShiftLeft') || keys.has('ShiftRight'),
      } : undefined;
      const out = scene.frame(props.gamePreset ? gameTimeRef.current / 1000 : ms / 1000, dt, live
        ? {
            move: { x: axis(['KeyD', 'ArrowRight'], ['KeyA', 'ArrowLeft']), z: axis(['KeyW', 'ArrowUp'], ['KeyS', 'ArrowDown']) },
            look: { dx, dy },
            run: keys.has('ShiftLeft') || keys.has('ShiftRight'),
            jump: keys.has('Space') && !isAltCam && !drivingVehicle,
            altCam: isAltCam,
            flyUp,
            vehicleInput,
          }
        : { move: { x: 0, z: 0 }, look: { dx: 0, dy: 0 }, run: false });
      if (props.gamePreset && live) {
        const preset = props.gamePreset;
        const at = scene.debug.position();
        const living = new Set(scene.monsters.getMobList().map((m) => m.id));
        const result = stepGameProgress(preset, gameProgressRef.current, {
          dt, x: at.x, z: at.z, livingWaveMobs: waveMobIds.current.filter((id) => living.has(id)).length,
          visibleCreatureIds: preset.hudBlade === 'ecosystem-observer' ? scene.visibleCreatureIds() : [],
          escaped: out.event === 'to-lab',
        });
        gameProgressRef.current = result.state;
        scene.setCircuitCheckpoint(result.state.checkpoint);
        if (result.spawnWave) {
          const count = Math.min(12, 2 + result.spawnWave);
          waveMobIds.current = Array.from({ length: count }, (_, i) => {
            const angle = (i / count + preset.worldSeed / 65536) * Math.PI * 2;
            const kind = i % 3 === 0 ? 'swarmer' : 'charger';
            return scene.monsters.placeMob(kind, at.x + Math.sin(angle) * 22, at.z + Math.cos(angle) * 22);
          });
        }
        if (hook.frames % 6 === 0 || result.spawnWave) setGameProgress(result.state);
      }
      liveWhereRef.current = out.where;
      if (out.drivingVehicle) {
        setDrivingSpeed(out.drivingVehicle.speed);
        setDrivingBoostEnergy(out.drivingVehicle.boostEnergy);
        setDrivingBoosting(Boolean(out.drivingVehicle.boosting));
        setDrivingHarness(out.drivingVehicle.harness ?? null);
        setDrivingDrift(out.drivingVehicle.vx !== undefined && out.drivingVehicle.vz !== undefined && out.drivingVehicle.yaw !== undefined
          ? computeDrivingDriftBadge(out.drivingVehicle.vx, out.drivingVehicle.vz, out.drivingVehicle.yaw)
          : null);
        driveAccRef.current += out.drivingVehicle.speed * dt;
        if (driveAccRef.current >= 1) {
          const whole = Math.floor(driveAccRef.current);
          driveAccRef.current -= whole;
          updateChain((c) => bump(c, COUNT.drivenM, whole));
        }
      } else {
        // every frame, not only when the (closure) value says it is set: a stale null here left the plot readout hidden after a drive
        setDrivingSpeed(null);
        setDrivingBoostEnergy(undefined);
        setDrivingBoosting(false);
        setDrivingHarness(null);
        setDrivingDrift(null);
      }
      dx = 0; dy = 0;

      if (narratorRef.current) {
        narratorRef.current.step(dt);

        if (out.where === 'lab' && out.aimedPowerWall) {
          lookPowerWallTimerRef.current += dt;
          if (lookPowerWallTimerRef.current >= 0.8) {
            narratorRef.current.trigger('look:power-wall');
          }
        } else {
          lookPowerWallTimerRef.current = 0;
        }

        if (out.where === 'lab' && out.aimedWindow) {
          lookWindowTimerRef.current += dt;
          if (lookWindowTimerRef.current >= 0.8) {
            narratorRef.current.trigger('look:window');
          }
        } else {
          lookWindowTimerRef.current = 0;
        }

        if (out.where === 'lab' && out.atGate) {
          narratorRef.current.trigger('gate:approach');
        }

        if (out.event === 'powered') {
          narratorRef.current.trigger('power:on');
          void gameAudio.preloadMoonAudio();
        }
        if (out.event === 'to-planet') {
          narratorRef.current.trigger('moon:enter');
          gameAudio.setMusicContext('moon');
          gameAudio.setMoonStage(plotRef.current.stage);
          syncAmbience('planet', plotRef.current.stage);
        }
        if (out.event === 'to-lab' || out.event === 'sync-lost') {
          gameAudio.setMusicContext('lab');
          syncAmbience('lab');
        }
        if (out.event === 'stage-up') {
          triggerStageLine(out.stage);
          gameAudio.setMoonStage(out.stage);
          if (out.stage === 4) narratorRef.current.trigger('fab:hauler');
          if (out.stage === 6) narratorRef.current.trigger('fab:crawler');
          syncAmbience(undefined, out.stage);
        }

        if (prevSyncRef.current >= 0.3 && out.sync < 0.3) {
          narratorRef.current.trigger('sync:low');
        }
        prevSyncRef.current = out.sync;
      }

      if (ms - lastAmbienceCheckRef.current.at > 500) {
        syncAmbience();
      }

      let s = stateRef.current;
      if (out.event === 'powered') { s = poweredOn(s); say('Lunar Portal Online', 'Bridge technology stable. Step onto the moon to begin restoring the fidelity.'); }
      if (out.event === 'to-planet') { if (!s.visited) say('Stage 0: Lunar Surface', 'Monochrome & degrading. Our digital creations broke their simulated chains—build the machines before the collapse reaches Earth!'); s = arrived(s); }
      if (out.event === 'to-lab') {
        s = returned(s);
        if (visitingRef.current) endVisit();
      }
      if (out.event === 'sync-lost') {
        s = returned(s);
        say('Sync lost', 'The gate pulled you back. Your sync refills in the lab.');
        // the zero-loss recall (TASK-26 / POL-57): Argo's line as a subtitle only, plus trigger for narrator
        narratorRef.current?.trigger('sync:recall');
        narratorRef.current?.showSubtitleOnly('recall-zero', 'Pulled your buffer back before the static ate you. Stay near the relay line or drop a pylon.', 8);
        setBuilding(null);
        setMenu(false);
        if (visitingRef.current) endVisit();
      }
      if (out.event === 'stage-up') say(`Stage ${out.stage}`, STAGE_SAYS[out.stage] ?? '');
      if (s !== stateRef.current) commit(withLab(withPlot(s, plotRef.current), labRef.current));

      // ---- a salvage prop in the lab or planet: hold E for a second to clear it (TASK-23c / POL-97); the salvage goes into the pack, or the prop stays
  if (live && !visitingRef.current && (out.where === 'lab' || out.where === 'planet') && out.aimedProp?.salvage && keys.has('KeyE') && !out.atLever) {
    clearHoldRef.current += dt;
    if (clearHoldRef.current >= CLEAR_HOLD_SECONDS) {
      clearHoldRef.current = 0;
      clearPropRef.current(out.aimedProp.id);
    }
  } else {
    clearHoldRef.current = 0;
  }

  // ---- hand gathering ore from boulders on the plot: hold E to gather 3 ore/s
      let plotChanged = false;
      if (live && !visitingRef.current && out.where === 'planet' && out.aimedBoulder !== null && keys.has('KeyE') && out.aimed === null && !out.atLever && !out.atDial && !out.aimedLab && !scene.getDrivingVehicle() && !scene.getNearVehicle(3.5) && scene.aimPoint()?.piece == null) {
        const mined = scene.gatherBoulder(out.aimedBoulder, 3 * dt);
        if (mined > 0) {
          plotRef.current = { ...plotRef.current, ore: Math.min(1e5, plotRef.current.ore + mined) };
          plotChanged = true;
          if (scene.getCameraView() === 'third' && scene.debug.currentOneShot() !== 'plant') {
            scene.playAction('plant');
          }
          if (!firstGatherRef.current) {
            firstGatherRef.current = true;
            say('Ore gathered by hand.', 'A rock drill mines it for you.');
          }
        }
      }

      // ---- the held rifle takes ore from the boulder it is aimed at (TASK-21): Extract, left button, no field node in reach,
      // the boulder out to the beam's 25 m; about 4 ore a second on rock, more on scree (the boulder's own rate)
      {
        // the beam held on a leak seals it (TASK-23b-2): Extract held on a leak's column, and no rock is mined meanwhile
        const leakAim = live && !visitingRef.current && out.where === 'planet' && beamHeldRef.current && beamModeRef.current === 'extract' && isLmbDownRef.current && !scene.monsters.isEquipped() ? scene.aimLeak(BEAM_RANGE) : null;
        sealAimRef.current = leakAim;
        scene.monsters.setSealing(leakAim);
        scene.setBeamSealing(leakAim !== null || forceBeamSealingRef.current);
        const boulderId = leakAim === null && live &&!visitingRef.current && out.where === 'planet' && beamHeldRef.current && beamModeRef.current === 'extract' && isLmbDownRef.current && !scene.monsters.isEquipped() && scene.aimNode(baseWorldRef.current.field, BEAM_RANGE) === null
          ? scene.aimBoulder(BEAM_STROKE_RANGE)
          : null;
        const hit = boulderId !== null ? scene.beamGatherBoulder(boulderId, dt) : null;
        beamBoulderTargetRef.current = hit && hit.mined > 0 ? { x: hit.x, y: hit.y, z: hit.z, colour: '#f3b848' } : null;
        if (hit && hit.mined > 0) {
          plotRef.current = { ...plotRef.current, ore: Math.min(1e5, plotRef.current.ore + hit.mined) };
          plotChanged = true;
          beamOreAccRef.current += hit.mined;
          if (ms - beamOreFlushRef.current > 250) {
            const whole = Math.floor(beamOreAccRef.current);
            beamOreAccRef.current -= whole;
            beamOreFlushRef.current = ms;
            if (whole > 0) flashBeamHarvest(whole, 'Ore');
            if (whole > 0) updateChain((c) => bump(c, COUNT.minedBeam, whole));
          }
        }
      }

      // ---- Apply (TASK-21): the held rifle paints the loaded cartridge's preset under the aim point (radius 3 m); it costs no ore
      {
        const port = beamPortRef.current;
        // a part cartridge paints nothing: its shot fits a part on release (applyPartShot)
        const aim = live && !visitingRef.current && out.where === 'planet' && beamHeldRef.current && beamModeRef.current === 'apply' && isLmbDownRef.current && port !== null && port.preset !== '' && !skinShotRef.current
          ? scene.beamAim(BEAM_STROKE_RANGE)
          : null;
        if (aim && port) {
          scene.beamPaint(aim.x, aim.z, port.preset, dt);
          beamBoulderTargetRef.current = { x: aim.x, y: aim.y + 0.15, z: aim.z, colour: port.colour };
        }
      }

      // ---- Sculpt (TASK-21d): the held rifle carves, raises or smooths the ground under the aim point while the left button is held,
      // out to 25 m. Carve gains ore and raise spends it (the plot's ore, never below zero). The keep-out zones (the gate's apron, the
      // structures, the machines, the plot's edge) are never cut. The cut lands in the chunks as they change, a few a frame.
      {
        const sculpting = live && !visitingRef.current && out.where === 'planet' && beamHeldRef.current && beamModeRef.current === 'sculpt' && isLmbDownRef.current && !scene.monsters.isEquipped();
        if (sculpting && ms - keepOutAtRef.current > 250) {
          keepOutAtRef.current = ms;
          scene.setBeamKeepOut(sculptZones());
        }
        const aim = sculpting ? scene.beamAim(BEAM_STROKE_RANGE) : null;
        if (aim) {
          const r = scene.beamSculpt(aim.x, aim.z, sculptToolRef.current, dt, plotRef.current.ore);
          beamBoulderTargetRef.current = { x: aim.x, y: aim.y + 0.15, z: aim.z, colour: BEAM_COLOURS.sculpt };
          if (r.ore !== plotRef.current.ore) {
            plotRef.current = { ...plotRef.current, ore: Math.min(1e5, r.ore) };
            plotChanged = true;
          }
          if (r.cells > 0) {
            beamDirtyRef.current = true;
            if (ms - supportAtRef.current > 500) {
              supportAtRef.current = ms;
              recheckSupport();
            }
          }
        }
      }
      // the beam's save: the edits and the port are written every 1.5 s while they change, and again when the page leaves
      if (beamDirtyRef.current && ms - beamSaveAtRef.current > 1500) {
        beamDirtyRef.current = false;
        beamSaveAtRef.current = ms;
        flushBeam();
      }

      // ---- the lab runs every frame
      const labEnv: LabEnv = { presets: VAULT, stage: plotRef.current.stage, powered: stateRef.current.gateOn };
      const labRes = stepCartlab(labRef.current, labEnv, dt);
      labRef.current = labRes.state;
      for (const e of labRes.events) {
        if (e.type === 'written') {
          const c = labRes.state.cartridges.find((x) => x.id === e.id);
          say(`${c?.name ?? 'Cartridge'} written.`, 'Ready on the rack or for the combiner.');
        } else if (e.type === 'combined') {
          const c = labRes.state.cartridges.find((x) => x.id === e.id);
          say(c?.name ? `Mix ready: ${c.name}.` : 'Mix ready.', 'Ready on the rack.');
        } else if (e.type === 'stalled') {
          say(`The ${e.machine} stopped: no power.`, 'Turn on the gate to resume.');
        }
      }
      const rawLabAct = labActivity(labRef.current, labEnv);
      const nowSec = performance.now() * 0.001;
      if (labPanel === 'bench') labWindowClosedAtRef.current.bench = nowSec;
      if (labPanel === 'combiner') labWindowClosedAtRef.current.combiner = nowSec;
      if (labPanel === 'rack') labWindowClosedAtRef.current.rack = nowSec;
      if (fabricatorMachineId === 9999) labWindowClosedAtRef.current.fabricator = nowSec;
      scene.setLabActivity({
        bench: rawLabAct.bench > 0 || (nowSec - labWindowClosedAtRef.current.bench) <= 3.5 ? 1 : 0,
        combiner: rawLabAct.combiner > 0 || (nowSec - labWindowClosedAtRef.current.combiner) <= 3.5 ? 1 : 0,
        rack: rawLabAct.rack > 0 || (nowSec - labWindowClosedAtRef.current.rack) <= 3.5 ? 1 : 0,
        fabricator: (nowSec - labWindowClosedAtRef.current.fabricator) <= 3.5 ? 1 : 0,
      });
      // ---- the plot runs, in the lab too
      if (env && stateRef.current.step !== 'create') {
        const r = stepPlot(plotRef.current, env, dt);
        plotRef.current = r.state;
        for (const e of r.events) {
          if (e.type === 'stage-up' && !visitingRef.current) {
            // stage 1 comes from the first output of a pixel machine; the scene plays its wave like any later stage
            scene.raiseStage(e.stage, env.gate);
            dispatchBaseRef.current({ t: 'stage', stage: e.stage });
          }
          if (e.type === 'ore-out' && !visitingRef.current) say('Out of ore', 'Hold E on a boulder, or build a rock drill.');
          if (e.type === 'underpowered' && !visitingRef.current) {
            say('Not enough power', 'Build a power unit, or switch a machine off.');
            // Dr. Haddy's power prompt (TASK-26 / POL-57): 12 kW Gate brownout bark trigger
            narratorRef.current?.trigger('power:brownout');
            narratorRef.current?.showSubtitleOnly('power-short', "There goes the Gate's twelve-kilowatt breaker. Drop a Power Unit on the line before the plumes stall out.", 8);
          }
        }
        if (r.events.length) plotChanged = true;
        // the texture mill's running seconds (A4-02: process the dirt at the mill); whole seconds go to the chain
        if (!visitingRef.current) {
          const runMap = running(plotRef.current, env);
          if (plotRef.current.machines.some((m) => m.kind === 'mill' && (runMap.get(m.id) ?? 0) > 0)) millAccRef.current += dt;
          if (millAccRef.current >= 1) {
            const whole = Math.floor(millAccRef.current);
            millAccRef.current -= whole;
            updateChain((c) => bump(c, COUNT.milled, whole));
          }
        }
        if (!visitingRef.current) {
          scene.setPlot(plotRef.current, running(plotRef.current, env), network(plotRef.current, env).connected, network(plotRef.current, env).satisfaction);
        } else {
          const vp = visitingRef.current;
          const vEnv: Env = {
            gate: env.gate,
            plotRadius: env.plotRadius,
            richness: env.richness,
            affinity: (id, metric) => cartlabAffinityOf(vp.lab, id, metric),
          };
          scene.setPlot(vp.plot, running(vp.plot, vEnv), network(vp.plot, vEnv).connected);
        }
      }
      if (plotChanged || labRes.events.length || ms - savedAt > 5000) {
        savedAt = ms;
        commit(withLab(withPlot(stateRef.current, plotRef.current), labRef.current));
        updateChain((c) => c);
      }
      hook.frames += 1; hook.where = out.where; hook.aimedProp = out.aimedProp?.id ?? null; hook.sync = out.sync; hook.step = stateRef.current.step; hook.wave = scene.debug.wave();
      if (hook.frames % 30 === 0) Object.assign(hook, scene.debug.stats());
      if (hook.frames % 15 === 0) {
        // the monsters follow the chain (the gate's lock after F-03, the dormant anomaly after the rifle); health comes back when quiet
        const chainNow = stateRef.current.chain;
        scene.monsters.setUnlocked(props.gamePreset ? props.gamePreset.hudBlade === 'arena-wave-survivor' : chainNow.monstersUnlocked);
        scene.monsters.setDormantActive(!props.gamePreset && stepDone(chainNow, 'A4-01'));
        const nowMs = props.gamePreset ? gameTimeRef.current : performance.now();
        hpRef.current = regenHp(hpRef.current, (nowMs - lastHitRef.current) / 1000, Math.min(0.5, (nowMs - regenAtRef.current) / 1000));
        regenAtRef.current = nowMs;
        const eye = scene.debug.position();
        const aim = scene.aimGround();
        const yaw = Math.atan2(aim.dir.x, aim.dir.z);
        const leaks = scene.monsters.markers();
        setRadar(
          leaks
            .filter((m) => m.state !== 'sealed')
            .map((m) => ({ id: m.id, bearing: hitBearing({ x: eye.x, z: eye.z, yaw }, m), distance: Math.hypot(m.x - eye.x, m.z - eye.z), state: m.state, inSeconds: m.inSeconds, seal: m.seal, dormant: m.dormant })),
        );
        const aimed = sealAimRef.current !== null ? leaks.find((m) => m.id === sealAimRef.current) : undefined;
        setSealView(aimed ? { pct: aimed.seal, inReach: Math.hypot(aimed.x - eye.x, aimed.z - eye.z) <= SEAL_REACH } : null);
        const hpNow = hpRef.current;
        setVitals((v) => (v.hp === hpNow ? v : { ...v, hp: hpNow }));
      }

      if (ms - hudAt > 90 || out.event || labRes.events.length) {
        hudAt = ms;
        const vis = visitingRef.current;
        if (vis) {
          const vp = vis.plot;
          const levels = { pxd: level(vp, 'pxd'), vtx: level(vp, 'vtx'), lx: level(vp, 'lx'), aq: level(vp, 'aq') };
          setHud({
            where: out.where,
            sync: out.sync,
            inDome: out.inDome,
            warn: out.warn,
            atLever: out.atLever,
            atDial: out.atDial,
            ghost: out.ghost,
            aimed: out.aimed,
            aimedBoulder: out.aimedBoulder,
            aimedLab: out.aimedLab,
            aimedProp: out.aimedProp,
            atArmory: out.where === 'lab' && nearArmoryPickup(sceneRef.current?.debug.position() ?? { x: 99, z: 99 }),
            visitingOwner: vis.snapshot.owner,
            plot: { ore: 0, oreRate: 0, supply: 0, demand: 0, satisfaction: 1, levels, stage: vp.stage },
          });
        } else {
          const p = plotRef.current, rt = env ? rates(p, env) : null;
          const levels = { pxd: level(p, 'pxd'), vtx: level(p, 'vtx'), lx: level(p, 'lx'), aq: level(p, 'aq') };
          setHud({
            where: out.where,
            sync: out.sync,
            inDome: out.inDome,
            warn: out.warn,
            atLever: out.atLever,
            atDial: out.atDial,
            ghost: out.ghost,
            aimed: out.aimed,
            aimedBoulder: out.aimedBoulder,
            aimedLab: out.aimedLab,
            aimedProp: out.aimedProp,
            atArmory: out.where === 'lab' && nearArmoryPickup(sceneRef.current?.debug.position() ?? { x: 99, z: 99 }),
            visitingOwner: null,
            plot: { ore: p.ore, oreRate: rt?.ore ?? 0, supply: rt?.supply ?? 0, demand: rt?.demand ?? 0, satisfaction: rt && rt.demand > 0 ? Math.min(1, rt.supply / rt.demand) : 1, levels, stage: p.stage },
          });
        }
      }
      raf = requestAnimationFrame(loop);
    };
    const step = async (): Promise<void> => {
      if (cancelled) return;
      await steps[at]![1]();
      if (cancelled) return;
      at += 1;
      if (at < steps.length) { setLoading(steps[at]![0]); timer = window.setTimeout(step, 0); return; }
      hook.ready = true;
      setReady(true);
      if (scene.debug.where() === 'planet') {
        gameAudio.setMusicContext('moon');
        gameAudio.setMoonStage(stateRef.current.plot.stage || 0);
      } else {
        gameAudio.setMusicContext('lab');
      }
      updateChain((c) => c);
      // a story line whose step finished while the player was away (the Studio): it plays on the return, once
      if (finishedSteps(stateRef.current.chain.progress).includes('A4-03') && !narratorRef.current?.getState().heard.includes('A4-03')) narratorRef.current?.trigger('studio:open');
      narratorRef.current?.trigger('wake');
      raf = requestAnimationFrame(loop);
    };
    (window as unknown as { hmPlay?: unknown }).hmPlay = Object.assign(hook, {
      audio: gameAudio,
      setMoonStage: (stage: number) => gameAudio.setMoonStage(stage),
      setMusicContext: (ctx: any) => gameAudio.setMusicContext(ctx),
      duckMusic: (d: boolean) => gameAudio.duckMusic(d),
      pull: () => {
        scene.pullLever();
        narratorRef.current?.trigger('breaker:thrown');
      },
      narrator: narratorRef.current,
      trigger: (ev: string) => narratorRef.current?.trigger(ev),
      sayLine: (id: string) => narratorRef.current?.say(id),
      replay: (id: string) => narratorRef.current?.replay(id),
      subtitles: () => narratorRef.current?.getActiveSubtitle(),
      heard: () => narratorRef.current?.getState().heard ?? [],
      initAudio: () => initNarratorAudio(),
      go: (where: 'lab' | 'planet', x: number, z: number, yaw: number, pitch?: number) => scene.debug.teleport(where, x, z, yaw, pitch),
      // read-only pose for the Planetary Grid's spawn check (test-grid-menus): the player's ground x and z, and the facing
      pose: () => { const p = scene.debug.position(); return { x: p.x, z: p.z, yaw: scene.debug.facing() }; },
      gateExit: () => scene.gateExit(),
      setBeamHeld: (held: boolean, mode: BeamMode = 'extract') => setBeamHeld(held, mode),
      setBeamFiring: (on: boolean) => {
        forceBeamFiringRef.current = on;
        scene.setBeamFiring(on);
      },
      // the frame loop sets the seal every frame from the leak under the beam, so the hook holds it (as setBeamFiring does)
      setBeamSealing: (on: boolean) => {
        forceBeamSealingRef.current = on;
        scene.setBeamSealing(on);
      },
      anchors: () => scene.debug.machineAnchors(),
      hideOverlays: (hide: boolean) => setHideOverlays(hide),
      lockAim: () => ({ locked: scene.ghostLocked(), aim: scene.aimPoint() }),
      gate: () => scene.debug.gatePlanet(),
      showGround: (on: boolean) => scene.debug.showGround(on),
      placeAt: (x: number, z: number, kind: MachineKind = 'mill') => { const g = scene.debug.gatePlanet(); return tryPlace(kind, x, z, Math.atan2(x - g.x, z - g.z)); },
      plot: () => (visitingRef.current ? visitingRef.current.plot : plotRef.current),
      give: (ore: number) => { plotRef.current = { ...plotRef.current, ore: plotRef.current.ore + ore }; },
      /** TASK-26: the sync set (a check hook), and the planet's dome state now. */
      setSync: (v: number) => scene.debug.setSync(v),
      /** The four floats as a fraction of their targets (the e2e check of the suit cam's Lx ramp). Stage is not changed here. */
      setFloats: (fraction: number) => {
        const f = Math.max(0, Math.min(1, fraction));
        plotRef.current = { ...plotRef.current, points: { pxd: TARGET.pxd * f, vtx: TARGET.vtx * f, lx: TARGET.lx * f, aq: TARGET.aq * f } };
        const env = envRef.current, sc = sceneRef.current;
        if (env && sc) sc.setPlot(plotRef.current, running(plotRef.current, env), network(plotRef.current, env).connected);
      },
      setStage: (stage: number) => {
        plotRef.current = { ...plotRef.current, stage };
        scene.raiseStage(stage, scene.debug.gatePlanet());
        syncAmbience(undefined, stage);
        // the stage-up lines a real stage change plays (the plot's own stage-up event is not raised by this skip)
        triggerStageLine(stage);
        if (stage === 4) narratorRef.current?.trigger('fab:hauler');
        if (stage === 6) narratorRef.current?.trigger('fab:crawler');
        updateChain((c) => c);
      },
      setFidelityStage: (stage: number) => {
        plotRef.current = { ...plotRef.current, stage };
        scene.setFidelityStage(stage);
        syncAmbience(undefined, stage);
      },
      biomeCounts: () => scene.getBiomeCounts(),
      setVegetationSetting: (v: 'auto' | 'off' | 'low' | 'high') => scene.setVegetationSetting(v),
      drain: () => {
        plotRef.current = { ...plotRef.current, ore: 0 };
        setHud((h) => ({ ...h, plot: { ...h.plot, ore: 0 } }));
      },
      gather: (seconds = 1) => {
        const amount = seconds * 3;
        const gathered = scene.debug.gather(amount);
        if (gathered > 0) {
          plotRef.current = { ...plotRef.current, ore: Math.min(1e5, plotRef.current.ore + gathered) };
          if (scene.getCameraView() === 'third') scene.playAction('plant');
          if (!firstGatherRef.current) {
            firstGatherRef.current = true;
            say('Ore gathered by hand.', 'A rock drill mines it for you.');
          }
        }
        return gathered;
      },
      boulder: () => scene.debug.aimedBoulder(),
      boulders: () => scene.debug.boulders(),
      machines: () => scene.debug.machines(),
      state: () => stateRef.current,
      chain: () => chainView(stateRef.current.chain),
      chainState: () => stateRef.current.chain,
      // a test opens a lab panel (the click on its button is the real action); and skips grinding only (mining 50 units)
      openLabPanel: (kind: LabMachineKind | null) => setLabPanel(kind),
      grindCount: (key: string, n: number) => updateChain((c) => bump(c, key, n)),
      die: () => dieNow(),
      detail: () => scene.debug.detail(),
      raise: (to: number) => scene.raiseStage(to, scene.debug.gatePlanet()),
      twinStage: () => scene.debug.twinStage(),
      plumeGlowCount: () => scene.debug.plumeGlowCount(),
      setPlumeGlow: (on: boolean) => scene.setDetail({ ...scene.debug.detail(), plumeGlow: on }),
      pixelLightCount: () => scene.debug.pixelLightCount(),
      setPixelLights: (on: boolean) => scene.setDetail({ ...scene.debug.detail(), pixelLights: on }),
      holo: () => scene.debug.holo(),
      lab: () => labRef.current,
      labStep: (seconds: number) => {
        const lEnv: LabEnv = { presets: VAULT, stage: plotRef.current.stage, powered: stateRef.current.gateOn };
        const res = stepCartlab(labRef.current, lEnv, seconds);
        labRef.current = res.state;
        commit(withLab(withPlot(stateRef.current, plotRef.current), res.state));
        return res;
      },
      makeBlank: () => {
        const res = makeBlank(labRef.current, plotRef.current.ore);
        labRef.current = res.state;
        plotRef.current = { ...plotRef.current, ore: plotRef.current.ore - res.oreUsed };
        commit(withLab(withPlot(stateRef.current, plotRef.current), res.state));
        return res;
      },
      startWrite: (blankId: string, presetId: string) => {
        const lEnv: LabEnv = { presets: VAULT, stage: plotRef.current.stage, powered: stateRef.current.gateOn };
        const next = startWrite(labRef.current, lEnv, blankId, presetId);
        labRef.current = next;
        commit(withLab(withPlot(stateRef.current, plotRef.current), next));
        return next;
      },
      rates: () => (envRef.current ? rates(visitingRef.current ? visitingRef.current.plot : plotRef.current, envRef.current) : null),
      plotCode: () => {
        const g = envRef.current?.gate ?? scene.debug.gatePlanet();
        const r = encodePlot(stateRef.current, g);
        return r.ok ? r.code : null;
      },
      openDial: () => { openDialRef.current?.(); },
      dial: (code: string) => (dialRef.current ? dialRef.current(code).ok : false),
      visiting: () => (visitingRef.current ? visitingRef.current.snapshot.owner : null),
      view: () => scene.debug.view(),
      toggleView: () => {
        const next = scene.debug.view() === 'first' ? 'third' : 'first';
        scene.setCameraView(next);
        saveProfile({ ...props.profile, cameraView: next });
        return next;
      },
      clipWeight: (name: ClipName) => scene.debug.clipWeight(name),
      currentOneShot: () => scene.debug.currentOneShot(),
      animator: () => scene.debug.animator(),
      playAction: (kind: OneShotKind) => scene.playAction(kind),
      teleport: (where: 'lab' | 'planet', x: number, z: number, y: number, p?: number) => scene.debug.teleport(where, x, z, y, p),
      setAltCam: (eye: { x: number; y: number; z: number }, p: number, y: number) => scene.debug.setAltCam(eye, p, y),
      clearAltCam: () => scene.debug.clearAltCam(),
      gamePreset: () => props.gamePreset ?? null,
      gameProgress: () => gameProgressRef.current,
      monsters: () => scene.monsters,
      equipShotgun: (on = true) => { scene.monsters.equip(on); setGunEquipped(on); },
      fireShotgun: () => fireWeapon(),
      setPaused: (p: boolean) => setPaused(p),
      isPaused: () => pausedRef.current,
      setLocked: (l: boolean) => setLocked(l),
      clearToast: () => setToast(null),
      base: {
        world: () => baseWorldRef.current,
        /** The kind the held blueprint builds next (the ghost's kind; the X radial and Q set it). */
        buildKind: () => buildKindRef.current,
        apply: (cmd: BaseCommand) => dispatchBaseRef.current(cmd),
        openMachinePicker: (hardpointId: number) => {
          setMachinePickerHardpoint(hardpointId);
          freeMouse();
        },
        openRefinery: (machineId: number) => {
          setRefineryMachineId(machineId);
          freeMouse();
        },
        startBeam: (nodeId: number) => {
          forceBeamRef.current = nodeId;
        },
        stopBeam: () => {
          forceBeamRef.current = null;
        },
        toggleIntegrity: (force?: boolean) => {
          const vs = baseViewSource as WorldViewSource;
          const cur = vs.get?.()?.build?.integrity ?? false;
          const next = force !== undefined ? force : !cur;
          if (cur !== next) {
            vs.actions?.toggleIntegrity();
          }
          const bEnv = getBaseEnv();
          pieceManagerRef.current.sync(baseWorldRef.current, bEnv, next);
          return next;
        },
        save: () => persistBaseWorld(true),
        /** TASK-26: the legs a placed foundation needs, each foot on the terrain (planFrameLegs, the same numbers the frame is drawn with). */
        frameLegs: (pieceId: number) => {
          const w = baseWorldRef.current;
          const piece = w.base.pieces.find((p) => p.id === pieceId);
          const st = piece ? w.base.structures.find((s) => s.id === piece.s) : undefined;
          const at = piece ? pieceAt(w.base, piece) : null;
          if (!piece || !st || !at) return null;
          const env = getBaseEnv();
          return planFrameLegs(at, -st.yaw, (x, z) => env.heightAt(x, z));
        },
        load: () => {
          baseWorldRef.current = initBaseWorld();
          scene.setBase(baseWorldRef.current.base);
          pieceManagerRef.current.sync(baseWorldRef.current, getBaseEnv(), false);
          scene.setWalkWorld(pieceManagerRef.current.walkWorld);
          scene.setVehicles(baseWorldRef.current.vehicles);
          const fabs = baseWorldRef.current.machines.filter((m) => m.kind === 'fabricator').map((m) => {
            const hp = baseWorldRef.current.base.pieces.find((p) => p.id === m.id);
            const pt = hp ? pieceAt(baseWorldRef.current.base, hp) : null;
            return {
              id: m.id,
              x: pt?.x ?? 0,
              z: pt?.z ?? 0,
              yaw: 0,
              printing: m.jobs.length > 0,
            };
          });
          scene.setFabricators(fabs);
          scene.monsters.setWeaponStats(devWeaponRef.current ?? weaponStats(baseWorldRef.current.loadout));
        },
        enterVehicle: (id: number) => scene.enterVehicle(id),
        /** Boards through the real bind path (plan 47): rifle harness binds, a saved soul wakes, else the default. */
        boardVehicle: (id: number) => {
          const v = baseWorldRef.current.vehicles.find((x) => x.id === id);
          return v ? boardVehicle(v.id, v.kind) : false;
        },
        exitVehicle: () => {
          const parked = scene.exitVehicle();
          if (parked) {
            dispatchBaseRef.current({ t: 'park', vehicle: parked.id, x: parked.x, z: parked.z, yaw: parked.yaw });
            setDrivingSpeed(null);
          }
          return parked;
        },
        driving: () => scene.getDrivingVehicle(),
        openFabricator: (id: number) => { setFabricatorMachineId(id); document.exitPointerLock?.(); },
        openWeaponBench: () => { setWeaponBenchOpen(true); document.exitPointerLock?.(); },
        placeShelter: (cx: number, cz: number, yaw: number) => {
          return dispatchBaseRef.current({ t: 'shelter', cx, cz, yaw });
        },
        placeLifeSupport: (structureId?: number) => {
          const w = baseWorldRef.current;
          const sId = structureId ?? w.base.structures[0]?.id;
          if (sId === undefined) return null;
          const bEnv = getBaseEnv();
          const r = S.place(w.base, structureEnv(bEnv), {
            s: sId,
            kind: 'lifeSupport',
            i: 0,
            j: 0,
            k: 0,
            r: 0,
            dx: -130,
            dz: 100,
            deg: 0,
            mat: 'regolith',
          });
          if (r.ok) {
            baseWorldRef.current = { ...w, base: r.base };
            pieceManagerRef.current.sync(baseWorldRef.current, bEnv, false);
            scene.setWalkWorld(pieceManagerRef.current.walkWorld);
            persistBaseWorld(true);
            return r.id;
          }
          return null;
        },
        setBase: (base: S.Base) => {
          baseWorldRef.current = { ...baseWorldRef.current, base };
          const bEnv = getBaseEnv();
          const integrity = (baseViewSource as WorldViewSource).get?.()?.build?.integrity ?? false;
          pieceManagerRef.current.sync(baseWorldRef.current, bEnv, integrity);
          scene.setBase(baseWorldRef.current.base);
          scene.setWalkWorld(pieceManagerRef.current.walkWorld);
          persistBaseWorld(true);
          (baseViewSource as WorldViewSource).notify?.();
          setBaseWorldVersion((v) => v + 1);
        },
        createSampleLayoutCode: () => {
          const bEnv = getBaseEnv();
          const f = S.found(S.empty(), structureEnv(bEnv), 0, 0, 0, 'regolith');
          if (!f.ok) return '';
          const s = f.base.pieces[0]!.s;
          const p = S.place(f.base, structureEnv(bEnv), { s, kind: 'floor', i: 1, j: 0, k: 0, r: 0, mat: 'regolith' });
          return S.encode(p.ok ? p.base : f.base);
        },
        setBuildKind: (kind: Kind) => { buildKindRef.current = kind; },
        hideOverlays: (hide: boolean) => setHideOverlays(hide),
      },
      teleportPlanet: () => { const exit = scene.gateExit(); scene.debug.teleport('planet', exit.x, exit.z, exit.yaw); },
      renderCalls: () => scene.debug.stats().calls,
      drawCalls: () => scene.debug.stats().calls,
      batcherDrawCalls: () => pieceManagerRef.current.batcherDrawCalls,
    });
    if (typeof window !== 'undefined') {
      (window as unknown as { __hm?: unknown }).__hm = {
        setPaused: (p: boolean) => setPaused(p),
        isPaused: () => pausedRef.current,
        setLocked: (l: boolean) => setLocked(l),
        clearToast: () => setToast(null),
        hideOverlays: (hide: boolean) => setHideOverlays(hide),
        base: (window as any).hmPlay?.base,
        renderCalls: () => scene.debug.stats().calls,
        drawCalls: () => scene.debug.stats().calls,
        batcherDrawCalls: () => pieceManagerRef.current.batcherDrawCalls,
      };
    }
    setLoading(steps[0]![0]);
    timer = window.setTimeout(step, 30);
    // The narrator's voice chain needs a user gesture (the browser's autoplay rule). It was only set up when the radio
    // log opened, so in normal play the lines showed as subtitles with no voice (the owner's report, 2026-10-12):
    // set it up on the first click or key press in the game instead.
    const firstGesture = (): void => { initNarratorAudio(); };
    window.addEventListener('pointerdown', firstGesture, { once: true });
    window.addEventListener('keydown', firstGesture, { once: true });
    return () => {
      cancelled = true;
      window.removeEventListener('pointerdown', firstGesture);
      window.removeEventListener('keydown', firstGesture);
      // leave the game silent: the audio controller outlives this screen (the music played on in the menu)
      narratorRef.current?.stopAll();
      gameAudio.stopAll();
      delete (window as unknown as { hmPlay?: unknown }).hmPlay;
      delete (window as unknown as { __hm?: unknown }).__hm;
      window.clearTimeout(timer);
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', size);
      window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); window.removeEventListener('mousemove', onMove);
      window.removeEventListener('pagehide', flushOnHide);
      window.removeEventListener('mousedown', onMouseDown); window.removeEventListener('mouseup', onMouseUp);
      sceneRef.current = null;
      scene.dispose();
    };
  }, [tier, reduced, props.profile.gpu, props.profile.graphics, props.profile.quality, props.profile.fpsTarget, commit, say]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !ready) return;
    return bindSporeCardDrop(canvas.closest<HTMLElement>('.play') ?? canvas, {
      onCard: async (card, isCurrent) => {
        if (card.creation.kind === 'game') {
          const preset = assertPlayablePreset(card.creation.spec);
          if (!props.onGamePreset) throw new Error('Game preset switching is unavailable');
          props.onGamePreset(preset);
        } else {
          const scene = sceneRef.current;
          if (!scene) throw new Error('The world is not ready');
          await scene.loadSporeCreation(card.creation, isCurrent);
          say(`Loaded ${card.title}`, `Spore Card by ${card.author} · schema and audit verified`);
        }
      },
      onRefusal: ({ title, detail }) => say(title, detail),
    });
  }, [ready, props.onGamePreset, say]);

  // ---- pointer lock: click to look round; losing it (Esc) pauses
  useEffect(() => {
    const onLock = (): void => {
      const on = document.pointerLockElement === canvasRef.current;
      setLocked(on);
      if (!on && ready && !creating && !quietRef.current) setPaused(true);
      quietRef.current = false;
    };
    document.addEventListener('pointerlockchange', onLock);
    return () => document.removeEventListener('pointerlockchange', onLock);
  }, [ready, creating]);
  // TASK-28 (P1-HOUR-03): the wake starts once the player has control of the lab (the loading bar is gone and the creator is closed)
  const wokeRef = useRef(false);
  useEffect(() => {
    if (props.gamePreset || !ready || creating || wokeRef.current || !sceneRef.current) return;
    wokeRef.current = true;
    sceneRef.current.debug.startWake();
  }, [ready, creating]);
  const lock = useCallback(() => {
    setPaused(false);
    if (canvasRef.current) captureMouse(canvasRef.current);
  }, []);

  // ---- the keys that do things: E uses, B builds, Esc steps back
  const placeNow = useCallback(() => {
    const at = sceneRef.current?.aim();
    if (!at || !building) return;
    if (!placeRef.current?.(building, at.x, at.z, at.yaw)) return;
    // build mode stays on after a placement (TICKET-04): the next machine goes down without reopening B; Esc, right mouse or B ends it
    const name = KINDS[building].name;
    say(`${name} built`, KINDS[building].emits ? 'Watch its pixels pour while it runs.' : BLURB[building]);
  }, [building, say]);
  const stopBuilding = useCallback(() => { setBuilding(null); sceneRef.current?.setBuilding(null); }, []);
  /** Frees the mouse for a menu without pausing the game. */
  const freeMouse = useCallback(() => { if (document.pointerLockElement) { quietRef.current = true; document.exitPointerLock(); } }, []);
  /**
   * What the X radial offers now (TICKET-04): the rifle's cartridges in Apply or its sculpt tools in Sculpt, else the kinds of the
   * blueprint in the hotbar's hand. Null when X has nothing to offer.
   */
  const radialFromContext = (): RadialSpec | null => {
    const mode = beamHeldRef.current ? beamModeRef.current : null;
    if (mode === 'apply') {
      const lab = labRef.current;
      const inJob = new Set<string>([...(lab.bench?.inputs ?? []), ...(lab.combiner?.inputs ?? [])]);
      const items: RadialItem[] = [];
      for (const c of lab.cartridges) {
        if (c.slot !== null || inJob.has(c.id)) continue;
        const look = rifleLook(c);
        if (!look) continue;
        const item = look.print ? `cartridge:${printKind(look.print)}` : `cartridge:${c.preset}`;
        items.push({ id: c.id, label: c.name, ref: { item, tint: look.colour }, locked: null });
      }
      const empty = items.length === 0;
      if (empty) {
        return {
          hint: 'Beam port',
          items: [],
          emptyState: 'No written cartridges: write one at the preset bench',
          pick: () => {},
        };
      }
      // a radial with one slice is half a wheel: a locked slice fills the other half
      while (items.length < 2) {
        items.push({
          id: `pad-${items.length}`,
          label: 'Free slot',
          ref: null,
          locked: 'Write another cartridge to fill this slot',
        });
      }
      return {
        hint: 'Beam port',
        items,
        pick: (id) => {
          const cart = labRef.current.cartridges.find((c) => c.id === id);
          if (cart) loadBeamCartridge(cart);
        },
      };
    }
    if (mode === 'sculpt') {
      return {
        hint: 'Sculpt tool',
        items: SCULPT_TOOLS.map((t) => ({ id: t, label: SCULPT_LABEL[t], ref: null, locked: null })),
        pick: (id) => {
          const tool = id as SculptTool;
          chooseSculptTool(tool);
          say(`Sculpt: ${SCULPT_LABEL[tool]}`);
        },
      };
    }
    // the rifle in Extract has no radial of its own: X then offers the held blueprint, if there is one
    const bw = baseWorldRef.current;
    const slot = bw.player.slots[bw.hotbar];
    if (!slot || slot.n <= 0) return null;
    const bp = blueprint(slot.item);
    if (!bp) return null;
    const chain = stateRef.current.chain;
    const stage = plotRef.current.stage;
    return {
      hint: bp.name,
      items: bp.kinds.map((k) => ({
        id: k,
        label: KIND_LABEL[k] ?? k,
        ref: { kind: k },
        locked: featureLock(k === 'weaponBench' ? 'weaponBench' : 'structures', chain, stage),
      })),
      pick: (id) => {
        buildKindRef.current = id as Kind;
        (baseViewSource as WorldViewSource).notify?.();
        say(`Selected: ${KIND_LABEL[id] ?? id}`);
      },
    };
  };
  const openRadial = (): void => {
    if (radial !== null || isAnyBaseWindowOpen || paused || visitingRef.current || building !== null || placingLayoutRef.current !== null) return;
    if (panel !== null || labPanel !== null || dialOpen || debugOpen) return;
    const spec = radialFromContext();
    if (spec === null) return;
    setRadialThumbs([]);
    setRadial(spec);
    freeMouse();
  };
  const closeRadial = (): void => { setRadial(null); lock(); };
  /** Z (TICKET-04): hold for half a second on the aimed piece to remove it. A tap removes nothing; the timer re-checks the aim. */
  const startRemoveHold = (): void => {
    if (removeHoldRef.current !== null || visitingRef.current || isAnyBaseWindowOpen || radial !== null) return;
    const hit = sceneRef.current?.aimPoint();
    if (!hit || hit.piece === null) {
      say('Nothing aimed to remove', 'Aim at a piece you placed, then hold Z.');
      return;
    }
    const target = hit.piece;
    setRemoveHolding(true);
    removeHoldRef.current = window.setTimeout(() => {
      removeHoldRef.current = null;
      setRemoveHolding(false);
      const now = sceneRef.current?.aimPoint();
      if (!now || now.piece !== target) {
        say('Aim moved', 'Hold Z again on the piece.');
        return;
      }
      dispatchBase({ t: 'remove', at: { x: now.x, z: now.z }, id: target });
    }, REMOVE_HOLD_MS);
  };
  const cancelRemoveHold = (): void => {
    if (removeHoldRef.current !== null) {
      window.clearTimeout(removeHoldRef.current);
      removeHoldRef.current = null;
      say('Hold Z to remove', 'Keep Z down for half a second on the piece.');
    }
    setRemoveHolding(false);
  };
  const openDial = useCallback(() => {
    sceneRef.current?.playAction('button');
    // the panel's iris state mirrors the world's (the world is the truth: the room, a save and a session all write it)
    const access = baseWorldRef.current.gateAccess;
    if (isGateAccessMode(access)) setGateAccess(access);
    setRandomError(null);
    setDialOpen(true);
    freeMouse();
  }, [freeMouse]);
  openDialRef.current = openDial;
  /** Changes the plot from a menu: the plot, the save and the scene follow at once. */
  const changePlot = useCallback((next: PlotState) => {
    const env = envRef.current;
    plotRef.current = next;
    commit(withLab(withPlot(stateRef.current, next), labRef.current));
    if (env) sceneRef.current?.setPlot(next, running(next, env), network(next, env).connected);
  }, [commit]);
  /** Closes the machine inspector and takes the mouse back, as the other panels do. */
  const closeInspect = useCallback(() => { setInspect(null); lock(); }, [lock]);
  /** The inspector's buttons. Refinery, fabricator and the plot panel take over (the inspector closes first); toggle switches a plot machine. */
  const inspectAction = useCallback((target: { readonly src: 'base' | 'plot'; readonly id: number }, a: InspectAction): void => {
    if (a === 'refine') { setInspect(null); setRefineryMachineId(target.id); freeMouse(); return; }
    if (a === 'fabricate') { setInspect(null); setFabricatorMachineId(target.id); freeMouse(); return; }
    if (a === 'controls') { setInspect(null); setPanel(target.id); setMenu(false); freeMouse(); return; }
    if (a === 'toggle' && target.src === 'plot') {
      if (visitingRef.current) { say('Not your machine', 'You cannot switch the machines of a plot you are visiting.'); return; }
      const mm = plotRef.current.machines.find((x) => x.id === target.id);
      if (mm) changePlot(setOn(plotRef.current, mm.id, !mm.on));
    }
  }, [changePlot, freeMouse, say]);
  // the inspector's live numbers refresh while it is open; it closes itself if its machine is taken down
  useEffect(() => {
    if (inspect === null) return;
    const t = window.setInterval(() => {
      const machines = inspect.src === 'plot'
        ? (visitingRef.current ? visitingRef.current.plot : plotRef.current).machines
        : baseWorldRef.current.machines;
      if (machines.some((m) => m.id === inspect.id)) setInspectTick((n) => n + 1);
      else setInspect(null);
    }, 400);
    return () => window.clearInterval(t);
  }, [inspect]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (!ready || creating) return;
      // TICKET-14: while the credits play, their own listener takes Esc (it ends them); the old monitor's jukebox closes on Esc
      if (creditsRef.current) return;
      if (jukeboxRef.current) {
        if (e.code === 'Escape') setJukeboxOpen(false);
        return;
      }
      if (e.code === 'KeyJ' && hud.aimedProp?.id === 'old-monitor' && liveWhereRef.current === 'lab') {
        prepareCredits();
        setJukeboxOpen(true);
        document.exitPointerLock?.();
        return;
      }
      if (e.code === 'Escape') {
        // the debug menu closes first, back to the pause menu it opened from
        if (debugOpen) { setDebugOpen(false); return; }
        if (placingLayoutId !== null) {
          setPlacingLayoutId(null);
          sceneRef.current?.setPlanGhosts([]);
          say('Cancelled layout placement');
          return;
        }
        if (machinePickerHardpoint !== null) { setMachinePickerHardpoint(null); return; }
        if (refineryMachineId !== null) { setRefineryMachineId(null); return; }
        // Esc releases a locked hologram first, then ends a placement session, then the build itself (TASK-25)
        if (sceneRef.current?.ghostLocked()) { sceneRef.current.releaseGhost(); say('Hologram released'); return; }
        if (pieceSessionRef.current) { pieceSessionRef.current = false; return; }
        if (building) { stopBuilding(); return; }
        if (menu) { setMenu(false); return; }
        if (planetTableOpen) { setPlanetTableOpen(false); return; }
        if (fabricatorMachineId !== null) { setFabricatorMachineId(null); return; }
        if (weaponBenchOpen) { setWeaponBenchOpen(false); return; }
        if (dialOpen) { setDialOpen(false); return; }
        if (panel !== null) { setPanel(null); return; }
        if (labPanel !== null) { setLabPanel(null); return; }
        if (!locked) setPaused((p) => !p);
        return;
      }
      if (paused) return;
      // the X radial takes the keys while it is open: its own Esc and the X release close it (TICKET-04)
      if (radial !== null) return;
      if (e.code === 'KeyF') {
        if (nearestPlanRef.current && sceneRef.current) {
          const playerPos = sceneRef.current.debug.position();
          dispatchBase({
            t: 'fill',
            at: { x: playerPos.x, z: playerPos.z },
            plan: nearestPlanRef.current.id,
          });
          return;
        }
      }
      // TICKET-14: R at the old monitor plays the overclocked track through its speaker (the equaliser lights up)
      if (e.code === 'KeyR' && hud.aimedProp?.id === 'old-monitor' && liveWhereRef.current === 'lab' && !beamHeldRef.current && !sceneRef.current?.monsters.isEquipped()) {
        toggleMonitorOverclocked();
        return;
      }
      if (e.code === 'KeyR') {
        if (beamHeldRef.current) {
          if (beamModeRef.current === 'sculpt') {
            const nextTool = cycleSculptTool(sculptToolRef.current, 1);
            chooseSculptTool(nextTool);
            say(`Sculpt: ${SCULPT_LABEL[nextTool]}`);
            return;
          }
          if (beamModeRef.current === 'apply') {
            cycleBeamCartridge(1);
            return;
          }
          reloadBeam();
          return;
        }
        // the gun in hand reloads its magazine (a full magazine is the loadout's; a reload is a player's action, not a tick)
        const gunScene = sceneRef.current;
        if (gunScene?.monsters.isEquipped()) {
          gunScene.monsters.reload();
          setGunAmmo(gunScene.monsters.getAmmo());
          say(`Magazine ${gunScene.monsters.getAmmo().current} of ${gunScene.monsters.getAmmo().max}`);
          return;
        }
        if (placingLayoutId !== null) {
          placingLayoutRotationRef.current = (placingLayoutRotationRef.current + 1) % 4;
          say(`Layout Rotation: ${placingLayoutRotationRef.current * 90}°`);
          return;
        }
        buildRotationRef.current = (buildRotationRef.current + 1) % 4;
        say(`Rotation: ${buildRotationRef.current * 90}°`);
        (baseViewSource as WorldViewSource).notify?.();
        return;
      }
      if (e.code === 'KeyQ' && beamHeldRef.current) {
        const mode = cycleBeamMode(beamModeRef.current, 1);
        setBeamHeld(true, mode);
        say(`Beam: ${BEAM_LABEL[mode]}`);
        return;
      }
      if (e.code === 'KeyQ') {
        const w = baseWorldRef.current;
        const slot = w.player.slots[w.hotbar];
        if (slot && slot.n > 0) {
          const bp = blueprint(slot.item);
          if (bp && bp.kinds.length > 1) {
            const curKind = buildKindRef.current ?? bp.kinds[0]!;
            const curIdx = bp.kinds.indexOf(curKind);
            const prevIdx = (curIdx - 1 + bp.kinds.length) % bp.kinds.length;
            buildKindRef.current = bp.kinds[prevIdx]!;
            (baseViewSource as WorldViewSource).notify?.();
            say(`Selected: ${buildKindRef.current.toUpperCase()}`);
            return;
          }
        }
      }
      // X opens the radial wheel for what you hold; releasing X or clicking picks (RadialMenu). Z is the remove (below).
      if (e.code === 'KeyX') {
        if (!e.repeat) openRadial();
        return;
      }
      if (e.code === 'KeyZ') {
        if (!e.repeat) startRemoveHold();
        return;
      }
      // Plan 48 (owner feedback): T is the companion's hold-to-talk radio now, so the
      // structural-integrity overlay moved to I. CompanionChat owns the T listener.
      if (e.code === 'KeyI') {
        const vs = baseViewSource as WorldViewSource;
        const cur = vs.get?.()?.build?.integrity ?? false;
        const next = !cur;
        vs.actions?.toggleIntegrity();
        const bEnv = getBaseEnv();
        pieceManagerRef.current.sync(baseWorldRef.current, bEnv, next);
        say(next ? 'Structural Integrity: ON' : 'Structural Integrity: OFF');
        return;
      }
      if (e.code === 'KeyV') {
        if (liveWhereRef.current === 'planet') {
          sceneRef.current?.triggerTurboBass();
        }
        const current = sceneRef.current?.getCameraView() ?? 'first';
        const next = current === 'first' ? 'third' : 'first';
        sceneRef.current?.setCameraView(next);
        saveProfile({ ...props.profile, cameraView: next });
        say(next === 'third' ? 'Third-person view' : 'First-person view');
        return;
      }
      // the armory's sidearm (TICKET-07 Item D): a tap on E at the rail takes it
      if (e.code === 'KeyE' && hud.atArmory && hud.aimedLab === null && !hud.atLever && !hud.atDial) {
        takeSidearmRef.current();
        return;
      }
      // a lore prop (TASK-23c): a tap on E reads a fixture's or a transponder's log; a salvage prop is held, never tapped
      if (e.code === 'KeyE' && hud.aimedProp && aimedPropActs(hud.aimedProp, liveWhereRef.current) && hud.aimed === null && !hud.atLever && !hud.atDial) {
        if (!hud.aimedProp.salvage) {
          const tapeId = sceneRef.current?.collectWreckTape(hud.aimedProp.id) ?? null;
          if (tapeId) {
            const tape = COLLECTIBLE_MUSIC_TAPES.find((t) => t.id === tapeId) ?? null;
            setCollectedTapes((prev) => (prev.includes(tapeId) ? prev : [...prev, tapeId]));
            if (tape) say('Cassette Tape Recovered', `${tape.title} (${tape.frequencyMhz}) added to Field Radio.`);
          }
          const entry = loreFor(hud.aimedProp.id);
          if (entry) openLog(entry.log);
        }
        return;
      }
      // Planet Table consensus commit (TICKET-16, A9-02)
      if (e.code === 'KeyE' && liveWhereRef.current === 'lab' && hud.aimedLab === 'planet-table') {
        const localS = {
          Pxd: stateRef.current.plot.points.pxd,
          Vtx: stateRef.current.plot.points.vtx,
          Lx: stateRef.current.plot.points.lx,
          Aq: stateRef.current.plot.points.aq,
        };
        const consensus = evaluateContinentalConsensus(localS);
        if (consensus.isReadyToCommit || stepDone(stateRef.current.chain, 'A9-01')) {
          updateChain((c) => bump(c, COUNT.consensusCommitted, 1));
          say('Consensus Committed', `Continental consensus reached (${consensus.consensusPct.toFixed(0)}%). Committing Sector 04 branch...`);
          narratorRef.current?.trigger('act9:consensus-commit');
          if (!finaleRef.current?.active) {
            finaleRef.current = {
              active: true,
              startWallMs: performance.now(),
              voiceTriggered: false,
              done: false,
            };
          }
          return;
        }
      }
      if (e.code === 'KeyE') {
        const driving = sceneRef.current?.getDrivingVehicle();
        if (driving) {
          const parked = sceneRef.current?.exitVehicle();
          if (parked) {
            dispatchBase({ t: 'park', vehicle: parked.id, x: parked.x, z: parked.z, yaw: parked.yaw });
            setDrivingSpeed(null);
            say('Vehicle parked.');
          }
          return;
        }
        const nearV = sceneRef.current?.getNearVehicle(3.5);
        if (nearV) {
          boardVehicle(nearV.id, nearV.kind);
          return;
        }
        // Build mode (a blueprint in the active hotbar slot): E places the piece, so nothing aimed is used or toggled.
        const bw = baseWorldRef.current;
        const heldSlot = bw.player.slots[bw.hotbar];
        const buildMode = !!heldSlot && heldSlot.n > 0 && blueprint(heldSlot.item) !== null;
        const hit = buildMode ? null : sceneRef.current?.aimPoint();
        if (hit && hit.piece !== null) {
          const p = baseWorldRef.current.base.pieces.find((q) => q.id === hit.piece);
          if (p && (p.kind === 'airlock' || p.kind === 'door')) {
            dispatchBase({ t: 'door', id: p.id, open: !p.open });
            return;
          }
          if (p && p.kind === 'bin') {
            (window as unknown as { __hmHud?: { openLattice?: () => void } }).__hmHud?.openLattice?.();
            freeMouse();
            return;
          }
          if (p && p.kind === 'weaponBench') {
            setWeaponBenchOpen(true);
            freeMouse();
            return;
          }
          // E on a bench opens the Drafting Table through the same lock as K (TICKET-03, BB-11)
          if (p && p.kind === 'bench') {
            const why = featureLock('drafting', stateRef.current.chain, plotRef.current.stage);
            if (why) { say('Drafting table locked', why); return; }
            (window as unknown as { __hmHud?: { openDrafting?: () => void } }).__hmHud?.openDrafting?.();
            freeMouse();
            return;
          }
          if (p && p.kind === 'hardpoint') {
            const m = baseWorldRef.current.machines.find((x) => x.id === p.id);
            if (!m) {
              setMachinePickerHardpoint(p.id);
              freeMouse();
              return;
            }
            // every placed machine opens the inspector; its refine and fabricate buttons open the windows (TICKET-03, BB-10)
            setInspect({ src: 'base', id: m.id });
            freeMouse();
            return;
          }
        }
        if (tryPlaceBase()) return;
        if (building) placeNow();
        else if (hud.atLever) {
          sceneRef.current?.pullLever();
          narratorRef.current?.trigger('breaker:thrown');
        } else if (hud.atDial && !dialOpen) {
          sceneRef.current?.playAction('button');
          narratorRef.current?.trigger('gate:lever');
          narratorRef.current?.trigger('gate:open');
          setDialOpen(true);
          freeMouse();
        } else if (liveWhereRef.current === 'planet' && hud.aimed !== null && panel === null) {
          sceneRef.current?.playAction('button');
          const isBaseMach = baseWorldRef.current.machines.some((m) => m.id === hud.aimed);
          setInspect({ src: isBaseMach ? 'base' : 'plot', id: hud.aimed });
          setMenu(false);
          freeMouse();
        } else if (liveWhereRef.current === 'lab' && hud.aimedLab !== null && labPanel === null && fabricatorMachineId === null && !planetTableOpen && !weaponBenchOpen) {
          sceneRef.current?.playAction('button');
          if (hud.aimedLab === 'fabricator') {
            setFabricatorMachineId(9999);
            freeMouse();
          } else if (hud.aimedLab === 'planet-table') {
            setPlanetTableOpen(true);
            freeMouse();
          } else if (hud.aimedLab === 'weapon-bench') {
            setWeaponBenchOpen(true);
            freeMouse();
          } else {
            const p = hud.aimedLab === 'preset-rack' ? 'rack' : hud.aimedLab === 'preset-bench' ? 'bench' : hud.aimedLab === 'preset-combiner' ? 'combiner' : hud.aimedLab;
            setLabPanel(p);
            freeMouse();
          }
        }
      }
      if (e.code === 'KeyG') {
        // The extraction rifle (TASK-21): out in hand on the planet; racked on the lab wall until its place in the story.
        const rifleLock = featureLock('rifle', stateRef.current.chain, plotRef.current.stage);
        if (rifleLock) { say('The beam is on the armory rack', rifleLock); return; }
        if (liveWhereRef.current !== 'planet') {
          say('The beam stays racked on the lab wall', 'It comes down to the planet later.');
          return;
        }
        const held = !beamHeldRef.current;
        setBeamHeld(held, beamModeRef.current);
        say(held ? `Extraction beam: ${BEAM_LABEL[beamModeRef.current]}` : 'Extraction beam put away', held ? 'Q or the wheel cycles Extract, Apply and Sculpt.' : undefined);
        return;
      }
      // H locks the hologram (P2-UI-06): the ghost stays where it is, the arrows nudge it 0.5 m, H or Esc releases it
      if (e.code === 'KeyH' && (building !== null || placingLayoutRef.current !== null || pieceSessionRef.current)) {
        const scene = sceneRef.current;
        if (scene?.ghostLocked()) { scene.releaseGhost(); say('Hologram released'); }
        else if (scene?.lockGhost()) say('Hologram locked', 'Arrows nudge it 0.5 m. R turns it. Left click places it. H or Esc releases.');
        else say('Aim at the ground to lock the hologram');
        return;
      }
      if (sceneRef.current?.ghostLocked() && (e.code === 'ArrowUp' || e.code === 'ArrowDown' || e.code === 'ArrowLeft' || e.code === 'ArrowRight')) {
        // the nudge is screen-relative: up is away from the camera, right is to its right, on the ground
        const yaw = sceneRef.current.debug.facing();
        const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
        const rx = Math.cos(yaw), rz = -Math.sin(yaw);
        const dir = e.code === 'ArrowUp' ? [fx, fz] : e.code === 'ArrowDown' ? [-fx, -fz] : e.code === 'ArrowRight' ? [rx, rz] : [-rx, -rz];
        sceneRef.current.nudgeGhost((dir[0] ?? 0) * 0.5, (dir[1] ?? 0) * 0.5);
        return;
      }
      if (e.code === 'KeyB' && liveWhereRef.current === 'planet') {
        if (visitingRef.current) {
          say(`Visiting ${visitingRef.current.snapshot.owner}'s plot`, 'Visits are read-only.');
          return;
        }
        if (building) stopBuilding(); else { setPanel(null); pieceSessionRef.current = false; setMenu((m) => { if (!m) freeMouse(); return !m; }); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ready, creating, building, gunEquipped, fireWeapon, menu, panel, labPanel, dialOpen, debugOpen, locked, paused, hud.atLever, hud.atDial, hud.aimed, hud.aimedBoulder, hud.aimedLab, hud.aimedProp, hud.atArmory, openLog, hud.where, placeNow, stopBuilding, freeMouse, say, props.profile, radial, isAnyBaseWindowOpen]);
  // Z released: the remove hold ends (a tap, before the half second, removes nothing)
  useEffect(() => {
    const onKeyUp = (e: KeyboardEvent): void => {
      if (e.code === 'KeyZ') cancelRemoveHold();
    };
    window.addEventListener('keyup', onKeyUp);
    return () => window.removeEventListener('keyup', onKeyUp);
  }, [say]);
  useEffect(() => {
    const onClick = (e: MouseEvent): void => {
      // the right button cancels a placement (the key strip says so); the left button places (TASK-25)
      if (e.button === 2) {
        if (sceneRef.current?.ghostLocked()) sceneRef.current.releaseGhost();
        else if (pieceSessionRef.current) pieceSessionRef.current = false;
        else if (building) stopBuilding();
        return;
      }
      if (e.button === 0 && beamHeldRef.current && beamModeRef.current === 'apply' && !beamPortRef.current) {
        gameAudio.playDryFire();
      }
      if (building && locked) placeNow();
    };
    const noMenu = (e: MouseEvent): void => { if (building || pieceSessionRef.current) e.preventDefault(); };
    window.addEventListener('mousedown', onClick);
    window.addEventListener('contextmenu', noMenu);
    return () => {
      window.removeEventListener('mousedown', onClick);
      window.removeEventListener('contextmenu', noMenu);
    };
  }, [building, locked, placeNow, stopBuilding]);

  // Mouse wheel kind cycling for base-building (Item C1)
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      if (beamHeldRef.current) {
        if (e.altKey && beamModeRef.current === 'apply') {
          cycleBeamCartridge(e.deltaY > 0 ? 1 : -1);
          return;
        }
        if (e.altKey && beamModeRef.current === 'sculpt') {
          const nextTool = cycleSculptTool(sculptToolRef.current, e.deltaY > 0 ? 1 : -1);
          chooseSculptTool(nextTool);
          say(`Sculpt: ${SCULPT_LABEL[nextTool]}`);
          return;
        }
        const mode = cycleBeamMode(beamModeRef.current, e.deltaY > 0 ? 1 : -1);
        setBeamHeld(true, mode);
        say(`Beam: ${BEAM_LABEL[mode]}`);
        return;
      }
      const w = baseWorldRef.current;
      const slot = w.player.slots[w.hotbar];
      if (!slot || slot.n <= 0) return;
      const bp = blueprint(slot.item);
      if (!bp || bp.kinds.length <= 1) return;
      const curKind = buildKindRef.current ?? bp.kinds[0]!;
      const curIdx = bp.kinds.indexOf(curKind);
      const dir = e.deltaY > 0 ? 1 : -1;
      const nextIdx = (curIdx + dir + bp.kinds.length) % bp.kinds.length;
      buildKindRef.current = bp.kinds[nextIdx]!;
      (baseViewSource as WorldViewSource).notify?.();
      say(`Selected: ${buildKindRef.current.toUpperCase()}`);
    };
    window.addEventListener('wheel', onWheel, { passive: true });
    return () => window.removeEventListener('wheel', onWheel);
  }, [baseViewSource, say]);

  // leaving the planet closes the build menu; entering planet closes lab panels
  useEffect(() => {
    if (hud.where === 'lab') { setMenu(false); setPanel(null); stopBuilding(); if (beamHeldRef.current) setBeamHeld(false, beamModeRef.current); }
    if (hud.where === 'planet') { setLabPanel(null); setDialOpen(false); }
  }, [hud.where, stopBuilding]);

  // auto-teleport to planet surface and equip shotgun when URL has ?mash or ?monstermash
  useEffect(() => {
    if (ready && !props.gamePreset && typeof location !== 'undefined') {
      const p = new URLSearchParams(location.search);
      if (p.has('mash') || p.has('monstermash') || p.has('spawn_test') || p.has('base') || p.has('building')) {
        const scene = sceneRef.current;
        if (scene) {
          if (stateRef.current.step === 'create') {
            commit({ ...stateRef.current, step: 'drill', gateOn: true });
          }
          const g = scene.debug.gatePlanet();
          scene.debug.teleport('planet', g.x + 3, g.z + 5, Math.PI);
          if (p.has('mash') || p.has('monstermash') || p.has('spawn_test')) {
            scene.monsters.equip(true);
            setGunEquipped(true);
            scene.monsters.setUnlocked(true);
          }
        }
      }
    }
  }, [ready, commit]);

  // Debug hooks (TASK-20): the sandbox's actions for the tests and for dev work, in place of the removed Monster Mash panel.
  // Built in every build: the debug menu (Esc, Debug menu) calls them through debugApiRef. window.__dev, the test switch,
  // exists only in dev builds and under ?e2e (debugHooks).
  useEffect(() => {
    if (!ready) return undefined;
    const grant = (item: string, n: number): boolean => {
      const spec = ITEMS[item];
      if (!spec || n <= 0) return false;
      const w = baseWorldRef.current;
      const slots = w.player.slots.slice();
      let left = Math.floor(n);
      for (let i = 0; i < slots.length && left > 0; i++) {
        const st = slots[i];
        if (st && st.item === item && st.n < spec.stack) {
          const add = Math.min(left, spec.stack - st.n);
          slots[i] = { item, n: st.n + add };
          left -= add;
        }
      }
      for (let i = 0; i < slots.length && left > 0; i++) {
        if (slots[i] === null) {
          const add = Math.min(left, spec.stack);
          slots[i] = { item, n: add };
          left -= add;
        }
      }
      if (left > 0) return false;
      baseWorldRef.current = { ...w, player: { ...w.player, slots } };
      (baseViewSource as WorldViewSource).notify?.();
      setBaseWorldVersion((v) => v + 1);
      persistBaseWorld(true);
      return true;
    };
    const dev = {
      /**
       * A test seam (debug switch only): a written preset cartridge goes on the lab rack, so the X radial in Apply has one to
       * offer. Players never reach it (window.__dev exists only in dev builds and under ?e2e).
       */
      /** TICKET-32 test seams: a lab kit's placed parts (path, generator, material, slider values) and the saved overrides. */
      kitPlaced: (kit: string) => (sceneRef.current?.kitPlaced(kit) ?? []).map((p) => ({
        path: p.path,
        gen: p.source.kind === 'param' ? p.source.gen : null,
        params: p.source.kind === 'param' ? p.source.params : null,
        ops: p.source.kind === 'param' ? (p.source.ops ?? []).map((o) => o.op) : [],
        material: p.material,
      })),
      kitOverrides: () => propsRef.current.kits ?? {},
      /** Turns the heavy machines' kit frames on or off (off until TICKET-39b refits them) and rebuilds the plot's machines. */
      kitFrames: (on: boolean): void => {
        setKitFrames(on);
        sceneRef.current?.rebuildMachines();
      },
      aimKitPart: () => sceneRef.current?.aimKitPart(BEAM_STROKE_RANGE) ?? null,
      /** Fires the part in the port as a tap (one part) or a hold (every part of that kind), as on release. */
      applyPart: (broadcast: boolean): number => applyPartShotRef.current(broadcast),
      /** Fires the material in the port at the aimed machine part, as a tap or a hold (plan 39 step 2). */
      applySkin: (broadcast: boolean): number => applySkinShotRef.current(broadcast),
      /** The tree the view is aimed at (plan 39, Aq), and the species shot as a tap or a hold. */
      aimTree: () => sceneRef.current?.aimTree(BEAM_STROKE_RANGE) ?? null,
      applySpecies: (broadcast: boolean): number => applySpeciesShotRef.current(broadcast),
      /** The light shot as a tap or a hold (plan 39, Lx). */
      applyLight: (broadcast: boolean): number => applyLightShotRef.current(broadcast),
      /**
       * Dresses every part of a kit (its cores excepted) in a shelf material, with shelf layers added on top (plan 41's perf
       * gate): not saved, the scene only. Returns the parts dressed and the material's name.
       */
      dressKit: (kit: string, ref: string, addLayers: readonly string[] = []): { parts: number; name: string } => {
        const scene = sceneRef.current;
        const base = resolveMatPreset(ref);
        if (!scene || !base) return { parts: 0, name: '' };
        const name = materialName({ ...base, layers: [...base.layers, ...addLayers.flatMap((id) => (LAYER_SHELF[id] ? [LAYER_SHELF[id]!] : []))] });
        const overrides: Record<string, PartOverride> = {};
        for (const p of scene.kitPlaced(kit)) {
          const ov = bodyOverride(name, p);
          if (ov) overrides[p.path] = ov;
        }
        scene.setKitOverrides(kit, overrides);
        return { parts: Object.keys(overrides).length, name };
      },
      /** The beam's Apply with the material cartridge in the port (plan 41), at what the camera looks at. */
      applyMaterial: (broadcast: boolean): number => applyMaterialShotRef.current(broadcast),
      treeOverrides: () => propsRef.current.trees ?? {},
      /** The player's own presets (plan 39 section 7), as saved. */
      myPresets: () => parseMyPresets(kv.get(MY_PRESETS_KEY)),
      /** Replaces the regrown trees (saved and shown), as the props save holds them. */
      setTreeOverrides: (trees: Readonly<Record<string, TreePreset>>): void => {
        savePropsSave({ ...propsRef.current, trees });
        sceneRef.current?.setTreeOverrides(trees);
      },
      /** Runs the lab's machines (the bench) for `seconds` of powered time. */
      stepLab: (seconds: number): void => {
        const env: LabEnv = { presets: VAULT, stage: plotRef.current.stage, powered: true };
        const next = stepCartlab(labRef.current, env, seconds).state;
        labRef.current = next;
        commit(withLab(stateRef.current, next));
      },
      /** Turns the gate on (the bench prints only while it draws power). */
      powerGate: (): void => commit({ ...stateRef.current, gateOn: true }),
      /** Puts a blank on the lab rack without spending plot ore. Returns its id. */
      seedBlank: (): string | null => {
        const next = makeBlank(labRef.current, Number.MAX_SAFE_INTEGER).state;
        labRef.current = next;
        commit(withLab(stateRef.current, next));
        return next.cartridges[next.cartridges.length - 1]?.id ?? null;
      },
      /** Loads a lab cartridge into the rifle's port (the X radial's pick). */
      loadCartridge: (id: string): boolean => {
        const c = labRef.current.cartridges.find((x) => x.id === id);
        if (!c) return false;
        loadBeamCartridge(c);
        return beamPortRef.current?.cartridge.id === id;
      },
      /** The rifle's port: its cartridge's name and, for a part cartridge, the part. */
      port: () => (beamPortRef.current ? { name: beamPortRef.current.name, part: beamPortRef.current.part ?? null, species: beamPortRef.current.species ?? null, light: beamPortRef.current.light ?? null, material: beamPortRef.current.material ?? null, sprite: beamPortRef.current.sprite ?? null, sound: beamPortRef.current.sound ?? null, harness: beamPortRef.current.harness ?? null } : null),
      spriteCard: (kit: string) => sceneRef.current?.spriteCardOf(kit) ?? null,
      seedCartridge: (preset: string): boolean => {
        const v = VAULT_BY_ID.get(preset);
        if (!v) return false;
        const lab = labRef.current;
        const c: Cartridge = {
          id: `seed-${preset}-${lab.cartridges.length}`,
          name: `${v.name} (seeded)`,
          kind: 'preset',
          preset,
          from: [],
          affinity: { pxd: 1, vtx: 1, lx: 1, aq: 1 },
          slot: null,
        };
        labRef.current = { ...lab, cartridges: [...lab.cartridges, c] };
        commit(withLab(withPlot(stateRef.current, plotRef.current), labRef.current));
        return true;
      },
      /** The living monsters on the planet (their state, era and position). */
      mobs: (): readonly MonsterMobStatus[] => sceneRef.current?.monsters.getMobList() ?? [],
      /** The leaks on the plot: their state, seal and wave timer. */
      leaks: () => sceneRef.current?.monsters.markers() ?? [],
      /** Equips (or holsters) the combat shotgun. */
      equip: (item: 'shotgun' = 'shotgun', on = true): boolean => {
        if (item !== 'shotgun' || !sceneRef.current) return false;
        sceneRef.current.monsters.equip(on);
        setGunEquipped(on);
        return true;
      },
      /** One shot from the view, straight through the monsters (the result: pellets, hits, damage, kills). */
      fire: () => {
        const s = sceneRef.current;
        if (!s) return null;
        if (devWeaponRef.current) s.monsters.setWeaponStats(devWeaponRef.current);
        const r = s.aimGround();
        return s.monsters.fire(r.origin, r.dir);
      },
      /** The view's ray on the ground (the origin and the unit direction, x and z), and the eye point. */
      aim: () => sceneRef.current?.aimGround() ?? null,
      eye: () => sceneRef.current?.debug.position() ?? null,
      /** The sidearm's ammo: the rounds left, and the magazine. */
      ammo: () => sceneRef.current?.monsters.getAmmo() ?? null,
      /** The bridge store's stock, by item (the drops and the Act V kit land here). */
      /** The wreck sites: each one's rung, and whether it is broken or sealed (TASK-23c). */
      wrecks: () => sceneRef.current?.debug.wreckRungs() ?? [],
      /** The props saved for this profile: the cleared clutter, the logs read, the sealed sites. */
      props: (): PropsSave => propsRef.current,
      /** The player's pack: how many of each item it holds (the grid's slots). */
      pack: (): Record<string, number> => {
        const out: Record<string, number> = {};
        for (const st of baseWorldRef.current.player.slots) if (st) out[st.item] = (out[st.item] ?? 0) + st.n;
        return out;
      },
      /** Opens a Bridge Incident Log in the databank. */
      openLog: (log: string): void => openLog(log),
      /** Clears a salvage prop, as a held E does. */
      clearProp: (id: string): void => clearPropRef.current(id),
      bridgeStock: (): Record<string, number> => {
        const out: Record<string, number> = {};
        const box = baseWorldRef.current.boxes.find((b) => b.id === BRIDGE_STORE);
        for (const st of box?.slots ?? []) if (st) out[st.item] = (out[st.item] ?? 0) + st.n;
        return out;
      },
      /** The planet's and the mobs' fidelity stage (0 to 4: dither, EGA, VGA, Gouraud, PBR). */
      fidelity: (stage: number): void => { sceneRef.current?.setFidelityStage(stage); },
      stats: (): MonsterStats | null => sceneRef.current?.monsters.getStats() ?? null,
      /** The monsters' clock: advances them by whole seconds without a frame (the warnings, the waves, the seal). */
      stepMonsters: (seconds: number): void => { sceneRef.current?.stepMonsters(seconds); },
      /** Whether a sapper holds a base machine this moment (its output halves; P0-MON-03). */
      isLatched: (machineId: number): boolean => sceneRef.current?.monsters.isLatched(machineId) ?? false,
      /** The F-03 flag (the monsters fight once the first gun exists). A test sets it; the chain sets it on F-03. */
      /** A finished act (TASK-24): marks the act's quest done and advances the chain, for the tests that do not play its steps. */
      finishAct: (quest: string): void => {
        updateChain((c) => advanceChain({ ...c, progress: { ...c.progress, finished: [...c.progress.finished.filter((x) => x !== quest), quest] } }));
      },
      /** The debug menu's step skip: the current step is done and the chain moves exactly one step (null when none is current). */
      completeStep: (): string | null => completeStepNow(),
      /** The debug menu's act finish: the running act is marked done, as finishAct does (null when no act is running). */
      completeAct: (): string | null => completeActNow(),
      /** Refills the sync and the health. */
      refill: (): void => {
        sceneRef.current?.debug.setSync(1);
        hpRef.current = PLAYER_MAX_HP;
        setVitals((v) => ({ ...v, hp: PLAYER_MAX_HP }));
      },
      /** Teleports the player: the lab (the bed-side spawn), the gate pad, or the Moon plot (the spots the game's own moves use). */
      teleport: (where: 'lab' | 'gate' | 'plot'): void => {
        const scene = sceneRef.current;
        if (!scene) return;
        if (where === 'lab') { scene.debug.teleport('lab', LAB_SPAWN.x, LAB_SPAWN.z, LAB_SPAWN.yaw); return; }
        // GATE-05: the moon's arrivals start at the gate's exit pose, facing away from the gate
        const exit = scene.gateExit();
        scene.debug.teleport('planet', exit.x, exit.z, exit.yaw, 0);
      },
      /** Puts n of an item in the bridge store (the linked storage the benches draw from); what does not fit is dropped, as the grant command does. */
      grantStock: (item: string, n: number): void => {
        if (!ITEMS[item] || n <= 0) return;
        dispatchBaseRef.current({ t: 'grant', stock: [{ item, n: Math.floor(n) }] });
      },
      /** Queues a vehicle's print at the first fabricator: the bill goes to the bridge store (the network pays it), then the craft. */
      printVehicle: (kind: VehicleKind): string => {
        const machine = baseWorldRef.current.machines.find((m) => m.kind === 'fabricator');
        if (!machine) return 'No fabricator on the base yet. Install one first (Act VI, F-01).';
        const p = sceneRef.current?.debug.position();
        if (!p) return 'The scene is not ready.';
        for (const s of VEHICLE[kind].bill) dispatchBaseRef.current({ t: 'grant', stock: [{ item: s.item, n: s.n }] });
        dispatchBaseRef.current({ t: 'craft', at: { x: p.x, z: p.z }, machine: machine.id, recipe: `vehicle-${kind}` });
        return 'Queued at the fabricator. A refusal shows as a toast.';
      },
      unlockMonsters: (on = true): void => {
        updateChain((c) => ({ ...c, monstersUnlocked: on }));
        sceneRef.current?.monsters.setUnlocked(on);
      },
      /** Holds the seal on a leak for `seconds` (the beam's hold, without the aim); the brain seals it within reach. */
      sealLeak: (id: number, seconds = 8): void => {
        const scene = sceneRef.current;
        if (!scene) return;
        scene.monsters.setSealing(id);
        scene.stepMonsters(seconds);
        scene.monsters.setSealing(null);
      },
      /** The player's health: the hit points, and whether they are low. */
      vitals: (): { readonly hp: number; readonly low: boolean } => ({ hp: hpRef.current, low: isLow(hpRef.current) }),
      /** Sets the health (a test puts the player low, or near death). */
      setHp: (hp: number): void => {
        hpRef.current = Math.max(0, Math.min(PLAYER_MAX_HP, hp));
        setVitals((v) => ({ ...v, hp: hpRef.current }));
      },
      /** The gate pad on the planet (the sanctuary's centre), in planet metres. */
      gate: (): { readonly x: number; readonly z: number } | null => sceneRef.current?.debug.gatePlanet() ?? null,
      /** A hit from a bearing (the damage, the health, the wedge, the low bark and the death). */
      hit: (damage: number, bearing = 0): void => takeHit(damage, bearing),
      /** Places a monster of `kind` on the ground `distance` m ahead of the view (the tests fire at it). Returns its id. */
      placeMob: (kind: Archetype, distance = 6): number => {
        const scene = sceneRef.current;
        if (!scene) return -1;
        const eye = scene.debug.position();
        const aim = scene.aimGround();
        const len = Math.hypot(aim.dir.x, aim.dir.z) || 1;
        return scene.monsters.placeMob(kind, eye.x + (aim.dir.x / len) * distance, eye.z + (aim.dir.z / len) * distance);
      },
      /** A hit on a monster by id: its death and its drop, as a shot does. */
      hurtMob: (id: number, damage: number) => sceneRef.current?.monsters.hurtMob(id, damage) ?? null,
      /** The sidearm's parts (the weapon bench's core, barrel, sight and cell), as the bench fits them. */
      setWeapon: (parts: { readonly core: string; readonly barrel: string; readonly sight: string; readonly cell: string }): void => {
        const w = weaponStats({ ...parts });
        devWeaponRef.current = w;
        sceneRef.current?.monsters.setWeaponStats(w);
      },
      /** The locomotion preset in force: `auto` (the ground decides) or a named preset pinned everywhere (plan 43, loc:). */
      locomotion: (): string => sceneRef.current?.debug.locomotion() ?? 'auto',
      /** Pins a locomotion preset, live: the next frame's walk, jump, gravity, air control and landing spring read it. */
      setLocomotion: (choice: string): string => sceneRef.current?.debug.setLocomotion(choice) ?? 'auto',
      /** The Monsters setting (the Settings page sets it through the play settings; the tests set it here). */
      setMonstersSetting: (level: MonstersSetting): void => { sceneRef.current?.monsters.setSetting(level); },
      /** Puts n of an item in the player's slots (stacks first). False when they do not fit or the item is unknown. */
      grant: (item: string, n: number): boolean => grant(item, n),
      /** The fidelity stage: the plot's and the base's (the base's pieces follow it). */
      setFloats: (fraction: number): void => {
        (window as unknown as { hmPlay?: { setFloats: (n: number) => void } }).hmPlay?.setFloats(fraction);
      },
      setStage: (stage: number): void => {
        (window as unknown as { hmPlay?: { setStage: (n: number) => void } }).hmPlay?.setStage(stage);
        dispatchBaseRef.current({ t: 'stage', stage });
      },
      setFidelityStage: (stage: number): void => {
        (window as unknown as { hmPlay?: { setFidelityStage: (n: number) => void } }).hmPlay?.setFidelityStage(stage);
        dispatchBaseRef.current({ t: 'stage', stage });
      },
      setVegetationSetting: (v: 'auto' | 'off' | 'low' | 'high'): void => {
        sceneRef.current?.setVegetationSetting(v);
      },
      getBiomeCounts: () => sceneRef.current?.getBiomeCounts() ?? null,
      playCredits: (): void => { startCredits('title'); },
      commitConsensus: (): void => {
        updateChain((c) => bump(c, COUNT.consensusCommitted, 1));
        say('Consensus Committed', 'Continental consensus reached (85%+). Committing Sector 04 branch...');
        narratorRef.current?.trigger('act9:consensus-commit');
        if (!finaleRef.current?.active) {
          finaleRef.current = {
            active: true,
            startWallMs: performance.now(),
            voiceTriggered: false,
            done: false,
          };
        }
      },
    };
    debugApiRef.current = dev;
    if (debugHooks) (window as unknown as { __dev?: unknown }).__dev = dev;
    return () => {
      debugApiRef.current = null;
      if (debugHooks) delete (window as unknown as { __dev?: unknown }).__dev;
    };
  }, [ready, debugHooks, fireWeapon, baseViewSource, persistBaseWorld, completeStepNow, completeActNow]);

  const startBuilding = (kind: MachineKind): void => {
    setMenu(false);
    setBuilding(kind);
    const env = envRef.current;
    const isFree = isFreeDrill(stateRef.current, kind);
    sceneRef.current?.setBuilding(kind, env ? (x, z) => {
      const checkPlot = isFree ? { ...plotRef.current, ore: Math.max(plotRef.current.ore, KINDS[kind].cost) } : plotRef.current;
      const v = canPlace(checkPlot, env, kind, x, z);
      return v.ok ? { ok: true, why: '' } : v;
    } : undefined);
    if (!locked) lock();
  };
  // the quest HUD: the chain's current step and the next one, once the chain has started; the plot's goal until then
  const plotGoal = objective({ ...state, plot: plotRef.current }, hud.where);
  const chainNow = chainView(state.chain);
  const goal = chainNow.current && !visiting ? { title: chainNow.current.title, hint: chainNow.current.hint } : plotGoal;
  const chainNext = !visiting && chainNow.current ? chainNow.next?.title ?? null : null;
  // POL-40 (plan 16, the top-left zone): Dr. Haddy's portrait slides in only while she speaks or for a moment when the quest step
  // changes, so the quest card keeps the top of the zone. It yields while a ghost is placed (as the subtitle yields to the open
  // drawer): the centre 60% of the screen stays clear for the ghost.
  const [questPing, setQuestPing] = useState(false);
  const pingedGoalRef = useRef(goal.title);
  useEffect(() => {
    if (pingedGoalRef.current === goal.title) return;
    pingedGoalRef.current = goal.title;
    setQuestPing(true);
    const t = window.setTimeout(() => setQuestPing(false), PORTRAIT_QUEST_PING_MS);
    return () => window.clearTimeout(t);
  }, [goal.title]);
  const placingNow = building !== null || placingLayoutId !== null || pieceSessionRef.current;
  const portraitIn = (subtitle !== null || questPing) && !placingNow;
  const syncLit = Math.ceil(hud.sync * SYNC_BLOCKS);
  const labStation = hud.where === 'lab' && hud.aimedLab !== null ? stationById(hud.aimedLab) : null;
  const prompt = building
    ? (hud.ghost?.ok ? `Click or E: build the ${KINDS[building].name.toLowerCase()}` : hud.ghost?.why || 'Aim at the ground near the gate.')
    : hud.atLever ? 'E: pull the main lever'
    : hud.atDial ? 'E: plot dial'
    : hud.where === 'planet' && hud.aimed !== null && panel === null ? `E: inspect the ${KINDS[(visiting ? visiting.plot.machines : plotRef.current.machines).find((x) => x.id === hud.aimed)?.kind ?? 'mill'].name.toLowerCase()}`
    : hud.atArmory && hud.aimedLab === null && labPanel === null && !hud.atLever && !hud.atDial && !baseWorldRef.current.equipment.sidearm ? 'E: take the combat sidearm from the armory'
    : (hud.where === 'lab' || hud.where === 'planet') && hud.aimedProp?.salvage && labPanel === null ? `Hold E: salvage the ${propLabel(hud.aimedProp.id)}`
    : hud.aimedProp && aimedPropActs(hud.aimedProp, hud.where) && !hud.aimedProp.salvage && labPanel === null && hud.aimed === null ? `E: read the ${propLabel(hud.aimedProp.id)}`
    : labStation !== null && labPanel === null && fabricatorMachineId === null && !planetTableOpen && !weaponBenchOpen ? labStation.prompt
    : hud.where === 'planet' && hud.aimedBoulder !== null && !visiting ? 'Hold E: gather ore'
    : '';

  return (
    <div data-game-preset={props.gamePreset?.id} data-hud-root={creditsRun ? undefined : true} data-fidelity={skinTrack.skin} className={`play${ready ? ' ready' : ''}${hud.where === 'planet' ? ' on-planet' : ''}${hud.sync < 0.3 && hud.where === 'planet' ? ' sync-low' : ''}${skinGlitch ? ' hud-glitch' : ''}${creditsRun ? ' credits-on' : ''}`}>
      {creditsRun ? <CreditsPlayer director={creditsRun.director} onExit={stopCredits} onReplay={replayCredits} /> : null}
      {jukeboxOpen && !creditsRun ? (
        <OldMonitorJukeboxModal
          open
          overclockedPlaying={isMonitorOverclockedPlaying()}
          elapsedSec={performance.now() / 1000}
          endingSeen={endingSeen}
          onPlayCredits={() => {
            if (!endingSeen) {
              say('Playback Locked', 'The Ending Credits replay unlocks after witnessing the campaign finale.');
              return;
            }
            setJukeboxOpen(false);
            startCredits('lab');
          }}
          onPlayOverclocked={toggleMonitorOverclocked}
          onClose={() => setJukeboxOpen(false)}
        />
      ) : null}
      {failed ? <p className="play-failed" role="alert">This browser could not start 3D graphics (WebGL 2). Try another browser, or turn on hardware acceleration in its settings.</p> : <canvas ref={canvasRef} className="play-canvas" onClick={() => { if (ready && !creating && !locked) lock(); }} aria-label="The lab, in first person. Click to look around." />}
      {ready && props.gamePreset && !hideOverlays ? <GameHudBlade preset={props.gamePreset} progress={gameProgress} speed={drivingSpeed} livingMobs={sceneRef.current?.monsters.getMobList().length ?? 0} hp={vitals.hp} ammo={gunAmmo} onPreset={props.onGamePreset} onShare={() => {
        void downloadSporeCard({ schema: 'hm2:spore-card:v1', title: props.gamePreset!.title, author: 'Multiverse Explorer', creation: { kind: 'game', spec: props.gamePreset! } }).catch((e: unknown) => say('Spore export refused', e instanceof Error ? e.message : 'PNG capture failed'));
      }} /> : null}
      {!ready && !failed ? <div className="gr-loading play-loading" role="status"><span>{loading}</span><i /></div> : null}

      {ready ? (
        <HudZone zone="top-centre">
          {hud.where === 'planet' && drivingSpeed === null ? (() => {
            const g = gateBearingOf(sceneRef.current);
            return <CompassRibbon relativeDeg={g?.relativeDeg ?? null} distanceM={g?.distanceM ?? null} warn={hud.warn} />;
          })() : null}
          <SyncWord draining={hud.sync < 0.3} hidden={hud.where !== 'planet' || (!!props.gamePreset && props.gamePreset.hudBlade !== 'exploration-o2')} />
        </HudZone>
      ) : null}
      {ready ? (
        <HudZone zone="top-right">
          {!props.gamePreset || !['race-lap-telemetry', 'arena-wave-survivor'].includes(props.gamePreset.hudBlade) ? <FloatsPill
            stage={hud.plot.stage}
            floats={METRICS.map((m) => ({ key: m, name: METRIC_NAME[m], colour: METRIC_COLOUR[m], value: hud.plot.levels[m] }))}
          /> : null}
        {/* In a co-op room the badge names the session, and the branch toggle is gone: the room is the grid (TICKET-11). */}
        <div hidden={!!props.gamePreset} className="play-sync-indicator" data-hud-zone="top-right" title={outpostRef.current ? `Co-op room ${outpostRef.current.code ?? ''}: the room's world is shared with everyone in it` : syncMode === 'synced' ? 'Connected to shared 40,000 km planetary substrate' : 'Playing on private local simulation branch'}>
          {outpostRef.current ? (
            <span className="sync-badge coop" data-testid="play-coop-badge">
              <span className="sync-pulse" />
              CO-OP · room {outpostRef.current.code ?? '------'}
            </span>
          ) : (
            <>
              <span
                className={`sync-badge ${syncMode}`}
                onClick={() => setPlanetTableOpen(true)}
                title="Click to open Planetary Grid Enclave & Co-Op Management"
                style={{ cursor: 'pointer' }}
              >
                <span className="sync-pulse" />
                {syncMode === 'synced' ? 'GRID SYNCED' : 'SOLO DESYNCED'}
              </span>
              <button
                className="sync-branch-toggle"
                onClick={() => setPlanetTableOpen(true)}
                title="Manage Planetary Grid and Enclave Co-Op"
              >
                {syncMode === 'synced' ? 'Manage' : 'Sync'}
              </button>
            </>
          )}
        </div>
        </HudZone>
      ) : null}

      {ready && creating ? (
        <div className="play-create">
          <CreateScientist inLab title="Who are you?" doneLabel="Done: into the lab"
            onDone={(avatar) => {
              narratorRef.current?.resetLog();
              narratorRef.current?.trigger('wake');
              commit(created(stateRef.current, avatar));
              sceneRef.current?.setAvatar(avatar);
              say('Simulation Bridge Alert', 'The lab is shielded. A nested simulation broke down—pull the console lever to open the portal to the moon.');
            }}
            onBack={props.onBack} />
        </div>
      ) : null}

      {ready && !creating ? (
        <>
          {!props.gamePreset && !hideOverlays && drivingSpeed === null && (
            <HudZone zone="top-left">
            {portraitIn ? (
              <HaddyCrtPortrait
                className="hud-portrait-in"
                activeLineId={subtitle?.id}
                subtitleText={subtitle?.cleanText}
                isSpeaking={Boolean(subtitle)}
                isWarningGlitch={subtitle?.id?.startsWith('BARK') || subtitle?.id === 'power-short' || subtitle?.id === 'recall-zero'}
                stage={hud.plot.stage}
              />
            ) : null}
            <section className="play-goal" aria-live="polite" data-hud-zone="top-left">
              <h2>{visiting ? `Visiting ${visiting.snapshot.owner}’s plot` : goal.title}</h2>
              <p>{visiting ? 'Read-only visit. Walk back through the gate to return to your lab.' : goal.hint}</p>
              {chainNext ? <small className="play-next">Next: {chainNext}</small> : null}
            </section>
            {/* The co-op room's chip sits under the quest card, in the top-left zone: the stage metrics keep the top-right */}
            {outpostRef.current ? <OutpostRoster session={outpostRef.current} /> : null}
            </HudZone>
          )}
          {hud.where === 'planet' && drivingSpeed === null && (!props.gamePreset || props.gamePreset.hudBlade === 'exploration-o2') ? (
            <HudZone zone="bottom-left">
            <div className="play-sync" data-hud-zone="bottom-left" role="meter" aria-label="Sync" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(hud.sync * 100)}>
              <span>Sync</span>
              <ol>{Array.from({ length: SYNC_BLOCKS }, (_, i) => <li key={i} className={i < syncLit ? 'on' : ''} />)}</ol>
              {shelterState === 'pressurized' ? (
                <span className="hm-shelter-chip pressurized">PRESSURISED</span>
              ) : shelterState === 'sealed-no-power' ? (
                <span className="hm-shelter-chip unpowered">SEALED · NO LIFE SUPPORT</span>
              ) : null}
            </div>
            </HudZone>
          ) : null}
          <i className="play-dot" aria-hidden="true" />
          {prompt && drivingSpeed === null && building === null ? <p className={`play-prompt${building && !hud.ghost?.ok ? ' bad' : ''}`} data-hud-zone="centre">{prompt}</p> : null}
          {hud.aimedProp && !hud.aimedProp.salvage && databank === null ? <LoreHover prop={hud.aimedProp.id} /> : null}
          {databank !== null ? <DataBank log={databank} onClose={closeDatabank} /> : null}
          {drivingSpeed !== null ? (
            // Plan 47 (Pillar 2): while driving, zone 8 carries the Sovereign Harness telemetry blade and the drift badge.
            <HudZone zone="bottom-right">
              <HarnessTelemetryHud vm={drivingHarness} />
              <DrivingHudBadge telemetry={drivingDrift} />
            </HudZone>
          ) : null}
          {/* Plan 48: In-game AI Companion Comms (hold T to talk, Enter to type) */}
          <CompanionChat
            companion={sceneRef.current?.getCompanion?.() ?? null}
            onBroadcastRadio={(text) => {
              say('Overwatch · Co-Builder', text);
            }}
            getContext={() => {
              const scene = sceneRef.current;
              const p = scene?.debug.position();
              const player = { x: p?.x ?? 0, z: p?.z ?? 0, yaw: scene?.debug.facing() ?? 0 };
              const inLab = liveWhereRef.current === 'lab';
              const gatePlanet = !inLab ? scene?.debug.gatePlanet() : null;
              // the nearest vehicle on the plot is "the rover"
              let rover: { x: number; z: number } | undefined;
              let best = Infinity;
              for (const v of baseWorldRef.current.vehicles) {
                const d = Math.hypot(v.x - player.x, v.z - player.z);
                if (d < best) { best = d; rover = { x: v.x, z: v.z }; }
              }
              return {
                player,
                landmarks: {
                  gate: inLab ? { x: GATE_AT.x, z: GATE_AT.z } : gatePlanet ? { x: gatePlanet.x, z: gatePlanet.z } : undefined,
                  ...(rover && !inLab ? { rover } : {}),
                  ...(inLab ? { bench: { x: PRESET_BENCH_AT.x, z: PRESET_BENCH_AT.z } } : {}),
                },
              };
            }}
          />
          {(state.step === 'build' || state.step === 'drill' || state.step === 'done' || visiting) && drivingSpeed === null ? (
            <HudZone zone="bottom-right">
            <section className="play-plot" data-hud-zone="bottom-right" aria-label={visiting ? `Visiting ${visiting.snapshot.owner}'s plot` : 'Your plot'}>
              {visiting ? (
                <div className="play-visiting-banner">
                  <span>Visiting <b>{visiting.snapshot.owner}</b></span>
                  <em>Stage {visiting.plot.stage}</em>
                </div>
              ) : (() => {
                const hasDrill = plotRef.current.machines.some((m) => m.kind === 'drill');
                const outOfOreNoDrill = hud.plot.ore <= 0 && !hasDrill;
                const linkedOre = (() => {
                  const w = baseWorldRef.current;
                  if (!w?.boxes) return 0;
                  let sum = 0;
                  for (const b of w.boxes) {
                    for (const s of b.slots) {
                      if (s && s.item === 'ore') sum += s.n;
                    }
                  }
                  return sum;
                })();
                return (
                  <>
                    <p className={`play-ore${outOfOreNoDrill ? ' out-of-ore' : ''}`} data-testid="plot-ore-ticker">
                      <b>{Math.floor(hud.plot.ore)}</b> ore{linkedOre > 0 ? <span className="play-ore-linked"> (+{linkedOre})</span> : null} <span>{signed(hud.plot.oreRate)}/s</span>
                      {outOfOreNoDrill ? <em className="play-ore-warn">Out of ore: hold E on a boulder, or build a rock drill</em> : null}
                    </p>
                    <p className={`play-power${hud.plot.satisfaction < 0.999 ? ' short' : ''}`}><b>{hud.plot.demand.toFixed(0)}</b> of {hud.plot.supply.toFixed(0)} kW <span className="play-power-pct">{Math.round(hud.plot.satisfaction * 100)}%</span></p>
                  </>
                );
              })()}
            </section>
            </HudZone>
          ) : null}
          {menu ? (() => {
            const w = baseWorldRef.current;
            const held = new Map<string, MenuBlueprint>();
            w.player.slots.forEach((slot, i) => {
              const bp = slot && slot.n > 0 ? blueprint(slot.item) : null;
              if (!bp || held.has(bp.id)) return;
              held.set(bp.id, {
                id: bp.id,
                name: bp.name,
                slot: i < 9 ? i : null,
                kinds: bp.kinds.map((kind) => {
                  const ore = pieceCost(bp, kind)?.find((c) => c.item === 'ore')?.n ?? 0;
                  return { kind, label: KIND_LABEL[kind] ?? kind, cost: `${ore} ore` };
                }),
              });
            });
            const aim = sceneRef.current?.aimPoint() ?? null;
            const aimedPiece = aim?.piece != null ? w.base.pieces.find((q) => q.id === aim.piece) : undefined;
            const machines: MenuMachine[] = BUILD_ORDER.map((k) => {
              const spec = KINDS[k];
              const isFree = isFreeDrill(stateRef.current, k);
              return {
                key: k,
                name: spec.name,
                blurb: BLURB[k],
                cost: isFree ? 'Free' : `${spec.cost} ore`,
                shut: hud.plot.stage < spec.unlock,
                short: !isFree && hud.plot.ore < spec.cost,
                highlighted: state.step === 'drill' && k === 'drill',
                unlock: spec.unlock,
              };
            });
            return (
              <BuildMenu
                tab={buildTab}
                onTab={setBuildTab}
                stage={hud.plot.stage}
                locks={{
                  structures: featureLock('structures', state.chain, hud.plot.stage) ?? undefined,
                  heavy: featureLock('heavy', state.chain, hud.plot.stage) ?? undefined,
                }}
                kindLock={(kind) => featureLock(kind === 'weaponBench' ? 'weaponBench' : 'structures', state.chain, hud.plot.stage)}
                machines={machines}
                blueprints={[...held.values()]}
                selectedKind={buildKindRef.current}
                heavy={HEAVY_CARDS}
                hardpoints={w.base.pieces.filter((q) => q.kind === 'hardpoint').length}
                aimedHardpoint={aimedPiece?.kind === 'hardpoint'}
                layouts={w.layouts.map((l) => ({ id: l.id, name: l.name, pieces: layoutPieces(l.code)?.length ?? 0 }))}
                onMachine={(key) => startBuilding(key as MachineKind)}
                onStructure={(bpId, kind) => {
                  const bw = baseWorldRef.current;
                  const idx = bw.player.slots.findIndex((sl, i) => i < 9 && !!sl && sl.n > 0 && sl.item === bpId);
                  if (idx < 0) {
                    say('Not in your hotbar', 'Move the blueprint into slots 1 to 9, then pick its piece.');
                    return;
                  }
                  dispatchBase({ t: 'hotbar', index: idx });
                  buildKindRef.current = kind as Kind;
                  ghostKindRef.current = null;
                  setMenu(false);
                  pieceSessionRef.current = true;
                  if (!locked) lock();
                  say(`Holding the ${KIND_LABEL[kind] ?? kind}`, 'Click to place. Q or the wheel cycles the kinds.');
                }}
                onHeavy={() => {
                  if (aimedPiece?.kind !== 'hardpoint') {
                    say('Aim at a hardpoint', 'Build one from the Structures tab, then aim at it and press.');
                    return;
                  }
                  const m = baseWorldRef.current.machines.find((x) => x.id === aimedPiece.id);
                  if (m) {
                    say(`Heavy ${m.kind.toUpperCase()} is installed`, 'Pouring pixels into atmospheric plume.');
                    return;
                  }
                  setMenu(false);
                  setMachinePickerHardpoint(aimedPiece.id);
                  freeMouse();
                }}
                onLayout={(id) => {
                  setPlacingLayoutId(id);
                  placingLayoutRotationRef.current = 0;
                  setMenu(false);
                  if (!locked) lock();
                  say('Place Layout', 'Aim at foundation ground. Press R to rotate, Click to confirm.');
                }}
                onClose={() => setMenu(false)}
              />
            );
          })() : null}
          {!menu && !paused && !hideOverlays && !isAnyBaseWindowOpen && (building !== null || placingLayoutId !== null || pieceSessionRef.current) ? (
            <BuildPill
              label={building ? `Placing ${KINDS[building]?.name ?? building}` : placingLayoutId !== null ? 'Placing a plan' : 'Placing a piece'}
              onOpen={() => {
                stopBuilding();
                setPlacingLayoutId(null);
                pieceSessionRef.current = false;
                setMenu(true);
                freeMouse();
              }}
            />
          ) : null}
          {hud.where === 'planet' && drivingSpeed === null && !hideOverlays && sceneRef.current
            ? sceneRef.current.debug.machineAnchors().map((a) => {
              // a label shows within 14 m and 8 degrees of the crosshair, or with Alt held (TASK-25, P0-UI-03)
              if (a.behind || !shouldRenderMachineBillboard(a.aimAngleDeg, a.distanceM, altHeldRef.current)) return null;
              const x = (a.ndcX + 1) * 0.5 * window.innerWidth;
              // the label stands on its machine, 36 px above it; its bottom edge may not reach into the reticle's clear zone (a 48 px square,
              // plus or minus 24 px, on the centre), so a machine just below the crosshair lifts its label above that zone (TASK-28)
              const y = Math.min((1 - a.ndcY) * 0.5 * window.innerHeight - 36, window.innerHeight / 2 - 28);
              const run = a.running;
              const tone = run > 0.95 ? 'ok' : run > 0.05 ? 'warn' : 'bad';
              const state = run > 0.95 ? 'RUNNING' : run > 0.05 ? `BROWNOUT ${Math.round(run * 100)}%` : 'NOT RUNNING';
              const name = (KINDS as Readonly<Record<string, { readonly name: string }>>)[a.kind]?.name ?? a.kind;
              return <MachineLabel key={a.id} x={x} y={y} name={name} state={state} tone={tone} />;
            })
            : null}
          {panel !== null ? (() => {
            const curPlot = visiting ? visiting.plot : plotRef.current;
            const curLab = visiting ? visiting.lab : labRef.current;
            const mm = curPlot.machines.find((x) => x.id === panel);
            const env = envRef.current;
            if (!mm || !env) return null;
            const vEnv: Env = visiting ? {
              gate: env.gate,
              plotRadius: env.plotRadius,
              richness: env.richness,
              affinity: (id, metric) => cartlabAffinityOf(curLab, id, metric),
            } : env;
            const spec = KINDS[mm.kind], metric = spec.emits;
            const run = running(curPlot, vEnv).get(mm.id) ?? 0, net = network(curPlot, vEnv);
            const status = !mm.on ? 'Switched off.' : !net.connected.has(mm.id) ? 'No power: out of reach of the network.'
              : run > 0.95 ? 'Running.' : run > 0.05 ? `Running at ${Math.round(run * 100)}%: short of ${net.satisfaction < 0.99 ? 'power' : 'ore'}.` : spec.oreUse > 0 && curPlot.ore <= 0 ? 'Idle: no ore.' : 'Idle.';
            const close = (): void => { setPanel(null); lock(); };

            if (visiting) {
              return (
                <section className="play-machine" aria-label={spec.name}>
                  <h3>{spec.name}</h3>
                  <p>{BLURB[mm.kind]} {status}</p>
                  <p style={{ color: '#8892b0', fontSize: '0.85rem' }}>Visiting {visiting.snapshot.owner}&rsquo;s plot (read-only).</p>
                  {spec.slot && metric && mm.cartridge ? (() => {
                    const c = curLab.cartridges.find((cart) => cart.id === mm.cartridge);
                    if (!c) return null;
                    const gain = c.affinity[metric] ?? 1;
                    return (
                      <div className="play-carts">
                        <h4>Slotted cartridge: {c.name}</h4>
                        <p className="cart-gain" style={{ color: METRIC_COLOUR[metric] }}>
                          {gain === 1 ? 'No effect on' : `${gain > 1 ? '+' : ''}${Math.round((gain - 1) * 100)}%`} {METRIC_NAME[metric]}
                        </p>
                      </div>
                    );
                  })() : null}
                  <button className="go" onClick={close} autoFocus>Back to the plot</button>
                </section>
              );
            }

            return (
              <section className="play-machine" aria-label={spec.name}>
                <h3>{spec.name}</h3>
                <p>{BLURB[mm.kind]} {status}</p>
                <div className="play-machine-actions">
                  <button onClick={() => changePlot(setOn(plotRef.current, mm.id, !mm.on))}>{mm.on ? 'Switch off' : 'Switch on'}</button>
                  <button onClick={() => {
                    if (mm.cartridge) {
                      labRef.current = unslot(labRef.current, mm.cartridge);
                    }
                    changePlot(removeMachine(plotRef.current, mm.id));
                    setPanel(null);
                    lock();
                  }}>Take it down (+{Math.floor(spec.cost / 2)} ore)</button>
                </div>
                {spec.slot && metric ? (() => {
                  const currentCartId = mm.cartridge;
                  const available = labRef.current.cartridges.filter((c) => c.kind !== 'blank' && (c.slot === null || c.slot === mm.id));
                  return (
                    <div className="play-carts">
                      <h4>Cartridge: a preset from your rack shapes what it pours</h4>
                      <div>
                        {available.map((c) => {
                          const isSlotted = currentCartId === c.id;
                          const gain = c.affinity[metric] ?? 1;
                          return (
                            <button
                              key={c.id}
                              className={isSlotted ? 'on' : ''}
                              onClick={() => {
                                let l = labRef.current;
                                if (isSlotted) {
                                  l = unslot(l, c.id);
                                  labRef.current = l;
                                  changePlot(setCartridge(plotRef.current, mm.id, null));
                                } else {
                                  if (currentCartId) {
                                    l = unslot(l, currentCartId);
                                  }
                                  l = slotInto(l, c.id, mm.id);
                                  labRef.current = l;
                                  changePlot(setCartridge(plotRef.current, mm.id, c.id));
                                }
                              }}
                            >
                              <b>{c.name}</b>
                              <span>{gain === 1 ? 'no effect on' : `${gain > 1 ? '+' : ''}${Math.round((gain - 1) * 100)}%`} {METRIC_NAME[metric]}</span>
                            </button>
                          );
                        })}
                      </div>
                      {available.length === 0 ? <p className="play-why">No written cartridges on the rack. Write one at the bench in the lab.</p> : null}
                    </div>
                  );
                })() : null}
                <button className="go" onClick={close} autoFocus>Back to the plot</button>
              </section>
            );
          })() : null}
          {labPanel !== null ? (() => {
            const labEnv: LabEnv = { presets: VAULT, stage: plotRef.current.stage, powered: stateRef.current.gateOn };
            const close = (): void => { setLabPanel(null); lock(); };

            if (labPanel === 'rack' || labPanel === 'preset-rack') {
              const blankCheck = canMakeBlank(labRef.current, plotRef.current.ore);
              return (
                <section className="play-machine lab-panel-rack" aria-label="Cartridge Rack">
                  <h3>Cartridge Rack</h3>
                  {chainView(state.chain).current?.id === 'A4-01' ? (
                    <button
                      type="button"
                      className="play-pickup"
                      onClick={() => {
                        updateChain((c) => bump(c, COUNT.toolPickup));
                        narratorRef.current?.trigger('tool:pickup');
                        say('Extraction rifle taken', 'Draw it with G on the planet. Q cycles Extract, Apply and Sculpt.');
                      }}
                    >
                      Take the extraction rifle from the armory
                    </button>
                  ) : null}
                  <p>
                    {rackCount(labRef.current)} of {CARTLAB_RULES.rackSize} slots used ({Math.floor(plotRef.current.ore)} ore available). Blanks can be written into presets at the bench.
                  </p>
                  <div className="play-machine-actions">
                    <button
                      disabled={!blankCheck.ok}
                      onClick={() => {
                        const r = makeBlank(labRef.current, plotRef.current.ore);
                        labRef.current = r.state;
                        plotRef.current = { ...plotRef.current, ore: plotRef.current.ore - r.oreUsed };
                        commit(withLab(withPlot(stateRef.current, plotRef.current), r.state));
                        say('Blank made', 'Take it to the preset bench to write a cartridge.');
                      }}
                    >
                      Make a blank ({CARTLAB_RULES.blankCost} ore)
                    </button>
                  </div>
                  {!blankCheck.ok && <span className="play-why">{blankCheck.why}</span>}
                  <div className="play-rack-list">
                    {labRef.current.cartridges.map((c) => {
                      const holding = c.slot !== null ? plotRef.current.machines.find((m) => m.id === c.slot) : null;
                      return (
                        <div key={c.id} className="play-cart-item">
                          <div className="cart-head">
                            <span className={`cart-badge ${c.kind}`}>{c.kind}</span>
                            <b>{c.name}</b>
                            {holding ? (
                              <em className="cart-slotted">In {KINDS[holding.kind].name} #{holding.id}</em>
                            ) : (
                              <em className="cart-in-rack">On rack</em>
                            )}
                          </div>
                          <div className="cart-affinities">
                            {METRICS.map((m) => {
                              const diff = Math.round(((c.affinity[m] ?? 1) - 1) * 100);
                              return (
                                <span key={m} style={{ color: METRIC_COLOUR[m] }}>
                                  {METRIC_NAME[m]}: {diff === 0 ? '0%' : `${diff > 0 ? '+' : ''}${diff}%`}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                    {labRef.current.cartridges.length === 0 ? (
                      <p className="play-why">No cartridges on the rack yet. Make a blank to get started.</p>
                    ) : null}
                  </div>
                  <button className="go" onClick={close} autoFocus>Back to the lab</button>
                </section>
              );
            }

            if (labPanel === 'bench' || labPanel === 'preset-bench') {
              const job = labRef.current.bench;
              if (job !== null) {
                const p = VAULT_BY_ID.get(job.preset ?? '');
                const pct = Math.min(100, Math.round((job.done / job.needs) * 100));
                return (
                  <section className="play-machine lab-panel-bench" aria-label="Preset Bench">
                    <h3>Preset Bench</h3>
                    <p>
                      Writing <b>{p?.name ?? job.preset}</b> ({job.done.toFixed(1)}s / {job.needs}s)
                      {!stateRef.current.gateOn ? ' — Paused: no power. Turn on the gate.' : ''}
                    </p>
                    <div className="play-progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                      <div className="bar" style={{ width: `${pct}%`, background: '#ff3d8a' }} />
                    </div>
                    <button className="go" onClick={close} autoFocus>Back to the lab</button>
                  </section>
                );
              }

              const blanks = labRef.current.cartridges.filter((c) => c.kind === 'blank' && c.slot === null);
              const activeBlank = benchBlank && blanks.some((b) => b.id === benchBlank) ? benchBlank : (blanks[0]?.id ?? null);
              const writeCheck = activeBlank && benchPreset
                ? canWrite(labRef.current, labEnv, activeBlank, benchPreset)
                : { ok: false, why: !activeBlank ? 'No blank cartridges available on the rack. Make one at the rack.' : 'Pick a preset to write.' };

              return (
                <section className="play-machine lab-panel-bench" aria-label="Preset Bench">
                  <h3>Preset Bench</h3>
                  <div className="play-machine-actions" role="group" aria-label="What the bench writes">
                    <button className={benchTab === 'presets' ? 'on' : ''} aria-pressed={benchTab === 'presets'} onClick={() => setBenchTab('presets')} data-testid="bench-tab-presets">Materials</button>
                    <button className={benchTab === 'parts' ? 'on' : ''} aria-pressed={benchTab === 'parts'} onClick={() => setBenchTab('parts')} data-testid="bench-tab-parts">Parts</button>
                    <button className={benchTab === 'species' ? 'on' : ''} aria-pressed={benchTab === 'species'} onClick={() => setBenchTab('species')} data-testid="bench-tab-species">Species</button>
                    <button className={benchTab === 'lights' ? 'on' : ''} aria-pressed={benchTab === 'lights'} onClick={() => setBenchTab('lights')} data-testid="bench-tab-lights">Lights</button>
                    <button className={benchTab === 'sprites' ? 'on' : ''} aria-pressed={benchTab === 'sprites'} onClick={() => setBenchTab('sprites')} data-testid="bench-tab-sprites">Sprites</button>
                    <button className={benchTab === 'sounds' ? 'on' : ''} aria-pressed={benchTab === 'sounds'} onClick={() => setBenchTab('sounds')} data-testid="bench-tab-sounds">Sounds</button>
                    <button className={benchTab === 'harness' ? 'on' : ''} aria-pressed={benchTab === 'harness'} onClick={() => setBenchTab('harness')} data-testid="bench-tab-harness">Souls</button>
                  </div>
                  <p>{benchTab === 'parts'
                    ? 'Prints a Shape Press part onto a blank cartridge. Load it in the beam rifle and fire Apply at a part: a tap changes that part, a hold or Shift changes every part of its kind.'
                    : benchTab === 'species'
                      ? 'Prints a Water Maker species onto a blank cartridge. Load it in the beam rifle and fire Apply at a tree on the plot: a tap regrows that tree, a hold or Shift every tree of its kind nearby.'
                      : benchTab === 'lights'
                        ? 'Prints a Light Projector light onto a blank cartridge. Load it in the beam rifle and fire Apply at a machine lamp: a tap sets that lamp, a hold or Shift every lamp on the machine.'
                        : benchTab === 'sprites'
                          ? 'Prints a machine\'s turntable onto a blank cartridge, baked in the Fidelity Stage\'s own palette and dither. Load it in the beam rifle and fire Apply at a machine: its card hangs above the machine and turns at that stage\'s cadence.'
                          : benchTab === 'sounds'
                            ? 'Prints a synth patch onto a blank cartridge, played on the Fidelity Stage\'s own hardware from a 1-bit speaker to a spatial mix. Load it in the beam rifle and fire Apply at a machine: the patch becomes that machine\'s hum.'
                            : benchTab === 'harness'
                              ? 'Prints a Sovereign Harness vessel soul onto a blank cartridge. Load it in the beam rifle and enter a vehicle: the soul binds, feels its own chassis, and the Zone 8 blade shows it living.'
                      : materialShelf === 'machines'
                        ? 'Prints a machine material onto a blank cartridge: paint, then the wear on top (rust, dust, grime). Load it in the beam rifle and fire Apply at a machine part: a tap dresses that part, a hold or Shift every part that wore the same.'
                        : 'Writes an authored terraforming material onto a blank cartridge.'}</p>
                  {benchTab === 'presets' ? (
                    <div className="bench-parts-choices bench-material-shelf" role="group" aria-label="Materials for">
                      <button className={materialShelf === 'ground' ? 'on' : ''} aria-pressed={materialShelf === 'ground'} onClick={() => setMaterialShelf('ground')} data-testid="bench-shelf-ground">The ground</button>
                      <button className={materialShelf === 'machines' ? 'on' : ''} aria-pressed={materialShelf === 'machines'} onClick={() => setMaterialShelf('machines')} data-testid="bench-shelf-machines">Machines</button>
                    </div>
                  ) : null}
                  <div className="play-carts">
                    <h4>1. Pick a blank ({blanks.length} available)</h4>
                    <div>
                      {blanks.map((b) => (
                        <button
                          key={b.id}
                          className={activeBlank === b.id ? 'on' : ''}
                          onClick={() => setBenchBlank(b.id)}
                        >
                          <b>{b.id} ({b.name})</b>
                        </button>
                      ))}
                    </div>
                    {blanks.length === 0 ? <p className="play-why">No blanks on rack. Make a blank at the rack first.</p> : null}
                  </div>
                  {benchTab === 'lights' ? (
                    <BenchLights
                      mine={presetsOf(myPresets, 'light')}
                      onSave={(spec: LightSpec) => saveMyPreset({ light: spec })}
                      check={(spec) => {
                        if (!activeBlank) return { ok: false, why: 'No blanks on the rack. Make a blank at the rack first.' };
                        return canWritePrint(labRef.current, labEnv, activeBlank, { light: spec });
                      }}
                      onPrint={(spec: LightSpec) => {
                        if (!activeBlank) return;
                        const next = startPrintWrite(labRef.current, labEnv, activeBlank, { light: spec });
                        labRef.current = next;
                        commit(withLab(stateRef.current, next));
                        say('Printing started', `The bench writes ${spec.name} onto the cartridge while powered.`);
                      }}
                    />
                  ) : benchTab === 'species' ? (
                    <BenchSpecies
                      mine={presetsOf(myPresets, 'species')}
                      onSave={(spec: SpeciesSpec) => saveMyPreset({ species: spec })}
                      check={(spec) => {
                        if (!activeBlank) return { ok: false, why: 'No blanks on the rack. Make a blank at the rack first.' };
                        return canWritePrint(labRef.current, labEnv, activeBlank, { species: spec });
                      }}
                      onPrint={(spec: SpeciesSpec) => {
                        if (!activeBlank) return;
                        const next = startPrintWrite(labRef.current, labEnv, activeBlank, { species: spec });
                        labRef.current = next;
                        commit(withLab(stateRef.current, next));
                        say('Printing started', `The bench grows ${spec.name} onto the cartridge while powered.`);
                      }}
                    />
                  ) : benchTab === 'presets' && materialShelf === 'machines' ? (
                    <BenchMaterials
                      mine={presetsOf(myPresets, 'material')}
                      onSave={(print: MaterialPrintSpec) => saveMyPreset({ material: print })}
                      specOf={specOfName}
                      check={(print) => {
                        if (!activeBlank) return { ok: false, why: 'No blanks on the rack. Make a blank at the rack first.' };
                        return canWritePrint(labRef.current, labEnv, activeBlank, { material: print });
                      }}
                      onPrint={(print: MaterialPrintSpec) => {
                        if (!activeBlank) return;
                        const next = startPrintWrite(labRef.current, labEnv, activeBlank, { material: print });
                        labRef.current = next;
                        commit(withLab(stateRef.current, next));
                        say('Printing started', `The bench writes ${print.name} onto the cartridge while powered.`);
                      }}
                    />
                  ) : benchTab === 'parts' ? (
                    <BenchParts
                      mine={presetsOf(myPresets, 'part')}
                      onSave={(spec: PartSpec) => saveMyPreset({ part: spec })}
                      check={(spec) => {
                        if (!activeBlank) return { ok: false, why: 'No blanks on the rack. Make a blank at the rack first.' };
                        const c = canWritePart(labRef.current, labEnv, activeBlank, spec);
                        return c.ok ? partStockCheck(spec) : c;
                      }}
                      onPrint={(spec: PartSpec) => {
                        if (!activeBlank) return;
                        payForPart(spec);
                        const next = startPartWrite(labRef.current, labEnv, activeBlank, spec);
                        labRef.current = next;
                        commit(withLab(stateRef.current, next));
                        say('Printing started', `The bench prints ${spec.name} while powered.`);
                      }}
                    />
                  ) : benchTab === 'sprites' ? (
                    <BenchSprites
                      mine={presetsOf(myPresets, 'sprite')}
                      onSave={(spec: SpritePrintSpec) => saveMyPreset({ sprite: spec })}
                      check={(spec) => {
                        if (!activeBlank) return { ok: false, why: 'No blanks on the rack. Make a blank at the rack first.' };
                        const c = canWritePrint(labRef.current, labEnv, activeBlank, { sprite: spec });
                        return c.ok ? stockCheck(spriteBill(spec), 'sprite') : c;
                      }}
                      onPrint={(spec: SpritePrintSpec) => {
                        if (!activeBlank) return;
                        payForStock(spriteBill(spec), `sprite:${spec.kit}`);
                        const next = startPrintWrite(labRef.current, labEnv, activeBlank, { sprite: spec });
                        labRef.current = next;
                        commit(withLab(stateRef.current, next));
                        say('Printing started', `The bench turns ${spec.name} onto the cartridge while powered.`);
                      }}
                    />
                  ) : benchTab === 'sounds' ? (
                    <BenchSounds
                      mine={presetsOf(myPresets, 'sound')}
                      onSave={(spec: SoundPrintSpec) => saveMyPreset({ sound: spec })}
                      check={(spec) => {
                        if (!activeBlank) return { ok: false, why: 'No blanks on the rack. Make a blank at the rack first.' };
                        return canWritePrint(labRef.current, labEnv, activeBlank, { sound: spec });
                      }}
                      onPrint={(spec: SoundPrintSpec) => {
                        if (!activeBlank) return;
                        // a patch is data, not matter: no stock, only the blank and the bench's time
                        const next = startPrintWrite(labRef.current, labEnv, activeBlank, { sound: spec });
                        labRef.current = next;
                        commit(withLab(stateRef.current, next));
                        say('Printing started', `The bench writes ${spec.name} onto the cartridge while powered.`);
                      }}
                    />
                  ) : benchTab === 'harness' ? (
                    <BenchHarness
                      check={(spec) => {
                        if (!activeBlank) return { ok: false, why: 'No blanks on the rack. Make a blank at the rack first.' };
                        return canWritePrint(labRef.current, labEnv, activeBlank, { harness: spec });
                      }}
                      onPrint={(spec) => {
                        if (!activeBlank) return;
                        // a soul is data, not matter: no stock, only the blank and the bench's time
                        const next = startPrintWrite(labRef.current, labEnv, activeBlank, { harness: spec });
                        labRef.current = next;
                        commit(withLab(stateRef.current, next));
                        say('Printing started', `The bench writes ${spec.name} onto the cartridge while powered.`);
                      }}
                    />
                  ) : (<>
                  <div className="play-carts">
                    <h4>2. Pick a preset</h4>
                    <div className="play-select-grid">
                      {VAULT.map((p) => {
                        const locked = p.minStage > plotRef.current.stage;
                        const isSelected = benchPreset === p.id;
                        return (
                          <button
                            key={p.id}
                            className={`${isSelected ? 'on' : ''}${locked ? ' locked' : ''}`}
                            disabled={locked}
                            onClick={() => setBenchPreset(p.id)}
                          >
                            <b>{p.name}</b>
                            {locked ? <em>opens at stage {p.minStage}</em> : (
                              <span>
                                {METRICS.filter((m) => p.affinity[m] && p.affinity[m] !== 1).map((m) => `${METRIC_NAME[m]} +${Math.round(((p.affinity[m] ?? 1) - 1) * 100)}%`).join(', ') || 'neutral'}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="play-machine-actions">
                    <button
                      className="go"
                      disabled={!writeCheck.ok}
                      onClick={() => {
                        if (!activeBlank || !benchPreset) return;
                        const next = startWrite(labRef.current, labEnv, activeBlank, benchPreset);
                        labRef.current = next;
                        commit(withLab(stateRef.current, next));
                        say('Writing started', 'The bench pours pink pixels while powered.');
                      }}
                    >
                      Start writing
                    </button>
                  </div>
                  {!writeCheck.ok && <span className="play-why">{writeCheck.why}</span>}
                  </>)}
                  <button className="go" onClick={close} style={{ marginTop: '12px' }} autoFocus>Back to the lab</button>
                </section>
              );
            }

            if (labPanel === 'combiner' || labPanel === 'preset-combiner') {
              const job = labRef.current.combiner;
              if (job !== null) {
                const pct = Math.min(100, Math.round((job.done / job.needs) * 100));
                return (
                  <section className="play-machine lab-panel-combiner" aria-label="Preset Combiner">
                    <h3>Preset Combiner</h3>
                    <p>
                      Mixing {job.inputs.length} cartridges ({job.done.toFixed(1)}s / {job.needs}s)
                      {!stateRef.current.gateOn ? ' — Paused: no power. Turn on the gate.' : ''}
                    </p>
                    <div className="play-progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                      <div className="bar" style={{ width: `${pct}%`, background: '#b46bff' }} />
                    </div>
                    <button className="go" onClick={close} autoFocus>Back to the lab</button>
                  </section>
                );
              }

              const available = labRef.current.cartridges.filter((c) => c.kind !== 'blank' && c.slot === null);
              const combineCheck = canCombine(labRef.current, labEnv, combineIds);

              let previewMix: Cartridge | null = null;
              if (combineCheck.ok) {
                try {
                  const sim = stepCartlab(startCombine(labRef.current, labEnv, combineIds), labEnv, CARTLAB_RULES.combineSeconds);
                  previewMix = sim.state.cartridges.find((c) => c.kind === 'mix' && c.from.length === combineIds.length) ?? null;
                } catch {
                  previewMix = null;
                }
              }

              return (
                <section className="play-machine lab-panel-combiner" aria-label="Preset Combiner">
                  <h3>Preset Combiner</h3>
                  <p>Mixes 2 to 4 written cartridges into one enhanced cartridge.</p>
                  <div className="play-carts">
                    <h4>Pick 2 to 4 cartridges from the rack ({combineIds.length} selected)</h4>
                    <div className="play-select-grid">
                      {available.map((c) => {
                        const selected = combineIds.includes(c.id);
                        return (
                          <button
                            key={c.id}
                            className={selected ? 'on' : ''}
                            onClick={() => {
                              if (selected) {
                                setCombineIds((prev) => prev.filter((id) => id !== c.id));
                              } else if (combineIds.length < CARTLAB_RULES.maxInputs) {
                                setCombineIds((prev) => [...prev, c.id]);
                              }
                            }}
                          >
                            <b>{c.name}</b>
                            <span>
                              {METRICS.filter((m) => c.affinity[m] && c.affinity[m] !== 1).map((m) => `${METRIC_NAME[m]} +${Math.round(((c.affinity[m] ?? 1) - 1) * 100)}%`).join(', ') || 'neutral'}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    {available.length < CARTLAB_RULES.minInputs ? (
                      <p className="play-why">Need at least 2 written cartridges on the rack to combine.</p>
                    ) : null}
                  </div>

                  {previewMix ? (
                    <div className="play-combine-preview">
                      <h4>Preview: {previewMix.name}</h4>
                      <div className="cart-affinities">
                        {METRICS.map((m) => {
                          const diff = Math.round(((previewMix!.affinity[m] ?? 1) - 1) * 100);
                          return (
                            <span key={m} style={{ color: METRIC_COLOUR[m] }}>
                              {METRIC_NAME[m]}: {diff === 0 ? '0%' : `${diff > 0 ? '+' : ''}${diff}%`}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  <div className="play-machine-actions">
                    <button
                      className="go"
                      disabled={!combineCheck.ok}
                      onClick={() => {
                        const next = startCombine(labRef.current, labEnv, combineIds);
                        labRef.current = next;
                        commit(withLab(stateRef.current, next));
                        setCombineIds([]);
                        say('Mixing started', 'The combiner pours violet pixels while powered.');
                      }}
                    >
                      Start mix
                    </button>
                  </div>
                  {!combineCheck.ok && combineIds.length > 0 && <span className="play-why">{combineCheck.why}</span>}
                  <button className="go" onClick={close} style={{ marginTop: '12px' }} autoFocus>Back to the lab</button>
                </section>
              );
            }

            return null;
          })() : null}
          {dialOpen ? (() => {
            const gate = envRef.current?.gate ?? sceneRef.current?.debug.gatePlanet() ?? { x: 0, z: 0 };
            const codeRes = encodePlot(stateRef.current, gate);
            const myCode = codeRes.ok ? codeRes.code : '';
            // how many plots a stranger may dial at random right now (your own gate is never one of them)
            const openNow = openGateCount(gateDirectory(ownGateEntry({ plotId: ownPlotId, access: gateAccess })));
            const close = (): void => { stopGateDial(); setDialOpen(false); lock(); };
            return (
              <section className="play-machine play-dial-panel" aria-label="Gate Plot Dial">
                <h3>Gate Plot Dial</h3>
                <p>Dial a friend&rsquo;s plot code to open the gate onto their world, or copy yours to share.</p>

                {/* JOB-09: the Earth endgame's monument. It stands on the Earth plot only, and it is a readout — the sandbox
                    (building, driving, cartridges) is never taken away to show it. */}
                {(() => {
                  const state = earthEndgameState(endgameInputNow());
                  if (state.biome.world !== 'earth') return null;
                  return (
                    <div className="play-dial-section play-endgame-monument">
                      <h4>{state.monument.title}</h4>
                      <p>{state.monument.subtitle}</p>
                      <ul className="play-endgame-lines">
                        {state.monument.lines.map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                      <p className="play-why">{state.monument.stats.map((s) => `${s.label} ${s.value}`).join(' · ')}</p>
                      <p className="hint">
                        {state.telemetry.powered
                          ? `Gates linked${state.telemetry.returnDial.ready ? ` · return dial ${state.telemetry.returnDial.code} is live` : ''}`
                          : 'The gate has no power: the two worlds are not linked yet.'}
                        {state.credits ? ` · credits ${Math.round(creditsProgress(state.credits, state.credits.startedAt) * 100)}%` : ''}
                      </p>
                    </div>
                  );
                })()}

                <div className="play-dial-section">
                  <h4>Your plot&rsquo;s code</h4>
                  <div className="play-dial-row">
                    <input type="text" readOnly value={myCode} className="play-dial-code" onFocus={(e) => e.target.select()} />
                    <button
                      onClick={() => {
                        if (myCode) {
                          navigator.clipboard?.writeText(myCode).catch(() => {});
                          say('Code copied', 'Share it with a friend so they can visit your plot.');
                        }
                      }}
                    >
                      Copy
                    </button>
                  </div>
                </div>

                {(() => {
                  const plot = plotRef.current;
                  const biome = baseWorldRef.current.biome ?? MOON_BIOME_PRESET;
                  const unlock = earthPlotUnlock(plot.stage, {
                    pxd: level(plot, 'pxd'),
                    vtx: level(plot, 'vtx'),
                    lx: level(plot, 'lx'),
                    aq: level(plot, 'aq'),
                  });
                  const onEarth = biome.world === 'earth';
                  return (
                    <div className="play-dial-section">
                      <h4>Your plots</h4>
                      <p>{unlock.reason}</p>
                      <p className="play-why">
                        {biome.label}: {biome.species.length} species slots on {biome.terrain.material}, sky {biome.sky.lamp}.
                      </p>
                      <div className="play-dial-row">
                        <button
                          className={onEarth ? 'on' : ''}
                          aria-pressed={onEarth}
                          disabled={!unlock.unlocked || onEarth}
                          onClick={() => dispatchBase({ t: 'setBiome', preset: EARTH_BIOME_PRESET })}
                        >
                          Earth plot
                        </button>
                        <button
                          className={!onEarth ? 'on' : ''}
                          aria-pressed={!onEarth}
                          disabled={!onEarth}
                          onClick={() => dispatchBase({ t: 'setBiome', preset: MOON_BIOME_PRESET })}
                        >
                          Moon plot
                        </button>
                      </div>
                    </div>
                  );
                })()}

                <div className="play-dial-section">
                  <h4>Who can dial in</h4>
                  <p>The iris is the lock: open lists your gate on the network, code-only answers only the code below, and closed turns visitors away (you can still dial out).</p>
                  <div className="play-dial-row">
                    {GATE_ACCESS_MODES.map((mode) => (
                      <button
                        key={mode}
                        className={gateAccess === mode ? 'on' : ''}
                        aria-pressed={gateAccess === mode}
                        onClick={() => {
                          if (mode === gateAccess) return;
                          // the world decides (and refuses a state it already holds); its event paints the buttons
                          dispatchBase({ t: 'setGateAccess', access: mode });
                        }}
                      >
                        {GATE_ACCESS_LABEL[mode]}
                      </button>
                    ))}
                  </div>
                  {visiting ? <p className="play-why">You are standing on someone else&rsquo;s plot: this is your gate&rsquo;s lock, not theirs.</p> : null}
                </div>

                <div className="play-dial-section">
                  <h4>Move the gate</h4>
                  <p>Walk the ring along its own facing or turn it on the spot; the pad a traveller lands on stays in front of it.</p>
                  <div className="play-dial-row">
                    <button onClick={() => nudgeGate(4, 0)} aria-label="Move the gate forward 4 m">Forward 4 m</button>
                    <button onClick={() => nudgeGate(-4, 0)} aria-label="Move the gate back 4 m">Back 4 m</button>
                  </div>
                  <div className="play-dial-row">
                    <button onClick={() => nudgeGate(0, Math.PI / 4)} aria-label="Turn the gate a quarter turn left">&larr; Turn</button>
                    <button onClick={() => nudgeGate(0, -Math.PI / 4)} aria-label="Turn the gate a quarter turn right">Turn &rarr;</button>
                  </div>
                </div>

                <div className="play-dial-section">
                  <h4>Dial random gate</h4>
                  <p>
                    Six chevrons lock, one every {CHEVRON_LOCK_SECONDS.toFixed(2)} s, onto an open plot you have not walked
                    yet. {openNow} {openNow === 1 ? 'plot is' : 'plots are'} open to strangers from your address.
                  </p>
                  <div className="play-dial-row">
                    <button className="go" disabled={gateDial !== null} onClick={dialRandom}>
                      {gateDial ? <span>Locking <b>{gateDial.locked}/{GATE_CHEVRON_COUNT}</b> &middot; {gateDial.code.split('').map((c, i) => <kbd key={`${c}-${i}`} className={i < gateDial.locked ? 'on' : ''}>{c}</kbd>)}</span> : 'Dial Random Gate'}
                    </button>
                  </div>
                  {randomError ? <p className="play-why">{randomError}</p> : null}
                </div>

                <div className="play-dial-section">
                  <h4>Dial a plot</h4>
                  <div className="play-dial-row">
                    <input
                      type="text"
                      placeholder="Paste plot code here..."
                      value={dialInput}
                      onChange={(e) => { setDialInput(e.target.value); setDialError(null); }}
                      className="play-dial-input"
                    />
                    <button
                      className="go"
                      disabled={!dialInput.trim()}
                      onClick={() => {
                        const res = dial(dialInput.trim());
                        if (res.ok) {
                          close();
                        } else {
                          setDialError(res.why ?? 'That code is damaged.');
                        }
                      }}
                    >
                      Dial
                    </button>
                  </div>
                  {dialError ? <p className="play-why">{dialError}</p> : null}
                </div>

                {visiting ? (
                  <div className="play-machine-actions">
                    <button onClick={() => { endVisit(); say('Returned to own plot', 'The gate opens onto your own world.'); }}>
                      Return to your own plot
                    </button>
                  </div>
                ) : null}

                <button className="go" onClick={close} style={{ marginTop: '12px' }} autoFocus>
                  Back to the lab
                </button>
              </section>
            );
          })() : null}
          {!cleanShotMode && !locked && !paused && panel === null && labPanel === null && !dialOpen && !menu && !isAnyBaseWindowOpen ? (
            <button className="play-start" onClick={lock}>
              <b>Click to look around</b>
              <span className="play-keys">{KEYS.map(([k, what]) => <span key={k}><kbd>{k}</kbd>{what}</span>)}</span>
            </button>
          ) : null}
          {radial !== null ? (
            <RadialMenu
              slices={radial.items.map((it, i) => ({ id: it.id, label: it.label, thumb: radialThumbs[i] ?? null, locked: it.locked }))}
              hint={radial.hint}
              emptyState={radial.emptyState}
              onPick={(id) => { radial.pick(id); closeRadial(); }}
              onClose={closeRadial}
            />
          ) : null}
          {removeHolding && radial === null && !paused ? <HoldRing ms={REMOVE_HOLD_MS} /> : null}
          {paused && journalOpen && !isAnyBaseWindowOpen ? (
            <div className="play-pause journal-pause" role="dialog" aria-label="Journal">
              <Journal
                chain={state.chain}
                counts={state.chain.counts}
                plotTitle={plotGoal.title}
                plotHint={plotGoal.hint}
                onStudio={props.onStudio ? () => {
                  updateChain((c) => bump(c, COUNT.studioOpen));
                  narratorRef.current?.trigger('studio:open');
                  props.onStudio?.();
                } : undefined}
                onClose={() => setJournalOpen(false)}
              />
            </div>
          ) : null}
          {paused && !journalOpen && !debugOpen && !isAnyBaseWindowOpen ? (
            <div className="play-pause" role="dialog" aria-label="Paused">
              <h2>{props.gamePreset ? props.gamePreset.title : 'Paused'}</h2>
              <div className="play-pause-sync">
                <span>Simulation Mode:</span>
                <b className={syncMode === 'synced' ? 'synced' : 'desynced'}>
                  {props.gamePreset ? 'Standalone preset · campaign save untouched' : syncMode === 'synced' ? 'Planetary Grid (Synced Shared World)' : 'Expedition (Desynced Solo Branch)'}
                </b>
              </div>
              <section className="play-controls" aria-label="Controls">
                <h4>Controls</h4>
                <ControlsGrid controls={CONTROLS} />
              </section>
              <button className="go" onClick={() => { setJournalOpen(false); lock(); }}>Resume</button>
              {props.gamePreset && props.onGamePreset ? <button type="button" onClick={() => props.onGamePreset?.(props.gamePreset!)}>Restart preset</button> : null}
              <button hidden={!!props.gamePreset}
                onClick={() => {
                  const next = syncMode === 'synced' ? 'desynced' : 'synced';
                  setSyncMode(next);
                  narratorRef.current?.trigger(next === 'synced' ? 'sync:on' : 'sync:off');
                  say(
                    next === 'synced' ? 'Connected to Planetary Grid' : 'Desynced to Solo Branch',
                    next === 'synced' ? 'Majority consensus active on Sector 4.' : 'Playing solo offline. Changes are local.',
                  );
                }}
              >
                {syncMode === 'synced' ? 'Desync to Solo Branch' : 'Sync to Planetary Grid (Majority Merge)'}
              </button>
              <button hidden={!!props.gamePreset} type="button" onClick={() => setJournalOpen(true)}>Journal</button>
              <button type="button" onClick={() => setDebugOpen(true)} data-testid="debug-open">Debug menu</button>
              <button hidden={!!props.gamePreset}
                onClick={() => {
                  setRadioLogOpen(true);
                  initNarratorAudio();
                }}
              >
                📻 Radio Comms Log ({heardLogs.length})
              </button>
              <button onClick={props.onBack}>Back to FIDELITY</button>
            </div>
          ) : null}

          {paused && debugOpen && !isAnyBaseWindowOpen && debugApiRef.current ? (
            <DebugMenu api={debugApiRef.current} chain={state.chain} stage={state.plot.stage} where={hud.where} instantBuilds={instantBuilds} onInstantBuilds={setInstantBuilds} onClose={() => setDebugOpen(false)} />
          ) : null}
          {/* the tag: a screenshot with Instant builds on says so */}
          {instantBuilds ? <div className="dbg-instant-tag" data-testid="instant-builds-tag">INSTANT BUILDS</div> : null}

          {/* Mentor Subtitles (On by default) */}
          {subtitle && dialogueSettings.subtitlesEnabled && !(menu || building !== null || placingLayoutId !== null || pieceSessionRef.current) && (
            <div className="mentor-subtitle" role="region" aria-label="Mentor Radio Subtitles" data-testid="mentor-subtitle" data-hud-zone="subtitle">
              <div className="mentor-subtitle-header">
                <span className="mentor-subtitle-pip" />
                <span>DR. HADDY // FIELD RADIO</span>
              </div>
              <div className="mentor-subtitle-body">{subtitle.cleanText}</div>
            </div>
          )}

          {/* Radio Log HUD Button */}
          <button
            hidden={!!props.gamePreset}
            className={`radio-hud-btn${subtitle ? ' speaking' : ''}`}
            data-hud-zone="top-right"
            style={{
              position: 'absolute',
              top: 186,
              right: 24,
              zIndex: 40,
            }}
            onClick={() => {
              gameAudio.playUiOpen();
              setRadioLogOpen(true);
              initNarratorAudio();
              freeMouse();
            }}
            title="Open field radio communication logs"
          >
            <span>📻 COMMS</span>
            <b>({heardLogs.length})</b>
          </button>

          {/* Radio Log Modal */}
          {radioLogOpen && (
            <div className="radio-log-modal-backdrop" onClick={() => { gameAudio.playUiClose(); setRadioLogOpen(false); }}>
              <div className="radio-log-modal" onClick={(e) => e.stopPropagation()}>
                <div className="radio-log-header">
                  <div className="radio-log-title">
                    <h3>DR. GWEN HADDY // FIELD RADIO LOG</h3>
                    <span>{heardLogs.length} RECORDED</span>
                  </div>
                  <button className="radio-log-close" onClick={() => { gameAudio.playUiClose(); setRadioLogOpen(false); }}>CLOSE [ESC]</button>
                </div>
                <div className="radio-log-controls">
                  <div className="radio-log-ctl-item">
                    <label>
                      <input
                        type="checkbox"
                        checked={dialogueSettings.subtitlesEnabled}
                        onChange={(e) => {
                          const en = e.target.checked;
                          setDialogueSettings((s) => {
                            const next = { ...s, subtitlesEnabled: en };
                            saveDialogueSettings(next);
                            return next;
                          });
                          narratorRef.current?.setSubtitlesEnabled(en);
                        }}
                      />
                      SUBTITLES
                    </label>
                  </div>
                  <div className="radio-log-ctl-item">
                    <label>MASTER: {Math.round(audioSettings.master * 100)}%</label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={audioSettings.master}
                      onChange={(e) => {
                        const vol = parseFloat(e.target.value);
                        setAudioSettings((s) => ({ ...s, master: vol }));
                        gameAudio.setMasterVolume(vol);
                      }}
                    />
                  </div>
                  <div className="radio-log-ctl-item">
                    <label>MUSIC: {Math.round(audioSettings.music * 100)}%</label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={audioSettings.music}
                      onChange={(e) => {
                        const vol = parseFloat(e.target.value);
                        setAudioSettings((s) => ({ ...s, music: vol }));
                        gameAudio.setMusicVolume(vol);
                      }}
                    />
                  </div>
                  <div className="radio-log-ctl-item">
                    <label>EFFECTS: {Math.round(audioSettings.effects * 100)}%</label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={audioSettings.effects}
                      onChange={(e) => {
                        const vol = parseFloat(e.target.value);
                        setAudioSettings((s) => ({ ...s, effects: vol }));
                        gameAudio.setEffectsVolume(vol);
                      }}
                    />
                  </div>
                  <div className="radio-log-ctl-item">
                    <label>VOICE: {Math.round(audioSettings.dialogue * 100)}%</label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={audioSettings.dialogue}
                      onChange={(e) => {
                        const vol = parseFloat(e.target.value);
                        setAudioSettings((s) => ({ ...s, dialogue: vol }));
                        setDialogueSettings((s) => {
                          const next = { ...s, dialogueVolume: vol };
                          saveDialogueSettings(next);
                          return next;
                        });
                        gameAudio.setDialogueVolume(vol);
                        narratorRef.current?.setDialogueVolume(vol);
                      }}
                    />
                  </div>
                </div>
                <div style={{ padding: '0 16px 12px' }}>
                  <DiegeticRadioTunerWidget
                    activeTapeId={collectedTapes[0] ?? 'tape-01-setmix-theme'}
                    unlockedTapeIds={collectedTapes}
                    arrangement={
                      resolveRadioArrangementStyle(
                        collectedTapes[0] ?? 'tape-01-setmix-theme',
                        { Pxd: hud.plot.levels.pxd, Vtx: hud.plot.levels.vtx, Lx: hud.plot.levels.lx, Aq: hud.plot.levels.aq },
                        false,
                        hud.where === 'lab',
                      ).arrangement
                    }
                    stemGains={{
                      'shape-press-bass': hud.plot.levels.vtx,
                      'texture-mill-arp': hud.plot.levels.pxd,
                      'light-projector-pad': hud.plot.levels.lx,
                      'water-maker-lead': hud.plot.levels.aq,
                    }}
                    isHarmonicConvergenceLocked={hud.plot.stage >= 4}
                    downbeatPulse0to1={0.5}
                    onSelectTape={() => gameAudio.playBridgeFmNote(440, 2, 1.5, 0.25)}
                    onTriggerTurboBass={() => sceneRef.current?.triggerTurboBass()}
                  />
                </div>
                <div className="radio-log-list">
                  {heardLogs.length === 0 ? (
                    <div className="radio-log-empty">No transmissions recorded yet. Comms appear as events unfold.</div>
                  ) : (
                    heardLogs.map((id) => {
                      const info = getVoiceClipInfo(id);
                      return (
                        <div key={id} className="radio-log-row">
                          <span className="radio-log-row-badge">{id}</span>
                          <div className="radio-log-row-content">
                            {info?.when && <span className="radio-log-row-when">{info.when}</span>}
                            <span className="radio-log-row-text">{info?.cleanText ?? id}</span>
                          </div>
                          <button
                            className="radio-log-replay-btn"
                            onClick={() => {
                              initNarratorAudio();
                              narratorRef.current?.replay(id);
                            }}
                            title={`Replay ${id} through mentor field radio`}
                          >
                            ▶ REPLAY
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}

          {(!props.gamePreset || props.gamePreset.hudBlade === 'arena-wave-survivor' || props.gamePreset.hudBlade === 'exploration-o2') && !hideOverlays ? <MonsterHud hp={vitals.hp} maxHp={PLAYER_MAX_HP} hitAt={vitals.hitAt} hitBearing={vitals.bearing} radar={radar} seal={sealView} /> : null}
          {gunEquipped && (
            <div className={`play-crosshair${hitMarker ? ' hit' : ''}`}>
              <div className="ch-top" />
              <div className="ch-bottom" />
              <div className="ch-left" />
              <div className="ch-right" />
              <div className="ch-dot" />
              {hitMarker ? <div className="ch-hit-x">✕</div> : null}
            </div>
          )}
          {hud.where === 'planet' && !hideOverlays && showStatsOn ? (
              <div
                className="hm-draw-calls-badge"
                data-testid="draw-calls-badge"
                style={{
                  position: 'fixed',
                  top: 0,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  background: 'rgba(15, 23, 42, 0.85)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(56, 189, 248, 0.35)',
                  borderRadius: 8,
                  padding: '2px 10px',
                  fontFamily: 'Oxanium, sans-serif',
                  zIndex: 100,
                  boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                  color: '#f8fafc',
                  letterSpacing: '0.05em',
                }}
              >
                <span style={{ fontSize: 10, fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase' }}>
                  DRAWS
                </span>
                <span style={{ fontSize: 14, fontWeight: 800 }}>
                  {renderCalls}
                </span>
                <span style={{ fontSize: 11, color: '#94a3b8' }}>
                  ({baseWorldRef.current?.base.pieces.length ?? 0} PIECES)
                </span>
              </div>
          ) : null}
          {beamHud.held && hud.where === 'planet' && !hideOverlays ? (
            <div
              className="hm-beam-chip"
              data-hud-zone="bottom-right"
              data-testid="beam-mode"
              data-mode={beamHud.mode}
              data-port={beamPort?.name ?? ''}
              data-tool={beamHud.mode === 'sculpt' ? sculptTool : ''}
            >
              <div className="hm-beam-swatch-box">
                {beamHud.mode === 'apply' && beamPort ? (
                  <ThumbImg
                    thumb={{
                      item: beamPort.preset || beamPort.name,
                      tint: beamPort.colour,
                      id: beamPort.preset || beamPort.name,
                    }}
                    size={48}
                  />
                ) : beamHud.mode === 'sculpt' ? (
                  <ThumbImg thumb={{ kind: 'ramp' }} size={38} />
                ) : (
                  <ThumbImg thumb={{ item: 'tool-beam' }} size={38} />
                )}
              </div>
              <div className="hm-beam-info">
                <b>
                  {beamHud.mode === 'apply'
                    ? beamPort
                      ? `Apply: ${beamPort.name}`
                      : 'Apply: Empty Port'
                    : beamHud.mode === 'sculpt'
                      ? `Sculpt: ${SCULPT_LABEL[sculptTool]}`
                      : 'Extract: Anomaly Nodes'}
                </b>
                <span>
                  {beamHud.mode === 'apply'
                    ? beamPort
                      ? 'R / Alt+Wheel: cycle cartridge · Q: next mode'
                      : 'R: load cartridge · Q: next mode'
                    : beamHud.mode === 'sculpt'
                      ? 'R / Alt+Wheel: cycle tool · X: radial · Q: next mode'
                      : 'Hold LMB to extract · Q or wheel: next mode'}
                </span>
              </div>
            </div>
          ) : null}
          {hud.where === 'planet' && !hideOverlays && (!props.gamePreset || props.gamePreset.hudBlade === 'sandbox-freeplay' || props.gamePreset.hudBlade === 'exploration-o2') ? (
            <>
              <BaseHud
              source={baseViewSource}
              paused={paused}
              modalOpen={isAnyBaseWindowOpen}
              harvestCounter={beamHarvest}
              placedCounter={placedCounter}
              hoverSupport={hoverSupport}
              wheelCycleText={wheelCycleText}
              rotationText={rotationText}
              buildHidden={beamHud.held}
              draftingLock={featureLock('drafting', state.chain, hud.plot.stage)}
              onLocked={(why) => say('Drafting table locked', why)}
              draftingParts={(() => {
                const blanks = labRef.current.cartridges.filter((c) => c.kind === 'blank' && c.slot === null).length;
                const free = freeBlank(labRef.current);
                return (
                  <BenchParts
                    printLabel="Print cartridge"
                    mine={presetsOf(myPresets, 'part')}
                    onSave={(spec: PartSpec) => saveMyPreset({ part: spec })}
                    firstStep={1}
                    side={(
                      <p className={`hm-draft-parts-blank${free === null ? ' empty' : ''}`} data-testid="drafting-parts-blank">
                        <b>{blanks}</b> {blanks === 1 ? 'blank' : 'blanks'} on the lab rack, linked through the quantum bridge. Print takes one and loads the part into the beam rifle.
                      </p>
                    )}
                    check={(spec) => {
                      if (free === null) return { ok: false, why: 'No free blank on the lab rack. Make one at the rack in the lab.' };
                      const c = canPrintPart(labRef.current, free, spec);
                      return c.ok ? partStockCheck(spec) : c;
                    }}
                    onPrint={printPartOnTable}
                  />
                );
              })()}
              world={baseWorldRef.current}
              at={sceneRef.current?.debug.position() ?? { x: 0, z: 0 }}
              currentStructureId={currentAimedStructureIdRef.current}
              planPrompt={planPrompt}
              weaponStats={shouldShowAmmoBadge(baseWorldRef.current.equipment.sidearm) ? weaponStats(baseWorldRef.current.loadout) : null}
              ammo={gunAmmo}
              drivingSpeed={drivingSpeed}
              drivingBoostEnergy={drivingBoostEnergy}
              drivingBoosting={drivingBoosting}
              onDispatch={(cmd) => dispatchBase(cmd)}
              onPlaceLayout={(layoutId) => {
                setPlacingLayoutId(layoutId);
                placingLayoutRotationRef.current = 0;
                say('Place Layout', 'Aim at foundation ground. Press R to rotate, Click to confirm.');
              }}
              onDropPlan={(planId) => {
                dispatchBase({ t: 'dropPlan', plan: planId });
                say('Plan dropped');
              }}
              onToast={(title, sub) => say(title, sub ?? '')}
              onOpenChange={(isOpen) => {
                setBaseWindowOpen(isOpen);
                if (isOpen) {
                  quietRef.current = true;
                  document.exitPointerLock?.();
                } else {
                  quietRef.current = false;
                }
              }}
            />
          </>
          ) : null}
          {machinePickerHardpoint !== null && (
            <MachinePickerModal
              hardpointId={machinePickerHardpoint}
              world={baseWorldRef.current}
              env={getBaseEnv()}
              at={sceneRef.current?.debug.position() ?? { x: 0, z: 0 }}
              onInstall={(hpId, kind) => {
                const lock = featureLock(kind === 'fabricator' ? 'fabricator' : 'heavy', stateRef.current.chain, plotRef.current.stage);
                if (lock) { say('Locked', lock); setMachinePickerHardpoint(null); return; }
                dispatchBase({
                  t: 'install',
                  at: sceneRef.current?.debug.position() ?? { x: 0, z: 0 },
                  hardpoint: hpId,
                  kind,
                });
                setMachinePickerHardpoint(null);
              }}
              onClose={() => setMachinePickerHardpoint(null)}
            />
          )}
          {inspect !== null && (() => {
            const target = inspect;
            const curPlot = visiting ? visiting.plot : plotRef.current;
            const alive = (target.src === 'plot' ? curPlot.machines : baseWorldRef.current.machines).some((m) => m.id === target.id);
            if (!alive) return null;
            const view = inspectMachine(
              target.src === 'plot' ? { ...baseWorldRef.current, machines: [] } : baseWorldRef.current,
              { ...getBaseEnv(), ...(target.src === 'plot' ? { plot: curPlot, plotEnv: envRef.current ?? undefined } : {}) },
              target.id
            );
            return (
              <MachineInspector
                view={view}
                onAction={(a) => inspectAction(target, a)}
                onClose={closeInspect}
              />
            );
          })()}
          {refineryMachineId !== null && (
            <RefineryModal
              machineId={refineryMachineId}
              world={baseWorldRef.current}
              env={getBaseEnv()}
              at={sceneRef.current?.debug.position() ?? { x: 0, z: 0 }}
              onCraft={(machId, recipeId) => {
                const lock = featureLock('heavy', stateRef.current.chain, plotRef.current.stage);
                if (lock) { say('Locked', lock); return; }
                dispatchBase({
                  t: 'craft',
                  at: sceneRef.current?.debug.position() ?? { x: 0, z: 0 },
                  machine: machId,
                  recipe: recipeId,
                });
              }}
              onCollect={(machId) => {
                dispatchBase({
                  t: 'collect',
                  machine: machId,
                });
              }}
              onClose={() => setRefineryMachineId(null)}
            />
          )}
          {fabricatorMachineId !== null && (
            <FabricatorModal
              machineId={fabricatorMachineId}
              world={baseWorldRef.current}
              env={getBaseEnv()}
              at={sceneRef.current?.debug.position() ?? { x: 0, z: 0 }}
              onCraft={(mId, rId) => {
                const lock = featureLock('fabricator', stateRef.current.chain, plotRef.current.stage);
                if (lock) { say('Locked', lock); return; }
                dispatchBase({ t: 'craft', at: sceneRef.current?.debug.position() ?? { x: 0, z: 0 }, machine: mId, recipe: rId });
              }}
              onClose={() => setFabricatorMachineId(null)}
            />
          )}
          {weaponBenchOpen && (
            <WeaponBenchModal
              world={baseWorldRef.current}
              env={getBaseEnv()}
              at={(() => {
                const wb = baseWorldRef.current.base.pieces.find((p) => p.kind === 'weaponBench');
                const pt = wb ? pieceAt(baseWorldRef.current.base, wb) : null;
                return pt ? { x: pt.x, z: pt.z } : (sceneRef.current?.debug.position() ?? { x: 0, z: 0 });
              })()}
              onForge={(item) => {
                const wb = baseWorldRef.current.base.pieces.find((p) => p.kind === 'weaponBench');
                const pt = wb ? pieceAt(baseWorldRef.current.base, wb) : null;
                const forgeAt = pt ? { x: pt.x, z: pt.z } : (sceneRef.current?.debug.position() ?? { x: 0, z: 0 });
                dispatchBase({ t: 'forge', at: forgeAt, item });
              }}
              onFit={(slot, item) => {
                dispatchBase({ t: 'fit', slot, item });
              }}
              onClose={() => setWeaponBenchOpen(false)}
            />
          )}
          {planetTableOpen && (() => {
            const gate = envRef.current?.gate ?? sceneRef.current?.debug.gatePlanet() ?? { x: 0, z: 0 };
            const r = state.avatar && plotRef.current.machines.length > 0 ? encodePlot(stateRef.current, gate) : null;
            return (
              <div className="shell-layer shell-ui" style={{ zIndex: 1000 }}>
                <PlanetaryGridScreen
                  myCode={r && r.ok ? r.code : null}
                  codeNote={r && !r.ok ? r.why : undefined}
                  gateOn={state.gateOn}
                  slot={null}
                  syncMode={syncMode}
                  recent={loadRecentCodes()}
                  onToggleSync={() => {
                    setSyncMode((prev) => (prev === 'synced' ? 'desynced' : 'synced'));
                  }}
                  onVisit={(code) => {
                    setPlanetTableOpen(false);
                    dialRef.current?.(code);
                  }}
                  onSpawn={() => setPlanetTableOpen(false)}
                  onBack={() => setPlanetTableOpen(false)}
                />
              </div>
            );
          })()}
          {toast && !isAnyBaseWindowOpen && !hideOverlays ? <div key={toast.id} className={`play-toast${toast.text === 'Sync lost' ? ' lost' : ''}${toast.text.length > 20 ? ' long' : ''}`} role="status" data-hud-zone="title"><b>{toast.text}</b>{toast.sub ? <span>{toast.sub}</span> : null}</div> : null}
          {statusToast && !isAnyBaseWindowOpen && !hideOverlays ? (
            <div key={statusToast.id} className="hm-status-toast" role="status" data-testid="status-toast">
              <span className="hm-status-toast-icon">⚠</span>
              <span className="hm-status-toast-text">{statusToast.text}</span>
            </div>
          ) : null}
          {baseWorldVersion > 0 && <span style={{ display: 'none' }} data-base-version={baseWorldVersion} />}
        </>
      ) : null}
    </div>
  );
}
