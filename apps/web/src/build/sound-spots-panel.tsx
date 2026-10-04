import type { ReactElement } from 'react';
import { Trash2 } from 'lucide-react';
import { cmd, type PresetId } from '@hm/contracts';
import type { Runtime } from '@hm/engine';
import { isAmbience } from '@hm/buildkit';
import { AMBIENCES } from '@hm/soundscape';
import { useRev } from '../use-rev';
import { fx } from '../maker/feedback';
import { soundName } from './catalog';

/**
 * Sounds here (the Sound tab, F5): one row per placed sound or ambience zone, how loud, how far it reaches, how often a sound repeats, on or
 * off, and a bin. Every change is an undo step. Same look as the Rules and Effects lists.
 */
const SLOT = 'soundscape';

export function SoundSpotsPanel(props: { readonly rt: Runtime; readonly sceneId: PresetId }): ReactElement {
  const { rt, sceneId } = props;
  useRev(rt);
  const refs = rt.store.get(sceneId)?.children[SLOT] ?? [];
  const set = (ref: PresetId, key: string, value: number | boolean): void => { rt.commands.execute(cmd.setParam(`${ref}.${key}`, value as never, 'Change a placed sound')); };
  const remove = (i: number): void => { rt.commands.execute(cmd.removeChild(sceneId, SLOT, i, 'Remove a placed sound')); fx('delete', { volume: 0.5 }); };
  if (refs.length === 0) return <p className="hint">No sounds placed yet. Pick an ambience or a sound in the palette (Tab) and use Place where you point: waves on the beach, birds in the trees.</p>;
  return (
    <div className="logic-panel">
      <ul className="lp-list" aria-label="Placed sounds">
        {refs.map((r, i) => {
          if (!rt.store.get(r.ref)) return null;
          const pr = rt.store.resolve(r.ref).params as Record<string, unknown>;
          const what = String(pr['what'] ?? ''), zone = isAmbience(what);
          const name = zone ? AMBIENCES.find((a) => a.id === what)?.name ?? what : soundName(what);
          const num = (key: string, fallback: number): number => Number(pr[key] ?? fallback);
          return (
            <li key={r.ref} className="lp-rule">
              <div className="lp-say">
                <span>{zone ? `${name}, a zone` : `${name}, every ${num('every', 4)} s`}</span>
                <button aria-label="Remove this sound" title="Remove (you can undo)" onClick={() => remove(i)}><Trash2 size={14} strokeWidth={1.6} /></button>
              </div>
              <div className="lp-blocks">
                <label className="lp-block">volume <input type="range" min={0} max={1} step={0.05} value={num('volume', 0.8)} onChange={(e) => set(r.ref, 'volume', Number(e.target.value))} /></label>
                <label className="lp-block">{zone ? 'reach' : 'heard to'} <input type="number" min={1} max={80} step={0.5} value={num('size', 8)} onChange={(e) => set(r.ref, 'size', Math.min(80, Math.max(1, Number(e.target.value) || 8)))} /> m</label>
                {zone ? null : <label className="lp-block">every <input type="number" min={0.5} max={120} step={0.5} value={num('every', 4)} onChange={(e) => set(r.ref, 'every', Math.min(120, Math.max(0.5, Number(e.target.value) || 4)))} /> s</label>}
                <label className="lp-block"><input type="checkbox" checked={pr['on'] !== false} onChange={(e) => set(r.ref, 'on', e.target.checked)} /> on</label>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
