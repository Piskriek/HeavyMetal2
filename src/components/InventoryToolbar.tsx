import type { CSSProperties } from 'react';
import { PackageCheck, CircleHelp } from 'lucide-react';
import { ITEM_INFO, ITEM_TYPES, inventoryCount } from '../game/types';
import type { Inventory, ItemType } from '../game/types';
import ItemGlyph from './ItemGlyph';

interface Props {
  inventory: Inventory;
  remaining: Record<ItemType, number>;
  selected: ItemType;
  blocked: boolean;
  coolingDown: boolean;
  onUse: (item: ItemType) => void;
}

export default function InventoryToolbar({ inventory, remaining, selected, blocked, coolingDown, onUse }: Props) {
  return <section className="inventory-toolbar" aria-label="Race power-up toolbar">
    <div className="inventory-toolbar-heading"><span><PackageCheck size={13} />LOADOUT <b>{inventoryCount(inventory)}</b></span><small>CLICK OR PRESS 1-8 TO DEPLOY <i>/</i> SPACE REPEATS YOUR LAST ITEM</small><span title="One charge per use. Unused items carry into your next race."><CircleHelp size={12} />SINGLE USE</span></div>
    <div className="inventory-slots">{ITEM_TYPES.map((item, i) => {
      const info = ITEM_INFO[item];
      const active = remaining[item] > 0;
      const available = inventory[item] > 0;
      return <button key={item} className={`inventory-slot ${available ? 'stocked' : 'empty'} ${active ? 'effect-active' : ''} ${selected === item ? 'last-selected' : ''}`} style={{ '--item-color': info.color } as CSSProperties} disabled={blocked || coolingDown || active || !available} onClick={() => onUse(item)} aria-label={`Deploy ${info.name}, ${inventory[item]} charges${active ? `, active for ${(remaining[item] / 1000).toFixed(1)} seconds` : ''}`} title={`${info.name}: ${info.desc} (${inventory[item]} owned)`}>
        <kbd>{i + 1}</kbd><span className="inventory-glyph"><ItemGlyph item={item} size={23} /></span><span className="inventory-item-name">{info.name}</span><span className="inventory-quantity">{active ? `${(remaining[item] / 1000).toFixed(1)}s` : `x${inventory[item]}`}</span>
        <span className="inventory-item-state">{active ? item === 'jump' ? 'RECHARGING' : 'ACTIVE' : available ? 'READY' : 'COLLECT OR BUY'}</span>
        {active && <span className="effect-countdown" style={{ width: `${Math.min(100, remaining[item] / info.duration * 100)}%` }} />}
      </button>;
    })}</div>
  </section>;
}