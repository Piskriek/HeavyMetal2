import { useState } from "react";
import { Panel, SectionHead, Formula } from "@/components/ui";
import RaceLab from "@/components/p8/RaceLab";
import GpuLab from "@/components/p8/GpuLab";
import DialogueLab from "@/components/p8/DialogueLab";
import SaveLab from "@/components/p8/SaveLab";
import { CHASSIS, peakSlipDeg } from "@/drop/GoblinRover";
import { cn } from "@/utils/cn";

import srcRover from "@/drop/GoblinRover.ts?raw";
import srcRace from "@/drop/RaceEngine.ts?raw";
import srcWgsl from "@/drop/SetmixWGSL.ts?raw";
import srcPipeline from "@/drop/GpuComputePipeline.ts?raw";
import srcDialogue from "@/drop/DialogueEngine.ts?raw";
import srcTrader from "@/drop/GoblinTrader.ts?raw";
import srcSave from "@/drop/SaveEngine.ts?raw";
import srcDesktop from "@/drop/desktop.ts?raw";

type F = { path: string; src: string; note: string };
const FILES: Record<string, F[]> = {
  "D1 · Vehicle": [
    { path: "packages/setmix-vehicle/src/GoblinRover.ts", src: srcRover,
      note: "Raycast spring-damper suspension, Pacejka Magic Formula tyres with load-dependent peak, boost, spring-arm chase camera and mount/dismount." },
    { path: "packages/setmix-vehicle/src/RaceEngine.ts", src: srcRace,
      note: "Catmull-Rom gate splines, plane-test scoring that cannot be tunnelled, and a 9-byte-per-keyframe ghost with Hermite playback." },
  ],
  "D2 · WebGPU": [
    { path: "packages/setmix-compute/src/SetmixWGSL.ts", src: srcWgsl,
      note: "Five WGSL kernels: density + erosion, Surface Nets vertices + quads, and the one-invocation indirect-args writer." },
    { path: "packages/setmix-compute/src/GpuComputePipeline.ts", src: srcPipeline,
      note: "Capability negotiation that checks limits and software adapters, not just feature flags. Buffer pool planned once, never per frame." },
  ],
  "D3 · Dialogue": [
    { path: "packages/setmix-dialogue/src/DialogueEngine.ts", src: srcDialogue,
      note: "Text → phoneme schedule → a three-bandpass source-filter vocal tract. Deterministic: the same line sounds the same on every machine." },
    { path: "packages/setmix-dialogue/src/GoblinTrader.ts", src: srcTrader,
      note: "Deterministic pricing from (good, stock, reputation, stage) — so two peers compute the same price with no server and no transaction." },
  ],
  "D4 · Desktop": [
    { path: "packages/setmix-desktop/src/SaveEngine.ts", src: srcSave,
      note: "TLV binary format with CRC-32, LEB128 varints, 16-bit quantised machine positions and RLE voxel deltas. Unknown tags are skipped, not fatal." },
    { path: "packages/setmix-desktop/src/desktop.ts", src: srcDesktop,
      note: "Host abstraction for Tauri / Electron / browser, tick-based cloud conflict resolution, and the actual tauri.conf.json + main.rs." },
  ],
};

function hl(src: string) {
  const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
  let o = esc(src);
  o = o.replace(/(\/\*[\s\S]*?\*\/|\/\/[^\n]*)/g, '<span class="tk-c">$1</span>');
  o = o.replace(/(&quot;|&#39;|["'`])((?:\\.|(?!\1)[^\\])*?)\1/g, '<span class="tk-s">$1$2$1</span>');
  o = o.replace(/\b(const|let|var|function|return|if|else|for|while|class|interface|type|export|import|from|new|extends|readonly|public|private|async|await|try|catch|throw|typeof|in|of|as|null|undefined|true|false|void|this|switch|case|break|continue|default|fn|struct|u32|f32|i32|vec3|vec4)\b/g, '<span class="tk-k">$1</span>');
  o = o.replace(/\b(\d+\.?\d*(?:e[-+]?\d+)?)\b/gi, '<span class="tk-n">$1</span>');
  return o;
}

function Source() {
  const [tab, setTab] = useState<keyof typeof FILES>("D1 · Vehicle");
  const [i, setI] = useState(0);
  const files = FILES[tab];
  const f = files[Math.min(i, files.length - 1)];
  return (
    <div className="fi-panel border border-line bg-panel">
      <div className="flex flex-wrap gap-1 border-b border-line bg-void2 p-2">
        {(Object.keys(FILES) as (keyof typeof FILES)[]).map((k) => (
          <button key={k} onClick={() => { setTab(k); setI(0); }}
            className={cn("mono flex-1 border px-2 py-1.5 text-[9.5px] font-bold tracking-wider uppercase",
              tab === k ? "fi-accent-border bg-panel2 text-chalk" : "border-line text-dim hover:text-chalk")}>
            {k}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1 border-b border-line bg-panel2 p-2">
        {files.map((x, k) => (
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

export default function Phase8() {
  return (
    <>
      <section id="p8-top" className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-grid opacity-50" />
        <div className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(ellipse at 60% 0%, var(--fi-accent-soft), transparent 55%)" }} />
        <div className="relative mx-auto max-w-[1400px] px-4 pt-14 pb-8 sm:px-8">
          <div className="mono mb-4 flex flex-wrap items-center gap-2 text-[10px] tracking-[0.3em] uppercase">
            <span className="fi-accent-bg px-2 py-1 font-bold text-void">PHASE 8</span>
            <span className="text-dim">racing · webgpu · dialogue · standalone</span>
          </div>
          <h1 className="text-balance text-[clamp(2.1rem,6vw,4.6rem)] leading-[0.95] font-black tracking-[-0.035em]">
            Drive it, compute it, talk to it, <span className="fi-accent-text">ship</span> it.
          </h1>
          <p className="mt-6 max-w-3xl text-[15px] leading-relaxed text-dim sm:text-[16.5px]">
            Four engines that turn a terraformed planet into a destination: a rover whose physics
            are built around 1/6 g rather than fighting it, a GPU pipeline where the triangle count
            never enters JavaScript, goblins who speak from their own text, and a 40-hour save that
            fits in a tweet's worth of kilobytes.
          </p>
          <div className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {([
              ["D1", "Rover & racing", "Pacejka · spring-damper · 2 kB ghosts", "#ffc13d"],
              ["D2", "WebGPU compute", "5 WGSL kernels · 0 readback", "#7cff4d"],
              ["D3", "Dialogue & barter", "formant synth · 0 voice assets", "#b46bff"],
              ["D4", "Desktop & saves", "TLV + CRC-32 · Tauri 8.4 MB", "#3dc8ff"],
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
      <section id="p8-race" className="mx-auto max-w-[1400px] px-4 py-16 sm:px-8">
        <SectionHead n="8.1" kicker="Deliverable 1" title="The Goblin Rover & Planetary Racing"
          lede="Low gravity is the whole design, not an obstacle to it. At 1.62 m/s² a conventional car model feels broken — wheels unload on every crest and never find grip. So the chassis is pressed down by its springs rather than its weight, and the tyre's peak slip angle falls with load, which is exactly what makes crater-rim powersliding read as skill instead of ice." />
        <RaceLab />
        <div className="mt-3 grid gap-3 lg:grid-cols-3">
          <Panel label="PACEJKA'S MAGIC FORMULA" accent="#ffc13d">
            <Formula>{`F = D·sin(C·atan(B·α − E·(B·α − atan(B·α))))

D = peak   ← scales with NORMAL LOAD
C = shape  B = stiffness  E = curvature`}</Formula>
            <p className="mt-2 text-[12px] leading-relaxed text-dim">
              D scaling with load is the term that makes 1/6 g interesting: a wheel that has just
              crested a rim carries almost no load, its peak lateral force collapses, and the back
              steps out. The player learns to weight the rover before turning{" "}
              <em className="not-italic text-chalk">without ever being told</em>.
            </p>
            <div className="mono mt-2 border-t border-line pt-2 text-[9.5px]">
              {(Object.keys(CHASSIS) as (keyof typeof CHASSIS)[]).map((k) => (
                <div key={k} className="flex justify-between py-[2px]">
                  <span className="text-dim">{k.replace("_", " ").toLowerCase()}</span>
                  <span className="tnum text-chalk">peak {peakSlipDeg(CHASSIS[k]).toFixed(1)}°</span>
                </div>
              ))}
            </div>
          </Panel>
          <Panel label="SPRING-DAMPER, CLAMPED" accent="#7cff4d">
            <Formula>{`F = −k·x − c·v      (per wheel, per tick)
  x = restLength − rayLength
  v = (length − lastLength) / dt
  F = max(0, F)        suspension pushes, never pulls
  bump stop: x > maxTravel → +6k`}</Formula>
            <p className="mt-2 text-[12px] leading-relaxed text-dim">
              The damper coefficient is scaled by <em className="not-italic text-chalk">Vtx</em>:
              at Stage 1 the ground is a staircase, so we stiffen it 2.1× to stop the rover
              pogoing on steps. The suspension is the first system in the game that reads the
              fidelity metrics for a purely tactile reason.
            </p>
          </Panel>
          <Panel label="THE 2 kB GHOST" accent="#b46bff">
            <Formula>{`naive:  7 floats × 4 B × 120 Hz = 3.4 kB/s
ours:   16-bit pos · 1-byte yaw · 1 flag byte
        = 9 B @ 12 Hz            = 108 B/s   (31× less)`}</Formula>
            <p className="mt-2 text-[12px] leading-relaxed text-dim">
              A 2-minute lap would have been 400 kB — two thousand times the size of the planet it
              was driven on. Resampled to 12 Hz and replayed with cubic Hermite it is
              indistinguishable, and the <strong className="text-chalk">same 9-byte frame is the
              live multiplayer packet</strong>: a remote racer is simply a ghost whose frames are
              arriving in real time. Eight racers cost 864 B/s.
            </p>
          </Panel>
        </div>
      </section>

      {/* ── D2 ─────────────────────────────────────────────────────── */}
      <section id="p8-gpu" className="mx-auto max-w-[1400px] px-4 py-16 sm:px-8">
        <SectionHead n="8.2" kicker="Deliverable 2" title="Native WebGPU WGSL Compute"
          lede='"Does navigator.gpu exist" is not the question. Press the SwiftShader button below: that adapter reports full WebGPU support and is roughly 6× slower than our worker path, so we check the adapter description and refuse it on purpose. Negotiation, not feature detection.' />
        <GpuLab />
        <div className="mt-3 grid gap-3 lg:grid-cols-3">
          <Panel label="ZERO READBACK IS THE POINT" accent="#7cff4d">
            <Formula>{`CPU per frame:
  queue.writeBuffer(params, 64 B)
  dispatch × 5
  renderPass.drawIndexedIndirect(drawArgs, 0)

  await buffer.mapAsync()   ← NEVER`}</Formula>
            <p className="mt-2 text-[12px] leading-relaxed text-dim">
              A single <code className="mono text-chalk">mapAsync</code> stalls the pipeline for a
              full frame and is the reason most GPU meshers end up slower than CPU ones. Pass 3 is
              one invocation that writes <code className="mono text-chalk">indexCount</code> into
              the indirect buffer and resets the atomics — the triangle count never enters
              JavaScript, and the CPU issues a draw against a buffer it has never read.
            </p>
          </Panel>
          <Panel label="SURFACE NETS, NOT MARCHING CUBES" accent="#3dc8ff">
            <p className="text-[12.5px] leading-relaxed text-dim">
              One vertex per cell instead of up to five, no 256-entry triangle table in constant
              memory, and the dual mesh is <em className="not-italic text-chalk">exactly</em> what{" "}
              <code className="mono text-chalk">@hm/smoothvox2</code> consumes on the CPU path.
              Identical topology on both backends is worth more than MC's marginally sharper
              features — it is what makes a WebGPU host and a WebGL2 guest legal in the same
              multiplayer session.
            </p>
          </Panel>
          <Panel label="A SECOND DISPATCH, NOT A BARRIER" accent="#ffc13d">
            <p className="text-[12.5px] leading-relaxed text-dim">
              Quad emission needs every <code className="mono text-chalk">cellVertex</code> written
              first. A <code className="mono text-chalk">workgroupBarrier()</code> would only
              synchronise within a workgroup — a classic and silent correctness bug. Splitting
              into pass 2a/2b costs one extra dispatch, which is roughly four microseconds, and is
              provably correct.
            </p>
          </Panel>
        </div>
      </section>

      {/* ── D3 ─────────────────────────────────────────────────────── */}
      <section id="p8-npc" className="mx-auto max-w-[1400px] px-4 py-16 sm:px-8">
        <SectionHead n="8.3" kicker="Deliverable 3" title="Diegetic Dialogue & The Barter Market"
          lede="No voice actors, no localisation budget, no 400 MB of .wav. Goblin speech is synthesised from the text itself — a buzzy glottal source through three bandpass filters tuned to real measured vowel formants. Click an NPC and listen; the formant trace plots underneath in real time." />
        <DialogueLab />
        <div className="mt-3 grid gap-3 lg:grid-cols-3">
          <Panel label="THE SOURCE-FILTER MODEL" accent="#b46bff">
            <Formula>{`sawtooth ──┬── BPF @ F1 ──┐
           ├── BPF @ F2 ──┼── env ── out
           └── BPF @ F3 ──┘
noise ─────────────────────┘  (consonant bursts)`}</Formula>
            <p className="mt-2 text-[12px] leading-relaxed text-dim">
              A vowel is two resonant peaks in the vocal tract — F1 is tongue height, F2 is
              backness. Three biquads per <em className="not-italic">utterance</em>, not per phone:
              we automate the filter frequencies along the schedule, which is cheaper{" "}
              <em className="not-italic text-chalk">and</em> more convincing, because real formants
              glide between vowels. Those glides are what make it read as a language rather than
              as Morse code.
            </p>
          </Panel>
          <Panel label="DETERMINISM BUYS SYNC FOR FREE" accent="#3dc8ff">
            <p className="text-[12.5px] leading-relaxed text-dim">
              The same string always produces the same phoneme schedule, so the balloon's letter
              reveal stays locked to the audio with{" "}
              <strong className="text-chalk">zero synchronisation data</strong>, and a remote
              player hears exactly what the speaker heard. Nine bytes of state, in every language,
              forever.
            </p>
          </Panel>
          <Panel label="SHOPS USUALLY KILL CRAFTING" accent="#ffc13d">
            <p className="text-[12.5px] leading-relaxed text-dim">
              Ours cannot, because traded cartridges are <strong className="text-chalk">inputs,
              never outputs</strong>. Every legendary is fusable; the interesting play is fusing a
              bought exotic with something you made. You cannot buy a finished planet — only a verb
              you did not know existed. Each good lists the{" "}
              <code className="mono text-chalk">exoticNodes</code> the Synthesizer lacks, which is
              the honest reason it is unbuildable.
            </p>
          </Panel>
        </div>
      </section>

      {/* ── D4 ─────────────────────────────────────────────────────── */}
      <section id="p8-save" className="mx-auto max-w-[1400px] px-4 py-16 sm:px-8">
        <SectionHead n="8.4" kicker="Deliverable 4" title="Binary Saves & Desktop Standalone"
          lede="Drag the sliders to a 200-hour planet with 400 machines and watch the file stay under 64 kB. Not compression — omission. Then press 'flip a bit': CRC-32 refuses the file before a single field is trusted, and the autosave ring recovers." />
        <SaveLab />
        <div className="mt-3 grid gap-3 lg:grid-cols-3">
          <Panel label="UNKNOWN TAGS ARE SKIPPED" accent="#3dc8ff">
            <Formula>{`[u32 tag][u32 byteLength][payload]

default:
  unknownTags.push(tag);   // skip, record, carry on`}</Formula>
            <p className="mt-2 text-[12px] leading-relaxed text-dim">
              Eight bytes of overhead per chunk, and in exchange a save written by 1.4 still loads
              in 1.0. That single <code className="mono text-chalk">default:</code> branch is the
              difference between a format and a liability.
            </p>
          </Panel>
          <Panel label="CLOUD CONFLICTS RESOLVE THEMSELVES" accent="#7cff4d">
            <p className="text-[12.5px] leading-relaxed text-dim">
              Steam's default dialog asks the player to pick a save by timestamp — a terrible
              question, because they cannot know what is in either. Our saves carry a monotonic
              sim <strong className="text-chalk">tick</strong>: more ticks is strictly more play.
              We only ask when both advanced within two minutes of each other, which is genuine
              parallel play and genuinely rare.
            </p>
          </Panel>
          <Panel label="THE WEB BUILD IS THE DESKTOP BUILD" accent="#ffc13d">
            <p className="text-[12.5px] leading-relaxed text-dim">
              One static HTML file, no server, no asset pipeline. Tauri wraps the identical bytes
              the browser runs in <strong className="text-chalk">8.4 MB</strong> against Electron's
              142, because it uses the OS webview — and WebGPU is already in WebView2 and
              WKWebView. A bug reported on itch reproduces in the Steam build by construction.
            </p>
          </Panel>
        </div>
      </section>

      {/* ── SOURCE ─────────────────────────────────────────────────── */}
      <section id="p8-source" className="mx-auto max-w-[1400px] px-4 py-16 sm:px-8">
        <SectionHead n="8.5" kicker="Paste-ready" title="The Source"
          lede="Eight modules, loaded verbatim from this build — the same bytes the four labs above are executing." />
        <Source />
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <Panel label="MERGE PLAN · PRs 14–17" accent="#7cff4d">
            <Formula>{`PR 14  packages/setmix-vehicle    ~730 LOC  pure, 120 Hz
PR 15  packages/setmix-compute   ~690 LOC  WGSL + negotiation
PR 16  packages/setmix-dialogue  ~640 LOC  pure + AudioContext
PR 17  packages/setmix-desktop   ~820 LOC  pure + injected host

total Phase 8: ~2,880 LOC · 0 runtime deps · 0 assets`}</Formula>
            <p className="mt-2 text-[12px] leading-relaxed text-dim">
              Every module still takes its renderer, audio context, GPU and filesystem as{" "}
              <em className="not-italic text-chalk">injected</em> interfaces, so all four remain
              headlessly testable and none of them pulls three.js, Tauri or a network stack into{" "}
              <code className="mono text-chalk">packages/</code>.
            </p>
          </Panel>
          <Panel label="WHAT PHASE 8 CHANGES ABOUT THE GAME" accent="var(--fi-accent)">
            <ul className="space-y-1.5 text-[12px] leading-relaxed text-dim">
              <li className="flex gap-2"><span className="text-lx">→</span><span><strong className="text-chalk">Roads become racing lines.</strong> The Carved Cobblestone Road cartridge from GDD §2 now has a mechanical consequence: +28% grip in the Pacejka term, which a player can feel before they can measure.</span></li>
              <li className="flex gap-2"><span className="text-lx">→</span><span><strong className="text-chalk">The planet becomes a destination.</strong> Ghost laps and 864 B/s multiplayer mean a finished moon is somewhere other people drive, not just somewhere they look.</span></li>
              <li className="flex gap-2"><span className="text-lx">→</span><span><strong className="text-chalk">The Lab gets a horizon.</strong> Skree's exotics preview node types the Synthesizer has not unlocked, so the shop is a roadmap you can hold.</span></li>
              <li className="flex gap-2"><span className="text-lx">→</span><span><strong className="text-chalk">It is shippable.</strong> 8.4 MB, offline, one binary for itch and Steam, saves that survive a power cut and a version bump.</span></li>
            </ul>
            <p className="mt-3 border-l-2 fi-accent-border pl-3 text-[12.5px] leading-relaxed text-chalk/90">
              The rover's suspension damping reads Vtx. The thruster plumes are the chimney motes.
              The ghost quantises into the track AABB the same way the Galaxy quantises terrain
              deltas. Eight phases in, every new system still reads the same four floats.
            </p>
          </Panel>
        </div>
      </section>
    </>
  );
}
