import { useState } from "react";
import { STUDIO, PLAY_ARC } from "@/data/gdd";
import { Panel, SectionHead, Tag, KV } from "@/components/ui";
import { cn } from "@/utils/cn";

type Node = {
  name: string;
  type: string;
  tris?: string;
  ms?: string;
  lod?: string;
  color?: string;
  children?: Node[];
};

const TREE: Node[] = [
  {
    name: "Moon_Kepler-7b",
    type: "WORLD",
    tris: "1.80M",
    ms: "14.2",
    lod: "—",
    color: "#e8eef7",
    children: [
      {
        name: "Terraform Field",
        type: "SIM",
        tris: "—",
        ms: "0.31",
        color: "#b46bff",
        children: [
          { name: "Pxd Scalar  [62.4M]", type: "SCALAR", ms: "0.00", color: "#ff3d8a" },
          { name: "Vtx Scalar  [41.0M]", type: "SCALAR", ms: "0.00", color: "#7cff4d" },
          { name: "Lx Scalar   [28.7M]", type: "SCALAR", ms: "0.00", color: "#ffc13d" },
          { name: "Aq Scalar   [9.14M]", type: "SCALAR", ms: "0.00", color: "#3dc8ff" },
        ],
      },
      {
        name: "Region · North Basin",
        type: "REGION",
        tris: "640K",
        ms: "4.80",
        lod: "L0",
        children: [
          {
            name: "Biome · Wind Prairie",
            type: "BIOME",
            tris: "410K",
            ms: "2.10",
            lod: "L0",
            color: "#86c954",
            children: [
              { name: "grass_handpainted.v4", type: "MAT", ms: "0.42", color: "#86c954" },
              { name: "curl_flowfield.v1", type: "VERB", ms: "0.08", color: "#7cff4d" },
              { name: "scatter_bluenoise", type: "SCATTER", tris: "398K", ms: "1.60" },
            ],
          },
          {
            name: "Spire_04 (Template Injector)",
            type: "MACHINE",
            tris: "18K",
            ms: "0.22",
            lod: "L0",
            color: "#b46bff",
            children: [
              { name: "slot A · wind_prairie.setmix", type: "CART", color: "#86c954" },
              { name: "slot B · patina_aging.setmix", type: "CART", color: "#a35c35" },
              { name: "slot C · [empty]", type: "CART", color: "#6b7a90" },
            ],
          },
          { name: "Lake_Mirror (Aq volume)", type: "FLUID", tris: "2K", ms: "1.90", color: "#3dc8ff" },
        ],
      },
      {
        name: "Region · Organ Canyon",
        type: "REGION",
        tris: "720K",
        ms: "5.40",
        lod: "L1",
        children: [
          { name: "basalt_organ.v3", type: "LANDMARK", tris: "694K", ms: "3.80", color: "#7d7fa8" },
          { name: "resonance_rig", type: "AUDIO", ms: "0.14", color: "#ffc13d" },
        ],
      },
      {
        name: "Player · Goblin_Astronaut",
        type: "RIG",
        tris: "48K",
        ms: "0.90",
        lod: "L0",
        color: "#ff6fb2",
        children: [
          { name: "suit_T3_worn.mat", type: "MAT", ms: "0.30", color: "#ff6fb2" },
          { name: "ik_biped.rig", type: "RIG", ms: "0.11" },
          { name: "deck · 3 cartridges", type: "INV" },
        ],
      },
    ],
  },
];

function Row({
  n,
  depth,
  sel,
  setSel,
}: {
  n: Node;
  depth: number;
  sel: string;
  setSel: (s: string) => void;
}) {
  const [open, setOpen] = useState(depth < 2);
  const has = !!n.children?.length;
  const active = sel === n.name;
  return (
    <>
      <div
        onClick={() => setSel(n.name)}
        className={cn(
          "mono grid cursor-pointer grid-cols-[1fr_52px_46px_40px] items-center gap-1 border-b border-line/40 px-2 py-[3px] text-[10.5px] transition-colors",
          active ? "bg-chalk/10" : "hover:bg-panel2",
        )}
      >
        <div className="flex items-center gap-1 truncate" style={{ paddingLeft: depth * 12 }}>
          {has ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setOpen(!open);
              }}
              className="w-3 shrink-0 text-dim hover:text-chalk"
            >
              {open ? "▾" : "▸"}
            </button>
          ) : (
            <span className="w-3 shrink-0" />
          )}
          <span
            className="h-[7px] w-[7px] shrink-0"
            style={{ background: n.color ?? "#2a3242" }}
          />
          <span className="truncate" style={{ color: active ? "#fff" : undefined }}>
            {n.name}
          </span>
          <span className="shrink-0 text-[8.5px] tracking-wider text-dim/70">{n.type}</span>
        </div>
        <span className="tnum text-right text-dim">{n.tris ?? "·"}</span>
        <span className="tnum text-right text-dim">{n.ms ?? "·"}</span>
        <span className="text-right text-dim/70">{n.lod ?? "·"}</span>
      </div>
      {open && n.children?.map((c) => <Row key={c.name} n={c} depth={depth + 1} sel={sel} setSel={setSel} />)}
    </>
  );
}

export default function Sec4() {
  const [sel, setSel] = useState("Biome · Wind Prairie");
  const [mode, setMode] = useState<"studio" | "play">("studio");

  return (
    <section id="s4" className="mx-auto max-w-[1400px] px-4 py-16 sm:px-8">
      <SectionHead
        n="04"
        kicker="Architecture"
        title="Studio Mode vs. Play Mode"
        lede="One codebase, one simulation, two contracts with the player. Studio says: here are the keys, make something beautiful. Play says: earn the keys, and the making will mean more."
      />

      <div className="mb-3 flex gap-2">
        {(["studio", "play"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setMode(k)}
            className={cn(
              "mono flex-1 border px-4 py-3 text-left transition-all",
              mode === k
                ? "fi-accent-border bg-panel2"
                : "border-line bg-panel/50 text-dim hover:border-chalk/30",
            )}
          >
            <div className="text-[10px] tracking-[0.25em] uppercase opacity-70">
              {k === "studio" ? "Main menu · door 2" : "Main menu · door 1"}
            </div>
            <div className="mt-0.5 text-lg font-black">
              {k === "studio" ? "STUDIO MODE" : "PLAY MODE"}
            </div>
            <div className="mt-0.5 text-[11px] opacity-80">
              {k === "studio"
                ? "Unlocked artist suite · infinite power · export"
                : "Campaign progression · power-starved lab"}
            </div>
          </button>
        ))}
      </div>

      {mode === "studio" ? (
        <div className="space-y-3">
          <Panel label="ENTRY" accent="var(--fi-accent)">
            <p className="text-[13.5px] leading-relaxed text-chalk/90">{STUDIO.entry}</p>
          </Panel>

          <div className="grid gap-3 lg:grid-cols-[1.15fr_1fr]">
            {/* outliner */}
            <Panel
              label="THE OUTLINER · live scene graph"
              accent="#7cff4d"
              flush
              right={
                <span className="mono text-[9px] text-dim">
                  bidirectional selection · viewport ⇄ list
                </span>
              }
            >
              <div className="mono grid grid-cols-[1fr_52px_46px_40px] gap-1 border-b border-line bg-void2 px-2 py-1 text-[8.5px] tracking-[0.15em] text-dim uppercase">
                <span>Name / type</span>
                <span className="text-right">Tris</span>
                <span className="text-right">ms</span>
                <span className="text-right">LOD</span>
              </div>
              <div className="max-h-[420px] overflow-y-auto">
                {TREE.map((n) => (
                  <Row key={n.name} n={n} depth={0} sel={sel} setSel={setSel} />
                ))}
              </div>
              <div className="mono flex flex-wrap items-center gap-2 border-t border-line bg-void2 px-2 py-1.5 text-[9px] text-dim">
                <span className="text-chalk">SELECTED:</span>
                <span className="fi-accent-text">{sel}</span>
                <span className="ml-auto flex gap-1">
                  <Tag color="#7cff4d">ISOLATE</Tag>
                  <Tag color="#ffc13d">PROMOTE TO PRESET</Tag>
                  <Tag color="#3dc8ff">EXPORT .SETMIX</Tag>
                </span>
              </div>
            </Panel>

            <div className="space-y-3">
              <Panel label="OUTLINER DESIGN NOTES" accent="#7cff4d">
                <ul className="space-y-2">
                  {STUDIO.outliner.map((o, i) => (
                    <li key={i} className="flex gap-2 text-[12.5px] leading-relaxed text-dim">
                      <span className="mono mt-[6px] h-[6px] w-[6px] shrink-0 bg-vtx" />
                      <span>{o}</span>
                    </li>
                  ))}
                </ul>
              </Panel>
              <Panel label="AUTHORING LOOP" accent="#b46bff">
                <div className="space-y-2">
                  {STUDIO.loop.map(([n, k, d]) => (
                    <div key={n} className="flex gap-3">
                      <span className="mono text-[11px] font-bold text-flux">{n}</span>
                      <div>
                        <div className="mono text-[11px] font-bold tracking-[0.15em] text-chalk">
                          {k}
                        </div>
                        <p className="text-[11.5px] leading-snug text-dim">{d}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Panel>
            </div>
          </div>

          <Panel label="THE .SETMIX BUNDLE · universal interchange format" accent="#3dc8ff">
            <div className="grid gap-3 lg:grid-cols-[1.1fr_1fr]">
              <pre className="mono overflow-x-auto border border-line bg-void2 p-3 text-[11px] leading-relaxed text-chalk/85">
                {STUDIO.bundle}
              </pre>
              <div className="space-y-3 text-[12.5px] leading-relaxed text-dim">
                <p>
                  <strong className="text-chalk">Deterministic, not baked.</strong> A bundle ships
                  the recipe graph, not gigabytes of geometry. The same 90 kB file renders as 14
                  flat-shaded polygons on a Stage-2 moon and as a 700k-triangle raytraced landmark
                  on a Stage-6 one. This is the single most important technical decision in the
                  project.
                </p>
                <p>
                  <strong className="text-chalk">Parameters are the API.</strong> Up to 8 exposed
                  knobs with poetic names, real names, ranges and defaults. Importers tune without
                  ever opening the graph — and can fork it if they want to.
                </p>
                <p>
                  <strong className="text-chalk">The cost certificate travels with the asset.</strong>{" "}
                  Tris, texel policy, ms at 1080p and a minimum stage. The Galaxy browser sorts by
                  cost, so cheap beautiful assets win — exactly the incentive real production
                  wishes it had.
                </p>
                <div className="grid grid-cols-2 gap-x-4">
                  <KV k="Typical size" v="40–900 kB" color="#3dc8ff" />
                  <KV k="Import time" v="< 400 ms" color="#3dc8ff" />
                  <KV k="Licence" v="baked attribution chain" />
                  <KV k="Verification" v="seed-stable hash" />
                </div>
              </div>
            </div>
          </Panel>
        </div>
      ) : (
        <div className="space-y-3">
          <Panel label="THE PROGRESSION ARC · restoring the lab" accent="var(--fi-accent)" flush>
            <div className="divide-y divide-line/60">
              {PLAY_ARC.map((a, i) => (
                <div key={a.phase} className="grid gap-2 p-4 lg:grid-cols-[180px_1fr_1fr]">
                  <div>
                    <div className="mono text-[9px] tracking-[0.2em] text-dim uppercase">
                      {a.time} · Fi {a.fi}
                    </div>
                    <div className="mt-1 text-[15px] leading-tight font-black">
                      <span className="fi-accent-text">{String(i + 1).padStart(2, "0")}</span>{" "}
                      {a.phase}
                    </div>
                  </div>
                  <div>
                    <div className="mono text-[9px] tracking-[0.2em] text-dim uppercase">
                      Lab state
                    </div>
                    <p className="mt-1 text-[12.5px] leading-snug text-chalk/85">{a.lab}</p>
                  </div>
                  <div>
                    <div className="mono text-[9px] tracking-[0.2em] text-dim uppercase">
                      Player goal
                    </div>
                    <p className="mt-1 text-[12.5px] leading-snug text-dim">{a.goal}</p>
                    <div className="mono mt-1.5 text-[10.5px] text-vtx">+ {a.unlock}</div>
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <div className="grid gap-3 lg:grid-cols-3">
            <Panel label="HOW THE LAB IS RESTORED" accent="#ffc13d">
              <p className="text-[12.5px] leading-relaxed text-dim">
                Power returns as <strong className="text-chalk">Bandwidth</strong>, not as a
                switch. Every 10,000 Fi delivered through the portal permanently restores one
                circuit: lights, then the Loom, then the Matrix, then the Fabricator, then the
                Table. The lab brightens as the moon does — the two environments are a single
                progress bar rendered twice, and the player feels the symmetry long before they
                articulate it.
              </p>
            </Panel>
            <Panel label="UNLOCKING RECIPE TIERS" accent="#b46bff">
              <p className="text-[12.5px] leading-relaxed text-dim">
                Tiers are gated by three keys at once:{" "}
                <strong className="text-chalk">Fi threshold</strong> (the world must be able to
                render it), <strong className="text-chalk">Logic Substrate</strong> (you must have
                explored), and <strong className="text-chalk">Discovery count</strong> (you must
                have played with the toys you already own). The third gate is the important one —
                it rewards curiosity rather than grinding, and it is why T3 feels earned.
              </p>
            </Panel>
            <Panel label="VICTORY STATE · THE VOXEL GALAXY" accent="#3dc8ff">
              <p className="text-[12.5px] leading-relaxed text-dim">
                At 100M Fi the portal's bandwidth exceeds one world. The arch widens into a{" "}
                <strong className="text-chalk">bridge array</strong>: your moon becomes a public
                destination, and other players' doorways appear along your lab wall. Victory is
                not a cutscene — it is your planet becoming somebody else's Stage 1 inspiration.
                Prestige ("Seed a new moon, carry three cartridges") is offered, never required.
              </p>
            </Panel>
          </div>
        </div>
      )}
    </section>
  );
}
