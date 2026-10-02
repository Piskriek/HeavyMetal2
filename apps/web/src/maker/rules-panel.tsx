import type { ReactElement } from 'react';
import { cmd, type PresetId, type Tier } from '@hm/contracts';
import type { Runtime } from '@hm/engine';
import { Inspector } from '@hm/ui';
import { DEFAULT_RULES } from '@hm/game';
import { DriversPanel } from './drivers';

export const RULES_ID: PresetId = 'race-rules';

/** Make the scene's race rules preset (one undo step), starting from the defaults. */
export function ensureRules(rt: Runtime, sceneId: PresetId): PresetId {
  if (rt.store.get(sceneId)?.children['rules']?.[0]) return rt.store.get(sceneId)!.children['rules']![0]!.ref;
  rt.commands.transaction('Customise the race', () => {
    if (!rt.store.get(RULES_ID)) rt.commands.execute(cmd.put({ id: RULES_ID, kind: 'race', name: 'Race rules', params: { ...DEFAULT_RULES } as never, tier: 'play' }, 'Customise the race'));
    rt.commands.execute(cmd.addChild(sceneId, 'rules', RULES_ID, undefined, 'Customise the race'));
  });
  return RULES_ID;
}

/**
 * The race is just a preset on the map: laps, field size, AI skill, items, boost pads, road furniture. Everything here is an
 * ordinary variable, so a driver can move it too. A map without rules uses the defaults.
 */
export function RulesPanel(props: { readonly rt: Runtime; readonly sceneId: PresetId; readonly tier: Tier; readonly onFeedback: (kind: 'success' | 'deleted', text: string) => void }): ReactElement {
  const { rt, sceneId, tier, onFeedback } = props;
  const ref = rt.store.get(sceneId)?.children['rules']?.[0]?.ref;
  const preset = ref ? rt.store.get(ref) : undefined;
  const schema = rt.schemas.get('race');
  return (
    <section className="rules">
      <h3>Race rules</h3>
      <p className="hint">A race is a preset on your map. Change the numbers to make your own kind of race, then press <b>Test drive</b>. It saves and shares with the map.</p>
      {preset && schema ? (
        <>
          <Inspector schema={schema} params={preset.params} resolved={rt.store.resolve(preset.id).params} tier={tier}
            onChange={(k, v) => { rt.commands.execute(cmd.setParam(`${preset.id}.${k}`, v, 'Race rules')); }} />
          <DriversPanel rt={rt} sceneId={sceneId} propId={preset.id} tier={tier} numberKeys={schema.variables.filter((v) => v.type === 'number' || v.type === 'int').map((v) => ({ key: v.key, label: v.label }))} onFeedback={(k, t) => onFeedback(k === 'deleted' ? 'deleted' : 'success', t)} />
          <div className="btns"><button onClick={() => { const idx = 0; rt.commands.execute(cmd.removeChild(sceneId, 'rules', idx, 'Default race rules')); onFeedback('deleted', 'Back to the default rules'); }}>Reset to the default rules</button></div>
        </>
      ) : (
        <div className="btns"><button className="go" onClick={() => { ensureRules(rt, sceneId); onFeedback('success', 'Race rules added: change them below'); }}>Customise the race</button></div>
      )}
    </section>
  );
}
