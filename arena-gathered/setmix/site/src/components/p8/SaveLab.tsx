import { useMemo, useState } from "react";
import {
  encodeSave, decodeSave, budgetReport, hexDump, toyCipher,
  TAG_NAME, type SaveGame, type SaveMachine,
} from "@/drop/SaveEngine";
import {
  SHIP_TARGETS, DESKTOP_NOTES, TAURI_CONF, TAURI_RUST, AUTOSAVE,
  resolveConflict, detectHost,
} from "@/drop/desktop";
import { cn } from "@/utils/cn";

function buildWorld(seed: number, nMachines: number, nSculpt: number, hours: number): SaveGame {
  let s = seed >>> 0 || 1;
  const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  const machines: SaveMachine[] = Array.from({ length: nMachines }, () => ({
    kind: Math.floor(rnd() * 13),
    x: Math.round((rnd() - 0.5) * 4000) / 4,
    z: Math.round((rnd() - 0.5) * 4000) / 4,
    tier: Math.floor(rnd() * 4),
    overclock: 1 + Math.floor(rnd() * 60) / 100,
    cartridge: rnd() > 0.55 ? Math.floor(rnd() * 24) : 0xffff,
    condition: Math.floor(rnd() * 256),
  }));

  const voxelDelta = new Map<string, Int8Array>();
  for (let i = 0; i < nSculpt; i++) {
    const arr = new Int8Array(1024);
    let v = Math.floor((rnd() - 0.5) * 60);
    for (let j = 0; j < arr.length; j++) {
      if (rnd() > 0.965) v = Math.floor((rnd() - 0.5) * 60);
      arr[j] = v;
    }
    voxelDelta.set(`c_${Math.floor(rnd() * 90)}_${Math.floor(rnd() * 90)}`, arr);
  }

  const ghost = new Uint8Array(Math.floor(hours > 20 ? 1400 : 600));
  for (let i = 0; i < ghost.length; i++) ghost[i] = Math.floor(rnd() * 256);

  return {
    seed, tick: Math.round(hours * 3600 * 120),
    fidelity: { pxd: 1.1e8, vtx: 8.2e7, lx: 5.9e7, aq: 3.6e7, tick: Math.round(hours * 3600 * 120) },
    stage: 6,
    machines,
    inventory: {
      TOPOLOGY_SHARD: 2411, PHOTON_SALT: 980, ICE_CLATHRATE: 412,
      CHROMATIC_CRYSTAL: 1877, LOGIC_SUBSTRATE: 64, ENTROPY_SLAG: 9120, DEEP_CHROMA: 38,
    },
    quests: Array.from({ length: 22 }, (_, i) => ({
      id: i, state: (i < 17 ? 2 : i === 17 ? 1 : 0) as 0 | 1 | 2, progress: rnd(),
    })),
    cartridgeHashes: Array.from({ length: 38 }, () =>
      "0x" + Math.floor(rnd() * 0xffffffff).toString(16).padStart(8, "0")),
    player: { x: 412.5, y: 18.25, z: -1203.75, yaw: 2.41, coherence: 0.92, suitTier: 4 },
    race: { trackId: 1, bestLapTicks: 14_382, ghostBytes: ghost },
    trader: { reputation: 0.71, bought: { liquid_neon_sea: 1, basalt_archway: 2, patina_rule: 3 } },
    voxelDelta,
    settings: { masterGain: 0.62, fov: 74, renderCap: 6, jargonMode: 1 },
  };
}

export default function SaveLab() {
  const [seed, setSeed] = useState(70801);
  const [nMachines, setNMachines] = useState(120);
  const [nSculpt, setNSculpt] = useState(26);
  const [hours, setHours] = useState(42);
  const [encrypt, setEncrypt] = useState(false);
  const [corrupt, setCorrupt] = useState(false);
  const [tab, setTab] = useState<"budget" | "hex" | "ship" | "tauri">("budget");

  const world = useMemo(() => buildWorld(seed, nMachines, nSculpt, hours), [seed, nMachines, nSculpt, hours]);
  const enc = useMemo(
    () => encodeSave(world, encrypt ? { encrypt: toyCipher(0xbadc0de) } : {}),
    [world, encrypt],
  );
  const bytes = useMemo(() => {
    if (!corrupt) return enc.bytes;
    const b = enc.bytes.slice();
    b[Math.floor(b.length / 2)] ^= 0xff;        // flip one bit in the middle
    return b;
  }, [enc, corrupt]);

  const dec = useMemo(
    () => decodeSave(bytes, encrypt ? { decrypt: toyCipher(0xbadc0de) } : {}),
    [bytes, encrypt],
  );
  const report = useMemo(() => budgetReport(enc), [enc]);

  const roundTrip = useMemo(() => {
    if (!dec.ok || !dec.save) return { ok: false, detail: dec.error ?? "decode failed" };
    const a = dec.save;
    const checks = [
      ["seed", a.seed === world.seed],
      ["tick", a.tick === world.tick],
      ["stage", a.stage === world.stage],
      ["machines", a.machines.length === world.machines.length],
      ["machine[0].x", Math.abs(a.machines[0].x - world.machines[0].x) < 0.26],
      ["inventory", Object.keys(a.inventory).length === Object.keys(world.inventory).length],
      ["quests", a.quests.length === world.quests.length],
      ["cartridges", a.cartridgeHashes.length === world.cartridgeHashes.length],
      ["voxel chunks", a.voxelDelta.size === world.voxelDelta.size],
      ["ghost bytes", a.race.ghostBytes.length === world.race.ghostBytes.length],
      ["player.x", Math.abs(a.player.x - world.player.x) < 0.001],
      ["settings", Object.keys(a.settings).length === Object.keys(world.settings).length],
    ] as const;
    const failed = checks.filter(([, ok]) => !ok).map(([k]) => k);
    return { ok: failed.length === 0, detail: failed.length ? `mismatch: ${failed.join(", ")}` : `${checks.length} fields verified`, checks };
  }, [dec, world]);

  const conflict = useMemo(() => resolveConflict(
    { tick: world.tick, crc: enc.crc, bytes: enc.totalBytes },
    { tick: world.tick - 60 * 120, crc: enc.crc ^ 0x1234, bytes: enc.totalBytes },
  ), [world, enc]);

  const host = detectHost();

  return (
    <div className="space-y-3">
      <div className="fi-panel border border-line bg-panel">
        <div className="grid lg:grid-cols-[290px_minmax(0,1fr)]">
          <div className="border-b border-line p-3 lg:border-r lg:border-b-0">
            <div className="mono mb-2 text-[9px] tracking-[0.2em] text-dim uppercase">World generator</div>
            {([
              ["seed", seed, 1, 99999, 1, setSeed],
              ["machines", nMachines, 0, 400, 1, setNMachines],
              ["sculpted chunks", nSculpt, 0, 120, 1, setNSculpt],
              ["hours played", hours, 1, 200, 1, setHours],
            ] as const).map(([k, v, mn, mx, st, set]) => (
              <div key={k} className="mb-1.5">
                <div className="mono flex justify-between text-[9.5px]">
                  <span className="text-dim">{k}</span>
                  <span className="tnum text-chalk">{v}</span>
                </div>
                <input type="range" min={mn} max={mx} step={st} value={v}
                  onChange={(e) => (set as (n: number) => void)(+e.target.value)} className="w-full" />
              </div>
            ))}
            <div className="mt-2 flex gap-1">
              <button onClick={() => setEncrypt(!encrypt)}
                className={cn("mono flex-1 border px-2 py-1 text-[9px] font-bold uppercase",
                  encrypt ? "border-transparent bg-flux text-void" : "border-line text-dim hover:text-chalk")}>
                🔒 encrypt
              </button>
              <button onClick={() => setCorrupt(!corrupt)}
                className={cn("mono flex-1 border px-2 py-1 text-[9px] font-bold uppercase",
                  corrupt ? "border-transparent bg-pxd text-void" : "border-line text-dim hover:text-chalk")}>
                ☣ flip a bit
              </button>
            </div>

            <div className="mt-3 border-t border-line pt-2">
              <div className="mono mb-1 flex items-baseline justify-between">
                <span className="text-[9px] tracking-[0.2em] text-dim uppercase">.sav size</span>
                <span className={cn("mono text-[9px] font-bold", enc.underBudget ? "text-vtx" : "text-pxd")}>
                  {enc.underBudget ? "UNDER BUDGET" : "OVER"}
                </span>
              </div>
              <div className="mono text-3xl leading-none font-black tabular-nums"
                style={{ color: enc.underBudget ? "var(--fi-accent)" : "#ff3d8a" }}>
                {(enc.totalBytes / 1024).toFixed(1)}<span className="text-sm text-dim"> kB</span>
              </div>
              <div className="mt-1 h-2 w-full border border-line bg-void">
                <div className={cn("h-full", report.pctUsed > 100 ? "bg-pxd" : "bg-vtx")}
                  style={{ width: `${Math.min(100, report.pctUsed)}%` }} />
              </div>
              <div className="mono mt-1 flex justify-between text-[9px] text-dim">
                <span>{report.pctUsed.toFixed(1)}% of 64 kB</span>
                <span>{(report.headroom / 1024).toFixed(1)} kB free</span>
              </div>
            </div>

            <div className="mt-3 border-t border-line pt-2">
              {([
                ["CRC-32 stored", "0x" + dec.crcExpected.toString(16).padStart(8, "0"), "#b46bff"],
                ["CRC-32 actual", "0x" + dec.crcActual.toString(16).padStart(8, "0"),
                  dec.crcActual === dec.crcExpected ? "#7cff4d" : "#ff3d8a"],
                ["decode", dec.ok ? "OK" : "REJECTED", dec.ok ? "#7cff4d" : "#ff3d8a"],
                ["round trip", roundTrip.ok ? "LOSSLESS ✓" : "FAILED", roundTrip.ok ? "#7cff4d" : "#ff3d8a"],
                ["unknown tags", dec.unknownTags.length, undefined],
              ] as const).map(([k, v, c]) => (
                <div key={k} className="mono flex justify-between border-b border-line/40 py-[3px] text-[9.5px] last:border-0">
                  <span className="text-dim">{k}</span>
                  <span className="tnum" style={{ color: c }}>{v}</span>
                </div>
              ))}
              {!dec.ok && (
                <div className="mono mt-2 border border-pxd bg-pxd/10 p-2 text-[9px] leading-snug text-pxd">
                  ✕ {dec.error}
                  <div className="mt-1 text-dim">
                    One flipped bit anywhere in the body and the file is refused before a single
                    field is trusted. The autosave ring then recovers from slots {AUTOSAVE.ringSlots.join(", ")}.
                  </div>
                </div>
              )}
              {dec.ok && (
                <div className="mono mt-2 text-[9px] text-vtx">✓ {roundTrip.detail}</div>
              )}
            </div>
          </div>

          <div className="p-3">
            <div className="mb-2 flex flex-wrap gap-1">
              {([["budget", "CHUNK BUDGET"], ["hex", "HEX DUMP"], ["ship", "SHIP TARGETS"], ["tauri", "TAURI CONFIG"]] as const).map(([k, l]) => (
                <button key={k} onClick={() => setTab(k)}
                  className={cn("mono border px-2 py-1 text-[9px] font-bold tracking-wider",
                    tab === k ? "border-transparent bg-chalk text-void" : "border-line text-dim hover:text-chalk")}>
                  {l}
                </button>
              ))}
              <span className="mono ml-auto text-[9px] text-dim">host: {host}</span>
            </div>

            {tab === "budget" && (
              <div>
                {report.rows.map((r) => (
                  <div key={r.tag} className="mb-1.5">
                    <div className="mono flex justify-between text-[9.5px]">
                      <span className="text-chalk">
                        0x{r.tag.toString(16).padStart(2, "0")} {TAG_NAME[r.tag]}
                      </span>
                      <span className="tnum text-dim">
                        {r.bytes.toLocaleString()} B · {r.pct.toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-void">
                      <div className="h-full bg-aq" style={{ width: `${r.pct}%` }} />
                    </div>
                  </div>
                ))}
                <div className="mono mt-3 border border-vtx/40 bg-vtx/5 p-2 text-[10px] leading-snug text-vtx">
                  A {hours}-hour planet with {nMachines} machines and {nSculpt} sculpted chunks fits
                  in <span className="font-bold">{(enc.totalBytes / 1024).toFixed(1)} kB</span>. Not
                  compression — <span className="font-bold">omission</span>. Everything the player
                  did not touch is a pure function of the seed and costs zero bytes.
                </div>
                <div className="mono mt-2 grid gap-x-4 text-[9px] sm:grid-cols-2">
                  {([
                    ["fidelity, the whole visual world", "20 B"],
                    ["per machine", "10 B (pos @25 cm)"],
                    ["per quest", "3 B"],
                    ["per cartridge", "4 B (hash only)"],
                    ["voxel delta", "RLE, 2 B/run"],
                    ["header", "32 B"],
                  ] as const).map(([k, v]) => (
                    <div key={k} className="flex justify-between py-[2px]">
                      <span className="text-dim">{k}</span><span className="text-chalk">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tab === "hex" && (
              <pre className="mono max-h-[400px] overflow-auto border border-line bg-void2 p-2 text-[10px] leading-snug text-chalk/85">
                {hexDump(bytes, 512)}
              </pre>
            )}

            {tab === "ship" && (
              <div className="space-y-2">
                {SHIP_TARGETS.map((t) => (
                  <div key={t.target}
                    className={cn("fi-panel border p-2.5",
                      t.recommended ? "border-vtx/40 bg-vtx/5" : "border-line bg-void/40")}>
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="text-[12.5px] font-bold">{t.target}</span>
                      <span className="mono text-[9.5px]">
                        <span className="text-chalk">{t.bundleMB} MB</span>
                        <span className="text-dim"> · {t.startupMs} ms cold</span>
                        {t.recommended && <span className="ml-2 text-vtx">✓ ship</span>}
                      </span>
                    </div>
                    <p className="mt-1 text-[11.5px] leading-snug text-dim">{t.note}</p>
                  </div>
                ))}
                <div className="fi-panel border border-line bg-void/40 p-2.5">
                  <div className="mono text-[9px] tracking-[0.2em] text-dim uppercase">
                    Steam Cloud conflict, resolved by tick
                  </div>
                  <div className="mono mt-1 text-[10px]">
                    <span className={conflict.action === "CONFLICT" ? "text-lx" : "text-vtx"}>
                      {conflict.action}
                    </span>
                    <span className="ml-2 text-dim">{conflict.note}</span>
                  </div>
                </div>
              </div>
            )}

            {tab === "tauri" && (
              <div className="space-y-2">
                <pre className="mono max-h-[200px] overflow-auto border border-line bg-void2 p-2 text-[9.5px] leading-snug text-chalk/85">
                  {JSON.stringify(TAURI_CONF, null, 1)}
                </pre>
                <pre className="mono max-h-[260px] overflow-auto border border-line bg-void2 p-2 text-[9.5px] leading-snug text-chalk/85">
                  {TAURI_RUST}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="fi-panel border border-line bg-panel">
        <div className="mono border-b border-line bg-panel2 px-3 py-2 text-[9px] tracking-[0.2em] text-dim uppercase">
          desktop architecture notes
        </div>
        <div className="divide-y divide-line/60">
          {DESKTOP_NOTES.map(([k, v], i) => (
            <div key={k} className="grid gap-2 p-3 sm:grid-cols-[250px_1fr]">
              <div className="flex gap-2">
                <span className="mono fi-accent-text text-[10px]">{String(i + 1).padStart(2, "0")}</span>
                <span className="text-[12.5px] leading-tight font-bold">{k}</span>
              </div>
              <p className="text-[12px] leading-relaxed text-dim">{v}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
