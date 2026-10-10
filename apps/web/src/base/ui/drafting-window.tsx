import React, { useState } from 'react';
import type { BaseActions, DraftView } from '../view';

interface DraftingWindowProps {
  draft: DraftView;
  actions: BaseActions;
  onClose: () => void;
}

export const DraftingWindow: React.FC<DraftingWindowProps> = ({
  draft,
  actions,
  onClose,
}) => {
  const [selectedPrim, setSelectedPrim] = useState<string | null>('prim_cube');
  const [selectedMap, setSelectedMap] = useState<string | null>('map_basalt');

  const handlePickPrim = (id: string) => {
    setSelectedPrim(id);
    actions.pickDraft(id, selectedMap);
  };

  const handlePickMap = (id: string) => {
    setSelectedMap(id);
    actions.pickDraft(selectedPrim, id);
  };

  const result = draft.result;

  const canAfford = result
    ? result.cost.every((c) => c.have >= c.n)
    : false;

  return (
    <div className="hm-modal-overlay" onClick={onClose} data-testid="drafting-modal">
      <div className="hm-window-panel" onClick={(e) => e.stopPropagation()} style={{ minWidth: 840 }}>
        {/* Header */}
        <div className="hm-window-header">
          <div className="hm-window-title">
            <span>📐 ARCHITECTURAL DRAFTING TABLE</span>
            <span style={{ fontSize: 12, opacity: 0.6, textTransform: 'none' }}>
              Synthesize Primitives & Texture Maps into Building Blueprints
            </span>
          </div>
          <button className="hm-window-close-btn" onClick={onClose} data-testid="drafting-close-btn">
            ✕ ESC
          </button>
        </div>

        {/* 3-Column Layout */}
        <div className="hm-drafting-layout">
          {/* Column 1: Primitives */}
          <div className="hm-draft-column">
            <span className="hm-draft-col-header">1. GEOMETRIC PRIMITIVES</span>
            {draft.primitives.map((slot) => {
              if (!slot.item) return null;
              const isSelected = selectedPrim === slot.item.id;

              return (
                <div
                  key={slot.item.id}
                  className={`hm-draft-item-card ${isSelected ? 'selected' : ''}`}
                  onClick={() => handlePickPrim(slot.item!.id)}
                  data-testid={`prim-pick-${slot.item.id}`}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div
                      className="hm-slot-icon-box"
                      style={{ background: slot.item.tint, width: 22, height: 22 }}
                    />
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{slot.item.name}</span>
                      <span style={{ fontSize: 11, color: 'var(--base-text-muted)' }}>
                        Mass: {slot.item.kg} kg
                      </span>
                    </div>
                  </div>
                  <span style={{ fontFamily: 'Oxanium', fontSize: 12, color: 'var(--base-cyan)' }}>
                    x{slot.n}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Column 2: Material Maps */}
          <div className="hm-draft-column">
            <span className="hm-draft-col-header">2. MATERIAL TEXTURE MAPS</span>
            {draft.maps.map((slot) => {
              if (!slot.item) return null;
              const isSelected = selectedMap === slot.item.id;

              return (
                <div
                  key={slot.item.id}
                  className={`hm-draft-item-card ${isSelected ? 'selected' : ''}`}
                  onClick={() => handlePickMap(slot.item!.id)}
                  data-testid={`map-pick-${slot.item.id}`}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div
                      className="hm-slot-icon-box"
                      style={{ background: slot.item.tint, width: 22, height: 22 }}
                    />
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{slot.item.name}</span>
                      <span style={{ fontSize: 11, color: 'var(--base-text-muted)' }}>
                        Albedo / PBR
                      </span>
                    </div>
                  </div>
                  <span style={{ fontFamily: 'Oxanium', fontSize: 12, color: 'var(--base-cyan)' }}>
                    x{slot.n}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Column 3: Blueprint Preview */}
          <div className="hm-draft-preview-panel" data-testid="drafting-preview-panel">
            <span className="hm-draft-col-header" style={{ color: '#38bdf8' }}>
              3. BLUEPRINT SYNTHESIS
            </span>

            {result ? (
              <>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#f8fafc' }}>
                    {result.name} Blueprint
                  </div>
                  <div
                    style={{
                      fontFamily: 'Oxanium',
                      fontSize: 12,
                      color: 'var(--base-cyan)',
                      marginTop: 4,
                      textTransform: 'uppercase',
                    }}
                  >
                    Target Piece: {result.piece} ({result.kg} kg)
                  </div>
                </div>

                {/* Valheim Structural Reach Meter */}
                <div className="hm-draft-reach-bars">
                  <div className="hm-reach-row">
                    <span>Vertical Integrity (vKeep)</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div className="hm-reach-bar">
                        <div
                          className="hm-reach-fill"
                          style={{ width: `${result.vKeep * 100}%` }}
                        />
                      </div>
                      <span style={{ fontFamily: 'Oxanium', fontSize: 11 }}>
                        {result.vKeep * 100}%
                      </span>
                    </div>
                  </div>

                  <div className="hm-reach-row">
                    <span>Horizontal Cantilever (hKeep)</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div className="hm-reach-bar">
                        <div
                          className="hm-reach-fill"
                          style={{ width: `${result.hKeep * 100}%`, background: '#38bdf8' }}
                        />
                      </div>
                      <span style={{ fontFamily: 'Oxanium', fontSize: 11 }}>
                        {result.hKeep * 100}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bill of Materials */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--base-text-muted)', textTransform: 'uppercase' }}>
                    REQUIRED SUBSTRATE (NETWORK PULLED)
                  </span>
                  {result.cost.map((c) => {
                    const hasEnough = c.have >= c.n;
                    return (
                      <div
                        key={c.item.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: 12,
                          color: hasEnough ? '#cbd5e1' : '#f87171',
                        }}
                      >
                        <span>{c.item.name}</span>
                        <span style={{ fontFamily: 'Oxanium' }}>
                          {c.have} / {c.n}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <button
                  className="hm-synthesize-btn"
                  disabled={!canAfford}
                  onClick={() => actions.draft()}
                  data-testid="synthesize-draft-btn"
                >
                  {canAfford ? '⚙️ SYNTHESIZE BLUEPRINT' : 'INSUFFICIENT SUBSTRATE'}
                </button>
              </>
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--base-text-muted)', margin: 'auto' }}>
                Select a primitive and texture map to calculate structural properties.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
