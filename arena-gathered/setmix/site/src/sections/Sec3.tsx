import { RESOURCES, FIELD_MACHINES, COHERENCE } from "@/data/gdd";
import { Panel, SectionHead, Tag, KV, Formula } from "@/components/ui";
import { CoherenceSim, EconomyLab } from "@/components/widgets";

const LOOP = [
  ["MINE", "Chromatic crystals, topology shards, photon salt", "#ff3d8a"],
  ["HAUL", "3 carry slots · coherence clock ticking", "#8b9bb4"],
  ["BUILD", "Chimneys, vibrators, masts, beacons", "#7cff4d"],
  ["EMIT", "Metrics climb · the sky visibly changes", "#ffc13d"],
  ["AUTHOR", "Lab: synthesise & fuse a preset cartridge", "#b46bff"],
  ["SLOT", "Spire injects YOUR data · bloom wave", "#3dc8ff"],
  ["EXPAND", "New biome opens new ore → loop widens", "#e8eef7"],
];

export default function Sec3() {
  return (
    <section id="s3" className="mx-auto max-w-[1400px] px-4 py-16 sm:px-8">
      <SectionHead
        n="03"
        kicker="On The Moon"
        title="Planetary Loop & Resource Economy"
        lede="The moon is computationally coarse, materially rich and actively hostile to anything with a high polygon count. Everything you need is out there; nothing out there wants you to stay."
      />

      {/* core loop */}
      <div className="fi-panel mb-3 overflow-hidden border border-line bg-panel">
        <div className="mono border-b border-line px-3 py-2 text-[10px] tracking-[0.22em] text-dim uppercase">
          The core loop · median cycle 6–11 minutes
        </div>
        <div className="flex flex-col gap-px overflow-x-auto bg-line/60 sm:flex-row">
          {LOOP.map((l, i) => (
            <div key={l[0]} className="flex-1 bg-panel p-3 sm:min-w-[150px]">
              <div className="mono flex items-center gap-2 text-[9px] text-dim">
                <span style={{ color: l[2] }}>{String(i + 1).padStart(2, "0")}</span>
                <span className="h-px flex-1" style={{ background: l[2] + "55" }} />
              </div>
              <div className="mt-1 text-[15px] font-black" style={{ color: l[2] }}>
                {l[0]}
              </div>
              <p className="mt-1 text-[11px] leading-snug text-dim">{l[1]}</p>
            </div>
          ))}
        </div>
      </div>

      {/* resources */}
      <div className="grid gap-3 lg:grid-cols-[1.3fr_1fr]">
        <Panel label="EXTRACTABLES · what the moon is made of" flush>
          <div className="divide-y divide-line/60">
            {RESOURCES.map((r) => (
              <div key={r.name} className="grid gap-1 p-3 sm:grid-cols-[150px_1fr]">
                <div>
                  <div className="text-[13px] leading-tight font-bold" style={{ color: r.color }}>
                    {r.name}
                  </div>
                  <div className="mono mt-1 flex gap-1">
                    <Tag color={r.color}>{r.feeds}</Tag>
                    <Tag>{r.tier}</Tag>
                  </div>
                </div>
                <div>
                  <div className="mono text-[10px] tracking-[0.1em] text-dim uppercase">
                    {r.where}
                  </div>
                  <p className="mt-1 text-[12px] leading-snug text-chalk/80">{r.note}</p>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <div className="space-y-3">
          <Panel label="SURVIVAL TENSION · COHERENCE" accent="#ff3d8a">
            <p className="text-[13px] leading-relaxed text-chalk/90">{COHERENCE.pitch}</p>
            <div className="mt-3 space-y-0">
              {COHERENCE.terms.map(([k, v]) => (
                <KV key={k} k={k} v={v} />
              ))}
            </div>
          </Panel>
          <Panel label="DEGRADATION LADDER" accent="#ff3d8a" flush>
            <div className="divide-y divide-line/60">
              {COHERENCE.ladder.map((l) => (
                <div key={l.at} className="p-3">
                  <div className="mono flex items-center justify-between text-[10px]">
                    <span className="font-bold text-chalk">{l.label}</span>
                    <span className="tnum text-dim">{l.at}</span>
                  </div>
                  <p className="mt-1 text-[11.5px] leading-snug text-dim">{l.fx}</p>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_1fr]">
        <CoherenceSim />
        <Panel label="WHY NOT AN OXYGEN BAR" accent="#ff3d8a">
          <p className="text-[13px] leading-relaxed text-dim">{COHERENCE.why}</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {[
              ["Noise Storm", "Rolling static front. De-resolves terrain in its path, doubles coherence drain, drops rare chromatic fallout. Forecast 6 minutes ahead on your wrist."],
              ["Null Pit", "An unrendered hole in the SDF. Deletes anything that falls in. Only tell: the starfield is missing where ground should be."],
              ["Aliasing Wasps", "Swarm the highest-frequency surface in range — which is always your newest, proudest build."],
              ["Z-Fight Rift", "A seam where two LODs disagree. Flickers, damages coherence, and is also the richest topology-shard vein on the moon."],
            ].map(([k, v]) => (
              <div key={k} className="border-l-2 border-pxd/50 pl-2">
                <div className="mono text-[10px] font-bold text-pxd">{k}</div>
                <p className="mt-0.5 text-[11px] leading-snug text-dim">{v}</p>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* infrastructure */}
      <div className="mt-10 grid gap-3 lg:grid-cols-[1.4fr_1fr]">
        <Panel label="SPIRE INFRASTRUCTURE · field machines" flush>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left">
              <thead>
                <tr className="mono border-b border-line text-[9px] tracking-[0.18em] text-dim uppercase">
                  <th className="p-2 font-medium">Machine</th>
                  <th className="p-2 font-medium">Output</th>
                  <th className="p-2 font-medium">Clock</th>
                  <th className="p-2 font-medium">Build cost</th>
                </tr>
              </thead>
              <tbody>
                {FIELD_MACHINES.map((f) => (
                  <tr key={f.name} className="border-b border-line/50 align-top hover:bg-panel2/70">
                    <td className="p-2">
                      <div className="text-[12.5px] font-bold" style={{ color: f.color }}>
                        {f.name}
                      </div>
                      <p className="mt-0.5 max-w-[320px] text-[11px] leading-snug text-dim">
                        {f.desc}
                      </p>
                    </td>
                    <td className="mono p-2 text-[11px] whitespace-nowrap" style={{ color: f.color }}>
                      {f.out}
                    </td>
                    <td className="mono p-2 text-[11px] text-dim">{f.clock}</td>
                    <td className="mono p-2 text-[11px] text-dim">{f.cost}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <div className="space-y-3">
          <Panel label="THE GRID · two commodities, one wire" accent="#ffc13d">
            <div className="space-y-3 text-[12.5px] leading-relaxed text-dim">
              <p>
                <strong className="text-lx">CLOCK (cyc)</strong> is local compute: produced by
                reactors and solar collectors, consumed by every machine. Starve it and machines
                do not stop — they <em className="not-italic text-chalk">throttle</em>, visibly
                dropping their own render quality first. Your base tells you it is underpowered by
                becoming ugly.
              </p>
              <p>
                <strong className="text-aq">BANDWIDTH (ch)</strong> is the portal link: how much
                authored data can stream from the lab to the field. Generic terraforming needs
                none; a slotted cartridge consumes one channel permanently. Bandwidth is the real
                limit on creative expression, and upgrading it is the most emotionally satisfying
                purchase in the game.
              </p>
              <p>
                Relay Pylons carry both on one line. Lines are laid by hand in Act II, by drone in
                Act III, and designed as a topology puzzle in Act IV when flooding starts
                severing them.
              </p>
            </div>
          </Panel>
          <Panel label="CARTRIDGE INSERTION IN THE FIELD" accent="#b46bff">
            <ol className="space-y-2 text-[12.5px] leading-relaxed text-dim">
              {[
                "Walk to the spire. Three physical slots glow at chest height.",
                "Insert: a 1.1 s animation, a clunk, and the spire's plume changes colour to your preset's dominant hue — confirmation before any world change.",
                "The spire spends 20 s spooling (bandwidth negotiation), then the bloom wave departs at 2–14 m/s.",
                "Pull the cartridge at any time: the wave recedes at 2× speed and the cached prior state is restored for 10 real minutes.",
                "Three slots = three simultaneous presets, blended by the Dominance weighting you set in the lab.",
              ].map((s, i) => (
                <li key={i} className="flex gap-2">
                  <span className="mono text-flux">{String(i + 1).padStart(2, "0")}</span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
          </Panel>
        </div>
      </div>

      <div className="mt-3">
        <EconomyLab />
      </div>

      <div className="mt-3">
        <Panel label="COHERENCE MATHS" accent="#ff3d8a">
          <Formula>{COHERENCE.formula}</Formula>
        </Panel>
      </div>
    </section>
  );
}
