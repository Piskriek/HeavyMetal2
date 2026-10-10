import React from 'react';
import type { BuildView } from '../view';
import { Compass } from 'lucide-react';

export interface BuildReadoutProps {
  build: BuildView;
  hoverSupport?: { text: string; color: string } | null;
  wheelCycleText?: string | null;
  rotationText?: string | null;
}

const VERDICT_MESSAGES: Record<string, string> = {
  occupied: 'Something is already there',
  ground: 'Ground in the way',
  steep: 'Too steep for a foundation',
  overlap: 'Overlaps another structure',
  'needs-floor': 'Needs a floor under it',
  'needs-pad': 'Needs a 2 x 2 pad of grounded foundations',
  unsupported: 'Not enough support',
};

export const BuildReadout: React.FC<BuildReadoutProps> = ({
  build,
  hoverSupport = null,
  wheelCycleText = null,
  rotationText = null,
}) => {
  if (!build.blueprint && !hoverSupport) return null;

  const verdict = build.verdict;
  const isOk = verdict?.ok ?? false;
  const whyKey = verdict?.why ?? '';
  const message = isOk
    ? 'READY TO PLACE [LMB]'
    : VERDICT_MESSAGES[whyKey] || whyKey || 'CANNOT PLACE';

  const support = verdict?.support ?? 0;

  // Support color gradient: blue (1.0) -> green -> yellow -> red (< 0.2)
  const supportColor =
    support >= 0.9
      ? '#38bdf8' // blue (grounded foundation)
      : support >= 0.6
        ? '#34d399' // green
        : support >= 0.3
          ? '#fbbf24' // yellow
          : '#ef4444'; // red (unsupported)

  return (
    <div className="hm-build-readout-hud" data-testid="build-readout-hud">
      {hoverSupport && (!build.blueprint || !isOk) && (
        <div
          className="hm-build-hover-badge"
          data-testid="build-hover-support"
          style={{ color: hoverSupport.color, borderColor: `${hoverSupport.color}66` }}
        >
          {hoverSupport.text}
        </div>
      )}

      {build.blueprint && (
        <>
          <div className="hm-build-blueprint-pill">
            <Compass size={12} style={{ color: 'var(--base-cyan)' }} />
            <span>{build.blueprint.name}</span>
          </div>

          <div
            className={`hm-build-verdict-banner ${isOk ? 'ok' : 'refused'}`}
            data-testid="build-verdict-banner"
          >
            {message}
          </div>

          {wheelCycleText && (
            <div className="hm-build-wheel-hint" data-testid="build-wheel-hint">
              {wheelCycleText}
            </div>
          )}

          {rotationText && (
            <div className="hm-build-rot-hint" data-testid="build-rot-hint">
              {rotationText}
            </div>
          )}

          {verdict && isOk && (
            <div className="hm-support-meter-container">
              <span style={{ fontFamily: 'Oxanium', fontSize: 10, color: 'var(--base-text-muted)' }}>
                SUPPORT:
              </span>
              <div className="hm-support-meter-bar">
                <div
                  className="hm-support-meter-fill"
                  style={{
                    width: `${Math.round(support * 100)}%`,
                    background: supportColor,
                    boxShadow: `0 0 6px ${supportColor}66`,
                  }}
                />
              </div>
              <span
                style={{
                  fontFamily: 'Oxanium',
                  fontSize: 10,
                  fontWeight: 700,
                  color: supportColor,
                }}
              >
                {Math.round(support * 100)}%
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
};
