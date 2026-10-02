import { useEffect, useRef, useState, type ReactElement } from 'react';
import { recordToClip } from '@hm/motion';
import { cmd, type PresetId, type Tier } from '@hm/contracts';
import type { Runtime } from '@hm/engine';
import { MODULATOR_PRESETS, describeModulator, validateModulator, type ModulatorDef } from '@hm/modulation';
import { ModulatorPanel, Sparkline, previewValues } from '@hm/modui';

/**
 * "Drive with ..." for any number setting of a prop: pick a ready-made driver (wobble, pulse, orbit ...), then tune it with the
 * modulator panel. A driver is just a 'modulator' preset in the scene's `modulators` slot, so it saves, undoes and loads like everything else.
 */

export interface DriverRow { readonly id: PresetId; readonly target: string; readonly key: string; readonly def: ModulatorDef | null; readonly mode: string; readonly amount: number; readonly enabled: boolean }

export function driversOf(rt: Runtime, sceneId: PresetId, propId: PresetId): DriverRow[] {
  const refs = rt.store.get(sceneId)?.children['modulators'] ?? [];
  const rows: DriverRow[] = [];
  for (const r of refs) {
    const p = rt.store.get(r.ref);
    if (!p) continue;
    const target = String(p.params['target'] ?? '');
    if (!target.startsWith(`${propId}.`)) continue;
    let def: ModulatorDef | null = null;
    try { const raw = p.params['def']; const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw; if (validateModulator(parsed).ok) def = parsed as ModulatorDef; } catch { /* shown as broken */ }
    rows.push({ id: p.id, target, key: target.slice(propId.length + 1), def, mode: String(p.params['mode'] ?? 'replace'), amount: Number(p.params['amount'] ?? 1), enabled: p.params['enabled'] !== false });
  }
  return rows;
}

export function addDriver(rt: Runtime, sceneId: PresetId, propId: PresetId, key: string, label: string, def: ModulatorDef, mode: 'replace' | 'add' | 'scale'): PresetId {
  const id = `mod-${Date.now().toString(36)}-${Math.floor(Math.random() * 1296).toString(36)}`;
  rt.commands.transaction(`Drive ${key}`, () => {
    rt.commands.execute(cmd.put({ id, kind: 'modulator', name: label, params: { target: `${propId}.${key}`, def: JSON.stringify(def), mode, amount: 1, enabled: true }, tier: 'build' }, `Drive ${key}`));
    rt.commands.execute(cmd.addChild(sceneId, 'modulators', id, undefined, `Drive ${key}`));
  });
  return id;
}

export function removeDriver(rt: Runtime, sceneId: PresetId, id: PresetId): void {
  const refs = rt.store.get(sceneId)?.children['modulators'] ?? [];
  const idx = refs.findIndex((r) => r.ref === id);
  if (idx >= 0) rt.commands.execute(cmd.removeChild(sceneId, 'modulators', idx, 'Remove driver'));
}

/** Presets make most sense as an offset on top of the value the setting already has, except absolute ranges. */
const modeFor = (def: ModulatorDef): 'replace' | 'add' => (def.kind === 'noise' || def.kind === 'random' || def.kind === 'lfo' ? 'add' : 'replace');

export function DriversPanel(props: {
  readonly rt: Runtime;
  readonly sceneId: PresetId;
  readonly propId: PresetId;
  readonly numberKeys: readonly { key: string; label: string }[];
  readonly tier: Tier;
  readonly onFeedback: (kind: 'success' | 'error' | 'deleted', text: string) => void;
}): ReactElement {
  const { rt, sceneId, propId, numberKeys, tier, onFeedback } = props;
  const [adding, setAdding] = useState(false);
  const [key, setKey] = useState(numberKeys[0]?.key ?? 'y');
  const [open, setOpen] = useState<PresetId | null>(null);
  const [recording, setRecording] = useState<{ key: string; since: number } | null>(null);
  const samples = useRef<{ t: number; v: number }[]>([]);

  // RECORD: while on, the chosen setting is sampled every frame; whatever you drag (a slider, a gizmo, a brush) becomes a timeline driver
  useEffect(() => {
    if (!recording) return;
    samples.current = [];
    let raf = 0;
    const tick = (now: number): void => {
      const v = rt.vars.read(`${propId}.${recording.key}`);
      if (typeof v === 'number') samples.current.push({ t: now - recording.since, v });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [recording, rt, propId]);
  const stopRecording = (): void => {
    if (!recording) return;
    const key = recording.key;
    setRecording(null);
    const s = samples.current;
    const lo = Math.min(...s.map((x) => x.v)), hi = Math.max(...s.map((x) => x.v));
    if (s.length < 5 || !(hi > lo)) { onFeedback('deleted', 'Nothing moved while recording'); return; }
    const clip = recordToClip('rec', key, s, { tolerance: (hi - lo) * 0.01, smoothMs: 30 });
    const keys = clip.tracks[0]!.keys;
    const def = { kind: 'timeline', durationMs: Math.max(100, Math.round(clip.durationMs)), loop: 'loop', keys: keys.map((k) => ({ timeMs: Math.round(k.t), value: k.v, ...(k.ease && k.ease !== 'linear' ? { ease: k.ease } : {}) })) } as never;
    const id = addDriver(rt, sceneId, propId, key, 'Recorded movement', def, 'replace');
    setOpen(id);
    onFeedback('success', `Recorded ${(clip.durationMs / 1000).toFixed(1)} s as ${keys.length} keyframes`);
  };
  const rows = driversOf(rt, sceneId, propId);
  const label = (k: string): string => numberKeys.find((n) => n.key === k)?.label ?? k;
  const setParam = (id: PresetId, k: string, v: string | number | boolean): void => { rt.commands.execute(cmd.setParam(`${id}.${k}`, v, 'Edit driver')); };

  return (
    <section className="drivers">
      <h3 className="sub">Drivers</h3>
      {rows.length === 0 ? <p className="hint">Make any setting move by itself: a wobble, a pulse, a wave, a timeline. They run while the game plays — press Preview to see them.</p> : null}
      {rows.map((r) => (
        <div key={r.id} className={`driver${r.enabled ? '' : ' off'}`}>
          <div className="driver-head">
            <b>{label(r.key)}</b>
            {r.def ? <Sparkline values={previewValues(r.def, 48)} width={70} height={22} label={describeModulator(r.def)} /> : <span className="bad">broken</span>}
            <button title="Edit this driver" onClick={() => setOpen(open === r.id ? null : r.id)}>{open === r.id ? 'Done' : 'Edit'}</button>
            <button title={r.enabled ? 'Switch off' : 'Switch on'} onClick={() => setParam(r.id, 'enabled', !r.enabled)}>{r.enabled ? '●' : '○'}</button>
            <button title="Remove" onClick={() => { removeDriver(rt, sceneId, r.id); onFeedback('deleted', 'Driver removed'); }}>✕</button>
          </div>
          {r.def ? <p className="hint">{describeModulator(r.def)}</p> : null}
          {open === r.id ? (
            <div className="driver-edit">
              <label className="row">Amount <input type="range" min={0} max={1} step={0.01} value={r.amount} onChange={(e) => setParam(r.id, 'amount', Number(e.target.value))} /> <span>{Math.round(r.amount * 100)}%</span></label>
              <label className="row">Mode <select value={r.mode} onChange={(e) => setParam(r.id, 'mode', e.target.value)}>
                <option value="replace">Set the value</option><option value="add">Add to the value</option><option value="scale">Multiply the value</option>
              </select></label>
              {r.def ? <ModulatorPanel def={r.def} tier={tier} preview={previewValues(r.def, 96)} onChange={(d) => setParam(r.id, 'def', JSON.stringify(d))} /> : null}
            </div>
          ) : null}
        </div>
      ))}
      {adding ? (
        <div className="driver-add">
          <label className="row">Setting <select value={key} onChange={(e) => setKey(e.target.value)}>{numberKeys.map((n) => <option key={n.key} value={n.key}>{n.label}</option>)}</select></label>
          <div className="chips">
            {MODULATOR_PRESETS.map((p) => (
              <button key={p.id} className="chip" title={p.doc} onClick={() => {
                const id = addDriver(rt, sceneId, propId, key, p.name, p.def, modeFor(p.def));
                setAdding(false); setOpen(id); onFeedback('success', `${p.name} drives ${label(key)}`);
              }}>
                <Sparkline values={previewValues(p.def, 32)} width={44} height={16} /> {p.name}
              </button>
            ))}
          </div>
          <button onClick={() => setAdding(false)}>Cancel</button>
        </div>
      ) : recording ? (
        <div className="driver-add"><p className="hint" role="status">● Recording {label(recording.key)}: drag it now, then stop.</p><button className="go" onClick={stopRecording}>■ Stop and keep it</button><button onClick={() => setRecording(null)}>Cancel</button></div>
      ) : <div className="btns"><button className="go" onClick={() => setAdding(true)}>＋ Drive a setting…</button><button title="Drag a setting and keep the movement as a looping driver" onClick={() => setRecording({ key, since: performance.now() })}>● Record movement of {label(key)}</button><select value={key} onChange={(e) => setKey(e.target.value)} aria-label="Setting to record">{numberKeys.map((n) => <option key={n.key} value={n.key}>{n.label}</option>)}</select></div>}
    </section>
  );
}
