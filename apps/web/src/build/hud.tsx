import type { ReactElement } from 'react';
import { Brush, Gem, Minus, MousePointer2, Mountain, Package, Plus, Shovel, Smile, Square, TreePalm, Trophy, Waves, type LucideIcon } from 'lucide-react';
import { INVENTORY, type HotItem } from './hotbar';

const ICONS: Record<string, LucideIcon> = { MousePointer2, Brush, Mountain, Minus, Waves, Shovel, Package, TreePalm, Gem, Trophy, Square, Smile };
const Icon = ({ name, size = 18 }: { name: string; size?: number }): ReactElement => { const C = ICONS[name] ?? Package; return <C size={size} strokeWidth={1.5} />; };

/** A thin cross in the middle of the screen: where the tool in your hand will act. */
export function Crosshair(props: { readonly active: boolean }): ReactElement {
  return (
    <div className={`crosshair${props.active ? ' on' : ''}`} aria-hidden="true">
      <i /><i /><i /><i />
    </div>
  );
}

/** Nine slots, keys 1-9 (or scroll). Click a slot to pick it; open the inventory (E) and click an item to put it in the picked slot. */
export function Hotbar(props: { readonly slots: readonly (HotItem | null)[]; readonly selected: number; readonly onSelect: (i: number) => void; readonly onOpenInventory: () => void }): ReactElement {
  return (
    <div className="hotbar" role="toolbar" aria-label="Hotbar">
      {props.slots.map((s, i) => (
        <button key={i} className={i === props.selected ? 'on' : ''} data-label={s ? `${s.label}: ${s.doc}` : 'Empty: open the inventory (E)'} aria-label={s ? s.label : 'Empty slot'} onClick={() => (s || i !== props.selected ? props.onSelect(i) : props.onOpenInventory())}>
          <b>{i + 1}</b>
          {s ? <><Icon name={s.icon} /><span>{s.label}</span></> : <Plus size={16} strokeWidth={1.4} />}
        </button>
      ))}
      <button className="inv-btn" data-label="Inventory (E)" aria-label="Inventory" onClick={props.onOpenInventory}>E</button>
    </div>
  );
}

/** The creative inventory: every tool and preset you can put on the hotbar. */
export function Inventory(props: { readonly selected: number; readonly onPick: (item: HotItem) => void; readonly onClose: () => void }): ReactElement {
  return (
    <div className="inventory" role="dialog" aria-label="Inventory">
      <header><h3>Inventory · slot {props.selected + 1}</h3><button onClick={props.onClose}>Close (E / Esc)</button></header>
      <div className="inv-grid">
        {INVENTORY.map((it) => (
          <button key={it.id} title={it.doc} onClick={() => props.onPick(it)}><Icon name={it.icon} size={22} /><span>{it.label}</span></button>
        ))}
      </div>
      <p className="hint">Click an item to put it in the picked slot. Hotbar buttons are presets: soon you will open one, plug in your own sprite and sound, and share it.</p>
    </div>
  );
}
