import { cmd, type PresetId } from '@hm/contracts';
import type { Runtime } from '@hm/engine';
import { DEFAULT_RULES } from '@hm/game';

export const RULES_ID: PresetId = 'race-rules';

/**
 * The race is just a preset on the map: laps, field size, AI skill, items, boost pads, road furniture. A map without rules uses the defaults;
 * this makes the scene's own copy (one undo step) so it shows in the preset tree and the inspector edits it.
 */
export function ensureRules(rt: Runtime, sceneId: PresetId): PresetId {
  if (rt.store.get(sceneId)?.children['rules']?.[0]) return rt.store.get(sceneId)!.children['rules']![0]!.ref;
  rt.commands.transaction('Customise the race', () => {
    if (!rt.store.get(RULES_ID)) rt.commands.execute(cmd.put({ id: RULES_ID, kind: 'race', name: 'Race rules', params: { ...DEFAULT_RULES } as never, tier: 'play' }, 'Customise the race'));
    rt.commands.execute(cmd.addChild(sceneId, 'rules', RULES_ID, undefined, 'Customise the race'));
  });
  return RULES_ID;
}
