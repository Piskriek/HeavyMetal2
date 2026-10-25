/**
 * @file apps/web/src/studio/inspectors/matstack-inspector.tsx
 * STUDIO-44C: Two-Tier @hm/matstack Designer Inspector
 *
 * Tier 1: 16 curated FIRST_MATSTACK_SHELF smart materials, hover try-on,
 *         Paint 1 / Paint 2 pickers, master Age slider, and [Clean with Solvent].
 * Tier 2: Reorderable 6-layer stack, Mask B&W view toggle [M], per-channel writes pills,
 *         SurfaceSpec and MaskSpec parameter controls.
 */

import React, { useState } from 'react';
import {
  FIRST_MATSTACK_SHELF,
  LAYER_SHELF,
  CHANNEL_GROUPS,
  type ChannelGroup,
  type MaterialSpec,
  type LayerSpec,
} from '@hm/matstack';
import { globalStudioStore, useStudioState } from '../state/studio-hook';
import './matstack-inspector.css';

export interface MatStackInspectorProps {
  readonly scope?: 'part-override' | 'kit-slot';
}

export const MatStackInspector: React.FC<MatStackInspectorProps> = ({ scope = 'kit-slot' }) => {
  const state = useStudioState();
  const [tier, setTier] = useState<'tier1' | 'tier2'>('tier1');
  const [selectedLayerIndex, setSelectedLayerIndex] = useState<number>(0);
  const [showAddLayerDropdown, setShowAddLayerDropdown] = useState<boolean>(false);

  const activeMatId = state.activeMaterialId;
  const spec: MaterialSpec = globalStudioStore.getEffectiveMaterialSpec(activeMatId);

  const activeSlot = state.activeSlotKey ?? 'default';

  const handleSelectPreset = (presetId: string) => {
    globalStudioStore.assignSlotMaterial(activeSlot, presetId, scope);
  };

  const isMaskBwActiveForLayer = (layerIdx: number): boolean => {
    return state.viewportMode === 'mask-bw' && state.maskViewLayerIndex === layerIdx;
  };

  const handleToggleMaskBw = (layerIdx: number) => {
    if (isMaskBwActiveForLayer(layerIdx)) {
      globalStudioStore.setViewportMode('lit', null);
    } else {
      globalStudioStore.setViewportMode('mask-bw', layerIdx);
    }
  };

  return (
    <div className="sx-matstack-inspector" data-testid="matstack-inspector">
      {/* Header with Tier Tab Toggle */}
      <div className="sx-matstack-header">
        <div className="sx-matstack-title-area">
          <span className="sx-matstack-title">Material Stack</span>
          <span className="sx-matstack-badge">{activeMatId}</span>
        </div>
        <div className="sx-tier-toggle-btns" role="tablist">
          <button
            type="button"
            className={`sx-tier-tab ${tier === 'tier1' ? 'active' : ''}`}
            onClick={() => setTier('tier1')}
            role="tab"
            aria-selected={tier === 'tier1'}
            data-testid="tier1-tab"
          >
            Presets (Tier 1)
          </button>
          <button
            type="button"
            className={`sx-tier-tab ${tier === 'tier2' ? 'active' : ''}`}
            onClick={() => setTier('tier2')}
            role="tab"
            aria-selected={tier === 'tier2'}
            data-testid="tier2-tab"
          >
            Layer Stack (Tier 2)
          </button>
        </div>
      </div>

      {tier === 'tier1' ? (
        /* ================= TIER 1: SMART PRESETS & WEATHERING ================= */
        <div className="sx-matstack-tier1" data-testid="tier1-panel">
          {/* Global Dials: Paint 1, Paint 2, Age, Clean */}
          <div className="sx-matstack-dials-card">
            <div className="sx-dials-row">
              <div className="sx-dial-item">
                <label htmlFor="paint1-picker" className="sx-dial-label">Paint 1</label>
                <div className="sx-color-input-wrapper">
                  <input
                    id="paint1-picker"
                    type="color"
                    className="sx-color-input"
                    value={spec.paint[0] ?? '#888888'}
                    onChange={(e) => globalStudioStore.setMaterialPaint(0, e.target.value)}
                    data-testid="paint1-color"
                  />
                  <span className="sx-color-hex">{spec.paint[0] ?? '#888888'}</span>
                </div>
              </div>

              <div className="sx-dial-item">
                <label htmlFor="paint2-picker" className="sx-dial-label">Paint 2</label>
                <div className="sx-color-input-wrapper">
                  <input
                    id="paint2-picker"
                    type="color"
                    className="sx-color-input"
                    value={spec.paint[1] ?? '#eab308'}
                    onChange={(e) => globalStudioStore.setMaterialPaint(1, e.target.value)}
                    data-testid="paint2-color"
                  />
                  <span className="sx-color-hex">{spec.paint[1] ?? '#eab308'}</span>
                </div>
              </div>

              <div className="sx-dial-item sx-dial-solvent">
                <button
                  type="button"
                  className="sx-solvent-btn"
                  onClick={() => globalStudioStore.applySolventToActiveKit(state.activePartPath ?? undefined)}
                  title="Resets age to 0.0 and strips weathering coats"
                  data-testid="solvent-clean-btn"
                >
                  <span className="sx-btn-icon">🧼</span>
                  <span>Clean with Solvent</span>
                </button>
              </div>
            </div>

            {/* Age Weathering Slider */}
            <div className="sx-age-row">
              <div className="sx-age-label-group">
                <label htmlFor="age-slider" className="sx-dial-label">Weathering Age</label>
                <span className="sx-age-val">{(spec.age * 100).toFixed(0)}%</span>
              </div>
              <input
                id="age-slider"
                type="range"
                min="0"
                max="1"
                step="0.01"
                className="sx-slider sx-age-slider"
                value={spec.age}
                onChange={(e) => globalStudioStore.setMaterialAge(parseFloat(e.target.value))}
                data-testid="mat-age-slider"
              />
            </div>
          </div>

          {/* 16 FIRST_MATSTACK_SHELF Smart Presets with Hover Try-On */}
          <div className="sx-presets-section">
            <div className="sx-section-title">
              <span>Curated Material Presets</span>
              <span className="sx-section-hint">Hover to preview, click to apply</span>
            </div>
            <div className="sx-presets-grid" role="listbox" aria-label="Smart material presets">
              {FIRST_MATSTACK_SHELF.map((preset) => {
                const isCurrent = activeMatId === preset.id;
                const isHovered = state.hoveredMaterialId === preset.id;
                const p0 = preset.paint[0] ?? '#888888';
                const p1 = preset.paint[1] ?? p0;

                return (
                  <button
                    key={preset.id}
                    type="button"
                    className={`sx-preset-card ${isCurrent ? 'selected' : ''} ${isHovered ? 'hovered' : ''}`}
                    onClick={() => handleSelectPreset(preset.id)}
                    onMouseEnter={() => globalStudioStore.setHoveredMaterial(preset.id)}
                    onMouseLeave={() => globalStudioStore.setHoveredMaterial(null)}
                    data-testid={`mat-preset-${preset.id}`}
                    role="option"
                    aria-selected={isCurrent}
                  >
                    <div className="sx-preset-swatch-box">
                      <div className="sx-preset-half-swatch" style={{ backgroundColor: p0 }} />
                      <div className="sx-preset-half-swatch" style={{ backgroundColor: p1 }} />
                    </div>
                    <div className="sx-preset-meta">
                      <span className="sx-preset-name">{preset.name}</span>
                      <div className="sx-preset-sub">
                        <span>{preset.layers.length} layer{preset.layers.length === 1 ? '' : 's'}</span>
                        <span className="sx-preset-age">{(preset.age * 100).toFixed(0)}% age</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        /* ================= TIER 2: REORDERABLE LAYER STACK & DETAILS ================= */
        <div className="sx-matstack-tier2" data-testid="tier2-panel">
          {/* Base Surface Row */}
          <div className="sx-base-surface-card">
            <div className="sx-base-surface-header">
              <span className="sx-base-pill">BASE</span>
              <span className="sx-base-name">{spec.base.name}</span>
              <span className="sx-base-params">
                M: {spec.base.metal.toFixed(2)} | R: {spec.base.rough.toFixed(2)} | S: {spec.base.specular.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Layer List Actions Bar */}
          <div className="sx-layers-actions-bar">
            <span className="sx-layers-count-label">
              Layers ({spec.layers.length}/6)
            </span>
            <div className="sx-add-layer-container">
              <button
                type="button"
                className="sx-add-layer-btn"
                onClick={() => setShowAddLayerDropdown(!showAddLayerDropdown)}
                disabled={spec.layers.length >= 6}
                data-testid="add-layer-trigger"
              >
                + Add Layer
              </button>
              {showAddLayerDropdown && (
                <div className="sx-layer-shelf-dropdown">
                  <div className="sx-dropdown-header">Pick Preset Layer</div>
                  <div className="sx-dropdown-list">
                    {Object.entries(LAYER_SHELF).map(([shelfKey, layerPreset]) => (
                      <button
                        key={shelfKey}
                        type="button"
                        className="sx-dropdown-item"
                        onClick={() => {
                          globalStudioStore.addLayerFromShelf(shelfKey);
                          setShowAddLayerDropdown(false);
                        }}
                      >
                        <span className="sx-item-name">{layerPreset.name}</span>
                        <span className="sx-item-writes">{layerPreset.writes.join(', ')}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Layer Stack Items */}
          <div className="sx-layer-stack-list" role="list">
            {spec.layers.length === 0 ? (
              <div className="sx-empty-layers">No layers attached. The base surface shows completely.</div>
            ) : (
              spec.layers.map((layer: LayerSpec, idx: number) => {
                const isSelected = selectedLayerIndex === idx;
                const isMaskBw = isMaskBwActiveForLayer(idx);

                return (
                  <div
                    key={`${layer.name}-${idx}`}
                    className={`sx-layer-item ${isSelected ? 'active-layer' : ''}`}
                    onClick={() => {
                      setSelectedLayerIndex(idx);
                      globalStudioStore.setActiveLayerIndex(idx);
                    }}
                    role="listitem"
                    data-testid={`layer-item-${idx}`}
                  >
                    <div className="sx-layer-top-row">
                      <div className="sx-layer-info">
                        <span className="sx-layer-index-pill">#{idx + 1}</span>
                        <span className="sx-layer-name">{layer.name}</span>
                      </div>

                      <div className="sx-layer-controls">
                        {/* Mask B&W View Toggle [M] */}
                        <button
                          type="button"
                          className={`sx-icon-btn sx-mask-btn ${isMaskBw ? 'active' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleMaskBw(idx);
                          }}
                          title={isMaskBw ? 'Exit Mask B&W View' : 'Inspect this layer mask in B&W on the 3D model [M]'}
                          data-testid={`mask-bw-btn-${idx}`}
                        >
                          [M]
                        </button>

                        {/* Visibility Eye */}
                        <button
                          type="button"
                          className={`sx-icon-btn ${layer.visible ? 'active' : 'muted'}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            globalStudioStore.toggleLayerVisible(idx);
                          }}
                          title={layer.visible ? 'Hide layer' : 'Show layer'}
                          data-testid={`layer-eye-${idx}`}
                        >
                          {layer.visible ? '👁' : '🚫'}
                        </button>

                        {/* Move Up */}
                        <button
                          type="button"
                          className="sx-icon-btn"
                          disabled={idx === 0}
                          onClick={(e) => {
                            e.stopPropagation();
                            globalStudioStore.moveLayer(idx, idx - 1);
                            setSelectedLayerIndex(idx - 1);
                          }}
                          title="Move up in stack"
                        >
                          ▲
                        </button>

                        {/* Move Down */}
                        <button
                          type="button"
                          className="sx-icon-btn"
                          disabled={idx === spec.layers.length - 1}
                          onClick={(e) => {
                            e.stopPropagation();
                            globalStudioStore.moveLayer(idx, idx + 1);
                            setSelectedLayerIndex(idx + 1);
                          }}
                          title="Move down in stack"
                        >
                          ▼
                        </button>

                        {/* Delete */}
                        <button
                          type="button"
                          className="sx-icon-btn sx-btn-danger"
                          onClick={(e) => {
                            e.stopPropagation();
                            globalStudioStore.removeLayer(idx);
                            setSelectedLayerIndex(Math.max(0, idx - 1));
                          }}
                          title="Delete layer"
                          data-testid={`delete-layer-${idx}`}
                        >
                          ✕
                        </button>
                      </div>
                    </div>

                    {/* Sliders: Opacity & HeightBlend */}
                    <div className="sx-layer-sliders-row">
                      <div className="sx-layer-slider-col">
                        <div className="sx-slider-label-row">
                          <span>Opacity</span>
                          <span>{(layer.opacity * 100).toFixed(0)}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.02"
                          className="sx-slider"
                          value={layer.opacity}
                          onChange={(e) =>
                            globalStudioStore.updateLayer(idx, { opacity: parseFloat(e.target.value) })
                          }
                          data-testid={`layer-opacity-${idx}`}
                        />
                      </div>

                      <div className="sx-layer-slider-col">
                        <div className="sx-slider-label-row">
                          <span>Height Blend</span>
                          <span>{(layer.heightBlend * 100).toFixed(0)}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.02"
                          className="sx-slider"
                          value={layer.heightBlend}
                          onChange={(e) =>
                            globalStudioStore.updateLayer(idx, { heightBlend: parseFloat(e.target.value) })
                          }
                          data-testid={`layer-heightblend-${idx}`}
                        />
                      </div>
                    </div>

                    {/* Writes Toggles for Channels */}
                    <div className="sx-layer-writes-row">
                      <span className="sx-writes-label">Writes:</span>
                      <div className="sx-writes-pills">
                        {CHANNEL_GROUPS.map((ch: ChannelGroup) => {
                          const writes = layer.writes.includes(ch);
                          return (
                            <button
                              key={ch}
                              type="button"
                              className={`sx-write-chip ${writes ? 'active' : ''}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                globalStudioStore.toggleLayerChannelWrite(idx, ch);
                              }}
                              data-testid={`write-chip-${ch}-${idx}`}
                            >
                              {ch}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Mask Input & Balance Controls */}
                    <div className="sx-layer-mask-summary">
                      <div className="sx-mask-balance-slider">
                        <div className="sx-slider-label-row">
                          <span>Mask Balance</span>
                          <span>{layer.mask.balance.toFixed(2)}</span>
                        </div>
                        <input
                          type="range"
                          min="-1"
                          max="1"
                          step="0.05"
                          className="sx-slider"
                          value={layer.mask.balance}
                          onChange={(e) =>
                            globalStudioStore.updateLayerMask(idx, { balance: parseFloat(e.target.value) })
                          }
                        />
                      </div>
                      <div className="sx-mask-contrast-slider">
                        <div className="sx-slider-label-row">
                          <span>Contrast</span>
                          <span>{layer.mask.contrast.toFixed(2)}</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.05"
                          className="sx-slider"
                          value={layer.mask.contrast}
                          onChange={(e) =>
                            globalStudioStore.updateLayerMask(idx, { contrast: parseFloat(e.target.value) })
                          }
                        />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
