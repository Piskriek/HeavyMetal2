import { useState } from "react";
import { Panel, SectionHead, Formula, Tag } from "@/components/ui";
import PortalDemo from "@/components/p5/PortalDemo";
import GoblinLab from "@/components/p5/GoblinLab";
import GridLab from "@/components/p5/GridLab";
import GalaxyLab from "@/components/p5/GalaxyLab";
import { MACHINES } from "@/drop/machines";
import { MOVE_TIERS } from "@/drop/GoblinController";
import { cn } from "@/utils/cn";

import srcPortal from "@/drop/PortalRenderer.ts?raw";
import srcGoblin from "@/drop/GoblinController.ts?raw";
import srcAvatar from "@/drop/AvatarFidelityManager.ts?raw";
import srcMachines from "@/drop/machines.ts?raw";
import srcGalaxy from "@/drop/galaxy.ts?raw";

type F = { path: string; src: string; note: string };
const FILES: F[] = [
  { path: "packages/portal/src/PortalRenderer.ts", src: srcPortal,
    note: "Stencil masking, the V = D·Ry(180°)·F⁻¹·C virtual camera, Lengyel oblique near-plane clipping, and the threshold state machine as a pure 120 Hz reducer." },
  { path: "packages/goblin-controller/src/GoblinController.ts", src: srcGoblin,
    note: "One integrator, four tiers of coefficients. The Stage-1 position quantum dissolves continuously rather than switching off." },
  { path: "packages/goblin-controller/src/AvatarFidelityManager.ts", src: srcAvatar,
    note: "Closed-form two-bone IK, critically-damped head-look with real neck limits, position-based Verlet cape, and the material accumulation model." },
  { path: "packages/setmix-machines/src/index.ts", src: srcMachines,
    note: "Union-find grid islands, load² thermal model, brownout-as-de-resolution, and the instanced pixel plume that dissipates into the wave band." },
  { path: "packages/galaxy/src/index.ts", src: srcGalaxy,
    note: "The .galaxy.json manifest, content-addressed streaming, deterministic reconstruction, and the RLE SDF delta codec." },
];

function highlight(src: string) {
  const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
  let out = esc(src);
  out = out.replace(/(\/\*[\s\S]*?\*\/|\/\/[^\n]*)/g, '<span class="tk-c">$1</span>');
  out = out.replace(/(&quot;|&#39;|["'`])((?:\\.|(?!\1)[^\\])*?)\1/g, '<span class="tk-s">$1$2$1</span>');
  out = out.replace(
    /\b(const|let|var|function|return|if|else|for|while|class|interface|type|export|import|from|new|extends|readonly|public|private|async|await|try|catch|throw|typeof|in|of|as|null|undefined|true|false|void|this|switch|case|break|continue|default|uniform|in|out|vec2|vec3|vec4|mat4|float|int)\b/g,
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

export default function Phase5() {
  return (
    <>
      <section id="p5-top" className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-grid opacity-50" />
        <div className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(ellipse at 35% 0%, var(--fi-accent-soft), transparent 55%)" }} />
        <div className="relative mx-auto max-w-[1400px] px-4 pt-14 pb-8 sm:px-8">
          <div className="mono mb-4 flex flex-wrap items-center gap-2 text-[10px] tracking-[0.3em] uppercase">
            <span className="fi-accent-bg px-2 py-1 font-bold text-void">PHASE 5</span>
            <span className="text-dim">portal · avatar · automation · federation</span>
          </div>
          <h1 className="text-balance text-[clamp(2.1rem,6vw,4.6rem)] leading-[0.95] font-black tracking-[-0.035em]">
            The four engines that make it a <span className="fi-accent-text">game</span>.
          </h1>
          <p className="mt-6 max-w-3xl text-[15px] leading-relaxed text-dim sm:text-[16.5px]">
            Everything before this was a world that could change. These are the systems that let
            somebody <em className="not-italic text-chalk">live</em> in it: an archway you can put
            your hand through, a body that learns to walk as the planet learns to have slopes, a
            factory that browns out, and a 200-kilobyte planet another player can walk into.
          </p>
          <div className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {([
              ["D1", "Seamless portal", "stencil + oblique clip + threshold FSM", "#b46bff"],
              ["D2", "Goblin controller", "4 locomotion tiers · IK · Verlet cape", "#7cff4d"],
              ["D3", "Machines & grid", "islands · load² heat · instanced plumes", "#ffc13d"],
              ["D4", "Voxel Galaxy", "~200 kB planets, derived not transferred", "#3dc8ff"],
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

      {/* ── D1 PORTAL ───────────────────────────────────────────────── */}
      <section id="p5-portal" className="mx-auto max-w-[1400px] px-4 py-16 sm:px-8">
        <SectionHead n="5.1" kicker="Deliverable 1" title="The Seamless Archway"
          lede="Two worlds, one framebuffer, no render target. The moon is not a texture on a quad — it is the moon, rendered through a stencil-masked virtual camera whose near plane has been skewed onto the portal itself. Toggle either mechanism off below and watch exactly which artefact it was preventing." />
        <PortalDemo />
        <div className="mt-3 grid gap-3 lg:grid-cols-3">
          <Panel label="THE VIRTUAL CAMERA" accent="#b46bff">
            <Formula>{`V = D · Ry(180°) · F⁻¹ · C

F = source portal frame
D = destination portal frame
C = the real camera`}</Formula>
            <p className="mt-2 text-[12px] leading-relaxed text-dim">
              Read right to left: take the camera into the source arch's local space, turn it
              around — you exit facing away from the arch you entered — then push it out into the
              destination's world. Because it is <strong className="text-chalk">one matrix
              product</strong>, parallax, roll, head-bob and FOV all come out correct for free.
              There is no special case for "player is looking at the portal from an angle",
              because that case does not exist.
            </p>
          </Panel>
          <Panel label="OBLIQUE NEAR-PLANE CLIP" accent="#ff3d8a">
            <Formula>{`Q   = (sign(c.x)+P₈)/P₀, (sign(c.y)+P₉)/P₅, −1, (1+P₁₀)/P₁₄
c'  = c · (2 / (c·Q))
P₂  = c'.x   P₆ = c'.y   P₁₀ = c'.z + 1   P₁₄ = c'.w`}</Formula>
            <p className="mt-2 text-[12px] leading-relaxed text-dim">
              Lengyel's construction. The near plane becomes the portal plane, so geometry between
              the virtual camera and the arch is removed{" "}
              <em className="not-italic text-chalk">by the rasteriser</em> — we are not hiding it,
              we are deleting the depth range it would have occupied. The scale factor is what
              keeps the far plane where it was.
            </p>
          </Panel>
          <Panel label="THE PASS NOBODY REMEMBERS" accent="#ffc13d">
            <Formula>{`1. stencil ← aperture  (colour+depth writes OFF)
2. clear DEPTH inside the stencil only   ← this one
3. destination world, stencilFunc(EQUAL)
4. source world, stencil off`}</Formula>
            <p className="mt-2 text-[12px] leading-relaxed text-dim">
              Skip step 2 and the lab's depth values reject the moon's geometry: the portal
              presents as a flat grey hole, or the two worlds z-fight along the floor. It is three
              lines and it is the difference between shipping and not.
            </p>
          </Panel>
        </div>
        <div className="mt-3">
          <Panel label="THE THRESHOLD IS A FUNCTION, NOT AN EVENT" accent="var(--fi-accent)">
            <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
              <div>
                <Formula>{`stepThreshold(prev, portal, headPos, handPos) → {
  phase: AWAY | APPROACHING | REACHING | CROSSING | SETTLING
  distance, t ∈ [−1,1], form, world,
  dissolve = S((1−t)/2),        // the SAME C¹ curve as the geomorph
  audioMix, justCrossed, handThrough
}`}</Formula>
                <p className="mt-2 text-[12.5px] leading-relaxed text-dim">
                  The band is deliberately asymmetric — 0.55 m going in, 0.85 m coming out — so the
                  transformation completes slightly <em className="not-italic text-chalk">after</em>{" "}
                  you commit. The player watches their new hands arrive rather than finding them
                  already there.
                </p>
              </div>
              <div className="space-y-2 text-[12.5px] leading-relaxed text-dim">
                <p>
                  <strong className="text-chalk">Ownership flips at the plane, not at the end of
                  the dissolve.</strong> That is why you can stand with your head in the lab and
                  your hand on the moon and have both render correctly: each is simply a signed
                  distance from one plane, evaluated independently.
                </p>
                <p>
                  <strong className="text-chalk">The coordinate transform is composed, never
                  stored.</strong> <code className="mono text-chalk">makeSpaceTransform</code>{" "}
                  derives lab↔planet from the two portal matrices on demand. There is no second
                  copy of the player's position, so there is nothing to desync.
                </p>
                <p>
                  <strong className="text-chalk">The audio crossfade is equal-power.</strong> A
                  linear fade between two uncorrelated buses dips ~3 dB in the middle and the
                  player hears that dip as a seam. The portal's own hum fills the centre, and its
                  pitch rides bandwidth — so upgrading the link is audible before it is visible.
                </p>
              </div>
            </div>
          </Panel>
        </div>
      </section>

      {/* ── D2 GOBLIN ───────────────────────────────────────────────── */}
      <section id="p5-goblin" className="mx-auto max-w-[1400px] px-4 py-16 sm:px-8">
        <SectionHead n="5.2" kicker="Deliverable 2" title="The Avatar That Learns To Walk"
          lede="Most games ship one controller and hide its limitations. SetMix ships one controller whose limitations ARE the progression: at Stage 1 you genuinely cannot walk up a slope, because the world has no slopes — it has steps. Drag the dial and watch the goblin acquire knees." />
        <GoblinLab />
        <div className="mt-3 grid gap-3 lg:grid-cols-[1.1fr_1fr]">
          <Panel label="THE LOCOMOTION LADDER" accent="#7cff4d" flush>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left">
                <thead>
                  <tr className="mono border-b border-line text-[9px] tracking-[0.16em] text-dim uppercase">
                    <th className="p-2 font-medium">T</th><th className="p-2 font-medium">Quantum</th>
                    <th className="p-2 font-medium">Slope</th><th className="p-2 font-medium">Air ctl</th>
                    <th className="p-2 font-medium">Anim</th><th className="p-2 font-medium">Swim</th>
                  </tr>
                </thead>
                <tbody>
                  {[1, 2, 3, 4].map((k) => {
                    const p = MOVE_TIERS[k as 1 | 2 | 3 | 4];
                    return (
                      <tr key={k} className="border-b border-line/50 hover:bg-panel2/70">
                        <td className="mono p-2 text-[11px] font-bold text-vtx">{k}</td>
                        <td className="mono p-2 text-[10.5px] text-chalk">
                          {p.posQuantum ? `${p.posQuantum} m` : "continuous"}
                        </td>
                        <td className="mono p-2 text-[10.5px] text-chalk">{p.maxSlopeDeg}°</td>
                        <td className="mono p-2 text-[10.5px] text-dim">{p.airControl.toFixed(2)}</td>
                        <td className="mono p-2 text-[10.5px] text-lx">{p.animFrames}f @ {p.animFps}</td>
                        <td className="mono p-2 text-[10.5px]">
                          {p.canSwim ? <span className="text-aq">yes</span> : <span className="text-dim/60">no</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="border-t border-line p-3">
              <p className="text-[12px] leading-relaxed text-dim">
                <code className="mono text-chalk">profileFor()</code> blends between adjacent rows
                with a C¹ smoothstep, and the position quantum is multiplied by{" "}
                <code className="mono text-chalk">(1 − f)</code> rather than switched — so the grid
                <em className="not-italic text-chalk"> dissolves</em> over about forty minutes of
                play. A metric ticking over never produces a felt discontinuity.
              </p>
            </div>
          </Panel>
          <div className="space-y-3">
            <Panel label="CLOSED-FORM TWO-BONE IK" accent="#ff3d8a">
              <Formula>{`cosθ = (L₁² + d² − L₂²) / (2·L₁·d)`}</Formula>
              <p className="mt-2 text-[12px] leading-relaxed text-dim">
                A two-bone chain has an exact solution; running CCD or FABRIK on one is a tell that
                somebody reached for a library instead of a textbook. The pole vector disambiguates
                the circle of valid knee positions, and the ray is cast from the{" "}
                <em className="not-italic text-chalk">animated</em> foot rather than the hip — so
                the IK corrects the animation instead of replacing it. That is the difference
                between "grounded" and "sliding".
              </p>
            </Panel>
            <Panel label="VERLET, NOT SPRING-MASS" accent="#b46bff">
              <p className="text-[12px] leading-relaxed text-dim">
                Position-based Verlet for the cape: unconditionally stable at 120 Hz, velocity is
                implicit so there is no second state to desync on save/load, and the constraint
                pass is trivially budgetable — Vtx simply buys more Gauss-Seidel iterations
                (2 → 8). Shear constraints stop the sheet collapsing into a ribbon.
              </p>
            </Panel>
            <Panel label="WEAR NEVER RESETS" accent="#ffc13d">
              <p className="text-[12px] leading-relaxed text-dim">
                <code className="mono text-chalk">u_suitWear</code> accumulates with distance
                walked and has no cleaning mechanic. Veteran goblins look like veterans, and
                playtesters stop wanting a wash button about four hours in. The avatar also reads
                the <em className="not-italic text-chalk">same four metrics</em> as the terrain, so
                it can never be more detailed than the ground it stands on.
              </p>
            </Panel>
          </div>
        </div>
      </section>

      {/* ── D3 MACHINES ─────────────────────────────────────────────── */}
      <section id="p5-machines" className="mx-auto max-w-[1400px] px-4 py-16 sm:px-8">
        <SectionHead n="5.3" kicker="Deliverable 3" title="Extractors, Grid & Plumes"
          lede="The rule that shaped this whole module: an underpowered machine does not stop — it gets ugly. Brownout drops a machine's own render tier before it drops its output, so your base tells you it is starving by looking starved. Nobody reads a tooltip." />
        <GridLab />
        <div className="mt-3 grid gap-3 lg:grid-cols-3">
          <Panel label="UNION-FIND ISLANDS" accent="#ffc13d">
            <Formula>{`solveIslands(machines) → Map<id, islandId>

· grid nodes (pylons, sources) union within max(reachA, reachB)
· emitters attach to the nearest grid member within ITS reach
· each island brownouts independently`}</Formula>
            <p className="mt-2 text-[12px] leading-relaxed text-dim">
              Independent islands are the entire reason players build pylon trunks instead of one
              blob — and why a Stage-4 flood severing a line is a real engineering event rather
              than a number going down.
            </p>
          </Panel>
          <Panel label="LOAD² THERMALS" accent="#ff3d8a">
            <Formula>{`dT/dt = heatRate·load²  −  cooling·(T − ambient)·0.045
trip   when T ≥ tripTemp;  auto-reset at ambient + 12`}</Formula>
            <p className="mt-2 text-[12px] leading-relaxed text-dim">
              The square is what makes overclocking feel{" "}
              <em className="not-italic text-chalk">dangerous</em> rather than merely expensive:
              1.8× output is 3.24× heat. Fission has the highest heat rate and the{" "}
              <em className="not-italic text-chalk">lowest</em> trip point in the game — late-game
              power is a commitment, not an upgrade.
            </p>
          </Panel>
          <Panel label="PLUMES DIE INTO THE WAVE" accent="#b46bff">
            <Formula>{`if (|dist(mote, waveOrigin) − waveRadius| < Δr)
   → consumed, not expired`}</Formula>
            <p className="mt-2 text-[12px] leading-relaxed text-dim">
              Motes are not killed by a lifetime timer; they <strong className="text-chalk">dissipate
              into the active terraform band</strong>. That makes the causal chain visible: this
              chimney feeds that expanding ring, and you can follow one individual pixel all the
              way from the stack to the horizon. Mote size is driven by Pxd, so a low-resolution
              planet visibly has chunkier pixels in its sky.
            </p>
          </Panel>
        </div>
        <div className="mt-3">
          <Panel label="THE MACHINERY SUITE · 13 shipping machines" flush>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[840px] text-left">
                <thead>
                  <tr className="mono border-b border-line text-[9px] tracking-[0.16em] text-dim uppercase">
                    <th className="p-2 font-medium">Machine</th><th className="p-2 font-medium">Role</th>
                    <th className="p-2 font-medium">Yield</th><th className="p-2 font-medium">Clock</th>
                    <th className="p-2 font-medium">Heat / Trip</th><th className="p-2 font-medium">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.values(MACHINES).map((m) => (
                    <tr key={m.kind} className="border-b border-line/50 align-top hover:bg-panel2/70">
                      <td className="p-2">
                        <div className="text-[12px] font-bold" style={{ color: m.colour }}>{m.label}</div>
                        <div className="mono mt-0.5 text-[9px] text-dim">{m.cost}</div>
                      </td>
                      <td className="p-2"><Tag color={m.colour}>{m.role}</Tag></td>
                      <td className="mono p-2 text-[10.5px]" style={{ color: m.metric ? m.colour : "#6b7a90" }}>
                        {m.metric ? `${m.baseYield} ${m.metric}/s` : "—"}
                      </td>
                      <td className="mono p-2 text-[10.5px]" style={{ color: m.baseClock < 0 ? "#7cff4d" : "#ffc13d" }}>
                        {m.baseClock < 0 ? `+${-m.baseClock}` : `−${m.baseClock}`}
                      </td>
                      <td className="mono p-2 text-[10.5px] text-dim">{m.heatRate} / {m.tripTemp}°</td>
                      <td className="max-w-[340px] p-2 text-[11px] leading-snug text-dim">{m.blurb}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      </section>

      {/* ── D4 GALAXY ───────────────────────────────────────────────── */}
      <section id="p5-galaxy" className="mx-auto max-w-[1400px] px-4 py-16 sm:px-8">
        <SectionHead n="5.4" kicker="Deliverable 4" title="The Voxel Galaxy"
          lede="A 40-hour planet in roughly 200 kilobytes. Not because we compressed it — because we never serialised it. A SetMix world is a seed, four scalars, a list of hashes and a journal, and every system that consumes them is pure and fixed-step. The planet is not transferred; it is re-derived." />
        <GalaxyLab />
        <div className="mt-3 grid gap-3 lg:grid-cols-3">
          <Panel label="WHY THE CLAIM HOLDS" accent="#3dc8ff">
            <p className="text-[12.5px] leading-relaxed text-dim">
              This is not a new trick — it is the kernel's existing promise cashed in at planetary
              scale. <em className="not-italic text-chalk">"A session is (preset bundle, seed,
              input stream)."</em> We already needed determinism for replay and for undo. Federation
              is the same property, pointed outward: two machines running the same journal from the
              same seed produce the same moon, bit for bit.
            </p>
          </Panel>
          <Panel label="ONLY SCULPTS ARE STORED" accent="#7cff4d">
            <Formula>{`encodeDelta(Map<chunkId, Int8Array>) → "rle-sdf-q8"
quantum 0.0625 m · ±8 m sculpt range · 8-bit`}</Formula>
            <p className="mt-2 text-[12px] leading-relaxed text-dim">
              Everything the player did <em className="not-italic">not</em> touch is a pure function
              of (seed, fidelity) and costs zero bytes. Sculpted regions are large and smooth —
              a flattened pad, a carved road, a dug cave — so RLE beat every entropy coder we
              tried and decodes in one allocation-free pass.
            </p>
          </Panel>
          <Panel label="THE WALK-THROUGH BUDGET" accent="#ffc13d">
            <p className="text-[12.5px] leading-relaxed text-dim">
              There is no loading screen, only a portal you are walking toward — about four seconds,
              480 ticks. Every phase is budgeted against that, and the arch renders a true
              low-fidelity preview from the manifest's <strong className="text-chalk">four
              scalars alone</strong>, available after phase 2 of 7. There is always something
              honest to look at while the rest resolves.
            </p>
          </Panel>
        </div>
      </section>

      {/* ── SOURCE ──────────────────────────────────────────────────── */}
      <section id="p5-source" className="mx-auto max-w-[1400px] px-4 py-16 sm:px-8">
        <SectionHead n="5.5" kicker="Paste-ready" title="The Source"
          lede="Five modules, loaded verbatim from this build — the same bytes the four demos above are executing." />
        <Source />
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <Panel label="MERGE PLAN · PRs 6–9" accent="#7cff4d">
            <Formula>{`PR 6  packages/portal          ~430 LOC  pure + GLLike injection
PR 7  packages/goblin-controller ~560 LOC  pure, 120 Hz
PR 8  packages/setmix-machines   ~520 LOC  pure, 120 Hz
PR 9  packages/galaxy            ~480 LOC  pure, transport injected

total Phase 5: ~1,990 LOC · 0 runtime deps · 0 server`}</Formula>
            <p className="mt-2 text-[12px] leading-relaxed text-dim">
              Every module takes its renderer, its transport and its signer as injected interfaces,
              so all four remain testable headlessly and none of them pulls three.js or a network
              stack into <code className="mono text-chalk">packages/</code>.
            </p>
          </Panel>
          <Panel label="THE ARC, CLOSED" accent="var(--fi-accent)">
            <ul className="space-y-1.5 text-[12px] leading-relaxed text-dim">
              <li className="flex gap-2"><span className="text-vtx">✓</span><span><strong className="text-chalk">Phase 1</strong> — the design: four metrics, six stages, the Fi algebra.</span></li>
              <li className="flex gap-2"><span className="text-vtx">✓</span><span><strong className="text-chalk">Phase 2</strong> — the bridge: deriveBudget, adaptGraph, fuse, certify.</span></li>
              <li className="flex gap-2"><span className="text-vtx">✓</span><span><strong className="text-chalk">Phase 3</strong> — the world: invertible wave kinematics, seam-proof meshing, the Inception outliner.</span></li>
              <li className="flex gap-2"><span className="text-vtx">✓</span><span><strong className="text-chalk">Phase 4</strong> — the pipeline: contracts, the uber-shader, Nanite export, procedural audio.</span></li>
              <li className="flex gap-2"><span className="text-vtx">✓</span><span><strong className="text-chalk">Phase 5</strong> — the game: a portal, a body, a factory, a galaxy.</span></li>
            </ul>
            <p className="mt-3 border-l-2 fi-accent-border pl-3 text-[12.5px] leading-relaxed text-chalk/90">
              Every system in all five phases reads the same four floats. That was the bet in
              Section 1 of the GDD, and nothing since has needed a fifth.
            </p>
          </Panel>
        </div>
      </section>
    </>
  );
}
