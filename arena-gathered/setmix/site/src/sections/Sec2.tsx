import { useState } from "react";
import { LAB_MACHINES, RECIPES } from "@/data/gdd";
import { Panel, SectionHead, Tag } from "@/components/ui";
import { FusionMatrix } from "@/components/widgets";
import { cn } from "@/utils/cn";
import lab from "@/assets/lab.jpg";

export default function Sec2() {
  const [sel, setSel] = useState(0);
  const M = LAB_MACHINES[sel];

  return (
    <section id="s2" className="relative mx-auto max-w-[1400px] px-4 py-16 sm:px-8">
      <SectionHead
        n="02"
        kicker="The White Room"
        title="Lab Tech & Preset Alchemy"
        lede="The lab is the only place in the multiverse that is already finished. It is quiet, white, and absurdly high-fidelity — a permanent reminder of what the moon could become. Five workstations turn raw planetary ore into authored intent, and authored intent into physical cartridges you can carry through the arch."
      />

      {/* banner */}
      <div className="fi-panel relative mb-3 h-[200px] overflow-hidden border border-line sm:h-[340px]">
        <img src={lab} alt="The white room laboratory" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-void via-void/25 to-void/40" />
        <div className="absolute inset-0 bg-scan opacity-30" />
        <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-2 p-4">
          <div>
            <div className="mono text-[9px] tracking-[0.3em] text-dim uppercase">
              Facility · Sector 7 · Render Sciences
            </div>
            <div className="text-xl font-black sm:text-3xl">THE HIGH-FIDELITY STUDIO</div>
          </div>
          <div className="mono max-w-sm text-[10.5px] leading-snug text-dim">
            Soft-shadowed, area-lit, 4k-texel PBR. Walk two metres through the arch and your own
            hands drop to 48 triangles. The contrast is the entire pitch.
          </div>
        </div>
      </div>

      {/* machine selector */}
      <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {LAB_MACHINES.map((mm, i) => (
          <button
            key={mm.id}
            onClick={() => setSel(i)}
            className={cn(
              "fi-panel border p-3 text-left transition-all",
              sel === i ? "bg-panel2" : "border-line bg-panel/60 hover:border-chalk/30",
            )}
            style={sel === i ? { borderColor: mm.color } : {}}
          >
            <span
              className="mono text-[9px] font-bold tracking-[0.2em] uppercase"
              style={{ color: mm.color }}
            >
              {String(i + 1).padStart(2, "0")}
            </span>
            <div className="mt-1 text-[13.5px] leading-tight font-bold">{mm.name}</div>
            <div className="mono mt-1 text-[10px] text-dim">{mm.role}</div>
          </button>
        ))}
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-[1.25fr_1fr]">
        <Panel label={M.name} accent={M.color}>
          <p className="text-[14px] leading-relaxed text-chalk/90">{M.summary}</p>
          <div className="mono mt-4 text-[9px] tracking-[0.22em] text-dim uppercase">
            Interface layout
          </div>
          <ul className="mt-2 space-y-2">
            {M.ui.map((u, i) => (
              <li key={i} className="flex gap-2.5 text-[12.5px] leading-relaxed text-dim">
                <span
                  className="mono mt-[6px] h-[6px] w-[6px] shrink-0"
                  style={{ background: M.color }}
                />
                <span>{u}</span>
              </li>
            ))}
          </ul>
        </Panel>
        <div className="space-y-3">
          <Panel label="PEDAGOGICAL PAYLOAD" accent={M.color}>
            <p className="text-[12.5px] leading-relaxed text-dim">{M.teaching}</p>
          </Panel>
          <Panel label="UPGRADE PATH" accent={M.color}>
            <p className="mono text-[11.5px] leading-relaxed text-chalk/85">{M.tiers}</p>
          </Panel>
          <Panel label="THE PRESET IS A PHYSICAL OBJECT" accent="var(--fi-accent)">
            <p className="text-[12.5px] leading-relaxed text-dim">
              Every output of every lab machine is the same noun: a{" "}
              <strong className="text-chalk">cartridge</strong> — a palm-sized punchcard with a
              live 3-D thumbnail spinning in its window. You hold it, you pocket it, you walk it
              through a portal, you shove it into a spire with a physical clunk. Nothing in SetMix
              is ever "in a menu". The inventory is a prop department.
            </p>
          </Panel>
        </div>
      </div>

      {/* fusion */}
      <div className="mt-10">
        <div className="mono mb-2 flex flex-wrap items-end justify-between gap-2">
          <div className="text-[10px] tracking-[0.28em] text-dim uppercase">
            ⬢ The Fusion Matrix — playable prototype
          </div>
          <div className="text-[10px] text-dim">
            load two cartridges · read the speculation · pull the lever
          </div>
        </div>
        <FusionMatrix />
      </div>

      {/* grammar */}
      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        {[
          [
            "NOUN + VERB",
            "#ff6fb2",
            "A thing that now does something. The workhorse of the tree: 70% of recipes. Behaviour is bound to a material or mesh, producing a template with gameplay consequence.",
          ],
          [
            "NOUN + NOUN",
            "#3dc8ff",
            "Two substances negotiate a third. The Dominance dial decides whose properties survive; both parents' graphs are blended node-wise, which is why the results surprise even us.",
          ],
          [
            "VERB / RULE",
            "#ffc13d",
            "Operators compose into new operators, and Rules govern where any preset is allowed to apply. Rules are the highest-leverage class in the game and the hardest to earn.",
          ],
        ].map(([k, c, d]) => (
          <Panel key={k} label="FUSION GRAMMAR" accent={c}>
            <div className="mono text-lg font-black" style={{ color: c }}>
              {k}
            </div>
            <p className="mt-2 text-[12.5px] leading-relaxed text-dim">{d}</p>
          </Panel>
        ))}
      </div>

      {/* full tree */}
      <div className="mt-3">
        <Panel label={`ALCHEMY TREE · ${RECIPES.length} SHIPPING RECIPES (of 1,400 planned)`} flush>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left">
              <thead>
                <tr className="mono border-b border-line text-[9px] tracking-[0.18em] text-dim uppercase">
                  <th className="p-2 font-medium">Input A</th>
                  <th className="p-2 font-medium">Input B</th>
                  <th className="p-2 font-medium">Child</th>
                  <th className="p-2 font-medium">Class</th>
                  <th className="p-2 font-medium">Emergent gameplay</th>
                </tr>
              </thead>
              <tbody>
                {RECIPES.map((r) => (
                  <tr key={r.id} className="border-b border-line/50 align-top hover:bg-panel2/70">
                    <td className="mono p-2 text-[11px] text-chalk/80">{r.a}</td>
                    <td className="mono p-2 text-[11px] text-chalk/80">{r.b}</td>
                    <td className="p-2">
                      <div className="text-[12px] font-bold" style={{ color: r.color }}>
                        {r.out}
                      </div>
                      <div className="mono mt-0.5 text-[9.5px] text-dim">
                        {r.aType} + {r.bType}
                      </div>
                    </td>
                    <td className="p-2">
                      <Tag color={r.color}>T{r.tier} {r.cls}</Tag>
                    </td>
                    <td className="max-w-[360px] p-2 text-[11.5px] leading-snug text-dim">
                      {r.emergent}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </section>
  );
}
