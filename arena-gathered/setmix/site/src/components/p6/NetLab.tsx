import { useEffect, useRef, useState } from "react";
import {
  NetBus, LoopbackChannel, encodeCommands, decodeCommands, jsonBytes,
  canSkipRollback, NET_NOTES, OPCODES, CMD_BYTES, INPUT_DELAY, ROLLBACK_WINDOW,
  type NetCommand, type SimAdapter,
} from "@/drop/NetBus";
import { contentHash } from "@/drop/fidelity";
import { cn } from "@/utils/cn";

/** A toy world the bus can actually simulate: machine count + a shader var. */
interface Toy { machines: number; octaves: number; pxd: number; tick: number }

const adapter: SimAdapter<Toy> = {
  clone: (s) => ({ ...s }),
  step: (s, cmds, tick) => {
    let { machines, octaves, pxd } = s;
    for (const c of cmds) {
      if (c.op === "setmix/placeEmitter") machines++;
      if (c.op === "setmix/setVariable") octaves = Math.max(1, Math.min(8, c.f[0]));
      if (c.op === "setmix/mine") pxd += 12;
    }
    pxd += machines * 0.1;
    return { machines, octaves, pxd, tick };
  },
  hash: (s) => contentHash([s.machines, s.octaves, +s.pxd.toFixed(3)]),
};

export default function NetLab() {
  const [latency, setLatency] = useState(80);
  const [jitter, setJitter] = useState(35);
  const [loss, setLoss] = useState(3);
  const [running, setRunning] = useState(true);
  const [stats, setStats] = useState<{ p: number; tick: number; conf: number; pred: number; rb: number; depth: number; sent: number; ratio: number; hash: string; state: Toy }[]>([]);
  const [log, setLog] = useState<string[]>([]);

  const cfg = useRef({ latency, jitter, loss, running });
  cfg.current = { latency, jitter, loss, running };

  useEffect(() => {
    /* two peers: A in the lab, B on the moon */
    const chans = [0, 1].map((i) => new LoopbackChannel(i, 80, 35, 0.03, 99 + i));
    chans.forEach((c) => c.connect(chans));
    const init: Toy = { machines: 0, octaves: 4, pxd: 0, tick: 0 };
    const buses = chans.map((c) => new NetBus(adapter, init, c));
    const seeds = [12345, 67890];
    const rngs = seeds.map((s) => { let x = s >>> 0; return () => ((x = (Math.imul(x, 1664525) + 1013904223) >>> 0) / 4294967296); });

    let raf = 0, last = performance.now(), acc = 0, tick = 0;
    const lines: string[] = [];

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const c = cfg.current;
      const dtMs = Math.min(50, now - last); last = now;
      chans.forEach((ch) => {
        ch.latencyMs = c.latency; ch.jitterMs = c.jitter; ch.lossPct = c.loss / 100;
        ch.pump(dtMs);
      });
      if (!c.running) return;

      acc += dtMs;
      let guard = 0;
      while (acc >= 1000 / 120 && guard++ < 6) {
        acc -= 1000 / 120;
        tick++;
        buses.forEach((b, i) => {
          const r = rngs[i]();
          // player 0 is the LAB author: tweaks shader variables
          // player 1 is the FIELD engineer: places machines and mines
          if (r < 0.012) {
            if (i === 0) {
              const cmd = b.submit("setmix/setVariable", [1, 0, 0, 0], [1 + Math.floor(rngs[i]() * 7), 0, 0]);
              if (lines.length < 400) lines.unshift(`P0 lab   t${cmd.tick} setVariable octaves=${cmd.f[0]}`);
            } else {
              const op = rngs[i]() > 0.5 ? "setmix/placeEmitter" : "setmix/mine";
              const cmd = b.submit(op, [2, 0, 0, 0], [0, 0, 0]);
              if (lines.length < 400) lines.unshift(`P1 field t${cmd.tick} ${op.split("/")[1]}`);
            }
          }
          b.tick(Math.max(0, tick - Math.ceil((c.latency + c.jitter) / (1000 / 120)) - INPUT_DELAY));
        });
      }

      setStats(buses.map((b, i) => ({
        p: i, tick: b.stats.tick, conf: b.stats.confirmedTick,
        pred: b.stats.predictedTicks, rb: b.stats.rollbacks,
        depth: b.stats.worstRollbackDepth, sent: b.stats.bytesSent,
        ratio: b.stats.wireRatio, hash: adapter.hash(b.state), state: b.state,
      })));
      setLog(lines.slice(0, 7));
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const sample: NetCommand = {
    tick: 48210, player: 1, op: "setmix/slotCartridge",
    i: [412, 9, 0, 0], f: [0.62, 0, 0], seq: 1183,
  };
  const bin = encodeCommands([sample]);
  const json = jsonBytes([sample]);
  const agree = stats.length === 2 && stats[0].hash === stats[1].hash;

  return (
    <div className="fi-panel border border-line bg-panel">
      <div className="grid lg:grid-cols-[1fr_1fr]">
        <div className="border-b border-line p-3 lg:border-r lg:border-b-0">
          <div className="mono mb-2 text-[9px] tracking-[0.2em] text-dim uppercase">
            Virtual network · 2 peers, same mesh
          </div>
          {([
            ["latency", latency, 0, 400, 5, setLatency, "ms"],
            ["jitter", jitter, 0, 150, 5, setJitter, "ms"],
            ["packet loss", loss, 0, 30, 1, setLoss, "%"],
          ] as const).map(([k, v, mn, mx, st, set, unit]) => (
            <div key={k} className="mb-1.5">
              <div className="mono flex justify-between text-[9.5px]">
                <span className="text-dim">{k}</span>
                <span className="tnum" style={{ color: v > (mx as number) * 0.5 ? "#ff3d8a" : "#e8eef7" }}>
                  {v} {unit}
                </span>
              </div>
              <input type="range" min={mn} max={mx} step={st} value={v}
                onChange={(e) => (set as (n: number) => void)(+e.target.value)} className="w-full" />
            </div>
          ))}
          <button onClick={() => setRunning(!running)}
            className={cn("mono mt-1 w-full border px-2 py-1 text-[9px] font-bold uppercase",
              running ? "border-transparent bg-chalk text-void" : "border-line text-dim")}>
            {running ? "■ pause mesh" : "▶ run mesh"}
          </button>

          <div className="mt-3 grid grid-cols-2 gap-2">
            {stats.map((s) => (
              <div key={s.p} className="border border-line bg-void/50 p-2">
                <div className="mono text-[9px] font-bold" style={{ color: s.p ? "#7cff4d" : "#b46bff" }}>
                  P{s.p} · {s.p ? "FIELD" : "LAB"}
                </div>
                {([
                  ["tick", s.tick], ["confirmed", s.conf], ["predicted", s.pred],
                  ["rollbacks", s.rb], ["worst depth", s.depth],
                  ["sent", `${(s.sent / 1024).toFixed(1)} kB`],
                ] as const).map(([k, v]) => (
                  <div key={k} className="mono flex justify-between text-[8.5px]">
                    <span className="text-dim">{k}</span>
                    <span className="tnum text-chalk">{v}</span>
                  </div>
                ))}
                <div className="mono mt-1 border-t border-line/60 pt-1 text-[8px] text-flux">{s.hash}</div>
              </div>
            ))}
          </div>

          <div className={cn("mono mt-2 border p-2 text-[9.5px] leading-snug",
            agree ? "border-vtx/50 bg-vtx/5 text-vtx" : "border-lx/50 bg-lx/5 text-lx")}>
            {agree
              ? "✓ both peers agree on the state hash at this instant — with 80 ms latency, 35 ms jitter and 3% loss, under divergent local input."
              : "⟳ peers momentarily diverge while prediction catches up. The confirmed line is authoritative; the next rollback reconciles."}
          </div>
        </div>

        <div className="p-3">
          <div className="mono mb-1 text-[9px] tracking-[0.2em] text-dim uppercase">Wire format</div>
          <div className="grid grid-cols-2 gap-2">
            <div className="border border-line bg-void2 p-2">
              <div className="mono text-[8.5px] text-dim">binary</div>
              <div className="mono text-[18px] font-black text-vtx">{bin.byteLength} B</div>
              <div className="mono text-[8px] text-dim">{CMD_BYTES} B/cmd + 4 B header</div>
            </div>
            <div className="border border-line bg-void2 p-2">
              <div className="mono text-[8.5px] text-dim">JSON</div>
              <div className="mono text-[18px] font-black text-pxd">{json} B</div>
              <div className="mono text-[8px] text-dim">{(json / bin.byteLength).toFixed(1)}× larger</div>
            </div>
          </div>
          <pre className="mono mt-2 overflow-x-auto border border-line bg-void2 p-2 text-[9px] leading-snug text-chalk/85">
{`tick  u32  ${sample.tick}
player u8   ${sample.player}
op     u8   ${OPCODES.indexOf(sample.op as never)}  (${sample.op})
seq    u16  ${sample.seq}
i[4]   u16  [${sample.i.join(", ")}]   ← interned strings
f[3]   f32  [${sample.f.join(", ")}]

decode → ${JSON.stringify(decodeCommands(bin)[0].op)}  ✓ round trip`}
          </pre>

          <div className="mono mt-2 grid grid-cols-2 gap-x-3 border-t border-line pt-2 text-[9px]">
            {([
              ["input delay", `${INPUT_DELAY} ticks (${(INPUT_DELAY / 120 * 1000).toFixed(0)} ms)`],
              ["rollback window", `${ROLLBACK_WINDOW} ticks (${(ROLLBACK_WINDOW / 120).toFixed(1)} s)`],
              ["snapshot cadence", "every 8 ticks"],
              ["lab cmd on moon peer", canSkipRollback({ ...sample, op: "setmix/setVariable" }, "MOON") ? "skip rollback ✓" : "rollback"],
            ] as const).map(([k, v]) => (
              <div key={k} className="flex justify-between border-b border-line/40 py-[3px]">
                <span className="text-dim">{k}</span>
                <span className="text-chalk">{v}</span>
              </div>
            ))}
          </div>

          <div className="mono mt-2 h-[88px] overflow-hidden border border-line bg-void2 p-2 text-[8.5px] leading-[1.5]">
            {log.map((l, i) => (
              <div key={i} style={{ opacity: 1 - i * 0.12 }}
                className={l.startsWith("P0") ? "text-flux" : "text-vtx"}>{l}</div>
            ))}
          </div>
        </div>
      </div>

      <div className="divide-y divide-line/60 border-t border-line">
        {NET_NOTES.map(([k, v], i) => (
          <div key={k} className="grid gap-2 p-3 sm:grid-cols-[280px_1fr]">
            <div className="flex gap-2">
              <span className="mono fi-accent-text text-[10px]">{String(i + 1).padStart(2, "0")}</span>
              <span className="text-[12.5px] leading-tight font-bold">{k}</span>
            </div>
            <p className="text-[12px] leading-relaxed text-dim">{v}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
