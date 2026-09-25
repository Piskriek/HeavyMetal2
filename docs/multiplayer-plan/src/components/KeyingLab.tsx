'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_KEY_PARAMS, chromaKey, qaReport, spillOf, type KeyParams, type KeyQa, type Rgba } from '@/hmgp2/chroma-key';
import { KEYED_PARTS, PAINTED_PARTS } from '@/hmgp2/painted-parts';

const MAX = 520;

function draw(canvas: HTMLCanvasElement | null, img: Rgba) {
  if (!canvas) return;
  canvas.width = img.width; canvas.height = img.height;
  const g = canvas.getContext('2d');
  if (!g) return;
  const data = new ImageData(img.width, img.height);
  data.data.set(img.data);
  g.putImageData(data, 0, 0);
}

export default function KeyingLab() {
  const [partId, setPartId] = useState(PAINTED_PARTS[0].id);
  const [raw, setRaw] = useState<Rgba | null>(null);
  const [params, setParams] = useState<KeyParams>(DEFAULT_KEY_PARAMS);
  const [qa, setQa] = useState<KeyQa | null>(null);
  const [ms, setMs] = useState(0);
  const refs = { raw: useRef<HTMLCanvasElement>(null), matte: useRef<HTMLCanvasElement>(null), keyed: useRef<HTMLCanvasElement>(null), spill: useRef<HTMLCanvasElement>(null) };
  const file = KEYED_PARTS[partId];

  useEffect(() => {
    let alive = true;
    const img = new Image();
    img.onload = () => {
      if (!alive) return;
      const s = Math.min(1, MAX / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      const g = c.getContext('2d', { willReadFrequently: true });
      if (!g) return;
      g.drawImage(img, 0, 0, c.width, c.height);
      const d = g.getImageData(0, 0, c.width, c.height);
      setRaw({ width: c.width, height: c.height, data: new Uint8ClampedArray(d.data) });
    };
    img.src = file.raw;
    return () => { alive = false; };
  }, [file.raw]);

  useEffect(() => {
    if (!raw) return;
    const t = setTimeout(() => {
      const t0 = performance.now();
      const { image, alpha, key } = chromaKey(raw, params);
      setMs(Math.round(performance.now() - t0));
      setQa(qaReport(raw, image, key));
      draw(refs.raw.current, raw);
      draw(refs.keyed.current, image);
      const matte = new Uint8ClampedArray(raw.width * raw.height * 4);
      const spill = new Uint8ClampedArray(raw.width * raw.height * 4);
      for (let p = 0; p < alpha.length; p++) {
        const v = Math.round(alpha[p] * 255), i = p * 4;
        matte[i] = matte[i + 1] = matte[i + 2] = v; matte[i + 3] = 255;
        const edge = alpha[p] > 0.004 && alpha[p] < 0.98;
        const sp = alpha[p] > 0.004 ? spillOf(raw.data[i], raw.data[i + 1], raw.data[i + 2]) : 0;
        spill[i] = edge ? 255 : Math.min(255, sp * 2); spill[i + 1] = edge ? 60 : 30; spill[i + 2] = edge ? 200 : 30; spill[i + 3] = edge || sp > 0 ? 255 : Math.round(alpha[p] * 90);
      }
      draw(refs.matte.current, { width: raw.width, height: raw.height, data: matte });
      draw(refs.spill.current, { width: raw.width, height: raw.height, data: spill });
    }, 40);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raw, params]);

  const slider = (key: keyof Omit<KeyParams, 'key'>, label: string, min: number, max: number, step: number, hint: string) => (
    <label className="block text-xs" title={hint}>
      <span className="flex justify-between text-stone-300"><span>{label}</span><b className="text-amber-300">{params[key]}</b></span>
      <input type="range" min={min} max={max} step={step} value={params[key]} className="w-full accent-fuchsia-500"
        onChange={(e) => setParams((p) => ({ ...p, [key]: Number(e.target.value) }))} />
    </label>
  );

  const verdictColor = useMemo(() => (qa?.verdict === 'pass' ? 'text-emerald-300' : qa?.verdict === 'warn' ? 'text-amber-300' : 'text-red-400'), [qa]);

  return (
    <div className="panel">
      <div className="panel-title">LIVE · Magenta keying lab (same <code>chroma-key.ts</code> as the build script)</div>
      <div className="mb-3 flex flex-wrap gap-2">
        {PAINTED_PARTS.map((p) => (
          <button key={p.id} className={`chip ${p.id === partId ? '!border-fuchsia-500 !text-fuchsia-200' : ''}`} onClick={() => setPartId(p.id)}>{p.name.replace(' (painted)', '')}</button>
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-[240px_1fr]">
        <div className="space-y-3">
          {slider('inner', 'Inner (fully keyed below)', 0, 120, 1, 'Chroma distance under which pixels become fully transparent')}
          {slider('outer', 'Outer (fully opaque above)', 20, 200, 1, 'Chroma distance above which pixels are fully opaque')}
          {slider('lumaWeight', 'Luma weight', 0, 1, 0.05, 'How much brightness difference counts vs. hue')}
          {slider('despill', 'Despill', 0, 1, 0.05, 'Remove residual magenta: spill = max(0, min(R,B) − G)')}
          {slider('choke', 'Choke (px)', 0, 2, 1, 'Erode the matte to cut JPEG ringing')}
          <button className="btn-ghost" onClick={() => setParams(DEFAULT_KEY_PARAMS)}>Reset to build defaults</button>
          {qa && (
            <div className="rounded border border-stone-700 bg-stone-950/60 p-2 font-mono text-[11px] leading-5">
              <div>verdict <b className={verdictColor}>{qa.verdict.toUpperCase()}</b> · {ms} ms @ {raw?.width}×{raw?.height}</div>
              <div>key rgb({qa.key.join(',')}) · drift {qa.keyDeviation}</div>
              <div>coverage {qa.coverage} · residual {qa.residualMagenta}px · border {qa.borderTouch}px</div>
              <div>bbox {qa.bbox.w}×{qa.bbox.h} @ ({qa.bbox.x},{qa.bbox.y})</div>
              {qa.notes.map((n) => <div key={n} className="text-amber-300">• {n}</div>)}
              <div className="mt-1 text-stone-500">build output: {file.width}×{file.height} master · source {file.sourceFormat}</div>
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {([['raw', 'Raw render (#FF00FF field)'], ['matte', 'Alpha matte'], ['keyed', 'Keyed + decontaminated'], ['spill', 'Edge band (magenta) & spill (red)']] as const).map(([k, label]) => (
            <figure key={k} className="lab-cell">
              <div className={k === 'keyed' ? 'checker' : 'bg-stone-950'}><canvas ref={refs[k]} className="h-auto w-full" /></div>
              <figcaption>{label}</figcaption>
            </figure>
          ))}
        </div>
      </div>
    </div>
  );
}
