import { useMemo, useRef, useEffect, useState } from 'react';
import {
  bakePlotBiome,
  type ScatterKind,
  type Tier,
  type BiomeInput,
} from './plotbiome';

const N = 192;
const CELL = 1;
const WORLD = N * CELL;

const KIND_COLOR: Record<ScatterKind, string> = {
  tuft: '#d7f06a',
  bush: '#6f9a3a',
  pine: '#163d2c',
  oak: '#8a6230',
  birch: '#f2ead4',
};

const KIND_R: Record<ScatterKind, number> = {
  tuft: 1.15,
  bush: 1.7,
  pine: 2.35,
  oak: 2.5,
  birch: 2.1,
};

const STAGE_LABEL = [
  'Barren regolith',
  'Dust and ice',
  'Tufts near machines',
  'Grass taking hold',
  'Bushes by the water',
  'Moss and grass creep',
  'Closed-canopy forest',
];

function makeTerrain(): Pick<BiomeInput, 'height' | 'water' | 'machines' | 'keepouts'> {
  const height = new Float32Array(N * N);
  const water = new Uint8Array(N * N);
  const craterX = 0.4 * WORLD;
  const craterZ = 0.5 * WORLD;
  const craterR = 0.23 * WORLD;
  const ridgeX = 0.74 * WORLD;

  for (let z = 0; z < N; z++) {
    for (let x = 0; x < N; x++) {
      const wx = (x + 0.5) * CELL;
      const wz = (z + 0.5) * CELL;
      let h = 7.4;
      h += 1.15 * Math.sin(wx * 0.055) * Math.cos(wz * 0.07);
      h += 0.55 * Math.sin(wx * 0.17 + wz * 0.11);
      h += 0.28 * Math.sin((wx + wz) * 0.09);

      const dc = Math.hypot(wx - craterX, wz - craterZ);
      const u = dc / craterR;
      if (u < 1.35) {
        const rim = Math.exp(-((u - 1.02) * 5.2) * ((u - 1.02) * 5.2)) * 8.5;
        const bowl = u < 1 ? (1 - u) * (1 - u) * -13.5 : 0;
        h += rim + bowl;
      }

      const ridgeWobble = wx - ridgeX - 7 * Math.sin(wz * 0.045);
      h += 15.5 * Math.exp(-(ridgeWobble * ridgeWobble) / (2 * 16 * 16));
      h += 4.2 * Math.exp(-((wz - 36) * (wz - 36) + (wx - 150) * (wx - 150)) / 420);

      const i = z * N + x;
      height[i] = h;
      if (dc < craterR * 0.48 && h < 2.35) water[i] = 1;
    }
  }

  return {
    height,
    water,
    machines: [
      { x: 54, z: 48, r: 3.2 },
      { x: 96, z: 108, r: 3.6 },
      { x: 42, z: 128, r: 2.8 },
    ],
    keepouts: [{ x0: 132, z0: 18, x1: 168, z1: 42 }],
  };
}

function stageCaption(stage: number): string {
  const i = Math.max(0, Math.min(6, Math.round(stage)));
  return STAGE_LABEL[i] ?? STAGE_LABEL[0] ?? '';
}

function hillshade(height: Float32Array, x: number, z: number): number {
  const at = (xx: number, zz: number) => {
    const cx = xx < 0 ? 0 : xx >= N ? N - 1 : xx;
    const cz = zz < 0 ? 0 : zz >= N ? N - 1 : zz;
    return height[cz * N + cx] ?? 0;
  };
  const dx = at(x + 1, z) - at(x - 1, z);
  const dz = at(x, z + 1) - at(x, z - 1);
  const nx = -dx;
  const ny = 2.4;
  const nz = -dz;
  const len = Math.hypot(nx, ny, nz) || 1;
  const ndot = (nx * -0.45 + ny * 0.78 + nz * -0.42) / len;
  return 0.22 + 0.78 * Math.max(0, ndot);
}

export default function App() {
  const [stage, setStage] = useState(4.5);
  const [tier, setTier] = useState<Tier>('high');
  const [seed, setSeed] = useState(42);
  const [aq, setAq] = useState(0.82);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const terrain = useMemo(() => makeTerrain(), []);

  const { baked, ms } = useMemo(() => {
    const t0 = performance.now();
    const baked = bakePlotBiome({
      n: N,
      cellM: CELL,
      height: terrain.height,
      water: terrain.water,
      stage,
      s: { pxd: 0.48, vtx: 0.78, lx: 0.88, aq },
      machines: terrain.machines,
      keepouts: terrain.keepouts,
      seed,
      tier,
    });
    return { baked, ms: performance.now() - t0 };
  }, [terrain, stage, tier, seed, aq]);

  const counts = useMemo(() => {
    const c: Record<ScatterKind, number> = { tuft: 0, bush: 0, pine: 0, oak: 0, birch: 0 };
    for (const s of baked.scatter) c[s.kind]++;
    return c;
  }, [baked]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const img = ctx.createImageData(N, N);
    const px = img.data;
    const { cover } = baked;
    const { height, water } = terrain;

    for (let z = 0; z < N; z++) {
      for (let x = 0; x < N; x++) {
        const i = z * N + x;
        const o = i * 4;
        const shade = hillshade(height, x, z);
        const dust = (cover[o] ?? 0) / 255;
        const moss = (cover[o + 1] ?? 0) / 255;
        const grass = (cover[o + 2] ?? 0) / 255;
        const wet = (cover[o + 3] ?? 0) / 255;
        let r = 168 * dust + 38 * moss + 118 * grass;
        let g = 150 * dust + 96 * moss + 176 * grass;
        let b = 128 * dust + 50 * moss + 70 * grass;
        r = r * (1 - 0.5 * wet) + 42 * 0.5 * wet;
        g = g * (1 - 0.5 * wet) + 86 * 0.5 * wet;
        b = b * (1 - 0.5 * wet) + 148 * 0.5 * wet;
        if ((water[i] ?? 0) > 0) {
          const depth = Math.max(0, 2.4 - (height[i] ?? 0));
          r = 18 + 22 * shade;
          g = 48 + 28 * shade;
          b = 78 + 50 * shade + depth * 6;
        }
        r *= shade;
        g *= shade;
        b *= shade;
        px[o] = Math.max(0, Math.min(255, r));
        px[o + 1] = Math.max(0, Math.min(255, g));
        px[o + 2] = Math.max(0, Math.min(255, b));
        px[o + 3] = 255;
      }
    }

    ctx.putImageData(img, 0, 0);
    ctx.save();
    ctx.scale(canvas.width / N, canvas.height / N);

    ctx.fillStyle = 'rgba(10, 14, 22, 0.28)';
    const k0 = terrain.keepouts[0];
    if (k0) ctx.fillRect(k0.x0 / CELL, k0.z0 / CELL, (k0.x1 - k0.x0) / CELL, (k0.z1 - k0.z0) / CELL);
    ctx.strokeStyle = 'rgba(255, 196, 92, 0.55)';
    ctx.lineWidth = 0.7;
    ctx.setLineDash([2.2, 1.6]);
    if (k0) ctx.strokeRect(k0.x0 / CELL, k0.z0 / CELL, (k0.x1 - k0.x0) / CELL, (k0.z1 - k0.z0) / CELL);
    ctx.setLineDash([]);

    for (const s of baked.scatter) {
      const r = KIND_R[s.kind] * (0.55 + 0.45 * s.scale);
      ctx.beginPath();
      ctx.arc(s.x / CELL, s.z / CELL, r, 0, Math.PI * 2);
      ctx.fillStyle = KIND_COLOR[s.kind];
      ctx.globalAlpha = s.kind === 'tuft' ? 0.82 : 0.92;
      ctx.fill();
      if (s.kind === 'birch') {
        ctx.strokeStyle = 'rgba(40, 32, 24, 0.55)';
        ctx.lineWidth = 0.35;
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;

    for (const m of terrain.machines) {
      const mx = m.x / CELL;
      const mz = m.z / CELL;
      ctx.beginPath();
      ctx.arc(mx, mz, m.r / CELL, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 140, 64, 0.18)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 168, 80, 0.9)';
      ctx.lineWidth = 0.7;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(mx, mz - 2.4);
      ctx.lineTo(mx + 2.1, mz + 1.6);
      ctx.lineTo(mx - 2.1, mz + 1.6);
      ctx.closePath();
      ctx.fillStyle = '#ffb25a';
      ctx.fill();
    }
    ctx.restore();
  }, [baked, terrain]);

  const total = baked.scatter.length;
  const kinds: ScatterKind[] = ['tuft', 'bush', 'pine', 'oak', 'birch'];

  return (
    <div className="min-h-screen bg-[#07090d] text-zinc-100">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(80,110,150,0.16),_transparent_52%),radial-gradient(ellipse_at_bottom_right,_rgba(180,90,30,0.08),_transparent_40%)]" />
      <div className="relative mx-auto flex min-h-screen max-w-[1280px] flex-col px-4 py-5 sm:px-6 lg:px-8">
        <header className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b border-white/10 pb-4">
          <div>
            <p className="text-[11px] tracking-[0.28em] text-amber-200/80 uppercase">
              Lunar plot · terraforming baker
            </p>
            <h1 className="mt-1 font-semibold text-2xl tracking-tight text-white sm:text-3xl">
              Plot Biome
            </h1>
            <p className="mt-1 max-w-xl text-sm text-zinc-400">
              Ground cover and plant scatter for stages 0–6. Crater lake, ridge, three machines.
            </p>
          </div>
          <div className="flex items-center gap-3 font-mono text-xs text-zinc-400">
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
              {N}×{N} · {CELL} m
            </span>
            <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-amber-100">
              {ms.toFixed(1)} ms
            </span>
          </div>
        </header>

        <div className="grid flex-1 gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <section className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0c1018] shadow-[0_0_80px_rgba(0,0,0,0.45)]">
            <canvas
              ref={canvasRef}
              width={N}
              height={N}
              className="h-auto w-full bg-zinc-950"
              style={{ imageRendering: 'pixelated' }}
            />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-4 py-3">
              <p className="text-[11px] tracking-[0.2em] text-zinc-300 uppercase">
                Stage {stage.toFixed(1)} · {stageCaption(stage)}
              </p>
            </div>
          </section>

          <aside className="flex flex-col gap-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <label className="flex items-center justify-between text-xs tracking-wide text-zinc-400 uppercase">
                Stage
                <span className="font-mono text-amber-200">{stage.toFixed(1)}</span>
              </label>
              <input
                type="range"
                min={0}
                max={6}
                step={0.1}
                value={stage}
                onChange={(e) => setStage(Number(e.target.value))}
                className="mt-2 w-full accent-amber-400"
              />
              <div className="mt-1 flex justify-between font-mono text-[10px] text-zinc-500">
                <span>0</span>
                <span>2 tuft</span>
                <span>4 bush</span>
                <span>6 forest</span>
              </div>

              <label className="mt-4 flex items-center justify-between text-xs tracking-wide text-zinc-400 uppercase">
                Aqua
                <span className="font-mono text-sky-200">{aq.toFixed(2)}</span>
              </label>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={aq}
                onChange={(e) => setAq(Number(e.target.value))}
                className="mt-2 w-full accent-sky-400"
              />

              <div className="mt-4 grid grid-cols-2 gap-3">
                <label className="text-xs tracking-wide text-zinc-400 uppercase">
                  Tier
                  <select
                    value={tier}
                    onChange={(e) => setTier(e.target.value as Tier)}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-2 py-2 font-mono text-sm text-white outline-none"
                  >
                    <option value="low">low · 600</option>
                    <option value="mid">mid · 2000</option>
                    <option value="high">high · 6000</option>
                  </select>
                </label>
                <label className="text-xs tracking-wide text-zinc-400 uppercase">
                  Seed
                  <input
                    type="number"
                    value={seed}
                    onChange={(e) => setSeed(Number(e.target.value) || 0)}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-2 py-2 font-mono text-sm text-white outline-none"
                  />
                </label>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-baseline justify-between">
                <h2 className="text-xs tracking-[0.2em] text-zinc-400 uppercase">Instances</h2>
                <p className="font-mono text-lg text-white">{total}</p>
              </div>
              <ul className="mt-3 space-y-2">
                {kinds.map((k) => {
                  const n = counts[k];
                  const pct = total === 0 ? 0 : (n / total) * 100;
                  return (
                    <li key={k}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2 capitalize">
                          <span
                            className="inline-block h-2.5 w-2.5 rounded-full"
                            style={{ background: KIND_COLOR[k] }}
                          />
                          {k}
                        </span>
                        <span className="font-mono text-zinc-300">{n}</span>
                      </div>
                      <div className="h-1 overflow-hidden rounded bg-white/10">
                        <div
                          className="h-full rounded"
                          style={{ width: `${pct}%`, background: KIND_COLOR[k] }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-xs leading-relaxed text-zinc-400">
              <p className="tracking-[0.2em] text-zinc-500 uppercase">Cover</p>
              <p className="mt-2">
                Dust grey, moss dark green, grass light green, wet blue. Orange triangles are
                machines (keep-out). Dashed pad is a keep-out rectangle.
              </p>
              <p className="mt-2 text-zinc-500">
                Tufts bloom near machines at 2, bushes hug water at 4, forest from 5.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
