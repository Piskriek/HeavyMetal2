// ============================================================================
// File: apps/web/src/shell/planetary-grid.tsx
// Spec A (MENU-01 / DEC-12 / TICKET-08a / TICKET-11):
// Canonical 3-column Planetary Grid & Co-Op Enclave Management Screen:
//  1. Left Pane: Enclave & Roster Navigator (My Enclaves, Shared & Friends, Public Directory)
//  2. Center Pane: Interactive 3D/2D Planetary Globe & Hex-Enclave Map (40,000 km shared planet hologram,
//     #ffc13d amber wireframe, #7cff4d player sector, #3dc8ff friend enclaves, 11 neighbor domes)
//  3. Right Pane: Selected Enclave Inspector, Permissions & Spawn Selector (Earth Lab, Moon Gate, Outpost Beacon, Last Saved)
//     + Primary CTA [DEPLOY TO ENCLAVE ->]
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

export interface EnclaveSectorDef {
  readonly id: string;
  readonly name: string;
  readonly owner: string;
  readonly stage: number;
  readonly kind: 'player' | 'friend' | 'neighbor';
  readonly s: { readonly Pxd: number; readonly Vtx: number; readonly Lx: number; readonly Aq: number };
  readonly powerKw: number;
  readonly builders: number;
  readonly azimuthDeg: number;
  readonly distanceKm: number;
  readonly accent: string;
  readonly plotCode?: string;
}

const NEIGHBOR_ENCLAVES: readonly EnclaveSectorDef[] = [
  { id: 'sec-01', name: 'Mare Tranquillitatis', owner: 'Apollo_AI', stage: 1, kind: 'neighbor', s: { Pxd: 0.35, Vtx: 0.22, Lx: 0.40, Aq: 0.15 }, powerKw: 14.5, builders: 1, azimuthDeg: 0, distanceKm: 4.2, accent: '#ff3d8a' },
  { id: 'sec-02', name: 'Oceanus Procellarum', owner: 'SubstrateCore', stage: 2, kind: 'neighbor', s: { Pxd: 0.55, Vtx: 0.48, Lx: 0.50, Aq: 0.28 }, powerKw: 22.0, builders: 2, azimuthDeg: 32.7, distanceKm: 4.2, accent: '#7cff4d' },
  { id: 'sec-03', name: 'Sinus Iridum', owner: 'RainbowBay', stage: 3, kind: 'neighbor', s: { Pxd: 0.72, Vtx: 0.65, Lx: 0.70, Aq: 0.62 }, powerKw: 38.0, builders: 3, azimuthDeg: 65.4, distanceKm: 4.2, accent: '#ffc13d' },
  { id: 'sec-04', name: 'Mare Imbrium', owner: 'Gwen_Haddy', stage: 4, kind: 'neighbor', s: { Pxd: 0.90, Vtx: 0.88, Lx: 0.92, Aq: 0.85 }, powerKw: 56.5, builders: 4, azimuthDeg: 98.1, distanceKm: 4.2, accent: '#3dc8ff' },
  { id: 'sec-05', name: 'Copernicus Rim', owner: 'OrbitalArch', stage: 2, kind: 'neighbor', s: { Pxd: 0.48, Vtx: 0.52, Lx: 0.45, Aq: 0.20 }, powerKw: 18.0, builders: 1, azimuthDeg: 130.8, distanceKm: 4.2, accent: '#7cff4d' },
  { id: 'sec-06', name: 'Tycho Central Spire', owner: 'BeaconForge', stage: 3, kind: 'neighbor', s: { Pxd: 0.68, Vtx: 0.75, Lx: 0.80, Aq: 0.45 }, powerKw: 42.0, builders: 2, azimuthDeg: 163.5, distanceKm: 4.2, accent: '#ffc13d' },
  { id: 'sec-07', name: 'Mare Serenitatis', owner: 'ClearLake', stage: 4, kind: 'neighbor', s: { Pxd: 0.88, Vtx: 0.85, Lx: 0.86, Aq: 0.80 }, powerKw: 62.0, builders: 3, azimuthDeg: 196.2, distanceKm: 4.2, accent: '#3dc8ff' },
  { id: 'sec-08', name: 'Kepler Basin', owner: 'DustWeaver', stage: 1, kind: 'neighbor', s: { Pxd: 0.28, Vtx: 0.30, Lx: 0.35, Aq: 0.10 }, powerKw: 11.0, builders: 1, azimuthDeg: 228.9, distanceKm: 4.2, accent: '#ff3d8a' },
  { id: 'sec-09', name: 'Sinus Medii', owner: 'EquatorBase', stage: 2, kind: 'neighbor', s: { Pxd: 0.60, Vtx: 0.45, Lx: 0.55, Aq: 0.32 }, powerKw: 24.5, builders: 2, azimuthDeg: 261.6, distanceKm: 4.2, accent: '#7cff4d' },
  { id: 'sec-10', name: 'Mare Nectaris', owner: 'SweetWaters', stage: 3, kind: 'neighbor', s: { Pxd: 0.75, Vtx: 0.70, Lx: 0.72, Aq: 0.68 }, powerKw: 34.0, builders: 2, azimuthDeg: 294.3, distanceKm: 4.2, accent: '#ffc13d' },
  { id: 'sec-11', name: 'Fra Mauro Highlands', owner: 'RidgeRunner', stage: 4, kind: 'neighbor', s: { Pxd: 0.94, Vtx: 0.91, Lx: 0.89, Aq: 0.78 }, powerKw: 48.0, builders: 3, azimuthDeg: 327.0, distanceKm: 4.2, accent: '#3dc8ff' },
];

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
  const [navTab, setNavTab] = useState<'my-enclaves' | 'shared-friends' | 'public-directory'>('my-enclaves');
  const [selectedSectorId, setSelectedSectorId] = useState<string>('player-sector');
  const [accessMode, setAccessMode] = useState<'solo' | 'friends' | 'shared'>(syncMode === 'synced' ? 'shared' : 'solo');
  const [shareLattice, setShareLattice] = useState(true);
  const [allowBuild, setAllowBuild] = useState(true);
  const [allowSchema, setAllowSchema] = useState(false);
  const [selectedSpawn, setSelectedSpawn] = useState<'lab' | 'gate' | 'beacon' | 'last'>(gateOn ? 'gate' : 'lab');

  const [visitInput, setVisitInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [session, setSession] = useState<OutpostSession | null>(() => currentOutpostSession());
  const [coop, setCoop] = useState<'checking' | 'on' | 'off'>('checking');
  const [coopBusy, setCoopBusy] = useState<'host' | 'join' | null>(null);
  const [coopNote, setCoopNote] = useState<string | null>(null);
  const [roomCopied, setRoomCopied] = useState(false);
  const [, setLiveTick] = useState(0);

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

  // Build the list of all selectable sectors (player + friend + 11 neighbors)
  const allSectors: readonly EnclaveSectorDef[] = useMemo(() => {
    const playerSector: EnclaveSectorDef = {
      id: 'player-sector',
      name: 'Your Outpost Crater',
      owner: 'Operator (You)',
      stage: gateOn ? 2 : 1,
      kind: 'player',
      s: { Pxd: 0.62, Vtx: 0.58, Lx: 0.60, Aq: 0.35 },
      powerKw: gateOn ? 24.0 : 12.0,
      builders: 1,
      azimuthDeg: 0,
      distanceKm: 0,
      accent: '#7cff4d',
      plotCode: myCode ?? undefined,
    };

    const friendSector: EnclaveSectorDef | null = session ? {
      id: 'friend-sector',
      name: `Co-Op Outpost [${session.code ?? 'LIVE'}]`,
      owner: session.host ? 'Operator (Host)' : 'Friend Lead',
      stage: 3,
      kind: 'friend',
      s: { Pxd: 0.78, Vtx: 0.72, Lx: 0.80, Aq: 0.55 },
      powerKw: 36.0,
      builders: roster.length,
      azimuthDeg: 45.0,
      distanceKm: 1.8,
      accent: '#3dc8ff',
      plotCode: session.code ?? undefined,
    } : null;

    return friendSector ? [playerSector, friendSector, ...NEIGHBOR_ENCLAVES] : [playerSector, ...NEIGHBOR_ENCLAVES];
  }, [gateOn, myCode, session, roster.length]);

  const activeSector = useMemo(() => {
    return allSectors.find((s) => s.id === selectedSectorId) ?? allSectors[0]!;
  }, [allSectors, selectedSectorId]);

  const handlePrimaryDeploy = () => {
    if (selectedSpawn === 'lab') {
      onSpawn('lab');
    } else if (selectedSpawn === 'gate') {
      if (!gateOn) {
        onSpawn('lab');
      } else {
        onSpawn('gate');
      }
    } else if (selectedSpawn === 'beacon') {
      if (session?.code) {
        onSpawn('gate');
      } else {
        onSpawn('lab');
      }
    } else {
      onSpawn(gateOn ? 'gate' : 'lab');
    }
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
              <h2 className="pg-title">PLANETARY GRID // CO-OP ENCLAVE DIRECTORY</h2>
              <p className="pg-subtitle">
                40,000 km Lunar Substrate · Shared Sunflower Spiral Enclaves &amp; Continental Consensus
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
          {/* Column 1: Left Pane — Enclave & Roster Navigator (320px) */}
          <section className="pg-col" aria-label="Enclave Navigator" data-testid="pg-col-enclave">
            <div className="pg-col-head">
              <span className="pg-col-index">01</span>
              <h3>Enclave Navigator</h3>
            </div>

            {/* Three Sub-Tabs */}
            <div className="pg-nav-tabs" role="tablist" aria-label="Navigator Categories">
              <button
                type="button"
                className={`pg-nav-tab-btn ${navTab === 'my-enclaves' ? 'is-active' : ''}`}
                onClick={() => setNavTab('my-enclaves')}
              >
                My Enclaves
              </button>
              <button
                type="button"
                className={`pg-nav-tab-btn ${navTab === 'shared-friends' ? 'is-active' : ''}`}
                onClick={() => setNavTab('shared-friends')}
              >
                Shared &amp; Friends
              </button>
              <button
                type="button"
                className={`pg-nav-tab-btn ${navTab === 'public-directory' ? 'is-active' : ''}`}
                onClick={() => setNavTab('public-directory')}
              >
                Directory
              </button>
            </div>

            {/* Tab: My Enclaves */}
            {navTab === 'my-enclaves' && (
              <>
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
              </>
            )}

            {/* Tab: Shared & Friends */}
            {navTab === 'shared-friends' && (
              <>
                <div className="pg-card pg-coop" data-testid="pg-coop-card">
                  <div className="pg-field-label">SHARED OUTPOST SESSION</div>
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
                          <span className="pg-mode-desc">Guests join as: {ROLE_LABELS[liveState.defaultGuestRole ?? 'cobuilder']}</span>
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
                                  title={p.role === 'cobuilder' ? 'Demote' : 'Promote'}
                                >
                                  {p.role === 'cobuilder' ? 'Demote' : 'Promote'}
                                </button>
                                <button
                                  type="button"
                                  className="pg-mini-btn"
                                  onClick={() => handleUndoAuthor(p.id, p.name)}
                                  title="Undo last piece"
                                >
                                  Undo
                                </button>
                                <button
                                  type="button"
                                  className="pg-mini-btn"
                                  onClick={() => handleKickPlayer(p.id, p.name)}
                                  title="Kick"
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
                        Open a room to host your outpost live for co-builders, or enter a friend’s 6-character room code below.
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
                  {coopNote ? (
                    <p className="pg-validation is-err" role="status" data-testid="pg-coop-note">
                      {coopNote}
                    </p>
                  ) : null}
                </div>

                <form className="pg-card" onSubmit={handleVisitSubmit}>
                  <label className="pg-field-label" htmlFor="pg-visit-input">
                    JOIN FRIEND VIA CODE
                  </label>
                  <input
                    id="pg-visit-input"
                    type="text"
                    className="pg-input"
                    placeholder="6-character room code or plot code"
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
              </>
            )}

            {/* Tab: Public Directory */}
            {navTab === 'public-directory' && (
              <div className="pg-card pg-recent-card">
                <div className="pg-field-label">RECENTLY VISITED CODES ({recent.length})</div>
                {recent.length === 0 ? (
                  <p className="pg-empty-note" data-testid="pg-recent-empty">
                    Codes you visit are saved here for instant 1-click return trips.
                  </p>
                ) : (
                  <ul className="pg-recent-list" data-testid="pg-recent-list">
                    {recent.map((code, idx) => {
                      const info = checkPlotCode(code);
                      const short = code.length > 20 ? `${code.slice(0, 10)}…${code.slice(-6)}` : code;
                      return (
                        <li key={`${code}-${idx}`} className="pg-recent-item">
                          <div className="pg-recent-meta">
                            <strong>{info.ok ? `${info.owner} (Stage ${info.stage})` : 'Saved Code'}</strong>
                            <code>{short}</code>
                          </div>
                          <button
                            type="button"
                            className="pg-mini-btn"
                            onClick={() => onVisit(code)}
                            disabled={!info.ok}
                          >
                            Dial
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
          </section>

          {/* Column 2: Center Pane — Interactive 3D/2D Planetary Globe & Hex-Enclave Map */}
          <section className="pg-col" aria-label="Planetary Globe Map" data-testid="pg-col-globe">
            <div className="pg-col-head">
              <span className="pg-col-index">02</span>
              <h3>40,000 km Shared Planet Hologram</h3>
            </div>

            <div className="pg-globe-card">
              <svg className="pg-globe-svg" viewBox="0 0 280 280" aria-label="Planetary Hologram Map">
                <defs>
                  <radialGradient id="globeGlow" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="rgba(61, 200, 255, 0.15)" />
                    <stop offset="70%" stopColor="rgba(255, 193, 61, 0.08)" />
                    <stop offset="100%" stopColor="rgba(5, 8, 15, 0.8)" />
                  </radialGradient>
                </defs>

                {/* Outer Wireframe Planet Circle */}
                <circle cx="140" cy="140" r="120" fill="url(#globeGlow)" stroke="#ffc13d" strokeWidth="1.2" strokeOpacity="0.45" />

                {/* Latitude Lines */}
                <ellipse cx="140" cy="140" rx="120" ry="36" fill="none" stroke="#ffc13d" strokeWidth="0.8" strokeOpacity="0.25" />
                <ellipse cx="140" cy="140" rx="120" ry="76" fill="none" stroke="#ffc13d" strokeWidth="0.8" strokeOpacity="0.25" />
                <ellipse cx="140" cy="140" rx="120" ry="110" fill="none" stroke="#ffc13d" strokeWidth="0.8" strokeOpacity="0.15" />

                {/* Longitude Lines */}
                <ellipse cx="140" cy="140" rx="36" ry="120" fill="none" stroke="#ffc13d" strokeWidth="0.8" strokeOpacity="0.25" />
                <ellipse cx="140" cy="140" rx="76" ry="120" fill="none" stroke="#ffc13d" strokeWidth="0.8" strokeOpacity="0.25" />

                {/* 4.2 km Horizon Continental Ring */}
                <circle cx="140" cy="140" r="85" fill="none" stroke="#3dc8ff" strokeWidth="1.2" strokeDasharray="4 3" strokeOpacity="0.5" />

                {/* 11 Horizon Enclave Domes on the ring */}
                {NEIGHBOR_ENCLAVES.map((dom) => {
                  const rad = (dom.azimuthDeg - 90) * (Math.PI / 180);
                  const cx = 140 + 85 * Math.cos(rad);
                  const cy = 140 + 85 * Math.sin(rad);
                  const isSel = selectedSectorId === dom.id;
                  return (
                    <g
                      key={dom.id}
                      className={`pg-hex-btn ${isSel ? 'is-selected' : ''}`}
                      onClick={() => setSelectedSectorId(dom.id)}
                    >
                      <polygon
                        points={`${cx},${cy - 8} ${cx + 7},${cy - 4} ${cx + 7},${cy + 4} ${cx},${cy + 8} ${cx - 7},${cy + 4} ${cx - 7},${cy - 4}`}
                        fill={isSel ? dom.accent : 'rgba(10, 16, 26, 0.85)'}
                        stroke={dom.accent}
                        strokeWidth={isSel ? 2 : 1.2}
                      />
                      <circle cx={cx} cy={cy} r="2.5" fill={isSel ? '#ffffff' : dom.accent} />
                    </g>
                  );
                })}

                {/* Center Sector: Your Enclave (#7cff4d Green) */}
                {(() => {
                  const isSel = selectedSectorId === 'player-sector';
                  return (
                    <g
                      className={`pg-hex-btn ${isSel ? 'is-selected' : ''}`}
                      onClick={() => setSelectedSectorId('player-sector')}
                    >
                      <polygon
                        points="140,126 152,133 152,147 140,154 128,147 128,133"
                        fill={isSel ? '#7cff4d' : 'rgba(124, 255, 77, 0.2)'}
                        stroke="#7cff4d"
                        strokeWidth={isSel ? 2.5 : 1.5}
                      />
                      <circle cx="140" cy="140" r="4" fill={isSel ? '#040810' : '#7cff4d'} />
                    </g>
                  );
                })()}

                {/* Friend / Shared Enclave Hex (if live session) */}
                {session && (
                  <g
                    className={`pg-hex-btn ${selectedSectorId === 'friend-sector' ? 'is-selected' : ''}`}
                    onClick={() => setSelectedSectorId('friend-sector')}
                  >
                    <polygon
                      points="175,100 185,106 185,118 175,124 165,118 165,106"
                      fill={selectedSectorId === 'friend-sector' ? '#3dc8ff' : 'rgba(61, 200, 255, 0.25)'}
                      stroke="#3dc8ff"
                      strokeWidth={1.8}
                    />
                    <circle cx="175" cy="112" r="3" fill="#ffffff" />
                  </g>
                )}
              </svg>

              <div style={{ marginTop: '10px', textAlign: 'center', fontSize: '11px', color: '#94a3b8' }}>
                Click any sector hex above to inspect enclave telemetry and permissions
              </div>
            </div>

            <div className="pg-card">
              <div className="pg-field-label">CONTINENTAL CONSENSUS GAUGE</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '12px', color: '#e2e8f0' }}>Continental Consensus Fraction</span>
                <b style={{ font: '700 13px Oxanium, monospace', color: '#3dc8ff' }}>88.5% (CONSENSUS READY)</b>
              </div>
              <div className="pg-spark-bar-wrap" style={{ height: '8px' }}>
                <div className="pg-spark-bar-fill" style={{ width: '88.5%', background: 'linear-gradient(90deg, #ff3d8a, #7cff4d, #3dc8ff)' }} />
              </div>
              <p className="pg-mode-desc" style={{ marginTop: '6px' }}>
                Consensus locks at &ge;85.0% when Stage 4 biosphere coherence stabilizes across all 12 continental sectors.
              </p>
            </div>
          </section>

          {/* Column 3: Right Pane — Selected Enclave Inspector, Permissions & Spawn Selector (360px) */}
          <section className="pg-col" aria-label="Enclave Inspector" data-testid="pg-col-spawn">
            <div className="pg-col-head">
              <span className="pg-col-index">03</span>
              <h3>Enclave Inspector</h3>
            </div>

            {/* Enclave Telemetry Card */}
            <div className="pg-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <div>
                  <h4 style={{ margin: '0 0 2px 0', font: '700 15px Oxanium, monospace', color: '#f8fafc' }}>
                    {activeSector.name}
                  </h4>
                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                    Owner: {activeSector.owner} · {activeSector.distanceKm > 0 ? `${activeSector.distanceKm} km ring` : 'Origin Crater'}
                  </span>
                </div>
                <span className={`nexus-badge stage-${activeSector.stage}`}>
                  Stage {activeSector.stage}
                </span>
              </div>

              {/* 4-Float Sparklines */}
              <div className="pg-field-label" style={{ marginTop: '8px' }}>FOUR FLOATS TELEMETRY S = (Pxd, Vtx, Lx, Aq)</div>
              <div className="pg-spark-bars">
                <div className="pg-spark-item">
                  <div className="pg-spark-label"><span>Pxd</span><b>{Math.round(activeSector.s.Pxd * 100)}%</b></div>
                  <div className="pg-spark-bar-wrap"><div className="pg-spark-bar-fill" style={{ width: `${activeSector.s.Pxd * 100}%`, background: '#ff3d8a' }} /></div>
                </div>
                <div className="pg-spark-item">
                  <div className="pg-spark-label"><span>Vtx</span><b>{Math.round(activeSector.s.Vtx * 100)}%</b></div>
                  <div className="pg-spark-bar-wrap"><div className="pg-spark-bar-fill" style={{ width: `${activeSector.s.Vtx * 100}%`, background: '#7cff4d' }} /></div>
                </div>
                <div className="pg-spark-item">
                  <div className="pg-spark-label"><span>Lx</span><b>{Math.round(activeSector.s.Lx * 100)}%</b></div>
                  <div className="pg-spark-bar-wrap"><div className="pg-spark-bar-fill" style={{ width: `${activeSector.s.Lx * 100}%`, background: '#ffc13d' }} /></div>
                </div>
                <div className="pg-spark-item">
                  <div className="pg-spark-label"><span>Aq</span><b>{Math.round(activeSector.s.Aq * 100)}%</b></div>
                  <div className="pg-spark-bar-wrap"><div className="pg-spark-bar-fill" style={{ width: `${activeSector.s.Aq * 100}%`, background: '#3dc8ff' }} /></div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '16px', marginTop: '10px', fontSize: '11px', color: '#94a3b8' }}>
                <span>Power: <b style={{ color: '#ffc13d' }}>{activeSector.powerKw} kW</b></span>
                <span>Active Builders: <b style={{ color: '#7cff4d' }}>{activeSector.builders} online</b></span>
              </div>
            </div>

            {/* Co-Op & Base Permissions (if Owner or Player Sector) */}
            {activeSector.kind === 'player' && (
              <div className="pg-card">
                <div className="pg-field-label">CO-OP &amp; BASE PERMISSIONS</div>
                <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                  <button
                    type="button"
                    className={`pg-mini-btn ${accessMode === 'solo' ? 'is-active' : ''}`}
                    onClick={() => setAccessMode('solo')}
                  >
                    Solo Offline
                  </button>
                  <button
                    type="button"
                    className={`pg-mini-btn ${accessMode === 'friends' ? 'is-active' : ''}`}
                    onClick={() => setAccessMode('friends')}
                  >
                    Friends Can Visit
                  </button>
                  <button
                    type="button"
                    className={`pg-mini-btn ${accessMode === 'shared' ? 'is-active' : ''}`}
                    onClick={() => setAccessMode('shared')}
                  >
                    Shared Co-Op
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label className="pg-perm-toggle-row">
                    <span>Share @hm/lattice Storage Bins</span>
                    <input type="checkbox" checked={shareLattice} onChange={(e) => setShareLattice(e.target.checked)} />
                  </label>
                  <label className="pg-perm-toggle-row">
                    <span>Allow Base Building &amp; Demolish</span>
                    <input type="checkbox" checked={allowBuild} onChange={(e) => setAllowBuild(e.target.checked)} />
                  </label>
                  <label className="pg-perm-toggle-row">
                    <span>Allow Schema &amp; Cartridge Edits</span>
                    <input type="checkbox" checked={allowSchema} onChange={(e) => setAllowSchema(e.target.checked)} />
                  </label>
                </div>
              </div>
            )}

            {/* Spawn Point Selector */}
            <div className="pg-card">
              <div className="pg-field-label">SPAWN POINT SELECTOR</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button
                  type="button"
                  className={`pg-spawn-card ${selectedSpawn === 'lab' ? 'is-accent' : ''}`}
                  onClick={() => setSelectedSpawn('lab')}
                >
                  <div className="pg-spawn-badge">EARTH BUNKER</div>
                  <h4 style={{ margin: '2px 0' }}>Earth Observation Lab</h4>
                  <p style={{ margin: 0, fontSize: '11px' }}>Deploy inside the bunker at Operator Console.</p>
                </button>

                <button
                  type="button"
                  className={`pg-spawn-card ${selectedSpawn === 'gate' ? 'is-accent' : ''}`}
                  onClick={() => { if (gateOn) setSelectedSpawn('gate'); }}
                  disabled={!gateOn}
                >
                  <div className="pg-spawn-badge amber">MOON CRATER</div>
                  <h4 style={{ margin: '2px 0' }}>Moon Twin Gate Pad</h4>
                  <p style={{ margin: 0, fontSize: '11px' }}>
                    {gateOn ? 'Deploy directly onto your crater pad beside the Twin Gate.' : 'Locked: Power the gate in the Lab first.'}
                  </p>
                </button>

                {session && (
                  <button
                    type="button"
                    className={`pg-spawn-card ${selectedSpawn === 'beacon' ? 'is-accent' : ''}`}
                    onClick={() => setSelectedSpawn('beacon')}
                  >
                    <div className="pg-spawn-badge" style={{ background: 'rgba(61, 200, 255, 0.25)', color: '#3dc8ff' }}>OUTPOST</div>
                    <h4 style={{ margin: '2px 0' }}>Shared Recall Beacon</h4>
                    <p style={{ margin: 0, fontSize: '11px' }}>Spawn straight into friend’s shared base.</p>
                  </button>
                )}
              </div>

              {/* Primary CTA Deploy Button */}
              <button
                type="button"
                className="pg-deploy-cta"
                onClick={handlePrimaryDeploy}
              >
                DEPLOY TO ENCLAVE &rarr;
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default PlanetaryGridScreen;
