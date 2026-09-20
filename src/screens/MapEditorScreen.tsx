import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { RotateCcw } from 'lucide-react';
import { GameEngine } from '../game/engine';
import { loadAssets, type GameAssets } from '../game/assets';
import { preloadRaceAssets } from '../game/preloader';
import { prepareRaceBalls, prepareRosterArt } from '../game/loadout-art';
import { preparePowerupSprites } from '../game/powerups';
import { loadArtImage, riderCell } from '../game/art-assets';
import { DEFAULT_SETUP, createSession, sessionConfig, type RaceConfig } from '../game/session';
import type { CourseId, GameOptions, RunRecord } from '../game/types';
import TrackBuilderUI from '../components/TrackBuilderUI';

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

  // Create GameEngine
  useEffect(() => {
    if (!assets || !canvasRef.current || !stageRef.current) return;

    const handleFinish = (_record: RunRecord) => {};
    const createdEngine = new GameEngine(
      canvasRef.current,
      assets,
      { ...options, course },
      () => {},
      handleFinish,
      config,
    );
    engineRef.current = createdEngine;
    setEngine(createdEngine);

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

  // Keyboard shortcut: B toggles test mode in editor
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;
      if (e.key === 'b' || e.key === 'B') {
        e.preventDefault();
        if (isTesting) {
          returnToEditor();
        } else {
          startTesting();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isTesting]);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black select-none">
      {/* 3D Canvas Stage */}
      <div ref={stageRef} className="absolute inset-0 w-full h-full">
        <canvas ref={canvasRef} className="w-full h-full block focus:outline-none" tabIndex={0} />
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
      {assets && isTesting && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-zinc-950/90 border border-emerald-500/60 px-5 py-2 rounded-xl shadow-2xl backdrop-blur-md"
        >
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            TEST DRIVE ACTIVE
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
    </div>
  );
}
