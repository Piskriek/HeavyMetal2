// ============================================================================
// File: apps/web/src/studio/audio-tab.tsx
// TICKET-08a (OPUS_NOTE_13 Item C — STUDIO-01):
// Studio Audio workspace tab listing every sound in public/audio/levels.json
// with Play, Stop, Loop preview, Gain (dB), and Loop region (loopStart/loopEnd),
// read-only in the built game and editable in dev.
// ============================================================================

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import './audio-tab.css';
import {
  audioCategoryOf,
  clampAudioPatch,
  dbToLinear,
  normalizeAudioLevels,
  CATEGORY_LABELS,
  type AudioCategory,
  type AudioLevelEntry,
  type AudioLevels,
  type AudioPatch,
} from './audio-tab-data';

export {
  audioCategoryOf,
  clampAudioPatch,
  dbToLinear,
  normalizeAudioLevels,
  CATEGORY_LABELS,
  type AudioCategory,
  type AudioLevelEntry,
  type AudioLevels,
  type AudioPatch,
};

export interface AudioTabProps {
  readonly levels: AudioLevels;
  readonly writable: boolean;
  readonly onChange: (id: string, patch: AudioPatch) => void;
}

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
                      className="sx-audio-btn is-stop"
                      onClick={stopPlayback}
                      data-testid={`audio-stop-${id}`}
                    >
                      Stop
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="sx-audio-btn is-play"
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
                {writable ? 'DEV, IN MEMORY' : 'READ-ONLY BUILD'}
              </span>
            </header>

            {/* Transport & Loop Preview Bar */}
            <div className="sx-audio-transport">
              {playingId === selectedId ? (
                <button
                  type="button"
                  className="sx-audio-transport-btn is-stop"
                  onClick={stopPlayback}
                  data-testid="audio-inspector-stop"
                >
                  &#9632; Stop Preview
                </button>
              ) : (
                <button
                  type="button"
                  className="sx-audio-transport-btn is-play"
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
