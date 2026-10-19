// ============================================================================
// File: apps/web/src/shell/haddy-crt-portrait.tsx
// POL-40 (TICKET-16): Dr. Gwen Haddy Glitching CRT Portrait Slot in Top-Left HUD
// - Loads `public/ui/haddy-portrait.webp` with an inline SVG silhouette fallback
// - Stage-reactive CRT scanlines, phosphor tint, and voice-active waveform bar
// ============================================================================

import React, { useState } from 'react';

export interface HaddyCrtPortraitProps {
  readonly activeLineId?: string | null;
  readonly subtitleText?: string | null;
  readonly isSpeaking?: boolean;
  readonly isWarningGlitch?: boolean;
  readonly stage?: number;
  readonly portraitUrl?: string;
  readonly className?: string;
  readonly style?: React.CSSProperties;
}

export const HaddyCrtPortrait: React.FC<HaddyCrtPortraitProps> = ({
  activeLineId = null,
  subtitleText = null,
  isSpeaking = false,
  isWarningGlitch = false,
  stage = 6,
  portraitUrl = 'ui/haddy-portrait.webp',
  className = '',
  style = {},
}) => {
  const [imgFailed, setImgFailed] = useState(false);

  const isLowStage = stage <= 1;
  const borderColor = isWarningGlitch
    ? '#ff3d8a'
    : isSpeaking
      ? '#3dc8ff'
      : '#ffc13d';

  const filterStyle = isLowStage
    ? 'grayscale(100%) contrast(155%) brightness(1.1)'
    : stage === 2
      ? 'sepia(35%) hue-rotate(155deg) saturate(160%) contrast(125%)'
      : isWarningGlitch
        ? 'hue-rotate(-25deg) saturate(140%) contrast(120%)'
        : 'none';

  return (
    <div
      className={`hud-haddy-crt-portrait${className ? ` ${className}` : ''}`}
      data-line-id={activeLineId ?? ''}
      data-speaking={isSpeaking ? 'true' : 'false'}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '6px 10px',
        background: 'rgba(6, 10, 18, 0.84)',
        border: `1px solid ${borderColor}`,
        borderLeft: `3px solid ${borderColor}`,
        borderRadius: 4,
        maxWidth: 360,
        boxSizing: 'border-box',
        pointerEvents: 'none',
        ...style,
      }}
    >
      {/* Square 56x56 CRT Bezel */}
      <div
        style={{
          position: 'relative',
          width: 56,
          height: 56,
          flexShrink: 0,
          overflow: 'hidden',
          background: '#050811',
          border: '1px solid rgba(255, 255, 255, 0.18)',
        }}
      >
        {!imgFailed ? (
          <img
            src={portraitUrl}
            alt="Dr. Gwen Haddy"
            width={56}
            height={56}
            onError={() => setImgFailed(true)}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              filter: filterStyle,
              transform: isWarningGlitch ? 'translateX(1.5px)' : 'none',
            }}
          />
        ) : (
          <svg
            viewBox="0 0 56 56"
            width={56}
            height={56}
            aria-label="Dr. Gwen Haddy CRT Silhouette"
          >
            <rect width="56" height="56" fill="#070d19" />
            <circle cx="28" cy="21" r="10" fill="#3dc8ff" fillOpacity="0.82" />
            <rect x="20" y="18" width="7" height="4" stroke="#ffc13d" strokeWidth="1.2" fill="none" />
            <rect x="29" y="18" width="7" height="4" stroke="#ffc13d" strokeWidth="1.2" fill="none" />
            <path d="M12 52 C12 37, 44 37, 44 52 Z" fill="#1e293b" stroke="#3dc8ff" strokeWidth="1.2" />
            <path d="M36 24 L42 26" stroke="#ffc13d" strokeWidth="1.5" />
          </svg>
        )}

        {/* CRT Scanline Overlay */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'repeating-linear-gradient(0deg, rgba(0,0,0,0.38) 0px, rgba(0,0,0,0.38) 1px, transparent 1px, transparent 3px)',
            pointerEvents: 'none',
          }}
        />
      </div>

      {/* Telemetry Readout & Active Radio Line */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 8,
            fontSize: 10,
            fontFamily: 'var(--hud-font-mono, monospace)',
            color: borderColor,
            fontWeight: 700,
            letterSpacing: '0.06em',
          }}
        >
          <span>DR. GWEN HADDY // 85.2 MHz</span>
          <span>{isSpeaking ? 'TX LIVE' : 'STANDBY'}</span>
        </div>
        {subtitleText ? (
          <div
            style={{
              fontSize: 11,
              color: '#e8eef5',
              lineHeight: 1.35,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {subtitleText}
          </div>
        ) : (
          <div
            style={{
              fontSize: 10,
              color: 'rgba(232, 238, 245, 0.65)',
              fontFamily: 'var(--hud-font-mono, monospace)',
            }}
          >
            BRIDGE MENTOR LINK // SHIELDED LAB
          </div>
        )}
      </div>
    </div>
  );
};

export default HaddyCrtPortrait;
