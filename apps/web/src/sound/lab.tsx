import { useMemo, useState, type ReactElement } from 'react';
import { defineSchema, type Params, type Tier, type VariableDef } from '@hm/contracts';
import { Inspector } from '@hm/ui';
import {
  CATEGORIES, FILTER_TYPES, LIMITS, RANGES, SFX_KINDS, WAVES, describeLayer, describeMusicSpec, describeRecipe, engineSpecToPoints, mutateRecipe, normalizeRecipe, randomEngineSpec,
  randomMusicSpec, randomRecipe, recipeFromJson, recipeToJson, renderRecipe, waveformBins, MOODS, moodDefaults,
  type EngineSpec, type MusicSpec, type SfxKind, type SfxLayer, type SfxRecipe,
} from '@hm/soundlab';

/** Frequency sliders are logarithmic: equal steps are equal musical intervals. */
export const hzToSlider = (hz: number): number => Math.log(Math.max(20, Math.min(20000, hz)) / 20) / Math.log(1000);
export const sliderToHz = (v: number): number => Math.round(20 * Math.pow(1000, Math.max(0, Math.min(1, v))));

const Slider = (p: { label: string; value: number; min: number; max: number; step: number; unit?: string; onChange: (v: number) => void; show?: (v: number) => string }): ReactElement => (
  <label className="row">{p.label} <input type="range" min={p.min} max={p.max} step={p.step} value={p.value} onChange={(e) => p.onChange(Number(e.target.value))} /> <span>{p.show ? p.show(p.value) : `${Math.round(p.value * 100) / 100}${p.unit ?? ''}`}</span></label>
);

/** The drawn waveform of a recipe (min and max per column). */
function Wave({ recipe }: { readonly recipe: SfxRecipe }): ReactElement {
  const bins = useMemo(() => waveformBins(renderRecipe(recipe, 11025), 120), [recipeToJson(recipe)]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <svg className="wave" viewBox="0 0 120 40" preserveAspectRatio="none" role="img" aria-label="Waveform of the sound" data-lab="wave">
      <line x1="0" y1="20" x2="120" y2="20" stroke="currentColor" strokeOpacity="0.25" strokeWidth="0.4" />
      {bins.map((b, i) => <line key={i} x1={i + 0.5} x2={i + 0.5} y1={20 - Math.min(1, b.max) * 19} y2={20 - Math.max(-1, b.min) * 19 + 0.4} stroke="currentColor" strokeWidth="0.8" />)}
    </svg>
  );
}

/** One layer's numbers as presets variables: comfortable ranges for the sliders (they grow when pushed), hard limits only where sound stops making sense. */
const v = (key: string, label: string, doc: string, r: { min: number; max: number }, hard: { min: number; max: number }, step: number, tier: Tier, unit?: string): VariableDef =>
  ({ key, type: 'number', label, doc, tier, default: r.min, min: r.min, max: r.max, step, hardMin: hard.min, hardMax: hard.max, group: 'Layer', ...(unit ? { unit } : {}) });
function layerSchema(layer: SfxLayer): ReturnType<typeof defineSchema> {
  const vars: VariableDef[] = [v('gain', 'Volume', 'How loud this layer is.', RANGES.gain, LIMITS.gain, 0.01, 'play')];
  if (layer.wave !== 'noise') {
    vars.push(v('freqStart', 'Pitch start', 'Where the pitch starts.', RANGES.freq, LIMITS.freq, 1, 'play', 'Hz'));
    vars.push(v('freqEnd', 'Pitch end', 'Where the pitch ends (a slide from start to end).', RANGES.freq, LIMITS.freq, 1, 'play', 'Hz'));
  }
  vars.push(v('attackMs', 'Fade in', 'How long it takes to reach full volume.', RANGES.attackMs, LIMITS.attackMs, 1, 'play', 'ms'));
  vars.push(v('decayMs', 'Fade out', 'How long it takes to die away.', RANGES.decayMs, LIMITS.decayMs, 1, 'play', 'ms'));
  vars.push(v('delayMs', 'Starts after', 'Wait this long before this layer plays.', RANGES.delayMs, LIMITS.delayMs, 1, 'build', 'ms'));
  if (layer.wave !== 'noise') vars.push(v('detune', 'Detune', 'Shift the pitch by cents (100 = a semitone).', RANGES.detune, LIMITS.detune, 1, 'build', 'ct'));
  vars.push({ key: 'filterOn', type: 'boolean', label: 'Filter', doc: 'Shape the tone with a filter.', tier: 'build', default: false, group: 'Filter' });
  if (layer.filter) {
    vars.push({ key: 'filterType', type: 'enum', label: 'Type', doc: 'lowpass keeps the lows, highpass the highs, bandpass a band.', tier: 'build', default: layer.filter.type, options: [...FILTER_TYPES], group: 'Filter' });
    vars.push({ ...v('cutoffStart', 'Cutoff start', 'Where the filter starts.', RANGES.freq, LIMITS.freq, 1, 'build', 'Hz'), group: 'Filter' });
    vars.push({ ...v('cutoffEnd', 'Cutoff end', 'Where the filter ends.', RANGES.freq, LIMITS.freq, 1, 'build', 'Hz'), group: 'Filter' });
    vars.push({ ...v('q', 'Sharpness', 'How sharp the filter is.', RANGES.q, LIMITS.q, 0.1, 'build'), group: 'Filter' });
  }
  return defineSchema({ kind: 'sound-layer', version: 1, label: 'Layer', doc: 'One layer of a sound.', variables: vars, slots: [] });
}
const layerParams = (l: SfxLayer): Params => ({
  gain: l.gain, freqStart: l.freq[0], freqEnd: l.freq[1], attackMs: l.attackMs, decayMs: l.decayMs, delayMs: l.delayMs ?? 0, detune: l.detune ?? 0,
  filterOn: !!l.filter, ...(l.filter ? { filterType: l.filter.type, cutoffStart: l.filter.freq[0], cutoffEnd: l.filter.freq[1], q: l.filter.q } : {}),
});
function applyLayerEdit(l: SfxLayer, key: string, value: unknown): SfxLayer {
  const n = Number(value);
  switch (key) {
    case 'gain': return { ...l, gain: n };
    case 'freqStart': return { ...l, freq: [n, l.freq[1]] };
    case 'freqEnd': return { ...l, freq: [l.freq[0], n] };
    case 'attackMs': return { ...l, attackMs: n };
    case 'decayMs': return { ...l, decayMs: n };
    case 'delayMs': return { ...l, delayMs: n };
    case 'detune': return { ...l, detune: n };
    case 'filterOn': { const { filter: _drop, ...rest } = l; void _drop; return value === true ? { ...rest, filter: { type: 'lowpass', freq: [2000, 2000], q: 1 } } : rest; }
    case 'filterType': return l.filter ? { ...l, filter: { ...l.filter, type: value as NonNullable<SfxLayer['filter']>['type'] } } : l;
    case 'cutoffStart': return l.filter ? { ...l, filter: { ...l.filter, freq: [n, l.filter.freq[1]] } } : l;
    case 'cutoffEnd': return l.filter ? { ...l, filter: { ...l.filter, freq: [l.filter.freq[0], n] } } : l;
    case 'q': return l.filter ? { ...l, filter: { ...l.filter, q: n } } : l;
    default: return l;
  }
}

function LayerCard({ layer, index, count, tier, onChange, onRemove, onDuplicate }: { layer: SfxLayer; index: number; count: number; tier: Tier; onChange: (l: SfxLayer) => void; onRemove: () => void; onDuplicate: () => void }): ReactElement {
  const set = (patch: Partial<SfxLayer>): void => onChange({ ...layer, ...patch });
  return (
    <section className="layer" data-layer={index}>
      <div className="layer-head">
        <b>Layer {index + 1}</b>
        <select data-field="wave" value={layer.wave} onChange={(e) => set({ wave: e.target.value as SfxLayer['wave'] })}>{WAVES.map((w) => <option key={w} value={w}>{w}</option>)}</select>
        <button data-action="duplicate-layer" title="Copy this layer" onClick={onDuplicate} disabled={count >= 8}>⧉</button>
        <button data-action="remove-layer" title="Remove this layer" onClick={onRemove} disabled={count <= 1}>✕</button>
      </div>
      <p className="hint">{describeLayer(layer)}</p>
      <Inspector schema={layerSchema(layer)} params={layerParams(layer)} resolved={layerParams(layer)} tier={tier} onChange={(k, v) => onChange(applyLayerEdit(layer, k, v))} />
    </section>
  );
}

/** Edit one sound effect: hear it, see it, change every layer, roll a new one or wiggle this one. */
export function SoundLab(props: { recipe: SfxRecipe; onChange: (r: SfxRecipe) => void; onPreview: (r: SfxRecipe) => void; tier: Tier }): ReactElement {
  const { recipe, onChange, onPreview, tier } = props;
  const [kind, setKind] = useState<SfxKind>('pickup');
  const [amount, setAmount] = useState(0.3);
  const [seed, setSeed] = useState(1);
  const [text, setText] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const emit = (r: SfxRecipe, play = true): void => { const n = normalizeRecipe(r); onChange(n); if (play) onPreview(n); };
  const setLayer = (i: number, l: SfxLayer): void => emit({ ...recipe, layers: recipe.layers.map((x, k) => (k === i ? l : x)) }, false);

  return (
    <div className="lab" data-lab="sound">
      <p className="hint">{describeRecipe(recipe)}</p>
      <Wave recipe={recipe} />
      <div className="btns">
        <button className="go" data-action="preview" onClick={() => onPreview(recipe)}>▶ Play</button>
        <button data-action="add-layer" disabled={recipe.layers.length >= 8} onClick={() => { const last = recipe.layers[recipe.layers.length - 1]!; emit({ ...recipe, layers: [...recipe.layers, { ...last, gain: last.gain / 2 }] }); }}>＋ Layer</button>
      </div>
      <div className="row"><select data-field="kind" value={kind} onChange={(e) => setKind(e.target.value as SfxKind)} title={SFX_KINDS.find((k) => k.kind === kind)?.doc}>{SFX_KINDS.map((k) => <option key={k.kind} value={k.kind}>{k.label}</option>)}</select>
        <button data-action="randomize" onClick={() => { const next = seed + 1; setSeed(next); const r = randomRecipe(next, kind, recipe.category); emit({ ...r, id: recipe.id }); }}>🎲 Roll a new one</button></div>
      <div className="row"><button data-action="mutate" onClick={() => { const next = seed + 1; setSeed(next); emit(mutateRecipe(recipe, next, amount)); }}>〰 Wiggle</button>
        <input type="range" data-field="amount" min={0} max={1} step={0.05} value={amount} onChange={(e) => setAmount(Number(e.target.value))} aria-label="How much to wiggle" /> <span>{Math.round(amount * 100)}%</span></div>
      {recipe.layers.map((l, i) => (
        <LayerCard key={i} layer={l} index={i} count={recipe.layers.length} tier={tier} onChange={(x) => setLayer(i, x)}
          onRemove={() => emit({ ...recipe, layers: recipe.layers.filter((_, k) => k !== i) }, false)}
          onDuplicate={() => emit({ ...recipe, layers: [...recipe.layers.slice(0, i + 1), { ...l, gain: l.gain / 2 }, ...recipe.layers.slice(i + 1)] })} />
      ))}
      {tier === 'pro' ? (
        <div>
          <h3 className="sub">Recipe (JSON)</h3>
          <label className="row">Category <select value={recipe.category} onChange={(e) => emit({ ...recipe, category: e.target.value as SfxRecipe['category'] }, false)}>{CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</select></label>
          <textarea className="code" data-field="json" rows={8} value={text ?? recipeToJson(recipe)} onChange={(e) => setText(e.target.value)} />
          <div className="btns"><button data-action="apply-json" onClick={() => { const r = recipeFromJson(text ?? ''); if (r.recipe) { setErrors([]); setText(null); emit(r.recipe); } else setErrors(r.errors); }}>Apply</button></div>
          {errors.length ? <ul data-lab="errors" className="bad">{errors.map((e) => <li key={e}>{e}</li>)}</ul> : null}
        </div>
      ) : null}
    </div>
  );
}

/** The engine hum: a response curve and a slider for every setting. */
export function EngineLab(props: { spec: EngineSpec; onChange: (key: keyof EngineSpec, value: number) => void; onReplace: (s: EngineSpec) => void; tier: Tier; maxSpeed?: number }): ReactElement {
  const { spec, onChange, onReplace, tier } = props;
  const [seed, setSeed] = useState(1);
  const pts = engineSpecToPoints(spec, props.maxSpeed ?? 28, 24);
  const fmax = Math.max(...pts.map((p) => p.freq), 1);
  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${(i / (pts.length - 1)) * 120},${38 - (p.freq / fmax) * 36}`).join(' ');
  const rows: { key: keyof EngineSpec; label: string; min: number; max: number; step: number; advanced?: boolean; unit?: string }[] = [
    { key: 'baseFreq', label: 'Idle pitch', min: 20, max: 400, step: 1, unit: ' Hz' }, { key: 'freqPerSpeed', label: 'Pitch with speed', min: 0, max: 800, step: 1, unit: ' Hz' },
    { key: 'baseNoise', label: 'Idle rumble', min: 0, max: 0.2, step: 0.005 },
    { key: 'freqPerThrottle', label: 'Pitch with throttle', min: 0, max: 300, step: 1, advanced: true, unit: ' Hz' }, { key: 'baseGain', label: 'Idle loudness', min: 0, max: 0.3, step: 0.005, advanced: true },
    { key: 'gainPerThrottle', label: 'Loudness with throttle', min: 0, max: 0.3, step: 0.005, advanced: true }, { key: 'gainPerSpeed', label: 'Loudness with speed', min: 0, max: 0.3, step: 0.005, advanced: true },
    { key: 'baseFilter', label: 'Idle brightness', min: 100, max: 4000, step: 10, advanced: true, unit: ' Hz' }, { key: 'filterPerSpeed', label: 'Brightness with speed', min: 0, max: 8000, step: 10, advanced: true, unit: ' Hz' },
    { key: 'filterPerThrottle', label: 'Brightness with throttle', min: 0, max: 4000, step: 10, advanced: true, unit: ' Hz' }, { key: 'noisePerSpeed', label: 'Rumble with speed', min: 0, max: 0.3, step: 0.005, advanced: true },
  ];
  return (
    <div className="lab" data-lab="engine">
      <p className="hint">Pitch (line) from standing still to top speed at full throttle.</p>
      <svg className="wave" viewBox="0 0 120 40" preserveAspectRatio="none" data-lab="engine-curve" role="img" aria-label="Engine pitch against speed"><path d={path} fill="none" stroke="currentColor" strokeWidth="1.2" /></svg>
      {rows.filter((r) => tier !== 'play' || !r.advanced).map((r) => <Slider key={r.key} label={r.label} value={spec[r.key]} min={r.min} max={r.max} step={r.step} unit={r.unit} onChange={(v) => onChange(r.key, v)} />)}
      <div className="btns">{(['smooth', 'buzzy', 'rumble'] as const).map((c) => <button key={c} onClick={() => { const n = seed + 1; setSeed(n); onReplace(randomEngineSpec(n, c)); }}>🎲 {c}</button>)}</div>
    </div>
  );
}

/** The race music: mood, tempo, length and a seed for a different tune. */
export function MusicLab(props: { spec: MusicSpec; onChange: (s: MusicSpec) => void; onPreview: (s: MusicSpec) => void; tier: Tier }): ReactElement {
  const { spec, onChange, onPreview, tier } = props;
  return (
    <div className="lab" data-lab="music">
      <p className="hint">{describeMusicSpec(spec)}</p>
      <div className="seg">{MOODS.map((m) => <button key={m} className={spec.mood === m ? 'on' : ''} onClick={() => { const s = { ...spec, mood: m, bpm: moodDefaults(m).bpm }; onChange(s); onPreview(s); }}>{m}</button>)}</div>
      <Slider label="Tempo" value={spec.bpm} min={60} max={200} step={1} unit=" BPM" onChange={(v) => onChange({ ...spec, bpm: v })} />
      {tier !== 'play' ? <Slider label="Length" value={spec.bars} min={1} max={16} step={1} unit=" bars" onChange={(v) => onChange({ ...spec, bars: v })} /> : null}
      <div className="btns">
        <button className="go" onClick={() => onPreview(spec)}>▶ Play</button>
        <button data-action="reroll" onClick={() => { const s = { ...spec, seed: spec.seed + 1 }; onChange(s); onPreview(s); }}>🎲 New tune (seed {spec.seed})</button>
        <button onClick={() => { const s = randomMusicSpec(spec.seed + 1); onChange(s); onPreview(s); }}>Surprise me</button>
      </div>
    </div>
  );
}
