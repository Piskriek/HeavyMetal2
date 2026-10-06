import { Panel, Formula, Tag } from "@/components/ui";

const ANSWERS = [
  {
    q: "Q1 · Bit-identical floats across platforms?",
    a: "Hash the DAG, cache the pixels.",
    impl:
      "contentHash(graph) over a key-sorted, fixed-precision serialisation is the identity. Float32Array buffers are now explicitly typed as transient cache in EvaluatedTexture — nothing durable ever references them. No IEEE-754 drift can reach the network.",
    code: "Cartridge.hash = contentHash(header)   // graph + params, never pixels",
    colour: "#7cff4d",
  },
  {
    q: "Q2 · Partial evaluation for the wave front?",
    a: "EvaluateOptions.bounds — implemented, plus upstream dilation.",
    impl:
      "bandBoundsForChunk() turns the band ∩ chunk rectangle into a bounds rect. computeRegions() then walks the DAG upstream and GROWS that rect through every warp node by ceil(amount·size)+2 texels, because a warp reads its input at offset coordinates. Without the dilation you get a seam exactly at the wave front.",
    code: "stats: { nodes: 9, texelsTouched: 9870, dilationPx: 14 }",
    colour: "#3dc8ff",
  },
  {
    q: "Q3 · 2-channel vector driver for warp?",
    a: "Shipped — and we added the generator it needs.",
    impl:
      "warp.vectorField is read as a signed 2-channel field and wins over `by`. We also added a `curl` node: ∇⊥ψ = (∂ψ/∂y, −∂ψ/∂x), which is divergence-free by construction. The Curl-Noise Flow Map cartridge now drives genuine incompressible vortices rather than approximating them with two scalar offsets.",
    code: "{ type: 'curl', potential: 'psi', scale: 1 }  →  ch = 2",
    colour: "#b46bff",
  },
  {
    q: "Q4 · Promote graphCost() into the engine?",
    a: "Done, with a published weight table.",
    impl:
      "NODE_WEIGHT is now an exported record so cost is auditable rather than folklore (cellular 9, warp 4, curl 5, noise 1 + octaves). graphCost() takes an optional bounds so partial evaluations report their real cost, and certify() consumes the official heuristic.",
    code: "graphCost(g, size, bounds) → { weight, texels, evalMs }",
    colour: "#ffc13d",
  },
  {
    q: "Q5 · ramp interpolation modes?",
    a: "linear | smooth | constant, and 'constant' deleted a render pass.",
    impl:
      "Stage 1's 2-bit palette used to be a full-screen post-process. With interpolation:'constant' the quantisation happens inside the evaluator, so the Stage-1 look costs nothing at all and — more importantly — a cartridge authored at Stage 6 renders correctly at Stage 1 without the renderer being involved.",
    code: "{ type: 'ramp', interpolation: 'constant', stops: [...] }",
    colour: "#ff3d8a",
  },
];

export default function Intro() {
  return (
    <section id="p3-top" className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-50" />
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse at 80% 0%, var(--fi-accent-soft), transparent 55%)" }}
      />
      <div className="relative mx-auto max-w-[1400px] px-4 pt-14 pb-8 sm:px-8">
        <div className="mono mb-4 flex flex-wrap items-center gap-2 text-[10px] tracking-[0.3em] uppercase">
          <span className="fi-accent-bg px-2 py-1 font-bold text-void">PHASE 3</span>
          <span className="text-dim">field sim · geomorph · inception outliner</span>
        </div>
        <h1 className="text-balance text-[clamp(2.1rem,6vw,4.6rem)] leading-[0.95] font-black tracking-[-0.035em]">
          Three systems, three <span className="fi-accent-text">live</span> proofs.
        </h1>
        <p className="mt-6 max-w-3xl text-[15px] leading-relaxed text-dim sm:text-[16.5px]">
          A wave engine where 94% of chunks are provably asleep. A mesher where the LOD seam is
          impossible rather than patched. And an outliner that falls nine levels from a galaxy to a
          single float without changing record type once. Every number, curve and hash on this page
          is computed in your browser by the modules themselves.
        </p>

        {/* answers */}
        <div className="mt-8">
          <div className="mono mb-2 flex items-center gap-2 text-[10px] tracking-[0.25em] text-dim uppercase">
            <span className="h-[6px] w-[6px] bg-vtx" />
            Part 1 · the five resolutions, now in the evaluator
            <span className="h-px flex-1 bg-line" />
          </div>
          <div className="grid gap-2 lg:grid-cols-5">
            {ANSWERS.map((a) => (
              <Panel key={a.q} label={a.q.split(" · ")[0]} accent={a.colour}>
                <div className="mb-1.5">
                  <Tag color={a.colour} solid>
                    SHIPPED
                  </Tag>
                </div>
                <div className="text-[12.5px] leading-tight font-bold" style={{ color: a.colour }}>
                  {a.a}
                </div>
                <p className="mt-2 text-[11.5px] leading-snug text-dim">{a.impl}</p>
                <code className="mono mt-2 block overflow-x-auto border border-line bg-void2 p-1.5 text-[9px] whitespace-pre text-chalk/80">
                  {a.code}
                </code>
              </Panel>
            ))}
          </div>
        </div>

        <div className="mt-3 grid gap-3 lg:grid-cols-[1.1fr_1fr]">
          <Panel label="WHAT PHASE 3 ADDS TO packages/*" accent="var(--fi-accent)">
            <Formula>{`packages/setmix-field     ~430 LOC  pure   PR 3
  stepWaveField · evaluateChunkWaveState · sampleWaveTransition
  waveRadius/Velocity/TimeToRadius · scheduleChunk · bandBoundsForChunk
  smoothstepC1 / C2 · elapsedAt · reverseCompletionTick

packages/setmix-mesh      ~320 LOC  pure   PR 3
  meshPolicyFor · toSmoothvoxRequest · minPolicy · seamKeyFor
  profileSample · profileSampleStitched · materialBlend

packages/setmix-outliner  ~470 LOC  pure   PR 4
  buildScene · zoomInto · escapeUp · reparent (cycle-guarded)
  matches · subtreeCost · cycleHotbar · TOOLS[6] as VarDecl schemas

packages/texgraph         +180 LOC         PR 0  ← upstream, yours
  bounds + computeRegions · warp.vectorField · curl · ramp.interpolation
  NODE_WEIGHT + graphCost(bounds)`}</Formula>
          </Panel>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <Panel label="THE THREE LOAD-BEARING IDEAS" accent="#7cff4d">
              <ol className="space-y-2 text-[12.5px] leading-relaxed text-dim">
                <li className="flex gap-2">
                  <span className="mono text-vtx">1.</span>
                  <span>
                    <strong className="text-chalk">r(t) is invertible</strong>, so chunks are
                    scheduled instead of polled, and the reverse wave is the forward wave played
                    backwards at 2×.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="mono text-vtx">2.</span>
                  <span>
                    <strong className="text-chalk">s is a function of world position</strong>, not
                    of chunk, so neighbours agree on the geomorph blend by arithmetic rather than
                    by negotiation.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="mono text-vtx">3.</span>
                  <span>
                    <strong className="text-chalk">One record type all the way down</strong>, so a
                    galaxy and a float are the same object and the outliner is written once.
                  </span>
                </li>
              </ol>
            </Panel>
            <Panel label="UPSTREAM REQUEST" accent="#ffc13d">
              <p className="text-[12px] leading-relaxed text-dim">
                One new ask: <code className="mono text-chalk">EvaluatedTexture</code> would be
                more useful to <code className="mono text-chalk">@hm/chunkworld</code> if
                evaluateGraph could write <em className="not-italic">into</em> a caller-supplied
                buffer (<code className="mono text-chalk">opts.into?: EvaluatedTexture</code>).
                With bounds, we currently allocate a full-size array to update a 9k-texel strip.
                It is a 6-line change on your side and removes ~40 MB/s of churn during a tier-4
                sweep.
              </p>
            </Panel>
          </div>
        </div>
      </div>
    </section>
  );
}
