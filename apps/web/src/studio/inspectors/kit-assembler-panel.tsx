/**
 * @file apps/web/src/studio/inspectors/kit-assembler-panel.tsx
 * STUDIO-44D: Interactive @hm/kitspec Kit & Assembly Inspector
 *
 * Grounding status badge (0 issues vs floating/below-ground auto-snap),
 * child placement list, transform sliders, and socket pin connections.
 */

import React, { useMemo } from 'react';
import { globalStudioStore, useStudioState } from '../state/studio-hook';
import './kit-assembler-panel.css';

export const KitAssemblerPanel: React.FC = () => {
  const state = useStudioState();

  const entry = state.kits[state.activeKitId];
  const kit = entry?.kit;
  const rootPreset = entry?.rootPreset;

  const asm = kit && rootPreset ? kit.assemblies[rootPreset] : undefined;
  const issues = state.validationIssues;

  // Selected child placement index based on activePartPath or activePartId
  const selectedChildIndex = useMemo(() => {
    if (!asm) return -1;
    if (state.activePartPath) {
      // If path is e.g. "mill-frame", find matching child
      const idx = asm.children.findIndex(
        (c) => c.key === state.activePartPath || c.ref === state.activePartPath,
      );
      if (idx >= 0) return idx;
    }
    if (state.activePartId) {
      const idx = asm.children.findIndex((c) => c.ref === state.activePartId);
      if (idx >= 0) return idx;
    }
    return 0; // default to first child if available
  }, [asm, state.activePartPath, state.activePartId]);

  const selectedChild = asm && selectedChildIndex >= 0 ? asm.children[selectedChildIndex] : undefined;
  const selectedPartDef = kit && selectedChild ? kit.parts[selectedChild.ref] : undefined;

  const handleTransformChange = (axisIdx: number, val: number) => {
    if (selectedChildIndex < 0 || !selectedChild) return;
    const currentAt = selectedChild.at ?? [0, 0, 0];
    const nextAt: [number, number, number] = [
      axisIdx === 0 ? val : currentAt[0] ?? 0,
      axisIdx === 1 ? val : currentAt[1] ?? 0,
      axisIdx === 2 ? val : currentAt[2] ?? 0,
    ];
    globalStudioStore.updatePlacement(selectedChildIndex, { at: nextAt });
  };

  const handleSelectChild = (childIdx: number) => {
    if (!asm) return;
    const child = asm.children[childIdx];
    if (child) {
      globalStudioStore.selectPartAndSlot(child.key ?? child.ref, child.ref, null);
    }
  };

  if (!kit || !asm) {
    return (
      <div className="sx-assembler-empty">
        <span>No active assembly in current kit</span>
      </div>
    );
  }

  return (
    <div className="sx-kit-assembler-panel" data-testid="kit-assembler-panel">
      {/* Header and Validation Status Badge */}
      <div className="sx-assembler-header">
        <div className="sx-assembler-title-row">
          <span className="sx-assembler-title">Assembly & Sockets</span>
          <span className="sx-kit-id-badge">{state.activeKitId}</span>
        </div>

        {/* Live Grounding & PBR Validation Status */}
        <div className="sx-validation-status-box" data-testid="grounding-status-box">
          {issues.length === 0 ? (
            <div className="sx-valid-badge" data-testid="validation-pass-badge">
              <span className="sx-badge-icon">✓</span>
              <span>0 Issues — Grounded & PBR Valid</span>
            </div>
          ) : (
            <div className="sx-issues-summary">
              <div className="sx-issues-pill-row">
                <span className="sx-issue-badge" data-testid="validation-issues-badge">
                  ⚠️ {issues.length} Issue{issues.length === 1 ? '' : 's'} Detected
                </span>
                <button
                  type="button"
                  className="sx-auto-snap-btn"
                  onClick={() => globalStudioStore.autoFixGroundingIssues()}
                  title="Auto-snap floating or subterranean parts to valid grounding sockets"
                  data-testid="auto-snap-grounding-btn"
                >
                  ⚡ Auto-Snap Grounding
                </button>
              </div>
              <ul className="sx-issues-list">
                {issues.slice(0, 3).map((iss, i) => (
                  <li key={i} className="sx-issue-item">
                    {iss.detail} ({iss.at})
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Assembly Placements Shelf */}
      <div className="sx-placements-section">
        <div className="sx-section-title-row">
          <span className="sx-section-heading">Placed Parts ({asm.children.length})</span>
          <span className="sx-section-sub">Root: {rootPreset}</span>
        </div>

        <div className="sx-placements-list" role="listbox" aria-label="Assembly placements">
          {asm.children.map((child, idx) => {
            const isSelected = selectedChildIndex === idx;
            const pDef = kit.parts[child.ref];
            const isSocketMounted = Boolean(child.on);

            return (
              <button
                key={`${child.ref}-${idx}`}
                type="button"
                className={`sx-placement-item ${isSelected ? 'selected' : ''}`}
                onClick={() => handleSelectChild(idx)}
                data-testid={`placement-item-${idx}`}
                role="option"
                aria-selected={isSelected}
              >
                <div className="sx-placement-item-left">
                  <span className="sx-child-idx">#{idx + 1}</span>
                  <div className="sx-placement-names">
                    <span className="sx-placement-key">{child.key ?? child.ref}</span>
                    <span className="sx-placement-ref">{child.ref}</span>
                  </div>
                </div>

                <div className="sx-placement-item-right">
                  {isSocketMounted ? (
                    <span className="sx-mount-tag sx-tag-socket" title={`Mounted on socket '${child.on?.socket}'`}>
                      🔗 {child.on?.socket}
                    </span>
                  ) : (
                    <span className="sx-mount-tag sx-tag-root">⚓ Free at [{child.at?.join(', ') ?? '0,0,0'}]</span>
                  )}
                  {pDef?.material && (
                    <span className="sx-part-mat-pill">{pDef.material.replace('mat:', '')}</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Placement Inspector & Transforms */}
      {selectedChild && (
        <div className="sx-selected-placement-card" data-testid="selected-placement-card">
          <div className="sx-card-title-row">
            <span className="sx-card-title">Transform: {selectedChild.key ?? selectedChild.ref}</span>
            <span className="sx-rank-pill">Rank {selectedChild.rank ?? selectedPartDef?.rank ?? 1}</span>
          </div>

          {/* Position XYZ Sliders */}
          <div className="sx-transform-grid">
            <div className="sx-coord-slider">
              <div className="sx-coord-label-row">
                <span className="sx-coord-name sx-x">X (Right)</span>
                <span className="sx-coord-val">{(selectedChild.at?.[0] ?? 0).toFixed(2)} m</span>
              </div>
              <input
                type="range"
                min="-4"
                max="4"
                step="0.05"
                className="sx-slider"
                value={selectedChild.at?.[0] ?? 0}
                onChange={(e) => handleTransformChange(0, parseFloat(e.target.value))}
                data-testid="pos-x-slider"
              />
            </div>

            <div className="sx-coord-slider">
              <div className="sx-coord-label-row">
                <span className="sx-coord-name sx-y">Y (Height)</span>
                <span className="sx-coord-val">{(selectedChild.at?.[1] ?? 0).toFixed(2)} m</span>
              </div>
              <input
                type="range"
                min="-1"
                max="6"
                step="0.05"
                className="sx-slider"
                value={selectedChild.at?.[1] ?? 0}
                onChange={(e) => handleTransformChange(1, parseFloat(e.target.value))}
                data-testid="pos-y-slider"
              />
            </div>

            <div className="sx-coord-slider">
              <div className="sx-coord-label-row">
                <span className="sx-coord-name sx-z">Z (Forward)</span>
                <span className="sx-coord-val">{(selectedChild.at?.[2] ?? 0).toFixed(2)} m</span>
              </div>
              <input
                type="range"
                min="-4"
                max="4"
                step="0.05"
                className="sx-slider"
                value={selectedChild.at?.[2] ?? 0}
                onChange={(e) => handleTransformChange(2, parseFloat(e.target.value))}
                data-testid="pos-z-slider"
              />
            </div>
          </div>

          {/* Sockets on Selected Part */}
          {selectedPartDef?.sockets && Object.keys(selectedPartDef.sockets).length > 0 && (
            <div className="sx-part-sockets-area">
              <div className="sx-sockets-title">Defined Sockets on this Part</div>
              <div className="sx-sockets-chip-row">
                {Object.entries(selectedPartDef.sockets).map(([sockName]) => {
                  const isOccupied = asm.children.some(
                    (c) => c.on?.child === selectedChildIndex && c.on?.socket === sockName,
                  );
                  return (
                    <div
                      key={sockName}
                      className={`sx-socket-chip ${isOccupied ? 'occupied' : 'open'}`}
                      data-testid={`part-socket-${sockName}`}
                    >
                      <span className="sx-socket-dot" />
                      <span className="sx-socket-name">{sockName}</span>
                      <span className="sx-socket-status">
                        {isOccupied ? 'Occupied' : 'Open'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
