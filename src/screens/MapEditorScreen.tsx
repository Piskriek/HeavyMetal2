import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RotateCcw } from 'lucide-react';
import { GameEngine } from '../game/engine';
import { loadAssets, type GameAssets } from '../game/assets';
import { preloadRaceAssets } from '../game/preloader';
import { prepareRaceBalls, prepareRosterArt } from '../game/loadout-art';
import { preparePowerupSprites } from '../game/powerups';
import { loadArtImage, riderCell } from '../game/art-assets';
import { DEFAULT_SETUP, createSession, sessionConfig, type RaceConfig } from '../game/session';
import { INITIAL_SNAPSHOT, type CourseId, type GameOptions, type GameSnapshot, type RunRecord } from '../game/types';
import TrackBuilderUI from '../components/TrackBuilderUI';
import MergePoolOverlay from '../components/MergePoolOverlay';
import CockpitHud from '../components/CockpitHud';
import TestDriveBar from '../components/TestDriveBar';
import { createCockpitState, type CockpitState } from '../game/cockpit';

interface MapEditorScreenProps {
  options: GameOptions;
  onMainMenu: () => void;
}

export default function MapEditorScreen({ options, onMainMenu }: MapEditorScreenProps) {
  const [course, setCourse] = useState<CourseId>('ridge');
  const [assets, setAssets] = useState<GameAssets | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [isTesting, setIsTesting] = useState(false);
  // Test-drive view and slow motion. Changed live on the engine: switching must not rebuild the race.
  const [cameraMode, setCameraMode] = useState<GameOptions['cameraMode']>('follow_ball');
  const [timeScale, setTimeScale] = useState(1);
  const cockpitState = useRef<CockpitState>(createCockpitState());
  const cameraModeRef = useRef(cameraMode); cameraModeRef.current = cameraMode;
  const timeScaleRef = useRef(timeScale); timeScaleRef.current = timeScale;
  const readCockpit = useCallback((state: CockpitState) => { engineRef.current?.getCockpitState(state); }, []);
  const [engine, setEngine] = useState<GameEngine | null>(null);
  const [snapshot, setSnapshot] = useState<GameSnapshot>(INITIAL_SNAPSHOT);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GameEngine | null>(null);

  const config = useMemo<RaceConfig>(() => {
    const session = createSession({ ...DEFAULT_SETUP, course, customPhysics: true });
    return sessionConfig(session);
  }, [course]);

  const roster = config.roster;

  // Load assets
  useEffect(() => {
    let active = true;
    preloadRaceAssets(course, roster, (percent) => {
      setLoadingProgress(percent);
    })
      .then(() => Promise.all([
        loadAssets(),
        prepareRaceBalls(roster),
        preparePowerupSprites(),
        prepareRosterArt(roster),
        loadArtImage(riderCell(config.loadout.rider).pilot ?? riderCell(config.loadout.rider).image).catch(() => null),
      ]))
      .then(([loaded, raceBalls, pickupSprites, _art, playerBadge]) => {
        if (!active) return;
        setAssets({ ...loaded, raceBalls, pickupSprites, playerBadge: playerBadge ?? undefined });
        setLoadingProgress(100);
      })
      .catch((err) => {
        console.error('Failed to load map editor assets:', err);
      });

    return () => { active = false; };
  }, [course, roster, config]);

  // Remove any lingering debug panel from a previous RaceScreen session
  useEffect(() => {
    const stalePanel = document.getElementById('hm2-debug-panel');
    if (stalePanel) stalePanel.remove();
  }, []);

  // Create GameEngine
  useEffect(() => {
    if (!assets || !canvasRef.current || !stageRef.current) return;

    const handleFinish = (_record: RunRecord) => {};
    const createdEngine = new GameEngine(
      canvasRef.current,
      assets,
      { ...options, course, cameraMode: 'follow_ball' },
      (snap) => setSnapshot({ ...snap }),
      handleFinish,
      config,
    );
    engineRef.current = createdEngine;
    setEngine(createdEngine);
    createdEngine.setTimeScale(timeScaleRef.current);

    // Solo test mode: only the player marble
    createdEngine.setSoloMode(true);
    createdEngine.reset(); // Re-create racers with solo mode active

    // Start in builder mode: paused race, free-fly active
    createdEngine.setBuildPaused(true);
    createdEngine.trackBuilder.freeFly.active = true;

    const resize = () => {
      const rect = stageRef.current?.getBoundingClientRect();
      if (rect && rect.height > 0 && rect.width > 0) createdEngine.resize(rect.width, rect.height);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(stageRef.current);

    return () => {
      observer.disconnect();
      createdEngine.destroy();
      engineRef.current = null;
      setEngine(null);
    };
  }, [assets, course, config, options]);

  const changeCamera = useCallback((mode: GameOptions['cameraMode']) => {
    setCameraMode(mode);
    engineRef.current?.setCameraMode(mode);
  }, []);
  const changeTimeScale = useCallback((scale: number) => {
    engineRef.current?.setTimeScale(scale);
    setTimeScale(engineRef.current?.getTimeScale() ?? scale);
  }, []);

  // Toggle between testing and editing
  const startTesting = () => {
    setIsTesting(true);
    if (engineRef.current) {
      engineRef.current.trackBuilder.selectProp(null);
      engineRef.current.setBuildPaused(false);
      engineRef.current.setCameraMode(cameraModeRef.current);
      engineRef.current.trackBuilder.freeFly.active = false;
      engineRef.current.inputEnabled = true;
      engineRef.current.reset(); // Reset to 'ready' state so user can launch
      (document.activeElement as HTMLElement)?.blur();
      canvasRef.current?.focus({ preventScroll: true });
    }
  };

  const returnToEditor = () => {
    setIsTesting(false);
    if (engineRef.current) {
      engineRef.current.setBuildPaused(true);
      engineRef.current.setCameraMode('follow_ball');
      engineRef.current.trackBuilder.freeFly.active = true;
      engineRef.current.inputEnabled = false;
    }
  };

  // Keyboard shortcut: B toggles test mode in editor, Space/Enter to launch/ready, WASD for lane changes
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;
      const eng = engineRef.current;
      if (!eng) return;

      if (e.key === 'b' || e.key === 'B') {
        e.preventDefault();
        if (isTesting) {
          returnToEditor();
        } else {
          startTesting();
        }
        return;
      }

      if (isTesting) {
        // Space or Enter: launch on grid, ready up in loop merge pool, or air-bounce while flying
        if (e.key === ' ' || e.code === 'Space' || e.key === 'Enter') {
          if (eng.inMerge) {
            e.preventDefault();
            eng.ready();
            return;
          }
          if (eng.status === 'ready') {
            e.preventDefault();
            eng.start();
            return;
          }
          if (eng.status === 'flying' && (e.key === ' ' || e.code === 'Space')) {
            e.preventDefault();
            eng.bounce();
            return;
          }
        }

        // Shift: turbo boost
        if (e.key === 'Shift' && eng.status === 'flying') {
          e.preventDefault();
          eng.boost();
          return;
        }

        // R: restart test run
        if (e.key === 'r' || e.key === 'R') {
          e.preventDefault();
          eng.reset();
          return;
        }

        // WASD / Arrow keys: lane changes during testing
        if (eng.status === 'flying') {
          if (e.key === 'w' || e.key === 'W' || e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') {
            e.preventDefault();
            eng.changeLane(-1);
          } else if (e.key === 's' || e.key === 'S' || e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') {
            e.preventDefault();
            eng.changeLane(1);
          }
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isTesting]);

  // M01 · T2: the pool owns these two statuses, so the builder hides its own chrome while it is up.
  const isPooled = snapshot.status === 'checkpoint' || snapshot.status === 'countdown';

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black select-none">
      {/* 3D Canvas Stage */}
      <div ref={stageRef} className="absolute inset-0 w-full h-full pointer-events-none">
        <canvas ref={canvasRef} className="w-full h-full block focus:outline-none pointer-events-auto" tabIndex={0} />
      </div>

      {/* Loading Cover */}
      {!assets && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-zinc-950 text-amber-200">
          <h2 className="text-xl font-bold tracking-widest text-amber-400 mb-3">LOADING 3D TRACK EDITOR...</h2>
          <div className="w-64 h-2.5 bg-zinc-800 rounded-full overflow-hidden border border-amber-500/40">
            <div
              className="h-full bg-gradient-to-r from-amber-600 to-amber-400 transition-all duration-300"
              style={{ width: `${Math.max(8, loadingProgress)}%` }}
            />
          </div>
        </div>
      )}

      {/* Editor UI when editing */}
      {assets && !isTesting && engine && canvasRef.current && (
        <TrackBuilderUI
          builder={engine.trackBuilder}
          canvas={canvasRef.current}
          onClose={onMainMenu}
          onTestRace={startTesting}
          onRequestRender={() => engine.requestRender()}
          course={course}
          onCourseChange={setCourse}
        />
      )}

      {/* Cockpit view while test-driving (the builder itself always uses the free-fly camera) */}
      {assets && isTesting && cameraMode === 'first_person' && (
        <CockpitHud
          state={cockpitState.current}
          readState={readCockpit}
          reducedMotion={options.reducedMotion}
          active
        />
      )}

      {assets && isTesting && (
        <TestDriveBar cameraMode={cameraMode} onCameraMode={changeCamera} timeScale={timeScale} onTimeScale={changeTimeScale} />
      )}

      {/* Testing HUD overlay when test racing */}
      {assets && isTesting && !isPooled && (
        <div className={`absolute ${cameraMode === 'first_person' ? 'top-14' : 'top-4'} left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2`}>
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 bg-zinc-950/90 border border-emerald-500/60 px-5 py-2 rounded-xl shadow-2xl backdrop-blur-md"
          >
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              TEST DRIVE ACTIVE (Solo)
            </div>

            <span className="text-zinc-500">|</span>

            <button
              onClick={() => engineRef.current?.reset()}
              className="flex items-center gap-1 px-3 py-1 text-xs bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded border border-zinc-700/60 cursor-pointer"
              title="Restart Test Run (R)"
            >
              <RotateCcw size={13} /> Reset [R]
            </button>

            <button
              onClick={returnToEditor}
              className="flex items-center gap-1.5 px-3 py-1 text-xs font-bold bg-amber-600 hover:bg-amber-500 text-black rounded shadow transition-all cursor-pointer"
              title="Return to 3D Track Builder"
            >
              RETURN TO BUILDER [B]
            </button>
          </motion.div>
          <div className="bg-zinc-950/85 border border-amber-500/30 text-amber-200/90 text-xs px-3.5 py-1.5 rounded-lg shadow-lg flex items-center gap-2 backdrop-blur-sm">
            <span className="font-bold text-amber-400">⏱ NOTE:</span>
            <span>First split time is taken alone (rivals join after split).</span>
            <span className="text-zinc-500">|</span>
            <span className="text-zinc-300"><kbd className="bg-zinc-800 px-1 rounded text-white font-mono">SPACE</kbd> {snapshot.status === 'ready' ? 'Start Run' : 'Air Bounce'}</span>
          </div>
        </div>
      )}

      {/* M01 · T2: the first-loop pool while a builder test run reaches the loop. */}
      <AnimatePresence>
        {isTesting && isPooled && snapshot.merge && (
          <MergePoolOverlay
            merge={snapshot.merge}
            loadout={config.loadout}
            reducedMotion={options.reducedMotion}
            onReady={() => engineRef.current?.ready()}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
