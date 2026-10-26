import React, { useState } from 'react';
import type { StudioState, StudioStore } from '../state/studio-store';

export interface SporeCardModalProps {
  state: StudioState;
  store: StudioStore;
  onClose: () => void;
}

export const SporeCardModal: React.FC<SporeCardModalProps> = ({ state, store, onClose }) => {
  const exported = React.useMemo(() => store.exportSporeCard('world'), [store, state.activeWorldId]);
  const [statusMsg, setStatusMsg] = useState<string>(
    `Encoded ${exported.pngBytes.byteLength} bytes RFC-2083 PNG with lossless zTXt payload.`
  );

  const handleDownloadPng = () => {
    const blob = new Blob([exported.pngBytes.buffer as ArrayBuffer], { type: 'image/png' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${state.activeWorldId}-${exported.payload.dialingAddress}.spore.png`;
    a.click();
    URL.revokeObjectURL(url);
    setStatusMsg(`Downloaded ${a.download} (${exported.payload.dialingAddress})`);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(5, 8, 15, 0.85)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          width: 480,
          background: '#0f172a',
          border: '1px solid #a855f7',
          borderRadius: 10,
          padding: 20,
          color: '#f8fafc',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#c084fc' }}>
            Spore Card PNG (@hm/cartlab Lossless zTXt)
          </div>
          <span
            style={{
              padding: '3px 10px',
              borderRadius: 999,
              background: 'rgba(168, 85, 247, 0.2)',
              border: '1px solid #a855f7',
              fontSize: 11,
              fontWeight: 700,
              color: '#e9d5ff',
            }}
          >
            Dial: {exported.payload.dialingAddress}
          </span>
        </div>

        <div style={{ fontSize: 11, color: '#cbd5e1', lineHeight: 1.5 }}>
          Your active machine (<strong>{state.activeKitId}</strong>) and planet cartridge (
          <strong>{exported.payload.title}</strong>) are embedded losslessly inside the PNG{' '}
          <code>zTXt</code> chunk (keyword <code>fidelity.spore</code>) alongside Stargate address{' '}
          <strong>{exported.payload.dialingAddress}</strong>.
        </div>

        <div
          style={{
            padding: 10,
            borderRadius: 6,
            background: '#1e293b',
            fontSize: 10,
            fontFamily: 'monospace',
            color: '#93c5fd',
            maxHeight: 140,
            overflowY: 'auto',
          }}
        >
          {JSON.stringify(exported.payload, null, 2)}
        </div>

        <div style={{ fontSize: 11, color: '#34d399' }}>{statusMsg}</div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            onClick={onClose}
            style={{ padding: '7px 14px', borderRadius: 6, background: 'transparent', border: '1px solid #475569', color: '#cbd5e1', cursor: 'pointer' }}
          >
            Close
          </button>
          <button
            onClick={handleDownloadPng}
            style={{ padding: '7px 16px', borderRadius: 6, background: '#9333ea', border: 'none', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
          >
            ⬇ Download Spore Card (.png)
          </button>
        </div>
      </div>
    </div>
  );
};
