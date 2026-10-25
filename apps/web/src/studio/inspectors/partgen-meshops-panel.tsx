/**
 * @file apps/web/src/studio/inspectors/partgen-meshops-panel.tsx
 * STUDIO-44D: Interactive @hm/partgen Parametric & @hm/meshops Modifier Inspector
 *
 * Exposes the 20 parametric part generators, dynamic parameter sliders,
 * the 6 One-Click Quick Preset pills, and the 27-operator @hm/meshops modifier stack.
 */

import React, { useMemo } from 'react';
import { GENERATORS, type Generator, type ParamSpec } from '@hm/partgen';
import { globalStudioStore, useStudioState } from '../state/studio-hook';
import './partgen-meshops-panel.css';

const QUICK_PRESETS = [
  { key: 'smooth', label: 'Smooth', icon: '✨' },
  { key: 'chamfer-45', label: '45° Chamfer', icon: '📐' },
  { key: 'recessed-seam', label: 'Recessed Seam', icon: '⚡' },
  { key: 'funnel-taper', label: 'Funnel Taper', icon: '🔻' },
  { key: 'stretch-span', label: 'Stretch Span', icon: '↔️' },
  { key: 'edge-wear', label: 'Edge Wear', icon: '🛡️' },
] as const;

export const PartgenMeshopsPanel: React.FC = () => {
  const state = useStudioState();

  const entry = state.kits[state.activeKitId];
  const kit = entry?.kit;

  // Resolve active PartDef
  const activePartId = useMemo(() => {
    if (state.activePartId && kit?.parts[state.activePartId]) {
      return state.activePartId;
    }
    if (state.activePartPath && kit) {
      // Find part whose key matches activePartPath or child.key matches
      for (const pId of Object.keys(kit.parts)) {
        if (pId === state.activePartPath) return pId;
      }
      const asm = kit.assemblies[entry?.rootPreset ?? ''];
      const child = asm?.children.find(
        (c) => c.key === state.activePartPath || c.ref === state.activePartPath,
      );
      if (child && kit.parts[child.ref]) return child.ref;
    }
    // Fallback to first part
    return kit ? Object.keys(kit.parts)[0] ?? null : null;
  }, [kit, state.activePartId, state.activePartPath, entry]);

  const partDef = activePartId && kit ? kit.parts[activePartId] : undefined;
  const isParametric = partDef?.source.kind === 'param';

  const genDef: Generator | undefined = useMemo(() => {
    if (!isParametric || !partDef || partDef.source.kind !== 'param') return undefined;
    return GENERATORS[partDef.source.gen];
  }, [partDef, isParametric]);

  const handleParamChange = (paramKey: string, val: number) => {
    if (!activePartId) return;
    globalStudioStore.updatePartParam(activePartId, paramKey, val);
  };

  const handleApplyQuickPreset = (presetKey: (typeof QUICK_PRESETS)[number]['key']) => {
    if (!activePartId) return;
    globalStudioStore.applyQuickMeshOp(activePartId, presetKey);
  };

  const handleRemoveOp = (opIndex: number) => {
    if (!activePartId || !partDef || partDef.source.kind !== 'param') return;
    const existing = partDef.source.ops ?? [];
    const nextOps = existing.filter((_, i) => i !== opIndex);
    globalStudioStore.setPartMeshOps(activePartId, nextOps);
  };

  if (!kit || !activePartId || !partDef) {
    return (
      <div className="sx-partgen-empty">
        <span>No part selected in active kit</span>
      </div>
    );
  }

  return (
    <div className="sx-partgen-meshops-panel" data-testid="partgen-meshops-panel">
      {/* Active Part Header */}
      <div className="sx-partgen-header">
        <div className="sx-partgen-title-row">
          <span className="sx-partgen-title">Part & MeshOps</span>
          <span className="sx-part-id-badge">{activePartId}</span>
        </div>
        <div className="sx-gen-tag-row">
          <span className="sx-source-kind-pill">{partDef.source.kind}</span>
          {isParametric && partDef.source.kind === 'param' && (
            <span className="sx-gen-id-pill">gen:{partDef.source.gen}</span>
          )}
          <span className="sx-part-rank-pill">Rank {partDef.rank}</span>
        </div>
      </div>

      {/* 6 One-Click Quick Presets */}
      <div className="sx-quick-presets-section">
        <div className="sx-section-label">One-Click Quick Presets</div>
        <div className="sx-quick-pills-grid" role="group" aria-label="One-click quick presets">
          {QUICK_PRESETS.map((qp) => (
            <button
              key={qp.key}
              type="button"
              className="sx-quick-pill-btn"
              onClick={() => handleApplyQuickPreset(qp.key)}
              title={`Apply '${qp.label}' operator preset`}
              data-testid={`quick-preset-${qp.key}`}
            >
              <span className="sx-qp-icon">{qp.icon}</span>
              <span className="sx-qp-label">{qp.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Parametric Generator Sliders */}
      {isParametric && genDef && partDef.source.kind === 'param' && (
        <div className="sx-params-section">
          <div className="sx-section-label">
            Parametric Controls ({genDef.label})
          </div>

          <div className="sx-params-sliders-list">
            {genDef.params.map((schema: ParamSpec) => {
              const paramName = schema.key;
              const currentVal =
                (partDef.source.kind === 'param'
                  ? partDef.source.params?.[paramName]
                  : undefined) ?? schema.default;

              const min = schema.min;
              const max = schema.max;
              const step = schema.step;

              return (
                <div key={paramName} className="sx-gen-param-row">
                  <div className="sx-param-label-line">
                    <span className="sx-param-name">{schema.label || paramName}</span>
                    <span className="sx-param-val">{Number(currentVal).toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    className="sx-slider"
                    value={currentVal}
                    onChange={(e) => handleParamChange(paramName, parseFloat(e.target.value))}
                    data-testid={`param-${paramName}-slider`}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MeshOps 27-Operator Stack View */}
      <div className="sx-meshops-stack-section">
        <div className="sx-meshops-header-row">
          <span className="sx-section-label">
            MeshOps Stack ({isParametric && partDef.source.kind === 'param' ? partDef.source.ops?.length ?? 0 : 0})
          </span>
          <span className="sx-meshops-badge">27-Op Engine</span>
        </div>

        {isParametric && partDef.source.kind === 'param' && (partDef.source.ops?.length ?? 0) > 0 ? (
          <div className="sx-ops-list" role="list">
            {partDef.source.ops!.map((opItem, opIdx) => (
              <div key={`${opItem.op}-${opIdx}`} className="sx-op-item" role="listitem">
                <div className="sx-op-info">
                  <span className="sx-op-idx">#{opIdx + 1}</span>
                  <span className="sx-op-name">{opItem.op}</span>
                </div>
                <div className="sx-op-actions">
                  <button
                    type="button"
                    className="sx-op-del-btn"
                    onClick={() => handleRemoveOp(opIdx)}
                    title="Remove operator from stack"
                    data-testid={`remove-op-${opIdx}`}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="sx-ops-empty">
            <span>No MeshOps operators on this part. Click a preset above to apply one.</span>
          </div>
        )}
      </div>
    </div>
  );
};
