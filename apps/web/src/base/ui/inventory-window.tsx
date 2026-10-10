import React, { useState } from 'react';
import type { BaseActions, InventoryView, SlotRef, EquipSlot } from '../view';
import { EQUIP_SLOTS } from '../view';
import { FORGE_BY_ID, PART_SLOTS, type PartSlot } from '../catalog';
import { weaponStats } from '../weapons';
import { Backpack, Crosshair, Eye, Flame, Shield, Sparkles, Wind, X, Zap } from 'lucide-react';
import { ItemGlyph } from './item-glyph';

interface InventoryWindowProps {
  inventory: InventoryView;
  actions: BaseActions;
  loadout?: Readonly<Record<PartSlot, string | null>>;
  onFit?: (slot: PartSlot, item: string | null) => void;
  onClose: () => void;
}

const EQUIP_PLACEHOLDER_ICONS: Record<EquipSlot, React.ReactNode> = {
  visor: <Eye size={16} opacity={0.3} color="var(--base-cyan)" />,
  shield: <Shield size={16} opacity={0.3} color="var(--base-cyan)" />,
  rebreather: <Wind size={16} opacity={0.3} color="var(--base-cyan)" />,
  beam: <Zap size={16} opacity={0.3} color="var(--base-cyan)" />,
  sidearm: <Crosshair size={16} opacity={0.3} color="var(--base-cyan)" />,
};

const LOADOUT_PLACEHOLDER_ICONS: Record<PartSlot, React.ReactNode> = {
  core: <Flame size={15} opacity={0.35} color="var(--base-cyan)" />,
  barrel: <Zap size={15} opacity={0.35} color="var(--base-cyan)" />,
  sight: <Crosshair size={15} opacity={0.35} color="var(--base-cyan)" />,
  cell: <Sparkles size={15} opacity={0.35} color="var(--base-cyan)" />,
};

export const InventoryWindow: React.FC<InventoryWindowProps> = ({
  inventory,
  actions,
  loadout,
  onFit,
  onClose,
}) => {
  const [selectedSlot, setSelectedSlot] = useState<SlotRef | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; isError: boolean } | null>(null);

  const showFeedback = (text: string, isError = false) => {
    setFeedbackMsg({ text, isError });
    setTimeout(() => setFeedbackMsg(null), 3500);
  };

  const handleSlotClick = (ref: SlotRef) => {
    if (!selectedSlot) {
      if (selectedSlotRefCheck(ref)) {
        setSelectedSlot(ref);
      } else {
        setSelectedSlot(null);
      }
    } else {
      actions.move(selectedSlot, ref, 0);
      setSelectedSlot(null);
    }
  };

  const handleLoadoutSlotClick = (slotKey: PartSlot) => {
    if (!onFit) return;

    if (selectedSlot && selectedSlot.at === 'inventory') {
      const carriedSlot = inventory.slots[selectedSlot.index];
      const item = carriedSlot?.item;
      if (!item) {
        showFeedback('Selected inventory slot is empty', true);
        return;
      }
      const forgeSpec = FORGE_BY_ID[item.id];
      if (!forgeSpec) {
        showFeedback(`Refused: ${item.name} is not a weapon component`, true);
        return;
      }
      if (forgeSpec.slot !== slotKey) {
        showFeedback(`Refused: ${item.name} cannot be fitted into ${slotKey.toUpperCase()} slot`, true);
        return;
      }

      onFit(slotKey, item.id);
      setSelectedSlot(null);
      showFeedback(`Fitted ${item.name} into ${slotKey.toUpperCase()}`);
    } else {
      const currentFitted = loadout?.[slotKey];
      if (currentFitted) {
        onFit(slotKey, null);
        const spec = FORGE_BY_ID[currentFitted];
        showFeedback(`Removed ${spec?.name ?? currentFitted} from ${slotKey.toUpperCase()}`);
      } else {
        showFeedback(`Select a ${slotKey.toUpperCase()} component in backpack to fit`, false);
      }
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

  const isOverloaded = inventory.kg > inventory.maxKg;
  const isNearCap = inventory.kg >= inventory.maxKg * 0.85 && !isOverloaded;
  const excessKg = isOverloaded ? Math.round((inventory.kg - inventory.maxKg) * 10) / 10 : 0;
  const weightRatio = Math.min(100, Math.round((inventory.kg / inventory.maxKg) * 100));

  const stats = loadout ? weaponStats(loadout) : null;

  return (
    <div className="hm-modal-overlay" onClick={onClose} data-testid="inventory-modal">
      <div className="hm-window-panel" onClick={(e) => e.stopPropagation()} style={{ minWidth: 720 }} data-testid="base-inventory-window">
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

        {/* Feedback message banner */}
        {feedbackMsg && (
          <div
            style={{
              margin: '0 20px 10px',
              padding: '6px 12px',
              borderRadius: 4,
              fontSize: 12,
              fontFamily: "'Oxanium', monospace",
              fontWeight: 600,
              background: feedbackMsg.isError ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)',
              border: `1px solid ${feedbackMsg.isError ? 'rgba(239, 68, 68, 0.4)' : 'rgba(34, 197, 94, 0.4)'}`,
              color: feedbackMsg.isError ? '#fca5a5' : '#86efac',
            }}
            data-testid="loadout-feedback"
          >
            {feedbackMsg.text}
          </div>
        )}

        {/* Content Layout */}
        <div className="hm-inv-layout">
          {/* Equipment & Loadout Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Suit Rig */}
            <div className="hm-equip-column">
              <span style={{ fontFamily: 'Oxanium', fontSize: 11, fontWeight: 700, color: 'var(--base-cyan)' }}>
                SUIT RIG
              </span>
              {EQUIP_SLOTS.map((eqKey) => {
                const eqSlot = inventory.equipment[eqKey];
                const isSelected = selectedSlot?.at === 'equipment' && selectedSlot.slot === eqKey;

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

            {/* Weapon Loadout Field Swaps (TASK-09) */}
            {loadout && (
              <div className="hm-equip-column" data-testid="loadout-panel">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontFamily: 'Oxanium', fontSize: 11, fontWeight: 700, color: 'var(--base-cyan)' }}>
                    WEAPON LOADOUT
                  </span>
                  {stats && (
                    <span style={{ fontFamily: 'Oxanium', fontSize: 9, color: '#38bdf8' }}>
                      {stats.mode.toUpperCase()}
                    </span>
                  )}
                </div>

                {PART_SLOTS.map((slotKey) => {
                  const partId = loadout[slotKey];
                  const forgeSpec = partId ? FORGE_BY_ID[partId] : null;

                  return (
                    <div
                      key={slotKey}
                      className="hm-equip-slot"
                      onClick={() => handleLoadoutSlotClick(slotKey)}
                      title={forgeSpec ? `${forgeSpec.name} (Click to remove, or click part in backpack to fit)` : `Empty ${slotKey} (Click carried component to fit)`}
                      data-testid={`loadout-slot-${slotKey}`}
                      style={{ cursor: 'pointer' }}
                    >
                      <div className={`hm-slot-icon-box ${!partId ? 'empty-equip' : ''}`}>
                        {partId ? (
                          <span style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 700, color: '#38bdf8' }}>
                            {slotKey[0]?.toUpperCase()}
                          </span>
                        ) : (
                          LOADOUT_PLACEHOLDER_ICONS[slotKey]
                        )}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                        <span className="hm-equip-label">{slotKey}</span>
                        <span
                          style={{
                            fontSize: 9,
                            color: forgeSpec ? '#f8fafc' : '#ef4444',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            maxWidth: 70,
                          }}
                        >
                          {forgeSpec ? forgeSpec.name.replace(/(Core|Barrel|Sight|Cell)/, '') : 'None'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 9x4 Grid */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="hm-grid-9x4" data-testid="inventory-grid">
              {inventory.slots.map((slot, idx) => {
                const isSelected = selectedSlot?.at === 'inventory' && selectedSlot.index === idx;
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

              <div style={{ width: 250 }} className="hm-weight-bar-container">
                <div className="hm-weight-label">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>CARGO MASS</span>
                    {isOverloaded && (
                      <span className="hm-overload-badge red">
                        OVERLOADED (+{excessKg} kg)
                      </span>
                    )}
                    {isNearCap && (
                      <span className="hm-overload-badge amber">
                        NEAR CAP
                      </span>
                    )}
                  </div>
                  <span>
                    <strong
                      style={{
                        color: isOverloaded ? '#f87171' : isNearCap ? '#fbbf24' : 'inherit',
                      }}
                    >
                      {inventory.kg}
                    </strong>{' '}
                    / {inventory.maxKg} kg
                  </span>
                </div>
                <div className={`hm-weight-bar-track ${isOverloaded ? 'overloaded' : isNearCap ? 'warning' : ''}`}>
                  <div
                    className="hm-weight-bar-fill"
                    style={{
                      width: `${weightRatio}%`,
                      background: isOverloaded
                        ? 'linear-gradient(90deg, #f59e0b, #ef4444)'
                        : isNearCap
                          ? 'linear-gradient(90deg, #38bdf8, #fbbf24)'
                          : 'linear-gradient(90deg, #00f0ff, #10b981)',
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
