import { useState, type ReactElement } from 'react';
import { cmd, type PresetId, type Tier } from '@hm/contracts';
import type { Runtime } from '@hm/engine';
import { Inspector } from '@hm/ui';
import { encodeModel, countVoxels, decodeModel, type VoxelModel } from '@hm/voxel';
import { MODELS } from '@hm/voxelart';
import { heightAt } from '@hm/terrain';
import type { ModelPlacement } from '@hm/render';

/** The voxel models the scene holds, in the form the renderer draws. Cheap enough to recompute on every edit. */
export function placementsOf(rt: Runtime, sceneId: PresetId): ModelPlacement[] {
  const out: ModelPlacement[] = [];
  for (const r of rt.store.get(sceneId)?.children['models'] ?? []) {
    const p = rt.store.get(r.ref);
    if (!p) continue;
    const params = rt.store.resolve(p.id).params as Record<string, unknown>;
    out.push({ params, x: Number(params['x'] ?? 0), y: Number(params['y'] ?? 0), z: Number(params['z'] ?? 0), yawDeg: Number(params['yaw'] ?? 0) });
  }
  return out;
}

/** Block size that makes each ready-made model about the right size in the world (a goblin ~1.8 m, a palm ~11 m). */
const BLOCK: Readonly<Record<string, number>> = { goblin: 0.04, 'goblin-ball-racer': 0.03, palm: 0.25, barrel: 0.08, rock: 0.15, trophy: 0.1, 'statue-plinth': 0.2 };
const EXAMPLES = MODELS.map((m) => ({ id: m.id, label: m.name, doc: m.doc, scale: BLOCK[m.id] ?? 0.1, make: (): VoxelModel => m.build() as unknown as VoxelModel }));

/**
 * Voxel models are presets in the scene's `models` slot: blocks, a palette, a place and a turn. Add an example, move it, and (in Pro) edit the
 * encoded blocks. The sculpt brushes build on the same preset.
 */
export function ModelsPanel(props: { readonly rt: Runtime; readonly sceneId: PresetId; readonly tier: Tier; readonly onFeedback: (kind: 'success' | 'deleted', text: string) => void; readonly onFocus?: (id: PresetId) => void }): ReactElement {
  const { rt, sceneId, tier, onFeedback, onFocus } = props;
  const [open, setOpen] = useState<PresetId | null>(null);
  const refs = rt.store.get(sceneId)?.children['models'] ?? [];
  const schema = rt.schemas.get('model');

  const add = (label: string, m: VoxelModel, scale: number): void => {
    const ts = rt.binder.terrain();
    const y = ts ? Math.round(heightAt(ts.terrain, 0, 0) * 100) / 100 : 0;
    const id = `model-${Date.now().toString(36)}`;
    rt.commands.transaction(`Add ${label}`, () => {
      rt.commands.execute(cmd.put({ id, kind: 'model', name: label, params: { data: encodeModel(m), scale, x: 0, y, z: 0, yaw: 0, ao: true, greedy: true, castShadow: true } as never, tier: 'build' }, `Add ${label}`));
      rt.commands.execute(cmd.addChild(sceneId, 'models', id, undefined, `Add ${label}`));
    });
    setOpen(id);
    onFeedback('success', `${label} added at the island centre`);
  };

  return (
    <section className="rules">
      <h3>Models</h3>
      <p className="hint">Voxel models are presets: blocks with a colour, roughness and glow each. Place them anywhere; the PBR skin on top is a preset too.</p>
      {refs.length === 0 ? <p className="hint">No models on this map yet.</p> : (
        <ul className="sound-list">
          {refs.map((r, idx) => {
            const p = rt.store.get(r.ref);
            if (!p || !schema) return null;
            const data = String(p.params['data'] ?? '');
            const m = data ? decodeModel(data).model : null;
            return (
              <li key={r.ref}>
                <div className="sound-row">
                  <span className="grow">{p.name}{m ? ` · ${countVoxels(m)} blocks` : ' · empty'}</span>
                  {onFocus ? <button title="Go inside it: the world around whites out" onClick={() => onFocus(r.ref)}>✎ Focus</button> : null}
                  <button onClick={() => setOpen(open === r.ref ? null : r.ref)}>{open === r.ref ? 'Done' : 'Edit'}</button>
                  <button title="Remove" onClick={() => { rt.commands.execute(cmd.removeChild(sceneId, 'models', idx, 'Remove model')); onFeedback('deleted', 'Model removed'); }}>✕</button>
                </div>
                {open === r.ref ? <Inspector schema={schema} params={p.params} resolved={rt.store.resolve(p.id).params} tier={tier} onChange={(k, v) => { rt.commands.execute(cmd.setParam(`${p.id}.${k}`, v, 'Edit model')); }} /> : null}
              </li>
            );
          })}
        </ul>
      )}
      <div className="btns">{EXAMPLES.map((e) => <button key={e.id} className="go" title={e.doc} onClick={() => add(e.label, e.make(), e.scale)}>＋ {e.label}</button>)}</div>
    </section>
  );
}
