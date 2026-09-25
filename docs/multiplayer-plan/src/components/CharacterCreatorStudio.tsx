'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import GoblinSvg from './GoblinSvg';
import { layerTransform, occlusionNotes, rasterizeGoblin } from '@/hmgp2/goblin-compositor';
import {
  ACCENT_PALETTE, AVATAR_CATALOG, EMPTY_NUDGE, LEATHER_PALETTE, METAL_PALETTE, NUDGE_LAYERS, NUDGE_PARENT, NUDGE_RANGE,
  NUDGE_STEP_PX, SKIN_TONES, SPREAD_LAYERS, SPREAD_STEP_PX, decodeGoblinDna, encodeGoblinDna, generateRandomGoblin, isNudged,
} from '@/hmgp2/goblin-dna';
import type { AvatarLayerId, GoblinAvatarConfig, NudgeLayerId, NudgeState, SpreadLayerId } from '@/hmgp2/interfaces';
import { paintedById } from '@/hmgp2/painted-parts';

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
    return { past: [], present: { ...g, layers: { ...g.layers, eyewear: 5, headgear: 6, neck: 5 } }, future: [] };
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
      const layers = { ...fresh.layers };
      for (const l of locks) layers[l] = c.layers[l];
      return { ...fresh, layers, nudge: c.nudge };
    });
  }, [commit, locks]);

  const cycleItem = useCallback((d: number) => commit((c) => {
    const n = AVATAR_CATALOG[layer].length;
    return { ...c, layers: { ...c.layers, [layer]: (c.layers[layer] + d + n) % n } };
  }), [commit, layer]);

  // Selection box around the active layer (getBBox includes nudge/spread transforms).
  useLayoutEffect(() => {
    const g = stageRef.current?.querySelector<SVGGElement>(`[data-layer="${layer}"]`);
    if (!g || layer === 'background') { setBox(null); return; }
    try { const b = g.getBBox(); setBox(b.width ? { x: b.x, y: b.y, w: b.width, h: b.height } : null); } catch { setBox(null); }
  }, [config, layer, guides, focus]);

  const loadCrew = useCallback(async () => {
    const r = await fetch('/api/goblins').catch(() => null);
    if (r?.ok) setCrew(((await r.json()) as { goblins: Saved[] }).goblins);
  }, []);
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
    const r = await fetch('/api/goblins', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name, title, dna }) }).catch(() => null);
    if (!r) { setMessage({ kind: 'err', text: 'Network error' }); return; }
    const j = (await r.json()) as { error?: string };
    if (!r.ok) { setMessage({ kind: 'err', text: j.error ?? 'Save failed' }); return; }
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
  const t = layerTransform(config, layer);
  const parent = isNudgeLayer(layer) ? NUDGE_PARENT[layer] : undefined;
  const stageOptions = useMemo(() => ({ guides, focusLayer: focus ? layer : null }), [guides, focus, layer]);

  return (
    <div className="studio">
      <header className="studio-bar">
        <div><div className="text-[11px] uppercase tracking-[0.2em] text-amber-500">Character Creator · Step 2 of 3</div><div className="text-xl font-black text-amber-200">Build your goblin</div></div>
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn-ghost" onClick={undo} disabled={!past.length} title="Ctrl+Z">↶ Undo</button>
          <button className="btn-ghost" onClick={redo} disabled={!future.length} title="Ctrl+Shift+Z">↷ Redo</button>
          <button className="btn" onClick={() => randomize()} title="R — respects 🔒 locks">🎲 Randomize</button>
          <button className="btn-ghost" onClick={() => randomize(true)}>🎨 Colours only</button>
          <button className="btn-ghost" onClick={exportPng}>⤓ Export PNG 512</button>
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
                <span>{layerDef.label}{isNudgeLayer(layer) ? ' · drag to nudge' : ''}</span>
              </div>
            )}
          </div>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <label className="toggle"><input type="checkbox" checked={guides} onChange={(e) => setGuides(e.target.checked)} /> Rig guides (G)</label>
            <label className="toggle"><input type="checkbox" checked={focus} onChange={(e) => setFocus(e.target.checked)} /> Focus layer</label>
            <span className="text-stone-500">Drag a feature · Alt-drag spreads ears/eyes · 0 resets</span>
          </div>
          <div className="mt-3 grid grid-cols-3 items-end gap-3">
            <figure className="preview"><div className="rounded-full border-2 border-amber-600 overflow-hidden"><GoblinSvg config={config} size={96} /></div><figcaption>HUD badge 96</figcaption></figure>
            <figure className="preview"><div className="relative"><GoblinSvg config={config} size={48} options={{ transparentBackground: true }} className="rounded bg-red-900/60" /><span className="absolute -right-3 top-3 text-red-400">▶</span></div><figcaption>Off-screen pointer 48</figcaption></figure>
            <figure className="preview"><div className="billboard"><GoblinSvg config={config} size={72} options={{ transparentBackground: true }} /></div><figcaption>3D billboard (alpha)</figcaption></figure>
          </div>
          <div className="mt-3 rounded border border-stone-700 bg-stone-950/60 p-2">
            <div className="flex items-center justify-between gap-2">
              <code className="dna">{dna}</code>
              <button className="btn-ghost" onClick={() => { void navigator.clipboard?.writeText(dna); setMessage({ kind: 'ok', text: 'DNA copied.' }); }}>⧉ Copy</button>
            </div>
            <div className="mt-1 text-[11px] text-stone-500">DNA v{dna[4]} · {isNudged(config.nudge) ? 'nudge block attached (18 steps, checksum bound to head)' : 'no nudges — short v1-compatible form'}</div>
            <div className="mt-2 flex gap-2">
              <input value={paste} onChange={(e) => setPaste(e.target.value)} placeholder="Paste GOB-… DNA" className="field flex-1" />
              <button className="btn-ghost" onClick={() => loadDna(paste)}>⤓ Load</button>
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
                  <span className="block truncate text-[10px] text-stone-500">{pretty(item)}{item.startsWith('painted:') ? ' · PNG' : ''}</span>
                </button>
                {nudged && <span className="nudge-dot" title="Nudged" />}
                <button className="lock" aria-pressed={locks.has(l.id)} title="Lock on randomize" onClick={() => setLocks((s) => { const n = new Set(s); if (n.has(l.id)) n.delete(l.id); else n.add(l.id); return n; })}>{locks.has(l.id) ? '🔒' : '🔓'}</button>
              </div>
            );
          })}
        </nav>

        {/* ─── Inspector ─── */}
        <section className="studio-inspector">
          <div className="insp-title">{layerDef.icon} {layerDef.label} <span className="text-stone-500">· [ ] to cycle</span></div>
          <div className="item-grid" role="radiogroup" aria-label={`${layerDef.label} items`}>
            {AVATAR_CATALOG[layer].map((item, i) => {
              const p = paintedById.get(item);
              const preview: GoblinAvatarConfig = { ...config, layers: { ...config.layers, [layer]: i } };
              return (
                <button key={item} role="radio" aria-checked={config.layers[layer] === i} aria-label={pretty(item)}
                  className={`item-tile ${config.layers[layer] === i ? 'selected' : ''}`}
                  onClick={() => commit((c) => ({ ...c, layers: { ...c.layers, [layer]: i } }))}>
                  <GoblinSvg config={preview} size={84} options={{ focusLayer: layer }} />
                  <span className="item-name">{pretty(item)}</span>
                  {p && <span className="png-badge">PNG</span>}
                  {p?.skinLocked && <span className="warn-badge" title="Painted skin — ignores skin swatch">skin</span>}
                </button>
              );
            })}
          </div>

          {painted ? (
            <div className="note">🖌 Painted part (magenta-keyed PNG) · pivot ({painted.pivot.join(', ')}) → rig anchor <b>{painted.anchor}</b>. Fixed colours — tint masks planned (§9.6).</div>
          ) : layerDef.uses.length > 0 ? (
            <div className="space-y-2">
              {layerDef.uses.map((ch) => {
                const palette: readonly string[] = ch === 'skin' ? SKIN_TONES.map((s) => s.base) : ch === 'accent' ? ACCENT_PALETTE : ch === 'leather' ? LEATHER_PALETTE : METAL_PALETTE;
                const current = ch === 'skin' ? SKIN_TONES.findIndex((s) => s.id === config.skin) : config[ch];
                return (
                  <div key={ch} className="flex items-center gap-2">
                    <span className="w-16 text-xs capitalize text-stone-400">{ch}</span>
                    {palette.map((color, i) => (
                      <button key={color} aria-label={ch === 'skin' ? SKIN_TONES[i].name : `${ch} ${i + 1}`} aria-pressed={current === i}
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
            <div className="insp-title">✥ Nudge {isNudgeLayer(layer) ? layerDef.label : ''}</div>
            {isNudgeLayer(layer) && off ? (
              <div className="flex flex-wrap items-start gap-5">
                <div className="dpad" aria-label="Nudge pad">
                  <span /><button onClick={() => nudgeBy(layer, 0, -1)} disabled={off.y <= -NUDGE_RANGE} aria-label="Nudge up">▲</button><span />
                  <button onClick={() => nudgeBy(layer, -1, 0)} disabled={off.x <= -NUDGE_RANGE} aria-label="Nudge left">◀</button>
                  <button onClick={() => commit((c) => withOffset(c, layer, 0, 0))} aria-label="Reset" className="text-[10px]">RESET</button>
                  <button onClick={() => nudgeBy(layer, 1, 0)} disabled={off.x >= NUDGE_RANGE} aria-label="Nudge right">▶</button>
                  <span /><button onClick={() => nudgeBy(layer, 0, 1)} disabled={off.y >= NUDGE_RANGE} aria-label="Nudge down">▼</button><span />
                </div>
                <div className="space-y-2 text-xs">
                  <StepMeter label="Sideways" value={off.x} />
                  <StepMeter label="Up / down" value={-off.y} />
                  <div className="text-stone-500">1 step = {NUDGE_STEP_PX[layer]} px · range ±{NUDGE_RANGE} · rendered offset ({t.dx}, {t.dy}) px</div>
                  {parent && <div className="text-amber-300/80">↳ rides on <b>{parent}</b>: moves with the eyes, then applies its own nudge</div>}
                  {isSpreadLayer(layer) && (
                    <label className="block">
                      <span className="flex justify-between text-stone-300"><span>Spread (together ↔ apart)</span><b>{config.nudge?.spread[layer] ?? 0}</b></span>
                      <input type="range" min={-NUDGE_RANGE} max={NUDGE_RANGE} step={1} value={config.nudge?.spread[layer] ?? 0} className="w-full accent-amber-500"
                        onChange={(e) => commit((c) => withSpread(c, layer, Number(e.target.value)))} />
                    </label>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-xs text-stone-500">{layerDef.label} is structural and can’t be nudged. Nudgeable: {NUDGE_LAYERS.join(', ')}.</div>
            )}
            <button className="btn-ghost mt-2" disabled={!isNudged(config.nudge)} onClick={() => commit((c) => ({ ...c, nudge: EMPTY_NUDGE as NudgeState }))}>Reset all nudges</button>
          </div>

          {notes.length > 0 && <div className="note">⚠ {notes.join(' · ')}</div>}
        </section>
      </div>

      {/* ─── Name & crew ─── */}
      <footer className="studio-foot">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs text-stone-400">Name<input className="field mt-1 block" value={name} maxLength={16} onChange={(e) => setName(e.target.value)} /></label>
          <label className="text-xs text-stone-400">Title<select className="field mt-1 block" value={title} onChange={(e) => setTitle(e.target.value)}>{TITLES.map((t) => <option key={t}>{t}</option>)}</select></label>
          <button className="btn" onClick={save}>💾 Save to crew</button>
          {message && <span className={message.kind === 'ok' ? 'text-emerald-300 text-sm' : 'text-red-400 text-sm'} role="status">{message.text}</span>}
        </div>
        <div className="mt-4 text-[11px] uppercase tracking-widest text-stone-500">The crew (Postgres · saved_goblins) — click to load</div>
        <div className="crew">
          {crew.length === 0 && <div className="text-sm text-stone-500">No goblins saved yet. Be the first.</div>}
          {crew.map((g) => {
            let cfg: GoblinAvatarConfig | null = null;
            try { cfg = decodeGoblinDna(g.dna); } catch { cfg = null; }
            return cfg ? (
              <button key={g.id} className="crew-card" onClick={() => { commit(cfg!); setName(g.name); if (TITLES.includes(g.title)) setTitle(g.title); }}>
                <GoblinSvg config={cfg} size={72} />
                <span className="block truncate text-xs font-bold text-amber-200">{g.name}</span>
                <span className="block truncate text-[10px] text-stone-500">{g.title}{g.nudged ? ' · nudged' : ''}</span>
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
      <div className="flex justify-between text-stone-300"><span>{label}</span><b>{value > 0 ? `+${value}` : value}</b></div>
      <div className="meter">{Array.from({ length: NUDGE_RANGE * 2 + 1 }, (_, i) => i - NUDGE_RANGE).map((v) => <i key={v} className={v === 0 ? 'zero' : (v > 0 ? v <= value : v >= value) ? 'on' : ''} />)}</div>
    </div>
  );
}
