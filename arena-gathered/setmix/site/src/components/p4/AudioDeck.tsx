import { useEffect, useRef, useState } from "react";
import { SetmixAudio, AUDIO_STAGES, type Surface, type AudioTelemetry } from "@/drop/setmixAudio";
import { stageOf, fidelityIndex } from "@/drop/fidelity";
import type { FidelityState } from "@/drop/contracts.setmix";
import { cn } from "@/utils/cn";

const SURFACES: Surface[] = ["dust", "crystal", "metal", "grass", "water"];

export default function AudioDeck() {
  const [on, setOn] = useState(false);
  const [exp, setExp] = useState(2.4);
  const [gain, setGain] = useState(0.45);
  const [tel, setTel] = useState<AudioTelemetry | null>(null);
  const [walking, setWalking] = useState(false);
  const [surface, setSurface] = useState<Surface>("dust");
  const [err, setErr] = useState<string | null>(null);

  const engine = useRef<SetmixAudio | null>(null);
  const cfg = useRef({ exp, walking, surface });
  cfg.current = { exp, walking, surface };
  const analyser = useRef<AnalyserNode | null>(null);
  const scope = useRef<HTMLCanvasElement>(null);

  const stateFor = (e: number): FidelityState => {
    const v = Math.pow(10, e);
    return { pxd: v * 1.32, vtx: v, lx: v * 0.72, aq: v * 0.46, tick: 0 };
  };

  const toggle = async () => {
    if (on) { await engine.current?.stop(); setOn(false); return; }
    try {
      if (!engine.current) engine.current = new SetmixAudio({ masterGain: gain, seed: 1337 });
      await engine.current.start();
      const a = engine.current.ctx.createAnalyser();
      a.fftSize = 1024;
      engine.current.ctx.destination;
      // tap the master by re-routing through the analyser
      (engine.current as unknown as { master: GainNode }).master.connect(a);
      analyser.current = a;
      setOn(true);
    } catch (e) { setErr((e as Error).message); }
  };

  useEffect(() => () => { engine.current?.stop(); }, []);
  useEffect(() => { engine.current?.setMasterGain(gain); }, [gain]);

  useEffect(() => {
    if (!on) return;
    let raf = 0, last = performance.now(), stepAcc = 0, lastStage = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = (now - last) / 1000; last = now;
      const c = cfg.current;
      const st = stateFor(c.exp);
      const t = engine.current?.update(st, dt);
      if (t) setTel(t);
      const sg = stageOf(fidelityIndex(st));
      if (lastStage && sg !== lastStage) engine.current?.fidelityChime(sg);
      lastStage = sg;
      if (c.walking) {
        stepAcc += dt;
        if (stepAcc > 0.46) { stepAcc = 0; engine.current?.footstep(c.surface); }
      }
      // scope
      const cv = scope.current, an = analyser.current;
      if (cv && an) {
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const r = cv.getBoundingClientRect();
        const w = Math.round(r.width * dpr), h = Math.round(r.height * dpr);
        if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
        const g = cv.getContext("2d")!;
        const buf = new Uint8Array(an.frequencyBinCount);
        an.getByteFrequencyData(buf);
        g.fillStyle = "#06080d"; g.fillRect(0, 0, w, h);
        const bars = 64;
        for (let i = 0; i < bars; i++) {
          const v = buf[Math.floor((i / bars) * buf.length * 0.7)] / 255;
          const bh = Math.pow(v, 0.8) * h;
          g.fillStyle = `hsl(${180 + i * 2.4} 85% ${30 + v * 42}%)`;
          g.fillRect((i / bars) * w, h - bh, w / bars - 1, bh);
        }
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [on]);

  const stage = stageOf(fidelityIndex(stateFor(exp)));

  return (
    <div className="fi-panel border border-line bg-panel">
      <div className="grid lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="border-b border-line p-3 lg:border-r lg:border-b-0">
          <div className="mono mb-1 flex items-center justify-between text-[9px] tracking-[0.18em] text-dim uppercase">
            <span>Spectrum · live AudioContext output</span>
            <span className={on ? "text-vtx" : "text-dim"}>{on ? "● RUNNING" : "○ SUSPENDED"}</span>
          </div>
          <canvas ref={scope} className="w-full border border-line bg-void" style={{ height: 110 }} />

          <div className="mt-3 grid gap-px bg-line sm:grid-cols-2 lg:grid-cols-3">
            {AUDIO_STAGES.map((a) => (
              <div key={a.stage}
                className={cn("bg-panel p-2 transition-colors", stage === a.stage && "bg-panel2")}>
                <div className="mono flex items-baseline justify-between text-[9px]">
                  <span className={cn("font-bold", stage === a.stage ? "fi-accent-text" : "text-dim")}>
                    S{a.stage}
                  </span>
                  <span className="text-chalk/70">{a.sr} · {a.bits}</span>
                </div>
                <p className="mt-1 text-[10px] leading-snug text-dim">{a.detail}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="p-3">
          <button onClick={toggle}
            className={cn("mono w-full border px-3 py-2 text-[10px] font-black tracking-[0.25em] uppercase transition-all active:translate-y-px",
              on ? "border-transparent bg-pxd text-void" : "fi-accent-bg border-transparent text-void")}>
            {on ? "■ stop engine" : "▶ start audio engine"}
          </button>
          {err && <div className="mono mt-2 text-[9px] text-pxd">{err}</div>}
          <p className="mono mt-2 text-[9px] leading-snug text-dim">
            Requires a click (browser autoplay policy). Nothing is downloaded — every sound below
            is synthesised from oscillators and seeded noise at runtime.
          </p>

          <div className="mono mt-3 mb-1 flex justify-between text-[9.5px]">
            <span className="text-dim">Fidelity</span>
            <span className="tnum text-chalk">S{stage} · {Math.pow(10, exp).toExponential(1)}</span>
          </div>
          <input type="range" min={2} max={7.98} step={0.01} value={exp}
            onChange={(e) => setExp(+e.target.value)} className="w-full"
            style={{ ["--thumb" as string]: "var(--fi-accent)" }} />
          <div className="mt-1 grid grid-cols-6 gap-1">
            {[2.2, 3.35, 4.45, 5.5, 6.4, 7.5].map((v, i) => (
              <button key={v} onClick={() => setExp(v)}
                className={cn("mono border py-1 text-[8px] font-bold",
                  stage === i + 1 ? "border-transparent bg-chalk text-void"
                    : "border-line text-dim hover:text-chalk")}>
                S{i + 1}
              </button>
            ))}
          </div>

          <div className="mono mt-3 mb-1 flex justify-between text-[9.5px]">
            <span className="text-dim">Master</span>
            <span className="tnum text-chalk">{(gain * 100) | 0}%</span>
          </div>
          <input type="range" min={0} max={1} step={0.01} value={gain}
            onChange={(e) => setGain(+e.target.value)} className="w-full" />

          <div className="mt-3 flex flex-wrap gap-1">
            {SURFACES.map((s) => (
              <button key={s} onClick={() => { setSurface(s); engine.current?.footstep(s); }}
                className={cn("mono border px-2 py-1 text-[9px]",
                  surface === s ? "border-transparent bg-chalk text-void"
                    : "border-line text-dim hover:text-chalk")}>
                {s}
              </button>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-3 gap-1">
            <button onClick={() => setWalking(!walking)} disabled={!on}
              className={cn("mono border px-2 py-1.5 text-[9px] font-bold disabled:opacity-30",
                walking ? "border-transparent bg-vtx text-void" : "border-line text-dim hover:text-chalk")}>
              {walking ? "■ walking" : "▶ walk"}
            </button>
            <button onClick={() => engine.current?.fidelityChime(stage)} disabled={!on}
              className="mono border border-line px-2 py-1.5 text-[9px] font-bold text-dim hover:text-chalk disabled:opacity-30">
              ♪ chime
            </button>
            <button onClick={() => engine.current?.bandWhoosh(1)} disabled={!on}
              className="mono border border-line px-2 py-1.5 text-[9px] font-bold text-dim hover:text-chalk disabled:opacity-30">
              ≋ whoosh
            </button>
          </div>

          {tel && (
            <div className="mt-3 border-t border-line pt-2">
              {([
                ["sample rate", `${(tel.sampleRate / 1000).toFixed(1)} kHz`, "#ff3d8a"],
                ["bit depth", `${tel.bitDepth}-bit`, "#ff3d8a"],
                ["stereo width", tel.stereoWidth.toFixed(2), "#7cff4d"],
                ["reverb tail", `${tel.reverbSeconds.toFixed(2)} s`, "#ffc13d"],
                ["voices", tel.voices, "#3dc8ff"],
                ["dFi/dt", tel.dFi.toFixed(1), "var(--fi-accent)"],
              ] as const).map(([k, v, c]) => (
                <div key={k} className="mono flex justify-between border-b border-line/40 py-[3px] text-[9.5px] last:border-0">
                  <span className="text-dim">{k}</span>
                  <span className="tnum" style={{ color: c }}>{v}</span>
                </div>
              ))}
              <div className="mono mt-2 text-[8.5px] leading-snug text-dim">
                bus: <span className="text-aq">{tel.busChain.join(" → ")}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
