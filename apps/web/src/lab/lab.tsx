// The SetMix home's backdrop (STATUS SM11): the lab, its archway, and the finished planet outside it. Built behind a
// loading bar (the smooth models and the planet's looks take a second or two on the minimum spec), then revealed once.
import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { deviceFor, type Stage } from '@hm/fidelity';
import { VAULT_BY_ID } from '@hm/vault';
import { pixelRatioFor, resolveGraphics } from '@hm/render';
import { powerPreferenceOf, type Profile } from '../shell/profile';
import { tierFor } from '../crafter/crafter';
import { bakeLookCached } from '../crafter/looks';
import { NEIGHBOURS } from '../crafter/planet';
import { SMOOTH_IDS, smoothModel } from '../crafter/smooth-models';
import { animalBody } from '../crafter/creatures';
import { createLabScene, type LabScene } from './lab-scene';

/** The planet when it is finished: its plains in this cartridge's last stage, every neighbour at theirs. */
const FINISHED = 'emerald_canopy';
const LAST: Stage = 6;

export function LabHome(props: { readonly profile: Profile }): ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduced = useMemo(() => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } }, []);
  const tier = useMemo(() => tierFor(props.profile), [props.profile.quality]); // eslint-disable-line react-hooks/exhaustive-deps
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState('Opening the lab');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const low = tier === 'potato' || tier === 'low';
    const device = deviceFor(tier), gridSpacing = low ? 1 : 0.5;
    let scene: LabScene;
    try {
      scene = createLabScene({ canvas, gridSpacing, antialias: !low, powerPreference: powerPreferenceOf(props.profile.gpu), reducedMotion: reduced, textureSize: low ? 512 : 1024 });
    } catch {
      setFailed(true);
      return undefined;
    }
    const graphics = resolveGraphics(tier, props.profile.graphics);
    const size = (): void => {
      const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
      scene.resize(w, h, pixelRatioFor(graphics, w, h, window.devicePixelRatio || 1));
    };
    size();
    window.addEventListener('resize', size);
    const onPointer = (ev: PointerEvent): void => scene.lean((ev.clientX / window.innerWidth) * 2 - 1, (ev.clientY / window.innerHeight) * 2 - 1);
    window.addEventListener('pointermove', onPointer);

    // a test hook, like window.hmCrafter: the e2e reads that the lab drew
    const hook = { frames: 0, ready: false, triangles: 0, calls: 0, gate: true, arch: false };
    (window as unknown as { hmLab?: typeof hook }).hmLab = hook;
    const look = (id: string) => bakeLookCached(VAULT_BY_ID.get(id)!, LAST, device, gridSpacing);
    const cartridges = [...new Set([FINISHED, ...NEIGHBOURS.map((n) => n.cartridge)])];
    // each step in its own task, so the bar keeps moving; the label names what comes next
    const steps: [string, () => void][] = [
      ...SMOOTH_IDS.map((id): [string, () => void] => ['Growing the trees', () => { smoothModel(id); }]),
      ['Waking the goblin', () => { smoothModel('goblin'); }],
      ...(['MOON_STRIDER', 'CRYSTAL_TORTOISE', 'SKY_MANTA'] as const).map((id): [string, () => void] => ['Waking the animals', () => { animalBody(id); }]),
      ...cartridges.map((id): [string, () => void] => ['Finishing the planet', () => { look(id); }]),
      ['Powering the gate', () => { scene.setVista(look(FINISHED), look(FINISHED), NEIGHBOURS.map((plot) => ({ plot, look: look(plot.cartridge) }))); }],
    ];
    let cancelled = false, raf = 0, at = 0, timer = 0, last = performance.now();
    const loop = (ms: number): void => {
      if (cancelled) return;
      const dt = Math.min(0.1, (ms - last) / 1000);
      last = ms;
      scene.frame(ms / 1000, dt);
      hook.frames += 1;
      if (hook.frames % 30 === 0) Object.assign(hook, scene.stats());
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
    setLoading(steps[0]![0]);
    timer = window.setTimeout(step, 30);
    return () => {
      cancelled = true;
      delete (window as unknown as { hmLab?: unknown }).hmLab;
      window.clearTimeout(timer);
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', size);
      window.removeEventListener('pointermove', onPointer);
      scene.dispose();
    };
  }, [tier, reduced, props.profile.gpu, props.profile.graphics]);

  return (
    <div className={`lab-home${ready ? ' ready' : ''}`}>
      {failed ? null : <canvas ref={canvasRef} className="lab-canvas" />}
      {!ready && !failed ? <div className="gr-loading lab-loading" role="status"><span>{loading}</span><i /></div> : null}
    </div>
  );
}
