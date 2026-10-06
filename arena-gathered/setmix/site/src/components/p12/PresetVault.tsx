import { useEffect, useMemo, useRef, useState } from "react";
import {
  VAULT, VAULT_BY_ID, CATEGORIES, STAT_LABELS, VAULT_STATS,
  type VaultCartridge, type VaultCategory, type GameplayStats,
} from "@/drop/content/presets";
import {
  RECIPES, RECIPE_STATS, availableRecipes, reachable, type Recipe,
} from "@/drop/content/recipes";
import { deriveBudget, toEvaluateOptions, adaptGraph, DEVICES } from "@/drop/fidelity";
import { evaluateGraph, litPreview } from "@/engine/texgraph";
import { cn } from "@/utils/cn";

const STAGE_STATES = [
  { pxd: 4.0e2, vtx: 2.0e2, lx: 4.0e1, aq: 1.0e0, tick: 0 },
  { pxd: 2.6e4, vtx: 1.1e4, lx: 6.0e3, aq: 4.0e1, tick: 0 },
  { pxd: 9.0e5, vtx: 7.0e5, lx: 3.4e5, aq: 1.2e4, tick: 0 },
  { pxd: 7.0e6, vtx: 5.2e6, lx: 3.0e6, aq: 1.6e6, tick: 0 },
  { pxd: 3.4e7, vtx: 2.6e7, lx: 1.8e7, aq: 9.0e6, tick: 0 },
  { pxd: 1.24e8, vtx: 9.4e7, lx: 6.6e7, aq: 4.1e7, tick: 0 },
];

/* ═══════════════════════════════════ rotating lit sphere preview ═════ */

function OrbPreview({ cart, stage }: { cart: VaultCartridge; stage: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  const tex = useMemo(() => {
    const b = deriveBudget(STAGE_STATES[stage - 1], DEVICES[1]);
    const g = adaptGraph(cart.graph, b);
    return { t: evaluateGraph(g, toEvaluateOptions(b, 7)), size: b.size, stage: b.stage };
  }, [cart, stage]);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const lit = litPreview(tex.t);
    const S = tex.t.size;
    let raf = 0, t0 = performance.now();

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const r = cv.getBoundingClientRect();
      const W = Math.max(120, Math.round(r.width * dpr));
      if (cv.width !== W || cv.height !== W) { cv.width = W; cv.height = W; }
      const g = cv.getContext("2d")!;
      const img = g.createImageData(W, W);
      const d = img.data;
      const spin = ((now - t0) / 1000) * 0.22;
      const R = W * 0.44, cx = W / 2, cy = W / 2;
      const L = [-0.46, -0.6, 0.65];

      for (let y = 0; y < W; y++) {
        for (let x = 0; x < W; x++) {
          const o = (y * W + x) * 4;
          const dx = (x - cx) / R, dy = (y - cy) / R;
          const r2 = dx * dx + dy * dy;
          if (r2 > 1) {
            // soft vignette backdrop
            const v = Math.max(0, 1 - (Math.sqrt(r2) - 1) * 1.6);
            d[o] = 6 + v * 10; d[o + 1] = 8 + v * 12; d[o + 2] = 13 + v * 18; d[o + 3] = 255;
            continue;
          }
          const nz = Math.sqrt(1 - r2);
          // spherical UV with spin
          const u = (Math.atan2(dx, nz) / (Math.PI * 2) + spin + 1) % 1;
          const v2 = Math.acos(Math.max(-1, Math.min(1, dy))) / Math.PI;
          const sx = Math.min(S - 1, (u * S) | 0);
          const sy = Math.min(S - 1, (v2 * S) | 0);
          const si = (sy * S + sx) * 4;
          // re-light the sampled texel against the sphere normal
          const ndl = Math.max(0, dx * L[0] + dy * L[1] + nz * L[2]);
          const rim = Math.pow(1 - nz, 3) * 0.55;
          const sh = 0.2 + ndl * 0.95;
          d[o] = Math.min(255, lit[si] * sh + rim * 120);
          d[o + 1] = Math.min(255, lit[si + 1] * sh + rim * 140);
          d[o + 2] = Math.min(255, lit[si + 2] * sh + rim * 175);
          d[o + 3] = 255;
        }
      }
      g.putImageData(img, 0, 0);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [tex]);

  return (
    <div className="relative">
      <canvas ref={ref} className="w-full" style={{ aspectRatio: "1/1" }} />
      <div className="mono pointer-events-none absolute right-1 bottom-1 text-[8px] text-chalk/50">
        {tex.size}² · live evaluateGraph
      </div>
    </div>
  );
}

/* ═════════════════════════════════════ tiny thumbnail for the grid ═══ */

/** Module-level bitmap cache: each of the 50 cartridges is evaluated exactly
 *  once per session, no matter how often the grid re-filters or remounts. */
const THUMB_CACHE = new Map<string, ImageData>();

function thumbFor(cart: VaultCartridge): ImageData {
  const hit = THUMB_CACHE.get(cart.id);
  if (hit) return hit;
  const b = { ...deriveBudget(STAGE_STATES[4], DEVICES[0]), size: 64 as const };
  const t = evaluateGraph(adaptGraph(cart.graph, b), toEvaluateOptions(b, 7));
  const lit = litPreview(t);
  const buf = new Uint8ClampedArray(new ArrayBuffer(lit.length));
  buf.set(lit);
  const img = new ImageData(buf, t.size, t.size);
  THUMB_CACHE.set(cart.id, img);
  return img;
}

function Thumb({ cart }: { cart: VaultCartridge }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const img = thumbFor(cart);
    cv.width = img.width; cv.height = img.height;
    cv.getContext("2d")!.putImageData(img, 0, 0);
  }, [cart]);
  return <canvas ref={ref} className="h-full w-full" style={{ imageRendering: "pixelated" }} />;
}

/* ══════════════════════════════════════════════════ the vault ════════ */

export default function PresetVault() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<VaultCategory | "ALL">("ALL");
  const [stage, setStage] = useState<number | "ALL">("ALL");
  const [statSort, setStatSort] = useState<keyof GameplayStats | "none">("none");
  const [selId, setSelId] = useState(VAULT[0].id);
  const [hotbar, setHotbar] = useState<(string | null)[]>([VAULT[0].id, null, null, null, null, null]);
  const [matrix, setMatrix] = useState<(string | null)[]>([null, null]);
  const [owned, setOwned] = useState<Set<string>>(() => new Set(VAULT.slice(0, 10).map((c) => c.id)));
  const [tab, setTab] = useState<"vault" | "codex">("vault");
  const [previewStage, setPreviewStage] = useState(5);
  const [log, setLog] = useState<string[]>([]);

  const sel = VAULT_BY_ID.get(selId)!;
  const push = (s: string) => setLog((l) => [s, ...l].slice(0, 5));

  const filtered = useMemo(() => {
    let out = VAULT.filter((c) => {
      if (cat !== "ALL" && c.category !== cat) return false;
      if (stage !== "ALL" && c.minStage !== stage) return false;
      if (!q) return true;
      const hay = `${c.name} ${c.tags.join(" ")} ${c.flavorLore} ${c.category} ${c.archetype}`.toLowerCase();
      return hay.includes(q.toLowerCase());
    });
    if (statSort !== "none")
      out = [...out].sort((a, b) => (b.gameplayStats[statSort] ?? 0) - (a.gameplayStats[statSort] ?? 0));
    return out;
  }, [q, cat, stage, statSort]);

  const avail = useMemo(() => availableRecipes(owned), [owned]);
  const reach = useMemo(() => reachable(owned), [owned]);
  const discovered = useMemo(
    () => RECIPES.filter((r) => owned.has(r.out)).length, [owned],
  );

  const equip = (id: string) => {
    setHotbar((h) => {
      const i = h.findIndex((x) => x === null);
      const n = [...h];
      n[i < 0 ? 0 : i] = id;
      return n;
    });
    push(`setmix/cycleHotbar → equipped "${VAULT_BY_ID.get(id)?.name ?? id}"`);
  };
  const toMatrix = (id: string) => {
    setMatrix((m) => (m[0] === null ? [id, m[1]] : m[1] === null ? [m[0], id] : [m[1], id]));
    push(`setmix/slotCartridge → Fusion Matrix "${VAULT_BY_ID.get(id)?.name ?? id}"`);
  };

  const matchRecipe: Recipe | null = useMemo(() => {
    const [a, b] = matrix;
    if (!a || !b) return null;
    return RECIPES.find((r) => (r.a === a && r.b === b) || (r.a === b && r.b === a)) ?? null;
  }, [matrix]);

  const commit = () => {
    if (!matchRecipe) return;
    setOwned((o) => new Set([...o, matchRecipe.out]));
    push(`setmix/fuse → DISCOVERED "${matchRecipe.outName}"`);
    setMatrix([null, null]);
  };

  return (
    <div className="space-y-3">
      {/* ── header ─────────────────────────────────────────────────── */}
      <div className="fi-panel flex flex-wrap items-center gap-2 border border-line bg-panel2 p-2">
        {(["vault", "codex"] as const).map((k) => (
          <button key={k} onClick={() => setTab(k)}
            className={cn("mono border px-3 py-1.5 text-[10px] font-bold tracking-[0.2em] uppercase",
              tab === k ? "fi-accent-bg border-transparent text-void" : "border-line text-dim hover:text-chalk")}>
            {k === "vault" ? `▣ vault · ${VAULT.length}` : `⬢ codex · ${discovered}/${RECIPES.length}`}
          </button>
        ))}
        <div className="mono ml-auto flex flex-wrap gap-3 text-[9px] text-dim">
          <span>{VAULT_STATS.totalNodes} AST nodes</span>
          <span>{VAULT_STATS.totalVars} variables</span>
          <span>{VAULT_STATS.archetypes} archetypes</span>
          <span className="text-vtx">{RECIPE_STATS.legendary} legendary</span>
        </div>
      </div>

      {tab === "vault" ? (
        <div className="fi-panel border border-line bg-panel">
          {/* filters */}
          <div className="flex flex-wrap items-center gap-1.5 border-b border-line bg-void2 p-2">
            <input value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="search 50 cartridges, tags, lore…"
              className="mono min-w-[180px] flex-1 border border-line bg-void px-2 py-1 text-[10px] text-chalk outline-none placeholder:text-dim/60 focus:border-chalk/40" />
            <button onClick={() => setCat("ALL")}
              className={cn("mono border px-2 py-1 text-[9px]", cat === "ALL" ? "border-transparent bg-chalk text-void" : "border-line text-dim hover:text-chalk")}>
              ALL
            </button>
            {CATEGORIES.map((c) => (
              <button key={c} onClick={() => setCat(c)}
                className={cn("mono border px-2 py-1 text-[9px]", cat === c ? "border-transparent bg-chalk text-void" : "border-line text-dim hover:text-chalk")}>
                {c}
              </button>
            ))}
            <span className="mx-1 h-4 w-px bg-line" />
            <button onClick={() => setStage("ALL")}
              className={cn("mono border px-2 py-1 text-[9px]", stage === "ALL" ? "border-transparent bg-chalk text-void" : "border-line text-dim hover:text-chalk")}>
              S·
            </button>
            {[1, 2, 3, 4, 5, 6].map((s) => (
              <button key={s} onClick={() => setStage(s)}
                className={cn("mono border px-2 py-1 text-[9px]", stage === s ? "border-transparent bg-chalk text-void" : "border-line text-dim hover:text-chalk")}>
                S{s}
              </button>
            ))}
            <select value={statSort} onChange={(e) => setStatSort(e.target.value as keyof GameplayStats | "none")}
              className="mono border border-line bg-void px-1 py-1 text-[9px] text-chalk">
              <option value="none">sort: default</option>
              {(Object.keys(STAT_LABELS) as (keyof GameplayStats)[]).map((k) => (
                <option key={k} value={k}>sort: {STAT_LABELS[k].label}</option>
              ))}
            </select>
            <span className="mono ml-auto text-[9px] text-dim">{filtered.length} shown</span>
          </div>

          <div className="grid lg:grid-cols-[minmax(0,1fr)_330px]">
            {/* grid */}
            <div className="max-h-[560px] overflow-y-auto border-b border-line p-2 lg:border-r lg:border-b-0">
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 xl:grid-cols-4">
                {filtered.map((c) => {
                  const on = selId === c.id;
                  return (
                    <button key={c.id} onClick={() => setSelId(c.id)}
                      className={cn("fi-panel group overflow-hidden border text-left transition-all",
                        on ? "bg-panel2" : "border-line bg-void/40 hover:border-chalk/30")}
                      style={on ? { borderColor: c.tint } : {}}>
                      <div className="relative aspect-square w-full overflow-hidden bg-void">
                        <Thumb cart={c} />
                        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-void/90 to-transparent" />
                        <div className="mono absolute top-1 left-1 px-1 text-[8px] font-bold"
                          style={{ background: c.tint, color: "#04060a" }}>
                          T{c.tier}
                        </div>
                        {owned.has(c.id) && (
                          <div className="mono absolute top-1 right-1 text-[9px] text-vtx">◉</div>
                        )}
                        <div className="absolute inset-x-1 bottom-1">
                          <div className="mono truncate text-[9.5px] font-bold text-chalk">{c.name}</div>
                          <div className="mono text-[7.5px] text-dim">{c.category} · {c.archetype}</div>
                        </div>
                      </div>
                      <div className="flex gap-px">
                        {c.palette.map((p) => (
                          <span key={p} className="h-1 flex-1" style={{ background: p }} />
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* inspector */}
            <div className="p-3">
              <div className="border border-line bg-void">
                <OrbPreview cart={sel} stage={previewStage} />
              </div>
              <div className="mt-1 grid grid-cols-6 gap-px">
                {[1, 2, 3, 4, 5, 6].map((s) => (
                  <button key={s} onClick={() => setPreviewStage(s)}
                    className={cn("mono border py-1 text-[8px] font-bold",
                      previewStage === s ? "border-transparent bg-chalk text-void"
                        : s < sel.minStage ? "border-line text-dim/40" : "border-line text-dim hover:text-chalk")}>
                    S{s}
                  </button>
                ))}
              </div>

              <div className="mt-2">
                <div className="text-[15px] leading-tight font-black" style={{ color: sel.tint }}>
                  {sel.name}
                </div>
                <div className="mono mt-0.5 flex flex-wrap gap-1 text-[8px]">
                  <span className="px-1 font-bold" style={{ background: sel.tint, color: "#04060a" }}>
                    TIER {sel.tier}
                  </span>
                  <span className="border border-line px-1 text-dim">{sel.category}</span>
                  <span className="border border-line px-1 text-dim">min S{sel.minStage}</span>
                  <span className="border border-line px-1 text-dim">{sel.graph.nodes.length} nodes</span>
                </div>
                <p className="mt-2 text-[11.5px] leading-snug text-chalk/80 italic">
                  "{sel.flavorLore}"
                </p>
                <div className="mono mt-2 flex flex-wrap gap-1">
                  {sel.tags.map((t) => (
                    <span key={t} className="border border-line px-1 py-[1px] text-[8px] text-dim">#{t}</span>
                  ))}
                </div>
              </div>

              <div className="mt-2 border-t border-line pt-2">
                <div className="mono mb-1 text-[8.5px] tracking-[0.2em] text-dim uppercase">Gameplay modifiers</div>
                {(Object.entries(sel.gameplayStats) as [keyof GameplayStats, number][]).map(([k, v]) => {
                  const meta = STAT_LABELS[k];
                  const neutral = meta.unit === "×" ? 1 : 0;
                  const good = v > neutral;
                  return (
                    <div key={k} className="mono flex items-center gap-2 py-[2px] text-[9.5px]">
                      <span className="w-[86px] shrink-0 text-dim">{meta.label}</span>
                      <div className="h-[3px] flex-1 bg-line">
                        <div className="h-full" style={{
                          width: `${Math.min(100, (meta.unit === "×" ? v / 3 : Math.abs(v) / 90) * 100)}%`,
                          background: good ? "#7cff4d" : "#ff3d8a",
                        }} />
                      </div>
                      <span className="tnum w-[48px] shrink-0 text-right" style={{ color: good ? "#7cff4d" : "#ff3d8a" }}>
                        {v > 0 && meta.unit !== "×" ? "+" : ""}{v}{meta.unit}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="mt-2 grid grid-cols-2 gap-1">
                <button onClick={() => equip(sel.id)}
                  className="mono fi-accent-bg px-2 py-1.5 text-[9px] font-black tracking-[0.15em] text-void uppercase">
                  ▣ equip to hotbar
                </button>
                <button onClick={() => toMatrix(sel.id)}
                  className="mono border border-flux bg-flux/15 px-2 py-1.5 text-[9px] font-black tracking-[0.15em] text-flux uppercase hover:bg-flux/25">
                  ⬢ to matrix
                </button>
              </div>

              <details className="mt-2">
                <summary className="mono cursor-pointer text-[9px] tracking-[0.18em] text-dim uppercase hover:text-chalk">
                  ▸ raw TexGraph AST ({sel.graph.nodes.length} nodes)
                </summary>
                <pre className="mono mt-1 max-h-[180px] overflow-auto border border-line bg-void2 p-1.5 text-[8.5px] leading-snug text-chalk/80">
                  {JSON.stringify(sel.graph.nodes, null, 1)}
                </pre>
              </details>
            </div>
          </div>

          {/* hotbar + matrix */}
          <div className="flex flex-wrap items-center gap-2 border-t border-line bg-void2 p-2">
            <span className="mono text-[8.5px] tracking-[0.18em] text-dim uppercase">hands</span>
            {hotbar.map((h, i) => {
              const c = h ? VAULT_BY_ID.get(h) : null;
              return (
                <button key={i} onClick={() => setHotbar((x) => x.map((v, k) => (k === i ? null : v)))}
                  className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden border"
                  style={{ borderColor: (c?.tint ?? "#2a3242") + "99" }}
                  title={c?.name ?? "empty"}>
                  {c ? <Thumb cart={c} /> : <span className="mono text-[9px] text-dim/40">{i + 1}</span>}
                </button>
              );
            })}
            <span className="mx-2 h-6 w-px bg-line" />
            <span className="mono text-[8.5px] tracking-[0.18em] text-flux uppercase">matrix</span>
            {matrix.map((m, i) => {
              const c = m ? VAULT_BY_ID.get(m) : null;
              return (
                <button key={i} onClick={() => setMatrix((x) => x.map((v, k) => (k === i ? null : v)))}
                  className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden border border-dashed"
                  style={{ borderColor: c ? c.tint : "#b46bff66" }}>
                  {c ? <Thumb cart={c} /> : <span className="mono text-[9px] text-flux/50">{i ? "B" : "A"}</span>}
                </button>
              );
            })}
            {matchRecipe ? (
              <button onClick={commit}
                className="mono bg-flux px-3 py-1.5 text-[9px] font-black tracking-[0.15em] text-void uppercase">
                ⌁ fuse → {matchRecipe.outName}
              </button>
            ) : (
              <span className="mono text-[9px] text-dim">
                {matrix[0] && matrix[1] ? "no recipe — the Sphere returns 60% of inputs" : "load two cartridges"}
              </span>
            )}
            {log.length > 0 && (
              <span className="mono ml-auto truncate text-[8.5px] text-aq">{log[0]}</span>
            )}
          </div>
        </div>
      ) : (
        /* ═════════════════════ CODEX ═══════════════════════════════ */
        <div className="fi-panel border border-line bg-panel">
          <div className="flex flex-wrap items-center gap-3 border-b border-line bg-void2 p-2">
            <div className="mono text-[9px] text-dim">
              discovered <span className="text-vtx font-bold">{discovered}</span> / {RECIPES.length}
            </div>
            <div className="h-1.5 w-40 bg-line">
              <div className="h-full bg-vtx" style={{ width: `${(discovered / RECIPES.length) * 100}%` }} />
            </div>
            <div className="mono text-[9px] text-dim">
              <span className="text-lx">{avail.length}</span> fusable now ·{" "}
              <span className="text-flux">{reach.have.size - owned.size}</span> reachable
            </div>
            <button onClick={() => setOwned(new Set(VAULT.map((c) => c.id)))}
              className="mono ml-auto border border-line px-2 py-1 text-[9px] text-dim hover:text-chalk">
              ⊕ grant all base cartridges
            </button>
            <button onClick={() => setOwned(new Set(VAULT.slice(0, 10).map((c) => c.id)))}
              className="mono border border-line px-2 py-1 text-[9px] text-dim hover:text-chalk">
              ↻ reset
            </button>
          </div>

          <div className="max-h-[620px] overflow-y-auto">
            {[1, 2, 3, 4, 5, 6].map((tier) => {
              const rows = RECIPES.filter((r) => r.tier === tier);
              if (!rows.length) return null;
              return (
                <div key={tier}>
                  <div className="mono sticky top-0 z-10 flex items-center gap-2 border-y border-line bg-panel2 px-3 py-1 text-[9px] tracking-[0.2em] uppercase">
                    <span className="fi-accent-text font-bold">TIER {tier}</span>
                    <span className="text-dim">
                      {rows.filter((r) => owned.has(r.out)).length}/{rows.length}
                    </span>
                    <span className="h-px flex-1 bg-line" />
                    <span className="text-dim">
                      {tier === 6 ? "legendary masterpieces" : tier >= 5 ? "mature worlds" : tier >= 3 ? "ecosystems" : "base alloys"}
                    </span>
                  </div>
                  <div className="grid gap-px bg-line sm:grid-cols-2 xl:grid-cols-3">
                    {rows.map((r) => {
                      const known = owned.has(r.out);
                      const canMake = owned.has(r.a) && owned.has(r.b) && !known;
                      const depth = reach.depth.get(r.out);
                      return (
                        <div key={r.id}
                          className={cn("bg-panel p-2 transition-colors",
                            known && "bg-panel2", canMake && "bg-lx/5")}>
                          <div className="mono flex items-baseline gap-1.5 text-[8px]">
                            <span className={known ? "text-vtx" : canMake ? "text-lx" : "text-dim/50"}>
                              {known ? "◉" : canMake ? "◎" : "○"}
                            </span>
                            <span className="tracking-wider text-dim/60">{r.id}</span>
                            <span className="px-1" style={{ background: r.preview + "33", color: r.preview }}>
                              {r.cls}
                            </span>
                            <span className="ml-auto tnum text-dim/60">{r.confidence}%</span>
                          </div>
                          <div className="mono mt-1 truncate text-[9px] text-dim">
                            <span className={owned.has(r.a) ? "text-chalk/80" : ""}>{r.a}</span>
                            <span className="text-flux"> + </span>
                            <span className={owned.has(r.b) ? "text-chalk/80" : ""}>{r.b}</span>
                          </div>
                          <div className="mt-0.5 text-[11.5px] leading-tight font-bold"
                            style={{ color: known ? r.preview : "#4a5668" }}>
                            {known ? r.outName : "? ? ?"}
                          </div>
                          <p className="mt-1 text-[10px] leading-snug text-dim">
                            {known ? r.effect : <span className="italic opacity-70">{r.hint}</span>}
                          </p>
                          {!known && depth !== undefined && (
                            <div className="mono mt-1 text-[8px] text-flux">{depth} fusion{depth > 1 ? "s" : ""} away</div>
                          )}
                          {canMake && (
                            <button onClick={() => { setMatrix([r.a, r.b]); setTab("vault"); }}
                              className="mono mt-1 w-full border border-lx/50 bg-lx/10 px-1 py-[3px] text-[8.5px] font-bold tracking-wider text-lx uppercase hover:bg-lx/20">
                              ⬢ load into matrix
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
