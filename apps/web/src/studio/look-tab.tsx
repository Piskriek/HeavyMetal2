import React from 'react';
import { buildStudioMachineModel } from './viewport/build-studio-machine-model';
import type { PreviewStage, StudioState, StudioStore } from './state/studio-store';

export interface LookTabProps {
  state: StudioState;
  store: StudioStore;
}

const STAGES: Array<{ stage: PreviewStage; label: string; desc: string }> = [
  { stage: 'lab-neutral', label: 'Lab Neutral', desc: 'Calibration studio dome' },
  { stage: 0, label: 'S0: Airless Pit', desc: 'Hard vacuum, stark crater shadows, raw basalt' },
  { stage: 1, label: 'S1: Outgassing', desc: 'First vapor vents, low dust haze' },
  { stage: 2, label: 'S2: Frost & Lichen', desc: 'Crater rim frost, pioneer crust' },
  { stage: 3, label: 'S3: Meltwater Ponds', desc: 'Liquid water basins, Rayleigh sky scatter' },
  { stage: 4, label: 'S4: Moss & Shrubs', desc: 'Humus soil enrichment, highland scrub' },
  { stage: 5, label: 'S5: Pine & Streams', desc: 'Oxygenated sky dome, flowing streams' },
  { stage: 6, label: 'S6: Living Biosphere', desc: 'Full canopy, cumulus clouds, vibrant biome' },
];

export const LookTab: React.FC<LookTabProps> = ({ state, store }) => {
  const activeWorld = state.worlds[state.activeWorldId]!;
  const activeEntry = state.kits[state.activeKitId]!;

  // Live procedural model generation via buildStudioMachineModel (replaces legacy loadGenRaw!)
  const previewBuilt = React.useMemo(() => {
    return buildStudioMachineModel({
      kit: activeEntry.kit,
      presetId: activeEntry.rootPreset,
      overrides: state.overridesByKit[state.activeKitId],
      materials: state.materials,
      activeMaterialId: state.activeMaterialId,
      hoveredMaterialId: state.hoveredMaterialId,
      showSockets: false,
    });
  }, [activeEntry, state.overridesByKit, state.activeKitId, state.materials, state.activeMaterialId, state.hoveredMaterialId]);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', height: '100%', background: '#090d16', color: '#e2e8f0' }}>
      {/* Center Terrain + Machine Look Preview */}
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 20 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '10px 14px',
            borderRadius: 8,
            background: 'rgba(15, 23, 42, 0.85)',
            border: '1px solid #1e293b',
          }}
        >
          <div>
            <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase' }}>
              Look &amp; Lighting Stage Preview (@hm/groundshader + buildStudioMachineModel)
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#38bdf8' }}>
              {activeWorld.name} — {activeEntry.label} ({previewBuilt.partCount} parts, {previewBuilt.triangleCount} tris, 0 GLBs)
            </div>
          </div>
          <div style={{ fontSize: 11, color: '#34d399' }}>
            Biome: <strong>{activeWorld.biome}</strong> | Seed: <strong>{activeWorld.seed}</strong>
          </div>
        </div>

        {/* Stage Scrubber Bar S0 -> S6 */}
        <div
          style={{
            padding: 14,
            borderRadius: 8,
            background: 'rgba(15, 23, 42, 0.92)',
            border: '1px solid #1e293b',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 700 }}>
            <span>Terraforming Stage Scrubber (Lab / S0 → S6)</span>
            <span style={{ color: '#38bdf8' }}>
              {STAGES.find((s) => s.stage === state.previewStage)?.label}
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 6 }}>
            {STAGES.map((item) => {
              const active = state.previewStage === item.stage;
              return (
                <button
                  key={String(item.stage)}
                  onClick={() => store.setPreviewStage(item.stage)}
                  title={item.desc}
                  style={{
                    padding: '8px 4px',
                    borderRadius: 6,
                    border: active ? '2px solid #38bdf8' : '1px solid #334155',
                    background: active ? 'rgba(56, 189, 248, 0.2)' : '#0f172a',
                    color: active ? '#fff' : '#94a3b8',
                    fontSize: 10,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {item.stage === 'lab-neutral' ? 'LAB' : `S${item.stage}`}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Right Column: Four Floats S = (pxd, vtx, lx, aq) + Sun & Sky Controls */}
      <div
        style={{
          borderLeft: '1px solid #1e293b',
          background: '#0f172a',
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          overflowY: 'auto',
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 700, color: '#38bdf8' }}>
          Atmospheric Four Floats S = (Pxd, Vtx, Lx, Aq)
        </div>
        {(['pxd', 'vtx', 'lx', 'aq'] as const).map((key) => (
          <label key={key} style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>{key.toUpperCase()}</span>
              <span style={{ color: '#38bdf8' }}>{activeWorld.floats[key]}</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={activeWorld.floats[key]}
              onChange={(e) =>
                store.updateActiveWorldLook({
                  floats: { ...activeWorld.floats, [key]: parseFloat(e.target.value) },
                })
              }
            />
          </label>
        ))}

        <div style={{ fontSize: 12, fontWeight: 700, color: '#fbbf24', marginTop: 8 }}>
          Solar &amp; Sky Dome Lighting
        </div>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Sun Elevation (°)</span>
            <span>{activeWorld.sunElevationDeg}°</span>
          </div>
          <input
            type="range"
            min={5}
            max={85}
            step={1}
            value={activeWorld.sunElevationDeg}
            onChange={(e) => store.updateActiveWorldLook({ sunElevationDeg: parseFloat(e.target.value) })}
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Sun Azimuth (°)</span>
            <span>{activeWorld.sunAzimuthDeg}°</span>
          </div>
          <input
            type="range"
            min={0}
            max={360}
            step={1}
            value={activeWorld.sunAzimuthDeg}
            onChange={(e) => store.updateActiveWorldLook({ sunAzimuthDeg: parseFloat(e.target.value) })}
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Sky Dome Turbidity</span>
            <span>{activeWorld.skyTurbidity.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={activeWorld.skyTurbidity}
            onChange={(e) => store.updateActiveWorldLook({ skyTurbidity: parseFloat(e.target.value) })}
          />
        </label>
      </div>
    </div>
  );
};
