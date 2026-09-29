/**
 * The Sky, sea & clouds window: the painted skybox, or a crisp gradient over it (its three colours, how
 * crisp, where the middle band sits, how opaque); the ocean (colours, how clear, its pattern, the pattern's
 * size and the waves' pace); the horizon (a thin glow band, how far sky and sea haze into it, the distance
 * fog, or a crisp line); and the painted clouds floating round the island, tiny on the horizon if asked.
 * Changes show at once and are kept for the race (sky-settings.ts).
 */
import { useEffect, useState } from 'react';
import {
  CLOUD_COUNT_MAX, GRADIENT_PRESETS, HORIZON_PRESETS, SEA_PRESETS, SEA_TEXTURES, getSkySettings, gradientColorAt, onSkySettings, resetSkySettings, setSkySettings,
  type SkyGradient, type SkySettings,
} from '../../game/sky/sky-settings';
import { rebase } from '../../platform/asset-base';

interface Props {
  /** The Sky menu's painted skies, to pick one right here. */
  paintedSkies: { id: string; name: string; url: string }[];
  currentPainted: string;
  onPickPainted: (id: string) => void;
  onChange?: () => void;
  onClose: () => void;
}

const toCss = ([r, g, b]: [number, number, number]) => `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`;

/** The gradient as the dome shows it, bottom (horizon) to top. */
function gradientCss(g: SkyGradient): string {
  const stops: string[] = [];
  for (let i = 0; i <= 24; i++) stops.push(`${toCss(gradientColorAt(g, i / 24))} ${((1 - i / 24) * 100).toFixed(1)}%`);
  return `linear-gradient(to bottom, ${stops.reverse().join(', ')})`;
}

function Slider(props: { label: string; value: number; min: number; max: number; step: number; format?: (v: number) => string; onChange: (v: number) => void }) {
  return (
    <label className="grid grid-cols-[88px_1fr_44px] items-center gap-2 text-[11px] text-zinc-300">
      <span>{props.label}</span>
      <input type="range" min={props.min} max={props.max} step={props.step} value={props.value} onChange={(e) => props.onChange(Number(e.target.value))} className="accent-amber-500" />
      <span className="text-right tabular-nums text-zinc-400">{props.format ? props.format(props.value) : props.value.toFixed(2)}</span>
    </label>
  );
}

function ColorRow(props: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center justify-between gap-2 text-[11px] text-zinc-300">
      <span>{props.label}</span>
      <span className="flex items-center gap-2">
        <span className="font-mono text-[10px] text-zinc-500">{props.value}</span>
        <input type="color" value={props.value} onChange={(e) => props.onChange(e.target.value)} className="h-6 w-10 cursor-pointer rounded border border-zinc-700 bg-transparent" />
      </span>
    </label>
  );
}

export default function SkyPanel({ paintedSkies, currentPainted, onPickPainted, onChange, onClose }: Props) {
  const [s, setS] = useState<SkySettings>(() => getSkySettings());
  useEffect(() => onSkySettings((next) => { setS(next); onChange?.(); }), [onChange]);
  const g = s.gradient, c = s.clouds, w = s.sea, z = s.horizon;
  const tab = (active: boolean) => `flex-1 px-2 py-1 text-[11px] font-bold rounded border cursor-pointer ${active ? 'bg-amber-950/70 border-amber-500/80 text-amber-200' : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:text-zinc-200'}`;

  return (
    <div className="flex flex-col gap-3 text-xs">
      <section className="flex flex-col gap-2">
        <div className="text-[10px] font-bold uppercase tracking-wider text-amber-400">Skydome</div>
        <div className="flex gap-1.5">
          <button className={tab(s.mode === 'painted')} onClick={() => setSkySettings({ mode: 'painted' })}>Painted skybox</button>
          <button className={tab(s.mode === 'gradient')} onClick={() => setSkySettings({ mode: 'gradient' })}>Gradient</button>
        </div>

        {s.mode === 'gradient' && (
          <>
            <div className="h-20 rounded border border-zinc-700" style={{ background: gradientCss(g) }} title="Horizon at the bottom, straight up at the top" />
            <div className="grid grid-cols-3 gap-1">
              {GRADIENT_PRESETS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSkySettings({ gradient: { ...p.gradient, opacity: g.opacity } })}
                  className="flex flex-col items-center gap-1 rounded border border-zinc-800 bg-zinc-900 p-1 hover:border-amber-600/60 cursor-pointer"
                >
                  <span className="h-6 w-full rounded" style={{ background: gradientCss(p.gradient) }} />
                  <span className="text-[10px] text-zinc-300 truncate w-full text-center">{p.name}</span>
                </button>
              ))}
            </div>
            <ColorRow label="Top" value={g.top} onChange={(v) => setSkySettings({ gradient: { top: v } })} />
            <ColorRow label="Middle" value={g.middle} onChange={(v) => setSkySettings({ gradient: { middle: v } })} />
            <ColorRow label="Horizon (and fog)" value={g.horizon} onChange={(v) => setSkySettings({ gradient: { horizon: v } })} />
            <Slider label="Crispness" value={g.crispness} min={0} max={1} step={0.01} onChange={(v) => setSkySettings({ gradient: { crispness: v } })} />
            <Slider label="Middle height" value={g.midHeight} min={0.05} max={0.9} step={0.01} onChange={(v) => setSkySettings({ gradient: { midHeight: v } })} />
            <Slider label="Opacity" value={g.opacity} min={0} max={1} step={0.01} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => setSkySettings({ gradient: { opacity: v } })} />
            <div className="text-[10px] text-zinc-500">Below 100% the painted sky shows through; pick it here:</div>
          </>
        )}
        {(s.mode === 'painted' || g.opacity < 1) && (
          <div className="grid grid-cols-2 gap-1 max-h-44 overflow-y-auto pr-1 scrollbar-thin">
            {paintedSkies.map((p) => (
              <button
                key={p.id}
                onClick={() => onPickPainted(p.id)}
                className={`flex items-center gap-2 rounded border p-1 text-left cursor-pointer ${currentPainted === p.id ? 'border-amber-500/80 bg-amber-950/60 text-amber-200' : 'border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-amber-600/60'}`}
              >
                <span className="h-7 w-7 shrink-0 rounded bg-cover bg-center border border-zinc-700" style={{ backgroundImage: `url(${rebase(p.url)})` }} />
                <span className="truncate text-[10px]">{p.name}</span>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-2 border-t border-zinc-800 pt-3">
        <div className="text-[10px] font-bold uppercase tracking-wider text-amber-400">Ocean</div>
        <div className="grid grid-cols-3 gap-1">
          {SEA_PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => setSkySettings({ sea: p.sea })}
              className="flex flex-col items-center gap-1 rounded border border-zinc-800 bg-zinc-900 p-1 hover:border-amber-600/60 cursor-pointer"
            >
              <span className="h-5 w-full rounded" style={{ background: `linear-gradient(to bottom, ${p.sea.water}, ${p.sea.deep})` }} />
              <span className="text-[10px] text-zinc-300 truncate w-full text-center">{p.name}</span>
            </button>
          ))}
        </div>
        <label className="flex items-center justify-between gap-2 text-[11px] text-zinc-300">
          <span>Pattern</span>
          <select
            value={w.texture}
            onChange={(e) => setSkySettings({ sea: { texture: e.target.value as typeof w.texture } })}
            className="bg-zinc-900 border border-zinc-700 rounded px-1.5 py-0.5 text-[11px] text-zinc-200 cursor-pointer"
          >
            {SEA_TEXTURES.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </label>
        <ColorRow label="Water colour" value={w.water} onChange={(v) => setSkySettings({ sea: { water: v } })} />
        <ColorRow label="Deep colour" value={w.deep} onChange={(v) => setSkySettings({ sea: { deep: v } })} />
        <Slider label="See-through" value={w.seeThrough} min={0} max={0.6} step={0.01} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => setSkySettings({ sea: { seeThrough: v } })} />
        <Slider label="Pattern size" value={w.tileSize} min={800} max={10000} step={100} format={(v) => `${(v / 1000).toFixed(1)}k`} onChange={(v) => setSkySettings({ sea: { tileSize: v } })} />
        <Slider label="Wave speed" value={w.waveSpeed} min={0} max={4} step={0.1} format={(v) => (v === 0 ? 'still' : `${v.toFixed(1)}×`)} onChange={(v) => setSkySettings({ sea: { waveSpeed: v } })} />
        <div className="text-[10px] text-zinc-500">The water colour tints the pattern: white shows a pattern's own colours (try it with Lagoon shallows).</div>
      </section>

      <section className="flex flex-col gap-2 border-t border-zinc-800 pt-3">
        <div className="text-[10px] font-bold uppercase tracking-wider text-amber-400">Horizon</div>
        <div className="grid grid-cols-3 gap-1">
          {HORIZON_PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => setSkySettings({ horizon: { ...p.horizon, glowColor: z.glowColor } })}
              className="flex flex-col items-center gap-1 rounded border border-zinc-800 bg-zinc-900 p-1 hover:border-amber-600/60 cursor-pointer"
              title={p.id === 'crisp' ? 'Sky meets sea on a sharp line: no haze, no fog, no glow' : p.id === 'glow' ? 'A thin light band on the line, fading up and down' : 'The old wide soft haze'}
            >
              <span
                className="h-5 w-full rounded"
                style={{ background: p.id === 'crisp'
                  ? 'linear-gradient(to bottom, #8cc4f0 50%, #3f8f8c 50%)'
                  : p.id === 'glow'
                    ? 'linear-gradient(to bottom, #8cc4f0 38%, #ffffff 50%, #3f8f8c 62%)'
                    : 'linear-gradient(to bottom, #8cc4f0 10%, #cfe6ee 45%, #cfe6ee 55%, #3f8f8c 90%)' }}
              />
              <span className="text-[10px] text-zinc-300 truncate w-full text-center">{p.name}</span>
            </button>
          ))}
        </div>
        <label className="flex items-center gap-1.5 text-[11px] text-zinc-300 cursor-pointer">
          <input type="checkbox" checked={z.glow} onChange={(e) => setSkySettings({ horizon: { glow: e.target.checked } })} className="accent-amber-500" />
          Glow band on the horizon
        </label>
        {z.glow && (
          <>
            <ColorRow label="Glow colour" value={z.glowColor} onChange={(v) => setSkySettings({ horizon: { glowColor: v } })} />
            <Slider label="Glow strength" value={z.glowStrength} min={0} max={1} step={0.01} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => setSkySettings({ horizon: { glowStrength: v } })} />
            <Slider label="Glow width" value={z.glowWidth} min={0.002} max={0.12} step={0.001} format={(v) => (v < 0.006 ? 'hairline' : `${(v * 100).toFixed(1)}`)} onChange={(v) => setSkySettings({ horizon: { glowWidth: v } })} />
            <Slider label="Glow fade" value={z.glowSoftness} min={0} max={1} step={0.01} format={(v) => (v < 0.05 ? 'hard' : `${Math.round(v * 100)}%`)} onChange={(v) => setSkySettings({ horizon: { glowSoftness: v } })} />
          </>
        )}
        <Slider label="Haze" value={z.haze} min={0} max={1} step={0.01} format={(v) => (v === 0 ? 'crisp' : `${Math.round(v * 100)}%`)} onChange={(v) => setSkySettings({ horizon: { haze: v } })} />
        <Slider label="Distance fog" value={z.fog} min={0} max={1} step={0.01} format={(v) => (v === 0 ? 'none' : `${Math.round(v * 100)}%`)} onChange={(v) => setSkySettings({ horizon: { fog: v } })} />
        <div className="text-[10px] text-zinc-500">Haze and fog at 0 with the glow off give a crisp line where the sea meets the sky.</div>
      </section>

      <section className="flex flex-col gap-2 border-t border-zinc-800 pt-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">Clouds</span>
          <label className="flex items-center gap-1.5 text-[11px] text-zinc-300 cursor-pointer">
            <input type="checkbox" checked={c.enabled} onChange={(e) => setSkySettings({ clouds: { enabled: e.target.checked } })} className="accent-amber-500" />
            Show
          </label>
        </div>
        <Slider label="Amount" value={c.count} min={0} max={CLOUD_COUNT_MAX} step={1} format={(v) => String(Math.round(v))} onChange={(v) => setSkySettings({ clouds: { count: v } })} />
        <Slider label="Size" value={c.size} min={0.3} max={2.5} step={0.05} format={(v) => `${v.toFixed(2)}×`} onChange={(v) => setSkySettings({ clouds: { size: v } })} />
        <Slider label="Height" value={c.height} min={0.3} max={2} step={0.05} format={(v) => `${v.toFixed(2)}×`} onChange={(v) => setSkySettings({ clouds: { height: v } })} />
        <Slider label="Horizon size" value={c.horizonSize} min={0.1} max={1.5} step={0.05} format={(v) => `${v.toFixed(2)}×`} onChange={(v) => setSkySettings({ clouds: { horizonSize: v } })} />
        <Slider label="Hug horizon" value={c.horizonHug} min={0} max={1} step={0.05} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => setSkySettings({ clouds: { horizonHug: v } })} />
        <Slider label="Drift" value={c.drift} min={0} max={4} step={0.1} format={(v) => (v === 0 ? 'still' : `${v.toFixed(1)}×`)} onChange={(v) => setSkySettings({ clouds: { drift: v } })} />
        <Slider label="Opacity" value={c.opacity} min={0.1} max={1} step={0.05} onChange={(v) => setSkySettings({ clouds: { opacity: v } })} />
        <ColorRow label="Tint" value={c.tint} onChange={(v) => setSkySettings({ clouds: { tint: v } })} />
        <button
          onClick={() => setSkySettings({ clouds: { seed: (c.seed % 9999) + 1 } })}
          className="self-start px-2 py-1 text-[11px] rounded border border-zinc-700 bg-zinc-900 text-amber-300 hover:bg-zinc-800 cursor-pointer"
          title="Another arrangement of the same clouds"
        >
          Shuffle clouds
        </button>
      </section>

      <div className="flex justify-between border-t border-zinc-800 pt-2">
        <button onClick={() => resetSkySettings()} className="px-2 py-1 text-[11px] rounded border border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 cursor-pointer">Reset</button>
        <button onClick={onClose} className="px-3 py-1 text-[11px] rounded border border-zinc-700 bg-zinc-800 text-zinc-200 hover:bg-zinc-700 cursor-pointer">Close</button>
      </div>
    </div>
  );
}
