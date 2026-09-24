import { useEffect, useMemo, useRef, useState } from 'react';
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

interface MapEditorScreenProps {
  options: GameOptions;
  onMainMenu: () => void;
}

export default function MapEditorScreen({ options, onMainMenu }: MapEditorScreenProps) {
  const [course, setCourse] = useState<CourseId>('ridge');
  const [assets, setAssets] = useState<GameAssets | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [isTesting, setIsTesting] = useState(false);
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

  // Toggle between testing and editing
  const startTesting = () => {
    setIsTesting(true);
    if (engineRef.current) {
      engineRef.current.trackBuilder.selectProp(null);
      engineRef.current.setBuildPaused(false);
      engineRef.current.trackBuilder.freeFly.active = false;
      engineRef.current.inputEnabled = true;
      engineRef.current.reset(); // Reset to 'ready' state so user can launch
      canvasRef.current?.focus({ preventScroll: true });
    }
  };

  const returnToEditor = () => {
    setIsTesting(false);
    if (engineRef.current) {
      engineRef.current.setBuildPaused(true);
      engineRef.current.trackBuilder.freeFly.active = true;
      engineRef.current.inputEnabled = false;
    }
  };

  // Keyboard shortcut: B toggles test mode in editor, WASD for lane changes
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

      // M01 · T2: in a test run that has reached the first loop, Space or Enter readies the player —
      // the pool is the only thing on screen then, and it refuses anything else.
      if (eng.inMerge && (e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault();
        eng.ready();
        return;
      }

      // WASD lane changes during testing
      if (isTesting && eng.status === 'flying') {
        if (e.key === 'w' || e.key === 'W' || e.key === 'a' || e.key === 'A') {
          e.preventDefault();
          eng.changeLane(-1);
        } else if (e.key === 's' || e.key === 'S' || e.key === 'd' || e.key === 'D') {
          e.preventDefault();
          eng.changeLane(1);
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

      {/* Testing HUD overlay when test racing */}
      {assets && isTesting && !isPooled && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-zinc-950/90 border border-emerald-500/60 px-5 py-2 rounded-xl shadow-2xl backdrop-blur-md"
        >
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            TEST DRIVE ACTIVE (Solo)
          </div>

          <span className="text-zinc-500">|</span>

          <button
            onClick={() => engineRef.current?.reset()}
            className="flex items-center gap-1 px-3 py-1 text-xs bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded border border-zinc-700/60 cursor-pointer"
            title="Restart Test Run"
          >
            <RotateCcw size={13} /> Reset
          </button>

          <button
            onClick={returnToEditor}
            className="flex items-center gap-1.5 px-3 py-1 text-xs font-bold bg-amber-600 hover:bg-amber-500 text-black rounded shadow transition-all cursor-pointer"
            title="Return to 3D Track Builder"
          >
            RETURN TO BUILDER [B]
          </button>
        </motion.div>
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
