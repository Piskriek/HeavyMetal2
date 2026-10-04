import { ParticleSystem, presetById, type EmitterSpec, type Vec3 } from '@hm/particles';

/**
 * The island's placed effects, running (the Effects tab, F12). Two particle systems, one that glows (additive: fire, sparks) and one that
 * does not (smoke, snow); each placed effect is an emitter in the right one. `sync` follows the island's list (new ones start, gone ones
 * stop, moved ones follow, changed ones restart); burst-only effects (a firework, a splash) go off again every few seconds so a placed one
 * stays alive. `once` plays an effect a single time.
 */
export interface PlacedEffect { readonly ref: string; readonly preset: string; readonly x: number; readonly y: number; readonly z: number; readonly scale: number; readonly on: boolean }
interface Running { sys: ParticleSystem; handle: number; key: string; spec: EmitterSpec; pos: Vec3; again: number }

const REPEAT_S = 2.6;

/** A preset made bigger or smaller: wider spread, faster, bigger particles. */
export function scaled(spec: EmitterSpec, s: number): EmitterSpec {
  const k = Math.min(5, Math.max(0.2, s));
  return { ...spec, speed: [spec.speed[0] * k, spec.speed[1] * k], size: [spec.size[0] * k, spec.size[1] * k], area: [spec.area[0] * k, spec.area[1] * k, spec.area[2] * k], gravity: spec.gravity * k };
}

export class EffectsRuntime {
  readonly glow: ParticleSystem;
  readonly plain: ParticleSystem;
  private readonly running = new Map<string, Running>();
  private seed = 1;
  private time = 0;

  constructor(cap: number) { this.glow = new ParticleSystem(cap); this.plain = new ParticleSystem(cap); }

  private start(spec: EmitterSpec, pos: Vec3): { sys: ParticleSystem; handle: number } {
    const sys = spec.additive ? this.glow : this.plain;
    return { sys, handle: sys.spawn(spec, pos, (this.seed = (this.seed * 1103515245 + 12345) >>> 0)) };
  }

  sync(list: readonly PlacedEffect[]): void {
    const seen = new Set<string>();
    for (const e of list) {
      if (!e.on) continue;
      const base = presetById(e.preset);
      if (!base) continue;
      seen.add(e.ref);
      const key = `${e.preset}|${e.scale}`, pos: Vec3 = [e.x, e.y, e.z];
      const r = this.running.get(e.ref);
      if (r && r.key === key) {
        if (r.pos[0] !== e.x || r.pos[1] !== e.y || r.pos[2] !== e.z) { r.sys.move(r.handle, pos); r.pos = pos; }
        continue;
      }
      if (r) r.sys.stop(r.handle);
      const spec = scaled(base, e.scale);
      const s = this.start(spec, pos);
      this.running.set(e.ref, { ...s, key, spec, pos, again: this.time + REPEAT_S });
    }
    for (const [ref, r] of this.running) if (!seen.has(ref)) { r.sys.stop(r.handle); this.running.delete(ref); }
  }

  /** Play an effect once where you point (nothing is kept). */
  once(preset: string, pos: Vec3, scale = 1): boolean {
    const base = presetById(preset);
    if (!base) return false;
    const spec = scaled(base, scale);
    const s = this.start(base.rate > 0 ? { ...spec, duration: spec.duration > 0 ? spec.duration : 1.2 } : spec, pos);
    if (base.rate > 0 && spec.duration <= 0) {
      // a stream (a campfire) played once: stop it after a moment, its particles finish their life
      const stopAt = this.time + 1.2;
      this.later.push({ at: stopAt, sys: s.sys, handle: s.handle });
    }
    return true;
  }
  private later: { at: number; sys: ParticleSystem; handle: number }[] = [];

  step(dt: number): void {
    const d = Math.min(0.1, Math.max(0, dt));
    this.time += d;
    for (const r of this.running.values()) {
      if (r.spec.rate === 0 && this.time >= r.again) { const s = this.start(r.spec, r.pos); r.sys = s.sys; r.handle = s.handle; r.again = this.time + REPEAT_S; }
    }
    this.later = this.later.filter((l) => { if (this.time < l.at) return true; l.sys.stop(l.handle); return false; });
    this.glow.step(d);
    this.plain.step(d);
  }

  get count(): number { return this.glow.count + this.plain.count; }
}
