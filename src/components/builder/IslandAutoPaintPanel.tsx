/**
 * Island auto paint, in the Island panel: pick a preset and the whole island is painted from its
 * shape (beaches at the waterline, grass on the gentle ground, moss in the damp creases, stone on the
 * cliffs), then tune it with a handful of plain sliders, or open the layers and change anything.
 *
 * Painting runs in a worker (`IslandGround.paintAuto`) behind the progress bar here; dragging a slider
 * repaints once it settles, and a newer request always replaces an older one.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, Dices, Sparkles, Trash2 } from 'lucide-react';
import type { IslandGround } from '../../game/island-route/island-ground';
import {
  DEFAULT_MACROS, ISLAND_PRESETS, recipeFor, type Band, type IslandLayer, type IslandMacros, type IslandPreset, type IslandRecipe,
} from '../../game/island-route/island-autopaint';
import { ISLAND_PALETTE } from '../../game/island-route/island-surfaces';
import { surfaceDefinition } from '../../game/surface/surface-table';
import IslandTexturePicker from './IslandTexturePicker';

interface Props {
  ground: IslandGround;
  onRequestRender?: () => void;
  /** Surface ID → library tile key, for the layer thumbnails' tile picker. */
  textures?: Record<string, string>;
  onSetTexture?: (surface: number, key: string | null) => Promise<void>;
  /** The look every surface shares: border softness and tile size (island ground settings). */
  look?: { blendSoft: number; tileScale: number };
  onLook?: (changes: { blendSoft?: number; tileScale?: number }) => void;
}

/** A preset's look in four tiles, from the waterline up: what its card shows. */
const STRIP_ROLES: readonly IslandLayer['role'][] = ['wet', 'base', 'dune', 'grass', 'moss', 'accent', 'rock', 'cliff'];
function stripOf(preset: IslandPreset): number[] {
  const out: number[] = [];
  for (const role of STRIP_ROLES) {
    for (const l of preset.layers) if (l.role === role && !out.includes(l.surface)) { out.push(l.surface); break; }
  }
  // Four evenly picked, keeping the shore first and the heights last.
  if (out.length <= 4) return out;
  return [out[0], out[Math.round((out.length - 1) / 3)], out[Math.round(((out.length - 1) * 2) / 3)], out[out.length - 1]];
}

const MACROS: readonly { key: keyof Omit<IslandMacros, 'seed'>; label: string; min: number; max: number; hint: string }[] = [
  { key: 'beach', label: 'Beach width', min: 0.3, max: 3, hint: 'How far the sand and shallows reach from the waterline' },
  { key: 'green', label: 'Greenery', min: 0, max: 2, hint: 'How much grass and moss, and how steep it will grow' },
  { key: 'rock', label: 'Rock on slopes', min: 0.2, max: 2, hint: 'Higher: stone starts on gentler slopes and covers more' },
  { key: 'patchy', label: 'Patchiness', min: 0, max: 2, hint: 'How broken up into patches each surface is' },
  { key: 'verge', label: 'Road verges', min: 0, max: 3, hint: 'Width of the worn sand along the road (0: none)' },
];

export default function IslandAutoPaintPanel({ ground, onRequestRender, textures = {}, onSetTexture, look, onLook }: Props) {
  const [recipe, setRecipe] = useState<IslandRecipe | null>(() => ground.getAutoRecipe());
  const [progress, setProgress] = useState<number | null>(() => ground.autoProgress);
  const [open, setOpen] = useState<string | null>(null);
  const [showLayers, setShowLayers] = useState(false);
  const [swapFor, setSwapFor] = useState<number | null>(null);
  const [thumbsReady, setThumbsReady] = useState(!!ground.surfaces?.thumbs.size);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    ground.onAutoProgress = (t) => { setProgress(t); if (t === null) onRequestRender?.(); };
    return () => { ground.onAutoProgress = null; };
  }, [ground, onRequestRender]);
  useEffect(() => {
    if (thumbsReady || !ground.surfaces) return;
    let live = true;
    void ground.surfaces.ready.then(() => { if (live) setThumbsReady(true); });
    return () => { live = false; };
  }, [ground, thumbsReady]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const thumb = (id: number) => ground.surfaces?.thumbs.get(id);
  const strips = useMemo(() => new Map(ISLAND_PRESETS.map((p) => [p.id, stripOf(p)])), []);

  /** Shows the change at once in the panel and repaints the island once the slider settles. */
  const apply = (next: IslandRecipe | null, delay = 260) => {
    setRecipe(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { timer.current = null; void ground.paintAuto(next); }, delay);
  };
  const choose = (preset: IslandPreset) => apply(recipeFor(preset.id, recipe?.macros ?? DEFAULT_MACROS), 0);
  const setMacro = (key: keyof IslandMacros, value: number) => recipe && apply({ ...recipe, macros: { ...recipe.macros, [key]: value } });
  const setLayer = (key: string, change: Partial<IslandLayer>) =>
    recipe && apply({ ...recipe, preset: recipe.preset, layers: recipe.layers.map((l) => (l.key === key ? { ...l, ...change } : l)) });

  const busy = progress !== null;
  const stats = ground.lastAuto;
  const total = stats ? Object.values(stats.coverage).reduce((a, b) => a + b, 0) : 0;
  const top = stats ? Object.entries(stats.coverage).sort((a, b) => b[1] - a[1]).slice(0, 4) : [];

  return (
    <div className="space-y-2">
      <p className="text-[10px] leading-snug text-zinc-500">
        One click paints the whole island from its shape. Your brush strokes and the road paint stay on top.
      </p>

      <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="Island look">
        {ISLAND_PRESETS.map((p) => {
          const picked = recipe?.preset === p.id;
          return (
            <button key={p.id} role="radio" aria-checked={picked} title={p.blurb} disabled={busy && !picked}
              onClick={() => choose(p)}
              className={`group cursor-pointer overflow-hidden rounded-md border text-left transition-colors disabled:cursor-default disabled:opacity-50 ${picked ? 'border-amber-400 bg-amber-950/30' : 'border-zinc-700 bg-zinc-950/60 hover:border-zinc-500'}`}>
              <span className="flex h-9 w-full">
                {(strips.get(p.id) ?? []).map((id) => (
                  <span key={id} className="h-full flex-1 bg-cover bg-center"
                    style={{ backgroundColor: surfaceDefinition(id).swatch, backgroundImage: thumbsReady && thumb(id) ? `url(${thumb(id)})` : undefined }} />
                ))}
              </span>
              <span className={`block px-1.5 py-1 text-[11px] font-semibold ${picked ? 'text-amber-200' : 'text-zinc-200'}`}>{p.name}</span>
            </button>
          );
        })}
      </div>

      {busy && (
        <div role="status" aria-live="polite" className="space-y-1">
          <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
            <div className="h-full rounded-full bg-amber-400 transition-[width] duration-150" style={{ width: `${Math.round((progress ?? 0) * 100)}%` }} />
          </div>
          <p className="text-center text-[11px] text-amber-200">Painting the island… {Math.round((progress ?? 0) * 100)}%</p>
        </div>
      )}

      {recipe && (
        <>
          <p className="text-[10px] leading-snug text-zinc-400">{ISLAND_PRESETS.find((p) => p.id === recipe.preset)?.blurb}</p>
          <div className="space-y-1.5 rounded-md border border-zinc-800 bg-zinc-950/50 p-2">
            {MACROS.map((m) => (
              <label key={m.key} title={m.hint} className="grid grid-cols-[92px_1fr_32px] items-center gap-2 text-[11px] text-zinc-400">
                <span>{m.label}</span>
                <input type="range" min={m.min} max={m.max} step={0.05} value={recipe.macros[m.key]}
                  onChange={(e) => setMacro(m.key, Number(e.target.value))} className="accent-amber-500" />
                <span className="text-right tabular-nums text-zinc-500">{recipe.macros[m.key].toFixed(1)}×</span>
              </label>
            ))}
            {look && onLook && (
              <>
                <label title="How softly surfaces fade into each other where they meet" className="grid grid-cols-[92px_1fr_32px] items-center gap-2 border-t border-zinc-800 pt-1.5 text-[11px] text-zinc-400">
                  <span>Soft edges</span>
                  <input type="range" min={0} max={1} step={0.05} value={look.blendSoft} onChange={(e) => onLook({ blendSoft: Number(e.target.value) })} className="accent-amber-500" />
                  <span className="text-right tabular-nums text-zinc-500">{Math.round(look.blendSoft * 100)}%</span>
                </label>
                <label title="The size of every surface's tile: bigger reads calmer from the air" className="grid grid-cols-[92px_1fr_32px] items-center gap-2 text-[11px] text-zinc-400">
                  <span>Tile size</span>
                  <input type="range" min={0.5} max={3} step={0.05} value={look.tileScale} onChange={(e) => onLook({ tileScale: Number(e.target.value) })} className="accent-amber-500" />
                  <span className="text-right tabular-nums text-zinc-500">{look.tileScale.toFixed(1)}×</span>
                </label>
              </>
            )}
            <div className="grid grid-cols-2 gap-1 pt-0.5">
              <button onClick={() => setMacro('seed', (recipe.macros.seed + 1 + Math.floor(Math.random() * 97)) % 100000)} disabled={busy}
                className="flex cursor-pointer items-center justify-center gap-1 rounded border border-zinc-700 py-1 text-[11px] text-zinc-300 hover:border-zinc-500 disabled:opacity-40">
                <Dices size={12} />New variation
              </button>
              <button onClick={() => apply({ ...recipe, macros: { ...DEFAULT_MACROS, seed: recipe.macros.seed } }, 0)} disabled={busy}
                className="flex cursor-pointer items-center justify-center gap-1 rounded border border-zinc-700 py-1 text-[11px] text-zinc-300 hover:border-zinc-500 disabled:opacity-40">
                <Sparkles size={12} />Reset sliders
              </button>
            </div>
          </div>

          <button onClick={() => setShowLayers((v) => !v)} aria-expanded={showLayers}
            className="flex w-full cursor-pointer items-center gap-1 text-[11px] font-semibold text-zinc-300 hover:text-amber-200">
            {showLayers ? <ChevronDown size={12} /> : <ChevronRight size={12} />}Layers ({recipe.layers.length}), bottom to top
          </button>
          {showLayers && (
            <ul className="space-y-1">
              {recipe.layers.map((l) => (
                <li key={l.key} className="rounded border border-zinc-800 bg-zinc-950/60">
                  <div className="grid grid-cols-[16px_22px_1fr_70px_16px] items-center gap-1.5 px-1.5 py-1">
                    <input type="checkbox" checked={l.on} onChange={(e) => setLayer(l.key, { on: e.target.checked })} aria-label={`Paint ${l.name}`} className="h-3.5 w-3.5 accent-amber-500" />
                    <button onClick={() => onSetTexture && setSwapFor(swapFor === l.surface ? null : l.surface)} title={onSetTexture ? `Swap the ${surfaceDefinition(l.surface).name.toLowerCase()} tile` : surfaceDefinition(l.surface).name}
                      className="h-5 w-5 cursor-pointer rounded-sm border border-transparent bg-cover bg-center hover:border-amber-400" style={{ backgroundColor: surfaceDefinition(l.surface).swatch, backgroundImage: thumb(l.surface) ? `url(${thumb(l.surface)})` : undefined }} />
                    <span className={`truncate text-[11px] ${l.on ? 'text-zinc-200' : 'text-zinc-500'}`}>{l.name}</span>
                    <input type="range" min={0} max={1} step={0.05} value={l.strength} onChange={(e) => setLayer(l.key, { strength: Number(e.target.value) })} title={`Strength ${Math.round(l.strength * 100)}%`} className="accent-amber-500" />
                    <button onClick={() => setOpen(open === l.key ? null : l.key)} aria-label={`Settings for ${l.name}`} className="cursor-pointer text-zinc-500 hover:text-amber-200">
                      {open === l.key ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    </button>
                  </div>
                  {swapFor === l.surface && onSetTexture && (
                    <div className="p-1"><IslandTexturePicker surface={l.surface} current={textures[l.surface] ?? ground.defaultTextureKeyOf(l.surface)} fallback={ground.defaultTextureKeyOf(l.surface)}
                      onPick={async (key) => { await onSetTexture(l.surface, key); onRequestRender?.(); }} onClose={() => setSwapFor(null)} /></div>
                  )}
                  {open === l.key && <LayerSettings layer={l} thumb={thumb} onChange={(c) => setLayer(l.key, c)} />}
                </li>
              ))}
            </ul>
          )}

          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] leading-snug text-zinc-500">
              {stats && total ? `${top.map(([id, n]) => `${surfaceDefinition(Number(id)).name} ${Math.round((n / total) * 100)}%`).join(', ')}. Painted in ${(stats.ms / 1000).toFixed(1)} s.` : ''}
            </p>
            <button onClick={() => { if (confirm('Take the auto paint off the island? Your brush strokes and the road paint stay.')) apply(null, 0); }} disabled={busy}
              className="flex shrink-0 cursor-pointer items-center gap-1 rounded border border-zinc-700 px-2 py-1 text-[11px] text-zinc-300 hover:border-red-500 disabled:opacity-40">
              <Trash2 size={12} />Remove
            </button>
          </div>
        </>
      )}
      {!recipe && !busy && <p className="text-[10px] text-zinc-500">Pick a look above to paint the island.</p>}
    </div>
  );
}

/** The conditions of one layer: only the ones it uses, in plain words. */
function LayerSettings({ layer, thumb, onChange }: { layer: IslandLayer; thumb: (id: number) => string | undefined; onChange: (c: Partial<IslandLayer>) => void }) {
  const bandRow = (label: string, band: Band, key: 'altitude' | 'slope' | 'shore' | 'road', min: number, max: number, step: number, unit: string) => {
    const hi = band.max >= 1e8 ? max : band.max;
    return (
      <div className="space-y-0.5">
        <div className="flex justify-between text-[10px] text-zinc-400"><span>{label}</span><span className="tabular-nums">{Math.round(band.min)}{unit} to {band.max >= 1e8 ? 'any' : `${Math.round(band.max)}${unit}`}</span></div>
        <div className="grid grid-cols-2 gap-1">
          <input type="range" min={min} max={max} step={step} value={Math.max(min, Math.min(max, band.min))} aria-label={`${label} from`}
            onChange={(e) => onChange({ [key]: { ...band, min: Math.min(Number(e.target.value), hi) } })} className="accent-amber-500" />
          <input type="range" min={min} max={max} step={step} value={Math.max(min, Math.min(max, hi))} aria-label={`${label} to`}
            onChange={(e) => { const v = Number(e.target.value); onChange({ [key]: { ...band, max: v >= max ? 1e9 : Math.max(v, band.min) } }); }} className="accent-amber-500" />
        </div>
      </div>
    );
  };
  return (
    <div className="space-y-1.5 border-t border-zinc-800 px-2 py-1.5">
      <div className="grid grid-cols-7 gap-0.5" role="radiogroup" aria-label="Surface">
        {ISLAND_PALETTE.map((id) => (
          <button key={id} role="radio" aria-checked={layer.surface === id} title={surfaceDefinition(id).name} onClick={() => onChange({ surface: id })}
            className={`h-6 cursor-pointer rounded-sm border bg-cover bg-center ${layer.surface === id ? 'border-amber-400' : 'border-transparent hover:border-zinc-500'}`}
            style={{ backgroundColor: surfaceDefinition(id).swatch, backgroundImage: thumb(id) ? `url(${thumb(id)})` : undefined }} />
        ))}
      </div>
      {layer.altitude && bandRow('Altitude (% of the peak)', layer.altitude, 'altitude', 0, 100, 1, '%')}
      {layer.slope && bandRow('Slope', layer.slope, 'slope', 0, 90, 1, '°')}
      {layer.shore && bandRow('From the waterline', layer.shore, 'shore', -3000, 6000, 50, '')}
      {layer.road && bandRow('From the road', layer.road, 'road', 0, 1500, 10, '')}
      {layer.hollow && (
        <label className="grid grid-cols-[1fr_90px] items-center gap-2 text-[10px] text-zinc-400" title="Right: prefers hollows and creases. Left: prefers ridges.">
          <span>Ridges ⟷ hollows</span>
          <input type="range" min={-1} max={1} step={0.05} value={layer.hollow.amount} onChange={(e) => onChange({ hollow: { ...layer.hollow!, amount: Number(e.target.value) } })} className="accent-amber-500" />
        </label>
      )}
      {layer.noise && (
        <>
          <label className="grid grid-cols-[1fr_90px] items-center gap-2 text-[10px] text-zinc-400" title="How much the layer breaks into patches">
            <span>Patches</span>
            <input type="range" min={0} max={1} step={0.05} value={layer.noise.amount} onChange={(e) => onChange({ noise: { ...layer.noise!, amount: Number(e.target.value) } })} className="accent-amber-500" />
          </label>
          <label className="grid grid-cols-[1fr_90px] items-center gap-2 text-[10px] text-zinc-400" title="Left: fewer, smaller patches. Right: more of it.">
            <span>Less ⟷ more</span>
            <input type="range" min={-1} max={1} step={0.05} value={layer.noise.bias} onChange={(e) => onChange({ noise: { ...layer.noise!, bias: Number(e.target.value) } })} className="accent-amber-500" />
          </label>
          <label className="grid grid-cols-[1fr_90px] items-center gap-2 text-[10px] text-zinc-400" title="Size of the patches (world units)">
            <span>Patch size {Math.round(layer.noise.scale)}</span>
            <input type="range" min={200} max={5000} step={50} value={layer.noise.scale} onChange={(e) => onChange({ noise: { ...layer.noise!, scale: Number(e.target.value) } })} className="accent-amber-500" />
          </label>
        </>
      )}
    </div>
  );
}
