/* ============================================================================
 *  packages/runtime/src/MasterRuntime.ts
 *  ---------------------------------------------------------------------------
 *  THE UNIFICATION.
 *
 *  Four modes — PLAY, DRIVE, STUDIO, GALAXY — over ONE world state, ONE
 *  simulation clock and ONE camera rig. There is no scene reload between
 *  them, because there is only ever one scene; a "mode" is a camera goal
 *  plus an input routing table plus a set of HUD affordances.
 *
 *  That is the whole trick, and it is why the transitions cannot hitch:
 *  nothing is created or destroyed when you press Tab. The camera is
 *  critically damped toward a new target and the input router changes which
 *  reducer receives the gamepad.
 *
 *  Pure. 120 Hz fixed step. No DOM, no clock, no RNG.
 * ==========================================================================*/

import type { FidelityState, MetricKey } from "./contracts.setmix";
import { fidelityIndex, normalised, stageOf } from "./fidelity";

export type Vec3 = [number, number, number];
export const TICK_HZ = 120;
const DT = 1 / TICK_HZ;

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const clamp01 = (v: number) => clamp(v, 0, 1);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** C¹ smoothstep — the same curve the terrain geomorph and the portal
 *  dissolve use, so every transition in the game feels like one phenomenon. */
export const smoothstepC1 = (u: number) => { const t = clamp01(u); return t * t * (3 - 2 * t); };

/* ───────────────────────────────────────────────────────────── modes ─── */

export type Mode = "PLAY" | "DRIVE" | "STUDIO" | "GALAXY";

export interface ModeSpec {
  id: Mode;
  label: string;
  hotkey: string;
  colour: string;
  /** camera distance from the focus point, metres */
  camDist: number;
  camHeight: number;
  camPitch: number;
  fov: number;
  /** seconds for the critically-damped camera to settle */
  settle: number;
  /** which reducer owns WASD this frame */
  inputTarget: "AVATAR" | "ROVER" | "CURSOR" | "ORBIT";
  /** world-scale the renderer draws at: 1 = metres, 1e-4 = continental */
  worldScale: number;
  hud: string[];
  blurb: string;
}

export const MODES: Readonly<Record<Mode, ModeSpec>> = Object.freeze({
  PLAY: {
    id: "PLAY", label: "Play", hotkey: "1", colour: "#7cff4d",
    camDist: 0, camHeight: 1.62, camPitch: 0, fov: 1.05, settle: 0.45,
    inputTarget: "AVATAR", worldScale: 1,
    hud: ["coherence", "fidelity", "deck", "ore"],
    blurb: "First person. Wake in the lab, cross the arch, mine, build, watch the wave.",
  },
  DRIVE: {
    id: "DRIVE", label: "Drive", hotkey: "2", colour: "#ffc13d",
    camDist: 9.5, camHeight: 3.4, camPitch: 0.17, fov: 1.22, settle: 0.6,
    inputTarget: "ROVER", worldScale: 1,
    hud: ["speed", "drift", "checkpoint", "ghost"],
    blurb: "Chase cam. Powerslide the crater rims at 1.62 m/s² and race a 9-byte ghost.",
  },
  STUDIO: {
    id: "STUDIO", label: "Studio", hotkey: "3", colour: "#b46bff",
    camDist: 6.2, camHeight: 2.6, camPitch: 0.32, fov: 0.9, settle: 0.8,
    inputTarget: "CURSOR", worldScale: 1,
    hud: ["outliner", "synthesizer", "fusion", "inspector"],
    blurb: "Pull back into the 9-tier Inception outliner. Author the maths itself.",
  },
  GALAXY: {
    id: "GALAXY", label: "Galaxy", hotkey: "4", colour: "#3dc8ff",
    camDist: 1850, camHeight: 420, camPitch: 0.52, fov: 0.72, settle: 1.4,
    inputTarget: "ORBIT", worldScale: 0.0006,
    hud: ["globe", "enclaves", "weather", "federation"],
    blurb: "Orbit. Continental harmonics, neighbouring enclaves, other players' moons.",
  },
});

export const MODE_ORDER: Mode[] = ["PLAY", "DRIVE", "STUDIO", "GALAXY"];

/* ──────────────────────────────────────────────────── the camera rig ─── */

export interface CameraRig {
  /** where the camera actually is, after damping */
  pos: Vec3;
  /** what it is actually looking at */
  focus: Vec3;
  fov: number;
  worldScale: number;
  /** 0..1 progress through the current mode transition */
  blend: number;
  from: Mode;
  to: Mode;
}

export interface MasterState {
  tick: number;
  mode: Mode;
  /** the mode we are easing away from; equals `mode` once settled */
  prevMode: Mode;
  transitionTicks: number;
  transitionTotal: number;
  cam: CameraRig;

  /** one world, shared by all four modes */
  fidelity: FidelityState;
  avatarPos: Vec3;
  avatarYaw: number;
  roverPos: Vec3;
  roverYaw: number;
  roverSpeed: number;
  roverDrift: number;
  inRover: boolean;
  /** which of the 9 Inception scopes STUDIO is focused on */
  scopeDepth: number;
  /** GALAXY orbit angle */
  orbit: number;

  /** diagnostics the HUD and the verifier both read */
  hitches: number;
  lastFrameMs: number;
}

export function initialMaster(fidelity: FidelityState): MasterState {
  const spec = MODES.PLAY;
  return {
    tick: 0, mode: "PLAY", prevMode: "PLAY",
    transitionTicks: 0, transitionTotal: 1,
    cam: {
      pos: [0, spec.camHeight, 0], focus: [0, 1.5, -4],
      fov: spec.fov, worldScale: 1, blend: 1, from: "PLAY", to: "PLAY",
    },
    fidelity,
    avatarPos: [0, 0, 0], avatarYaw: 0,
    roverPos: [14, 0, -22], roverYaw: 0.4, roverSpeed: 0, roverDrift: 0,
    inRover: false, scopeDepth: 2, orbit: 0,
    hitches: 0, lastFrameMs: 0,
  };
}

/**
 *  THE MODE SWITCH.
 *  Note what this function does NOT do: allocate, load, unload, or touch the
 *  renderer. It sets two integers and a pair of mode ids. Everything visible
 *  follows from the damped camera, which is evaluated in stepMaster.
 */
export function requestMode(s: MasterState, next: Mode): MasterState {
  if (next === s.mode) return s;
  const total = Math.round(MODES[next].settle * TICK_HZ);
  return {
    ...s,
    prevMode: s.mode,
    mode: next,
    transitionTicks: 0,
    transitionTotal: Math.max(1, total),
    cam: { ...s.cam, from: s.mode, to: next, blend: 0 },
  };
}

/** Hotkeys, including the two context-sensitive ones the brief asked for. */
export function keyToMode(key: string, s: MasterState): Mode | "TOGGLE_ROVER" | null {
  const k = key.toLowerCase();
  if (k === "1") return "PLAY";
  if (k === "2") return "DRIVE";
  if (k === "3" || k === "o" || k === "tab") return "STUDIO";
  if (k === "4" || k === "g") return "GALAXY";
  if (k === "e") return "TOGGLE_ROVER";
  if (k === "escape") return s.mode === "PLAY" ? null : "PLAY";
  return null;
}

/* ──────────────────────────────────────────── the unified 120 Hz step ── */

export interface MasterInput {
  move: [number, number];
  look: [number, number];
  throttle: number;
  brake: number;
  handbrake: boolean;
  jump: boolean;
  interact: boolean;
}

export interface MasterWorld {
  height(x: number, z: number): number;
  /** continental radius, metres — GALAXY frames the whole body */
  planetRadius: number;
}

export function stepMaster(
  s: MasterState, input: MasterInput, world: MasterWorld, ticks = 1,
): MasterState {
  let st = { ...s };

  for (let i = 0; i < ticks; i++) {
    st.tick++;

    /* ── transition clock ──────────────────────────────────────────── */
    if (st.transitionTicks < st.transitionTotal) st.transitionTicks++;
    const raw = st.transitionTicks / st.transitionTotal;
    const blend = smoothstepC1(raw);

    const A = MODES[st.prevMode];
    const B = MODES[st.mode];
    const spec = {
      camDist: lerp(A.camDist, B.camDist, blend),
      camHeight: lerp(A.camHeight, B.camHeight, blend),
      camPitch: lerp(A.camPitch, B.camPitch, blend),
      fov: lerp(A.fov, B.fov, blend),
      worldScale: Math.exp(lerp(Math.log(A.worldScale), Math.log(B.worldScale), blend)),
    };

    /* ── route input to exactly one reducer ────────────────────────── */
    const target = blend > 0.5 ? B.inputTarget : A.inputTarget;

    if (target === "AVATAR" && !st.inRover) {
      const sp = 4.1;
      const cy = Math.cos(st.avatarYaw), sy = Math.sin(st.avatarYaw);
      st.avatarYaw += input.look[0] * 2.4 * DT;
      st.avatarPos = [
        st.avatarPos[0] + (input.move[0] * cy - input.move[1] * sy) * sp * DT,
        0,
        st.avatarPos[2] + (input.move[0] * sy + input.move[1] * cy) * sp * DT,
      ];
      st.avatarPos[1] = world.height(st.avatarPos[0], st.avatarPos[2]);
    }

    if (target === "ROVER" || st.inRover) {
      /* lunar rover: low gravity, long slides, deliberately loose.
       * Lateral grip falls off with speed, which is what produces the
       * powerslide rather than a scripted drift state. */
      const grip = clamp(1.25 - st.roverSpeed * 0.035, 0.22, 1);
      const steer = input.move[0] * (input.handbrake ? 1.5 : 1) * clamp(st.roverSpeed / 7, 0, 1);
      st.roverYaw += steer * 2.1 * DT;
      const accel = input.throttle * 16 - input.brake * 22;
      st.roverSpeed = clamp(st.roverSpeed + accel * DT - st.roverSpeed * 0.42 * DT, -6, 34);
      const slipTarget = Math.abs(steer) * st.roverSpeed * (input.handbrake ? 0.09 : 0.03);
      st.roverDrift = lerp(st.roverDrift, slipTarget * (1 / grip), 1 - Math.exp(-6 * DT));
      const dir = st.roverYaw + st.roverDrift * 0.55;
      st.roverPos = [
        st.roverPos[0] + Math.sin(dir) * st.roverSpeed * DT,
        0,
        st.roverPos[2] + Math.cos(dir) * st.roverSpeed * DT,
      ];
      st.roverPos[1] = world.height(st.roverPos[0], st.roverPos[2]);
      if (st.inRover) st.avatarPos = [...st.roverPos] as Vec3;
    }

    if (target === "ORBIT") st.orbit += (0.06 + input.move[0] * 0.5) * DT;
    if (target === "CURSOR") st.scopeDepth = clamp(st.scopeDepth + input.move[1] * DT * 2, 0, 8);

    /* ── the one camera ────────────────────────────────────────────── */
    const focusEntity: Vec3 = st.inRover || st.mode === "DRIVE" ? st.roverPos : st.avatarPos;
    const yaw = st.inRover || st.mode === "DRIVE" ? st.roverYaw : st.avatarYaw;

    let goalFocus: Vec3;
    let goalPos: Vec3;

    if (st.mode === "GALAXY" || (st.prevMode === "GALAXY" && blend < 1)) {
      // orbit the body's centre, not the avatar — but keep the avatar in
      // frame so the player never loses their anchor while zooming out
      const R = spec.camDist;
      goalFocus = [
        lerp(focusEntity[0], 0, blend * (st.mode === "GALAXY" ? 1 : 0)),
        lerp(focusEntity[1], 0, blend * (st.mode === "GALAXY" ? 1 : 0)),
        lerp(focusEntity[2], 0, blend * (st.mode === "GALAXY" ? 1 : 0)),
      ];
      goalPos = [
        goalFocus[0] + Math.sin(st.orbit) * R,
        goalFocus[1] + spec.camHeight + R * Math.sin(spec.camPitch) * 0.4,
        goalFocus[2] + Math.cos(st.orbit) * R,
      ];
    } else {
      goalFocus = [focusEntity[0], focusEntity[1] + 1.2, focusEntity[2]];
      goalPos = [
        focusEntity[0] - Math.sin(yaw) * spec.camDist,
        focusEntity[1] + spec.camHeight + spec.camDist * Math.sin(spec.camPitch),
        focusEntity[2] - Math.cos(yaw) * spec.camDist,
      ];
    }

    // critical damping — no overshoot, no spring wobble, frame-rate stable
    const k = 1 - Math.exp(-(6 + 10 * blend) * DT);
    st.cam = {
      pos: [
        lerp(st.cam.pos[0], goalPos[0], k),
        lerp(st.cam.pos[1], goalPos[1], k),
        lerp(st.cam.pos[2], goalPos[2], k),
      ],
      focus: [
        lerp(st.cam.focus[0], goalFocus[0], k),
        lerp(st.cam.focus[1], goalFocus[1], k),
        lerp(st.cam.focus[2], goalFocus[2], k),
      ],
      fov: spec.fov,
      worldScale: spec.worldScale,
      blend, from: st.prevMode, to: st.mode,
    };

    if (raw >= 1) st.prevMode = st.mode;
  }

  return st;
}

/** Enter/exit the rover. The avatar is not destroyed; it is parented. */
export function toggleRover(s: MasterState): MasterState {
  const d = Math.hypot(s.avatarPos[0] - s.roverPos[0], s.avatarPos[2] - s.roverPos[2]);
  if (!s.inRover && d > 6) return s;              // too far to reach the door
  const next = !s.inRover;
  return {
    ...requestMode(s, next ? "DRIVE" : "PLAY"),
    inRover: next,
    avatarPos: next ? ([...s.roverPos] as Vec3)
      : ([s.roverPos[0] + 2.2, s.roverPos[1], s.roverPos[2]] as Vec3),
  };
}

/* ───────────────────────────────────── the hitch budget, as a contract ── */

export interface FrameBudget {
  mode: Mode;
  /** ms of main-thread work this mode is allowed */
  budgetMs: number;
  /** what the mode is permitted to keep resident */
  residency: string[];
}

/**
 *  Nothing is unloaded on a mode switch. Instead every mode declares what it
 *  may keep RESIDENT, and the union across the two modes in a transition is
 *  what is live — so the peak is bounded, the steady state is cheap, and no
 *  allocation happens at the moment of the switch.
 */
export const FRAME_BUDGETS: Readonly<Record<Mode, FrameBudget>> = Object.freeze({
  PLAY:   { mode: "PLAY",   budgetMs: 16.6, residency: ["terrain:L0", "avatar:hero", "machines", "plumes", "audio:diegetic"] },
  DRIVE:  { mode: "DRIVE",  budgetMs: 16.6, residency: ["terrain:L0", "rover", "ghost", "machines:impostor", "audio:engine"] },
  STUDIO: { mode: "STUDIO", budgetMs: 16.6, residency: ["terrain:L1", "outliner", "texgraph:live", "avatar:hero"] },
  GALAXY: { mode: "GALAXY", budgetMs: 16.6, residency: ["globe:impostor", "enclaves", "weather", "manifests"] },
});

export function residencyUnion(a: Mode, b: Mode): string[] {
  return [...new Set([...FRAME_BUDGETS[a].residency, ...FRAME_BUDGETS[b].residency])];
}

/* ──────────────────────────────────────────────────────── telemetry ──── */

export function masterTelemetry(s: MasterState) {
  const fi = fidelityIndex(s.fidelity);
  const n = normalised(s.fidelity);
  return {
    tick: s.tick,
    seconds: s.tick / TICK_HZ,
    mode: s.mode,
    transitioning: s.transitionTicks < s.transitionTotal,
    blend: s.cam.blend,
    stage: stageOf(fi),
    fi,
    metrics: n as Record<MetricKey, number>,
    camDist: Math.hypot(
      s.cam.pos[0] - s.cam.focus[0],
      s.cam.pos[1] - s.cam.focus[1],
      s.cam.pos[2] - s.cam.focus[2],
    ),
    worldScale: s.cam.worldScale,
    roverSpeedKph: Math.abs(s.roverSpeed) * 3.6,
    drift: Math.abs(s.roverDrift),
    inRover: s.inRover,
    residency: residencyUnion(s.prevMode, s.mode),
    budgetMs: FRAME_BUDGETS[s.mode].budgetMs,
  };
}
