import { useState } from "react";
import { Panel, SectionHead, Formula, Tag } from "@/components/ui";
import SetMixPlayable from "@/components/p6/SetMixPlayable";
import NetLab from "@/components/p6/NetLab";
import { SCRIPT, ACT_META, type ActId } from "@/drop/QuestEngine";
import { cn } from "@/utils/cn";

import srcQuest from "@/drop/QuestEngine.ts?raw";
import srcNet from "@/drop/NetBus.ts?raw";

const ACTS: ActId[] = ["ACT1", "ACT2", "ACT3", "ACT4"];

function highlight(src: string) {
  const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
  let out = esc(src);
  out = out.replace(/(\/\*[\s\S]*?\*\/|\/\/[^\n]*)/g, '<span class="tk-c">$1</span>');
  out = out.replace(/(&quot;|&#39;|["'`])((?:\\.|(?!\1)[^\\])*?)\1/g, '<span class="tk-s">$1$2$1</span>');
  out = out.replace(/\b(const|let|var|function|return|if|else|for|while|class|interface|type|export|import|from|new|extends|readonly|public|private|async|await|try|catch|throw|typeof|in|of|as|null|undefined|true|false|void|this|switch|case|break|continue|default|get)\b/g, '<span class="tk-k">$1</span>');
  out = out.replace(/\b(\d+\.?\d*(?:e[-+]?\d+)?)\b/gi, '<span class="tk-n">$1</span>');
  return out;
}

export default function Phase6() {
  const [act, setAct] = useState<ActId>("ACT1");
  const [file, setFile] = useState(0);
  const files = [
    { p: "packages/quest/src/QuestEngine.ts", s: srcQuest,
      n: "The first thirty minutes as a pure reducer. Four acts, sixteen objectives, nudges that only fire after a silent-discovery window." },
    { p: "packages/net/src/NetBus.ts", s: srcNet,
      n: "28-byte binary commands, 3-tick input delay, snapshot-and-replay rollback, and role affinity that skips the rewind entirely when it provably cannot matter." },
  ];
  const f = files[file];

  return (
    <>
      {/* ── intro ──────────────────────────────────────────────────── */}
      <section id="p6-top" className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-grid opacity-50" />
        <div className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(ellipse at 50% 0%, var(--fi-accent-soft), transparent 55%)" }} />
        <div className="relative mx-auto max-w-[1400px] px-4 pt-14 pb-8 sm:px-8">
          <div className="mono mb-4 flex flex-wrap items-center gap-2 text-[10px] tracking-[0.3em] uppercase">
            <span className="fi-accent-bg px-2 py-1 font-bold text-void">PHASE 6 · CAPSTONE</span>
            <span className="text-dim">the vertical slice, playable</span>
          </div>
          <h1 className="text-balance text-[clamp(2.1rem,6.5vw,5rem)] leading-[0.92] font-black tracking-[-0.035em]">
            Six phases of architecture.<br />
            <span className="fi-accent-text">One click to play it.</span>
          </h1>
          <p className="mt-6 max-w-3xl text-[15px] leading-relaxed text-dim sm:text-[16.5px]">
            Every module from Phases 1–5 is now running simultaneously in one WebGL2 context: the
            uber-terrain shader, the stencil portal, the goblin controller, the C¹ geomorph wave,
            instanced pixel plumes, the procedural audio synth, and a quest reducer that watches
            all of it. Click the viewport, walk through the arch, and mine a crystal.
          </p>
        </div>
      </section>

      {/* ── THE GAME ───────────────────────────────────────────────── */}
      <section id="p6-play" className="mx-auto max-w-[1400px] px-4 pb-16 sm:px-8">
        <div className="mono mb-2 flex flex-wrap items-end justify-between gap-2">
          <div className="text-[10px] tracking-[0.28em] text-dim uppercase">
            ▣ SetMix · playable vertical slice · WebGL2 + Web Audio, no engine
          </div>
          <div className="text-[10px] text-dim">
            WASD · mouse · space · shift · LMB mine · RMB place · 1–8 hotbar · E interact
          </div>
        </div>
        <SetMixPlayable />

        <div className="mt-3 grid gap-3 lg:grid-cols-3">
          <Panel label="THE SEAM THAT ISN'T THERE" accent="#b46bff">
            <p className="text-[12.5px] leading-relaxed text-dim">
              The moon is not a second scene behind a render target. It occupies the{" "}
              <strong className="text-chalk">same world space</strong>, beyond the arch plane, and
              the virtual camera through the portal is simply the camera. Walking through performs
              no coordinate transform at all — only the <em className="not-italic text-chalk">rules</em>{" "}
              change: gravity 9.81 → 1.62, palette → 4 colours, audio → 8 kHz, coherence begins to
              drain. There is nothing to transition, which is why there is no hitch.
            </p>
          </Panel>
          <Panel label="WHAT TO DO FIRST" accent="#7cff4d">
            <ol className="space-y-1.5 text-[12px] leading-snug text-dim">
              {[
                "Walk toward the arch. Stop at the threshold and look at your hands.",
                "Step through. Jump — gravity is a sixth of what it was.",
                "Find the magenta crystals. Hold left-click on one.",
                "Press 2, right-click to place a Solar Collector.",
                "Press 1, right-click to place a Pixel Chimney next to it.",
                "It auto-wires, slots the regolith cartridge, and dispatches the wave.",
                "Stand still and watch the crater floor swell past you.",
              ].map((s, i) => (
                <li key={i} className="flex gap-2">
                  <span className="mono text-vtx">{i + 1}.</span>{s}
                </li>
              ))}
            </ol>
          </Panel>
          <Panel label="MODULES RUNNING AT ONCE" accent="#ffc13d">
            <ul className="mono space-y-1 text-[10.5px] text-dim">
              {[
                ["TerrainMaterial", "palette quantisation, Bayer dither, fog"],
                ["PortalRenderer", "stencil aperture + depth clear"],
                ["GoblinController", "gravity tiers, ground probe, jump"],
                ["field (geomorph)", "C¹ vertex swell in the vertex shader"],
                ["machines + plumes", "instanced cubes eaten by the band"],
                ["setmixAudio", "bit-crush, chime, whoosh, foley"],
                ["QuestEngine", "16 objectives, 4 acts, nudge timers"],
                ["fidelity", "deriveBudget → uniforms, every frame"],
              ].map(([a, b]) => (
                <li key={a} className="flex gap-2">
                  <span className="w-[110px] shrink-0 text-vtx">{a}</span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </section>

      {/* ── QUEST ──────────────────────────────────────────────────── */}
      <section id="p6-quest" className="mx-auto max-w-[1400px] px-4 py-16 sm:px-8">
        <SectionHead n="6.1" kicker="Deliverable 1" title="The First Thirty Minutes"
          lede="Sixteen objectives across four acts, as a pure reducer. Four rules govern all of them, and breaking any one is why players quit an onboarding in the first ten minutes." />

        <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {([
            ["No quest marker before a nudge", "Every objective gets ~45 s of silent discovery. Only then does a diegetic hint fire. The player should believe they found it.", "#7cff4d"],
            ["Nothing is ever blocked", "Objectives observe the world; they never gate it. Walk through the portal at second three and Act 1 simply completes early.", "#ff3d8a"],
            ["Every reward within 6 seconds", "No objective completes into a number. It completes into a plume, a chord, a colour, or a wave.", "#ffc13d"],
            ["The beat at minute 33 is the product", "Everything is paced so the first fidelity tick lands there — and it is allowed to stop the world for 2.5 seconds.", "#b46bff"],
          ] as const).map(([k, v, c]) => (
            <div key={k} className="fi-panel border border-line bg-panel/60 p-3" style={{ borderColor: c + "44" }}>
              <div className="text-[12.5px] leading-tight font-bold" style={{ color: c }}>{k}</div>
              <p className="mt-1.5 text-[11.5px] leading-snug text-dim">{v}</p>
            </div>
          ))}
        </div>

        <div className="mb-3 flex flex-wrap gap-2">
          {ACTS.map((a) => (
            <button key={a} onClick={() => setAct(a)}
              className={cn("mono flex-1 border px-3 py-2 text-left transition-all",
                act === a ? "bg-panel2" : "border-line bg-panel/50 hover:border-chalk/30")}
              style={act === a ? { borderColor: ACT_META[a].colour } : {}}>
              <div className="text-[9px] tracking-[0.2em] text-dim uppercase">
                ACT {ACT_META[a].n} · {ACT_META[a].window}
              </div>
              <div className="mt-0.5 text-[13px] font-black" style={{ color: ACT_META[a].colour }}>
                {ACT_META[a].title}
              </div>
            </button>
          ))}
        </div>

        <Panel label={`${ACT_META[act].title} · objectives`} accent={ACT_META[act].colour} flush>
          <div className="divide-y divide-line/60">
            {SCRIPT.filter((o) => o.act === act).map((o) => (
              <div key={o.id} className="grid gap-2 p-3 lg:grid-cols-[1fr_1fr_1fr]">
                <div>
                  <div className="flex items-start gap-2">
                    <span className="mono mt-[3px] text-[9px]" style={{ color: ACT_META[act].colour }}>
                      {o.optional ? "○" : "◆"}
                    </span>
                    <div>
                      <div className="text-[13px] leading-tight font-bold">{o.text}</div>
                      <div className="mono mt-1 flex flex-wrap gap-1">
                        <Tag color={ACT_META[act].colour}>{o.need > 1 ? `×${o.need}` : "1"}</Tag>
                        {o.optional && <Tag>OPTIONAL</Tag>}
                        {o.nudgeAfterSec > 0 && <Tag>nudge @ {o.nudgeAfterSec}s</Tag>}
                      </div>
                    </div>
                  </div>
                </div>
                <div>
                  <div className="mono text-[8.5px] tracking-[0.2em] text-dim uppercase">Designer intent</div>
                  <p className="mt-1 text-[11.5px] leading-snug text-dim">{o.intent}</p>
                  {o.nudge && (
                    <p className="mono mt-1.5 border-l-2 border-line pl-2 text-[10.5px] leading-snug text-chalk/70">
                      “{o.nudge}”
                    </p>
                  )}
                </div>
                <div>
                  <div className="mono text-[8.5px] tracking-[0.2em] text-dim uppercase">Payoff</div>
                  <p className="mt-1 text-[11.5px] leading-snug text-chalk/85">{o.reward}</p>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <div className="mt-3">
          <Panel label="stepQuest() · the reducer signature" accent="var(--fi-accent)">
            <Formula>{`stepQuest(state, events, fi, ticks) → {
  nextState, activeQuests, notifications, unlockedMachines
}

events: ENTERED_WORLD · HAND_THROUGH_PORTAL · MINED · PLACED_MACHINE
        WIRED · SLOTTED_CARTRIDGE · WAVE_DISPATCHED · FUSED
        COHERENCE_LOW · DECOHERED · JUMPED · INTERACTED

Act advances when every NON-OPTIONAL objective completes, which is why
the optional beats (reach through the arch, test the gravity, taste
decoherence) can be missed without ever stalling a player.`}</Formula>
          </Panel>
        </div>
      </section>

      {/* ── HUD ────────────────────────────────────────────────────── */}
      <section id="p6-hud" className="mx-auto max-w-[1400px] px-4 py-16 sm:px-8">
        <SectionHead n="6.2" kicker="Deliverable 3" title="The Diegetic HUD"
          lede="Centre of screen: nothing, ever — the world is the UI. Everything else lives in the corners and degrades with the thing it is reporting on." />
        <div className="grid gap-3 lg:grid-cols-3">
          <Panel label="THE Fi RADIAL" accent="#7cff4d">
            <p className="text-[12.5px] leading-relaxed text-dim">
              A 270° arc with ticks at each stage threshold, filled on a{" "}
              <code className="mono text-chalk">log1p</code> scale because the ladder spans five
              orders of magnitude. Drawn on canvas rather than SVG so it costs one draw call and
              can animate per-frame without React touching it.
            </p>
          </Panel>
          <Panel label="DERIVATIVE INDICATORS" accent="#ff3d8a">
            <p className="text-[12.5px] leading-relaxed text-dim">
              The four metric bars each show absolute progress, but only{" "}
              <em className="not-italic text-chalk">one</em> carries the ▲ — whichever has the
              highest rate <em className="not-italic">normalised to its own stage-6 target</em>.
              That is the number that actually tells a player what to build next, and showing four
              arrows would hide it.
            </p>
          </Panel>
          <Panel label="THE HUD DEGRADES WITH YOU" accent="#ffc13d">
            <p className="text-[12.5px] leading-relaxed text-dim">
              Below 72% coherence a magenta dither mask fades across the entire screen — the
              interface itself is being undersampled. By the time the bar reads Z-FIGHTING the
              player has already <em className="not-italic text-chalk">felt</em> it for twenty
              seconds. The gauge confirms a sensation rather than delivering news.
            </p>
          </Panel>
        </div>
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <Panel label="CONTEXTUAL RETICLE" accent="#3dc8ff">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {([
                ["NONE", "#8b9bb4", "1.6 px dot"], ["CRYSTAL", "#ff3d8a", "4 ticks + ring"],
                ["SHARD", "#7cff4d", "4 ticks + ring"], ["PLACE", "#ffc13d", "ghost footprint"],
              ] as const).map(([k, c, d]) => (
                <div key={k} className="border border-line bg-void/50 p-2 text-center">
                  <div className="mono text-[9px] font-bold" style={{ color: c }}>{k}</div>
                  <div className="mono mt-1 text-[8.5px] text-dim">{d}</div>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[12px] leading-relaxed text-dim">
              The mining ring doubles as the progress indicator — a separate progress bar would
              pull the eye off the thing being mined. Raycast is a dot-product cone test at 0.965,
              about 3°, which is tight enough to feel precise and loose enough to forgive.
            </p>
          </Panel>
          <Panel label="HOTBAR" accent="#b46bff">
            <p className="text-[12.5px] leading-relaxed text-dim">
              Eight slots, live colour tints pulled from the cartridge's own{" "}
              <code className="mono text-chalk">tint</code> field, and a cost pip that turns into a
              tick the moment you can afford the thing. The selected slot scales to 110% rather
              than changing colour, because colour already means "which cartridge".
            </p>
          </Panel>
        </div>
      </section>

      {/* ── NET ────────────────────────────────────────────────────── */}
      <section id="p6-net" className="mx-auto max-w-[1400px] px-4 py-16 sm:px-8">
        <SectionHead n="6.3" kicker="Deliverable 4" title="Co-op Rollback Command Bus"
          lede="Two peers on a virtual network with configurable latency, jitter and packet loss — running the real NetBus, the real binary codec and the real rollback path. Crank the sliders and watch the hashes reconcile." />
        <NetLab />
      </section>

      {/* ── SOURCE ─────────────────────────────────────────────────── */}
      <section id="p6-source" className="mx-auto max-w-[1400px] px-4 py-16 sm:px-8">
        <SectionHead n="6.4" kicker="Paste-ready" title="The Source" />
        <div className="fi-panel border border-line bg-panel">
          <div className="flex flex-wrap items-center gap-1 border-b border-line bg-panel2 p-2">
            {files.map((x, k) => (
              <button key={x.p} onClick={() => setFile(k)}
                className={cn("mono border px-2 py-1 text-[9px]",
                  file === k ? "border-transparent bg-chalk text-void" : "border-line text-dim hover:text-chalk")}>
                {x.p.split("/").slice(-1)[0]}
              </button>
            ))}
            <span className="mono ml-auto text-[9px] text-dim">
              {f.s.split("\n").length} lines · {(f.s.length / 1024).toFixed(1)} kB
            </span>
          </div>
          <div className="border-b border-line bg-void2 px-3 py-2">
            <div className="mono text-[10.5px] font-bold text-chalk">{f.p}</div>
            <p className="mt-1 text-[11.5px] leading-snug text-dim">{f.n}</p>
          </div>
          <div className="max-h-[520px] overflow-auto bg-void">
            <pre className="mono p-3 text-[10.5px] leading-[1.55]">
              <code dangerouslySetInnerHTML={{ __html: highlight(f.s) }} />
            </pre>
          </div>
        </div>

        <div className="fi-panel relative mt-10 overflow-hidden border border-line bg-panel p-6 sm:p-10">
          <div className="pointer-events-none absolute inset-0 bg-grid opacity-50" />
          <div className="pointer-events-none absolute inset-0"
            style={{ background: "radial-gradient(ellipse at 20% 0%, var(--fi-accent-soft), transparent 60%)" }} />
          <div className="relative">
            <div className="mono text-[10px] tracking-[0.3em] text-dim uppercase">Six phases, one bet</div>
            <p className="text-balance mt-3 max-w-4xl text-xl leading-snug font-light sm:text-3xl">
              Every system across all six phases — the wave, the mesher, the shader, the audio,
              the avatar, the factory, the federation, the quest — reads{" "}
              <span className="fi-accent-text font-black">the same four floats</span>. That was the
              bet in Section 1 of the design document, and nothing since has needed a fifth.
            </p>
            <p className="mt-4 max-w-3xl text-[13px] leading-relaxed text-dim">
              What is above is not a prototype of SetMix. It is SetMix, at Stage 1, running in a
              browser tab with no engine, no asset pipeline and no server — which was always the
              point. A planet is a number somebody chose, and you can walk around inside it.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
