/**
 * The Shader Manager: the builder's library of ground shaders. Each shader blends three seamless
 * textures: layer 1 everywhere, layer 2 where cloud mask A says, layer 3 where cloud mask B says.
 * Every mask has its own seed (🎲 rolls a new one), size, coverage and softness; "Randomise tiling"
 * hides the repeat of the tiles. Edits show live on everything that wears the shader.
 */
import { useEffect, useMemo, useState } from 'react';
import { Copy, Dices, Paintbrush, Plus, Trash2, X } from 'lucide-react';
import type { TrackBuilder3D } from '../../game/track-builder-3d';
import {
  SHADER_TEXTURES, newShaderId, normalizeShader, textureUrl, type CloudMask, type ShaderDef, type ShaderLayer, type ShaderProjection,
} from '../../game/materials/shader-library';

interface Props {
  builder: TrackBuilder3D;
  onClose: () => void;
  onRequestRender?: () => void;
  showToast: (text: string, ms?: number) => void;
}

const PROJECTIONS: { id: ShaderProjection; label: string; hint: string }[] = [
  { id: 'planar', label: 'Ground', hint: 'Straight down: best for floors and terrain' },
  { id: 'triplanar', label: 'All sides', hint: 'From three sides: rocks, boxes, walls' },
  { id: 'uv', label: 'Model UVs', hint: "The shape's own texture coordinates" },
];

const LAYER_NAMES = ['Base (everywhere)', 'Layer 2 (cloud mask A)', 'Layer 3 (cloud mask B)'];

function Slider({ label, value, min, max, step, onChange, format }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; format?: (v: number) => string }) {
  return (
    <label className="grid grid-cols-[92px_1fr_48px] items-center gap-2 text-[11px] text-zinc-400">
      <span>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="accent-amber-500" />
      <span className="text-right font-mono text-zinc-300">{format ? format(value) : value}</span>
    </label>
  );
}

export default function ShaderManager({ builder, onClose, onRequestRender, showToast }: Props) {
  const [, setRevision] = useState(0);
  useEffect(() => builder.onChange(() => setRevision((r) => r + 1)), [builder]);
  const library = builder.getShaderLibrary();
  const [selectedId, setSelectedId] = useState<string>(() => builder.getActiveShader() ?? library[0]?.id ?? '');
  const shader = library.find((s) => s.id === selectedId) ?? library[0];
  const selection = builder.getSelectedProps().filter((p) => p.type.startsWith('prim_') || p.type === 'terrain_edit');
  const usage = useMemo(() => (shader ? builder.shaderUsage(shader.id) : 0), [builder, shader, library]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = (next: ShaderDef) => { builder.saveShader(normalizeShader(next)); onRequestRender?.(); };
  const setLayer = (i: number, change: Partial<ShaderLayer>) => {
    if (!shader) return;
    const layers = shader.layers.map((l, j) => (j === i ? { ...l, ...change } : l)) as ShaderDef['layers'];
    save({ ...shader, layers });
  };
  const setMask = (i: number, change: Partial<CloudMask>) => {
    if (!shader) return;
    const masks = shader.masks.map((m, j) => (j === i ? { ...m, ...change } : m)) as ShaderDef['masks'];
    save({ ...shader, masks });
  };
  const create = (from?: ShaderDef) => {
    const base = from ?? library[0];
    const id = newShaderId(library.map((s) => s.id));
    const next = normalizeShader({ ...base, id, name: from ? `${from.name} copy` : 'New shader' });
    builder.saveShader(next);
    setSelectedId(id);
  };
  const roll = () => Math.floor(Math.random() * 999_999);

  return (
    <div className="pointer-events-auto fixed right-3 top-16 bottom-3 z-40 flex w-[380px] max-w-[calc(100vw-24px)] flex-col overflow-hidden rounded-lg border border-amber-500/50 bg-zinc-950/95 text-zinc-200 shadow-2xl backdrop-blur-sm">
      <div className="flex items-center justify-between border-b border-amber-500/30 bg-zinc-900/90 px-3 py-2">
        <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-amber-300"><Paintbrush size={15} />Shader Manager</div>
        <button onClick={onClose} className="cursor-pointer rounded p-1 text-zinc-400 hover:text-amber-200" title="Close"><X size={15} /></button>
      </div>

      {/* The library */}
      <div className="flex max-h-44 flex-col gap-1 overflow-y-auto border-b border-zinc-800 p-2">
        {library.map((s) => (
          <button key={s.id} onClick={() => setSelectedId(s.id)}
            className={`flex cursor-pointer items-center gap-2 rounded border px-2 py-1 text-left text-xs ${s.id === shader?.id ? 'border-amber-400 bg-amber-950/30 text-amber-200' : 'border-zinc-800 bg-zinc-900/70 hover:border-zinc-600'}`}>
            <span className="flex">{s.layers.map((l, i) => <img key={i} src={textureUrl(l.texture)} alt="" className="-ml-1 block h-6 w-6 max-w-none shrink-0 rounded-sm border border-zinc-950 object-cover first:ml-0" />)}</span>
            <span className="flex-1 truncate">{s.name}</span>
            {builder.getActiveShader() === s.id && <span className="rounded bg-amber-500/20 px-1 text-[9px] font-bold text-amber-300">NEW SHAPES</span>}
            <span className="text-[10px] text-zinc-500">{builder.shaderUsage(s.id)} used</span>
          </button>
        ))}
      </div>
      <div className="flex gap-1.5 border-b border-zinc-800 p-2 text-[11px]">
        <button onClick={() => create()} className="flex flex-1 cursor-pointer items-center justify-center gap-1 rounded border border-zinc-700 bg-zinc-900 py-1 hover:border-amber-500"><Plus size={12} />New</button>
        <button onClick={() => shader && create(shader)} className="flex flex-1 cursor-pointer items-center justify-center gap-1 rounded border border-zinc-700 bg-zinc-900 py-1 hover:border-amber-500"><Copy size={12} />Duplicate</button>
        <button onClick={() => {
          if (!shader) return;
          const r = builder.deleteShader(shader.id);
          if (!r.ok) showToast(r.reason, 4000); else setSelectedId(builder.getShaderLibrary()[0]?.id ?? '');
        }} className="flex flex-1 cursor-pointer items-center justify-center gap-1 rounded border border-zinc-700 bg-zinc-900 py-1 hover:border-red-500"><Trash2 size={12} />Delete</button>
      </div>

      {shader && (
        <div className="flex-1 space-y-3 overflow-y-auto p-3">
          <input value={shader.name} onChange={(e) => save({ ...shader, name: e.target.value })} aria-label="Shader name"
            className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm font-bold text-amber-200 outline-none focus:border-amber-500" />

          {shader.layers.map((layer, i) => (
            <div key={i} className="space-y-1.5 rounded border border-zinc-800 bg-zinc-900/60 p-2">
              <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wide text-zinc-300">
                <span>{LAYER_NAMES[i]}</span>
                <input type="color" value={layer.tint} onChange={(e) => setLayer(i, { tint: e.target.value })} title="Tint" className="h-5 w-8 cursor-pointer rounded border border-zinc-700 bg-transparent" />
              </div>
              <div className="flex flex-wrap gap-1">
                {SHADER_TEXTURES.map((t) => (
                  <button key={t.id} onClick={() => setLayer(i, { texture: t.id })} title={t.name}
                    className={`h-8 w-8 shrink-0 cursor-pointer overflow-hidden rounded border-2 !p-0 ${layer.texture === t.id ? 'border-amber-400' : 'border-transparent opacity-70 hover:opacity-100'}`}>
                    <img src={t.url} alt={t.name} className="block h-full w-full max-w-none object-cover" />
                  </button>
                ))}
              </div>
              <Slider label="Tile size" value={layer.tile} min={100} max={4000} step={50} onChange={(v) => setLayer(i, { tile: v })} />
              {i > 0 && (() => {
                const m = shader.masks[i - 1];
                return (
                  <div className="space-y-1.5 border-t border-zinc-800 pt-1.5">
                    <div className="flex items-center justify-between text-[10px] uppercase tracking-wide text-zinc-500">
                      <span>Cloud mask {i === 1 ? 'A' : 'B'} · seed {m.seed}</span>
                      <button onClick={() => setMask(i - 1, { seed: roll() })} title="New random clouds"
                        className="flex cursor-pointer items-center gap-1 rounded border border-zinc-700 px-1.5 py-0.5 text-amber-300 hover:border-amber-500"><Dices size={12} />Re-roll</button>
                    </div>
                    <Slider label="Coverage" value={m.coverage} min={0} max={1} step={0.01} onChange={(v) => setMask(i - 1, { coverage: v })} format={(v) => `${Math.round(v * 100)}%`} />
                    <Slider label="Cloud size" value={m.size} min={200} max={12000} step={100} onChange={(v) => setMask(i - 1, { size: v })} />
                    <Slider label="Softness" value={m.softness} min={0} max={1} step={0.01} onChange={(v) => setMask(i - 1, { softness: v })} format={(v) => v.toFixed(2)} />
                    <Slider label="Detail" value={m.detail} min={1} max={6} step={1} onChange={(v) => setMask(i - 1, { detail: v })} />
                  </div>
                );
              })()}
            </div>
          ))}

          <div className="space-y-1.5 rounded border border-zinc-800 bg-zinc-900/60 p-2">
            <label className="flex cursor-pointer items-center justify-between text-xs font-bold text-zinc-200">
              <span>Randomise tiling <span className="font-normal text-zinc-500">(hides the repeat)</span></span>
              <input type="checkbox" checked={shader.randomizeTiles} onChange={(e) => save({ ...shader, randomizeTiles: e.target.checked })} className="accent-amber-500" />
            </label>
            {shader.randomizeTiles && <Slider label="Variation" value={shader.tileVariation} min={0} max={1} step={0.01} onChange={(v) => save({ ...shader, tileVariation: v })} format={(v) => v.toFixed(2)} />}
            <div className="grid grid-cols-3 gap-1 pt-1">
              {PROJECTIONS.map((p) => (
                <button key={p.id} onClick={() => save({ ...shader, projection: p.id })} title={p.hint}
                  className={`cursor-pointer rounded border py-1 text-[11px] ${shader.projection === p.id ? 'border-amber-400 bg-amber-950/40 text-amber-200' : 'border-zinc-700 text-zinc-400 hover:border-zinc-500'}`}>{p.label}</button>
              ))}
            </div>
            <Slider label="Roughness" value={shader.roughness} min={0} max={1} step={0.01} onChange={(v) => save({ ...shader, roughness: v })} format={(v) => v.toFixed(2)} />
            <Slider label="Metalness" value={shader.metalness} min={0} max={1} step={0.01} onChange={(v) => save({ ...shader, metalness: v })} format={(v) => v.toFixed(2)} />
          </div>
          <p className="text-[10px] text-zinc-500">Worn by {usage} object{usage === 1 ? '' : 's'}. Changes show on all of them at once.</p>
        </div>
      )}

      {shader && (
        <div className="grid grid-cols-2 gap-1.5 border-t border-zinc-800 p-2">
          <button disabled={!selection.length} onClick={() => {
            const n = builder.applyShaderToSelected(shader.id);
            showToast(n ? `${shader.name} on ${n} object${n === 1 ? '' : 's'}` : 'Select primitives or scenery first');
            onRequestRender?.();
          }} className="cursor-pointer rounded bg-amber-500 py-1.5 text-xs font-bold text-zinc-950 hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-40">
            Apply to selection ({selection.length})
          </button>
          <button onClick={() => {
            const on = builder.getActiveShader() === shader.id;
            builder.setActiveShader(on ? null : shader.id);
            showToast(on ? 'New shapes are placed in plain clay' : `New shapes are placed wearing ${shader.name}`);
          }} className={`cursor-pointer rounded border py-1.5 text-xs font-bold ${builder.getActiveShader() === shader.id ? 'border-amber-400 text-amber-300' : 'border-zinc-700 text-zinc-300 hover:border-zinc-500'}`}>
            {builder.getActiveShader() === shader.id ? '✓ Used for new shapes' : 'Use for new shapes'}
          </button>
        </div>
      )}
    </div>
  );
}
