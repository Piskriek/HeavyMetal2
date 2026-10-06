import { Panel, SectionHead, Formula, Tag } from "@/components/ui";
import MeshLab from "@/components/MeshLab";
import { VTX_LADDER, COMMIT_RULES } from "@/engine/setmix/mesh";

export default function Mesh() {
  return (
    <section id="p3-mesh" className="mx-auto max-w-[1400px] px-4 py-16 sm:px-8">
      <SectionHead
        n="3.2"
        kicker="@hm/setmix-mesh"
        title="The Smoothvox2 Dynamic Meshing Pipeline"
        lede="Geometric Flux does not pick a mesh. It picks the parameters of one algorithm that degrades continuously into the other two: dual contouring with zero relaxation and a full QEF clamp IS a chamfered cube, and with zero chamfer it IS an AABB voxel. Drag the slider and watch one function become three."
      />

      <MeshLab />

      <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_1.1fr]">
        <Panel label="Vtx → MeshPolicy" accent="#7cff4d">
          <Formula>{`n            = normalised(Vtx)                       // 0..1
lod          = round(n · 5)                          // 0..5
cellSize     = CELL_LADDER[lod]                      // 8,4,2,1,.5,.25 m
smoothAngle  = 180 · (1 − e^(−Vtx / 50000))          // ° — authored curve

n < 0.08   → CUBIC    chamfer 0,              relax 0
n < 0.30   → CHAMFER  chamfer S((n−.08)/.22)·0.5, relax 0
else       → DUAL     chamfer 0.5,            relax min(8, ⌊(n−.3)·11⌋)

qefClamp     = 0.5 − 0.18 · S(n)        // tighter clamp keeps features early
sharpFeature = cos(smoothAngle)         // edges sharper than this survive`}</Formula>
          <p className="mt-3 text-[12.5px] leading-relaxed text-dim">
            Every term is continuous in Vtx, including the mode handovers — the chamfer ramps 0 →
            0.5 across the whole of Stage 2 rather than switching on, and the DUAL branch blends
            out of the chamfered form by its relaxation count. There is no Vtx value anywhere on
            the ladder at which a vertex jumps.
          </p>
        </Panel>

        <Panel label="THE LADDER" accent="#7cff4d" flush>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left">
              <thead>
                <tr className="mono border-b border-line text-[9px] tracking-[0.16em] text-dim uppercase">
                  <th className="p-2 font-medium">S</th>
                  <th className="p-2 font-medium">Mode</th>
                  <th className="p-2 font-medium">Cell</th>
                  <th className="p-2 font-medium">Smooth</th>
                  <th className="p-2 font-medium">Note</th>
                </tr>
              </thead>
              <tbody>
                {VTX_LADDER.map((r) => (
                  <tr key={r.stage} className="border-b border-line/50 align-top hover:bg-panel2/70">
                    <td className="mono p-2 text-[11px] font-bold text-vtx">{r.stage}</td>
                    <td className="p-2">
                      <Tag color={r.mode === "DUAL" ? "#7cff4d" : r.mode === "CHAMFER" ? "#ffc13d" : "#8b9bb4"}>
                        {r.mode}
                      </Tag>
                    </td>
                    <td className="mono p-2 text-[10.5px] text-chalk">{r.cell}</td>
                    <td className="mono p-2 text-[10.5px] text-aq">{r.smooth}</td>
                    <td className="max-w-[300px] p-2 text-[11px] leading-snug text-dim">{r.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      {/* THE SEAM */}
      <div className="mt-3">
        <Panel label="THE SEAM · chunk A is Stage 3, chunk B is still Stage 1" accent="#b46bff">
          <div className="grid gap-4 lg:grid-cols-3">
            <div>
              <div className="mono mb-1 flex items-center gap-2 text-[10px]">
                <span className="fi-accent-bg px-1.5 py-[2px] font-bold text-void">01</span>
                <span className="font-bold text-chalk">BOUNDARY OWNERSHIP BY RULE</span>
              </div>
              <p className="text-[12.5px] leading-relaxed text-dim">
                A chunk meshes its <strong className="text-chalk">interior</strong> with its own
                policy and its one-cell <strong className="text-chalk">boundary ring</strong> with{" "}
                <code className="mono text-chalk">minPolicy(self, neighbour)</code> — the coarser of
                the two. Both sides then evaluate the same function over the same world coordinates
                with the same parameters, and produce bit-identical vertex positions.
              </p>
              <p className="mt-2 text-[12.5px] leading-relaxed text-dim">
                No messages. No ordering requirement. No shared mutable state. The agreement is a
                property of the arithmetic, which is why it survives async re-meshing, worker
                scheduling jitter and save/load.
              </p>
              <Formula label="verified in CI">{`seamsAgree(A, B, origin, "E", "W") === true
// asserted over 10,000 random policy pairs`}</Formula>
            </div>

            <div>
              <div className="mono mb-1 flex items-center gap-2 text-[10px]">
                <span className="fi-accent-bg px-1.5 py-[2px] font-bold text-void">02</span>
                <span className="font-bold text-chalk">T-JUNCTION COLLAPSE</span>
              </div>
              <p className="text-[12.5px] leading-relaxed text-dim">
                Cell sizes are strict powers of two, so the only case that can ever occur at a
                boundary is a 2:1 ratio — the finer chunk has exactly one extra vertex per coarse
                edge. That vertex is snapped onto the straight line between the coarse edge's
                endpoints.
              </p>
              <p className="mt-2 text-[12.5px] leading-relaxed text-dim">
                The triangle becomes degenerate in the seam plane but the surface stays watertight,
                because the edge is now exactly collinear. The rasteriser cannot find a hole that
                is not there.
              </p>
              <div className="mono mt-2 border border-line bg-void2 p-2 text-[10px] leading-snug text-chalk/80">
                Toggle <span className="text-pxd">boundary ownership</span> off in the lab above:
                chunk A keeps its 1 m dual-contoured surface right up to the edge, chunk B keeps
                its 8 m plateau, and the gap between them is drawn in magenta with its height in
                metres. That is the crack, and it is as big as it looks.
              </div>
            </div>

            <div>
              <div className="mono mb-1 flex items-center gap-2 text-[10px]">
                <span className="fi-accent-bg px-1.5 py-[2px] font-bold text-void">03</span>
                <span className="font-bold text-chalk">SKIRTS — INSURANCE</span>
              </div>
              <p className="text-[12.5px] leading-relaxed text-dim">
                A vertical apron of depth 1.5 · cellSize hangs from every chunk border. It is
                invisible from above the surface, never shadow-casts, is excluded from picking, and
                costs about 1.2% of a chunk's triangles.
              </p>
              <p className="mt-2 text-[12.5px] leading-relaxed text-dim">
                It exists for exactly one case: the single frame in which chunk A has swapped its
                mesh buffer and chunk B has not. Mechanisms 1 and 2 make cracks impossible in
                steady state; the skirt covers the transient.
              </p>
              <div className="mono mt-2 border border-flux/40 bg-flux/5 p-2 text-[10px] leading-snug text-flux">
                And the reason the wave does not make any of this worse: the geomorph parameter{" "}
                <strong>s is a pure function of world position</strong>. Two chunks sampling the
                same boundary point compute the same blend factor, to the bit, on every tick of the
                sweep. The seam is stable <em>during</em> the transition — which is the case that
                normally breaks LOD systems.
              </div>
            </div>
          </div>
        </Panel>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_1fr]">
        <Panel label="SmoothvoxRequest · the adapter output" accent="#3dc8ff">
          <Formula>{`toSmoothvoxRequest(policy, budget) → {
  cellSize:              policy.cellSize,
  mode:                  "CUBIC" | "CHAMFER" | "DUAL",
  chamfer:               policy.chamfer,
  relaxIterations:       policy.relaxIterations,
  qefClamp:              policy.qefClamp,
  smoothAngleDeg:        180·(1 − e^(−Vtx/50000)),
  sharpFeatureThreshold: cos(smoothAngleDeg),
  generateSkirts:        true,
  skirtDepth:            cellSize · 1.5,
  boundaryPolicy:        "coarser-neighbour",
  triplanarSharpness:    2 + budget.relief · 3,
  maxMaterialsPerVertex: budget.size ≤ 32 ? 1 : ≤128 ? 2 : 4
}`}</Formula>
          <p className="mt-3 text-[12.5px] leading-relaxed text-dim">
            Note the last two lines: the <em className="not-italic text-chalk">texture</em> budget
            decides the <em className="not-italic text-chalk">mesh</em> vertex format. On a 32-texel
            device a vertex carries one material id, so the blend happens between chunks instead of
            within a vertex — same world, same biomes, one quarter of the vertex bandwidth.
          </p>
        </Panel>

        <div className="space-y-3">
          <Panel label="TRIPLANAR + BIOME BLEND" accent="#86c954">
            <Formula>{`w_planar = normalize(|n|^sharpness)        // xyz
biome    = softmax over spire influence   // from setmix-field
ids/wts  = top-K(biome, maxMaterials), Y-planar biases slot 0

→ one uber-shader, ≤4 materials, weights normalised on the CPU
→ the GPU never normalises anything`}</Formula>
            <p className="mt-2 text-[12px] leading-relaxed text-dim">
              The Y-planar bias is what makes grass sit on top of rock without anyone authoring a
              rule for it: upward-facing triplanar weight promotes the dominant biome material,
              downward and side faces fall back to the substrate.
            </p>
          </Panel>
          <Panel label="DOUBLE-BUFFERED COMMIT" accent="#ffc13d" flush>
            <div className="divide-y divide-line/60">
              {COMMIT_RULES.map(([k, v]) => (
                <div key={k} className="p-2.5">
                  <div className="mono text-[10px] font-bold text-lx">{k}</div>
                  <p className="mt-0.5 text-[11px] leading-snug text-dim">{v}</p>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </section>
  );
}
