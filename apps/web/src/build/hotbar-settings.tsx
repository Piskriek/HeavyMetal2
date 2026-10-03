import { useState, type ReactElement } from 'react';
import { ArrowLeft, ArrowRight, Plus, X } from 'lucide-react';
import { HOTBAR_LEVELS, TABS, type TabId } from '@hm/buildkit';
import { PresetPreview } from './cards';
import { catalog } from './catalog';
import { currentActivities, resetRow, setLevel, setRow, usePlayer } from './player';
import { fx } from '../maker/feedback';

/**
 * Settings, Hotbar (docs/HOTBAR.md section 5: "everything is a preset, even the hotbar"): pick a tab, then its nine slots, in order. Each
 * slot moves left or right or comes off; + puts one of the tab's presets in the first empty slot; the ready-made row is one click away.
 * The level (Easy, Pro, Studio) is part of the hotbar too.
 */
export function HotbarSettings(): ReactElement {
  const p = usePlayer();
  const [tab, setTabHere] = useState<TabId>('paint');
  const [adding, setAdding] = useState(false);
  const items = catalog(tab, p, currentActivities());
  const row = p.hotbars[tab] ?? [];
  const byId = new Map(items.map((c) => [c.id, c]));
  const move = (i: number, by: number): void => {
    const j = i + by;
    if (j < 0 || j >= row.length) return;
    const next = [...row];
    [next[i], next[j]] = [next[j] ?? null, next[i] ?? null];
    setRow(tab, next);
    fx('ui-click', { volume: 0.4 });
  };
  const remove = (i: number): void => { const next = [...row]; next[i] = null; setRow(tab, next); fx('delete', { volume: 0.4 }); };
  const add = (id: string): void => {
    const next = [...row];
    const free = next.findIndex((x) => !x);
    if (free < 0) return;
    next[free] = id;
    setRow(tab, next);
    fx('place', { volume: 0.4 });
  };
  const full = row.length >= 9 && row.every((x) => !!x);
  const missing = items.filter((c) => !row.includes(c.id));
  return (
    <div className="hotbar-settings">
      <div className="hs-tabs" role="tablist" aria-label="Tab">
        {TABS.map((t) => <button key={t.id} role="tab" aria-selected={t.id === tab} className={t.id === tab ? 'on' : ''} onClick={() => { setTabHere(t.id); setAdding(false); }}>{t.label}</button>)}
      </div>
      <ol className="hs-row" aria-label={`The ${tab} hotbar`}>
        {Array.from({ length: 9 }, (_, i) => {
          const id = row[i] ?? null, item = id ? byId.get(id) : undefined;
          return (
            <li key={i} className={item ? '' : 'empty'}>
              <span className="hs-key">{i + 1}</span>
              {item ? <PresetPreview p={item.preview} size={32} /> : <span className="hs-blank" aria-hidden="true" />}
              <span className="hs-name">{item?.name ?? 'Empty'}</span>
              {item ? (
                <span className="hs-acts">
                  <button aria-label={`Move ${item.name} left`} title="Left" disabled={i === 0} onClick={() => move(i, -1)}><ArrowLeft size={13} strokeWidth={1.7} /></button>
                  <button aria-label={`Move ${item.name} right`} title="Right" disabled={i === 8} onClick={() => move(i, 1)}><ArrowRight size={13} strokeWidth={1.7} /></button>
                  <button aria-label={`Take ${item.name} off`} title="Take it off" onClick={() => remove(i)}><X size={13} strokeWidth={1.7} /></button>
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
      <div className="btns">
        <button disabled={full || missing.length === 0} aria-expanded={adding} onClick={() => setAdding((a) => !a)}><Plus size={14} strokeWidth={1.6} /> Add</button>
        <button onClick={() => { resetRow(tab); setAdding(false); fx('ui-click', { volume: 0.4 }); }}>Back to the ready-made row</button>
      </div>
      {full ? <p className="hint">All nine slots are used. Take one off to add another.</p> : null}
      {adding && !full ? (
        <div className="hs-add" role="group" aria-label="Add to the hotbar">
          {missing.map((c) => <button key={c.id} title={c.doc} onClick={() => add(c.id)}><PresetPreview p={c.preview} size={32} /><span>{c.name}</span></button>)}
        </div>
      ) : null}
      <div className="row" role="group" aria-label="Level">
        <span>Level</span>
        <span className="seg">{HOTBAR_LEVELS.map((l) => <button key={l.id} className={p.level === l.id ? 'on' : ''} aria-pressed={p.level === l.id} title={l.says} onClick={() => setLevel(l.id)}>{l.name}</button>)}</span>
      </div>
      <p className="hint">{HOTBAR_LEVELS.find((l) => l.id === p.level)?.says}</p>
    </div>
  );
}
