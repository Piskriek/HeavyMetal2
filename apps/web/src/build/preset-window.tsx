import type { ReactElement } from 'react';
import { TABS, tabDef, type TabId } from '@hm/buildkit';
import { PLANTS } from '@hm/worldrules';
import { fx } from '../maker/feedback';
import { catalog, type ActivityInfo } from './catalog';
import { PresetPreview } from './cards';
import { iconByName } from './icons';
import { putInSlot, setSlot, setTab, usePlayer } from './player';

/**
 * Your presets (E): every preset of every tab as a card with its preview. Click a card to put it in the chosen slot of that tab; Edit opens
 * it in an attribute editor. The mouse is free while this is open.
 */
const PLANT_PREVIEW: Readonly<Record<string, string>> = { palm: 'palm', bush: 'bush', tuft: 'grass-clump', flowers: 'flowers', boulder: 'rock' };

export function PresetWindowBody(props: {
  readonly activities: readonly ActivityInfo[];
  readonly onEdit: (tab: TabId, id: string) => void;
  readonly onWorld: () => void;
  readonly onPlant: (kind: string) => void;
  readonly onMoves: () => void;
}): ReactElement {
  const p = usePlayer();
  const tab = p.tab;
  const cards = catalog(tab, p, props.activities);
  const row = p.hotbars[tab];
  const slot = p.slots[tab];
  const byId = new Map(cards.map((c) => [c.id, c]));
  return (
    <div className="presets">
      <nav className="pw-tabs" role="tablist" aria-label="Kinds of preset">
        {TABS.map((t) => { const I = iconByName(t.icon); return <button key={t.id} role="tab" aria-selected={t.id === tab} className={t.id === tab ? 'on' : ''} onClick={() => { setTab(t.id); fx('ui-click'); }}><I size={14} strokeWidth={1.6} /> {t.label}</button>; })}
      </nav>
      <p className="hint">{tabDef(tab).doc}</p>
      <div className="pw-slots" aria-label="Your slots">
        {row.map((id, i) => {
          const c = id ? byId.get(id) : undefined;
          return (
            <button key={i} className={i === slot ? 'on' : ''} title={c ? `Slot ${i + 1}: ${c.name}. Click a preset below to put it here.` : `Slot ${i + 1} is empty. Click a preset below to put it here.`} onClick={() => setSlot(tab, i)}>
              <b>{i + 1}</b>{c ? <PresetPreview p={c.preview} size={28} /> : <span className="empty">+</span>}
            </button>
          );
        })}
      </div>
      <div className="pw-grid">
        {cards.map((c) => (
          <div key={c.id} className={`pw-card${row.includes(c.id) ? ' in' : ''}`}>
            <button className="pw-pick" title={`${c.doc} Click to put it in slot ${slot + 1}.`} onClick={() => { putInSlot(tab, slot, c.id); fx('select'); }} onDoubleClick={() => props.onEdit(tab, c.id)}>
              <PresetPreview p={c.preview} size={56} />
              <span>{c.name}</span>
              {c.edited ? <i className="badge">yours</i> : null}
            </button>
            <button className="pw-edit" title={`Change ${c.name}`} aria-label={`Change ${c.name}`} onClick={() => props.onEdit(tab, c.id)}>Edit</button>
          </div>
        ))}
      </div>
      {tab === 'sculpt' ? (
        <>
          <h4>How the world responds</h4>
          <div className="pw-grid small">
            <div className="pw-card"><button className="pw-pick" onClick={props.onWorld} title="What digging uncovers, what sinks, whether plants follow the ground"><PresetPreview p={{ kind: 'icon', icon: 'Globe' }} size={44} /><span>World rules</span></button></div>
            {PLANTS.map((pl) => (
              <div key={pl.kind} className="pw-card"><button className="pw-pick" onClick={() => props.onPlant(pl.kind)} title={`How ${pl.name.toLowerCase()} behaves when the ground changes`}>
                <PresetPreview p={PLANT_PREVIEW[pl.kind] ? { kind: 'model', model: PLANT_PREVIEW[pl.kind]! } : { kind: 'icon', icon: 'Sprout' }} size={44} /><span>{pl.name}</span>
              </button></div>
            ))}
          </div>
        </>
      ) : null}
      {tab === 'animate' ? <button className="pw-wide" onClick={props.onMoves}>How my goblin stands, walks, runs and jumps</button> : null}
    </div>
  );
}
