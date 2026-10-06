import { useEffect, useMemo, useState } from "react";
import {
  GpuComputePipeline, planBuffers, FALLBACK_NOTES, REQUIRED_LIMITS,
  type NegotiationResult, type GPULike,
} from "@/drop/GpuComputePipeline";
import { WGSL_PASSES, WGSL_SOURCES } from "@/drop/SetmixWGSL";
import { cn } from "@/utils/cn";

function hl(src: string) {
  const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
  let o = esc(src);
  o = o.replace(/(\/\/[^\n]*)/g, '<span class="tk-c">$1</span>');
  o = o.replace(
    /\b(fn|let|var|const|struct|return|if|else|for|while|break|continue|@compute|@vertex|@fragment|@group|@binding|@builtin|@location|@workgroup_size|workgroup_size|storage|uniform|read_write|read|atomic|array|vec2|vec3|vec4|mat4x4|f32|u32|i32|bool|select|mix|clamp|floor|fract|length|normalize|dot|max|min|abs|sin|cos|atomicAdd|atomicLoad|atomicStore)\b/g,
    '<span class="tk-k">$1</span>');
  o = o.replace(/\b(\d+\.?\d*[uif]?)\b/g, '<span class="tk-n">$1</span>');
  return o;
}

export default function GpuLab() {
  const [neg, setNeg] = useState<NegotiationResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [force, setForce] = useState<"auto" | "nogpu" | "software">("auto");
  const [dim, setDim] = useState(48);
  const [srcKey, setSrcKey] = useState("WGSL_PASS2_SURFACE");

  const run = async () => {
    setBusy(true);
    let gpu: GPULike | undefined = (navigator as unknown as { gpu?: GPULike }).gpu;
    if (force === "nogpu") gpu = undefined;
    if (force === "software") {
      // simulate a SwiftShader adapter to prove the demotion path fires
      gpu = {
        async requestAdapter() {
          return {
            features: { has: () => false },
            limits: {
              maxStorageBufferBindingSize: 128 * 1048576,
              maxComputeWorkgroupsPerDimension: 65535,
              maxComputeInvocationsPerWorkgroup: 256,
            },
            info: { vendor: "Google", description: "SwiftShader Device (LLVM)" },
            async requestDevice() { throw new Error("unused"); },
          };
        },
      } as GPULike;
    }
    const p = new GpuComputePipeline({
      gpu, hardwareConcurrency: navigator.hardwareConcurrency ?? 4,
    });
    setNeg(await p.init());
    setBusy(false);
  };

  useEffect(() => { run(); /* eslint-disable-next-line */ }, [force]);

  const buffers = useMemo(() => planBuffers(dim), [dim]);
  const wg = Math.ceil(dim / 4);
  const dispatchTotal = wg * wg * wg;

  const BACKEND_COLOUR: Record<string, string> = {
    WEBGPU: "#7cff4d", WEBGL2_WORKER: "#ffc13d", CPU_MAIN: "#ff3d8a",
  };

  return (
    <div className="space-y-3">
      <div className="fi-panel border border-line bg-panel">
        <div className="grid lg:grid-cols-[1fr_1fr]">
          <div className="border-b border-line p-3 lg:border-r lg:border-b-0">
            <div className="mb-2 flex flex-wrap items-center gap-1">
              <span className="mono mr-1 text-[9px] tracking-[0.2em] text-dim uppercase">simulate</span>
              {([["auto", "this device"], ["nogpu", "no WebGPU"], ["software", "SwiftShader"]] as const).map(([k, l]) => (
                <button key={k} onClick={() => setForce(k)}
                  className={cn("mono border px-2 py-1 text-[9px]",
                    force === k ? "border-transparent bg-chalk text-void" : "border-line text-dim hover:text-chalk")}>
                  {l}
                </button>
              ))}
              <button onClick={run} disabled={busy}
                className="mono ml-auto border border-line px-2 py-1 text-[9px] text-dim hover:text-chalk disabled:opacity-40">
                ⟳ re-negotiate
              </button>
            </div>

            {neg && (
              <>
                <div className="fi-panel mb-2 border p-3"
                  style={{ borderColor: BACKEND_COLOUR[neg.backend] + "66", background: BACKEND_COLOUR[neg.backend] + "0d" }}>
                  <div className="mono text-[9px] tracking-[0.25em] text-dim uppercase">selected backend</div>
                  <div className="text-2xl leading-none font-black" style={{ color: BACKEND_COLOUR[neg.backend] }}>
                    {neg.backend}
                  </div>
                  <p className="mt-2 text-[11.5px] leading-snug text-dim">{neg.reason}</p>
                  <div className="mono mt-2 text-[9px] text-dim">
                    adapter: <span className="text-chalk">{neg.adapterInfo}</span> ·{" "}
                    {neg.negotiationMs.toFixed(1)} ms
                  </div>
                </div>

                <div className="mono mb-1 text-[9px] tracking-[0.2em] text-dim uppercase">capability checks</div>
                {neg.checks.map((c) => (
                  <div key={c.id} className="grid grid-cols-[14px_1fr_auto] items-start gap-2 border-b border-line/40 py-[3px]">
                    <span className={cn("mono text-[10px]", c.pass ? "text-vtx" : c.required ? "text-pxd" : "text-dim")}>
                      {c.pass ? "✓" : c.required ? "✕" : "○"}
                    </span>
                    <div>
                      <div className="mono text-[9.5px] text-chalk/90">{c.label}</div>
                      <div className="mono text-[8.5px] text-dim">{c.detail}</div>
                    </div>
                    {!c.required && <span className="mono text-[8px] text-dim/60">optional</span>}
                  </div>
                ))}

                <div className="mt-2 grid grid-cols-2 gap-x-3 border-t border-line pt-2">
                  {([
                    ["zero readback", neg.caps.zeroReadback ? "YES" : "no", neg.caps.zeroReadback ? "#7cff4d" : "#6b7a90"],
                    ["indirect draw", neg.caps.indirectDraw ? "YES" : "no", neg.caps.indirectDraw ? "#7cff4d" : "#6b7a90"],
                    ["max chunk", `${neg.caps.maxChunkDim}³`, undefined],
                    ["workers", neg.caps.workers, undefined],
                  ] as const).map(([k, v, c]) => (
                    <div key={k} className="mono flex justify-between py-[2px] text-[9.5px]">
                      <span className="text-dim">{k}</span>
                      <span className="tnum" style={{ color: c }}>{v}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="p-3">
            <div className="mono mb-1 flex justify-between text-[9.5px]">
              <span className="text-dim">chunk dimension</span>
              <span className="tnum text-chalk">{dim}³ · {((dim + 1) ** 3).toLocaleString()} voxels</span>
            </div>
            <input type="range" min={16} max={64} step={8} value={dim}
              onChange={(e) => setDim(+e.target.value)} className="w-full" />

            <div className="mono mt-3 mb-1 text-[9px] tracking-[0.2em] text-dim uppercase">
              dispatch plan · workgroup 4×4×4
            </div>
            {WGSL_PASSES.map((p, i) => (
              <div key={p.id} className="border-b border-line/40 py-1.5">
                <div className="mono flex items-baseline justify-between text-[9.5px]">
                  <span className="text-chalk">{p.label}</span>
                  <span className="tnum text-dim">
                    {p.id === "indirect_main" ? "1×1×1" : `${wg}×${wg}×${wg}`}
                  </span>
                </div>
                <p className="mt-0.5 text-[10px] leading-snug text-dim">{p.note}</p>
                {i < WGSL_PASSES.length - 1 && (
                  <div className="mono mt-0.5 text-[8px] text-dim/50">
                    writes {p.writes.join(", ")}
                  </div>
                )}
              </div>
            ))}
            <div className="mono mt-2 border border-vtx/40 bg-vtx/5 p-2 text-[9.5px] leading-snug text-vtx">
              {(dispatchTotal * 4 + 1).toLocaleString()} workgroups ·{" "}
              {(dispatchTotal * 64 * 4 + 1).toLocaleString()} invocations · 5 dispatches ·{" "}
              <span className="font-bold">0 mapAsync calls</span>
            </div>

            <div className="mono mt-3 mb-1 text-[9px] tracking-[0.2em] text-dim uppercase">
              buffer pool · allocated once, never per frame
            </div>
            {buffers.plan.map((b) => (
              <div key={b.name} className="mono flex items-baseline justify-between border-b border-line/40 py-[3px] text-[9px]">
                <span className="text-chalk">@binding({b.binding}) {b.name}</span>
                <span className="tnum text-dim">
                  {b.bytes < 1024 ? `${b.bytes} B` : `${(b.bytes / 1048576).toFixed(2)} MB`}
                </span>
              </div>
            ))}
            <div className="mono mt-1 flex justify-between text-[9.5px]">
              <span className="text-dim">total VRAM / chunk</span>
              <span className="tnum fi-accent-text font-bold">{buffers.totalMB.toFixed(2)} MB</span>
            </div>
          </div>
        </div>
      </div>

      {/* WGSL source */}
      <div className="fi-panel border border-line bg-panel">
        <div className="flex flex-wrap items-center gap-1 border-b border-line bg-panel2 p-2">
          {Object.keys(WGSL_SOURCES).map((k) => (
            <button key={k} onClick={() => setSrcKey(k)}
              className={cn("mono border px-2 py-1 text-[9px]",
                srcKey === k ? "border-transparent bg-chalk text-void" : "border-line text-dim hover:text-chalk")}>
              {k.replace("WGSL_", "").toLowerCase()}
            </button>
          ))}
          <span className="mono ml-auto text-[9px] text-dim">
            {WGSL_SOURCES[srcKey].split("\n").length} lines WGSL
          </span>
        </div>
        <div className="max-h-[440px] overflow-auto bg-void">
          <pre className="mono p-3 text-[10.5px] leading-[1.55]">
            <code dangerouslySetInnerHTML={{ __html: hl(WGSL_SOURCES[srcKey]) }} />
          </pre>
        </div>
      </div>

      <div className="fi-panel border border-line bg-panel">
        <div className="mono border-b border-line bg-panel2 px-3 py-2 text-[9px] tracking-[0.2em] text-dim uppercase">
          why the fallback is not a downgrade
        </div>
        <div className="divide-y divide-line/60">
          {FALLBACK_NOTES.map(([k, v], i) => (
            <div key={k} className="grid gap-2 p-3 sm:grid-cols-[210px_1fr]">
              <div className="flex gap-2">
                <span className="mono fi-accent-text text-[10px]">{String(i + 1).padStart(2, "0")}</span>
                <span className="text-[12.5px] leading-tight font-bold">{k}</span>
              </div>
              <p className="text-[12px] leading-relaxed text-dim">{v}</p>
            </div>
          ))}
        </div>
        <div className="border-t border-line p-3">
          <div className="mono text-[9px] tracking-[0.2em] text-dim uppercase">required limits</div>
          <div className="mono mt-1 grid gap-x-4 text-[9.5px] sm:grid-cols-2">
            {Object.entries(REQUIRED_LIMITS).map(([k, v]) => (
              <div key={k} className="flex justify-between py-[2px]">
                <span className="text-dim">{k}</span>
                <span className="tnum text-chalk">
                  {v >= 1048576 ? `${v / 1048576} MB` : v.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
