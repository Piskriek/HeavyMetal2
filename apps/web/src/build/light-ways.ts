import { cmd, type PresetId } from '@hm/contracts';
import type { Runtime } from '@hm/engine';
import { ensureLightPreset, pickLook, setupOf } from '../look';

/**
 * The ways of the Lights tab (docs/HOTBAR.md, F6): the looks themselves are the palette; the hotbar holds ways to change the light. Left and
 * right do opposite things, as on every tool. Each change is an undo step; the first change to a knob makes the look your own copy.
 */
export type LightWayId = 'light-look' | 'light-sun' | 'light-daynight' | 'light-haze' | 'light-clouds';
export const LIGHT_WAYS: readonly { readonly id: LightWayId; readonly name: string; readonly icon: string; readonly doc: string; readonly left: string; readonly right: string; readonly hold?: boolean }[] = [
  { id: 'light-look', name: 'Look', icon: 'Palette', doc: 'Light the island with the look picked in the palette.', left: 'Use the palette\'s look', right: 'Use the palette\'s look' },
  { id: 'light-sun', name: 'Sun', icon: 'Sun', doc: 'Move the sun through the day, an hour a click.', left: 'An hour later', right: 'An hour earlier' },
  { id: 'light-daynight', name: 'Day and night', icon: 'Moon', doc: 'Switch between day and night; the other button lets the look decide again.', left: 'Day or night', right: 'Back to the look\'s own time' },
  { id: 'light-haze', name: 'Haze', icon: 'Wind', doc: 'Thicken or thin the haze in the distance.', left: 'More haze', right: 'Less haze' },
  { id: 'light-clouds', name: 'Clouds', icon: 'Waves', doc: 'More or fewer clouds in the sky.', left: 'More clouds', right: 'Fewer clouds' },
];
export const isLightWay = (id: string): id is LightWayId => LIGHT_WAYS.some((w) => w.id === id);

/** Use a way once (or once per tick while held, for the Sun). Returns what to say, or null for nothing. */
export function applyLightWay(rt: Runtime, sceneId: PresetId, way: LightWayId, alt: boolean, paletteLook: string | undefined): string | null {
  const params = rt.store.resolve(sceneId).params;
  const hourNow = Number(params['timeOfDay'] ?? -1);
  const setHour = (h: number, label: string): void => { rt.commands.execute(cmd.setParam(`${sceneId}.timeOfDay`, h, label)); };
  const clock = (h: number): string => `${Math.floor(h).toString().padStart(2, '0')}:${Math.round((h % 1) * 60).toString().padStart(2, '0')}`;
  switch (way) {
    case 'light-look':
      if (!paletteLook) return 'Pick a look in the palette (Tab)';
      pickLook(rt, sceneId, paletteLook);
      return null;
    case 'light-sun': {
      const from = hourNow >= 0 ? hourNow : 12;
      const h = (((Math.round(from) + (alt ? -1 : 1)) % 24) + 24) % 24;
      setHour(h, alt ? 'An hour earlier' : 'An hour later');
      return clock(h);
    }
    case 'light-daynight': {
      if (alt) { setHour(-1, 'The look\'s own time'); return 'The look decides the time again'; }
      const day = hourNow < 0 || (hourNow >= 6 && hourNow < 19);
      setHour(day ? 22 : 12, day ? 'Night' : 'Day');
      return day ? 'Night' : 'Day';
    }
    case 'light-haze': case 'light-clouds': {
      const ref = ensureLightPreset(rt, sceneId);
      const setup = setupOf(rt.store, sceneId, Number.NaN);
      if (way === 'light-haze') {
        const d = Math.min(0.08, Math.max(0.0002, setup.fog.density * (alt ? 0.7 : 1.4)));
        rt.commands.execute(cmd.setParam(`${ref}.fogDensity`, Math.round(d * 100000) / 100000, alt ? 'Less haze' : 'More haze'));
        return alt ? 'Less haze' : 'More haze';
      }
      const c = Math.min(1, Math.max(0, (setup.sky.clouds ?? 0.3) + (alt ? -0.15 : 0.15)));
      rt.commands.execute(cmd.setParam(`${ref}.skyClouds`, Math.round(c * 100) / 100, alt ? 'Fewer clouds' : 'More clouds'));
      return c <= 0 ? 'A clear sky' : c >= 1 ? 'Overcast' : alt ? 'Fewer clouds' : 'More clouds';
    }
  }
}
