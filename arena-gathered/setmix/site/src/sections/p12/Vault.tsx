import { useMemo, useState } from "react";
import { Panel, SectionHead, Formula, Tag } from "@/components/ui";
import PresetVault from "@/components/p12/PresetVault";
import { VAULT_STATS, CATEGORIES, VAULT } from "@/drop/content/presets";
import { RECIPE_STATS } from "@/drop/content/recipes";
import { WARDROBE, WARDROBE_STATS, BASE_SOCKETS, type AvatarRig } from "@/drop/content/avatars";
import { calendar, CALENDAR_STATS, EVENT_LIST, type ScheduledEvent } from "@/drop/content/events";
import { cn } from "@/utils/cn";

/* ───────────────────────────────────────────────────── wardrobe card ── */

function RigCard({ rig, on, onClick }: { rig: AvatarRig; on: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={cn("fi-panel border p-3 text-left transition-all",
        on ? "bg-panel2" : "border-line bg-panel/60 hover:border-chalk/30")}
      style={on ? { borderColor: rig.materials.emissive } : {}}>
      <div className="flex items-center gap-2">
        <div className="flex h-10 w-10 shrink-0 flex-col overflow-hidden border border-line">
          {rig.materials.palette.map((p) => (
            <span key={p} className="flex-1" style={{ background: p }} />
          ))}
        </div>
        <div className="min-w-0">
          <div className="truncate text-[13px] leading-tight font-black"
            style={{ color: rig.materials.emissive }}>
            {rig.name}
          </div>
          <div className="mono text-[9px] text-dim">{rig.subtitle}</div>
        </div>
      </div>
      <div className="mono mt-2 flex flex-wrap gap-1 text-[8px]">
        {rig.features.ik && <span className="border border-vtx/40 px-1 text-vtx">IK</span>}
        {rig.features.headLook && <span className="border border-aq/40 px-1 text-aq">LOOK</span>}
        {rig.features.cape && <span className="border border-flux/40 px-1 text-flux">VERLET</span>}
        {rig.features.blendshapes && <span className="border border-pxd/40 px-1 text-pxd">FACE</span>}
        {rig.features.sss && <span className="border border-lx/40 px-1 text-lx">SSS</span>}
        {rig.features.breathFog && <span className="border border-line px-1 text-dim">FOG</span>}
      </div>
    </button>
  );
}

/* ───────────────────────────────────────────────── calendar heat strip ── */

function CalendarStrip({ sched, sel, onSel }: {
  sched: ScheduledEvent[]; sel: number; onSel: (d: number) => void;
}) {
  return (
    <div className="grid grid-cols-10 gap-px bg-line sm:grid-cols-15">
      {sched.map((s, i) => {
        const sev = s.event.severity;
        return (
          <button key={i} onClick={() => onSel(i)}
            title={`Day ${i + 1} · ${s.event.name}`}
            className={cn("group relative bg-panel p-1 transition-all", sel === i && "z-10")}
            style={sel === i ? { outline: `2px solid ${s.event.colour}`, outlineOffset: -2 } : {}}>
            <div className="mono text-[7px] text-dim/60">{i + 1}</div>
            <div className="mt-0.5 text-[13px] leading-none" style={{ color: s.event.colour }}>
              {s.event.glyph}
            </div>
            <div className="mt-1 h-[3px] w-full"
              style={{
                background: s.event.colour,
                opacity: sev === "CRISIS" ? 1 : sev === "MAJOR" ? 0.78 : sev === "NOTABLE" ? 0.5 : 0.22,
              }} />
          </button>
        );
      })}
    </div>
  );
}

/* ═════════════════════════════════════════════════════════ section ═══ */

export default function Vault() {
  const [rigId, setRigId] = useState(WARDROBE[0].id);
  const [seed, setSeed] = useState(70801);
  const [maxStage, setMaxStage] = useState(6);
  const [day, setDay] = useState(0);

  const rig = WARDROBE.find((r) => r.id === rigId)!;
  const sched = useMemo(() => calendar(seed, maxStage), [seed, maxStage]);
  const today = sched[day];

  const mix = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of sched) counts.set(s.event.id, (counts.get(s.event.id) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [sched]);

  return (
    <>
      {/* ── intro ──────────────────────────────────────────────────── */}
      <section id="p12-top" className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-grid opacity-50" />
        <div className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(ellipse at 60% 0%, var(--fi-accent-soft), transparent 55%)" }} />
        <div className="relative mx-auto max-w-[1400px] px-4 pt-14 pb-8 sm:px-8">
          <div className="mono mb-4 flex flex-wrap items-center gap-2 text-[10px] tracking-[0.3em] uppercase">
            <span className="fi-accent-bg px-2 py-1 font-bold text-void">PHASE 12</span>
            <span className="text-dim">the grand content vault</span>
          </div>
          <h1 className="text-balance text-[clamp(2.1rem,6vw,4.6rem)] leading-[0.95] font-black tracking-[-0.035em]">
            The architecture was the easy part. <br className="hidden sm:block" />
            Now it has <span className="fi-accent-text">things in it.</span>
          </h1>
          <p className="mt-6 max-w-3xl text-[15px] leading-relaxed text-dim sm:text-[16.5px]">
            Fifty cartridges with real evaluable ASTs, a hundred hand-placed fusion recipes forming
            a genuine discovery DAG, eight wardrobe rigs across the fidelity ladder, and a
            deterministic thirty-day weather calendar. Everything below is live: the thumbnails
            are being evaluated by <code className="mono text-chalk">@hm/texgraph</code> right now,
            and the Codex is tracking a real reachability graph.
          </p>
          <div className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {([
              ["D1", "Preset Bible", `${VAULT_STATS.total} cartridges · ${VAULT_STATS.totalNodes} AST nodes`, "#ff3d8a"],
              ["D2", "Periodic Table", `${RECIPE_STATS.total} recipes · ${RECIPE_STATS.legendary} legendary`, "#b46bff"],
              ["D3", "Wardrobe", `${WARDROBE_STATS.rigs} rigs · ${WARDROBE_STATS.accessories} accessories`, "#7cff4d"],
              ["D4", "Calendar", `${CALENDAR_STATS.events} events · ${CALENDAR_STATS.days} days`, "#ffc13d"],
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

      {/* ── D1 + D2 + D5 · the vault ───────────────────────────────── */}
      <section id="p12-vault" className="mx-auto max-w-[1400px] px-4 py-16 sm:px-8">
        <SectionHead n="12.1" kicker="Deliverables 1, 2 & 5" title="The Preset Vault"
          lede="Search 50 cartridges, inspect a live rotating sphere evaluated from the real DAG, read the lore and the stat block, equip to your hotbar, and fuse. Then switch to the Codex and watch a hundred recipes unlock in dependency order." />
        <PresetVault />

        <div className="mt-3 grid gap-3 lg:grid-cols-3">
          <Panel label="WHY ARCHETYPES, NOT 50 NODE SOUPS" accent="#ff3d8a">
            <Formula>{`8 archetype builders  ×  50 tuned instances
  rock · crystal · carpet · flow
  columnar · strata · tile · canopy`}</Formula>
            <p className="mt-2 text-[12px] leading-relaxed text-dim">
              Fifty hand-written graphs would be fifty places to get the roughness range wrong.
              A tech artist authors the archetype; content designers tune instances. Every
              cartridge still expands to a genuine AST — <code className="mono text-chalk">{VAULT_STATS.totalNodes}</code>{" "}
              real nodes and <code className="mono text-chalk">{VAULT_STATS.totalVars}</code> declared
              Variables across the set — and every one is evaluable right now.
            </p>
            <div className="mono mt-2 grid grid-cols-2 gap-x-3 border-t border-line pt-2 text-[9.5px]">
              {CATEGORIES.map((c) => (
                <div key={c} className="flex justify-between py-[2px]">
                  <span className="text-dim">{c}</span>
                  <span className="tnum text-chalk">{VAULT.filter((x) => x.category === c).length}</span>
                </div>
              ))}
            </div>
          </Panel>

          <Panel label="THE FOUR AUTHORING RULES" accent="#b46bff">
            <ol className="space-y-2 text-[12px] leading-relaxed text-dim">
              <li className="flex gap-2"><span className="mono text-flux">1.</span>
                <span><strong className="text-chalk">Guessable in hindsight.</strong> "Obsidian + Clathrate → Prismatic Geode" should make a player say <em className="not-italic">of course</em>, never <em className="not-italic">how?</em></span></li>
              <li className="flex gap-2"><span className="mono text-flux">2.</span>
                <span><strong className="text-chalk">Nothing is random.</strong> All 100 are hand-placed, which is the only reason the Speculation Sphere's confidence number can be honest.</span></li>
              <li className="flex gap-2"><span className="mono text-flux">3.</span>
                <span><strong className="text-chalk">Every output earns its slot.</strong> A recipe that only changes the look is a texture, not a discovery.</span></li>
              <li className="flex gap-2"><span className="mono text-flux">4.</span>
                <span><strong className="text-chalk">The DAG must branch and reconverge.</strong> Recipe <code className="mono text-chalk">r100</code> consumes two tier-6 legendaries that descend from entirely different tier-1 bases.</span></li>
            </ol>
          </Panel>

          <Panel label="THE SHAPE OF THE TREE" accent="#7cff4d">
            <div className="space-y-1">
              {RECIPE_STATS.byTier.filter((x) => x.n > 0).map((x) => (
                <div key={x.t} className="mono flex items-center gap-2 text-[9.5px]">
                  <span className="w-10 text-dim">T{x.t}</span>
                  <div className="h-[6px] flex-1 bg-line">
                    <div className="h-full bg-vtx" style={{ width: `${(x.n / 24) * 100}%` }} />
                  </div>
                  <span className="tnum w-6 text-right text-chalk">{x.n}</span>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[12px] leading-relaxed text-dim">
              Deliberately widest at Tier 2 — twenty-four base alloys give early players the sense
              that everything combines with everything. It narrows toward Tier 6, where sixteen
              Legendary Masterpieces each take two full sub-trees to reach. Average Sphere
              confidence across the table: <strong className="text-chalk">{RECIPE_STATS.avgConfidence}%</strong>.
            </p>
          </Panel>
        </div>
      </section>

      {/* ── D3 · wardrobe ──────────────────────────────────────────── */}
      <section id="p12-wardrobe" className="mx-auto max-w-[1400px] px-4 py-16 sm:px-8">
        <SectionHead n="12.2" kicker="Deliverable 3" title="The Goblin Wardrobe"
          lede="Eight cosmetic rigs over ONE shared skeleton. Nothing here changes hitbox, reach or movement — GoblinController owns all of that. A player who prefers the 48-triangle Scrap Golem at Stage 6 keeps the Stage-6 budget and loses nothing but the ceramic." />

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {WARDROBE.map((r) => (
            <RigCard key={r.id} rig={r} on={rigId === r.id} onClick={() => setRigId(r.id)} />
          ))}
        </div>

        <div className="mt-3 grid gap-3 lg:grid-cols-[1.25fr_1fr]">
          <Panel label={rig.name.toUpperCase()} accent={rig.materials.emissive}>
            <div className="flex flex-wrap items-center gap-2">
              <Tag color={rig.materials.emissive} solid>{rig.subtitle}</Tag>
              <Tag color={rig.materials.emissive}>{rig.boneCount} bones</Tag>
              <Tag>{rig.footstepTimbre} foley</Tag>
              <Tag>unlock S{rig.unlockStage}</Tag>
            </div>
            <p className="mt-3 text-[13.5px] leading-relaxed text-chalk/90 italic">"{rig.lore}"</p>
            <div className="mono mt-3 text-[9px] tracking-[0.2em] text-dim uppercase">Silhouette</div>
            <p className="mt-1 text-[12px] leading-relaxed text-dim">{rig.silhouette}</p>

            <div className="mono mt-3 text-[9px] tracking-[0.2em] text-dim uppercase">
              Accessories · {rig.accessories.reduce((a, x) => a + x.tris, 0).toLocaleString()} of{" "}
              {rig.triBudget.toLocaleString()} tris
            </div>
            <div className="mt-1 divide-y divide-line/50">
              {rig.accessories.map((a) => (
                <div key={a.name} className="py-2">
                  <div className="mono flex items-baseline justify-between gap-2 text-[10.5px]">
                    <span className="font-bold" style={{ color: rig.materials.emissive }}>{a.name}</span>
                    <span className="tnum shrink-0 text-dim">
                      {a.socket} · {a.tris.toLocaleString()} tri
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11.5px] leading-snug text-dim">{a.note}</p>
                </div>
              ))}
            </div>
            <div className="mono mt-2 border-t border-line pt-2 text-[10px] text-lx">
              UNLOCK · {rig.unlockCondition}
            </div>
          </Panel>

          <div className="space-y-3">
            <Panel label="SOCKET LAYOUT · shared across all 8 rigs" accent="#7cff4d">
              <div className="mono grid grid-cols-[1fr_auto] gap-x-3 text-[9.5px]">
                {rig.sockets.map((s) => {
                  const base = BASE_SOCKETS.find((b) => b.socket === s.socket)!;
                  const moved = base.pos.some((v, i) => Math.abs(v - s.pos[i]) > 0.001) || s.scale !== 1;
                  return (
                    <div key={s.socket} className="contents">
                      <span className={cn("border-b border-line/40 py-[3px]", moved ? "text-lx" : "text-dim")}>
                        {moved ? "▸ " : "  "}{s.socket}
                      </span>
                      <span className="tnum border-b border-line/40 py-[3px] text-right text-chalk/80">
                        [{s.pos.map((v) => v.toFixed(2)).join(", ")}]{s.scale !== 1 ? ` ×${s.scale}` : ""}
                      </span>
                    </div>
                  );
                })}
              </div>
              <p className="mono mt-2 text-[9.5px] leading-snug text-dim">
                Offsets are metres in rig-local space, root at the feet. Authored here rather than
                baked into meshes, so a hat fits every rig without a per-rig variant. Amber rows
                are this rig's overrides.
              </p>
            </Panel>
            <Panel label="MATERIAL SET" accent={rig.materials.emissive}>
              <div className="mb-2 flex gap-px">
                {rig.materials.palette.map((p) => (
                  <div key={p} className="h-8 flex-1" style={{ background: p }} />
                ))}
                <div className="h-8 w-8" style={{ background: rig.materials.emissive }} />
              </div>
              {([
                ["base wear", rig.materials.baseWear],
                ["roughness", rig.materials.baseRough],
                ["metallic", rig.materials.metallic],
                ["subsurface", rig.materials.subsurface],
                ["visor transmission", rig.materials.visorTransmission],
              ] as const).map(([k, v]) => (
                <div key={k} className="mono flex items-center gap-2 py-[2px] text-[9.5px]">
                  <span className="w-[108px] shrink-0 text-dim">{k}</span>
                  <div className="h-[3px] flex-1 bg-line">
                    <div className="h-full" style={{ width: `${v * 100}%`, background: rig.materials.emissive }} />
                  </div>
                  <span className="tnum w-8 text-right text-chalk">{v.toFixed(2)}</span>
                </div>
              ))}
            </Panel>
          </div>
        </div>
      </section>

      {/* ── D4 · calendar ──────────────────────────────────────────── */}
      <section id="p12-calendar" className="mx-auto max-w-[1400px] px-4 py-16 sm:px-8">
        <SectionHead n="12.3" kicker="Deliverable 4" title="The Planetary Calendar"
          lede="A weather system that surprises you is a weather system you cannot plan around — and terraforming is a planning game. So the calendar is fully deterministic and fully forecastable: given (seed, day) every event is already decided. Players do not react to weather. They schedule around it." />

        <div className="fi-panel border border-line bg-panel">
          <div className="flex flex-wrap items-center gap-3 border-b border-line bg-void2 p-2">
            <div className="mono flex items-center gap-2 text-[9.5px]">
              <span className="text-dim">seed</span>
              <input type="number" value={seed} onChange={(e) => setSeed(+e.target.value || 1)}
                className="w-24 border border-line bg-void px-1.5 py-1 text-[10px] text-chalk outline-none" />
            </div>
            <div className="mono flex items-center gap-1 text-[9.5px]">
              <span className="text-dim">max stage</span>
              {[1, 2, 3, 4, 5, 6].map((s) => (
                <button key={s} onClick={() => setMaxStage(s)}
                  className={cn("border px-1.5 py-1 text-[9px]",
                    maxStage === s ? "border-transparent bg-chalk text-void" : "border-line text-dim hover:text-chalk")}>
                  {s}
                </button>
              ))}
            </div>
            <span className="mono ml-auto text-[9px] text-dim">
              1 day = 24 real min · cycle = {CALENDAR_STATS.realHoursPerCycle} h ·{" "}
              {CALENDAR_STATS.calmShare}% calm by weight
            </span>
          </div>

          <div className="p-2">
            <CalendarStrip sched={sched} sel={day} onSel={setDay} />
          </div>

          <div className="grid gap-3 border-t border-line p-3 lg:grid-cols-[1.3fr_1fr]">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-2xl" style={{ color: today.event.colour }}>{today.event.glyph}</span>
                <div>
                  <div className="text-[17px] leading-tight font-black" style={{ color: today.event.colour }}>
                    {today.event.name}
                  </div>
                  <div className="mono text-[9px] text-dim">
                    day {day + 1} · {today.event.severity} · {today.event.durationHours} h ·
                    intensity {today.intensity.toFixed(2)} · ticks {today.startTick.toLocaleString()}–{today.endTick.toLocaleString()}
                  </div>
                </div>
              </div>
              <div className="mono mt-3 text-[9px] tracking-[0.2em] text-dim uppercase">Spectacle</div>
              <p className="mt-1 text-[12.5px] leading-relaxed text-chalk/85">{today.event.spectacle}</p>
              <div className="mono mt-3 text-[9px] tracking-[0.2em] text-dim uppercase">Why you change your plans</div>
              <p className="mt-1 text-[12.5px] leading-relaxed text-dim">{today.event.tactics}</p>
              <div className="mono mt-3 text-[9px] tracking-[0.2em] text-dim uppercase">Audio</div>
              <p className="mt-1 text-[11.5px] leading-snug text-aq">{today.event.audio}</p>
            </div>

            <div>
              <div className="mono mb-1 text-[9px] tracking-[0.2em] text-dim uppercase">Effect multipliers</div>
              {Object.entries(today.event.effects).filter(([k]) => k !== "spawns" && k !== "yield").map(([k, v]) => (
                <div key={k} className="mono flex justify-between border-b border-line/40 py-[3px] text-[9.5px]">
                  <span className="text-dim">{k}</span>
                  <span className="tnum" style={{ color: (v as number) > 1 ? "#7cff4d" : (v as number) < 1 ? "#ff3d8a" : "#e8eef7" }}>
                    {typeof v === "number" ? (k.includes("Delta") ? (v > 0 ? `+${v}` : v) : `${v}×`) : String(v)}
                  </span>
                </div>
              ))}
              {today.event.effects.yield && (
                <>
                  <div className="mono mt-2 mb-1 text-[9px] tracking-[0.2em] text-dim uppercase">Metric yield</div>
                  {Object.entries(today.event.effects.yield).map(([k, v]) => (
                    <div key={k} className="mono flex justify-between border-b border-line/40 py-[3px] text-[9.5px]">
                      <span style={{ color: { pxd: "#ff3d8a", vtx: "#7cff4d", lx: "#ffc13d", aq: "#3dc8ff" }[k] }}>{k}</span>
                      <span className="tnum" style={{ color: v > 1 ? "#7cff4d" : "#ff3d8a" }}>{v}×</span>
                    </div>
                  ))}
                </>
              )}
              {today.event.effects.spawns && (
                <>
                  <div className="mono mt-2 mb-1 text-[9px] tracking-[0.2em] text-dim uppercase">Temporary nodes</div>
                  {today.event.effects.spawns.map((s) => (
                    <div key={s.node} className="mono flex justify-between py-[2px] text-[9.5px]">
                      <span className="text-chalk/80">{s.node}</span>
                      <span className="tnum text-lx">×{s.count} T{s.tier}</span>
                    </div>
                  ))}
                </>
              )}
              <div className="mono mt-3 border-t border-line pt-2 text-[9px] tracking-[0.2em] text-dim uppercase">
                30-day mix at S{maxStage}
              </div>
              <div className="mt-1 space-y-[2px]">
                {mix.map(([id, n]) => {
                  const e = EVENT_LIST.find((x) => x.id === id)!;
                  return (
                    <div key={id} className="mono flex items-center gap-2 text-[9px]">
                      <span style={{ color: e.colour }}>{e.glyph}</span>
                      <span className="flex-1 truncate text-dim">{e.name}</span>
                      <div className="h-[3px] w-14 bg-line">
                        <div className="h-full" style={{ width: `${(n / 30) * 100}%`, background: e.colour }} />
                      </div>
                      <span className="tnum w-4 text-right text-chalk">{n}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-3 grid gap-3 lg:grid-cols-3">
          <Panel label="THE FORECAST IS THE FEATURE" accent="#ffc13d">
            <Formula>{`eventForDay(seed, day, maxStage) → ScheduledEvent
  splitmix32(seed, day, salt) → weighted pick
  anti-cluster: never two CRISIS days running
  no stored state, no RNG object, no drift`}</Formula>
            <p className="mt-2 text-[12px] leading-relaxed text-dim">
              Because it is a pure hash of (seed, day), the Planet Table can show seven days ahead
              on any machine — and a player can plan a polar expedition around a Crystal Resonance
              that is still four days away. Change the seed above and the whole month re-rolls,
              identically, forever.
            </p>
          </Panel>
          <Panel label="A THIRD OF THE MONTH IS QUIET" accent="#8b9bb4">
            <p className="text-[12.5px] leading-relaxed text-dim">
              <strong className="text-chalk">Clear Skies carries the heaviest weight in the table.</strong>{" "}
              An event calendar with no gaps is a calendar with no events — the quiet days are what
              make the Twin Eclipse land. This is the same reasoning that put the 4-minute
              "something visible is always coming" rule in GDD §6, applied at a longer wavelength.
            </p>
          </Panel>
          <Panel label="THE ONE EVENT YOU CAUSE" accent="#ff3d8a">
            <p className="text-[12.5px] leading-relaxed text-dim">
              <strong className="text-chalk">Null Tide only fires when Aq exceeds Pxd by 3×.</strong>{" "}
              It is the coherence term from Section 1 of the GDD, wearing a monster costume. Every
              other event happens to you; this one is something you did. Fix the ratio and it
              recedes — the only weather in the game that can be prevented by playing better.
            </p>
          </Panel>
        </div>

        <div className="fi-panel relative mt-10 overflow-hidden border border-line bg-panel p-6 sm:p-10">
          <div className="pointer-events-none absolute inset-0 bg-grid opacity-50" />
          <div className="pointer-events-none absolute inset-0"
            style={{ background: "radial-gradient(ellipse at 25% 0%, var(--fi-accent-soft), transparent 60%)" }} />
          <div className="relative">
            <div className="mono text-[10px] tracking-[0.3em] text-dim uppercase">Twelve phases later</div>
            <p className="text-balance mt-3 max-w-4xl text-xl leading-snug font-light sm:text-3xl">
              We started with four floats and a claim: that{" "}
              <span className="fi-accent-text font-black">terraforming is rendering</span>. Fifty
              cartridges, a hundred recipes, eight wardrobes and thirty days of weather later,
              every one of them still reads the same four numbers.
            </p>
            <p className="mt-4 max-w-3xl text-[13px] leading-relaxed text-dim">
              The Preset Bible needed no new systems. The Periodic Table is the fusion grammar from
              Phase 2 with content poured into it. The wardrobe is the AvatarFidelityManager's
              existing feature flags, dressed. The calendar is a hash function and a weight table.
              That is what a good architecture buys you: the content phase is the easy phase, and
              everything you add makes everything already there better.
            </p>
            <div className="mono mt-5 flex flex-wrap gap-2 text-[9px]">
              {[`${VAULT_STATS.total} cartridges`, `${VAULT_STATS.totalNodes} AST nodes`,
                `${RECIPE_STATS.total} recipes`, `${WARDROBE_STATS.rigs} rigs`,
                `${WARDROBE_STATS.accessories} accessories`, `${CALENDAR_STATS.events} events`,
                "0 image assets", "0 audio assets", "0 servers"].map((s) => (
                <span key={s} className="fi-accent-border border px-2 py-1 fi-accent-text">{s}</span>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
