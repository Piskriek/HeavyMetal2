import { Panel } from "@/components/ui";

const MAP = [
  ["HeavyMetal2 kernel", "SetMix equivalent", "Why it is a perfect fit", "#7cff4d"],
];

const ROWS: [string, string, string][] = [
  [
    "One node type: Preset. Immutable revisions, copy-on-write forks, content hashes.",
    "The Cartridge. A palm-sized punchcard with a live 3-D thumbnail.",
    "The GDD already said presets materialise as physical objects with version stacking and a 20% re-print cost. Those are immutable revisions and a content-hash cache described in prop-design language.",
  ],
  [
    "Every parameter is a Variable with a path, range, unit and one-sentence explanation. UIs are generated from schemas.",
    "The Material Synthesizer's knobs — and Jargon Mode.",
    "We add exactly one field to VarDecl (`real`) and the entire pedagogical thesis of GDD §5 falls out of the existing contract. No translation table, no per-machine UI code.",
  ],
  [
    "Three depths: play (a 6-year-old picks cards and paints), build (sliders, snapping), pro (every variable, the graph, the source).",
    "Play Mode · Studio Mode · the Outliner's PRO tier.",
    "The GDD's two modes were always three depths of one tool. Slotting a cartridge IS picking a card. The 90/10 split is literally the tier filter on VarDecl.",
  ],
  [
    "Source is a tier, not a different tool: a preset may carry a TypeScript script in a deterministic sandbox.",
    "Behaviour cartridges: Kinematic Spring Rig, L-System Growth, Resonant Frequency Rig.",
    "@hm/script is how a VERB cartridge carries behaviour rather than just a texture. The Bouncing Hazard Geyser is a TexGraph plus twelve lines of sandboxed script.",
  ],
  [
    "All edits are Commands (undo/redo, replay, later multiplayer editing).",
    "Slot, fuse, tune, print, place, overclock.",
    "\"Pull the cartridge and the terraform wave recedes at 2× speed\" stops being special-case code and becomes the generic undo path. Co-op terraforming arrives for free later.",
  ],
  [
    "Deterministic by construction: 120 Hz fixed step, injected time and randomness. A session is (preset bundle, seed, input stream).",
    "The four metrics integrated at 120 Hz; offline progression replayed as a cinematic.",
    "stepFidelity() is pure. Two players with the same emitters and seed get byte-identical planets, which is also what makes Galaxy sharing trustworthy.",
  ],
  [
    "Packages talk only through contracts.",
    "setmix-governor is the single seam between simulation and rendering.",
    "Gameplay state never imports a renderer. deriveBudget() is 40 lines and is the only place the two worlds touch.",
  ],
  [
    "Static and RUN-native: no server of our own. apps/web builds to ONE static html file.",
    "No image assets. Ever.",
    "Terraforming-as-resolution is only affordable because materials are math. A 4 km² biome is 900 bytes of graph, which is the only reason a planet fits in a single HTML file.",
  ],
  [
    "First game: a goblin ball-racing game on a volcanic island.",
    "The low-poly goblin astronaut and the Scrap Strider.",
    "Same avatar rig, same content universe. A chassis authored for the racer is a vehicle preset in SetMix, and a SetMix biome is a track surface. One kernel, two games, shared library.",
  ],
];

export default function Intro() {
  return (
    <section id="p2-top" className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-50" />
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse at 15% 0%, var(--fi-accent-soft), transparent 55%)" }}
      />
      <div className="relative mx-auto max-w-[1400px] px-4 pt-14 pb-8 sm:px-8">
        <div className="mono mb-4 flex flex-wrap items-center gap-2 text-[10px] tracking-[0.3em] uppercase">
          <span className="fi-accent-bg px-2 py-1 font-bold text-void">PHASE 2</span>
          <span className="text-dim">Piskriek/HeavyMetal2 · codebase integration</span>
        </div>
        <h1 className="text-balance text-[clamp(2.2rem,6.5vw,5rem)] leading-[0.92] font-black tracking-[-0.035em]">
          SetMix is not a game <span className="fi-accent-text">built on</span> the harness.
          <br />
          It is the harness, <span className="fi-accent-text">played</span>.
        </h1>
        <p className="mt-6 max-w-3xl text-[15px] leading-relaxed text-dim sm:text-[17px]">
          HeavyMetal2 says everything is a preset, every parameter is a variable with a
          one-sentence explanation, and the same project opens at three depths. SetMix's entire
          premise — that terraforming means raising render fidelity, and that players author the
          maths that does it — is the most literal possible expression of that idea. The mapping
          below is not an adaptation. It is a recognition.
        </p>

        <div className="fi-panel mt-8 overflow-hidden border border-line bg-panel">
          <div className="mono grid grid-cols-1 gap-px border-b border-line bg-line sm:grid-cols-[1fr_0.8fr_1.2fr]">
            {MAP[0].slice(0, 3).map((h) => (
              <div key={h} className="bg-panel2 px-3 py-2 text-[9px] tracking-[0.2em] text-dim uppercase">
                {h}
              </div>
            ))}
          </div>
          <div className="divide-y divide-line/60">
            {ROWS.map((r, i) => (
              <div key={i} className="grid gap-2 p-3 sm:grid-cols-[1fr_0.8fr_1.2fr] sm:gap-4">
                <div className="mono text-[11.5px] leading-snug text-chalk/75">{r[0]}</div>
                <div className="fi-accent-text text-[13px] leading-tight font-bold">{r[1]}</div>
                <div className="text-[12px] leading-relaxed text-dim">{r[2]}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-3 grid gap-3 lg:grid-cols-3">
          <Panel label="THE ONE-LINE SUMMARY" accent="var(--fi-accent)">
            <p className="text-[13.5px] leading-relaxed text-chalk/90">
              <code className="mono text-chalk">FidelityState</code> →{" "}
              <code className="mono text-chalk">deriveBudget()</code> →{" "}
              <code className="mono text-chalk">EvaluateOptions</code> →{" "}
              <code className="mono text-chalk">@hm/texgraph</code>.
              <br />
              <br />
              Four floats decide a texel count, an octave budget, a relief scale and a shading
              model. Everything else in the game is a consequence of those four floats.
            </p>
          </Panel>
          <Panel label="WHAT IS LIVE ON THIS PAGE" accent="#7cff4d">
            <ul className="mono space-y-1 text-[11px] text-dim">
              <li>✓ a faithful @hm/texgraph implementation (all 12 node types)</li>
              <li>✓ 12 shipping cartridges as real DAGs</li>
              <li>✓ deriveBudget / adaptGraph running per stage, per device</li>
              <li>✓ fuse() performing an actual DAG merge with new nodes</li>
              <li>✓ contentHash, certify, toBundle</li>
              <li>✓ stepFidelity integrated at 120 Hz over 4 h of game time</li>
              <li className="pt-1 text-vtx">Every texture you see below was computed in your browser, from maths, just now.</li>
            </ul>
          </Panel>
          <Panel label="WHAT IT COSTS YOU" accent="#ffc13d">
            <p className="text-[12.5px] leading-relaxed text-dim">
              One new preset kind in the schema registry, six commands on the bus, and a
              dependency on texgraph that you already own. No new infrastructure, no server, no
              asset pipeline, and no change to the single-file build. The first PR is pure
              functions and cannot break anything that exists today.
            </p>
          </Panel>
        </div>
      </div>
    </section>
  );
}
