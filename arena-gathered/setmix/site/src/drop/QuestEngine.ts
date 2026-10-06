/* ============================================================================
 *  packages/quest/src/QuestEngine.ts
 *  ---------------------------------------------------------------------------
 *  THE FIRST THIRTY MINUTES, AS A PURE REDUCER.
 *
 *  Design rules this file enforces, because an onboarding that breaks them
 *  is the reason players quit in the first ten minutes:
 *
 *    1. NO QUEST MARKER BEFORE A NUDGE.  Every objective gets ~45 s of silent
 *       discovery time; only then does a diegetic hint fire. The player should
 *       believe they found it.
 *    2. NOTHING IS EVER BLOCKED BY A TUTORIAL.  Objectives observe the world;
 *       they never gate it. Walk through the portal at second three if you
 *       like — Act 1 simply completes early.
 *    3. EVERY REWARD IS VISIBLE WITHIN 6 SECONDS.  No objective completes into
 *       a number. It completes into a plume, a chord, a colour, or a wave.
 *    4. THE BEAT AT ~MINUTE 33 IS THE PRODUCT.  Everything is paced so the
 *       first fidelity tick lands there, and it is allowed to stop the world.
 *
 *  Pure. 120 Hz. No clock, no RNG, no I/O.
 * ==========================================================================*/

import type { FidelityState } from "./contracts.setmix";
import { fidelityIndex, stageOf } from "./fidelity";

export const TICK_HZ = 120;

/* ───────────────────────────────────────────────────── player telemetry ── */

export type PlayerEvent =
  | { t: "TICK" }
  | { t: "ENTERED_WORLD"; world: "LAB" | "MOON" }
  | { t: "HAND_THROUGH_PORTAL" }
  | { t: "MINED"; resource: ResourceKind; amount: number }
  | { t: "PLACED_MACHINE"; kind: string; id: string }
  | { t: "WIRED"; from: string; to: string }
  | { t: "SLOTTED_CARTRIDGE"; machineId: string; cartridgeId: string }
  | { t: "WAVE_DISPATCHED"; sourceId: string }
  | { t: "FUSED"; childId: string; a: string; b: string }
  | { t: "STAGE_CHANGED"; stage: number }
  | { t: "COHERENCE_LOW"; value: number }
  | { t: "DECOHERED" }
  | { t: "INTERACTED"; target: string }
  | { t: "JUMPED" };

export type ResourceKind =
  | "CHROMATIC_CRYSTAL" | "TOPOLOGY_SHARD" | "PHOTON_SALT"
  | "ICE_CLATHRATE" | "LOGIC_SUBSTRATE" | "ENTROPY_SLAG";

export const RESOURCE_META: Readonly<Record<ResourceKind, { label: string; colour: string; feeds: string }>> =
  Object.freeze({
    CHROMATIC_CRYSTAL: { label: "Chromatic Crystal", colour: "#ff3d8a", feeds: "Pxd" },
    TOPOLOGY_SHARD:    { label: "Topology Shard",    colour: "#7cff4d", feeds: "Vtx" },
    PHOTON_SALT:       { label: "Photon Salt",       colour: "#ffc13d", feeds: "Lx"  },
    ICE_CLATHRATE:     { label: "Ice Clathrate",     colour: "#3dc8ff", feeds: "Aq"  },
    LOGIC_SUBSTRATE:   { label: "Logic Substrate",   colour: "#b46bff", feeds: "Tech" },
    ENTROPY_SLAG:      { label: "Entropy Slag",      colour: "#6b7a90", feeds: "Waste" },
  });

/* ─────────────────────────────────────────────────────────── structure ── */

export type ActId = "ACT1" | "ACT2" | "ACT3" | "ACT4" | "EPILOGUE";

export interface Objective {
  id: string;
  act: ActId;
  /** what the player is told, in the fiction's voice */
  text: string;
  /** what the designer is actually measuring */
  intent: string;
  /** fires only after `nudgeAfterSec` of no progress — never before */
  nudge: string;
  nudgeAfterSec: number;
  /** 0..1 */
  progress: number;
  need: number;
  have: number;
  done: boolean;
  optional?: boolean;
  /** diegetic payoff, shown on completion */
  reward: string;
}

export interface QuestNotification {
  id: string;
  kind: "OBJECTIVE" | "UNLOCK" | "HINT" | "BEAT" | "WARNING";
  title: string;
  body: string;
  /** sim tick it was raised */
  at: number;
  colour: string;
  /** stops the world for this many seconds (the Act-3 chord) */
  holdSeconds?: number;
}

export interface QuestState {
  tick: number;
  act: ActId;
  objectives: Objective[];
  completed: string[];
  notifications: QuestNotification[];
  unlockedMachines: string[];
  unlockedConsoles: string[];
  inventory: Record<ResourceKind, number>;
  /** per-objective tick at which it became active, for nudge timing */
  activatedAt: Record<string, number>;
  flags: {
    handThroughPortal: boolean;
    everCrossed: boolean;
    world: "LAB" | "MOON";
    crossings: number;
    firstWaveSeen: boolean;
    firstFusion: boolean;
    sawDecoherence: boolean;
    labPowerTier: 0 | 1 | 2 | 3;
    jumped: boolean;
  };
  /** the headline KPI: tick at which the Act-3 beat landed */
  beatTick: number | null;
}

/* ─────────────────────────────────────────────── the authored content ── */

const OBJ = (
  id: string, act: ActId, text: string, intent: string, nudge: string,
  nudgeAfterSec: number, need: number, reward: string, optional = false,
): Objective => ({
  id, act, text, intent, nudge, nudgeAfterSec,
  progress: 0, need, have: 0, done: false, optional, reward,
});

export const SCRIPT: Objective[] = [
  /* ── ACT 1 · THE WAKING AUTHOR ─────────────────────────────────────── */
  OBJ("a1_look", "ACT1",
    "Orient yourself.",
    "Let them register 'this is a gorgeous modern game' before the moon betrays it. No UI until 00:40.",
    "A containment alarm is sounding somewhere behind you.",
    22, 1,
    "The room resolves: brushed aluminium, frosted glass, one soft area light."),
  OBJ("a1_reach", "ACT1",
    "Put your hand through the archway.",
    "THE most important interaction in the slice. 85% of testers must do this unprompted or we add a nudge.",
    "Your glove flickers when it nears the aperture. Reach further.",
    38, 1,
    "Your hand de-resolves mid-air at the boundary. The thesis, without a word of dialogue.",
    true),
  OBJ("a1_cross", "ACT1",
    "Step through the threshold.",
    "Commitment. The dissolve completes slightly AFTER they commit, so they watch their new hands arrive.",
    "The arch is stable. Whatever is on the other side, it is not coming to you.",
    55, 1,
    "0.4 s shader dissolve down the body. The audio bus drops to 8 kHz. You look down: 48-triangle hands."),

  /* ── ACT 2 · FIRST CONTACT ─────────────────────────────────────────── */
  OBJ("a2_jump", "ACT2",
    "Test the gravity.",
    "Teach 1.62 m/s² by surprising them with it. Time-to-first-jump should be under 12 s. Everyone jumps.",
    "You weigh a sixth of what you did a moment ago.",
    16, 1,
    "A comically floaty arc. Nobody does this once.",
    true),
  OBJ("a2_crystal", "ACT2",
    "Harvest 8 Chromatic Crystals.",
    "Colour as treasure. On a 4-colour moon a fifth hue is the most valuable object in the world — no marker needed.",
    "The only saturated colour on this moon is in the crater wall to your west.",
    45, 8,
    "◆ 4 → ◆ 8. Cubic voxel motes arc into your pack with a 4-bit chime."),
  OBJ("a2_shard", "ACT2",
    "Harvest 4 Topology Shards.",
    "Introduce the second metric before the first machine, so the trade-off in Act 3 is already legible.",
    "Fracture ridges carry latent vertex budget. Look for the broken rims.",
    45, 4,
    "Smashing one releases a puff of tiny triangles that briefly bevel the terrain nearby."),
  OBJ("a2_coherence", "ACT2",
    "Survive the dithering.",
    "Survival rule learned by sensation, not tooltip. First scare between minute 12 and 16 for 70% of players.",
    "Your hands are losing triangles. The portal is the warm rectangle on the horizon.",
    0, 1,
    "Sprinting back restores you. The portal is now, permanently, home.",
    true),

  /* ── ACT 3 · THE FIRST RESOLUTION WAVE ─────────────────────────────── */
  OBJ("a3_place", "ACT3",
    "Place the Pixel Chimney.",
    "Build-to-plume must be under 6 s. The first machine produces a PLUME, not a number.",
    "The blueprint is in your deck. Any flat ground will hold it.",
    40, 1,
    "Three seconds of assembly, obviously low-poly sparks, and a thumbs-up from your goblin."),
  OBJ("a3_wire", "ACT3",
    "Wire it to the starter solar cell.",
    "Teach the grid before it can fail. One wire, one island, zero ambiguity.",
    "The chimney is dark. Something has to be feeding it.",
    35, 1,
    "The island lights. Clock satisfaction 100%."),
  OBJ("a3_slot", "ACT3",
    "Slot the Moon Regolith cartridge.",
    "Close the loop: the preset is a physical object that goes into a physical machine.",
    "The auxiliary port on the chimney is empty.",
    35, 1,
    "A clunk. The plume changes colour to the cartridge's dominant hue."),
  OBJ("a3_wave", "ACT3",
    "Watch what you made.",
    "THE BEAT. Must land between minute 30 and 36. If it slips past 40 we recut the economy, not the moment.",
    "",
    0, 1,
    "Fi crosses 1,200. Everything stops for 2.5 seconds. A chord. The palette widens 4 → 16 in a dither sweep that washes outward from your chimney across the entire visible moon, and a thin indigo band ignites along the horizon."),

  /* ── ACT 4 · LAB RETURN & FIRST FUSION ─────────────────────────────── */
  OBJ("a4_return", "ACT4",
    "Carry it home.",
    "Round trip must stay under 70 s. If the walk feels long now it will feel fatal at hour 20.",
    "The lab has drawn power from somewhere. Something in there is awake.",
    40, 1,
    "Lab power restores to Tier 1. The Synthesizer and the Fusion Matrix come up."),
  OBJ("a4_fuse", "ACT4",
    "Fuse Mud + Linear Strata.",
    "First act of authorship. Time-to-first-saved-preset under 3 minutes from console activation.",
    "Two cartridges, one lever. The Matrix will show you the child before you spend the parents.",
    70, 1,
    "[Carved Cobblestone Road]. A material plus a direction equals architecture."),
  OBJ("a4_road", "ACT4",
    "Slot the road into the spire.",
    "Final shot of the slice. They made that. It is on a planet. It will still be there in 40 hours.",
    "The moon does not have roads yet. That is a decision you are allowed to make.",
    60, 1,
    "A 40 m Bloom front adopts YOUR material. Movement speed +28% along it."),
];

/* ───────────────────────────────────────────────── act gating & unlocks ── */

const ACT_ORDER: ActId[] = ["ACT1", "ACT2", "ACT3", "ACT4", "EPILOGUE"];

const ACT_UNLOCKS: Record<ActId, { machines: string[]; consoles: string[]; power: 0 | 1 | 2 | 3 }> = {
  ACT1: { machines: [], consoles: ["BENCH"], power: 0 },
  ACT2: { machines: ["COHERENCE_BEACON"], consoles: ["BENCH"], power: 0 },
  ACT3: { machines: ["PIXEL_CHIMNEY", "SOLAR_COLLECTOR", "COHERENCE_BEACON"], consoles: ["BENCH"], power: 0 },
  ACT4: {
    machines: ["PIXEL_CHIMNEY", "SOLAR_COLLECTOR", "COHERENCE_BEACON", "HARMONIC_VIBRATOR", "TEMPLATE_INJECTOR"],
    consoles: ["BENCH", "SYNTHESIZER", "FUSION_MATRIX"], power: 1,
  },
  EPILOGUE: {
    machines: ["PIXEL_CHIMNEY", "SOLAR_COLLECTOR", "COHERENCE_BEACON", "HARMONIC_VIBRATOR",
               "TEMPLATE_INJECTOR", "LUMEN_MAST", "RELAY_PYLON"],
    consoles: ["BENCH", "SYNTHESIZER", "FUSION_MATRIX", "PLANET_TABLE"], power: 2,
  },
};

export const ACT_META: Record<ActId, { n: string; title: string; window: string; colour: string }> = {
  ACT1: { n: "I", title: "The Waking Author", window: "00:00 – 00:05", colour: "#e8eef7" },
  ACT2: { n: "II", title: "First Contact", window: "00:05 – 00:19", colour: "#ff3d8a" },
  ACT3: { n: "III", title: "The First Resolution Wave", window: "00:19 – 00:36", colour: "#7cff4d" },
  ACT4: { n: "IV", title: "Lab Return & First Fusion", window: "00:36 – 00:58", colour: "#b46bff" },
  EPILOGUE: { n: "V", title: "The Hook Out", window: "00:58 +", colour: "#3dc8ff" },
};

/* ═══════════════════════════════════════════════════════════ REDUCER ══ */

export function initialQuest(): QuestState {
  return {
    tick: 0,
    act: "ACT1",
    objectives: SCRIPT.map((o) => ({ ...o })),
    completed: [],
    notifications: [],
    unlockedMachines: [],
    unlockedConsoles: ["BENCH"],
    inventory: {
      CHROMATIC_CRYSTAL: 0, TOPOLOGY_SHARD: 0, PHOTON_SALT: 0,
      ICE_CLATHRATE: 0, LOGIC_SUBSTRATE: 0, ENTROPY_SLAG: 0,
    },
    activatedAt: { a1_look: 0, a1_reach: 0, a1_cross: 0 },
    flags: {
      handThroughPortal: false, everCrossed: false, world: "LAB", crossings: 0,
      firstWaveSeen: false, firstFusion: false, sawDecoherence: false,
      labPowerTier: 0, jumped: false,
    },
    beatTick: null,
  };
}

export interface StepQuestResult {
  nextState: QuestState;
  activeQuests: Objective[];
  notifications: QuestNotification[];
  unlockedMachines: string[];
}

/**
 *  One call per tick (or per batch). Returns the new state plus the
 *  *newly raised* notifications only, so the caller can queue toasts without
 *  diffing anything.
 */
export function stepQuest(
  state: QuestState,
  events: readonly PlayerEvent[],
  fi: FidelityState,
  ticks = 1,
): StepQuestResult {
  const tick = state.tick + ticks;
  const objectives = state.objectives.map((o) => ({ ...o }));
  const inventory = { ...state.inventory };
  const flags = { ...state.flags };
  const activatedAt = { ...state.activatedAt };
  const completed = [...state.completed];
  const fresh: QuestNotification[] = [];
  let act = state.act;
  let beatTick = state.beatTick;

  const find = (id: string) => objectives.find((o) => o.id === id);
  const bump = (id: string, n = 1) => {
    const o = find(id);
    if (!o || o.done) return;
    o.have = Math.min(o.need, o.have + n);
    o.progress = o.have / o.need;
  };
  const note = (
    kind: QuestNotification["kind"], title: string, body: string,
    colour: string, holdSeconds?: number,
  ) => fresh.push({ id: `${kind}_${tick}_${fresh.length}`, kind, title, body, at: tick, colour, holdSeconds });

  /* ── ingest events ─────────────────────────────────────────────── */
  for (const e of events) {
    switch (e.t) {
      case "HAND_THROUGH_PORTAL":
        if (!flags.handThroughPortal) {
          flags.handThroughPortal = true;
          bump("a1_reach");
          bump("a1_look");
          note("BEAT", "THE THESIS",
            "Your glove de-resolves at the plane. Two renderers, one hand.", "#b46bff");
        }
        break;

      case "ENTERED_WORLD": {
        const was = flags.world;
        flags.world = e.world;
        if (was !== e.world) {
          flags.crossings++;
          if (e.world === "MOON") {
            bump("a1_look");
            bump("a1_cross");
            if (!flags.everCrossed) {
              flags.everCrossed = true;
              note("BEAT", "THE GOBLIN SHIFT",
                "48-triangle hands. 8 kHz mono. Gravity 1.62 m/s². You are data now, and data is cheap out here.",
                "#ff3d8a", 1.2);
            }
          } else if (flags.everCrossed) {
            bump("a4_return");
          }
        }
        break;
      }

      case "MINED":
        inventory[e.resource] = (inventory[e.resource] ?? 0) + e.amount;
        if (e.resource === "CHROMATIC_CRYSTAL") bump("a2_crystal", e.amount);
        if (e.resource === "TOPOLOGY_SHARD") bump("a2_shard", e.amount);
        break;

      case "JUMPED":
        if (!flags.jumped && flags.world === "MOON") { flags.jumped = true; bump("a2_jump"); }
        break;

      case "PLACED_MACHINE":
        if (e.kind === "PIXEL_CHIMNEY") bump("a3_place");
        break;

      case "WIRED":
        bump("a3_wire");
        break;

      case "SLOTTED_CARTRIDGE":
        if (!find("a3_slot")?.done) bump("a3_slot");
        else bump("a4_road");
        break;

      case "WAVE_DISPATCHED":
        if (!flags.firstWaveSeen) {
          flags.firstWaveSeen = true;
          bump("a3_wave");
        }
        break;

      case "FUSED":
        if (!flags.firstFusion) { flags.firstFusion = true; bump("a4_fuse"); }
        break;

      case "COHERENCE_LOW":
        if (!flags.sawDecoherence && e.value < 0.55) {
          flags.sawDecoherence = true;
          bump("a2_coherence");
          note("WARNING", "UNDERSAMPLED",
            "Your hands are losing triangles. Get back inside a render host.", "#ff3d8a");
        }
        break;

      case "DECOHERED":
        note("WARNING", "DECOHERED",
          "You dissolved. Your ore is a Crash Dump beacon, visible from 600 m. Only a walk.", "#ff3d8a");
        break;

      case "INTERACTED":
        if (e.target === "FUSION_MATRIX" && act === "ACT4") bump("a1_look");
        break;
    }
  }

  /* ── passive completion checks ─────────────────────────────────── */
  if (tick > 6 * TICK_HZ) bump("a1_look");
  if (fidelityIndex(fi) >= 1200 && !find("a3_wave")?.done) bump("a3_wave");

  /* ── resolve completions ───────────────────────────────────────── */
  for (const o of objectives) {
    if (o.done || o.have < o.need) continue;
    o.done = true;
    o.progress = 1;
    completed.push(o.id);

    const isBeat = o.id === "a3_wave";
    if (isBeat) {
      beatTick = tick;
      note("BEAT", "FIDELITY INDEX 1,200", o.reward, "#7cff4d", 2.5);
    } else {
      note("OBJECTIVE", o.text.replace(/\.$/, ""), o.reward,
        ACT_META[o.act].colour);
    }
  }

  /* ── act advancement: all non-optional objectives of the act done ── */
  const actDone = (a: ActId) =>
    objectives.filter((o) => o.act === a && !o.optional).every((o) => o.done);
  while (act !== "EPILOGUE" && actDone(act)) {
    const nextAct = ACT_ORDER[ACT_ORDER.indexOf(act) + 1];
    act = nextAct;
    const unlock = ACT_UNLOCKS[act];
    flags.labPowerTier = unlock.power;
    const newMachines = unlock.machines.filter((m) => !state.unlockedMachines.includes(m));
    if (newMachines.length)
      note("UNLOCK", `${ACT_META[act].title}`,
        `Blueprints online: ${newMachines.join(" · ")}`, ACT_META[act].colour);
    if (act === "ACT4")
      note("UNLOCK", "LAB POWER — TIER 1",
        "The Material Synthesizer and the Fusion Matrix come up. The white room is yours again.",
        "#b46bff");
    if (act === "EPILOGUE")
      note("BEAT", "SETMIX",
        "A Noise Storm pings your wrist: six minutes out, north-west, rendered on the horizon as a wall of writhing static.",
        "#3dc8ff", 2.0);
    // activate the new act's objectives for nudge timing
    for (const o of objectives) if (o.act === act && !(o.id in activatedAt)) activatedAt[o.id] = tick;
  }

  /* ── nudges: only after the silent-discovery window ────────────── */
  for (const o of objectives) {
    if (o.done || o.act !== act || !o.nudge) continue;
    if (!(o.id in activatedAt)) activatedAt[o.id] = tick;
    const elapsed = (tick - activatedAt[o.id]) / TICK_HZ;
    const already = state.notifications.some((nn) => nn.id.startsWith(`HINT_${o.id}`));
    if (elapsed >= o.nudgeAfterSec && !already) {
      fresh.push({
        id: `HINT_${o.id}_${tick}`, kind: "HINT", title: "",
        body: o.nudge, at: tick, colour: "#8b9bb4",
      });
    }
  }

  const unlock = ACT_UNLOCKS[act];
  const nextState: QuestState = {
    tick, act, objectives, completed,
    notifications: [...state.notifications, ...fresh].slice(-40),
    unlockedMachines: unlock.machines,
    unlockedConsoles: unlock.consoles,
    inventory, activatedAt, flags, beatTick,
  };

  return {
    nextState,
    activeQuests: objectives.filter((o) => o.act === act && !o.done),
    notifications: fresh,
    unlockedMachines: unlock.machines,
  };
}

/* ────────────────────────────────────────────────────────── analytics ── */

export function questTelemetry(q: QuestState) {
  const sec = q.tick / TICK_HZ;
  const total = q.objectives.filter((o) => !o.optional).length;
  const done = q.objectives.filter((o) => !o.optional && o.done).length;
  return {
    minutes: sec / 60,
    act: q.act,
    actMeta: ACT_META[q.act],
    progress: done / total,
    done, total,
    beatMinutes: q.beatTick === null ? null : q.beatTick / TICK_HZ / 60,
    /** the slice fails if the beat slips past 40 minutes */
    beatOnTarget: q.beatTick === null ? null
      : q.beatTick / TICK_HZ / 60 >= 28 && q.beatTick / TICK_HZ / 60 <= 40,
    crossings: q.flags.crossings,
    labPower: q.flags.labPowerTier,
  };
}

export function stageLabel(fi: FidelityState) {
  const f = fidelityIndex(fi);
  return { fi: f, stage: stageOf(f) };
}
