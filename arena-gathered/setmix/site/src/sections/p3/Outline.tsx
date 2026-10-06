import { Panel, SectionHead, Formula, Tag } from "@/components/ui";
import Inception from "@/components/Inception";
import { SCOPES, SCOPE_META, TOOLS, OUTLINER_COMMANDS } from "@/engine/setmix/outliner";

export default function Outline() {
  return (
    <section id="p3-outliner" className="mx-auto max-w-[1400px] px-4 py-16 sm:px-8">
      <SectionHead
        n="3.3"
        kicker="@hm/setmix-outliner"
        title="The Inception Hierarchy"
        lede="Nine scopes, one record type. The outliner does not know what a moon is, or a biome, or a float — it renders a tree of Presets and lets the viewport decide how to draw whatever you are currently standing inside. Double-click to fall a level deeper. Esc to wake up one level."
      />

      {/* the ladder */}
      <div className="fi-panel mb-3 overflow-x-auto border border-line bg-panel">
        <div className="flex min-w-[900px]">
          {SCOPES.map((k, i) => {
            const m = SCOPE_META[k];
            return (
              <div key={k} className="relative flex-1 border-r border-line p-3 last:border-r-0">
                <div className="mono flex items-baseline gap-1.5 text-[9px] tracking-[0.18em] uppercase">
                  <span style={{ color: m.colour }}>{m.glyph}</span>
                  <span className="text-dim">L{i}</span>
                </div>
                <div className="mt-1 text-[12px] leading-tight font-black" style={{ color: m.colour }}>
                  {k}
                </div>
                <p className="mt-1 text-[10px] leading-snug text-dim">{m.blurb}</p>
                {i < SCOPES.length - 1 && (
                  <span className="absolute top-3 -right-[7px] z-10 text-[11px] text-dim/60">›</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <Inception />

      <div className="mono mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-dim">
        <span>
          <span className="text-chalk">Double-click</span> a row or the zoom button → descend
        </span>
        <span>
          <span className="text-chalk">Esc</span> → ascend one level
        </span>
        <span>
          <span className="text-chalk">Tab</span> → cycle the hotbar, swapping what the goblin holds
        </span>
        <span>
          <span className="text-chalk">Double-click a name</span> → rename in place
        </span>
        <span className="opacity-70">(hover the panel so it owns the keyboard)</span>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-[1.05fr_1fr]">
        <Panel label="WHY ONE RECORD TYPE WORKS" accent="var(--fi-accent)">
          <Formula>{`interface OutlinerNode {
  id: string;  kind: ScopeKind;  name: string;
  parentId: string | null;  childIds: string[];
  visible: boolean;  locked: boolean;
  tris?: number;  ms?: number;  lod?: string;
  payload?: {                       // ← the ONLY scope-specific part
    cartridge?: Cartridge;          //   CARTRIDGE
    texNode?: TexNode;              //   TEXNODE
    variable?: VarDecl; value?: number;  // VARIABLE
    metrics?: { pxd,vtx,lx,aq };    //   MOON
    chunk?: { cx,cz,state,policy }; //   CHUNK
  };
}`}</Formula>
          <p className="mt-3 text-[12.5px] leading-relaxed text-dim">
            Kernel principle 1 said <em className="not-italic text-chalk">one node type: Preset</em>,
            and we took it literally. Selection, renaming, re-parenting, visibility, search,
            subtree cost roll-up and the breadcrumb are written <strong className="text-chalk">once</strong> and
            work identically whether you have selected a galaxy or the{" "}
            <code className="mono text-chalk">octaves</code> field of a noise node.
          </p>
          <p className="mt-2 text-[12.5px] leading-relaxed text-dim">
            The payload union is the only place the hierarchy is not uniform, and it exists solely
            so the viewport knows what to draw. Everything below CARTRIDGE in the live tree above
            is <strong className="text-chalk">real data</strong> — those are the actual TexNodes
            from <code className="mono text-chalk">@hm/setmix-library</code> that{" "}
            <code className="mono text-chalk">@hm/texgraph</code> will evaluate, and the CARTRIDGE
            viewport is evaluating them right now.
          </p>
        </Panel>

        <div className="space-y-3">
          <Panel label="NAVIGATION · pure reducers" accent="#3dc8ff">
            <Formula>{`zoomInto(s, id)   → path = ancestry(s, id)   // full path, any depth
escapeUp(s)       → path = path.slice(0, −1)
reparent(s,id,p)  → rejected if ancestry(p).includes(id)   // cycle guard
                  → rejected if depth(p) ≥ depth(id)       // no inversion
matches(s,id,q)   → self OR any descendant (so search keeps context)
subtreeCost(s,id) → { tris, ms, n } rolled up recursively`}</Formula>
            <p className="mt-2 text-[12px] leading-relaxed text-dim">
              <code className="mono text-chalk">zoomInto</code> rebuilds the whole path rather than
              pushing one entry, so you can jump from a Moon straight to a float via search and the
              breadcrumb is still correct and still clickable at every intermediate level.
            </p>
          </Panel>
          <Panel label="COMMANDS EMITTED" accent="#b46bff" flush>
            <div className="divide-y divide-line/60">
              {OUTLINER_COMMANDS.map(([t, p, d]) => (
                <div key={t} className="p-2.5">
                  <div className="mono flex flex-wrap items-baseline gap-2 text-[10px]">
                    <span className="font-bold text-flux">{t}</span>
                    <span className="text-dim">{p}</span>
                  </div>
                  <p className="mt-0.5 text-[10.5px] leading-snug text-dim">{d}</p>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>

      {/* tools */}
      <div className="mt-3">
        <Panel label="THE SIX TOOLS · slide-outs generated from VarDecl, like everything else" flush>
          <div className="grid gap-px bg-line sm:grid-cols-2 lg:grid-cols-3">
            {TOOLS.map((t) => (
              <div key={t.id} className="bg-panel p-3">
                <div className="flex items-center gap-2">
                  <span
                    className="flex h-7 w-7 items-center justify-center text-[15px]"
                    style={{ background: t.colour, color: "#04060a" }}
                  >
                    {t.glyph}
                  </span>
                  <div>
                    <div className="text-[13px] leading-tight font-black" style={{ color: t.colour }}>
                      {t.label}
                    </div>
                    <div className="mono text-[8.5px] text-dim">{t.command}</div>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {t.modes.map((m) => (
                    <Tag key={m.key} color={t.colour}>
                      {m.label}
                    </Tag>
                  ))}
                </div>
                <ul className="mt-2 space-y-1">
                  {t.modes.map((m) => (
                    <li key={m.key} className="text-[10.5px] leading-snug text-dim">
                      <span className="mono text-chalk">{m.label}</span> — {m.hint}
                    </li>
                  ))}
                </ul>
                <div className="mono mt-2 border-t border-line pt-1.5 text-[9px] text-dim">
                  {t.settings.length} variables ·{" "}
                  <span className="text-chalk">
                    {t.settings.filter((v) => v.tier === 1).length} play
                  </span>{" "}
                  /{" "}
                  <span className="text-chalk">
                    {t.settings.filter((v) => v.tier === 2).length} build
                  </span>{" "}
                  /{" "}
                  <span className="text-chalk">
                    {t.settings.filter((v) => v.tier === 3).length} pro
                  </span>
                </div>
                <div className="mono mt-1 text-[9px] text-dim/70">
                  scopes: {t.scopes.join(" · ")}
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <Panel label="TAB SWAPS THE HANDS" accent="#ffc13d">
          <p className="text-[12.5px] leading-relaxed text-dim">
            The hotbar is not a UI widget that happens to be near the character. It{" "}
            <strong className="text-chalk">is</strong> the character's hands:{" "}
            <code className="mono text-chalk">cycleHotbar</code> emits a command, the command
            changes the held Cartridge, and the avatar's grip pose, held mesh and the active tool's
            default mode all derive from that one value. Skipping empty slots is in the reducer,
            not the view.
          </p>
        </Panel>
        <Panel label="CONTEXTUAL BY SCOPE, NOT BY MENU" accent="#7cff4d">
          <p className="text-[12.5px] leading-relaxed text-dim">
            Each tool declares the scopes at which it is meaningful. Sculpt is live at MOON, BIOME
            and CHUNK; it greys out inside a CARTRIDGE, because there is no signed distance field
            in a texture DAG. The rail never hides a tool — hiding things teaches players that the
            UI is unreliable. It tells them why instead.
          </p>
        </Panel>
        <Panel label="THE BOTTOM OF THE DREAM" accent="#ff3d8a">
          <p className="text-[12.5px] leading-relaxed text-dim">
            Keep double-clicking and you will arrive at a single float: a value, a unit, a range,
            and a one-sentence explanation written by whoever authored the cartridge. That screen
            is the thesis of the entire game in one frame —{" "}
            <strong className="text-chalk">a planet is a number someone chose</strong>, and you can
            walk all the way down to it without ever leaving the lab.
          </p>
        </Panel>
      </div>
    </section>
  );
}
