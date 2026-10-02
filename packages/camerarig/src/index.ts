export type V3 = [number, number, number];

export interface Subject {
  id: number;
  pos: V3;
  vel: V3;
  yaw: number;
  alive: boolean;
}

export interface Shot {
  eye: V3;
  target: V3;
  fov: number;
  roll: number;
}

export type RigKind =
  | "chase"
  | "orbit"
  | "free"
  | "topdown"
  | "first-person"
  | "helicam"
  | "ghost"
  | "director";

export interface RigDef {
  kind: RigKind;
  name: string;
  distance: number;
  height: number;
  lookAhead: number;
  stiffness: number;
  fov: number;
  fovBoostPerSpeed: number;
  shake: number;
  orbitSpeed: number;
  collideGround: boolean;
  eyeHeight: number;
}

export interface FreeInput {
  move: V3;
  yawDelta: number;
  pitchDelta: number;
  boost: boolean;
}

export interface GameEvent {
  t: number;
  kind:
    | "overtake"
    | "crash"
    | "item-hit"
    | "boost"
    | "lap"
    | "finish"
    | "fell-off"
    | "near-miss";
  a: number;
  b?: number;
  weight?: number;
  forLead?: boolean;
}

export const RIGS: RigDef[] = [
  { kind: "chase", name: "Classic chase", distance: 6, height: 2.5, lookAhead: 7, stiffness: 7, fov: 68, fovBoostPerSpeed: 0.32, shake: 0.12, orbitSpeed: 0, collideGround: true, eyeHeight: 1.2 },
  { kind: "chase", name: "Close chase", distance: 3.8, height: 1.7, lookAhead: 8, stiffness: 11, fov: 72, fovBoostPerSpeed: 0.38, shake: 0.18, orbitSpeed: 0, collideGround: true, eyeHeight: 1.2 },
  { kind: "chase", name: "Far chase", distance: 12, height: 4.5, lookAhead: 9, stiffness: 4, fov: 60, fovBoostPerSpeed: 0.24, shake: 0.06, orbitSpeed: 0, collideGround: true, eyeHeight: 1.2 },
  { kind: "chase", name: "Arcade high chase", distance: 8, height: 7, lookAhead: 10, stiffness: 6, fov: 65, fovBoostPerSpeed: 0.42, shake: 0.14, orbitSpeed: 0, collideGround: true, eyeHeight: 1.2 },
  { kind: "first-person", name: "Cockpit first person", distance: 0, height: 0, lookAhead: 18, stiffness: 14, fov: 76, fovBoostPerSpeed: 0.2, shake: 0.08, orbitSpeed: 0, collideGround: false, eyeHeight: 1.15 },
  { kind: "first-person", name: "Goblin eyes first person", distance: 0, height: 0, lookAhead: 14, stiffness: 16, fov: 82, fovBoostPerSpeed: 0.16, shake: 0.12, orbitSpeed: 0, collideGround: false, eyeHeight: 0.72 },
  { kind: "orbit", name: "Orbit", distance: 9, height: 4, lookAhead: 0, stiffness: 8, fov: 62, fovBoostPerSpeed: 0.1, shake: 0, orbitSpeed: 0.45, collideGround: true, eyeHeight: 1.2 },
  { kind: "helicam", name: "Helicopter", distance: 20, height: 12, lookAhead: 4, stiffness: 5, fov: 55, fovBoostPerSpeed: 0.12, shake: 0.04, orbitSpeed: 0.22, collideGround: true, eyeHeight: 1.2 },
  { kind: "topdown", name: "Top down", distance: 0, height: 34, lookAhead: 0, stiffness: 10, fov: 54, fovBoostPerSpeed: 0, shake: 0, orbitSpeed: 0, collideGround: false, eyeHeight: 1.2 },
  { kind: "ghost", name: "Ghost drift", distance: 4, height: 2, lookAhead: 12, stiffness: 5, fov: 78, fovBoostPerSpeed: 0.2, shake: 0.03, orbitSpeed: 0, collideGround: false, eyeHeight: 1.2 },
  { kind: "free", name: "Free camera", distance: 5, height: 3, lookAhead: 10, stiffness: 8, fov: 70, fovBoostPerSpeed: 0, shake: 0, orbitSpeed: 0, collideGround: false, eyeHeight: 1.2 },
  { kind: "director", name: "Broadcast director", distance: 7, height: 3, lookAhead: 8, stiffness: 6, fov: 64, fovBoostPerSpeed: 0.28, shake: 0.05, orbitSpeed: 0, collideGround: true, eyeHeight: 1.2 },
];

const RIG_KINDS: RigKind[] = [
  "chase", "orbit", "free", "topdown", "first-person", "helicam", "ghost", "director",
];

export function validateRig(x: unknown): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  try {
    if (x === null || typeof x !== "object" || Array.isArray(x)) {
      return { ok: false, errors: ["rig must be an object"] };
    }
    const value = x as Record<string, unknown>;
    if (typeof value.name !== "string" || value.name.trim().length === 0) {
      errors.push("name must be a non-empty string");
    }
    if (typeof value.kind !== "string" || !RIG_KINDS.includes(value.kind as RigKind)) {
      errors.push(`kind must be one of: ${RIG_KINDS.join(", ")}`);
    }

    const numberField = (name: string, min?: number, max?: number): void => {
      const n = value[name];
      if (typeof n !== "number" || !Number.isFinite(n)) {
        errors.push(`${name} must be a finite number`);
      } else if (min !== undefined && max !== undefined && (n < min || n > max)) {
        errors.push(`${name} must be between ${min} and ${max}`);
      }
    };

    numberField("distance", 0, 200);
    numberField("height", -20, 200);
    numberField("lookAhead");
    numberField("stiffness", 0.1, 60);
    numberField("fov", 20, 120);
    numberField("fovBoostPerSpeed", 0, 10);
    numberField("shake", 0, 1);
    numberField("orbitSpeed");
    numberField("eyeHeight");

    if (typeof value.collideGround !== "boolean") {
      errors.push("collideGround must be a boolean");
    }
  } catch {
    errors.push("rig could not be read safely");
  }
  return { ok: errors.length === 0, errors };
}

const TAU = Math.PI * 2;

function clamp(n: number, low: number, high: number): number {
  return Math.max(low, Math.min(high, n));
}

function safeDt(dt: number): number {
  return Number.isFinite(dt) && dt > 0 ? dt : 0;
}

function wrapAngle(angle: number): number {
  return ((angle + Math.PI) % TAU + TAU) % TAU - Math.PI;
}

function shortestAngle(from: number, to: number): number {
  return wrapAngle(to - from);
}

function copyV3(v: V3): V3 {
  return [v[0], v[1], v[2]];
}

function horizontalHeading(subject: Subject): number {
  const horizontalSpeed = Math.hypot(subject.vel[0], subject.vel[2]);
  return horizontalSpeed > 2
    ? Math.atan2(subject.vel[0], subject.vel[2])
    : wrapAngle(subject.yaw);
}

function speedOf(subject: Subject): number {
  return Math.hypot(subject.vel[0], subject.vel[1], subject.vel[2]);
}

function forward(heading: number): V3 {
  return [Math.sin(heading), 0, Math.cos(heading)];
}

function right(heading: number): V3 {
  return [Math.cos(heading), 0, -Math.sin(heading)];
}

function fovFor(rig: RigDef, speed: number): number {
  const boost = clamp(rig.fovBoostPerSpeed * Math.max(0, speed), 0, 25);
  return rig.fov + boost;
}

/* A 32-bit integer avalanche hash maps tick/channel pairs into [-1, 1]. */
function tickNoise(tick: number, channel: number): number {
  let x = (Math.imul(tick | 0, 0x9e3779b1) + Math.imul(channel, 0x85ebca6b)) | 0;
  x ^= x >>> 16;
  x = Math.imul(x, 0x7feb352d);
  x ^= x >>> 15;
  x = Math.imul(x, 0x846ca68b);
  x ^= x >>> 16;
  return (x >>> 0) / 0xffffffff * 2 - 1;
}

function groundClamp(eye: V3, rig: RigDef, groundAt: (x: number, z: number) => number): V3 {
  if (!rig.collideGround) return eye;
  const ground = groundAt(eye[0], eye[2]);
  if (Number.isFinite(ground)) eye[1] = Math.max(eye[1], ground + 1.2);
  return eye;
}

export class RigState {
  private def: RigDef;
  private eye: V3 = [0, 0, 0];
  private heading = 0;
  private orbitAngle = 0;
  private pitch = 0;
  private tick = 0;
  private snapNext = true;
  private hasReset = false;
  private lastVelocity: V3 = [0, 0, 0];

  constructor(def: RigDef) {
    this.def = def;
  }

  reset(subject: Subject, groundAt: (x: number, z: number) => number): void {
    this.heading = horizontalHeading(subject);
    this.orbitAngle = wrapAngle(this.heading + Math.PI);
    this.pitch = 0;
    this.tick = 0;
    this.snapNext = true;
    this.hasReset = true;
    this.lastVelocity = copyV3(subject.vel);
    this.eye = groundClamp(this.initialEye(this.def, subject), this.def, groundAt);
  }

  private initialEye(rig: RigDef, subject: Subject): V3 {
    const f = forward(this.heading);
    if (rig.kind === "first-person") {
      return [subject.pos[0], subject.pos[1] + rig.eyeHeight, subject.pos[2]];
    }
    if (rig.kind === "topdown") {
      return [subject.pos[0], subject.pos[1] + rig.height, subject.pos[2]];
    }
    if (rig.kind === "orbit" || rig.kind === "helicam") {
      return [
        subject.pos[0] + Math.sin(this.orbitAngle) * rig.distance,
        subject.pos[1] + rig.height,
        subject.pos[2] + Math.cos(this.orbitAngle) * rig.distance,
      ];
    }
    return [
      subject.pos[0] - f[0] * rig.distance,
      subject.pos[1] + rig.height,
      subject.pos[2] - f[2] * rig.distance,
    ];
  }

  step(
    rig: RigDef,
    dt: number,
    subject: Subject,
    groundAt: (x: number, z: number) => number,
    impulse = 0,
  ): Shot {
    this.def = rig;
    if (!this.hasReset) this.reset(subject, groundAt);

    const elapsed = safeDt(dt);
    const wasSnap = this.snapNext;
    const wantedHeading = horizontalHeading(subject);
    const alpha = 1 - Math.exp(-rig.stiffness * elapsed);
    this.heading = wasSnap
      ? wantedHeading
      : wrapAngle(this.heading + shortestAngle(this.heading, wantedHeading) * alpha);

    const f = forward(this.heading);
    let target: V3;
    let roll = 0;

    if (rig.kind === "first-person") {
      this.eye = [subject.pos[0], subject.pos[1] + rig.eyeHeight, subject.pos[2]];
      const look = Math.max(1, Math.abs(rig.lookAhead));
      target = [this.eye[0] + f[0] * look, this.eye[1], this.eye[2] + f[2] * look];
      if (elapsed > 0) {
        const r = right(this.heading);
        const ax = (subject.vel[0] - this.lastVelocity[0]) / elapsed;
        const az = (subject.vel[2] - this.lastVelocity[2]) / elapsed;
        roll = clamp(-(ax * r[0] + az * r[2]) * 0.01, -0.15, 0.15);
      }
    } else if (rig.kind === "orbit" || rig.kind === "helicam") {
      this.orbitAngle = wrapAngle(this.orbitAngle + rig.orbitSpeed * elapsed);
      this.eye = [
        subject.pos[0] + Math.sin(this.orbitAngle) * rig.distance,
        subject.pos[1] + rig.height,
        subject.pos[2] + Math.cos(this.orbitAngle) * rig.distance,
      ];
      target = [
        subject.pos[0] + f[0] * rig.lookAhead,
        subject.pos[1],
        subject.pos[2] + f[2] * rig.lookAhead,
      ];
    } else if (rig.kind === "topdown") {
      this.eye = [subject.pos[0], subject.pos[1] + rig.height, subject.pos[2]];
      target = [subject.pos[0], subject.pos[1], subject.pos[2]];
    } else if (rig.kind === "free" || rig.kind === "ghost") {
      const cp = Math.cos(this.pitch);
      const view: V3 = [
        Math.sin(this.heading) * cp,
        Math.sin(this.pitch),
        Math.cos(this.heading) * cp,
      ];
      const look = Math.max(1, Math.abs(rig.lookAhead));
      target = [
        this.eye[0] + view[0] * look,
        this.eye[1] + view[1] * look,
        this.eye[2] + view[2] * look,
      ];
    } else {
      const wantedEye: V3 = [
        subject.pos[0] - f[0] * rig.distance,
        subject.pos[1] + rig.height,
        subject.pos[2] - f[2] * rig.distance,
      ];
      this.eye = wasSnap
        ? wantedEye
        : [
            this.eye[0] + (wantedEye[0] - this.eye[0]) * alpha,
            this.eye[1] + (wantedEye[1] - this.eye[1]) * alpha,
            this.eye[2] + (wantedEye[2] - this.eye[2]) * alpha,
          ];
      target = [
        subject.pos[0] + f[0] * rig.lookAhead,
        subject.pos[1],
        subject.pos[2] + f[2] * rig.lookAhead,
      ];
    }

    this.eye = groundClamp(this.eye, rig, groundAt);
    this.lastVelocity = copyV3(subject.vel);
    this.snapNext = false;
    this.tick += 1;

    const shotEye = copyV3(this.eye);
    const shotTarget = copyV3(target);
    if (!wasSnap && rig.shake > 0) {
      const impact = Number.isFinite(impulse) ? Math.max(0, impulse) : 0;
      const amount = rig.shake * (speedOf(subject) / 40 + impact);
      shotEye[0] += tickNoise(this.tick, 1) * amount * 0.18;
      shotEye[1] += tickNoise(this.tick, 2) * amount * 0.12;
      shotEye[2] += tickNoise(this.tick, 3) * amount * 0.18;
      shotTarget[0] += tickNoise(this.tick, 4) * amount * 0.08;
      shotTarget[1] += tickNoise(this.tick, 5) * amount * 0.06;
    }
    groundClamp(shotEye, rig, groundAt);
    return { eye: shotEye, target: shotTarget, fov: fovFor(rig, speedOf(subject)), roll };
  }

  stepFree(rig: RigDef, dt: number, input: FreeInput): Shot {
    this.def = rig;
    const elapsed = safeDt(dt);
    this.heading = wrapAngle(this.heading + (Number.isFinite(input.yawDelta) ? input.yawDelta : 0));
    this.pitch = clamp(
      this.pitch + (Number.isFinite(input.pitchDelta) ? input.pitchDelta : 0),
      -1.4,
      1.4,
    );

    const mx = Number.isFinite(input.move[0]) ? input.move[0] : 0;
    const my = Number.isFinite(input.move[1]) ? input.move[1] : 0;
    const mz = Number.isFinite(input.move[2]) ? input.move[2] : 0;
    const magnitude = Math.hypot(mx, my, mz);
    const scale = magnitude > 1 ? 1 / magnitude : 1;
    const cp = Math.cos(this.pitch);
    const view: V3 = [
      Math.sin(this.heading) * cp,
      Math.sin(this.pitch),
      Math.cos(this.heading) * cp,
    ];
    const r = right(this.heading);
    const speed = input.boost ? 36 : 12;
    this.eye = [
      this.eye[0] + (r[0] * mx + view[0] * mz) * scale * speed * elapsed,
      this.eye[1] + (my + view[1] * mz) * scale * speed * elapsed,
      this.eye[2] + (r[2] * mx + view[2] * mz) * scale * speed * elapsed,
    ];

    const look = Math.max(1, Math.abs(rig.lookAhead));
    const target: V3 = [
      this.eye[0] + view[0] * look,
      this.eye[1] + view[1] * look,
      this.eye[2] + view[2] * look,
    ];
    this.snapNext = false;
    this.tick += 1;
    return { eye: copyV3(this.eye), target, fov: fovFor(rig, magnitude * speed), roll: 0 };
  }
}

const EVENT_SCORES: Record<GameEvent["kind"], number> = {
  finish: 10,
  crash: 8,
  "item-hit": 7,
  overtake: 6,
  "fell-off": 7,
  lap: 3,
  boost: 2,
  "near-miss": 3,
};

export function scoreEvent(e: GameEvent): number {
  const leadBonus = e.kind === "overtake" && e.forLead === true ? 2 : 0;
  return (EVENT_SCORES[e.kind] + leadBonus) * (e.weight === undefined ? 1 : e.weight);
}

interface Interest {
  score: number;
  event?: GameEvent;
}

export class Director {
  private readonly minShotSeconds: number;
  private readonly maxShotSeconds: number;
  private readonly switchMargin: number;
  private readonly decayPerSecond: number;
  private readonly rigs: RigDef[];
  private readonly interests = new Map<number, Interest>();
  private currentId: number | null = null;
  private currentRig: RigDef;
  private currentReason = "No live subjects";
  private age = 0;
  private shotCount = 0;
  private eventLock = 0;

  constructor(opts: {
    minShotSeconds?: number;
    maxShotSeconds?: number;
    switchMargin?: number;
    decayPerSecond?: number;
    rigs?: RigDef[];
  } = {}) {
    this.minShotSeconds = finiteOr(opts.minShotSeconds, 3, 0);
    this.maxShotSeconds = Math.max(
      this.minShotSeconds,
      finiteOr(opts.maxShotSeconds, 12, 0),
    );
    this.switchMargin = finiteOr(opts.switchMargin, 1.5, 0);
    this.decayPerSecond = finiteOr(opts.decayPerSecond, 0.35, 0);
    this.rigs = opts.rigs && opts.rigs.length > 0 ? opts.rigs.slice() : RIGS.slice();
    this.currentRig = this.rigs[0]!;
  }

  feed(e: GameEvent): void {
    const interest = this.interest(e.a);
    interest.score += scoreEvent(e);
    interest.event = e;
    if (this.currentId === e.a && (e.kind === "finish" || e.kind === "crash")) {
      this.eventLock = Math.max(this.eventLock, 2);
    }
  }

  step(
    dt: number,
    subjects: Subject[],
    leaderId: number,
  ): { subjectId: number; rig: RigDef; shotAgeSeconds: number; reason: string } {
    const elapsed = safeDt(dt);
    const decay = Math.exp(-this.decayPerSecond * elapsed);
    for (const interest of this.interests.values()) interest.score *= decay;
    for (const subject of subjects) this.interest(subject.id);

    const leader = subjects.find((s) => s.alive && s.id === leaderId);
    if (leader) this.interest(leader.id).score += 0.4 * elapsed;
    const second = subjects.find((s) => s.alive && s.id !== leaderId);
    if (second) this.interest(second.id).score += 0.2 * elapsed;

    const alive = subjects.filter((s) => s.alive);
    if (alive.length === 0) {
      this.currentId = null;
      this.age = 0;
      this.currentReason = "No live subjects";
      return { subjectId: -1, rig: this.currentRig, shotAgeSeconds: 0, reason: this.currentReason };
    }

    const currentAlive = this.currentId !== null && alive.some((s) => s.id === this.currentId);
    if (!currentAlive) {
      const best = this.best(alive, leaderId);
      this.beginShot(best.id, false);
      return this.result();
    }

    this.age += elapsed;
    this.eventLock = Math.max(0, this.eventLock - elapsed);
    const currentScore = this.interest(this.currentId!).score;
    const best = this.best(alive, leaderId);

    if (this.eventLock <= 1e-9 && this.age >= this.maxShotSeconds) {
      const different = this.best(alive, leaderId, this.currentId!);
      if (different) this.beginShot(different.id, true);
    } else if (
      this.eventLock <= 1e-9 &&
      this.age >= this.minShotSeconds &&
      best.id !== this.currentId &&
      this.interest(best.id).score > currentScore + this.switchMargin
    ) {
      this.beginShot(best.id, false);
    }
    return this.result();
  }

  private interest(id: number): Interest {
    let value = this.interests.get(id);
    if (!value) {
      value = { score: 0 };
      this.interests.set(id, value);
    }
    return value;
  }

  private best(subjects: Subject[], leaderId: number, exclude?: number): Subject {
    let selected: Subject | undefined;
    let selectedScore = -Infinity;
    for (const subject of subjects) {
      if (subject.id === exclude) continue;
      const score = this.interest(subject.id).score;
      const winsTie =
        score === selectedScore &&
        (subject.id === leaderId || (selected?.id !== leaderId && subject.id < (selected?.id ?? Infinity)));
      if (!selected || score > selectedScore || winsTie) {
        selected = subject;
        selectedScore = score;
      }
    }
    return selected ?? subjects[0]!;
  }

  private beginShot(subjectId: number, forced: boolean): void {
    this.currentId = subjectId;
    this.age = 0;
    this.eventLock = 0;
    const event = this.interest(subjectId).event;
    this.currentRig = this.pickRig(event?.kind);
    this.currentReason = event
      ? eventReason(event)
      : forced
        ? `Maximum shot length reached; cut to goblin ${subjectId}`
        : `Following goblin ${subjectId}`;
  }

  private pickRig(kind?: GameEvent["kind"]): RigDef {
    let candidates: RigDef[];
    if (kind === "crash") {
      candidates = this.rigs.filter((r) => r.kind === "chase" && r.name.toLowerCase().includes("far"));
    } else if (kind === "overtake") {
      candidates = this.rigs.filter((r) => r.kind === "chase" && r.name.toLowerCase().includes("close"));
    } else if (kind === "finish") {
      candidates = this.rigs.filter((r) => r.kind === "orbit");
    } else {
      candidates = this.rigs.filter((r) => r.kind === "chase" && r.name.toLowerCase().includes("classic"));
    }
    if (candidates.length === 0) {
      const fallbackKind = kind === "finish" ? "orbit" : "chase";
      candidates = this.rigs.filter((r) => r.kind === fallbackKind);
    }
    if (candidates.length === 0) candidates = this.rigs;
    const selected = candidates[this.shotCount % candidates.length] ?? this.rigs[0]!;
    this.shotCount += 1;
    return selected;
  }

  private result(): { subjectId: number; rig: RigDef; shotAgeSeconds: number; reason: string } {
    return {
      subjectId: this.currentId ?? -1,
      rig: this.currentRig,
      shotAgeSeconds: this.age,
      reason: this.currentReason,
    };
  }
}

function finiteOr(value: number | undefined, fallback: number, minimum: number): number {
  return value !== undefined && Number.isFinite(value) ? Math.max(minimum, value) : fallback;
}

function eventReason(e: GameEvent): string {
  switch (e.kind) {
    case "overtake": return `Overtake by goblin ${e.a}`;
    case "crash": return `Crash involving goblin ${e.a}`;
    case "item-hit": return `Item hit by goblin ${e.a}`;
    case "boost": return `Boost from goblin ${e.a}`;
    case "lap": return `Lap completed by goblin ${e.a}`;
    case "finish": return `Goblin ${e.a} finishes`;
    case "fell-off": return `Goblin ${e.a} fell off the island`;
    case "near-miss": return `Near miss by goblin ${e.a}`;
  }
}

function displayNumber(n: number): string {
  return Number.isInteger(n) ? n.toFixed(0) : String(n);
}

export function describeRig(def: RigDef): string {
  const distance = displayNumber(def.distance);
  const height = displayNumber(def.height);
  const motion = def.stiffness < 4 ? "very smooth" : def.stiffness < 10 ? "smooth" : "responsive";
  const shake = def.shake === 0 ? "no shake" : def.shake < 0.16 ? "slight shake" : "strong shake";
  const zoom = def.fovBoostPerSpeed > 0 ? "zooms out with speed" : "keeps a fixed field of view";

  if (def.kind === "first-person") {
    return `Rides at ${displayNumber(def.eyeHeight)} m eye height, ${motion}, ${shake}, and ${zoom}.`;
  }
  if (def.kind === "orbit" || def.kind === "helicam") {
    return `Circles at ${distance} m radius and ${height} m above, ${motion}, ${shake}, and ${zoom}.`;
  }
  if (def.kind === "topdown") {
    return `Looks straight down from ${height} m above with ${shake} and a stable roll.`;
  }
  if (def.kind === "free" || def.kind === "ghost") {
    return `Moves freely at a ${distance} m starting offset, with ${shake}, and ${zoom}.`;
  }
  return `Chases from ${distance} m behind and ${height} m above, ${motion}, ${shake}, and ${zoom}.`;
}

export function blendShots(a: Shot, b: Shot, t: number): Shot {
  if (t <= 0 || !Number.isFinite(t)) {
    return { eye: copyV3(a.eye), target: copyV3(a.target), fov: a.fov, roll: a.roll };
  }
  if (t >= 1) {
    return { eye: copyV3(b.eye), target: copyV3(b.target), fov: b.fov, roll: b.roll };
  }
  const s = t * t * (3 - 2 * t);
  const mix = (x: number, y: number): number => x + (y - x) * s;
  return {
    eye: [mix(a.eye[0], b.eye[0]), mix(a.eye[1], b.eye[1]), mix(a.eye[2], b.eye[2])],
    target: [
      mix(a.target[0], b.target[0]),
      mix(a.target[1], b.target[1]),
      mix(a.target[2], b.target[2]),
    ],
    fov: mix(a.fov, b.fov),
    roll: a.roll + shortestAngle(a.roll, b.roll) * s,
  };
}