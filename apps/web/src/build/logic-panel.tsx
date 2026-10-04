import type { ReactElement } from 'react';
import { Trash2 } from 'lucide-react';
import { cmd, type PresetId } from '@hm/contracts';
import type { Runtime } from '@hm/engine';
import { LOGIC_DOS, LOGIC_WHENS, normalizeRule, ruleScript, ruleSentence, type LogicRule } from '@hm/buildkit';
import { SFX_IDS } from '@hm/audio';
import { useRev } from '../use-rev';
import { usePlayer } from './player';
import { fx } from '../maker/feedback';

/**
 * The island's rules (the Logic tab's Rules): one row per rule, in words. Pro shows its blocks to change (when, do, how much); Studio also
 * shows the script the rule equals, to read and learn from. Every change is an undo step.
 */
const SLOT = 'logic';
const WHEN_WORDS: Record<string, string> = { touch: 'A goblin touches it', every: 'Every few seconds', night: 'Night falls', day: 'By day', start: 'The island opens' };
const DO_WORDS: Record<string, string> = { sound: 'Play a sound', spin: 'Spin', jump: 'Jump', hide: 'Hide', show: 'Show', say: 'Say something' };

export function LogicPanel(props: { readonly rt: Runtime; readonly sceneId: PresetId }): ReactElement {
  const { rt, sceneId } = props;
  useRev(rt);
  const level = usePlayer().level;
  const refs = rt.store.get(sceneId)?.children[SLOT] ?? [];
  const nameOf = (thing: string): string => (thing ? rt.store.get(thing as PresetId)?.name?.toLowerCase() ?? 'a thing that is gone' : 'the island');
  const set = (ref: PresetId, key: string, value: string | number): void => { rt.commands.execute(cmd.setParam(`${ref}.${key}`, value as never, 'Change a rule')); };
  const remove = (i: number): void => { rt.commands.execute(cmd.removeChild(sceneId, SLOT, i, 'Remove a rule')); fx('delete', { volume: 0.5 }); };
  if (refs.length === 0) return <p className="hint">No rules on this island yet. Pick one in the palette (Tab) and use Add rule on a thing.</p>;
  return (
    <div className="logic-panel">
      <ul className="lp-list" aria-label="Rules">
        {refs.map((r, i) => {
          if (!rt.store.get(r.ref)) return null;
          const rule: LogicRule = normalizeRule(rt.store.resolve(r.ref).params, r.ref);
          return (
            <li key={r.ref} className="lp-rule">
              <div className="lp-say"><span>{ruleSentence(rule, nameOf(rule.thing))}</span><button aria-label="Remove this rule" title="Remove (you can undo)" onClick={() => remove(i)}><Trash2 size={14} strokeWidth={1.6} /></button></div>
              {level !== 'easy' ? (
                <div className="lp-blocks">
                  <label className="lp-block when">When <select value={rule.when} onChange={(e) => set(r.ref, 'when', e.target.value)}>{LOGIC_WHENS.map((w) => <option key={w} value={w}>{WHEN_WORDS[w]}</option>)}</select></label>
                  {rule.when === 'touch' ? <label className="lp-block">within <input type="number" min={0.3} max={20} step={0.5} value={rule.near} onChange={(e) => set(r.ref, 'near', Number(e.target.value))} /> m</label> : null}
                  {rule.when === 'every' ? <label className="lp-block">every <input type="number" min={0.2} max={600} step={0.5} value={rule.every} onChange={(e) => set(r.ref, 'every', Number(e.target.value))} /> s</label> : null}
                  <label className="lp-block do">Do <select value={rule.do} onChange={(e) => set(r.ref, 'do', e.target.value)}>{LOGIC_DOS.map((d) => <option key={d} value={d}>{DO_WORDS[d]}</option>)}</select></label>
                  {rule.do === 'sound' ? <label className="lp-block"><select value={rule.sound} onChange={(e) => set(r.ref, 'sound', e.target.value)}>{SFX_IDS.map((s) => <option key={s} value={s}>{s.replace(/-/g, ' ')}</option>)}</select></label> : null}
                  {rule.do === 'say' ? <label className="lp-block"><input value={rule.text} maxLength={120} onChange={(e) => set(r.ref, 'text', e.target.value)} /></label> : null}
                  {rule.do === 'spin' || rule.do === 'jump' ? <label className="lp-block"><input type="number" min={0} max={20} step={0.5} value={rule.amount} onChange={(e) => set(r.ref, 'amount', Number(e.target.value))} /> {rule.do === 'spin' ? 'turns' : 'm'}</label> : null}
                </div>
              ) : null}
              {level === 'studio' ? <pre className="lp-script" aria-label="The script this rule equals">{ruleScript(rule, nameOf(rule.thing))}</pre> : null}
            </li>
          );
        })}
      </ul>
      {level === 'easy' ? <p className="hint">Pro (beside the hotbar) shows each rule's blocks to change; Studio shows the script it equals.</p> : null}
    </div>
  );
}
