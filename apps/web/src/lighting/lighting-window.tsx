import { useMemo, useState, type ReactElement } from 'react';
import { cmd, type PresetId, type Tier } from '@hm/contracts';
import type { Runtime } from '@hm/engine';
import { Inspector, type InputSource } from '@hm/ui';
import { SETUPS, setupToParams, type LightSetup } from '@hm/lighting';
import { driverInputs } from '../maker/drivers';
import { ensureLightPreset, pickLook, setupOf } from '../look';
import { useRev } from '../use-rev';

/**
 * Lighting, as a window you can leave open while you look at the world: pick a ready-made look, move the sun through the day, and change any
 * knob. Picking a look is a preset choice; the first edit forks it into a light-setup preset of your own (see ensureLightPreset).
 */
const swatch = (s: LightSetup): string => `linear-gradient(180deg, ${s.sky.top} 0%, ${s.sky.horizon} 62%, ${s.hemi.ground} 100%)`;

/** The lighting window as a stand-alone panel (fixed on the right). */
export function LightingWindow(props: { readonly rt: Runtime; readonly sceneId: PresetId; readonly onClose: () => void }): ReactElement {
  return (
    <aside className="light-win" role="dialog" aria-label="Lighting">
      <LightingPanel rt={props.rt} sceneId={props.sceneId} onClose={props.onClose} />
    </aside>
  );
}

/** Everything in the lighting window, to put inside any window (the floating editors use it). `onClose` adds a Close button. */
export function LightingPanel(props: { readonly rt: Runtime; readonly sceneId: PresetId; readonly onClose?: () => void }): ReactElement {
  const { rt, sceneId, onClose } = props;
  useRev(rt);
  const [deep, setDeep] = useState(false);
  const tier: Tier = deep ? 'pro' : 'build';
  const scene = rt.store.get(sceneId);
  const sceneParams = scene ? rt.store.resolve(sceneId).params : {};
  const lightId = scene?.children['lighting']?.[0]?.ref;
  const own = lightId ? rt.store.get(lightId) : undefined;
  const lookId = String(sceneParams['look'] ?? 'noon-clear');
  const hour = Number(sceneParams['timeOfDay'] ?? -1);
  const clock = Number.isFinite(hour) && hour >= 0;
  const shown = setupOf(rt.store, sceneId, Number.NaN);

  const schema = rt.schemas.get('light-setup');
  const sceneSchema = rt.schemas.get('scene');
  const hourSchema = useMemo(() => (sceneSchema ? { ...sceneSchema, variables: sceneSchema.variables.filter((v) => v.key === 'timeOfDay').map((v) => ({ ...v, tier: 'play' as const })), slots: [] } : null), [sceneSchema]);

  const drivers = (id: PresetId): InputSource => driverInputs(rt, sceneId, id);
  const inputs: InputSource | undefined = useMemo(() => {
    const base = drivers(lightId ?? 'none');
    return {
      choices: base.choices,
      ...(lightId ? { current: base.current } : {}),
      pick: (key, choice) => { if (!lightId && (choice === 'number' || choice === 'formula')) return; drivers(ensureLightPreset(rt, sceneId)).pick(key, choice); },
    };
  }, [rt, sceneId, lightId]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="light-panel">
      <header>
        <h3>Lighting</h3>
        <span className="hint">{own ? `${own.name} (your copy)` : shown.name}</span>
        {onClose ? <button onClick={onClose}>Close</button> : null}
      </header>
      <div className="looks-grid" role="group" aria-label="Ready-made looks">
        {SETUPS.map((s) => (
          <button key={s.id} className={!own && lookId === s.id ? 'look on' : 'look'} onClick={() => pickLook(rt, sceneId, s.id)} title={s.name}>
            <i style={{ background: swatch(s) }}><b style={{ background: s.sun.color }} /></i>
            <span>{s.name}</span>
          </button>
        ))}
      </div>
      <div className="light-clock">
        <label className="row"><input type="checkbox" checked={clock} onChange={(e) => rt.commands.execute(cmd.setParam(`${sceneId}.timeOfDay`, e.target.checked ? 17.5 : -1, 'Time of day'))} /> Move the sun with the clock</label>
        {clock && hourSchema ? (
          <Inspector schema={hourSchema} params={scene?.params ?? {}} resolved={sceneParams} tier="play"
            onChange={(k, v) => rt.commands.execute(cmd.setParam(`${sceneId}.${k}`, v, 'Time of day'))} />
        ) : null}
      </div>
      {schema ? (
        <Inspector
          schema={schema} params={own?.params ?? {}} resolved={own ? rt.store.resolve(own.id).params : setupToParams(shown)} tier={tier} inputs={inputs}
          onChange={(k, v) => { const id = ensureLightPreset(rt, sceneId); rt.commands.execute(cmd.setParam(`${id}.${k}`, v, 'Lighting')); }}
        />
      ) : null}
      <footer>
        <label className="row"><input type="checkbox" checked={deep} onChange={(e) => setDeep(e.target.checked)} /> Show every control</label>
        {own ? <button onClick={() => pickLook(rt, sceneId, lookId)}>Back to the ready-made look</button> : null}
      </footer>
    </div>
  );
}
