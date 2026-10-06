import { useEffect, useRef, useState } from "react";
import { STAGES, METRICS } from "@/data/gdd";
import {
  useFi,
  clamp,
  lerp,
  smoothstep,
  hexToRgb,
  fmtBig,
  metricsFromT,
  METRIC_TARGETS,
} from "@/state/fi";
import { Slider, Tag } from "@/components/ui";
import { cn } from "@/utils/cn";

/* ----------------------------------------------------------------- noise */
function hash(x: number, y: number) {
  let n = (x * 374761393 + y * 668265263) | 0;
  n = Math.imul(n ^ (n >> 13), 1274126177);
  return ((n ^ (n >> 16)) >>> 0) / 4294967295;
}
function vnoise(x: number, y: number) {
  const xi = Math.floor(x),
    yi = Math.floor(y);
  const xf = x - xi,
    yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi),
    b = hash(xi + 1, yi),
    c = hash(xi, yi + 1),
    d = hash(xi + 1, yi + 1);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}
function fbm(x: number, y: number, oct: number) {
  let amp = 1,
    f = 1,
    s = 0,
    n = 0;
  for (let i = 0; i < oct; i++) {
    s += amp * vnoise(x * f, y * f);
    n += amp;
    amp *= 0.52;
    f *= 2.03;
  }
  return s / n;
}
const WORLD = 160; // metres across
function height(x: number, z: number, oct: number) {
  const base = fbm(x * 0.022 + 31.7, z * 0.022 + 12.3, oct);
  const d = Math.min(Math.hypot(x, z) / 62, 1.3);
  return (base - 0.44) * 34 + d * d * 11 - 6;
}

const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

type Geo = { key: string; N: number; vh: Float32Array; ch: Float32Array };

/* =========================================================== COMPONENT */
export default function FidelityEngine() {
  const { t, tRef, setT, auto, setAuto, stage, fi, m } = useFi();
  const [wire, setWire] = useState(false);
  const [orbit, setOrbit] = useState(true);
  const [stats, setStats] = useState({ ms: 0, tris: 0, res: "", pal: "" });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({ wire, orbit, tRef });
  stateRef.current = { wire, orbit, tRef };
  const waveRef = useRef<number>(-1);
  const yawRef = useRef(0.6);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const dctx = canvas.getContext("2d", { alpha: false })!;
    const off = document.createElement("canvas");
    const octx = off.getContext("2d", { alpha: false, willReadFrequently: true })!;

    let geo: Geo | null = null;
    const colorCache = new Map<number, string>();
    const stars = Array.from({ length: 220 }, () => ({
      x: Math.random(),
      y: Math.random() * 0.62,
      b: 0.3 + Math.random() * 0.7,
    }));
    const motes = Array.from({ length: 54 }, (_, i) => ({
      p: i / 54,
      a: Math.random() * 6.28,
      r: 1 + Math.random() * 3,
    }));
    const rain = Array.from({ length: 150 }, () => ({
      x: Math.random(),
      y: Math.random(),
      s: 0.4 + Math.random() * 0.8,
    }));

    const css = (r0: number, g0: number, b0: number) => {
      const r = r0 < 0 ? 0 : r0 > 255 ? 255 : r0 | 0;
      const g = g0 < 0 ? 0 : g0 > 255 ? 255 : g0 | 0;
      const b = b0 < 0 ? 0 : b0 > 255 ? 255 : b0 | 0;
      const k = ((r >> 2) << 12) | ((g >> 2) << 6) | (b >> 2);
      let s = colorCache.get(k);
      if (!s) {
        s = `rgb(${r},${g},${b})`;
        if (colorCache.size < 9000) colorCache.set(k, s);
      }
      return s;
    };

    let raf = 0;
    let last = performance.now();
    let frameAcc = 0;
    let frameN = 0;
    let statTimer = 0;

    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      const t0 = performance.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const S = stateRef.current;
      const tt = S.tRef.current;
      const mm = metricsFromT(tt);

      /* ---------- display surface ---------- */
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const dw = Math.max(320, Math.round(rect.width * dpr));
      const dh = Math.max(200, Math.round(rect.height * dpr));
      if (canvas.width !== dw || canvas.height !== dh) {
        canvas.width = dw;
        canvas.height = dh;
      }

      /* ---------- fidelity-driven parameters ---------- */
      const iw = Math.round(lerp(150, Math.min(1000, dw), Math.pow(mm.pxd, 0.8)) / 2) * 2;
      const ih = Math.round((iw * dh) / dw);
      if (off.width !== iw || off.height !== ih) {
        off.width = iw;
        off.height = ih;
      }

      const N = Math.round(lerp(16, 58, Math.pow(mm.vtx, 0.75)));
      const oct = 1 + Math.floor(mm.pxd * 4.6);
      const blocky = clamp(1 - smoothstep(0.04, 0.46, mm.vtx));
      const step = lerp(0.6, 7.5, blocky);
      const lightMode = mm.lx; // 0 unlit → 1 full
      const seaRaw = mm.aq;
      const sea = -20 + seaRaw * 23;
      const hasWater = seaRaw > 0.05;
      const fogAmt = smoothstep(0.18, 0.8, mm.lx) * 0.85;

      /* ---------- palettes ---------- */
      const sIdx = clamp(Math.floor(tt * 6), 0, 5);
      const sLoc = clamp(tt * 6 - sIdx);
      const A = STAGES[sIdx],
        B = STAGES[Math.min(5, sIdx + 1)];
      const pal: number[][] = A.palette.map((c, i) =>
        hexToRgb(c).map((v, k) => lerp(v, hexToRgb(B.palette[i])[k], sLoc)),
      );
      const skyTop = hexToRgb(A.sky[0]).map((v, k) => lerp(v, hexToRgb(B.sky[0])[k], sLoc));
      const skyHor = hexToRgb(A.sky[1]).map((v, k) => lerp(v, hexToRgb(B.sky[1])[k], sLoc));
      const waterCol = hexToRgb(A.water ?? "#12405e").map((v, k) =>
        lerp(v, hexToRgb(B.water ?? A.water ?? "#12405e")[k], sLoc),
      );

      /* ---------- geometry cache ---------- */
      const key = `${N}/${oct}`;
      if (!geo || geo.key !== key) {
        const vh = new Float32Array((N + 1) * (N + 1));
        const ch = new Float32Array(N * N);
        const cell = WORLD / N;
        for (let j = 0; j <= N; j++)
          for (let i = 0; i <= N; i++)
            vh[j * (N + 1) + i] = height(-WORLD / 2 + i * cell, -WORLD / 2 + j * cell, oct);
        for (let j = 0; j < N; j++)
          for (let i = 0; i < N; i++)
            ch[j * N + i] = height(
              -WORLD / 2 + (i + 0.5) * cell,
              -WORLD / 2 + (j + 0.5) * cell,
              oct,
            );
        geo = { key, N, vh, ch };
      }

      /* ---------- camera ---------- */
      if (S.orbit) yawRef.current += dt * 0.075;
      const yaw = yawRef.current;
      const camDist = 185,
        camH = 45 + mm.aq * 3;
      const pitch = Math.atan(camH / camDist);
      const f = iw * 0.62;
      const cx = iw / 2,
        cy = ih * 0.47;
      const cy_ = Math.cos(yaw),
        sy_ = Math.sin(yaw);
      const cp = Math.cos(pitch),
        sp = Math.sin(pitch);

      const px = new Float32Array(4),
        py = new Float32Array(4);
      let pdepth = 0;
      const project = (x: number, y: number, z: number, k: number) => {
        const rx = x * cy_ - z * sy_;
        const rz = x * sy_ + z * cy_ + camDist;
        const ry = y - camH;
        const z2 = rz * cp - ry * sp;
        const yb = ry * cp + rz * sp;
        pdepth = z2;
        px[k] = cx + (rx * f) / Math.max(1, z2);
        py[k] = cy - (yb * f) / Math.max(1, z2);
      };

      /* ---------- SKY ---------- */
      const g = octx.createLinearGradient(0, 0, 0, ih);
      g.addColorStop(0, css(skyTop[0], skyTop[1], skyTop[2]));
      g.addColorStop(0.72, css(skyHor[0], skyHor[1], skyHor[2]));
      g.addColorStop(1, css(skyHor[0] * 0.8, skyHor[1] * 0.8, skyHor[2] * 0.85));
      octx.fillStyle = g;
      octx.fillRect(0, 0, iw, ih);

      const starA = clamp(1 - mm.lx * 2.1);
      if (starA > 0.01) {
        octx.fillStyle = `rgba(255,255,255,${starA})`;
        for (const s of stars) {
          if (s.b < 0.55 && mm.pxd < 0.2) continue;
          octx.fillRect((s.x * iw) | 0, (s.y * ih) | 0, 1, 1);
        }
      }
      // sun
      if (mm.lx > 0.05) {
        const sunx = cx + Math.cos(yaw - 2.1) * iw * 0.42;
        const suny = ih * (0.3 - mm.lx * 0.06);
        const rad = lerp(2, 26, mm.lx);
        const sg = octx.createRadialGradient(sunx, suny, 0, sunx, suny, rad * 4);
        sg.addColorStop(0, `rgba(255,248,224,${0.3 + mm.lx * 0.7})`);
        sg.addColorStop(0.18, `rgba(255,226,170,${0.22 * mm.lx})`);
        sg.addColorStop(1, "rgba(255,200,120,0)");
        octx.fillStyle = sg;
        octx.fillRect(sunx - rad * 4, suny - rad * 4, rad * 8, rad * 8);
      }
      // clouds
      if (mm.aq > 0.08) {
        const ca = clamp((mm.aq - 0.08) * 1.4) * 0.5;
        for (let i = 0; i < 7; i++) {
          const cxx = (((i * 0.37 + yaw * 0.06) % 1) * 1.3 - 0.15) * iw;
          const cyy = ih * (0.1 + ((i * 7919) % 13) / 90);
          const cr = iw * (0.07 + ((i * 31) % 7) / 60);
          const cg = octx.createRadialGradient(cxx, cyy, 0, cxx, cyy, cr);
          cg.addColorStop(0, `rgba(255,255,255,${ca})`);
          cg.addColorStop(1, "rgba(255,255,255,0)");
          octx.fillStyle = cg;
          octx.fillRect(cxx - cr, cyy - cr, cr * 2, cr * 2);
        }
      }

      /* ---------- TERRAIN ---------- */
      const Ng = geo.N,
        cell = WORLD / Ng;
      const count = Ng * Ng;
      const depths = new Float32Array(count);
      const order = new Int32Array(count);
      for (let j = 0; j < Ng; j++) {
        for (let i = 0; i < Ng; i++) {
          const idx = j * Ng + i;
          const wx = -WORLD / 2 + (i + 0.5) * cell;
          const wz = -WORLD / 2 + (j + 0.5) * cell;
          depths[idx] = wx * sy_ + wz * cy_ + camDist;
          order[idx] = idx;
        }
      }
      const ord = Array.from(order).sort((a, b) => depths[b] - depths[a]);

      // light dir
      const L = [Math.cos(yaw - 2.1) * 0.55, 0.72, -0.42];
      const Ll = Math.hypot(L[0], L[1], L[2]);
      L[0] /= Ll;
      L[1] /= Ll;
      L[2] /= Ll;

      // bloom wave
      let waveR = -1;
      if (waveRef.current >= 0) {
        waveRef.current += dt;
        waveR = 96 * (1 - Math.exp(-waveRef.current / 2.4));
        if (waveRef.current > 13) waveRef.current = -1;
      }
      const band = 11;

      octx.lineJoin = "bevel";
      let tris = 0;
      const time = now / 1000;
      const spireI = Math.floor(Ng * 0.5) + 2;
      const spireJ = Math.floor(Ng * 0.5) - 3;

      for (let o = 0; o < count; o++) {
        const idx = ord[o];
        const i = idx % Ng,
          j = (idx / Ng) | 0;
        const x0 = -WORLD / 2 + i * cell,
          z0 = -WORLD / 2 + j * cell;
        const x1 = x0 + cell,
          z1 = z0 + cell;
        const vhA = geo.vh;
        const q = Math.round(geo.ch[idx] / step) * step;

        // local fidelity boost inside the bloom wave (alpha-hash dithered band)
        let boost = 0;
        if (waveR > 0) {
          const d = Math.hypot((x0 + x1) / 2, (z0 + z1) / 2);
          if (d < waveR - band) boost = 1;
          else if (d < waveR) boost = hash(i * 13, j * 7) < (waveR - d) / band ? 1 : 0;
        }
        const bl = boost ? blocky * 0.25 : blocky;
        const h00 = lerp(vhA[j * (Ng + 1) + i], q, bl);
        const h10 = lerp(vhA[j * (Ng + 1) + i + 1], q, bl);
        const h11 = lerp(vhA[(j + 1) * (Ng + 1) + i + 1], q, bl);
        const h01 = lerp(vhA[(j + 1) * (Ng + 1) + i], q, bl);

        // normal
        const nx = (h00 + h01 - h10 - h11) * 0.5 * (1 / cell);
        const nz = (h00 + h10 - h01 - h11) * 0.5 * (1 / cell);
        const nl = Math.hypot(nx, 1, nz);
        const ndl = clamp((nx / nl) * L[0] + (1 / nl) * L[1] + (nz / nl) * L[2], 0, 1);
        const slope = clamp(1 - 1 / nl, 0, 1) * 2.2;

        // base colour by altitude band
        const hAvg = (h00 + h10 + h01 + h11) * 0.25;
        let band01 = clamp((hAvg + 20) / 44);
        band01 = clamp(band01 + slope * 0.22 - 0.1);
        const pf = band01 * 3;
        const pi = clamp(Math.floor(pf), 0, 2);
        const pm = pf - pi;
        let r = lerp(pal[pi][0], pal[pi + 1][0], pm);
        let gg = lerp(pal[pi][1], pal[pi + 1][1], pm);
        let bb = lerp(pal[pi][2], pal[pi + 1][2], pm);

        if (boost) {
          r = lerp(r, 255, 0.06);
          gg = lerp(gg, 255, 0.1);
          bb = lerp(bb, 255, 0.06);
        }

        // lighting model ramp
        const amb = lerp(1, 0.42, lightMode);
        const dif = lightMode * (0.3 + 0.95 * ndl);
        const shade = amb + dif;
        r *= shade;
        gg *= shade;
        bb *= shade;

        // wetness near shoreline
        if (hasWater && hAvg < sea + 2.5 && hAvg > sea - 1) {
          const w = clamp((sea + 2.5 - hAvg) / 3.5) * 0.5;
          r = lerp(r, waterCol[0] * 0.8, w);
          gg = lerp(gg, waterCol[1] * 0.8, w);
          bb = lerp(bb, waterCol[2] * 0.8, w);
        }

        // project
        project(x0, h00, z0, 0);
        project(x1, h10, z0, 1);
        project(x1, h11, z1, 2);
        const dmid = pdepth;
        project(x0, h01, z1, 3);
        if (dmid < 4) continue;

        // fog / aerial perspective
        if (fogAmt > 0.01) {
          const fg = clamp((dmid - 60) / 190) * fogAmt;
          r = lerp(r, skyHor[0], fg);
          gg = lerp(gg, skyHor[1], fg);
          bb = lerp(bb, skyHor[2], fg);
        }

        const fill = css(r, gg, bb);
        octx.fillStyle = fill;
        octx.beginPath();
        octx.moveTo(px[0], py[0]);
        octx.lineTo(px[1], py[1]);
        octx.lineTo(px[2], py[2]);
        octx.lineTo(px[3], py[3]);
        octx.closePath();
        octx.fill();
        if (!S.wire) {
          octx.strokeStyle = fill;
          octx.lineWidth = 1;
          octx.stroke();
        } else {
          octx.strokeStyle = "rgba(124,255,77,0.5)";
          octx.lineWidth = 0.5;
          octx.stroke();
        }
        tris += 2;

        // blocky side walls
        if (bl > 0.03) {
          const sideShade = 0.56 + lightMode * 0.1;
          const sc = css(r * sideShade, gg * sideShade, bb * sideShade);
          if (i < Ng - 1) {
            const qn = Math.round(geo.ch[j * Ng + i + 1] / step) * step;
            const n00 = lerp(vhA[j * (Ng + 1) + i + 1], qn, bl);
            const n01 = lerp(vhA[(j + 1) * (Ng + 1) + i + 1], qn, bl);
            if (Math.abs(n00 - h10) > 0.04 || Math.abs(n01 - h11) > 0.04) {
              project(x1, h10, z0, 0);
              project(x1, h11, z1, 1);
              project(x1, n01, z1, 2);
              project(x1, n00, z0, 3);
              octx.fillStyle = sc;
              octx.beginPath();
              octx.moveTo(px[0], py[0]);
              octx.lineTo(px[1], py[1]);
              octx.lineTo(px[2], py[2]);
              octx.lineTo(px[3], py[3]);
              octx.closePath();
              octx.fill();
              if (!S.wire) {
                octx.strokeStyle = sc;
                octx.stroke();
              }
              tris += 2;
            }
          }
          if (j < Ng - 1) {
            const qn = Math.round(geo.ch[(j + 1) * Ng + i] / step) * step;
            const n00 = lerp(vhA[(j + 1) * (Ng + 1) + i], qn, bl);
            const n10 = lerp(vhA[(j + 1) * (Ng + 1) + i + 1], qn, bl);
            if (Math.abs(n00 - h01) > 0.04 || Math.abs(n10 - h11) > 0.04) {
              const s2 = 0.7;
              const sc2 = css(r * s2, gg * s2, bb * s2);
              project(x0, h01, z1, 0);
              project(x1, h11, z1, 1);
              project(x1, n10, z1, 2);
              project(x0, n00, z1, 3);
              octx.fillStyle = sc2;
              octx.beginPath();
              octx.moveTo(px[0], py[0]);
              octx.lineTo(px[1], py[1]);
              octx.lineTo(px[2], py[2]);
              octx.lineTo(px[3], py[3]);
              octx.closePath();
              octx.fill();
              if (!S.wire) {
                octx.strokeStyle = sc2;
                octx.stroke();
              }
              tris += 2;
            }
          }
        }

        /* ---------- water ---------- */
        if (hasWater && hAvg < sea) {
          const depth = clamp((sea - hAvg) / 14);
          const wav = mm.aq > 0.35 ? 0.55 : 0;
          const w0 = sea + Math.sin(time * 1.4 + x0 * 0.2 + z0 * 0.15) * wav;
          const w1 = sea + Math.sin(time * 1.4 + x1 * 0.2 + z0 * 0.15) * wav;
          const w2 = sea + Math.sin(time * 1.4 + x1 * 0.2 + z1 * 0.15) * wav;
          const w3 = sea + Math.sin(time * 1.4 + x0 * 0.2 + z1 * 0.15) * wav;
          project(x0, w0, z0, 0);
          project(x1, w1, z0, 1);
          project(x1, w2, z1, 2);
          project(x0, w3, z1, 3);
          const caustic =
            mm.aq > 0.3
              ? 0.5 +
                0.5 * Math.sin(time * 2.2 + x0 * 0.35 + Math.sin(z0 * 0.3 + time) * 2)
              : 0;
          const spec =
            mm.lx > 0.3
              ? Math.pow(clamp(Math.sin(time * 0.9 + x0 * 0.08 + z0 * 0.05) * 0.5 + 0.5), 8) *
                mm.lx *
                160
              : 0;
          let wr = lerp(waterCol[0] * 1.5, waterCol[0] * 0.35, depth) + caustic * 26 * (1 - depth);
          let wg = lerp(waterCol[1] * 1.3, waterCol[1] * 0.4, depth) + caustic * 30 * (1 - depth);
          let wb = lerp(waterCol[2] * 1.2, waterCol[2] * 0.6, depth) + caustic * 22 * (1 - depth);
          wr += spec;
          wg += spec;
          wb += spec;
          if (fogAmt > 0.01) {
            const fg = clamp((dmid - 60) / 190) * fogAmt;
            wr = lerp(wr, skyHor[0], fg);
            wg = lerp(wg, skyHor[1], fg);
            wb = lerp(wb, skyHor[2], fg);
          }
          octx.globalAlpha = lerp(0.58, 0.94, depth);
          const wc = css(clamp(wr, 0, 255), clamp(wg, 0, 255), clamp(wb, 0, 255));
          octx.fillStyle = wc;
          octx.beginPath();
          octx.moveTo(px[0], py[0]);
          octx.lineTo(px[1], py[1]);
          octx.lineTo(px[2], py[2]);
          octx.lineTo(px[3], py[3]);
          octx.closePath();
          octx.fill();
          octx.strokeStyle = wc;
          octx.lineWidth = 1;
          octx.stroke();
          octx.globalAlpha = 1;
          tris += 2;
        }

        /* ---------- the spire ---------- */
        if (i === spireI && j === spireJ) {
          const bx = (x0 + x1) / 2,
            bz = (z0 + z1) / 2;
          const bh = Math.max(hAvg, hasWater ? sea : hAvg);
          const H = 34,
            wBase = 3.4,
            wTop = 1.3;
          const accent = [
            [255, 61, 138],
            [124, 255, 77],
            [255, 193, 61],
            [61, 200, 255],
          ][Math.floor(time % 4)];
          for (let s = 0; s < 4; s++) {
            const a0 = (s / 4) * Math.PI * 2 + 0.78,
              a1 = ((s + 1) / 4) * Math.PI * 2 + 0.78;
            project(bx + Math.cos(a0) * wBase, bh, bz + Math.sin(a0) * wBase, 0);
            project(bx + Math.cos(a1) * wBase, bh, bz + Math.sin(a1) * wBase, 1);
            project(bx + Math.cos(a1) * wTop, bh + H, bz + Math.sin(a1) * wTop, 2);
            project(bx + Math.cos(a0) * wTop, bh + H, bz + Math.sin(a0) * wTop, 3);
            const sh = 0.4 + 0.5 * Math.abs(Math.cos(a0 + yaw));
            octx.fillStyle = css(42 * sh + 30, 48 * sh + 34, 60 * sh + 42);
            octx.beginPath();
            octx.moveTo(px[0], py[0]);
            octx.lineTo(px[1], py[1]);
            octx.lineTo(px[2], py[2]);
            octx.lineTo(px[3], py[3]);
            octx.closePath();
            octx.fill();
            octx.strokeStyle = octx.fillStyle as string;
            octx.stroke();
            tris += 2;
          }
          // plume of pixel motes
          for (const mo of motes) {
            mo.p += dt * 0.12;
            if (mo.p > 1) mo.p -= 1;
            const my = bh + H + mo.p * 42;
            const spread = mo.p * 9;
            project(
              bx + Math.cos(mo.a + time * 0.4) * spread,
              my,
              bz + Math.sin(mo.a + time * 0.4) * spread,
              0,
            );
            const sz = Math.max(1, (iw / 220) * mo.r * (1 - mo.p * 0.5));
            octx.globalAlpha = (1 - mo.p) * 0.85;
            octx.fillStyle = css(accent[0], accent[1], accent[2]);
            octx.fillRect(px[0] - sz / 2, py[0] - sz / 2, sz, sz);
          }
          octx.globalAlpha = 1;
        }
      }

      /* ---------- bloom ring ---------- */
      if (waveR > 0) {
        octx.strokeStyle = `rgba(255,255,255,0.5)`;
        octx.lineWidth = Math.max(1, iw / 400);
        octx.beginPath();
        for (let a = 0; a <= 48; a++) {
          const ang = (a / 48) * Math.PI * 2;
          const wx = Math.cos(ang) * waveR,
            wz = Math.sin(ang) * waveR;
          project(wx, height(wx, wz, oct) + 1.4, wz, 0);
          if (a === 0) octx.moveTo(px[0], py[0]);
          else octx.lineTo(px[0], py[0]);
        }
        octx.stroke();
      }

      /* ---------- POST: palette quantisation + ordered dither ---------- */
      let levels =
        mm.pxd < 0.1 ? -1 : mm.pxd < 0.26 ? 3 : mm.pxd < 0.44 ? 4 : mm.pxd < 0.62 ? 6 : mm.pxd < 0.8 ? 12 : mm.pxd < 0.93 ? 24 : 0;
      // the dither pass is per-pixel on the CPU: skip it when it is both
      // expensive and visually marginal (this is the Governor, in miniature)
      if (levels > 6 && iw * ih > 230000) levels = 0;
      let palCount = "16.7M";
      if (levels === -1) palCount = "4";
      else if (levels > 0) palCount = `${levels ** 3}`;

      if (levels !== 0) {
        const img = octx.getImageData(0, 0, iw, ih);
        const d = img.data;
        if (levels === -1) {
          // true 4-colour ramp with Bayer dithering on luminance
          const ramp = pal;
          for (let y = 0; y < ih; y++) {
            for (let x = 0; x < iw; x++) {
              const o = (y * iw + x) * 4;
              const lum = (d[o] * 0.299 + d[o + 1] * 0.587 + d[o + 2] * 0.114) / 255;
              const bv = BAYER[y & 3][x & 3] / 16 - 0.5;
              const li = clamp(Math.round(lum * 3 + bv * 1.05), 0, 3);
              d[o] = ramp[li][0];
              d[o + 1] = ramp[li][1];
              d[o + 2] = ramp[li][2];
            }
          }
        } else {
          const q = 255 / (levels - 1);
          const dith = clamp(1 - (levels - 3) / 22) * q * 0.85;
          for (let y = 0; y < ih; y++) {
            for (let x = 0; x < iw; x++) {
              const o = (y * iw + x) * 4;
              const bv = BAYER[y & 3][x & 3] / 16 - 0.5;
              d[o] = Math.round((d[o] + bv * dith) / q) * q;
              d[o + 1] = Math.round((d[o + 1] + bv * dith) / q) * q;
              d[o + 2] = Math.round((d[o + 2] + bv * dith) / q) * q;
            }
          }
        }
        octx.putImageData(img, 0, 0);
      }

      /* ---------- upscale to display ---------- */
      dctx.imageSmoothingEnabled = mm.pxd > 0.58;
      dctx.drawImage(off, 0, 0, iw, ih, 0, 0, dw, dh);

      /* ---------- rain (display space) ---------- */
      if (mm.aq > 0.52) {
        const ra = clamp((mm.aq - 0.52) * 2.2) * 0.35;
        dctx.strokeStyle = `rgba(200,225,255,${ra})`;
        dctx.lineWidth = 1;
        dctx.beginPath();
        for (const p of rain) {
          p.y += dt * p.s * 1.6;
          if (p.y > 1) p.y -= 1;
          const X = p.x * dw,
            Y = p.y * dh;
          dctx.moveTo(X, Y);
          dctx.lineTo(X - 3, Y + 14 * p.s);
        }
        dctx.stroke();
      }

      /* ---------- stats ---------- */
      const t1 = performance.now();
      frameAcc += t1 - t0;
      frameN++;
      statTimer += dt;
      if (statTimer > 0.35) {
        setStats({
          ms: frameAcc / frameN,
          tris,
          res: `${iw}×${ih}`,
          pal: palCount,
        });
        frameAcc = 0;
        frameN = 0;
        statTimer = 0;
      }
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  const S = STAGES[stage];

  return (
    <div className="fi-panel relative border border-line bg-panel">
      {/* viewport */}
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-void">
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
        <div className="pointer-events-none absolute inset-0 bg-scan opacity-40" />
        <div className="vignette pointer-events-none absolute inset-0" />

        {/* HUD top */}
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-3 sm:p-4">
          <div>
            <div className="mono flex items-center gap-2 text-[10px] tracking-[0.25em] text-chalk/70 uppercase">
              <span className="fi-accent-bg h-2 w-2 anim-pulse" />
              STAGE {S.id} / 6
            </div>
            <div className="mt-1 text-lg leading-none font-black tracking-tight drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)] sm:text-2xl">
              {S.name}
            </div>
            <div className="mono mt-1 text-[10px] text-chalk/60">{S.tagline}</div>
          </div>
          <div className="text-right">
            <div className="mono text-[9px] tracking-[0.25em] text-chalk/50 uppercase">
              Fidelity Index
            </div>
            <div className="mono tnum fi-accent-text text-xl leading-none font-black drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)] sm:text-3xl">
              {fmtBig(fi)}
            </div>
            <div className="mono tnum mt-1 space-y-[2px] text-[9.5px] text-chalk/55">
              <div>{stats.res} internal</div>
              <div>{stats.pal} colours</div>
              <div>{(stats.tris / 1000).toFixed(1)}k tri · {stats.ms.toFixed(1)} ms</div>
            </div>
          </div>
        </div>

        {/* HUD bottom: metric bars */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 grid grid-cols-2 gap-x-4 gap-y-1.5 bg-gradient-to-t from-void/90 to-transparent p-3 sm:grid-cols-4 sm:p-4">
          {METRICS.map((mt) => {
            const v = m[mt.key];
            return (
              <div key={mt.key}>
                <div className="mono mb-1 flex items-baseline justify-between text-[9px] tracking-[0.12em] uppercase">
                  <span style={{ color: mt.color }}>{mt.symbol}</span>
                  <span className="tnum text-chalk/55">
                    {fmtBig(v * METRIC_TARGETS[mt.key])}
                  </span>
                </div>
                <div className="h-[5px] w-full border border-line/70 bg-void/70">
                  <div
                    className="h-full"
                    style={{ width: `${v * 100}%`, background: mt.color, boxShadow: `0 0 8px ${mt.color}` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* console */}
      <div className="border-t border-line bg-panel2 p-3 sm:p-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="mono text-[10px] tracking-[0.25em] text-dim uppercase">
            Master Terraform Dial — drag to raise planetary fidelity
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Btn on={auto} onClick={() => setAuto(!auto)}>
              {auto ? "■ PAUSE" : "▶ AUTO-TERRAFORM"}
            </Btn>
            <Btn
              on={false}
              onClick={() => {
                waveRef.current = 0;
              }}
            >
              ◎ BLOOM WAVE
            </Btn>
            <Btn on={wire} onClick={() => setWire(!wire)}>
              ▦ TOPOLOGY
            </Btn>
            <Btn on={orbit} onClick={() => setOrbit(!orbit)}>
              ⟲ ORBIT
            </Btn>
          </div>
        </div>

        <Slider value={t} onChange={setT} color={"var(--fi-accent)"} />

        <div className="mt-2 grid grid-cols-6 gap-1">
          {STAGES.map((s, i) => (
            <button
              key={s.id}
              onClick={() => setT(i / 6 + 0.08)}
              className={cn(
                "mono border px-1 py-1.5 text-left text-[8.5px] leading-tight tracking-wider uppercase transition-colors",
                stage === i
                  ? "border-transparent bg-chalk text-void"
                  : "border-line text-dim hover:border-chalk/40 hover:text-chalk",
              )}
            >
              <span className="block font-bold">S{s.id}</span>
              <span className="hidden sm:block opacity-70">{s.tagline.slice(0, 18)}</span>
            </button>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line/70 pt-3">
          <Tag color="var(--fi-accent)">AVATAR</Tag>
          <p className="min-w-[200px] flex-1 text-[11.5px] leading-relaxed text-dim">
            {S.avatar}
          </p>
        </div>
      </div>
    </div>
  );
}

function Btn({
  children,
  on,
  onClick,
}: {
  children: React.ReactNode;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "mono border px-2 py-1 text-[9.5px] font-bold tracking-[0.14em] uppercase transition-all active:translate-y-px",
        on
          ? "border-transparent bg-chalk text-void"
          : "border-line bg-void/60 text-dim hover:border-chalk/50 hover:text-chalk",
      )}
    >
      {children}
    </button>
  );
}
