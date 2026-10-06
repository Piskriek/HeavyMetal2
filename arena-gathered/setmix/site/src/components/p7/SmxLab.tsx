import { useEffect, useMemo, useRef, useState } from "react";
import {
  packCartridge, unpackCartridge, verifyCartridge, compileGraph, disassemble,
  hex, sha256, SECTION, FLAG, HEADER_BYTES, INSTR_BYTES, CLI_SOURCE,
  type CartridgeManifest,
} from "@/drop/CartridgeCompiler";
import { LIBRARY } from "@/engine/setmix/library";
import { cn } from "@/utils/cn";

const SECTION_NAME: Record<number, string> = {
  [SECTION.META]: "META", [SECTION.CODE]: "CODE", [SECTION.ART]: "ART", [SECTION.GEOM]: "GEOM",
};
const SECTION_COL: Record<number, string> = {
  [SECTION.META]: "#7cff4d", [SECTION.CODE]: "#ff3d8a",
  [SECTION.ART]: "#b46bff", [SECTION.GEOM]: "#3dc8ff",
};

export default function SmxLab() {
  const [cartId, setCartId] = useState(LIBRARY[0].id);
  const [corrupt, setCorrupt] = useState(false);
  const [view, setView] = useState<"hex" | "asm" | "cli">("hex");
  const [hoverSection, setHoverSection] = useState<number | null>(null);
  const cassetteRef = useRef<HTMLCanvasElement>(null);

  const built = useMemo(() => {
    const cart = LIBRARY.find((c) => c.id === cartId)!;

    // 128×128 thumbnail, generated from the cartridge's own tint + graph hash
    const thumb = new Uint8Array(128 * 128 * 4);
    const tint = cart.tint.slice(1);
    const tr = parseInt(tint.slice(0, 2), 16), tg = parseInt(tint.slice(2, 4), 16), tb = parseInt(tint.slice(4, 6), 16);
    for (let y = 0; y < 128; y++)
      for (let x = 0; x < 128; x++) {
        const i = (y * 128 + x) * 4;
        const n = (Math.sin(x * 0.11 + y * 0.07) + Math.cos(x * 0.05 - y * 0.13)) * 0.25 + 0.5;
        thumb[i] = tr * n; thumb[i + 1] = tg * n; thumb[i + 2] = tb * n; thumb[i + 3] = 255;
      }
    const palette = new Uint8Array(48);
    for (let i = 0; i < 16; i++) {
      palette[i * 3] = (tr * (i / 15)) | 0;
      palette[i * 3 + 1] = (tg * (i / 15)) | 0;
      palette[i * 3 + 2] = (tb * (i / 15)) | 0;
    }

    const code = compileGraph(cart.graph);
    const bvh = new Float32Array(64);
    for (let i = 0; i < 64; i++) bvh[i] = Math.sin(i * 1.7) * 12;

    const manifest: CartridgeManifest = {
      meta: {
        name: cart.name, author: "@dr.vex",
        tags: [cart.cls.toLowerCase(), "setmix", "phase7"],
        description: `${cart.cls} cartridge compiled from a ${cart.graph.nodes.length}-node DAG.`,
        cls: cart.cls, minStage: cart.minStage, maxStage: 6,
        params: cart.vars.map((v) => ({
          name: v.label, real: v.real, path: v.path, unit: v.unit,
          min: v.min, max: v.max, def: v.def, tier: v.tier, explain: v.explain,
        })),
        createdAtTick: 1_728_000, licence: "CC-BY-SA-SETMIX",
      },
      code,
      art: { thumbnail: thumb, encoded: false, palette },
      geom: { bvh, lodVertexCounts: [18400, 7200, 2600, 840] },
      flags: FLAG.SIGNED | FLAG.HAS_BVH | FLAG.HAS_LOD,
      engineVersion: 70000,
      sha256: new Uint8Array(32),
    };

    let bytes = packCartridge(manifest);
    if (corrupt) {
      bytes = bytes.slice();
      // flip one bit deep inside §2 CODE — invisible, and fatal
      bytes[HEADER_BYTES + 160] ^= 0x08;
    }
    const report = verifyCartridge(bytes);
    let unpacked: ReturnType<typeof unpackCartridge> | null = null;
    try { unpacked = unpackCartridge(bytes); } catch { /* reported above */ }
    return { cart, bytes, report, unpacked, code, palette, tint: cart.tint };
  }, [cartId, corrupt]);

  /* rotating cassette */
  useEffect(() => {
    const cv = cassetteRef.current;
    if (!cv) return;
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const r = cv.getBoundingClientRect();
      const W = Math.round(r.width * dpr), H = Math.round(180 * dpr);
      if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
      const g = cv.getContext("2d")!;
      const t = performance.now() / 1000;
      g.fillStyle = "#05070c"; g.fillRect(0, 0, W, H);

      const cx = W / 2, cy = H / 2;
      const yaw = t * 0.55;
      const cw = Math.min(W * 0.3, 92 * dpr), ch = cw * 1.22, cd = cw * 0.2;
      const proj = (lx: number, ly: number, lz: number) => {
        const x = lx * Math.cos(yaw) - lz * Math.sin(yaw);
        const z = lx * Math.sin(yaw) + lz * Math.cos(yaw);
        const p = 440 * dpr / (440 * dpr + z);
        return [cx + x * p, cy + ly * p * 0.94] as const;
      };
      const face = (pts: readonly (readonly [number, number])[], fill: string, stroke?: string) => {
        g.beginPath();
        pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
        g.closePath(); g.fillStyle = fill; g.fill();
        if (stroke) { g.strokeStyle = stroke; g.lineWidth = 1.2 * dpr; g.stroke(); }
      };

      const facing = Math.cos(yaw) > 0;
      const zf = facing ? -cd : cd;
      const zb = facing ? cd : -cd;
      // back shell
      face([proj(-cw, -ch, zb), proj(cw, -ch, zb), proj(cw, ch, zb), proj(-cw, ch, zb)], "#161c28");
      // side
      face([proj(cw, -ch, zb), proj(cw, -ch, zf), proj(cw, ch, zf), proj(cw, ch, zb)], "#0f141d");
      face([proj(-cw, -ch, zb), proj(-cw, -ch, zf), proj(-cw, ch, zf), proj(-cw, ch, zb)], "#0f141d");
      // front shell
      face([proj(-cw, -ch, zf), proj(cw, -ch, zf), proj(cw, ch, zf), proj(-cw, ch, zf)],
           "#1d2533", built.tint + "cc");
      // label window with the live palette
      const lw = cw * 0.76, lh = ch * 0.44;
      face([proj(-lw, -ch * 0.72, zf), proj(lw, -ch * 0.72, zf),
            proj(lw, -ch * 0.72 + lh, zf), proj(-lw, -ch * 0.72 + lh, zf)], "#080c13", "#2a3242");
      for (let i = 0; i < 16; i++) {
        const x0 = -lw + (i / 16) * lw * 2, x1 = -lw + ((i + 1) / 16) * lw * 2;
        const p = built.palette;
        face([proj(x0, -ch * 0.72 + lh * 0.55, zf), proj(x1, -ch * 0.72 + lh * 0.55, zf),
              proj(x1, -ch * 0.72 + lh, zf), proj(x0, -ch * 0.72 + lh, zf)],
             `rgb(${p[i*3]},${p[i*3+1]},${p[i*3+2]})`);
      }
      // gold connector pins — the readout
      const pins = 12;
      for (let i = 0; i < pins; i++) {
        const x0 = -cw * 0.84 + (i / pins) * cw * 1.68;
        const x1 = x0 + cw * 0.09;
        const live = (Math.floor(t * 5) + i) % 4 !== 0;
        face([proj(x0, ch * 0.62, zf), proj(x1, ch * 0.62, zf),
              proj(x1, ch * 0.92, zf), proj(x0, ch * 0.92, zf)],
             live ? "#d9b450" : "#6a5520");
      }
      // holographic verdict
      g.font = `bold ${10 * dpr}px ui-monospace, monospace`;
      g.fillStyle = built.report.ok ? "#7cff4d" : "#ff3d8a";
      const verdict = built.report.ok ? "✓ VERIFIED" : "✕ REJECTED";
      g.fillText(verdict, cx - g.measureText(verdict).width / 2, H - 10 * dpr);
      g.font = `${8.5 * dpr}px ui-monospace, monospace`;
      g.fillStyle = "#6b7a90";
      const h = hex(built.unpacked?.manifest.sha256 ?? new Uint8Array(4)).slice(0, 24);
      g.fillText(h, cx - g.measureText(h).width / 2, 14 * dpr);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [built]);

  /* hex dump of the header + TOC */
  const dump = useMemo(() => {
    const rows: { addr: number; bytes: number[]; section: number | null }[] = [];
    const limit = Math.min(built.bytes.length, 288);
    const secOf = (i: number) => {
      if (i < HEADER_BYTES) return -1;
      const s = built.unpacked?.sections.find((x) => i >= x.offset && i < x.offset + x.length);
      return s ? s.id : null;
    };
    for (let i = 0; i < limit; i += 16)
      rows.push({
        addr: i, bytes: Array.from(built.bytes.slice(i, i + 16)), section: secOf(i),
      });
    return rows;
  }, [built]);

  const asm = useMemo(() => disassemble(built.code), [built]);
  const selfTest = useMemo(() => hex(sha256(new TextEncoder().encode("abc"))), []);
  const SHA_ABC = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";

  return (
    <div className="space-y-3">
      <div className="fi-panel border border-line bg-panel">
        <div className="grid lg:grid-cols-[250px_minmax(0,1fr)_262px]">
          {/* cassette */}
          <div className="border-b border-line p-3 lg:border-r lg:border-b-0">
            <canvas ref={cassetteRef} className="w-full border border-line bg-void" style={{ height: 180 }} />
            <div className="mono mt-2 text-[10.5px] font-bold" style={{ color: built.tint }}>
              {built.cart.name}
            </div>
            <div className="mono text-[9px] text-dim">
              {built.cart.cls} · {built.cart.graph.nodes.length} nodes → {built.code.length} instr
            </div>
            <div className="mt-2 max-h-[150px] space-y-1 overflow-y-auto pr-1">
              {LIBRARY.map((c) => (
                <button key={c.id} onClick={() => setCartId(c.id)}
                  className={cn("mono flex w-full items-center gap-1.5 border px-1.5 py-1 text-left text-[9px]",
                    cartId === c.id ? "bg-chalk/10" : "bg-void/40 hover:bg-void")}
                  style={{ borderColor: c.tint + (cartId === c.id ? "" : "40") }}>
                  <span className="h-2 w-2 shrink-0" style={{ background: c.tint }} />
                  <span className="truncate text-chalk/90">{c.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* viewer */}
          <div className="border-b border-line p-3 lg:border-r lg:border-b-0">
            <div className="mb-2 flex flex-wrap items-center gap-1">
              {(["hex", "asm", "cli"] as const).map((v) => (
                <button key={v} onClick={() => setView(v)}
                  className={cn("mono border px-2 py-1 text-[9px] font-bold uppercase",
                    view === v ? "border-transparent bg-chalk text-void" : "border-line text-dim hover:text-chalk")}>
                  {v === "hex" ? "hex dump" : v === "asm" ? "disassembly" : "cli"}
                </button>
              ))}
              <span className="mono ml-auto text-[9px] text-dim">
                {built.bytes.length.toLocaleString()} B
              </span>
            </div>

            {view === "hex" && (
              <div className="max-h-[330px] overflow-auto border border-line bg-void p-2">
                {dump.map((row) => (
                  <div key={row.addr} className="mono flex gap-2 text-[9.5px] leading-[1.5]"
                    onMouseEnter={() => setHoverSection(row.section)}>
                    <span className="shrink-0 text-dim/60">
                      {row.addr.toString(16).padStart(4, "0")}
                    </span>
                    <span className="shrink-0"
                      style={{ color: row.section === -1 ? "#e8eef7"
                        : row.section != null ? SECTION_COL[row.section] : "#4a5668" }}>
                      {row.bytes.map((b) => b.toString(16).padStart(2, "0")).join(" ")}
                    </span>
                    <span className="shrink-0 text-dim/50">
                      {row.bytes.map((b) => (b >= 32 && b < 127 ? String.fromCharCode(b) : "·")).join("")}
                    </span>
                  </div>
                ))}
                <div className="mono mt-2 flex flex-wrap gap-3 border-t border-line pt-2 text-[8.5px]">
                  <span className="text-chalk">■ header (64 B)</span>
                  {Object.entries(SECTION_NAME).map(([id, nm]) => (
                    <span key={id} style={{ color: SECTION_COL[+id] }}>■ §{id} {nm}</span>
                  ))}
                  {hoverSection === -1 && <span className="ml-auto text-chalk">magic · ver · hash · author · tocCount</span>}
                </div>
              </div>
            )}

            {view === "asm" && (
              <pre className="mono max-h-[330px] overflow-auto border border-line bg-void p-2 text-[9.5px] leading-[1.6] text-chalk/85">
                {asm.join("\n")}
                {"\n\n"}
                <span className="text-dim">
                  {"// no jumps, no calls, no I/O opcode.\n"}
                  {"// the DAG is a straight line, so halting is structural:\n"}
                  {`// this program provably terminates in ${built.code.length} steps.`}
                </span>
              </pre>
            )}

            {view === "cli" && (
              <pre className="mono max-h-[330px] overflow-auto border border-line bg-void p-2 text-[9px] leading-[1.5] text-chalk/80">
                {CLI_SOURCE.slice(0, 2600)}
                {"\n…"}
              </pre>
            )}
          </div>

          {/* verify */}
          <div className="p-3">
            <button onClick={() => setCorrupt(!corrupt)}
              className={cn("mono w-full border px-2 py-1.5 text-[9.5px] font-bold uppercase",
                corrupt ? "border-transparent bg-pxd text-void" : "border-line text-dim hover:text-chalk")}>
              ☣ flip one bit in §2 CODE
            </button>

            <div className="mt-3">
              <div className="mono mb-1 text-[9px] tracking-[0.2em] text-dim uppercase">verify gate</div>
              {([
                ["magic 0x534D5831", built.report.magic],
                ["format version", built.report.version],
                ["SHA-256 payload", built.report.hash],
                [`section CRC32 ×${built.report.sections}`, built.report.crcs],
                [`opcode table ×${built.report.instructions}`, built.report.unknownOpcodes.length === 0],
              ] as const).map(([k, ok]) => (
                <div key={k} className="mono flex items-center gap-2 py-[2px] text-[9.5px]">
                  <span className={ok ? "text-vtx" : "text-pxd"}>{ok ? "✓" : "✕"}</span>
                  <span className="text-dim">{k}</span>
                </div>
              ))}
              {built.report.warnings.map((w) => (
                <div key={w} className="mono py-[2px] text-[8.5px] text-lx">! {w}</div>
              ))}
              {built.report.errors.map((e) => (
                <div key={e} className="mono py-[2px] text-[8.5px] leading-snug text-pxd">✕ {e}</div>
              ))}
              <div className={cn("mono mt-2 border p-2 text-center text-[11px] font-black",
                built.report.ok ? "border-vtx bg-vtx/10 text-vtx" : "border-pxd bg-pxd/10 text-pxd")}>
                {built.report.ok ? "PASS" : "REJECTED"}
              </div>
            </div>

            <div className="mt-3 border-t border-line pt-2">
              <div className="mono mb-1 text-[9px] tracking-[0.2em] text-dim uppercase">sections</div>
              {built.unpacked?.sections.map((s) => (
                <div key={s.id} className="mono flex justify-between border-b border-line/40 py-[3px] text-[9px] last:border-0">
                  <span style={{ color: SECTION_COL[s.id] }}>§{s.id} {SECTION_NAME[s.id]}</span>
                  <span className="tnum text-dim">
                    @{s.offset} · {s.length}B{" "}
                    <span className={s.crcOk ? "text-vtx" : "text-pxd"}>{s.crcOk ? "✓" : "✕"}</span>
                  </span>
                </div>
              ))}
              <div className="mono mt-2 text-[8.5px] leading-snug text-dim">
                instr width {INSTR_BYTES} B · header {HEADER_BYTES} B · 4-byte aligned
              </div>
            </div>

            <div className="mt-2 border-t border-line pt-2">
              <div className="mono text-[9px] tracking-[0.2em] text-dim uppercase">sha256 self-test</div>
              <div className="mono mt-1 text-[8px] leading-snug break-all text-chalk/75">{selfTest}</div>
              <div className={cn("mono mt-1 text-[9px]", selfTest === SHA_ABC ? "text-vtx" : "text-pxd")}>
                {selfTest === SHA_ABC ? '✓ sha256("abc") matches FIPS 180-4' : "✕ digest mismatch"}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
