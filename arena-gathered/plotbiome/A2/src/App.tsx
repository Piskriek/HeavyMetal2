import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CAPS,
  FIRST_STAGE,
  SPACING,
  WET_REACH,
  bakePlotBiome,
  slopeDeg,
  type BiomeInput,
  type ScatterKind,
  type Tier,
} from './plotbiome';

const SCATTER_COLORS: Record<ScatterKind, string> = {
  tuft: '#a3e635',
  bush: '#14b8a6',
  birch: '#fde047',
  oak: '#fb923c',
  pine: '#38bdf8',
};

const SCATTER_LABELS: Record<ScatterKind, string> = {
  tuft: 'Grass Tuft',
  bush: 'Wetland Bush',
  birch: 'Water Birch',
  oak: 'Midland Oak',
  pine: 'Highland Pine',
};

function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildSeededTerrain(n: number, cellM: number, seed: number) {
  const rng = mulberry32(seed ^ 0x9e3779b9);
  const total = n * n;
  const height = new Float32Array(total);
  const water = new Uint8Array(total);
  const worldSize = n * cellM;

  // Crater with a lake offset slightly southwest
  const craterX = worldSize * (0.34 + (rng() - 0.5) * 0.05);
  const craterZ = worldSize * (0.62 + (rng() - 0.5) * 0.05);
  const craterR = worldSize * 0.22;
  const lakeR = craterR * 0.56;

  // Elevated ridge running along the northeast quadrant
  const ridgeAngle = 0.65 + (rng() - 0.5) * 0.2;
  const cosA = Math.cos(ridgeAngle);
  const sinA = Math.sin(ridgeAngle);
  const ridgeCenterX = worldSize * 0.72;
  const ridgeCenterZ = worldSize * 0.3;

  for (let z = 0; z < n; z++) {
    const wz = (z + 0.5) * cellM;
    for (let x = 0; x < n; x++) {
      const wx = (x + 0.5) * cellM;
      const idx = z * n + x;

      // Base gentle moon slope + multi-frequency undulation
      let h =
        14 +
        0.045 * (wx * 0.7 + (worldSize - wz) * 0.8) +
        2.2 * Math.sin(wx * 0.045) * Math.cos(wz * 0.045) +
        1.1 * Math.sin((wx + wz) * 0.09);

      // Crater bowl and rim
      const dxC = wx - craterX;
      const dzC = wz - craterZ;
      const dCrater = Math.sqrt(dxC * dxC + dzC * dzC);
      if (dCrater < craterR * 1.35) {
        const u = dCrater / craterR;
        if (u < 1.0) {
          h -= (1 - u * u) * 14.5;
        } else {
          const rim = 1 - (u - 1) / 0.35;
          h += rim * rim * 4.2;
        }
      }

      // Ridge crest
      const rx = (wx - ridgeCenterX) * cosA - (wz - ridgeCenterZ) * sinA;
      const rz = (wx - ridgeCenterX) * sinA + (wz - ridgeCenterZ) * cosA;
      const ridgeProfile = Math.exp(-(rx * rx) / (2 * (worldSize * 0.11) ** 2)) *
        Math.exp(-(rz * rz) / (2 * (worldSize * 0.32) ** 2));
      h += ridgeProfile * 20;

      height[idx] = h;
      if (dCrater <= lakeR) {
        water[idx] = 1;
      }
    }
  }

  // 3 terraforming machines placed around dry terrain
  const machines = [
    { x: worldSize * 0.24, z: worldSize * 0.26, r: 4.5 },
    { x: worldSize * 0.58, z: worldSize * 0.52, r: 4.0 },
    { x: worldSize * 0.32, z: worldSize * 0.86, r: 3.8 },
  ];

  const keepouts = [
    {
      x0: worldSize * 0.44,
      z0: worldSize * 0.16,
      x1: worldSize * 0.52,
      z1: worldSize * 0.23,
    },
  ];

  return { height, water, machines, keepouts };
}

export default function App() {
  const [stage, setStage] = useState<number>(5.4);
  const [tier, setTier] = useState<Tier>('mid');
  const [seed, setSeed] = useState<number>(42);
  const [aq, setAq] = useState<number>(0.65);
  const [lx, setLx] = useState<number>(0.6);
  const [gridN, setGridN] = useState<number>(256);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const cellM = 256 / gridN;

  const terrain = useMemo(
    () => buildSeededTerrain(gridN, cellM, seed),
    [gridN, cellM, seed]
  );

  const { bake, bakeMs } = useMemo(() => {
    const input: BiomeInput = {
      n: gridN,
      cellM,
      height: terrain.height,
      water: terrain.water,
      stage,
      s: { pxd: 0.5, vtx: 0.5, lx, aq },
      machines: terrain.machines,
      keepouts: terrain.keepouts,
      seed,
      tier,
    };
    const t0 = performance.now();
    const res = bakePlotBiome(input);
    const elapsed = performance.now() - t0;
    return { bake: res, bakeMs: elapsed };
  }, [gridN, cellM, terrain, stage, lx, aq, seed, tier]);

  const countsByKind = useMemo(() => {
    const counts: Record<ScatterKind, number> = {
      tuft: 0,
      bush: 0,
      birch: 0,
      oak: 0,
      pine: 0,
    };
    for (const s of bake.scatter) {
      counts[s.kind]++;
    }
    return counts;
  }, [bake]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const heightPx = canvas.height;
    const n = gridN;
    const worldSize = n * cellM;

    // Render shaded heightfield + ground cover onto offscreen ImageData at n x n
    const offscreen = document.createElement('canvas');
    offscreen.width = n;
    offscreen.height = n;
    const offCtx = offscreen.getContext('2d');
    if (!offCtx) return;

    const img = offCtx.createImageData(n, n);
    const data = img.data;
    const cov = bake.cover;
    const hArr = terrain.height;
    const wArr = terrain.water;

    for (let z = 0; z < n; z++) {
      for (let x = 0; x < n; x++) {
        const idx = z * n + x;
        const p = idx * 4;
        const isWater = (wArr[idx] ?? 0) > 0;

        if (isWater) {
          // Deep crater lake blue with subtle depth shading
          const h = hArr[idx] ?? 0;
          const depthShade = Math.max(0.7, Math.min(1.1, 0.9 + h * 0.015));
          data[p] = Math.round(24 * depthShade);
          data[p + 1] = Math.round(92 * depthShade);
          data[p + 2] = Math.round(168 * depthShade);
          data[p + 3] = 255;
          continue;
        }

        const rDust = (cov[p] ?? 0) / 255;
        const gMoss = (cov[p + 1] ?? 0) / 255;
        const bGrass = (cov[p + 2] ?? 0) / 255;
        const aWet = (cov[p + 3] ?? 0) / 255;

        // Directional hillshade from NW
        const hx1 = hArr[z * n + Math.min(n - 1, x + 1)] ?? 0;
        const hx0 = hArr[z * n + Math.max(0, x - 1)] ?? 0;
        const hz1 = hArr[Math.min(n - 1, z + 1) * n + x] ?? 0;
        const hz0 = hArr[Math.max(0, z - 1) * n + x] ?? 0;
        const dx = (hx1 - hx0) / (2 * cellM);
        const dz = (hz1 - hz0) / (2 * cellM);
        const shade = Math.max(0.48, Math.min(1.22, 0.88 + (-dx * 0.38 - dz * 0.32)));

        // Base colors:
        // Dust grey: (148, 146, 142)
        // Moss dark green: (38, 102, 54)
        // Grass light green: (98, 188, 76)
        // Wet blue tint: (52, 130, 196)
        const totalWeight = Math.max(1e-3, rDust + gMoss + bGrass);
        const wD = rDust / totalWeight;
        const wM = gMoss / totalWeight;
        const wG = bGrass / totalWeight;

        let r = wD * 148 + wM * 38 + wG * 98;
        let g = wD * 146 + wM * 102 + wG * 188;
        let b = wD * 142 + wM * 54 + wG * 76;

        // Blend wet shoreline blue tint
        if (aWet > 0) {
          const wetMix = aWet * 0.38;
          r = r * (1 - wetMix) + 52 * wetMix;
          g = g * (1 - wetMix) + 130 * wetMix;
          b = b * (1 - wetMix) + 196 * wetMix;
        }

        // Steep cliff rock darkening
        const sl = slopeDeg(hArr, n, cellM, x, z);
        if (sl > 35) {
          r *= 0.78;
          g *= 0.78;
          b *= 0.8;
        }

        data[p] = Math.min(255, Math.max(0, Math.round(r * shade)));
        data[p + 1] = Math.min(255, Math.max(0, Math.round(g * shade)));
        data[p + 2] = Math.min(255, Math.max(0, Math.round(b * shade)));
        data[p + 3] = 255;
      }
    }

    offCtx.putImageData(img, 0, 0);

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(offscreen, 0, 0, width, heightPx);

    const scalePx = width / worldSize;

    // Draw keep-out rectangles
    for (const ko of terrain.keepouts) {
      const x0 = Math.min(ko.x0, ko.x1) * scalePx;
      const z0 = Math.min(ko.z0, ko.z1) * scalePx;
      const w = Math.abs(ko.x1 - ko.x0) * scalePx;
      const h = Math.abs(ko.z1 - ko.z0) * scalePx;
      ctx.fillStyle = 'rgba(239, 68, 68, 0.16)';
      ctx.strokeStyle = 'rgba(248, 113, 113, 0.75)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.fillRect(x0, z0, w, h);
      ctx.strokeRect(x0, z0, w, h);
      ctx.setLineDash([]);
    }

    // Draw machines and their keep-out rings
    for (const m of terrain.machines) {
      const mx = m.x * scalePx;
      const mz = m.z * scalePx;
      const mr = m.r * scalePx;

      ctx.beginPath();
      ctx.arc(mx, mz, mr, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(245, 158, 11, 0.15)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.85)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Machine core
      ctx.beginPath();
      ctx.arc(mx, mz, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#f59e0b';
      ctx.fill();
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Draw scatter instances as dots colored by kind
    for (const s of bake.scatter) {
      const sx = s.x * scalePx;
      const sz = s.z * scalePx;
      const radius =
        s.kind === 'tuft'
          ? 1.7 * s.scale
          : s.kind === 'bush'
            ? 2.5 * s.scale
            : 3.3 * s.scale;

      ctx.beginPath();
      ctx.arc(sx, sz, radius, 0, Math.PI * 2);
      ctx.fillStyle = SCATTER_COLORS[s.kind];
      ctx.fill();
      if (s.kind !== 'tuft') {
        ctx.strokeStyle = 'rgba(15, 23, 42, 0.65)';
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }
    }

    ctx.restore();
  }, [bake, terrain, gridN, cellM]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Lunar Plot Biome Baker (`src/plotbiome.ts`)
            </h1>
            <p className="text-sm text-slate-400">
              Deterministic moon plot terraforming stages 0..6 — ground cover RGBA &amp; monotone plant scatter
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-slate-900 border border-slate-800 px-3.5 py-2 text-right">
              <div className="text-xs uppercase tracking-wider text-slate-400">Bake Time</div>
              <div className="text-lg font-mono font-semibold text-emerald-400">
                {bakeMs.toFixed(2)} ms
              </div>
            </div>
            <div className="rounded-lg bg-slate-900 border border-slate-800 px-3.5 py-2 text-right">
              <div className="text-xs uppercase tracking-wider text-slate-400">Total Scatter</div>
              <div className="text-lg font-mono font-semibold text-sky-400">
                {bake.scatter.length} / {CAPS[tier]}
              </div>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Controls & Stats Panel */}
          <div className="lg:col-span-4 space-y-5 bg-slate-900/90 border border-slate-800 rounded-xl p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300">
              Biome Parameters
            </h2>

            {/* Stage Slider */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-sm">
                <label htmlFor="stage-slider" className="font-medium text-slate-200">
                  Terraforming Stage
                </label>
                <span className="font-mono text-emerald-400 font-semibold">
                  {stage.toFixed(1)}
                </span>
              </div>
              <input
                id="stage-slider"
                type="range"
                min={0}
                max={6}
                step={0.1}
                value={stage}
                onChange={(e) => setStage(parseFloat(e.target.value))}
                className="w-full accent-emerald-500 cursor-pointer"
              />
              <div className="flex justify-between text-[11px] text-slate-500 font-mono">
                <span>0: Dust</span>
                <span>2: Tufts</span>
                <span>4: Bushes</span>
                <span>5: Creep</span>
                <span>6: Forest</span>
              </div>
            </div>

            {/* Tier Select & Seed Field */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label htmlFor="tier-select" className="block text-sm font-medium text-slate-200">
                  Tier Cap
                </label>
                <select
                  id="tier-select"
                  value={tier}
                  onChange={(e) => setTier(e.target.value as Tier)}
                  className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="low">low ({CAPS.low})</option>
                  <option value="mid">mid ({CAPS.mid})</option>
                  <option value="high">high ({CAPS.high})</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="seed-input" className="block text-sm font-medium text-slate-200">
                  PRNG Seed
                </label>
                <input
                  id="seed-input"
                  type="number"
                  value={seed}
                  onChange={(e) => setSeed(parseInt(e.target.value, 10) || 0)}
                  className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* AQ Slider */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-sm">
                <label htmlFor="aq-slider" className="font-medium text-slate-200">
                  Hydration (`s.aq`)
                </label>
                <span className="font-mono text-sky-400">{aq.toFixed(2)}</span>
              </div>
              <input
                id="aq-slider"
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={aq}
                onChange={(e) => setAq(parseFloat(e.target.value))}
                className="w-full accent-sky-500 cursor-pointer"
              />
            </div>

            {/* LX Slider & Grid Resolution */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <label htmlFor="lx-slider" className="text-slate-300">
                    Lux (`s.lx`)
                  </label>
                  <span className="font-mono text-amber-400">{lx.toFixed(2)}</span>
                </div>
                <input
                  id="lx-slider"
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={lx}
                  onChange={(e) => setLx(parseFloat(e.target.value))}
                  className="w-full accent-amber-400 cursor-pointer"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="grid-select" className="block text-xs text-slate-300">
                  Grid Size (`n`)
                </label>
                <select
                  id="grid-select"
                  value={gridN}
                  onChange={(e) => setGridN(parseInt(e.target.value, 10))}
                  className="w-full rounded-lg bg-slate-950 border border-slate-700 px-2.5 py-1.5 text-xs font-mono text-white"
                >
                  <option value={128}>128 × 128 (2m/cell)</option>
                  <option value={256}>256 × 256 (1m/cell)</option>
                </select>
              </div>
            </div>

            {/* Instance Count by Kind */}
            <div className="pt-3 border-t border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Instances by Kind
                </h3>
                <span className="text-xs font-mono text-slate-400">
                  WET_REACH = {WET_REACH}m
                </span>
              </div>

              <div className="space-y-2">
                {(['tuft', 'bush', 'birch', 'oak', 'pine'] as ScatterKind[]).map((k) => {
                  const count = countsByKind[k];
                  const pct =
                    bake.scatter.length > 0
                      ? Math.round((count / bake.scatter.length) * 100)
                      : 0;
                  return (
                    <div
                      key={k}
                      className="flex items-center justify-between rounded-lg bg-slate-950/80 border border-slate-800/80 px-3 py-2 text-sm"
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className="inline-block h-3 w-3 rounded-full shrink-0"
                          style={{ backgroundColor: SCATTER_COLORS[k] }}
                        />
                        <div>
                          <div className="font-medium text-slate-200 leading-none">
                            {SCATTER_LABELS[k]}{' '}
                            <span className="text-xs font-mono text-slate-400">({k})</span>
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                            stage ≥ {FIRST_STAGE[k]} · spacing {SPACING[k]}m
                          </div>
                        </div>
                      </div>
                      <div className="text-right font-mono">
                        <span className="text-white font-semibold">{count}</span>
                        <span className="text-xs text-slate-500 ml-1.5">({pct}%)</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Ground Cover Legend */}
            <div className="pt-3 border-t border-slate-800 space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Ground Cover &amp; Overlays
              </h3>
              <div className="grid grid-cols-2 gap-2 text-xs text-slate-300">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded bg-[#94928e] inline-block" />
                  <span>R: Lunar Dust</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded bg-[#266636] inline-block" />
                  <span>G: Dark Moss</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded bg-[#62bc4c] inline-block" />
                  <span>B: Light Grass</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded bg-[#3482c4] inline-block" />
                  <span>A: Wet Reach (6m)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full border border-amber-400 bg-amber-500/30 inline-block" />
                  <span>3 Machines (r keepout)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded border border-red-400 bg-red-500/20 inline-block" />
                  <span>Keep-out Zone</span>
                </div>
              </div>
            </div>
          </div>

          {/* Canvas Viewport */}
          <div className="lg:col-span-8 flex flex-col items-center bg-slate-900/90 border border-slate-800 rounded-xl p-4">
            <div className="w-full flex items-center justify-between mb-3 text-xs text-slate-400 font-mono">
              <span>
                Terrain: Crater Lake (SW) + Highland Ridge (NE) + 3 Machines
              </span>
              <span>
                World: {(gridN * cellM).toFixed(0)}m × {(gridN * cellM).toFixed(0)}m
              </span>
            </div>
            <div className="relative w-full max-w-[680px] aspect-square rounded-lg overflow-hidden border border-slate-800 shadow-2xl bg-slate-950">
              <canvas
                ref={canvasRef}
                width={680}
                height={680}
                className="w-full h-full block"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
