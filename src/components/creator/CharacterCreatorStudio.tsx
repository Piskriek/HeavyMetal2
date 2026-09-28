import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Copy, Dices, ImageDown, Lock, LockOpen, Palette, Redo2, RotateCcw, Undo2 } from 'lucide-react';
import GoblinSvg from './GoblinSvg';
import { occlusionNotes, rasterizeGoblin } from '../../game/meta/goblin-compositor';
import {
  ACCENT_PALETTE, AVATAR_CATALOG, EMPTY_NUDGE, LEATHER_PALETTE, METAL_PALETTE, NUDGE_LAYERS, NUDGE_PARENT, NUDGE_RANGE,
  NUDGE_STEP_PX, SKIN_TONES, SPREAD_LAYERS, SPREAD_STEP_PX, decodeGoblinDna, encodeGoblinDna, generateRandomGoblin, isDuplicateItem, isNudged,
} from '../../game/meta/goblin-dna';
import type { AvatarLayerId, GoblinAvatarConfig, NudgeLayerId, NudgeState, SpreadLayerId } from '../../game/meta/interfaces';
import { drawnItem, paintedById } from '../../game/meta/painted-parts';
import { PART_MASKS } from '../../game/meta/painted-masks.generated';
import { listProfiles, saveProfile } from '../../game/meta/goblin-profiles';
import { avoidMissing, useMissingPaintedArt } from './usePaintedArt';

type Channel = 'skin' | 'accent' | 'leather' | 'metal';
type View = 'parts' | 'position' | 'crew';

const LAYERS: { id: AvatarLayerId; label: string; uses: Channel[] }[] = [
  { id: 'background', label: 'Backdrop', uses: ['accent'] },
  { id: 'head', label: 'Head', uses: ['skin'] },
  { id: 'ears', label: 'Ears', uses: ['skin', 'metal'] },
  { id: 'eyes', label: 'Eyes', uses: ['accent', 'skin'] },
  { id: 'eyewear', label: 'Eyewear', uses: ['leather', 'metal'] },
  { id: 'nose', label: 'Nose', uses: ['skin', 'metal'] },
  { id: 'mouth', label: 'Mouth', uses: ['metal'] },
  { id: 'hair', label: 'Hair', uses: ['accent'] },
  { id: 'headgear', label: 'Headgear', uses: ['leather', 'metal', 'accent'] },
  { id: 'neck', label: 'Collar', uses: ['leather', 'metal', 'accent'] },
  { id: 'warpaint', label: 'War paint', uses: [] },
];

/**
 * Where to look for a layer when its item draws nothing (a "None" item), so its thumbnail still shows
 * the right part of the face. Measured from the default rig, in the 256-unit portrait space.
 */
const LAYER_FALLBACK: Record<AvatarLayerId, [number, number, number, number]> = {
  background: [0, 0, 256, 256], head: [91, 70, 74, 148], ears: [55, 110, 147, 70], eyes: [90, 110, 79, 40],
  eyewear: [84, 104, 90, 52], nose: [102, 136, 52, 44], mouth: [91, 164, 74, 48], hair: [78, 27, 100, 60],
  headgear: [80, 20, 96, 96], neck: [70, 206, 116, 50], warpaint: [84, 140, 88, 40],
};

const TITLES = ['The Rookie', 'The Mechanic', 'The Daredevil', 'The Bruiser', 'The Rocket Jockey', 'The Unkillable', 'Scrap Baron', 'Soot Saint'];
/** An item's name as a player reads it: its painted part's name, or the catalog name made readable. */
const itemName = (layer: AvatarLayerId, item: string) => paintedById.get(drawnItem(layer, item))?.name ?? pretty(item);
/** The catalog indices the creator offers (duplicates of a painted part are hidden). */
const offered = (layer: AvatarLayerId) => AVATAR_CATALOG[layer].map((_, i) => i).filter((i) => !isDuplicateItem(layer, i));
/** The tile that shows a pick: a hidden duplicate lights up its painted twin. */
const shownIndex = (layer: AvatarLayerId, index: number) => {
  if (!isDuplicateItem(layer, index)) return index;
  return AVATAR_CATALOG[layer].indexOf(drawnItem(layer, AVATAR_CATALOG[layer][index]));
};
/** Catalog names read as words: "painted:eyewear-racing-goggles" becomes "Racing goggles". */
const pretty = (s: string) => {
  const w = s.replace('painted:', '').replace(/^(background|ears|eyes|eyewear|hair|headgear|neck|mouth|nose|warpaint|head)-/, '').replace(/-/g, ' ');
  return w.charAt(0).toUpperCase() + w.slice(1);
};
/** Plain-language names for the colour channels a part uses. */
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

/** The colour channels that change how the chosen item looks: painted parts by their tint masks. */
function channelsFor(layer: AvatarLayerId, item: string, uses: Channel[]): Channel[] {
  const p = paintedById.get(item);
  if (!p) return uses;
  if (layer === 'background') return [];
  return [...(PART_MASKS[p.id] ?? [])];
}

interface Saved { id: string; name: string; title: string; dna: string; nudged: number }

/**
 * A portrait cropped to one layer: the SVG's viewBox is pulled in around that layer's drawn bounds,
 * so a pair of goggles fills its tile instead of sitting small on a whole face.
 */
function CroppedGoblin({ config, layer, size, dim = true, transparent = false }: { config: GoblinAvatarConfig; layer: AvatarLayerId; size: number; dim?: boolean; transparent?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const options = useMemo(() => ({ focusLayer: dim ? layer : null, transparentBackground: transparent }), [dim, layer, transparent]);
  const [viewBox, setViewBox] = useState(() => cropBox(layer, LAYER_FALLBACK[layer]));
  useLayoutEffect(() => {
    // getBBox is in portrait units whatever the current viewBox, so measuring the cropped SVG is fine.
    const g = ref.current?.querySelector<SVGGElement>(`svg [data-layer="${layer}"]`);
    let r = LAYER_FALLBACK[layer];
    try { const b = g?.getBBox(); if (b && b.width > 2 && b.height > 2) r = [b.x, b.y, b.width, b.height]; } catch { /* not laid out */ }
    setViewBox(cropBox(layer, r));
  }, [config, layer, options]);
  return <GoblinSvg ref={ref} config={config} size={size} options={options} label="" viewBox={viewBox} />;
}
function cropBox(layer: AvatarLayerId, [x, y, w, h]: readonly number[]): string | undefined {
  if (layer === 'background') return undefined;
  const side = Math.round(Math.max(w, h) * 1.22 + 8);
  return `${Math.round(x + w / 2 - side / 2)} ${Math.round(y + h / 2 - side / 2)} ${side} ${side}`;
}

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
  const [view, setView] = useState<View>('parts');
  const [locks, setLocks] = useState<Set<AvatarLayerId>>(new Set());
  const [guides, setGuides] = useState(false);
  const [focus, setFocus] = useState(false);
  const [paste, setPaste] = useState('');
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string; at: number } | null>(null);
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
  const missingArt = useMissingPaintedArt();
  const channels = channelsFor(layer, drawnItem(layer, currentItem), layerDef.uses);
  const say = useCallback((kind: 'ok' | 'err', text: string) => setMessage({ kind, text, at: Date.now() }), []);

  useEffect(() => {
    if (!message || message.kind === 'err') return;
    const t = setTimeout(() => setMessage((m) => (m === message ? null : m)), 2600);
    return () => clearTimeout(t);
  }, [message]);

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
    const fresh = generateRandomGoblin((Math.random() * 2 ** 31) >>> 0, 3); // the whole catalog, painted parts included
    commit((c) => {
      if (colorsOnly) return { ...c, skin: fresh.skin, accent: fresh.accent, leather: fresh.leather, metal: fresh.metal };
      const layers = { ...avoidMissing(fresh.layers, missingArt) };
      for (const l of locks) layers[l] = c.layers[l];
      return { ...fresh, layers, nudge: c.nudge };
    });
  }, [commit, locks, missingArt]);

  const cycleItem = useCallback((d: number) => commit((c) => {
    const list = offered(layer).filter((i) => !missingArt.has(drawnItem(layer, AVATAR_CATALOG[layer][i])));
    if (!list.length) return c;
    const at = list.indexOf(shownIndex(layer, c.layers[layer]));
    const next = list[((at < 0 ? 0 : at + d) + list.length) % list.length];
    return { ...c, layers: { ...c.layers, [layer]: next } };
  }), [commit, layer, missingArt]);

  const toggleLock = (l: AvatarLayerId) => setLocks((s) => { const n = new Set(s); if (n.has(l)) n.delete(l); else n.add(l); return n; });

  // Selection outline around the chosen feature (getBBox includes nudge/spread transforms).
  useLayoutEffect(() => {
    const g = stageRef.current?.querySelector<SVGGElement>(`[data-layer="${layer}"]`);
    if (!g || layer === 'background' || view === 'crew') { setBox(null); return; }
    try { const b = g.getBBox(); setBox(b.width ? { x: b.x, y: b.y, w: b.width, h: b.height } : null); } catch { setBox(null); }
  }, [config, layer, guides, focus, view]);

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
    if (!result.ok) { say('err', result.reason); return; }
    say('ok', `${name} joined your crew.`);
    void loadCrew();
  };
  const exportPng = async () => {
    const canvas = await rasterizeGoblin(config, 512);
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `${name || 'goblin'}-${dna}.png`;
    a.click();
    say('ok', 'Picture saved.');
  };
  const loadDna = (text: string) => {
    try { commit(decodeGoblinDna(text)); setPaste(''); say('ok', 'Goblin loaded from the code.'); }
    catch (e) { say('err', `That code didn’t read: ${(e as Error).message}`); }
  };

  const off = isNudgeLayer(layer) ? config.nudge?.offset[layer] ?? { x: 0, y: 0 } : null;
  const parent = isNudgeLayer(layer) ? NUDGE_PARENT[layer] : undefined;
  const stageOptions = useMemo(() => ({ guides: guides && view === 'position', focusLayer: focus && view === 'position' ? layer : null }), [guides, focus, layer, view]);

  const partStrip = (
    <div className="part-strip" role="tablist" aria-label="Parts of your goblin">
      {LAYERS.map((l) => {
        const nudged = isNudgeLayer(l.id) && (!!config.nudge?.offset[l.id] || (isSpreadLayer(l.id) && !!config.nudge?.spread[l.id]));
        return (
          <button key={l.id} role="tab" aria-selected={l.id === layer} className="part-chip" onClick={() => setLayer(l.id)}
            title={`${l.label}: ${itemName(l.id, AVATAR_CATALOG[l.id][config.layers[l.id]])}`}>
            <span className="part-chip-art"><CroppedGoblin config={config} layer={l.id} size={46} dim={false} transparent={l.id !== 'background'} /></span>
            <span className="part-chip-name">{l.label}</span>
            {locks.has(l.id) && <Lock className="part-chip-flag" size={11} aria-label="kept" />}
            {!locks.has(l.id) && nudged && <span className="part-chip-flag moved" aria-label="moved" />}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="studio">
      <div className="studio-bench">
        {/* ─── The mirror: the goblin, its name plate, the whole-goblin tools ─── */}
        <section className="mirror-side" aria-label="Your goblin">
          <div className="mirror">
            <div
              ref={stageRef} tabIndex={0} onKeyDown={onKey} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
              className="stage-frame" aria-label="Your goblin. Drag a feature to move it. Arrow keys move the chosen feature, Shift with left or right spreads eyes and ears, and the square brackets step through its options."
            >
              <GoblinSvg config={config} size={400} options={stageOptions} />
              {box && (
                <div className="sel-box" style={{ left: `${(box.x / 256) * 100}%`, top: `${(box.y / 256) * 100}%`, width: `${(box.w / 256) * 100}%`, height: `${(box.h / 256) * 100}%` }} />
              )}
            </div>
            <div key={message?.at ?? 0} className={`mirror-note ${message ? `show ${message.kind}` : ''}`} role="status">{message?.text ?? ''}</div>
          </div>

          <div className="nameplate">
            <span className="plate-rivet" aria-hidden /><span className="plate-rivet" aria-hidden />
            <input className="plate-name" value={name} maxLength={16} onChange={(e) => setName(e.target.value)} aria-label="Goblin name" spellCheck={false} />
            <div className="plate-sub">
              <select className="plate-title" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Title">{TITLES.map((t) => <option key={t}>{t}</option>)}</select>
            </div>
          </div>

          <div className="bench-tools">
            <button className="tool icon" onClick={undo} disabled={!past.length} aria-label="Undo" title="Undo (Ctrl+Z)"><Undo2 size={16} /></button>
            <button className="tool icon" onClick={redo} disabled={!future.length} aria-label="Redo" title="Redo (Ctrl+Shift+Z)"><Redo2 size={16} /></button>
            <button className="tool" onClick={() => randomize()} title="New random goblin (R). Kept parts stay."><Dices size={16} aria-hidden />Roll</button>
            <button className="tool" onClick={() => randomize(true)} title="New random colours, same parts"><Palette size={16} aria-hidden />Recolour</button>
            <button className="tool icon" onClick={exportPng} aria-label="Save picture" title="Save a picture of this goblin"><ImageDown size={16} /></button>
          </div>
        </section>

        {/* ─── The bench: one job at a time ─── */}
        <section className="bench-side">
          <div className="bench-views" role="tablist" aria-label="What to work on">
            {([['parts', 'Choose parts'], ['position', 'Fine-tune'], ['crew', `Your crew${crew.length ? ` (${crew.length})` : ''}`]] as const).map(([id, label]) => (
              <button key={id} role="tab" aria-selected={view === id} className="bench-view" onClick={() => setView(id)}>{label}</button>
            ))}
            <button className="fantasy-primary tool-save" onClick={save}><Check size={16} aria-hidden />Save to crew</button>
          </div>

          {view === 'parts' && (
            <div className="bench-panel">
              {partStrip}
              <div className="tray-head">
                <h3>{layerDef.label}<span>{itemName(layer, currentItem)}</span></h3>
                <div className="tray-tools">
                  <button className="tool small" aria-pressed={locks.has(layer)} onClick={() => toggleLock(layer)} title="Keep this part when you roll a new goblin">
                    {locks.has(layer) ? <Lock size={13} aria-hidden /> : <LockOpen size={13} aria-hidden />}{locks.has(layer) ? 'Kept' : 'Keep'}
                  </button>
                  <button className="tool icon small" onClick={() => cycleItem(-1)} aria-label="Previous option" title="Previous ( [ )"><ChevronLeft size={16} /></button>
                  <button className="tool icon small" onClick={() => cycleItem(1)} aria-label="Next option" title="Next ( ] )"><ChevronRight size={16} /></button>
                </div>
              </div>
              <div className="tray" role="radiogroup" aria-label={`${layerDef.label} options`}>
                {offered(layer).map((i) => {
                  const item = AVATAR_CATALOG[layer][i];
                  const coming = missingArt.has(drawnItem(layer, item));
                  const on = shownIndex(layer, config.layers[layer]) === i;
                  const preview: GoblinAvatarConfig = { ...config, layers: { ...config.layers, [layer]: i } };
                  return (
                    <button key={item} role="radio" aria-checked={on} aria-label={coming ? `${itemName(layer, item)} (art on its way)` : itemName(layer, item)}
                      className={`well ${on ? 'on' : ''} ${coming ? 'coming' : ''}`} disabled={coming}
                      onClick={() => commit((c) => ({ ...c, layers: { ...c.layers, [layer]: i } }))}>
                      <span className="well-art"><CroppedGoblin config={preview} layer={layer} size={96} transparent={layer !== 'background'} /></span>
                      <span className="well-name">{coming ? 'Art on its way' : itemName(layer, item)}</span>
                    </button>
                  );
                })}
              </div>
              <div className="tray-foot">
                {channels.length > 0 ? channels.map((ch) => {
                  const palette: readonly string[] = ch === 'skin' ? SKIN_TONES.map((s) => s.base) : ch === 'accent' ? ACCENT_PALETTE : ch === 'leather' ? LEATHER_PALETTE : METAL_PALETTE;
                  const current = ch === 'skin' ? SKIN_TONES.findIndex((s) => s.id === config.skin) : config[ch];
                  return (
                    <div key={ch} className="swatch-row" role="radiogroup" aria-label={`${CHANNEL_LABEL[ch]} colour`}>
                      <span className="swatch-label">{CHANNEL_LABEL[ch]}</span>
                      {palette.map((color, i) => (
                        <button key={color} role="radio" aria-label={ch === 'skin' ? SKIN_TONES[i].name : `${CHANNEL_LABEL[ch]} ${i + 1}`} aria-checked={current === i}
                          className={`swatch ${current === i ? 'on' : ''}`} style={{ background: color }}
                          onClick={() => commit((c) => (ch === 'skin' ? { ...c, skin: SKIN_TONES[i].id } : { ...c, [ch]: i }))} />
                      ))}
                    </div>
                  );
                }) : <span className="tray-note">This one keeps its own colours.</span>}
                {notes.length > 0 && <span className="tray-note warn">{notes.join(' ')}</span>}
              </div>
            </div>
          )}

          {view === 'position' && (
            <div className="bench-panel">
              {partStrip}
              <div className="tray-head"><h3>{layerDef.label}<span>{isNudgeLayer(layer) ? 'Drag it on the mirror, or use the pad' : 'Stays where it is'}</span></h3></div>
              {isNudgeLayer(layer) && off ? (
                <div className="tune">
                  <div className="dpad" aria-label="Move pad">
                    <span /><button onClick={() => nudgeBy(layer, 0, -1)} disabled={off.y <= -NUDGE_RANGE} aria-label="Move up">▲</button><span />
                    <button onClick={() => nudgeBy(layer, -1, 0)} disabled={off.x <= -NUDGE_RANGE} aria-label="Move left">◀</button>
                    <button onClick={() => commit((c) => withOffset(c, layer, 0, 0))} aria-label="Put back" title="Put back (0)"><RotateCcw size={14} /></button>
                    <button onClick={() => nudgeBy(layer, 1, 0)} disabled={off.x >= NUDGE_RANGE} aria-label="Move right">▶</button>
                    <span /><button onClick={() => nudgeBy(layer, 0, 1)} disabled={off.y >= NUDGE_RANGE} aria-label="Move down">▼</button><span />
                  </div>
                  <div className="tune-meters">
                    <StepMeter label="Left and right" value={off.x} />
                    <StepMeter label="Up and down" value={-off.y} />
                    {isSpreadLayer(layer) && (
                      <label className="spread">
                        <span><span>Closer or wider</span><b>{config.nudge?.spread[layer] ?? 0}</b></span>
                        <input type="range" min={-NUDGE_RANGE} max={NUDGE_RANGE} step={1} value={config.nudge?.spread[layer] ?? 0}
                          onChange={(e) => commit((c) => withSpread(c, layer, Number(e.target.value)))} />
                      </label>
                    )}
                    {parent && <p className="tray-note">Moves with the {parent}, then by its own amount.</p>}
                  </div>
                </div>
              ) : (
                <p className="tray-note">Pick the eyes, ears, nose, mouth or anything worn on the head to move it.</p>
              )}
              <div className="tray-foot">
                <label className="check"><input type="checkbox" checked={guides} onChange={(e) => setGuides(e.target.checked)} />Show guides</label>
                <label className="check"><input type="checkbox" checked={focus} onChange={(e) => setFocus(e.target.checked)} />Fade the rest</label>
                <button className="tool small" disabled={!isNudged(config.nudge)} onClick={() => commit((c) => ({ ...c, nudge: EMPTY_NUDGE as NudgeState }))}><RotateCcw size={13} aria-hidden />Put everything back</button>
              </div>
            </div>
          )}

          {view === 'crew' && (
            <div className="bench-panel crew-panel">
              <div className="crew-grid">
                {crew.length === 0 && <p className="tray-note">Nobody here yet. Save this goblin to start your crew.</p>}
                {crew.map((g) => {
                  let cfg: GoblinAvatarConfig | null = null;
                  try { cfg = decodeGoblinDna(g.dna); } catch { cfg = null; }
                  return cfg ? (
                    <button key={g.id} className="crew-card" onClick={() => { commit(cfg!); setName(g.name); if (TITLES.includes(g.title)) setTitle(g.title); say('ok', `${g.name} is back at the mirror.`); }}>
                      <GoblinSvg config={cfg} size={76} />
                      <span className="crew-name">{g.name}</span>
                      <span className="crew-sub">{g.title}</span>
                    </button>
                  ) : null;
                })}
              </div>
              <div className="crew-side">
                <h3>On race day</h3>
                <div className="preview-row">
                  <figure className="preview"><div className="preview-badge"><GoblinSvg config={config} size={60} /></div><figcaption>Standings badge</figcaption></figure>
                  <figure className="preview"><div className="preview-pointer"><GoblinSvg config={config} size={36} options={{ transparentBackground: true }} /><span aria-hidden>▶</span></div><figcaption>Rival marker</figcaption></figure>
                  <figure className="preview"><div className="billboard"><GoblinSvg config={config} size={54} options={{ transparentBackground: true }} /></div><figcaption>Trackside</figcaption></figure>
                </div>
                <h3>Share this goblin</h3>
                <div className="code-row">
                  <code className="field code-out">{dna}</code>
                  <button className="tool icon" onClick={() => { void navigator.clipboard?.writeText(dna); say('ok', 'Goblin code copied.'); }} aria-label="Copy code" title="Copy code"><Copy size={15} /></button>
                </div>
                <p className="tray-note">Anyone who pastes this code gets this exact goblin.</p>
                <h3>Load a goblin code</h3>
                <form className="code-row" onSubmit={(e) => { e.preventDefault(); loadDna(paste); }}>
                  <input value={paste} onChange={(e) => setPaste(e.target.value)} placeholder="GOB-…" aria-label="Goblin code" className="field" spellCheck={false} />
                  <button className="tool" type="submit" disabled={!paste.trim()}>Load</button>
                </form>
              </div>
            </div>
          )}
        </section>
      </div>
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
