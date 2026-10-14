// ============================================================================
// File: apps/web/src/studio/act5-lab-schema-terminal.tsx
// Plans: Plan 12 (P2-HOUR-05 Schema Diff Toast) & Plan 20 (P1-STUDIO-05 Lab Terminal)
// ============================================================================

import React, { useState } from 'react';
import { isJokeDirtRename } from '../../../../packages/content/src/charm-and-act789';

export interface SubstrateSchemaConfig {
  dirtDisplayLabel: string;
  oreDisplayLabel: string;
  gravityMps2: number;
  coherenceSafeDomeRadiusM: number;
}

export interface Act5LabSchemaTerminalProps {
  initialSchema: SubstrateSchemaConfig;
  onAcceptSchemaPatch: (
    nextSchema: SubstrateSchemaConfig,
    triggeredJokeBark: boolean
  ) => void;
  onOpenFullStudioSuite: () => void;
  onClose: () => void;
}

export const Act5LabSchemaTerminal: React.FC<Act5LabSchemaTerminalProps> = ({
  initialSchema,
  onAcceptSchemaPatch,
  onOpenFullStudioSuite,
  onClose,
}) => {
  const [draft, setDraft] = useState<SubstrateSchemaConfig>(initialSchema);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const hasChanges =
    draft.dirtDisplayLabel.trim() !== initialSchema.dirtDisplayLabel.trim() ||
    draft.oreDisplayLabel.trim() !== initialSchema.oreDisplayLabel.trim();

  const handleApply = () => {
    const jokeTriggered = isJokeDirtRename(draft.dirtDisplayLabel);
    setToastMessage(
      `SUBSTRATE PATCH APPLIED // 14 HUD REFERENCES UPDATED ("${draft.dirtDisplayLabel.trim()}")`
    );
    onAcceptSchemaPatch(draft, jokeTriggered);
  };

  return (
    <div
      className="hud-card"
      style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 'min(680px, 92vw)',
        padding: 20,
        zIndex: 45,
        pointerEvents: 'auto',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 10, color: '#b46bff', fontWeight: 700, letterSpacing: '0.1em' }}>
            ACT V // SUBSTRATE SCHEMA INSPECTOR (SECTOR 04)
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, marginTop: 2 }}>
            &ldquo;It&rsquo;s not really dirt, you get that right?&rdquo; &mdash; Dr. Gwen Haddy
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={onOpenFullStudioSuite}
            style={{
              padding: '6px 12px',
              background: 'rgba(180, 107, 255, 0.18)',
              border: '1px solid #b46bff',
              color: '#e8eef5',
              cursor: 'pointer',
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            [Open Full Studio Suite]
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '6px 10px',
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.25)',
              color: '#e8eef5',
              cursor: 'pointer',
              fontSize: 11,
            }}
          >
            [Esc]
          </button>
        </div>
      </div>

      {/* Live Diff Toast (P2-HOUR-05) */}
      {toastMessage && (
        <div
          style={{
            marginBottom: 14,
            padding: '10px 14px',
            background: 'rgba(124, 255, 77, 0.16)',
            borderLeft: '3px solid #7cff4d',
            color: '#7cff4d',
            fontFamily: 'var(--hud-font-mono)',
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          {toastMessage}
        </div>
      )}

      {/* Editable Schema Fields */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div style={{ padding: 12, background: 'var(--hud-bg-elevated)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <label style={{ display: 'block', fontSize: 11, color: 'var(--hud-text-dim)', marginBottom: 6 }}>
            schema.resources.dirt.displayName
          </label>
          <input
            type="text"
            value={draft.dirtDisplayLabel}
            onChange={(e) => setDraft({ ...draft, dirtDisplayLabel: e.target.value })}
            style={{
              width: '100%',
              padding: '7px 10px',
              background: '#050608',
              border: '1px solid #ffc13d',
              color: '#e8eef5',
              fontFamily: 'var(--hud-font-mono)',
              fontSize: 13,
            }}
          />
          <div style={{ fontSize: 10, color: 'var(--hud-text-dim)', marginTop: 6 }}>
            Default: <code>&quot;Dirt&quot;</code> (Try renaming it to see the HUD update live)
          </div>
        </div>

        <div style={{ padding: 12, background: 'var(--hud-bg-elevated)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <label style={{ display: 'block', fontSize: 11, color: 'var(--hud-text-dim)', marginBottom: 6 }}>
            schema.resources.ore.displayName
          </label>
          <input
            type="text"
            value={draft.oreDisplayLabel}
            onChange={(e) => setDraft({ ...draft, oreDisplayLabel: e.target.value })}
            style={{
              width: '100%',
              padding: '7px 10px',
              background: '#050608',
              border: '1px solid rgba(255,255,255,0.25)',
              color: '#e8eef5',
              fontFamily: 'var(--hud-font-mono)',
              fontSize: 13,
            }}
          />
          <div style={{ fontSize: 10, color: 'var(--hud-text-dim)', marginTop: 6 }}>
            Refined at 2:1 ratio from <code>{draft.dirtDisplayLabel || 'Dirt'}</code>
          </div>
        </div>
      </div>

      {/* Changes Diff Panel + Accept Write-Back */}
      <div
        style={{
          marginTop: 14,
          padding: 12,
          background: '#050608',
          border: '1px solid rgba(255,255,255,0.14)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ fontFamily: 'var(--hud-font-mono)', fontSize: 11 }}>
          <span style={{ color: 'var(--hud-text-dim)' }}>CHANGES DIFF: </span>
          {hasChanges ? (
            <span style={{ color: '#ffc13d' }}>
              resources.dirt: &quot;{initialSchema.dirtDisplayLabel}&quot; &rarr; &quot;
              {draft.dirtDisplayLabel}&quot;
            </span>
          ) : (
            <span style={{ color: 'var(--hud-text-dim)' }}>No pending schema edits</span>
          )}
        </div>
        <button
          type="button"
          onClick={handleApply}
          style={{
            padding: '8px 16px',
            background: '#7cff4d',
            color: '#050608',
            border: 'none',
            fontWeight: 700,
            cursor: 'pointer',
            fontSize: 12,
          }}
        >
          Accept &amp; Patch Substrate
        </button>
      </div>
    </div>
  );
};
