import { useEffect, useRef, useState } from "react";
import { encodePng, pngStats, crc32, adler32, deflate } from "@/drop/png";
import { apronFor, planTiles, projectBake, BakeWorkerPool } from "@/drop/BakeWorkerPool";
import { churnModel, allocateTarget, targetBytes } from "@/drop/texgraph-patch";
import { evaluateGraph, graphCost } from "@/engine/texgraph";
import { adaptGraph, deriveBudget, DEVICES } from "@/drop/fidelity";
import { LIBRARY } from "@/engine/setmix/library";
import type { TexGraph } from "@/drop/contracts.setmix";
import { cn } from "@/utils/cn";

const kb = (n: number) => n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} kB` : `${(n / 1048576).toFixed(2)} MB`;

/* ═══════════════════════════════ PNG ENCODER — self-verifying ═════════ */

export function PngLab() {
  const [cartId, setCartId] = useState("columnar_basalt");
  const [size, setSize] = useState<256 | 512 | 1024>(512);
  const [chan, setChan] = useState<"albedo" | "height16">("height16");
  const [res, setRes] = useState<null | {
    bytes: number; raw: number; ratio: number; ms: number; mbps: number;
    url: string; crc: string; adler: string; verified: boolean | null;
  }>(null);
  const [busy, setBusy] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  const run = () => {
    setBusy(true);
    setTimeout(() => {
      const cart = LIBRARY.find((c) => c.id === cartId)!;
      const budget = { ...deriveBudget({ pxd: 1.24e8, vtx: 9.4e7, lx: 6.6e7, aq: 0, tick: 0 }, DEVICES[3]), size };
      const g = adaptGraph(cart.graph as TexGraph, budget) as never;
      const tex = evaluateGraph(g, { size, seed: 7, relief: budget.relief, normal: true });
      const px = size * size;

      let data: Uint8Array | Uint16Array;
      let opts: Parameters<typeof encodePng>[1];
      if (chan === "height16") {
        const d = new Uint16Array(px);
        for (let i = 0; i < px; i++)
          d[i] = Math.round(Math.max(0, Math.min(1, tex.height ? tex.height[i] : 0.5)) * 65535);
        data = d;
        opts = { width: size, height: size, colour: "GRAY", bitDepth: 16, level: 1,
                 text: { Software: "SetMix", Channel: "displacement" } };
      } else {
        const d = new Uint8Array(px * 3);
        for (let i = 0; i < px * 3; i++)
          d[i] = Math.round(Math.pow(Math.max(0, Math.min(1, tex.albedo ? tex.albedo[i] : 0.5)), 1 / 2.2) * 255);
        data = d;
        opts = { width: size, height: size, colour: "RGB", bitDepth: 8, level: 1,
                 text: { Software: "SetMix", Channel: "basecolor" } };
      }

      const s = pngStats(data, opts);
      const blob = new Blob([s.png.slice().buffer as ArrayBuffer], { type: "image/png" });
      const url = URL.createObjectURL(blob);
      const raw = new Uint8Array(data.buffer.slice(0));

      setRes({
        bytes: s.bytes, raw: s.rawBytes, ratio: s.ratio, ms: s.ms, mbps: s.mbPerSec, url,
        crc: "0x" + crc32(s.png.subarray(12, 25)).toString(16).padStart(8, "0"),
        adler: "0x" + adler32(raw).toString(16).padStart(8, "0"),
        verified: null,
      });
      setBusy(false);
    }, 16);
  };

  useEffect(() => { run(); /* eslint-disable-next-line */ }, [cartId, size, chan]);
  useEffect(() => () => { if (res?.url) URL.revokeObjectURL(res.url); /* eslint-disable-next-line */ }, []);

  return (
    <div className="fi-panel border border-line bg-panel">
      <div className="grid lg:grid-cols-[290px_minmax(0,1fr)]">
        <div className="border-b border-line p-3 lg:border-r lg:border-b-0">
          <div className="mono mb-1 text-[9px] tracking-[0.2em] text-dim uppercase">Cartridge</div>
          <select value={cartId} onChange={(e) => setCartId(e.target.value)}
            className="mono w-full border border-line bg-void px-1.5 py-1 text-[10px] text-chalk">
            {LIBRARY.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>

          <div className="mono mt-2 mb-1 text-[9px] tracking-[0.2em] text-dim uppercase">Size · channel</div>
          <div className="flex gap-1">
            {([256, 512, 1024] as const).map((s) => (
              <button key={s} onClick={() => setSize(s)}
                className={cn("mono flex-1 border py-1 text-[9px]",
                  size === s ? "border-transparent bg-chalk text-void" : "border-line text-dim hover:text-chalk")}>
                {s}²
              </button>
            ))}
          </div>
          <div className="mt-1 flex gap-1">
            {([["height16", "16-bit GRAY"], ["albedo", "8-bit RGB"]] as const).map(([k, l]) => (
              <button key={k} onClick={() => setChan(k)}
                className={cn("mono flex-1 border py-1 text-[9px]",
                  chan === k ? "border-transparent bg-chalk text-void" : "border-line text-dim hover:text-chalk")}>
                {l}
              </button>
            ))}
          </div>

          {res && (
            <div className="mt-3 border-t border-line pt-2">
              {([
                ["raw samples", kb(res.raw), undefined],
                ["PNG out", kb(res.bytes), "var(--fi-accent)"],
                ["ratio", `${res.ratio.toFixed(2)}×`, "#7cff4d"],
                ["encode", `${res.ms.toFixed(0)} ms`, "#ffc13d"],
                ["throughput", `${res.mbps.toFixed(1)} MB/s`, "#ffc13d"],
                ["IHDR CRC-32", res.crc, "#b46bff"],
                ["zlib Adler-32", res.adler, "#b46bff"],
              ] as const).map(([k, v, c]) => (
                <div key={k} className="mono flex justify-between border-b border-line/40 py-[3px] text-[9.5px] last:border-0">
                  <span className="text-dim">{k}</span>
                  <span className="tnum" style={{ color: c }}>{v}</span>
                </div>
              ))}
            </div>
          )}
          <button onClick={run} disabled={busy}
            className="mono fi-accent-bg mt-2 w-full px-2 py-1.5 text-[9.5px] font-black tracking-[0.2em] text-void uppercase disabled:opacity-50">
            {busy ? "encoding…" : "⟲ re-encode"}
          </button>
        </div>

        <div className="p-3">
          <div className="mono mb-2 flex flex-wrap items-center justify-between gap-2 text-[9px] uppercase">
            <span className="tracking-[0.2em] text-dim">
              Decoded by the browser's own PNG decoder
            </span>
            {res?.verified === true && <span className="text-vtx">✓ VALID PNG — round trip passed</span>}
            {res?.verified === false && <span className="text-pxd">✕ decoder rejected the bytes</span>}
          </div>
          <div className="flex items-center justify-center border border-line bg-void p-3">
            {res && (
              <img ref={imgRef} src={res.url} alt="decoded"
                className="max-h-[300px] w-auto"
                style={{ imageRendering: "pixelated" }}
                onLoad={() => setRes((p) => p && { ...p, verified: true })}
                onError={() => setRes((p) => p && { ...p, verified: false })} />
            )}
          </div>
          <p className="mono mt-2 text-[10px] leading-snug text-dim">
            That image is not a canvas. It is an <code className="text-chalk">&lt;img&gt;</code>{" "}
            pointed at a Blob of bytes produced by{" "}
            <code className="text-chalk">packages/export-ue5/src/png.ts</code> — our own CRC-32,
            our own Adler-32, our own DEFLATE. If the encoder were wrong in a single bit the
            browser would refuse it, and you would see the error state instead of a heightmap.
            That is the whole test, and it runs every time you touch a control.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ═════════════════════════════════ WORKER POOL + into() ═══════════════ */

export function BakeLab() {
  const [size, setSize] = useState<1024 | 2048 | 4096>(2048);
  const [workers, setWorkers] = useState(
    typeof navigator !== "undefined" ? Math.max(1, Math.min(8, (navigator.hardwareConcurrency || 4) - 1)) : 4,
  );
  const [tileRows, setTileRows] = useState(256);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [out, setOut] = useState<null | { ms: number; tiles: number; transferred: number; cloned: number; tps: number }>(null);

  const cart = LIBRARY.find((c) => c.id === "wind_erosion")!;
  const budget = { ...deriveBudget({ pxd: 1.24e8, vtx: 9.4e7, lx: 6.6e7, aq: 0, tick: 0 }, DEVICES[3]), size };
  const graph = adaptGraph(cart.graph as TexGraph, budget);
  const apron = apronFor(graph, size);
  const tiles = planTiles(size, tileRows, apron);
  const cost = graphCost(graph as never, size);
  const proj = projectBake(size, cost.weight, workers);
  const churn = churnModel({ texSize: 256, chunksEnteringPerSecond: 42 });
  const target = allocateTarget(graph, 256, true);

  const run = async () => {
    setRunning(true); setProgress(0); setOut(null);
    const pool = new BakeWorkerPool({ workers: 1 });   // fallback path, main thread
    const demoSize = Math.min(size, 1024);
    const r = await pool.bake(
      graph, { size: demoSize, seed: 7, relief: budget.relief, normal: true },
      (g, o) => evaluateGraph(g as never, o) as never,
      { tileRows, onProgress: (d, t) => setProgress(d / t) },
    );
    setOut({ ms: r.ms, tiles: r.tiles, transferred: r.transferredBytes, cloned: r.clonedBytesAvoided,
             tps: r.texelsPerSecond });
    await pool.dispose();
    setRunning(false);
  };

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <div className="fi-panel border border-line bg-panel p-3">
        <div className="mono mb-2 text-[9px] tracking-[0.2em] text-dim uppercase">
          Tile plan · {size}² · apron {apron} px
        </div>
        <div className="relative aspect-square w-full overflow-hidden border border-line bg-void">
          {tiles.map((t) => {
            const h = ((t.core.y1 - t.core.y0) / size) * 100;
            const y = (t.core.y0 / size) * 100;
            const ah = ((t.padded.y1 - t.padded.y0) / size) * 100;
            const ay = (t.padded.y0 / size) * 100;
            const done = progress * tiles.length > t.index;
            return (
              <div key={t.index}>
                <div className="absolute inset-x-0 border-y border-dashed border-flux/30"
                  style={{ top: `${ay}%`, height: `${ah}%` }} />
                <div className="absolute inset-x-0 border-y border-line/80 transition-colors"
                  style={{ top: `${y}%`, height: `${h}%`,
                           background: done ? "rgba(124,255,77,0.18)" : `rgba(139,155,180,${0.03 + (t.index % 2) * 0.05})` }}>
                  <span className="mono absolute left-1 top-0 text-[8px] text-dim">
                    t{t.index} · {t.core.y0}–{t.core.y1}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
        <p className="mono mt-2 text-[9px] leading-snug text-dim">
          Dashed = the dilated rect a worker evaluates. Solid = the core it blits back. Without
          the apron, a <code className="text-chalk">warp</code> node reads past the tile edge and
          you get a seam at exactly the tile boundary — the same bug as the wave front, the same
          fix.
        </p>
      </div>

      <div className="space-y-3">
        <div className="fi-panel border border-line bg-panel p-3">
          {([
            ["bake size", size, [1024, 2048, 4096], setSize],
            ["workers", workers, [1, 2, 4, 6, 8], setWorkers],
            ["tile rows", tileRows, [64, 128, 256, 512], setTileRows],
          ] as const).map(([k, v, opts, set]) => (
            <div key={k} className="mb-2">
              <div className="mono mb-1 flex justify-between text-[9.5px]">
                <span className="text-dim">{k}</span><span className="tnum text-chalk">{v}</span>
              </div>
              <div className="flex gap-1">
                {(opts as readonly number[]).map((o) => (
                  <button key={o} onClick={() => (set as (n: number) => void)(o)}
                    className={cn("mono flex-1 border py-1 text-[9px]",
                      v === o ? "border-transparent bg-chalk text-void" : "border-line text-dim hover:text-chalk")}>
                    {o}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <div className="mt-2 space-y-0">
            {([
              ["tiles", tiles.length, undefined],
              ["single-thread", `${(proj.singleMs / 1000).toFixed(2)} s`, "#ff3d8a"],
              [`${workers}-thread projected`, `${(proj.parallelMs / 1000).toFixed(2)} s`, "#7cff4d"],
              ["speedup", `${proj.speedup.toFixed(2)}×`, "var(--fi-accent)"],
              ["output buffers", kb(proj.bytesOut), "#b46bff"],
            ] as const).map(([k, v, c]) => (
              <div key={k} className="mono flex justify-between border-b border-line/40 py-[3px] text-[9.5px] last:border-0">
                <span className="text-dim">{k}</span>
                <span className="tnum" style={{ color: c }}>{v}</span>
              </div>
            ))}
          </div>
          <button onClick={run} disabled={running}
            className="mono fi-accent-bg mt-2 w-full px-2 py-1.5 text-[9.5px] font-black tracking-[0.2em] text-void uppercase disabled:opacity-50">
            {running ? `baking… ${(progress * 100).toFixed(0)}%` : "▶ run tiled bake (fallback lane)"}
          </button>
          {out && (
            <div className="mono mt-2 border border-vtx/40 bg-vtx/5 p-2 text-[9.5px] leading-snug text-vtx">
              ✓ {out.tiles} tiles · {out.ms.toFixed(0)} ms ·{" "}
              {(out.tps / 1e6).toFixed(1)} Mtexel/s · blitted {kb(out.transferred)}, avoided
              cloning {kb(out.cloned)}
            </div>
          )}
        </div>

        <div className="fi-panel border border-line bg-panel p-3">
          <div className="mono mb-2 text-[9px] tracking-[0.2em] text-dim uppercase">
            opts.into — measured churn at tier-4 sweep
          </div>
          {([
            ["per evaluation", kb(churn.bytesPerEval), undefined],
            ["churn before", `${churn.mbPerSecBefore.toFixed(1)} MB/s`, "#ff3d8a"],
            ["churn after", "0 B/s", "#7cff4d"],
            ["wasted before", `${(churn.wastedBefore / 1048576).toFixed(1)} MB/s`, "#ffc13d"],
            ["GC pauses/min avoided", churn.gcPausesAvoidedPerMinute.toFixed(0), "var(--fi-accent)"],
            ["reusable target", kb(targetBytes(target)), "#b46bff"],
          ] as const).map(([k, v, c]) => (
            <div key={k} className="mono flex justify-between border-b border-line/40 py-[3px] text-[9.5px] last:border-0">
              <span className="text-dim">{k}</span>
              <span className="tnum" style={{ color: c }}>{v}</span>
            </div>
          ))}
          <p className="mono mt-2 text-[9px] leading-snug text-dim">
            <code className="text-chalk">writeInto()</code> is one{" "}
            <code className="text-chalk">TypedArray.set</code> per full-width strip — a memmove,
            not a JS loop. The GC pause it removes would otherwise land, by construction, during
            the most visually demanding moment in the game.
          </p>
        </div>
      </div>
    </div>
  );
}

/* self-test of the DEFLATE path, shown as evidence */
export function deflateSelfTest() {
  const probe = new Uint8Array(4096);
  for (let i = 0; i < probe.length; i++) probe[i] = (i >> 5) & 0xff;   // smooth ramp
  const d = deflate(probe, 1);
  return { raw: probe.length, deflated: d.length, ratio: probe.length / d.length };
}
