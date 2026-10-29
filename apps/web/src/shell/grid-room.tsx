// Plan 57 §10: the grid room behind the home menu. It replaces the lab backdrop, which redrew a whole lab every frame (881 ms
// of main thread a second, idle). The room warms the game's presets rung by rung behind a visible bar, climbing the stage
// ladder as it goes (wireframe, 1-bit, EGA, VGA, Gouraud), and draws only when something changes, under a frame cap,
// never while the tab is hidden. Each job is a real cached pass play reuses, so play's own loading finds them done.
import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { deviceFor, type Stage } from '@hm/fidelity';
import { VAULT_BY_ID } from '@hm/vault';
import { pixelRatioFor, resolveGraphics } from '@hm/render';
import { powerPreferenceOf, type Profile } from './profile';
import { tierFor } from '../crafter/crafter';
import { bakeLookCached } from '../crafter/looks';
import { SMOOTH_IDS, smoothModel } from '../crafter/smooth-models';
import { genLevelForStage, preloadAllGenAssets } from '../assets/gen-props';
import { gameAudio } from '../audio/game-audio';
import { PLAY_NEIGHBOURS, PLAY_PLOT } from '../play/play-worlds';
import { createGridRoomScene, type GridRoomScene } from './grid-room-scene';
import { frameDue, roomFrameCap, roomStageAt, rungsWarm, warmShare, type RoomStage, type WarmJob } from './grid-room-warm';
import { BRIDGE_COMMAND, CAPTURE, EYES_EVERY_MS, SCREEN_FPS, bridgeUp, bridgeWords, frameOf, sendFrame, type BridgeState } from './game-bridge';
import { companionBridgeUrl } from '../play/bridge-url';

type Job = WarmJob & { readonly run: () => void | Promise<unknown> };

export function GridRoom(props: { readonly profile: Profile }): ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduced = useMemo(() => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } }, []);
  const tier = useMemo(() => tierFor(props.profile), [props.profile.quality]); // eslint-disable-line react-hooks/exhaustive-deps
  const [label, setLabel] = useState('Drawing the room');
  const [share, setShare] = useState(0);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  // Plan 57 §16.5: the game bridge. A linked window shows on the room's bridge screen, and the drone's eyes send its frames
  const sceneRef = useRef<GridRoomScene | null>(null);
  const invalidateRef = useRef<() => void>(() => {});
  const [bridge, setBridge] = useState<BridgeState>('checking');
  const [frames, setFrames] = useState(0);
  const [windowName, setWindowName] = useState<string | undefined>(undefined);
  const linkRef = useRef<{ readonly stream: MediaStream; readonly video: HTMLVideoElement; readonly timers: number[] } | null>(null);
  const bridgeBase = useMemo(() => (typeof window === 'undefined' ? null : companionBridgeUrl(window.location)), []);
  const unlink = useCallback((): void => {
    const l = linkRef.current;
    linkRef.current = null;
    if (!l) return;
    for (const t of l.timers) window.clearInterval(t);
    for (const track of l.stream.getTracks()) track.stop();
    l.video.srcObject = null;
    sceneRef.current?.setScreen(null);
    invalidateRef.current();
    setWindowName(undefined);
    setBridge('checking');
  }, []);
  /** Shows a shared stream on the screen, draws the room at the screen's pace, and sends the eyes' frames while the bridge answers. */
  const linkStream = useCallback((stream: MediaStream): void => {
    unlink();
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.srcObject = stream;
    void video.play().catch(() => {});
    const canvas = document.createElement('canvas');
    const tick = window.setInterval(() => invalidateRef.current(), Math.round(1000 / SCREEN_FPS));
    const eyes = window.setInterval(() => {
      if (!bridgeBase) return;
      void frameOf(video, canvas).then((b) => (b ? sendFrame(bridgeBase, b) : false)).then((ok) => { if (ok) setFrames((n) => n + 1); });
    }, EYES_EVERY_MS);
    linkRef.current = { stream, video, timers: [tick, eyes] };
    for (const track of stream.getVideoTracks()) track.addEventListener('ended', () => { if (linkRef.current?.stream === stream) unlink(); });
    sceneRef.current?.setScreen(video);
    setWindowName(stream.getVideoTracks()[0]?.label || undefined);
    setFrames(0);
    setBridge('linked');
    invalidateRef.current();
  }, [bridgeBase, unlink]);
  const link = async (): Promise<void> => {
    if (!navigator.mediaDevices?.getDisplayMedia) { setBridge('unavailable'); return; }
    try {
      linkStream(await navigator.mediaDevices.getDisplayMedia({ video: CAPTURE, audio: false, monitorTypeSurfaces: 'exclude' } as DisplayMediaStreamOptions));
    } catch {
      /* no window chosen: nothing changes */
    }
  };
  // whether the bridge answers, checked while the control shows and nothing is linked
  useEffect(() => {
    if (!ready || bridge === 'linked' || bridge === 'unavailable') return undefined;
    let gone = false;
    const check = (): void => { if (bridgeBase) void bridgeUp(bridgeBase).then((up) => { if (!gone && !linkRef.current) setBridge(up ? 'ready' : 'offline'); }); else setBridge('offline'); };
    check();
    const t = window.setInterval(check, 5000);
    return () => { gone = true; window.clearInterval(t); };
  }, [ready, bridge, bridgeBase]);
  useEffect(() => () => unlink(), [unlink]);

  useEffect(() => {
    // the room is built a frame and a task after the menu first paints (Argon, 28 Oct): the menu shows at once, the room after
    let cleanup: (() => void) | undefined, timer = 0, gone = false;
    const setup = (): (() => void) | undefined => {
      const canvas = canvasRef.current;
      if (!canvas) return undefined;
      const mountAt = performance.now();
      const low = tier === 'potato' || tier === 'low';
      // the same device and grid spacing play uses, so the looks baked here are the ones play asks for
      const device = deviceFor(tier), gridSpacing = low ? 1 : 0.5;
      let scene: GridRoomScene;
      const sceneAt = performance.now();
      try {
        scene = createGridRoomScene({ canvas, antialias: !low, powerPreference: powerPreferenceOf(props.profile.gpu) });
      } catch {
        setFailed(true);
        return undefined;
      }
      const sceneMs = performance.now() - sceneAt;
      sceneRef.current = scene;
      const graphics = resolveGraphics(tier, props.profile.graphics);
      const cap = roomFrameCap(tier);

      // a test hook, like window.hmLab before it: the e2e and scripts/measure-menu.mjs read what the room did
      const hook = { ready: false, stage: '0a' as RoomStage, share: 0, warm: [] as string[], renders: 0, calls: 0, triangles: 0, mountMs: 0, sceneMs, firstDrawMs: 0, warmMs: 0 };
      (window as unknown as { hmRoom?: typeof hook }).hmRoom = hook;

      // draw on change only: one frame is asked for when something changed, and drawn when the cap allows
      let cancelled = false, raf = 0, lastDraw = -1e9;
      const draw = (now: number): void => {
        raf = 0;
        if (cancelled || document.hidden) return;
        if (!frameDue(now, lastDraw, cap)) { raf = requestAnimationFrame(draw); return; }
        lastDraw = now;
        scene.render();
        if (!hook.renders) hook.firstDrawMs = performance.now() - mountAt;
        hook.renders += 1;
        Object.assign(hook, scene.stats());
      };
      const invalidate = (): void => { if (!raf && !cancelled) raf = requestAnimationFrame(draw); };
      invalidateRef.current = invalidate;

      const size = (): void => {
        const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
        scene.resize(w, h, pixelRatioFor(graphics, w, h, window.devicePixelRatio || 1));
        invalidate();
      };
      size();
      window.addEventListener('resize', size);
      const onPointer = (ev: PointerEvent): void => {
        scene.lean((ev.clientX / window.innerWidth) * 2 - 1, (ev.clientY / window.innerHeight) * 2 - 1);
        invalidate();
      };
      if (!reduced) window.addEventListener('pointermove', onPointer);
      const onVisible = (): void => { if (!document.hidden) { invalidate(); resume(); } };
      document.addEventListener('visibilitychange', onVisible);
      hook.mountMs = performance.now() - mountAt;
      // a test seam: show one stage's look (the e2e and the stage sheet check each era draws), then the real one again with null
      (hook as typeof hook & { showStage?: (st: RoomStage | null) => void }).showStage = (st) => { scene.setStage(st ?? hook.stage); invalidate(); };
      // a test seam for the game bridge: link a stream as a picked window would (the e2e links a canvas), or unlink
      Object.assign(hook, { linkStream: (stream: MediaStream | null) => { if (stream) linkStream(stream); else unlink(); } });

      // the warm-up, rung by rung: atoms, stacks, parts, assemblies, worlds (Argon's note)
      const look = (id: string, st: Stage) => bakeLookCached(VAULT_BY_ID.get(id)!, st, device, gridSpacing);
      const worlds = [...new Set(PLAY_NEIGHBOURS.map((n) => `${n.cartridge}@${n.stage}`))].map((k) => k.split('@') as [string, string]);
      const jobs: Job[] = [
        { rung: 'atoms', label: 'Compiling the room', weight: 1, run: () => { scene.compile(); } },
        { rung: 'atoms', label: 'Loading the sound', weight: 3, run: () => gameAudio.preloadStartupAudio() },
        ...([1, 2, 3, 4, 5, 6] as const).map((s): Job => ({ rung: 'stacks', label: 'Baking the stage looks', weight: 2, run: () => { look(PLAY_PLOT, s); } })),
        ...SMOOTH_IDS.map((id): Job => ({ rung: 'parts', label: 'Shaping the models', weight: 1, run: () => { smoothModel(id); } })),
        { rung: 'assemblies', label: 'Generating the props', weight: 4, run: () => preloadAllGenAssets(genLevelForStage(1, props.profile.quality)) },
        ...worlds.map(([id, st]): Job => ({ rung: 'worlds', label: 'Finding the other worlds', weight: 1, run: () => { look(id, Number(st) as Stage); } })),
      ];
      let at = 0, timer = 0, waiting = false;
      const show = (): void => {
        const s = warmShare(jobs, at);
        const stage = roomStageAt(s);
        const warm = rungsWarm(jobs, at);
        scene.setStage(stage);
        scene.setWarm(warm);
        Object.assign(hook, { stage, share: s, warm: [...warm] });
        setShare(s);
        invalidate();
      };
      const step = async (): Promise<void> => {
        timer = 0;
        if (cancelled) return;
        // a hidden tab waits: the warm-up resumes when the room is seen again
        if (document.hidden) { waiting = true; return; }
        try { await jobs[at]!.run(); } catch { /* a failed preload only means play loads that piece itself */ }
        if (cancelled) return;
        at += 1;
        show();
        if (at < jobs.length) { setLabel(jobs[at]!.label); timer = window.setTimeout(step, 0); return; }
        scene.setGateOpen(true);
        hook.ready = true;
        hook.warmMs = performance.now() - mountAt;
        setReady(true);
        invalidate();
      };
      function resume(): void { if (waiting && !cancelled) { waiting = false; timer = window.setTimeout(step, 0); } }
      show();
      setLabel(jobs[0]!.label);
      timer = window.setTimeout(step, 30);

      return () => {
        cancelled = true;
        unlink();
        sceneRef.current = null;
        invalidateRef.current = () => {};
        delete (window as unknown as { hmRoom?: unknown }).hmRoom;
        if (timer) window.clearTimeout(timer);
        if (raf) cancelAnimationFrame(raf);
        window.removeEventListener('resize', size);
        window.removeEventListener('pointermove', onPointer);
        document.removeEventListener('visibilitychange', onVisible);
        scene.dispose();
      };
    };
    const first = requestAnimationFrame(() => { timer = window.setTimeout(() => { if (!gone) cleanup = setup(); }, 0); });
    return () => { gone = true; cancelAnimationFrame(first); window.clearTimeout(timer); cleanup?.(); };
  }, [tier, reduced, props.profile.gpu, props.profile.graphics, props.profile.quality]);

  const words = bridgeWords(bridge, { frames, windowName });
  return (
    <div className={`grid-room${ready ? ' ready' : ''}`}>
      {failed ? null : <canvas ref={canvasRef} className="grid-room-canvas" />}
      {ready && !failed ? (
        <aside className={`room-bridge room-bridge--${bridge}`} aria-label="Game bridge" data-testid="room-bridge">
          <p className="room-bridge-title"><i aria-hidden="true" />Game bridge</p>
          <p className="room-bridge-line" aria-live="polite">{words.line}</p>
          {bridge === 'offline' ? <code className="room-bridge-cmd">{BRIDGE_COMMAND}</code> : null}
          {words.action ? (
            <button type="button" className="room-bridge-act" onClick={() => { if (bridge === 'linked') unlink(); else void link(); }}>{words.action}</button>
          ) : null}
        </aside>
      ) : null}
      {!ready && !failed ? (
        <div className="grid-room-status" role="status" aria-live="polite">
          <span>{label}</span>
          <i style={{ ['--warm' as string]: share }} aria-hidden="true" />
        </div>
      ) : null}
    </div>
  );
}
