import { useMemo, type ReactElement } from 'react';
import type { Params } from '@hm/contracts';
import type { Quality } from '@hm/game';
import { graphicsSchema, resolveGraphics } from '@hm/render';
import { Inspector } from '@hm/ui';
import { EDITION } from '../edition';

/**
 * The fine-tuning shows every knob but the dither distance, which has its own slider above it (its far end reads Unlimited), and, in
 * Goblin Racing, SetMix's machines (it has none).
 */
const TUNED = { ...graphicsSchema, variables: graphicsSchema.variables.filter((v) => v.key !== 'ditherDistance' && !(EDITION === 'goblin-racing' && v.group === 'Machines')) };
const TIER_NAME: Readonly<Record<Quality, string>> = { potato: 'Potato', low: 'Low', medium: 'Medium', high: 'High', ultra: 'Ultra' };

/**
 * The graphics preset in Settings: the values of the tier drawing now, with your own changes on top. A change applies to every tier
 * (so auto keeps it whichever tier it picks); each one can be reset to the tier's value.
 */
export function GraphicsTuning(props: { readonly tier: Quality; readonly own: Params; readonly onChange: (own: Params) => void }): ReactElement {
  const resolved = useMemo(() => resolveGraphics(props.tier, props.own) as unknown as Params, [props.tier, props.own]);
  const changes = Object.keys(props.own).length;
  const reset = (key: string): void => { const rest: Record<string, unknown> = { ...props.own }; delete rest[key]; props.onChange(rest as Params); };
  return (
    <details className="graphics-tuning">
      <summary>Fine-tune graphics<span>Drawing {TIER_NAME[props.tier]}{changes ? `, with ${changes} of your changes` : ''}</span></summary>
      <Inspector schema={TUNED} params={props.own} resolved={resolved} tier="play" onChange={(k, v) => props.onChange({ ...props.own, [k]: v })} onReset={reset} />
      {changes ? <button className="graphics-reset" onClick={() => props.onChange({})}>Use the tiers as made</button> : null}
    </details>
  );
}
