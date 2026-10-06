import { useEffect, useRef, useState } from "react";
import {
  CHASSIS, makeRover, stepRover, roverTelemetry, stepChaseCamera,
  stepMount, emitThrusterMotes, stepThrusterMotes, peakSlipDeg,
  type RoverInput, type Ground, type ChaseCamera,
  type MountState, type ThrusterMote,
} from "@/drop/GoblinRover";
import {
  buildTrack, initialRace, stepRace, startGhost, recordGhost, markGhostGate,
  finishGhost, sampleGhost, ghostBytes, ghostSectors, formatTime, ticksToMs,
  CRATER_RIM, CANYON_RUN, NET_BUDGET,
  type GhostBuffer, type GhostRecorder, type RaceState, type TrackSpline,
} from "@/drop/RaceEngine";
import type { FidelityState } from "@/drop/contracts.setmix";
import { cn } from "@/utils/cn";

/* deterministic crater terrain */
function h2(x: number, y: number) {
  let n = (x * 374761393 + y * 668265263) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}
function vn(x: number, z: number) {
  const xi = Math.floor(x), zi = Math.floor(z);
  const fx = x - xi, fz = z - zi;
  const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = h2(xi, zi), b = h2(xi + 1, zi), c = h2(xi, zi + 1), d = h2(xi + 1, zi + 1);
  return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
}
const terrainH = (x: number, z: number) => {
  const r = Math.hypot(x, z);
  // a crater: raised rim at r≈150, bowl inside
  const rim = Math.exp(-((r - 150) ** 2) / 2600) * 16;
  const bowl = -Math.exp(-(r ** 2) / 14000) * 10;
  return vn(x * 0.013, z * 0.013) * 11 + vn(x * 0.047, z * 0.047) * 2.4 + rim + bowl - 6;
};

const TRACKS: TrackSpline[] = [
  buildTrack("crater", "Crater Rim", CRATER_RIM, { gateCount: 14, radius: 13, laps: 3 }),
  buildTrack("canyon", "Canyon Run", CANYON_RUN, { gateCount: 16, radius: 12, laps: 3 }),
];

type ChassisKey = keyof typeof CHASSIS;

export default function RaceLab() {
  const ref = useRef<HTMLCanvasElement>(null);
  const [chassisKey, setChassisKey] = useState<ChassisKey>("SCRAP_STRIDER");
  const [trackIdx, setTrackIdx] = useState(0);
  const [autopilot, setAutopilot] = useState(true);
  const [mounted, setMounted] = useState(true);
  const [exp, setExp] = useState(5.2);
  const [hud, setHud] = useState({
    kph: 0, slip: 0, peak: 0, drifting: false, boost: 1, fov: 60,
    grounded: 4, lap: 0, phase: "COUNTDOWN", time: 0, best: "--:--.---",
    delta: null as number | null, ghostB: 0, sectors: 0, frames: 0, mount: 0,
  });
  const keys = useRef<Record<string, boolean>>({});

  const cfg = useRef({ chassisKey, trackIdx, autopilot, mounted, exp });
  cfg.current = { chassisKey, trackIdx, autopilot, mounted, exp };

  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      keys.current[e.key.toLowerCase()] = true;
      if (["w", "a", "s", "d", " ", "shift"].includes(e.key.toLowerCase())) e.preventDefault();
    };
    const onUp = (e: KeyboardEvent) => { keys.current[e.key.toLowerCase()] = false; };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => { window.removeEventListener("keydown", onDown); window.removeEventListener("keyup", onUp); };
  }, []);

  useEffect(() => {
    const cv = ref.current!;
    let track = TRACKS[0];
    let chassis = CHASSIS.SCRAP_STRIDER;
    let rover = makeRover(chassis, [track.gates[0].pos[0], terrainH(track.gates[0].pos[0], track.gates[0].pos[2]) + 2, track.gates[0].pos[2]]);
    let race: RaceState = initialRace(240);
    let rec: GhostRecorder = startGhost(track);
    let ghost: GhostBuffer | null = null;
    let cam: ChaseCamera = { pos: [0, 40, 60], look: [0, 0, 0], fovDeg: 60, blend: 1 };
    let mount: MountState = { mounted: true, blend: 1, nearVehicle: true, promptDistance: 0 };
    let motes: ThrusterMote[] = [];
    let seed = 1337;
    const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
    let prevPos = [...rover.pos] as [number, number, number];
    let lastTrack = 0, lastChassis: ChassisKey = "SCRAP_STRIDER";
    let raf = 0, last = performance.now(), acc = 0, finishHold = 0;

    const ground: Ground = {
      height: terrainH,
      surface: (x, z) => {
        // the track spline is a cobbled road: more grip, and it shows
        let best = 1e9;
        for (const g of track.gates) best = Math.min(best, Math.hypot(x - g.pos[0], z - g.pos[2]));
        return Math.max(0, 1 - best / 26);
      },
    };

    const reset = () => {
      const g0 = track.gates[0];
      const yaw = Math.atan2(g0.dir[2], g0.dir[0]);
      rover = makeRover(chassis, [g0.pos[0], terrainH(g0.pos[0], g0.pos[2]) + 2, g0.pos[2]], yaw);
      rover.occupied = true;
      race = initialRace(240);
      rec = startGhost(track);
      prevPos = [...rover.pos] as [number, number, number];
      motes = [];
      finishHold = 0;
    };
    reset();

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const c = cfg.current;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      if (c.trackIdx !== lastTrack || c.chassisKey !== lastChassis) {
        lastTrack = c.trackIdx; lastChassis = c.chassisKey;
        track = TRACKS[c.trackIdx];
        chassis = CHASSIS[c.chassisKey];
        ghost = null;
        reset();
      }

      const v = Math.pow(10, c.exp);
      const fi: FidelityState = { pxd: v * 1.32, vtx: v, lx: v * 0.72, aq: v * 0.46, tick: 0 };

      acc += dt;
      const stepT = 1 / 120;
      let guard = 0;
      while (acc >= stepT && guard++ < 24) {
        acc -= stepT;

        /* ── input ───────────────────────────────────────────── */
        let input: RoverInput = { throttle: 0, steer: 0, handbrake: false, boost: false };
        if (c.autopilot) {
          // chase the next gate; brake-and-drift into tight corners
          const g = track.gates[race.nextGate];
          const dx = g.pos[0] - rover.pos[0], dz = g.pos[2] - rover.pos[2];
          const want = Math.atan2(dz, dx);
          let err = want - rover.yaw;
          while (err > Math.PI) err -= Math.PI * 2;
          while (err < -Math.PI) err += Math.PI * 2;
          const dist = Math.hypot(dx, dz);
          const speed = Math.hypot(rover.vel[0], rover.vel[2]);
          input = {
            steer: Math.max(-1, Math.min(1, err * 2.1)),
            throttle: Math.abs(err) > 1.1 && speed > 16 ? -0.2 : 1,
            handbrake: Math.abs(err) > 0.85 && speed > 19,
            boost: Math.abs(err) < 0.25 && dist > 55 && rover.boostFuel > 0.6,
          };
        } else {
          const k = keys.current;
          input = {
            throttle: (k["w"] || k["arrowup"] ? 1 : 0) - (k["s"] || k["arrowdown"] ? 1 : 0),
            steer: (k["d"] || k["arrowright"] ? 1 : 0) - (k["a"] || k["arrowleft"] ? 1 : 0),
            handbrake: !!k[" "],
            boost: !!k["shift"],
          };
        }

        prevPos = [...rover.pos] as [number, number, number];
        rover = stepRover(rover, input, chassis, ground, fi, 1);

        const beforeGate = race.nextGate;
        race = stepRace(race, track, prevPos, rover.pos, ghost, 1);
        if (race.phase === "RACING") {
          const raceTick = race.tick - race.startTick;
          const tel0 = roverTelemetry(rover, chassis);
          rec = recordGhost(rec, raceTick, rover.pos, rover.yaw, {
            boosting: rover.boosting, airborne: rover.airborne, drifting: tel0.drifting,
          });
          if (race.nextGate !== beforeGate) rec = markGhostGate(rec, beforeGate, raceTick);
        }
        // On finish, bank the ghost and restart. Done inline rather than in a
        // setTimeout so the sim never mutates from outside its own fixed step.
        if (race.phase === "FINISHED") {
          if (!ghost) ghost = finishGhost(rec, race.tick - race.startTick);
          finishHold += stepT;
          if (finishHold > 1.6) {
            finishHold = 0;
            race = initialRace(120);
            rec = startGhost(track);
            const g0 = track.gates[0];
            rover = makeRover(chassis,
              [g0.pos[0], terrainH(g0.pos[0], g0.pos[2]) + 2, g0.pos[2]],
              Math.atan2(g0.dir[2], g0.dir[0]));
            rover.occupied = true;
          }
        }

        emitThrusterMotes(motes, rover, chassis, stepT, rnd);
      }

      motes = stepThrusterMotes(motes, dt);
      mount = stepMount(mount, rover.pos, rover, false, dt);
      mount = { ...mount, mounted: c.mounted, blend: mount.blend + ((c.mounted ? 1 : 0) - mount.blend) * (1 - Math.exp(-6 * dt)) };
      cam = stepChaseCamera(cam, rover, mount.blend, dt);

      /* ═══════════════════ render ═══════════════════ */
      const dpr = Math.min(1.75, window.devicePixelRatio || 1);
      const r = cv.getBoundingClientRect();
      const W = Math.round(r.width * dpr), H = Math.round(r.height * dpr);
      if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
      const g2 = cv.getContext("2d")!;

      // sky
      const sky = g2.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, "#0a1020"); sky.addColorStop(1, "#1d2a3e");
      g2.fillStyle = sky; g2.fillRect(0, 0, W, H);

      // camera basis
      const fwd = [cam.look[0] - cam.pos[0], cam.look[1] - cam.pos[1], cam.look[2] - cam.pos[2]];
      const fl = Math.hypot(fwd[0], fwd[1], fwd[2]) || 1;
      fwd[0] /= fl; fwd[1] /= fl; fwd[2] /= fl;
      const rt = [fwd[2], 0, -fwd[0]];
      const rl = Math.hypot(rt[0], rt[2]) || 1;
      rt[0] /= rl; rt[2] /= rl;
      const up = [rt[2] * fwd[1] - rt[1] * fwd[2], rt[0] * fwd[2] - rt[2] * fwd[0], rt[1] * fwd[0] - rt[0] * fwd[1]];
      const f = (H * 0.5) / Math.tan((cam.fovDeg * Math.PI / 180) / 2);

      const proj = (p: readonly number[]): [number, number, number] | null => {
        const dx = p[0] - cam.pos[0], dy = p[1] - cam.pos[1], dz = p[2] - cam.pos[2];
        const z = dx * fwd[0] + dy * fwd[1] + dz * fwd[2];
        if (z < 0.6) return null;
        const x = dx * rt[0] + dy * rt[1] + dz * rt[2];
        const y = dx * up[0] + dy * up[1] + dz * up[2];
        return [W / 2 + (x * f) / z, H / 2 - (y * f) / z, z];
      };

      /* ground mesh around the rover */
      const STEP = 9, SPAN = 150;
      const bx = Math.round(rover.pos[0] / STEP) * STEP;
      const bz = Math.round(rover.pos[2] / STEP) * STEP;
      type Quad = { pts: [number, number][]; z: number; col: string };
      const quads: Quad[] = [];
      for (let zz = -SPAN; zz < SPAN; zz += STEP)
        for (let xx = -SPAN; xx < SPAN; xx += STEP) {
          const x0 = bx + xx, z0 = bz + zz, x1 = x0 + STEP, z1 = z0 + STEP;
          const c0 = proj([x0, terrainH(x0, z0), z0]);
          const c1 = proj([x1, terrainH(x1, z0), z0]);
          const c2 = proj([x1, terrainH(x1, z1), z1]);
          const c3 = proj([x0, terrainH(x0, z1), z1]);
          if (!c0 || !c1 || !c2 || !c3) continue;
          const z = (c0[2] + c1[2] + c2[2] + c3[2]) * 0.25;
          if (z > 340) continue;
          const road = ground.surface((x0 + x1) / 2, (z0 + z1) / 2);
          const hAvg = (terrainH(x0, z0) + terrainH(x1, z1)) * 0.5;
          const sh = 0.55 + Math.min(0.45, Math.max(0, (hAvg + 14) / 46));
          const fog = Math.min(0.82, z / 340);
          const base = road > 0.1
            ? [120 + road * 70, 108 + road * 50, 96 + road * 40]
            : [58 * sh + 22, 62 * sh + 24, 70 * sh + 28];
          const col = `rgb(${Math.round(base[0] * (1 - fog) + 29 * fog)},${Math.round(base[1] * (1 - fog) + 42 * fog)},${Math.round(base[2] * (1 - fog) + 62 * fog)})`;
          quads.push({ pts: [[c0[0], c0[1]], [c1[0], c1[1]], [c2[0], c2[1]], [c3[0], c3[1]]], z, col });
        }
      quads.sort((a, b) => b.z - a.z);
      for (const q of quads) {
        g2.fillStyle = q.col;
        g2.beginPath();
        g2.moveTo(q.pts[0][0], q.pts[0][1]);
        for (let i = 1; i < 4; i++) g2.lineTo(q.pts[i][0], q.pts[i][1]);
        g2.closePath(); g2.fill();
        g2.strokeStyle = q.col; g2.lineWidth = 1; g2.stroke();
      }

      /* holographic gates */
      const gateList = track.gates
        .map((gg, i) => ({ gg, i, d: Math.hypot(gg.pos[0] - cam.pos[0], gg.pos[2] - cam.pos[2]) }))
        .sort((a, b) => b.d - a.d);
      for (const { gg, i } of gateList) {
        const isNext = i === race.nextGate;
        const gh = terrainH(gg.pos[0], gg.pos[2]);
        const col = isNext ? "#7cff4d" : gg.isSplit ? "#ffc13d" : "#3dc8ff";
        const perp = [-gg.dir[2], 0, gg.dir[0]];
        g2.strokeStyle = col;
        g2.lineWidth = (isNext ? 3 : 1.6) * dpr;
        g2.globalAlpha = isNext ? 0.95 : 0.4;
        g2.beginPath();
        let started = false;
        for (let a = 0; a <= 28; a++) {
          const ang = (a / 28) * Math.PI;
          const px = gg.pos[0] + perp[0] * Math.cos(ang) * gg.radius;
          const py = gh + Math.sin(ang) * gg.radius * 0.92 + 0.4;
          const pz = gg.pos[2] + perp[2] * Math.cos(ang) * gg.radius;
          const sp = proj([px, py, pz]);
          if (!sp) { started = false; continue; }
          started ? g2.lineTo(sp[0], sp[1]) : (g2.moveTo(sp[0], sp[1]), (started = true));
        }
        g2.stroke();
        g2.globalAlpha = 1;
      }

      /* ghost car */
      if (ghost && race.phase === "RACING") {
        const gp = sampleGhost(ghost, race.tick - race.startTick);
        if (gp) {
          const sp = proj([gp.pos[0], gp.pos[1] + 0.6, gp.pos[2]]);
          if (sp) {
            const s = Math.max(4, (chassis.half[0] * 2.4 * f) / sp[2]);
            g2.globalAlpha = 0.42;
            g2.fillStyle = gp.boosting ? "#ff6fb2" : "#8b9bb4";
            g2.fillRect(sp[0] - s / 2, sp[1] - s * 0.4, s, s * 0.8);
            g2.globalAlpha = 1;
          }
        }
      }

      /* thruster motes */
      for (const m of motes) {
        const sp = proj(m.p);
        if (!sp) continue;
        const s = Math.max(1.5, (m.size * 3 * f) / sp[2]);
        const PAL = ["#ff3d8a", "#7cff4d", "#ffc13d", "#3dc8ff"];
        g2.globalAlpha = (1 - m.life) * 0.85;
        g2.fillStyle = PAL[Math.floor(m.hue * 4) % 4];
        g2.fillRect(sp[0] - s / 2, sp[1] - s / 2, s, s);
      }
      g2.globalAlpha = 1;

      /* the rover */
      const cy = Math.cos(rover.yaw), sy = Math.sin(rover.yaw);
      const hl = chassis.half;
      const corners: [number, number, number][] = [
        [hl[0], hl[1], hl[2]], [hl[0], hl[1], -hl[2]],
        [-hl[0], hl[1], -hl[2]], [-hl[0], hl[1], hl[2]],
      ];
      const top = corners.map(([lx, ly, lz]) =>
        proj([rover.pos[0] + lx * cy - lz * sy, rover.pos[1] + ly, rover.pos[2] + lx * sy + lz * cy]));
      if (top.every(Boolean)) {
        g2.fillStyle = rover.boosting ? "#ff8ab8" : "#c7d2e2";
        g2.beginPath();
        g2.moveTo(top[0]![0], top[0]![1]);
        for (let i = 1; i < 4; i++) g2.lineTo(top[i]![0], top[i]![1]);
        g2.closePath(); g2.fill();
        g2.strokeStyle = "#1b2434"; g2.lineWidth = 1.5 * dpr; g2.stroke();
      }
      // wheels, each at its own suspension height
      for (const w of rover.wheels) {
        const wx = rover.pos[0] + w.local[0] * cy - w.local[2] * sy;
        const wz = rover.pos[2] + w.local[0] * sy + w.local[2] * cy;
        const wy = w.grounded ? w.contact[1] + 0.3 : rover.pos[1] + w.local[1] - chassis.restLength;
        const sp = proj([wx, wy, wz]);
        if (!sp) continue;
        const s = Math.max(3, (0.74 * f) / sp[2]);
        g2.fillStyle = w.grounded
          ? (Math.abs(w.slipAngleDeg) > peakSlipDeg(chassis) * 1.25 ? "#ff3d8a" : "#2a3242")
          : "#6b7a90";
        g2.fillRect(sp[0] - s / 2, sp[1] - s / 2, s, s);
      }

      /* minimap */
      const MM = 118 * dpr, MX = W - MM - 12 * dpr, MY = 12 * dpr;
      g2.fillStyle = "rgba(5,7,12,0.78)";
      g2.fillRect(MX, MY, MM, MM);
      g2.strokeStyle = "#1b2434"; g2.lineWidth = 1; g2.strokeRect(MX, MY, MM, MM);
      const sc = MM / 420;
      const mp = (x: number, z: number): [number, number] => [MX + MM / 2 + x * sc, MY + MM / 2 + z * sc];
      g2.strokeStyle = "#3dc8ff66"; g2.lineWidth = 1;
      g2.beginPath();
      track.gates.forEach((gg, i) => {
        const [px, py] = mp(gg.pos[0], gg.pos[2]);
        i ? g2.lineTo(px, py) : g2.moveTo(px, py);
      });
      g2.closePath(); g2.stroke();
      const [nx, ny] = mp(track.gates[race.nextGate].pos[0], track.gates[race.nextGate].pos[2]);
      g2.fillStyle = "#7cff4d"; g2.fillRect(nx - 2.5, ny - 2.5, 5, 5);
      const [rx, ry] = mp(rover.pos[0], rover.pos[2]);
      g2.fillStyle = "#fff"; g2.fillRect(rx - 2, ry - 2, 4, 4);

      const tel = roverTelemetry(rover, chassis);
      const raceMs = race.phase === "RACING" ? ticksToMs(race.tick - race.startTick) : 0;
      setHud({
        kph: tel.speedKph, slip: tel.maxSlipDeg, peak: tel.peakSlipDeg, drifting: tel.drifting,
        boost: tel.boostPct, fov: tel.fovDeg, grounded: tel.grounded,
        lap: race.lap, phase: race.phase, time: raceMs,
        best: race.bestLapTicks ? formatTime(ticksToMs(race.bestLapTicks)) : "--:--.---",
        delta: race.deltaMs, ghostB: ghost ? ghostBytes(ghost) : rec.frames * 9,
        sectors: ghost ? ghostSectors(ghost) : 0, frames: ghost ? ghost.frames : rec.frames,
        mount: mount.blend,
      });
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const peak = hud.peak || 1;

  return (
    <div className="fi-panel border border-line bg-panel">
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-void">
        <canvas ref={ref} className="absolute inset-0 h-full w-full" />
        {/* diegetic race HUD */}
        <div className="pointer-events-none absolute top-3 left-3">
          <div className="mono text-[9px] tracking-[0.25em] text-chalk/60 uppercase">
            {TRACKS[trackIdx].name} · lap {hud.lap + 1}/{TRACKS[trackIdx].laps}
          </div>
          <div className="mono text-3xl leading-none font-black tabular-nums drop-shadow-[0_2px_8px_#000]">
            {formatTime(hud.time)}
          </div>
          <div className="mono mt-1 flex gap-3 text-[10px]">
            <span className="text-dim">best <span className="text-chalk">{hud.best}</span></span>
            {hud.delta !== null && (
              <span className={hud.delta < 0 ? "text-vtx" : "text-pxd"}>
                {hud.delta < 0 ? "−" : "+"}{Math.abs(hud.delta / 1000).toFixed(3)}
              </span>
            )}
          </div>
        </div>
        <div className="pointer-events-none absolute bottom-3 left-3">
          <div className="mono text-5xl leading-none font-black tabular-nums drop-shadow-[0_2px_8px_#000]">
            {hud.kph.toFixed(0)}<span className="ml-1 text-sm text-dim">km/h</span>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <div className="h-1.5 w-32 border border-line bg-void/70">
              <div className="h-full bg-lx transition-[width]" style={{ width: `${hud.boost * 100}%` }} />
            </div>
            <span className="mono text-[9px] text-lx">BOOST</span>
            <span className="mono text-[9px] text-dim">FOV {hud.fov.toFixed(0)}°</span>
          </div>
          {/* grip arc: slip vs Pacejka peak */}
          <div className="mono mt-1 flex items-center gap-2 text-[9px]">
            <div className="relative h-1.5 w-32 border border-line bg-void/70">
              <div className="absolute inset-y-0 w-px bg-chalk/70" style={{ left: `${Math.min(100, (peak / 30) * 100)}%` }} />
              <div className={cn("h-full", hud.drifting ? "bg-pxd" : "bg-vtx")}
                style={{ width: `${Math.min(100, (hud.slip / 30) * 100)}%` }} />
            </div>
            <span className={hud.drifting ? "text-pxd" : "text-dim"}>
              {hud.drifting ? "DRIFT" : "GRIP"} {hud.slip.toFixed(1)}°
            </span>
            <span className="text-dim">{hud.grounded}/4</span>
          </div>
        </div>
        {hud.phase === "COUNTDOWN" && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="mono fi-accent-text text-5xl font-black drop-shadow-[0_2px_12px_#000]">READY</span>
          </div>
        )}
      </div>

      <div className="border-t border-line bg-panel2 p-3">
        <div className="grid gap-3 lg:grid-cols-[1fr_280px]">
          <div>
            <div className="mb-2 flex flex-wrap gap-1">
              {(Object.keys(CHASSIS) as ChassisKey[]).map((k) => (
                <button key={k} onClick={() => setChassisKey(k)}
                  className={cn("mono border px-2 py-1 text-[9px] font-bold tracking-wider uppercase",
                    chassisKey === k ? "border-transparent bg-chalk text-void" : "border-line text-dim hover:text-chalk")}>
                  {k.replace("_", " ")} · {CHASSIS[k].drivetrain}
                </button>
              ))}
              {TRACKS.map((t, i) => (
                <button key={t.id} onClick={() => setTrackIdx(i)}
                  className={cn("mono border px-2 py-1 text-[9px] font-bold tracking-wider uppercase",
                    trackIdx === i ? "border-transparent bg-aq text-void" : "border-line text-dim hover:text-chalk")}>
                  ◎ {t.name}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1">
              <button onClick={() => setAutopilot(!autopilot)}
                className={cn("mono border px-2 py-1.5 text-[9px] font-bold uppercase",
                  autopilot ? "border-transparent bg-vtx text-void" : "border-line text-dim hover:text-chalk")}>
                {autopilot ? "◉ autopilot" : "○ manual — WASD · SPACE drift · SHIFT boost"}
              </button>
              <button onClick={() => setMounted(!mounted)}
                className={cn("mono border px-2 py-1.5 text-[9px] font-bold uppercase",
                  mounted ? "border-transparent bg-chalk text-void" : "border-line text-dim hover:text-chalk")}>
                E · {mounted ? "dismount" : "mount"} ({hud.mount.toFixed(2)})
              </button>
            </div>
            <div className="mono mt-2 flex justify-between text-[9.5px]">
              <span className="text-dim">planet fidelity (drives suspension damping)</span>
              <span className="tnum text-chalk">{Math.pow(10, exp).toExponential(1)}</span>
            </div>
            <input type="range" min={2} max={7.9} step={0.05} value={exp}
              onChange={(e) => setExp(+e.target.value)} className="w-full"
              style={{ ["--thumb" as string]: "var(--fi-accent)" }} />
            <p className="mono mt-1 text-[9px] leading-snug text-dim">
              Click the viewport first, then uncheck autopilot to drive. Hold{" "}
              <span className="text-chalk">SPACE</span> through a corner: the handbrake collapses rear
              grip to 28%, the slip angle passes the Pacejka peak, and the bar turns magenta.
            </p>
          </div>

          <div>
            <div className="mono mb-1 text-[9px] tracking-[0.2em] text-dim uppercase">Ghost buffer</div>
            {([
              ["keyframes @12 Hz", hud.frames, "#b46bff"],
              ["bytes", `${hud.ghostB} B`, hud.ghostB <= 2048 ? "#7cff4d" : "#ffc13d"],
              ["2 kB sectors", hud.sectors || "recording", "#3dc8ff"],
              ["per frame", "9 B", undefined],
              ["net, 8 racers", `${NET_BUDGET.bytesPerSecond8p} B/s`, "#7cff4d"],
            ] as const).map(([k, v, c]) => (
              <div key={k} className="mono flex justify-between border-b border-line/40 py-[3px] text-[9.5px] last:border-0">
                <span className="text-dim">{k}</span>
                <span className="tnum" style={{ color: c }}>{v}</span>
              </div>
            ))}
            <p className="mono mt-2 text-[9px] leading-snug text-dim">
              A pose per tick would be <span className="text-pxd">3.4 kB/s</span>. Resampled to
              12 Hz with 16-bit positions and a 1-byte yaw it is{" "}
              <span className="text-vtx">108 B/s</span> — and Hermite interpolation on playback
              makes it indistinguishable.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
