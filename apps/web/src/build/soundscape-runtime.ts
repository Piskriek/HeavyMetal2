import type { AudioEngine } from '@hm/audio';
import { isAmbience } from '@hm/buildkit';
import { AMBIENCES, mixAt, type Emitter, type Zone } from '@hm/soundscape';

/**
 * The island's placed sounds, playing (the Sound tab, F5). A placed ambience is a zone: a box round its spot, full inside and fading out
 * over its edge, played as a live synth bed (the beds of every zone you hear are mixed so they never add up past full). A placed sound
 * repeats from its spot every few seconds, as loud as the distance allows. Runs ten times a second, not every frame.
 */
export interface PlacedSound { readonly ref: string; readonly what: string; readonly x: number; readonly y: number; readonly z: number; readonly size: number; readonly volume: number; readonly every: number; readonly on: boolean }

/** How a placed spot is heard: an ambience zone or a sound emitter (pure: tests and the overlay use it too). */
export function zoneOf(s: PlacedSound): Zone {
  return { id: s.ref, centre: [s.x, s.y, s.z], half: [s.size, s.size * 0.6, s.size], fade: s.size * 0.75, ambience: s.what, volume: s.volume };
}
export function emitterOf(s: PlacedSound): Emitter {
  return { id: s.ref, pos: [s.x, s.y, s.z], sound: s.what, volume: s.volume, radius: s.size * 0.25, falloff: s.size, loop: true };
}

const BED_LEVEL = 0.55;
const TICK_S = 0.1;

export class SoundscapeRuntime {
  private readonly next = new Map<string, number>();
  private beds = new Set<string>();
  private clock = 0;
  private sinceTick = TICK_S;

  /** Each frame: where the listener is and faces, the island's placed sounds, the audio engine (null while sound is off), how to play a one-shot. */
  update(dt: number, listener: [number, number, number], yawDeg: number, placed: readonly PlacedSound[], engine: AudioEngine | null, play: (sound: string, volume: number) => void): void {
    this.clock += dt;
    this.sinceTick += dt;
    if (this.sinceTick < TICK_S) return;
    this.sinceTick = 0;
    const on = placed.filter((p) => p.on && p.volume > 0);
    const zones = on.filter((p) => isAmbience(p.what)).map(zoneOf);
    const emitters = on.filter((p) => !isAmbience(p.what)).map(emitterOf);
    const mix = mixAt(listener, yawDeg, emitters, zones, 6);
    const live = new Set<string>();
    for (const b of mix.beds) {
      const amb = AMBIENCES.find((a) => a.id === b.ambience);
      if (!amb || !engine) continue;
      engine.setBed(b.ambience, amb.layers, b.gain * BED_LEVEL);
      live.add(b.ambience);
    }
    for (const id of this.beds) if (!live.has(id)) { const amb = AMBIENCES.find((a) => a.id === id); if (amb) engine?.setBed(id, amb.layers, 0); }
    this.beds = live;
    for (const v of mix.voices) {
      const spot = on.find((p) => p.ref === v.id);
      if (!spot) continue;
      const due = this.next.get(v.id) ?? this.clock;
      if (this.clock >= due && v.gain > 0.03) { play(v.sound, v.gain); this.next.set(v.id, this.clock + Math.max(0.5, spot.every)); }
    }
    for (const id of [...this.next.keys()]) if (!on.some((p) => p.ref === id)) this.next.delete(id);
  }

  /** Leaving the island: every bed fades out. */
  stop(engine: AudioEngine | null): void {
    for (const id of this.beds) { const amb = AMBIENCES.find((a) => a.id === id); if (amb) engine?.setBed(id, amb.layers, 0); }
    this.beds.clear();
  }
}
