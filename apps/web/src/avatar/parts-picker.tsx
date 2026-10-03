import type { ReactElement } from 'react';
import type { AvatarLook, PartPlace } from '@hm/avatarlook';
import { PresetPreview } from '../build/cards';
import { fx } from '../maker/feedback';
import { PLACES, partName, partsFor } from './accessories';

/** Pick what your goblin wears: one row per place (hat, hair, face, in hand, on the back), None or a part, each with its thumbnail. */
export function PartsPicker(props: { readonly look: AvatarLook; readonly onChange: (parts: Partial<Record<PartPlace, string>>) => void }): ReactElement {
  const { look } = props;
  const set = (place: PartPlace, id: string | null): void => {
    const next: Partial<Record<PartPlace, string>> = { ...(look.parts ?? {}) };
    if (id) next[place] = id; else delete next[place];
    props.onChange(next);
    fx('select', { volume: 0.6 });
  };
  return (
    <div className="parts-picker">
      {PLACES.map((pl) => {
        const current = look.parts?.[pl.place] ?? null;
        return (
          <div key={pl.place} className="pp-row" role="radiogroup" aria-label={pl.label}>
            <b>{pl.label}</b>
            <div className="pp-cards">
              <button role="radio" aria-checked={current === null} className={current === null ? 'on none' : 'none'} onClick={() => set(pl.place, null)} title="Nothing">None</button>
              {partsFor(pl.place).map((p) => (
                <button key={p.id} role="radio" aria-checked={current === p.id} className={current === p.id ? 'on' : ''} title={partName(p.id)} onClick={() => set(pl.place, p.id)}>
                  <PresetPreview p={{ kind: 'part', id: p.id, look }} size={44} />
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
