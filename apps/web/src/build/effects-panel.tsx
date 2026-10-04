import type { ReactElement } from 'react';
import { Trash2 } from 'lucide-react';
import { cmd, type PresetId } from '@hm/contracts';
import type { Runtime } from '@hm/engine';
import { PARTICLE_PRESETS } from '@hm/particles';
import { useRev } from '../use-rev';
import { fx } from '../maker/feedback';

/**
 * The island's effects (the Effects tab, F12): one row per placed effect, its kind, its size, on or off, and a bin. Every change is an
 * undo step. Same look as the Rules list.
 */
const SLOT = 'effects';

export function EffectsPanel(props: { readonly rt: Runtime; readonly sceneId: PresetId }): ReactElement {
  const { rt, sceneId } = props;
  useRev(rt);
  const refs = rt.store.get(sceneId)?.children[SLOT] ?? [];
  const set = (ref: PresetId, key: string, value: string | number | boolean): void => { rt.commands.execute(cmd.setParam(`${ref}.${key}`, value as never, 'Change an effect')); };
  const remove = (i: number): void => { rt.commands.execute(cmd.removeChild(sceneId, SLOT, i, 'Remove an effect')); fx('delete', { volume: 0.5 }); };
  if (refs.length === 0) return <p className="hint">No effects on this island yet. Pick one in the palette (Tab) and use Place where you point.</p>;
  return (
    <div className="logic-panel">
      <ul className="lp-list" aria-label="Effects">
        {refs.map((r, i) => {
          if (!rt.store.get(r.ref)) return null;
          const pr = rt.store.resolve(r.ref).params as Record<string, unknown>;
          const kind = String(pr['preset'] ?? 'campfire'), on = pr['on'] !== false, size = Number(pr['scale'] ?? 1);
          return (
            <li key={r.ref} className="lp-rule">
              <div className="lp-say">
                <span>{PARTICLE_PRESETS.find((p) => p.id === kind)?.name ?? kind}, {Number(pr['x'] ?? 0).toFixed(1)}, {Number(pr['z'] ?? 0).toFixed(1)}</span>
                <button aria-label="Remove this effect" title="Remove (you can undo)" onClick={() => remove(i)}><Trash2 size={14} strokeWidth={1.6} /></button>
              </div>
              <div className="lp-blocks">
                <label className="lp-block do">Effect <select value={kind} onChange={(e) => set(r.ref, 'preset', e.target.value)}>{PARTICLE_PRESETS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
                <label className="lp-block">size <input type="number" min={0.2} max={5} step={0.1} value={size} onChange={(e) => set(r.ref, 'scale', Math.min(5, Math.max(0.2, Number(e.target.value) || 1)))} /></label>
                <label className="lp-block"><input type="checkbox" checked={on} onChange={(e) => set(r.ref, 'on', e.target.checked)} /> on</label>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
