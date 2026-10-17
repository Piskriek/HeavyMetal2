// ============================================================================
// File: apps/web/src/studio/audio-tab.tsx
// TICKET-08a (OPUS_NOTE_13 Item C — STUDIO-01):
// Studio Audio workspace tab listing every sound in public/audio/levels.json
// with Play, Stop, Loop preview, Gain (dB), and Loop region (loopStart/loopEnd),
// read-only in the built game and editable in dev.
// ============================================================================

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const STYLE_ID = "hm-studio-audio-tab-styles";
const STYLE_CSS = "/* ============================================================================\n * File: apps/web/src/studio/audio-tab.css\n * TICKET-08a (OPUS_NOTE_13 Item C — STUDIO-01):\n * Studio Audio tab dark telemetry styling matching studio-app.css.\n * ============================================================================ */\n\n.sx-audio-tab {\n  flex: 1;\n  min-height: 0;\n  display: grid;\n  grid-template-columns: 380px 1fr;\n  background: var(--sx-bg, #05080c);\n  color: var(--sx-text, #d7e3ee);\n  font-family: var(--sx-ui, 'Inter', system-ui, sans-serif);\n  overflow: hidden;\n}\n\n.sx-audio-sidebar {\n  display: flex;\n  flex-direction: column;\n  min-height: 0;\n  background: var(--sx-panel, rgba(12, 17, 24, 0.86));\n  border-right: 1px solid var(--sx-line, #1c2734);\n}\n\n.sx-audio-controls-head {\n  display: flex;\n  flex-direction: column;\n  gap: 10px;\n  padding: 14px;\n  border-bottom: 1px solid var(--sx-line, #1c2734);\n}\n\n.sx-audio-title-row {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n}\n\n.sx-audio-title-row h2 {\n  margin: 0;\n  font-family: var(--sx-display, 'Oxanium', sans-serif);\n  font-size: 13px;\n  font-weight: 700;\n  letter-spacing: 0.05em;\n  text-transform: uppercase;\n}\n\n.sx-audio-count {\n  font-family: var(--sx-display, 'Oxanium', monospace);\n  font-size: 11px;\n  color: var(--sx-amber, #ffc53d);\n}\n\n.sx-audio-search {\n  width: 100%;\n  padding: 7px 10px;\n  background: #0a1017;\n  border: 1px solid var(--sx-line-hi, #2c3d51);\n  border-radius: 6px;\n  color: var(--sx-text, #d7e3ee);\n  font-size: 12px;\n}\n\n.sx-audio-cats {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 5px;\n}\n\n.sx-audio-cat-btn {\n  padding: 4px 8px;\n  font-size: 11px;\n  border-radius: 5px;\n  background: rgba(20, 28, 38, 0.85);\n  border: 1px solid var(--sx-line-hi, #2c3d51);\n  color: var(--sx-dim, #6c8193);\n  cursor: pointer;\n}\n\n.sx-audio-cat-btn.is-active {\n  background: rgba(255, 197, 61, 0.14);\n  border-color: rgba(255, 197, 61, 0.55);\n  color: var(--sx-amber, #ffc53d);\n}\n\n.sx-audio-list {\n  list-style: none;\n  margin: 0;\n  padding: 8px;\n  overflow-y: auto;\n  flex: 1;\n  display: flex;\n  flex-direction: column;\n  gap: 4px;\n}\n\n.sx-audio-row {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 10px;\n  padding: 8px 10px;\n  border-radius: 6px;\n  background: rgba(15, 22, 32, 0.65);\n  border: 1px solid transparent;\n  cursor: pointer;\n}\n\n.sx-audio-row:hover {\n  background: rgba(24, 34, 48, 0.85);\n  border-color: var(--sx-line-hi, #2c3d51);\n}\n\n.sx-audio-row.is-selected {\n  background: rgba(95, 212, 255, 0.1);\n  border-color: rgba(95, 212, 255, 0.45);\n}\n\n.sx-audio-row.is-playing {\n  border-color: var(--sx-amber, #ffc53d);\n}\n\n.sx-audio-row-main {\n  display: flex;\n  flex-direction: column;\n  gap: 3px;\n  min-width: 0;\n}\n\n.sx-audio-id {\n  font-family: ui-monospace, Consolas, monospace;\n  font-size: 12px;\n  color: #f4f8ff;\n}\n\n.sx-audio-badges {\n  display: flex;\n  gap: 6px;\n  font-family: var(--sx-display, 'Oxanium', monospace);\n  font-size: 10px;\n}\n\n.sx-audio-badge.gain {\n  color: var(--sx-cyan, #5fd4ff);\n}\n\n.sx-audio-badge.loop {\n  color: var(--sx-dim, #6c8193);\n}\n\n.sx-audio-btn {\n  padding: 4px 10px;\n  font-family: var(--sx-display, 'Oxanium', sans-serif);\n  font-size: 11px;\n  font-weight: 700;\n  border-radius: 5px;\n  cursor: pointer;\n}\n\n.sx-audio-btn.play {\n  background: rgba(95, 212, 255, 0.14);\n  border: 1px solid rgba(95, 212, 255, 0.4);\n  color: var(--sx-cyan, #5fd4ff);\n}\n\n.sx-audio-btn.stop {\n  background: rgba(255, 122, 107, 0.18);\n  border: 1px solid rgba(255, 122, 107, 0.45);\n  color: var(--sx-err, #ff7a6b);\n}\n\n.sx-audio-inspector {\n  padding: 24px;\n  overflow-y: auto;\n  display: flex;\n  flex-direction: column;\n}\n\n.sx-audio-card {\n  max-width: 640px;\n  width: 100%;\n  display: flex;\n  flex-direction: column;\n  gap: 20px;\n  padding: 20px 22px;\n  background: var(--sx-panel, rgba(12, 17, 24, 0.9));\n  border: 1px solid var(--sx-line-hi, #2c3d51);\n  border-radius: 10px;\n}\n\n.sx-audio-card-head {\n  display: flex;\n  align-items: flex-start;\n  justify-content: space-between;\n  gap: 12px;\n  padding-bottom: 14px;\n  border-bottom: 1px solid var(--sx-line, #1c2734);\n}\n\n.sx-audio-cat-tag {\n  display: inline-block;\n  margin-bottom: 4px;\n  font-family: var(--sx-display, 'Oxanium', sans-serif);\n  font-size: 10px;\n  font-weight: 700;\n  letter-spacing: 0.08em;\n  text-transform: uppercase;\n  color: var(--sx-cyan, #5fd4ff);\n}\n\n.sx-audio-card-head h3 {\n  margin: 0;\n  font-family: ui-monospace, Consolas, monospace;\n  font-size: 18px;\n  color: #f4f8ff;\n}\n\n.sx-audio-mode-badge {\n  padding: 3px 8px;\n  border-radius: 4px;\n  font-family: var(--sx-display, 'Oxanium', sans-serif);\n  font-size: 10px;\n  font-weight: 700;\n  letter-spacing: 0.06em;\n}\n\n.sx-audio-mode-badge.writable {\n  background: rgba(111, 227, 160, 0.14);\n  border: 1px solid rgba(111, 227, 160, 0.4);\n  color: var(--sx-ok, #6fe3a0);\n}\n\n.sx-audio-mode-badge.readonly {\n  background: rgba(255, 197, 61, 0.14);\n  border: 1px solid rgba(255, 197, 61, 0.4);\n  color: var(--sx-amber, #ffc53d);\n}\n\n.sx-audio-transport {\n  display: flex;\n  align-items: center;\n  flex-wrap: wrap;\n  gap: 16px;\n  padding: 12px 14px;\n  background: rgba(5, 8, 12, 0.75);\n  border: 1px solid var(--sx-line, #1c2734);\n  border-radius: 8px;\n}\n\n.sx-audio-transport-btn {\n  padding: 8px 16px;\n  font-family: var(--sx-display, 'Oxanium', sans-serif);\n  font-size: 12px;\n  font-weight: 700;\n  border-radius: 6px;\n  cursor: pointer;\n}\n\n.sx-audio-transport-btn.play {\n  background: linear-gradient(180deg, #ffd060, #e9a92a);\n  border: 1px solid #ffd060;\n  color: #1b1403;\n}\n\n.sx-audio-transport-btn.stop {\n  background: rgba(255, 122, 107, 0.22);\n  border: 1px solid rgba(255, 122, 107, 0.55);\n  color: #ff7a6b;\n}\n\n.sx-audio-loop-toggle {\n  display: inline-flex;\n  align-items: center;\n  gap: 7px;\n  font-size: 12px;\n  cursor: pointer;\n}\n\n.sx-audio-rms {\n  margin-left: auto;\n  font-size: 12px;\n  color: var(--sx-dim, #6c8193);\n}\n\n.sx-audio-rms b {\n  font-family: var(--sx-display, 'Oxanium', monospace);\n  color: var(--sx-text, #d7e3ee);\n}\n\n.sx-audio-field-group {\n  display: flex;\n  flex-direction: column;\n  gap: 8px;\n}\n\n.sx-audio-field-header {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  font-size: 12px;\n  font-weight: 600;\n}\n\n.sx-audio-linear-readout {\n  font-family: var(--sx-display, 'Oxanium', monospace);\n  font-size: 11px;\n  color: var(--sx-dim, #6c8193);\n}\n\n.sx-audio-control-row {\n  display: grid;\n  grid-template-columns: 1fr 88px;\n  align-items: center;\n  gap: 12px;\n}\n\n.sx-audio-loop-grid {\n  display: grid;\n  grid-template-columns: 1fr 1fr;\n  gap: 14px;\n}\n\n.sx-audio-loop-field {\n  display: flex;\n  flex-direction: column;\n  gap: 6px;\n  font-size: 12px;\n  color: var(--sx-dim, #6c8193);\n}\n\n.sx-audio-error {\n  margin: 0;\n  padding: 8px 10px;\n  border-radius: 6px;\n  background: rgba(255, 122, 107, 0.14);\n  border: 1px solid rgba(255, 122, 107, 0.4);\n  color: #ff7a6b;\n  font-size: 12px;\n}\n\n.sx-audio-empty {\n  padding: 40px;\n  color: var(--sx-dim, #6c8193);\n  font-size: 13px;\n}\n";
if (typeof document !== "undefined" && !document.getElementById(STYLE_ID)) {
  const el = document.createElement("style");
  el.id = STYLE_ID;
  el.textContent = STYLE_CSS;
  document.head.appendChild(el);
}

export interface AudioLevelEntry {
  readonly gain: number;
  readonly rms?: number;
  readonly start?: number;
  readonly end?: number;
  readonly loopStart?: number;
  readonly loopEnd?: number;
}

export type AudioLevels =
  | Readonly<Record<string, AudioLevelEntry>>
  | {
      readonly about?: string;
      readonly levels: Readonly<Record<string, AudioLevelEntry>>;
    };

export interface AudioPatch {
  readonly gain?: number;
  readonly loopStart?: number;
  readonly loopEnd?: number;
}

export interface AudioTabProps {
  readonly levels: AudioLevels;
  readonly writable: boolean;
  readonly onChange: (id: string, patch: AudioPatch) => void;
}

export type AudioCategory = 'all' | 'music' | 'machines' | 'combat' | 'vehicles' | 'ui';

/** Converts decibels (`-36` to `+18` dB) into linear Web Audio gain (`10^(dB / 20)`). */
export function dbToLinear(db: number): number {
  if (!Number.isFinite(db)) return 1;
  const clamped = Math.max(-48, Math.min(24, db));
  return Math.pow(10, clamped / 20);
}

/** Normalizes either `{ levels: Record<...> }` or a flat `Record<string, AudioLevelEntry>` into a clean map. */
export function normalizeAudioLevels(
  input: AudioLevels | null | undefined
): Readonly<Record<string, AudioLevelEntry>> {
  if (!input || typeof input !== 'object') return {};
  if ('levels' in input && input.levels && typeof input.levels === 'object' && !('gain' in input.levels)) {
    return input.levels as Readonly<Record<string, AudioLevelEntry>>;
  }
  return input as Readonly<Record<string, AudioLevelEntry>>;
}

/** Classifies a sound ID from `levels.json` into a filterable Studio bus category. */
export function audioCategoryOf(id: string): Exclude<AudioCategory, 'all'> {
  if (id.startsWith('music-')) return 'music';
  if (
    id.includes('motor-') ||
    id.includes('skid') ||
    id.includes('impact')
  ) {
    return 'vehicles';
  }
  if (
    id.includes('fire-') ||
    id.includes('reload') ||
    id.includes('empty') ||
    id.includes('beam') ||
    id.includes('storm')
  ) {
    return 'combat';
  }
  if (
    id.includes('mill') ||
    id.includes('press') ||
    id.includes('projector') ||
    id.includes('watermaker') ||
    id.includes('fabricator') ||
    id.includes('breaker') ||
    id.includes('relay') ||
    id.includes('lever') ||
    id.includes('capacitor') ||
    id.includes('gate-')
  ) {
    return 'machines';
  }
  return 'ui';
}

/** Clamps a gain/loop patch to safe finite ranges. */
export function clampAudioPatch(patch: AudioPatch): AudioPatch {
  const out: { gain?: number; loopStart?: number; loopEnd?: number } = {};
  if (patch.gain !== undefined && Number.isFinite(patch.gain)) {
    out.gain = Math.round(Math.max(-36, Math.min(18, patch.gain)) * 10) / 10;
  }
  if (patch.loopStart !== undefined && Number.isFinite(patch.loopStart)) {
    out.loopStart = Math.round(Math.max(0, patch.loopStart) * 1000) / 1000;
  }
  if (patch.loopEnd !== undefined && Number.isFinite(patch.loopEnd)) {
    out.loopEnd = Math.round(Math.max(0, patch.loopEnd) * 1000) / 1000;
  }
  return out;
}

const CATEGORY_LABELS: Readonly<Record<AudioCategory, string>> = {
  all: 'All Sounds',
  music: 'Music',
  machines: 'Machines & Lab',
  combat: 'Beam & Combat',
  vehicles: 'Vehicles',
  ui: 'Build & UI',
};

export const AudioTab: React.FC<AudioTabProps> = ({
  levels,
  writable,
  onChange,
}) => {
  const map = useMemo(() => normalizeAudioLevels(levels), [levels]);
  const allIds = useMemo(() => Object.keys(map), [map]);

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<AudioCategory>('all');
  const [selectedId, setSelectedId] = useState<string | null>(() => allIds[0] ?? null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [loopEnabled, setLoopEnabled] = useState<boolean>(true);
  const [playError, setPlayError] = useState<string | null>(null);

  const ctxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const bufferCacheRef = useRef<Map<string, AudioBuffer>>(new Map());
  const htmlAudioRef = useRef<HTMLAudioElement | null>(null);

  const stopPlayback = useCallback(() => {
    if (sourceRef.current) {
      try {
        sourceRef.current.onended = null;
        sourceRef.current.stop();
        sourceRef.current.disconnect();
      } catch {
        // already stopped
      }
      sourceRef.current = null;
    }
    if (gainNodeRef.current) {
      try {
        gainNodeRef.current.disconnect();
      } catch {
        // ignore
      }
      gainNodeRef.current = null;
    }
    if (htmlAudioRef.current) {
      try {
        htmlAudioRef.current.pause();
        htmlAudioRef.current.currentTime = 0;
      } catch {
        // ignore
      }
      htmlAudioRef.current = null;
    }
    setPlayingId(null);
  }, []);

  useEffect(() => {
    return () => {
      stopPlayback();
      if (ctxRef.current && ctxRef.current.state !== 'closed') {
        void ctxRef.current.close().catch(() => undefined);
      }
    };
  }, [stopPlayback]);

  // Live-update gain & loop boundaries if user drags sliders while playing
  useEffect(() => {
    if (!playingId) return;
    const entry = map[playingId];
    if (!entry) return;
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = dbToLinear(entry.gain);
    }
    const startSec = entry.loopStart ?? entry.start;
    const endSec = entry.loopEnd ?? entry.end;
    const hasLoopRegion =
      startSec !== undefined && endSec !== undefined && endSec > startSec;
    if (sourceRef.current) {
      sourceRef.current.loop = loopEnabled && (hasLoopRegion || playingId.startsWith('music-'));
      if (hasLoopRegion) {
        sourceRef.current.loopStart = startSec;
        sourceRef.current.loopEnd = endSec;
      }
    }
  }, [playingId, map, loopEnabled]);

  const playSound = useCallback(
    async (id: string, forceLoop?: boolean) => {
      stopPlayback();
      setPlayError(null);
      setSelectedId(id);

      const entry = map[id];
      if (!entry) return;

      const useLoop = forceLoop ?? loopEnabled;
      const startSec = entry.loopStart ?? entry.start;
      const endSec = entry.loopEnd ?? entry.end;
      const hasLoopRegion =
        startSec !== undefined && endSec !== undefined && endSec > startSec;

      const baseUri = typeof document !== 'undefined' ? document.baseURI : '/';
      const candidates = [
        new URL(`audio/${id}.mp3`, baseUri).toString(),
        new URL(`audio/${id}.ogg`, baseUri).toString(),
        new URL(`audio/${id}.wav`, baseUri).toString(),
      ];

      try {
        const AudioCtx =
          typeof window !== 'undefined'
            ? window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
            : undefined;

        if (!AudioCtx) {
          throw new Error('Web Audio API unavailable');
        }
        if (!ctxRef.current) {
          ctxRef.current = new AudioCtx();
        }
        const ctx = ctxRef.current;
        if (ctx.state === 'suspended') {
          await ctx.resume();
        }

        let buffer = bufferCacheRef.current.get(id);
        if (!buffer) {
          let arrayBuf: ArrayBuffer | null = null;
          for (const url of candidates) {
            const resp = await fetch(url);
            if (resp.ok) {
              arrayBuf = await resp.arrayBuffer();
              break;
            }
          }
          if (!arrayBuf) {
            throw new Error(`Audio file for "${id}" not found in public/audio/`);
          }
          buffer = await ctx.decodeAudioData(arrayBuf);
          bufferCacheRef.current.set(id, buffer);
        }

        const source = ctx.createBufferSource();
        source.buffer = buffer;
        const gainNode = ctx.createGain();
        gainNode.gain.value = dbToLinear(entry.gain);

        const shouldLoop = useLoop && (hasLoopRegion || id.startsWith('music-'));
        source.loop = shouldLoop;
        if (hasLoopRegion) {
          source.loopStart = Math.max(0, Math.min(buffer.duration, startSec));
          source.loopEnd = Math.max(source.loopStart + 0.01, Math.min(buffer.duration, endSec));
        }

        source.connect(gainNode);
        gainNode.connect(ctx.destination);
        source.onended = () => {
          if (sourceRef.current === source) {
            setPlayingId(null);
            sourceRef.current = null;
          }
        };

        sourceRef.current = source;
        gainNodeRef.current = gainNode;
        setPlayingId(id);
        source.start(0, shouldLoop && hasLoopRegion ? source.loopStart : 0);
      } catch (err) {
        // Fallback to HTMLAudioElement if fetch/decode fails
        try {
          const audio = new Audio(candidates[0]);
          audio.loop = useLoop && (hasLoopRegion || id.startsWith('music-'));
          audio.volume = Math.max(0, Math.min(1, dbToLinear(entry.gain)));
          htmlAudioRef.current = audio;
          setPlayingId(id);
          audio.onended = () => setPlayingId(null);
          await audio.play();
        } catch {
          setPlayingId(null);
          setPlayError(err instanceof Error ? err.message : 'Playback failed');
        }
      }
    },
    [map, loopEnabled, stopPlayback]
  );

  const filteredIds = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allIds.filter((id) => {
      if (category !== 'all' && audioCategoryOf(id) !== category) return false;
      if (q && !id.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [allIds, category, query]);

  const activeEntry = selectedId ? map[selectedId] : undefined;

  return (
    <div className="sx-audio-tab" data-testid="studio-audio-tab">
      {/* Left Sidebar: Filter & Sound List */}
      <aside className="sx-audio-sidebar" aria-label="Sound library">
        <div className="sx-audio-controls-head">
          <div className="sx-audio-title-row">
            <h2>Audio Library</h2>
            <span className="sx-audio-count">{filteredIds.length} / {allIds.length}</span>
          </div>
          <input
            type="search"
            className="sx-audio-search"
            placeholder="Filter sound IDs..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Filter sound IDs"
            data-testid="audio-search-input"
          />
          <div className="sx-audio-cats" role="tablist" aria-label="Sound categories">
            {(Object.keys(CATEGORY_LABELS) as AudioCategory[]).map((cat) => (
              <button
                key={cat}
                type="button"
                role="tab"
                aria-selected={category === cat}
                className={`sx-audio-cat-btn${category === cat ? ' is-active' : ''}`}
                onClick={() => setCategory(cat)}
                data-testid={`audio-cat-${cat}`}
              >
                {CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>
        </div>

        <ul className="sx-audio-list" role="listbox" aria-label="Sounds" data-testid="audio-sound-list">
          {filteredIds.map((id) => {
            const entry = map[id]!;
            const isSelected = selectedId === id;
            const isPlaying = playingId === id;
            const startSec = entry.loopStart ?? entry.start;
            const endSec = entry.loopEnd ?? entry.end;
            const hasLoop = startSec !== undefined && endSec !== undefined;

            return (
              <li
                key={id}
                role="option"
                aria-selected={isSelected}
                className={`sx-audio-row${isSelected ? ' is-selected' : ''}${isPlaying ? ' is-playing' : ''}`}
                onClick={() => setSelectedId(id)}
                data-testid={`audio-row-${id}`}
              >
                <div className="sx-audio-row-main">
                  <strong className="sx-audio-id">{id}</strong>
                  <div className="sx-audio-badges">
                    <span className="sx-audio-badge gain">
                      {entry.gain > 0 ? `+${entry.gain}` : entry.gain} dB
                    </span>
                    {hasLoop && (
                      <span className="sx-audio-badge loop">
                        {startSec.toFixed(1)}s–{endSec.toFixed(1)}s
                      </span>
                    )}
                  </div>
                </div>
                <div className="sx-audio-row-actions" onClick={(e) => e.stopPropagation()}>
                  {isPlaying ? (
                    <button
                      type="button"
                      className="sx-audio-btn stop"
                      onClick={stopPlayback}
                      data-testid={`audio-stop-${id}`}
                    >
                      Stop
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="sx-audio-btn play"
                      onClick={() => void playSound(id)}
                      data-testid={`audio-play-${id}`}
                    >
                      Play
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </aside>

      {/* Right Inspector & Loop / Gain Editor */}
      <section className="sx-audio-inspector" aria-label="Sound inspector">
        {selectedId && activeEntry ? (
          <div className="sx-audio-card" data-testid="audio-inspector-card">
            <header className="sx-audio-card-head">
              <div>
                <span className="sx-audio-cat-tag">
                  {CATEGORY_LABELS[audioCategoryOf(selectedId)]}
                </span>
                <h3>{selectedId}</h3>
              </div>
              <span
                className={`sx-audio-mode-badge ${writable ? 'writable' : 'readonly'}`}
                data-testid="audio-writable-badge"
              >
                {writable ? 'DEV WRITABLE' : 'READ-ONLY BUILD'}
              </span>
            </header>

            {/* Transport & Loop Preview Bar */}
            <div className="sx-audio-transport">
              {playingId === selectedId ? (
                <button
                  type="button"
                  className="sx-audio-transport-btn stop"
                  onClick={stopPlayback}
                  data-testid="audio-inspector-stop"
                >
                  &#9632; Stop Preview
                </button>
              ) : (
                <button
                  type="button"
                  className="sx-audio-transport-btn play"
                  onClick={() => void playSound(selectedId)}
                  data-testid="audio-inspector-play"
                >
                  &#9654; Play Preview
                </button>
              )}

              <label className="sx-audio-loop-toggle">
                <input
                  type="checkbox"
                  checked={loopEnabled}
                  onChange={(e) => setLoopEnabled(e.target.checked)}
                  data-testid="audio-loop-checkbox"
                />
                <span>Loop region preview</span>
              </label>

              {activeEntry.rms !== undefined && (
                <span className="sx-audio-rms">
                  Measured RMS: <b>{activeEntry.rms} dB</b>
                </span>
              )}
            </div>

            {playError && (
              <p className="sx-audio-error" role="status">
                {playError}
              </p>
            )}

            {/* Gain Control */}
            <div className="sx-audio-field-group">
              <div className="sx-audio-field-header">
                <label htmlFor="audio-gain-slider">Playback Gain (dB)</label>
                <span className="sx-audio-linear-readout">
                  Linear scale: {(dbToLinear(activeEntry.gain) * 100).toFixed(0)}%
                </span>
              </div>
              <div className="sx-audio-control-row">
                <input
                  id="audio-gain-slider"
                  type="range"
                  min={-30}
                  max={18}
                  step={0.1}
                  disabled={!writable}
                  value={activeEntry.gain}
                  onChange={(e) =>
                    onChange(selectedId, clampAudioPatch({ gain: Number(e.target.value) }))
                  }
                  data-testid="audio-gain-slider"
                />
                <input
                  type="number"
                  step={0.1}
                  min={-36}
                  max={18}
                  disabled={!writable}
                  value={activeEntry.gain}
                  onChange={(e) =>
                    onChange(selectedId, clampAudioPatch({ gain: Number(e.target.value) }))
                  }
                  aria-label="Gain in dB"
                  data-testid="audio-gain-number"
                />
              </div>
            </div>

            {/* Loop Region (Start / End Seconds) */}
            <div className="sx-audio-field-group">
              <div className="sx-audio-field-header">
                <span>Loop Region (seconds)</span>
                <span className="sx-audio-linear-readout">
                  {(activeEntry.loopStart ?? activeEntry.start) !== undefined &&
                  (activeEntry.loopEnd ?? activeEntry.end) !== undefined
                    ? `Active window: ${(
                        (activeEntry.loopEnd ?? activeEntry.end ?? 0) -
                        (activeEntry.loopStart ?? activeEntry.start ?? 0)
                      ).toFixed(2)} s`
                    : 'One-shot (no loop window set)'}
                </span>
              </div>

              <div className="sx-audio-loop-grid">
                <label className="sx-audio-loop-field">
                  <span>Loop Start (s)</span>
                  <input
                    type="number"
                    step={0.01}
                    min={0}
                    disabled={!writable}
                    value={activeEntry.loopStart ?? activeEntry.start ?? 0}
                    onChange={(e) =>
                      onChange(
                        selectedId,
                        clampAudioPatch({ loopStart: Number(e.target.value) })
                      )
                    }
                    data-testid="audio-loop-start"
                  />
                </label>

                <label className="sx-audio-loop-field">
                  <span>Loop End (s)</span>
                  <input
                    type="number"
                    step={0.01}
                    min={0}
                    disabled={!writable}
                    value={activeEntry.loopEnd ?? activeEntry.end ?? 0}
                    onChange={(e) =>
                      onChange(
                        selectedId,
                        clampAudioPatch({ loopEnd: Number(e.target.value) })
                      )
                    }
                    data-testid="audio-loop-end"
                  />
                </label>
              </div>
            </div>
          </div>
        ) : (
          <div className="sx-audio-empty">
            Select a sound from the library on the left to inspect its gain and loop window.
          </div>
        )}
      </section>
    </div>
  );
};

export default AudioTab;
