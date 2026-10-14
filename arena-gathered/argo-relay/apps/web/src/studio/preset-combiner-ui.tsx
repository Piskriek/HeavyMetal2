// ============================================================================
// File: apps/web/src/studio/preset-combiner-ui.tsx
// Brief: Brief 31 (P1-STUDIO-04 2-Tier Material Designer & #b46bff Preset Combiner)
// Rules: Rule 21 (Simple vs Advanced Node Graph Toggle), Rule 23 (Peaceful Anomaly Core Synthesis)
// ============================================================================

import React, { useState } from 'react';

export interface MacroMaterialParams {
  primaryHueDeg: number;   // 0..360
  grainScale: number;      // 0.2..4.0
  weatheringMoss: number;  // 0.0..1.0
  roughness: number;       // 0.1..1.0
  bumpDepth: number;       // 0.0..2.0
}

export interface PresetCombinerUiProps {
  availableCartridges: Array<{ id: string; name: string; metric: string; hexColor: string }>;
  pocketSalvage: number;
  blankCartridges: number;
  anomalyCores: number;
  onSynthesizePeacefulCore: () => void; // Rule 23: 2 Salvage + 1 Blank Cartridge -> 1 Anomaly Core
  onSpliceGoldenMaster: (slotAId: string, slotBId: string, macros: MacroMaterialParams) => void;
}

export const PresetCombinerUi: React.FC<PresetCombinerUiProps> = ({
  availableCartridges,
  pocketSalvage,
  blankCartridges,
  anomalyCores,
  onSynthesizePeacefulCore,
  onSpliceGoldenMaster,
}) => {
  const [showAdvancedNodeGraph, setShowAdvancedNodeGraph] = useState(false);
  const [slotA, setSlotA] = useState<string>(availableCartridges[0]?.id ?? '');
  const [slotB, setSlotB] = useState<string>(availableCartridges[1]?.id ?? '');
  const [macros, setMacros] = useState<MacroMaterialParams>({
    primaryHueDeg: 135,
    grainScale: 1.0,
    weatheringMoss: 0.35,
    roughness: 0.65,
    bumpDepth: 1.0,
  });

  const canPeacefulSynth = pocketSalvage >= 2 && blankCartridges >= 1;
  const canSpliceMaster = Boolean(slotA && slotB && slotA !== slotB && anomalyCores >= 1);

  return (
    <div className="hud-card" style={{ padding: 16, borderLeft: '4px solid #b46bff', display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Header & Rule 21 Simple/Advanced Toggle */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 11, color: '#b46bff' }}>SYNTHESIS BAY // #b46bff VIOLET PLASMA</div>
          <div style={{ fontSize: 15, fontWeight: 700, fontFamily: 'var(--hud-font-display)' }}>
            PRESET COMBINER &amp; MATERIAL DESIGNER
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowAdvancedNodeGraph((v) => !v)}
          style={{ padding: '4px 10px', fontSize: 11, cursor: 'pointer', color: '#3dc8ff' }}
        >
          [{showAdvancedNodeGraph ? 'Tier 2: @hm/texgraph Node DAG' : 'Tier 1: Macro Preset Sliders'}]
        </button>
      </div>

      {/* 2-Slot Cartridge Splicer */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 10, alignItems: 'center' }}>
        <select
          value={slotA}
          onChange={(e) => setSlotA(e.target.value)}
          style={{ padding: 8, background: 'var(--hud-bg-elevated)', color: 'var(--hud-text)' }}
        >
          {availableCartridges.map((c) => (
            <option key={c.id} value={c.id}>
              Slot A: {c.name} ({c.metric})
            </option>
          ))}
        </select>

        <span style={{ fontSize: 16, fontWeight: 700, color: '#b46bff' }}>+</span>

        <select
          value={slotB}
          onChange={(e) => setSlotB(e.target.value)}
          style={{ padding: 8, background: 'var(--hud-bg-elevated)', color: 'var(--hud-text)' }}
        >
          {availableCartridges.map((c) => (
            <option key={c.id} value={c.id}>
              Slot B: {c.name} ({c.metric})
            </option>
          ))}
        </select>
      </div>

      {/* Tier 1: 5 Curated Macro Sliders vs. Tier 2: Procedural Node DAG */}
      {!showAdvancedNodeGraph ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, fontSize: 11 }}>
          <label>
            Hue ({macros.primaryHueDeg}&deg;)
            <input
              type="range"
              min={0}
              max={360}
              value={macros.primaryHueDeg}
              onChange={(e) => setMacros((m) => ({ ...m, primaryHueDeg: Number(e.target.value) }))}
              style={{ width: '100%' }}
            />
          </label>
          <label>
            Grain ({macros.grainScale.toFixed(1)}x)
            <input
              type="range"
              min={0.2}
              max={4.0}
              step={0.1}
              value={macros.grainScale}
              onChange={(e) => setMacros((m) => ({ ...m, grainScale: Number(e.target.value) }))}
              style={{ width: '100%' }}
            />
          </label>
          <label>
            Moss ({Math.round(macros.weatheringMoss * 100)}%)
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={macros.weatheringMoss}
              onChange={(e) => setMacros((m) => ({ ...m, weatheringMoss: Number(e.target.value) }))}
              style={{ width: '100%' }}
            />
          </label>
          <label>
            Roughness ({macros.roughness.toFixed(2)})
            <input
              type="range"
              min={0.1}
              max={1.0}
              step={0.05}
              value={macros.roughness}
              onChange={(e) => setMacros((m) => ({ ...m, roughness: Number(e.target.value) }))}
              style={{ width: '100%' }}
            />
          </label>
          <label>
            Bump ({macros.bumpDepth.toFixed(1)})
            <input
              type="range"
              min={0}
              max={2.0}
              step={0.1}
              value={macros.bumpDepth}
              onChange={(e) => setMacros((m) => ({ ...m, bumpDepth: Number(e.target.value) }))}
              style={{ width: '100%' }}
            />
          </label>
        </div>
      ) : (
        <div style={{ padding: 12, background: 'rgba(5,6,8,0.82)', border: '1px solid #3dc8ff', fontSize: 11 }}>
          <strong>@hm/texgraph Procedural DAG:</strong> [SimplexNoise2D] &rarr; [WarpDomain] &rarr; [HeightToNormal] &rarr; [ConstantMeanColorTierScaler (16px Potato .. 1024px Ultra)]
        </div>
      )}

      {/* Action Buttons: Splice Golden Master (A8-02) + Peaceful Anomaly Core Synthesis (Rule 23) */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
        <button
          type="button"
          disabled={!canPeacefulSynth}
          onClick={onSynthesizePeacefulCore}
          style={{
            padding: '6px 12px',
            fontSize: 11,
            cursor: canPeacefulSynth ? 'pointer' : 'not-allowed',
            opacity: canPeacefulSynth ? 1 : 0.45,
            background: 'var(--hud-bg-elevated)',
            color: '#3dc8ff',
            border: '1px solid #3dc8ff',
          }}
        >
          [Peaceful Synthesis (Rule 23): 2 Salvage + 1 Blank &rarr; +1 Anomaly Core]
        </button>

        <button
          type="button"
          disabled={!canSpliceMaster}
          onClick={() => onSpliceGoldenMaster(slotA, slotB, macros)}
          style={{
            padding: '7px 14px',
            fontSize: 12,
            fontWeight: 700,
            cursor: canSpliceMaster ? 'pointer' : 'not-allowed',
            opacity: canSpliceMaster ? 1 : 0.45,
            background: '#b46bff',
            color: '#050608',
            border: 'none',
          }}
        >
          [Splice Golden Master .SMX (Requires 1 Anomaly Core)]
        </button>
      </div>
    </div>
  );
};
