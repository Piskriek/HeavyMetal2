/**
 * Swap a surface's tile: every tile in the island texture library (the originals, plus whatever is in
 * src/assets/island-textures), the ones meant for this surface first. Picking one repaints that surface
 * everywhere it is used at once; the reset button goes back to the auto paint look's tile (or the shipped one).
 */
import { useState } from 'react';
import { Check, RotateCcw, X } from 'lucide-react';
import { texturesFor, type LibraryTexture } from '../../game/island-route/island-texture-library';
import { ISLAND_SURFACES } from '../../game/island-route/island-surfaces';
import { surfaceDefinition } from '../../game/surface/surface-table';

interface Props {
  surface: number;
  /** The library key the surface wears now (undefined: its original). */
  current?: string;
  /** What it wears when nothing is picked (the look's tile; undefined: its original). */
  fallback?: string;
  onPick: (key: string | null) => Promise<void> | void;
  onClose: () => void;
}

export default function IslandTexturePicker({ surface, current, fallback, onPick, onClose }: Props) {
  const { suggested, others } = texturesFor(surface);
  const [loading, setLoading] = useState<string | null>(null);
  // The surface's own shipped tile: wearing it is "no swap".
  const file = ISLAND_SURFACES.find((s) => s.id === surface)?.file;
  const ownKey = fallback ?? (file ? `original/${file}` : undefined);
  const wearing = current ?? ownKey;
  const pick = async (t: LibraryTexture | null) => {
    setLoading(t?.key ?? 'original');
    try { await onPick(!t || t.key === ownKey ? null : t.key); } finally { setLoading(null); }
  };
  const tile = (t: LibraryTexture) => {
    const on = wearing === t.key;
    return (
      <button key={t.key} title={t.name} onClick={() => void pick(t)} disabled={!!loading}
        className={`relative aspect-square cursor-pointer overflow-hidden rounded border ${on ? 'border-amber-400 ring-1 ring-amber-400' : 'border-zinc-700 hover:border-zinc-400'} disabled:cursor-wait`}>
        <img src={t.url} alt={t.name} loading="lazy" decoding="async" className="h-full w-full object-cover" />
        {on && <span className="absolute right-0.5 top-0.5 rounded-full bg-amber-400 p-0.5 text-zinc-950"><Check size={9} /></span>}
        {loading === t.key && <span className="absolute inset-0 animate-pulse bg-amber-400/30" />}
      </button>
    );
  };
  return (
    <div className="space-y-1.5 rounded-md border border-amber-500/40 bg-zinc-950 p-2" role="dialog" aria-label={`Tile for ${surfaceDefinition(surface).name}`}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-amber-200">Tile for {surfaceDefinition(surface).name}</span>
        <button onClick={onClose} aria-label="Close the tile picker" className="cursor-pointer text-zinc-500 hover:text-amber-200"><X size={12} /></button>
      </div>
      <div className="grid grid-cols-5 gap-1">{suggested.map(tile)}</div>
      {others.length > 0 && (
        <>
          <p className="pt-1 text-[10px] text-zinc-500">Every other tile</p>
          <div className="grid grid-cols-6 gap-1">{others.map(tile)}</div>
        </>
      )}
      <div className="flex items-center justify-between gap-2 pt-0.5">
        <p className="text-[10px] leading-snug text-zinc-500">New tiles: drop JPGs named like grass-meadow-01.jpg into src/assets/island-textures.</p>
        <button onClick={() => void pick(null)} disabled={!current || current === ownKey || !!loading}
          className="flex shrink-0 cursor-pointer items-center gap-1 rounded border border-zinc-700 px-2 py-0.5 text-[10px] text-zinc-300 hover:border-zinc-500 disabled:opacity-40">
          <RotateCcw size={10} />{fallback ? 'Look default' : 'Original'}
        </button>
      </div>
    </div>
  );
}
