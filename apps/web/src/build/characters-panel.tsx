import type { ReactElement } from 'react';
import { Trash2 } from 'lucide-react';
import { cmd, type PresetId } from '@hm/contracts';
import type { Runtime } from '@hm/engine';
import { CHAR_BRAINS } from '@hm/buildkit';
import { useRev } from '../use-rev';
import { fx } from '../maker/feedback';

/** The island's characters (the Characters tab, F9): one row per goblin, how it behaves, and a bin. Every change is an undo step. */
const SLOT = 'characters';

export function CharactersPanel(props: { readonly rt: Runtime; readonly sceneId: PresetId; readonly onChange?: () => void }): ReactElement {
  const { rt, sceneId } = props;
  useRev(rt);
  const refs = rt.store.get(sceneId)?.children[SLOT] ?? [];
  const set = (ref: PresetId, value: string): void => { rt.commands.execute(cmd.setParam(`${ref}.brain`, value as never, 'Change a character')); props.onChange?.(); };
  const remove = (i: number): void => { rt.commands.execute(cmd.removeChild(sceneId, SLOT, i, 'Remove a character')); fx('delete', { volume: 0.5 }); props.onChange?.(); };
  if (refs.length === 0) return <p className="hint">No characters yet. Pick how one behaves in the palette (Tab) and use Spawn where you point.</p>;
  return (
    <div className="logic-panel">
      <ul className="lp-list" aria-label="Characters">
        {refs.map((r, i) => {
          if (!rt.store.get(r.ref)) return null;
          const pr = rt.store.resolve(r.ref).params as Record<string, unknown>;
          const brain = String(pr['brain'] ?? 'wander');
          return (
            <li key={r.ref} className="lp-rule">
              <div className="lp-say">
                <span>{rt.store.get(r.ref)?.name ?? 'Goblin'}: {CHAR_BRAINS.find((b) => b.id === brain)?.doc ?? brain}</span>
                <button aria-label="Remove this character" title="Remove (you can undo)" onClick={() => remove(i)}><Trash2 size={14} strokeWidth={1.6} /></button>
              </div>
              <div className="lp-blocks">
                <label className="lp-block do">Behaves <select value={brain} onChange={(e) => set(r.ref, e.target.value)}>{CHAR_BRAINS.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
