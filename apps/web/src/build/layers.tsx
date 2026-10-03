import { useState, type ReactElement } from 'react';
import { ArrowDown, ArrowUp, Eye, EyeOff, Move, Plus, Trash2 } from 'lucide-react';
import { cmd, type PresetId } from '@hm/contracts';
import type { Runtime } from '@hm/engine';
import { THINGS } from '@hm/buildkit';
import { useRev } from '../use-rev';
import { PresetPreview } from './cards';
import { fx } from '../maker/feedback';

/**
 * Layers (owner, 2026-10-03: "the palette needs a layers button so you can see the content of the preset and layer them, remove some,
 * select some, add presets, then in the 3D view move the new preset around or change its attributes"): what this island is made of, one
 * row per layer. Pick one to change it (its place, turn and size right here; Move it carries it in the 3D view); the eye hides it; the arrows
 * change the order; + adds a thing where you are looking. Every change is one undo step.
 */
const SLOT = 'models';
const num = (v: unknown, d: number): number => { const n = Number(v); return Number.isFinite(n) ? n : d; };

export function LayersPanel(props: {
  readonly rt: Runtime; readonly sceneId: PresetId;
  readonly selected: PresetId | null; readonly onSelect: (ref: PresetId | null) => void;
  /** Carry it in the 3D view (the Move tool, already holding it). */
  readonly onMove: (ref: PresetId) => void;
  /** Fly the camera to it. */
  readonly onShow: (ref: PresetId) => void;
  /** Place a thing where you are looking; resolves to its layer. */
  readonly onAdd: (modelId: string) => PresetId | null;
  readonly plantsShown: boolean; readonly onPlants: (shown: boolean) => void;
  /** The ground's layer opens Paint (its tools work on it). */
  readonly onGround: () => void;
}): ReactElement {
  const { rt, sceneId } = props;
  useRev(rt);
  const [adding, setAdding] = useState(false);
  const refs = rt.store.get(sceneId)?.children[SLOT] ?? [];
  const plants = rt.binder.decor()?.placements.length ?? 0;
  const set = (ref: PresetId, key: string, value: number | boolean, label: string): void => { rt.commands.execute(cmd.setParam(`${ref}.${key}`, value as never, label)); };
  const moveLayer = (index: number, by: number): void => {
    const to = index + by;
    if (to < 0 || to >= refs.length) return;
    const ref = refs[index]!.ref;
    rt.commands.transaction('Change the order', () => {
      rt.commands.execute(cmd.removeChild(sceneId, SLOT, index, 'Change the order'));
      rt.commands.execute(cmd.addChild(sceneId, SLOT, ref, to, 'Change the order'));
    });
    fx('ui-click', { volume: 0.4 });
  };
  const remove = (index: number): void => {
    const ref = refs[index]!.ref;
    rt.commands.execute(cmd.removeChild(sceneId, SLOT, index, `Remove ${rt.store.get(ref)?.name ?? 'it'}`));
    if (props.selected === ref) props.onSelect(null);
    fx('delete', { volume: 0.5 });
  };
  return (
    <div className="layers">
      <p className="hint">What this island is made of. Pick a layer to change it; the eye hides it; the arrows change the order.</p>
      <ul className="ly-list" aria-label="Layers">
        <li className="ly-row"><button className="ly-name" onClick={props.onGround}><PresetPreview p={{ kind: 'icon', icon: 'Mountain' }} size={22} /><span>Ground</span><small>Paint and Sculpt change it</small></button></li>
        <li className="ly-row">
          <span className="ly-name"><PresetPreview p={{ kind: 'model', model: 'palm' }} size={22} /><span>Plants</span><small>{plants} on the island</small></span>
          <button aria-label={props.plantsShown ? 'Hide the plants' : 'Show the plants'} title={props.plantsShown ? 'Hide' : 'Show'} onClick={() => props.onPlants(!props.plantsShown)}>{props.plantsShown ? <Eye size={14} strokeWidth={1.6} /> : <EyeOff size={14} strokeWidth={1.6} />}</button>
        </li>
      </ul>
      <div className="ly-head"><h4>Things</h4><button onClick={() => setAdding((a) => !a)} aria-expanded={adding}><Plus size={14} strokeWidth={1.6} /> Add</button></div>
      {adding ? (
        <div className="ly-add" role="group" aria-label="Add a thing">
          {THINGS.map((t) => <button key={t.id} title={`Add a ${t.name.toLowerCase()} where you are looking`} onClick={() => { const ref = props.onAdd(t.id); setAdding(false); if (ref) props.onSelect(ref); }}><PresetPreview p={{ kind: 'model', model: t.id }} size={34} /><span>{t.name}</span></button>)}
        </div>
      ) : null}
      {refs.length === 0 ? <p className="hint">Nothing placed yet. Add a thing, or place one with the Things tab (F9).</p> : null}
      <ul className="ly-list" aria-label="Things">
        {refs.map((r, i) => {
          const p = rt.store.get(r.ref);
          if (!p) return null;
          const v = rt.store.resolve(r.ref).params as Record<string, unknown>;
          const hidden = v['hidden'] === true, on = props.selected === r.ref;
          const thing = THINGS.find((t) => t.name === p.name);
          return (
            <li key={r.ref} className={`ly-row${on ? ' on' : ''}${hidden ? ' hidden' : ''}`}>
              <button className="ly-name" aria-pressed={on} onClick={() => props.onSelect(on ? null : r.ref)}>
                <PresetPreview p={thing ? { kind: 'model', model: thing.id } : { kind: 'icon', icon: 'Box' }} size={22} /><span>{p.name}</span>
              </button>
              <button aria-label={hidden ? `Show ${p.name}` : `Hide ${p.name}`} title={hidden ? 'Show' : 'Hide'} onClick={() => set(r.ref, 'hidden', !hidden, hidden ? 'Show' : 'Hide')}>{hidden ? <EyeOff size={14} strokeWidth={1.6} /> : <Eye size={14} strokeWidth={1.6} />}</button>
              <button aria-label={`Move ${p.name} up`} title="Up" disabled={i === 0} onClick={() => moveLayer(i, -1)}><ArrowUp size={14} strokeWidth={1.6} /></button>
              <button aria-label={`Move ${p.name} down`} title="Down" disabled={i === refs.length - 1} onClick={() => moveLayer(i, 1)}><ArrowDown size={14} strokeWidth={1.6} /></button>
              <button aria-label={`Remove ${p.name}`} title="Remove (you can undo)" onClick={() => remove(i)}><Trash2 size={14} strokeWidth={1.6} /></button>
              {on ? (
                <div className="ly-attrs">
                  {(['x', 'y', 'z'] as const).map((k) => <label key={k}>{k === 'y' ? 'Height' : k === 'x' ? 'Across' : 'Along'} <input type="number" step={0.5} value={Math.round(num(v[k], 0) * 10) / 10} onChange={(e) => set(r.ref, k, Number(e.target.value), 'Move')} /></label>)}
                  <label>Turn <input type="range" min={-180} max={180} step={5} value={num(v['yaw'], 0)} onChange={(e) => set(r.ref, 'yaw', Number(e.target.value), 'Turn')} /></label>
                  <label>Size <input type="range" min={0.01} max={1} step={0.01} value={Math.min(1, num(v['scale'], 0.1))} onChange={(e) => set(r.ref, 'scale', Number(e.target.value), 'Size')} /></label>
                  <div className="btns"><button className="go" onClick={() => props.onMove(r.ref)}><Move size={13} strokeWidth={1.6} /> Move it</button><button onClick={() => props.onShow(r.ref)}>Show me</button></div>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
