import React, { useState } from 'react';
import { STUDIO_KIT_LIST } from './kits/studio-kit-registry';
import type { StargateAccessMode } from './state/spore-card-codec';
import type { StudioState, StudioStore } from './state/studio-store';

export interface SceneTabProps {
  state: StudioState;
  store: StudioStore;
}

export const SceneTab: React.FC<SceneTabProps> = ({ state, store }) => {
  const [kitToSpawn, setKitToSpawn] = useState<string>(STUDIO_KIT_LIST[0]!.id);
  const [spawnX, setSpawnX] = useState<number>(6);
  const [spawnZ, setSpawnZ] = useState<number>(4);

  const activeWorld = state.worlds[state.activeWorldId]!;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', height: '100%', background: '#090d16', color: '#e2e8f0' }}>
      {/* Left: Planetary Outpost Map & Placed Modular Assemblies */}
      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div
          style={{
            padding: '12px 16px',
            borderRadius: 8,
            background: '#111827',
            border: '1px solid #1e293b',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase' }}>
              Planetary Outpost Scene Layout (100% Modular @hm/kitspec — 0 Legacy .glb Files)
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#38bdf8' }}>
              {activeWorld.name} — {activeWorld.placements.length} Placed Machine(s)
            </div>
          </div>
          <div
            style={{
              padding: '4px 10px',
              borderRadius: 6,
              background: 'rgba(56, 189, 248, 0.15)',
              border: '1px solid #38bdf8',
              fontSize: 11,
              fontWeight: 700,
              color: '#bae6fd',
            }}
          >
            Stargate Address: {activeWorld.stargateAddress}
          </div>
        </div>

        {/* Placed Machines Table */}
        <div
          style={{
            flex: 1,
            background: '#111827',
            border: '1px solid #1e293b',
            borderRadius: 8,
            padding: 14,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          {activeWorld.placements.map((m) => (
            <div
              key={m.instanceId}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 12px',
                borderRadius: 6,
                background: '#162032',
                border: '1px solid #243046',
              }}
            >
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#f8fafc' }}>
                  {m.label} <span style={{ color: '#38bdf8', fontSize: 11 }}>({m.kitId})</span>
                </div>
                <div style={{ fontSize: 10, color: '#94a3b8' }}>
                  Instance: {m.instanceId} | Pos: [{m.position.map((n) => n.toFixed(1)).join(', ')}] | Grounded:{' '}
                  {m.grounded ? 'Yes ✓' : 'No'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={() => {
                    store.selectKit(m.kitId);
                    store.setActiveWorkspace('creative-suite');
                  }}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 4,
                    border: '1px solid #38bdf8',
                    background: 'rgba(56, 189, 248, 0.15)',
                    color: '#e0f2fe',
                    fontSize: 11,
                    cursor: 'pointer',
                  }}
                >
                  Inspect in Suite
                </button>
                <button
                  onClick={() => store.removeWorldPlacement(m.instanceId)}
                  style={{
                    padding: '4px 8px',
                    borderRadius: 4,
                    border: '1px solid #ef4444',
                    background: 'transparent',
                    color: '#f87171',
                    fontSize: 11,
                    cursor: 'pointer',
                  }}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right Inspector: Place Modular Machine + Stargate Network Config */}
      <div
        style={{
          borderLeft: '1px solid #1e293b',
          background: '#0f172a',
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 700, color: '#38bdf8' }}>
          Place Modular Kit on Planet Terrain
        </div>
        <select
          value={kitToSpawn}
          onChange={(e) => setKitToSpawn(e.target.value)}
          style={{
            padding: 8,
            borderRadius: 6,
            background: '#1e293b',
            color: '#fff',
            border: '1px solid #334155',
            fontSize: 11,
          }}
        >
          {STUDIO_KIT_LIST.map((k) => (
            <option key={k.id} value={k.id}>
              {k.label} ({k.id})
            </option>
          ))}
        </select>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <label style={{ fontSize: 11 }}>
            X (m)
            <input
              type="number"
              value={spawnX}
              onChange={(e) => setSpawnX(parseFloat(e.target.value) || 0)}
              style={{ width: '100%', padding: 6, marginTop: 4, background: '#1e293b', color: '#fff', border: '1px solid #334155', borderRadius: 4 }}
            />
          </label>
          <label style={{ fontSize: 11 }}>
            Z (m)
            <input
              type="number"
              value={spawnZ}
              onChange={(e) => setSpawnZ(parseFloat(e.target.value) || 0)}
              style={{ width: '100%', padding: 6, marginTop: 4, background: '#1e293b', color: '#fff', border: '1px solid #334155', borderRadius: 4 }}
            />
          </label>
        </div>

        <button
          onClick={() => store.placeKitInActiveWorld(kitToSpawn, [spawnX, 0, spawnZ], 0)}
          style={{
            padding: '8px 12px',
            borderRadius: 6,
            border: 'none',
            background: '#0284c7',
            color: '#fff',
            fontWeight: 700,
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          + Place &amp; Auto-Ground on Terrain
        </button>

        <button
          onClick={() => store.autoGroundWorldPlacements()}
          style={{
            padding: '6px 12px',
            borderRadius: 6,
            border: '1px solid #f59e0b',
            background: 'rgba(245, 158, 11, 0.14)',
            color: '#fbbf24',
            fontWeight: 700,
            fontSize: 11,
            cursor: 'pointer',
          }}
        >
          ⚡ Auto-Ground All Placed Machines
        </button>

        <div style={{ fontSize: 12, fontWeight: 700, color: '#fbbf24', marginTop: 12 }}>
          Network Stargate Access Mode (@hm/coopnet)
        </div>
        {(['open', 'code-only', 'closed'] as StargateAccessMode[]).map((mode) => (
          <label
            key={mode}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 10px',
              borderRadius: 6,
              background: activeWorld.stargateAccess === mode ? 'rgba(251, 191, 36, 0.16)' : '#162032',
              border: activeWorld.stargateAccess === mode ? '1px solid #fbbf24' : '1px solid #243046',
              fontSize: 11,
              cursor: 'pointer',
            }}
          >
            <input
              type="radio"
              checked={activeWorld.stargateAccess === mode}
              onChange={() => store.updateActiveWorldLook({ stargateAccess: mode })}
            />
            <span>
              <strong>{mode.toUpperCase()}</strong> —{' '}
              {mode === 'open'
                ? 'Public Stargate directory'
                : mode === 'code-only'
                ? 'Visitors dial via Spore Card address'
                : 'Offline / Single-player'}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
};
