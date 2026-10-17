import { useEffect, useRef, useState } from "react";

import { SKY_ROWS, bakeSkyLut, skyGradient, sunColour, type Vec3 } from "./sky";

const PI = Math.PI;
const LUT_WIDTH = 192;
const LUT_HEIGHT = 96;

function toDirection(elevation: number, azimuth: number): Vec3 {
  const e = elevation * PI / 180;
  const a = azimuth * PI / 180;
  return [Math.cos(e) * Math.sin(a), Math.sin(e), Math.cos(e) * Math.cos(a)];
}

function displayChannel(value: number): number {
  const exposed = value * 1.15;
  const mapped = (exposed * (2.51 * exposed + 0.03)) /
    (exposed * (2.43 * exposed + 0.59) + 0.14);
  return Math.round(255 * Math.pow(Math.max(0, Math.min(1, mapped)), 1 / 2.2));
}

function rawDisplayChannel(value: number): number {
  return Math.round(255 * Math.pow(Math.max(0, Math.min(1, value)), 1 / 2.2));
}

function paintPreview(canvas: HTMLCanvasElement, sunElevation: number, sunAzimuth: number, stage: number): void {
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) return;

  const width = canvas.width;
  const height = canvas.height;
  const sun = toDirection(sunElevation, sunAzimuth);
  const lut = new Float32Array(LUT_WIDTH * LUT_HEIGHT * 3);
  const gradient = new Float32Array(SKY_ROWS * 3);
  bakeSkyLut(sun, stage, LUT_WIDTH, LUT_HEIGHT, lut);
  skyGradient(sun, stage, gradient);

  context.fillStyle = "#06080b";
  context.fillRect(0, 0, width, height);
  const image = context.createImageData(width, height);
  const data = image.data;
  const centerX = 330;
  const centerY = 274;
  const radius = 228;
  const stripX = 72;
  const stripY = 526;
  const stripWidth = 516;
  const stripHeight = 38;
  const gradientX = 708;
  const gradientY = 46;
  const gradientWidth = 54;
  const gradientHeight = 456;
  const sunAzimuthRad = sunAzimuth * PI / 180;

  const sampleLut = (relativeAzimuth: number, elevationFraction: number): readonly [number, number, number] => {
    const wrapped = ((relativeAzimuth / (2 * PI)) % 1 + 1) % 1;
    const column = Math.min(LUT_WIDTH - 1, Math.floor(wrapped * LUT_WIDTH));
    const row = Math.min(LUT_HEIGHT - 1, Math.floor(elevationFraction * (LUT_HEIGHT - 1)));
    const offset = (row * LUT_WIDTH + column) * 3;
    return [lut[offset] ?? 0, lut[offset + 1] ?? 0, lut[offset + 2] ?? 0];
  };

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let colour: readonly [number, number, number] | undefined;
      const dx = x - centerX;
      const dy = y - centerY;
      const radial = Math.sqrt(dx * dx + dy * dy);
      if (radial <= radius) {
        const azimuth = Math.atan2(dx, -dy);
        colour = sampleLut(azimuth - sunAzimuthRad, radial / radius);
      } else if (x >= stripX && x < stripX + stripWidth && y >= stripY && y < stripY + stripHeight) {
        const azimuth = ((x - stripX) / stripWidth) * 2 * PI;
        const elevation = 1 - (y - stripY) / stripHeight;
        colour = sampleLut(azimuth - sunAzimuthRad, 0.87 + 0.13 * (1 - elevation));
      } else if (x >= gradientX && x < gradientX + gradientWidth && y >= gradientY && y < gradientY + gradientHeight) {
        const row = Math.min(SKY_ROWS - 1, Math.floor(((y - gradientY) / gradientHeight) * SKY_ROWS));
        const offset = row * 3;
        colour = [gradient[offset] ?? 0, gradient[offset + 1] ?? 0, gradient[offset + 2] ?? 0];
      }
      if (colour) {
        const offset = (y * width + x) * 4;
        data[offset] = displayChannel(colour[0]);
        data[offset + 1] = displayChannel(colour[1]);
        data[offset + 2] = displayChannel(colour[2]);
        data[offset + 3] = 255;
      }
    }
  }

  context.putImageData(image, 0, 0);
  context.strokeStyle = "rgba(216, 228, 235, 0.28)";
  context.lineWidth = 1;
  context.beginPath();
  context.arc(centerX, centerY, radius + 0.5, 0, 2 * PI);
  context.stroke();
  context.strokeRect(stripX + 0.5, stripY + 0.5, stripWidth - 1, stripHeight - 1);
  context.strokeRect(gradientX + 0.5, gradientY + 0.5, gradientWidth - 1, gradientHeight - 1);

  if (sunElevation >= 0) {
    const radial = radius * (90 - sunElevation) / 90;
    const x = centerX + radial * Math.sin(sunAzimuthRad);
    const y = centerY - radial * Math.cos(sunAzimuthRad);
    const colour = sunColour(sun, stage);
    const cssColour = `rgb(${rawDisplayChannel(colour[0])} ${rawDisplayChannel(colour[1])} ${rawDisplayChannel(colour[2])})`;
    const glow = context.createRadialGradient(x, y, 0, x, y, 17);
    glow.addColorStop(0, cssColour);
    glow.addColorStop(0.2, cssColour);
    glow.addColorStop(1, "transparent");
    context.fillStyle = glow;
    context.beginPath();
    context.arc(x, y, 17, 0, 2 * PI);
    context.fill();
    context.fillStyle = cssColour;
    context.beginPath();
    context.arc(x, y, 3.5, 0, 2 * PI);
    context.fill();
  }

  context.fillStyle = "rgba(228, 236, 239, 0.7)";
  context.font = "11px ui-monospace, SFMono-Regular, Menlo, monospace";
  context.fillText("ZENITH", centerX - 20, centerY + 4);
  context.fillText("HORIZON / 360 DEG", stripX, stripY + stripHeight + 20);
  context.fillText("90", gradientX + gradientWidth + 12, gradientY + 7);
  context.fillText("0", gradientX + gradientWidth + 12, gradientY + gradientHeight);
  context.fillText("AZIMUTH-AVERAGED", gradientX - 28, gradientY + gradientHeight + 24);
}

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (value: number) => void;
}

function Slider({ label, value, min, max, step, unit, onChange }: SliderProps) {
  return (
    <label className="control">
      <span className="control-label">{label}</span>
      <span className="control-value">{value.toFixed(step < 1 ? 1 : 0)}{unit}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [sunElevation, setSunElevation] = useState(18);
  const [sunAzimuth, setSunAzimuth] = useState(35);
  const [stage, setStage] = useState(6);

  useEffect(() => {
    if (canvasRef.current) paintPreview(canvasRef.current, sunElevation, sunAzimuth, stage);
  }, [sunElevation, sunAzimuth, stage]);

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">SKY<span>/64</span></div>
        <div className="status"><i /> SINGLE SCATTERING MODEL</div>
      </header>
      <section className="workspace">
        <div className="intro">
          <p className="kicker">TERRAFORMING ATMOSPHERE LAB</p>
          <h1>Radiance,<br />from vacuum to blue.</h1>
          <p className="lede">A deterministic physical sky preview across all seven stages of atmospheric development.</p>
        </div>
        <div className="visual-wrap">
          <canvas ref={canvasRef} width={820} height={600} aria-label="Fisheye sky dome and horizon preview" />
        </div>
        <aside className="controls" aria-label="Sky controls">
          <div className="stage-readout">
            <span>STAGE</span><strong>{stage.toFixed(1)}</strong>
            <small>{stage <= 2 ? "VACUUM" : stage < 4.5 ? "FORMING" : "MATURE"}</small>
          </div>
          <Slider label="Terraform stage" value={stage} min={0} max={6} step={0.1} unit="" onChange={setStage} />
          <Slider label="Sun elevation" value={sunElevation} min={-15} max={90} step={1} unit=" deg" onChange={setSunElevation} />
          <Slider label="Sun azimuth" value={sunAzimuth} min={0} max={360} step={1} unit=" deg" onChange={setSunAzimuth} />
          <div className="formula"><span>R</span> 5.8e-6&nbsp;&nbsp; <span>G</span> 13.5e-6&nbsp;&nbsp; <span>B</span> 33.1e-6 m^-1</div>
        </aside>
      </section>
      <footer>
        <span>FLAT-PLANET EXPONENTIAL ATMOSPHERE</span><span>ACES / GAMMA 2.2</span><span>10 INTEGRATION STEPS</span>
      </footer>
    </main>
  );
}