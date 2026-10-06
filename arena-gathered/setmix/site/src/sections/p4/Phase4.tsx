import { useState } from "react";
import { Panel, SectionHead, Formula, Tag } from "@/components/ui";
import GLViewport from "@/components/p4/GLViewport";
import AudioDeck from "@/components/p4/AudioDeck";
import { TestRunner, UnrealBridge } from "@/components/p4/TestRunner";
import { cn } from "@/utils/cn";

import srcContracts from "@/drop/contracts.setmix.ts?raw";
import srcFidelity from "@/drop/fidelity.ts?raw";
import srcSpec from "@/drop/fidelity.spec.ts?raw";
import srcTest from "@/drop/fidelity.test.ts?raw";
import srcMaterial from "@/drop/TerrainMaterial.ts?raw";
import srcExport from "@/drop/exportToUnreal.ts?raw";
import srcPython from "@/drop/import_setmix_to_ue5.py?raw";
import srcAudio from "@/drop/setmixAudio.ts?raw";

type File = { path: string; src: string; lang: string; note: string };

const FILES: Record<string, File[]> = {
  "D1 · Monorepo drop": [
    { path: "packages/contracts/src/setmix.ts", src: srcContracts, lang: "ts", note: "Types only. Zero imports — not even @hm/texgraph, whose DAG shape is mirrored structurally so contracts stays the root of the dependency graph." },
    { path: "packages/fidelity/src/index.ts", src: srcFidelity, lang: "ts", note: "The pure math engine. No React, no Three, no DOM, no Node builtins, no clock, no RNG. Every export is referentially transparent." },
    { path: "packages/fidelity/test/specs.ts", src: srcSpec, lang: "ts", note: "Assertions as data, so CI and the live runner above execute byte-identical checks. No drift between what we test and what we claim." },
    { path: "packages/fidelity/test/fidelity.test.ts", src: srcTest, lang: "ts", note: "The node:test adapter plus the golden-file shape check and a source-level purity guard." },
  ],
  "D2 · Uber-shader": [
    { path: "apps/web/src/render/TerrainMaterial.ts", src: srcMaterial, lang: "ts", note: "One GLSL program, all six stages. Every transition is a uniform change — there is no runtime shader compilation anywhere in SetMix, therefore no hitching." },
  ],
  "D3 · UE5 bridge": [
    { path: "packages/export-ue5/src/exportToUnreal.ts", src: srcExport, lang: "ts", note: "Bakes the DAG at up to 8K: sRGB albedo, 16-bit displacement, packed RMA, tangent normals, plus a dense OBJ for Nanite to cluster." },
    { path: "tools/unreal/import_setmix_to_ue5.py", src: srcPython, lang: "py", note: "Runs inside UE 5.5. Idempotent, headless-capable, sets Nanite + Lumen + collision explicitly, and writes the cartridge's VarDecls into asset metadata." },
  ],
  "D4 · Audio engine": [
    { path: "packages/audio/src/setmixAudio.ts", src: srcAudio, lang: "ts", note: "Pure Web Audio. Zero bytes of sample data. Bit depth, Nyquist, stereo width, reverb tail and score intensity are all read-outs of the four metrics." },
  ],
};

/* ─────────────────────────────── tiny syntax highlighter ─────────────── */

function highlight(src: string, lang: string) {
  const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
  const kw = lang === "py"
    ? /\b(def|class|return|import|from|if|elif|else|for|while|try|except|with|as|None|True|False|not|and|or|in|is|lambda|global|raise|assert|yield|pass|continue|break)\b/g
    : /\b(const|let|var|function|return|if|else|for|while|class|interface|type|export|import|from|new|extends|implements|readonly|public|private|async|await|try|catch|throw|typeof|instanceof|in|of|as|null|undefined|true|false|void|this|enum|switch|case|break|continue|default|uniform|varying|attribute|precision|highp|mediump|lowp|out|vec2|vec3|vec4|mat3|mat4|float|int|bool|sampler2D)\b/g;
  let out = esc(src);
  // order matters: comments and strings first, then keywords inside what is left
  out = out.replace(
    lang === "py" ? /(#[^\n]*)/g : /(\/\*[\s\S]*?\*\/|\/\/[^\n]*)/g,
    '<span class="tk-c">$1</span>',
  );
  out = out.replace(/(&quot;|&#39;|["'`])((?:\\.|(?!\1)[^\\])*?)\1/g, '<span class="tk-s">$1$2$1</span>');
  out = out.replace(kw, '<span class="tk-k">$1</span>');
  out = out.replace(/\b(\d+\.?\d*(?:e[-+]?\d+)?)\b/gi, '<span class="tk-n">$1</span>');
  return out;
}

function CodeViewer({ files }: { files: File[] }) {
  const [i, setI] = useState(0);
  const f = files[i];
  const lines = f.src.split("\n");
  return (
    <div className="fi-panel border border-line bg-panel">
      <div className="flex flex-wrap items-center gap-1 border-b border-line bg-panel2 p-2">
        {files.map((x, k) => (
          <button key={x.path} onClick={() => setI(k)}
            className={cn("mono border px-2 py-1 text-[9px] transition-colors",
              i === k ? "border-transparent bg-chalk text-void" : "border-line text-dim hover:text-chalk")}>
            {x.path.split("/").slice(-1)[0]}
          </button>
        ))}
        <span className="mono ml-auto text-[9px] text-dim">
          {lines.length} lines · {(f.src.length / 1024).toFixed(1)} kB
        </span>
      </div>
      <div className="border-b border-line bg-void2 px-3 py-2">
        <div className="mono text-[10.5px] font-bold text-chalk">{f.path}</div>
        <p className="mt-1 text-[11.5px] leading-snug text-dim">{f.note}</p>
      </div>
      <div className="max-h-[520px] overflow-auto bg-void">
        <pre className="mono p-3 text-[10.5px] leading-[1.55]">
          <code dangerouslySetInnerHTML={{ __html: highlight(f.src, f.lang) }} />
        </pre>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────── section ─── */

export default function Phase4() {
  const [tab, setTab] = useState<keyof typeof FILES>("D1 · Monorepo drop");

  return (
    <>
      {/* ───────────────────────────── intro ───────────────────────────── */}
      <section id="p4-top" className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-grid opacity-50" />
        <div className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(ellipse at 50% 0%, var(--fi-accent-soft), transparent 55%)" }} />
        <div className="relative mx-auto max-w-[1400px] px-4 pt-14 pb-8 sm:px-8">
          <div className="mono mb-4 flex flex-wrap items-center gap-2 text-[10px] tracking-[0.3em] uppercase">
            <span className="fi-accent-bg px-2 py-1 font-bold text-void">PHASE 4</span>
            <span className="text-dim">production merge · uber-shader · nanite · audio</span>
          </div>
          <h1 className="text-balance text-[clamp(2.1rem,6vw,4.6rem)] leading-[0.95] font-black tracking-[-0.035em]">
            Four deliverables. All four <span className="fi-accent-text">executing</span> on this page.
          </h1>
          <p className="mt-6 max-w-3xl text-[15px] leading-relaxed text-dim sm:text-[16.5px]">
            The test suite below runs the real <code className="mono text-chalk">packages/fidelity</code> source.
            The terrain is the real GLSL, compiled by your GPU. The manifest is produced by the real
            baker through the real evaluator. The audio is synthesised by the real engine with zero
            bytes of sample data. Nothing here is a mock-up of a deliverable — it <em className="not-italic text-chalk">is</em> the
            deliverable, running.
          </p>
          <div className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {([
              ["D1", "Monorepo drop", "4 files · 1,690 LOC · 30 specs", "#7cff4d"],
              ["D2", "Uber-terrain shader", "1 program · 0 variants · 0 recompiles", "#ff3d8a"],
              ["D3", "UE5.5 Nanite bridge", "TS baker + editor Python", "#b46bff"],
              ["D4", "Procedural audio", "6 stages · 0 assets", "#3dc8ff"],
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

      {/* ───────────────────────────── D2 shader ───────────────────────── */}
      <section id="p4-shader" className="mx-auto max-w-[1400px] px-4 py-16 sm:px-8">
        <SectionHead n="4.1" kicker="Deliverable 2" title="The WebGL2 Uber-Terrain Shader"
          lede="One THREE.ShaderMaterial. Six stages. Zero shader variants, therefore zero runtime compilation, therefore zero hitching — the single most common cause of stutter in modern games. Drag the dial: everything you see changing is a uniform." />
        <GLViewport />
        <div className="mt-3 grid gap-3 lg:grid-cols-3">
          <Panel label="VERTEX · the C¹ geomorph" accent="#7cff4d">
            <Formula>{`float smoothstepC1(float u){
  float t = clamp(u,0.,1.);
  return t*t*(3.-2.*t);          // S'(0)=S'(1)=0
}
// s is a function of WORLD POSITION, never of chunk index —
// that is why neighbours agree on the seam, to the bit.
float s = waveBlend(position.xz);
wp.y = mix(hPrev, hNext, s);`}</Formula>
            <p className="mt-2 text-[12px] leading-relaxed text-dim">
              <code className="mono text-chalk">voxelise()</code> handles CUBIC → CHAMFER → DUAL in
              one expression: at <code className="mono text-chalk">u_vtx = 0</code> it returns a hard
              plateau; the chamfer term reintroduces the true surface continuously. No branch, no
              variant, no pop.
            </p>
          </Panel>
          <Panel label="FRAGMENT · Bayer → PBR" accent="#ff3d8a">
            <Formula>{`// S1/S2  4×4 ordered dither against a palette uniform
float idx = lum*(N-1) + bayer(gl_FragCoord.xy)*1.05;

// S3/S4  gradient-perturbed normals · Beer–Lambert
vec3 absorb = exp(-depth * vec3(2.4,0.9,0.42) * 1.8);
float caus  = caustics(v_world.xz, u_time);

// S5     GGX + Smith, mixed in by smoothstep(u_lx)
float D = distGGX(ndh, rough);
float G = smithG(ndv, ndl, rough);`}</Formula>
            <p className="mt-2 text-[12px] leading-relaxed text-dim">
              The octave loop has a constant bound with a per-octave weight{" "}
              <code className="mono text-chalk">clamp(u_octaves − i, 0, 1)</code>, so raising Pxd
              fades octaves in rather than switching them on. Even the noise detail is C⁰.
            </p>
          </Panel>
          <Panel label="Aq INJECTION" accent="#3dc8ff">
            <Formula>{`v_wet = clamp(u_aq*1.2
  - smoothstep(sea-1., sea+6., wp.y), 0., 1.);

base  = mix(base, base*0.42*tint*2., wet*0.7);
rough = mix(0.92, 0.08, wet);      // specular boost
lit  += skyHorizon * pow(1.-ndv,4.) * 0.55 * u_lx;`}</Formula>
            <p className="mt-2 text-[12px] leading-relaxed text-dim">
              Wetness darkens albedo and drops roughness in the same breath, because that is what
              water physically does: it fills micro-facets. One parameter, two channels, and the
              Fresnel rim arrives for free from the existing <code className="mono text-chalk">ndv</code>.
            </p>
          </Panel>
        </div>
      </section>

      {/* ───────────────────────────── D4 audio ────────────────────────── */}
      <section id="p4-audio" className="mx-auto max-w-[1400px] px-4 py-16 sm:px-8">
        <SectionHead n="4.2" kicker="Deliverable 4" title="The Procedural Audio Synth"
          lede="Press play. Every sound is built from oscillators, seeded pink noise and a WaveShaper quantiser — there is not one byte of sample data in the package. Drag the fidelity dial while it runs and listen to the planet change resolution." />
        <AudioDeck />
        <div className="mt-3 grid gap-3 lg:grid-cols-3">
          <Panel label="THE BIT-CRUSHER IS REAL" accent="#ff3d8a">
            <Formula>{`quantCurve(bits) →
  curve[i] = round(x · 2^bits/2) / (2^bits/2)

Pxd → bits    4 → 16        (WaveShaper)
Pxd → Nyquist 4k → 24 kHz   (steep low-pass)`}</Formula>
            <p className="mt-2 text-[12px] leading-relaxed text-dim">
              A WaveShaper whose curve rounds to 2ⁿ levels <em className="not-italic text-chalk">is</em> a
              bit-crusher. The quantisation error is the sound. Pxd drives it continuously, so
              Stage 1 → 2 is an audible resolution increase rather than a swapped asset.
            </p>
          </Panel>
          <Panel label="REVERB FROM GEOMETRY" accent="#ffc13d">
            <Formula>{`ir[i] = (rng()*2-1) · (1-t)^(2.4 + occupancy·2.2)
earlyReflections = 4 + occupancy·6
tail = 0.08 + Lx^1.3 · 3.4   seconds`}</Formula>
            <p className="mt-2 text-[12px] leading-relaxed text-dim">
              The impulse response is generated, not recorded: exponentially-decaying noise plus an
              early-reflection cluster whose spacing is the room size. A canyon echoes because the
              chunk occupancy says it is a canyon.
            </p>
          </Panel>
          <Panel label="THE SCORE TRACKS dFi/dt" accent="var(--fi-accent)">
            <Formula>{`drive = min(1, |dFi/dt| / 2200)
bus   = unlock · (0.05 + drive·0.3)`}</Formula>
            <p className="mt-2 text-[12px] leading-relaxed text-dim">
              The music rewards <em className="not-italic text-chalk">improving</em> the planet, not
              having improved it. Reaching Stage 6 and idling is quiet; a Render Pass is a
              crescendo. The score also sits after the crusher — it is non-diegetic, so the
              planet's render fidelity never degrades it. Only its volume responds.
            </p>
          </Panel>
        </div>
      </section>

      {/* ───────────────────────────── D1 tests ────────────────────────── */}
      <section id="p4-tests" className="mx-auto max-w-[1400px] px-4 py-16 sm:px-8">
        <SectionHead n="4.3" kicker="Deliverable 1" title="The Suite, Running"
          lede="Thirty specs covering determinism, the fidelity algebra, the 24-permutation golden budget table, 72 adaptGraph round trips and 10,000 random seam-key pairs. These are the same assertions node --test executes in CI — imported from the same file, not re-written." />
        <TestRunner />
        <div className="mt-3 grid gap-3 lg:grid-cols-4">
          {([
            ["1,000×", "determinism loops", "contentHash, fuse() and a 1,200-tick stepFidelity replay must each produce exactly one hash.", "#7cff4d"],
            ["24", "golden permutations", "6 stages × 4 devices. Size on the ladder, octaves in budget, stage identical across devices.", "#ffc13d"],
            ["72", "adaptGraph round trips", "3 cartridges × 4 devices × 6 stages, each checked for a live albedo and zero orphan edges.", "#3dc8ff"],
            ["10,000", "seam-key pairs", "Random policy pairs must agree on their shared boundary ring. Zero disagreements permitted.", "#b46bff"],
          ] as const).map(([n, t, d, c]) => (
            <Panel key={t} label={t} accent={c}>
              <div className="text-2xl leading-none font-black" style={{ color: c }}>{n}</div>
              <p className="mt-2 text-[11.5px] leading-snug text-dim">{d}</p>
            </Panel>
          ))}
        </div>
      </section>

      {/* ───────────────────────────── D3 unreal ───────────────────────── */}
      <section id="p4-unreal" className="mx-auto max-w-[1400px] px-4 py-16 sm:px-8">
        <SectionHead n="4.4" kicker="Deliverable 3" title="The Unreal Engine 5.5 Nanite Bridge"
          lede="SetMix runs procedurally on the web; Unreal wants Nanite clusters and virtual textures. So the export is a bake — and it reuses the SAME governor the game uses, so what UE receives is exactly what Stage 6 looks like in the browser. Press the button: the manifest below is generated by the real baker." />
        <UnrealBridge />
        <div className="mt-3 grid gap-3 lg:grid-cols-3">
          <Panel label="WHY 16-BIT DISPLACEMENT" accent="#b46bff">
            <p className="text-[12.5px] leading-relaxed text-dim">
              8 bits across an 82 m displacement range is 32 cm per step, which terraces visibly
              under Lumen's soft GI — the exact artefact the player spent 40 hours eliminating.
              16-bit is 1.25 mm and costs 32 MB. For a hero asset that is the right trade, and the
              manifest declares it so the importer never guesses.
            </p>
          </Panel>
          <Panel label="NANITE WANTS IT DENSE" accent="#7cff4d">
            <p className="text-[12.5px] leading-relaxed text-dim">
              We ship 512² quads — 524,288 triangles — with{" "}
              <code className="mono text-chalk">remove_degenerates = False</code> and{" "}
              <code className="mono text-chalk">keep_percent_triangles = 100</code>. Pre-decimating
              before import actively harms cluster quality: Nanite's own simplifier is better than
              ours and it needs the source detail to work from.
            </p>
          </Panel>
          <Panel label="THE KNOBS SURVIVE THE TRIP" accent="#ffc13d">
            <p className="text-[12.5px] leading-relaxed text-dim">
              Each cartridge's eight exposed <code className="mono text-chalk">VarDecl</code>s become
              UE material scalar parameters <em className="not-italic">and</em> asset metadata tags
              carrying the poetic name, the real name, the range, the unit and the one-sentence
              explanation. A tech artist in Unreal sees exactly what the player saw in the lab.
            </p>
          </Panel>
        </div>
      </section>

      {/* ───────────────────────────── source ──────────────────────────── */}
      <section id="p4-source" className="mx-auto max-w-[1400px] px-4 py-16 sm:px-8">
        <SectionHead n="4.5" kicker="Paste-ready" title="The Source"
          lede="Eight files, every one of them loaded verbatim from this build — the viewer below reads the exact bytes that the demos above are executing." />
        <div className="mb-3 flex flex-wrap gap-2">
          {(Object.keys(FILES) as (keyof typeof FILES)[]).map((k) => (
            <button key={k} onClick={() => setTab(k)}
              className={cn("mono flex-1 border px-3 py-2 text-[10px] font-bold tracking-[0.15em] uppercase transition-all",
                tab === k ? "fi-accent-border bg-panel2 text-chalk" : "border-line text-dim hover:text-chalk")}>
              {k}
            </button>
          ))}
        </div>
        <CodeViewer key={tab} files={FILES[tab]} />

        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <Panel label="MERGE CHECKLIST" accent="#7cff4d">
            <Formula>{`PR 1  packages/contracts/src/setmix.ts        + export from index
      packages/fidelity/{src,test}             new package, 0 deps
      → node scripts/verify.mjs fidelity

PR 2  packages/cartridge  kernel adapter      (schema + commands)
PR 3  packages/field, packages/mesh           (120 Hz sim)
PR 4  apps/web/src/render/TerrainMaterial.ts  (+ three peer dep)
      packages/audio                          (0 deps)
PR 5  packages/export-ue5 + tools/unreal      (opt-in, CLI only)`}</Formula>
            <p className="mt-2 text-[12px] leading-relaxed text-dim">
              PR 1 is still pure functions and still cannot break anything that exists today.
              The shader lands with the web client; the UE bridge is opt-in and never imported
              by <code className="mono text-chalk">apps/web</code>, so the single-file build is unaffected.
            </p>
          </Panel>
          <Panel label="WHAT WE STILL OWE YOU" accent="#ffc13d">
            <ul className="space-y-2 text-[12.5px] leading-relaxed text-dim">
              <li className="flex gap-2"><span className="mono text-lx">1.</span>
                <span><code className="mono text-chalk">M_SetMix_Nanite_Master</code> — the UE master material the Python script parents to. Ships as a small content plugin; the manifest already names every parameter it must expose.</span></li>
              <li className="flex gap-2"><span className="mono text-lx">2.</span>
                <span>A Node PNG encoder binding (sharp or pngjs). <code className="mono text-chalk">encodePng</code> is injected precisely so the package stays pure — the browser path above uses OffscreenCanvas.</span></li>
              <li className="flex gap-2"><span className="mono text-lx">3.</span>
                <span>Worker-pool wrapper for 4K/8K bakes. The baker is synchronous and pure, so this is scheduling, not refactoring.</span></li>
              <li className="flex gap-2"><span className="mono text-lx">4.</span>
                <span>The <code className="mono text-chalk">opts.into?: EvaluatedTexture</code> write-target from Phase 3 — still the single highest-value texgraph change for us.</span></li>
            </ul>
            <div className="mt-3 flex flex-wrap gap-1">
              <Tag color="#7cff4d">30 specs green</Tag>
              <Tag color="#ff3d8a">0 shader variants</Tag>
              <Tag color="#3dc8ff">0 audio assets</Tag>
              <Tag color="#b46bff">0 server</Tag>
            </div>
          </Panel>
        </div>
      </section>
    </>
  );
}
