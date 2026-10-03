import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { evaluateGraph, litPreview, validateGraph, type TexGraph, type TexNode } from '@hm/texgraph';
import { SETMIX_FILE } from '@hm/render';
import { fx } from '../maker/feedback';

/**
 * The surface editor (owner, 2026-10-03: "i want to tweak pbr grass a bit"): SetMix's ground is made from texture graphs, so a surface's look
 * is a few colours and sizes. Pick one of its styles, change its colours and pattern sizes, watch the tile, then use it on the island. Saved
 * per player; "Copy" puts the graph on the clipboard so a good look can become the SetMix default.
 */
interface Style { readonly key: string; readonly label: string; readonly note: string; readonly graph: TexGraph }
interface GroundSet { readonly ground: { readonly surfaces: readonly { readonly id: string; readonly name: string; readonly styles: readonly Style[] }[] } }

let graphsOnce: Promise<GroundSet | null> | null = null;
/** The graph sets the bake wrote next to the tiles (fetched once, when the editor first opens). */
const loadGraphs = (): Promise<GroundSet | null> => (graphsOnce ??= fetch('textures/setmix/graphs.json').then((r) => (r.ok ? (r.json() as Promise<GroundSet>) : null)).catch(() => null));

const toHex = (v: number): string => { const s = v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055; return Math.round(Math.min(1, Math.max(0, s)) * 255).toString(16).padStart(2, '0'); };
const fromHex = (h: string): number => { const c = parseInt(h, 16) / 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const stopHex = (st: { r: number; g: number; b: number }): string => `#${toHex(st.r)}${toHex(st.g)}${toHex(st.b)}`;

/** Draw a graph lit into a canvas, tiled `tiles` x `tiles` (2 shows that it repeats without a seam). */
function draw(canvas: HTMLCanvasElement | null, graph: TexGraph, size: number, tiles: number): void {
  if (!canvas) return;
  let px: Uint8ClampedArray;
  try { px = litPreview(evaluateGraph(graph, { size, relief: size * 0.1 })); } catch { return; }
  canvas.width = canvas.height = size * tiles;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const img = new ImageData(px as Uint8ClampedArray<ArrayBuffer>, size, size);
  for (let y = 0; y < tiles; y++) for (let x = 0; x < tiles; x++) ctx.putImageData(img, x * size, y * size);
}

function StyleTile(props: { readonly style: Style; readonly on: boolean; readonly onPick: () => void }): ReactElement {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => { draw(ref.current, props.style.graph, 48, 1); }, [props.style]);
  return (
    <button className={`se-style${props.on ? ' on' : ''}`} aria-pressed={props.on} title={props.style.note} onClick={props.onPick}>
      <canvas ref={ref} width={48} height={48} aria-hidden="true" />
      <span>{props.style.label}</span>
    </button>
  );
}

const SIZE_NAMES: Record<string, string> = { noise: 'Patches', cellular: 'Cells', stripes: 'Bands', checker: 'Squares' };

export function SurfaceEditor(props: {
  readonly surfaceId: number;
  readonly name: string;
  /** The player's saved look for this surface, if any. */
  readonly saved?: TexGraph;
  /** Draw the island's surface from this graph; false when this ground cannot take a graph (an image set). */
  readonly onApply: (graph: TexGraph) => boolean;
  /** Keep the look for this player (null = back to the SetMix default). */
  readonly onSave: (graph: TexGraph | null) => void;
}): ReactElement {
  const file = SETMIX_FILE[props.surfaceId];
  const [set, setSet] = useState<GroundSet | null | undefined>(undefined);
  const [graph, setGraph] = useState<TexGraph | null>(props.saved ?? null);
  const [styleKey, setStyleKey] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const big = useRef<HTMLCanvasElement>(null);
  useEffect(() => { void loadGraphs().then(setSet); }, []);
  const surface = set?.ground.surfaces.find((s) => s.id === file);
  useEffect(() => { if (surface && !graph) { setGraph(structuredClone(surface.styles[0]!.graph)); setStyleKey(surface.styles[0]!.key); } }, [surface, graph]);
  // the big preview follows every change, at a quick size (the island gets the full one on "Use on this island")
  useEffect(() => {
    if (!graph) return;
    const id = requestAnimationFrame(() => draw(big.current, graph, 128, 2));
    return () => cancelAnimationFrame(id);
  }, [graph]);

  const ramps = useMemo(() => (graph?.nodes ?? []).filter((n) => n.type === 'ramp'), [graph]);
  const sized = useMemo(() => (graph?.nodes ?? []).filter((n) => typeof n.scale === 'number' && (n.type === 'noise' || n.type === 'cellular') || typeof n.count === 'number'), [graph]);
  const change = (id: string, fn: (n: TexNode) => TexNode): void => setGraph((g) => (g ? { ...g, nodes: g.nodes.map((n) => (n.id === id ? fn(n) : n)) } : g));

  if (set === undefined) return <p className="hint">Loading the looks…</p>;
  if (!set || !surface || !graph) return <p className="hint">This ground is made from pictures, not graphs, so its look cannot be changed here.</p>;

  const counts: Record<string, number> = {};
  const apply = (): void => {
    if (!validateGraph(graph).ok) { setNote('That look does not work; pick a style to start again.'); return; }
    setBusy(true);
    // let the busy state paint before the island draws the full-size tile
    setTimeout(() => {
      const done = props.onApply(graph);
      setBusy(false);
      if (done) { props.onSave(graph); setNote(`${props.name} uses this look now.`); fx('save', { volume: 0.5 }); }
      else setNote('This island\'s ground is made from pictures, so it keeps its look.');
    }, 30);
  };
  const reset = (): void => {
    const g = structuredClone(surface.styles[0]!.graph);
    setGraph(g); setStyleKey(surface.styles[0]!.key);
    setBusy(true);
    setTimeout(() => { props.onApply(g); props.onSave(null); setBusy(false); setNote(`${props.name} is back to the SetMix look.`); }, 30);
  };
  const copy = (): void => {
    void navigator.clipboard?.writeText(JSON.stringify(graph)).then(() => setNote('Copied the look. Paste it anywhere to keep or share it.'), () => setNote('The clipboard is not available here.'));
  };

  return (
    <div className="surface-editor">
      <canvas ref={big} className="se-preview" width={256} height={256} aria-label={`${props.name}, as it tiles`} />
      <div className="se-styles" role="group" aria-label="Styles">
        {surface.styles.map((st) => <StyleTile key={st.key} style={st} on={styleKey === st.key} onPick={() => { setGraph(structuredClone(st.graph)); setStyleKey(st.key); fx('select', { volume: 0.4 }); }} />)}
      </div>
      {ramps.length ? <h4>Colours</h4> : null}
      {ramps.map((r, ri) => (
        <div key={r.id} className="se-ramp" role="group" aria-label={ramps.length > 1 ? `Colours ${ri + 1}` : 'Colours'}>
          {(r.stops as { at: number; r: number; g: number; b: number }[]).map((st, si) => (
            <label key={si} className="se-swatch" style={{ background: stopHex(st) }} title={`Change this colour (${stopHex(st)})`}>
              <input type="color" value={stopHex(st)} onChange={(e) => {
                const h = e.target.value.slice(1);
                change(r.id, (n) => ({ ...n, stops: (n.stops as typeof st[]).map((x, k) => (k === si ? { ...x, r: fromHex(h.slice(0, 2)), g: fromHex(h.slice(2, 4)), b: fromHex(h.slice(4, 6)) } : x)) }));
                setStyleKey(null);
              }} />
            </label>
          ))}
        </div>
      ))}
      {sized.length ? <h4>Sizes</h4> : null}
      {sized.map((n) => {
        const key = typeof n.count === 'number' ? 'count' : 'scale';
        const base = SIZE_NAMES[n.type] ?? 'Pattern';
        counts[base] = (counts[base] ?? 0) + 1;
        const value = Number(n[key]);
        return (
          <label key={n.id} className="se-size">
            <span>{base} {counts[base]}</span>
            <input type="range" min={1} max={key === 'count' ? 64 : 48} step={1} value={value} onChange={(e) => { change(n.id, (x) => ({ ...x, [key]: Number(e.target.value) })); setStyleKey(null); }} />
            <output>{value} across</output>
          </label>
        );
      })}
      <div className="btns">
        <button className="go" disabled={busy} onClick={apply}>{busy ? 'Painting…' : 'Use on this island'}</button>
        <button disabled={busy} onClick={reset}>Back to the default</button>
        <button onClick={copy}>Copy</button>
      </div>
      {note ? <p className="hint" role="status">{note}</p> : null}
    </div>
  );
}
