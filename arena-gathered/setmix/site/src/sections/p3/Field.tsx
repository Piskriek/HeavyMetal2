import { Panel, SectionHead, Formula, Tag, KV } from "@/components/ui";
import WaveSim from "@/components/WaveSim";
import { ANTIPOP } from "@/engine/setmix/field";

const STATES = [
  ["DORMANT", "#2a3242", "r + 3Δr < d − radius", "Not scheduled. Not evaluated. Not in any list. The chunk does not exist as far as the wave is concerned."],
  ["APPROACHING", "#ffc13d", "r + 3Δr ≥ d − radius", "Woken by the scheduler. Pre-fetches H_next from texgraph with a band-limited bounds rect, warms the material page, reserves a mesh buffer."],
  ["INSIDE_BAND", "#ffffff", "|d − r| < Δr + radius", "The only state that costs anything per tick. Re-meshes, geomorphs, cross-fades materials, spawns props on the blue-noise schedule."],
  ["STABILIZED", "#7cff4d", "r ≥ d + radius + Δr", "Committed. H_next is now H. The chunk unsubscribes, frees the old buffer, and goes back to costing zero."],
];

export default function Field() {
  return (
    <section id="p3-field" className="mx-auto max-w-[1400px] px-4 py-16 sm:px-8">
      <SectionHead
        n="3.1"
        kicker="@hm/setmix-field"
        title="The Terraform Wave Engine"
        lede="A planet-scale effect that costs nothing when nothing is happening. The radius function is analytic and strictly monotone, therefore invertible — so a chunk is told exactly which tick to wake up on and then sleeps. Work is proportional to the band's circumference, never to the planet's area."
      />

      <WaveSim />

      <div className="mt-3 grid gap-3 lg:grid-cols-[1.08fr_1fr]">
        <Panel label="RADIAL SHOCKWAVE MATHS" accent="#7cff4d">
          <Formula label="propagation">{`R_max = 180 m · tier · (1 + bandwidth/64)
τ     = 90 s · cartridgeComplexity

r(t)  = ∫₀ᵗ v(τ)dτ  =  R_max · (1 − e^(−t/τ))        [closed form]
v(t)  = dr/dt       =  (R_max/τ) · e^(−t/τ)
                    =  (R_max − r) / τ                [velocity from radius]
Δr(t) = clamp(8 + 1.9·v(t), 8, 14) m                  [shell thickness]`}</Formula>
          <Formula label="THE INVERSE — why chunks can sleep">{`t(r)  = −τ · ln(1 − r/R_max)

scheduleChunk(chunk, src):
  near = ‖chunk.centre − src.pos‖ − chunk.radius
  if near ≥ R_max          → unreachable, never schedule
  tEnter = src.startedAt + t(near − Δr(t(near))) · 120     // 1 fixed-point pass
  tExit  = src.startedAt + t(far) · 120
  push(wakeQueue, { tick: tEnter, chunkId, sourceId })`}</Formula>
          <p className="mt-3 text-[12.5px] leading-relaxed text-dim">
            A 100,000-chunk moon with 40 live spires schedules 4 M entries <em className="not-italic text-chalk">once</em>,
            at O(1) each, and then the per-tick cost is the length of the wake queue's head plus
            the active set — an annulus. In the simulator above, watch the "% asleep" readout: it
            never drops below ~94% even at full tier-4 expansion.
          </p>
        </Panel>

        <div className="space-y-3">
          <Panel label="CHUNK STATE MACHINE" accent="#ffc13d" flush>
            <div className="divide-y divide-line/60">
              {STATES.map(([k, c, cond, d]) => (
                <div key={k} className="p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="h-2.5 w-2.5 shrink-0" style={{ background: c }} />
                    <span className="mono text-[11px] font-bold" style={{ color: c }}>{k}</span>
                    <code className="mono text-[9.5px] text-dim">{cond}</code>
                  </div>
                  <p className="mt-1 text-[11.5px] leading-snug text-dim">{d}</p>
                </div>
              ))}
            </div>
            <div className="border-t border-line p-3">
              <p className="mono text-[10.5px] leading-snug text-chalk/80">
                A 1.5 m hysteresis band on the INSIDE_BAND entry test prevents a chunk whose
                centre sits exactly on a threshold from flapping between states on consecutive
                ticks — which would otherwise re-upload its mesh 120 times a second.
              </p>
            </div>
          </Panel>

          <Panel label="THE C¹ GEOMORPH" accent="#3dc8ff">
            <Formula>{`S(u)   = u²(3 − 2u)          S(0)=0  S(1)=1  S′(0)=S′(1)=0
H(x,z,t) = lerp(H_prev, H_next, S((r − d)/Δr))`}</Formula>
            <p className="mt-3 text-[12.5px] leading-relaxed text-dim">
              The zero end-derivatives are the entire point. Terrain <em className="not-italic text-chalk">velocity</em> is
              continuous at both ends of the morph, so nothing ever appears to start or stop
              moving — the ground swells and settles. A linear blend would be C⁰ and would visibly
              "click" into place at both ends; players read that as a pop even though no vertex
              jumped.
            </p>
            <p className="mt-2 text-[12.5px] leading-relaxed text-dim">
              A C² variant (<code className="mono text-chalk">smoothstepC2</code>, the 6t⁵−15t⁴+10t³
              quintic) is used for tall silhouettes — masts, spires, trees — where curvature
              discontinuity is visible against the sky. It costs one extra multiply per vertex.
            </p>
          </Panel>
        </div>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <Panel label="THE REVERSE WAVE" accent="#ff3d8a">
          <Formula>{`onReverse(s, tick):
  s.reversedElapsed = elapsedAt(s, tick)   // freeze
  s.reversedAt      = tick
  s.dir             = −1

elapsedAt(s, t) =
  dir = +1 → (t − startedAt)/120
  dir = −1 → max(0, reversedElapsed − 2·(t − reversedAt)/120)`}</Formula>
          <p className="mt-3 text-[12.5px] leading-relaxed text-dim">
            The recede does not run a second, different animation. It{" "}
            <strong className="text-chalk">replays the identical r(·) curve backwards at twice the
            time rate.</strong> That single decision buys three guarantees for free: every chunk is
            visited in the exact reverse order it was swept; the band thickness at any radius is
            identical going out and coming back; and the restore is provably complete, because
            r = 0 is reached in exactly half the elapsed time.
          </p>
          <div className="mt-3 space-y-0">
            <KV k="journal replay" v="reverse-ordered settle entries" />
            <KV k="restore source" v="cached H_prev + prevHash" color="#ff3d8a" />
            <KV k="cache window" v="10 real minutes" />
            <KV k="cost" v="identical to the forward sweep" color="#7cff4d" />
          </div>
        </Panel>

        <Panel label="PARTIAL EVALUATION (Q2, SHIPPED)" accent="#b46bff">
          <Formula>{`bandBoundsForChunk(chunk, src, tick, 32m, 256px)
  → { x0: 118, y0: 0, x1: 256, y1: 141 }

evaluateGraph(graph, { size: 256, bounds })
  → stats.texelsTouched  9,870  (vs 65,536)
  → stats.dilationPx        14  (warp apron, auto)`}</Formula>
          <p className="mt-3 text-[12.5px] leading-relaxed text-dim">
            The band ∩ chunk rectangle goes straight into the new{" "}
            <code className="mono text-chalk">EvaluateOptions.bounds</code>. Crucially, our
            implementation <strong className="text-chalk">dilates the requested region as it walks
            upstream through every warp node</strong> — a warp reads its input at offset
            coordinates, so a naïve bounds rect produces a visible seam exactly at the wave front,
            which is the worst possible place for one. The dilation is computed from each warp's
            own <code className="mono text-chalk">amount</code> and reported back in{" "}
            <code className="mono text-chalk">stats.dilationPx</code>.
          </p>
        </Panel>

        <Panel label="THE 4-PHASE ANTI-POP CONTRACT" accent="var(--fi-accent)" flush>
          <div className="divide-y divide-line/60">
            {ANTIPOP.map((p) => (
              <div key={p.phase} className="p-3">
                <div className="mono flex items-baseline justify-between gap-2 text-[10px]">
                  <span className="fi-accent-text font-bold">{p.phase}</span>
                  <Tag>{p.window}</Tag>
                </div>
                <code className="mono mt-1 block text-[10px] leading-snug text-chalk/85">
                  {p.mech}
                </code>
                <p className="mt-1 text-[11px] leading-snug text-dim">{p.why}</p>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="mt-3">
        <Panel label="MODULE SURFACE · packages/setmix-field/src/index.ts" accent="#7cff4d">
          <Formula>{`// kinematics — all pure, all closed-form
waveRMax(s)                      waveTau(s)
waveRadius(elapsedSec, s)        waveVelocity(elapsedSec, s)
waveTimeToRadius(r, s)           bandThickness(elapsedSec, s)
elapsedAt(s, tick)               reverseCompletionTick(s)

// interpolation
smoothstepC1(u)                  smoothstepC2(u)

// the three the brief asked for
stepWaveField(field, { chunks, dispatch, reverse, ticks })  → WaveFieldState
evaluateChunkWaveState(chunk, sources, tick, prev?)         → ChunkWaveSample
sampleWaveTransition(p, sources, tick)                      → { s, dominant, weights, alphaHashThreshold, inBand }

// scheduling + the texgraph bridge
scheduleChunk(chunk, src)                                   → ChunkSchedule
bandBoundsForChunk(chunk, src, tick, chunkSize, texSize)    → Bounds | null`}</Formula>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div>
              <div className="mono text-[9px] tracking-[0.2em] text-dim uppercase">Purity</div>
              <p className="mt-1 text-[11.5px] leading-snug text-dim">
                No Date.now, no Math.random, no allocation in the per-tick path beyond the returned
                state. Same inputs ⇒ same journal, byte for byte.
              </p>
            </div>
            <div>
              <div className="mono text-[9px] tracking-[0.2em] text-dim uppercase">Overlap</div>
              <p className="mt-1 text-[11.5px] leading-snug text-dim">
                Multiple spires blend by softmax over influence × falloff × dominance. Within ~20 m
                of equal weight you get a genuine ecotone, and the Variety bonus rewards it.
              </p>
            </div>
            <div>
              <div className="mono text-[9px] tracking-[0.2em] text-dim uppercase">Tests</div>
              <p className="mt-1 text-[11.5px] leading-snug text-dim">
                Golden journals for 64 seeds; an invariant asserting r(t(r)) = r to 1e-9; and a
                reverse-completeness test that every settled chunk is restored.
              </p>
            </div>
          </div>
        </Panel>
      </div>
    </section>
  );
}
