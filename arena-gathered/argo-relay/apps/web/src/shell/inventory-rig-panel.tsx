// ============================================================================
// File: apps/web/src/shell/inventory-rig-panel.tsx
// Plan: Plan 16 (P1-UI-05 Inventory & Suit Rig Screen) + Plan 10 (Forensic Logs)
// ============================================================================

import React, { useState } from 'react';

export interface SlottedCartridgeItem {
  id: string;
  name: string;
  metric: 'Pxd' | 'Vtx' | 'Lx' | 'Aq' | 'Mix';
  hexColor: string;
  boostMultiplier: number; // e.g. 2.5x
}

export interface BridgeIncidentLogEntry {
  id: string;
  title: string;
  sourceProp: string;
  body: string;
  unlocked: boolean;
}

export interface InventoryRigPanelProps {
  isOpen: boolean;
  operatorName: string;
  visorColorHex: string;
  customDirtLabel: string;
  pocketDirt: number;
  pocketOre: number;
  linkedDepotOre: number;
  pocketSalvage: number;
  anomalyCores: number;
  cartridges: SlottedCartridgeItem[];
  equippedRifleCartridgeId: string | null;
  logs: BridgeIncidentLogEntry[];
  onChangeOperatorName: (name: string) => void;
  onChangeVisorColor: (hex: string) => void;
  onDropCustomAvatarGlb: (file: File) => void;
  onEquipCartridgeToRifle: (cartridgeId: string) => void;
  onClose: () => void;
}

const VISOR_PRESET_COLORS = ['#ffc13d', '#3dc8ff', '#ff3d8a', '#7cff4d', '#b46bff', '#e8eef5'];

export const InventoryRigPanel: React.FC<InventoryRigPanelProps> = ({
  isOpen,
  operatorName,
  visorColorHex,
  customDirtLabel,
  pocketDirt,
  pocketOre,
  linkedDepotOre,
  pocketSalvage,
  anomalyCores,
  cartridges,
  equippedRifleCartridgeId,
  logs,
  onChangeOperatorName,
  onChangeVisorColor,
  onDropCustomAvatarGlb,
  onEquipCartridgeToRifle,
  onClose,
}) => {
  const [selectedLogId, setSelectedLogId] = useState<string | null>(logs.find((l) => l.unlocked)?.id ?? null);

  if (!isOpen) return null;

  const activeLog = logs.find((l) => l.id === selectedLogId && l.unlocked) ?? null;

  return (
    <div
      className="hud-card"
      style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 'min(980px, calc(100vw - 48px))',
        height: 'min(620px, calc(100vh - 64px))',
        padding: 20,
        display: 'grid',
        gridTemplateColumns: '260px 1fr 310px',
        gap: 16,
        pointerEvents: 'auto',
        zIndex: 35,
      }}
    >
      {/* 1. Left Pane: Armoured Suit Rig, Operator Name, Visor Tint & Custom .GLB/.VRM Dropzone */}
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', borderRight: '1px solid rgba(255,255,255,0.14)', paddingRight: 14 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--hud-font-display)', color: 'var(--hud-accent)' }}>
            ARMOURED SUIT RIG // ASTRO
          </div>

          <div style={{ marginTop: 12 }}>
            <label style={{ fontSize: 11, color: 'var(--hud-text-dim)' }}>
              OPERATOR CALLSIGN
              <input
                type="text"
                value={operatorName}
                onChange={(e) => onChangeOperatorName(e.target.value)}
                style={{
                  width: '100%',
                  marginTop: 4,
                  padding: '6px 8px',
                  background: 'var(--hud-bg-elevated)',
                  color: 'var(--hud-text)',
                  border: '1px solid rgba(255,255,255,0.2)',
                }}
              />
            </label>
          </div>

          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 11, color: 'var(--hud-text-dim)', marginBottom: 6 }}>VISOR OPTICS TINT</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {VISOR_PRESET_COLORS.map((hex) => (
                <button
                  key={hex}
                  type="button"
                  onClick={() => onChangeVisorColor(hex)}
                  style={{
                    width: 26,
                    height: 26,
                    background: hex,
                    border: visorColorHex === hex ? '2px solid #ffffff' : '1px solid #050608',
                    cursor: 'pointer',
                  }}
                />
              ))}
            </div>
          </div>

          {/* Armoured Suit Silhouette Preview Box */}
          <div
            style={{
              marginTop: 16,
              height: 210,
              background: 'rgba(5,6,8,0.65)',
              border: `1px solid ${visorColorHex}`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 12,
              textAlign: 'center',
            }}
          >
            <div style={{ width: 52, height: 28, borderRadius: 4, background: visorColorHex, marginBottom: 10, boxShadow: `0 0 12px ${visorColorHex}` }} />
            <div style={{ fontSize: 12, fontWeight: 700 }}>{operatorName}</div>
            <div style={{ fontSize: 10, color: 'var(--hud-text-dim)', marginTop: 4 }}>
              Meshy.ai Armoured Engineering Suit
            </div>
          </div>
        </div>

        {/* Custom .glb / .vrm Avatar Dropzone */}
        <label
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files?.[0];
            if (f) onDropCustomAvatarGlb(f);
          }}
          style={{
            display: 'block',
            padding: 10,
            border: '1px dashed rgba(255,255,255,0.3)',
            textAlign: 'center',
            fontSize: 11,
            color: 'var(--hud-text-dim)',
            cursor: 'pointer',
          }}
        >
          Drop Custom .GLB / .VRM Avatar
          <input
            type="file"
            accept=".glb,.vrm"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onDropCustomAvatarGlb(f);
            }}
            style={{ display: 'none' }}
          />
        </label>
      </div>

      {/* 2. Center Pane: Linked Lattice Depot Totals & Color-Coded Cartridge Bandolier */}
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--hud-font-display)', color: 'var(--hud-accent)' }}>
            SUBSTRATE &amp; LINKED LATTICE DEPOT (@hm/lattice)
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginTop: 10 }}>
            <div style={{ padding: 8, background: 'var(--hud-bg-elevated)', borderLeft: '3px solid #9aa6b2' }}>
              <div style={{ fontSize: 10, color: 'var(--hud-text-dim)' }}>{customDirtLabel.toUpperCase()}</div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{pocketDirt}</div>
            </div>
            <div style={{ padding: 8, background: 'var(--hud-bg-elevated)', borderLeft: '3px solid #ffc13d' }}>
              <div style={{ fontSize: 10, color: 'var(--hud-text-dim)' }}>ORE (POCKET + BIN)</div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>
                {pocketOre} <span style={{ fontSize: 11, color: '#b46bff' }}>(+{linkedDepotOre})</span>
              </div>
            </div>
            <div style={{ padding: 8, background: 'var(--hud-bg-elevated)', borderLeft: '3px solid #3dc8ff' }}>
              <div style={{ fontSize: 10, color: 'var(--hud-text-dim)' }}>LAB SALVAGE</div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{pocketSalvage}</div>
            </div>
            <div style={{ padding: 8, background: 'var(--hud-bg-elevated)', borderLeft: '3px solid #b46bff' }}>
              <div style={{ fontSize: 10, color: 'var(--hud-text-dim)' }}>ANOMALY CORES</div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{anomalyCores}</div>
            </div>
          </div>

          <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--hud-font-display)', color: 'var(--hud-accent)', marginTop: 18 }}>
            CARTRIDGE BANDOLIER (.SMX // CLICK TO SLOT IN BEAM RIFLE)
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginTop: 10, maxHeight: 310, overflowY: 'auto' }}>
            {cartridges.map((cart) => {
              const isEquipped = equippedRifleCartridgeId === cart.id;
              return (
                <button
                  key={cart.id}
                  type="button"
                  onClick={() => onEquipCartridgeToRifle(cart.id)}
                  style={{
                    padding: '8px 10px',
                    textAlign: 'left',
                    cursor: 'pointer',
                    background: isEquipped ? 'rgba(255,255,255,0.14)' : 'var(--hud-bg-elevated)',
                    border: `1px solid ${isEquipped ? cart.hexColor : 'rgba(255,255,255,0.15)'}`,
                    borderLeft: `4px solid ${cart.hexColor}`,
                    color: 'var(--hud-text)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--hud-text-dim)' }}>
                    <span>{cart.metric} CARTRIDGE</span>
                    <span>{cart.boostMultiplier.toFixed(1)}x YIELD</span>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, marginTop: 2 }}>{cart.name}</div>
                  {isEquipped && (
                    <div style={{ fontSize: 10, color: cart.hexColor, marginTop: 2 }}>[SLOTTED IN RIFLE]</div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onClose}
            style={{ padding: '6px 14px', fontSize: 12, cursor: 'pointer' }}
          >
            [Tab / Esc] Resume Expedition
          </button>
        </div>
      </div>

      {/* 3. Right Pane: Bridge Incident Logs & Lunar Wreck Forensics (TASK-23c / Plan 10) */}
      <div style={{ borderLeft: '1px solid rgba(255,255,255,0.14)', paddingLeft: 14, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--hud-font-display)', color: 'var(--hud-accent)' }}>
            BRIDGE INCIDENT LOGS ({logs.filter((l) => l.unlocked).length}/{logs.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10, maxHeight: 240, overflowY: 'auto' }}>
            {logs.map((log) => (
              <button
                key={log.id}
                type="button"
                disabled={!log.unlocked}
                onClick={() => setSelectedLogId(log.id)}
                style={{
                  padding: '6px 8px',
                  textAlign: 'left',
                  cursor: log.unlocked ? 'pointer' : 'default',
                  opacity: log.unlocked ? 1 : 0.4,
                  background: selectedLogId === log.id ? 'rgba(61, 200, 255, 0.16)' : 'var(--hud-bg-elevated)',
                  border: '1px solid rgba(255,255,255,0.14)',
                  color: 'var(--hud-text)',
                  fontSize: 11,
                }}
              >
                <strong>{log.id}:</strong> {log.unlocked ? log.title : '[ENCRYPTED // SALVAGE PROP TO UNLOCK]'}
              </button>
            ))}
          </div>
        </div>

        <div
          style={{
            padding: 12,
            height: 220,
            background: 'rgba(5,6,8,0.78)',
            border: '1px solid rgba(61,200,255,0.3)',
            fontSize: 12,
            lineHeight: 1.45,
            overflowY: 'auto',
          }}
        >
          {activeLog ? (
            <>
              <div style={{ fontSize: 10, color: '#3dc8ff', marginBottom: 4 }}>
                SOURCE: {activeLog.sourceProp.toUpperCase()}
              </div>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>{activeLog.title}</div>
              <div style={{ color: 'var(--hud-text-dim)' }}>{activeLog.body}</div>
            </>
          ) : (
            <div style={{ color: 'var(--hud-text-dim)' }}>
              Hold [E] on Lab clutter or Lunar Wreck transponders to recover Bridge Array forensic logs.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
