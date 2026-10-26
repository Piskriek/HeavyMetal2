/**
 * @file apps/web/src/studio/inspectors/kit-assembler-panel.tsx
 * ARGO_STUDIO_REALITY_AUDIT_AND_BLUEPRINT.md (Screen 2 & Aspects 4–5, 8):
 * Modular Machine & Kit Assembler (`@hm/kitspec`), 3D Triad Socket Snapping,
 * Live Transform Sliders (`X/Y/Z`, Rotation, Mirror, Rank), and `[+ Add Socket]` Authoring.
 */

import React, { useState } from 'react';
import type { DetailRank } from '@hm/kitspec';
import { GENERATORS } from '@hm/partgen';
import { STUDIO_KIT_LIST } from '../kits/studio-kit-registry';
import { enumerateAssemblySockets, type TriadSocketRole } from '../viewport/socket-gizmos';
import type { StudioState, StudioStore } from '../state/studio-store';

export interface KitAssemblerPanelProps {
  state: StudioState;
  store: StudioStore;
}

const ROLE_BADGE: Record<TriadSocketRole, { label: string; hex: string }> = {
  input: { label: 'INPUT (Red)', hex: '#ff3d8a' },
  output: { label: 'OUTPUT (Blue)', hex: '#3dc8ff' },
  power: { label: 'POWER (Gold)', hex: '#ffc13d' },
  mount: { label: 'MOUNT (Green)', hex: '#7cff4d' },
};

export const KitAssemblerPanel: React.FC<KitAssemblerPanelProps> = ({ state, store }) => {
  const activeEntry = state.kits[state.activeKitId]!;
  const sockets = React.useMemo(
    () => enumerateAssemblySockets(activeEntry.kit, activeEntry.rootPreset),
    [activeEntry],
  );

  const [selectedPinId, setSelectedPinId] = useState<string>(sockets[0]?.pinId ?? '');
  const [selectedPartOrGen, setSelectedPartOrGen] = useState<string>(
    Object.keys(activeEntry.kit.parts)[0] ?? Object.keys(GENERATORS)[0] ?? 'can',
  );
  const [selectedChildIdx, setSelectedChildIdx] = useState<number>(0);
  const [newSocketName, setNewSocketName] = useState<string>('mountAux');
  const [newSocketY, setNewSocketY] = useState<number>(0.5);

  const rootAssembly = activeEntry.kit.assemblies[activeEntry.rootPreset];
  const children = rootAssembly?.children ?? [];
  const safeChildIdx =
    selectedChildIdx >= 0 && selectedChildIdx < children.length ? selectedChildIdx : 0;
  const activePlacement = children[safeChildIdx];
  const issueCount = state.validationIssues.length;

  const handleAddCustomSocket = () => {
    const targetPartId =
      state.activePartId ??
      activePlacement?.ref ??
      Object.keys(activeEntry.kit.parts)[0];
    if (!targetPartId || !newSocketName.trim()) return;
    store.addSocketToPart(targetPartId, newSocketName.trim(), {
      at: [0, newSocketY, 0],
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 14, color: '#e2e8f0' }}>
      {/* Active Campaign Machine / Kit Switcher */}
      <div
        style={{
          background: '#111827',
          border: '1px solid #1e293b',
          borderRadius: 8,
          padding: 12,
        }}
      >
        <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Active Modular Machine Kit (Rule 8a — Zero Legacy GLBs)
        </div>
        <select
          value={state.activeKitId}
          onChange={(e) => {
            store.selectKit(e.target.value);
            setSelectedChildIdx(0);
          }}
          style={{
            width: '100%',
            marginTop: 6,
            padding: '7px 10px',
            borderRadius: 6,
            background: '#0f172a',
            color: '#f8fafc',
            border: '1px solid #334155',
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          {STUDIO_KIT_LIST.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.label} ({entry.id}) — {entry.category}
            </option>
          ))}
        </select>

        {/* Grounding Audit & [⚡ Auto-Snap Grounding] */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 10,
            padding: '6px 10px',
            borderRadius: 6,
            background: issueCount === 0 ? 'rgba(16, 185, 129, 0.14)' : 'rgba(239, 68, 68, 0.16)',
            border: issueCount === 0 ? '1px solid #10b981' : '1px solid #ef4444',
          }}
        >
          <span style={{ fontSize: 11, fontWeight: 700, color: issueCount === 0 ? '#34d399' : '#f87171' }}>
            {issueCount === 0
              ? '✓ 0 Issues — Grounded & PBR Valid'
              : `⚠ ${issueCount} Grounding / Socket Issue(s)`}
          </span>
          <button
            onClick={() => store.autoFixGroundingIssues()}
            style={{
              padding: '4px 10px',
              borderRadius: 5,
              border: 'none',
              background: '#f59e0b',
              color: '#0f172a',
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            ⚡ Auto-Snap Grounding
          </button>
        </div>
      </div>

      {/* Color-Coded 3D Triad Sockets & Snap Part */}
      <div
        style={{
          background: '#111827',
          border: '1px solid #1e293b',
          borderRadius: 8,
          padding: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 700, color: '#cbd5e1' }}>
          Color-Coded 3D Triad Sockets ({sockets.length})
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
          {(['input', 'output', 'power', 'mount'] as TriadSocketRole[]).map((role) => (
            <div
              key={role}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 10,
                color: '#cbd5e1',
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: ROLE_BADGE[role].hex,
                  display: 'inline-block',
                }}
              />
              <span>{ROLE_BADGE[role].label}</span>
            </div>
          ))}
        </div>

        <select
          value={state.activeSocketPinId ?? selectedPinId}
          onChange={(e) => {
            setSelectedPinId(e.target.value);
            store.selectSocketPin(e.target.value || null);
          }}
          style={{
            padding: '5px 8px',
            borderRadius: 4,
            background: '#0f172a',
            color: '#e2e8f0',
            border: '1px solid #334155',
            fontSize: 11,
          }}
        >
          <option value="">-- Pick Target 3D Triad Socket --</option>
          {sockets.map((sock) => (
            <option key={sock.pinId} value={sock.pinId}>
              [{sock.triadRole.toUpperCase()}] {sock.ownerPath || 'root'}.{sock.socketName} (
              {sock.occupiedBy.length > 0 ? 'occupied' : 'free'})
            </option>
          ))}
        </select>

        <div style={{ display: 'flex', gap: 6 }}>
          <select
            value={selectedPartOrGen}
            onChange={(e) => setSelectedPartOrGen(e.target.value)}
            style={{
              flex: 1,
              padding: '5px 8px',
              borderRadius: 4,
              background: '#0f172a',
              color: '#e2e8f0',
              border: '1px solid #334155',
              fontSize: 11,
            }}
          >
            {Object.keys(activeEntry.kit.parts).map((p) => (
              <option key={p} value={p}>
                Kit Part: {p} (
                {activeEntry.kit.parts[p]?.source.kind === 'param'
                  ? activeEntry.kit.parts[p]?.source.gen
                  : activeEntry.kit.parts[p]?.source.kind}
                )
              </option>
            ))}
            {Object.keys(GENERATORS).map((g) => (
              <option key={`gen:${g}`} value={g}>
                @hm/partgen: {g}
              </option>
            ))}
          </select>
          <button
            onClick={() => {
              const targetPinId = state.activeSocketPinId ?? selectedPinId;
              const sock = sockets.find((s) => s.pinId === targetPinId) ?? sockets[0];
              if (sock && selectedPartOrGen) {
                store.attachPartToSocket(
                  Math.max(0, sock.childIndex),
                  sock.socketName,
                  selectedPartOrGen,
                );
              }
            }}
            style={{
              padding: '5px 12px',
              borderRadius: 4,
              border: 'none',
              background: '#0284c7',
              color: '#fff',
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            + Snap Part
          </button>
        </div>

        {/* [+ Add Socket] Authoring Bar */}
        <div
          style={{
            display: 'flex',
            gap: 6,
            marginTop: 4,
            paddingTop: 6,
            borderTop: '1px solid #1e293b',
            alignItems: 'center',
          }}
        >
          <input
            type="text"
            value={newSocketName}
            onChange={(e) => setNewSocketName(e.target.value)}
            placeholder="Socket name (e.g. feedIn)"
            style={{
              flex: 1,
              padding: '4px 6px',
              borderRadius: 4,
              background: '#0f172a',
              color: '#fff',
              border: '1px solid #334155',
              fontSize: 10,
            }}
          />
          <input
            type="number"
            step={0.1}
            value={newSocketY}
            onChange={(e) => setNewSocketY(parseFloat(e.target.value) || 0)}
            title="Socket Y height (m)"
            style={{
              width: 54,
              padding: '4px 6px',
              borderRadius: 4,
              background: '#0f172a',
              color: '#fff',
              border: '1px solid #334155',
              fontSize: 10,
            }}
          />
          <button
            onClick={handleAddCustomSocket}
            style={{
              padding: '4px 8px',
              borderRadius: 4,
              border: '1px solid #10b981',
              background: 'rgba(16, 185, 129, 0.16)',
              color: '#6ee7b7',
              fontSize: 10,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            + Add Socket
          </button>
        </div>
      </div>

      {/* Selected Placement 3D Transform Sliders (Updates 3D Viewport Live!) */}
      {activePlacement && (
        <div
          style={{
            background: '#111827',
            border: '1px solid #38bdf8',
            borderRadius: 8,
            padding: 12,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#38bdf8' }}>
              Transform: #{safeChildIdx + 1} {activePlacement.key ?? activePlacement.ref}
            </span>
            <select
              value={activePlacement.mirror ?? 'none'}
              onChange={(e) => {
                const v = e.target.value;
                store.updatePlacement(safeChildIdx, {
                  mirror: v === 'none' ? undefined : (v as 'x' | 'z'),
                });
              }}
              style={{
                padding: '2px 6px',
                borderRadius: 4,
                background: '#0f172a',
                color: '#e2e8f0',
                border: '1px solid #334155',
                fontSize: 10,
              }}
            >
              <option value="none">Mirror: None</option>
              <option value="x">Mirror X (Left/Right)</option>
              <option value="z">Mirror Z (Front/Back)</option>
            </select>
          </div>

          {(['X (Right)', 'Y (Height)', 'Z (Forward)'] as const).map((label, axisIdx) => {
            const curAt: [number, number, number] = [
              activePlacement.at?.[0] ?? 0,
              activePlacement.at?.[1] ?? 0,
              activePlacement.at?.[2] ?? 0,
            ];
            return (
              <label
                key={label}
                style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 10 }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>{label}</span>
                  <span style={{ color: '#38bdf8' }}>{curAt[axisIdx]!.toFixed(3)} m</span>
                </div>
                <input
                  type="range"
                  min={-2.5}
                  max={2.5}
                  step={0.01}
                  value={curAt[axisIdx]!}
                  onChange={(e) => {
                    const nextAt: [number, number, number] = [...curAt];
                    nextAt[axisIdx] = parseFloat(e.target.value);
                    store.updatePlacement(safeChildIdx, { at: nextAt });
                  }}
                />
              </label>
            );
          })}

          <div style={{ display: 'flex', gap: 4, alignItems: 'center', fontSize: 10 }}>
            <span style={{ color: '#94a3b8' }}>Quick Rotate Y:</span>
            {[-90, 0, 90, 180].map((deg) => (
              <button
                key={deg}
                onClick={() => {
                  const curRot = activePlacement.rot ?? [0, 0, 0];
                  store.updatePlacement(safeChildIdx, {
                    rot: [curRot[0], deg, curRot[2]],
                  });
                }}
                style={{
                  padding: '2px 6px',
                  borderRadius: 4,
                  background: '#162032',
                  color: '#cbd5e1',
                  border: '1px solid #334155',
                  fontSize: 10,
                  cursor: 'pointer',
                }}
              >
                {deg}°
              </button>
            ))}
            <select
              value={activePlacement.rank ?? 0}
              onChange={(e) =>
                store.updatePlacement(safeChildIdx, {
                  rank: parseInt(e.target.value, 10) as DetailRank,
                })
              }
              style={{
                marginLeft: 'auto',
                padding: '2px 6px',
                borderRadius: 4,
                background: '#0f172a',
                color: '#38bdf8',
                border: '1px solid #334155',
                fontSize: 10,
              }}
            >
              <option value={0}>Rank 0</option>
              <option value={1}>Rank 1</option>
              <option value={2}>Rank 2</option>
            </select>
          </div>
        </div>
      )}

      {/* Placed Parts Hierarchy */}
      <div
        style={{
          background: '#111827',
          border: '1px solid #1e293b',
          borderRadius: 8,
          padding: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          maxHeight: 240,
          overflowY: 'auto',
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 700, color: '#cbd5e1' }}>
          Assembly Placements ({children.length} children)
        </div>
        {children.map((pl, idx) => {
          const key = pl.key ?? `${pl.ref}#${idx}`;
          const isSelected = idx === safeChildIdx || state.activePartPath === key;
          return (
            <div
              key={`${key}-${idx}`}
              onClick={() => {
                setSelectedChildIdx(idx);
                store.selectPartAndSlot(key, pl.ref, state.activeSlotKey);
              }}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '5px 8px',
                borderRadius: 4,
                background: isSelected ? 'rgba(56, 189, 248, 0.18)' : '#161f2e',
                border: isSelected ? '1px solid #38bdf8' : '1px solid #243046',
                cursor: 'pointer',
                fontSize: 11,
              }}
            >
              <div>
                <strong style={{ color: isSelected ? '#38bdf8' : '#f1f5f9' }}>
                  #{idx + 1} {key}
                </strong>
                <span style={{ color: '#94a3b8', marginLeft: 6 }}>({pl.ref})</span>
                {pl.on && (
                  <div style={{ fontSize: 9, color: '#64748b' }}>
                    ↳ attached to child #{pl.on.child + 1} socket &quot;{pl.on.socket}&quot;
                  </div>
                )}
              </div>
              {idx > 0 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    store.removePlacement(idx);
                  }}
                  style={{
                    background: 'transparent',
                    border: '1px solid #475569',
                    color: '#f87171',
                    borderRadius: 4,
                    fontSize: 10,
                    padding: '1px 6px',
                    cursor: 'pointer',
                  }}
                >
                  ×
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
