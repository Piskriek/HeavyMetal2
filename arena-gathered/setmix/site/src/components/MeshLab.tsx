import { useEffect, useMemo, useRef, useState } from "react";
import {
  meshPolicyFor,
  toSmoothvoxRequest,
  profileSample,
  profileSampleStitched,
  minPolicy,
  seamKeyFor,
  seamsAgree,
  type MeshPolicy,
} from "@/engine/setmix/mesh";
import { deriveBudget, DEVICES, normalised, type FidelityState } from "@/engine/setmix/core";
import { cn } from "@/utils/cn";

/* deterministic terrain */
function h2(x: number, y: number) {
  let n = (x * 374761393 + y * 668265263) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}
function vn(x: number, y: number) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const fx = x - xi, fy = y - yi;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = h2(xi, yi), b = h2(xi + 1, yi), c = h2(xi, yi + 1), d = h2(xi + 1, yi + 1);
  return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
}
const height = (x: number, z: number) =>
  (vn(x * 0.045 + 11, z * 0.045 + 5) - 0.5) * 20 + (vn(x * 0.14 + 3, z * 0.14 + 9) - 0.5) * 5;

const SPAN = 96; // metres across the profile

export default function MeshLab() {
  const [vtxExp, setVtxExp] = useState(3.1); // log10(Vtx)
  const [stitch, setStitch] = useState(true);
  const [skirt, setSkirt] = useState(true);
  const [showVerts, setShowVerts] = useState(true);

  // balanced across all four metrics so the coherence term C ≈ 1 and the
  // reported stage is the one the Vtx slider actually implies
  const state: FidelityState = useMemo(() => {
    const v = 10 ** vtxExp;
    return { pxd: v * 1.32, vtx: v, lx: v * 0.7, aq: v * 0.44, tick: 0 };
  }, [vtxExp]);
  const budget = useMemo(() => deriveBudget(state, DEVICES[2]), [state]);
  const policy = useMemo(() => meshPolicyFor(state, budget), [state, budget]);
  const req = useMemo(() => toSmoothvoxRequest(policy, budget), [policy, budget]);

  /* the neighbour across the seam is always 2 stages behind the wave front */
  const nbState: FidelityState = useMemo(
    () => ({ pxd: 7.9e2, vtx: 6e2, lx: 4.2e2, aq: 2.6e2, tick: 0 }),
    [],
  );
  const nbPolicy = useMemo(() => meshPolicyFor(nbState, deriveBudget(nbState, DEVICES[2])), [nbState]);
  const shared = useMemo(() => minPolicy(policy, nbPolicy), [policy, nbPolicy]);

  const ladderRef = useRef<HTMLCanvasElement>(null);
  const seamRef = useRef<HTMLCanvasElement>(null);

  /* ---------------- ladder canvas ---------------- */
  useEffect(() => {
    const cv = ladderRef.current;
    if (!cv) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = Math.max(280, Math.round(cv.getBoundingClientRect().width * dpr));
    const H = Math.round(210 * dpr);
    cv.width = W; cv.height = H;
    const g = cv.getContext("2d")!;
    g.fillStyle = "#06080d"; g.fillRect(0, 0, W, H);

    const yB = H * 0.68, yS = 3.4 * dpr;
    const toX = (wx: number) => ((wx + SPAN / 2) / SPAN) * W;

    // cell grid
    g.strokeStyle = "rgba(27,36,52,0.9)"; g.lineWidth = 1;
    for (let x = -SPAN / 2; x <= SPAN / 2; x += policy.cellSize) {
      g.beginPath(); g.moveTo(toX(x), 0); g.lineTo(toX(x), H); g.stroke();
    }

    // ground truth SDF
    g.beginPath();
    for (let i = 0; i <= 400; i++) {
      const wx = -SPAN / 2 + (i / 400) * SPAN;
      const y = yB - height(wx, 0) * yS;
      i ? g.lineTo(toX(wx), y) : g.moveTo(toX(wx), y);
    }
    g.strokeStyle = "rgba(107,122,144,0.45)"; g.setLineDash([4, 4]); g.lineWidth = 1; g.stroke();
    g.setLineDash([]);

    // meshed surface
    const pts: [number, number][] = [];
    const step = Math.max(0.12, policy.cellSize / 14);
    for (let wx = -SPAN / 2; wx <= SPAN / 2; wx += step) {
      pts.push([toX(wx), yB - profileSample(wx, height, policy, 0) * yS]);
    }
    g.beginPath();
    pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
    g.strokeStyle = policy.mode === "CUBIC" ? "#8b9bb4" : policy.mode === "CHAMFER" ? "#ffc13d" : "#7cff4d";
    g.lineWidth = 2 * dpr; g.stroke();

    // fill below
    g.lineTo(W, H); g.lineTo(0, H); g.closePath();
    g.fillStyle = policy.mode === "DUAL" ? "rgba(124,255,77,0.07)" : "rgba(139,155,180,0.06)";
    g.fill();

    // vertices at cell boundaries
    if (showVerts) {
      g.fillStyle = "#ffffff";
      for (let wx = -SPAN / 2; wx <= SPAN / 2 + 0.001; wx += policy.cellSize) {
        const y = yB - profileSample(wx, height, policy, 0) * yS;
        g.fillRect(toX(wx) - 1.6 * dpr, y - 1.6 * dpr, 3.2 * dpr, 3.2 * dpr);
      }
    }

    g.font = `${9.5 * dpr}px ui-monospace, monospace`;
    g.fillStyle = "#6b7a90";
    g.fillText("— — true SDF", 6 * dpr, 13 * dpr);
    g.fillStyle = "#e8eef7";
    g.fillText(`${policy.mode} · cell ${policy.cellSize} m · relax ×${policy.relaxIterations}`, 6 * dpr, 26 * dpr);
  }, [policy, showVerts]);

  /* ---------------- seam canvas ---------------- */
  useEffect(() => {
    const cv = seamRef.current;
    if (!cv) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = Math.max(280, Math.round(cv.getBoundingClientRect().width * dpr));
    const H = Math.round(210 * dpr);
    cv.width = W; cv.height = H;
    const g = cv.getContext("2d")!;
    g.fillStyle = "#06080d"; g.fillRect(0, 0, W, H);

    const yB = H * 0.6, yS = 3.4 * dpr;
    const EDGE = 0;
    const toX = (wx: number) => ((wx + SPAN / 2) / SPAN) * W;

    // chunk tint
    g.fillStyle = "rgba(124,255,77,0.045)"; g.fillRect(0, 0, toX(EDGE), H);
    g.fillStyle = "rgba(139,155,180,0.05)"; g.fillRect(toX(EDGE), 0, W - toX(EDGE), H);

    const drawSide = (from: number, to: number, pol: MeshPolicy, other: MeshPolicy, col: string) => {
      const step = Math.max(0.1, pol.cellSize / 16);
      g.beginPath();
      let first = true;
      const yOf = (wx: number) =>
        yB - (stitch ? profileSampleStitched(wx, height, pol, other, EDGE, 0) : profileSample(wx, height, pol, 0)) * yS;
      for (let wx = from; wx <= to + 1e-6; wx += step) {
        const y = yOf(wx);
        first ? (g.moveTo(toX(wx), y), (first = false)) : g.lineTo(toX(wx), y);
      }
      g.strokeStyle = col; g.lineWidth = 2.2 * dpr; g.stroke();

      if (skirt) {
        const yEdge = yOf(EDGE);
        const sx = toX(EDGE);
        const left = to === EDGE;
        g.fillStyle = "rgba(180,107,255,0.22)";
        g.fillRect(left ? sx - 3 * dpr : sx, yEdge, 3 * dpr, Math.max(4, pol.cellSize * 1.5 * yS));
      }
      return yOf;
    };

    const yL = drawSide(-SPAN / 2, EDGE, policy, nbPolicy, "#7cff4d");
    const yR = drawSide(EDGE, SPAN / 2, nbPolicy, policy, "#8b9bb4");

    // the seam
    const a = yL(EDGE), b = yR(EDGE);
    const gap = Math.abs(a - b);
    g.strokeStyle = "rgba(180,107,255,0.6)"; g.setLineDash([3, 3]); g.lineWidth = 1;
    g.beginPath(); g.moveTo(toX(EDGE), 0); g.lineTo(toX(EDGE), H); g.stroke();
    g.setLineDash([]);

    if (gap > 1.2) {
      g.strokeStyle = "#ff3d8a"; g.lineWidth = 3 * dpr;
      g.beginPath(); g.moveTo(toX(EDGE), a); g.lineTo(toX(EDGE), b); g.stroke();
      g.fillStyle = "#ff3d8a";
      g.font = `bold ${10 * dpr}px ui-monospace, monospace`;
      g.fillText(`CRACK ${(gap / yS).toFixed(2)} m`, toX(EDGE) + 6 * dpr, Math.min(a, b) - 8 * dpr);
    } else {
      g.fillStyle = "#7cff4d";
      g.beginPath(); g.arc(toX(EDGE), a, 4 * dpr, 0, 6.2832); g.fill();
      g.font = `bold ${10 * dpr}px ui-monospace, monospace`;
      g.fillText("WELDED · Δ 0.00 m", toX(EDGE) + 8 * dpr, a - 10 * dpr);
    }

    g.font = `${9.5 * dpr}px ui-monospace, monospace`;
    g.fillStyle = "#7cff4d";
    g.fillText(`CHUNK A · ${policy.mode} ${policy.cellSize} m`, 6 * dpr, 14 * dpr);
    g.fillStyle = "#8b9bb4";
    const lbl = `CHUNK B · ${nbPolicy.mode} ${nbPolicy.cellSize} m`;
    g.fillText(lbl, W - g.measureText(lbl).width - 6 * dpr, 14 * dpr);
    if (skirt) {
      g.fillStyle = "rgba(180,107,255,0.8)";
      g.fillText("▮ skirt apron", 6 * dpr, H - 8 * dpr);
    }
  }, [policy, nbPolicy, stitch, skirt]);

  const agree = seamsAgree(policy, nbPolicy, [0, 0], "E", "W");
  const n = normalised(state);

  return (
    <div className="fi-panel border border-line bg-panel">
      <div className="grid lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="grid gap-3 border-b border-line p-3 sm:grid-cols-2 lg:border-r lg:border-b-0">
          <div>
            <div className="mono mb-1 flex items-center justify-between text-[9px] tracking-[0.18em] text-dim uppercase">
              <span>Vtx → dual-contouring ladder</span>
              <span className="tnum text-chalk">S{policy.stage}</span>
            </div>
            <canvas ref={ladderRef} className="w-full border border-line" style={{ height: 210 }} />
          </div>
          <div>
            <div className="mono mb-1 flex items-center justify-between text-[9px] tracking-[0.18em] text-dim uppercase">
              <span>Seam · A(swept) ⟷ B(dormant)</span>
              <span className={cn("tnum", stitch ? "text-vtx" : "text-pxd")}>
                {stitch ? "stitched" : "naive"}
              </span>
            </div>
            <canvas ref={seamRef} className="w-full border border-line" style={{ height: 210 }} />
          </div>
        </div>

        <div className="p-3">
          <div className="mono mb-1 flex justify-between text-[9.5px]">
            <span className="text-dim">Geometric Flux</span>
            <span className="tnum text-vtx">{(10 ** vtxExp).toExponential(2)}</span>
          </div>
          <input
            type="range" min={2} max={7.98} step={0.01} value={vtxExp}
            onChange={(e) => setVtxExp(+e.target.value)}
            className="w-full" style={{ ["--thumb" as string]: "#7cff4d" }}
          />
          <div className="mono mt-1 grid grid-cols-6 gap-px">
            {[2.2, 3.3, 4.4, 5.5, 6.4, 7.4].map((v, i) => (
              <button
                key={v}
                onClick={() => setVtxExp(v)}
                className={cn(
                  "border py-1 text-[8px] font-bold",
                  policy.stage === i + 1
                    ? "border-transparent bg-chalk text-void"
                    : "border-line text-dim hover:text-chalk",
                )}
              >
                S{i + 1}
              </button>
            ))}
          </div>

          <div className="mt-3 space-y-0">
            {([
              ["mode", policy.mode, policy.mode === "DUAL" ? "#7cff4d" : policy.mode === "CHAMFER" ? "#ffc13d" : "#8b9bb4"],
              ["cellSize", `${policy.cellSize} m`, undefined],
              ["lod", `L${policy.lod}`, undefined],
              ["chamfer", policy.chamfer.toFixed(3), undefined],
              ["relaxIterations", policy.relaxIterations, undefined],
              ["smoothAngle", `${policy.smoothAngleDeg.toFixed(1)}°`, "#3dc8ff"],
              ["qefClamp", policy.qefClamp.toFixed(3), undefined],
              ["sharpFeature", req.sharpFeatureThreshold.toFixed(3), undefined],
              ["skirtDepth", `${req.skirtDepth.toFixed(2)} m`, undefined],
              ["maxMaterials", req.maxMaterialsPerVertex, undefined],
              ["triplanarSharp", req.triplanarSharpness.toFixed(2), undefined],
            ] as const).map(([k, v, c]) => (
              <div key={k} className="mono flex justify-between border-b border-line/40 py-[3px] text-[9.5px] last:border-0">
                <span className="text-dim">{k}</span>
                <span className="tnum" style={{ color: c }}>{v}</span>
              </div>
            ))}
          </div>

          <div className="mono mt-2 border-t border-line pt-2 text-[9px] leading-snug text-dim">
            180·(1 − e^(−{(10 ** vtxExp).toExponential(1)}/50000)) ={" "}
            <span className="text-aq">{policy.smoothAngleDeg.toFixed(1)}°</span>
            <br />
            n(Vtx) = {n.vtx.toFixed(4)}
          </div>

          <div className="mt-3 space-y-1">
            {([
              ["boundary ownership", stitch, setStitch],
              ["skirt apron", skirt, setSkirt],
              ["show vertices", showVerts, setShowVerts],
            ] as const).map(([k, val, set]) => (
              <button
                key={k}
                onClick={() => (set as (b: boolean) => void)(!val)}
                className={cn(
                  "mono w-full border px-2 py-1 text-left text-[9px] font-bold tracking-[0.12em] uppercase",
                  val ? "border-transparent bg-chalk text-void" : "border-line text-dim hover:text-chalk",
                )}
              >
                {val ? "◉" : "○"} {k}
              </button>
            ))}
          </div>

          <div className="mono mt-3 border border-line bg-void2 p-2 text-[9px] leading-snug">
            <div className="text-dim">shared policy</div>
            <div className="text-chalk">{shared.mode} · {shared.cellSize} m</div>
            <div className="mt-1 text-dim">seamKey A/B</div>
            <div className="text-flux">{seamKeyFor(shared, "E", [0, 0])}</div>
            <div className={agree ? "mt-1 text-vtx" : "mt-1 text-pxd"}>
              {agree ? "✓ neighbours agree — crack impossible" : "✕ divergent"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
