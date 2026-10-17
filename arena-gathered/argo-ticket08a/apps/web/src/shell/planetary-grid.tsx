// ============================================================================
// File: apps/web/src/shell/planetary-grid.tsx
// TICKET-08a (OPUS_NOTE_13 Item A — MENU-01 / DEC-12):
// Honest 3-column Planetary Grid screen:
//  1. Your Enclave: plot code with Copy, slot on the shared planet, Synced/Desynced toggle
//  2. Visit: paste a friend's code (validated with checkPlotCode / decodePlot), Visit, recent codes
//  3. Spawn Point: Earth Lab or Moon Gate
// ============================================================================

import React, { useEffect, useMemo, useState } from 'react';
import { decodePlot } from '../play/plot-code';
import { slotPosition } from '../crafter/shared-planet';

const STYLE_ID = "hm-planetary-grid-styles";
const STYLE_CSS = "/* ============================================================================\n * File: apps/web/src/shell/planetary-grid.css\n * TICKET-08a (OPUS_NOTE_13 Item A — MENU-01):\n * Dark-glass telemetry styling for the 3-column Planetary Grid screen.\n * ============================================================================ */\n\n.pg-screen {\n  position: fixed;\n  inset: 0;\n  z-index: 90;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  padding: 24px;\n  background:\n    radial-gradient(900px 480px at 18% 8%, rgba(61, 200, 255, 0.09), transparent 65%),\n    radial-gradient(820px 520px at 85% 92%, rgba(255, 193, 61, 0.08), transparent 65%),\n    rgba(4, 8, 15, 0.84);\n  backdrop-filter: blur(14px) saturate(140%);\n  -webkit-backdrop-filter: blur(14px) saturate(140%);\n  color: #f4f8ff;\n  font-family: 'Inter', system-ui, sans-serif;\n}\n\n.pg-shell {\n  width: min(1120px, 100%);\n  max-height: min(760px, 92vh);\n  display: flex;\n  flex-direction: column;\n  background: rgba(10, 15, 24, 0.9);\n  border: 1px solid rgba(255, 255, 255, 0.16);\n  border-radius: 10px;\n  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.65), 0 0 24px rgba(61, 200, 255, 0.08);\n  overflow: hidden;\n}\n\n.pg-header {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 16px;\n  padding: 16px 22px;\n  background: linear-gradient(180deg, rgba(18, 26, 38, 0.95), rgba(10, 15, 24, 0.95));\n  border-bottom: 1px solid rgba(255, 255, 255, 0.12);\n}\n\n.pg-header-brand {\n  display: flex;\n  align-items: center;\n  gap: 12px;\n}\n\n.pg-status-dot {\n  width: 10px;\n  height: 10px;\n  border-radius: 50%;\n  background: #3dc8ff;\n  box-shadow: 0 0 10px #3dc8ff;\n}\n\n.pg-title {\n  margin: 0;\n  font-family: 'Oxanium', monospace, sans-serif;\n  font-size: 16px;\n  font-weight: 700;\n  letter-spacing: 0.08em;\n  color: #f4f8ff;\n}\n\n.pg-subtitle {\n  margin: 2px 0 0;\n  font-size: 12px;\n  color: #94a3b8;\n}\n\n.pg-back-btn {\n  display: inline-flex;\n  align-items: center;\n  gap: 6px;\n  padding: 6px 12px;\n  background: rgba(255, 255, 255, 0.05);\n  border: 1px solid rgba(255, 255, 255, 0.18);\n  border-radius: 6px;\n  color: #f4f8ff;\n  font-family: 'Oxanium', sans-serif;\n  font-size: 12px;\n  font-weight: 600;\n  cursor: pointer;\n}\n\n.pg-back-btn:hover {\n  background: rgba(61, 200, 255, 0.14);\n  border-color: #3dc8ff;\n}\n\n.pg-back-btn kbd {\n  padding: 1px 5px;\n  font-size: 10px;\n  background: rgba(0, 0, 0, 0.45);\n  border: 1px solid rgba(255, 255, 255, 0.24);\n  border-radius: 4px;\n}\n\n.pg-columns {\n  display: grid;\n  grid-template-columns: repeat(3, minmax(0, 1fr));\n  gap: 18px;\n  padding: 20px 22px;\n  overflow-y: auto;\n}\n\n.pg-col {\n  display: flex;\n  flex-direction: column;\n  gap: 14px;\n  min-width: 0;\n}\n\n.pg-col-head {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  padding-bottom: 8px;\n  border-bottom: 1px solid rgba(255, 255, 255, 0.1);\n}\n\n.pg-col-index {\n  font-family: 'Oxanium', monospace;\n  font-size: 11px;\n  font-weight: 700;\n  padding: 2px 6px;\n  border-radius: 4px;\n  color: #3dc8ff;\n  background: rgba(61, 200, 255, 0.12);\n  border: 1px solid rgba(61, 200, 255, 0.3);\n}\n\n.pg-col-head h3 {\n  margin: 0;\n  font-family: 'Oxanium', sans-serif;\n  font-size: 14px;\n  font-weight: 700;\n  letter-spacing: 0.05em;\n  text-transform: uppercase;\n  color: #f4f8ff;\n}\n\n.pg-card {\n  display: flex;\n  flex-direction: column;\n  gap: 10px;\n  padding: 14px;\n  background: rgba(16, 23, 36, 0.78);\n  border: 1px solid rgba(255, 255, 255, 0.1);\n  border-radius: 8px;\n}\n\n.pg-field-label {\n  font-family: 'Oxanium', sans-serif;\n  font-size: 10px;\n  font-weight: 700;\n  letter-spacing: 0.08em;\n  text-transform: uppercase;\n  color: #94a3b8;\n}\n\n.pg-sync-row {\n  display: grid;\n  grid-template-columns: 1fr 1fr;\n  gap: 8px;\n}\n\n.pg-sync-btn {\n  padding: 8px 10px;\n  font-family: 'Oxanium', sans-serif;\n  font-size: 12px;\n  font-weight: 700;\n  letter-spacing: 0.06em;\n  background: rgba(8, 12, 20, 0.8);\n  border: 1px solid rgba(255, 255, 255, 0.14);\n  border-radius: 6px;\n  color: #94a3b8;\n  cursor: pointer;\n}\n\n.pg-sync-btn.is-active.synced {\n  background: rgba(61, 200, 255, 0.18);\n  border-color: #3dc8ff;\n  color: #3dc8ff;\n  box-shadow: 0 0 12px rgba(61, 200, 255, 0.2);\n}\n\n.pg-sync-btn.is-active.desynced {\n  background: rgba(255, 193, 61, 0.18);\n  border-color: #ffc13d;\n  color: #ffc13d;\n  box-shadow: 0 0 12px rgba(255, 193, 61, 0.2);\n}\n\n.pg-mode-desc {\n  margin: 0;\n  font-size: 12px;\n  line-height: 1.4;\n  color: #cbd5e1;\n}\n\n.pg-slot-readout {\n  display: flex;\n  flex-direction: column;\n  gap: 2px;\n}\n\n.pg-slot-id {\n  font-family: 'Oxanium', sans-serif;\n  font-size: 15px;\n  font-weight: 700;\n  color: #7cff4d;\n}\n\n.pg-slot-readout.is-unclaimed .pg-slot-id {\n  color: #94a3b8;\n}\n\n.pg-slot-coords {\n  font-size: 11px;\n  color: #94a3b8;\n}\n\n.pg-code-box {\n  padding: 8px 10px;\n  background: rgba(4, 7, 13, 0.85);\n  border: 1px solid rgba(61, 200, 255, 0.28);\n  border-radius: 6px;\n  max-height: 76px;\n  overflow-y: auto;\n  word-break: break-all;\n}\n\n.pg-code-box code {\n  font-family: ui-monospace, 'Cascadia Code', Consolas, monospace;\n  font-size: 11px;\n  color: #bae6fd;\n}\n\n.pg-input {\n  width: 100%;\n  padding: 9px 11px;\n  background: rgba(4, 7, 13, 0.9);\n  border: 1px solid rgba(255, 255, 255, 0.2);\n  border-radius: 6px;\n  color: #f4f8ff;\n  font-family: ui-monospace, Consolas, monospace;\n  font-size: 12px;\n}\n\n.pg-input:focus {\n  outline: none;\n  border-color: #3dc8ff;\n  box-shadow: 0 0 0 2px rgba(61, 200, 255, 0.2);\n}\n\n.pg-validation {\n  font-size: 11px;\n  padding: 6px 8px;\n  border-radius: 5px;\n}\n\n.pg-validation.is-ok {\n  background: rgba(124, 255, 77, 0.12);\n  border: 1px solid rgba(124, 255, 77, 0.35);\n  color: #86efac;\n}\n\n.pg-validation.is-err {\n  background: rgba(255, 61, 138, 0.14);\n  border: 1px solid rgba(255, 61, 138, 0.38);\n  color: #fda4af;\n}\n\n.pg-action-btn {\n  padding: 9px 14px;\n  border-radius: 6px;\n  font-family: 'Oxanium', sans-serif;\n  font-size: 12px;\n  font-weight: 700;\n  letter-spacing: 0.06em;\n  cursor: pointer;\n}\n\n.pg-action-btn.primary {\n  background: linear-gradient(180deg, #3dc8ff, #0284c7);\n  border: 1px solid #38bdf8;\n  color: #040810;\n}\n\n.pg-action-btn.primary:disabled {\n  background: rgba(255, 255, 255, 0.06);\n  border-color: rgba(255, 255, 255, 0.1);\n  color: #64748b;\n  cursor: not-allowed;\n}\n\n.pg-action-btn.secondary {\n  background: rgba(61, 200, 255, 0.14);\n  border: 1px solid rgba(61, 200, 255, 0.38);\n  color: #3dc8ff;\n}\n\n.pg-recent-card {\n  flex: 1;\n}\n\n.pg-recent-list {\n  list-style: none;\n  margin: 0;\n  padding: 0;\n  display: flex;\n  flex-direction: column;\n  gap: 6px;\n}\n\n.pg-recent-item {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 8px;\n  padding: 7px 9px;\n  background: rgba(6, 10, 18, 0.65);\n  border: 1px solid rgba(255, 255, 255, 0.08);\n  border-radius: 6px;\n}\n\n.pg-recent-meta {\n  display: flex;\n  flex-direction: column;\n  min-width: 0;\n}\n\n.pg-recent-meta strong {\n  font-size: 12px;\n  color: #f4f8ff;\n}\n\n.pg-recent-meta code {\n  font-size: 10px;\n  color: #94a3b8;\n}\n\n.pg-mini-btn {\n  padding: 4px 10px;\n  font-family: 'Oxanium', sans-serif;\n  font-size: 11px;\n  font-weight: 700;\n  background: rgba(61, 200, 255, 0.16);\n  border: 1px solid rgba(61, 200, 255, 0.4);\n  border-radius: 4px;\n  color: #3dc8ff;\n  cursor: pointer;\n}\n\n.pg-spawn-cards {\n  display: flex;\n  flex-direction: column;\n  gap: 12px;\n}\n\n.pg-spawn-card {\n  display: flex;\n  flex-direction: column;\n  align-items: flex-start;\n  gap: 8px;\n  padding: 16px;\n  text-align: left;\n  background: rgba(16, 23, 36, 0.85);\n  border: 1px solid rgba(61, 200, 255, 0.26);\n  border-radius: 8px;\n  color: #f4f8ff;\n  cursor: pointer;\n  transition: transform 0.12s ease, border-color 0.12s ease, box-shadow 0.12s ease;\n}\n\n.pg-spawn-card:hover {\n  transform: translateY(-1px);\n  border-color: #3dc8ff;\n  box-shadow: 0 6px 20px rgba(61, 200, 255, 0.16);\n}\n\n.pg-spawn-card.is-accent {\n  border-color: rgba(255, 193, 61, 0.35);\n}\n\n.pg-spawn-card.is-accent:hover {\n  border-color: #ffc13d;\n  box-shadow: 0 6px 20px rgba(255, 193, 61, 0.18);\n}\n\n.pg-spawn-badge {\n  font-family: 'Oxanium', sans-serif;\n  font-size: 10px;\n  font-weight: 700;\n  letter-spacing: 0.08em;\n  padding: 2px 7px;\n  border-radius: 4px;\n  color: #3dc8ff;\n  background: rgba(61, 200, 255, 0.14);\n}\n\n.pg-spawn-badge.amber {\n  color: #ffc13d;\n  background: rgba(255, 193, 61, 0.16);\n}\n\n.pg-spawn-card h4 {\n  margin: 0;\n  font-family: 'Oxanium', sans-serif;\n  font-size: 15px;\n  font-weight: 700;\n  color: #f4f8ff;\n}\n\n.pg-spawn-card p {\n  margin: 0;\n  font-size: 12px;\n  line-height: 1.4;\n  color: #cbd5e1;\n}\n\n.pg-spawn-cta {\n  font-family: 'Oxanium', sans-serif;\n  font-size: 11px;\n  font-weight: 700;\n  letter-spacing: 0.06em;\n  color: #3dc8ff;\n}\n\n.pg-spawn-card.is-accent .pg-spawn-cta {\n  color: #ffc13d;\n}\n\n.pg-empty-note,\n.pg-honest-foot {\n  margin: 0;\n  font-size: 12px;\n  line-height: 1.4;\n  color: #94a3b8;\n}\n\n@media (max-width: 900px) {\n  .pg-columns {\n    grid-template-columns: 1fr;\n  }\n}\n";
if (typeof document !== "undefined" && !document.getElementById(STYLE_ID)) {
  const el = document.createElement("style");
  el.id = STYLE_ID;
  el.textContent = STYLE_CSS;
  document.head.appendChild(el);
}

export interface PlotCodeCheck {
  readonly ok: boolean;
  readonly why?: string;
  readonly owner?: string;
  readonly stage?: number;
  readonly machines?: number;
}

/**
 * Pure validator wrapping `decodePlot(code)`.
 * Returns `{ ok: true, owner, stage, machines }` for a valid base64url plot snapshot,
 * or `{ ok: false, why }` when empty or corrupt.
 */
export function checkPlotCode(code: string): PlotCodeCheck {
  if (typeof code !== 'string') {
    return { ok: false, why: 'Paste a plot code to visit.' };
  }
  const trimmed = code.trim();
  if (trimmed.length === 0) {
    return { ok: false, why: 'Paste a plot code to visit.' };
  }
  const snap = decodePlot(trimmed);
  if (!snap) {
    return { ok: false, why: 'Invalid or corrupted plot code.' };
  }
  return {
    ok: true,
    owner: snap.owner,
    stage: snap.stage,
    machines: snap.machines.length,
  };
}

export interface PlanetaryGridScreenProps {
  readonly myCode: string | null;
  readonly slot: number | null;
  readonly syncMode: 'synced' | 'desynced';
  readonly recent: readonly string[];
  readonly onToggleSync: () => void;
  readonly onVisit: (code: string) => void;
  readonly onSpawn: (where: 'lab' | 'gate') => void;
  readonly onBack: () => void;
}

export const PlanetaryGridScreen: React.FC<PlanetaryGridScreenProps> = ({
  myCode,
  slot,
  syncMode,
  recent,
  onToggleSync,
  onVisit,
  onSpawn,
  onBack,
}) => {
  const [visitInput, setVisitInput] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onBack();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onBack]);

  const check = useMemo(() => checkPlotCode(visitInput), [visitInput]);
  const coords = slot !== null && slot >= 0 ? slotPosition(slot) : null;

  const handleCopy = () => {
    if (!myCode) return;
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(myCode);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleVisitSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!check.ok) return;
    onVisit(visitInput.trim());
  };

  return (
    <div
      className="pg-screen"
      role="dialog"
      aria-modal="true"
      aria-label="Planetary Grid"
      data-testid="planetary-grid-screen"
    >
      <div className="pg-shell">
        {/* Top Telemetry Header */}
        <header className="pg-header">
          <div className="pg-header-brand">
            <span className="pg-status-dot" aria-hidden="true" />
            <div>
              <h2 className="pg-title">PLANETARY GRID // ENCLAVE DIRECTORY</h2>
              <p className="pg-subtitle">
                40,000 km Lunar Substrate · Sunflower Spiral Sector Allocation &amp; Outpost Codes
              </p>
            </div>
          </div>
          <button
            type="button"
            className="pg-back-btn"
            onClick={onBack}
            data-testid="pg-back-btn"
          >
            <kbd>Esc</kbd>
            <span>Back</span>
          </button>
        </header>

        {/* 3-Column Body */}
        <div className="pg-columns">
          {/* Column 1: Your Enclave */}
          <section className="pg-col" aria-label="Your Enclave" data-testid="pg-col-enclave">
            <div className="pg-col-head">
              <span className="pg-col-index">01</span>
              <h3>Your Enclave</h3>
            </div>

            <div className="pg-card">
              <div className="pg-field-label">SIMULATION BRANCH MODE</div>
              <div className="pg-sync-row" role="group" aria-label="Sync mode">
                <button
                  type="button"
                  className={`pg-sync-btn${syncMode === 'synced' ? ' is-active synced' : ''}`}
                  aria-pressed={syncMode === 'synced'}
                  onClick={() => {
                    if (syncMode !== 'synced') onToggleSync();
                  }}
                  data-testid="pg-sync-synced"
                >
                  SYNCED
                </button>
                <button
                  type="button"
                  className={`pg-sync-btn${syncMode === 'desynced' ? ' is-active desynced' : ''}`}
                  aria-pressed={syncMode === 'desynced'}
                  onClick={() => {
                    if (syncMode !== 'desynced') onToggleSync();
                  }}
                  data-testid="pg-sync-desynced"
                >
                  DESYNCED
                </button>
              </div>
              <p className="pg-mode-desc" data-testid="pg-sync-desc">
                {syncMode === 'synced'
                  ? 'Synced: Claims a sector slot on the shared planet and merges neighbour plots by majority rules.'
                  : 'Desynced: Private solo simulation branch on this device. No shared-planet slot claim.'}
              </p>
            </div>

            <div className="pg-card">
              <div className="pg-field-label">PLANETARY SECTOR SLOT</div>
              {slot !== null && coords ? (
                <div className="pg-slot-readout" data-testid="pg-slot-readout">
                  <strong className="pg-slot-id">SECTOR #{slot}</strong>
                  <span className="pg-slot-coords">
                    ({Math.round(coords.x)} m, {Math.round(coords.z)} m from origin crater)
                  </span>
                </div>
              ) : (
                <div className="pg-slot-readout is-unclaimed" data-testid="pg-slot-readout">
                  <strong className="pg-slot-id">UNCLAIMED</strong>
                  <span className="pg-slot-coords">
                    {syncMode === 'synced'
                      ? 'Assigned when your outpost publishes to the planetary spiral'
                      : 'Switch to Synced to claim a shared-planet sector'}
                  </span>
                </div>
              )}
            </div>

            <div className="pg-card">
              <div className="pg-field-label">YOUR OUTPOST SHARE CODE</div>
              {myCode ? (
                <>
                  <div className="pg-code-box" data-testid="pg-my-code">
                    <code>{myCode}</code>
                  </div>
                  <button
                    type="button"
                    className="pg-action-btn secondary"
                    onClick={handleCopy}
                    data-testid="pg-copy-btn"
                  >
                    {copied ? 'COPIED TO CLIPBOARD' : 'COPY PLOT CODE'}
                  </button>
                </>
              ) : (
                <p className="pg-empty-note" data-testid="pg-no-code">
                  No outpost code yet. Step through the Gate and place your first machine to generate a shareable snapshot code.
                </p>
              )}
            </div>
          </section>

          {/* Column 2: Visit */}
          <section className="pg-col" aria-label="Visit" data-testid="pg-col-visit">
            <div className="pg-col-head">
              <span className="pg-col-index">02</span>
              <h3>Visit by Code</h3>
            </div>

            <form className="pg-card" onSubmit={handleVisitSubmit}>
              <label className="pg-field-label" htmlFor="pg-visit-input">
                FRIEND&rsquo;S OUTPOST CODE
              </label>
              <input
                id="pg-visit-input"
                type="text"
                className="pg-input"
                placeholder="Paste plot code..."
                value={visitInput}
                onChange={(e) => setVisitInput(e.target.value)}
                spellCheck={false}
                autoComplete="off"
                data-testid="pg-visit-input"
              />
              {visitInput.trim().length > 0 && (
                <div
                  className={`pg-validation ${check.ok ? 'is-ok' : 'is-err'}`}
                  role="status"
                  data-testid="pg-visit-status"
                >
                  {check.ok
                    ? `Outpost verified: ${check.owner} · Stage ${check.stage} · ${check.machines} machine${check.machines === 1 ? '' : 's'}`
                    : check.why}
                </div>
              )}
              <button
                type="submit"
                className="pg-action-btn primary"
                disabled={!check.ok}
                data-testid="pg-visit-btn"
              >
                VISIT OUTPOST
              </button>
            </form>

            <div className="pg-card pg-recent-card">
              <div className="pg-field-label">RECENTLY VISITED CODES ({recent.length})</div>
              {recent.length === 0 ? (
                <p className="pg-empty-note" data-testid="pg-recent-empty">
                  Codes you visit are remembered here for one-click return trips.
                </p>
              ) : (
                <ul className="pg-recent-list" data-testid="pg-recent-list">
                  {recent.map((code, idx) => {
                    const info = checkPlotCode(code);
                    const short =
                      code.length > 22 ? `${code.slice(0, 12)}…${code.slice(-8)}` : code;
                    return (
                      <li key={`${code}-${idx}`} className="pg-recent-item">
                        <div className="pg-recent-meta">
                          <strong>
                            {info.ok ? `${info.owner} (Stage ${info.stage})` : 'Saved Code'}
                          </strong>
                          <code>{short}</code>
                        </div>
                        <button
                          type="button"
                          className="pg-mini-btn"
                          onClick={() => onVisit(code)}
                          disabled={!info.ok}
                          data-testid={`pg-recent-visit-${idx}`}
                        >
                          Visit
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>

          {/* Column 3: Spawn Point */}
          <section className="pg-col" aria-label="Spawn Point" data-testid="pg-col-spawn">
            <div className="pg-col-head">
              <span className="pg-col-index">03</span>
              <h3>Spawn Point</h3>
            </div>

            <div className="pg-spawn-cards">
              <button
                type="button"
                className="pg-spawn-card"
                onClick={() => onSpawn('lab')}
                data-testid="pg-spawn-lab"
              >
                <div className="pg-spawn-badge">EARTH BUNKER</div>
                <h4>Earth Observation Lab</h4>
                <p>
                  Wake inside the bunker at the Operator Console, review your cartridges on the rack, and step through the Quantum Gate.
                </p>
                <span className="pg-spawn-cta">ENTER AT EARTH LAB &rarr;</span>
              </button>

              <button
                type="button"
                className="pg-spawn-card is-accent"
                onClick={() => onSpawn('gate')}
                data-testid="pg-spawn-gate"
              >
                <div className="pg-spawn-badge amber">LUNAR SURFACE</div>
                <h4>Moon Twin Gate</h4>
                <p>
                  Deploy directly onto your crater pad beside the Moon Twin Gate, ready to build, harvest, and run your machines.
                </p>
                <span className="pg-spawn-cta">DEPLOY AT MOON GATE &rarr;</span>
              </button>
            </div>

            <p className="pg-honest-foot">
              Visiting a friend&rsquo;s outpost uses a snapshot code in the middle column and opens a read-only inspection tour at their Moon Gate.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default PlanetaryGridScreen;
