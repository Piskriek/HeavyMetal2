

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import GoblinSvg from './GoblinSvg';
import { occlusionNotes, rasterizeGoblin } from '../../game/meta/goblin-compositor';
import {
  ACCENT_PALETTE, AVATAR_CATALOG, EMPTY_NUDGE, LEATHER_PALETTE, METAL_PALETTE, NUDGE_LAYERS, NUDGE_PARENT, NUDGE_RANGE,
  NUDGE_STEP_PX, SKIN_TONES, SPREAD_LAYERS, SPREAD_STEP_PX, decodeGoblinDna, encodeGoblinDna, generateRandomGoblin, isNudged,
} from '../../game/meta/goblin-dna';
import type { AvatarLayerId, GoblinAvatarConfig, NudgeLayerId, NudgeState, SpreadLayerId } from '../../game/meta/interfaces';
import { paintedById } from '../../game/meta/painted-parts';
import { listProfiles, saveProfile } from '../../game/meta/goblin-profiles';
import { avoidMissing, useMissingPaintedArt } from './usePaintedArt';

type Channel = 'skin' | 'accent' | 'leather' | 'metal';

const LAYERS: { id: AvatarLayerId; label: string; icon: string; uses: Channel[] }[] = [
  { id: 'background', label: 'Background', icon: '🏭', uses: ['accent'] },
  { id: 'head', label: 'Head & Skin', icon: '🟢', uses: ['skin'] },
  { id: 'ears', label: 'Ears', icon: '👂', uses: ['skin', 'metal'] },
  { id: 'eyes', label: 'Eyes', icon: '👁', uses: ['accent', 'skin'] },
  { id: 'eyewear', label: 'Eyewear', icon: '🥽', uses: ['leather', 'metal'] },
  { id: 'nose', label: 'Nose', icon: '👃', uses: ['skin', 'metal'] },
  { id: 'mouth', label: 'Mouth & Tusks', icon: '🦷', uses: ['metal'] },
  { id: 'hair', label: 'Hair', icon: '💈', uses: ['accent'] },
  { id: 'headgear', label: 'Headgear', icon: '🎩', uses: ['leather', 'metal', 'accent'] },
  { id: 'neck', label: 'Neck & Body', icon: '⛓', uses: ['leather', 'metal', 'accent'] },
  { id: 'warpaint', label: 'War Paint', icon: '🖐', uses: [] },
];

const TITLES = ['The Rookie', 'The Mechanic', 'The Daredevil', 'The Bruiser', 'The Rocket Jockey', 'The Unkillable', 'Scrap Baron', 'Soot Saint'];
const pretty = (s: string) => s.replace('painted:', '').replace(/^(eyewear|headgear|neck|mouth)-/, '').replace(/-/g, ' ');
/** Plain-language names for the colour channels a layer uses. */
const CHANNEL_LABEL: Record<Channel, string> = { skin: 'Skin', accent: 'Paint', leather: 'Leather', metal: 'Metal' };
const isNudgeLayer = (l: AvatarLayerId): l is NudgeLayerId => (NUDGE_LAYERS as readonly string[]).includes(l);
const isSpreadLayer = (l: AvatarLayerId): l is SpreadLayerId => (SPREAD_LAYERS as readonly string[]).includes(l);
const clampStep = (n: number) => Math.max(-NUDGE_RANGE, Math.min(NUDGE_RANGE, n));

function withOffset(c: GoblinAvatarConfig, layer: NudgeLayerId, x: number, y: number): GoblinAvatarConfig {
  const nudge = c.nudge ?? EMPTY_NUDGE;
  const offset = { ...nudge.offset, [layer]: { x: clampStep(x), y: clampStep(y) } };
  if (!offset[layer]!.x && !offset[layer]!.y) delete offset[layer];
  return { ...c, nudge: { ...nudge, offset } };
}
function withSpread(c: GoblinAvatarConfig, layer: SpreadLayerId, v: number): GoblinAvatarConfig {
  const nudge = c.nudge ?? EMPTY_NUDGE;
  const spread = { ...nudge.spread, [layer]: clampStep(v) };
  if (!spread[layer]) delete spread[layer];
  return { ...c, nudge: { ...nudge, spread } };
}

interface Saved { id: string; name: string; title: string; dna: string; nudged: number }

export default function CharacterCreatorStudio() {
  const [hist, setHist] = useState<{ past: GoblinAvatarConfig[]; present: GoblinAvatarConfig; future: GoblinAvatarConfig[] }>(() => {
    const g = generateRandomGoblin(20260);
    // Goggles down, grease bowler, boiler suit: drawn items, so the first look never waits on painted art.
    return { past: [], present: { ...g, layers: { ...g.layers, eyewear: 2, headgear: 4, neck: 3 } }, future: [] };
  });
  const config = hist.present;
  const past = hist.past, future = hist.future;
  /** Live update without a history entry (used while dragging; the entry is pushed on drag start). */
  const setConfig = useCallback((fn: (c: GoblinAvatarConfig) => GoblinAvatarConfig) => setHist((h) => ({ ...h, present: fn(h.present) })), []);
  const [layer, setLayer] = useState<AvatarLayerId>('eyewear');
  const [locks, setLocks] = useState<Set<AvatarLayerId>>(new Set());
  const [guides, setGuides] = useState(false);
  const [focus, setFocus] = useState(false);
  const [paste, setPaste] = useState('');
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [name, setName] = useState('Rivet-8');
  const [title, setTitle] = useState(TITLES[1]);
  const [crew, setCrew] = useState<Saved[]>([]);
  const [box, setBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ layer: NudgeLayerId; sx: number; sy: number; ox: number; oy: number; mode: 'offset' | 'spread'; os: number } | null>(null);

  const dna = useMemo(() => encodeGoblinDna(config), [config]);
  const notes = useMemo(() => occlusionNotes(config), [config]);
  const layerDef = LAYERS.find((l) => l.id === layer)!;
  const currentItem = AVATAR_CATALOG[layer][config.layers[layer]];
  const painted = paintedById.get(currentItem);
  const missingArt = useMissingPaintedArt();

  const commit = useCallback((next: GoblinAvatarConfig | ((c: GoblinAvatarConfig) => GoblinAvatarConfig)) => setHist((h) => {
    const n = typeof next === 'function' ? next(h.present) : next;
    return n === h.present ? h : { past: [...h.past.slice(-49), h.present], present: n, future: [] };
  }), []);
  const undo = useCallback(() => setHist((h) => (h.past.length ? { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future] } : h)), []);
  const redo = useCallback(() => setHist((h) => (h.future.length ? { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) } : h)), []);

  const nudgeBy = useCallback((l: AvatarLayerId, dx: number, dy: number) => {
    if (!isNudgeLayer(l)) return;
    commit((c) => { const o = c.nudge?.offset[l] ?? { x: 0, y: 0 }; return withOffset(c, l, o.x + dx, o.y + dy); });
  }, [commit]);
  const spreadBy = useCallback((l: AvatarLayerId, d: number) => {
    if (!isSpreadLayer(l)) return;
    commit((c) => withSpread(c, l, (c.nudge?.spread[l] ?? 0) + d));
  }, [commit]);

  const randomize = useCallback((colorsOnly = false) => {
    const fresh = generateRandomGoblin((Math.random() * 2 ** 31) >>> 0);
    commit((c) => {
      if (colorsOnly) return { ...c, skin: fresh.skin, accent: fresh.accent, leather: fresh.leather, metal: fresh.metal };
      const layers = { ...avoidMissing(fresh.layers, missingArt) };
      for (const l of locks) layers[l] = c.layers[l];
      return { ...fresh, layers, nudge: c.nudge };
    });
  }, [commit, locks, missingArt]);

  const cycleItem = useCallback((d: number) => commit((c) => {
    const items = AVATAR_CATALOG[layer], n = items.length;
    let i = c.layers[layer];
    for (let k = 0; k < n; k++) { i = (i + d + n) % n; if (!missingArt.has(items[i])) break; }
    return { ...c, layers: { ...c.layers, [layer]: i } };
  }), [commit, layer, missingArt]);

  // Selection box around the active layer (getBBox includes nudge/spread transforms).
  useLayoutEffect(() => {
    const g = stageRef.current?.querySelector<SVGGElement>(`[data-layer="${layer}"]`);
    if (!g || layer === 'background') { setBox(null); return; }
    try { const b = g.getBBox(); setBox(b.width ? { x: b.x, y: b.y, w: b.width, h: b.height } : null); } catch { setBox(null); }
  }, [config, layer, guides, focus]);

  // MP-T06: the crew is saved on this device until the meta server (MP-T07) exists.
  const loadCrew = useCallback(async () => { setCrew(listProfiles()); }, []);
  useEffect(() => { void loadCrew(); }, [loadCrew]);

  const onKey = (e: React.KeyboardEvent) => {
    const k = e.key;
    if ((e.ctrlKey || e.metaKey) && k.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
    if (k.startsWith('Arrow')) {
      e.preventDefault();
      if (e.shiftKey && (k === 'ArrowLeft' || k === 'ArrowRight')) { spreadBy(layer, k === 'ArrowRight' ? 1 : -1); return; }
      nudgeBy(layer, k === 'ArrowLeft' ? -1 : k === 'ArrowRight' ? 1 : 0, k === 'ArrowUp' ? -1 : k === 'ArrowDown' ? 1 : 0);
    }
    if (k === '[' || k === ']') cycleItem(k === ']' ? 1 : -1);
    if (k.toLowerCase() === 'r' && !e.ctrlKey && !e.metaKey) randomize();
    if (k.toLowerCase() === 'g') setGuides((v) => !v);
    if (k === '0') commit((c) => { if (!isNudgeLayer(layer)) return c; let n = withOffset(c, layer, 0, 0); if (isSpreadLayer(layer)) n = withSpread(n, layer, 0); return n; });
  };

  const onPointerDown = (e: React.PointerEvent) => {
    const target = (e.target as Element).closest('[data-layer]');
    const hit = target?.getAttribute('data-layer') as AvatarLayerId | null;
    let active = layer;
    if (hit && hit !== 'background' && hit !== 'head' && hit !== 'neck') { active = hit; setLayer(hit); }
    stageRef.current?.focus();
    if (!isNudgeLayer(active)) return;
    const o = config.nudge?.offset[active] ?? { x: 0, y: 0 };
    const mode = e.altKey && isSpreadLayer(active) ? 'spread' : 'offset';
    drag.current = { layer: active, sx: e.clientX, sy: e.clientY, ox: o.x, oy: o.y, mode, os: isSpreadLayer(active) ? config.nudge?.spread[active] ?? 0 : 0 };
    setHist((h) => ({ past: [...h.past.slice(-49), h.present], present: h.present, future: [] }));
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current; const el = stageRef.current;
    if (!d || !el) return;
    const scale = 256 / el.getBoundingClientRect().width;
    const px = (e.clientX - d.sx) * scale, py = (e.clientY - d.sy) * scale;
    if (d.mode === 'spread' && isSpreadLayer(d.layer)) {
      const l = d.layer;
      setConfig((c) => withSpread(c, l, d.os + Math.round(px / SPREAD_STEP_PX[l])));
    } else {
      const step = NUDGE_STEP_PX[d.layer];
      setConfig((c) => withOffset(c, d.layer, d.ox + Math.round(px / step), d.oy + Math.round(py / step)));
    }
  };
  const onPointerUp = () => { drag.current = null; };

  const save = async () => {
    const result = saveProfile({ name, title, dna, nudged: isNudged(config.nudge) ? 1 : 0 });
    if (!result.ok) { setMessage({ kind: 'err', text: result.reason }); return; }
    setMessage({ kind: 'ok', text: `${name} joined the crew.` });
    void loadCrew();
  };
  const exportPng = async () => {
    const canvas = await rasterizeGoblin(config, 512);
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `${name || 'goblin'}-${dna}.png`;
    a.click();
  };
  const loadDna = (text: string) => {
    try { commit(decodeGoblinDna(text)); setMessage({ kind: 'ok', text: 'DNA loaded.' }); }
    catch (e) { setMessage({ kind: 'err', text: `That DNA is smudged — ${(e as Error).message}` }); }
  };

  const off = isNudgeLayer(layer) ? config.nudge?.offset[layer] ?? { x: 0, y: 0 } : null;
  const parent = isNudgeLayer(layer) ? NUDGE_PARENT[layer] : undefined;
  const stageOptions = useMemo(() => ({ guides, focusLayer: focus ? layer : null }), [guides, focus, layer]);

  return (
    <div className="studio">
      <header className="studio-bar">
        <div className="studio-bar-title">Build your goblin</div>
        <div className="studio-tools">
          <button className="btn-ghost" onClick={undo} disabled={!past.length} title="Ctrl+Z">↶ Undo</button>
          <button className="btn-ghost" onClick={redo} disabled={!future.length} title="Ctrl+Shift+Z">↷ Redo</button>
          <button className="btn" onClick={() => randomize()} title="R · keeps the parts you locked">🎲 Randomize</button>
          <button className="btn-ghost" onClick={() => randomize(true)}>🎨 New colours</button>
          <button className="btn-ghost" onClick={exportPng}>⤓ Save picture</button>
        </div>
      </header>

      <div className="studio-grid">
        {/* ─── Stage ─── */}
        <section className="studio-stage">
          <div
            ref={stageRef} tabIndex={0} onKeyDown={onKey} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
            className="stage-frame" aria-label="Portrait stage. Arrow keys nudge the selected feature; Shift+Left/Right spreads paired features; [ ] cycles items."
          >
            <GoblinSvg config={config} size={400} options={stageOptions} className="pointer-events-auto" />
            {box && (
              <div className="sel-box" style={{ left: `${(box.x / 256) * 100}%`, top: `${(box.y / 256) * 100}%`, width: `${(box.w / 256) * 100}%`, height: `${(box.h / 256) * 100}%` }}>
                <span>{layerDef.label}{isNudgeLayer(layer) ? ' · drag to move' : ''}</span>
              </div>
            )}
          </div>
          <div className="stage-options">
            <label className="toggle"><input type="checkbox" checked={guides} onChange={(e) => setGuides(e.target.checked)} /> Show guides</label>
            <label className="toggle"><input type="checkbox" checked={focus} onChange={(e) => setFocus(e.target.checked)} /> Highlight this part</label>
          </div>
          <p className="stage-hint">Drag a feature to move it. Hold Alt and drag to spread the ears or eyes.</p>
          <div className="preview-row">
            <figure className="preview"><div className="preview-badge"><GoblinSvg config={config} size={72} /></div><figcaption>Race badge</figcaption></figure>
            <figure className="preview"><div className="preview-pointer"><GoblinSvg config={config} size={40} options={{ transparentBackground: true }} /><span aria-hidden>▶</span></div><figcaption>Rival marker</figcaption></figure>
            <figure className="preview"><div className="billboard"><GoblinSvg config={config} size={64} options={{ transparentBackground: true }} /></div><figcaption>On the track</figcaption></figure>
          </div>
          <div className="dna-box">
            <div className="dna-label">Goblin code <span>Share it to share this goblin</span></div>
            <div className="dna-row">
              <code className="dna">{dna}</code>
              <button className="btn-ghost" onClick={() => { void navigator.clipboard?.writeText(dna); setMessage({ kind: 'ok', text: 'Code copied.' }); }}>⧉ Copy</button>
            </div>
            <div className="dna-row">
              <input value={paste} onChange={(e) => setPaste(e.target.value)} placeholder="Paste a GOB-… code" aria-label="Paste a goblin code" className="field" />
              <button className="btn-ghost" onClick={() => loadDna(paste)} disabled={!paste.trim()}>Load</button>
            </div>
          </div>
        </section>

        {/* ─── Layer rail ─── */}
        <nav className="studio-rail" role="tablist" aria-label="Layers">
          {LAYERS.map((l) => {
            const nudged = isNudgeLayer(l.id) && (!!config.nudge?.offset[l.id] || (isSpreadLayer(l.id) && !!config.nudge?.spread[l.id]));
            const item = AVATAR_CATALOG[l.id][config.layers[l.id]];
            return (
              <div key={l.id} className={`rail-item ${l.id === layer ? 'active' : ''}`}>
                <button role="tab" aria-selected={l.id === layer} onClick={() => setLayer(l.id)} className="flex-1 text-left">
                  <span className="mr-1">{l.icon}</span>{l.label}
                  <span className="rail-sub">{pretty(item)}</span>
                </button>
                {nudged && <span className="nudge-dot" title="Nudged" />}
                <button className="lock" aria-pressed={locks.has(l.id)} aria-label={`Keep ${l.label} when randomizing`} title="Keep this part when randomizing" onClick={() => setLocks((s) => { const n = new Set(s); if (n.has(l.id)) n.delete(l.id); else n.add(l.id); return n; })}>{locks.has(l.id) ? '🔒' : '🔓'}</button>
              </div>
            );
          })}
        </nav>

        {/* ─── Inspector ─── */}
        <section className="studio-inspector">
          <div className="insp-head">
            <div className="insp-title">{layerDef.icon} {layerDef.label}</div>
            <div className="insp-cycle">
              <button className="btn-ghost" onClick={() => cycleItem(-1)} aria-label="Previous item" title="[">‹</button>
              <button className="btn-ghost" onClick={() => cycleItem(1)} aria-label="Next item" title="]">›</button>
            </div>
          </div>
          <div className="item-grid" role="radiogroup" aria-label={`${layerDef.label} items`}>
            {AVATAR_CATALOG[layer].map((item, i) => {
              const p = paintedById.get(item);
              const coming = missingArt.has(item);
              const preview: GoblinAvatarConfig = { ...config, layers: { ...config.layers, [layer]: i } };
              return (
                <button key={item} role="radio" aria-checked={config.layers[layer] === i} aria-label={coming ? `${pretty(item)} (art coming soon)` : pretty(item)}
                  className={`item-tile ${config.layers[layer] === i ? 'selected' : ''} ${coming ? 'coming' : ''}`} disabled={coming}
                  onClick={() => commit((c) => ({ ...c, layers: { ...c.layers, [layer]: i } }))}>
                  <GoblinSvg config={preview} size={84} options={{ focusLayer: layer }} />
                  <span className="item-name">{pretty(item)}</span>
                  {coming ? <span className="coming-badge">Art coming</span> : p && <span className="png-badge" title="Hand-painted">✦</span>}
                </button>
              );
            })}
          </div>

          {painted ? (
            <div className="note">{missingArt.has(currentItem) ? 'This painted part’s art is on its way. Pick another for now.' : 'Hand-painted part: its colours are fixed.'}</div>
          ) : layerDef.uses.length > 0 ? (
            <div className="swatches">
              {layerDef.uses.map((ch) => {
                const palette: readonly string[] = ch === 'skin' ? SKIN_TONES.map((s) => s.base) : ch === 'accent' ? ACCENT_PALETTE : ch === 'leather' ? LEATHER_PALETTE : METAL_PALETTE;
                const current = ch === 'skin' ? SKIN_TONES.findIndex((s) => s.id === config.skin) : config[ch];
                return (
                  <div key={ch} className="swatch-row">
                    <span className="swatch-label">{CHANNEL_LABEL[ch]}</span>
                    {palette.map((color, i) => (
                      <button key={color} aria-label={ch === 'skin' ? SKIN_TONES[i].name : `${CHANNEL_LABEL[ch]} ${i + 1}`} aria-pressed={current === i}
                        className={`swatch ${current === i ? 'on' : ''}`} style={{ background: color }}
                        onClick={() => commit((c) => (ch === 'skin' ? { ...c, skin: SKIN_TONES[i].id } : { ...c, [ch]: i }))} />
                    ))}
                  </div>
                );
              })}
            </div>
          ) : null}

          {/* ─── Nudge pad ─── */}
          <div className="nudge-panel">
            <div className="insp-title">✥ Position {isNudgeLayer(layer) ? `· ${layerDef.label}` : ''}</div>
            {isNudgeLayer(layer) && off ? (
              <div className="nudge-body">
                <div className="dpad" aria-label="Nudge pad">
                  <span /><button onClick={() => nudgeBy(layer, 0, -1)} disabled={off.y <= -NUDGE_RANGE} aria-label="Nudge up">▲</button><span />
                  <button onClick={() => nudgeBy(layer, -1, 0)} disabled={off.x <= -NUDGE_RANGE} aria-label="Nudge left">◀</button>
                  <button onClick={() => commit((c) => withOffset(c, layer, 0, 0))} aria-label="Reset" className="text-[10px]">RESET</button>
                  <button onClick={() => nudgeBy(layer, 1, 0)} disabled={off.x >= NUDGE_RANGE} aria-label="Nudge right">▶</button>
                  <span /><button onClick={() => nudgeBy(layer, 0, 1)} disabled={off.y >= NUDGE_RANGE} aria-label="Nudge down">▼</button><span />
                </div>
                <div className="nudge-meters">
                  <StepMeter label="Left / right" value={off.x} />
                  <StepMeter label="Up / down" value={-off.y} />
                  {parent && <div className="nudge-hint">Moves with the {parent} first, then by its own amount.</div>}
                  {isSpreadLayer(layer) && (
                    <label className="spread">
                      <span><span>Closer ↔ wider</span><b>{config.nudge?.spread[layer] ?? 0}</b></span>
                      <input type="range" min={-NUDGE_RANGE} max={NUDGE_RANGE} step={1} value={config.nudge?.spread[layer] ?? 0}
                        onChange={(e) => commit((c) => withSpread(c, layer, Number(e.target.value)))} />
                    </label>
                  )}
                </div>
              </div>
            ) : (
              <div className="nudge-hint">{layerDef.label} stays where it is. Pick a feature like the eyes or the ears to move it.</div>
            )}
            <button className="btn-ghost nudge-reset" disabled={!isNudged(config.nudge)} onClick={() => commit((c) => ({ ...c, nudge: EMPTY_NUDGE as NudgeState }))}>Reset all positions</button>
          </div>

          {notes.length > 0 && <div className="note">{notes.join(' ')}</div>}
        </section>
      </div>

      {/* ─── Name & crew ─── */}
      <footer className="studio-foot">
        <div className="foot-row">
          <label className="foot-field">Name<input className="field" value={name} maxLength={16} onChange={(e) => setName(e.target.value)} /></label>
          <label className="foot-field">Title<select className="field" value={title} onChange={(e) => setTitle(e.target.value)}>{TITLES.map((t) => <option key={t}>{t}</option>)}</select></label>
          <button className="btn" onClick={save}>Save to crew</button>
          <span className={`foot-msg ${message?.kind ?? ''}`} role="status">{message?.text ?? ''}</span>
        </div>
        <div className="crew-title">Your crew <span>Click a goblin to load it</span></div>
        <div className="crew">
          {crew.length === 0 && <div className="crew-empty">No goblins saved yet. Save this one to start your crew.</div>}
          {crew.map((g) => {
            let cfg: GoblinAvatarConfig | null = null;
            try { cfg = decodeGoblinDna(g.dna); } catch { cfg = null; }
            return cfg ? (
              <button key={g.id} className="crew-card" onClick={() => { commit(cfg!); setName(g.name); if (TITLES.includes(g.title)) setTitle(g.title); }}>
                <GoblinSvg config={cfg} size={72} />
                <span className="crew-name">{g.name}</span>
                <span className="crew-sub">{g.title}</span>
              </button>
            ) : null;
          })}
        </div>
      </footer>
    </div>
  );
}

function StepMeter({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="meter-head"><span>{label}</span><b>{value > 0 ? `+${value}` : value}</b></div>
      <div className="meter">{Array.from({ length: NUDGE_RANGE * 2 + 1 }, (_, i) => i - NUDGE_RANGE).map((v) => <i key={v} className={v === 0 ? 'zero' : (v > 0 ? v <= value : v >= value) ? 'on' : ''} />)}</div>
    </div>
  );
}
