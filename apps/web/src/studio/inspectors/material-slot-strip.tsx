/**
 * @file apps/web/src/studio/inspectors/material-slot-strip.tsx
 * STUDIO-44C: Interactive Material Slot Strip for the active 3D Kit or Part.
 *
 * Exposes every material slot (body, trim, bolts, band, hopper, lamps) on the active asset.
 * Supports clicking to focus a part and slot, and toggling scope between This Part and Whole Machine.
 */

import React, { useState } from 'react';
import { globalStudioStore, useStudioState } from '../state/studio-hook';
import './material-slot-strip.css';

export interface MaterialSlotStripProps {
  readonly onScopeChange?: (scope: 'part-override' | 'kit-slot') => void;
  readonly state?: any;
  readonly store?: any;
}

export const MaterialSlotStrip: React.FC<MaterialSlotStripProps> = ({ onScopeChange }) => {
  const state = useStudioState();
  const [scope, setScope] = useState<'part-override' | 'kit-slot'>('kit-slot');

  const slots = globalStudioStore.getMaterialSlotsForActiveKit();

  const handleScopeToggle = (newScope: 'part-override' | 'kit-slot') => {
    setScope(newScope);
    onScopeChange?.(newScope);
  };

  if (slots.length === 0) {
    return (
      <div className="sx-slot-strip-empty" data-testid="material-slot-strip-empty">
        <span>No material slots detected on active asset</span>
      </div>
    );
  }

  return (
    <div className="sx-slot-strip-container" data-testid="material-slot-strip">
      <div className="sx-slot-strip-header">
        <div className="sx-slot-strip-title">
          <span>Material Slots</span>
          <span className="sx-slot-count-pill">{slots.length}</span>
        </div>
        <div className="sx-slot-scope-toggle" role="group" aria-label="Assignment scope">
          <button
            type="button"
            className={`sx-scope-btn ${scope === 'kit-slot' ? 'active' : ''}`}
            onClick={() => handleScopeToggle('kit-slot')}
            title="Apply material changes to all parts sharing this slot across the machine"
            data-testid="scope-whole-machine"
          >
            Whole Machine
          </button>
          <button
            type="button"
            className={`sx-scope-btn ${scope === 'part-override' ? 'active' : ''}`}
            onClick={() => handleScopeToggle('part-override')}
            title="Apply material changes only to the currently selected part"
            data-testid="scope-this-part"
          >
            This Part
          </button>
        </div>
      </div>

      <div className="sx-slot-strip-scroll" role="listbox" aria-label="Asset material slots">
        {slots.map((slot) => {
          const isSelected =
            state.activeSlotKey === slot.slotName ||
            (state.activePartPath !== null && slot.partPaths.includes(state.activePartPath));

          const spec = globalStudioStore.getEffectiveMaterialSpec(slot.materialId);
          const paint0 = spec.paint[0] ?? '#888888';
          const paint1 = spec.paint[1] ?? paint0;

          const isLamp = slot.isLamp || slot.materialId.startsWith('lx:');
          let lampColor = '#ffffff';
          if (isLamp) {
            const parts = slot.materialId.split(':');
            lampColor = parts[4] ? `#${parts[4]}` : '#ffdd88';
          }

          return (
            <button
              key={slot.slotName}
              type="button"
              className={`sx-slot-chip ${isSelected ? 'selected' : ''} ${isLamp ? 'is-lamp' : ''}`}
              onClick={() => {
                const partId = slot.slotName.split(':')[0] ?? null;
                const path = slot.partPaths[0] ?? null;
                globalStudioStore.selectPartAndSlot(path, partId, slot.slotName);
              }}
              title={`${slot.slotName} (${slot.materialId}) — ${slot.partCount} part${slot.partCount === 1 ? '' : 's'}`}
              data-testid={`slot-chip-${slot.slotName}`}
              role="option"
              aria-selected={isSelected}
            >
              <div className="sx-slot-swatch-box">
                {isLamp ? (
                  <span className="sx-slot-lamp-indicator" style={{ backgroundColor: lampColor }} />
                ) : (
                  <>
                    <span className="sx-slot-swatch-half" style={{ backgroundColor: paint0 }} />
                    <span className="sx-slot-swatch-half" style={{ backgroundColor: paint1 }} />
                  </>
                )}
              </div>
              <div className="sx-slot-chip-info">
                <span className="sx-slot-chip-name">{slot.slotName}</span>
                <span className="sx-slot-chip-material">{spec.name}</span>
              </div>
              <span className="sx-slot-part-count">×{slot.partCount}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
