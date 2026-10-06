import { useMemo, useState } from "react";
import {
  buildManifest, transferPlan, reconstruct, deriveStateHash, encodeDelta,
  decodeDelta, estimateManifestBytes, streamWorld,
  initialStream, FEDERATION_RULES, PHASE_BUDGET_TICKS,
  type PlanetManifest, type StreamState, type GalaxyTransport,
  type MachineRecord, type SpireRecord,
} from "@/drop/galaxy";
import { contentHash } from "@/drop/fidelity";
import { LIBRARY } from "@/engine/setmix/library";
import type { Cartridge } from "@/drop/contracts.setmix";
import { cn } from "@/utils/cn";

const kb = (n: number) => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} kB` : `${(n / 1048576).toFixed(2)} MB`);
const big = (n: number) => n < 1e9 ? `${(n / 1e6).toFixed(1)} MB` : `${(n / 1e9).toFixed(2)} GB`;

function makeWorld(seed: number, nMachines: number, nCarts: number, sculpt: number) {
  let s = seed >>> 0 || 1;
  const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);

  const carts = LIBRARY.slice(0, nCarts) as unknown as Cartridge[];
  const kinds = ["PIXEL_CHIMNEY", "HARMONIC_VIBRATOR", "LUMEN_MAST", "CONDENSATION_TOWER", "RELAY_PYLON", "SOLAR_COLLECTOR"];
  const machines: MachineRecord[] = Array.from({ length: nMachines }, (_, i) => ({
    id: `m${i}`, kind: kinds[Math.floor(rnd() * kinds.length)],
    pos: [Math.round((rnd() - 0.5) * 3000), Math.round((rnd() - 0.5) * 3000)] as const,
    tier: Math.floor(rnd() * 4), cartridgeHash: rnd() > 0.6 ? carts[Math.floor(rnd() * carts.length)]?.hash ?? null : null,
    overclock: 1,
  }));
  const spires: SpireRecord[] = Array.from({ length: Math.max(1, Math.floor(nMachines / 9)) }, (_, i) => ({
    id: `s${i}`, pos: [Math.round((rnd() - 0.5) * 2400), Math.round((rnd() - 0.5) * 2400)] as const,
    tier: 1 + Math.floor(rnd() * 3), bandwidth: 32 + Math.floor(rnd() * 160),
    slots: [carts[0]?.hash ?? null, rnd() > 0.5 ? carts[1]?.hash ?? null : null, null],
    dispatchedAtTick: Math.floor(rnd() * 1e6),
  }));

  // sculpted chunks: large smooth regions, which is why RLE wins
  const deltas = new Map<string, Int8Array>();
  for (let i = 0; i < sculpt; i++) {
    const arr = new Int8Array(1024);
    let v = Math.floor((rnd() - 0.5) * 60);
    for (let j = 0; j < arr.length; j++) {
      if (rnd() > 0.96) v = Math.floor((rnd() - 0.5) * 60);
      arr[j] = v;
    }
    deltas.set(`c_${Math.floor(rnd() * 90)}_${Math.floor(rnd() * 90)}`, arr);
  }
  const terrainDelta = encodeDelta(deltas);

  const manifest = buildManifest({
    name: "Kepler-7b",
    seed,
    fidelity: { pxd: 1.1e8, vtx: 8.2e7, lx: 5.9e7, aq: 3.6e7, tick: 1_728_000 },
    author: { handle: "@dr.vex", pubkey: "ed25519:9c1ef0…" },
    cartridges: carts,
    machines, spires, terrainDelta,
    journal: { hash: contentHash([seed, nMachines, sculpt]), commandCount: 41_882, tick: 1_728_000 },
    stats: { playHours: 46.2, fusionsDiscovered: 37, visitors: 128 },
    sign: (p) => `ed25519:${contentHash(["sig", p]).slice(2)}`,
  });

  return { manifest, carts, deltas, terrainDelta };
}

export default function GalaxyLab() {
  const [seed, setSeed] = useState(70801);
  const [nMachines, setNMachines] = useState(64);
  const [nCarts, setNCarts] = useState(6);
  const [sculpt, setSculpt] = useState(14);
  const [cachedCount, setCachedCount] = useState(2);
  const [stream, setStream] = useState<StreamState>(initialStream());
  const [busy, setBusy] = useState(false);
  const [tamper, setTamper] = useState(false);

  const world = useMemo(() => makeWorld(seed, nMachines, nCarts, sculpt), [seed, nMachines, nCarts, sculpt]);
  const cached = useMemo(
    () => new Set(world.manifest.cartridges.slice(0, cachedCount).map((c) => c.hash)),
    [world, cachedCount],
  );
  const plan = useMemo(() => transferPlan(world.manifest, cached), [world, cached]);

  const rebuilt = useMemo(() => {
    const map = new Map(world.carts.map((c) => [c.hash, c]));
    return reconstruct(world.manifest, map);
  }, [world]);

  const roundTrip = useMemo(() => {
    const decoded = decodeDelta(world.terrainDelta);
    let ok = decoded.size === world.deltas.size;
    for (const [k, v] of world.deltas) {
      const d = decoded.get(k);
      if (!d || d.length !== v.length) { ok = false; break; }
      for (let i = 0; i < v.length; i++) if (d[i] !== v[i]) { ok = false; break; }
      if (!ok) break;
    }
    const raw = [...world.deltas.values()].reduce((a, v) => a + v.length, 0);
    return { ok, raw, packed: world.terrainDelta.rawBytes, ratio: raw / Math.max(1, world.terrainDelta.rawBytes) };
  }, [world]);

  const run = async () => {
    setBusy(true);
    const m: PlanetManifest = tamper
      ? { ...world.manifest, fidelity: { ...world.manifest.fidelity, pxd: 9.9e9 } }
      : world.manifest;
    const transport: GalaxyTransport = {
      getManifest: async (_id) => { await wait(140); return m; },
      getCartridge: async (h) => { await wait(60); return world.carts.find((c) => c.hash === h)!; },
      getDelta: async () => { await wait(90); return world.terrainDelta; },
      verify: () => true,
    };
    await streamWorld(world.manifest.id, transport, cached, setStream);
    setBusy(false);
  };
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const PHASES: StreamState["phase"][] = [
    "RESOLVING", "FETCH_MANIFEST", "VERIFY_SIGNATURE", "FETCH_CARTRIDGES",
    "FETCH_DELTA", "RECONSTRUCT", "WARM_CHUNKS", "READY",
  ];
  const phaseIdx = PHASES.indexOf(stream.phase);
  const budget = PHASES.reduce((a, p) => a + PHASE_BUDGET_TICKS[p], 0);

  return (
    <div className="space-y-3">
      <div className="fi-panel border border-line bg-panel">
        <div className="grid lg:grid-cols-[300px_minmax(0,1fr)]">
          <div className="border-b border-line p-3 lg:border-r lg:border-b-0">
            <div className="mono mb-2 text-[9px] tracking-[0.2em] text-dim uppercase">World generator</div>
            {([
              ["seed", seed, 1, 99999, 1, setSeed],
              ["machines", nMachines, 4, 240, 1, setNMachines],
              ["cartridges", nCarts, 1, 12, 1, setNCarts],
              ["sculpted chunks", sculpt, 0, 80, 1, setSculpt],
              ["already cached", cachedCount, 0, Math.min(nCarts, 12), 1, setCachedCount],
            ] as const).map(([k, v, mn, mx, st, set]) => (
              <div key={k} className="mb-1.5">
                <div className="mono flex justify-between text-[9.5px]">
                  <span className="text-dim">{k}</span>
                  <span className="tnum text-chalk">{v}</span>
                </div>
                <input type="range" min={mn} max={mx} step={st} value={v}
                  onChange={(e) => (set as (n: number) => void)(+e.target.value)} className="w-full" />
              </div>
            ))}

            <div className="mt-3 border-t border-line pt-2">
              <div className="mono mb-1 text-[9px] tracking-[0.2em] text-dim uppercase">On the wire</div>
              {([
                ["manifest", kb(plan.manifestBytes), "#e8eef7"],
                [`cartridges ×${plan.cartridgesNeeded}`, kb(plan.cartridgeBytes), "#b46bff"],
                ["terrain delta", kb(plan.deltaBytes), "#7cff4d"],
                ["TOTAL", kb(plan.total), "var(--fi-accent)"],
              ] as const).map(([k, v, c]) => (
                <div key={k} className="mono flex justify-between border-b border-line/40 py-[3px] text-[9.5px] last:border-0">
                  <span className="text-dim">{k}</span>
                  <span className="tnum font-bold" style={{ color: c }}>{v}</span>
                </div>
              ))}
              <div className="mono mt-2 border border-vtx/40 bg-vtx/5 p-2 text-[9.5px] leading-snug">
                <div className="text-dim">naive voxel shipment</div>
                <div className="text-pxd text-[13px] font-black">{big(plan.naiveVoxelBytes)}</div>
                <div className="mt-1 text-vtx">
                  {plan.compressionRatio.toLocaleString(undefined, { maximumFractionDigits: 0 })}× smaller —
                  because the planet is <em className="not-italic">derived</em>, not transferred.
                </div>
              </div>
            </div>
          </div>

          <div className="p-3">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <button onClick={run} disabled={busy}
                className="mono fi-accent-bg px-3 py-1.5 text-[10px] font-black tracking-[0.2em] text-void uppercase disabled:opacity-50">
                {busy ? "streaming…" : "▶ step through the arch"}
              </button>
              <button onClick={() => setTamper(!tamper)}
                className={cn("mono border px-2 py-1.5 text-[9px] font-bold uppercase",
                  tamper ? "border-transparent bg-pxd text-void" : "border-line text-dim hover:text-chalk")}>
                ☣ tamper with the manifest
              </button>
              <span className="mono ml-auto text-[9px] text-dim">
                budget {budget} ticks ≈ {(budget / 120).toFixed(1)} s of approach
              </span>
            </div>

            <div className="grid grid-cols-4 gap-px bg-line sm:grid-cols-8">
              {PHASES.map((p, i) => (
                <div key={p}
                  className={cn("bg-panel p-1.5 transition-colors",
                    stream.phase === p && "bg-panel2",
                    phaseIdx > i && "bg-vtx/10")}>
                  <div className={cn("mono text-[7.5px] leading-tight tracking-wider",
                    stream.phase === p ? "fi-accent-text font-bold"
                      : phaseIdx > i ? "text-vtx" : "text-dim/60")}>
                    {phaseIdx > i ? "✓ " : ""}{p.replace("_", " ")}
                  </div>
                  <div className="mono text-[7px] text-dim/50">{PHASE_BUDGET_TICKS[p]}t</div>
                </div>
              ))}
            </div>

            {stream.phase === "FAILED" && (
              <div className="mono mt-2 border border-pxd bg-pxd/10 p-2 text-[10px] text-pxd">
                ✕ {stream.error}
                <div className="mt-1 text-[9px] text-dim">
                  The manifest id IS the hash of its body. A tampered world cannot be walked into,
                  and no server was needed to detect it.
                </div>
              </div>
            )}
            {stream.phase === "READY" && (
              <div className="mono mt-2 border border-vtx bg-vtx/10 p-2 text-[10px] text-vtx">
                ✓ world ready · {kb(stream.bytesReceived)} received ·{" "}
                {stream.cartridgesReceived}/{stream.cartridgesTotal} cartridges fetched ·{" "}
                {stream.chunksWarmed} chunks derived, 0 downloaded
              </div>
            )}

            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <div>
                <div className="mono mb-1 text-[9px] tracking-[0.2em] text-dim uppercase">Reconstruction</div>
                {([
                  ["state hash", rebuilt.stateHash, "#b46bff"],
                  ["manifest hash", deriveStateHash(world.manifest), "#b46bff"],
                  ["match", rebuilt.matchesManifest ? "DETERMINISTIC ✓" : "SKEW → replay journal",
                    rebuilt.matchesManifest ? "#7cff4d" : "#ffc13d"],
                  ["chunks derived", rebuilt.chunksDerived.toLocaleString(), "#7cff4d"],
                  ["bytes avoided", big(rebuilt.bytesAvoided), "var(--fi-accent)"],
                ] as const).map(([k, v, c]) => (
                  <div key={k} className="mono flex justify-between border-b border-line/40 py-[3px] text-[9px] last:border-0">
                    <span className="text-dim">{k}</span>
                    <span className="tnum truncate pl-2" style={{ color: c }}>{v}</span>
                  </div>
                ))}
              </div>
              <div>
                <div className="mono mb-1 text-[9px] tracking-[0.2em] text-dim uppercase">RLE delta codec</div>
                {([
                  ["raw SDF bytes", kb(roundTrip.raw), undefined],
                  ["encoded", kb(roundTrip.packed), "#7cff4d"],
                  ["ratio", `${roundTrip.ratio.toFixed(1)}×`, "#7cff4d"],
                  ["round trip", roundTrip.ok ? "LOSSLESS ✓" : "MISMATCH ✕",
                    roundTrip.ok ? "#7cff4d" : "#ff3d8a"],
                  ["touched chunks", world.terrainDelta.touchedChunks, undefined],
                  ["quantum", `${world.terrainDelta.quantum} m`, undefined],
                ] as const).map(([k, v, c]) => (
                  <div key={k} className="mono flex justify-between border-b border-line/40 py-[3px] text-[9px] last:border-0">
                    <span className="text-dim">{k}</span>
                    <span className="tnum" style={{ color: c }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>

            <details className="mt-3">
              <summary className="mono cursor-pointer text-[9.5px] tracking-[0.18em] text-dim uppercase hover:text-chalk">
                ▸ {world.manifest.name}.galaxy.json ({kb(estimateManifestBytes(world.manifest))})
              </summary>
              <pre className="mono mt-1 max-h-[260px] overflow-auto border border-line bg-void2 p-2 text-[9px] leading-snug text-chalk/85">
                {JSON.stringify({
                  ...world.manifest,
                  machines: world.manifest.machines.slice(0, 3)
                    .concat([{ id: `… ${world.manifest.machines.length - 3} more`, kind: "", pos: [0, 0], tier: 0, cartridgeHash: null, overclock: 1 }]),
                  terrainDelta: {
                    ...world.manifest.terrainDelta,
                    chunks: Object.fromEntries(Object.entries(world.manifest.terrainDelta.chunks)
                      .slice(0, 2).map(([k, v]) => [k, v.slice(0, 48) + "…"])),
                  },
                }, null, 1)}
              </pre>
            </details>
          </div>
        </div>
      </div>

      <div className="fi-panel border border-line bg-panel">
        <div className="mono border-b border-line bg-panel2 px-3 py-2 text-[9px] tracking-[0.2em] text-dim uppercase">
          Federation policy · why a serverless galaxy is safe to walk into
        </div>
        <div className="divide-y divide-line/60">
          {FEDERATION_RULES.map(([k, v], i) => (
            <div key={k} className="grid gap-2 p-3 sm:grid-cols-[230px_1fr]">
              <div className="flex gap-2">
                <span className="mono fi-accent-text text-[10px]">{String(i + 1).padStart(2, "0")}</span>
                <span className="text-[12.5px] leading-tight font-bold">{k}</span>
              </div>
              <p className="text-[12px] leading-relaxed text-dim">{v}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
