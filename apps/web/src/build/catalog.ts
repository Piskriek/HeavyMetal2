import { SFX, SFX_IDS, type SfxId, type SfxRecipe } from '@hm/audio';
import { LIGHT_WAYS } from './light-ways';
type SfxRecipeLayers = SfxRecipe['layers'];
import { ANIMATIONS, animById, animToParams, normalizeAnim, type AnimPreset } from '@hm/anim';
import { LOOKS, normalizeLook, type AvatarLook } from '@hm/avatarlook';
import { TAB_IDS, TOOLS, normalizeTool, toolsFor, type Hotbars, type SpritePreset, type TabId, type ToolPreset, LOGIC_WAYS, EFFECT_WAYS, SOUND_WAYS, CHAR_WAYS, PHYS_WAYS } from '@hm/buildkit';
import { SETUPS, setupById, type LightSetup } from '@hm/lighting';
import { STARTER_SURFACES } from '@hm/render';

/**
 * Everything the build tabs can hold, as cards with a preview. A card's id is the preset id; what it resolves to depends on the tab:
 * a tool (select, paint, sculpt, things), an animation, a sound, a lighting setup, an activity, an avatar look or a camera.
 */

export type Preview =
  | { readonly kind: 'icon'; readonly icon: string }
  | { readonly kind: 'swatch'; readonly colors: readonly string[] }
  /** A picture (a surface's tile); the swatch colours show until it loads and if it cannot. */
  | { readonly kind: 'image'; readonly url: string; readonly colors: readonly string[] }
  | { readonly kind: 'model'; readonly model: string }
  | { readonly kind: 'sky'; readonly top: string; readonly horizon: string; readonly ground: string; readonly sun: string }
  | { readonly kind: 'anim'; readonly anim: AnimPreset }
  | { readonly kind: 'sound'; readonly id: SfxId; readonly recipe?: { readonly layers: SfxRecipeLayers; readonly durationMs?: number } }
  | { readonly kind: 'planet'; readonly hue: number; readonly ring: boolean }
  | { readonly kind: 'look'; readonly look: AvatarLook }
  | { readonly kind: 'sprite'; readonly sprite: SpritePreset }
  | { readonly kind: 'part'; readonly id: string; readonly look: AvatarLook }
  | { readonly kind: 'shake'; readonly amp: number };

export interface CatalogItem { readonly tab: TabId; readonly id: string; readonly name: string; readonly doc: string; readonly preview: Preview; readonly edited: boolean }

export interface CameraPreset { readonly id: string; readonly name: string; readonly icon: string; readonly doc: string }
export const CAMERAS: readonly CameraPreset[] = [
  { id: 'third', name: 'Over the shoulder', icon: 'User', doc: 'The camera follows behind your goblin.' },
  { id: 'first', name: 'First person', icon: 'Focus', doc: 'See the world through your goblin\'s eyes.' },
  { id: 'studio', name: 'Studio', icon: 'PlaneTakeoff', doc: 'Fly freely without your goblin; the mouse stays free and every setting has a window.' },
  { id: 'island', name: 'Whole island', icon: 'Globe', doc: 'Fly up and circle the whole island.' },
];

const SOUND_NAMES: Partial<Record<SfxId, string>> = {
  'countdown-beep': 'Countdown beep', go: 'Go!', boost: 'Boost', jump: 'Jump', 'item-pickup': 'Pick up', 'hit-wall': 'Bonk', 'hit-racer': 'Bump', splash: 'Splash',
  lap: 'Lap', finish: 'Finish', respawn: 'Respawn', oil: 'Oil slick', shockwave: 'Shockwave', freeze: 'Freeze', 'ui-click': 'Click', 'ui-hover': 'Hover',
  'ui-toggle': 'Toggle', 'ui-error': 'Oops', 'ui-success': 'Success', 'paint-tick': 'Paint tick', 'sculpt-tick': 'Sculpt tick', place: 'Place', delete: 'Delete',
  undo: 'Undo', redo: 'Redo', snap: 'Snap', select: 'Select', 'tool-switch': 'Tool switch', save: 'Save',
};
export const soundName = (id: string): string => SOUND_NAMES[id as SfxId] ?? id;
export const SOUND_IDS: readonly string[] = SFX_IDS;

export interface ActivityInfo { readonly id: string; readonly name: string; readonly doc: string; readonly hue: number; readonly ring: boolean }

/** What a player has changed and made, as the catalog needs it. */
export interface CatalogPlayer {
  readonly tools: Readonly<Record<string, Record<string, unknown>>>;
  readonly anims: Readonly<Record<string, Record<string, unknown>>>;
  readonly looks: readonly AvatarLook[];
}

export const surfaceColours = (id: number): string[] => [...(STARTER_SURFACES.find((s) => s.id === id)?.flat ?? ['#888888'])];

export function toolOf(player: CatalogPlayer, id: string): ToolPreset | null { return normalizeTool(id, player.tools[id]); }
export function animOf(player: CatalogPlayer, id: string): AnimPreset {
  const base = animById(id);
  return normalizeAnim({ ...animToParams(base), ...(player.anims[id] ?? {}), id: base.id, name: (player.anims[id]?.['name'] as string | undefined) ?? base.name }, base.id, base.name);
}
export const lookOf = (player: CatalogPlayer, id: string): AvatarLook => player.looks.find((l) => l.id === id) ?? LOOKS.find((l) => l.id === id) ?? LOOKS[0]!;
export const setupOfId = (id: string): LightSetup => setupById(id);

function toolCard(tab: TabId, t: ToolPreset, edited: boolean): CatalogItem {
  // ways to paint show their icon (what they put down is the palette's); a surface-holding paint tool (older saves) its colours
  const preview: Preview = t.action === 'paint' && !t.way ? { kind: 'swatch', colors: surfaceColours(t.surface) } : t.action === 'place' ? { kind: 'model', model: t.model } : { kind: 'icon', icon: t.icon };
  return { tab, id: t.id, name: t.name, doc: t.doc, preview, edited };
}

/** Every card for a tab. */
export function catalog(tab: TabId, player: CatalogPlayer, _activities: readonly ActivityInfo[]): CatalogItem[] {
  switch (tab) {
    case 'select': case 'paint': case 'sculpt': case 'things':
      return toolsFor(tab).map((t) => toolCard(tab, toolOf(player, t.id) ?? t, !!player.tools[t.id]));
    case 'animate':
      return ANIMATIONS.map((a) => { const p = animOf(player, a.id); return { tab, id: a.id, name: p.name, doc: `${p.loop ? 'Repeats' : 'Plays once'}: ${p.style}.`, preview: { kind: 'anim', anim: p }, edited: !!player.anims[a.id] }; });
    case 'sound':
      // ways first; the sounds after, so hotbars that hold sounds stay valid
      return [...SOUND_WAYS.map((w) => ({ tab, id: w.id, name: w.name, doc: w.doc, preview: { kind: 'icon' as const, icon: w.icon }, edited: false })),
        ...SFX_IDS.map((id) => ({ tab, id, name: soundName(id), doc: `A ${SFX[id].category} sound, ${SFX[id].durationMs} ms. Edit changes its volume, pitch and layers.`, preview: { kind: 'sound' as const, id }, edited: false }))];
    case 'lights':
      // ways to change the light first; the looks (also in the palette) after, so older hotbars that hold looks stay valid
      return [...LIGHT_WAYS.map((w) => ({ tab, id: w.id, name: w.name, doc: w.doc, preview: { kind: 'icon' as const, icon: w.icon }, edited: false })), ...SETUPS.map((s) => ({ tab, id: s.id, name: s.name, doc: 'A lighting look: sun, sky, haze and picture effects.', preview: { kind: 'sky' as const, top: s.sky.top, horizon: s.sky.horizon, ground: s.hemi.ground, sun: s.sun.color }, edited: false }))];
    case 'avatar':
      return [...player.looks, ...LOOKS].map((l) => ({ tab, id: l.id, name: l.name, doc: player.looks.some((m) => m.id === l.id) ? 'Your goblin.' : 'A ready-made goblin look: pick it, then change any colour.', preview: { kind: 'look', look: l }, edited: player.looks.some((m) => m.id === l.id) }));
    case 'physics':
      return PHYS_WAYS.map((w) => ({ tab, id: w.id, name: w.name, doc: w.doc, preview: { kind: 'icon' as const, icon: w.icon }, edited: false }));
    case 'characters':
      return CHAR_WAYS.map((w) => ({ tab, id: w.id, name: w.name, doc: w.doc, preview: { kind: 'icon' as const, icon: w.icon }, edited: false }));
    case 'effects':
      return EFFECT_WAYS.map((w) => ({ tab, id: w.id, name: w.name, doc: w.doc, preview: { kind: 'icon' as const, icon: w.icon }, edited: false }));
    case 'logic':
      return LOGIC_WAYS.map((w) => ({ tab, id: w.id, name: w.name, doc: w.doc, preview: { kind: 'icon' as const, icon: w.icon }, edited: false }));
    case 'camera':
      return CAMERAS.map((c) => ({ tab, id: c.id, name: c.name, doc: c.doc, preview: { kind: 'icon', icon: c.icon }, edited: false }));
  }
}

/** Whether an id belongs to a tab (for loading stored hotbars). */
export function validFor(tab: TabId, id: string, player: CatalogPlayer, activities: readonly ActivityInfo[]): boolean {
  return catalog(tab, player, activities).some((c) => c.id === id);
}

/** Rows that were once the ready-made ones: a player who never changed them gets today's (Sculpt held shapes before it held ways). */
export const OLD_DEFAULT_ROWS: Readonly<Partial<Record<TabId, readonly (readonly (string | null)[])[]>>> = {
  sculpt: [['raise', 'lower', 'smooth', 'flatten', 'dig', 'mound', 'crater', 'plateau', 'ridge'], ['raise', 'lower', 'smooth', 'flatten', 'sculpt-grab', 'sculpt-clay', 'sculpt-crease', 'sculpt-stamp', 'sculpt-terrace']],
  lights: [['noon-clear', 'golden-hour', 'sunset-blaze', 'tropical-dawn', 'overcast', 'storm-front', 'blue-hour', 'moonlit-night', 'toon-flat'], ['light-look', 'light-sun', 'light-daynight', 'light-haze', 'light-clouds', null, null, null, null]],
  sound: [['place', 'delete', 'select', 'ui-success', 'go', 'boost', 'jump', 'splash', 'finish']],
  things: [['place-palm', 'place-bush', 'place-rock', 'place-flowers', 'place-grass-clump', 'place-barrel', 'place-trophy', 'place-statue-plinth', 'place-goblin']],
};

/** The hotbars a new player starts with: the nine most useful presets of each tab. */
export function defaultHotbars(_activities: readonly ActivityInfo[], player: CatalogPlayer): Hotbars {
  const ids = (list: readonly string[]): (string | null)[] => list.slice(0, 9);
  const out = {} as Hotbars;
  for (const tab of TAB_IDS) out[tab] = [];
  out.select = ids(['inspect', 'move', 'turn', 'resize', 'copy', 'delete', 'focus', 'isolate']);
  out.paint = ids(['paint-brush', 'paint-spray', 'paint-fill', 'paint-gradient', 'paint-stamp', 'paint-pattern', 'paint-clone', 'paint-smudge', 'paint-eraser']);
  // ways to sculpt; the shapes Stamp presses are in the palette (docs/HOTBAR.md)
  out.sculpt = ids(['raise', 'smooth', 'sculpt-grab', 'sculpt-clay', 'sculpt-stamp', 'sculpt-terrace', 'terrain-road', 'terrain-river', 'terrain-rain']);
  out.animate = ids(['wave', 'dance', 'cheer', 'swing', 'jump', 'walk', 'run', 'waddle', 'idle']);
  out.sound = [...ids(SOUND_WAYS.map((w) => w.id)), null, null, null, null, null];
  // ways to change the light; the looks are the palette (docs/HOTBAR.md)
  out.lights = [...ids(['light-look', 'light-sun', 'light-daynight', 'light-haze', 'light-clouds', 'light-lamp', 'light-lamp-remove']), null, null];
  out.avatar = ids([...player.looks.map((l) => l.id), ...LOOKS.map((l) => l.id)]);
  // ways to place; the things themselves are in the palette (docs/HOTBAR.md)
  out.things = [...ids(['things-one', 'things-scatter', 'things-row', 'things-swap']), null, null, null, null, null];
  out.camera = ids(CAMERAS.map((c) => c.id));
  out.logic = [...ids(LOGIC_WAYS.map((w) => w.id)), null, null, null, null, null, null];
  out.physics = [...ids(PHYS_WAYS.map((w) => w.id)), null, null, null, null, null, null];
  out.characters = [...ids(CHAR_WAYS.map((w) => w.id)), null, null, null, null, null, null];
  out.effects = [...ids(EFFECT_WAYS.map((w) => w.id)), null, null, null, null, null, null];
  return out;
}

export const ALL_TOOL_IDS: readonly string[] = TOOLS.map((t) => t.id);
export { normalizeLook };
