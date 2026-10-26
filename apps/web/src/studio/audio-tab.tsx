import React from 'react';
import type { StudioState, StudioStore } from './state/studio-store';

export interface AudioTabProps {
  state: StudioState;
  store: StudioStore;
}

const CANONICAL_STEMS = [
  { id: 'stem:mill-motor', label: 'Texture Mill Motor Hum', stage: 0 },
  { id: 'stem:stargate-kawoosh', label: 'Stargate Vortex & Chevron Lock', stage: 0 },
  { id: 'stem:capacitor-arc', label: 'Capacitor Bank Harmonic Drone', stage: 1 },
  { id: 'stem:wind-frost', label: 'Crater Rim Frost Wind', stage: 2 },
  { id: 'stem:meltwater-trickle', label: 'Meltwater Basin Trickle', stage: 3 },
  { id: 'stem:biosphere-chorus', label: 'S6 Living Canopy Harmonics', stage: 6 },
];

export const AudioTab: React.FC<AudioTabProps> = ({ state, store }) => {
  return (
    <div style={{ padding: 20, background: '#090d16', color: '#e2e8f0', height: '100%', overflowY: 'auto' }}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase' }}>
          @hm/soundlab &amp; @hm/musicbox — Procedural Synth Stem Workshop
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#38bdf8' }}>
          Stage-Quantized Audio Ladder (S0 Vacuum Drone → S6 Living Biosphere)
        </div>
      </div>

      <div
        style={{
          padding: 14,
          borderRadius: 8,
          background: '#111827',
          border: '1px solid #1e293b',
          display: 'flex',
          gap: 18,
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, flex: 1 }}>
          <span>Audition Terraforming Stage: S{state.audioAuditionStage}</span>
          <input
            type="range"
            min={0}
            max={6}
            step={1}
            value={state.audioAuditionStage}
            onChange={(e) =>
              store.setAudioAuditionStage(parseInt(e.target.value, 10) as 0 | 1 | 2 | 3 | 4 | 5 | 6)
            }
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, flex: 1 }}>
          <span>Machine Motor RPM: {state.audioMotorRpm} RPM</span>
          <input
            type="range"
            min={60}
            max={3600}
            step={10}
            value={state.audioMotorRpm}
            onChange={(e) => store.setAudioMotorRpm(parseInt(e.target.value, 10))}
          />
        </label>

        <button
          onClick={() => store.setAudioBitCrushEnabled(!state.audioBitCrushEnabled)}
          style={{
            padding: '8px 14px',
            borderRadius: 6,
            border: '1px solid #38bdf8',
            background: state.audioBitCrushEnabled ? '#0284c7' : '#0f172a',
            color: '#fff',
            fontSize: 11,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          12-Bit Crunch: {state.audioBitCrushEnabled ? 'ON' : 'OFF'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
        {CANONICAL_STEMS.map((stem) => {
          const active = state.audioSelectedStemId === stem.id;
          return (
            <div
              key={stem.id}
              onClick={() => store.setAudioStem(stem.id)}
              style={{
                padding: 14,
                borderRadius: 8,
                background: active ? 'rgba(56, 189, 248, 0.14)' : '#111827',
                border: active ? '1.5px solid #38bdf8' : '1px solid #1e293b',
                cursor: 'pointer',
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc' }}>{stem.label}</div>
              <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 4 }}>
                ID: {stem.id} | Unlocks at Stage S{stem.stage}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
