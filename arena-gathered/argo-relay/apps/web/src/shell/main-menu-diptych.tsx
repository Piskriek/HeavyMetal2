// ============================================================================
// File: apps/web/src/shell/main-menu-diptych.tsx
// Brief: Brief 28 (DEC-08 Live 3D Lab Dual-Contrast Main Menu & Rule 22 Subsystem Loader)
// ============================================================================

import React from 'react';

export interface PreloadSubsystemProgress {
  stageLabel:
    | 'Compiling S-Space Shaders...'
    | 'Syncing Lunar Lattice...'
    | 'Calibrating Bridge Array...'
    | 'Mounting 3-LOD Asset Registry...'
    | 'Ready';
  percent0to100: number;
}

export interface MainMenuDiptychProps {
  preload: PreloadSubsystemProgress;
  activeProfileName: string;
  hasCompletedCampaign?: boolean;
  onStartExpedition: () => void;
  onOpenPlanetaryGrid: () => void;
  onOpenStudio: () => void;
  onOpenWorkshop: () => void;
  onOpenCreditsVideo: () => void;
  onOpenSettings: () => void;
}

export const MainMenuDiptych: React.FC<MainMenuDiptychProps> = ({
  preload,
  activeProfileName,
  hasCompletedCampaign = false,
  onStartExpedition,
  onOpenPlanetaryGrid,
  onOpenStudio,
  onOpenWorkshop,
  onOpenCreditsVideo,
  onOpenSettings,
}) => {
  const isReady = preload.percent0to100 >= 100;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '36px 44px',
        zIndex: 30,
      }}
    >
      {/* Left Third Angled Glassmorphic Menu Blade (Leaves Center Window & Right Gate unobstructed!) */}
      <div
        className="hud-card"
        style={{
          width: 340,
          padding: '24px 24px',
          pointerEvents: 'auto',
          borderLeft: '4px solid #ffc13d',
        }}
      >
        <div style={{ fontSize: 11, color: '#ffc13d', letterSpacing: '0.12em' }}>
          SECTOR 04 // OPERATOR: {activeProfileName.toUpperCase()}
        </div>
        <h1
          style={{
            margin: '4px 0 2px 0',
            fontSize: 32,
            fontWeight: 800,
            fontFamily: 'Oxanium, sans-serif',
            letterSpacing: '0.06em',
          }}
        >
          FIDELITY
        </h1>
        <div style={{ fontSize: 12, color: 'var(--hud-text-dim)', marginBottom: 20 }}>
          THE SETMIX MULTIVERSE
        </div>

        {/* Rule 22 Real Subsystem Preload Bar (Replaces placeholder "Growing the trees") */}
        {!isReady ? (
          <div style={{ margin: '16px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 6 }}>
              <span>{preload.stageLabel}</span>
              <span>{Math.round(preload.percent0to100)}%</span>
            </div>
            <div style={{ height: 6, background: 'rgba(255,255,255,0.12)', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${preload.percent0to100}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #ff3d8a, #7cff4d, #ffc13d, #3dc8ff)',
                  transition: 'width 120ms linear',
                }}
              />
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button
              type="button"
              onClick={onStartExpedition}
              style={{
                padding: '10px 14px',
                textAlign: 'left',
                fontSize: 14,
                fontWeight: 700,
                background: '#ffc13d',
                color: '#050608',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              EXPEDITION // ENTER LAB
            </button>
            <button type="button" onClick={onOpenPlanetaryGrid} className="hud-card" style={{ padding: '9px 14px', textAlign: 'left', cursor: 'pointer' }}>
              PLANETARY GRID (40,000 KM)
            </button>
            <button type="button" onClick={onOpenStudio} className="hud-card" style={{ padding: '9px 14px', textAlign: 'left', cursor: 'pointer' }}>
              THE STUDIO (ASSET &amp; SCHEMA SUITE)
            </button>
            <button type="button" onClick={onOpenWorkshop} className="hud-card" style={{ padding: '9px 14px', textAlign: 'left', cursor: 'pointer' }}>
              THE WORKSHOP (.SMX &amp; WAD ARCHIVE)
            </button>
            <button type="button" onClick={onOpenCreditsVideo} className="hud-card" style={{ padding: '9px 14px', textAlign: 'left', cursor: 'pointer', borderColor: hasCompletedCampaign ? '#7cff4d' : undefined }}>
              CREDITS VIDEO // &quot;FOUR FLOATS&quot;
            </button>
            <button type="button" onClick={onOpenSettings} className="hud-card" style={{ padding: '9px 14px', textAlign: 'left', cursor: 'pointer' }}>
              SETTINGS &amp; GRAPHICS TIER
            </button>
          </div>
        )}
      </div>

      {/* Bottom Dual-World Diptych Caption */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--hud-text-dim)' }}>
        <span>LEFT WINDOW: BRIDGE ARRAY EPICENTER [BREACH ACTIVE]</span>
        <span>RIGHT GATE: LUNAR PLOT PREVIEW [S = (Pxd, Vtx, Lx, Aq)]</span>
      </div>
    </div>
  );
};
