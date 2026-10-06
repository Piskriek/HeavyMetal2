// The Resolution Crafter preview (STATUS SM7), opened by Play: your plot and the resolution wave through the six stages.
// Slot a cartridge and climb: the world goes up the ladder and each new look sweeps out from your plot's centre. The climb is a
// test control; machines drive it once they are picked from the concept art (docs/SETMIX_PLAN.md).
import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { deviceFor, normalised, type DeviceProfile, type Stage } from '@hm/fidelity';
import { VAULT, VAULT_BY_ID, type VaultCartridge } from '@hm/vault';
import { guessQuality, parseQuality, type Quality } from '@hm/game';
import { pixelRatioFor, resolveGraphics } from '@hm/render';
import { noteGpu, powerPreferenceOf, type Profile } from '../shell/profile';
import { bakeLookCached, cartridgeThumb, type StageLook } from './looks';
import { createMoonScene, type MoonScene } from './moon-scene';
import { NEIGHBOURS } from './planet';
import { SMOOTH_IDS, smoothModel } from './smooth-models';
import { animalBody } from './creatures';
import { STAGE_NAMES, STAGE_STARTS, WaveQueue, stageAt, stateAt } from './progress';
import './crafter.css';

/** The whole climb takes this long (seconds). */
const CLIMB_SECONDS = 80;
const FIRST_CARTRIDGE = 'lunar_anorthosite';
const CATEGORY_WORDS: Readonly<Record<VaultCartridge['category'], string>> = {
  TERRAIN: 'Terrain', FLORA: 'Flora', LIQUID: 'Liquid', CRYSTAL: 'Crystal', ROAD: 'Road', STRUCTURE: 'Structure', EXOTIC: 'Exotic',
};

/** The graphics chip's name, from a throwaway context (it decides the tier on Auto). */
export function gpuName(): string | null {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    const info = gl?.getExtension('WEBGL_debug_renderer_info');
    const name = gl && info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : null;
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
    return name;
  } catch { return null; }
}

/** The tier this device draws at: the Settings choice, or the Auto guess. */
export function tierFor(profile: Profile): Quality {
  const chosen = parseQuality(profile.quality);
  if (chosen) return chosen;
  const gpu = gpuName();
  noteGpu(gpu);
  return guessQuality({ touch: matchMedia('(pointer: coarse)').matches, cores: navigator.hardwareConcurrency || 0, dpr: window.devicePixelRatio || 1, width: window.innerWidth, gpu });
}

interface Hud { readonly p: number; readonly stage: Stage; readonly running: boolean; readonly look: StageLook | null; readonly preparing: string | null }

export function ResolutionCrafter(props: { readonly profile: Profile; readonly onBack: () => void }): ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const consoleRef = useRef<HTMLElement>(null);
  /** The scene's resize, for the console's height watcher. */
  const resizeRef = useRef<() => void>(() => undefined);
  const reduced = useMemo(() => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } }, []);
  const tier = useMemo(() => tierFor(props.profile), [props.profile.quality]); // eslint-disable-line react-hooks/exhaustive-deps
  const device: DeviceProfile = useMemo(() => deviceFor(tier), [tier]);
  const gridSpacing = tier === 'potato' || tier === 'low' ? 1 : 0.5;

  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState('Building the moon');
  const [failure, setFailure] = useState('');
  const [cartId, setCartId] = useState(FIRST_CARTRIDGE);
  const [hud, setHud] = useState<Hud>({ p: 0, stage: 1, running: false, look: null, preparing: null });
  const [thumbs, setThumbs] = useState<ReadonlyMap<string, string>>(new Map());

  // the loop's state lives outside React; the console reads it a few times a second
  const live = useRef({ p: 0, running: false, cartId: FIRST_CARTRIDGE, jumpTo: -1 });
  const looks = useRef(new Map<string, StageLook>());
  const lookFor = useCallback((id: string, stage: Stage): StageLook => {
    const key = `${id}@${stage}@${device.id}`;
    let look = looks.current.get(key);
    if (!look) { look = bakeLookCached(VAULT_BY_ID.get(id)!, stage, device, gridSpacing); looks.current.set(key, look); }
    return look;
  }, [device, gridSpacing]);

  // build the planet behind the loading bar: the scene, your moon's first look, the smooth models, the neighbours' looks
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    let scene: MoonScene;
    try {
      scene = createMoonScene({ canvas, gridSpacing, antialias: tier !== 'potato' && tier !== 'low', powerPreference: powerPreferenceOf(props.profile.gpu), reducedMotion: reduced });
    } catch {
      setFailure('This browser could not start 3D graphics (WebGL 2). Try another browser, or turn on hardware acceleration in its settings.');
      return undefined;
    }
    const graphics = resolveGraphics(tier, props.profile.graphics);
    const size = (): void => {
      const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
      scene.resize(w, h, pixelRatioFor(graphics, w, h, window.devicePixelRatio || 1), consoleRef.current?.getBoundingClientRect().height ?? 0);
    };
    resizeRef.current = size;
    size();
    window.addEventListener('resize', size);

    const queue = new WaveQueue();
    // a test hook (like window.hmBudget): the e2e and the preview checks read where the wave is
    const hook = { p: 0, stage: 1, radius: -1, shown: '', target: '', queued: 0, frames: 0 };
    (window as unknown as { hmCrafter?: typeof hook }).hmCrafter = hook;
    let shownKey = '', targetKey = '', wantKey = '', raf = 0, last = performance.now(), hudAt = 0, cancelled = false;
    let lastRunning = false, lastCart = FIRST_CARTRIDGE;
    const pending: [string, Stage][] = [];
    const keyOf = (id: string, stage: Stage) => `${id}@${stage}@${device.id}`;

    const start = (): void => {
      const first = lookFor(FIRST_CARTRIDGE, 1);
      scene.show(first); shownKey = targetKey = wantKey = first.key;
      for (let s = 2; s <= 6; s++) pending.push([FIRST_CARTRIDGE, s as Stage]);
      setReady(true);
      raf = requestAnimationFrame(loop);
    };

    const loop = (nowMs: number): void => {
      if (cancelled) return;
      const now = nowMs / 1000, dt = Math.min(0.1, (nowMs - last) / 1000);
      last = nowMs;
      const l = live.current;
      if (l.jumpTo >= 0) { l.p = l.jumpTo; l.jumpTo = -1; }
      if (l.running) l.p = Math.min(1, l.p + dt / CLIMB_SECONDS);
      if (l.p >= 1 && l.running) l.running = false;
      if (l.cartId !== lastCart || l.running !== lastRunning) {
        // a newly slotted cartridge gets its six looks baked ahead, one a frame
        if (l.cartId !== lastCart) for (let s = 1; s <= 6; s++) if (!looks.current.has(keyOf(l.cartId, s as Stage))) pending.push([l.cartId, s as Stage]);
        lastCart = l.cartId; lastRunning = l.running;
      }
      const stage = stageAt(l.p);
      const want = keyOf(l.cartId, stage);
      if (want !== wantKey) { wantKey = want; queue.push(want, now); }
      const step = queue.step(now);
      if (step.done) { scene.settle(); shownKey = step.done; }
      if (step.wave && step.wave.to !== targetKey && step.wave.to !== shownKey) {
        const [id, st] = step.wave.to.split('@') as [string, string];
        scene.setTarget(lookFor(id, Number(st) as Stage));
        targetKey = step.wave.to;
      }
      scene.setFront(step.wave ? step.radius : 0);
      hook.p = l.p; hook.stage = stage; hook.radius = step.wave ? step.radius : -1; hook.shown = shownKey;
      hook.target = step.wave?.to ?? ''; hook.queued = queue.queued; hook.frames += 1;
      // bake one waiting look between waves' starts, so a slotted cartridge is ready before its stages come
      let preparing: string | null = null;
      if (pending.length) {
        const [id, st] = pending.shift()!;
        lookFor(id, st);
        preparing = pending.length ? VAULT_BY_ID.get(id)!.name : null;
      }
      scene.frame(now, dt);
      if (nowMs - hudAt > 120) {
        hudAt = nowMs;
        const shown = looks.current.get(shownKey) ?? null;
        setHud({ p: l.p, stage, running: l.running, look: shown, preparing });
      }
      raf = requestAnimationFrame(loop);
    };

    // the loading bar's steps, each in its own task so the bar keeps moving between them; the label names what comes next
    const steps: [string, () => void][] = [
      ['Building the moon', () => { lookFor(FIRST_CARTRIDGE, 1); }],
      ...SMOOTH_IDS.map((id): [string, () => void] => ['Shaping the boulders and trees', () => { smoothModel(id); }]),
      ...(['MOON_STRIDER', 'CRYSTAL_TORTOISE', 'SKY_MANTA'] as const).map((id): [string, () => void] => ['Waking the animals', () => { animalBody(id); }]),
      ...[...new Set(NEIGHBOURS.map((n) => `${n.cartridge}@${n.stage}`))].map((k): [string, () => void] => {
        const [id, st] = k.split('@') as [string, string];
        return ['Visiting the neighbours', () => { lookFor(id, Number(st) as Stage); }];
      }),
      ['Laying out the plains', () => { scene.setPlanet(lookFor(FIRST_CARTRIDGE, 1), NEIGHBOURS.map((plot) => ({ plot, look: lookFor(plot.cartridge, plot.stage) }))); }],
    ];
    let stepAt = 0, boot = 0;
    const runStep = (): void => {
      if (cancelled) return;
      steps[stepAt]![1]();
      stepAt += 1;
      if (stepAt < steps.length) { setLoading(steps[stepAt]![0]); boot = window.setTimeout(runStep, 0); } else start();
    };
    // let the loading bar paint before the first bakes
    boot = window.setTimeout(runStep, 30);
    return () => {
      cancelled = true;
      delete (window as unknown as { hmCrafter?: unknown }).hmCrafter;
      window.clearTimeout(boot);
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', size);
      scene.dispose();
    };
  }, [device, gridSpacing, lookFor, props.profile.gpu, props.profile.graphics, reduced, tier]);

  // the console arrives after loading and changes height on narrow screens: keep the view centred above it
  useEffect(() => {
    const el = consoleRef.current;
    if (!ready || !el) return undefined;
    const watch = new ResizeObserver(() => resizeRef.current());
    watch.observe(el);
    return () => watch.disconnect();
  }, [ready]);

  // cartridge thumbnails, a few at a time once the moon is up
  useEffect(() => {
    if (!ready) return undefined;
    let i = 0, timer = 0;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 40;
    const ctx = canvas.getContext('2d');
    const made = new Map<string, string>();
    const next = (): void => {
      for (let k = 0; k < 4 && i < VAULT.length; k++, i++) {
        const c = VAULT[i]!;
        if (!ctx) break;
        ctx.putImageData(new ImageData(new Uint8ClampedArray(cartridgeThumb(c, 40)), 40, 40), 0, 0);
        made.set(c.id, canvas.toDataURL());
      }
      setThumbs(new Map(made));
      if (i < VAULT.length) timer = window.setTimeout(next, 16);
    };
    timer = window.setTimeout(next, 200);
    return () => window.clearTimeout(timer);
  }, [ready]);

  const run = useCallback(() => {
    const l = live.current;
    if (l.p >= 1 && !l.running) l.p = STAGE_STARTS[0]!;
    l.running = !l.running;
  }, []);
  const slot = useCallback((id: string) => {
    live.current.cartId = id;
    setCartId(id);
  }, []);
  const jump = useCallback((stage: number) => { live.current.jumpTo = STAGE_STARTS[stage - 1]! + (stage === 1 ? 0 : 0.002); }, []);

  // Space climbs or pauses, Esc goes back
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') { props.onBack(); return; }
      const t = e.target as HTMLElement | null;
      if (e.code === 'Space' && !(t && (t.tagName === 'BUTTON' || t.tagName === 'INPUT'))) { e.preventDefault(); run(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [props, run]);

  const n = normalised(stateAt(hud.p));
  const cart = VAULT_BY_ID.get(cartId)!;
  // the newest cartridges first: the ones this stage just unlocked are what the player wants to try
  const unlocked = VAULT.filter((c) => c.minStage <= hud.stage).sort((a, b) => b.minStage - a.minStage);
  const locked = VAULT.length - unlocked.length;
  const heldBack = hud.look?.budget.demoted ?? [];
  const meters: readonly [string, number][] = [['Pixels', n.pxd], ['Vertices', n.vtx], ['Light', n.lx], ['Water', n.aq]];

  return (
    <div className={`rc${(hud.look?.atmosphere ?? 0) > 0.55 ? ' rc-sky-light' : ''}`}>
      <canvas ref={canvasRef} className="rc-view" aria-label="The moon. Drag to look around; the wheel comes closer." />
      <header className="rc-top">
        <div className="rc-brand"><b>SetMix</b><i>Resolution Crafter</i></div>
        <button className="rc-back" onClick={props.onBack}>Back to SetMix</button>
      </header>
      {!ready && !failure ? <div className="rc-loading gr-loading" role="status"><span>{loading}</span><i /></div> : null}
      {failure ? <p className="rc-failure" role="alert">{failure}</p> : null}
      {ready ? (
        <section ref={consoleRef} className="rc-console" aria-label="Stage console">
          <div className="rc-stage">
            <p className="rc-stage-line"><b>Stage {hud.stage} of 6</b><span>{STAGE_NAMES[hud.stage]}</span></p>
            <ol className="rc-ladder" aria-label="Stages">
              {([1, 2, 3, 4, 5, 6] as const).map((s) => (
                <li key={s}><button className={s <= hud.stage ? (s === hud.stage ? 'here reached' : 'reached') : ''} aria-label={`Go to stage ${s}: ${STAGE_NAMES[s]}`} aria-current={s === hud.stage ? 'step' : undefined} onClick={() => jump(s)}>{s}</button></li>
              ))}
            </ol>
            <p className="rc-note">{heldBack.length ? `Held back on ${device.label}: ${heldBack.join(', ')}.` : `Drawn in full on ${device.label}.`}</p>
          </div>
          <div className="rc-meters" aria-label="What the moon is made of">
            {meters.map(([label, value]) => (
              <div key={label} className="rc-meter">
                <span>{label}</span>
                <i role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value * 100)}><b style={{ width: `${(value * 100).toFixed(1)}%` }} /></i>
                <em>{Math.round(value * 100)}%</em>
              </div>
            ))}
          </div>
          <div className="rc-slot">
            <p className="rc-cart"><b>{cart.name}</b><span>{CATEGORY_WORDS[cart.category]}, tier {cart.tier}{hud.preparing ? `. Preparing ${hud.preparing}` : ''}</span></p>
            <div className="rc-strip" role="listbox" aria-label="Cartridges you can slot">
              {unlocked.map((c) => (
                <button key={c.id} role="option" aria-selected={c.id === cartId} title={c.minStage === hud.stage && hud.stage > 1 ? `${c.name} (new at this stage)` : c.name}
                  className={[c.id === cartId ? 'on' : '', c.minStage === hud.stage && hud.stage > 1 ? 'new' : ''].join(' ').trim()} onClick={() => slot(c.id)}>
                  {thumbs.get(c.id) ? <img src={thumbs.get(c.id)} alt="" width={36} height={36} /> : <span style={{ background: c.tint }} />}
                </button>
              ))}
              {locked ? <span className="rc-locked">{locked} more at higher stages</span> : null}
            </div>
            <button className="go rc-run" onClick={run} aria-pressed={hud.running}>{hud.running ? 'Pause' : hud.p >= 1 ? 'Start again' : 'Climb'}</button>
          </div>
        </section>
      ) : null}
      {ready ? <p className="rc-hint">Drag to look around. Pick a cartridge, then Climb (Space): each stage sweeps out from your plot's centre.</p> : null}
    </div>
  );
}
