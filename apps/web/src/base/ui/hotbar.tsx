import React, { useEffect } from 'react';
import type { BaseActions, InventoryView } from '../view';

interface HotbarProps {
  inventory: InventoryView;
  actions: BaseActions;
}

export const Hotbar: React.FC<HotbarProps> = ({ inventory, actions }) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= 9) {
        actions.selectHotbar(num - 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [actions]);

  // First 9 slots of inventory are row 0 (the hotbar)
  const hotbarSlots = inventory.slots.slice(0, 9);

  return (
    <div className="hm-hotbar-container" data-testid="base-hotbar">
      {hotbarSlots.map((slot, idx) => {
        const isSelected = inventory.hotbar === idx;
        const item = slot.item;

        return (
          <div
            key={idx}
            className={`hm-hotbar-slot ${isSelected ? 'selected' : ''}`}
            onClick={() => actions.selectHotbar(idx)}
            data-testid={`hotbar-slot-${idx + 1}`}
            title={item ? `${item.name} (${item.kind})\nStack: ${slot.n} / ${item.stack}` : 'Empty Slot'}
          >
            <span className="hm-slot-keybind">{idx + 1}</span>

            {item && (
              <div
                className="hm-slot-icon-box"
                style={{
                  background: item.tint,
                  boxShadow: `0 0 8px ${item.tint}66`,
                }}
              />
            )}

            {item && slot.n > 1 && (
              <span className="hm-slot-count">{slot.n}</span>
            )}
          </div>
        );
      })}
    </div>
  );
};
