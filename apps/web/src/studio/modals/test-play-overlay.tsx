import React, { useEffect } from 'react';
import type { StudioState, StudioStore } from '../state/studio-store';

export interface TestPlayOverlayProps {
  state: StudioState;
  store: StudioStore;
}

export const TestPlayOverlay: React.FC<TestPlayOverlayProps> = ({ state, store }) => {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && state.testPlayActive) {
        store.exitTestPlaySandbox();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [state.testPlayActive, store]);

  if (!state.testPlayActive) return null;

  const activeWorld = state.worlds[state.activeWorldId]!;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'radial-gradient(circle at center, rgba(14, 22, 36, 0.35), rgba(5, 8, 15, 0.92))',
        zIndex: 900,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: 24,
        color: '#f8fafc',
      }}
    >
      {/* Top Sandbox HUD Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '10px 18px',
          borderRadius: 8,
          background: 'rgba(15, 23, 42, 0.9)',
          border: '1px solid #10b981',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span
            style={{
              padding: '4px 10px',
              borderRadius: 4,
              background: '#10b981',
              color: '#052e16',
              fontWeight: 800,
              fontSize: 11,
            }}
          >
            LIVE SANDBOX PLAYTEST
          </span>
          <span style={{ fontSize: 13, fontWeight: 700 }}>
            World: {activeWorld.name} ({activeWorld.stargateAddress})
          </span>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>
            Inspecting: {state.activeKitId} | Beam Mode: {state.testPlayBeamMode.toUpperCase()}
          </span>
        </div>

        <button
          onClick={() => store.exitTestPlaySandbox()}
          style={{
            padding: '6px 14px',
            borderRadius: 6,
            border: '1px solid #f87171',
            background: 'rgba(239, 68, 68, 0.2)',
            color: '#fecaca',
            fontWeight: 700,
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          [Esc] Return to Studio (State Preserved)
        </button>
      </div>

      {/* Center Reticle */}
      <div style={{ alignSelf: 'center', textAlign: 'center', pointerEvents: 'none' }}>
        <div
          style={{
            width: 18,
            height: 18,
            border: '2px solid #38bdf8',
            borderRadius: '50%',
            margin: '0 auto 8px',
          }}
        />
        <div style={{ fontSize: 11, color: '#bae6fd' }}>
          Beam Rifle [{state.testPlayBeamMode.toUpperCase()}] | Rover Spawned:{' '}
          {state.testPlayRoverSpawned ? 'Yes ✓' : 'Standby'}
        </div>
      </div>

      {/* Bottom Equipment & Telemetry Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '10px 18px',
          borderRadius: 8,
          background: 'rgba(15, 23, 42, 0.9)',
          border: '1px solid #334155',
          fontSize: 11,
        }}
      >
        <div style={{ display: 'flex', gap: 8 }}>
          {(['extract', 'apply', 'sculpt', 'seal'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => store.setTestPlayBeamMode(mode)}
              style={{
                padding: '4px 10px',
                borderRadius: 4,
                border: state.testPlayBeamMode === mode ? '1px solid #38bdf8' : '1px solid #334155',
                background: state.testPlayBeamMode === mode ? '#0284c7' : '#0f172a',
                color: '#fff',
                fontSize: 10,
                cursor: 'pointer',
              }}
            >
              Beam: {mode.toUpperCase()}
            </button>
          ))}
          <button
            onClick={() => store.toggleTestPlayRover()}
            style={{
              padding: '4px 10px',
              borderRadius: 4,
              border: '1px solid #fbbf24',
              background: state.testPlayRoverSpawned ? 'rgba(251, 191, 36, 0.2)' : '#0f172a',
              color: '#fde68a',
              fontSize: 10,
              cursor: 'pointer',
            }}
          >
            Toggle Scout Rover
          </button>
        </div>
        <div>
          Active Wires: {activeWorld.logicGraph.wires.length} | Placed Machines:{' '}
          {activeWorld.placements.length}
        </div>
      </div>
    </div>
  );
};
