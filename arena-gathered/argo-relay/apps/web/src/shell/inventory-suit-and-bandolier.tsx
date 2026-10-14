// ============================================================================
// File: apps/web/src/shell/inventory-suit-and-bandolier.tsx
// Plan: Plan 16 (P1-UI-05 Inventory Visor Customizer, .glb/.vrm Dropzone & Bandolier)
// ============================================================================

import React, { useState } from 'react';

export interface InventoryCartridgeItem {
  id: string;
  title: string;
  metric: 'Pxd' | 'Vtx' | 'Lx' | 'Aq' | 'Mix';
  colorHex: string;
  yieldMultiplier: number;
  isEquippedInRifle: boolean;
}

export interface InventorySuitAndBandolierProps {
  commanderName: string;
  visorColorHex: string;
  customAvatarFilename: string | null;
  dirtLabel: string;
  oreLabel: string;
  pocketDirt: number;
  pocketOre: number;
  linkedDepotOre: number;
  salvage: number;
  anomalyCores: number;
  cartridges: InventoryCartridgeItem[];
  onChangeCommanderName: (name: string) => void;
  onChangeVisorColor: (hex: string) => void;
  onDropCustomAvatarFile: (file: File) => void;
  onEquipCartridge: (cartridgeId: string) => void;
  onOpenArchiveGraph: () => void;
  onClose: () => void;
}

const VISOR_PRESET_SWATCHES = [
  '#ffc13d',
  '#3dc8ff',
  '#ff3d8a',
  '#7cff4d',
  '#b46bff',
  '#e8eef5',
];

export const InventorySuitAndBandolierModal: React.FC<InventorySuitAndBandolierProps> = ({
  commanderName,
  visorColorHex,
  customAvatarFilename,
  dirtLabel,
  oreLabel,
  pocketDirt,
  pocketOre,
  linkedDepotOre,
  salvage,
  anomalyCores,
  cartridges,
  onChangeCommanderName,
  onChangeVisorColor,
  onDropCustomAvatarFile,
  onEquipCartridge,
  onOpenArchiveGraph,
  onClose,
}) => {
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && (file.name.endsWith('.glb') || file.name.endsWith('.vrm'))) {
      onDropCustomAvatarFile(file);
    }
  };

  return (
    <div
      className="hud-card"
      style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 'min(1040px, 95vw)',
        maxHeight: '86vh',
        padding: 20,
        zIndex: 42,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        pointerEvents: 'auto',
      }}
    >
      {/* Top Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 10, color: '#ffc13d', fontWeight: 700, letterSpacing: '0.1em' }}>
            HAZMAT RIG &amp; SUBSTRATE LOGISTICS // [TAB]
          </div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>
            Expedition Suit, Cartridge Bandolier &amp; Linked Lattice Depot
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={onOpenArchiveGraph}
            style={{
              padding: '6px 12px',
              background: 'rgba(61, 200, 255, 0.14)',
              border: '1px solid #3dc8ff',
              color: '#e8eef5',
              cursor: 'pointer',
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            [Bridge Archive Node Map]
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '6px 12px',
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.25)',
              color: '#e8eef5',
              cursor: 'pointer',
              fontSize: 11,
            }}
          >
            [Tab / Esc] Close
          </button>
        </div>
      </div>

      {/* 3-Pane Body */}
      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr 290px', gap: 16 }}>
        {/* Left Pane: Scientist Hazmat Rig & Visor Customizer (OWNER_ASKS 2026-10-07) */}
        <div
          style={{
            padding: 14,
            background: 'var(--hud-bg-elevated)',
            border: '1px solid rgba(255,255,255,0.1)',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--hud-text-dim)' }}>
            SCIENTIST HAZMAT RIG
          </div>

          {/* Silhouette Visor Preview */}
          <div
            style={{
              height: 150,
              background: '#050608',
              border: '1px solid rgba(255,255,255,0.12)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <div
              style={{
                width: 64,
                height: 42,
                borderRadius: 8,
                background: visorColorHex,
                boxShadow: `0 0 18px ${visorColorHex}`,
                border: '2px solid #e8eef5',
              }}
            />
            <div style={{ fontSize: 11, fontFamily: 'var(--hud-font-mono)', color: visorColorHex }}>
              VISOR LUMINANCE FLOOR: ACTIVE
            </div>
          </div>

          <label style={{ fontSize: 11, color: 'var(--hud-text-dim)' }}>
            Operator Callsign
            <input
              type="text"
              value={commanderName}
              onChange={(e) => onChangeCommanderName(e.target.value)}
              style={{
                width: '100%',
                marginTop: 4,
                padding: '6px 8px',
                background: '#050608',
                border: '1px solid rgba(255,255,255,0.2)',
                color: '#e8eef5',
                fontFamily: 'var(--hud-font-mono)',
                fontSize: 12,
              }}
            />
          </label>

          <div>
            <div style={{ fontSize: 11, color: 'var(--hud-text-dim)', marginBottom: 6 }}>
              Visor Rim &amp; Fresnel Tint
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {VISOR_PRESET_SWATCHES.map((hex) => (
                <button
                  key={hex}
                  type="button"
                  onClick={() => onChangeVisorColor(hex)}
                  style={{
                    width: 28,
                    height: 24,
                    background: hex,
                    border:
                      visorColorHex.toLowerCase() === hex
                        ? '2px solid #ffffff'
                        : '1px solid rgba(0,0,0,0.6)',
                    cursor: 'pointer',
                  }}
                />
              ))}
            </div>
          </div>

          {/* .glb / .vrm Custom Avatar Dropzone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            style={{
              padding: 10,
              border: `1px dashed ${dragOver ? '#7cff4d' : 'rgba(255,255,255,0.25)'}`,
              background: dragOver ? 'rgba(124,255,77,0.1)' : 'rgba(0,0,0,0.35)',
              textAlign: 'center',
              fontSize: 11,
              color: 'var(--hud-text-dim)',
            }}
          >
            {customAvatarFilename
              ? `Custom Rig: ${customAvatarFilename}`
              : 'Drop custom .glb or .vrm avatar here'}
          </div>
        </div>

        {/* Middle Pane: Color-Coded Cartridge Bandolier (@hm/vault) */}
        <div
          style={{
            padding: 14,
            background: 'var(--hud-bg-elevated)',
            border: '1px solid rgba(255,255,255,0.1)',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            overflowY: 'auto',
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--hud-text-dim)' }}>
            CARTRIDGE BANDOLIER ({cartridges.length} SLOTTED IN VAULT)
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {cartridges.map((c) => (
              <div
                key={c.id}
                onClick={() => onEquipCartridge(c.id)}
                style={{
                  padding: '8px 10px',
                  background: c.isEquippedInRifle
                    ? 'rgba(255, 193, 61, 0.14)'
                    : 'rgba(5, 6, 8, 0.7)',
                  border: `1px solid ${c.isEquippedInRifle ? c.colorHex : 'rgba(255,255,255,0.12)'}`,
                  borderLeft: `4px solid ${c.colorHex}`,
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700 }}>{c.title}</div>
                  <div style={{ fontSize: 10, color: 'var(--hud-text-dim)', fontFamily: 'var(--hud-font-mono)' }}>
                    {c.metric} // {c.yieldMultiplier.toFixed(1)}x Plume Yield
                  </div>
                </div>
                {c.isEquippedInRifle && (
                  <span style={{ fontSize: 10, color: c.colorHex, fontWeight: 700 }}>EQUIPPED</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Right Pane: Linked Lattice Depot (@hm/lattice Dimensional Depot) */}
        <div
          style={{
            padding: 14,
            background: 'var(--hud-bg-elevated)',
            border: '1px solid rgba(255,255,255,0.1)',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--hud-text-dim)' }}>
            LINKED LATTICE DEPOT (@hm/lattice)
          </div>
          <div style={{ padding: 10, background: '#050608', borderLeft: '3px solid #7cff4d' }}>
            <div style={{ fontSize: 11, color: 'var(--hud-text-dim)' }}>{oreLabel} (Pocket + Linked Bin)</div>
            <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--hud-font-mono)' }}>
              {pocketOre} <span style={{ color: '#7cff4d' }}>(+{linkedDepotOre} Linked)</span>
            </div>
          </div>
          <div style={{ padding: 10, background: '#050608', borderLeft: '3px solid #ffc13d' }}>
            <div style={{ fontSize: 11, color: 'var(--hud-text-dim)' }}>Raw {dirtLabel}</div>
            <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--hud-font-mono)' }}>
              {pocketDirt}
            </div>
          </div>
          <div style={{ padding: 10, background: '#050608', borderLeft: '3px solid #3dc8ff' }}>
            <div style={{ fontSize: 11, color: 'var(--hud-text-dim)' }}>Lab Salvage &amp; Anomaly Cores</div>
            <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--hud-font-mono)' }}>
              {salvage} Salvage // {anomalyCores} Cores
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
