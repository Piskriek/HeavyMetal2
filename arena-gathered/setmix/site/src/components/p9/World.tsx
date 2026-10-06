import { useEffect, useMemo, useRef, useState } from "react";
import {
  SpireLattice, makeGlobal, addGlobal, deltaGlobal,
  initialOrigin, rebaseOrigin, precisionReport, latticeStats,
  advectSpore, germinationChance, SECTOR_M, SECTORS_AROUND,
  type Spire, type GlobalPos, type OriginState, type Spore, type WindField,
} from "@/drop/enclaves";
import {
  buildContinent, sizeContinent, PRESENCE, tierFor, bandwidthFor,
  initialBus, advanceBus, receiveInput, defaultWeather, sampleRain,
  FEDERATION_GUARANTEES, MAX_ROLLBACK,
  type NetBusState, type InputFrame,
} from "@/drop/federation";
import { hash2i } from "@/drop/flora";
import { cn } from "@/utils/cn";

const AUTHORS = [
  { handle: "@dr.vex", tint: "#b46bff", cart: "neon_mycelial_forest", hash: "0x9c1ef0a2" },
  { handle: "@piskriek", tint: "#ff8a3d", cart: "carved_basalt_canyon", hash: "0x4a7b21ce" },
  { handle: "@lumenwright", tint: "#3dc8ff", cart: "caustic_lagoon_shelf", hash: "0x7f03bb19" },
  { handle: "@terra.k", tint: "#7cff4d", cart: "handpainted_prairie", hash: "0x2d6e4471" },
  { handle: "@obsid", tint: "#ff3d8a", cart: "shatterglass_flats", hash: "0xe1aa0c35" },
];

/* ════════════════════════════════════════════════ ENCLAVE DEMO ══ */

export function EnclaveDemo() {
  const ref = useRef<HTMLCanvasElement>(null);
  const [sigma, setSigma] = useState(1400);
  const [nSpires, setNSpires] = useState(14);
  const [showPurity, setShowPurity] = useState(false);
  const [spores, setSpores] = useState(true);
  const [travelKm, setTravelKm] = useState(0);
  const [hud, setHud] = useState({ rebases: 0, ulp: 0, contributors: 0, purity: 1, germ: 0 });

  const cfg = useRef({ sigma, nSpires, showPurity, spores });
  cfg.current = { sigma, nSpires, showPurity, spores };

  const spires = useMemo<Spire[]>(() => {
    const out: Spire[] = [];
    for (let i = 0; i < nSpires; i++) {
      const a = AUTHORS[i % AUTHORS.length];
      const ang = (i / nSpires) * Math.PI * 2 + hash2i(i, 7) * 1.4;
      const rad = 1200 + hash2i(i, 3) * 4200;
      out.push({
        id: `sp${i}`, author: a.handle,
        pos: makeGlobal(Math.cos(ang) * rad, 0, Math.sin(ang) * rad),
        cartridgeHash: a.hash, label: a.cart, tint: a.tint,
        sigmaM: sigma * (0.6 + hash2i(i, 11) * 0.8),
        dominance: 0.7 + hash2i(i, 13) * 0.6,
        tier: 1 + (i % 4), dispatchedAtTick: i * 9000,
      });
    }
    return out;
  }, [nSpires, sigma]);

  const lattice = useMemo(() => {
    const L = new SpireLattice(SECTOR_M);
    for (const s of spires) L.insert(s);
    return L;
  }, [spires]);

  const stats = useMemo(() => latticeStats(spires, []), [spires]);
  const precision = useMemo(() => precisionReport(travelKm * 1000), [travelKm]);

  useEffect(() => {
    const cv = ref.current!;
    let origin: OriginState = initialOrigin(makeGlobal(0, 0, 0), 1024);
    let cam: GlobalPos = makeGlobal(0, 0, 0);
    let raf = 0, last = performance.now(), t = 0;
    let sporeList: Spore[] = [];
    const wind: WindField = { bearing: 0.7, speedMs: 420, turbulence: 0.5 };

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const c = cfg.current;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now; t += dt;

      cam = addGlobal(cam, Math.cos(t * 0.21) * 260 * dt, 0, Math.sin(t * 0.17) * 260 * dt);
      const rb = rebaseOrigin(origin, cam);
      origin = rb.state;

      // spores ride the wind across borders
      if (c.spores) {
        if (sporeList.length < 90 && Math.floor(t * 6) % 2 === 0) {
          const s = spires[Math.floor(hash2i(Math.floor(t * 31), 5) * spires.length)];
          if (s) sporeList.push({
            cartridgeHash: s.cartridgeHash, originSpireId: s.id,
            from: s.pos, travelled: 0, viability: 1,
          });
        }
        sporeList = sporeList
          .map((s, i) => advectSpore(s, wind, dt, hash2i(i, Math.floor(t * 9))))
          .filter((s) => s.viability > 0.08);
      } else sporeList = [];

      /* ---------- render ---------- */
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const r = cv.getBoundingClientRect();
      const W = Math.round(r.width * dpr), H = Math.round(r.height * dpr);
      if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
      const g = cv.getContext("2d")!;
      const VIEW = 14000;
      const SX = (wx: number) => W / 2 + (wx / VIEW) * W;
      const SZ = (wz: number) => H / 2 + (wz / VIEW) * W;

      g.fillStyle = "#05070c"; g.fillRect(0, 0, W, H);

      /* partition-of-unity field, sampled on a coarse grid */
      const N = 72;
      const cw = W / N + 1;
      for (let j = 0; j < N; j++)
        for (let i = 0; i < N; i++) {
          const wx = -VIEW / 2 + (i / N) * VIEW;
          const wz = -VIEW / 2 + (j / N) * VIEW * (H / W);
          const p = makeGlobal(wx, 0, wz);
          const b = lattice.sample(p);
          if (!b.weights.length) continue;
          if (c.showPurity) {
            // contested borders glow — the places two authors meet
            const contest = 1 - b.purity;
            g.fillStyle = `rgba(255,255,255,${contest * 0.85})`;
          } else {
            g.fillStyle = `rgb(${b.tint[0] * 255 | 0},${b.tint[1] * 255 | 0},${b.tint[2] * 255 | 0})`;
          }
          g.fillRect(SX(wx), SZ(wz), cw, (H / N) + 1);
        }

      /* spire envelopes */
      for (const s of spires) {
        const d = deltaGlobal(makeGlobal(0, 0, 0), s.pos);
        const x = SX(d[0]), z = SZ(d[2]);
        g.strokeStyle = `${s.tint}66`; g.lineWidth = dpr;
        for (const k of [1, 2]) {
          g.beginPath(); g.arc(x, z, (s.sigmaM * k / VIEW) * W, 0, 6.283); g.stroke();
        }
        g.fillStyle = s.tint;
        g.fillRect(x - 3 * dpr, z - 3 * dpr, 6 * dpr, 6 * dpr);
        g.font = `${8 * dpr}px ui-monospace, monospace`;
        g.fillStyle = "#c8d4e4";
        g.fillText(s.author, x + 6 * dpr, z + 3 * dpr);
      }

      /* spores */
      let germSum = 0;
      for (const s of sporeList) {
        const d = deltaGlobal(makeGlobal(0, 0, 0), s.from);
        const gch = germinationChance(s, lattice, 0.6);
        germSum += gch;
        g.fillStyle = `rgba(255,255,255,${s.viability * 0.8})`;
        g.fillRect(SX(d[0]) - 1.2 * dpr, SZ(d[2]) - 1.2 * dpr, 2.4 * dpr, 2.4 * dpr);
      }

      /* camera + floating origin marker */
      const cd = deltaGlobal(makeGlobal(0, 0, 0), cam);
      g.strokeStyle = "#ffffff"; g.lineWidth = 1.5 * dpr;
      g.beginPath(); g.arc(SX(cd[0]), SZ(cd[2]), 5 * dpr, 0, 6.283); g.stroke();
      const od = deltaGlobal(makeGlobal(0, 0, 0), origin.origin);
      g.strokeStyle = "rgba(255,193,61,0.8)"; g.setLineDash([4, 4]);
      g.strokeRect(SX(od[0]) - (origin.thresholdM / VIEW) * W, SZ(od[2]) - (origin.thresholdM / VIEW) * W,
        (origin.thresholdM * 2 / VIEW) * W, (origin.thresholdM * 2 / VIEW) * W);
      g.setLineDash([]);

      const sample = lattice.sample(cam);
      setHud({
        rebases: origin.rebases, ulp: origin.worstUlpM,
        contributors: sample.contributors, purity: sample.purity,
        germ: sporeList.length ? germSum / sporeList.length : 0,
      });
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [lattice, spires]);

  return (
    <div className="fi-panel border border-line bg-panel">
      <div className="grid lg:grid-cols-[minmax(0,1fr)_278px]">
        <div className="border-b border-line lg:border-r lg:border-b-0">
          <canvas ref={ref} className="w-full bg-void" style={{ aspectRatio: "16/10" }} />
        </div>
        <div className="p-3">
          {([
            ["spires", nSpires, 2, 40, 1, setNSpires],
            ["σ envelope (m)", sigma, 300, 4000, 50, setSigma],
          ] as const).map(([k, v, mn, mx, st, set]) => (
            <div key={k} className="mb-1.5">
              <div className="mono flex justify-between text-[9.5px]">
                <span className="text-dim">{k}</span><span className="tnum text-chalk">{v}</span>
              </div>
              <input type="range" min={mn} max={mx} step={st} value={v}
                onChange={(e) => (set as (n: number) => void)(+e.target.value)} className="w-full" />
            </div>
          ))}
          <div className="grid grid-cols-2 gap-1">
            <button onClick={() => setShowPurity(!showPurity)}
              className={cn("mono border px-1 py-1 text-[9px] font-bold uppercase",
                showPurity ? "border-transparent bg-chalk text-void" : "border-line text-dim")}>
              ◧ borders
            </button>
            <button onClick={() => setSpores(!spores)}
              className={cn("mono border px-1 py-1 text-[9px] font-bold uppercase",
                spores ? "border-transparent bg-vtx text-void" : "border-line text-dim")}>
              ✦ spores
            </button>
          </div>

          <div className="mt-3 border-t border-line pt-2">
            {([
              ["authors", stats.authors, "var(--fi-accent)"],
              ["influenced", `${stats.influencedKm2.toLocaleString()} km²`, "#7cff4d"],
              ["lattice bytes", `${stats.latticeBytes} B`, "#b46bff"],
              ["contributors here", hud.contributors, undefined],
              ["purity here", hud.purity.toFixed(3), hud.purity < 0.6 ? "#ffc13d" : "#7cff4d"],
              ["germination", hud.germ.toFixed(3), "#86c954"],
            ] as const).map(([k, v, c]) => (
              <div key={k} className="mono flex justify-between border-b border-line/40 py-[3px] text-[9.5px] last:border-0">
                <span className="text-dim">{k}</span>
                <span className="tnum" style={{ color: c }}>{v}</span>
              </div>
            ))}
          </div>

          <div className="mt-3 border-t border-line pt-2">
            <div className="mono mb-1 text-[9px] tracking-[0.2em] text-dim uppercase">
              floating origin
            </div>
            <div className="mono flex justify-between py-[2px] text-[9.5px]">
              <span className="text-dim">rebases</span>
              <span className="tnum text-lx">{hud.rebases}</span>
            </div>
            <div className="mono mb-1 flex justify-between text-[9.5px]">
              <span className="text-dim">walk from spawn</span>
              <span className="tnum text-chalk">{travelKm.toLocaleString()} km</span>
            </div>
            <input type="range" min={0} max={20000} step={100} value={travelKm}
              onChange={(e) => setTravelKm(+e.target.value)} className="w-full"
              style={{ ["--thumb" as string]: "#ff3d8a" }} />
            <div className="mono mt-1 space-y-[2px] text-[9px]">
              <div className="flex justify-between">
                <span className="text-dim">naive f32 ULP</span>
                <span className="tnum text-pxd">{precision.naiveUlpM < 0.001
                  ? precision.naiveUlpM.toExponential(1) : precision.naiveUlpM.toFixed(3)} m</span>
              </div>
              <div className="flex justify-between">
                <span className="text-dim">rebased ULP</span>
                <span className="tnum text-vtx">{precision.rebasedUlpM.toExponential(1)} m</span>
              </div>
              <div className="text-pxd">↯ {precision.naiveVerdict}</div>
              <div className="text-vtx">
                {precision.improvement.toLocaleString(undefined, { maximumFractionDigits: 0 })}× better
              </div>
            </div>
            <div className="mono mt-2 text-[8.5px] leading-snug text-dim">
              planet circumference {(SECTORS_AROUND * SECTOR_M / 1e6).toFixed(0)},000 km ·{" "}
              {SECTORS_AROUND.toLocaleString()} sectors of {SECTOR_M} m
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════ FEDERATION DEMO ══ */

export function FederationDemo() {
  const [trees, setTrees] = useState(100_000);
  const [animals, setAnimals] = useState(40_000);
  const [spireCount, setSpireCount] = useState(240);
  const [km2, setKm2] = useState(4200);
  const [cached, setCached] = useState(3);
  const [peerDist, setPeerDist] = useState(1_200_000);
  const [bus, setBus] = useState<NetBusState>(() => initialBus("local"));
  const [lastRoll, setLastRoll] = useState<{ frames: number; at: number } | null>(null);

  const manifest = useMemo(() => {
    const spires: Spire[] = Array.from({ length: spireCount }, (_, i) => {
      const a = AUTHORS[i % AUTHORS.length];
      return {
        id: `sp${i}`, author: a.handle,
        pos: makeGlobal(hash2i(i, 1) * 9e5, 0, hash2i(i, 2) * 9e5),
        cartridgeHash: a.hash, label: a.cart, tint: a.tint,
        sigmaM: 900 + hash2i(i, 3) * 2400, dominance: 1,
        tier: 1 + (i % 4), dispatchedAtTick: i * 1000,
      };
    });
    return buildContinent({
      name: "Vexen Reach",
      planetSeed: 70801,
      fidelity: { pxd: 1.1e8, vtx: 8.2e7, lx: 5.9e7, aq: 3.6e7, tick: 4_320_000 },
      cycle: { humidity: 0.51, cloud: 0.44, soilMoisture: 0.62, biomass: 0.58 },
      spires,
      cartridges: AUTHORS.map((a) => ({ hash: a.hash, bytes: 740 + a.cart.length * 90 })),
      authors: AUTHORS.map((a, i) => ({ handle: a.handle, pubkey: `ed25519:${a.hash}`, enclaveId: `e${i}` })),
      deltaJournal: { hash: "0x51ed4b2a", entries: 8_412, bytes: 26_880 },
      stats: { trees, animals, machines: 1_840, km2 },
      sign: (p) => `ed25519:${p.slice(2)}`,
    });
  }, [trees, animals, spireCount, km2]);

  const cachedSet = useMemo(
    () => new Set(AUTHORS.slice(0, cached).map((a) => a.hash)), [cached]);
  const size = useMemo(() => sizeContinent(manifest, cachedSet), [manifest, cachedSet]);

  const peers = useMemo(() => {
    const d = [peerDist, 48_000, 900, 120, 7_400_000, 2_100_000, 310];
    return d.map((x) => ({ distanceM: x }));
  }, [peerDist]);
  const bw = useMemo(() => bandwidthFor(peers), [peers]);
  const weather = useMemo(() => defaultWeather(70801), []);

  const tick = () => {
    const f: InputFrame = { tick: bus.tick + 1, peerId: "local", bits: 1, ax: 1, az: 0, yaw: 0 };
    setBus(advanceBus(bus, f));
  };
  const injectLate = (back: number) => {
    const t = Math.max(0, bus.tick - back);
    const r = receiveInput({ ...bus, peers: ["local", "peer"] },
      { tick: t, peerId: "peer", bits: 7, ax: -1, az: 0.5, yaw: 1.2 });
    setBus(r.bus);
    setLastRoll({ frames: r.frames, at: t });
  };

  const kb = (n: number) => n < 1024 ? `${Math.round(n)} B` : n < 1048576
    ? `${(n / 1024).toFixed(1)} kB` : `${(n / 1048576).toFixed(2)} MB`;
  const big = (n: number) => n < 1e9 ? `${(n / 1e6).toFixed(1)} MB`
    : n < 1e12 ? `${(n / 1e9).toFixed(2)} GB` : `${(n / 1e12).toFixed(2)} TB`;

  return (
    <div className="space-y-3">
      <div className="fi-panel border border-line bg-panel">
        <div className="grid lg:grid-cols-[300px_minmax(0,1fr)]">
          <div className="border-b border-line p-3 lg:border-r lg:border-b-0">
            <div className="mono mb-2 text-[9px] tracking-[0.2em] text-dim uppercase">
              Continent contents
            </div>
            {([
              ["trees", trees, 1000, 400_000, 1000, setTrees],
              ["animals", animals, 0, 200_000, 500, setAnimals],
              ["spires", spireCount, 4, 2000, 4, setSpireCount],
              ["km²", km2, 100, 20000, 100, setKm2],
              ["cartridges cached", cached, 0, 5, 1, setCached],
            ] as const).map(([k, v, mn, mx, st, set]) => (
              <div key={k} className="mb-1.5">
                <div className="mono flex justify-between text-[9.5px]">
                  <span className="text-dim">{k}</span>
                  <span className="tnum text-chalk">{v.toLocaleString()}</span>
                </div>
                <input type="range" min={mn} max={mx} step={st} value={v}
                  onChange={(e) => (set as (n: number) => void)(+e.target.value)} className="w-full" />
              </div>
            ))}
            <div className={cn("mono mt-3 border p-2 text-[9.5px] leading-snug",
              size.underBudget ? "border-vtx/50 bg-vtx/5" : "border-pxd/50 bg-pxd/5")}>
              <div className="text-dim">total on the wire</div>
              <div className={cn("text-[20px] font-black", size.underBudget ? "text-vtx" : "text-pxd")}>
                {kb(size.totalBytes)}
              </div>
              <div className="mt-1">{size.underBudget ? "✓ under the 200 kB budget" : "✕ over budget"}</div>
            </div>
          </div>

          <div className="p-3">
            <div className="mono mb-2 text-[9px] tracking-[0.2em] text-dim uppercase">
              Where the bytes go — and where they don't
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                {([
                  ["manifest + lattice", kb(size.manifestBytes), "#e8eef7"],
                  ["cartridges (uncached)", kb(size.cartridgeBytes), "#b46bff"],
                  ["sparse delta journal", kb(size.journalBytes), "#7cff4d"],
                  ["weather harmonics", kb(size.weatherBytes), "#3dc8ff"],
                  ["TREES", "0 B", "#7cff4d"],
                  ["ANIMALS", "0 B", "#7cff4d"],
                  ["TERRAIN", "0 B", "#7cff4d"],
                ] as const).map(([k, v, c]) => (
                  <div key={k} className="mono flex justify-between border-b border-line/40 py-[3px] text-[9.5px] last:border-0">
                    <span className="text-dim">{k}</span>
                    <span className="tnum font-bold" style={{ color: c }}>{v}</span>
                  </div>
                ))}
              </div>
              <div>
                {([
                  ["trees as transforms", big(size.naiveTreeBytes), "#ff3d8a"],
                  ["animals as entities", big(size.naiveAnimalBytes), "#ff3d8a"],
                  ["terrain as voxels", big(size.naiveVoxelBytes), "#ff3d8a"],
                  ["naive total", big(size.naiveTotalBytes), "#ff3d8a"],
                ] as const).map(([k, v, c]) => (
                  <div key={k} className="mono flex justify-between border-b border-line/40 py-[3px] text-[9.5px]">
                    <span className="text-dim">{k}</span>
                    <span className="tnum" style={{ color: c }}>{v}</span>
                  </div>
                ))}
                <div className="mono mt-2 border border-vtx/40 bg-vtx/5 p-2 text-[9.5px]">
                  <div className="text-dim">compression ratio</div>
                  <div className="text-[18px] font-black text-vtx">
                    {size.ratio.toLocaleString(undefined, { maximumFractionDigits: 0 })}×
                  </div>
                  <div className="mt-1 leading-snug text-dim">
                    Not compression — <span className="text-chalk">derivation</span>. A tree is
                    scatterCell(seed) evaluated at τ; an animal is a Poisson sample of a field.
                  </div>
                </div>
              </div>
            </div>

            <div className="mono mt-3 border-t border-line pt-2 text-[9px] tracking-[0.2em] text-dim uppercase">
              Weather, as three sine terms ({kb(size.weatherBytes)} sent once)
            </div>
            <div className="mt-1 flex gap-px overflow-hidden border border-line">
              {Array.from({ length: 64 }, (_, i) => {
                const rain = sampleRain(weather, i * 90_000, 0, Date.now() / 1000);
                return <div key={i} className="h-7 flex-1"
                  style={{ background: `rgba(61,200,255,${rain})` }} />;
              })}
            </div>
          </div>
        </div>
      </div>

      {/* presence ladder + netbus */}
      <div className="grid gap-3 lg:grid-cols-[1.15fr_1fr]">
        <div className="fi-panel border border-line bg-panel">
          <div className="mono border-b border-line bg-panel2 px-3 py-2 text-[9px] tracking-[0.2em] text-dim uppercase">
            Tiered co-presence · bandwidth falls off a cliff with distance
          </div>
          <div className="divide-y divide-line/60">
            {PRESENCE.map((p) => {
              const active = tierFor(peerDist).tier === p.tier;
              return (
                <div key={p.tier} className={cn("grid gap-2 p-2.5 sm:grid-cols-[140px_1fr]", active && "bg-panel2")}>
                  <div>
                    <div className={cn("mono text-[11px] font-bold", active ? "fi-accent-text" : "text-chalk")}>
                      {p.tier}
                    </div>
                    <div className="mono text-[9px] text-dim">
                      ≤{p.rangeM === Infinity ? "∞" : `${(p.rangeM / 1000).toLocaleString()} km`} ·{" "}
                      {p.hz < 1 ? `1/${Math.round(1 / p.hz)} Hz` : `${p.hz} Hz`} · {p.bytes} B
                    </div>
                    <div className="mono text-[9px] text-vtx">
                      {(p.hz * p.bytes).toFixed(2)} B/s per peer
                    </div>
                  </div>
                  <p className="text-[11px] leading-snug text-dim">{p.what}</p>
                </div>
              );
            })}
          </div>
          <div className="border-t border-line p-3">
            <div className="mono mb-1 flex justify-between text-[9.5px]">
              <span className="text-dim">nearest peer distance</span>
              <span className="tnum text-chalk">
                {peerDist >= 1000 ? `${(peerDist / 1000).toLocaleString()} km` : `${peerDist} m`}
              </span>
            </div>
            <input type="range" min={20} max={8_000_000} step={20} value={peerDist}
              onChange={(e) => setPeerDist(+e.target.value)} className="w-full"
              style={{ ["--thumb" as string]: "var(--fi-accent)" }} />
            <div className="mono mt-2 flex flex-wrap gap-3 text-[9.5px]">
              <span className="text-dim">7 peers →</span>
              <span className="text-vtx">{bw.bytesPerSec.toFixed(1)} B/s</span>
              <span className="text-chalk">{bw.kbitsPerSec.toFixed(2)} kbit/s</span>
              <span className="text-dim">
                {Object.entries(bw.byTier).map(([k, v]) => `${v}×${k}`).join(" · ")}
              </span>
            </div>
          </div>
        </div>

        <div className="fi-panel border border-line bg-panel">
          <div className="mono border-b border-line bg-panel2 px-3 py-2 text-[9px] tracking-[0.2em] text-dim uppercase">
            NetBus · 120 Hz deterministic rollback
          </div>
          <div className="p-3">
            <div className="grid grid-cols-3 gap-1">
              <button onClick={tick}
                className="mono fi-accent-bg px-2 py-1.5 text-[9px] font-black tracking-wider text-void uppercase">
                ▸ tick
              </button>
              <button onClick={() => injectLate(5)}
                className="mono border border-line px-2 py-1.5 text-[9px] font-bold text-dim uppercase hover:text-chalk">
                late −5
              </button>
              <button onClick={() => injectLate(14)}
                className="mono border border-pxd/60 bg-pxd/10 px-2 py-1.5 text-[9px] font-bold text-pxd uppercase">
                late −14
              </button>
            </div>
            <div className="mt-2">
              {([
                ["tick", bus.tick, "var(--fi-accent)"],
                ["confirmed", bus.confirmedTick, "#7cff4d"],
                ["rollbacks", bus.stats.rollbacks, bus.stats.rollbacks ? "#ffc13d" : undefined],
                ["worst rewind", `${bus.stats.worstRollbackFrames} f`,
                  bus.stats.worstRollbackFrames > MAX_ROLLBACK ? "#ff3d8a" : "#7cff4d"],
                ["predicted frames", bus.stats.predictedFrames, undefined],
                ["misprediction", `${(bus.stats.misprediction * 100).toFixed(1)}%`, undefined],
                ["window", `${MAX_ROLLBACK} f = ${(MAX_ROLLBACK / 120 * 1000).toFixed(0)} ms`, "#8b9bb4"],
              ] as const).map(([k, v, c]) => (
                <div key={k} className="mono flex justify-between border-b border-line/40 py-[3px] text-[9.5px] last:border-0">
                  <span className="text-dim">{k}</span>
                  <span className="tnum" style={{ color: c }}>{v}</span>
                </div>
              ))}
            </div>
            {lastRoll && (
              <div className="mono mt-2 border border-line bg-void2 p-2 text-[9px] leading-snug text-chalk/85">
                late input at tick {lastRoll.at} → rewound{" "}
                <span className="text-lx">{lastRoll.frames} frames</span> and re-simulated.
                No reconciliation code ran, because re-running a pure function lands on the
                sender's state by construction.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="fi-panel border border-line bg-panel">
        <div className="mono border-b border-line bg-panel2 px-3 py-2 text-[9px] tracking-[0.2em] text-dim uppercase">
          The guarantees
        </div>
        <div className="divide-y divide-line/60">
          {FEDERATION_GUARANTEES.map(([k, v], i) => (
            <div key={k} className="grid gap-2 p-3 sm:grid-cols-[250px_1fr]">
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
