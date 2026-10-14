// ============================================================================
// File: apps/web/src/studio/asset-bench-4angle.tsx
// Brief: Brief 31 (4-Angle Review Grid, Stage Scrubber, Socket Gizmo & Keymap Toggle)
// Rules: Rule 16 (Split hard parts onto sockets), Rule 17 (4-Angle Review), DEC-10 (W/E/R default)
// ============================================================================

import React, { useState } from 'react';
import type { HudFidelitySkin } from '../../../../packages/groundshader/src/stage-post.glsl';

export type StudioKeymapMode = 'unreal-wer' | 'blender-grs';
export type AssetFixFlag = 'none' | 'mirror-z' | 'plain-back';
export type SocketAttachmentType = 'child-mesh' | 'feed-hopper' | 'pixel-exhaust' | 'cable-gland';

export interface AssetSocketSpec {
  id: string;
  type: SocketAttachmentType;
  pos: [number, number, number];
  rotDeg: [number, number, number];
  attachedAssetId?: string;
}

export interface StudioAssetManifestPatch {
  assetId: string;
  fix: AssetFixFlag;
  reach: number;
  hold: boolean;
  sockets: AssetSocketSpec[];
}

export interface AssetBench4AngleProps {
  assetId: string;
  initialPatch: StudioAssetManifestPatch;
  activeStageScrub: 'neutral' | HudFidelitySkin;
  onChangeStageScrub: (stage: 'neutral' | HudFidelitySkin) => void;
  onAcceptPatchToRepo: (patch: StudioAssetManifestPatch) => void;
}

export const CANONICAL_4_ANGLES: Array<{ label: string; yawDeg: number; pitchDeg: number; highlightBack?: boolean }> = [
  { label: 'FRONT (0°)',       yawDeg: 0,   pitchDeg: 12 },
  { label: 'RIGHT SIDE (90°)', yawDeg: 90,  pitchDeg: 12 },
  { label: 'BACK FACE (180°)', yawDeg: 180, pitchDeg: 12, highlightBack: true },
  { label: 'ISO 3/4 (45°)',    yawDeg: 45,  pitchDeg: 28 },
];

export const AssetBench4Angle: React.FC<AssetBench4AngleProps> = ({
  assetId,
  initialPatch,
  activeStageScrub,
  onChangeStageScrub,
  onAcceptPatchToRepo,
}) => {
  const [keymap, setKeymap] = useState<StudioKeymapMode>('unreal-wer'); // DEC-10 default: W/E/R
  const [fourAngleMode, setFourAngleMode] = useState(true);
  const [patch, setPatch] = useState<StudioAssetManifestPatch>(initialPatch);

  const addSocket = (type: SocketAttachmentType) => {
    const nextSocket: AssetSocketSpec = {
      id: `${type}-${patch.sockets.length + 1}`,
      type,
      pos: [0, 1.0, 0],
      rotDeg: [0, 0, 0],
    };
    setPatch((prev) => ({ ...prev, sockets: [...prev.sockets, nextSocket] }));
  };

  return (
    <div className="hud-card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* 1. Top Studio Toolbar: Stage 0a-6 Lighting Scrubber + Unreal/Blender Keymap Toggle (DEC-10) */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, color: 'var(--hud-text-dim)' }}>STAGE SHADER SCRUB:</span>
          {(['neutral', '0a', '0b', '1', '2', '3', '4-6'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => onChangeStageScrub(st)}
              style={{
                padding: '3px 8px',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
                background: activeStageScrub === st ? '#ffc13d' : 'rgba(255,255,255,0.08)',
                color: activeStageScrub === st ? '#050608' : '#e8eef5',
                border: '1px solid rgba(255,255,255,0.2)',
              }}
            >
              {st === 'neutral' ? 'STUDIO NEUTRAL' : `S${st.toUpperCase()}`}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={() => setFourAngleMode((v) => !v)}
            style={{ padding: '3px 10px', fontSize: 11, cursor: 'pointer' }}
          >
            [{fourAngleMode ? '4-Angle Review: ON (Rule 17)' : 'Single Viewport'}]
          </button>
          <button
            type="button"
            onClick={() => setKeymap((k) => (k === 'unreal-wer' ? 'blender-grs' : 'unreal-wer'))}
            style={{ padding: '3px 10px', fontSize: 11, cursor: 'pointer', color: '#3dc8ff' }}
          >
            Keymap: {keymap === 'unreal-wer' ? 'Unreal (W / E / R)' : 'Blender (G / R / S)'}
          </button>
        </div>
      </div>

      {/* 2. Synchronized 4-Angle Review Grid (Rule 17 — Catches invented or black back faces immediately) */}
      {fourAngleMode && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          {CANONICAL_4_ANGLES.map((ang) => (
            <div
              key={ang.label}
              data-studio-angle={ang.yawDeg}
              style={{
                height: 140,
                padding: 8,
                background: 'rgba(5, 6, 8, 0.78)',
                border: ang.highlightBack ? '1px solid #ff3d8a' : '1px solid rgba(255,255,255,0.16)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ fontSize: 10, fontWeight: 700, color: ang.highlightBack ? '#ff3d8a' : 'var(--hud-text-dim)' }}>
                {ang.label}
              </div>
              <div style={{ fontSize: 10, color: 'var(--hud-text-dim)' }}>
                Yaw {ang.yawDeg}&deg; / Pitch {ang.pitchDeg}&deg;
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 3. One-Click Manifest Repair Flags (writes to docs/runworld/assets.json via Changes Panel) */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12 }}>
          <strong>Asset: {assetId}</strong>
          <label>
            Back-Face Fix:{' '}
            <select
              value={patch.fix}
              onChange={(e) => setPatch((p) => ({ ...p, fix: e.target.value as AssetFixFlag }))}
              style={{ background: '#101726', color: '#fff', padding: '2px 6px' }}
            >
              <option value="none">None (Clean 360°)</option>
              <option value="mirror-z">fix: &apos;mirror-z&apos; (Symmetric Front-to-Back)</option>
              <option value="plain-back">fix: &apos;plain-back&apos; (Flat Industrial Rear Plate)</option>
            </select>
          </label>
          <label>
            <input
              type="checkbox"
              checked={patch.reach === 3}
              onChange={(e) => setPatch((p) => ({ ...p, reach: e.target.checked ? 3 : 1 }))}
            />{' '}
            reach: 3
          </label>
          <label>
            <input
              type="checkbox"
              checked={patch.hold}
              onChange={(e) => setPatch((p) => ({ ...p, hold: e.target.checked }))}
            />{' '}
            hold: true (Lock Keeper)
          </label>
        </div>

        <button
          type="button"
          onClick={() => onAcceptPatchToRepo(patch)}
          style={{
            padding: '5px 14px',
            background: '#7cff4d',
            color: '#050608',
            fontWeight: 700,
            fontSize: 12,
            border: 'none',
            cursor: 'pointer',
          }}
        >
          [Accept &amp; Write to assets.json]
        </button>
      </div>

      {/* 4. Rule 16 Socket & Plume-Point Attachment Editor */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.14)', paddingTop: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--hud-text-dim)' }}>
            RULE 16 SOCKETS ({patch.sockets.length}): Separate Feed Hopper (In) vs. Pixel Exhaust (Out) &amp; Hard-Part Mounts
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button type="button" onClick={() => addSocket('feed-hopper')} style={{ fontSize: 10, padding: '2px 6px' }}>
              + Feed Hopper (In)
            </button>
            <button type="button" onClick={() => addSocket('pixel-exhaust')} style={{ fontSize: 10, padding: '2px 6px' }}>
              + Pixel Exhaust (Out)
            </button>
            <button type="button" onClick={() => addSocket('child-mesh')} style={{ fontSize: 10, padding: '2px 6px' }}>
              + Child Part Socket
            </button>
            <button type="button" onClick={() => addSocket('cable-gland')} style={{ fontSize: 10, padding: '2px 6px' }}>
              + Cable Gland
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
