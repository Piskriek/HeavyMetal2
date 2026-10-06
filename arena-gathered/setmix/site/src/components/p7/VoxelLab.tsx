import { useEffect, useRef, useState } from "react";
import {
  makeField, applyBrush, sampleField, fieldStats, surfaceNets, CHUNK,
  type VolumetricField, type BrushMode,
} from "@/drop/VolumetricVoxelField";
import { VoxelWorkerPool, createInlineSpawner, type PoolStats } from "@/drop/VoxelWorker";
import { cn } from "@/utils/cn";

const VOX = 0.5;                       // metres per voxel
const SPAN = CHUNK * VOX;              // 16 m per chunk

function h2(x: number, y: number, z: number) {
  let n = (x * 374761393 + y * 668265263 + z * 1442695040) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}
function vn3(x: number, y: number, z: number) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const fx = x - xi, fy = y - yi, fz = z - zi;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz);
  const L = (a: number, b: number, t: number) => a + (b - a) * t;
  const c = (dx: number, dy: number, dz: number) => h2(xi + dx, yi + dy, zi + dz);
  return L(L(L(c(0,0,0), c(1,0,0), u), L(c(0,1,0), c(1,1,0), u), v),
           L(L(c(0,0,1), c(1,0,1), u), L(c(0,1,1), c(1,1,1), u), v), w);
}
/** Analytic terrain SDF: a rolling surface with a natural cave system below. */
const terrainSDF = (x: number, y: number, z: number) => {
  const surface = 6 + (vn3(x * 0.035, 0, z * 0.035) - 0.5) * 9
                    + (vn3(x * 0.011, 7, z * 0.011) - 0.5) * 16;
  let d = y - surface;
  const cave = (vn3(x * 0.06 + 3, y * 0.08, z * 0.06 + 11) - 0.5) * 2;
  if (y < surface - 3) d = Math.max(d, -(Math.abs(cave) - 0.28) * 7);
  return d;
};

export default function VoxelLab() {
  const ref = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState<BrushMode>("SUBTRACT");
  const [radius, setRadius] = useState(2.8);
  const [smoothK, setSmoothK] = useState(0.6);
  const [autoBeam, setAutoBeam] = useState(true);
  const [slice, setSlice] = useState(0);
  const [stats, setStats] = useState({ alloc: 0, authored: 0, edits: 0, mb: 0, hollow: 0 });
  const [pool, setPool] = useState<PoolStats | null>(null);
  const [mesh, setMesh] = useState({ tris: 0, lastMs: 0 });

  const cfg = useRef({ mode, radius, smoothK, autoBeam, slice });
  cfg.current = { mode, radius, smoothK, autoBeam, slice };
  const fieldRef = useRef<VolumetricField | null>(null);
  const beamRef = useRef<{ x: number; y: number; z: number } | null>(null);

  useEffect(() => {
    const field = makeField(VOX, terrainSDF);
    fieldRef.current = field;

    const wp = new VoxelWorkerPool(
      createInlineSpawner(),
      (p, ret) => {
        const c = field.chunks.get(p.key);
        if (c) { c.sdf = ret.sdf; c.mat = ret.mat; c.dirty = null; }
        setMesh((m) => ({ tris: p.tris, lastMs: m.lastMs }));
      },
      3,
    );

    let raf = 0, last = performance.now(), t = 0;

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const c = cfg.current;
      const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;

      /* ── the extraction beam carves a tunnel ─────────────────────── */
      if (c.autoBeam) {
        const bx = Math.sin(t * 0.42) * 22;
        const bz = Math.cos(t * 0.31) * 18;
        const by = 2 + Math.sin(t * 0.7) * 5;
        beamRef.current = { x: bx, y: by, z: bz };
        const touched = applyBrush(field, {
          mode: c.mode, shape: "SPHERE", centre: [bx, by, bz],
          radius: c.radius, strength: 0.5, material: 3, smoothK: c.smoothK,
        });
        for (const key of touched) {
          const ch = field.chunks.get(key);
          if (!ch || !ch.dirty) continue;
          const d2 = (ch.cx * SPAN - bx) ** 2 + (ch.cz * SPAN - bz) ** 2;
          wp.request(ch, VOX, d2);
        }
      }

      /* ── render an SDF slice ─────────────────────────────────────── */
      const cv = ref.current;
      if (cv) {
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const r = cv.getBoundingClientRect();
        const W = Math.round(r.width * dpr), H = Math.round(r.height * dpr);
        if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
        const g = cv.getContext("2d")!;
        g.fillStyle = "#05070c"; g.fillRect(0, 0, W, H);

        const RES = 150;
        const EXT = 44;                               // ±metres
        const px = W / RES, py = H / RES;
        const zSlice = c.slice;
        const t0 = performance.now();

        for (let j = 0; j < RES; j++) {
          for (let i = 0; i < RES; i++) {
            const wx = -EXT + (i / RES) * EXT * 2;
            const wy = 22 - (j / RES) * 48;
            const d = sampleField(field, wx, wy, zSlice);
            let col: string;
            if (d < 0) {
              // solid rock, shaded by depth below the surface
              const deep = Math.min(1, -d / 10);
              const n = vn3(wx * 0.3, wy * 0.3, zSlice * 0.3);
              const v = 44 + deep * 34 + n * 26;
              col = `rgb(${v * 0.92},${v * 0.86},${v * 0.8})`;
            } else if (d < 0.55) {
              col = "#7cff4d";                       // the iso-surface itself
            } else if (d < 2.4) {
              const a = 1 - (d - 0.55) / 1.85;
              col = `rgba(60,90,70,${a * 0.4})`;      // near-surface air
            } else {
              col = "#070b12";
            }
            g.fillStyle = col;
            g.fillRect(i * px, j * py, px + 1, py + 1);
          }
        }

        // chunk boundaries
        g.strokeStyle = "rgba(180,107,255,0.22)"; g.lineWidth = 1;
        for (let m = -3; m <= 3; m++) {
          const x = ((m * SPAN + EXT) / (EXT * 2)) * W;
          g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke();
          const y = ((22 - m * SPAN) / 48) * H;
          g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke();
        }

        // the beam
        const b = beamRef.current;
        if (b && Math.abs(b.z - zSlice) < c.radius) {
          const bx = ((b.x + EXT) / (EXT * 2)) * W;
          const by = ((22 - b.y) / 48) * H;
          const br = (c.radius / (EXT * 2)) * W;
          g.strokeStyle = "rgba(255,61,138,0.95)"; g.lineWidth = 2 * dpr;
          g.beginPath(); g.arc(bx, by, br, 0, 6.28); g.stroke();
          g.strokeStyle = "rgba(255,61,138,0.35)";
          g.beginPath(); g.moveTo(bx, 0); g.lineTo(bx, by); g.stroke();
        }

        g.font = `${9.5 * dpr}px ui-monospace, monospace`;
        g.fillStyle = "#6b7a90";
        g.fillText(`SDF slice  z = ${zSlice.toFixed(1)} m   ·   32³ chunks @ ${VOX} m/voxel`, 7 * dpr, 15 * dpr);
        setMesh((m) => ({ ...m, lastMs: performance.now() - t0 }));
      }

      const s = fieldStats(field);
      setStats({ alloc: s.allocated, authored: s.authored, edits: s.edits, mb: s.megabytes, hollow: s.hollowRatio });
      setPool(wp.getStats());
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); wp.dispose(); };
  }, []);

  const resetField = () => {
    const f = fieldRef.current;
    if (!f) return;
    f.chunks.clear(); f.allocated = 0; f.edits = 0; f.bytes = 0;
  };

  const benchmark = () => {
    const sdf = new Float32Array(CHUNK ** 3);
    const mat = new Uint8Array(CHUNK ** 3);
    for (let z = 0; z < CHUNK; z++)
      for (let y = 0; y < CHUNK; y++)
        for (let x = 0; x < CHUNK; x++)
          sdf[(z * CHUNK + y) * CHUNK + x] = Math.hypot(x - 16, y - 16, z - 16) - 11;
    const t0 = performance.now();
    const r = surfaceNets(sdf, mat, VOX, [0, 0, 0], "bench", 1);
    setMesh({ tris: r.tris, lastMs: performance.now() - t0 });
  };

  return (
    <div className="fi-panel border border-line bg-panel">
      <div className="grid lg:grid-cols-[minmax(0,1fr)_282px]">
        <div className="border-b border-line lg:border-r lg:border-b-0">
          <canvas ref={ref} className="w-full bg-void" style={{ aspectRatio: "16/10" }} />
        </div>
        <div className="p-3">
          <div className="mono mb-1 text-[9px] tracking-[0.2em] text-dim uppercase">CSG brush</div>
          <div className="grid grid-cols-2 gap-1">
            {(["SUBTRACT", "ADD", "SMOOTH", "FLATTEN"] as const).map((m) => (
              <button key={m} onClick={() => setMode(m)}
                className={cn("mono border px-1 py-1 text-[8.5px] font-bold",
                  mode === m ? "border-transparent bg-chalk text-void" : "border-line text-dim hover:text-chalk")}>
                {m}
              </button>
            ))}
          </div>
          {([
            ["radius", radius, 1, 6, 0.1, setRadius, "m"],
            ["smooth k", smoothK, 0, 2.5, 0.05, setSmoothK, ""],
            ["slice z", slice, -24, 24, 0.5, setSlice, "m"],
          ] as const).map(([k, v, mn, mx, st, set, u]) => (
            <div key={k} className="mt-1.5">
              <div className="mono flex justify-between text-[9.5px]">
                <span className="text-dim">{k}</span>
                <span className="tnum text-chalk">{v.toFixed(st < 1 ? 1 : 0)}{u}</span>
              </div>
              <input type="range" min={mn} max={mx} step={st} value={v}
                onChange={(e) => (set as (n: number) => void)(+e.target.value)} className="w-full" />
            </div>
          ))}
          <div className="mt-2 grid grid-cols-3 gap-1">
            <button onClick={() => setAutoBeam(!autoBeam)}
              className={cn("mono border px-1 py-1.5 text-[8.5px] font-bold uppercase",
                autoBeam ? "border-transparent bg-pxd text-void" : "border-line text-dim")}>
              {autoBeam ? "■ beam" : "▶ beam"}
            </button>
            <button onClick={benchmark}
              className="mono border border-line px-1 py-1.5 text-[8.5px] font-bold text-dim uppercase hover:text-chalk">
              bench
            </button>
            <button onClick={resetField}
              className="mono border border-line px-1 py-1.5 text-[8.5px] font-bold text-dim uppercase hover:text-chalk">
              reset
            </button>
          </div>

          <div className="mt-3 border-t border-line pt-2">
            <div className="mono mb-1 text-[9px] tracking-[0.2em] text-dim uppercase">Sparse field</div>
            {([
              ["chunks allocated", stats.alloc, "#b46bff"],
              ["authored", stats.authored, "#7cff4d"],
              ["csg edits", stats.edits.toLocaleString(), "#ff3d8a"],
              ["resident", `${stats.mb.toFixed(2)} MB`, "var(--fi-accent)"],
              ["hollow ratio", `${(stats.hollow * 100).toFixed(1)}%`, "#3dc8ff"],
            ] as const).map(([k, v, c]) => (
              <div key={k} className="mono flex justify-between border-b border-line/40 py-[3px] text-[9.5px] last:border-0">
                <span className="text-dim">{k}</span>
                <span className="tnum" style={{ color: c }}>{v}</span>
              </div>
            ))}
          </div>

          {pool && (
            <div className="mt-2 border-t border-line pt-2">
              <div className="mono mb-1 text-[9px] tracking-[0.2em] text-dim uppercase">Worker pool</div>
              {([
                ["workers", pool.workers, "#8b9bb4"],
                ["in flight", pool.inFlight, "#ffc13d"],
                ["queued / peak", `${pool.queued} / ${pool.peakQueue}`, "#8b9bb4"],
                ["completed", pool.completed.toLocaleString(), "#7cff4d"],
                ["dropped stale", pool.droppedStale.toLocaleString(), pool.droppedStale ? "#ff3d8a" : "#6b7a90"],
                ["mesh ms (worker)", pool.avgMeshMs.toFixed(2), "#b46bff"],
                ["adopt ms (main)", pool.avgAdoptMs.toFixed(3), "#7cff4d"],
                ["last mesh tris", mesh.tris.toLocaleString(), "var(--fi-accent)"],
              ] as const).map(([k, v, c]) => (
                <div key={k} className="mono flex justify-between border-b border-line/40 py-[3px] text-[9.5px] last:border-0">
                  <span className="text-dim">{k}</span>
                  <span className="tnum" style={{ color: c }}>{v}</span>
                </div>
              ))}
            </div>
          )}

          <p className="mono mt-2 text-[9px] leading-snug text-dim">
            Chunks allocate <em className="not-italic text-chalk">lazily</em>, seeded from the
            analytic terrain — so an untouched world costs 0 MB and digging into virgin rock needs
            no pre-pass. <span className="text-pxd">dropped stale</span> counts meshes that
            returned describing a cave the beam had already moved past.
          </p>
        </div>
      </div>
    </div>
  );
}
