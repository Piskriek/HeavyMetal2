import { useState } from "react";
import { MVP, SLICE_SCOPE, UI_LAYOUTS } from "@/data/gdd";
import { Panel, SectionHead, Tag } from "@/components/ui";
import { cn } from "@/utils/cn";

export default function Sec7() {
  const [sel, setSel] = useState(7);
  const B = MVP[sel];

  return (
    <section id="s7" className="mx-auto max-w-[1400px] px-4 py-16 sm:px-8">
      <SectionHead
        n="07"
        kicker="Vertical Slice"
        title="The First 60 Minutes"
        lede="If we build only one hour of this game, this is the hour. Twelve beats, one unforgettable moment at minute 33, and a hook at minute 58. Everything in the slice exists to make one chord land."
      />

      {/* timeline */}
      <div className="fi-panel mb-3 overflow-x-auto border border-line bg-panel">
        <div className="relative h-[86px] min-w-[620px] px-4">
          <div className="absolute inset-x-4 top-[46px] h-px bg-line" />
          <div
            className="fi-accent-bg absolute top-[46px] h-px transition-all duration-300"
            style={{ left: 16, width: `calc(${(sel / (MVP.length - 1)) * 100}% - 16px)` }}
          />
          <div className="relative flex h-full items-center justify-between">
            {MVP.map((b, i) => {
              const key = b.title.startsWith("THE MOMENT");
              return (
                <button
                  key={b.t}
                  onClick={() => setSel(i)}
                  className="group relative flex flex-col items-center"
                  style={{ width: 40 }}
                >
                  <span
                    className={cn(
                      "mono mb-2 text-[9px] transition-colors",
                      sel === i ? "fi-accent-text font-bold" : "text-dim",
                    )}
                  >
                    {b.t}
                  </span>
                  <span
                    className={cn(
                      "block transition-all",
                      sel === i
                        ? "fi-accent-bg h-4 w-4"
                        : key
                          ? "h-3 w-3 bg-pxd anim-pulse"
                          : "h-2 w-2 bg-dim group-hover:bg-chalk",
                    )}
                  />
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1.3fr_1fr]">
        <Panel
          label={`BEAT ${String(sel + 1).padStart(2, "0")} · T+${B.t}`}
          accent={B.title.startsWith("THE MOMENT") ? "#ff3d8a" : "var(--fi-accent)"}
          right={
            B.title.startsWith("THE MOMENT") ? <Tag color="#ff3d8a" solid>THE HOOK</Tag> : undefined
          }
        >
          <h3 className="text-balance text-2xl leading-tight font-black sm:text-3xl">{B.title}</h3>
          <p className="mt-3 text-[14px] leading-relaxed text-chalk/90">{B.beat}</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="border-l-2 fi-accent-border pl-3">
              <div className="mono text-[9px] tracking-[0.2em] text-dim uppercase">
                Designer intent
              </div>
              <p className="mt-1 text-[12px] leading-snug text-dim">{B.teach}</p>
            </div>
            <div className="border-l-2 border-line pl-3">
              <div className="mono text-[9px] tracking-[0.2em] text-dim uppercase">
                Playtest KPI
              </div>
              <p className="mt-1 text-[12px] leading-snug text-dim">{B.kpi}</p>
            </div>
          </div>
        </Panel>

        <div className="space-y-3">
          <Panel label="IN SCOPE FOR THE SLICE" accent="#7cff4d">
            <ul className="space-y-1.5">
              {SLICE_SCOPE.build.map((b) => (
                <li key={b} className="flex gap-2 text-[12px] leading-snug text-dim">
                  <span className="text-vtx">✓</span>
                  {b}
                </li>
              ))}
            </ul>
          </Panel>
          <Panel label="RUTHLESSLY CUT" accent="#ff3d8a">
            <ul className="space-y-1.5">
              {SLICE_SCOPE.cut.map((b) => (
                <li key={b} className="flex gap-2 text-[12px] leading-snug text-dim">
                  <span className="text-pxd">✕</span>
                  {b}
                </li>
              ))}
            </ul>
            <div className="mono mt-3 border-t border-line pt-2 text-[11px] text-chalk/80">
              {SLICE_SCOPE.team}
            </div>
          </Panel>
          <Panel label="RISK REGISTER" accent="#ffc13d">
            <div className="space-y-2">
              {SLICE_SCOPE.risk.map(([k, v]) => (
                <div key={k}>
                  <div className="mono text-[10px] font-bold tracking-[0.15em] text-lx uppercase">
                    {k}
                  </div>
                  <p className="text-[11.5px] leading-snug text-dim">{v}</p>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>

      {/* UI layouts */}
      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        {UI_LAYOUTS.map((u) => (
          <Panel key={u.name} label={`UI LAYOUT · ${u.name}`} accent="var(--fi-accent)">
            <ul className="space-y-1.5">
              {u.rows.map((r) => (
                <li key={r} className="mono flex gap-2 text-[11px] leading-snug text-dim">
                  <span className="fi-accent-text">›</span>
                  {r}
                </li>
              ))}
            </ul>
          </Panel>
        ))}
      </div>

      {/* closing statement */}
      <div className="fi-panel relative mt-10 overflow-hidden border border-line bg-panel p-6 sm:p-10">
        <div className="pointer-events-none absolute inset-0 bg-grid opacity-50" />
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            background:
              "radial-gradient(ellipse at 20% 0%, var(--fi-accent-soft), transparent 60%)",
          }}
        />
        <div className="relative">
          <div className="mono text-[10px] tracking-[0.3em] text-dim uppercase">
            Closing argument
          </div>
          <p className="text-balance mt-3 max-w-4xl text-xl leading-snug font-light sm:text-3xl">
            Every survival-crafting game asks the player to make a dead world habitable. SetMix
            asks them to make a dead world{" "}
            <span className="fi-accent-text font-black">beautiful</span> — and then proves they
            did it by rendering the evidence at sixty frames a second, on their own hardware, out
            of nothing but mathematics they chose themselves.
          </p>
          <p className="mt-4 max-w-3xl text-[13px] leading-relaxed text-dim">
            The moon does not remember how much ore you mined. It remembers the palette you picked
            at minute 45, the canyon you tuned to a minor chord at hour nine, and the exact shade
            of green you argued with yourself about before the rain arrived. That is a save file
            worth keeping, and a screenshot worth posting — which is the only marketing budget a
            game like this will ever need.
          </p>
        </div>
      </div>
    </section>
  );
}
