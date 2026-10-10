// Play (owner, 2026-10-07; STATUS SM22, SM30): the lab in first person, your human made there, the gate turned on, the stage-0
// planet looked round, the first machine placed; then the plot's game loop (`@hm/plotsim`): mine ore, run power out, build the
// machines whose pixels raise the plot's four fidelity metrics, and climb the six stages. The scene is play-scene.ts, the
// tutorial quest.ts; this screen loads them behind a bar, reads your keys and mouse, runs the plot, saves, and says what to do.
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactElement } from 'react';
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
import { canPlace, KINDS, level, METRICS, network, place, rates, remove as removeMachine, running, setCartridge, setOn, step as stepPlot, type Env, type MachineKind, type Metric, type PlotState } from '@hm/plotsim';
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
  step as stepCartlab,
  unslot,
  type Cartridge,
  type LabEnv,
  type LabState,
} from '@hm/cartlab';
import { fx } from '../maker/feedback';
import { FRESH, METRIC_COLOUR, METRIC_NAME, SAVE_KEY, arrived, created, isFreeDrill, loadState, objective, poweredOn, returned, withLab, withPlot, type PlayState } from './quest';
import { encodePlot, decodePlot, plotOfSnapshot } from './plot-code';
import type { Snapshot } from '@hm/plotcodec';
import type { MobStatus, CombatStats } from './monster-mash-combat';
import { captureMouse, lookFilter } from '../shell/capture-mouse';
import { BaseHud } from '../base/ui/base-hud';
import { mockBaseViewSource } from '../base/mock-view';
import { createWorldViewSource, WorldViewSource, formatRefusalToast } from '../base/world-view';
import { createWorld, apply, pieceAt, preview, BRIDGE_RANGE, BEAM_RANGE, type BaseWorld, type BaseCommand, type WorldEnv } from '../base/world';
import { PieceMeshManager } from '../base/piece-meshes';
import { createStandInPiece } from '../base/stand-in-pieces';
import { blueprint, STARTER, ITEMS } from '../base/catalog';
import { MachinePickerModal } from '../base/ui/machine-picker-modal';
import { RefineryModal } from '../base/ui/refinery-modal';
import * as S from '@hm/structure';
import type { Kind } from '@hm/structure';
import * as L from '@hm/lattice';
import '../base/base.css';
import './play.css';

/** Your plot's cartridge until the ground shader battle lands: sandy desert tones, the nearest in the vault to the concept art's stage 1. */
const PLOT = 'crater_calcite';
const SYNC_BLOCKS = 20;
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
const detailOf = (g: GraphicsSettings, q: Quality): Detail => ({ plumes: g.pixelPlumes, plumeDensity: g.plumeDensity, groundBudget: GROUND_BUDGET[q], planetLines: PLANET_LINES[q], plumeGlow: g.plumeGlow, pixelLights: g.pixelLights });
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

import { kv } from '../storage/profile-storage';

function loadSaved(): PlayState { try { return loadState(JSON.parse(kv.get(SAVE_KEY) ?? 'null')); } catch { return FRESH; } }
function save(s: PlayState): void { try { kv.set(SAVE_KEY, JSON.stringify(s)); } catch { /* storage unavailable: progress lives for this visit */ } }

/** The plot's numbers for the HUD. */
interface PlotHud { readonly ore: number; readonly oreRate: number; readonly supply: number; readonly demand: number; readonly levels: Readonly<Record<Metric, number>>; readonly stage: number }
interface Hud { readonly where: FrameOut['where']; readonly sync: number; readonly atLever: boolean; readonly atDial: boolean; readonly ghost: FrameOut['ghost']; readonly aimed: number | null; readonly aimedBoulder: FrameOut['aimedBoulder']; readonly aimedLab: FrameOut['aimedLab']; readonly plot: PlotHud; readonly visitingOwner: string | null }
const NO_PLOT: PlotHud = { ore: 0, oreRate: 0, supply: 0, demand: 0, levels: { pxd: 0, vtx: 0, lx: 0, aq: 0 }, stage: 0 };
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
const KEYS: readonly [string, string][] = [['W A S D', 'walk'], ['Mouse', 'look'], ['Shift', 'run'], ['V', 'view'], ['E', 'use'], ['B', 'build'], ['Esc', 'pause']];

export function PlayScreen(props: {
  readonly profile: Profile;
  readonly onBack: () => void;
  readonly initialSyncMode?: 'desynced' | 'synced';
}): ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<PlayScene | null>(null);
  const reduced = useMemo(() => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } }, []);
  const tier = useMemo(() => tierFor(props.profile), [props.profile.quality]); // eslint-disable-line react-hooks/exhaustive-deps
  const [syncMode, setSyncMode] = useState<'desynced' | 'synced'>(() => props.initialSyncMode ?? 'desynced');
  const [state, setState] = useState<PlayState>(loadSaved);
  const stateRef = useRef(state);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState('Opening the lab');
  const [failed, setFailed] = useState(false);
  const [locked, setLocked] = useState(false);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  useEffect(() => { pausedRef.current = paused; }, [paused]);
  const [menu, setMenu] = useState(false);
  const [building, setBuilding] = useState<MachineKind | null>(null);
  const [hud, setHud] = useState<Hud>({ where: 'lab', sync: 1, atLever: false, atDial: false, ghost: null, aimed: null, aimedBoulder: null, aimedLab: null, plot: NO_PLOT, visitingOwner: null });
  const firstGatherRef = useRef(false);
  /** The machine whose panel is open (its plot id). */
  const [panel, setPanel] = useState<number | null>(null);
  /** The lab machine whose panel is open ('rack' | 'bench' | 'combiner'). */
  const [labPanel, setLabPanel] = useState<LabMachineKind | null>(null);
  const [benchBlank, setBenchBlank] = useState<string | null>(null);
  const [benchPreset, setBenchPreset] = useState<string | null>(null);
  const [combineIds, setCombineIds] = useState<readonly string[]>([]);
  /** State of visiting another player's plot via code. */
  const [visiting, setVisiting] = useState<{ readonly snapshot: Snapshot; readonly plot: PlotState; readonly lab: LabState } | null>(null);
  const visitingRef = useRef<{ readonly snapshot: Snapshot; readonly plot: PlotState; readonly lab: LabState } | null>(null);
  const [dialOpen, setDialOpen] = useState(false);
  const [dialInput, setDialInput] = useState('');
  const [dialError, setDialError] = useState<string | null>(null);
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
  const isMashTest = typeof location !== 'undefined' && (new URLSearchParams(location.search).has('mash') || new URLSearchParams(location.search).has('monstermash'));
  const isBase = typeof location !== 'undefined' && (new URLSearchParams(location.search).has('base') || new URLSearchParams(location.search).has('building'));
  const creating = state.step === 'create' && !isMashTest;

  const commit = useCallback((next: PlayState) => { stateRef.current = next; setState(next); save(next); }, []);
  const say = useCallback((text: string, sub = '') => setToast({ text, sub, id: Date.now() }), []);
  useEffect(() => {
    if (!toast) return undefined;
    const t = window.setTimeout(() => setToast((x) => (x?.id === toast.id ? null : x)), 3200);
    return () => window.clearTimeout(t);
  }, [toast]);

  const createSeededBaseWorld = (): BaseWorld => {
    const w = createWorld();
    const slots = w.player.slots.slice();
    slots[0] = { item: STARTER, n: 1 };
    slots[1] = { item: 'ore', n: 50 };
    slots[2] = { item: 'ore', n: 50 };
    slots[3] = { item: 'ore', n: 50 };
    slots[4] = { item: 'ore', n: 50 };
    slots[5] = { item: 'ore', n: 50 };
    slots[6] = { item: 'ore', n: 50 };
    slots[7] = { item: 'prim-cube', n: 15 };
    slots[8] = { item: 'prim-chassis', n: 8 };
    slots[9] = { item: 'map-basalt', n: 10 };
    slots[10] = { item: 'pxd-mono', n: 80 };
    slots[11] = { item: 'vtx-rough', n: 80 };
    slots[12] = { item: 'prim-beam', n: 8 };
    slots[13] = { item: 'ore', n: 50 };
    slots[14] = { item: 'ore', n: 50 };
    slots[15] = { item: 'ore', n: 50 };
    slots[16] = { item: 'ore', n: 50 };
    slots[17] = { item: 'ore', n: 50 };
    slots[18] = { item: 'ore', n: 50 };
    return {
      ...w,
      player: {
        ...w.player,
        maxKg: 1200,
        slots,
      },
    };
  };

  const baseWorldRef = useRef<BaseWorld>(isBase ? createSeededBaseWorld() : createWorld());
  const pieceManagerRef = useRef<PieceMeshManager>(new PieceMeshManager());
  const buildKindRef = useRef<Kind | null>(null);
  const ghostKindRef = useRef<Kind | null>(null);
  const lastPreviewRef = useRef<{
    prev: { snap: S.Snap | null; cost: readonly L.Stack[]; short: readonly L.Stack[] };
    aim: { x: number; y: number; z: number; yaw: number };
    bp: { id: string; name: string };
    kind: Kind;
  } | null>(null);
  const dispatchBaseRef = useRef<(cmd: BaseCommand) => void>(() => {});
  const tryPlaceBaseRef = useRef<() => boolean>(() => false);
  const [machinePickerHardpoint, setMachinePickerHardpoint] = useState<number | null>(null);
  const [refineryMachineId, setRefineryMachineId] = useState<number | null>(null);
  const [baseWindowOpen, setBaseWindowOpen] = useState(false);
  const [beamHarvest, setBeamHarvest] = useState<{ count: number; name: string; fading?: boolean } | null>(null);
  const beamHarvestTimerRef = useRef<number | null>(null);
  const forceBeamRef = useRef<number | null>(null);
  const isAnyBaseWindowOpen = baseWindowOpen || machinePickerHardpoint !== null || refineryMachineId !== null;
  const hardpointToPlotMachineRef = useRef<Map<number, number>>(new Map());
  const isLmbDownRef = useRef(false);
  const harvestAccRef = useRef(0);
  const baseEnvRef = useRef<WorldEnv | null>(null);

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
    };
    baseEnvRef.current = env;
    return env;
  }, []);

  const baseViewSource = useMemo(() => {
    if (!isBase) return mockBaseViewSource;
    return createWorldViewSource({
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
  }, [isBase, getBaseEnv]);

  const dispatchBase = useCallback((cmd: BaseCommand) => {
    const scene = sceneRef.current;
    const bEnv = getBaseEnv();
    const prevField = baseWorldRef.current.field;
    const res = apply(baseWorldRef.current, bEnv, cmd);
    baseWorldRef.current = res.world;

    for (const ev of res.events) {
      if (ev.type === 'refused') {
        say(formatRefusalToast(ev));
      } else if (ev.type === 'placed') {
        say(`${ev.kind.toUpperCase()} constructed.`);
      } else if (ev.type === 'removed') {
        say(
          'Piece deconstructed.',
          ev.collapsed.length > 0 ? `${ev.collapsed.length} piece(s) collapsed.` : ''
        );
        pieceManagerRef.current.handleRemoval(ev.id, ev.collapsed);
      } else if (ev.type === 'drafted') {
        say(`Drafted Blueprint: ${ev.blueprint}`);
      } else if (ev.type === 'stacked') {
        say(`Deposited ${ev.n} item(s) to Quantum Lattice.`);
      } else if (ev.type === 'door') {
        say(ev.open ? 'Airlock opened.' : 'Airlock closed.');
      } else if (ev.type === 'harvested') {
        let totalHarvested = 0;
        let itemName = 'Raw Material';
        for (const item of ev.items) {
          totalHarvested += item.n;
          itemName = ITEMS[item.item]?.name ?? item.item;
        }
        setBeamHarvest((prev) => ({
          count: (prev ? prev.count : 0) + totalHarvested,
          name: itemName,
          fading: false,
        }));
        if (beamHarvestTimerRef.current !== null) {
          window.clearTimeout(beamHarvestTimerRef.current);
        }
        beamHarvestTimerRef.current = window.setTimeout(() => {
          setBeamHarvest((prev) => (prev ? { ...prev, fading: true } : null));
          beamHarvestTimerRef.current = window.setTimeout(() => {
            setBeamHarvest(null);
          }, 400);
        }, 2000);

        fx('relay-click', { minGapMs: 80 });
        if (ev.lost.length > 0) {
          say('Pack full', 'Storage lost: cannot fit cargo');
        }
      } else if (ev.type === 'finished') {
        say(`Refined: ${ev.n}x ${ITEMS[ev.item]?.name ?? ev.item}`, 'Ready for collection');
        fx('snap');
      } else if (ev.type === 'installed') {
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
              scene?.setPlot(nextPlot, running(nextPlot, envRef.current), network(nextPlot, envRef.current).connected);
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
      }
    }

    if (res.world.field !== prevField || res.events.some((e) => e.type === 'harvested' || e.type === 'stage')) {
      scene?.setNodes(res.world.field);
    }

    const integrity = (baseViewSource as WorldViewSource).get?.()?.build?.integrity ?? false;
    pieceManagerRef.current.sync(baseWorldRef.current, bEnv, integrity);
    (baseViewSource as WorldViewSource).notify?.();
  }, [say, baseViewSource, getBaseEnv, commit]);

  dispatchBaseRef.current = dispatchBase;

  const tryPlaceBase = useCallback((): boolean => {
    const lp = lastPreviewRef.current;
    if (!lp || !lp.prev.snap) return false;
    const { snap, short } = lp.prev;
    if (!snap.ok || short.length > 0) {
      if (short.length > 0) {
        say(`Missing: ${short.map((s) => `${s.n} ${ITEMS[s.item]?.name ?? s.item}`).join(', ')}`);
      } else if (snap.why) {
        say(`Cannot place: ${snap.why}`);
      }
      return false;
    }
    if (snap.mode === 'place') {
      const { mat, id, ...pieceSpec } = snap.piece as any;
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

  // ---- Monster Mash combat states & firing action
  const [mashOpen, setMashOpen] = useState(false);
  const [mashEquipped, setMashEquipped] = useState(false);
  const [hitMarker, setHitMarker] = useState(false);
  const [mashAmmo, setMashAmmo] = useState({ current: 8, max: 8 });
  const [mashMobs, setMashMobs] = useState<readonly MobStatus[]>([]);
  const [mashStats, setMashStats] = useState<CombatStats>({ mobsSpawned: 0, mobsDefeated: 0, damageDealt: 0, shotsFired: 0, pelletsHit: 0, oreCollected: 0 });
  const [mashStage, setMashStage] = useState<number>(0);
  const hitMarkerTimeout = useRef<number | null>(null);

  const fireWeapon = useCallback(() => {
    const scene = sceneRef.current;
    if (!scene || !scene.mash.isEquipped()) return;
    const res = scene.mash.fire();
    if (res.fired) {
      setMashAmmo(scene.mash.getAmmo());
      setMashStats(scene.mash.getStats());
      setMashMobs(scene.mash.getMobList());
      if (res.hits > 0) {
        setHitMarker(true);
        if (hitMarkerTimeout.current) window.clearTimeout(hitMarkerTimeout.current);
        hitMarkerTimeout.current = window.setTimeout(() => setHitMarker(false), 110);
        if (res.killed > 0) {
          say('Monster neutralized!', `+${res.killed * 50} Biomass Ore recovered.`);
        }
      }
    }
  }, [say]);

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
        avatar: stateRef.current.avatar,
      });
    } catch {
      setFailed(true);
      return undefined;
    }
    sceneRef.current = scene;
    if (typeof window !== 'undefined') {
      (window as any).__playScene = scene;
    }
    const size = (): void => {
      const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
      scene.resize(w, h, pixelRatioFor(graphics, w, h, window.devicePixelRatio || 1));
    };
    size();
    window.addEventListener('resize', size);

    const look = (id: string, st: Stage) => bakeLookCached(VAULT_BY_ID.get(id)!, st, device, gridSpacing);
    const steps: [string, () => void][] = [
      ...SMOOTH_IDS.map((id): [string, () => void] => ['Shaping the boulders', () => { smoothModel(id); }]),
      ['Building your plot', () => { look(PLOT, 1); }],
      ...[...new Set(NEIGHBOURS.map((n) => `${n.cartridge}@${n.stage}`))].map((k): [string, () => void] => {
        const [id, st] = k.split('@') as [string, string];
        return ['Finding the neighbours', () => { look(id, Number(st) as Stage); }];
      }),
      ['Opening the lab', () => {
        scene.setPlanet(look(PLOT, 1), look(PLOT, 1), NEIGHBOURS.map((plot) => ({ plot, look: look(plot.cartridge, plot.stage) })));
        env = { gate: scene.debug.gatePlanet(), plotRadius: 500, richness: (x, z) => scene.richness(x, z), affinity: (id, metric) => cartlabAffinityOf(labRef.current, id, metric) };
        envRef.current = env;
        plotRef.current = stateRef.current.plot;
        scene.restore({ gateOn: stateRef.current.gateOn, plot: plotRef.current, running: running(plotRef.current, env), connected: network(plotRef.current, env).connected });
        if (isBase) {
          const gate = scene.debug.gatePlanet();
          const bEnv = { heightAt: (x: number, z: number) => scene.heightAt(x, z), bridge: { x: gate.x, z: gate.z, range: BRIDGE_RANGE } };
          baseEnvRef.current = bEnv;
          scene.setPieces(pieceManagerRef.current.getMeshes());
          scene.setNodes(baseWorldRef.current.field);
          pieceManagerRef.current.sync(baseWorldRef.current, bEnv, false);
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
        }
      }],
      ['Compiling shaders', () => { scene.warm(); }],
    ];
    const hook = { frames: 0, ready: false, step: stateRef.current.step, where: 'lab', sync: 1, wave: -1, triangles: 0, calls: 0, tier: tier as Quality };
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
      if (!canPlace(checkPlot, env, kind, x, z).ok) return false;
      const placed = place(checkPlot, env, kind, x, z, yaw);
      const after = isFree ? { ...placed, ore: before.ore } : placed;
      plotRef.current = after;
      commit(withPlot(stateRef.current, after));
      scene.setPlot(after, running(after, env), network(after, env).connected);
      fx('mill-start');
      scene.playAction('plant');
      if (after.stage > before.stage) scene.raiseStage(after.stage, { x, z });
      return true;
    };
    placeRef.current = tryPlace;
    const onKey = (e: KeyboardEvent, down: boolean): void => { if (down) keys.add(e.code); else keys.delete(e.code); };
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
        if (scene.mash.isEquipped()) {
          fireWeapon();
        } else if (isBase) {
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
      }
    };
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku); window.addEventListener('mousemove', onMove);
    window.addEventListener('mousedown', onMouseDown); window.addEventListener('mouseup', onMouseUp);
    const loop = (ms: number): void => {
      if (cancelled) return;
      const frameMs = ms - last;
      const dt = Math.min(0.1, frameMs / 1000);
      last = ms;
      if (isBase) {
        pieceManagerRef.current.update(dt);
        const w = baseWorldRef.current;
        const playerPos = scene.debug.position();

        // 1. Tick accumulator for 100ms ticks (node regrowth, beam extraction, machine refinement)
        harvestAccRef.current += dt;
        const aimedNode = scene.aimNode(w.field, BEAM_RANGE);
        const hasBeam = w.equipment.beam?.item === 'tool-beam';
        const targetNode = forceBeamRef.current !== null
          ? (w.field.nodes.find((n) => n.id === forceBeamRef.current) ?? aimedNode)
          : aimedNode;
        const isMining = (isLmbDownRef.current || forceBeamRef.current !== null) && hasBeam && targetNode !== null && !scene.mash.isEquipped();

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
          while (harvestAccRef.current >= 0.1) {
            harvestAccRef.current -= 0.1;
            dispatchBaseRef.current({
              t: 'tick',
              at: { x: playerPos.x, z: playerPos.z },
              dt: 0.1,
              beam: isMining && targetNode ? { node: targetNode.id, power: 1 } : null,
              power: powerMap,
            });
          }
        }

        // 2. Beam VFX update
        if (isMining && targetNode) {
          const muzzle = scene.beamMuzzle();
          const target = { x: targetNode.x, y: scene.heightAt(targetNode.x, targetNode.z) + 0.35, z: targetNode.z };
          const col = targetNode.kind === 'dither' ? '#d9d9d9' : targetNode.kind === 'fold' ? '#7dd3fc' : targetNode.kind === 'chroma' ? '#ff4fd8' : '#22d3ee';
          scene.setBeam(muzzle, target, 'extract', col, true);
        } else {
          scene.setBeam(null, null, 'extract', '#ffffff', false);
        }

        // 3. Throttled preview for build ghost
        const slot = w.player.slots[w.hotbar];
        const activeBp = slot && slot.n > 0 ? blueprint(slot.item) : null;
        if (activeBp) {
          const curKind = (buildKindRef.current && activeBp.kinds.includes(buildKindRef.current)
            ? buildKindRef.current
            : activeBp.kinds[0]!) as Kind;
          if (ghostKindRef.current !== curKind) {
            scene.setPieceGhost(createStandInPiece(curKind, 'ok'));
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
                  extraAngle = -snap.piece.r * (Math.PI / 2);
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
                  { x: snap.cx + (C / 2) * cosine - (C / 2) * sine, z: snap.cz + (C / 2) * sine + (C / 2) * cosine },
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
        } else {
          if (ghostKindRef.current !== null) {
            scene.setPieceGhost(null);
            ghostKindRef.current = null;
          }
          lastPreviewRef.current = null;
        }
      }
      const live = !pausedRef.current && stateRef.current.step !== 'create';
      // the governor judges only the frames you play (the creator draws its own turntable over the lab)
      const next = live ? adaptive.frame(frameMs) : null;
      if (next) {
        graphics = resolveGraphics(next, props.profile.graphics);
        scene.setDetail(detailOf(graphics, next));
        size();
        noteTier(next);
        hook.tier = next;
      }
      const axis = (a: string[], b: string[]) => (a.some((k) => keys.has(k)) ? 1 : 0) - (b.some((k) => keys.has(k)) ? 1 : 0);
      const out = scene.frame(ms / 1000, dt, live
        ? { move: { x: axis(['KeyD', 'ArrowRight'], ['KeyA', 'ArrowLeft']), z: axis(['KeyW', 'ArrowUp'], ['KeyS', 'ArrowDown']) }, look: { dx, dy }, run: keys.has('ShiftLeft') || keys.has('ShiftRight') }
        : { move: { x: 0, z: 0 }, look: { dx: 0, dy: 0 }, run: false });
      dx = 0; dy = 0;
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
        setBuilding(null);
        setMenu(false);
        if (visitingRef.current) endVisit();
      }
      if (out.event === 'stage-up') say(`Stage ${out.stage}`, STAGE_SAYS[out.stage] ?? '');
      if (s !== stateRef.current) commit(withLab(withPlot(s, plotRef.current), labRef.current));

      // ---- hand gathering ore from boulders on the plot: hold E to gather 3 ore/s
      let plotChanged = false;
      if (live && !visitingRef.current && out.where === 'planet' && out.aimedBoulder !== null && keys.has('KeyE')) {
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
      scene.setLabActivity(labActivity(labRef.current, labEnv));
      // ---- the plot runs, in the lab too
      if (env && stateRef.current.step !== 'create') {
        const r = stepPlot(plotRef.current, env, dt);
        plotRef.current = r.state;
        for (const e of r.events) {
          if (e.type === 'stage-up' && !visitingRef.current) {
            if (e.stage >= 2) scene.raiseStage(e.stage, env.gate);
            if (isBase) dispatchBaseRef.current({ t: 'stage', stage: e.stage });
          }
          if (e.type === 'ore-out' && !visitingRef.current) say('Out of ore', 'Hold E on a boulder, or build a rock drill.');
          if (e.type === 'underpowered' && !visitingRef.current) say('Not enough power', 'Build a power unit, or switch a machine off.');
        }
        if (r.events.length) plotChanged = true;
        if (!visitingRef.current) {
          scene.setPlot(plotRef.current, running(plotRef.current, env), network(plotRef.current, env).connected);
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
      }
      hook.frames += 1; hook.where = out.where; hook.sync = out.sync; hook.step = stateRef.current.step; hook.wave = scene.debug.wave();
      if (hook.frames % 30 === 0) Object.assign(hook, scene.debug.stats());
      if (hook.frames % 15 === 0) {
        setMashMobs(scene.mash.getMobList());
        setMashStats(scene.mash.getStats());
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
            atLever: out.atLever,
            atDial: out.atDial,
            ghost: out.ghost,
            aimed: out.aimed,
            aimedBoulder: out.aimedBoulder,
            aimedLab: out.aimedLab,
            visitingOwner: vis.snapshot.owner,
            plot: { ore: 0, oreRate: 0, supply: 0, demand: 0, levels, stage: vp.stage },
          });
        } else {
          const p = plotRef.current, rt = env ? rates(p, env) : null;
          const levels = { pxd: level(p, 'pxd'), vtx: level(p, 'vtx'), lx: level(p, 'lx'), aq: level(p, 'aq') };
          setHud({
            where: out.where,
            sync: out.sync,
            atLever: out.atLever,
            atDial: out.atDial,
            ghost: out.ghost,
            aimed: out.aimed,
            aimedBoulder: out.aimedBoulder,
            aimedLab: out.aimedLab,
            visitingOwner: null,
            plot: { ore: p.ore, oreRate: rt?.ore ?? 0, supply: rt?.supply ?? 0, demand: rt?.demand ?? 0, levels, stage: p.stage },
          });
        }
      }
      raf = requestAnimationFrame(loop);
    };
    const step = (): void => {
      if (cancelled) return;
      steps[at]![1]();
      at += 1;
      if (at < steps.length) { setLoading(steps[at]![0]); timer = window.setTimeout(step, 0); return; }
      hook.ready = true;
      setReady(true);
      raf = requestAnimationFrame(loop);
    };
    (window as unknown as { hmPlay?: unknown }).hmPlay = Object.assign(hook, {
      pull: () => scene.pullLever(),
      go: (where: 'lab' | 'planet', x: number, z: number, yaw: number, pitch?: number) => scene.debug.teleport(where, x, z, yaw, pitch),
      gate: () => scene.debug.gatePlanet(),
      showGround: (on: boolean) => scene.debug.showGround(on),
      placeAt: (x: number, z: number, kind: MachineKind = 'mill') => { const g = scene.debug.gatePlanet(); return tryPlace(kind, x, z, Math.atan2(x - g.x, z - g.z)); },
      plot: () => (visitingRef.current ? visitingRef.current.plot : plotRef.current),
      give: (ore: number) => { plotRef.current = { ...plotRef.current, ore: plotRef.current.ore + ore }; },
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
      mash: () => scene.mash,
      spawnOgro: (count = 1) => scene.mash.spawnOgro(count),
      spawnDemon: (count = 1) => scene.mash.spawnDemon(count),
      equipShotgun: (on = true) => { scene.mash.equip(on); setMashEquipped(on); },
      fireShotgun: () => fireWeapon(),
      setPaused: (p: boolean) => setPaused(p),
      isPaused: () => pausedRef.current,
      setLocked: (l: boolean) => setLocked(l),
      clearToast: () => setToast(null),
      base: {
        world: () => baseWorldRef.current,
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
      },
      teleportPlanet: () => scene.debug.teleport('planet', 0, 10, 0),
    });
    if (typeof window !== 'undefined') {
      (window as unknown as { __hm?: unknown }).__hm = {
        setPaused: (p: boolean) => setPaused(p),
        isPaused: () => pausedRef.current,
        setLocked: (l: boolean) => setLocked(l),
        clearToast: () => setToast(null),
        base: {
          world: () => baseWorldRef.current,
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
        },
      };
    }
    setLoading(steps[0]![0]);
    timer = window.setTimeout(step, 30);
    return () => {
      cancelled = true;
      delete (window as unknown as { hmPlay?: unknown }).hmPlay;
      delete (window as unknown as { __hm?: unknown }).__hm;
      window.clearTimeout(timer);
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', size);
      window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mousedown', onMouseDown); window.removeEventListener('mouseup', onMouseUp);
      sceneRef.current = null;
      scene.dispose();
    };
  }, [tier, reduced, props.profile.gpu, props.profile.graphics, props.profile.quality, props.profile.fpsTarget, commit, say]);

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
  const lock = useCallback(() => {
    setPaused(false);
    if (canvasRef.current) captureMouse(canvasRef.current);
  }, []);

  // ---- the keys that do things: E uses, B builds, Esc steps back
  const placeNow = useCallback(() => {
    const at = sceneRef.current?.aim();
    if (!at || !building) return;
    if (!placeRef.current?.(building, at.x, at.z, at.yaw)) return;
    const name = KINDS[building].name;
    setBuilding(null);
    sceneRef.current?.setBuilding(null);
    say(`${name} built`, KINDS[building].emits ? 'Watch its pixels pour while it runs.' : BLURB[building]);
  }, [building, say]);
  const stopBuilding = useCallback(() => { setBuilding(null); sceneRef.current?.setBuilding(null); }, []);
  /** Frees the mouse for a menu without pausing the game. */
  const freeMouse = useCallback(() => { if (document.pointerLockElement) { quietRef.current = true; document.exitPointerLock(); } }, []);
  const openDial = useCallback(() => {
    sceneRef.current?.playAction('button');
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
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (!ready || creating) return;
      if (e.code === 'Escape') {
        if (machinePickerHardpoint !== null) { setMachinePickerHardpoint(null); return; }
        if (refineryMachineId !== null) { setRefineryMachineId(null); return; }
        if (building) { stopBuilding(); return; }
        if (mashOpen) { setMashOpen(false); return; }
        if (menu) { setMenu(false); return; }
        if (dialOpen) { setDialOpen(false); return; }
        if (panel !== null) { setPanel(null); return; }
        if (labPanel !== null) { setLabPanel(null); return; }
        if (!locked) setPaused((p) => !p);
        return;
      }
      if (paused) return;
      if (isBase) {
        if (e.code === 'KeyR') {
          const w = baseWorldRef.current;
          const slot = w.player.slots[w.hotbar];
          if (slot && slot.n > 0) {
            const bp = blueprint(slot.item);
            if (bp && bp.kinds.length > 1) {
              const curKind = buildKindRef.current ?? bp.kinds[0]!;
              const curIdx = bp.kinds.indexOf(curKind);
              const nextIdx = (curIdx + 1) % bp.kinds.length;
              buildKindRef.current = bp.kinds[nextIdx]!;
              (baseViewSource as WorldViewSource).notify?.();
              say(`Selected: ${buildKindRef.current.toUpperCase()}`);
              return;
            }
          }
        }
        if (e.code === 'KeyX') {
          const hit = sceneRef.current?.aimPoint();
          if (hit && hit.piece !== null) {
            dispatchBase({
              t: 'remove',
              at: { x: hit.x, z: hit.z },
              id: hit.piece,
            });
            return;
          }
        }
      }
      if (e.code === 'KeyM') {
        setMashOpen((m) => {
          const next = !m;
          if (next) freeMouse();
          return next;
        });
        return;
      }
      if (e.code === 'Space' && locked && mashEquipped) {
        fireWeapon();
        return;
      }
      if (e.code === 'KeyV') {
        const current = sceneRef.current?.getCameraView() ?? 'first';
        const next = current === 'first' ? 'third' : 'first';
        sceneRef.current?.setCameraView(next);
        saveProfile({ ...props.profile, cameraView: next });
        say(next === 'third' ? 'Third-person view' : 'First-person view');
        return;
      }
      if (e.code === 'KeyE') {
        if (isBase) {
          const hit = sceneRef.current?.aimPoint();
          if (hit && hit.piece !== null) {
            const p = baseWorldRef.current.base.pieces.find((q) => q.id === hit.piece);
            if (p && p.kind === 'airlock') {
              dispatchBase({ t: 'door', id: p.id, open: !p.open });
              return;
            }
            if (p && p.kind === 'hardpoint') {
              const m = baseWorldRef.current.machines.find((x) => x.id === p.id);
              if (!m) {
                setMachinePickerHardpoint(p.id);
                freeMouse();
                return;
              } else if (m.kind === 'mill' || m.kind === 'press') {
                setRefineryMachineId(m.id);
                freeMouse();
                return;
              } else {
                say(`Heavy ${m.kind.toUpperCase()} operational`, 'Pouring pixels into atmospheric plume.');
                return;
              }
            }
          }
          if (tryPlaceBase()) return;
        }
        if (building) placeNow();
        else if (hud.atLever) sceneRef.current?.pullLever();
        else if (hud.atDial && !dialOpen) {
          sceneRef.current?.playAction('button');
          setDialOpen(true);
          freeMouse();
        } else if (hud.where === 'planet' && hud.aimed !== null && panel === null) {
          sceneRef.current?.playAction('button');
          setPanel(hud.aimed);
          setMenu(false);
          freeMouse();
        } else if (hud.where === 'lab' && hud.aimedLab !== null && labPanel === null) {
          sceneRef.current?.playAction('button');
          setLabPanel(hud.aimedLab);
          freeMouse();
        }
      }
      if (e.code === 'KeyB' && hud.where === 'planet') {
        if (visitingRef.current) {
          say(`Visiting ${visitingRef.current.snapshot.owner}'s plot`, 'Visits are read-only.');
          return;
        }
        if (building) stopBuilding(); else { setPanel(null); setMenu((m) => { if (!m) freeMouse(); return !m; }); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ready, creating, building, mashOpen, mashEquipped, fireWeapon, menu, panel, labPanel, dialOpen, locked, paused, hud.atLever, hud.atDial, hud.aimed, hud.aimedBoulder, hud.aimedLab, hud.where, placeNow, stopBuilding, freeMouse, say, props.profile]);
  useEffect(() => {
    const onClick = (): void => { if (building && locked) placeNow(); };
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, [building, locked, placeNow]);
  // leaving the planet closes the build menu; entering planet closes lab panels
  useEffect(() => {
    if (hud.where === 'lab') { setMenu(false); setPanel(null); stopBuilding(); }
    if (hud.where === 'planet') { setLabPanel(null); setDialOpen(false); }
  }, [hud.where, stopBuilding]);

  // auto-teleport to planet surface and equip shotgun when URL has ?mash or ?monstermash
  useEffect(() => {
    if (ready && typeof location !== 'undefined') {
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
            scene.mash.equip(true);
            setMashEquipped(true);
            void scene.mash.spawnOgro(1);
            setMashOpen(true);
          }
        }
      }
    }
  }, [ready, commit]);

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
  const goal = objective({ ...state, plot: plotRef.current }, hud.where);
  const syncLit = Math.ceil(hud.sync * SYNC_BLOCKS);
  const prompt = building
    ? (hud.ghost?.ok ? `Click or E: build the ${KINDS[building].name.toLowerCase()}` : hud.ghost?.why || 'Aim at the ground near the gate.')
    : hud.atLever ? 'E: pull the main lever'
    : hud.atDial ? 'E: plot dial'
    : hud.where === 'planet' && hud.aimedBoulder !== null && !visiting ? 'Hold E: gather ore'
    : hud.where === 'planet' && hud.aimed !== null && panel === null ? `E: open the ${KINDS[(visiting ? visiting.plot.machines : plotRef.current.machines).find((x) => x.id === hud.aimed)?.kind ?? 'mill'].name.toLowerCase()}`
    : hud.where === 'lab' && hud.aimedLab !== null && labPanel === null ? `E: open the ${hud.aimedLab === 'rack' ? 'cartridge rack' : hud.aimedLab === 'bench' ? 'preset bench' : 'preset combiner'}`
    : '';

  return (
    <div className={`play${ready ? ' ready' : ''}${hud.where === 'planet' ? ' on-planet' : ''}${hud.sync < 0.3 && hud.where === 'planet' ? ' sync-low' : ''}`}>
      {failed ? <p className="play-failed" role="alert">This browser could not start 3D graphics (WebGL 2). Try another browser, or turn on hardware acceleration in its settings.</p> : <canvas ref={canvasRef} className="play-canvas" onClick={() => { if (ready && !creating && !locked) lock(); }} aria-label="The lab, in first person. Click to look around." />}
      {!ready && !failed ? <div className="gr-loading play-loading" role="status"><span>{loading}</span><i /></div> : null}

      {ready ? (
        <div className="play-sync-indicator" title={syncMode === 'synced' ? 'Connected to shared 40,000 km planetary substrate' : 'Playing on private local simulation branch'}>
          <span className={`sync-badge ${syncMode}`}>
            <span className="sync-pulse" />
            {syncMode === 'synced' ? 'GRID SYNCED' : 'SOLO DESYNCED'}
          </span>
          <button
            className="sync-branch-toggle"
            onClick={() => {
              const next = syncMode === 'synced' ? 'desynced' : 'synced';
              setSyncMode(next);
              say(
                next === 'synced' ? 'Synced with Planetary Grid' : 'Desynced to Solo Branch',
                next === 'synced' ? 'Majority consensus active on Sector 4.' : 'Playing solo offline.',
              );
            }}
          >
            {syncMode === 'synced' ? 'Desync' : 'Sync'}
          </button>
        </div>
      ) : null}

      {ready && creating ? (
        <div className="play-create">
          <CreateScientist inLab title="Who are you?" doneLabel="Done: into the lab"
            onDone={(avatar) => {
              commit(created(stateRef.current, avatar));
              sceneRef.current?.setAvatar(avatar);
              say('Simulation Bridge Alert', 'The lab is shielded. A nested simulation broke down—pull the console lever to open the portal to the moon.');
            }}
            onBack={props.onBack} />
        </div>
      ) : null}

      {ready && !creating ? (
        <>
          <section className="play-goal" aria-live="polite">
            <h2>{visiting ? `Visiting ${visiting.snapshot.owner}’s plot` : goal.title}</h2>
            <p>{visiting ? 'Read-only visit. Walk back through the gate to return to your lab.' : goal.hint}</p>
          </section>
          {hud.where === 'planet' ? (
            <div className="play-sync" role="meter" aria-label="Sync" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(hud.sync * 100)}>
              <span>Sync</span>
              <ol>{Array.from({ length: SYNC_BLOCKS }, (_, i) => <li key={i} className={i < syncLit ? 'on' : ''} />)}</ol>
            </div>
          ) : null}
          <i className="play-dot" aria-hidden="true" />
          {prompt ? <p className={`play-prompt${building && !hud.ghost?.ok ? ' bad' : ''}`}>{prompt}</p> : null}
          {state.step === 'build' || state.step === 'drill' || state.step === 'done' || visiting ? (
            <section className="play-plot" aria-label={visiting ? `Visiting ${visiting.snapshot.owner}'s plot` : 'Your plot'}>
              {visiting ? (
                <div className="play-visiting-banner">
                  <span>Visiting <b>{visiting.snapshot.owner}</b></span>
                  <em>Stage {visiting.plot.stage}</em>
                </div>
              ) : (() => {
                const hasDrill = plotRef.current.machines.some((m) => m.kind === 'drill');
                const outOfOreNoDrill = hud.plot.ore <= 0 && !hasDrill;
                return (
                  <>
                    <p className={`play-ore${outOfOreNoDrill ? ' out-of-ore' : ''}`}>
                      <b>{Math.floor(hud.plot.ore)}</b> ore <span>{signed(hud.plot.oreRate)}/s</span>
                      {outOfOreNoDrill ? <em className="play-ore-warn">Out of ore: hold E on a boulder, or build a rock drill</em> : null}
                    </p>
                    <p className={`play-power${hud.plot.demand > hud.plot.supply + 1e-6 ? ' short' : ''}`}><b>{hud.plot.demand.toFixed(0)}</b> of {hud.plot.supply.toFixed(0)} kW</p>
                  </>
                );
              })()}
              <ul className="play-levels">
                {METRICS.map((m) => (
                  <li key={m} style={{ '--c': METRIC_COLOUR[m] } as CSSProperties}>
                    <span>{METRIC_NAME[m]}</span><i><s style={{ width: `${Math.min(100, hud.plot.levels[m])}%` }} /></i><b>{Math.floor(hud.plot.levels[m])}</b>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {menu ? (
            <section className="play-build" aria-label="Build">
              <h3>Build</h3>
              <div className="play-cards">
                {BUILD_ORDER.map((k) => {
                  const spec = KINDS[k], shut = hud.plot.stage < spec.unlock;
                  const isFree = isFreeDrill(stateRef.current, k);
                  const short = !isFree && hud.plot.ore < spec.cost;
                  const highlighted = state.step === 'drill' && k === 'drill';
                  return (
                    <button key={k} className={`play-card${shut ? ' shut' : ''}${short ? ' short' : ''}${highlighted ? ' highlighted' : ''}`} disabled={shut} onClick={() => startBuilding(k)} autoFocus={k === (state.step === 'drill' ? 'drill' : 'mill')}>
                      <b>{spec.name}</b>
                      <span>{BLURB[k]}</span>
                      <em>{shut ? `Unlocks at stage ${spec.unlock}` : isFree ? 'Free' : `${spec.cost} ore`}</em>
                    </button>
                  );
                })}
              </div>
              <p>Machines run on power from the gate&rsquo;s junction box or a relay pylon; most use ore, which rock drills mine.</p>
            </section>
          ) : null}
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

            if (labPanel === 'rack') {
              const blankCheck = canMakeBlank(labRef.current, plotRef.current.ore);
              return (
                <section className="play-machine" aria-label="Cartridge Rack">
                  <h3>Cartridge Rack</h3>
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

            if (labPanel === 'bench') {
              const job = labRef.current.bench;
              if (job !== null) {
                const p = VAULT_BY_ID.get(job.preset ?? '');
                const pct = Math.min(100, Math.round((job.done / job.needs) * 100));
                return (
                  <section className="play-machine" aria-label="Preset Bench">
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
                <section className="play-machine" aria-label="Preset Bench">
                  <h3>Preset Bench</h3>
                  <p>Writes an authored terraforming preset onto a blank cartridge.</p>
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
                  <button className="go" onClick={close} style={{ marginTop: '12px' }} autoFocus>Back to the lab</button>
                </section>
              );
            }

            if (labPanel === 'combiner') {
              const job = labRef.current.combiner;
              if (job !== null) {
                const pct = Math.min(100, Math.round((job.done / job.needs) * 100));
                return (
                  <section className="play-machine" aria-label="Preset Combiner">
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
                <section className="play-machine" aria-label="Preset Combiner">
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
            const close = (): void => { setDialOpen(false); lock(); };
            return (
              <section className="play-machine play-dial-panel" aria-label="Gate Plot Dial">
                <h3>Gate Plot Dial</h3>
                <p>Dial a friend&rsquo;s plot code to open the gate onto their world, or copy yours to share.</p>

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
          {!locked && !paused && panel === null && labPanel === null && !dialOpen && !menu && !isAnyBaseWindowOpen ? (
            <button className="play-start" onClick={lock}>
              <b>Click to look around</b>
              <span className="play-keys">{KEYS.map(([k, what]) => <span key={k}><kbd>{k}</kbd>{what}</span>)}</span>
            </button>
          ) : null}
          {paused && !isAnyBaseWindowOpen ? (
            <div className="play-pause" role="dialog" aria-label="Paused">
              <h2>Paused</h2>
              <div className="play-pause-sync">
                <span>Simulation Mode:</span>
                <b className={syncMode === 'synced' ? 'synced' : 'desynced'}>
                  {syncMode === 'synced' ? 'Planetary Grid (Synced Shared World)' : 'Expedition (Desynced Solo Branch)'}
                </b>
              </div>
              <button className="go" onClick={lock}>Resume</button>
              <button
                onClick={() => {
                  const next = syncMode === 'synced' ? 'desynced' : 'synced';
                  setSyncMode(next);
                  say(
                    next === 'synced' ? 'Connected to Planetary Grid' : 'Desynced to Solo Branch',
                    next === 'synced' ? 'Majority consensus active on Sector 4.' : 'Playing solo offline. Changes are local.',
                  );
                }}
              >
                {syncMode === 'synced' ? 'Desync to Solo Branch' : 'Sync to Planetary Grid (Majority Merge)'}
              </button>
              <button onClick={props.onBack}>Back to FIDELITY</button>
            </div>
          ) : null}
          <button
            className={`play-mash-btn${mashOpen ? ' active' : ''}`}
            onClick={() => {
              setMashOpen((m) => !m);
              freeMouse();
            }}
            title="Monster Mash Combat Sandbox (Shortcut: M)"
          >
            👹 Monster Mash {mashMobs.filter((m) => m.state !== 'death').length > 0 ? `(${mashMobs.filter((m) => m.state !== 'death').length})` : ''}
          </button>
          {mashEquipped && (
            <div className={`play-crosshair${hitMarker ? ' hit' : ''}`}>
              <div className="ch-top" />
              <div className="ch-bottom" />
              <div className="ch-left" />
              <div className="ch-right" />
              <div className="ch-dot" />
              {hitMarker ? <div className="ch-hit-x">✕</div> : null}
            </div>
          )}
          {mashOpen ? (
            <section className="play-mash-panel" aria-label="Monster Mash Sandbox">
              <header>
                <h3>👹 Monster Mash Combat</h3>
                <button onClick={() => setMashOpen(false)}>✕</button>
              </header>

              <div className="mash-section">
                <h4>Weapon Loadout</h4>
                <div className="mash-weapon-status">
                  <span>Status: <b>{mashEquipped ? 'Combat Shotgun' : 'Holstered'}</b></span>
                  {mashEquipped && <span className="mash-ammo-pill">{mashAmmo.current} / {mashAmmo.max} Shells</span>}
                </div>
                <div className="mash-btn-grid">
                  <button
                    className={mashEquipped ? '' : 'primary'}
                    onClick={() => {
                      const scene = sceneRef.current;
                      if (!scene) return;
                      const next = !mashEquipped;
                      scene.mash.equip(next);
                      setMashEquipped(next);
                      say(next ? 'Combat Shotgun equipped' : 'Weapon holstered', next ? 'LMB or Space to shoot. Pellets deal 20-35 dmg per hit.' : '');
                    }}
                  >
                    {mashEquipped ? 'Unequip Weapon' : '🔫 Equip Shotgun'}
                  </button>
                  <button
                    className="primary"
                    disabled={!mashEquipped}
                    onClick={() => fireWeapon()}
                  >
                    💥 Fire Shotgun
                  </button>
                </div>
              </div>

              <div className="mash-section">
                <h4>Spawn Monsters on Planet</h4>
                <div className="mash-btn-grid">
                  <button
                    onClick={() => {
                      void sceneRef.current?.mash.spawnOgro(1).then(() => {
                        setMashMobs(sceneRef.current?.mash.getMobList() ?? []);
                        setMashStats(sceneRef.current?.mash.getStats() ?? mashStats);
                        say('3D Ogro spawned!', 'Quake 2 retro MD2 mob with run/attack/pain/death animations.');
                      });
                    }}
                  >
                    👹 Spawn 3D Ogro (Q2)
                  </button>
                  <button
                    onClick={() => {
                      void sceneRef.current?.mash.spawnDemon(1).then(() => {
                        setMashMobs(sceneRef.current?.mash.getMobList() ?? []);
                        setMashStats(sceneRef.current?.mash.getStats() ?? mashStats);
                        say('2D Demon spawned!', 'DOOM 1 retro WAD patch sprite billboard.');
                      });
                    }}
                  >
                    👾 Spawn 2D Demon (WAD)
                  </button>
                  <button
                    onClick={() => {
                      void Promise.all([
                        sceneRef.current?.mash.spawnOgro(2),
                        sceneRef.current?.mash.spawnDemon(1),
                      ]).then(() => {
                        setMashMobs(sceneRef.current?.mash.getMobList() ?? []);
                        setMashStats(sceneRef.current?.mash.getStats() ?? mashStats);
                        say('Monster Horde spawned!', '3 shareware monsters spawned in perimeter.');
                      });
                    }}
                  >
                    🔥 Spawn Horde (x3)
                  </button>
                  <button
                    onClick={() => {
                      sceneRef.current?.mash.clearMobs();
                      setMashMobs([]);
                      say('Mobs cleared');
                    }}
                  >
                    🧹 Clear All Mobs
                  </button>
                </div>
                {hud.where === 'lab' && (
                  <button
                    className="mash-action-btn primary"
                    style={{ width: '100%', marginTop: '6px' }}
                    onClick={() => {
                      const scene = sceneRef.current;
                      if (scene) {
                        const g = scene.debug.gatePlanet();
                        scene.debug.teleport('planet', g.x + 3, g.z + 5, Math.PI);
                        say('Teleported to Planet Surface', 'Step back through the gate anytime to return to the lab.');
                      }
                    }}
                  >
                    🚀 Teleport to Planet Surface
                  </button>
                )}
              </div>

              <div className="mash-section">
                <h4>World & Mob Fidelity Stage</h4>
                <div className="mash-stage-grid">
                  {[
                    { st: 0, label: '0: Dither' },
                    { st: 1, label: '1: EGA' },
                    { st: 2, label: '2: VGA' },
                    { st: 3, label: '3: Gouraud' },
                    { st: 4, label: '4: PBR' },
                  ].map(({ st, label }) => (
                    <button
                      key={st}
                      className={`mash-stage-btn${mashStage === st ? ' active' : ''}`}
                      onClick={() => {
                        const scene = sceneRef.current;
                        if (!scene) return;
                        scene.setFidelityStage(st);
                        setMashStage(st);
                        say(`Fidelity Stage ${st}`, STAGE_SAYS[st] || `Fidelity set to Stage ${st}`);
                      }}
                      title={`Switch planet terrain and monsters to Fidelity Stage ${st}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mash-section">
                <h4>Combat Telemetry</h4>
                <div className="mash-stats-grid">
                  <div className="mash-stat-box">
                    <span>Shots / Hits</span>
                    <b>{mashStats.shotsFired} / {mashStats.pelletsHit}</b>
                  </div>
                  <div className="mash-stat-box">
                    <span>Mobs Defeated</span>
                    <b>{mashStats.mobsDefeated} / {mashStats.mobsSpawned}</b>
                  </div>
                  <div className="mash-stat-box">
                    <span>Ore Harvested</span>
                    <b>+{mashStats.oreCollected}</b>
                  </div>
                </div>
              </div>

              {mashMobs.length > 0 && (
                <div className="mash-section">
                  <h4>Active Mob Entities ({mashMobs.length})</h4>
                  <div className="mash-mob-list">
                    {mashMobs.map((m) => (
                      <div key={m.id} className={`mash-mob-card${m.state === 'death' ? ' dead' : ''}`}>
                        <span><b>{m.kind.toUpperCase()} #{m.id}</b> [{m.state}]</span>
                        <div className="mash-hp-bar">
                          <div style={{ width: `${Math.max(0, (m.hp / m.maxHp) * 100)}%`, background: m.hp > 40 ? '#10b981' : '#ef4444' }} />
                        </div>
                        <span>{Math.ceil(m.hp)} HP</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          ) : null}
          {isBase && hud.where === 'planet' ? (
            <BaseHud
              source={baseViewSource}
              paused={paused}
              modalOpen={isAnyBaseWindowOpen}
              harvestCounter={beamHarvest}
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
          ) : null}
          {machinePickerHardpoint !== null && isBase && (
            <MachinePickerModal
              hardpointId={machinePickerHardpoint}
              world={baseWorldRef.current}
              env={getBaseEnv()}
              at={sceneRef.current?.debug.position() ?? { x: 0, z: 0 }}
              onInstall={(hpId, kind) => {
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
          {refineryMachineId !== null && isBase && (
            <RefineryModal
              machineId={refineryMachineId}
              world={baseWorldRef.current}
              env={getBaseEnv()}
              at={sceneRef.current?.debug.position() ?? { x: 0, z: 0 }}
              onCraft={(machId, recipeId) => {
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
          {toast && !isAnyBaseWindowOpen ? <div key={toast.id} className={`play-toast${toast.text === 'Sync lost' ? ' lost' : ''}`} role="status"><b>{toast.text}</b>{toast.sub ? <span>{toast.sub}</span> : null}</div> : null}
        </>
      ) : null}
    </div>
  );
}
