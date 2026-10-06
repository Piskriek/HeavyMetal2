import { useState } from "react";
import { runSpecs, SPECS, CART_A, CART_B } from "@/drop/fidelity.spec";
import { exportToUnreal, browserPngEncoder, manifestJson } from "@/drop/exportToUnreal";
import { evaluateGraph } from "@/engine/texgraph";
import { cn } from "@/utils/cn";

type Row = ReturnType<typeof runSpecs>["results"][number];

export function TestRunner() {
  const [res, setRes] = useState<ReturnType<typeof runSpecs> | null>(null);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<string>("");

  const groups = [...new Set(SPECS.map((s) => s.group))];

  const run = () => {
    setBusy(true);
    setRes(null);
    // yield a frame so the button paints its busy state
    setTimeout(() => {
      setRes(runSpecs(filter || undefined));
      setBusy(false);
    }, 16);
  };

  const byGroup = new Map<string, Row[]>();
  for (const r of res?.results ?? []) {
    if (!byGroup.has(r.group)) byGroup.set(r.group, []);
    byGroup.get(r.group)!.push(r);
  }

  return (
    <div className="fi-panel border border-line bg-panel">
      <div className="flex flex-wrap items-center gap-2 border-b border-line bg-panel2 p-2">
        <button
          onClick={run}
          disabled={busy}
          className="mono fi-accent-bg px-3 py-1.5 text-[10px] font-black tracking-[0.2em] text-void uppercase disabled:opacity-50"
        >
          {busy ? "running…" : "▶ run suite"}
        </button>
        <div className="flex flex-wrap gap-1">
          <button
            onClick={() => setFilter("")}
            className={cn("mono border px-2 py-1 text-[9px]",
              filter === "" ? "border-transparent bg-chalk text-void" : "border-line text-dim hover:text-chalk")}
          >
            all · {SPECS.length}
          </button>
          {groups.map((g) => (
            <button key={g} onClick={() => setFilter(g)}
              className={cn("mono border px-2 py-1 text-[9px]",
                filter === g ? "border-transparent bg-chalk text-void" : "border-line text-dim hover:text-chalk")}>
              {g} · {SPECS.filter((s) => s.group === g).length}
            </button>
          ))}
        </div>
        {res && (
          <div className="mono ml-auto flex items-center gap-3 text-[10px]">
            <span className="text-vtx">✓ {res.passed}</span>
            {res.failed > 0 && <span className="text-pxd">✕ {res.failed}</span>}
            <span className="text-dim">{res.ms.toFixed(0)} ms</span>
          </div>
        )}
      </div>

      <div className="max-h-[420px] overflow-y-auto">
        {!res && (
          <div className="mono p-6 text-center text-[11px] leading-relaxed text-dim">
            The <span className="text-chalk">same assertions</span> CI runs via{" "}
            <span className="text-chalk">node --test</span>, executed in your browser against the
            identical <span className="text-chalk">packages/fidelity</span> source.
            <br />
            Includes 1,000-iteration determinism loops, the 24-permutation golden budget table,
            72 adaptGraph round trips and 10,000 random seam-key pairs.
          </div>
        )}
        {[...byGroup.entries()].map(([g, rows]) => (
          <div key={g}>
            <div className="mono sticky top-0 border-y border-line bg-void2 px-3 py-1 text-[9px] tracking-[0.2em] text-dim uppercase">
              {g} · {rows.filter((r) => r.pass).length}/{rows.length}
            </div>
            {rows.map((r) => (
              <div key={r.name} className="grid grid-cols-[14px_1fr_auto] items-start gap-2 border-b border-line/40 px-3 py-1.5">
                <span className={cn("mono text-[11px]", r.pass ? "text-vtx" : "text-pxd")}>
                  {r.pass ? "✓" : "✕"}
                </span>
                <div className="min-w-0">
                  <div className="mono text-[10.5px] text-chalk/90">{r.name}</div>
                  <div className={cn("mono truncate text-[9px]", r.pass ? "text-dim" : "text-pxd")}>
                    {r.pass ? r.evidence : r.error}
                  </div>
                </div>
                <span className="mono tnum text-[9px] text-dim">{r.ms.toFixed(1)}ms</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════ UNREAL BRIDGE ══ */

export function UnrealBridge() {
  const [cart, setCart] = useState<"rock" | "erode">("rock");
  const [size, setSize] = useState<1024 | 2048 | 4096>(1024);
  const [meshRes, setMeshRes] = useState<128 | 256 | 512>(256);
  const [pkg, setPkg] = useState<ReturnType<typeof exportToUnreal> | null>(null);
  const [busy, setBusy] = useState(false);

  const bake = () => {
    setBusy(true);
    setTimeout(() => {
      const c = cart === "rock" ? CART_A : CART_B;
      setPkg(
        exportToUnreal(c, {
          bakeSize: size,
          meshResolution: meshRes,
          seed: 7,
          evaluate: (g, o) => evaluateGraph(g as never, o) as never,
          encodePng: browserPngEncoder,
        }),
      );
      setBusy(false);
    }, 16);
  };

  const mb = (n: number) => (n / 1048576).toFixed(2) + " MB";

  return (
    <div className="fi-panel border border-line bg-panel">
      <div className="grid lg:grid-cols-[280px_minmax(0,1fr)]">
        <div className="border-b border-line p-3 lg:border-r lg:border-b-0">
          <div className="mono mb-1 text-[9px] tracking-[0.2em] text-dim uppercase">Cartridge</div>
          <div className="flex gap-1">
            {(["rock", "erode"] as const).map((k) => (
              <button key={k} onClick={() => setCart(k)}
                className={cn("mono flex-1 border px-2 py-1 text-[9.5px]",
                  cart === k ? "border-transparent bg-chalk text-void" : "border-line text-dim hover:text-chalk")}>
                {k}
              </button>
            ))}
          </div>

          <div className="mono mt-3 mb-1 text-[9px] tracking-[0.2em] text-dim uppercase">Bake size</div>
          <div className="flex gap-1">
            {([1024, 2048, 4096] as const).map((s) => (
              <button key={s} onClick={() => setSize(s)}
                className={cn("mono flex-1 border px-1 py-1 text-[9px]",
                  size === s ? "border-transparent bg-chalk text-void" : "border-line text-dim hover:text-chalk")}>
                {s}²
              </button>
            ))}
          </div>

          <div className="mono mt-3 mb-1 text-[9px] tracking-[0.2em] text-dim uppercase">Nanite mesh</div>
          <div className="flex gap-1">
            {([128, 256, 512] as const).map((s) => (
              <button key={s} onClick={() => setMeshRes(s)}
                className={cn("mono flex-1 border px-1 py-1 text-[9px]",
                  meshRes === s ? "border-transparent bg-chalk text-void" : "border-line text-dim hover:text-chalk")}>
                {(s * s * 2 / 1000).toFixed(0)}k tri
              </button>
            ))}
          </div>

          <button onClick={bake} disabled={busy}
            className="mono fi-accent-bg mt-3 w-full px-3 py-2 text-[10px] font-black tracking-[0.2em] text-void uppercase disabled:opacity-50">
            {busy ? "baking…" : "⬇ exportToUnreal()"}
          </button>
          {size === 4096 && (
            <p className="mono mt-1 text-[8.5px] leading-snug text-lx">
              4096² evaluates 16.7 M texels on the main thread — a second or two. Production runs
              it in a worker pool.
            </p>
          )}

          {pkg && (
            <div className="mt-3 border-t border-line pt-2">
              {([
                ["bake time", `${pkg.bakeMs.toFixed(0)} ms`, "#ffc13d"],
                ["package", mb(pkg.totalBytes), "var(--fi-accent)"],
                ["mesh tris", pkg.mesh.tris.toLocaleString(), "#7cff4d"],
                ["mesh verts", pkg.mesh.verts.toLocaleString(), "#7cff4d"],
                ["obj bytes", mb(pkg.mesh.bytes.length), "#8b9bb4"],
                ["export hash", pkg.hash, "#b46bff"],
                ["certificate", pkg.manifest.verification.certificate.pass ? "PASS" : "FAIL",
                  pkg.manifest.verification.certificate.pass ? "#7cff4d" : "#ff3d8a"],
              ] as const).map(([k, v, c]) => (
                <div key={k} className="mono flex justify-between border-b border-line/40 py-[3px] text-[9.5px] last:border-0">
                  <span className="text-dim">{k}</span>
                  <span className="tnum" style={{ color: c }}>{v}</span>
                </div>
              ))}
              <div className="mono mt-2 text-[9px] tracking-[0.18em] text-dim uppercase">textures</div>
              {pkg.textures.map((t) => (
                <div key={t.file} className="mono flex justify-between py-[2px] text-[9px]">
                  <span className="truncate text-chalk/80">{t.file}</span>
                  <span className="tnum shrink-0 text-dim">
                    {t.bitDepth}b · {mb(t.bytes.length)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-3">
          <div className="mono mb-1 flex items-center justify-between text-[9px] tracking-[0.2em] text-dim uppercase">
            <span>manifest.ue5.json</span>
            {pkg && <span className="text-vtx">generated · {pkg.name}</span>}
          </div>
          <pre className="mono max-h-[460px] overflow-auto border border-line bg-void2 p-2 text-[9.5px] leading-snug text-chalk/85">
            {pkg
              ? manifestJson(pkg)
              : "// press exportToUnreal() — the manifest below is produced by the\n// real baker in src/drop/exportToUnreal.ts, from the real DAG,\n// through the real @hm/texgraph evaluator."}
          </pre>
        </div>
      </div>
    </div>
  );
}
