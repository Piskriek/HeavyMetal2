/**
 * Inspector for the island terrain (click the terrain in Primitives or Custom 3D): its tint and
 * brightness, the grain and tiny pebbles seen up close, and the dirt brush that paints light, compacted,
 * cracked dirt with a scatter of pebbles over the terrain texture.
 */
import { Eraser, Mountain, Paintbrush, RotateCcw, Trash2, Undo2, X } from 'lucide-react';
import type { TrackBuilder3D } from '../../game/track-builder-3d';
import { DEFAULT_ISLAND_GROUND, type IslandGroundSettings } from '../../game/island-route/island-ground';

export interface GroundBrush { on: boolean; erase: boolean; radius: number; strength: number }

interface Props {
  builder: TrackBuilder3D;
  brush: GroundBrush;
  onBrush: (brush: GroundBrush) => void;
  onClose: () => void;
  onRequestRender?: () => void;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid grid-cols-[96px_1fr] items-center gap-2 text-[11px] text-zinc-400"><span>{label}</span>{children}</label>;
}

export default function IslandGroundPanel({ builder, brush, onBrush, onClose, onRequestRender }: Props) {
  const ground = builder.getIslandGround();
  if (!ground) {
    return <p className="text-[11px] text-zinc-400">The island model is still loading.</p>;
  }
  const s = ground.get();
  const set = (changes: Partial<IslandGroundSettings>) => { builder.updateIslandGround(changes); onRequestRender?.(); };
  const slider = (label: string, key: keyof IslandGroundSettings, min: number, max: number, step: number, show: (v: number) => string) => (
    <Row label={`${label} ${show(s[key] as number)}`}>
      <input type="range" min={min} max={max} step={step} value={s[key] as number} onChange={(e) => set({ [key]: Number(e.target.value) })} className="accent-amber-500" />
    </Row>
  );
  const pct = (v: number) => `${Math.round(v * 100)}%`;

  return (
    <div className="flex flex-col gap-2.5 text-xs">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
        <span className="flex items-center gap-1.5 font-bold text-amber-400"><Mountain size={14} />Island ground</span>
        <button onClick={onClose} className="cursor-pointer p-0.5 text-zinc-400 hover:text-amber-200" aria-label="Close the island ground panel"><X size={14} /></button>
      </div>

      <section className="space-y-2 rounded-md border border-amber-500/30 bg-zinc-900/80 p-2">
        <div className="text-[11px] font-bold text-amber-300">Terrain</div>
        <Row label="Tint"><input type="color" value={s.tint} onChange={(e) => set({ tint: e.target.value })} className="h-6 w-full cursor-pointer rounded border border-zinc-700 bg-transparent" /></Row>
        {slider('Brightness', 'brightness', 0.3, 2, 0.01, (v) => v.toFixed(2))}
        {slider('Grain', 'grain', 0, 1, 0.01, pct)}
        {slider('Pebble size', 'pebbleSize', 3, 40, 0.5, (v) => `${v}`)}
        {slider('Pebbles', 'pebbles', 0, 1, 0.01, pct)}
        <p className="text-[10px] leading-snug text-zinc-500">Grain and pebbles show up close and fade out with distance. They never repeat.</p>
      </section>

      <section className="space-y-2 rounded-md border border-amber-500/30 bg-zinc-900/80 p-2">
        <div className="text-[11px] font-bold text-amber-300">Painted dirt</div>
        <div className="grid grid-cols-2 gap-1">
          <button onClick={() => onBrush({ ...brush, on: !(brush.on && !brush.erase), erase: false })}
            className={`flex cursor-pointer items-center justify-center gap-1 rounded border py-1 text-[11px] ${brush.on && !brush.erase ? 'border-amber-400 bg-amber-950/40 text-amber-200' : 'border-zinc-700 text-zinc-300'}`}>
            <Paintbrush size={12} />Paint dirt
          </button>
          <button onClick={() => onBrush({ ...brush, on: !(brush.on && brush.erase), erase: true })}
            className={`flex cursor-pointer items-center justify-center gap-1 rounded border py-1 text-[11px] ${brush.on && brush.erase ? 'border-red-400 bg-red-950/40 text-red-200' : 'border-zinc-700 text-zinc-300'}`}>
            <Eraser size={12} />Erase
          </button>
        </div>
        <Row label={`Brush size ${brush.radius}`}>
          <input type="range" min={100} max={6000} step={50} value={brush.radius} onChange={(e) => onBrush({ ...brush, radius: Number(e.target.value) })} className="accent-amber-500" />
        </Row>
        <Row label={`Flow ${pct(brush.strength)}`}>
          <input type="range" min={0.05} max={1} step={0.05} value={brush.strength} onChange={(e) => onBrush({ ...brush, strength: Number(e.target.value) })} className="accent-amber-500" />
        </Row>
        <Row label="Dirt colour"><input type="color" value={s.sandColor} onChange={(e) => set({ sandColor: e.target.value })} className="h-6 w-full cursor-pointer rounded border border-zinc-700 bg-transparent" /></Row>
        {slider('Scale', 'sandScale', 0.25, 4, 0.05, (v) => `${v.toFixed(2)}x`)}
        {slider('Cover', 'sandStrength', 0, 1, 0.01, pct)}
        {slider('Pebbles', 'sandPebbles', 0, 1, 0.01, pct)}
        {slider('Cracks', 'sandPits', 0, 1, 0.01, pct)}
        <div className="grid grid-cols-2 gap-1">
          <button disabled={!builder.canUndoGroundStroke()} onClick={() => { builder.undoGroundStroke(); onRequestRender?.(); }}
            className="flex cursor-pointer items-center justify-center gap-1 rounded border border-zinc-700 py-1 text-[11px] text-zinc-300 hover:border-zinc-500 disabled:cursor-default disabled:opacity-40">
            <Undo2 size={12} />Undo stroke
          </button>
          <button onClick={() => { if (window.confirm('Remove all painted dirt from this island track?')) { builder.clearGroundPaint(); onRequestRender?.(); } }}
            className="flex cursor-pointer items-center justify-center gap-1 rounded border border-zinc-700 py-1 text-[11px] text-zinc-300 hover:border-red-500">
            <Trash2 size={12} />Clear paint
          </button>
        </div>
        <p className="text-[10px] leading-snug text-zinc-500">
          {brush.on ? 'Left-drag on the terrain to paint; right-drag still moves the camera. Ctrl+Z undoes the last stroke.' : 'Pick Paint dirt, then left-drag on the terrain.'}
        </p>
      </section>

      <button onClick={() => set({ ...DEFAULT_ISLAND_GROUND, sandColor: s.sandColor })}
        className="flex cursor-pointer items-center justify-center gap-1 rounded border border-zinc-700 py-1 text-[11px] text-zinc-400 hover:border-zinc-500">
        <RotateCcw size={12} />Reset terrain settings
      </button>
      <p className="text-[10px] leading-snug text-zinc-500">Saved for this island track, in the browser and in backups/island. The paint follows world position, so it stays put on a re-exported model.</p>
    </div>
  );
}
