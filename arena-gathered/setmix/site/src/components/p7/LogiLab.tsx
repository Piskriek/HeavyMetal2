import { useEffect, useRef, useState } from "react";
import {
  makeSwarm, stepSwarm, buildTube, stepTubes, injectCapsules, catmullRom,
  SWARM_DEFAULT, type LogiNode, type SwarmState, type PneumaticTube, type TubeCapsule,
} from "@/drop/LogisticsSwarm";
import { cn } from "@/utils/cn";

const NODES: LogiNode[] = [
  { id: "hub", kind: "HUB", pos: [0, 2, 0], produces: "NONE", produceRate: 0, consumes: "NONE", consumeRate: 0, buffer: 0, capacity: 10 },
  { id: "ex1", kind: "EXTRACTOR", pos: [-52, 1, -30], produces: "ORE", produceRate: 2.4, consumes: "NONE", consumeRate: 0, buffer: 4, capacity: 40 },
  { id: "ex2", kind: "EXTRACTOR", pos: [46, 1, -44], produces: "ORE", produceRate: 1.9, consumes: "NONE", consumeRate: 0, buffer: 0, capacity: 40 },
  { id: "ex3", kind: "EXTRACTOR", pos: [-38, 1, 52], produces: "ORE", produceRate: 2.1, consumes: "NONE", consumeRate: 0, buffer: 0, capacity: 40 },
  { id: "ch1", kind: "CHIMNEY", pos: [18, 1, 26], produces: "NONE", produceRate: 0, consumes: "ORE", consumeRate: 1.5, buffer: 20, capacity: 30 },
  { id: "ch2", kind: "CHIMNEY", pos: [-14, 1, -52], produces: "NONE", produceRate: 0, consumes: "ORE", consumeRate: 1.2, buffer: 18, capacity: 30 },
  { id: "sp1", kind: "SPIRE", pos: [54, 1, 34], produces: "NONE", produceRate: 0, consumes: "CARTRIDGE", consumeRate: 0.25, buffer: 6, capacity: 12 },
  { id: "st1", kind: "STORAGE", pos: [-6, 1, 14], produces: "ORE", produceRate: 0, consumes: "NONE", consumeRate: 0, buffer: 30, capacity: 220 },
  { id: "lab", kind: "LAB_PORTAL", pos: [8, 1, -16], produces: "CARTRIDGE", produceRate: 0.3, consumes: "NONE", consumeRate: 0, buffer: 8, capacity: 24 },
];

const KIND_COL: Record<string, string> = {
  HUB: "#e8eef7", EXTRACTOR: "#ff3d8a", CHIMNEY: "#ffc13d",
  STORAGE: "#7cff4d", LAB_PORTAL: "#b46bff", SPIRE: "#3dc8ff",
};

function h2(x: number, y: number) {
  let n = (x * 374761393 + y * 668265263) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}
const ground = (x: number, z: number) =>
  (h2(Math.floor(x / 12), Math.floor(z / 12)) - 0.5) * 7 + Math.sin(x * 0.04) * 3;

export default function LogiLab() {
  const ref = useRef<HTMLCanvasElement>(null);
  const [drones, setDrones] = useState(10);
  const [speed, setSpeed] = useState(1);
  const [tubesOn, setTubesOn] = useState(true);
  const [run, setRun] = useState(true);
  const [hud, setHud] = useState({
    active: 0, idle: 0, queued: 0, delivered: 0, tps: 0, caps: 0, tubeDelivered: 0,
  });
  const [tasks, setTasks] = useState<{ id: string; p: number; from: string; to: string; claimed: boolean }[]>([]);

  const cfg = useRef({ drones, speed, tubesOn, run });
  cfg.current = { drones, speed, tubesOn, run };

  useEffect(() => {
    let swarm: SwarmState = makeSwarm(NODES.map((n) => ({ ...n })), 10);
    const tubes: PneumaticTube[] = [
      buildTube("t1", NODES[1], NODES[7], 3, 7),
      buildTube("t2", NODES[3], NODES[7], 3, 6),
      buildTube("t3", NODES[8], NODES[6], 4, 9),
    ];
    let caps: TubeCapsule[] = [];
    let acc = new Map<string, number>();
    let tubeDelivered = 0;
    let raf = 0, last = performance.now(), t = 0, simAcc = 0;

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const c = cfg.current;
      const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;

      // match the requested drone count without rebuilding the swarm
      if (swarm.drones.length !== c.drones) {
        const hub = swarm.nodes.get("hub")!;
        if (swarm.drones.length < c.drones) {
          const i = swarm.drones.length;
          swarm = { ...swarm, drones: [...swarm.drones, {
            id: `d${i}_${t.toFixed(3)}`, pos: [hub.pos[0], hub.pos[1] + 7, hub.pos[2]],
            vel: [0, 0, 0], state: "IDLE", taskId: null, payload: "NONE",
            amount: 0, beam: 0, cargoLerp: 0, energy: 1,
          }] };
        } else swarm = { ...swarm, drones: swarm.drones.slice(0, c.drones) };
      }

      if (c.run) {
        simAcc += dt * c.speed;
        let guard = 0;
        while (simAcc >= 1 / 120 && guard++ < 30) {
          simAcc -= 1 / 120;
          swarm = stepSwarm(swarm, { cfg: SWARM_DEFAULT, ground, dt: 1 / 120, ticks: 1 });
        }
        if (c.tubesOn) {
          const inj = injectCapsules(tubes, swarm.nodes, acc, dt);
          acc = inj.acc;
          swarm = { ...swarm, nodes: inj.nodes };
          caps = [...caps, ...inj.spawned];
          const st = stepTubes(tubes, caps, swarm.nodes, 16, dt);
          caps = st.capsules;
          swarm = { ...swarm, nodes: st.nodes };
          tubeDelivered += st.delivered;
        }
      }

      /* ── render ─────────────────────────────────────────────────── */
      const cv = ref.current;
      if (!cv) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const r = cv.getBoundingClientRect();
      const W = Math.round(r.width * dpr), H = Math.round(r.height * dpr);
      if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
      const g = cv.getContext("2d")!;
      g.fillStyle = "#05070c"; g.fillRect(0, 0, W, H);

      const S = Math.min(W / 185, H / 135);
      const PX = (x: number, z: number) => W / 2 + (x - z) * S * 0.82;
      const PY = (x: number, z: number, y = 0) => H * 0.56 + (x + z) * S * 0.4 - y * S * 0.78;

      g.strokeStyle = "rgba(27,36,52,0.85)"; g.lineWidth = 1;
      for (let i = -80; i <= 80; i += 20) {
        g.beginPath(); g.moveTo(PX(i, -80), PY(i, -80)); g.lineTo(PX(i, 80), PY(i, 80)); g.stroke();
        g.beginPath(); g.moveTo(PX(-80, i), PY(-80, i)); g.lineTo(PX(80, i), PY(80, i)); g.stroke();
      }

      /* tubes */
      if (c.tubesOn) {
        for (const tube of tubes) {
          g.strokeStyle = "rgba(140,170,210,0.30)"; g.lineWidth = 5 * dpr;
          g.beginPath();
          for (let i = 0; i <= 48; i++) {
            const p = catmullRom(tube.points, i / 48);
            i ? g.lineTo(PX(p[0], p[2]), PY(p[0], p[2], p[1])) : g.moveTo(PX(p[0], p[2]), PY(p[0], p[2], p[1]));
          }
          g.stroke();
          g.strokeStyle = "rgba(190,225,255,0.17)"; g.lineWidth = 1.6 * dpr; g.stroke();
          // support pylons
          for (const p of tube.points) {
            g.strokeStyle = "rgba(100,120,150,0.4)"; g.lineWidth = 1.6 * dpr;
            g.beginPath();
            g.moveTo(PX(p[0], p[2]), PY(p[0], p[2], p[1]));
            g.lineTo(PX(p[0], p[2]), PY(p[0], p[2], ground(p[0], p[2])));
            g.stroke();
          }
        }
        for (const cap of caps) {
          const tube = tubes.find((x) => x.id === cap.tubeId);
          if (!tube) continue;
          const p = catmullRom(tube.points, cap.t);
          const px = PX(p[0], p[2]), py = PY(p[0], p[2], p[1]);
          const col = cap.payload === "CARTRIDGE" ? "#b46bff" : "#ff8fc0";
          g.save(); g.translate(px, py); g.rotate(cap.spin);
          g.fillStyle = col; g.fillRect(-2.6 * dpr, -2.6 * dpr, 5.2 * dpr, 5.2 * dpr);
          g.restore();
          g.fillStyle = col + "44";
          g.beginPath(); g.arc(px, py, 6 * dpr, 0, 6.28); g.fill();
        }
      }

      /* nodes */
      const sorted = [...swarm.nodes.values()].sort((a, b) => (a.pos[0] + a.pos[2]) - (b.pos[0] + b.pos[2]));
      for (const n of sorted) {
        const px = PX(n.pos[0], n.pos[2]), py = PY(n.pos[0], n.pos[2], ground(n.pos[0], n.pos[2]));
        const col = KIND_COL[n.kind] ?? "#8b9bb4";
        const hgt = (n.kind === "CHIMNEY" || n.kind === "SPIRE" ? 9 : 4.5) * S;
        g.fillStyle = col + "cc";
        g.beginPath();
        g.moveTo(px - 2.2 * S, py); g.lineTo(px + 2.2 * S, py);
        g.lineTo(px + 1.5 * S, py - hgt); g.lineTo(px - 1.5 * S, py - hgt);
        g.closePath(); g.fill();
        g.strokeStyle = col; g.lineWidth = dpr; g.stroke();

        // buffer bar — starvation is visible at a glance
        const fill = n.capacity ? n.buffer / n.capacity : 0;
        const bw = 4.4 * S;
        g.fillStyle = "#11161f";
        g.fillRect(px - bw / 2, py - hgt - 7 * dpr, bw, 3.4 * dpr);
        const starving = n.consumes !== "NONE" && fill < 0.35;
        g.fillStyle = starving ? "#ff3d8a" : fill > 0.9 ? "#ffc13d" : "#7cff4d";
        g.fillRect(px - bw / 2, py - hgt - 7 * dpr, bw * fill, 3.4 * dpr);
        if (starving) {
          g.fillStyle = "#ff3d8a";
          g.font = `bold ${8.5 * dpr}px ui-monospace, monospace`;
          g.fillText("STARVED", px - 16 * dpr, py - hgt - 12 * dpr);
        }
      }

      /* drones */
      for (const d of swarm.drones) {
        const px = PX(d.pos[0], d.pos[2]), py = PY(d.pos[0], d.pos[2], d.pos[1]);
        // shadow on the ground, so altitude reads
        const gy = PY(d.pos[0], d.pos[2], ground(d.pos[0], d.pos[2]));
        g.fillStyle = "rgba(0,0,0,0.35)";
        g.beginPath(); g.ellipse(px, gy, 4 * dpr, 2 * dpr, 0, 0, 6.28); g.fill();

        // tractor beam
        if (d.beam > 0.01) {
          const task = swarm.tasks.find((x) => x.id === d.taskId);
          const tgt = task ? swarm.nodes.get(d.state === "LOADING" ? task.from : task.to) : null;
          if (tgt) {
            const tx = PX(tgt.pos[0], tgt.pos[2]), ty = PY(tgt.pos[0], tgt.pos[2], ground(tgt.pos[0], tgt.pos[2]));
            const grd = g.createLinearGradient(px, py, tx, ty);
            grd.addColorStop(0, `rgba(120,230,255,${0.1 + d.beam * 0.55})`);
            grd.addColorStop(1, "rgba(120,230,255,0.04)");
            g.strokeStyle = grd; g.lineWidth = (1.5 + d.beam * 4) * dpr;
            g.beginPath(); g.moveTo(px, py); g.lineTo(tx, ty); g.stroke();
            // the cargo cube lerps along the beam
            const lp = d.state === "LOADING" ? 1 - d.cargoLerp : d.cargoLerp;
            const cx = px + (tx - px) * lp, cy = py + (ty - py) * lp;
            g.fillStyle = "#ff8fc0";
            g.fillRect(cx - 2.4 * dpr, cy - 2.4 * dpr, 4.8 * dpr, 4.8 * dpr);
          }
        }

        const col = d.payload !== "NONE" ? "#ffc13d" : d.state === "IDLE" ? "#6b7a90" : "#3dc8ff";
        g.fillStyle = col;
        g.beginPath(); g.arc(px, py, 3.6 * dpr, 0, 6.28); g.fill();
        // rotor blur
        g.strokeStyle = col + "66"; g.lineWidth = dpr;
        g.beginPath(); g.ellipse(px, py - 3 * dpr, 6 * dpr, 1.6 * dpr, 0, 0, 6.28); g.stroke();
        if (d.payload !== "NONE") {
          g.fillStyle = "#ff8fc0";
          g.fillRect(px - 2 * dpr, py + 4 * dpr, 4 * dpr, 4 * dpr);
        }
      }

      setHud({
        active: swarm.stats.active, idle: swarm.stats.idle, queued: swarm.stats.queued,
        delivered: swarm.delivered, tps: swarm.stats.throughput,
        caps: caps.length, tubeDelivered,
      });
      setTasks(swarm.tasks.slice(0, 6).map((x) => ({
        id: x.id, p: x.priority, from: x.from, to: x.to, claimed: !!x.claimedBy,
      })));
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="fi-panel border border-line bg-panel">
      <div className="grid lg:grid-cols-[minmax(0,1fr)_278px]">
        <div className="border-b border-line lg:border-r lg:border-b-0">
          <canvas ref={ref} className="w-full bg-void" style={{ aspectRatio: "16/10" }} />
        </div>
        <div className="p-3">
          {([
            ["drones", drones, 1, 28, 1, setDrones],
            ["sim speed", speed, 0.25, 6, 0.25, setSpeed],
          ] as const).map(([k, v, mn, mx, st, set]) => (
            <div key={k} className="mb-1.5">
              <div className="mono flex justify-between text-[9.5px]">
                <span className="text-dim">{k}</span>
                <span className="tnum text-chalk">{v}{k === "sim speed" ? "×" : ""}</span>
              </div>
              <input type="range" min={mn} max={mx} step={st} value={v}
                onChange={(e) => (set as (n: number) => void)(+e.target.value)} className="w-full" />
            </div>
          ))}
          <div className="mt-1 grid grid-cols-2 gap-1">
            <button onClick={() => setRun(!run)}
              className={cn("mono border px-2 py-1.5 text-[9px] font-bold uppercase",
                run ? "border-transparent bg-chalk text-void" : "border-line text-dim")}>
              {run ? "■ pause" : "▶ run"}
            </button>
            <button onClick={() => setTubesOn(!tubesOn)}
              className={cn("mono border px-2 py-1.5 text-[9px] font-bold uppercase",
                tubesOn ? "border-transparent bg-aq text-void" : "border-line text-dim")}>
              ⌇ tubes
            </button>
          </div>

          <div className="mt-3 border-t border-line pt-2">
            {([
              ["drones active", `${hud.active} / ${hud.active + hud.idle}`, "#3dc8ff"],
              ["unclaimed tasks", hud.queued, hud.queued > 3 ? "#ff3d8a" : "#7cff4d"],
              ["drone deliveries", Math.round(hud.delivered).toLocaleString(), "#ffc13d"],
              ["units / sim-sec", hud.tps.toFixed(2), "var(--fi-accent)"],
              ["capsules in tubes", hud.caps, "#b46bff"],
              ["tube deliveries", Math.round(hud.tubeDelivered).toLocaleString(), "#b46bff"],
            ] as const).map(([k, v, c]) => (
              <div key={k} className="mono flex justify-between border-b border-line/40 py-[3px] text-[9.5px] last:border-0">
                <span className="text-dim">{k}</span>
                <span className="tnum" style={{ color: c }}>{v}</span>
              </div>
            ))}
          </div>

          <div className="mt-2 border-t border-line pt-2">
            <div className="mono mb-1 text-[9px] tracking-[0.2em] text-dim uppercase">
              dispatch queue (priority ↑)
            </div>
            {tasks.length === 0 && <div className="mono text-[9px] text-dim/60">— all satisfied —</div>}
            {tasks.map((t) => (
              <div key={t.id} className="mono flex items-center gap-1.5 py-[2px] text-[8.5px]">
                <span className="w-5 shrink-0 font-bold"
                  style={{ color: t.p === 0 ? "#ff3d8a" : t.p <= 20 ? "#ffc13d" : "#6b7a90" }}>
                  P{t.p}
                </span>
                <span className="truncate text-chalk/80">{t.from} → {t.to}</span>
                <span className={cn("ml-auto shrink-0", t.claimed ? "text-vtx" : "text-dim/60")}>
                  {t.claimed ? "◉" : "○"}
                </span>
              </div>
            ))}
          </div>

          <p className="mono mt-2 text-[9px] leading-snug text-dim">
            Drop to <span className="text-pxd">1 drone</span>: chimneys go{" "}
            <span className="text-pxd">STARVED</span> and P0 tasks pile up, because terraforming
            has literally stopped. The swarm always serves P0 first and breaks ties on distance —
            locally greedy, globally correct.
          </p>
        </div>
      </div>
    </div>
  );
}
