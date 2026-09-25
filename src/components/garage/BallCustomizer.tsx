/**
 * MP-T04 — the Ball Garage. The design sits on a lit 3D ball in the showroom: pick a base metal, a
 * pin-line colour and a cap finish, choose a decal, then click the ball to stamp it exactly where
 * you clicked. Placed decals are listed under the ball to select, resize, turn, tint, move or
 * remove. Undo/redo keeps 50 steps (a slider drag is one), a ball holds 12 decals, and a design
 * with unowned items cannot be saved until they are bought.
 */
import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Lock, Move, Redo2, Save, Trash2, Undo2 } from 'lucide-react';
import { BASE_MATERIALS, bakeBall, type RgbaImage } from '../../game/meta/sphere-decal-baker';
import {
  BASE_PRICES, DECAL_CATALOG, addDecal, decalImage, decalSources, edit, listDesigns, ownedCosmetics, redo, removeDecal, saveDesign,
  startHistory, undo, unownedItems, updateDecal, withBakeKey, type DesignFields,
} from '../../game/meta/ball-design';
import { MAX_DECALS_PER_BALL, type BaseMaterialId, type DecalTextureId, type HexColor } from '../../game/meta/interfaces';
import { ACCENT_PALETTE } from '../../game/meta/goblin-dna';
import BallShowroom, { CAP_FINISHES, type CapFinish } from './BallShowroom';

const MAP_W = 512;
type Tab = 'metal' | 'paint' | 'decals' | 'saved';
const TABS: { id: Tab; label: string }[] = [
  { id: 'metal', label: 'Metal' }, { id: 'paint', label: 'Paint' }, { id: 'decals', label: 'Decals' }, { id: 'saved', label: 'Saved' },
];
const TINTS: { color: HexColor; name: string }[] = [
  { color: '#f2e6c8' as HexColor, name: 'Bone' }, { color: '#e8c170' as HexColor, name: 'Gold' }, { color: '#1c1714' as HexColor, name: 'Soot' },
  { color: '#c0392b' as HexColor, name: 'Blood red' }, { color: '#e58a2b' as HexColor, name: 'Furnace orange' }, { color: '#9fb7c9' as HexColor, name: 'Steel blue' },
];
const decalName = (id: string) => DECAL_CATALOG.find((d) => d.id === id)?.name ?? id;
const itemName = (id: string) => (id in BASE_MATERIALS ? BASE_MATERIALS[id as BaseMaterialId].name : decalName(id));

function toDataUrl(img: RgbaImage, tint?: [number, number, number]): string {
  const canvas = document.createElement('canvas');
  canvas.width = img.width; canvas.height = img.height;
  const data = new Uint8ClampedArray(img.data);
  if (tint) for (let i = 0; i < data.length; i += 4) { data[i] = tint[0]; data[i + 1] = tint[1]; data[i + 2] = tint[2]; }
  canvas.getContext('2d')?.putImageData(new ImageData(data, img.width, img.height), 0, 0);
  return canvas.toDataURL();
}

/** Decal thumbnails and base-metal swatches, drawn once in the browser (never during SSR). */
function useArtwork() {
  const [art, setArt] = useState<{ decals: Record<string, string>; bases: Record<string, string> }>({ decals: {}, bases: {} });
  useEffect(() => {
    const decals: Record<string, string> = {};
    for (const d of DECAL_CATALOG) decals[d.id] = toDataUrl(decalImage(d.id), [240, 216, 168]);
    const bases: Record<string, string> = {};
    for (const id of Object.keys(BASE_MATERIALS) as BaseMaterialId[]) {
      bases[id] = toDataUrl(bakeBall(withBakeKey({ version: 1, base: id, accentColor: '#e58a2b' as HexColor, capFinish: 'brass', decals: [] }), decalSources(), 96).albedo);
    }
    setArt({ decals, bases });
  }, []);
  return art;
}

export default function BallCustomizer() {
  const [history, setHistory] = useState(startHistory);
  const design = history.present;
  const [tab, setTab] = useState<Tab>('decals');
  const [tool, setTool] = useState<DecalTextureId>('emblem.clockwork-gear');
  const [selected, setSelected] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);
  const [name, setName] = useState('My Bad Idea');
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
  const [saved, setSaved] = useState(() => listDesigns());
  const art = useArtwork();

  // One bake per design change (the base layer is cached, so a decal edit re-stamps decals only).
  const baked = useMemo(() => bakeBall(withBakeKey(design), decalSources(), MAP_W), [design]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(t);
  }, [toast]);

  const say = (text: string, ok = false) => setToast({ ok, text });
  const change = (next: DesignFields, coalesce: string | null = null) => setHistory((h) => edit(h, next, coalesce));
  const current = design.decals.find((d) => d.uid === selected) ?? null;
  const missing = unownedItems(design, ownedCosmetics());
  const owned = ownedCosmetics();

  const onSurface = (u: number, v: number) => {
    if (moving && current) {
      change(updateDecal(design, current.uid, { u: u as never, v: v as never }));
      setMoving(false);
      return;
    }
    const result = addDecal(design, tool, u, v);
    if (!result.ok) { say(result.reason); return; }
    change(result.design);
    setSelected(result.stamp.uid);
  };

  const cycleTool = (d: number) => {
    const i = DECAL_CATALOG.findIndex((x) => x.id === tool);
    setTool(DECAL_CATALOG[(i + d + DECAL_CATALOG.length) % DECAL_CATALOG.length].id);
  };

  const load = (config: DesignFields, label: string) => {
    setHistory(startHistory({ version: 1, base: config.base, accentColor: config.accentColor, capFinish: config.capFinish, decals: config.decals }));
    setName(label); setSelected(null); setMoving(false);
    say(`${label} is on the bench.`, true);
  };

  const hint = moving && current ? `Click the ball to move the ${decalName(current.textureId)}`
    : design.decals.length >= MAX_DECALS_PER_BALL ? 'The ball is full. Remove a decal to add another.'
    : `Click the ball to stamp: ${decalName(tool)}`;

  return (
    <div className="garage" onKeyDown={(e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); setHistory((h) => (e.shiftKey ? redo(h) : undo(h))); }
      if (e.key === 'Delete' && current && (e.target as HTMLElement).tagName !== 'INPUT') { change(removeDecal(design, current.uid)); setSelected(null); }
    }}>
      <div className="garage-grid">
        {/* ─── The showroom ─── */}
        <section className="garage-show">
          <div className="garage-stage-frame">
            <BallShowroom baked={baked} capFinish={design.capFinish} onSurface={onSurface}
              onCap={() => say('That is the cap. Decals go on the painted shell.')} label="Your ball. Drag to spin it, click to place a decal." />
            <div className="garage-stage-hint" aria-live="polite">{hint}</div>
            <div className="garage-stage-help">Drag to spin</div>
          </div>

          <div className="garage-placed">
            <div className="garage-section-title">On the ball <span>{design.decals.length} / {MAX_DECALS_PER_BALL} decals</span></div>
            {design.decals.length === 0
              ? <p className="garage-empty">No decals yet. Pick one on the right, then click the ball.</p>
              : (
                <div className="garage-chips" role="listbox" aria-label="Placed decals">
                  {design.decals.map((d, i) => (
                    <button key={d.uid} type="button" role="option" aria-selected={d.uid === selected} className="garage-chip"
                      onClick={() => { setSelected(d.uid === selected ? null : d.uid); setMoving(false); }}>
                      <span className="garage-chip-art" style={{ backgroundImage: art.decals[d.textureId] ? `url(${art.decals[d.textureId]})` : undefined }} />
                      <span>{i + 1}. {decalName(d.textureId)}</span>
                    </button>
                  ))}
                </div>
              )}
            {current && (
              <div className="garage-stamp" role="group" aria-label="Selected decal">
                {([['scale', 'Size', 0.03, 0.6, 0.01], ['rotation', 'Turn', -Math.PI, Math.PI, 0.05], ['opacity', 'Strength', 0.1, 1, 0.05]] as const).map(([key, text, min, max, step]) => (
                  <label key={key} className="garage-slider"><span>{text}</span>
                    <input type="range" min={min} max={max} step={step} value={current[key]}
                      onChange={(e) => change(updateDecal(design, current.uid, { [key]: Number(e.target.value) }), `${current.uid}:${key}`)} />
                  </label>
                ))}
                <div className="garage-tints" role="radiogroup" aria-label="Decal colour">
                  <span>Colour</span>
                  {TINTS.map((t) => (
                    <button key={t.color} type="button" role="radio" aria-checked={current.tintColor === t.color} aria-label={t.name} title={t.name}
                      className="garage-swatch" style={{ background: t.color }} onClick={() => change(updateDecal(design, current.uid, { tintColor: t.color }))} />
                  ))}
                </div>
                <div className="garage-stamp-actions">
                  <button type="button" className="fantasy-secondary" aria-pressed={moving} onClick={() => setMoving((m) => !m)}><Move size={14} />{moving ? 'Click the ball…' : 'Move'}</button>
                  <button type="button" className="fantasy-secondary" onClick={() => { change(removeDecal(design, current.uid)); setSelected(null); setMoving(false); }}><Trash2 size={14} />Remove</button>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ─── The workbench ─── */}
        <section className="garage-bench">
          <nav className="garage-tabs" role="tablist" aria-label="Garage">
            {TABS.map((t) => <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>{t.label}</button>)}
          </nav>

          {tab === 'metal' && (
            <div className="garage-cards" role="radiogroup" aria-label="Base metal">
              {(Object.keys(BASE_MATERIALS) as BaseMaterialId[]).map((id) => {
                const price = BASE_PRICES[id];
                const locked = price > 0 && !owned.has(id);
                return (
                  <button key={id} type="button" role="radio" aria-checked={design.base === id} className="garage-card" onClick={() => change({ ...design, base: id })}>
                    <span className="garage-orb" style={{ backgroundImage: art.bases[id] ? `url(${art.bases[id]})` : undefined }} />
                    <span className="garage-card-name">{BASE_MATERIALS[id].name}</span>
                    <span className={`garage-price ${locked ? 'locked' : ''}`}>{locked ? <><Lock size={10} />{price} gold</> : 'Owned'}</span>
                  </button>
                );
              })}
            </div>
          )}

          {tab === 'paint' && (
            <div className="garage-paint">
              <div className="garage-section-title">Pin-line <span>The stripe around the rolling edge</span></div>
              <div className="garage-swatches" role="radiogroup" aria-label="Pin-line colour">
                {ACCENT_PALETTE.map((color, i) => (
                  <button key={color} type="button" role="radio" aria-checked={design.accentColor === color} aria-label={`Pin-line colour ${i + 1}`}
                    className="garage-swatch big" style={{ background: color }} onClick={() => change({ ...design, accentColor: color as HexColor })} />
                ))}
              </div>
              <div className="garage-section-title">Caps <span>The bearing caps on each side</span></div>
              <div className="garage-cards caps" role="radiogroup" aria-label="Cap finish">
                {(Object.keys(CAP_FINISHES) as CapFinish[]).map((c) => (
                  <button key={c} type="button" role="radio" aria-checked={design.capFinish === c} className="garage-card" onClick={() => change({ ...design, capFinish: c })}>
                    <span className="garage-orb small" style={{ background: CAP_FINISHES[c].swatch }} />
                    <span className="garage-card-name">{CAP_FINISHES[c].name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {tab === 'decals' && (
            <>
              <div className="garage-section-title">Pick a decal <span>then click the ball</span>
                <span className="garage-cycle">
                  <button type="button" className="fantasy-secondary" aria-label="Previous decal" onClick={() => cycleTool(-1)}><ChevronLeft size={14} /></button>
                  <button type="button" className="fantasy-secondary" aria-label="Next decal" onClick={() => cycleTool(1)}><ChevronRight size={14} /></button>
                </span>
              </div>
              <div className="garage-decals" role="radiogroup" aria-label="Decal to stamp">
                {DECAL_CATALOG.map((d) => {
                  const locked = d.price > 0 && !owned.has(d.id);
                  return (
                    <button key={d.id} type="button" role="radio" aria-checked={tool === d.id} className="garage-decal" onClick={() => { setTool(d.id); setMoving(false); }}>
                      <span className={`garage-decal-art ${d.projection === 'band' ? 'band' : ''}`} style={{ backgroundImage: art.decals[d.id] ? `url(${art.decals[d.id]})` : undefined }} />
                      <span className="garage-card-name">{d.name}</span>
                      {locked && <span className="garage-price locked"><Lock size={10} />{d.price}</span>}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {tab === 'saved' && (
            saved.length === 0
              ? <p className="garage-empty">Nothing saved yet. Name your ball below and save it.</p>
              : (
                <div className="garage-cards" aria-label="Saved designs">
                  {saved.map((s) => (
                    <button key={s.name} type="button" className="garage-card" onClick={() => load(s.config, s.name)}>
                      <span className="garage-orb" style={{ backgroundImage: art.bases[s.config.base] ? `url(${art.bases[s.config.base]})` : undefined }} />
                      <span className="garage-card-name">{s.name}</span>
                      <span className="garage-price">{s.config.decals.length} decals</span>
                    </button>
                  ))}
                </div>
              )
          )}

          {missing.length > 0 && (
            <p className="garage-locked"><Lock size={12} />You can try these, but saving waits until they are bought: {missing.map((m) => `${itemName(m.id)} (${m.price} gold)`).join(', ')}. The gold shop opens with online play.</p>
          )}
        </section>
      </div>

      <div className="fantasy-dialog-actions garage-actions">
        <div className="garage-history">
          <button type="button" className="fantasy-secondary" disabled={!history.past.length} onClick={() => setHistory(undo)} title="Ctrl+Z"><Undo2 size={14} />Undo</button>
          <button type="button" className="fantasy-secondary" disabled={!history.future.length} onClick={() => setHistory(redo)} title="Ctrl+Shift+Z"><Redo2 size={14} />Redo</button>
        </div>
        {toast && <span className={`garage-toast ${toast.ok ? 'ok' : ''}`} role="status">{toast.text}</span>}
        <div className="garage-save">
          <input className="garage-name" value={name} maxLength={24} onChange={(e) => setName(e.target.value)} aria-label="Design name" />
          <button type="button" className="fantasy-primary" onClick={() => {
            if (missing.length) { say(`Buy first: ${missing.map((m) => `${itemName(m.id)} (${m.price} gold)`).join(', ')}.`); return; }
            const r = saveDesign(name, design);
            if (r.ok) { setSaved(listDesigns()); say(`${name.trim()} saved to the garage.`, true); } else say(r.reason);
          }}><Save size={15} />Save ball</button>
        </div>
      </div>
    </div>
  );
}
