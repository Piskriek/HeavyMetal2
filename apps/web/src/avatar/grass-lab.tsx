import { useEffect, useRef, useState, type ReactElement } from 'react';
import { createRoot } from 'react-dom/client';
import { PRESETS, renderGrass } from '@hm/pbrgrass';
import '../shell.css';
import '../studio.css';

/** Texture Lab (dev page /grass.html): every procedural grass preset as colour, normal, roughness, ao and a 3x3 tiling, so repetition and map agreement can be judged by eye. */
const rgba = (data: Uint8ClampedArray, size: number): ImageData => new ImageData(new Uint8ClampedArray(data), size, size);
const grey = (data: Uint8ClampedArray, size: number): ImageData => { const o = new Uint8ClampedArray(size * size * 4); for (let i = 0; i < size * size; i++) { o[i * 4] = o[i * 4 + 1] = o[i * 4 + 2] = data[i]!; o[i * 4 + 3] = 255; } return new ImageData(o, size, size); };

function Canvas({ img, tiles = 1, label }: { img: ImageData; tiles?: number; label: string }): ReactElement {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!;
    const tmp = document.createElement('canvas'); tmp.width = img.width; tmp.height = img.height;
    tmp.getContext('2d')!.putImageData(img, 0, 0);
    c.width = img.width * tiles; c.height = img.height * tiles;
    const g = c.getContext('2d')!;
    for (let y = 0; y < tiles; y++) for (let x = 0; x < tiles; x++) g.drawImage(tmp, x * img.width, y * img.height);
  }, [img, tiles]);
  return <figure style={{ margin: 0 }}><canvas ref={ref} style={{ width: tiles === 1 ? 190 : 380, height: tiles === 1 ? 190 : 380, display: 'block' }} /><figcaption className="hint">{label}</figcaption></figure>;
}

function Lab(): ReactElement {
  const [size, setSize] = useState(256);
  const [seed, setSeed] = useState(1);
  const [ms, setMs] = useState(0);
  const [maps, setMaps] = useState<{ id: string; name: string; r: ReturnType<typeof renderGrass> }[]>([]);
  useEffect(() => {
    const t0 = performance.now();
    setMaps(PRESETS.map((p) => ({ id: p.id, name: p.name, r: renderGrass(p.params, size, seed) })));
    setMs(Math.round(performance.now() - t0));
  }, [size, seed]);
  return (
    <div style={{ padding: 16, height: '100vh', overflow: 'auto', background: 'var(--paper)' }}>
      <header style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
        <b>Grass lab</b><span className="hint">{PRESETS.length} presets, {ms} ms at {size}px</span>
        <select value={size} onChange={(e) => setSize(Number(e.target.value))}>{[128, 256, 512].map((s) => <option key={s}>{s}</option>)}</select>
        <button onClick={() => setSeed((s) => s + 1)}>New seed ({seed})</button>
      </header>
      {maps.map((m) => (
        <section key={m.id} style={{ borderTop: '1px solid var(--line)', padding: '10px 0', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <Canvas img={rgba(m.r.albedo, m.r.size)} label={`${m.name}: colour`} />
          <Canvas img={rgba(m.r.normal, m.r.size)} label="normal" />
          <Canvas img={grey(m.r.roughness, m.r.size)} label="roughness" />
          <Canvas img={grey(m.r.ao, m.r.size)} label="ambient occlusion" />
          <Canvas img={rgba(m.r.albedo, m.r.size)} tiles={3} label="3 x 3 tiling of the colour map" />
        </section>
      ))}
    </div>
  );
}

createRoot(document.getElementById('app')!).render(<Lab />);
