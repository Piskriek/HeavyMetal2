import { useEffect, useRef, useState, type ReactElement } from 'react';
import { HOTBAR_LEVELS, variantNow, variantsOf, type HotbarLevel, type ToolPreset, type ToolVariant } from '@hm/buildkit';
import { createTerrain, heightAt, paintWay, sculptWay, type SculptWay, type Terrain } from '@hm/terrain';
import { stamp, type StampKind } from '@hm/terrainops';
import { DEFAULT_RULES } from '@hm/worldrules';
import { naturalSurface } from './build-controller';
import { surfaceColours } from './catalog';

/**
 * A tool's own presets (docs/HOTBAR.md section 1), in a row above the hotbar: each one drawn doing its thing to the ground you are looking
 * at, in the surface your palette has picked. Picking one sets the tool to it. Left, the tool and what each mouse button does; in Pro, its
 * size and strength; in Studio, a button to every setting.
 */
const hex = (c: string): [number, number, number] => { const n = parseInt(c.replace('#', '').slice(0, 6), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const colourOf = new Map<number, [number, number, number]>();
const rgb = (s: number): [number, number, number] => { let c = colourOf.get(s); if (!c) { c = hex(surfaceColours(s)[0] ?? '#888888'); colourOf.set(s, c); } return c; };

/**
 * The tool's preset used on the ground you look at: the patch round your aim, zoomed to about three brush-widths and sampled finer than the
 * island's cells so the shape reads; a short stroke across the middle (one press for Fill and Stamp). When your palette surface is the
 * ground's own, it paints on a contrasting base so you still see what it does.
 */
function drawPreview(canvas: HTMLCanvasElement, ground: Terrain, tool: ToolPreset, variant: ToolVariant, surface: number): void {
  const t2 = { ...tool, ...variant.patch };
  const g = ground.spec;
  const gx = g.originX + ((g.cols - 1) * g.cell) / 2, gz = g.originZ + ((g.rows - 1) * g.cell) / 2;
  const n = 33, span = Math.max(t2.size * 3.2, 4), fine = span / (n - 1);
  const t = createTerrain({ cols: n, rows: n, cell: fine, originX: gx - span / 2, originZ: gz - span / 2 });
  const counts = new Map<number, number>();
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    const gc = Math.max(0, Math.min(g.cols - 1, Math.round((t.spec.originX + c * fine - g.originX) / g.cell)));
    const gr = Math.max(0, Math.min(g.rows - 1, Math.round((t.spec.originZ + r * fine - g.originZ) / g.cell)));
    const i = r * n + c, j = gr * g.cols + gc;
    t.heights[i] = ground.heights[j]!; t.surfaceA[i] = ground.surfaceA[j]!; t.surfaceB[i] = ground.surfaceB[j]!; t.blend[i] = ground.blend[j]!;
    counts.set(t.surfaceA[i]!, (counts.get(t.surfaceA[i]!) ?? 0) + 1);
  }
  const main = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0];
  if (main === surface) { const base = surface === 2 ? 4 : 2; t.surfaceA.fill(base); t.surfaceB.fill(base); t.blend.fill(0); }
  const { cols, rows, cell, originX, originZ } = t.spec;
  const cx = originX + ((cols - 1) * cell) / 2, cz = originZ + ((rows - 1) * cell) / 2;
  const radius = t2.size;
  const way = tool.way ?? 'brush';
  const pts = way === 'fill' || way === 'stamp' ? [[cx, cz]] : [0.25, 0.4, 0.55, 0.7].map((f) => [originX + span * f, cz + Math.sin(f * 6) * span * 0.08]);
  for (const [x, z] of pts) paintWay(t, { way, x: x!, z: z!, radius, strength: t2.strength, falloff: t2.falloff, surface, seed: 7, ...(t2.shape ? { shape: t2.shape } : {}), ...(t2.pattern ? { pattern: t2.pattern } : {}), from: { dx: span * 0.3, dz: 0 }, natural: (h, f) => naturalSurface(h, f, DEFAULT_RULES) });
  canvas.width = cols; canvas.height = rows;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const img = ctx.createImageData(cols, rows);
  for (let i = 0; i < cols * rows; i++) {
    const a = rgb(t.surfaceA[i]!), b = rgb(t.surfaceB[i]!), w = t.blend[i]! / 255;
    img.data[i * 4] = a[0] + (b[0] - a[0]) * w; img.data[i * 4 + 1] = a[1] + (b[1] - a[1]) * w; img.data[i * 4 + 2] = a[2] + (b[2] - a[2]) * w; img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

/** Which sculpt a ground tool does, for its preview (the old shape tools press their shape). */
function sculptOf(tool: ToolPreset): { way: SculptWay } | { shape: StampKind } | null {
  if (tool.action === 'sculpt') return tool.sculpt === 'stamp' ? { shape: (tool.stampShape ?? 'mound') as StampKind } : tool.sculpt ? { way: tool.sculpt } : null;
  if (tool.action === 'raise' || tool.action === 'lower' || tool.action === 'smooth' || tool.action === 'flatten') return { way: tool.action };
  if (tool.action === 'dig') return { way: 'lower' };
  if (tool.action === 'mound' || tool.action === 'crater' || tool.action === 'plateau' || tool.action === 'ridge' || tool.action === 'dune') return { shape: tool.action };
  return null;
}

/**
 * A sculpt preset used on the ground you look at: the same patch, the tool run across it (pressed once for a shape), drawn as a relief lit
 * from the top left in the ground's own colours, so a terrace shows its steps and a crease its cut.
 */
function drawSculptPreview(canvas: HTMLCanvasElement, ground: Terrain, tool: ToolPreset, variant: ToolVariant): void {
  const t2 = { ...tool, ...variant.patch };
  const what = sculptOf(t2);
  if (!what) return;
  const g = ground.spec;
  const gx = g.originX + ((g.cols - 1) * g.cell) / 2, gz = g.originZ + ((g.rows - 1) * g.cell) / 2;
  const n = 33, span = Math.max(t2.size * 3.2, 4), fine = span / (n - 1);
  const t = createTerrain({ cols: n, rows: n, cell: fine, originX: gx - span / 2, originZ: gz - span / 2 });
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    const x = t.spec.originX + c * fine, z = t.spec.originZ + r * fine;
    const gc = Math.max(0, Math.min(g.cols - 1, Math.round((x - g.originX) / g.cell)));
    const gr = Math.max(0, Math.min(g.rows - 1, Math.round((z - g.originZ) / g.cell)));
    const i = r * n + c, j = gr * g.cols + gc;
    // heights sampled smoothly (the island's cells are coarser than the preview's): a relief drawn from copied cells would show their steps
    t.heights[i] = heightAt(ground, x, z); t.surfaceA[i] = ground.surfaceA[j]!; t.surfaceB[i] = ground.surfaceB[j]!; t.blend[i] = ground.blend[j]!;
  }
  const cx = gx, cz = gz;
  if ('shape' in what) stamp(t as never, what.shape, [cx, cz], Math.max(2, t2.size), { height: Math.max(0.2, t2.strength * t2.size * 0.6), seed: 7, rotation: 0.4 });
  else {
    const base = t.heights.slice();
    const pts = [0.25, 0.4, 0.55, 0.7].map((f) => [t.spec.originX + span * f, cz + Math.sin(f * 6) * span * 0.08] as const);
    for (const [x, z] of what.way === 'grab' ? [[cx + span * 0.12, cz] as const] : pts) {
      sculptWay(t, { way: what.way, x, z, radius: t2.size, strength: what.way === 'smooth' || what.way === 'pinch' ? Math.min(1, t2.strength * 2) : t2.strength, falloff: t2.falloff, seed: 7, target: base[Math.floor(n / 2) * n + Math.floor(n / 2)]! + 0.5, ...(what.way === 'grab' ? { grab: { x: cx - span * 0.12, z: cz, base, dx: span * 0.24, dz: 0 } } : {}) });
    }
  }
  canvas.width = n; canvas.height = n;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const img = ctx.createImageData(n, n);
  const h = (c: number, r: number): number => t.heights[Math.max(0, Math.min(n - 1, r)) * n + Math.max(0, Math.min(n - 1, c))]!;
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    const i = r * n + c;
    // relief: the slope exaggerated so gentle tools still show, lit from the top left
    const dx = (h(c + 1, r) - h(c - 1, r)) / (2 * fine) * 1.6, dz = (h(c, r + 1) - h(c, r - 1)) / (2 * fine) * 1.6;
    const len = Math.hypot(dx, 1, dz), lit = Math.max(0, (dx * 0.55 + 0.75 + dz * 0.4) / len);
    const shade = 0.35 + 0.75 * lit;
    const a = rgb(t.surfaceA[i]!);
    img.data[i * 4] = Math.min(255, a[0] * shade); img.data[i * 4 + 1] = Math.min(255, a[1] * shade); img.data[i * 4 + 2] = Math.min(255, a[2] * shade); img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

function VariantTile(props: { readonly v: ToolVariant; readonly on: boolean; readonly draw: (c: HTMLCanvasElement) => void; readonly onPick: () => void }): ReactElement {
  const ref = useRef<HTMLCanvasElement>(null);
  const { draw } = props;
  // drawn once per tile: the key changes when the ground, the surface or the preset changes
  useEffect(() => { if (ref.current) draw(ref.current); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <button className={props.on ? 'on' : ''} aria-pressed={props.on} title={props.v.name} onClick={props.onPick}>
      <canvas ref={ref} className="tp-pv" aria-hidden="true" />
      <span>{props.v.name}</span>
    </button>
  );
}

export function ToolPresetsRow(props: {
  readonly tool: ToolPreset; readonly level: HotbarLevel; readonly surface: number;
  /** A small copy of the ground being looked at, taken again about once a second so the previews follow your eyes (null: no ground yet). */
  readonly peek: () => Terrain | null;
  readonly words: { readonly title: string; readonly left: string; readonly right: string };
  readonly onPick: (v: ToolVariant) => void;
  readonly onEdit: (key: 'size' | 'strength', value: number) => void;
  readonly onAll: () => void;
  /** Sculpt's toggles (Pro): mirror across the island's middle, smooth after each dab. */
  readonly toggles?: { readonly mirror: boolean; readonly smoothAfter: boolean; readonly onToggle: (key: 'mirror' | 'smoothAfter') => void };
}): ReactElement {
  const { tool, level, surface, peek } = props;
  const [ground, setGround] = useState<Terrain | null>(() => peek());
  useEffect(() => {
    let last = ground ? `${ground.spec.originX},${ground.spec.originZ}` : '';
    const t = window.setInterval(() => { const g = peek(); const key = g ? `${g.spec.originX},${g.spec.originZ}` : ''; if (key !== last) { last = key; setGround(g); } }, 900);
    return () => window.clearInterval(t);
  }, [peek]); // eslint-disable-line react-hooks/exhaustive-deps
  const list = variantsOf(tool.id, level);
  const now = variantNow(tool);
  return (
    <div className="tool-presets" role="group" aria-label={`${tool.name} presets`} data-ui="island.tool-presets">
      <div className="tp-say">
        <b>{props.words.title}</b>
        <span><i>Left</i> {props.words.left} <i>Right</i> {props.words.right}</span>
      </div>
      <div className="tp-list">
        {list.map((v) => (
          <VariantTile key={`${tool.id}-${v.id}-${surface}-${tool.stampShape ?? ""}-${ground ? ground.spec.originX + ',' + ground.spec.originZ : ''}`} v={v} on={now?.id === v.id} onPick={() => props.onPick(v)}
            draw={(c) => { if (ground) { if (tool.tab === 'sculpt') drawSculptPreview(c, ground, tool, v); else drawPreview(c, ground, tool, v, surface); } }} />
        ))}
      </div>
      {level !== 'easy' ? (
        <div className="tp-knobs">
          <label>Size <input type="range" min={0.5} max={12} step={0.5} value={tool.size} onChange={(e) => props.onEdit('size', Number(e.target.value))} /></label>
          <label>Strength <input type="range" min={0.05} max={1} step={0.05} value={Math.min(1, tool.strength)} onChange={(e) => props.onEdit('strength', Number(e.target.value))} /></label>
          {props.toggles && tool.tab === 'sculpt' ? (
            <span className="tp-toggles" role="group" aria-label="Sculpt toggles">
              <button aria-pressed={props.toggles.mirror} className={props.toggles.mirror ? 'on' : ''} data-ui="island.sculpt.mirror" title="Every stroke is mirrored across the middle of the island" onClick={() => props.toggles?.onToggle('mirror')}>Symmetry</button>
              <button aria-pressed={props.toggles.smoothAfter} className={props.toggles.smoothAfter ? 'on' : ''} data-ui="island.sculpt.smooth" title="Smooth gently behind every stroke" onClick={() => props.toggles?.onToggle('smoothAfter')}>Smooth after</button>
            </span>
          ) : null}
        </div>
      ) : null}
      {level === 'studio' ? <button className="tp-all" onClick={props.onAll}>Every setting</button> : null}
    </div>
  );
}

/** Easy / Pro / Studio, at the end of the hotbar. */
export function LevelSwitch(props: { readonly level: HotbarLevel; readonly onLevel: (l: HotbarLevel) => void }): ReactElement {
  return (
    <div className="level-switch" role="group" aria-label="How deep the hotbar goes">
      {HOTBAR_LEVELS.map((l) => <button key={l.id} data-ui={`island.level.${l.id}`} className={props.level === l.id ? 'on' : ''} aria-pressed={props.level === l.id} title={l.says} onClick={() => props.onLevel(l.id)}>{l.name}</button>)}
    </div>
  );
}
