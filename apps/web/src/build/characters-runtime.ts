import type { CharBrain } from '@hm/buildkit';
import { newBrain, think, type Agent, type Behaviour, type Brain, type Vec3 } from '@hm/npcbrain';

/**
 * The island's characters, going about (the Characters tab, F9): each placed goblin gets a brain (@hm/npcbrain) for its behaviour and walks
 * on the ground, never into the sea. Only for show: where they walk is never saved, a character always starts at the spot it was put.
 */
export interface PlacedChar { readonly ref: string; readonly brain: CharBrain; readonly x: number; readonly y: number; readonly z: number; readonly yaw: number }
export interface CharPose { readonly ref: string; readonly x: number; readonly y: number; readonly z: number; readonly yaw: number; readonly moving: boolean }
interface Live { key: string; brain: Brain; agent: Agent; behaviour: Behaviour; time: number }

const hash = (s: string): number => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };

/** What each palette behaviour means to the brain (pure). */
export function behaviourOf(c: PlacedChar): Behaviour {
  const home: Vec3 = [c.x, c.y, c.z];
  switch (c.brain) {
    case 'wander': return { kind: 'wander', home, radius: 5, seed: hash(c.ref) };
    case 'patrol': return { kind: 'patrol', points: [[c.x + 2, c.y, c.z + 2], [c.x - 2, c.y, c.z + 2], [c.x - 2, c.y, c.z - 2], [c.x + 2, c.y, c.z - 2]], mode: 'loop', wait: 1 };
    case 'follow': return { kind: 'follow', distance: 2.5 };
    case 'chase': return { kind: 'chase' };
    case 'flee': return { kind: 'flee' };
    case 'stand': return { kind: 'stand' };
  }
}

export class CharactersRuntime {
  private readonly live = new Map<string, Live>();

  /**
   * One frame: think for every character and walk it. `ground` gives the height to stand on, or null where it may not go (the sea).
   * Returns where each one is now, in the order given.
   */
  step(dt: number, list: readonly PlacedChar[], player: Vec3, ground: (x: number, z: number) => number | null): CharPose[] {
    const d = Math.min(0.1, Math.max(0, dt));
    const out: CharPose[] = [];
    const seen = new Set<string>();
    for (const c of list) {
      seen.add(c.ref);
      const key = `${c.brain}|${c.x}|${c.y}|${c.z}`;
      let l = this.live.get(c.ref);
      if (!l || l.key !== key) {
        const behaviour = behaviourOf(c);
        l = { key, behaviour, brain: newBrain(behaviour), agent: { pos: [c.x, c.y, c.z], yaw: c.yaw, speed: c.brain === 'chase' || c.brain === 'flee' ? 2.6 : 1.6, sight: 12, reaction: 0.4 }, time: 0 };
        this.live.set(c.ref, l);
      }
      l.time += d;
      const s = think(l.agent, l.behaviour, l.brain, player, d);
      l.brain = s.brain;
      const g = ground(s.pos[0], s.pos[2]);
      let moving = s.moving;
      if (g === null) moving = false; // the sea: stay on the shore
      else l.agent = { ...l.agent, pos: [s.pos[0], g, s.pos[2]] };
      let yaw = moving ? s.yaw : l.agent.yaw;
      // standing still it turns to look at you when you are near
      if (c.brain === 'stand') {
        const dx = player[0] - l.agent.pos[0], dz = player[2] - l.agent.pos[2];
        if (Math.hypot(dx, dz) < 8) { const want = (Math.atan2(dx, dz) * 180) / Math.PI; const diff = ((want - yaw + 540) % 360) - 180; yaw += diff * Math.min(1, d * 4); }
      }
      l.agent = { ...l.agent, yaw };
      // a little hop in its step
      const bob = moving ? Math.abs(Math.sin(l.time * 9)) * 0.08 : 0;
      out.push({ ref: c.ref, x: l.agent.pos[0], y: l.agent.pos[1] + bob, z: l.agent.pos[2], yaw, moving });
    }
    for (const ref of [...this.live.keys()]) if (!seen.has(ref)) this.live.delete(ref);
    return out;
  }
}
