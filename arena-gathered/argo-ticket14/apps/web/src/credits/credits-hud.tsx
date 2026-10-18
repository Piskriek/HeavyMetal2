// ============================================================================
// File: apps/web/src/credits/credits-hud.tsx
// Brief: TASK-33 / TICKET-14 (Real-Time In-Engine Credits Music Video HUD
// & Lab `old-monitor` Jukebox Replay Modal)
// Layout: Non-overlapping Left Telemetry/Lyrics + Right 356px Credits Roll
// ============================================================================

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  buildCreditsRollManifest,
  getCreditsStateAt,
  DEFAULT_OUTRO_META,
  type MusicOutroMeta,
} from './timeline';
import {
  MONITOR_EQ_COLOURS,
  OLD_MONITOR_ACTIONS,
  monitorEqualizerHeights,
} from './monitor-jukebox';
import { injectRetroPixelFontStyles } from './pixel-font-ofl';

export interface CreditsHudProps {
  readonly elapsedSec: number;
  readonly operatorName?: string;
  readonly outroMeta?: MusicOutroMeta;
  readonly isOverclockedMode?: boolean;
  readonly onExitCredits: () => void;
  readonly onReplayCredits: () => void;
}

export const CreditsHud: React.FC<CreditsHudProps> = ({
  elapsedSec,
  operatorName = 'Operator Astro',
  outroMeta = DEFAULT_OUTRO_META,
  isOverclockedMode = false,
  onExitCredits,
  onReplayCredits,
}) => {
  useEffect(() => {
    injectRetroPixelFontStyles();
  }, []);

  const state = useMemo(() => getCreditsStateAt(elapsedSec, outroMeta), [elapsedSec, outroMeta]);
  const manifest = useMemo(() => buildCreditsRollManifest(operatorName), [operatorName]);

  const [pausedRoll, setPausedRoll] = useState(false);
  const [manualScrollOffset, setManualScrollOffset] = useState(0);
  const [skinShiftFlash, setSkinShiftFlash] = useState(false);
  const prevSkinRef = useRef(state.chapter.hudSkin);

  // Trigger 120ms scanline glitch flash whenever the chapter HUD skin upgrades
  useEffect(() => {
    if (prevSkinRef.current !== state.chapter.hudSkin) {
      prevSkinRef.current = state.chapter.hudSkin;
      setSkinShiftFlash(true);
      const timer = window.setTimeout(() => setSkinShiftFlash(false), 130);
      return () => window.clearTimeout(timer);
    }
  }, [state.chapter.hudSkin]);

  // Spacebar toggles credits roll pause; Escape exits to sandbox
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        setPausedRoll((p) => !p);
      } else if (e.code === 'Escape') {
        e.preventDefault();
        onExitCredits();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onExitCredits]);

  const rollOffsetPx = (pausedRoll ? 0 : state.elapsedSec * 28) + manualScrollOffset;
  const eqBars = monitorEqualizerHeights(state.elapsedSec, isOverclockedMode ? 172.8 : 144);

  return (
    <div
      data-hud-root
      data-fidelity={state.chapter.hudSkin}
      data-testid="credits-hud-root"
      className={skinShiftFlash ? 'hud-fidelity-shift' : ''}
      onWheel={(e) => setManualScrollOffset((prev) => Math.max(0, prev + e.deltaY * 0.5))}
      style={{ position: 'fixed', inset: 0, pointerEvents: 'auto', overflow: 'hidden', zIndex: 40 }}
    >
      {/* 1. Top-Left Stage Telemetry & 144 BPM 4-Float Equalizer */}
      <div
        data-credits-zone="telemetry"
        className="hud-card"
        style={{
          position: 'absolute',
          top: 24,
          left: 24,
          padding: '10px 16px',
          minWidth: 320,
          maxWidth: 440,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--hud-text-dim)' }}>
              {isOverclockedMode ? 'FOUR FLOATS (OVERCLOCKED // 1.2x PITCH)' : 'FOUR FLOATS (v4b // 144 BPM)'}
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--hud-font-display)', marginTop: 2 }}>
              {state.chapter.stageBadge}
            </div>
          </div>
          {/* 4-Float Chiptune Spectrum Bars (Pxd, Vtx, Lx, Aq) */}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 28 }}>
            {eqBars.map((h, idx) => (
              <div
                key={MONITOR_EQ_COLOURS[idx]}
                style={{
                  width: 6,
                  height: `${Math.round(h * 100)}%`,
                  background: MONITOR_EQ_COLOURS[idx],
                }}
              />
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, fontSize: 11, marginTop: 8, color: 'var(--hud-text-dim)' }}>
          <span>Pxd {state.chapter.floats.Pxd.toFixed(2)}</span>
          <span>Vtx {state.chapter.floats.Vtx.toFixed(2)}</span>
          <span>Lx {state.chapter.floats.Lx.toFixed(2)}</span>
          <span>Aq {state.chapter.floats.Aq.toFixed(2)}</span>
          <span>BAR {state.barNumber}.{state.beatInBar}</span>
        </div>
      </div>

      {/* 2. Bottom-Left Stage-Skinned Lyric Caption Pill (Zero overlap with right roll) */}
      <div
        data-credits-zone="lyrics"
        className="hud-card"
        style={{
          position: 'absolute',
          bottom: 36,
          left: 36,
          width: 'min(560px, calc(100vw - 440px))',
          padding: '14px 20px',
          borderLeft: '4px solid var(--hud-accent)',
        }}
      >
        {state.activeLyric ? (
          <>
            <div style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.35, color: 'var(--hud-text)' }}>
              {state.activeLyric.line}
            </div>
            {state.activeLyric.nextLine && (
              <div style={{ fontSize: 13, marginTop: 6, color: 'var(--hud-text-dim)' }}>
                {state.activeLyric.nextLine}
              </div>
            )}
          </>
        ) : (
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--hud-accent)' }}>
            SECTOR 04 // CONSENSUS BRANCH ACTIVE — INSTRUMENTAL CHORUS LOOP
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
          <button
            type="button"
            onClick={onReplayCredits}
            className="hud-card"
            data-testid="credits-replay-btn"
            style={{ padding: '4px 10px', fontSize: 12, cursor: 'pointer' }}
          >
            [Replay Video]
          </button>
          <button
            type="button"
            onClick={onExitCredits}
            className="hud-card"
            data-testid="credits-exit-btn"
            style={{ padding: '4px 10px', fontSize: 12, cursor: 'pointer' }}
          >
            [Esc] Return to Sandbox
          </button>
        </div>
      </div>

      {/* 3. Right-Third Scrolling Credits Column */}
      <div
        data-credits-zone="roll"
        className="hud-card"
        style={{
          position: 'absolute',
          top: 24,
          right: 28,
          bottom: 24,
          width: 356,
          overflow: 'hidden',
          padding: '0 20px',
          maskImage: 'linear-gradient(to bottom, transparent 0%, black 10%, black 90%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 10%, black 90%, transparent 100%)',
        }}
      >
        <div
          style={{
            transform: `translateY(calc(75vh - ${rollOffsetPx}px))`,
            transition: 'transform 80ms linear',
            paddingBottom: 240,
          }}
        >
          {manifest.map((section) => (
            <div key={section.heading} style={{ marginBottom: 28 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  fontFamily: 'var(--hud-font-display)',
                  color: 'var(--hud-accent)',
                  borderBottom: '1px solid rgba(255,255,255,0.18)',
                  paddingBottom: 4,
                  marginBottom: 12,
                }}
              >
                {section.heading}
              </div>
              {section.entries.map((entry) => (
                <div key={`${entry.role}-${entry.name}`} style={{ marginBottom: 12 }}>
                  {entry.role && (
                    <div style={{ fontSize: 10, color: 'var(--hud-text-dim)', letterSpacing: '0.06em' }}>
                      {entry.role}
                    </div>
                  )}
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--hud-text)', marginTop: 1 }}>
                    {entry.name}
                  </div>
                  {entry.detail && (
                    <div style={{ fontSize: 11, color: 'var(--hud-text-dim)', marginTop: 1 }}>
                      {entry.detail}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
          <div style={{ textAlign: 'center', marginTop: 24, fontSize: 12, color: 'var(--hud-accent)' }}>
            S = (Pxd 1.00, Vtx 1.00, Lx 1.00, Aq 1.00)
            <br />
            &quot;IT&apos;S NOT REALLY DIRT, ENGINEER.&quot;
          </div>
        </div>
      </div>
    </div>
  );
};

export interface OldMonitorModalProps {
  readonly open: boolean;
  readonly overclockedPlaying: boolean;
  readonly elapsedSec?: number;
  readonly onPlayCredits: () => void;
  readonly onPlayOverclocked: () => void;
  readonly onClose: () => void;
}

/**
 * Lab `old-monitor` Jukebox modal for `play.tsx` offering:
 * - `[Play Ending Credits: "Four Floats" (v4b)]`
 * - `[Play "Four Floats (Overclocked)"]` with the 4-colour equaliser.
 */
export const OldMonitorJukeboxModal: React.FC<OldMonitorModalProps> = ({
  open,
  overclockedPlaying,
  elapsedSec = 0,
  onPlayCredits,
  onPlayOverclocked,
  onClose,
}) => {
  if (!open) return null;
  const eq = monitorEqualizerHeights(elapsedSec);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Archive Monitor Jukebox"
      data-testid="old-monitor-jukebox"
      className="hud-card"
      style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 420,
        padding: '20px 24px',
        zIndex: 45,
        background: 'rgba(10, 14, 22, 0.94)',
        border: '1px solid rgba(61, 200, 255, 0.35)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--hud-text-dim)' }}>LAB ARCHIVE TERMINAL // OLD-MONITOR</div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>SECTOR 04 AUDIO ARCHIVE</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 26 }}>
          {eq.map((h, i) => (
            <div
              key={MONITOR_EQ_COLOURS[i]}
              style={{
                width: 6,
                height: `${Math.round((overclockedPlaying ? h : 0.2) * 100)}%`,
                background: MONITOR_EQ_COLOURS[i],
              }}
            />
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {OLD_MONITOR_ACTIONS.map((act) => (
          <button
            key={act.id}
            type="button"
            data-testid={`monitor-action-${act.id}`}
            onClick={act.id === 'play-credits' ? onPlayCredits : onPlayOverclocked}
            className="hud-card"
            style={{ padding: '10px 14px', textAlign: 'left', cursor: 'pointer' }}
          >
            <div style={{ fontWeight: 700, fontSize: 13 }}>[{act.label}]</div>
            <div style={{ fontSize: 11, color: 'var(--hud-text-dim)', marginTop: 2 }}>{act.description}</div>
          </button>
        ))}
        <button
          type="button"
          data-testid="monitor-close-btn"
          onClick={onClose}
          className="hud-card"
          style={{ padding: '8px 14px', fontSize: 12, cursor: 'pointer', marginTop: 4 }}
        >
          [Esc] Close Terminal
        </button>
      </div>
    </div>
  );
};
