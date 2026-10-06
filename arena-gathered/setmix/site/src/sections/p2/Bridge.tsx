import { useMemo, useState } from "react";
import { Panel, SectionHead, Tag, Formula, KV } from "@/components/ui";
import TexCanvas from "@/components/TexCanvas";
import { LIBRARY, BY_ID, BLURBS } from "@/engine/setmix/library";
import {
  deriveBudget,
  toEvaluateOptions,
  adaptGraph,
  DEVICES,
  type FidelityState,
} from "@/engine/setmix/core";
import { graphCost } from "@/engine/texgraph";
import { cn } from "@/utils/cn";

/** Six canonical planet states, one per stage, used to prove that the same
 *  bundle renders correctly at every rung of the ladder. */
const STAGE_STATES: FidelityState[] = [
  { pxd: 4.0e2, vtx: 2.0e2, lx: 4.0e1, aq: 1.0e0, tick: 0 },
  { pxd: 2.6e4, vtx: 1.1e4, lx: 6.0e3, aq: 4.0e1, tick: 0 },
  { pxd: 9.0e5, vtx: 7.0e5, lx: 3.4e5, aq: 1.2e4, tick: 0 },
  { pxd: 7.0e6, vtx: 5.2e6, lx: 3.0e6, aq: 1.6e6, tick: 0 },
  { pxd: 3.4e7, vtx: 2.6e7, lx: 1.8e7, aq: 9.0e6, tick: 0 },
  { pxd: 1.24e8, vtx: 9.4e7, lx: 6.6e7, aq: 4.1e7, tick: 0 },
];

export default function Bridge() {
  const [cartId, setCartId] = useState("moon_regolith");
  const [devId, setDevId] = useState("ultra");
  const [seed, setSeed] = useState(7);
  const cart = BY_ID.get(cartId)!;
  const dev = DEVICES.find((d) => d.id === devId)!;

  const rungs = useMemo(
    () =>
      STAGE_STATES.map((st) => {
        const b = deriveBudget(st, dev);
        const g = adaptGraph(cart.graph, b);
        const o = toEvaluateOptions(b, seed);
        return { b, g, o, cost: graphCost(g, b.size) };
      }),
    [cart, dev, seed],
  );

  return (
    <section id="p2-bridge" className="mx-auto max-w-[1400px] px-4 py-16 sm:px-8">
      <SectionHead
        n="2.1"
        kicker="The Bridge"
        title="deriveBudget() — one function, the whole thesis"
        lede="Terraforming does not swap assets. It changes four scalars, those scalars become an EvaluateOptions, and @hm/texgraph evaluates the SAME DAG at a different resolution, octave budget and relief. Below is one cartridge, six planetary states, zero extra content."
      />

      <div className="mb-3 grid gap-3 lg:grid-cols-[1.15fr_1fr]">
        <Panel label="packages/setmix-governor/src/derive.ts" accent="#7cff4d">
          <Formula>{`export function deriveBudget(s: FidelityState, dev: DeviceProfile): RenderBudget {
  const n = normalised(s);                       // 0..1 per metric

  size         = TEXEL_LADDER[round(n.pxd * 5)]  // Pxd → 16|32|64|128|256|512
  octaveBudget = 1 + floor(n.pxd * 5)            // Pxd → fBm octaves
  relief       = 0.15 + n.vtx * 1.55             // Vtx → normal strength
  normal       = n.lx > 0.18                     // Lx  → shading model
  cascades     = floor(n.lx * 5)                 // Lx  → shadow maps
  wetness      = (n.aq - 0.12) / 0.88            // Aq  → wetness mask
  → clamp every field by DeviceProfile, log demotions
}

toEvaluateOptions(b, seed) → { size, seed, relief, normal }`}</Formula>
          <p className="mt-3 text-[12.5px] leading-relaxed text-dim">
            This is the only place in the codebase where gameplay state touches render state.
            Everything upstream is pure simulation; everything downstream is pure texgraph. The
            seam is 40 lines and it is testable with a table of inputs.
          </p>
        </Panel>

        <div className="space-y-3">
          <Panel label="CARTRIDGE UNDER TEST" accent={cart.tint}>
            <div className="flex flex-wrap gap-1.5">
              {LIBRARY.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setCartId(c.id)}
                  className={cn(
                    "mono border px-2 py-1 text-[9.5px] transition-colors",
                    cartId === c.id ? "text-void" : "text-dim hover:text-chalk",
                  )}
                  style={
                    cartId === c.id
                      ? { background: c.tint, borderColor: c.tint }
                      : { borderColor: c.tint + "55" }
                  }
                >
                  {c.name}
                </button>
              ))}
            </div>
            <p className="mt-3 text-[12.5px] leading-relaxed text-chalk/85">{BLURBS[cart.id]}</p>
            <div className="mt-2 flex flex-wrap gap-1">
              <Tag color={cart.tint} solid>
                {cart.cls}
              </Tag>
              <Tag color={cart.tint}>minStage S{cart.minStage}</Tag>
              <Tag>{cart.graph.nodes.length} nodes</Tag>
              <Tag>{cart.hash}</Tag>
            </div>
          </Panel>
          <Panel label="DEVICE PROFILE (clamps, never gates gameplay)" accent="#ffc13d">
            <div className="grid grid-cols-2 gap-1.5">
              {DEVICES.map((d) => (
                <button
                  key={d.id}
                  onClick={() => setDevId(d.id)}
                  className={cn(
                    "mono border px-2 py-1.5 text-left text-[9.5px] transition-colors",
                    devId === d.id
                      ? "border-transparent bg-chalk text-void"
                      : "border-line text-dim hover:text-chalk",
                  )}
                >
                  <span className="block font-bold">{d.label}</span>
                  <span className="opacity-70">
                    ≤{d.maxTexel}px · {d.maxOctaves} oct
                  </span>
                </button>
              ))}
            </div>
            <div className="mt-3">
              <div className="mono mb-1 flex justify-between text-[10px] text-dim">
                <span>Injected seed (determinism)</span>
                <span className="tnum text-chalk">{seed}</span>
              </div>
              <input
                type="range"
                min={0}
                max={64}
                step={1}
                value={seed}
                onChange={(e) => setSeed(+e.target.value)}
                className="w-full"
              />
            </div>
          </Panel>
        </div>
      </div>

      {/* THE LADDER */}
      <Panel
        label="THE SAME BUNDLE AT ALL SIX STAGES · live @hm/texgraph output"
        accent="var(--fi-accent)"
        flush
      >
        <div className="grid grid-cols-2 gap-px bg-line sm:grid-cols-3 lg:grid-cols-6">
          {rungs.map((r, i) => (
            <div key={i} className="bg-panel p-2">
              <div className="mono mb-1 flex items-center justify-between text-[9px]">
                <span className="fi-accent-text font-bold">S{r.b.stage}</span>
                <span className="tnum text-dim">{r.b.size}px</span>
              </div>
              <div className="relative border border-line bg-void">
                <TexCanvas graph={r.g} opts={r.o} channel="lit" smooth={false} />
              </div>
              <div className="mono mt-1.5 space-y-[2px] text-[8.5px] leading-tight text-dim">
                <div className="flex justify-between">
                  <span>oct</span>
                  <span className="tnum text-chalk">{r.b.octaveBudget}</span>
                </div>
                <div className="flex justify-between">
                  <span>relief</span>
                  <span className="tnum text-chalk">{r.b.relief.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>normal</span>
                  <span className={r.b.normal ? "text-vtx" : "text-dim/60"}>
                    {r.b.normal ? "on" : "off"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>wet</span>
                  <span className="tnum text-aq">{r.b.wetness.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>nodes</span>
                  <span className="tnum text-chalk">{r.g.nodes.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>eval</span>
                  <span className="tnum text-lx">{r.cost.evalMs.toFixed(2)}ms</span>
                </div>
              </div>
              {r.b.demoted.length > 0 && (
                <div className="mono mt-1 border-t border-line pt-1 text-[8px] leading-tight text-pxd">
                  {r.b.demoted.map((d) => (
                    <div key={d}>▼ {d}</div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </Panel>

      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <Panel label="adaptGraph() · what changed at S1 vs S6" accent="#b46bff">
          <p className="text-[12.5px] leading-relaxed text-dim">
            The rewriter clamps every <code className="mono text-chalk">noise.octaves</code> to the
            budget, substitutes a 2-octave noise for <code className="mono text-chalk">cellular</code>{" "}
            when the texel count is too low to resolve cells, bypasses{" "}
            <code className="mono text-chalk">warp</code> nodes by re-pointing their consumers at
            their input, and — above Aq 0.12 — injects a three-node wetness pass into every albedo
            on the planet.
          </p>
          <div className="mt-3 space-y-0">
            <KV k="S1 node count" v={rungs[0].g.nodes.length} />
            <KV k="S6 node count" v={rungs[5].g.nodes.length} color="var(--fi-accent)" />
            <KV k="S1 texels" v={rungs[0].b.size ** 2} />
            <KV k="S6 texels" v={rungs[5].b.size ** 2} color="var(--fi-accent)" />
            <KV
              k="Texel growth"
              v={`${((rungs[5].b.size ** 2 / rungs[0].b.size ** 2) | 0)}×`}
              color="#ff3d8a"
            />
            <KV k="Bundle bytes on disk" v="unchanged" color="#7cff4d" />
          </div>
        </Panel>

        <Panel label="CHANNEL BREAKOUT @ S6 · what the DAG actually emits" accent="#3dc8ff">
          <div className="grid grid-cols-2 gap-2">
            {(["albedo", "height", "roughness", "normal"] as const).map((ch) => (
              <div key={ch}>
                <div className="mono mb-1 text-[9px] tracking-[0.15em] text-dim uppercase">
                  {ch}
                </div>
                <div className="border border-line">
                  <TexCanvas graph={rungs[5].g} opts={rungs[5].o} channel={ch} />
                </div>
              </div>
            ))}
          </div>
          <p className="mono mt-2 text-[10px] leading-snug text-dim">
            Float32 → <code className="text-chalk">tileBytes()</code> → RGB8 colour + RGBA8 maps
            (h, rough, nx, ny). One upload, two textures, zero image files in the repo.
          </p>
        </Panel>

        <Panel label="WHY THIS SOLVES THE PERFORMANCE PARADOX" accent="#7cff4d">
          <p className="text-[12.5px] leading-relaxed text-dim">
            The save file is four floats plus a preset graph. Fidelity is{" "}
            <strong className="text-chalk">interpreted at read time</strong>, per device, which
            means the mobile profile above is playing the identical campaign at identical
            progression with a 64-texel ceiling. Nothing is locked; the demotion list is visible
            and the player can pin any item.
          </p>
          <div className="mono mt-3 border-t border-line pt-2 text-[11px] leading-relaxed text-chalk/80">
            Switch the device selector to <strong>Mobile / RUN web</strong> and watch the S5–S6
            tiles demote in real time — warp culled, cellular substituted, normals off — while the
            stage number, the unlocks and the simulation stay exactly where they were.
          </div>
        </Panel>
      </div>
    </section>
  );
}
