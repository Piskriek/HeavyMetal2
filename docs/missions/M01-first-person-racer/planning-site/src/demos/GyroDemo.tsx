import { useEffect, useRef, useState } from 'react';
import { advanceRoll, CAP_THETA, RADIUS, TAU } from '../sim/gyro';
import { Stat } from '../components/ui';

const W = 720, H = 300;

function goblin(ctx: CanvasRenderingContext2D, s: number) {
  // body
  ctx.fillStyle = '#4b3b2a';
  ctx.beginPath();
  ctx.ellipse(0, 18 * s, 20 * s, 16 * s, 0, 0, TAU);
  ctx.fill();
  // head
  ctx.fillStyle = '#7f9a3a';
  ctx.beginPath();
  ctx.ellipse(0, -8 * s, 16 * s, 14 * s, 0, 0, TAU);
  ctx.fill();
  // ears
  ctx.beginPath();
  ctx.moveTo(-14 * s, -10 * s); ctx.lineTo(-34 * s, -18 * s); ctx.lineTo(-12 * s, -2 * s);
  ctx.moveTo(14 * s, -10 * s); ctx.lineTo(34 * s, -18 * s); ctx.lineTo(12 * s, -2 * s);
  ctx.fill();
  // goggles
  ctx.fillStyle = '#d4a24c';
  ctx.beginPath(); ctx.arc(-6 * s, -10 * s, 5 * s, 0, TAU); ctx.arc(6 * s, -10 * s, 5 * s, 0, TAU); ctx.fill();
  ctx.fillStyle = '#9fe6dc';
  ctx.beginPath(); ctx.arc(-6 * s, -10 * s, 3 * s, 0, TAU); ctx.arc(6 * s, -10 * s, 3 * s, 0, TAU); ctx.fill();
}

function drawSide(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, phase: number, slope: number, gyroOn: boolean) {
  // ground tangent line
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(slope);
  ctx.strokeStyle = '#6b5a3c';
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(-190, r + 2); ctx.lineTo(190, r + 2); ctx.stroke();
  ctx.restore();

  // core cage (rolls)
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(slope + phase);
  ctx.fillStyle = 'rgba(63,182,168,0.08)';
  ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#9aa3a6';
  ctx.lineWidth = 7;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
  ctx.lineWidth = 4;
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * TAU;
    ctx.strokeStyle = k === 0 ? '#e5642b' : '#6f787c';
    ctx.beginPath(); ctx.moveTo(Math.cos(a) * r * 0.62, Math.sin(a) * r * 0.62); ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); ctx.stroke();
  }
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * TAU;
    ctx.fillStyle = '#cfd6d8';
    ctx.beginPath(); ctx.arc(Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.9, 2.5, 0, TAU); ctx.fill();
  }
  ctx.restore();

  // gyro frame: goblin + near cap ring (level with the track when gyro on)
  const gyroAngle = gyroOn ? slope : slope + phase;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(gyroAngle);
  goblin(ctx, r / 90);
  const capR = r * Math.sin(CAP_THETA);
  const grad = ctx.createRadialGradient(-capR * 0.3, -capR * 0.3, 4, 0, 0, capR);
  grad.addColorStop(0, '#f5d894');
  grad.addColorStop(1, '#8a6522');
  ctx.strokeStyle = grad;
  ctx.lineWidth = 12;
  ctx.beginPath(); ctx.arc(0, 0, capR, 0, TAU); ctx.stroke();
  // level bar + rivets on the cap
  ctx.strokeStyle = '#3fb6a8';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-capR - 14, 0); ctx.lineTo(-capR + 6, 0); ctx.moveTo(capR - 6, 0); ctx.lineTo(capR + 14, 0); ctx.stroke();
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * TAU + Math.PI / 6;
    ctx.fillStyle = '#fff1c4';
    ctx.beginPath(); ctx.arc(Math.cos(a) * capR, Math.sin(a) * capR, 2.4, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

function drawFront(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, phase: number) {
  // core bands: latitude lines rotating toward the viewer
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = 'rgba(63,182,168,0.08)';
  ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.clip();
  const capX = r * Math.cos(CAP_THETA);
  for (let k = 0; k < 8; k++) {
    const a = phase + (k / 8) * TAU;
    if (Math.cos(a) < 0) continue; // back hemisphere
    const y = -r * Math.sin(a);
    ctx.strokeStyle = k === 0 ? '#e5642b' : '#7c8589';
    ctx.lineWidth = 3 + 3 * Math.cos(a);
    ctx.beginPath(); ctx.moveTo(-capX, y); ctx.lineTo(capX, y); ctx.stroke();
  }
  goblin(ctx, r / 90);
  // caps: spherical segments at ±right (level)
  for (const sgn of [-1, 1]) {
    const g = ctx.createLinearGradient(sgn * capX, 0, sgn * r, 0);
    g.addColorStop(0, '#8a6522');
    g.addColorStop(0.5, '#f1cf85');
    g.addColorStop(1, '#6d4f1b');
    ctx.fillStyle = g;
    ctx.fillRect(sgn > 0 ? capX : -r, -r, r - capX, 2 * r);
  }
  ctx.restore();
  ctx.strokeStyle = '#9aa3a6';
  ctx.lineWidth = 5;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke();
}

export function GyroDemo() {
  const ref = useRef<HTMLCanvasElement>(null);
  const [kmh, setKmh] = useState(120);
  const [slopeDeg, setSlopeDeg] = useState(-12);
  const [grounded, setGrounded] = useState(true);
  const [gyroOn, setGyroOn] = useState(true);
  const state = useRef({ rollPhase: 0, rollRate: 0 });
  const [, force] = useState(0);
  const params = useRef({ kmh, slopeDeg, grounded, gyroOn });
  params.current = { kmh, slopeDeg, grounded, gyroOn };

  useEffect(() => {
    let raf = 0, last = performance.now(), acc = 0, ui = 0, visPhase = 0;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const loop = (now: number) => {
      acc += Math.min(0.1, (now - last) / 1000);
      last = now;
      const p = params.current;
      const vx = p.kmh / 0.16;
      while (acc >= 1 / 120) {
        state.current = advanceRoll(state.current, { vx, vz: 0, grounded: p.grounded, inLoop: false }, 1 / 120);
        visPhase = (visPhase + (state.current.rollRate / 4) / 120) % TAU;
        acc -= 1 / 120;
      }
      const ctx = ref.current?.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, W, H);
        ctx.fillStyle = '#0d1112';
        ctx.fillRect(0, 0, W, H);
        // display phase runs at ¼ rate so the roll stays readable at 60 fps (sim phase untouched)
        const vis = reduced ? 0 : visPhase;
        const slope = (p.slopeDeg * Math.PI) / 180;
        drawSide(ctx, 200, 150, 90, vis, slope, p.gyroOn);
        drawFront(ctx, 540, 150, 90, vis);
        ctx.fillStyle = '#b8a47a';
        ctx.font = '11px JetBrains Mono, monospace';
        ctx.fillText('SIDE (along the axle): core rolls, caps and goblin stay level', 20, 22);
        ctx.fillText('FRONT (down-track)', 470, 22);
      }
      if (now - ui > 120) { ui = now; force((n) => n + 1); }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const s = state.current;
  const slope = slopeDeg;
  return (
    <div className="panel p-4">
      <canvas ref={ref} width={W} height={H} className="w-full rounded-lg border border-iron-3" aria-label="Gyro ball, side and front views" />
      <div className="mt-3 grid gap-3 md:grid-cols-4">
        <label className="text-xs text-stone-300">Speed {kmh} km/h<input type="range" min={0} max={300} value={kmh} onChange={(e) => setKmh(+e.target.value)} className="w-full accent-amber-500" /></label>
        <label className="text-xs text-stone-300">Track grade {slopeDeg}°<input type="range" min={-30} max={30} value={slopeDeg} onChange={(e) => setSlopeDeg(+e.target.value)} className="w-full accent-amber-500" /></label>
        <label className="flex items-center gap-2 text-xs text-stone-300"><input type="checkbox" checked={grounded} onChange={(e) => setGrounded(e.target.checked)} className="accent-amber-500" /> Grounded (off = airborne decay ×e^(−0.6·dt))</label>
        <label className="flex items-center gap-2 text-xs text-stone-300"><input type="checkbox" checked={gyroOn} onChange={(e) => setGyroOn(e.target.checked)} className="accent-amber-500" /> Gyro on (off = what the cockpit would do without it)</label>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
        <Stat label="rollPhase (rad)" value={s.rollPhase.toFixed(3)} />
        <Stat label="rollRate (rad/s)" value={s.rollRate.toFixed(2)} />
        <Stat label="rate law hypot(vx,vz)/RADIUS" value={grounded ? `${((kmh / 0.16) / RADIUS).toFixed(2)}` : 'decaying'} />
        <Stat label="goblin tilt vs track" value={gyroOn ? `0° (world tilt ${slope}°) ✓` : 'spinning ✗'} ok={gyroOn} />
      </div>
    </div>
  );
}
