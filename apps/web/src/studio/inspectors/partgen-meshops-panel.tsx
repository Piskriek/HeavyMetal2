/**
 * @file apps/web/src/studio/inspectors/partgen-meshops-panel.tsx
 * ARGO_STUDIO_REALITY_AUDIT_AND_BLUEPRINT.md (Screen 4 & Aspect 1):
 * Parametric Part Generator (`@hm/partgen`) + Interactive `@hm/meshops` Operator Stack.
 */

import React, { useState } from 'react';
import type { OpRef } from '@hm/kitspec';
import { GENERATORS, resolveParams } from '@hm/partgen';
import {
  QUICK_MESHOP_PRESETS,
  type QuickMeshOpPreset,
  type StudioState,
  type StudioStore,
} from '../state/studio-store';

export interface PartGenMeshOpsPanelProps {
  state: StudioState;
  store: StudioStore;
}

const MESHOP_CATALOG: Array<{
  op: string;
  label: string;
  defaultParams: Record<string, number>;
}> = [
  { op: 'chamfer-hard-edges', label: '45° Edge Chamfer', defaultParams: { width: 0.02, angleDeg: 35 } },
  { op: 'smooth-taubin', label: 'Taubin Smooth', defaultParams: { iterations: 4, lambda: 0.5, mu: -0.53 } },
  { op: 'inset-outset-faces', label: 'Recessed Panel Seam', defaultParams: { margin: 0.03, depth: -0.015 } },
  { op: 'taper-flare', label: 'Funnel Taper / Flare', defaultParams: { topScale: 1.25, bottomScale: 0.85, bulge: 0.0 } },
  { op: 'extender-mid-slice', label: 'Stretch Span Slice', defaultParams: { axis: 1, deltaM: 0.25 } },
  { op: 'surface-edge-wear-ao', label: 'Edge Wear Bevel', defaultParams: { bandWidthM: 0.025, cavityWidthM: 0.035 } },
  { op: 'bend-arc', label: 'Cylindrical Arc Bend', defaultParams: { angleDeg: 25 } },
  { op: 'twist-helix', label: 'Helical Y-Axis Twist', defaultParams: { angleDeg: 35 } },
];

export const PartGenMeshOpsPanel: React.FC<PartGenMeshOpsPanelProps> = ({ state, store }) => {
  const activeEntry = state.kits[state.activeKitId]!;
  const partIds = Object.keys(activeEntry.kit.parts);
  const selectedPartId =
    state.activePartId && activeEntry.kit.parts[state.activePartId]
      ? state.activePartId
      : partIds[0]!;
  const partDef = activeEntry.kit.parts[selectedPartId];
  const paramSource = partDef?.source.kind === 'param' ? partDef.source : null;
  const genDef = paramSource ? GENERATORS[paramSource.gen] : undefined;
  const resolvedParams =
    genDef && paramSource ? resolveParams(genDef.params, paramSource.params ?? {}) : {};
  const activeOps: readonly OpRef[] = paramSource?.ops ?? [];

  const [opToAdd, setOpToAdd] = useState<string>(MESHOP_CATALOG[0]!.op);

  const handleAddMeshOp = () => {
    const entry = MESHOP_CATALOG.find((m) => m.op === opToAdd) ?? MESHOP_CATALOG[0]!;
    const nextOps: OpRef[] = [
      ...activeOps,
      { op: entry.op, params: { ...entry.defaultParams } },
    ];
    store.setPartMeshOps(selectedPartId, nextOps);
  };

  const handleUpdateOpParam = (opIndex: number, key: string, value: number) => {
    const nextOps = activeOps.map((item, idx) =>
      idx === opIndex
        ? { ...item, params: { ...item.params, [key]: value } }
        : item,
    );
    store.setPartMeshOps(selectedPartId, nextOps);
  };

  const handleMoveOp = (fromIdx: number, delta: -1 | 1) => {
    const toIdx = fromIdx + delta;
    if (toIdx < 0 || toIdx >= activeOps.length) return;
    const copy = [...activeOps];
    const [moved] = copy.splice(fromIdx, 1);
    if (!moved) return;
    copy.splice(toIdx, 0, moved);
    store.setPartMeshOps(selectedPartId, copy);
  };

  const handleRemoveOp = (opIndex: number) => {
    const nextOps = activeOps.filter((_, idx) => idx !== opIndex);
    store.setPartMeshOps(selectedPartId, nextOps);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: 14, color: '#e2e8f0' }}>
      {/* Part & Generator Selector */}
      <div
        style={{
          background: '#111827',
          border: '1px solid #1e293b',
          borderRadius: 8,
          padding: 12,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase' }}>
            Active Part (@hm/partgen — {Object.keys(GENERATORS).length} Generators)
          </span>
          {genDef && (
            <span
              style={{
                padding: '2px 7px',
                borderRadius: 4,
                background: 'rgba(56, 189, 248, 0.16)',
                color: '#38bdf8',
                fontSize: 10,
                fontWeight: 700,
              }}
            >
              PARAM gen:{genDef.id} (Rank {partDef?.rank ?? 2})
            </span>
          )}
        </div>

        <select
          value={selectedPartId}
          onChange={(e) =>
            store.selectPartAndSlot(state.activePartPath, e.target.value, state.activeSlotKey)
          }
          style={{
            width: '100%',
            marginTop: 6,
            padding: '6px 8px',
            borderRadius: 4,
            background: '#0f172a',
            color: '#fff',
            border: '1px solid #334155',
            fontSize: 11,
            fontWeight: 600,
          }}
        >
          {partIds.map((id) => {
            const p = activeEntry.kit.parts[id];
            const gLabel =
              p?.source.kind === 'param' ? `gen:${p.source.gen}` : p?.source.kind;
            return (
              <option key={id} value={id}>
                {id} ({gLabel})
              </option>
            );
          })}
        </select>

        {/* Parametric Schema Sliders from genDef.params */}
        {genDef && paramSource ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
            {genDef.params.map((spec) => {
              const val = resolvedParams[spec.key] ?? spec.default;
              if (spec.unit === 'choice' && spec.choices) {
                return (
                  <label
                    key={spec.key}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11 }}
                  >
                    <span>{spec.label}</span>
                    <select
                      value={val}
                      onChange={(e) =>
                        store.updatePartParam(
                          selectedPartId,
                          spec.key,
                          parseInt(e.target.value, 10),
                        )
                      }
                      style={{
                        padding: '3px 6px',
                        borderRadius: 4,
                        background: '#0f172a',
                        color: '#38bdf8',
                        border: '1px solid #334155',
                        fontSize: 11,
                      }}
                    >
                      {spec.choices.map((ch, idx) => (
                        <option key={ch} value={spec.min + idx}>
                          {ch}
                        </option>
                      ))}
                    </select>
                  </label>
                );
              }
              return (
                <label
                  key={spec.key}
                  style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 11 }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>{spec.label}</span>
                    <span style={{ color: '#38bdf8', fontWeight: 600 }}>
                      {spec.unit === 'count' ? Math.round(val) : val.toFixed(2)}{' '}
                      {spec.unit === 'm' ? 'm' : spec.unit === 'deg' ? '°' : ''}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={spec.min}
                    max={spec.max}
                    step={spec.step || 0.01}
                    value={val}
                    onChange={(e) =>
                      store.updatePartParam(
                        selectedPartId,
                        spec.key,
                        parseFloat(e.target.value),
                      )
                    }
                  />
                </label>
              );
            })}
          </div>
        ) : (
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 8 }}>
            Selected part uses a box primitive. Choose a parametric part above to edit generator sliders.
          </div>
        )}
      </div>

      {/* 6 One-Click Quick @hm/meshops Presets */}
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
          One-Click Quick Presets (@hm/meshops)
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
          {(Object.keys(QUICK_MESHOP_PRESETS) as QuickMeshOpPreset[]).map((presetKey) => {
            const opRef = QUICK_MESHOP_PRESETS[presetKey];
            const isActive = activeOps.some((o) => o.op === opRef.op);
            return (
              <button
                key={presetKey}
                onClick={() => store.applyQuickMeshOp(selectedPartId, presetKey)}
                style={{
                  padding: '6px 8px',
                  borderRadius: 6,
                  border: isActive ? '1.5px solid #38bdf8' : '1px solid #2d3b4e',
                  background: isActive ? 'rgba(56, 189, 248, 0.16)' : '#162032',
                  color: '#e2e8f0',
                  fontSize: 11,
                  fontWeight: 600,
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                <div>⚡ {presetKey}</div>
                <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 2 }}>
                  {opRef.op}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Interactive MESHOPS STACK (Add, Tune Sliders, Reorder, Delete) */}
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#38bdf8' }}>
            MESHOPS STACK ({activeOps.length})
          </span>
          {activeOps.length > 0 && (
            <button
              onClick={() => store.setPartMeshOps(selectedPartId, [])}
              style={{
                padding: '2px 8px',
                borderRadius: 4,
                border: '1px solid #ef4444',
                background: 'transparent',
                color: '#f87171',
                fontSize: 10,
                cursor: 'pointer',
              }}
            >
              Clear Stack
            </button>
          )}
        </div>

        {/* [+ Add MeshOp] Bar */}
        <div style={{ display: 'flex', gap: 6 }}>
          <select
            value={opToAdd}
            onChange={(e) => setOpToAdd(e.target.value)}
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
            {MESHOP_CATALOG.map((item) => (
              <option key={item.op} value={item.op}>
                {item.label} ({item.op})
              </option>
            ))}
          </select>
          <button
            onClick={handleAddMeshOp}
            style={{
              padding: '5px 12px',
              borderRadius: 4,
              border: 'none',
              background: '#10b981',
              color: '#052e16',
              fontWeight: 700,
              fontSize: 11,
              cursor: 'pointer',
            }}
          >
            + Add MeshOp
          </button>
        </div>

        {/* Active Stack Rows */}
        {activeOps.length === 0 ? (
          <div style={{ fontSize: 10, color: '#64748b', padding: '6px 0' }}>
            No active mesh modifiers. Click a Quick Preset or [+ Add MeshOp] above to deform the 3D part live.
          </div>
        ) : (
          activeOps.map((opRef, idx) => (
            <div
              key={`${opRef.op}-${idx}`}
              style={{
                padding: 8,
                borderRadius: 6,
                background: '#162032',
                border: '1px solid #243046',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#f8fafc' }}>
                  #{idx + 1} {opRef.op}
                </span>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button
                    onClick={() => handleMoveOp(idx, -1)}
                    style={{ padding: '1px 5px', fontSize: 10, background: '#0f172a', color: '#94a3b8', border: '1px solid #334155', borderRadius: 3, cursor: 'pointer' }}
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => handleMoveOp(idx, 1)}
                    style={{ padding: '1px 5px', fontSize: 10, background: '#0f172a', color: '#94a3b8', border: '1px solid #334155', borderRadius: 3, cursor: 'pointer' }}
                  >
                    ↓
                  </button>
                  <button
                    onClick={() => handleRemoveOp(idx)}
                    style={{ padding: '1px 6px', fontSize: 10, background: '#0f172a', color: '#f87171', border: '1px solid #ef4444', borderRadius: 3, cursor: 'pointer' }}
                  >
                    ×
                  </button>
                </div>
              </div>

              {Object.entries(opRef.params).map(([pKey, pVal]) => (
                <label
                  key={pKey}
                  style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 10 }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#94a3b8' }}>{pKey}</span>
                    <span style={{ color: '#38bdf8' }}>{pVal.toFixed(3)}</span>
                  </div>
                  <input
                    type="range"
                    min={pKey.includes('Scale') ? 0.4 : pKey === 'depth' ? -0.06 : 0}
                    max={pKey.includes('angle') ? 90 : pKey === 'iterations' ? 10 : 2.0}
                    step={pKey === 'iterations' || pKey === 'axis' ? 1 : 0.005}
                    value={pVal}
                    onChange={(e) =>
                      handleUpdateOpParam(idx, pKey, parseFloat(e.target.value))
                    }
                  />
                </label>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
