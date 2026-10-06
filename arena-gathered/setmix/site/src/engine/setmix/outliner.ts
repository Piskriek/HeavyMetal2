/* ============================================================================
   @hm/setmix-outliner — THE INCEPTION HIERARCHY
   A preset inside a preset inside a preset, all the way down to one float.

   Galaxy ⟷ System ⟷ Moon ⟷ Biome ⟷ Chunk ⟷ Object ⟷ Cartridge ⟷ TexNode ⟷ Variable

   Every level is the SAME record type, because of kernel principle 1. The
   outliner does not special-case a moon versus a float; it renders a tree of
   Presets and lets the viewport decide how to draw the current scope.
   ========================================================================== */

import type { TexNode } from "@/engine/texgraph";
import type { Cartridge, VarDecl } from "./core";
import { LIBRARY } from "./library";

/* ────────────────────────────────────────────────────────────── scopes ── */

export const SCOPES = [
  "GALAXY",
  "SYSTEM",
  "MOON",
  "BIOME",
  "CHUNK",
  "OBJECT",
  "CARTRIDGE",
  "TEXNODE",
  "VARIABLE",
] as const;
export type ScopeKind = (typeof SCOPES)[number];

export const SCOPE_META: Record<
  ScopeKind,
  { depth: number; colour: string; glyph: string; unit: string; blurb: string }
> = {
  GALAXY: { depth: 0, colour: "#c9a6ff", glyph: "✦", unit: "worlds", blurb: "Every published moon in the Voxel Galaxy." },
  SYSTEM: { depth: 1, colour: "#8b9bb4", glyph: "◍", unit: "bodies", blurb: "One author's cluster of linked worlds." },
  MOON: { depth: 2, colour: "#e8eef7", glyph: "◉", unit: "km²", blurb: "A planet: four scalars and a cartridge graph." },
  BIOME: { depth: 3, colour: "#86c954", glyph: "❖", unit: "ha", blurb: "A softmax region governed by one or more spires." },
  CHUNK: { depth: 4, colour: "#7cff4d", glyph: "▦", unit: "m", blurb: "32³ voxels. The unit of meshing, streaming and wave state." },
  OBJECT: { depth: 5, colour: "#ffc13d", glyph: "⬢", unit: "—", blurb: "A machine, prop, creature or vehicle instance." },
  CARTRIDGE: { depth: 6, colour: "#b46bff", glyph: "▣", unit: "nodes", blurb: "A Preset: immutable revision, content hash, parents." },
  TEXNODE: { depth: 7, colour: "#3dc8ff", glyph: "◇", unit: "ms", blurb: "One node of the DAG @hm/texgraph will evaluate." },
  VARIABLE: { depth: 8, colour: "#ff3d8a", glyph: "·", unit: "—", blurb: "One float. The bottom of the dream." },
};

/* ───────────────────────────────────────────────────────────── records ── */

export interface OutlinerNode {
  id: string;
  kind: ScopeKind;
  name: string;
  parentId: string | null;
  childIds: string[];
  visible: boolean;
  locked: boolean;
  /** live cost readouts shown in the outliner columns */
  tris?: number;
  ms?: number;
  lod?: string;
  tint?: string;
  /** scope-specific payload the viewport knows how to draw */
  payload?: {
    cartridge?: Cartridge;
    texNode?: TexNode;
    variable?: VarDecl;
    value?: number;
    metrics?: { pxd: number; vtx: number; lx: number; aq: number };
    chunk?: { cx: number; cz: number; state: string; policy: string };
  };
}

export type ToolId = "POINTER" | "BRUSH" | "SCULPT" | "TIMELINE" | "SPEAKER" | "CHARACTER";

export interface ToolSpec {
  id: ToolId;
  glyph: string;
  label: string;
  colour: string;
  /** the scopes at which this tool is meaningful; others grey it out */
  scopes: ScopeKind[];
  /** contextual slide-out contents */
  modes: { key: string; label: string; hint: string }[];
  /** numeric settings, declared as Variables so the panel is generated */
  settings: VarDecl[];
  command: string;
}

export interface OutlinerState {
  nodes: Map<string, OutlinerNode>;
  rootId: string;
  /** zoom stack — the Inception path. Last element is the active scope. */
  path: string[];
  selectionId: string | null;
  expanded: Set<string>;
  search: string;
  tool: ToolId;
  toolMode: string;
  /** 8 hotbar slots; Tab cycles, the goblin's hands update */
  hotbar: (string | null)[];
  hotbarIndex: number;
  isolate: boolean;
}

/* ─────────────────────────────────────────────────────── tool catalogue ── */

const v = (
  path: string,
  label: string,
  real: string,
  unit: string,
  min: number,
  max: number,
  step: number,
  def: number,
  explain: string,
  tier: 1 | 2 | 3,
): VarDecl => ({ path, label, real, unit, min, max, step, def, explain, tier });

export const TOOLS: ToolSpec[] = [
  {
    id: "POINTER",
    glyph: "➤",
    label: "Pointer",
    colour: "#e8eef7",
    scopes: ["GALAXY", "SYSTEM", "MOON", "BIOME", "CHUNK", "OBJECT"],
    modes: [
      { key: "translate", label: "Translate", hint: "W · drag an axis handle; Shift snaps to the chunk grid" },
      { key: "rotate", label: "Rotate", hint: "E · arcball rings; Shift snaps to 15°" },
      { key: "scale", label: "Scale", hint: "R · uniform on the centre cube, per-axis on the arms" },
      { key: "pivot", label: "Set Pivot", hint: "D · re-origins the preset so children inherit cleanly" },
    ],
    settings: [
      v("pointer.snap", "Snap", "grid quantum", "m", 0, 8, 0.25, 1, "Positions round to this spacing while held.", 1),
      v("pointer.angle", "Angle Snap", "rotation quantum", "°", 0, 45, 1, 15, "Rotation rounds to this increment.", 2),
    ],
    command: "setmix/transform",
  },
  {
    id: "BRUSH",
    glyph: "✦",
    label: "Brush",
    colour: "#ff3d8a",
    scopes: ["MOON", "BIOME", "CHUNK", "OBJECT"],
    modes: [
      { key: "stamp", label: "Stamp", hint: "Paints the held cartridge's material weight into the surface blend." },
      { key: "ramp", label: "Ramp", hint: "Drag a gradient between two held cartridges — an ecotone by hand." },
      { key: "clone", label: "Clone", hint: "Alt-click a source, paint its exact blend elsewhere." },
      { key: "erase", label: "Erase", hint: "Restores the biome softmax underneath, never a hole." },
    ],
    settings: [
      v("brush.radius", "Radius", "brush radius", "m", 0.5, 64, 0.5, 8, "Footprint of the stamp on the surface.", 1),
      v("brush.falloff", "Softness", "falloff exponent", "—", 0, 1, 0.01, 0.6, "Hard edge at 0, feathered cloud at 1.", 1),
      v("brush.flow", "Flow", "weight per second", "%/s", 1, 100, 1, 35, "How fast the material weight accumulates.", 2),
      v("brush.jitter", "Scatter", "position jitter", "m", 0, 8, 0.1, 0, "Random offset per dab — breaks obvious strokes.", 3),
    ],
    command: "setmix/paintSurface",
  },
  {
    id: "SCULPT",
    glyph: "◓",
    label: "Sculpt",
    colour: "#7cff4d",
    scopes: ["MOON", "BIOME", "CHUNK"],
    modes: [
      { key: "add", label: "Additive", hint: "Raises the SDF. Re-meshes only the touched chunks' band." },
      { key: "sub", label: "Subtractive", hint: "Carves. Caves are free — it is a real SDF, not a heightmap." },
      { key: "smooth", label: "Smooth", hint: "Laplacian relax; respects the chunk's smoothAngle so features survive." },
      { key: "pinch", label: "Pinch", hint: "Pulls vertices toward the QEF feature line — makes ridges crisp." },
      { key: "flatten", label: "Flatten", hint: "Projects onto the plane under the cursor. Building sites." },
    ],
    settings: [
      v("sculpt.radius", "Radius", "brush radius", "m", 0.5, 48, 0.5, 6, "Sphere of influence on the signed distance field.", 1),
      v("sculpt.strength", "Strength", "SDF delta per second", "m/s", 0.1, 12, 0.1, 3, "How fast the surface moves while held.", 1),
      v("sculpt.preserve", "Keep Features", "sharp feature threshold", "°", 0, 180, 1, 62, "Edges sharper than this survive the smooth pass.", 2),
      v("sculpt.lodLock", "LOD Lock", "forced lod", "level", 0, 5, 1, 0, "Pins the touched chunks to this LOD while sculpting.", 3),
    ],
    command: "setmix/sculptSdf",
  },
  {
    id: "TIMELINE",
    glyph: "⏱",
    label: "Timeline",
    colour: "#ffc13d",
    scopes: ["MOON", "BIOME", "OBJECT", "CARTRIDGE"],
    modes: [
      { key: "key", label: "Keyframe", hint: "Writes the selected Variable's value at the playhead tick." },
      { key: "curve", label: "Curve", hint: "Bezier editor. The same curve type the geomorph uses." },
      { key: "impulse", label: "Impulse", hint: "Physics kick: the Kinematic Spring Rig's whole payload." },
      { key: "loop", label: "Loop", hint: "Marks a cycle; the sim replays it deterministically at 120 Hz." },
    ],
    settings: [
      v("timeline.tick", "Playhead", "sim tick", "tick", 0, 14400, 1, 0, "Position in the 120 Hz journal.", 1),
      v("timeline.rate", "Rate", "playback multiplier", "×", 0.1, 8, 0.1, 1, "Scrub speed; the sim stays fixed-step underneath.", 2),
      v("timeline.ease", "Ease", "bezier tension", "—", 0, 1, 0.01, 0.4, "Flat at 0, snappy at 1.", 2),
    ],
    command: "setmix/keyVariable",
  },
  {
    id: "SPEAKER",
    glyph: "◈",
    label: "Speaker",
    colour: "#3dc8ff",
    scopes: ["MOON", "BIOME", "CHUNK", "OBJECT", "CARTRIDGE"],
    modes: [
      { key: "foley", label: "Foley", hint: "Per-material footstep and impact banks, inherited by anything wearing the material." },
      { key: "ambience", label: "Ambience", hint: "Biome bed assembled from the same cartridges that built the biome." },
      { key: "synth", label: "Procedural", hint: "Geometry-driven: the Organ Canyon reads pipe length as pitch." },
      { key: "mix", label: "Mix", hint: "Bus levels, occlusion curve, reverb from chunk occupancy." },
    ],
    settings: [
      v("audio.gain", "Level", "bus gain", "dB", -60, 12, 0.5, 0, "Output level for this emitter.", 1),
      v("audio.radius", "Falloff", "attenuation radius", "m", 1, 400, 1, 40, "Distance at which the source becomes inaudible.", 1),
      v("audio.pitch", "Pitch", "base frequency", "Hz", 20, 2000, 1, 110, "Fundamental for procedural sources.", 2),
      v("audio.occl", "Occlusion", "low-pass per wall", "—", 0, 1, 0.01, 0.55, "How much terrain between you and it muffles it.", 3),
    ],
    command: "setmix/authorAudio",
  },
  {
    id: "CHARACTER",
    glyph: "☻",
    label: "Character",
    colour: "#b46bff",
    scopes: ["GALAXY", "SYSTEM", "MOON", "BIOME", "CHUNK", "OBJECT", "CARTRIDGE"],
    modes: [
      { key: "rig", label: "Rig", hint: "Skeleton, IK chains, sockets. Six sockets makes any mesh rideable." },
      { key: "suit", label: "Suit Layers", hint: "Base · wear · mud accumulation · emissive trim. Each is a cartridge." },
      { key: "hands", label: "Held Preset", hint: "What the goblin is carrying. Tab cycles the hotbar." },
      { key: "fidelity", label: "Avatar Fidelity", hint: "48 tri at S1 → 48k at S6. Same rig, different budget." },
    ],
    settings: [
      v("avatar.height", "Height", "root scale", "m", 0.8, 2.4, 0.01, 1.35, "Goblin stature; affects step height and reach.", 1),
      v("avatar.triBudget", "Tri Budget", "triangle budget", "tris", 48, 48000, 1, 2800, "Clamped by the device profile, never by the stage.", 2),
      v("avatar.wear", "Wear", "patina rule weight", "—", 0, 1, 0.01, 0.3, "How much history the suit has accumulated.", 1),
    ],
    command: "setmix/editAvatar",
  },
];

export const TOOL_BY_ID = new Map(TOOLS.map((t) => [t.id, t]));

/* ──────────────────────────────────────────────── tree construction ───── */

let uid = 0;
const nid = (p: string) => `${p}_${(uid++).toString(36)}`;

function mk(
  nodes: Map<string, OutlinerNode>,
  parent: OutlinerNode | null,
  kind: ScopeKind,
  name: string,
  extra: Partial<OutlinerNode> = {},
): OutlinerNode {
  const n: OutlinerNode = {
    id: nid(kind.toLowerCase()),
    kind,
    name,
    parentId: parent?.id ?? null,
    childIds: [],
    visible: true,
    locked: false,
    tint: SCOPE_META[kind].colour,
    ...extra,
  };
  nodes.set(n.id, n);
  parent?.childIds.push(n.id);
  return n;
}

/** Builds a representative live scene. Cartridges are the REAL library
 *  records, and TexNodes are their REAL DAG nodes — the bottom of the
 *  hierarchy is not a mock-up, it is the data @hm/texgraph will evaluate. */
export function buildScene(): OutlinerState {
  uid = 0;
  const nodes = new Map<string, OutlinerNode>();
  const galaxy = mk(nodes, null, "GALAXY", "Voxel Galaxy", { tris: 0, ms: 0 });

  const sys = mk(nodes, galaxy, "SYSTEM", "Piskriek Cluster", { lod: "—" });
  mk(nodes, galaxy, "SYSTEM", "@dr.vex Archive", { lod: "—" });

  const moon = mk(nodes, sys, "MOON", "Kepler-7b", {
    tris: 1_800_000,
    ms: 14.2,
    lod: "L0",
    payload: { metrics: { pxd: 6.24e7, vtx: 4.1e7, lx: 2.87e7, aq: 9.14e6 } },
  });
  mk(nodes, sys, "MOON", "Scratch Moon 04", { tris: 240_000, ms: 3.1, lod: "L2" });

  const biomes: { name: string; carts: string[]; tint: string }[] = [
    { name: "North Prairie", carts: ["grass_handpainted", "curl_flow", "altitude_mask"], tint: "#86c954" },
    { name: "Organ Canyon", carts: ["columnar_basalt", "wind_erosion"], tint: "#7d7fa8" },
    { name: "Mirror Lagoon", carts: ["caustic_water", "mud_clay"], tint: "#3dc8ff" },
    { name: "Oxide Flats", carts: ["rust_oxide", "curvature_wear", "linear_strata"], tint: "#a35c35" },
  ];

  for (const b of biomes) {
    const bn = mk(nodes, moon, "BIOME", b.name, {
      tint: b.tint,
      tris: 410_000,
      ms: 2.1,
      lod: "L0",
    });

    for (let c = 0; c < 2; c++) {
      const cx = 12 + c * 3,
        cz = 7 - c;
      const chunk = mk(nodes, bn, "CHUNK", `chunk_${cx}_${cz}`, {
        tris: 18_400,
        ms: 0.42,
        lod: c === 0 ? "L0" : "L1",
        payload: {
          chunk: {
            cx,
            cz,
            state: c === 0 ? "INSIDE_BAND" : "STABILIZED",
            policy: c === 0 ? "DUAL · 1 m" : "DUAL · 2 m",
          },
        },
      });

      if (c === 0) {
        const spire = mk(nodes, chunk, "OBJECT", "Template Injector 04", {
          tint: "#b46bff",
          tris: 18_000,
          ms: 0.22,
        });
        for (const cid of b.carts) {
          const cart = LIBRARY.find((x) => x.id === cid);
          if (!cart) continue;
          const cn = mk(nodes, spire, "CARTRIDGE", cart.name, {
            tint: cart.tint,
            ms: 0.12,
            payload: { cartridge: cart },
          });
          for (const tn of cart.graph.nodes) {
            const tnn = mk(nodes, cn, "TEXNODE", `${tn.id} · ${tn.type}`, {
              tint: "#3dc8ff",
              payload: { texNode: tn },
            });
            for (const [k, val] of Object.entries(tn)) {
              if (k === "id" || k === "type" || typeof val !== "number") continue;
              const decl = cart.vars.find((vv) => vv.path === `${tn.id}.${k}`);
              mk(nodes, tnn, "VARIABLE", `${k}`, {
                tint: "#ff3d8a",
                payload: {
                  value: val,
                  variable:
                    decl ??
                    v(`${tn.id}.${k}`, k, k, "—", 0, Math.max(1, val * 2), 0.01, val, "Raw graph parameter — exposed only at PRO depth.", 3),
                },
              });
            }
          }
        }
      } else {
        mk(nodes, chunk, "OBJECT", "Coherence Beacon", { tint: "#e8eef7", tris: 900, ms: 0.03 });
      }
    }
  }

  const avatar = mk(nodes, moon, "OBJECT", "Goblin_Astronaut", {
    tint: "#ff6fb2",
    tris: 48_000,
    ms: 0.9,
    lod: "L0",
  });
  const suit = LIBRARY.find((x) => x.id === "rust_oxide")!;
  mk(nodes, avatar, "CARTRIDGE", "suit_T3_worn", {
    tint: "#ff6fb2",
    ms: 0.3,
    payload: { cartridge: suit },
  });

  return {
    nodes,
    rootId: galaxy.id,
    path: [galaxy.id, sys.id, moon.id],
    selectionId: moon.id,
    expanded: new Set([galaxy.id, sys.id, moon.id, ...moon.childIds.slice(0, 2)]),
    search: "",
    tool: "POINTER",
    toolMode: "translate",
    hotbar: ["grass_handpainted", "columnar_basalt", "caustic_water", null, null, null, null, null],
    hotbarIndex: 0,
    isolate: false,
  };
}

/* ────────────────────────────────── navigation (pure reducers) ────────── */

export function ancestry(s: OutlinerState, id: string): string[] {
  const out: string[] = [];
  let cur: string | null = id;
  let guard = 0;
  while (cur && guard++ < 64) {
    out.unshift(cur);
    cur = s.nodes.get(cur)?.parentId ?? null;
  }
  return out;
}

/** Double-click → descend. The path becomes the full ancestry of the target,
 *  so you can zoom from a Moon straight into a float and the breadcrumb is
 *  still correct. */
export function zoomInto(s: OutlinerState, id: string): OutlinerState {
  const n = s.nodes.get(id);
  if (!n) return s;
  const expanded = new Set(s.expanded);
  for (const a of ancestry(s, id)) expanded.add(a);
  return { ...s, path: ancestry(s, id), selectionId: id, expanded };
}

/** Esc → ascend exactly one level. Never leaves the Galaxy. */
export function escapeUp(s: OutlinerState): OutlinerState {
  if (s.path.length <= 1) return s;
  const path = s.path.slice(0, -1);
  return { ...s, path, selectionId: path[path.length - 1] };
}

export function activeScope(s: OutlinerState): OutlinerNode | undefined {
  return s.nodes.get(s.path[s.path.length - 1]);
}

export function select(s: OutlinerState, id: string): OutlinerState {
  return { ...s, selectionId: id };
}

export function toggleExpand(s: OutlinerState, id: string): OutlinerState {
  const expanded = new Set(s.expanded);
  expanded.has(id) ? expanded.delete(id) : expanded.add(id);
  return { ...s, expanded };
}

export function rename(s: OutlinerState, id: string, name: string): OutlinerState {
  const n = s.nodes.get(id);
  if (!n) return s;
  const nodes = new Map(s.nodes);
  nodes.set(id, { ...n, name });
  return { ...s, nodes };
}

/** Re-parent with a cycle guard. Returns the state unchanged if the move
 *  would make a node its own ancestor — the kernel would reject the command
 *  anyway, but failing here keeps the UI honest. */
export function reparent(s: OutlinerState, id: string, newParentId: string): OutlinerState {
  if (id === newParentId) return s;
  if (ancestry(s, newParentId).includes(id)) return s;
  const n = s.nodes.get(id),
    np = s.nodes.get(newParentId);
  if (!n || !np) return s;
  if (SCOPE_META[np.kind].depth >= SCOPE_META[n.kind].depth) return s; // no inversion

  const nodes = new Map(s.nodes);
  if (n.parentId) {
    const op = nodes.get(n.parentId)!;
    nodes.set(op.id, { ...op, childIds: op.childIds.filter((c) => c !== id) });
  }
  nodes.set(np.id, { ...np, childIds: [...np.childIds, id] });
  nodes.set(id, { ...n, parentId: newParentId });
  return { ...s, nodes };
}

export function setVisible(s: OutlinerState, id: string, visible: boolean): OutlinerState {
  const n = s.nodes.get(id);
  if (!n) return s;
  const nodes = new Map(s.nodes);
  nodes.set(id, { ...n, visible });
  return { ...s, nodes };
}

/** Tab → cycle the hotbar, which swaps what the goblin is holding. */
export function cycleHotbar(s: OutlinerState, dir = 1): OutlinerState {
  const n = s.hotbar.length;
  let i = s.hotbarIndex;
  for (let k = 0; k < n; k++) {
    i = (i + dir + n) % n;
    if (s.hotbar[i]) break;
  }
  return { ...s, hotbarIndex: i };
}

export function setTool(s: OutlinerState, tool: ToolId): OutlinerState {
  const spec = TOOL_BY_ID.get(tool)!;
  return { ...s, tool, toolMode: spec.modes[0].key };
}

/** Filter that keeps a node if it matches OR any descendant matches. */
export function matches(s: OutlinerState, id: string, q: string): boolean {
  if (!q) return true;
  const n = s.nodes.get(id);
  if (!n) return false;
  if (n.name.toLowerCase().includes(q.toLowerCase())) return true;
  if (n.kind.toLowerCase().includes(q.toLowerCase())) return true;
  return n.childIds.some((c) => matches(s, c, q));
}

export function subtreeCost(s: OutlinerState, id: string): { tris: number; ms: number; n: number } {
  const n = s.nodes.get(id);
  if (!n) return { tris: 0, ms: 0, n: 0 };
  let tris = n.tris ?? 0,
    ms = n.ms ?? 0,
    count = 1;
  for (const c of n.childIds) {
    const r = subtreeCost(s, c);
    tris += r.tris;
    ms += r.ms;
    count += r.n;
  }
  return { tris, ms, n: count };
}

/* ─────────────────────────────────────── commands emitted by the UI ───── */

export const OUTLINER_COMMANDS = [
  ["setmix/zoomScope", "{ nodeId }", "Pure navigation — journalled so replays reproduce camera intent."],
  ["setmix/renameNode", "{ nodeId, name }", "Undo restores the previous string."],
  ["setmix/reparentNode", "{ nodeId, parentId }", "Rejected by the kernel if it would create a cycle."],
  ["setmix/setVisible", "{ nodeId, visible }", "View-only; never affects the sim."],
  ["setmix/selectTool", "{ tool, mode }", "Swaps the slide-out and the goblin's grip pose."],
  ["setmix/cycleHotbar", "{ dir }", "Tab. Updates the held preset and the hands mesh."],
  ["setmix/promoteToPreset", "{ nodeIds[] }", "Snapshots a selection into a new Cartridge revision."],
] as const;
