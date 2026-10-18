// ============================================================================
// File: apps/web/src/studio/monster-tab.tsx
// O3: Monster Remap Strength Workspace
// Per-skin remapStrength slider (0 to 1, default 0.20) in the monster bench,
// with dev write-back to /__studio/data/monster-tweaks.
// ============================================================================

import React, { useCallback, useEffect, useState } from 'react';
import { SKINS, type SkinInfo } from '../monsters/roster';
import './monster-tab.css';

export interface MonsterTabProps {
  readonly writable: boolean;
}

export const MonsterTab: React.FC<MonsterTabProps> = ({ writable }) => {
  const [selectedSkinId, setSelectedSkinId] = useState<string>(SKINS[0]?.id ?? 'alien-q');
  const [tweaks, setTweaks] = useState<Record<string, { remapStrength: number }>>({});
  const [status, setStatus] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);

  // Load existing tweaks from dev write-back endpoint
  useEffect(() => {
    let live = true;
    fetch('/__studio/data/monster-tweaks', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : {}))
      .then((data: unknown) => {
        if (!live || !data || typeof data !== 'object') return;
        setTweaks(data as Record<string, { remapStrength: number }>);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  const selectedSkin: SkinInfo = SKINS.find((s) => s.id === selectedSkinId) ?? SKINS[0]!;
  const currentRemap = tweaks[selectedSkin.id]?.remapStrength ?? selectedSkin.remapStrength ?? 0.2;

  const handleRemapChange = useCallback((value: number) => {
    setTweaks((prev) => ({
      ...prev,
      [selectedSkin.id]: { remapStrength: Number(value.toFixed(2)) },
    }));
    setStatus(null);
  }, [selectedSkin.id]);

  const saveTweaks = useCallback(async () => {
    if (!writable) {
      setStatus({ tone: 'err', text: 'Studio is in read-only mode' });
      return;
    }
    try {
      const res = await fetch('/__studio/data/monster-tweaks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tweaks),
      });
      if (res.ok) {
        setStatus({ tone: 'ok', text: `Saved remap for ${Object.keys(tweaks).length} monster skin(s)` });
      } else {
        setStatus({ tone: 'err', text: `Failed to save (HTTP ${res.status})` });
      }
    } catch (e) {
      setStatus({ tone: 'err', text: `Save error: ${e instanceof Error ? e.message : 'network error'}` });
    }
  }, [writable, tweaks]);

  return (
    <div className="sx-monster-tab" data-testid="studio-monster-tab">
      <aside className="sx-monster-roster-list" aria-label="Monster skins roster">
        <div className="sx-block-head">
          <h2>Roster ({SKINS.length})</h2>
          <span className="sx-dim">O3 Skins</span>
        </div>
        {SKINS.map((s) => {
          const isSelected = s.id === selectedSkinId;
          const overridden = tweaks[s.id] !== undefined;
          return (
            <button
              key={s.id}
              type="button"
              className="sx-monster-item"
              aria-selected={isSelected}
              onClick={() => setSelectedSkinId(s.id)}
            >
              <span>{s.id}</span>
              <span className="sx-dim">
                {overridden ? `${tweaks[s.id]!.remapStrength.toFixed(2)}*` : s.era}
              </span>
            </button>
          );
        })}
      </aside>

      <main className="sx-monster-main">
        <div className="sx-monster-card">
          <div className="sx-monster-card-head">
            <h3>{selectedSkin.id}</h3>
            <span className="sx-tag">{selectedSkin.archetype}</span>
          </div>

          <div className="sx-monster-meta-grid">
            <div className="sx-monster-meta-item">
              <span>Era</span>
              <span>{selectedSkin.era}</span>
            </div>
            <div className="sx-monster-meta-item">
              <span>Height</span>
              <span>{selectedSkin.heightM.toFixed(1)} m</span>
            </div>
            <div className="sx-monster-meta-item">
              <span>Source</span>
              <span>{selectedSkin.source}</span>
            </div>
          </div>

          <div className="sx-monster-remap-box">
            <div className="sx-mat-slider-label">
              <span>Gunmetal Remap Strength (O3)</span>
              <span>{(currentRemap * 100).toFixed(0)}% ({currentRemap.toFixed(2)})</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              data-testid="remap-strength-slider"
              value={currentRemap}
              onChange={(e) => handleRemapChange(Number(e.target.value))}
              aria-label="Remap Strength"
            />
            <p className="sx-dim" style={{ fontSize: '11px', margin: 0 }}>
              Controls the strength of the color remap toward the lunar gunmetal palette (0.0 = full native color, 1.0 = fully lunarized).
            </p>
          </div>

          {status ? (
            <div className={`sx-monster-status ${status.tone}`} role="status">
              {status.text}
            </div>
          ) : null}

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '8px' }}>
            <button
              type="button"
              onClick={() => handleRemapChange(0.2)}
              disabled={currentRemap === 0.2}
            >
              Reset Default (0.20)
            </button>
            <button
              type="button"
              className="sx-go"
              onClick={() => void saveTweaks()}
              disabled={!writable}
              title={writable ? 'Save monster tweaks to monster-tweaks.json' : 'Read-only'}
            >
              Save Tweaks
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};
export default MonsterTab;
