import type { VariableDef } from '@hm/contracts';

/**
 * Animation as presets. A character has six bones (body, head, two arms, two legs). An animation preset is a handful of numbers a child can
 * drag (how fast, how far the legs swing, how much the body bobs ...) and the maths turns them into a pose at any moment. An Animator picks
 * the right preset from how the character moves (standing, walking, running, in the air) and blends between them, and plays one-off moves
 * (a tool swing, a wave, a dance) on top. Pure and deterministic: time comes in as an argument.
 *
 * Conventions: angles in radians inside, degrees in presets. rx swings a limb forward (+, towards where the character faces) and back (-)
 * around the sideways axis (180 degrees = straight up); rz lifts it out to the side (+ = away from the body, mirrored for left and right by
 * the renderer); ry twists. `lift` raises the whole body in metres
 * (in the model's own size units: 1 = the character's height), `lean` tips the body forward.
 */

export type Bone = 'body' | 'head' | 'armL' | 'armR' | 'legL' | 'legR';
export const BONES: readonly Bone[] = ['body', 'head', 'armL', 'armR', 'legL', 'legR'];
export interface BonePose { rx: number; ry: number; rz: number }
export interface Pose { bones: Record<Bone, BonePose>; lift: number; lean: number }

export type AnimStyle = 'idle' | 'walk' | 'run' | 'jump' | 'fall' | 'swing' | 'wave' | 'dance' | 'cheer' | 'waddle';
export const ANIM_STYLES: readonly AnimStyle[] = ['idle', 'walk', 'run', 'jump', 'fall', 'swing', 'wave', 'dance', 'cheer', 'waddle'];

export interface AnimPreset {
  id: string;
  name: string;
  style: AnimStyle;
  /** Cycles per second (a walk cycle is two steps). */
  cadence: number;
  /** Degrees each leg swings forward and back. */
  legSwing: number;
  /** Degrees each arm swings. */
  armSwing: number;
  /** Degrees the arms are held up or out. */
  armRaise: number;
  /** How far the body bobs up and down (fraction of the character's height). */
  bob: number;
  /** Degrees the body leans forward. */
  lean: number;
  /** Degrees the head nods. */
  headNod: number;
  /** Degrees the body rocks side to side. */
  sway: number;
  /** Degrees the shoulders twist against the hips. */
  twist: number;
  /** Seconds a one-off move lasts (ignored for loops). */
  duration: number;
  /** Repeats forever (walks, idles, dances) or plays once (a swing, a jump). */
  loop: boolean;
}

const D2R = Math.PI / 180;
const zero = (): BonePose => ({ rx: 0, ry: 0, rz: 0 });
export const restPose = (): Pose => ({ bones: { body: zero(), head: zero(), armL: zero(), armR: zero(), legL: zero(), legR: zero() }, lift: 0, lean: 0 });

const a = (id: string, name: string, style: AnimStyle, v: Partial<AnimPreset>): AnimPreset => ({
  id, name, style, cadence: 1, legSwing: 0, armSwing: 0, armRaise: 0, bob: 0, lean: 0, headNod: 0, sway: 0, twist: 0, duration: 1, loop: true, ...v,
});

/** The ready-made animations. Every number is a variable you can change in the Animate tab. */
export const ANIMATIONS: readonly AnimPreset[] = [
  a('idle', 'Breathe', 'idle', { cadence: 0.45, armSwing: 3, bob: 0.008, headNod: 3, sway: 1.5 }),
  a('walk', 'Walk', 'walk', { cadence: 0.95, legSwing: 32, armSwing: 28, bob: 0.025, lean: 4, headNod: 3, sway: 3, twist: 6 }),
  a('run', 'Run', 'run', { cadence: 1.45, legSwing: 50, armSwing: 52, armRaise: 18, bob: 0.045, lean: 14, headNod: 4, sway: 2, twist: 10 }),
  a('waddle', 'Goblin waddle', 'waddle', { cadence: 0.85, legSwing: 24, armSwing: 18, armRaise: 22, bob: 0.03, lean: 8, headNod: 6, sway: 10, twist: 4 }),
  a('jump', 'Jump', 'jump', { cadence: 1, legSwing: 40, armSwing: 20, armRaise: 120, bob: 0.02, lean: 6, duration: 0.7, loop: false }),
  a('fall', 'Fall', 'fall', { cadence: 2.2, legSwing: 12, armSwing: 10, armRaise: 70, lean: -4 }),
  a('swing', 'Tool swing', 'swing', { cadence: 1, armSwing: 70, armRaise: 110, lean: 8, twist: 18, duration: 0.45, loop: false }),
  a('wave', 'Wave', 'wave', { cadence: 2.2, armSwing: 25, armRaise: 150, headNod: 6, sway: 3, duration: 1.6, loop: false }),
  a('dance', 'Dance', 'dance', { cadence: 1.8, legSwing: 18, armSwing: 60, armRaise: 70, bob: 0.06, sway: 12, twist: 20, headNod: 12, duration: 4, loop: false }),
  a('cheer', 'Cheer', 'cheer', { cadence: 2.6, armSwing: 25, armRaise: 160, bob: 0.05, headNod: 10, duration: 1.5, loop: false }),
];
export const animById = (id: string): AnimPreset => ANIMATIONS.find((x) => x.id === id) ?? ANIMATIONS[0]!;

const num = (v: unknown, d: number, lo: number, hi: number): number => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);
const rec = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

/** Anything to a legal animation preset (missing numbers come from the ready-made preset of the same style). Never throws. */
export function normalizeAnim(raw: unknown, id = 'custom', name = id): AnimPreset {
  const r = rec(raw);
  const style: AnimStyle = ANIM_STYLES.includes(r.style as AnimStyle) ? (r.style as AnimStyle) : 'walk';
  const base = ANIMATIONS.find((x) => x.style === style) ?? ANIMATIONS[1]!;
  return {
    id: typeof r.id === 'string' && r.id ? r.id : id,
    name: typeof r.name === 'string' && r.name.trim() ? r.name.trim() : name,
    style,
    cadence: num(r.cadence, base.cadence, 0, 20),
    legSwing: num(r.legSwing, base.legSwing, -180, 180),
    armSwing: num(r.armSwing, base.armSwing, -180, 180),
    armRaise: num(r.armRaise, base.armRaise, -180, 180),
    bob: num(r.bob, base.bob, 0, 1),
    lean: num(r.lean, base.lean, -90, 90),
    headNod: num(r.headNod, base.headNod, -90, 90),
    sway: num(r.sway, base.sway, -90, 90),
    twist: num(r.twist, base.twist, -90, 90),
    duration: num(r.duration, base.duration, 0.05, 60),
    loop: typeof r.loop === 'boolean' ? r.loop : base.loop,
  };
}

const deg = (key: keyof AnimPreset, label: string, doc: string, def: number, max: number, tier: VariableDef['tier'] = 'play'): VariableDef =>
  ({ key, type: 'number', label, doc, tier, default: def, min: -max, max, step: 1, unit: 'deg', hardMin: -180, hardMax: 180, group: 'Moves' });
/** The knobs of an animation preset (the `animation` preset kind). */
export const ANIM_VARIABLES: readonly VariableDef[] = [
  { key: 'style', type: 'enum', label: 'Kind of move', doc: 'What the move is: a walk, a run, a jump, a wave ...', tier: 'build', default: 'walk', options: ANIM_STYLES, group: 'Move' },
  { key: 'cadence', type: 'number', label: 'Speed', doc: 'How many times a second the move repeats (a walk cycle is two steps).', tier: 'play', default: 1, min: 0, max: 4, step: 0.05, hardMin: 0, hardMax: 20, unit: 'per s', group: 'Move' },
  deg('legSwing', 'Leg swing', 'How far the legs swing.', 30, 80),
  deg('armSwing', 'Arm swing', 'How far the arms swing.', 25, 120),
  deg('armRaise', 'Arms up', 'How high the arms are held.', 0, 170),
  { key: 'bob', type: 'number', label: 'Bounce', doc: 'How much the body bobs up and down.', tier: 'play', default: 0.02, min: 0, max: 0.15, step: 0.005, hardMin: 0, hardMax: 1, group: 'Moves' },
  deg('lean', 'Lean', 'How far the body leans forward.', 4, 45),
  deg('headNod', 'Head nod', 'How much the head nods.', 3, 30, 'build'),
  deg('sway', 'Sway', 'How much the body rocks side to side.', 3, 30, 'build'),
  deg('twist', 'Twist', 'How much the shoulders twist.', 6, 45, 'build'),
  { key: 'duration', type: 'number', label: 'Length', doc: 'How long a one-off move lasts.', tier: 'build', default: 1, min: 0.1, max: 5, step: 0.05, hardMin: 0.05, hardMax: 60, unit: 's', group: 'Move' },
  { key: 'loop', type: 'boolean', label: 'Repeat', doc: 'Repeats forever, or plays once.', tier: 'build', default: true, group: 'Move' },
];
export const animToParams = (p: AnimPreset): Record<string, number | string | boolean> => ({
  style: p.style, cadence: p.cadence, legSwing: p.legSwing, armSwing: p.armSwing, armRaise: p.armRaise, bob: p.bob, lean: p.lean, headNod: p.headNod, sway: p.sway,
  twist: p.twist, duration: p.duration, loop: p.loop,
});

/* ----------------------------------------------------------------- poses */

const ease = (u: number): number => { const c = Math.min(1, Math.max(0, u)); return c * c * (3 - 2 * c); };
/** 0 at both ends, 1 in the middle of a one-off move: how strongly it shows. */
const envelope = (u: number): number => Math.sin(Math.PI * Math.min(1, Math.max(0, u)));

/**
 * The pose of a preset `t` seconds after it started. `pace` scales the cadence (a walk at half speed steps half as often).
 */
export function poseAt(p: AnimPreset, t: number, pace = 1): Pose {
  const out = restPose();
  const time = Number.isFinite(t) ? Math.max(0, t) : 0;
  const k = Number.isFinite(pace) ? Math.max(0, pace) : 1;
  const ph = time * p.cadence * k * Math.PI * 2;
  const s = Math.sin(ph), c2 = (1 - Math.cos(2 * ph)) / 2;
  const B = out.bones;
  const leg = p.legSwing * D2R, arm = p.armSwing * D2R, raise = p.armRaise * D2R;
  const u = p.loop ? 0 : time / Math.max(0.05, p.duration);
  const env = p.loop ? 1 : envelope(u);
  switch (p.style) {
    case 'idle':
      out.lift = p.bob * (0.5 - 0.5 * Math.cos(ph));
      B.armL.rz = B.armR.rz = arm * 0.5 * (0.5 - 0.5 * Math.cos(ph));
      B.head.rx = p.headNod * D2R * Math.sin(ph + 0.6);
      B.body.rz = p.sway * D2R * Math.sin(ph * 0.5);
      break;
    case 'walk': case 'run': case 'waddle': {
      B.legL.rx = leg * s; B.legR.rx = -leg * s;
      B.armL.rx = -arm * s; B.armR.rx = arm * s;
      B.armL.rz = B.armR.rz = raise * 0.25;
      if (p.armRaise > 0) { B.armL.rx += raise * 0.35; B.armR.rx += raise * 0.35; }
      out.lift = p.bob * c2;
      out.lean = p.lean * D2R;
      B.head.rx = p.headNod * D2R * Math.sin(2 * ph) - out.lean * 0.5;
      B.body.rz = p.sway * D2R * s;
      B.body.ry = p.twist * D2R * s;
      break;
    }
    case 'jump': {
      // crouch, spring, tuck: arms go up as the legs fold
      B.armL.rx = B.armR.rx = raise * env;
      B.armL.rz = B.armR.rz = arm * env;
      B.legL.rx = B.legR.rx = leg * env;
      out.lean = p.lean * D2R * env;
      out.lift = p.bob * env;
      break;
    }
    case 'fall':
      B.armL.rz = B.armR.rz = raise + arm * 0.2 * s;
      B.legL.rx = leg * s; B.legR.rx = -leg * s;
      out.lean = p.lean * D2R;
      break;
    case 'swing': {
      // wind up (arm raised overhead), strike down past the hip, return
      const up = ease(u / 0.35), down = ease((u - 0.35) / 0.35), back = ease((u - 0.7) / 0.3);
      B.armR.rx = raise * up * (1 - down) - arm * 0.3 * down * (1 - back);
      B.body.ry = -p.twist * D2R * up * (1 - down) + p.twist * D2R * down * (1 - back);
      out.lean = p.lean * D2R * down * (1 - back);
      break;
    }
    case 'wave':
      B.armR.rz = raise * env;
      B.armR.rx = arm * 0.3 * Math.sin(ph) * env;
      B.head.rz = p.headNod * D2R * Math.sin(ph * 0.5) * env;
      B.body.rz = p.sway * D2R * Math.sin(ph * 0.5) * env;
      break;
    case 'dance':
      out.lift = p.bob * c2 * env;
      B.armL.rz = raise * (0.5 + 0.5 * s) * env; B.armR.rz = raise * (0.5 - 0.5 * s) * env;
      B.armL.rx = arm * Math.max(0, s) * env; B.armR.rx = arm * Math.max(0, -s) * env;
      B.legL.rx = leg * Math.max(0, s) * env; B.legR.rx = leg * Math.max(0, -s) * env;
      B.body.rz = p.sway * D2R * s * env;
      B.body.ry = p.twist * D2R * Math.sin(ph * 0.5) * env;
      B.head.rx = p.headNod * D2R * Math.sin(2 * ph) * env;
      break;
    case 'cheer':
      B.armL.rz = B.armR.rz = raise * env;
      B.armL.rx = B.armR.rx = arm * 0.3 * (0.5 + 0.5 * s) * env;
      out.lift = p.bob * (0.5 + 0.5 * s) * env;
      B.head.rx = -p.headNod * D2R * env;
      break;
  }
  return out;
}

/** Blend two poses: w = 0 is a, 1 is b. */
export function blendPose(a: Pose, b: Pose, w: number): Pose {
  const k = Number.isFinite(w) ? Math.min(1, Math.max(0, w)) : 0;
  const out = restPose();
  for (const bone of BONES) {
    const x = a.bones[bone], y = b.bones[bone];
    out.bones[bone] = { rx: x.rx + (y.rx - x.rx) * k, ry: x.ry + (y.ry - x.ry) * k, rz: x.rz + (y.rz - x.rz) * k };
  }
  out.lift = a.lift + (b.lift - a.lift) * k;
  out.lean = a.lean + (b.lean - a.lean) * k;
  return out;
}

/** Whether a one-off move has finished `t` seconds after it started. */
export const finished = (p: AnimPreset, t: number): boolean => !p.loop && t >= p.duration;

/* ----------------------------------------------------------------- the animator */

/** Which preset plays for each way of moving. Each slot is an animation preset the player can swap or edit. */
export interface MoveSet { idle: AnimPreset; walk: AnimPreset; run: AnimPreset; jump: AnimPreset; fall: AnimPreset }
export const DEFAULT_MOVES: MoveSet = { idle: animById('idle'), walk: animById('walk'), run: animById('run'), jump: animById('jump'), fall: animById('fall') };
export type MoveSlot = keyof MoveSet;
export const MOVE_SLOTS: readonly MoveSlot[] = ['idle', 'walk', 'run', 'jump', 'fall'];

export interface Motion {
  /** Ground speed in metres per second. */
  speed: number;
  grounded: boolean;
  /** Vertical speed (up is +). */
  vy: number;
}

/** Walking speed that matches the walk preset's cadence; the run's reference is `runSpeed`. */
export interface AnimatorOptions { walkSpeed: number; runSpeed: number; fadeSeconds: number }
const DEFAULT_OPTIONS: AnimatorOptions = { walkSpeed: 3.6, runSpeed: 8, fadeSeconds: 0.18 };

/**
 * Picks a move from how the character moves, fades between moves, keeps each move's own clock, and plays one-off moves (emotes, tool
 * swings) on top until they end or the character starts moving (a swing plays while walking: it only owns the arms and the body twist).
 */
export class Animator {
  private moves: MoveSet;
  private readonly opts: AnimatorOptions;
  private current: MoveSlot = 'idle';
  private previous: MoveSlot | null = null;
  private fade = 1;
  private clocks: Record<MoveSlot, number> = { idle: 0, walk: 0, run: 0, jump: 0, fall: 0 };
  private oneOff: { preset: AnimPreset; t: number } | null = null;
  private airTime = 0;

  constructor(moves: MoveSet = DEFAULT_MOVES, opts: Partial<AnimatorOptions> = {}) {
    this.moves = moves;
    this.opts = { ...DEFAULT_OPTIONS, ...opts };
  }

  setMoves(moves: MoveSet): void { this.moves = moves; }
  get slot(): MoveSlot { return this.current; }
  get playing(): AnimPreset | null { return this.oneOff?.preset ?? null; }

  /** Play a one-off move (a wave, a dance, a tool swing). A looping preset plays for its duration. */
  play(p: AnimPreset): void { this.oneOff = { preset: p, t: 0 }; }
  stop(): void { this.oneOff = null; }

  private choose(m: Motion): MoveSlot {
    if (!m.grounded) return m.vy > 0.5 && this.airTime < 0.6 ? 'jump' : 'fall';
    if (m.speed > (this.opts.walkSpeed + this.opts.runSpeed) / 2) return 'run';
    if (m.speed > 0.4) return 'walk';
    return 'idle';
  }

  /** Advance by dt seconds and return the pose. */
  update(dt: number, m: Motion): Pose {
    const step = Number.isFinite(dt) ? Math.min(0.25, Math.max(0, dt)) : 0;
    this.airTime = m.grounded ? 0 : this.airTime + step;
    const want = this.choose(m);
    if (want !== this.current) {
      this.previous = this.current;
      this.current = want;
      this.fade = 0;
      if (want === 'jump') this.clocks.jump = 0;
    }
    this.fade = Math.min(1, this.fade + step / Math.max(0.01, this.opts.fadeSeconds));
    const pace = (slot: MoveSlot): number =>
      slot === 'walk' ? Math.max(0.5, Math.min(1.6, m.speed / this.opts.walkSpeed)) : slot === 'run' ? Math.max(0.6, Math.min(1.6, m.speed / this.opts.runSpeed)) : 1;
    for (const slot of MOVE_SLOTS) this.clocks[slot] += step;
    const pose = (slot: MoveSlot): Pose => poseAt(this.moves[slot], this.clocks[slot], pace(slot));
    let out = this.previous && this.fade < 1 ? blendPose(pose(this.previous), pose(this.current), this.fade) : pose(this.current);
    if (this.oneOff) {
      this.oneOff.t += step;
      const o = this.oneOff;
      const done = o.preset.loop ? o.t >= o.preset.duration : finished(o.preset, o.t);
      const moving = m.speed > 0.4 || !m.grounded;
      if (done || (moving && o.preset.style !== 'swing')) this.oneOff = null;
      else {
        const top = poseAt(o.preset, o.t);
        // fade the one-off in and out over its first and last tenth
        const w = Math.min(1, o.t / 0.1, (o.preset.duration - o.t) / 0.1);
        if (o.preset.style === 'swing') {
          out = { ...out, bones: { ...out.bones, armR: blendPose(out, top, w).bones.armR, body: { ...out.bones.body, ry: out.bones.body.ry + top.bones.body.ry * w } } };
        } else out = blendPose(out, top, w);
      }
    }
    return out;
  }
}

/* ----------------------------------------------------------------- previews */

export interface Segment { x1: number; y1: number; x2: number; y2: number; bone: Bone | 'neck' }
/**
 * A stick figure seen from the side, in a 0..1 box (y down), for a preset preview: hips at the middle, head on top. Pure, so a preview can be
 * drawn as a few SVG lines and animated cheaply.
 */
export function stickFigure(pose: Pose): { segments: Segment[]; head: { x: number; y: number; r: number } } {
  const hipY = 0.6 - pose.lift * 2, hipX = 0.5;
  const lean = pose.lean + pose.bones.body.rx;
  const spineLen = 0.24, legLen = 0.3, armLen = 0.24;
  const neckX = hipX + Math.sin(lean) * spineLen, neckY = hipY - Math.cos(lean) * spineLen;
  const limb = (x: number, y: number, ang: number, len: number): [number, number] => [x + Math.sin(ang) * len, y + Math.cos(ang) * len];
  const B = pose.bones;
  const segs: Segment[] = [{ x1: hipX, y1: hipY, x2: neckX, y2: neckY, bone: 'body' }];
  const [lx, ly] = limb(hipX, hipY, B.legL.rx, legLen), [rx, ry] = limb(hipX, hipY, B.legR.rx, legLen);
  segs.push({ x1: hipX, y1: hipY, x2: lx, y2: ly, bone: 'legL' }, { x1: hipX, y1: hipY, x2: rx, y2: ry, bone: 'legR' });
  // seen from the side, an arm raised out sideways (rz) points up or down by cos(rz); rx swings that forward
  const arm = (bp: BonePose): [number, number] => { const cz = Math.cos(bp.rz), ang = bp.rx + lean; return [neckX + Math.sin(ang) * cz * armLen, neckY + 0.02 + Math.cos(ang) * cz * armLen]; };
  const [alx, aly] = arm(B.armL);
  const [arx, ary] = arm(B.armR);
  segs.push({ x1: neckX, y1: neckY + 0.02, x2: alx, y2: aly, bone: 'armL' }, { x1: neckX, y1: neckY + 0.02, x2: arx, y2: ary, bone: 'armR' });
  const headAng = lean + B.head.rx;
  return { segments: segs, head: { x: neckX + Math.sin(headAng) * 0.08, y: neckY - Math.cos(headAng) * 0.08, r: 0.07 } };
}
