/**
 * NewSculpt — the Sculpt panel for the track builder.
 *
 * A mode toggle, the nine tools (with their digit hotkeys), radius / strength / hardness, the push
 * direction for Raise & Lower, a colour for Paint, a seed for Noise, what you last touched (with a
 * Reset), and the list of everything on the course that carries a sculpt. Every stroke is one undo
 * step in the builder (Ctrl+Z as usual).
 *
 * Mount it as a builder tab: <SculptPanel tool={builder.sculpt!} />
 */
import { useEffect, useState, type CSSProperties } from 'react';
import type { SculptTool } from '../game/sculpt/sculpt-tool';
import type { SculptDirection } from '../game/sculpt/sculpt-brushes';

const row: CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, margin: '4px 0' };
const label: CSSProperties = { width: 96, opacity: 0.8 };
const button: CSSProperties = { padding: '5px 9px', borderRadius: 5, border: '1px solid #7a5a2a', background: '#2a1e12', color: '#f5e6c8', cursor: 'pointer', fontSize: 12 };
const primary: CSSProperties = { ...button, background: '#e0862c', color: '#1a120a', fontWeight: 600 };
const section: CSSProperties = { border: '1px solid #4a3a26', borderRadius: 8, padding: 10, marginBottom: 10, background: 'rgba(18,13,9,0.6)' };

function Slider(props: { label: string; value: number; min: number; max: number; step: number; unit?: string; onChange: (v: number) => void }) {
  return (
    <div style={row}>
      <span style={label}>{props.label}</span>
      <input type="range" min={props.min} max={props.max} step={props.step} value={props.value} onChange={(e) => props.onChange(Number(e.target.value))} style={{ flex: 1 }} />
      <span style={{ width: 60, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{Number.isInteger(props.step) ? Math.round(props.value) : props.value.toFixed(2)}{props.unit ? ` ${props.unit}` : ''}</span>
    </div>
  );
}

const toHex = (c: [number, number, number]) => '#' + c.map((v) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0')).join('');
const fromHex = (hex: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number];

export function SculptPanel({ tool }: { tool: SculptTool }) {
  const [, bump] = useState(0);
  useEffect(() => tool.onChange(() => bump((n) => n + 1)), [tool]);
  const b = tool.brush;
  const target = tool.target();
  const sculpted = tool.sculpted();

  return (
    <div style={{ color: '#f5e6c8', minWidth: 300 }}>
      <div style={section}>
        <div style={{ ...row, justifyContent: 'space-between' }}>
          <strong>Sculpt &amp; mesh paint</strong>
          <button style={tool.isEnabled ? primary : button} onClick={() => tool.setEnabled(!tool.isEnabled)}>{tool.isEnabled ? 'Mode on' : 'Mode off'}</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4, margin: '6px 0' }}>
          {tool.tools.map((t) => (
            <button key={t.id} title={`${t.blurb} (${t.key})`} style={b.tool === t.id ? primary : button} onClick={() => tool.setTool(t.id)}>
              <span style={{ opacity: 0.6, marginRight: 4 }}>{t.key}</span>{t.name}
            </button>
          ))}
        </div>
        <p style={{ fontSize: 11, opacity: 0.75, margin: '2px 0 8px' }}>{tool.tools.find((t) => t.id === b.tool)?.blurb}</p>
        <Slider label="Radius" value={b.radius} min={10} max={6000} step={10} unit="u" onChange={(v) => tool.setBrush({ radius: v })} />
        <Slider label="Strength" value={b.strength} min={0.02} max={1} step={0.02} onChange={(v) => tool.setBrush({ strength: v })} />
        <Slider label="Hardness" value={b.hardness} min={0} max={1} step={0.05} onChange={(v) => tool.setBrush({ hardness: v })} />
        {(b.tool === 'raise' || b.tool === 'lower') && (
          <div style={row}>
            <span style={label}>Direction</span>
            {(['normal', 'up', 'view'] as SculptDirection[]).map((d) => (
              <button key={d} style={b.direction === d ? primary : button} onClick={() => tool.setBrush({ direction: d })}>{d === 'normal' ? 'Surface normal' : d === 'up' ? 'World up' : 'Toward view'}</button>
            ))}
          </div>
        )}
        {b.tool === 'paint' && (
          <div style={row}>
            <span style={label}>Colour</span>
            <input type="color" value={toHex(b.color)} onChange={(e) => tool.setBrush({ color: fromHex(e.target.value) })} />
            <span style={{ opacity: 0.7 }}>Shift paints the generated colour back.</span>
          </div>
        )}
        {b.tool === 'noise' && <Slider label="Seed" value={b.seed} min={1} max={999} step={1} onChange={(v) => tool.setBrush({ seed: v })} />}
        <div style={row}>
          <label><input type="checkbox" checked={b.invert} onChange={(e) => tool.setBrush({ invert: e.target.checked })} /> Invert</label>
          <span style={{ opacity: 0.6 }}>Shift = invert · Ctrl = smooth · [ ] radius · − = strength · 1–9 tools</span>
        </div>
      </div>

      <div style={section}>
        <div style={{ ...row, justifyContent: 'space-between' }}>
          <strong>Target</strong>
          {target && <button style={button} onClick={() => tool.reset(target.id)}>Reset to generated</button>}
        </div>
        {target ? (
          <p style={{ fontSize: 12, margin: 0 }}>
            <b>{target.name}</b> · {target.meshes} mesh{target.meshes === 1 ? '' : 'es'} · {target.vertices.toLocaleString()} vertices · {target.changed.toLocaleString()} moved · {target.bytes.toLocaleString()} bytes
          </p>
        ) : <p style={{ fontSize: 12, opacity: 0.7, margin: 0 }}>Drag on the terrain, a cliff, a cave wall or a placed model. The road surface is locked.</p>}
        {tool.status && <p style={{ fontSize: 11, opacity: 0.8, margin: '6px 0 0' }}>{tool.status}</p>}
      </div>

      <div style={section}>
        <div style={{ ...row, justifyContent: 'space-between' }}><strong>Sculpted on this course</strong><span style={{ opacity: 0.7 }}>{sculpted.length}</span></div>
        {sculpted.length === 0 && <p style={{ fontSize: 12, opacity: 0.7, margin: 0 }}>Nothing yet.</p>}
        {sculpted.map((s) => (
          <div key={s.id} style={{ ...row, justifyContent: 'space-between' }}>
            <span>{s.name} <span style={{ opacity: 0.6 }}>· {s.changed.toLocaleString()} moved · {(s.bytes / 1024).toFixed(1)} KB</span></span>
            <button style={button} onClick={() => tool.reset(s.id)}>Reset</button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default SculptPanel;
