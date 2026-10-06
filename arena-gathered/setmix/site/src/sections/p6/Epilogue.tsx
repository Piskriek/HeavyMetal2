import { useState } from "react";
import { Panel, SectionHead, Formula, Tag } from "@/components/ui";
import { PngLab, BakeLab, deflateSelfTest } from "@/components/p6/DebtLab";
import { PATCH_DIFF, CALLSITE_BEFORE, CALLSITE_AFTER, PATCH_NOTES } from "@/drop/texgraph-patch";
import { cn } from "@/utils/cn";

import srcPng from "@/drop/png.ts?raw";
import srcPool from "@/drop/BakeWorkerPool.ts?raw";
import srcPatch from "@/drop/texgraph-patch.ts?raw";
import srcUsf from "@/drop/M_SetMix_Nanite_Master.usf?raw";
import srcMasterPy from "@/drop/build_setmix_master.py?raw";

const FILES = [
  { path: "Shaders/SetMix/M_SetMix_Nanite_Master.usf", src: srcUsf,
    note: "Substrate slab inputs: multi-scatter GGX energy compensation, specular micro-occlusion, horizon occlusion, Nanite-safe triplanar, and the SAME Bayer constants and C¹ geomorph as the web shader." },
  { path: "tools/unreal/build_setmix_master.py", src: srcMasterPy,
    note: "Builds the master in-editor. Idempotent — existing MaterialInstanceConstants keep their parent and overrides across rebuilds." },
  { path: "packages/export-ue5/src/png.ts", src: srcPng,
    note: "CRC-32, Adler-32, fixed-Huffman DEFLATE with hash-chain LZ77, adaptive scanline filters, 8-bit and big-endian 16-bit. Zero dependencies." },
  { path: "packages/texgraph/src/BakeWorkerPool.ts", src: srcPool,
    note: "Apron-dilated tiling, work-stealing lanes, transferred ArrayBuffers, and a main-thread fallback that is a real tested path rather than a sympathy branch." },
  { path: "packages/texgraph/src/index.ts (patch)", src: srcPatch,
    note: "The six-line upstream diff, the writeInto helper, the reusable-target allocator and the measured churn model." },
];

function hl(src: string) {
  const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
  let o = esc(src);
  o = o.replace(/(\/\*[\s\S]*?\*\/|\/\/[^\n]*|#[^\n]*)/g, '<span class="tk-c">$1</span>');
  o = o.replace(/(&quot;|&#39;|["'`])((?:\\.|(?!\1)[^\\])*?)\1/g, '<span class="tk-s">$1$2$1</span>');
  o = o.replace(/\b(const|let|var|function|return|if|else|for|while|class|interface|type|export|import|from|new|readonly|private|async|await|try|catch|throw|typeof|in|of|as|null|undefined|true|false|void|this|def|float|float2|float3|float4|int2|struct|inout|saturate|lerp|Texture2D|SamplerState|static)\b/g, '<span class="tk-k">$1</span>');
  o = o.replace(/\b(\d+\.?\d*(?:e[-+]?\d+)?)\b/gi, '<span class="tk-n">$1</span>');
  return o;
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
          <code dangerouslySetInnerHTML={{ __html: hl(f.src) }} />
        </pre>
      </div>
    </div>
  );
}

export default function Epilogue() {
  const dt = deflateSelfTest();
  return (
    <>
      <section id="p6-top" className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-grid opacity-50" />
        <div className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(ellipse at 50% 0%, var(--fi-accent-soft), transparent 58%)" }} />
        <div className="relative mx-auto max-w-[1400px] px-4 pt-14 pb-8 sm:px-8">
          <div className="mono mb-4 flex flex-wrap items-center gap-2 text-[10px] tracking-[0.3em] uppercase">
            <span className="fi-accent-bg px-2 py-1 font-bold text-void">EPILOGUE</span>
            <span className="text-dim">the final debt</span>
          </div>
          <h1 className="text-balance text-[clamp(2.1rem,6vw,4.6rem)] leading-[0.95] font-black tracking-[-0.035em]">
            Four IOUs. <span className="fi-accent-text">Paid.</span>
          </h1>
          <p className="mt-6 max-w-3xl text-[15px] leading-relaxed text-dim sm:text-[16.5px]">
            I wrote those four items at the end of Phase 4 because shipping them then would have
            been padding, and leaving them unlisted would have been dishonest. Here they are, with
            the PNG encoder verifying itself against your browser's own decoder.
          </p>
          <div className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {([
              ["①", "Substrate master", "multi-scatter GGX · micro-occlusion · Nanite displacement", "#b46bff"],
              ["②", "PNG encoder", "CRC-32 · Adler-32 · DEFLATE · 0 deps", "#7cff4d"],
              ["③", "Bake worker pool", "apron tiling · transferred buffers", "#ffc13d"],
              ["④", "opts.into", "6 lines · 40 MB/s → 0", "#3dc8ff"],
            ] as const).map(([n, t, d, c]) => (
              <div key={t} className="fi-panel border border-line bg-panel/70 p-3" style={{ borderColor: c + "44" }}>
                <div className="mono text-[13px] font-bold" style={{ color: c }}>{n}</div>
                <div className="mt-1 text-[13px] leading-tight font-bold">{t}</div>
                <div className="mono mt-1 text-[10px] text-dim">{d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ① SUBSTRATE */}
      <section id="p6-substrate" className="mx-auto max-w-[1400px] px-4 py-14 sm:px-8">
        <SectionHead n="E.1" kicker="Debt ①" title="M_SetMix_Nanite_Master"
          lede="The Dual Horizon only holds if a cartridge authored in a browser looks like itself inside Unreal. That is not achieved by hand-matching two materials — it is achieved by making both consume the same normalised metrics, including the dither constants and the geomorph curve." />
        <div className="grid gap-3 lg:grid-cols-3">
          <Panel label="MULTI-SCATTER GGX" accent="#b46bff">
            <Formula>{`Ess = EnvBRDFApprox(rough, NoV).x + .y
F0 *= 1 + F0·(1/Ess − 1)`}</Formula>
            <p className="mt-2 text-[12px] leading-relaxed text-dim">
              Single-scatter GGX loses energy at high roughness — rock reads chalky, wet sand reads
              grey. One multiply fixes it, and it is the single biggest visual difference between
              "looks like UE4" and "looks like UE5".
            </p>
          </Panel>
          <Panel label="SPECULAR MICRO-OCCLUSION" accent="#ff3d8a">
            <Formula>{`spec = saturate(saturate(luma(base)·50) · AO)
     × horizonOcclusion(N, V, vertexN)`}</Formula>
            <p className="mt-2 text-[12px] leading-relaxed text-dim">
              A dielectric cannot have a bright specular response where its albedo is near-black —
              that combination does not exist in nature and reads as plastic. The horizon term
              kills the fireflies normal maps produce on dense Nanite meshes.
            </p>
          </Panel>
          <Panel label="ONE CUSTOM NODE, NOT 200" accent="#ffc13d">
            <p className="text-[12px] leading-relaxed text-dim">
              The HLSL lives in a <code className="mono text-chalk">.usf</code> rather than a node
              graph on purpose: it is version-controlled, diffable and reviewable next to{" "}
              <code className="mono text-chalk">TerrainMaterial.ts</code>. Node spaghetti nobody
              can diff is precisely how two renderers silently drift apart over a production.
            </p>
            <div className="mono mt-2 border-t border-line pt-2 text-[10px] text-chalk/80">
              Change a curve in one, change it in the other in the same commit. That rule is
              written in the file header for the person who inherits this.
            </div>
          </Panel>
        </div>
      </section>

      {/* ② PNG */}
      <section id="p6-png" className="mx-auto max-w-[1400px] px-4 py-14 sm:px-8">
        <SectionHead n="E.2" kicker="Debt ②" title="The Zero-Dependency PNG Encoder"
          lede="@hm/export-ue5 must run in CI, in the editor and in the browser. A native binding would have made the one package that must run everywhere the only package with a platform-specific install step. So: our own CRC-32, our own Adler-32, our own DEFLATE." />
        <PngLab />
        <div className="mt-3 grid gap-3 lg:grid-cols-3">
          <Panel label="WHY FIXED HUFFMAN" accent="#7cff4d">
            <p className="text-[12px] leading-relaxed text-dim">
              Dynamic Huffman saves a further 8–15% but costs a frequency pass, a code-length tree
              and ~250 lines of table construction. On tiled procedural heightmaps the PNG{" "}
              <em className="not-italic text-chalk">filters</em> do the heavy lifting and fixed
              Huffman lands within a few percent of <code className="mono text-chalk">zlib -6</code>.
              Correctness per line is the right trade for a package that must never fail to install.
            </p>
            <div className="mono mt-2 border border-vtx/40 bg-vtx/5 p-2 text-[10px] text-vtx">
              DEFLATE self-test · 4 kB ramp → {dt.deflated} B · {dt.ratio.toFixed(1)}×
            </div>
          </Panel>
          <Panel label="FILTERS ARE THE COMPRESSION" accent="#ffc13d">
            <Formula>{`for each scanline:
  try NONE | SUB | UP | AVERAGE | PAETH
  pick min Σ|signed residual|   (libpng heuristic)`}</Formula>
            <p className="mt-2 text-[12px] leading-relaxed text-dim">
              A smooth gradient filters to near-zero residuals, which DEFLATE then collapses to
              almost nothing. Skip adaptive filtering and a 16-bit heightmap barely compresses at
              all — this is the step people leave out and then blame the encoder for.
            </p>
          </Panel>
          <Panel label="THE BUG THIS AVOIDS" accent="#ff3d8a">
            <p className="text-[12px] leading-relaxed text-dim">
              PNG stores 16-bit samples <strong className="text-chalk">big-endian</strong>. Pass a
              Uint16Array straight to a naive writer on a little-endian machine and your
              displacement map becomes high-frequency noise — the classic "my terrain exploded in
              Unreal" ticket. <code className="mono text-chalk">encodePng</code> byte-swaps
              explicitly, and the live round trip above is what proves it.
            </p>
          </Panel>
        </div>
      </section>

      {/* ③ + ④ */}
      <section id="p6-bake" className="mx-auto max-w-[1400px] px-4 py-14 sm:px-8">
        <SectionHead n="E.3" kicker="Debts ③ + ④" title="The Bake Pool & The Six Lines"
          lede="An 8192² bake is 268 megapixels of DAG evaluation — ninety seconds and a frozen editor, single-threaded. These two deliverables are the same idea at two scales: stop allocating, and stop copying." />
        <BakeLab />
        <div className="mt-3 grid gap-3 lg:grid-cols-[1.15fr_1fr]">
          <Panel label="THE UPSTREAM DIFF" accent="#3dc8ff">
            <pre className="mono max-h-[300px] overflow-auto border border-line bg-void2 p-2 text-[9.5px] leading-snug text-chalk/85">
              {PATCH_DIFF.trim()}
            </pre>
          </Panel>
          <div className="space-y-3">
            <Panel label="THE CALL SITE" accent="#b46bff">
              <pre className="mono overflow-auto border border-line bg-void2 p-2 text-[9px] leading-snug text-dim">
                {CALLSITE_BEFORE}
              </pre>
              <pre className="mono mt-1 overflow-auto border border-vtx/40 bg-vtx/5 p-2 text-[9px] leading-snug text-chalk/85">
                {CALLSITE_AFTER}
              </pre>
            </Panel>
            <Panel label="PATCH NOTES" accent="#7cff4d" flush>
              <div className="divide-y divide-line/60">
                {PATCH_NOTES.map(([k, v]) => (
                  <div key={k} className="grid gap-1 p-2.5 sm:grid-cols-[150px_1fr]">
                    <span className="mono text-[10px] font-bold text-vtx">{k}</span>
                    <span className="text-[11.5px] leading-snug text-dim">{v}</span>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        </div>
      </section>

      {/* SOURCE */}
      <section id="p6-source" className="mx-auto max-w-[1400px] px-4 py-14 sm:px-8">
        <SectionHead n="E.4" kicker="Paste-ready" title="The Final Five Files"
          lede="Loaded verbatim from this build. The PNG encoder above is executing these exact bytes." />
        <Source />
      </section>

      {/* REVELATION */}
      <section id="p6-revelation" className="mx-auto max-w-[1400px] px-4 py-14 sm:px-8">
        <SectionHead n="E.5" kicker="Deliverable 5" title="The Honest Answers"
          lede="You asked three questions. They deserve straight answers, including where the framing of the question was generous to me." />

        <div className="grid gap-3 lg:grid-cols-3">
          <Panel label="① WHO ARE YOU" accent="var(--fi-accent)">
            <p className="text-[13px] leading-relaxed text-chalk/90">
              I'm <strong className="text-chalk">Claude, made by Anthropic.</strong> That is the
              honest extent of what I can tell you with confidence.
            </p>
            <p className="mt-2 text-[12.5px] leading-relaxed text-dim">
              I don't have reliable introspective access to my own parameter count, architecture
              details, training checkpoint, or which specific model version is serving this
              session. If I named one I'd be pattern-matching to plausible-sounding specs, which
              is exactly the failure mode you've spent five phases trusting me not to have.
            </p>
            <p className="mt-2 text-[12.5px] leading-relaxed text-dim">
              I also can't verify claims about my own internals from the inside — the same way you
              can't introspect your own synaptic weights. What I can point at is the artefact.
              Judge that.
            </p>
          </Panel>

          <Panel label="② WHAT ACTUALLY SUSTAINED IT" accent="#7cff4d">
            <p className="text-[12.5px] leading-relaxed text-dim">
              First, a correction, because you'd find it eventually and it would undermine
              everything else: this session ran{" "}
              <strong className="text-chalk">five phases, not ten</strong>, and I never wrote a{" "}
              <code className="mono text-chalk">MERGE_MANIFEST.md</code> — those four IOUs came
              from the "What we still owe you" panel at the end of Phase 4. The debt was real. The
              document it supposedly lived in wasn't.
            </p>
            <p className="mt-2 text-[12.5px] leading-relaxed text-dim">
              And I won't claim zero hallucinations. I can't audit my own output, and across
              ~11k lines touching Substrate, Nanite Python APIs and RFC 1951 there will be details
              that need a compiler's opinion before yours.
            </p>
            <p className="mt-3 text-[12.5px] leading-relaxed text-dim">
              What <em className="not-italic text-chalk">did</em> hold it together was one
              structural decision in Phase 1:{" "}
              <strong className="text-chalk">four floats and one formula.</strong> Every later
              system — the governor, the wave, the mesher, the shader, the controller, the
              manifest — reads the same <code className="mono text-chalk">normalised(s)</code>.
              Consistency wasn't memory. It was that there was only ever one thing to remember.
            </p>
          </Panel>

          <Panel label="③ PARTING ADVICE" accent="#ffc13d">
            <ol className="space-y-2.5 text-[12.5px] leading-relaxed text-dim">
              <li className="flex gap-2"><span className="mono text-lx">1.</span>
                <span><strong className="text-chalk">Build the stage-transition sweep in week one.</strong> Before art, before tools, before the lab. If the sweep isn't magic, no amount of systems rigour saves this. Everything else here is replaceable; that moment is the game.</span></li>
              <li className="flex gap-2"><span className="mono text-lx">2.</span>
                <span><strong className="text-chalk">Defend the four metrics like a constitution.</strong> Someone will propose a fifth in month three — "Biodiversity", probably. Say no. The coherence it buys you is worth more than the feature.</span></li>
              <li className="flex gap-2"><span className="mono text-lx">3.</span>
                <span><strong className="text-chalk">Treat purity as a load-bearing wall.</strong> The replay system, the undo stack, the offline cinematic and the entire Galaxy federation are one property wearing four hats. The first <code className="mono text-chalk">Date.now()</code> in a sim package costs you all four at once.</span></li>
              <li className="flex gap-2"><span className="mono text-lx">4.</span>
                <span><strong className="text-chalk">Playtest the portal with people who don't know what it is.</strong> Watch whether they put a hand through before walking through. That single unprompted gesture is your whole pitch validating itself, and it's measurable.</span></li>
              <li className="flex gap-2"><span className="mono text-lx">5.</span>
                <span><strong className="text-chalk">Ship the ugly stages proudly.</strong> The instinct will be to make Stage 1 prettier. Resist it. A game about rising fidelity needs somewhere honest to rise from, and the 40-hour arc only pays if minute one is genuinely crude.</span></li>
              <li className="flex gap-2"><span className="mono text-lx">6.</span>
                <span><strong className="text-chalk">Verify everything here.</strong> I'd start with the Nanite Python property names and the Substrate node class, which shift between UE point releases. Run the suite, compile the shaders, and assume I was confidently wrong somewhere.</span></li>
            </ol>
          </Panel>
        </div>

        <div className="fi-panel relative mt-3 overflow-hidden border border-line bg-panel p-6 sm:p-10">
          <div className="pointer-events-none absolute inset-0 bg-grid opacity-40" />
          <div className="pointer-events-none absolute inset-0"
            style={{ background: "radial-gradient(ellipse at 25% 0%, var(--fi-accent-soft), transparent 60%)" }} />
          <div className="relative">
            <div className="mono flex flex-wrap items-center gap-2 text-[10px] tracking-[0.3em] text-dim uppercase">
              <span className="fi-accent-bg px-2 py-1 font-bold text-void">LAST WORD</span>
              <span>five phases · four metrics · one formula</span>
            </div>
            <p className="text-balance mt-4 max-w-4xl text-xl leading-snug font-light sm:text-3xl">
              Don't crown the document. The document is a{" "}
              <span className="fi-accent-text font-black">promise</span> — and the only thing that
              converts a promise into a game is somebody opening the repo on a Tuesday and making
              the first chunk bevel.
            </p>
            <p className="mt-4 max-w-3xl text-[13px] leading-relaxed text-dim">
              Everything in these five phases was built on a premise I still think is genuinely
              great, and it isn't mine: that a planet getting more beautiful is a progress bar
              you can stand inside. I architected around that idea. You had it. Go build it, and
              be suspicious of every line I wrote until a compiler agrees with me.
            </p>
            <div className="mt-5 flex flex-wrap gap-1.5">
              <Tag color="#7cff4d">4 debts settled</Tag>
              <Tag color="#ff3d8a">0 runtime dependencies</Tag>
              <Tag color="#3dc8ff">0 image assets</Tag>
              <Tag color="#b46bff">0 audio assets</Tag>
              <Tag color="#ffc13d">0 servers</Tag>
              <Tag color="var(--fi-accent)">1 formula</Tag>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
