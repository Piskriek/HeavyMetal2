import { META, STAGES } from "@/data/gdd";
import FidelityEngine from "@/components/FidelityEngine";
import { useFi, fmtBig } from "@/state/fi";
import portal from "@/assets/portal.jpg";

export default function Hero() {
  const { fi, stage, t } = useFi();
  const S = STAGES[stage];

  return (
    <section id="top" className="relative overflow-hidden">
      {/* background */}
      <div className="pointer-events-none absolute inset-0">
        <img
          src={portal}
          alt=""
          className="h-full w-full scale-110 object-cover opacity-[0.13] blur-[3px]"
          style={{ filter: `saturate(${0.1 + t * 0.9}) contrast(1.1)` }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-void/70 via-void/85 to-void" />
        <div className="absolute inset-0 bg-grid opacity-60" />
        <div className="bg-dither absolute inset-0" />
      </div>

      <div className="relative mx-auto max-w-[1400px] px-4 pt-14 pb-10 sm:px-8 sm:pt-20">
        <div className="grid items-end gap-8 lg:grid-cols-[1.25fr_1fr]">
          <div>
            <div className="mono mb-4 flex flex-wrap items-center gap-2 text-[10px] tracking-[0.3em] uppercase">
              <span className="fi-accent-bg px-2 py-1 font-bold text-void">{META.version}</span>
              <span className="text-dim">Confidential · Pre-Production</span>
            </div>
            <h1 className="text-[clamp(3rem,11vw,9rem)] leading-[0.82] font-black tracking-[-0.045em]">
              SET<span className="fi-accent-text">MIX</span>
            </h1>
            <div className="mono mt-3 text-[11px] tracking-[0.42em] text-dim uppercase sm:text-[13px]">
              The Resolution Crafter
            </div>
            <p className="text-balance mt-6 max-w-2xl text-lg leading-snug font-light text-chalk/90 sm:text-2xl">
              {META.logline}
            </p>
            <p className="mt-4 max-w-2xl text-[14px] leading-relaxed text-dim">
              A 3D terraforming, crafting and creative sandbox. A containment accident tears an
              Einstein–Rosen bridge between your pristine PBR laboratory and a desolate low-poly
              moon. You mine the moon for raw <em className="text-pxd not-italic">pixels</em>,{" "}
              <em className="text-vtx not-italic">topology</em>,{" "}
              <em className="text-lx not-italic">lumens</em> and{" "}
              <em className="text-aq not-italic">hydrology</em>, and you pump them back into the
              sky until the universe renders itself into paradise.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {META.pillars.map((p) => (
              <div
                key={p.n}
                className="fi-panel border border-line bg-panel/70 p-3 backdrop-blur-sm"
              >
                <div className="mono fi-accent-text text-[10px] font-bold tracking-[0.2em]">
                  {p.n}
                </div>
                <div className="mt-1 text-[13px] leading-tight font-bold">{p.name}</div>
                <p className="mt-1.5 text-[11px] leading-snug text-dim">{p.body}</p>
              </div>
            ))}
          </div>
        </div>

        {/* key art */}
        <div className="fi-panel relative mt-8 overflow-hidden border border-line">
          <img src={portal} alt="Looking through the portal archway at the low-poly moon" className="w-full" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-void via-transparent to-transparent" />
          <div className="pointer-events-none absolute inset-0 bg-scan opacity-25" />
          <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-3 p-3 sm:p-5">
            <div>
              <div className="mono text-[9px] tracking-[0.3em] text-chalk/60 uppercase">
                Key art · Beat 02 · T+00:02 — The Portal Frame
              </div>
              <div className="text-xl leading-tight font-black sm:text-3xl">
                One room. Two renderers. No loading screen.
              </div>
            </div>
            <p className="mono max-w-md text-[10.5px] leading-snug text-chalk/70">
              Photoreal PBR on this side of the arch; a flat-shaded 4-colour moon on the other.
              Put your hand through the plane and watch it de-resolve mid-air at the boundary —
              the single most important interaction in the vertical slice, and it has no words in
              it.
            </p>
          </div>
        </div>

        {/* live engine */}
        <div className="mt-10">
          <div className="mono mb-2 flex flex-wrap items-end justify-between gap-2">
            <div className="text-[10px] tracking-[0.28em] text-dim uppercase">
              ▣ Live fidelity simulation — software-rendered in this page
            </div>
            <div className="tnum text-[10px] text-dim">
              Fi <span className="fi-accent-text font-bold">{fmtBig(fi)}</span> / 100.0M ·{" "}
              {S.code} {S.name}
            </div>
          </div>
          <FidelityEngine />
          <p className="mono mt-2 text-[10.5px] leading-relaxed text-dim">
            Everything above is generated from maths in real time: value-noise terrain, painter's
            algorithm rasterisation, a shrinking internal framebuffer, ordered-dither palette
            quantisation, per-face lighting models and a depth-tinted water pass. Drag the dial and
            the whole document terraforms with it — panel radii, saturation, accent colours and
            grain are all bound to the planetary Fidelity Index.
          </p>
        </div>
      </div>
    </section>
  );
}
