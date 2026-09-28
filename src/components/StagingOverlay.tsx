/**
 * T06 — staging overlay: the visual presentation of qualifying results and the
 * countdown to race start.
 *
 * This component is presentation-only: it reads from the staging state machine
 * and the qualifying results, and renders the overlay. It never mutates the
 * authoritative game state.
 *
 * Accessibility:
 * - Reduced-motion: static staging, no orbit animation, instant countdown.
 * - Keyboard focus: the overlay is keyboard-ready with tabIndex and role attributes.
 * - The countdown label is announced via aria-live.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, MotionConfig } from 'framer-motion';
import { Flag, Timer, Trophy, Users, Zap } from 'lucide-react';
import type { RankedQualifyingEntry } from '../game/contracts/qualifying';
import type { FrozenGrid } from '../game/release/grid';
import {
  buildStagingPresentation, formatDisplaySpeed, formatQualifyingTime,
  focusedBands,
} from '../game/staging/presentation';
import {
  countdownLabel,
  type StagingState,
} from '../game/staging/lifecycle';

interface StagingOverlayProps {
  readonly staging: StagingState;
  readonly entries: readonly RankedQualifyingEntry[];
  readonly grid: FrozenGrid | null;
  readonly humanRacerId: number;
  readonly names: Readonly<Record<number, string>>;
  readonly colors: Readonly<Record<number, string>>;
  readonly reducedMotion: boolean;
  readonly visible: boolean;
  readonly onReady: () => void;
  readonly onDismiss: () => void;
}

export default function StagingOverlay({
  staging, entries, grid, humanRacerId, names, colors,
  reducedMotion, visible, onReady, onDismiss,
}: StagingOverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  const presentation = useMemo(
    () => buildStagingPresentation(entries, grid, { humanRacerId, names }),
    [entries, grid, humanRacerId, names],
  );

  const label = countdownLabel(staging.countdownSeconds);

  // Focus the overlay when it becomes visible so keyboard events are captured.
  useEffect(() => {
    if (visible && overlayRef.current) {
      overlayRef.current.focus({ preventScroll: true });
    }
  }, [visible]);

  // Keyboard handler: Enter/Space to proceed, Escape to dismiss.
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (staging.phase === 'results') onReady();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      onDismiss();
    }
    if (e.key === 'Tab') {
      setShowLeaderboard((v) => !v);
    }
  }, [staging.phase, onReady, onDismiss]);

  if (!visible) return null;

  const motionConfig = reducedMotion ? { reducedMotion: 'always' as const } : {};

  return (
    <MotionConfig {...motionConfig}>
      <div
        ref={overlayRef}
        className="staging-overlay"
        role="dialog"
        aria-label="Race staging"
        aria-modal="true"
        tabIndex={0}
        onKeyDown={handleKeyDown}
      >
        {/* Orbit bands background */}
        <div className="staging-orbits" aria-hidden="true">
          {focusedBands(presentation, humanRacerId, 20).map((band) => (
            <div
              key={band.racerId}
              className={`orbit-band orbit-${band.highlight}`}
              style={{
                opacity: band.opacity,
                '--lane': band.lane,
                '--wave': band.wave,
              } as React.CSSProperties}
            >
              <span className="orbit-label" style={{ color: colors[band.racerId] ?? '#fff' }}>
                {band.name}
              </span>
            </div>
          ))}
        </div>

        {/* Main content */}
        <div className="staging-content">
          {staging.phase === 'qualifying' && (
            <div className="staging-qualifying">
              <Timer size={32} />
              <h2>QUALIFYING IN PROGRESS</h2>
              <p>{entries.filter((e) => e.status === 'valid').length} of {entries.length} racers have crossed the gate.</p>
            </div>
          )}

          {staging.phase === 'results' && (
            <div className="staging-results">
              <Trophy size={28} />
              <h2>QUALIFYING COMPLETE</h2>
              <p>{entries.length} racers ranked. {entries.filter((e) => e.status === 'valid').length} valid crossings.</p>
              <div className="staging-results-top3">
                {presentation.leaderboard.slice(0, 3).map((row) => (
                  <div key={row.racerId} className={`result-card result-${row.highlight}`}>
                    <span className="result-rank">#{row.rank}</span>
                    <span className="result-name" style={{ color: colors[row.racerId] ?? '#fff' }}>
                      {row.name}
                    </span>
                    <span className="result-time">{formatQualifyingTime(row.time)}</span>
                    <span className="result-speed">{formatDisplaySpeed(row.speed)} km/h</span>
                  </div>
                ))}
              </div>
              <button
                className="primary-button staging-ready-btn"
                onClick={onReady}
                autoFocus
              >
                <Flag size={18} /> TO THE GRID
              </button>
              <button
                className="fantasy-secondary staging-leaderboard-btn"
                onClick={() => setShowLeaderboard((v) => !v)}
              >
                <Users size={16} /> {showLeaderboard ? 'HIDE' : 'FULL'} LEADERBOARD ({presentation.totalRacers})
              </button>
            </div>
          )}

          {staging.phase === 'staging' && (
            <div className="staging-grid">
              <h2>ON THE GRID</h2>
              <p>{presentation.totalRacers} racers staged in {grid?.waves ?? '?'} waves.</p>
              {staging.humanRetrying && (
                <div className="staging-retry-notice" role="alert">
                  <Zap size={16} /> Re-aiming — bots keep running. Press ENTER to launch.
                </div>
              )}
            </div>
          )}

          {staging.phase === 'countdown' && (
            <div className="staging-countdown" aria-live="assertive">
              <motion.div
                key={label}
                className="countdown-number"
                initial={reducedMotion ? {} : { scale: 1.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: reducedMotion ? 0 : 0.3 }}
              >
                {label}
              </motion.div>
            </div>
          )}

          {staging.phase === 'paused' && (
            <div className="staging-paused">
              <h2>PAUSED</h2>
              <p>Staging is paused. Resume to continue.</p>
            </div>
          )}
        </div>

        {/* Leaderboard panel */}
        <AnimatePresence>
          {showLeaderboard && (staging.phase === 'results' || staging.phase === 'staging') && (
            <motion.div
              className="staging-leaderboard"
              initial={{ x: 300, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 300, opacity: 0 }}
              transition={{ duration: reducedMotion ? 0 : 0.2 }}
            >
              <h3>LEADERBOARD ({presentation.visibleRacers}/{presentation.totalRacers})</h3>
              <table className="staging-lb-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Racer</th>
                    <th>Time</th>
                    <th>Speed</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {presentation.leaderboard.map((row) => (
                    <tr key={row.racerId} className={`lb-row lb-${row.highlight}`}>
                      <td className="lb-rank">{row.rank}</td>
                      <td className="lb-name" style={{ color: colors[row.racerId] ?? '#fff' }}>
                        {row.name}
                        {row.racerId === humanRacerId && <span className="lb-you">YOU</span>}
                      </td>
                      <td className="lb-time">{formatQualifyingTime(row.time)}</td>
                      <td className="lb-speed">{formatDisplaySpeed(row.speed)}</td>
                      <td className="lb-status">
                        {row.status === 'valid' ? (
                          <span className="lb-valid">✓</span>
                        ) : (
                          <span className="lb-fallback">{row.fallback ?? 'DNF'}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {presentation.totalRacers > presentation.visibleRacers && (
                <p className="lb-truncated">
                  Showing {presentation.visibleRacers} of {presentation.totalRacers} rows.
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}
