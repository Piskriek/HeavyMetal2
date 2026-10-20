// ============================================================================
// File: apps/web/src/shell/diegetic-radio-tuner-widget.tsx
// TASK-34 / TICKET-15: 85.2 MHz Bridge FM Cassette Deck & Harmonic Convergence Matrix
// - Displays 144 BPM lock, T09a bus assignment ('music' / 'world' / 'combatUi'),
//   4-machine stem matrix, wreck cassette selector (TAPE #01..#04), SSTV banner,
//   and [V] Turbo Bass button
// ============================================================================

import React from 'react';
import {
  COLLECTIBLE_MUSIC_TAPES,
  type RadioArrangementStyle,
  type RadioTargetBus,
} from '../../../../packages/content/src/diegetic-radio-and-tapes';
import {
  SETMIX_SONG_BPM,
  type ChoirTargetBus,
  type MachineStemRole,
} from '../../../../packages/musicbox/src/harmonic-machine-choir';
import { TURBO_BASS_BUS } from '../../../../packages/tooljuice/src/beat-synced-plume-and-turbobass';

export interface DiegeticRadioTunerWidgetProps {
  readonly activeTapeId: string;
  readonly unlockedTapeIds: readonly string[];
  readonly arrangement: RadioArrangementStyle;
  readonly stemGains: Readonly<Record<MachineStemRole, number>>;
  readonly isHarmonicConvergenceLocked: boolean;
  readonly downbeatPulse0to1: number;
  readonly radioBus?: RadioTargetBus;
  readonly choirBus?: ChoirTargetBus;
  readonly decodedMessage?: string | null;
  readonly onSelectTape: (tapeId: string) => void;
  readonly onTriggerTurboBass: () => void;
}

const STEM_BADGES: ReadonlyArray<{ readonly role: MachineStemRole; readonly label: string; readonly color: string }> = [
  { role: 'shape-press-bass', label: 'VTX BASS', color: '#7cff4d' },
  { role: 'texture-mill-arp', label: 'PXD ARP', color: '#ff3d8a' },
  { role: 'light-projector-pad', label: 'LX PAD', color: '#ffc13d' },
  { role: 'water-maker-lead', label: 'AQ LEAD', color: '#3dc8ff' },
];

export const DiegeticRadioTunerWidget: React.FC<DiegeticRadioTunerWidgetProps> = ({
  activeTapeId,
  unlockedTapeIds,
  arrangement,
  stemGains,
  isHarmonicConvergenceLocked,
  downbeatPulse0to1,
  radioBus = 'music',
  choirBus = isHarmonicConvergenceLocked ? 'music' : 'world',
  decodedMessage = null,
  onSelectTape,
  onTriggerTurboBass,
}) => {
  const currentTape =
    COLLECTIBLE_MUSIC_TAPES.find((t) => t.id === activeTapeId) ??
    COLLECTIBLE_MUSIC_TAPES[0]!;

  return (
    <div
      className="hud-card"
      data-bus-radio={radioBus}
      data-bus-choir={choirBus}
      data-bus-turbobass={TURBO_BASS_BUS}
      style={{
        padding: '10px 12px',
        width: 276,
        borderLeft: `3px solid ${isHarmonicConvergenceLocked ? '#b46bff' : '#ffc13d'}`,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        pointerEvents: 'auto',
      }}
    >
      {/* Header Frequency, 144 BPM Lock & Stage Arrangement Badge */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: '#ffc13d',
            fontFamily: 'var(--hud-font-mono)',
          }}
        >
          {currentTape.frequencyMhz} // BRIDGE FM ({SETMIX_SONG_BPM} BPM)
        </span>
        <span
          style={{
            fontSize: 9,
            padding: '2px 5px',
            background: 'rgba(255,255,255,0.08)',
            color: 'var(--hud-text-dim)',
            fontFamily: 'var(--hud-font-mono)',
          }}
        >
          {arrangement.toUpperCase()}
        </span>
      </div>

      {/* Active Cassette Title */}
      <div style={{ fontSize: 11, fontWeight: 700, color: '#e8eef5' }}>
        {currentTape.title}
      </div>

      {/* 4-Machine Harmonic Convergence Stem Matrix */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
        {STEM_BADGES.map((b) => {
          const active = (stemGains[b.role] ?? 0) > 0.1;
          return (
            <div
              key={b.role}
              style={{
                padding: '4px 2px',
                textAlign: 'center',
                fontSize: 9,
                fontFamily: 'var(--hud-font-mono)',
                background: active ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.4)',
                borderBottom: `2px solid ${active ? b.color : 'rgba(255,255,255,0.1)'}`,
                color: active ? b.color : 'var(--hud-text-dim)',
                transform: active
                  ? `scale(${(1 + downbeatPulse0to1 * 0.06).toFixed(3)})`
                  : 'none',
              }}
            >
              {b.label}
            </div>
          );
        })}
      </div>

      {isHarmonicConvergenceLocked && (
        <div
          style={{
            fontSize: 10,
            color: '#b46bff',
            fontWeight: 700,
            textAlign: 'center',
            letterSpacing: '0.06em',
          }}
        >
          HARMONIC CONVERGENCE LOCKED (4/4 STEMS @ {SETMIX_SONG_BPM} BPM)
        </div>
      )}

      {decodedMessage && (
        <div
          style={{
            fontSize: 9,
            color: '#3dc8ff',
            background: 'rgba(61, 200, 255, 0.12)',
            border: '1px solid rgba(61, 200, 255, 0.4)',
            padding: '4px 6px',
            fontFamily: 'var(--hud-font-mono)',
          }}
        >
          {decodedMessage}
        </div>
      )}

      {/* Tape Selector & [V] Turbo Bass Button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
        <select
          value={activeTapeId}
          onChange={(e) => onSelectTape(e.target.value)}
          style={{
            flex: 1,
            background: '#050608',
            color: '#e8eef5',
            border: '1px solid rgba(255,255,255,0.2)',
            fontSize: 10,
            padding: '4px 6px',
          }}
        >
          {COLLECTIBLE_MUSIC_TAPES.filter((t) => unlockedTapeIds.includes(t.id)).map(
            (t) => (
              <option key={t.id} value={t.id}>
                {t.frequencyMhz} - {t.title.slice(0, 22)}...
              </option>
            ),
          )}
        </select>
        <button
          type="button"
          onClick={onTriggerTurboBass}
          style={{
            padding: '4px 8px',
            background: 'rgba(255, 61, 138, 0.18)',
            border: '1px solid #ff3d8a',
            color: '#e8eef5',
            fontSize: 10,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          [V] Bass Pulse
        </button>
      </div>
    </div>
  );
};
