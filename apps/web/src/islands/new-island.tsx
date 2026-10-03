import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { decodeTerrain, generateIsland, type Terrain } from '@hm/terrain';
import type { PresetBundle } from '@hm/contracts';
import { SURF } from '@hm/render';
import { DRAFT_PRESETS } from '@hm/trackedit';
import { TEMPLATE_SHAPES, type TemplateShape } from '../maker/scene';
import { NewChooser, type NewWay } from '../shell/new-thing';

/**
 * A new island, three ways (B13): Quick setup (a ready-made island, one click), Setup wizard (size, ground, plants, a race track, a name; the
 * map redraws with every answer), Manual (a plain island, opened straight away for you to shape).
 */
export interface NewIslandChoice { readonly name: string; readonly template: string; readonly shape?: TemplateShape; readonly open: boolean }

const QUICK = ['volcano', 'palm-beach', 'rocky-cove', 'racing-starter', 'floating-rocks', 'empty-sea'] as const;
const SIZES = [{ id: 'small', name: 'Small', radius: 0.6 }, { id: 'medium', name: 'Medium', radius: 0.8 }, { id: 'large', name: 'Large', radius: 0.95 }] as const;
const GROUNDS = [
  { id: 'gentle', name: 'Gentle', height: 8, roughness: 3 }, { id: 'hilly', name: 'Hilly', height: 16, roughness: 7 },
  { id: 'rugged', name: 'Rugged', height: 24, roughness: 12 }, { id: 'volcano', name: 'A volcano', height: 11, roughness: 4 },
] as const;
const PLANTS = [{ id: 'bare', name: 'Bare', dress: 0 }, { id: 'some', name: 'Some', dress: 0.6 }, { id: 'lush', name: 'Lush', dress: 1.2 }] as const;
const STEPS = ['Size', 'Ground', 'Plants', 'Race track', 'Name'] as const;

/** Paint an island's map from above: sea by depth, sand, grass, rock, lava, with light from the north-west, and its track. */
const SURF_RGB: Record<number, [number, number, number]> = {
  [SURF.sand]: [226, 208, 152], [SURF.grass]: [111, 160, 74], [SURF.rock]: [139, 132, 120], [SURF.cliff]: [109, 101, 92], [SURF.lava]: [176, 70, 44],
  [SURF.scree]: [154, 146, 134], [SURF.basalt]: [74, 70, 66], [SURF.soil]: [138, 106, 72], [SURF.seabed]: [196, 186, 150],
};
/** What a map is drawn from: a template's shape (generated) or an island's own saved ground and track. */
export type MapSource = { readonly shape: TemplateShape } | { readonly terrain: Terrain; readonly track: readonly (readonly [number, number])[] };
const terrainOf = (shape: TemplateShape): Terrain => generateIsland({ cols: 129, rows: 129, cell: 2, originX: -128, originZ: -128 }, shape.seed, {
  surfaces: { seabed: SURF.seabed, sand: SURF.sand, grass: SURF.grass, rock: SURF.rock, cliff: SURF.cliff, lava: SURF.lava, scree: SURF.scree, basalt: SURF.basalt, soil: SURF.soil },
  radius: shape.radius, height: shape.height, roughness: shape.roughness, ...(shape.volcano ? { volcano: shape.volcano } : {}),
});
/** A saved island's map source from its bundle (the ground as edited, the track as drawn), or null when it cannot be read. */
export function mapOfBundle(json: string): MapSource | null {
  try {
    const b = JSON.parse(json) as PresetBundle;
    const ground = b.presets.find((x) => x.kind === 'terrain');
    if (!ground) return null;
    const terrain = decodeTerrain(ground.params['data'] as never);
    const track = b.presets.find((x) => x.kind === 'track');
    const pts = Array.isArray(track?.params['points']) ? (track!.params['points'] as unknown as [number, number][]) : [];
    return { terrain, track: pts };
  } catch { return null; }
}
function drawIsland(canvas: HTMLCanvasElement, src: MapSource): void {
  const t = 'shape' in src ? terrainOf(src.shape) : src.terrain;
  const { cols, rows } = t.spec;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  canvas.width = cols; canvas.height = rows;
  const img = ctx.createImageData(cols, rows);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const i = r * cols + c, h = t.heights[i]!;
    const hx = t.heights[r * cols + Math.min(cols - 1, c + 1)]! - t.heights[r * cols + Math.max(0, c - 1)]!;
    const hz = t.heights[Math.min(rows - 1, r + 1) * cols + c]! - t.heights[Math.max(0, r - 1) * cols + c]!;
    const shade = Math.max(0.55, Math.min(1.25, 1 - (hx + hz) * 0.09));
    let rgb: [number, number, number];
    if (h < 0.35) { const d = Math.min(1, Math.max(0, (0.35 - h) / 6)); rgb = [Math.round(92 - 60 * d), Math.round(196 - 90 * d), Math.round(210 - 40 * d)]; }
    else { const base = SURF_RGB[t.surfaceA[i]!] ?? SURF_RGB[SURF.grass]!; rgb = [base[0] * shade, base[1] * shade, base[2] * shade]; }
    img.data[i * 4] = rgb[0]; img.data[i * 4 + 1] = rgb[1]; img.data[i * 4 + 2] = rgb[2]; img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const track: readonly (readonly [number, number])[] = 'shape' in src ? (src.shape.track ? DRAFT_PRESETS[0]!.draft.points.map((p) => [p.x, p.z] as const) : []) : src.track;
  if (track.length > 2) {
    const sx = cols / ((cols - 1) * t.spec.cell), ox = t.spec.originX, oz = t.spec.originZ;
    ctx.strokeStyle = 'rgba(40,36,30,.85)'; ctx.lineWidth = 2.5; ctx.beginPath();
    track.forEach(([px, pz], k) => { const x = (px - ox) * sx, y = (pz - oz) * sx; if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
    ctx.closePath(); ctx.stroke();
  }
}
/** Maps draw one per frame (each is a few tens of milliseconds on a slow laptop): a grid of them never stalls the screen. */
const queue: (() => void)[] = [];
let pumping = false;
function later(job: () => void): () => void {
  let live = true;
  queue.push(() => { if (live) job(); });
  if (!pumping) {
    pumping = true;
    const pump = (): void => { const next = queue.shift(); next?.(); if (queue.length) requestAnimationFrame(pump); else pumping = false; };
    requestAnimationFrame(pump);
  }
  return () => { live = false; };
}
export function IslandMap(props: ({ readonly shape: TemplateShape } | { readonly source: MapSource }) & { readonly size: number; readonly label: string }): ReactElement {
  const ref = useRef<HTMLCanvasElement>(null);
  const src: MapSource = 'source' in props ? props.source : { shape: props.shape };
  useEffect(() => later(() => { if (ref.current) drawIsland(ref.current, src); }), ['source' in props ? props.source : props.shape]); // eslint-disable-line react-hooks/exhaustive-deps
  return <canvas ref={ref} className="island-map" style={{ width: props.size, height: props.size }} role="img" aria-label={props.label} />;
}

export function NewIsland(props: { readonly onMake: (choice: NewIslandChoice) => void; readonly onCancel: () => void }): ReactElement {
  const [way, setWay] = useState<NewWay | null>(null);
  const [step, setStep] = useState(0);
  const [ans, setAns] = useState({ size: 'medium', ground: 'hilly', plants: 'some', track: false, name: '' });
  const shape = useMemo<TemplateShape>(() => {
    const g = GROUNDS.find((x) => x.id === ans.ground)!;
    return {
      seed: 40 + ans.size.length * 7 + ans.ground.length * 3, radius: SIZES.find((x) => x.id === ans.size)!.radius, height: g.height, roughness: g.roughness, track: ans.track,
      name: ans.name.trim() || 'My island', dress: PLANTS.find((x) => x.id === ans.plants)!.dress,
      ...(ans.ground === 'volcano' ? { volcano: { peak: 40, cone: 0.34, crater: 0.2, craterDepth: 17 } } : {}),
    };
  }, [ans]);

  if (!way) {
    return <NewChooser thing="island" onPick={(w) => { if (w === 'manual') props.onMake({ name: 'New island', template: 'blank-island', open: true }); else setWay(w); }} onCancel={props.onCancel}
      says={{ quick: 'Pick a ready-made island: a volcano, a beach, a race island and more.', wizard: 'Five short questions: size, ground, plants, a race track, a name. The map redraws as you answer.', manual: 'A plain, gentle island, opened straight away for you to shape with the sculpt and paint tools.' }} />;
  }
  if (way === 'quick') {
    return (
      <div className="new-island">
        <div className="ni-grid">
          {QUICK.map((id) => { const t = TEMPLATE_SHAPES[id]!; return (
            <button key={id} onClick={() => props.onMake({ name: t.name, template: id, open: false })}>
              <IslandMap shape={t} size={104} label={`${t.name}, from above`} /><span>{t.name}</span>
            </button>
          ); })}
        </div>
        <div className="btns"><button onClick={() => setWay(null)}>Back</button></div>
      </div>
    );
  }
  const seg = <K extends 'size' | 'ground' | 'plants'>(key: K, list: readonly { id: string; name: string }[]): ReactElement => (
    <div className="seg ni-seg" role="group" aria-label={STEPS[step]}>{list.map((o) => <button key={o.id} className={ans[key] === o.id ? 'on' : ''} aria-pressed={ans[key] === o.id} onClick={() => setAns({ ...ans, [key]: o.id })}>{o.name}</button>)}</div>
  );
  const last = step === STEPS.length - 1;
  return (
    <div className="new-island wizard">
      <ol className="ad-steps" aria-label="Steps">{STEPS.map((s, i) => <li key={s} className={i === step ? 'on' : i < step ? 'done' : ''}><button onClick={() => setStep(i)}>{i + 1}. {s}</button></li>)}</ol>
      <div className="ni-wiz">
        <IslandMap shape={shape} size={180} label="Your island, from above" />
        <div className="ni-q">
          {step === 0 ? <><p>How big?</p>{seg('size', SIZES)}</> : null}
          {step === 1 ? <><p>What kind of ground?</p>{seg('ground', GROUNDS)}</> : null}
          {step === 2 ? <><p>How many plants?</p>{seg('plants', PLANTS)}</> : null}
          {step === 3 ? <><p>A race track round it?</p><div className="seg ni-seg" role="group" aria-label="Race track"><button className={ans.track ? 'on' : ''} aria-pressed={ans.track} onClick={() => setAns({ ...ans, track: true })}>Yes</button><button className={!ans.track ? 'on' : ''} aria-pressed={!ans.track} onClick={() => setAns({ ...ans, track: false })}>No</button></div></> : null}
          {last ? <label className="row">Name <input autoFocus value={ans.name} maxLength={40} placeholder="My island" onChange={(e) => setAns({ ...ans, name: e.target.value })} /></label> : null}
        </div>
      </div>
      <div className="btns">
        <button onClick={() => (step > 0 ? setStep(step - 1) : setWay(null))}>Back</button>
        <span className="grow" />
        {last ? <button className="go" onClick={() => props.onMake({ name: shape.name, template: 'blank-island', shape, open: true })}>Make {shape.name}</button>
          : <button className="go" onClick={() => setStep(step + 1)}>Next: {STEPS[step + 1]}</button>}
      </div>
    </div>
  );
}
