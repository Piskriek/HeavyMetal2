/**
 * NewDecor — the Decorate panel for the track builder.
 *
 * Two halves. **Brush**: palette, radius, density, spacing, size variety, erase / auto-only, road
 * allowed. **Auto-decorate**: pick a rule, its sliders appear from the rule's own schema, choose a
 * palette and a span (whole track · this stage · around the camera), see a live count of what it
 * would place, then Run, Re-roll or Clear. A Theme button runs the per-stage composition with one
 * intensity knob. Every action is one undo step in the builder (Ctrl+Z as usual).
 *
 * Mount it wherever the builder's tabs live, e.g. as a 'decorate' tab in TrackBuilderUI:
 *   <DecorPanel tool={builder.decor} />
 */
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import type { DecorTool, RunRequest, SpanMode } from '../game/decor/decor-tool';
import { defaultParams, type RuleParams } from '../game/decor/auto-decorate';

const row: CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, margin: '4px 0' };
const label: CSSProperties = { width: 110, opacity: 0.8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };
const button: CSSProperties = { padding: '5px 10px', borderRadius: 5, border: '1px solid #7a5a2a', background: '#2a1e12', color: '#f5e6c8', cursor: 'pointer', fontSize: 12 };
const primary: CSSProperties = { ...button, background: '#c58a2e', color: '#1a120a', fontWeight: 600 };
const section: CSSProperties = { border: '1px solid #4a3a26', borderRadius: 8, padding: 10, marginBottom: 10, background: 'rgba(18,13,9,0.6)' };

function Slider(props: { label: string; value: number; min: number; max: number; step: number; unit?: string; hint?: string; onChange: (v: number) => void }) {
  const { value } = props;
  const shown = Math.abs(value) < 0.01 && value !== 0 ? value.toExponential(1) : Number.isInteger(props.step) ? String(Math.round(value)) : value.toFixed(2).replace(/\.?0+$/, '');
  return (
    <div style={row} title={props.hint}>
      <span style={label}>{props.label}</span>
      <input type="range" min={props.min} max={props.max} step={props.step} value={value} onChange={(e) => props.onChange(Number(e.target.value))} style={{ flex: 1 }} />
      <span style={{ width: 64, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{shown}{props.unit ? ` ${props.unit}` : ''}</span>
    </div>
  );
}

export function DecorPanel({ tool }: { tool: DecorTool }) {
  const [, bump] = useState(0);
  useEffect(() => tool.onChange(() => bump((n) => n + 1)), [tool]);

  const [ruleId, setRuleId] = useState(tool.rules[0].id);
  const rule = useMemo(() => tool.rules.find((r) => r.id === ruleId) ?? tool.rules[0], [tool, ruleId]);
  const [paramsByRule, setParamsByRule] = useState<Record<string, RuleParams>>({});
  const params = paramsByRule[rule.id] ?? defaultParams(rule);
  const [palette, setPalette] = useState<string | null>(null);
  const [span, setSpan] = useState<SpanMode>('stage');
  const [win, setWindow] = useState(4000);
  const [seed, setSeed] = useState(1234);
  const [intensity, setIntensity] = useState(1);
  const [status, setStatus] = useState<string>('');

  const request: RunRequest = { rule: rule.id, params, palette: palette ?? rule.defaultPalette, span, window: win, seed };
  const previewCount = useMemo(() => {
    try { return tool.preview(request); } catch { return 0; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool, rule.id, JSON.stringify(params), palette, span, win, seed, tool.counts().decor]);

  const setParam = (key: string, value: number) => setParamsByRule((all) => ({ ...all, [rule.id]: { ...params, [key]: value } }));
  const counts = tool.counts();
  const b = tool.brush;

  const report = (r: { added: number; removed: number; span: readonly [number, number] }, what: string) =>
    setStatus(`${what}: +${r.added}${r.removed ? ` −${r.removed}` : ''} on ${Math.round(r.span[0])}–${Math.round(r.span[1])}`);

  return (
    <div style={{ color: '#f5e6c8', fontFamily: 'inherit', minWidth: 300 }}>
      <div style={section}>
        <div style={{ ...row, justifyContent: 'space-between' }}>
          <strong>Decoration brush</strong>
          <button style={tool.isEnabled ? primary : button} onClick={() => tool.setEnabled(!tool.isEnabled)}>{tool.isEnabled ? 'Brush on' : 'Brush off'}</button>
        </div>
        <div style={row}>
          <span style={label}>Palette</span>
          <select value={b.palette} onChange={(e) => tool.setBrush({ palette: e.target.value })} style={{ flex: 1 }}>
            {tool.palettes.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <Slider label="Radius" value={b.radius} min={60} max={4000} step={20} unit="u" onChange={(v) => tool.setBrush({ radius: v })} />
        <Slider label="Density" value={b.density} min={0.2} max={40} step={0.2} hint="Props per stamp at radius 600" onChange={(v) => tool.setBrush({ density: v })} />
        <Slider label="Spacing" value={b.spacing} min={0.5} max={3} step={0.1} unit="×" onChange={(v) => tool.setBrush({ spacing: v })} />
        <Slider label="Size variety" value={b.sizeVariety} min={0} max={1} step={0.05} onChange={(v) => tool.setBrush({ sizeVariety: v })} />
        <Slider label="Flow" value={b.flow} min={40} max={1200} step={20} unit="u" hint="Distance between stamps along a stroke" onChange={(v) => tool.setBrush({ flow: v })} />
        <div style={row}>
          <label><input type="checkbox" checked={b.erase} onChange={(e) => tool.setBrush({ erase: e.target.checked })} /> Erase</label>
          <label><input type="checkbox" checked={b.autoOnly} disabled={!b.erase} onChange={(e) => tool.setBrush({ autoOnly: e.target.checked })} /> auto-placed only</label>
          <label><input type="checkbox" checked={b.allowRoad} onChange={(e) => tool.setBrush({ allowRoad: e.target.checked })} /> allow on road</label>
        </div>
      </div>

      <div style={section}>
        <div style={{ ...row, justifyContent: 'space-between' }}>
          <strong>Auto-decorate</strong>
          <span style={{ opacity: 0.7 }}>{counts.decor} decorations · {counts.auto} auto</span>
        </div>
        <div style={row}>
          <span style={label}>Rule</span>
          <select value={rule.id} onChange={(e) => setRuleId(e.target.value)} style={{ flex: 1 }}>
            {tool.rules.map((r) => <option key={r.id} value={r.id}>{r.name}{counts.byRule[r.id] ? ` (${counts.byRule[r.id]})` : ''}</option>)}
          </select>
        </div>
        <p style={{ fontSize: 11, opacity: 0.75, margin: '2px 0 8px' }}>{rule.blurb}</p>
        <div style={row}>
          <span style={label}>Palette</span>
          <select value={palette ?? rule.defaultPalette} onChange={(e) => setPalette(e.target.value)} style={{ flex: 1 }}>
            {tool.palettes.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        {rule.params.map((spec) => (
          <Slider key={spec.key} label={spec.label} value={params[spec.key] ?? spec.default} min={spec.min} max={spec.max} step={spec.step} unit={spec.unit} hint={spec.hint} onChange={(v) => setParam(spec.key, v)} />
        ))}
        <div style={row}>
          <span style={label}>Span</span>
          {(['track', 'stage', 'window'] as SpanMode[]).map((m) => (
            <button key={m} style={span === m ? primary : button} onClick={() => setSpan(m)}>{m === 'track' ? 'Whole track' : m === 'stage' ? `This stage (${tool.stageAtCamera()})` : 'Around camera'}</button>
          ))}
        </div>
        {span === 'window' && <Slider label="Window ±" value={win} min={500} max={20000} step={250} unit="u" onChange={setWindow} />}
        <Slider label="Seed" value={seed} min={0} max={9999} step={1} onChange={setSeed} />
        <div style={{ ...row, flexWrap: 'wrap' }}>
          <button style={primary} onClick={() => report(tool.run(request), rule.name)}>Run · {previewCount}</button>
          <button style={button} onClick={() => { const r = tool.reroll(request); setSeed(r.seed % 10000); report(r, `${rule.name} re-rolled`); }}>Re-roll</button>
          <button style={button} onClick={() => setParamsByRule((all) => ({ ...all, [rule.id]: defaultParams(rule) }))}>Defaults</button>
          <button style={button} onClick={() => setStatus(`Cleared ${tool.clear(rule.id, span, win)} from ${rule.name}`)}>Clear rule</button>
        </div>
      </div>

      <div style={section}>
        <div style={{ ...row, justifyContent: 'space-between' }}><strong>Theme</strong><span style={{ opacity: 0.7 }}>forest · rock · mine · crowd, per stage</span></div>
        <Slider label="Intensity" value={intensity} min={0.25} max={2.5} step={0.05} unit="×" onChange={setIntensity} />
        <div style={{ ...row, flexWrap: 'wrap' }}>
          <button style={primary} onClick={() => report(tool.runTheme({ span, window: win, seed, intensity }), 'Theme')}>Decorate {span === 'track' ? 'whole track' : span === 'stage' ? 'this stage' : 'around camera'}</button>
          <button style={button} onClick={() => setStatus(`Cleared ${tool.clear(null, span, win)} auto decorations`)}>Clear all auto</button>
        </div>
      </div>
      {status && <div style={{ fontSize: 11, opacity: 0.8 }}>{status}</div>}
    </div>
  );
}

export default DecorPanel;
