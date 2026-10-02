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
  const finishedEmitted = (world: RacerWorld, id: number): boolean => world.get(id, 'race')?.['finished'] === true;

  function update(world: RacerWorld, ctx: StepContext): void {
    const ids = world.query('racer', 'race', 'transform', 'velocity', 'body');
    const n = ids.length;
    const dt = ctx.dt;
    const progress = new Map<number, number>();

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
        c = { steer: clamp(num0(ai.steer), -1, 1), throttle: clamp(num0(ai.throttle) * deps.rubberBand(prevPlace, n), 0, 1), brake: 0, use: false };
      } else {
        const a = ctx.input.actors[String(r?.['actor'] ?? '')] ?? {};
        c = { steer: clamp(num0(a['steer'] ?? 0), -1, 1), throttle: clamp(num0(a['throttle'] ?? 0), 0, 1), brake: clamp(num0(a['brake'] ?? 0), 0, 1), use: a['item'] === true };
      }
      if (wasFinished) { c.throttle = 0; c.brake = 0.3; }

      // 3. heading
      const turnRate = 2.4 * (1 - 0.5 * Math.min(1, phys.maxSpeed > 0 ? speed / phys.maxSpeed : 1));
      [hx, hz] = rotate(hx, hz, c.steer * turnRate * dt);

      // 4. thrust
      const boosting = boostMs > 0;
      const cap = phys.maxSpeed * (boosting ? 1.35 : 1);
      const forward = vx * hx + vz * hz;
      if (c.throttle > 0 && forward < cap) {
        const F = phys.acceleration * phys.mass * c.throttle * (boosting ? 2 : 1);
        deps.physics.applyForce(id, [hx * F, 0, hz * F]);
      }

      // 5. brake
      if (c.brake > 0 && speed > 0.1) {
        const m = Math.min(phys.mass * 25 * c.brake, (phys.mass * speed) / dt);
        deps.physics.applyForce(id, [(-vx / speed) * m, 0, (-vz / speed) * m]);
      }

      // 6. lateral grip
      const latx = vx - hx * forward, latz = vz - hz * forward;
      const k = phys.mass * Math.min(1, phys.grip * 6 * dt);
      if ((latx !== 0 || latz !== 0) && k !== 0) deps.physics.applyImpulse(id, [-latx * k, 0, -latz * k]);

      // 7. boost timer
      boostMs = Math.max(0, boostMs - dt * 1000);

      // 8. items (edge triggered)
      let item = typeof r?.['item'] === 'string' ? r['item'] : '';
      const fired = c.use && !(prevUse.get(id) ?? false);
      prevUse.set(id, c.use);
      if (fired && item !== '') {
        const def = deps.itemById(item);
        if (def?.id === 'boost') boostMs = def.durationMs;
        else if (def?.id === 'jump') deps.physics.applyImpulse(id, [0, phys.mass * 6, 0]);
        ctx.events.emit('item:used', { entity: id, item, kind: def?.kind ?? 'self' });
        item = '';
      }
      world.set(id, 'racer', { hx, hz, boostMs, item });

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
