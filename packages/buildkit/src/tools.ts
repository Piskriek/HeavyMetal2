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
  | 'sculpt'
  | 'road' | 'river' | 'rain'
  | 'things'
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
  /** Paint tools: the way they paint (the surface comes from the palette). */
  way?: PaintWayId;
  /** Paint, Stamp: the shape pressed. */
  shape?: StampShape;
  /** Paint, Pattern: what repeats. */
  pattern?: PatternId;
  /** Sculpt tools: the way they sculpt (Stamp presses the palette's shape). */
  sculpt?: SculptWayId;
  /** Things tools: the way they place (the thing comes from the palette). */
  placeWay?: PlaceWayId;
  /** Sculpt, Stamp: the palette's shape (set by the island from the palette, not stored). */
  stampShape?: string;
  /** Sculpt toggles (Pro, beside the hotbar; set by the island, not stored): mirror every dab across the island's middle; smooth after each one. */
  mirror?: boolean;
  smoothAfter?: boolean;
}

/** The ways to paint (the same names as @hm/terrain's paintWay). */
export type PaintWayId = 'brush' | 'spray' | 'fill' | 'gradient' | 'stamp' | 'pattern' | 'clone' | 'smudge' | 'eraser';
export type StampShape = 'blob' | 'square' | 'star' | 'ring';
export type PatternId = 'checker' | 'stripes' | 'dots';
/** The ways to place things (docs/HOTBAR.md, Things): one where you point, a scatter round it, a row between two clicks, or swap the one you point at. */
export type PlaceWayId = 'one' | 'scatter' | 'row' | 'swap';
/** The ways to sculpt (the same names as @hm/terrain's sculptWay, plus Stamp, which presses a shape from the palette). */
export type SculptWayId = 'grab' | 'clay' | 'crease' | 'terrace' | 'noise' | 'pinch' | 'erode' | 'stamp';
/** The shapes Sculpt's Stamp presses (the palette of the Sculpt tab; the same names as @hm/terrainops' stamp). */
export const STAMP_SHAPES: readonly { readonly id: 'mound' | 'crater' | 'plateau' | 'ridge' | 'dune' | 'volcano'; readonly name: string; readonly icon: string }[] = [
  { id: 'mound', name: 'Hill', icon: 'Mountain' }, { id: 'crater', name: 'Crater', icon: 'CircleDot' }, { id: 'plateau', name: 'Plateau', icon: 'Square' },
  { id: 'ridge', name: 'Ridge', icon: 'TrendingUp' }, { id: 'dune', name: 'Dune', icon: 'Wind' }, { id: 'volcano', name: 'Volcano', icon: 'Flame' },
];
/** How deep the hotbar goes (docs/HOTBAR.md section 2): Easy shows the best few presets; Pro all of them and the sliders; Studio every setting. */
export type HotbarLevel = 'easy' | 'pro' | 'studio';
export const HOTBAR_LEVELS: readonly { readonly id: HotbarLevel; readonly name: string; readonly says: string }[] = [
  { id: 'easy', name: 'Easy', says: 'The best few presets of each tool, nothing to set.' },
  { id: 'pro', name: 'Pro', says: 'Every preset of each tool, with size and strength beside the hotbar.' },
  { id: 'studio', name: 'Studio', says: 'Everything: every setting of the tool and what it is made of.' },
];

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
  // building blocks (F3 of the hotbar spec V3; @hm/primitives)
  { id: 'block-cube', name: 'Cube', icon: 'Box' }, { id: 'block-ball', name: 'Ball', icon: 'Circle' }, { id: 'block-cylinder', name: 'Cylinder', icon: 'Cylinder' },
  { id: 'block-wedge', name: 'Wedge', icon: 'Triangle' }, { id: 'block-stairs', name: 'Stairs', icon: 'ChartNoAxesColumnIncreasing' }, { id: 'block-hollow-box', name: 'Hollow box', icon: 'Square' },
  { id: 'block-arch', name: 'Arch', icon: 'DoorOpen' }, { id: 'block-plank', name: 'Plank', icon: 'RectangleHorizontal' }, { id: 'block-pillar', name: 'Pillar', icon: 'Columns2' },
];

type Base = Pick<ToolPreset, 'size' | 'strength' | 'falloff' | 'surface' | 'model' | 'sprite' | 'sound'> & Pick<ToolPreset, 'shape' | 'pattern'>;
const B: Base = { size: 1, strength: 0.5, falloff: 'smooth', surface: 0, model: '', sprite: 'pop', sound: 'select' };
const tool = (id: string, name: string, tab: ToolTab, action: ToolAction, icon: string, doc: string, left: string, right: string, v: Partial<Base> = {}): ToolPreset => { const b = { ...B, ...v }; return { id, name, tab, action, icon, doc, left, right, ...b, plugs: defaultPlugs(b.sprite, b.sound, swings(action) ? 'swing' : undefined) }; };
const sculptTool = (way: SculptWayId, name: string, icon: string, doc: string, left: string, right: string, v: Partial<Base>): ToolPreset => ({ ...tool(`sculpt-${way}`, name, 'sculpt', 'sculpt', icon, doc, left, right, { sprite: 'dust', sound: 'sculpt-tick', ...v }), sculpt: way });
const thingsTool = (way: PlaceWayId, name: string, icon: string, doc: string, left: string, right: string, v: Partial<Base>): ToolPreset => ({ ...tool(`things-${way}`, name, 'things', 'things', icon, doc, left, right, { model: 'palm', sprite: 'leaf', sound: 'place', ...v }), placeWay: way });
const paintTool = (way: PaintWayId, name: string, icon: string, doc: string, left: string, right: string, v: Partial<Base>): ToolPreset => ({ ...tool(`paint-${way}`, name, 'paint', 'paint', icon, doc, left, right, { sprite: 'sparkle', sound: 'paint-tick', ...v }), way });
/** Tools that change the world make the goblin swing its arm; looking, focusing and hiding do not. */
const swings = (a: ToolAction): boolean => a !== 'inspect' && a !== 'focus' && a !== 'isolate';

export const TOOLS: readonly ToolPreset[] = [
  tool('inspect', 'Select', 'select', 'inspect', 'MousePointer2', 'Point at anything to see what it is and change it: the ground opens its look, a plant how its kind grows, the sea the world rules, a thing its layer.', 'Select it', 'Select it', { sound: 'select' }),
  tool('move', 'Move', 'select', 'move', 'Move', 'Pick up a thing you placed and put it down somewhere else.', 'Pick it up, then put it down', 'Drop it back where it was', { sound: 'snap' }),
  tool('turn', 'Turn', 'select', 'turn', 'RotateCcw', 'Turn a thing you placed.', 'Turn it left', 'Turn it right', { sound: 'snap', strength: 0.25 }),
  tool('resize', 'Size', 'select', 'resize', 'Maximize', 'Make a thing you placed bigger or smaller.', 'Bigger', 'Smaller', { sound: 'snap', strength: 0.15 }),
  tool('copy', 'Copy', 'select', 'copy', 'Copy', 'Make a copy of a thing you placed, right next to it.', 'Copy it', 'Copy it', { sound: 'place', sprite: 'sparkle' }),
  tool('delete', 'Delete', 'select', 'delete', 'Trash2', 'Take away a thing you placed.', 'Take it away', 'Take it away', { sound: 'delete', sprite: 'debris' }),
  tool('focus', 'Focus', 'select', 'focus', 'Focus', 'Fly to a thing and see it from every side; the world fades away around it.', 'Focus on it', 'Leave focus', { sound: 'ui-toggle' }),
  tool('isolate', 'Hide others', 'select', 'isolate', 'Layers', 'Hide everything except the thing you point at (point at nothing to show it all again).', 'Hide the rest', 'Show everything', { sound: 'ui-toggle' }),
  // ways to paint: what they put down is picked in the palette (top middle), not here
  paintTool('brush', 'Brush', 'Paintbrush', 'Paint a round patch wherever you drag.', 'Paint', 'Paint with a smaller brush', { size: 3, strength: 0.8 }),
  paintTool('spray', 'Spray', 'SprayCan', 'Scatter little dabs round the brush: clusters, speckles, patches of flowers.', 'Spray', 'Spray finer', { size: 4, strength: 1, falloff: 'flat' }),
  paintTool('fill', 'Fill', 'PaintBucket', 'Fill the whole patch of one surface you click on.', 'Fill the patch', 'Fill the patch', { size: 1, strength: 1, falloff: 'flat' }),
  paintTool('gradient', 'Gradient', 'Blend', 'Blend softly into what is there: a long fading edge.', 'Blend in', 'Blend in less', { size: 6, strength: 0.5, falloff: 'linear' }),
  paintTool('stamp', 'Stamp', 'Stamp', 'Press a shape: a blob, a square, a star, a ring.', 'Stamp it', 'Stamp it smaller', { size: 3, strength: 1, falloff: 'flat', shape: 'blob' }),
  paintTool('pattern', 'Pattern', 'Grid3x3', 'Paint a repeating pattern: a checker, stripes or dots.', 'Paint the pattern', 'Paint it smaller', { size: 4, strength: 1, falloff: 'flat', pattern: 'checker' }),
  paintTool('clone', 'Clone', 'Copy', 'Copy the ground from one place to another: right-click where to copy from, then paint.', 'Paint the copy', 'Copy from here', { size: 3, strength: 1, falloff: 'flat' }),
  paintTool('smudge', 'Smudge', 'Wind', 'Mix the edges between surfaces, like a finger in wet paint.', 'Smudge', 'Smudge gently', { size: 3, strength: 0.6 }),
  paintTool('eraser', 'Eraser', 'Eraser', 'Put back what the island would grow there by itself: sand by the sea, grass on the flat, rock on the steep.', 'Erase', 'Erase smaller', { size: 3, strength: 1, falloff: 'flat' }),
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
  // ways to sculpt (docs/HOTBAR.md): the shapes Stamp presses are in the palette
  sculptTool('grab', 'Grab', 'Hand', 'Take hold of the ground and pull it along: drag a hill aside, stretch a bay.', 'Pull the ground along', 'Pull a smaller piece', { size: 5, strength: 1 }),
  sculptTool('clay', 'Clay', 'Layers', 'Build up in flat layers, like laying clay: terraces and shelves instead of domes.', 'Add a layer', 'Scrape a layer off', { size: 4, strength: 0.4, falloff: 'linear' }),
  sculptTool('crease', 'Crease', 'Scissors', 'Cut a sharp line, or press out a sharp ridge with the right button.', 'Cut a crease', 'Raise a sharp ridge', { size: 2.5, strength: 0.5 }),
  sculptTool('stamp', 'Stamp', 'Stamp', 'Press a shape from the palette: a hill, a crater, a plateau, a ridge, a dune, a volcano.', 'Press the shape', 'Press it upside down', { size: 8, strength: 0.6, sound: 'place' }),
  sculptTool('terrace', 'Terrace', 'BarChart3', 'Turn slopes into steps, like rice terraces or a stepped cliff. Strength sets the step height.', 'Make steps', 'Make steps', { size: 5, strength: 0.5, falloff: 'flat' }),
  sculptTool('noise', 'Roughen', 'Sparkles', 'Make the ground bumpy and natural: pebbles and lumps.', 'Roughen', 'Roughen gently', { size: 4, strength: 0.4 }),
  sculptTool('pinch', 'Sharpen', 'Gem', 'Make edges and ridges crisp (the opposite of Smooth).', 'Sharpen', 'Soften', { size: 4, strength: 0.4 }),
  tool('terrain-road', 'Road', 'sculpt', 'road', 'Route', 'Click along where the road goes, then click the last point again (or press Enter): a smooth level road with a dirt top that follows the ground.', 'Add a point (the last again: lay the road)', 'Take the last point back', { size: 4, strength: 0.5, sprite: 'dust', sound: 'place' }),
  tool('terrain-river', 'River', 'sculpt', 'river', 'Waves', 'Click from where it starts to where it ends, then the last point again (or Enter): a channel with a mud bed that always runs downhill.', 'Add a point (the last again: dig the river)', 'Take the last point back', { size: 3, strength: 0.5, sprite: 'dust', sound: 'place' }),
  tool('terrain-rain', 'Rain', 'sculpt', 'rain', 'CloudRain', 'Rain where you point: little gullies form and soil washes down into the hollows. Hold to keep it raining.', 'Rain here', 'A light shower', { size: 8, strength: 0.6, sprite: 'dust', sound: 'sculpt-tick' }),
  sculptTool('erode', 'Erode', 'Droplet', 'Let steep ground slide and settle, as rain and time would.', 'Erode', 'Erode gently', { size: 6, strength: 0.6 }),
  // ways to place things (docs/HOTBAR.md): the thing comes from the palette
  thingsTool('one', 'Place', 'PlusCircle', 'Put the thing from the palette where you point.', 'Place it', 'Take away the thing you point at', { size: 1, strength: 0.5 }),
  thingsTool('scatter', 'Scatter', 'Sprout', 'Scatter a few of the palette\'s thing round where you point, each turned and sized a little differently: a grove, a rock field, a patch of flowers.', 'Scatter', 'Scatter fewer', { size: 1, strength: 0.4 }),
  thingsTool('row', 'Row', 'MoveHorizontal', 'A line of the palette\'s thing: click where the row starts, then where it ends. A fence of palms, barrels along the track.', 'Start, then end the row', 'Cancel the row', { size: 1, strength: 0.5 }),
  thingsTool('swap', 'Swap', 'Repeat', 'Turn the thing you point at into the palette\'s thing, in the same place and turn.', 'Swap it', 'Swap it', { size: 1, strength: 0.5, sprite: 'sparkle' }),
  ...THINGS.map((t) => tool(`place-${t.id}`, t.name, 'things', 'place', t.icon, `Place a ${t.name.toLowerCase()} where you point.`, 'Place it', 'Take away the thing you point at', { model: t.id, size: 1, sprite: t.id === 'palm' || t.id === 'bush' || t.id === 'flowers' || t.id === 'grass-clump' ? 'leaf' : 'pop', sound: 'place' })),
];
export const toolById = (id: string): ToolPreset | undefined => TOOLS.find((t) => t.id === id);

/**
 * A tool's own presets (docs/HOTBAR.md section 1): picking a tool shows these in a row above the hotbar, each previewed on what you are
 * looking at; picking one sets the tool to it. `best` ones show in Easy; Pro and Studio show all.
 */
export interface ToolVariant { readonly id: string; readonly name: string; readonly patch: Partial<Pick<ToolPreset, 'size' | 'strength' | 'falloff' | 'shape' | 'pattern'>>; readonly best?: boolean }
const v = (id: string, name: string, patch: ToolVariant['patch'], best = false): ToolVariant => ({ id, name, patch, ...(best ? { best } : {}) });
export const TOOL_VARIANTS: Readonly<Record<string, readonly ToolVariant[]>> = {
  'paint-brush': [v('soft', 'Soft', { size: 3, strength: 0.8, falloff: 'smooth' }, true), v('hard', 'Hard', { size: 3, strength: 1, falloff: 'flat' }, true), v('fine', 'Fine', { size: 1.2, strength: 1, falloff: 'flat' }, true), v('wide', 'Wide', { size: 7, strength: 0.7, falloff: 'smooth' }, true), v('faint', 'Faint', { size: 4, strength: 0.25, falloff: 'smooth' }), v('edge', 'Hard edge, soft middle', { size: 4, strength: 0.9, falloff: 'linear' })],
  'paint-spray': [v('speckle', 'Speckles', { size: 3, strength: 1 }, true), v('patches', 'Patches', { size: 6, strength: 1 }, true), v('mist', 'Mist', { size: 5, strength: 0.4 }, true), v('wide', 'Wide', { size: 10, strength: 0.8 })],
  'paint-fill': [v('patch', 'The patch', { size: 1, strength: 1 }, true), v('soft', 'Soft fill', { size: 1, strength: 0.6 }, true)],
  'paint-gradient': [v('short', 'Short fade', { size: 3, strength: 0.6 }, true), v('long', 'Long fade', { size: 9, strength: 0.5 }, true), v('gentle', 'Gentle', { size: 6, strength: 0.25 }, true)],
  'paint-stamp': [v('blob', 'Blob', { shape: 'blob', size: 3 }, true), v('square', 'Square', { shape: 'square', size: 3 }, true), v('star', 'Star', { shape: 'star', size: 4 }, true), v('ring', 'Ring', { shape: 'ring', size: 4 }, true), v('big-blob', 'Big blob', { shape: 'blob', size: 8 })],
  'paint-pattern': [v('checker', 'Checker', { pattern: 'checker' }, true), v('stripes', 'Stripes', { pattern: 'stripes' }, true), v('dots', 'Dots', { pattern: 'dots' }, true), v('big-checker', 'Big checker', { pattern: 'checker', size: 8 })],
  'paint-clone': [v('small', 'Small', { size: 2 }, true), v('big', 'Big', { size: 6 }, true)],
  'paint-smudge': [v('gentle', 'Gentle', { size: 3, strength: 0.35 }, true), v('strong', 'Strong', { size: 3, strength: 0.9 }, true), v('wide', 'Wide', { size: 7, strength: 0.6 })],
  'raise': [v('soft', 'Soft', { size: 5, strength: 0.4, falloff: 'smooth' }, true), v('hill', 'Wide hill', { size: 10, strength: 0.3, falloff: 'smooth' }, true), v('spike', 'Sharp', { size: 2, strength: 0.6, falloff: 'linear' }, true), v('flat-top', 'Flat top', { size: 5, strength: 0.4, falloff: 'flat' }, true)],
  'lower': [v('soft', 'Soft', { size: 5, strength: 0.4, falloff: 'smooth' }, true), v('wide', 'Wide dip', { size: 10, strength: 0.3, falloff: 'smooth' }, true), v('hole', 'Hole', { size: 2, strength: 0.6, falloff: 'linear' }, true)],
  'smooth': [v('gentle', 'Gentle', { size: 6, strength: 0.3 }, true), v('strong', 'Strong', { size: 6, strength: 0.9 }, true), v('wide', 'Wide', { size: 12, strength: 0.6 }, true)],
  'flatten': [v('soft', 'Soft edge', { size: 6, strength: 0.5, falloff: 'smooth' }, true), v('hard', 'Hard edge', { size: 6, strength: 0.8, falloff: 'flat' }, true), v('pad', 'Big pad', { size: 12, strength: 0.6, falloff: 'linear' }, true)],
  'sculpt-grab': [v('small', 'Small', { size: 3 }, true), v('big', 'Big', { size: 8 }, true), v('soft', 'Soft', { size: 5, falloff: 'smooth' }, true), v('firm', 'Firm', { size: 5, falloff: 'linear' })],
  'sculpt-clay': [v('thin', 'Thin layers', { strength: 0.25 }, true), v('thick', 'Thick layers', { strength: 0.7 }, true), v('wide', 'Wide', { size: 8 }, true)],
  'sculpt-crease': [v('fine', 'Fine', { size: 1.5, strength: 0.4 }, true), v('deep', 'Deep', { size: 3, strength: 0.9 }, true), v('gully', 'Gully', { size: 5, strength: 0.6 }, true)],
  'sculpt-stamp': [v('small', 'Small', { size: 5 }, true), v('medium', 'Medium', { size: 8 }, true), v('big', 'Big', { size: 14 }, true), v('low', 'Low', { size: 10, strength: 0.3 }), v('tall', 'Tall', { size: 10, strength: 1 })],
  'sculpt-terrace': [v('low', 'Low steps', { strength: 0.25 }, true), v('steps', 'Steps', { strength: 0.5 }, true), v('high', 'High steps', { strength: 1 }, true)],
  'sculpt-noise': [v('pebbly', 'Pebbly', { size: 3, strength: 0.25 }, true), v('lumpy', 'Lumpy', { size: 5, strength: 0.6 }, true), v('rocky', 'Rocky', { size: 6, strength: 1 }, true)],
  'sculpt-pinch': [v('gentle', 'Gentle', { strength: 0.25 }, true), v('crisp', 'Crisp', { strength: 0.7 }, true)],
  'sculpt-erode': [v('gentle', 'Gentle', { strength: 0.3 }, true), v('strong', 'Strong', { strength: 1 }, true), v('wide', 'Wide', { size: 12, strength: 0.6 })],
  'things-one': [v('small', 'Small', { size: 0.6 }, true), v('as-made', 'As made', { size: 1 }, true), v('big', 'Big', { size: 1.8 }, true)],
  'things-scatter': [v('few', 'A few', { strength: 0.2 }, true), v('grove', 'A grove', { strength: 0.5 }, true), v('dense', 'Dense', { strength: 0.9 }, true), v('small-ones', 'Small ones', { size: 0.6, strength: 0.6 })],
  'things-row': [v('tight', 'Close together', { strength: 0.85 }, true), v('spaced', 'Spaced out', { strength: 0.4 }, true), v('far', 'Far apart', { strength: 0.1 }, true)],
  'paint-eraser': [v('small', 'Small', { size: 2 }, true), v('big', 'Big', { size: 6 }, true)],
};
/** The presets a tool shows at a level: Easy the best few, Pro and Studio all. */
export const variantsOf = (toolId: string, level: HotbarLevel = 'pro'): readonly ToolVariant[] => (TOOL_VARIANTS[toolId] ?? []).filter((x) => level !== 'easy' || x.best);
/** Which of a tool's presets it is set to now (its values match), or null. */
export function variantNow(tool: ToolPreset): ToolVariant | null {
  return (TOOL_VARIANTS[tool.id] ?? []).find((x) => Object.entries(x.patch).every(([k, val]) => (tool as unknown as Record<string, unknown>)[k] === val)) ?? null;
}
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
    ...(base.shape ? { shape: o.shape === 'blob' || o.shape === 'square' || o.shape === 'star' || o.shape === 'ring' ? o.shape : base.shape } : {}),
    ...(base.pattern ? { pattern: o.pattern === 'checker' || o.pattern === 'stripes' || o.pattern === 'dots' ? o.pattern : base.pattern } : {}),
    surface: base.action === 'paint' && typeof o.surface === 'number' && PAINTS.some((p) => p.id === o.surface) ? o.surface : base.surface,
    model: (base.action === 'place' || base.action === 'things') && typeof o.model === 'string' && THINGS.some((t) => t.id === o.model) ? o.model : base.model,
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
  if (t.action === 'paint' && !t.way) vars.push({ key: 'surface', type: 'enum', label: 'Paints', doc: 'The ground it paints.', tier: 'play', default: PAINTS.find((p) => p.id === t.surface)?.name ?? 'Grass', options: PAINTS.map((p) => p.name), group: 'Tool' });
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
