// The preset bench's Sprites page (plan 43, step 4): the turntable of a machine, drawn in the Fidelity Stage's palette and
// turned at that stage's cadence. The preview is the real bake — the same pixels the card over a machine will show — and the
// cartridge goes in the beam rifle; Apply hangs the card over the machine it is fired at. Pure data, the canvas is only a
// viewer.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { SPRITE_DITHERS, type SpriteDither, type SpritePrintSpec } from '@hm/cartlab';
import { sheetToRgba } from '@hm/shareware';
import { bakeSpritePrint, spriteKitIds, spritePrintName, spriteFps, spriteBill, SPRITE_KITS, spriteCode } from './sprite-sound-cartridge';
import type { MyPreset } from './my-presets';
import './bench-parts.css';

export interface BenchSpritesProps {
  /** Whether printing this sheet can start now, and why not (the bench, the blank, the power, the stock). */
  readonly check: (spec: SpritePrintSpec) => { readonly ok: boolean; readonly why: string };
  readonly onPrint: (spec: SpritePrintSpec) => void;
  readonly printLabel?: string;
  /** The number of the first step on this page (the lab bench's step 1 is picking the blank). */
  readonly firstStep?: number;
  /** The player's saved sprites ("Yours"), offered after the machines. */
  readonly mine?: readonly MyPreset[];
  readonly onSave?: (spec: SpritePrintSpec) => void;
}

const STAGES: readonly { readonly stage: number; readonly label: string }[] = [
  { stage: 0, label: 'S0 1-bit' }, { stage: 1, label: 'S1 EGA' }, { stage: 2, label: 'S2 VGA' },
  { stage: 3, label: 'S3 true' }, { stage: 4, label: 'S4' }, { stage: 5, label: 'S5' }, { stage: 6, label: 'S6' },
];

/** The frames of a sheet, drawn one after another at the stage's cadence: exactly what the card over a machine shows. */
const SheetPreview: React.FC<{ readonly spec: SpritePrintSpec; readonly sizePx: number }> = ({ spec, sizePx }) => {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const sheet = useMemo(() => bakeSpritePrint(spec), [spec]);
  const fps = spriteFps(spec.stage);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // the atlas goes into an offscreen canvas once; the viewer blits one frame of it per tick
    const atlas = document.createElement('canvas');
    atlas.width = sheet.size * sheet.angles;
    atlas.height = sheet.size;
    const actx = atlas.getContext('2d');
    if (!actx) return;
    const rgba = sheetToRgba(sheet);
    const image = actx.createImageData(sheet.size * sheet.angles, sheet.size);
    image.data.set(rgba);
    actx.putImageData(image, 0, 0);
    ctx.imageSmoothingEnabled = false;
    let raf = 0;
    const started = performance.now();
    const draw = (): void => {
      const frame = Math.floor(((performance.now() - started) / 1000) * fps) % sheet.angles;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(atlas, frame * sheet.size, 0, sheet.size, sheet.size, 0, 0, canvas.width, canvas.height);
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [sheet, fps]);
  return (
    <canvas
      ref={ref}
      width={sizePx}
      height={sizePx}
      className="bench-sprite-frame"
      data-testid="bench-sprite-frame"
      style={{ imageRendering: 'pixelated', background: '#0b0d10', borderRadius: 4 }}
    />
  );
};

export const BenchSprites: React.FC<BenchSpritesProps> = ({ check, onPrint, printLabel = 'Start printing', firstStep = 2, mine = [], onSave }) => {
  const [spec, setSpec] = useState<SpritePrintSpec>(() => ({
    name: spritePrintName('gate', 2), kit: 'gate', stage: 2, size: 32, angles: 8, dither: 'bayer2', elevationDeg: 12,
  }));
  const can = check(spec);
  const bill = spriteBill(spec).map((x) => `${x.n} ${x.item === 'pxd-mono' ? 'raw pixels' : 'raw vertices'}`).join(' and ');
  const set = (patch: Partial<SpritePrintSpec>): void => {
    setSpec((s) => {
      const next = { ...s, ...patch };
      return { ...next, name: spritePrintName(next.kit, next.stage) };
    });
  };
  const mineSpecs = mine.flatMap((p) => ('sprite' in p.print ? [{ id: p.id, name: p.name, spec: p.print.sprite }] : []));
  return (
    <div className="bench-parts bench-sprites" data-testid="bench-sprites">
      <p className="bench-parts-pos" data-step={firstStep}>Choose what to turn</p>
      <div className="bench-parts-gens">
        {spriteKitIds().map((id) => (
          <button key={id} className={spec.kit === id ? 'on' : ''} aria-pressed={spec.kit === id}
            data-testid={`bench-sprite-kit-${id}`} onClick={() => set({ kit: id })}>
            {SPRITE_KITS[id]!.label}
          </button>
        ))}
      </div>
      {mineSpecs.length > 0 ? (
        <>
          <p className="bench-parts-yours">Yours</p>
          <div className="bench-parts-gens">
            {mineSpecs.map((m) => (
              <button key={m.id} className="bench-parts-mine" data-testid={`bench-sprite-mine-${m.id}`} onClick={() => setSpec(m.spec)}>{m.name}</button>
            ))}
          </div>
        </>
      ) : null}

      <div className="bench-parts-row">
        <SheetPreview spec={spec} sizePx={112} />
        <div className="bench-parts-col">
          <div className="bench-parts-ops" role="radiogroup" aria-label="Stage">
            {STAGES.map((s) => (
              <button key={s.stage} role="radio" aria-checked={spec.stage === s.stage} className={spec.stage === s.stage ? 'on' : ''}
                data-testid={`bench-sprite-stage-${s.stage}`} onClick={() => set({ stage: s.stage })}>{s.label}</button>
            ))}
          </div>
          <div className="bench-parts-ops" role="radiogroup" aria-label="Frames">
            {[4, 8, 12, 16].map((n) => (
              <button key={n} role="radio" aria-checked={spec.angles === n} className={spec.angles === n ? 'on' : ''}
                data-testid={`bench-sprite-angles-${n}`} onClick={() => set({ angles: n })}>{n} frames</button>
            ))}
          </div>
          <div className="bench-parts-ops" role="radiogroup" aria-label="Dither">
            {SPRITE_DITHERS.map((d) => (
              <button key={d} role="radio" aria-checked={spec.dither === d} className={spec.dither === d ? 'on' : ''}
                data-testid={`bench-sprite-dither-${d}`} onClick={() => set({ dither: d as SpriteDither })}>{d === 'none' ? 'No dither' : d === 'bayer2' ? 'Bayer 2' : 'Bayer 4'}</button>
            ))}
          </div>
          <label className="bench-parts-row">
            <span>Pixels</span>
            <input type="range" min={8} max={64} step={8} value={spec.size} aria-label="Pixels a frame"
              data-testid="bench-sprite-size" onChange={(e) => set({ size: Number(e.target.value) })} />
            <b>{spec.size}</b>
          </label>
          <label className="bench-parts-row">
            <span>Crane</span>
            <input type="range" min={-10} max={40} step={2} value={spec.elevationDeg} aria-label="Camera elevation"
              data-testid="bench-sprite-elevation" onChange={(e) => set({ elevationDeg: Number(e.target.value) })} />
            <b>{spec.elevationDeg}°</b>
          </label>
        </div>
      </div>

      <p className="bench-parts-cost">
        <b>{spec.name}</b><span className="bench-parts-cost-sep">. </span>
        {spec.angles} frames at {spec.size} px, in the stage's palette ({spriteFps(spec.stage)} frames a second).
        <span className="bench-parts-cost-sep"> </span>Takes a blank, the bench's time and {bill}.
      </p>
      <p className="bench-parts-code" data-testid="bench-sprite-code"><code>{spriteCode(spec).slice(0, 28)}…</code></p>
      <div className="play-machine-actions">
        <button className="go" disabled={!can.ok} onClick={() => onPrint(spec)} data-testid="bench-print-sprite">{printLabel}</button>
        {onSave ? <button onClick={() => onSave(spec)} data-testid="bench-save-sprite">Save as preset</button> : null}
      </div>
      {!can.ok ? <span className="play-why">{can.why}</span> : null}
    </div>
  );
};
