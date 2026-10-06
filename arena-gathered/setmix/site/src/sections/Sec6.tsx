import { useState } from "react";
import { HARD_Q, STAGES } from "@/data/gdd";
import { Panel, SectionHead, Rich, Tag } from "@/components/ui";
import { cn } from "@/utils/cn";

const SUBSYS = [
  { k: "Terrain / geometry", c: "#7cff4d", v: [0.6, 1.0, 2.2, 2.6, 3.1, 3.2] },
  { k: "Materials / texturing", c: "#ff3d8a", v: [0.2, 0.5, 1.4, 1.9, 2.8, 3.0] },
  { k: "Lighting / shadows / GI", c: "#ffc13d", v: [0.1, 0.3, 1.1, 1.8, 2.6, 4.1] },
  { k: "Water / fluids", c: "#3dc8ff", v: [0.0, 0.0, 0.0, 2.1, 2.3, 2.4] },
  { k: "Foliage / VFX / volumetrics", c: "#b46bff", v: [0.2, 0.4, 0.9, 1.0, 1.9, 2.1] },
  { k: "Post / UI / upscale", c: "#8b9bb4", v: [0.8, 1.2, 1.5, 1.4, 1.5, 1.5] },
];

const GOVERNOR = [
  "Volumetric march step count  (−1.1 ms)",
  "RT reflections → SSR → probes  (−2.4 ms)",
  "Foliage density falloff curve  (−1.7 ms)",
  "Shadow cascades 4 → 3  (−0.9 ms)",
  "Water refraction → planar  (−0.8 ms)",
  "Internal resolution −10% + temporal upscale  (−1.9 ms)",
];

function BudgetChart() {
  const totals = STAGES.map((_, i) => SUBSYS.reduce((a, s) => a + s.v[i], 0));
  const H = 190;
  const max = 18;
  return (
    <div>
      <div className="relative" style={{ height: H + 34 }}>
        {/* 16.6 ms line */}
        <div
          className="absolute inset-x-0 border-t border-dashed border-pxd/70"
          style={{ top: H - (16.6 / max) * H }}
        >
          <span className="mono absolute -top-4 right-0 text-[9px] text-pxd">
            16.6 ms — 60 fps budget
          </span>
        </div>
        <div className="flex h-full items-end gap-2">
          {STAGES.map((s, i) => (
            <div key={s.id} className="flex flex-1 flex-col items-center">
              <div
                className="relative flex w-full flex-col-reverse"
                style={{ height: H }}
              >
                <div className="absolute inset-x-0 bottom-0 flex flex-col-reverse">
                  {SUBSYS.map((sub) => (
                    <div
                      key={sub.k}
                      title={`${sub.k}: ${sub.v[i]} ms`}
                      style={{
                        height: (sub.v[i] / max) * H,
                        background: sub.c,
                        opacity: 0.85,
                      }}
                    />
                  ))}
                </div>
                <div
                  className="mono absolute inset-x-0 text-center text-[9.5px] text-chalk"
                  style={{ bottom: (totals[i] / max) * H + 4 }}
                >
                  {totals[i].toFixed(1)}
                </div>
              </div>
              <div className="mono mt-1 text-[9px] text-dim">{s.code}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="mono mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[9px] text-dim">
        {SUBSYS.map((s) => (
          <span key={s.k} className="flex items-center gap-1">
            <span className="h-2 w-2" style={{ background: s.c }} />
            {s.k}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function Sec6() {
  const [open, setOpen] = useState(0);

  return (
    <section id="s6" className="mx-auto max-w-[1400px] px-4 py-16 sm:px-8">
      <SectionHead
        n="06"
        kicker="Hard Reasoning"
        title="The Four Uncomfortable Questions"
        lede="Every one of these has killed a game like ours before. Here are the answers, with numbers, in the order a sceptical technical director would ask them."
      />

      <div className="grid gap-3 lg:grid-cols-[1fr_1fr]">
        <div className="space-y-2">
          {HARD_Q.map((q, i) => (
            <div key={q.q}>
              <button
                onClick={() => setOpen(i)}
                className={cn(
                  "fi-panel w-full border p-3 text-left transition-all",
                  open === i
                    ? "fi-accent-border bg-panel2"
                    : "border-line bg-panel/60 hover:border-chalk/30",
                )}
              >
                <div className="mono flex items-center gap-2 text-[9px] tracking-[0.2em] text-dim uppercase">
                  <span className={open === i ? "fi-accent-text font-bold" : ""}>
                    Q{i + 1}
                  </span>
                  <span className="h-px flex-1 bg-line" />
                </div>
                <div className="mt-1 text-[16px] leading-tight font-black">{q.q}</div>
                <p className="mt-1 text-[12px] leading-snug text-dim">{q.sub}</p>
              </button>
              {open === i && (
                <div className="fi-panel mt-2 border border-line bg-panel/40 p-4 lg:hidden">
                  <Answer items={q.answer} />
                </div>
              )}
            </div>
          ))}

          <Panel label="FRAME BUDGET · target potato (GTX 1050 · 1080p)" accent="#7cff4d">
            <BudgetChart />
            <p className="mt-3 text-[12px] leading-relaxed text-dim">
              The curve is designed before the art. Stage 1 is cheap <em className="not-italic text-chalk">on
              purpose</em> so the governor banks 14 ms of headroom to spend across the next 40
              hours. The player experiences the whole arc as "my computer is coping fine and the
              world keeps getting prettier" — which is, in fact, true.
            </p>
          </Panel>

          <Panel label="THE GOVERNOR · demotion ladder" accent="#ffc13d">
            <p className="mb-2 text-[12px] leading-relaxed text-dim">
              Trigger: frame time &gt; 15.5 ms for 8 consecutive frames. Promotes back one notch
              after 4 stable seconds. Any item can be pinned by the player and will never be
              demoted.
            </p>
            <ol className="space-y-1">
              {GOVERNOR.map((g, i) => (
                <li key={g} className="mono flex gap-2 text-[11px] text-chalk/80">
                  <span className="text-lx">{i + 1}.</span>
                  {g}
                </li>
              ))}
            </ol>
          </Panel>
        </div>

        <div className="hidden lg:block">
          <div className="sticky top-24">
            <Panel
              label={`ANSWER · ${HARD_Q[open].q}`}
              accent="var(--fi-accent)"
              right={<Tag color="var(--fi-accent)">{HARD_Q[open].answer.length} points</Tag>}
            >
              <Answer items={HARD_Q[open].answer} />
            </Panel>
          </div>
        </div>
      </div>
    </section>
  );
}

function Answer({ items }: { items: string[] }) {
  return (
    <div className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
      {items.map((a, i) => (
        <div key={i} className="flex gap-3">
          <span className="mono fi-accent-text pt-[3px] text-[10px]">
            {String(i + 1).padStart(2, "0")}
          </span>
          <p className="text-[13px] leading-relaxed text-dim">
            <Rich text={a} />
          </p>
        </div>
      ))}
    </div>
  );
}
