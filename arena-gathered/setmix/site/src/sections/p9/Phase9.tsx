import { useState } from "react";
import { Panel, SectionHead, Formula, Tag } from "@/components/ui";
import { FloraDemo, FaunaDemo } from "@/components/p9/Living";
import { EnclaveDemo, FederationDemo } from "@/components/p9/World";
import { SPECIES } from "@/drop/flora";
import { FAUNA } from "@/drop/fauna";
import { cn } from "@/utils/cn";

import srcFlora from "@/drop/flora.ts?raw";
import srcFauna from "@/drop/fauna.ts?raw";
import srcEnclaves from "@/drop/enclaves.ts?raw";
import srcFederation from "@/drop/federation.ts?raw";

const FILES = [
  { path: "packages/setmix-flora/src/index.ts", src: srcFlora,
    note: "ProceduralFlora + GrassMaterial. The logistic growth curve, the parametric L-system, the GPU vertex shader that unfolds branches, the wake canvas, and the closed hydrological cycle." },
  { path: "packages/setmix-fauna/src/index.ts", src: srcFauna,
    note: "FaunaSimulation + ProceduralCreature. Lotka-Volterra on a coarse grid, Poisson-disk materialisation, boid steering with gradient ascent, and closed-form IK gaits." },
  { path: "packages/setmix-enclaves/src/index.ts", src: srcEnclaves,
    note: "InfinitePlanet + CartridgeLattice. Sector/local coordinates, floating-origin rebasing, Gaussian partition of unity, and wind-borne cross-border spores." },
  { path: "packages/setmix-federation/src/index.ts", src: srcFederation,
    note: "WorldFederation + NetBus. The continental manifest, weather as harmonics, the five-tier presence ladder, and the 120 Hz rollback bus." },
];

function highlight(src: string) {
  const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
  let out = esc(src);
  out = out.replace(/(\/\*[\s\S]*?\*\/|\/\/[^\n]*)/g, '<span class="tk-c">$1</span>');
  out = out.replace(/(&quot;|&#39;|["'`])((?:\\.|(?!\1)[^\\])*?)\1/g, '<span class="tk-s">$1$2$1</span>');
  out = out.replace(
    /\b(const|let|var|function|return|if|else|for|while|class|interface|type|export|import|from|new|extends|readonly|public|private|async|await|try|catch|throw|typeof|in|of|as|null|undefined|true|false|void|this|switch|case|break|continue|default|uniform|out|vec2|vec3|vec4|mat4|float|int|sampler2D)\b/g,
    '<span class="tk-k">$1</span>');
  out = out.replace(/\b(\d+\.?\d*(?:e[-+]?\d+)?)\b/gi, '<span class="tk-n">$1</span>');
  return out;
}

function Source() {
  const [i, setI] = useState(0);
  const f = FILES[i];
  return (
    <div className="fi-panel border border-line bg-panel">
      <div className="flex flex-wrap items-center gap-1 border-b border-line bg-panel2 p-2">
        {FILES.map((x, k) => (
          <button key={x.path} onClick={() => setI(k)}
            className={cn("mono border px-2 py-1 text-[9px]",
              i === k ? "border-transparent bg-chalk text-void" : "border-line text-dim hover:text-chalk")}>
            {x.path.split("/")[1]}
          </button>
        ))}
        <span className="mono ml-auto text-[9px] text-dim">
          {f.src.split("\n").length} lines · {(f.src.length / 1024).toFixed(1)} kB
        </span>
      </div>
      <div className="border-b border-line bg-void2 px-3 py-2">
        <div className="mono text-[10.5px] font-bold text-chalk">{f.path}</div>
        <p className="mt-1 text-[11.5px] leading-snug text-dim">{f.note}</p>
      </div>
      <div className="max-h-[520px] overflow-auto bg-void">
        <pre className="mono p-3 text-[10.5px] leading-[1.55]">
          <code dangerouslySetInnerHTML={{ __html: highlight(f.src) }} />
        </pre>
      </div>
    </div>
  );
}

export default function Phase9() {
  return (
    <>
      {/* ── INTRO ───────────────────────────────────────────────────── */}
      <section id="p9-top" className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-grid opacity-50" />
        <div className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(ellipse at 60% 0%, var(--fi-accent-soft), transparent 55%)" }} />
        <div className="relative mx-auto max-w-[1400px] px-4 pt-14 pb-8 sm:px-8">
          <div className="mono mb-4 flex flex-wrap items-center gap-2 text-[10px] tracking-[0.3em] uppercase">
            <span className="fi-accent-bg px-2 py-1 font-bold text-void">PHASE 9</span>
            <span className="text-dim">infinite living world</span>
          </div>
          <h1 className="text-balance text-[clamp(2.1rem,6vw,4.6rem)] leading-[0.95] font-black tracking-[-0.035em]">
            A planet that is <span className="fi-accent-text">alive</span>, endless,
            <br />and weighs 200 kilobytes.
          </h1>
          <p className="mt-6 max-w-3xl text-[15px] leading-relaxed text-dim sm:text-[16.5px]">
            Every tree below is a 24-byte seed evaluated at τ. Every animal is a Poisson sample of
            a population field. Every border between two players' aesthetics is the place where
            two Gaussians happen to be equal. Nothing here is stored, streamed or baked — it is
            all <em className="not-italic text-chalk">derived</em>, which is why it can be infinite.
          </p>
          <div className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {([
              ["D1", "Botanical growth", "logistic τ-curves · L-system · GPU unfold", "#7cff4d"],
              ["D2", "Autonomous fauna", "Lotka-Volterra → Poisson materialisation", "#ffc13d"],
              ["D3", "Endless enclaves", "floating origin · partition of unity", "#b46bff"],
              ["D4", "Zero-bandwidth federation", "< 200 kB continents · 120 Hz rollback", "#3dc8ff"],
            ] as const).map(([n, t, d, c]) => (
              <div key={n} className="fi-panel border border-line bg-panel/70 p-3" style={{ borderColor: c + "44" }}>
                <div className="mono text-[9.5px] font-bold tracking-[0.2em]" style={{ color: c }}>{n}</div>
                <div className="mt-1 text-[13px] leading-tight font-bold">{t}</div>
                <div className="mono mt-1 text-[10px] text-dim">{d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── D1 FLORA ────────────────────────────────────────────────── */}
      <section id="p9-flora" className="mx-auto max-w-[1400px] px-4 py-16 sm:px-8">
        <SectionHead n="9.1" kicker="Deliverable 1" title="Botanical Growth & Dynamic Foliage"
          lede="A tree is not a prop that was placed. It is six numbers plus the current tick. Run the century below and watch a forest germinate, mature, stress in drought and colour in senescence — all from one logistic curve, with no keyframes and no CPU cost per plant." />
        <FloraDemo />
        <div className="mt-3 grid gap-3 lg:grid-cols-3">
          <Panel label="THE GROWTH CURVE" accent="#7cff4d">
            <Formula>{`Scale(τ)    = 1 / (1 + e^(−k(τ − τ₀)))
Branches(τ) = ⌊ N_max · Scale(τ) ⌋
girth       = height · girthRatio
canopy      = V_max · Scale²`}</Formula>
            <p className="mt-2 text-[12.5px] leading-relaxed text-dim">
              <strong className="text-chalk">Climate scales the CLOCK, not the output.</strong> A
              tree in a dry biome is not a small tree — it is a young tree that has lived a long
              time. That one decision makes drought, shade and seasons read correctly with no
              extra terms, and it keeps the function invertible: given a size you can solve for
              the effective age.
            </p>
          </Panel>
          <Panel label="BRANCHES UNFOLD IN THE VERTEX SHADER" accent="#86c954">
            <Formula>{`float need   = (a_branchIndex + 1.0) / u_maxBranches;
float unfold = clamp((scale − need*0.82) / 0.16, 0., 1.);
if (unfold <= 0.0) { gl_Position = vec4(2.); return; }`}</Formula>
            <p className="mt-2 text-[12px] leading-relaxed text-dim">
              Un-grown branches emit a degenerate vertex and are clipped for free. The CPU never
              knows how many branches are visible; it uploads eight floats per tree and the GPU
              evaluates the L-system. There is no "grow" animation — there is only the same
              function sampled at a later τ.
            </p>
          </Panel>
          <Panel label="THE WAKE IS SPARSE, THE GRASS IS NOT" accent="#3dc8ff">
            <p className="text-[12.5px] leading-relaxed text-dim">
              Four million blades have no identity — they are generated from{" "}
              <code className="mono text-chalk">gl_InstanceID</code> hashed into the cell, so the
              entire prairie costs six vertices of VRAM. The only thing with identity is the{" "}
              <strong className="text-chalk">dent</strong>, and dents are sparse. So we store a
              256² R8 canvas, stamp it, and relax it exponentially back to zero. Walk the pink
              marker through the grass above and watch it spring back over 2.4 s.
            </p>
          </Panel>
        </div>
        <div className="mt-3 grid gap-3 lg:grid-cols-[1.1fr_1fr]">
          <Panel label="THE UNBROKEN CYCLE" accent="#3dc8ff">
            <Formula>{`evaporation   ∝ Lx · surfaceWater · (1 − humidity)
condensation  ∝ max(0, humidity − dewPoint)
rainfall       = condensation · cloud
infiltration  ∝ rainfall · (1 − soilSaturation)
transpiration ∝ biomass · soilMoisture · Lx     ← the feedback`}</Formula>
            <p className="mt-3 text-[12.5px] leading-relaxed text-dim">
              Sun lifts water → water becomes cloud → cloud becomes rain → rain feeds soil → soil
              grows flora → <strong className="text-chalk">flora transpires back into humidity</strong>.
              More forest means more rain, which means more forest. A terraformed continent gets
              wetter as it gets greener, and the player discovers positive feedback by causing it
              — no tutorial required.
            </p>
          </Panel>
          <Panel label="SPECIES" flush>
            <div className="divide-y divide-line/60">
              {Object.values(SPECIES).map((s) => (
                <div key={s.species} className="grid gap-1 p-2.5 sm:grid-cols-[130px_1fr]">
                  <div className="text-[12px] font-bold"
                    style={{ color: `rgb(${s.leafColour.map((c) => Math.round(c * 255)).join(",")})` }}>
                    {s.species.replace("_", " ")}
                  </div>
                  <div className="mono text-[9.5px] leading-snug text-dim">
                    k={s.k} · τ₀={s.tau0}s · {s.maxHeight} m · {s.maxBranches} branches ·
                    moisture ≥ {s.moistureFloor} · light ≥ {s.lightFloor}
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </section>

      {/* ── D2 FAUNA ────────────────────────────────────────────────── */}
      <section id="p9-fauna" className="mx-auto max-w-[1400px] px-4 py-16 sm:px-8">
        <SectionHead n="9.2" kicker="Deliverable 2" title="Autonomous Ecosystem Fauna"
          lede="Beyond 300 m a herd is a number. Inside 300 m that same number materialises into individuals — deterministically, from the cell coordinate, so two players standing together see the same animals. Drag the radius and watch the field become creatures with no spawn, no pop and no allocation." />
        <FaunaDemo />
        <div className="mt-3 grid gap-3 lg:grid-cols-3">
          <Panel label="MACROSCOPIC: LOTKA-VOLTERRA" accent="#ffc13d">
            <Formula>{`dN/dt = r·N·(1 − N/K)  −  α·N·P
dP/dt = β·α·N·P  −  m·P

K = f(local biomass)     ← the coupling to the flora cycle
+ 5-point Laplacian      ← migration into newly fertile land`}</Formula>
            <p className="mt-2 text-[12px] leading-relaxed text-dim">
              K is not a constant — it is whatever biomass the flora produced there. Terraform a
              valley green and herds arrive two simulated days later, because diffusion carried
              them, not because a spawn rule fired.
            </p>
          </Panel>
          <Panel label="MICROSCOPIC: POISSON-DISK" accent="#7cff4d">
            <Formula>{`spacing = 1 / √(localDensity)      clamped to [2.2·body, 140 m]
accept  if  hash(i,j) < density/K
lod     = smoothstep(radius − d, 0, 30 m)`}</Formula>
            <p className="mt-2 text-[12px] leading-relaxed text-dim">
              A jittered lattice with density-derived spacing gives the same visual result as
              dart-throwing, is O(1) per candidate, and is <strong className="text-chalk">deterministic
              from the cell coordinate</strong> — which is the property that makes it
              multiplayer-safe. The last 30 m is a scale fade: materialisation you cannot see.
            </p>
          </Panel>
          <Panel label="GAITS ARE FOUR NUMBERS" accent="#b46bff">
            <Formula>{`WALK   [0, .5, .25, .75]   lateral sequence
TROT   [0, .5, .5, 0]      diagonal pairs
GALLOP [0, .1, .5, .6]     rotary
6-leg  [0,.5,0,.5,0,.5]    alternating tripod`}</Formula>
            <p className="mt-2 text-[12px] leading-relaxed text-dim">
              These offsets are the <em className="not-italic text-chalk">entire</em> animation
              data in the fauna system. No clips, no skeletons on disk, no retargeting. Feet are
              placed with closed-form two-bone IK against the terrain; the contact phase — where
              the planted foot travels backward with the body — is what sells it as an animal
              rather than a sliding box.
            </p>
          </Panel>
        </div>
        <div className="mt-3">
          <Panel label="THE BESTIARY" flush>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left">
                <thead>
                  <tr className="mono border-b border-line text-[9px] tracking-[0.16em] text-dim uppercase">
                    <th className="p-2 font-medium">Species</th><th className="p-2 font-medium">Trophic</th>
                    <th className="p-2 font-medium">Legs</th><th className="p-2 font-medium">r · K</th>
                    <th className="p-2 font-medium">Speed</th><th className="p-2 font-medium">Boids (c/s/a)</th>
                    <th className="p-2 font-medium">Behaviour</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.values(FAUNA).map((f) => (
                    <tr key={f.id} className="border-b border-line/50 hover:bg-panel2/70">
                      <td className="p-2 text-[12px] font-bold" style={{ color: f.colour }}>{f.label}</td>
                      <td className="p-2"><Tag color={f.colour}>{f.trophic}</Tag></td>
                      <td className="mono p-2 text-[10.5px] text-chalk">{f.legs || "—"}</td>
                      <td className="mono p-2 text-[10.5px] text-dim">{f.r} · {f.K}/km²</td>
                      <td className="mono p-2 text-[10.5px] text-dim">{f.speedMs} m/s</td>
                      <td className="mono p-2 text-[10.5px] text-dim">
                        {f.cohesion}/{f.separation}/{f.alignment}
                      </td>
                      <td className="p-2 text-[11px] text-dim">
                        {f.nocturnal ? "nocturnal · " : ""}
                        {f.preyOf ? `hunts ${FAUNA[f.preyOf].label}` : "flees at " + f.fleeRadiusM + " m"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      </section>

      {/* ── D3 ENCLAVES ─────────────────────────────────────────────── */}
      <section id="p9-enclaves" className="mx-auto max-w-[1400px] px-4 py-16 sm:px-8">
        <SectionHead n="9.3" kicker="Deliverable 3" title="Endless Space & Continental Imprinting"
          lede="A 40,000 km planet that fits in a float32 vertex buffer, and thousands of authors imprinting one shared surface with no seams and no ownership disputes. Toggle 'borders' below: the glowing seams are not drawn — they are where two Gaussians happen to be equal." />
        <EnclaveDemo />
        <div className="mt-3 grid gap-3 lg:grid-cols-3">
          <Panel label="PARTITION OF UNITY" accent="#b46bff">
            <Formula>{`Wᵢ(p)    = exp( −‖p − cᵢ‖² / 2σ² )

Biome(p) = Σᵢ [ Wᵢ(p) / Σⱼ Wⱼ(p) ] · Cartridgeᵢ(p)`}</Formula>
            <p className="mt-2 text-[12.5px] leading-relaxed text-dim">
              Gaussian rather than linear falloff for one reason that matters enormously:{" "}
              <strong className="text-chalk">a Gaussian is C^∞</strong>. Every derivative is
              continuous, so terrain normals, flora density gradients and fauna carrying-capacity
              gradients are all smooth across a border. Smoothstep falloff puts a visible lighting
              crease exactly where two players meet — the one place you least want an artefact.
            </p>
          </Panel>
          <Panel label="FLOATING ORIGIN" accent="#ff3d8a">
            <Formula>{`GlobalPos = { sx, sz : int32 ; lx, ly, lz : float64 }
SECTOR_M  = 4096        SECTORS_AROUND = 9,766

rebaseOrigin(st, camera) → shift of whole metres, lossless`}</Formula>
            <p className="mt-2 text-[12.5px] leading-relaxed text-dim">
              At 20,000 km from spawn, one float32 ULP is about 2 metres — hands jitter, shadows
              crawl, physics explodes. Drag the "walk from spawn" slider and watch the naive ULP
              climb through <em className="not-italic">shadow shimmer</em> →{" "}
              <em className="not-italic">vertex crawl</em> → <em className="not-italic">geometry
              tears apart</em>, while the rebased figure never moves. Precision at the antipode is
              identical to precision at spawn.
            </p>
          </Panel>
          <Panel label="ECOLOGY IS THE TRADE SYSTEM" accent="#7cff4d">
            <Formula>{`viability *= exp(−distance / 42 km)      fat-tailed kernel
germinate ∝ viability · moisture · (0.18 + kin·0.8)`}</Formula>
            <p className="mt-2 text-[12.5px] leading-relaxed text-dim">
              Spores ride the jet stream. One released in @dr.vex's bioluminescent forest may land
              — and germinate — inside @piskriek's basalt canyon, using the original author's
              cartridge. Nobody designed a trading system; your neighbour's aesthetic simply
              arrives on the wind, and you can cull it or let it spread. Both are interesting,
              which is the only test a mechanic has to pass.
            </p>
          </Panel>
        </div>
      </section>

      {/* ── D4 FEDERATION ───────────────────────────────────────────── */}
      <section id="p9-federation" className="mx-auto max-w-[1400px] px-4 py-16 sm:px-8">
        <SectionHead n="9.4" kicker="Deliverable 4" title="Zero-Bandwidth Federated Living World"
          lede="Push the sliders to 400,000 trees and 200,000 animals. The payload does not move, because trees and animals are not in it — they are functions. The ratio against a conventional engine is computed live, not asserted." />
        <FederationDemo />
      </section>

      {/* ── SOURCE + CLOSE ──────────────────────────────────────────── */}
      <section id="p9-source" className="mx-auto max-w-[1400px] px-4 py-16 sm:px-8">
        <SectionHead n="9.5" kicker="Paste-ready" title="The Source"
          lede="Four modules, loaded verbatim from this build — the same bytes the four demos above are executing." />
        <Source />

        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <Panel label="MERGE PLAN · PRs 10–13" accent="#7cff4d">
            <Formula>{`PR 10  packages/setmix-flora       ~620 LOC  pure + 2 GLSL
PR 11  packages/setmix-fauna       ~580 LOC  pure
PR 12  packages/setmix-enclaves    ~520 LOC  pure
PR 13  packages/setmix-federation  ~480 LOC  pure, transport injected

Phase 9 total: ~2,200 LOC · 0 runtime deps · 0 server`}</Formula>
            <p className="mt-2 text-[12px] leading-relaxed text-dim">
              Same discipline as every prior phase: pure functions, injected transports, no clock
              and no RNG. <code className="mono text-chalk">setmix-flora</code> depends on the
              hydrological cycle; <code className="mono text-chalk">setmix-fauna</code> depends on
              flora's biomass output; everything else depends only on contracts.
            </p>
          </Panel>
          <Panel label="THE WHOLE ARGUMENT, IN ONE LINE" accent="var(--fi-accent)">
            <p className="text-[13.5px] leading-relaxed text-chalk/90">
              Nine phases ago we claimed a planet was four floats. Everything since has been an
              exercise in refusing to add a fifth.
            </p>
            <ul className="mt-3 space-y-1.5 text-[12px] leading-relaxed text-dim">
              <li className="flex gap-2"><span className="text-vtx">→</span><span>Terrain is <code className="mono text-chalk">deriveBudget(Pxd,Vtx,Lx,Aq)</code>.</span></li>
              <li className="flex gap-2"><span className="text-vtx">→</span><span>Trees are <code className="mono text-chalk">Scale(τ)</code> gated by a cycle driven by Lx and Aq.</span></li>
              <li className="flex gap-2"><span className="text-vtx">→</span><span>Animals are a density field whose carrying capacity is the trees.</span></li>
              <li className="flex gap-2"><span className="text-vtx">→</span><span>Borders are a normalised sum of Gaussians over the spires players planted.</span></li>
              <li className="flex gap-2"><span className="text-vtx">→</span><span>The network sends the seeds and lets both machines do the arithmetic.</span></li>
            </ul>
            <p className="mt-3 border-l-2 fi-accent-border pl-3 text-[12.5px] leading-relaxed text-chalk/90">
              The planet is alive because mathematics does not need to be stored to be true. That
              is the whole game, and it has been the whole game since Section 1.
            </p>
          </Panel>
        </div>
      </section>
    </>
  );
}
