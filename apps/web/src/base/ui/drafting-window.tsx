import React, { useState } from 'react';
import type { BaseActions, DraftView, LatticeView } from '../view';
import { Compass, Hammer, X } from 'lucide-react';
import { ItemGlyph } from './item-glyph';

interface DraftingWindowProps {
  draft: DraftView;
  lattice?: LatticeView;
  actions: BaseActions;
  onClose: () => void;
}

export const DraftingWindow: React.FC<DraftingWindowProps> = ({
  draft,
  lattice,
  actions,
  onClose,
}) => {
  const [selectedPrim, setSelectedPrim] = useState<string | null>('prim_cube');
  const [selectedMap, setSelectedMap] = useState<string | null>('map_basalt');

  const isOutOfRange = lattice ? lattice.here === null : false;

  const handlePickPrim = (id: string) => {
    setSelectedPrim(id);
    actions.pickDraft(id, selectedMap);
  };

  const handlePickMap = (id: string) => {
    setSelectedMap(id);
    actions.pickDraft(selectedPrim, id);
  };

  const result = draft.result;

  const canAfford = !isOutOfRange && result
    ? result.cost.every((c) => c.have >= c.n)
    : false;

  return (
    <div className="hm-modal-overlay" onClick={onClose} data-testid="drafting-modal">
      <div className="hm-window-panel" onClick={(e) => e.stopPropagation()} style={{ minWidth: 840 }}>
        {/* Header */}
        <div className="hm-window-header">
          <div className="hm-window-title">
            <Compass size={18} style={{ color: 'var(--base-cyan)', flexShrink: 0 }} />
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, gap: 2 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>ARCHITECTURAL DRAFTING TABLE</span>
                {isOutOfRange && (
                  <span className="hm-range-badge out">OUT OF RANGE</span>
                )}
              </div>
              <span className="hm-window-subtitle">
                Synthesize Primitives & Texture Maps into Building Blueprints
              </span>
            </div>
          </div>
          <button className="hm-window-close-btn" onClick={onClose} data-testid="drafting-close-btn">
            <X size={14} /> ESC
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
                    <div className="hm-slot-icon-box">
                      <ItemGlyph item={slot.item} size={22} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{slot.item.name}</span>
                      <span style={{ fontSize: 11, color: 'var(--base-text-muted)' }}>
                        Mass: {slot.item.kg} kg
                      </span>
                    </div>
                  </div>
                  {isOutOfRange ? (
                    <span className="hm-out-of-range-tag">out of range</span>
                  ) : (
                    <span style={{ fontFamily: 'Oxanium', fontSize: 12, color: 'var(--base-cyan)' }}>
                      x{slot.n}
                    </span>
                  )}
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
                    <div className="hm-slot-icon-box">
                      <ItemGlyph item={slot.item} size={22} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{slot.item.name}</span>
                      <span style={{ fontSize: 11, color: 'var(--base-text-muted)' }}>
                        Albedo / PBR
                      </span>
                    </div>
                  </div>
                  {isOutOfRange ? (
                    <span className="hm-out-of-range-tag">out of range</span>
                  ) : (
                    <span style={{ fontFamily: 'Oxanium', fontSize: 12, color: 'var(--base-cyan)' }}>
                      x{slot.n}
                    </span>
                  )}
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
                    const hasEnough = !isOutOfRange && c.have >= c.n;
                    return (
                      <div
                        key={c.item.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: 12,
                          color: isOutOfRange ? '#f87171' : hasEnough ? '#cbd5e1' : '#f87171',
                        }}
                      >
                        <span>{c.item.name}</span>
                        <span style={{ fontFamily: 'Oxanium' }}>
                          {isOutOfRange ? 'out of range' : `${c.have} / ${c.n}`}
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
                  <Hammer size={14} />
                  <span>
                    {isOutOfRange
                      ? 'OUT OF RANGE'
                      : canAfford
                        ? 'SYNTHESIZE BLUEPRINT'
                        : 'INSUFFICIENT SUBSTRATE'}
                  </span>
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
