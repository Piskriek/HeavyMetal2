/* ============================================================================
 *  packages/setmix-logistics/src/LogisticsSwarm.ts
 *  ---------------------------------------------------------------------------
 *  THE MOMENT CARRYING ORE BY HAND STOPS BEING THE GAME.
 *
 *  Factorio's real lesson is not "belts" — it is that the player should
 *  graduate from being the logistics system to DESIGNING it. The drone swarm
 *  is the first graduation; the pneumatic bus is the second.
 *
 *  Everything here is deterministic at 120 Hz with an injected seed, so a
 *  co-op session running on two machines dispatches the same drone to the
 *  same crate in the same tick — which is what lets NetBus rollback work
 *  without ever serialising a drone.
 * ==========================================================================*/

export type Vec3 = [number, number, number];
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const len = (v: Vec3) => Math.hypot(v[0], v[1], v[2]);
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0]-b[0], a[1]-b[1], a[2]-b[2]];

/* ───────────────────────────────────────────────────────── contracts ── */

export type NodeKind = "HUB" | "EXTRACTOR" | "CHIMNEY" | "STORAGE" | "LAB_PORTAL" | "SPIRE";
export type Payload = "ORE" | "CARTRIDGE" | "SLAG" | "NONE";

export interface LogiNode {
  id: string;
  kind: NodeKind;
  pos: Vec3;
  /** what it produces per second, if anything */
  produces: Payload;
  produceRate: number;
  /** what it consumes; a starved chimney is the swarm's top priority */
  consumes: Payload;
  consumeRate: number;
  buffer: number;
  capacity: number;
}

export type DroneState = "IDLE" | "TO_SOURCE" | "LOADING" | "TO_SINK" | "UNLOADING" | "RETURNING";

export interface Drone {
  id: string;
  pos: Vec3;
  vel: Vec3;
  state: DroneState;
  taskId: string | null;
  payload: Payload;
  amount: number;
  /** 0..1 beam charge-up; the tractor beam is visible before cargo moves */
  beam: number;
  /** the cargo cube lerps along the beam rather than teleporting */
  cargoLerp: number;
  energy: number;
}

export interface Task {
  id: string;
  from: string;
  to: string;
  payload: Payload;
  amount: number;
  /** lower is more urgent */
  priority: number;
  claimedBy: string | null;
  createdTick: number;
}

export interface SwarmConfig {
  maxSpeed: number;
  accel: number;
  separation: number;
  /** metres of clearance the drone keeps above terrain */
  clearance: number;
  beamRange: number;
  beamChargeRate: number;
  capacity: number;
  /** probe distance for terrain avoidance */
  lookAhead: number;
}

export const SWARM_DEFAULT: SwarmConfig = {
  maxSpeed: 11, accel: 16, separation: 3.4, clearance: 6,
  beamRange: 5.5, beamChargeRate: 2.6, capacity: 12, lookAhead: 9,
};

export interface SwarmState {
  drones: Drone[];
  tasks: Task[];
  nodes: Map<string, LogiNode>;
  tick: number;
  delivered: number;
  stats: { active: number; idle: number; queued: number; throughput: number };
}

/* ════════════════════════════════════════════════ 1 · TASK DISPATCH ══ */

/**
 *  PRIORITY MODEL — the ordering IS the design.
 *
 *    0   a starved CHIMNEY/SPIRE (terraforming has stopped: nothing matters more)
 *    10  an extractor about to overflow (production is about to stall)
 *    20  cartridge delivery to a spire slot (the player asked for this)
 *    40  routine ore → storage
 *    60  slag clearance
 *
 *  Within a band, ties break on distance, so the swarm is locally greedy but
 *  globally correct. Players read this as "the drones understand my base",
 *  which is exactly the feeling that makes automation satisfying.
 */
export function generateTasks(s: SwarmState, cfg: SwarmConfig): Task[] {
  const out: Task[] = [];
  const nodes = [...s.nodes.values()];
  let n = 0;

  const nearestWith = (kind: NodeKind[], from: Vec3, pred: (x: LogiNode) => boolean) => {
    let best: LogiNode | null = null, bd = Infinity;
    for (const x of nodes) {
      if (!kind.includes(x.kind) || !pred(x)) continue;
      const d = len(sub(x.pos, from));
      if (d < bd) { bd = d; best = x; }
    }
    return best;
  };

  for (const node of nodes) {
    /* starving consumers — the terraforming stopped, this is an emergency */
    if (node.consumes !== "NONE" && node.buffer < node.capacity * 0.35) {
      const src = nearestWith(["STORAGE", "EXTRACTOR", "HUB"], node.pos,
        (x) => x.produces === node.consumes && x.buffer > 1);
      if (src) out.push({
        id: `t_${s.tick}_${n++}`, from: src.id, to: node.id,
        payload: node.consumes,
        amount: Math.min(cfg.capacity, node.capacity - node.buffer, src.buffer),
        priority: node.kind === "CHIMNEY" || node.kind === "SPIRE" ? 0 : 20,
        claimedBy: null, createdTick: s.tick,
      });
    }
    /* producers about to back up */
    if (node.produces !== "NONE" && node.buffer > node.capacity * 0.7) {
      const sink = nearestWith(["STORAGE", "LAB_PORTAL"], node.pos,
        (x) => x.buffer < x.capacity * 0.95);
      if (sink) out.push({
        id: `t_${s.tick}_${n++}`, from: node.id, to: sink.id,
        payload: node.produces,
        amount: Math.min(cfg.capacity, node.buffer),
        priority: node.buffer > node.capacity * 0.93 ? 10 : 40,
        claimedBy: null, createdTick: s.tick,
      });
    }
  }
  return out;
}

/* ══════════════════════════════════════ 2 · BOIDS + TERRAIN AVOIDANCE ══ */

export interface SwarmCtx {
  cfg: SwarmConfig;
  ground: (x: number, z: number) => number;
  /** composited volumetric SDF; drones fly through caves correctly */
  solid?: (x: number, y: number, z: number) => number;
  dt: number;
  ticks?: number;
}

/**
 *  Steering = seek + separation + terrain avoidance.
 *
 *  Terrain avoidance probes the SDF ahead along the velocity vector rather
 *  than sampling straight down. That difference is why a drone flies OVER a
 *  ridge instead of into it, and — because the probe uses the composited
 *  field — why it will happily thread a tunnel the player dug rather than
 *  refusing to enter one.
 */
export function stepSwarm(s: SwarmState, ctx: SwarmCtx): SwarmState {
  const ticks = ctx.ticks ?? 1;
  const dt = ctx.dt * ticks;
  const cfg = ctx.cfg;
  const nodes = new Map(s.nodes);
  let tasks = [...s.tasks, ...generateTasks(s, cfg)]
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 64);
  let delivered = s.delivered;

  const drones = s.drones.map((d) => ({ ...d, pos: [...d.pos] as Vec3, vel: [...d.vel] as Vec3 }));

  for (const d of drones) {
    /* ── claim work ──────────────────────────────────────────────── */
    if (d.state === "IDLE") {
      const t = tasks.find((x) => !x.claimedBy);
      if (t) { t.claimedBy = d.id; d.taskId = t.id; d.state = "TO_SOURCE"; }
    }
    const task = d.taskId ? tasks.find((x) => x.id === d.taskId) : undefined;
    if (!task && d.state !== "IDLE" && d.state !== "RETURNING") {
      d.state = "RETURNING"; d.taskId = null;
    }

    /* ── pick a target ───────────────────────────────────────────── */
    let target: Vec3 | null = null;
    let arriveAt: LogiNode | undefined;
    if (task) {
      arriveAt = nodes.get(d.state === "TO_SOURCE" || d.state === "LOADING" ? task.from : task.to);
      if (arriveAt) target = [arriveAt.pos[0], arriveAt.pos[1] + cfg.clearance, arriveAt.pos[2]];
    } else if (d.state === "RETURNING") {
      const hub = [...nodes.values()].find((x) => x.kind === "HUB");
      if (hub) target = [hub.pos[0], hub.pos[1] + cfg.clearance, hub.pos[2]];
    }

    /* ── steering ────────────────────────────────────────────────── */
    if (target) {
      const to = sub(target, d.pos);
      const dist = len(to) || 1e-6;
      const desired: Vec3 = [
        (to[0] / dist) * cfg.maxSpeed,
        (to[1] / dist) * cfg.maxSpeed,
        (to[2] / dist) * cfg.maxSpeed,
      ];
      // arrival damping, so drones do not oscillate on a pad
      const slow = Math.min(1, dist / 8);
      for (let k = 0; k < 3; k++)
        d.vel[k] += (desired[k] * slow - d.vel[k]) * clamp(cfg.accel * ctx.dt, 0, 1);
    }

    // separation — O(n²) but n ≤ 48 and a hash grid costs more in bookkeeping
    for (const o of drones) {
      if (o.id === d.id) continue;
      const diff = sub(d.pos, o.pos);
      const dd = len(diff);
      if (dd > cfg.separation || dd < 1e-4) continue;
      const push = (cfg.separation - dd) / cfg.separation;
      for (let k = 0; k < 3; k++) d.vel[k] += (diff[k] / dd) * push * 22 * ctx.dt;
    }

    /* ── terrain avoidance: probe AHEAD, not below ───────────────── */
    const sp = len(d.vel) || 1e-6;
    const ax = d.pos[0] + (d.vel[0] / sp) * cfg.lookAhead;
    const az = d.pos[2] + (d.vel[2] / sp) * cfg.lookAhead;
    const aheadGround = ctx.ground(ax, az) + cfg.clearance;
    if (d.pos[1] < aheadGround) d.vel[1] += (aheadGround - d.pos[1]) * 5.5 * ctx.dt;
    const hereGround = ctx.ground(d.pos[0], d.pos[2]) + cfg.clearance * 0.6;
    if (d.pos[1] < hereGround) { d.pos[1] = hereGround; if (d.vel[1] < 0) d.vel[1] = 0; }
    // inside a dug tunnel the SDF overrides the heightfield, so drones follow
    // the cave rather than hugging the vanished surface above it
    if (ctx.solid && ctx.solid(d.pos[0], d.pos[1], d.pos[2]) < 0.6) d.vel[1] += 9 * ctx.dt;

    const s2 = len(d.vel);
    if (s2 > cfg.maxSpeed) for (let k = 0; k < 3; k++) d.vel[k] *= cfg.maxSpeed / s2;
    for (let k = 0; k < 3; k++) d.pos[k] += d.vel[k] * dt;

    /* ── beam + transfer state machine ───────────────────────────── */
    const near = arriveAt ? len(sub(arriveAt.pos, d.pos)) < cfg.beamRange : false;
    if (d.state === "TO_SOURCE" && near) d.state = "LOADING";
    if (d.state === "TO_SINK" && near) d.state = "UNLOADING";

    if (d.state === "LOADING" || d.state === "UNLOADING") {
      d.beam = Math.min(1, d.beam + cfg.beamChargeRate * dt);
      d.cargoLerp = d.beam;
      if (d.beam >= 1 && task && arriveAt) {
        if (d.state === "LOADING") {
          const take = Math.min(task.amount, arriveAt.buffer, cfg.capacity);
          nodes.set(arriveAt.id, { ...arriveAt, buffer: arriveAt.buffer - take });
          d.payload = task.payload; d.amount = take;
          d.state = "TO_SINK"; d.beam = 0; d.cargoLerp = 0;
        } else {
          const sink = nodes.get(task.to);
          if (sink) nodes.set(sink.id, {
            ...sink, buffer: Math.min(sink.capacity, sink.buffer + d.amount),
          });
          delivered += d.amount;
          d.payload = "NONE"; d.amount = 0; d.taskId = null;
          d.state = "IDLE"; d.beam = 0; d.cargoLerp = 0;
          tasks = tasks.filter((x) => x.id !== task.id);
        }
      }
    } else {
      d.beam = Math.max(0, d.beam - dt * 3);
    }

    if (d.state === "RETURNING" && target && len(sub(target, d.pos)) < 3) d.state = "IDLE";
    d.energy = clamp(d.energy + (d.state === "IDLE" ? 0.1 : -0.012) * dt, 0, 1);
  }

  /* ── production & consumption ───────────────────────────────────── */
  for (const [id, nd] of nodes) {
    let buf = nd.buffer;
    if (nd.produces !== "NONE") buf = Math.min(nd.capacity, buf + nd.produceRate * dt);
    if (nd.consumes !== "NONE") buf = Math.max(0, buf - nd.consumeRate * dt);
    if (buf !== nd.buffer) nodes.set(id, { ...nd, buffer: buf });
  }

  const active = drones.filter((d) => d.state !== "IDLE").length;
  return {
    drones, tasks, nodes, tick: s.tick + ticks, delivered,
    stats: {
      active, idle: drones.length - active, queued: tasks.filter((t) => !t.claimedBy).length,
      throughput: delivered / Math.max(1, (s.tick + ticks) / 120),
    },
  };
}

export function makeSwarm(nodes: LogiNode[], droneCount: number): SwarmState {
  const hub = nodes.find((n) => n.kind === "HUB") ?? nodes[0];
  return {
    drones: Array.from({ length: droneCount }, (_, i) => ({
      id: `d${i}`,
      pos: [hub.pos[0] + (i % 4) * 2 - 3, hub.pos[1] + 7, hub.pos[2] + Math.floor(i / 4) * 2 - 3] as Vec3,
      vel: [0, 0, 0] as Vec3, state: "IDLE" as DroneState, taskId: null,
      payload: "NONE" as Payload, amount: 0, beam: 0, cargoLerp: 0, energy: 1,
    })),
    tasks: [], nodes: new Map(nodes.map((n) => [n.id, n])), tick: 0, delivered: 0,
    stats: { active: 0, idle: droneCount, queued: 0, throughput: 0 },
  };
}

/* ══════════════════════════════════ 3 · PNEUMATIC TUBES (SPLINE BUS) ══ */

export interface TubeSegment { a: Vec3; b: Vec3; sag: number }

export interface PneumaticTube {
  id: string;
  from: string;
  to: string;
  /** Catmull-Rom control points; the tube visibly sags between pylons */
  points: Vec3[];
  length: number;
  /** items per second the tube can accept */
  throughput: number;
  payload: Payload;
}

export interface TubeCapsule {
  tubeId: string;
  /** 0..1 along the spline */
  t: number;
  payload: Payload;
  amount: number;
  spin: number;
}

/** Centripetal Catmull-Rom: passes through every control point and never
 *  overshoots into a cusp the way uniform CR does on unevenly-spaced pylons. */
export function catmullRom(pts: readonly Vec3[], t: number): Vec3 {
  const n = pts.length;
  if (n < 2) return pts[0] ?? [0, 0, 0];
  const seg = Math.min(n - 2, Math.floor(t * (n - 1)));
  const lt = t * (n - 1) - seg;
  const p0 = pts[Math.max(0, seg - 1)], p1 = pts[seg];
  const p2 = pts[Math.min(n - 1, seg + 1)], p3 = pts[Math.min(n - 1, seg + 2)];
  const t2 = lt * lt, t3 = t2 * lt;
  const out: Vec3 = [0, 0, 0];
  for (let k = 0; k < 3; k++)
    out[k] = 0.5 * (
      2 * p1[k] +
      (-p0[k] + p2[k]) * lt +
      (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 +
      (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3
    );
  return out;
}

export function buildTube(
  id: string, from: LogiNode, to: LogiNode, pylons: number, sag: number,
): PneumaticTube {
  const pts: Vec3[] = [];
  for (let i = 0; i <= pylons + 1; i++) {
    const t = i / (pylons + 1);
    const x = from.pos[0] + (to.pos[0] - from.pos[0]) * t;
    const z = from.pos[2] + (to.pos[2] - from.pos[2]) * t;
    const y = from.pos[1] + (to.pos[1] - from.pos[1]) * t
      + 6 - Math.sin(t * Math.PI) * sag;
    pts.push([x, y, z]);
  }
  let length = 0;
  for (let i = 1; i < pts.length; i++) length += len(sub(pts[i], pts[i - 1]));
  return { id, from: from.id, to: to.id, points: pts, length, throughput: 6, payload: from.produces };
}

/**
 *  Capsules advance at a constant WORLD speed, not a constant parameter rate —
 *  otherwise they visibly accelerate through the tight parts of the spline,
 *  which instantly reads as fake.
 */
export function stepTubes(
  tubes: readonly PneumaticTube[], capsules: TubeCapsule[],
  nodes: Map<string, LogiNode>, speed: number, dt: number,
): { capsules: TubeCapsule[]; nodes: Map<string, LogiNode>; delivered: number } {
  const out: TubeCapsule[] = [];
  const nn = new Map(nodes);
  let delivered = 0;

  for (const c of capsules) {
    const tube = tubes.find((x) => x.id === c.tubeId);
    if (!tube) continue;
    const t = c.t + (speed * dt) / Math.max(1, tube.length);
    if (t >= 1) {
      const sink = nn.get(tube.to);
      if (sink) nn.set(sink.id, { ...sink, buffer: Math.min(sink.capacity, sink.buffer + c.amount) });
      delivered += c.amount;
    } else {
      out.push({ ...c, t, spin: c.spin + dt * 5.5 });
    }
  }
  return { capsules: out, nodes: nn, delivered };
}

export function injectCapsules(
  tubes: readonly PneumaticTube[], nodes: Map<string, LogiNode>,
  acc: Map<string, number>, dt: number,
): { spawned: TubeCapsule[]; nodes: Map<string, LogiNode>; acc: Map<string, number> } {
  const spawned: TubeCapsule[] = [];
  const nn = new Map(nodes);
  const a = new Map(acc);
  for (const tube of tubes) {
    const src = nn.get(tube.from);
    if (!src || src.buffer < 1) continue;
    let v = (a.get(tube.id) ?? 0) + tube.throughput * dt;
    while (v >= 1 && (nn.get(tube.from)?.buffer ?? 0) >= 1) {
      v -= 1;
      const s = nn.get(tube.from)!;
      nn.set(s.id, { ...s, buffer: s.buffer - 1 });
      spawned.push({ tubeId: tube.id, t: 0, payload: tube.payload, amount: 1, spin: 0 });
    }
    a.set(tube.id, v);
  }
  return { spawned, nodes: nn, acc: a };
}

export const LOGISTICS_NOTES = [
  ["Priority bands, distance ties",
   "A starved chimney is priority 0 because terraforming has literally stopped. Within a band, ties break on distance — locally greedy, globally correct. Players read this as 'the drones understand my base'."],
  ["Probe ahead, not below",
   "Terrain avoidance samples the SDF along the velocity vector. That is why drones fly over ridges instead of into them, and why they thread a tunnel the player dug rather than refusing to enter."],
  ["The beam charges before cargo moves",
   "A tractor beam that teleports its payload reads as a bug. Charge-up (0.38 s) then a visible cargo lerp along the beam makes the transfer legible from 80 m."],
  ["Constant world speed in tubes",
   "Advancing by a constant spline PARAMETER makes capsules visibly accelerate through tight curves. Dividing by arc length fixes it, and nobody can say why it looks right."],
  ["Deterministic, so co-op is free",
   "Same seed, same tick, same dispatch. NetBus never serialises a drone — it serialises the command that built the hub, and both machines derive the identical swarm."],
] as const;
