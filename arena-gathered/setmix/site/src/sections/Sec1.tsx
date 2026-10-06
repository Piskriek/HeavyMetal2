import { METRICS, FI_MODEL, STAGES } from "@/data/gdd";
import { Panel, SectionHead, Formula, Tag, KV, Bar } from "@/components/ui";
import { useFi, fmtBig } from "@/state/fi";
import { cn } from "@/utils/cn";

export default function Sec1() {
  const { stage, setT, m } = useFi();
  const S = STAGES[stage];

  return (
    <section id="s1" className="mx-auto max-w-[1400px] px-4 py-16 sm:px-8">
      <SectionHead
        n="01"
        kicker="Core Systems"
        title="The Fidelity Crafter Engine"
        lede="Four planetary scalars replace Heat, Oxygen and Pressure. They are not abstractions — each one is wired directly to a real renderer subsystem, so the player's progress bar and the player's screen are the same object."
      />

      {/* metrics */}
      <div className="grid gap-3 lg:grid-cols-4">
        {METRICS.map((mt) => (
          <Panel key={mt.key} label={`${mt.symbol} · ${mt.unit}`} accent={mt.color}>
            <h3 className="text-xl leading-tight font-black" style={{ color: mt.color }}>
              {mt.name}
            </h3>
            <div className="mt-2 flex items-center gap-2">
              <Bar v={m[mt.key]} color={mt.color} />
              <span className="mono tnum shrink-0 text-[10px] text-dim">
                {(m[mt.key] * 100).toFixed(0)}%
              </span>
            </div>
            <p className="mt-3 text-[12.5px] leading-relaxed text-dim">{mt.controls}</p>
            <div className="mono mt-3 border-t border-line pt-2 text-[9px] tracking-[0.16em] text-dim uppercase">
              Teaches
            </div>
            <p className="mono mt-1 text-[10.5px] leading-snug" style={{ color: mt.color }}>
              {mt.realConcept}
            </p>
            <div className="mono mt-3 overflow-x-auto border border-line bg-void2 p-2 text-[10px] whitespace-pre text-chalk/80">
              {mt.curve}
            </div>
            <div className="mt-3 space-y-2">
              <div className="border-l-2 border-pxd/60 pl-2">
                <div className="mono text-[8.5px] tracking-[0.18em] text-dim uppercase">
                  Starved
                </div>
                <p className="text-[11px] leading-snug text-chalk/80">{mt.starveSymptom}</p>
              </div>
              <div className="border-l-2 border-lx/60 pl-2">
                <div className="mono text-[8.5px] tracking-[0.18em] text-dim uppercase">
                  Over-fed
                </div>
                <p className="text-[11px] leading-snug text-chalk/80">{mt.gluttonSymptom}</p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-1">
              {mt.sources.map((s) => (
                <Tag key={s} color={mt.color}>
                  {s}
                </Tag>
              ))}
            </div>
          </Panel>
        ))}
      </div>

      {/* formula */}
      <div className="mt-3 grid gap-3 lg:grid-cols-[1.1fr_1fr]">
        <Panel label="THE MASTER EQUATION" accent="var(--fi-accent)">
          <Formula>{`${FI_MODEL.master}
${FI_MODEL.coherence}

${FI_MODEL.rate}
${FI_MODEL.entropy}`}</Formula>
          <p className="mt-3 text-[13px] leading-relaxed text-dim">{FI_MODEL.note}</p>
        </Panel>
        <Panel label="WHY THESE FOUR" accent="var(--fi-accent)">
          <div className="space-y-3 text-[13px] leading-relaxed text-dim">
            <p>
              <strong className="text-chalk">Each metric owns one axis of perception.</strong>{" "}
              Pixels own <em className="not-italic text-pxd">colour and surface</em>; Flux owns{" "}
              <em className="not-italic text-vtx">form and silhouette</em>; Lumens own{" "}
              <em className="not-italic text-lx">depth and mood</em>; Hydrology owns{" "}
              <em className="not-italic text-aq">motion and life</em>. A player can always answer
              "what will this machine change?" by looking at the sky.
            </p>
            <p>
              <strong className="text-chalk">They are deliberately interdependent.</strong> Texture
              without topology is wallpaper. Topology without light is a grey blob. Light without
              water is a desert. The coherence term is the tutor: it never says "you are doing it
              wrong", it just makes the planet look like a mistake until you fix it.
            </p>
            <p>
              <strong className="text-chalk">And they are honest.</strong> Pxd really is the texel
              budget. Vtx really is the subdivision depth. There is no fake number anywhere in this
              design — which is why the game can teach graphics by accident.
            </p>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-x-4">
            {METRICS.map((mt) => (
              <KV key={mt.key} k={`${mt.symbol} weight`} v={mt.weight.toFixed(2)} color={mt.color} />
            ))}
          </div>
        </Panel>
      </div>

      {/* stage ladder */}
      <div className="mt-10">
        <div className="mono mb-2 flex flex-wrap items-end justify-between gap-2">
          <div className="text-[10px] tracking-[0.28em] text-dim uppercase">
            ▤ The six terraformation stages · 0 → 100,000,000 Fi
          </div>
          <div className="text-[10px] text-dim">click a stage — the live simulation follows</div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {STAGES.map((s, i) => {
            const active = stage === i;
            return (
              <button
                key={s.id}
                onClick={() => setT(i / 6 + 0.08)}
                className={cn(
                  "fi-panel group relative overflow-hidden border p-3 text-left transition-all",
                  active
                    ? "fi-accent-border bg-panel2"
                    : "border-line bg-panel/60 hover:border-chalk/30",
                )}
              >
                <div className="mono flex items-center justify-between text-[9px] tracking-[0.2em] text-dim uppercase">
                  <span className={active ? "fi-accent-text font-bold" : ""}>{s.code}</span>
                  <span className="tnum">{s.duration}</span>
                </div>
                <div className="mt-1.5 text-[13px] leading-tight font-bold">{s.name}</div>
                <div className="mono tnum mt-1 text-[9.5px] text-dim">
                  {fmtBig(s.fiMin)} → {fmtBig(s.fiMax)} Fi
                </div>
                <div className="mt-2 flex h-3 gap-px">
                  {s.palette.map((c) => (
                    <span key={c} className="flex-1" style={{ background: c }} />
                  ))}
                  {s.water && <span className="w-3" style={{ background: s.water }} />}
                </div>
                <div
                  className="mt-2 h-6 w-full"
                  style={{ background: `linear-gradient(${s.sky[0]}, ${s.sky[1]})` }}
                />
              </button>
            );
          })}
        </div>

        {/* stage detail */}
        <div className="mt-3 grid gap-3 lg:grid-cols-[1.4fr_1fr]">
          <Panel
            label={`${S.code} — ${S.name}`}
            accent="var(--fi-accent)"
            right={
              <span className="mono tnum text-[10px] text-dim">
                {fmtBig(S.fiMin)} → {fmtBig(S.fiMax)} Fi · {S.duration}
              </span>
            }
          >
            <div className="text-balance text-xl leading-tight font-black sm:text-2xl">
              {S.tagline}
            </div>
            <ul className="mt-4 space-y-2.5">
              {S.visual.map((v, i) => (
                <li key={i} className="flex gap-2.5 text-[13px] leading-relaxed text-dim">
                  <span className="mono fi-accent-text shrink-0 pt-[2px] text-[10px]">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span>{v}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 border-t border-line pt-3">
              <div className="mono text-[9px] tracking-[0.2em] text-dim uppercase">
                Engineering note
              </div>
              <p className="mono mt-1 text-[11px] leading-relaxed text-chalk/75">{S.techNote}</p>
            </div>
          </Panel>

          <div className="space-y-3">
            {[
              ["AVATAR", S.avatar, "#ff6fb2"],
              ["SOUNDSCAPE", S.sound, "#ffc13d"],
              ["PHYSICS", S.physics, "#7cff4d"],
            ].map(([k, v, c]) => (
              <Panel key={k} label={k} accent={c}>
                <p className="text-[12.5px] leading-relaxed text-dim">{v}</p>
              </Panel>
            ))}
            <Panel label="SYSTEMIC UNLOCKS" accent="#3dc8ff">
              <ul className="space-y-1">
                {S.systemic.map((u) => (
                  <li key={u} className="mono flex gap-2 text-[11.5px] text-dim">
                    <span className="text-aq">+</span>
                    {u}
                  </li>
                ))}
              </ul>
              <div className="mt-3 border-t border-line pt-2">
                <div className="mono text-[9px] tracking-[0.2em] text-dim uppercase">
                  Antagonist
                </div>
                <p className="mt-1 text-[11.5px] leading-snug text-pxd">{S.threat}</p>
              </div>
            </Panel>
          </div>
        </div>
      </div>
    </section>
  );
}
