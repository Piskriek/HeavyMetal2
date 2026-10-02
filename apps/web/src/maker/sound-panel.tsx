import { useState, type ReactElement } from 'react';
import { cmd, type Tier } from '@hm/contracts';
import type { Runtime } from '@hm/engine';
import type { SfxId } from '@hm/audio';
import { fx } from './feedback';
import { ensureOverride, listSlots, overrideId, removeOverride, type SoundSlot } from '../sound/bank';

/**
 * Every sound in the game is a preset. Here you hear each one, change its volume and pitch (or mute it), and reset it.
 * Volume and pitch are ordinary variables, so a driver can move them too. `renderLab` plugs in the full Sound Lab editor.
 */

const CATEGORIES: { id: SoundSlot['category']; label: string }[] = [{ id: 'race', label: 'Race' }, { id: 'editor', label: 'Editor' }, { id: 'ui', label: 'Menus' }];

export function SoundPanel(props: {
  readonly rt: Runtime;
  readonly tier: Tier;
  readonly renderLab?: (slot: SfxId, presetId: string) => ReactElement | null;
  readonly onFeedback: (kind: 'success' | 'error' | 'deleted', text: string) => void;
  /** re-render trigger (the maker bumps this on every store change) */
  readonly rev?: number;
}): ReactElement {
  const { rt, tier, renderLab, onFeedback } = props;
  const [cat, setCat] = useState<SoundSlot['category']>('race');
  const [open, setOpen] = useState<SfxId | null>(null);
  const slots = listSlots(rt).filter((s) => s.category === cat);

  const set = (slot: SfxId, key: 'volume' | 'pitch' | 'enabled', value: number | boolean): void => {
    const id = ensureOverride(rt, slot);
    rt.commands.execute(cmd.setParam(`${id}.${key}`, value, `Sound ${slot}: ${key}`));
  };
  const param = (slot: SfxId, key: string, fallback: number): number => Number(rt.store.get(overrideId(slot))?.params[key] ?? fallback);

  return (
    <section className="sounds">
      <h3>Sounds</h3>
      <p className="hint">Every sound is a preset. Tap ▶ to hear it, Edit to change it. Edits save with your map.</p>
      <div className="seg">{CATEGORIES.map((c) => <button key={c.id} className={cat === c.id ? 'on' : ''} onClick={() => { setCat(c.id); setOpen(null); fx('ui-click'); }}>{c.label}</button>)}</div>
      <ul className="sound-list">
        {slots.map((s) => (
          <li key={s.id} className={s.edited ? 'edited' : ''}>
            <div className="sound-row">
              <button title="Play" onClick={() => fx(s.id)}>▶</button>
              <span className="grow">{s.label}{s.edited ? <i title="Changed from the built-in sound"> ●</i> : null}</span>
              <button onClick={() => { setOpen(open === s.id ? null : s.id); fx('ui-toggle'); }}>{open === s.id ? 'Done' : 'Edit'}</button>
            </div>
            {open === s.id ? (
              <div className="sound-edit">
                <label className="row">Volume <input type="range" min={0} max={2} step={0.01} value={param(s.id, 'volume', 1)} onChange={(e) => set(s.id, 'volume', Number(e.target.value))} onPointerUp={() => fx(s.id)} /> <span>{Math.round(param(s.id, 'volume', 1) * 100)}%</span></label>
                <label className="row">Pitch <input type="range" min={0.25} max={4} step={0.01} value={param(s.id, 'pitch', 1)} onChange={(e) => set(s.id, 'pitch', Number(e.target.value))} onPointerUp={() => fx(s.id)} /> <span>{param(s.id, 'pitch', 1).toFixed(2)}x</span></label>
                {tier !== 'play' ? <label className="row"><input type="checkbox" checked={rt.store.get(overrideId(s.id))?.params['enabled'] !== false} onChange={(e) => set(s.id, 'enabled', e.target.checked)} /> Enabled</label> : null}
                {renderLab ? renderLab(s.id, overrideId(s.id)) : null}
                {s.edited ? <button onClick={() => { removeOverride(rt, s.id); onFeedback('deleted', 'Back to the built-in sound'); }}>Reset to built-in</button> : null}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
