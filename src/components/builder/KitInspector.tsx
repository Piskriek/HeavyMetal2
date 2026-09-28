/**
 * Inspector section for the scene kit's props: a light's colour, brightness, reach and cone; the
 * shader a primitive or scenery part wears; and a scenery part's hide / reset controls.
 */
import { Eye, EyeOff, Lightbulb, Paintbrush, RotateCcw } from 'lucide-react';
import type { PlacedProp, TrackBuilder3D } from '../../game/track-builder-3d';
import { lightSettingsFor } from '../../game/builder/light-rig';
import { POINT_SLOTS, SPOT_SLOTS } from '../../game/builder/light-rig';

interface Props {
  builder: TrackBuilder3D;
  prop: PlacedProp;
  onRequestRender?: () => void;
  showToast: (text: string, ms?: number) => void;
  onOpenShaders: () => void;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid grid-cols-[80px_1fr] items-center gap-2 text-[11px] text-zinc-400"><span>{label}</span>{children}</label>;
}

export default function KitInspector({ builder, prop, onRequestRender, showToast, onOpenShaders }: Props) {
  const isLight = prop.type.startsWith('light_');
  const isPrim = prop.type.startsWith('prim_');
  const isTerrain = prop.type === 'terrain_edit';
  if (!isLight && !isPrim && !isTerrain) return null;

  if (isLight) {
    const s = lightSettingsFor(prop);
    const set = (changes: Record<string, unknown>) => { builder.updateSelectedLights(changes); onRequestRender?.(); };
    const stats = builder.lightStats();
    return (
      <div className="space-y-2 rounded-md border border-amber-500/30 bg-zinc-900/80 p-2">
        <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300"><Lightbulb size={13} />Light</div>
        <div className="grid grid-cols-2 gap-1">
          {(['point', 'spot'] as const).map((k) => (
            <button key={k} onClick={() => set({ kind: k })}
              className={`cursor-pointer rounded border py-1 text-[11px] ${s.kind === k ? 'border-amber-400 bg-amber-950/40 text-amber-200' : 'border-zinc-700 text-zinc-400'}`}>
              {k === 'point' ? 'Glow (all round)' : 'Spot (cone)'}
            </button>
          ))}
        </div>
        <Row label="Colour"><input type="color" value={s.color} onChange={(e) => set({ color: e.target.value })} className="h-6 w-full cursor-pointer rounded border border-zinc-700 bg-transparent" /></Row>
        <Row label={`Brightness ${s.brightness.toFixed(1)}`}><input type="range" min={0} max={12} step={0.1} value={s.brightness} onChange={(e) => set({ brightness: Number(e.target.value) })} className="accent-amber-500" /></Row>
        <Row label={`Reach ${Math.round(s.reach)}`}><input type="range" min={200} max={8000} step={50} value={s.reach} onChange={(e) => set({ reach: Number(e.target.value) })} className="accent-amber-500" /></Row>
        {s.kind === 'spot' && (
          <>
            <Row label={`Cone ${Math.round(s.angle)}°`}><input type="range" min={5} max={80} step={1} value={s.angle} onChange={(e) => set({ angle: Number(e.target.value) })} className="accent-amber-500" /></Row>
            <Row label={`Soft edge ${s.softness.toFixed(2)}`}><input type="range" min={0} max={1} step={0.01} value={s.softness} onChange={(e) => set({ softness: Number(e.target.value) })} className="accent-amber-500" /></Row>
            <Row label={`Tilt ${Math.round(((prop.rotX ?? 0) * 180) / Math.PI)}°`}>
              <input type="range" min={-90} max={90} step={1} value={Math.round(((prop.rotX ?? 0) * 180) / Math.PI)}
                onChange={(e) => { builder.updatePropTransform(prop.id, { rotX: (Number(e.target.value) * Math.PI) / 180 }); onRequestRender?.(); }} className="accent-amber-500" />
            </Row>
          </>
        )}
        <Row label={`Flicker ${Math.round(s.flicker * 100)}%`}><input type="range" min={0} max={1} step={0.01} value={s.flicker} onChange={(e) => set({ flicker: Number(e.target.value) })} className="accent-amber-500" /></Row>
        <p className="text-[10px] leading-snug text-zinc-500">
          {stats.lit} of {stats.placed} lights shine right now. The {POINT_SLOTS} glows and {SPOT_SLOTS} spots nearest the camera light up; the rest wait their turn.
        </p>
      </div>
    );
  }

  const locked = isTerrain && !!prop.terrainLocked;
  const library = builder.getShaderLibrary();
  const current = (prop.shader as { id?: string } | undefined)?.id ?? '';

  return (
    <div className="space-y-2 rounded-md border border-amber-500/30 bg-zinc-900/80 p-2">
      {isTerrain && (
        <div className="text-[11px] leading-snug text-zinc-400">
          <b className="text-amber-200">Course scenery.</b>{' '}
          {locked ? 'This is the road: it shows the race line, so it can take a shader but not move.' : 'Move, turn or scale it with the gizmo, Del hides it. Scenery only: the race line never changes.'}
        </div>
      )}
      <Row label="Shader">
        <select value={current} onChange={(e) => { builder.applyShaderToSelected(e.target.value || null); onRequestRender?.(); }}
          className="w-full rounded border border-zinc-700 bg-zinc-950 px-1 py-1 text-xs text-zinc-200">
          <option value="">{isTerrain ? 'Original look' : 'None (plain material)'}</option>
          {library.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </Row>
      <button onClick={onOpenShaders} className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded border border-zinc-700 bg-zinc-950 py-1 text-[11px] text-amber-300 hover:border-amber-500">
        <Paintbrush size={12} />Open the Shader Manager
      </button>
      {isTerrain && !locked && (
        <div className="grid grid-cols-2 gap-1.5">
          <button onClick={() => { if (prop.terrainHidden) builder.unhideTerrainEdit(prop.id); else builder.deleteSelected(); onRequestRender?.(); }}
            className="flex cursor-pointer items-center justify-center gap-1 rounded border border-zinc-700 py-1 text-[11px] text-zinc-300 hover:border-zinc-500">
            {prop.terrainHidden ? <><Eye size={12} />Show</> : <><EyeOff size={12} />Hide [Del]</>}
          </button>
          <button onClick={() => { builder.resetTerrainEdit(prop.id); showToast('Put back as generated'); onRequestRender?.(); }}
            className="flex cursor-pointer items-center justify-center gap-1 rounded border border-zinc-700 py-1 text-[11px] text-zinc-300 hover:border-zinc-500">
            <RotateCcw size={12} />Reset part
          </button>
        </div>
      )}
      {isPrim && !current && <p className="text-[10px] text-zinc-500">Without a shader the shape uses the Shading tab&apos;s plain material.</p>}
    </div>
  );
}
