// Play (owner, 2026-10-07; STATUS SM22, SM30): the lab in first person, your human made there, the gate turned on, the stage-0
// planet looked round, the first machine placed; then the plot's game loop (`@hm/plotsim`): mine ore, run power out, build the
// machines whose pixels raise the plot's four fidelity metrics, and climb the six stages. The scene is play-scene.ts, the
// tutorial quest.ts; this screen loads them behind a bar, reads your keys and mouse, runs the plot, saves, and says what to do.
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactElement } from 'react';
import { deviceFor, type Stage } from '@hm/fidelity';
import { VAULT, VAULT_BY_ID } from '@hm/vault';
import { createAdaptiveQuality, parseQuality, type Quality } from '@hm/game';
import { pixelRatioFor, resolveGraphics, type GraphicsSettings } from '@hm/render';
import { noteTier, powerPreferenceOf, type Profile } from '../shell/profile';
import { tierFor } from '../crafter/crafter';
import { bakeLookCached } from '../crafter/looks';
import type { Plot } from '../crafter/planet';
import { SMOOTH_IDS, smoothModel } from '../crafter/smooth-models';
import { CreateScientist } from '../avatar/create-scientist';
import { createPlayScene, type Detail, type FrameOut, type PlayScene } from './play-scene';
import { canPlace, KINDS, level, METRICS, network, place, rates, remove as removeMachine, running, setCartridge, setOn, step as stepPlot, type Env, type MachineKind, type Metric, type PlotState } from '@hm/plotsim';
import { fx } from '../maker/feedback';
import { FRESH, METRIC_COLOUR, METRIC_NAME, SAVE_KEY, arrived, created, loadState, objective, poweredOn, returned, withPlot, type PlayState } from './quest';
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
const GROUND_BUDGET: Readonly<Record<Quality, number>> = { potato: 60000, low: 90000, medium: 200000, high: 200000, ultra: 280000 };
/** The most lines the planet is drawn at by tier: the later stages' resolution is capped on the light tiers, so they hold their frame rate. */
const PLANET_LINES: Readonly<Record<Quality, number>> = { potato: 480, low: 720, medium: 1080, high: 1e5, ultra: 1e5 };
const detailOf = (g: GraphicsSettings, q: Quality): Detail => ({ plumes: g.pixelPlumes, plumeDensity: g.plumeDensity, groundBudget: GROUND_BUDGET[q], planetLines: PLANET_LINES[q] });
/** What each stage brings, for the toast when its wave has crossed the plot. */
const STAGE_SAYS: readonly string[] = ['', 'Colour has reached your plot.', 'Shapes smooth out, textures sharpen.', 'Light: shading and a deeper sky.', 'Water and full detail.', 'Life takes hold.', 'Full fidelity: your plot is real.'];

function loadSaved(): PlayState { try { return loadState(JSON.parse(localStorage.getItem(SAVE_KEY) ?? 'null')); } catch { return FRESH; } }
function save(s: PlayState): void { try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch { /* storage unavailable: progress lives for this visit */ } }

/** The plot's numbers for the HUD. */
interface PlotHud { readonly ore: number; readonly oreRate: number; readonly supply: number; readonly demand: number; readonly levels: Readonly<Record<Metric, number>>; readonly stage: number }
interface Hud { readonly where: FrameOut['where']; readonly sync: number; readonly atLever: boolean; readonly ghost: FrameOut['ghost']; readonly aimed: number | null; readonly plot: PlotHud }
const NO_PLOT: PlotHud = { ore: 0, oreRate: 0, supply: 0, demand: 0, levels: { pxd: 0, vtx: 0, lx: 0, aq: 0 }, stage: 0 };
/** The build menu, in the order the plot needs them. */
const BUILD_ORDER: readonly MachineKind[] = ['mill', 'drill', 'pylon', 'press', 'power', 'projector', 'water'];
const BLURB: Readonly<Record<MachineKind, string>> = {
  mill: 'Grinds ore into texture detail: pink pixels.', drill: 'Mines ore from the ground, best on rock and scree.', pylon: 'Carries power further out.',
  press: 'Stamps the plot\'s shapes finer: green pixels.', power: 'Burns ore to make more power.', projector: 'Raises the light: amber pixels.',
  water: 'Condenses water from gravel: cyan pixels.',
};
const signed = (v: number): string => `${v >= 0 ? '+' : ''}${v.toFixed(1)}`;
/** A preset cartridge's effect on a metric (the vault's affinity; 1 = none). */
const affinityOf = (cartridge: string, metric: Metric): number => VAULT_BY_ID.get(cartridge)?.affinity[metric] ?? 1;
/** The cartridges on your rack: the vault's presets your plot's stage has opened, the ones that help this metric first. */
function cartridgesFor(metric: Metric, stage: number): readonly { readonly id: string; readonly name: string; readonly gain: number }[] {
  return VAULT.filter((c) => c.minStage <= Math.max(1, stage)).map((c) => ({ id: c.id, name: c.name, gain: c.affinity[metric] ?? 1 }))
    .sort((a, b) => b.gain - a.gain || a.name.localeCompare(b.name)).slice(0, 8);
}
const KEYS: readonly [string, string][] = [['W A S D', 'walk'], ['Mouse', 'look'], ['Shift', 'run'], ['E', 'use'], ['B', 'build'], ['Esc', 'pause']];

export function PlayScreen(props: { readonly profile: Profile; readonly onBack: () => void }): ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<PlayScene | null>(null);
  const reduced = useMemo(() => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } }, []);
  const tier = useMemo(() => tierFor(props.profile), [props.profile.quality]); // eslint-disable-line react-hooks/exhaustive-deps
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
  const [hud, setHud] = useState<Hud>({ where: 'lab', sync: 1, atLever: false, ghost: null, aimed: null, plot: NO_PLOT });
  /** The machine whose panel is open (its plot id). */
  const [panel, setPanel] = useState<number | null>(null);
  /** Set while a menu takes the mouse: losing the pointer lock then does not pause. */
  const quietRef = useRef(false);
  /** The plot runs every frame here; the saved state catches up every few seconds and on events. */
  const plotRef = useRef<PlotState>(state.plot);
  const envRef = useRef<Env | null>(null);
  const placeRef = useRef<((kind: MachineKind, x: number, z: number, yaw: number) => boolean) | null>(null);
  const [toast, setToast] = useState<{ readonly text: string; readonly sub: string; readonly id: number } | null>(null);
  const creating = state.step === 'create';

  const commit = useCallback((next: PlayState) => { stateRef.current = next; setState(next); save(next); }, []);
  const say = useCallback((text: string, sub = '') => setToast({ text, sub, id: Date.now() }), []);
  useEffect(() => {
    if (!toast) return undefined;
    const t = window.setTimeout(() => setToast((x) => (x?.id === toast.id ? null : x)), 3200);
    return () => window.clearTimeout(t);
  }, [toast]);

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
      scene = createPlayScene({ canvas, gridSpacing, antialias: !low, powerPreference: powerPreferenceOf(props.profile.gpu), reducedMotion: reduced, textureSize: low ? 512 : 1024, groundTexture: low ? 128 : 256, detail: detailOf(graphics, tier) });
    } catch {
      setFailed(true);
      return undefined;
    }
    sceneRef.current = scene;
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
        env = { gate: scene.debug.gatePlanet(), plotRadius: 500, richness: (x, z) => scene.richness(x, z), affinity: affinityOf };
        envRef.current = env;
        plotRef.current = stateRef.current.plot;
        scene.restore({ gateOn: stateRef.current.gateOn, plot: plotRef.current, running: running(plotRef.current, env), connected: network(plotRef.current, env).connected });
      }],
      ['Compiling shaders', () => { scene.warm(); }],
    ];
    const hook = { frames: 0, ready: false, step: stateRef.current.step, where: 'lab', sync: 1, wave: -1, triangles: 0, calls: 0, tier: tier as Quality };
    const keys = new Set<string>();
    let dx = 0, dy = 0, cancelled = false, raf = 0, at = 0, timer = 0, last = performance.now(), hudAt = 0, savedAt = 0;
    let env: Env | null = null;
    /** Builds a machine if it may stand there: the plot pays, the scene shows it, and a stage it lifts sends the wave from it. */
    const tryPlace = (kind: MachineKind, x: number, z: number, yaw: number): boolean => {
      if (!env || scene.debug.where() !== 'planet') return false;
      const before = plotRef.current;
      if (!canPlace(before, env, kind, x, z).ok) return false;
      const after = place(before, env, kind, x, z, yaw);
      plotRef.current = after;
      commit(withPlot(stateRef.current, after));
      scene.setPlot(after, running(after, env), network(after, env).connected);
      fx('mill-start');
      if (after.stage > before.stage) scene.raiseStage(after.stage, { x, z });
      return true;
    };
    placeRef.current = tryPlace;
    const onKey = (e: KeyboardEvent, down: boolean): void => { if (down) keys.add(e.code); else keys.delete(e.code); };
    const kd = (e: KeyboardEvent) => onKey(e, true), ku = (e: KeyboardEvent) => onKey(e, false);
    const onMove = (e: MouseEvent): void => { if (document.pointerLockElement === canvas) { dx += e.movementX; dy += e.movementY; } };
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku); window.addEventListener('mousemove', onMove);
    const loop = (ms: number): void => {
      if (cancelled) return;
      const frameMs = ms - last;
      const dt = Math.min(0.1, frameMs / 1000);
      last = ms;
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
      if (out.event === 'powered') { s = poweredOn(s); say('The gate is on', 'Your plot is on the other side.'); }
      if (out.event === 'to-planet') { if (!s.visited) say('Stage 0', 'Black and white, and barely there. Your sync is running down.'); s = arrived(s); }
      if (out.event === 'to-lab') s = returned(s);
      if (out.event === 'sync-lost') { s = returned(s); say('Sync lost', 'The gate pulled you back. Your sync refills in the lab.'); setBuilding(null); setMenu(false); }
      if (out.event === 'stage-up') say(`Stage ${out.stage}`, STAGE_SAYS[out.stage] ?? '');
      if (s !== stateRef.current) commit(s);
      // ---- the plot runs, in the lab too
      if (env && stateRef.current.step !== 'create') {
        const r = stepPlot(plotRef.current, env, dt);
        plotRef.current = r.state;
        for (const e of r.events) {
          if (e.type === 'stage-up' && e.stage >= 2) scene.raiseStage(e.stage, env.gate);
          if (e.type === 'ore-out') say('Out of ore', 'Build a rock drill on rocky ground.');
          if (e.type === 'underpowered') say('Not enough power', 'Build a power unit, or switch a machine off.');
        }
        if (r.events.length || ms - savedAt > 5000) { savedAt = ms; commit(withPlot(stateRef.current, plotRef.current)); }
        scene.setPlot(plotRef.current, running(plotRef.current, env), network(plotRef.current, env).connected);
      }
      hook.frames += 1; hook.where = out.where; hook.sync = out.sync; hook.step = stateRef.current.step; hook.wave = scene.debug.wave();
      if (hook.frames % 30 === 0) Object.assign(hook, scene.debug.stats());
      if (ms - hudAt > 90 || out.event) {
        hudAt = ms;
        const p = plotRef.current, rt = env ? rates(p, env) : null;
        const levels = { pxd: level(p, 'pxd'), vtx: level(p, 'vtx'), lx: level(p, 'lx'), aq: level(p, 'aq') };
        setHud({ where: out.where, sync: out.sync, atLever: out.atLever, ghost: out.ghost, aimed: out.aimed, plot: { ore: p.ore, oreRate: rt?.ore ?? 0, supply: rt?.supply ?? 0, demand: rt?.demand ?? 0, levels, stage: p.stage } });
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
      plot: () => plotRef.current,
      give: (ore: number) => { plotRef.current = { ...plotRef.current, ore: plotRef.current.ore + ore }; },
      machines: () => scene.debug.machines(),
      state: () => stateRef.current,
      detail: () => scene.debug.detail(),
      raise: (to: number) => scene.raiseStage(to, scene.debug.gatePlanet()),
      holo: () => scene.debug.holo(),
    });
    setLoading(steps[0]![0]);
    timer = window.setTimeout(step, 30);
    return () => {
      cancelled = true;
      delete (window as unknown as { hmPlay?: unknown }).hmPlay;
      window.clearTimeout(timer);
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', size);
      window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); window.removeEventListener('mousemove', onMove);
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
    try { void canvasRef.current?.requestPointerLock()?.catch?.(() => undefined); } catch { /* no pointer lock here: keys still walk */ }
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
  /** Changes the plot from a menu: the plot, the save and the scene follow at once. */
  const changePlot = useCallback((next: PlotState) => {
    const env = envRef.current;
    plotRef.current = next;
    commit(withPlot(stateRef.current, next));
    if (env) sceneRef.current?.setPlot(next, running(next, env), network(next, env).connected);
  }, [commit]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (!ready || creating) return;
      if (e.code === 'Escape') {
        if (building) { stopBuilding(); return; }
        if (menu) { setMenu(false); return; }
        if (panel !== null) { setPanel(null); return; }
        if (!locked) setPaused((p) => !p);
        return;
      }
      if (paused) return;
      if (e.code === 'KeyE') {
        if (building) placeNow();
        else if (hud.atLever) sceneRef.current?.pullLever();
        else if (hud.aimed !== null && panel === null) { setPanel(hud.aimed); setMenu(false); freeMouse(); }
      }
      if (e.code === 'KeyB' && hud.where === 'planet') {
        if (building) stopBuilding(); else { setPanel(null); setMenu((m) => { if (!m) freeMouse(); return !m; }); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ready, creating, building, menu, panel, locked, paused, hud.atLever, hud.aimed, hud.where, placeNow, stopBuilding, freeMouse]);
  useEffect(() => {
    const onClick = (): void => { if (building && locked) placeNow(); };
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, [building, locked, placeNow]);
  // leaving the planet closes the build menu
  useEffect(() => { if (hud.where === 'lab') { setMenu(false); setPanel(null); stopBuilding(); } }, [hud.where, stopBuilding]);

  const startBuilding = (kind: MachineKind): void => {
    setMenu(false);
    setBuilding(kind);
    const env = envRef.current;
    sceneRef.current?.setBuilding(kind, env ? (x, z) => { const v = canPlace(plotRef.current, env, kind, x, z); return v.ok ? { ok: true, why: '' } : v; } : undefined);
    if (!locked) lock();
  };
  const goal = objective({ ...state, plot: plotRef.current }, hud.where);
  const syncLit = Math.ceil(hud.sync * SYNC_BLOCKS);
  const prompt = building
    ? (hud.ghost?.ok ? `Click or E: build the ${KINDS[building].name.toLowerCase()}` : hud.ghost?.why || 'Aim at the ground near the gate.')
    : hud.atLever ? 'E: pull the main lever'
    : hud.aimed !== null && panel === null ? `E: open the ${KINDS[plotRef.current.machines.find((x) => x.id === hud.aimed)?.kind ?? 'mill'].name.toLowerCase()}` : '';

  return (
    <div className={`play${ready ? ' ready' : ''}${hud.where === 'planet' ? ' on-planet' : ''}${hud.sync < 0.3 && hud.where === 'planet' ? ' sync-low' : ''}`}>
      {failed ? <p className="play-failed" role="alert">This browser could not start 3D graphics (WebGL 2). Try another browser, or turn on hardware acceleration in its settings.</p> : <canvas ref={canvasRef} className="play-canvas" onClick={() => { if (ready && !creating && !locked) lock(); }} aria-label="The lab, in first person. Click to look around." />}
      {!ready && !failed ? <div className="gr-loading play-loading" role="status"><span>{loading}</span><i /></div> : null}

      {ready && creating ? (
        <div className="play-create">
          <CreateScientist inLab title="Who are you?" doneLabel="Done: into the lab"
            onDone={(avatar) => { commit(created(stateRef.current, avatar)); say('Turn on the gate', 'The console with the big lever stands in front of it.'); }}
            onBack={props.onBack} />
        </div>
      ) : null}

      {ready && !creating ? (
        <>
          <section className="play-goal" aria-live="polite">
            <h2>{goal.title}</h2>
            <p>{goal.hint}</p>
          </section>
          {hud.where === 'planet' ? (
            <div className="play-sync" role="meter" aria-label="Sync" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(hud.sync * 100)}>
              <span>Sync</span>
              <ol>{Array.from({ length: SYNC_BLOCKS }, (_, i) => <li key={i} className={i < syncLit ? 'on' : ''} />)}</ol>
            </div>
          ) : null}
          <i className="play-dot" aria-hidden="true" />
          {prompt ? <p className={`play-prompt${building && !hud.ghost?.ok ? ' bad' : ''}`}>{prompt}</p> : null}
          {state.step === 'build' || state.step === 'done' ? (
            <section className="play-plot" aria-label="Your plot">
              <p className="play-ore"><b>{Math.floor(hud.plot.ore)}</b> ore <span>{signed(hud.plot.oreRate)}/s</span></p>
              <p className={`play-power${hud.plot.demand > hud.plot.supply + 1e-6 ? ' short' : ''}`}><b>{hud.plot.demand.toFixed(0)}</b> of {hud.plot.supply.toFixed(0)} kW</p>
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
                  const spec = KINDS[k], shut = hud.plot.stage < spec.unlock, short = hud.plot.ore < spec.cost;
                  return (
                    <button key={k} className={`play-card${shut ? ' shut' : ''}${short ? ' short' : ''}`} disabled={shut} onClick={() => startBuilding(k)} autoFocus={k === 'mill'}>
                      <b>{spec.name}</b>
                      <span>{BLURB[k]}</span>
                      <em>{shut ? `Unlocks at stage ${spec.unlock}` : `${spec.cost} ore`}</em>
                    </button>
                  );
                })}
              </div>
              <p>Machines run on power from the gate&rsquo;s junction box or a relay pylon; most use ore, which rock drills mine.</p>
            </section>
          ) : null}
          {panel !== null ? (() => {
            const mm = plotRef.current.machines.find((x) => x.id === panel);
            const env = envRef.current;
            if (!mm || !env) return null;
            const spec = KINDS[mm.kind], metric = spec.emits;
            const run = running(plotRef.current, env).get(mm.id) ?? 0, net = network(plotRef.current, env);
            const status = !mm.on ? 'Switched off.' : !net.connected.has(mm.id) ? 'No power: out of reach of the network. Build a relay pylon closer.'
              : run > 0.95 ? 'Running.' : run > 0.05 ? `Running at ${Math.round(run * 100)}%: short of ${net.satisfaction < 0.99 ? 'power' : 'ore'}.` : spec.oreUse > 0 && plotRef.current.ore <= 0 ? 'Idle: no ore. Build a rock drill.' : 'Idle.';
            const close = (): void => { setPanel(null); lock(); };
            return (
              <section className="play-machine" aria-label={spec.name}>
                <h3>{spec.name}</h3>
                <p>{BLURB[mm.kind]} {status}</p>
                <div className="play-machine-actions">
                  <button onClick={() => changePlot(setOn(plotRef.current, mm.id, !mm.on))}>{mm.on ? 'Switch off' : 'Switch on'}</button>
                  <button onClick={() => { changePlot(removeMachine(plotRef.current, mm.id)); setPanel(null); lock(); }}>Take it down (+{Math.floor(spec.cost / 2)} ore)</button>
                </div>
                {spec.slot && metric ? (
                  <div className="play-carts">
                    <h4>Cartridge: a preset from your rack shapes what it pours</h4>
                    <div>
                      {cartridgesFor(metric, plotRef.current.stage).map((c) => (
                        <button key={c.id} className={mm.cartridge === c.id ? 'on' : ''} onClick={() => changePlot(setCartridge(plotRef.current, mm.id, mm.cartridge === c.id ? null : c.id))}>
                          <b>{c.name}</b><span>{c.gain === 1 ? 'no effect on' : `${c.gain > 1 ? '+' : ''}${Math.round((c.gain - 1) * 100)}%`} {METRIC_NAME[metric]}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
                <button className="go" onClick={close} autoFocus>Back to the plot</button>
              </section>
            );
          })() : null}
          {!locked && !paused && panel === null && !menu ? (
            <button className="play-start" onClick={lock}>
              <b>Click to look around</b>
              <span className="play-keys">{KEYS.map(([k, what]) => <span key={k}><kbd>{k}</kbd>{what}</span>)}</span>
            </button>
          ) : null}
          {paused ? (
            <div className="play-pause" role="dialog" aria-label="Paused">
              <h2>Paused</h2>
              <button className="go" onClick={lock}>Resume</button>
              <button onClick={props.onBack}>Back to SetMix</button>
            </div>
          ) : null}
          {toast ? <div key={toast.id} className={`play-toast${toast.text === 'Sync lost' ? ' lost' : ''}`} role="status"><b>{toast.text}</b>{toast.sub ? <span>{toast.sub}</span> : null}</div> : null}
        </>
      ) : null}
    </div>
  );
}
