import type { VariableDef } from '@hm/contracts';
import { SPRITE_PRESETS, defaultPlugs, normalizePlugs, type ToolPlug } from './plugs';

/**
 * Tool presets: what the Select, Paint, Sculpt and Things tabs hold. A tool is a preset like everything else: its size, strength, the
 * surface it paints, the thing it places, and the sprite and sound it plays are all variables you can open and change.
 */
export type ToolTab = 'select' | 'paint' | 'sculpt' | 'things';
export type ToolAction =
  | 'inspect' | 'move' | 'turn' | 'resize' | 'copy' | 'delete' | 'focus' | 'isolate'
  | 'paint'
  | 'raise' | 'lower' | 'smooth' | 'flatten' | 'dig' | 'mound' | 'crater' | 'plateau' | 'ridge' | 'dune'
  | 'place';

/** The ready-made sprite bursts (their editable values are in `plugs.ts`). */
export const SPRITE_IDS: readonly string[] = SPRITE_PRESETS.map((s) => s.id);
export type SpriteName = string;

export interface ToolPreset {
  id: string;
  name: string;
  tab: ToolTab;
  action: ToolAction;
  /** lucide icon name */
  icon: string;
  doc: string;
  /** What the left and right mouse buttons do, in words for the screen. */
  left: string;
  right: string;
  /** Brush radius in metres (ground tools), or the size of a placed thing (1 = as made). */
  size: number;
  /** 0..1 for brushes. */
  strength: number;
  falloff: 'smooth' | 'linear' | 'flat';
  /** Surface id painted (paint tools), 0 for none. */
  surface: number;
  /** Model id placed (Things tools), '' for none. */
  model: string;
  /** The first sprite and sound it plays on use (what the cards show); the full list is `plugs`. */
  sprite: SpriteName;
  sound: string;
  /** What it sets off, and when: sprites, sounds, goblin moves, camera shakes (the "+ attribute" list). */
  plugs: readonly ToolPlug[];
}

/** The ground you can paint, by id (the same numbers as the island's surfaces). */
export const PAINTS: readonly { readonly id: number; readonly name: string }[] = [
  { id: 4, name: 'Grass' }, { id: 2, name: 'Sand' }, { id: 3, name: 'Wet sand' }, { id: 5, name: 'Rock' }, { id: 11, name: 'Moss' }, { id: 16, name: 'Soil' },
  { id: 13, name: 'Lava' }, { id: 7, name: 'Basalt' }, { id: 8, name: 'Dunes' }, { id: 9, name: 'Mud' }, { id: 14, name: 'Scree' }, { id: 15, name: 'Pumice' },
  { id: 12, name: 'Coral' }, { id: 10, name: 'Ochre strata' }, { id: 6, name: 'Cliff' }, { id: 1, name: 'Shallows' },
  { id: 17, name: 'Tarmac' }, { id: 18, name: 'Wet tarmac' }, { id: 19, name: 'Start line' }, { id: 20, name: 'Boost pad' }, { id: 21, name: 'Kerb' },
  { id: 22, name: 'Dirt road' }, { id: 23, name: 'Boardwalk' }, { id: 24, name: 'Cobbles' }, { id: 25, name: 'Dusty road' }, { id: 26, name: 'Basalt columns' },
];
/** The things you can place, by model id. */
export const THINGS: readonly { readonly id: string; readonly name: string; readonly icon: string }[] = [
  { id: 'palm', name: 'Palm', icon: 'TreePalm' }, { id: 'bush', name: 'Bush', icon: 'Sprout' }, { id: 'rock', name: 'Rock', icon: 'Gem' },
  { id: 'flowers', name: 'Flowers', icon: 'Flower2' }, { id: 'grass-clump', name: 'Grass clump', icon: 'Sprout' }, { id: 'barrel', name: 'Barrel', icon: 'Package' },
  { id: 'trophy', name: 'Trophy', icon: 'Trophy' }, { id: 'statue-plinth', name: 'Plinth', icon: 'Square' }, { id: 'goblin', name: 'Goblin statue', icon: 'Smile' },
  { id: 'goblin-ball-racer', name: 'Ball racer', icon: 'Circle' },
];

type Base = Pick<ToolPreset, 'size' | 'strength' | 'falloff' | 'surface' | 'model' | 'sprite' | 'sound'>;
const B: Base = { size: 1, strength: 0.5, falloff: 'smooth', surface: 0, model: '', sprite: 'pop', sound: 'select' };
const tool = (id: string, name: string, tab: ToolTab, action: ToolAction, icon: string, doc: string, left: string, right: string, v: Partial<Base> = {}): ToolPreset => { const b = { ...B, ...v }; return { id, name, tab, action, icon, doc, left, right, ...b, plugs: defaultPlugs(b.sprite, b.sound, swings(action) ? 'swing' : undefined) }; };
/** Tools that change the world make the goblin swing its arm; looking, focusing and hiding do not. */
const swings = (a: ToolAction): boolean => a !== 'inspect' && a !== 'focus' && a !== 'isolate';

export const TOOLS: readonly ToolPreset[] = [
  tool('inspect', 'Look at', 'select', 'inspect', 'MousePointer2', 'Point at something to see what it is and what it is made of.', 'Show what it is', 'Show what it is', { sound: 'select' }),
  tool('move', 'Move', 'select', 'move', 'Move', 'Pick up a thing you placed and put it down somewhere else.', 'Pick it up, then put it down', 'Drop it back where it was', { sound: 'snap' }),
  tool('turn', 'Turn', 'select', 'turn', 'RotateCcw', 'Turn a thing you placed.', 'Turn it left', 'Turn it right', { sound: 'snap', strength: 0.25 }),
  tool('resize', 'Size', 'select', 'resize', 'Maximize', 'Make a thing you placed bigger or smaller.', 'Bigger', 'Smaller', { sound: 'snap', strength: 0.15 }),
  tool('copy', 'Copy', 'select', 'copy', 'Copy', 'Make a copy of a thing you placed, right next to it.', 'Copy it', 'Copy it', { sound: 'place', sprite: 'sparkle' }),
  tool('delete', 'Delete', 'select', 'delete', 'Trash2', 'Take away a thing you placed.', 'Take it away', 'Take it away', { sound: 'delete', sprite: 'debris' }),
  tool('focus', 'Focus', 'select', 'focus', 'Focus', 'Fly to a thing and see it from every side; the world fades away around it.', 'Focus on it', 'Leave focus', { sound: 'ui-toggle' }),
  tool('isolate', 'Hide others', 'select', 'isolate', 'Layers', 'Hide everything except the thing you point at (point at nothing to show it all again).', 'Hide the rest', 'Show everything', { sound: 'ui-toggle' }),
  ...PAINTS.map((p) => tool(`paint-${p.id}`, p.name, 'paint', 'paint', 'Paintbrush', `Paint the ground with ${p.name.toLowerCase()}.`, 'Paint', 'Paint with a smaller brush', { size: 4, strength: 1, surface: p.id, sprite: 'sparkle', sound: 'paint-tick' })),
  tool('raise', 'Raise', 'sculpt', 'raise', 'ArrowUpFromLine', 'Pull the ground up.', 'Raise the ground', 'Lower it', { size: 5, strength: 0.4, sprite: 'dust', sound: 'sculpt-tick' }),
  tool('lower', 'Lower', 'sculpt', 'lower', 'ArrowDownToLine', 'Push the ground down.', 'Lower the ground', 'Raise it', { size: 5, strength: 0.4, sprite: 'dust', sound: 'sculpt-tick' }),
  tool('smooth', 'Smooth', 'sculpt', 'smooth', 'Waves', 'Soften bumps and edges.', 'Smooth', 'Smooth', { size: 6, strength: 0.5, sprite: 'sparkle', sound: 'sculpt-tick' }),
  tool('flatten', 'Flatten', 'sculpt', 'flatten', 'Minus', 'Make the ground level with where you first pressed.', 'Level the ground', 'Level the ground', { size: 6, strength: 0.5, sprite: 'dust', sound: 'sculpt-tick' }),
  tool('dig', 'Dig', 'sculpt', 'dig', 'Shovel', 'Dig the ground away. What shows depends on the world rules: soil under grass, rock deeper down.', 'Dig', 'Fill it back in', { size: 3.5, strength: 0.55, sprite: 'debris', sound: 'delete' }),
  tool('mound', 'Hill', 'sculpt', 'mound', 'Mountain', 'Stamp a round hill.', 'Make a hill', 'Make a hollow', { size: 8, strength: 0.6, sprite: 'dust', sound: 'place' }),
  tool('crater', 'Crater', 'sculpt', 'crater', 'CircleDot', 'Stamp a crater with a rim.', 'Make a crater', 'Make a crater', { size: 8, strength: 0.6, sprite: 'debris', sound: 'place' }),
  tool('plateau', 'Plateau', 'sculpt', 'plateau', 'Square', 'Stamp a flat-topped rise.', 'Make a plateau', 'Make a plateau', { size: 9, strength: 0.6, sprite: 'dust', sound: 'place' }),
  tool('ridge', 'Ridge', 'sculpt', 'ridge', 'TrendingUp', 'Stamp a long ridge.', 'Make a ridge', 'Make a ridge', { size: 10, strength: 0.6, sprite: 'dust', sound: 'place' }),
  tool('dune', 'Dune', 'sculpt', 'dune', 'Wind', 'Stamp a sand dune.', 'Make a dune', 'Make a dune', { size: 10, strength: 0.5, sprite: 'dust', sound: 'place' }),
  ...THINGS.map((t) => tool(`place-${t.id}`, t.name, 'things', 'place', t.icon, `Place a ${t.name.toLowerCase()} where you point.`, 'Place it', 'Take away the thing you point at', { model: t.id, size: 1, sprite: t.id === 'palm' || t.id === 'bush' || t.id === 'flowers' || t.id === 'grass-clump' ? 'leaf' : 'pop', sound: 'place' })),
];
export const toolById = (id: string): ToolPreset | undefined => TOOLS.find((t) => t.id === id);
export const toolsFor = (tab: ToolTab): readonly ToolPreset[] => TOOLS.filter((t) => t.tab === tab);

const num = (v: unknown, d: number, lo: number, hi: number): number => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);

/** A stored tool (the ready-made one with the player's own changes on top). Unknown ids give null. Never throws. */
export function normalizeTool(id: string, overrides: unknown): ToolPreset | null {
  const base = toolById(id);
  if (!base) return null;
  const o = overrides && typeof overrides === 'object' && !Array.isArray(overrides) ? (overrides as Record<string, unknown>) : {};
  // plugs: the stored list, or (older saves) the single sprite and sound they picked
  const sprite = SPRITE_IDS.includes(o.sprite as string) ? (o.sprite as string) : base.sprite;
  const sound = typeof o.sound === 'string' && o.sound ? o.sound : base.sound;
  const plugs = normalizePlugs(o.plugs) ?? (o.sprite === undefined && o.sound === undefined ? [...base.plugs] : defaultPlugs(sprite, sound, base.plugs.find((p) => p.kind === 'anim')?.ref));
  const firstUse = (kind: ToolPlug['kind']): string | undefined => plugs.find((p) => p.on === 'use' && p.kind === kind)?.ref;
  return {
    ...base,
    name: typeof o.name === 'string' && o.name.trim() ? o.name.trim().slice(0, 40) : base.name,
    size: num(o.size, base.size, 0.05, 500),
    strength: num(o.strength, base.strength, 0, 10),
    falloff: o.falloff === 'linear' || o.falloff === 'flat' || o.falloff === 'smooth' ? o.falloff : base.falloff,
    surface: base.action === 'paint' && typeof o.surface === 'number' && PAINTS.some((p) => p.id === o.surface) ? o.surface : base.surface,
    model: base.action === 'place' && typeof o.model === 'string' && THINGS.some((t) => t.id === o.model) ? o.model : base.model,
    sprite: firstUse('sprite') ?? sprite,
    sound: firstUse('sound') ?? sound,
    plugs,
  };
}

/** The variables a tool shows in its attribute editor (only the ones that matter for what it does). */
export function toolVariables(t: ToolPreset, sounds: readonly string[]): VariableDef[] {
  const brush = t.tab === 'paint' || t.tab === 'sculpt';
  const vars: VariableDef[] = [{ key: 'name', type: 'string', label: 'Name', doc: 'What the tool is called on your hotbar.', tier: 'play', default: t.name, group: 'Tool' }];
  if (brush) {
    vars.push({ key: 'size', type: 'number', label: 'Size', doc: 'How wide the brush is.', tier: 'play', default: t.size, min: 0.5, max: 20, step: 0.5, hardMin: 0.05, unit: 'm', group: 'Tool' });
    vars.push({ key: 'strength', type: 'number', label: 'Strength', doc: 'How much each pass changes the ground.', tier: 'play', default: t.strength, min: 0, max: 1, step: 0.01, hardMin: 0, hardMax: 10, group: 'Tool' });
    vars.push({ key: 'falloff', type: 'enum', label: 'Edge', doc: 'smooth fades out, linear slopes, flat is a hard edge.', tier: 'build', default: t.falloff, options: ['smooth', 'linear', 'flat'], group: 'Tool' });
  }
  if (t.action === 'place') vars.push({ key: 'size', type: 'number', label: 'Size', doc: 'How big the thing is (1 = as it was made).', tier: 'play', default: t.size, min: 0.25, max: 4, step: 0.05, hardMin: 0.05, group: 'Tool' });
  if (t.action === 'turn' || t.action === 'resize') vars.push({ key: 'strength', type: 'number', label: t.action === 'turn' ? 'Turn by' : 'Grow by', doc: t.action === 'turn' ? 'How far one click turns it (1 = a full turn).' : 'How much one click grows it.', tier: 'play', default: t.strength, min: 0, max: 1, step: 0.01, hardMin: 0, group: 'Tool' });
  if (t.action === 'paint') vars.push({ key: 'surface', type: 'enum', label: 'Paints', doc: 'The ground it paints.', tier: 'play', default: PAINTS.find((p) => p.id === t.surface)?.name ?? 'Grass', options: PAINTS.map((p) => p.name), group: 'Tool' });
  if (t.action === 'place') vars.push({ key: 'model', type: 'enum', label: 'Places', doc: 'The thing it places.', tier: 'play', default: THINGS.find((m) => m.id === t.model)?.name ?? 'Palm', options: THINGS.map((m) => m.name), group: 'Tool' });
  void sounds; // sprites and sounds are plugs now (see plugs.ts), edited in the tool's "When you use it" list
  return vars;
}

/** Inspector values for a tool (names for the surface and model menus). */
export function toolParams(t: ToolPreset): Record<string, number | string | boolean> {
  return {
    name: t.name, size: t.size, strength: t.strength, falloff: t.falloff, sprite: t.sprite, sound: t.sound,
    surface: PAINTS.find((p) => p.id === t.surface)?.name ?? '', model: THINGS.find((m) => m.id === t.model)?.name ?? '',
  };
}

/** Turn an inspector edit (key, value) into the stored override (menus send names; store ids). */
export function toolEdit(key: string, value: unknown): [string, unknown] {
  if (key === 'surface') return ['surface', PAINTS.find((p) => p.name === value)?.id ?? value];
  if (key === 'model') return ['model', THINGS.find((m) => m.name === value)?.id ?? value];
  return [key, value];
}
