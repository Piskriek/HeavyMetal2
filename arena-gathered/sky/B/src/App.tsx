import { useEffect, useRef, useState } from "react";
import {
  SKY_ROWS,
  density,
  skyAt,
  skyGradient,
  sunColour,
  type Vec3,
} from "./sky";

// --- Tone mapping / gamma ---
// ACES filmic approximation (Stephen Hill)
function aces(x: number): number {
  const a = 2.51;
  const b = 0.03;
  const c = 2.43;
  const d = 0.59;
  const e = 0.14;
  return Math.min(1, Math.max(0, (x * (a * x + b)) / (x * (c * x + d) + e)));
}
function linearToSrgb(c: number): number {
  const v = aces(Math.max(0, c));
  return v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.2) - 0.055;
}
function toRgb(r: number, g: number, b: number): [number, number, number] {
  return [
    Math.round(clamp01(linearToSrgb(r)) * 255),
    Math.round(clamp01(linearToSrgb(g)) * 255),
    Math.round(clamp01(linearToSrgb(b)) * 255),
  ];
}
function clamp01(x: number): number {
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

function dirFromElAz(el: number, az: number): Vec3 {
  const cE = Math.cos(el);
  const sE = Math.sin(el);
  const cA = Math.cos(az);
  const sA = Math.sin(az);
  return [cE * cA, sE, cE * sA];
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gradientCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [sunEl, setSunEl] = useState(45); // degrees
  const [sunAz, setSunAz] = useState(60); // degrees
  const [stage, setStage] = useState(6);

  useEffect(() => {
    const canvas = canvasRef.current;
    const gradCanvas = gradientCanvasRef.current;
    if (!canvas || !gradCanvas) return;

    const SIZE = 400;
    canvas.width = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = ctx.createImageData(SIZE, SIZE);
    const data = img.data;

    const sunElRad = (sunEl * Math.PI) / 180;
    const sunAzRad = (sunAz * Math.PI) / 180;
    const sunDir: Vec3 = [
      Math.cos(sunElRad) * Math.cos(sunAzRad),
      Math.sin(sunElRad),
      Math.cos(sunElRad) * Math.sin(sunAzRad),
    ];
    const d = density(stage);
    const sunCol = sunColour(sunDir, stage);

    const cx = SIZE / 2;
    const cy = SIZE / 2;
    const radius = SIZE / 2 - 2;
    const sunCosDisc = Math.cos((0.5 * Math.PI) / 180); // ~0.5 degree disc

    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const dx = (x - cx) / radius;
        const dy = (y - cy) / radius;
        const r2 = dx * dx + dy * dy;
        const idx = (y * SIZE + x) * 4;
        if (r2 > 1) {
          // Outside the dome: black (space, stars drawn by game) if no atmosphere,
          // but below horizon we fill with a dark grey (ground).
          data[idx] = 0;
          data[idx + 1] = 0;
          data[idx + 2] = 0;
          data[idx + 3] = 255;
          continue;
        }
        // Fisheye (equidistant) projection: angle from zenith ω = r * 90°.
        // y in image is down, so we negate dy to produce "up = up" in image.
        const omega = Math.sqrt(r2) * (Math.PI / 2);
        // Azimuth: when dy is negative (upper part of image), that's forward;
        // 0 azimuth points up (top of the image).
        const az = Math.atan2(dx, -dy);
        // omega = zenith angle, so elevation = 90° - omega.
        const el = Math.PI / 2 - omega;
        const dir: Vec3 = [
          Math.cos(el) * Math.cos(az),
          Math.sin(el),
          Math.cos(el) * Math.sin(az),
        ];

        // Compute sky radiance.
        let [r, g, b] = d > 0 && dir[1] > 0 ? skyAt(dir, sunDir, stage) : [0, 0, 0];

        // If this pixel is close to the sun disc, add the sun.
        if (d > 0) {
          const cosAngle =
            dir[0] * sunDir[0] + dir[1] * sunDir[1] + dir[2] * sunDir[2];
          if (cosAngle > sunCosDisc && dir[1] > 0 && sunDir[1] > -0.01) {
            // Inside sun disc; use sunColour scaled to a bright value.
            const sunIntensity = 8; // fit within ACES
            r = Math.max(r, sunCol[0] * sunIntensity);
            g = Math.max(g, sunCol[1] * sunIntensity);
            b = Math.max(b, sunCol[2] * sunIntensity);
          }
        }

        const [R, G, B] = toRgb(r, g, b);
        data[idx] = R;
        data[idx + 1] = G;
        data[idx + 2] = B;
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);

    // Draw horizon strip: gradient from top of dome (zenith) to bottom (horizon)
    // blended around the ring.
    const gradient = new Float32Array(SKY_ROWS * 3);
    skyGradient(sunDir, stage, gradient);

    const GW = 64;
    const GH = SIZE;
    gradCanvas.width = GW;
    gradCanvas.height = GH;
    const gctx = gradCanvas.getContext("2d");
    if (!gctx) return;
    const gimg = gctx.createImageData(GW, GH);
    const gdata = gimg.data;
    for (let row = 0; row < GH; row++) {
      const fi = row / (GH - 1);
      // fi=0 top, fi=1 bottom.
      const skyRow = Math.min(SKY_ROWS - 1, Math.floor(fi * SKY_ROWS));
      const lr = gradient[skyRow * 3] ?? 0;
      const lg = gradient[skyRow * 3 + 1] ?? 0;
      const lb = gradient[skyRow * 3 + 2] ?? 0;
      const [R, G, B] = toRgb(lr, lg, lb);
      for (let col = 0; col < GW; col++) {
        const gi = (row * GW + col) * 4;
        gdata[gi] = R;
        gdata[gi + 1] = G;
        gdata[gi + 2] = B;
        gdata[gi + 3] = 255;
      }
    }
    gctx.putImageData(gimg, 0, 0);
  }, [sunEl, sunAz, stage]);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">
            Terraformed Moon Sky
          </h1>
          <p className="text-slate-400 text-sm">
            Physical Rayleigh + Mie scattering; fisheye view looking straight up.
          </p>
        </header>

        <div className="flex flex-col lg:flex-row gap-6 items-start">
          <div className="flex gap-4 items-start">
            <canvas
              ref={canvasRef}
              className="rounded-full border border-slate-700 shadow-lg shadow-black/50"
              style={{ imageRendering: "pixelated" }}
            />
            <canvas
              ref={gradientCanvasRef}
              className="rounded border border-slate-700"
              style={{ imageRendering: "pixelated", height: 400, width: 64 }}
            />
          </div>

          <div className="flex-1 space-y-4 bg-slate-800/60 rounded-lg p-4 border border-slate-700 w-full lg:w-80">
            <Slider
              label="Sun elevation"
              value={sunEl}
              min={-15}
              max={90}
              step={1}
              unit="°"
              onChange={setSunEl}
            />
            <Slider
              label="Sun azimuth"
              value={sunAz}
              min={0}
              max={360}
              step={1}
              unit="°"
              onChange={setSunAz}
            />
            <Slider
              label="Terraforming stage"
              value={stage}
              min={0}
              max={6}
              step={0.1}
              unit=""
              onChange={setStage}
            />
            <div className="text-xs text-slate-400 pt-2 border-t border-slate-700">
              density() = {density(stage).toFixed(3)}
              <br />
              sunColour:{" "}
              {sunColour(
                dirFromElAz((sunEl * Math.PI) / 180, (sunAz * Math.PI) / 180),
                stage
              )
                .map((x) => x.toFixed(2))
                .join(", ")}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-slate-300">{label}</span>
        <span className="text-slate-400 font-mono">
          {value.toFixed(1)}
          {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-sky-400"
      />
    </label>
  );
}
