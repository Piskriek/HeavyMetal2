import { useState, type ReactElement } from 'react';
import { cmd, type PresetId, type Tier } from '@hm/contracts';
import type { Runtime } from '@hm/engine';
import { Inspector } from '@hm/ui';
import { ITEM_PRESETS, balanceReport } from '@hm/itemdefs';
import { itemsOf } from '@hm/game';

const toParams = (i: (typeof ITEM_PRESETS)[number]): Record<string, string | number | boolean> => ({
  label: i.label, icon: i.icon, effect: i.effect, durationMs: i.durationMs, power: i.power, radius: i.radius,
  weightFront: i.weights[0], weightMiddle: i.weights[1], weightBack: i.weights[2], enabled: i.enabled,
});

/**
 * Every power-up is a preset. A map starts with the standard eight; "Customise" turns them into presets on the map that you can
 * edit, duplicate, remove or add to. The balance check explains in plain words when a set is lopsided.
 */
export function ItemsPanel(props: { readonly rt: Runtime; readonly sceneId: PresetId; readonly tier: Tier; readonly onFeedback: (kind: 'success' | 'deleted', text: string) => void }): ReactElement {
  const { rt, sceneId, tier, onFeedback } = props;
  const [open, setOpen] = useState<PresetId | null>(null);
  const refs = rt.store.get(sceneId)?.children['items'] ?? [];
  const schema = rt.schemas.get('item');
  const report = balanceReport(itemsOf(rt));

  const customise = (): void => {
    rt.commands.transaction('Customise items', () => {
      for (const i of ITEM_PRESETS) {
        const id = `item-${i.id}`;
        if (!rt.store.get(id)) rt.commands.execute(cmd.put({ id, kind: 'item', name: i.label, params: toParams(i) as never, tier: 'build' }, 'Customise items'));
        rt.commands.execute(cmd.addChild(sceneId, 'items', id, undefined, 'Customise items'));
      }
    });
    onFeedback('success', 'The eight items are now presets on your map');
  };
  const addNew = (): void => {
    const id = `item-${Date.now().toString(36)}`;
    rt.commands.transaction('New item', () => {
      rt.commands.execute(cmd.put({ id, kind: 'item', name: 'New item', params: { label: 'New item', icon: '⭐', effect: 'boost', durationMs: 2000, power: 1, radius: 0, weightFront: 2, weightMiddle: 2, weightBack: 2, enabled: true } as never, tier: 'build' }, 'New item'));
      rt.commands.execute(cmd.addChild(sceneId, 'items', id, undefined, 'New item'));
    });
    setOpen(id);
  };

  return (
    <section className="rules">
      <h3>Items</h3>
      <p className="hint">Power-ups are presets: what they do, how long, how strong, how far, and how likely each part of the field is to get them.</p>
      {refs.length === 0 ? (
        <>
          <p className="hint">This map uses the standard eight: {ITEM_PRESETS.map((i) => `${i.icon} ${i.label}`).join(', ')}.</p>
          <div className="btns"><button className="go" onClick={customise}>Customise the items</button></div>
        </>
      ) : (
        <>
          <ul className="sound-list">
            {refs.map((r, idx) => {
              const p = rt.store.get(r.ref);
              if (!p || !schema) return null;
              return (
                <li key={r.ref}>
                  <div className="sound-row">
                    <span style={{ fontSize: 20 }}>{String(p.params['icon'] ?? '⭐')}</span><span className="grow">{String(p.params['label'] ?? r.ref)}{p.params['enabled'] === false ? ' (off)' : ''}</span>
                    <button onClick={() => setOpen(open === r.ref ? null : r.ref)}>{open === r.ref ? 'Done' : 'Edit'}</button>
                    <button title="Remove" onClick={() => { rt.commands.execute(cmd.removeChild(sceneId, 'items', idx, 'Remove item')); onFeedback('deleted', 'Item removed'); }}>✕</button>
                  </div>
                  {open === r.ref ? <Inspector schema={schema} params={p.params} resolved={rt.store.resolve(p.id).params} tier={tier} onChange={(k, v) => { rt.commands.execute(cmd.setParam(`${p.id}.${k}`, v, 'Edit item')); }} /> : null}
                </li>
              );
            })}
          </ul>
          <div className="btns">
            <button onClick={addNew}>＋ New item</button>
            <button onClick={() => { for (let i = refs.length - 1; i >= 0; i--) rt.commands.execute(cmd.removeChild(sceneId, 'items', i, 'Standard items')); onFeedback('deleted', 'Back to the standard eight'); }}>Back to the standard eight</button>
          </div>
        </>
      )}
      <h3 className="sub">Balance check</h3>
      {report.warnings.length === 0 ? <p className="hint" style={{ color: 'var(--ok, #5fd38d)' }}>✓ The set looks fair.</p> : <ul className="bad">{report.warnings.map((w) => <li key={w}>{w}</li>)}</ul>}
      {report.buckets.map((b) => <p className="hint" key={b.bucket}><b>{b.bucket}:</b> {b.table.map((t) => `${t.id} ${Math.round(t.chance * 100)}%`).join(' · ')}</p>)}
    </section>
  );
}
