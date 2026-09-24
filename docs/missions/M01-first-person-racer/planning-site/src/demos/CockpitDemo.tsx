import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { armPose, clamp, cockpitLayout, needleAngle, steerFrom, steerStep, yokeAngleDeg, TAU, RADIUS, type CockpitLayout } from '../sim/gyro';
import { cageBarAlpha, cockpitJolt, cockpitLight, radarBlips, twoBoneIK, CAGE_BARS } from '../sim/redteam';
import { Stat } from '../components/ui';
import { cn } from '../utils/cn';

const laneZ = (l: number) => 480 - 240 * (l + 0.5);

interface Rival { id: number; x: number; z: number; vx: number; lane: number; color: string }
interface Sim {
  z: number; vz: number; lane: number; kmh: number; dist: number; boost: number; shield: number; time: number; grade: number;
  roll: number; rollRate: number; jolt: number; rivals: Rival[]; frameDt: number;
}

const STAGES = {
  alpine: { cave: 0, fog: [216, 196, 160] as [number, number, number], label: 'Alpine' },
  canyon: { cave: 0.15, fog: [214, 140, 90] as [number, number, number], label: 'Canyon' },
  mine: { cave: 1, fog: [40, 70, 80] as [number, number, number], label: 'Mine' },
  stadium: { cave: 0.05, fog: [200, 210, 240] as [number, number, number], label: 'Stadium' },
};
type StageKey = keyof typeof STAGES;

function drawWorld(ctx: CanvasRenderingContext2D, L: CockpitLayout, s: Sim, bob: number, stage: StageKey, fixStrobe: boolean, reduced: boolean) {
  const { w, h } = L;
  const hy = L.horizonY + bob;
  const sky = ctx.createLinearGradient(0, 0, 0, hy);
  sky.addColorStop(0, '#2c4a52');
  sky.addColorStop(1, '#d9a766');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, hy + 1);
  ctx.fillStyle = '#3b4a4a';
  ctx.beginPath();
  ctx.moveTo(0, hy);
  for (let i = 0; i <= 12; i++) ctx.lineTo((i / 12) * w + s.z * 0.02, hy - (40 + 50 * Math.abs(Math.sin(i * 1.7))) * (h / 600));
  ctx.lineTo(w, hy);
  ctx.fill();
  const ground = ctx.createLinearGradient(0, hy, 0, h);
  ground.addColorStop(0, '#5a4a33');
  ground.addColorStop(1, '#2a2118');
  ctx.fillStyle = ground;
  ctx.fillRect(0, hy, w, h - hy);
  const cx = w / 2, f = w * 0.9, eye = 55;
  const proj = (z: number, d: number) => ({ x: cx - ((z - s.z) * f) / d, y: hy + (eye * f) / d });
  const near = 60, far = 9000;
  const pts = [proj(480, near), proj(480, far), proj(-480, far), proj(-480, near)];
  ctx.fillStyle = '#6d6250';
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.fill();
  for (const z of [480, 240, 0, -240, -480]) {
    const edge = Math.abs(z) === 480;
    ctx.strokeStyle = edge ? '#d4a24c' : 'rgba(255,240,210,0.75)';
    ctx.lineWidth = edge ? 3 : 2;
    if (edge) {
      const a = proj(z, near), b = proj(z, far);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    } else {
      const off = s.dist % 400;
      for (let d = near + 400 - off; d < far; d += 400) {
        const a = proj(z, d), b = proj(z, d + 180);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
    }
  }
  const off = s.dist % 900;
  for (let d = 900 - off + near; d < far; d += 900) {
    for (const z of [620, -620]) {
      const base = proj(z, d), hgt = (140 * f) / d;
      ctx.fillStyle = '#2b2419';
      ctx.fillRect(base.x - (10 * f) / d, base.y - hgt, (20 * f) / d, hgt);
      ctx.fillStyle = '#e5642b';
      ctx.fillRect(base.x - (14 * f) / d, base.y - hgt, (28 * f) / d, (18 * f) / d);
    }
  }
  // rival balls ahead (far → near)
  [...s.rivals].map((r) => ({ r, d: r.x - s.dist })).filter((o) => o.d > 90 && o.d < far).sort((a, b) => b.d - a.d).forEach(({ r, d }) => {
    const p = proj(r.z, d);
    const rad = (RADIUS * f) / d;
    ctx.fillStyle = r.color;
    ctx.beginPath(); ctx.arc(p.x, p.y - rad, rad, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#c9a24a'; ctx.lineWidth = Math.max(1, rad * 0.18);
    ctx.beginPath(); ctx.arc(p.x, p.y - rad, rad * 0.8, -Math.PI / 2 - 0.5, -Math.PI / 2 + 0.5); ctx.stroke();
  });
  // atmosphere tint (world side)
  const st = STAGES[stage];
  if (st.cave > 0) {
    ctx.fillStyle = `rgba(${st.fog.join(',')},${0.55 * st.cave})`;
    ctx.fillRect(0, 0, w, h);
  }
  // UQ3: lattice cage bars sweeping across the window
  const ap = L.aperture;
  const cage = cageBarAlpha(s.rollRate, s.frameDt);
  const barA = reduced ? 0.35 : fixStrobe ? cage.barAlpha : 1;
  const blurA = reduced ? 0 : fixStrobe ? cage.blurAlpha : 0;
  ctx.save();
  ctx.beginPath();
  ctx.rect(ap.x, ap.y, ap.w, ap.h);
  ctx.clip();
  const spacing = TAU / CAGE_BARS;
  const phase = reduced ? 0 : s.roll % spacing;
  const fc = ap.h * 0.9;
  for (let k = -3; k <= 3; k++) {
    const theta = k * spacing + phase - spacing / 2; // angle below eye-forward
    if (Math.abs(theta) > 1.2) continue;
    const y = L.horizonY + Math.tan(theta) * fc;
    const thick = 7 / Math.cos(theta);
    ctx.fillStyle = `rgba(28,24,18,${0.85 * barA})`;
    ctx.fillRect(ap.x, y - thick / 2, ap.w, thick);
    ctx.fillStyle = `rgba(212,162,76,${0.35 * barA})`;
    ctx.fillRect(ap.x, y - thick / 2, ap.w, 1.5);
  }
  if (blurA > 0) {
    const g = ctx.createLinearGradient(0, ap.y, 0, ap.y + ap.h);
    g.addColorStop(0, `rgba(30,26,20,${0.28 * blurA})`);
    g.addColorStop(0.5, `rgba(30,26,20,${0.12 * blurA})`);
    g.addColorStop(1, `rgba(30,26,20,${0.28 * blurA})`);
    ctx.fillStyle = g;
    ctx.fillRect(ap.x, ap.y, ap.w, ap.h);
  }
  ctx.restore();
}

function Gauge({ size, angle, label, value, ticks = 9, red }: { size: number; angle: number; label: string; value: string; ticks?: number; red?: boolean }) {
  const r = size / 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="meter" aria-label={label} aria-valuetext={value}>
      <defs>
        <radialGradient id={`bz-${label}`} cx="35%" cy="30%"><stop offset="0" stopColor="#fbe3a6" /><stop offset="1" stopColor="#7a5519" /></radialGradient>
        <radialGradient id={`face-${label}`} cx="50%" cy="40%"><stop offset="0" stopColor="#f3e7c8" /><stop offset="1" stopColor="#b9a67c" /></radialGradient>
      </defs>
      <circle cx={r} cy={r} r={r - 1} fill={`url(#bz-${label})`} />
      <circle cx={r} cy={r} r={r * 0.84} fill={`url(#face-${label})`} stroke="#3a2a10" strokeWidth={1.5} />
      {Array.from({ length: ticks }).map((_, i) => {
        const a = ((-120 + (240 * i) / (ticks - 1)) * Math.PI) / 180;
        const hot = red && i >= ticks - 2;
        return <line key={i} x1={r + Math.sin(a) * r * 0.62} y1={r - Math.cos(a) * r * 0.62} x2={r + Math.sin(a) * r * 0.76} y2={r - Math.cos(a) * r * 0.76} stroke={hot ? '#b3261e' : '#2a1d0a'} strokeWidth={2} />;
      })}
      <text x={r} y={r * 1.42} textAnchor="middle" fontSize={r * 0.2} fontFamily="JetBrains Mono" fill="#2a1d0a">{value}</text>
      <text x={r} y={r * 0.62} textAnchor="middle" fontSize={r * 0.14} fontFamily="Cinzel" fontWeight={800} fill="#5a3f14">{label}</text>
      <g style={{ transform: `rotate(${angle}deg)`, transformOrigin: `${r}px ${r}px`, transition: 'transform 120ms linear' }}>
        <path d={`M ${r - 3} ${r} L ${r} ${r * 0.28} L ${r + 3} ${r} Z`} fill="#b3261e" />
      </g>
      <circle cx={r} cy={r} r={r * 0.09} fill="#3a2a10" />
    </svg>
  );
}

function Radar({ size, blips, rivals }: { size: number; blips: ReturnType<typeof radarBlips>; rivals: Rival[] }) {
  const r = size / 2;
  const closing = blips.filter((b) => b.closing && b.sy > 0).length;
  return (
    <svg width={size} height={size} role="img" aria-label={`Proximity radar: ${blips.length} riders in range${closing ? `, ${closing} closing from behind` : ''}`}>
      <circle cx={r} cy={r} r={r - 1} fill="#7a5519" />
      <circle cx={r} cy={r} r={r * 0.86} fill="#0f1a17" stroke="#3a2a10" strokeWidth={2} />
      {[0.33, 0.66].map((k) => <circle key={k} cx={r} cy={r} r={r * 0.86 * k} fill="none" stroke="rgba(63,182,168,.3)" />)}
      <line x1={r} y1={r * 0.14} x2={r} y2={r * 1.86} stroke="rgba(63,182,168,.25)" />
      <line x1={r * 0.14} y1={r} x2={r * 1.86} y2={r} stroke="rgba(63,182,168,.25)" />
      <path d={`M ${r} ${r * 0.2} l -5 9 h 10 z`} fill="#3fb6a8" />
      <circle cx={r} cy={r} r={4} fill="#f08a24" />
      {blips.map((b) => {
        const rv = rivals.find((x) => x.id === b.id)!;
        return (
          <g key={b.id}>
            {b.closing && <circle cx={r + b.sx * r * 0.86} cy={r + b.sy * r * 0.86} r={8} fill="none" stroke="#ef5350" strokeWidth={2} />}
            <circle cx={r + b.sx * r * 0.86} cy={r + b.sy * r * 0.86} r={4} fill={rv.color} />
          </g>
        );
      })}
      <text x={r} y={size - 6} textAnchor="middle" fontSize={9} fontFamily="Cinzel" fontWeight={800} fill="#f1cf85">SONAR</text>
    </svg>
  );
}

export function CockpitDemo() {
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 960, h: 540 });
  const [stage, setStage] = useState<StageKey>('alpine');
  const [fixStrobe, setFixStrobe] = useState(true);
  const [ik, setIk] = useState(true);
  const opts = useRef({ stage, fixStrobe });
  opts.current = { stage, fixStrobe };
  const sim = useRef<Sim>({
    z: laneZ(2), vz: 0, lane: 2, kmh: 40, dist: 0, boost: 3, shield: 6, time: 0, grade: 0, roll: 0, rollRate: 0, jolt: 0, frameDt: 1 / 60,
    rivals: [
      { id: 1, x: 500, z: laneZ(1), vx: 300, lane: 1, color: '#5fb4c9' },
      { id: 2, x: -420, z: laneZ(3), vx: 300, lane: 3, color: '#b388eb' },
      { id: 3, x: 1400, z: laneZ(0), vx: 300, lane: 0, color: '#9ccc65' },
    ],
  });
  const keys = useRef({ up: false, down: false });
  const reducedRef = useRef(false);
  const [, force] = useState(0);

  useEffect(() => {
    const el = boxRef.current!;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    let raf = 0, last = performance.now(), acc = 0, ui = 0;
    reducedRef.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const loop = (now: number) => {
      const frameDt = Math.min(0.1, (now - last) / 1000);
      acc += frameDt;
      last = now;
      const s = sim.current;
      s.frameDt = frameDt || 1 / 60;
      while (acc >= 1 / 120) {
        const dt = 1 / 120;
        const r = steerStep(s, laneZ(s.lane), dt);
        s.z = r.z; s.vz = r.vz;
        if (keys.current.up) s.kmh = Math.min(340, s.kmh + 60 * dt);
        if (keys.current.down) s.kmh = Math.max(0, s.kmh - 90 * dt);
        s.grade = Math.sin(s.dist / 5200) * 18;
        s.kmh = clamp(s.kmh + -s.grade * 0.6 * dt, 0, 360);
        const vx = s.kmh / 0.16;
        s.dist += vx * dt;
        s.rollRate = Math.hypot(vx, s.vz) / RADIUS;
        s.roll = (s.roll + s.rollRate * dt) % TAU;
        s.time += dt;
        s.shield = Math.max(0, s.shield - dt * 0.25);
        s.jolt = cockpitJolt(s.jolt, 0, dt, reducedRef.current);
        s.rivals.forEach((rv, i) => {
          rv.vx = vx * (1 + Math.sin(s.time * 0.35 + i * 2.1) * 0.12) + 20;
          rv.x += rv.vx * dt;
          if (Math.floor(s.time * 0.4 + i) !== Math.floor((s.time - dt) * 0.4 + i) && Math.sin(s.time * 3 + i) > 0.3) rv.lane = clamp(rv.lane + (Math.sin(s.time + i) > 0 ? 1 : -1), 0, 3);
          rv.z += (laneZ(rv.lane) - rv.z) * Math.min(1, dt * 3);
          const rel = rv.x - s.dist;
          if (rel > 2200) rv.x = s.dist - 800;
          if (rel < -1100) rv.x = s.dist + 1800;
        });
        acc -= dt;
      }
      const c = canvasRef.current;
      const ctx = c?.getContext('2d');
      if (c && ctx) {
        const L = cockpitLayout(c.width, c.height);
        const bob = reducedRef.current ? 0 : Math.sin(s.dist / 60) * Math.min(6, s.kmh / 60);
        drawWorld(ctx, L, s, bob, opts.current.stage, opts.current.fixStrobe, reducedRef.current);
      }
      if (now - ui > 33) { ui = now; force((n) => n + 1); }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const bump = () => {
    const s = sim.current;
    s.jolt = cockpitJolt(s.jolt, 15 * 0.66, 0, reducedRef.current);
    s.vz += s.lane < 2 ? -260 : 260;
  };

  const onKey = (e: ReactKeyboardEvent, down: boolean) => {
    const s = sim.current;
    const k = e.key.toLowerCase();
    if (['a', 'd', 'w', 's', 'b', 'x', 'arrowleft', 'arrowright', 'arrowup', 'arrowdown'].includes(k)) e.preventDefault();
    if (down && !e.repeat) {
      if (k === 'a' || k === 'arrowleft') s.lane = Math.max(0, s.lane - 1);
      if (k === 'd' || k === 'arrowright') s.lane = Math.min(3, s.lane + 1);
      if (k === 'b' && s.boost > 0) { s.boost--; s.kmh = Math.min(360, s.kmh + 60); }
      if (k === 'x') bump();
    }
    if (k === 'w' || k === 'arrowup') keys.current.up = down;
    if (k === 's' || k === 'arrowdown') keys.current.down = down;
  };

  const s = sim.current;
  const L = cockpitLayout(size.w, size.h);
  const steer = steerFrom(s.vz, 1);
  const yoke = yokeAngleDeg(steer);
  const arms = armPose(L, yoke);
  const neutral = armPose(L, 0);
  const ap = L.aperture;
  const armW = Math.max(26, L.yokeHalfSpan * 0.34);
  const gs = Math.min(size.h * 0.26, size.w * 0.15);
  const radarSize = Math.max(90, size.h * 0.22);
  const t = s.time;
  const timeStr = `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}.${String(Math.floor((t % 1) * 100)).padStart(2, '0')}`;
  const blips = radarBlips({ x: s.dist, z: s.z, vx: s.kmh / 0.16 }, s.rivals);
  const st = STAGES[stage];
  const light = cockpitLight(st.cave, st.fog);
  const cage = cageBarAlpha(s.rollRate, s.frameDt);

  return (
    <div className="panel p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex overflow-hidden rounded-lg border border-iron-3" role="group" aria-label="Stage lighting">
          {(Object.keys(STAGES) as StageKey[]).map((k) => (
            <button key={k} type="button" onClick={() => setStage(k)} aria-pressed={stage === k} className={cn('px-2.5 py-1 text-xs font-semibold', stage === k ? 'bg-brass/20 text-brass-2' : 'text-stone-400')}>{STAGES[k].label}</button>
          ))}
        </div>
        <label className="flex items-center gap-1.5 text-xs text-stone-300"><input type="checkbox" className="accent-amber-500" checked={fixStrobe} onChange={(e) => setFixStrobe(e.target.checked)} /> Anti-strobe cage (UQ3)</label>
        <label className="flex items-center gap-1.5 text-xs text-stone-300"><input type="checkbox" className="accent-amber-500" checked={ik} onChange={(e) => setIk(e.target.checked)} /> Two-bone IK arms (UQ13)</label>
        <button type="button" className="btn !py-1 !text-xs" onClick={bump}>💥 Heavy bump <span className="kbd">X</span></button>
      </div>
      <div
        ref={boxRef}
        tabIndex={0}
        onKeyDown={(e) => onKey(e, true)}
        onKeyUp={(e) => onKey(e, false)}
        className="relative aspect-video w-full overflow-hidden rounded-lg border border-iron-3 bg-black outline-none focus-visible:ring-2 focus-visible:ring-teal"
        aria-label="Cockpit prototype. Click, then A/D or arrows to change lane, W/S speed, B boost, X heavy bump."
      >
        <canvas ref={canvasRef} width={Math.round(size.w)} height={Math.round(size.h)} className="absolute inset-0 h-full w-full" />
        {/* cockpit layer: jolted and lit as one unit */}
        <div className="pointer-events-none absolute inset-0" style={{ transform: `translate(${s.jolt * 0.6}px, ${s.jolt}px)`, filter: `brightness(${light.brightness})` }}>
          <svg className="absolute inset-0" width={size.w} height={size.h}>
            <defs>
              <linearGradient id="iron" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3b4145" /><stop offset=".55" stopColor="#23282b" /><stop offset="1" stopColor="#15181a" /></linearGradient>
              <linearGradient id="brassrim" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#f5d894" /><stop offset=".5" stopColor="#a47a2c" /><stop offset="1" stopColor="#5c4214" /></linearGradient>
              <linearGradient id="caprim" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#6d4f1b" /><stop offset=".5" stopColor="#f1cf85" /><stop offset="1" stopColor="#6d4f1b" /></linearGradient>
            </defs>
            <path fillRule="evenodd" fill="url(#iron)" d={`M0 0H${size.w}V${size.h}H0Z M${ap.x + ap.radius} ${ap.y} H${ap.x + ap.w - ap.radius} Q${ap.x + ap.w} ${ap.y} ${ap.x + ap.w} ${ap.y + ap.radius} V${ap.y + ap.h - ap.radius} Q${ap.x + ap.w} ${ap.y + ap.h} ${ap.x + ap.w - ap.radius} ${ap.y + ap.h} H${ap.x + ap.radius} Q${ap.x} ${ap.y + ap.h} ${ap.x} ${ap.y + ap.h - ap.radius} V${ap.y + ap.radius} Q${ap.x} ${ap.y} ${ap.x + ap.radius} ${ap.y} Z`} />
            {/* gyro cap rims at window edges: they never roll */}
            <rect x={ap.x - 4} y={ap.y + ap.radius} width={10} height={ap.h - 2 * ap.radius} fill="url(#caprim)" />
            <rect x={ap.x + ap.w - 6} y={ap.y + ap.radius} width={10} height={ap.h - 2 * ap.radius} fill="url(#caprim)" />
            <rect x={ap.x} y={ap.y} width={ap.w} height={ap.h} rx={ap.radius} fill="none" stroke="url(#brassrim)" strokeWidth={Math.max(4, size.h * 0.012)} />
            {Array.from({ length: 22 }).map((_, i) => {
              const x = ap.x + ap.radius + ((ap.w - 2 * ap.radius) * i) / 21;
              return <g key={i}><circle cx={x} cy={ap.y - size.h * 0.022} r={size.h * 0.007} fill="#caa35a" /><circle cx={x} cy={ap.y + ap.h + size.h * 0.022} r={size.h * 0.007} fill="#caa35a" /></g>;
            })}
            <rect x={size.w / 2 - size.w * 0.08} y={ap.y + ap.h + size.h * 0.035} width={size.w * 0.16} height={size.h * 0.045} rx={4} fill="#2b2014" stroke="#a47a2c" />
            <text x={size.w / 2} y={ap.y + ap.h + size.h * 0.066} textAnchor="middle" fill="#f1cf85" fontFamily="Cinzel" fontWeight={800} fontSize={size.h * 0.026}>{timeStr}</text>
          </svg>
          <div className="absolute" style={{ left: ap.x + ap.w - radarSize - 14, top: ap.y + 12 }}>
            <Radar size={radarSize} blips={blips} rivals={s.rivals} />
          </div>
          <div className="absolute flex items-end gap-2" style={{ left: size.w * 0.03, top: ap.y + ap.h + size.h * 0.03 }}>
            <Gauge size={gs} angle={needleAngle(s.kmh, 0, 360, 240)} label="SPEED" value={`${Math.round(s.kmh)} km/h`} red />
            <Gauge size={gs * 0.66} angle={needleAngle(s.grade, -30, 30, 240)} label="GRADE" value={`${s.grade.toFixed(0)}%`} ticks={7} />
          </div>
          <div className="absolute flex items-end gap-2" style={{ right: size.w * 0.03, top: ap.y + ap.h + size.h * 0.03 }}>
            <Gauge size={gs * 0.66} angle={needleAngle(s.shield, 0, 12, 240)} label="SHIELD" value={`${s.shield.toFixed(1)}s`} ticks={7} />
            <Gauge size={gs} angle={needleAngle(s.boost, 0, 3, 240)} label="BOOST" value={`${s.boost} / 3`} ticks={4} />
          </div>
          {/* arms */}
          <svg className="absolute inset-0" width={size.w} height={size.h} aria-hidden>
            <defs><linearGradient id="skin" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#9bb04a" /><stop offset="1" stopColor="#56661f" /></linearGradient></defs>
            {(['left', 'right'] as const).map((side) => {
              const a = arms[side];
              if (!ik) {
                return (
                  <g key={side} transform={`translate(${a.x} ${a.y}) rotate(${a.rotDeg})`}>
                    <rect x={0} y={-armW / 2} width={a.length} height={armW} rx={armW / 2} fill="url(#skin)" stroke="#2f3a10" strokeWidth={2} />
                  </g>
                );
              }
              const reach0 = neutral[side].length;
              const sol = twoBoneIK({ x: a.x, y: a.y }, a.grip, reach0 * 0.54, reach0 * 0.5, side === 'left' ? -1 : 1);
              const l1 = reach0 * 0.54;
              const l2 = Math.hypot(sol.hand.x - sol.elbow.x, sol.hand.y - sol.elbow.y);
              return (
                <g key={side}>
                  <g transform={`translate(${a.x} ${a.y}) rotate(${sol.upperDeg})`}>
                    <rect x={-armW * 0.2} y={-armW * 0.6} width={l1 + armW * 0.4} height={armW * 1.2} rx={armW * 0.6} fill="url(#skin)" stroke="#2f3a10" strokeWidth={2} />
                    <path d={`M ${l1 * 0.3} ${-armW * 0.3} q ${l1 * 0.15} ${armW * 0.2} ${l1 * 0.3} 0`} stroke="#3e4c14" fill="none" strokeWidth={2} />
                  </g>
                  <g transform={`translate(${sol.elbow.x} ${sol.elbow.y}) rotate(${sol.foreDeg})`}>
                    <rect x={-armW * 0.2} y={-armW * 0.48} width={l2 + armW * 0.2} height={armW * 0.96} rx={armW * 0.45} fill="url(#skin)" stroke="#2f3a10" strokeWidth={2} />
                    <rect x={l2 * 0.35} y={-armW * 0.52} width={l2 * 0.35} height={armW * 1.04} rx={6} fill="#5a3b1e" stroke="#2a1a0a" />
                    <line x1={l2 * 0.42} y1={-armW * 0.52} x2={l2 * 0.42} y2={armW * 0.52} stroke="#c9a24a" strokeWidth={3} />
                    <line x1={l2 * 0.62} y1={-armW * 0.52} x2={l2 * 0.62} y2={armW * 0.52} stroke="#c9a24a" strokeWidth={3} />
                  </g>
                  <circle cx={sol.elbow.x} cy={sol.elbow.y} r={armW * 0.55} fill="#7f9a3a" stroke="#2f3a10" strokeWidth={2} />
                </g>
              );
            })}
          </svg>
          <svg className="absolute" aria-hidden
            style={{ left: L.yokeHub.x - L.yokeHalfSpan * 1.3, top: L.yokeHub.y - L.yokeHalfSpan * 1.3, width: L.yokeHalfSpan * 2.6, height: L.yokeHalfSpan * 2.6, transform: `rotate(${yoke}deg)`, transformOrigin: '50% 50%' }}
            viewBox="-130 -130 260 260">
            <defs><linearGradient id="yb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f5d894" /><stop offset=".5" stopColor="#b3862f" /><stop offset="1" stopColor="#5c4214" /></linearGradient></defs>
            <rect x={-18} y={0} width={36} height={140} fill="#2b2f31" stroke="#111" />
            <path d="M -100 -8 Q -100 -40 -70 -40 L 70 -40 Q 100 -40 100 -8 L 100 30 L 78 30 L 78 -10 Q 78 -18 70 -18 L -70 -18 Q -78 -18 -78 -10 L -78 30 L -100 30 Z" fill="url(#yb)" stroke="#3a2a10" strokeWidth={3} />
            <rect x={-108} y={-6} width={30} height={46} rx={10} fill="#4a2f17" stroke="#1d1208" strokeWidth={2} />
            <rect x={78} y={-6} width={30} height={46} rx={10} fill="#4a2f17" stroke="#1d1208" strokeWidth={2} />
            <circle cx={0} cy={-6} r={30} fill="url(#yb)" stroke="#3a2a10" strokeWidth={3} />
            <circle cx={0} cy={-6} r={16} fill="#2b2014" stroke="#a47a2c" strokeWidth={2} />
            <path d="M 0 -18 L 4 -6 L 0 6 L -4 -6 Z" fill="#e5642b" />
            {[-50, -25, 25, 50].map((x) => <circle key={x} cx={x} cy={-29} r={3.5} fill="#fff1c4" />)}
          </svg>
          <svg className="absolute inset-0" width={size.w} height={size.h} aria-hidden>
            {(['left', 'right'] as const).map((side) => {
              const g = arms[side].grip;
              return <g key={side}><ellipse cx={g.x} cy={g.y} rx={armW * 0.62} ry={armW * 0.55} fill="#7f9a3a" stroke="#2f3a10" strokeWidth={2} />
                {[-1, 0, 1].map((k) => <line key={k} x1={g.x - armW * 0.45} y1={g.y + k * armW * 0.2} x2={g.x + armW * 0.45} y2={g.y + k * armW * 0.2} stroke="#3e4c14" strokeWidth={1.5} />)}</g>;
            })}
          </svg>
          {/* cockpit tint from atmosphere (UQ14) */}
          <div className="absolute inset-0" style={{ background: `rgba(${light.tintRGB.join(',')},${light.tintAlpha})`, mixBlendMode: 'multiply' }} />
        </div>
        <div className="absolute left-1/2 top-3 -translate-x-1/2 rounded bg-black/50 px-2 py-1 font-mono text-[10px] text-stone-300">click · A/D lane · W/S speed · B boost · X bump</div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="btn btn-ghost" onClick={() => (sim.current.lane = Math.max(0, sim.current.lane - 1))}>◀ Lane −1</button>
        <button type="button" className="btn btn-ghost" onClick={() => (sim.current.lane = Math.min(3, sim.current.lane + 1))}>Lane +1 ▶</button>
        <button type="button" className="btn btn-ghost" onClick={() => (sim.current.kmh = 20)}>Slow to 20 km/h (see crisp cage bars)</button>
        <button type="button" className="btn btn-ghost" onClick={() => (sim.current.kmh = 220)}>220 km/h</button>
        <button type="button" className="btn" onClick={() => { if (sim.current.boost > 0) { sim.current.boost--; sim.current.kmh = Math.min(360, sim.current.kmh + 60); } }}>Boost</button>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-6">
        <Stat label="steer / yoke°" value={`${steer.toFixed(2)} / ${yoke.toFixed(1)}°`} />
        <Stat label="shoulder below edge" value={`${arms.left.y.toFixed(0)} > ${size.h.toFixed(0)}`} ok={arms.left.y > size.h} />
        <Stat label="roll rad/frame ÷ Nyquist" value={cage.ratio.toFixed(2)} ok={fixStrobe ? true : cage.ratio < 1} />
        <Stat label="cage bars α / blur α" value={`${cage.barAlpha.toFixed(2)} / ${cage.blurAlpha.toFixed(2)}`} />
        <Stat label="sonar blips / closing" value={`${blips.length} / ${blips.filter((b) => b.closing).length}`} />
        <Stat label="jolt px (≤10)" value={s.jolt.toFixed(1)} ok={s.jolt <= 10} />
      </div>
    </div>
  );
}
