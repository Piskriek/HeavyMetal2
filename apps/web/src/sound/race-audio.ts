import type { RaceGame } from '@hm/game';
import { musicPattern, patternDurationSec, rollParams, type Surface } from '@hm/audio';
import { engineParamsFor } from '@hm/soundlab';
import { heightAt } from '@hm/terrain';
import { project } from '@hm/racing';
import { audio, fx, soundEnabled } from '../maker/feedback';
import { engineSpecOf, musicSpecOf } from './bank';

/**
 * Turns what happens in a race into sound: countdown beeps, GO, lap and finish stingers, item sounds, the player's engine hum,
 * the rolling noise (by surface) and a looping music pattern. Every effect goes through `fx`, so edited sound presets apply.
 * Call `tick(dtMs)` once per frame; call the returned dispose when leaving the race.
 */
export interface RaceAudio { tick(dtMs: number): void; dispose(): void }

const ITEM_SOUND: Record<string, Parameters<typeof fx>[0]> = { boost: 'boost', jump: 'jump', oil: 'oil', shockwave: 'shockwave', freeze: 'freeze', mass: 'item-pickup', slipstream: 'boost', ghost: 'item-pickup' };

export function attachRaceAudio(game: RaceGame): RaceAudio {
  const { rt, world } = { rt: game.rt, world: game.rt.world };
  const me = game.player;
  let prevItem = '';
  let musicTimer: ReturnType<typeof setTimeout> | null = null;
  let musicOn = false;

  const startMusic = (): void => {
    if (musicOn) return;
    musicOn = true;
    const loop = (): void => {
      if (!musicOn) return;
      const eng = audio();
      const m = musicSpecOf(rt);
      if (eng && soundEnabled() && m.enabled) {
        const pattern = musicPattern(m.spec.seed, m.spec.bars, { mood: m.spec.mood, bpm: m.spec.bpm });
        eng.playMusic(pattern);
        musicTimer = setTimeout(loop, patternDurationSec(pattern) * 1000);
      } else musicTimer = setTimeout(loop, 1000);
    };
    loop();
  };
  const stopMusic = (): void => { musicOn = false; if (musicTimer) clearTimeout(musicTimer); musicTimer = null; audio()?.stopMusic(); };

  const offDirector = game.onEvent((e) => {
    if (e.type === 'countdown') fx(e.value === 0 ? 'go' : 'countdown-beep', e.value === 0 ? {} : { pitch: 1 + (3 - e.value) * 0.02 });
    if (e.type === 'phase' && e.phase === 'racing') startMusic();
    if (e.type === 'finish' && e.id === String(me)) fx('finish');
    if (e.type === 'results') stopMusic();
  });
  const offItem = rt.events.on('item:used', (p) => {
    const q = p as { entity?: number; item?: string };
    if (q.entity === me && q.item) fx(ITEM_SOUND[q.item] ?? 'item-pickup');
  });
  const offPad = rt.events.on('pad:boost', (p) => { if ((p as { entity?: number }).entity === me) fx('boost', { pitch: 1.15, minGapMs: 600 }); });
  const offLap = rt.events.on('lap:completed', (p) => { if ((p as { entity?: number }).entity === me) fx('lap'); });

  return {
    tick() {
      const eng = audio();
      if (!eng) return;
      const v = world.get(me, 'velocity'), t = world.get(me, 'transform'), rc = world.get(me, 'racer');
      if (!v || !t) return;
      const speed = Math.hypot(Number(v['vx']), Number(v['vz']));
      const racing = game.hud().phase === 'racing' || game.hud().phase === 'countdown';
      const item = String(rc?.['item'] ?? '');
      if (item && !prevItem) fx('item-pickup');
      prevItem = item;
      if (!racing) { eng.stopEngine('player'); eng.setRoll('player', { gain: 0, filterFreq: 800, q: 0.7 }); return; }
      const throttle = game.input.sample().throttle;
      const hum = engineSpecOf(rt);
      const p = engineParamsFor(hum.spec, speed, throttle, 28);
      eng.setEngine('player', { ...p, gain: p.gain * hum.volume, noiseGain: p.noiseGain * hum.volume });
      const ground = heightAt(game.terrain, Number(t['x']), Number(t['z']));
      const air = Number(t['y']) - ground > 1.6;
      const surface: Surface = air ? 'air' : Math.abs(project(game.track, [Number(t['x']), Number(t['z'])]).lateral) < game.track.width / 2 ? 'road' : 'grass';
      eng.setRoll('player', rollParams(speed, surface));
    },
    dispose() { offDirector(); offItem(); offPad(); offLap(); stopMusic(); const eng = audio(); eng?.stopEngine('player'); eng?.setRoll('player', { gain: 0, filterFreq: 800, q: 0.7 }); },
  };
}
