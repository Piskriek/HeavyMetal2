/**
 * @file apps/web/src/studio/inspectors/matstack-inspector.tsx
 * ARGO_STUDIO_REALITY_AUDIT_AND_BLUEPRINT.md (Screen 1 & Aspect 2):
 * Two-Tier `@hm/matstack` Layered PBR Inspector:
 *  - Tier 1: 16 Curated Smart Material Swatches with Live 3D Hover Try-On, Paint 1 & 2,
 *    Master Weathering Age slider, Base Roughness/Metalness sliders, and `[Clean with Solvent]`.
 *  - Tier 2: Reorderable 6-Layer Stack with `[M] Mask B&W`, Blend Mode (`normal`, `add`, `multiply`),
 *    Opacity slider, Channel Write pills (`colour`, `metal`, `rough`, `height`, `coat`, `emit`),
 *    and `[+ Add Layer]` from `LAYER_SHELF`.
 */

import React, { useState } from 'react';
import {
  LAYER_SHELF,
  MATERIAL_SHELF,
  type BlendMode,
  type ChannelGroup,
} from '@hm/matstack';
import type { StudioState, StudioStore } from '../state/studio-store';

export interface MatstackInspectorProps {
  state: StudioState;
  store: StudioStore;
}

const CHANNEL_GROUPS: readonly ChannelGroup[] = [
  'colour',
  'metal',
  'rough',
  'specular',
  'height',
  'coat',
  'fuzz',
  'aniso',
  'film',
  'emit',
];

const BLEND_MODES: readonly BlendMode[] = [
  'normal',
  'add',
  'subtract',
  'multiply',
  'max',
  'min',
];

export const MatstackInspector: React.FC<MatstackInspectorProps> = ({ state, store }) => {
  const [tier, setTier] = useState<'tier1' | 'tier2'>('tier1');
  const [layerToAdd, setLayerToAdd] = useState<string>(Object.keys(LAYER_SHELF)[0] ?? 'edge-wear');

  const slots = store.getMaterialSlotsForActiveKit();
  const activeSlotKey = state.activeSlotKey ?? slots[0]?.slotName ?? 'body';
  const activeMatSpec = store.getEffectiveMaterialSpec(state.activeMaterialId);
  const materialIds = Object.keys(MATERIAL_SHELF);
  const layerShelfIds = Object.keys(LAYER_SHELF);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: 14, color: '#e2e8f0' }}>
      {/* Header & Tier Toggle */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Editing Slot [{activeSlotKey}]
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#38bdf8' }}>
            {activeMatSpec.name} ({activeSlotKey})
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4, background: '#0f172a', padding: 3, borderRadius: 6 }}>
          <button
            onClick={() => setTier('tier1')}
            style={{
              padding: '4px 10px',
              fontSize: 11,
              fontWeight: 600,
              borderRadius: 4,
              border: 'none',
              background: tier === 'tier1' ? '#0284c7' : 'transparent',
              color: tier === 'tier1' ? '#fff' : '#94a3b8',
              cursor: 'pointer',
            }}
          >
            Tier 1: Quick Polish
          </button>
          <button
            onClick={() => setTier('tier2')}
            style={{
              padding: '4px 10px',
              fontSize: 11,
              fontWeight: 600,
              borderRadius: 4,
              border: 'none',
              background: tier === 'tier2' ? '#0284c7' : 'transparent',
              color: tier === 'tier2' ? '#fff' : '#94a3b8',
              cursor: 'pointer',
            }}
          >
            Tier 2: Layer Stack ({activeMatSpec.layers.length})
          </button>
        </div>
      </div>

      {/* Scope Selector (Kit Slot vs Part Override) */}
      <div style={{ display: 'flex', gap: 6, fontSize: 11 }}>
        <button
          onClick={() => store.setSlotAssignScope('kit-slot')}
          style={{
            flex: 1,
            padding: '5px 8px',
            borderRadius: 5,
            border: state.slotAssignScope === 'kit-slot' ? '1px solid #38bdf8' : '1px solid #334155',
            background: state.slotAssignScope === 'kit-slot' ? 'rgba(56, 189, 248, 0.16)' : '#111827',
            color: '#e2e8f0',
            cursor: 'pointer',
          }}
        >
          Apply to All [{activeSlotKey.includes(':') ? activeSlotKey.split(':')[1] : activeSlotKey}] Parts
        </button>
        <button
          onClick={() => store.setSlotAssignScope('part-override')}
          style={{
            flex: 1,
            padding: '5px 8px',
            borderRadius: 5,
            border: state.slotAssignScope === 'part-override' ? '1px solid #38bdf8' : '1px solid #334155',
            background: state.slotAssignScope === 'part-override' ? 'rgba(56, 189, 248, 0.16)' : '#111827',
            color: '#e2e8f0',
            cursor: 'pointer',
          }}
        >
          Override Selected Part Only
        </button>
      </div>

      {/* Tier 1: Curated Swatches with Non-Destructive Hover Try-On (Q4) */}
      <div
        style={{
          background: '#111827',
          border: '1px solid #1e293b',
          borderRadius: 8,
          padding: 12,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#cbd5e1' }}>
            {materialIds.length} @hm/matstack Swatches (Hover for Live 3D Try-On)
          </span>
          {state.hoveredMaterialId && (
            <span style={{ fontSize: 10, color: '#fbbf24' }}>Try-On: {state.hoveredMaterialId}</span>
          )}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
          {materialIds.map((matId) => {
            const spec = MATERIAL_SHELF[matId]!;
            const selected = state.activeMaterialId === matId;
            const hex1 = spec.paint?.[0] ?? '#64748b';
            const hex2 = spec.paint?.[1] ?? '#334155';
            return (
              <button
                key={matId}
                onMouseEnter={() => store.setHoveredMaterial(matId)}
                onMouseLeave={() => store.setHoveredMaterial(null)}
                onClick={() => store.assignSlotMaterial(activeSlotKey, matId)}
                title={`${spec.name} (${matId})`}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                  padding: '6px 4px',
                  borderRadius: 6,
                  border: selected ? '2px solid #38bdf8' : '1px solid #263244',
                  background: selected ? 'rgba(56, 189, 248, 0.14)' : '#161f2e',
                  color: '#e2e8f0',
                  cursor: 'pointer',
                }}
              >
                <span
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    background: `linear-gradient(135deg, ${hex1} 55%, ${hex2} 45%)`,
                    border: '1px solid rgba(255,255,255,0.28)',
                  }}
                />
                <span style={{ fontSize: 9, textAlign: 'center', lineHeight: 1.15 }}>{spec.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Paint 1 & Paint 2 + Master Weathering Age + Base Roughness/Metalness + Solvent */}
      <div
        style={{
          background: '#111827',
          border: '1px solid #1e293b',
          borderRadius: 8,
          padding: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 700, color: '#cbd5e1' }}>
          Paint 1 &amp; 2 Pickers, Weathering Age &amp; Base Surface
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11 }}>
            <span>Paint 1 (Primary)</span>
            <input
              type="color"
              value={activeMatSpec.paint?.[0] ?? '#d4882a'}
              onChange={(e) => store.setMaterialPaint(0, e.target.value)}
              style={{ width: 32, height: 22, border: 'none', background: 'transparent', cursor: 'pointer' }}
            />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11 }}>
            <span>Paint 2 (Accent)</span>
            <input
              type="color"
              value={activeMatSpec.paint?.[1] ?? '#2c3540'}
              onChange={(e) => store.setMaterialPaint(1, e.target.value)}
              style={{ width: 32, height: 22, border: 'none', background: 'transparent', cursor: 'pointer' }}
            />
          </label>
        </div>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Master Weathering Age (Rust, Wear &amp; Grime on 3D Mesh)</span>
            <span style={{ color: '#fbbf24' }}>{Math.round((activeMatSpec.age ?? 0.35) * 100)}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={activeMatSpec.age ?? 0.35}
            onChange={(e) => store.setMaterialAge(parseFloat(e.target.value))}
          />
        </label>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Base Roughness</span>
              <span style={{ color: '#38bdf8' }}>{activeMatSpec.base.rough.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min={0.05}
              max={1.0}
              step={0.01}
              value={activeMatSpec.base.rough}
              onChange={(e) => store.updateBaseSurface({ rough: parseFloat(e.target.value) })}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Base Metalness</span>
              <span style={{ color: '#38bdf8' }}>{activeMatSpec.base.metal.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min={0.0}
              max={1.0}
              step={0.01}
              value={activeMatSpec.base.metal}
              onChange={(e) => store.updateBaseSurface({ metal: parseFloat(e.target.value) })}
            />
          </label>
        </div>

        <button
          onClick={() => store.applySolventToActiveKit(state.activePartPath)}
          style={{
            padding: '6px 10px',
            borderRadius: 6,
            border: '1px solid #34d399',
            background: 'rgba(16, 185, 129, 0.14)',
            color: '#6ee7b7',
            fontSize: 11,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          🧼 Clean with Solvent (Reset Weathering Age &amp; Strip Part Overrides)
        </button>
      </div>

      {/* Tier 2: Full Interactive Layer Stack & [M] Mask B&W Diagnostic Mode */}
      {tier === 'tier2' && (
        <div
          style={{
            background: '#111827',
            border: '1px solid #1e293b',
            borderRadius: 8,
            padding: 12,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#cbd5e1' }}>
              Layer Stack ({activeMatSpec.layers.length} Layers) &amp; [M] Mask B&amp;W
            </span>
            {state.viewportMode === 'mask-bw' && (
              <button
                onClick={() => store.setViewportMode('lit', null)}
                style={{
                  fontSize: 10,
                  padding: '2px 8px',
                  borderRadius: 4,
                  background: '#ef4444',
                  color: '#fff',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Exit B&amp;W Mask
              </button>
            )}
          </div>

          {/* [+ Add Layer] Shelf Picker */}
          <div style={{ display: 'flex', gap: 6 }}>
            <select
              value={layerToAdd}
              onChange={(e) => setLayerToAdd(e.target.value)}
              style={{
                flex: 1,
                padding: '5px 8px',
                borderRadius: 4,
                background: '#0f172a',
                color: '#fff',
                border: '1px solid #334155',
                fontSize: 11,
              }}
            >
              {layerShelfIds.map((id) => (
                <option key={id} value={id}>
                  Layer Preset: {id} ({LAYER_SHELF[id]?.name})
                </option>
              ))}
            </select>
            <button
              onClick={() => store.addLayerFromShelf(layerToAdd)}
              style={{
                padding: '5px 10px',
                borderRadius: 4,
                border: 'none',
                background: '#10b981',
                color: '#052e16',
                fontWeight: 700,
                fontSize: 11,
                cursor: 'pointer',
              }}
            >
              + Add Layer
            </button>
          </div>

          {activeMatSpec.layers.map((layer, idx) => {
            const isMaskActive =
              state.viewportMode === 'mask-bw' && state.maskViewLayerIndex === idx;
            const isExpanded = state.activeLayerIndex === idx;
            return (
              <div
                key={`${layer.name}-${idx}`}
                onClick={() => store.setActiveLayerIndex(idx)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  padding: 8,
                  borderRadius: 6,
                  background: isMaskActive
                    ? 'rgba(250, 204, 21, 0.16)'
                    : isExpanded
                    ? 'rgba(56, 189, 248, 0.14)'
                    : '#182234',
                  border: isMaskActive
                    ? '1px solid #facc15'
                    : isExpanded
                    ? '1px solid #38bdf8'
                    : '1px solid #243046',
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: 11, fontWeight: 700 }}>
                      L{idx + 1}: {layer.name}
                    </span>
                    <span style={{ fontSize: 9, color: '#94a3b8' }}>
                      Height Blend: {Math.round(layer.heightBlend * 100)}% | Opacity: {Math.round(layer.opacity * 100)}%
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        store.moveLayer(idx, idx - 1);
                      }}
                      style={{ padding: '2px 5px', fontSize: 9, background: '#0f172a', color: '#94a3b8', border: '1px solid #334155', borderRadius: 3, cursor: 'pointer' }}
                    >
                      ↑
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        store.moveLayer(idx, idx + 1);
                      }}
                      style={{ padding: '2px 5px', fontSize: 9, background: '#0f172a', color: '#94a3b8', border: '1px solid #334155', borderRadius: 3, cursor: 'pointer' }}
                    >
                      ↓
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        store.toggleLayerVisible(idx);
                      }}
                      style={{
                        padding: '2px 6px',
                        borderRadius: 4,
                        fontSize: 9,
                        border: '1px solid #475569',
                        background: layer.visible === false ? '#334155' : '#0f172a',
                        color: '#e2e8f0',
                        cursor: 'pointer',
                      }}
                    >
                      {layer.visible === false ? 'Hidden' : 'Eye'}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isMaskActive) {
                          store.setViewportMode('lit', null);
                        } else {
                          store.setViewportMode('mask-bw', idx);
                        }
                      }}
                      style={{
                        padding: '2px 7px',
                        borderRadius: 4,
                        fontSize: 9,
                        fontWeight: 700,
                        border: '1px solid #475569',
                        background: isMaskActive ? '#facc15' : '#0f172a',
                        color: isMaskActive ? '#000' : '#e2e8f0',
                        cursor: 'pointer',
                      }}
                    >
                      [M] Mask
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        store.removeLayer(idx);
                      }}
                      style={{ padding: '2px 6px', fontSize: 9, background: '#0f172a', color: '#f87171', border: '1px solid #ef4444', borderRadius: 3, cursor: 'pointer' }}
                    >
                      ×
                    </button>
                  </div>
                </div>

                {/* Expanded Layer Controls: Blend Mode, Opacity, Height Blend & Channel Writes */}
                {isExpanded && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                      paddingTop: 6,
                      borderTop: '1px solid #243046',
                      fontSize: 10,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>Mask Blend Mode</span>
                      <select
                        value={layer.mask.inputs[0]?.blend ?? 'normal'}
                        onChange={(e) => {
                          const mode = e.target.value as BlendMode;
                          const firstInput = layer.mask.inputs[0] ?? { kind: 'all', blend: 'normal', opacity: 1, invert: false };
                          store.updateLayerMask(idx, {
                            inputs: [{ ...firstInput, blend: mode }, ...layer.mask.inputs.slice(1)],
                          });
                        }}
                        style={{
                          padding: '2px 6px',
                          borderRadius: 4,
                          background: '#0f172a',
                          color: '#38bdf8',
                          border: '1px solid #334155',
                          fontSize: 10,
                        }}
                      >
                        {BLEND_MODES.map((bm) => (
                          <option key={bm} value={bm}>
                            {bm}
                          </option>
                        ))}
                      </select>
                    </div>

                    <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Height Blend (Pits / Crevices)</span>
                        <span style={{ color: '#38bdf8' }}>{Math.round(layer.heightBlend * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.02}
                        value={layer.heightBlend}
                        onChange={(e) =>
                          store.updateLayer(idx, { heightBlend: parseFloat(e.target.value) })
                        }
                      />
                    </label>

                    <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Layer Opacity</span>
                        <span style={{ color: '#38bdf8' }}>{Math.round(layer.opacity * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.02}
                        value={layer.opacity}
                        onChange={(e) =>
                          store.updateLayer(idx, { opacity: parseFloat(e.target.value) })
                        }
                      />
                    </label>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 2 }}>
                      {CHANNEL_GROUPS.map((ch) => {
                        const on = layer.writes.includes(ch);
                        return (
                          <button
                            key={ch}
                            onClick={() => store.toggleLayerChannelWrite(idx, ch)}
                            style={{
                              padding: '2px 6px',
                              borderRadius: 4,
                              fontSize: 9,
                              border: on ? '1px solid #38bdf8' : '1px solid #334155',
                              background: on ? 'rgba(56, 189, 248, 0.2)' : '#0f172a',
                              color: on ? '#e0f2fe' : '#64748b',
                              cursor: 'pointer',
                            }}
                          >
                            {ch}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
