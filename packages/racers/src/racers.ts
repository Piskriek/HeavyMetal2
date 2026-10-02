import type { LapTrackerLike, RacerDeps, RacerWorld, StepContext, System } from './types';
import { clamp, finite, num0, rotate } from './math';

export { defineRacerComponents, grantItem } from './components';

export const RACER_SYSTEM_ORDER = 60;

interface Controls { steer: number; throttle: number; brake: number; use: boolean }

/**
 * Creates the 'racers' system.
 * NOTE (snapshot restore): the closure holds NO state other than two per-entity Maps
 * (lap trackers and previous-tick item button). Everything else lives in world components,
 * so after restoring a snapshot the system can simply be rebuilt with createRacerSystem().
 */
export function createRacerSystem(deps: RacerDeps): System {
  const trackers = new Map<number, LapTrackerLike>();
  const prevUse = new Map<number, boolean>();
  /** Oil slicks on the road. Short-lived hazards, so they are not part of the saved world; a rebuilt system starts clean. */
  let slicks: { x: number; z: number; r: number; ttlMs: number }[] = [];
  const finishedEmitted = (world: RacerWorld, id: number): boolean => world.get(id, 'race')?.['finished'] === true;

  function update(world: RacerWorld, ctx: StepContext): void {
    const ids = world.query('racer', 'race', 'transform', 'velocity', 'body');
    const n = ids.length;
    const dt = ctx.dt;
    const progress = new Map<number, number>();
    slicks = slicks.map((s) => ({ ...s, ttlMs: s.ttlMs - dt * 1000 })).filter((s) => s.ttlMs > 0);

    for (const id of ids) {
      const r = world.get(id, 'racer');
      const race = world.get(id, 'race');
      const tr = world.get(id, 'transform');
      const ve = world.get(id, 'velocity');
      const weight = finite(r, id, 'racer', 'weight');
      const speedStat = finite(r, id, 'racer', 'speed');
      const bounce = finite(r, id, 'racer', 'bounce');
      const skill = finite(r, id, 'racer', 'skill');
      let hx = finite(r, id, 'racer', 'hx');
      let hz = finite(r, id, 'racer', 'hz');
      let boostMs = finite(r, id, 'racer', 'boostMs');
      let freezeMs = Math.max(0, num0(r?.['freezeMs'])), slowMs = Math.max(0, num0(r?.['slowMs'])), shieldMs = Math.max(0, num0(r?.['shieldMs']));
      let draftMs = Math.max(0, num0(r?.['draftMs'])), ghostMs = Math.max(0, num0(r?.['ghostMs']));
      const immune = shieldMs > 0 || ghostMs > 0;
      const x = finite(tr, id, 'transform', 'x');
      finite(tr, id, 'transform', 'y');
      const z = finite(tr, id, 'transform', 'z');
      const vx = finite(ve, id, 'velocity', 'vx');
      finite(ve, id, 'velocity', 'vy');
      const vz = finite(ve, id, 'velocity', 'vz');

      // 1. physics
      const phys = deps.derivePhysics({ weight, speed: speedStat, bounce });
      const speed = Math.sqrt(vx * vx + vz * vz);
      const prevPlace = typeof race?.['place'] === 'number' && race['place'] > 0 ? race['place'] : 1;
      const wasFinished = race?.['finished'] === true;

      // 2. controls
      let c: Controls;
      if (r?.['controller'] === 'ai') {
        const ai = deps.aiControl(deps.track, { x, z, hx, hz, speed },
          { lookahead: 12 + 18 * skill, cornerCare: 0.4 + 0.6 * skill, noise: 1 - skill }, () => ctx.rng.next());
        c = { steer: clamp(num0(ai.steer), -1, 1), throttle: clamp(num0(ai.throttle) * deps.rubberBand(prevPlace, n), 0, 1), brake: 0, use: typeof r?.['item'] === 'string' && r['item'] !== '' && ctx.rng.next() < 0.012 };
      } else {
        const a = ctx.input.actors[String(r?.['actor'] ?? '')] ?? {};
        c = { steer: clamp(num0(a['steer'] ?? 0), -1, 1), throttle: clamp(num0(a['throttle'] ?? 0), 0, 1), brake: clamp(num0(a['brake'] ?? 0), 0, 1), use: a['item'] === true };
      }
      if (wasFinished) { c.throttle = 0; c.brake = 0.3; }
      if (!immune) for (const s of slicks) if ((x - s.x) ** 2 + (z - s.z) ** 2 < s.r * s.r) slowMs = Math.max(slowMs, 1300);
      if (freezeMs > 0) { c.steer = 0; c.throttle = 0; c.brake = 0.9; c.use = false; }
      if (slowMs > 0) c.throttle *= 0.6;

      // 3. heading
      const turnRate = 2.4 * (1 - 0.5 * Math.min(1, phys.maxSpeed > 0 ? speed / phys.maxSpeed : 1));
      [hx, hz] = rotate(hx, hz, c.steer * turnRate * dt);

      // 4. thrust
      const boosting = boostMs > 0;
      const cap = phys.maxSpeed * (boosting ? 1.35 : 1) * (draftMs > 0 ? 1.12 : 1) * (ghostMs > 0 ? 1.08 : 1);
      const forward = vx * hx + vz * hz;
      if (c.throttle > 0 && forward < cap) {
        const F = phys.acceleration * phys.mass * c.throttle * (boosting ? 2 : 1) * (draftMs > 0 ? 1.35 : 1);
        deps.physics.applyForce(id, [hx * F, 0, hz * F]);
      }

      // 5. brake
      if (c.brake > 0 && speed > 0.1) {
        const m = Math.min(phys.mass * 25 * c.brake, (phys.mass * speed) / dt);
        deps.physics.applyForce(id, [(-vx / speed) * m, 0, (-vz / speed) * m]);
      }

      // 6. lateral grip
      const latx = vx - hx * forward, latz = vz - hz * forward;
      const gripMul = slowMs > 0 ? 0.12 : shieldMs > 0 ? 1.5 : 1;
      const k = phys.mass * Math.min(1, phys.grip * gripMul * 6 * dt);
      if ((latx !== 0 || latz !== 0) && k !== 0) deps.physics.applyImpulse(id, [-latx * k, 0, -latz * k]);

      // 7. boost timer
      boostMs = Math.max(0, boostMs - dt * 1000);
      freezeMs = Math.max(0, freezeMs - dt * 1000); slowMs = Math.max(0, slowMs - dt * 1000); shieldMs = Math.max(0, shieldMs - dt * 1000);
      draftMs = Math.max(0, draftMs - dt * 1000); ghostMs = Math.max(0, ghostMs - dt * 1000);

      // 8. items (edge triggered)
      let item = typeof r?.['item'] === 'string' ? r['item'] : '';
      const fired = c.use && !(prevUse.get(id) ?? false);
      prevUse.set(id, c.use);
      if (fired && item !== '') {
        const def = deps.itemById(item);
        if (def?.id === 'boost') boostMs = def.durationMs;
        else if (def?.id === 'jump') deps.physics.applyImpulse(id, [0, phys.mass * 6, 0]);
        else if (def?.id === 'mass') shieldMs = def.durationMs;
        else if (def?.id === 'slipstream') draftMs = def.durationMs;
        else if (def?.id === 'ghost') ghostMs = def.durationMs;
        else if (def?.id === 'oil') {
          const s = { x: x - hx * 6, z: z - hz * 6, r: 4.5, ttlMs: def.durationMs };
          slicks.push(s);
          ctx.events.emit('hazard:oil', { x: s.x, z: s.z, r: s.r, ttlMs: s.ttlMs });
        } else if (def?.id === 'shockwave' || def?.id === 'freeze') {
          const reach = def.id === 'shockwave' ? 22 : 30;
          for (const other of ids) {
            if (other === id) continue;
            const ot = world.get(other, 'transform'), orc = world.get(other, 'racer');
            if (!ot || !orc || num0(orc['shieldMs']) > 0 || num0(orc['ghostMs']) > 0) continue;
            const dx = num0(ot['x']) - x, dz = num0(ot['z']) - z, d = Math.sqrt(dx * dx + dz * dz);
            if (d > reach) continue;
            if (def.id === 'freeze') world.set(other, 'racer', { freezeMs: 1800 });
            else {
              const m = deps.derivePhysics({ weight: num0(orc['weight']), speed: num0(orc['speed']), bounce: num0(orc['bounce']) }).mass;
              const k2 = d > 0.01 ? 1 / d : 0;
              deps.physics.applyImpulse(other, [dx * k2 * m * 9 * (1 - d / reach * 0.6), m * 3.5, dz * k2 * m * 9 * (1 - d / reach * 0.6)]);
            }
          }
          ctx.events.emit('hazard:' + def.id, { x, z, r: reach });
        }
        ctx.events.emit('item:used', { entity: id, item, kind: def?.kind ?? 'self' });
        item = '';
      }
      world.set(id, 'racer', { hx, hz, boostMs, item, freezeMs, slowMs, shieldMs, draftMs, ghostMs });

      // 9. laps
      let tracker = trackers.get(id);
      if (!tracker) { tracker = deps.createLapTracker(deps.track, deps.laps); trackers.set(id, tracker); }
      const st = tracker.update([x, z]);
      const alreadyDone = finishedEmitted(world, id);
      world.set(id, 'race', { lap: st.lap, progress: st.progress, finished: st.finished });
      if (st.lapCompleted) ctx.events.emit('lap:completed', { entity: id, lap: st.lap });
      if (st.finished && !alreadyDone) ctx.events.emit('racer:finished', { entity: id, place: prevPlace });
      progress.set(id, st.progress);
    }

    // 10. positions
    if (n === 0) return;
    const ranks = deps.rankRacers(ids.map((id) => ({ id: String(id), progress: progress.get(id) ?? 0 })));
    for (const rk of ranks) {
      const id = Number(rk.id);
      if (progress.has(id)) world.set(id, 'race', { place: rk.position });
    }
  }

  return { name: 'racers', order: RACER_SYSTEM_ORDER, update };
}
