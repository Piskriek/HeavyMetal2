/**
 * NewSculpt — the Sculpt & Mesh Paint panel for the Forge 3D track builder.
 *
 * A mode toggle, the nine tools (with their digit hotkeys), radius / strength / hardness, the push
 * direction for Raise & Lower, textured Island Surface palette or flat colour for Paint, a seed for
 * Noise, what you last touched (with a Reset), and the list of everything on the course that carries
 * a sculpt or model paint. Every stroke is one undo step in the builder (Ctrl+Z as usual).
 *
 * Mount it as a builder tab: <SculptPanel tool={builder.sculpt!} />
 */
import { useEffect, useState, type CSSProperties } from 'react';
import type { SculptTool } from '../game/sculpt/sculpt-tool';
import type { SculptDirection } from '../game/sculpt/sculpt-brushes';
import { ISLAND_SURFACES, IslandSurfaceArray } from '../game/island-route/island-surfaces';
import { surfaceDefinition } from '../game/surface/surface-table';

const row: CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, margin: '4px 0' };
const label: CSSProperties = { width: 96, opacity: 0.8 };
const button: CSSProperties = { padding: '5px 9px', borderRadius: 5, border: '1px solid #7a5a2a', background: '#2a1e12', color: '#f5e6c8', cursor: 'pointer', fontSize: 12 };
const primary: CSSProperties = { ...button, background: '#e0862c', color: '#1a120a', fontWeight: 600 };
const section: CSSProperties = { border: '1px solid #4a3a26', borderRadius: 8, padding: 10, marginBottom: 10, background: 'rgba(18,13,9,0.7)' };

function Slider(props: { label: string; value: number; min: number; max: number; step: number; unit?: string; onChange: (v: number) => void }) {
  return (
    <div style={row}>
      <span style={label}>{props.label}</span>
      <input type="range" min={props.min} max={props.max} step={props.step} value={props.value} onChange={(e) => props.onChange(Number(e.target.value))} style={{ flex: 1 }} className="accent-amber-500" />
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
  const surfaceArray = IslandSurfaceArray.getInstance();

  return (
    <div style={{ color: '#f5e6c8', minWidth: 300 }} className="select-none font-sans">
      <div style={section}>
        <div style={{ ...row, justifyContent: 'space-between' }}>
          <strong>Sculpt &amp; mesh paint</strong>
          <button style={tool.isEnabled ? primary : button} onClick={() => tool.setEnabled(!tool.isEnabled)}>
            {tool.isEnabled ? 'Mode on' : 'Mode off'}
          </button>
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
              <button key={d} style={b.direction === d ? primary : button} onClick={() => tool.setBrush({ direction: d })}>
                {d === 'normal' ? 'Surface normal' : d === 'up' ? 'World up' : 'Toward view'}
              </button>
            ))}
          </div>
        )}

        {b.tool === 'paint' && (
          <div className="space-y-2.5 my-2.5 pt-2 border-t border-amber-900/40">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-amber-300">Paint Mode</span>
              <div className="flex rounded border border-amber-800/60 overflow-hidden text-[11px]">
                <button
                  style={b.paintMode === 'surface' ? primary : button}
                  onClick={() => tool.setBrush({ paintMode: 'surface' })}
                  className="px-2.5 py-0.5"
                >
                  Island surface
                </button>
                <button
                  style={b.paintMode === 'color' ? primary : button}
                  onClick={() => tool.setBrush({ paintMode: 'color' })}
                  className="px-2.5 py-0.5"
                >
                  Flat colour
                </button>
              </div>
            </div>

            {b.paintMode === 'surface' ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px] text-zinc-400">
                  <span>Surface Palette (Triplanar Height Blend)</span>
                  <span className="text-amber-300 font-medium">{surfaceDefinition(b.surfaceId).name}</span>
                </div>
                <div className="grid grid-cols-4 gap-1.5 max-h-48 overflow-y-auto pr-1">
                  {ISLAND_SURFACES.map((s) => {
                    const def = surfaceDefinition(s.id);
                    const isSelected = b.surfaceId === s.id;
                    const thumb = surfaceArray.thumbs.get(s.id);
                    return (
                      <button
                        key={s.id}
                        onClick={() => tool.setBrush({ surfaceId: s.id })}
                        title={`${def.name} (ID: ${s.id})`}
                        className={`group relative flex flex-col items-center rounded border p-1 text-left transition-all ${
                          isSelected
                            ? 'border-amber-400 bg-amber-950/70 shadow-sm shadow-amber-500/20 ring-1 ring-amber-400/50'
                            : 'border-zinc-800 bg-zinc-900/90 hover:border-amber-600/60 hover:bg-zinc-850'
                        }`}
                      >
                        <div
                          className="h-10 w-full rounded border border-zinc-700/50 bg-cover bg-center"
                          style={{
                            backgroundColor: def.swatch,
                            backgroundImage: thumb ? `url(${thumb})` : undefined,
                          }}
                        />
                        <span className="mt-1 w-full truncate text-center text-[10px] font-medium leading-tight text-zinc-300 group-hover:text-amber-200">
                          {def.name.replace(/^(Packed|Wet|Old|Riveted|Resonant|Granite|Mossy|Dry|Rippled)\s+/i, '')}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <p className="text-[10px] text-zinc-400 leading-tight">
                  <span className="text-amber-300 font-semibold">Tip:</span> Hold <kbd className="px-1 py-0.5 bg-zinc-800 rounded border border-zinc-700 text-zinc-200">Shift</kbd> to erase back to the original base model texture.
                </p>
              </div>
            ) : (
              <div style={row}>
                <span style={label}>Colour</span>
                <input type="color" value={toHex(b.color)} onChange={(e) => tool.setBrush({ color: fromHex(e.target.value) })} className="h-7 w-12 cursor-pointer rounded border border-zinc-700 bg-transparent" />
                <span style={{ opacity: 0.7, fontSize: 11 }}>Shift paints the generated colour back.</span>
              </div>
            )}
          </div>
        )}

        {b.tool === 'noise' && <Slider label="Seed" value={b.seed} min={1} max={999} step={1} onChange={(v) => tool.setBrush({ seed: v })} />}
        
        <div style={row}>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={b.invert} onChange={(e) => tool.setBrush({ invert: e.target.checked })} className="accent-amber-500 rounded" /> Invert (Erase)
          </label>
          <span style={{ opacity: 0.6, fontSize: 10, marginLeft: 'auto' }}>Shift = invert · Ctrl = smooth · [ ] radius</span>
        </div>
      </div>

      <div style={section}>
        <div style={{ ...row, justifyContent: 'space-between' }}>
          <strong>Target</strong>
          {target && <button style={button} onClick={() => tool.reset(target.id)}>Reset to generated</button>}
        </div>
        {target ? (
          <p style={{ fontSize: 12, margin: 0 }}>
            <b>{target.name}</b> · {target.meshes} mesh{target.meshes === 1 ? '' : 'es'} · {target.vertices.toLocaleString()} vertices · {target.changed.toLocaleString()} modified · {target.bytes.toLocaleString()} bytes
          </p>
        ) : (
          <p style={{ fontSize: 12, opacity: 0.7, margin: 0 }}>
            Drag on a rock, cliff, ruin or island terrain. The road surface is locked.
          </p>
        )}
        {tool.status && <p style={{ fontSize: 11, opacity: 0.8, margin: '6px 0 0', color: '#ffb86c' }}>{tool.status}</p>}
      </div>

      <div style={section}>
        <div style={{ ...row, justifyContent: 'space-between' }}>
          <strong>Sculpted &amp; painted models</strong>
          <span style={{ opacity: 0.7, fontSize: 11 }}>{sculpted.length}</span>
        </div>
        {sculpted.length === 0 && <p style={{ fontSize: 12, opacity: 0.7, margin: 0 }}>Nothing yet.</p>}
        {sculpted.map((s) => (
          <div key={s.id} style={{ ...row, justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 4 }}>
            <span className="truncate max-w-[200px]" title={s.name}>
              {s.name} <span style={{ opacity: 0.6, fontSize: 10 }}>· {s.changed.toLocaleString()} modified · {(s.bytes / 1024).toFixed(1)} KB</span>
            </span>
            <button style={button} onClick={() => tool.reset(s.id)}>Reset</button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default SculptPanel;
