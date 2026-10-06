import { useState } from "react";
import { PEDAGOGY, PEDAGOGY_PHILOSOPHY } from "@/data/gdd";
import { Panel, SectionHead } from "@/components/ui";
import { cn } from "@/utils/cn";

export default function Sec5() {
  const [jargon, setJargon] = useState(false);

  return (
    <section id="s5" className="mx-auto max-w-[1400px] px-4 py-16 sm:px-8">
      <SectionHead
        n="05"
        kicker="Pedagogy"
        title="Teaching Real Game Dev As Gameplay"
        lede="SetMix is a stealth graphics course wearing a survival-crafting costume. We never say the word 'shader' until the player has already built eleven of them. Every mechanic is a real technique with the arithmetic removed and the intuition left in."
      />

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <button
          onClick={() => setJargon(!jargon)}
          className={cn(
            "mono border px-4 py-2 text-[10px] font-bold tracking-[0.25em] uppercase transition-all active:translate-y-px",
            jargon ? "border-transparent bg-chalk text-void" : "border-line text-dim hover:text-chalk",
          )}
        >
          {jargon ? "◉ JARGON MODE: ON" : "○ JARGON MODE: OFF"}
        </button>
        <p className="text-[12px] text-dim">
          The in-game toggle, reproduced here. Off: poetic names. On: the real technical term. The
          player graduates themselves — and the Graphics Codex fills in from use, not from reading.
        </p>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1.35fr_1fr]">
        <Panel label="THE TRANSLATION TABLE · 14 smuggled lessons" flush>
          <div className="divide-y divide-line/50">
            {PEDAGOGY.map(([game, real, how]) => (
              <div key={game} className="grid gap-1 p-3 sm:grid-cols-[1fr_1.35fr]">
                <div>
                  <div
                    className={cn(
                      "text-[13px] leading-tight font-bold transition-colors",
                      jargon ? "text-dim" : "fi-accent-text",
                    )}
                  >
                    {jargon ? real : game}
                  </div>
                  <div className="mono mt-0.5 text-[10px] text-dim/70">
                    {jargon ? game : real}
                  </div>
                </div>
                <p className="text-[12px] leading-snug text-dim">{how}</p>
              </div>
            ))}
          </div>
        </Panel>

        <div className="space-y-3">
          {PEDAGOGY_PHILOSOPHY.map((p, i) => (
            <Panel key={p.t} label={`PRINCIPLE ${String(i + 1).padStart(2, "0")}`} accent="var(--fi-accent)">
              <h3 className="text-[16px] leading-tight font-black">{p.t}</h3>
              <p className="mt-2 text-[12.5px] leading-relaxed text-dim">{p.d}</p>
            </Panel>
          ))}
        </div>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <Panel label="WHAT THE TOOL DOES (90%)" accent="#7cff4d">
          <ul className="mono space-y-1.5 text-[11.5px] leading-snug text-dim">
            {[
              "Auto-UV unwrap + seam minimisation",
              "Tangent basis, normal re-orthogonalisation",
              "Mip chains, filtering policy, texel budget",
              "LOD chain + impostor baking",
              "Instancing, batching, draw-call packing",
              "Noise normalisation & range remapping",
              "Collision hull generation",
              "Determinism & seed stability checks",
            ].map((x) => (
              <li key={x} className="flex gap-2">
                <span className="text-vtx">✓</span>
                {x}
              </li>
            ))}
          </ul>
        </Panel>
        <Panel label="WHAT THE PLAYER DECIDES (100%)" accent="#ff3d8a">
          <ul className="mono space-y-1.5 text-[11.5px] leading-snug text-dim">
            {[
              "Which colours. Which three, out of millions.",
              "Silhouette: jagged, soft, columnar, drooping",
              "Rhythm: how often, how dense, how random",
              "Mood: time of day, fog, grade, weather",
              "Scale relationships and visual hierarchy",
              "Which rules govern which regions",
              "What the planet is FOR",
              "When it is finished",
            ].map((x) => (
              <li key={x} className="flex gap-2">
                <span className="text-pxd">◆</span>
                {x}
              </li>
            ))}
          </ul>
        </Panel>
        <Panel label="THE TRANSFER TEST" accent="#ffc13d">
          <p className="text-[12.5px] leading-relaxed text-dim">
            Our success metric is brutal and measurable:{" "}
            <strong className="text-chalk">
              a player with 20 hours in SetMix and zero prior experience should be able to open
              Blender's shader editor and correctly identify base colour, roughness, normal and a
              noise node within 60 seconds.
            </strong>{" "}
            We will run that study before launch and publish it. If the transfer does not happen,
            the vocabulary is wrong and we will rewrite every label in the game.
          </p>
          <div className="mono mt-3 border-t border-line pt-2 text-[11px] leading-snug text-chalk/75">
            Secondary metric: 5% of players publish a .setmix bundle. Tertiary: 50 of them get
            hired in the industry and say the word SetMix in the interview.
          </div>
        </Panel>
      </div>
    </section>
  );
}
