import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { AnimatePresence, motion, MotionConfig } from 'framer-motion';
import {
  ArrowDownToLine, ArrowRight, ArrowUpFromLine, ArrowUpRight, Check, ChevronDown,
  CircleHelp, Crosshair, Flag, FlagTriangleRight, Gauge, Hammer, Image as ImageIcon,
  Maximize2, Menu, Minimize2, MousePointer2, Pause, Play, RotateCcw, Settings2,
  ShieldCheck, Sparkles, Trophy, Volume2, VolumeX, X, Zap,
} from 'lucide-react';
import Modal from '../components/Modal';
import ArtGallery from '../components/ArtGallery';
import GoblinMark from '../components/GoblinMark';
import RaceControls from '../components/RaceControls';
import RoundResult from '../components/RoundResult';
import { AirSupplyGuide } from '../components/AirSupplies';
import { mergeRunRecord } from '../game/preferences';
import { prepareRaceCapsules, prepareRosterArt } from '../game/loadout-art';
import { prepareWorldArt } from '../game/world-art';
import { loadoutStats, riderById, capsuleById } from '../game/loadouts';
import { CUP_NAME, roundComplete, type RaceConfig, type RaceSession } from '../game/session';
import { TRACK_DISTANCE } from '../game/scene';
import { loadAssets, type GameAssets, type SpriteName } from '../game/assets';
import { preparePowerupSprites } from '../game/powerups';
import { TRACKS } from '../game/courses';
import { GameEngine } from '../game/engine';
import { COURSES, INITIAL_SNAPSHOT, type GameOptions, type RunRecord } from '../game/types';
import RaceLoadingScreen from '../components/RaceLoadingScreen';
import { formatKey, loadBindings, type KeyBindings } from '../game/controls';

type ModalName = 'help' | 'workshop' | 'records' | null;
type WorkshopTab = 'garage' | 'concept' | 'sprites';
const number = new Intl.NumberFormat('en-US').format;

interface RaceScreenProps {
  active: boolean;
  options: GameOptions;
  setOptions: Dispatch<SetStateAction<GameOptions>>;
  records: RunRecord[];
  setRecords: Dispatch<SetStateAction<RunRecord[]>>;
  onMainMenu: () => void;
  onSettings: () => void;
  config: RaceConfig;
  session: RaceSession;
  onRoundComplete: (record: RunRecord) => void;
  onContinue: () => void;
  onNewGame: () => void;
  /** Reports the explicit persisted phase while the round is live. */
  onPhase: (phase: 'grid' | 'racing') => void;
  /** Recovery messages from the durable save, shown before the relaunch. */
  gridNotes: string[];
  storageWarning: string | null;
}

function download(url: string, filename: string) {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
}

async function downloadSourcePng(url: string, filename: string) {
  const image = new Image();
  image.src = url;
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  canvas.getContext('2d')?.drawImage(image, 0, 0);
  download(canvas.toDataURL('image/png'), filename);
}

const HAZARDS: { sprite: SpriteName; name: string; description: string }[] = [
  { sprite: 'spring', name: 'Spring loaded', description: 'A big bounce, a little airtime, and one bounce charge back.' },
  { sprite: 'boost', name: 'Full throttle', description: 'Hit the chevrons for instant speed and a fresh boost charge.' },
  { sprite: 'tnt', name: 'Explosive potential', description: 'Run into it. Seriously. The blast sends you further.' },
  { sprite: 'sheep', name: 'The local wildlife', description: 'Soft landings. Loud complaints. No sheep are harmed.' },
];


export default function RaceScreen({ active, options, setOptions, records, setRecords, onMainMenu, onSettings, config, session, onRoundComplete, onContinue, onNewGame, onPhase, gridNotes, storageWarning }: RaceScreenProps) {
  const [assets, setAssets] = useState<GameAssets | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [artFailures, setArtFailures] = useState<string[]>([]);
  const [loadingAttempt, setLoadingAttempt] = useState(0);
  const [snapshot, setSnapshot] = useState(INITIAL_SNAPSHOT);
  const [result, setResult] = useState<RunRecord | null>(() => session.results.find((record) => record.round === config.round) ?? null);
  // A round that was already committed before this screen mounted is never rebuilt as a live race.
  const [resumeOnly] = useState(() => session.results.some((record) => record.round === config.round));
  const [modal, setModal] = useState<ModalName>(null);
  const [workshopTab, setWorkshopTab] = useState<WorkshopTab>('garage');
  const [helpTab, setHelpTab] = useState<'basics' | 'hazards'>('basics');
  const [mobileMenu, setMobileMenu] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [theater, setTheater] = useState(false);
  const [clearConfirm, setClearConfirm] = useState(false);
  const [bindings, setBindings] = useState<KeyBindings>(() => loadBindings());
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingDismissed, setLoadingDismissed] = useState(() => session.results.some((record) => record.round === config.round));
  const bindingsRef = useRef<KeyBindings>(bindings);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const stats = useMemo(() => loadoutStats(config.loadout), [config.loadout]);
  const raceOptions = useMemo(() => ({ ...options, course: config.course,
    launchSpeed: config.customPhysics ? options.launchSpeed : stats.launchSpeed,
    ballWeight: config.customPhysics ? options.ballWeight : stats.weight,
  }), [options, config, stats]);
  const optionsRef = useRef(raceOptions);
  const finishRef = useRef(onRoundComplete);
  finishRef.current = onRoundComplete;
  const modalRef = useRef<ModalName>(null);
  const resumeAfterModal = useRef(false);
  const resumeAfterScreen = useRef(false);
  const activeRef = useRef(active);
  activeRef.current = active;
  optionsRef.current = raceOptions;
  bindingsRef.current = bindings;
  useEffect(() => {
    const handler = () => setBindings(loadBindings());
    window.addEventListener('goblin-bindings-changed' as any, handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener('goblin-bindings-changed' as any, handler);
      window.removeEventListener('storage', handler);
    };
  }, []);
  // Reset loading cover when config changes (new round)
  useEffect(() => { setLoadingDismissed(session.results.some((r) => r.round === config.round)); setLoadingProgress(0); }, [config.round, config.course]);
  // Drive a fake progress while assets are null so the bar feels alive
  useEffect(() => {
    if (assets) { setLoadingProgress(100); return; }
    setLoadingProgress(8);
    const iv = window.setInterval(() => setLoadingProgress((p) => Math.min(92, p + Math.random() * 9)), 420);
    return () => clearInterval(iv);
  }, [assets, loadingAttempt, config]);
  // Auto-dismiss shortly after ready so auto-advance still works, but user can also click
  useEffect(() => {
    if (!assets || loadingDismissed || resumeOnly) return;
    if (snapshot.status !== 'ready') return;
    const t = window.setTimeout(() => setLoadingDismissed(true), 2600);
    return () => clearTimeout(t);
  }, [assets, loadingDismissed, resumeOnly, snapshot.status]);

  const best = useMemo(() => Math.max(0, ...records.map((record) => record.distance)), [records]);
  const course = COURSES.find((item) => item.id === config.course) ?? COURSES[0];
  const playing = snapshot.status === 'flying';
  const ready = snapshot.status === 'ready';
  const paused = snapshot.status === 'paused';

  useEffect(() => {
    let active = true;
    setLoadError(false);
    // Every painted PNG is decoded before the race starts: nothing is generated per frame.
    // The painted scenery props are decoded first: course art bakes them at build-course
    // time, so racing must not compose the background before the artwork is available.
    prepareWorldArt()
      .then(() => Promise.all([loadAssets(), prepareRaceCapsules(config.roster), preparePowerupSprites(), prepareRosterArt(config.roster)]))
      .then(([loaded, raceCapsules, pickupSprites, art]) => {
        if (!active) return;
        setArtFailures(art.failures);
        setAssets({ ...loaded, raceCapsules, pickupSprites });
      }).catch(() => { if (active) setLoadError(true); });
    return () => { active = false; };
  }, [loadingAttempt, config]);

  const handleFinish = useCallback((record: RunRecord) => {
    setResult(record);
    setRecords((previous) => mergeRunRecord(previous, record));
    finishRef.current(record);
  }, [setRecords]);

  useEffect(() => {
    if (resumeOnly || !assets || !canvasRef.current || !stageRef.current) return;
    const engine = new GameEngine(canvasRef.current, assets, optionsRef.current, setSnapshot, handleFinish, config);
    engineRef.current = engine;
    engine.inputEnabled = activeRef.current && !modalRef.current;
    engine.setVisible(activeRef.current);
    const resize = () => {
      const rect = stageRef.current?.getBoundingClientRect();
      if (rect && rect.height > 0 && rect.width > 0) engine.resize(rect.width, rect.height);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(stageRef.current);
    const visibilityObserver = new IntersectionObserver(([entry]) => engine.setVisible(activeRef.current && entry.isIntersecting), { threshold: 0.01 });
    visibilityObserver.observe(stageRef.current);
    return () => {
      observer.disconnect();
      visibilityObserver.disconnect();
      engine.destroy();
      engineRef.current = null;
    };
  }, [assets, handleFinish, config, resumeOnly]);

  // Persist the explicit phase: grid before launch, racing while the round is live.
  useEffect(() => {
    if (resumeOnly) return;
    if (snapshot.status === 'ready') onPhase('grid');
    else if (snapshot.status === 'flying' || snapshot.status === 'paused') onPhase('racing');
  }, [snapshot.status, resumeOnly, onPhase]);

  useEffect(() => {
    engineRef.current?.setOptions(raceOptions);
  }, [raceOptions]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    if (!active) {
      setTheater(false);
      setMobileMenu(false);
      resumeAfterScreen.current = engine.status === 'flying';
      if (engine.status === 'flying') engine.togglePause();
      engine.inputEnabled = false;
      engine.setVisible(false);
    } else {
      engine.inputEnabled = !modalRef.current;
      engine.setVisible(true);
      if (resumeAfterScreen.current && engine.status === 'paused') engine.togglePause();
      resumeAfterScreen.current = false;
      if (!modalRef.current) canvasRef.current?.focus({ preventScroll: true });
    }
  }, [active, assets]);

  const closeModal = useCallback(() => {
    setModal(null);
    modalRef.current = null;
    const engine = engineRef.current;
    if (engine) {
      engine.inputEnabled = activeRef.current;
      if (activeRef.current && resumeAfterModal.current && engine.status === 'paused') {
        engine.togglePause();
        canvasRef.current?.focus({ preventScroll: true });
      }
    }
    resumeAfterModal.current = false;
    setClearConfirm(false);
  }, []);

  const openModal = useCallback((name: Exclude<ModalName, null>) => {
    const engine = engineRef.current;
    if (!modalRef.current) resumeAfterModal.current = engine?.status === 'flying';
    if (engine) {
      engine.inputEnabled = false;
      if (engine.status === 'flying') engine.togglePause();
    }
    modalRef.current = name;
    setModal(name);
    setMobileMenu(false);
  }, []);

  const retry = useCallback((autoLaunch = false) => {
    if (roundComplete(session)) { onContinue(); return; }
    engineRef.current?.reset();
    setResult(null);
    if (autoLaunch) engineRef.current?.launch();
    canvasRef.current?.focus({ preventScroll: true });
  }, [session, onContinue]);

  const toggleFullscreen = useCallback(async () => {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if (theater) setTheater(false);
    else if (shellRef.current?.requestFullscreen) {
      try { await shellRef.current.requestFullscreen(); }
      catch { setTheater(true); }
    } else setTheater(true);
    canvasRef.current?.focus({ preventScroll: true });
  }, [theater]);

  useEffect(() => {
    const change = () => setFullscreen(Boolean(document.fullscreenElement));
    const visibility = () => { if (document.hidden && engineRef.current?.status === 'flying') engineRef.current.togglePause(); };
    document.addEventListener('fullscreenchange', change);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      document.removeEventListener('fullscreenchange', change);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, []);

  useEffect(() => {
    if (!theater) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [theater]);

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (!activeRef.current || event.defaultPrevented || modalRef.current || (event.repeat && !event.code.startsWith('Arrow')) || event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target as HTMLElement;
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName) || target.isContentEditable) return;
      if (['BUTTON', 'A'].includes(target.tagName) && ['Space', 'Enter'].includes(event.code)) return;
      // Loading cover: any key dismisses once ready, without triggering game actions
      if (!loadingDismissed && assets && !resumeOnly && snapshot.status === 'ready') {
        event.preventDefault();
        setLoadingDismissed(true);
        canvasRef.current?.focus({ preventScroll: true });
        return;
      }
      const engine = engineRef.current;
      if (!engine) return;
      const code = event.code;
      const b = bindingsRef.current;
      // Aim adjustments while on the grid (ready) keep arrow keys for fine-tuning regardless of remaps
      if (engine.status === 'ready' && code === 'ArrowUp') { event.preventDefault(); engine.adjustAim(0, 3); return; }
      if (engine.status === 'ready' && code === 'ArrowDown') { event.preventDefault(); engine.adjustAim(0, -3); return; }
      if (engine.status === 'ready' && code === 'ArrowLeft') { event.preventDefault(); engine.adjustAim(-0.05, 0); return; }
      if (engine.status === 'ready' && code === 'ArrowRight') { event.preventDefault(); engine.adjustAim(0.05, 0); return; }
      // Fixed non-remappable actions
      if (code === 'Enter') { event.preventDefault(); if (engine.status === 'finished') retry(true); else engine.launch(); return; }
      if (code === 'KeyR') { event.preventDefault(); retry(); return; }
      if (code === 'KeyM') { setOptions((previous) => ({ ...previous, sound: !previous.sound })); return; }
      if (code === 'KeyF') { event.preventDefault(); void toggleFullscreen(); return; }
      // Customizable bindings
      if ((b.steerLeft ?? []).includes(code)) { event.preventDefault(); engine.changeLane(-1); return; }
      if ((b.steerRight ?? []).includes(code)) { event.preventDefault(); engine.changeLane(1); return; }
      if ((b.hop ?? []).includes(code)) { event.preventDefault(); engine.jump(); return; }
      if ((b.bounce ?? []).includes(code)) { event.preventDefault(); engine.bounce(); return; }
      if ((b.boost ?? []).includes(code)) { event.preventDefault(); engine.boost(); return; }
      if ((b.pause ?? []).includes(code)) {
        event.preventDefault();
        if (code === 'Escape' && theater) setTheater(false);
        else { engine.togglePause(); canvasRef.current?.focus({ preventScroll: true }); }
        return;
      }
      // Fallback: Escape should also close theater even if not bound to pause (defensive)
      if (code === 'Escape' && theater) { setTheater(false); return; }
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, [retry, theater, toggleFullscreen, loadingDismissed, assets, resumeOnly, snapshot.status]);

  const mainAction = () => {
    if (resumeOnly || snapshot.status === 'finished') { onContinue(); return; }
    if (ready) engineRef.current?.launch();
    else if (paused || playing) engineRef.current?.togglePause();
    else retry();
    canvasRef.current?.focus({ preventScroll: true });
  };
  const toggleSound = () => {
    setOptions((previous) => ({ ...previous, sound: !previous.sound }));
    if (playing || paused) canvasRef.current?.focus({ preventScroll: true });
  };
  const togglePause = () => {
    engineRef.current?.togglePause();
    canvasRef.current?.focus({ preventScroll: true });
  };
  const showConcept = () => { setWorkshopTab('concept'); openModal('workshop'); };
  const showGarage = () => { setWorkshopTab('garage'); openModal('workshop'); };
  const saveSource = (url: string, filename: string) => {
    void downloadSourcePng(url, filename).catch(() => undefined);
  };

  return (
    <MotionConfig reducedMotion={options.reducedMotion ? 'always' : 'user'}>
      <div className="app race-app">
        <header className="site-header">
          <div className="header-inner">
            <button className="brand" aria-label="Return to main menu" onClick={onMainMenu}>
              <GoblinMark /><span className="brand-wordmark">GOBLIN<span>RALLY<span className="brand-period">.</span></span></span>
            </button>
            <nav className="desktop-nav" aria-label="Main navigation">
              <button className="nav-link" onClick={onMainMenu}>MAIN MENU</button>
              <button className={modal === 'workshop' ? 'nav-link active' : 'nav-link'} onClick={showGarage}>THE WORKSHOP</button>
              <button className={modal === 'records' ? 'nav-link active' : 'nav-link'} onClick={() => openModal('records')}>HALL OF CHAOS</button>
            </nav>
            <div className="header-actions">
              <button className="help-link" onClick={onSettings}><Settings2 size={17} /><span>Settings</span></button><span className="header-divider" />
              <button className={`icon-button sound-button ${options.sound ? 'sound-on' : ''}`} onClick={toggleSound} aria-label={options.sound ? 'Mute sound' : 'Enable sound'} aria-pressed={options.sound} title={options.sound ? 'Sound on (M)' : 'Sound off (M)'}>{options.sound ? <Volume2 size={19} /> : <VolumeX size={19} />}</button>
              <button className="icon-button mobile-menu-button" onClick={() => setMobileMenu(!mobileMenu)} aria-label={mobileMenu ? 'Close navigation' : 'Open navigation'} aria-expanded={mobileMenu}>{mobileMenu ? <X size={22} /> : <Menu size={22} />}</button>
            </div>
          </div>
          <AnimatePresence>{mobileMenu && <motion.nav initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="mobile-nav" aria-label="Mobile navigation"><button onClick={onMainMenu}>Main menu <Flag size={17} /></button><button onClick={onSettings}>Settings <Settings2 size={17} /></button><button onClick={showGarage}>The workshop <Hammer size={17} /></button><button onClick={() => openModal('records')}>Hall of chaos <Trophy size={17} /></button><button onClick={() => openModal('help')}>How to play <CircleHelp size={17} /></button></motion.nav>}</AnimatePresence>
        </header>

        <main className="main-content">
          {storageWarning && <p className="race-storage-warning" role="status"><ShieldCheck size={15} />{storageWarning}</p>}
          {artFailures.length > 0 && <p className="race-storage-warning" role="status"><ImageIcon size={15} />{artFailures.length} painted sprite{artFailures.length === 1 ? '' : 's'} could not be loaded, so a stand-in is shown. The race is unaffected.</p>}
          <div className="event-race-banner"><span>{config.customPhysics ? 'CUSTOM PRACTICE' : config.mode === 'tournament' ? `${CUP_NAME.toUpperCase()} / ROUND ${config.round + 1} OF ${config.totalRounds}` : 'QUICK RACE'}<small className="race-biome">{TRACKS[config.course].region}</small></span><span>{riderById(config.loadout.rider).name} + {capsuleById(config.loadout.capsule).name}<small>{config.difficulty.toUpperCase()}</small></span></div>
          <motion.section className="game-intro" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} aria-labelledby="game-title">
            <div className="intro-title"><div className="eyebrow intro-eyebrow"><span className="live-dot" /> GOBLIN ENGINEERING. ZERO OVERSIGHT.</div><h1 id="game-title">GOBLIN <span>RALLY</span><span className="title-period">.</span></h1><p>Big balls. Bad ideas. A very questionable use of physics.</p></div>
            <div className="intro-aside"><div className="safety-stamp"><ShieldCheck size={28} strokeWidth={1.2} /><span>SAFETY THIRD.<br /><strong>FUN FIRST.</strong></span></div><span className="build-label">EST. 2026 <span>/</span> GOBLIN APPROVED</span></div>
          </motion.section>

          <motion.div ref={shellRef} className={`game-shell ${theater ? 'theater-mode' : ''}`} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.65, delay: 0.1 }}>
            <div ref={stageRef} className={`game-stage status-${snapshot.status}`}>
              <canvas ref={canvasRef} className="game-canvas" tabIndex={0} aria-label="Four-lane Goblin Rally. Drag your orange ball to launch all four goblins. A and D change lanes and bump rivals. W to hop, Space to air bounce, Shift to boost, P to pause, R to restart.">Your browser needs HTML canvas support to play Goblin Rally.</canvas>
              <div className="game-hud">
                <button className="track-selector" onClick={showGarage} title="Choose a circuit"><span className="track-eyebrow"><FlagTriangleRight size={13} /> 4 GOBLINS / 15 KM DOWNHILL <span className="circuit-number">{course.number}</span></span><span className="track-name">{course.name}<ChevronDown size={16} /></span><span className="track-sector">{snapshot.sector}</span></button>
                <div className="telemetry" aria-label="Race statistics">
                  <div className="distance-stat"><span className="hud-label">DISTANCE</span><div><strong>{snapshot.distance ? number(snapshot.distance) : '000'}</strong><span>m</span></div></div>
                  <div className="speed-stat"><span className="hud-label"><Gauge size={12} /> SPEED</span><div><strong>{snapshot.speed}</strong><span>km/h</span></div></div>
                  <div className="position-stat"><span className="hud-label"><Trophy size={11} /> POSITION</span><div><strong>{snapshot.position}</strong><span>/ 4</span></div></div>
                </div>
                <div className="stage-actions"><button className="stage-button" onClick={togglePause} disabled={!playing && !paused} aria-label={paused ? 'Resume game' : 'Pause game'} title="Pause / resume (P)">{paused ? <Play size={16} /> : <Pause size={16} />}</button><button className="stage-button" onClick={() => retry()} disabled={!assets} aria-label="Restart run" title="Restart (R)"><RotateCcw size={16} /></button><button className="stage-button" onClick={() => void toggleFullscreen()} aria-label={fullscreen || theater ? 'Exit fullscreen' : 'Enter fullscreen'} title="Fullscreen (F)">{fullscreen || theater ? <Minimize2 size={16} /> : <Maximize2 size={16} />}</button></div>
              </div>
              <AnimatePresence>
                {gridNotes.length > 0 && (ready || resumeOnly) && <motion.div className="grid-recovery" role="status" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><Flag size={16} /><div><strong>Saved event restored</strong>{gridNotes.map((note) => <p key={note}>{note}</p>)}</div></motion.div>}
                {ready && <motion.div className="aim-hint" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ delay: 0.5, duration: 0.5 }}><span>YOUR BALL. THEIR PROBLEM.</span><p>Pull back the orange goblin. Launch the whole grid.</p><img className="aim-arrow" src="/art/aim-arrow.png" alt="" aria-hidden="true" draggable={false} /></motion.div>}
                {snapshot.notice && playing && <motion.div key={snapshot.notice} className="game-notice" role="status" initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8 }}>{snapshot.notice}</motion.div>}
              </AnimatePresence>
              <div className="race-progress" aria-label={`Race progress: ${Math.round(snapshot.progress * 100)} percent`}><span><Flag size={11} /> SUMMIT</span><div className="progress-track"><div className="progress-fill" style={{ width: `${snapshot.progress * 100}%` }} /><span className="progress-runner" style={{ left: `${snapshot.progress * 100}%` }} /></div><span className="finish-label">{number(TRACK_DISTANCE)} m <span className="checkered-flag" /></span></div>
              <AnimatePresence>
                {loadError && !assets && !resumeOnly && <motion.div className="game-loading" exit={{ opacity: 0 }}><GoblinMark /><span className="eyebrow orange-text">A SMALL ENGINEERING PROBLEM</span><h2>The goblins misplaced the art.</h2><button className="primary-button" onClick={() => setLoadingAttempt((attempt) => attempt + 1)}>TRY LOADING AGAIN <RotateCcw size={17} /></button></motion.div>}
                {!loadError && (!assets || (!loadingDismissed && !resumeOnly)) && (
                  <motion.div className="game-loading-cover" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} key="loading-cover">
                    <RaceLoadingScreen bindings={bindings} ready={Boolean(assets && snapshot.status === 'ready')} progress={loadingProgress} onEnter={() => { setLoadingDismissed(true); canvasRef.current?.focus({ preventScroll: true }); }} />
                  </motion.div>
                )}
                {paused && !modal && <motion.div className="game-overlay pause-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><span className="eyebrow orange-text">A MOMENT OF UNCHARACTERISTIC CAUTION</span><h2>CHAOS ON HOLD.</h2><p>Your goblin is enjoying the peace and quiet.</p><button className="primary-button" onClick={() => { engineRef.current?.togglePause(); canvasRef.current?.focus({ preventScroll: true }); }}><Play size={18} fill="currentColor" /> RESUME RACE</button><div className="pause-menu-actions"><button className="text-button" onClick={onSettings}><Settings2 size={16} /> SETTINGS</button><button className="text-button" onClick={onMainMenu}>MAIN MENU <ArrowUpRight size={16} /></button></div><span className="overlay-shortcut">OR PRESS <kbd>P</kbd></span></motion.div>}
                {snapshot.settling && playing && <motion.div className="finish-wait" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><Flag size={23} /><strong>You crossed the line.</strong><span>Rivals finishing: {snapshot.finishWait}s remaining</span></motion.div>}
                {result && (snapshot.status === 'finished' || resumeOnly) && <motion.div className="round-result-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><RoundResult result={result} session={session} onContinue={onContinue} onMenu={onMainMenu} onNewGame={onNewGame} /></motion.div>}
              </AnimatePresence>
            </div>
            <RaceControls
              snapshot={snapshot}
              loaded={Boolean(assets)}
              options={raceOptions}
              config={config}
              bindings={bindings}
              onTune={(key, value) => setOptions((previous) => ({ ...previous, [key]: value }))}
              onJump={() => { engineRef.current?.jump(); canvasRef.current?.focus({ preventScroll: true }); }}
              onBounce={() => { engineRef.current?.bounce(); canvasRef.current?.focus({ preventScroll: true }); }}
              onBoost={() => { engineRef.current?.boost(); canvasRef.current?.focus({ preventScroll: true }); }}
              onPrimary={mainAction}
              onLane={(direction) => { engineRef.current?.changeLane(direction); canvasRef.current?.focus({ preventScroll: true }); }}
            />
          </motion.div>
          <motion.div className="track-footnote" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}><p><span className="tip-label"><Sparkles size={13} /> GOBLIN WISDOM</span><span>TNT is a speed boost if you believe in yourself.</span></p><span className="footnote-right">NO BRAKES. NO REFUNDS.</span></motion.div>
          <footer className="site-footer"><div className="footer-brand"><Hammer size={14} /><span>GOBLIN ENGINEERING CO.</span><span className="footer-dot" /><span className="footer-disclaimer">Proudly unregulated.</span></div><button onClick={showConcept}>THE ART BEHIND THE CHAOS <ArrowUpRight size={14} /></button></footer>
        </main>

        <AnimatePresence>
          {modal === 'help' && <Modal key="help" title="A Crash Course. Literally." eyebrow="THE VERY OPTIONAL INSTRUCTION MANUAL" onClose={closeModal} className="fantasy-dialog">
            <div className="modal-tabs" role="tablist" aria-label="Instructions"><button role="tab" aria-selected={helpTab === 'basics'} className={helpTab === 'basics' ? 'selected' : ''} onClick={() => setHelpTab('basics')}>THE BASICS</button><button role="tab" aria-selected={helpTab === 'hazards'} className={helpTab === 'hazards' ? 'selected' : ''} onClick={() => setHelpTab('hazards')}>MEET THE BAD IDEAS</button></div>
            {helpTab === 'basics' ? <div className="help-basics"><p className="modal-lead">You are racing as {riderById(config.loadout.rider).name} in the {capsuleById(config.loadout.capsule).name}. Four loaded slingshots, four lanes, and 15 km to the stadium. Your orange goblin starts in lane 3.</p>
              <div className="instruction-row"><span className="instruction-number">01</span><MousePointer2 size={24} /><div><h3>Pull back. Let it rip.</h3><p>Drag the glowing ball left and down, then release. Or use arrow keys to adjust power and angle, then Enter to launch.</p></div><kbd>DRAG</kbd></div>
              <div className="instruction-row"><span className="instruction-number">02</span><ArrowRight size={25} /><div><h3>Pick a lane. Borrow theirs.</h3><p>A moves left, D moves right. Touch the steering arrows on a phone. Contact shoves rivals toward adjacent lanes; heavier capsules push harder. Steering locks briefly after a bump and during loops.</p></div><kbd>A / D</kbd></div>
              <div className="instruction-row"><span className="instruction-number">03</span><ArrowUpFromLine size={25} /><div><h3>A little hop. A big bad idea.</h3><p>Press W or J for a quick bunny hop from the ground. Gaps affect specific lanes, so steer around them or jump. A fall costs time, but the pit crew gets you racing again.</p></div><kbd>W</kbd></div>
              <div className="instruction-row"><span className="instruction-number">04</span><ArrowUpFromLine size={25} /><div><h3>Give gravity a day off.</h3><p>Space uses one of your three stronger midair bounces. Spring pads refill a charge. Each racer has their own charges; sheep and TNT are first-come, first-chaos.</p></div><kbd>SPACE</kbd></div>
              <div className="instruction-row"><span className="instruction-number">05</span><Zap size={25} /><div><h3>Less thinking. More throttle.</h3><p>Shift uses a boost. The CPU goblins use the same physics, seek boost pads, dodge gaps, and occasionally pick a fight. Live standings show your position and their gaps.</p></div><kbd>SHIFT</kbd></div>
              <div className="keyboard-reference"><span><kbd>R</kbd> Retry</span><span><kbd>{formatKey(bindings.pause[0] ?? 'KeyP')}</kbd> Pause</span><span><kbd>M</kbd> Sound</span><span><kbd>F</kbd> Fullscreen</span></div>
              <div className="controls-live-hint" style={{ marginTop: 10, padding: '10px 12px', background: '#0f1814', border: '1px solid #2e3827', borderRadius: 6, fontSize: 10, color: '#9aa68d' }}><strong style={{ color: '#f0a15b', fontSize: 9, letterSpacing: .6, display: 'block', marginBottom: 4 }}>YOUR CURRENT BINDINGS</strong> <span style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}><span><kbd>{(bindings.steerLeft ?? []).map(formatKey).join(' / ') || 'A'}</kbd> Left</span><span><kbd>{(bindings.steerRight ?? []).map(formatKey).join(' / ') || 'D'}</kbd> Right</span><span><kbd>{(bindings.hop ?? []).map(formatKey).join(' / ') || 'W'}</kbd> Hop</span><span><kbd>{(bindings.bounce ?? []).map(formatKey).join(' / ') || 'SPACE'}</kbd> Bounce</span><span><kbd>{(bindings.boost ?? []).map(formatKey).join(' / ') || 'SHIFT'}</kbd> Boost</span></span></div>
              <p className="touch-note">On a phone? Drag your orange ball, then use the lane arrows, Jump, Bounce, and Boost. Competitive loadouts stay fixed. Live physics sliders are available in custom Quick Race practice. Rebind everything in Settings → Controls.</p></div> : <div className="hazard-guide">{HAZARDS.map((hazard) => <div className="hazard-row" key={hazard.sprite}>{assets && <img src={assets[hazard.sprite].url} alt={hazard.name} />}<div><h3>{hazard.name}</h3><p>{hazard.description}</p></div></div>)}<div className="hazard-row">{assets && <img src={assets.loop.url} alt="Timber loop" />}<div><h3>Loop-de-loop, hold the logic</h3><p>Approach a loop with speed to ride the full circle and earn 350 chaos points. Ramps launch you across the gaps ahead.</p></div></div></div>}
            {helpTab === 'hazards' && <AirSupplyGuide />}
            <div className="modal-bottom"><span><ShieldCheck size={16} /> Safety briefing complete. Allegedly.</span><button className="primary-button" onClick={closeModal}>I FEEL QUALIFIED <Check size={17} /></button></div>
          </Modal>}

          {modal === 'workshop' && <Modal key="workshop" title="The Workshop" eyebrow="WHERE GOOD SENSE GOES TO DIE" onClose={closeModal} className="fantasy-dialog" wide>
            <div className="modal-tabs" role="tablist" aria-label="Workshop sections"><button role="tab" aria-selected={workshopTab === 'garage'} className={workshopTab === 'garage' ? 'selected' : ''} onClick={() => setWorkshopTab('garage')}><Settings2 size={15} /> THE GARAGE</button><button role="tab" aria-selected={workshopTab === 'concept'} className={workshopTab === 'concept' ? 'selected' : ''} onClick={() => setWorkshopTab('concept')}><ImageIcon size={15} /> CONCEPT ART</button><button role="tab" aria-selected={workshopTab === 'sprites'} className={workshopTab === 'sprites' ? 'selected' : ''} onClick={() => setWorkshopTab('sprites')}><Crosshair size={15} /> SPRITE LAB</button></div>
            {workshopTab === 'garage' && <div className="garage-content"><div className="section-label"><span>YOUR EVENT</span><span>{config.mode === 'tournament' ? `CUP ROUND ${config.round + 1} OF ${config.totalRounds}` : config.customPhysics ? 'CUSTOM PRACTICE' : 'QUICK RACE'}</span></div><div className="garage-event"><h3>{course.name}</h3><p>{riderById(config.loadout.rider).name} + {capsuleById(config.loadout.capsule).name}</p><button className="fantasy-secondary" onClick={() => { closeModal(); onNewGame(); }}>New event setup <ArrowUpRight size={15} /></button></div><div className="section-label settings-label"><span>FINE-TUNE THE FOOLISHNESS</span><Hammer size={14} /></div>
              <div className="setting-row graphics-setting">
                <div><h3><label htmlFor="graphics-mode">Graphics performance</label></h3><p>Auto adjusts resolution to keep the action moving. Performance uses fewer pixels and particles.</p></div>
                <select id="graphics-mode" className="graphics-select" value={options.graphics} onChange={(event) => {
                  const graphics = event.target.value;
                  if (graphics === 'auto' || graphics === 'performance' || graphics === 'quality') setOptions((previous) => ({ ...previous, graphics }));
                }}>
                  <option value="auto">Auto (recommended)</option>
                  <option value="performance">Performance</option>
                  <option value="quality">High detail</option>
                </select>
              </div>
              {([
                ['sound', 'Make some noise', 'Explosions, spring boings, and very opinionated sheep.'],
                ['screenShake', 'Shake things up', 'A little camera kick when the TNT does its thing.'],
                ['downrange', 'Look down the track', 'One camera for the launcher, rails, solid grandstands, and both audience rows.'],
                ['parallax', 'A little atmosphere', 'Gentle mountain drift. The crowds stay firmly attached to their terraces.'],
                ['aimAssist', 'A slightly sensible trajectory', 'Preview your launch arc before committing to the bit.'],
              ] as const).map(([key, label, description]) => <div className="setting-row" key={key}><div><h3>{label}</h3><p>{description}</p></div><button className={`toggle ${options[key] ? 'on' : ''}`} role="switch" aria-checked={options[key]} aria-label={label} onClick={() => setOptions((previous) => ({ ...previous, [key]: !previous[key] }))}><span /></button></div>)}
              <div className="setting-row">
                <div><h3><label htmlFor="race-camera-mode">Ball camera</label></h3><p>Follow ball chases your capsule so it stays framed. Fixed course holds the classic wide view; an edge arrow points when the ball leaves the screen.</p></div>
                <select id="race-camera-mode" className="graphics-select" value={options.cameraMode} onChange={(event) => {
                  const cameraMode = event.target.value;
                  if (cameraMode === 'follow_ball' || cameraMode === 'fixed') setOptions((previous) => ({ ...previous, cameraMode }));
                }}>
                  <option value="follow_ball">Follow ball</option>
                  <option value="fixed">Fixed course</option>
                </select>
              </div>
              <p className="settings-note">Display settings never reset a race. Your course and crew stay fixed for this event.</p></div>}
            {workshopTab === 'concept' && <div className="concept-content"><p className="modal-lead">First came the concept. Then came the questionable engineering. This original painting set the mood for every mountain, machine, and goblin in the game.</p><figure className="concept-figure"><img src="/art/goblin-rally-concept.png" alt="Original Goblin Rally concept art: a goblin-piloted iron capsule in a giant slingshot, wooden loops, explosive crates, sheep, and cheering crowds in a misty mountain arena." /><figcaption><span>01 / THE ORIGINAL BAD IDEA</span><span>ART DIRECTION & WORLD CONCEPT</span></figcaption></figure><div className="modal-bottom"><span>Painted fantasy. Built for a little chaos.</span><button className="outline-button" onClick={() => saveSource('/art/goblin-rally-concept.png', 'goblin-rally-concept.png')}>DOWNLOAD CONCEPT <ArrowDownToLine size={16} /></button></div></div>}
            {workshopTab === 'sprites' && <div className="sprite-content"><ArtGallery /></div>}
          </Modal>}

          {modal === 'records' && <Modal key="records" title="The Hall of Chaos" eyebrow="LEGENDS ARE MEASURED IN METERS" onClose={closeModal} className="fantasy-dialog">
            {records.length === 0 ? <div className="empty-records"><Trophy size={55} strokeWidth={1.1} /><h3>YOUR LEGEND STARTS HERE.</h3><p>No runs. No regrets. Yet.<br />Launch a goblin and give the crowd something to talk about.</p><button className="primary-button" onClick={() => { closeModal(); retry(true); canvasRef.current?.focus({ preventScroll: true }); }}>MAKE A BAD IDEA HISTORY <ArrowUpRight size={19} /></button></div> : <><div className="records-summary"><Trophy size={29} /><div><span>YOUR PERSONAL BEST</span><strong>{number(best)} <small>m</small></strong></div><p>Locally legendary.<br />Saved on this device.</p></div><div className="records-table-wrap"><table className="records-table"><thead><tr><th>RANK</th><th>THE BAD IDEA</th><th>DISTANCE</th><th>CHAOS</th></tr></thead><tbody>{records.map((record, index) => <tr key={record.id}><td><span className={index === 0 ? 'rank rank-first' : 'rank'}>{String(index + 1).padStart(2, '0')}</span></td><td><strong>{COURSES.find((item) => item.id === record.course)?.name ?? 'Rustbucket Ridge'} {record.completed && <Flag size={11} />}</strong><small>{new Date(record.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} / {record.topSpeed} km/h</small></td><td>{number(record.distance)} <span>m</span></td><td>{number(record.score)}</td></tr>)}</tbody></table></div><div className="modal-bottom records-bottom"><button className="clear-records" onClick={() => { if (clearConfirm) { setRecords([]); setClearConfirm(false); } else setClearConfirm(true); }}>{clearConfirm ? 'YES, WIPE THE EVIDENCE' : 'Clear local records'}</button>{clearConfirm ? <button className="text-button" onClick={() => setClearConfirm(false)}>KEEP MY SHAME <X size={15} /></button> : <button className="primary-button" onClick={() => { closeModal(); retry(true); canvasRef.current?.focus({ preventScroll: true }); }}>BEAT THAT <ArrowRight size={17} /></button>}</div></>}
          </Modal>}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}