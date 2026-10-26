/**
 * @file apps/web/src/studio/modals/spore-card-modal.tsx
 * ARGO_STUDIO_REALITY_AUDIT_AND_BLUEPRINT.md (Screen 9 & Aspect 13):
 * Renders a 512x512 Collectible Spore Card Beauty Portrait (`<canvas>`) with metallic border,
 * 3D isometric machine/planet render, Four Floats bars, Stargate dialing glyph (`SG-XXXX-XX`),
 * lossless RFC-2083 PNG `zTXt` download, AND drag-and-drop / file-picker PNG import!
 */

import React, { useEffect, useRef, useState } from 'react';
import type { StudioState, StudioStore } from '../state/studio-store';

export interface SporeCardModalProps {
  state: StudioState;
  store: StudioStore;
  onClose: () => void;
}

export const SporeCardModal: React.FC<SporeCardModalProps> = ({ state, store, onClose }) => {
  const cardCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const exported = React.useMemo(
    () => store.exportSporeCard('world'),
    [store, state.activeWorldId, state.activeKitId],
  );
  const [statusMsg, setStatusMsg] = useState<string>(
    `Encoded ${exported.pngBytes.byteLength} bytes RFC-2083 PNG with lossless zTXt payload (${exported.payload.dialingAddress}).`,
  );

  const activeWorld = state.worlds[state.activeWorldId]!;
  const activeEntry = state.kits[state.activeKitId]!;

  // Render the Collectible 512x512 Spore Trading Card onto the Canvas
  useEffect(() => {
    const canvas = cardCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    // 1. Metallic Card Frame & Deep Space Background
    const bgGrad = ctx.createLinearGradient(0, 0, w, h);
    bgGrad.addColorStop(0, '#0f172a');
    bgGrad.addColorStop(0.5, '#1e1b4b');
    bgGrad.addColorStop(1, '#090d16');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Outer Holographic Border
    ctx.strokeStyle = '#a855f7';
    ctx.lineWidth = 6;
    ctx.strokeRect(8, 8, w - 16, h - 16);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(16, 16, w - 32, h - 32);

    // 2. Top Header Banner: Title & Stargate Dialing Address
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText(exported.payload.title, 28, 46);

    ctx.fillStyle = '#c084fc';
    ctx.font = 'bold 13px monospace';
    ctx.fillText(`DIAL: ${exported.payload.dialingAddress}`, w - 168, 44);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '12px sans-serif';
    ctx.fillText(
      `Biome: ${activeWorld.biome.toUpperCase()} | Seed: #${activeWorld.seed} | Kit: ${activeEntry.label}`,
      28,
      68,
    );

    // 3. Center 3D Beauty Portrait Window (Planet Sphere + Stargate Ring + Modular Machine Silhouette)
    const vpX = 28;
    const vpY = 82;
    const vpW = w - 56;
    const vpH = 240;
    const vpGrad = ctx.createRadialGradient(
      vpX + vpW * 0.5,
      vpY + vpH * 0.45,
      16,
      vpX + vpW * 0.5,
      vpY + vpH * 0.5,
      vpW * 0.6,
    );
    vpGrad.addColorStop(0, '#1e3a5f');
    vpGrad.addColorStop(1, '#050811');
    ctx.fillStyle = vpGrad;
    ctx.fillRect(vpX, vpY, vpW, vpH);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.strokeRect(vpX, vpY, vpW, vpH);

    // Planet Horizon Arc & Stargate Portal Ring
    const cx = vpX + vpW * 0.5;
    const cy = vpY + vpH * 0.54;
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cx, cy - 12, 62, 0, Math.PI * 2);
    ctx.stroke();

    const portalGrad = ctx.createRadialGradient(cx, cy - 12, 4, cx, cy - 12, 58);
    portalGrad.addColorStop(0, 'rgba(56, 189, 248, 0.85)');
    portalGrad.addColorStop(1, 'rgba(168, 85, 247, 0.15)');
    ctx.fillStyle = portalGrad;
    ctx.beginPath();
    ctx.arc(cx, cy - 12, 58, 0, Math.PI * 2);
    ctx.fill();

    // Isometric Machine Plinth & Silhouette in Foreground
    ctx.fillStyle = '#334155';
    ctx.fillRect(cx - 72, cy + 44, 144, 18);
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(cx - 48, cy - 28, 96, 72);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.strokeRect(cx - 48, cy - 28, 96, 72);

    // 4. Four Floats S = (Pxd, Vtx, Lx, Aq) Telemetry Bars
    const floatBars: Array<{ key: string; val: number; hex: string }> = [
      { key: 'PXD (Texture)', val: activeWorld.floats.pxd, hex: '#ff3d8a' },
      { key: 'VTX (Geometry)', val: activeWorld.floats.vtx, hex: '#7cff4d' },
      { key: 'LX (Lighting)', val: activeWorld.floats.lx, hex: '#ffc13d' },
      { key: 'AQ (Hydrology)', val: activeWorld.floats.aq, hex: '#3dc8ff' },
    ];

    floatBars.forEach((fb, idx) => {
      const by = 342 + idx * 32;
      ctx.fillStyle = '#cbd5e1';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText(`${fb.key}: ${fb.val}%`, 28, by + 12);

      ctx.fillStyle = '#1e293b';
      ctx.fillRect(145, by, 230, 14);
      ctx.fillStyle = fb.hex;
      ctx.fillRect(145, by, (230 * Math.max(0, Math.min(100, fb.val))) / 100, 14);
    });

    // 5. Deterministic 6x6 Stargate Glyph Matrix on Bottom-Right
    const gx0 = w - 108;
    const gy0 = 342;
    const cell = 12;
    const addr = exported.payload.dialingAddress;
    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < 6; c++) {
        const chCode = addr.charCodeAt((r * 6 + c) % addr.length) || 65;
        const on = ((chCode + r * 3 + c * 7) & 1) === 1;
        ctx.fillStyle = on ? '#c084fc' : '#1e293b';
        ctx.fillRect(gx0 + c * (cell + 2), gy0 + r * (cell + 2), cell, cell);
      }
    }

    // 6. Footer Signature
    ctx.fillStyle = '#64748b';
    ctx.font = '11px monospace';
    ctx.fillText(
      `FIDELITY SPORE CARD // LOSSLESS PNG zTXt // ${activeWorld.placements.length} MACHINES`,
      28,
      h - 24,
    );
  }, [exported, activeWorld, activeEntry]);

  const handleDownloadPng = () => {
    const blob = new Blob([exported.pngBytes.buffer as ArrayBuffer], { type: 'image/png' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${state.activeWorldId}-${exported.payload.dialingAddress}.spore.png`;
    a.click();
    URL.revokeObjectURL(url);
    setStatusMsg(
      `Downloaded collectible Spore Card ${a.download} (${exported.payload.dialingAddress})`,
    );
  };

  const handleImportPngFile = async (file: File) => {
    const buf = await file.arrayBuffer();
    const decoded = store.importSporeCard(new Uint8Array(buf));
    if (decoded) {
      setStatusMsg(
        `✓ Unpacked Spore Card "${decoded.title}" (Dial: ${decoded.dialingAddress}) into Studio!`,
      );
    } else {
      setStatusMsg('⚠ Selected PNG does not contain a fidelity.spore zTXt chunk.');
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(5, 8, 15, 0.86)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          width: 560,
          maxHeight: '92vh',
          background: '#0f172a',
          border: '1px solid #a855f7',
          borderRadius: 12,
          padding: 20,
          color: '#f8fafc',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#c084fc' }}>
            Collectible Spore Card (@hm/cartlab Lossless PNG zTXt)
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

        {/* Visual Collectible Card Canvas */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <canvas
            ref={cardCanvasRef}
            data-testid="spore-card-beauty-canvas"
            width={512}
            height={512}
            style={{
              width: 380,
              height: 380,
              borderRadius: 10,
              boxShadow: '0 12px 32px rgba(0,0,0,0.65)',
            }}
          />
        </div>

        {/* Drag-and-Drop / File Picker Import Zone */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files?.[0];
            if (f) void handleImportPngFile(f);
          }}
          onClick={() => fileInputRef.current?.click()}
          style={{
            padding: '10px 14px',
            borderRadius: 8,
            border: '1.5px dashed #38bdf8',
            background: 'rgba(56, 189, 248, 0.08)',
            textAlign: 'center',
            fontSize: 11,
            color: '#bae6fd',
            cursor: 'pointer',
          }}
        >
          📥 Drop an external <code>.spore.png</code> card here or click to Import &amp; Unpack World
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleImportPngFile(f);
            }}
            style={{ display: 'none' }}
          />
        </div>

        <div style={{ fontSize: 11, color: '#34d399' }}>{statusMsg}</div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            onClick={onClose}
            style={{
              padding: '7px 14px',
              borderRadius: 6,
              background: 'transparent',
              border: '1px solid #475569',
              color: '#cbd5e1',
              cursor: 'pointer',
            }}
          >
            Close
          </button>
          <button
            onClick={handleDownloadPng}
            style={{
              padding: '7px 16px',
              borderRadius: 6,
              background: '#9333ea',
              border: 'none',
              color: '#fff',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            ⬇ Download Spore Card (.png)
          </button>
        </div>
      </div>
    </div>
  );
};
