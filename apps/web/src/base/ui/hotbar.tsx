import React, { useEffect } from 'react';
import type { BaseActions, InventoryView } from '../view';
import { ItemGlyph } from './item-glyph';
import { resolveItemDescription } from '@hm/ui';

interface HotbarProps {
  inventory: InventoryView;
  actions: BaseActions;
}

export const Hotbar: React.FC<HotbarProps> = ({ inventory, actions }) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      // keys 1 to 9 always pick the hotbar slot (TICKET-04: the sculpt tools moved to the X radial)
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
    <div className="hm-hotbar-container" data-testid="base-hotbar" data-hud-zone="bottom-centre">
      {hotbarSlots.map((slot, idx) => {
        const isSelected = inventory.hotbar === idx;
        const item = slot.item;
        const desc = item ? resolveItemDescription(item.id, item.name) : null;

        return (
          <div
            key={idx}
            className={`hm-hotbar-slot ${isSelected ? 'selected' : ''}`}
            onClick={() => actions.selectHotbar(idx)}
            data-testid={`hotbar-slot-${idx + 1}`}
            title={desc && item ? `${desc.title} (${item.kind})\n${desc.hint}\nStack: ${slot.n} / ${item.stack}` : `Hotbar Slot ${idx + 1}`}
          >
            <span className="hm-slot-keybind">{idx + 1}</span>

            {item && (
              <div className="hm-slot-icon-box">
                <ItemGlyph item={item} size={32} />
              </div>
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
