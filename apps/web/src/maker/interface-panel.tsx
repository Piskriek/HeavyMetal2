import type { ReactElement } from 'react';
import { cmd, type PresetId, type Tier } from '@hm/contracts';
import type { Runtime } from '@hm/engine';
import { Inspector } from '@hm/ui';
import { DriversPanel } from './drivers';
import { HudEditor } from './hud-editor';
import { ensureInterface } from '../ui-preset';

/** The look and wording of the game are variables on an `interface` preset: edit them here and the menus, the HUD and this editor follow. */
export function InterfacePanel(props: { readonly rt: Runtime; readonly sceneId: PresetId; readonly tier: Tier; readonly onFeedback: (kind: 'success' | 'deleted', text: string) => void }): ReactElement {
  const { rt, sceneId, tier, onFeedback } = props;
  const ref = rt.store.get(sceneId)?.children['interface']?.[0]?.ref;
  const preset = ref ? rt.store.get(ref) : undefined;
  const schema = rt.schemas.get('interface');
  return (
    <section className="rules">
      <h3>Interface</h3>
      <p className="hint">Even the menus are presets. Change a colour or a word and the whole game (and this editor) follows. It saves and shares with the map.</p>
      {preset && schema ? (
        <>
          <Inspector schema={schema} params={preset.params} resolved={rt.store.resolve(preset.id).params} tier={tier}
            onChange={(k, v) => { rt.commands.execute(cmd.setParam(`${preset.id}.${k}`, v, 'Interface')); }} />
          <HudEditor rt={rt} presetId={preset.id} />
          <DriversPanel rt={rt} sceneId={sceneId} propId={preset.id} tier={tier} numberKeys={schema.variables.filter((v) => v.type === 'number').map((v) => ({ key: v.key, label: v.label }))} onFeedback={(k, t) => onFeedback(k === 'deleted' ? 'deleted' : 'success', t)} />
          <div className="btns"><button onClick={() => { rt.commands.execute(cmd.removeChild(sceneId, 'interface', 0, 'Default interface')); onFeedback('deleted', 'Back to the default interface'); }}>Reset to the default look</button></div>
        </>
      ) : (
        <div className="btns"><button className="go" onClick={() => { ensureInterface(rt, sceneId); onFeedback('success', 'Interface preset added: change it below'); }}>Customise the interface</button></div>
      )}
    </section>
  );
}
