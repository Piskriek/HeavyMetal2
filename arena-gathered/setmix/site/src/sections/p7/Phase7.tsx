import { useState } from "react";
import { Panel, SectionHead, Formula, Tag } from "@/components/ui";
import EcoLab from "@/components/p7/EcoLab";
import VoxelLab from "@/components/p7/VoxelLab";
import LogiLab from "@/components/p7/LogiLab";
import SmxLab from "@/components/p7/SmxLab";
import { ECO_STAGES } from "@/drop/Ecosystem";
import { WATER_NOTES } from "@/drop/WaterShader";
import { WORKER_NOTES } from "@/drop/VoxelWorker";
import { LOGISTICS_NOTES } from "@/drop/LogisticsSwarm";
import { SMX_NOTES } from "@/drop/CartridgeCompiler";
import { cn } from "@/utils/cn";

import srcEco from "@/drop/Ecosystem.ts?raw";
import srcWater from "@/drop/WaterShader.ts?raw";
import srcVox from "@/drop/VolumetricVoxelField.ts?raw";
import srcWorker from "@/drop/VoxelWorker.ts?raw";
import srcLogi from "@/drop/LogisticsSwarm.ts?raw";
import srcSmx from "@/drop/CartridgeCompiler.ts?raw";

const FILES = [
  { path: "packages/setmix-ecosystem/src/Ecosystem.ts", src: srcEco,
    note: "Cellular-automata moisture diffusion, logistic biomass growth, deterministic blue-noise scatter and O(n²) flocking for sky mantas and cave fauna." },
  { path: "packages/setmix-ecosystem/src/WaterShader.ts", src: srcWater,
    note: "Gerstner displacement with analytic normals, per-channel Beer–Lambert absorption, procedural caustics, depth-difference foam, Schlick Fresnel, and the buoyancy + underwater audio model." },
  { path: "packages/setmix-volumetric/src/VolumetricVoxelField.ts", src: srcVox,
    note: "Sparse 32³ SDF chunks with lazy terrain seeding, smooth-min CSG brushes, dirty-box tracking and a naive surface-nets mesher." },
  { path: "packages/setmix-volumetric/src/VoxelWorker.ts", src: srcWorker,
    note: "Transferable-ArrayBuffer worker pool with coalescing, camera-priority sort, stale-revision rejection and an inline fallback for 2-core devices." },
  { path: "packages/setmix-logistics/src/LogisticsSwarm.ts", src: srcLogi,
    note: "Priority-band task dispatch, boid steering with look-ahead SDF avoidance, tractor-beam state machine, and arc-length-correct Catmull-Rom pneumatic tubes." },
  { path: "packages/setmix-cartridge/src/CartridgeCompiler.ts", src: srcSmx,
    note: "The .smx binary format, dependency-free SHA-256 and CRC32, DAG→bytecode compiler, verifier, disassembler and the Node/Bun CLI." },
];

function highlight(src: string) {
  const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
  let out = esc(src);
  out = out.replace(/(\/\*[\s\S]*?\*\/|\/\/[^\n]*)/g, '<span class="tk-c">$1</span>');
  out = out.replace(/(&quot;|&#39;|["'`])((?:\\.|(?!\1)[^\\])*?)\1/g, '<span class="tk-s">$1$2$1</span>');
  out = out.replace(/\b(const|let|var|function|return|if|else|for|while|class|interface|type|export|import|from|new|extends|readonly|public|private|async|await|try|catch|throw|typeof|in|of|as|null|undefined|true|false|void|this|switch|case|break|continue|default|uniform|out|vec2|vec3|vec4|mat4|float|int|struct)\b/g, '<span class="tk-k">$1</span>');
  out = out.replace(/\b(0x[0-9a-f]+|\d+\.?\d*(?:e[-+]?\d+)?)\b/gi, '<span class="tk-n">$1</span>');
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
            {x.path.split("/").slice(-1)[0]}
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

function NoteGrid({ notes, accent }: { notes: readonly (readonly [string, string])[]; accent: string }) {
  return (
    <div className="grid gap-px bg-line sm:grid-cols-2 lg:grid-cols-3">
      {notes.map(([k, v], i) => (
        <div key={k} className="bg-panel p-3">
          <div className="mono flex items-baseline gap-2 text-[10px]">
            <span style={{ color: accent }}>{String(i + 1).padStart(2, "0")}</span>
            <span className="font-bold text-chalk">{k}</span>
          </div>
          <p className="mt-1.5 text-[11.5px] leading-relaxed text-dim">{v}</p>
        </div>
      ))}
    </div>
  );
}

export default function Phase7() {
  return (
    <>
      {/* ── intro ──────────────────────────────────────────────────── */}
      <section id="p7-top" className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-grid opacity-50" />
        <div className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(ellipse at 60% 0%, var(--fi-accent-soft), transparent 55%)" }} />
        <div className="relative mx-auto max-w-[1400px] px-4 pt-14 pb-8 sm:px-8">
          <div className="mono mb-4 flex flex-wrap items-center gap-2 text-[10px] tracking-[0.3em] uppercase">
            <span className="fi-accent-bg px-2 py-1 font-bold text-void">PHASE 7</span>
            <span className="text-dim">biosphere · volumetric · logistics · .smx</span>
          </div>
          <h1 className="text-balance text-[clamp(2.1rem,6vw,4.6rem)] leading-[0.95] font-black tracking-[-0.035em]">
            The dead rock learns to <span className="fi-accent-text">breathe</span>.
          </h1>
          <p className="mt-6 max-w-3xl text-[15px] leading-relaxed text-dim sm:text-[16.5px]">
            Four frontier engines. Life that <em className="not-italic text-chalk">spreads</em> rather
            than fades in, so a player can work out why the green edge stopped by looking at the
            terrain. True 3D destructibility that costs zero bytes until somebody digs. A swarm
            that understands your base. And a binary cartridge format safe enough to download from
            a stranger.
          </p>
          <div className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {([
              ["D1", "Biosphere & hydrosphere", "CA moisture · Gerstner · Beer–Lambert", "#3dc8ff"],
              ["D2", "Volumetric excavation", "sparse SDF · surface nets · workers", "#b46bff"],
              ["D3", "Logistics swarm", "priority bands · boids · pneumatic bus", "#ffc13d"],
              ["D4", ".smx cartridge standard", "64 B header · bytecode · CLI", "#7cff4d"],
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

      {/* ── D1 ─────────────────────────────────────────────────────── */}
      <section id="p7-eco" className="mx-auto max-w-[1400px] px-4 py-16 sm:px-8">
        <SectionHead n="7.1" kicker="Deliverable 1" title="The Living Biosphere & Hydrosphere"
          lede="Aq raises the water table; the coastline is wherever that scalar intersects the terrain. Then moisture diffuses outward from every shoreline and vent, light gates photosynthesis, and biomass grows logistically toward a carrying capacity. Life does not fade in — it colonises, and you can see the front move." />
        <EcoLab />

        <div className="mt-3 grid gap-3 lg:grid-cols-[1.05fr_1fr]">
          <Panel label="THREE COUPLED FIELDS, ONE STENCIL EACH" accent="#7cff4d">
            <Formula>{`∂m/∂t = D∇²m − (0.16 + h·0.5)(1−rain)·m + rain·0.35
∂l/∂t = (Lx·daylight·shade − l) · 1.4
∂B/∂t = rB(1 − B/K)  +  seed  −  mortality

K = max( chemo(m), photo(m)·photo(l) )
  · (1 − slope·0.7) · treeline(altitude)`}</Formula>
            <p className="mt-3 text-[12.5px] leading-relaxed text-dim">
              The logistic term is the whole feel: slow start, explosive middle, gentle saturation.
              Players read that S-curve as <em className="not-italic text-chalk">"it caught on"</em>.
              A linear growth model produces an expanding disc, which reads as a shader effect.
            </p>
            <p className="mt-2 text-[12.5px] leading-relaxed text-dim">
              A 128×128 field is 16k cells and steps in ~0.25 ms, so it runs{" "}
              <strong className="text-chalk">inside the 120 Hz sim</strong> rather than on a
              background timer — which it must, because the shoreline advance has to be
              deterministic for replay and for co-op.
            </p>
          </Panel>
          <Panel label="THE SIX ECOLOGICAL STAGES" accent="#86c954" flush>
            <div className="divide-y divide-line/60">
              {ECO_STAGES.map((s) => (
                <div key={s.stage} className="flex gap-3 p-2.5">
                  <span className="mt-[3px] h-3 w-3 shrink-0"
                    style={{ background: `rgb(${s.colour.map((x) => Math.round(x * 255)).join(",")})`,
                             boxShadow: s.emissive > 0.2 ? `0 0 8px rgb(${s.colour.map((x) => Math.round(x * 255)).join(",")})` : "none" }} />
                  <div>
                    <div className="mono flex flex-wrap items-baseline gap-2 text-[10px]">
                      <span className="font-bold text-chalk">E{s.stage} {s.name}</span>
                      <Tag color={s.photosynthetic ? "#ffc13d" : "#ff8a3d"}>
                        {s.photosynthetic ? "photosynthetic" : "chemotrophic"}
                      </Tag>
                    </div>
                    <p className="mt-0.5 text-[11px] leading-snug text-dim">{s.blurb}</p>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        <div className="mt-3">
          <Panel label="THE WATER SHADER · why each decision" accent="#3dc8ff" flush>
            <NoteGrid notes={WATER_NOTES} accent="#3dc8ff" />
          </Panel>
        </div>
      </section>

      {/* ── D2 ─────────────────────────────────────────────────────── */}
      <section id="p7-voxel" className="mx-auto max-w-[1400px] px-4 py-16 sm:px-8">
        <SectionHead n="7.2" kicker="Deliverable 2" title="Volumetric Excavation"
          lede="A heightfield cannot represent a cave, because a heightfield is a function and a cave needs two surfaces over one (x, z). So the subsurface is a sparse signed distance field — 32³ chunks allocated only where somebody actually dug, meshed on workers with zero-copy transfers." />
        <VoxelLab />

        <div className="mt-3 grid gap-3 lg:grid-cols-3">
          <Panel label="CSG, TEXTBOOK" accent="#b46bff">
            <Formula>{`carve:    SDF ← smax( SDF, −(|p−c| − r), k )
deposit:  SDF ← smin( SDF,  (|p−c| − r), k )

smin(a,b,k) = mix(b,a,h) − k·h·(1−h)
              h = clamp(.5 + .5(b−a)/k, 0, 1)`}</Formula>
            <p className="mt-2 text-[12px] leading-relaxed text-dim">
              k = 0 degenerates to a hard min, so one code path covers both the surgical cube-cut
              and the organic blob deposit. The `strength` term lerps toward the result, which is
              why a held beam carves <em className="not-italic text-chalk">progressively</em>
              rather than instantaneously — and why mining feels like mining.
            </p>
          </Panel>
          <Panel label="SURFACE NETS, NOT QEF — HERE" accent="#7cff4d">
            <p className="text-[12.5px] leading-relaxed text-dim">
              The <em className="not-italic text-chalk">surface</em> still uses the Phase-3 dual
              contourer, because basalt joints matter up there. The{" "}
              <em className="not-italic text-chalk">subsurface</em> uses naive surface nets: caves
              have no sharp features worth preserving, surface nets cannot produce the
              self-intersections a poorly-conditioned QEF can, and it is ~3× faster. Choosing a
              different mesher per domain is the correct answer, not a compromise.
            </p>
          </Panel>
          <Panel label="WATERTIGHT AT THE TUNNEL MOUTH" accent="#ffc13d">
            <p className="text-[12.5px] leading-relaxed text-dim">
              The same principle as the Phase-3 LOD seam: make the two meshers agree by{" "}
              <strong className="text-chalk">arithmetic</strong>, not negotiation. A chunk is
              <em className="not-italic text-chalk"> seeded from the analytic terrain at allocation
              time</em>, so an authored chunk and an unauthored one evaluate identically until
              something writes to it. Both meshers sample one scalar field, so their zero-crossings
              coincide to the bit. Add boundary ownership plus a 1.5-voxel skirt and a tunnel mouth
              is watertight <em className="not-italic text-chalk">while it is being dug</em>.
            </p>
          </Panel>
        </div>

        <div className="mt-3">
          <Panel label="THE WORKER POOL · the part that is not the threading" accent="#b46bff" flush>
            <NoteGrid notes={WORKER_NOTES} accent="#b46bff" />
          </Panel>
        </div>
      </section>

      {/* ── D3 ─────────────────────────────────────────────────────── */}
      <section id="p7-logi" className="mx-auto max-w-[1400px] px-4 py-16 sm:px-8">
        <SectionHead n="7.3" kicker="Deliverable 3" title="The Logistics Swarm"
          lede="Factorio's real lesson is not belts — it is that the player should graduate from BEING the logistics system to DESIGNING it. Drones are the first graduation; the pneumatic bus is the second. Drop the drone count to 1 and watch terraforming literally stop." />
        <LogiLab />
        <div className="mt-3">
          <Panel label="WHY THE SWARM FEELS INTELLIGENT" accent="#ffc13d" flush>
            <NoteGrid notes={LOGISTICS_NOTES} accent="#ffc13d" />
          </Panel>
        </div>
      </section>

      {/* ── D4 ─────────────────────────────────────────────────────── */}
      <section id="p7-smx" className="mx-auto max-w-[1400px] px-4 py-16 sm:px-8">
        <SectionHead n="7.4" kicker="Deliverable 4" title="The .smx Binary Standard"
          lede="A cartridge is a physical object in the fiction, so it is a physical object on disk: one file, a 64-byte header, four sections, byte-addressable and verifiable before a single instruction is evaluated. Flip one bit below and watch the gate reject it." />
        <SmxLab />

        <div className="mt-3 grid gap-3 lg:grid-cols-[1.1fr_1fr]">
          <Panel label="THE WIRE LAYOUT" accent="#7cff4d">
            <Formula>{`0x00  u32    magic      0x534D5831  "SMX1"
0x04  u16    major      0x06  u16  minor
0x08  u32    engineVer  0x0C  u32  flags
0x10  u8[32] sha256     over bytes [64 … EOF]
0x30  u8[12] authorId   0x3C  u32  tocCount
──────────────────────────────────────────────
TOC   tocCount × { u32 id, off, len, crc32 }
──────────────────────────────────────────────
§1 META  UTF-8 JSON    name·tags·params·stages
§2 CODE  bytecode      12 B/instr, no eval()
§3 ART   128² thumb    + 16-entry palette
§4 GEOM  collision BVH + Nanite LOD counts`}</Formula>
          </Panel>
          <Panel label="THE SECURITY MODEL IS THE DATA MODEL" accent="#ff3d8a">
            <p className="text-[12.5px] leading-relaxed text-dim">
              Cartridges are UGC downloaded from strangers. Shipping a JS closure — or anything{" "}
              <code className="mono text-chalk">eval()</code>-shaped — would make the Galaxy a
              malware distribution network. So the Synthesizer graph compiles to a flat register
              machine over 24 fixed opcodes.
            </p>
            <p className="mt-2 text-[12.5px] leading-relaxed text-dim">
              <strong className="text-chalk">There is no loop opcode, so there is no loop to
              abuse.</strong> The source is a DAG, a topological order is a straight line, and the
              program provably terminates in <code className="mono text-chalk">code.length</code>{" "}
              steps. The interpreter cannot do I/O because no opcode does I/O. A hostile cartridge
              can at worst be slow — and <code className="mono text-chalk">graphCost()</code>{" "}
              rejects that before it ever runs.
            </p>
          </Panel>
        </div>

        <div className="mt-3">
          <Panel label="FORMAT DESIGN NOTES" accent="#7cff4d" flush>
            <NoteGrid notes={SMX_NOTES} accent="#7cff4d" />
          </Panel>
        </div>
      </section>

      {/* ── source ─────────────────────────────────────────────────── */}
      <section id="p7-source" className="mx-auto max-w-[1400px] px-4 py-16 sm:px-8">
        <SectionHead n="7.5" kicker="Paste-ready" title="The Source"
          lede="Six modules, loaded verbatim from this build — the same bytes the four labs above are executing." />
        <Source />

        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <Panel label="MERGE PLAN · PRs 12–15" accent="#7cff4d">
            <Formula>{`PR 12  packages/setmix-ecosystem   ~690 LOC  pure + GLSL
PR 13  packages/setmix-volumetric  ~740 LOC  pure + worker
PR 14  packages/setmix-logistics   ~520 LOC  pure, 120 Hz
PR 15  packages/setmix-cartridge   ~720 LOC  pure + CLI

total Phase 7: ~2,670 LOC · 0 runtime deps · 0 server`}</Formula>
            <p className="mt-2 text-[12px] leading-relaxed text-dim">
              Every module is pure or takes its one impure dependency (the worker spawner, the PNG
              encoder, the signer) as an injected interface — so all four test headlessly and none
              of them pulls a renderer or a network stack into{" "}
              <code className="mono text-chalk">packages/</code>.
            </p>
          </Panel>
          <Panel label="WHAT THESE FOUR UNLOCK" accent="var(--fi-accent)">
            <ul className="space-y-1.5 text-[12px] leading-relaxed text-dim">
              <li className="flex gap-2"><span className="text-aq">→</span><span>The <strong className="text-chalk">Stage-4 flood drama</strong>: sea level is one scalar, so a player's extractor farm can genuinely drown, and the Flood Planner overlay from GDD §3 now has real physics behind it.</span></li>
              <li className="flex gap-2"><span className="text-flux">→</span><span><strong className="text-chalk">Subterranean play</strong>: Deep Chroma veins, cave fauna, tunnel logistics, and overhangs that the heightfield could never express.</span></li>
              <li className="flex gap-2"><span className="text-lx">→</span><span><strong className="text-chalk">The automation graduation</strong>: the moment carrying ore by hand stops being the game, which is the pacing beat GDD §6 identified as the mid-game's biggest risk.</span></li>
              <li className="flex gap-2"><span className="text-vtx">→</span><span><strong className="text-chalk">A safe Galaxy</strong>: Phase 5 federation shipped the manifest; .smx is the payload format that makes downloading a stranger's cartridge defensible rather than merely exciting.</span></li>
            </ul>
            <p className="mt-3 border-l-2 fi-accent-border pl-3 text-[12.5px] leading-relaxed text-chalk/90">
              Seven phases, and the biosphere, the caves, the swarm and the cassette all still read
              the same four floats. Pxd, Vtx, Lx, Aq.
            </p>
          </Panel>
        </div>
      </section>
    </>
  );
}
