// ============================================================================
// File: apps/web/src/play/controls-grid.tsx
// TICKET-04 (OPUS_NOTE_11 Item D):
// 2-column keycap grid for the Esc pause screen in the HUD telemetry vocabulary.
// ============================================================================

import React from 'react';
import './controls-grid.css';

export interface ControlsGridProps {
  readonly controls: readonly (readonly [keys: string, what: string])[];
}

function splitKeyTokens(rawKeys: string): string[] {
  return rawKeys
    .split(/\s*(?:\/|,|\bor\b)\s*/i)
    .map((k) => k.trim())
    .filter(Boolean);
}

export const ControlsGrid: React.FC<ControlsGridProps> = ({ controls }) => {
  return (
    <div
      className="hm-controls-grid"
      role="list"
      aria-label="Controls reference"
      data-testid="controls-grid"
    >
      {controls.map(([keys, what], idx) => {
        const tokens = splitKeyTokens(keys);
        return (
          <div
            key={`${keys}-${idx}`}
            className="hm-controls-row"
            role="listitem"
            data-testid={`controls-row-${idx}`}
          >
            <div className="hm-controls-keycaps">
              {tokens.length > 0 ? (
                tokens.map((token, tIdx) => (
                  <React.Fragment key={`${token}-${tIdx}`}>
                    {tIdx > 0 && <span className="hm-controls-key-sep">/</span>}
                    <kbd className="hm-controls-keycap">{token}</kbd>
                  </React.Fragment>
                ))
              ) : (
                <kbd className="hm-controls-keycap">{keys}</kbd>
              )}
            </div>
            <span className="hm-controls-desc">{what}</span>
          </div>
        );
      })}
    </div>
  );
};

export default ControlsGrid;
