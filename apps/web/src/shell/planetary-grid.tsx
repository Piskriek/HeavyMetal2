// ============================================================================
// File: apps/web/src/shell/planetary-grid.tsx
// TICKET-08a & TICKET-11 (Plan 36 Phase 2 — Planetary Grid Co-Op Controls):
// Honest 3-column Planetary Grid screen:
//  1. Your Enclave: plot code with Copy, slot on the shared planet (POL-84),
//     Synced/Desynced toggle (POL-85), and Shared Outpost co-op controls
//     (Promote/Demote, per-author Undo, Kick, and Default Guest Role toggle).
//  2. Visit: paste a friend's code (validated with checkPlotCode / decodePlot) or 6-char room code
//  3. Spawn Point: Earth Lab or Moon Gate
// ============================================================================

import React, { useEffect, useMemo, useState } from 'react';
import { readStoredSlot, slotPosition, writePlaySyncMode } from '../crafter/shared-planet';
import { ROLE_LABELS, type OutpostRole } from '../net/protocol';
import {
  coopAvailable,
  currentOutpostSession,
  hostOutpostSession,
  isRoomCode,
  joinOutpostSession,
  leaveOutpostSession,
  rosterOf,
  subscribeOutpostSession,
  type OutpostSession,
} from '../net/outpost-session';

import './planetary-grid.css';
import {
  CONNECTION_TEXT,
  checkPlotCode,
  type PlotCodeCheck,
} from './planetary-grid-data';
export { CONNECTION_TEXT, checkPlotCode, type PlotCodeCheck };

export interface PlanetaryGridScreenProps {
  readonly myCode: string | null;
  /** Why there is no code yet, when one exists but cannot be shared (a machine past the 500 m limit). */
  readonly codeNote?: string;
  readonly slot: number | null;
  readonly syncMode: 'synced' | 'desynced';
  readonly recent: readonly string[];
  /** The Moon Twin Gate is powered (the lab's console lever, saved). The lunar spawn stays locked until it is. */
  readonly gateOn: boolean;
  readonly onToggleSync: () => void;
  readonly onVisit: (code: string) => void;
  readonly onSpawn: (where: 'lab' | 'gate') => void;
  readonly onBack: () => void;
}

export const PlanetaryGridScreen: React.FC<PlanetaryGridScreenProps> = ({
  myCode,
  codeNote,
  gateOn,
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
  // the shared outpost: the live session (shared with play), whether this build can open rooms, and what the card last said
  const [session, setSession] = useState<OutpostSession | null>(() => currentOutpostSession());
  const [coop, setCoop] = useState<'checking' | 'on' | 'off'>('checking');
  const [coopBusy, setCoopBusy] = useState<'host' | 'join' | null>(null);
  const [coopNote, setCoopNote] = useState<string | null>(null);
  const [roomCopied, setRoomCopied] = useState(false);
  const [, setLiveTick] = useState(0);

  // POL-84: the sector slot this save has claimed. A claim is made when the outpost publishes (claimAndStoreSlot), so
  // Synced only shows a claim that is already stored: a fresh save reads UNCLAIMED until it publishes.
  const effectiveSlot = useMemo(() => {
    if (slot !== null && slot >= 0) return slot;
    if (syncMode !== 'synced') return null;
    const stored = readStoredSlot();
    return stored !== null && stored >= 0 ? stored : null;
  }, [slot, syncMode]);

  useEffect(() => subscribeOutpostSession(() => setSession(currentOutpostSession())), []);

  useEffect(() => {
    let alive = true;
    void coopAvailable().then((ok) => {
      if (alive) setCoop(ok ? 'on' : 'off');
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!session) return;
    return session.client.onStateChange(() => setLiveTick((t) => t + 1));
  }, [session]);

  const handleHost = async () => {
    setCoopBusy('host');
    setCoopNote(null);
    try {
      await hostOutpostSession();
    } catch {
      setCoopNote('The room did not open. Check the connection, then try again.');
    } finally {
      setCoopBusy(null);
    }
  };

  const handleJoin = async (code: string) => {
    setCoopBusy('join');
    setCoopNote(null);
    try {
      await joinOutpostSession(code);
      setVisitInput('');
    } catch {
      setCoopNote('No open room answers to that code. Check it, then try again.');
    } finally {
      setCoopBusy(null);
    }
  };

  const handleLeave = () => {
    const wasHost = session?.host ?? false;
    leaveOutpostSession();
    setCoopNote(wasHost ? 'The room is closed for now. Your base keeps what was built in it.' : 'You left the room. Your own base is as you left it.');
  };

  const handleCopyRoom = () => {
    if (!session?.code) return;
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(session.code);
    }
    setRoomCopied(true);
    setTimeout(() => setRoomCopied(false), 2000);
  };

  const handleToggleRole = (targetId: string, currentRole: OutpostRole) => {
    if (!session || !session.host) return;
    const nextRole: OutpostRole = currentRole === 'cobuilder' ? 'visitor' : 'cobuilder';
    session.client.setRole(targetId, nextRole);
  };

  const handleUndoAuthor = (targetId: string, name: string) => {
    if (!session || !session.host) return;
    session.client.undoAuthor(targetId);
    setCoopNote(`Reverted the last piece placed by ${name}.`);
  };

  const handleKickPlayer = (targetId: string, name: string) => {
    if (!session || !session.host) return;
    session.client.kickPlayer(targetId, 'Removed by Lead Architect');
    setCoopNote(`Removed ${name} from the room.`);
  };

  const handleToggleDefaultRole = () => {
    if (!session || !session.host) return;
    const cur = session.client.state().defaultGuestRole ?? 'cobuilder';
    const next: OutpostRole = cur === 'cobuilder' ? 'visitor' : 'cobuilder';
    session.client.setDefaultRole(next);
  };

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
  // a 6-character code joins a room live; a longer one is a plot code, as in 08a
  const roomEntry = isRoomCode(visitInput);
  const visit: { readonly tone: 'ok' | 'err' | 'note'; readonly canSubmit: boolean; readonly text: string } = roomEntry
    ? coop === 'on'
      ? { tone: 'ok', canSubmit: coopBusy === null, text: `Room ${visitInput.trim().toUpperCase()} joins the outpost live.` }
      : { tone: 'note', canSubmit: false, text: coop === 'off' ? 'Co-op runs in the RUN build. This build plays solo.' : 'Checking the connection...' }
    : check.ok
      ? { tone: 'ok', canSubmit: true, text: `Outpost verified: ${check.owner} · Stage ${check.stage} · ${check.machines} machine${check.machines === 1 ? '' : 's'}` }
      : { tone: 'err', canSubmit: false, text: check.why ?? '' };
  const liveState = session ? session.client.state() : null;
  const roster = session ? rosterOf(session.client) : [];
  const coords = effectiveSlot !== null && effectiveSlot >= 0 ? slotPosition(effectiveSlot) : null;

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
    if (!visit.canSubmit) return;
    if (roomEntry) {
      void handleJoin(visitInput.trim());
      return;
    }
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
                    if (syncMode !== 'synced') {
                      writePlaySyncMode('synced');
                      onToggleSync();
                    }
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
                    if (syncMode !== 'desynced') {
                      writePlaySyncMode('desynced');
                      onToggleSync();
                    }
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
              {effectiveSlot !== null && coords ? (
                <div className="pg-slot-readout" data-testid="pg-slot-readout">
                  <strong className="pg-slot-id">SECTOR #{effectiveSlot}</strong>
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

            <div className="pg-card pg-coop" data-testid="pg-coop-card">
              <div className="pg-field-label">SHARED OUTPOST</div>
              {session && liveState ? (
                <>
                  <div className="pg-coop-code" data-testid="pg-coop-code">
                    <code>{session.code ?? '------'}</code>
                    {session.host && session.code ? (
                      <button type="button" className="pg-mini-btn" onClick={handleCopyRoom} data-testid="pg-coop-copy">
                        {roomCopied ? 'Copied' : 'Copy'}
                      </button>
                    ) : null}
                  </div>
                  <div className="pg-coop-row">
                    <span className="pg-coop-state" data-state={liveState.connectionState} data-testid="pg-coop-state">
                      {CONNECTION_TEXT[liveState.connectionState]}
                    </span>
                    <span className="pg-mode-desc">{session.host ? 'Lead Architect' : liveState.roleLabel}</span>
                  </div>
                  {session.host ? (
                    <div className="pg-coop-row" data-testid="pg-default-role-row">
                      <span className="pg-mode-desc">New guests join as: {ROLE_LABELS[liveState.defaultGuestRole ?? 'cobuilder']}</span>
                      <button
                        type="button"
                        className="pg-mini-btn"
                        onClick={handleToggleDefaultRole}
                        data-testid="pg-default-role-toggle"
                      >
                        {liveState.defaultGuestRole === 'visitor' ? 'Allow Co-Build' : 'Observer Only'}
                      </button>
                    </div>
                  ) : null}
                  <p className="pg-mode-desc">
                    {session.host
                      ? 'Friends type this code in Visit to build on your outpost with you.'
                      : 'You are building in a friend’s outpost. Your own base is kept on this device.'}
                  </p>
                  <ul className="pg-roster" aria-label="Who is in the room" data-testid="pg-roster">
                    {roster.map((p) => (
                      <li key={p.id} className={`pg-chip role-${p.role}${p.self ? ' is-self' : ''}`} data-testid="pg-roster-chip">
                        <span className="pg-chip-name">{p.name}</span>
                        <span className="pg-chip-role">{ROLE_LABELS[p.role]}</span>
                        {session.host && !p.self ? (
                          <span className="pg-chip-actions">
                            <button
                              type="button"
                              className="pg-mini-btn"
                              onClick={() => handleToggleRole(p.id, p.role)}
                              title={p.role === 'cobuilder' ? 'Demote to Field Observer' : 'Promote to Co-Builder'}
                              data-testid={`pg-role-toggle-${p.id}`}
                            >
                              {p.role === 'cobuilder' ? 'Demote' : 'Promote'}
                            </button>
                            <button
                              type="button"
                              className="pg-mini-btn"
                              onClick={() => handleUndoAuthor(p.id, p.name)}
                              title={`Undo last piece placed by ${p.name}`}
                              data-testid={`pg-undo-${p.id}`}
                            >
                              Undo
                            </button>
                            <button
                              type="button"
                              className="pg-mini-btn"
                              onClick={() => handleKickPlayer(p.id, p.name)}
                              title={`Remove ${p.name} from room`}
                              data-testid={`pg-kick-${p.id}`}
                            >
                              Kick
                            </button>
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                  <button type="button" className="pg-action-btn secondary" onClick={handleLeave} data-testid="pg-coop-leave">
                    LEAVE ROOM
                  </button>
                </>
              ) : (
                <>
                  <p className="pg-mode-desc">
                    Open a room and friends build on your outpost live, by code. Solo play works the same either way.
                  </p>
                  <button
                    type="button"
                    className="pg-action-btn primary"
                    onClick={() => void handleHost()}
                    disabled={coop !== 'on' || coopBusy !== null}
                    data-testid="pg-host-btn"
                  >
                    {coopBusy === 'host' ? 'OPENING ROOM...' : 'HOST MY OUTPOST'}
                  </button>
                </>
              )}
              {coop === 'off' ? (
                <p className="pg-plain-note" data-testid="pg-coop-plain">
                  Co-op runs in the RUN build.
                </p>
              ) : null}
              {coopNote ? (
                <p className="pg-validation is-err" role="status" data-testid="pg-coop-note">
                  {coopNote}
                </p>
              ) : null}
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
                  {codeNote ?? 'No outpost code yet. Step through the Gate and place your first machine to generate a shareable snapshot code.'}
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
                placeholder="Plot code, or a 6-character room code"
                value={visitInput}
                onChange={(e) => setVisitInput(e.target.value)}
                spellCheck={false}
                autoComplete="off"
                data-testid="pg-visit-input"
              />
              {visitInput.trim().length > 0 && (
                <div
                  className={`pg-validation is-${visit.tone}`}
                  role="status"
                  data-testid="pg-visit-status"
                >
                  {visit.text}
                </div>
              )}
              <button
                type="submit"
                className="pg-action-btn primary"
                disabled={!visit.canSubmit}
                data-testid="pg-visit-btn"
              >
                {roomEntry ? 'JOIN ROOM' : 'VISIT OUTPOST'}
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
                disabled={!gateOn}
                aria-disabled={!gateOn}
                data-testid="pg-spawn-gate"
              >
                <div className="pg-spawn-badge amber">LUNAR SURFACE</div>
                <h4>Moon Twin Gate</h4>
                <p>
                  {gateOn
                    ? 'Deploy directly onto your crater pad beside the Moon Twin Gate, ready to build, harvest, and run your machines.'
                    : 'The gate is still dark. Pull the console lever in the Earth lab to power it, then deploy from here.'}
                </p>
                <span className="pg-spawn-cta">{gateOn ? 'DEPLOY AT MOON GATE →' : 'LOCKED: POWER THE GATE FIRST'}</span>
              </button>
            </div>

            <p className="pg-honest-foot">
              Visiting dials a friend&rsquo;s outpost from its code. Then step through your Quantum Gate to walk it, read-only.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default PlanetaryGridScreen;
