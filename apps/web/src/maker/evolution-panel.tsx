import { useState, type MutableRefObject, type ReactElement } from 'react';
import type { PresetId } from '@hm/contracts';
import type { Runtime } from '@hm/engine';
import { baselineOf, changesBetween, summarise, type Baseline, type Decision, type Snap } from '@hm/lineage';
import { mapBundle } from './storage';

import { kv } from '../storage/profile-storage';

const KEY = 'hm.decisions.v1';

const load = (): Decision[] => { try { const v = JSON.parse(kv.get(KEY) ?? '[]') as unknown; return Array.isArray(v) ? (v as Decision[]) : []; } catch { return []; } };
const save = (d: readonly Decision[]): void => { try { kv.set(KEY, JSON.stringify(d.slice(-50))); } catch { /* storage may be unavailable; the panel still works for this session */ } };

/** The map's presets in the form the lineage compares: what each is, what it holds, and its content hash. */
export function snapshotOf(rt: Runtime, sceneId: PresetId): Snap[] {
  return mapBundle(rt, sceneId).presets.map((p) => ({
    id: p.id, kind: p.kind, name: p.name, hash: p.hash, author: p.meta.author ?? 'you', params: p.params,
    children: Object.fromEntries(Object.entries(p.children).map(([k, v]) => [k, v.map((r) => r.ref)])),
  }));
}

/**
 * Where this map stands against the version you started from. Changes that alter how the race plays get the evolution question:
 * suggest them for the next evolution (the community picks by what players use) or keep them as your own branch.
 * Looks and sounds are yours and never need asking. The decision is recorded here; tallying across players needs the platform backend.
 */
export function EvolutionPanel(props: { readonly rt: Runtime; readonly sceneId: PresetId; readonly name: string; readonly base: MutableRefObject<Baseline | null>; readonly onFeedback: (kind: 'success' | 'deleted', text: string) => void }): ReactElement {
  const { rt, sceneId, name, base, onFeedback } = props;
  if (!base.current) base.current = baselineOf(snapshotOf(rt, sceneId));
  const [decisions, setDecisions] = useState<Decision[]>(load);
  const [label, setLabel] = useState('');
  const now = snapshotOf(rt, sceneId);
  const changes = changesBetween(base.current, now, (kind) => (rt.schemas.get(kind)?.variables ?? []).map((v) => v.key));
  const sum = summarise(changes);
  const gameplay = changes.filter((c) => c.class === 'gameplay');
  const hashOf = (id: string): string => now.find((s) => s.id === id)?.hash ?? '';

  const decide = (kind: 'suggest' | 'branch'): void => {
    const d: Decision = { id: `dec-${Date.now().toString(36)}`, kind, name: label.trim() || `${name} (${kind === 'branch' ? 'my branch' : 'suggestion'})`, at: Date.now(), parent: sceneId, changes: gameplay.map((c) => ({ id: c.id, hash: hashOf(c.id) })) };
    const next = [...decisions, d];
    setDecisions(next); save(next); setLabel('');
    onFeedback('success', kind === 'suggest' ? 'Saved as a suggestion for the next evolution' : 'Kept as your own branch');
  };

  return (
    <section className="rules">
      <h3>Evolution</h3>
      <p className="hint">Goblin Racing grows from what players use. Changes to how the race plays can be suggested for the next evolution or kept as your own branch. Looks and sounds are always yours.</p>
      <p role="status"><b>{sum.text}</b></p>
      {changes.length > 0 ? (
        <ul className="sound-list">
          {changes.map((c) => (
            <li key={c.id}><div className="sound-row"><span className="grow">{c.name}</span><span className="chip" title={c.status}>{c.status === 'changed' ? c.keys.slice(0, 3).join(', ') + (c.keys.length > 3 ? '…' : '') : c.status}</span><span className={`chip ${c.class === 'gameplay' ? 'on' : ''}`}>{c.class === 'gameplay' ? 'plays differently' : 'looks only'}</span></div></li>
          ))}
        </ul>
      ) : null}
      {gameplay.length > 0 ? (
        <div className="driver-add">
          <label className="row">Name <input value={label} placeholder={`${name} (my version)`} onChange={(e) => setLabel(e.target.value)} /></label>
          <div className="btns">
            <button className="go" title="Put these changes forward. The most-used version of each part becomes the next default." onClick={() => decide('suggest')}>Suggest for the next evolution</button>
            <button title="Keep playing your version. Branches can branch." onClick={() => decide('branch')}>Keep as my branch</button>
          </div>
        </div>
      ) : null}
      <div className="btns"><button title="Compare against the map as it is right now from here on" onClick={() => { base.current = baselineOf(snapshotOf(rt, sceneId)); onFeedback('success', 'Starting point reset to now'); setDecisions((d) => [...d]); }}>Use the current map as my starting point</button></div>
      <h3 className="sub">Your decisions</h3>
      {decisions.length === 0 ? <p className="hint">None yet.</p> : (
        <ul className="sound-list">{decisions.slice().reverse().map((d) => <li key={d.id}><div className="sound-row"><span className="grow">{d.name}</span><span className="chip">{d.kind === 'suggest' ? 'suggested' : 'branch'} · {d.changes.length} part{d.changes.length === 1 ? '' : 's'}</span></div></li>)}</ul>
      )}
    </section>
  );
}
