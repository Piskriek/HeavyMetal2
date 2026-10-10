import React, { useState } from 'react';
import type { BaseActions, InventoryView, SlotRef, EquipSlot } from '../view';
import { EQUIP_SLOTS } from '../view';
import { Backpack, Crosshair, Eye, Shield, Wind, X, Zap } from 'lucide-react';
import { ItemGlyph } from './item-glyph';

interface InventoryWindowProps {
  inventory: InventoryView;
  actions: BaseActions;
  onClose: () => void;
}

const EQUIP_PLACEHOLDER_ICONS: Record<EquipSlot, React.ReactNode> = {
  visor: <Eye size={16} opacity={0.3} color="var(--base-cyan)" />,
  shield: <Shield size={16} opacity={0.3} color="var(--base-cyan)" />,
  rebreather: <Wind size={16} opacity={0.3} color="var(--base-cyan)" />,
  beam: <Zap size={16} opacity={0.3} color="var(--base-cyan)" />,
  sidearm: <Crosshair size={16} opacity={0.3} color="var(--base-cyan)" />,
};

export const InventoryWindow: React.FC<InventoryWindowProps> = ({
  inventory,
  actions,
  onClose,
}) => {
  const [selectedSlot, setSelectedSlot] = useState<SlotRef | null>(null);

  const handleSlotClick = (ref: SlotRef) => {
    if (!selectedSlot) {
      // Pick up or select
      selectedSlotRefCheck(ref) ? setSelectedSlot(ref) : setSelectedSlot(null);
    } else {
      // Move / swap
      actions.move(selectedSlot, ref, 0);
      setSelectedSlot(null);
    }
  };

  const selectedSlotRefCheck = (ref: SlotRef): boolean => {
    if (ref.at === 'inventory') {
      return Boolean(inventory.slots[ref.index]?.item);
    }
    if (ref.at === 'equipment') {
      return Boolean(inventory.equipment[ref.slot]?.item);
    }
    return false;
  };

  const weightRatio = Math.min(100, Math.round((inventory.kg / inventory.maxKg) * 100));

  return (
    <div className="hm-modal-overlay" onClick={onClose} data-testid="inventory-modal">
      <div className="hm-window-panel" onClick={(e) => e.stopPropagation()} style={{ minWidth: 620 }}>
        {/* Header */}
        <div className="hm-window-header">
          <div className="hm-window-title">
            <Backpack size={18} style={{ color: 'var(--base-cyan)' }} />
            <span>HAZMAT RESEARCH INVENTORY</span>
            <span style={{ fontSize: 12, opacity: 0.6, textTransform: 'none' }}>[Tab / I to toggle]</span>
          </div>
          <button className="hm-window-close-btn" onClick={onClose} data-testid="inventory-close-btn">
            <X size={14} /> ESC
          </button>
        </div>

        {/* Content Layout */}
        <div className="hm-inv-layout">
          {/* Equipment Column */}
          <div className="hm-equip-column">
            <span style={{ fontFamily: 'Oxanium', fontSize: 11, fontWeight: 700, color: 'var(--base-cyan)' }}>
              SUIT RIG
            </span>
            {EQUIP_SLOTS.map((eqKey) => {
              const eqSlot = inventory.equipment[eqKey];
              const isSelected =
                selectedSlot?.at === 'equipment' && selectedSlot.slot === eqKey;

              return (
                <div
                  key={eqKey}
                  className={`hm-equip-slot ${isSelected ? 'selected' : ''}`}
                  onClick={() => handleSlotClick({ at: 'equipment', slot: eqKey })}
                  title={eqSlot.item ? `${eqSlot.item.name} (${eqSlot.item.kg}kg)` : `Empty ${eqKey}`}
                  data-testid={`equip-slot-${eqKey}`}
                >
                  <div className={`hm-slot-icon-box ${!eqSlot.item ? 'empty-equip' : ''}`}>
                    {eqSlot.item ? (
                      <ItemGlyph item={eqSlot.item} size={20} />
                    ) : (
                      EQUIP_PLACEHOLDER_ICONS[eqKey]
                    )}
                  </div>
                  <span className="hm-equip-label">{eqKey}</span>
                </div>
              );
            })}
          </div>

          {/* 9x4 Grid */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="hm-grid-9x4" data-testid="inventory-grid">
              {inventory.slots.map((slot, idx) => {
                const isSelected =
                  selectedSlot?.at === 'inventory' && selectedSlot.index === idx;
                const isHotbarRow = idx < 9;
                const item = slot.item;

                return (
                  <div
                    key={idx}
                    className={`hm-inv-slot ${isHotbarRow ? 'is-hotbar-row' : ''} ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleSlotClick({ at: 'inventory', index: idx })}
                    data-testid={`inv-slot-${idx}`}
                    title={
                      item
                        ? `${item.name} (${item.kind})\nStack: ${slot.n} / ${item.stack}\nUnit: ${item.kg} kg`
                        : isHotbarRow
                          ? `Hotbar Slot ${idx + 1}`
                          : `Slot ${idx + 1}`
                    }
                  >
                    {isHotbarRow && (
                      <span className="hm-slot-keybind" style={{ fontSize: 9 }}>
                        {idx + 1}
                      </span>
                    )}

                    {item && (
                      <div className="hm-slot-icon-box">
                        <ItemGlyph item={item} size={26} />
                      </div>
                    )}

                    {item && slot.n > 1 && (
                      <span className="hm-slot-count">{slot.n}</span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Quick Actions & Weight */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                className="hm-quick-stack-btn"
                onClick={() => actions.quickStack()}
                data-testid="quick-stack-btn"
                title="Deposits all matching items into quantum lattice storage"
              >
                <Zap size={13} />
                <span>QUICK STACK TO GRID</span>
              </button>

              <div style={{ width: 220 }} className="hm-weight-bar-container">
                <div className="hm-weight-label">
                  <span>CARGO MASS</span>
                  <span>
                    <strong>{inventory.kg}</strong> / {inventory.maxKg} kg
                  </span>
                </div>
                <div className="hm-weight-bar-track">
                  <div
                    className="hm-weight-bar-fill"
                    style={{
                      width: `${weightRatio}%`,
                      background: weightRatio > 90 ? '#ef4444' : 'linear-gradient(90deg, #00f0ff, #10b981)',
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
