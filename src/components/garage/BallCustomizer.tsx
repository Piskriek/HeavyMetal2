/**
 * MP-T04 — the Ball Garage. Pick a base metal, an accent pin-line and a cap finish, then stamp decals
 * by clicking the flat (equirect) map of the ball: the click lands on exactly that texel. The ball
 * preview beside it rolls the same baked texture. Undo/redo keeps 50 steps (a slider drag is one),
 * a ball holds 12 decals, and a design with unowned items cannot be saved until they are bought.
 */
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { BASE_MATERIALS, bakeBall } from '../../game/meta/sphere-decal-baker';
import {
  BASE_PRICES, DECAL_CATALOG, addDecal, decalSources, edit, ownedCosmetics, redo, removeDecal, saveDesign, startHistory,
  texelUv, undo, unownedItems, updateDecal, withBakeKey,
} from '../../game/meta/ball-design';
import type { BaseMaterialId, DecalTextureId, HexColor } from '../../game/meta/interfaces';
import { ACCENT_PALETTE } from '../../game/meta/goblin-dna';

const MAP_W = 512; const MAP_H = 256;

export default function BallCustomizer() {
  const [history, setHistory] = useState(startHistory);
  const design = history.present;
  const [tool, setTool] = useState<DecalTextureId>('emblem.clockwork-gear');
  const [selected, setSelected] = useState<string | null>(null);
  const [name, setName] = useState('My Bad Idea');
  const [toast, setToast] = useState<string | null>(null);
  const mapRef = useRef<HTMLCanvasElement>(null);
  const [preview, setPreview] = useState('');

  // One bake per design change (cached base: a decal edit re-stamps decals only).
  const baked = useMemo(() => bakeBall(withBakeKey(design), decalSources(), MAP_W), [design]);
  useEffect(() => {
    const canvas = mapRef.current;
    const paint = canvas?.getContext('2d');
    if (!canvas || !paint) return;
    paint.putImageData(new ImageData(new Uint8ClampedArray(baked.albedo.data), MAP_W, MAP_H), 0, 0);
    setPreview(canvas.toDataURL());
  }, [baked]);

  const say = (text: string) => { setToast(text); window.setTimeout(() => setToast(null), 2600); };
  const change = (next: typeof design, coalesce: string | null = null) => setHistory((h) => edit(h, next, coalesce));

  const stamp = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const { u, v } = texelUv((event.clientX - rect.left) * (MAP_W / rect.width), (event.clientY - rect.top) * (MAP_H / rect.height), MAP_W, MAP_H);
    const result = addDecal(design, tool, u, v);
    if (!result.ok) { say(result.reason); return; }
    change(result.design);
    setSelected(result.stamp.uid);
  };

  const current = design.decals.find((d) => d.uid === selected) ?? null;
  const missing = unownedItems(design, ownedCosmetics());

  return (
    <div className="ball-garage" onKeyDown={(e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); setHistory((h) => (e.shiftKey ? redo(h) : undo(h))); }
    }}>
      <div className="garage-stage">
        <div className="garage-ball" style={{ backgroundImage: preview ? `url(${preview})` : undefined }} aria-label="Ball preview" role="img" />
        <canvas ref={mapRef} className="garage-map" width={MAP_W} height={MAP_H} onPointerDown={stamp} aria-label="Ball surface: click to stamp the chosen decal" />
      </div>

      <div className="garage-controls">
        <label>Base metal
          <select value={design.base} onChange={(e) => change({ ...design, base: e.target.value as BaseMaterialId })}>
            {(Object.keys(BASE_MATERIALS) as BaseMaterialId[]).map((id) => <option key={id} value={id}>{BASE_MATERIALS[id].name}{BASE_PRICES[id] ? ` (${BASE_PRICES[id]} gold)` : ''}</option>)}
          </select>
        </label>
        <div className="garage-swatches" role="group" aria-label="Accent pin-line">
          {ACCENT_PALETTE.map((color) => <button key={color} type="button" aria-label={`Accent ${color}`} aria-pressed={design.accentColor === color} style={{ background: color }} onClick={() => change({ ...design, accentColor: color as HexColor })} />)}
        </div>
        <label>Caps
          <select value={design.capFinish} onChange={(e) => change({ ...design, capFinish: e.target.value as typeof design.capFinish })}>
            {(['brass', 'gunmetal', 'copper', 'chrome'] as const).map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>

        <div className="garage-decals" role="group" aria-label="Decal to stamp">
          {DECAL_CATALOG.map((d) => <button key={d.id} type="button" aria-pressed={tool === d.id} onClick={() => setTool(d.id)}>{d.name}{d.price ? ` · ${d.price}g` : ''}</button>)}
        </div>
        <p className="garage-count">{design.decals.length} / 12 decals</p>

        {current && (
          <div className="garage-stamp" role="group" aria-label="Selected decal">
            {([['scale', 0.03, 0.6, 0.01], ['rotation', -Math.PI, Math.PI, 0.05], ['opacity', 0.1, 1, 0.05]] as const).map(([key, min, max, step]) => (
              <label key={key}>{key}<input type="range" min={min} max={max} step={step} value={current[key]}
                onChange={(e) => change(updateDecal(design, current.uid, { [key]: Number(e.target.value) }), `${current.uid}:${key}`)} /></label>
            ))}
            <button type="button" onClick={() => { change(removeDecal(design, current.uid)); setSelected(null); }}>Remove</button>
          </div>
        )}

        <div className="garage-actions">
          <button type="button" disabled={!history.past.length} onClick={() => setHistory(undo)}>Undo</button>
          <button type="button" disabled={!history.future.length} onClick={() => setHistory(redo)}>Redo</button>
          <input value={name} onChange={(e) => setName(e.target.value)} aria-label="Design name" />
          <button type="button" className="fantasy-primary" onClick={() => { const r = saveDesign(name, design); say(r.ok ? `${name} saved to the garage.` : r.reason); }}>Save</button>
        </div>
        {missing.length > 0 && <p className="garage-locked">Locked until bought: {missing.map((m) => `${m.id} (${m.price} gold)`).join(', ')}. The gold shop arrives with the meta server.</p>}
        {toast && <p className="garage-toast" role="status">{toast}</p>}
      </div>
    </div>
  );
}
