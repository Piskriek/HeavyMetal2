// ============================================================================
// File: apps/web/src/credits/credits-hud.tsx
// Brief: TASK-33 (Real-Time In-Engine Credits Music Video HUD)
// Layout: Non-overlapping Left Telemetry/Lyrics + Right 360px Credits Roll
// ============================================================================

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  buildCreditsRollManifest,
  getCreditsStateAt,
  DEFAULT_OUTRO_META,
  type MusicOutroMeta,
} from './timeline';

export interface CreditsHudProps {
  elapsedSec: number;
  operatorName?: string;
  outroMeta?: MusicOutroMeta;
  isOverclockedMode?: boolean;
  onExitCredits: () => void;
  onReplayCredits: () => void;
}

export const CreditsHud: React.FC<CreditsHudProps> = ({
  elapsedSec,
  operatorName = 'Operator Astro',
  outroMeta = DEFAULT_OUTRO_META,
  isOverclockedMode = false,
  onExitCredits,
  onReplayCredits,
}) => {
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

  const eqHeights = [
    Math.round(25 + state.beatPulse * 75),
    Math.round(20 + ((state.beatInBar % 2) * 45 + state.beatPulse * 35)),
    Math.round(30 + ((state.beatInBar === 3 ? 65 : 20) + state.beatPulse * 25)),
    Math.round(25 + ((state.beatInBar === 4 ? 70 : 15) + state.beatPulse * 30)),
  ];

  return (
    <div
      data-hud-root
      data-fidelity={state.chapter.hudSkin}
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
            <div style={{ width: 6, height: `${eqHeights[0]}%`, background: '#ff3d8a' }} />
            <div style={{ width: 6, height: `${eqHeights[1]}%`, background: '#7cff4d' }} />
            <div style={{ width: 6, height: `${eqHeights[2]}%`, background: '#ffc13d' }} />
            <div style={{ width: 6, height: `${eqHeights[3]}%`, background: '#3dc8ff' }} />
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
            style={{ padding: '4px 10px', fontSize: 12, cursor: 'pointer' }}
          >
            [Replay Video]
          </button>
          <button
            type="button"
            onClick={onExitCredits}
            className="hud-card"
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
