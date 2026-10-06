import { useEffect, useState } from "react";
import { FiProvider, useFi, fmtBig } from "@/state/fi";
import { STAGES, METRICS, META } from "@/data/gdd";
import { Slider } from "@/components/ui";
import Hero from "@/sections/Hero";
import Sec1 from "@/sections/Sec1";
import Sec2 from "@/sections/Sec2";
import Sec3 from "@/sections/Sec3";
import Sec4 from "@/sections/Sec4";
import Sec5 from "@/sections/Sec5";
import Sec6 from "@/sections/Sec6";
import Sec7 from "@/sections/Sec7";
import P2Intro from "@/sections/p2/Intro";
import P2Bridge from "@/sections/p2/Bridge";
import P2Studio from "@/sections/p2/Studio";
import P2Ship from "@/sections/p2/Ship";
import P3Intro from "@/sections/p3/Intro";
import P3Field from "@/sections/p3/Field";
import P3Mesh from "@/sections/p3/Mesh";
import P3Outline from "@/sections/p3/Outline";
import Phase4 from "@/sections/p4/Phase4";
import Phase5 from "@/sections/p5/Phase5";
import VaultSection from "@/sections/p12/Vault";
import { cn } from "@/utils/cn";

const NAV_GDD = [
  ["s1", "01 Core Systems"],
  ["s2", "02 Lab & Fusion"],
  ["s3", "03 Planet Loop"],
  ["s4", "04 Modes"],
  ["s5", "05 Pedagogy"],
  ["s6", "06 Hard Q"],
  ["s7", "07 Vertical Slice"],
];

const NAV_P2 = [
  ["p2-bridge", "2.1 The Bridge"],
  ["p2-studio", "2.2 Presets & Fusion"],
  ["p2-ship", "2.3 Packages & PRs"],
];

const NAV_P3 = [
  ["p3-field", "3.1 Wave Engine"],
  ["p3-mesh", "3.2 Meshing & Seams"],
  ["p3-outliner", "3.3 Inception Outliner"],
];

const NAV_P4 = [
  ["p4-shader", "4.1 Uber-Shader"],
  ["p4-audio", "4.2 Audio Synth"],
  ["p4-tests", "4.3 Test Suite"],
  ["p4-unreal", "4.4 UE5 Nanite"],
  ["p4-source", "4.5 Source"],
];

const NAV_P5 = [
  ["p5-portal", "5.1 Portal"],
  ["p5-goblin", "5.2 Goblin"],
  ["p5-machines", "5.3 Machines"],
  ["p5-galaxy", "5.4 Galaxy"],
  ["p5-source", "5.5 Source"],
];

const NAV_P12 = [
  ["p12-vault", "12.1 Preset Vault"],
  ["p12-wardrobe", "12.2 Wardrobe"],
  ["p12-calendar", "12.3 Calendar"],
];

type Phase = "gdd" | "repo" | "systems" | "ship" | "game" | "vault";

function Chrome({ phase, setPhase }: { phase: Phase; setPhase: (p: Phase) => void }) {
  const { t, setT, fi, stage, m } = useFi();
  const [active, setActive] = useState("top");
  const [open, setOpen] = useState(false);
  const NAV =
    phase === "gdd" ? NAV_GDD : phase === "repo" ? NAV_P2
      : phase === "systems" ? NAV_P3 : phase === "ship" ? NAV_P4
        : phase === "game" ? NAV_P5 : NAV_P12;

  useEffect(() => {
    const ids = ["top", "p2-top", "p3-top", "p4-top", "p5-top", "p12-top", ...NAV.map((n) => n[0])];
    const onScroll = () => {
      let cur = "top";
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top < 160) cur = id;
      }
      setActive(cur);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [phase]);

  const S = STAGES[stage];

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-line bg-void/92 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1400px] items-center gap-3 px-4 py-2 sm:px-8">
          <a
            href={phase === "gdd" ? "#top" : phase === "repo" ? "#p2-top" : "#p3-top"}
            className="flex shrink-0 items-baseline gap-2"
          >
            <span className="text-[17px] leading-none font-black tracking-tight">
              SET<span className="fi-accent-text">MIX</span>
            </span>
          </a>

          <div className="flex shrink-0 gap-px border border-line">
            {([
              ["gdd", "GDD"],
              ["repo", "REPO"],
              ["systems", "SYS"],
              ["ship", "SHIP"],
              ["game", "GAME"],
              ["vault", "VAULT"],
            ] as const).map(([k, l]) => (
              <button
                key={k}
                onClick={() => {
                  setPhase(k);
                  window.scrollTo({ top: 0 });
                }}
                className={cn(
                  "mono px-2 py-1 text-[9px] font-bold tracking-[0.18em]",
                  phase === k ? "fi-accent-bg text-void" : "text-dim hover:text-chalk",
                )}
              >
                {l}
              </button>
            ))}
          </div>

          <nav className="no-scrollbar hidden flex-1 items-center gap-1 overflow-x-auto lg:flex">
            {NAV.map(([id, label]) => (
              <a
                key={id}
                href={`#${id}`}
                className={cn(
                  "mono px-2 py-1 text-[10px] tracking-[0.1em] whitespace-nowrap uppercase transition-colors",
                  active === id ? "fi-accent-text font-bold" : "text-dim hover:text-chalk",
                )}
              >
                {label}
              </a>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <div className="hidden w-32 sm:block">
              <Slider value={t} onChange={setT} color="var(--fi-accent)" />
            </div>
            <div className="text-right">
              <div className="mono tnum fi-accent-text text-[13px] leading-none font-black">
                {fmtBig(fi)}
              </div>
              <div className="mono text-[8px] tracking-[0.18em] text-dim uppercase">
                Fi · {S.code}
              </div>
            </div>
            <button
              onClick={() => setOpen(!open)}
              className="mono border border-line px-2 py-1 text-[10px] text-dim lg:hidden"
            >
              ☰
            </button>
          </div>
        </div>

        {/* metric strip */}
        <div className="flex h-[3px] w-full">
          {METRICS.map((mt) => (
            <div key={mt.key} className="h-full flex-1 bg-void2">
              <div
                className="h-full transition-[width] duration-150"
                style={{ width: `${m[mt.key] * 100}%`, background: mt.color }}
              />
            </div>
          ))}
        </div>

        {open && (
          <div className="grid grid-cols-2 gap-px border-t border-line bg-line lg:hidden">
            {NAV.map(([id, label]) => (
              <a
                key={id}
                href={`#${id}`}
                onClick={() => setOpen(false)}
                className="mono bg-void px-3 py-2 text-[10px] tracking-[0.1em] text-dim uppercase"
              >
                {label}
              </a>
            ))}
          </div>
        )}
      </header>

      <main>
        {phase === "gdd" ? (
          <>
            <Hero />
            <Divider label="SECTION ONE · CORE SYSTEMS" />
            <Sec1 />
            <Divider label="SECTION TWO · LAB TECH & PRESET ALCHEMY" />
            <Sec2 />
            <Divider label="SECTION THREE · PLANETARY LOOP & ECONOMY" />
            <Sec3 />
            <Divider label="SECTION FOUR · STUDIO / PLAY ARCHITECTURE" />
            <Sec4 />
            <Divider label="SECTION FIVE · PEDAGOGY" />
            <Sec5 />
            <Divider label="SECTION SIX · HARD DESIGN REASONING" />
            <Sec6 />
            <Divider label="SECTION SEVEN · MVP VERTICAL SLICE" />
            <Sec7 />
          </>
        ) : phase === "repo" ? (
          <>
            <P2Intro />
            <Divider label="2.1 · THE BRIDGE — deriveBudget() → @hm/texgraph" />
            <P2Bridge />
            <Divider label="2.2 · PRESETS, VARIABLES, FORKS, COMMANDS" />
            <P2Studio />
            <Divider label="2.3 · PACKAGES, COMMANDS & THE MERGE PLAN" />
            <P2Ship />
          </>
        ) : phase === "systems" ? (
          <>
            <P3Intro />
            <Divider label="3.1 · @hm/setmix-field — THE TERRAFORM WAVE ENGINE" />
            <P3Field />
            <Divider label="3.2 · @hm/setmix-mesh — SMOOTHVOX2 & THE SEAM" />
            <P3Mesh />
            <Divider label="3.3 · @hm/setmix-outliner — THE INCEPTION HIERARCHY" />
            <P3Outline />
          </>
        ) : phase === "ship" ? (
          <Phase4 />
        ) : phase === "game" ? (
          <Phase5 />
        ) : (
          <VaultSection />
        )}
      </main>

      <footer className="border-t border-line bg-void2">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-4 px-4 py-10 sm:flex-row sm:items-end sm:justify-between sm:px-8">
          <div>
            <div className="text-2xl font-black tracking-tight">
              SET<span className="fi-accent-text">MIX</span>
            </div>
            <div className="mono mt-1 text-[10px] tracking-[0.3em] text-dim uppercase">
              {META.subtitle} ·{" "}
              {phase === "gdd"
                ? META.version
                : phase === "repo"
                  ? "Phase 2 · HeavyMetal2 integration"
                  : phase === "systems"
                    ? "Phase 3 · field · mesh · outliner"
                    : phase === "ship"
                      ? "Phase 4 · production merge"
                      : phase === "game"
                        ? "Phase 5 · portal · avatar · automation · galaxy"
                        : "Phase 12 · the grand content vault"}
            </div>
            <p className="mono mt-3 max-w-md text-[11px] leading-relaxed text-dim">
              Terraforming is rendering. Rendering is authorship. Authorship is the game.
            </p>
          </div>
          <div className="mono space-y-1 text-[10px] text-dim">
            {(phase === "gdd"
              ? [
                  "Engine: custom clustered-LOD voxel renderer",
                  "Target: PC / console / Steam Deck · 60 fps at every stage",
                  "Modes: Play · Studio · Galaxy",
                  "Interchange: .setmix 1.0 (CC-BY-SA)",
                ]
              : phase === "repo"
                ? [
                    "Repo: Piskriek/HeavyMetal2 · packages/setmix-*",
                    "Depends on: @hm/texgraph (3 exports, 4 interfaces)",
                    "PR 1: 1,430 LOC of pure functions, zero side effects",
                    "Build: inlines into the single static apps/web html",
                  ]
                : phase === "systems"
                  ? [
                      "setmix-field · 430 LOC · O(circumference) per tick",
                      "setmix-mesh · 320 LOC · seams correct by construction",
                      "setmix-outliner · 470 LOC · 9 scopes, 1 record type",
                      "texgraph +180 LOC · bounds · curl · ramp modes",
                    ]
                  : phase === "ship"
                    ? [
                        "contracts + fidelity · 1,690 LOC · 30 specs green",
                        "TerrainMaterial.ts · 1 GLSL program · 0 variants",
                        "export-ue5 + import_setmix_to_ue5.py · UE 5.5",
                        "audio · pure Web Audio · 0 bytes of sample data",
                      ]
                    : phase === "game"
                      ? [
                          "portal · stencil + oblique clip + threshold FSM",
                          "goblin-controller · 4 tiers · IK · Verlet cape",
                          "setmix-machines · islands · load² heat · plumes",
                          "galaxy · ~200 kB planets, derived not transferred",
                        ]
                      : [
                          "content/presets · 50 cartridges · 8 archetypes",
                          "content/recipes · 100 recipes · 6-tier DAG",
                          "content/avatars · 8 rigs · 1 shared skeleton",
                          "content/events · 12 events · deterministic 30-day cycle",
                        ]
            ).map((x) => (
              <div key={x}>› {x}</div>
            ))}
          </div>
        </div>
      </footer>
    </>
  );
}

function Divider({ label }: { label: string }) {
  return (
    <div className="mx-auto max-w-[1400px] px-4 sm:px-8">
      <div className="mono flex items-center gap-3 border-t border-line py-2 text-[9px] tracking-[0.3em] text-dim uppercase">
        <span className="fi-accent-bg h-[6px] w-[6px]" />
        {label}
        <span className="h-px flex-1 bg-line" />
      </div>
    </div>
  );
}

export default function App() {
  const [phase, setPhase] = useState<Phase>("gdd");
  return (
    <FiProvider>
      <div className="min-h-screen bg-void text-chalk">
        <Chrome phase={phase} setPhase={setPhase} />
      </div>
    </FiProvider>
  );
}
