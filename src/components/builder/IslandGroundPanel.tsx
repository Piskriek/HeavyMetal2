/**
 * Inspector for the island terrain (click the terrain in Primitives or Custom 3D), top to bottom in the
 * order you reach for them: island auto paint (one click paints the whole island from its shape), the
 * surface brush (the island surface set, the island's own cracked dirt, and "Island" to paint the
 * original ground back), road auto paint along the island route, then the terrain's tint, grain and
 * sun shadows.
 */
import { useEffect, useState } from 'react';
import { Eraser, Mountain, Paintbrush, Replace, Route, RotateCcw, Sparkles, Sun, Trash2, Undo2, X } from 'lucide-react';
import type { TrackBuilder3D } from '../../game/track-builder-3d';
import { DEFAULT_ISLAND_GROUND, type IslandGroundSettings } from '../../game/island-route/island-ground';
import { ISLAND_PALETTE } from '../../game/island-route/island-surfaces';
import { SURFACE_BARE, SURFACE_CRACKED, SURFACE_DARK_ROCK, SURFACE_DRY_MUD, SURFACE_DUNES, SURFACE_SAND, SURFACE_TABLE } from '../../game/surface/surface-table';
import { AutoPaintPanel } from '../AutoPaintPanel';
import IslandAutoPaintPanel from './IslandAutoPaintPanel';
import IslandTexturePicker from './IslandTexturePicker';

export interface GroundBrush { on: boolean; erase: boolean; radius: number; strength: number; surface: number }

/** What the island brush offers: the island surface set, the island's own cracked dirt, and the island itself. */
const ISLAND_SURFACES = [...ISLAND_PALETTE, SURFACE_CRACKED, SURFACE_BARE];
/** Palette labels short enough for a swatch. */
const SHORT_NAMES: Record<number, string> = {
  [SURFACE_CRACKED]: 'Dirt', 12: 'Wet sand', 14: 'Dark rock', 15: 'Planks', 16: 'Iron', 18: 'Grass', 19: 'Coral', 20: 'Granite', 21: 'Moss rock', 22: 'Dry mud', 23: 'Ripples', 24: 'Strata',
};
/** Road rules' surfaces on the island, where their own defaults (asphalt, gravel) are not offered. */
const ROAD_SURFACE_DEFAULTS = { carriageway: SURFACE_SAND, shoulders: SURFACE_DUNES, corners: SURFACE_DARK_ROCK, ruts: SURFACE_DRY_MUD, patches: SURFACE_SAND };

interface Props {
  builder: TrackBuilder3D;
  brush: GroundBrush;
  onBrush: (brush: GroundBrush) => void;
  onClose: () => void;
  onRequestRender?: () => void;
  /** Bakes the sun's shadows onto the terrain at this many texels across. */
  onBakeSun?: (res: number) => void;
  baking?: boolean;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid grid-cols-[96px_1fr] items-center gap-2 text-[11px] text-zinc-400"><span>{label}</span>{children}</label>;
}

export default function IslandGroundPanel({ builder, brush, onBrush, onClose, onRequestRender, onBakeSun, baking }: Props) {
  const [sunRes, setSunRes] = useState(1024);
  const ground = builder.getIslandGround();
  // Swatches are the tiles the terrain samples, so a button shows exactly what paints.
  const [, thumbsLoaded] = useState(0);
  useEffect(() => {
    let live = true;
    void ground?.surfaces?.ready.then(() => { if (live) thumbsLoaded((n) => n + 1); });
    return () => { live = false; };
  }, [ground]);
  const thumbs: Record<number, string | undefined> = {};
  for (const id of ISLAND_SURFACES) thumbs[id] = ground?.surfaces?.thumbs.get(id);
  /** The surface whose tile picker is open under the palette, or null. */
  const [swapFor, setSwapFor] = useState<number | null>(null);
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
  /** Puts a library tile on a surface (null: its original), saved with the ground; waits until it shows. */
  const setTexture = async (surface: number, key: string | null) => {
    const textures = { ...s.textures };
    if (key) textures[surface] = key; else delete textures[surface];
    builder.updateIslandGround({ textures });
    await ground.whenReady();
    thumbsLoaded((n) => n + 1);
    onRequestRender?.();
  };
  const swappable = (id: number) => ISLAND_PALETTE.includes(id);

  return (
    <div className="flex flex-col gap-2.5 text-xs">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
        <span className="flex items-center gap-1.5 font-bold text-amber-400"><Mountain size={14} />Island ground</span>
        <button onClick={onClose} className="cursor-pointer p-0.5 text-zinc-400 hover:text-amber-200" aria-label="Close the island ground panel"><X size={14} /></button>
      </div>

      <section className="space-y-2 rounded-md border border-amber-500/30 bg-zinc-900/80 p-2">
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-300"><Sparkles size={12} />Island auto paint</div>
        <IslandAutoPaintPanel ground={ground} onRequestRender={onRequestRender}
          textures={s.textures} onSetTexture={setTexture}
          look={{ blendSoft: s.blendSoft, tileScale: s.tileScale }} onLook={(changes) => set(changes)} />
      </section>

      <section className="space-y-2 rounded-md border border-amber-500/30 bg-zinc-900/80 p-2">
        <div className="text-[11px] font-bold text-amber-300">Paint</div>
        <div className="grid grid-cols-5 gap-1" role="radiogroup" aria-label="Surface to paint">
          {ISLAND_SURFACES.map((id) => {
            const def = SURFACE_TABLE[id];
            const picked = brush.surface === id;
            return (
              <button key={id} role="radio" aria-checked={picked} title={def.name}
                onClick={() => { if (picked && swappable(id)) setSwapFor(swapFor === id ? null : id); else { setSwapFor(null); onBrush({ ...brush, surface: id, on: true, erase: false }); } }}
                className={`flex cursor-pointer flex-col items-center gap-0.5 rounded border p-0.5 text-[9px] leading-tight ${picked ? 'border-amber-400 bg-amber-950/40 text-amber-200' : 'border-zinc-700 text-zinc-400 hover:border-zinc-500'}`}>
                <span className="block h-7 w-full rounded-sm bg-cover bg-center"
                  style={{ backgroundColor: id === SURFACE_CRACKED ? s.sandColor : def.swatch, backgroundImage: thumbs[id] ? `url(${thumbs[id]})` : undefined }} />
                <span className="w-full truncate text-center">{SHORT_NAMES[id] ?? def.name}</span>
              </button>
            );
          })}
        </div>
        {swappable(brush.surface) && swapFor !== brush.surface && (
          <button onClick={() => setSwapFor(brush.surface)}
            className="flex w-full cursor-pointer items-center justify-center gap-1 rounded border border-zinc-700 py-1 text-[11px] text-zinc-300 hover:border-zinc-500">
            <Replace size={12} />Swap the {SURFACE_TABLE[brush.surface].name.toLowerCase()} tile
          </button>
        )}
        {swapFor !== null && (
          <IslandTexturePicker surface={swapFor} current={s.textures[swapFor]}
            onPick={(key) => setTexture(swapFor, key)} onClose={() => setSwapFor(null)} />
        )}
        <div className="grid grid-cols-2 gap-1">
          <button onClick={() => onBrush({ ...brush, on: !(brush.on && !brush.erase), erase: false })}
            className={`flex cursor-pointer items-center justify-center gap-1 rounded border py-1 text-[11px] ${brush.on && !brush.erase ? 'border-amber-400 bg-amber-950/40 text-amber-200' : 'border-zinc-700 text-zinc-300'}`}>
            <Paintbrush size={12} />Paint
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
        {brush.surface === SURFACE_CRACKED && <>
          <Row label="Dirt colour"><input type="color" value={s.sandColor} onChange={(e) => set({ sandColor: e.target.value })} className="h-6 w-full cursor-pointer rounded border border-zinc-700 bg-transparent" /></Row>
          {slider('Scale', 'sandScale', 0.25, 4, 0.05, (v) => `${v.toFixed(2)}x`)}
          {slider('Cover', 'sandStrength', 0, 1, 0.01, pct)}
          {slider('Pebbles', 'sandPebbles', 0, 1, 0.01, pct)}
          {slider('Cracks', 'sandPits', 0, 1, 0.01, pct)}
        </>}
        <div className="grid grid-cols-2 gap-1">
          <button disabled={!builder.canUndoGroundStroke()} onClick={() => { builder.undoGroundStroke(); onRequestRender?.(); }}
            className="flex cursor-pointer items-center justify-center gap-1 rounded border border-zinc-700 py-1 text-[11px] text-zinc-300 hover:border-zinc-500 disabled:cursor-default disabled:opacity-40">
            <Undo2 size={12} />Undo stroke
          </button>
          <button onClick={() => { if (window.confirm('Remove all brush paint from this island track? Undo stroke brings it back.')) { builder.clearGroundPaint(); onRequestRender?.(); } }}
            className="flex cursor-pointer items-center justify-center gap-1 rounded border border-zinc-700 py-1 text-[11px] text-zinc-300 hover:border-red-500">
            <Trash2 size={12} />Clear paint
          </button>
        </div>
        <p className="text-[10px] leading-snug text-zinc-500">
          {brush.on ? 'Left-drag on the terrain to paint; right-drag still moves the camera. Ctrl+Z undoes the last stroke.' : 'Pick a surface, then left-drag on the terrain.'}
        </p>
      </section>

      <section className="space-y-2 rounded-md border border-amber-500/30 bg-zinc-900/80 p-2">
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-300"><Route size={12} />Road auto paint</div>
        <p className="text-[10px] leading-snug text-zinc-500">Dresses the island road along the route: a preset in one click, or one rule at a time. Paint lands only on ground the road runs on, never under a bridge.</p>
        <AutoPaintPanel auto={ground.autoPaint} locate={() => builder.islandRoadNearCamera()} onPainted={onRequestRender}
          surfaces={ISLAND_PALETTE} scope="island" hideRules={["stage-theme", "markings"]} surfaceDefaults={ROAD_SURFACE_DEFAULTS} />
      </section>

      <section className="space-y-2 rounded-md border border-amber-500/30 bg-zinc-900/80 p-2">
        <div className="text-[11px] font-bold text-amber-300">Terrain</div>
        <Row label="Tint"><input type="color" value={s.tint} onChange={(e) => set({ tint: e.target.value })} className="h-6 w-full cursor-pointer rounded border border-zinc-700 bg-transparent" /></Row>
        {slider('Brightness', 'brightness', 0.3, 2, 0.01, (v) => v.toFixed(2))}
        {slider('Grain', 'grain', 0, 1, 0.01, pct)}
        {slider('Pebble size', 'pebbleSize', 3, 40, 0.5, (v) => `${v}`)}
        {slider('Pebbles', 'pebbles', 0, 1, 0.01, pct)}
        {slider('Roughness', 'roughness', 0.2, 1, 0.01, (v) => v.toFixed(2))}
        {slider('Shine', 'shine', 0, 1, 0.01, pct)}
        {slider('Relief', 'bump', 0, 2, 0.01, (v) => v.toFixed(2))}
        <p className="text-[10px] leading-snug text-zinc-500">Grain and pebbles show up close and fade out with distance. They never repeat. Shine makes the pebbles glossy (cracks stay dull); Relief makes pebbles stand up and cracks cut in, so the light catches them.</p>
      </section>

      <section className="space-y-2 rounded-md border border-amber-500/30 bg-zinc-900/80 p-2">
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-300"><Sun size={12} />Sun shadows</div>
        <Row label="Detail">
          <select value={sunRes} onChange={(e) => setSunRes(Number(e.target.value))} className="w-full rounded border border-zinc-700 bg-zinc-950 px-1 py-1 text-xs text-zinc-200">
            <option value={512}>512 (quick look, ~6 s)</option>
            <option value={1024}>1024 (about 30 s)</option>
            <option value={2048}>2048 (sharpest, about 2 min)</option>
          </select>
        </Row>
        <div className="grid grid-cols-2 gap-1">
          <button disabled={baking} onClick={() => onBakeSun?.(sunRes)}
            className="flex cursor-pointer items-center justify-center gap-1 rounded border border-amber-500/60 bg-amber-950/40 py-1 text-[11px] text-amber-200 hover:border-amber-400 disabled:cursor-default disabled:opacity-40">
            <Sun size={12} />{ground.getShadow() ? 'Bake again' : 'Bake shadows'}
          </button>
          <button disabled={!ground.getShadow()} onClick={() => { builder.clearSunShadows(); onRequestRender?.(); }}
            className="flex cursor-pointer items-center justify-center gap-1 rounded border border-zinc-700 py-1 text-[11px] text-zinc-300 hover:border-red-500 disabled:cursor-default disabled:opacity-40">
            <Trash2 size={12} />Remove
          </button>
        </div>
        {slider('Darkness', 'shadowStrength', 0, 1, 0.01, pct)}
        <p className="text-[10px] leading-snug text-zinc-500">
          {ground.getShadow() ? `Baked at ${ground.getShadow()!.res} x ${ground.getShadow()!.res}. ` : 'Not baked yet. '}
          The terrain and every placed model cast shadows on the ground. Bake again after moving models.
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
